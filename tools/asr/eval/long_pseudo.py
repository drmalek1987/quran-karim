# Pseudo-labels from long recitation recordings (no transcript): VAD pieces -> phone model log-probs -> place each piece in
# the Quran (trigram shortlist + continuity with the previous piece, then CTC local_align on that window) -> label =
# the Quran words the piece covers, with a confidence. Output: 16 kHz wav per piece + manifest json + html report.
# Usage: python -I long_pseudo.py <audio file> <out dir> <model.onnx> <model.json> <quran_words.json> <quran-simple-search.json>
import sys, os, json, subprocess, time, html
import numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bench, ctc
SR = bench.SR

def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

def segment(y, vmin=0.0015):
    """100 ms blocks, adaptive floor like the app. A piece ends at 0.8 s quiet, or 0.4 s quiet once it is > 6 s, or at the
    quietest block after 18 s (hard cap 22 s). Returns [(start_s, end_s)] with 0.2 s margins."""
    blk = SR // 10; n = len(y) // blk
    e = np.sqrt((y[:n * blk].reshape(n, blk) ** 2).mean(1))
    floor = 0.004; sp = np.zeros(n, bool)
    for i in range(n):
        floor = e[i] if e[i] < floor else floor * 0.995 + e[i] * 0.005
        sp[i] = e[i] > max(vmin, floor * 3)
    out, s, q, v = [], None, 0, 0
    for i in range(n):
        if s is None:
            if sp[i]: s, q, v = i, 0, 1
            continue
        if sp[i]: q = 0; v += 1
        else: q += 1
        ln = i - s
        if q >= 8 or (ln > 60 and q >= 4) or ln >= 220 or (ln >= 180 and e[i] <= e[s + 150:i + 1].min()):
            end = i - q + 1
            if v >= 5: out.append((max(0, s - 2) / 10, min(n, end + 2) / 10))
            s = None
    if s is not None and v >= 5: out.append((max(0, s - 2) / 10, n / 10))
    return out

def main():
    src, od = sys.argv[1], sys.argv[2]
    M = bench.Model(sys.argv[3], sys.argv[4]); Qr = bench.Quran(sys.argv[5], sys.argv[6])
    lex = ctc.Lex(M.vocab)
    simp = json.load(open(sys.argv[6], encoding='utf8'))['quran']
    keys = [(v['chapter'], v['verse']) for v in simp]; kidx = {k: i for i, k in enumerate(keys)}
    words = [v['text'].split() for v in simp]
    # the simple text glues the basmala to ayah 1 of most suras: keep it (reciters do say it) but it is its own 4 words
    wl = [[lex.text(w) for w in ws] for ws in words]
    os.makedirs(os.path.join(od, 'wav'), exist_ok=True)
    y = load(src); t0 = time.time(); segs = segment(y)
    print('audio %.1f min, pieces %d' % (len(y) / SR / 60, len(segs)), flush=True)
    rows, prev, keep, miss = [], None, None, 0
    NONQ = {'الله اكبر', 'سمع الله لمن حمده', 'امين', 'ربنا ولك الحمد', 'السلام عليكم ورحمه الله'}
    base = os.path.splitext(os.path.basename(src))[0].replace('​', '').strip()
    for n, (a, b) in enumerate(segs):
        pc = y[int(a * SR):int(b * SR)]
        r = float(np.sqrt((pc * pc).mean())) or 1e-9; g = 10 ** (-30 / 20) / r
        pc_m = np.clip(pc * min(g, 30.0), -1, 1).astype(np.float32) if g > 1 else pc
        lp = M.logprobs(pc_m); hyp = M.greedy(lp)
        row = {'n': n, 't0': a, 't1': b, 'hyp': hyp}
        cand = set()
        gi = Qr.identify(hyp) if len(hyp) >= 4 else None
        if gi is not None:
            k = (Qr.ay[gi]['s'], Qr.ay[gi]['a']); cand.add(kidx[k])
        if prev is not None: cand.add(prev)
        if not cand or len(hyp.replace(' ', '')) < 4:
            row['skip'] = 'no text'; rows.append(row); miss += 1
            if miss >= 3: prev = keep = None
            continue
        G, stay, mx = lex.group(lp); best = None
        for c in cand:
            lo, hi = max(0, c - 2), min(len(keys), c + 7)
            # window as word list (keeping only one sura so '|' issues do not arise)
            sura = keys[c][0]; W = [(i, j) for i in range(lo, hi) if keys[i][0] == sura for j in range(len(wl[i]))]
            s = ''.join(wl[i][j] for i, j in W); tg = ctc.Target(lex, s)
            sc, ca, cb = ctc.local_align(G, stay, mx, tg, 3.0)
            if best is None or sc > best[0]: best = (sc, ca, cb, W, s)
        sc, ca, cb, W, s = best
        # chars -> words: a word is in the label if at least half of its letters are inside [ca, cb)
        pos, lab = 0, []
        for i, j in W:
            L = len(wl[i][j]); ov = max(0, min(cb, pos + L) - max(ca, pos))
            if L and ov * 2 >= L: lab.append((i, j))
            pos += L
        if not lab: row['skip'] = 'no words'; rows.append(row); continue
        if any(bench.norm(x) in bench.norm(hyp) for x in NONQ) and len(lab) <= 3: row['skip'] = 'prayer phrase'; rows.append(row); continue
        text = ' '.join(words[i][j] for i, j in lab)
        cer = bench.lev(bench.norm(hyp).replace(' ', ''), lex.text(text)) / max(1, len(lex.text(text)))
        per = sc / max(1, len(lp))
        row.update({'text': text, 'from': list(keys[lab[0][0]]) + [lab[0][1]], 'to': list(keys[lab[-1][0]]) + [lab[-1][1]],
                    'score_pf': round(per, 3), 'cer': round(cer, 3)})
        row['conf'] = 'high' if cer <= 0.15 and per > -0.5 else 'mid' if cer <= 0.35 else 'low'
        if len(lab) < 2 and row['conf'] != 'low': row['conf'] = 'mid'
        prev = lab[-1][0] if lab[-1][1] == len(wl[lab[-1][0]]) - 1 and lab[-1][0] + 1 < len(keys) else lab[-1][0]
        if row['conf'] == 'low': prev = keep
        else: keep, miss = prev, 0
        wid = '%s-%04d' % (base, n); row['id'] = wid
        sf.write(os.path.join(od, 'wav', wid + '.wav'), pc, SR, subtype='PCM_16'); row['wav'] = os.path.join(od, 'wav', wid + '.wav')
        rows.append(row)
        if (n + 1) % 25 == 0: print(n + 1, '%.0f s' % (time.time() - t0), flush=True)
    json.dump(rows, open(os.path.join(od, base + '.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    dur = lambda R: sum(r['t1'] - r['t0'] for r in R) / 60
    C = {c: [r for r in rows if r.get('conf') == c] for c in ('high', 'mid', 'low')}; sk = [r for r in rows if 'skip' in r]
    summ = {'file': base, 'audio_min': round(len(y) / SR / 60, 1), 'pieces': len(rows), 'sec': round(time.time() - t0),
            **{c + '_min': round(dur(R), 1) for c, R in C.items()}, **{c + '_n': len(R) for c, R in C.items()},
            'skip_n': len(sk), 'skip_min': round(dur(sk), 1)}
    print(json.dumps(summ), flush=True)
    E = html.escape
    tr = ''.join('<tr class="%s"><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td><audio controls preload="none" src="%s"></audio></td></tr>' % (
        r.get('conf', 'skip'), r['n'], '%d:%02d' % divmod(int(r['t0']), 60), E(r.get('conf', r.get('skip', ''))),
        '%s:%s' % tuple(r['from'][:2]) if 'from' in r else '', E(r['hyp']), E(r.get('text', '')),
        'wav/' + r['id'] + '.wav' if 'id' in r else '') for r in rows)
    open(os.path.join(od, base + '.html'), 'w', encoding='utf8').write(
        '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>%s</title><style>body{font:15px/1.6 system-ui;margin:16px}'
        'td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top}.high td:nth-child(3){color:#1f7a4d}.mid td:nth-child(3){color:#a86b00}'
        '.low td:nth-child(3),.skip td:nth-child(3){color:#b3261e}audio{height:28px;width:180px}</style><h2>%s</h2><pre dir="ltr">%s</pre>'
        '<table><tr><th>#</th><th>وقت</th><th>ثقة</th><th>آية</th><th>الموديل سمع</th><th>الـ label</th><th></th></tr>%s</table>' % (
            E(base), E(base), E(json.dumps(summ, ensure_ascii=False, indent=1)), tr))

if __name__ == '__main__': main()
