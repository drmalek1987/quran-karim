  await check(G516, '5.16d: «قلب تلقائي» في اختبار الخريطة بيشتغل ويقف (المصحف والكلمات)، وفي اختبار «المراجعة» باهت ومقفول', async () => { const k = await hzKeep();
    await ev(() => { localStorage.setItem('q.hifzFlip', 'true'); localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150); await go('#/hifzmap', 700);
    await p.click('.hm-grid .hm-c[data-p="600"]'); await wait(300); await p.click('#hzMus'); await wait(1200);
    const st = () => ev(() => { const f = document.querySelector('#hifzBar .hz-flip'); return f && [f.disabled, f.classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzFlip'))]; });
    const a = await st(); await p.click('#hifzBar .hz-flip'); await wait(300); const b2 = await st();
    // off: the page's last ayah ends the map test on page 600 (no turn to 601)
    for (let i = 0; i < 80; i++) { const r = await ev(() => [document.querySelectorAll('.hifz-mask').length, location.hash]); if (!r[0] || r[1] !== '#/p/600') break; await p.click('#hifzBar [data-c="nx"]'); await wait(60); }
    await wait(2500); const h = await ev(() => location.hash); await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); });
    await ev(() => localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 112, from: 1 }))); await go('#/', 150); await go('#/hifztest/112', 700);
    const w = await ev(() => { const f = document.getElementById('htFlip'); return [f.disabled, f.classList.contains('on')]; }); await p.click('#htFlip'); await wait(200);
    const w2 = await ev(() => [document.getElementById('htFlip').classList.contains('on'), JSON.parse(localStorage.getItem('q.hifzFlip'))]);
    await ev(() => localStorage.setItem('q.hifzFlip', 'false')); await go('#/', 150); await go('#/hifzlog', 600); await ev(() => hzTestStart({ k: 's', s: 112, w: 'o' }, 'm')); await wait(1200); const rv = await st();
    await ev(() => { const x = document.querySelector('#hifzBar [data-c="x"]'); if (x) x.click(); document.querySelectorAll('.dlg-back, .cheer').forEach(e => e.remove()); localStorage.setItem('q.hifzFlip', 'true'); }); await hzBack(k); await go('#/', 200);
    return assert(!a[0] && a[1] && !b2[0] && !b2[1] && b2[2] === false && h === '#/p/600' && !w[0] && !w[1] && w2[0] && w2[1] === true && rv[0] && rv[1], JSON.stringify([a, b2, h, w, w2, rv])); });
