# P0b frozen held-out eval set (report only — never tune knobs on it). See D:\Quran App\progress.md "P0b".
# Usage: python -I make_heldout.py <quran_words.json> <tune_manifest_dir> <outdir> [stage ...]
#   stages: reciters retasy demand noisy   (default: all, in that order; each is resumable)
# Output manifests in <outdir>: ho_reciters.json, ho_retasy.json, ho_retasy_wrong.json, ho_noisy.json
#   same shape as the tune sets: {id, wav, set, reciter, s, a} (+ label, snr, env for the extra sets).
import sys, os, json, random, collections, subprocess, urllib.request, io, glob, zipfile
import numpy as np, soundfile as sf

QW, TUNE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
STAGES = sys.argv[4:] or ['reciters', 'retasy', 'demand', 'noisy']
UA = {'User-Agent': 'quran-karim-eval'}
os.makedirs(OUT, exist_ok=True)

def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    tmp = path + '.part'
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r, open(tmp, 'wb') as f:
        while True:
            b = r.read(1 << 20)
            if not b: break
            f.write(b)
    os.replace(tmp, path)

def to_wav(src, wav):  # src: path or bytes
    cmd = ['ffmpeg', '-v', 'error', '-y', '-i', 'pipe:0' if isinstance(src, bytes) else src, '-ac', '1', '-ar', '16000', wav]
    subprocess.run(cmd, input=src if isinstance(src, bytes) else None, check=True)

def dump(name, man):
    json.dump(man, open(os.path.join(OUT, name), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
    print(name, len(man))

# Ayat used anywhere in the tune sets (HA, tlog, reciters) are excluded, and so are their surahs for the reciter set.
tune = []
for m in [os.path.join(TUNE, 'ha.json'), os.path.join(TUNE, 'tlog.json'), os.path.join(TUNE, 'reciters', 'reciters.json')]:
    try:
        d = json.load(open(m, encoding='utf8'))
        if isinstance(d, list): tune += [x for x in d if isinstance(x, dict) and 's' in x]
    except Exception: pass
used_sa = {(x['s'], x['a']) for x in tune}; used_s = {x['s'] for x in tune}
print('tune clips', len(tune), 'surahs', len(used_s))


# RetaSy gives the surah by English name and the ayah as Arabic text: map to (s, a) by matching the normalised text
# (bench.py norm) against quran_words in that surah; non-Quran items (adhan, du'a, tashahhud...) are dropped.
import re, unicodedata, difflib
DIAC = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
def norm(t):
    t = unicodedata.normalize('NFKD', t); t = DIAC.sub('', t)
    t = re.sub('[ٱأإآ]', 'ا', t); t = re.sub('[ىی]', 'ي', t)
    t = t.replace('ة', 'ه').replace('ک', 'ك')
    t = re.sub(r'[^ء-ي\s]', '', t); return re.sub(r'\s+', ' ', t).strip()
SURAH = {'Al-Faatihah': 1, 'Ayat al-Kursi': 2, 'Al-NABAA': 78, 'Al-Asr': 103, 'Al-Humazah': 104, 'Al-Fil': 105,
         'Quraish': 106, 'Al-Maaoon': 107, 'Al-Kauthar': 108, 'Al-Kafiroon': 109, 'An-Nasr': 110, 'Al-Masad': 111,
         'Al-Ikhlas': 112, 'Al-Falaq': 113, 'An-Nas': 114, 'Al-Qadr': 97}
_QW = None
def find_sa(name, text):
    global _QW
    if name not in SURAH: return None
    if _QW is None: _QW = json.load(open(QW, encoding='utf8'))
    t = norm(text); best = (0, None)
    for x in _QW:
        if x['s'] != SURAH[name]: continue
        r = difflib.SequenceMatcher(None, t, ' '.join(x['w'])).ratio()
        if r > best[0]: best = (r, x['a'])
    return (SURAH[name], best[1]) if best[0] >= 0.8 else None

# A. 8 new everyayah reciters, 20 ayat each (3..20 words), surahs not in the tune sets (seed 11).
RECS = ['Abdurrahmaan_As-Sudais_192kbps', 'Saood_ash-Shuraym_128kbps', 'Abdullah_Basfar_192kbps',
        'ahmed_ibn_ali_al_ajamy_128kbps', 'Mohammad_al_Tablaway_128kbps', 'Hani_Rifai_192kbps',
        'Yasser_Ad-Dussary_128kbps', 'Muhammad_Jibreel_128kbps']
if 'reciters' in STAGES:
    ay = [x for x in json.load(open(QW, encoding='utf8'))
          if 3 <= len(x['w']) <= 20 and not (x['a'] == 1 and x['s'] != 9) and x['s'] not in used_s]
    print('candidate ayat (new surahs)', len(ay))
    d = os.path.join(OUT, 'reciters'); os.makedirs(os.path.join(d, 'mp3'), exist_ok=True); os.makedirs(os.path.join(d, 'wav'), exist_ok=True)
    rnd = random.Random(11); man = []
    for r in RECS:
        for x in rnd.sample(ay, 20):
            sa = '%03d%03d' % (x['s'], x['a']); cid = 'ho-%s-%s' % (r.split('_')[0][:12], sa)
            mp3 = os.path.join(d, 'mp3', cid + '.mp3'); wav = os.path.join(d, 'wav', cid + '.wav')
            try:
                if not os.path.exists(wav): get('https://everyayah.com/data/%s/%s.mp3' % (r, sa), mp3); to_wav(mp3, wav)
            except Exception as e:
                print('skip', cid, e); continue
            man.append({'id': cid, 'wav': wav, 'set': 'ho_reciters', 'reciter': r, 's': x['s'], 'a': x['a']})
    dump('ho_reciters.json', man)

# B. RetaSy crowd reciters (non-Arabic speakers, 81 countries). NO licence stated: local evaluation only, never train/ship.
#    correct: 200 clips, at most 1 per reciter_id; in_correct: 100 clips (real human-judged errors). 1.5..30 s, single ayah.
if 'retasy' in STAGES:
    import pyarrow.parquet as pq
    d = os.path.join(OUT, 'retasy'); os.makedirs(os.path.join(d, 'wav'), exist_ok=True)
    rows = []
    for i in range(3):
        f = os.path.join(d, 'train-%05d-of-00003.parquet' % i)
        get('https://huggingface.co/datasets/RetaSy/quranic_audio_dataset/resolve/main/data/train-%05d-of-00003.parquet' % i, f)
        t = pq.read_table(f, columns=['Surah', 'Aya', 'duration_ms', 'final_label', 'reciter_id', 'reciter_country',
                                      'reciter_gender', 'reciter_age'])
        for j, r in enumerate(t.to_pylist()): r['_f'] = f; r['_j'] = j; rows.append(r)
    print('retasy rows', len(rows))
    ok = [r for r in rows if r['final_label'] in ('correct', 'in_correct') and 1500 <= (r['duration_ms'] or 0) <= 30000
          and r['Surah'] and r['Aya']]
    for r in ok: r['_sa'] = find_sa(r['Surah'], r['Aya'])
    ok = [r for r in ok if r['_sa']]; print('retasy matched to an ayah', len(ok))
    rnd = random.Random(11); rnd.shuffle(ok)
    # only ~355 usable correct clips from 63 reciters exist, so up to 5 per reciter (diversity over volume)
    pick, per = {'correct': [], 'in_correct': []}, collections.Counter()
    for r in ok:
        lab = r['final_label']; want = 200 if lab == 'correct' else 100
        if len(pick[lab]) >= want or per[(lab, r['reciter_id'])] >= 5: continue
        pick[lab].append(r); per[(lab, r['reciter_id'])] += 1
    tables = {}
    for lab, name in (('correct', 'ho_retasy.json'), ('in_correct', 'ho_retasy_wrong.json')):
        man = []
        for r in pick[lab]:
            cid = 'rt-%s-%03d%03d-%d' % ('ok' if lab == 'correct' else 'bad', r['_sa'][0], r['_sa'][1], r['_j'])
            wav = os.path.join(d, 'wav', cid + '.wav')
            try:
                if not os.path.exists(wav):
                    if r['_f'] not in tables: tables[r['_f']] = pq.read_table(r['_f'], columns=['audio'])
                    to_wav(tables[r['_f']].column('audio')[r['_j']].as_py()['bytes'], wav)
            except Exception as e:
                print('skip', cid, e); continue
            man.append({'id': cid, 'wav': wav, 'set': 'ho_retasy' if lab == 'correct' else 'ho_retasy_wrong',
                        'reciter': str(r['reciter_id']), 's': r['_sa'][0], 'a': r['_sa'][1], 'label': lab,
                        'country': r['reciter_country'], 'gender': r['reciter_gender'], 'age': r['reciter_age']})
        dump(name, man)

# D. DEMAND real noise (Zenodo 1227121, CC BY 4.0): living room, kitchen, cafeteria (babble), car. Channel 1, 16 kHz.
ENVS = ['DLIVING', 'DKITCHEN', 'PCAFETER', 'TCAR']
if 'demand' in STAGES:
    d = os.path.join(OUT, 'demand'); os.makedirs(d, exist_ok=True)
    for e in ENVS:
        z = os.path.join(d, e + '_16k.zip'); w = os.path.join(d, e + '.wav')
        if os.path.exists(w): continue
        get('https://zenodo.org/records/1227121/files/%s_16k.zip?download=1' % e, z)
        with zipfile.ZipFile(z) as zf:
            ch = sorted(n for n in zf.namelist() if n.lower().endswith('ch01.wav'))[0]
            open(w, 'wb').write(zf.read(ch))
        os.remove(z); print('noise', e)

# Noisy copies of A + B(correct): each clip gets one env (round robin) at SNR 20, 10 and 5 dB (speech RMS over voiced part).
if 'noisy' in STAGES:
    d = os.path.join(OUT, 'noisy'); os.makedirs(d, exist_ok=True)
    noise = {e: sf.read(os.path.join(OUT, 'demand', e + '.wav'), dtype='float32')[0] for e in ENVS}
    base = json.load(open(os.path.join(OUT, 'ho_reciters.json'), encoding='utf8')) + \
           json.load(open(os.path.join(OUT, 'ho_retasy.json'), encoding='utf8'))
    rnd = np.random.RandomState(11); man = []
    for k, c in enumerate(base):
        y, sr = sf.read(c['wav'], dtype='float32'); e = ENVS[k % len(ENVS)]; n = noise[e]
        st = rnd.randint(0, len(n) - len(y) - 1); nz = n[st:st + len(y)]
        v = y[np.abs(y) > 0.02 * (np.abs(y).max() + 1e-9)]; ps = np.mean(v ** 2) + 1e-12; pn = np.mean(nz ** 2) + 1e-12
        for snr in (20, 10, 5):
            cid = '%s-%s-%d' % (c['id'], e, snr); wav = os.path.join(d, cid + '.wav')
            if not os.path.exists(wav):
                m = y + nz * np.sqrt(ps / (pn * 10 ** (snr / 10)))
                sf.write(wav, (m / max(1.0, np.abs(m).max())).astype(np.float32), sr, subtype='PCM_16')
            man.append(dict(c, id=cid, wav=wav, set='ho_noisy%d' % snr, env=e, snr=snr, src=c['set']))
    dump('ho_noisy.json', man)
print('done', STAGES)
