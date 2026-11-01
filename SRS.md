# Software Requirements Specification – القرآن الكريم (Quran Karim)

Version described: **4.8** (versionCode 39, service worker `quran-v34`), November 2026. This documents the app as built.

## 1. Purpose and scope
A free, offline Quran reader for Android phones and tablets (Android 5.0+, WebView 85+), with an iOS port in progress.
Users read the mushaf page by page in several printed editions, search, listen, memorise, and study tafsir, i'rab and
word meanings, plus prayer helpers (azkar, qibla, adhan, widgets).

## 2. Users
Arabic-speaking Muslims of any level: readers, people memorising (hifz), students of tajweed and tafsir. UI is Arabic (RTL)
with an English translation layer (`web/i18n.js`, `translation-en.js`).

## 3. Constraints
- Install size under 50 MB; editions and models are downloaded on demand (first-run welcome screen or Settings).
- Works fully offline after downloads. No account, no ads, no tracking; location stays on the device.
- Quran text must be a verified digital text (no OCR). Only content licensed for free distribution ships in the Play build.
- Built without Gradle (Ubuntu Android tools); targetSdk 36, compiled against android-34.

## 4. Functional requirements
### 4.1 Mushaf editions (Settings › طريقة العرض)
| id | Edition | Source | Notes |
|---|---|---|---|
| kfgqpc | طبعة الملك فهد (default) | 604 pages drawn from KFGQPC QPC V2 fonts + mushaf-layout | licensed for software use |
| kfold | طبعة الملك فهد القديمة | scanned older print, ayah boxes from the King Fahd layout | added 4.6 |
| shamarly | طبعة الشمرلي | 522 pages typeset in KFGQPC Hafs font to Shamarly line/page layout | word breaks approximate |
| harmain | طبعة الحرمين / Dar Misr | 560 scans of the user's PDF | not in Play build (no licence) |
| text | text view | quranenc Uthmani text, Amiri Quran font | always available |
- Each edition is a zip downloaded and served by `EdStore`; download can pause/resume.
- Reading place and khatma are kept per edition; switching edition opens the same ayah.
- Page turn (book curl, optional), pinch zoom, two-page spread on landscape tablets, page colour/background, dark mode.
- Tap an ayah: highlight, copy with/without tashkeel, bookmark, listen, tafsir.

### 4.2 Navigation and search
114 surahs, 30 juz, rub', jump by `S:A`, search without tashkeel (Tanzil simple index), result opens the exact page with the
ayah shaded; voice search.

### 4.3 Study
Five tafsirs (Ibn Kathir, Tabari, Tahrir wa Tanwir, Qurtubi, Sa'di), two i'rab books, word roots with five dictionaries,
Asbab al-Nuzul (Wahidi), ten qira'at (Tahbir al-Taysir), mutashabihat, thematic mushaf with margin notes (downloaded),
topics, English translation.

### 4.4 Tajweed
Colour-coded tajweed rules in text view and as a layer over mushaf pages (all editions); lessons screen with examples.

### 4.5 Recitation audio
20 reciters from everyayah.com, ayah-by-ayah with highlighting and auto page turn, basmala, repeat 1–10/forever,
offline cache of everything heard, per-surah download.

### 4.6 Memorisation (hifz) and voice recognition (ASR)
- Hifz mode hides ayat; reveal by tap or one by one.
- Read-aloud check: the user recites, the app follows and marks words. Recognisers: Android speech, or on-device NVIDIA
  Arabic FastConformer (int8 ONNX, CC BY 4.0) downloaded from Settings (~120 MB incl. ONNX Runtime native libs), run natively
  (`NvAsr.java`) or in WASM (`asr.js`). Goal: recognise any reciter, not one voice.
- Voice hifz test: recite a passage, get a score.
- Optional voice donation: with explicit consent, correctly read clips are queued and uploaded to a Hugging Face Space relay
  (`DrAbdelraman/quran-voice-relay`) into a private dataset, then deleted locally. Off by default.

### 4.7 Khatma and bookmarks
Named bookmarks; khatma plan in N days with daily portion, progress and ahead/behind status on the home screen.

### 4.8 Prayer helpers
- Morning/evening azkar (Hisn al-Muslim) with counters reset daily; duas.
- Qibla: GPS + compass (true north, declination), or city list.
- Prayer times with adhan alarms (`Alarms.java`, 9 adhan voices in `res/raw`), notification.
- Home-screen widgets: Quran widget (ayah/continue reading) and prayer-times widget.

### 4.9 Settings and system
Font size, theme, page colour, haptics, language, edition downloads/removal, recogniser choice, voice donation consent.
Android back closes sheets first; edge-to-edge insets; predictive back.

## 5. Non-functional requirements
- Performance: page turn < ~1 s on mid-range phones; images AVIF.
- Reliability: QA suite `tools/qa` (data checks 28/28, UI ~153 checks per edition) must pass before a release.
- Privacy: only network uses are audio, downloads and the opt-in upload; privacy policy in `store/privacy-policy.html`.
- Accessibility: RTL, scalable font, light/dark.

## 6. Platforms and status
- Android: released as APK 4.7 (signed with a debug key, shared directly). Play: AAB path ready (`build-aab.sh`), store kit in
  `store/`; needs the owner's developer account and closed test.
- Web/PWA: `web/` works as a website with `sw.js`.
- iOS: Capacitor 8 port (branch `claude/project-thread-jfulu4`); CI builds and runs it in the iOS Simulator; King Fahd
  download and page reading verified. Not yet ported: qibla, ASR model, adhan, widgets.

## 7. Open items
See `BACKLOG.md`. Pending phone tests: voice upload, NVIDIA model, adhan. Publisher permission needed for Haramain/Dar Misr
scans before any store release.
