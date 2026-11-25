// Sprint 5b A parity: re-decides every logged piece of tools/asr/speedbench/auto_parity.py with NvAsr.isSlow / NvAsr.canJoin.
// javac -cp <android.jar>;<onnxruntime.jar>;<classes of NvAsr> -d out tools/asr/speedbench/AutoParity.java ; java -cp out;<same> com.quran.karim.AutoParity parity.tsv
package com.quran.karim;
import java.io.*; import java.nio.charset.StandardCharsets; import java.nio.file.*;
public class AutoParity {
    public static void main(String[] a) throws Exception {
        int slowAgree = 0, slowDis = 0, joinAgree = 0, joinDis = 0, slowTrue = 0, joinTrue = 0;
        for (String ln : Files.readAllLines(Paths.get(a[0]), StandardCharsets.UTF_8)) {
            String[] f = ln.split("\t", 4);
            if (f.length < 3) continue;
            if (f[0].equals("S")) {
                boolean py = f[2].equals("1"), jv = NvAsr.isSlow(f.length > 3 ? f[3] : "", Long.parseLong(f[1]) / 16000.0);
                if (py == jv) slowAgree++; else { slowDis++; System.out.println("DISAGREE slow: " + ln); }
                if (py) slowTrue++;
            } else if (f[0].equals("J")) {
                boolean py = f[3].equals("1"), jv = NvAsr.canJoin(Long.parseLong(f[1]), Long.parseLong(f[2]));
                if (py == jv) joinAgree++; else { joinDis++; System.out.println("DISAGREE join: " + ln); }
                if (py) joinTrue++;
            }
        }
        System.out.println("isSlow  agree " + slowAgree + " disagree " + slowDis + " (py slow=" + slowTrue + ")");
        System.out.println("canJoin agree " + joinAgree + " disagree " + joinDis + " (py join=" + joinTrue + ")");
    }
}
