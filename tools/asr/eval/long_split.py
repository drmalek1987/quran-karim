# Train / held-out split of the long recordings BY WHOLE FILE GROUP (same reader + same day stay together), from the
# user's readers-sheet.csv. Two readers are held out entirely (new-voice test). Writes split.json and prints hours per
# split x level x reader. Usage: python -I long_split.py <long out dir> <readers-sheet.csv>
import sys, os, json, csv, re, collections
od, sheet = sys.argv[1], sys.argv[2]
HELD = ['يونس وهود', 'Aug 14, 6.36 PM', 'Aug 14, 6.47 PM', 'Aug 14, 6.50 PM', 'May 22, 8.27 PM', 'May 22, 8.30 PM',
        'May 22, 8.33 PM', 'تهجد 3 ختام', 'Mar 17, 7.33 PM', 'Mar 17, 8.30 PM', 'تراويح 2025 ، مسجد الايمان 1',
        'قيام 2024 9', 'Jul 29, 8.17 PM', 'Mar 13, 7.53 PM']           # last two: sheikh2, sheikh3 = unseen readers
info = {}
for r in list(csv.reader(open(sheet, encoding='utf-8-sig')))[1:]:
    base = os.path.splitext(r[0])[0].strip()
    info[base] = {'reader': r[2].strip().lower(), 'mic': r[3].strip().lower(), 'place': r[4].strip().lower(), 'notes': r[5]}
import random
random.seed(7)
split, clips = {}, []
for mf in sorted(os.listdir(od)):
    if not mf.endswith('.json') or mf in ('noise.json', 'split.json', 'refine.json', 'clips.json'): continue
    base = mf[:-5]; key = next((k for k in info if k.replace(' ', '') == base.replace(' ', '')), None)
    assert key, base
    sp = 'test' if any(h.replace(' ', '') == base.replace(' ', '') for h in HELD) else 'train'
    split[base] = {'split': sp, **info[key]}
    for c in json.load(open(os.path.join(od, 'refined', mf), encoding='utf8')):
        if 'drop' not in c: c['split'] = sp; clips.append(c)
# A10 (train only): each ayah <= 8 clips per reader, then each reader <= 35% of train seconds; 'known' clips go first
tr = [c for c in clips if c['split'] == 'train']; random.shuffle(tr)
tr.sort(key=lambda c: c['zone'] != 'known')            # known first = dropped first
per, keep = collections.Counter(), []
for c in reversed(tr):
    k = (c['reader'], tuple(c['from'][:2]))
    if per[k] < 8: per[k] += 1; keep.append(c)
    else: c['drop'] = 'A10 ayah cap'
# reader balance by SAMPLING weight, not by dropping: w_r so that each reader <= 35% of the weighted seconds; the
# trainer samples clip c with prob ~ w; every clip stays usable across epochs
for c in keep: c['w'] = 1.0
for _ in range(20):
    sec = collections.Counter(); [sec.update({c['reader']: c['dur'] * c['w']}) for c in keep]
    tot = sum(sec.values()); rd, s = sec.most_common(1)[0]
    if s <= .35 * tot * 1.001: break
    f = .35 / .65 * (tot - s) / s
    for c in keep:
        if c['reader'] == rd: c['w'] = round(c['w'] * f, 4)
json.dump(split, open(os.path.join(od, 'split.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
json.dump(clips, open(os.path.join(od, 'clips.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
H = collections.defaultdict(float)
for c in clips:
    k = c.get('drop', 'kept'); H[(c['split'], k, c['level'])] += c['dur'] / 3600
    if k == 'kept': H[(c['split'], 'reader', c['reader'])] += c['dur'] / 3600; H[(c['split'], 'weighted', c['reader'])] += c['dur'] * c.get('w', 1) / 3600
for k in sorted(H, key=str): print(k, round(H[k], 2))
