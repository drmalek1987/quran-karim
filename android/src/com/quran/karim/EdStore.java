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
    // One download in the whole process, not per screen: after a Back exit the download thread goes on, and the
    // reopened app (a new EdStore) must see it as busy instead of starting a second writer on the same .part file.
    private static volatile String busy;
    private static volatile boolean pausing;
    private static volatile EdStore cur;     // the open screen: progress is told to its page

    EdStore(Activity a, WebView w) { act = a; web = w; dir = new File(a.getFilesDir(), "ed"); cur = this; }

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
                } catch (NoSpace e) {
                    busy = null; say("window.onEdSpace&&onEdSpace(\"" + id + "\")"); tell(id, "\"error\"");
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
    private static class NoSpace extends Exception {}
    // The zip, then its files unpacked beside it (stored, so the same size again), plus a margin.
    private void needSpace(long zipBytes, long have) throws NoSpace {
        if (dir.getUsableSpace() < (zipBytes - have) + zipBytes + (20L << 20)) throw new NoSpace();
    }

    // Settings › Downloads «إيقاف مؤقت»: the running download stops after its current block; download() resumes it.
    @JavascriptInterface
    public void pause(String id) { if (id != null && id.equals(busy)) pausing = true; }

    // Parallel fetch: the file is cut into NP ranges, each on its own connection (one GitHub connection is often slow,
    // ~250 KB/s; four together are ~5x faster). <id>.zip.map keeps how much of each range arrived, so a cut, a pause or
    // closing the app resumes every range where it stopped. Servers without Range use the single-stream fetch1().
    static final int NP = 4;
    private void fetch(final String id, final String url, final File zip) throws Exception {
        final File map = new File(dir, id + ".zip.map");
        if (zip.exists() && zip.length() > 0 && !map.exists()) { fetch1(id, url, zip); return; }   // an old single-stream part
        long total = -1; long[] done = new long[NP];
        if (map.exists()) {
            String[] f = new String(readAll(map), "UTF-8").trim().split(" ");
            if (f.length == NP + 1) { total = Long.parseLong(f[0]); for (int i = 0; i < NP; i++) done[i] = Long.parseLong(f[i + 1]); }
        }
        if (total <= 0 || !zip.exists() || zip.length() != total) {
            HttpURLConnection c = open(url); c.setRequestProperty("Range", "bytes=0-0");
            int code = c.getResponseCode(); String cr = c.getHeaderField("Content-Range"); c.disconnect();
            if (code != 206 || cr == null || cr.indexOf('/') < 0 || cr.endsWith("*")) { map.delete(); zip.delete(); fetch1(id, url, zip); return; }
            total = Long.parseLong(cr.substring(cr.indexOf('/') + 1).trim());
            done = new long[NP];
            needSpace(total, 0);   // a full phone is not a lost connection: say so at once instead of 40 tries
            java.io.RandomAccessFile r = new java.io.RandomAccessFile(zip, "rw"); r.setLength(total); r.close();
        }
        final long T = total; final long[] D = done; final long step = (T + NP - 1) / NP;
        final Exception[] fail = new Exception[1];
        Thread[] th = new Thread[NP];
        for (int i = 0; i < NP; i++) {
            final int k = i;
            th[i] = new Thread(new Runnable() { public void run() {
                long a = k * step, b = Math.min(T, a + step);       // [a, b)
                if (a + D[k] >= b) return;
                java.io.RandomAccessFile r = null; HttpURLConnection c = null; InputStream in = null;
                try {
                    c = open(url); c.setRequestProperty("Range", "bytes=" + (a + D[k]) + "-" + (b - 1));
                    if (c.getResponseCode() != 206) throw new Exception("HTTP " + c.getResponseCode());
                    in = c.getInputStream(); r = new java.io.RandomAccessFile(zip, "rw"); r.seek(a + D[k]);
                    byte[] buf = new byte[65536]; int n;
                    while (a + D[k] < b && (n = in.read(buf, 0, (int) Math.min(buf.length, b - a - D[k]))) > 0) {
                        if (pausing) throw new Paused();
                        synchronized (fail) { if (fail[0] != null) return; }
                        r.write(buf, 0, n);
                        synchronized (D) { D[k] += n; }
                    }
                    if (a + D[k] < b) throw new Exception("short");
                } catch (Exception e) { synchronized (fail) { if (fail[0] == null) fail[0] = e; } }
                finally {
                    try { if (r != null) r.close(); } catch (Exception e) {}
                    try { if (in != null) in.close(); } catch (Exception e) {}
                    if (c != null) c.disconnect();
                }
            } });
            th[i].start();
        }
        int last = -1; long saved = -1;
        while (true) {
            boolean alive = false;
            for (Thread t : th) if (t.isAlive()) alive = true;
            long got = 0; StringBuilder sb = new StringBuilder(String.valueOf(T));
            synchronized (D) { for (long x : D) { got += x; sb.append(' ').append(x); } }
            if (got != saved) { writeAll(map, sb.toString()); saved = got; }   // written after the bytes, so it never overstates
            int pct = (int) (got * 95 / T);
            if (pct != last) { last = pct; tell(id, String.valueOf(pct)); }
            if (!alive) break;
            Thread.sleep(400);
        }
        if (fail[0] != null) throw fail[0];
        map.delete();
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true); c.setConnectTimeout(20000); c.setReadTimeout(30000);
        return c;
    }
    private static byte[] readAll(File f) throws Exception {
        FileInputStream in = new FileInputStream(f); byte[] b = new byte[(int) f.length()]; int o = 0, n;
        try { while (o < b.length && (n = in.read(b, o, b.length - o)) > 0) o += n; } finally { in.close(); }
        return b;
    }
    private static void writeAll(File f, String s) throws Exception {
        File t = new File(f.getPath() + ".tmp"); FileOutputStream o = new FileOutputStream(t);
        try { o.write(s.getBytes("UTF-8")); } finally { o.close(); }
        t.renameTo(f);
    }

    private void fetch1(String id, String url, File zip) throws Exception {
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
        if (total > 0) { try { needSpace(total, have); } catch (NoSpace e) { c.disconnect(); throw e; } }
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
        new File(dir, id + ".ok").delete(); new File(dir, id + ".zip.part").delete(); new File(dir, id + ".zip.map").delete();
        String[] sub = id.startsWith("asr") ? new String[] { "asr/" + id } : id.equals("thmnotes") ? new String[] { "thmnotes" } : id.equals("harmain") ? new String[] { "pages", "tjpages" } : new String[] { "editions/" + id, "editions/" + id + "-tj" };
        for (String s : sub) wipe(new File(dir, s));
        if (id.startsWith("asrnv")) new File(dir, "asr/nv.onnx").delete();   // the joined model (NvAsr)
    }

    private static void wipe(File f) {
        File[] k = f.listFiles();
        if (k != null) for (File x : k) wipe(x);
        f.delete();
    }

    private static void tell(String id, String v) { say("window.onEdDl&&onEdDl(" + "\"" + id + "\"," + v + ")"); }
    private static void say(final String js) {
        final EdStore s = cur; if (s == null) return;
        s.act.runOnUiThread(new Runnable() { public void run() {
            try { s.web.evaluateJavascript(js, null); } catch (Exception e) { }   // the screen was closed meanwhile
        } });
    }
}
