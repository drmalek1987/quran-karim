"""Windows port of build.sh: builds quran-karim-vX.Y.apk with the Android SDK build-tools (aapt2, d8, zipalign, apksigner)
and JDK 17, no Gradle, no WSL. Needs the `brotli` Python package (see CLAUDE.md > Build on Windows).
Usage: [PLAY=1] py -3.11 build-win.py [path\to\android.jar]
Env: ANDROID_HOME (default %LOCALAPPDATA%\Android\Sdk), JAVA_HOME, BUILD_TOOLS (default 36.0.0), OUT, KEYSTORE."""
import glob, json, os, re, shutil, subprocess, sys, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SDK = os.environ.get("ANDROID_HOME") or os.path.join(os.environ["LOCALAPPDATA"], "Android", "Sdk")
BT = os.path.join(SDK, "build-tools", os.environ.get("BUILD_TOOLS", "36.0.0"))
JDK = os.environ.get("JAVA_HOME") or r"C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot"
OUT = os.environ.get("OUT") or os.path.join(HERE, "build")
KEYSTORE = os.environ.get("KEYSTORE") or os.path.join(HERE, "debug.keystore")
PLAY = os.environ.get("PLAY") == "1"
# Application id: the Play build is published as com.lawh.quran («لوح»); the GitHub/sideload build keeps com.quran.karim
# (the Java code stays in package com.quran.karim either way: aapt2 --rename-manifest-package). APP_ID= overrides.
APP_ID = os.environ.get("APP_ID") or ("com.lawh.quran" if PLAY else "com.quran.karim")

def android_jar():
    if len(sys.argv) > 1: return sys.argv[1]
    if os.environ.get("ANDROID_JAR"): return os.environ["ANDROID_JAR"]
    # android-34 is what build.sh uses; a newer platform jar works too.
    def num(p):   # android-9 must not sort above android-36
        t = p.split("-")[-1].split(".")[0]
        return int(t) if t.isdigit() else -1
    for p in ["android-34"] + sorted(os.listdir(os.path.join(SDK, "platforms")), key=num, reverse=True):
        j = os.path.join(SDK, "platforms", p, "android.jar")
        if os.path.exists(j): return j
    sys.exit("no android.jar found under " + SDK)

ENV = dict(os.environ, JAVA_HOME=JDK, PATH=os.path.join(JDK, "bin") + os.pathsep + os.environ["PATH"])
def run(*cmd, **kw):
    subprocess.run([str(c) for c in cmd], check=True, env=ENV, **kw)
def jdk(tool): return os.path.join(JDK, "bin", tool + ".exe")
def bt(tool): return os.path.join(BT, tool + (".bat" if tool in ("d8", "apksigner") else ".exe"))

def zip_dir(zip_path, root, subdirs, stored=True):
    """zip -0 -r: add root/<subdir>/** with paths relative to root."""
    with zipfile.ZipFile(zip_path, "a", zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED) as z:
        for sub in subdirs:
            for d, _, ns in os.walk(os.path.join(root, sub)):
                for n in ns:
                    p = os.path.join(d, n)
                    z.write(p, os.path.relpath(p, root).replace(os.sep, "/"))

def main():
    ajar = android_jar()
    print("android.jar:", ajar)
    shutil.rmtree(OUT, ignore_errors=True)
    for d in ("assets", "gen", "classes"): os.makedirs(os.path.join(OUT, d))

    run(sys.executable, "-I", os.path.join(HERE, "tools", "make_data.py"))
    W = os.path.join(OUT, "assets", "web")
    shutil.copytree(os.path.join(HERE, "web"), W)
    for f in ("icons/icon.svg", "sw.js", "manifest.webmanifest"):
        p = os.path.join(W, f)
        if os.path.exists(p): os.remove(p)
    # PLAY=1: the Google Play build, without content that has no publishing licence (store/licences-status.md):
    # the scanned Haramain edition + its tajweed layer, Darwish i'rab/balagha, Ibn Ashur's tanwir, the adhan recordings.
    # PLAY_KEEP=harmain,darwish,tanwir,adhan keeps the ones whose written permission has arrived.
    keep = set(filter(None, os.environ.get("PLAY_KEEP", "").split(",")))
    drop_books = [b for b in ("darwish", "tanwir") if b not in keep]
    no_adhan = PLAY and "adhan" not in keep
    res_dir = os.path.join(HERE, "android", "res")
    if PLAY:
        if "harmain" not in keep:
            for d in ("pages", "tjpages", "editions/harmain-w"): shutil.rmtree(os.path.join(W, d), ignore_errors=True)
        for b in drop_books: shutil.rmtree(os.path.join(W, "books", b), ignore_errors=True)
        # books/index.js stays complete; web/app.js hides the books named in NO_BOOKS
        if no_adhan:
            res_dir = os.path.join(OUT, "res-play"); shutil.copytree(os.path.join(HERE, "android", "res"), res_dir)
            for f in glob.glob(os.path.join(res_dir, "raw", "adhan_*")): os.remove(f)
        with open(os.path.join(W, "flags.js"), "w", newline="\n") as f:
            f.write("window.NO_HARMAIN = %s;\nwindow.NO_BOOKS = %s;\nwindow.NO_ADHAN_AUDIO = %s;\n" % (
                "true" if "harmain" not in keep else "false", json.dumps(drop_books), "true" if no_adhan else "false"))

    # Page images are not in the APK: one zip per edition for the release the app downloads from (EdStore.java).
    ZD = os.path.join(OUT, "editions-zips"); os.makedirs(ZD)
    for ed in ("kfgqpc", "kfold", "shamarly", "harmain"):
        subs = ["pages", "tjpages"] if ed == "harmain" else ["editions/" + ed, "editions/" + ed + "-tj"]
        have = [s for s in subs if os.path.isdir(os.path.join(W, s))]
        if not have:
            print("WARNING: no page images for " + ed + " under web/ - no " + ed + ".zip is made in this build")
            continue
        zip_dir(os.path.join(ZD, ed + ".zip"), W, have)
        for s in have: shutil.rmtree(os.path.join(W, s))
    if os.path.isdir(os.path.join(W, "thmnotes")):
        zip_dir(os.path.join(ZD, "thmnotes.zip"), W, ["thmnotes"]); shutil.rmtree(os.path.join(W, "thmnotes"))
    for z in os.listdir(ZD): print("edition zip:", z, os.path.getsize(os.path.join(ZD, z)))

    run(sys.executable, "-I", os.path.join(HERE, "tools", "brotli_books.py"), os.path.join(W, "books"))

    run(bt("aapt2"), "compile", "--dir", res_dir, "-o", os.path.join(OUT, "res.zip"))
    # the manifest actually linked (build-aab-win.py reuses it): provider authority follows the application id
    man = open(os.path.join(HERE, "android", "AndroidManifest.xml"), encoding="utf-8").read().replace(
        'android:authorities="com.quran.karim.share"', 'android:authorities="%s.share"' % APP_ID)
    with open(os.path.join(OUT, "AndroidManifest.xml"), "w", encoding="utf-8", newline="\n") as f: f.write(man)
    with open(os.path.join(OUT, "app-id.txt"), "w") as f: f.write(APP_ID)
    unsigned = os.path.join(OUT, "unsigned.apk")
    run(bt("aapt2"), "link", "-o", unsigned, "-I", ajar,
        "--manifest", os.path.join(OUT, "AndroidManifest.xml"), "--rename-manifest-package", APP_ID,
        "-0", "br", "--min-sdk-version", "21", "--target-sdk-version", "36",
        "-A", os.path.join(OUT, "assets"), "--java", os.path.join(OUT, "gen"), os.path.join(OUT, "res.zip"))

    # Donation relay key + address (DONATE_KEY/DONATE_URL, or keys/donate-key.txt); never in git. No key: no uploads.
    kf = os.path.join(HERE, "keys", "donate-key.txt")
    key = os.environ.get("DONATE_KEY") or (open(kf).read().strip() if os.path.exists(kf) else "")
    url = os.environ.get("DONATE_URL", "https://drabdelraman-quran-voice-relay.hf.space")
    if not key: print("WARNING: no donation key, voice donation uploads are off in this build")
    gd = os.path.join(OUT, "gen", "com", "quran", "karim"); os.makedirs(gd, exist_ok=True)
    with open(os.path.join(gd, "DonateKey.java"), "w") as f:
        f.write('package com.quran.karim;\nfinal class DonateKey { static final String KEY = %s, URL = %s; }\n' % (json.dumps(key), json.dumps(url)))
    libs = sorted(glob.glob(os.path.join(HERE, "android", "libs", "*.jar")))
    srcs = [os.path.join(d, n) for top in (os.path.join(HERE, "android", "src"), os.path.join(OUT, "gen"))
            for d, _, ns in os.walk(top) for n in ns if n.endswith(".java")]
    argfile = os.path.join(OUT, "sources.txt")
    with open(argfile, "w") as f: f.write("\n".join('"%s"' % s.replace("\\", "/") for s in srcs))
    run(jdk("javac"), "-nowarn", "-Xlint:-options", "-encoding", "UTF-8", "--release", "8", "-cp", os.pathsep.join([ajar] + libs),
        "-d", os.path.join(OUT, "classes"), "@" + argfile)
    classes = [os.path.join(d, n) for d, _, ns in os.walk(os.path.join(OUT, "classes")) for n in ns if n.endswith(".class")]
    cls_args = os.path.join(OUT, "classes.txt")
    with open(cls_args, "w") as f: f.write("\n".join(classes + libs))
    run(bt("d8"), "--release", "--min-api", "21", "--lib", ajar, "--output", OUT, "@" + cls_args)
    with zipfile.ZipFile(unsigned, "a", zipfile.ZIP_DEFLATED) as z:
        for dex in sorted(glob.glob(os.path.join(OUT, "classes*.dex"))): z.write(dex, os.path.basename(dex))
    # ONNX Runtime native libraries (NvAsr.java): packaged in the app (Google Play forbids downloaded native code),
    # arm64-v8a only, stored uncompressed and 16 KB aligned (the ELF segments are already 16 KB aligned).
    with zipfile.ZipFile(unsigned, "a", zipfile.ZIP_STORED) as z:
        for so in sorted(glob.glob(os.path.join(HERE, "android", "jniLibs", "arm64-v8a", "*.so"))):
            z.write(so, "lib/arm64-v8a/" + os.path.basename(so))

    aligned = os.path.join(OUT, "aligned.apk")
    run(bt("zipalign"), "-f", "-P", "16", "4", unsigned, aligned, stdout=subprocess.DEVNULL)

    if not os.path.exists(KEYSTORE):
        run(jdk("keytool"), "-genkeypair", "-keystore", KEYSTORE, "-storepass", "android", "-keypass", "android",
            "-alias", "androiddebugkey", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
            "-dname", "CN=Android Debug,O=Android,C=US", stdout=subprocess.DEVNULL)
    manifest = open(os.path.join(HERE, "android", "AndroidManifest.xml"), encoding="utf-8").read()
    ver = re.search(r'android:versionName="([^"]*)"', manifest).group(1)
    apk = os.path.join(HERE, "quran-karim-v%s.apk" % ver)
    run(bt("apksigner"), "sign", "--ks", KEYSTORE, "--ks-pass", "pass:android", "--key-pass", "pass:android",
        "--out", apk, aligned)
    run(bt("apksigner"), "verify", apk)
    print(apk, os.path.getsize(apk), "bytes")

if __name__ == "__main__":
    main()
