# Prompt for the next session (paste as the first message, then add your updates under it)

كمّل شغل «لوح / Quran Karim» في `D:\Quran App\quran-karim`. الجلسة دي لـ **حزمة تعديلات جديدة** (تفاصيلها تحت)، فوق نسخة 5.24 اللي لسه متعملهاش commit.

## اقرأ الأول
- `progress.md`: آخر سطور الـ `Resume:`، وخصوصًا قسم «Sprint 1 (2026-11-19)» وما بعده.
- `QA-checklist.md`: قسم «5.24 release QA».
- `plans/phone-test-5.24.md`: الـ checklist بتاع الموبايل.

## الحالة (2026-11-19 آخر اليوم)
- **5.24 (versionCode 72)**: مبنية ومتسطّبة على `bee81250`، والـ signer `7d8b31d2`.
  - **مفيش commit ولا push ولا release.** شغل 5.23 كمان لسه من غير commit.
  - الـ release (commit + push + gh release + Play AAB) بيستنى كلمة المستخدم، **بعد** الحزمة الجديدة.
- **QA:** data.py 28/0، و ui.js 293/0 على kfgqpc/kfold/shamarly/harmain، و matrix 40/0، و fs-motion 9/9.
- **Sprint 1 اتعمل:**
  - #36: الـ ✓ في نفس الصفحة.
  - #37: خريطة الحفظ (لون واحد لكل سورة، المُراجَعة بتظهر، الصفحات المشتركة بتتحسب).
  - #5: الرجوع للرئيسية.
  - #16: زرار علامة بضغطة.
  - #7/#9/#8: الترحيب (progress bar، و retry، و auto-advance).
  - #4: التسميع العشوائي بحد نص صفحة.
  - #23 مش bug: الـ Play build بيشيل الأذان والتنوير عن قصد (licence).
- **بعد كده اتصلح:** × في البحث، والرئيسية بتبدأ من فوق، والعناوين كاملة، وتبويب التفسير، وأول ضغطة على العلامة، والـ scroll بعد بحث الفهرس.

## قواعد مهمة
- **الموبايل الحقيقي (`bee81250`):** قبل كل tap لازم `mCallState=0`، والـ focus يكون `com.quran.karim`. لو مش كده يقف فورًا. مكان «متابعة القراءة» يرجع زي ما كان. ممنوع «خلصت» أو أي حاجة بتغيّر بيانات الحفظ. الـ UI tests الأول على الـ emulator `Phone_API35`. (memory: phone-test-safety)
- **`ui.js`:** يتشغل لوحده sequential، عشان التشغيل بالتوازي بيعمل Target crashed.

## التعديلات الجديدة
(اكتب الحزمة هنا)
