# Checks android FlacEncoder is lossless: compiles it with FlacRoundTrip.java (plain JDK), encodes test signals,
# decodes each with ffmpeg and compares every sample. Run: py -3.11 -I tools/qa/flac/flac_roundtrip.py
import os, subprocess, sys, tempfile, glob
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(os.path.dirname(here)))
jdk = os.path.join(os.environ.get("JAVA_HOME", ""), "bin")
tmp = tempfile.mkdtemp()
subprocess.run([os.path.join(jdk, "javac"), "-d", tmp, os.path.join(root, "android/src/com/quran/karim/FlacEncoder.java"), os.path.join(here, "FlacRoundTrip.java")], check=True)
subprocess.run([os.path.join(jdk, "java"), "-cp", tmp, "com.quran.karim.FlacRoundTrip", tmp], check=True)
bad = 0
for f in sorted(glob.glob(os.path.join(tmp, "t*.flac"))):
    want = open(f[:-5] + ".s16be", "rb").read()
    got = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-f", "s16be", "-"], capture_output=True)
    ok = got.returncode == 0 and got.stdout == want and not got.stderr
    bad += not ok
    print("%s %s wav %d B -> flac %d B %s" % ("OK  " if ok else "FAIL", os.path.basename(f), len(want), os.path.getsize(f), got.stderr.decode()[:200]))
sys.exit(1 if bad else 0)
