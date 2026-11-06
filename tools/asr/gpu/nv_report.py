# P3 report: phone-pipeline gate results (bench.py int8, verify % / wrong caught % / ayah id %) for 5.7 and each level model,
# plus the proxy CER curve from nv_curr.json. Usage: python nv_report.py <out.html> tag[=label] ...
import sys, json, os, html, glob
O = r'D:\Quran App\qtrain\eval\out'; G = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1]; tags = [a.split('=', 1) if '=' in a else (a, a) for a in sys.argv[2:]]
SETS = [('test_L1', 'تسجيلاتك — سهل (L1)'), ('test_L2', 'تسجيلاتك — متوسط (L2)'), ('test_L3', 'تسجيلاتك — صعب (L3)'),
        ('ho_reciters', 'قرّاء جدد (8 مشاهير)'), ('ho_retasy', 'هواة من 63 شخص'), ('ho_retasy_wrong', 'هواة — تلاوات فيها أخطاء'),
        ('ho_noisy20', 'ضوضاء SNR 20'), ('ho_noisy10', 'ضوضاء SNR 10'), ('ho_noisy5', 'ضوضاء SNR 5'), ('ALL', 'الكل')]
S = {t: json.load(open(glob.glob(os.path.join(O, 'gate_' + t, 'summary-*.json'))[0], encoding='utf8')) for t, _ in tags}
def table(metric, title):
    h = '<h2>%s</h2><table><tr><th>المجموعة</th>%s</tr>' % (title, ''.join('<th>%s</th>' % html.escape(l) for _, l in tags))
    for k, name in SETS:
        b = S[tags[0][0]][k][metric]; h += '<tr><td>%s</td>' % name
        for i, (t, _) in enumerate(tags):
            v = S[t][k][metric]; d = v - b
            cls = '' if i == 0 else ('up' if d >= 0.5 else 'down' if d <= -0.5 else '')
            h += '<td class="%s">%.1f%s</td>' % (cls, v, '' if i == 0 else ' <small>(%+.1f)</small>' % d)
        h += '</tr>'
    return h + '</table>'
R = json.load(open(os.path.join(G, 'nv_curr.json'), encoding='utf8'))
curve = '<h2>منحنى التعلّم (CER %% على pipeline الموبايل، أقل = أحسن)</h2><table><tr><th>النقطة</th>%s</tr>' % ''.join('<th>%s</th>' % k for k in R['base'])
rows = [('base 5.7', R['base'])]
for lv in ('L1', 'L2', 'L3'):
    for k, v in R.get(lv, {}).items():
        if k.startswith('step'): rows.append(('%s %s' % (lv, k), v))
for n, r in rows: curve += '<tr><td>%s</td>%s</tr>' % (n, ''.join('<td>%s</td>' % r.get(k, '') for k in R['base']))
curve += '</table>'
page = '''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>P3 fine-tune report</title><style>body{font:16px/1.6 system-ui;margin:0 auto;max-width:1000px;padding:16px;background:#f7f5f0;color:#222}
table{border-collapse:collapse;width:100%%;margin:8px 0 24px;background:#fff;font-size:14px}th,td{border:1px solid #ddd;padding:5px 8px;text-align:center}
th{background:#1f4d3a;color:#fff}td:first-child{text-align:right}.up{background:#e3f4e8}.down{background:#fbe5e1}small{color:#666}
.box{background:#fff;border-right:4px solid #1f4d3a;padding:10px 14px;margin:12px 0}</style>
<h1>P3 — تدريب الموديل على تسجيلاتك (curriculum)</h1>%s%s%s%s%s</html>''' % (
    open(os.path.join(G, 'nv_report_notes.html'), encoding='utf8').read() if os.path.exists(os.path.join(G, 'nv_report_notes.html')) else '',
    table('verify_acc_%', 'التحقق من الكلمات (verify %) — pipeline الموبايل int8'),
    table('wrong_word_caught_%', 'كشف الكلمة الغلط (wrong caught %)'), table('ayah_id_top1_%', 'معرفة الآية (ayah id %)'), curve)
open(out, 'w', encoding='utf8').write(page); print('wrote', out)
