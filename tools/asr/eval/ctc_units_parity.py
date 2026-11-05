# Writes Python's units (p1b_verify.units) for every ayah + bench.norm of each vocab token, for ctc_units_parity.js.
# Usage: python -I ctc_units_parity.py <model.json> <quran_words.json> <quran-simple-search.json> rows-<tag>.json <lp dir> <out.json>
import sys, os, json, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
A = sys.argv; _t = os.path.join(tempfile.mkdtemp(), 'rows.json'); shutil.copy(A[4], _t)
sys.argv = [A[0], _t, A[5], A[1], A[2], A[3], '-', '3', '4', '1']
import p1b_verify as V
def un(i):
    try: return [[t, g] for t, g in V.units(i)]
    except TypeError: return None          # no path (word counts too far apart): the app falls back to its own words
U = {'%d:%d' % (x['s'], x['a']): un(i) for i, x in enumerate(V.ay)}
F = [V.bench.norm(t.replace('▁', ' ')).replace(' ', '') for t in json.load(open(A[1], encoding='utf8'))['vocab']]
json.dump({'units': U, 'forms': F, 'vocab': json.load(open(A[1], encoding='utf8'))['vocab']}, open(A[6], 'w', encoding='utf8'), ensure_ascii=False)
