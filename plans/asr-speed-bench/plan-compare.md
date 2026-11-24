# ASR item #2 — مقارنة الخطط (سرعة القراءة: حدر / عادي / مجوّد)

## الخلاصة بالعربي
- القاعدة: النموذج المشحون G10b (pack v4) لا يسوء أبدًا. كل مرشّح ملف أو patch جديد، ولا شيء يُشحن من هنا.
- الترتيب المختار: الأرخص والأقل خطرًا أولًا:
  1. **A1 (وضع بطيء/مجوّد)**: تعديل الـ VAD فقط — قطعة بطيئة (أقل من 0.8 كلمة/ث) لا تُقفل عند 0.5 ث سكون، بل تُضمّ للقطعة التالية لو جاءت خلال 2 ث، حتى 30 ث. صفر خطر على النموذج؛ التكلفة: انتظار أطول للنتيجة عند القارئ البطيء فقط.
  2. **A2 (وضع سريع/حدر)**: لو القطعة أسرع من 7.5 حرف/ث، تُبطّأ بـ time-stretch يحفظ طبقة الصوت (WSOLA = atempo) وتُفكّ ثانية. صفر خطر على النموذج؛ التكلفة: فكّ إضافي (~1.3-2x زمن القطعة) على القطع السريعة فقط.
  3. **الأوضاع (اقتراح المستخدم)**: «عادي» = خط G10b الحالي حرفيًا، «سريع» = A2، «بطيء» = A1، و«تلقائي» = يقيس السرعة من فكّ القطعة نفسها ويختار. يُقاس كل وضع على فئته وعلى الفئات الأخرى (تكلفة اختيار الوضع الخطأ) + confusion matrix للتلقائي.
  4. **B (fine-tune G10s)**: من G10b، نفس خلطة التدريب الأصلية (replay يمنع النسيان) + tempo perturbation 1.3-2.2x و0.6-0.8x على 30% من المقاطع، LR منخفض 1e-5، 1200 خطوة، fp32، BN في eval. يُشحن فقط لو كسب كل البوابات كبديل واحد (ملف واحد فقط على الهاتف).
- النتائج والجدول والتوصية في `runs.md` و`report.html`.

## Options (English detail)

| Option | Expected gain | Risk to current accuracy | Phone cost | Effort | Gate |
|---|---|---|---|---|---|
| A1 slow-merge VAD (mode «بطيء») | mujawwad WERskel 14.7 → ~11 (VAD/piece-boundary loss: no-VAD WER is 9.3) | none on the model; only pieces whose own decode is < 0.8 w/s change | slow reciters wait up to +1.5 s more before a final; pieces up to 30 s (≈1.2 s decode on phone int8, rare) | low (Java: hold piece, re-decode joined audio) | speed bench + full bench.py gate (ctc_up) |
| A1 alt: longer quiet_end for all | slow WER -1.8 | retasy / retasy_wrong drop (sweep 2026-11-18) | +0.4 s wait for everyone | trivial | rejected earlier |
| A1 alt: capcut at the quietest block | none (12.4 vs 11.4 slow) | — | — | — | rejected (results.json vad_experiments) |
| A2 tempo normalisation (mode «سريع») | fixes the 80 ms frame-rate limit on fast pieces; training cannot remove it | only pieces > 7.5 letters/s re-decoded (murattal p95 8.5, so a few normal pieces) | +1 decode of a 1.25-2x longer piece on fast pieces (~+600-900 ms on the phone) | medium (WSOLA in Java ~80 lines) | same |
| C = A1 + A2 auto | both | sum of the above; auto detection errors | as above | low once A1/A2 exist | same + confusion matrix |
| B fine-tune G10s | 2x tempo tracking 88 → 95+ hoped; slow too | catastrophic forgetting / noise regression (G10c failed the noise gate) | none (same size/speed) | high (GPU hours + int8 export + full gate) | in-loop proxy gate (clean +0.2, noisy +0.2, fast18 CER better) then int8 phone gate, ctc_up |
| C2 = A + B | best possible | B's risk | — | — | — |

Order run: A1 → A2 → modes/auto → B (GPU in parallel, it does not block A).

Not chosen: a second model per mode (115 MB each, rejected by the user); everyayah has no hadr reciter (8 candidates probed: 0.79-1.08 words/s, all murattal) so real fast data stays the 82 held-out hadr clips.

## النتيجة (2026-11-24)
- **الفائز: وضع «بطيء» تلقائي (A1, slow_wps 1.0, انتظار 2 ث, حتى 30 ث)**: كل بوابات G10b ≥ (ALL 97.3 → 97.6، الضوضاء 98.6/97.3/94.6)، المجوّد 11.4 → 8.8 و14.7 → 11.2، المرتل بدون تغيير (1% فقط من المقاطع يلمسها).
- **«سريع» (A2) خسر**: يحسّن الحدر الصناعي (2x: 88.1 → 94.9) لكنه يضرّ الحدر الحقيقي (96.6 → 92.2) والبوابة (96.9). لا يُشحن؛ الإعداد `fast` يرجع لـ `normal`.
- **B (G10s) خسر**: retasy_wrong −0.6 ولا مكسب سرعة؛ LR أعلى كسر بوابة الضوضاء. نُبقي G10b.
- التوصية: «تلقائي + اختيار يدوي» — الافتراضي `normal` حتى تجربة الهاتف، ثم `auto`؛ «بطيء» يدوي متاح (ALL 97.8 لكن انتظار +1.5 ث للجميع). التفاصيل runs.md.
