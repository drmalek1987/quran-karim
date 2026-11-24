# Builds the speed-bench manifests from rates.json (rate_survey.py): real categories + atempo copies of murattal clips.
# Out (in D:\Quran App\qtrain\speedbench): manifest.json (all runs), audio/<id>@<speed>.wav, selection.json
import os, sys, json, random, subprocess
import numpy as np
ROOT = r'D:\Quran App'; W = os.path.join(ROOT, 'qtrain', 'speedbench'); AU = os.path.join(W, 'audio'); os.makedirs(AU, exist_ok=True)
R = json.load(open(os.path.join(W, 'rates.json'), encoding='utf8')); rnd = random.Random(7)
SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0]
NSYN_REC, NSYN_USR = 40, 24

def item(r, grp, wav=None, **kw):
    d = dict(id=r['id'] + kw.pop('suffix', ''), wav=wav or r['wav'], set=grp, src=r['src'], split=r['split'], wps=r['wps'], words=r['words'])
    if r.get('s'): d['s'], d['a'] = int(r['s']), int(r['a'])
    else: d['text'] = r['text']
    d.update(kw); return d

def atempo_chain(s):
    if s >= 1: f, c = [], s
    else: f, c = [], s
    out = []
    while c > 2.0 + 1e-9: out.append(2.0); c /= 2.0
    while c < 0.5 - 1e-9: out.append(0.5); c /= 0.5
    out.append(round(c, 6)); return ','.join('atempo=%s' % x for x in out)

def make(src, dst, s):
    if os.path.exists(dst): return
    if s == 1.0: cmd = ['ffmpeg', '-y', '-v', 'error', '-i', src, '-ac', '1', '-ar', '16000', dst]
    else: cmd = ['ffmpeg', '-y', '-v', 'error', '-i', src, '-ac', '1', '-ar', '16000', '-af', atempo_chain(s), dst]
    subprocess.run(cmd, check=True)

held = [r for r in R if r['split'] == 'heldout' and r['words'] >= 4]
man, sel = [], {}
# ---- real categories (held-out only = the model never trained on them) ----
cat = {'real_hadr': [r for r in held if r['wps'] >= 2.0],
       'real_mujawwad': [r for r in held if r['wps'] < 0.8],
       'real_murattal': [r for r in held if 1.0 <= r['wps'] < 1.6]}
rnd.shuffle(cat['real_murattal']); cat['real_murattal'] = cat['real_murattal'][:160]
seen = [r for r in R if r['split'] == 'train' and r['words'] >= 4 and r['wps'] >= 2.0]; rnd.shuffle(seen)
cat['real_hadr_trainseen'] = seen[:150]
for g, L in cat.items():
    sel[g] = len(L)
    for r in L: man.append(item(r, g, speed=None))
# ---- synthetic: murattal baselines x speeds ----
rec = [r for r in held if r['set'] == 'ho_reciters' and 0.8 <= r['wps'] <= 1.4 and 6 <= r['words'] <= 25]
usr = [r for r in held if r['set'] in ('test_L1', 'test_L2') and 1.1 <= r['wps'] <= 1.8 and 6 <= r['words'] <= 20]
by = {}
for r in rec: by.setdefault(r['src'], []).append(r)
pick = []
for k in sorted(by):                       # equal share per reciter
    rnd.shuffle(by[k]); pick += by[k][:NSYN_REC // len(by)]
rnd.shuffle(usr); pick += usr[:NSYN_USR]
sel['syn_base_clips'] = len(pick); sel['syn_reciters'] = sorted(by)
sel['syn_ids'] = [r['id'] for r in pick]
for r in pick:
    for s in SPEEDS:
        dst = os.path.join(AU, '%s@%s.wav' % (r['id'].replace(',', '').replace(' ', '_'), s))
        make(r['wav'], dst, s)
        man.append(item(r, 'syn_%gx' % s, wav=dst, suffix='@%g' % s, speed=s))
json.dump(man, open(os.path.join(W, 'manifest.json'), 'w', encoding='utf8'), ensure_ascii=False)
json.dump(sel, open(os.path.join(W, 'selection.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(man), {k: v for k, v in sel.items() if isinstance(v, int)})
