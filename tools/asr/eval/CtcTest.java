// Runs android/src/com/quran/karim/Ctc.java on the cases ctc_java_parity.py wrote and compares with Python's flags.
// javac -d build android/src/com/quran/karim/Ctc.java tools/asr/eval/CtcTest.java && java -cp build CtcTest cases.txt
import java.io.*; import java.util.*;
public class CtcTest {
    public static void main(String[] a) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(new FileInputStream(a[0]), "UTF-8"));
        int V = Integer.parseInt(in.readLine().trim()); String[] forms = new String[V];
        for (int i = 0; i < V; i++) forms[i] = in.readLine();
        com.quran.karim.Ctc c = new com.quran.karim.Ctc(forms);
        int same = 0, diff = 0, words = 0, wdiff = 0; long ms = 0; String line;
        while ((line = in.readLine()) != null && line.length() > 0) {
            String[] tv = line.trim().split(" "); int T = Integer.parseInt(tv[0]), W = Integer.parseInt(tv[1]);
            float[][] lp = new float[T][W];
            for (int t = 0; t < T; t++) { String[] x = in.readLine().split(" "); for (int j = 0; j < W; j++) lp[t][j] = Float.parseFloat(x[j]); }
            String[] us = in.readLine().split(java.util.regex.Pattern.quote("|"), -1); String want = in.readLine();
            long t0 = System.nanoTime(); boolean[] got = c.forced(c.group(lp), us); ms += (System.nanoTime() - t0) / 1000000;
            StringBuilder sb = new StringBuilder(); for (boolean b : got) sb.append(b ? '1' : '0');
            for (int i = 0; i < want.length(); i++) { words++; if (sb.charAt(i) != want.charAt(i)) wdiff++; }
            if (sb.toString().equals(want)) same++; else { diff++; System.out.println("diff T=" + T + " " + sb + " vs " + want); }
        }
        System.out.println("cases same " + same + " diff " + diff + " | words " + words + " differ " + wdiff + " | " + ms + " ms total");
    }
}
