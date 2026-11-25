// Builds plans/sprint6-glossary.html from fusha_map.json (old text -> new text, with the screen/feature and file:line).
// Run after fusha_gen.js, on the pre-change sources passed as BAK=<dir with web/app.js, web/index.html ...> (for the line context):
//   BAK=... node tools/i18n/fusha_glossary.js
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const BAK = process.env.BAK || ROOT;
const map = require('./fusha_map.json');
const h = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const show = s => h(s.replace(/<[^>]*>/g, '‹›').replace(/^(["'`])|(["'`])$/g, '').replace(/\\n/g, ' ⏎ ').replace(/‹›+/g, ' … ').trim());
const src = {};
const lines = f => src[f] || (src[f] = fs.readFileSync(path.join(BAK, f), 'utf8').split('\n'));
function feature(e) {
  const ln = +(e.where.split(':')[1] || '0').split(',')[0];
  if (e.kind === 'i18n-key') return 'English mode (مفتاح الترجمة)';
  if (e.file === 'web/app.js') {
    const L = lines(e.file);
    for (let i = ln - 1; i >= 0; i--) {
      let m = L[i].match(/^\s*\/\/ -{4,}\s*(.+?)\s*-{0,}\s*$/); if (m) return m[1];
      m = L[i].match(/^\s*function (\w+)/); if (m) return 'دالة ' + m[1];
    }
    return 'app.js';
  }
  if (e.file === 'web/index.html') {
    const L = lines(e.file);
    for (let i = ln - 1; i >= 0; i--) { const m = L[i].match(/<h[23][^>]*>([^<]+)</); if (m) return 'الإعدادات › ' + m[1]; }
    return 'الإعدادات';
  }
  if (/privacy/.test(e.file)) return 'سياسة الخصوصية';
  if (/strings.xml/.test(e.file)) return 'اسم التطبيق (أندرويد)';
  if (/manifest/.test(e.file)) return 'manifest (اسم التطبيق)';
  return e.file;
}
const rows = map.map(e => ({ f: feature(e), where: e.where, o: show(e.old), n: show(e.new), kind: e.kind }));
const order = { 'web/app.js': 0, 'web/index.html': 1, 'web/i18n.js': 2 };
rows.sort((a, b) => (order[a.where.split(':')[0]] ?? 3) - (order[b.where.split(':')[0]] ?? 3));
const by = {}; map.forEach(e => (by[e.file] = (by[e.file] || 0) + 1));
const cnt = Object.entries(by).map(([f, n]) => h(f) + ': ' + n).join(' · ');
const html = `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>قاموس الفصحى والاسم الجديد — Sprint 6</title>
<style>
body{font-family:"Segoe UI",Tahoma,"Noto Naskh Arabic",Arial,sans-serif;font-size:16px;line-height:1.7;margin:0;color:#1d2b24;background:#fbf9f3}
header{position:sticky;top:0;background:#14513a;color:#fff;padding:10px 18px;z-index:5;box-shadow:0 2px 6px #0003}
header h1{margin:0;font-size:20px}header p{margin:2px 0 0;font-size:14px;opacity:.9}
main{padding:14px 18px 40px;max-width:1300px;margin:auto}
table{border-collapse:collapse;width:100%;background:#fff}
th{position:sticky;top:64px;background:#e7efe9;text-align:right;padding:8px;border:1px solid #c9d6cd;z-index:4}
td{padding:7px 8px;border:1px solid #dbe3dd;vertical-align:top}
td.w{font-size:13px;color:#4a5b52;white-space:nowrap}td.o{color:#8a2c12}td.n{color:#0f5a36;font-weight:600}
section.p{background:#fff7e0;border:1px solid #e3cf8c;border-radius:8px;padding:6px 16px;margin:14px 0}
code{direction:ltr;unicode-bidi:embed;font-size:13px}
</style></head><body>
<header><h1>قاموس الفصحى والاسم الجديد «لوْح»</h1>
<p>عدد النصوص المغيّرة: ${map.length} (${cnt}). النص القديم بالعامية ← الجديد بالفصحى؛ الاسم «لوح» ← «لوْح».</p></header>
<main>
<section class="p"><h2>حالة العناوين التي كانت بانتظار قرارك</h2><ul>
<li><b>تمت الموافقة:</b> «فكّرني» ← «ذكِّرني» (زر الكشف في الحفظ، والترجمة الإنجليزية Remind me كما هي).</li>
<li><b>تمت الموافقة:</b> «فكّرني لو مخلصتش» ← «ذكِّرني إن لم أُتمّ الورد».</li>
<li><b>تبقى كما هي بقرارك:</b> «اختبرني»، «اختبار عشوائي»، «تنبيه الأخطاء» (غُيّرت الكلمات العامية حولها فقط).</li></ul></section>
<table><thead><tr><th>المكان</th><th>النص القديم</th><th>النص الجديد</th></tr></thead><tbody>
${rows.map(r => `<tr><td class="w">${h(r.f)}<br><code>${h(r.where)}</code></td><td class="o">${r.o}</td><td class="n">${r.n}</td></tr>`).join('\n')}
</tbody></table></main></body></html>`;
fs.writeFileSync(path.join(ROOT, 'plans', 'sprint6-glossary.html'), html);
console.log('glossary rows', rows.length);
