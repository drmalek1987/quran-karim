# CLAUDE.md – Quran Karim app

Guide for Claude Code (or any developer) working in this repo. Requirements are in `SRS.md`, user-facing notes in `README.md`.

## What this is
An offline Quran reader for Android (and an iOS port in progress). The app is a plain HTML/CSS/JS web app in `web/`
wrapped by a tiny native Android shell in `android/` (WebView + Java bridges). No Gradle, no framework, no bundler.

## Layout
- `web/` – the whole UI. `app.js` (main app, router `#/...`, editions `EDS`, player, hifz, khatma), `asr.js` (on-device
  recitation recogniser, onnxruntime-web), `azkar.js`, `i18n.js`, `style.css`, `sw.js` (service worker for the web build;
  bump its cache name `quran-vNN` every release), `quran-data.js` (generated, do not edit), `books/` (tafsir/i'rab/dictionaries),
  `editions/<id>.js` (per-edition page/ayah-box data). Page images (`web/editions/<id>/`, `web/pages/`, `web/tjpages/`) are NOT in git.
- `android/` – `AndroidManifest.xml` (versionName/versionCode live here), `src/com/quran/karim/*.java`:
  `MainActivity` (WebView, back handling, edge-to-edge), `EdStore` (downloads + serves edition zips), `AudioCache`
  (caches everyayah.com audio), `QiblaBridge`, `AppBridge` (clipboard, haptics, share), `NvAsr` (native NVIDIA FastConformer
  via ONNX Runtime), `ReciteBridge`/`SpeechBridge` (mic), `Alarms`/`AlarmReceiver` (adhan), `QuranWidget`/`PrayerWidget`.
  `res/raw/adhan_*.ogg` are the adhan sounds; `libs/` holds onnxruntime + brotli jars; `jniLibs/arm64-v8a` holds the ONNX
  Runtime `.so` files, packaged in the APK/AAB since 5.21 (Google Play forbids downloaded native code; the model packs are data only).
- `data/` – source texts (Uthmani text, search text, page maps, ayah rects). `tools/make_data.py` builds `web/quran-data.js`.
- `tools/` – generators and QA: `kfgqpc/` (King Fahd pages from QPC V2 fonts), `shamarly/`, `kfold/`, `page_geometry/`
  (ayah boxes on scans, tajweed layers), `make_books.py`, `make_tajweed*.py`, `asr/` (model training/export kit for a GPU PC,
  `asr/gpu/*.bat`), `qa/` (`data.py`, `ui.js` Playwright).
- `store/` – Google Play listing, privacy policy, graphics, review notes. `plans/`, `BACKLOG.md`, `IDEAS-*.md` – planning.
- `.claude/skills/run-quran-karim` – skill that drives the web UI in headless Chromium.
- iOS (Capacitor 8) lives on branch `claude/project-thread-jfulu4`: `capacitor.config.json`, `package.json`,
  `web/ios/ed-bridge.js` (EdBridge via JSZip + Filesystem), `ios-native/`, `.github/workflows/ios-simulator.yml`.

## Data that is not in git (branch `editions` of github.com/drmalek1987/quran-karim)
Zips the app downloads at runtime: `kfgqpc.zip` (King Fahd, default), `kfold.zip` (older King Fahd print), `shamarly.zip`,
`harmain.zip` (scans, no publishing licence – excluded from the Play build), `asrnv.zip`+`asrnvp.zip` (NVIDIA ASR model + ORT
native libs), `asrrt.zip` (onnxruntime-web), `asrbase*/asrft*` (older Whisper packs, unused). Unzip one inside `web/` to run
that edition locally (paths inside are relative to `web/`).

## Build (Linux / WSL, no Gradle)
```
sudo apt-get install aapt apksigner zipalign dalvik-exchange python3 python3-pil zip openjdk-17-jdk
keytool -genkeypair -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android \
        -keyalg RSA -validity 10000 -dname "CN=Android Debug"
ANDROID_JAR=/path/to/android-34/android.jar bash build.sh     # -> build/quran-karim-vX.Y.apk
PLAY=1 ... bash build.sh && bash build-aab.sh                  # Play bundle; needs keys/upload.jks + keys/upload-key.txt (your own)
```
- android-34 `android.jar` is required for 4.6+ (the ONNX code). Run from a normal local disk (the JVM fails on network mounts).
- APK file name always carries the version: `quran-karim-<versionName>.apk`.
- APKs are PRIVATE: upload them only to the releases of the private repo `drmalek1987/quran-karim-builds`
  (`gh release create vX.Y quran-karim-vX.Y.apk -R drmalek1987/quran-karim-builds --target main`). Never attach an APK/AAB to a
  release of the public repo `quran-karim` (it must stay public: the app downloads editions/models from its `editions` branch and
  GitHub Pages serves the privacy policy from `docs/`).
- Release checklist: bump `versionName`/`versionCode` in the manifest, the static version text in `web/index.html`
  («حول التطبيق»), and the cache name in `web/sw.js`.
- Web build: serve `web/` with any static server (`python3 -m http.server -d web`).

## Build on Windows (no WSL)
`build-win.py` is the Windows port of `build.sh` (SDK build-tools aapt2/d8/zipalign/apksigner + JDK 17, zipping in Python):
```
uv venv .venv --python 3.11 && uv pip install --python .venv\Scripts\python.exe brotli
.venv\Scripts\python.exe -I build-win.py            # -> quran-karim-vX.Y.apk; PLAY=1 for the Play build
```
- Finds `ANDROID_HOME` (default `%LOCALAPPDATA%\Android\Sdk`), build-tools 36.0.0 (`BUILD_TOOLS=`), and android-34 or the
  newest installed platform jar (android-37 works). Creates `debug.keystore` on first run.
- The `W zip: WARNING: header mismatch` lines while aligning are harmless (the APK verifies).
- Play bundle: `$env:PLAY="1"` then `build-win.py` then `build-aab-win.py` → `quran-karim-v<ver>-play.aab` (bundletool pinned + SHA-256
  checked into `tools/bin/`, signed with `keys/upload.jks`, alias `upload`, password from `QK_UPLOAD_PASS` or `keys/upload-key.txt`).
  `PLAY=1` builds application id **com.lawh.quran** with minSdk 24 (Play automatic protection rejects 21; GitHub build keeps 21, `MIN_SDK=` overrides) (Play name «لوح - حفظ وتسميع القرآن»; the Java package stays com.quran.karim via
  aapt2 --rename-manifest-package, ShareProvider authority = <appId>.share); the GitHub build stays com.quran.karim. It also drops content without a licence (Haramain, adhan recordings, Darwish, tanwir; `PLAY_KEEP=` keeps some). Upload steps:
  `store/PLAY-UPLOAD-GUIDE.md`, policy audit: `plans/play-store-plan.md`.
- Emulator: use the `Phone_API35` AVD (API 35 google_apis x86_64, 4 GB RAM, swiftshader GPU):
  `emulator -avd Phone_API35 -no-snapshot`, then `adb install -r --no-incremental quran-karim-vX.Y.apk`. The API 37 AVDs on
  this PC are unstable (surfaceflinger aborts in GoldfishMapper and restarts system_server; installs fail with "Broken pipe").
  If `sdkmanager` drops the connection, fetch the image zip from dl.google.com with `curl -C -` and unpack it under
  `system-images\android-35\google_apis\`.

## QA
`python3 tools/qa/data.py web` (data checks) and `ED=kfgqpc|kfold|shamarly|harmain node tools/qa/ui.js` (Playwright UI checks,
needs the edition unzipped in `web/`). Record results in `QA-checklist.md`. There is no emulator in CI; phone testing is manual.

## Conventions
- UI text is Arabic, RTL. Keep it offline-first: nothing may need the network except audio, edition/model downloads, and the
  opt-in voice donation upload.
- Settings and state live in `localStorage` keys prefixed `q.` (per edition: `q.lastPage.<id>`).
- Never commit signing keys, keystores, APK/AAB files, page images, or tokens (`.gitignore` covers these). HF tokens for the
  GPU kit live only in `hf_token.txt` on the training PC.
- Quran text must stay letter-identical to the verified source (quranenc Uthmani = KFGQPC Hafs v13); never OCR.
- Licences: KFGQPC fonts (free in software), quran-json CC BY-SA 4.0, tajweed data CC BY 4.0, OpenITI CC BY-NC-SA 4.0,
  NVIDIA FastConformer CC BY 4.0. The Haramain/Dar Misr scans need publisher permission before any store release.
