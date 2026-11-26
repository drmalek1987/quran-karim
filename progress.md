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
- 2026-11-11: user PAUSED the W-track/G10 plan. MUSAN done (930 files in qtrain/g10b/noise). A separate session makes a source-code review + fix plan (plans/code-review-plan.md when approved). Resume W-track only on the user's word (plans/5.21-session-prompt.md).

## Code review + fixes (plans/code-review-plan.md, approved 2026-11-11)
- اللي لسه: G1 trivial JS, G2 untrusted input (QK1/QK2, backup consent keys, prompt), G3 mic/timer lifecycle, G4 small Java hardening, G5 NvAsr session lifecycle, G6 EdStore/Donations, G7 build scripts + sw.js. G8 deferred (perf, asr.js removal, i18n) = user decision.
- Goal check: stability/privacy/mic lifecycle for a near-complete app; no change to model accuracy. W-track stays paused.
Resume (code review): G1 (qk-dev) + G4 (Fable) started in parallel; nothing committed yet.
- 2026-11-11 code review: G1-G7 done and pushed (f44dbac Java G4-G6, ace3d37 G7, 2bee640 G1, G2+G3 next commit). Deviations: JS does not stop recognisers on visibilitychange (page is hidden during the mic permission dialog) - native onStop does it; a model that fails createSession is NOT deleted (user can remove it in Settings > Downloads); setAllowFileAccess(false) not applied (needs emulator).
Resume (code review): 1) emulator Phone_API35 smoke of the Java changes (alarm 2 min ahead, widgets, qibla approximate, edition download -> Back x2 -> reopen -> resume) 2) user phone test of the mic (rapid on/off, Home during recitation) 3) user decision on G8 (perf, asr.js removal, i18n). No release without full QA + signer 7d8b31d2 + the user's word.
- 2026-11-11 (late) code review, emulator smoke DONE on Phone_API35 (details in QA-checklist.md): hash extra, Back exit + relaunch, reminder → notification → `#/azkar/e`, both widgets, qibla approximate-only, download → Back → reopen (busy → ready once), `setAllowFileAccess(false)` kept. Fixed on the way: `ACCESS_NETWORK_STATE` added (DonateJob never scheduled on Android 14+; **new permission → mention in the store notes at the next release**), AudioCache kept 0-byte/short mp3 for ever, EdStore told a destroyed WebView. G3-9 late-callback guards done (6 `isConnected` lines in web/app.js). Goal check: stability of a near-complete app; recognition accuracy untouched.
- Open, found by QA (not fixed, hifz matcher = user decision with G8): «سمّع التكملة» in المتشابهات never decides by voice when one choice is a word-for-word prefix of another (e.g. «أن الله يعلم ما يسرون وما يعلنون» / «… إنه»): `mutHit` gives both 1 → tie (app.js ~4855). Shows as a random FAIL of ui.js #250.
Resume (code review): 1) user phone test of the mic (rapid on/off ×10, Home during recitation → mic indicator off, `window.nvSeq` +1 per piece) 2) user decision on G8 (perf, remove web/asr.js, i18n gaps) + the mutashabihat prefix tie above 3) release only on the user's word: bump version/sw cache, full QA, signer 7d8b31d2, store note for ACCESS_NETWORK_STATE. W-track/G10 stays PAUSED.
- 2026-11-12 code review second pass (user: "split the rest by priority and start"): mutashabihat prefix tie fixed, i18n dialog/toast gaps filled (qk-dev, diff reviewed), asr.js kept (QA model check uses it), airplane-mode download test PASS, #250 de-flaked; QA 0 FAIL ×4 + data.py 28. APK (5.19b, unreleased) installed on the user's phone over USB; `phone-checklist.md` written. Goal check: near-complete app polish; recognition accuracy untouched.
Resume (code review): 1) wait for the user's phone results (`phone-checklist.md`, mic part first) and fix what fails 2) G8 perf only after measuring on the phone (reciteHear re-normalise, rdPick scan, vertical 604 pages) 3) release only on the user's word: bump version/sw cache, full QA, signer 7d8b31d2, store note for ACCESS_NETWORK_STATE. W-track/G10 stays PAUSED.
- 2026-11-12 user phone test of 5.19b (unreleased): all 9 parts PASS incl. the mic. Fixed after it: widget/notification hash lost when the system recreates the app (MainActivity `pendingHash` until onPageFinished, verified on the phone with `am kill`), widget title/ref open the ayah, native confirm() → app dialog `askYes` (13 sites). User: G8 performance is acceptable as it is → closed. Code-review plan DONE.
- 2026-11-12 RELEASE 5.20 (user: "release 5.20 after the commit, upload the APK to GitHub, shut down the PC"): versionCode 68, sw quran-v64, signer 7d8b31d2, QA ×4 0 FAIL (shamarly on a re-run: intermittent prayer-times group, cause not found, check instrumented – see QA-checklist.md), data.py 28. GitHub release v5.20 with the APK. Store note for ACCESS_NETWORK_STATE in store/PLAY-REVIEW.md. Not done: Play bundle (build-aab.sh is not ported to Windows).
Resume: 1) W-track/G10 on the user's word (plans/5.21-session-prompt.md): nv_gate on nv_out/G10b/best.nemo -> p1b_port_eval ctc_up; it serves the >95% recognition goal 2) if the prayer-times QA group fails again, read the JSON detail the check now reports 3) small leftovers: port build-aab.sh to Windows, Android 5.x paths, real donation upload.

## Google Play prep (2026-11-12) – plans/play-store-plan.md
- Rules checked on the web (closed test 12 testers x 14 continuous days for personal accounts, target API 36, AAB, SCHEDULE_EXACT_ALARM ok, downloaded .so forbidden, 16 KB from 2027-02-01).
- BLOCKERS fixed: ONNX Runtime .so packaged in APK/AAB (NvAsr loadLibrary), PLAY build drops Haramain + adhan recordings + Darwish + tanwir (flags NO_BOOKS / NO_ADHAN_AUDIO, PLAY_KEEP to keep). Risks left for the user: jadwal i'rab copyright, package name availability.
- New: build-aab-win.py (bundletool 1.18.3 pinned) -> quran-karim-v5.20-play.aab 38 MB, validated, universal APK runs on Phone_API35. Store: store/listing-play.md, data-safety.md (field by field), store/play/ (icon, feature graphic with سماع/ترتيل, 7 phone + 4 tablet shots), docs/privacy-policy.html for GitHub Pages, store/PLAY-UPLOAD-GUIDE.md.
- Goal check: a near-complete app that can actually reach users through Play; recognition accuracy untouched (W-track/G10 still PAUSED).
Resume (Play): user creates keys/upload.jks (keytool command in the guide), puts the support email in docs/privacy-policy.html, turns on GitHub Pages, then rebuilds signed AAB and follows store/PLAY-UPLOAD-GUIDE.md. Test the recogniser on the phone from the internal test track (first build with packaged .so). Next app release = versionCode 69 (5.21).
- 2026-11-12 (later): app name → «يسّرنا» (Play: «يسّرنا - حفظ وتسميع القرآن» / «Yassarna - Quran Hifz by Voice»; «حافظ», «قارئ», «رتّل», «صدور» were already on Play). Theme green → navy #1e3a5f + gold #c09a2e (user picked from 4 options rendered by tools/qa/theme-options.js): web/style.css light+dark, Android status/nav/widgets/notification colour, launcher + store icons recoloured (tools/retheme.py), feature graphic + 11 store screenshots re-shot from the Play build. Home-screen header text inside the app still says «القرآن الكريم» (user not asked yet).
- 2026-11-12 name → «لوح» / Lawh (user choice): Noto Nastaliq word tooled on the Met cover icon, cover = store/fg-options/lawhB.png (blend.js b3: QK_NOTO=1 QK_NOH1=1 QK_AYSIZE=32 QK_SUF=-nna230 QK_AYAH=85,21-22). QA data.py + kfgqpc ui.js after rename.
- 2026-11-12 APKs made private: all 11 (v4.8…v5.20) copied to private repo drmalek1987/quran-karim-builds (sizes verified), then deleted from the public releases (releases/notes kept). Rule in CLAUDE.md.
- 2026-11-12 signed Play bundle: quran-karim-v5.20-play.aab 39.2 MB, upload key (keys/upload.jks, SHA-256 71:18:F1:…:6C:50), bundletool validate OK, no Haramain/adhan/Darwish/tanwir inside. Next = user: Play Console steps in store/PLAY-UPLOAD-GUIDE.md from step 10.
- 2026-11-12 Play application id → com.lawh.quran (store name «لوح - قرآن كريم»); GitHub build keeps com.quran.karim. Verified on Phone_API35: both installed side by side, Play build launches, no crash; signed AAB rebuilt + validate OK. Share-ayah (ShareProvider authority now <appId>.share) not clicked through on the emulator.
- 2026-11-12 PAUSED (user). Uncommitted: in-app name → «لوح» (web/app.js header/welcome/share-image/imsakia/khatma+teacher messages/settings hint, web/index.html h1, web/i18n.js, web/icons PNGs = new icon, README title, docs/index.html, plans/play-store-plan.md title, store/permission-requests.md letters, store/listing.md marked old). QA running in background (log: scratchpad qa5.log, lost on session end). Resume: re-run QA (data.py + ui.js ×3, one at a time, no other headless Chromium in parallel), PLAY=1 build-win.py + build-aab-win.py, commit those paths, push.
- 2026-11-13 resumed: QA green, signed AAB rebuilt, rename committed. Next = user: Play Console from guide step 10 (GitHub Pages on, then Create app «لوح - حفظ وتسميع القرآن»).
- 2026-11-13 Play Console (user): listing AR+EN, App content (sign-in No, IARC, data safety, health No, ad ID No), closed test «Alpha» with Google Group lawh-testers@googlegroups.com (anyone can join), feedback drmalek2000@gmail.com. Play refused minSdk 21 (automatic protection) → PLAY build minSdk 24 (MIN_SDK=, GitHub build keeps 21). 5.20 (68, minSdk 24) SENT FOR REVIEW to closed testing on 2026-11-13.
- 2026-11-13 5.21 / versionCode 69 ready, NOT uploaded yet: uses-feature required=false for location.gps/network, microphone, touchscreen (Play showed 4 implied required features → hid the app from Wi-Fi tablets); English About + document.title «The Noble Quran» → «Lawh»; sw.js quran-v65. Files: quran-karim-v5.21.apk (GitHub, com.quran.karim, private release), quran-karim-v5.21-play.aab (com.lawh.quran). Signer 7d8b31d2, validate OK, 0 required features.
- ONE codebase for both builds: build-win.py = GitHub build (com.quran.karim, minSdk 21, KEEPS Haramain, adhan voices, Darwish, tanwir); PLAY=1 = Play build (com.lawh.quran, minSdk 24, drops those four; PLAY_KEEP=tanwir,harmain,... keeps any). User wants Haramain + tanwir kept in the GitHub build (they are). Advice given: add tanwir to Play after production approval (author d.1973, life+50 expired in EG/SA/TN); Haramain only with Dar Misr permission.
- Play update recipe: bump versionCode/versionName + web/index.html version (AR+EN) + web/sw.js cache → full QA → build-win.py (GitHub APK → private release) → $env:PLAY="1"; build-win.py; build-aab-win.py → Play Console › Closed testing (later Production) › Create new release › upload AAB › Send for review. keys/upload.jks + password must be backed up off this PC.
Resume (Play): 1) when 5.20 is approved: send testers the WhatsApp message (group link + https://play.google.com/apps/testing/com.lawh.quran), need ≥12 opted in for 14 days 2) then upload quran-karim-v5.21-play.aab (69) as a closed-test update 3) after 14 days: Dashboard › Apply for production (answers in store/listing-play.md §5). Next app release after 5.21 = 5.22 / versionCode 70 (the W-track work planned as "5.21" in plans/5.21-session-prompt.md moves to 5.22; a new model pack is data and needs no app release).

## Plan resumed 2026-11-13 (plan: C:\Users\Compumarts\.claude\plans\now-i-need-you-peppy-whistle.md; W-track/G10 pause lifted by the user)
- Rules added by the user today: Fable only plans/checks/redirects, other models execute; Fable and Opus always at LOW effort (raise for one item only after two failures, and say why).
- Goal check (G10b gate): noise robustness is the biggest gap left to the >95% recognition goal; latency must not get worse.
- G10b gate DONE = PASS (best.nemo step 2100 vs shipped L2 / pack v3, phone pipeline int8, same commands for both): ctc_up ALL 93.0 → 93.7 (same-clip 93.9), noisy SNR 20/10/5 95.2/88.8/82.1 → 96.3/89.5/82.8, every clean set up (test_L1 99.2→99.3, test_L2 98.0→98.4, test_L3 96.9→97.7, ho_reciters 96.1→96.8, ho_retasy 98.1→99.0), wrong-caught ALL 98.0 → 99.3, ayah id 84.6 → 86.9, empty-output clips 6 → 1. Speed equal: PC RTF 0.018 both, load 1.96/1.98 s; phone bee81250 (OrtBench, 4 threads) load 2013/2008 ms, 12 s piece 487/486 ms. First-word latency on the phone not measured (needs the app's model swapped + live mic); VAD and decode time unchanged.
- Outputs: qtrain/eval/out/gate_G10b, gate_L2now, port_same; pack v4 candidate = qtrain/gpu-train/z1/G10b.int8.onnx (115 MB, Z1 pos-table trim via nv_shrink.py — Z1 was already in pack v3). qtrain/gpu-train/phone_L2now (590 MB duplicate) can be deleted.
- Tooling note: p1b_port_eval silently drops clips whose saved log-prob piece count is one more than piece_texts (46 for L2, 35 for G10b) → compare models on the same clips (exclude list qtrain/eval/out/port_same/exclude.json). ctc_up now takes 2–10 min.
- Not shipped: pack v4 upload to the `editions` branch waits for the user's word (rollback = quran-karim-data/restore-asr-5.16c).
Resume: 1) pack v4 zips built locally + verified → upload on the user's word, then phone test in noise 2) G10c (G10b recipe + DEMAND/MUSAN noise in qtrain/g10b/noise, init from G10b best) sweep → long run → same gate, must beat G10b 3) W5 kfold agent result → review → Shamarly (Opus low) 4) leftovers → release 5.22 (versionCode 70) on the user's word 5) W6.

- 2026-11-13 W5 kfold DONE (Opus; reviewed by Fable on the review sheet): stash wip-kfold verified and its content kept (`ayah_circles.py --rebuild` + medallion template `kfold_medallion.npy`; the old kfold rects had 1093 ayah ends off a medallion on 400 pages), pages 1–2 via `frame12()` with hand-measured medallions (valid for the 794x1139 scans), `word_boxes.py` CW 0.55 → `web/editions/kfold-w/` (604 files, 2.6 MB, ships in the APK from git), `EDS.kfold.w`. Review 60/60 (SEED 518) and 60/60 (SEED 7); all 6236 ayat have exactly rWords() boxes. geo_check kfold (30 pages, SEED 518): long-press 64.2 → 100%, hifz mask IoU 0.373 → 0.932, line assign 100, page end 100, ayah tap 100; kfgqpc unchanged. ui.js kfold 290/0, data.py 28/0. Goal check: near-complete app — word features now exact on a third edition; recognition untouched. The stash "wip-kfold" is now redundant (same content is committed); left in place.
- Open: kfold tajweed layer (kfold-tj, in the zip) not regenerated after the rect rebuild — audit alignment before 5.22. pack v4 (G10b) built locally in quran-karim-data/pack-v4 (asrnv4.zip, asrnvp4.zip, ver.txt 4, join md5 = z1/G10b.int8.onnx); shipping it NEEDS an app release (`ASRM ... ver: 3 → 4` in web/app.js; upload zips to `editions` first) → goes into 5.22, on the user's word; phones on v4 cannot be moved back by data alone. Check before 5.22 that the Play build does not load ORT .so from the downloaded pack.
Resume: 1) G10c training running (tools/asr/gpu/g10c.log) → gate vs G10b; the better one ships as v4 2) W5 Shamarly word boxes (Opus low, running) + kfold-tj audit 3) leftovers → release 5.22 (versionCode 70) on the user's word 4) W6.
- 2026-11-13 G10c (G10b recipe + DEMAND/MUSAN noise weighted user 30 / DEMAND 35 / MUSAN 35, init G10b): stopped at the LR sweep — no LR lowers mean(noisy10, noisy5) below G10b (19.49 → 19.51 / 19.72 / 19.86 at 1e-5 / 3e-5 / 6e-5; clean slightly better). No long run, no checkpoint. Level G10c stays in nv_curr.py (backup nv_curr.py.bak_g10b). → G10b is the model for pack v4.
- 2026-11-13 Noise-loss diagnosis (G10b outputs, per lost word; scripts in the session scratchpad noise_attr.py/analyze.py): lost words come from the VAD, not the model — SNR 10: VAD 74.0 / acoustic 8.3 / matcher 17.7 %; SNR 5: 84.7 / 6.8 / 8.5; clean ho_reciters: 86.8 / 0 / 13.2. Same model + same decision with an ideal VAD (whole clip + padding): verify 89.0 → 98.0 (SNR 10), 82.2 → 97.5 (SNR 5), 96.8 → 99.9 (clean), wrong-caught about unchanged. Relaxing the ctc_up threshold gives ≤ +0.5; a denoiser is not needed. Worst 10% of clips hold 60–68% of the loss (ayah tails cut; cafeteria and living-room noise worst).
- Goal check: VAD tuning is now the shortest path to >95% (also lifts clean), with no model size/speed cost → VAD sweep in bench.py (adaptive noise-floor threshold, hangover, keep empty pieces; limits: end-of-piece wait ≤ +150 ms, decode ≤ +10%) running; port to NvAsr.listen only after it passes the full gate, then phone test.
- 2026-11-13 W5 Shamarly DONE (Opus low): old rects were wrong (2870 of 6236 ayah ends > 12‰ off its hexagonal mark) → rebuilt on a Shamarly mark template (`shamarly_mark.npy`, threshold 0.65, clean score gap), pages 2–3 via `frame23()`, 7 ayat moved to the next page in the `p` map (2:98, 4:137, 15:77, 26:190, 27:7, 39:58, 40:4); `web/editions/shamarly-w/` (521 files, 3.2 MB), `EDS.shamarly.w`. Review 59/60 (SEED 518; 58/60 if doubtful cell #16 counts as a fail) and 59/60 (SEED 7) — passes the 97% gate at the line. All 6236 ayat have exactly rWords() boxes. geo_check shamarly: long-press 64.3 → 100%, mask IoU 0.371 → 0.925, line assign 96.5 → 100, page end 86.7 → 100, ayah tap 100. ui.js shamarly 290/0, data.py 28/0. kfold rebuild re-run = byte-identical.
- Open before 5.22: the tajweed layers kfold-tj and shamarly-tj (in the edition zips on `editions`) were built from the OLD rects (tajweed_scans.py aligns to them) → regenerate both and re-upload the zips (upload = user's word); kfold-tj looked right on 5 sampled pages, shamarly-tj not checked. Shamarly check mode does not cover pages 2–3. All four editions now have measured word boxes.
Resume: 1) VAD sweep result → if it passes, port to NvAsr.java (Opus low) + bench parity + phone test 2) regenerate kfold-tj + shamarly-tj, full ui.js on 4 editions 3) 5.22 (versionCode 70): pack v4 = G10b (`ASRM ver 4`, zips to `editions` first), leftovers (prayer-times flake, fold 640px floor), Play .so check — release on the user's word 4) W6.
- 2026-11-14 VAD fix (bench → NvAsr.java, local commits b01fb7b bench.py, 46d0141 NvAsr.java). Root cause of the noise AND clean losses: the room-floor tracker in `listen` climbs toward the speech level during recitation (doubles in ~1.6 s) so `e > 3*floor` fails mid-ayah and pieces are cut/dropped. Fix: speech blocks raise the floor 10x more slowly (RISE_SPEECH 0.0005), except after 50 speech blocks in a row (CATCH_BLOCKS, 5 s — safeguard for a fan/AC switched on, without it stepped noise was "speech" for 47–57 s of 60 and fake one-letter texts came out), and QUIET_END 1.0 → 0.5 s. bench options: `--frise_sp 0.0005 --quiet 0.5 --fcatch 5`.
  Full gate G10b ctc_up, today → final: ALL 93.7 → 97.3 (all clips incl. the 35 the old gate skipped: 93.4), noisy SNR 20/10/5 96.3/89.5/82.8 → 98.3/96.8/93.8, ho_reciters 96.8 → 99.5, test_L1 99.3 = , test_L2 98.4 → 98.3, test_L3 97.7 → 97.9, ho_retasy 99.0 → 98.3, ho_retasy_wrong 95.2 → 94.8, wrong-caught ALL 99.3 → 99.1 (test_L2 97.9 → 96.9). Latency: wait after the last word of a piece 1.24 → 1.06 s (−180 ms); mean wait over all words 3.46 → 3.66 s (+0.2, longer pieces; partials on the phone show words earlier — not measured); decoded audio +2%. Without the safeguard: ALL 97.8, noisy10/5 97.1/96.0. Held-back half (no-safeguard variant): ALL 92.0 → 98.1.
  Not verified / open: bench only — no phone test yet; fcatch 5 tuned on the same gate it is reported on; stepped noise still emitted 13–21 s (old 9–11 s); voice commands/search (`voiceListen`, stop on first final) may end early on a 0.5–1.0 s hesitation; known old bug unchanged: mic off mid-ayah drops the in-progress piece; ho_retasy/retasy_wrong −0.7/−0.4.
  Test APK: quran-karim-v5.21-vadtest.apk (signer 7d8b31d2, version not bumped, NOT installed). Phone list: long ayah in a quiet room (2:282); pauses/waqf/long madd not splitting a word; fan/AC on mid-ayah and in a pause then silence (no fake words); cafe/TV noise + a wrong word still flagged; voice command with a hesitation.
  Goal check: biggest single step toward >95% so far (bench ALL 97.3, noisy5 93.8), no model size/speed cost; ships only after the user's phone test.
- 2026-11-14 tajweed layers kfold-tj + shamarly-tj regenerated locally from the new rects (old layers were wrong where rects changed, e.g. kfold 585 red on an ayah mark); pixel check vs old on unchanged pages +1% coloured pixels, same 12 colours (size −30% = newer libwebp). ui.js kfold 290/0, shamarly 290/0. Zips ready: quran-karim-data/editions-2026-11-13/{kfold,shamarly}.zip; backup of old layers quran-karim-data/tj-backup-2026-11-13. Not uploaded (user's word). Not viewed: ~10 of 22 shamarly "weak alignment" pages (364, 440, 447, 448, 450–453, 485, 491, 497, 511); recheck p.492 (74:15 «كلّا») and p.500 (79:34 «الكبرى») near the ayah mark. tajweed_scans.py: Windows worker-pool argv fix + TJ_PROCS.
Resume (user away; all of these wait for the user's word): 1) install quran-karim-v5.21-vadtest.apk on the phone and run the VAD phone list → if OK the VAD change ships in 5.22 2) upload kfold.zip + shamarly.zip (new tajweed layers) and asrnv4.zip + asrnvp4.zip (pack v4 = G10b) to `editions` 3) 5.22 / versionCode 70: `ASRM ver 4`, bump manifest/index.html/sw.js, full QA 4 editions, signer 7d8b31d2, private release + Play AAB 4) then W6 (Q.r from word boxes), matcher placement fix (+1–1.6 pts estimated), mic-off-mid-ayah piece, G10c only if a new noise recipe is proposed.
- 2026-11-14 user phone test of quran-karim-v5.21-vadtest.apk (VAD fix, model still pack v3/L2): 1 long ayah quiet PASS, 2 pauses/waqf/madd PASS, 3 fan/AC on mid-ayah + silence PASS, 4 loud cafe/TV noise PASS ("some difficulty finding the speech but generally acceptable"), 5 voice command with a hesitation FAIL (cut early: the 0.5 s quiet end splits «افتح سورة … الكهف" into two finals and voice commands stopped on the first).
  Fix (web/app.js): `voicePending()` — a final that ends on a command word (افتح/روح/سورة/صفحة/الجزء/آية/رقم …) keeps the mic open and the next final is joined to it (2.5 s limit, flushed if the mic stops); a complete command still acts at once, so no added wait. data.py 28/0, ui.js kfgqpc 290/0. Test APK rebuilt (signer 7d8b31d2) and installed on bee81250; item 5 to re-test.
Resume: user re-tests the hesitating voice command → then the steps waiting for the user's word (uploads to `editions`, 5.22 release).
- 2026-11-14 user asked: the fix «Fix voice command early cut (voiceListen)» (commit 55c9b4b) must not change anything else in the model. Checked: the commit touches only web/app.js (+progress.md); all its lines are in the voice-command path (`voicePending`, `voiceListen`, and the `onRecite` branch that runs only while `voice.on`, after the reading/hifz/recite branches have returned). No change to NvAsr.java, the VAD, the model pack, the matcher, ctc_up, or recitation/hifz/talqin/mutashabihat paths. The model on the phone is unchanged (pack v3).
- 2026-11-14 user re-test of item 5 (voice command with a hesitation) on the rebuilt vadtest APK: PASS. VAD phone test now 5/5 PASS.
Resume: on the user's word → upload asrnv4/asrnvp4 (pack v4 = G10b) + new kfold.zip/shamarly.zip (tajweed layers) to `editions` → release 5.22 (versionCode 70, `ASRM ver 4`, full QA 4 editions, signer 7d8b31d2, private release + Play AAB).
- 2026-11-14 RELEASE 5.22 (70): recognition model v4 (G10b, noise), VAD floor fix, voice commands wait for the rest, measured word boxes kfold + Shamarly, tajweed layers regenerated. `ASRM ver 3 -> 4` (mb 93), manifest 5.22/70, index.html AR+EN, sw quran-v66.
  editions branch commit 6e119a6 (worktree D:\Quran App\ed-wt, branch editions-up -> origin editions, plain git): added asrnv4.zip 50,108,010 md5 80608b0b534a3f84eb7230e2a21a6d8d, asrnvp4.zip 42,738,052 md5 38b2887016712d173fd4297eda9e5d63; replaced kfold.zip 44,977,216 md5 b2ac3e4f1d0e8fff21f54fce927d4762, shamarly.zip 35,652,186 md5 b5e5a9fdedb28c91b16cd613302de895; asrnv3/asrnvp3 and all older packs kept. All 4 downloaded back from raw.githubusercontent.com/.../editions/ (edUrl): size + md5 match. build-win.py's "edition zip: kfold.zip 44976998 / shamarly.zip 35651956" = build/editions-zips, re-zipped from web/editions/* as a local by-product (not in the APK); same 1208 / 1042 entries with identical CRCs as the uploaded zips (only zip metadata differs).
  QA: data.py 28/0; ui.js kfgqpc/kfold/shamarly/harmain 290/0 each (no prayer flake). APK quran-karim-v5.22.apk 70,086,064 B signer 7d8b31d2; AAB quran-karim-v5.22-play.aab 40,732,702 B validate OK, no licence-less content, not uploaded.
  Play .so: NvAsr only System.loadLibrary (packaged jniLibs), no System.load(path) in NvAsr/EdStore -> pack .so never loaded.
  Phone: bee81250 was not connected -> v5.22 NOT installed yet, ver.txt not read.
Resume: install quran-karim-v5.22.apk on bee81250 (adb install -r, no data clear), read files/ed/asr/asrnv/ver.txt (expect 3), user takes the in-app model update v3 -> v4, then recites in quiet + noise; then W6.- 2026-11-14 user phone test of 5.22 (versionCode 70, adb-confirmed on bee81250) after the in-app model update v3 -> v4 (G10b; update reported by the user, ver.txt not readable - APK not debuggable): quiet, noise and voice-command tests all PASS per the user.
Resume: 5.22 + model v4 confirmed by the user on the phone -> next: W6 (Q.r from word boxes, search-word marking, Haramain's 2 missing words) + matcher placement fix; Play AAB upload waits for the user's word.
- 2026-11-16 user: 5.20 closed-test review APPROVED; testers opt-in in progress. Next = user uploads quran-karim-v5.22-play.aab (70) to Alpha.
- 2026-11-16 user: 5.22 (70) AAB uploaded to closed test Alpha and sent for review.
Resume: after usage reset (2026-11-17 19:00) -> plan step 1 matcher fix (Opus low); Play: wait 5.22 review + 12 testers x 14 days -> Apply for production.
- 2026-11-18 step 1 (matcher placement) started: located the matcher at web/app.js:2238-2276 (rLocal: piece placement, start cost st(i), JUMP, end-cell choice at 2261-2262). The plan does not state the concrete defect, so no edit yet. Need the defect hypothesis + bench target before the analogical-reasoning step.
Resume: user to name the placement defect (or accept my hypothesis after a bench check) -> analogical reasoning for rLocal -> edit web/app.js + p1b_port_eval -> ctc_up gate (ALL>=97.3, wrong-caught>=99.1, wait<=1.06s).
- 2026-11-18 step 1 CLOSED (no change): qk-dev re-ran bench G10b int8 shipped settings (baseline reproduced: ALL 97.3, SNR 98.3/96.8/93.8, wrong-caught 99.1). Sequential-oracle placement (no JUMP, start=p0) gives ALL 97.3 too: ceiling 0.0 pts; 64/2299 pieces differ (mostly p0-1/p0-2 starts) but ctc_up re-judge repairs them. Old +1-1.6 estimate unsupported; remaining loss = VAD cuts + model. Tools in tools/asr/eval/placement/. Goal check: matcher is not the lever -> go to step 2.
Resume: step 2 mic-off flush in NvAsr.listen (after loop line ~313, final for own gen g, >0.3 s voiced) + fix stale QUIET_END 1.0->0.5 in tools/asr/eval/stream_cut.py -> gate.
- 2026-11-18 step 2 DONE (PC side): NvAsr.java flush of the open piece on stop (stoppedGen + live(g,flush), >0.3 s voiced, one decode); web/app.js judges that one flushed final within 3 s in recite/htv/mtv (words only, no alert/page turn/restart), ctcJudge uses Mic.last so CTC still runs; Mic.start clears stopAt; rd unchanged. stream_cut.py QUIET_END 1.0->0.5. Test APK quran-karim-v5.22-micflush.apk signer 7d8b31d2; data.py 28/0; ui.js kfgqpc 290/0. Combined gate (qk-qa, out D:/Quran App/qtrain/eval/out/gate_G10b_ship/): ALL 97.3, SNR 98.3/96.8/93.8, wrong-caught 99.1 = PASS; wait not re-measured (VAD/matcher untouched, stop path only). Note: qk-qa installed onnxruntime 1.32.0 + soundfile into ml-env; parity.js is stale for G10b rows (needs rows-*-dp1.0.json).
Resume: on the user's word install quran-karim-v5.22-micflush.apk on bee81250 (adb install -r, no data clear) -> user stops mid-ayah in recite / hifz test / continuation test -> then step 4 (leftovers + VAD sweep).
- 2026-11-18 user OK -> quran-karim-v5.22-micflush.apk installed on bee81250 (adb install -r, data kept; 5.22/70, lastUpdateTime 20:47:40).
Resume: user tests stop mid-ayah in recite / hifz test / continuation test -> then step 4 (leftovers + VAD sweep).
- 2026-11-18 user phone test of micflush APK: stop mid-ayah in recite / hifz test / continuation test - all 3 PASS. Step 2 closed.
Resume: step 4 - leftovers (prayer QA flake, fold 640px floor), Shamarly tajweed unseen pages, VAD sweep (bench.py --quiet/--fcatch) with gate.
- 2026-11-18 step 4 partial: (a) prayer QA flake - no fix: ui.js:266-271 already dumps JSON detail on fail; flake not seen since 5.21 (QA-checklist 628/667, progress 749). (b) Shamarly tajweed eye check (layer composited on scan, scratch venv): 364 440 447 448 450-453 485 491 492 497 500 511 OK (middle lines, qk-scout); pages 2 (Fatiha) and 3 (Baqarah 1-4) checked full-page by Opus: colour on the letters, frame/margins clean -> OK. Shamarly-tj leftover closed. Pending: fold 640px screenshots (qk-qa), VAD sweep (qk-dev).
- 2026-11-18 fold 640px leftover CLOSED, no change: screenshots at fold sizes; 1104x884 landscape already shows a 2-page spread (spreadOn web/app.js:1060: landscape, w>=900, h>=500) - qk-qa had read each half-page as 'narrow'. 673/841-wide fold: 640 floor = P2.7 design (width kept, scroll), same as phones. User asked for spread on large landscape only = current behaviour.
- 2026-11-18 user (going to sleep): consent to resume the plan autonomously; do NOT build the APK now. Fold: user chose to merge into the existing spread setting (one row «صفحتان متجاورتان على التابلت والفولد بالعرض», threshold 900->800), qk-dev applying. Next: finish step 4 (VAD sweep result), then step 3 W6 (scouting started). Release 5.23 / upload still wait for the user's word.
- 2026-11-18 W6(a) NOT applied (Opus decision): tools/page_geometry/rects_from_words.py (union of word boxes per Q.r piece, 2‰ pad, ayah-end circle + run-on margin guards, >40‰ flagged). Dry run changes 8340/12844/12180/12747 pieces (mostly 1-5‰). geo_check SEED 518 N 30: word-box metrics unchanged, estimate metrics drop (kfgqpc IoU .356->.353, shamarly page-end exact 86.7->83.3) -> fails 'no number drops', no measured gain. Edition js restored byte-identical. Open for the user: the 'suspicious' list (kfgqpc 60:1, 32:9, 46:34, 65:1, 22:1 ...; header-line spans) may be the real ~100 bad ayat -> needs an eye check before any targeted apply. W6(c): Haramain missing words = 2:41:6 «ولا» p7, 56:86:1 «إن» p474 (short words, word_boxes_harmain.py ayah_rows max(cnt)<2 skip; not run-confirmed). Files: scratchpad w6-backup/w6-applied/dry-*.txt.
- 2026-11-18 step 4 VAD sweep DONE -> keep 5.22 settings (quiet 0.5, fcatch 5). Sweep quiet {0.5,0.6,0.7} x fcatch {3,5,7} (D:/Quran App/qtrain/eval/out/sweep_q*_f*/): no setting wins back ho_retasy/retasy_wrong/L2 wrong-caught without more wait (0.6: +0.1 s, retasy_wrong -0.2). 0.5/7 passes the gate (ALL 97.7, SNR 98.5/97.1/95.2, wrong-caught 99.1, wait same) but synthetic stepped-fan test (scratchpad step_noise.py, 6 runs): fake «أ» texts 6->8, noise-as-speech mean +1.3 s, worst +5.6 s -> rejected. Candidate kept on record: 0.5/7 if a real fan test on the phone shows no extra fake texts.
Resume: fold spread merge (qk-dev, running) -> review -> W6(b) search-word marking on the page (new; app.js) -> W6(c) Haramain 2:41:6 + 56:86:1 -> W6(a) eye check of the 'suspicious' header-line rects. No APK build (user).
- 2026-11-18 fold spread merged (Opus reviewed screenshot 841x673 = 2 pages): index.html:58 label «صفحتان متجاورتان على التابلت والفولد بالعرض», i18n.js:137, app.js:1060 spreadOn width 900->800, ui.js:198 new 841x673 on/off check. data.py 28/0, ui.js shamarly 291/0, kfgqpc 291 x3 runs: 1 run FAIL 1 (first-run mic test «أول مرة المايك», ui.js:616-623), then 3 runs 291/0 -> flake, not step 2.
- 2026-11-18 W6(b) DONE: searched word marked on the mushaf page over hzWb word boxes (app.js:136-155 hitSet/searchWordIdx, ~1390-1420 srchWords in showPage, mark() clears .srch-w; style.css:231-232 .srch-w; fallback = ayah mark only; vertical scroll mode unchanged). Opus checked screenshot p604 «الصمد». ui.js:79 new check (+ go('#/search') fix for «كرسيه»). QA run alone, sequential: kfgqpc 292/0, shamarly 292/0; data.py 28/0. Earlier fails («كرسيه», «سمّع التكملة», 42 'Target crashed') were from parallel runs / the old check, not repeated.
Resume: W6(c) Haramain missing words 2:41:6 «ولا» p7 + 56:86:1 «إن» p474 (word_boxes_harmain.py ayah_rows max(cnt)<2) -> W6(a) eye check of flagged header-line rects -> then 5.23 release waits for the user's word (no APK build per user).
- 2026-11-18 W6(c) BLOCKED: word_boxes_harmain.py needs font UthmanicHafs1Ver18.ttf (not on disk; tools/fetch_books.sh:30 downloads ~1 MB from raw.githubusercontent.com quran/quran.com-frontend-next). Download waits for the user's OK. Harmain scans are web/pages/NNN.avif. Nothing changed.
- 2026-11-18 W6(a) eye check (Opus, scratchpad w6a/*.png, red=old Q.r, green=new, blue=word boxes): (1) kfgqpc 60:1 (and 22:1, 65:1 per qk-dev): ayah 1's piece0 IS the bismillah line - old rect full width, new tight; word boxes also put bismillah words in ayah 1. Not ayah text (except 1:1) -> needs a decision: is bismillah-with-ayah-1 intended for highlight? (2) kfgqpc 32:9: old piece0 covers the end of ayah 7 + all of ayah 8 («من طين ٧ ثم جعل نسله … مهين ٨»), ayah 9 starts on the next line - real data bug; new rect is also wrong (small box on «سلالة»), and a word box sits there too -> word-box/ayah numbering for 32:8-9 needs a look. A blanket apply is wrong either way; a targeted fix needs per-ayah review.
Resume (user away, consent to resume): W6(c) waits for the font download OK; W6(a) needs the user's call on bismillah + a targeted 32:8-9 investigation; then 5.23 release on the user's word (no APK build yet).
- 2026-11-18 W6(a) root cause (qk-dev, Opus reviewed): kfgqpc Q.r ayah boundaries shifted on some rows (32:7/8/9 p415: 7's end at x255 vs circle ~602, 8's end at x383 vs circle ~162); word boxes inherit it (word_boxes.py fits words into Q.r pieces). ~32 ayat match the pattern (10:4 p208, 4:3 p77, 32:5, 25:72, 46:35, 25:71, 59:20, 9:125, 23:115, 47:4, 31:30, 21:109, 23:116, 22:5, 32:24 ...). ayah_circles.py fix_line never moves them: MAXMOVE=150 (line 216/232). Proposed: MAXMOVE ~400, rerun ayah_circles.py --fix -> word_boxes.py -> rects_from_words.py; check the 32 ayat + geo_check first. Needs the same font (UthmanicHafs1Ver18.ttf) -> waits for the download OK.

- 2026-11-19: Font UthmanicHafs1Ver18.ttf downloaded with the user OK -> build-src/fonts (237 KB). W6c (Haramain 2 words) + W6a (MAXMOVE) sent to qk-dev, scratchpad only, nothing written to web/.
Resume: review the W6c/W6a reports (scratchpad w6c/, w6a/) -> Opus eye check of the crops -> apply only if geo_check does not drop -> ui.js x4 sequential. No APK/release without the user word.
- 2026-11-19 W6c APPLIED: word_boxes_harmain.py (word squeezed into the GAP -> sliver at the next piece start) + harmain-w/007.js, 474.js; only 2 pages change across all 540; crops OK (Opus). Backup in scratchpad w6c/bak.
- W6a: MAXMOVE REJECTED (250/400/600 identical, 34 other ayat change, 0 of the listed ones). Real defect (Opus eye check p415): ayah END not on its circle (32:3 runs past circle 3 into 32:4). qk-dev: new tools/qa/ayah_circle_check.py + kfgqpc rebuild prototype in scratch.
Resume: review the check totals + rebuild before/after crops -> if clean: word_boxes.py + rects_from_words on a scratch tree -> geo_check + ui.js kfgqpc -> apply. Haramain ui.js run after W6c.
- W6a check: new tools/qa/ayah_circle_check.py -> current kfgqpc: 923/6236 ayah ends (14.8%) not on a circle, 409 pages. Rebuild prototype (scratch rebuild_kf.py, circles in reading order, basmala excluded): 505 pages rebuilt, 923->306; Opus eye check p415 + p77 = correct. Next: DP fallback for the 98 skipped pages, contact sheets, word_boxes on a scratch tree + geo_check.
Resume: eye-check scratchpad w6a/run/sheet_*.png -> apply kfgqpc.js + kfgqpc-w -> ui.js kfgqpc. Haramain ui.js after W6c = 292/0.
- W6a full rebuild + DP fallback: bad ends 923->105, but geo_check dropped (NEW IoU 0.923->0.900) and 18 ayat lost words (e.g. 3:149 p69: false circle + missed circle gave equal counts) -> NOT applied. Opus eye check sheet_b (293,187,590,604) OK. Decision: per-page best-of merge (accept a rebuilt page only if no missing words, alignment not worse, bad ends not more; DP circles >= 0.30) -> scratch w6a/web_m.
Resume: review the web_m report (geo_check every metric >= current, 0 missing words) + sheet_m.png -> apply kfgqpc.js + kfgqpc-w -> ui.js kfgqpc alone.
- W6a APPLIED (per-page best-of merge): kfgqpc.js "r" only (p unchanged) + kfgqpc-w 604 files. 539 pages rebuilt, 65 kept. Bad ends 923->301, ayat with a wrong word count 116->29, geo_check all >= current (NEW IoU 0.923->0.924, hifz est 0.356->0.373, line 95.4->96.6). Opus eye check sheet_m (415,77,208,557) OK. data.py 28/0. Backup scratchpad w6a/bak_web. Still open: 143 pages with bad ends (376,452,445,331,525...) need a hand check / better DP.
Resume: ui.js kfgqpc result -> W6 closed -> release 5.23 waits for the user word.
- W6 CLOSED: ui.js kfgqpc 292/0 after W6a, harmain 292/0 after W6c.
Resume: release 5.23 (71) waits for the user word (bump manifest/index.html/sw.js, full QA x4, APK 7d8b31d2 + AAB upload.jks, latency on bee81250, Alpha before day 14). Optional: hand check of the 143 pages with bad ends.
- 2026-11-19 user: fix the 143 pages before 5.23. Goal check: correct ayah/word highlight on the default edition = near-complete app, yes. Approach: text-guided matching (predict the circle x from line text + font, then snap to the nearest candidate circle), same per-page best-of gate, clean pages untouched. qk-dev on a scratch copy.
Resume: eye-check the sheets of 8 changed pages -> apply -> geo_check + ui.js kfgqpc -> then 5.23 on the user word.
- 143-page fix APPLIED: new ring template tools/qa/ayah_ring.npy (learned from ~930 scan circles; real circles score 0.6-0.8 vs 0.25-0.5 with the font glyph) + rebuild of the 69 bad pages + per-page gate (67 accepted). Bad ends (ring, thr 0.5): 807 originally -> 175 -> 52 on 30 pages; ayat with a wrong word count 29->13. geo_check: word-box metrics same/better; estimate IoU>0.5 seeds 518/7/99 = -0.2/-0.1/+0.6 (noise, net +). Opus eye check sheet_n1/n2 (376,452,445,331,525,586,410,579) OK. Backup w6a/bak_web_m. data.py 28/0.
- 5.23 (71) bump: manifest, index.html (ar+en), sw.js quran-v67. User (going to sleep) gave consent for best-result choices; upload to Alpha + GitHub release still held for the user word.
Resume: ui.js kfgqpc -> ui.js kfold/shamarly/harmain sequential -> build APK + AAB -> latency bee81250 -> report.
- 5.23 BUILT: full QA passed (ui.js x4 292/0, harmain flake explained), APK 7d8b31d2 + AAB upload key, bundletool OK; new data is inside the APK assets. Phone not connected -> latency pending. NOT uploaded (Alpha, GitHub release) - waits for the user word. Nothing committed.
Resume: user word -> latency on bee81250 + gh release (private builds repo) + Alpha upload before day 14. Optional: fix the S3 test to skip identical-text ayat.
- 2026-11-19 phone test: real 5.23 installed on bee81250. Latency: 5.23 is NOT WebView-debuggable (memory note was stale) -> new tool tools/qa/phone_latency.py (CDP raw ws, wraps onRecite, plays 5 reciter clips via ffplay, PC clock; untested against the phone). Built quran-karim-v5.23-lattest.apk = 5.23 + WebView.setWebContentsDebuggingEnabled(true) only (not android:debuggable, which slows the Java mel). Source line removed again; NOT installed yet. Real APK quran-karim-v5.23.apk (7d8b31d2) + AAB untouched.
Resume (user said stop): adb install -r quran-karim-v5.23-lattest.apk -> phone next to the speakers -> run phone_latency.py (scratchpad lat/.venv, --serial bee81250 --clips 5 --runs 2; ffplay --lag 0.35 is a guess) -> reinstall the real quran-karim-v5.23.apk -> user checks mic-stop + p415/77/331 highlight + Haramain p7/p474 -> on the user word: gh release (private builds repo) + Alpha upload before day 14.
- 2026-11-19 PHONE LATENCY 5.23 (bee81250, first measurement ever): first partial median 1.18 s / p90 1.70 s after speech onset (by design >= 0.5 s audio + voiced 0.5 s + decode); final after speech end median 0.90 s / p90 1.04 s (QUIET_END 0.5 + decode). phone_latency.py fixed (127.0.0.1 ws, suppress_origin, run with -I -X utf8). S3 ui.js test skips questions with identical-text choices (harmain 292/0). Real 5.23 reinstalled, test APK deleted.
Resume: user phone checks (mic stop, kfgqpc p415/77/331, harmain p7/474) -> on the user word: gh release v5.23 (private builds repo) + Alpha upload before day 14. Latency idea for later: first partial at 0.3 s of voiced audio instead of 0.5 (bench gate first).
- 2026-11-19 RELEASED v5.23 to the private builds repo (gh release, APK 70,086,064 B). Play Alpha upload NOT done: the built-in browser is not signed in and cannot attach files; Claude in Chrome not connected; Chrome file_upload caps at 10 MB (AAB 40.7 MB) -> the user drags the AAB in.
Resume: Alpha upload of quran-karim-v5.23-play.aab (Closed testing > Alpha > Create new release, notes = the gh release notes) before day 14 -> then Apply for production -> G8.
- 2026-11-19 Play Alpha 5.23: drag-and-drop from my Chrome tab did not reach Play twice (draft releases/4 shows only 70); the user finishes the upload himself. Play notes ready: store/release-notes-5.23.txt (Haramain line left out: not in the Play build).
Resume: confirm 71 (5.23) live on Alpha (before day 14) -> Apply for production when 12 testers x 14 days -> G8.
- 2026-11-19 Play check: Alpha still shows 70 (5.22) + an empty «Untitled release» draft -> 5.23 NOT on Play yet (told the user).
- S12 spike started (qk-dev, offline only, tools/asr/eval/s12/): madd + ghunna from CTC frame durations, gate accuracy >= 90% and false alarm <= 5% on proficient reciters. Precedent ctcJudge (app.js ~2320) + bench.py. G8 deferred until production approval (Data safety).
Resume: S12 report -> Opus GO/CLOSE -> step 8 azkar voice (needs who records) / step 9 iOS (after production).
- S12 CLOSED (Opus review agrees): 290 clips / 16 proficient reciters, 80 ms frames, peaky CTC = no letter duration (spike + blanks). At false alarm <= 5%: shortened madd munfasil caught 15%, muttasil 0%, ghunnah 6% (AUC 0.85/0.48/0.73). Scripts tools/asr/eval/s12/. A later idea, not in the plan: vowel length from the audio energy/pitch inside the aligned word span (not CTC), only if the user wants tajweed checking.
Resume: step 8 azkar human voice needs the user to decide who records; step 9 iOS after Play production; 5.23 Alpha publish is with the user; production apply when 12 testers x 14 days.
- 2026-11-19 Play: 71 (5.23) IN REVIEW on Alpha (confirmed in Chrome).
- Step 8 azkar voice, licence search: NO verifiably licensed human recording found. rn0x/Adhkar-json (Hamad al-Dreihem, files named «by_Doors»): README says «no licence, do what you want» but the uploader is not shown to own the recitation. archive.org Fares Abbad (20231114_20231114_1654) + azkar_202202: Public Domain Mark set by third-party uploaders (self-declared). Alafasy uploads: no licence. Same bar as Darwish/tanwir -> not usable in the Play build without the rights holder OK.
Resume: user decides: ask a rights holder (Doors / Hamad al-Dreihem, or a reciter) for written permission, or record himself; then recording sheet -> ffmpeg -> optional pack via EdStore.
- 2026-11-19 PLAN ON HOLD (user): step 8 azkar voice held; the user brings a batch of updates in a new session. Prompt: plans/NEXT-SESSION-PROMPT.md.
Resume: new session -> do the user updates first -> then return to the plan (8 azkar voice: permission or own recording; production apply at 12 testers x 14 days; G8 after production; iOS).

## Sprint 1 (2026-11-19): bugs + quick UX (user prompt, 9 items: #23 #36 #37 #5 #16 #7 #9 #8 #4)
- Goal check: all 9 are app bugs/UX on the existing app = "near-complete Quran app" goal; no ASR work. Base = 5.23 (71), uncommitted 5.23 tree.
- Note: progress says tanwir/Darwish audio not usable in Play without rights holder OK -> #23 may be a licence decision, check before restoring.
Resume: scouts (#23 / #36-37 / UX entry points) -> analogical-reasoning per fix -> qk-dev -> verify each with screenshot.
- #23 FOUND: not a regression. Adhan recordings + tanwir (+ Darwish, Haramain) are removed only in the PLAY=1 build (commit d6a2f3a, build-win.py:59-76, store/licences-status.md:8,10,32: no written licence). GitHub APK keeps them (flags.js NO_BOOKS=[], NO_ADHAN_AUDIO=false). Not restored on Play without the rights holder OK; verify in the GitHub APK only.
- Dispatched: qk-dev #36 (in-place ✓ refresh) + #5 (home-origin back, hzFrom pattern) + #16 (one-tap toggle bookmark); qk-qa #37 e2e map test on a web/ copy.
Resume: dev A + qa #37 reports -> dev B (#7 #9 #8 welcome) -> dev C (#4 half-page rule) -> full QA -> 5.24 APK.
- Checkpoint A DONE (qk-dev, Opus eye check of s1-16-on / s1-36-after OK): #36 hzPaintChecks(s) in-place after hzSetMemo; #5 pgFromHome (hashchange oldURL) -> back from a home-opened mushaf goes home (also in fs; index/voice pushes no longer need 2 backs); khatma/search unchanged; #16 #qMk fixed toggle button (marks entry gets p field), style.css .q-mk. ui.js kfgqpc 284/8: 8 = fs-motion harness assumed back leaves fs only -> harness update sent.
- #37 e2e (qk-qa): persistence OK; mismatches M1 shared-page count/ring 0 for a memorised surah, M2 hzRev-only surah not coloured from its state, M3 Math.max lets a weak surah look complete -> fix sent (qk-dev B).
Resume: reports B (#37 + harness), C (welcome #7 #9 #8), D (#4) -> ui.js x4 sequential -> 5.24 APK.
- Checkpoint B DONE: #37 shared segment colour rule (on = hifzLog or hzRev; on -> 2 if due/wrong/>14d else 3; not on never 3), done pages = ayat share on shared pages (ring p2, header 1 decimal under 10); e2e 7/7 PASS (scratchpad s1/map37/after). fs-motion harness: enters via #/more + new "home back" check, 9/9. #4 half-page cap: hzLines/hzSplit/hzCap, HZ_LINES per edition (all 15 measured), anchor kept 0/2002 lost, 2:280-282 -> 280-281 + 282 alone. #7/#9/#8 welcome done (stubbed EdBridge) - edition progress screenshot re-shoot requested (was mid fade).
Resume: welcome re-shoot -> ui.js x4 sequential + data.py -> bump 5.24 (72) -> APK + signer -> emulator screenshots -> report.
- 5.24 (72) bump (manifest, index.html ar+en, sw quran-v68). quran-karim-v5.24.apk built, signer 7d8b31d2 OK, new code inside assets/web/app.js; installed on bee81250 + emulator-5554 (both versionName 5.24). QA-checklist: new 5.24 section with the 9 sprint checks. Full QA (qk-qa) + emulator screenshots (qk-dev, emulator only, never the user's phone data) running.
Resume: QA table + device table -> fix any FAIL -> final report; nothing committed/pushed yet (ask the user).
- Device check on emulator (qk-dev, all 8 PASS, screenshots scratchpad s1/device/): welcome edition tap + bar, city -> auto next, model primary + bar 48% -> auto next, back home (also fs), bookmark toggle + toasts, ✓ at once + map kept after force-stop, Baqarah random label + places, 9 adhan voices play (MediaPlayer started) + tanwir 1:1/2:255/112:1.
- Follow-ups: hzPaintChecks also repaints the .ht-mini «% محفوظ» card and runs after hzSetRev (device showed it stale). First full-QA run hung on stale headless Chromium (killed); kfgqpc alone 293/2 = the two old «عشوائي ٣–١٢» checks (5.14, U2) -> updated to the half-page rule (window.hzLines/hzCap exposed for QA). Rerun x4 + matrix running.
Resume: QA x4 result -> rebuild 5.24 APK (app.js changed after the first build) -> signer -> reinstall emulator + phone -> final report.
- Sprint 1 DONE (5.24, 72): full QA data.py 28/0, ui.js kfgqpc/kfold/shamarly/harmain 293/0 each, matrix 40/0. quran-karim-v5.24.apk rebuilt after the last app.js change, signer 7d8b31d2, installed on bee81250 + emulator. Mini card check (headless, Fatiha): ٠٪ -> ٠.٢٪ in place after «خلصت». Nothing committed/pushed (5.23 tree is also uncommitted) - waits for the user word; no Play AAB built (Play Alpha 71 still in review).
- Open notes: #23 Play build has no adhan/tanwir by licence design; fs screenshot dev-5-4 caught mid-glide (not re-checked); 2:255 tafsir title cut «سورة البقرة · ...» (cosmetic, maybe old); vertical-scroll mode for the #16 button only covered by code (mkPaint hooks), not by a screenshot.
Resume: user phone check of 5.24 (back, bookmark, welcome on a fresh install, random Baqarah) -> on the user word: commit + push + gh release v5.24 (private builds repo) / Play AAB -> back to the plan (azkar voice permission, production apply, G8, iOS).
- 2026-11-19 phone test 5.24 on bee81250 (safe items, qk-dev): #5 back x4 PASS, #16 bookmark toggle PASS (khatma count 1 -> 1), #37 map renders (79 pages, 14.7%, harmain), #4 label PASS, #23 10 muezzins + tanwir on 1:1 / 2:255 / 112:1 PASS, search «الصمد» + azkar PASS. Qibla + logcat NOT RUN (phone dropped off adb). INCIDENT: a blind tap answered an incoming call (hung up); reading position moved Saba p376 -> an-Nas p541 (user must restore). Rule saved in memory phone-test-safety.
- New observations (not fixed): search × does not clear the old query (new text appended); home list left scrolled to the bottom after leaving the mushaf; header titles truncated by «الفهرس»; tafsir tab strip opens scrolled so «التفسير» is off-screen.
Resume: user runs plans/phone-test-5.24.md items 3 (hifz «خلصت») and 5 (welcome) -> decide on the 4 observations -> on the user word commit + push + release 5.24.
- 2026-11-19 4 phone-found issues FIXED (qk-dev, headless 393/360 px before/after in scratchpad s1/fix4/): search own × (#qClr, .q-wrap) clears field + results + ?q=; showHome scrollTo(0,0) when entering home (homeShown flag); bar title min-width:0 + index button icon-only outside the mushaf at <=430 px, tighter bar at <=380 px; ayah tab strip re-centres the active tab after rAF + fonts.ready. Checklist plans/phone-test-5.24.md section 7 added.
Resume (user may shut the PC down): rerun QA (data.py, ui.js x4 sequential, matrix) -> rebuild quran-karim-v5.24.apk -> signer 7d8b31d2 -> install bee81250 -> qk-dev phone test with the memory phone-test-safety rules (call state + focus before every tap, restore «متابعة القراءة» = Saba p376 on harmain) -> report. Nothing committed.
- 2026-11-19 (session 2) QA rerun after the 4 fixes: data.py 28/0, ui.js kfgqpc/kfold/shamarly/harmain 293/0 each, matrix 40/0. quran-karim-v5.24.apk rebuilt (signer 7d8b31d2, qClr/homeShown/showOnTab inside), installed on bee81250 21:53. Phone test agent running with the phone-test-safety rules (call state + focus before every tap, restore Saba p376).
Resume: phone test report -> final report -> commit/push/release only on the user word.
- 2026-11-19 phone test 5.24 build 2 (bee81250, safety rules held: mCallState 0 before every tap, no call screen): 15 PASS, 1 partial (fullscreen only reached by itself, back from it -> home), new fixes all PASS (search ×, home top, full titles, tafsir active tab). Bookmarks 1 -> 1. Reading position still an-Nas p541 (moved by the first run; user's original Saba p376 not restored yet). Logcat: no JS errors.
- Open observations: (1) first tap on the #qMk bookmark button right after opening the mushaf did nothing; (2) home scrolled down ~600px after index-sheet search inside the mushaf then back; (3) search keeps the last query on re-entry (maybe intended).
Resume: user decides on observations 1-2 -> commit/push/gh release 5.24 on the user word.
- 2026-11-19 fixed the 2 open observations (qk-dev, headless proof): (1) bookmark first tap: the 5 s auto-fullscreen moved .q-mk from y70 to y10, the tap fell on the page (exit fs) -> button keeps one position in all modes (style.css ~1223); (2) home scrolled after back: fsSet(false) fix() scrollBy ran after the route change in vertical mode -> fix() returns if the anchor is gone / not vread (app.js ~5797) + rAF re-reset in showHome + blur index search on pick/close/qBack. QA x4 + matrix + fs-motion running.
Resume: QA result -> rebuild 5.24 -> signer -> install bee81250 -> short safe phone check (bookmark first tap during the 5 s fs, index search -> back -> home top) -> report.
- 2026-11-19 23:xx 5.24 build 3 (signer 7d8b31d2, QA data 28/0, ui.js x4 293/0, matrix 40/0, fs-motion 9/9) installed on bee81250. Phone check (safety rules held; first run stopped itself on an open notification shade): bookmark first tap after the 5 s fullscreen PASS + ~1 s after opening PASS; index search 67 -> الملك -> fullscreen -> back -> home at the top PASS. Bookmarks 4 -> 4, reading position Abs p585 -> restored.
Resume: on the user word: commit (5.23 + 5.24 work) + push + gh release v5.24 (private builds repo) + Play AAB (PLAY=1, upload key) -> back to the plan (azkar voice permission, production apply, G8, iOS).
- 2026-11-19 user: «لسه فيه تعديلات» -> a new batch starts in a NEW session. Handoff prompt: plans/NEXT-SESSION-PROMPT.md (5.24 state, rules, space for the batch).
Resume: new session -> do the user batch on top of uncommitted 5.24 -> full QA -> rebuild 5.24 (or 5.25) -> phone check (safety rules) -> release on the user word.

## Sprint 2 (2026-11-19 session 3): hifz experience (user batch: #47 #49 #48 #1/#35 #29 #38 #11 #26 #40 #42 #43 #50 #44 #45)
- Goal check: all items = hifz/review UX (near-complete app goal); #29/#38 touch the recitation tracker UX (recognition goal). Base = uncommitted 5.24 (72). Sprint 1 already logged above (820-855). #47 not logged as fixed -> first item.
Resume: scout hifz map/state/tasmee/random/sard/Done/hide/transcript/fs/qMk -> root cause #47 -> single review-result store (#49) -> rest in groups A-D -> full QA -> 5.25 APK.
- #47 ROOT CAUSE: segc (app.js ~4247) gives level 3 only when the whole surah is in hifzLog/hzRev; a surah joins only via a whole-surah test (4849) or a «المراجعة» range; hifzAuto (3651) that promoted at 80% of ayat is never called -> a 100% page in a long surah stays «محفوظة جزئيًا». Fix plan: hzRecord(marks,p) = single entry for every session end, writes hifzAyat rv (pass date) only at p>=80; segment level from rv (3 fresh <=14d, 2 older, 1 partial), legacy surah rule only for segments with no rv; p<80 never deletes from hzRev (iv=1 only). #48 tap -> mushaf with box ayat highlighted (hm-hl), long-press -> old hzPick.
- Dispatched qk-dev A (#47 #49 #48). Next groups (sequential, same app.js): C small (#40 #42 #43 #50 #26) + B #1/#35 resume; tracker visuals (#29 #11 #38); D bar (#44 #45).
Resume: dev A report -> verify screenshots -> dev C+B -> dev tracker -> dev D -> full QA -> 5.25 APK.
- Checkpoint A DONE (qk-dev, Opus eye check of 6-tap-mushaf + e2e-after OK): hzRecord (app.js ~3664) single entry for all session ends; hzSetRev p<80 keeps (iv=1); hifzMark(s) keep rv; segment level from rv; hifzAuto deleted; #48 openAyahRange ?r=S:A1-A2 + .hm-hl teal, long-press -> hzPick. Test table 1-5 + E2E + 6a/6b PASS (scratchpad s2/A). ui.js map checks now right-click boxes; 5.11 group 47/0, full 293 not rerun yet. User decision #42: «فكّرني» only, reveals one word.
- Dispatched qk-dev C+B (#40 #50 #43 #26 #1/#35). Resume UI = explicit button «استئناف من المرة الماضية» (not auto-open: opening «المراجعة» for something else must not drop the user into an old session).
Resume: dev C+B report -> dev D (#44 #45) -> dev T (#11 #42 #29 #38) -> full QA -> 5.25 APK.
- Checkpoint C+B DONE (qk-dev, ui.js kfgqpc 293/0 after QA updates; Opus eye check 1-resume-home OK; scratchpad s2/C): #40 htA2 «إلى الآية» (q.hifzTest.to2); #50 «اختبار عشوائي» labels + toast; #43 «خلصت» removed: word test htFinish() on last hidden word / voice end, mushaf test ends itself at the last ayah (hifzRevealed), ✕ saves partial results via hifzTestDone; QA hook window.__htFinish; #26 hifzFsLater 3 s fullscreen in mushaf hifz (mic restarts timer, tap exits, bar stays); #1/#35 q.hzResume + button «استئناف من المرة الماضية · <label>» on «اختبار الحفظ», «المراجعة», home (word test resumes at the start of the current part).
- Small follow-ups: home resume card shows a trailing «·» before a line break (cosmetic); word test with 0 hidden words ends only by voice (finish at once when hidden===0); English hint key best-effort.
- STOP: usage 67% of the 5-hour window at 2026-11-20 ~22:24 local, each group costs ~13% -> group D would pass the 75% rule. Paused until the window resets.
Resume: (usage window reset) dev D (#44 top bar juz/hizb/bookmark under the status bar, #45 settings toggle, bookmark stays alone when off) -> dev T (#11 word masks keep page shape + ayah markers, #42 «فكّرني» one word counted forgotten (user choice), #29 skipped words coloured + cleared word by word in hifz/review only, #38 rd-cap moves to the half away from the current line) + the 2 small follow-ups -> full QA (data.py, ui.js x4 sequential, matrix, fs-motion) -> bump 5.25 (73) -> APK + signer 7d8b31d2 -> emulator screenshots per item -> report table. No phone taps, no commit/push/release without the user word.
- 2026-11-20 usage reset (3%), user: «كمّل للآخر وابعتلي التقرير».
- Checkpoint D DONE (qk-dev, Opus eye check p300 + fs OK; scratchpad s2/D): #qBar fixed top bar (juz/hizb/rub' from QURAN.h via pageRub, matches juzOfPage for all 604), #qMk inside, same box in normal + fs ([8,64,374,32] @390), first tap during auto-fs toggles mark; #45 q.mushafBar toggle (#barSet in settings, index.html) -> off hides the label, bookmark alone at the same spot. ui.js full run hit Target crashed (44, env) -> groups 5.11 47/0, 5.17 15/0, fs-motion 9/9; other groups to rerun in full QA. Not checked: shamarly/kfold top margin (not unzipped).
- Dispatched qk-dev T (#11 word masks, #42 «فكّرني» one word, #29 skipped words violet + cleared word by word, #38 caption moves away from the current line, 2 small follow-ups).
Resume: dev T report -> full QA (data.py, ui.js x4 sequential with group reruns on crash, matrix, fs-motion) -> bump 5.25 (73) -> APK + signer 7d8b31d2 -> emulator screenshots -> report.
- Checkpoint T (qk-dev): #11 per-word paper masks (markers visible), #42 «فكّرني» one word (T.fg forgotten), #29 hzSkips .rc-skipw violet, cleared word by word, hzFlush counts leftovers forgotten, rd.on untouched; #38 capPlace moves caption to the top when the line is low (0 intersections p50/p300/p582); follow-ups (a) home card, (b) 0 hidden words finish. ui.js kfgqpc 293/0 one clean pass, recite_sim PASS. Opus eye check: #11 masks leave harakat/letter fragments visible -> fix sent (merge hidden words per line into strips, full line height).
Resume: dev T mask fix -> full QA -> 5.25 APK -> emulator -> report.
- Checkpoint T fix DONE: hidden words merged per line into full-line-height paper strips (no harakat fragments), Opus eye check OK; ui.js kfgqpc 293/0, recite_sim PASS.
- 2026-11-20 5.25 (versionCode 73, sw quran-v69) full QA (qk-qa): data.py 28/0; ui.js kfgqpc/kfold/shamarly/harmain 293/0 each (sequential, clean); matrix 40/0; fs-motion 9/9; recite_sim exit 0. QA-checklist.md got the «5.25 release QA» section.
- APK quran-karim-v5.25.apk (70,086,064 bytes) signer 7d8b31d2 OK, installed on emulator Phone_API35 (no phone taps). Emulator checks over CDP (scratchpad s2/EMU): #44 bar «الجزء ٣ الحزب ٥ ربع ٤» top 64 px under the status bar; #45 off -> root.mbar-off, bookmark alone; #47 partial page = 1 -> hzRecord 100% = 3 -> 50% session keeps 3 -> after force-stop + restart still 3 (#49 persistence); #48 map box tap -> #/p/3?r=2:1-4 with 9 .hm-hl boxes (shamarly); #1 resume button shown on «اختبار الحفظ».
- Bug found on the emulator: #40 three selects in one row clipped «إلى الآية ٣٠» to «إلى الآية ٠» (112 px). Fix style.css:888 .ht-pick grid (surah full row, from/to below), precedent .tq .ht-pick (style.css:1187); re-shot shows «إلى الآية ٣٠» (184 px). APK rebuilt with the fix (same 5.25/73), signer OK.
- Open: kfgqpc not downloaded on the emulator (text view fallback for the word test, page view #11 checked headless); shamarly/kfold #qBar overlaps the top frame ornament (readable, not the text); editions without word boxes: tap reveals the next word; word-test resume restarts the current part; long-press + real status bar on the phone unchecked.
Resume: on the user word: commit (5.23 + 5.24 + 5.25 work) + push + gh release v5.25 (private builds repo) + Play AAB (PLAY=1) -> phone check on bee81250 (safety rules) -> Sprint 3 (#14 needs the bar under the status bar).
- ui.js kfgqpc after the #40 CSS fix: 292/1, P2.5 (5.13) asserted the 3 selects on one row; test updated (from/to right under the surah ok) -> group 5.13 16/0. Layout choice to confirm with the user. Report: build/sprint2-report-5.25.html.

## 5.26 batch (2026-11-20): phone test feedback on 5.25
- 5.25 installed on bee81250 (call state 0, no taps). User phone checklist: 13 pass, 10 notes -> plans/phone-feedback-5.25.md (remove juz bar + setting; #11 mask exactness + new style options; REGRESSIONS: mushaf range test hides the whole page, mic does not stop at range end; #50 no random in «اختبار الحفظ», label «اختبار عشوائي» only; #29 vibrate + sound on skip; #38 scroll instead of moving the caption, 2-line caption in page flip; #47 new flow: map tap -> highlighted ayat + «اختبرني» next to the mic, drop long-press; #48 scroll range into view; #1 resume only in «المراجعة»).
- Goal check: regressions first (break hifz tasmee), then the UX changes; all on the hifz goal.
- Dispatched: qk-dev mask previews (s3/masks), qk-dev read-only root cause of the 2 regressions (s3/rc).
Resume: previews -> user picks a mask style -> verify root causes -> analogical reasoning -> implement 5.26 in groups -> full QA -> APK -> phone checklist.
- Checkpoint 5.26 A DONE (qk-dev; ui.js kfgqpc 298/0 after one Chromium crash rerun; Opus eye check map_open_h112 OK): #47 «اختبرني» pill next to the mic on ?r= ranges -> hzTestStart range path (only 112:1-4 masked, mic stops, stop count 1); long-press + hzPick removed; #48 hmKeep re-fits the range under the bar on image loads; #44/#45 bar label + setting removed, bookmark alone; #50 «اختبار عشوائي»; #1 resume only in «المراجعة»; #29 skipAlert (>=5 words: buzz + 520 Hz 120 ms). Scratchpad s3/A. Note: «اختبرني» pill overlaps the hint line under the nav (fix in B).
- User final #11 style: 5.24 grey boxes + speck widening.
Resume: dev B (#11 restore 5.24 masks + widening, #38 vertical scroll keeps the read line above a fixed caption, flip mode caption max 2 lines, pill/hint overlap) -> full QA x4 -> bump 5.26 (74, sw quran-v70) -> APK + signer -> install phone (user OK given for 5.25 only: ask again) -> phone checklist 5.26.
- Checkpoint 5.26 B DONE (qk-dev; Opus eye check 5.24 grey masks p585 OK): masks back to 5.24 per-run boxes + hzWbMask widening; #38 capKeep vertical follow (caption fixed, 0 overlaps p50/p300/p582), flip caption <= 2 lines; hint hidden while the «اختبرني» pill shows.
- 5.26 bump (74, sw quran-v70). data.py 28/0. APK quran-karim-v5.26.apk signer 7d8b31d2, assets app.js = web/app.js. Installed on bee81250 at the user request (call state 0, no taps) BEFORE ui.js x4 finished (running in background, qa526 logs). Phone checklist build/phone-test-5.26.html (21 steps).
Resume: ui.js x4 + matrix + fs-motion + recite_sim results -> fix any FAIL -> user phone results (read from the checklist page in the browser pane if they use it there) -> release on the user word.
- 5.26 full QA: data.py 28/0; ui.js x4 = renderer "Page crashed" in every edition around groups 5.16/5.16b (~test 240-250), then cascade FAILs (kfgqpc 55, kfold 56, shamarly 51, harmain 49; 14 non-"crashed" lines are "browser has been closed" cascades). 5.25 ran clean -> cumulative leak suspected in 5.26 code. 5.26 already on bee81250 (user asked) -> may affect long sessions. Dispatched qk-dev to instrument heap/timers/listeners vs 5.25, fix, full kfgqpc run.
Resume: leak fix -> ui.js x4 + matrix + fs-motion + recite_sim -> rebuild 5.26 (same version, not released) -> reinstall on the phone with the user's OK.
- User phone test 5.26: 19 pass, 2 small notes -> plans/phone-feedback-5.26.md (map box long-press shows «file:///»; hifz bar covers the moon button). To fix after the leak agent (same app.js).
- Crash investigation (qk-dev): NOT reproducible on 5.26: plain ui.js kfgqpc 298/0; instrumented run shows flat heap 20-41 MB, DOM, timers, listeners, 0 AudioContexts -> no leak. Likely native renderer failure from PC load (emulator Phone_API35 running + an APK build during the ui.js loop). Emulator shut down for the next QA.
- User request: q.maskStyle setting with a colour panel (def, haze, dots, gold, comp #b86f99, anal #52ada7) -> 5.27. Dispatched qk-dev group C (map long-press no callout «file:///», hifz bar vs moon overlap, mask style setting).
Resume: dev C -> bump 5.27 (75, sw quran-v71) -> full QA x4 sequential (nothing else running) + matrix + fs-motion + recite_sim -> APK + signer -> plans/phone-test-5.27.html -> report (plans/) -> install on the user OK.
- 5.27 DONE (75, sw quran-v71): group C (map boxes span role=button + contextmenu prevent + touch-callout none; --hzbar bottom padding so the hifz bar never covers the moon; q.maskStyle colour panel def/haze/dots/gold/comp/anal with hex fallbacks, live repaint, text view too). Full QA with nothing else running: data 28/0, ui.js 302/0 x4 (no crash), matrix 40/0, fs-motion 9/9, recite_sim 0. APK quran-karim-v5.27.apk 70,102,448 B signer 7d8b31d2, assets app.js = web/app.js. Report plans/report-5.26-5.27.html, checklist plans/phone-test-5.27.html.
Resume: user OK -> install 5.27 on bee81250 (call state 0, no taps) -> user checklist -> release (commit 5.23-5.27 + push + gh release v5.27 private builds repo + Play AAB) on the user word.
- 2026-11-20 RELEASED on the user word («ارفع علي github»): commit 96cbdae (5.23-5.27) pushed to main (rebased on 912c5fe, CLAUDE.md LM Studio note); gh release v5.27 on private drmalek1987/quran-karim-builds with quran-karim-v5.27.apk (70,102,448 B, signer 7d8b31d2). Not done: Play AAB (PLAY=1), 5.27 install on bee81250. Left uncommitted on purpose: untracked screenshots/ASR eval outputs, store/fg-options png edits, plans/report-5.26-5.27.html (page screenshots).
Resume: Play AAB 5.27 on the user word -> install 5.27 on the phone (user OK) -> phone checklist plans/phone-test-5.27.html -> next roadmap item.

## 2026-11-20 — 5.28 (76): phone feedback 5.27 (13 pass, 5 notes)
- Goal check: hifz test correctness (test → mic → result) = core app goal; small, targeted fixes.
- #3-5: mask styles haze/dots/gold removed (MASKS = def/comp/anal; old stored values fall back to def via app.js:227).
- #13: «اختبار الحفظ» › «المصحف» (htPages) called hifzTestPages(s, from) with no end -> whole page masked, mic never stopped. Now hzTestStart({k:'a',s,a1:from,a2:to,w:'o'},'m') like the map «اختبرني» (precedent app.js:3010).
- #12: vertical reading .vbar (moon) was fixed at bottom 16px under the hifz bar; now body.has-hifz .vbar uses --hzbar.
- QA: new group «نسخة 5.28» (2 checks) PASS; negative control on 5.27 code FAILs both (masks 939 vs 205, mic on, vbar 624>572).
- Resume: full QA 4 editions -> build 5.28 APK + verify -> report + plans/phone-test-5.28.html -> ask user before install/push.
- QA 5.28: data 28/0 · ui.js 304/0 ×4 editions (kfgqpc, kfold, shamarly, harmain) · matrix 40/0 · fs-motion 9/9 · recite_sim exit 0.
- Build: quran-karim-v5.28.apk 70,086,064 bytes, versionCode 76, signer 7d8b31d2 ✓, assets app.js = web/app.js ✓.
- Resume: user OK -> install on bee81250 (check mCallState=0) and/or GitHub (commit+push, builds release v5.28) -> phone checklist plans/phone-test-5.28.html.
- Released: code 9eec9ee on main; builds repo v5.28 (APK 70,086,064 bytes). Not installed on the phone. Resume: wait for the 5.28 phone checklist results (plans/phone-test-5.28.html).

## 2026-11-20 — 5.29 (77): phone feedback 5.28 (10 pass, 1 note)
- Note #11: random review + vertical reading: after moving to a new place the page scrolled back to the old one.
- Root cause: reciteLineRect (app.js ~2711) used recite.k = the last ayah of the OLD place until the first word of the new one was heard, so capKeep scrolled back on every mic result.
- Fix: reciteLineRect returns null when recite.k is outside the current place [T.s:T.a .. T.end] (precedent: hifzBar app.js:2406 uses the place range).
- QA: «نسخة 5.29» check PASS; negative control FAIL (#/p/441 -> #/p/294), same as the phone.
- Resume: full QA 4 editions -> build 5.29 + verify -> phone checklist plans/phone-test-5.29.html -> ask user (GitHub / phone).
- QA 5.29 (parallel, tools/qa/run-parallel.js): ui.js 305/0 ×4 in 13.3 min wall (5.28 one-by-one: 304/0 ×4 in 51 min) · data 28/0 · matrix 40/0 · fs-motion 9/9 · recite_sim 0 · whole QA 15 min.
- Build: quran-karim-v5.29.apk 70,086,064 bytes, versionCode 77, signer 7d8b31d2 ✓, app.js = web ✓.
- Resume: user OK -> GitHub (commit+push, builds v5.29) and/or phone -> plans/phone-test-5.29.html.
- Installed 5.29 on bee81250 (call state 0, adb install Success, versionCode 77). Not on GitHub yet. Resume: phone checklist plans/phone-test-5.29.html results.
- Phone test 5.29: 8/8 pass (random review vertical, next places, horizontal, «المصحف» range, moon). Resume: GitHub v5.29 on user word -> Play AAB on user word -> next roadmap item (P3 L2 model ship).
- Released: code 162e120 on main; builds repo v5.29. Resume: Play AAB on user word -> next roadmap item (P3 L2 model ship).
- 2026-11-21: Play AAB quran-karim-v5.29-play.aab 40,747,916 bytes: com.lawh.quran, versionCode 77, minSdk 24, upload key SHA-256 71:18:F1…, no harmain/adhan, ORT .so packaged. Local GitHub APK rebuilt (70,086,064, com.quran.karim). Resume: user uploads AAB to Play Alpha (drag-in) -> next roadmap item (P3 L2 model ship).
- 2026-11-21: user uploaded the 5.29 AAB to Play (Alpha).

## Sprint 3 (2026-11-21): mushaf screen + settings (#10 #13 #14 #15 #19 #20 #41 #39 #46), list in plans/sprint3.md
- Goal check: «near-complete app» goal (mushaf screen UX + settings); #39 external mic also serves recognition (a better mic = cleaner audio for ASR).
- Order: A web-only small (#10 #46 #41 #20 #13) -> B native (#15 #14 #39) -> C #19 fit/stretch + pinch -> full QA (run-parallel) -> 5.30 APK -> phone checklist.
Resume: scout locations for group A -> analogical reasoning -> qk-dev A.
- 2026-11-21: user stopped the session before any Sprint 3 code (scout cancelled, nothing edited). Resume (new session): read plans/sprint3.md -> scout -> group A (#10 #46 #41 #20 #13) -> B (#15 #14 #39) -> C (#19) -> QA run-parallel -> 5.30.

## Sprint 4 (2026-11-21): #51 daily review schedule on a scientific basis
- Goal check: review scheduling = hifz retention (near-complete app goal); no ASR impact. Sprint 3 (plans/sprint3.md) still not started; user asked for Sprint 4 now.
- Precondition #49: DONE in 5.25 (hzRecord app.js ~3894 is the single writer; phone pass x3).
- Phase 1 DONE: design note plans/sprint4-review-schedule-design.html. Finding: the code has NO 30-day cap: hzReviewed (app.js:3842) doubles iv up to 90; the map (segc app.js:4503) uses a separate 14-day rule; 70 vs 80 thresholds both exist; unit = whole surah (ward inflates, e.g. al-Baqarah 48 pages).
- Proposal: unit rub' (240, edition-independent), ladder 1/3/7/14/30, >=90 next step (from max(iv, age)), 80-89 same iv, <80 -> 1 day + lapse, first pass after lapse max(3, iv/2); cap 30 for all; budget auto ceil(M/30)+2 rub' when hzDaily = 0; one-time migration q.hzSchedV (iv clamp to ladder <= 30, shared rub' = older r + smaller iv, old keys kept); map colour from the same q.hzSched written only by hzRecord.
Resume: user approves / edits the 4 decisions in section 9 of the note -> Phase 2 (analogical reasoning -> qk-dev -> simulated-date tests -> run-parallel QA -> 5.30 APK signer 7d8b31d2).
- Phase 2 started (user OK 2026-11-21). Analogical reasoning shown. Deviation: migration = idempotent fill in hzSchedData() (no hzSchedV flag) so QA seeds of hzRev after load still migrate; hzRev stays the surah list. Dispatched qk-dev S4 (hzSched, hzNextIv, ward/map/home/alarm, ui.js group 5.30 S4 T1-T9).
Resume: qk-dev S4 report -> Opus review of diff + T1-T9 -> run-parallel QA x4 + data.py -> bump 5.30 -> APK + signer 7d8b31d2 -> report.
- Checkpoint S4 DONE (qk-dev + Opus review): app.js hzSched block ~3830-3945 (HZ_LADDER, HZ_PASS, rubOf, hzNextIv, hzSchedData fill, hzDueList/hzWard budget), hzRecord per-rub' (>=50% coverage), hzRange {k:"rb"}, hzWardTest/Plan by rub', «عليك مراجعة» + home card + alarm by rub', segc from hzSched (14-day rule removed); i18n keys; ui.js group 5.30 S4 T1-T10 + old S1/S7/U1/U2/U5/5.15c checks moved to the new rules.
- Opus review fix: a surah added to hzRev by hzSetRev from 5.30 on carries nf:1 and never feeds the fill (else a passed range of al-Baqarah scheduled all its quarters as reviewed today); T10 covers it.
- Deviations from the note: fill without flag (idempotent); fill counts the union of hzRev surahs per rub' (juz 30 short surahs); title «الربع q من الحزب N».
- QA: run-parallel 4 editions 315/0 each (13.1 min), data.py 28/0. Version 5.30 (78, sw quran-v74). APK quran-karim-v5.30.apk 70,102,448 bytes, signer 7d8b31d2 OK. Not installed on the phone, not committed/pushed.
Resume: user OK -> phone install bee81250 (call state 0, no taps) and/or commit + push + builds release v5.30 -> Sprint 3 (plans/sprint3.md).
- 5.30 installed on bee81250 (call state 0, adb install Success, versionCode 78, no taps). Resume: user phone check of the review ward/map (old review data migrates on first open) -> commit + push + builds release v5.30 on the user word -> Sprint 3.
- 2026-11-21 user feedback on 5.30 phone: map squares are still pages. User choice: 240-rub' map, one row per juz; short surahs = own unit + own square even across a page/rub' boundary (short = letters <= avg rub' letters); long surahs by rub'; weighted auto budget. Union rule of 5.30 removed. Dispatched qk-dev 5.31 (hzUnits, unit fill + 5.30 upgrade, juz-grid map, T11-T15, run-parallel).
Resume: qk-dev 5.31 report -> Opus review + map screenshot -> bump 5.31 (79, sw quran-v75) -> APK + signer -> phone install (call state 0) -> report.
- Checkpoint 5.31 DONE (qk-dev + Opus review of map screenshot): short surah = letters <= 1355.8 (avg rub'), 56 surahs (1, 52, 61-114), one unit "s<n>" + one map square even across page/rub' (At-Tur); long surahs by rub'; hzUnits/hzUnitStates; weighted auto budget ceil(sum w/30)+2; 5.30 hzSched upgrade (rub' keys copied to short-surah units, obsolete keys removed); map = 30 juz rows; ?r=S1:A1-S2:A2 cross-surah ranges. ui.js T11-T15 + old map checks moved to unit ids. QA run-parallel 320/0 x4, data.py 28/0.
- 5.31 (79, sw quran-v75) APK 70,102,448 bytes, signer 7d8b31d2 OK, app.js in APK has hzUnits. Installed on bee81250 (call state 0, no taps). Not committed/pushed.
- Open: summary strings still say «ربع» for mixed units; budget stops at first unit that does not fit; long-press + cross-surah range unchecked on the phone; juz-30 squares have no visible surah names (aria-label only).
Resume: user phone check of the hifz map / ward -> commit + push + builds release v5.31 on the user word -> Sprint 3 (plans/sprint3.md).
- 2026-11-21 user on 5.31: strings «ربع/سورة»; long-press name (surah name / first words of the rub'); units = juz 1-27 by rub' only (Fatiha, At-Tur included), juz 28-30 by surah only (9/11/37); map layout B2 = 30 juz cards (3 per row, juz 30 full width), one coloured cell per unit, header «جزء N» (no «٨ أرباع» for 1-27), card tap -> juz detail list with «اختبرني»; «النهارده» line on top. All sent to one qk-dev run (5.32).
Resume: qk-dev 5.32 report -> Opus review of s6 screenshots -> bump 5.32 (80, sw quran-v76) -> APK + signer -> phone (call state 0) -> report.
- Checkpoint 5.32 DONE (qk-dev + Opus review of s6 shots): «ربع/سورة» strings; long-press tip (hzUnitTip/hzShowTip: «سورة X» / «الربع q من الحزب N» + first 4 words + «سورة X آية Y»); units juz 1-27 rub' (216) + juz 28-30 surah (57) = 273, upgrade of s<58 keys to rub's and juz 28-30 rub' keys to surahs; B2 map: ward card, 30 juz cards (3/row, juz 30 full width, «جزء N» only for 1-27), cell per unit, card tap -> #/hifzmap?j=N list with «اختبرني» (showHifzJuz). Opus fix: juz 28/29 cells 4 columns (same size as 1-27). QA run-parallel 323/0 x4 (before the CSS column fix; S4 group 18/0 after), data.py 28/0.
- 5.32 (80, sw quran-v76) APK 70,102,448 bytes, signer 7d8b31d2 OK, code checked inside the APK. Installed on bee81250 (call state 0, no taps). Not committed/pushed.
Resume: user phone check (long press, card -> juz list -> back, row «اختبرني», 360 px) -> commit 5.30-5.32 + push + builds release on the user word -> Sprint 3 (plans/sprint3.md).
- 2026-11-21 user feedback on 5.32: (1) BUG «اختبرني» marks wrong ayat / part of the unit; (2) drop «الربع q من الحزب N» from the name card; (3) cell tap must not open the mushaf: tap = name card with «افتح في المصحف» + «اختبرني», tap outside only closes; (4) map hint behind an ⓘ button; (5) evaluate repeated «النهارده» (impeccable distill): places = home card (entry), «المراجعة» › «عليك مراجعة» (full home), map card (5.32, duplicate), alarm -> remove the map card. Dispatched qk-dev 5.33 with a 273-unit sweep test for (1).
Resume: qk-dev 5.33 report -> Opus review of s7 shots + root cause -> bump 5.33 (81, sw quran-v77) -> APK + signer -> phone (call state 0) -> report.
- Checkpoint 5.33 DONE (qk-dev + Opus review): ROOT CAUSE of wrong/partial marks: reciteCommit in reciteHear (app.js ~2665) marked every ayah the matcher judged on the page (context ayat before the start / after end too) -> fix hzInTest (app.js:2633) used at :2672. 273-unit sweep (plan/mask/pill/ward) 0 mismatches before and after (ranges were right); simulated recitation 20 units: extra marks 20/20 -> 0/20. Open: 5 units lose ayat recited in the ~700 ms page turn in the finals-only simulation (not confirmed on the phone). Card: tap only (long-press removed), first words + «سورة X آية Y» + status line + «افتح في المصحف»/«اختبرني», outside tap only closes; map hint behind ⓘ; map ward card removed. QA run-parallel 325/0 x4, data.py 28/0.
- 5.33 (81, sw quran-v77) APK 70,102,448 bytes, signer 7d8b31d2 OK, code checked in APK. Installed on bee81250 (call state 0, no taps). Not committed/pushed.
Resume: user phone check (tap card, «اختبرني» marks only the unit, page turn inside a rub') -> commit 5.30-5.33 + push + builds release on the user word -> Sprint 3.
- Released: code 4ad3fc0 on main (5.30-5.33); builds repo v5.33 (APK 70,102,448 bytes). Resume: Play AAB 5.33 on the user word -> phone check of page turns inside a rub' -> Sprint 3 (plans/sprint3.md).
- 2026-11-21: Play AAB quran-karim-v5.33-play.aab 40,756,898 bytes: com.lawh.quran, versionCode 81, minSdk 24, upload key SHA-256 71:18:F1…, no harmain/adhan, ORT .so packaged, hzInTest inside. Local GitHub APK rebuilt (70,102,448, com.quran.karim, signer 7d8b31d2). Resume: user uploads AAB to Play Alpha -> phone check of page turns inside a rub' -> Sprint 3 (plans/sprint3.md).
- 2026-11-21 session audit (user asked what was skipped). Missed steps, written now AFTER the fact (retroactive, not shown before the edits):
  - Goal checks: 5.31 (short surahs as units + rub' map), 5.32 (juz 28-30 by surah, juz cards, «ربع/سورة», name card), 5.33 (test-range bug, tap card, ⓘ, ward card off the map) = all hifz review UX + correctness of what the app records as reviewed -> near-complete app goal; 5.33 fix also keeps hifz scores honest (recognition goal: marks only what was tested). No better route found than fixing on the phone feedback.
  - Analogical reasoning 5.32: precedent = 5.31 hzUnits/hzSchedData fill (app.js ~3861-3990) and the page-map split per surah (hm-s); invariant = one unit -> one cell -> one hzSched entry written only by hzRecord, so map == ward; not copied = letter threshold, page squares, long-press.
  - Analogical reasoning 5.33: precedent = hzSkips already filtering by test range (reciteHear) and the «عليك مراجعة» data-test path; invariant = a test records only ayat inside its own range; not copied = the page-wide judging of the matcher. Tap card precedent = hzShowTip; not copied = hold timer.
  - Usage was not checked between 5.31, 5.32, 5.33 and the release (checked at Phase 2 start and before 5.31 only).
  - 5.32 CSS column change came after its full QA (only the S4 group rerun).
- Audit follow-ups DONE: backup round trip keeps q.hzSched (new ui.js T21, S4 group 21/0); QK2 = last test result only, does not need the schedule; matrix 40/0, fs-motion 9/9, recite_sim exit 0; impeccable detect: 5 findings all pre-sprint (style.css lines from 2026-11-08), none in the new map/card CSS; QA-checklist.md section 5.30-5.33 added (automated done + phone items open); design note section 10 «اللي اتنفّذ فعلًا» added.
Resume: phone checklist 5.30-5.33 (QA-checklist.md) -> Play AAB 5.33 upload by the user -> Sprint 3 (plans/sprint3.md).

## ===== NEXT SESSION: START HERE (handoff written 2026-11-21, end of the Sprint 4 session) =====
State of the app
- Latest version: **5.33** (versionCode 81, sw quran-v77). Code on `main` at 06f37ed (feature commit 4ad3fc0 + progress/audit commits). Local branch name is `chore/backlog-cleanup` but it tracks origin/main; push with `git push origin HEAD:main`.
- GitHub APK: builds repo release v5.33 (quran-karim-v5.33.apk, 70,102,448 bytes, com.quran.karim, signer 7d8b31d2). Installed on the phone bee81250.
- Play: quran-karim-v5.33-play.aab built and verified (com.lawh.quran, versionCode 81, minSdk 24, upload key 71:18:F1…, no harmain/adhan, ORT .so in). **The user uploads it to Play Alpha** (not done by Claude). Previous Play upload was 5.29.
- QA at 5.33: run-parallel ui.js 325/0 x4 editions (+ T21 added after: S4 group 21/0), data.py 28/0, matrix 40/0, fs-motion 9/9, recite_sim ok, impeccable detect clean for the new CSS.

What Sprint 4 (#51) shipped (details: plans/sprint4-review-schedule-design.html, section 10)
- q.hzSched = review schedule, written ONLY by hzRecord (app.js ~4034); ladder 1/3/7/14/30, PASS 80; units = juz 1-27 by rub' (216) + juz 28-30 by surah (57) = 273 (hzUnits ~3861); idempotent upgrade in hzSchedData; weighted daily budget (hzWard).
- Hifz map = 30 juz cards, one cell per unit; tap -> card (first words / surah, status, «افتح في المصحف», «اختبرني»); juz list #/hifzmap?j=N (showHifzJuz); hint behind ⓘ; no ward card on the map. Ward lives in home «النهارده» + «المراجعة».
- Fix: hzInTest (app.js:2633) — a test records only ayat inside its own range.
- QA group «نسخة 5.30 S4» T1-T21 in tools/qa/ui.js (incl. 273-unit sweep, backup round trip).

Open items (not blocking Sprint 3)
1. Phone checklist 5.30-5.33 in QA-checklist.md (bottom section): card tap, «اختبرني» on a rub' over two surahs, **ayat lost right after a page turn inside a rub'** (seen only in the simulation), 360 px, backup restore on the phone. Ask the user for results; fix in 5.34 if needed.
2. Play AAB 5.33 upload (user).
3. Uncommitted files NOT from Sprint 4, left on purpose: store/fg-options/* (modified), tools/qa/ui-results.json, many untracked tools/ and plans files. Do not commit them without asking.

Next work: **Sprint 3 = plans/sprint3.md** (mushaf screen + settings: #10 #13 #14 #15 #19 #20 #41 #39 #46; groups A (#10 #46 #41 #20 #13) -> B (#15 #14 #39) -> C (#19)). Nothing of Sprint 3 is coded yet. Next version = 5.34.

Rules learned this session (follow them)
- First reply: restate the session rules (SessionStart hook), goal check before every step, analogical reasoning shown BEFORE every non-trivial edit (this session missed it for 5.32/5.33), check usage between every checkpoint (missed 5.31-5.33), full QA after the LAST code change before a build.
- Offer choices as an interactive show_widget form AND a copyable numbered text list (memory options-copyable-text); never the AskUserQuestion dialog.
- Delegate code to qk-dev (one agent per batch so full QA runs once); Opus reviews screenshots + root causes. qk-dev can drop on network errors: resume it with SendMessage, do not restart.
- Phone: check `mCallState=0` before install, never tap.
- Every release: bump manifest + web/index.html (2 places) + web/sw.js; build-win.py; verify signer 7d8b31d2 and that the new code is inside assets/web/app.js; PLAY=1 build overwrites the GitHub APK name -> rebuild the GitHub APK after the AAB.
Resume: ask the user for the 5.30-5.33 phone checklist results -> start Sprint 3 group A (scout -> analogical reasoning -> qk-dev) -> 5.34.
- 2026-11-21: user uploaded quran-karim-v5.33-play.aab to Play closed test Alpha (release notes Arabic only: store/release-notes-5.33.txt; Play rejects en because the listing has no en-US translation). Resume: 5.30-5.33 phone checklist results -> Sprint 3 group A -> 5.34.

## Sprint 3 session (2026-11-23)
- Goal check: near-complete app (mushaf screen UX + settings); #39 external mic also helps recognition (cleaner audio). Version for this sprint = 5.34 (5.30-5.33 were Sprint 4).
- Usage at start: weekly 68% (stop rule 75%), 5-hour 2%.
Resume: qk-scout report -> analogical reasoning group A -> qk-dev A.
- User 2026-11-23: no usage stop limit for this session. Analogical reasoning group A shown; qk-dev A dispatched (#10 #46 #41 q.openAt #20 q.tapMark #13 pg-r/pg-l, ui.js group G534).
Resume: qk-dev A report -> Opus review -> group B reasoning (#15 #14 #39).
- Checkpoint A DONE (qk-dev + Opus review of shots): #10 page-nav = pNum/play/dark, voice turn via rdPage.turnBy; #46 prTest+hint+testAlarmAt removed; #41 q.openAt + openAtLaunch(); #20 q.tapMark; #13 pgSide() pg-r/pg-l spine gradient. QA run-parallel 341/0 x3, kfold 1 flake (backup filename race, 10/10 alone), data.py 28/0. Night/fs-crop look not yet seen.
Resume: qk-dev B (#15 keepOn, #14 status bar in fs + qMk, #39 mic choice) -> Opus review -> C.
- 2026-11-23 user: phone bee81250 connected (API 31, BT headset ready); user approved installing the B test build (quran-karim-v5.34-mictest.apk) on the phone. Taps still need approval each time.
- Phone #39 test (5.34-mictest, signer 7d8b31d2, installed with user OK, call state 0, no Claude taps): logcat shows the HAL input = bt-sco-mic-wb (SND_DEVICE_IN_BT_SCO_MIC_WB) from AudioRecord start 21:44:01.468 (SCO open 21:44:01.543, mic on 21:44:01.603) to stop 21:44:16.089; on stop setCommunicationDevice(null), SCO closed, A2DP resumed. Side note: "Unable to open asset pages/545.avif" in logcat (check: preload past last page?). Waiting: user says whether recognition marked the words; qk-dev B report.
- User phone #39: BT mic PASS — words marked correctly, no first-word delay. OPEN (user: «لا تنسى»): pages/545.avif asset error in logcat -> find the caller before 5.34.
- Design hook (10 findings) checked: style.css 193/243/336 are unchanged lines from HEAD (193 dates to 2026-10-31); today's real diff (--ignore-cr-at-eol) adds no side borders, shadows or glow in style.css/index.html -> all pre-existing, left standing, no ignore added.
- FOUND: group A edits turned web/app.js, style.css, index.html from LF to CRLF (git diff shows whole files changed). Convert back to LF after qk-dev B finishes, before QA/commit.
- Emulator boot loop (user report): API 37 image (rev 7) + emulator 37.2.12 -> surfaceflinger abort 'hasReadColorBufferDma' in RegionSampling, with gpu auto, swiftshader_indirect and host alike. Workaround: Phone_API35 AVD (stable, 0 crashes). Fix later: update the emulator package (sdkmanager "emulator", download -> ask the user) before using API 37 AVDs again.
- User: continue on API 35, no emulator package update now.
- User on mictest build: rename «مايك التلاوة» -> «اختيار الميكروفون»; drop the 'mic test uses phone mic' sentence; «اختبار المايك» row right under it; mic test must use the chosen mic (sent to qk-dev B).
- User approved installing the next B build (after mic-test changes) on bee81250 as soon as it is ready (call state 0, no taps).
- User: remove #pMark «علامة على هذه الصفحة» under the page; surah name line takes its place (sent to qk-dev B). Precedent: .page-tools row with .tj-key (app.js ~1484); invariant: page-info keeps its class so fs-hide/reading colours apply; not copied: pMark handler. Named bookmarks stay via ayah bar (app.js ~1909) + qMk.
- 545 investigation: harmain.zip has pages/545.avif; EdStore.serve (EdStore.java:37) returns null when the file is missing in the downloaded copy -> WebView falls back to the asset -> logcat error. Also seen: 'Unable to open asset' for books/words/5.js and books/lex/mufradat/24.js although .js.br exist in the APK (MainActivity.java:103 Brotli path). Release APK is not debuggable (run-as refused) -> asked qk-dev for a debuggable mictest2 build (same key) to inspect via run-as + CDP.
- User: word meaning works on the phone -> books/*.js asset errors are log noise (content is served); lower priority. 545 still to check with the debuggable build.
- Checkpoint B DONE (qk-dev + Opus review of shots3): #15 AppBridge.keepOn (FLAG_KEEP_SCREEN_ON, emulator dumpsys ok); #14 AppBridge.fsStatus + immersive hides navigationBars only + insets fsTop=insT; #qMk rect [8,64,32,32] css in normal/fs/fs+status/hifz/hifz-fs (Phone_API35); #39 MicRoute.java (setPreferredDevice, API31+ setCommunicationDevice, <31 SCO), NvBridge.mics/setMic/micTest, native mic test shows routed device, [mic] console lines; «اختيار الميكروفون» + «اختبار المايك» under it; #pMark removed, surah line leads .page-tools. QA 351: kfgqpc/shamarly/harmain 1 fail each = new test read during transition (test fixed, kfgqpc 25/25 after), kfold 7 = old flaky prayer G12 (351/0 alone). data.py 28/0. build-win.py: DEBUGGABLE=1, APK_SUFFIX.
- INCIDENT: qk-dev's first test build overwrote quran-karim-v5.33.apk (+.idsig) with test code. Restore needed (rebuild from HEAD 77e9ccb in a worktree, or download builds release v5.33 with user OK).
- mictest2 (debuggable, signer 7d8b31d2) installed on bee81250 (call state 0, user OK). run-as: files/ed/pages has 560 files incl. 545.avif -> the 545 asset log is not a missing file.
Resume: user opens app -> CDP: reproduce 545/books asset logs; user tests «اختبار المايك» with BT -> restore v5.33.apk -> LF endings -> group C.
- Phone mictest2: «اختبار المايك» with BT -> «المايك المستخدم: سماعة بلوتوث …» PASS (name part now removed in web, ui.js 5.34 25/0).
- 545 CLOSED (CDP probe on bee81250, harmain, read-only): new Image('pages/545.avif') loads OK (618 px) while Chromium still logs 'Unable to open asset' for it -> the log line is noise from Chromium's asset handler, not a missing page. Latent: a page URL with ?query is not served by EdStore.serve (rel includes the query) -> ERR; the app never adds queries to page URLs, so no fix now. fetch() of file:// fails by design; app loads books with <script> (works, user confirmed).
- v5.33.apk restored: rebuilt from HEAD 77e9ccb (web/android same as 4ad3fc0) in worktree D:/qk-wt533 (removed): 70,102,448 bytes (= original size), versionCode 81 / 5.33, not debuggable, signer 7d8b31d2, assets app.js byte-identical to the commit.
- LF restored: web/app.js, style.css, index.html, i18n.js, tools/qa/ui.js, MicRoute.java (AppBridge/NvAsr stay CRLF as in HEAD). git diff now = 424+/63- real lines.
- Group C #19 analogical reasoning shown: precedent style.css:1008-1015 (fs --W fit) + swipe app.js:1591 (isPrimary, visualViewport guard); invariant: overlays % of .page-box, ayahAt uses w/h separately -> non-uniform stretch stays aligned; not copied: 640px floor, native zoom-in kept. Design: q.fsFit width(default)/stretch seg; in fs pinch-in at scale 1 toggles; vertical untouched. Dispatched qk-dev C.
- 2026-11-23 23:07 user (via fork): «انا هنام دلوقتي ، خلص كل حاجة في الخطة وبعدين نام». Plan: C -> full QA -> QA-checklist -> 5.34 bump + APK (signer) -> phone checklist page. NOT covered: push/commit, phone install of 5.34, taps -> wait for user.
- Checkpoint C DONE (qk-dev + Opus review of shots4): #19 q.fsFit width(default)/stretch, html.fsfit-stretch CSS (style.css ~1029, --SW/--F/--H, no 640 floor), pageFitPinch (app.js ~1635, pinch-in at scale<=1.05 in fs toggles, 500 ms tap/turn guard). Mic hint removed + routed label = kind only (Opus). LF kept.
- FINAL QA (after the last code change): run-parallel 357/0 x4, data.py 28/0, matrix 40/0, fs-motion 9/9, recite_sim 0. QA-checklist.md section 5.34 added.
- 5.34 (82, sw quran-v78) built: quran-karim-v5.34.apk 70,102,448 bytes, signer 7d8b31d2, not debuggable, web files byte-identical. Phone checklist: plans/phone-test-5.34.html (21 items, copy button, smoke-tested headless).
- Phone still has the debuggable mictest2 build (5.33 label). NOT done (needs user word): install 5.34 on bee81250, commit + push (git push origin HEAD:main), builds release v5.34, Play AAB.
Resume: user OK -> install 5.34 (call state 0, no taps) -> user runs plans/phone-test-5.34.html -> commit/push + builds release + Play AAB on the user word.
Rules learned (Sprint 3 session): test builds must use APK_SUFFIX=-xyz (build-win.py) — a plain build overwrites the versioned release APK (5.33 was overwritten once and rebuilt); qk-dev briefs must say "keep LF endings" (group A turned web files into CRLF); emulator checks on Phone_API35 only.
- Released (user: «ارفع على GitHub»): code e25d7d1 on main (Sprint 3, 15 files; store/fg-options, ui-results.json and untracked tools left out); builds repo release v5.34 (quran-karim-v5.34.apk 70,102,448 bytes). Resume: install 5.34 on bee81250 on the user word -> phone-test-5.34.html -> Play AAB (PLAY=1, then rebuild GitHub APK name) on the user word.

## 5.35 (phone feedback on 5.34, 2026-11-24): 16/21 pass
- Goal check: near-complete app (mushaf reading UX); no ASR impact except the mic list.
- Feedback: (3) spine too weak + on/off setting; (5) «عند فتح التطبيق» belongs under «التطبيق»; (15) «مايك الهاتف» twice (two builtin mics); (16) stretch jumps on fs enter/exit + new mode «النص فقط» (zoom so the text block fills the screen, frame overflows); (18) pinch does nothing on the phone (WebView built-in zoom takes it).
- Reasoning shown: spine = 5.34 ::after + seg/html class; mic = dedupe builtin in micDevices (app.js:3086); jump = FLIP from fit rect to stretch rect, precedent 5.11 G2 glide + fs-motion; text-only = deeper crop like EDS crop (style.css ~1018) from an edition-wide text block computed from ayah boxes; pinch = in fs touch-action none + own 2-pointer zoom: out -> bigger mode (width -> stretch -> text), in -> smaller.
Resume: qk-dev 5.35 batch -> Opus review -> full QA -> 5.35 APK.
- Checkpoint 5.35 DONE (qk-dev + Opus review of shots5): spine alpha .55/width min(18%,92px) + q.spine «ظل الكعب»; #openSet in «التطبيق»; micDevices dedupe type+name (twin id maps); q.fsFit width/stretch/text, text-block rect per edition EDS[ed].tb (kfgqpc [.141,.144,.141,.226], kfold [.097,.101,.097,.184], shamarly [.087,.112,.094,.121], harmain [.069,.009,.001,.008]); fsFlip 2-axis + clip-path; pinch out=bigger / in=smaller, fs touch-action pan-y. QA 376/0 x4, data 28/0, matrix 40/0, fs-motion 17/17, recite_sim ok.
- 5.35 (83, sw quran-v79) APK 70,118,832 bytes, signer 7d8b31d2, not debuggable, web byte-identical. plans/phone-test-5.35.html (14 items). Not installed, not committed/pushed.
Resume: user OK -> install 5.35 (call state 0) -> phone-test-5.35 -> commit/push + builds release on the user word.
- 5.35 installed on bee81250 (user OK, call state 0, was 5.34, now versionCode 83 / 5.35, no taps). Resume: user runs plans/phone-test-5.35.html -> commit/push + builds release v5.35 on the user word.
- Phone test 5.35: 14/14 pass (pinch out/in in fs works on the real WebView, text mode, no fs jump, spine toggle, openAt in «التطبيق», one «مايك الهاتف»). Resume: commit/push + builds release v5.35 on the user word -> Play AAB on the user word.
- User: hold the 5.35 GitHub upload for now (no commit/push/release).

## ===== NEXT SESSION: START HERE (handoff written 2026-11-24, end of the Sprint 3 session) =====
State of the app
- Latest version: **5.35** (versionCode 83, sw quran-v79). Installed on the phone bee81250, phone test 14/14 pass (plans/phone-test-5.35.html).
- **5.35 is NOT committed or pushed** (user said «لسه»). Uncommitted 5.35 files: android/AndroidManifest.xml, web/app.js, web/i18n.js, web/index.html, web/style.css, web/sw.js, tools/qa/ui.js, tools/qa/fs-motion/measure.js, QA-checklist.md, progress.md, plans/phone-test-5.35.html. On the user's word: commit these only, `git push origin HEAD:main` (local branch chore/backlog-cleanup tracks origin/main), then `gh release create v5.35 quran-karim-v5.35.apk -R drmalek1987/quran-karim-builds --target main`.
- Local APK quran-karim-v5.35.apk 70,118,832 bytes, signer 7d8b31d2, not debuggable.
- Last pushed: 5.34 = code e25d7d1 (+ progress fb2ffae) on main; builds repo release v5.34. Play: last AAB upload was 5.33 (no AAB for 5.34/5.35 yet; build with PLAY=1 + build-aab-win.py, then rebuild the GitHub APK because PLAY=1 overwrites its name).
- Still uncommitted on purpose (not from Sprint 3, ask before committing): store/fg-options/*, tools/qa/ui-results.json, many untracked tools/ and plans files.

What Sprint 3 + 5.35 shipped (details: QA-checklist.md sections 5.34 and 5.35)
- Mushaf screen: no «السابقة/التالية» (voice turn via rdPage.turnBy); surah/juz line in .page-tools instead of #pMark; spine shadow pg-r/pg-l (pgSide) + setting «ظل الكعب» q.spine.
- Settings (q. keys): openAt (in «التطبيق»), tapMark, keepOn (AppBridge.keepOn), fsStatus (AppBridge.fsStatus, immersive hides nav bar only), micId («اختيار الميكروفون», MicRoute.java: setPreferredDevice + Bluetooth setCommunicationDevice/SCO; «اختبار المايك» = NvBridge.micTest on the chosen mic), spine, fsFit = width / stretch / text («النص فقط» = text block per edition EDS[ed].tb).
- Fullscreen: FLIP 2-axis + clip-path animation (fsFlip) on enter/exit/mode switch; in fs the pinch is ours (out = bigger mode, in = smaller), touch-action pan-y only in fs; native zoom outside fs.
- Removed: adhan test button «جرّب الأذان بعد دقيقة» + hint (testAlarmAt).
- QA groups «نسخة 5.34» (G534) and «نسخة 5.35» (G535) in tools/qa/ui.js; fs-motion has 17 cases.

Open / known
- pages/545.avif + books/*.js «Unable to open asset» lines in logcat are Chromium noise (content loads; checked over CDP). Latent: EdStore.serve does not strip a ?query from page URLs (app never adds one).
- API 37 AVDs crash surfaceflinger on this PC (emulator 37.2.12 vs image rev 7); use Phone_API35. Updating the emulator package needs the user's OK (download).
- 5.30-5.33 phone checklist items in QA-checklist.md (hifz map / review) were never reported back.

Sprint 5
- No plan file yet. Items left over from plans/sprint3.md «Later»: 17, 12, 24, 33, 3, 21, 22, 30, 18, 34, and #32 hifz programme (design doc first) — numbers from the user's list (session 12f5d8f2); confirm titles with the user before planning. Start: write plans/sprint5.md with the user, then scout -> analogical reasoning -> qk-dev per group -> full QA -> 5.36.

Rules learned (follow them)
- First reply: restate the session rules; goal check before every step; analogical reasoning shown BEFORE every non-trivial edit; full QA (run-parallel + data.py + matrix + fs-motion + recite_sim) after the LAST code change before a build.
- Test builds: `DEBUGGABLE=1 APK_SUFFIX=-xyz` with build-win.py (a plain build overwrites the versioned release APK; 5.33 was overwritten once and rebuilt from the commit). Debuggable build = run-as + WebView CDP on the phone (scratchpad cdp545.py pattern, websocket-client venv).
- qk-dev briefs: say "keep LF line endings" (web/*, ui.js are LF; AppBridge.java/NvAsr.java are CRLF), and give one batch per agent so full QA runs once.
- Phone: check mCallState=0 before install; never tap; install / commit / push / release / Play only on the user's word.
- Every release: bump manifest versionCode/versionName + web/index.html (2 places) + web/sw.js cache; verify signer 7d8b31d2, not debuggable, and that assets/web files are byte-identical to web/.
Resume: user OK -> push 5.35 (see above) -> plan Sprint 5 with the user (plans/sprint5.md).

## Sprint 5 session (2026-11-24): investigations #28 #27 #25 + #2 ASR fast/slow benchmark -> 5.36
- Plan: user prompt (A: #28 vibrate on 5 errors, #27 split-ayah page flip at first word of new page, #25 portrait page-load delay app vs phone; B: #2 ASR benchmark hadr/mujawwad + atempo 0.5x-4x, HTML report in plans/, STOP for user approval). Builds on uncommitted 5.35.
- Goal check: A = near-complete app UX; B = >95% recognition for any reciter/speed. B runs in background (GPU) in parallel with A scout.
Resume: qk-scout A report + benchmark agent report -> investigation write-ups (bug/by design + file:line) -> analogical reasoning -> qk-dev fixes.
- #28 code read (Opus): alert = errAlert app.js:32, fired only at app.js:2834 in reciteCommit: `bad.length > 5` (6+, not 5) per ONE ayah (not consecutive; errors across 2 ayat never add up), only when the ayah's last word is heard (2829) and only on 'final' (2817), once per ayah per app run (recite.alerted created lazily at 2834, never cleared; recite object 2587). skipAlert app.js:39/2366 independent (skipped words are not in disp, so no double count). Java AppBridge.buzzPattern 100-113 only skips when no vibrator. Verdict pending recite_sim repro (tools/qa/sprint5/).
- #27: two paths: reading-follow rdSplitTurn app.js:3089 (turn when last word printed on page is read) and hifz test hifzPageEnd 2449. Repro running. #25: harness running (headless + emulator, phone later with user OK).
Resume: repro reports (#28/#27) + #25 harness + ASR bench -> verdicts -> analogical reasoning -> qk-dev fix batch.
- Checkpoint repro (tools/qa/sprint5/alert_repro.js, split_turn.js):
  - #28 BUG. (1) AppBridge.java:103-104 prepends a 0, JS app.js:33/40/4398 also start with 0 -> pattern shifted: errAlert = one 120 ms pulse after 300 ms (skipAlert 60 ms) -> "not felt". (2) app.js:2834 `bad.length > 5` per ayah (5 never alerts), needs ayah end (2829), once per app run (recite.alerted never cleared). (3) skipAlert fires on partials (2366) and back to back with errAlert (vibrate replaces).
  - #27 BUG only in the hifz test, only in editions with split ayat (shamarly, harmain; kfgqpc/kfold pages always end on an ayah end): normal reading turns at li+1 OK in p/l/spread; when the last word on page n is misheard/skipped hifzPageEnd app.js:2449-2456 waits for 'final' (hifzLook 2472 null for split ayah -> ahead=0). Reading-follow rdSplitTurn OK. Vertical view: no turn by design (scroll follows).
  - Fix batch dispatched to qk-dev (app.js only): patterns without leading 0; consecutive run of 5 (wrong or skipped, >=1 wrong) across ayat on final; reset alerted per test; skipAlert only on final and not with errAlert; hifzPageEnd: right word past li -> turn.
Resume: qk-dev #28/#27 report -> Opus review -> #25 harness report -> #25 fix -> ASR bench report.
- 2026-11-24: user OK («موافق») to install a debuggable -cdp test build on bee81250 for #25 CDP measurement (call state 0, no taps). Wait until qk-dev #28/#27 edit + #25 harness finish (no half-edited app.js, no parallel build), then build DEBUGGABLE=1 APK_SUFFIX=-cdp, install, measure, restore 5.35 after.
- Checkpoint #2 ASR speed bench DONE (report plans/asr-speed-report.html, raw plans/asr-speed-bench/results.json, scripts tools/asr/speedbench/). Model G10b.int8 md5 64C11016… = pack v4 (app.js:391 ver 4) verified by Opus. 961 runs. Synthetic tracking: 0.5x 95.2, 0.75x 98.5, 1.0x 98.8, 1.25x 98.5, 1.5x 97.3, 2x 88.1, 3x 57.0, 4x 9.7. Real: murattal WERskel 7.9/track 97.0, hadr 11.0/96.6, slow(<0.8 w/s) 11.4/97.6. By absolute rate: OK to ~2.0 words/s, fails above 2.0-2.5. Cause: train speed aug only 0.9-1.1 (nv_curr.py:196). Slow: VAD/12 s cut cost ~6.8 WER points. No real mujawwad locally (everyayah download needs user OK). Plan (not started): VAD retune first, then fine-tune from G10b with atempo 0.6-2.2 + ~382 real fast clips, gate ctc_up ALL >= 97.3 + this bench.
Resume: STOP #2 for user approval of verdict/training plan; continue A (#28/#27 qk-dev review, #25 harness -> -cdp build + phone measure).
- Checkpoint #25 harness (tools/qa/sprint5/perf/: payload.js, run-playwright.mjs, run-cdp.py + .venv). Single view fast everywhere (headless 6x CPU p50 78-88 ms, emulator 50/73). Vertical view (showPagesV app.js:1191-1200, 604 lazy imgs, no decode-ahead) blanks: emulator p50/p95 1 pps 67/161, 3 pps 112/253, 8 pps 234/364 ms (64/92 blank frames); trace: ImageDecodeTask ~60 ms p95 at raster time, images already loaded -> cause = on-demand decode (app side); ~28 pages ahead loaded, never released (200-350 MB RGBA). Phone (call state 0) has com.quran.karim 5.35 non-debuggable + com.lawh.quran. Plan: -cdp build after qk-dev #28/#27 -> phone baseline -> fix (IntersectionObserver decode-ahead in vertical view, precedent decode 1881 + preload 1587) -> measure again.
- 2026-11-24 user: approves #2 training with all precautions; re-evaluate vs alternatives (world-standard recipes), pick best; current model must never get worse. User asleep, all consents to finish the session work; phone away -> phone tests at the END. (Push/release still held: user said earlier to hold 5.35 upload.)
- #2 phase 2 dispatched (Opus agent): plan-compare.md (A1 VAD retune, A2 inference tempo normalisation, B fine-tune from G10b with tempo aug + replay, C combos), mujawwad eval data from everyayah (eval only), gate vs ALL existing gates + speed bench, G10b never overwritten, winners as new files / NvAsr patch (not applied).
- #25 phone measurement moves to the end (phone away); before/after on emulator meanwhile.
Resume: qk-dev #28/#27 report -> review -> #25 fix (qk-dev) + emulator before/after -> wait #2 phase 2 -> integrate winner if any -> full QA -> 5.36 build -> phone checklist.
- 2026-11-24 user idea for #2 (sent to the training agent): reading modes «سريع / عادي / بطيء» (manual pick; «عادي» = current pipeline bit-identical) or auto speed detection that switches rule sets. Opus decision: one model, per-mode rule sets (A1 slow VAD, A2 fast tempo norm), evaluate auto switcher confusion + gates; likely ship auto + manual override as q.asrPace if auto never loses on normal. User: «قرر بنفسك».
- Checkpoint #28/#27 fix DONE (qk-dev, Opus reviewed app.js 2357-2389, 2839-2850): patterns "300,120,300"/"120,60,120"/"70,90,70"; hzScope + hzErrRun (run of 5 wrong-or-skipped, >=1 wrong, across ayat, once per run, recite.alerted/skC cleared in hifzToggle/hifzTestPages/resume); skipAlert only on final, never with errAlert; hifzPageEnd right word past li -> turn. alert_repro a-h,j PASS; i (pure 6-word skip) gives ERR not skip: the final judges skipped words wrong (rLocal), accepted by Opus (one alert either way). split_turn hz miss/skip: shamarly 2-4/12 -> 12/12, harmain 2/12 -> 10/12 (5:92 p/l pre-existing, also normal, li=1). recite_sim errs []. ui.js 376/1 (5.35 FLIP pinch flaky under load, 19/19 alone).
- #25 fix dispatched (qk-dev): IntersectionObserver decode-ahead in showPagesV, headless + emulator before/after.
Resume: #25 report -> review -> #2 training agent report -> integrate winner -> full QA -> 5.36 build -> phone checklist.
- Checkpoint #25 fix in app.js (qk-dev): vObs IntersectionObserver rootMargin 150% in showPagesV (~1206-1219) decodes page + tjo imgs once per box; disconnect in showPagesV start and route() (~6640). content-visibility skipped (scroll math). Measured under heavy host load (GPU training): emulator A/B p50 better at 1/3 pps (e.g. 1 pps 282-427 -> 214-307 ms), 8 pps equal-to-better, p95 not clear; headless mixed/noisy. Not conclusive -> re-measure on emulator after the training job ends, and on the phone at the end. payload.js setTurn h->off fixed (Opus). ui.js 376/0 effective (2 flaky reruns pass). APK quran-karim-v5.35-cdp.apk (emulator only).
Resume: wait #2 training agent -> clean emulator re-measure #25 -> integrate #2 winner -> full QA -> 5.36.

- 2026-11-24 ASR #2 candidates (plans/asr-speed-bench/runs.md, plan-compare.md): A1 slow-merge auto (slow_wps 1.0, slowq 2 s, mcap 30 s) = WINNER, every gate >= G10b (ctc_up ALL 97.3 -> 97.6, SNR 98.6/97.3/94.6, wrong-caught 99.1 =), mujawwad WERskel 11.4 -> 8.8, new everyayah mujawwad set (78 clips, eval only) 14.7 -> 11.2; proposal plans/asr-speed-bench/nvasr-pace-slow.patch.md (q.asrPace normal|slow|auto, not applied).
- 2026-11-24 A2 tempo normalisation (fast mode) REJECTED: synthetic 2x tracking 88.1 -> 94.9 but real hadr 96.6 -> 92.2, gate ALL 96.9. AUTO A1+A2 rejected (ALL 97.0).
- 2026-11-24 B fine-tune G10s (G10b + atempo 1.3-2.2/0.6-0.8, LR 1e-5, 1200 steps) REJECTED: int8 gate retasy_wrong 94.8 -> 94.2, no speed gain; G10sb (LR 3e-5) failed the noisy proxy gate. G10b stays; nothing shipped.
Resume: on the user's word port nvasr-pace-slow.patch.md to NvAsr.java + q.asrPace setting (default normal), Java/Python parity on the gate clips, phone test with a mujawwad reciter; fast/hadr stays open (no safe fix found).
- Checkpoint #2 phase 2 DONE (Opus agent, details plans/asr-speed-bench/runs.md, plan-compare.md, report updated): G10b stays (sha rechecked). A1 slow-merge WINNER (pieces < 1.0 w/s joined with next within 2 s quiet, cap 30 s): auto ALL 97.6, forced slow 97.8, every gate >= G10b; mujawwad held-out WERskel 11.4 -> 8.8, everyayah mujawwad 14.7 -> 11.2, 0.5x 14.9 -> 9.2. A2 fast tempo norm rejected (real hadr 96.6 -> 92.2, ALL 96.9). B fine-tune G10s rejected (retasy_wrong 94.8 -> 94.2; LR 3e-5 failed noisy). Fast >= 2.5 w/s stays open (no hadr data on everyayah).
- Opus decision for 5.36: ship q.asrPace normal (default, bit-identical) + slow (manual «مجوّد / بطيء»); auto later (needs concurrent probe + Java/Python parity + phone test). Dispatched qk-dev.
- Checkpoint q.asrPace DONE (qk-dev + Opus review of NvAsr.java diff; Opus added heldAt = 0 on piece reset): NvAsr setPace + pz read once; slow = seg MCAP 30 s, end at SLOW_Q 2 s quiet, emit up to heldAt; normal path logically unchanged. app.js #paceRow «سرعة القراءة» (عادي / مجوّد / بطيء) shown only with NvBridge.setPace, setPace before Mic.start, judge windows tailMs 3000/5000. ui.js G536 4 checks, 380/0. NvAsr compiles (javac). Java/Python parity skipped (loop inline with AudioRecord) -> phone test with mujawwad.
- Bumped 5.36: versionCode 84, index.html x2, sw quran-v80. Emulator stopped. Full QA running (qk-qa).
Resume: QA report -> build 5.36 (plain build-win.py) -> signer 7d8b31d2 + not debuggable + assets/web byte-identical + new code in assets/web/app.js -> QA-checklist 5.36 + plans/phone-test-5.36.html -> final report.
- Checkpoint 5.36 BUILT: full QA pass (380/0 x4 after known flaky rerun, data 28/0, matrix 40/0, fs-motion 17/17, recite_sim ok, alert_repro ok, split_turn ok). quran-karim-v5.36.apk 70,118,832 bytes, signer 7d8b31d2, not debuggable, assets/web byte-identical (2297), new code inside. QA-checklist 5.36 + plans/phone-test-5.36.html written. Not installed, not committed/pushed (5.35 hold still stands).
Resume: user back with the phone -> (OK given) install 5.36 (call state 0, no taps) -> user runs plans/phone-test-5.36.html -> #25 phone CDP before/after (debuggable -cdp builds of 5.35 and 5.36, run-cdp.py --serial bee81250 --pkg com.quran.karim) -> commit/push 5.35+5.36 + builds release on the user word. Later: auto pace (probe + Java/Python parity), fast reading >= 2.5 w/s needs real hadr data.
- 2026-11-24 user: has a licence to use Sheikh Ahmed Deban's hadr mushaf for training; asked to download it. Source: official channel video WHmnMsqKTvc «مصحف الحدر لمراجعة الحفاظ (طبعة مصحف الشمرلي) القرآن كاملا», 7:28:33, original speed (description: «مادة أصلية غير مسرعة»). Audio only (format 251 opus ~427 MB) -> D:\Quran App\qtrain\deban\ (outside git; never redistributed, never in the app). Plan: CTC-align to ayat with G10b, hold out surahs for eval, fine-tune from G10b with replay, same gates (must be >= G10b everywhere).
- Deban audio downloaded: qtrain/deban/deban_hadr.webm 426,648,860 bytes, 26,913 s. Phase 3 agent dispatched (Opus): CTC-align to ayat, ~10% hold-out, baseline G10b, fine-tune with replay (<=3 configs), full gates, report section. Resume: phase 3 report -> if winner: pack v5 + app ver 5 + full QA + 5.37 build; else keep G10b.
- 2026-11-24 user: the training recipe matters most: review training history, research other recipes, test and compare, pick the best or a mix, try innovative recipes. Sent to the phase 3 agent: recipe-study.md (history table + cited research), matrix of 6-10 short runs (replay ratio, partial fine-tune/freeze, adapters/LoRA, L2-SP/EWC, KD from G10b, WiSE-FT alpha sweep, EMA/averaging, LR schedules, speed perturb/SpecAugment, rate curriculum, tempo-matched consistency pairs, rate-balanced sampling, piece-level cuts) -> best 2-3 + mix full gate.
- 2026-11-24 item #2 phase 3 (Deban hadr, data only under qtrain/deban): alignment done (chunked CTC Viterbi, G10b fp32 emissions, Uthmani->imla'i labels; 2 passes agree 6235/6236 within 0.2 s; kept 4955/6236 ayat = 6.26 h, median 3.03 w/s; hold-out 13 surahs = 565 clips). Baseline G10b int8 on Deban HO: verify 94.5, CER 5.4, ayah id 95.4, WERskel 10.4 / track 95.3. Recipe matrix running (tools/asr/gpu/g10d_matrix.sh, level G10d, log g10d.log).
Resume: if g10d.log lacks MATRIX_DONE rerun bash tools/asr/gpu/g10d_matrix.sh (skips finished tags); then full runs of the best 2-3 + WiSE (qtrain/deban/exp.py) + gates (qtrain/deban/gate_set.sh, speedbench/run_cfg.sh).
- 11:33 Opus: recipe matrix G10d: p3lr1, p4top, p5kd, p6l2sp, p7ema done, none passed the proxy gate (clean fails = forgetting; deban_ho 8.4-8.8 vs G10b 9.09). Phase 3 agent dropped twice on SSL API errors, resumed; matrix job keeps running on its own. Next: WiSE-FT alpha sweep + higher replay/lower LR/freeze.
- 2026-11-24 11:30 G10d matrix (600 steps): only p1base (DEB_P .2, LR 3e-5) passed the proxy; others fail clean by 0.2-0.9 (forgetting) with deban_ho 9.09 -> 8.4-8.8. Reference G10b re-export = sha e3294079 (bit-exact). Running: qtrain/deban/full_gate.sh p1base (CPU), tools/asr/gpu/g10d_stage2.sh (_f1, _f2mix 1500 steps, after MATRIX_DONE).
Resume: rerun whichever of full_gate.sh / g10d_stage2.sh lacks its DONE marker; then WiSE alpha sweep via full_gate.sh <name> <ckpt> <alpha>.
- 2026-11-24 15:50 G10d gates: p1base int8 improves hadr (Deban verify +0.8, CER 5.4->5.0, other real hadr WERskel 11.0->10.4) but FAILS ho_retasy_wrong -1.0 (and retasy -0.4); WiSE 0.5 retasy_wrong -1.0, WiSE 0.3 -0.6 -> all fail the rule. f1 1500 steps: noisy proxy fail. f2mix (DEB_P .35 KD EMA) running.
Resume: wait f2mix (g10d.log STAGE2_DONE); wise_q.sh (p1w3 speed, p1w7); gate f2mix best if any; then report.
- 2026-11-24 16:20 stage 2 done: f1 and f2mix (DEB_P .35 + KD + EMA, 1500 steps) no proxy pass (deban_ho 8.1-8.2). WiSE p1 0.3/0.5/0.7 all fail ho_retasy_wrong (-0.6/-1.0/-0.6). Last check running: qtrain/deban/q2.out (f2mix step1500 WiSE .5, f1 step900 WiSE .5).
Resume: rerun the q2 commands if Q2_DONE missing; then gen_report.py + recipe-study results.
- 2026-11-24 16:45 item #2 phase 3 DONE: no winner (all candidates fail ho_retasy_wrong -0.4..-1.2; best f1s9w5 -0.4 with Deban +0.8, real hadr WERskel 11.0->10.6). G10b kept; nothing exported to z1, no pack v5. Report section phase3 in plans/asr-speed-bench/report.html (+ copy). Resume: optional next = wrong-word-aware training (recipe-study.md).
- Checkpoint #2 phase 3 DONE (Opus reviewed): no winner, G10b stays (sha e3294079 rechecked). Deban aligned 4955/6236 ayat (6.26 h, median 3.03 w/s), hold-out 13 surahs. 8 proxy recipes + 2 full + WiSE .3/.5/.7: all improve hadr (Deban verify +0.2..+1.0, other real hadr WERskel 11.0 -> 10.4-10.9, track 96.6 -> 96.8-97.1) but every one loses ho_retasy_wrong 0.4-1.2 (catching wrong words; 100 clips, ~0.5 per word). Report section + recipe-study.md. Next idea (needs user OK): negative examples / near-miss penalty + bigger retasy_wrong set. Resume: user decision on #2 phase 4; 5.36 phone test when the phone is back.
- 2026-11-24 user: «ابدأ phase 4». Dispatched Opus agent: plans/asr-speed-bench/phase4.md; bigger wrong-caught eval via text-mutation near-misses (DEV/TEST split, validated vs ho_retasy_wrong); B1 threshold recalibration per model, B2 near-miss margin loss fine-tune, B3 KD, B4 real wrong audio if any; WiSE; same hard rule + gates. Resume: phase 4 report -> if winner: pack v5 + app ver 5 + full QA + 5.37; else keep G10b.
- 2026-11-24 item #2 phase 4 DONE (analysis): ho_retasy_wrong loss is on the ACCEPT side (canonical words on mis-recited clips), wrong_word_caught = 92.0 for G10b and all candidates. New near-miss eval qtrain/deban/p4 (6202 items, DEV/TEST): all candidates = G10b (95.4 TEST; f2w5 -0.2). B1-B4 not run (no leniency to fix). No ship under the current rule. Resume: user decision - regate retasy_wrong on wrong_caught + near-miss TEST -> then f1s9w5 ctc_up + asrPace + pack v5.
- Checkpoint #2 phase 4 DONE (plans/asr-speed-bench/phase4.md, report section): verify has no posterior threshold (greedy text -> recite() rSame >= 0.6, app.js:2631-2635). ho_retasy_wrong loss is all on accepting canonical words in mis-recited clips (wrong_word_caught 92.0 for G10b and every candidate). New near-miss eval 6202 items (DEV/TEST): G10b 95.4 TEST, f1s9w5 95.5. B1-B4 not run (nothing to recover; no licensed wrong audio). Side finding: rSame 0.6 accepts one-letter learner swaps (ض/د, ص/س…) in words of 3+ letters -> matcher limit, not model. Pending USER decision: gate retasy_wrong on wrong_word_caught + near-miss TEST instead of verify_acc -> f1s9w5 (f1 s900 WiSE .5) would pass (worst -0.1), then ctc_up + slow check + pack v5. Resume: user decision.
- 2026-11-24 user approved («موافق، كمّل») the revised gate: ho_retasy_wrong judged by wrong_word_caught_% + near-miss TEST. Phase 4 agent resumed for f1s9w5: ctc_up vs G10b, q.asrPace slow >= 97.8, then z1 export + pack v5 (not uploaded) + exact app change. Resume: its report -> if pass: app ver 5 + full QA + 5.37 build; else G10b stays.
- 20:34 phase 4 regate approved: ctc_up f1s9w5 running (qtrain/eval/out/p4_run.sh -> mode_f1s9w5_n, mode_f1s9w5_slowF; G10b baseline = mode_normal/mode_slowF). Resume: rerun bash qtrain/eval/out/p4_run.sh if p4_run.done missing.
- 20:45 phase 4 FINAL: f1s9w5 WINNER under revised gate (ctc_up ALL 97.3=, worst -0.1; asrPace slow 97.8=). z1/G10d_f1s9w5.int8.onnx sha b6856868; pack v5 qtrain/deban/p4/pack_v5 (asrnv5 7ee13e00, asrnvp5 9ffd5a4f, join ok). Resume: coordinator -> app.js:395 ver 5, upload zips to editions, 5.37 build + full QA + phone test.
- Checkpoint #2 WINNER (Opus verified): G10d_f1s9w5.int8.onnx sha b6856868…07ca1 (115,268,336 B); ctc_up ALL 97.3 = G10b, worst -0.1, rwrong caught 94.8 -> 95.1; slow ALL 97.8 = 97.8. pack v5 qtrain/deban/p4/pack_v5/asrnv5.zip (50,132,498, sha 7ee13e00) + asrnvp5.zip (42,741,013, sha 9ffd5a4f): join == model, vocab + libs byte-identical to v4, ver.txt 5. Folded into 5.36 (never left the PC): app.js:395 ver 4 -> 5; phone-test-5.36 +3 model items. v4 users get «تحديث» (opt-in, asrOld). MUST upload asrnv5/asrnvp5 to editions branch BEFORE releasing 5.36 (user word). Full QA rerun -> rebuild 5.36. Resume: QA -> rebuild + verify -> ask user: upload zips + install + push.
- Checkpoint 5.36 REBUILT with model v5 (app.js:395 ver 5): full QA 380/0 x4, data 28/0, matrix 40/0, fs-motion 17/17, recite_sim ok, alert_repro ok (i accepted), split_turn ok. APK 70,118,832 bytes, signer 7d8b31d2, not debuggable, assets/web 2297 byte-identical, ver 5 + new code inside.
- Speed bench G10b -> f1s9w5 (c_g_G10b_ref vs c_g_f1s9w5): real hadr track 96.6 -> 97.0, murattal 97.0 -> 97.2, mujawwad normal mode 97.6 -> 97.2 (WERsk 11.4 -> 11.6; slow mode ALL equal 97.8), synthetic 2-2.5 w/s bin 93.8 -> 95.8, 2x 88.1 -> 89.6, 3x 57.0 -> 57.7. User: 3 w/s is enough, real hadr matters most, synthetic only a bonus.
Resume: user word -> upload asrnv5/asrnvp5 to editions branch -> install 5.36 (call state 0) -> phone-test-5.36 + #25 CDP -> commit/push 5.35+5.36 + builds release.
- 2026-11-24 user «ارفع ونزّل»: pack v5 pushed to editions (commit c73e5df via D:\Quran App\ed-wt, only asrnv5.zip + asrnvp5.zip; old local asrbase deletions left unstaged); downloaded back from raw.githubusercontent.com: asrnv5.zip 50,132,498 sha 7ee13e00, asrnvp5.zip 42,741,013 sha 9ffd5a4f = match. Phone bee81250 not connected (adb devices empty) -> install 5.36 when it is connected (call state 0, no taps). Resume: phone connected -> install 5.36 -> phone-test-5.36 -> #25 CDP -> commit/push 5.35+5.36 on the user word.
- 5.36 installed on bee81250 (user «وصّلته», call state 0, was 5.35, now versionCode 84 / 5.36, no taps). Resume: user runs plans/phone-test-5.36.html (first: model «تحديث» to v5) -> #25 CDP measure with a -cdp build after the test -> restore 5.36 release -> commit/push on the user word.
- Phone test 5.36: 19/21 pass (#28 x6, #27 split + miss + follow/landscape, #25 vertical slow/fast + re-enter, model v5 update, normal reading, hadr, asrPace normal/slow, rest OK). Fails: (7) no settings toggle for errAlert (code reads q.errAlert, no UI) ; (8) vertical view hifz page end scrolls up a little then down (hifzPageGo next() + setTimeout(capKeep,700) app.js ~2480 suspected). qk-dev fix dispatched (toggle like q.spine; one monotonic scroll, precedent capKeep 2955). Resume: review -> full QA -> rebuild 5.37? (5.36 already on the phone) -> phone recheck 7/8.
- User text changes (added to the qk-dev batch): pace option «مجوّد / بطيء» -> «مجوّد», remove hint «للقراءة البطيئة والمد الطويل…»; edition kfold shown name -> «مصحف المدينة» (EN Madinah Mushaf), id/files/keys unchanged.
- Checkpoint 5.37 fixes (qk-dev, Opus reviewed vHifz next app.js:1260-1264): one scroll to capKeep's band + capBusy (trace kfgqpc p100 53466 -> 53772 flat, no direction change; was +495 then capKeep -228); «تنبيه الأخطاء» toggle #errAlertRow (q.errAlert, default on); pace «مجوّد» + hint removed; kfold shown as «مصحف المدينة» (EN Madinah Mushaf), id unchanged. ui.js kfgqpc 383/0. Bumped 5.37 (85, sw quran-v81). plans/phone-test-5.37.html (8 items). Full QA running. Resume: QA -> build 5.37 -> verify -> install on user word -> phone test.
- 5.37 BUILT + installed on bee81250 (user «كمّل ونزّلها», call state 0, was 5.36, now 85 / 5.37, no taps). QA 383/0 x4 etc. QA-checklist 5.37 written. Resume: user runs plans/phone-test-5.37.html -> #25 CDP measure (-cdp build) -> commit/push 5.35-5.37 + builds release on the user word.
- Phone test 5.37: 8/8 pass (user «كله نجح»). Sprint 5 functionally DONE. Resume: user word -> commit 5.35+5.36+5.37 files + push origin HEAD:main -> gh release v5.37 to quran-karim-builds -> Play AAB 5.37 optional; #25 CDP phone numbers optional (user passed vertical scroll by eye).
- Released (user «ارفع على GitHub»): code 01e294d on main (5.35-5.37, 40 files; store/fg-options, ui-results.json, .bak, build-src, launch.json and older untracked tools left out); builds repo release v5.37 (quran-karim-v5.37.apk 70,118,832 bytes). Model pack v5 on editions c73e5df. Play: last AAB 5.33 (no AAB for 5.34-5.37). Resume: Play AAB 5.37 on the user word (PLAY=1 + build-aab-win.py, then rebuild GitHub APK name); next sprint plan.
- 2026-11-25 Play AAB quran-karim-v5.37-play.aab 40,769,159 bytes: com.lawh.quran, versionCode 85, minSdk 24, upload key SHA-256 71:18:F1…, no harmain/adhan/darwish/tanwir, ORT .so packaged, ver 5 + new code inside. GitHub APK rebuilt after PLAY=1: identical entries to the released v5.37 (excl. META-INF), signer 7d8b31d2. Release notes store/release-notes-5.37.txt (Arabic only). Not uploaded to Play (user does it). Resume: user uploads AAB 5.37 to Play closed test -> next sprint.
- 2026-11-25 user uploaded quran-karim-v5.37-play.aab to Play closed test Alpha (release notes store/release-notes-5.37.txt). Sprint 5 CLOSED. Open: auto pace (probe + Java/Python parity), matcher rSame 0.6 accepts one-letter learner swaps (ض/د…), #25 phone CDP numbers (optional), harmain 5:92 split turn (li=1). Resume: plan next sprint with the user.

## ===== NEXT SESSION: START HERE (handoff written 2026-11-25, end of the Sprint 5 session) =====
State of the app
- Latest version: **5.37** (versionCode 85, sw quran-v81). Installed on bee81250 (phone test 8/8, plans/phone-test-5.37.html; 5.36 test 19/21 -> fixed in 5.37).
- Pushed: code 01e294d + progress cea056a and later on main (local branch chore/backlog-cleanup tracks origin/main). Builds repo release v5.37 (quran-karim-v5.37.apk 70,118,832 B, signer 7d8b31d2). Play: AAB 5.37 uploaded by the user to closed test Alpha (com.lawh.quran, upload key 71:18:F1…).
- ASR model **v5** (G10d_f1s9w5 = G10b + Ahmed Deban hadr fine-tune, WiSE 0.5, sha b6856868…) is live: pack asrnv5.zip/asrnvp5.zip on the editions branch (commit c73e5df via worktree D:\Quran App\ed-wt), app ASRM.asrnv.ver 5 (web/app.js:395). v4 (G10b, sha e3294079) kept on editions for rollback (set ver 4 to roll back). v4 users get «تحديث» (opt-in).
- Still uncommitted on purpose: store/fg-options/*, tools/qa/ui-results.json, nv_curr.py.bak_*, build-src/, .claude/launch.json, older untracked tools/page_geometry + tools/qa png/py files (ask before committing).

What Sprint 5 shipped (details: QA-checklist.md 5.36 + 5.37, plans/asr-speed-report.html)
- #28 error alert: buzzPattern CSV must start with the ON duration (AppBridge.java prepends 0); hzErrRun = 5 wrong/skipped in a row across ayat, once per run, reset per test; skipAlert only on finals, never with errAlert; toggle «تنبيه الأخطاء» (q.errAlert).
- #27 hifzPageEnd turns on a right word past the page's last word; vertical view page end = one scroll (vHifz next goes to capKeep's band + capBusy).
- #25 vertical view decode-ahead (vObs IntersectionObserver in showPagesV).
- #2 «سرعة القراءة» q.asrPace normal|slow (label «عادي» / «مجوّد»); NvAsr slow = hold piece through 2 s quiet, cap 30 s; normal path unchanged. kfold shown as «مصحف المدينة».
- QA tools: tools/qa/sprint5/{alert_repro.js, split_turn.js, vturn_scroll.js, perf/} (alert_repro case i FAIL is accepted: pure skip -> error buzz), ui.js group «نسخة 5.36»; ASR: tools/asr/speedbench/*, plans/asr-speed-bench/{plan-compare, recipe-study, runs, phase4}.md. Deban data/scripts only under D:\Quran App\qtrain\deban (licensed for training, never redistribute).

Open / next candidates
- auto pace (q.asrPace auto): needs a concurrent probe in the NvAsr recorder + Java/Python parity + phone test (bench: auto ALL 97.6, touches murattal 1%).
- Matcher limit: rSame >= 0.6 (app.js:2631-2635) accepts one-letter learner swaps (ض/د, ص/س, ح/ه, ق/ك, ة/ه) in words of 3+ letters -> mistakes slip through regardless of the model. Worth its own item (letter-level check on the CTC posteriors).
- ASR gate rule changed with the user's OK: ho_retasy_wrong judged by wrong_word_caught_% + near-miss TEST (qtrain/deban/p4/nm_items.json), not verify_acc.
- #25 phone CDP numbers never taken (user passed it by eye): tools/qa/sprint5/perf/run-cdp.py --serial bee81250 with a DEBUGGABLE=1 APK_SUFFIX=-cdp build.
- harmain 5:92 split turn early/late (li=1, pre-existing). 5.30-5.33 hifz phone items never reported. API 37 AVDs unstable (use Phone_API35). Sprint 3 «Later» list still open (17, 12, 24, 33, 3, 21, 22, 30, 18, 34, #32 hifz programme).
- Phase-3/4 checkpoints tools/asr/gpu/nv_out/G10d_* (~0.5 GB each) and qtrain/gpu-train/phone_G10s etc. can be deleted (ask).

Rules learned this session (follow them)
- Agents drop on SSL/API errors and stream stalls: background jobs keep running; resume the agent with SendMessage (never start a second copy); brief long jobs to poll with short checks and checkpoint progress.md after each stage.
- PowerShell: [IO.File] uses the process cwd, not Set-Location -> use full paths or [IO.Directory]::SetCurrentDirectory. Use Bash for gh --jq.
- Model releases: verify model sha, join test a.bin+b.bin, vocab/libs identical, download back from raw URL before releasing an app that bumps ASRM ver.
Resume: plan the next sprint with the user (start from «Open / next candidates»).

## Sprint 5b (2026-11-25): B matcher letter swaps -> A auto pace -> D harmain 5:92 + C #25 phone CDP, then stop (plans/sprint5b.md)
- Agreed with the user. Target 5.38. E (Sprint 3 «Later») and F (#32) left for later sprints.
- Goal check B: serves >95% recognition directly (a learner's one-letter swap must count as wrong); the model can't fix it because rSame (web/app.js ~2626, Levenshtein on rSkel >= 0.6) accepts it. Alternatives: (1) stricter rSame for short words, cheap but risks false wrongs from model slips; (2) letter check on CTC posteriors, better but needs NvAsr output. Compare on the bench (tools/asr/eval/bench.py recite_dp + parity.js) before choosing.
Resume: item B -> qk-scout (rSame/rAlign callers, Python twin in bench.py, parity.js, near-miss TEST qtrain/deban/p4/nm_items.json, where NvAsr exposes posteriors) -> analogical-reasoning shown to the user -> qk-dev.
- B design (analogical reasoning shown to the user): precedent ctcJudge web/app.js:2759 + NvAsr.ctcM (forced CTC margin) + rSame app.js:2640 / bench.py:26 / parity.js. Plan: rSame says "not same" on a confusion-pair substitution (P4 ض/د ص/س ح/ه ق/ك; P8 + ذ/ز ث/س ظ/ض ط/ت; ة/ه invisible after norm), ctcJudge rescues model slips. Bench-only experiment dispatched to qk-dev (tools/asr/eval/swap/, report plans/sprint5b-B-swap-bench.md); no app edit yet.
Resume: read plans/sprint5b-B-swap-bench.md -> choose variant by near-miss TEST + false reds (no gate worse) -> app edit (rSame + Python twin + parity.js) -> recite_sim.
- 2026-11-25 user (going to sleep): "complete the whole agreed A-D, make the better choice for our goal". Running in parallel: B bench (qk-dev, tools/asr/eval/swap/), A auto pace (qk-dev: NvAsr pace 2 + parity + «تلقائي» option, DEFAULT stays normal until a phone test, per plan-compare.md:32), D harmain 5:92 (qk-dev, split_turn.js). C (phone CDP) last, needs an install on bee81250 (call state 0, no taps); no commit/push/release/Play without the user.
Resume: collect B/A/D reports -> Opus review -> B app edit -> full QA -> 5.38 (86) APK -> C.
- B bench DONE (plans/sprint5b-B-swap-bench.md): new 2011 swap items (nm_items can't measure: all already rejected by base rSame). Caught: base 6.2 / P4 73.4 / P8 98.9 (rLocal, no CTC); with ctc_up rescue P8 86.3. Standard v5 bench: 0 verdict flips on 11,779 right words for P4/P8, wrong_word_caught unchanged. DECISION (Opus): P8 strict, strict-pair reds exempt from ctcJudge rescue; ordinary reds keep ctc_up. qk-dev porting to web/app.js + bench.py twin + parity.js.
- Checkpoint B DONE (app): web/app.js rSim/R_PAIRS/rSame (~2640), rLocal sw marks, ctcJudge skips pair-swap reds (patch tools/asr/eval/swap/apply_app_edit.py, Opus-reviewed + applied). bench.py rsame now strict (loads swap/strict.py, same P8 pairs); parity.js grabs R_PAIRS + rSim. Stock parity on v5 rows: same 3812 diff 0. Real app code: swap items caught 6.2 -> 98.0 (ctc_up) / 98.9 (rLocal); standard v5 bench identical (right 97.0 ctc_up, wrong caught 99.1); near-miss TEST unchanged 99.0; recite_sim errs []. Open: bench.py ctc_up path (if any) does not yet skip the rescue for pair swaps (swap/rlocal_spans_swap.js 'app' variant does).
Resume: wait for A and D reports -> full QA -> 5.38.
- Checkpoint A DONE (qk-dev, Opus reviewed NvAsr diff): pace 2 auto = probe decode at the piece's 0.5 s quiet / 12 s run on the worker (fast -> final from the same decode, slow -> hold as pace 1); isSlow/canJoin pure statics, AutoParity.java vs Python 300/0 + 62/0; speedbench = runs.md, gate rows identical to mode_slowA_w1 (ALL 97.6). «تلقائي» button, DEFAULT stays normal (no phone test). Opus fix: in auto, speech inside the held quiet resets heldAt (else the 30 s cap/stop flush cut the piece at the old end and dropped the rest). pace 0/1 paths checked unchanged by reading. rlocal_spans.js grabs R_PAIRS + rSim (ض/د test -> wrong, sw marked).
- Checkpoint D DONE (qk-dev): 5:92 was a test artifact: only 2 words of 5:92 on harmain p102; hifzPageGo turns 150 ms after the verdict, split_turn.js waited 60 ms for c <= 30% -> logged a late turn. Fix test-only (split_turn.js ~51: 350 ms wait for c <= 4). split_turn harmain+shamarly 48/48, ED=harmain ui.js 384/0. No app change.
- Version bumped 5.38 (86, sw quran-v82, index.html about). Full QA running (qk-qa: run-parallel, data.py, matrix, fs-motion, recite_sim, split_turn, parity, i18n_scan).
Resume: QA report -> build-win.py APK quran-karim-v5.38.apk + signer 7d8b31d2 -> C (DEBUGGABLE -cdp build, phone CDP on bee81250, call state 0, no taps, reinstall normal 5.38 after) -> report.
- Full QA 5.38 DONE: run-parallel 384/0 x4 (5.37 383/0 + 1 new pace check), data.py 28/0, matrix 40/0, fs-motion 17/17, recite_sim errs [], parity diff 0 (3812), split_turn harmain+shamarly 48/48 (rerun alone), i18n «تلقائي» present. QA-checklist.md «## 5.38 release QA».
- APK quran-karim-v5.38.apk 70,118,832 B, versionCode 86, signer 7d8b31d2, not debuggable, R_PAIRS + launchProbe + data-v="auto" checked inside. quran-karim-v5.38-cdp.apk (debuggable, same signer) ready for C. Phone checklist plans/phone-test-5.38.html (9 items).
- C BLOCKED: bee81250 not connected (adb devices empty). Not installed, not committed/pushed/released.
Resume: user: connect phone -> check mCallState=0 -> adb install -r quran-karim-v5.38-cdp.apk -> .venv python -I tools/qa/sprint5/perf/run-cdp.py --serial bee81250 --pkg <installed pkg: com.quran.karim for the GitHub build> -> reinstall quran-karim-v5.38.apk -> phone checklist -> on the user's word: commit + push + builds release v5.38 (+ PLAY=1 AAB). Auto pace default stays «عادي» until the phone test passes.
- 2026-11-25 C (#25 phone CDP, user: "Phone connected", then "Unlocked, go"): mCallState=0, no taps. 5.38-cdp was installed over 5.37 (com.quran.karim). Reading position saved first and restored after (kfold p49, turn h) over CDP. First try stalled: the phone was asleep/locked (keyguard), and the WebView fires no rAF, so `single()` never returned. A run on the unlocked phone passed: kfold, Redmi M2007J3SY Android 12, 392x840 @2.75.
  Single view paint p50/p95: seq 23.9/47.4 ms, jump 61.8/72.2, warm 49.8/71.0.
  Vertical blank p50/p95/max (blank frames): 1 pps 0.5/6.7/6.7 (3/1147), 3 pps 20.7/28.6/29.9 (51/1148), 8 pps 6.1/6.9/8.2 (57/1148). nodes 2753, JS heap 10.1 MB. Decode 794x1139 is 13-34 ms (first page 34).
  Trace: ImageDecodeTask p95 24.6 ms, max long task 14.7 ms.
  Verdict: #25 is closed. Page loads on the phone are well under one frame budget for a sequential turn, and under 75 ms for a jump. Blank stays under 30 ms even at 8 pps. This is the first phone baseline; the emulator showed seq 49.5/72.5, jump 75.3/105.4, vert 3 pps blank p95 253 ms. Results: tools/qa/sprint5/perf/out/cdp/cdp-bee81250.json (+ trace). The normal quran-karim-v5.38.apk is reinstalled (not debuggable, versionName 5.38).
Resume: the user runs plans/phone-test-5.38.html on the installed 5.38. Then, on the user's word: commit + push (sprint files only) + builds release v5.38 (+ PLAY=1 AAB for Play). Auto pace default stays «عادي» until the phone test passes. Open: the bench.py ctc_up path should skip the rescue for pair swaps.
- 2026-11-25 user: phone-test-5.38 all PASS ("كله تمام"). Release is deferred: the user will release after the next batch of changes ("هنعمل release بعد باتش التعديلات الجديدة"). The session stops here. 5.38 stays installed on bee81250, nothing is committed or pushed, and both APKs stay in the repo root (not committed).
Resume (next session): Sprint 6 plan with the user (the next batch; this one was Sprint 5b = continuation of Sprint 5). Build on uncommitted 5.38, bump the version for that batch, then full QA -> phone test -> on the user's word: commit + push + builds release (+ PLAY=1 AAB). Candidates: make «تلقائي» the default pace (5.38 phone test passed), the bench.py ctc_up path skipping the rescue for pair swaps, E (Sprint 3 «Later» list), F (#32 hifz programme).

## Sprint 6 (2026-11-25): UX polish + branding -> 5.39 (87), built on uncommitted 5.38
- Checked: 5.35-5.37 committed (01e294d) + on origin/main. 5.38 uncommitted (user: release together with this batch).
- Goal check: near-complete app (name, Fusha UI, compact bars, splash/tutorial, update check). Splash must not slow cold start (measure before/after).
- Items: A1 #24 name «لوْح», A2 #12 Fusha + glossary (ASK for named buttons), B3 #17 icon bars, C4 #33a splash, C5 #33b coach marks (+video list), D6 #22 update check (ASK if builds repo private), E7 impeccable audit.
Resume: qk-scout lookups (name/strings, bars/first-run/splash, update mechanism) -> analogical reasoning -> A1.
- Scouts done. Name spots: strings.xml:3, index.html:7/19/221, app.js:873/5290/3581/4901/5099/5188, manifest.webmanifest, docs+store privacy. i18n.js keys = Arabic text (tr() i18n.js:429) -> every Arabic change must move its key too. Bars: header.bar index.html:17-25 (.icon-btn 40px), tabbar app.js:4907-4923 (icon+label, 11px). Welcome showWelcome app.js:5264 (q.onboarded). Splash: no Gradle -> platform windowSplashScreen* attrs (values-v31) only. builds repo PRIVATE, editions branch PUBLIC. Precedent bug: asrVerCheck app.js:404-405 offline -> asrHave=1 -> shows «تحديث» falsely (do not copy).
- Running: qk-dev A (fusha_map.json + fusha_apply.py + glossary plans/sprint6-glossary.html), qk-qa cold-start baseline (tools/qa/sprint6/coldstart.py, Phone_API35).
- ASKED user: Fusha for named buttons (فكّرني / اختبرني / اختبار عشوائي / تنبيه الأخطاء) + D6 GitHub-build source (version.json on editions).
Resume: A report -> Opus review -> user answers -> B3 bars.
- Cold-start baseline 5.38 (Phone_API35, am start -W, n=10): TotalTime median 733 ms (min 714, p90 748). tools/qa/sprint6/coldstart.py, out/coldstart-5.38-emu.json. Emulator left running. Note: TotalTime = first frame, not web content ready.
- User decisions: named buttons approved (فكّرني->ذكِّرني, goal toggle->«ذكِّرني إن لم أُتمّ الورد», others stay); ALL colloquial text -> Fusha (sent to qk-dev A). Fix asrVerCheck offline bug (in D). D6: Play build opens Play page (market:// + https fallback) + NEW: auto prompt on open «تحديث الآن / لاحقًا» from public version.json on editions branch (max 1 check/24 h, silent offline, no user data); version.json updated only AFTER Play publishes (add to release checklist). GitHub build = 2c (no button) unless user says otherwise.
- C4 splash dispatched (qk-dev, Java/res only): values-v31 windowSplashScreen*, OnPreDrawListener hold until WebView drawn AND >=1000 ms, cap 3000 ms, log tag QKStart; test apk quran-karim-v5.39-splashtest.apk on emulator only. B3/C5 wait for A (same files app.js/index.html).
Resume: A + C4 reports -> review -> B3 bars -> C5 -> D6 -> E7 -> QA/build.
- Checkpoint C4 code DONE (values-v31/styles.xml, MainActivity holdSplash ~:178, QKStart log). Emu: am start TotalTime 1367 ms median (now = first NON-splash frame, not comparable to 733 = first frame of a blank window); one run contentDrawn=1274 splashOff=1289 -> the WebView draw, not the 1 s floor, limits. Shots plans/sprint6-shots/splash-emu.png (logo centred OK). Emulator wedged after the run (restart needed; may still hold the splash build).
TODO fair metric: screenrecord-based 'content visible' time 5.38 vs 5.39 on a fresh emulator (tools/qa/sprint6/visible.py).
- Checkpoint A DONE: 517 map entries / 554 replacements (tools/i18n/fusha_map.json + fusha_apply.py), glossary plans/sprint6-glossary.html, name «لوْح» in strings.xml/index/app.js/manifest/privacy. ui.js kfgqpc 384/0; i18n untranslated 1514 -> 1514. Kept on purpose: voice-command input regexes (app.js ~3281-3372), comments, «صح», «سمّع». المايك -> الميكروفون. Opus sample review (25) OK.
Resume: B3 bars (qk-dev) -> C5 -> D6 -> E7.
- B3 running (qk-dev, resumed after SSL drop at the CSS step). plans/sprint6-tutorial-videos.md written (9 videos). Wedged emulator killed (adb clean).
Resume: B3 report -> C5 coach marks -> D6 -> E7 -> QA/build.
- Checkpoint B3 DONE: top bar 60->48 px, tabbar 65->53, icons only, all bar buttons >=48x48, barTip() long-press tooltip (app.js ~4895), tab المصحف icon book. matrix 40/0, ui.js 387/0 (+3 checks). Shots plans/sprint6-shots/before-*/after-* (Opus looked: OK).
- C5 dispatched (qk-dev): coach marks q.tourDone, after welcome, «عرض الشرح» in settings.
Resume: C5 report -> D6 -> E7 -> QA/build.
- Checkpoint C5 DONE: tour IIFE app.js ~4937-5035 (q.tourDone, after welcome done(), auto only on #/), «عرض الشرح» index.html ~179, ui.js 392/0, matrix 40/0. Shots tour-*.png (Opus looked OK). Phone to check: Back while tour open, rotation.
- D6 Java: AppBridge.appId() + openStore() (AppBridge.java ~255, Opus). D6 JS dispatched (qk-dev): version.json in ed-wt (not committed), Play-only button + auto prompt, asrVerCheck offline fix.
Resume: D6 report -> E7 impeccable audit -> full QA -> bump 5.39 -> build -> fair cold start (screenrecord) -> report.
- E7 detector (impeccable detect style.css+index.html): 16 findings, NONE on Sprint 6 surfaces (bars/tabbar/.bar-tip/.tour*/settings rows). Left standing as out of scope (user: fix only screens this sprint touched): side-tab style.css:196 (current-item tint+edge), :243 .page-cap (mushaf page caption — no mushaf redesign), :336 .ay-head stripe (text view), index side-tab x6 (same rules, rendered); bounce-easing :371 springback (literal overscroll spring) + :707 rwIn; dark-glow x4 = hifz-mask 1px outline rings on dark page (tracking/hifz visuals — must not change). Re-run detector after D6.
  - CORRECTION: style.css:196 is .set-group (settings section headers = touched screen) -> FIXED: side border removed, tint kept (Opus). Verify in settings screenshot at QA.
  - REVERTED the .set-group fix: stripe dates from 4.6 'Oct 31 checklist fixes' (6c4b7e5) + ui.js:429 asserts it -> possibly the user's ask. Left standing; ASK user in the report.
- Checkpoint D6 DONE (qk-dev): update module app.js ~5018 (version.json via ED_BASE, isPlay only, auto 4 s on quiet home, q.updLast/q.updLater), #updRow index.html, DUPD i18n, asrVerCheck fix (404 = v1, other errors = unknown) + asrTried, ui.js +8 checks (400 total), CLAUDE.md release step. ed-wt/version.json {play:{code:85,name:5.37}} NOT committed.
Resume: detector re-run -> full QA (run-parallel, data.py, matrix, fs-motion, recite_sim) -> bump 5.39/87 -> build -> signer -> fair cold start -> phone checklist -> report.
- Bumped 5.39 (87): manifest, index.html :227/:266, sw quran-v83. Full QA dispatched (qk-qa).
- Full QA 5.39: run-parallel kfgqpc/kfold/harmain 400/0, shamarly 400/1 (G6 vertical hifz mic -> page top: -449 vs 48; also alone) -> qk-dev debugging root cause vs the 5.38 web from the APK. data.py 28/0, matrix 40/0, fs-motion 17/17, recite_sim errs [], split_turn 48/48, i18n missing 1514 (0 new). parity: rows file gone; instead verified R_PAIRS/norm/rSkel/rSim/rSame/rAlign/rLocal/ctcJudge/voiceAyahs byte-identical to the 5.38 APK app.js (ignoring CRLF) -> 5.38 parity diff 0 holds.
- FOUND: 7 files went LF->CRLF in the work tree (CLAUDE.md, MainActivity.java, tools/qa/ui.js, web/app.js, i18n.js, index.html, style.css); index is LF. Convert back to LF after the debug agent finishes.
Resume: G6 fix -> CRLF->LF -> rerun shamarly+kfgqpc ui.js -> build 5.39 -> signer -> fair cold start -> phone checklist -> report.
- G6 shamarly RESOLVED: test artifact (fixed scrollBy 230 + 12 px shorter bar -> 40% line on page 51; 5.38 passed by landing in the 10 px page gap). Test now scrolls relative to page 50 (ui.js ~724); app unchanged (hifzPageTop correct). ui.js supports QK_WEB. shamarly+kfgqpc 400/0.
- CRLF->LF done for the 7 files (diff now 27 files). Final run-parallel + build 5.39 + signer/badging/asset checks dispatched (qk-qa).
Resume: build report -> fair cold start 5.38 vs 5.39 (emulator screenrecord) -> phone checklist plans/phone-test-5.39.html -> final report.
- User (2026-11-25): 'ارفع على github' -> after green QA+build: commit (5.38 + Sprint 6, excluding store/fg-options) + push HEAD:main, builds release v5.39 (private repo) with the APK, editions version.json (play 85/5.37 = live). No phone install, no AAB (not asked). phone checklist plans/phone-test-5.39.html ready.
- Final gate GREEN: run-parallel 400/0 x4, matrix 40/0. APK quran-karim-v5.39.apk built + verified (signer 7d8b31d2, 87/5.39, label «لوْح», content checks). Fair cold-start measurement running (qk-qa, emulator). Next: commit + push + builds release v5.39 + editions version.json.
- PUSHED (user: 'ارفع على github'): main 8aa7292..353354c (5.38+Sprint 6, 81 files; store/fg-options left out), builds release v5.39 (quran-karim-v5.39.apk 70,118,832 B), editions 1506d02 version.json {play:85/5.37} (raw URL verified). No phone install, no AAB.
Resume: fair cold-start report (qk-qa running) -> final report to the user. Open for user: Play AAB 5.39 (PLAY=1) + Play name «لوْح - حفظ وتسميع القرآن»; after Play publishes 5.39 set version.json play.code 87; .set-group side stripe decision; phone checklist plans/phone-test-5.39.html.
- Cold start 5.39 (Phone_API35, logcat QKStart, n=10 after warm-up): contentDrawn median 910 ms, splashOff median 1012 ms (splash adds ~100 ms over 'content ready' here; the 1 s floor rules), am start TotalTime median 1249 ms (= UI visible). 5.38 baseline TotalTime 733 ms was the first frame of a BLANK cream window, the web UI came ~content time later; same code path -> real user-visible cost ~ +100 ms on the emulator. On a fast phone (content < 1 s) the floor can add up to ~1 s - contentDrawn (what the user asked: logo ~1 s). screenrecord wedges the AVD (3x) -> use logcat timing.

## 5.40 — splash fix after the phone pass (2026-11-25)
- Phone pass 5.39 on bee81250 (MIUI 14 / Android 12, dark mode): 6 pass, EN partial (pre-existing gaps since v3.9: Hijri date shows «June 15, 1448 BC», fasting/prayer card, prayer alerts), items 9/10 need the user. Results: plans/phone-results-5.39.md.
- FAIL: splash on MIUI = blank dark grey ~1 s, no logo. Diagnosis: onSplashScreenExit never called -> MIUI shows no system splash, only its own starting window; the 5.39 OnPreDraw hold kept that window up. forceDarkAllowed=false tried: no change (reverted).
- Fix (MainActivity.showSplash): our own splash view on the decor view (cream #f7f2e7, adaptive-icon layers 240dp seen through a 160dp circle = system look), drawn at once; fades (200 ms) when contentDrawn && >=1 s (cap 3 s). Stock Android: system splash hands over to the identical picture (emulator API 35 shot 24-emu-2-a). Phone: logo on cream (23-fix-1-a); contentDrawn 629-776 ms, splashOff ~1.02-1.04 s, am start TotalTime ~330 ms (first frame now the splash).
- Bumped 5.40 (88): manifest, index.html :227/:266, sw quran-v84. APK quran-karim-v5.40.apk signer 7d8b31d2 verified.
- Phone A/B timing stopped: mCallState=2 (call in progress) — nothing touched. Emulator wedged again on install loop (killed).
- 5.40 DONE: QA 400/0 x4; phone A/B (n=10 each): first frame 1110->320 ms, splashOff ~1.0 s both, contentDrawn 576->648 ms. Pushed main 12cc279, builds release v5.40 (70,118,832 B). Installed on bee81250.
Resume: open for user: phone items 9 (offline model) + 10 (recitation); EN pre-existing gaps (Hijri «BC» date); Play AAB; .set-group stripe.

## 5.41 — English Hijri date (2026-11-25)
- Bug (since v3.9): EN Hijri date on the phone «Wednesday June 15, 1448 BC» — Android WebView ICU has no English month names for islamic-umalqura and fell back to Gregorian names + era. Fix: hijri() builds EN text from the numeric parts (already right: fastOf works) + HIJRI_EN list -> «15 Jumada al-Akhirah 1448 AH». Arabic unchanged.
- ui.js G13 new check (EN Hijri month + AH, no BC): PASS. Phone 5.41: home «Wednesday 15 Jumada al-Akhirah 1448 AH», prayer screen same; language set back to Arabic, reading position kept.
- Bumped 5.41 (89), sw quran-v85; APK signer 7d8b31d2.
- QA 5.41: run-parallel 401/0 x4 (after test-only fixes: the new EN Hijri check runs in its own context with a seeded location; the backup check now waits for the restore and checks it survives the reopen, instead of a fixed 2.5 s that flaked under 4 parallel editions — restore takes ~250 ms, data kept after reload, 12/12). One harmain S3 «سمّع التكملة» fail in one run, passed in the next (flake).
- PUSHED: main + builds release v5.41.
Resume: open for user: phone items 9+10; other EN gaps (fasting reason, prayer card names, alerts); Play AAB; .set-group stripe.

## 5.42 — English gaps from the phone pass (2026-11-25)
- i18n.js: generated keys (prayer name + time, bell/muezzin labels, adhan voice names full/short/with «تذكير قبله # د», all fasting-reason combinations, countdown «#:# ص · بعد # س # د», «#/#/# · # آية نسيتها», «استمع»). Two catches: «الفجر»/«العصر»/«محمد» are surah names, so tr() turns them into @ first — the home tile now puts name and time in separate <bdi>, and voices starting «محمد» get an @ key.
- app.js: prayer-screen place/date line uses en-GB + Latin coordinates in English.
- Headless EN scan (home, prayer, hifzlog): no Arabic UI text left; new ui.js check. Bumped 5.42 (90), sw quran-v86; APK signer 7d8b31d2.
- Phone disconnected (adb: device not found) — phone check pending.
- QA 5.42: run-parallel 402/0 x4. Committed locally (not pushed: push needs the user's OK).
Resume: phone EN check when connected -> on the user's OK push main + builds release v5.42.
- 2026-11-26: user «خلص كل الترجمات» -> notifications + widgets too: syncAlarms translates title/text with T() in English (adhan line with the city built in English), syncWidget translates cont/place/ref/prayers and sends lang; Java (Alarms.en/tr from the widget JSON) translates channel names, widget titles + empty states, share/backup chooser titles. i18n: keys for every notification template (+ all fasting combos). Headless: 42 kinds of EN notifications, 0 Arabic; Arabic payload unchanged. New ui.js check. Rebuilt 5.42 (dex + web verified in APK).
- PHONE INCIDENT 05:12: a test tap landed under a ringing Clock alarm heads-up (no STOP/SNOOZE pressed; alarm kept ringing). Stopped all phone work. phone.py safe() now also stops on alarm/ringtone audio focus, phone hour < 7, airplane mode. Memory phone-test-safety updated. Phone app language still Arabic, nothing to restore.
- QA 5.42 (with notifications): run-parallel 403/0 on kfgqpc, kfold, shamarly; harmain 403/1 = 5.29 #11 vertical random review (passed alone 2/2: parallel-load flake, unrelated).
- Phone 5.42 (user awake, asked; QK_AWAKE=1 skips only the night/airplane guard): English home, prayer, review: no Arabic UI text; prayer widget on the home screen «Next prayer · Dhuhr · 11:43 AM», back to «الصلاة القادمة» in Arabic. Notification channel names update at the next notification. Language back to Arabic, reading position kept (Al-Baqarah p41).
- PUSHED: main + builds release v5.42 (user: «بعد تجربة الهاتف»).
- Play AAB 5.42: quran-karim-v5.42-play.aab 40,783,277 B, com.lawh.quran 90/5.42, minSdk 24, signed with the upload key (71:18:F1…), no harmain/adhan audio, 5.42 code inside. Arabic notes store/release-notes-5.42.txt (390 chars, covers 5.38-5.42; Play upload since 5.37). Play test APK kept as quran-karim-v5.42-playtest.apk; GitHub APK restored (sha matches release).
- 2026-11-26 user: Play published 5.42 -> editions version.json {play:90/5.42} pushed (aa712b9), raw URL verified. User wants this step automatic from now on.
- 2026-11-26 user: In-App Updates, for the NEXT release (no version bump now). Done in code: android/src-play/PlayUpdate.java (check -> window.onPlayUpdate, start = IMMEDIATE flow, store page as fallback), AppBridge.playUpdates/playUpdateCheck/playUpdateStart by reflection (GitHub build has no Play Core: verified, dex has none), build-win.py PLAY=1 fetches app-update 2.1.0 + core-common 2.0.3 + play-services-tasks 18.0.2 + basement 18.1.0 from Google Maven (SHA-256 pinned, cached tools/bin/play-libs, git-ignored) and adds PlayCoreDialogWrapperActivity to the manifest; app.js update module uses Play when AppBridge.playUpdates(), version.json otherwise. ui.js: 2 new D6 checks (Play newer -> prompt, no version.json fetch, «تحديث الآن» -> playUpdateStart; current / failure). D6 group 10/0.
- Emulator smoke: Play build launches, no crash (Play Core not exercised there: no Play Store on the AVD). Real check = 5.43 from Alpha, then 5.44 offered by Play.
- One last manual version.json update when 5.43 is live (code 91) for 5.42 installs; CLAUDE.md release checklist says so.
- QA: run-parallel 405/0 on kfgqpc, kfold, harmain; shamarly 405/1 = 5.35 FLIP stretch (passed alone 2/2: parallel-load flake). Committed locally, NOT pushed (next release). PC shut down after (user asleep).
Resume: next release 5.43 = bump + build both + QA + AAB (PLAY=1 fetches Play Core) -> user uploads -> when live: version.json 91/5.43 one last time -> later check on the phone that Play offers 5.44 inside the app. Open: phone items 9+10; .set-group stripe.
- 2026-11-26 user (phone screenshot): EN status-bar switch said «Ikhfa'» instead of «Hide». Cause: i18n.js had «إخفاء» twice (button «Hide», tajweed rule «Ikhfa'»; the later won). Fix: tajweed names now come from window.TJ_EN via tjName() (app.js), «إخفاء» = «Hide». Also fixes the hifz «إخفاء» button. Scan of all duplicate i18n keys: only this one had two meanings (others are synonyms). ui.js check added (group عام 5/0). Committed locally, ships with 5.43.

## 2026-11-26 — Sprint 7 (5.43): new features
- Pre-check: 5.38/5.39 committed (353354c), pushed, builds release v5.39; 5.40-5.42 released after. Local unpushed df686a2/eb18581/3627ba8 ship with 5.43 -> sprint version = 5.43.
- Goal check: A1/B/C/D = near-complete app; A2 (bench ctc_up swap rescue) + E (recite-upload training data) = >95% ASR goal; E highest ASR value.
- Started in parallel: scouts (upload/speed/backup; prayer/gestures/location), qk-dev bench.py (bg), radio research -> plans/radio-report-5.43.html (bg, Phase 1 only, stop for user approval).
Resume: wait scouts -> analogical plan for A1,B,C,E -> qk-dev per group; D Phase 2 only after user approves the radio list.
- A1 done (local): app.js:240 default asrPace "auto"; saved manual choice kept (key only written on click, app.js:768). ui.js G536 check updated + new "saved normal stays" check.
- Decisions: B = own route #/prayerlog, linked from «مواقيت الصلاة» + More tile (home stays reading-first, prayer tile already leads there). C = vertical drag on 24px left-edge strip, centered, <=200dp, setSystemGestureExclusionRects; flip ignores |dx|<1.3|dy| (app.js:1670).
- E BLOCKED on user: consent text app.js:719 says «أثناء التسميع» only -> recite upload = consent change. Backend OK (relay accepts any src). Options asked: 1 broaden + re-ask once / 2 separate q.donateRecite / 3 defer.
- B + C running (qk-dev bg, parallel, small edits). Bench + radio research still running.
Resume: user's E choice; collect B/C/bench/radio reports -> review -> full QA.
- B done (qk-dev): #/prayerlog, G30 6/6 (ONLY filter); gaps sent back (today lock test, EN, glossary).
- C done (qk-dev): AppBridge.setBrightness/brightStrip (AppBridge.java:76-104, no WRITE_SETTINGS), strip+pill app.js ~1705-1785, «سحب الإضاءة #18» 6/6. Still to verify with toggle ON: vertical scroll, pinch #19, mic.
- A2: fix is in tools/asr/eval/p1b_port_eval.py:69-71 (4e2f9a6), ctc_up now keeps pair-swap reds like app.js ctcJudge:2794. Standard v5 bench identical (expected); swap-set re-run requested.
- B gaps closed: G30 8/8 kfgqpc (today lock with Cairo + frozen 13:00, EN incl. aria-labels via window.T, glossary has no conflicting term). C extra checks (scroll/pinch/mic/fs with toggle ON) running.
- D Phase 1: plans/radio-report-5.43.html (12 countries, 14 stations, 13 live; official-source+live = Tunisia Zaitouna, Pakistan PBC, Qatar x2; I re-tested those 4 -> 200 audio/HLS). STOP: waiting user approval of list.
- C verify done: #18 group 9/0 kfgqpc with toggle ON (vertical scroll outside strip, pinch534 in fs, mic start/stop + #rdMic not covered, strip clear of bars). Real-device back-gesture exclusion -> phone checklist.
- A2 proven: swap set (2011 pair-swap items, v5, ctc_up) kept red 86.3% -> 98.0% (= app ctcJudge, matches plans/sprint5b-B-swap-bench.md), 0/11779 right-word flips, nm/random negatives unchanged. Temp swap_eval copy in scratchpad/sw (not committed).
- Interim QA: data.py 28/0. run-parallel: all 4 editions crashed at G30 start (ui.js setViewportSize on closed p: the EN checks before it swap p via fresh() and close it; hidden by ONLY runs). Fix: G30 opens own context c30 (precedent 5.41 block). Re-running full ui.js kfgqpc.
- QA fixes: G30 also goes to W after fresh (about:blank denies localStorage); G14 More tile count 16->17 (+prayerlog tile, intended). Full ui.js kfgqpc before these: 424 total, 7 fail = exactly these two causes; now G30 8/0, G14 9/0. Full 4-edition run at release time.
- 2026-11-26 user approved radio list: the 4 (TN Zaitouna, PK PBC, QA x2). D Phase 2 started (qk-dev bg): RadioService FGS mediaPlayback + MediaSession notif + audio focus, Alarms.fire pauseFor(adhan), mic pauses radio, #/radio with country from qiblaLoc bbox + manual. Note for user: 2 normal FGS permissions; Play Console FGS declaration at 5.43 upload.
- D Phase 2 done (qk-dev): RadioService.java (new), manifest FGS perms + WAKE_LOCK, Alarms.notify pauseFor(adhanMs+5s), mic pause in NvAsr x2 + ReciteBridge, AppBridge radio*, #/radio + D34 i18n; ui.js «إذاعة القرآن #34» 11/0, G14 18 tiles 9/0. Opus review of RadioService lifecycle OK (no bg FGS start from alarm/mic). Full QA running.
- 2026-11-26 user: E = Option 1 (broaden consent + re-ask old consenters once), stress clips must suit training. E started (qk-dev bg): src recite, auto only, all-right piece >=3 words, no skip/re-anchor, hyp len ±35%, no player/radio/beep; q.donateV=2 consent version, in BK_SKIP. User also wants options for the 5 side-tab findings (.set-group, .page-cap, .book-text .fn).
- E done (qk-dev, Opus reviewed web/app.js rdPcHit/rdDonate/reciteDonate ~3224-3270, donateSet/donateV2Ask ~440-450): src recite, kind auto; guards exact-successor, skel-equal words, one surah, settle 2 after anchor, >=3 words, hyp ±35%, no player/radio/alert. Consent text broadened (settings, consentDlg, wizard, donateHint index.html:223), old consenters asked once (donateV 1 saved first = no on dismiss). ui.js «رفع التسجيلات من القراءة #3» 16/0, «نسخة 5.11» 47/0, CR1 3/0. Open: tools/qa/donate.js stalls at #htMic (askYes unanswered) - check vs baseline. Side-tab preview sent (plans/sidetab-preview-*.png), waiting user OK.
- 2026-11-27 user: side-tabs 1أ 2أ 3أ applied (style.css .set-group tint only, .page-cap 1px gold 45% frame, .book-text .fn no line, indent 12px); G17 check now expects no stripe: group 9/0. ui.js now tags each JS error with its check (curCheck) to find the 4-edition «no JS errors» fail (localStorage SecurityError).
- Full QA 4 editions: kfgqpc/kfold/shamarly 451/0, harmain 451/1 (5.29 #11 vertical mic, passes alone 2/2 = parallel-load flake). JS-error fail fixed (radio init script read localStorage on about:blank). Bump 5.43 (91), sw quran-v87; EOL unchanged. Build quran-karim-v5.43.apk 70,151,600 B, signer 7d8b31d2, new code in assets/web/app.js, RadioService in dex + manifest. Emulator smoke (radio) running. Phone checklist plans/phone-test-5.43.html (28 items).
Resume: emulator smoke -> local commits -> ask user before phone install + push (+ Play AAB?).
- Committed local d8ca60a (5.43) + 57f834f (QA-checklist), not pushed. Emulator smoke PASS (radio playing+fg+notif, after HOME, no FATAL). harmain 5.29 #11 flake also seen in 5.42.
Resume: ask user -> phone install (mCallState=0, no taps) + push main + builds release v5.43 (+ Play AAB PLAY=1, FGS declaration in Console).
