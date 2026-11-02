package com.quran.karim;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Training clips the reader chose to share («ساعد في تحسين التعرّف»). A clip is trimmed of silence, checked (loud enough,
 * not clipped, clear of background noise, 0.5-20 s), and kept in files/donate as FLAC + the page's JSON label until
 * DonateJob sends it. The relay (tools/relay/app.py) answers per clip; a clip leaves the phone only once the relay has
 * stored or refused it, and refusals are counted for the settings page. Protocol: progress.md, "Wire protocol".
 */
final class Donations {
    static final int SR = 16000, MAX_CLIPS = 300, BATCH = 20;
    private static final Object LOCK = new Object();

    static File dir(Context c) { File d = new File(c.getFilesDir(), "donate"); d.mkdirs(); return d; }
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("donate", Context.MODE_PRIVATE); }

    /** A random 128-bit id, made once; the relay stores only its hash. */
    static String deviceId(Context c) {
        SharedPreferences p = prefs(c); String id = p.getString("device", "");
        if (id.length() == 0) {
            byte[] b = new byte[16]; new SecureRandom().nextBytes(b); id = hex(b);
            p.edit().putString("device", id).apply();
        }
        return id;
    }

    /** Keeps one clip, or returns why not ("" when kept). */
    static String save(Context c, float[] y, String meta, int seq) {
        if (y == null) return "gone";
        int f = SR / 50, nf = y.length / f;                  // 20 ms frames
        if (nf < 10) return reject(c, "length");
        double[] e = new double[nf];
        for (int i = 0; i < nf; i++) { double s = 0; for (int j = 0; j < f; j++) { double v = y[i * f + j]; s += v * v; } e[i] = Math.sqrt(s / f); }
        double[] sorted = e.clone(); Arrays.sort(sorted);
        double p10 = sorted[nf / 10], p90 = sorted[nf * 9 / 10], thr = Math.max(p10 * 3, 0.004);
        int a = 0, b = nf - 1;
        while (a < nf && e[a] < thr) a++;
        while (b > a && e[b] < thr) b--;
        if (a >= nf) return reject(c, "quiet");
        int pad = 150 * SR / 1000, from = Math.max(0, a * f - pad), to = Math.min(y.length, (b + 1) * f + pad);
        int n = to - from; double dur = n / (double) SR;
        if (dur < 0.5 || dur > 20) return reject(c, "length");
        double sum = 0; int clipped = 0;
        for (int i = from; i < to; i++) { double v = y[i]; sum += v * v; if (Math.abs(v) >= 0.999) clipped++; }
        double rms = 20 * Math.log10(Math.sqrt(sum / n) + 1e-9), clip = clipped / (double) n, snr = 20 * Math.log10(p90 / Math.max(p10, 1e-5));
        if (rms < -40) return reject(c, "quiet");
        if (clip > 0.005) return reject(c, "clipped");
        if (snr < 10) return reject(c, "noisy");
        short[] pcm = new short[n];
        for (int i = 0; i < n; i++) pcm[i] = (short) Math.max(-32768, Math.min(32767, Math.round(y[from + i] * 32767)));
        try {
            JSONObject m = new JSONObject(meta);
            JSONObject q = new JSONObject(); q.put("rms", r1(rms)); q.put("clip", Math.round(clip * 1e4) / 1e4); q.put("snr", r1(snr)); q.put("dur", Math.round(dur * 100) / 100.0);
            m.put("q", q); m.put("seq", seq);
            synchronized (LOCK) {
                File d = dir(c);
                if (count(d) >= MAX_CLIPS) return reject(c, "full");
                String id = String.valueOf(System.currentTimeMillis());
                write(new File(d, id + ".flac"), FlacEncoder.encode(pcm));
                write(new File(d, id + ".json"), m.toString().getBytes("UTF-8"));
            }
            return "";
        } catch (Exception ex) { return "error"; }
    }
    private static double r1(double v) { return Math.round(v * 10) / 10.0; }

    private static String reject(Context c, String why) {
        synchronized (LOCK) {
            SharedPreferences p = prefs(c);
            try {
                JSONObject r = new JSONObject(p.getString("rejects", "{}")); r.put(why, r.optInt(why) + 1);
                p.edit().putString("rejects", r.toString()).apply();
            } catch (Exception e) { }
        }
        return why;
    }

    private static int count(File d) {
        String[] l = d.list(); int n = 0;
        if (l != null) for (String s : l) if (s.endsWith(".flac") || s.endsWith(".wav")) n++;
        return n;
    }

    /** {"waiting":n,"rejected":{"reason":n,...}} for the settings page. */
    static String stats(Context c) {
        try {
            JSONObject o = new JSONObject(); o.put("waiting", count(dir(c)));
            o.put("rejected", new JSONObject(prefs(c).getString("rejects", "{}"))); return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    /**
     * Sends everything waiting, BATCH clips per request. Returns false when it should be tried again later
     * (no key, network, 401/429/5xx); true when the queue is empty.
     */
    static boolean upload(Context c) {
        if (DonateKey.KEY.length() == 0) return true;
        String device = deviceId(c);
        while (true) {
            File d = dir(c); File[] l = d.listFiles(); if (l == null) return true;
            Arrays.sort(l);
            List<File> audio = new ArrayList<File>(); List<byte[]> bodies = new ArrayList<byte[]>(); List<String> metas = new ArrayList<String>();
            for (File w : l) {
                String nm = w.getName();
                if (!nm.endsWith(".flac") && !nm.endsWith(".wav")) continue;
                File j = new File(d, nm.substring(0, nm.lastIndexOf('.')) + ".json");
                try {
                    byte[] b = readAll(w);
                    if (nm.endsWith(".wav")) b = wavToFlac(b);   // clips kept by 4.8
                    audio.add(w); bodies.add(b); metas.add(j.exists() ? new String(readAll(j), "UTF-8") : "{}");
                } catch (Exception e) { w.delete(); j.delete(); }
                if (audio.size() == BATCH) break;
            }
            if (audio.isEmpty()) return true;
            try {
                String ts = String.valueOf(System.currentTimeMillis() / 1000);
                StringBuilder parts = new StringBuilder();
                for (int i = 0; i < audio.size(); i++) parts.append(sha256(metas.get(i).getBytes("UTF-8"))).append(sha256(bodies.get(i)));
                String sig = hmac(ts + "|" + device + "|" + parts);
                String bd = "----qk" + System.nanoTime();
                ByteArrayOutputStream o = new ByteArrayOutputStream();
                field(o, bd, "device", device); field(o, bd, "ts", ts); field(o, bd, "sig", sig);
                for (int i = 0; i < audio.size(); i++) {
                    field(o, bd, "meta" + i, metas.get(i));
                    o.write(("--" + bd + "\r\nContent-Disposition: form-data; name=\"audio" + i + "\"; filename=\"c.flac\"\r\nContent-Type: audio/flac\r\n\r\n").getBytes("UTF-8"));
                    o.write(bodies.get(i)); o.write("\r\n".getBytes("UTF-8"));
                }
                o.write(("--" + bd + "--\r\n").getBytes("UTF-8"));
                HttpURLConnection h = (HttpURLConnection) new URL(DonateKey.URL + "/batch").openConnection();
                h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(90000);   // the relay answers after its shared commit
                h.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + bd);
                h.setFixedLengthStreamingMode(o.size());
                OutputStream out = h.getOutputStream(); o.writeTo(out); out.close();
                int code = h.getResponseCode();
                if (code != 200) { h.disconnect(); return false; }
                JSONArray res = new JSONObject(new String(readStream(h.getInputStream()), "UTF-8")).getJSONArray("results"); h.disconnect();
                for (int k = 0; k < res.length(); k++) {
                    JSONObject r = res.getJSONObject(k); int i = r.getInt("i");
                    if (i < 0 || i >= audio.size()) continue;
                    if (!r.optBoolean("ok")) reject(c, "srv:" + r.optString("reason", "?"));
                    File w = audio.get(i); String nm = w.getName();
                    w.delete(); new File(d, nm.substring(0, nm.lastIndexOf('.')) + ".json").delete();
                }
            } catch (Exception e) { return false; }
        }
    }

    /**
     * Deletes everything: the clips still waiting here, and on the relay every clip sent under the current id and the
     * given older ids (the page's donateId from 4.8). Then starts a new id, so later clips are not linked to the old ones.
     */
    static boolean forget(Context c, String oldIds) {
        synchronized (LOCK) {
            File[] l = dir(c).listFiles(); if (l != null) for (File f : l) f.delete();
            prefs(c).edit().remove("rejects").apply();
        }
        List<String> ids = new ArrayList<String>(); ids.add(deviceId(c));
        for (String s : oldIds.split(",")) if (s.trim().length() > 0) ids.add(s.trim());
        boolean ok = DonateKey.KEY.length() > 0;
        for (String id : ids) {
            try {
                String ts = String.valueOf(System.currentTimeMillis() / 1000), bd = "----qk" + System.nanoTime();
                ByteArrayOutputStream o = new ByteArrayOutputStream();
                field(o, bd, "device", id); field(o, bd, "ts", ts); field(o, bd, "sig", hmac(ts + "|" + id + "|delete"));
                o.write(("--" + bd + "--\r\n").getBytes("UTF-8"));
                HttpURLConnection h = (HttpURLConnection) new URL(DonateKey.URL + "/delete").openConnection();
                h.setDoOutput(true); h.setConnectTimeout(15000); h.setReadTimeout(90000);
                h.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + bd);
                OutputStream out = h.getOutputStream(); o.writeTo(out); out.close();
                ok &= h.getResponseCode() == 200; h.disconnect();
            } catch (Exception e) { ok = false; }
        }
        if (ok) prefs(c).edit().remove("device").apply();
        return ok;
    }

    // ---- helpers
    private static void field(ByteArrayOutputStream o, String bd, String name, String v) throws Exception {
        o.write(("--" + bd + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n" + v + "\r\n").getBytes("UTF-8"));
    }
    static byte[] wavToFlac(byte[] w) {
        int at = 12, data = -1, len = 0;
        while (at + 8 <= w.length) {
            int sz = (w[at + 4] & 0xFF) | (w[at + 5] & 0xFF) << 8 | (w[at + 6] & 0xFF) << 16 | (w[at + 7] & 0xFF) << 24;
            if (w[at] == 'd' && w[at + 1] == 'a' && w[at + 2] == 't' && w[at + 3] == 'a') { data = at + 8; len = Math.min(sz, w.length - data); break; }
            at += 8 + sz;
        }
        if (data < 0) throw new IllegalArgumentException("wav");
        short[] s = new short[len / 2];
        for (int i = 0; i < s.length; i++) s[i] = (short) ((w[data + 2 * i] & 0xFF) | (w[data + 2 * i + 1] << 8));
        return FlacEncoder.encode(s);
    }
    private static String hmac(String s) throws Exception {
        javax.crypto.Mac m = javax.crypto.Mac.getInstance("HmacSHA256");
        m.init(new javax.crypto.spec.SecretKeySpec(DonateKey.KEY.getBytes("UTF-8"), "HmacSHA256"));
        return hex(m.doFinal(s.getBytes("UTF-8")));
    }
    private static String sha256(byte[] b) throws Exception { return hex(MessageDigest.getInstance("SHA-256").digest(b)); }
    private static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x & 0xFF)); return s.toString(); }
    private static void write(File f, byte[] b) throws Exception { OutputStream o = new FileOutputStream(f); try { o.write(b); } finally { o.close(); } }
    static byte[] readAll(File f) throws Exception { java.io.InputStream in = new java.io.FileInputStream(f); try { return readStream(in); } finally { in.close(); } }
    private static byte[] readStream(java.io.InputStream in) throws Exception {
        ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); return bo.toByteArray();
    }
}
