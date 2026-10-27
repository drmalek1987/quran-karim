package com.quran.karim;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Mushaf page images are not in the APK: each edition is one zip (its page images and tajweed layer, at their web/
 * paths) downloaded when the reader picks it, unpacked into files/ed and served to the page from there.
 * JS: EdBridge.state(id) -> "none" | "ready" | "busy"; EdBridge.download(id, url); EdBridge.remove(id);
 * progress comes back as window.onEdDl(id, percent | "done" | "error").
 */
class EdStore {
    static final String ASSET = "file:///android_asset/web/";
    private final Activity act;
    private final WebView web;
    private final File dir;
    private volatile String busy;

    EdStore(Activity a, WebView w) { act = a; web = w; dir = new File(a.getFilesDir(), "ed"); }

    // Page images asked under the asset folder are answered from the downloaded copy.
    WebResourceResponse serve(String url) {
        if (!url.startsWith(ASSET)) return null;
        String rel = url.substring(ASSET.length());
        if (!(rel.startsWith("editions/") || rel.startsWith("pages/") || rel.startsWith("tjpages/")) || rel.contains("..")) return null;
        if (rel.endsWith(".js")) return null;   // the editions' ayah boxes stay in the APK
        File f = new File(dir, rel);
        try {
            String type = rel.endsWith(".avif") ? "image/avif" : rel.endsWith(".webp") ? "image/webp" : rel.endsWith(".png") ? "image/png" : rel.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
            return new WebResourceResponse(type, null, new FileInputStream(f));
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean okId(String id) { return id != null && id.matches("[a-z]+"); }

    @JavascriptInterface
    public String state(String id) {
        if (!okId(id)) return "none";
        if (id.equals(busy)) return "busy";
        return new File(dir, id + ".ok").exists() ? "ready" : "none";
    }

    @JavascriptInterface
    public void download(final String id, final String url) {
        if (!okId(id) || busy != null || !url.startsWith("https://")) { tell(id, "\"error\""); return; }
        busy = id;
        new Thread(new Runnable() { public void run() {
            File zip = new File(dir, id + ".zip.part");
            try {
                dir.mkdirs();
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(20000); c.setReadTimeout(60000);
                if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
                long len = c.getContentLength(), got = 0; int last = -1;
                InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(zip);
                byte[] buf = new byte[65536]; int n;
                try {
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); got += n;
                        int pct = len > 0 ? (int) (got * 95 / len) : -1;
                        if (pct != last && pct >= 0) { last = pct; tell(id, String.valueOf(pct)); }
                    }
                } finally { out.close(); in.close(); c.disconnect(); }
                unzip(zip);
                new File(dir, id + ".ok").createNewFile();
                busy = null; tell(id, "\"done\"");
            } catch (Exception e) {
                busy = null; tell(id, "\"error\"");
            } finally { zip.delete(); }
        } }).start();
    }

    private void unzip(File zip) throws Exception {
        String root = dir.getCanonicalPath() + File.separator;
        ZipInputStream z = new ZipInputStream(new FileInputStream(zip));
        byte[] buf = new byte[65536]; int n;
        try {
            for (ZipEntry e; (e = z.getNextEntry()) != null; ) {
                File f = new File(dir, e.getName());
                if (!f.getCanonicalPath().startsWith(root)) throw new Exception("bad entry");
                if (e.isDirectory()) { f.mkdirs(); continue; }
                f.getParentFile().mkdirs();
                OutputStream out = new FileOutputStream(f);
                try { while ((n = z.read(buf)) > 0) out.write(buf, 0, n); } finally { out.close(); }
            }
        } finally { z.close(); }
    }

    @JavascriptInterface
    public void remove(String id) {
        if (!okId(id) || id.equals(busy)) return;
        new File(dir, id + ".ok").delete();
        String[] sub = id.equals("harmain") ? new String[] { "pages", "tjpages" } : new String[] { "editions/" + id, "editions/" + id + "-tj" };
        for (String s : sub) wipe(new File(dir, s));
    }

    private static void wipe(File f) {
        File[] k = f.listFiles();
        if (k != null) for (File x : k) wipe(x);
        f.delete();
    }

    private void tell(final String id, final String v) {
        act.runOnUiThread(new Runnable() { public void run() {
            web.evaluateJavascript("window.onEdDl&&onEdDl(" + "\"" + id + "\"," + v + ")", null);
        } });
    }
}
