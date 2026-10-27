// English interface (Settings › لغة التطبيق). The app is written in Arabic; with English chosen, every piece of interface text
// is swapped for its English line here as it appears on screen (a MutationObserver), so app.js stays as it is.
// The Quran, tafsir, azkar, lessons and other book texts stay in Arabic. Keys: the Arabic text with numbers as #, a surah
// name as @ and a juz name as % (filled back in order, in English form).
(function () {
  var lang;
  try { lang = JSON.parse(localStorage.getItem("q.lang") || '"ar"'); } catch (e) { lang = "ar"; }
  window.LANG = lang === "en" ? "en" : "ar";
  if (window.LANG !== "en") return;
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  document.documentElement.classList.add("en");

  var SURAH_EN = ["Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha", "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum", "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir", "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadilah", "Al-Hashr", "Al-Mumtahanah", "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "'Abasa", "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams", "Al-Layl", "Ad-Duha", "Ash-Sharh", "At-Tin", "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat", "Al-Qari'ah", "At-Takathur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"];
  var JUZ_AR = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون", "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون", "الرابع والعشرون", "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون", "التاسع والعشرون", "الثلاثون"];

  var WD = { "الأحد": "Sun", "الاثنين": "Mon", "الثلاثاء": "Tue", "الأربعاء": "Wed", "الخميس": "Thu", "الجمعة": "Fri", "السبت": "Sat" };
  var D = {
    // 3.9: downloads, thematic colours, edition download
    "التحميلات": "Downloads", "صفحات كل طبعة بتتنزل مرة واحدة وتشتغل من غير إنترنت. تقدر تحذف أي طبعة توفّر مساحة، وتنزّلها تاني وقت ما تحب.": "Each edition's pages download once and then work offline. Delete any edition to free space, and download it again whenever you like.",
    "معاني ألوان المصحف الموضوعي": "What the thematic colours mean", "حذف كل الطبعات": "Delete all editions", "في الانتظار…": "Waiting…", "التنزيل فشل · # ميجا": "Download failed · # MB", "حذف": "Delete", "تنزيل": "Download", "✓ على الموبايل · # ميجا": "✓ On this phone · # MB", "مش متنزّلة · # ميجا": "Not downloaded · # MB", "جارٍ التنزيل…": "Downloading…",
    "تحذف صفحات # من الموبايل؟": "Delete this edition's pages from the phone?", "تحذف صفحات كل الطبعات من الموبايل؟ هتقدر تنزّلها تاني من هنا.": "Delete the pages of every edition from the phone? You can download them again here.",
    "صفحات المصحف هتتنزل مرة واحدة (حوالي # ميجا) وبعدها تشتغل من غير إنترنت.": "The mushaf pages download once (about # MB), then work offline.", "إلغاء": "Cancel", "حاول تاني": "Try again", "التنزيل فشل. اتأكد من الإنترنت وحاول تاني.": "The download failed. Check the internet and try again.",
    "#٪": "#%", "طبعة الملك فهد": "King Fahd edition", "طبعة الشمرلي": "Shamarly edition", "طبعة الحرمين": "Haramain edition",
    "ألوان المصحف الموضوعي (على صفحات المصحف)": "Thematic mushaf colours (on the pages)", "معاني الألوان": "What the colours mean",
    "تقسيم «التفصيل الموضوعي» بإذن دار الفجر الإسلامي، فكرة وإعداد الأستاذ مروان نور الدين سوار. كل موضوع بدرجتين من لونه عشان يبان أوله وآخره.": "The «al-Tafsil al-Mawdu'i» division, with the permission of Dar al-Fajr al-Islami; idea and preparation by Marwan Nour al-Din Sawar. Each topic has two shades of its colour so its start and end show.",
    "آيات الله في الكون والأنفس، وفضله على عباده": "God's signs in the universe and in people, and His grace to His servants", "النبي ﷺ والمؤمنون وجزاؤهم والجنة": "The Prophet ﷺ, the believers, their reward and Paradise", "آيات الأحكام": "Verses of rulings",
    "قصص الرسل والأنبياء والأمم السابقة": "Stories of the messengers, prophets and earlier nations", "القرآن الكريم، وصفات الإنسان، والرد على المشركين، وسنة الله في خلقه": "The Quran, human nature, answers to the idolaters, and God's way with His creation",
    "يوم القيامة وعلاماته، والموت والقبر والحساب والحشر والبعث": "The Day of Judgement and its signs; death, the grave, the reckoning and the resurrection", "جهنم وأوصافها، وعذاب المشركين والكافرين فيها": "Hell, its description, and the punishment of the disbelievers in it",
    "حدّد موقعك أو اختر مدينتك لحساب مواقيت الصلاة على الجهاز (بدون إنترنت).": "Set your location or choose your city to calculate prayer times on the phone (offline).", "حدّد موقعك الأول من شاشة مواقيت الصلاة.": "Set your location first on the prayer times screen.",
    "العربية": "العربية",
    // 3.6 / 3.7
    "الأذكار": "Adhkar", "الصلاة": "Prayer", "المزيد": "More", "زي الموبايل": "Like the phone", "مع المغرب": "Night after maghrib",
    "نسخة احتياطية (العلامات والختمة والملاحظات والحفظ والإعدادات)": "Backup (bookmarks, khatma, notes, hifz, settings)", "حفظ نسخة": "Save a copy", "استرجاع": "Restore",
    "ختمة رمضان": "Ramadan khatma", "رمضان بعد # يوم (# فبراير)، الخطة # يوم تبدأ أوله.": "Ramadan in # days (Feb #); a #-day plan starting on its first day.", "ابدأ": "Start", "استبدل الخطة": "Replace plan",
    "إحصائيات القراءة": "Reading stats", "صفحة اليوم": "pages today", "آخر ٧ أيام": "last 7 days", "آخر ٣٠ يوم": "last 30 days", "يوم متتالي": "day streak", "أطول مدة": "best streak",
    "اليوم:": "Today:", "كلمة و": "words and", "حرف": "letters", "آخر ٣٠ يوم:": "Last 30 days:", "اليوم": "Today",
    "أحد": "Sun", "اثنين": "Mon", "ثلاثاء": "Tue", "أربعاء": "Wed", "خميس": "Thu", "جمعة": "Fri", "سبت": "Sat",
    "بتتحسب الصفحات اللي فتحتها في المصحف (كل صفحة مرة واحدة في اليوم).": "Counts the mushaf pages you opened (each page once a day).",
    "متابعة الحفظ": "Memorisation log", "سجّل السور اللي حفظتها": "Log the surahs you know by heart", "حفظت # سورة": "# surahs memorised", "# آية من #": "# of # verses",
    "حفظت # سورة (#٪ من القرآن)": "# surahs memorised (#% of the Quran)", "# آية": "# verses", "راجعتها من # يوم": "revised # days ago", "راجع اليوم": "Revise today", "اقرأ": "Read", "راجعتها ✓": "Revised ✓", "اختبرني": "Test me",
    "اضغط على السورة لما تحفظها. وبعد ما تراجع سورة اضغط «راجعتها» عشان التطبيق يرشّح لك اللي بعدها.": "Tap a surah once you know it. After revising one, tap «Revised» so the app suggests the next.",
    "أدعية مختارة": "Selected duas", "اختبار الحفظ": "Memorisation test", "إمساكية رمضان": "Ramadan timetable", "شاشة الترحيب": "Welcome screen",
    "أذكار النوم": "Before sleep", "الاستيقاظ من النوم": "On waking", "البيت والمسجد": "Home & mosque", "الطعام": "Food", "السفر": "Travel", "الهم والكرب": "Worry & distress", "أدعية من القرآن": "Duas from the Quran",
    "المصدر: «حصن المسلم» لسعيد بن وهف القحطاني. الآيات من نص المصحف نفسه المستخدم في التطبيق.": "Source: Hisn al-Muslim by Sa'id al-Qahtani. Verses are from the app's own mushaf text.",
    "إخفاء": "Hide", "ربع الكلمات": "A quarter", "النص": "Half", "كل الكلمات": "All words",
    "اقرا من حفظك. لو نسيت كلمة اضغط عليها عشان تظهر، وفي الآخر اضغط «خلصت». الآيات #–# من #.": "Recite from memory. Tap a hidden word you forget to reveal it, then tap «Done». Verses #–# of #.",
    "سجّل تلاوتك": "Record yourself", "سجّل تاني": "Record again", "إيقاف التسجيل": "Stop recording", "اسمع القارئ": "Hear the reciter", "خلصت": "Done", "الآيات اللي بعدها": "Next verses",
    "افتكرت # من # كلمة": "remembered # of # words", "، ما شاء الله": ", well done", "، محتاجة مراجعة بسيطة": ", needs a little revision", "، راجعها تاني": ", revise it again",
    "الموقع وطريقة الحساب": "Location & calculation", "الكهف يوم الجمعة": "Al-Kahf on Friday", "صيام السنة غدًا": "Sunnah fast tomorrow", "مراجعة الحفظ": "Hifz revision",
    "ملخص قراءة اليوم": "Today's reading summary", "هدف القراءة اليومي": "Daily reading goal", "حدد هدف يومي": "Set a daily goal", "هدف اليوم": "Today's goal", "# من # صفحة": "# of # pages",
    "كام صفحة في اليوم؟ الصفحات بتتحسب لوحدها وانت بتقرا.": "How many pages a day? Pages are counted as you read.", "بدون": "None", "فكّرني لو مخلصتش": "Remind me if not done", "تم": "Done",
    "حققت هدف النهارده: # صفحة": "Today's goal reached: # pages",
    "رمضان": "Ramadan", "الإمساك": "Imsak", "الإفطار": "Iftar", "المؤذن": "Muezzin", "تذكير قبل الأذان": "Reminder before adhan", "# د": "# min", "الأذان مقفول": "Adhan off",
    "صوت الأذان والتذكير قبله": "Adhan voice & reminder", "الحرم المكي": "Makkah Haram", "مشاركة الإمساكية صورة": "Share timetable as image",
    "أهلًا بيك في القرآن الكريم": "Welcome to The Noble Quran", "اختار المصحف اللي متعود تقرا فيه. تقدر تغيّره بعدين من الإعدادات.": "Choose the mushaf you usually read. You can change it later in Settings.",
    "نص مشكول (بدون صور)": "Vowelled text (no page images)", "تخطي": "Skip", "التالي": "Next", "يلا نبدأ": "Let's start", "مدينتك": "Your city",
    "عشان مواقيت الصلاة والأذان والقبلة. كل الحساب بيتم على الموبايل من غير إنترنت.": "For prayer times, adhan and qibla. Everything is worked out on the phone, offline.",
    "استخدم موقعي": "Use my location", "أو اختار مدينة…": "or pick a city…", "تحب نفكّرك بإيه؟": "What should we remind you of?", "تقدر تغيّر المواعيد بعدين من شاشة الصلاة.": "You can change times later on the Prayer screen.",
    "الأذان في مواعيده": "Adhan on time", "السور": "Surahs", "في الأذكار والأدعية": "In adhkar & duas", "المجموع كله: #": "All-time total: #",
    "ابحث في الآيات والسور والأذكار، أو ٢:٢٥٥": "Search verses, surahs, adhkar, or 2:255",

    // bar, home, index
    "القرآن الكريم": "The Noble Quran", "الفهرس": "Index", "فهرس السور": "Surah index", "رجوع": "Back", "بحث": "Search", "البحث": "Search",
    "الإعدادات": "Settings", "تمرير تلقائي": "Auto scroll", "إغلاق": "Close",
    "متابعة القراءة": "Continue reading", "ابدأ القراءة من أول المصحف": "Start reading from the beginning",
    "الختمة والعلامات": "Khatma & bookmarks", "ابدأ خطة ختمة واحفظ علاماتك": "Start a khatma plan and keep your bookmarks",
    "أذكار الصباح والمساء": "Morning & evening adhkar", "اتجاه القبلة": "Qibla direction", "أحكام التجويد": "Tajweed rules", "القراءات العشر": "The ten qira'at",
    "السور": "Surahs", "الأجزاء": "Juz'", "مكية · # آية": "Meccan · # verses", "مدنية · # آية": "Medinan · # verses",
    "مكية · # آية · @": "Meccan · # verses · @", "مدنية · # آية · @": "Medinan · # verses · @",
    "صفحة #": "Page #", "صفحة # – #": "Pages #–#", "الجزء %": "Juz %", "الجزء #": "Juz #", "سورة @": "Surah @", "@": "@", "@ #": "@ #",
    "@ # · صفحة #": "@ # · page #", "صفحة # · الجزء %": "Page # · Juz %", "سورة @ · الجزء %": "Surah @ · Juz %", "سورة @ · #": "Surah @ · #",
    "ابحث عن سورة بالاسم أو الرقم": "Find a surah by name or number",
    // settings
    "القراءة": "Reading", "المصحف": "Mushaf", "طبعة الملك فهد": "King Fahd print", "طبعة الشمرلي": "Shamarly print", "طبعة الحرمين": "Haramain print", "نص": "Text",
    "طريقة التقليب": "Page turning", "أفقي كالكتاب": "Sideways, like a book", "عمودي": "Vertical scroll", "تأثير قلب الصفحة": "Page curl effect",
    "تشغيل": "On", "إيقاف": "Off", "صفحتان متجاورتان على التابلت بالعرض": "Two pages side by side on a landscape tablet",
    "الترجمة الإنجليزية تحت الآيات": "English translation under the verses", "الشكل": "Appearance", "لون صفحة المصحف": "Mushaf page colour",
    "ألوان التجويد": "Tajweed colours", "حجم خط النص": "Text size", "مظهر التطبيق": "App theme", "تلقائي": "Auto", "فاتح": "Light", "داكن": "Dark",
    "الصوت والتطبيق": "Audio & app", "القارئ": "Reciter", "اهتزاز خفيف عند قلب الصفحة واختيار آية": "Light vibration on page turns and verse taps",
    "لغة التطبيق": "App language", "العربية": "العربية", "حول التطبيق": "About the app", "تم": "Done",
    "ورقي": "Paper", "أبيض": "White", "كريمي": "Cream", "رمادي": "Grey", "رمادي داكن": "Dark grey", "ليلي": "Night", "أسود": "Black", "لون من اختيارك": "Your own colour",
    "· الإصدار #": "· version #", "الخصوصية": "Privacy", "المصاحف وحقوق النشر": "Mushaf sources and copyright",
    "تطبيق مجاني بدون إعلانات، يعمل بدون إنترنت (ما عدا تحميل صوت القارئ أول مرة).": "A free app with no ads. It works offline (except downloading a reciter's audio the first time).",
    "التطبيق لا يجمع أي بيانات ولا يرسلها لأي جهة، ولا يحتاج حسابًا، وليس فيه إعلانات. الموقع يُستخدم على الجهاز فقط لحساب اتجاه القبلة ولا يُحفظ ولا يُرسل. الإنترنت يُستخدم فقط لتحميل صوت القارئ من everyayah.com، ثم يُحفظ على الجهاز. العلامات والختمة والإعدادات محفوظة على جهازك فقط.":
      "The app collects no data and sends nothing to anyone; it needs no account and has no ads. Your location is used on the device only, to find the qibla, and is never stored or sent. The internet is used only to download recitation audio from everyayah.com, which is then kept on the device. Bookmarks, khatma and settings stay on your device.",
    // reciters
    "مشاري راشد العفاسي": "Mishary Rashid Alafasy", "محمود خليل الحصري": "Mahmoud Khalil Al-Husary", "الحصري (المصحف المعلم)": "Al-Husary (teaching mushaf)",
    "محمد صديق المنشاوي (مرتل)": "Muhammad Siddiq Al-Minshawi (murattal)", "محمد صديق المنشاوي (مجود)": "Muhammad Siddiq Al-Minshawi (mujawwad)",
    "عبد الباسط عبد الصمد (مرتل)": "Abdul Basit Abdul Samad (murattal)", "عبد الباسط عبد الصمد (مجود)": "Abdul Basit Abdul Samad (mujawwad)",
    "محمد محمود الطبلاوي": "Muhammad Mahmoud Al-Tablawi", "مصطفى إسماعيل": "Mustafa Ismail", "محمود علي البنا": "Mahmoud Ali Al-Banna",
    "عبد الرحمن السديس": "Abdul Rahman Al-Sudais", "سعود الشريم": "Saud Al-Shuraim", "ماهر المعيقلي": "Maher Al-Muaiqly", "سعد الغامدي": "Saad Al-Ghamdi",
    "ياسر الدوسري": "Yasser Al-Dosari", "أبو بكر الشاطري": "Abu Bakr Al-Shatri", "علي الحذيفي": "Ali Al-Hudhaifi", "ناصر القطامي": "Nasser Al-Qatami",
    "محمد أيوب": "Muhammad Ayyub", "محمد جبريل": "Muhammad Jibreel",
    // page and text view
    "وضع الحفظ": "Memorise mode", "وضع الحفظ والمراجعة": "Memorise & review mode", "إنهاء وضع الحفظ": "End memorise mode",
    "علامة على هذه الصفحة": "Bookmark this page", "دليل ألوان التجويد": "Tajweed colour key", "السابقة": "Previous", "التالية": "Next",
    "اضغط على أي آية في الصفحة لتظليلها ونسخها.": "Tap any verse on the page to highlight and copy it.", "استماع": "Listen", "قراءة ليلية": "Night reading",
    "السورة التالية: @": "Next surah: @", "السورة السابقة: @": "Previous surah: @", "لا توجد آيات في هذه الصفحة": "No verses on this page",
    "افتح الآية # في صفحة المصحف (صفحة #)": "Open verse # on its mushaf page (page #)", "الآية مظللة بالأصفر في صفحة المصحف": "The verse is highlighted in yellow on the page",
    "تفسير وإعراب ومعاني": "Tafsir, grammar & meanings", "علامة": "Bookmark", "بالتشكيل": "Copy with diacritics", "بدون تشكيل": "Copy without diacritics", "في النص": "In text view",
    "سورة @ · الآية #": "Surah @ · verse #", "نُسخت الآية بالتشكيل": "Verse copied with diacritics", "نُسخت الآية بدون تشكيل": "Verse copied without diacritics", "تعذّر النسخ": "Couldn't copy",
    "السرعة #": "Speed #", "أبطأ": "Slower", "أسرع": "Faster",
    // player and memorise bar
    "لا يوجد اتصال بالإنترنت، وهذه الآية غير محفوظة": "No internet connection, and this verse isn't saved on the phone", "تعذّر تشغيل التلاوة": "Couldn't play the recitation",
    "بدون تكرار": "No repeat", "تكرار كل آية # مرات": "Repeat each verse # times", "تكرار الآية بلا توقف": "Repeat the verse non-stop", "تكرار الآية": "Repeat verse",
    "البسملة": "Basmala", "إيقاف مؤقت": "Pause", "جارٍ الحفظ…": "Saving…", "كُشفت كل الآيات": "All verses shown", "اكشف التالية": "Show next", "الكل": "All", "إخفاء": "Hide",
    // bookmarks and khatma
    "اسم العلامة": "Bookmark name", "حفظ": "Save", "إلغاء": "Cancel", "حُذفت العلامة": "Bookmark deleted", "اضغط مرة أخرى للتأكيد": "Tap again to confirm",
    "الختمة": "Khatma", "خطة الختمة": "Khatma plan", "العلامات": "Bookmarks", "ابدأ الختمة": "Start the khatma", "# يومًا": "# days",
    "اختر في كم يوم تريد أن تختم القرآن، ويحسب لك التطبيق ورد كل يوم ويتابع تقدمك وأنت تقلب الصفحات.": "Choose how many days you want to complete the Quran in. The app works out each day's portion and follows your progress as you turn the pages.",
    "أو عدد آخر من الأيام:": "Or another number of days:", "من أول المصحف": "From the beginning", "من آخر صفحة قرأتها (#)": "From the last page you read (#)",
    "لا توجد علامات بعد. اضغط على أي آية في المصحف واختر «علامة»، أو زر العلامة تحت الصفحة.": "No bookmarks yet. Tap any verse in the mushaf and choose “Bookmark”, or use the bookmark button under the page.",
    "اليوم # من #": "Day # of #", "#٪": "#%", "ورد اليوم": "Today's portion", "من صفحة # (سورة @)": "From page # (Surah @)", "إلى صفحة # (سورة @)": "To page # (Surah @)",
    "ورد اليوم حوالي # صفحة. قرأت # من # صفحة.": "Today's portion is about # pages. You have read # of # pages.",
    "اقرأ ورد اليوم": "Read today's portion", "تابع القراءة": "Continue reading", "قرأت ورد اليوم": "I read today's portion", "تعديل موضعي": "Set my place", "إلغاء الخطة": "Cancel the plan",
    "ورد اليوم: # صفحة، من صفحة # إلى #": "Today: # pages, from page # to #", "أنهيت ورد اليوم ✓": "Today's portion done ✓", "أنهيت ورد اليوم": "Today's portion done",
    "تمت الختمة، ما شاء الله": "Khatma complete, masha'Allah", "تمت الختمة، تقبّل الله منك": "Khatma complete, may Allah accept it from you", "ابدأ ختمة جديدة": "Start a new khatma",
    "آخر صفحة قرأتها في الختمة": "Last page you read in the khatma", "رقم صفحة غير صحيح": "Not a valid page number",
    "أنهيت ورد اليوم ✓ · #٪ من الختمة": "Today's portion done ✓ · #% of the khatma", "#٪ من الختمة": "#% of the khatma",
    // search
    "ابحث بالكلمات دون تشكيل، مثل: الصلاة، يؤمنون، الرحمن. أو اكتب رقم السورة والآية مثل #:#.": "Search with words without diacritics, e.g. الصلاة، يؤمنون، الرحمن, or type a surah and verse number such as #:#.",
    "ابحث بالكلمات دون تشكيل، مثل: الصلاة، يؤمنون، @. أو اكتب رقم السورة والآية مثل #:#.": "Search with words without diacritics, e.g. الصلاة، يؤمنون، الرحمن, or type a surah and verse number such as #:#.",
    "اكتب كلمة، أو رقم سورة وآية مثل #:#": "Type a word, or a surah and verse number such as #:#", "اكتب حرفين على الأقل.": "Type at least two letters.",
    "عدد النتائج: #": "Results: #", "عدد النتائج: # (تُعرض أول #)": "Results: # (showing the first #)", "لا توجد نتائج": "No results",
    "سورة @ · الآية # · الجزء # · صفحة #": "Surah @ · verse # · juz # · page #",
    // ayah screen
    "الآية السابقة": "Previous verse", "الآية التالية": "Next verse", "التفسير": "Tafsir", "التجويد": "Tajweed", "القراءات": "Qira'at", "أسباب النزول": "Reasons of revelation",
    "الإعراب": "Grammar (i'rab)", "معاني الكلمات": "Word meanings", "تفسير ابن كثير": "Ibn Kathir", "تفسير الطبري": "Al-Tabari", "التحرير والتنوير": "Al-Tahrir wal-Tanwir",
    "تفسير القرطبي": "Al-Qurtubi", "تفسير السعدي": "Al-Sa'di", "جارٍ التحميل…": "Loading…", "تعذّر التحميل.": "Couldn't load.", "الكتب غير موجودة في هذه النسخة.": "The books aren't included in this version.",
    "لم يذكر الواحدي سببًا لنزول هذه الآية.": "Al-Wahidi gives no reason of revelation for this verse.", "لا يوجد نص لهذه الآية في هذا الكتاب.": "This book has no text for this verse.",
    "لا توجد في هذه الآية أحكام ملوّنة غير المد الطبيعي.": "This verse has no coloured rules other than the natural madd.", "تعذّر تحميل كلمات الآية.": "Couldn't load the verse's words.",
    "لا توجد في هذه الآية كلمات لها جذر.": "No word in this verse has a root.", "الجذر:": "Root:",
    // azkar
    "أذكار الصباح": "Morning adhkar", "أذكار المساء": "Evening adhkar", "الصباح": "Morning", "المساء": "Evening", "عدّ": "Count",
    "أتممت # من # · اضغط على الذكر لتعدّه": "Done # of # · tap a dhikr to count it", "من #": "of #", "ابدأ العدّ من جديد": "Start counting again",
    "أتممت الأذكار، تقبّل الله منك.": "Adhkar complete, may Allah accept them from you.",
    "المصدر: «حصن المسلم» لسعيد بن وهف القحطاني. الآيات من نص المصحف نفسه المستخدم في التطبيق.": "Source: “Hisn al-Muslim” by Sa'id ibn Wahf al-Qahtani. The verses are from the same mushaf text used in the app.",
    // qibla
    "استخدم موقعي الحالي": "Use my current location", "اختر مدينة…": "Choose a city…", "جارٍ تحديد موقعك…": "Finding your location…",
    "لم يُسمح بالوصول إلى الموقع. اختر مدينتك من القائمة.": "Location access wasn't allowed. Choose your city from the list.",
    "تعذّر تحديد الموقع. شغّل الموقع (GPS) أو اختر مدينتك من القائمة.": "Couldn't find your location. Turn on location (GPS) or choose your city from the list.",
    "أنت متجه إلى القبلة": "You are facing the qibla", "استدر يمينًا": "Turn right", "استدر يسارًا": "Turn left", "(تعذّر تحديث الموقع الآن)": "(couldn't update the location now)",
    "البوصلة غير متاحة على هذا الجهاز: وجّه علامة ش إلى الشمال، والكعبة تشير إلى القبلة.": "No compass on this device: point the N mark north and the Kaaba shows the qibla.",
    "ش": "N", "ج": "S", "غ": "W", "ق": "E",
    // tajweed
    "رواية حفص عن عاصم من طريق الشاطبية": "Hafs from 'Asim, by way of al-Shatibiyyah", "ألوان التجويد في عرض النص": "Tajweed colours in the text view",
    "همزة الوصل": "Hamzat al-wasl", "لام شمسية": "Lam shamsiyyah", "حرف لا يُنطق": "Silent letter", "مد عارض أو لين (# أو # أو #)": "Madd 'arid or lin (# / # / #)",
    "مد منفصل (# أو #)": "Madd munfasil (# or #)", "مد متصل (# أو #)": "Madd muttasil (# or #)", "مد لازم (#)": "Madd lazim (#)", "غنة": "Ghunnah", "إخفاء": "Ikhfa'",
    "إخفاء شفوي": "Ikhfa' shafawi", "إقلاب": "Iqlab", "إدغام بغنة": "Idgham with ghunnah", "إدغام بغير غنة": "Idgham without ghunnah", "إدغام شفوي": "Idgham shafawi",
    "إدغام متجانسين": "Idgham mutajanisayn", "إدغام متقاربين": "Idgham mutaqaribayn", "قلقلة": "Qalqalah",
    "تظهر الألوان في عرض النص وفي صفحة الآية، ويمكن إيقافها من الإعدادات. صفحات المصحف المصوّرة تبقى كما طُبعت.": "The colours show in the text view, on the mushaf pages and on the verse screen, and can be turned off in Settings.",
    "المد الطبيعي (حركتان) غير ملوّن. ألوان التجويد مأخوذة من بيانات مشروع quran-tajweed المفتوحة.": "The natural madd (two counts) is not coloured. Tajweed colours come from the open quran-tajweed project data.",
    // qira'at
    "القراء العشرة ورواتهم": "The ten readers and their transmitters", "رموز يستعملها الكتاب": "Symbols the book uses", "أصول القراءات": "General principles",
    "كيف تقرأ الخلاف في آية؟": "How to read the differences in a verse", "المصحف في هذا التطبيق برواية حفص عن عاصم.": "The mushaf in this app follows the reading of Hafs from 'Asim.",
    "صور صفحات المصحف تحتاج تحديث «Android System WebView» من متجر Play. اضغط للإخفاء.": "The mushaf page images need an update of “Android System WebView” from the Play Store. Tap to hide.",
    // books
    "ابن كثير (ت #هـ)": "Ibn Kathir (d. # AH)", "تفسير ابن كثير": "Tafsir Ibn Kathir", "تفسير الطبري": "Tafsir al-Tabari", "ابن جرير الطبري (ت #هـ)": "Ibn Jarir al-Tabari (d. # AH)",
    "الطاهر ابن عاشور (ت #هـ)": "al-Tahir Ibn 'Ashur (d. # AH)", "القرطبي (ت #هـ)": "al-Qurtubi (d. # AH)", "عبد الرحمن السعدي (ت #هـ)": "Abd al-Rahman al-Sa'di (d. # AH)",
    "إعراب القرآن وبيانه": "I'rab al-Quran wa Bayanuh", "محيي الدين درويش (ت #هـ)": "Muhyi al-Din Darwish (d. # AH)", "الجدول في إعراب القرآن": "Al-Jadwal fi I'rab al-Quran",
    "محمود صافي (ت #هـ)": "Mahmoud Safi (d. # AH)", "أسباب النزول": "Asbab al-Nuzul", "أبو الحسن الواحدي (ت #هـ)": "Abu al-Hasan al-Wahidi (d. # AH)",
    "تحبير التيسير في القراءات العشر": "Tahbir al-Taysir fi al-Qira'at al-'Ashr", "ابن الجزري (ت #هـ)": "Ibn al-Jazari (d. # AH)", "المفردات في غريب القرآن": "Al-Mufradat fi Gharib al-Quran",
    "الراغب الأصفهاني (ت #هـ)": "al-Raghib al-Isfahani (d. # AH)", "الصحاح": "Al-Sihah", "الجوهري (ت #هـ)": "al-Jawhari (d. # AH)", "مقاييس اللغة": "Maqayis al-Lughah",
    "ابن فارس (ت #هـ)": "Ibn Faris (d. # AH)", "لسان العرب": "Lisan al-'Arab", "ابن منظور (ت #هـ)": "Ibn Manzur (d. # AH)", "أساس البلاغة": "Asas al-Balaghah", "الزمخشري (ت #هـ)": "al-Zamakhshari (d. # AH)",
    "التحرير والتنوير · الطاهر ابن عاشور (ت #هـ)": "Al-Tahrir wal-Tanwir · al-Tahir Ibn 'Ashur (d. # AH)",
    "عن السورة كلها": "About the whole surah", "إعراب الآيات #–# معًا": "Grammar of verses #–# together", "تفسير الآيات #–# معًا": "Tafsir of verses #–# together", "سبب نزول الآيات #–# معًا": "Revelation of verses #–# together",
    "لم يذكر ابن الجزري في هذه الآية خلافًا خاصًا بكلماتها. أما الأصول العامة (كالمد والإمالة والهمز) فتجدها في صفحة القراءات العشر.": "Ibn al-Jazari mentions no difference in the words of this verse. The general principles (madd, imalah, hamz) are on the ten qira'at page.",
    "القراء العشرة ورواتهم، ومعاني الرموز، والأصول العامة ‹": "The ten readers, their symbols and general principles ›", "دروس أحكام التجويد لرواية حفص ‹": "Tajweed lessons for the reading of Hafs ›",
    // toasts and statuses
    "جارٍ حفظ سورة @…": "Saving Surah @…", "تعذّر حفظ # آية، حاول مرة أخرى": "Couldn't save # verses, try again", "# من #": "# of #", "# من # آية ظاهرة": "# of # verses shown",
    "أنهيت ورد اليوم.": "You finished today's portion.", "أنهيت ورد اليوم، وأنت متقدم # صفحة.": "You finished today's portion and are # pages ahead.",
    "عليك # صفحة متأخرة من الأيام السابقة، وهي داخلة في ورد اليوم.": "You are # pages behind from earlier days; they are included in today's portion.",
    "ورد اليوم حوالي # صفحة.": "Today's portion is about # pages.", "انتهت مدة الخطة، والباقي # صفحة.": "The plan's time is over, # pages remain.",
    "أنهيت ورد اليوم. قرأت # من # صفحة.": "You finished today's portion. You have read # of # pages.", "أنهيت ورد اليوم، وأنت متقدم # صفحة. قرأت # من # صفحة.": "You finished today's portion and are # pages ahead. You have read # of # pages.",
    "عليك # صفحة متأخرة من الأيام السابقة، وهي داخلة في ورد اليوم. قرأت # من # صفحة.": "You are # pages behind from earlier days; they are included in today's portion. You have read # of # pages.",
    "انتهت مدة الخطة، والباقي # صفحة. قرأت # من # صفحة.": "The plan's time is over, # pages remain. You have read # of # pages.",
    "بدأتها في # يومًا وقرأت # صفحة.": "Planned for # days, # pages read.",
    "القبلة على #° من الشمال · المسافة إلى الكعبة # كم": "Qibla at #° from north · # km to the Kaaba", "الموقع: #، #": "Location: #, #",
    " · حرّك الهاتف على شكل # لمعايرة البوصلة": " · move the phone in a figure 8 to calibrate the compass",
    // qira'at page
    "من «تحبير التيسير في القراءات العشر» لابن الجزري (ت #هـ)": "From “Tahbir al-Taysir fi al-Qira'at al-'Ashr” by Ibn al-Jazari (d. # AH)",
    "أصل الكتاب «التيسير» لأبي عمرو الداني في القراءات السبع، وزاد عليه ابن الجزري القراءات الثلاث (أبا جعفر ويعقوب وخلفًا) وما يبدأ بقوله «قلت».": "The book is based on “al-Taysir” by Abu 'Amr al-Dani on the seven readings; Ibn al-Jazari added the other three (Abu Ja'far, Ya'qub and Khalaf) and the passages that begin “I say”.",
    "افتح أي آية (اضغط عليها ثم «تفسير وإعراب ومعاني») واختر تبويب «القراءات»، فيظهر كلام ابن الجزري عن كلماتها.": "Open any verse (tap it, then “Tafsir, grammar & meanings”) and choose the “Qira'at” tab to see what Ibn al-Jazari says about its words.",
    "نافع المدني": "Nafi' al-Madani", "قالون · ورش": "Qalun · Warsh", "ابن كثير المكي": "Ibn Kathir al-Makki", "البزي · قنبل": "Al-Bazzi · Qunbul", "أبو عمرو البصري": "Abu 'Amr al-Basri",
    "الدوري · السوسي": "Al-Duri · Al-Susi", "ابن عامر الشامي": "Ibn 'Amir al-Shami", "هشام · ابن ذكوان": "Hisham · Ibn Dhakwan", "عاصم الكوفي": "'Asim al-Kufi", "شعبة (أبو بكر) · حفص": "Shu'bah (Abu Bakr) · Hafs",
    "حمزة الكوفي": "Hamzah al-Kufi", "خلف · خلاد": "Khalaf · Khallad", "الكسائي الكوفي": "Al-Kisa'i al-Kufi", "أبو الحارث · الدوري": "Abu al-Harith · Al-Duri", "أبو جعفر المدني": "Abu Ja'far al-Madani",
    "ابن وردان · ابن جماز": "Ibn Wardan · Ibn Jammaz", "يعقوب الحضرمي": "Ya'qub al-Hadrami", "رويس · روح": "Ruways · Rawh", "خلف العاشر": "Khalaf al-'Ashir", "إسحاق · إدريس": "Ishaq · Idris",
    "الحرميان": "Al-Haramiyyan", "نافع وابن كثير": "Nafi' and Ibn Kathir", "المدنيان": "Al-Madaniyyan", "نافع وأبو جعفر": "Nafi' and Abu Ja'far", "البصريان": "Al-Basriyyan", "أبو عمرو ويعقوب": "Abu 'Amr and Ya'qub",
    "الكوفيون": "Al-Kufiyyun", "عاصم وحمزة والكسائي": "'Asim, Hamzah and al-Kisa'i", "الأخوان": "Al-Akhawan", "حمزة والكسائي": "Hamzah and al-Kisa'i", "الابنان": "Al-Ibnan", "ابن كثير وابن عامر": "Ibn Kathir and Ibn 'Amir",
    "أبو بكر": "Abu Bakr", "شعبة راوي عاصم": "Shu'bah, transmitter of 'Asim", "الباقون": "Al-Baqun", "بقية القراء العشرة غير من ذُكر": "The rest of the ten readers not named",
    // tajweed lessons (titles; the lessons themselves stay Arabic)
    "مقدمة": "Introduction", "النون الساكنة والتنوين": "Noon sakinah and tanween", "الإظهار الحلقي": "Izhar halqi", "الإدغام بغنة": "Idgham with ghunnah", "الإدغام بغير غنة": "Idgham without ghunnah",
    "الإقلاب": "Iqlab", "الإخفاء الحقيقي": "Ikhfa' haqiqi", "الميم الساكنة": "Meem sakinah", "الإخفاء الشفوي": "Ikhfa' shafawi", "الإدغام الشفوي": "Idgham shafawi", "الغنة": "Ghunnah", "المدود": "Madd (prolongation)",
    "المد المتصل (الواجب)": "Madd muttasil (obligatory)", "المد المنفصل (الجائز)": "Madd munfasil (permitted)", "المد العارض للسكون ومد اللين": "Madd 'arid and madd lin", "المد اللازم": "Madd lazim", "القلقلة": "Qalqalah",
    "همزة الوصل واللام الشمسية": "Hamzat al-wasl and lam shamsiyyah", "إدغام المتجانسين والمتقاربين": "Idgham of similar and close letters", "التفخيم والترقيق": "Heavy and light letters",
    "مواضع خاصة برواية حفص": "Special cases in Hafs", "علامات الوقف في المصحف": "Stopping signs in the mushaf",
    "رواه #": "Narrated by #",
    "الترجمة الإنجليزية": "English translation", "إخفاء الترجمة الإنجليزية": "Hide English translation",
    "استمع للكل": "Listen to all", "عدد مرات الذكر": "Times to say it", "الأصلي": "Original", "عدد آخر": "Other number", "تخصيص العدد": "Set the count", "إيقاف الاستماع": "Stop listening",
    "ثني الورقة": "Paper curl", "ملاحظتي": "My note", "مواقيت الصلاة": "Prayer times", "الصلاة القادمة": "Next prayer", "الفجر": "Fajr", "الشروق": "Sunrise", "الظهر": "Dhuhr", "العصر": "Asr", "المغرب": "Maghrib", "العشاء": "Isha", "طريقة الحساب": "Calculation method", "الجمهور": "Standard", "الحنفي": "Hanafi", "التذكيرات": "Reminders", "ورد الختمة اليومي": "Daily khatma portion", "اتجاه القبلة": "Qibla direction", "مواقيت الصلاة لهذا الموقع": "Prayer times for this location", "الترجمة": "Translation", "ملاحظة": "Note", "أضف ملاحظة": "Add a note", "تعديل ملاحظتي": "Edit my note", "مشاركة": "Share", "نص بالتشكيل": "Text with diacritics", "صورة بخط المصحف": "Image in mushaf script", "حذف": "Delete", "اكتب ملاحظتك…": "Write your note…", "حُفظت الملاحظة": "Note saved", "حُذفت الملاحظة": "Note deleted", "إخفاء الترجمة": "Hide translation", "السبحة": "Tasbih counter", "الهدف": "Target", "بلا حد": "No limit", "تصفير": "Reset", "سبّح": "Count", "أفقي بدون تأثير": "Sideways, no effect", "لون الصفحة": "Page colour", "اهتزاز عند الضغط على الأزرار والآيات": "Vibration on button and verse taps", "خفيف": "Light", "متوسط": "Medium", "قوي": "Strong", "انزلاق أفقي": "Sideways slide", "بدون": "None", "تكرار مقطع": "Repeat passage", "سرعة التلاوة": "Recitation speed",
    "تكرار مجموعة آيات · سورة @": "Repeat a group of verses · Surah @", "من الآية": "From verse", "إلى الآية": "To verse",
    "عدد مرات تكرار المجموعة": "Times to repeat the group", "رقم آية غير صحيح": "Not a valid verse number",
    "الترتيب": "Order", "كما في الكتاب": "As in the book", "الأقل تكرارًا": "Fewest repeats first", "الأكثر تكرارًا": "Most repeats first",
    "لا يوجد صوت عربي على الهاتف. ثبّت «الصوت العربي» من إعدادات تحويل النص إلى كلام": "The phone has no Arabic voice. Install the Arabic voice in the text-to-speech settings",
    "تعذّر تشغيل الصوت": "Couldn't play the audio",
    "البحث بالشروط": "Search with conditions", "الآيات التي فيها الكلمتان معًا": "verses that have both words",
    "أيٌّ منهما، ويصلح": "either one; you can also write", "مكان OR": "instead of OR", "فيها الجنة وليس فيها الأنهار": "has الجنة but not الأنهار", "الكلمات متتالية بنفس الترتيب": "the words together, in this order",
    "الأقواس لتجميع الشروط": "brackets group conditions", "أو": "or",
    "المكافآت": "Rewards", "مكافأة جديدة": "New reward", "أيام متتالية": "Days in a row", "أيام التزام": "Days kept", "ختمات": "Khatmas",
    "أول ورد": "First portion", "أتممت ورد اليوم لأول مرة": "You finished a day's portion for the first time",
    "ثلاثة أيام": "Three days", "التزمت بالورد # أيام متتالية": "Kept the portion # days in a row", "أسبوع كامل": "A full week",
    "أسبوعان": "Two weeks", "التزمت بالورد # يومًا متتالية": "Kept the portion # days in a row", "شهر من الالتزام": "A month of commitment",
    "أول ختمة": "First khatma", "أتممت ختمة كاملة": "You completed a khatma", "ثلاث ختمات": "Three khatmas", "أتممت # ختمات": "You completed # khatmas",
    "خمس ختمات": "Five khatmas", "عشر ختمات": "Ten khatmas",
    "البلاغة": "Rhetoric (balagha)", "المتشابهات": "Similar verses", "بلاغة الآيات #–# معًا": "Rhetoric of verses #–# together",
    "لم يذكر الكتاب فنونًا بلاغية خاصة بهذه الآية.": "The book notes no rhetorical devices for this verse.",
    "آيات يكثر الالتباس بينها وبين هذه الآية في الحفظ. الكلمات المختلفة مظللة.": "Verses often confused with this one when reciting from memory. The words that differ are highlighted.",
    "لا توجد في هذه القائمة آيات متشابهة مع هذه الآية.": "This list has no verses similar to this one.",
    "سورة @ · الآيات #–#": "Surah @ · verses #–#",
    "المصدر: بيانات Quran_Mutashabihat_Data (رخصة CC0) المبنية على عمل القارئ إدريس العاصم، وتشمل أكثر المتشابهات التي يخطئ فيها الحفاظ وليست حصرًا لكل المتشابهات. نص الآيات من المصحف نفسه.": "Source: Quran_Mutashabihat_Data (CC0), based on the work of Qari Idrees al-Asim. It covers the similar verses huffaz most often confuse, not every one. The verse text is the app's own mushaf text.",
    "طبعة الحرمين: صفحات نسخة دار مصر للطباعة (سعيد جودة السحار) المرفوعة. البحث ينقل إلى صفحة الآية نفسها ويظللها بالأصفر فوق الصورة.": "Haramain print: page scans of the Dar Misr edition (Sa'id Gouda al-Sahhar). Search opens the verse's own page and highlights it in yellow over the image."
  };
  var CITY = { "القاهرة": "Cairo", "الجيزة": "Giza", "الإسكندرية": "Alexandria", "المنصورة": "Mansoura", "طنطا": "Tanta", "الزقازيق": "Zagazig", "بنها": "Banha", "شبين الكوم": "Shebin El-Kom",
    "دمنهور": "Damanhur", "كفر الشيخ": "Kafr El-Sheikh", "دمياط": "Damietta", "بورسعيد": "Port Said", "الإسماعيلية": "Ismailia", "السويس": "Suez", "الفيوم": "Faiyum", "بني سويف": "Beni Suef",
    "المنيا": "Minya", "أسيوط": "Asyut", "سوهاج": "Sohag", "قنا": "Qena", "الأقصر": "Luxor", "أسوان": "Aswan", "الغردقة": "Hurghada", "شرم الشيخ": "Sharm El-Sheikh", "مرسى مطروح": "Marsa Matruh",
    "العريش": "Arish", "مكة المكرمة": "Makkah", "المدينة المنورة": "Madinah", "الرياض": "Riyadh", "جدة": "Jeddah", "الدمام": "Dammam", "دبي": "Dubai", "أبوظبي": "Abu Dhabi", "الدوحة": "Doha",
    "الكويت": "Kuwait", "المنامة": "Manama", "مسقط": "Muscat", "صنعاء": "Sana'a", "عمّان": "Amman", "القدس": "Jerusalem", "دمشق": "Damascus", "بيروت": "Beirut", "بغداد": "Baghdad",
    "الخرطوم": "Khartoum", "طرابلس": "Tripoli", "تونس": "Tunis", "الجزائر": "Algiers", "الرباط": "Rabat", "الدار البيضاء": "Casablanca", "نواكشوط": "Nouakchott", "إسطنبول": "Istanbul",
    "لندن": "London", "باريس": "Paris", "برلين": "Berlin", "روما": "Rome", "نيويورك": "New York", "تورنتو": "Toronto", "كوالالمبور": "Kuala Lumpur", "جاكرتا": "Jakarta", "كراتشي": "Karachi" };
  var D38 = { "مواضيع القرآن": "Quran topics", "خريطة الحفظ": "Memorisation map", "ختمة العيلة": "Family khatma", "الختمة الجماعية": "Group khatma",
    "# صفحة محفوظة": "# pages memorised", "من # صفحة": "of # pages", "محفوظة ومراجَعة (#)": "Memorised and revised (#)", "محتاجة مراجعة (#)": "Needs revision (#)",
    "محفوظة جزئيًا (#)": "Partly memorised (#)", "لسه (#)": "Not yet (#)", "سجّل السور اللي حفظتها": "Log the surahs you memorised",
    "كل مربع صفحة، اضغط عليه يفتحها. «محتاجة مراجعة» لو آخر مراجعة من أكتر من # يوم أو نتيجة الاختبار أقل من #٪.": "Each square is a page; tap to open it. \u201cNeeds revision\u201d means last revised over # days ago or a test score under #%.",
    "#/#": "#/#", "# فرد · اضغط على الجزء لما يخلص": "# members · tap a juz when it is done", "# من #": "# of #", "أضف": "Add", "اسم فرد من العيلة": "Family member's name",
    "وزّع الأجزاء بالتساوي": "Split the juz evenly", "شارك التقدم": "Share progress", "استيراد تحديث": "Import update", "ختمة جديدة": "New khatma",
    "التطبيق مش بيبعت حاجة على الإنترنت. لما حد يخلص جزء يضغط عليه ويشارك التقدم في جروب العيلة، والباقيين يستوردوا الكود.": "The app sends nothing online. When someone finishes a juz they tap it and share progress in the family group; the others import the code.",
    "اكتب الاسم الأول": "Type the name first", "أضف أفراد العيلة الأول": "Add family members first", "اتحدثت الختمة": "Khatma updated", "الكود ده مش مفهوم": "That code isn't recognised",
    "الصق رسالة التحديث أو الكود هنا": "Paste the update message or code here", "نبدأ ختمة جديدة بنفس الأفراد؟": "Start a new khatma with the same members?", "ختمتوا القرآن، تقبّل الله منكم": "You completed the Quran, may Allah accept it from you",
    "الإيمان": "Faith", "العبادات": "Worship", "الأخلاق": "Character", "الأسرة والمعاملات": "Family & dealings", "الكون والآيات": "Creation & signs",
    "التوحيد": "Oneness of Allah", "الملائكة": "Angels", "الرسل والأنبياء": "Messengers & prophets", "القرآن": "The Quran", "اليوم الآخر والقيامة": "The Last Day", "الجنة": "Paradise", "النار وجهنم": "Hellfire", "القدر والمشيئة": "Decree & will",
    "الصلاة": "Prayer", "الزكاة": "Zakat", "الصيام": "Fasting", "الحج والعمرة": "Hajj & Umrah", "الدعاء": "Supplication", "ذكر الله": "Remembering Allah", "الإنفاق والصدقة": "Spending & charity", "الجهاد": "Striving (jihad)", "التوبة": "Repentance", "الاستغفار": "Seeking forgiveness",
    "الصبر": "Patience", "الشكر": "Gratitude", "التقوى": "God-consciousness", "التوكل على الله": "Trust in Allah", "الصدق": "Truthfulness", "العدل": "Justice", "الوفاء بالعهد": "Keeping promises", "العفو والإحسان": "Pardon & kindness", "الوالدين": "Parents", "الكبر والتكبر": "Arrogance", "الكذب والتكذيب": "Lying & denial", "الظلم": "Injustice",
    "الزواج": "Marriage", "الطلاق": "Divorce", "اليتامى": "Orphans", "الربا": "Usury (riba)", "البيع والتجارة": "Trade", "الوفاء بالكيل والميزان": "Fair measure & weight",
    "السماء": "The sky", "الشمس والقمر": "Sun & moon", "الليل والنهار": "Night & day", "المطر والماء": "Rain & water", "البحار": "Seas", "الجبال": "Mountains", "خلق الإنسان": "Creation of man",
    "الفهرس متولّد من جذور الكلمات ونص المصحف اللي في التطبيق نفسه، فممكن يفوته آية بتتكلم عن الموضوع من غير ما تذكر لفظه.": "The index is generated from the word roots and mushaf text inside the app, so it may miss a verse that speaks of a topic without using its word." };
  var D39 = { "اختبار الحفظ": "Memorisation test", "افتكرتها": "I remembered", "خلصت": "Done", "بسمع…": "Listening…", "افتكرت # · نسيت #": "Remembered # · forgot #",
    "كلمات صح # · غلط #": "Correct words # · wrong #", "نتيجة التسميع": "Recitation result", "آية": "verses", "كلمة صح": "correct words", "كلمة غلط": "wrong words",
    "الكلمات اللي اتقالت غلط أو اتنست:": "Words said wrong or skipped:", "ما شاء الله، مفيش ولا كلمة غلط.": "Masha'Allah, not a single wrong word.",
    "التعرّف على الكلام ممكن يغلط في التلاوة المجوّدة، فلو كلمة متعلّمة وانت متأكد منها، متقلقش.": "Speech recognition can mishear tajweed recitation, so don't worry about a marked word you are sure of.",
    "تم": "Done", "إحصائية التسميع بالصوت": "Voice recitation stats", "# مرة · # كلمة · الدقة #٪": "# sessions · # words · #% accurate", "# آية · # غلط": "# verses · # wrong",
    "اختبرني على صفحات طبعة الملك فهد": "Test me on the King Fahd pages", "اختبرني على صفحات طبعة الشمرلي": "Test me on the Shamarly pages", "اختبرني على صفحات طبعة الحرمين": "Test me on the Haramain pages", "اختبرني على صفحات المصحف": "Test me on the mushaf pages",
    "محتاج إذن الميكروفون عشان التسميع": "Microphone permission is needed to recite", "الموبايل مفيهوش خدمة التعرّف على الكلام": "This phone has no speech recognition service",
    "التسميع بالصوت شغال في التطبيق على الموبايل بس": "Voice recitation works only in the phone app", "اكشف آية واحدة على الأقل الأول": "Reveal at least one verse first" };
  for (var c39 in D39) if (D[c39] === undefined) D[c39] = D39[c39];
  for (var c38 in D38) if (D[c38] === undefined) D[c38] = D38[c38];
  for (var c in CITY) D[c] = CITY[c];

  var AR_DIGITS = /[٠-٩]/g;
  function latin(s) { return s.replace(AR_DIGITS, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }); }
  var names = null, nameIdx = {};
  function surahNames() {
    if (names || !window.QURAN) return names;
    names = QURAN.s.map(function (x) { return x[0]; });
    names.forEach(function (n, i) { nameIdx[n] = i; });
    return names;
  }
  var juzRe = new RegExp("الجزء (" + JUZ_AR.slice().sort(function (a, b) { return b.length - a.length; }).join("|") + ")(?=$|[\\s·)،])", "g");
  var surahRe = null;
  // Quran or dua text (several vowel marks) is never translated.
  var HARAKAT = /[ً-ْٰۡ]/g;

  function tr(text) {
    var t = text.replace(/\s+/g, " ").trim();
    if (!t || !/[؀-ۿ]/.test(t)) return null;
    if ((t.match(HARAKAT) || []).length >= 3) return null;
    if (D[t] !== undefined) return D[t];
    if (/^[٠-٩]+$/.test(t)) return latin(t);
    // Clock times and short dates written by the app (prayer times, the imsakiya).
    var tm = t.match(/^([٠-٩]{1,2}:[٠-٩]{2})(?: ([صم]))?$/); if (tm) return latin(tm[1]) + (tm[2] ? (tm[2] === "ص" ? " AM" : " PM") : "");
    var dm = t.replace(/\u200f/g, "").match(/^(الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)، ([٠-٩]+)\/([٠-٩]+)$/);
    if (dm) return WD[dm[1]] + " " + latin(dm[2]) + "/" + latin(dm[3]);
    var vals = [];
    surahNames();
    if (names && !surahRe) surahRe = new RegExp("(^|سورة |: |\\()(" + names.slice().sort(function (a, b) { return b.length - a.length; }).join("|") + ")(?=$|[\\s)·،…»:.])", "g");
    // Placeholders in the order they appear in the text.
    var marks = [];
    var k = t.replace(juzRe, function (m, j, off) { marks.push([off, "%", JUZ_AR.indexOf(j) + 1]); return "الجزء \u0002"; });
    if (surahRe) k = k.replace(surahRe, function (m, pre, n, off) { marks.push([off + pre.length, "@", SURAH_EN[nameIdx[n]]]); return pre + "\u0003"; });
    k = k.replace(/[٠-٩0-9]+(?:[.,٫][٠-٩0-9]+)?/g, function (m, off) { marks.push([off, "#", latin(m).replace("٫", ".")]); return "\u0001"; });
    // Positions above are in shifting strings; the order of appearance is what matters, and each kind keeps its own order.
    var byKind = { "#": [], "@": [], "%": [] };
    marks.forEach(function (m) { byKind[m[1]].push(m[2]); });
    k = k.replace(/\u0001/g, "#").replace(/\u0002/g, "%").replace(/\u0003/g, "@");
    var v = D[k];
    // Text that already ends in English (a surah's English name) keeps that part.
    if (v === undefined) { var m = k.match(/^(.*?)( · [^\u0600-\u06FF]+)$/); if (m && D[m[1]] !== undefined) v = D[m[1]] + m[2]; }
    if (v === undefined) return null;
    var it = { "#": 0, "@": 0, "%": 0 };
    return v.replace(/[#@%]/g, function (p) { var x = byKind[p][it[p]++]; return x === undefined ? p : x; });
  }
  window.T = function (s) { var r = tr(s); return r === null ? s : r; };

  var SKIP = ".quran,.ayah,.basmala,.book-text,.z-text,.z-pre,.z-fadl,.z-note,.z-src,.ay-text,.result .txt,.page-cap .txt,.tr-en,.learn-card p,.tj-words,.tj-ex,.ayah-no";
  function fixText(n) {
    var el = n.parentElement;
    if (!el || el.closest(SKIP)) return;
    if (n.__tr === n.nodeValue) return;
    var r = tr(n.nodeValue);
    if (r !== null) { var lead = n.nodeValue.match(/^\s*/)[0], tail = n.nodeValue.match(/\s*$/)[0]; n.nodeValue = lead + r + tail; }
    n.__tr = n.nodeValue;
  }
  function fixAttrs(el) {
    ["aria-label", "placeholder", "title", "alt"].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a); if (!v) return;
      var r = tr(v); if (r !== null) el.setAttribute(a, r);
    });
  }
  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1) return;
    if (root.closest && root.closest(SKIP)) return;
    fixAttrs(root);
    root.querySelectorAll("[aria-label],[placeholder],[title],[alt]").forEach(fixAttrs);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) fixText(n);
  }
  function start() {
    walk(document.body);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "characterData") fixText(m.target);
        else if (m.type === "attributes") fixAttrs(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "placeholder", "title"] });
    var t = document.getElementById("title");
    document.title = "The Noble Quran";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
