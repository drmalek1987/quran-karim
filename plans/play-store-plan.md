# Google Play – first release plan + policy audit (Quran Karim 5.20, versionCode 68)

Written 2026-11-12. Account: Google Play Developer, **personal, non-trader**. Rules below were checked on the web the same day
(sources at the end). Owner: **C** = Claude (done in the repo), **U** = the user (only the user can do it).

## 1. What Google Play requires today (checklist)

| # | Requirement (as of Nov 2026) | Status for this app | Owner |
|---|---|---|---|
| 1 | **Closed test before production** (personal accounts created after 13 Nov 2023): ≥ **12 testers** opted in **continuously for the last 14 days**, then Dashboard › **Apply for production** (3 parts: about the closed test, about the app, production readiness). Review ≤ 7 days usually. Production + open testing stay locked until approved. Testers who leave before 14 days do not count. | Not started | U (C wrote the answers in the guide) |
| 2 | **Target API**: new apps and updates must target **API 36** (since 31 Aug 2026). | targetSdk 36 ✓ | – |
| 3 | **Android App Bundle (.aab)** mandatory for new apps; install download ≤ 4 GB, base/size above 200 MB needs Play Feature/Asset Delivery. | `build-aab-win.py` → `quran-karim-v5.20-play.aab` 38 MB ✓ | C |
| 4 | **Play App Signing** (Google keeps the app signing key; you sign uploads with an **upload key**). | `keys/upload.jks` does not exist yet | **U** creates it (command in the guide) |
| 5 | **64-bit**: native code must have a 64-bit ABI. | only `arm64-v8a` ✓ | – |
| 6 | **16 KB page size**: updates with native code must support 16 KB pages from **1 Feb 2027**. | ELF segments aligned 0x4000 ✓, APK zipaligned `-P 16` ✓, bundletool aligns AAB splits | – |
| 7 | Store listing assets: icon 512×512 32-bit PNG ≤ 1 MB; feature graphic 1024×500 JPG/24-bit PNG (no alpha); ≥ 2 screenshots (≤ 8 per device type), 320–3840 px, long side ≤ 2× short side, 24-bit no alpha; 4+ at ≥ 1080 px recommended; tablets/Chromebook: 1080–7680 px, 16:9 or 9:16 (optional, recommended for large-screen visibility). Title ≤ 30, short description ≤ 80 (no "best/free/new", no emoji), full ≤ 4000. | see `store/` | C |
| 8 | **Data safety form** – required for every app on closed/open/production tracks, even with no data; privacy policy link required. "Collected" = leaves the device; on-device only is not collected. Optional types only if every user can skip them. | answers in `store/data-safety.md` | U pastes |
| 9 | **Privacy policy URL** (public, non-PDF, not geo-blocked). | `docs/privacy-policy.html` → GitHub Pages | C prepared, **U** turns on Pages |
| 10 | Content rating questionnaire (IARC). | answers in `store/listing-play.md` | U |
| 11 | Target audience & content; Ads declaration; App access; News / Health / Financial / Government declarations. | answers in `store/listing-play.md` | U |
| 12 | **Permissions**: `SCHEDULE_EXACT_ALARM` is the right one (user-granted, denied by default on Android 14+ for new installs); `USE_EXACT_ALARM` is only for alarm/timer/calendar apps – **not used** ✓. No declaration form is listed for `RECORD_AUDIO`, foreground location, `POST_NOTIFICATIONS`, `ACCESS_NETWORK_STATE` (normal), but runtime prompts must be in context with an explanation. Background location would need a declaration – **not used** ✓. From 27 Jan 2027 (API 37 targets only) `ACCESS_FINE_LOCATION` needs a declaration – not yet relevant (we target 36). | texts in `store/listing-play.md` | U pastes if asked |
| 13 | **Non-trader** (EU Digital Services Act status): EU users see a note that the developer has not declared itself a trader (consumer-protection rights against traders do not apply); traders' address/phone are shown, a non-trader's are not. What is public in any case: the developer name and the store listing **App support email** (+ website/phone only if you fill them). The account contact name/email/address/phone are for Google only. Use a dedicated support email. | – | U |
| 14 | Device verification / identity (new accounts must verify a real Android device in the Play Console app and identity). | – | U |

## 2. Audit against the Developer Program Policies

| # | Area | Verdict | Evidence | Fix / decision |
|---|---|---|---|---|
| A1 | **Downloaded native code** (Device and Network Abuse: no dex/JAR/.so from outside Play) | **BLOCKER → FIXED** | `android/src/com/quran/karim/NvAsr.java:227-230` (5.20) did `System.load(files/ed/asr/asrnv/lib/libonnxruntime.so)` from the GitHub download `asrnv.zip` | Libraries now packaged: `android/jniLibs/arm64-v8a/libonnxruntime.so` (18.2 MB) + `libonnxruntime4j_jni.so`, loaded with `System.loadLibrary` (`NvAsr.java` `nativeOk()`/`load()`); `build-win.py` adds them to the APK, `build-aab-win.py` to `base/lib/`. The old `lib/` inside existing model packs is no longer read. AAB 38 MB (base limit is not an issue). Effect: no x86/32-bit ASR (device without arm64 → recogniser reports "not ready"; Play also hides the app from devices without arm64 ABI – a few very old 32-bit phones). |
| A2 | Downloaded **model weights** (`asrnv*.zip`, ONNX data) and edition page images (`kfgqpc.zip` …) from GitHub | **RISK (low)** | `EdStore.java`, `web/app.js:337` | Data, not executable code; the policy names only dex/JAR/.so. Keep. Say it in the reviewer notes. Option later: move the model into a Play Asset Delivery pack (install-time/on-demand) to remove all doubt. |
| A3 | **Haramain edition** (scans, no publishing licence) | **BLOCKER → FIXED in PLAY build** | `build-win.py` PLAY block; the Play APK has no `pages/`, `tjpages/`, `editions/harmain-w`, flags.js `NO_HARMAIN = true` | Verified by listing the Play APK (no harmain/pages). `harmain.zip` is not made. |
| A4 | **Adhan recordings** (9 voices from abodehq/Athan-MP3, no licence) | **BLOCKER → FIXED in PLAY build** | `android/res/raw/adhan_*.ogg`; `store/licences-status.md` | PLAY build compiles res without them; `NO_ADHAN_AUDIO` leaves "phone alarm tone" and "silent" (`web/app.js` `voiceOf`, `Alarms.java:91-99` falls back to the alarm tone). `PLAY_KEEP=adhan` once permission arrives. |
| A5 | **Darwish i'rab/balagha**, **Ibn Ashur tanwir** (in-copyright) | **BLOCKER → FIXED in PLAY build** | `web/books/darwish`, `web/books/tanwir`; `store/licences-status.md` | Removed from the Play build, `NO_BOOKS` hides them, «البلاغة» tab disappears, About credit hidden (`web/index.html:186`). |
| A6 | Other book: «الجدول في إعراب القرآن» (`web/books/jadwal`, kind irab, via tafsir_api) | **RISK** | `web/books/index.js` | Author Mahmud Safi (d. 1956/1376 H): public domain in Egypt (life+50) but not in life+70 countries. Kept; if a complaint comes, add `jadwal` to `NO_BOOKS`. Decision for the user. |
| A7 | OpenITI texts (CC BY-NC-SA) | PASS (while free, no ads) | About screen credits | Never add ads/IAP while they ship. |
| A8 | Quran text, tajweed (CC BY), translation (Saheeh Intl., tanzil), corpus roots (GPL), KFGQPC fonts, NVIDIA model (CC BY 4.0), Dar al-Fajr thematic colours (permission + credit) | PASS | «حول التطبيق» (`web/index.html` ~160-195) lists sources/licences | Attribution screen already exists → no new licences screen needed. |
| A9 | Recitation audio from everyayah.com (streamed, cached) | RISK (low) | `AudioCache.java` | Not bundled; credited. Keep. |
| A10 | **Microphone + voice donation** (User Data policy: prominent disclosure + consent) | PASS | consent dialog `web/app.js:371-383` (terms box + separate unticked donation box), Settings confirm `web/app.js:627`, delete `web/app.js:636-646`, policy `store/privacy-policy.html` | Disclosure is in-app, before collection, opt-in, off by default, deletable. Data safety must declare Audio + other UGC + Device ID as **collected, optional, not shared**. |
| A11 | Location (qibla / prayer times), foreground only, never sent | PASS | manifest comment; policy | COARSE + FINE requested: fine is justified for qibla accuracy; nothing to declare at API 36. |
| A12 | Exact alarms (adhan at the minute) | PASS | `Alarms.java:55-59` checks `canScheduleExactAlarms()`, falls back to inexact; `AppBridge.java:205` opens the system setting; receiver handles `SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` | Uses `SCHEDULE_EXACT_ALARM` (not the restricted `USE_EXACT_ALARM`). |
| A13 | WebView + `addJavascriptInterface` | PASS | `MainActivity.java:56-136`: JS on, `setAllowFileAccess(false)`, content via `shouldInterceptRequest` from bundled assets, external links leave the WebView (`shouldOverrideUrlLoading`) | Interfaces are only reachable by the bundled page. |
| A14 | UGC / ads / purchases / accounts | PASS (none) | – | No account → no account-deletion requirement. |
| A15 | Religious content, name, icon, screenshots | PASS with care | `store/listing.md` | Old listing named «طبعة الحرمين» and claimed «مطابق لنص مجمع الملك فهد» → new texts: no Haramain, "verified against the KFGQPC Hafs text" without any claim of official approval/endorsement. No "best/#1/free" in the short description. |
| A16 | Manifest: exported components | PASS | `AndroidManifest.xml`: MainActivity (launcher, needs exported), widgets (exported – required for APPWIDGET_UPDATE), AlarmReceiver/DonateJob/ShareProvider not exported | – |
| A17 | Cleartext traffic | PASS | targetSdk 36 → cleartext off by default; `EdStore.java:83` refuses non-https | – |
| A18 | Backup | PASS | `android:allowBackup="false"` | – |
| A19 | Crash / ANR basics (Android vitals) | RISK (unknown) | no crash reporting by design | Watch Play Console › Android vitals + the pre-launch report during the closed test. ASR load now fails softly (`nativeOk()` catches `UnsatisfiedLinkError`). |
| A20 | Package name `com.quran.karim` | RISK | common name | Play rejects an existing package at upload; if so, change it before the first upload (can never change later). |
| A21 | `QUERY_ALL_PACKAGES`-type rules | PASS | only `<queries>` for TTS/RecognitionService intents | – |
| A22 | Donation relay URL is on Hugging Face (developer-owned) | PASS | `build-win.py` DONATE_URL | Play counts a service provider as not "sharing". |

**Every BLOCKER is fixed in the PLAY build.** Open decisions for the user: A6 (jadwal), A20 if the package is taken, and whether to keep
fine location (A11).

## 3. Deliverables (where)
- `build-aab-win.py` → `quran-karim-v<ver>-play.aab` (validate + universal APK checked).
- `store/listing-play.md` – all texts (AR + EN), categories, content rating, target audience, ads, app access, declarations,
  permission texts, release notes, reviewer notes, production-access answers.
- `store/data-safety.md` – Data safety field by field.
- `docs/privacy-policy.html` (+ `docs/index.html`) for GitHub Pages.
- `store/play/` – icon 512, feature graphic, phone + tablet screenshots of the Play build.
- `store/PLAY-UPLOAD-GUIDE.md` – click-by-click guide.

## Sources (checked 2026-11-12)
- App testing requirements for new personal developer accounts – support.google.com/googleplay/android-developer/answer/14151465
- Target API level requirements – developer.android.com/google/play/requirements/target-sdk
- Device and Network Abuse – support.google.com/googleplay/android-developer/answer/9888379
- Permissions and APIs that access sensitive information (exact alarm) – support.google.com/googleplay/android-developer/answer/9888170
- Permissions declaration form – support.google.com/googleplay/android-developer/answer/9214102
- Schedule exact alarms denied by default – developer.android.com/about/versions/14/changes/schedule-exact-alarms
- Support 16 KB page sizes – developer.android.com/guide/practices/page-sizes
- Store listing preview assets – support.google.com/googleplay/android-developer/answer/9866151
- Data safety – support.google.com/googleplay/android-developer/answer/10787469
- About Android App Bundles – developer.android.com/guide/app-bundle
