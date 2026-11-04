# Eval set "any reciter": N random ayat (3..20 words, seed 7) from several everyayah.com reciters -> 16 kHz mono wav.
# Usage: python -I fetch_reciters.py <quran_words.json> <outdir>
import sys, os, json, random, subprocess, urllib.request
QW, OUT = sys.argv[1], sys.argv[2]
RECS = ['Alafasy_128kbps', 'Husary_128kbps', 'Minshawy_Murattal_128kbps', 'Abdul_Basit_Murattal_192kbps',
        'MaherAlMuaiqly128kbps', 'Hudhaify_128kbps', 'Muhammad_Ayyoub_128kbps', 'Ghamadi_40kbps']
N = 20
ay = [x for x in json.load(open(QW, encoding='utf8')) if 3 <= len(x['w']) <= 20 and not (x['a'] == 1 and x['s'] != 9)]
os.makedirs(os.path.join(OUT, 'mp3'), exist_ok=True); os.makedirs(os.path.join(OUT, 'wav'), exist_ok=True)
rnd = random.Random(7); man = []
for r in RECS:
    for x in rnd.sample(ay, N):
        sa = '%03d%03d' % (x['s'], x['a']); cid = 'r-%s-%s' % (r.split('_')[0][:10], sa)
        mp3 = os.path.join(OUT, 'mp3', cid + '.mp3'); wav = os.path.join(OUT, 'wav', cid + '.wav')
        if not os.path.exists(wav):
            try:
                req = urllib.request.Request('https://everyayah.com/data/%s/%s.mp3' % (r, sa), headers={'User-Agent': 'quran-karim-eval'})
                open(mp3, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', '16000', wav], check=True)
            except Exception as e:
                print('skip', cid, e); continue
        man.append({'id': cid, 'wav': wav, 'set': 'reciters', 'reciter': r, 's': x['s'], 'a': x['a']})
json.dump(man, open(os.path.join(OUT, 'reciters.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print('clips', len(man))
