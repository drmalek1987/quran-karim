package com.quran.karim;

import android.app.Activity;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.FloatBuffer;
import java.nio.LongBuffer;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Recitation recognised on the phone by NVIDIA's Arabic FastConformer (CTC, int8), run with ONNX Runtime for Android,
 * exposed as window.NvBridge. The model is the "asrnv" + "asrnvp" download (EdStore), joined once into files/ed/asr/nv.onnx.
 * Speech is cut at pauses; while a piece is being said the words so far come back as window.onRecite(text, "partial"),
 * and the whole piece as onRecite(text, "final") — the same calls as the phone's recogniser (ReciteBridge), so the page
 * follows either the same way. States: onRecite("", "state:busy" | "state:listening" | "state:stopped" | "state:noperm" |
 * "state:error:<why>"). Features as NeMo makes them (and web/asr.js nvFeats): pre-emphasis, 25 ms symmetric Hann in a
 * 512-point FFT every 10 ms, 80 slaney mel bands, log, each band normalised over the piece.
 */
class NvAsr {
    static final int PERMISSION_REQUEST = 79;
    private static final int SR = 16000, NF = 512, WIN = 400, HOP = 160, NB = 257, NM = 80;
    private final Activity act;
    private final WebView web;
    private final File dir;
    private final ExecutorService work = Executors.newSingleThreadExecutor();
    private volatile boolean on = false, decoding = false;
    private OrtEnvironment env;
    private OrtSession session;
    private String[] vocab;
    private Thread rec;
    private volatile float[] lastFinal;

    NvAsr(Activity a, WebView w) { act = a; web = w; dir = new File(new File(a.getFilesDir(), "ed"), "asr"); }

    private void tell(final String text, final String kind) {
        act.runOnUiThread(new Runnable() { public void run() {
            web.evaluateJavascript("window.onRecite && onRecite(" + org.json.JSONObject.quote(text) + "," + org.json.JSONObject.quote(kind) + ")", null);
        } });
    }

    @JavascriptInterface
    public boolean ready() { return new File(dir, "asrnv/a.bin").exists() && new File(dir, "asrnvp/b.bin").exists() && new File(dir, "asrnv/vocab.json").exists(); }

    @JavascriptInterface
    public void start() {
        act.runOnUiThread(new Runnable() { public void run() {
            if (act.checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED) {
                act.requestPermissions(new String[] { "android.permission.RECORD_AUDIO" }, PERMISSION_REQUEST); return;
            }
            if (on) return;
            on = true;
            tell("", "state:busy");
            work.execute(new Runnable() { public void run() {
                try { load(); } catch (Throwable e) { on = false; tell("", "state:error:load " + e.getMessage()); return; }
                if (on) listen();
            } });
        } });
    }

    @JavascriptInterface
    public void stop() { on = false; tell("", "state:stopped"); }

    void onPermissionResult(int[] r) { if (r.length > 0 && r[0] == PackageManager.PERMISSION_GRANTED) start(); else tell("", "state:noperm"); }

    // Training clips, only when the reader turned «ساعد في تحسين التعرّف» on: the last piece of speech is kept as a 16 kHz
    // WAV in files/donate with what the page matched it to (JSON from the page), at most 300 waiting to be sent.
    @JavascriptInterface
    public boolean donate(String meta) {
        float[] y = lastFinal; lastFinal = null;
        if (y == null || y.length < SR / 2) return false;
        File d = new File(act.getFilesDir(), "donate"); d.mkdirs();
        String[] have = d.list(); if (have != null && have.length >= 600) return false;
        String id = String.valueOf(System.currentTimeMillis());
        try {
            java.io.DataOutputStream o = new java.io.DataOutputStream(new java.io.BufferedOutputStream(new FileOutputStream(new File(d, id + ".wav"))));
            int n = y.length * 2;
            try {
                o.writeBytes("RIFF"); o.writeInt(Integer.reverseBytes(36 + n)); o.writeBytes("WAVEfmt ");
                o.writeInt(Integer.reverseBytes(16)); o.writeShort(Short.reverseBytes((short) 1)); o.writeShort(Short.reverseBytes((short) 1));
                o.writeInt(Integer.reverseBytes(SR)); o.writeInt(Integer.reverseBytes(SR * 2)); o.writeShort(Short.reverseBytes((short) 2)); o.writeShort(Short.reverseBytes((short) 16));
                o.writeBytes("data"); o.writeInt(Integer.reverseBytes(n));
                for (float v : y) o.writeShort(Short.reverseBytes((short) Math.max(-32768, Math.min(32767, Math.round(v * 32767)))));
            } finally { o.close(); }
            OutputStream m = new FileOutputStream(new File(d, id + ".json"));
            try { m.write(meta.getBytes("UTF-8")); } finally { m.close(); }
            return true;
        } catch (Exception e) { return false; }
    }

    // Sends the waiting clips to the relay Space (which writes them to the private dataset), deleting each one once it
    // is accepted. Runs in the background; stops at the first network failure and tries again next time.
    @JavascriptInterface
    public void upload(final String device) {
        new Thread(new Runnable() { public void run() {
            File d = new File(act.getFilesDir(), "donate"); File[] l = d.listFiles(); if (l == null) return;
            for (File w : l) {
                if (!w.getName().endsWith(".wav")) continue;
                File j = new File(d, w.getName().replace(".wav", ".json"));
                try {
                    String b = "----qk" + System.nanoTime();
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL("https://drabdelraman-quran-voice-relay.hf.space/clip").openConnection();
                    c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(30000);
                    c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + b);
                    OutputStream o = c.getOutputStream();
                    String meta = j.exists() ? new String(readAll(j), "UTF-8") : "{}";
                    o.write(("--" + b + "\r\nContent-Disposition: form-data; name=\"meta\"\r\n\r\n" + meta + "\r\n").getBytes("UTF-8"));
                    o.write(("--" + b + "\r\nContent-Disposition: form-data; name=\"device\"\r\n\r\n" + device + "\r\n").getBytes("UTF-8"));
                    o.write(("--" + b + "\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"c.wav\"\r\nContent-Type: audio/wav\r\n\r\n").getBytes("UTF-8"));
                    o.write(readAll(w)); o.write(("\r\n--" + b + "--\r\n").getBytes("UTF-8")); o.close();
                    int code = c.getResponseCode(); c.disconnect();
                    if (code == 200 || code == 400) { w.delete(); j.delete(); } else return;
                } catch (Exception e) { return; }
            }
        } }).start();
    }

    private static byte[] readAll(File f) throws java.io.IOException {
        java.io.FileInputStream in = new java.io.FileInputStream(f);
        try { byte[] b = new byte[(int) f.length()]; int n = 0; while (n < b.length) { int r = in.read(b, n, b.length - n); if (r < 0) break; n += r; } return b; } finally { in.close(); }
    }

    @JavascriptInterface
    public int donated() { String[] l = new File(act.getFilesDir(), "donate").list(); return l == null ? 0 : l.length / 2; }

    void shutdown() { on = false; work.shutdownNow(); try { if (session != null) session.close(); } catch (Exception e) { } }

    // The two halves are joined into one file the first time (ONNX Runtime maps it from there), then kept.
    private void load() throws Exception {
        if (session != null) return;
        File model = new File(dir, "nv.onnx"), a = new File(dir, "asrnv/a.bin"), b = new File(dir, "asrnvp/b.bin");
        if (!model.exists() || model.length() != a.length() + b.length()) {
            File tmp = new File(dir, "nv.onnx.part");
            OutputStream out = new FileOutputStream(tmp);
            byte[] buf = new byte[1 << 16]; int n;
            try {
                for (File f : new File[] { a, b }) { InputStream in = new FileInputStream(f); try { while ((n = in.read(buf)) > 0) out.write(buf, 0, n); } finally { in.close(); } }
            } finally { out.close(); }
            if (!tmp.renameTo(model)) throw new Exception("join");
        }
        org.json.JSONArray v = new org.json.JSONArray(read(new File(dir, "asrnv/vocab.json")));
        vocab = new String[v.length()];
        for (int i = 0; i < vocab.length; i++) vocab[i] = v.getString(i);
        env = OrtEnvironment.getEnvironment();
        OrtSession.SessionOptions o = new OrtSession.SessionOptions();
        o.setIntraOpNumThreads(Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors())));
        o.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
        session = env.createSession(model.getAbsolutePath(), o);
        tables();
    }

    private static String read(File f) throws Exception {
        InputStream in = new FileInputStream(f); java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        try { while ((n = in.read(buf)) > 0) bo.write(buf, 0, n); } finally { in.close(); }
        return bo.toString("UTF-8");
    }

    // The microphone, in 100 ms blocks. A piece of speech ends after 0.6 s of quiet (or at 12 s); while it goes on, it is
    // decoded about every second for the words so far, unless the last decode is still running.
    private void listen() {
        int min = AudioRecord.getMinBufferSize(SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioRecord ar;
        try { ar = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, SR)); }
        catch (Exception e) { on = false; tell("", "state:error:mic"); return; }
        if (ar.getState() != AudioRecord.STATE_INITIALIZED) { on = false; tell("", "state:error:mic"); ar.release(); return; }
        final AudioRecord mic = ar;
        rec = new Thread(new Runnable() { public void run() {
            short[] blk = new short[SR / 10];
            float[] seg = new float[SR * 12]; int len = 0, lastPartial = 0;
            double floor = 0.004, quiet = 0, voiced = 0;
            mic.startRecording();
            tell("", "state:listening");
            try {
                while (on) {
                    int n = mic.read(blk, 0, blk.length);
                    if (n <= 0) continue;
                    double e = 0; for (int i = 0; i < n; i++) { double x = blk[i] / 32768.0; e += x * x; }
                    e = Math.sqrt(e / n);
                    floor = e < floor ? e : floor * 0.995 + e * 0.005;   // the room's own level
                    boolean speech = e > Math.max(0.006, floor * 3);
                    double dt = n / (double) SR;
                    if (speech || len > 0) { int k = Math.min(n, seg.length - len); for (int i = 0; i < k; i++) seg[len + i] = blk[i] / 32768f; len += k; }
                    if (speech) { voiced += dt; quiet = 0; } else if (len > 0) quiet += dt;
                    boolean end = len > 0 && (quiet > 0.6 || len >= seg.length);
                    if (end) {
                        if (voiced > 0.3) { final float[] y = java.util.Arrays.copyOf(seg, len); work.execute(new Runnable() { public void run() { emit(y, "final"); } }); }
                        len = 0; lastPartial = 0; quiet = 0; voiced = 0;
                    } else if (len - lastPartial >= SR && voiced > 0.5 && !decoding) {
                        lastPartial = len; decoding = true;
                        final float[] y = java.util.Arrays.copyOf(seg, len);
                        work.execute(new Runnable() { public void run() { emit(y, "partial"); } });
                    }
                }
            } finally { try { mic.stop(); } catch (Exception ex) { } mic.release(); }
        } });
        rec.start();
    }

    private void emit(float[] y, String kind) {
        try {
            if (!on) return;
            String t = decode(y);
            if (kind.equals("final")) lastFinal = y;
            if (on && t.length() > 0) tell(t, kind);
        } catch (Throwable e) {
            if (on) tell("", "state:error:run " + e.getMessage());
        } finally { if (kind.equals("partial")) decoding = false; }
    }

    private String decode(float[] y) throws Exception {
        int T = y.length / HOP + 1;
        float[] x = feats(y, T);
        OnnxTensor f = OnnxTensor.createTensor(env, FloatBuffer.wrap(x), new long[] { 1, NM, T });
        OnnxTensor l = OnnxTensor.createTensor(env, LongBuffer.wrap(new long[] { T }), new long[] { 1 });
        java.util.Iterator<String> names = session.getInputNames().iterator();
        java.util.Map<String, OnnxTensor> in = new java.util.HashMap<String, OnnxTensor>();
        in.put(names.next(), f); in.put(names.next(), l);
        OrtSession.Result r = session.run(in);
        try {
            float[][][] lp = (float[][][]) r.get(0).getValue();
            StringBuilder sb = new StringBuilder(); int prev = -1;
            for (float[] row : lp[0]) {
                int best = 0; for (int j = 1; j < row.length; j++) if (row[j] > row[best]) best = j;
                if (best != prev && best < vocab.length) sb.append(vocab[best]);
                prev = best;
            }
            return sb.toString().replace('▁', ' ').replaceAll("\\s+", " ").trim();
        } finally { r.close(); f.close(); l.close(); }
    }

    private float[] win, mel, fcos, fsin; private int[] rev;
    private void tables() {
        win = new float[NF]; int o = (NF - WIN) / 2;
        for (int i = 0; i < WIN; i++) win[o + i] = (float) (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1)));
        double top = hz2mel(SR / 2.0); double[] pts = new double[NM + 2];
        for (int i = 0; i < NM + 2; i++) pts[i] = mel2hz(top * i / (NM + 1));
        mel = new float[NM * NB];
        for (int m = 0; m < NM; m++) {
            double lo = pts[m], c = pts[m + 1], hi = pts[m + 2], en = 2 / (hi - lo);
            for (int k = 0; k < NB; k++) { double fq = k * (double) SR / NF, w = Math.max(0, Math.min((fq - lo) / (c - lo), (hi - fq) / (hi - c))); mel[m * NB + k] = (float) (w * en); }
        }
        fcos = new float[NF / 2]; fsin = new float[NF / 2];
        for (int i = 0; i < NF / 2; i++) { fcos[i] = (float) Math.cos(-2 * Math.PI * i / NF); fsin[i] = (float) Math.sin(-2 * Math.PI * i / NF); }
        rev = new int[NF];
        for (int i = 0; i < NF; i++) { int r = 0, x = i; for (int b = 0; b < 9; b++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
    }
    private static double hz2mel(double f) { return f < 1000 ? 3 * f / 200 : 15 + Math.log(f / 1000) / (Math.log(6.4) / 27); }
    private static double mel2hz(double m) { return m < 15 ? 200 * m / 3 : 1000 * Math.exp((Math.log(6.4) / 27) * (m - 15)); }

    private void fft(float[] re, float[] im) {
        for (int i = 0; i < NF; i++) { int j = rev[i]; if (j > i) { float t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
        for (int size = 2; size <= NF; size <<= 1) {
            int half = size >> 1, step = NF / size;
            for (int i = 0; i < NF; i += size) for (int j = 0; j < half; j++) {
                float c = fcos[j * step], s = fsin[j * step]; int a = i + j, b = a + half;
                float xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c;
                re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
            }
        }
    }

    private float[] feats(float[] y, int T) {
        int n = y.length, P = NF / 2;
        float[] pe = new float[n + 2 * P];
        pe[P] = y[0]; for (int i = 1; i < n; i++) pe[P + i] = y[i] - 0.97f * y[i - 1];
        float[] out = new float[NM * T], re = new float[NF], im = new float[NF], pw = new float[NB];
        for (int f = 0; f < T; f++) {
            for (int i = 0; i < NF; i++) { re[i] = pe[f * HOP + i] * win[i]; im[i] = 0; }
            fft(re, im);
            for (int k = 0; k < NB; k++) pw[k] = re[k] * re[k] + im[k] * im[k];
            for (int m = 0; m < NM; m++) { double s = 0; int row = m * NB; for (int k = 0; k < NB; k++) s += mel[row + k] * pw[k]; out[m * T + f] = (float) Math.log(s + 5.960464477539063e-8); }
        }
        for (int m = 0; m < NM; m++) {
            double mu = 0, v = 0; for (int f = 0; f < T; f++) mu += out[m * T + f]; mu /= T;
            for (int f = 0; f < T; f++) { double d = out[m * T + f] - mu; v += d * d; }
            double sd = Math.sqrt(v / Math.max(1, T - 1)) + 1e-5;
            for (int f = 0; f < T; f++) out[m * T + f] = (float) ((out[m * T + f] - mu) / sd);
        }
        return out;
    }
}
