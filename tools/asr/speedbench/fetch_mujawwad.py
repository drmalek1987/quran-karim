# Eval-only real mujawwad / hadr clips from everyayah.com (held-out: never train on these). -> qtrain/speedbench/mujawwad/
# Usage: python -I fetch_mujawwad.py   (writes manifest_real2.json; probes hadr candidates and keeps those >= 1.9 words/s)
import os, json, subprocess, urllib.request
import soundfile as sf
QT = r'D:\Quran App\qtrain'; OUT = os.path.join(QT, 'speedbench', 'mujawwad')
QW = {(x['s'], x['a']): x['w'] for x in json.load(open(os.path.join(QT, 'eval', 'quran_words.json'), encoding='utf8'))}
MUJ = ['Abdul_Basit_Mujawwad_128kbps', 'Minshawy_Mujawwad_192kbps']
MUJ_AY = [(1, a) for a in range(2, 8)] + [(97, a) for a in range(1, 6)] + [(93, a) for a in range(1, 12)] + [(86, a) for a in range(1, 18)]
HADR = ['Nasser_Alqatami_128kbps', 'Salah_Al_Budair_128kbps', 'Ali_Jaber_64kbps', 'Muhammad_AbdulKareem_128kbps',
        'Abdullaah_3awwaad_Al-Juhaynee_128kbps', 'Akram_AlAlaqimy_128kbps', 'Khaalid_Abdullaah_al-Qahtaanee_192kbps', 'Ahmed_Neana_128kbps']
HADR_AY = [(2, a) for a in range(255, 258)] + [(18, a) for a in range(1, 11)] + [(67, a) for a in range(1, 16)]
def get(rec, s, a):
    sa = '%03d%03d' % (s, a); d = os.path.join(OUT, rec); os.makedirs(d, exist_ok=True)
    mp3, wav = os.path.join(d, sa + '.mp3'), os.path.join(d, sa + '.wav')
    if not os.path.exists(wav):
        req = urllib.request.Request('https://everyayah.com/data/%s/%s.mp3' % (rec, sa), headers={'User-Agent': 'eval-client'})
        open(mp3, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', '16000', wav], check=True); os.remove(mp3)
    dur = sf.info(wav).duration; n = len(QW[(s, a)])
    return dict(id='ea-%s-%s' % (rec.split('_')[0][:12] + rec.split('_')[1][:4], sa), wav=wav, s=s, a=a, src=rec, words=n, dur_s=round(dur, 2), wps=round(n / max(0.5, dur - 0.6), 2))
man = []
for r in MUJ:
    for s, a in MUJ_AY:
        try: man.append(dict(get(r, s, a), set='real_mujawwad_ea'))
        except Exception as e: print('skip', r, s, a, e)
rates = {}
for r in HADR:
    try: probe = [get(r, s, a) for s, a in HADR_AY[:3]]
    except Exception as e: print('no', r, e); continue
    rates[r] = sum(x['words'] for x in probe) / sum(max(0.5, x['dur_s'] - 0.6) for x in probe); print(r, round(rates[r], 2))
fast = [r for r, v in sorted(rates.items(), key=lambda kv: -kv[1]) if v >= 1.9][:2]
for r in fast:
    for s, a in HADR_AY:
        try:
            x = get(r, s, a)
            if x['words'] >= 4: man.append(dict(x, set='real_hadr_ea'))
        except Exception as e: print('skip', r, s, a, e)
json.dump(man, open(os.path.join(QT, 'speedbench', 'manifest_real2.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
import collections; print(collections.Counter(x['set'] for x in man), 'fast:', fast)
for g in ('real_mujawwad_ea', 'real_hadr_ea'):
    L = [x['wps'] for x in man if x['set'] == g]; print(g, len(L), 'mean wps', round(sum(L) / max(1, len(L)), 2))
