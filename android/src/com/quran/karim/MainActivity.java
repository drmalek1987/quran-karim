package com.quran.karim;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.ValueCallback;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Shows the bundled offline Quran web app (assets/web) full screen. */
public class MainActivity extends Activity {
    private EdStore eds;
    private static final String START = "file:///android_asset/web/index.html";
    private WebView web;
    private ValueCallback<Uri[]> pickCb;
    private PermissionRequest micReq;
    private ReciteBridge recite;

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == 7 && pickCb != null) {
            pickCb.onReceiveValue(res == RESULT_OK && data != null && data.getData() != null ? new Uri[] { data.getData() } : null);
            pickCb = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }
    private QiblaBridge qibla;
    private AudioCache audio;
    private SpeechBridge speech;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        // Pinch to zoom into a mushaf page.
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        audio = new AudioCache(this);
        s.setMediaPlaybackRequiresUserGesture(false);   // the recitation moves on to the next ayah by itself
        // <input type=file> (restoring a backup) needs the system file picker.
        web.setWebChromeClient(new WebChromeClient() {
            // Recording your own recitation (hifz test) asks for the microphone once, then the page gets it.
            @Override
            public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(new Runnable() { public void run() {
                    boolean audio = false;
                    for (String res : r.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) audio = true;
                    if (!audio) { r.deny(); return; }
                    if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission("android.permission.RECORD_AUDIO") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        micReq = r; requestPermissions(new String[] { "android.permission.RECORD_AUDIO" }, 77); return;
                    }
                    r.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                } });
            }
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pickCb != null) pickCb.onReceiveValue(null);
                pickCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
                try { startActivityForResult(i, 7); } catch (Exception e) { pickCb = null; return false; }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            // Recitation audio: served from the copy on the phone, downloaded and kept the first time.
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                String url = req.getUrl().toString();
                if (url.startsWith(AudioCache.PREFIX)) return audio.serve(url);
                // Tafsir and other books are stored Brotli-compressed in the APK (tools/brotli_books.py).
                if (url.startsWith(EdStore.ASSET + "books/") && url.endsWith(".js")) {
                    try {
                        String rel = Uri.decode(url.substring("file:///android_asset/".length()));
                        return new WebResourceResponse("application/javascript", "utf-8",
                            new org.brotli.dec.BrotliInputStream(getAssets().open(rel + ".br")));
                    } catch (Exception e) { return null; }
                }
                return eds != null ? eds.serve(url) : null;
            }

            // String overload: newer Android versions still route through it, and it exists on API 21.
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri u = Uri.parse(url);
                if ("file".equals(u.getScheme())) return false;
                // Anything external opens in the browser; the app only goes online for recitation audio.
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        qibla = new QiblaBridge(this, web);
        web.addJavascriptInterface(qibla, "QiblaBridge");
        web.addJavascriptInterface(new AppBridge(this), "AppBridge");
        eds = new EdStore(this, web);
        web.addJavascriptInterface(eds, "EdBridge");
        speech = new SpeechBridge(this, web);
        web.addJavascriptInterface(speech, "SpeechBridge");
        recite = new ReciteBridge(this, web);
        web.addJavascriptInterface(recite, "ReciteBridge");
        // Android 15+ draws apps edge to edge: keep the page clear of the status bar, the navigation bar and a camera cutout.
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xff0a4535);
        root.addView(web);
        if (Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                    android.graphics.Insets i = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    v.setPadding(i.left, i.top, i.right, i.bottom);
                    return WindowInsets.CONSUMED;
                }
            });
        }
        setContentView(root);
        // Android 13+ sends back here (enableOnBackInvokedCallback in the manifest; Android 16 no longer calls onBackPressed).
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, new OnBackInvokedCallback() {
                public void onBackInvoked() { goBack(); }
            });
        }
        String hash = getIntent().getStringExtra("hash");
        if (hash != null && hash.length() > 0) web.loadUrl(START + hash);
        else if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    // A notification or the widget opened the app while it was already running: go to that screen.
    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        String hash = i.getStringExtra("hash");
        if (hash != null && hash.startsWith("#/")) web.evaluateJavascript("location.hash=" + org.json.JSONObject.quote(hash), null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        qibla.resume();
    }

    @Override
    protected void onPause() {
        qibla.pause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        speech.shutdown();
        recite.shutdown();
        super.onDestroy();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] results) {
        if (code == QiblaBridge.PERMISSION_REQUEST) qibla.onPermissionResult(results);
        if (code == ReciteBridge.PERMISSION_REQUEST) recite.onPermissionResult(results);
        if (code == 77 && micReq != null) {
            if (results.length > 0 && results[0] == android.content.pm.PackageManager.PERMISSION_GRANTED) micReq.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            else micReq.deny();
            micReq = null;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() { goBack(); }

    // An open sheet, dialog or ayah bar closes first, so back from Settings returns to the open page.
    private void goBack() {
        web.evaluateJavascript("window.qBack ? qBack() : false", new ValueCallback<String>() {
            public void onReceiveValue(String closed) {
                if ("true".equals(closed)) return;
                if (web.canGoBack()) web.goBack();
                else finish();
            }
        });
    }
}
