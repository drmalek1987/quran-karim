# Compare gate summaries (bench.py phone pipeline, verify_acc_% / wrong_word_caught_%) with the shipped 5.7 (gate_base57)
# and apply plan D/H gates. Usage: python nv_cmp.py L1 [L2 ...]
import sys, json, os
O = r'D:\Quran App\qtrain\eval\out'
def S(tag): return json.load(open(os.path.join(O, 'gate_' + tag, 'summary-%s.json' % tag), encoding='utf8'))
b = S('base57')
SETS = ['test_L1', 'test_L2', 'test_L3', 'ho_reciters', 'ho_retasy', 'ho_retasy_wrong', 'ho_noisy20', 'ho_noisy10', 'ho_noisy5', 'ALL']
for tag in sys.argv[1:]:
    s = S(tag); print('== %s vs 5.7 (verify %% | wrong caught %% | ayah id %%)' % tag)
    for k in SETS:
        if k in s and k in b:
            f = lambda d, m: d[k][m]
            print('  %-16s %5.1f -> %5.1f (%+.1f) | %5.1f -> %5.1f | %5.1f -> %5.1f' % (k, f(b, 'verify_acc_%'), f(s, 'verify_acc_%'),
                  f(s, 'verify_acc_%') - f(b, 'verify_acc_%'), f(b, 'wrong_word_caught_%'), f(s, 'wrong_word_caught_%'),
                  f(b, 'ayah_id_top1_%'), f(s, 'ayah_id_top1_%')))
    v = lambda d, k: d[k]['verify_acc_%']
    g = {'clean P0b >= base-0.5': all(v(s, k) >= v(b, k) - 0.5 for k in ('ho_reciters', 'ho_retasy')),
         'noisy P0b >= base': all(v(s, k) >= v(b, k) for k in ('ho_noisy20', 'ho_noisy10', 'ho_noisy5')),
         'test-L2 up': v(s, 'test_L2') > v(b, 'test_L2'),
         'test-L1/L3 not -2': all(v(s, k) >= v(b, k) - 2 for k in ('test_L1', 'test_L3')),
         'wrong caught >= base-1 (all sets)': all(s[k]['wrong_word_caught_%'] >= b[k]['wrong_word_caught_%'] - 1 for k in SETS if k in s)}
    for k, ok in g.items(): print('  [%s] %s' % ('PASS' if ok else 'FAIL', k))
    print('  GATE:', 'PASS' if all(g.values()) else 'FAIL')
