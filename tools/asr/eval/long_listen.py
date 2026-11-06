# P3 CP2 (A9 audit): listen pages for the user. listen-L1/L2/L3.html = 100 random kept train clips per level;
# listen-imams.html = imam 'review' pieces (train files) that failed the auto gates, so the ear decides.
# Keys: J / → = ✓ correct, F / ← = ✗ wrong, Space = replay, S = skip. Marks live in localStorage; "Export" saves a json
# the user puts back into <od>/marks/. Usage: python -I long_listen.py <long out dir>
import sys, os, json, random, html
od = sys.argv[1]; random.seed(11)
clips = json.load(open(os.path.join(od, 'clips.json'), encoding='utf8'))
split = json.load(open(os.path.join(od, 'split.json'), encoding='utf8'))
rel = lambda p: os.path.relpath(p, od).replace('\\', '/')
sets = {}
for L in ('L1', 'L2', 'L3'):
    pool = [c for c in clips if c['split'] == 'train' and 'drop' not in c and c['level'] == L]
    sets[L] = [{'id': c['id'], 'wav': rel(c['wav']), 'text': c['text'], 'hyp': c.get('hyp', ''), 'reader': c['reader'],
                'aya': '%d:%d' % tuple(c['from'][:2])} for c in random.sample(pool, min(100, len(pool)))]
im = []
for base, s in split.items():
    if s['split'] != 'train' or not s['reader'].startswith('sheikh'): continue
    for r in json.load(open(os.path.join(od, base + '.json'), encoding='utf8')):
        if r.get('use') == 'review' and r.get('conf') in ('high', 'mid'):
            im.append({'id': r['id'], 'wav': rel(r['wav']), 'text': r['text'], 'hyp': r['hyp'], 'reader': s['reader'],
                       'aya': '%d:%d' % tuple(r['from'][:2])})
sets['imams'] = im
if len(sys.argv) > 2 and sys.argv[2] == 'top':  # top-up: unmarked train clips of a level until it has 100 marks
    L = sys.argv[3] if len(sys.argv) > 3 else 'L3'
    M = {}
    for f in os.listdir(os.path.join(od, 'marks')):
        if f.endswith('.json'): M.update(json.load(open(os.path.join(od, 'marks', f), encoding='utf8')))
    marked = sum(1 for c in clips if c['id'] in M and c['level'] == L)
    pool = [c for c in clips if c['split'] == 'train' and 'drop' not in c and c['level'] == L and c['id'] not in M]
    sets = {L + 'top': [{'id': c['id'], 'wav': rel(c['wav']), 'text': c['text'], 'hyp': c.get('hyp', ''), 'reader': c['reader'],
                         'aya': '%d:%d' % tuple(c['from'][:2])} for c in random.sample(pool, min(max(0, 100 - marked), len(pool)))]}
PAGE = '''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>مراجعة %(name)s</title>
<style>body{font:18px/1.7 system-ui;margin:0;background:#f6f4ef}header{position:sticky;top:0;background:#1f4d3a;color:#fff;padding:10px 16px;display:flex;gap:16px;align-items:center}
button{font:inherit;padding:4px 12px}main{max-width:900px;margin:auto;padding:12px}.c{background:#fff;border-radius:8px;padding:10px 14px;margin:8px 0;border:3px solid transparent}
.c.cur{border-color:#c9a227}.c.ok{background:#e6f4ea}.c.bad{background:#fbe9e7}.t{font-size:24px;font-family:"Amiri","Traditional Arabic",serif}.h{color:#777;font-size:14px}.m{font-size:13px;color:#555}</style>
<header><b>%(name)s</b><span id="cnt"></span><span>J(ت)/→ صح · F/← غلط · Space إعادة · S تخطي</span><button onclick="exp()">Export</button></header><main id="m"></main>
<script>const D=%(data)s,K="qk.listen.%(name)s",M=JSON.parse(localStorage[K]||"{}");let i=0;const m=document.getElementById("m");
D.forEach((d,n)=>{const e=document.createElement("div");e.className="c";e.id="c"+n;e.innerHTML=`<div class="m">${n+1} · ${d.reader} · ${d.aya}</div><div class="t">${d.text}</div><div class="h">الموديل سمع: ${d.hyp}</div><audio controls preload="none" tabindex="-1" src="${d.wav}"></audio> <button onclick="event.stopPropagation();i=${n};mark(1)">✓ صح</button> <button onclick="event.stopPropagation();i=${n};mark(0)">✗ غلط</button>`;e.onclick=()=>go(n);m.appendChild(e)});
function paint(){D.forEach((d,n)=>{const e=document.getElementById("c"+n);e.classList.toggle("ok",M[d.id]===1);e.classList.toggle("bad",M[d.id]===0);e.classList.toggle("cur",n===i)});
const v=Object.values(M);document.getElementById("cnt").textContent=`${v.length}/${D.length} · ✓ ${v.filter(x=>x===1).length} · ✗ ${v.filter(x=>x===0).length}`}
function go(n){document.querySelectorAll("audio").forEach(a=>a.pause());i=Math.max(0,Math.min(D.length-1,n));const e=document.getElementById("c"+i);e.scrollIntoView({block:"center"});const a=e.querySelector("audio");a.currentTime=0;a.play();paint()}
function mark(v){M[D[i].id]=v;localStorage[K]=JSON.stringify(M);go(i+1)}
document.addEventListener("keydown",e=>{const c=e.code;let h=1;if(c==="KeyJ"||c==="ArrowRight")mark(1);else if(c==="KeyF"||c==="ArrowLeft")mark(0);else if(c==="Space")go(i);else if(c==="KeyS")go(i+1);else h=0;if(h){e.preventDefault();e.stopPropagation()}},true);
document.addEventListener("focusin",e=>{if(e.target.tagName==="AUDIO")e.target.blur()});
function exp(){const b=new Blob([JSON.stringify(M)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="marks-%(name)s.json";a.click()}paint();</script>'''
os.makedirs(os.path.join(od, 'marks'), exist_ok=True)
for name, d in sets.items():
    open(os.path.join(od, 'listen-%s.html' % name), 'w', encoding='utf8').write(PAGE % {'name': name, 'data': json.dumps(d, ensure_ascii=False)})
    print(name, len(d), round(sum(1 for _ in d)), flush=True)
