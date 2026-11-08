# 5.15c: old checks follow the split (review data now in q.hzRev) and the disabled «قلب تلقائي» in tests
import io
P = r"D:\Quran App\quran-karim\tools\qa\ui.js"
s = io.open(P, encoding="utf8").read()
def rep(old, new, n=1):
    global s
    c = s.count(old); assert c == n, (c, old[:120]); s = s.replace(old, new)

rep("""const LSK = ['q.turn', 'q.mode', 'q.edition', 'q.hifzAyat', 'q.hifzLog',""", """const LSK = ['q.turn', 'q.mode', 'q.edition', 'q.hifzAyat', 'q.hifzLog', 'q.hzRev',""")
rep("""const hzKeep = async () => ev(() => ['q.hifzLog', 'q.hifzAyat',""", """const hzKeep = async () => ev(() => ['q.hifzLog', 'q.hzRev', 'q.hifzAyat',""")
# G15 map: the same surahs on both lists
rep("""...Array.from({ length: 25 }, (_, i) => ({ [90 + i]: { m: t, r: t } })))) ); });""",
    """...Array.from({ length: 25 }, (_, i) => ({ [90 + i]: { m: t, r: t } })))) ); localStorage.setItem('q.hzRev', localStorage.getItem('q.hifzLog')); });""")
rep("""    await ev(() => localStorage.removeItem('q.hifzLog')); return assert(r[0] === r[1]""", """    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.removeItem('q.hzRev'); }); return assert(r[0] === r[1]""")
# G511 G6: the flip button is there in a test, on and disabled
rep("""document.querySelectorAll('.hz-flip.on').length]; });
    const sh""", """document.querySelectorAll('.hz-flip.on:disabled').length]; });
    const sh""")
rep("""t[0] === '#/p/604' && t[1] && t[2] === 0 && /٠/.test(sh)""", """t[0] === '#/p/604' && t[1] && t[2] === 1 && /٠/.test(sh)""")
# P2.6 mushaf range test from «المراجعة»: the surah goes on the review list
rep("""!!JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112], !!JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[112]]);""",
    """!!JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[112], !!JSON.parse(localStorage.getItem('q.hzRev') || '{}')[112]]);""")
rep("""localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzLog', JSON.stringify({ 1: { m: o, r: o }, 112:""",
    """localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', JSON.stringify({ 1: { m: o, r: o }, 112:""")
rep("""      localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a, r: a, iv: 7 }, 2:""", """      localStorage.setItem('q.hzRev', JSON.stringify({ 112: { m: a, r: a, iv: 7 }, 2:""")
rep("""localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzLog', JSON.stringify({ 113: { m: a, r: a, iv: 7 }, 114: { m: a, r: a, iv: 7 } })); }, dAgo(9));""",
    """localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hzRev', JSON.stringify({ 113: { m: a, r: a, iv: 7 }, 114: { m: a, r: a, iv: 7 } })); }, dAgo(9));""")
# S1 map: memorised (q.hifzLog) and its review interval (q.hzRev)
rep("""localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a, r: a, iv: iv } })); }, [dAgo(20), iv]);""",
    """localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a } })); localStorage.setItem('q.hzRev', JSON.stringify({ 112: { m: a, r: a, iv: iv } })); }, [dAgo(20), iv]);""")
# S7: the card follows the review list
rep("""    await ev(() => localStorage.removeItem('q.hifzLog')); await go('#/hifzlog', 150); await go('#/', 500); const none""",
    """    await ev(() => { localStorage.removeItem('q.hifzLog'); localStorage.setItem('q.hzRev', '{}'); }); await go('#/hifzlog', 150); await go('#/', 500); const none""")
rep("""localStorage.setItem('q.hifzLog', JSON.stringify({ 114: { m: a, r: a, iv: 7 }, 1: { m: a, r: a, iv: 30 } })); }, dAgo(8));""",
    """localStorage.setItem('q.hzRev', JSON.stringify({ 114: { m: a, r: a, iv: 7 }, 1: { m: a, r: a, iv: 30 } })); }, dAgo(8));""")
rep("""await ev(a => localStorage.setItem('q.hifzLog', JSON.stringify({ 1: { m: a, r: a, iv: 30 } })), dAgo(8));""",
    """await ev(a => localStorage.setItem('q.hzRev', JSON.stringify({ 1: { m: a, r: a, iv: 30 } })), dAgo(8));""")
rep("""'5.15b ١: «السور اللي حفظتها» بتتفتح وتتقفل""", """'5.15b ١: «السور المراجعة» بتتفتح وتتقفل""")
# 5.15b 5 -> 5.15c 1: the button is there, on and disabled
rep("""'5.15b ٥: مفيش زرار «قلب تلقائي» جوه الاختبار (المصحف والكلمات)، والصفحة بتتقلب حتى لو كان مقفول برّه'""",
    """'5.15b ٥ + 5.15c ١: «قلب تلقائي» جوه الاختبار ظاهر وشغال ومش بيتضغط (المصحف والكلمات)، والصفحة بتتقلب حتى لو كان مقفول برّه'""")
rep("""const fb = await ev(() => document.querySelectorAll('#hifzBar .hz-flip').length);""", """const fb = await ev(() => document.querySelectorAll('#hifzBar .hz-flip.on:disabled').length);""")
rep("""const wf = await ev(() => !!document.getElementById('htFlip'));""", """const wf = await ev(() => { const f = document.getElementById('htFlip'); return !!f && f.disabled && f.classList.contains('on'); });""")
rep("""return assert(fb === 0 && h === '#/p/601' && !wf, JSON.stringify([fb, h, wf])); });""", """return assert(fb === 1 && h === '#/p/601' && wf, JSON.stringify([fb, h, wf])); });""")
# 5.15b 8: from «المراجعة» the surah goes on the review list, not the memorised one
rep("""    const rv = await ev(() => [!!JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[2], (JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[2] || {}).score]);""",
    """    const rv = await ev(() => [!!JSON.parse(localStorage.getItem('q.hzRev') || '{}')[2] && !JSON.parse(localStorage.getItem('q.hifzLog') || '{}')[2], (JSON.parse(localStorage.getItem('q.hifzScores') || '{}')[2] || {}).score]);""")
rep("""await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 2, from: 1 })); });""",
    """await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 2, from: 1 })); });""")

# new 5.15c checks, after the 5.15b 8 check
anchor = """    return assert(part[0] && part[1] === 100 && rv[0] && rv[1] === 100, JSON.stringify([part, rv])); });\n"""
new = io.open(r"D:\Quran App\quran-karim\plans\wip-5.15\ui515c.js", encoding="utf8").read()
rep(anchor, anchor + new)
io.open(P, "w", encoding="utf8", newline="").write(s)

R = r"D:\Quran App\quran-karim\tools\qa\recite_sim.js"
t = io.open(R, encoding="utf8").read()
a = """const flipBtn = await ev(() => !document.getElementById('htFlip'));   // 5.15b: no toggle inside a test"""
assert t.count(a) == 1
t = t.replace(a, """const flipBtn = await ev(() => { const f = document.getElementById('htFlip'); return !!f && f.disabled; });   // 5.15c: on and disabled inside a test""")
io.open(R, "w", encoding="utf8", newline="").write(t)
print("ok")
