package com.quran.karim;

import java.io.ByteArrayOutputStream;

/**
 * A small lossless FLAC writer for donated clips: 16 kHz, 16-bit, mono, fixed 4096-sample blocks, each block coded with
 * the best of the fixed predictors (order 0-4) and one Rice partition, or stored verbatim when that is smaller. Pure Java,
 * so every phone writes the same bytes (MediaCodec's encoder differs between devices). About half the size of WAV for speech.
 */
final class FlacEncoder {
    private static final int BLOCK = 4096, SR = 16000;

    static byte[] encode(short[] x) {
        Bits b = new Bits();
        b.bytes(new byte[] { 'f', 'L', 'a', 'C' });
        b.put(0x80, 8); b.put(34, 24);                       // last metadata block: STREAMINFO, 34 bytes
        b.put(BLOCK, 16); b.put(BLOCK, 16); b.put(0, 24); b.put(0, 24);
        b.put(SR, 20); b.put(0, 3); b.put(15, 5); b.putLong(x.length, 36);
        for (int i = 0; i < 16; i++) b.put(0, 8);            // MD5 left as zero ("not computed"), allowed by the format
        for (int start = 0, frame = 0; start < x.length; start += BLOCK, frame++) frame(b, x, start, Math.min(BLOCK, x.length - start), frame);
        return b.done();
    }

    private static void frame(Bits b, short[] x, int s, int n, int num) {
        int h0 = b.size();
        b.put(0xFFF8, 16);
        b.put(n == BLOCK ? 12 : 7, 4); b.put(5, 4);          // block size code, 16 kHz
        b.put(0, 4); b.put(4, 3); b.put(0, 1);               // mono, 16 bits per sample
        utf8(b, num);
        if (n != BLOCK) b.put(n - 1, 16);
        b.put(crc8(b.buf(), h0, b.size()), 8);
        subframe(b, x, s, n);
        b.align();
        b.put(crc16(b.buf(), h0, b.size()), 16);
    }

    private static void utf8(Bits b, int v) {
        if (v < 0x80) { b.put(v, 8); return; }
        int extra = v < 0x800 ? 1 : v < 0x10000 ? 2 : v < 0x200000 ? 3 : v < 0x4000000 ? 4 : 5;
        b.put((0xFF00 >> extra) & 0xFF | (v >>> (6 * extra)), 8);
        for (int i = extra - 1; i >= 0; i--) b.put(0x80 | ((v >>> (6 * i)) & 0x3F), 8);
    }

    private static void subframe(Bits b, short[] x, int s, int n) {
        int best = -1; long bestBits = 16L * n; int bestK = 0;
        int[] res = new int[n];
        for (int order = 0; order <= 4 && order < n; order++) {
            residual(x, s, n, order, res);
            long sum = 0; for (int i = order; i < n; i++) sum += zig(res[i]);
            int k = riceParam(sum, n - order);
            long bits = 16L * order + 6 + riceBits(res, order, n, k);
            if (bits < bestBits) { bestBits = bits; best = order; bestK = k; }
        }
        if (best < 0) {                                      // verbatim
            b.put(0, 1); b.put(1, 6); b.put(0, 1);
            for (int i = 0; i < n; i++) b.put(x[s + i] & 0xFFFF, 16);
            return;
        }
        residual(x, s, n, best, res);
        b.put(0, 1); b.put(8 | best, 6); b.put(0, 1);
        for (int i = 0; i < best; i++) b.put(x[s + i] & 0xFFFF, 16);
        b.put(0, 2); b.put(0, 4); b.put(bestK, 4);           // Rice, partition order 0, parameter
        for (int i = best; i < n; i++) { long u = zig(res[i]); long q = u >>> bestK; b.zeros(q); b.put(1, 1); if (bestK > 0) b.put((int) (u & ((1L << bestK) - 1)), bestK); }
    }

    private static void residual(short[] x, int s, int n, int order, int[] r) {
        for (int i = order; i < n; i++) {
            int a = x[s + i];
            switch (order) {
                case 0: r[i] = a; break;
                case 1: r[i] = a - x[s + i - 1]; break;
                case 2: r[i] = a - 2 * x[s + i - 1] + x[s + i - 2]; break;
                case 3: r[i] = a - 3 * x[s + i - 1] + 3 * x[s + i - 2] - x[s + i - 3]; break;
                default: r[i] = a - 4 * x[s + i - 1] + 6 * x[s + i - 2] - 4 * x[s + i - 3] + x[s + i - 4];
            }
        }
    }
    private static long zig(int v) { return v >= 0 ? 2L * v : -2L * v - 1; }
    private static int riceParam(long sum, int count) {
        if (count <= 0) return 0;
        long mean = sum / count; int k = 0;
        while (k < 14 && (1L << (k + 1)) <= mean) k++;
        return k;
    }
    private static long riceBits(int[] r, int from, int n, int k) {
        long bits = 0; for (int i = from; i < n; i++) bits += 1 + k + (zig(r[i]) >>> k); return bits;
    }

    private static int crc8(byte[] d, int from, int to) {
        int c = 0;
        for (int i = from; i < to; i++) { c ^= d[i] & 0xFF; for (int j = 0; j < 8; j++) c = (c & 0x80) != 0 ? ((c << 1) ^ 0x07) & 0xFF : (c << 1) & 0xFF; }
        return c;
    }
    private static int crc16(byte[] d, int from, int to) {
        int c = 0;
        for (int i = from; i < to; i++) { c ^= (d[i] & 0xFF) << 8; for (int j = 0; j < 8; j++) c = (c & 0x8000) != 0 ? ((c << 1) ^ 0x8005) & 0xFFFF : (c << 1) & 0xFFFF; }
        return c;
    }

    /** MSB-first bit writer; frame CRCs read back the bytes written so far, so frames always start on a byte. */
    private static final class Bits {
        private byte[] a = new byte[1 << 16]; private int len = 0; private long acc = 0; private int nb = 0;
        void put(int v, int bits) { putLong(v & 0xFFFFFFFFL, bits); }
        void putLong(long v, int bits) {
            for (int i = bits - 1; i >= 0; i--) { acc = (acc << 1) | ((v >>> i) & 1); if (++nb == 8) { add((int) acc); acc = 0; nb = 0; } }
        }
        void zeros(long q) { while (q > 0 && nb != 0) { put(0, 1); q--; } while (q >= 8) { add(0); q -= 8; } while (q-- > 0) put(0, 1); }
        void bytes(byte[] d) { for (byte x : d) put(x & 0xFF, 8); }
        void align() { while (nb != 0) put(0, 1); }
        int size() { return len; }
        byte[] buf() { return a; }
        private void add(int v) { if (len == a.length) a = java.util.Arrays.copyOf(a, a.length * 2); a[len++] = (byte) v; }
        byte[] done() { align(); return java.util.Arrays.copyOf(a, len); }
    }
}
