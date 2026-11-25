# Loads p1b_verify's lexicon/unit helpers without running its CLI (same trick as p1b_port_eval.py).
import sys, os, json, tempfile, shutil
EV = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def load(rows, lpd, model, qw, simp):
    sys.path.insert(0, EV)
    t = os.path.join(tempfile.mkdtemp(), 'rows.json'); shutil.copy(rows, t)
    old = sys.argv; sys.argv = [old[0], t, lpd, model, qw, simp, '-', '3', '4', '1']
    import p1b_verify as V
    sys.argv = old
    return {'V': V, 'lex': V.lex, 'fw': [V.ay[i]['w'][j] for i, j in V.flat]}
