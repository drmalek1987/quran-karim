  await check(G516, '5.16e: بعد اختبار كلمات من «المراجعة»، «اختبار الحفظ» من تبويبه بيبقى اختبار عادي و«قلب تلقائي» شغال ويتقفل', async () => { const k = await hzKeep();
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await go('#/', 150); await go('#/hifzlog', 600);
    await ev(() => hzTestStart({ k: 's', s: 2, w: 'o' }, 'w')); await wait(800);
    const a = await ev(() => { const f = document.getElementById('htFlip'); return [location.hash, f.disabled, JSON.parse(localStorage.getItem('q.hifzTest')).end != null]; });
    await go('#/', 150); await go('#/hifztest', 800);
    const b2 = await ev(() => { const f = document.getElementById('htFlip'); return [f.disabled, f.classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzTest')).end == null]; });
    await p.click('#htFlip'); await wait(200); const c = await ev(() => [document.getElementById('htFlip').classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzFlip'))]);
    await ev(() => localStorage.setItem('q.hifzFlip', 'true')); await hzBack(k); await go('#/', 200);
    return assert(a[0] === '#/hifztest/2' && a[1] && a[2] && !b2[0] && b2[1] && b2[2] && !c[0] && c[1] === false, JSON.stringify([a, b2, c])); });
