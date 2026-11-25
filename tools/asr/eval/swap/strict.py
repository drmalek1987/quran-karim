# Experiment (Sprint 5b B): rsame_strict = bench.rsame, but False when an optimal edit between the two skeletons contains a
# substitution whose letter pair is in a confusion set. "Contains" = SOME optimal alignment has it (ties are OR-ed), the
# conservative reading. JS twin: rlocal_spans_swap.js (same DP).
P4 = [('ض','د'), ('ص','س'), ('ح','ه'), ('ق','ك')]
P8 = P4 + [('ذ','ز'), ('ث','س'), ('ظ','ض'), ('ط','ت')]
def pairset(pairs): return {a + b for a, b in pairs} | {b + a for a, b in pairs}
VARIANTS = {'base': set(), 'P4': pairset(P4), 'P8': pairset(P8)}

def make_rsame(conf):
    """conf: set of 2-char strings (both orders). Empty -> identical to bench.rsame."""
    def rsame(a, b):
        if not a or not b: return False
        if a == b: return True
        m, n = len(a), len(b)
        d = list(range(n + 1)); f = [False] * (n + 1)          # d: edit distance row, f: some optimal path has a confusion sub
        for i in range(1, m + 1):
            pd, pf = d[0], f[0]; d[0] = i; f[0] = False
            for j in range(1, n + 1):
                td, tf = d[j], f[j]
                c = pd + (a[i - 1] != b[j - 1]); cf = pf or (a[i - 1] != b[j - 1] and (a[i - 1] + b[j - 1]) in conf)
                best = c; bf = cf
                u = td + 1
                if u < best: best, bf = u, tf
                elif u == best: bf = bf or tf
                l = d[j - 1] + 1
                if l < best: best, bf = l, f[j - 1]
                elif l == best: bf = bf or f[j - 1]
                d[j], f[j] = best, bf; pd, pf = td, tf
        if 1 - d[n] / max(m, n) < 0.6: return False
        return not f[n]
    return rsame
