import io
p = r'D:\Quran App\quran-karim\tools\qa\ui.js'; s = io.open(p, encoding='utf8').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, old[:80]; s = s.replace(old, new)
# 5.15b item 5: no «قلب تلقائي» inside a test
rep("""t[0] === '#/p/604' && t[1] && t[2] === 1 && /٠/.test(sh)""", """t[0] === '#/p/604' && t[1] && t[2] === 0 && /٠/.test(sh)""")
rep("""  await check(G511, 'G6: «قلب تلقائي» مقفول: آخر آية في الصفحة بتنهي الاختبار في نفس الصفحة', async () => {
    await p.click('#hifzBar .hz-flip'); await wait(200); const off = await ev(() => localStorage.getItem('q.hifzFlip'));
    for (let i = 0; i < 40; i++) { const more = await ev(() => document.body.classList.contains('has-hifz') && document.querySelectorAll('.hifz-mask').length > 0); if (!more) break; await p.click('#hifzBar [data-c="nx"]'); await wait(60); }
    await wait(1700); const r = await ev(() => [location.hash, document.body.classList.contains('has-hifz')]);
    return assert(off === 'false' && r[0] === '#/p/604' && !r[1], JSON.stringify([off, r])); });""",
"""  await check(G511, 'G6: آخر آية في آخر صفحة في المصحف بتنهي الاختبار (5.15b: مفيش «قلب تلقائي» جوه الاختبار)', async () => {
    for (let i = 0; i < 40; i++) { const more = await ev(() => document.body.classList.contains('has-hifz') && document.querySelectorAll('.hifz-mask').length > 0); if (!more) break; await p.click('#hifzBar [data-c="nx"]'); await wait(60); }
    await wait(2500); const r = await ev(() => [location.hash, document.body.classList.contains('has-hifz')]);
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    return assert(/^#\\/p\\/604/.test(r[0]), JSON.stringify(r)); });""")
# 5.15b item 1: a tap on a surah in the list does nothing
rep("""    await go('#/hifzlog', 700); await p.click('.hl-list li[data-s="113"]'); await wait(300);""",
    """    await ev(() => localStorage.setItem('q.hzScope', JSON.stringify({ k: 's', s: 1, n: 1, q: 1, a1: 1, a2: 7, w: 'o' }))); await go('#/hifzlog', 700); await p.click('#hlFold > summary'); await wait(200); await p.click('.hl-list li[data-s="113"]'); await wait(300);""")
rep("""tap[0] && tap[1] === 113 && tap[2] === '113' && tap[3].includes('٥٠٪')""", """tap[0] && tap[1] === 1 && tap[2] === '1' && tap[3].includes('٥٠٪')""")
new = io.open(r'D:\Quran App\quran-karim\plans\wip-5.15\ui515b.js', encoding='utf8').read()
new = new.replace("""    await go('#/s/2/5', 400); await ev(() => qBack());""", """    await go('#/', 200); await go('#/s/2/5', 400); await ev(() => qBack());""")
anchor = """  // 5c/5d: the page moves one way only"""
rep(anchor, new + anchor)
io.open(p, 'w', encoding='utf8', newline='').write(s)
print('ok')
