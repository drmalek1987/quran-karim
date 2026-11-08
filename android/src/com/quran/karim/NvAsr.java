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
    private static final int PRE = SR * 3 / 10; private static final double QUIET_END = 1.0;
    // 5.11 G7: a partial decodes only the audio after the piece's frozen point; once that is longer than FREEZE s, the part
    // up to the quietest 100 ms block of its last 2 s (a breath, below 0.6 x the median level) is decoded once and its text
    // kept. The FINAL piece is decoded whole as before (same verdicts). tools/asr/eval/stream_cut.py, 52 continuous
    // streams: mean partial decode 5.3 -> 3.7 s of audio (p90 10 -> 6 s), finals unchanged (89.5% words right).
    private static final int BLK = SR / 10; private static final double FREEZE = 6.0;
    private String frozen = "";                                       // the frozen text of the piece being heard (worker thread)
    private final Activity act;
    private final WebView web;
    private final File dir;
    private final ExecutorService work = Executors.newSingleThreadExecutor();
    private volatile boolean on = false, decoding = false;
    // 5.11 phone #16 (reading felt slow; 147 ms per decode of 3.9 s on M2007J3SY): a partial every 0.5 s of new speech
    // instead of 1 s, but never more often than twice the last decode time, so a slow phone is not kept busy.
    // Finals are untouched (same word verdicts).
    private volatile long partMs = 0;
    private OrtEnvironment env;
    private OrtSession session;
    private String[] vocab;
    private Thread rec;
    // The last few whole pieces of speech by number: the page names the piece it matched (window.nvSeq is set just
    // before each final onRecite), so a donated clip is the audio of exactly those words even if the reader went on.
    private final java.util.LinkedHashMap<Integer, float[]> finals = new java.util.LinkedHashMap<Integer, float[]>();
    private int seq = 0;
    // P1b: the log-probs of the last final pieces (grouped by letter form), so the page can check its expected words on
    // them (ctc). ctcSetup gets each token's letters from the page's own norm().
    private final java.util.LinkedHashMap<Integer, Ctc.Grp> grps = new java.util.LinkedHashMap<Integer, Ctc.Grp>();
    private volatile Ctc ctc;
    private float[][] lastLp;

    NvAsr(Activity a, WebView w) { act = a; web = w; dir = new File(new File(a.getFilesDir(), "ed"), "asr"); }

    private void tell(String text, String kind) { tell(text, kind, ""); }
    private void tell(final String text, final String kind, final String before) {
        act.runOnUiThread(new Runnable() { public void run() {
            web.evaluateJavascript(before + "window.onRecite && onRecite(" + org.json.JSONObject.quote(text) + "," + org.json.JSONObject.quote(kind) + ")", null);
        } });
    }

    @JavascriptInterface
    public boolean ready() { return new File(dir, "asrnv/lib/libonnxruntime.so").exists() && new File(dir, "asrnv/vocab.json").exists()
        && (new File(dir, "nv.onnx").exists() || (new File(dir, "asrnv/a.bin").exists() && new File(dir, "asrnvp/b.bin").exists())); }

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

    // After a model update (Settings › Downloads) the next start() loads the new files instead of the open session.
    @JavascriptInterface
    public void reload() {
        work.execute(new Runnable() { public void run() {
            if (on) return;
            try { if (session != null) session.close(); } catch (Exception e) { }
            session = null;
        } });
    }

    void onPermissionResult(int[] r) { if (r.length > 0 && r[0] == PackageManager.PERMISSION_GRANTED) start(); else tell("", "state:noperm"); }

    // Training clips, only when the reader turned «ساعد في تحسين التعرّف» on (see Donations). donate2 keeps piece `seq`
    // with the page's label (JSON) and returns "" or why it was not kept; sendDonations lets DonateJob send them.
    @JavascriptInterface
    public String donate2(String meta, int n) {
        float[] y; synchronized (finals) { y = finals.remove(n); }
        return Donations.save(act.getApplicationContext(), y, meta, n);
    }

    @JavascriptInterface
    public String vocab() { return vocab == null ? "[]" : new org.json.JSONArray(java.util.Arrays.asList(vocab)).toString(); }

    @JavascriptInterface
    public boolean ctcSetup(String formsJson) {
        try {
            org.json.JSONArray a = new org.json.JSONArray(formsJson); String[] f = new String[a.length()];
            for (int i = 0; i < f.length; i++) f[i] = a.getString(i);
            ctc = new Ctc(f); return true;
        } catch (Exception e) { return false; }
    }

    /** Expected words (their letters, JSON array) on final piece seq -> JSON [1 matched | 0 skipped], or "" if unknown. */
    @JavascriptInterface
    public String ctc(int seq, String wordsJson) {
        try {
            Ctc c = ctc; Ctc.Grp g; synchronized (grps) { g = grps.get(seq); }
            if (c == null || g == null) return "";
            org.json.JSONArray a = new org.json.JSONArray(wordsJson); String[] w = new String[a.length()];
            for (int i = 0; i < w.length; i++) w[i] = a.getString(i);
            boolean[] m = c.forced(g, w); StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < m.length; i++) sb.append(i > 0 ? "," : "").append(m[i] ? 1 : 0);
            return sb.append("]").toString();
        } catch (Exception e) { return ""; }
    }

    /** S6: like ctc(), but a skipped word gives its margin (>= 0, log-prob units) instead of 0; matched = -1.
     *  The page shows a skipped word with a small margin as «مش متأكد» instead of red. */
    @JavascriptInterface
    public String ctcM(int seq, String wordsJson) {
        try {
            Ctc c = ctc; Ctc.Grp g; synchronized (grps) { g = grps.get(seq); }
            if (c == null || g == null) return "";
            org.json.JSONArray a = new org.json.JSONArray(wordsJson); String[] w = new String[a.length()];
            for (int i = 0; i < w.length; i++) w[i] = a.getString(i);
            boolean[] m = c.forced(g, w); float best = Float.NaN; StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < m.length; i++) {
                sb.append(i > 0 ? "," : "");
                if (m[i]) { sb.append(-1); continue; }
                if (Float.isNaN(best)) best = c.score(g, w, -1);
                sb.append(Math.round(Math.max(0f, best - c.score(g, w, i)) * 100) / 100f);
            }
            return sb.append("]").toString();
        } catch (Exception e) { return ""; }
    }

    @JavascriptInterface
    public void sendDonations(boolean mobile) { DonateJob.schedule(act.getApplicationContext(), mobile); }

    @JavascriptInterface
    public String donateStats() { return Donations.stats(act.getApplicationContext()); }

    // Deletes this phone's clips here and on the relay; the answer comes back as window.onDonateForget(ok).
    @JavascriptInterface
    public void forget(final String oldIds) {
        new Thread(new Runnable() { public void run() {
            final boolean ok = Donations.forget(act.getApplicationContext(), oldIds == null ? "" : oldIds);
            act.runOnUiThread(new Runnable() { public void run() { web.evaluateJavascript("window.onDonateForget && onDonateForget(" + ok + ")", null); } });
        } }).start();
    }

    void shutdown() { on = false; work.shutdownNow(); try { if (session != null) session.close(); } catch (Exception e) { } }

    // The two halves are joined into one file the first time (ONNX Runtime maps it from there), then kept.
    private void load() throws Exception {
        if (session != null) return;
        File model = new File(dir, "nv.onnx"), a = new File(dir, "asrnv/a.bin"), b = new File(dir, "asrnvp/b.bin");
        // 5.8: the parts are deleted after a good join (the model was stored twice, ~132 MB). A new download brings the
        // parts back and they are joined again; an interrupted join keeps the parts, so it re-joins next time.
        boolean parts = a.exists() && b.exists();
        if (!parts && !model.exists()) throw new Exception("model missing");
        // Parts on disk always mean a new download (or a cut join): join again even when the size matches (model v2 = same size).
        if (parts) {
            // 5.16d (pack v3): the old joined model goes first, so an update never holds old + parts + new (~360 MB)
            if (session == null) model.delete();
            File tmp = new File(dir, "nv.onnx.part");
            OutputStream out = new FileOutputStream(tmp);
            byte[] buf = new byte[1 << 16]; int n;
            try {
                for (File f : new File[] { a, b }) { InputStream in = new FileInputStream(f); try { while ((n = in.read(buf)) > 0) out.write(buf, 0, n); } finally { in.close(); } }
            } finally { out.close(); }
            if (!tmp.renameTo(model)) throw new Exception("join");
        }
        if (parts && model.length() == a.length() + b.length()) { a.delete(); b.delete(); }
        org.json.JSONArray v = new org.json.JSONArray(read(new File(dir, "asrnv/vocab.json")));
        vocab = new String[v.length()];
        for (int i = 0; i < vocab.length; i++) vocab[i] = v.getString(i);
        // ONNX Runtime's native libraries come with the model download (asr/asrnv/lib), keeping the APK under 50 MB.
        System.setProperty("onnxruntime.native.path", new File(dir, "asrnv/lib").getAbsolutePath());
        // Loaded first by full path: the JNI library needs libonnxruntime.so, which the app's linker namespace finds
        // only once it is already loaded (it does not search asrnv/lib).
        System.load(new File(dir, "asrnv/lib/libonnxruntime.so").getAbsolutePath());
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

    // The microphone, in 100 ms blocks. A piece of speech starts with the 0.3 s before the voice was heard (so the first
    // letter of a word after a pause is not cut) and ends after 1.0 s of quiet (or at 12 s), so a reciter's pauses and
    // long madd do not split a word; while it goes on, it is decoded about every half second for the words so far, unless the
    // last decode is still running. (Both tuned with tools/asr/eval/bench.py: word verdicts 86.8% -> 94.3% with rAlign.)
    private void listen() {
        int min = AudioRecord.getMinBufferSize(SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioRecord ar;
        try { ar = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, SR)); }
        catch (Exception e) { on = false; tell("", "state:error:mic"); return; }
        if (ar.getState() != AudioRecord.STATE_INITIALIZED) { on = false; tell("", "state:error:mic"); ar.release(); return; }
        final AudioRecord mic = ar;
        rec = new Thread(new Runnable() { public void run() {
            short[] blk = new short[SR / 10];
            float[] seg = new float[SR * 12]; int len = 0, lastPartial = 0, frz = 0;
            float[] be = new float[121];                                     // each 100 ms block's level in the piece
            float[] pre = new float[PRE]; int preN = 0;                       // the last 0.3 s before speech
            double floor = 0.004, quiet = 0, voiced = 0;
            mic.startRecording();
            frozen = "";
            tell("", "state:listening");
            try {
                while (on) {
                    int n = mic.read(blk, 0, blk.length);
                    if (n <= 0) continue;
                    double e = 0; for (int i = 0; i < n; i++) { double x = blk[i] / 32768.0; e += x * x; }
                    e = Math.sqrt(e / n);
                    floor = e < floor ? e : floor * 0.995 + e * 0.005;   // the room's own level
                    boolean speech = e > Math.max(VMIN, floor * 3);
                    double dt = n / (double) SR;
                    if (speech && len == 0) { System.arraycopy(pre, PRE - preN, seg, 0, preN); len = preN; for (int b = 0; b <= preN / BLK && b < be.length; b++) be[b] = 1f; }
                    if (speech || len > 0) { int k = Math.min(n, seg.length - len); for (int i = 0; i < k; i++) seg[len + i] = blk[i] / 32768f;
                        be[Math.min(be.length - 1, len / BLK)] = (float) e; if (k > 0) be[Math.min(be.length - 1, (len + k - 1) / BLK)] = (float) e; len += k; }
                    { int k = Math.min(n, PRE); System.arraycopy(pre, k, pre, 0, PRE - k);     // always keep the newest PRE samples
                      for (int i = 0; i < k; i++) pre[PRE - k + i] = blk[n - k + i] / 32768f; preN = Math.min(PRE, preN + k); }
                    if (speech) { voiced += dt; quiet = 0; } else if (len > 0) quiet += dt;
                    boolean end = len > 0 && (quiet > QUIET_END || len >= seg.length);
                    if (end) {
                        if (voiced > 0.3) { final float[] y = java.util.Arrays.copyOf(seg, len); work.execute(new Runnable() { public void run() { emit(y, "final"); } }); }
                        len = 0; lastPartial = 0; quiet = 0; voiced = 0; frz = 0;
                    } else if (len - lastPartial >= Math.max(SR / 2, partMs * 2 * SR / 1000) && voiced > 0.5 && !decoding) {
                        lastPartial = len; decoding = true;
                        final int cut = freezeAt(be, frz, len);
                        final float[] y = java.util.Arrays.copyOfRange(seg, frz, cut > 0 ? cut : len);
                        if (cut > 0) frz = cut;
                        work.execute(new Runnable() { public void run() { emit(y, cut > 0 ? "freeze" : "partial"); } });
                    }
                }
            } finally { try { mic.stop(); } catch (Exception ex) { } mic.release(); }
        } });
        rec.start();
    }

    // Where to freeze the piece for partials (a sample index), or -1: see FREEZE.
    private static int freezeAt(float[] be, int frz, int len) {
        if (len - frz <= FREEZE * SR) return -1;
        int nb = Math.min(be.length, len / BLK), f0 = frz / BLK, w0 = Math.max(f0 + 1, nb - 20), w1 = nb - 2;
        if (w1 <= w0 || nb - f0 < 3) return -1;
        int best = w0; for (int i = w0; i < w1; i++) if (be[i] < be[best]) best = i;
        float[] m = java.util.Arrays.copyOfRange(be, f0, nb); java.util.Arrays.sort(m);
        return be[best] < 0.6f * m[m.length / 2] ? (best + 1) * BLK : -1;
    }

    private void emit(float[] y, String kind) {
        try {
            if (!on) return;
            long t0 = android.os.SystemClock.elapsedRealtime();
            String t = decode(louder(y));
            // how long the decode took and how much audio it read: the page keeps the average (Stats, 5.11 G7)
            long ms = android.os.SystemClock.elapsedRealtime() - t0; if (!kind.equals("final")) partMs = ms;
            String before = "window.nvMs=" + ms + ";window.nvLen=" + (y.length * 1000L / SR) + ";";
            if (kind.equals("freeze")) { frozen = (frozen + " " + t).trim(); t = frozen; kind = "partial"; }
            else if (kind.equals("partial")) t = (frozen + " " + t).trim();
            else frozen = "";
            if (kind.equals("final")) {
                int n;
                synchronized (finals) {
                    n = ++seq; finals.put(n, y);
                    java.util.Iterator<Integer> it = finals.keySet().iterator();
                    while (finals.size() > 4) { it.next(); it.remove(); }
                }
                Ctc c = ctc;
                if (c != null && lastLp != null) {
                    Ctc.Grp g = c.group(lastLp);
                    synchronized (grps) { grps.put(n, g); java.util.Iterator<Integer> it = grps.keySet().iterator(); while (grps.size() > 4) { it.next(); it.remove(); } }
                }
                before += "window.nvSeq=" + n + ";";
            }
            if (on && t.length() > 0) tell(t, kind, before);
        } catch (Throwable e) {
            if (on) tell("", "state:error:run " + e.getMessage());
        } finally { if (!kind.equals("final")) decoding = false; }
    }

    // Quiet speech (a low voice, the phone held far) is raised to about -30 dBFS before the model, at most 30x; loud
    // speech is left as it is. With VMIN 0.0015 (was 0.006; the room-level rule floor*3 still holds in noise), bench.py
    // at -50 dBFS: word verdicts 5.8% -> 73.9%; clean 89.9 -> 90.1, white noise 74.3 -> 74.6.
    static final double VMIN = 0.0015;
    private static float[] louder(float[] y) {
        double e = 0; for (float v : y) e += v * v;
        double r = Math.sqrt(e / Math.max(1, y.length)), g = r > 0 ? Math.pow(10, -30 / 20.0) / r : 1;
        if (g <= 1) return y;
        g = Math.min(g, 30); float[] o = new float[y.length];
        for (int i = 0; i < y.length; i++) o[i] = (float) Math.max(-1, Math.min(1, y[i] * g));
        return o;
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
            lastLp = lp[0];
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
