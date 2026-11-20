كمّل خطة Quran Karim من سطر الـ Resume.

اقرا الأول:
1. آخر 15 سطر من `D:\Quran App\quran-karim\progress.md` (فيهم سطر الـ Resume).
2. `C:\Users\Compumarts\.claude\plans\review-stateful-wigderson.md`، وده الترتيب المعتمد والتصحيحات.
3. `C:\Users\Compumarts\.claude\plans\use-fable-to-plan-iterative-ritchie.md`، وارجعله بس لتفاصيل الخطوة اللي هتشتغل عليها.

الحالة:
- 5.22 (versionCode 70) شغالة. ودي أرقام الـ bench بتاعها: ALL 97.3، و noisy SNR 20/10/5 = 98.3/96.8/93.8، و wrong-caught 99.1، و wait بعد آخر كلمة 1.06 s.
- Play: الـ closed test «Alpha» شغال، و 5.22 اترفعت عليه والـ testers بيعملوا opt-in. الـ AAB متوقّع بـ `keys/upload.jks`، والـ APK بـ `7d8b31d2`.

الترتيب:
خطوة 1 (matcher placement fix)، بعدها خطوة 2 (mic off في نص الآية، والـ precedent هو `voicePending()` في `web/app.js`)، بعدها gate ctc_up واحد ليهم هما الاتنين، بعدها خطوة 4 (leftovers + الـ VAD sweep مع الـ gate بتاعه)، بعدها خطوة 3 (W6)، وبعدها release 5.23. الـ release ده فيه full QA وقياس first-word latency على `bee81250`، ولازم يترفع على Alpha قبل ما الـ 14 يوم يخلصوا.

طريقة الشغل:
- Opus يخطط ويراجع بس. qk-dev (Sonnet) ينفّذ، و qk-scout و qk-qa (Haiku) للـ lookups والـ checks.
- الـ gate لكل تغيير في الـ ASR: ALL لازم ≥ 97.3، و wrong-caught ما يقلّش، و wait ما يزيدش.
- أي upload أو release أو رسالة تستنى كلمتي.
- اعمل get_usage بين الـ checkpoints، واكتب سطر Resume في progress.md بعد كل خطوة.

ابدأ بخطوة 1.
