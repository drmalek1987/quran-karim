r"""Windows port of build-aab.sh: builds quran-karim-v<version>-play.aab (Google Play bundle) from what build-win.py left in OUT.
Run build-win.py first with the SAME env (PLAY=1, OUT). Usage:
    set PLAY=1 && .venv\Scripts\python.exe -I build-win.py && .venv\Scripts\python.exe -I build-aab-win.py
Signing: the UPLOAD key keys\upload.jks (alias `upload`). Password from env QK_UPLOAD_PASS, else the line `password: ...` in
keys\upload-key.txt (both stay out of git). No key -> the AAB is left unsigned and the exact keytool command is printed.
Also downloads bundletool-all-<ver>.jar into tools\bin\ (git-ignored) and checks its SHA-256."""
import glob, hashlib, json, os, re, shutil, subprocess, sys, urllib.request, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SDK = os.environ.get("ANDROID_HOME") or os.path.join(os.environ["LOCALAPPDATA"], "Android", "Sdk")
BT = os.path.join(SDK, "build-tools", os.environ.get("BUILD_TOOLS", "36.0.0"))
JDK = os.environ.get("JAVA_HOME") or r"C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot"
OUT = os.environ.get("OUT") or os.path.join(HERE, "build")
BUNDLETOOL_VER = "1.18.3"
BUNDLETOOL_SHA256 = "a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29"
BUNDLETOOL = os.path.join(HERE, "tools", "bin", "bundletool-all-%s.jar" % BUNDLETOOL_VER)
UPLOAD_KS = os.path.join(HERE, "keys", "upload.jks")
ENV = dict(os.environ, JAVA_HOME=JDK, PATH=os.path.join(JDK, "bin") + os.pathsep + os.environ["PATH"])

def run(*cmd, **kw): subprocess.run([str(c) for c in cmd], check=True, env=ENV, **kw)
def jdk(t): return os.path.join(JDK, "bin", t + ".exe")

def android_jar():
    if os.environ.get("ANDROID_JAR"): return os.environ["ANDROID_JAR"]
    num = lambda p: int(p.split("-")[-1].split(".")[0]) if p.split("-")[-1].split(".")[0].isdigit() else -1
    for p in ["android-34"] + sorted(os.listdir(os.path.join(SDK, "platforms")), key=num, reverse=True):
        j = os.path.join(SDK, "platforms", p, "android.jar")
        if os.path.exists(j): return j
    sys.exit("no android.jar")

def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

def get_bundletool():
    if os.path.exists(BUNDLETOOL) and sha256(BUNDLETOOL) == BUNDLETOOL_SHA256: return
    os.makedirs(os.path.dirname(BUNDLETOOL), exist_ok=True)
    url = "https://github.com/google/bundletool/releases/download/%s/bundletool-all-%s.jar" % (BUNDLETOOL_VER, BUNDLETOOL_VER)
    print("downloading", url)
    urllib.request.urlretrieve(url, BUNDLETOOL)
    if sha256(BUNDLETOOL) != BUNDLETOOL_SHA256:
        os.remove(BUNDLETOOL); sys.exit("bundletool SHA-256 mismatch, deleted")

def main():
    for need in ("assets", "res.zip", "classes.dex", "AndroidManifest.xml", "app-id.txt"):
        if not os.path.exists(os.path.join(OUT, need)): sys.exit("%s missing in %s: run build-win.py first (PLAY=1 for the Play build)" % (need, OUT))
    get_bundletool()
    manifest = open(os.path.join(HERE, "android", "AndroidManifest.xml"), encoding="utf-8").read()
    ver = re.search(r'android:versionName="([^"]*)"', manifest).group(1)
    # 1. resources + manifest in the protobuf format bundles use
    proto = os.path.join(OUT, "proto.apk")
    run(os.path.join(BT, "aapt2.exe"), "link", "--proto-format", "-o", proto, "-I", android_jar(),
        "--manifest", os.path.join(OUT, "AndroidManifest.xml"), "--rename-manifest-package", open(os.path.join(OUT, "app-id.txt")).read().strip(),
        "--min-sdk-version", "21", "--target-sdk-version", "36",
        "-0", "br", "-A", os.path.join(OUT, "assets"), os.path.join(OUT, "res.zip"))
    # 2. base module laid out as bundletool expects
    base = os.path.join(OUT, "base.zip")
    if os.path.exists(base): os.remove(base)
    with zipfile.ZipFile(proto) as zp, zipfile.ZipFile(base, "w", zipfile.ZIP_DEFLATED) as zb:
        for i in zp.infolist():
            if i.filename.endswith("/"): continue
            name = "manifest/AndroidManifest.xml" if i.filename == "AndroidManifest.xml" else i.filename
            zb.writestr(name, zp.read(i))
        for n, dex in enumerate(sorted(glob.glob(os.path.join(OUT, "classes*.dex")))):
            zb.write(dex, "dex/" + os.path.basename(dex))
        for so in sorted(glob.glob(os.path.join(HERE, "android", "jniLibs", "*", "*.so"))):   # ONNX Runtime, packaged (never downloaded)
            abi = os.path.basename(os.path.dirname(so))
            zb.write(so, "lib/%s/%s" % (abi, os.path.basename(so)))
    cfg = os.path.join(OUT, "BundleConfig.json")
    json.dump({"optimizations": {"splitsConfig": {"splitDimension": [
        {"value": "LANGUAGE", "negate": True}, {"value": "ABI"}, {"value": "SCREEN_DENSITY"}]}},
        "compression": {"uncompressedGlob": ["assets/**/*.br"]}}, open(cfg, "w"))
    aab = os.path.join(HERE, "quran-karim-v%s%s.aab" % (ver, "-play" if os.environ.get("PLAY") == "1" else ""))
    if os.path.exists(aab): os.remove(aab)
    run(jdk("java"), "-jar", BUNDLETOOL, "build-bundle", "--modules=" + base, "--config=" + cfg, "--output=" + aab)
    # 3. sign with the upload key
    pw = os.environ.get("QK_UPLOAD_PASS")
    kt = os.path.join(HERE, "keys", "upload-key.txt")
    if not pw and os.path.exists(kt):
        m = re.search(r"^password:\s*(.+)$", open(kt, encoding="utf-8").read(), re.M)
        pw = m.group(1).strip() if m else None
    if os.path.exists(UPLOAD_KS) and pw:
        subprocess.run([jdk("jarsigner"), "-keystore", UPLOAD_KS, "-storepass:env", "QK_PW", "-keypass:env", "QK_PW", aab, "upload"],
                       check=True, env=dict(ENV, QK_PW=pw), stdout=subprocess.DEVNULL)
        print("signed with the upload key")
    else:
        print("\nNOT SIGNED: keys/upload.jks (and its password) is missing. Create it ONCE, yourself, in a normal terminal"
              " (it asks for the password; do not paste it anywhere):\n  \"%s\" -genkeypair -v -keystore keys/upload.jks -alias upload"
              " -keyalg RSA -keysize 2048 -validity 10000\nBack up keys/upload.jks and the password outside the repo, then run this script again." % jdk("keytool"))
    run(jdk("java"), "-jar", BUNDLETOOL, "validate", "--bundle=" + aab)
    print(aab, os.path.getsize(aab), "bytes")

if __name__ == "__main__":
    main()
