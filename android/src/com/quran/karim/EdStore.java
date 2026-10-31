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
 * JS: EdBridge.state(id) -> "none" | "part" | "ready" | "busy"; EdBridge.download(id, url); EdBridge.remove(id);
 * progress comes back as window.onEdDl(id, percent | "wait" (connection lost, trying again) | "done" | "error").
 */
class EdStore {
    static final String ASSET = "file:///android_asset/web/";
    private final Activity act;
    private final WebView web;
    private final File dir;
    private volatile String busy;
    private volatile boolean pausing;

    EdStore(Activity a, WebView w) { act = a; web = w; dir = new File(a.getFilesDir(), "ed"); }

    // Page images asked under the asset folder are answered from the downloaded copy.
    WebResourceResponse serve(String url) {
        if (!url.startsWith(ASSET)) return null;
        String rel = url.substring(ASSET.length());
        if (!(rel.startsWith("editions/") || rel.startsWith("pages/") || rel.startsWith("tjpages/") || rel.startsWith("thmnotes/")) || rel.contains("..")) return null;
        if (rel.endsWith(".js")) return null;   // the editions' ayah boxes stay in the APK
        File f = new File(dir, rel);
        try {
            String type = rel.endsWith(".avif") ? "image/avif" : rel.endsWith(".webp") ? "image/webp" : rel.endsWith(".png") ? "image/png" : rel.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
            return new WebResourceResponse(type, null, new FileInputStream(f));
        } catch (Exception e) {
            return null;
        }
    }

    // The recitation-recognition packs (web/asr.js): the runtime and the models, asked at https://asr.app/<pack>/<file>.
    static final String ASR = "https://asr.app/";
    WebResourceResponse serveAsr(String url) {
        String rel = url.substring(ASR.length());
        int q = rel.indexOf('?'); if (q >= 0) rel = rel.substring(0, q);
        if (!rel.matches("asr[a-z]*/[A-Za-z0-9_.-]+") || rel.contains("..")) return null;
        String type = rel.endsWith(".js") || rel.endsWith(".mjs") ? "text/javascript" : rel.endsWith(".wasm") ? "application/wasm"
            : rel.endsWith(".json") ? "application/json" : "application/octet-stream";
        java.util.Map<String, String> h = new java.util.HashMap<String, String>();
        h.put("Access-Control-Allow-Origin", "*");
        try {
            return new WebResourceResponse(type, null, 200, "OK", h, new FileInputStream(new File(dir, "asr/" + rel)));
        } catch (Exception e) {
            return new WebResourceResponse(type, null, 404, "Not Found", h, new java.io.ByteArrayInputStream(new byte[0]));
        }
    }

    private static boolean okId(String id) { return id != null && id.matches("[a-z]+"); }

    @JavascriptInterface
    public String state(String id) {
        if (!okId(id)) return "none";
        if (id.equals(busy)) return "busy";
        if (new File(dir, id + ".ok").exists()) return "ready";
        return new File(dir, id + ".zip.part").exists() ? "part" : "none";   // a download cut off, e.g. the app was closed
    }

    // The zip is fetched into <id>.zip.part. If the connection drops, what arrived stays there and the next try asks only
    // for the rest (HTTP Range); tries go on by themselves, waiting longer each time, and the page hears "wait" meanwhile.
    @JavascriptInterface
    public void download(final String id, final String url) {
        if (!okId(id) || busy != null || !url.startsWith("https://")) { tell(id, "\"error\""); return; }
        busy = id; pausing = false;
        new Thread(new Runnable() { public void run() {
            File zip = new File(dir, id + ".zip.part");
            dir.mkdirs();
            for (int attempt = 0; ; attempt++) {
                try {
                    fetch(id, url, zip);
                    unzip(zip);
                    new File(dir, id + ".ok").createNewFile();
                    zip.delete();
                    busy = null; tell(id, "\"done\"");
                    return;
                } catch (Paused e) {
                    busy = null; pausing = false; tell(id, "\"paused\"");   // what arrived stays in .part for the resume
                    return;
                } catch (BadZip e) {
                    zip.delete();   // a broken file is fetched again from the start
                    if (attempt >= 3) break;
                } catch (Exception e) {
                    if (attempt >= 40) break;
                    tell(id, "\"wait\"");
                    try { Thread.sleep(Math.min(30000, 2000L * (attempt + 1))); } catch (InterruptedException ie) { break; }
                }
            }
            busy = null; tell(id, "\"error\"");
        } }).start();
    }

    private static class BadZip extends Exception {}
    private static class Paused extends Exception {}

    // Settings › Downloads «إيقاف مؤقت»: the running download stops after its current block; download() resumes it.
    @JavascriptInterface
    public void pause(String id) { if (id != null && id.equals(busy)) pausing = true; }

    private void fetch(String id, String url, File zip) throws Exception {
        long have = zip.exists() ? zip.length() : 0;
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setConnectTimeout(20000); c.setReadTimeout(30000);
        if (have > 0) c.setRequestProperty("Range", "bytes=" + have + "-");
        int code = c.getResponseCode();
        if (code == 416) { c.disconnect(); return; }          // already whole
        if (code == 200) have = 0;                             // the server sent it all again
        else if (code != 206) throw new Exception("HTTP " + code);
        long len = c.getContentLength(), total = len > 0 ? have + len : -1, got = have; int last = -1;
        InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(zip, have > 0);
        byte[] buf = new byte[65536]; int n;
        try {
            while ((n = in.read(buf)) > 0) {
                if (pausing) throw new Paused();
                out.write(buf, 0, n); got += n;
                int pct = total > 0 ? (int) (got * 95 / total) : -1;
                if (pct != last && pct >= 0) { last = pct; tell(id, String.valueOf(pct)); }
            }
        } finally { out.close(); in.close(); c.disconnect(); }
        if (total > 0 && got < total) throw new Exception("short");
    }

    private void unzip(File zip) throws Exception {
        try { unzip0(zip); } catch (java.util.zip.ZipException e) { throw new BadZip(); }
    }

    private void unzip0(File zip) throws Exception {
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
        new File(dir, id + ".ok").delete(); new File(dir, id + ".zip.part").delete();
        String[] sub = id.startsWith("asr") ? new String[] { "asr/" + id } : id.equals("thmnotes") ? new String[] { "thmnotes" } : id.equals("harmain") ? new String[] { "pages", "tjpages" } : new String[] { "editions/" + id, "editions/" + id + "-tj" };
        for (String s : sub) wipe(new File(dir, s));
        if (id.startsWith("asrnv")) new File(dir, "asr/nv.onnx").delete();   // the joined model (NvAsr)
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
