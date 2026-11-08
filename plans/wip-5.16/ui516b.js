  // ---------- 5.16b: recognition → mushaf speed (U3, U4) ----------
  const G516b = 'نسخة 5.16b';
  await check(G516b, 'U3: على المصحف، السطر بيتكشف كلمة كلمة مع القراية (مش بيستنى السطر كله)', async () => { const k = await hzKeep();
    await ev(() => { window.ReciteBridge = { start() {}, stop() {} }; localStorage.setItem('q.mode', '"pages"'); }); await go('#/', 150);
    await ev(() => hzTestStart({ k: 'a', s: 2, a1: 255, a2: 255, w: 'o' }, 'm', [[(() => { const S = window.QURAN.s; let a = 0; for (let i = 0; i < 1; i++) a += S[i][3]; return a + 254; })(), (() => { const S = window.QURAN.s; let a = 0; for (let i = 0; i < 1; i++) a += S[i][3]; return a + 254; })()]])); await wait(1500);
    const wsum = () => ev(() => [...document.querySelectorAll('.hifz-mask[data-k="2:255"]')].reduce((t, m) => t + m.getBoundingClientRect().width, 0));
    const w0 = await wsum(); await p.click('#hifzBar [data-c=mic]'); await wait(200);
    await ev(() => { onRecite('', 'state:listening'); onRecite('الله لا اله الا هو', 'partial'); }); await wait(400); const w1 = await wsum();
    await ev(() => onRecite('الله لا اله الا هو الحي القيوم لا تاخذه سنه ولا نوم', 'partial')); await wait(400); const w2 = await wsum();
    await stopT(); await ev(() => { delete window.ReciteBridge; }); await hzBack(k); await go('#/', 200);
    return assert(w0 > 0 && w1 > 0 && w1 < w0 - 40 && w2 < w1 - 40, JSON.stringify([w0, w1, w2].map(Math.round))); });
