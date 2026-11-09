# Quran Karim: تقرير كل اللي اتعمل (لحد 2026-11-09، آخر commit 0ade640)

**الأهداف:** (1) تطبيق قرآن شبه كامل offline. (2) التعرّف على التلاوة >95% لأي قارئ، والسرعة (latency) مهمة زي الدقة.
**آخر نسخة:** `quran-karim-v5.19b.apk` (versionCode 67, sw quran-v62, signer 7d8b31d2) — مبنية ومتجرّبة، **لسه ما اتسطّبتش على الموبايل ولا اتعملها GitHub release**.
**الـ QA الحالي:** ui.js الأربع طبعات 0 FAIL (kfgqpc 286, harmain 286, kfold 280, shamarly 280) · data.py 28/0.

## التاريخ بالنسخ
| النسخة | اللي اتعمل |
|---|---|
| 1.0–3.x (الحساب القديم، cloud) | نص quranenc Uthmani + بحث Tanzil، الطبعات: King Fahd (افتراضي)، الشمرلي، الحرمين، النص. الصفحات scans بتتنزّل zips من branch `editions`. تفسير/إعراب/معاجم، أذكار، أذان، قبلة، widgets. |
| 4.0–4.1 | ألوان التجويد على صفحات King Fahd والشمرلي؛ تنزيل الطبعات بـ resume. |
| 4.5–4.6 | موديل NVIDIA FastConformer على الموبايل (int8 ONNX، native ORT)، اختبار الحفظ بالصوت، طبعة King Fahd القديمة (kfold)، الهامش الموضوعي. |
| 4.9 | التبرّع بالصوت v2 (relay HMAC على HF Space، FLAC، رفع batch) — مقفول افتراضي من 5.11. |
| 5.0–5.3 | P1a: مطابقة التلاوة بالـ alignment (verify 86.8→94.5%)، التعرّف على الآية من أي مكان (rLocal/quranLocate)، قلب الصفحة مع القراية. |
| 5.7 | P1b: CTC check على log-probs (bench 94.7→96.9%). |
| 5.8–5.9.1 | توفير 132 MB (حذف أجزاء الموديل بعد الدمج)؛ موديل v2 (fine-tune P3 L2)؛ تنزيل موازي 4 ranges. |
| 5.11 | G1–G9: إعدادات أوضح، welcome + موافقة الموديل والخصوصية، ملء الشاشة الناعم، قائمة «المزيد» بمجموعات، شاشة إحصائيات واحدة، hub الحفظ (اختبار، خريطة، متابعة، قلب تلقائي)، متابعة التلاوة بالـ partials، QA على أجهزة كتير (Maestro). |
| 5.12–5.13 | تصليحات من تجربة الموبايل (149 ms لكل decode)؛ مايك دايم في الرئيسية؛ «المراجعة» (اختبرني، بالترتيب/عشوائي). |
| 5.14 | المراجعة العشوائية بمواضع، إحصائيات، تحسينات طبعة الحرمين. |
| 5.15 (Sprint A) | S2 «ركّز على أخطائي»، S1 المراجعة الذكية (تكرار متباعد + ورد يومي)، S7 كارت «النهارده»، 5.15b/c ملاحظاتك. |
| 5.16 | U1–U8 (اختبرني للسور المستحقة، الورد بالسرد/عشوائي، حلقة الهدف…)، U3/U4 الكشف كلمة كلمة وفتح الموضع اللي بعده فورًا. |
| 5.16d (Sprint B) | موديل pack v3 = L2 + Z1 (115 MB بدل 132، نفس الدقة بالظبط)؛ Z2 int4 اترفض (أبطأ 19–63% على الموبايل)؛ S6 «مش متأكد» (أصفر بدل أحمر). |
| 5.17 / 5.17b (Sprint C) | S3 اختبار المتشابهات، S5 التلقين (اسمع، اقرا، سمّع)، S8 تنزيل صوت سورة/جزء + مؤقت نوم. GitHub release v5.17. |
| 5.18 (Sprint D) | S9 معنى الكلمة بضغطة طويلة، S10 تذكير النسخة الاحتياطية، S11 المحفّظ والطالب (كود QK2). GitHub release v5.18. |
| 5.19 | معنى الكلمة على صفحات المصحف: word boxes مقاسة بالظبط لـ King Fahd (gate 59–60/60) والحرمين (60/60، 77,426 كلمة)؛ تصليح مستطيلات الآيات على دواير نهاية الآية في كتاب King Fahd كله. |
| 5.19b | bug: اختبار الحفظ كان بيقلب بعد آخر صفحة قرآن لصفحات الدعاء (الحرمين 541→542)، واتصلّح. ui.js بقى بيراعي الطبعة (أرقام الصفحات، `'\b'`، 2:255 على صفحتين في الحرمين)، والـ flake بتاع المتشابهات اتشال. |

## أرقام التعرّف (ASR)
- bench (373 clip نضيف): 86.8% → 5.0 94.5% → 5.7 96.9% (piece-by-piece). P0b held-out: قرّاء جداد 94.0، هواة 96.6، **الدوشة SNR 20/10/5 = 94.2/87.6/81.1 ← أكبر فجوة باقية لهدف الـ 95%**.
- P3 L2 (شغال دلوقتي في pack v3): ALL verify 83.3→87.8، noisy +4.1/+2.6/+1.6.
- G10 (تدريب على الدوشة والصوت الواطي والسرعة): run 1 مات بـ OOM واتصلّح (PADCAP)، run 2: «no step passed the proxy gate» ← **الوصفة محتاجة تتفكّر من الأول**.

## اللي لسه
(5.19b: اتجرّبت على الموبايل ✓ و GitHub release ✓ 2026-11-09)
**الخطة الموحّدة: `plans/W-track-plan.md` (من الأسهل للأصعب، مستنية كلمة المستخدم للبدء):**
0. تسجيل ✓ · 1. ورقة القرارات (S12، G8، Play، iOS) · 2. إذن الحرمين: مسودة خطاب + check PLAY=1
3. W1+W2 تصليحات سهلة (redraw بعد wbNeed، الضغط على الآية بالـ boxes) · 4. W0 أداة القياس geo_check.js
5. W3 مربعات الإخفاء والكشف من word boxes · 6. W4 القلب على آخر كلمة بالظبط
7. W5 word boxes لـ kfold والشمرلي ← release 5.20 · 8. W6 مستطيلات الآيات من الـ boxes
9. G10 rethink (تشخيص، بعدين دوشة on-the-fly على labels نضيفة) ← release 5.21

Session prompt للجلسة الجاية: `plans/5.20-session-prompt.md`.

---

# تفاصيل الشغل من G1 لحد دلوقتي (2026-11-06 → 2026-11-09)

المصادر: `plans/5.11-plan.md` (G1–G10، باتش 2 P2.x، باتش 3 S1–S12)، الـ checkpoints تحت في الملف ده، و git log. كل نسخة اتبنت بـ signer 7d8b31d2.

## 5.11 — الباتش الكبير G1–G9 (2026-11-06/07، versionCode 53، sw quran-v48)
**G1 — صياغة الإعدادات ومكانها**
- G1.1 «wifi فقط» بدل «واي فاي بس».
- G1.2 شلنا اختيار الموديل: NVIDIA بس، وزرار «تحميل نموذج التعرّف على التلاوة» (`#asrDl`). `micGate()`: على الموبايل من غير موديل بيعرض التحميل بدل ما يبدأ. وبقت العبارة الكاملة «التعرّف على التلاوة» في كل مكان.
- G1.3 «امسح تسجيلاتي» بقى لينك صغير جوه سياسة الخصوصية (`.link-sm`).
- G1.4 سياسة الخصوصية (ar+en): شروط استخدام الموديل (offline على الموبايل) واستخدام الصوت المتبرَّع بيه في تحسين التطبيق، واتشالت جملة «لا يجمع أي بيانات».
- G1.5 الـ Settings sheet ما بقاش بيتنطّط لما إعداد يعيد رسم الصفحة. G1.6 «ألوان المصحف الموضوعي» من غير «(على صفحات المصحف)». G1.7 أقسام «الألوان والمظهر / الصوت والتلاوة / التطبيق».
- G1.8 مراجعة الواجهة الإنجليزي: أداة `tools/qa/i18n_scan.js`، 35 نص ناقص، والـ exact keys بقت تكسب على قاعدة الحركات.

**G2 — هوامش التقليب والـ full screen**
- G2 مفيش هامش أبيض وقت التقليب. G2b مفيش dim/رعشة بعد التقليب، ودخول وخروج الـ full screen بقى ناعم.
- 5c/5d: السبب إن MainActivity بيعمل padding للـ WebView بالـ system-bar insets، فالـ WebView بيكبر بعد الـ CSS glide فيحصل glide تاني عكسي. الحل: `AppBridge.insets()` + `--vh`/`--fsdy`، فالصفحة تترسم للـ viewport النهائي وتعمل glide واحد. الوضع الرأسي اتعمل بـ FLIP على `.vp-c`. القياس: headless من 0/8 لـ 8/8، و emulator CDP من 4/8 لـ 8/8.

**G3 — الترحيب والموافقة**
- G3.6 «تخطي» في كل خطوة + «تخطي الكل». G3.7 خطوة تحميل الموديل في الـ welcome.
- G3.8 `consentDlg`: الموافقة على الشروط إجبارية، والتبرّع بالصوت اختيار منفصل ومقفول افتراضيًا. بتتخزّن في `q.modelConsent` و `q.donate`. أدوات التبرّع اتنقلت لـ «الخصوصية وتسجيلات الصوت». «التعرّف على التلاوة» بقى صندوق بيتفتح بضغطة، وده صلّح الـ id المكرر `asrDl`.
- G3.9 نصايح المايك + اختبار المايك على الموبايل (level، noise floor، SNR، تقييم)، وفي صف «اختبار المايك» في الإعدادات.

**G4 + G5** — قايمة «المزيد» بمجموعات ليها عناوين (الحفظ الأول). شاشة إحصائيات واحدة `#/stats` (القراءة، الحفظ، التعرّف، تسجيلات الصوت) + كارت الختمة.

**G6 — hub الحفظ**: الاختبار هو الوظيفة الأساسية، والخريطة والمتابعة بيخدموه. الخريطة فيها box لكل سورة أقصر من صفحة، و«ابدأ من الآية»، ومتابعة بالـ scroll، و«قلب تلقائي».

**G7 — محرّك متابعة التلاوة (البنود 16–24)**
- JS: تشغيل الـ partials، look-ahead، re-sync لما القراءة تنتقل للصفحة اللي بعدها، follow. التقليب بيحصل فور آخر كلمة في الصفحة من الـ partial، من غير ما يستنى fin + 700 ms.
- Native (NvAsr): الـ partials بتعمل decode بس بعد نقطة متجمّدة، ووقت الـ decode بيظهر في الإحصائيات.
- القياس: `recite_sim.js` (8 سيناريوهات) و `stream_cut.py` (52 stream متصل). اخترنا partial-only freeze، لأن تقطيع الـ pieces نزّل الـ word verdicts 0.6–2.5 نقطة، وده اترفض عشان بيبعد عن هدف 95%.

**G9 — QA على أجهزة كتير**: viewport matrix headless (`matrix.js` 40 check) + Maestro smoke على 4 AVDs (Phone/Small/Fold/Tablet API35) بـ `tools/qa/maestro/avds.sh`.

**البناء النهائي لـ 5.11 (G1–G7)**: ui.js 210/0، donate 0 FAIL، data 28/0، matrix 40/0، i18n clean، recite_sim ✓، Maestro 4 AVDs PASS. اتسطّب على موبايل المستخدم (M2007J3SY) وابتعتت له قايمة من 21 بند.

## 5.12 — ملاحظات الموبايل على 5.11 (2026-11-07، vc 54)
- #2 سويتش التبرّع في الموافقة بيبدأ مقفول دايمًا. #11 اختبار الكلمات بيتابع الكلمة اللي بعدها. #12 «قلب تلقائي» في اختبار الكلمات (`q.hifzFlip`). #16 الـ partial بقى كل 0.5 ث بدل 1 ث (على الأقل ضعف آخر decode). #19 الحفظ الرأسي بيخفي الصفحة اللي اتوصلها.
- إعادة الاختبار على الموبايل: الخمس بنود كلهم PASS. الـ decode 149 ms على 3.9 ث صوت، يعني نفس تكلفة كل decode، بس بيحصل ضعف المرات. **GitHub release v5.12.**
- بعدها: الـ dialogs بقت فوق المايك اللي في الركن (z-index 25).

## 5.13 — باتش 2 من المستخدم P2.1–P2.12 (2026-11-07، vc 55، sw v50)
- P2.3 «ليس الآن». P2.8 شلنا علامة وضع الحفظ من تحت الصفحات. P2.11 شلنا علامة الهامش الموضوعي. P2.9 شلنا صف تحميل الهامش، والملفات القديمة بتتمسح.
- P2.4 الإحصائيات › الخصوصية بتفتح الإعدادات على الصندوق من غير نطّة. P2.5 اختيار الآية جنب السورة في اختبار الحفظ.
- P2.7 الـ full screen في الوضع الأفقي ما بيصغّرش الصفحة (حد أدنى 640px). P2.12 صفحة الحرمين في النص في الـ full screen.
- P2.2 مايك ظاهر دايمًا في الرئيسية: بيلاقي الآية اللي اتقرت ويروح لها ويتابع.
- P2.10 + P2.6: اتعمل تقرير الأول (`plans/5.13-P2.10-P2.6-report.html`) وردودك في `plans/5.13-P2.10-P2.6-answers.md`. P2.1 مستني G8.
- QA: ui.js 220/0، fs-motion 8/8، Maestro 4 AVDs PASS. اتسطّب على bee81250.

## 5.14 — «المراجعة» (2026-11-07/08، vc 57، sw v52)
- P2.10: كل الإحصائيات بقت في المزيد › الإحصائيات بس.
- P2.6: شاشة «المراجعة» (`hzlog.js`)، ✓ تلقائي عند 80% (`hifzAuto`)، نطاقات بالربع (`hzRange`)، بالترتيب أو عشوائي 5–12، واختبار الكلمات على نطاق بيعدّي السور وفي آخره score واحد.
- عشوائي = عدد مواضع (موضع لكل 30 آية، 10 بالكتير)، كل موضع 3–12 آية (`hzParts`)، وفي «الموضع اللي بعده» و«الموضع # من #».
- ui.js 229/0، Maestro PASS، واتسطّب على bee81250. Night report: `plans/5.14-night-report.html` (12 اقتراح بقوا باتش 3 S1–S12).

## 5.15 — Sprint A (2026-11-08، vc 58، sw v53)
- **G10 prep**: `tools/asr/gpu/g10_prep.py` عمل `qtrain/g10/aug.json` فيه 13,302 variant: سرعة 0.7–0.9 و 1.1–1.5، دوشة babble/white/pink/brown بـ SNR 0–20، reverb rt60 0.3–1.0. DEMAND فضل held-out عشان gate الدوشة يفضل عادل.
- S2 «ركّز على أخطائي»: المواضع العشوائية بتميل للآيات الغلط (2/3)، و«أخطائي بس (#)».
- S1 المراجعة الذكية: تكرار متباعد بـ `q.hifzLog[s].iv` (7 أيام أول مرة، ×2 لما تبقى ≥90% لحد 90 يوم، ورجوع ليوم واحد تحت 70%)، والورد اليومي `q.hzDaily`، والمنبّهات.
- S7 كارت «النهارده» في الرئيسية.
- 5.15b (8 بنود): قايمة fold، الرجوع لأول «المراجعة»، هزّة لكل موضع، الموضع بس اللي مخفي، أول 3–5 كلمات بيفتحوا.
- 5.15c: قايمتين، `q.hzRev` «السور المراجعة» و `q.hifzLog` «السور المحفوظة».
- ui.js 246/0. اتسطّب على bee81250.

## G10 run 1 و 2 (2026-11-08)
- المستوى G10 في `nv_curr.py`: mix G10 .35 / L2 .2 / L1 .15 / replay .3، و3000 step، والـ metric noisy10.
- Run 1 مات بـ CUDA OOM عند step 250 بسبب clips بطيئة طويلة. الحل: `PADCAP` (≤ 1.8 × BATCH_SEC).
- Run 2 (0.6 ث/step، 3.3 GB): **«DONE G10: no step passed the proxy gate»**. noisy10 فضل 17.2–17.5 طول الوقت (مفيش تحسّن)، noisy5 حوالي 24.3–24.7، و ho_retasy 6.7→7.14 (اتدهور). ← **ما اتشحنش، والوصفة محتاجة تتفكّر من الأول** (5.20 step 2).

## 5.16 → 5.16d (2026-11-08)
- 5.16 U1–U8: «اختبرني» للسور المستحقة، الورد بالسرد أو عشوائي (`q.hzWardWay`)، حلقة الهدف جوه «النهارده»، الـ folds بتتفتح مكانها، تنسيق ملخص «السور المراجعة». U9 اتأجّل. ui.js 252/0.
- 5.16b U3: اختبار المصحف بيكشف كلمة كلمة مع القراية (كان سطر كامل متأخر 7–10 كلمات). U4: الموضع بيخلص أول ما آخر كلمة تتسمع صح في partial، واللي بعده بعد 300 ms (كان pause + final + 900 ms).
- 5.16c/d: «قلب تلقائي» شغال في اختبارات الخريطة وظاهر مقفول في المراجعة. ui.js 256/0.
- **Sprint B (تصغير الموديل)**:
  - اكتشفنا إن الـ pack اللي كان متشحن كان NVIDIA base مش L2، فانت اخترت L2.
  - Z1: قصّينا جدول الـ positional من 9999 لـ 1999 (`nv_shrink.py`)، فالموديل نزل من 131.65 لـ 115.27 MB. الـ parity مطابق 100% (logits diff 0، والـ gate متطابق في 100/100 metric).
  - Z2 int4 اترفض: الدقة متعادلة، بس أبطأ 19–63% على الموبايل (load حوالي 1 ث، و12 ث صوت بقت 284→339/465 ms).
  - **Pack v3 = L2 + Z1** (`asrnv3.zip` + `asrnvp3.zip`)، اترفع على branch editions بموافقتك.
- **S6 «مش متأكد»**: `Ctc.score` + `NvAsr.ctcM` (margin لكل كلمة)، و Java/Python parity 80/80. الـ calibration: `CTC_UNSURE = 1.0`، فـ 10% من الأحمر الغلط بقى أصفر، مقابل 1.9% بس من الأخطاء الحقيقية. الأصفر ما بيتحسبش غلط وما بيتبرّعش بيه.
- 5.16d: vc 62، sw v57، ASRM ver 3 / 93 MB، والـ nv.onnx القديم بيتمسح.

## 5.17 / 5.17b — Sprint C (2026-11-08، vc 63/64)
- S3 اختبار المتشابهات `#/mutash`: البداية المشتركة الأطول (كلمتين على الأقل)، لحد 3 تكملات، وإجابة بالصوت. 5.17b: القرار من الـ partials، الآية اللي قبلها كسياق، والمتشابهات لازم ≥40% كلمات مشتركة، يعني 799 سؤال.
- S5 التلقين `#/talqin`: اسمع N مرة، اقرا، سمّع، وبعدين الآية اللي بعدها. 5.17b: على مجموعة آيات (≤20).
- S8 الاستماع offline: تنزيل سورة/جزء (3 تنزيلات مع بعض) + مؤقت نوم 15/30/60/آخر السورة.
- **GitHub release v5.17.**

## 5.18 — Sprint D (2026-11-08، vc 65، sw v60)
- S9 معنى الكلمة بضغطة طويلة (480 ms) في عرض النص.
- S10 تذكير النسخة الاحتياطية: «آخر نسخة من # يوم» + تذكير شهري الساعة 8 بالليل.
- S11 المحفّظ والطالب: `q.lastTest`، «ابعت للمحفّظ» بكود QK2، و«طلابي» `#/students`.
- ui.js 280/0 (بعد تصليح عدّ الـ tiles)، Maestro PASS. **GitHub release v5.18.**

## 5.19 — معنى الكلمة على صفحات المصحف (2026-11-08/09، vc 66، sw v61)
- A: ضغطة طويلة على الصفحة بالكلمة المقدّرة، في كل الطبعات.
- B King Fahd:
  - `tools/page_geometry/ayah_circles.py` لقى 1,691 نهاية آية مش على الدايرة في 466 صفحة. `--fix` نزّل اللي بعيد بأكتر من 30‰ من 662 لحوالي 100.
  - `word_boxes.py` (DTW): squeezed 0.063%، والـ gate عدّى: SEED 518 59–60/60، و SEED 7 59/60.
  - `EDS.kfgqpc.w`.
- الحرمين: `word_boxes_harmain.py` بيستخدم `tajweed_pages.align()` في الإطار المعدول + inverse homography. النتيجة 77,426/77,428 كلمة، squeezed 0%، والـ gate عدّى 60/60 و 60/60. `harmain-w` بيتشال من PLAY=1 build.
- تصليح Android text selection بعد الضغطة الطويلة. `dAgo` بقى بأيام التقويم (bug الـ DST).

## 5.19b (2026-11-09، vc 67، sw v62)
- **bug في التطبيق**: «اكشف التالية» والتقليب التلقائي في الحفظ كانوا بيعدّوا آخر صفحة قرآن لصفحات الدعاء (الحرمين 541→542). الحل: `Q.last` بدل `Q.count`.
- ui.js بقى بيراعي الطبعة: `QA_pageOf`، أرقام الصفحات لكل طبعة، `'\b'` اللي كان backspace جوه RegExp strings في 5 checks، و 2:255 على صفحتين في الحرمين. واتشال الـ flake بتاع المتشابهات (بقى بيستخدم answer key).
- QA: ui.js kfgqpc 286/0، harmain 286/0، kfold 280/0، shamarly 280/0، و data.py 28/0.

## 5.20 step 1 (2026-11-09)
- 5.19b اتسطّب على bee81250 (SHA-256 7D8B31D2)، والمستخدم جرّب: معنى الكلمة على King Fahd والحرمين، وقف الحفظ عند آخر صفحة، ودايرة الآية. كله PASS.
- re-run لـ shamarly 280/0.
- صلّحنا `D:\Quran App\progress.md` القديم: 136 سطر mojibake وسطر heredoc زيادة، والنسخة الأصلية في `.bak-2026-11-09`.

## اللي لسه (بالترتيب)
1. GitHub release v5.19b، لما تقول.
2. G10 rethink بعد الـ weekly reset (2026-11-10 19:00 UTC): ليه noisy10 ما اتحرّكش (الـ data mix، الـ LR، الـ proxy gate أشد من gate الموبايل؟). الشحن بس لو gate الموبايل عدّى والـ latency ما بقتش أسوأ. اللي لازم نغلبه: pack v3.
3. Word boxes مقاسة لـ kfold والشمرلي، وبعدها 5.20.
4. على كلمتك: S12 التجويد بالصوت، G8/P2.1 الرفع من القراية، Play (محتاج إذن ناشر الحرمين)، iOS.

---


# Voice donation v2: progress

Branch: `donations-v2` (one commit per checkpoint, not pushed). Full plan: `C:\Users\Compumarts\.claude\plans\pasted-content-id-fa69-mighty-bubble.md`.
To resume: open Claude in `D:\Quran App\quran-karim` and say «كمّل من progress.md»; start at the first checkpoint not `done`.
Decisions: train the NVIDIA FastConformer only; FLAC; free protection only (no Play Integrity); no gender or age questions.
Models: Opus for relay, Java, audio and training; qk-dev (Sonnet) for UI, i18n and text; qk-qa (Haiku) for builds and tests.

| CP | What | Status | Date | Verified |
|----|------|--------|------|----------|
| 0 | Branch + this file | done | 2026-11-02 | - |
| 1 | Relay: HMAC, persistent limits, server ASR check, batched commits, /delete, legacy /clip | done | 2026-11-02 | pytest 8/8 (tools/relay/test_relay.py) |
| 2 | Android: seq-matched audio, quality + trim, FLAC, JobScheduler batch upload, forget, version | done | 2026-11-02 | FLAC round-trip 5/5 bit-exact; javac of all sources OK (only R missing outside the real build) |
| 3 | Web: v2 labels (s/a/w, hyp, model, app), «أنا قريت صح», settings counters, mobile data, delete | done | 2026-11-02 | node --check app.js/i18n.js; UI run in CP6 |
| 4 | Privacy policy AR/EN, store/data-safety.md, PLAY-REVIEW, SRS | done | 2026-11-02 | text review only |
| 5 | tools/asr/gpu/nv_train.py (donations + tlog, device split, gate), export_onnx --ckpt, migrate_legacy.py | done | 2026-11-02 | py_compile only; GPU dry run in CP6 |
| 6 | Verification: pytest, FLAC round-trip, APK build, ui.js mock, emulator smoke, nv_train --dry-run | done except nv_train DRY | 2026-11-02 | relay 8/8, FLAC 5/5, APK OK (cert 7d8b31d2), donate.js 10/10; NOT done: phone/emulator smoke, nv_train DRY |
| 7 | Deploy relay, migrate, bump 4.9: only with the user's OK | doing | 2026-11-02 | done (Play steps wait for the user) | relay live + verified, legacy migrated, 4.9 APK built with key |

## Wire protocol (shared by relay and app)
- `POST /batch` multipart: `device`, `ts` (unix seconds), `sig`, then per clip i: `meta<i>` (JSON) and `audio<i>` (FLAC).
  `sig = hex(HMAC-SHA256(APP_KEY, ts + "|" + device + "|" + sha256hex(meta0) + sha256hex(audio0) + ...))`.
  Reply 200 `{"results":[{"i":0,"ok":true}|{"i":0,"ok":false,"reason":"..."}]}`: the phone deletes every listed clip and counts rejects.
  401 bad sig/ts, 429 limit, 5xx: keep everything and retry later.
- `POST /delete` form: `device`, `ts`, `sig = HMAC(APP_KEY, ts|device|delete)`.

## Log
- CP0 2026-11-02: branch created from main 5980c5c.
- CP1 2026-11-02: tools/relay/app.py rewritten, test_relay.py added (8 pass, offline fakes). Notes:
  - Legacy /clip (4.8) now stores under the same clips/<devhash16>/ layout (no separate legacy/ folder); meta v=1.
  - Server ASR loads phone/model.json + phone/model.int8.onnx from MODEL_REPO (default DrAbdelraman/quran-train-progress,
    uploaded by export_onnx.py). If it cannot load, clips are stored with srv_cer=null and training must skip them.
  - Space secrets needed at deploy (CP7): HF_TOKEN (write), APP_KEY (same value as the app's key, set in CP2).
  - /delete only covers the new layout; old clips/YYYYMMDD/* need migrate_legacy.py (CP5) first.
  - Phone HTTP read timeout must be >= 60 s: replies wait for the shared commit (WINDOW=20 s).
- CP2 2026-11-02: FlacEncoder.java, Donations.java (trim/quality/save/stats/upload/forget/deviceId), DonateJob.java (JobScheduler),
  manifest <service DonateJob>, NvAsr (finals by seq, window.nvSeq set before each final onRecite; new bridge: donate2(meta,seq) ->
  ""|reason, sendDonations(mobile), donateStats() -> {"waiting","rejected"}, forget(oldIdsCsv) -> window.onDonateForget(ok);
  old donate/upload/donated removed, so the page is broken until CP3), AppBridge.version() -> "4.8 (39)".
  build-win.py / build.sh write <OUT>/gen/com/quran/karim/DonateKey.java from DONATE_KEY+DONATE_URL or keys/donate-key.txt.
  The key is NOT made yet: at CP7 create keys/donate-key.txt (random) and set the same value as APP_KEY in the Space.
- CP3 2026-11-02: app.js donation settings (stats line, #donateMob Wi-Fi/mobile, #donateDel -> NvBridge.forget(q.donateId)
  + window.onDonateForget), donateSend -> NvBridge.sendDonations(mobile); hifz test spans carry data-a/data-w; htvDonate() sends
  v2 meta with window.nvSeq; #htFix «أنا قريت صح» after a piece with red words (unmiss + kind "corrected"). index.html hint
  rewritten + new rows; i18n.js D49 block (English for all donation strings).
- CP4 2026-11-02: privacy-policy.html (AR+EN donation section, dated 2 Nov 2026; says dataset is PRIVATE: change if CP7
  decides public), store/data-safety.md (Play form answers), listing.md + PLAY-REVIEW.md (Data safety must be updated in Console
  and the new policy re-uploaded), SRS.md 4.6.
- CP5 2026-11-02: tools/asr/gpu/nv_train.py + nv_train.bat (CTC-only fine-tune, fp16, lower half of encoder frozen, RNNT
  branch frozen, BATCH_SEC=60 x ACC=2, LR 1e-5, 30% tlog via gpu_train.fetch/split, donations split by device hash 10%,
  targets = norm(text) i.e. undiacritised (the app compares normalised words anyway), gate: don_test better than base and
  tlog/ha/corrected not worse than +0.3 pts -> nv_out/best.nemo). export_onnx.py/export.bat take --ckpt <nemo> -> phone_ft/
  (relay keeps using the base phone/ model as its checker). tools/relay/migrate_legacy.py (dry run default, --apply).
  NeMo is NOT installed on this PC yet (tools/asr/gpu/.venv missing): the .bat installs it on first run.
  Shipping a fine-tuned model to phones = repack phone_ft/model.int8.onnx into the asrnv/asrnvp zips (editions branch): manual.
- CP6 2026-11-02: verified
  - relay: 8/8 (uv run ... pytest -q tools/relay/test_relay.py); FLAC: 5/5 bit-exact (py -3.11 -I tools/qa/flac/flac_roundtrip.py).
  - APK: .venv\Scripts\python.exe -I build-win.py -> quran-karim-v4.8.apk (overwrote the old 4.8 file), signer SHA-256 7d8b31d2...,
    manifest has DonateJob with BIND_JOB_SERVICE. Built WITHOUT a donation key (uploads off) since the key is a CP7 step.
  - UI: NODE_PATH=$(npm root -g) node tools/qa/donate.js -> 10/10 (mocked bridges: v2 label + nvSeq, «أنا قريت صح» incl. a
    misheard LAST word (fixed in app.js: htv.far), phone recogniser never donates, settings stats/mobile/delete).
  - NOT done, needs the user / a phone: (a) real-phone or emulator run with the NVIDIA model downloaded and a key + local relay
    (DONATE_URL=http://10.0.2.2:8000, uvicorn app:app); (b) DRY=1 nv_train.bat (installs NeMo, needs hf_token.txt and clips in the
    dataset); (c) relay server-ASR features vs NeMo on real clips (needs MODEL_REPO access).
- NEXT (CP7, each step needs the user's OK): make keys/donate-key.txt (random 32+ chars) and set the same value as APP_KEY secret
  in the Space; push tools/relay/{app.py,requirements.txt} to the Space; decide dataset private (policy says private);
  run migrate_legacy.py (dry run first); bump to 4.9 (manifest, index.html:153/186, sw.js cache name); re-upload privacy policy;
  update Data safety in Play Console from store/data-safety.md.
- CP7 2026-11-02: user said start. keys/donate-key.txt created (gitignored, random 43 chars). No HF token on this PC, so the
  Space upload waits for the user to run `uvx --from huggingface_hub hf auth login` (write token). After that: upload
  tools/relay/app.py + requirements.txt to Space DrAbdelraman/quran-voice-relay and set Space secret APP_KEY from the key file
  (api.add_space_secret, value never printed), then check GET / and that POST /batch answers 401 to an unsigned request.
- CP7 2026-11-02 (cont.): logged in as DrAbdelraman (write token). Space files were identical to main, so replaced with v2
  (Space commit f44da94dc1); APP_KEY secret set from keys/donate-key.txt. Space RUNNING. Live: GET / 200, bad signature 401,
  but signed /batch and /delete -> 500: the Space secret HF_TOKEN is rejected by HF ("Invalid username or password"),
  so the relay cannot read/write the dataset (the 4.8 relay had the same problem; dataset has only 4 clips, last 2026-10-31;
  4.8 phones keep clips on 5xx, so none were lost). Dataset is private (matches the policy). Model repo has phone/*.
  NEXT: user makes a fine-grained token (write: datasets/DrAbdelraman/quran-voice-donations, read:
  datasets/DrAbdelraman/quran-train-progress) and puts it in the Space secret HF_TOKEN; then rerun the live check
  (signed batch with a 0.2 s + a 2 s sine clip from device qa-test-device-0001 -> expect reasons length + mismatch, then /delete).
- CP7 2026-11-02 (cont.): user replaced the Space HF_TOKEN. Live check OK: signed batch -> 200 with reasons
  [length, mismatch] (the server ASR model loaded and ran), state/limits.json committed, /delete -> 200, no test files left.
  First signed batch took 52 s (20 s commit window + first model use); the phone waits up to 90 s. Not yet checked live: a
  real recitation being ACCEPTED (needs a real clip). Left in CP7: migrate_legacy.py (4 old clips), bump 4.9 + build with the
  key, re-upload privacy policy, Play Data safety.
- CP7 2026-11-02 (cont.): migrate_legacy.py --apply: 4 old clips (one device, 2026-10-31) now under clips/d145050b4b6f346d/,
  labels have no raw device id, audio intact (1.7-12 s, 16 kHz); no old-layout files left. Left: bump 4.9 + build with the key,
  re-upload privacy policy, Play Data safety.
- 2026-11-02: user says the app is NOT on Play Console yet; Play steps (policy upload, Data safety) wait until the user says
  so. Do not treat them as pending blockers.
- CP7 2026-11-02 (cont.): bumped to 4.9 (versionCode 40; index.html about text AR/EN; sw.js quran-v35). Built
  quran-karim-v4.9.apk with keys/donate-key.txt: no "no donation key" warning, key + relay URL present in classes.dex,
  signer SHA-256 7d8b31d2..., badging versionName 4.9 / versionCode 40.
  Still to try on a real phone: download the NVIDIA model, turn donation on, do a voice hifz test on Wi-Fi, then check the
  settings counters and that a clip arrives in the dataset (and that «امسح كل تسجيلاتي» removes it).
  Branch donations-v2 is not merged or pushed.
- Phone test 2026-11-02 (4.9 on the user's phone, device hash 0e04fff5e5115c5a): Wi-Fi upload works. 17:25 one clip refused
  (reason only in the phone's counter), 17:52 one clip stored: kind corrected, s2 a22 w17-22, 4.3 s FLAC, app "4.9 (40)",
  q rms -31.4 / snr 15.2, phone hyp and server srv_hyp both equal the text, srv_cer 0. Not yet confirmed: «امسح كل تسجيلاتي»
  (the clip is still in the dataset). Open question: why the piece was "corrected" when both models heard it right (user may
  have tapped the button just to try it).
- Delete test 2026-11-02 21:21: «امسح كل تسجيلاتي» made two "delete on request" commits (the phone's current id and its old 4.8
  q.donateId). Both 0e04fff5e5115c5a and d145050b4b6f346d (the 4 migrated 4.8 clips, from the same phone) are gone; the dataset
  now holds only .gitattributes + state/limits.json. Phone-side delete flow verified end to end.
  Left: DRY=1 nv_train.bat once clips exist; merging donations-v2 into main (user's call); Play steps when the user says.
- 2026-11-02: donations-v2 merged into local main (merge commit, pushed to origin/main as 3f7459a on 2026-11-02).
- 2026-11-04: user confirmed the 17:52 "corrected" clip was only a button test (not a model issue). Question closed.

# Audit 2026-11-04 (quality check + status report, requested before any new work)
- A1 automated QA (qk-qa, Haiku): data.py, ui.js (kfgqpc), donate.js, relay pytest, APK 4.9 signer/badging. — done: ui.js kfgqpc 153/153 + shamarly 153/153 (needed a scratch copy: hardcoded /mnt path, require('playwright')); donate.js 10/10; relay 7 pass 1 skip; APK 4.9 signer 7d8b31d2 OK, vc 40, target 36; data.py CRASHES when web/pages (Haramain images) is absent -> 0 checks ran.
- A2 docs review (Opus): BACKLOG, SRS, plans/checklist-31-oct, QA-checklist open items, IDEAS. — done (BACKLOG checkboxes for 27/31 Oct are stale: QA-checklist 4.6 says the 31 Oct list is done)
- A3 Play readiness: store/ (listing, policy, data-safety, PLAY-REVIEW, licences, permissions), PLAY build + AAB path. — done. Findings: PLAY=1 drops only Haramain (adhan sounds, Darwish, Ibn Ashur still in); keys/upload.jks not on this PC; build-aab.sh not ported to Windows; ONNX Runtime .so downloaded at runtime (asrnv.zip) = Play policy risk (no executable code from outside Play); CONTACT_EMAIL placeholder in privacy-policy.html and listing.md; PLAY-REVIEW 64-bit note outdated.
- A4 report to the user in Arabic: progress %, open questions, items to improve, what is missing, Play steps. — done (sent in chat 2026-11-04)
Resume: start at the first A-item not marked done. No code changes in this audit.
Resume: audit finished. Next work waits for the user's pick from the report (goal check first, see memory quran-karim-goals).

## 5.4 — phone checklist (17 items) + quranLocate for index/search mics (plan: ~/.claude/plans/wild-pondering-stallman.md)
CPs: CP1 mics->quranLocate, CP2 quiet/noise (bench first), CP3 asrStats, CP4 UI batch (qk-dev), CP5 wird+hifz map auto,
CP6 drop whisper models + HF mirror (ask before upload), CP7 build 5.4 + adb install + QA + HTML report.
- CP1 done (goal check: yes, ayah id is the weakest number). voiceLocate(text) = quranLocate on one-shot text, ayah of
  the first word heard right (quranLocate now also returns f). Index mic adds up utterances until clear (fallback
  voiceAyahs after 3 finals or on end); search mic lists the located ayah first. tools/asr/eval/locate_eval.js on
  rows-pre3 (393 rows with ayat): voiceAyahs 78.6% -> app combined 84.7% (tlog 84.3->93.3, reciters 86.9->93.8,
  HA 57.6->58.6: short fragments, wait for more words); quranLocate when it answers: 259/262 right.
Resume: CP2.
- CP4 done (qk-dev): index result under the header (scrollUnderBar), auto-scroll -> fullscreen after 3 s, fullscreen
  slides (transitions, reduced-motion off), no padding + mic stays, tabs المصحف/الصلاة/الأذكار/المزيد, «مع المغرب»
  fixed (applySettings ran before PR_METHODS existed and overwrote themeNow; sunCheck at start + visibility/focus),
  page crop (EDS.crop %, clip-path, boxes untouched; kfgqpc 3/5/3/5, kfold 5/3.5/5/3.5, shamarly 3/2/6/8.5 from p4).
  Screens in the session scratchpad shots/. Not checked on a phone yet.
- CP5 done: wird page you stay on counts after 20 s (last wird page no longer needs a turn past it); every recited
  ayah -> q.hifzAyat {d, ok} (reciteHear + hifzTestDone), hifz map colours pages from it (partial/review/good).
- CP6 done (HF mirror: user said not now): whisper models dropped (ASRM only asrnv, packs asrnv+asrnvp, asrModel null),
  old asrbase/asrft/asrrt files removed at start, q.asr moved to asrnv/phone.
Resume: CP2 bench results (out/cp2*), then CP3 stats, CP7.
- CP2 done: bench.py --vmin/--pgain/--noise/--snr. NvAsr VMIN 0.006->0.0015 + louder() (piece to -30 dBFS, <=30x) before
  decode. ALL rows (pre3 settings, DP verify): clean 89.9->90.1, quiet -50 dBFS 5.8->73.9 (vmin .003: 66.8), white SNR10
  74.3->74.6, babble SNR5 62.1->62.1 (another reader: needs CTC/training). Logs/summaries in qtrain/eval/out/cp2/.
- CP3 done: q.asrStats per day (u, w, ok/bad, rh/rm, loc/lost), Settings #asrStats line (last 7 days).
- CP7: 5.4 (vc 45, sw quran-v40) built, signer 7d8b31d2, installed on bee81250, opens, dark after maghrib, tabs OK.
  QA: ui.js 153/153 (2 tests updated: page tap point inside the crop; NVIDIA mic test mocks NvBridge), donate.js 15/15,
  data.py web 28/28, smoke 0 JS errors, locate_eval 84.7. parity.js diff 24 is the same on 5.0/HEAD (not a regression).
  Report: D:\Quran App\report-5.4.html. Not committed/pushed yet.
Resume: user tests 5.4 on the phone (report's list); then commit+push; next P1b-port (CTC) for noise/other reader.

## 5.5 — phone feedback on 5.4 (2026-11-04)
User: map not filled after recitation, crop to the frame (drop hizb marks), hifz page re-order + mini map, surah on the
map at the end of a test, last ayah of short surahs, vertical mode: fs moves the page / mic finds ayah but no jump,
back button (<=2 back then home, double back to exit), caption follows reading, "full QA every time" (memory saved).
- done: vertical fs keeps the anchor page (fsSet), far mic jump instant + realign + hash; htv auto-finish at the end
  (ptr >= n-1) -> htDone: hifzMark per ayah + hifzLog surah; mushaf hifz reveals line by line; caption capFollow;
  kfgqpc/kfold crop to frame [8,3,8.6,15]/[5.4,5,6.4,13.3] mirrored on odd pages (cropFrom 3); navBack + MainActivity
  "exit"; QA-checklist 5.0-5.5 + full-QA rule.
- in progress: hifz test page re-order (qk-dev), ui.js G18 tests (qk-dev).
Resume: when both agents finish -> full QA (every feature) -> build 5.5 -> install -> phone pass -> report.
- 5.5 built (vc 46, sw quran-v41), signer 7d8b31d2, installed on bee81250, opens without crash. Hifz test page
  re-ordered (hifzPageColors shared with the map, hifzMini card, review chips). FULL QA: ui.js 166/166 (G18 = 14 new
  checks; 3 old tests updated for the frame crop and the new back), donate.js pass, data.py 28/28, locate 84.7.
Resume: user tests 5.5 on the phone; then commit+push 5.4+5.5; next P1b-port (CTC) for noise / another reader.
- 5.6 (vc 47, sw v42): back = 1 step then home, two backs <1.5 s anywhere exit; auto fs 5 s after opening the mushaf,
  any touch/scroll restarts it; vertical: bar floats (fixed + padding) so fs slides smoothly, pages cropped to the frame
  (vp-c clip box, .page-box keeps image coords); crop leaves ~2 px white outside the frame; page turn (slide/curl)
  shifts the incoming page by cropDx so no margin shows; hifz test adds the surah to the map only when every ayah was
  tested; fixed a CSS brace I broke (rd-cap max-height lost). FULL QA: ui.js 166/166, donate 15/15, data 28/28.
  Installed on bee81250. Not committed.
- RESTORE POINT 2026-11-04: tag v5.6-restore (commit c192094, pushed) + APK copy D:\Quran App\restore\v5.6\.
  Roll back: git checkout v5.6-restore (or git revert the P1b commits) and adb install -r that APK.
Resume: P1b-port in a NEW session after the 5-hour usage reset (this one is at 342k context).

# P1b-port — CTC verdicts in the app (5.7), started 2026-11-05 (plan: ~/.claude/plans/inherited-humming-robin.md)
Goal check: yes — bench CTC 94.5 -> 97.2 word verification, the biggest measured lever. Hybrid: rLocal places a final
NvAsr piece, CTC forced alignment (Java, on the piece's log-probs) re-judges the words of its span.
CPs: CP1 bench hybrid (p1b_port_eval.py) · CP2 Java CTC + bridge + parity · CP3 JS units/ctcJudge + parity ·
CP4 version 5.7 + QA-checklist · CP5 build/signer/full QA/phone · CP6 commit, push, release v5.7.
Resume: CP1.
- CP1 done: tools/asr/eval/p1b_port_eval.py (+ rlocal_spans.js = the app's rLocal piece by piece), 373 clean clips,
  per-piece log-probs (out/lp). verify / right accepted / wrong caught:
  rLocal only 94.7 / 94.2 / 99.7 · CTC overrides span 96.3 / 96.2 / 98.1 · CTC only turns wrong->right **96.9** / 96.8 /
  98.1 (HA 91.4->96.0, tlog 95.8->98.0, reciters 94.5->96.0) · +-1 edge word: no gain. d=3: 96.7, d=5: 97.1 (d=4 kept,
  picked before). Chosen: on a final piece, words rLocal judged wrong in its span become right if CTC matches them.
Resume: CP2 (Java Ctc.java + NvAsr bridge + parity harness).
- CP2 done: android/src/.../Ctc.java (port of ctc.py group + forced_words), NvAsr keeps the grouped log-probs of the last
  4 final pieces; bridge vocab(), ctcSetup(forms), ctc(seq, words) -> [1|0]. tools/asr/eval/ctc_java_parity.py +
  CtcTest.java: Java == Python 80/80 cases, 755/755 words, ~1.3 ms per piece on the PC.
- CP3 done: web/app.js ctcUnits (port of p1b_verify units, Uthmani words -> Q.q simple spelling), ctcReady, ctcJudge
  (final pieces only, rLocal's wrong words in the span turn right when CTC matches; asrStat "ctc"), used by reciteHear
  and the hifz-test voice mode (htv.keys). ctc_units_parity.py/.js: token forms 1024/1024 same; ayat 6123 same, 85 differ
  = Python's simple text has the basmala glued to surah first ayat (+17:110), app's units are the right ones.
Resume: CP3b ui.js test with a mocked NvBridge.ctc, then CP4 version 5.7.
- CP4 done: 5.7 (vc 48, sw quran-v43), QA-checklist 5.7, Settings stats show words fixed by the CTC check.
- CP5 done: APK signer 7d8b31d2 OK; FULL QA: ui.js 168/168 (G19 = 2 new CTC checks), donate.js 15/15, data.py 28/28,
  locate_eval 84.7 (same), parity.js 722/24 (same as 5.0-5.6). Emulator Phone_API35: installs, opens, no crash.
  Phone (bee81250) not connected: NOT verified on a real phone (needs the model + mic).
- CP6: commit + push + GitHub release v5.7.
Resume: user tests 5.7 on the phone (hifz test by voice with a deliberate wrong word; Settings stats "ctc" count).
 Next candidate: CTC for ayah id (p1b_idc) in quranLocate for short fragments (HA ayah id 85.7%).

## Queued (user asked 2026-11-05): 5.8 — drop the duplicate model parts after joining (~132 MB saved on the phone)
Found: NvAsr.load() joins asrnv/a.bin + asrnvp/b.bin into asr/nv.onnx and keeps both parts -> the model is stored twice
(~264 MB instead of ~132). Phone total with one edition + model: ~360-370 MB now -> ~230-240 MB after. APK size unchanged (46.9 MB).
Change (NvAsr.java only):
- load(): if both parts exist (first run or a new model download) join to nv.onnx.part -> rename -> delete a.bin/b.bin;
  else use nv.onnx as is. An interrupted join leaves the parts, so it re-joins next time.
- ready(): libonnxruntime.so + vocab.json exist AND (nv.onnx exists OR both parts exist).
- EdStore install state uses <id>.ok markers (unaffected); remove() already deletes nv.onnx.
QA: full suite + check nothing in Settings reads the part files (grep found none); phone: update over 5.7, mic works,
files/ed/asr has no a.bin/b.bin, storage drops ~132 MB; remove/re-download model still works.
Resume: run as its own step in the workflow (goal check: side work for storage, not recognition — do it after the
5.7 phone test unless the user says otherwise).

## 5.7 phone test — 2026-11-05: user says OK, no notable errors (installed on bee81250, signer 7d8b31d2).
Goal check for next: 5.8 storage fix = side work (cheap, user-queued); P0b held-out + noisy test set = goal work
(needed to prove >95% honestly; 96.9% was tuned on the same 373 clips).
Resume: 5.8 storage fix (NvAsr.java) then P0b — or P0b first, on the user's word.

## 5.8 — storage fix — done 2026-11-05
Goal check: side work (storage, user-queued), cheap; recognition unchanged.
NvAsr.load(): joins a.bin+b.bin only when both exist, deletes them after a size-checked join; ready() accepts nv.onnx alone.
vc 49, sw quran-v44. Signer 7d8b31d2. QA: ui.js 168/168, donate 15/15, data 28/28, javac OK; locate/parity skipped
(rows files not on disk; matcher untouched). Phone bee81250: installed over 5.7, mic used by the user, app storage
(Settings > app info) 422 MB vs 501 MB from diskstats before (stale stat; release build not debuggable, so files not listed).
Resume: push + release v5.8 (needs the user's OK), then P0b held-out + noisy test set.

## 5.11 G3.7 — welcome step: recitation model download — done 2026-11-06
Goal check: offers the recognition model on the first run (no model = no recognition) and starts the consent flow (G3.8) = near-complete app + recognition reach. Effort medium (G3).
Welcome has 4 steps; step 3: terms switch gates «حمّل النموذج», separate unticked donate opt-in, saves q.modelConsent + q.donate, then needAsr("asrnv"). ui.js 181/0. Phone check queued in QA-checklist (5.11).
Resume: G3.8 consent (model blocked until q.modelConsent; donate controls move from Settings into the privacy box + chip), then G3.9 mic tips/test.

## 5.11 G3.8 — model consent + privacy box — done 2026-11-07
Goal check: required, clear consent before the model runs and a separate opt-in for voice donation = trust for the near-complete app and a clean, consented data stream for the >95% recognition work (G8/G10). Effort medium.
consentDlg (terms required, donate separate + unticked) gates micGate on the phone, incl. readers upgrading with the model; donate tools moved to «الخصوصية وتسجيلات الصوت» (+ chip). User edits via a forked session: no «not agreed yet» line, shorter donate hint without the model name. ui.js 183/0; donate.js 14/15 (pre-existing «phone recogniser» check, to fix in 5.11 QA).
Resume: G3.9 mic tips + mic test (micTips, q.micTest, Settings row «اختبار المايك»).
- 2026-11-07 user fix: «امسح كل تسجيلاتي» kept in one place only (privacy box, under the donate choice, small .link-sm); about text (ar+en) now points to Settings › الخصوصية وتسجيلات الصوت. ui.js 183/0.
- 2026-11-07 user fixes (emulator review): no «وافقت على الشروط» line at all (consent kept silently in q.modelConsent); «التعرّف على التلاوة» = closed box (state on the title line, tap -> model card with download/delete; download goes through consentDlg) — also fixes the duplicate id asrDl (button + card); «ألوان المصحف الموضوعي» on/off beside the label like «ألوان التجويد». ui.js 185/0.
Resume (2026-11-07): new session from plans/5.11-session-prompt-3.md — G3.9 next, then the carried-over 5c/5d/G1.8 + donate.js fix, then 5.11 build/QA.
G3.9 ✅ (ui.js 186/0, donate.js all PASS after dropping the obsolete phone-recogniser check). Goal check: mic SNR test cuts noise-caused misrecognitions → toward >95%.
G1.8 ✅ English UI review (i18n_scan.js, 35 strings, harakat-rule fix; ui.js 186/0). Goal check: a complete app for non-Arabic readers.
Resume (2026-11-07): new session from plans/5.11-session-prompt-4.md — G2 5c/5d at effort high (measure headless Playwright + emulator CDP), then the 5.11 build + full QA.

## 5.11 G2 5c/5d — full-screen glide in both flip modes, one way only — done 2026-11-07
Goal check: a calm, jump-free reading screen is core to the near-complete app (user-reported twice). Effort high.
Cause: MainActivity pads the WebView by the system-bar insets, so immersive() grows (and, without a cutout, moves) the WebView after the CSS glide -> second glide the other way. Fix: AppBridge.insets() lets fsSet lay the page out for the final viewport (--vh) and pre-shift it (--fsdy) so ONE glide lands; cleared in the resize frame. Vertical: FLIP on the visible .vp-c, anchor kept. Measured per frame: headless 0/8 -> 8/8, emulator CDP 4/8 -> 8/8. ui.js 194/0. QA-checklist 5.11 section repaired (G3.9 line had been inserted after every line of the file).
Resume: 5.11 version bump (manifest done: 5.11/53; about text ar+en, sw.js cache) -> build quran-karim-v5.11.apk -> full QA (ui.js, donate.js, matrix.js, Maestro 4 AVDs, i18n_scan) -> then G4 (plan written under item 10).

## 5.11 G4 + G5 — More menu in groups, one Stats screen — done 2026-11-07
Goal check: findable tools (hifz first) and one place for reading/hifz/recognition numbers = near-complete app; the recognition rings show where recognition is weak (noise, mic) -> supports >95%. Folded into the 5.11 build (not delivered yet) so the user gets one APK and one full QA. Effort: session at high (≥ low/medium needed).
G4: titled groups, odd group's first tile spans. G5: #/stats (reading, hifz, recognition, voice recordings on the phone), khatma link card, i18n for all new text + hifz-test strings (tr() matches «١٢. يوسف»). ui.js 196/0, i18n_scan clean (adds #/stats).
Resume: build quran-karim-v5.11.apk (manifest 5.11/53, about ar+en, sw quran-v48 already bumped) -> full QA (ui.js done 196/0, donate.js, data.py, matrix.js, Maestro on Phone/Small/Fold/Tablet API35) -> deliver phone list; then G6 (hifz redesign, high).
5.11 build ✅ quran-karim-v5.11.apk (53, signer 7d8b31d2): ui.js 196/0, donate 14/0, data 28/0, matrix 40/0, i18n clean, Maestro 4 AVDs PASS. Installed on Phone_API35. No GitHub release (ask the user first).
Resume: deliver the 5.11 phone list (QA-checklist § 5.11) to the user; next G6 hifz redesign (effort high).

## 5.11 G6 — hifz hub: test first, map boxes per surah, start ayah, follow, auto flip — done 2026-11-07
Goal check: the hifz test is the main use of recitation recognition; a hub around it with a start ayah and page following = near-complete app + more real recognition use. Effort high.
ui.js 201/0, i18n clean. Phone check pending (follow scroll with real recitation). Not in an APK yet (5.11 APK built before G6).
Resume: G7 (recitation following/timing engine) — needs real recitation audio; then rebuild an APK with G6/G7 for the user.

## 5.11 G7 — recitation following and timing — done 2026-11-07 (JS + NvAsr), phone check pending
Goal check: the biggest user-felt gap; measured with recite_sim.js (8 scenarios) and stream_cut.py (52 continuous streams). Partial-only freeze chosen because cutting pieces lowered word verdicts (0.6–2.5 pt) — rejected against the >95% goal.
Resume: full QA + rebuild quran-karim-v5.11.apk (G1–G7) -> deliver phone list; then G10 (noise/speed retrain, GPU, hours) only if usage allows; G8 waits for the user (backend + consent wording).
5.11 FINAL build ✅ quran-karim-v5.11.apk (G1–G7; 53; signer 7d8b31d2): ui.js 210/0, donate 0 FAIL, data 28/0, matrix 40/0, i18n clean, recite_sim ✓, Maestro 4 AVDs PASS. Installed on Phone_API35. No GitHub release (ask first).
Goal check for G10: needs hours of GPU training and the user's phone gate; the user asked to shut the PC down at the end of this session -> plan written under items 30/31, not started.
Resume (2026-11-07): new session from plans/5.11-session-prompt-5.md — the user's phone review of 5.11 (QA-checklist § 5.11, G7 a–h + G3.9), then G10 (GPU), G8 waits for the user.


- 2026-11-07: 5.11 installed on the user's phone (M2007J3SY) over USB; 21-item phone list sent. plans/5.11-session-prompt-5.md updated for the next session.
Resume (2026-11-07): new session from plans/5.11-session-prompt-5.md — act on the user's phone feedback for 5.11 (by list item number), then G10 (GPU), G8 waits for the user.

## 5.11 phone feedback (21 items) — in progress 2026-11-07, paused by the user
Goal check: items 2/11/12/16/19 are real phone gaps in hifz/following, the main use of recognition; #16 changes only partial timing (finals untouched -> no accuracy risk).
Done in code (not built/QA'd yet): #2 consent dialogs' donate switch always starts off (was showing the 5.10 choice); #19 vertical hifz: scroll watcher now masks the page reached (vHz; while reciting the page is kept until hifz.next or it leaves the top); #11 words test follows the next word + mic start puts text under the bar; #12 words test «قلب تلقائي» button (q.hifzFlip): last word heard on a partial opens the next 10 ayat with the mic on (rest of the piece skipped via htv.skip), off -> ends with the score; #16 NvAsr partial every 0.5 s (min 2x last decode ms) instead of 1 s. User reported 147 ms/decode at 3.9 s audio (bench 3.7 s).
ui.js: 1 FAIL fixed by editing the G6 vertical check (scroll 230 not 700) + new check «phone #19»; recite_sim.js scenario I first run: flip ON passes (moves to ayah 11, mic stays on, ayah-11 words 3/3 ok, follow keeps word at 253/844); flip OFF FAILS: one partial with all 10 ayat does not end the test (mic still on, htRes empty) — debug endNow (r.v[n-1] on a single long partial from ptr 0?).
Flip-off sim "failure" was the sim (same hash, no re-render); fixed. 5.12 built + full QA green (see QA-checklist 5.12).
Resume: install quran-karim-v5.12.apk on the phone (adb -s bee81250 install -r) when connected, send the 5.12 re-test list (QA-checklist 5.12); then G10 (GPU). No GitHub release without asking.
- 2026-11-07: 5.12 installed on the user's phone (bee81250); re-test list (2, 11, 12, 16, 19) sent. Resume: act on the 5.12 phone results; then G10 (GPU).
- 2026-11-07: user's phone re-test of 5.12: items 2, 11, 12, 16, 19 all PASS. Stats: 149 ms per decode (3.9 s audio) — same per-decode cost as 5.11 (147), as expected: 5.12 decodes twice as often, not slower. Resume: G10 (noise/speed retrain, GPU, hours; plan under items 30/31 of 5.11-plan.md) — only with the PC left on; G8 waits for the user; GitHub release of 5.12 only if the user asks.
- 2026-11-07: GitHub release v5.12 published (user asked) with quran-karim-v5.12.apk (signer 7d8b31d2): https://github.com/drmalek1987/quran-karim/releases/tag/v5.12. Resume: G10 (GPU) only with the PC left on; G8 waits for the user.
Resume (2026-11-07): new session from plans/5.11-session-prompt-6.md — user patch 2 (P2.1–P2.11 in 5.11-plan.md): quick items P2.3/8/11/9 first, then P2.4, P2.5, P2.7, P2.10 (list first), P2.6 (plan first), P2.2; P2.1 waits for G8; then 5.13 build + full QA + phone list; G10 only with the PC left on.
- 2026-11-07 (session 7, patch 2): goal check: P2.3/8/11/9/4/5 are user-asked UX fixes for the near-complete app; cheap, done before the heavier items. Done + pushed: P2.3 «ليس الآن» (3e087ec), P2.8 no hifz-mode button under pages (hifz mode from map/test; window.hifzToggle for QA), P2.11 no thematic margin under pages, P2.9 thematic-margin download row gone + old thmnotes freed on start, P2.4 Stats › privacy opens Settings already at the box (no jump), P2.5 start-ayah select in the hifz test (07db17f). ui.js has ONLY=<group> filter; group «نسخة 5.13 (باتش 2)». Build note: use .venv\Scripts\python.exe -I build-win.py (global py3.11 lacks brotli). User is away and asked to shut the PC down at the end → no G10 this session.
Resume: P2.7 (landscape full screen must not shrink the page), then P2.10 inventory + P2.6 plan (report for the user, no implementation), P2.2, then 5.13 build + full QA; then shutdown.
- 2026-11-07: P2.7 ✅ (ac10f66) landscape fs page width kept (cropped editions were 640→282; fs --W now has the 640px floor). P2.10 inventory + P2.6 plan written for the user: plans/5.13-P2.10-P2.6-report.html (3 questions; nothing implemented). P2.2 ✅ always-visible home mic (rdMicHtml on showHome, rdPage reset, text mode opens #/s/s/a). Goal check P2.2: directly serves recitation recognition in daily use (find any ayah by reciting).
- 5.13 build ✅ quran-karim-v5.13.apk (5.13/55, sw quran-v50, signer 7d8b31d2): ui.js 220/0, donate 0 FAIL, data 28/0, matrix 40/0, i18n clean, fs-motion 8/8, Maestro 4 AVDs PASS, emulator CDP checks PASS. Installed on Phone_API35 only — the user's phone was not connected. No GitHub release (ask first). User was away and asked for a PC shutdown at the end → G10 not started.
Resume: install quran-karim-v5.13.apk on bee81250 (adb -s bee81250 install -r) and send the phone list (QA-checklist § 5.13); get the user's answers on plans/5.13-P2.10-P2.6-report.html, then implement P2.10 + P2.6; P2.1 waits for G8; G10 only with the PC left on.
- 2026-11-07: 5.13 installed on the user's phone (bee81250) over 5.12, data kept; phone list (QA-checklist § 5.13) sent. Resume: act on the 5.13 phone results + the user's answers on plans/5.13-P2.10-P2.6-report.html; P2.1 waits for G8; G10 only with the PC left on.
- 2026-11-07: P2.12 (user note via a side session): harmain page centred in full screen (style.css, non-crop rule). ui.js 5.13 group 8/0, fs-motion 8/8 (harmain, kfgqpc headless; harmain emulator), emulator real fs top/bottom 102/102. Goes into the next build; the phone still has 5.13 without it. Resume: same as above (5.13 phone results + report answers).
Resume (2026-11-07): new session from plans/5.11-session-prompt-7.md — P2.10 done in code but UNTESTED (run full ui.js first); P2.6 draft in plans/wip-5.13-P2.6/ (apply with patch_hz.py), then words-test ranges, CSS, i18n, checks; then 5.14 build + full QA + phone list. User answers: plans/5.13-P2.10-P2.6-answers.md.
- 2026-11-07 (session 7): goal check: P2.10/P2.6 finish the hifz/review flow the user asked for (near-complete app goal); no better alternative, the user's answers fix the design.
  - P2.10 verified: full ui.js 221/0 after 2 checks moved to Stats (376883d).
  - P2.6 applied: «المراجعة» screen (hzlog.js via patch_hz.py), auto ✓ at 80% (hifzAuto), ranges (hzRange from QURAN.h rub'), in order / random 5–12, mushaf test ends at range end, words test with range across surahs + whole-test score (patch_ht.py), CSS, More menu name, i18n D513 (scan clean for the new pages), 7 checks (ui.js 5.13 group 14/0). Screenshots tools/qa/p26-*.png.
  - Note: uncommitted 5.13.1/56/sw v51 bump of unknown origin in manifest/index/sw.js; the 5.14 build sets 5.14/57/v52.
Resume: 5.14 build + full QA (ui.js, data.py, matrix, donate, i18n, fs-motion, Maestro 4 AVDs, emulator screenshots of «المراجعة»), install on bee81250, phone list QA-checklist § 5.14 (P2.6, P2.10, P2.12). No GitHub release unless asked.
- 2026-11-08: user change via side session: «عشوائي» = a random number of places (up to 1 per 30 ayat, max 10, min half), each 3–12 ayat (hzParts); mushaf test moves place to place (hifzNextPlace; context ayat before a later place shown), words test «الموضع اللي بعده» + «الموضع # من #», one score at the end; score saved for every surah tested. 5.14 built (57, sw v52, signer 7d8b31d2), ui.js 229/0, data 28/0, matrix 40/0, donate 0 FAIL, i18n clean, emulator CDP checks PASS.
Resume: Maestro 4 AVDs on the final 5.14 APK, then install on bee81250 (adb -s bee81250 install -r quran-karim-v5.14.apk) and send the phone list (QA-checklist § 5.14). No GitHub release unless asked.
- 2026-11-08: 5.14 final: Maestro 4 AVDs PASS, installed on bee81250. Night report for the user: plans/5.14-night-report.html (changes since G1, what is left, needs, time, usage, 12 suggestions). PC shut down at the user's request.
Resume: act on the user's 5.14 phone results (QA-checklist § 5.14 items 1–10) and their pick from the report's suggestions; G8/P2.1 waits for the user's backend/consent decision; G10 (noise/speed retrain, plan in 5.11-plan.md items 30/31) only on a night with the PC left on; GitHub release v5.14 only if asked.
- 2026-11-08: Patch 3 plan approved (12 night-report suggestions + what is left, by priority, with a token-saving workflow and timeline): appended to plans/5.11-plan.md. Maestro 4-AVD runner saved as tools/qa/maestro/avds.sh.
Resume: new session from plans/5.15-session-prompt.md — Sprint A: 5.14 phone results, S2, S7, S1, G10 data prep on the CPU (training only on a night with the PC left on), then 5.15 build + full QA.
- 2026-11-08 (Sprint A, 5.15): goal check — G10 data first (CPU, no tokens, the biggest gap to 95% outside the house), then S2/S1/S7 (hifz is the main use of recognition). 5.14 phone results not in yet. Done:
  - G10 prep: tools/asr/gpu/g10_prep.py → qtrain/g10/aug.json + wav/ (13302 variants = 2 per train clip + 3000 replay; speed 0.7–0.9 / 1.1–1.5 atempo, babble or white/pink/brown noise at SNR 0–20, synthetic reverb rt60 0.3–1.0; DEMAND held-out noise NOT used so the noisy gate stays fair). Training script does not read it yet (add a G10 mix in nv_curr.py data(), the night training starts).
  - S2: hzParts weights random places to wrong ayat (2/3 of places land on one), «أخطائي بس (#)» = places around wrong-ayah groups (±1 ayah, min 3, max 10); empty → toast.
  - S1: hzDueInfo/hzReviewed/hzDueList/hzWard: q.hifzLog[s].iv (7 first, ≥90% ×2 max 90 once a day, 70–89 same, <70 → 1); map colours, «عليك مراجعة», hifzDue/syncAlarms (per day ahead) use it; q.hzDaily pages ward + «اختبرني في ورد النهارده» (one mushaf test, a place per surah).
  - S7: todayCard() on home under the khatma card (only when a surah is memorised): khatma ward + review ward + «اختبرني».
  - ui.js group 5.15: 7/0 (and 5.11/5.13 groups 0 FAIL; the old «عليك مراجعة» check now expects 113 at 50% today due tomorrow). Screenshots tools/qa/s7-home-today.png, s1-s2-review.png.
Resume: 5.15 build (versionCode 58, sw quran-v53, index.html version, signer 7d8b31d2) → full ui.js + data/matrix/donate/i18n → Maestro 4 AVDs (bash tools/qa/maestro/avds.sh) → install bee81250 → QA-checklist § 5.15 + HTML report. G10 training only if the user says the PC stays on overnight.
- 2026-11-08 night: 5.15b user patch (via side session local_6f1f5ba6): items 1–8 done (fold list, back → top of «المراجعة», buzz per place, only the place hidden on the mushaf, flip always on in tests, first 3–5 words open with all hidden, ✓ by test score 80% — whole surah needed from «اختبار الحفظ»). Final 5.15 APK (58, sw v53, signer 7d8b31d2): ui.js 243/0 (old checks updated for 5.15b; mic-tips check flaky, PASS on rerun), data 28/0, matrix 40/0, donate 0 FAIL, i18n clean on «المراجعة», Maestro 4 AVDs PASS. NOT installed: bee81250 was unplugged. Report plans/5.15-report.html. User: the PC is mine now — chain sprints, full QA each, G10 training allowed; ASR speed matters; new session at 300k context.
Resume: new session from plans/5.16-session-prompt.md — first install 5.15 on bee81250 if connected; start G10 training (nv_curr.py + qtrain/g10) in the background; then S6, 5.16 build + full QA; then Sprint C.
- 2026-11-08 02:40: G10 training STARTED in the background (bash nv_level.sh G10 nv_out/P3_FINAL_L2.nemo → nv_curr.py then nv_gate.py; logs nv_curr.log, nv_out_G10.stdout, nv_gate_G10.stdout, nv_level_G10.out). nv_curr.py: level G10 (mix G10 .35 / L2 .2 / L1 .15 / replay .3, 3000 steps, own metric noisy10, clean ≤ ref+0.3, noisy ≤ ref). DRY run OK (3.1 GB GPU; init train_G10 CER 18.3).
Resume: plans/5.16-session-prompt.md — step 1 is now: read the G10 result (nv_curr.log DONE line + nv_gate_G10.stdout); ship only if the gate passes AND latency is not worse; then S6, 5.16, Sprint C.
- 2026-11-08 06:00: G10 run 1 died at step 250 (02:44) with CUDA OOM: long slowed clips padded a batch past 5.1 GB. Fix: nv_curr.py PADCAP (padded seconds = clips × longest ≤ 1.8 × BATCH_SEC; 1.25 was too small, loss 4). Restarted 06:04 (0.6 s/step, 3.3 GB).
- 2026-11-08: 5.15c user patch (via side session local_caf1f593): «قلب تلقائي» shown on + disabled in tests; back from «المراجعة» → home; two lists: q.hzRev «السور المراجعة» (tests from «المراجعة», ≥80%; spaced review/ward/today card/alarms run on it; first run copies q.hifzLog) and q.hifzLog «السور المحفوظة» (whole-surah test from «اختبار الحفظ»/map, ≥80%; fold list under the words test; map: memorised from it, yellow from q.hzRev due). ui.js 246/0, 5.15 group 17/0, data/matrix/donate/recite_sim OK. 5.15 APK rebuilt (58, signer 7d8b31d2) and INSTALLED on bee81250. Commit e436238.
Resume: plans/5.16-session-prompt.md — read the G10 result (nv_curr.log DONE G10 + nv_gate_G10.stdout); ship only if the gate passes AND latency is not worse; then S6, 5.16, Sprint C.
- 2026-11-08 morning: 5.16 = user package U1–U8 (schedule plans/5.16-schedule.md). U1 due-surah «اختبرني» starts its mushaf test; U2 ward «بالسرد/عشوائي» (q.hzWardWay, hzWardPlan); U5 goal ring inside «النهارده» (one card; no memorised surah → goal tile stays); U6 map «السور المحفوظة» opens in place (hzMemoList on the map, no #hmLog); U7 «آيات غلطت فيها قبل كده» is a fold; U8 «السور المراجعة» summary styled as .continue like the map's. U9 (map for memorised only) put off by the user. G10 failed its proxy gate (noisy flat, ho_retasy 6.81→7.14) → not shipped. donate.js «data-a/data-w» check moved to ayah 2 (5.15b opens ayah 1's first words). Goal check: U1–U8 close the hifz/review loop (complete app); recognition speed (U3/U4) + S6 next in 5.16b.
Resume: 5.16c on bee81250 (5.16b U3/U4 + 5.16d flip + 5.16e flip in «اختبار الحفظ»). Next: S6 «مش متأكد» (Opus high, Java) after the weekly reset, then Sprint C (S3/S5/S8) = 5.17. G10 recipe needs a rethink.

Checkpoint 2026-11-08 (Z-track plan): goal check — a smaller model saves phone space and RAM without touching accuracy (Z1/Z3) or only through the gate (Z2/Z4). Restore point tag v5.16c-restore + model zips backed up. Plan plans/asr-size-plan.md, merged into plans/5.16-schedule.md.
Resume: Z1 — export_onnx.py --posmax from nv_out/P3_FINAL_L2.nemo, then Z1v parity (logits diff, nv_gate shipped, RTF).
Resume: new session «Sprint B» from plans/sprintB-session-prompt.md (Z1 first). Usage stop is now 82%.

## Sprint B (2026-11-08, session local_3bbb678c)
Goal check: Z1/Z2 shrink the on-phone ASR model without hurting recognition (gate must stay equal).
- FINDING: the shipped pack (restore-asr-5.16c a.bin+b.bin) = `qtrain/gpu-train/phone/model.int8.onnx` = stock NVIDIA base, NOT L2. Pack v3 must decide base vs L2 (L2 passed phone gate ALL 83.3->87.8) -> ask the user.
- Z1 done: `tools/asr/gpu/nv_shrink.py` (ONNX surgery; NeMo bakes centre 5000, slice rows [C-T,C+T-1) -> keep K=1000 rows each side, rewrite both 5000 constants). pe (1,9999,512)->(1,1999,512); int8 131.65 -> 115.27 MB. Outputs: qtrain/gpu-train/z1/{base,L2}.int8.onnx (+ base.fp32.onnx).
- Z1v done: `nv_shrink_parity.py` on 394 s of VAD pieces (ho_reciters/test_L1/ho_noisy): max |logit diff| 0.0, argmax diffs 0, RTF 0.0176 vs 0.0177 (base and L2). Full gate run tag Z1base (phone_Z1base) to confirm vs gate_base57.
- Z2 in progress: ORT 1.22 Android .so contains MatMulNBits. `nv_int4.py` (int4 blk32 sym + int8 Conv) -> z1/base.int4.onnx 79.5 MB; argmax differs on 8.9% frames vs int8, PC RTF ~+20% -> needs full gate (tag Z2base) + phone load/RTF before any ship.
Resume: check gate_Z1base summary == gate_base57; run `nv_gate.py Z2base x` (copy z1/base.int4.onnx into phone_Z2base/); ask user base vs L2 for pack v3; then S6.
- Gate Z1base == gate_base57 on all 100 metrics (only wall time differs) -> Z1 PASSED.
- User chose L2 for pack v3 (2026-11-08). Z2 now on L2: z1/L2.int4.onnx, gate tag Z2L2 vs gate_L2.
Resume: compare gate_Z2L2 vs gate_L2; if within noise -> phone load/RTF test; else pack v3 = z1/L2.int8.onnx (Z1 only, 115 MB). Then S6 (effort high).
- Z2 gate (Z2L2 vs L2): accuracy neutral (ALL verify 87.8->88.0, wrong_word_caught 92.9->92.3).
- Z2 phone bench (bee81250, ORT 1.22, 4 threads, OrtBench via app_process; tools in %TEMP%): L2 int8(Z1) load 1067-1089 ms, run 12 s 284 ms, 4 s 98 ms.
  int4 sym blk32: load 965, run12s 465 (+63%), 4s 158. int4 --acc 4: load 997, run12s 339 (+19%), 4s 115.
  -> Z2 REJECTED (user rule 2026-11-08: latency as important as accuracy). Pack v3 = qtrain/gpu-train/z1/L2.int8.onnx (115.27 MB, Z1 only).
Resume: S6 «مش متأكد» (effort high: user switches first), then pack v3 (medium), release (low).
- S6 implemented: Ctc.score(gr, words, noSkip) + NvAsr.ctcM (margin per skipped word; -1 = matched); ctc.best_score + s6_calib.py.
  Java/Python parity: flags 80/80, 95 margins max diff 1.2e-4. Calibration on gate_L2 (329 false reds, 1860 neg): m<0.5 5.5%/0.7%, m<1 10%/1.9%, m<2 21%/4.1% (false reds -> unsure / catches -> yellow). Chosen CTC_UNSURE = 1.0.
  JS: ctcJudge sets r.v=2 «مش متأكد» (yellow .rc-uns/.rc-unsw/.ht-w.uns), not counted wrong, never auto-donated; falls back to ctc() on old APKs.
Resume: pack v3 (L2+Z1 = qtrain/gpu-train/z1/L2.int8.onnx, new pack name, app deletes old nv.onnx), then release + full QA.
- Pack v3 built: quran-karim-data/pack-v3/asrnv3.zip (50.1 MB: a.bin, vocab, ver.txt=3, ORT libs) + asrnvp3.zip (42.7 MB); join md5 = z1/L2.int8.onnx. Uploaded to editions (6f62198) with the user's OK; raw URLs 200.
- App 5.16d (versionCode 62, sw quran-v57): ASRM ver 3 / 93 MB; NvAsr deletes the old nv.onnx before joining new parts. APK signer 7d8b31d2, installed on bee81250 (then the phone dropped off adb).
Resume: 5.16d QA done (QA-checklist). Waiting for the user phone test of pack v3 + S6; then Sprint C (S3/S5/S8 = 5.17, plans/5.11-plan.md).

## Sprint C = 5.17 (2026-11-08, session local_f5c88cb4)
Goal check: S3/S5 close the hifz loop (mutashabihat slips + talqin for new ayat) and S8 makes listening offline (complete app). None of them touches the ASR path or its latency (S3 voice = one LCS over ≤3 short choices on the final text; S5 reuses htv as is).
- S3 `#/mutash` (showMutashTest, mutBuild/mutNext/mutHit): opening = longest shared start with a look-alike (min 2 words), up to 3 continuations cut to the fewest words (≥4) that tell them apart; «من محفوظي»/«كل القرآن» (q.mutAll); wrong ayat drawn 40%; answers → hifzMark (q.hifzAyat). Voice: «سمّع التكملة», window.onRecite wrapper (mtv), pick when one choice ≥50% and no tie.
- S5 `#/talqin/<s>` (showTalqin, q.talqin {s,a,n}): 1 اسمع (playRange N times, text blurred, auto → 2), 2 اقرا, 3 سمّع (ht-w words; mic = htv with its own set/done) → result → «الآية اللي بعدها» (reciter starts by itself).
- S8 in player: the dl button opens «الاستماع» dialog (always; download part only in the app): surah/juz download, 3 fetches at a time through AudioCache, progress bar + cancel; sleep timer 15/30/60/«آخر السورة» (also checked on each ayah end, so it holds with the screen off).
- ui.js 9 new 5.17 checks; i18n D517; QA-checklist 5.17 phone lines 1–7. Version 5.17 / 63 / quran-v58, signer 7d8b31d2.
- Full QA passed (QA-checklist 5.17). bee81250 not on adb: APK quran-karim-v5.17.apk left ready.
Resume: the user installs/tests 5.17 (QA-checklist 5.17 lines 1–7) and the pack v3 update; then next sprint per plans/5.11-plan.md (S7 «النهارده», G8 waits for the user).
- GitHub release v5.17 published with the user's OK (2026-11-08).
- 5.17b (user notes on 5.17): talqin on a group (q.talqin.b, ≤20 ayat; next group same size); mutash: mic decides on partials + «إيقاف» uses the last heard (finals after stop were dropped), gold question box + the ayah before as context, «افتح الآية» = openAyahPage/#/s by mode; letter-exact choices (mutX = norm; و/ف no longer stripped), look-alikes need ≥40% shared words, same-surah ones only when their ayah before differs; word-for-word repeats ask for the next ayah (78 questions); telling words marked by position (order swaps too, «(آخر الآية)» for a prefix). 799 questions of 1550 keys. versionCode 64, sw quran-v59.
Resume: user phone test of 5.17b (QA-checklist 5.17 + 5.17b) and pack v3; next sprint per plans/5.11-plan.md (S7 «النهارده»).
Resume: new session «Sprint D» from plans/sprintD-session-prompt.md (S9, S10, S11 = 5.18).

## Sprint D = 5.18 (2026-11-08)
Goal check: S9–S11 make the app nearer to "near-complete" (study + teacher use); none touches the recogniser path, so no latency risk.
- CP S9 done: long press (480 ms) on a word in the text view -> dialog «معنى الكلمة» (wordsTab with the word picked by place,
  then by letters for the 9 ayat whose words file splits differently). Tap = ayah bar as before; hifz mode = no dialog.
  Pages: no real word boxes (wordBoxes only estimates from line rects), so pages keep ayah bar -> tafsir -> words tab.
  ui.js G518 S9 3/3. Usage stop raised to 85% by the user.
Resume: S10 backup reminder (exportBackup + syncAlarms + «آخر نسخة من # يوم»).
- CP S10 done: q.lastBackup set on «حفظ نسخة»; Settings «آخر نسخة من # يوم» (red at 30+ / none); «ذكّرني كل شهر» (q.bkRem,
  default on); syncAlarms adds one reminder 20:00 on lastBackup+30 (or first use +30; late -> today/tomorrow), tap -> #/backup
  opens Settings at the backup row. ui.js G518 6/6.
Resume: S11 teacher/student (QK2: code from the hifz test result + «طلابي»).
- CP S11 done: q.lastTest saved by both hifz tests (mushaf: range + forgotten ayat; words: range + score); «المراجعة» card
  «آخر اختبار» + «ابعت للمحفّظ» (q.myName asked once) shares text with a QK2: code (base64 JSON); More › «طلابي» (#/students,
  q.students {name: [results]}, dedupe by day/kind/range/score, max 100 each). i18n D518. ui.js G518 9/9.
- 5.18 built (versionCode 65, sw quran-v60, signer 7d8b31d2). QA: ui.js 280 with 1 FAIL = the More tile count test (15 -> 16
  with «طلابي»; fixed, group re-run 9/0) · data.py 28/0 · matrix 40/0 · donate 14/0 · recite_sim ok · i18n new strings done ·
  Maestro Phone_API35 + Tablet_API35 PASS. bee81250 not on adb: APK left ready. Report plans/5.18-report.html.
Resume: user phone test of 5.18 (QA-checklist 5.18) + 5.17b + pack v3; GitHub release v5.18 only on the user's word; next S12 spike / G10 rethink.
- GitHub release v5.18 published with the user's OK (2026-11-08), asset quran-karim-v5.18.apk.

## 5.19 plan: word meaning on mushaf pages (2026-11-08)
Goal check: pages are how most people read; the same exact word boxes also fix recite following / wrong-word colouring
(wordBoxes estimates today) = G7 gain, no ASR latency risk. Plan: plans/5.19-word-on-page-plan.md.
A = long press on a page with the estimated word (inverse of wordBoxes) + word chips to correct, all editions.
B = exact word boxes from tajweed_pages.align() (lab + mp + meta) -> web/editions/<id>-w/NNN.js, gate >=97% on a 60-word review.
Resume: wait for the user's go; A fits under 85% now, B after the weekly reset 2026-11-10 19:00 UTC.
- 5.19 B started (user: «ابدأ مرحلة B مباشرة» + a way for Haramain). word_boxes.py + app long press on pages (estimate on
  all editions; exact boxes behind EDS.kfgqpc.w, off). Gate NOT passed: review 57/60 (ayah-end circles); colour mask ->
  0 weak pages but 260 squeezed words; page 586 ayah rects offset from the scan (81:8/9 one word left). Details + Haramain
  route: plans/5.19-session-prompt.md. Stopped at weekly 82% / context 257k.
Resume: new session from plans/5.19-session-prompt.md after the reset 2026-11-10 19:00 UTC (first: page 586 rect check).

## 2026-11-08 (session 5.19 B, resumed at 82%)
- Goal check: exact word boxes on pages = word meaning + recite colouring on the mushaf (near-complete app); no ASR latency impact.
- Step 1 done: page 586 rects in web/editions/kfgqpc.js ARE off (81:8/81:9 a word left), so the app's own ayah highlight misses too.
  New tools/page_geometry/ayah_circles.py (template match of the font's ayah circle, scale 0.54-0.66 of line height,
  thr 0.38): 1691 ayah ends off a circle on 466 pages, 331 of them >60‰ (mostly pages 240-604). A book-wide data bug.
- word_boxes.py: colour mask removed; render now = prev circle + text + own circle (font draws Arabic digits in a circle);
  DTW with free start/end (f0/f1) inside SLACK=2.5 line heights past the first/last piece (LINE extents ±15‰). 586 81:8-10 right now.
Resume: write ayah_circles.py --fix (move interior line boundaries to matched circles, ordered assignment, ≤150‰), re-check,
  look at 2-3 fixed pages, then re-run word_boxes + reviews SEED 518/7 (gate 97%).
- Steps 2-3 done: ayah_circles.py --fix moved the interior boundaries onto the circles (cost 0.25×move, ≤150‰): ends off a
  circle by >30‰ 662 -> ~100 (the rest = circles the template misses at line ends). word_boxes: own circle NOT rendered,
  last piece skips 0.62 lh (rects start at the circle now), SLACK 0, squeezed words split with their neighbour by letters:
  squeezed <6‰ 0.063% (target <0.1% ✓). Reviews: SEED 518 59-60/60, SEED 7 59/60 (miss 23:115 w5 on p349, undetected
  circle); 11:25 «مبين» box takes half its circle (word fully covered, counted OK). Gate ≥97% passed on both.
- Step 4 in progress: EDS.kfgqpc.w on, QA_wb/QA_rect hooks, 5 G519 checks in ui.js, versionCode 66 / 5.19 / quran-v61.
Resume: read ui.txt in scratchpad (ED=kfgqpc ui.js), fix fails, build APK (signer 7d8b31d2), install bee81250 if on adb,
  HTML report, commit (incl. web/editions/kfgqpc-w/, kfgqpc.js, ayah_circles.py) + push; ask before GitHub release.
- QA kfgqpc run 2: 285/284 (only 5.17 S3 = random-question flake, passed in run 1). dAgo fixed (calendar days; n*24h was a
  day short across DST near midnight -> 5.15 S1 + 5.18 S10 fails). APK quran-karim-v5.19.apk signer 7d8b31d2, on Phone_API35.
- User asked: fix the Android text selection that the long press left on the word sheet title: wordSheet clears any
  selection for 1.2 s after opening + title/words user-select:none; new G519 check. Verified on the emulator (67:8 «فيها»).
Resume: wait for ui-kfold/shamarly/harmain + donate/recite/i18n (scratchpad), re-run ED=kfgqpc ui.js for the new check,
  then commit + push, HTML report, ask before GitHub release. Haramain word boxes (step 5) not started.
- Haramain (user: «دقة اختيار الكلمات في طبعة الحرمين ضعيفة»): word_boxes.py now takes ED=harmain (web/pages + quran-data.js r).
  Straight DTW on the photos: squeezed 0.009%, reviews 518 58/60, 7 ~57/60 (slivers at line ends = perspective);
  SLACK=0.8 made it worse (0.3% squeezed, 5 slivers). Gate not passed -> Haramain stays on the estimate; harmain-w deleted.
  Next for Haramain: the planned route (tajweed_pages align() in the warped frame + inverse warp; Windows port of /mnt paths).
- QA: kfold 280/0.
Resume: wait for shamarly/harmain/donate/recite/i18n, re-run ED=kfgqpc ui.js (new selection check), commit + push, report.
- Haramain word boxes (2026-11-09, side session): goal check = word picking on the Haramain pages (user: weak) -> near-complete app.
  New tools/page_geometry/word_boxes_harmain.py: tajweed_pages.align() in the straightened frame (quads.json warp), word
  columns -> its line slot -> inverse homography -> bbox per mille. Only the piece with most of a word's columns is kept
  (the print never splits a word; spills onto the line before were the slivers). /mnt paths in pipe/words/tajweed_pages
  -> repo-relative ROOT (run with PYTHONUTF8=1). GATE PASSED: 77,426/77,428 words, squeezed 0.000%, reviews SEED 518 60/60,
  SEED 7 60/60. EDS.harmain.w added (app.js), harmain-w dropped from PLAY=1 build, 4 G519 harmain checks in ui.js.
Resume: full QA (data.py + ui.js for kfgqpc/kfold/shamarly/harmain), build quran-karim-v5.19.apk, signer 7d8b31d2, commit + push.
- QA 5.19 (alone, no overlap): data.py 28/0; ui.js kfgqpc 286/0, kfold 280/0, shamarly 280/12, harmain 286/19 (4 new G519
  harmain checks PASS). The shamarly 12 + harmain 19 fails are older: a harmain run without EDS.harmain.w gives the same 19
  (+ the 4 new ones). They are mic/hifz/recite tests written for King Fahd page numbers (2:255 -> p.42 etc.). Follow-up.
  APK quran-karim-v5.19.apk 48.5 MB, signer 7d8b31d2 OK, 540 harmain-w files inside (dropped in PLAY=1).
Resume: 5.19 done + pushed. Next: make the shamarly/harmain mic+hifz ui.js checks edition-aware (page per edition);
  ask the user before the GitHub release.
- QA repair (user: «repair the QA list»), 2026-11-09: ui.js page refs made edition-aware (QA_pageOf in app.js; P255 = page of
  2:255, PL = page of 112:1 instead of King Fahd 42/604); phone #19 lets an ayah running on from page 50 keep its mask.
  Result: harmain 19 -> 12 fails, shamarly 12 -> 14 (5 new = prayer/imsakiya/backup timeouts, passed in earlier runs: flaky).
  Still failing on shamarly/harmain (test logic written for King Fahd, not yet shown to be app bugs): vertical 2:255 lands
  on the ayah's 2nd page (harmain 36 vs pageOf 35); hifz line reveal 21->0 (whole page recited); G6 last-ayah/auto-flip,
  5.14, S1, S7, 5.15b 2/7, 5.15c ("#/p/undefined"), 5.16d; U3 [103,0,0] + U4 -1 on harmain (check: may be real).
Resume: go through these fails one by one in tools/qa/ui.js (ED=harmain first, U3/U4 may be a real app bug), re-run
  shamarly + harmain alone, then kfgqpc/kfold to be sure nothing regressed.

## 2026-11-09 — edition-aware ui.js (harmain/shamarly)
- Goal check: QA all four editions = the "near-complete app" goal; cheaper than new features at 87% usage.
- APP bug fixed (web/app.js): hifz «اكشف التالية»/auto-turn turned past the last Quran page into the du'a/index pages (Q.count instead of Q.last) — Haramain went 541->542 instead of ending the test. King Fahd unaffected (last = count-1).
- TEST bugs fixed (tools/qa/ui.js): `'\b'` in RegExp strings was a backspace (5 checks: G6, 5.14, S1, S7, 5.15b); page 600/601 -> P6/P6n = PL-4/PL-3; vertical mic accepts either page 2:255 lies on (Haramain 35/36); hifz line-by-line uses 112:1-2 on the last page (2:255 ends Haramain pages so all lines revealed = right); U3 uses 3:7 when 2:255 spans pages. U4 passes alone on harmain (not an app bug).
- data.py web: 28/0.
Resume: DONE 5.19b — all four editions ui.js 0 FAIL (harmain 286, kfgqpc 286, kfold 280, shamarly 280 earlier + its only fail #251 de-flaked: mutash test uses the answer key). quran-karim-v5.19b.apk rebuilt (about text 5.19b), signer 7d8b31d2. Next: back to the roadmap.

## 5.20 step 1 — phone (2026-11-09)
Goal check: yes, confirms the 5.19b fixes on a real device before release.
- bee81250 connected; quran-karim-v5.19b.apk signer SHA-256 7D8B31D2 ✓, `adb install -r` Success.
- User phone test: long-press word meaning on King Fahd + Haramain, hifz test stops at the last Quran page (Haramain), ayah circle tap — all pass.
- ED=shamarly ui.js re-run: 280/0 PASS → all four editions 0 FAIL.
- Usage: weekly 91% (resets 2026-11-10 19:00 UTC) → step 2 (G10, Opus+GPU) waits for the reset.
Resume: shamarly re-run result -> ask the user about GitHub release v5.19b -> after the weekly reset start step 2 (G10 rethink).
- GitHub release v5.19b published (2026-11-09, user approved): https://github.com/drmalek1987/quran-karim/releases/tag/v5.19b — signer 7d8b31d2 ✓.
Resume: step 2 G10 rethink (high effort, Opus, GPU).

## W-track (2026-11-09)
- Step 1-2 ✓ (c808980): plans/decisions.html, plans/harmain-permission-letter.md, build.sh PLAY=1 drops harmain-w.
- Step 3 ✓ (W1+W2): QWB repaints hifz/rd overlays when boxes land; showPage preloads n,n+1 boxes; ayahAt uses nearest word box. README updated.
- Step 4 W0 baseline (tools/qa/geo_check.js, 30 pages SEED 518) kfgqpc / harmain:
  long-press boxes 99.8/100, estimate-only 63.1/53.0 · hifz mask IoU 0.356/0.307 (IoU>0.5 35/27%) · line assign 95.4/95.4
  · page end exact 100(no mid-ayah page in sample)/73.3 · ayah tap 100/100.
  Weakest: hifz mask/reveal (x-split estimate) → step 5; harmain page end off by 1 word on 8/30 → step 6.
Resume: step 5 W3 masks from word boxes (Opus, medium) after ui.js kfgqpc confirms step 3.
## G10 rethink (2026-11-09)
Goal check: noise/low-voice robustness is the biggest gap left to the >95% recognition goal (W-track step 9).
### Diagnosis (run 2 = nv_curr.log 02:39–06:44, init P3_FINAL_L2)
- Nothing moved. init_G10 → step 3000: test_L1 4.17→3.85, test_L2 8.23→7.77, test_L3 17.64→16.42, noisy20 8.61→8.64,
  noisy10 17.20→17.32, noisy5 24.42→24.33, train_G10 39.84→39.60. Only the clean L1/L2 share helped a little; noise 0.
- train_G10 CER 40 is mostly LABELS, not noise. 150 train_G10 clips with the L2 model (pieces CER): noisy copy 39.8,
  whole-clip 36.9, the SAME clips before augmentation 24.9. By source (noisy / clean): L1 31.5/3.5, L2 32.6/6.0,
  L3 39.1/13.5, tlog replay 44.0/37.0. 23 of 66 replay clips have clean CER >50%: the audio holds a neighbouring ayah
  (misaligned tlog segments). qtrain/gpu-train/data/label_check_all.json (2026-11-03, whisper) already found 52% of tlog
  train >20% CER (39% >50%) and filtered_ids.json kept 10717 — but nv_curr.py and g10_prep.py read the unfiltered
  train.json. So 45% of the G10 variants and the 30% replay share of EVERY level (L1/L2/L3/G10) trained on ~40% wrong targets.
- The noise recipe was also too hard/odd: babble = 3–6 other Quran readers summed (competing words, label ambiguous) 51.1 vs
  33.4 clean; synthetic reverb rt60 0.3–1.0 (full wet) 56.1 vs 32.9; SNR 0–5 51.2; speed 0.7/1.5 atempo extremes; 2 fixed
  pre-baked copies per clip (no variety); 8.5% of variants >16 s are cut by load() (16 s cap) while the label stays full.
- Optimiser: LR peak 1e-5 (200 warm-up) then linear decay → <5e-6 by step 1450, freeze lower 1/3, BATCH_SEC 60 × ACC 2,
  fp32, BN eval (ok). With the bad targets the gradient was mostly noise; a tiny LR kept it flat.
- Proxy gate (G10): own = noisy10 < ref, every noisy ≤ ref (no tolerance on 100-clip sets), ho/tlog ≤ ref+0.3, and
  test_L1/test_L2 NOT checked — but the phone gate (p1b_port_eval ctc_up, ALL 93.0 for L2) is exactly the user's long
  recordings (test_L*). Run 2 failed it anyway (noisy10 never < 17.2).
### New recipe = level G10b in nv_curr.py (+ g10b_noise.py, g10b_sweep.sh)
- Data: only trusted labels — L1 + L2 train + replayT = tlog train with label_check CER ≤ 5 (4048 clips/9.0 h); L3 and the
  unfiltered replay out; clips ≤ 14.4 s (no 16 s truncation). Mix L2 .4 / L1 .2 / replayT .4.
- On-the-fly noise (g10b_aug, p .75; the other 25% = clean replay with the P3 lead/trail-quiet augment): speed 0.9–1.1
  (p .5), room reverb rt60 0.2–0.6 with a strong direct path (p .3), lead/trail quiet, then noise over the whole padded clip
  at SNR 5–20: 50% real background from the user's own recordings (qtrain/g10b/noise, 32 files / 12.9 min, gaps 18 dB under
  speech, from g10b_noise.py), 35% white/pink/brown, 15% babble (3 clips) at SNR ≥ 10; level −45..−20 dBFS (low voice).
  DEMAND (held-out noisy sets) never used. More real noise (other DEMAND rooms / MUSAN noise) can be dropped into
  qtrain/g10b/noise later — needs a download, waits for the user's OK.
- Optimiser: freeze lower 1/2 (upper half + CTC decoder train, 57.3M params), warm-up then linear decay to 10% of peak,
  BATCH_SEC 40 × ACC 3 (lesson 6), fp32 (lesson 1), BN eval (lesson 2), PLAIN targets (lesson 4).
- Proxy gate G10b: own = mean(noisy10, noisy5) < ref; test_L1, test_L2, ho_reciters, ho_retasy, tlog ≤ ref+0.3;
  noisy20 ≤ ref+0.2. train_G10b = 150 trusted clips with a fixed (seeded) noisy copy; init CER 15.0 (vs train_G10 39.8).
- Steps 5-6 ✓ (W3+W4): hzWb/hzWbMask masks from word boxes; lastWordOnPages uses last measured box. geo_check: mask IoU 0.356→0.923 (kfgqpc), 0.307→0.944 (harmain), IoU>0.5 99.8/100%; harmain page end 73.3→100%. ui.js kfgqpc 287/0, harmain 287/0 (new G520). Note: ayah-number circles stay visible in hifz masks now (numbers only, no spoiler).
Resume: step 7 W5 kfold + shamarly word boxes (Opus high), G10 rethink running in parallel.### LR sweep (g10b_sweep.log, 300 steps, warm 50, from P3_FINAL_L2; ref = init_G10b)
| LR | test_L1 | test_L2 | noisy20 | noisy10 | noisy5 | tlog | ho_retasy | mean(n10,n5) |
|---|---|---|---|---|---|---|---|---|
| ref | 4.17 | 8.23 | 8.61 | 17.20 | 24.42 | 6.84 | 6.81 | 20.81 |
| 3e-5 @300 | 4.42 | 8.20 | 8.04 | 16.74 | 23.24 | 5.91 | 5.54 | 19.99 (19.81 @150) |
| 6e-5 @300 | 3.90 | 8.07 | 8.01 | 16.77 | 23.51 | 5.89 | 5.68 | 20.14 (19.90 @150) |
| 1e-4 @300 | 4.06 | 7.48 | 7.89 | 16.68 | 23.93 | 5.88 | 5.50 | 20.30 (@150 test_L1 4.53 → fail) |
- All three move in 300 steps what run 2 never moved in 3000 (noisy5 −0.5..−1.2, noisy10 −0.4..−0.5, tlog/ho −1).
  6e-5 = the only one better than ref on noisy10, noisy5, test_L1 AND test_L2 → long run.
- 2026-11-09 18:10 long run STARTED: `nohup sh tools/asr/gpu/g10b_run.sh` (LR 6e-5, warm 200, 3000 steps, EVAL 300,
  SAVE_ALL) → log tools/asr/gpu/g10b.log, checkpoints nv_out/G10b/step*.nemo + best.nemo + last.nemo. ~0.8 s/step, ETA ~19:15.
Resume: read g10b.log → pick best step(s) → nv_gate.py G10b nv_out/G10b/best.nemo (int8 bench) → p1b_port_eval ctc_up
  (must be ≥ ALL 93.0 of pack v3 and better on noise) + RTF on bee81250 → only then pack v4 (L2→G10b + Z1), rollback v3.
  Not exported/shipped. Side finding: L1/L2/L3 replay also used the unfiltered tlog — a later L2 retrain on replayT may help clean too.
## Pause 2026-11-09 18:35 (weekly usage 97%, user: stop at 99%, resume after reset 2026-11-10 19:00 UTC)
- Done today: W steps 0-6 (21dbc03), G10b diagnosis + recipe (6ec679f).
- Running unattended: G10b long run (tools/asr/gpu/g10b.log, 3000 steps, ETA ~19:15, ckpts nv_out/G10b/); noise download agent (DEMAND non-held-out rooms → qtrain/g10b/noise/) may finish or be partial — check qtrain/g10b/noise_dl.
- Step 7 kfold was stopped mid-way: its WIP (ayah_circles.py, word_boxes.py, web/editions/kfold.js) is in `git stash` "wip-kfold" — review before applying (kfold.js rect changes unverified).
Resume (new session, plans/5.21-session-prompt.md): 1) G10b: nv_gate on best.nemo → p1b_port_eval ctc_up (ship only ALL ≥93.0 + noise better + RTF not worse); if noise data landed, plan G10c with it; consider retraining L2 on replayT. 2) Step 7 W5 kfold (git stash pop wip-kfold, verify) then Shamarly → release 5.20. 3) Step 8 W6. Effort per plan via Agent effort (user authorised, never ask). User: continue without questions.- Noise landed: 13 DEMAND rooms (65 min) as qtrain/g10b/noise/demand_<ROOM>.wav (held-out DLIVING/DKITCHEN/PCAFETER/TCAR excluded); MUSAN skipped (11 GB only). Used from the next run (G10c). noise_dl/ (3.2 GB) can be deleted.
- Cleanup (user asked): deleted qtrain/g10b/noise_dl (3.1 GB) + failed/old ckpts nv_out/{G10,L3,L3_try1,v1_badtarget,v3_tightclips,v4_aug} (~7.7 GB). Kept L1, L2 (shipped), G10b. MUSAN downloading in bg → noise part as qtrain/g10b/noise/musan_*.wav (tarball + extract deleted after). Check: ls qtrain/g10b/noise | grep -c musan (~930 expected).
- 2026-11-09 ~19:45: MUSAN paused by user (laptop leaving): qtrain/g10b/musan_dl/musan.tar.gz = 7.6 of 10.32 GB. Resume: cd that dir; curl -L -C - --retry 20 -o musan.tar.gz https://www.openslr.org/resources/17/musan.tar.gz; then tar -xzf musan.tar.gz musan/noise; ffmpeg each wav → ../noise/musan_<name>.wav (16k mono s16); delete tarball + musan/. G10b DONE 19:02, best step 2100 (nv_out/G10b/best.nemo) → nv_gate next.
