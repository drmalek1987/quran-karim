/* Shared in-page measurements for Quran Karim page loading (bug #25). Evaluated as-is by run-playwright.mjs and
   run-cdp.py. Defines window.__qk. No taps: navigation is location.hash, scrolling is window.scrollBy. */
(function () {
  if (window.__qk && window.__qk.v === 2) return;
  var longTasks = [], lt = null;
  try { lt = new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { longTasks.push([e.startTime, e.duration]); }); }); lt.observe({ type: "longtask", buffered: true }); } catch (e) {}
  function pad(n) { return ("00" + n).slice(-3); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function raf() { return new Promise(function (r) { requestAnimationFrame(r); }); }
  function pct(a, q) { if (!a.length) return null; a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; }
  function r1(x) { return x === null || x === undefined ? null : Math.round(x * 10) / 10; }
  function ltIn(t0, t1) { var s = 0, n = 0; longTasks.forEach(function (x) { var a = Math.max(t0, x[0]), b = Math.min(t1, x[0] + x[1]); if (b > a) { s += b - a; n++; } }); return { ms: r1(s), n: n }; }
  function dirOf() { var im = document.querySelector("img[src$='.avif']"); return im ? im.getAttribute("src").replace(/\d{3}\.avif.*$/, "") : null; }
  function jl(k, d) { try { var v = localStorage.getItem("q." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function info() {
    return { edition: jl("edition", "kfgqpc"), turn: jl("turn", "h"), mode: jl("mode", "pages"),
      vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, hash: location.hash, dir: dirOf(), ua: navigator.userAgent.slice(0, 120),
      spread: !!document.querySelector(".page-wrap.spread"), vp: document.querySelectorAll(".vp-c").length, imgs: document.querySelectorAll("img").length };
  }
  function mem() {
    var imgs = Array.prototype.slice.call(document.querySelectorAll("#view img:not(.tjo), .vpages img:not(.tjo)")), n = 0, b = 0;
    imgs.forEach(function (i) { if (i.complete && i.naturalWidth) { n++; b += i.naturalWidth * i.naturalHeight * 4; } });
    var pm = performance.memory || {};
    return { jsHeapMB: pm.usedJSHeapSize ? r1(pm.usedJSHeapSize / 1048576) : null, nodes: document.getElementsByTagName("*").length, loadedImgs: n, loadedImgsRgbaMB: r1(b / 1048576) };
  }
  // single (paged) view: hash change -> #pg in the DOM -> img.complete -> img.decode() -> two rAFs (painted)
  async function single(pages, gap) {
    var out = [];
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i], t0 = performance.now(), want = pad(p) + ".avif", img = null, tDom = null, tCompl = null;
      location.hash = "#/p/" + p;
      for (;;) {
        img = document.getElementById("pg");
        if (img && (img.getAttribute("src") || "").indexOf(want) >= 0) { if (tDom === null) tDom = performance.now() - t0; if (img.complete && img.naturalWidth) { tCompl = performance.now() - t0; break; } }
        if (performance.now() - t0 > 15000) break;
        await raf();
      }
      var tDec = null, err = null;
      try { await img.decode(); tDec = performance.now() - t0; } catch (e) { err = String(e); }
      await raf(); await raf();
      var t1 = performance.now();
      out.push({ p: p, dom: r1(tDom), complete: r1(tCompl), decode: r1(tDec), paint: r1(t1 - t0), lt: ltIn(t0, t1).ms, err: err });
      await sleep(gap || 500);
    }
    return out;
  }
  // vertical scroll: pps pages per second for secs seconds (the caller has routed to the start page and let it settle)
  async function vertical(o) {
    var pps = o.pps, secs = o.secs, list = document.querySelector(".vpages");
    if (!list) return { error: "no .vpages (turn mode is not v)" };
    var boxes = Array.prototype.slice.call(list.querySelectorAll(".page-box.vp")), recs = {}, vis = {}, frames = 0, blankFrames = 0, dts = [];
    var pageH = boxes[0].parentNode.getBoundingClientRect().height + 10;
    var started = false, tStart = 0;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var bx = e.target.firstChild, p = +bx.dataset.p, im = bx.querySelector("img:not(.tjo)");
        if (e.isIntersecting) {
          vis[p] = 1;
          if (recs[p]) return;
          var rec = recs[p] = { p: p, enter: performance.now(), initial: !started, ok0: !!(im.complete && im.naturalWidth), done: null, dec: null };
          var dec = function () { im.decode().then(function () { rec.dec = performance.now(); }, function () { rec.dec = -1; }); };
          if (rec.ok0) { rec.done = rec.enter; dec(); } else im.addEventListener("load", function () { rec.done = performance.now(); dec(); }, { once: true });
        } else delete vis[p];
      });
    });
    boxes.forEach(function (b) { io.observe(b.parentNode); });
    await raf(); await raf(); started = true;
    tStart = performance.now();
    var last = tStart, y0 = scrollY;
    await new Promise(function (res) {
      (function step(now) {
        var dt = now - last; last = now; frames++; dts.push(dt);
        window.scrollBy(0, pps * pageH * dt / 1000);
        var bl = false; Object.keys(vis).forEach(function (p) { var r = recs[p]; if (r && !r.initial && r.dec === null) bl = true; });
        if (bl) blankFrames++;
        if (now - tStart < secs * 1000) requestAnimationFrame(step); else res();
      })(tStart);
    });
    var tEnd = performance.now();
    await sleep(800); io.disconnect();
    var rs = Object.keys(recs).map(function (k) { return recs[k]; }).filter(function (r) { return !r.initial; });
    var blank = rs.map(function (r) { return r.dec === null ? 9999 : Math.max(0, r.dec - r.enter); });
    var load = rs.map(function (r) { return r.done === null ? 9999 : Math.max(0, r.done - r.enter); });
    var slow = dts.filter(function (d) { return d > 34; });
    return { pps: pps, secs: secs, pageH: r1(pageH), scrolledPages: r1((scrollY - y0) / pageH), entered: rs.length, notLoadedAtEnter: rs.filter(function (r) { return !r.ok0; }).length,
      blankP50: r1(pct(blank, .5)), blankP95: r1(pct(blank, .95)), blankMax: r1(Math.max.apply(null, blank.concat([0]))), blankOver100: blank.filter(function (x) { return x > 100; }).length,
      blankOver300: blank.filter(function (x) { return x > 300; }).length, loadP50: r1(pct(load, .5)), loadP95: r1(pct(load, .95)), undecoded: rs.filter(function (r) { return r.dec === null; }).length,
      frames: frames, blankFrames: blankFrames, slowFrames: slow.length, frameP95: r1(pct(dts, .95)), lt: ltIn(tStart, tEnd), mem: mem() };
  }
  // AVIF size + createImageBitmap decode time per page (off-DOM, same decoder as <img>)
  async function decodeBench(dir, pages) {
    var out = [];
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i], b = null, bm, t0, t1, el;
      try { var r = await fetch(dir + pad(p) + ".avif", { cache: "no-store" }); b = await r.blob(); t0 = performance.now(); bm = await createImageBitmap(b); t1 = performance.now(); }
      catch (e) {   // WebView asset loader without fetch: decode a fresh <img> instead (size unknown)
        el = new Image(); el.src = dir + pad(p) + ".avif";
        try { await new Promise(function (ok, no) { el.onload = ok; el.onerror = no; }); t0 = performance.now(); bm = await createImageBitmap(el); t1 = performance.now(); }
        catch (e2) { out.push({ p: p, error: String(e2) }); continue; }
      }
      out.push({ p: p, bytes: b ? b.size : null, w: bm.width, h: bm.height, decodeMs: r1(t1 - t0) }); bm.close();
    }
    return out;
  }
  // the app's own turn-mode handler (a DOM click, not a screen tap): needs the settings sheet's #flip buttons in the DOM
  function setTurn(v) { if (v === "h") v = "off";   // the single-page turn button is data-v="off" in the app
    var b = document.querySelector('#flip button[data-v="' + v + '"]'); if (!b) return false; b.click(); return true; }
  window.__qk = { v: 2, info: info, mem: mem, single: single, vertical: vertical, decodeBench: decodeBench, setTurn: setTurn, sleep: sleep, pad: pad };
})();
