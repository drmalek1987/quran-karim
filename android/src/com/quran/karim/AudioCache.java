package com.quran.karim;

import android.content.Context;
import android.webkit.WebResourceResponse;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/**
 * Recitation audio (everyayah.com, one file per ayah). The web app fetches these URLs; each is answered from the copy
 * saved on the phone, or downloaded once and saved, so an ayah heard once plays later without internet.
 */
class AudioCache {
    static final String PREFIX = "https://everyayah.com/data/";
    private final File dir;

    AudioCache(Context c) { dir = new File(c.getFilesDir(), "audio"); }

    WebResourceResponse serve(String url) {
        String rel = url.substring(PREFIX.length());
        int q = rel.indexOf('?'); if (q >= 0) rel = rel.substring(0, q);
        if (!rel.matches("[A-Za-z0-9_.-]+/[0-9]{6}\\.mp3")) return null;
        File f = new File(dir, rel);
        try {
            synchronized (rel.intern()) { if (!f.exists()) download(url, f); }   // playback and read-ahead may ask together
            return response(200, "OK", new FileInputStream(f));
        } catch (Exception e) {
            return response(404, "Not Found", null);
        }
    }

    private static void download(String url, File f) throws Exception {
        f.getParentFile().mkdirs();
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000); c.setReadTimeout(30000);
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            File tmp = new File(f.getPath() + ".part");
            InputStream in = c.getInputStream();
            OutputStream out = new FileOutputStream(tmp);
            byte[] buf = new byte[16384]; int n;
            try { while ((n = in.read(buf)) > 0) out.write(buf, 0, n); } finally { out.close(); in.close(); }
            if (!tmp.renameTo(f)) throw new Exception("rename");
        } finally { c.disconnect(); }
    }

    private static WebResourceResponse response(int code, String reason, InputStream body) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");   // the page is a file:// page fetching an https URL
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse("audio/mpeg", null, code, reason, h, body);
    }
}
