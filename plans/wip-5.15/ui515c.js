  // 5.15c: the user's patch on 5.15b
  await check(G515, '5.15c ٢: الرجوع من «المراجعة» نفسها (زرار الشاشة وزرار الموبايل) بيروح للرئيسية مش للشاشة اللي قبلها', async () => {
    await go('#/', 150); await go('#/s/2/5', 400); await go('#/hifzlog', 600); await ev(() => qBack()); await wait(500); const hw = await ev(() => location.hash);
    await go('#/s/2/5', 400); await go('#/hifzlog', 600); await p.click('#btnBack'); await wait(500); const sc = await ev(() => location.hash);
    await go('#/', 200); return assert(/^#\/?$/.test(hw) && /^#\/?$/.test(sc), JSON.stringify([hw, sc])); });
  await check(G515, '5.15c ٣: «اختبار الحفظ» بيسجّل في «السور المحفوظة» بس، و«المراجعة» بتسجّل في «السور المراجعة» بس', async () => { const k = await hzKeep();
    await ev(() => { ['q.hifzLog', 'q.hifzAyat', 'q.hifzScores'].forEach(x => localStorage.removeItem(x)); localStorage.setItem('q.hzRev', '{}'); localStorage.setItem('q.hifzTest', JSON.stringify({ lv: 25, s: 112, from: 1 })); });
    await go('#/', 150); await go('#/hifztest/112', 700); await p.click('#htDone'); await wait(300); await go('#/', 150); await go('#/hifztest/112', 700);
    const a = await ev(() => [!!JSON.parse(localStorage.getItem('q.hifzLog'))[112], !JSON.parse(localStorage.getItem('q.hzRev'))[112], document.querySelector('#hmFold > summary').textContent, !!document.querySelector('#hmFold li[data-s="112"].on')]);
    await go('#/', 150); await go('#/hifzlog', 600); const b2 = await ev(() => [document.querySelector('#hlFold > summary').textContent, !document.querySelector('#hlFold li[data-s="112"].on')]);
    await ev(() => hzTestStart({ k: 's', s: 113, w: 'o' }, 'w')); await wait(700); await p.click('#htDone'); await wait(300);
    const c = await ev(() => [!!JSON.parse(localStorage.getItem('q.hzRev'))[113], !JSON.parse(localStorage.getItem('q.hifzLog'))[113], JSON.parse(localStorage.getItem('q.hzRev'))[113].iv]);
    await go('#/', 150); await go('#/hifzlog', 600); const d = await ev(() => !!document.querySelector('#hlFold li[data-s="113"].on'));
    await hzBack(k); await go('#/', 200);
    return assert(a[0] && a[1] && /السور المحفوظة/.test(a[2]) && a[3] && /السور المراجعة/.test(b2[0]) && b2[1] && c[0] && c[1] && c[2] === 7 && d, JSON.stringify([a, b2, c, d])); });
  await check(G515, '5.15c ٣: المراجعة الذكية والورد شغالين على «السور المراجعة»، والخريطة: المحفوظ من «السور المحفوظة» والأصفر من المراجعة', async () => { const k = await hzKeep();
    const r = await ev(a => { localStorage.setItem('q.hifzScores', '{}'); localStorage.setItem('q.hifzLog', JSON.stringify({ 1: { m: a } })); localStorage.setItem('q.hzRev', '{}');
      const d0 = hzWard().list.length; localStorage.setItem('q.hzRev', JSON.stringify({ 1: { m: a, r: a, iv: 7 } })); return [d0, hzWard().list.map(x => x.s).join(',')]; }, dAgo(20));
    const col = async rev => { await ev(([a, rev]) => { localStorage.removeItem('q.hifzAyat'); localStorage.setItem('q.hifzLog', JSON.stringify({ 112: { m: a } })); localStorage.setItem('q.hzRev', JSON.stringify(rev ? { 112: { m: a, r: a, iv: 7 } } : {})); }, [dAgo(20), rev]);
      await go('#/', 150); await go('#/hifzmap', 700); return ev(() => (document.querySelector('.hm-c[data-s="112"]') || {}).className || ''); };
    const due = await col(true), fresh = await col(false);
    await p.click('#hmLog'); await wait(700); const lg = await ev(() => [location.hash, document.getElementById('hmFold') && document.getElementById('hmFold').open, (document.getElementById('hmLog') || {}).textContent]);
    const mig = await ev(() => { localStorage.removeItem('q.hzRev'); localStorage.setItem('q.hifzLog', JSON.stringify({ 5: { m: '2026-1-1', r: '2026-1-1', iv: 14 } })); return Object.keys(hzRevData()).join(',') + '/' + (hzRevData()[5] || {}).iv; });
    await hzBack(k); await go('#/', 200);
    return assert(r[0] === 0 && r[1] === '1' && /\bc2\b/.test(due) && /\bc3\b/.test(fresh) && lg[0] === '#/hifztest' && lg[1] && mig === '5/14', JSON.stringify([r, due, fresh, lg, mig])); });
