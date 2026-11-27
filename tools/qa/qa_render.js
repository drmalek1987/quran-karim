#!/usr/bin/env node
// Renders tools/qa/qa-items.json + tools/qa/features.json into
//   QA-checklist.md           (how to use, characteristics x features table, items by characteristic)
//   plans/qa-checklist.html   (interactive RTL page: filters, search, pass/fail/note in localStorage, copy results)
// Usage: node tools/qa/qa_render.js        (no dependencies; edit the JSON files, never the generated outputs)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^﻿/, ''));
const FEATURES = read('tools/qa/features.json').features, DOC = read('tools/qa/qa-items.json');
const ITEMS = DOC.items, CH = DOC.characteristics, fById = Object.fromEntries(FEATURES.map(f => [f.id, f]));
let version = '?', code = '?';
try { const m = fs.readFileSync(path.join(ROOT, 'android/AndroidManifest.xml'), 'utf8'); version = (/versionName="([^"]+)"/.exec(m) || [])[1] || '?'; code = (/versionCode="([^"]+)"/.exec(m) || [])[1] || '?'; } catch (e) {}
const order = Object.keys(CH), rank = { P0: 0, P1: 1, P2: 2 };
const sorted = ITEMS.slice().sort((a, b) => order.indexOf(a.char) - order.indexOf(b.char) || a.feature.localeCompare(b.feature) || a.id.localeCompare(b.id));
const HOW = { auto: 'آلي', manual: 'يدوي', both: 'آلي + يدوي' }, DEV = { any: 'أي جهاز', phone: 'هاتف حقيقي', emulator: 'محاكي' };
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s.replace(/\r\n/g, '\n')); };

// ---------- Markdown ----------
const md = [];
md.push('# قائمة فحص الجودة: لوْح ' + version, '');
md.push('> ملف مولَّد من `tools/qa/qa-items.json` و`tools/qa/features.json` بالأمر `node tools/qa/qa_render.js`. لا تعدّله يدويًا.', '');
md.push('## طريقة الاستخدام', '');
md.push('- **قبل التعديل:** `node tools/qa/impact.js` يعرض الميزات المتأثرة ومجموعات `ui.js` وبنود القائمة اليدوية.');
md.push('- **بعد التعديل:** `node tools/qa/impact.js --run` يشغّل مجموعات `ui.js` المتأثرة فقط ويلخّص النتيجة.');
md.push('- **قبل الإصدار:** `node tools/qa/impact.js --check-registry` ثم الفحص الكامل `node tools/qa/run-parallel.js` ثم بنود الهاتف أدناه (`plans/qa-checklist.html` يحفظ النتائج ويصدّرها).');
md.push('- كل ميزة أو فحص جديد يُضاف إلى `features.json` و`qa-items.json` في التعديل نفسه.');
md.push('- الأولوية: P0 يمنع الإصدار، P1 يُصلَح قبل الإصدار ما أمكن، P2 مراقبة. طريقة الفحص: آلي (ui.js) أو يدوي أو كلاهما. سجل نتائج الإصدارات السابقة في [QA-history.md](QA-history.md).', '');
md.push('الإصدار الحالي: **' + version + ' (' + code + ')** — ' + FEATURES.length + ' ميزة، ' + ITEMS.length + ' بند.', '');
md.push('## الفهرس: الخصائص × الميزات', '');
md.push('| الميزة | ' + order.join(' | ') + ' |', '|---|' + order.map(() => ':-:').join('|') + '|');
for (const f of FEATURES) {
  const row = order.map(c => { const n = ITEMS.filter(i => i.feature === f.id && i.char === c).length; return n || ''; });
  md.push('| `' + f.id + '` ' + f.name_ar + ' | ' + row.join(' | ') + ' |');
}
md.push('| **المجموع** | ' + order.map(c => ITEMS.filter(i => i.char === c).length).join(' | ') + ' |', '');
md.push('الرموز: ' + order.map(c => '`' + c + '` ' + CH[c].ar).join(' · '), '');
for (const c of order) {
  const its = sorted.filter(i => i.char === c); if (!its.length) continue;
  md.push('## ' + c + ' — ' + CH[c].ar + ' (' + CH[c].en + ') — ' + its.length + ' بند', '');
  let lastF = '';
  for (const i of its) {
    if (i.feature !== lastF) { lastF = i.feature; const f = fById[i.feature]; md.push('### ' + f.name_ar + ' / ' + f.name_en + ' (`' + f.id + '`، خطورة ' + f.risk + (f.stable ? '' : '، غير مستقرة') + ')', ''); }
    md.push('- [ ] **' + i.id + '** · ' + i.priority + ' · ' + HOW[i.how] + ' · ' + DEV[i.device] + ' — ' + i.title_ar + (i.src ? ' (`' + i.src + '`)' : ''));
    i.steps_ar.forEach((s, k) => md.push('  ' + (k + 1) + '. ' + s));
    md.push('  - المتوقع: ' + i.expected_ar + (i.ui_group ? ' — مجموعة ui.js: «' + i.ui_group + '»' : ''));
  }
  md.push('');
}
md.push('---', '', 'سجل الإصدارات السابقة ونتائج كل فحص: [QA-history.md](QA-history.md).', '');
write('QA-checklist.md', md.join('\n'));

// ---------- HTML ----------
const data = { version, code, characteristics: CH, features: FEATURES.map(f => ({ id: f.id, name_ar: f.name_ar, name_en: f.name_en, area: f.area, risk: f.risk })), items: sorted };
const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>قائمة فحص لوْح / Lawh QA checklist ${version}</title>
<style>
:root{--bg:#f6f6f2;--fg:#1b2430;--card:#fff;--mut:#5a6572;--pri:#1f3a5f;--ok:#0a7a3a;--bad:#c0392b;--line:#d9dde3}
*{box-sizing:border-box}body{font-family:system-ui,'Segoe UI',Tahoma,sans-serif;margin:0;background:var(--bg);color:var(--fg);line-height:1.7}
header{position:sticky;top:0;z-index:5;background:var(--pri);color:#fff;padding:8px 14px}
header h1{font-size:18px;margin:0 0 6px}#sum{font-size:14px}
.filters{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.filters select,.filters input{font:inherit;padding:5px 8px;border-radius:8px;border:1px solid #ccd;min-height:36px;max-width:100%}
.filters input{flex:1;min-width:140px}button{font:inherit;cursor:pointer}
main{padding:12px 14px;max-width:900px;margin:auto}h2{color:var(--pri);font-size:18px;border-bottom:2px solid #1f3a5f22;margin:22px 0 8px}
.card{background:var(--card);border-radius:12px;padding:10px 14px;margin:8px 0;border:1px solid var(--line)}
.card.pass{border-color:var(--ok);background:#eef8f1}.card.fail{border-color:var(--bad);background:#fbefed}
.id{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--mut)}.t{font-weight:700}
.tag{display:inline-block;font-size:12px;border-radius:6px;padding:0 6px;margin-inline-start:4px;background:#e8edf4}
.tag.P0{background:#c0392b;color:#fff}.tag.P1{background:#e8a33d}.tag.ph{background:#d8f0e0}
ol{margin:4px 0;padding-inline-start:22px}.exp{color:var(--ok)}.exp::before{content:"المتوقع: ";font-weight:700}
.btns{display:flex;gap:8px;margin-top:6px}.btns button{flex:1;min-height:44px;border-radius:9px;border:1px solid #ccd;background:#f2f3f5}
.card.pass .p{background:var(--ok);color:#fff}.card.fail .f{background:var(--bad);color:#fff}
textarea{width:100%;margin-top:6px;border-radius:8px;border:1px solid #ccd;padding:6px;font:inherit;display:none}.card.fail textarea,.card.hasnote textarea{display:block}
.tools{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap}.tools button{padding:10px 14px;border-radius:9px;border:0;background:var(--pri);color:#fff}
.tools button.sec{background:#e8edf4;color:var(--fg)}#out{width:100%;display:none;margin-top:8px}
@media print{header .filters,.btns,.tools,textarea{display:none!important}header{position:static;background:none;color:#000}.card{border:1px solid #999;break-inside:avoid}}
</style></head><body>
<header><h1>قائمة فحص لوْح ${version} (${code}) <small lang="en" dir="ltr">Lawh QA checklist</small></h1><div id="sum"></div>
<div class="filters">
<select id="fCh" aria-label="الخاصية / Characteristic"></select><select id="fFe" aria-label="الميزة / Feature"></select>
<select id="fPr" aria-label="الأولوية / Priority"><option value="">كل الأولويات / All priorities</option><option>P0</option><option>P1</option><option>P2</option></select>
<select id="fHow" aria-label="الطريقة / How"><option value="">كل الطرق / All methods</option><option value="auto">آلي / Auto</option><option value="manual">يدوي / Manual</option><option value="both">آلي + يدوي / Both</option></select>
<select id="fDev" aria-label="الجهاز / Device"><option value="">كل الأجهزة / All devices</option><option value="any">أي جهاز / Any</option><option value="phone">هاتف حقيقي / Phone</option><option value="emulator">محاكي / Emulator</option></select>
<select id="fSt" aria-label="الحالة / Status"><option value="">كل الحالات / All</option><option value="todo">لم يُفحص / Not run</option><option value="pass">نجح / Pass</option><option value="fail">توجد مشكلة / Fail</option></select>
<input id="q" type="search" placeholder="بحث في البنود / Search items" aria-label="بحث / Search"></div></header>
<main><div class="tools"><button id="copy">نسخ النتائج / Copy results</button><button class="sec" id="print">طباعة / Print</button><button class="sec" id="reset">مسح النتائج / Reset</button></div>
<textarea id="out" rows="12" readonly></textarea><div id="list"></div></main>
<script>
var D=${JSON.stringify(data).replace(/</g, '\\u003c')};
var KEY="qkqa."+D.version,S={};try{S=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
var FE={};D.features.forEach(function(f){FE[f.id]=f});
var HOW={auto:"آلي",manual:"يدوي",both:"آلي + يدوي"},DEV={any:"أي جهاز",phone:"هاتف حقيقي",emulator:"محاكي"};
function $(i){return document.getElementById(i)}function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function opt(sel,first,arr){sel.innerHTML='<option value="">'+first+'</option>'+arr.map(function(a){return'<option value="'+esc(a[0])+'">'+esc(a[1])+'</option>'}).join("")}
opt($("fCh"),"كل الخصائص / All characteristics",Object.keys(D.characteristics).map(function(c){return[c,c+" — "+D.characteristics[c].ar+" / "+D.characteristics[c].en]}));
opt($("fFe"),"كل الميزات",D.features.map(function(f){return[f.id,f.name_ar+" ("+f.id+")"]}));
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function st(i){return(S[i.id]||{}).v||"todo"}
function vis(){var f={c:$("fCh").value,fe:$("fFe").value,p:$("fPr").value,h:$("fHow").value,d:$("fDev").value,s:$("fSt").value,q:$("q").value.trim().toLowerCase()};
 return D.items.filter(function(i){if(f.c&&i.char!==f.c)return false;if(f.fe&&i.feature!==f.fe)return false;if(f.p&&i.priority!==f.p)return false;if(f.h&&i.how!==f.h)return false;if(f.d&&i.device!==f.d)return false;if(f.s&&st(i)!==f.s)return false;
  if(f.q&&(i.id+" "+i.title_ar+" "+i.steps_ar.join(" ")+" "+i.expected_ar).toLowerCase().indexOf(f.q)<0)return false;return true})}
function sum(){var p=0,fl=0;D.items.forEach(function(i){var v=st(i);if(v==="pass")p++;if(v==="fail")fl++});$("sum").textContent="نجح "+p+" · توجد مشكلة "+fl+" · لم يُفحص "+(D.items.length-p-fl)+" من "+D.items.length+" · المعروض "+vis().length}
function draw(){var L=$("list"),last="",lastF="",h="";
 vis().forEach(function(i){var s=S[i.id]||{},v=s.v||"",ch=i.char;
  if(ch!==last){last=ch;lastF="";h+="<h2>"+esc(ch)+" — "+esc(D.characteristics[ch].ar)+"</h2>"}
  h+='<div class="card '+v+(s.n?" hasnote":"")+'" data-id="'+i.id+'"><div class="id">'+i.id+(i.src?" · "+i.src:"")+' · '+esc(FE[i.feature].name_ar)+'</div><div class="t">'+esc(i.title_ar)+
   ' <span class="tag '+i.priority+'">'+i.priority+'</span><span class="tag">'+HOW[i.how]+'</span><span class="tag'+(i.device==="phone"?" ph":"")+'">'+DEV[i.device]+'</span></div><ol>'+
   i.steps_ar.map(function(x){return"<li>"+esc(x)+"</li>"}).join("")+'</ol><div class="exp">'+esc(i.expected_ar)+'</div>'+(i.ui_group?'<div class="id">ui.js: '+esc(i.ui_group)+'</div>':"")+
   '<div class="btns"><button class="p">نجح ✓ Pass</button><button class="f">توجد مشكلة ✗ Fail</button></div><textarea rows="2" placeholder="ملاحظة: ماذا حدث؟ / Note: what happened?">'+esc(s.n||"")+'</textarea></div>'});
 L.innerHTML=h||"<p>لا بنود مطابقة.</p>";sum()}
function set(id,v,n){var c=S[id]||{};S[id]={v:v===undefined?c.v||"":v,n:n===undefined?c.n||"":n};save()}
$("list").addEventListener("click",function(e){var c=e.target.closest(".card");if(!c)return;var id=c.dataset.id,cur=(S[id]||{}).v;
 if(e.target.classList.contains("p")){set(id,cur==="pass"?"":"pass");draw()}else if(e.target.classList.contains("f")){set(id,cur==="fail"?"":"fail");draw()}});
$("list").addEventListener("input",function(e){if(e.target.tagName!=="TEXTAREA")return;var c=e.target.closest(".card");set(c.dataset.id,undefined,e.target.value);sum()});
["fCh","fFe","fPr","fHow","fDev","fSt"].forEach(function(i){$(i).onchange=draw});$("q").oninput=draw;
$("print").onclick=function(){window.print()};
$("reset").onclick=function(){if(confirm("مسح كل النتائج المحفوظة لهذا الإصدار؟")){S={};save();draw()}};
$("copy").onclick=function(){var v=vis(),p=0,f=0,lines=v.map(function(i){var s=S[i.id]||{},x=s.v==="pass"?"نجح":s.v==="fail"?"مشكلة"+(s.n?" ← "+s.n:""):"—";if(s.v==="pass")p++;if(s.v==="fail")f++;return i.id+" ["+i.priority+"] "+i.title_ar+": "+x});
 var r="لوْح "+D.version+" ("+D.code+") — "+new Date().toISOString().slice(0,10)+"\\nالمعروض "+v.length+": نجح "+p+" · مشكلة "+f+" · لم يُفحص "+(v.length-p-f)+"\\n"+lines.join("\\n");
 var o=$("out");o.value=r;o.style.display="block";o.select();if(navigator.clipboard)navigator.clipboard.writeText(r).then(function(){$("copy").textContent="✓ تم النسخ / Copied"},function(){})};
draw();
</script></body></html>
`;
write('plans/qa-checklist.html', html);
console.log('QA-checklist.md + plans/qa-checklist.html written: version ' + version + ', ' + FEATURES.length + ' features, ' + ITEMS.length + ' items');
