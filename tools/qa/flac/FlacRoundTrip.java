package com.quran.karim;
// Encodes test signals with the app's FlacEncoder; flac_roundtrip.py decodes them with ffmpeg and compares samples.
public class FlacRoundTrip {
    public static void main(String[] a) throws Exception {
        java.util.Random r = new java.util.Random(7);
        int[] lens = { 8000, 4096, 4097, 16000 * 12 + 123, 16000 * 20 };
        for (int t = 0; t < lens.length; t++) {
            short[] x = new short[lens[t]];
            for (int i = 0; i < x.length; i++) {
                double v = t == 0 ? r.nextGaussian() * 12000 : t == 1 ? 0 : 9000 * Math.sin(i * 0.03) * Math.sin(i * 0.0007) + r.nextGaussian() * 300;
                if (t == 4 && i % 5000 < 50) v = (i % 2 == 0) ? 32767 : -32768;
                x[i] = (short) Math.max(-32768, Math.min(32767, Math.round(v)));
            }
            java.io.DataOutputStream raw = new java.io.DataOutputStream(new java.io.FileOutputStream(a[0] + "/t" + t + ".s16be"));
            for (short s : x) raw.writeShort(s); raw.close();
            java.io.FileOutputStream f = new java.io.FileOutputStream(a[0] + "/t" + t + ".flac"); f.write(FlacEncoder.encode(x)); f.close();
        }
    }
}
