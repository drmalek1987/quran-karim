package com.quran.karim;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import java.util.ArrayList;

/**
 * Listens to the reader reciting from memory with the phone's own Arabic speech recogniser, exposed as window.ReciteBridge.
 * The page gets window.onRecite(text, final) with the words heard so far, and window.onRecite("", "state:<s>") for
 * "listening", "stopped", "noperm", "none" (no recogniser on the phone) or "error:<code>". The recogniser stops after
 * every pause, so it is started again until the page calls stop().
 */
class ReciteBridge {
    static final int PERMISSION_REQUEST = 78;
    private final Activity activity;
    private final WebView web;
    private SpeechRecognizer rec;
    private boolean on = false;

    ReciteBridge(Activity activity, WebView web) { this.activity = activity; this.web = web; }

    private void tell(final String text, final String kind) {
        activity.runOnUiThread(new Runnable() {
            public void run() { web.evaluateJavascript("window.onRecite && onRecite(" + org.json.JSONObject.quote(text) + "," + org.json.JSONObject.quote(kind) + ")", null); }
        });
    }

    @JavascriptInterface
    public boolean available() { return SpeechRecognizer.isRecognitionAvailable(activity); }

    @JavascriptInterface
    public void start() {
        activity.runOnUiThread(new Runnable() {
            public void run() {
                if (!SpeechRecognizer.isRecognitionAvailable(activity)) { tell("", "state:none"); return; }
                if (activity.checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED) {
                    activity.requestPermissions(new String[] { "android.permission.RECORD_AUDIO" }, PERMISSION_REQUEST); return;
                }
                on = true; listen();
            }
        });
    }

    @JavascriptInterface
    public void stop() {
        activity.runOnUiThread(new Runnable() {
            public void run() { on = false; if (rec != null) { rec.cancel(); rec.destroy(); rec = null; } tell("", "state:stopped"); }
        });
    }

    void onPermissionResult(int[] results) {
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) start(); else tell("", "state:noperm");
    }

    private void listen() {
        if (!on) return;
        if (rec == null) {
            rec = SpeechRecognizer.createSpeechRecognizer(activity);
            rec.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle b) { tell("", "state:listening"); }
                public void onBeginningOfSpeech() { }
                public void onRmsChanged(float v) { }
                public void onBufferReceived(byte[] b) { }
                public void onEndOfSpeech() { }
                public void onEvent(int t, Bundle b) { }
                public void onPartialResults(Bundle b) { send(b, "partial"); }
                public void onResults(Bundle b) { send(b, "final"); listen(); }
                public void onError(int e) {
                    // No match and silence just mean a pause: listen again. Anything else is reported and ends the session.
                    if (e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { listen(); return; }
                    on = false; tell("", "state:error:" + e);
                }
            });
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-SA");
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 2500L);
        try { rec.startListening(i); } catch (Exception e) { on = false; tell("", "state:error:start"); }
    }

    private void send(Bundle b, String kind) {
        ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (r != null && !r.isEmpty()) tell(r.get(0), kind);
    }

    void shutdown() { on = false; if (rec != null) { rec.destroy(); rec = null; } }
}
