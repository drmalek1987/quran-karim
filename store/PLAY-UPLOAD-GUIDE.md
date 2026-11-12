# دليل رفع «القرآن الكريم» على Google Play خطوة بخطوة

حساب شخصي (Personal)، مش تاجر (non-trader). النسخة: 5.20 (versionCode 68)، ملف `quran-karim-v5.20-play.aab`.
اتراجع على قواعد جوجل يوم 12 نوفمبر 2026 (المصادر في `plans/play-store-plan.md`).

**العلامات:**
- 👤 = خطوة **إنت لازم تعملها بنفسك** (باسوورد، هوية، فلوس، موافقة على شروط، زرار Submit). أنا مبعملهاش.
- 📁 = الملف اللي هتنسخ منه أو ترفعه من المشروع.
- أسماء القوايم مكتوبة بالإنجليزي زي ما هي في Play Console. لو مش لاقي قايمة، افتح **Dashboard**: هتلاقي كل المهام في
  «Set up your app» وكل مهمة بتفتح الصفحة بتاعتها على طول.

---

## المرحلة 0: حاجات تتعمل مرة واحدة قبل أي حاجة

1. 👤 تأكد إن حسابك متفعّل: Play Console › **Home**. لو فيه رسالة تأكيد هوية أو تأكيد موبايل (device verification)، كمّلها
   من تطبيق Play Console على موبايلك.
2. 👤 اعمل إيميل دعم مخصّص للتطبيق (مثلًا quran.karim.app@…). **الإيميل ده هيبان للناس** في صفحة التطبيق.
3. 👤 اعمل مفتاح الرفع (upload key). افتح PowerShell في فولدر المشروع واكتب:
   ```
   & "C:\Program Files\Microsoft\jdk-17.0.21.21-hotspot\bin\keytool.exe" -genkeypair -v -keystore keys\upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   هيسألك على باسوورد وشوية بيانات (اسمك عادي). **الباسوورد متكتبهوش في الشات ولا في أي ملف في git.**
4. 👤 احفظ نسخة من `keys\upload.jks` والباسوورد برّه الكمبيوتر (فلاشة + مدير باسووردات). لو ضاعوا، جوجل تقدر تغيّر مفتاح
   الرفع، بس بياخد أيام.
5. 👤 اكتب الباسوورد في ملف `keys\upload-key.txt` في سطر واحد: `password: <الباسوورد>` (فولدر `keys/` متجاهَل في git)،
   أو حطه في متغير `QK_UPLOAD_PASS` قبل البناء.
6. ابني الـ AAB الموقّع (PowerShell في فولدر المشروع):
   ```
   $env:PLAY="1"; .venv\Scripts\python.exe -I build-win.py; .venv\Scripts\python.exe -I build-aab-win.py
   ```
   لازم يطبع `signed with the upload key` وفي الآخر اسم الملف `quran-karim-v5.20-play.aab`.
   📁 الناتج: `quran-karim-v5.20-play.aab` (حوالي 38 ميجا).
7. 👤 بدّل كلمة `CONTACT_EMAIL` في 📁 `docs/privacy-policy.html` (مكانين) بإيميل الدعم، واعمل commit و push
   (أو قولّي الإيميل وأنا أعملها).
8. 👤 شغّل GitHub Pages: github.com › الريبو `quran-karim` › **Settings** › **Pages** › Source = **Deploy from a branch** ›
   Branch = **main** / folder **/docs** › **Save**.
9. افتح الرابط ده واتأكد إنه بيفتح: `https://drmalek1987.github.io/quran-karim/privacy-policy.html` (ممكن ياخد دقيقتين).

## المرحلة 1: إنشاء التطبيق

10. Play Console › **Home** › **Create app**.
11. App name: `القرآن الكريم - مصحف وتفسير` 📁 `store/listing-play.md`.
12. Default language: **Arabic – ar**.
13. App or game: **App**. Free or paid: **Free** (المجاني مينفعش يتحوّل لمدفوع بعد كده).
14. 👤 علّم على الإقرارات (Developer Program Policies و US export laws) واضغط **Create app**.

## المرحلة 2: صفحة المتجر (Store listing)

15. القايمة الشمال: **Grow users** › **Store presence** › **Main store listing**.
16. انسخ App name و Short description و Full description (العربي) من 📁 `store/listing-play.md`.
17. App icon: ارفع 📁 `store/play/icon-512.png`.
18. Feature graphic: ارفع 📁 `store/play/feature-graphic-1024x500.png`.
19. Phone screenshots: ارفع الـ 7 صور 📁 `store/play/phone-1-home.png` … `phone-7-azkar.png` بالترتيب.
20. 7-inch و 10-inch tablet screenshots: ارفع الـ 4 صور 📁 `store/play/tablet-*.png` في الاتنين (اختياري بس بيحسّن الظهور).
21. **Save**.
22. نفس الصفحة › **Manage translations** › **Add translations** › English (United States) › انسخ النصوص الإنجليزي من
    📁 `store/listing-play.md` › **Save**.
23. **Grow users** › **Store presence** › **Store settings** › App category: **Books & Reference** › Tags: اختار لحد 5.
24. نفس الصفحة › **App support** (Store listing contact details): Email = إيميل الدعم، Website = رابط الريبو (اختياري)،
    Phone = سيبه فاضي › **Save**.

## المرحلة 3: محتوى التطبيق (App content)

كل ده في **Policy and programs** › **App content** (أو من Dashboard). الإجابات كلها في 📁 `store/listing-play.md` قسم 2.

25. **Privacy policy** › الصق `https://drmalek1987.github.io/quran-karim/privacy-policy.html` › **Save**.
26. **App access** › **All functionality is available without special access** › **Save**.
27. **Ads** › **No, my app does not contain ads** › **Save**.
28. **Content rating** › **Start questionnaire** › الإيميل + Category **Reference, News, or Educational** › جاوب **No** على كل
    الأسئلة › **Save** › **Submit** (👤 ده تقديم الاستبيان مش التطبيق) — النتيجة المتوقعة Everyone / PEGI 3.
29. **Target audience and content** › اختار **13–15** و **16–17** و **18 and over** بس › «Appeals to children» = **No** › **Save**.
30. **Data safety** › **Start** › املاه خانة خانة من 📁 `store/data-safety.md` (قسم «Field by field») › **Preview** › **Save**.
31. **Government apps** › **No**.
32. **Financial features** › **My app doesn't provide any financial features**.
33. **Health apps** › مفيش ولا اختيار › **Save**.
34. **News apps** › **No**.
35. **Advertising ID** › **No** (لو ظهرت).
36. لو ظهر تنبيه **Sensitive app permissions / Permissions declaration** بعد رفع الـ AAB: انسخ النص المناسب من
    📁 `store/listing-play.md` (SCHEDULE_EXACT_ALARM / RECORD_AUDIO / Location). لو طلب فيديو، صوّر شاشة الموبايل 30 ثانية
    (تفعيل جرس صلاة › التنبيه) وارفعه Unlisted على YouTube.

## المرحلة 4: الدول والسعر

37. **Test and release** › **Production** › **Countries / regions** › **Add countries / regions** › اختار كل الدول (أو اللي
    تحبها) › **Add**. (السعر اتحدد Free في خطوة 13.)

## المرحلة 5: Play App Signing وأول رفع (Internal testing)

38. **Test and release** › **Testing** › **Internal testing** › **Create new release**.
39. لو سألك عن **App signing**: اختار **Use Google-generated key** (الموصى بيه) › **Continue**. ده Play App Signing:
    جوجل بتمسك مفتاح التوقيع، وإنت بتوقّع بمفتاح الرفع بس.
40. **Upload** › اختار 📁 `quran-karim-v5.20-play.aab`.
    - لو قال إن `com.quran.karim` مستخدم: وقف وكلّمني، لازم نغيّر الـ package قبل أول رفع.
41. Release name: `5.20` · Release notes: انسخ من 📁 `store/listing-play.md` قسم 3 › **Next**.
42. اقرا التحذيرات (warnings عادي، errors لأ) › 👤 **Save and publish** / **Start rollout to Internal testing**.
43. **Testers** › أنشئ قايمة إيميلات (إنت + 2 أو 3) › انسخ **Copy link** وافتحه من الموبايل › **Accept invite** › نزّل من بلاي.
44. جرّب على موبايلك: الطبعات، التفسير، التسميع بالصوت (تنزيل النموذج)، جرس الصلاة، القبلة. ده نفس اللي هيوصل للناس.
45. افتح **Monitor and improve** › **Pre-launch report** بعد ساعة أو اتنين واتأكد مفيش crash.

## المرحلة 6: الاختبار المغلق (إجباري للحسابات الشخصية) — 12 مختبر × 14 يوم متواصلين

46. **Test and release** › **Testing** › **Closed testing** › **Create track** (أو استخدم Alpha) › **Manage track**.
47. **Testers** › **Create email list** › ضيف إيميلات Gmail لـ **15–20 شخص** (أكتر من 12 احتياطي، لأن اللي يخرج قبل 14 يوم
    مبيتحسبش) › **Save**.
48. **Countries / regions** للـ track ده › اختار الدول اللي فيها المختبرين.
49. **Create new release** › **Add from library** › اختار 5.20 (أو ارفع الـ AAB تاني) › **Next** › 👤 **Start rollout to Closed testing**.
50. لو ظهر **Send changes for review** في **Publishing overview**: 👤 اضغطه. أول closed test بيتراجع (ساعات لأيام).
51. بعد الموافقة: **Testers** › **Copy link** › ابعته للمختبرين.
52. قول لكل مختبر بالظبط: «افتح اللينك من الموبايل بنفس حساب Gmail اللي اديتهولي › **Become a tester** › نزّل التطبيق من
    بلاي › **متخرجش من الاختبار ومتمسحش التطبيق 14 يوم**، وافتحه كل يوم شوية».
53. ازاي تلاقي 12+ مختبر: العيلة والأصحاب، جروب المسجد/الحلقة، زمايل الشغل، جروب واتساب لمحفّظين. ابعت لهم تذكير يومي
    قصير (آية اليوم مثلًا) عشان يفتحوه.
54. اجمع ملاحظاتهم (واتساب أو **Testing feedback** في Play Console)، واكتبها في ملف، وارفع تحديث أو اتنين خلال الـ 14 يوم
    (versionCode 69، 70…) — جوجل بتسأل إيه اللي غيّرته من الاختبار.
55. تابع العدد: **Closed testing** › الـ track › **Testers** بيظهر عدد اللي «opted in». لازم يفضل ≥ 12 طول الـ 14 يوم.

## المرحلة 7: طلب الإنتاج (Apply for production)

56. بعد 14 يوم كاملين وفيه ≥ 12 مختبر: **Dashboard** › **Apply for production**.
57. الجزء 1 «About your closed test»، الجزء 2 «About your app»، الجزء 3 «Production readiness»: جاوب من
    📁 `store/listing-play.md` قسم 5 بعد ما تعدّله بالواقع (ملاحظات المختبرين الحقيقية). اضغط **Next** بعد كل جزء.
58. 👤 **Apply**. الرد عادة خلال 7 أيام على إيميل الحساب.
59. لو اترفض لـ «insufficient testing»: كمّل الاختبار المغلق مع نفس المختبرين (وزوّد تفاعلهم) وقدّم تاني.

## المرحلة 8: النشر للكل

60. بعد الموافقة: **Test and release** › **Production** › **Create new release** › **Add from library** › آخر نسخة اختبرتها.
61. Release notes من 📁 `store/listing-play.md` › **Next**.
62. اختار **Staged rollout** وابدأ بـ **20%** (لو متاح).
63. 👤 **Start rollout to Production**، وبعدين **Publishing overview** › 👤 **Send changes for review**.
64. المراجعة من يوم لأسبوع. بعد ما ينزل: تابع **Android vitals** يومين، ولو مفيش مشاكل زوّد لـ 50% ثم **100%**.

## لو اترفض (أشهر الأسباب لتطبيق قرآن/إسلامي ولتطبيقنا)

| السبب في الإيميل | يعني إيه | تعمل إيه |
|---|---|---|
| Intellectual property / impersonation | اسم أو أيقونة شبه جهة رسمية، أو محتوى من غير إذن | متكتبش «المجمع» أو «الرسمي» في الاسم؛ النسخة دي شايلة الحرمين والأذان ودرويش والتحرير. ابعت لي الإيميل |
| Device and Network Abuse | تحميل كود من برّه بلاي | الـ .so جوه الـ AAB؛ اللي بيتحمّل بيانات بس. رد بنص «Notes for the reviewer» |
| Exact alarm / permissions | إذن من غير سبب واضح | انسخ نص SCHEDULE_EXACT_ALARM وفيديو الجرس |
| User data / prominent disclosure | الميكروفون أو التبرّع بالصوت | الموافقة موجودة قبل أي تسجيل؛ ابعت سكرين شوت شاشة الموافقة |
| Data safety mismatch | الاستمارة مش زي السياسة | راجع 📁 `store/data-safety.md` والسياسة |
| Metadata | كلام دعائي («الأفضل»، «#1»، «مجاني») | النصوص الحالية نضيفة؛ متضيفش حاجة زي كده |
| Broken functionality | حاجة مبتشتغلش عند المراجع | اتأكد إن الطبعة الافتراضية بتتنزّل والنت شغال |

بعد ما تصلّح: 👤 **Policy status** › الإيميل › **Appeal** أو ارفع نسخة جديدة بـ versionCode أكبر.

## كل تحديث بعد كده
1. زوّد `versionCode` و `versionName` في `android/AndroidManifest.xml` + النص في `web/index.html` + كاش `web/sw.js`.
2. QA كامل، بعدين `PLAY=1` build-win.py + build-aab-win.py.
3. ارفع الـ AAB في نفس الـ track (اختبار أو إنتاج). لو وصلك إذن لمحتوى (الحرمين/الأذان/درويش/التحرير): ابني بـ
   `$env:PLAY_KEEP="adhan"` (مثلًا) وحدّث الوصف وData safety لو اتغيّر حاجة.
