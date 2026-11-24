# Aggregates bench_speed rows (+ optional p1b_port_eval ctc_up log) into results.json. Usage: aggregate.py <out dir> <results.json> [port.log]
import sys, os, json, re, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'eval'))
import bench as B
out, dst = sys.argv[1], sys.argv[2]; port = sys.argv[3] if len(sys.argv) > 3 else None
rows = [r for r in json.load(open(os.path.join(out, 'rows.json'), encoding='utf8')) if 'skip' not in r]
def agg(R):
    N = sum(r['nwords'] for r in R); full = [r for r in R if r['full']]
    nf = sum(r['nwords'] for r in full); cc = sum(len(B.norm(r['ref'])) for r in full)
    ms = [m for r in R for m in r['ms']]; pl = [p for r in R for p in r['plen']]
    A = {k: sum(r['align'][k] for r in R) for k in ('ok', 'sub', 'del', 'ins', 'merge', 'split')}
    neg = [r['neg'][r['neg_j']] == 0 for r in R]
    d = dict(clips=len(R), words=N, audio_s=round(sum(r['asec'] for r in R)),
             median_wps=round(float(np.median([r['wps'] for r in R if r.get('wps')] or [0])), 2) if any(r.get('wps') for r in R) else None,
             wer_pct=round(100 * sum(r['wer'] * r['nwords'] for r in full) / nf, 1) if nf else None,
             cer_pct=round(100 * sum(r['cer'] * len(B.norm(r['ref'])) for r in full) / cc, 1) if cc else None,
             wer_skel_pct=round(100 * sum(r['wer_sk'] * r['nwords'] for r in R) / N, 1),
             cer_skel_pct=round(100 * sum(r['cer_sk'] * r['nwords'] for r in R) / N, 1),
             wer_skel_novad_pct=round(100 * sum((r['wer_sk_novad'] if r['wer_sk_novad'] is not None else r['wer_sk']) * r['nwords'] for r in R) / N, 1),
             tracking_pct=round(100 * sum(r['right'] for r in R) / N, 1), unreached_pct=round(100 * sum(r['unreached'] for r in R) / N, 1),
             clips_all_right_pct=round(100 * sum(r['right'] == r['nwords'] for r in R) / len(R), 1),
             lost_derail=sum(r['derail'] for r in R), lost_stall=sum(r['stall'] for r in R), lost_piece=sum(r['lostp'] for r in R),
             lost_clips_pct=round(100 * sum(1 for r in R if r['derail'] or r['stall'] or r['lostp']) / len(R), 1),
             wrong_caught_pct=round(100 * sum(neg) / len(R), 1), verify_acc_pct=round(100 * (sum(r['right'] for r in R) + sum(neg)) / (N + len(R)), 1),
             ayah_id_pct=round(100 * sum(r['id_ok'] for r in R) / len(R), 1),
             rtf=round(sum(ms) / 1000 / max(1e-9, sum(r['asec'] for r in R)), 4), rtf_vs_piece=round(sum(ms) / 1000 / max(1e-9, sum(pl)), 4),
             chunk_ms_mean=round(float(np.mean(ms)), 1) if ms else None, chunk_ms_p95=round(float(np.percentile(ms, 95)), 1) if ms else None,
             chunk_s_mean=round(float(np.mean(pl)), 2) if pl else None,
             pieces_per_clip=round(float(np.mean([r['n_pieces_vad'] for r in R])), 2), empty_pieces=sum(r['n_empty'] for r in R),
             dropped_speech_pct=round(100 * sum(r['dropped_speech_s'] for r in R) / max(1e-9, sum(r['speech_s'] for r in R)), 2),
             midword_splits=sum(r['midcut'] for r in R), cap_cuts=sum(r['ncap'] for r in R),
             merges_per100w=round(100 * A['merge'] / N, 2), splits_per100w=round(100 * A['split'] / N, 2),
             sub_per100w=round(100 * A['sub'] / N, 1), del_per100w=round(100 * A['del'] / N, 1), ins_per100w=round(100 * A['ins'] / N, 1))
    return d
res = {}
for g in sorted({r['set'] for r in rows}): res[g] = agg([r for r in rows if r['set'] == g])
if port and os.path.exists(port):
    for line in open(port, encoding='utf8'):
        if line.startswith('ctc_up '):
            for g, v in json.loads(line[7:]).items():
                if g in res: res[g]['ctc_up_verify_pct'] = v['verify']; res[g]['ctc_up_right_acc_pct'] = v['right_acc']; res[g]['ctc_up_wrong_caught_pct'] = v['wrong_caught']
json.dump(res, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for g, v in res.items(): print(g, v['clips'], 'wer_sk', v['wer_skel_pct'], 'wer', v['wer_pct'], 'track', v['tracking_pct'], 'lost', v['lost_derail'], v['lost_stall'], v['lost_piece'], 'rtf', v['rtf'], 'ms', v['chunk_ms_mean'])

# synthetic rows binned by the speech rate they end up with (base wps x tempo), and by source family
def fam(r): return 'reciters' if 'kbps' in (r.get('src') or '') else 'user'
syn = [r for r in rows if r['set'].startswith('syn_')]
bins = [(0, .5), (.5, .8), (.8, 1.2), (1.2, 1.6), (1.6, 2.0), (2.0, 2.5), (2.5, 3.0), (3.0, 4.0), (4.0, 99)]
res['_syn_by_effective_wps'] = {}
for lo, hi in bins:
    R = [r for r in syn if lo <= r['wps'] * r['speed'] < hi]
    if len(R) >= 8: res['_syn_by_effective_wps']['%g-%g' % (lo, hi)] = agg(R)
res['_syn_by_family'] = {f + '@' + str(s): agg([r for r in syn if fam(r) == f and r['speed'] == s]) for f in ('reciters', 'user') for s in (0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0) if [r for r in syn if fam(r) == f and r['speed'] == s]}
json.dump(res, open(dst, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
for k, v in res['_syn_by_effective_wps'].items(): print('eff', k, v['clips'], 'wer_sk', v['wer_skel_pct'], 'track', v['tracking_pct'], 'derail/stall/lostp', v['lost_derail'], v['lost_stall'], v['lost_piece'])
for k, v in res['_syn_by_family'].items(): print('fam', k, v['clips'], 'wer_sk', v['wer_skel_pct'], 'track', v['tracking_pct'], 'medwps', v['median_wps'])
