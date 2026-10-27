package com.quran.karim;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.util.Locale;

/**
 * Reads the hadith adhkar aloud with the phone's own Arabic text-to-speech voice (there is no openly licensed human
 * recording of them), exposed as window.SpeechBridge. The Quranic adhkar use the reciter's recordings instead.
 * The page is told through window.onSpeech(id, state): "start", "done", "error", or "nolang" when the phone has no Arabic voice.
 */
class SpeechBridge {
    private final Activity activity;
    private final WebView web;
    private TextToSpeech tts;
    private int status = 0;          // 0 = starting, 1 = ready, -1 = no engine or no Arabic voice
    private String pendingText, pendingId;
    private float pendingRate = 1f;

    SpeechBridge(Activity activity, WebView web) { this.activity = activity; this.web = web; }

    private void tell(final String id, final String state) {
        activity.runOnUiThread(new Runnable() {
            public void run() { web.evaluateJavascript("window.onSpeech && onSpeech(" + quote(id) + "," + quote(state) + ")", null); }
        });
    }

    private static String quote(String s) { return "\"" + (s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\"")) + "\""; }

    private void start() {
        tts = new TextToSpeech(activity, new TextToSpeech.OnInitListener() {
            public void onInit(int st) {
                if (st != TextToSpeech.SUCCESS) { status = -1; if (pendingId != null) tell(pendingId, "nolang"); return; }
                int r = tts.setLanguage(new Locale("ar"));
                if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) { status = -1; if (pendingId != null) tell(pendingId, "nolang"); return; }
                status = 1;
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    public void onStart(String id) { tell(id, "start"); }
                    public void onDone(String id) { tell(id, "done"); }
                    @SuppressWarnings("deprecation") public void onError(String id) { tell(id, "error"); }
                });
                if (pendingId != null) { say(pendingText, pendingRate, pendingId); pendingId = null; }
            }
        });
    }

    private void say(String text, float rate, String id) {
        tts.setSpeechRate(rate);
        if (Build.VERSION.SDK_INT >= 21) tts.speak(text, TextToSpeech.QUEUE_FLUSH, new Bundle(), id);
    }

    @JavascriptInterface
    public void speak(final String text, final float rate, final String id) {
        activity.runOnUiThread(new Runnable() {
            public void run() {
                if (status == -1) { tell(id, "nolang"); return; }
                if (status == 0) { pendingText = text; pendingRate = rate; pendingId = id; if (tts == null) start(); return; }
                say(text, rate, id);
            }
        });
    }

    @JavascriptInterface
    public void stop() {
        activity.runOnUiThread(new Runnable() {
            public void run() { pendingId = null; if (tts != null && status == 1) tts.stop(); }
        });
    }

    void shutdown() { if (tts != null) tts.shutdown(); }
}
