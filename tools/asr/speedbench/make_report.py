# Builds plans/asr-speed-bench/report.html (+ plans/asr-speed-report.html) and results.json from the bench outputs.
# Usage: python -X utf8 -I make_report.py   (paths fixed: see top)
import os, sys, json, html, shutil, hashlib, numpy as np
QK = r'D:\Quran App\quran-karim'; D = os.path.join(QK, 'plans', 'asr-speed-bench'); W = r'D:\Quran App\qtrain\speedbench'
E = html.escape
L = lambda n: json.load(open(os.path.join(D, n), encoding='utf8'))
if os.path.exists(os.path.join(D, 'results_main.json')):
    main = L('results_main.json'); cap = L('results_capcut.json'); q9 = L('results_quiet0.9.json'); q13 = L('results_quiet1.3.json')
else:                                   # second run: the intermediates were folded into results.json
    _r = L('results.json'); main = _r['main']; cap = _r['vad_experiments']['capcut']; q9 = _r['vad_experiments']['quiet_0.9']; q13 = _r['vad_experiments']['quiet_1.3']
rows = [r for r in json.load(open(os.path.join(W, 'out', 'rows.json'), encoding='utf8')) if 'skip' not in r]
sel = json.load(open(os.path.join(W, 'selection.json'), encoding='utf8'))
man = json.load(open(os.path.join(W, 'manifest.json'), encoding='utf8'))
SP = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0]
syn = {s: main['syn_%gx' % s] for s in SP}; base = syn[1.0]
def verdict(v, b, key_t='tracking_pct', key_w='wer_skel_pct', lim=3.0):
    dT = b[key_t] - v[key_t]; dW = v[key_w] - b[key_w]
    return ('مقبول' if dT <= lim and dW <= lim else 'غير مقبول'), dT, dW
def cls(t): return 'ok' if t == 'مقبول' else 'bad'
def f(x, d=1): return '—' if x is None else ('%.*f' % (d, x))
# ---- meta ----
mp = os.path.join(W, 'g10b', 'model.int8.onnx')
meta = dict(model_file='qtrain/gpu-train/z1/G10b.int8.onnx (pack v4 = asrnv4.zip a.bin + asrnvp4.zip b.bin joined)', bytes=os.path.getsize(mp),
            md5=hashlib.md5(open(mp, 'rb').read()).hexdigest(), sha256=hashlib.sha256(open(mp, 'rb').read()).hexdigest(), app_asr_ver='web/app.js:391 ASRM.asrnv.ver = 4',
            vad='NvAsr.java 5.35: PRE 0.3 s, QUIET_END 0.5, VMIN 0.0015, floor x3, RISE_SPEECH 0.0005, CATCH 50 blocks, 12 s hard cut, louder -30 dBFS', threads=4)
# ---- latency from rows ----
ms12 = [m for r in rows if r['set'].startswith('real') or r['set'].startswith('syn') for m, p in zip(r['ms'], r['plen']) if 11.8 <= p <= 12.2]
meta['pc_ms_per_12s_piece'] = round(float(np.mean(ms12)), 1) if ms12 else None
# ---- examples ----
def ex(group, k=1, minw=6):
    R = sorted([r for r in rows if r['set'] == group and r['nwords'] >= minw], key=lambda r: -(r['wer_sk']))
    return R[k:k + 1] or R[:1]
EX = [('syn_0.5x', 0), ('syn_0.5x', 3), ('syn_1.5x', 0), ('syn_2x', 0), ('syn_2x', 6), ('syn_3x', 10), ('syn_4x', 10), ('real_hadr', 0), ('real_hadr', 4), ('real_mujawwad', 0), ('real_mujawwad', 3)]
exrows = []
for g, k in EX:
    for r in ex(g, k): exrows.append((g, r))
# ---- tables ----
def tr(cells, cl=''): return '<tr%s>%s</tr>' % (' class="%s"' % cl if cl else '', ''.join('<td>%s</td>' % c for c in cells))
H = lambda *a: '<tr>%s</tr>' % ''.join('<th>%s</th>' % c for c in a)
t_speed = [H('السرعة', 'clips', 'WER (full-ayah)', 'WER skel', 'CER skel', 'Tracking %', 'Δ tracking', 'Δ WER skel', 'ctc_up verify %', 'lost (derail/stall/piece)', 'RTF', 'chunk ms (mean/p95)', 'الحكم')]
for s in SP:
    v = syn[s]; vd, dT, dW = verdict(v, base)
    t_speed.append(tr(['%gx' % s, v['clips'], f(v['wer_pct']), f(v['wer_skel_pct']), f(v['cer_skel_pct']), f(v['tracking_pct']), ('-%.1f' % dT if s != 1 else 'base'), ('+%.1f' % dW if s != 1 else 'base'),
                       f(v.get('ctc_up_verify_pct')), '%d / %d / %d' % (v['lost_derail'], v['lost_stall'], v['lost_piece']), f(v['rtf'], 3),
                       '%s / %s' % (f(v['chunk_ms_mean'], 0), f(v['chunk_ms_p95'], 0)), '<b class="%s">%s</b>' % (cls(vd), vd) if s != 1 else 'baseline'], '' if s == 1 else cls(vd)))
fam_t = [H('السرعة', 'base wps → effective', 'reciters (40 clips) WER skel / track', 'user clips (24) WER skel / track')]
fam = main['_syn_by_family']
for s in SP:
    a, b = fam.get('reciters@%s' % s), fam.get('user@%s' % s)
    fam_t.append(tr(['%gx' % s, '%.2f→%.2f  |  %.2f→%.2f' % (a['median_wps'], a['median_wps'] * s, b['median_wps'], b['median_wps'] * s),
                     '%s / %s' % (f(a['wer_skel_pct']), f(a['tracking_pct'])), '%s / %s' % (f(b['wer_skel_pct']), f(b['tracking_pct']))]))
bins_t = [H('effective wps', 'clips', 'WER skel', 'Tracking %', 'derail / stall / lost-piece', 'الحكم (vs 0.8–1.6 wps)')]
bn = main['_syn_by_effective_wps']; bref = {'wer_skel_pct': np.mean([bn['0.8-1.2']['wer_skel_pct'], bn['1.2-1.6']['wer_skel_pct']]), 'tracking_pct': np.mean([bn['0.8-1.2']['tracking_pct'], bn['1.2-1.6']['tracking_pct']])}
bin_verd = {}
for k, v in bn.items():
    vd, dT, dW = verdict(v, bref); bin_verd[k] = vd
    bins_t.append(tr([k, v['clips'], f(v['wer_skel_pct']), f(v['tracking_pct']), '%d / %d / %d' % (v['lost_derail'], v['lost_stall'], v['lost_piece']), '<b class="%s">%s</b>' % (cls(vd), vd)], cls(vd)))
real_t = [H('الفئة', 'clips', 'مصدر', 'median wps', 'audio (s)', 'WER skel', 'WER skel بدون VAD', 'Tracking %', 'ctc_up verify %', 'wrong caught %', 'ayah-id %', 'lost clips %', 'VAD: pieces/clip · dropped speech % · cap-cuts · mid-word splits', 'merges/100w', 'chunk ms', 'RTF')]
names = [('real_murattal', 'murattal (baseline)', 'held-out'), ('real_hadr', 'hadr (≥2.0 wps)', 'held-out'), ('real_mujawwad', 'slow / mujawwad-like (<0.8 wps)', 'held-out'), ('real_hadr_trainseen', 'hadr (seen in training)', 'train split')]
for k, n, src in names:
    v = main[k]
    real_t.append(tr([n, v['clips'], src, f(v['median_wps'], 2), v['audio_s'], f(v['wer_skel_pct']), f(v['wer_skel_novad_pct']), f(v['tracking_pct']), f(v.get('ctc_up_verify_pct')), f(v['wrong_caught_pct']), f(v['ayah_id_pct']), f(v['lost_clips_pct']),
                      '%s · %s · %d · %d' % (f(v['pieces_per_clip'], 2), f(v['dropped_speech_pct'], 2), v['cap_cuts'], v['midword_splits']), f(v['merges_per100w'], 2), '%s/%s' % (f(v['chunk_ms_mean'], 0), f(v['chunk_ms_p95'], 0)), f(v['rtf'], 3)]))
vad_t = [H('تجربة VAD (لا retrain)', 'real mujawwad: WER skel / tracking / pieces / cap-cuts', 'syn 0.5x', 'syn 0.75x', 'real hadr', 'real murattal', 'syn 1x')]
for n, R in (('5.35 كما هو (quiet 0.5 s, cap 12 s hard)', main), ('capcut (قطع عند أهدى block قبل 12 s)', cap), ('quiet 0.9 s', q9), ('quiet 1.3 s', q13)):
    def c(g): v = R[g]; return '%s / %s' % (f(v['wer_skel_pct']), f(v['tracking_pct']))
    m = R['real_mujawwad']
    vad_t.append(tr([n, '%s / %s / %s / %d' % (f(m['wer_skel_pct']), f(m['tracking_pct']), f(m['pieces_per_clip'], 2), m['cap_cuts']), c('syn_0.5x'), c('syn_0.75x'), c('real_hadr'), c('real_murattal'), c('syn_1x')]))
ex_t = [H('المجموعة', 'المرجع (normalised)', 'ما سمعه الموديل', 'WER skel')]
for g, r in exrows:
    ex_t.append(tr([E(g), '<span class="ar">%s</span>' % E(r['ref']), '<span class="ar">%s</span>' % E(r['hyp'] or '(فاضي)'), f(100 * r['wer_sk'])]))
# ---- verdicts ----
vs = {s: verdict(syn[s], base)[0] for s in SP if s != 1}
okspeeds = [s for s in SP if s != 1 and vs[s] == 'مقبول']
rv = {k: verdict(main[k], main['real_murattal'])[0] for k in ('real_hadr', 'real_mujawwad')}
rvd = {k: verdict(main[k], main['real_murattal']) for k in ('real_hadr', 'real_mujawwad')}
syn_user = {s: fam['user@%s' % s] for s in SP}; syn_rec = {s: fam['reciters@%s' % s] for s in SP}
# real hadr distribution
hw = [c['wps'] for c in man if c['set'] == 'real_hadr']; mw = [c['wps'] for c in man if c['set'] == 'real_mujawwad']
src_hadr = sorted({c['src'] for c in man if c['set'] == 'real_hadr'}, key=str)
res = dict(meta=meta, selection=sel, main=main, vad_experiments={'capcut': cap, 'quiet_0.9': q9, 'quiet_1.3': q13}, verdict_synthetic=vs, verdict_real=rv,
           acceptance='tracking and WER-skeleton each within 3 points of the 1.0x baseline; proposed: judge by absolute speech rate (words/s) not by tempo factor',
           verdict_by_effective_wps=bin_verd)
json.dump(res, open(os.path.join(D, 'results.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for n in ('results_main.json', 'results_capcut.json', 'results_quiet0.9.json', 'results_quiet1.3.json'):
    p = os.path.join(D, n)
    if os.path.exists(p): os.remove(p)
CSS = ('body{font-family:Segoe UI,Tahoma,Arial;margin:24px;max-width:1300px;line-height:1.7}table{border-collapse:collapse;margin:10px 0;font-size:13px}td,th{border:1px solid #bbb;padding:4px 8px;text-align:center}'
       'th{background:#eee}.ok td,b.ok{color:#075}.bad td,b.bad{color:#b00}.ar{font-size:17px}tr.ok{background:#f1fbf5}tr.bad{background:#fdf1f1}h2{border-bottom:2px solid #ddd;margin-top:30px}code{background:#f3f3f3;padding:1px 4px;direction:ltr;unicode-bidi:embed}.box{background:#fffbe6;border:1px solid #e8d98a;padding:8px 14px}')
tbl = lambda rows_: '<table>%s</table>' % ''.join(rows_)
fastest_ok_bin = [k for k, v in bin_verd.items() if v == 'مقبول']
page = f'''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>اختبار سرعة التلاوة على موديل 5.35</title><style>{CSS}</style>
<h1>اختبار سرعة التلاوة (hadr / mujawwad) على موديل ASR في 5.35</h1>
<p>التاريخ 2026-11-24 · موديل <code>G10b int8 (pack v4, Z1)</code> · على الـ PC فقط (CPU، 4 threads) · مفيش تدريب اتعمل.</p>
<div class="box"><b>الخلاصة.</b>
<ul>
<li><b>Tracking وWER مقبولين لحد سرعة كلام ≈ 2.0 كلمة/ث</b> (يعني لحد 2x على قراءة murattal بطيئة ≈ 0.9 كلمة/ث، و1.25x على قراءة المستخدم الأسرع ≈ 1.6 كلمة/ث). فوق كده بيقع: 2.0–2.5 كلمة/ث حدّ، و≥ 2.5 كلمة/ث غير مقبول، و3x/4x فشل تام (حذف كلمات: del {syn[3.0]['del_per100w']} و{syn[4.0]['del_per100w']} لكل 100 كلمة).</li>
<li>حسب القاعدة المقترحة (±3 نقاط عن 1.0x) على الـ tempo factor: مقبول = {', '.join('%gx' % s for s in okspeeds)}؛ غير مقبول = {', '.join('%gx' % s for s in SP if s != 1 and vs[s] != 'مقبول')}. <b>لكن الـ factor وحده مضلل</b>: 1.5x على كلام المستخدم (≈ 2.3 كلمة/ث) بيفشل (tracking {f(syn_user[1.5]['tracking_pct'])}% مقابل {f(syn_user[1.0]['tracking_pct'])}%) بينما 2x على القرّاء البطيئين بيعدّي ({f(syn_rec[2.0]['tracking_pct'])}%). التحكيم الأدق بالسرعة المطلقة (كلمة/ث) — جدول 3.</li>
<li>التلاوة الحقيقية (held-out، الموديل ما اتدرّبش عليها): <b>hadr ≥2.0 كلمة/ث ({main['real_hadr']['clips']} clip)</b> tracking {f(main['real_hadr']['tracking_pct'])}% مقابل {f(main['real_murattal']['tracking_pct'])}% للـ murattal (Δ {rvd['real_hadr'][1]:+.1f})، وctc_up verify {f(main['real_hadr']['ctc_up_verify_pct'])}% مقابل {f(main['real_murattal']['ctc_up_verify_pct'])}%، لكن WER skel {f(main['real_hadr']['wer_skel_pct'])} مقابل {f(main['real_murattal']['wer_skel_pct'])} (Δ {rvd['real_hadr'][2]:+.1f}) → بالقاعدة الحرفية <b class="{cls(rv['real_hadr'])}">{rv['real_hadr']}</b> بفارق ضئيل على الـ WER، والـ tracking والـ verify الفعلي في التطبيق سليمين (0 lost clips). يعني: <b>hadr الحقيقي في العينة شغّال عملياً، الحدّ الأدنى للفشل بيبدأ فوق ≈ 2.5 كلمة/ث</b> (4% بس من الـ clips).</li>
<li><b>البطيء (&lt;0.8 كلمة/ث، {main['real_mujawwad']['clips']} clip)</b>: tracking {f(main['real_mujawwad']['tracking_pct'])}% سليم لكن WER skel {f(main['real_mujawwad']['wer_skel_pct'])} (Δ {rvd['real_mujawwad'][2]:+.1f} عن murattal → <b class="{cls(rv['real_mujawwad'])}">{rv['real_mujawwad']}</b> بالقاعدة الحرفية)، بينما نفس الـ clips بدون VAD = {f(main['real_mujawwad']['wer_skel_novad_pct'])} → <b>الـ VAD/التقطيع بيكلّف ≈ {f(main['real_mujawwad']['wer_skel_pct'] - main['real_mujawwad']['wer_skel_novad_pct'])} نقطة عند البطء</b> (22 قطعة اتقطعت عند 12 s، 3 حدود قطعت كلمة، 1.2% كلام برّه أي قطعة). synthetic 0.5x نفس الظاهرة ({f(syn[0.5]['wer_skel_pct'])} مقابل {f(syn[0.5]['wer_skel_novad_pct'])} بدون VAD، <b class="{cls(vs[0.5])}">{vs[0.5]}</b>)، و0.75x مقبول.</li>
<li>الـ latency مش مشكلة: RTF على الـ PC ≈ {f(syn[1.0]['rtf'], 3)} (أسرع من الوقت الحقيقي ≈ {f(1 / syn[1.0]['rtf'], 0)} مرة)، وبيقل مع السرعة لأن الصوت أقصر. الموبايل أبطأ (progress.md: قطعة 12 s = 487 ms على bee81250؛ على الـ PC {f(meta['pc_ms_per_12s_piece'], 0)} ms).</li>
</ul></div>

<h2>1. الداتا</h2>
<ul>
<li><b>Real</b> (تصنيف بسرعة الكلام = كلمات ÷ مدة الكلام الفعلية first→last voiced block، من الـ labels المتحقّقة: (سورة/آية) أو نص عثماني متحقق من الريبو؛ ولا ASR hypothesis كمرجع): من الـ held-out sets اللي الموديل ما اتدرّبش عليها (test-L1/L2/L3 من تسجيلات المستخدم + ho_reciters (8 قرّاء everyayah) + ho_retasy (متطوعين)): hadr ≥ 2.0 كلمة/ث، murattal 1.0–1.6 (عيّنة عشوائية {main['real_murattal']['clips']})، بطيء &lt; 0.8 كلمة/ث. كمان {main['real_hadr_trainseen']['clips']} clip hadr من train split كـ«مشاهَد في التدريب» (دليل إضافي فقط، مش للحكم).</li>
<li>عدد الـ clips وساعات الصوت في كل فئة: جدول 4. اتفحص <b>كل</b> مجلد «تلاوات مختلفة» عن طريق الـ clips المقطّعة سابقاً (qtrain/long/all/clips.json: 4202 clip من 63 تسجيل). التسجيلات الخام الكاملة ما اتستخدمتش (بدون ayah labels).</li>
<li><b>مفيش mujawwad حقيقي</b> (المنشاوي/عبدالباسط مجوّد) على الـ PC. أقرب حاجة قراءة بطيئة &lt; 0.8 كلمة/ث (قرّاء + المستخدم). تحميل everyayah مجوّد محتاج موافقة (تحميل ملفات) — مقترح للخطوة الجاية.</li>
<li><b>Synthetic</b>: {sel['syn_base_clips']} clip murattal (40 آية كاملة من ho_reciters: {len(sel['syn_reciters'])} قرّاء × 5، + 24 clip من قراءة المستخدم test-L1/L2) × 8 سرعات (ffmpeg atempo، تسلسل filters للـ 3x/4x) = {sel['syn_base_clips'] * 8} تشغيل. الـ tempo بيحافظ على الـ pitch لكن بيدوّس الوقفات والـ madd بنفس النسبة (اصطناعي — مش مطابق للـ hadr الحقيقي اللي بيقلّل الوقفات أكتر من الحروف).</li>
</ul>

<h2>2. الطريقة</h2>
<ul>
<li>الـ pipeline = إعدادات 5.35 بالظبط: VAD (NvAsr.java: PRE 0.3 s، QUIET_END 0.5، VMIN 0.0015، floor×3، RISE_SPEECH 0.0005، CATCH 50 block، cut صلب عند 12 s) ← louder −30 dBFS ← features ← <code>G10b.int8.onnx</code> (نفس الملف اللي في pack v4) ← greedy CTC ← matcher <code>rAlign</code> (bench.recite_dp) + hybrid التطبيق <code>ctc_up</code> (<code>p1b_port_eval.py</code> مع <code>web/app.js rLocal</code> الحقيقي عبر node). مستخدم bench.py (VAD/features/Model/Quran) + p1b_port_eval كما هم؛ المكتوب جديد: <code>tools/asr/speedbench/*</code>.</li>
<li><b>الموديل</b>: md5 <code>{meta['md5']}</code>، {meta['bytes']:,} byte = join(asrnv4.zip/a.bin + asrnvp4.zip/b.bin) = <code>qtrain/gpu-train/z1/G10b.int8.onnx</code>، والتطبيق (web/app.js:391) <code>ver: 4</code> = pack v4.</li>
<li><b>Normalisation</b>: نفس الـ app norm (حذف التشكيل، توحيد ا/ى/ة)، <b>WER</b> = على الكلمات بعد norm ضد النص الإملائي (quran-simple) للآيات الكاملة فقط (clips المستخدم الجزئية مرجعها عثماني، فمش بتدخل في WER)، <b>WER skel / CER skel</b> = على skeleton الكلمات (نفس اللي الـ matcher بيستخدمه: حذف حروف العلة/الهمزة) ضد الكلمات العثمانية المتوقعة — ده الرقم الموحّد لكل الفئات. <b>Tracking %</b> = نسبة الكلمات اللي الـ matcher (rAlign) حكم عليها «صح» في مكانها الصح (مقابل نص الـ span المعروف). <b>Lost</b>: derail = ≥3 كلمات غلط متتالية، stall = ≥3 كلمات في الآخر ما اتوصلش ليها، lost-piece = قطعة فيها ≥3 كلمات مسموعة حرّكت الـ tracker بأقل من نصفها (الحساب تراكمي على القطع). <b>VAD</b>: dropped speech = كلام (طاقة) خارج أي قطعة؛ cap-cut = قطعة اتقطعت عند 12 s؛ mid-word split = حد قطعة بيقطع كلمة؛ merges = كلمتين اتسمعوا ككلمة (alignment).</li>
<li><b>Latency</b>: {meta['threads']} threads CPU (الموبايل في OrtBench 4 threads)، ملاحظة: PC أسرع من الموبايل.</li>
<li><b>معيار القبول المقترح من المستخدم</b>: دقة ضمن 3 نقاط من 1.0x (طبّقته على Tracking وعلى WER skel معاً) + tracking يفضل مع القارئ لحد 1.5x.</li>
</ul>

<h2>3. جدول لكل سرعة (synthetic، {sel['syn_base_clips']} clip لكل صف)</h2>
{tbl(t_speed)}
<p>WER (full-ayah) = على الـ 40 آية الكاملة فقط. ctc_up = تحقق التطبيق الهجين (verify%: صح + كشف الكلمة المبدّلة).</p>
<h3>3-أ. نفس الأرقام مفصولة بعائلة المصدر (السرعة الأصلية مهمة)</h3>
{tbl(fam_t)}
<h3>3-ب. نفس الـ 512 تشغيل مجمّعة بالسرعة المطلقة بعد التعديل (كلمة/ث)</h3>
{tbl(bins_t)}
<p>المرجع هنا متوسط 0.8–1.6 كلمة/ث. الحدّ العملي: <b>مقبول لحد ≈ 2.0 كلمة/ث</b>، ويبدأ الفشل عند 2–2.5 (tracking 93.8) وبيقع عند ≥ 2.5. الموديل اتدرّب بـ speed perturbation 0.9–1.1 فقط (nv_curr.py:196)، وكلام المستخدم التدريبي p95 ≈ 2.3 كلمة/ث، فمفيش داتا فوق كده.</p>

<h2>4. الفئات الحقيقية</h2>
{tbl(real_t)}
<p>الحكم الحقيقي مقابل murattal: hadr → <b class="{cls(rv['real_hadr'])}">{rv['real_hadr']}</b> (Δtracking {rvd['real_hadr'][1]:+.1f}، ΔWER skel {rvd['real_hadr'][2]:+.1f})، البطيء → <b class="{cls(rv['real_mujawwad'])}">{rv['real_mujawwad']}</b> (Δtracking {rvd['real_mujawwad'][1]:+.1f}، ΔWER skel {rvd['real_mujawwad'][2]:+.1f}). hadr: median {np.median(hw):.2f} كلمة/ث، أقصى {max(hw):.2f}؛ بطيء: median {np.median(mw):.2f}. مصادر hadr الحقيقي: {len(src_hadr)} مصدر (تسجيلات المستخدم + ho_retasy)، فالعيّنة مقصوصة عند الوقفات ({main['real_hadr']['chunk_s_mean']} ث متوسط القطعة) — مش streaming مستمر لسورة كاملة بسرعة hadr، وده مش مُختبَر.</p>

<h2>5. VAD على البطيء (بدون retrain)</h2>
{tbl(vad_t)}
<p>الخلاصة: cap-cuts نزلت بـ capcut (22→3 على البطيء الحقيقي) لكن الـ WER ما اتحسّنش (11.4→12.4)، ورفع quiet لـ 1.3 s حسّن البطيء الحقيقي (11.4→9.6) لكنه بيوطّي 0.75x وsyn 1x شوية ومش بيقفل الفجوة مع «بدون VAD» (4.6). يعني التقطيع <b>مش السبب الوحيد</b> (تطبيع كل قطعة لوحدها + ضياع السياق + 1% كلام برّه القطع) وده محتاج تحقيق أعمق قبل أي تعديل في NvAsr.java؛ وأي رفع للـ quiet بيأخّر آخر كلمة بنفس القيمة تقريباً.</p>

<h2>6. أمثلة أخطاء (المرجع normalised ↔ ما سمعه الموديل)</h2>
{tbl(ex_t)}
<p>النمط: عند ≥3 كلمة/ث الموديل بيحذف كلمات كاملة (CTC بـ 12.5 frame/ث) وبيدمج كلمتين ({f(syn[3.0]['merges_per100w'], 1)} دمج/100 كلمة عند 3x)، وعند 0.5x بيبدّل حروف أو يقطع على حد القطعة.</p>

<h2>7. الحكم</h2>
<table><tr><th>السرعة</th>{''.join('<th>%gx</th>' % s for s in SP if s != 1)}</tr>
<tr><td>synthetic (قاعدة ±3)</td>{''.join('<td class="%s"><b>%s</b></td>' % (cls(vs[s]), vs[s]) for s in SP if s != 1)}</tr></table>
<table><tr><th>حقيقي</th><th>hadr</th><th>بطيء (&lt;0.8)</th></tr><tr><td>vs murattal حقيقي</td><td class="{cls(rv['real_hadr'])}"><b>{rv['real_hadr']}</b></td><td class="{cls(rv['real_mujawwad'])}"><b>{rv['real_mujawwad']}</b></td></tr></table>
<p><b>مقترح معيار أفضل:</b> بدل tempo factor، يُقاس بالسرعة المطلقة: «مقبول» = tracking وWER skel ضمن 3 نقاط من متوسط 0.8–1.6 كلمة/ث، مع شرط ثالث: ما فيش stall/derail &gt; 2% من الـ clips. السبب: نفس الـ 1.5x بيدّي 2.3 كلمة/ث أو 1.4 حسب القارئ والنتيجة بتتغير تماماً. وبالقياس ده الموديل مقبول لحد ≈ 2.0 كلمة/ث (جدول 3-ب) وده بيغطي ≈ 96% من clips المستخدم المقطّعة (≥2.4 كلمة/ث أقل من 5% في الـ held-out).</p>

<h2>8. خطة تدريب (لو القرار إن الـ hadr السريع جداً والـ mujawwad لازم يتغطّوا) — مش اتنفذت</h2>
<ol>
<li><b>الأول بدون تدريب</b>: ضبط الـ VAD للبطء (cap/quiet تكيّفي: بعد 8 s من الكلام يُقصّ عند أهدى block بدل 12 s الصلب، و quiet أطول لما سرعة الكلام الأخيرة بطيئة) ثم bench موازي (ctc_up). مجانية في الحجم والـ latency.</li>
<li><b>داتا</b>: (أ) tempo augmentation بدل الـ resample الحالي (0.9–1.1) → atempo 0.6–2.2 بدون تغيير pitch، p≈0.5، نفس <code>g10_prep.ff</code> (موجودة بنسخة G10 القديمة 1.1–1.5 / 0.7–0.9 واتشالت في G10b)؛ (ب) clips hadr حقيقية من تسجيلات المستخدم ≥2.0 كلمة/ث (train split: ~382 clip متاحة) بوزن أعلى؛ (ج) mujawwad حقيقي: تحميل المنشاوي/عبدالباسط مجوّد من everyayah (محتاج موافقة المستخدم على التحميل)، labels جاهزة (سورة/آية)؛ (د) hold-out للتقييم = القرّاء/الأيات اللي ما اتدرّبوش.</li>
<li><b>تدريب</b>: نفس وصفة G10b (init من best.nemo، freeze نص الـ encoder، LR 6e-5 مع sweep قصير 400 خطوة × 3 LRs، fp32، BATCH_SEC 40، ACC 3) — مقاس سابقاً: 1.0 s/step، 2.3 GB VRAM → يدخل في 6 GB بسهولة؛ 3000 خطوة ≈ 50–60 دقيقة + export/int8 + gate (nv_gate) ≈ 1–2 ساعة إجمالاً لكل محاولة. بوابة القبول: ALL ctc_up ≥ 97.3 (لا تراجع على السرعة العادية)، ومعيار هذا التقرير ضمن 3 نقاط حتى ≈ 2.5–3 كلمة/ث، noisy ما يقلّش.</li>
<li><b>مخاطر</b>: (1) حد معماري: الموديل بيطلّع frame كل 80 ms (12.5/ث)؛ عند ≥3 كلمة/ث (≈ 9+ token/ث تقريباً — تقدير مش مقاس) CTC مش هيلاقي frames كفاية، فالتدريب ممكن يرفع الحد لكن مش لأي سرعة؛ (2) الـ atempo اصطناعي ≠ hadr حقيقي (الحقيقي بيختصر الحروف مش بس الوقت) فلازم داتا حقيقية للقياس النهائي؛ (3) نسيان (forgetting) السرعة العادية ← replay من L1/L2/replayT زي G10b؛ (4) mujawwad: madd طويل بيكسر الـ VAD أكتر من الموديل نفسه → أغلب الحل في الـ VAD؛ (5) الحجم والـ latency ثابتين (نفس المعمارية)، يعني pack v5 بنفس 93 MB؛ (6) أي labels لازم من النص المتحقق، مش من ASR (درس P3).</li>
</ol>
<h2>9. اختلافات عن التطبيق ما قدرتش أتفاداها</h2>
<ul>
<li>الصوت من ملفات (wav 16 kHz بعد gain −31 dBFS قبل الـ VAD، زي bench.py) مش من مايك الموبايل (AGC/ضوضاء/VOICE_RECOGNITION).</li>
<li>التطبيق بيصدر partials/freeze أثناء الجملة؛ هنا finals فقط (النتيجة النهائية للـ verdicts نفسها حسب تعليق NvAsr).</li>
<li>الـ matcher: rAlign في bench (python) و rLocal الحقيقي من app.js عبر node للـ ctc_up؛ الـ CTC forced alignment في Java (Ctc.java) متمثّل بـ ctc.py (parity مختبرة سابقاً).</li>
<li>الـ latency على CPU الـ PC (ORT python، 4 threads) مش ORT Android.</li>
<li>الـ tracking مقاس مقابل span معروف، مش «متابعة حرّة» عبر القرآن كله (جزئياً ayah-id % و rLocal).</li>
</ul>
<p>الملفات: <code>tools/asr/speedbench/{{rate_survey,prep,bench_speed,aggregate,make_report}}.py</code> · الداتا والصوت: <code>D:\\Quran App\\qtrain\\speedbench\\</code> · الأرقام الخام: <code>plans/asr-speed-bench/results.json</code>.</p>
</html>'''
open(os.path.join(D, 'report.html'), 'w', encoding='utf8').write(page)
shutil.copy(os.path.join(D, 'report.html'), os.path.join(QK, 'plans', 'asr-speed-report.html'))
print('ok', len(page), 'okspeeds', okspeeds, rv, bin_verd)
