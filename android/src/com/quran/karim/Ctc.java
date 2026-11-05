package com.quran.karim;

import java.util.ArrayList;
import java.util.HashMap;

/**
 * CTC forced alignment of expected words on the NVIDIA model's log-probs (port of tools/asr/eval/ctc.py: Lex.group,
 * Target, forced_words). The model's BPE tokens are mapped to their letters after the app's norm() (the web page sends
 * those "forms", so the normalisation is the app's own); tokens with no letters left count like blank. A word is
 * "matched" when the best path reads it; between words (and before/after) frames may be garbage at (best token log-prob
 * - G); a word may be skipped at cost D (not said, or said wrong). Pure Java, so tools/asr/eval can test it with a JDK.
 * Bench (p1b_port_eval.py, rLocal places the piece, a word it judged wrong turns right when matched): 94.7% -> 96.9%.
 */
public final class Ctc {
    static final float NEG = -1e30f;
    static final float G = 3f, D = 4f;
    private final int V, F, maxlen;
    private final int[] fid;                          // token -> form id (0 = no letters)
    private final HashMap<String, Integer> forms = new HashMap<String, Integer>();

    /** forms[i] = letters of vocab token i (index V = blank is implicit). */
    public Ctc(String[] tokForms) {
        V = tokForms.length; fid = new int[V]; forms.put("", 0); int ml = 0;
        for (int i = 0; i < V; i++) {
            String f = tokForms[i] == null ? "" : tokForms[i];
            Integer id = forms.get(f);
            if (id == null) { id = forms.size(); forms.put(f, id); }
            fid[i] = id; ml = Math.max(ml, f.length());
        }
        F = forms.size(); maxlen = ml;
    }

    /** Log-probs of one piece grouped by letter form. */
    public static final class Grp { float[][] g; float[] stay, mx; }

    /** lp[T][V+1] (log-probs, blank last) -> per frame: log prob of each form (column F = NEG), of staying, best token. */
    public Grp group(float[][] lp) {
        int T = lp.length; Grp r = new Grp(); r.g = new float[T][F + 1]; r.stay = new float[T]; r.mx = new float[T];
        double[] S = new double[F];
        for (int t = 0; t < T; t++) {
            float[] row = lp[t]; java.util.Arrays.fill(S, 0); float mx = NEG;
            for (int i = 0; i < V; i++) { S[fid[i]] += (float) Math.exp(row[i]); if (row[i] > mx) mx = row[i]; }
            if (row.length > V && row[V] > mx) mx = row[V];
            double blank = row.length > V ? (float) Math.exp(row[V]) : 0;
            r.stay[t] = (float) Math.log(blank + S[0] + 1e-30);
            r.g[t][0] = NEG;
            for (int f = 1; f < F; f++) r.g[t][f] = (float) Math.log(S[f] + 1e-30);
            r.g[t][F] = NEG; r.mx[t] = mx;
        }
        return r;
    }

    private static float lae(float a, float b) {
        float m = Math.max(a, b); if (m <= NEG) return m;
        return (float) (m + Math.log(Math.exp(a - m) + Math.exp(b - m)));
    }

    /** The expected words (letter strings) aligned over all frames: true = matched, false = skipped. */
    public boolean[] forced(Grp gr, String[] words) {
        int n = words.length; StringBuilder sb = new StringBuilder(); int[] bnd = new int[n + 1];
        for (int i = 0; i < n; i++) { sb.append(words[i]); bnd[i + 1] = sb.length(); }
        String s = sb.toString(); int L = s.length(), T = gr.g.length;
        boolean[] skipped = new boolean[n], out = new boolean[n];
        if (n == 0) return out;
        // Fl[l][p] = form of chars [p-l, p), F (the NEG column) if none
        int[][] Fl = new int[maxlen + 1][L + 1]; ArrayList<Integer> ls = new ArrayList<Integer>();
        for (int l = 1; l <= maxlen; l++) {
            boolean any = false;
            for (int p = 0; p <= L; p++) {
                Integer f = p >= l ? forms.get(s.substring(p - l, p)) : null;
                if (f != null && f != 0) { Fl[l][p] = f; any = true; } else Fl[l][p] = F;
            }
            if (any) ls.add(l);
        }
        boolean[] isb = new boolean[L + 1]; for (int b : bnd) isb[b] = true;
        float[] A = new float[L + 1]; java.util.Arrays.fill(A, NEG); A[0] = 0;
        int[][] EPS = new int[T + 1][]; EPS[0] = eps(A, bnd, L);
        int[][] BP = new int[T][L + 1];
        float[] nA = new float[L + 1], R = new float[L + 1];
        for (int t = 0; t < T; t++) {
            float[] Gt = gr.g[t]; int[] bp = BP[t];
            for (int p = 0; p <= L; p++) { nA[p] = NEG; R[p] = NEG; bp[p] = p; }
            for (int l : ls) {
                int[] fl = Fl[l];
                for (int p = 0; p <= L; p++) {
                    float e = Gt[fl[p]]; if (e > R[p]) R[p] = e;
                    if (p >= l) { float c = A[p - l] + e; if (c > nA[p]) { nA[p] = c; bp[p] = p - l; } }
                }
            }
            float gm = gr.mx[t] - G;
            for (int p = 0; p <= L; p++) {
                float sc = A[p] + lae(gr.stay[t], R[p]);
                if (sc >= nA[p]) { nA[p] = sc; bp[p] = p; }
                if (isb[p]) { float gb = A[p] + gm; if (gb > nA[p]) { nA[p] = gb; bp[p] = p; } }
            }
            EPS[t + 1] = eps(nA, bnd, L);
            float[] tmp = A; A = nA; nA = tmp;
        }
        int p = L;
        for (int t = T - 1; t >= 0; t--) { p = unskip(EPS[t + 1], p, bnd, skipped); p = BP[t][p]; }
        unskip(EPS[0], p, bnd, skipped);
        for (int i = 0; i < n; i++) out[i] = !skipped[i];
        return out;
    }

    private static int[] eps(float[] A, int[] bnd, int L) {
        int[] src = new int[L + 1]; java.util.Arrays.fill(src, -1);
        for (int i = 0; i + 1 < bnd.length; i++) { int a = bnd[i], b = bnd[i + 1]; if (A[a] - D > A[b]) { A[b] = A[a] - D; src[b] = a; } }
        return src;
    }

    private static int unskip(int[] ep, int p, int[] bnd, boolean[] skipped) {
        while (ep[p] >= 0) {
            int a = ep[p];
            for (int i = 0; i + 1 < bnd.length; i++) if (bnd[i] >= a && bnd[i + 1] <= p) skipped[i] = true;
            p = a;
        }
        return p;
    }
}
