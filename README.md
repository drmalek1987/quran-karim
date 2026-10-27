# القرآن الكريم – Android app

An offline Android app that shows the whole Quran as searchable Arabic text.

- **Install file:** `quran-karim-vX.Y.apk`, named with its version (about 154 MB; Android 5.0 and newer, and Android System WebView 85+ for the AVIF page images)
- **Editions:** Settings › طريقة العرض offers طبعة الملك فهد (default), طبعة الشمرلي, طبعة الحرمين and the text view. The King Fahd edition is the Madinah mushaf (1421H print, Uthman Taha) drawn from the King Fahd Complex page fonts (QPC V2), which the Complex allows free use of in software and digital publishing (dm.qurancomplex.gov.sa/copyright-2). `tools/kfgqpc/render.js` draws the 604 pages and measures each ayah's boxes from a checkout of github.com/zonetecde/mushaf-layout (branch v2, line layout + fonts); `tools/kfgqpc/make_edition.py` writes `web/editions/kfgqpc/NNN.avif` and `web/editions/kfgqpc.js`. Reading place and khatma are kept per edition (`q.lastPage.kfgqpc`); switching edition opens the same ayah.
- **Shamarly edition:** no licensed Shamarly page scans could be fetched, so `tools/shamarly` typesets the 522 pages (2..522) in the Complex's Hafs font (KFGQPC Uthmanic Script HAFS, same permission) to the Shamarly layout: 15 lines a page, every ayah ending on the same page and line as in the Shamarly print, taken from the end-of-ayah marks in shamerly.db of github.com/Mr-DDDAlKilanny/Shamarly (positions only, no images). Word breaks inside an ayah's lines are spread by word width, so they are close to but not always exactly the print's. `prep.py shamerly.db plan.json` → `render.js plan.json OUT` → `make_edition.py OUT` (`web/editions/shamarly/`, `web/editions/shamarly.js`).
- **Page images:** `tools/enhance_pages.py` cleans each scan and saves `web/pages/NNN.avif` (quality 40, 50 for decorated pages), under half the size of the earlier WebP at the same sharpness. The tajweed layer keeps 16 alpha levels in lossless WebP. Most of the remaining size is the tafsir and dictionary books (about 46 MB).
- **Reading:** the 560 scanned pages of the uploaded PDF, unchanged, so the text, tashkeel and page layout are exactly the printed mushaf. Swipe or tap to turn pages, pinch to zoom, and the app reopens on the last page. Surah start pages come from the PDF's own fihris (page 557); juz and search open the exact page of the ayah. A search result opens its page with the whole ayah shaded yellow over the scan (it follows onto the next page if the ayah continues), and the search word is shaded in a caption above the page.
- **أذكار الصباح والمساء:** the morning and evening adhkar of Hisn al-Muslim (Sa'id al-Qahtani, nos. 75–98) in `web/azkar.js`, with the morning or evening wording, the number of repetitions, the source and the virtue. Tap a card to count; counts reset each day. The Quranic ones (Ayat al-Kursi, al-Ikhlas, al-Falaq, an-Nas) are drawn from the app's verified mushaf text.
- **اتجاه القبلة:** the phone's location and compass (true north, corrected for magnetic declination) show the qibla on a dial, with the angle and distance to the Kaaba. Without GPS, pick a city from the list. The location stays on the phone; the app asks for location permission only when this screen is opened.
- **تفسير، إعراب، معاني الكلمات:** tap an ayah, then «تفسير وإعراب ومعاني». Five tafsirs (Ibn Kathir, al-Tabari, al-Tahrir wa al-Tanwir, al-Qurtubi, al-Sa'di), two i'rab books (Muhyiddin Darwish, Mahmoud Safi's al-Jadwal), and for every word its root with the entry from five classical dictionaries (al-Raghib's al-Mufradat, al-Jawhari's al-Sihah, Ibn Faris's Maqayis al-Lugha, al-Zamakhshari's Asas al-Balagha, Ibn Manzur's Lisan al-Arab). Also أسباب النزول from al-Wahidi (d. 468), linked to its ayat by the numbers the book gives or by matching its quotations against the Quran text (458 passages in 80 surahs). All offline, in `web/books/`, built by `tools/fetch_books.sh` and `tools/make_books.py`.
- **Copy an ayah:** tap any ayah on a scanned page (or in the text view) to shade it and get a bar with «نسخ بالتشكيل» (the Uthmani text as printed) and «نسخ بدون تشكيل» (standard spelling, no marks), both with the surah and ayah number.
- **Page turn effect:** pages turn like a book (Settings › تأثير قلب الصفحة, on by default).
- **الختمة والعلامات:** named bookmarks (from any ayah's bar or the page) and a khatma plan in N days: the daily portion in pages, progress that follows the pages as they are turned in order, ahead/behind status; card on the home screen, screen `#/khatma`.
- **صفحتان متجاورتان:** on a tablet held sideways (width ≥ 900 and height ≥ 500 CSS px) the mushaf shows two pages side by side as printed (even page on the right); setting to turn it off.
- **الحفظ والمراجعة:** «وضع الحفظ» under the page (or above the text) hides every ayah; tap one to show it, or reveal them one by one from the bar. The player's repeat button recites each ayah 2, 3, 5, 7, 10 times or without end.
- **التلاوة الصوتية:** a play button under each page and «استماع» on any ayah recite ayah by ayah (20 reciters from everyayah.com, chosen in settings), highlighting the reciting ayah on the scan (or in the text view) and turning the page as it goes; the basmala is played before each surah except at-Tawba. Audio needs internet the first time: `MainActivity` intercepts the everyayah URLs (`AudioCache.java`) and keeps every file it serves in the app's storage, so anything heard once, or a surah saved with the download button in the player, plays offline later.
- **التجويد (Hafs):** the text view and the ayah screen colour the tajweed rules (ghunnah, ikhfa, idgham, iqlab, the madd types, qalqalah, hamzat al-wasl, silent letters); an «التجويد» tab lists the rules in each ayah, and «أحكام التجويد» on the home screen is a short course with examples taken from the mushaf text. Colours come from the open quran-tajweed data (cpfair, CC BY 4.0), carried letter by letter onto this app's text by `tools/make_tajweed.py`; lessons are in `tools/make_tajweed_lessons.py`. The same colours are drawn on the scanned pages: `tools/page_geometry/tajweed_pages.py` renders each ayah in the KFGQPC Hafs font (the same Madinah calligraphy), aligns the rendering to the ayah's lines on the scan, and recolours the scan's own ink under each tajweed letter into `web/tjpages/NNN.webp`, a transparent layer the app draws over the page (setting «ألوان التجويد على صفحات المصحف»).
- **القراءات العشر:** an «القراءات» tab on each ayah with Ibn al-Jazari's Tahbir al-Taysir (the ten readings), linked to ayat by matching its quoted words; «القراءات العشر» on the home screen lists the readers, their narrators, the book's shorthand, and its usul chapters.
- **Also:** a text view (Settings › طريقة العرض), list of 114 surahs and 30 juz, Uthmani text with the Amiri Quran font, search without tashkeel (for example الصلاة, يؤمنون), jump to an ayah by typing `2:255`, tap an ayah to save your reading place, font size, light and dark mode. Works with no internet.

## Where the text comes from

The uploaded PDF (560 pages, Dar Misr / Al-Sahhar print) is scanned images with no text layer, so text could only come from OCR, which makes mistakes in Quranic Arabic. The app uses a verified digital text instead:

- **Shown text:** Uthmani script, Hafs, from The Noble Qur'an Encyclopedia (quranenc.com), via the `quran-json` package (CC BY-SA 4.0). It was checked letter by letter against the King Fahd Complex Hafs text (v13): all 6236 ayahs match.
- **Search only:** the Tanzil "simple" spelling, so normal spelling finds Uthmani spelling. It is never displayed.
- **Font:** Amiri Quran (SIL Open Font License).

Copyright note: the page images are the Dar Misr (Saeed Gouda Al-Sahhar) print, taken from a Noor-Book download. The Quran text itself is free, but this edition's typesetting may belong to the publisher, so ask them before publishing the app on a store.

Sources for the books: tafsir and i'rab texts from github.com/spa5k/tafsir_api; word roots from the Quranic Arabic Corpus morphology (GPL); dictionary texts and al-Wahidi's Asbab al-Nuzul from the OpenITI corpus (CC BY-NC-SA 4.0, fine for a free app). The OpenITI texts were tagged automatically, so a dictionary entry can occasionally start or end in the wrong place; `make_books.py` repairs the common cases (headings that split a word, text from the previous entry).

## Sharing it for free

1. **Send the APK directly** (WhatsApp, Telegram, Google Drive). People tap it and allow "install unknown apps" once.
2. **GitHub (free):** put the APK under *Releases* for downloads, and turn on *GitHub Pages* for the `web/` folder. The web version installs to the home screen on Android and iPhone and works offline.
3. **Free app stores:** Samsung Galaxy Store and Huawei AppGallery have free developer accounts. F-Droid is free for open-source apps.
4. **Google Play later:** needs a one-time paid developer registration. New personal accounts must also run a closed test with testers before going public, and Play wants an `.aab` bundle and your own release signing key.

## Rebuilding

```
sudo apt-get install aapt apksigner zipalign dalvik-exchange
bash tools/extract_pages.sh "path/to/quran.pdf"   # once: copies the page images to web/pages
bash build.sh                 # uses Ubuntu's android-23 android.jar
bash build.sh path/to/android-34.jar   # optional: newer platform jar
```

Quality checks: `python3 tools/qa/data.py web` checks the data files, and `node tools/qa/ui.js` (Playwright) runs 95 checks of every screen; results are in `QA-checklist.md`.

`build.sh` regenerates `web/quran-data.js` from `data/`, packages `web/` into the app and signs it with `debug.keystore`. For a public release, make your own keystore (`keytool -genkeypair ...`), keep it safe, and pass it with `KEYSTORE=...`; every future update must be signed with the same key.

## Files

- `web/` – the app screens (HTML/CSS/JS). Same files work as a website.
- `android/` – the small Android wrapper (`MainActivity.java`, `QiblaBridge.java` for location and compass, `AppBridge.java` for the clipboard, manifest, icon).
- `data/` – source texts and `ayah-rects.json` (where each ayah sits on the scans). `tools/make_data.py` builds `web/quran-data.js` and checks counts.
- `tools/page_geometry/` – the scripts that measured the ayah positions on the scans (see its README).
