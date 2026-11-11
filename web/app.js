(function () {
  "use strict";

  var Q = window.QURAN;
  // The text marks open dammatan with U+065E, which Amiri Quran lacks (it showed as a box); Unicode's own code for it is U+08F1.
  Q.t = Q.t.map(function (su) { return su.map(function (t) { return t.replace(/\u065E/g, "\u08F1"); }); });
  var view = document.getElementById("view");
  var titleEl = document.getElementById("title");
  var btnBack = document.getElementById("btnBack");

  // Start of each juz as [surah, ayah].
  var JUZ = [[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],
    [9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],
    [29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
  var JUZ_NAMES = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس","السابع","الثامن","التاسع","العاشر",
    "الحادي عشر","الثاني عشر","الثالث عشر","الرابع عشر","الخامس عشر","السادس عشر","السابع عشر","الثامن عشر","التاسع عشر","العشرون",
    "الحادي والعشرون","الثاني والعشرون","الثالث والعشرون","الرابع والعشرون","الخامس والعشرون","السادس والعشرون","السابع والعشرون","الثامن والعشرون","التاسع والعشرون","الثلاثون"];
  var BASMALA = "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ";

  // ---------- storage (works without it, e.g. private mode) ----------
  function load(k, d) { try { var v = localStorage.getItem("q." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  // A short buzz on taps (buttons, ayahs), not on page turns. Strength from Settings: 0 off, 1 light (default), 2 medium, 3 strong.
  var lastTick = 0;
  function hapticLevel() { return load("hapticLevel", load("haptic", true) ? 1 : 0); }
  function tick() {
    var lv = hapticLevel(), now = Date.now();
    if (!lv || now - lastTick < 60) return;
    lastTick = now;
    try { if (window.AppBridge && AppBridge.buzz) AppBridge.buzz(lv); else if (window.AppBridge && AppBridge.tick) AppBridge.tick(); else if (navigator.vibrate) navigator.vibrate([0, 8, 15, 25][lv]); } catch (e) {}
  }
  // More than 5 wrong words in one ayah while reciting: a long buzz plus a short beep (Settings: errAlert).
  function errAlert() {
    try { if (window.AppBridge && AppBridge.buzzPattern) AppBridge.buzzPattern("0,300,120,300"); else if (navigator.vibrate) navigator.vibrate([0, 300, 120, 300]); } catch (e) {}
    try { var C = window.AudioContext || window.webkitAudioContext, c = new C(), o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 660; g.gain.value = 0.15; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.25);
      setTimeout(function () { c.close(); }, 600); } catch (e) {}
  }
  function save(k, v) { try { localStorage.setItem("q." + k, JSON.stringify(v)); } catch (e) {} }

  // ---------- helpers ----------
  function ar(n) { return String(n).replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }); }
  function en(s) { return s.replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }).replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }); }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Stroke icons (Lucide-style, 24px grid).
  var IC = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
    text: '<path d="M21 6H3M21 12H9M21 18H7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    play: '<path d="M19 12H5M11 5l-7 7 7 7"/>',
    wave: '<path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M2 18c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity=".5"/><path d="M2 6c2-4 4-4 6 0s4 4 6 0 4-4 6 0" opacity=".5"/>',
    aplay: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
    apause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/>',
    astop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    anext: '<path d="M16 6 8 12l8 6z" fill="currentColor"/><path d="M6 6v12"/>',
    aprev: '<path d="m8 6 8 6-8 6z" fill="currentColor"/><path d="M18 6v12"/>',
    mark: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
    medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 10 5 3h4l3 6M15.5 10 19 3h-4l-1.6 3.2"/><path d="m12 12.6.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" fill="currentColor" stroke="none"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4"/>',
    home: '<path d="M3 11 12 3l9 8M5 9.5V21h14V9.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    hands: '<path d="M7 21v-6l-3-4V6a1.5 1.5 0 0 1 3 0v4M17 21v-6l3-4V6a1.5 1.5 0 0 0-3 0v4M7 10l3 3v3M17 10l-3 3v3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
    beads: '<circle cx="12" cy="4.5" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="18" cy="15" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="6" cy="15" r="2"/><circle cx="6" cy="8" r="2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    rep: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    dl: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>'
  };
  function ic(n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + "</svg>"; }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d; }
  function pageOf(s, a) { return Q.p[s - 1][a - 1]; }
  function surahOfPage(n) { var r = 1; for (var i = 0; i < 114; i++) if (Q.p[i][0] <= n) r = i + 1; return r; }
  function juzOfPage(n) { var r = 1; for (var i = 0; i < 30; i++) if (pageOf(JUZ[i][0], JUZ[i][1]) <= n) r = i + 1; return r; }
  function juzOf(s, a) { var j = 0; for (var i = 0; i < 30; i++) { var p = JUZ[i]; if (s > p[0] || (s === p[0] && a >= p[1])) j = i; } return j + 1; }

  // Strip tashkeel and Quranic marks and unify letter forms so plain typing matches.
  function norm(t) {
    return t.normalize("NFKD")
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ‌-‏۝۞۩]/g, "")
      .replace(/[ٱأإآ]/g, "ا")
      .replace(/[ىی]/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/ک/g, "ك")
      .replace(/[^ء-ي\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  var index = null; // built lazily on first search
  function buildIndex() {
    index = [];
    for (var s = 0; s < 114; s++)
      for (var a = 0; a < Q.t[s].length; a++)
        index.push([s + 1, a + 1, " " + norm(Q.t[s][a]) + " ", " " + norm(Q.q[s][a]) + " "]);
  }

  // Wraps the words of ayah (s, a) that contain the normalized query nq in <mark>.
  // First tries plain normalized words; if the spelling differs (الصلاة vs ٱلصَّلَوٰةَ,
  // يا أيها vs يَٰٓأَيُّهَا) it compares consonant skeletons without spaces instead.
  function skel(t) { return norm(t).replace(/[اويء\s]/g, ""); }
  function wordHits(words, q, f, sep) {
    var joined = "", spans = [];
    words.forEach(function (w, i) {
      var n = f(w); if (!n) return;
      if (joined) joined += sep;
      spans.push([joined.length, joined.length + n.length, i]);
      joined += n;
    });
    var hit = {}, from = 0, k, any = false;
    while (q && (k = joined.indexOf(q, from)) >= 0) {
      spans.forEach(function (sp) { if (sp[0] < k + q.length && sp[1] > k) { hit[sp[2]] = true; any = true; } });
      from = k + 1;
    }
    return any ? hit : null;
  }
  // nq can hold several search terms separated by | (a search with conditions); every one is marked.
  function highlight(s, a, nq) {
    var words = Q.t[s - 1][a - 1].split(" "), hit = null;
    (nq || "").split("|").forEach(function (t) {
      var h = t && (wordHits(words, t, norm, " ") || wordHits(words, skel(t), skel, ""));
      if (h) { hit = hit || {}; for (var i in h) hit[i] = true; }
    });
    if (!hit) return words.join(" ");
    return words.map(function (w, i) { return hit[i] ? "<mark>" + w + "</mark>" : w; }).join(" ");
  }

  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 1800);
  }

  // ---------- settings ----------
  var root = document.documentElement;
  var fontSize = load("font", 28);
  var theme = load("theme", "auto");
  var mode = load("mode", "pages");
  // ---------- طبعات المصحف ----------
  // Each edition: its page images (dir), the page of every ayah (p) and the ayah's boxes on its page (r: [page, x0, y0, x1, y1]
  // in per-mille of the page), the pages of the Quran text (first..last) and the page numbers that exist (min..count-1).
  // طبعة الحرمين = the scanned PDF (web/pages, data in quran-data.js); طبعة الملك فهد = drawn from the King Fahd Complex
  // and طبعة الشمرلي = the printed PDFs (web/editions/<id>, data in editions/<id>.js; Shamarly pages 2..522), downloaded per edition.
  var EDS = {
    harmain: { name: "طبعة الحرمين", dir: "pages/", tj: "tjpages/", p: Q.p, r: Q.r, first: Q.first, last: Q.last, count: Q.count, min: 0, w: "editions/harmain-w/" }   // w: measured word boxes (5.19, aligned in the straightened photo frame)
  };
  if (window.ED_KFGQPC) EDS.kfgqpc = Object.assign({ name: "طبعة الملك فهد", dir: "editions/kfgqpc/", tj: "editions/kfgqpc-tj/", min: 1, w: "editions/kfgqpc-w/" }, window.ED_KFGQPC);   // w: measured word boxes (5.19)
  // طبعة الملك فهد القديمة = the scanned older Madinah print (HA's PDF, PDF page = page + 3). Its lines are the same as the
  // King Fahd edition's, so its ayah boxes are those boxes moved onto the scan's text frame (tools/kfold/make_edition.py).
  if (window.ED_KFOLD) EDS.kfold = Object.assign({ name: "طبعة الملك فهد القديمة", dir: "editions/kfold/", tj: "editions/kfold-tj/", min: 1 }, window.ED_KFOLD);
  if (window.ED_SHAMARLY) EDS.shamarly = Object.assign({ name: "طبعة الشمرلي", dir: "editions/shamarly/", tj: "editions/shamarly-tj/", min: 2 }, window.ED_SHAMARLY);
  // crop: [top, right, bottom, left] in % of the page image that is empty margin (measured on sample pages of each edition with the
  // ink threshold, then rounded down a little); showPage hides it so the text block fills the page box. ar = image height / width.
  // cropFrom: the first page it is safe on (Shamarly pages 2-3 are full-bleed ornament). The scans (harmain) are uneven, so no crop.
  // The two King Fahd editions are cut to the page's ornamental frame (5.5): the header line, the page number and the
  // juz/hizb marks in the outer margin go. Their outer margin swaps sides with the page, so crop is for an even page
  // (marks on the left) and mirror flips it on odd pages. Measured with a percent ruler on pages 42/43 (frame edge
  // kfgqpc 8.3/3.2/9.0/15.2, kfold 5.7/5.2/6.7/13.5), about 2 px of white left outside the frame (the user asked for a small margin). Pages 1-2 differ.
  if (EDS.kfgqpc) { EDS.kfgqpc.crop = [7.7, 2.6, 8.4, 14.6]; EDS.kfgqpc.mirror = true; EDS.kfgqpc.cropFrom = 3; EDS.kfgqpc.ar = 1.437; }
  if (EDS.kfold) { EDS.kfold.crop = [5.1, 4.6, 6.1, 12.9]; EDS.kfold.mirror = true; EDS.kfold.cropFrom = 3; EDS.kfold.ar = 1.435; }
  if (EDS.shamarly) { EDS.shamarly.crop = [3, 2, 6, 8.5]; EDS.shamarly.ar = 1.414; EDS.shamarly.cropFrom = 4; }
  // The Google Play build leaves out the scanned edition, which has no publishing licence (build.sh with PLAY=1 sets this in flags.js).
  if (window.NO_HARMAIN) { delete EDS.harmain; document.querySelectorAll('[data-ed="harmain"]').forEach(function (x) { x.remove(); }); }
  var edition = load("edition", "kfgqpc");
  if (!EDS[edition]) edition = EDS.kfgqpc ? "kfgqpc" : "harmain";
  function useEdition(id) {
    var e = EDS[id]; edition = id;
    Q.p = e.p; Q.r = e.r; Q.first = e.first; Q.last = e.last; Q.count = e.count; Q.min = e.min;
    byPage = null;
  }
  // Reading place and khatma plan are kept per edition (page numbers differ); the scanned edition keeps the old keys.
  function edKey(k) { return edition === "harmain" ? k : k + "." + edition; }
  useEdition(edition);
  // Page turn effect: "curl" (the sheet folds like paper), "slide" (pages slide sideways) or "off".
  var flipMode = load("flipMode", load("flip", true) ? "curl" : "off");
  // Page turning: "h" = sideways like a book (with or without the curl), "v" = all pages in one vertical scroll.
  var turnMode = load("turn", "h");
  // English translation (Saheeh International) under each ayah in the text view and in the ayah bar.
  var trOn = load("translation", false);
  // Reading background of the mushaf pages only; the app theme (light / dark) does not change it.
  var PAPER = "#fbf7ee", NIGHT = "#12161a";
  var pageBg = load("pageBg", PAPER);
  if (pageBg === "auto") pageBg = isDarkTheme() ? NIGHT : PAPER;
  var tjOn = load("tajweed", true);
  // One switch for the tajweed colours everywhere: the text view and the pages of the editions that have them.
  var tjPg = tjOn;
  var spreadPref = load("spread", true);
  // Reading background: the chosen colour, or one that follows the light / dark theme.
  function luminance(hex) {
    var n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // "sun": dark from maghrib to sunrise at the saved location (the phone's setting when no location is saved).
  function sunDark() {
    try {
      var loc = load("qiblaLoc", null); if (!loc) throw 0;
      if (typeof PR_METHODS === "undefined") return load("themeNow", "") === "dark";   // too early in start-up for the prayer code: keep the last look until sunCheck() runs
      var now = new Date(), c = prayerCfg(), t = prayerTimes(now, loc[0], loc[1], c.method, c.hanafi);
      return now < t.sunrise || now >= t.maghrib;
    } catch (e) { return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }
  }
  function themeDark(t) { return t === "dark" || (t === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) || (t === "sun" && sunDark()); }
  function isDarkTheme() { return themeDark(load("theme", "auto")); }
  function pageIsDark() { return luminance(pageBg) < 0.18; }
  // Remembers the last light and last dark reading colour, so the moon / sun button under the page swaps between them.
  function setPageBg(v) {
    pageBg = v; save("pageBg", v); save(luminance(v) < 0.18 ? "pageBgNight" : "pageBgDay", v); applySettings();
  }
  // Moves the reading place, the open page and the khatma plan to the same ayah in the other edition.
  var switchedFrom = null;
  function switchEdition(id) {
    if (!EDS[id]) return;
    var lp = load(edKey("lastPage"), null), k = load(edKey("khatma"), null), hm = location.hash.match(/^#\/p\/(\d+)(.*)$/);
    function ayahAt0(p) { return firstAyahOfPage(p) || [surahOfPage(p), 1]; }
    var at = lp !== null ? ayahAt0(lp) : null, open = hm ? ayahAt0(+hm[1]) : null, back = switchedFrom;
    // Switching straight back (without turning a page) returns to the exact page left, not the page of its first ayah.
    switchedFrom = hm ? { ed: edition, page: +hm[1], to: id } : null;
    var kk = k ? { from: k.from <= Q.first ? null : ayahAt0(k.from), done: k.done < Q.first ? null : ayahAt0(k.done) } : null;
    useEdition(id); save("edition", id);
    if (at && load(edKey("lastPage"), null) === null) save(edKey("lastPage"), pageOf(at[0], at[1]));
    if (k && !load(edKey("khatma"), null)) {
      var from = kk.from ? pageOf(kk.from[0], kk.from[1]) : Q.first;
      save(edKey("khatma"), { start: k.start, days: k.days, from: from, to: Q.last, done: kk.done ? pageOf(kk.done[0], kk.done[1]) : from - 1 });
    }
    if (open) {
      var np = back && back.ed === id && back.to === switchedFrom.ed && +hm[1] === back.landed ? back.page : pageOf(open[0], open[1]);
      switchedFrom.landed = np;
      history.replaceState(null, "", "#/p/" + np + (hm[2] && /a=/.test(hm[2]) ? hm[2] : ""));
    }
  }
  function applySettings() {
    root.style.setProperty("--quran-size", fontSize + "px");
    if (theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme === "sun" ? (sunDark() ? "dark" : "light") : theme);
    try { localStorage.setItem("q.themeNow", JSON.stringify(root.getAttribute("data-theme") || "")); } catch (e) {}   // the head script starts from it after a reload (language change)
    document.querySelectorAll("#theme button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === theme); });
    document.querySelectorAll("#mode button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === (mode === "text" ? "text" : edition)); });
    document.querySelectorAll("#flip button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === (turnMode === "v" ? "v" : flipMode)); });
    document.querySelectorAll("#tjSet button").forEach(function (b) { b.classList.toggle("on", (b.dataset.v === "on") === tjOn); });
    document.querySelectorAll("#thmSet button").forEach(function (b) { b.classList.toggle("on", (b.dataset.v === "on") === thmOn); });
    document.querySelectorAll("#trSet button").forEach(function (b) { b.classList.toggle("on", (b.dataset.v === "on") === trOn); });
    document.querySelectorAll("#langSet button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === (window.LANG || "ar")); });
  document.querySelectorAll("#hapticSet button").forEach(function (b) { b.classList.toggle("on", +b.dataset.v === hapticLevel()); });
    document.querySelectorAll("#spreadSet button").forEach(function (b) { b.classList.toggle("on", (b.dataset.v === "on") === spreadPref); });
    root.classList.toggle("tjpg", tjPg);
    var bg = pageBg, dark = luminance(bg) < 0.18;
    root.style.setProperty("--pbg", bg);
    root.style.setProperty("--pink", dark ? "#ece6d8" : "#1d1a14");
    root.classList.toggle("pdark", dark);
    var preset = false;
    document.querySelectorAll("#pageBg button").forEach(function (b) { var on = b.dataset.v === pageBg; preset = preset || on; b.classList.toggle("on", on); });
    var pick = document.getElementById("pageBgPick");
    pick.parentNode.classList.toggle("on", !preset);
    if (!preset) { pick.parentNode.style.background = pageBg; pick.value = pageBg; }
  }
  document.querySelectorAll("#langSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.v === (window.LANG || "ar")) return;
      save("lang", b.dataset.v); location.reload();
    });
  });
  (function () {
    var body = document.querySelector("#settings .sheet-body"), h2 = body.querySelector("h2"), groups = body.querySelectorAll(".set-group");
    var j = document.createElement("div"); j.className = "set-jump";
    // A group inside a closed <details> (التحميلات, الخصوصية) opens it; data-chip gives a short chip name.
    groups.forEach(function (g, i) { g.id = g.id || "sg" + i; var b = document.createElement("button"); b.textContent = g.dataset.chip || g.textContent; b.onclick = function () { if (g.parentNode.tagName === "DETAILS") g.parentNode.open = true; g.scrollIntoView({ behavior: "smooth", block: "start" }); }; j.appendChild(b); });
    h2.after(j);
    var fs = document.getElementById("fontSize").closest(".row"), pv = document.createElement("div"); pv.className = "set-prev";
    pv.innerHTML = Q.t[0][1] + ' <span class="ayah-no">﴿' + ar(2) + "﴾</span>"; fs.after(pv);
  })();
  var fontInput = document.getElementById("fontSize");
  fontInput.value = fontSize;
  fontInput.addEventListener("input", function () { fontSize = +fontInput.value; save("font", fontSize); applySettings(); });
  document.querySelectorAll("#theme button").forEach(function (b) {
    b.addEventListener("click", function () { theme = b.dataset.v; save("theme", theme); applySettings(); });
  });
  document.querySelectorAll("#pageBg button").forEach(function (b) {
    b.addEventListener("click", function () { setPageBg(b.dataset.v); });
  });
  document.getElementById("pageBgPick").addEventListener("input", function () { setPageBg(this.value); });
  setInterval(function () { if (theme === "sun") applySettings(); }, 60000);
  // The timer sleeps while the app is in the background, so check again when it comes back (and right now, at start-up:
  // the cached q.themeNow the head script paints from may be from before maghrib).
  function sunCheck() { if (theme === "sun") applySettings(); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) sunCheck(); });
  window.addEventListener("focus", sunCheck); window.addEventListener("pageshow", sunCheck);
  if (window.matchMedia) {
    var mq = matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", applySettings); else if (mq.addListener) mq.addListener(applySettings);
  }
  document.querySelectorAll("#flip button").forEach(function (b) {
    // One setting for how pages turn: a sideways effect (curl / slide / none) switches to sideways turning, or the vertical scroll.
    b.addEventListener("click", function () {
      var v = b.dataset.v, was = turnMode;
      if (v === "v") turnMode = "v"; else { turnMode = "h"; flipMode = v; save("flipMode", flipMode); }
      save("turn", turnMode); applySettings();
      if (was !== turnMode && /^#\/p\//.test(location.hash)) routeKeepSheet();
    });
  });
  // A setting that re-renders the page behind the open Settings sheet: the sheet stays where it was (same scroll, no
  // slide-up replay). route() hides it, and showing it again restarted its animation and reset its scroll (5.11 G1.5).
  function routeKeepSheet(keepPage) {
    var sb = sheet.querySelector(".sheet-body"), st = sb ? sb.scrollTop : 0, y = window.scrollY;
    route();
    if (sb) sb.classList.add("still");
    sheet.hidden = false;
    if (sb) { sb.scrollTop = st; requestAnimationFrame(function () { sb.scrollTop = st; }); }
    if (keepPage) window.scrollTo(0, y);
  }
  // Mushaf page images are downloaded per edition (EdStore.java), not shipped in the app; the web build has them all.
  var ED_BASE = "https://raw.githubusercontent.com/drmalek1987/quran-karim/editions/";
  function edReady(id) { return !window.EdBridge || EdBridge.state(id) === "ready"; }
  // A download starts at once and runs in the background; Settings › التحميلات shows its progress. One at a time
  // (EdStore), so later picks wait in a queue. When the pages arrive, the pick that asked for them goes on.
  var edQ = [], edPct = {}, edThen = {};
  // The recitation models (asr.js) are downloaded the same way, each as the shared runtime plus two packs.
  // Only NVIDIA's model is left (NvAsr.java, its own runtime in the pack). The whisper models (asrbase, asrft) and the
  // web runtime they needed (asrrt) were dropped in 5.4: their files are removed from phones that still have them.
  var ASRM = { asrnv: { name: "نموذج التعرّف على التلاوة", mb: 93, ver: 3 } };   // v3 (5.16d): L2 fine-tune + Z1 pos-table trim
  function asrPacks(m) { return [m, m + "p"]; }
  // Model versions are separate files (asrnv2.zip …); v1 (asrnv.zip, the 5.7 model) stays on the server for rollback.
  // The pack carries asr/<m>/ver.txt; a phone without it has v1 and is offered «تحديث» in Settings › Downloads.
  function edUrl(id) { var m = id.replace(/p$/, ""); return ED_BASE + id + (ASRM[m] && ASRM[m].ver > 1 ? ASRM[m].ver : "") + ".zip"; }
  var asrHave = {};
  function asrVerCheck(m, then) {
    fetch("https://asr.app/" + m + "/ver.txt").then(function (r) { return r.ok ? r.text() : "1"; })
      .then(function (t) { asrHave[m] = parseInt(t, 10) || 1; }, function () { asrHave[m] = 1; }).then(then || function () {});
  }
  function asrOld(m) { return asrReady(m) && asrHave[m] !== undefined && asrHave[m] < ASRM[m].ver; }
  // Update in place: the packs are fetched over the old ones (the old model keeps working until both have arrived).
  function asrUpdate(m) {
    asrPacks(m).forEach(function (k) { if (edQ.indexOf(k) < 0) edQ.push(k); });
    edThen[m + "p"] = function () { asrPick(m); asrVerCheck(m, paintEdDl); if (window.NvBridge && NvBridge.reload) NvBridge.reload(); toast("خلص تحديث " + ASRM[m].name); };
    toast("بدأ تحديث " + ASRM[m].name + "، تقدر تتابعه من الإعدادات › التحميلات");
    edNext(); paintEdDl();
  }
  if (window.EdBridge) {
    ["asrbase", "asrbasep", "asrft", "asrftp", "asrrt"].forEach(function (k) { var st = EdBridge.state(k); if (st === "ready" || st === "part") EdBridge.remove(k); });
    if (/^(asrbase|asrft)$/.test(load("asr", "phone"))) save("asr", asrReady("asrnv") ? "asrnv" : "phone");
  }
  // A finished download or update also makes that model the recogniser (a phone left on «الموبايل» would never use it).
  function asrPick(m) { save("asr", m); asrBtn(); }
  // 5.11: NVIDIA's model is the only recogniser. Settings › «التعرّف على التلاوة» is a closed box: its title line shows the
  // state, and a tap opens the model card (download / delete, paintAsrDl).
  function asrBtn() {
    var b = document.getElementById("asrSum"); if (!b) return;
    var q = asrPacks("asrnv").some(function (k) { return edQ.indexOf(k) >= 0; });
    b.textContent = asrReady("asrnv") ? "✓ جاهز على الموبايل" : q ? "جاري التحميل…" : "مش متنزّل · " + ar(ASRM.asrnv.mb) + " ميجا";
  }
  // 5.11 G3.8: the model works only after its terms are accepted once (q.modelConsent). The voice donation is a separate
  // optional box, unticked by default, never bundled with the terms.
  function modelOk() { return !!load("modelConsent", null); }
  function consentDlg(then) {
    var d = el('<div class="dlg-back"><div class="dlg cs-dlg"><b>نموذج التعرّف على التلاوة</b><p class="hint">بيشتغل على الموبايل من غير إنترنت، وصوتك ما بيخرجش من الجهاز وقت التعرّف. ' +
      "هو أداة مساعدة للمراجعة والحفظ وممكن يغلط، خصوصًا في الدوشة. التفاصيل في الإعدادات › حول التطبيق › الخصوصية.</p>" +
      '<label class="rem-row"><span class="rem-sw"><input type="checkbox" id="cTerms"><span></span>موافق على شروط استخدام النموذج وسياسة الخصوصية</span></label>' +
      '<label class="rem-row"><span class="rem-sw"><input type="checkbox" id="cDonate"><span></span>ساعد في تحسين التعرّف على التلاوة بتسجيلات صوتك (اختياري)</span></label>' +
      '<div class="dlg-btns"><button class="dlg-no">ليس الآن</button><button class="dlg-ok" disabled>موافق</button></div></div></div>').firstChild;
    document.body.appendChild(d);
    var t = d.querySelector("#cTerms"), ok = d.querySelector(".dlg-ok");
    t.onchange = function () { ok.disabled = !t.checked; };
    d.querySelector(".dlg-no").onclick = function () { d.remove(); };
    ok.onclick = function () {
      save("modelConsent", { v: 1, t: Date.now() }); save("donate", d.querySelector("#cDonate").checked ? 1 : 0);
      d.remove(); donatePaint(); if (then) then();
    };
  }
  // On the phone without the model, a voice feature offers the download instead of starting.
  // 5.11 G3.9: the first time the mic would start, tips + an on-phone mic test (q.micTips); «ابدأ» runs `again`.
  function micTips(again) {
    var d = el('<div class="dlg-back"><div class="dlg mt-dlg"><b>نصايح قبل ما تبدأ</b><ul class="hint mt-tips">' +
      "<li>اقعد في مكان هادي على قد ما تقدر</li><li>خلّي الموبايل على بعد ٢٠–٣٠ سم من بقك</li>" +
      "<li>اقرا بصوت واضح وثابت</li><li>اتأكد إن المايك مش متغطي بإيدك أو بالجراب</li></ul>" +
      '<p class="hint" id="mtRes"></p><div class="dlg-btns"><button class="dlg-no" id="mtGo">اختبر المايك</button><button class="dlg-ok">ابدأ</button></div></div></div>').firstChild;
    document.body.appendChild(d);
    d.querySelector("#mtGo").onclick = function () { micTest(d.querySelector("#mtRes"), this); };
    d.querySelector(".dlg-ok").onclick = function () { save("micTips", 1); d.remove(); if (again) again(); };
  }
  // 2 s quiet -> noise floor, 4 s reciting -> speech level (RMS dBFS, WebAudio, nothing leaves the phone); SNR rates it.
  function micTest(out, btn) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { out.textContent = "المايك مش متاح هنا"; return; }
    if (btn) btn.disabled = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (st) {
      var AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), an = ac.createAnalyser(), buf = new Float32Array(2048);
      an.fftSize = 2048; ac.createMediaStreamSource(st).connect(an);
      var lv = [], t0 = Date.now(), noise = null;
      out.textContent = "اسكت ثانيتين…";
      var iv = setInterval(function () {
        an.getFloatTimeDomainData(buf); var e = 0; for (var i = 0; i < buf.length; i++) e += buf[i] * buf[i];
        lv.push(10 * Math.log10(e / buf.length + 1e-10));
        var dt = Date.now() - t0;
        if (noise === null && dt >= 2000) { lv.sort(function (a, b) { return a - b; }); noise = lv[Math.floor(lv.length / 2)]; lv = []; out.textContent = "اقرا آية بصوتك العادي ٤ ثواني…"; }
        if (dt >= 6000) {
          clearInterval(iv); st.getTracks().forEach(function (k) { k.stop(); }); try { ac.close(); } catch (e2) {}
          lv.sort(function (a, b) { return a - b; }); var sp = lv.length ? lv[Math.floor(lv.length * 0.8)] : noise, snr = Math.round(sp - noise);
          save("micTest", { snr: snr, noise: Math.round(noise), speech: Math.round(sp), t: Date.now() });
          var r = snr >= 25 ? "ممتاز" : snr >= 15 ? "كويس" : "ضعيف";
          out.textContent = "النتيجة: " + r + " (" + ar(snr) + " dB)" + (r === "ضعيف" ? (noise > -45 ? " · المكان فيه دوشة، جرّب مكان أهدى" : " · قرّب الموبايل أو ارفع صوتك شوية") : "");
          out.dataset.snr = snr; if (btn) btn.disabled = false; micTestRow();
        }
      }, 50);
    }).catch(function () { out.textContent = "ما قدرتش أفتح المايك، اتأكد من الإذن"; if (btn) btn.disabled = false; });
  }
  function micTestRow() {
    var b = document.getElementById("micTestSum"); if (!b) return; var m = load("micTest", null);
    b.textContent = m ? (m.snr >= 25 ? "ممتاز" : m.snr >= 15 ? "كويس" : "ضعيف") + " · " + ar(m.snr) + " dB" : "";
  }
  function micGate(again) {
    if (window.EdBridge && !modelOk()) {
      consentDlg(function () {
        if (window.NvBridge && NvBridge.ready()) return toast("تمام، دوس على المايك وابدأ");
        needAsr("asrnv", function () { asrPick("asrnv"); paintEdDl(); toast("خلص تنزيل نموذج التعرّف على التلاوة"); }); asrBtn();
      });
      return false;
    }
    if (!window.EdBridge || (window.NvBridge && NvBridge.ready())) { if (!load("micTips", 0)) { micTips(again); return false; } return true; }
    if (asrPacks("asrnv").some(function (k) { return edQ.indexOf(k) >= 0; })) { toast("نموذج التعرّف على التلاوة لسه بيتنزّل، تابعه من الإعدادات › التحميلات"); return false; }
    if (confirm("الميزة دي محتاجة نموذج التعرّف على التلاوة (" + ASRM.asrnv.mb + " ميجا). تنزّله دلوقتي؟")) needAsr("asrnv", function () { asrPick("asrnv"); paintEdDl(); toast("خلص تنزيل نموذج التعرّف على التلاوة"); });
    return false;
  }
  function asrReady(m) { return !!window.EdBridge && asrPacks(m).every(function (k) { return EdBridge.state(k) === "ready"; }); }
  function needAsr(m, then) {
    var ps = asrPacks(m), i = 0;
    toast("بدأ تنزيل " + ASRM[m].name + "، تقدر تتابعه من الإعدادات › التحميلات");
    (function go() { if (i >= ps.length) return then(); needEd(ps[i++], go, true); })();
  }
  function needEd(id, then, quiet) {
    if (id === "text" || !(EDS[id] || /^(asr|thm)/.test(id)) || edReady(id)) { then(); return; }
    edThen[id] = then;
    if (edQ.indexOf(id) < 0) edQ.push(id);
    if (!quiet) toast(window.LANG === "en" ? "Downloading " + T(EDS[id].name) + ". Follow it in Settings › Downloads." : "بدأ تنزيل " + EDS[id].name + "، تقدر تتابعه من الإعدادات › التحميلات");
    edNext(); paintEdDl();
  }
  function edNext() {
    if (!edQ.length || edQ.some(function (k) { return EdBridge.state(k) === "busy"; })) return;
    edPct[edQ[0]] = 0; EdBridge.download(edQ[0], edUrl(edQ[0]));
  }
  // Paused downloads (Settings › Downloads) stay paused across restarts until «استئناف».
  function edPaused() { return load("edPaused", []); }
  window.onEdDl = function (e, v) {
    if (v === "paused") { edQ = edQ.filter(function (k) { return k !== e; }); paintEdDl(); edNext(); return; }
    if (v === "done" || v === "error") {
      edQ = edQ.filter(function (k) { return k !== e; }); delete edPct[e];
      var th = edThen[e]; delete edThen[e];
      if (v === "done") { if (!/^(asr|thm)/.test(e) || th) { if (!/^(asr|thm)/.test(e)) toast(window.LANG === "en" ? T(EDS[e].name) + " is ready" : "خلص تنزيل " + EDS[e].name); } if (th) th(); }
      else { edPct[e] = -1; toast(window.LANG === "en" ? "The download failed. Check the internet and try again." : "التنزيل فشل. اتأكد من الإنترنت وحاول تاني."); }
      paintEdDl(); edNext(); return;
    }
    var s = document.querySelector('[data-dlp="' + e + '"]');
    if (v === "wait") { if (s) s.nextElementSibling.textContent = "النت فاصل، التنزيل هيكمّل لوحده…"; return; }
    edPct[e] = v;
    var am = e.replace(/p$/, "");
    if (ASRM[am]) { var aps = asrPacks(am); v = Math.round((aps.indexOf(e) * 100 + +v) / aps.length); }
    if (s) { s.querySelector("i").style.width = v + "%"; s.nextElementSibling.textContent = v + "%"; }
  };
  // A download cut off when the app was closed goes on by itself from where it stopped.
  setTimeout(function () { if (window.EdBridge) ["kfgqpc", "kfold", "shamarly", "harmain"].forEach(function (k) { if (EDS[k] && EdBridge.state(k) === "part" && edPaused().indexOf(k) < 0) needEd(k, function () {}, true); }); }, 1500);
  // Settings: each edition with its download state, to fetch or free it.
  function paintEdDl() {
    asrBtn(); var box = document.getElementById("edDl"); if (!box) return;
    if (!window.EdBridge) { ["dlGroup", "dlRow"].forEach(function (id) { document.getElementById(id).hidden = true; });
      var ab = document.getElementById("asrDl"); if (ab) ab.innerHTML = '<p class="hint">تنزيل النموذج شغال في التطبيق على الموبايل بس.</p>'; return; }
    var ids = ["kfgqpc", "kfold", "shamarly", "harmain"].filter(function (k) { return EDS[k]; }), any = false;
    var nm = function (k) { return EDS[k].name; };
    paintAsrDl();
    box.innerHTML = ids.map(function (k) {
      var st = EdBridge.state(k); if (st === "ready" && EDS[k]) any = true;
      var wait = st !== "ready" && edQ.indexOf(k) >= 0, p = edPct[k] || 0, held = st === "part" && !wait;
      return '<div class="dl-item"><div><b>' + nm(k) + "</b>" + (wait ? '<span class="dl-p" data-dlp="' + k + '"><i style="width:' + p + '%"></i></span><small>' + (st === "busy" ? p + "%" : "في الانتظار…") + "</small>" :
        "<small>" + (st === "ready" ? "✓ على الموبايل · " + ED_MB[k] + " ميجا" : edPct[k] === -1 ? "التنزيل فشل · " + ED_MB[k] + " ميجا" : held ? "متوقف مؤقتًا، هيكمّل من مكانه · " + ED_MB[k] + " ميجا" : "مش متنزّلة · " + ED_MB[k] + " ميجا") + "</small>") + "</div>" +
        (wait ? (st === "busy" ? '<button class="btn" data-pause="' + k + '">إيقاف مؤقت</button>' : "") :
          '<button class="btn" data-dl="' + k + '">' + (st === "ready" ? "حذف" : held ? "استئناف" : edPct[k] === -1 ? "حاول تاني" : "تنزيل") + "</button>") + "</div>";
    }).join("");
    document.getElementById("dlAll").hidden = !any;
    box.querySelectorAll("[data-dl]").forEach(function (b) { b.onclick = function () {
      var k = b.dataset.dl, st = EdBridge.state(k);
      if (st === "ready") { if (confirm(window.LANG === "en" ? "Delete the " + T(nm(k)) + " from the phone?" : "تحذف " + (EDS[k] ? "صفحات " : "") + nm(k) + " من الموبايل؟")) { EdBridge.remove(k); edGone(k); } }
      else if (st !== "busy") { delete edPct[k]; save("edPaused", edPaused().filter(function (x) { return x !== k; })); needEd(k, function () {}); }
    }; });
    box.querySelectorAll("[data-pause]").forEach(function (b) { b.onclick = function () {
      var k = b.dataset.pause; save("edPaused", edPaused().concat([k])); EdBridge.pause(k); b.disabled = true; b.textContent = "بيوقف…";
    }; });
  }
  // A deleted edition that is open: the reader goes on in the text until another edition is chosen.
  function edGone(k) {
    if (k === edition && mode === "pages") { mode = "text"; save("mode", "text"); applySettings(); if (/^#\/p\//.test(location.hash)) location.hash = "#/"; }
    paintEdDl();
  }
  document.getElementById("dlAll").onclick = function () {
    if (!window.EdBridge || !confirm("تحذف صفحات كل الطبعات من الموبايل؟ هتقدر تنزّلها تاني من هنا.")) return;
    ["kfgqpc", "kfold", "shamarly", "harmain"].forEach(function (k) { if (EDS[k] && EdBridge.state(k) === "ready") { EdBridge.remove(k); edGone(k); } });
  };
  var ED_MB = { kfgqpc: 52, kfold: 46, shamarly: 39, harmain: 46 };
  // 5.13: the thematic-margin images are gone from the app; free them on phones that fetched them.
  setTimeout(function () { try { if (window.EdBridge && EdBridge.state("thmnotes") === "ready") EdBridge.remove("thmnotes"); } catch (e) {} }, 3000);
  // Settings › Downloads: each recitation model, to fetch or free it.
  function paintAsrDl() {
    var box = document.getElementById("asrDl"); if (!box) return;
    box.innerHTML = Object.keys(ASRM).map(function (m) {
      var ps = asrPacks(m), ok = asrReady(m), q = ps.filter(function (k) { return edQ.indexOf(k) >= 0; });
      var cur = q.filter(function (k) { return EdBridge.state(k) === "busy"; })[0], p = cur ? edPct[cur] || 0 : 0;
      var step = cur ? ps.indexOf(cur) + 1 : 0;
      if (cur) p = Math.round(((step - 1) * 100 + p) / ps.length);   // one bar for the whole model, so it never jumps back to 0
      return '<div class="dl-item"><div><b>' + ASRM[m].name + "</b>" + (q.length ? '<span class="dl-p" data-dlp="' + (cur || q[0]) + '"><i style="width:' + p + '%"></i></span><small>' + (cur ? "جزء " + step + " من " + ps.length + " · " + p + "%" : "في الانتظار…") + "</small>" :
        "<small>" + (ok ? "✓ على الموبايل · " : "مش متنزّل · ") + ASRM[m].mb + " ميجا" + (asrOld(m) ? " · فيه نسخة جديدة أدق" : "") + "</small>") + "</div>" +
        (q.length ? "" : (asrOld(m) ? '<button class="btn" data-asrup="' + m + '">تحديث</button>' : "") + '<button class="btn" data-asrdl="' + m + '">' + (ok ? "حذف" : "تنزيل") + "</button>") + "</div>";
    }).join("");
    box.querySelectorAll("[data-asrup]").forEach(function (b) { b.onclick = function () { asrUpdate(b.dataset.asrup); }; });
    Object.keys(ASRM).forEach(function (m) { if (asrReady(m) && asrHave[m] === undefined) asrVerCheck(m, paintEdDl); });
    box.querySelectorAll("[data-asrdl]").forEach(function (b) { b.onclick = function () {
      var m = b.dataset.asrdl;
      if (asrReady(m)) {
        if (!confirm("تحذف " + ASRM[m].name + " من الموبايل؟")) return;
        EdBridge.remove(m); EdBridge.remove(m + "p"); delete asrHave[m];
        paintEdDl();
      } else { var go = function () { needAsr(m, function () { asrPick(m); paintEdDl(); }); }; if (modelOk()) go(); else consentDlg(go); }
    }; });
  }
  // Without the pages of the chosen edition (skipped download, or deleted) the reader opens the text until one is fetched.
  if (mode === "pages" && !edReady(edition) && load("onboarded", false)) mode = "text";
  // A tap on an edition not yet on the phone downloads it first, then goes on as a normal tap.
  document.getElementById("mode").addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b || edReady(b.dataset.v) || b.dataset.v === "text") return;
    ev.stopPropagation(); ev.preventDefault();
    var mb = { kfgqpc: 52, kfold: 46, shamarly: 39, harmain: 46 }[b.dataset.v], st = window.EdBridge && EdBridge.state(b.dataset.v);
    if (st !== "busy" && edQ.indexOf(b.dataset.v) < 0 && !confirm(window.LANG === "en" ? T(EDS[b.dataset.v].name) + " is not on the phone yet. Download it (about " + mb + " MB)?" : EDS[b.dataset.v].name + " مش متنزّلة على الموبايل. تنزّلها؟ (حوالي " + mb + " ميجا)")) return;
    needEd(b.dataset.v, function () { b.click(); });
  }, true);
  document.querySelectorAll("#mode button").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.dataset.v;
      var h = location.hash, sm = h.match(/^#\/s\/(\d+)\/(\d+)/), pm = h.match(/^#\/p\/(\d+)/);
      // The ayah being read, to open the same place in the new edition or in the text.
      var at = sm ? [+sm[1], +sm[2]] : pm ? (h.match(/[?&]a=(\d+):(\d+)/) || []).slice(1).map(Number) : null;
      if (pm && (!at || !at.length)) at = firstAyahOfPage(vCur && turnMode === "v" ? vCur : +pm[1]) || [surahOfPage(+pm[1]), 1];
      if (v !== "text" && v !== edition) switchEdition(v);
      mode = v === "text" ? "text" : "pages"; save("mode", mode); applySettings();
      // Show the change at once: the reading screen is redrawn behind the settings, which close so it can be seen.
      if (at && (sm || pm)) {
        var to = mode === "pages" ? "#/p/" + pageOf(at[0], at[1]) : "#/s/" + at[0] + "/" + at[1];
        if (pm && mode === "pages") to = location.hash;
        if (to === location.hash) route(); else location.hash = to;
        sheet.hidden = true;
      }
    });
  });
  document.querySelectorAll("#tjSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      tjOn = tjPg = b.dataset.v === "on"; save("tajweed", tjOn); applySettings();
      if (/^#\/(s|a)\//.test(location.hash)) routeKeepSheet(true);
    });
  });
  document.querySelectorAll("#thmSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      thmOn = b.dataset.v === "on"; save("thematic", thmOn); applySettings();
      if (/^#\/p\//.test(location.hash)) routeKeepSheet();
    });
  });
  setTimeout(function () {
    var lg = document.getElementById("thmLegend"); if (!lg) return;
    lg.innerHTML = THM_NAMES.map(function (t, i) { return '<li><i style="background:linear-gradient(90deg,' + THM_COL[i][0] + " 50%," + THM_COL[i][1] + ' 50%)"></i>' + t + "</li>"; }).join("");
  }, 0);
  document.querySelectorAll("#trSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      trOn = b.dataset.v === "on"; save("translation", trOn); applySettings();
      if (/^#\/s\//.test(location.hash)) routeKeepSheet(true);
    });
  });
  // Training clips are only kept after an explicit yes; switching it off stops new clips, and «امسح كل تسجيلاتي» also deletes
  // the ones already sent (NvBridge.forget, via the relay). The phone (Donations.java) keeps its own random id; q.donateId
  // is the id 4.8 made here, kept only so those older clips can be deleted too.
  // Recognition stats kept on the phone only (q.asrStats, last 30 days): u utterances heard, w words heard, ok/bad words
  // judged in voice tests, rh/rm words followed/missed while reading a page aloud, loc/lost ayat found or not by the
  // index and search mics. Shown in Settings, to see where recognition is weak (quiet, noise, another reader).
  function asrStat(k, n) {
    var S = load("asrStats", {}), d = todayStr(), e = S[d] = S[d] || {}; e[k] = (e[k] || 0) + (n == null ? 1 : n);
    var ks = Object.keys(S); if (ks.length > 30) ks.sort(function (x, y) { return parseDay(x) - parseDay(y); }).slice(0, ks.length - 30).forEach(function (x) { delete S[x]; });
    save("asrStats", S);
  }
  function asrStatsText() {
    var S = load("asrStats", {}), t = {}, today = dayNum(new Date());
    Object.keys(S).forEach(function (d) { if (today - parseDay(d) < 7) for (var k in S[d]) t[k] = (t[k] || 0) + S[d][k]; });
    if (!t.u) return "";
    var pc = function (a, b) { return a + b ? ar(Math.round(a * 100 / (a + b))) + "٪" : "—"; };
    return "آخر ٧ أيام: " + ar(t.u) + " مقطع، " + ar(t.w || 0) + " كلمة · التسميع صح " + pc(t.ok || 0, t.bad || 0) +
      " · المتابعة في الصفحة " + pc(t.rh || 0, t.rm || 0) + " · الفهرس والبحث لقوا الآية " + pc(t.loc || 0, t.lost || 0) + (t.ctc ? " · كلمات صحّحها فحص الموديل " + ar(t.ctc) : "");
  }
  function donatePaint() {
    var ase = document.getElementById("asrStats"); if (ase) ase.textContent = asrStatsText();
    var v = load("donate", 0), mob = load("donateMobile", 0);
    document.querySelectorAll("#donateSet button").forEach(function (b) { b.classList.toggle("on", +b.dataset.v === v); });
    document.querySelectorAll("#donateMob button").forEach(function (b) { b.classList.toggle("on", +b.dataset.v === mob); });
    var el = document.getElementById("donateStats"), st = {};
    try { st = JSON.parse(NvBridge.donateStats()); } catch (e) {}
    var rej = 0, why = [], WHY = { quiet: "صوت واطي", noisy: "دوشة", clipped: "صوت عالي زيادة", length: "قصير أو طويل", full: "المساحة مليانة", error: "خطأ", gone: "ضاع" };
    for (var k in st.rejected || {}) { rej += st.rejected[k]; why.push((WHY[k] || (k.indexOf("srv:") === 0 ? "السيرفر: " + k.slice(4) : k)) + " " + ar(st.rejected[k])); }
    // rejected = not kept when recorded (or refused by the server), not a network problem: the waiting ones go out later
    if (el) el.textContent = st.waiting == null ? "" : "مستني يترفع: " + ar(st.waiting) + " مقطع · ما اتحفظش: " + ar(rej) + (why.length ? " (" + why.join("، ") + ")" : "");
  }
  document.querySelectorAll("#donateSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.v === "1" && !confirm((window.T || String)("توافق إن التطبيق يحفظ مقاطع من صوتك وقت التسميع ويبعتها من غير أي بيانات شخصية لتحسين التعرّف على التلاوة؟"))) return;
      save("donate", +b.dataset.v); donatePaint(); donateSend();
    });
  });
  document.querySelectorAll("#donateMob button").forEach(function (b) {
    b.addEventListener("click", function () { save("donateMobile", +b.dataset.v); donatePaint(); donateSend(); });
  });
  // 5.11: the delete button is a small link inside the privacy policy (ar + en «About»), not in the general settings.
  document.querySelectorAll("[data-donatedel]").forEach(function (b) { b.onclick = donateDelete; });
  function donateDelete() {
    if (!window.NvBridge || !NvBridge.forget) return toast("المسح متاح في التطبيق على الموبايل بس");
    if (!confirm((window.T || String)("تمسح كل المقاطع اللي اتبعتت من الجهاز ده واللي لسه مستنية؟ ده كمان هيوقف التبرّع."))) return;
    save("donate", 0); donatePaint(); toast("بيمسح…");
    try { NvBridge.forget(load("donateId", "")); } catch (e) { toast("المسح ما نجحش، جرّب تاني"); }
  }
  window.onDonateForget = function (ok) {
    if (ok) save("donateId", "");
    toast(ok ? "اتمسحت كل تسجيلاتك" : "المسح ما نجحش، اتأكد من النت وجرّب تاني"); donatePaint();
  };
  donatePaint();
  // Waiting clips go out in the background (DonateJob): on Wi-Fi, or any network if the reader allowed mobile data.
  function donateSend() {
    if (load("donate", 0) !== 1 || !window.NvBridge || !NvBridge.sendDonations) return;
    try { NvBridge.sendDonations(load("donateMobile", 0) === 1); } catch (e) {}
  }
  setTimeout(donateSend, 5000);
  document.querySelectorAll("#hapticSet button").forEach(function (b) {
    b.addEventListener("click", function () { save("hapticLevel", +b.dataset.v); applySettings(); });
  });
  document.querySelectorAll("#spreadSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      spreadPref = b.dataset.v === "on"; save("spread", spreadPref); applySettings();
      if (/^#\/p\//.test(location.hash)) routeKeepSheet();
    });
  });
  // Every button and link answers a tap with the chosen buzz, except page turns (asked) and the azkar counter (its own vibration).
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("button, a, select, label.row, .swatches label");
    if (t && !t.closest(".z-count, #pNext, #pPrev, #tsbBtn")) tick();
  });
  var sheet = document.getElementById("settings");
  // Open drop-downs (downloads, colour key, about) fold again whenever Settings closes; the page mic hides under it.
  new MutationObserver(function () {
    document.body.classList.toggle("sheet-open", !sheet.hidden);
    if (sheet.hidden) sheet.querySelectorAll("details[open]").forEach(function (d) { d.open = false; });
  }).observe(sheet, { attributes: true, attributeFilter: ["hidden"] });
  document.getElementById("btnSettings").onclick = function () { var sb = sheet.querySelector(".sheet-body"); if (sb) sb.classList.remove("still"); sheet.hidden = false; paintEdDl(); paintBk(); };
  document.getElementById("closeSettings").onclick = function () { sheet.hidden = true; };
  sheet.addEventListener("click", function (e) { if (e.target === sheet) sheet.hidden = true; });
  document.getElementById("btnSearch").onclick = function () { location.hash = "#/search"; };
  // Elastic ends: pulling past the top or bottom of a scrolled screen stretches it a little, and it springs back on release.
  // The same on every list that scrolls by itself: Settings, the index, any sheet.
  function elastic(v, own, mv) {
    var y0 = null, edge = 0; mv = mv || v;
    function atEnd(dir) {
      if (own) return dir > 0 ? v.scrollTop <= 0 : v.scrollTop + v.clientHeight >= v.scrollHeight - 1;
      return dir > 0 ? window.scrollY <= 0 : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;
    }
    v.addEventListener("touchstart", function (e) {
      y0 = e.touches.length === 1 && (own || !/^#\/p\//.test(location.hash)) && !e.target.closest("input[type=range]") ? e.touches[0].clientY : null; edge = 0;
      mv.classList.remove("springback");
    }, { passive: true });
    v.addEventListener("touchmove", function (e) {
      if (y0 === null) return;
      var y = e.touches[0].clientY;
      if (!edge) { var dir = y > y0 ? 1 : -1; if (y === y0 || !atEnd(dir)) return; edge = dir; y0 = y; }
      var d = (y - y0) * edge;
      if (d < 0) { edge = 0; mv.style.transform = ""; return; }
      if (e.cancelable) e.preventDefault();
      mv.style.transform = "translateY(" + (edge * 110 * (1 - Math.exp(-d / 260))).toFixed(1) + "px)";
    }, { passive: false });
    function release() { if (edge) { mv.classList.add("springback"); mv.style.transform = ""; } y0 = null; edge = 0; }
    v.addEventListener("touchend", release); v.addEventListener("touchcancel", release);
  }
  elastic(document.getElementById("view"), false);
  document.querySelectorAll(".sheet-body").forEach(function (el) { elastic(el, true); });
  elastic(document.getElementById("index"), true, document.getElementById("indexBody"));
  window.qBack = function () {
    var d = document.querySelector(".dlg-back");
    if (d) { d.remove(); return true; }
    if (!sheet.hidden) { sheet.hidden = true; return true; }
    if (!indexSheet.hidden) { indexSheet.hidden = true; return true; }
    var x = document.querySelector('#ayahBar button[data-c="x"]');
    if (x) { x.click(); return true; }
    if (/^#\/p\//.test(location.hash) && document.body.classList.contains("fs")) { fsSet(false); return true; }
    return navBack(true);
  };
  // Back (5.6): the first back goes one screen back, the next one home; two backs within 1.5 s anywhere leave the app
  // ("exit" tells MainActivity to finish). qBackN counts backs since the last screen the reader opened.
  var qBackN = 0, qBacking = false, qExitAt = 0;
  window.addEventListener("hashchange", function () { if (qBacking) qBacking = false; else qBackN = 0; });
  function navBack(hw) {
    var home = !location.hash || location.hash === "#/" || location.hash === "#", now = Date.now();
    if (hzFrom && /^#\/(p|s|hifztest)\//.test(location.hash)) {
      hzFrom = false; qBackN = 0; location.hash = "#/hifzlog"; setTimeout(function () { window.scrollTo(0, 0); }, 0); return true;
    }
    if (location.hash === "#/hifzlog") { qBackN = 0; location.replace("#/"); return true; }   // 5.15c item 2
    if (hw && now - qExitAt < 1500) return "exit";
    if (hw) qExitAt = now;
    if (home) { if (hw) toast(window.LANG === "en" ? "Press back again to exit" : "اضغط رجوع مرة تانية عشان تخرج"); return true; }
    if (qBackN < 1 && history.length > 1) { qBackN++; qBacking = true; history.back(); }
    else { qBackN = 0; location.replace("#/"); }
    return true;
  }
  btnBack.onclick = function () { navBack(false); };
  // Before 3.0 there was only the scanned edition: carry its reading place and khatma over to the new default edition.
  if (EDS.harmain && load("edition", null) === null && edition !== "harmain" && (load("lastPage", null) !== null || load("khatma", null))) {
    var to = edition; useEdition("harmain"); switchEdition(to);
  }
  var thmOn = load("thematic", false);
  applySettings();

  // ---------- views ----------
  var homeTab = load("tab", "surah");

  function showHome() {
    titleEl.textContent = "القرآن الكريم";
    btnBack.hidden = true;
    var last = load("last", null), lastPage = load(edKey("lastPage"), null);
    var html = "";
    if (mode === "pages" && lastPage) {
      html += hero("سورة " + Q.s[surahOfPage(lastPage) - 1][0], "صفحة " + ar(lastPage) + " · الجزء " + JUZ_NAMES[juzOfPage(lastPage) - 1]);
    } else if (last) {
      html += hero("سورة " + Q.s[last[0] - 1][0], "الآية " + ar(last[1]));
    } else html += hero("سورة الفاتحة", "ابدأ القراءة من أول المصحف");
    var hj = hijri(new Date()), fs = fastOf(new Date());
    if (hj) html += '<div class="hj-bar">' + ic("moon") + "<span>" + new Date().toLocaleDateString(window.LANG === "en" ? "en-GB" : "ar-EG", { weekday: "long" }) + " " + hj.text + "</span>" + (fs ? "<small>يُستحب صيامه: " + fs + "</small>" : "") + "</div>";
    // 5.16 U5: with a memorised surah, «هدف اليوم» lives inside the «النهارده» card (one card, no repeat)
    var td = todayCard();
    html += '<div class="home-row' + (td ? " one" : "") + '"><button class="mini" id="tPrayer">' + ic("clock") + "<span>" + prayerTileText() + "</span></button>" + (td ? "" : goalCard()) + "</div>";
    html += khatmaCard() + td;
    // 5.13 P2.2: the mic is always on the home screen: it finds the ayah being recited anywhere in the Quran, opens its
    // page and follows the reading there (the same rdToggle / rdHear as the mic on the mushaf)
    rdPage = null;
    view.innerHTML = html + '<div id="idx"></div>' + rdMicHtml();
    document.getElementById("kCard").onclick = function () { location.hash = "#/khatma"; };
    var tdG = document.getElementById("tdGo"); if (tdG) tdG.onclick = function (ev) { ev.stopPropagation(); hzWardTest(); };
    var tdC = document.getElementById("tdCard"); if (tdC) tdC.onclick = function () { location.hash = "#/hifzlog"; };
    document.getElementById("tPrayer").onclick = function () { location.hash = "#/prayer"; };
    document.getElementById("tGoal").onclick = function (ev) { ev.stopPropagation(); goalDialog(); };
    if (mode === "pages" && lastPage) document.getElementById("cont").onclick = function () { openPage(lastPage); };
    else if (last) document.getElementById("cont").onclick = function () { go(last[0], last[1]); };
    else document.getElementById("cont").onclick = function () { mode === "pages" ? openPage(pageOf(1, 1)) : go(1, 1); };
    mountIndex(document.getElementById("idx"), 0);
  }

  function hero(title, sub) {
    return '<button class="hero" id="cont"><div class="hero-txt"><small>متابعة القراءة</small><b>' + title + "</b><span>" + sub +
      '</span></div><span class="hero-go">' + ic("play") + "</span></button>";
  }

  // Surah / juz index (فهرس), used on the home screen and in the index sheet.
  // current = surah to highlight and scroll to (0 for none).
  function mountIndex(box, current) {
    box.innerHTML = '<div class="tabs"><button data-t="surah">السور</button><button data-t="juz">الأجزاء</button></div>' +
      '<input class="input idx-filter" placeholder="ابحث عن سورة بالاسم أو الرقم"><ul class="list"></ul>';
    var list = box.querySelector(".list"), filter = box.querySelector(".idx-filter"), tabs = box.querySelectorAll(".tabs button");
    function render() {
      tabs.forEach(function (b) { b.classList.toggle("on", b.dataset.t === homeTab); });
      filter.hidden = homeTab !== "surah";
      var out = "";
      if (homeTab === "surah") {
        var raw = en(filter.value.trim()), f = norm(raw), lat = raw.toLowerCase();
        Q.s.forEach(function (s, i) {
          if (raw) {
            var ok = /^\d+$/.test(raw) ? +raw === i + 1
              : (f && norm(s[0]).indexOf(f) >= 0) || s[1].toLowerCase().indexOf(lat) >= 0;
            if (!ok) return;
          }
          out += '<li data-s="' + (i + 1) + '"' + (i + 1 === current ? ' class="cur"' : "") + '><div class="num"><span>' + ar(i + 1) +
            '</span></div><div class="name">' + s[0] + '</div><div class="meta">' + (s[2] ? "مدنية" : "مكية") + " · " + ar(s[3]) +
            " آية<br>صفحة " + ar(Q.p[i][0]) + "</div></li>";
        });
      } else {
        JUZ.forEach(function (p, i) {
          var txt = Q.t[p[0] - 1][p[1] - 1].split(" ").slice(0, 4).join(" ");
          out += '<li data-s="' + p[0] + '" data-a="' + p[1] + '"><div class="num"><span>' + ar(i + 1) + '</span></div><div class="name">الجزء ' +
            JUZ_NAMES[i] + '</div><div class="meta">' + Q.s[p[0] - 1][0] + " " + ar(p[1]) + " · صفحة " + ar(pageOf(p[0], p[1])) + "<br>" + esc(txt) + "…</div></li>";
        });
      }
      list.innerHTML = out;
    }
    tabs.forEach(function (b) {
      b.onclick = function () { homeTab = b.dataset.t; save("tab", homeTab); render(); };
    });
    filter.addEventListener("input", render);
    list.addEventListener("click", function (e) {
      var li = e.target.closest("li"); if (li) go(+li.dataset.s, li.dataset.a ? +li.dataset.a : 1);
    });
    render();
    var cur = list.querySelector(".cur");
    if (cur) cur.scrollIntoView({ block: "center" });
  }

  var indexSheet = document.getElementById("index");
  var currentSurah = 0;
  document.getElementById("btnIndex").onclick = function () {
    indexSheet.hidden = false;
    mountIndex(document.getElementById("indexBody"), currentSurah);
  };
  document.getElementById("closeIndex").onclick = function () { indexSheet.hidden = true; };

  function withTranslation(done) {
    if (window.TR_EN) { done(); return; }
    need("tr", "translation-en.js", function () { if (window.TR_EN) done(); });
  }
  function trOf(s, a) { return trOn && window.TR_EN ? '<span class="tr-en" dir="ltr">' + esc(TR_EN[s - 1][a - 1]) + "</span>" : ""; }
  function showSurah(s, a, nq) {
    if (tjOn && !nq && !window.TAJWEED) { withTajweed(function () { if (location.hash.indexOf("#/s/" + s + "/") === 0) route(); }); }
    if (trOn && !window.TR_EN) { withTranslation(function () { if (location.hash.indexOf("#/s/" + s + "/") === 0) route(); }); }
    var meta = Q.s[s - 1];
    currentSurah = s;
    titleEl.textContent = "سورة " + meta[0];
    btnBack.hidden = false;
    var html = '<div class="surah-head">سورة ' + meta[0] + "<small>" + (meta[2] ? "مدنية" : "مكية") + " · " + ar(meta[3]) +
      " آية · " + esc(meta[1]) + "</small></div>";
    if (s !== 1 && s !== 9) html += '<div class="basmala">' + BASMALA + "</div>";
    if (nq && mode === "pages") {
      html += '<button class="continue" id="toPage">افتح الآية ' + ar(a) + " في صفحة المصحف (صفحة " + ar(pageOf(s, a)) + ")" +
        "<small>الآية مظللة بالأصفر في صفحة المصحف</small></button>";
    }
    html += '<div class="page-tools"><button id="sHifz">' + ic(hifz.on ? "eye" : "eyeoff") + (hifz.on ? "إنهاء وضع الحفظ" : "وضع الحفظ والمراجعة") + "</button></div>";
    html += '<div class="quran">';
    Q.t[s - 1].forEach(function (t, i) {
      var n = i + 1;
      for (var j = 0; j < 30; j++) if (JUZ[j][0] === s && JUZ[j][1] === n && n !== 1) html += '<span class="juz-mark">الجزء ' + JUZ_NAMES[j] + "</span>";
      html += '<span class="ayah' + (trOn ? " with-tr" : "") + '" id="a' + n + '" data-a="' + n + '">' + (nq ? highlight(s, n, nq) : ayahHtml(s, n)) + ' <span class="ayah-no">﴿' + ar(n) + "﴾</span>" + trOf(s, n) + "</span> ";
    });
    html += "</div>";
    html += '<div class="nav-row">' +
      (s < 114 ? '<button id="next">السورة التالية: ' + Q.s[s][0] + "</button>" : "") +
      (s > 1 ? '<button id="prev">السورة السابقة: ' + Q.s[s - 2][0] + "</button>" : "") + "</div>";
    view.innerHTML = html;

    if (nq && mode === "pages") document.getElementById("toPage").onclick = function () { openAyahPage(s, a, nq); };
    if (s < 114) document.getElementById("next").onclick = function () { go(s + 1, 1); };
    if (s > 1) document.getElementById("prev").onclick = function () { go(s - 1, 1); };

    document.getElementById("sHifz").onclick = function () { hifzToggle(); };
    if (hifz.on) { hifz.pages = null; hifz.box = null; }   // the text view: no page to turn or follow
    if (hifz.on) hifzMount(Q.t[s - 1].map(function (t, i) { return s + ":" + (i + 1); }), function () {
      view.querySelectorAll(".ayah").forEach(function (x) {
        var k = s + ":" + x.dataset.a, bad = hifz.shown[k] ? reciteBad(k) : [], sig = bad.join(",");
        x.classList.toggle("hid", !hifz.shown[k]);
        // a recited ayah with wrong words: its words written plainly with those in red
        if (sig !== (x.dataset.rc || "")) {
          x.dataset.rc = sig; var ws = rWords(k);
          x.innerHTML = (sig ? ws.map(function (w, i) { return bad.indexOf(i) >= 0 ? '<span class="rc-bad">' + w + "</span>" : w; }).join(" ") : ayahHtml(s, +x.dataset.a)) +
            ' <span class="ayah-no">﴿' + ar(+x.dataset.a) + "﴾</span>" + trOf(s, +x.dataset.a);
        }
      });
    });
    var lp = null, lpDone = 0, qv = view.querySelector(".quran");
    qv.addEventListener("pointerdown", function (e) {
      if (hifz.on || e.button) return; var x0 = e.clientX, y0 = e.clientY, sp = e.target.closest(".ayah"); if (!sp) return;
      clearTimeout(lp); lp = setTimeout(function () {
        lp = null; var n = rWords(s + ":" + sp.dataset.a).length, wi = wordAt(sp, x0, y0); if (wi < 0) return;
        lpDone = Date.now(); if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {}
        wi = Math.min(wi, n - 1); wordSheet(s, +sp.dataset.a, wi, rWords(s + ":" + sp.dataset.a)[wi]);
      }, 480);
      sp._lpMove = function (ev) { if (Math.abs(ev.clientX - x0) > 10 || Math.abs(ev.clientY - y0) > 10) { clearTimeout(lp); lp = null; } };
      qv._lpSp = sp;
    });
    qv.addEventListener("pointermove", function (e) { if (lp && qv._lpSp && qv._lpSp._lpMove) qv._lpSp._lpMove(e); });
    ["pointerup", "pointercancel"].forEach(function (t) { qv.addEventListener(t, function () { clearTimeout(lp); lp = null; }); });
    qv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    qv.addEventListener("click", function (e) {
      var sp = e.target.closest(".ayah"); if (!sp) return;
      if (Date.now() - lpDone < 700) return;   // the click that ends a long press
      if (hifz.on) return hifzFlip(s + ":" + sp.dataset.a);
      view.querySelectorAll(".ayah.sel").forEach(function (x) { x.classList.remove("sel"); });
      sp.classList.add("sel");
      save("last", [s, +sp.dataset.a]);
      ayahBar(s, +sp.dataset.a, function () { sp.classList.remove("sel"); });
    });

    var target = document.getElementById("a" + a);
    if (a > 1 && target) {
      target.classList.add("sel");
      setTimeout(function () { scrollUnderBar(target); }, 0);   // the ayah sits at the top, just under the bar
    } else {
      window.scrollTo(0, 0);
    }
    player.paint();
    var last = load("last", null);
    if (!last || last[0] !== s) save("last", [s, a]);
  }

  var lastQuery = "";
  // Search with conditions, as in Google: words separated by spaces must all be in the ayah; OR (or | or أو) between
  // words means either; a minus before a word (-word) leaves out ayat that have it; "words in quotes" must come together
  // in that order; brackets group, e.g. (موسى OR هارون) فرعون -السحرة. Each word matches anywhere in a word of the ayah,
  // as the plain search does. Returns {test(indexRow), marks: [the words to mark]} or null when there is nothing to look for.
  var SEARCH_HELP = '<div class="s-help"><b>البحث بالشروط</b>' +
    '<p><code>الصلاة الزكاة</code> الآيات التي فيها الكلمتان معًا</p>' +
    '<p><code>موسى OR هارون</code> أيٌّ منهما، ويصلح <code>|</code> أو <code>أو</code> مكان OR</p>' +
    '<p><code>الجنة -الأنهار</code> فيها الجنة وليس فيها الأنهار</p>' +
    '<p><code>"رب العالمين"</code> الكلمات متتالية بنفس الترتيب</p>' +
    '<p><code>(موسى OR هارون) فرعون</code> الأقواس لتجميع الشروط</p></div>';
  function parseQuery(raw) {
    var toks = [], re = /\s*(?:("[^"]*"?)|(\()|(\))|(\|)|(-?)([^\s()"|]+))/g, m, marks = [];
    while ((m = re.exec(raw))) {
      if (m[1] !== undefined) toks.push({ t: "w", v: norm(m[1].replace(/"/g, "")), not: false });
      else if (m[2]) toks.push({ t: "(" }); else if (m[3]) toks.push({ t: ")" }); else if (m[4]) toks.push({ t: "or" });
      else if (/^(OR|or|أو)$/.test(m[6]) && !m[5] && toks.length && toks[toks.length - 1].t !== "or") toks.push({ t: "or" });
      else toks.push({ t: "w", v: norm(m[6]), not: m[5] === "-" });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    toks = toks.filter(function (x) { return x.t !== "w" || x.v; });
    if (toks.length && toks[toks.length - 1].t === "or") toks.pop();
    var i = 0;
    function term(v, not) { return function (r) { return (r[2].indexOf(v) >= 0 || r[3].indexOf(v) >= 0) !== not; }; }
    function orExpr() {
      var parts = [andExpr()];
      while (i < toks.length && toks[i].t === "or") { i++; parts.push(andExpr()); }
      parts = parts.filter(Boolean);
      return parts.length < 2 ? parts[0] || null : function (r) { return parts.some(function (f) { return f(r); }); };
    }
    function andExpr() {
      var parts = [];
      while (i < toks.length && toks[i].t !== "or" && toks[i].t !== ")") {
        var x = toks[i++], f = null;
        if (x.t === "(") { f = orExpr(); if (i < toks.length && toks[i].t === ")") i++; }
        else if (x.t === "w") {
          f = term(x.v, x.not);
          if (!x.not && x.v.replace(/ /g, "").length >= 2) marks.push(x.v);
        }
        if (f) parts.push(f);
      }
      return !parts.length ? null : function (r) { return parts.every(function (f) { return f(r); }); };
    }
    var test = orExpr();
    // The one-word search keeps its old rule of two letters at least.
    if (!test || !marks.length) return null;
    return { test: test, marks: marks };
  }
  function showSearch(q) {
    titleEl.textContent = "البحث";
    btnBack.hidden = false;
    view.innerHTML = '<div class="q-row"><input id="q" class="input" type="search" placeholder="ابحث في الآيات والسور والأذكار، أو ٢:٢٥٥" autocomplete="off">' +
      '<button id="qMic" class="q-mic" aria-label="أوامر صوتية">' + ic("mic") + "</button></div>" + '<p class="hint q-mic-hint" hidden></p><div id="res"></div>';
    var input = document.getElementById("q"), res = document.getElementById("res");
    input.value = q || lastQuery;
    var timer, hq = "";
    function run() {
      hq = "";
      var raw = input.value.trim(); lastQuery = raw;
      history.replaceState(null, "", "#/search?q=" + encodeURIComponent(raw));
      if (!raw) { res.innerHTML = '<p class="hint">ابحث بالكلمات دون تشكيل، مثل: الصلاة، يؤمنون، الرحمن. أو اكتب رقم السورة والآية مثل 2:255.</p>' +
        '<p class="hint">🎤 دوس المايك وقول أمر: «افتح سورة الكهف»، «صفحة خمسين»، «الجزء الثلاثين»، «سورة البقرة آية مية»، «آية الكرسي»، «شغّل»، «وقف»، «الصفحة التالية»، «مواقيت الصلاة»، «أذكار الصباح». أو اقرأ آية وهيطلعلك مكانها.</p>' + SEARCH_HELP; return; }
      var m = en(raw).match(/^(\d{1,3})\s*[:\/\-\s]\s*(\d{1,3})$/);
      if (m) {
        var s = +m[1], a = +m[2];
        if (s >= 1 && s <= 114 && a >= 1 && a <= Q.s[s - 1][3]) {
          res.innerHTML = item(s, a); return;
        }
      }
      var qx = parseQuery(raw);
      if (!qx) { res.innerHTML = '<p class="hint">اكتب حرفين على الأقل.</p>'; return; }
      hq = qx.marks.join("|");
      if (!index) buildIndex();
      var hits = [];
      for (var i = 0; i < index.length; i++) if (qx.test(index[i])) hits.push(index[i]);
      var nr = norm(raw), extra = "";
      if (nr.length >= 2) {
        var sur = []; for (var si = 0; si < 114; si++) if (norm(Q.s[si][0]).indexOf(nr) >= 0) sur.push(si + 1);
        if (sur.length) extra += '<div class="sr-sec"><b>السور</b><div class="sr-chips">' + sur.slice(0, 12).map(function (x) { return '<a href="#/s/' + x + '/1">' + ar(x) + ". " + Q.s[x - 1][0] + "</a>"; }).join("") + "</div></div>";
        // The search is the Quran's: ayahs and surah names only (adhkar and duas have their own screens).
      }
      var html = extra + '<p class="hint">' + (hits.length ? "عدد النتائج: " + ar(hits.length) + (hits.length > 300 ? " (تُعرض أول ٣٠٠)" : "") : "لا توجد نتائج") + "</p>";
      hits.slice(0, 300).forEach(function (r) { html += item(r[0], r[1]); });
      res.innerHTML = html;
    }
    function item(s, a) {
      return '<div class="result" data-s="' + s + '" data-a="' + a + '"><div class="ref">سورة ' + Q.s[s - 1][0] + " · الآية " + ar(a) +
        " · الجزء " + ar(juzOf(s, a)) + " · صفحة " + ar(pageOf(s, a)) + '</div><div class="txt">' + highlight(s, a, hq) + "</div></div>";
    }
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 200); });
    var mic = document.getElementById("qMic"), mh = view.querySelector(".q-mic-hint");
    mic.onclick = function () {
      voiceListen(function (text, kind) {
        if (kind === "listening") { mic.classList.add("on"); mh.hidden = false; mh.textContent = "سامعك… قول أمر زي «افتح سورة الكهف» أو «صفحة خمسين»، أو اقرأ آية."; return; }
        if (kind === "end") { mic.classList.remove("on"); return; }
        input.value = text; mic.classList.toggle("on", kind !== "final");
        if (kind !== "final") return;
        mh.hidden = true;
        var got = voiceLocate(text), near = voiceAyahs(text);
        asrStat(got ? "loc" : "lost");
        if (got) near = [[1, got.s, got.a]].concat(near.filter(function (x) { return x[1] !== got.s || x[2] !== got.a; })).slice(0, 5);
        if (!(got || (near.length && near[0][0] >= 0.85)) && voiceRun(text)) return;
        run();
        if (near.length) res.insertAdjacentHTML("afterbegin", '<div class="sr-sec"><b>أقرب آيات لقراءتك</b></div>' + near.map(function (x) { return item(x[1], x[2]); }).join(""));
      });
    };
    // Opens the ayah highlighted on its mushaf page (or in the text view), with the search word marked.
    res.addEventListener("click", function (e) {
      var d = e.target.closest(".result"); if (!d) return;
      var s = +d.dataset.s, a = +d.dataset.a;
      if (mode === "pages") openAyahPage(s, a, hq);
      else location.hash = "#/s/" + s + "/" + a + (hq ? "?h=" + encodeURIComponent(hq) : "");
    });
    run();
    if (!input.value) input.focus();
  }

  // Tajweed colours on the scan: a transparent layer with the ink of each tajweed letter recoloured
  // (tools/page_geometry/tajweed_pages.py). Shown when the setting is on (CSS, :root.tjpg).
  function tjLayer(n) {
    return (EDS[edition].tj && n >= Q.first && n <= Q.last ? '<img class="tjo" alt="" loading="lazy" src="' + EDS[edition].tj + pad(n) + '.webp" onerror="this.remove()">' : "") + thmLayer(n);
  }
  // «التفصيل الموضوعي» colours (thematic.js, Dar al-Fajr al-Islami): each ayah's boxes tinted by its topic colour.
  var thmPages = null, thmEd = null;
  var THM_COL = [["#e6f6fa", "#c9ebf2"], ["#e9f5e6", "#cfeac6"], ["#f8dde0", "#efbfc3"], ["#fdf8dc", "#fbefaa"], ["#ece3f0", "#d8c9e8"], ["#fee4d4", "#fdcdb0"], ["#fde3ef", "#f9cadf"]];
  var THM_NAMES = ["آيات الله في الكون والأنفس، وفضله على عباده", "النبي ﷺ والمؤمنون وجزاؤهم والجنة", "آيات الأحكام", "قصص الرسل والأنبياء والأمم السابقة", "القرآن الكريم، وصفات الإنسان، والرد على المشركين، وسنة الله في خلقه", "يوم القيامة وعلاماته، والموت والقبر والحساب والحشر والبعث", "جهنم وأوصافها، وعذاب المشركين والكافرين فيها"];
  function thmLayer(n) {
    if (!thmOn || !window.THEMATIC || !Q.r) return "";
    if (thmEd !== edition || !thmPages) {
      thmPages = {}; thmEd = edition;
      Q.r.forEach(function (sur, si) { sur.forEach(function (bs, ai) { (bs || []).forEach(function (b) { (thmPages[b[0]] = thmPages[b[0]] || []).push([si, ai, b]); }); }); });
    }
    return (thmPages[n] || []).map(function (x) {
      var k = THEMATIC[x[0]].charCodeAt(x[1]) - 97, b = x[2]; if (!(k >= 0)) return "";
      return '<i class="thm" style="background:' + THM_COL[k >> 1][k & 1] + ";left:" + b[1] / 10 + "%;top:" + b[2] / 10 + "%;width:" + (b[3] - b[1]) / 10 + "%;height:" + (b[4] - b[2]) / 10 + '%"></i>';
    }).join("");
  }
  // Tablet held sideways: two pages side by side like an open mushaf (the even page on the right, as printed: 2-3, 4-5, ...).
  function spreadOn() { return mode === "pages" && spreadPref && window.innerWidth > window.innerHeight && window.innerWidth >= 900 && window.innerHeight >= 500; }
  var lastSpread = null;
  window.addEventListener("resize", function () {
    if (/^#\/p\//.test(location.hash) && lastSpread !== null && spreadOn() !== lastSpread) route();
  });
  // ---------- vertical reading: every page of the edition in one scroll ----------
  var vCur = 0, vHold = false, vHz = null;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function showPagesV(n, hl) {
    var ed = EDS[edition], ratio = edition === "harmain" ? 160.6 : edition === "kfgqpc" ? 143.7 : edition === "kfold" ? 143.5 : 141.4, html = '<div class="vpages">';
    btnBack.hidden = false;
    document.body.classList.add("vread");
    for (var p = Q.min; p < Q.count; p++) {
      // vp-c is the visible (cropped) part; the .page-box inside keeps the whole image's coordinates, so ayah boxes,
      // taps and masks stay aligned (the same crop as showPage, 5.6)
      var vc = ed.crop && p >= (ed.cropFrom || 0) ? ed.crop : null, vl = vc ? (ed.mirror && p % 2 ? vc[1] : vc[3]) : 0, vr = vc ? (ed.mirror && p % 2 ? vc[3] : vc[1]) : 0;
      var cw = vc ? 1 - (vl + vr) / 100 : 1, ch = vc ? 1 - (vc[0] + vc[2]) / 100 : 1;
      html += '<div class="vp-c" style="padding-top:' + ratio * ch / cw + '%"><div class="page-box vp" data-p="' + p + '" style="width:' + 100 / cw + "%;height:" + 100 / ch + "%;left:" + (-vl / cw) + "%;top:" + (vc ? -vc[0] / ch : 0) + '%"><img loading="lazy" alt="صفحة ' + p + '" src="' + ed.dir + pad(p) + '.avif">' + tjLayer(p) + "</div></div>";
    }
    view.innerHTML = html + "</div>" + rdMicHtml() + '<div class="vbar"><button id="vPlay" class="dark-btn play-btn" aria-label="استماع">' + ic("aplay") +
      '</button><button id="vDark" class="dark-btn" aria-label="قراءة ليلية">' + ic(pageIsDark() ? "sun" : "moon") + "</button></div>";
    var list = view.querySelector(".vpages"), hl0 = hl;
    var vbar = document.querySelector(".bar"); if (vbar) root.style.setProperty("--barh", vbar.offsetHeight + "px");
    function boxOf(p) { return list.querySelector('.page-box[data-p="' + p + '"]'); }
    // An image that is not the usual page shape: set its real height, keeping the place being read still.
    list.addEventListener("load", function (e) {
      var im = e.target; if (im.tagName !== "IMG" || im.classList.contains("tjo")) return;
      var bx = im.parentNode.parentNode, r = im.naturalHeight / im.naturalWidth * 100;
      if (Math.abs(r - ratio) < 0.3 || EDS[edition].crop) return;
      var top = bx.getBoundingClientRect().top, h0 = bx.offsetHeight;
      bx.style.paddingTop = r + "%";
      if (top < 0) window.scrollBy(0, bx.offsetHeight - h0);
    }, true);
    function setCur(p) {
      if (p === vCur) return;
      vCur = p;
      titleEl.textContent = "صفحة " + ar(p);
      currentSurah = p >= Q.first && p <= Q.last ? surahOfPage(p) : 0;
      if (!hl0) history.replaceState(null, "", "#/p/" + p);
      save(edKey("lastPage"), p);
      trackPage(p);
      if (hifz.on) vHifz(p);
    }
    // Memorisation / recitation in the scroll view: the page on screen is masked; finishing it scrolls to the next one,
    // which then becomes the masked page.
    function vHifz(p) {
      hifzPagesMount([p], boxOf);
      vHide(p);
      hifz.next = function () {
        var b = p + 1 <= Q.last && boxOf(p + 1); if (!b) return;
        hifz.vgo = p + 1;
        window.scrollTo({ top: b.getBoundingClientRect().top + window.scrollY - document.querySelector(".bar").offsetHeight, behavior: "smooth" });
      };
    }
    // The scroll watcher found another page across the screen (5.11 phone #19: the page reached used to stay blank,
    // since only setCur masked a page). While reciting, the masked page is kept until the turn to the next one
    // (hifz.next) or until it has gone off the top, so a page edge passing 40% does not open its unrecited ayat.
    vHz = function (p) {
      var cur = hifz.pages && hifz.pages[0]; if (!hifz.on || p === cur) return;
      if (recite.on && p !== hifz.vgo && cur) {
        var cb = boxOf(cur), bh = (document.querySelector(".bar") || { offsetHeight: 0 }).offsetHeight;
        if (cb && cb.getBoundingClientRect().bottom > bh) return;
      }
      hifz.vgo = null; vHifz(p);
    };
    rdPage = { pages: null, mark: function (s, a) { mark(s, a); ayahBar(null); var b = Q.r[s - 1][a - 1][0], bx = b && boxOf(b[0]);
      // a far ayah (found anywhere in the Quran) is jumped to at once and put in place again once the pages around it
      // have loaded; a near one scrolls smoothly
      function go(smooth) { var r = bx.getBoundingClientRect(), y = r.top + r.height * b[2] / 1000; if (y < 80 || y > innerHeight * 0.7) window.scrollBy({ top: y - innerHeight * 0.3, behavior: smooth ? "smooth" : "auto" }); }
      if (bx) { var far = Math.abs(bx.getBoundingClientRect().top) > innerHeight * 2; go(!far); if (far) { setTimeout(go, 400); setTimeout(go, 1200); } setCur(+bx.dataset.p); history.replaceState(null, "", "#/p/" + bx.dataset.p + "?a=" + s + ":" + a); } }, box: boxOf, turn: null };
    function mark(s, a) {
      list.querySelectorAll(".ayah-box").forEach(function (x) { x.remove(); });
      hl0 = s ? { s: s, a: a } : null;
      if (!s) { ayahBar(null); history.replaceState(null, "", "#/p/" + vCur); return; }
      history.replaceState(null, "", "#/p/" + vCur + "?a=" + s + ":" + a);
      ((Q.r && Q.r[s - 1] && Q.r[s - 1][a - 1]) || []).forEach(function (b) {
        var bx = boxOf(b[0]); if (!bx) return;
        var d = document.createElement("div"); d.className = "ayah-box";
        d.style.cssText = "left:" + b[1] / 10 + "%;top:" + b[2] / 10 + "%;width:" + (b[3] - b[1]) / 10 + "%;height:" + (b[4] - b[2]) / 10 + "%";
        bx.appendChild(d);
      });
      ayahBar(s, a, function () { mark(null); }, function () { location.hash = "#/s/" + s + "/" + a; });
    }
    pageWordPress(list);
    list.addEventListener("click", function (e) {
      if (Date.now() - lpPageAt < 700) return;   // the click that ends a long press (word meaning)
      var bx = e.target.closest(".page-box"); if (!bx) return;
      var r = bx.getBoundingClientRect(), hit = ayahAt(+bx.dataset.p, (e.clientX - r.left) / r.width * 1000, (e.clientY - r.top) / r.height * 1000);
      if (!hit || (hl0 && hl0.s === hit[0] && hl0.a === hit[1])) mark(null); else mark(hit[0], hit[1]);
    });
    document.getElementById("vPlay").onclick = function () {
      if (hl0) { var t = hl0; mark(null); player.play(t.s, t.a); return; }
      var f = firstAyahOfPage(vCur); if (f) player.play(f[0], f[1]);
    };
    document.getElementById("vDark").onclick = function () {
      setPageBg(pageIsDark() ? load("pageBgDay", PAPER) : load("pageBgNight", NIGHT));
      this.innerHTML = ic(pageIsDark() ? "sun" : "moon");
    };
    player.paint();
    vCur = 0;
    var start = boxOf(n) || boxOf(Q.first);
    setCur(n);
    if (hl) mark(hl.s, hl.a);
    // Right after the app opens the first scroll can be ignored, which used to reopen the vertical reading at page 1.
    // Keep placing the page until it holds, and let the scroll watcher wait meanwhile.
    vHold = true;
    (function place(k) {
      if (!document.body.contains(start)) { vHold = false; return; }
      // An ayah opened from search or a link goes to the top of the screen, just under the bar.
      var f = hl && list.querySelector(".ayah-box"), y = (f || start).getBoundingClientRect().top + window.scrollY - document.querySelector(".bar").offsetHeight - (f ? 8 : 0);
      window.scrollTo(0, y);
      // The browser may also put the scroll back to the top when the app finishes loading, so hold on until then.
      if ((Math.abs(window.scrollY - y) > 2 || document.readyState !== "complete" || k < 3) && k < 600) return requestAnimationFrame(function () { place(k + 1); });
      vHold = false;
    })(0);
    setCur(n);
  }
  // Which page is being read: the one across the upper part of the screen.
  window.addEventListener("scroll", function () {
    var list = view.querySelector(".vpages"); if (!list || vHold) return;
    var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.4), bx = el && el.closest(".page-box");
    if (bx && bx.dataset.p) {
      var p = +bx.dataset.p;
      if (p !== vCur) { vCur = p; titleEl.textContent = "صفحة " + ar(p); currentSurah = p >= Q.first && p <= Q.last ? surahOfPage(p) : 0;
        history.replaceState(null, "", "#/p/" + p + ((/\?a=.*$/.exec(location.hash) || [""])[0])); save(edKey("lastPage"), p); trackPage(p); }
      if (hifz.on && vHz) vHz(p);
    }
  }, { passive: true });

  // Scrolls so that el's top edge sits just under the sticky bar (not in full screen, where the bar is gone).
  function scrollUnderBar(el) {
    var bar = document.querySelector(".bar"), h = bar && !document.body.classList.contains("fs") ? bar.offsetHeight : 0;
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - h - 8));
  }
  // ---------- auto scroll (text view and vertical pages) at a chosen speed ----------
  var SPEEDS = [8, 14, 22, 34, 50, 75, 110];   // px a second
  var auto = { on: false, speed: Math.min(SPEEDS.length - 1, load("autoSpeed", 2)), t: 0, acc: 0 };
  function autoStep(ts) {
    if (!auto.on) return;
    if (auto.t) {
      auto.acc += (ts - auto.t) / 1000 * SPEEDS[auto.speed];
      var px = Math.floor(auto.acc);
      if (px) { window.scrollBy(0, px); auto.acc -= px; }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { autoSet(false); return; }
    }
    auto.t = ts; requestAnimationFrame(autoStep);
  }
  // Three seconds after auto-scroll starts (and after the last tap on its bar) the screen goes full screen by itself.
  var autoFsT = 0, autoFs = false;
  function autoFsArm() {
    clearTimeout(autoFsT);
    autoFsT = setTimeout(function () { if (auto.on && !window.QA_NOFS && !document.body.classList.contains("fs")) { autoFs = true; fsSet(true); } }, 3000);
  }
  function autoSet(on) {
    auto.on = on; auto.t = 0; auto.acc = 0;
    document.body.classList.toggle("autoing", on);
    var bar = document.getElementById("autoBar");
    clearTimeout(autoFsT);
    if (!on) { if (bar) bar.remove(); if (autoFs) { autoFs = false; if (!/^#\/p\//.test(location.hash) || turnMode === "v") fsSet(false); } return; }
    autoFsArm();
    if (!bar) {
      bar = document.createElement("div"); bar.id = "autoBar"; bar.className = "auto-bar";
      bar.innerHTML = '<button data-c="slow" aria-label="أبطأ">−</button><span class="auto-sp"></span><button data-c="fast" aria-label="أسرع">+</button><button data-c="stop" class="auto-stop">إيقاف</button>';
      bar.onclick = function (e) {
        var c = (e.target.closest("button") || {}).dataset; c = c && c.c; if (!c) return;
        if (c === "stop") return autoSet(false);
        autoFsArm();
        auto.speed = Math.max(0, Math.min(SPEEDS.length - 1, auto.speed + (c === "fast" ? 1 : -1))); save("autoSpeed", auto.speed);
        bar.querySelector(".auto-sp").textContent = "السرعة " + ar(auto.speed + 1);
      };
      document.body.appendChild(bar);
    }
    bar.querySelector(".auto-sp").textContent = "السرعة " + ar(auto.speed + 1);
    requestAnimationFrame(autoStep);
  }
  document.getElementById("btnAuto").onclick = function () { autoSet(!auto.on); };
  // Leaving the app holds the scroll where it is; coming back carries on from there at the same speed (no jump).
  document.addEventListener("visibilitychange", function () { auto.t = 0; auto.acc = 0; if (!document.hidden && auto.on) toast("كمّلنا التمرير التلقائي"); });

  // Memorisation masks over mushaf pages (page view and scroll view): the ayat printed on `pages`, masked line by line.
  function hifzPagesMount(pages, boxOf) {
    var items = [];
    for (var hs = surahOfPage(pages[0] - 1); hs <= surahOfPage(pages[pages.length - 1]) && hs <= 114; hs++)
      for (var ha = 1; ha <= Q.s[hs - 1][3]; ha++) {
        var rs = (Q.r && Q.r[hs - 1] && Q.r[hs - 1][ha - 1]) || [];
        if (rs.some(function (b) { return pages.indexOf(b[0]) >= 0; })) items.push(hs + ":" + ha);
      }
    hifz.pages = pages; hifz.box = boxOf;
    hifzMount(items, function () {
      view.querySelectorAll(".hifz-mask, .rc-badw").forEach(function (x) { x.remove(); });
      items.forEach(function (k) {
        if (hifz.shown[k]) { var sa0 = k.split(":"), ws0 = rWords(k); reciteBad(k).forEach(function (i) { wordBoxes(+sa0[0], +sa0[1], ws0, i, boxOf, "rc-badw"); }); return; }
        // While reciting, each line of the ayah opens once all its words are judged (the line or the ayah, whichever
        // ends first), with its wrong words red; the ayah counts as shown only at its end, as before.
        var sa = k.split(":"), rs0 = Q.r[sa[0] - 1][sa[1] - 1], V = recite.on ? (recite.disp || recite.V || {}) : {}, wl = rWords(k);
        // the furthest word judged in this ayah (any word of a later ayah = past its end): a line the reader is past opens
        // even if one of its words is not judged yet (5.11 G7; it is judged on the final piece, red if wrong)
        var past = -1; for (var pi = wl.length - 1; pi >= 0; pi--) if ((k + ":" + pi) in V) { past = pi; break; }
        if (recite.on && past < wl.length - 1 && laterHeard(k, V)) past = wl.length;
        var lw = function (w) { return norm(w).length + 1; }, tot = wl.reduce(function (t, w) { return t + lw(w); }, 0);
        var span = rs0.reduce(function (t, r) { return t + r[3] - r[1]; }, 0), acc = 0, mids = [], cs = [], c0 = 0;
        wl.forEach(function (w) { cs.push(c0); mids.push((c0 + lw(w) / 2) / tot * span); c0 += lw(w); });
        var wb = hzWb(k);   // W3: measured word boxes (null = the letter-count estimate below)
        rs0.forEach(function (b, li) {
          var x0 = acc, x1 = acc + b[3] - b[1]; acc = x1;
          var mine = [];
          if (wb) wb.forEach(function (ps, i) { if (ps.some(function (q) { return q[0] === li; })) mine.push(i); });
          else mids.forEach(function (m, i) { if (m >= x0 && m < x1) mine.push(i); });
          if (mine.length && (mine.every(function (i) { return (k + ":" + i) in V; }) || (recite.on && past > mine[mine.length - 1]))) {
            mine.forEach(function (i) { var x = V[k + ":" + i]; if (x === 0 || x === 2) wordBoxes(+sa[0], +sa[1], wl, i, boxOf, x ? "rc-unsw" : "rc-badw"); });
            return;
          }
          var bx = boxOf(b[0]); if (!bx) return;
          // 5.16 U3: a line opens word by word as it is recited (it used to wait for the whole line, 7–10 words late):
          // the words up to the furthest one heard show (wrong ones red), the mask covers the rest of the line only
          var rev = 0; if (recite.on) while (rev < mine.length && mine[rev] <= past) rev++;
          var right = b[3];
          if (rev) {
            mine.slice(0, rev).forEach(function (i) { var x = V[k + ":" + i]; if (x === 0 || x === 2) wordBoxes(+sa[0], +sa[1], wl, i, boxOf, x ? "rc-unsw" : "rc-badw"); });
            var a0 = x0 / span * tot, a1 = x1 / span * tot, st = Math.min(a1, Math.max(a0, cs[mine[rev]]));
            right = b[3] - (st - a0) / (a1 - a0) * (b[3] - b[1]);
          }
          var R = [b[1], b[2] + 5, right, b[4] - 4];
          if (wb && mine.length) { R = hzWbMask(wb, li, mine.slice(rev), mine.slice(0, rev)); if (!R) return; }
          var d = document.createElement("div"); d.className = "hifz-mask"; d.dataset.k = k;
          d.style.cssText = "left:" + R[0] / 10 + "%;top:" + R[1] / 10 + "%;width:" + (R[2] - R[0]) / 10 + "%;height:" + (R[3] - R[1]) / 10 + "%";
          bx.appendChild(d);
        });
      });
    });
  }
  // W3: ayah k's measured word boxes by word (rWords numbering): per word its pieces [li, x0, y0, x1, y1], li = the ayah's
  // line rect (Q.r) nearest the piece's centre. Null (the estimate is used) when the edition has no boxes, a page's boxes
  // are not loaded yet (asked for; QWB repaints) or a word has no box.
  function hzWb(k) {
    if (!EDS[edition] || !EDS[edition].w) return null;
    var sa = k.split(":"), s = +sa[0], a = +sa[1], rs = (Q.r[s - 1] && Q.r[s - 1][a - 1]) || [], out = [], ok = true, pgs = [];
    rWords(k).forEach(function () { out.push([]); });
    rs.forEach(function (r) { if (pgs.indexOf(r[0]) < 0) pgs.push(r[0]); });
    pgs.forEach(function (p) {
      var rows = wbRows(p); if (!rows) { ok = false; wbNeed(p, function () {}); return; }
      rows.forEach(function (r) {
        if (r[0] !== s || r[1] !== a || !out[r[2]]) return;
        var cx = (r[3] + r[5]) / 2, cy = (r[4] + r[6]) / 2, li = -1, bd = 1e9;
        rs.forEach(function (q, j) {
          if (q[0] !== p) return;
          var dx = cx < q[1] ? q[1] - cx : cx > q[3] ? cx - q[3] : 0, dy = cy < q[2] ? q[2] - cy : cy > q[4] ? cy - q[4] : 0, d = dx + 3 * dy;
          if (d < bd) { bd = d; li = j; }
        });
        out[r[2]].push([li, r[3], r[4], r[5], r[6]]);
      });
    });
    return ok && out.length && out.every(function (x) { return x.length; }) ? out : null;
  }
  // W3: the mask over the hidden words `hid` on line li: their boxes' union, 2‰ wider each side so the ink is covered, but
  // not past halfway to the nearest shown word `shw` on its right. Null when none of them is on the line.
  function hzWbMask(wb, li, hid, shw) {
    var u = null, rv = 1e9, P = 2;
    hid.forEach(function (i) { wb[i].forEach(function (q) { if (q[0] === li) u = u ? [Math.min(u[0], q[1]), Math.min(u[1], q[2]), Math.max(u[2], q[3]), Math.max(u[3], q[4])] : q.slice(1); }); });
    if (!u) return null;
    shw.forEach(function (i) { wb[i].forEach(function (q) { if (q[0] === li && q[1] >= u[2]) rv = Math.min(rv, q[1]); }); });
    return [Math.max(0, u[0] - P), u[1], Math.min(1000, u[2] + P, Math.max(u[2], (u[2] + rv) / 2)), u[3]];
  }
  // vertical hifz: the pages after the one being recited show nothing until they are reached (5.11 G7)
  function vHide(p) {
    var st = document.getElementById("vhzSt"); if (!st) { st = document.createElement("style"); st.id = "vhzSt"; document.head.appendChild(st); }
    st.textContent = p && hifz.on ? ".vpages > .vp-c:nth-child(n+" + (p - Q.min + 2) + ") > .page-box > *:not(.hifz-mask) { visibility: hidden; }" : "";
  }
  // any word of an ayah after k (on the pages being recited) judged
  var lhV = null, lhMax = 0;
  function laterHeard(k, V) {
    if (V !== lhV) {
      lhV = V; lhMax = 0; var on = {}; hifz.items.forEach(function (x) { on[x] = 1; }); if (hifz.look) on[hifz.look] = 1;
      for (var x in V) { var p = x.split(":"), ka = p[0] + ":" + p[1]; if (on[ka]) lhMax = Math.max(lhMax, +p[0] * 1000 + +p[1]); }
    }
    var sa = k.split(":"); return lhMax > +sa[0] * 1000 + +sa[1];
  }
  var shownPage = 0;
  function showPage(n, hl) {
    if (turnMode === "v") return showPagesV(n, hl);
    shownPage = n;
    if (EDS[edition].w) [n, n + 1].forEach(function (p) { if (p >= Q.min && p < Q.count) wbNeed(p, function () {}); });
    // Two pages open like the printed book: the Fatiha page on the right (2-3 in the scans, 1-2 in the King Fahd print).
    var sur = surahOfPage(n), sp = lastSpread = spreadOn(), base = n - (((n - Q.first) % 2) + 2) % 2;
    var pages = sp ? [base, base + 1].filter(function (p) { return p >= Q.min && p < Q.count; }) : [n];
    currentSurah = n >= Q.first && n <= Q.last ? sur : 0;
    titleEl.textContent = "صفحة " + ar(pages[0]) + (pages.length > 1 ? " – " + ar(pages[1]) : "");
    btnBack.hidden = false;
    var info = n >= Q.first && n <= Q.last ? "سورة " + Q.s[sur - 1][0] + " · الجزء " + JUZ_NAMES[juzOfPage(n) - 1] : "";
    // hl = {s, a, q}: the ayah drawn in yellow over the scan, from its measured line boxes.
    var cap = "", qs = "";
    if (hl && hl.q) cap = '<div class="page-cap"><div class="cap-head"><span>سورة ' + Q.s[hl.s - 1][0] + " · الآية " + ar(hl.a) +
      '</span></div><div class="txt">' + highlight(hl.s, hl.a, hl.q) + "</div></div>";
    var ced = EDS[edition], cv = ced.crop && pages.every(function (p) { return p >= (ced.cropFrom || 0); }) ? ced.crop : null;
    view.innerHTML = cap + '<div class="page-wrap' + (sp ? " spread" : "") + (cv ? " crop" : "") + '"' +
      (cv ? ' style="--ct:' + cv[0] / 100 + ";--cr:" + cv[1] / 100 + ";--cb:" + cv[2] / 100 + ";--cl:" + cv[3] / 100 + ";--R:" + ced.ar + '"' : "") + ">" + (sp ? '<div class="spread-row">' : "") + pages.map(function (p) {
        var cs = cv && ced.mirror && p % 2 ? ' style="--cl:' + cv[1] / 100 + ";--cr:" + cv[3] / 100 + '"' : "";
        return '<div class="page-box" data-p="' + p + '"' + cs + '><img' + (p === n ? ' id="pg"' : "") + ' alt="صفحة ' + p + '" src="' + EDS[edition].dir + pad(p) + '.avif">' + tjLayer(p) + "</div>";
      }).join("") + (sp ? "</div>" : "") + "</div>" +
      '<div class="page-tools"><button id="pMark">' + ic("mark") + 'علامة على هذه الصفحة</button><a class="tj-key" href="#/tajweed">' + ic("book") + "دليل ألوان التجويد</a></div>" +
      '<p class="page-info">' + info + "</p>" +
      '<div class="page-nav"><button id="pPrev">' + ic("right") + 'السابقة</button><input id="pNum" type="number" inputmode="numeric" min="' + Q.min + '" max="' + (Q.count - 1) +
      '" value="' + n + '"><button id="pNext">التالية' + ic("left") + '</button>' +
      '<button id="pPlay" class="dark-btn play-btn" aria-label="استماع">' + ic("aplay") + "</button>" +
      '<button id="pDark" class="dark-btn" aria-label="قراءة ليلية">' + ic(pageIsDark() ? "sun" : "moon") + "</button></div>" +
      (cap ? "" : '<p class="hint page-tip">اضغط على أي آية في الصفحة لتظليلها ونسخها.</p>') + rdMicHtml();
    var box = view.querySelector('.page-box[data-p="' + n + '"]'), boxes = view.querySelectorAll(".page-box");
    function boxOf(p) { return view.querySelector('.page-box[data-p="' + p + '"]'); }
    rdPage = { pages: pages, mark: function (s, a) { mark(s, a); ayahBar(null); }, box: boxOf, turn: function () { if (n + (sp ? 2 : 1) < Q.count) turn(1); } };
    // reading by voice went on to this page (turned with the page effect): light the ayah being read
    if (rd.on && rd.s && ((Q.r[rd.s - 1] && Q.r[rd.s - 1][rd.a - 1]) || []).some(function (b) { return pages.indexOf(b[0]) >= 0; })) setTimeout(function () { if (rdPage && rdPage.pages === pages) { rdPage.mark(rd.s, rd.a); rdPaint(); } }, 0);
    function mark(s, a, q) {
      view.querySelectorAll(".ayah-box:not(.play)").forEach(function (x) { x.remove(); });
      hl = s ? { s: s, a: a, q: q || "" } : null;
      qs = hl ? "?a=" + s + ":" + a + (hl.q ? "&h=" + encodeURIComponent(hl.q) : "") : "";
      history.replaceState(null, "", "#/p/" + n + qs);
      if (!hl) { ayahBar(null); var c = view.querySelector(".page-cap"); if (c) c.remove(); return; }
      ((Q.r && Q.r[s - 1] && Q.r[s - 1][a - 1]) || []).forEach(function (b) {
        var bx = boxOf(b[0]); if (!bx) return;
        var d = document.createElement("div"); d.className = "ayah-box";
        d.style.cssText = "left:" + b[1] / 10 + "%;top:" + b[2] / 10 + "%;width:" + (b[3] - b[1]) / 10 + "%;height:" + (b[4] - b[2]) / 10 + "%";
        bx.appendChild(d);
      });
      ayahBar(s, a, function () { mark(null); }, function () { location.hash = "#/s/" + s + "/" + a + (hl && hl.q ? "?h=" + encodeURIComponent(hl.q) : ""); });
    }
    window.scrollTo(0, 0);
    if (hl) mark(hl.s, hl.a, hl.q); else ayahBar(null);
    var first = view.querySelector(".ayah-box");
    if (first) scrollUnderBar(first);   // an ayah opened from search / a link goes to the top of the screen, under the bar
    save(edKey("lastPage"), n);
    trackPage(pages[0]);
    (sp ? [base - 2, base - 1, base + 2, base + 3] : [n - 1, n + 1]).forEach(function (k) { if (k >= Q.min && k < Q.count) new Image().src = EDS[edition].dir + pad(k) + ".avif"; });

    // Tapping the scan picks the ayah under the finger, using the same measured boxes.
    boxes.forEach(function (bx) {
      bx.addEventListener("click", function (e) {
        if (Date.now() - dragEnd < 400 || Date.now() - lpPageAt < 700) return;
        var r = bx.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 1000, y = (e.clientY - r.top) / r.height * 1000;
        var hit = ayahAt(+bx.dataset.p, x, y);
        if (hifz.on) { if (hit) hifzFlip(hit[0] + ":" + hit[1]); return; }
        if (!hit || (hl && hl.s === hit[0] && hl.a === hit[1])) mark(null); else mark(hit[0], hit[1]);
      });
    });
    if (hifz.on) {
      hifzPagesMount(pages, boxOf);
      // Revealing the page's last ayah turns to the next page by itself.
      hifz.next = function () { if (n + (sp ? 2 : 1) <= Q.last) turn(1); };   // Q.last, not Q.count: no turning into the du'a/index pages after the Quran (Haramain, Shamarly)
    }
    document.getElementById("pMark").onclick = function () {
      var f = hl ? [hl.s, hl.a] : firstAyahOfPage(pages[0]) || firstAyahOfPage(n);
      if (f) addBookmark(f[0], f[1]); else toast("لا توجد آيات في هذه الصفحة");
    };

    // The highlight follows when an ayah runs onto the next page.
    function goTo(k) { history.replaceState(null, "", "#/p/" + k + qs); route(); }
    function turn(d) {
      var k = sp ? base + 2 * d : n + d; if (sp && k < Q.min && k + 1 >= Q.min) k = Q.min; if (k < Q.min || k >= Q.count || curling) return;
      if (sp) return goTo(k);
      var c = flipMode !== "off" && pageTurnFx(box, n, k, function () { goTo(k); });
      if (c) { c.grab(box.getBoundingClientRect().height); c.finish(null); } else goTo(k);
    }
    document.getElementById("pPrev").onclick = function () { turn(-1); };
    document.getElementById("pNext").onclick = function () { turn(1); };
    document.getElementById("pPlay").onclick = function () {
      if (hl) { var t = hl; mark(null); player.play(t.s, t.a); return; }
      var f = firstAyahOfPage(n); if (f) player.play(f[0], f[1]);
    };
    player.paint();
    document.getElementById("pDark").onclick = function () {
      setPageBg(pageIsDark() ? load("pageBgDay", PAPER) : load("pageBgNight", NIGHT));
      this.innerHTML = ic(pageIsDark() ? "sun" : "moon");
    };
    document.getElementById("pNum").onchange = function () {
      var k = parseInt(en(this.value), 10);
      if (k >= Q.min && k < Q.count) { history.replaceState(null, "", "#/p/" + k); route(); }
    };
    // Arabic mushaf: the next page comes from the left, so dragging to the right turns forward.
    // With the page-turn effect on, the sheet follows the finger; otherwise a swipe turns the page when lifted.
    var wrap = view.querySelector(".page-wrap"), g = null;
    pageWordPress(wrap);
    if (EDS[edition].w) pages.forEach(function (p) { wbNeed(p, function () {}); });   // exact word boxes for this page, ahead of use
    wrap.addEventListener("pointerdown", function (e) {
      var zoomed = window.visualViewport && window.visualViewport.scale > 1.05;
      g = e.isPrimary && !zoomed && !curling ? { x: e.clientX, y: e.clientY, lx: e.clientX, lt: e.timeStamp, v: 0, c: null } : null;
    });
    wrap.addEventListener("pointermove", function (e) {
      if (!g || !e.isPrimary) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.c) {
        if (flipMode === "off" || sp || Math.abs(dx) < 12 || Math.abs(dx) < 1.3 * Math.abs(dy)) return;
        var k = n + (dx > 0 ? 1 : -1);
        if (k < Q.min || k >= Q.count) return;
        g.c = pageTurnFx(box, n, k, function () { goTo(k); });
        if (!g.c) return;
        g.c.grab(g.y - box.getBoundingClientRect().top);
        try { wrap.setPointerCapture(e.pointerId); } catch (err) {}
      }
      var dt = e.timeStamp - g.lt;
      if (dt > 0) { g.v = 0.6 * g.v + 0.4 * (e.clientX - g.lx) / dt; g.lx = e.clientX; g.lt = e.timeStamp; }
      g.c.drag(dx, dy);
    });
    function release(e, cancel) {
      if (!g) return;
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (g.c) { dragEnd = Date.now(); g.c.finish(cancel ? false : e.timeStamp - g.lt > 120 ? 0 : g.v); }
      else if (!cancel && (flipMode === "off" || sp) && Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) turn(dx > 0 ? 1 : -1);
      g = null;
    }
    wrap.addEventListener("dragstart", function (e) { e.preventDefault(); });
    wrap.addEventListener("pointerup", function (e) { release(e, false); });
    wrap.addEventListener("pointercancel", function (e) { release(e, true); });
  }
  function pad(n) { return ("00" + n).slice(-3); }

  // ---------- معنى الكلمة على صفحات المصحف (5.19) ----------
  // Word boxes measured on the scan (tools/page_geometry/word_boxes.py): editions/<id>-w/NNN.js calls QWB(id, page, rows),
  // rows [s, a, w, x0, y0, x1, y1] per mille, w = the word's place in rWords(). Loaded per page when needed.
  window.QWB = function (ed, n, rows) {
    store["wb/" + ed + "/" + n] = rows;
    // bug #14: boxes that arrive late repaint the overlays drawn from the letter-count estimate (rows are stored now, so no loop)
    if (ed !== edition) return;
    try { if (hifz.on && hifz.paint) hifz.paint(); if (rd.on) rdPaint(); } catch (e) {}
  };
  function wbNeed(p, done) { var ed = EDS[edition]; if (!ed || !ed.w) return done(null); need("wb/" + edition + "/" + p, ed.w + pad(p) + ".js", done); }
  function wbRows(p) { return EDS[edition] && EDS[edition].w ? store["wb/" + edition + "/" + p] || null : null; }
  // The word under (x, y) per mille of page p: [s, a, w] from the measured boxes, else estimated from the ayah's line
  // boxes by letter count (the inverse of wordBoxes()).
  function pageWordAt(p, x, y, done) {
    wbNeed(p, function (rows) {
      if (rows && rows.length) {
        var best = null, bd = 1e9;
        rows.forEach(function (r) { var dx = x < r[3] ? r[3] - x : x > r[5] ? x - r[5] : 0, dy = y < r[4] ? r[4] - y : y > r[6] ? y - r[6] : 0, d = dx + 3 * dy; if (d < bd) { bd = d; best = r; } });
        if (best && bd < 20) return done([best[0], best[1], best[2]]);
      }
      var hit = ayahAt(p, x, y, true); if (!hit) return done(null);
      var s = hit[0], a = hit[1], ws = rWords(s + ":" + a), rs = Q.r[s - 1][a - 1], len = function (w) { return norm(w).length + 1; };
      var total = ws.reduce(function (t, w) { return t + len(w); }, 0), span = rs.reduce(function (t, r) { return t + r[3] - r[1]; }, 0), acc = 0, pos = -1;
      rs.forEach(function (r) {
        var w = r[3] - r[1];
        if (pos < 0 && r[0] === p && r[1] === hit[2] && r[2] === hit[3]) pos = (acc + Math.min(w, Math.max(0, r[3] - x))) / span * total;
        acc += w;
      });
      var from = 0; for (var i = 0; i < ws.length; i++) { from += len(ws[i]); if (pos < from) return done([s, a, i]); }
      done([s, a, ws.length - 1]);
    });
  }
  window.QA_pageWordAt = pageWordAt;
  window.QA_wb = function (p, cb) { wbNeed(p, function () { cb(wbRows(p)); }); };
  window.QA_rect = function (s, a) { return Q.r[s - 1][a - 1]; };
  window.QA_pageOf = pageOf;
  // Long press (480 ms, one finger, no move) on a mushaf page opens the word's meaning. Taps, swipes, the page curl,
  // pinch zoom, the hifz reveal and reciting are left as they are.
  var lpPageAt = 0;
  function pageWordPress(root) {
    var t = null, st = null, fingers = 0;
    function stop() { clearTimeout(t); t = null; }
    root.addEventListener("pointerdown", function (e) {
      fingers++; stop();
      if (fingers > 1 || hifz.on || recite.on || rd.on || curling) return;
      var bx = e.target.closest(".page-box"); if (!bx) return;
      st = { x: e.clientX, y: e.clientY };
      t = setTimeout(function () {
        t = null; var r = bx.getBoundingClientRect();
        pageWordAt(+bx.dataset.p, (st.x - r.left) / r.width * 1000, (st.y - r.top) / r.height * 1000, function (h) {
          if (!h) return; lpPageAt = Date.now();
          try { if (window.AppBridge && AppBridge.buzz) AppBridge.buzz(1); else if (navigator.vibrate) navigator.vibrate(15); } catch (er) {}
          wordSheet(h[0], h[1], h[2], rWords(h[0] + ":" + h[1])[h[2]]);
        });
      }, 480);
    });
    root.addEventListener("pointermove", function (e) { if (t && st && (Math.abs(e.clientX - st.x) > 10 || Math.abs(e.clientY - st.y) > 10)) stop(); });
    ["pointerup", "pointercancel"].forEach(function (k) { root.addEventListener(k, function () { fingers = Math.max(0, fingers - 1); stop(); }); });
    root.addEventListener("contextmenu", function (e) { if (e.target.closest(".page-box")) e.preventDefault(); });
  }

  // Ayah boxes grouped by page, built on first use: byPage[n] = [[s, a, x0, y0, x1, y1], ...].
  var byPage = null;
  function ayahAt(n, x, y, lines) {
    if (!Q.r) return null;
    var wr = !lines && wbRows(n);   // measured word boxes: nearest word's ayah
    if (wr && wr.length) {
      var wb = null, wd = 1e9;
      wr.forEach(function (r) { var dx = x < r[3] ? r[3] - x : x > r[5] ? x - r[5] : 0, dy = y < r[4] ? r[4] - y : y > r[6] ? y - r[6] : 0, d = dx + 3 * dy; if (d < wd) { wd = d; wb = r; } });
      if (wb && wd < 25) return [wb[0], wb[1], wb[3], wb[4], wb[5], wb[6]];
    }
    if (!byPage) {
      byPage = {};
      Q.r.forEach(function (sur, si) { sur.forEach(function (rs, ai) { rs.forEach(function (b) {
        (byPage[b[0]] = byPage[b[0]] || []).push([si + 1, ai + 1, b[1], b[2], b[3], b[4]]);
      }); }); });
    }
    var best = null, bd = 1e9;
    (byPage[n] || []).forEach(function (b) {
      var dx = x < b[2] ? b[2] - x : x > b[4] ? x - b[4] : 0, dy = y < b[3] ? b[3] - y : y > b[5] ? y - b[5] : 0;
      var d = dx + 3 * dy; if (d < bd) { bd = d; best = b; }
    });
    return best && bd < 25 ? best : null;
  }

  // Book-style page curl. The turning sheet is folded along the perpendicular bisector of its free corner C and the
  // point P it is pulled to (the finger): the part on the spine side stays flat, the cut-off corner is reflected across
  // the fold and shows the back of the paper, with the next page uncovered underneath. Page coordinates, spine on the
  // right (x = W) as in a right-to-left mushaf. t is how far the sheet has turned: 0 = lying flat, 1 = gone over the spine.
  // Going forward the sheet is the current page (t 0 → 1); going back it is the previous page laid back down (t 1 → 0).
  var curling = false, dragEnd = 0;
  // The turning effect works on the whole image's rectangle; on a cropped page the layer is clipped to the same visible part.
  // The page turning in: its frame is put where the current page's frame is (mirrored margins differ on odd pages),
  // so the turn shows no margin and nothing moves when the new page settles.
  function cropDx(box, k, W) {
    var ed = EDS[edition], c = ed.crop; if (!c || !box.closest(".page-wrap.crop") || k < (ed.cropFrom || 0)) return 0;
    var cl = function (p) { return (ed.mirror && p % 2 ? c[1] : c[3]) / 100; };
    return (cl(+box.dataset.p) - cl(k)) * W;
  }
  // The crop of page k inside its box, as fractions [top, right, bottom, left] (mirrored editions swap the sides).
  function cropIns(box, k) {
    var ed = EDS[edition], c = ed.crop; if (!c || !box.closest(".page-wrap.crop") || k < (ed.cropFrom || 0)) return [0, 0, 0, 0];
    var m = ed.mirror && k % 2; return [c[0] / 100, (m ? c[3] : c[1]) / 100, c[2] / 100, (m ? c[1] : c[3]) / 100];
  }
  function cropClip(box) {
    var w = box.closest(".page-wrap.crop"); if (!w) return "";
    function g(k) { return (parseFloat(box.style.getPropertyValue(k) || w.style.getPropertyValue(k)) || 0) * 100 + "%"; }
    return ";clip-path:inset(" + g("--ct") + " " + g("--cr") + " " + g("--cb") + " " + g("--cl") + ")";
  }
  // Shift a turning page sideways by dx px. Not margin-left: .curl-page is absolute with inset:0 and a fixed width, so in the
  // RTL document left/margin-left are dropped and the box sits on the right — the shift was ignored and the cut margin showed (5.11 G2).
  function curlShift(e, dx) { e.style.left = dx + "px"; e.style.right = -dx + "px"; }
  function pageTurnFx(box, n, k, commit) { return flipMode === "slide" ? pageSlide(box, n, k, commit) : pageCurl(box, n, k, commit); }
  // Sideways slide: the page moves with the finger and the next one comes in beside it (from the left going forward,
  // as the mushaf reads right to left). Same controls as pageCurl.
  function pageSlide(box, n, k, commit) {
    var r = box.getBoundingClientRect(), W = r.width, H = r.height;
    if (curling || !W || !H) return null;
    curling = true;
    var fwd = k > n, GAP = 16;
    var layer = document.createElement("div"); layer.className = "curl slide";
    layer.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + W + "px;height:" + H + "px" + cropClip(box);
    var cur = box.cloneNode(true), nxt = el('<div class="page-box"><img alt="" src="' + EDS[edition].dir + pad(k) + '.avif">' + tjLayer(k) + "</div>").firstChild;
    cur.classList.add("curl-page"); nxt.classList.add("curl-page");
    var cdx = cropDx(box, k, W); curlShift(nxt, cdx);
    // each page is clipped to its own frame, so the cut-off white margins never slide into view between the pages;
    // D is how far the pages travel so that the two frames meet GAP apart and the new one ends where it belongs
    var ic = cropIns(box, n), ik = cropIns(box, k), pct = function (v) { return (v * 100).toFixed(2) + "%"; };
    var ins = function (a) { return "inset(" + a.map(pct).join(" ") + ")"; };
    if (ic.some(Boolean) || ik.some(Boolean)) { cur.style.clipPath = ins(ic); nxt.style.clipPath = ins(ik); }
    var D = fwd ? W * (1 - ik[1] - ic[3]) + cdx + GAP : W * (1 - ic[1] - ik[3]) - cdx + GAP;
    layer.appendChild(cur); layer.appendChild(nxt); document.body.appendChild(layer);
    box.style.visibility = "hidden";
    var x = 0, dir = fwd ? 1 : -1;   // x: how far the current page has moved, in the turning direction
    function draw() {
      cur.style.transform = "translateX(" + (dir * x).toFixed(1) + "px)";
      nxt.style.transform = "translateX(" + (dir * (x - D)).toFixed(1) + "px)";
    }
    var raf = 0, done = false;
    function animate(to, dur, then) {
      cancelAnimationFrame(raf);
      var x0 = x, start = 0;
      function step(now) {
        if (!start) start = now;
        var u = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - u, 3);
        x = x0 + (to - x0) * e; draw();
        if (u < 1) raf = requestAnimationFrame(step); else then();
      }
      raf = requestAnimationFrame(step);
    }
    function end(ok) {
      if (done) return; done = true;
      if (ok) commit(); else box.style.visibility = "";
      var im = ok && view.querySelector("#pg"), p = im && im.decode ? im.decode() : Promise.resolve();
      p.catch(function () {}).then(function () { requestAnimationFrame(function () { layer.remove(); curling = false; }); });
    }
    draw();
    return {
      grab: function () {},
      drag: function (dx) { x = Math.max(0, Math.min(D, dir * dx)); draw(); },
      finish: function (v) {
        var sp = v ? dir * v : 0, ok = v === null || (v !== false && (sp > 0.3 || (x > W * 0.3 && sp > -0.2)));
        var to = ok ? D : 0;
        animate(to, v === null ? 380 : 140 + 300 * Math.abs(to - x) / W, function () { end(ok); });
      }
    };
  }
  function pageCurl(box, n, k, commit) {
    var r = box.getBoundingClientRect(), W = r.width, H = r.height;
    if (curling || !W || !H) return null;
    curling = true;
    var fwd = k > n;
    function sheetOf(m) {
      var b = m === n ? box.cloneNode(true) : el('<div class="page-box"><img alt="" src="' + EDS[edition].dir + pad(m) + '.avif">' + tjLayer(m) + '</div>').firstChild;
      b.classList.add("curl-page"); if (m !== n) curlShift(b, cropDx(box, m, W)); return b;
    }
    function shade(cls, parent) { var d = document.createElement("div"); d.className = "curl-shade " + cls; parent.appendChild(d); return d; }
    var layer = document.createElement("div"); layer.className = "curl";
    layer.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + W + "px;height:" + H + "px" + cropClip(box);
    var under = sheetOf(fwd ? k : n), sheet = sheetOf(fwd ? n : k), flap = sheet.cloneNode(true), wrapF = document.createElement("div");
    flap.classList.add("curl-back"); wrapF.className = "curl-flap";
    flap.insertAdjacentHTML("beforeend", '<div class="curl-paper"></div>');
    var us = shade("curl-ushade", under), fs = shade("curl-fshade", sheet), bs = shade("curl-bshade", flap);
    wrapF.appendChild(flap); layer.appendChild(under); layer.appendChild(sheet); layer.appendChild(wrapF);
    document.body.appendChild(layer);

    // The fold works on the turning sheet's visible frame (its crop, in its own coordinates), not the whole image:
    // folding the whole image carried the cut white margin into view at the fold (5.11 G2). No crop: the whole image.
    var ins = cropIns(box, fwd ? n : k), L = ins[3] * W, R = W * (1 - ins[1]), T = ins[0] * H, B = H * (1 - ins[2]);
    var shS = fwd ? 0 : cropDx(box, k, W), shU = fwd ? cropDx(box, k, W) : 0;   // sideways shift of the sheet / the page under
    var cy = B, t = fwd ? 0 : 1, dy = 0, RECT = [[L, T], [R, T], [R, B], [L, B]];
    function cut(nx, ny, c, side) {
      var out = [];
      for (var i = 0; i < 4; i++) {
        var a = RECT[i], b = RECT[(i + 1) % 4], fa = side * (a[0] * nx + a[1] * ny - c), fb = side * (b[0] * nx + b[1] * ny - c);
        if (fa >= 0) out.push(a);
        if ((fa >= 0) !== (fb >= 0)) { var u = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); }
      }
      return out.length < 3 ? "polygon(0 0,0 0,0 0)" : "polygon(" + out.map(function (q) { return q[0].toFixed(1) + "px " + q[1].toFixed(1) + "px"; }).join(",") + ")";
    }
    function place(d, x, y, deg) { d.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + deg.toFixed(2) + "deg) translateY(-50%)"; }
    function draw() {
      // The corner rises a little as it travels, like paper lifted by its edge.
      var px = L + 2 * (R - L) * t, py = cy + dy - (cy === T ? -1 : 1) * Math.sin(Math.PI * t) * (B - T) * 0.07;
      // The sheet stays bound at the spine: P can't be farther from the spine corners than the paper reaches.
      [[R, cy, R - L], [R, T + B - cy, Math.sqrt((R - L) * (R - L) + (B - T) * (B - T))]].forEach(function (a) {
        var ex = px - a[0], ey = py - a[1], d = Math.sqrt(ex * ex + ey * ey);
        if (d > a[2]) { px = a[0] + ex * a[2] / d; py = a[1] + ey * a[2] / d; }
      });
      var vx = px - L, vy = py - cy, len = Math.sqrt(vx * vx + vy * vy);
      if (len < 0.5) { sheet.style.clipPath = sheet.style.webkitClipPath = ""; wrapF.style.display = "none"; us.style.opacity = 0; return; }
      wrapF.style.display = "";
      var nx = vx / len, ny = vy / len, mx = (L + px) / 2, my = (cy + py) / 2, c = mx * nx + my * ny, deg = Math.atan2(ny, nx) * 180 / Math.PI;
      sheet.style.clipPath = sheet.style.webkitClipPath = cut(nx, ny, c, 1);
      flap.style.clipPath = flap.style.webkitClipPath = cut(nx, ny, c, -1);
      flap.style.transform = "matrix(" + [1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, 2 * c * nx, 2 * c * ny].map(function (v) { return v.toFixed(4); }).join(",") + ")";
      var s = Math.min(1, len / 90);
      place(us, mx + shS - shU, my, deg + 180); us.style.opacity = s;
      place(fs, mx, my, deg); fs.style.opacity = s;
      place(bs, mx, my, deg + 180);
    }
    var raf = 0, done = false;
    function animate(to, dur, then) {
      cancelAnimationFrame(raf);
      var t0 = t, d0 = dy, start = 0;
      function step(now) {
        if (!start) start = now;
        var u = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - u, 3);
        t = t0 + (to - t0) * e; dy = d0 * (1 - e); draw();
        if (u < 1) raf = requestAnimationFrame(step); else then();
      }
      raf = requestAnimationFrame(step);
    }
    function end(ok) {
      if (done) return; done = true;
      if (ok) commit();
      var im = ok && view.querySelector("#pg"), p = im && im.decode ? im.decode() : Promise.resolve();
      p.catch(function () {}).then(function () { requestAnimationFrame(function () { layer.remove(); curling = false; }); });
    }
    draw();
    return {
      // Which corner is pulled: the bottom one unless the finger is in the top half.
      grab: function (y) { cy = y < H / 2 ? T : B; draw(); },
      drag: function (dx, ddy) {
        var u = Math.max(0, Math.min(1, (fwd ? dx : -dx) / (W * 0.85)));
        t = fwd ? u : 1 - u; dy = ddy * 0.5; draw();
      },
      // v: finger speed in px/ms (0 = let go still, null = turned by a button, false = cancelled).
      finish: function (v) {
        var moved = fwd ? t : 1 - t, sp = v ? (fwd ? v : -v) : 0;
        var ok = v === null || (v !== false && (sp > 0.3 || (moved > 0.35 && sp > -0.2)));
        var to = ok === fwd ? 1 : 0;
        animate(to, v === null ? 820 : 180 + 520 * Math.abs(to - t), function () { end(ok); });
      }
    };
  }

  // Bottom bar for a chosen ayah: copy with or without tashkeel, open in the text view, close.
  function ayahBar(s, a, onClose, onText) {
    var bar = document.getElementById("ayahBar");
    if (bar) bar.remove();
    document.body.classList.toggle("has-bar", !!s);
    if (!s) return;
    tick();
    bar = document.createElement("div"); bar.id = "ayahBar"; bar.className = "ayah-bar";
    if (trOn && !window.TR_EN) withTranslation(function () { var b2 = document.getElementById("ayahBar"); if (b2 && !b2.querySelector(".tr-en")) b2.querySelector(".ab-ref").insertAdjacentHTML("afterend", trOf(s, a)); });
    bar.innerHTML = '<div class="ab-ref">سورة ' + Q.s[s - 1][0] + " · الآية " + ar(a) + "</div>" + trOf(s, a) + '<div class="ab-btns">' +
      '<button data-c="f">' + ic("book") + "تفسير وإعراب ومعاني</button>" +
      '<button data-c="l">' + ic("aplay") + "استماع</button>" + '<button data-c="r">' + ic("rep") + "تكرار مقطع</button>" + '<button data-c="b">' + ic("mark") + "علامة</button>" +
      '<button data-c="sh">' + ic("share") + "مشاركة</button>" +
      '<button data-c="t">' + ic("copy") + 'بالتشكيل</button><button data-c="p">' + ic("copy") + "بدون تشكيل</button>" +
      (onText ? '<button data-c="v">' + ic("text") + "في النص</button>" : "") + '<button data-c="x" aria-label="إغلاق">' + ic("x") + "</button></div>";
    document.body.appendChild(bar);
    bar.onclick = function (e) {
      var b = e.target.closest("button"), c = b && b.dataset.c; if (!c) return;
      if (c === "x") { ayahBar(null); if (onClose) onClose(); }
      else if (c === "v") onText();
      else if (c === "f") location.hash = "#/a/" + s + "/" + a;
      else if (c === "l") { ayahBar(null); if (onClose) onClose(); player.play(s, a); }
      else if (c === "r") { ayahBar(null); if (onClose) onClose(); rangeDialog(s, a); }
      else if (c === "b") addBookmark(s, a);
      else if (c === "sh") shareDialog(s, a);
      else copyText(ayahForCopy(s, a, c === "t"), c === "t" ? "نُسخت الآية بالتشكيل" : "نُسخت الآية بدون تشكيل");
    };
  }
  // With tashkeel: the Uthmani text as printed. Without: the standard spelling with every mark removed.
  function plain(t) { return t.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").replace(/\s+/g, " ").trim(); }
  function ayahForCopy(s, a, tashkeel) {
    var t = tashkeel ? Q.t[s - 1][a - 1] : plain(Q.q[s - 1][a - 1]);
    return t + " ﴿" + ar(a) + "﴾\n[سورة " + Q.s[s - 1][0] + "، الآية " + ar(a) + "]";
  }
  function copyText(t, msg) {
    var ok = false;
    try { if (window.AppBridge) { window.AppBridge.copy(t); ok = true; } } catch (e) {}
    if (!ok) {
      var ta = document.createElement("textarea"); ta.value = t; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;opacity:0"; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      if (!ok && navigator.clipboard) { navigator.clipboard.writeText(t); ok = true; }
    }
    toast(ok ? msg : "تعذّر النسخ");
  }
  function openPage(n) { location.hash = "#/p/" + n; }
  function openAyahPage(s, a, q) { location.hash = "#/p/" + pageOf(s, a) + "?a=" + s + ":" + a + (q ? "&h=" + encodeURIComponent(q) : ""); }

  function go(s, a) {
    if (mode === "pages") openPage(pageOf(s, a));
    else location.hash = "#/s/" + s + "/" + a;
  }

  // ---------- التلاوة الصوتية ----------
  // Ayah-by-ayah recordings from everyayah.com. In the app, MainActivity serves these URLs from its own copy once an ayah
  // has been heard (or the surah saved), so listening works offline afterwards; the fetched blob is what gets played.
  var RECITERS = [
    ["Alafasy_128kbps", "مشاري راشد العفاسي"], ["Husary_128kbps", "محمود خليل الحصري"], ["Husary_Muallim_128kbps", "الحصري (المصحف المعلم)"],
    ["Minshawy_Murattal_128kbps", "محمد صديق المنشاوي (مرتل)"], ["Minshawy_Mujawwad_192kbps", "محمد صديق المنشاوي (مجود)"],
    ["Abdul_Basit_Murattal_192kbps", "عبد الباسط عبد الصمد (مرتل)"], ["Abdul_Basit_Mujawwad_128kbps", "عبد الباسط عبد الصمد (مجود)"],
    ["Mohammad_al_Tablaway_128kbps", "محمد محمود الطبلاوي"], ["Mustafa_Ismail_48kbps", "مصطفى إسماعيل"], ["mahmoud_ali_al_banna_32kbps", "محمود علي البنا"],
    ["Abdurrahmaan_As-Sudais_192kbps", "عبد الرحمن السديس"], ["Saood_ash-Shuraym_128kbps", "سعود الشريم"], ["MaherAlMuaiqly128kbps", "ماهر المعيقلي"],
    ["Ghamadi_40kbps", "سعد الغامدي"], ["Yasser_Ad-Dussary_128kbps", "ياسر الدوسري"], ["Abu_Bakr_Ash-Shaatree_128kbps", "أبو بكر الشاطري"],
    ["Hudhaify_128kbps", "علي الحذيفي"], ["Nasser_Alqatami_128kbps", "ناصر القطامي"], ["Muhammad_Ayyoub_128kbps", "محمد أيوب"],
    ["Muhammad_Jibreel_128kbps", "محمد جبريل"]
  ];
  var reciter = load("reciter", RECITERS[0][0]);
  if (!RECITERS.some(function (r) { return r[0] === reciter; })) reciter = RECITERS[0][0];
  function reciterName() { for (var i = 0; i < RECITERS.length; i++) if (RECITERS[i][0] === reciter) return RECITERS[i][1]; return ""; }
  function firstAyahOfPage(n) {
    for (var s = 1; s <= 114; s++) for (var a = 1; a <= Q.s[s - 1][3]; a++) if (Q.p[s - 1][a - 1] >= n) return Q.p[s - 1][a - 1] === n ? [s, a] : null;
    return null;
  }
  var player = (function () {
    var audio = new Audio(), cur = null, playing = false, bar = null, urls = {}, seq = 0;
    // How many times each ayah is recited before moving on (0 = keep repeating it).
    var REPS = [1, 2, 3, 5, 7, 10, 0], reps = load("repeat", 1), heard = 0;
    // A passage played on its own (a chosen range of ayat, or a Quranic zikr): {s, from, to, times, done}; times 0 = keep repeating.
    var range = null;
    // Recitation speed, 0.25x to 4x (pitch kept).
    var RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4], rate = load("rate", 1), ratesOpen = false;
    function setRate() { audio.defaultPlaybackRate = rate; audio.playbackRate = rate; }
    function url(s, a) { return "https://everyayah.com/data/" + reciter + "/" + pad(s) + pad(a) + ".mp3"; }
    // In the app the fetch is answered from the saved copy (or downloads and saves it); in a browser the URL plays directly.
    function get(s, a) {
      var u = url(s, a);
      if (!window.AppBridge) return Promise.resolve(u);
      if (urls[u]) return urls[u];
      urls[u] = fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.blob(); })
        .then(function (b) { return URL.createObjectURL(b); }, function (e) { delete urls[u]; throw e; });
      return urls[u];
    }
    function rateText(r) { return String(r).replace(/^0\./, ".") + "×"; }
    function next(s, a) { return a < Q.s[s - 1][3] ? [s, a + 1] : s < 114 ? [s + 1, 1] : null; }
    function prev(s, a) { return a > 1 ? [s, a - 1] : s > 1 ? [s - 1, Q.s[s - 2][3]] : null; }
    function hasBasmala(s, a) { return a === 1 && s !== 1 && s !== 9; }
    // step: "b" = the basmala before ayah 1, "a" = the ayah itself
    function start(s, a, step) {
      var my = ++seq;
      if (!cur || cur.s !== s || cur.a !== a) heard = 0;
      cur = { s: s, a: a, step: step || (hasBasmala(s, a) ? "b" : "a") };
      playing = true; show(); paint(true);
      var src = cur.step === "b" ? get(1, 1) : get(s, a);
      src.then(function (u) {
        if (my !== seq) return;
        audio.src = u; setRate(); return audio.play();
      }).then(function () {
        var n = next(s, a); if (n && cur.step === "a") get(n[0], n[1]).catch(function () {});   // fetch the next ayah ahead
      }).catch(function () {
        if (my !== seq) return;
        playing = false; show();
        toast(navigator.onLine === false ? "لا يوجد اتصال بالإنترنت، وهذه الآية غير محفوظة" : "تعذّر تشغيل التلاوة");
      });
    }
    audio.addEventListener("ended", function () {
      if (!cur) return;
      if (sleep && !sleep.sura && Date.now() >= sleep.at) return sleepEnd();
      if (cur.step === "b") return start(cur.s, cur.a, "a");
      heard++;
      if (reps === 0 || heard < reps) { audio.currentTime = 0; audio.play().catch(function () {}); return show(); }
      if (range && cur.s === range.s && cur.a === range.to) {
        range.done++; if (range.onRep) range.onRep();
        if (range.times === 0 || range.done < range.times) return start(range.s, range.from);
        var done = range.onDone; range = null; stop(); if (done) done();
        return;
      }
      var n = next(cur.s, cur.a);
      if (sleep && sleep.sura && (!n || n[0] !== cur.s)) return sleepEnd();
      Object.keys(urls).forEach(function (k) { if (k !== url(cur.s, cur.a) && (!n || k !== url(n[0], n[1])) && k !== url(1, 1)) { urls[k].then(URL.revokeObjectURL, function () {}); delete urls[k]; } });
      if (n) start(n[0], n[1]); else stop();
    });
    function toggle() {
      if (!cur) return;
      if (playing) { audio.pause(); playing = false; } else { playing = true; audio.play().catch(function () { start(cur.s, cur.a); }); }
      show();
    }
    function stop() { seq++; audio.pause(); cur = null; playing = false; range = null; ratesOpen = false; show(); paint(); }
    // Keeps the reciting ayah in view: on the mushaf page (turning to its page when it moves on) or in the text view.
    function paint(follow) {
      document.querySelectorAll(".ayah-box.play").forEach(function (x) { x.remove(); });
      document.querySelectorAll(".ayah.playing").forEach(function (x) { x.classList.remove("playing"); });
      if (!cur) return;
      var s = cur.s, a = cur.a, h = location.hash, m;
      if ((m = h.match(/^#\/p\/(\d+)/))) {
        var p = pageOf(s, a), box = document.querySelector('.page-box[data-p="' + p + '"]'), y = 1e9;
        if (!box) { if (follow) { history.replaceState(null, "", "#/p/" + p); route(); } return; }
        if (cur.step === "b") return;
        ((Q.r && Q.r[s - 1] && Q.r[s - 1][a - 1]) || []).forEach(function (b) {
          if (b[0] !== p) return;
          var d = document.createElement("div"); d.className = "ayah-box play";
          d.style.cssText = "left:" + b[1] / 10 + "%;top:" + b[2] / 10 + "%;width:" + (b[3] - b[1]) / 10 + "%;height:" + (b[4] - b[2]) / 10 + "%";
          box.appendChild(d); y = Math.min(y, b[2]);
        });
        if (follow && y < 1e9) {
          var img = box.querySelector("img"), go = function () { scrollInto(box.getBoundingClientRect().top + window.scrollY + box.offsetHeight * y / 1000); };
          if (img && !img.complete) img.addEventListener("load", go, { once: true }); else go();
        }
      } else if ((m = h.match(/^#\/s\/(\d+)/))) {
        if (+m[1] !== s) { if (follow) { history.replaceState(null, "", "#/s/" + s + "/" + a); route(); } return; }
        var e = document.getElementById("a" + a);
        if (e && cur.step === "a") { e.classList.add("playing"); if (follow) scrollInto(e.getBoundingClientRect().top + window.scrollY); }
      }
    }
    function scrollInto(top) {
      var vh = window.innerHeight, rel = top - window.scrollY;
      if (rel < 70 || rel > vh - 220) window.scrollTo({ top: Math.max(0, top - vh / 3), behavior: "smooth" });
    }
    function show() {
      document.body.classList.toggle("has-player", !!cur);
      if (!cur) { if (bar) { bar.remove(); bar = null; } return; }
      if (!bar) {
        bar = document.createElement("div"); bar.id = "player"; bar.className = "player";
        document.body.appendChild(bar);
        bar.onclick = function (e) {
          var b = e.target.closest("button"), c = b && b.dataset.c; if (!c || !cur) return;
          if (c === "pp") toggle();
          else if (c === "st") stop();
          else if (c === "nx") { var n = next(cur.s, cur.a); if (n) start(n[0], n[1], "a"); }
          else if (c === "pv") { var p = prev(cur.s, cur.a); if (p) start(p[0], p[1], "a"); }
          else if (c === "dl") listenDlg();
          else if (c === "sp") { ratesOpen = !ratesOpen; show(); }
          else if (c === "r") { rate = +b.dataset.r; save("rate", rate); setRate(); ratesOpen = false; show(); }
          else if (c === "rp") { reps = REPS[(REPS.indexOf(reps) + 1) % REPS.length]; save("repeat", reps); show(); toast(reps === 1 ? "بدون تكرار" : reps ? "تكرار كل آية " + ar(reps) + " مرات" : "تكرار الآية بلا توقف"); }
        };
      }
      bar.classList.toggle("rates", ratesOpen);
      bar.innerHTML = '<div class="pl-info"><b>' + Q.s[cur.s - 1][0] + " · " + (cur.step === "b" ? "البسملة" : "آية " + ar(cur.a)) + (reps !== 1 && cur.step === "a" ? " · " + ar(Math.min(heard + 1, reps || heard + 1)) + (reps ? "/" + ar(reps) : "") : "") + "</b><span>" + (sleep ? "<em>" + (sleep.sura ? "النوم آخر السورة" : "النوم بعد " + ar(Math.max(1, Math.ceil((sleep.at - Date.now()) / 60000))) + " د") + "</em> · " : "") + (range ? "المقطع " + ar(range.from) + "–" + ar(range.to) +
        (range.times !== 1 ? " · " + (range.times ? ar(range.done + 1) + "/" + ar(range.times) : "∞") : "") + " · " : "") + reciterName() + "</span></div>" +
        (ratesOpen ? '<div class="pl-rates">' + RATES.map(function (r) { return '<button data-c="r" data-r="' + r + '"' + (r === rate ? ' class="on"' : "") + ">" + rateText(r) + "</button>"; }).join("") + "</div>" : "") +
        '<div class="pl-btns"><button data-c="sp" class="pl-sp' + (rate !== 1 ? " on" : "") + '" aria-label="سرعة التلاوة">' + rateText(rate) + "</button>" +
        '<button data-c="rp" class="pl-rep' + (reps !== 1 ? " on" : "") + '" aria-label="تكرار الآية">' + ic("rep") + (reps === 1 ? "" : "<i>" + (reps ? ar(reps) : "∞") + "</i>") + "</button>" +
        '<button data-c="pv" aria-label="الآية السابقة">' + ic("aprev") + '</button><button data-c="pp" class="pl-main" aria-label="' + (playing ? "إيقاف مؤقت" : "تشغيل") + '">' +
        ic(playing ? "apause" : "aplay") + '</button><button data-c="nx" aria-label="الآية التالية">' + ic("anext") + "</button>" +
        '<button data-c="dl" class="pl-zz' + (sleep ? " on" : "") + '" aria-label="الاستماع من غير إنترنت ومؤقت النوم">' + ic(sleep ? "clock" : "dl") + "</button>" +
        '<button data-c="st" aria-label="إيقاف">' + ic("astop") + "</button></div>";
    }
    // 5.17 S8: a surah or a juz saved for listening without internet. Each ayah is fetched once: in the app the fetch goes
    // through AudioCache (MainActivity.shouldInterceptRequest), which keeps the file; 3 at a time, with progress and cancel.
    var dl = null;
    function dlList(kind, s, a) {
      var L = [], p, e;
      if (kind === "s") { p = [s, 1]; e = [s, Q.s[s - 1][3]]; }
      else { var j = juzOf(s, a); p = JUZ[j - 1].slice(); e = j < 30 ? prev(JUZ[j][0], JUZ[j][1]) : [114, 6]; }
      for (; p; p = next(p[0], p[1])) { L.push(p); if (p[0] === e[0] && p[1] === e[1]) break; }
      if (L.some(function (x) { return x[1] === 1 && x[0] !== 1 && x[0] !== 9; }) && !L.some(function (x) { return x[0] === 1 && x[1] === 1; })) L.unshift([1, 1]);   // the basmala
      return L;
    }
    function dlStart(kind, s, a) {
      if (dl && !dl.end && !dl.stop) return toast("فيه تحميل شغال");
      var L = dlList(kind, s, a), rec = reciter, d = { kind: kind, name: kind === "s" ? "سورة " + Q.s[s - 1][0] : "الجزء " + JUZ_NAMES[juzOf(s, a) - 1], n: L.length, done: 0, failed: 0, i: 0, stop: false, end: false };
      dl = d;
      function one() {
        if (d.stop || d.i >= L.length) return;
        var x = L[d.i++];
        fetch("https://everyayah.com/data/" + rec + "/" + pad(x[0]) + pad(x[1]) + ".mp3").then(function (r) { if (!r.ok) throw 0; return r.blob(); }).then(function () { d.done++; }, function () { d.failed++; })
          .then(function () {
            if (d.done + d.failed >= d.n && !d.end) {
              d.end = true;
              toast(d.failed ? "تعذّر حفظ " + ar(d.failed) + " آية، حاول مرة أخرى" : "اتحفظت " + d.name + " للاستماع من غير إنترنت");
            } else one();
            dlPaint();
          });
      }
      one(); one(); one();
      dlPaint();
    }
    function dlPaint() {
      var b = document.getElementById("dlBox"); if (!b) return;
      if (!dl) { b.hidden = true; return; }
      b.hidden = false;
      var pc = dl.n ? Math.round((dl.done + dl.failed) / dl.n * 100) : 0;
      b.querySelector("i").style.width = pc + "%";
      b.querySelector("span").innerHTML = "<b>" + dl.name + "</b> <em>" + ar(dl.done) + " من " + ar(dl.n) + "</em>" + (dl.failed ? " <em>فشل " + ar(dl.failed) + "</em>" : "") + (dl.stop ? " <em>اتلغى</em>" : dl.end ? " <em>خلص</em>" : "");
      b.querySelector("button").hidden = dl.end || dl.stop;
    }
    // Sleep timer: stops the reciter after 15/30/60 minutes, or at the end of the surah playing now.
    var sleep = null, sleepT = 0, sleepTick = 0;
    function sleepSet(m) {
      clearTimeout(sleepT); clearInterval(sleepTick); sleep = null;
      if (m === "s") sleep = { sura: true };
      else if (m) { sleep = { at: Date.now() + m * 60000 }; sleepT = setTimeout(sleepEnd, m * 60000); sleepTick = setInterval(show, 30000); }
      show();
    }
    function sleepEnd() { clearTimeout(sleepT); clearInterval(sleepTick); var was = !!sleep && !!cur; sleep = null; stop(); if (was) toast("وقّفت التلاوة، تصبح على خير"); }
    function listenDlg() {
      var s = cur ? cur.s : 1, a = cur ? cur.a : 1, j = juzOf(s, a), kind = "s";
      var d = el('<div class="dlg-back"><div class="dlg ls-dlg">' +
        (window.AppBridge ? '<b>الاستماع من غير إنترنت</b><p class="hint">' + reciterName() + '</p><div class="z-sort dl-pick"><button data-k="s" class="on">سورة ' + Q.s[s - 1][0] + '</button><button data-k="j">الجزء ' + JUZ_NAMES[j - 1] + "</button></div>" +
          '<button class="continue" id="dlGo">' + ic("dl") + ' حمّل</button><div id="dlBox" hidden><div class="dl-bar"><i></i></div><span class="hint"></span> <button class="continue" id="dlStop">' + ic("x") + " إلغاء التحميل</button></div><hr>" : "") +
        '<b>مؤقت النوم</b><div class="zz-opts">' + [[15, "١٥ دقيقة"], [30, "٣٠ دقيقة"], [60, "ساعة"], ["s", "آخر السورة"]].map(function (x) {
          return '<button class="continue' + (x[0] === "s" && sleep && sleep.sura ? " on" : "") + '" data-z="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>" +
        (sleep ? '<button class="continue" data-z="0">' + ic("x") + " إلغاء المؤقت</button>" : "") +
        '<div class="dlg-btns"><button type="button" class="dlg-no">قفل</button></div></div></div>').firstChild;
      document.body.appendChild(d);
      d.querySelector(".dlg-no").onclick = function () { d.remove(); };
      d.onclick = function (e) { if (e.target === d) d.remove(); };
      d.querySelectorAll(".dl-pick button").forEach(function (b) { b.onclick = function () { kind = b.dataset.k; d.querySelectorAll(".dl-pick button").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
      if (window.AppBridge) {
        d.querySelector("#dlGo").onclick = function () { dlStart(kind, s, a); };
        d.querySelector("#dlStop").onclick = function () { if (dl) { dl.stop = true; dlPaint(); toast("اتلغى التحميل"); } };
        dlPaint();
      }
      d.querySelectorAll("[data-z]").forEach(function (b) { b.onclick = function () {
        var z = b.dataset.z; sleepSet(z === "s" ? "s" : +z); d.remove();
        toast(z === "0" ? "اتلغى مؤقت النوم" : z === "s" ? "التلاوة هتقف في آخر السورة" : "التلاوة هتقف بعد " + ar(+z) + " دقيقة");
      }; });
    }
    return { play: function (s, a) { range = null; start(s, a); },
      // onDone: called when the passage has finished by itself (not when it is stopped).
      // onRep: after each time through the passage.
      playRange: function (s, a, b, times, onDone, onRep) { range = { s: s, from: a, to: b, times: times === undefined ? 1 : times, done: 0, onDone: onDone, onRep: onRep }; start(s, a); }, paint: function () { paint(false); }, stop: stop,
      listenDlg: listenDlg, sleepSet: sleepSet, dlList: dlList,
      reciterChanged: function () { if (cur) start(cur.s, cur.a, "a"); } };
  })();

  var recSel = document.getElementById("reciter");
  recSel.innerHTML = RECITERS.map(function (r) { return '<option value="' + r[0] + '">' + r[1] + "</option>"; }).join("");
  recSel.value = reciter;
  recSel.onchange = function () { reciter = recSel.value; save("reciter", reciter); player.reciterChanged(); };

  // ---------- الحفظ والمراجعة ----------
  // Memorisation mode in the page and text views: every ayah is hidden; tapping one shows or hides it again,
  // and the bar shows the next one in order, shows all, or hides all. What is shown resets when the page changes.
  var hifz = { on: false, shown: {}, items: [], paint: null, next: null };
  window.hifzToggle = function () { hifzToggle(); };
  function hifzToggle() { hifz.on = !hifz.on; hifz.shown = {}; recite.V = {}; recite.disp = null; recite.ptr = null; recite.ok = recite.words = 0; recite.wrong = []; if (!hifz.on) { hifz.test = null; reciteStop(); } var y = window.scrollY; route(); hifzBar(); window.scrollTo(0, y); }
  function hifzMount(items, paint) { hifz.items = items; hifz.shown = {}; hifz.fk = null;
    // a test that starts at a chosen ayah (map › «ابدأ من الآية», 5.11 G6): the ayat before it stay open as context
    // (and in a random test, 5.14, the ayat before the place being tested)
    var T0 = hifz.test; if (T0 && (T0.a > 1 || T0.pn > 1 || T0.end)) items.forEach(function (k) { var p = k.split(":"); if (+p[0] < T0.s || (+p[0] === T0.s && +p[1] < T0.a)) hifz.shown[k] = true; });
    // (5.15b item 4) and the ayat after the place's end
    if (T0 && T0.end) { var ep = T0.end.split(":"); items.forEach(function (k) { var p = k.split(":"); if (+p[0] > +ep[0] || (+p[0] === +ep[0] && +p[1] > +ep[1])) hifz.shown[k] = true; }); }
    // a new page while reciting: ayat already recited (one split over the page end) stay open, and the words heard so
    // far in this utterance belong to the last page, so the matcher skips them
    if (recite.on) { items.forEach(function (k) { if ((k + ":" + (rWords(k).length - 1)) in (recite.V || {})) hifz.shown[k] = true; }); if (!recite.cmt) recite.skip = recite.heard || 0; recite.cmt = false; recite.base = null; } hifz.paint = paint; hifz.next = null; hifz.ending = null; paint(); hifzBar(); }
  function hifzFlip(k) {
    hifz.shown[k] = !hifz.shown[k];
    // In a test on the mushaf, an ayah tapped open counts as forgotten; one opened with «افتكرتها» counts as remembered.
    if (hifz.test && hifz.shown[k]) { hifz.test.seen[k] = 1; hifz.test.miss[k] = 1; }
    hifz.paint(); hifzBar(); hifzRevealed(k);
  }
  // The hifz test on the pages of the chosen edition: whole ayat are hidden, and the score is the share remembered.
  function hifzTestPages(s, a) {
    hifz.on = true; hifz.shown = {}; hifz.test = { s: s, a: a, seen: {}, miss: {} };
    recite.ok = recite.words = 0; recite.wrong = []; recite.k = null; recite.base = null; recite.V = {}; recite.disp = null; recite.ptr = null;
    location.hash = mode === "pages" ? "#/p/" + pageOf(s, a) : "#/s/" + s + "/" + a;
  }
  function reciteHistory() {
    var log = load("reciteLog", []); if (!log.length) return "";
    var w = 0, b = 0; log.forEach(function (x) { w += x.w; b += x.bad; });
    return '<div class="rc-hist"><b>إحصائية التسميع بالصوت</b><p class="hint">' + ar(log.length) + " مرة · " + ar(w) + " كلمة · الدقة " + ar(Math.round((w - b) / w * 100)) + "٪</p>" +
      log.slice(0, 5).map(function (x) { return "<div><span>" + Q.s[x.s - 1][0] + "</span><small>" + x.d.split("-").reverse().map(function (n) { return ar(+n); }).join("/") + " · " + ar(x.ay) + " آية · " + ar(x.bad) + " غلط</small></div>"; }).join("") + "</div>";
  }
  function reciteSummary(r) {
    var g = {}; r.wrong.forEach(function (x) { (g[x[0]] = g[x[0]] || []).push(x[1]); });
    var d = el('<div class="dlg-back"><div class="dlg"><b>نتيجة التسميع</b><div class="rc-stats"><span><b>' + ar(r.ay) + "</b>آية</span><span><b>" + ar(r.w - r.bad) + "</b>كلمة صح</span><span><b>" + ar(r.bad) + "</b>كلمة غلط</span></div>" +
      (r.bad ? '<p class="hint">الكلمات اللي اتقالت غلط أو اتنست:</p><div class="rc-wrong">' + Object.keys(g).map(function (k) { var sa = k.split(":"); return "<div><small>" + Q.s[sa[0] - 1][0] + " " + ar(+sa[1]) + '</small><span class="ay-q">' + g[k].join(" · ") + "</span></div>"; }).join("") + "</div>" : '<p class="hint">ما شاء الله، مفيش ولا كلمة غلط.</p>') +
      '<p class="hint">التعرّف على الكلام ممكن يغلط في التلاوة المجوّدة، فلو كلمة متعلّمة وانت متأكد منها، متقلقش.</p><div class="dlg-btns"><button class="dlg-ok">تم</button></div></div></div>').firstChild;
    document.body.appendChild(d); d.querySelector(".dlg-ok").onclick = function () { d.remove(); }; d.onclick = function (e) { if (e.target === d) d.remove(); };
  }
  // Every ayah recited (or revealed in a test) goes on the hifz map by itself: q.hifzAyat {"s:a": {d: day, ok: 1|0}}.
  function hifzMark(k, ok) {
    var H = load("hifzAyat", {}); H[k] = { d: todayStr(), ok: ok ? 1 : 0 }; save("hifzAyat", H);
  }
  function hifzMarks(m) {
    var ks = Object.keys(m); if (!ks.length) return;
    var H = load("hifzAyat", {}), d = todayStr(); ks.forEach(function (k) { H[k] = { d: d, ok: m[k] ? 1 : 0 }; }); save("hifzAyat", H);
  }
  function hifzTestDone() {
    var t = hifz.test, seen = Object.keys(t.seen).length, miss = Object.keys(t.miss).length;
    if (!seen) return toast("اكشف آية واحدة على الأقل الأول");
    var score = Math.round((seen - miss) / seen * 100), s = t.s, rw = recite.words, rb = recite.wrong.slice();
    var mk = {}; Object.keys(t.seen).forEach(function (k) { mk[k] = !t.miss[k]; }); hifzMarks(mk);
    if (rw) { asrStat("ok", recite.ok); asrStat("bad", rw - recite.ok); }
    if (rw) { var log = load("reciteLog", []); log.unshift({ d: todayStr(), s: s, ay: seen, w: rw, bad: rb.length, wrong: rb.slice(0, 40) }); save("reciteLog", log.slice(0, 60)); }
    // the surahs tested get today as their review date (they are marked memorised only by hifzAuto, at 80%)
    var ts = {}; Object.keys(t.seen).forEach(function (k) { var x = k.split(":")[0], e = ts[x] = ts[x] || { n: 0, m: 0 }; e.n++; if (t.miss[k]) e.m++; });
    var res = load("hifzScores", {});
    Object.keys(ts).forEach(function (x) {
      var e = ts[x], sp = Math.round((e.n - e.m) / e.n * 100);
      if (t.end) hzSetRev(+x, sp); else if (e.n >= Q.s[+x - 1][3]) hzSetMemo(+x, sp);
      res[x] = { d: todayStr(), score: sp };
    });
    save("hifzScores", res); syncAlarms();
    var sk = Object.keys(t.seen).sort(akCmp);
    lastTestSave({ k: "m", r: [sk[0], sk[sk.length - 1]], sc: score, ay: seen, miss: Object.keys(t.miss).sort(akCmp), w: rw, bad: rb.length });
    hifzToggle();
    if (rw) reciteSummary({ ay: seen, w: rw, bad: rb.length, wrong: rb });
    else cheer(ar(score) + "٪: افتكرت " + ar(seen - miss) + " من " + ar(seen) + " آية");
  }
  // On a mushaf page, once the last ayah is revealed (and so every ayah is), the next page comes after a moment to read it.
  // While reciting into the mic, the page turns once its last ayah is recited, even if the reader started further down.
  // The index of the last word of ayah k that is printed on the given pages (an ayah can run onto the next page).
  function lastWordOnPages(k, pages) {
    var sa = k.split(":"), rs = (Q.r && Q.r[sa[0] - 1] && Q.r[sa[0] - 1][sa[1] - 1]) || [], wl = rWords(k);
    // W4: the last measured word box of the ayah on these pages, when every one of them has its boxes loaded
    if (EDS[edition] && EDS[edition].w) {
      var ok = true, lb = -1;
      pages.forEach(function (p) { var rows = wbRows(p); if (!rows) { ok = false; return; } rows.forEach(function (r) { if (r[0] === +sa[0] && r[1] === +sa[1] && r[2] > lb) lb = r[2]; }); });
      if (ok && (lb >= 0 || !rs.some(function (r) { return pages.indexOf(r[0]) >= 0; }))) return Math.min(lb, wl.length - 1);
    }
    var lw = function (w) { return norm(w).length + 1; }, tot = wl.reduce(function (t, w) { return t + lw(w); }, 0);
    var span = rs.reduce(function (t, r) { return t + r[3] - r[1]; }, 0), c0 = 0, last = -1, ends = [], acc = 0;
    rs.forEach(function (b) { acc += b[3] - b[1]; ends.push([acc, b[0]]); });
    wl.forEach(function (w, i) {
      var m = (c0 + lw(w) / 2) / tot * span; c0 += lw(w);
      for (var j = 0; j < ends.length; j++) if (m < ends[j][0]) { if (pages.indexOf(ends[j][1]) >= 0) last = i; break; }
    });
    return last;
  }
  // While reciting, the page turns once the last word printed on it is heard, not when its (possibly split) ayah ends,
  // or once 2+ words of the next page's first ayah are heard right (the last word was misheard). True = the page is done.
  function hifzPageEnd(disp, keys, nOwn) {
    var items = hifz.items, next = hifz.next; if (!recite.on || !next || !items || !items.length || !hifz.pages || hifz.ending === next) return false;
    var k = items[items.length - 1], i = lastWordOnPages(k, hifz.pages);
    if (i >= 0 && disp[k + ":" + i] === 1) return true;
    if (i >= 0 && (k + ":" + i) in disp && disp[k + ":" + i] === 0) return true;
    var ahead = 0; for (var j = nOwn; keys && j < keys.length; j++) if (disp[keys[j]] === 1) ahead++;
    return ahead >= 2;
  }
  // the page is done: turn now («قلب تلقائي»), or end the test there
  // 5.15b item 5 / 5.16d: a test from «المراجعة» always turns the page (hifz.test.rv, the toggle shown faded);
  // a test from the map (or anywhere else) follows the «قلب تلقائي» toggle, on and off
  function hzFlipOn() { return !!(hifz.test && hifz.test.rv) || load("hifzFlip", true); }
  function hifzPageGo() {
    var next = hifz.next; if (!next || hifz.ending === next) return; hifz.ending = next;
    setTimeout(function () {
      if (!hifz.on || hifz.next !== next) return;
      if (hzFlipOn()) next(); else if (hifz.test) hifzTestDone();
    }, 150);
  }
  // the next page's first ayah (or nothing: the last page, auto flip off, or the page's last ayah runs on there anyway)
  function hifzLook() {
    if (!hifz.next || !hifz.pages || !hifz.items.length || !hzFlipOn()) return null;
    var k = hifz.items[hifz.items.length - 1], sa = k.split(":"), s = +sa[0], a = +sa[1];
    if (lastWordOnPages(k, hifz.pages) < rWords(k).length - 1) return null;
    if (a < Q.s[s - 1][3]) a++; else if (s < 114) { s++; a = 1; } else return null;
    return hifz.items.indexOf(s + ":" + a) >= 0 ? null : s + ":" + a;
  }
  function hifzRevealed(k) {
    var items = hifz.items, next = hifz.next;
    if (!next || !hifz.shown[k] || k !== items[items.length - 1] || (!recite.on && items.some(function (x) { return !hifz.shown[x]; }))) return;
    // «قلب تلقائي» off (5.11 G6): the page's last ayah ends a test right there; outside a test the page just stays
    if (!hzFlipOn()) {
      setTimeout(function () { if (!hifz.on || hifz.next !== next || !hifz.shown[k]) return; if (hifz.test) hifzTestDone(); else toast("خلصت الصفحة"); }, 1200);
      return;
    }
    setTimeout(function () { if (hifz.on && hifz.next === next && hifz.shown[k]) next(); }, 1200);
  }
  // While reciting a test on the pages, the next hidden ayah is kept in view (between the bar and 70% of the screen).
  function hifzFollow() {
    if (!hifz.on || !recite.on || !hifz.box) return;
    var k = hifz.items.filter(function (x) { return !hifz.shown[x]; })[0]; if (!k || k === hifz.fk) return; hifz.fk = k;
    var sa = k.split(":"), b = Q.r[sa[0] - 1] && Q.r[sa[0] - 1][sa[1] - 1] && Q.r[sa[0] - 1][sa[1] - 1][0], bx = b && hifz.box(b[0]); if (!bx) return;
    var r = bx.getBoundingClientRect(), y = r.top + r.height * b[2] / 1000, top = (document.querySelector(".bar") || { offsetHeight: 0 }).offsetHeight + 8;
    if (y < top || y > innerHeight * 0.7) window.scrollBy({ top: y - Math.max(top, innerHeight * 0.3), behavior: "smooth" });
  }
  // the mic opens in a test on the pages: the view goes to the top of the page being tested
  function hifzPageTop() {
    if (!hifz.on || !hifz.box) return;
    var k = hifz.items.filter(function (x) { return !hifz.shown[x]; })[0] || hifz.items[0], sa = k && k.split(":");
    var b = sa && Q.r[sa[0] - 1] && Q.r[sa[0] - 1][sa[1] - 1] && Q.r[sa[0] - 1][sa[1] - 1][0], bx = hifz.box(b ? b[0] : hifz.pages[0]); if (!bx) return;
    var c = bx.closest(".vp-c") || bx.closest(".page-wrap") || bx, top = (document.querySelector(".bar") || { offsetHeight: 0 }).offsetHeight;
    window.scrollTo({ top: Math.max(0, c.getBoundingClientRect().top + window.scrollY - top - 4), behavior: "auto" });
    hifz.fk = null;
  }
  function hifzBar() {
    var bar = document.getElementById("hifzBar");
    // a test with a range (المراجعة › اختبرني, 5.13 P2.6) ends by itself once its last ayah is recited or opened
    if (hifz.test && hifz.test.end && hifz.test.seen[hifz.test.end] && !hifz.test.fin) { hifz.test.fin = 1; setTimeout(function () { if (hifz.test && hifz.test.fin) { if (hifz.test.pc && hifz.test.pc.length) hifzNextPlace(); else hifzTestDone(); } }, hifz.test.pc && hifz.test.pc.length ? 300 : 900); }
    document.body.classList.toggle("has-hifz", hifz.on);
    if (!hifz.on || !document.body.classList.contains("vread")) vHide(0);
    if (!hifz.on) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement("div"); bar.id = "hifzBar"; bar.className = "hifz-bar"; document.body.appendChild(bar);
      bar.onclick = function (e) {
        var b = e.target.closest("button"), c = b && b.dataset.c; if (!c) return;
        var k;
        if (c === "done") return hifzTestDone();
        if (c === "mic") return reciteToggle();
        if (c === "nx") { k = hifz.items.filter(function (x) { return !hifz.shown[x]; })[0]; if (k) { hifz.shown[k] = true; if (hifz.test) hifz.test.seen[k] = 1; } else if (hifz.next) { hifz.next(); return; } else toast("كُشفت كل الآيات"); }
        else if (c === "pv") { var sh = hifz.items.filter(function (x) { return hifz.shown[x]; }); if (sh.length) hifz.shown[sh[sh.length - 1]] = false; }
        else if (c === "all") hifz.items.forEach(function (x) { hifz.shown[x] = true; });
        else if (c === "none") hifz.shown = {};
        else if (c === "x") return hifzToggle();
        else if (c === "flip") { var fo = !load("hifzFlip", true); save("hifzFlip", fo); toast(fo ? "الصفحة هتتقلب لوحدها في آخرها" : "مش هتتقلب: الاختبار بيخلص في آخر الصفحة"); }
        hifz.paint(); hifzBar();
        if (c === "nx" && k) hifzRevealed(k);
      };
    }
    var n = hifz.items.filter(function (x) { return hifz.shown[x]; }).length, fl = load("hifzFlip", true);
    hifzFollow();
    var T = hifz.test, tm = T ? Object.keys(T.miss).length : 0, ts = T ? Object.keys(T.seen).length : 0;
    bar.innerHTML = (T ? '<div class="hz-info"><b>' + (recite.on ? "بسمع…" : "اختبار الحفظ") + "</b><span>" + (recite.words ? "كلمات صح " + ar(recite.words - recite.wrong.length) + " · غلط " + ar(recite.wrong.length) : "افتكرت " + ar(ts - tm) + " · نسيت " + ar(tm)) + "</span></div>" :
      '<div class="hz-info"><b>وضع الحفظ</b><span>' + ar(n) + " من " + ar(hifz.items.length) + " آية ظاهرة</span></div>") +
      '<div class="hz-btns"><button data-c="nx" class="hz-main">' + ic("eye") + (T ? "افتكرتها" : "اكشف التالية") + "</button>" + (T ? '<button data-c="mic"' + (recite.on ? ' class="rec"' : "") + ' aria-label="سمّع بصوتك">' + ic("mic") + '</button><button data-c="done">' + ic("check") + "خلصت</button>" : "") + (T ? "" : '<button data-c="pv" aria-label="أخفِ آخر آية">' + ic("eyeoff") + "</button>") +
      (T ? "" : '<button data-c="all">الكل</button><button data-c="none">إخفاء</button>') + (hifz.pages ? '<button data-c="flip" class="hz-flip' + (fl || (T && T.rv) ? " on" : "") + '" aria-pressed="' + !!(fl || (T && T.rv)) + '"' + (T && T.rv ? " disabled" : "") + ' aria-label="قلب الصفحة تلقائي">' + ic("book") + "<small>قلب تلقائي</small></button>" : "") + '<button data-c="x" aria-label="إنهاء وضع الحفظ">' + ic("x") + "</button></div>";
  }

  // ---------- التسميع بالصوت ----------
  // In the hifz test, the reader recites from memory and the phone's speech recogniser (ReciteBridge) hears it. Each heard
  // word is matched to the next hidden ayah's words; an ayah shows once its last word is reached, wrong or skipped words are
  // kept for the summary, and the page turns by itself after its last ayah (hifzRevealed). q.reciteLog keeps every session.
  var recite = { on: false, k: null, pos: 0, ok: 0, words: 0, base: null, wrong: [], V: {}, disp: null, ptr: null }; window.__rec = recite;
  function rSkel(w) { return norm(w).replace(/[اءؤئوي]/g, ""); }
  function rSame(a, b) {
    if (!a || !b) return false; if (a === b) return true;
    var m = a.length, n = b.length, d = [], i, j; for (j = 0; j <= n; j++) d[j] = j;
    for (i = 1; i <= m; i++) { var p = d[0]; d[0] = i; for (j = 1; j <= n; j++) { var t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
    return 1 - d[n] / Math.max(m, n) >= 0.6;
  }
  // Heard words (rSkel) against expected words (rSkel), aligned in one go: an extra heard word (misheard, a model
  // slip at a pause) costs INS and is skipped instead of pushing the expected place on; the word just matched said
  // again costs REP; two heard words read as one expected word cost 0.5; a skipped or wrong expected word costs 1.
  // Expected words past the last aligned one are not judged yet (null); heard words left after that point cost TAIL
  // (more than a wrong word), so a wrong word near the end is flagged and not left waiting.
  // Returns { v: [1 right | 0 wrong | null], j: heard words used, hj: heard words used up to each expected word }.
  // Tuned with tools/asr/eval/bench.py (recite_dp); tools/asr/eval/parity.js checks both give the same verdicts.
  function rAlign(H, E) {
    var INS = 1.0, REP = 0.2, TAIL = 1.1, n = E.length, m = H.length, i, j, D = [], N = [], B = [];
    for (i = 0; i <= n; i++) { D.push(new Array(m + 1).fill(1e9)); N.push(new Array(m + 1).fill(1e9)); B.push(new Array(m + 1)); }
    D[0][0] = N[0][0] = 0; for (j = 1; j <= m; j++) D[0][j] = j * INS;
    for (i = 1; i <= n; i++) for (j = 0; j <= m; j++) {
      var best = D[i - 1][j] + 1, b = "d";
      if (j >= 1) { var ok = rSame(H[j - 1], E[i - 1]), c = D[i - 1][j - 1] + (ok ? 0 : 1); if (c <= best) { best = c; b = ok ? "m" : "s"; } }
      if (j >= 2 && D[i - 1][j - 2] + 0.5 < best && rSame(H[j - 2] + H[j - 1], E[i - 1])) { best = D[i - 1][j - 2] + 0.5; b = "j"; }   // two heard words as one
      N[i][j] = best; B[i][j] = b; D[i][j] = j >= 1 ? Math.min(best, D[i][j - 1] + (rSame(H[j - 1], E[i - 1]) ? REP : INS)) : best;
    }
    var bi = 0, bj = 0, bc = 1e18;
    for (i = 0; i <= n; i++) for (j = 0; j <= m; j++) { var cc = N[i][j] + (m - j) * TAIL; if (cc < bc || (cc === bc && i > bi)) { bc = cc; bi = i; bj = j; } }
    var v = new Array(n).fill(null), hj = new Array(n).fill(null), used = bj; i = bi; j = bj;
    while (i > 0) {
      b = B[i][j]; hj[i - 1] = j;
      if (b === "d") { v[i - 1] = 0; i--; } else if (b === "j") { v[i - 1] = 1; i--; j -= 2; } else { v[i - 1] = b === "m" ? 1 : 0; i--; j--; }
      while (i > 0 && j > 0 && N[i][j] > D[i][j]) j--;          // walk back over skipped heard words
    }
    return { v: v, j: used, hj: hj };
  }
  // One piece of speech (heard words H, rSkel) placed anywhere in a longer text E (rSkel words: the whole test or page).
  // Going on from where the last piece ended (p0) is free; starting elsewhere costs JUMP (+ a little per word away), so
  // the reader may start from the middle or go back and repeat, and the words are followed there. Heard words before
  // the first matched one (a slip at the start, «أعوذ بالله») cost INS0. Inside, the costs are rAlign's.
  // Returns { v: {index: 1 right | 0 wrong}, a: first judged index, b: index after the last judged one } or null.
  function rLocal(H, E, p0) {
    var INS = 1.0, INS0 = 1.0, REP = 0.2, TAIL = 1.1, JUMP = 2.0, n = E.length, m = H.length, i, j, D = [], N = [], B = [], W = [], S = [], MD = [], MN = [];
    if (!m || !n) return null;
    // starting up to 2 words back is free too: after a pause the reader often says the last words again, and a word
    // a slip at the end of the last piece was taken for gets judged again
    var st = function (i) { return i <= p0 && i >= p0 - 2 ? 0 : JUMP + 0.01 * Math.min(100, Math.abs(i - p0)); };
    for (i = 0; i <= n; i++) {
      D.push(new Array(m + 1)); N.push(new Array(m + 1).fill(1e9)); B.push(new Array(m + 1)); W.push(new Array(m + 1)); MD.push(new Array(m + 1)); MN.push(new Array(m + 1));
      if (i) { S.push(new Array(m)); for (j = 0; j < m; j++) S[i - 1][j] = rSame(H[j], E[i - 1]); }
    }
    for (i = 0; i <= n; i++) for (j = 0; j <= m; j++) {
      if (i) {
        var best = D[i - 1][j] + 1, b = "d";
        if (j >= 1) { var ok = S[i - 1][j - 1], c = D[i - 1][j - 1] + (ok ? 0 : 1); if (c <= best) { best = c; b = ok ? "m" : "s"; } }
        // two heard words as one expected word, only when neither is that word by itself («الذين»+«آمنوا» is not «الذين»)
        if (j >= 2 && D[i - 1][j - 2] + 0.5 < best && !S[i - 1][j - 2] && !S[i - 1][j - 1] && rSame(H[j - 2] + H[j - 1], E[i - 1])) { best = D[i - 1][j - 2] + 0.5; b = "j"; }
        N[i][j] = best; B[i][j] = b; MN[i][j] = b === "m" || b === "j" || (b === "d" ? MD[i - 1][j] : MD[i - 1][j - 1]);
      }
      var d = N[i][j], w = "n", s0 = st(i) + j * INS0;
      if (j >= 1 && i >= 1) { var c2 = D[i][j - 1] + (S[i - 1][j - 1] ? REP : INS); if (c2 < d) { d = c2; w = "i"; } }
      if (s0 <= d) { d = s0; w = "s"; }
      D[i][j] = d; W[i][j] = w; MD[i][j] = w === "n" ? MN[i][j] : w === "i" ? MD[i][j - 1] : false;      // path has a right word
    }
    var bi = 0, bj = 0, bc = m * TAIL;
    for (i = 1; i <= n; i++) for (j = 1; j <= m; j++) { if (!MN[i][j]) continue; var cc = N[i][j] + (m - j) * TAIL; if (cc < bc || (cc === bc && i > bi)) { bc = cc; bi = i; bj = j; } }
    if (!bi) return null;
    var v = {}, a = bi; i = bi; j = bj;
    // walk back from the end: N steps judge words, D steps over extra heard words, until the start cell
    while (true) {
      b = B[i][j];
      if (b === "d") { v[i - 1] = 0; i--; } else if (b === "j") { v[i - 1] = 1; i--; j -= 2; } else { v[i - 1] = b === "m" ? 1 : 0; i--; j--; }
      a = i;
      while (W[i][j] === "i") j--;
      if (W[i][j] === "s") break;
    }
    // a piece with no right word at all (a model slip, a cough, «نهاية» at a pause) judges nothing
    if (!Object.keys(v).some(function (x) { return v[x] === 1; })) return null;
    return { v: v, a: a, b: bi };
  }
  // P1b: a final piece from the NVIDIA model is also checked on the model's own output (CTC forced alignment, NvBridge.ctc
  // on the piece's log-probs): the words of the stretch rLocal placed it on are read in the simple spelling the model
  // learnt, and a word rLocal judged wrong (a garbled or cut word in the greedy text) turns right when the model's output
  // does read it there. Bench tools/asr/eval/p1b_port_eval.py: word verdicts 94.7% -> 96.9%. Any problem -> rLocal's verdicts.
  var CTCU = {}, ctcOk = null;
  // An ayah's Uthmani words (rWords) -> per word [simple-spelling letters, group]: words of one group share one simple
  // word (or a word splits in two). Port of p1b_verify.py units().
  function ctcUnits(k) {
    if (CTCU[k]) return CTCU[k];
    var sa = k.split(":"), U = rWords(k).map(rSkel), S = Q.q[sa[0] - 1][sa[1] - 1].split(" ").filter(function (w) { return norm(w); }), Sk = S.map(rSkel);
    var n = U.length, m = S.length, D = [], B = [], x, y, mv = [[1, 1], [1, 2], [1, 3], [2, 1], [3, 1]];
    var lev = function (a, b) { var d = [], i, j; for (j = 0; j <= b.length; j++) d[j] = j; for (i = 1; i <= a.length; i++) { var p = d[0]; d[0] = i; for (j = 1; j <= b.length; j++) { var t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; };
    for (x = 0; x <= n; x++) { D.push(new Array(m + 1).fill(1e9)); B.push(new Array(m + 1).fill(null)); } D[0][0] = 0;
    for (x = 0; x <= n; x++) for (y = 0; y <= m; y++) {
      if (D[x][y] >= 1e9) continue;
      mv.forEach(function (q) {
        if (x + q[0] > n || y + q[1] > m) return;
        var a = U.slice(x, x + q[0]).join(""), b = Sk.slice(y, y + q[1]).join(""), c = D[x][y] + lev(a, b) / Math.max(1, a.length, b.length) + 0.3 * (q[0] + q[1] - 2);
        if (c < D[x + q[0]][y + q[1]]) { D[x + q[0]][y + q[1]] = c; B[x + q[0]][y + q[1]] = q; }
      });
    }
    var out = new Array(n).fill(null); x = n; y = m;
    if (!B[n][m]) return (CTCU[k] = rWords(k).map(function (w, i) { return [norm(w).replace(/ /g, ""), i]; }));
    while (x > 0) {
      var q = B[x][y], t = norm(S.slice(y - q[1], y).join(" ")).replace(/ /g, "");
      for (var i = x - q[0]; i < x; i++) out[i] = [t, x - q[0]];
      x -= q[0]; y -= q[1];
    }
    return (CTCU[k] = out);
  }
  function ctcReady() {
    if (ctcOk !== null) return ctcOk;
    try {
      var v = JSON.parse(NvBridge.vocab());
      if (!v.length) return false;                                  // the model is not loaded yet: ask again later
      ctcOk = !!NvBridge.ctcSetup(JSON.stringify(v.map(function (t) { return norm(t.replace(/▁/g, " ")).replace(/ /g, ""); })));
    } catch (e) { ctcOk = false; }
    return ctcOk;
  }
  // r = rLocal's result on a final piece; key(i) = "s:a:w" (w = place in rWords) of expected word i. Turns r.v's wrong
  // words right where CTC reads them. Returns the number of words turned.
  var CTC_UNSURE = 1.0;
  function ctcJudge(r, key) {
    if (!r || Mic.cur !== "nv" || !window.NvBridge || !NvBridge.ctc || window.nvSeq == null || !ctcReady()) return 0;
    if (!Object.keys(r.v).some(function (i) { return r.v[i] === 0; })) return 0;
    var us = [], own = {}, prev = null, i, turned = 0;
    for (i = r.a; i < r.b; i++) {
      var p = key(i).split(":"), k = p[0] + ":" + p[1], u = ctcUnits(k)[+p[2]], id = k + "/" + (u ? u[1] : "x" + i);
      if (!u) return 0;
      if (id === prev) { own[i] = us.length - 1; continue; }
      us.push(u[0]); own[i] = us.length - 1; prev = id;
    }
    // S6 (5.16d): ctcM gives a skipped word's margin (best path - best path that reads it); a small one = the model
    // nearly read it, so the word shows «مش متأكد» (2, yellow) instead of red and is not counted wrong. Calibrated on the
    // L2 bench (s6_calib.py): m < 1 turns 10% of false reds, 1.9% of caught wrong words become yellow (not green).
    var M = !!NvBridge.ctcM, res, uns = 0;
    try { res = JSON.parse((M ? NvBridge.ctcM : NvBridge.ctc).call(NvBridge, window.nvSeq, JSON.stringify(us)) || "null"); } catch (e) { res = null; }
    if (!res || res.length !== us.length) return 0;
    for (i = r.a; i < r.b; i++) if (r.v[i] === 0) {
      var x = res[own[i]];
      if (M ? x < 0 : x === 1) { r.v[i] = 1; turned++; }
      else if (M && x < CTC_UNSURE) { r.v[i] = 2; uns++; }
    }
    if (turned) asrStat("ctc", turned);
    if (uns) asrStat("unsure", uns);
    return turned;
  }
  function rWords(k) { var sa = k.split(":"); return Q.t[sa[0] - 1][sa[1] - 1].split(" ").filter(function (w) { return norm(w).replace(/\s/g, ""); }); }
  // The whole Quran as one list of words (rSkel), built once: QF.k skeletons, QF.s/a/w the word's surah, ayah and
  // place in the ayah, QF.by skeleton -> its positions.
  var QF = null;
  function quranFlat() {
    if (QF) return QF;
    QF = { k: [], s: [], a: [], w: [], by: {} };
    for (var s = 1; s <= 114; s++) for (var a = 1; a <= Q.s[s - 1][3]; a++) rWords(s + ":" + a).forEach(function (w, i) {
      var k = rSkel(w), p = QF.k.length; QF.k.push(k); QF.s.push(s); QF.a.push(a); QF.w.push(i);
      if (k) (QF.by[k] = QF.by[k] || []).push(p);
    });
    return QF;
  }
  // Where in the whole Quran the heard words (rSkel) are being read, from any surah and any ayah. Every heard word
  // votes for the places it occurs at (exact skeleton), the places with most votes in a row are checked with rLocal
  // (misheard, extra and missing words allowed), and the one with clearly most right words wins. The same words in
  // two places (a repeated phrase) go to the one nearest page `near`. Returns { p: flat index after the last word
  // read, right: words right } or null while it is not clear yet.
  function quranLocate(H, near) {
    var F = quranFlat(), votes = {}, m = H.length;
    if (m < 3) return null;
    H.forEach(function (h, k) {
      var ps = h && h.length >= 2 && F.by[h]; if (!ps || ps.length > 2500) return;
      for (var i = 0; i < ps.length; i++) { var d = ps[i] - k; votes[d] = (votes[d] || 0) + 1; }
    });
    // a start counts the votes a few words either side (words missed or added shift it)
    var sc = {}; Object.keys(votes).forEach(function (d) { d = +d; for (var e = -2; e <= 2; e++) sc[d + e] = (sc[d + e] || 0) + votes[d]; });
    var cand = Object.keys(sc).map(Number).filter(function (d) { return sc[d] >= 2; }).sort(function (x, y) { return sc[y] - sc[x]; }), picked = [];
    for (var c = 0; c < cand.length && picked.length < 12; c++) if (!picked.some(function (q) { return Math.abs(q - cand[c]) < 6; })) picked.push(cand[c]);
    var res = picked.map(function (d) {
      var from = Math.max(0, d - 3), E = F.k.slice(from, Math.min(F.k.length, d + m + 6)), r = rLocal(H, E, d - from);
      if (!r) return null;
      var right = 0, wrong = 0, f = 1e9; Object.keys(r.v).forEach(function (i) { if (r.v[i]) { right++; f = Math.min(f, +i); } else wrong++; });
      return { p: from + r.b, a0: from + r.a, f: from + f, right: right, sc: right - 0.5 * wrong, txt: F.k.slice(from + r.a, from + r.b).join(" ") };
    }).filter(Boolean).sort(function (x, y) { return y.sc - x.sc; });
    if (!res.length || res[0].right < 3 || res[0].right < 0.5 * m) return null;
    var best = res[0], rival = res.filter(function (x) { return x.txt !== best.txt; })[0];
    if (rival && best.sc - rival.sc < 2) return null;                        // not clear yet: wait for more words
    if (near) {                                                               // the same words elsewhere: the nearest
      var same = res.filter(function (x) { return x.txt === best.txt && x.sc === best.sc; });
      same.sort(function (x, y) { return Math.abs(pageOf(F.s[x.a0], F.a[x.a0]) - near) - Math.abs(pageOf(F.s[y.a0], F.a[y.a0]) - near); });
      best = same[0];
    }
    return best;
  }
  // The next hidden ayah from where the test started (ayat of an earlier surah on the same page are left alone).
  function rNext() {
    var t = hifz.test, st = t ? t.s * 1000 + (t.a || 1) : 0, hid = hifz.items.filter(function (x) { return !hifz.shown[x]; });
    return hid.filter(function (x) { var sa = x.split(":"); return sa[0] * 1000 + +sa[1] >= st; })[0] || hid[0] || null;
  }
  // Each utterance is placed anywhere in the words of the page's ayat (rLocal): on from where the last one ended, or
  // where the reader started, went back or repeated. recite.V keeps every judged word ("s:a:w" -> 1 right, 0 wrong); an
  // ayah shows once its last word is judged, and its wrong words are marked red. While an utterance is still being
  // heard only right words count, so nothing turns red (or shows) ahead of the reader.
  function reciteHear(text, fin) {
    if (!recite.on || !hifz.on) return;
    if (!recite.base) recite.base = { shown: JSON.stringify(hifz.shown) };
    var shownBefore = JSON.parse(recite.base.shown), keys = [], E = [];
    hifz.items.forEach(function (x) { hifz.shown[x] = !!shownBefore[x]; });
    hifz.items.forEach(function (k) { rWords(k).forEach(function (w, i) { keys.push(k + ":" + i); E.push(rSkel(w)); }); });
    // 5.11 G7: the matcher also sees the next page's first ayah, so words read there count at once (and show after the
    // turn), and reading that went on past a misheard last word still turns the page
    var nOwn = keys.length, look = hifz.look = hifzLook();
    if (look) rWords(look).forEach(function (w, i) { keys.push(look + ":" + i); E.push(rSkel(w)); });
    var p0 = keys.indexOf(recite.ptr); if (p0 < 0) { var nk = rNext(); p0 = nk ? keys.indexOf(nk + ":0") : 0; }
    var hw = norm(text).split(" ").filter(Boolean); recite.heard = hw.length;
    if (recite.skip) { hw = hw.slice(recite.skip); if (fin) recite.skip = recite.heard = 0; } else if (fin) recite.heard = 0;
    var r = rLocal(hw.map(rSkel), E, p0), disp = {}, revealed = [];
    if (fin) ctcJudge(r, function (i) { return keys[i]; });
    Object.keys(recite.V).forEach(function (x) { disp[x] = recite.V[x]; });
    if (r) Object.keys(r.v).forEach(function (i) { if (fin || r.v[i] === 1) disp[keys[i]] = r.v[i]; });
    hifz.items.forEach(function (k) { if (!hifz.shown[k] && (k + ":" + (rWords(k).length - 1)) in disp) { hifz.shown[k] = true; revealed.push(k); } });
    if (r) { var last = keys[r.b - 1].split(":"); recite.k = last[0] + ":" + last[1]; recite.pos = +last[2] + 1; }
    recite.disp = disp;
    if (fin) reciteCommit(disp, r, keys);
    function reciteCommit(disp, r, keys) {
      recite.V = disp; recite.base = null;
      if (r) recite.ptr = r.b < keys.length ? keys[r.b] : null;
      // the score: every judged word of the ayat that are done
      var by = {}; recite.ok = recite.words = 0; recite.wrong = [];
      // only the ayat this piece judged are (re)marked and alerted: re-marking every ayah of the session on each piece
      // read and wrote the whole q.hifzAyat again and again, slower the longer the session (5.11 G7)
      var touched = null, marks = {};
      if (r) { touched = {}; Object.keys(r.v).forEach(function (i) { var pk = keys[i].split(":"); touched[pk[0] + ":" + pk[1]] = 1; }); }
      Object.keys(disp).forEach(function (x) { var sa = x.split(":"), k = sa[0] + ":" + sa[1]; (by[k] = by[k] || []).push([+sa[2], disp[x]]); });
      Object.keys(by).forEach(function (k) {
        if (!((k + ":" + (rWords(k).length - 1)) in disp)) return;
        var ws = rWords(k), bad = by[k].filter(function (x) { return x[1] === 0; });
        recite.words += by[k].length; recite.ok += by[k].length - bad.length;
        bad.sort(function (x, y) { return x[0] - y[0]; }).forEach(function (x) { recite.wrong.push([k, ws[x[0]]]); });
        if (touched && !touched[k]) return;
        if (bad.length > 5 && load("errAlert", true) && !(recite.alerted = recite.alerted || {})[k]) { recite.alerted[k] = 1; errAlert(); }
        if (hifz.test) { hifz.test.seen[k] = 1; if (bad.length) hifz.test.miss[k] = 1; else delete hifz.test.miss[k]; }
        marks[k] = !bad.length;
      });
      hifzMarks(marks);
    }
    // the end of the page heard while the piece is still going on: what was heard so far counts as final (the rest of
    // the piece is for the next page) and the page turns now, not after the piece ends + 700 ms (5.11 G7)
    var pe = hifzPageEnd(disp, keys, nOwn);
    if (!fin && pe && r) {
      // the page's own words get their verdicts; words already in the next page only when right (a partial's last word
      // can be cut in the middle, and the rest of this piece is skipped there)
      Object.keys(r.v).forEach(function (i) { if (+i < nOwn || r.v[i] === 1) disp[keys[i]] = r.v[i]; });
      fin = true; recite.disp = disp; reciteCommit(disp, r, keys); recite.skip = recite.heard; recite.cmt = true;
      hifz.items.forEach(function (k) { if (!hifz.shown[k] && (k + ":" + (rWords(k).length - 1)) in disp) { hifz.shown[k] = true; revealed.push(k); } });
    }
    // 5.16 U4: the last word of a place heard right while the piece goes on: the place is done now (no wait for the
    // pause + final), the rest of this piece is skipped in the next place
    var T4 = hifz.test;
    if (!fin && r && T4 && T4.end && !T4.fin && T4.pc && T4.pc.length && disp[T4.end + ":" + (rWords(T4.end).length - 1)] === 1) {
      Object.keys(r.v).forEach(function (i) { disp[keys[i]] = r.v[i]; });
      fin = true; recite.disp = disp; reciteCommit(disp, r, keys); recite.skip = recite.heard; recite.cmt = true;
      hifz.items.forEach(function (k) { if (!hifz.shown[k] && (k + ":" + (rWords(k).length - 1)) in disp) { hifz.shown[k] = true; revealed.push(k); } });
    }
    hifz.paint(); hifzBar(); reciteCap();
    if (fin) revealed.forEach(hifzRevealed);
    if (pe) hifzPageGo();
  }
  // The words of the ayah being recited, only as far as they were heard (red = wrong), under the corner mic.
  function reciteCap() {
    var b = document.getElementById("rdMic"); if (b) b.classList.toggle("on", recite.on || rd.on);
    var c = document.querySelector(".rd-cap"); if (c && !rd.on) c.remove();
    if (!recite.on || !b || rd.on) return;
    var k = recite.k, h = '<div class="rd-cap"><small>' + (k ? "سورة " + Q.s[k.split(":")[0] - 1][0] + " · الآية " + ar(+k.split(":")[1]) : "سامعك… سمّع من حفظك") + "</small>";
    if (k) h += "<div>" + rWords(k).slice(0, recite.pos).map(function (w, i) { var x = (recite.disp || {})[k + ":" + i]; return x === 0 ? '<span class="rc-bad">' + w + "</span>" : x === 2 ? '<span class="rc-uns">' + w + "</span>" : w; }).join(" ") + "</div>";
    b.insertAdjacentHTML("afterend", h + "</div>");
    capFollow(true);
  }
  // The caption beside the mic follows the reader in a long ayah: the word being read (or the last one recited) is kept
  // in view instead of the caption showing only the ayah's start.
  function capFollow(toEnd) {
    var c = document.querySelector(".rd-cap"); if (!c) return;
    var m = c.querySelector("mark");
    if (m && !toEnd) c.scrollTop += m.getBoundingClientRect().top - c.getBoundingClientRect().top - c.clientHeight / 2;
    else c.scrollTop = c.scrollHeight;
  }
  // The wrong words of a recited ayah ("s:a" -> word numbers), for marking them red.
  function reciteBad(k) {
    var V = recite.disp || recite.V || {}, out = [];
    rWords(k).forEach(function (w, i) { if (V[k + ":" + i] === 0) out.push(i); });
    return out;
  }
  window.onRecite = function (text, kind) {
    if (kind.indexOf("state:") === 0) {
      var st = kind.slice(6);
      if (st === "busy") { toast("بيجهّز الموديل…"); return; }
      if (st === "noperm") toast("محتاج إذن الميكروفون عشان التسميع");
      else if (st === "none") toast("الموبايل مفيهوش خدمة التعرّف على الكلام");
      else if (st.indexOf("error") === 0) toast("التسميع وقف (" + st.slice(6) + ")، دوس على المايك تاني");
      if (st === "listening" && Mic.cur === "nv") ctcReady();
      if (st !== "listening") { recite.on = false; recite.base = null; } hifzBar(); reciteCap(); return;
    }
    reciteHear(text, kind === "final");
  };
  function reciteToggle() {
    if (recite.on) { recite.on = false; recite.base = null; Mic.stop(); hifzBar(); reciteCap(); return; }
    if (!window.ReciteBridge) return toast("التسميع بالصوت شغال في التطبيق على الموبايل بس");
    if (!micGate(reciteToggle)) return;
    recite.on = true; recite.k = null; recite.pos = 0; recite.base = null; hifzPageTop(); Mic.start(); hifzBar(); reciteCap();
  }
  function reciteStop() { if (recite.on) { recite.on = false; Mic.stop(); reciteCap(); } }

  // ---------- القراءة بالصوت على صفحات المصحف ----------
  // The mic in the corner of the mushaf pages: the reader recites, the ayah is found from the words heard (voiceAyahs) and
  // opened, then followed word by word as the reading goes on: the ayah is lit on the scan, the word being read is shown
  // in a caption and boxed on the scan (its place estimated from the letters of the ayah's line pieces, as the scans have
  // no word boxes), and at the end of the page the page is turned.
  var rdPage = null;
  var rd = { on: false, s: 0, a: 0, w: 0, heard: [], done: 0 };
  function rdMicHtml() { return '<button id="rdMic" class="rd-mic' + (rd.on ? " on" : "") + '" aria-label="القراءة بالصوت">' + ic("mic") + "</button>" + (rd.on ? rdCapHtml() : ""); }
  function rdWords(s, a) { return Q.t[s - 1][a - 1].split(" "); }
  function rdCapHtml() {
    if (!rd.s) return '<div class="rd-cap"><small>سامعك… ابدأ القراءة من أي آية' + (rd.heard.length ? " · بدوّر على الآية" : "") + "</small>" + (rd.heard.length ? "<div>" + esc(rd.heard.join(" ")) + "</div>" : "") + "</div>";
    return '<div class="rd-cap"><small>سورة ' + Q.s[rd.s - 1][0] + " · الآية " + ar(rd.a) + "</small><div>" + rdWords(rd.s, rd.a).map(function (w, i) {
      return i === rd.w ? "<mark>" + w + "</mark>" : w; }).join(" ") + "</div></div>";
  }
  function rdPaint() {
    var b = document.getElementById("rdMic"); if (b) b.classList.toggle("on", rd.on);
    var c = document.querySelector(".rd-cap"); if (c) c.remove();
    if (rd.on && b) { b.insertAdjacentHTML("afterend", rdCapHtml()); capFollow(false); if (rd.s) ayahBar(null); }
    document.querySelectorAll(".rd-word").forEach(function (x) { x.remove(); });
    if (!rd.on || !rd.s || !rdPage) return;
    wordBoxes(rd.s, rd.a, rdWords(rd.s, rd.a), rd.w, rdPage.box, "rd-word");
    rdFollow();
  }
  // Boxes for word w of an ayah on the scan: the ayah's letters spread over its line pieces (right to left, in reading
  // order), as the scans have no word boxes. box(page) gives the page's element.
  function wordBoxes(s, a, ws, wi, box, cls) {
    var rs = (Q.r[s - 1] && Q.r[s - 1][a - 1]) || [], len = function (w) { return norm(w).length + 1; };
    // 5.19: the measured word boxes when this edition has them (wi counted among the real words, as rWords)
    if (EDS[edition] && EDS[edition].w) {
      var ri = 0, got = false, pgs = [];
      for (var k = 0; k < wi; k++) if (norm(ws[k]).replace(/\s/g, "")) ri++;
      rs.forEach(function (r) { if (pgs.indexOf(r[0]) < 0) pgs.push(r[0]); });
      pgs.forEach(function (p) {
        var rows = wbRows(p); if (!rows) { wbNeed(p, function () {}); return; }
        rows.forEach(function (r) {
          if (r[0] !== s || r[1] !== a || r[2] !== ri) return; var bx = box(p); if (!bx) return; got = true;
          var d = document.createElement("div"); d.className = cls;
          d.style.cssText = "left:" + r[3] / 10 + "%;top:" + r[4] / 10 + "%;width:" + (r[5] - r[3]) / 10 + "%;height:" + (r[6] - r[4]) / 10 + "%";
          bx.appendChild(d);
        });
      });
      if (got) return;
    }
    var total = ws.reduce(function (t, w) { return t + len(w); }, 0), from = 0;
    for (var i = 0; i < wi; i++) from += len(ws[i]);
    var to = from + len(ws[wi] || ""), span = rs.reduce(function (t, r) { return t + r[3] - r[1]; }, 0), acc = 0;
    rs.forEach(function (r) {
      var w = r[3] - r[1], a0 = acc / span * total, a1 = (acc + w) / span * total; acc += w;
      var x0 = Math.max(from, a0), x1 = Math.min(to, a1); if (x1 <= x0) return;
      var bx = box(r[0]); if (!bx) return;
      var right = r[3] - (x0 - a0) / (a1 - a0) * w, left = r[3] - (x1 - a0) / (a1 - a0) * w;
      var d = document.createElement("div"); d.className = cls;
      d.style.cssText = "left:" + left / 10 + "%;top:" + r[2] / 10 + "%;width:" + (right - left) / 10 + "%;height:" + (r[4] - r[2]) / 10 + "%";
      bx.appendChild(d);
    });
  }
  function rdSame(x, y) {
    if (x === y) return true;
    if (x.length < 3 || y.length < 3) return false;
    var sx = skel(x), sy = skel(y); if (sx === sy) return true;
    if (Math.abs(x.length - y.length) > 1) return false;
    var d = 0, i = 0, j = 0;
    while (i < x.length && j < y.length) { if (x[i] === y[j]) { i++; j++; continue; } if (++d > 1) return false; if (x.length > y.length) i++; else if (y.length > x.length) j++; else { i++; j++; } }
    return d + (x.length - i) + (y.length - j) <= 1;
  }
  function rdGo(s, a) {
    var p = pageOf(s, a); rd.s = s; rd.a = a;
    // heard from the home screen while reading in the text view: open the ayah there (following runs on the mushaf only)
    if (!rdPage && mode !== "pages") { location.hash = "#/s/" + s + "/" + a; return; }
    if (rdPage && (rdPage.pages ? rdPage.pages.indexOf(p) >= 0 : rdPage.box(p))) { rdPage.mark(s, a); rdPaint(); return; }
    // the next page: turned with the effect chosen in Settings (curl / slide), like a tap on the next-page button
    if (rdPage && rdPage.pages && rdPage.turn && p === rdPage.pages[rdPage.pages.length - 1] + 1) { rdPage.turn(); return; }
    location.hash = "#/p/" + p + "?a=" + s + ":" + a;
  }
  function rdNext() {
    var s = rd.s, a = rd.a + 1;
    if (a > Q.s[s - 1][3]) { s++; a = 1; }
    if (s > 114) { rdStop(); toast("صدق الله العظيم"); return; }
    rd.w = 0; rdGo(s, a);
  }
  // Words heard since the last call, matched forward in the ayah (a few may be missed or misheard).
  function rdHear(text, fin) {
    var ws = norm(text).split(/\s+/).filter(Boolean), fresh = ws.slice(rd.done);
    rd.done = fin ? 0 : ws.length;
    if (!rd.s) {
      rd.heard = rd.heard.concat(fresh).slice(-14);
      rdPaint();                                     // the words heard so far, while the ayah is looked for
      // the place is looked for in the whole Quran from the words heard (quranLocate: any surah, any ayah, misheard
      // words allowed); the open page only settles the same words found in two places
      var m = /^#\/p\/(\d+)/.exec(location.hash), op = m ? +m[1] : 0, got = quranLocate(rd.heard.map(rSkel), op);
      if (!got) return;
      var F = quranFlat(), q = got.p - 1, all, cnt = -1;
      rd.s = F.s[q]; rd.a = F.a[q]; rd.w = 0; all = rdWords(rd.s, rd.a);
      for (var i = 0; i < all.length; i++) if (norm(all[i]).replace(/\s/g, "") && ++cnt === F.w[q]) { rd.w = i + 1; break; }   // after the last word read
      fresh = []; rd.heard = []; rd.miss = 0;
      toast("سورة " + Q.s[rd.s - 1][0] + " · الآية " + ar(rd.a));
      rdGo(rd.s, rd.a); rdHints();
    }
    fresh.forEach(function (hw) {
      var aw = rdWords(rd.s, rd.a).map(norm), hit = false;
      for (var j = rd.w; j < Math.min(aw.length, rd.w + 4); j++) if (rdSame(hw, aw[j])) { rd.w = j + 1; hit = true; break; }
      // the reader may already be in the next ayah (the end of this one was missed)
      if (!hit && rd.w >= aw.length - 3 && rd.a < Q.s[rd.s - 1][3]) {
        var nw = rdWords(rd.s, rd.a + 1).map(norm);
        for (var k = 0; k < Math.min(3, nw.length); k++) if (rdSame(hw, nw[k])) { rdNext(); rd.w = k + 1; hit = true; break; }
      }
      // a short word (في، ما، أن) fits almost anywhere: it does not prove the reader is still here (5.11 G7)
      var strong = hit && hw.length > 2;
      rd.miss = strong ? 0 : hit ? (rd.miss || 0) : (rd.miss || 0) + 1; asrStat(hit ? "rh" : "rm");
      if (strong) rd.lost = []; else (rd.lost = rd.lost || []).push(hw);     // the words since the last one that surely fitted
      if (!hit && rd.miss >= 4 && rd.miss < 8 && rd.lost.length >= 4 && rdRelocate()) return;
      if (rd.w >= aw.length && hit) rdNext();
    });
    if (rd.miss >= 8) { rd.s = 0; rd.heard = []; rd.miss = 0; }
    if (rd.s && rd.w >= rdWords(rd.s, rd.a).length) rdNext();
    rdSplitTurn();
    rdPaint();
  }
  // a few words that fit nowhere near: the reader may have jumped (the next page, another ayah). The words heard since the
  // last sure fit are looked for around this page (quranLocate) after 4 misses, before the 8-miss start from scratch (5.11 G7)
  function rdRelocate() {
    var mp = /^#\/p\/(\d+)/.exec(location.hash), g = quranLocate(rd.lost.map(rSkel), mp ? +mp[1] : 0); if (!g) return false;
    var F = quranFlat(), q = g.p - 1, s = F.s[q], a = F.a[q]; if (s === rd.s && a === rd.a) return false;
    rd.s = s; rd.a = a; rd.w = rdTok(s, a, F.w[q] + 1); rd.miss = 0; rd.lost = []; rd.split = null;
    rdGo(s, a); rdHints(); return true;
  }
  // tokens of the ayah (rdWords) that hold the first n real words (rWords skips tokens with no letters)
  function rdTok(s, a, n) { var t = rdWords(s, a), c = 0; for (var i = 0; i < t.length; i++) { if (norm(t[i]).replace(/\s/g, "")) c++; if (c >= n) return i + 1; } return t.length; }
  // an ayah that runs on to the next page: the page turns when its last word printed here is read (5.11 G7)
  function rdSplitTurn() {
    if (!rd.s || !rdPage || !rdPage.pages || !rdPage.turn) return;
    var k = rd.s + ":" + rd.a, li = lastWordOnPages(k, rdPage.pages), real = rWords(k).length;
    if (li < 0 || li >= real - 1 || rd.split === k + "@" + rdPage.pages[0]) return;
    var t = rdWords(rd.s, rd.a), c = 0; for (var i = 0; i < rd.w && i < t.length; i++) if (norm(t[i]).replace(/\s/g, "")) c++;
    if (c - 1 >= li) { rd.split = k + "@" + rdPage.pages[0]; rdPage.turn(); }
  }
  // the word being read stays in view (portrait and landscape, single page and vertical), between the bar and 70%
  function rdFollow() {
    var w = document.querySelector(".rd-word"); if (!w) return;
    var r = w.getBoundingClientRect(), top = (document.querySelector(".bar") || { offsetHeight: 0 }).offsetHeight + 8;
    if (r.top < top || r.bottom > innerHeight * 0.7) window.scrollBy({ top: r.top - Math.max(top, innerHeight * 0.35), behavior: "smooth" });
  }
  // Of the recogniser's guesses, the one that fits the ayah being read best (or, before it is found, any ayah best).
  function rdPick(alts) {
    if (alts.length < 2) return alts[0];
    var best = alts[0], bs = -1;
    alts.forEach(function (t) {
      var ws = norm(t).split(/\s+/).filter(Boolean), sc = 0;
      if (rd.s) { var aw = rdWords(rd.s, rd.a).concat(rd.a < Q.s[rd.s - 1][3] ? rdWords(rd.s, rd.a + 1) : []).map(norm); ws.forEach(function (w) { if (aw.some(function (x) { return rdSame(w, x); })) sc++; }); }
      else { var n = voiceAyahs(rd.heard.concat(ws).join(" ")); sc = n.length ? n[0][0] : 0; }
      if (sc > bs) { bs = sc; best = t; }
    });
    return best;
  }
  // Once the ayah being read is found, its page's ayahs are given to the recogniser so it expects these words; before
  // that it gets none, so it hears freely and the ayah can be anywhere in the Quran.
  function rdHints() {
    if (!window.ReciteBridge || !ReciteBridge.setHints) return;
    var m = /^#\/p\/(\d+)/.exec(location.hash), p = rd.s ? pageOf(rd.s, rd.a) : 0, out = [];
    if (!p) { try { ReciteBridge.setHints(""); } catch (e) {} return; }
    for (var si = 0; si < 114; si++) for (var ai = 0; ai < Q.s[si][3]; ai++) { var r = Q.r[si] && Q.r[si][ai]; if (r && r.some(function (b) { return b[0] === p || b[0] === p + 1; })) out.push(norm(Q.q[si][ai])); }
    try { ReciteBridge.setHints(out.join("\n")); } catch (e) {}
  }
  // The recogniser: the phone's own (ReciteBridge), or a Quran model run on the phone (asr.js), chosen in Settings.
  asrBtn(); micTestRow();
  document.getElementById("micTestBtn").onclick = function () { micTest(document.getElementById("micTestSum"), this); };
  function asrModel() { return null; }   // the whisper models (asr.js) are gone since 5.4; NvAsr or the phone's recogniser
  // The microphone behind every voice feature: NVIDIA's model on the phone (NvAsr.java) when it is chosen and downloaded,
  // else the phone's own recogniser (ReciteBridge). Both answer through window.onRecite.
  var Mic = {
    cur: null,
    nv: function () { return !!window.NvBridge && NvBridge.ready(); },
    start: function () { Mic.cur = Mic.nv() ? "nv" : "phone"; if (Mic.cur === "nv") NvBridge.start(); else ReciteBridge.start(); },
    stop: function () { var c = Mic.cur; Mic.cur = null; try { if (c === "nv") NvBridge.stop(); else if (window.ReciteBridge) ReciteBridge.stop(); } catch (e) {} }
  };
  function rdStop() { if (!rd.on) return; rd.on = false; try { if (window.Asr) Asr.stop(); } catch (e) {} Mic.stop(); rdPaint(); }
  function rdToggle() {
    if (rd.on) return rdStop();
    if (hifz.on) return reciteToggle();          // ayat hidden: recite from memory, they show as they are said
    var m = Mic.nv() ? null : asrModel();
    if (!micGate(rdToggle)) return;
    if (!m && !window.ReciteBridge) return toast("القراءة بالصوت شغالة في التطبيق على الموبايل بس");
    reciteStop(); player.stop();
    rd = { on: true, s: 0, a: 0, w: 0, heard: [], done: 0, lost: [], split: null };
    if (m) {
      Asr.start(m, function (t, k) {
        if (k === "final") { if (window.onRecite) onRecite(t, "final"); return; }
        if (k === "state:busy") toast("بيجهّز الموديل…");
        else if (k === "state:listening") toast("ابدأ القراءة");
        else if (k === "state:noperm") { toast("محتاج إذن الميكروفون"); rdStop(); }
        else if (k.indexOf("state:error") === 0) { toast("الموديل وقف: " + k.slice(12)); rdStop(); }
      });
    } else { rdHints(); Mic.start(); }
    rdPaint();
  }
  document.addEventListener("click", function (e) { if (e.target.closest("#rdMic")) rdToggle(); });
  window.addEventListener("hashchange", function () { if (rd.on && !/^#\/p\//.test(location.hash)) rdStop(); else { setTimeout(rdPaint, 50); if (rd.on) rdHints(); } });

  // ---------- الأوامر الصوتية ----------
  // The mic on the search screen hears one sentence with the phone's speech recogniser (ReciteBridge, shared with the
  // hifz test). A command («افتح سورة الكهف»، «صفحة خمسين»، «آية الكرسي»، «شغّل»…) is carried out; anything else is
  // written in the search box, and words recited from the Quran also list the closest ayahs.
  var voice = { on: false, cb: null };
  var NUM_W = { "صفر": 0, "واحد": 1, "واحده": 1, "اول": 1, "اولي": 1, "اثنين": 2, "اتنين": 2, "اثنان": 2, "ثاني": 2, "ثانيه": 2, "ثلاث": 3, "ثلاثه": 3, "تلاته": 3, "تلات": 3, "ثالث": 3, "اربع": 4, "اربعه": 4, "رابع": 4,
    "خمس": 5, "خمسه": 5, "خامس": 5, "ست": 6, "سته": 6, "سادس": 6, "سبع": 7, "سبعه": 7, "سابع": 7, "ثمان": 8, "ثماني": 8, "ثمانيه": 8, "تمانيه": 8, "تمن": 8, "ثامن": 8, "تسع": 9, "تسعه": 9, "تاسع": 9,
    "عشر": 10, "عشره": 10, "عاشر": 10, "حداشر": 11, "اتناشر": 12, "تلتاشر": 13, "اربعتاشر": 14, "خمستاشر": 15, "ستاشر": 16, "سبعتاشر": 17, "تمنتاشر": 18, "تسعتاشر": 19,
    "عشرين": 20, "عشرون": 20, "ثلاثين": 30, "تلاتين": 30, "اربعين": 40, "خمسين": 50, "ستين": 60, "سبعين": 70, "ثمانين": 80, "تمانين": 80, "تسعين": 90,
    "ميه": 100, "مائه": 100, "مية": 100, "ميتين": 200, "مئتين": 200, "مائتين": 200, "تلتميه": 300, "ثلاثمائه": 300, "ربعميه": 400, "اربعمائه": 400, "خمسميه": 500, "خمسمائه": 500, "ستميه": 600, "ستمائه": 600 };
  // The first number in the words, from digits or from Arabic number words («مية وخمسة وعشرين» = 125).
  function voiceNum(words) {
    var n = 0, got = false;
    for (var i = 0; i < words.length; i++) {
      var w = en(words[i]);
      if (/^\d+$/.test(w)) return +w;
      var x = w.replace(/^و/, ""), v = NUM_W[x];
      if (v === undefined && /^(ال)/.test(x)) v = NUM_W[x.slice(2)];
      if (v === undefined) { if (got) break; continue; }
      if (v === 10 && got && n % 10 && n < 10) n += 10; else n += v;
      got = true;
    }
    return got ? n : null;
  }
  function voiceSurah(t) {
    var best = 0, bl = 0;
    for (var i = 0; i < 114; i++) {
      var nm = norm(Q.s[i][0]).replace(/^ال/, "");
      if (nm.length > bl && (" " + t + " ").replace(/ ال/g, " ").indexOf(" " + nm + " ") >= 0) { best = i + 1; bl = nm.length; }
    }
    return best;
  }
  function voiceRun(raw) {
    var t = norm(raw).replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ").trim(), w = t.split(" ");
    var has = function (re) { return re.test(t); }, num = voiceNum(w), go = function (h, msg) { toast(msg); location.hash = h; return true; };
    if (has(/^(شغل|اقرا|استمع|سمعني|ابدا القراءه)/)) {
      var f = /^#\/p\/(\d+)/.exec(location.hash), pg = f ? +f[1] : 0, fa = pg ? firstAyahOfPage(pg) : null;
      var sm = /^#\/s\/(\d+)/.exec(location.hash);
      if (fa) player.play(fa[0], fa[1]); else if (sm) player.play(+sm[1], 1); else return false;
      toast("بيشغّل التلاوة"); return true;
    }
    if (has(/^(وقف|اسكت|ايقاف|اقف)/)) { player.stop(); toast("وقف"); return true; }
    if (has(/(الصفحه )?(التاليه|اللي بعدها|بعدها|الجايه)$/) && document.getElementById("pNext")) { document.getElementById("pNext").click(); return true; }
    if (has(/(الصفحه )?(السابقه|اللي قبلها|قبلها)$/) && document.getElementById("pPrev")) { document.getElementById("pPrev").click(); return true; }
    if (has(/ايه الكرسي/)) return go("#/p/" + pageOf(2, 255) + "?a=2:255", "آية الكرسي");
    if (has(/صفح/) && num) { if (num >= Q.min && num < Q.count) return go("#/p/" + num, "صفحة " + ar(num)); toast("الطبعة دي صفحاتها لحد " + ar(Q.count - 1)); return true; }
    if (has(/(جزء|الجزء)/) && num >= 1 && num <= 30) {
      for (var p = Q.min; p < Q.count; p++) if (juzOfPage(p) === num) return go("#/p/" + p, "الجزء " + ar(num));
    }
    var pl = [[/مواقيت|الاذان|اوقات الصلاه/, "#/prayer", "مواقيت الصلاة"], [/القبله/, "#/qibla", "القبلة"], [/اذكار الصباح/, "#/azkar/m", "أذكار الصباح"], [/اذكار المساء/, "#/azkar/e", "أذكار المساء"],
      [/الاذكار|اذكار/, "#/azkar", "الأذكار"], [/الختمه/, "#/khatma", "الختمة"], [/التسبيح|السبحه/, "#/tasbih", "التسبيح"], [/الامساكيه/, "#/imsakia", "الإمساكية"], [/التجويد/, "#/tajweed", "دليل التجويد"], [/الرئيسيه|البدايه/, "#/", "الرئيسية"]];
    for (var i = 0; i < pl.length; i++) if (pl[i][0].test(t)) return go(pl[i][1], pl[i][2]);
    var sur = voiceSurah(t);
    if (sur && (has(/سوره|افتح|اقرا/) || w.length <= 2)) {
      var am = /(ايه|الايه|ايات)\s+(.*)$/.exec(t), a = am ? voiceNum(am[2].split(" ")) : null;
      if (!a && has(/ايه/) && num) a = num;
      a = a && a <= Q.s[sur - 1][3] ? a : 1;
      if (mode === "pages") return go("#/p/" + pageOf(sur, a) + (a > 1 ? "?a=" + sur + ":" + a : ""), "سورة " + Q.s[sur - 1][0] + (a > 1 ? " · الآية " + ar(a) : ""));
      return go("#/s/" + sur + "/" + a, "سورة " + Q.s[sur - 1][0]);
    }
    if (has(/الاعدادات/)) { document.getElementById("btnSettings").click(); return true; }
    return false;
  }
  // Recited words: the ayahs whose words they share most, in order (the recogniser may drop or change a few).
  function voiceAyahs(raw) {
    var ws = norm(raw).split(/\s+/).filter(function (x) { return x.length > 1; });
    if (ws.length < 3) return [];
    if (!index) buildIndex();
    // words heard in order in a text; a short ayah is also read on into the next two, as one recites them together
    function hits(tx) { var h = 0, pos = 0; for (var k = 0; k < ws.length; k++) { var j = tx.indexOf(" " + ws[k], pos); if (j >= 0) { h++; pos = j + 1; } } return h; }
    var out = [];
    for (var i = 0; i < index.length; i++) {
      var best = 0, own = 0;
      [2, 3].forEach(function (c) {
        var tx = index[i][c];
        own = Math.max(own, hits(tx));
        for (var d = 1; d <= 2; d++) { var r = index[i + d]; if (r && r[0] === index[i][0]) tx += r[c]; }
        best = Math.max(best, hits(tx));
      });
      // the ayah where the recitation starts: its own first heard word counts most
      if (best / ws.length >= 0.6) out.push([best / ws.length, index[i][0], index[i][1], own, index[i][2].indexOf(" " + ws[0] + " ") >= 0 || index[i][3].indexOf(" " + ws[0] + " ") >= 0 ? 1 : 0]);
    }
    return out.sort(function (x, y) { return y[0] - x[0] || y[4] - x[4] || y[3] - x[3]; }).slice(0, 5);
  }
  // Recited words -> the ayah where they start, from anywhere in the Quran (quranLocate), or null while not clear.
  function voiceLocate(raw) {
    var got = quranLocate(norm(raw || "").split(/\s+/).filter(Boolean).map(rSkel), 0);
    if (!got) return null;
    var F = quranFlat(); return { s: F.s[got.f], a: F.a[got.f] };       // the ayah of the first word heard right
  }
  function voiceListen(cb) {
    if (!window.ReciteBridge) return toast("الأوامر الصوتية شغالة في التطبيق على الموبايل بس");
    if (voice.on) { voice.on = false; Mic.stop(); return; }
    if (!micGate(function () { voiceListen(cb); })) return;
    reciteStop(); voice.on = true; voice.cb = cb; Mic.start();
  }
  // The index mic: recite an ayah and its page opens in the chosen edition, the ayah highlighted.
  (function () {
    var b = document.getElementById("idxMic"); if (!b) return;
    b.hidden = !window.ReciteBridge;
    // Words of several utterances add up (from any surah and any ayah, quranLocate) until the place is clear; the old
    // word-overlap search (voiceAyahs) is the fallback when the mic ends without a clear place.
    b.onclick = function () {
      var heard = [], done = false, finals = 0;
      function open(s, a, guess) {
        asrStat(guess ? "lost" : "loc");
        done = true; b.classList.remove("on"); voice.on = false; Mic.stop(); indexSheet.hidden = true;
        if (mode === "pages") openAyahPage(s, a, ""); else location.hash = "#/s/" + s + "/" + a;
      }
      voiceListen(function (text, kind) {
        if (done) return;
        if (kind === "listening") { b.classList.add("on"); toast("اقرأ آية…"); return; }
        var ws = norm(text || "").split(/\s+/).filter(Boolean), all = heard.concat(ws).slice(-20);
        if (kind === "end") {
          b.classList.remove("on");
          var near = all.length ? voiceAyahs(all.join(" ")) : [];
          if (near.length) open(near[0][1], near[0][2], 1); else if (all.length) { asrStat("lost"); toast("ماعرفتش الآية، اقرأ كام كلمة كمان"); }
          return;
        }
        var got = voiceLocate(all.join(" "));
        if (got) return open(got.s, got.a);
        if (kind !== "final") return;
        heard = all; finals++;
        if (finals >= 3) {                                    // three utterances and still not clear: best guess
          var nr = voiceAyahs(heard.join(" "));
          if (nr.length) return open(nr[0][1], nr[0][2], 1);
          asrStat("lost"); done = true; b.classList.remove("on"); voice.on = false; Mic.stop();
          return toast("ماعرفتش الآية، اقرأ كام كلمة كمان");
        }
        toast("كمّل القراءة…");
      });
    };
  })();
  var reciteOnRecite = window.onRecite;
  window.onRecite = function (text, kind) {
    var alts = (text || "").split("\n"); text = alts[0];
    if (kind === "final" && text) { asrStat("u"); asrStat("w", norm(text).split(/\s+/).filter(Boolean).length); }
    // NvAsr tells how long each decode took (5.11 G7): the stats show the average, for the phone's real numbers
    if (window.nvMs != null && (kind === "final" || kind === "partial")) { asrStat("dms", window.nvMs); asrStat("dn"); if (window.nvLen) asrStat("dlen", window.nvLen); window.nvMs = window.nvLen = null; }
    if (rd.on) {
      if (kind.indexOf("state:") === 0) {
        var st0 = kind.slice(6);
        if (st0 === "busy") { toast("بيجهّز الموديل…"); return; }
        if (st0 === "listening" && Mic.cur === "nv") { toast("ابدأ القراءة"); return; }
        if (st0 === "noperm") toast("محتاج إذن الميكروفون للقراءة بالصوت");
        if (st0.indexOf("error") === 0 && Mic.cur === "nv") { toast("الموديل وقف: " + st0.slice(6)); Mic.stop(); }
        if (st0 !== "listening" && (st0.indexOf("error") !== 0 || Mic.cur === null)) { rd.on = false; rdPaint(); }
        return;
      }
      return rdHear(rdPick(alts), kind === "final");
    }
    if (!voice.on) return reciteOnRecite(text, kind);
    if (kind.indexOf("state:") === 0) {
      var st = kind.slice(6);
      if (st === "busy") { toast("بيجهّز الموديل…"); return; }
      if (st === "noperm") toast("محتاج إذن الميكروفون للأوامر الصوتية");
      else if (st === "none") toast("الموبايل مفيهوش خدمة التعرّف على الكلام");
      if (st !== "listening") { voice.on = false; voice.cb && voice.cb(null, "end"); } else voice.cb && voice.cb(null, "listening");
      return;
    }
    if (kind === "final") { voice.on = false; Mic.stop(); }
    voice.cb && voice.cb(text, kind);
  };

  // ---------- العلامات وخطة الختمة ----------
  // Bookmarks: [{n: name, s, a, t: time}]. The khatma plan reads the mushaf pages Q.first..Q.last in `days` days:
  // {start: "YYYY-MM-DD", days, from, to, done}, done = the last page read (moves on as pages are turned in order).
  function dayNum(d) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
  function todayStr() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function parseDay(t) { var p = t.split("-"); return dayNum(new Date(+p[0], +p[1] - 1, +p[2])); }
  function marks() { return load("marks", []); }
  function addBookmark(s, a) {
    askText("اسم العلامة", "سورة " + Q.s[s - 1][0] + " · الآية " + ar(a), function (name) {
      var m = marks(); m.unshift({ n: name, s: s, a: a, t: Date.now() }); save("marks", m);
      toast("حُفظت العلامة «" + name + "»");
    });
  }
  // A small sheet with one text field (prompt() does nothing inside the Android WebView).
  // Repeat a chosen group of ayat: from, to, and how many times the whole group is recited (0 = until stopped).
  function rangeDialog(s, a) {
    var n = Q.s[s - 1][3], TIMES = [1, 2, 3, 5, 7, 10, 0], times = load("rangeTimes", 3);
    var d = el('<div class="dlg-back"><form class="dlg rg-dlg"><b>تكرار مجموعة آيات · سورة ' + Q.s[s - 1][0] + "</b>" +
      '<div class="rg-row"><label>من الآية<input class="input" id="rgFrom" type="number" inputmode="numeric" min="1" max="' + n + '" value="' + a + '"></label>' +
      '<label>إلى الآية<input class="input" id="rgTo" type="number" inputmode="numeric" min="1" max="' + n + '" value="' + Math.min(n, a + 4) + '"></label></div>' +
      '<div class="rg-lbl">عدد مرات تكرار المجموعة</div><div class="rg-times">' + TIMES.map(function (t) {
        return '<button type="button" data-t="' + t + '"' + (t === times ? ' class="on"' : "") + ">" + (t ? ar(t) : "∞") + "</button>"; }).join("") + "</div>" +
      '<div class="dlg-btns"><button type="submit" class="dlg-ok">تشغيل</button><button type="button" class="dlg-no">إلغاء</button></div></form></div>').firstChild;
    document.body.appendChild(d);
    d.querySelectorAll(".rg-times button").forEach(function (b) { b.onclick = function () {
      times = +b.dataset.t; d.querySelectorAll(".rg-times button").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
    d.querySelector(".dlg-no").onclick = function () { d.remove(); };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    d.querySelector("form").onsubmit = function (e) {
      e.preventDefault();
      var f = Math.round(+d.querySelector("#rgFrom").value), t = Math.round(+d.querySelector("#rgTo").value);
      if (!(f >= 1 && f <= n && t >= 1 && t <= n)) return toast("رقم آية غير صحيح");
      if (t < f) { var x = f; f = t; t = x; }
      d.remove(); save("rangeTimes", times); player.playRange(s, f, t, times);
    };
  }
  // ---------- personal notes on an ayah (kept on the phone, shown on the ayah screen) ----------
  function noteDialog(s, a, done) {
    var notes = load("notes", {}), k = s + ":" + a;
    var d = el('<div class="dlg-back"><form class="dlg"><b>ملاحظتي على سورة ' + Q.s[s - 1][0] + " · الآية " + ar(a) + "</b>" +
      '<textarea class="input note-in" rows="5" maxlength="4000" placeholder="اكتب ملاحظتك…"></textarea><div class="dlg-btns">' +
      '<button type="submit" class="dlg-ok">حفظ</button>' + (notes[k] ? '<button type="button" class="dlg-del">حذف</button>' : "") +
      '<button type="button" class="dlg-no">إلغاء</button></div></form></div>').firstChild;
    document.body.appendChild(d);
    var inp = d.querySelector("textarea"); inp.value = notes[k] || ""; inp.focus();
    function put(v) { notes = load("notes", {}); if (v) notes[k] = v; else delete notes[k]; save("notes", notes); d.remove(); toast(v ? "حُفظت الملاحظة" : "حُذفت الملاحظة"); if (done) done(); }
    d.querySelector(".dlg-no").onclick = function () { d.remove(); };
    if (d.querySelector(".dlg-del")) d.querySelector(".dlg-del").onclick = function () { if (confirm("تحذف الملاحظة؟")) put(""); };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    d.querySelector("form").onsubmit = function (e) { e.preventDefault(); put(inp.value.trim()); };
  }

  // ---------- share an ayah: as text with tashkeel and its reference, or as a picture in the mushaf font ----------
  function shareDialog(s, a) {
    var d = el('<div class="dlg-back"><div class="dlg"><b>مشاركة سورة ' + Q.s[s - 1][0] + " · الآية " + ar(a) + "</b>" +
      '<div class="sh-opts"><button data-k="txt">' + ic("text") + "نص بالتشكيل</button><button data-k=\"img\">" + ic("share") + "صورة بخط المصحف</button></div>" +
      '<div class="dlg-btns"><button type="button" class="dlg-no">إلغاء</button></div></div></div>').firstChild;
    document.body.appendChild(d);
    d.querySelector(".dlg-no").onclick = function () { d.remove(); };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    d.querySelectorAll(".sh-opts button").forEach(function (b) { b.onclick = function () {
      d.remove();
      if (b.dataset.k === "txt") return shareText(ayahForCopy(s, a, true));
      ayahImage(s, a, function (url) { shareImage(url, "ayah-" + s + "-" + a + ".png"); });
    }; });
  }
  function shareText(t) {
    try { if (window.AppBridge && AppBridge.shareText) return AppBridge.shareText(t); } catch (e) {}
    if (navigator.share) return navigator.share({ text: t }).catch(function () {});
    copyText(t, "نُسخت الآية، الصقها حيث تريد");
  }
  function shareImage(url, name) {
    try { if (window.AppBridge && AppBridge.shareImage) return AppBridge.shareImage(url.split(",")[1], name); } catch (e) {}
    var link = document.createElement("a"); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  }
  // Draws the ayah on a mushaf-like card (Amiri Quran, the reading background colour) and returns a PNG data URL.
  function ayahImage(s, a, done) {
    var font = '"Amiri Quran"', go = function () {
      var W = 1080, P = 90, fs = 58, lh = fs * 2.05, c = document.createElement("canvas"), x = c.getContext("2d");
      var words = (Q.t[s - 1][a - 1] + " \uFD3F" + ar(a) + "\uFD3E").split(" "), lines = [], cur = "";
      x.font = fs + "px " + font;
      words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (x.measureText(t).width > W - 2 * P && cur) { lines.push(cur); cur = w; } else cur = t; });
      if (cur) lines.push(cur);
      var H = Math.round(P * 2 + 110 + lines.length * lh + 30);
      c.width = W; c.height = H;
      var bg = pageBg, dark = luminance(bg) < 0.18, ink = dark ? "#ece6d8" : "#1d1a14", gold = dark ? "#d8b25a" : "#9a7420";
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      x.strokeStyle = gold; x.lineWidth = 4; x.strokeRect(28, 28, W - 56, H - 56); x.lineWidth = 1.5; x.strokeRect(40, 40, W - 80, H - 80);
      x.direction = "rtl"; x.textAlign = "center"; x.fillStyle = gold;
      x.font = "600 34px Cairo, sans-serif"; x.fillText("سورة " + Q.s[s - 1][0], W / 2, P + 40);
      x.fillStyle = ink; x.font = fs + "px " + font;
      lines.forEach(function (l, i) { x.fillText(l, W / 2, P + 130 + i * lh + fs * 0.4); });
      x.fillStyle = gold; x.font = "400 26px Cairo, sans-serif";
      x.fillText("سورة " + Q.s[s - 1][0] + " · الآية " + ar(a) + " · تطبيق القرآن الكريم", W / 2, H - P + 20);
      done(c.toDataURL("image/png"));
    };
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("58px " + font, Q.t[s - 1][a - 1]), document.fonts.load("600 34px Cairo")]).then(go, go); else go();
  }

  function askText(title, value, done) {
    var d = el('<div class="dlg-back"><form class="dlg"><b>' + title + '</b><input class="input" maxlength="60"><div class="dlg-btns">' +
      '<button type="submit" class="dlg-ok">حفظ</button><button type="button" class="dlg-no">إلغاء</button></div></form></div>').firstChild;
    document.body.appendChild(d);
    var inp = d.querySelector("input"); inp.value = value; inp.focus(); inp.select();
    d.querySelector(".dlg-no").onclick = function () { d.remove(); };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    d.querySelector("form").onsubmit = function (e) { e.preventDefault(); var v = inp.value.trim(); d.remove(); if (v) done(v); };
  }
  function plan() {
    var k = load(edKey("khatma"), null); if (!k) return null;
    var total = k.to - k.from + 1, per = total / k.days, day = Math.max(0, dayNum(new Date()) - parseDay(k.start));
    var dueEnd = day >= k.days ? k.to : Math.min(k.to, k.from + Math.round((day + 1) * per) - 1);
    var dueStart = day >= k.days ? k.from : k.from + Math.round(day * per);
    var read = Math.max(0, k.done - k.from + 1);
    return { k: k, total: total, day: day, per: per, dueStart: dueStart, dueEnd: dueEnd, read: read,
      finished: k.done >= k.to, behind: Math.max(0, dueStart - 1 - k.done), left: Math.max(0, dueEnd - k.done) };
  }
  // A page turned past (in order) is read; the page the reader stays on (the wird's last page, before closing the app)
  // counts once it has been open for 20 s.
  var wirdT = 0;
  function trackPage(n) {
    statPage(n);
    clearTimeout(wirdT);
    var k = load(edKey("khatma"), null);
    if (!k) return;
    if (n - 1 >= k.from && n - 1 > k.done && n - 1 <= k.done + 2) { k.done = Math.min(k.to, n - 1); save(edKey("khatma"), k); rewardCheck(); }
    if (n >= k.from && n === k.done + 1 && n <= k.to) wirdT = setTimeout(function () {
      var k2 = load(edKey("khatma"), null), m = /^#\/p\/(\d+)/.exec(location.hash);
      if (!k2 || k2.done !== n - 1 || !m || Math.abs(+m[1] - n) > 1 || document.hidden) return;
      k2.done = n; save(edKey("khatma"), k2); rewardCheck();
    }, 20000);
  }
  // A short burst of stars and a message, for a reached goal or a finished wird.
  function cheer(msg) {
    var d = document.createElement("div"); d.className = "cele";
    var html = ""; for (var i = 0; i < 24; i++) html += '<i style="--x:' + (Math.random() * 2 - 1).toFixed(2) + ";--y:" + (Math.random() * -1 - .3).toFixed(2) + ";--d:" + (Math.random() * .3).toFixed(2) + 's;--c:' + ["#e0b44a", "#0f6b4f", "#23a079", "#f0d488"][i % 4] + '">✦</i>';
    d.innerHTML = html + "<b>" + msg + "</b>"; document.body.appendChild(d);
    try { if (window.AppBridge && AppBridge.buzzPattern) AppBridge.buzzPattern("60,80,60"); } catch (e) {}
    setTimeout(function () { d.remove(); }, 2600);
  }

  // ---------- إحصائيات القراءة ----------
  // What was read each day, as ayahs (q.stats = {"Y-M-D": [s*1000+a, ...]}, the last 120 days kept): opening a page again
  // adds nothing, and switching editions does not count the same ayahs twice. Days saved before 4.6 hold page numbers.
  // Shown as pages of the King Fahd mushaf: words read / 128 (77,430 words on 604 pages).
  var ayWords = null;
  function ayW(id) {
    if (!ayWords) { ayWords = {}; for (var s = 0; s < 114; s++) for (var x = 0; x < Q.t[s].length; x++) ayWords[(s + 1) * 1000 + x + 1] = Q.t[s][x].split(/\s+/).filter(function (w) { return /[\u0621-\u064A\u0671]/.test(w); }).length; }
    return ayWords[id] || 0;
  }
  function dayPages(arr) {
    if (!arr) return 0;
    var w = 0, old = 0; arr.forEach(function (v) { if (v > 1000) w += ayW(v); else old++; });
    return old + (w ? Math.max(1, Math.round(w / 128)) : 0);
  }
  function statPage(n) {
    var st = load("stats", {}), d = todayStr(), a = st[d] || (st[d] = []), before = dayPages(a), add = [];
    for (var s = 0; s < 114; s++) for (var x = 0; x < Q.p[s].length; x++) if (Q.p[s][x] === n) { var id = (s + 1) * 1000 + x + 1; if (a.indexOf(id) < 0) add.push(id); }
    if (!add.length) return;
    a.push.apply(a, add);
    var now = dayPages(a), g = load("goal", { pages: 0 });
    if (g.pages && before < g.pages && now >= g.pages) setTimeout(function () { cheer("حققت هدف النهارده: " + ar(g.pages) + " صفحة"); }, 400);
    var wl = load("statsWL", {}), x2 = wl[d] || (wl[d] = [0, 0]);
    add.forEach(function (id) { var t = Q.t[Math.floor(id / 1000) - 1][id % 1000 - 1]; x2[0] += ayW(id); x2[1] += (t.match(/[\u0621-\u064A\u0671]/g) || []).length; });
    Object.keys(wl).forEach(function (k) { if (!st[k] && k !== d) delete wl[k]; }); save("statsWL", wl);
    var keys = Object.keys(st); if (keys.length > 120) keys.sort(function (x, y) { return parseDay(x) - parseDay(y); }).slice(0, keys.length - 120).forEach(function (k) { delete st[k]; });
    save("stats", st);
  }
  function wlSum(from, days) { var wl = load("statsWL", {}), r = [0, 0]; for (var i = 0; i < days; i++) { var t = new Date((from - i) * 864e5), k = t.getUTCFullYear() + "-" + (t.getUTCMonth() + 1) + "-" + t.getUTCDate(); if (wl[k]) { r[0] += wl[k][0]; r[1] += wl[k][1]; } } return r; }
  function statsHtml() {
    var st = load("stats", {}), today = dayNum(new Date()), cnt = function (dn) { var t = new Date(dn * 864e5), k = t.getUTCFullYear() + "-" + (t.getUTCMonth() + 1) + "-" + t.getUTCDate(); return dayPages(st[k]); };
    var week = 0, bars = "", max = 1, days = [], i;
    for (i = 6; i >= 0; i--) { var c = cnt(today - i); days.push(c); week += c; max = Math.max(max, c); }
    var run = 0, best = 0, cur = 0;
    for (i = 0; i < 120; i++) { if (cnt(today - i) > 0) run++; else if (i > 0) break; }
    for (i = 119; i >= 0; i--) { if (cnt(today - i) > 0) { cur++; best = Math.max(best, cur); } else cur = 0; }
    var month = 0; for (i = 0; i < 30; i++) month += cnt(today - i);
    var names = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
    days.forEach(function (c, j) {
      var wd = new Date((today - 6 + j) * 864e5).getUTCDay();
      bars += '<div class="st-bar"><i style="height:' + Math.round(c / max * 100) + '%"></i><b>' + (c ? ar(c) : "") + "</b><small>" + (j === 6 ? "اليوم" : names[wd]) + "</small></div>";
    });
    return '<section class="kh-sec"><h3>' + ic("chart") + "إحصائيات القراءة</h3>" +
      '<div class="st-nums"><div><b>' + ar(cnt(today)) + "</b><small>صفحة اليوم</small></div><div><b>" + ar(week) + "</b><small>آخر ٧ أيام</small></div><div><b>" + ar(month) +
      "</b><small>آخر ٣٠ يوم</small></div><div><b>" + ar(run) + "</b><small>يوم متتالي</small></div><div><b>" + ar(best) + "</b><small>أطول مدة</small></div></div>" +
      '<div class="st-wl"><span>' + ic("book") + "اليوم: <b>" + ar(wlSum(today, 1)[0]) + "</b> كلمة و<b>" + ar(wlSum(today, 1)[1]) + "</b> حرف</span><span>آخر ٣٠ يوم: <b>" + ar(wlSum(today, 30)[0]) + "</b> كلمة و<b>" + ar(wlSum(today, 30)[1]) + "</b> حرف</span></div>" +
      '<div class="st-bars">' + bars + '</div><p class="hint">بتتحسب الصفحات اللي فتحتها في المصحف (كل صفحة مرة واحدة في اليوم).</p></section>';
  }

  // ---------- الإحصائيات (5.11 G5): القراءة والحفظ والتعرّف على التلاوة وتسجيلات الصوت في شاشة واحدة ----------
  function dayKey(dn) { var t = new Date(dn * 864e5); return t.getUTCFullYear() + "-" + (t.getUTCMonth() + 1) + "-" + t.getUTCDate(); }
  // the khatma screen keeps a one-line card that opens the stats
  function statsLink() {
    // 5.13 P2.10: a link only; the numbers live in More › Stats
    return '<a class="kh-sec st-link" href="#/stats">' + ic("chart") + "<span><b>الإحصائيات</b></span><i>←</i></a>";
  }
  // a % ring with its label under it (the label carries the meaning, never the colour alone)
  function stRing(p, label) {
    return '<div class="st-ring"><div class="hl-ring" style="--p:' + (p == null ? 0 : p) + '"><b>' + (p == null ? "—" : ar(p) + "٪") + "</b></div><small>" + label + "</small></div>";
  }
  function hifzStatsHtml() {
    var pc = hifzPageColors(), tot = Q.last - Q.first + 1, pct = Math.round(pc.cnt[3] * 1000 / tot + pc.cnt[2] * 1000 / tot) / 10, HA = load("hifzAyat", {}), rv = 0, n = 0;
    Object.keys(HA).forEach(function (k) { if (HA[k]) { n++; if (HA[k].ok === 0) rv++; } });
    var log = load("reciteLog", []), w = 0, b = 0; log.forEach(function (x) { w += x.w; b += x.bad; });
    return '<section class="kh-sec st-hifz"><h3>' + ic("eyeoff") + "الحفظ</h3>" +
      '<div class="st-hz">' + stRing(pct, "صفحات محفوظة") + '<div class="st-nums n2"><div><b>' + ar(n) + "</b><small>آية اتسمعت</small></div><div><b>" + ar(rv) + "</b><small>آية للمراجعة</small></div><div><b>" + ar(log.length) +
      "</b><small>اختبار بالصوت</small></div><div><b>" + (w ? ar(Math.round((w - b) / w * 100)) + "٪" : "—") + "</b><small>دقة التسميع</small></div></div></div>" +
      (log.length ? reciteHistory().replace(/^<div class="rc-hist"><b>[^<]*<\/b><p class="hint">[^<]*<\/p>/, '<div class="rc-hist st-hist"><b>آخر الاختبارات</b>') : "") +
      '<div class="st-go"><a href="#/hifztest">اختبار الحفظ</a><a href="#/hifzmap">خريطة الحفظ</a></div></section>';
  }
  function asrStatsHtml() {
    var S = load("asrStats", {}), t = {}, today = dayNum(new Date()), days = [], max = 1, i;
    Object.keys(S).forEach(function (d) { if (today - parseDay(d) < 7) for (var k in S[d]) t[k] = (t[k] || 0) + S[d][k]; });
    var h = '<section class="kh-sec st-asr"><h3>' + ic("mic") + "التعرّف على التلاوة</h3>";
    if (!t.u) return h + '<p class="hint">لسه مفيش قراءة بالمايك في آخر ٧ أيام. الأرقام دي بتتحسب على الموبايل بس.</p></section>';
    var pc = function (a, c) { return a + c ? Math.round(a * 100 / (a + c)) : null; };
    for (i = 6; i >= 0; i--) { var e = S[dayKey(today - i)] || {}; days.push(e.w || 0); max = Math.max(max, e.w || 0); }
    var names = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"], bars = "";
    days.forEach(function (c, j) {
      var wd = new Date((today - 6 + j) * 864e5).getUTCDay(), nm = j === 6 ? "اليوم" : names[wd];
      bars += '<div class="st-bar" title="' + ar(c) + '"><i style="height:' + Math.round(c / max * 100) + '%"></i><b>' + (c ? ar(c) : "") + "</b><small>" + nm + "</small></div>";
    });
    var lat = t.dn ? '<div><b>' + ar(Math.round(t.dms / t.dn)) + "</b><small>ملي ثانية لكل فك" + (t.dlen ? " (" + ar(Math.round(t.dlen / t.dn / 100) / 10) + " ث صوت)" : "") + "</small></div>" : "";
    return h + '<div class="st-nums ' + (lat ? "n3" : "n2") + '"><div><b>' + ar(t.u) + "</b><small>مقطع اتسمع</small></div><div><b>" + ar(t.w || 0) + "</b><small>كلمة اتسمعت</small></div>" + lat + "</div>" +
      '<div class="st-rings">' + stRing(pc(t.ok || 0, t.bad || 0), "التسميع صح") + stRing(pc(t.rh || 0, t.rm || 0), "المتابعة في الصفحة") + stRing(pc(t.loc || 0, t.lost || 0), "الفهرس والبحث لقوا الآية") + "</div>" +
      '<p class="st-cap">الكلمات اللي اتسمعت كل يوم</p><div class="st-bars">' + bars + "</div>" +
      '<p class="hint">آخر ٧ أيام، على الموبايل بس. لو النسبة واطية جرب مكان أهدى أو «اختبار المايك» في الإعدادات.</p></section>';
  }
  function donateStatsHtml() {
    if (!(window.NvBridge && NvBridge.donateStats)) return "";
    var st = {}; try { st = JSON.parse(NvBridge.donateStats()); } catch (e) {}
    var rej = 0; for (var k in st.rejected || {}) rej += st.rejected[k];
    return '<section class="kh-sec st-don"><h3>' + ic("wave") + "تسجيلات الصوت</h3>" +
      '<div class="st-nums n3"><div><b>' + (load("donate", 0) ? "شغالة" : "مقفولة") + "</b><small>المساعدة في التحسين</small></div><div><b>" + ar(st.waiting || 0) + "</b><small>مستني يترفع</small></div><div><b>" + ar(rej) +
      '</b><small>ما اتحفظش</small></div></div><div class="st-go"><button id="stPriv">الخصوصية وتسجيلات الصوت</button></div></section>';
  }
  function showStats() {
    titleEl.textContent = "الإحصائيات";
    btnBack.hidden = false;
    view.innerHTML = '<div class="stats">' + statsHtml() + rewardsHtml() + hifzStatsHtml() + asrStatsHtml() + donateStatsHtml() + "</div>";
    var pb = document.getElementById("stPriv");
    if (pb) pb.onclick = function () {
      // The sheet opens already scrolled to the privacy box: it slides up there, with no jump after it shows (5.13 P2.4).
      var g = document.getElementById("privGroup"), sb = sheet.querySelector(".sheet-body");
      if (g) g.open = true;
      document.getElementById("btnSettings").click();
      var at = function () { if (!g || !sb) return; var jb = sb.querySelector(".set-jump"); sb.scrollTop = g.getBoundingClientRect().top - sb.getBoundingClientRect().top + sb.scrollTop - (jb ? jb.offsetHeight : 0) - 8; };
      at(); requestAnimationFrame(at);
    };
  }

  // ---------- المكافآت ----------
  // Badges for keeping to the khatma plan's daily portion (days in a row), and for completed khatmas. Kept for all editions
  // together in q.rewards = {days: {"Y-M-D": 1}, khatmas: n, got: [badge ids]}.
  var BADGES = [
    ["d1", "أول ورد", "أتممت ورد اليوم لأول مرة"], ["s3", "ثلاثة أيام", "التزمت بالورد ٣ أيام متتالية"],
    ["s7", "أسبوع كامل", "التزمت بالورد ٧ أيام متتالية"], ["s14", "أسبوعان", "التزمت بالورد ١٤ يومًا متتالية"],
    ["s30", "شهر من الالتزام", "التزمت بالورد ٣٠ يومًا متتالية"], ["k1", "أول ختمة", "أتممت ختمة كاملة"],
    ["k3", "ثلاث ختمات", "أتممت ٣ ختمات"], ["k5", "خمس ختمات", "أتممت ٥ ختمات"], ["k10", "عشر ختمات", "أتممت ١٠ ختمات"]];
  function rewards() { var r = load("rewards", null) || {}; r.days = r.days || {}; r.khatmas = r.khatmas || 0; r.got = r.got || []; return r; }
  // Days in a row the portion was read, up to today (or yesterday, while today's is still to read).
  function streak(r) {
    var d = dayNum(new Date()), n = 0, has = function (x) { var t = new Date(x * 864e5); return r.days[t.getUTCFullYear() + "-" + (t.getUTCMonth() + 1) + "-" + t.getUTCDate()]; };
    if (!has(d)) d--;
    while (has(d)) { n++; d--; }
    return n;
  }
  function rewardCheck() {
    var P = plan(); if (!P) return;
    var r = rewards();
    if (!P.left) r.days[todayStr()] = 1;
    if (P.finished && !P.k.counted) { r.khatmas++; var k = load(edKey("khatma")); k.counted = true; save(edKey("khatma"), k); }
    var st = streak(r), total = Object.keys(r.days).length, fresh = [];
    BADGES.forEach(function (b) {
      var c = b[0][0], v = +b[0].slice(1);
      var ok = c === "d" ? total >= v : c === "s" ? st >= v : r.khatmas >= v;
      if (ok && r.got.indexOf(b[0]) < 0) { r.got.push(b[0]); fresh.push(b); }
    });
    save("rewards", r);
    if (fresh.length) celebrate(fresh[fresh.length - 1]);
  }
  function celebrate(b) {
    var d = el('<div class="reward-pop"><span class="rw-ic">' + ic("medal") + "</span><small>مكافأة جديدة</small><b>" + b[1] + "</b><span>" + b[2] + "</span></div>").firstChild;
    document.body.appendChild(d); tick();
    setTimeout(function () { d.classList.add("out"); setTimeout(function () { d.remove(); }, 400); }, 2600);
  }
  function rewardsHtml() {
    var r = rewards(), st = streak(r);
    return '<section class="kh-sec"><h3>' + ic("medal") + "المكافآت</h3>" +
      '<div class="rw-stats"><div><b>' + ar(st) + "</b><small>أيام متتالية</small></div><div><b>" + ar(Object.keys(r.days).length) +
      "</b><small>أيام التزام</small></div><div><b>" + ar(r.khatmas) + "</b><small>ختمات</small></div></div>" +
      '<div class="rw-grid">' + BADGES.map(function (b) {
        var got = r.got.indexOf(b[0]) >= 0;
        return '<div class="rw' + (got ? " got" : "") + '"><span class="rw-ic">' + ic("medal") + "</span><b>" + b[1] + "</b><small>" + b[2] + "</small></div>";
      }).join("") + "</div></section>";
  }
  function pageLabel(p) { return "صفحة " + ar(p) + " (سورة " + Q.s[surahOfPage(p) - 1][0] + ")"; }
  // 5.15 S7: «النهارده» on home: the khatma ward and the review ward in one place, the test one tap away.
  // Shown once there is a memorised surah (the khatma card above stays for readers who do not memorise).
  function todayCard() {
    if (!Object.keys(hzRevData()).length) return "";
    var P = plan(), W = hzWard(), kh = !P || P.finished ? "" : P.left ? "ورد الختمة: " + ar(P.left) + " صفحة" : "ورد الختمة خلص ✓";
    var rv = W.list.length ? "مراجعة: " + ar(W.list.length) + " سورة (" + ar(W.pages) + " صفحة)" : "مفيش مراجعة مستحقة ✓";
    // 5.16 U5: the reading goal is the card's ring (tap: set the goal); the lines: reading, khatma ward, review ward
    var g = goalCfg(), n = todayPages(), pct = g.pages ? Math.min(100, Math.round(n / g.pages * 100)) : 0, ok = g.pages && n >= g.pages;
    var ring = '<button class="td-goal g-ring' + (ok ? " done" : "") + '" id="tGoal" style="--p:' + pct + '" aria-label="هدف القراءة اليومي"><b>' + (!g.pages ? ic("target") : ok ? "✓" : ar(pct) + "٪") + "</b></button>";
    var rd = g.pages ? "القراءة: " + ar(Math.min(n, g.pages)) + " من " + ar(g.pages) + " صفحة" : "حدد هدف يومي";
    return '<div class="kcard td-card" id="tdCard" role="button" tabindex="0">' + ring + '<span class="kc-txt"><b>النهارده</b><small>' +
      [rd, kh, rv].filter(Boolean).map(function (x) { return "<span>" + x + "</span>"; }).join(" · ") + "</small></span>" + (W.list.length ? '<button class="td-go" id="tdGo">اختبرني</button>' : ic("left")) + "</div>";
  }
  function khatmaCard() {
    var P = plan(), m = marks().length, sub;
    if (!P) sub = "ابدأ خطة ختمة" + (m ? " · " + ar(m) + " علامة" : " واحفظ علاماتك");
    else if (P.finished) sub = "تمت الختمة، ما شاء الله";
    else if (!P.left) sub = "أنهيت ورد اليوم ✓ · " + ar(Math.round(P.read / P.total * 100)) + "٪ من الختمة";
    else sub = "ورد اليوم: " + ar(P.left) + " صفحة، من صفحة " + ar(P.k.done + 1) + " إلى " + ar(P.dueEnd);
    return '<button class="kcard" id="kCard"><span class="tile-ic kh">' + ic("target") + '</span><span class="kc-txt"><b>الختمة والعلامات</b><small>' + sub + "</small>" +
      (P ? '<i class="kbar"><i style="width:' + Math.round(P.read / P.total * 100) + '%"></i></i>' : "") + "</span>" + ic("left") + "</button>";
  }
  function openForReading(p) {
    if (mode === "pages") openPage(p); else { var f = firstAyahOfPage(p) || [surahOfPage(p), 1]; go(f[0], f[1]); }
  }
  function showKhatma() {
    titleEl.textContent = "الختمة";
    btnBack.hidden = false;
    var P = plan(), html = '<section class="kh-sec"><h3>' + ic("target") + "خطة الختمة</h3>";
    if (!P) {
      var lp = load(edKey("lastPage"), null);
      html += '<p class="hint">اختر في كم يوم تريد أن تختم القرآن، ويحسب لك التطبيق ورد كل يوم ويتابع تقدمك وأنت تقلب الصفحات.</p>' +
        '<div class="chips" id="kDays">' + [7, 10, 15, 20, 30, 40, 60].map(function (d) { return '<button data-d="' + d + '"' + (d === 30 ? ' class="on"' : "") + ">" + ar(d) + " يومًا</button>"; }).join("") + "</div>" +
        '<label class="kh-own">أو عدد آخر من الأيام: <input id="kOwn" class="input" type="number" inputmode="numeric" min="1" max="365"></label>' +
        '<div class="chips" id="kFrom"><button data-f="first" class="on">من أول المصحف</button>' +
        (lp && lp > Q.first && lp <= Q.last ? '<button data-f="last">من آخر صفحة قرأتها (' + ar(lp) + ")</button>" : "") + "</div>" +
        '<button class="kh-main" id="kStart">ابدأ الختمة</button>';
    } else if (P.finished) {
      html += '<div class="kh-card done"><b>تمت الختمة، تقبّل الله منك</b><span>بدأتها في ' + ar(P.k.days) + " يومًا وقرأت " + ar(P.total) + ' صفحة.</span></div>' +
        '<button class="kh-main" id="kNew">ابدأ ختمة جديدة</button>';
    } else {
      var pct = Math.round(P.read / P.total * 100), dayN = Math.min(P.day + 1, P.k.days);
      var status = P.left === 0 ? "أنهيت ورد اليوم" + (P.k.done > P.dueEnd ? "، وأنت متقدم " + ar(P.k.done - P.dueEnd) + " صفحة" : "") + "."
        : P.behind ? "عليك " + ar(P.behind) + " صفحة متأخرة من الأيام السابقة، وهي داخلة في ورد اليوم." : "ورد اليوم حوالي " + ar(Math.round(P.per * 10) / 10) + " صفحة.";
      if (P.day >= P.k.days && P.left) status = "انتهت مدة الخطة، والباقي " + ar(P.left) + " صفحة.";
      if (parseDay(P.k.start) > dayNum(new Date())) status = "الخطة تبدأ يوم " + new Date(parseDay(P.k.start) * 864e5).toLocaleDateString("ar-EG", { day: "numeric", month: "long", timeZone: "UTC" }) + " (أول رمضان). تقدر تبدأ القراءة من دلوقتي.";
      html += '<div class="kh-card"><div class="kh-top"><span>اليوم ' + ar(dayN) + " من " + ar(P.k.days) + "</span><span>" + ar(pct) + "٪</span></div>" +
        '<i class="kbar"><i style="width:' + pct + '%"></i></i>' +
        '<div class="kh-wird">' + (P.left ? "<small>ورد اليوم</small><b>من " + pageLabel(P.k.done + 1) + "</b><b>إلى " + pageLabel(P.dueEnd) + "</b>" : "<b>أنهيت ورد اليوم ✓</b>") + "</div>" +
        '<p class="kh-status">' + status + " قرأت " + ar(P.read) + " من " + ar(P.total) + ' صفحة.</p></div>' +
        '<button class="kh-main" id="kRead">' + ic("book") + (P.left ? "اقرأ ورد اليوم" : "تابع القراءة") + "</button>" +
        '<div class="kh-btns">' + (P.left ? '<button id="kDone">' + ic("check") + "قرأت ورد اليوم</button>" : "") +
        '<button id="kAt">' + ic("edit") + "تعديل موضعي</button>" + '<button id="kStop" class="danger">' + ic("trash") + "إلغاء الخطة</button></div>";
    }
    html += ramadanHtml() + "</section>" + statsLink() +
      '<section class="kh-sec"><h3>' + ic("check") + 'المراجعة</h3><button class="kh-main" id="kHifz">' + ic("book") + hifzSummary() + "</button></section>" +
      '<section class="kh-sec"><h3>' + ic("mark") + "العلامات</h3>";
    var M = marks();
    if (!M.length) html += '<p class="hint">لا توجد علامات بعد. اضغط على أي آية في المصحف واختر «علامة»، أو زر العلامة تحت الصفحة.</p>';
    else html += '<ul class="marks">' + M.map(function (m, i) {
      return '<li data-i="' + i + '"><button class="mk-go"><b>' + esc(m.n) + "</b><small>سورة " + Q.s[m.s - 1][0] + " · الآية " + ar(m.a) + " · صفحة " + ar(pageOf(m.s, m.a)) + "</small></button>" +
        '<button class="mk-ed" aria-label="إعادة التسمية">' + ic("edit") + '</button><button class="mk-del" aria-label="حذف">' + ic("trash") + "</button></li>";
    }).join("") + "</ul>";
    view.innerHTML = html + "</section>";
    window.scrollTo(0, 0);
    function chips(id) { var c = document.getElementById(id); if (c) c.onclick = function (e) { var b = e.target.closest("button"); if (!b) return; c.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); }; }
    chips("kDays"); chips("kFrom");
    var q = function (id) { return document.getElementById(id); };
    if (q("kOwn")) q("kOwn").oninput = function () { q("kDays").querySelectorAll("button").forEach(function (x) { x.classList.remove("on"); }); };
    if (q("kStart")) q("kStart").onclick = function () {
      var own = parseInt(en(q("kOwn").value || ""), 10), on = q("kDays").querySelector(".on");
      var days = own >= 1 && own <= 365 ? own : on ? +on.dataset.d : 30;
      var fromLast = q("kFrom").querySelector(".on").dataset.f === "last", from = fromLast ? load(edKey("lastPage"), Q.first) : Q.first;
      save(edKey("khatma"), { start: todayStr(), days: days, from: from, to: Q.last, done: from - 1 });
      showKhatma();
    };
    if (q("kHifz")) q("kHifz").onclick = function () { location.hash = "#/hifzlog"; };
    if (q("kRamadan")) q("kRamadan").onclick = function () {
      var r = ramadanInfo();
      save(edKey("khatma"), { start: r.startStr, days: r.days, from: Q.first, to: Q.last, done: Q.first - 1, ramadan: true });
      toast(r.now ? "بدأت ختمة رمضان، ورد كل يوم حوالي " + ar(Math.round((Q.last - Q.first + 1) / r.days)) + " صفحة" : "الخطة هتبدأ أول رمضان");
      syncAlarms(); showKhatma();
    };
    if (q("kNew")) q("kNew").onclick = function () { save(edKey("khatma"), null); showKhatma(); };
    if (q("kRead")) q("kRead").onclick = function () { openForReading(Math.min(P.k.done + 1, P.k.to)); };
    if (q("kDone")) q("kDone").onclick = function () { var k = load(edKey("khatma")); k.done = Math.max(k.done, P.dueEnd); save(edKey("khatma"), k); rewardCheck(); showKhatma(); };
    if (q("kAt")) q("kAt").onclick = function () {
      askText("آخر صفحة قرأتها في الختمة", ar(P.k.done), function (v) {
        var n = parseInt(en(v), 10); if (!(n >= P.k.from - 1 && n <= P.k.to)) return toast("رقم صفحة غير صحيح");
        var k = load(edKey("khatma")); k.done = n; save(edKey("khatma"), k); rewardCheck(); showKhatma();
      });
    };
    if (q("kStop")) q("kStop").onclick = function () {
      if (this.dataset.sure) { save(edKey("khatma"), null); showKhatma(); } else { this.dataset.sure = 1; this.lastChild.textContent = "اضغط مرة أخرى للتأكيد"; }
    };
    var list = view.querySelector(".marks");
    if (list) list.onclick = function (e) {
      var li = e.target.closest("li"); if (!li) return; var i = +li.dataset.i, M = marks(), m = M[i];
      if (e.target.closest(".mk-go")) { if (mode === "pages") openAyahPage(m.s, m.a); else go(m.s, m.a); }
      else if (e.target.closest(".mk-ed")) askText("اسم العلامة", m.n, function (v) { M[i].n = v; save("marks", M); showKhatma(); });
      else if (e.target.closest(".mk-del")) { if (!confirm("تحذف العلامة؟")) return; M.splice(i, 1); save("marks", M); showKhatma(); toast("حُذفت العلامة"); }
    };
  }

  // ---------- أذكار الصباح والمساء ----------
  // Counts are kept per day, so each morning and evening starts fresh.
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  var zOrder = load("azkarOrder", "book");
  // Reading a zikr aloud: the app's own TTS bridge (Android TextToSpeech, Arabic voice), or the browser's speech synthesis.
  var zikrSpeech = (function () {
    var card = null, id = 0, after = null;
    function mark(c) {
      if (card) { card.classList.remove("speaking"); var b = card.querySelector(".z-play"); if (b) b.innerHTML = ic("aplay"); }
      card = c;
      if (c) { c.classList.add("speaking"); c.querySelector(".z-play").innerHTML = ic("astop"); }
    }
    window.onSpeech = function (sid, state) {
      if (+sid !== id) return;
      if (state === "done" || state === "error" || state === "nolang") { mark(null); var f = after; after = null; if (state === "done" && f) f(); }
      if (state === "nolang") toast("لا يوجد صوت عربي على الهاتف. ثبّت «الصوت العربي» من إعدادات تحويل النص إلى كلام");
      else if (state === "error") toast("تعذّر تشغيل الصوت");
    };
    function stop() {
      id++; mark(null); after = null;
      if (window.SpeechBridge) SpeechBridge.stop(); else if (window.speechSynthesis) speechSynthesis.cancel();
    }
    function toggle(c, text, onDone) {
      if (card === c) return stop();
      stop(); mark(c); after = onDone || null;
      text = text.replace(/\s+/g, " ").trim();
      var r = Math.max(0.5, Math.min(2, load("rate", 1)));
      if (window.SpeechBridge) return SpeechBridge.speak(text, r, String(id));
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { mark(null); return toast("تعذّر تشغيل الصوت"); }
      var u = new SpeechSynthesisUtterance(text), my = id; u.lang = "ar"; u.rate = r;
      u.onend = function () { window.onSpeech(my, "done"); }; u.onerror = function () { window.onSpeech(my, "error"); };
      speechSynthesis.speak(u);
    }
    return { toggle: toggle, stop: stop };
  })();
  function showAzkar(kind) {
    if (kind !== "m" && kind !== "e") { var h = new Date().getHours(); kind = h >= 15 || h < 3 ? "e" : "m"; }
    titleEl.textContent = kind === "m" ? "أذكار الصباح" : "أذكار المساء";
    btnBack.hidden = false;
    var key = "azkar." + kind, saved = load(key, null);
    var items = window.AZKAR.filter(function (z) { return !z.only || z.only === kind; });
    // The zikrs said 10 or 100 times can be given another number; saved by their place in AZKAR, for both morning and evening.
    var custom = load("azkarN", {});
    function N(z) { return custom[window.AZKAR.indexOf(z)] || z.n; }
    var left = saved && saved.d === today() && saved.c.length === items.length ? saved.c : items.map(N);
    function text(z) {
      if (z.q) {
        var out = z.pre ? '<div class="z-pre">' + z.pre + "</div>" : "";
        if (z.basmala) out += '<div class="z-pre">' + BASMALA + "</div>";
        for (var a = z.q[1]; a <= z.q[2]; a++) out += Q.t[z.q[0] - 1][a - 1] + ' <span class="ayah-no">﴿' + ar(a) + "﴾</span> ";
        return '<div class="z-text z-quran">' + out + "</div>";
      }
      return '<div class="z-text">' + (z.t || z[kind]) + "</div>";
    }
    var html = '<div class="tabs"><button data-k="m"' + (kind === "m" ? ' class="on"' : "") + '>الصباح</button><button data-k="e"' +
      (kind === "e" ? ' class="on"' : "") + ">المساء</button></div>" +
      // Order: as in the book, or by how many times each zikr is said.
      '<div class="z-sort"><span>الترتيب</span>' + [["book", "كما في الكتاب"], ["asc", "الأقل تكرارًا"], ["desc", "الأكثر تكرارًا"]].map(function (o) {
        return '<button data-o="' + o[0] + '"' + (o[0] === zOrder ? ' class="on"' : "") + ">" + o[1] + "</button>"; }).join("") + "</div>" +
      (items.some(function (z) { return z.q; }) ? '<button class="z-all" id="zAll">' + ic("aplay") + "استمع للآيات</button>" : "") +
      '<p class="hint z-progress"></p>';
    var order = items.map(function (z, i) { return i; });
    if (zOrder !== "book") order.sort(function (x, y) { return (zOrder === "asc" ? 1 : -1) * (N(items[x]) - N(items[y])) || x - y; });
    order.forEach(function (i) {
      var z = items[i];
      var ref = z.q ? "سورة " + Q.s[z.q[0] - 1][0] + (z.q[1] === z.q[2] ? " · الآية " + ar(z.q[1]) : "") : "";
      html += '<div class="zikr" data-i="' + i + '">' + text(z) +
        (z.note ? '<div class="z-note">' + z.note + "</div>" : "") + (z.fadl ? '<div class="z-fadl">' + z.fadl + "</div>" : "") +
        '<div class="z-foot"><span class="z-src">' + (ref || "رواه " + z.src) + "</span>" +
        (z.n >= 10 ? '<button class="z-nbtn" aria-label="تخصيص العدد">' + ic("edit") + "</button>" : "") +
        // Only the adhkar that are Quran ayahs are read aloud (by the chosen reciter); the others have no audio.
        (z.q ? '<button class="z-play" aria-label="استماع">' + ic("aplay") + "</button>" : "") + '<button class="z-count" aria-label="عدّ">' +
        '<b></b><small>من ' + ar(N(z)) + "</small></button></div></div>";
    });
    html += '<button class="continue z-reset" id="zReset">ابدأ العدّ من جديد</button>' +
      '<p class="about">المصدر: «حصن المسلم» لسعيد بن وهف القحطاني. الآيات من نص المصحف نفسه المستخدم في التطبيق.</p>';
    view.innerHTML = html;
    window.scrollTo(0, 0);
    var cards = [], prog = view.querySelector(".z-progress");
    view.querySelectorAll(".zikr").forEach(function (c) { cards[+c.dataset.i] = c; });
    view.querySelectorAll(".z-sort button").forEach(function (b) {
      b.onclick = function () { zOrder = b.dataset.o; save("azkarOrder", zOrder); var y = window.scrollY; route(); window.scrollTo(0, y); };
    });
    function paint(i) {
      cards[i].classList.toggle("done", left[i] === 0);
      cards[i].querySelector(".z-count b").textContent = left[i] === 0 ? "✓" : ar(left[i]);
    }
    function progress() {
      var done = left.filter(function (c) { return c === 0; }).length;
      prog.textContent = done === left.length ? "أتممت الأذكار، تقبّل الله منك." : "أتممت " + ar(done) + " من " + ar(left.length) + " · اضغط على الذكر لتعدّه";
      save(key, { d: today(), c: left });
    }
    for (var i = 0; i < cards.length; i++) paint(i);
    progress();
    view.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () { history.replaceState(null, "", "#/azkar/" + b.dataset.k); route(); };
    });
    // On each card, not on #view: a listener on #view would outlive this screen and count again on the next visit.
    cards.forEach(function (c) { c.addEventListener("click", function (e) {
      // The verses of a Quranic zikr are recited by the chosen reciter (the same recordings as the mushaf).
      // The others are read by the phone's Arabic voice.
      if (e.target.closest(".z-play")) {
        if (allOn) allSet(false);
        var z = items[+c.dataset.i];
        if (z.q) { zikrSpeech.stop(); return player.playRange(z.q[0], z.q[1], z.q[2]); }
        player.stop(); return zikrSpeech.toggle(c, (c.querySelector(".z-text") || c).textContent);
      }
      if (e.target.closest(".z-nbtn")) return nPick(c);
      if (e.target.closest(".z-nset")) return;
      if (window.getSelection().toString()) return;
      var i = +c.dataset.i; if (left[i] === 0) return;
      left[i]--; paint(i); progress();
      if (navigator.vibrate) navigator.vibrate(left[i] === 0 ? 60 : 15);
      // When a zikr is finished, bring the next unfinished one into view.
      if (left[i] === 0) for (var k = order.indexOf(i) + 1; k < order.length; k++) if (left[order[k]] > 0) { cards[order[k]].scrollIntoView({ behavior: "smooth", block: "center" }); break; }
    }); });
    // Choose how many times a 10/100 zikr is said: preset chips or any number, and «الأصلي» returns to the book's number.
    function nPick(c) {
      var open = c.querySelector(".z-nset");
      if (open) return open.remove();
      var i = +c.dataset.i, z = items[i], g = window.AZKAR.indexOf(z), cur = N(z);
      var opts = [1, 3, 7, 10, 33, 50, 100, 200, 300, 500, 1000].filter(function (v) { return v !== z.n; });
      var box = document.createElement("div");
      box.className = "z-nset";
      box.innerHTML = '<span>عدد مرات الذكر</span><div class="z-nopts"><button data-v="' + z.n + '"' + (cur === z.n ? ' class="on"' : "") + "><span>الأصلي</span> " + ar(z.n) + "</button>" +
        opts.map(function (v) { return '<button data-v="' + v + '"' + (v === cur ? ' class="on"' : "") + ">" + ar(v) + "</button>"; }).join("") + "</div>" +
        '<div class="z-nown"><input class="input" type="number" inputmode="numeric" min="1" max="10000" placeholder="عدد آخر"><button class="continue">حفظ</button></div>';
      c.querySelector(".z-foot").before(box);
      function set(v) {
        v = Math.max(1, Math.min(10000, Math.round(v) || 0)); if (!v) return;
        if (v === z.n) delete custom[g]; else custom[g] = v;
        save("azkarN", custom);
        left[i] = v; c.querySelector(".z-count small").textContent = "من " + ar(v);
        box.remove(); paint(i); progress();
      }
      box.querySelectorAll(".z-nopts button").forEach(function (b) { b.onclick = function () { set(+b.dataset.v); }; });
      var inp = box.querySelector("input");
      box.querySelector(".z-nown button").onclick = function () { set(+inp.value); };
      inp.onkeydown = function (e) { if (e.key === "Enter") set(+inp.value); };
    }
    // Listen to all: every zikr in the order shown, each repeated its number of times, then the next one by itself.
    var allBtn = document.getElementById("zAll") || document.createElement("button"), allOn = false;
    function allSet(on) {
      allOn = on; allBtn.classList.toggle("on", on);
      allBtn.innerHTML = ic(on ? "astop" : "aplay") + (on ? "إيقاف الاستماع" : "استمع للآيات");
      if (!on) { view.querySelectorAll(".zikr.speaking").forEach(function (x) { x.classList.remove("speaking"); }); }
    }
    function playAt(pos) {
      view.querySelectorAll(".zikr.speaking").forEach(function (x) { x.classList.remove("speaking"); });
      if (!allOn || !document.body.contains(allBtn)) return;
      if (pos >= order.length) return allSet(false);
      // Each zikr as many times as it is still to be said (or its full number if already done), counting down as it goes.
      var i = order[pos], z = items[i], c = cards[i], reps = left[i] > 0 ? left[i] : N(z), nx = function () { playAt(pos + 1); };
      function said(k) { if (left[i] > 0) { left[i] = Math.max(0, left[i] - k); paint(i); progress(); } }
      c.scrollIntoView({ behavior: "smooth", block: "center" });
      if (z.q) { zikrSpeech.stop(); c.classList.add("speaking"); player.playRange(z.q[0], z.q[1], z.q[2], reps, nx, function () { said(1); }); return; }
      nx();   // no audio for adhkar that are not ayahs
    }
    allBtn.onclick = function () {
      if (allOn) { allSet(false); zikrSpeech.stop(); player.stop(); return; }
      allSet(true); playAt(0);
    };
    document.getElementById("zReset").onclick = function () {
      left = items.map(N);
      for (var k = 0; k < cards.length; k++) paint(k);
      progress(); window.scrollTo(0, 0);
    };
  }

  // ---------- رمضان ----------
  // Days until / left in Ramadan by the Umm al-Qura calendar: {now, startStr, days, start (Date)}.
  function ramadanInfo() {
    var d = new Date(), h = hijri(d), i;
    if (!h) return null;
    if (h.month === 9) {
      var left = 0; for (i = 0; i < 31; i++) { var x = hijri(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i)); if (x.month !== 9) break; left++; }
      return { now: true, startStr: todayStr(), days: left, start: d, dayOf: h.day };
    }
    for (i = 1; i < 390; i++) {
      var t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i), y = hijri(t);
      if (y.month === 9 && y.day === 1) {
        var n = 0; for (var j = 0; j < 31; j++) { if (hijri(new Date(t.getFullYear(), t.getMonth(), t.getDate() + j)).month !== 9) break; n++; }
        return { now: false, startStr: t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate(), days: n, start: t, inDays: i };
      }
    }
    return null;
  }
  function ramadanHtml() {
    var r = ramadanInfo(), k = load(edKey("khatma"), null);
    if (!r || (k && k.ramadan)) return "";
    return '<div class="rm-card">' + ic("moon") + "<div><b>" + (r.now ? "ختمة رمضان: باقي " + ar(r.days) + " يوم" : "ختمة رمضان") + "</b><small>" +
      (r.now ? "ورد كل يوم حوالي " + ar(Math.round((Q.last - Q.first + 1) / r.days)) + " صفحة لحد آخر رمضان." : "رمضان بعد " + ar(r.inDays) + " يوم (" + r.start.toLocaleDateString("ar-EG", { day: "numeric", month: "long" }) + ")، الخطة " + ar(r.days) + " يوم تبدأ أوله.") +
      '</small></div><button id="kRamadan">' + (k ? "استبدل الخطة" : "ابدأ") + "</button></div>";
  }

  // ---------- المراجعة (5.13 P2.6, was متابعة الحفظ) ----------
  // q.hifzLog = {surah: {m: "Y-M-D" memorised, r: "Y-M-D" last revised}}. The one revised longest ago comes up for revision.
  function hifzLogData() { return load("hifzLog", {}); }
  // 5.15c item 3: «السور المراجعة» q.hzRev {surah: {m, r, iv, score}}, apart from the memorised list q.hifzLog. The first
  // time (no q.hzRev yet) it starts as a copy of q.hifzLog, so the review dates kept until 5.15b carry over.
  function hzRevData() {
    var R = load("hzRev", null);
    if (!R) { R = hifzLogData(); save("hzRev", R); }
    return R;
  }
  window.hzRevData = hzRevData;   // QA
  function hifzSummary() { return "المراجعة واختبار الحفظ"; }   // 5.13 P2.10: no numbers outside More › Stats
  // 5.15 S1: spaced review. Each memorised surah keeps its own interval q.hifzLog[s].iv (days): 7 at first; after a test
  // >= 90% doubles it (at most 90), 70-89% keeps it, < 70% sets 1 day. The surah is due when its last review is iv days old.
  // Old entries with no iv: 7, or 1 if the last score was under 70 (the old «< 70%» rule).
  function hzDueInfo(e, sc) {
    var age = dayNum(new Date()) - parseDay(e.r || e.m), iv = e.iv || (sc != null && sc < 70 ? 1 : 7);
    return { age: age, iv: iv, due: age >= iv, over: age - iv };
  }
  function hzScoreOf(sc, s) { return sc[s] && sc[s].score != null ? sc[s].score : null; }
  // a test of the surah ended with score p: next interval, review date today (a second test the same day does not double it)
  function hzReviewed(e, p) {
    var iv = e.iv || 7;
    if (p < 70) iv = 1; else if (p >= 90 && e.r !== todayStr()) iv = Math.min(90, iv * 2);
    e.iv = iv; e.r = todayStr(); e.score = p;
  }
  window.hzDueInfo = hzDueInfo; window.hzReviewed = hzReviewed;   // QA
  // the due surahs, most overdue first; d = days from today (for the alarms of the coming days)
  function hzDueList(d) {
    var L = hzRevData(), sc = load("hifzScores", {}), out = [];
    Object.keys(L).forEach(function (s) { var x = hzDueInfo(L[s], hzScoreOf(sc, s)); x.age += d || 0; x.over += d || 0; if (x.over >= 0) out.push({ s: +s, age: x.age, over: x.over, iv: x.iv, sc: hzScoreOf(sc, s) }); });
    return out.sort(function (a, b) { return b.over - a.over || a.s - b.s; });
  }
  // 5.15 S1: the daily review ward q.hzDaily = pages a day (0 = all that is due): the most overdue surahs until the pages are reached
  function hzWard(d) {
    var all = hzDueList(d), n = +load("hzDaily", 0) || 0, out = [], pg = 0, seen = {};   // a page shared by two surahs counts once
    for (var i = 0; i < all.length && (!n || pg < n); i++) { out.push(all[i]); var p = Q.p[all[i].s - 1]; for (var x = p[0]; x <= p[p.length - 1]; x++) if (!seen[x]) { seen[x] = 1; pg++; } }
    return { list: out, pages: pg, all: all.length, per: n };
  }
  window.hzWard = hzWard;   // QA
  function hifzDue(d) { var w = hzWard(d); return w.list.length ? { s: w.list[0].s, n: w.list.length } : null; }
  // 5.11 G6: the hifz test, the map and the log, one tap from each other (the test is the main tool)
  function hzNav(cur) {
    return '<nav class="z-sort hz-nav">' + [["#/hifztest", "اختبار الحفظ"], ["#/hifzmap", "خريطة الحفظ"], ["#/hifzlog", "المراجعة"]].map(function (x) {
      return '<a href="' + x[0] + '"' + (x[0] === cur ? ' class="on" aria-current="page"' : "") + ">" + x[1] + "</a>"; }).join("") + "</nav>";
  }
  // ---------- 5.13 P2.6: «المراجعة» ----------
  // A surah is memorised when the app heard 80% of its ayat right in tests (q.hifzAyat, ok = 1), never by a tap:
  // hifzAuto puts it in q.hifzLog (review dates) at 80% and takes it out below. Old marks of surahs with no tested ayah stay.
  function hifzPct(s, HA) {
    var n = Q.s[s - 1][3], ok = 0, any = 0;
    for (var a = 1; a <= n; a++) { var h = HA[s + ":" + a]; if (h) { any++; if (h.ok) ok++; } }
    return { p: Math.floor(ok * 100 / n), any: any };
  }
  // 5.15b item 8 / 5.15c item 3: a whole-surah test p from «اختبار الحفظ» marks the surah memorised at 80% and takes
  // the mark off below (q.hifzLog, «السور المحفوظة»)
  function hzSetMemo(s, p) {
    var D = hifzLogData();
    if (p >= 80) D[s] = { m: (D[s] && D[s].m) || todayStr(), d: todayStr(), score: p };
    else if (D[s]) delete D[s];
    else return D;
    save("hifzLog", D); return D;
  }
  // a test from «المراجعة» with p on surah s: at 80% the surah is on «السور المراجعة» (q.hzRev), below it is taken off;
  // a surah on the list gets its next review date (hzReviewed)
  function hzSetRev(s, p) {
    var R = hzRevData();
    if (p >= 80 && !R[s]) R[s] = { m: todayStr(), r: todayStr(), iv: 7 };
    else if (p < 80 && R[s]) delete R[s];
    if (R[s]) hzReviewed(R[s], p);
    save("hzRev", R); return R;
  }
  window.hzSetMemo = hzSetMemo; window.hzSetRev = hzSetRev;   // QA
  function hifzAuto(ss) {
    var HA = load("hifzAyat", {}), D = hifzLogData(), ch = false, seen = {};
    ss.forEach(function (s) {
      if (seen[s]) return; seen[s] = 1;
      var r = hifzPct(s, HA); if (!r.any) return;
      if (r.p >= 80 && !D[s]) { D[s] = { m: todayStr(), r: todayStr(), iv: 7 }; ch = true; }
      else if (r.p < 80 && D[s]) { delete D[s]; ch = true; }
    });
    if (ch) { save("hifzLog", D); syncAlarms(); }
  }
  // test ranges: ayat by their place in the whole Quran (0..6235); quarters and halves from the 240 rub' al-hizb (QURAN.h)
  var AY0 = null;
  function ayStart() { if (!AY0) { AY0 = [0]; for (var i = 0; i < 114; i++) AY0.push(AY0[i] + Q.s[i][3]); } return AY0; }
  function gIdx(s, a) { return ayStart()[s - 1] + a - 1; }
  function gAy(i) { var A = ayStart(), s = 1; while (s < 114 && A[s] <= i) s++; return [s, i - A[s - 1] + 1]; }
  function rubIdx(k) { return k >= 240 ? 6236 : gIdx(Q.h[k][0], Q.h[k][1]); }
  function hzRange(c) {
    var j = (c.n - 1) * 8;
    if (c.k === "s") return [gIdx(c.s, 1), gIdx(c.s, Q.s[c.s - 1][3])];
    if (c.k === "a") { var n = Q.s[c.s - 1][3], a1 = Math.min(n, c.a1), a2 = Math.min(n, Math.max(a1, c.a2)); return [gIdx(c.s, a1), gIdx(c.s, a2)]; }
    if (c.k === "j") return [rubIdx(j), rubIdx(j + 8) - 1];
    if (c.k === "jq") return [rubIdx(j + (c.q - 1) * 2), rubIdx(j + c.q * 2) - 1];
    if (c.k === "jh") return [rubIdx(j + (c.q - 1) * 4), rubIdx(j + c.q * 4) - 1];
    if (c.k === "mq") return [rubIdx((c.q - 1) * 60), rubIdx(c.q * 60) - 1];
    if (c.k === "mh") return [rubIdx((c.q - 1) * 120), rubIdx(c.q * 120) - 1];
    return [0, 6235];
  }
  function ayName(i) { var x = gAy(i); return Q.s[x[0] - 1][0] + " " + ar(x[1]); }
  // the places to test, in Quran order: in order, the whole range as one; at random, the app picks how many places (more
  // for a bigger range: up to one per 30 ayat, at most 10, at least half of that) and each place is 3–12 ayat, no overlap
  // 5.15 S2: the ayat of the range last heard wrong (q.hifzAyat ok = 0), by their place in the Quran
  function hzWrong(R) {
    var HA = load("hifzAyat", {}), W = [];
    Object.keys(HA).forEach(function (k) { if (HA[k] && HA[k].ok === 0) { var p = k.split(":"), i = gIdx(+p[0], +p[1]); if (i >= R[0] && i <= R[1]) W.push(i); } });
    return W.sort(function (a, b) { return a - b; });
  }
  window.hzWrong = hzWrong;   // QA
  function hzParts(c) {
    var R = hzRange(c), len = R[1] - R[0] + 1;
    if (c.w === "x") {
      // «أخطائي بس»: a place around each group of wrong ayat (wrong ayat 3 or fewer apart join one place), one ayah
      // before and after, at least 3 ayat; at most 10 places (picked at random when there are more)
      var W = hzWrong(R), G = [];
      W.forEach(function (i) { var g = G[G.length - 1]; if (g && i - g[1] <= 3) g[1] = i; else G.push([i, i]); });
      G = G.map(function (g) { var st = Math.max(R[0], g[0] - 1), en = Math.min(R[1], g[1] + 1);
        while (en - st < 2 && (st > R[0] || en < R[1])) { if (en < R[1]) en++; else st--; } return [st, en]; });
      while (G.length > 10) G.splice(Math.floor(Math.random() * G.length), 1);
      return G;
    }
    if (c.w !== "r") return [[R[0], R[1]]];
    if (len <= 3) return [[R[0], R[1]]];
    // at random, a place lands on a wrong ayah 2 times in 3 (while there are wrong ayat not yet in a place)
    var mx = Math.max(1, Math.min(10, Math.ceil(len / 30))), mn = Math.ceil(mx / 2), want = mn + Math.floor(Math.random() * (mx - mn + 1)), P = [], W2 = hzWrong(R);
    for (var t = 0; t < 300 && P.length < want; t++) {
      var n = Math.min(len, 3 + Math.floor(Math.random() * 10)), st, en, free = W2.filter(function (i) { return P.every(function (x) { return i < x[0] || i > x[1]; }); });
      if (free.length && Math.random() < 2 / 3) { var wi = free[Math.floor(Math.random() * free.length)]; st = Math.max(R[0], Math.min(R[1] - n + 1, wi - Math.floor(Math.random() * n))); }
      else st = R[0] + Math.floor(Math.random() * (len - n + 1));
      en = st + n - 1;
      if (P.every(function (x) { return en < x[0] - 1 || st > x[1] + 1; })) P.push([st, en]);
    }
    return P.sort(function (x, y) { return x[0] - y[0]; });
  }
  window.hzParts = hzParts; window.hzTestStart = function (c, how, P) { hzTestStart(c, how, P); };   // QA
  function hzTestStart(c, how, P0) {
    var P = P0 || hzParts(c);
    if (!P.length) return toast("مفيش آيات غلط في المدى ده. جرّب «عشوائي» أو مدى تاني.");
    hzFrom = location.hash === "#/hifzlog";
    var b = gAy(P[0][0]), e = gAy(P[0][1]), pc = P.slice(1), tot = P.length;
    if (how === "m") { hifzTestPages(b[0], b[1]); hifz.test.rv = 1; hifz.test.end = e[0] + ":" + e[1]; hifz.test.pc = pc; hifz.test.pn = 1; hifz.test.pt = tot; if (tot > 1) toast(hzPlace(1, tot)); return; }
    var st = load("hifzTest", { lv: 25 });
    save("hifzTest", { lv: st.lv || 25, s: b[0], from: b[1], n: c.w === "r" || c.w === "x" || P0 ? P[0][1] - P[0][0] + 1 : 10, end: P[0][1], acc: { h: 0, m: 0 }, pc: pc, pn: 1, pt: tot });
    if (location.hash === "#/hifztest/" + b[0]) route(); else location.hash = "#/hifztest/" + b[0];
  }
  // the daily review ward as one mushaf test: each due surah a place, in Quran order (5.15 S1 / S7)
  function hzWardTest() {
    var w = hzWard().list.map(function (x) { return x.s; }).sort(function (a, b) { return a - b; });
    if (!w.length) return toast("مفيش مراجعة مستحقة النهارده");
    var way = load("hzWardWay", "o");
    hzTestStart({ k: "s", s: w[0], w: way }, "m", hzWardPlan(w, way));
  }
  // 5.16 U2: «بالسرد» = each due surah whole; «عشوائي» = random parts (3–12 ayat) inside each due surah, in Quran order
  function hzWardPlan(w, way) {
    var P = [];
    if (way === "r") w.forEach(function (s) { P = P.concat(hzParts({ k: "s", s: s, w: "r" })); });
    else P = w.map(function (s) { return [gIdx(s, 1), gIdx(s, Q.s[s - 1][3])]; });
    return P;
  }
  window.hzWardTest = hzWardTest; window.hzWardPlan = hzWardPlan;   // QA
  function hzPlace(i, n) { return "الموضع " + ar(i) + " من " + ar(n); }
  // the mushaf test reached the end of a place: the next place opens (its page), the score goes on adding up
  // 5.15b item 3: the phone buzzes when a random test moves to its next place
  function hzPlaceBuzz() {
    window.__hzBuzz = (window.__hzBuzz || 0) + 1;
    try { if (window.AppBridge && AppBridge.buzzPattern) AppBridge.buzzPattern("0,70,90,70"); else if (navigator.vibrate) navigator.vibrate([70, 90, 70]); } catch (e) {}
  }
  function hifzNextPlace() {
    hzPlaceBuzz();
    var T = hifz.test, P = T.pc.shift(), b = gAy(P[0]), e = gAy(P[1]);
    T.s = b[0]; T.a = b[1]; T.end = e[0] + ":" + e[1]; T.fin = 0; T.pn++;
    toast(hzPlace(T.pn, T.pt));
    var h = mode === "pages" ? "#/p/" + pageOf(b[0], b[1]) : "#/s/" + b[0] + "/" + b[1];
    if (location.hash === h) route(); else location.hash = h;
  }
  window.hzRange = hzRange;   // QA
  var hzFoldOpen = false, hzMemoOpen = false, htBadOpen = false, hzFrom = false;
  window.addEventListener("hashchange", function () { if (hzFrom && !/^#\/(p|s|hifztest)\//.test(location.hash) && location.hash !== "#/hifzlog") hzFrom = false; });
  window.hzFromState = function () { return hzFrom; }; window.hzFromSet = function (v) { hzFrom = v; };   // QA
  var HZ_K = [["s", "سورة"], ["j", "جزء"], ["a", "آيات من سورة"], ["jq", "ربع جزء"], ["jh", "نصف جزء"], ["mq", "ربع المصحف"], ["mh", "نصف المصحف"], ["all", "القرآن كله"]];
  function showHifzLog() {
    titleEl.textContent = "المراجعة";
    btnBack.hidden = false;
    var L = hzRevData(), HA = load("hifzAyat", {}), sc = load("hifzScores", {}), today = dayNum(new Date());
    var c = load("hzScope", { k: "s", s: 1, n: 1, q: 1, a1: 1, a2: 7, w: "o" });
    var sel = function (id, label, items, v) {
      return '<select class="input" id="' + id + '" aria-label="' + label + '">' + items.map(function (x) { return '<option value="' + x[0] + '"' + (String(x[0]) === String(v) ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select>";
    };
    var surahs = [], juz = [], ays = [];
    for (var i = 1; i <= 114; i++) surahs.push([i, ar(i) + ". " + Q.s[i - 1][0] + (L[i] ? " ✓" : "")]);
    for (var j = 1; j <= 30; j++) juz.push([j, "الجزء " + ar(j)]);
    if (c.k === "a") for (var a = 1; a <= Q.s[c.s - 1][3]; a++) ays.push([a, ar(a)]);
    var parts = c.k === "jq" || c.k === "mq" ? [[1, "الربع الأول"], [2, "الربع الثاني"], [3, "الربع الثالث"], [4, "الربع الرابع"]] : [[1, "النصف الأول"], [2, "النصف الثاني"]];
    if (c.q > parts.length) c.q = 1;
    var R = hzRange(c), nW = hzWrong(R).length;
    var LT = load("lastTest", null);
    var html = hzNav("#/hifzlog") + (LT ? '<div class="tc-last"><div><b>آخر اختبار: ' + ltRange(LT) + " · " + ar(LT.sc) + "٪</b><small>" + ltDay(LT.d) +
      (LT.miss && LT.miss.length ? " · " + ar(LT.miss.length) + " آية نسيتها" : "") + '</small></div><button class="continue" id="tcSend">' + ic("share") + " ابعت للمحفّظ</button></div>" : "") +
      '<section class="hz-card" id="hzCard"><h3>' + ic("eyeoff") + "اختبرني</h3>" +
      '<div class="hz-row">' + sel("hzK", "المدى", HZ_K, c.k) +
      (c.k === "s" || c.k === "a" ? sel("hzS", "السورة", surahs, c.s) : "") +
      (c.k === "j" || c.k === "jq" || c.k === "jh" ? sel("hzN", "الجزء", juz, c.n) : "") +
      (c.k === "jq" || c.k === "jh" || c.k === "mq" || c.k === "mh" ? sel("hzQ", "الجزء من المدى", parts, c.q) : "") + "</div>" +
      (c.k === "a" ? '<div class="hz-row hz-ays"><span>من الآية</span>' + sel("hzA1", "من الآية", ays, c.a1) + "<span>إلى</span>" + sel("hzA2", "إلى الآية", ays, Math.max(c.a1, c.a2)) + "</div>" : "") +
      '<p class="hint hz-rng"><span>من</span> <b>' + ayName(R[0]) + "</b> <span>إلى</span> <b>" + ayName(R[1]) + "</b> · <span>" + ar(R[1] - R[0] + 1) + " آية</span></p>" +
      '<div class="z-sort hz-way"><button data-w="o"' + (c.w !== "r" && c.w !== "x" ? ' class="on"' : "") + '>بالسرد</button><button data-w="r"' + (c.w === "r" ? ' class="on"' : "") + ">عشوائي (٣–١٢ آية)</button>" +
      '<button data-w="x"' + (c.w === "x" ? ' class="on"' : "") + ">أخطائي بس (" + ar(nW) + ")</button></div>" +
      (c.w === "x" ? '<p class="hint">' + (nW ? "الاختبار بيبقى على الآيات اللي غلطت فيها قبل كده، مع آية قبلها وآية بعدها." : "مفيش آيات غلط في المدى ده لسه.") + "</p>" : "") +
      '<div class="hz-go"><button class="continue" id="hzGoM">' + ic("book") + ' على المصحف</button><button class="continue" id="hzGoW">' + ic("eyeoff") + " بالكلمات</button></div></section>";
    // «عليك مراجعة» (5.15 S1): the daily ward of due surahs (spaced review, the map's yellow rule), most overdue first
    var W = hzWard(), due = W.list, per = W.per;
    html += '<section class="hz-due" id="hzDue"><h3 class="hz-h">' + ic("rep") + "عليك مراجعة</h3>" +
      '<div class="hz-row hz-daily"><span>ورد المراجعة اليومي</span>' + sel("hzDaily", "ورد المراجعة اليومي", [[0, "كل المستحق"], [1, "صفحة واحدة"], [2, "صفحتين"], [3, "٣ صفحات"], [5, "٥ صفحات"], [10, "١٠ صفحات"], [20, "٢٠ صفحة"]], per) + "</div>" +
      (due.length ? '<p class="hint hz-wsum">ورد النهارده: ' + ar(due.length) + " سورة · " + ar(W.pages) + " صفحة" + (W.all > due.length ? " · وفيه " + ar(W.all - due.length) + " سورة تانية مستنية" : "") + "</p>" +
        '<div class="z-sort hz-wway">' + [["o", "بالسرد"], ["r", "عشوائي"]].map(function (x) { return '<button data-ww="' + x[0] + '"' + (load("hzWardWay", "o") === x[0] ? ' class="on"' : "") + ">" + x[1] + "</button>"; }).join("") + "</div>" +
        '<button class="continue hz-wgo" id="hzWardGo">' + ic("book") + " اختبرني في ورد النهارده</button>" + due.map(function (x) {
      return '<div class="hl-due"><div><b>سورة ' + Q.s[x.s - 1][0] + "</b><small>آخر مراجعة من " + ar(x.age) + " يوم · كل " + ar(x.iv) + " يوم" + (x.sc != null && x.sc < 70 ? " · آخر نتيجة " + ar(x.sc) + "٪" : "") +
        '</small></div><button data-test="' + x.s + '">اختبرني</button></div>';
    }).join("") : '<p class="hint">مفيش مراجعة مستحقة النهارده. كل سورة ليها ميعاد: أول مرة بعد ٧ أيام. ولو جبت ٩٠٪ أو أكتر، المدة بتتضاعف لحد ٩٠ يوم. ولو جبت أقل من ٧٠٪، بترجعلك تاني يوم.</p>') + "</section>";
    html += '<section><details class="hl-fold" id="hlFold"' + (hzFoldOpen ? " open" : "") + '><summary class="continue hl-sbtn">' + ic("check") + ' السور المراجعة</summary><p class="hint">السورة بتدخل القايمة دي لما تجيب ٨٠٪ أو أكتر في اختبار عليها من هنا («المراجعة»)، بالسرد أو عشوائي. ولو جبت أقل من ٨٠٪ بتخرج منها.</p><ul class="hl-list">';
    for (var s = 1; s <= 114; s++) {
      var e = L[s], pc = hifzPct(s, HA);
      html += '<li data-s="' + s + '" class="' + (e ? "on" : "") + '"><span class="hl-n">' + ar(s) + "</span><b>" + Q.s[s - 1][0] + "</b>" +
        "<small>" + (pc.any ? ar(pc.p) + "٪" : ar(Q.s[s - 1][3]) + " آية") + (e ? " · آخر مراجعة من " + ar(today - parseDay(e.r || e.m)) + " يوم" : "") + '</small><i class="hl-chk">' + (e ? "✓" : "") + "</i></li>";
    }
    view.innerHTML = '<div class="hl">' + html + "</ul></details></section></div>";
    document.getElementById("hlFold").ontoggle = function () { hzFoldOpen = this.open; };
    var put = function (k, v, top) {
      c[k] = v; if (k === "s") { c.a1 = 1; c.a2 = Math.min(7, Q.s[v - 1][3]); }
      save("hzScope", c); var y = window.scrollY; showHifzLog(); window.scrollTo(0, top ? 0 : y);
    };
    [["hzK", "k"], ["hzS", "s"], ["hzN", "n"], ["hzQ", "q"], ["hzA1", "a1"], ["hzA2", "a2"]].forEach(function (x) {
      var e2 = document.getElementById(x[0]); if (e2) e2.onchange = function () { put(x[1], x[1] === "k" ? this.value : +this.value); };
    });
    view.querySelectorAll(".hz-way button").forEach(function (b) { b.onclick = function () { put("w", b.dataset.w); }; });
    document.getElementById("hzGoM").onclick = function () { hzTestStart(c, "m"); };
    document.getElementById("hzGoW").onclick = function () { hzTestStart(c, "w"); };
    document.getElementById("hzDaily").onchange = function () { save("hzDaily", +this.value); var y = window.scrollY; showHifzLog(); window.scrollTo(0, y); };
    var wg = document.getElementById("hzWardGo"); if (wg) wg.onclick = function () { hzWardTest(); };
    var tcs = document.getElementById("tcSend"); if (tcs) tcs.onclick = function () { teacherSend(); };
    // a due surah's «اختبرني»: the card above gets that surah (the list of memorised surahs is only to look at, 5.15b)
    // 5.16 U1: a due surah's «اختبرني» starts the mushaf test on that surah at once (the way of the ward above)
    view.querySelectorAll("[data-test]").forEach(function (b) { b.onclick = function () { var s1 = +b.dataset.test; hzTestStart({ k: "s", s: s1, w: load("hzWardWay", "o") }, "m"); }; });
    view.querySelectorAll(".hz-wway button").forEach(function (b) { b.onclick = function () { save("hzWardWay", b.dataset.ww); var y = window.scrollY; showHifzLog(); window.scrollTo(0, y); }; });
  }

  // ---------- نسخة احتياطية ----------
  // Everything the app keeps (bookmarks, khatma, notes, sebha, settings...) as one JSON file to share / save, and back.
  function exportBackup() {
    var data = { app: "quran-karim", v: 1, at: new Date().toISOString(), keys: {} };
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf("q.") === 0) data.keys[k] = localStorage.getItem(k); } } catch (e) {}
    var json = JSON.stringify(data), d = new Date(), name = "quran-backup-" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + ".json";
    save("lastBackup", todayStr()); paintBk(); syncAlarms();
    try { if (window.AppBridge && AppBridge.shareFile) return AppBridge.shareFile(json, name); } catch (e) {}
    var a = document.createElement("a"); var u = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 10000);
  }
  function importBackup(file) {
    var r = new FileReader();
    r.onload = function () {
      var data; try { data = JSON.parse(r.result); } catch (e) { data = null; }
      if (!data || data.app !== "quran-karim" || !data.keys) return toast("الملف ده مش نسخة احتياطية من التطبيق");
      var n = 0; Object.keys(data.keys).forEach(function (k) { if (k.indexOf("q.") === 0) { try { localStorage.setItem(k, data.keys[k]); n++; } catch (e) {} } });
      toast("رجعت " + ar(n) + " إعداد وبيان، التطبيق هيفتح من جديد");
      setTimeout(function () { location.hash = "#/"; location.reload(); }, 1200);
    };
    r.readAsText(file);
  }

  // S10 (5.18): «آخر نسخة من # يوم» in Settings, and a reminder 30 days after the last backup (q.bkRem, on by default;
  // the share sheet reaches Drive). No backup yet: the reminder counts from the first day the app was used.
  function bkDays() { var l = load("lastBackup", ""); return l ? dayNum(new Date()) - parseDay(l) : -1; }
  function paintBk() {
    var e = document.getElementById("bkAge"), c = document.getElementById("bkRem"), n = bkDays(); if (!e) return;
    e.textContent = n < 0 ? "لسه ما عملتش نسخة احتياطية" : n === 0 ? "آخر نسخة النهارده" : "آخر نسخة من " + ar(n) + " يوم";
    e.classList.toggle("bk-old", n < 0 || n >= 30); if (c) c.checked = load("bkRem", true);
  }
  function bkDue() {   // the day (dayNum) the backup reminder falls on, or -1 when it is off
    if (!load("bkRem", true)) return -1;
    var l = load("lastBackup", ""), first = load("firstDay", ""); if (!first) { first = todayStr(); save("firstDay", first); }
    return parseDay(l || first) + 30;
  }
  window.QA_bkDue = bkDue;
  document.getElementById("bkRem").onchange = function () { save("bkRem", this.checked); syncAlarms(); };
  paintBk();
  document.getElementById("bkOut").onclick = exportBackup;
  document.getElementById("bkIn").onclick = function () { document.getElementById("bkFile").click(); };
  document.getElementById("bkFile").onchange = function () { if (this.files[0]) importBackup(this.files[0]); this.value = ""; };

  // ---------- مواقيت الصلاة (computed on the phone from the location, no internet) ----------
  // Standard astronomical formulas: the sun's declination and equation of time for the day, then the hour angle
  // at which the sun reaches each prayer's depression angle (Fajr / Isha) or shadow length (Asr).
  var PR_METHODS = {
    egypt: { n: "الهيئة المصرية العامة للمساحة", f: 19.5, i: 17.5 },
    makkah: { n: "أم القرى (مكة المكرمة)", f: 18.5, i: "90" },
    mwl: { n: "رابطة العالم الإسلامي", f: 18, i: 17 },
    karachi: { n: "جامعة العلوم الإسلامية بكراتشي", f: 18, i: 18 },
    isna: { n: "أمريكا الشمالية (ISNA)", f: 15, i: 15 },
    dubai: { n: "الإمارات (دبي)", f: 18.2, i: 18.2 },
    kuwait: { n: "الكويت", f: 18, i: 17.5 },
    qatar: { n: "قطر", f: 18, i: "90" }
  };
  var PRAYERS = [["fajr", "الفجر"], ["sunrise", "الشروق"], ["dhuhr", "الظهر"], ["asr", "العصر"], ["maghrib", "المغرب"], ["isha", "العشاء"]];
  function prayerTimes(date, lat, lon, method, hanafi) {
    var r = Math.PI / 180, m = PR_METHODS[method] || PR_METHODS.egypt;
    var y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate();
    if (mo <= 2) { y--; mo += 12; }
    var A = Math.floor(y / 100), jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + 2 - A + Math.floor(A / 4) - 1524.5;
    var tz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset() / 60;
    function sun(t) {
      var D = jd - 2451545 + t / 24, g = (357.529 + 0.98560028 * D) * r, q = 280.459 + 0.98564736 * D;
      var L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r, e = (23.439 - 0.00000036 * D) * r;
      var RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / r / 15;
      return { dec: Math.asin(Math.sin(e) * Math.sin(L)), eqt: q / 15 - ((RA % 24) + 24) % 24 };
    }
    function fix(h) { return ((h % 24) + 24) % 24; }
    var noonUT = 12 - lon / 15, s0 = sun(noonUT), eq = s0.eqt;
    eq = ((eq + 12) % 24 + 24) % 24 - 12;
    var dhuhr = noonUT - eq + tz, la = lat * r;
    // Hours from noon until the sun is `angle` degrees below the horizon (negative angle = above).
    function T(angle, t) {
      var dec = sun(t).dec, c = (-Math.sin(angle * r) - Math.sin(dec) * Math.sin(la)) / (Math.cos(dec) * Math.cos(la));
      return c < -1 || c > 1 ? NaN : Math.acos(c) / r / 15;
    }
    function asrT() {
      var dec = s0.dec, a = Math.atan(1 / ((hanafi ? 2 : 1) + Math.tan(Math.abs(la - dec))));
      var c = (Math.sin(a) - Math.sin(dec) * Math.sin(la)) / (Math.cos(dec) * Math.cos(la));
      return Math.acos(Math.max(-1, Math.min(1, c))) / r / 15;
    }
    var out = {
      fajr: dhuhr - T(m.f, noonUT - 6), sunrise: dhuhr - T(0.833, noonUT - 6), dhuhr: dhuhr + 1 / 60,
      asr: dhuhr + asrT(), maghrib: dhuhr + T(0.833, noonUT + 6)
    };
    out.isha = typeof m.i === "string" ? out.maghrib + (+m.i) / 60 : dhuhr + T(m.i, noonUT + 6);
    // Far north in summer the sun may never get deep enough: use a seventh of the night instead.
    var night = 24 - (out.maghrib - out.sunrise);
    if (isNaN(out.fajr)) out.fajr = out.sunrise - night / 7;
    if (isNaN(out.isha)) out.isha = out.maghrib + night / 7;
    var res = {};
    PRAYERS.forEach(function (p) {
      var h = fix(out[p[0]]), mins = Math.round(h * 60);   // rounded to the minute, as printed calendars do
      res[p[0]] = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, mins);
    });
    return res;
  }
  function hm(dt) {
    var h = dt.getHours(), m = dt.getMinutes();
    return ar((h % 12 || 12) + ":" + (m < 10 ? "0" : "") + m) + (h < 12 ? " ص" : " م");
  }
  function prayerCfg() {
    var c = load("prayer", { method: "egypt", hanafi: false, adhan: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true } });
    c.voice = c.voice || {}; c.pre = c.pre || {};
    return c;
  }
  // Muezzin recordings shipped in android/res/raw/adhan_<id>.ogg; "alarm" = the phone's alarm tone, "silent" = notification only.
  var ADHAN_VOICES = [["makkah", "الحرم المكي (السعودية)"], ["malki", "حمدان المالكي (السعودية)"], ["zahrani", "منصور الزهراني (السعودية)"], ["qatami", "ناصر القطامي (السعودية)"],
    ["basit", "عبد الباسط عبد الصمد (مصر)"], ["menshawy", "محمد صديق المنشاوي (مصر)"], ["refaat", "محمد رفعت (مصر)"], ["afasy", "مشاري العفاسي (الكويت)"],
    ["chebae", "أذان الفجر، مالك شيبة (المغرب)"], ["alarm", "نغمة المنبّه في الموبايل"], ["silent", "إشعار بدون صوت"]];
  function nextPrayer(loc, cfg) {
    var now = new Date(), t = prayerTimes(now, loc[0], loc[1], cfg.method, cfg.hanafi);
    for (var i = 0; i < PRAYERS.length; i++) if (PRAYERS[i][0] !== "sunrise" && t[PRAYERS[i][0]] > now) return { k: PRAYERS[i][1], at: t[PRAYERS[i][0]] };
    var tm = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { k: "الفجر", at: prayerTimes(tm, loc[0], loc[1], cfg.method, cfg.hanafi).fajr };
  }
  function prayerTileText() {
    var loc = load("qiblaLoc", null);
    if (!loc) return "مواقيت الصلاة";
    var n = nextPrayer(loc, prayerCfg());
    return "مواقيت الصلاة<small class=\"tile-sub\">" + n.k + " " + hm(n.at) + "</small>";
  }
  function untilText(ms) {
    var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60);
    return "بعد " + (h ? ar(h) + " س " : "") + ar(m % 60) + " د";
  }

  // ---------- reminders, prayer notifications and the widget: the phone keeps the next 30 days ----------
  var REM_DEF = { wird: { on: false, t: "20:00" }, m: { on: false, t: "06:30" }, e: { on: false, t: "16:30" }, kahf: { on: false, t: "09:00" }, fast: { on: false, t: "21:00" }, hifz: { on: false, t: "07:30" }, stat: { on: false, t: "22:30" }, goal: { on: false, t: "21:00" } };
  function remCfg() { var r = load("reminders", {}); Object.keys(REM_DEF).forEach(function (k) { if (!r[k]) r[k] = JSON.parse(JSON.stringify(REM_DEF[k])); }); return r; }
  // Hijri date (Umm al-Qura calendar, built into the phone's WebView).
  function hijri(d) {
    try {
      var parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(d), o = {};
      parts.forEach(function (x) { if (x.type !== "literal") o[x.type] = parseInt(x.value, 10); });
      o.text = new Intl.DateTimeFormat(window.LANG === "en" ? "en-u-ca-islamic-umalqura" : "ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(d);
      return o;
    } catch (e) { return null; }
  }
  // Why a day is a sunnah fast: Monday / Thursday, the white days (13-15), Arafah, Ashura.
  function fastOf(d) {
    var h = hijri(d), w = d.getDay(), why = [];
    if (!h || h.month === 9) return "";
    if (h.month === 12 && h.day === 9) why.push("يوم عرفة");
    if (h.month === 1 && (h.day === 9 || h.day === 10)) why.push(h.day === 10 ? "يوم عاشوراء" : "تاسوعاء");
    if (h.day >= 13 && h.day <= 15 && !(h.month === 12 && h.day === 13)) why.push("الأيام البيض");
    if (w === 1) why.push("الاثنين"); if (w === 4) why.push("الخميس");
    return why.join(" و");
  }
  function syncAlarms() {
    if (!window.AppBridge || !AppBridge.setAlarms) return;
    var ev = [], rc = remCfg(), cfg = prayerCfg(), loc = load("qiblaLoc", null), k = load(edKey("khatma"), null), base = new Date();
    for (var d = 0; d < 30; d++) {
      var day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d);
      function at(t) { var p = t.split(":"); return new Date(day.getFullYear(), day.getMonth(), day.getDate(), +p[0], +p[1]).getTime(); }
      if (rc.m.on) ev.push({ at: at(rc.m.t), kind: "rem", title: "أذكار الصباح", text: "حان وقت أذكار الصباح، اضغط لتبدأ.", hash: "#/azkar/m" });
      if (rc.e.on) ev.push({ at: at(rc.e.t), kind: "rem", title: "أذكار المساء", text: "حان وقت أذكار المساء، اضغط لتبدأ.", hash: "#/azkar/e" });
      if (rc.kahf.on && day.getDay() === 5) ev.push({ at: at(rc.kahf.t), kind: "rem", title: "سورة الكهف", text: "من قرأ سورة الكهف يوم الجمعة أضاء له من النور ما بين الجمعتين. اضغط لتقرأها.", hash: "#/s/18/1" });
      if (rc.fast.on) { var tmr = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1), why = fastOf(tmr);
        if (why) ev.push({ at: at(rc.fast.t), kind: "rem", title: "صيام الغد", text: "غدًا يُستحب صيامه: " + why + ". لا تنسَ السحور.", hash: "#/prayer" }); }
      if (rc.hifz && rc.hifz.on) { var hd = hifzDue(d); if (hd) ev.push({ at: at(rc.hifz.t), kind: "rem", title: "مراجعة الحفظ", text: "راجع اليوم سورة " + Q.s[hd.s - 1][0] + (hd.n > 1 ? " و" + ar(hd.n - 1) + " سور تانية" : "") + ".", hash: "#/hifzlog" }); }
      if (rc.stat && rc.stat.on) {
        var isToday = d === 0, sp = isToday ? dayPages(load("stats", {})[todayStr()]) : 0, sw = isToday ? wlSum(dayNum(base), 1) : [0, 0];
        ev.push({ at: at(rc.stat.t), kind: "rem", title: "قراءتك النهارده", hash: "#/khatma",
          text: sp ? "قريت " + ar(sp) + " صفحة (" + ar(sw[0]) + " كلمة و" + ar(sw[1]) + " حرف). بكل حرف حسنة، والحسنة بعشر أمثالها." : "لسه مقريتش النهارده. صفحة واحدة قبل النوم؟" });
      }
      if (rc.goal && rc.goal.on && goalCfg().pages) {
        var gp = goalCfg().pages, gn = d === 0 ? todayPages() : 0;
        if (gn < gp) ev.push({ at: at(rc.goal.t), kind: "rem", title: "هدف القراءة", text: gn ? "فاضلك " + ar(gp - gn) + " صفحة وتحقق هدف النهارده." : "هدفك النهارده " + ar(gp) + " صفحة، يلا نبدأ؟", hash: "#/" });
      }
      if (rc.wird.on && k) ev.push({ at: at(rc.wird.t), kind: "rem", title: "ورد الختمة اليومي", text: "ورد اليوم في انتظارك، اضغط لتكمل من حيث توقفت.", hash: "#/khatma" });
      if (loc) {
        var t = prayerTimes(day, loc[0], loc[1], cfg.method, cfg.hanafi);
        PRAYERS.forEach(function (p) {
          if (p[0] === "sunrise") return;
          if (cfg.adhan[p[0]]) ev.push({ at: t[p[0]].getTime(), kind: "adhan", v: cfg.voice[p[0]] || "makkah", title: "صلاة " + p[1], text: "حان الآن موعد أذان " + p[1] + (loc[2] ? " حسب توقيت " + loc[2] : "") + ".", hash: "#/prayer" });
          var pm = cfg.pre[p[0]]; if (pm) ev.push({ at: t[p[0]].getTime() - pm * 60000, kind: "rem", title: "باقي " + ar(pm) + " دقيقة على " + p[1], text: "أذان " + p[1] + " الساعة " + hm(t[p[0]]) + "، استعد للصلاة.", hash: "#/prayer" });
        });
      }
    }
    // S10: one backup reminder, 20:00 on the day 30 days after the last backup (late: today, or tomorrow after 20:00)
    var bd = bkDue();
    if (bd >= 0) { bd = Math.max(bd, dayNum(base) + (base.getHours() >= 20 ? 1 : 0)); var bt = new Date(bd * 864e5);
      ev.push({ at: new Date(bt.getUTCFullYear(), bt.getUTCMonth(), bt.getUTCDate(), 20, 0).getTime(), kind: "rem", title: "نسخة احتياطية",
        text: "عدّى شهر من غير نسخة احتياطية. اضغط واحفظها على Drive عشان علاماتك وحفظك ما يضيعوش.", hash: "#/backup" }); }
    // «جرّب الأذان»: one adhan a minute from now, with the Fajr muezzin, to check the phone lets it through.
    if (testAlarmAt > Date.now()) ev.push({ at: testAlarmAt, kind: "adhan", v: cfg.voice.fajr || "makkah", title: "تجربة الأذان", text: "لو سامع ده، تنبيه الأذان شغال على موبايلك.", hash: "#/prayer" });
    try { AppBridge.setAlarms(JSON.stringify(ev.filter(function (e) { return e.at > Date.now(); }))); } catch (e) {}
  }
  var testAlarmAt = 0;
  // Ayah of the day: from a list of well-known ayat that read complete on their own, picked by the date.
  var DAY_AYAT = [[2, 152], [2, 186], [2, 286], [3, 8], [3, 26], [3, 139], [3, 173], [3, 200], [7, 23], [9, 51], [11, 88], [13, 28], [14, 7], [15, 49],
    [16, 97], [17, 80], [18, 10], [20, 25], [20, 114], [21, 87], [23, 118], [25, 74], [28, 24], [29, 69], [33, 41], [33, 56], [39, 53], [40, 44], [40, 60],
    [42, 19], [49, 13], [50, 16], [51, 56], [55, 13], [57, 4], [59, 10], [64, 11], [65, 2], [65, 3], [94, 5], [94, 6], [2, 201], [2, 153], [3, 191], [6, 162],
    [8, 46], [12, 87], [14, 40], [17, 24], [24, 35], [26, 80], [27, 19], [35, 15], [39, 10], [46, 15], [67, 2], [71, 10], [73, 20], [93, 5], [103, 3]];
  function ayahOfDay(d) { return DAY_AYAT[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5) % DAY_AYAT.length]; }
  function syncWidget() {
    if (!window.AppBridge || !AppBridge.setWidget) return;
    var lp = load(edKey("lastPage"), null), last = load("last", null), ayat = [], base = new Date(), cont, contHash;
    for (var d = 0; d < 30; d++) {
      var day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d), x = ayahOfDay(day);
      ayat.push({ d: day.getFullYear() + "-" + ("0" + (day.getMonth() + 1)).slice(-2) + "-" + ("0" + day.getDate()).slice(-2),
        t: Q.t[x[0] - 1][x[1] - 1] + " ﴿" + ar(x[1]) + "﴾", r: "سورة " + Q.s[x[0] - 1][0] + " · الآية " + ar(x[1]), h: "#/a/" + x[0] + "/" + x[1] });
    }
    if (mode === "pages" && lp) { cont = "كمّل القراءة · صفحة " + ar(lp); contHash = "#/p/" + lp; }
    else if (last) { cont = "كمّل القراءة · سورة " + Q.s[last[0] - 1][0]; contHash = "#/s/" + last[0] + "/" + last[1]; }
    else { cont = "ابدأ القراءة"; contHash = ""; }
    var loc = load("qiblaLoc", null), cfg = prayerCfg(), pr = [];
    if (loc) for (var pd = 0; pd < 3; pd++) { var dd = new Date(base.getFullYear(), base.getMonth(), base.getDate() + pd), tt = prayerTimes(dd, loc[0], loc[1], cfg.method, cfg.hanafi);
      PRAYERS.forEach(function (p) { if (p[0] !== "sunrise") pr.push({ at: tt[p[0]].getTime(), n: p[1], t: hm(tt[p[0]]) }); }); }
    try { AppBridge.setWidget(JSON.stringify({ ayat: ayat, cont: cont, contHash: contHash, prayers: pr, place: loc ? loc[2] || "" : "" })); } catch (e) {}
  }

  function showPrayer() {
    titleEl.textContent = "مواقيت الصلاة";
    btnBack.hidden = false;
    var loc = load("qiblaLoc", null), cfg = prayerCfg(), rc = remCfg(), opts = '<option value="">اختر مدينة…</option>';
    CITIES.forEach(function (c, i) { opts += '<option value="' + i + '">' + c[0] + "</option>"; });
    var html = '<div class="pr">', open = showPrayer.open || "";
    if (loc) {
      var now = new Date(), t = prayerTimes(now, loc[0], loc[1], cfg.method, cfg.hanafi), nx = nextPrayer(loc, cfg), hj = hijri(now);
      html += '<div class="pr-next"><small>الصلاة القادمة</small><b>' + nx.k + "</b><span>" + hm(nx.at) + " · " + untilText(nx.at - now) + "</span>" +
        '<em class="pr-where">' + ic("pin") + (loc[2] || ar(loc[0].toFixed(2)) + "، " + ar(loc[1].toFixed(2))) + " · " + now.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }) + (hj ? " · " + hj.text : "") + "</em></div>";
      if (hj && hj.month === 9) html += '<div class="rm-times"><div><small>الإمساك</small><b>' + hm(new Date(t.fajr - 10 * 60000)) + '</b></div><div><small>الإفطار</small><b>' + hm(t.maghrib) + "</b></div></div>";
      if (window.AppBridge && AppBridge.notificationsOn && !AppBridge.notificationsOn())
        html += '<button class="pr-warn" id="prNotif">الإشعارات مقفولة للتطبيق، فالأذان مش هيظهر. اضغط وافتحها.</button>';
      if (window.AppBridge && AppBridge.exactAlarms && !AppBridge.exactAlarms())
        html += '<button class="pr-warn" id="prExact">تنبيه الأذان ممكن يتأخر دقائق. اضغط لتسمح بالتنبيه في موعده بالظبط.</button>';
      html += '<div class="pr-list">' + PRAYERS.map(function (p) {
        var k = p[0], isNext = p[1] === nx.k && nx.at - t[k] === 0;
        if (k === "sunrise") return '<div class="pr-row sun"><span>' + p[1] + "</span><b>" + hm(t[k]) + "</b><i></i></div>";
        var on = cfg.adhan[k], v = cfg.voice[k] || "makkah", pm = cfg.pre[k] || 0, vn = (ADHAN_VOICES.filter(function (x) { return x[0] === v; })[0] || ADHAN_VOICES[0])[1].split(" (")[0].split("،")[0];
        return '<div class="pr-item' + (open === k ? " open" : "") + '" data-k="' + k + '"><div class="pr-row' + (isNext ? " next" : "") + '" data-open="' + k + '"><span>' + p[1] +
          '<small>' + (on ? vn : "الأذان مقفول") + (pm ? " · تذكير قبله " + ar(pm) + " د" : "") + "</small></span><b>" + hm(t[k]) + "</b>" +
          '<button class="pr-bell' + (on ? " on" : "") + '" data-p="' + k + '" aria-label="تنبيه ' + p[1] + '">' + ic("bell") + "</button></div>" +
          '<div class="pr-more"><label>المؤذن</label><div class="pv-pick"><select class="input pv-v" data-p="' + k + '" aria-label="مؤذن ' + p[1] + '">' +
          ADHAN_VOICES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === v ? " selected" : "") + ">" + x[1] + "</option>"; }).join("") + "</select>" +
          '<button class="pv-play" data-p="' + k + '" aria-label="استمع">' + ic("aplay") + "</button></div>" +
          '<label>تذكير قبل الأذان</label><div class="pv-chips">' + [0, 5, 10, 15, 30, 60].map(function (m) { return '<button class="pv-pre' + (m === pm ? " on" : "") + '" data-p="' + k + '" data-m="' + m + '">' + (m ? ar(m) + " د" : "بدون") + "</button>"; }).join("") + "</div></div></div>";
      }).join("") + "</div>" +
        '<div class="pr-tiles"><button id="prMonth">' + ic("calendar") + "إمساكية رمضان</button><button id=\"prQibla\">" + ic("compass") + "اتجاه القبلة</button></div>" +
        (window.AppBridge && AppBridge.setAlarms ? '<button class="continue" id="prTest">' + ic("bell") + ' جرّب الأذان بعد دقيقة</button>' +
          '<p class="hint">لو التجربة ماوصلتش: افتح إعدادات الموبايل › التطبيقات › القرآن الكريم، وخلّي الإشعارات شغالة، والبطارية «بلا قيود». وفي موبايلات شاومي وأوبو وريلمي فعّل كمان «التشغيل التلقائي» (Autostart).</p>' : "");
    } else html += '<p class="hint">حدّد موقعك أو اختر مدينتك لحساب مواقيت الصلاة على الجهاز (بدون إنترنت).</p>';
    html += '<details class="pr-set"' + (loc ? "" : " open") + "><summary>" + ic("pin") + "الموقع وطريقة الحساب</summary>" +
      '<div class="q-loc"><button class="continue" id="prGps">' + ic("pin") + ' استخدم موقعي الحالي</button><select class="input" id="prCity">' + opts + "</select></div>" +
      '<select class="input" id="prMethod">' + Object.keys(PR_METHODS).map(function (k) {
        return '<option value="' + k + '"' + (k === cfg.method ? " selected" : "") + ">" + PR_METHODS[k].n + "</option>"; }).join("") + "</select>" +
      '<div class="z-sort pr-asr"><span>العصر</span><button data-h="0"' + (cfg.hanafi ? "" : ' class="on"') + '>الجمهور</button><button data-h="1"' + (cfg.hanafi ? ' class="on"' : "") + ">الحنفي</button></div></details>" +
      '<h3 class="set-group">التذكيرات</h3>' +
      [["m", "أذكار الصباح"], ["e", "أذكار المساء"], ["wird", "ورد الختمة اليومي"], ["kahf", "الكهف يوم الجمعة"], ["fast", "صيام السنة غدًا"], ["hifz", "مراجعة الحفظ"], ["stat", "ملخص قراءة اليوم"], ["goal", "هدف القراءة اليومي"]].map(function (r) {
        return '<div class="rem-row"><label class="rem-sw"><input type="checkbox" data-r="' + r[0] + '"' + (rc[r[0]].on ? " checked" : "") + "><span></span>" + r[1] + "</label>" +
          '<input type="time" class="input rem-t" data-t="' + r[0] + '" value="' + rc[r[0]].t + '"></div>';
      }).join("") + "</div>";
    view.innerHTML = html;
    function changed() { save("prayer", cfg); save("reminders", rc); syncAlarms(); var y = window.scrollY; route(); window.scrollTo(0, y); }
    function askNotif() { try { if (window.AppBridge && AppBridge.askNotifications) AppBridge.askNotifications(); } catch (e) {} }
    view.querySelectorAll(".pr-bell").forEach(function (b) { b.onclick = function () { cfg.adhan[b.dataset.p] = !cfg.adhan[b.dataset.p]; if (cfg.adhan[b.dataset.p]) askNotif(); changed(); }; });
    view.querySelectorAll(".rem-sw input").forEach(function (c) { c.onchange = function () { rc[c.dataset.r].on = c.checked; if (c.checked) askNotif(); changed(); }; });
    view.querySelectorAll(".rem-t").forEach(function (c) { c.onchange = function () { if (c.value) { rc[c.dataset.t].t = c.value; changed(); } }; });
    view.querySelectorAll(".pv-v").forEach(function (c) { c.onchange = function () { cfg.voice[c.dataset.p] = c.value; changed(); }; });
    view.querySelectorAll(".pv-pre").forEach(function (c) { c.onclick = function () { cfg.pre[c.dataset.p] = +c.dataset.m; if (+c.dataset.m) askNotif(); changed(); }; });
    view.querySelectorAll("[data-open]").forEach(function (r) { r.onclick = function (e) { if (e.target.closest(".pr-bell")) return;
      var k = r.dataset.open, it = r.parentNode, was = it.classList.contains("open");
      view.querySelectorAll(".pr-item.open").forEach(function (x) { x.classList.remove("open"); }); if (!was) it.classList.add("open"); showPrayer.open = was ? "" : k; }; });
    var playing = "";
    view.querySelectorAll(".pv-play").forEach(function (b) { b.onclick = function () {
      var v = cfg.voice[b.dataset.p] || "makkah", stop = playing === b.dataset.p;
      view.querySelectorAll(".pv-play").forEach(function (x) { x.classList.remove("on"); });
      playing = stop ? "" : b.dataset.p; if (!stop) b.classList.add("on");
      try { if (window.AppBridge && AppBridge.previewAdhan) AppBridge.previewAdhan(stop ? "" : v); else toast("صوت الأذان بيشتغل على الموبايل"); } catch (e) {}
    }; });
    view.querySelectorAll(".pr-asr button").forEach(function (b) { b.onclick = function () { cfg.hanafi = b.dataset.h === "1"; changed(); }; });
    document.getElementById("prMethod").onchange = function () { cfg.method = this.value; changed(); };
    document.getElementById("prCity").onchange = function () { var c = CITIES[+this.value]; if (c) { save("qiblaLoc", [c[1], c[2], c[0]]); askNotif(); changed(); } };
    if (loc) { document.getElementById("prQibla").onclick = function () { location.hash = "#/qibla"; };
      document.getElementById("prMonth").onclick = function () { location.hash = "#/imsakia"; }; }
    if (document.getElementById("prExact")) document.getElementById("prExact").onclick = function () { AppBridge.askExactAlarms(); };
    if (document.getElementById("prNotif")) document.getElementById("prNotif").onclick = function () { AppBridge.askNotifications(); AppBridge.openAppSettings(); };
    if (document.getElementById("prTest")) document.getElementById("prTest").onclick = function () {
      testAlarmAt = Date.now() + 60000; syncAlarms();
      toast("اقفل التطبيق واستنى دقيقة. لو الأذان ماجاش، شوف الملاحظة اللي تحت الزرار.");
    };
    document.getElementById("prGps").onclick = function () {
      var st = this; st.textContent = "جارٍ تحديد موقعك…";
      function got(lat, lon) { save("qiblaLoc", [lat, lon, ""]); askNotif(); changed(); }
      window.qiblaLocation = got;
      window.qiblaLocationError = function () { st.textContent = "تعذّر تحديد الموقع، اختر مدينتك"; };
      if (window.QiblaBridge) return window.QiblaBridge.locate();
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { got(p.coords.latitude, p.coords.longitude); }, function () { window.qiblaLocationError(); }, { timeout: 20000, maximumAge: 600000 });
    };
    if (loc) {
      // Keep the countdown fresh while the screen is open.
      var tm = setInterval(function () { if (!document.body.contains(view.querySelector(".pr-next")) || location.hash !== "#/prayer") return clearInterval(tm);
        var n = nextPrayer(loc, cfg); view.querySelector(".pr-next span").textContent = hm(n.at) + " · " + untilText(n.at - new Date()); }, 30000);
    }
  }

  // ---------- إمساكية الشهر: the prayer times of the next 30 days, as a table and as a picture to share ----------
  function showImsakia() {
    titleEl.textContent = "إمساكية رمضان";
    btnBack.hidden = false;
    var loc = load("qiblaLoc", null), cfg = prayerCfg();
    if (!loc) { view.innerHTML = '<p class="hint">حدّد موقعك الأول من شاشة مواقيت الصلاة.</p>'; return; }
    // The whole of this Ramadan (from its first day), or of the next one.
    var rows = [], ri = ramadanInfo(), base = ri.start, ram = true, todayN = dayNum(new Date());
    if (ri.now) base = new Date(base.getFullYear(), base.getMonth(), base.getDate() - (ri.dayOf - 1));
    for (var i = 0; i < 30; i++) {
      var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i), t = prayerTimes(d, loc[0], loc[1], cfg.method, cfg.hanafi), h = hijri(d);
      if (!h || h.month !== 9) break;
      t.imsak = new Date(t.fajr - 10 * 60000);
      rows.push({ d: d, h: h, t: t });
    }
    if (!rows.length) { view.innerHTML = '<p class="hint">التقويم الهجري غير متاح على هذا الجهاز</p>'; return; }
    var head = ["اليوم", "رمضان", "الإمساك", "الفجر", "الظهر", "العصر", "المغرب", "العشاء"];
    var short = function (dt) { var x = hm(dt); return x.replace(/ [صم]$/, ""); };
    view.innerHTML = '<p class="pr-loc">' + ic("pin") + (loc[2] || "موقعك") + " · " + PR_METHODS[cfg.method].n + " · رمضان " + ar(rows[0].h.year) + " هـ" + (ri.now ? "" : " (بعد " + ar(ri.inDays) + " يوم)") + "</p>" +
      '<div class="ims-wrap"><table class="ims"><thead><tr>' + head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r, i) {
        return "<tr" + (dayNum(r.d) === todayN ? ' class="today"' : r.d.getDay() === 5 ? ' class="fri"' : "") + "><td>" + r.d.toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "numeric" }) + "</td><td>" + ar(r.h.day) + "</td>" +
          ["imsak", "fajr", "dhuhr", "asr", "maghrib", "isha"].map(function (k) { return "<td>" + short(r.t[k]) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div>" +
      '<button class="continue" id="imsShare">' + ic("share") + " مشاركة الإمساكية صورة</button>";
    document.getElementById("imsShare").onclick = function () {
      var W = 1080, rh = 46, top = 190, c = document.createElement("canvas"), x = c.getContext("2d"), H = top + rh * (rows.length + 1) + 90;
      c.width = W; c.height = H;
      x.fillStyle = "#fbf7ee"; x.fillRect(0, 0, W, H); x.direction = "rtl"; x.textAlign = "center";
      x.fillStyle = "#0f6b4f"; x.font = "700 46px Cairo, sans-serif"; x.fillText("إمساكية رمضان " + ar(rows[0].h.year) + " هـ" + (loc[2] ? " · " + loc[2] : ""), W / 2, 80);
      x.fillStyle = "#7a6a40"; x.font = "400 26px Cairo, sans-serif"; x.fillText(PR_METHODS[cfg.method].n + " · الإمساك قبل الفجر بعشر دقائق", W / 2, 128);
      var cols = [170, 120, 120, 120, 120, 120, 120, 120], xs = [], acc = W - 40;
      cols.forEach(function (w) { xs.push(acc - w / 2); acc -= w; });
      x.font = "700 24px Cairo, sans-serif"; x.fillStyle = "#0f6b4f"; head.forEach(function (h, j) { x.fillText(h, xs[j], top); });
      x.font = "400 24px Cairo, sans-serif";
      rows.forEach(function (r, i) {
        var y = top + rh * (i + 1);
        if (i % 2 === 0) { x.fillStyle = "rgba(15,107,79,.07)"; x.fillRect(40, y - 32, W - 80, rh); }
        x.fillStyle = r.d.getDay() === 5 ? "#0f6b4f" : "#1d1a14";
        [r.d.toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "numeric" }), ar(r.h.day)].concat(["imsak", "fajr", "dhuhr", "asr", "maghrib", "isha"].map(function (k) { return short(r.t[k]); }))
          .forEach(function (v, j) { x.fillText(v, xs[j], y); });
      });
      x.fillStyle = "#9a7420"; x.font = "400 22px Cairo, sans-serif"; x.fillText("تطبيق القرآن الكريم", W / 2, H - 36);
      shareImage(c.toDataURL("image/png"), "imsakia.png");
    };
  }

  // ---------- الشريط السفلي ----------
  var TABS = [["#/", "home", "المصحف"], ["#/prayer", "clock", "الصلاة"], ["#/azkar", "sun", "الأذكار"], ["#/more", "grid", "المزيد"]];
  function tabbar() {
    var bar = document.getElementById("tabbar"), h = location.hash || "#/";
    if (!bar) {
      bar = document.createElement("nav"); bar.id = "tabbar";
      bar.innerHTML = TABS.map(function (t) { return '<button data-h="' + t[0] + '">' + ic(t[1]) + "<span>" + t[2] + "</span></button>"; }).join("");
      document.body.appendChild(bar);
      bar.querySelectorAll("button").forEach(function (b) { b.onclick = function () { location.hash = b.dataset.h; }; });
    }
    var cur = h === "#" ? "#/" : h;
    var show = cur === "#/" || /^#\/(azkar|prayer|more|duas|tasbih|qibla|khatma|hifzlog|hifztest|hifzmap|mutash|talqin|family|topics|imsakia|tajweed|qiraat|stats)/.test(cur);
    bar.hidden = !show; document.body.classList.toggle("has-tabs", show);
    bar.querySelectorAll("button").forEach(function (b) {
      var t = b.dataset.h, on = t === "#/" ? cur === "#/" : cur.indexOf(t) === 0 || (t === "#/prayer" && /^#\/(imsakia|qibla)/.test(cur)) ||
        (t === "#/more" && /^#\/(duas|tasbih|khatma|hifz|family|topics|tajweed|qiraat|stats)/.test(cur));
      b.classList.toggle("on", on);
    });
  }

  // ---------- خريطة الحفظ ----------
  // Every page of the current edition as a square, coloured from hifzLog (memorised surahs and when they were last revised).
  // Colour 0..3 of every mushaf page (c[pageNo]) and how many pages have each; shared by the hifz map and the hifz test's mini map.
  function hifzPageColors() {
    var L = hifzLogData(), RV = hzRevData(), sc = load("hifzScores", {}), today = dayNum(new Date()), cnt = [0, 0, 0, 0], col = [];
    // ayat recited or tested one by one (hifzMark), per page: how many of the page's ayat, the oldest day, any wrong
    var HA = load("hifzAyat", {}), PA = {};
    for (var s0 = 1; s0 <= 114; s0++) Q.p[s0 - 1].forEach(function (pg, i) {
      var e = PA[pg] = PA[pg] || { n: 0, got: 0, age: 0, bad: false }, h = HA[s0 + ":" + (i + 1)]; e.n++;
      if (h) { e.got++; e.age = Math.max(e.age, today - parseDay(h.d)); if (!h.ok) e.bad = true; }
    });
    for (var n = Q.first; n <= Q.last; n++) {
      var ss = [], on = 0, age = 0, weak = false;
      for (var s = 1; s <= 114; s++) { var ps = Q.p[s - 1]; if (ps[0] <= n && ps[ps.length - 1] >= n) ss.push(s); }
      ss.forEach(function (s) { var e = L[s], r = RV[s]; if (e) { on++; if (r && hzDueInfo(r, hzScoreOf(sc, s)).due) weak = true; } });
      var c = !on ? 0 : on < ss.length ? 1 : weak ? 2 : 3, pa = PA[n];
      if (pa && pa.got) c = Math.max(c, pa.got < pa.n ? 1 : pa.age > 14 || pa.bad ? 2 : 3);
      cnt[c]++; col[n] = c;
    }
    return { c: col, cnt: cnt };
  }
  // Small hifz-map card for the top of the hifz test: ring of memorised pages + ayat waiting for review; links to the map.
  function hifzMini() {
    var pc = hifzPageColors(), tot = Q.last - Q.first + 1, pct = Math.round(pc.cnt[3] * 1000 / tot + pc.cnt[2] * 1000 / tot) / 10, HA = load("hifzAyat", {}), rv = 0;
    Object.keys(HA).forEach(function (k) { if (HA[k] && HA[k].ok === 0) rv++; });
    return '<a class="ht-mini hl-top" href="#/hifzmap"><div class="hl-ring" style="--p:' + pct + '"><b>' + ar(pct) + "٪</b></div><div><b>" + ar(pct) + "٪ محفوظ · " + ar(rv) + " آية للمراجعة</b><small>خريطة الحفظ ←</small></div></a>";
  }
  function showHifzMap() {
    titleEl.textContent = "خريطة الحفظ";
    btnBack.hidden = false;
    var pc = hifzPageColors(), cnt = pc.cnt, cells = "", L = hifzLogData(), RV = hzRevData(), sc = load("hifzScores", {}), HA = load("hifzAyat", {}), today = dayNum(new Date());
    // a page holding more than one surah gets one box per surah (5.11 G6): the colour rules of hifzPageColors, for that
    // surah's ayat on that page
    function segCol(s, n) {
      var e = L[s], c = !e ? 0 : RV[s] && hzDueInfo(RV[s], hzScoreOf(sc, s)).due ? 2 : 3, got = 0, tot = 0, age = 0, bad = false;
      Q.p[s - 1].forEach(function (pg, i) { if (pg !== n) return; tot++; var h = HA[s + ":" + (i + 1)]; if (h) { got++; age = Math.max(age, today - parseDay(h.d)); if (!h.ok) bad = true; } });
      if (got) c = Math.max(c, got < tot ? 1 : age > 14 || bad ? 2 : 3);
      return c;
    }
    for (var n = Q.first; n <= Q.last; n++) {
      var ss = []; for (var s = 1; s <= 114; s++) { var ps = Q.p[s - 1]; if (ps[0] <= n && ps[ps.length - 1] >= n) ss.push(s); }
      if (ss.length < 2) cells += '<a class="hm-c c' + pc.c[n] + '" href="#/p/' + n + '" data-p="' + n + '" data-s="' + (ss[0] || surahOfPage(n)) + '" title="' + ar(n) + '"></a>';
      else ss.forEach(function (s) { cells += '<a class="hm-c hm-s c' + segCol(s, n) + '" href="#/p/' + n + '" data-p="' + n + '" data-s="' + s + '" title="' + Q.s[s - 1][0] + " · " + ar(n) + '"></a>'; });
    }
    var tot = Q.last - Q.first + 1, pct = Math.round(cnt[3] * 1000 / tot + cnt[2] * 1000 / tot) / 10;
    var lg = [["c3", "محفوظة ومراجَعة", cnt[3]], ["c2", "محتاجة مراجعة", cnt[2]], ["c1", "محفوظة جزئيًا", cnt[1]], ["c0", "لسه", cnt[0]]];
    view.innerHTML = '<div class="hm">' + hzNav("#/hifzmap") + '<div class="hl-top"><div class="hl-ring" style="--p:' + pct + '"><b>' + ar(pct) + "٪</b></div><div><b>" + ar(cnt[2] + cnt[3]) + " صفحة محفوظة</b><small>من " + ar(tot) + " صفحة</small><small>" + EDS[edition].name + "</small></div></div>" +
      '<div class="hm-lg">' + lg.map(function (l) { return '<span><i class="hm-c ' + l[0] + '"></i>' + l[1] + " (" + ar(l[2]) + ")</span>"; }).join("") + "</div>" +
      '<div class="hm-grid">' + cells + "</div>" +
      '<p class="hint">كل مربع صفحة، والصفحة اللي فيها أكتر من سورة ليها مربع لكل سورة. اضغط على المربع عشان تختار الآية وتبدأ الاختبار. «محتاجة مراجعة» لو آخر مراجعة من أكتر من ١٤ يوم أو نتيجة الاختبار أقل من ٧٠٪.</p>' +
      hzMemoList(L) + "</div>";
    document.getElementById("hmFold").ontoggle = function () { hzMemoOpen = this.open; };
    view.querySelectorAll(".hm-grid .hm-c").forEach(function (c) { c.onclick = function (e) { e.preventDefault(); hzPick(+c.dataset.s, +c.dataset.p); }; });
  }
  // a box of the map: choose the ayah to start from, then test on the mushaf (the main way), with hidden words, or just read
  function hzPick(s, n) {
    var ay = []; Q.p[s - 1].forEach(function (pg, i) { if (pg === n) ay.push(i + 1); }); if (!ay.length) ay = [1];
    var d = el('<div class="dlg-back"><div class="dlg hz-pick"><b>سورة ' + Q.s[s - 1][0] + " · صفحة " + ar(n) + '</b><label class="hz-from">ابدأ من الآية <select class="input" id="hzA">' +
      ay.map(function (a) { return '<option value="' + a + '">' + ar(a) + "</option>"; }).join("") + "</select></label>" +
      '<div class="hz-acts"><button class="continue" id="hzMus">' + ic("book") + " اختبار على المصحف</button>" +
      '<button class="continue" id="hzWords">' + ic("eyeoff") + " اختبار بالكلمات</button>" +
      '<button class="continue" id="hzOpen">' + ic("text") + ' افتح الصفحة</button></div><div class="dlg-btns"><button class="dlg-no">إلغاء</button></div></div></div>').firstChild;
    document.body.appendChild(d);
    var a = function () { return +d.querySelector("#hzA").value; }, close = function () { d.remove(); };
    d.onclick = function (e) { if (e.target === d) close(); };
    d.querySelector(".dlg-no").onclick = close;
    d.querySelector("#hzMus").onclick = function () { var x = a(); close(); hifzTestPages(s, x); };
    d.querySelector("#hzWords").onclick = function () { var x = a(), st = load("hifzTest", { lv: 25 }); close(); save("hifzTest", { lv: st.lv || 25, s: s, from: x }); location.hash = "#/hifztest/" + s; };
    d.querySelector("#hzOpen").onclick = function () { close(); location.hash = "#/p/" + n; };
  }

  // ---------- الختمة الجماعية للعيلة ----------
  // q.family = {name, members: [{n, j: [juz], d: [juz done]}]}. Offline: progress is shared as text with a code the others paste back.
  function familyData() { return load("family", { name: "ختمة العيلة", members: [] }); }
  function familyCode(F) { return "QK1:" + btoa(unescape(encodeURIComponent(JSON.stringify(F)))); }
  function familyText(F) {
    var done = 0; F.members.forEach(function (m) { done += m.d.length; });
    return "📖 " + F.name + ": خلصنا " + ar(done) + " من ٣٠ جزء\n" + F.members.map(function (m) {
      return "• " + m.n + ": " + (m.j.length ? m.j.map(function (j) { return ar(j) + (m.d.indexOf(j) >= 0 ? "✓" : ""); }).join("، ") : "مفيش أجزاء") ;
    }).join("\n") + "\n\nلتحديث الختمة في تطبيق القرآن الكريم: الختمة الجماعية ← استيراد، والصق الكود ده:\n" + familyCode(F);
  }
  function showFamily() {
    titleEl.textContent = "الختمة الجماعية";
    btnBack.hidden = false;
    var F = familyData(), done = 0;
    F.members.forEach(function (m) { done += m.d.length; });
    var html = '<div class="fam"><div class="hl-top"><div class="hl-ring" style="--p:' + Math.round(done / 30 * 100) + '"><b>' + ar(done) + '/٣٠</b></div><div><input id="famName" value="' + esc(F.name) + '" aria-label="اسم الختمة"><small>' + ar(F.members.length) + " فرد · اضغط على الجزء لما يخلص</small></div></div>";
    F.members.forEach(function (m, i) {
      var p = m.j.length ? Math.round(m.d.length / m.j.length * 100) : 0;
      html += '<div class="fam-m"><div class="fam-h"><b>' + esc(m.n) + "</b><small>" + ar(m.d.length) + " من " + ar(m.j.length) + '</small><button class="fam-x" data-x="' + i + '" aria-label="حذف">×</button></div>' +
        '<div class="fam-bar"><i style="width:' + p + '%"></i></div><div class="fam-j">' +
        m.j.map(function (j) { return '<button data-m="' + i + '" data-j="' + j + '"' + (m.d.indexOf(j) >= 0 ? ' class="on"' : "") + ">" + ar(j) + "</button>"; }).join("") + "</div></div>";
    });
    html += '<div class="fam-add"><input id="famNew" placeholder="اسم فرد من العيلة"><button class="continue" id="famAdd">' + ic("plus") + " أضف</button></div>" +
      '<div class="more-row"><button class="continue" id="famSplit">وزّع الأجزاء بالتساوي</button><button class="continue" id="famShare">' + ic("share") + " شارك التقدم</button></div>" +
      '<div class="more-row"><button class="continue" id="famImp">استيراد تحديث</button><button class="continue" id="famReset">ختمة جديدة</button></div>' +
      '<p class="hint">التطبيق مش بيبعت حاجة على الإنترنت. لما حد يخلص جزء يضغط عليه ويشارك التقدم في جروب العيلة، والباقيين يستوردوا الكود.</p></div>';
    view.innerHTML = html;
    function put() { save("family", F); showFamily(); }
    document.getElementById("famName").onchange = function () { F.name = this.value.trim() || "ختمة العيلة"; save("family", F); };
    document.getElementById("famAdd").onclick = function () {
      var n = document.getElementById("famNew").value.trim(); if (!n) return toast("اكتب الاسم الأول");
      F.members.push({ n: n, j: [], d: [] }); put();
    };
    document.getElementById("famSplit").onclick = function () {
      var k = F.members.length; if (!k) return toast("أضف أفراد العيلة الأول");
      F.members.forEach(function (m, i) { var a = Math.floor(i * 30 / k) + 1, b = Math.floor((i + 1) * 30 / k); m.j = []; for (var j = a; j <= b; j++) m.j.push(j); m.d = m.d.filter(function (x) { return m.j.indexOf(x) >= 0; }); });
      put();
    };
    document.getElementById("famShare").onclick = function () { shareText(familyText(F)); };
    document.getElementById("famImp").onclick = function () {
      var t = prompt("الصق رسالة التحديث أو الكود هنا"); if (!t) return;
      var m = t.match(/QK1:([A-Za-z0-9+\/=]+)/);
      try { var G = JSON.parse(decodeURIComponent(escape(atob(m[1])))); if (!G.members) throw 0;
        // merge: a juz marked done anywhere stays done
        G.members.forEach(function (g) { var o = F.members.filter(function (x) { return x.n === g.n; })[0]; if (o) g.d.forEach(function (j) { if (o.d.indexOf(j) < 0) o.d.push(j); }); });
        F.members.forEach(function (o) { var g = G.members.filter(function (x) { return x.n === o.n; })[0]; if (g) o.d.forEach(function (j) { if (g.d.indexOf(j) < 0) g.d.push(j); }); });
        F = G; put(); toast("اتحدثت الختمة");
      } catch (e) { toast("الكود ده مش مفهوم"); }
    };
    document.getElementById("famReset").onclick = function () { if (!confirm("نبدأ ختمة جديدة بنفس الأفراد؟")) return; F.members.forEach(function (m) { m.d = []; }); put(); };
    view.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = function () { if (confirm("نشيل " + F.members[+b.dataset.x].n + "؟")) { F.members.splice(+b.dataset.x, 1); put(); } }; });
    view.querySelectorAll(".fam-j button").forEach(function (b) { b.onclick = function () {
      var m = F.members[+b.dataset.m], j = +b.dataset.j, k = m.d.indexOf(j);
      if (k >= 0) m.d.splice(k, 1); else m.d.push(j);
      var all = 0; F.members.forEach(function (x) { all += x.d.length; });
      save("family", F); showFamily(); if (k < 0 && all === 30) cheer("ختمتوا القرآن، تقبّل الله منكم");
    }; });
  }

  // ---------- المحفّظ والطالب (S11, 5.18) ----------
  // The student's last test (q.lastTest) goes to the teacher as text with a QK2: code (base64 JSON, like QK1 of the
  // family khatma): name, day, kind (m = on the mushaf, w = by words), range, score, ayat forgotten. The teacher pastes
  // codes into «طلابي» (q.students {name: [results]}). Nothing goes over the internet.
  function akCmp(x, y) { var a = x.split(":"), b = y.split(":"); return a[0] - b[0] || a[1] - b[1]; }
  function lastTestSave(r) { r.d = todayStr(); save("lastTest", r); }
  function akName(k) { var sa = k.split(":"); return Q.s[sa[0] - 1][0] + " " + ar(+sa[1]); }
  function ltRange(r) {
    var a = r.r[0].split(":"), b = r.r[1].split(":");
    return a[0] === b[0] ? "سورة " + Q.s[a[0] - 1][0] + (a[1] === "1" && +b[1] === Q.s[b[0] - 1][3] ? "" : " " + ar(+a[1]) + "–" + ar(+b[1])) : akName(r.r[0]) + " – " + akName(r.r[1]);
  }
  function ltDay(d) { return d.split("-").reverse().map(function (n) { return ar(+n); }).join("/"); }
  function teacherCode(r) { return "QK2:" + btoa(unescape(encodeURIComponent(JSON.stringify(r)))); }
  function teacherParse(t) {
    var out = [], re = /QK2:([A-Za-z0-9+\/=]+)/g, m;
    while ((m = re.exec(t || ""))) { try { var r = JSON.parse(decodeURIComponent(escape(atob(m[1])))); if (r && r.n && r.r && r.r.length === 2 && r.sc >= 0) out.push(r); } catch (e) {} }
    return out;
  }
  window.QA_tc = { code: teacherCode, parse: teacherParse };
  function teacherText(r) {
    return "📖 نتيجة اختبار الحفظ: " + r.n + "\n" + ltRange(r) + " (" + (r.k === "w" ? "بالكلمات" : "على المصحف") + ") · " + ltDay(r.d) + "\nالنتيجة: " + ar(r.sc) + "٪" +
      (r.ay ? " · " + ar(r.ay) + " آية" : "") + (r.miss && r.miss.length ? "\nنسيت: " + r.miss.map(akName).join("، ") : "") +
      "\n\nللمحفّظ: افتح «طلابي» في تطبيق القرآن الكريم والصق الرسالة دي:\n" + teacherCode(r);
  }
  function teacherSend() {
    var r = load("lastTest", null); if (!r) return;
    var n = load("myName", ""); if (!n) { n = (prompt("اسمك (عشان المحفّظ يعرفك)") || "").trim(); if (!n) return; save("myName", n); }
    r.n = n; shareText(teacherText(r));
  }
  function showStudents() {
    titleEl.textContent = "طلابي";
    btnBack.hidden = false;
    var S = load("students", {}), names = Object.keys(S).sort();
    var html = '<div class="tc"><p class="hint">الطالب بيعمل اختبار الحفظ، وبعدين من «المراجعة» يضغط «ابعت للمحفّظ». الصق رسالته هنا (ممكن أكتر من رسالة مرة واحدة).</p>' +
      '<textarea class="input" id="tcIn" rows="3" placeholder="الصق رسالة الطالب أو الكود"></textarea><button class="continue" id="tcAdd">' + ic("plus") + " أضف النتيجة</button>";
    if (!names.length) html += '<p class="hint">لسه مفيش طلاب.</p>';
    names.forEach(function (n) {
      var L = S[n], last = L[0], avg = Math.round(L.reduce(function (t, r) { return t + r.sc; }, 0) / L.length);
      html += '<details class="tc-st"><summary><b>' + esc(n) + "</b><small>" + ar(L.length) + " اختبار · آخر نتيجة " + ar(last.sc) + "٪ · المتوسط " + ar(avg) + "٪</small></summary>" +
        L.map(function (r) {
          return '<div class="tc-r"><div><b>' + ltRange(r) + '</b><span class="tc-sc' + (r.sc < 70 ? " low" : "") + '">' + ar(r.sc) + "٪</span></div><small>" + ltDay(r.d) + " · " + (r.k === "w" ? "بالكلمات" : "على المصحف") + "</small>" +
            (r.miss && r.miss.length ? '<div class="tc-miss">' + r.miss.map(function (k) { var sa = k.split(":"); return '<a href="#/a/' + sa[0] + "/" + sa[1] + '">' + akName(k) + "</a>"; }).join("") + "</div>" : "") + "</div>";
        }).join("") + '<button class="tc-del" data-n="' + esc(n) + '">شيل الطالب</button></details>';
    });
    view.innerHTML = html + "</div>";
    document.getElementById("tcAdd").onclick = function () {
      var rs = teacherParse(document.getElementById("tcIn").value), added = 0;
      if (!rs.length) return toast("مفيش كود QK2 في الرسالة دي");
      rs.forEach(function (r) {
        var L = S[r.n] = S[r.n] || [], id = JSON.stringify([r.d, r.k, r.r, r.sc]);
        if (L.some(function (x) { return JSON.stringify([x.d, x.k, x.r, x.sc]) === id; })) return;
        L.push(r); added++;
      });
      Object.keys(S).forEach(function (n) { S[n].sort(function (a, b) { return parseDay(b.d) - parseDay(a.d); }); S[n] = S[n].slice(0, 100); });
      save("students", S); showStudents(); toast(added ? "اتضافت " + ar(added) + " نتيجة" : "النتيجة دي موجودة قبل كده");
    };
    view.querySelectorAll(".tc-del").forEach(function (b) { b.onclick = function () { if (!confirm("نشيل " + b.dataset.n + "؟")) return; delete S[b.dataset.n]; save("students", S); showStudents(); }; });
  }

  // ---------- فهرس مواضيع القرآن ----------
  function showTopics(g, i) {
    titleEl.textContent = "مواضيع القرآن";
    btnBack.hidden = false;
    var T = window.TOPICS || []; window.scrollTo(0, 0);
    if (g != null && T[g] && T[g].t[i]) {
      var t = T[g].t[i]; titleEl.textContent = t.n;
      view.innerHTML = '<div class="tp"><p class="hint">' + ar(t.a.length) + " آية</p>" + t.a.map(function (x) {
        return '<a class="tp-a" href="#/s/' + x[0] + "/" + x[1] + '"><p>' + Q.t[x[0] - 1][x[1] - 1] + ' <span class="ayah-no">﴿' + ar(x[1]) + "﴾</span></p><small>" + Q.s[x[0] - 1][0] + " · " + ar(x[1]) + "</small></a>";
      }).join("") + "</div>";
      return;
    }
    view.innerHTML = '<div class="tp">' + T.map(function (G, gi) {
      return '<h3 class="tp-g">' + G.g + '</h3><div class="tp-list">' + G.t.map(function (t, ti) { return '<a href="#/topics/' + gi + "/" + ti + '"><b>' + t.n + "</b><small>" + ar(t.a.length) + " آية</small></a>"; }).join("") + "</div>";
    }).join("") + '<p class="about">الفهرس متولّد من جذور الكلمات ونص المصحف اللي في التطبيق نفسه، فممكن يفوته آية بتتكلم عن الموضوع من غير ما تذكر لفظه.</p></div>';
  }

  // ---------- المزيد ----------
  function showMore() {
    titleEl.textContent = "المزيد";
    btnBack.hidden = true;
    // 5.11 G4: the tools in titled groups (memorisation first: the hifz test is its main tool, G6), settings at the bottom
    var G = [["الحفظ", [["#/hifztest", "eyeoff", "اختبار الحفظ", "tjw"], ["#/hifzmap", "grid", "خريطة الحفظ", "tjw"], ["#/hifzlog", "check", "المراجعة", "qib"], ["#/mutash", "list", "اختبار المتشابهات", "qra"], ["#/talqin", "wave", "التلقين", "sun"]]],
      ["القراءة والختمة", [["#/khatma", "target", "الختمة والعلامات", "kh"], ["#/family", "users", "ختمة العيلة", "kh"], ["#/students", "users", "طلابي", "tjw"], ["#/topics", "list", "مواضيع القرآن", "qra"], ["#/stats", "chart", "الإحصائيات", "qib"]]],
      ["التجويد والقراءات", [["#/tajweed", "wave", "أحكام التجويد", "tjw"], ["#/qiraat", "book", "القراءات العشر", "qra"]]],
      ["أدعية وعبادات", [["#/duas", "hands", "أدعية مختارة", "sun"], ["#/tasbih", "beads", "السبحة", "sun"], ["#/qibla", "compass", "اتجاه القبلة", "qib"], ["#/imsakia", "calendar", "إمساكية رمضان", "kh"]]]];
    view.innerHTML = G.map(function (g) {
      return '<section class="more-g"><h3 class="more-h">' + g[0] + '</h3><div class="tiles more">' + g[1].map(function (t, i) { return '<button class="tile' + (g[1].length % 2 && !i ? " main" : "") + '" data-h="' + t[0] + '"><span class="tile-ic ' + t[3] + '">' + ic(t[1]) + "</span>" + t[2] + "</button>"; }).join("") + "</div></section>";
    }).join("") +
      '<div class="more-row"><button class="continue" id="mSet">' + ic("gear") + ' الإعدادات</button><button class="continue" id="mWel">' + ic("rep") + " شاشة الترحيب</button></div>";
    view.querySelectorAll(".tile").forEach(function (b) { b.onclick = function () { location.hash = b.dataset.h; }; });
    document.getElementById("mSet").onclick = function () { document.getElementById("btnSettings").click(); };
    document.getElementById("mWel").onclick = showWelcome;
  }

  // ---------- الترحيب أول مرة: الطبعة، المدينة، التذكيرات ----------
  function showWelcome() {
    var step = 0, d = document.createElement("div"); d.className = "wel"; document.body.appendChild(d);
    var rc = remCfg(), cfg = prayerCfg();
    function done() { save("onboarded", true); if (mode === "pages" && !edReady(edition)) { mode = "text"; save("mode", "text"); applySettings(); } d.remove(); syncAlarms(); route(); }
    function paint() {
      var LAST = 3, dots = '<div class="wel-dots">' + [0, 1, 2, 3].map(function (i) { return "<i" + (i === step ? ' class="on"' : "") + "></i>"; }).join("") + "</div>", body;
      if (step === 0) body = '<div class="wel-ic">' + ic("book") + "</div><h2>أهلًا بيك في القرآن الكريم</h2><p>اختار المصحف اللي متعود تقرا فيه. تقدر تغيّره بعدين من الإعدادات.</p>" +
        '<div class="wel-opts">' + ["kfgqpc", "kfold", "shamarly", "harmain"].filter(function (k) { return EDS[k]; }).map(function (k) { return '<button data-e="' + k + '"' + (k === edition && mode === "pages" ? ' class="on"' : "") + ">" + EDS[k].name + "</button>"; }).join("") +
        '<button data-e="text"' + (mode === "text" ? ' class="on"' : "") + ">نص مشكول (بدون صور)</button></div>";
      else if (step === 1) {
        var loc = load("qiblaLoc", null);
        body = '<div class="wel-ic">' + ic("pin") + "</div><h2>مدينتك</h2><p>عشان مواقيت الصلاة والأذان والقبلة. كل الحساب بيتم على الموبايل من غير إنترنت.</p>" +
          '<button class="continue" id="wGps">' + ic("pin") + ' استخدم موقعي</button><select class="input" id="wCity"><option value="">أو اختار مدينة…</option>' +
          CITIES.map(function (c, i) { return '<option value="' + i + '"' + (loc && loc[2] === c[0] ? " selected" : "") + ">" + c[0] + "</option>"; }).join("") + "</select>" +
          '<p class="wel-got">' + (loc ? "✓ " + (loc[2] || "اتحدد موقعك") : "") + "</p>";
      } else if (step === 2) {
        // 5.11 G3.7: the recitation model, offered once on the first run. Terms are required for the button; the voice
        // donation is a separate opt-in, unticked by default (G3.8).
        var aq = asrPacks("asrnv").some(function (k) { return edQ.indexOf(k) >= 0; });
        body = '<div class="wel-ic">' + ic("mic") + "</div><h2>نموذج التعرّف على التلاوة</h2><p>بيسمع تلاوتك ويتابعها في المصحف ويصحّح التسميع. بيشتغل على الموبايل من غير إنترنت، وحجمه " + ar(ASRM.asrnv.mb) + " ميجا (الأفضل تنزّله على wifi).</p>" +
          (asrReady("asrnv") ? '<p class="wel-got">✓ النموذج جاهز</p>' : aq ? '<p class="wel-got">جاري التنزيل… تابعه من الإعدادات › التحميلات</p>' :
          '<label class="rem-row"><span class="rem-sw"><input type="checkbox" id="wTerms"><span></span>موافق على شروط استخدام النموذج وسياسة الخصوصية</span></label>' +
          '<label class="rem-row"><span class="rem-sw"><input type="checkbox" id="wDonate"><span></span>ساعد في تحسين التعرّف على التلاوة بتسجيلات صوتك (اختياري)</span></label>' +
          '<button class="continue" id="wDl" disabled>' + ic("dl") + " حمّل النموذج</button>");
      } else body = '<div class="wel-ic">' + ic("bell") + "</div><h2>تحب نفكّرك بإيه؟</h2><p>تقدر تغيّر المواعيد بعدين من شاشة الصلاة.</p>" +
        [["adhan", "الأذان في مواعيده"], ["m", "أذكار الصباح"], ["e", "أذكار المساء"], ["kahf", "الكهف يوم الجمعة"], ["stat", "ملخص قراءة اليوم"]].map(function (r) {
          var on = r[0] === "adhan" ? cfg.adhan.fajr : rc[r[0]].on;
          return '<label class="rem-row"><span class="rem-sw"><input type="checkbox" data-w="' + r[0] + '"' + (on ? " checked" : "") + "><span></span>" + r[1] + "</span></label>";
        }).join("");
      // 5.11 G3: «تخطي» skips this step (the last one finishes); «تخطي الكل» leaves the welcome at once.
      d.innerHTML = '<div class="wel-card">' + dots + body + '<div class="wel-btns"><button class="wel-skip">تخطي</button><button class="wel-next">' + (step < LAST ? "التالي" : "يلا نبدأ") + "</button></div>" +
        (step < LAST ? '<button class="wel-all">تخطي الكل</button>' : "") + "</div>";
      d.querySelectorAll("[data-e]").forEach(function (b) { b.onclick = function () {
        needEd(b.dataset.e, function () {
          if (b.dataset.e === "text") { mode = "text"; save("mode", "text"); } else { mode = "pages"; save("mode", "pages"); if (b.dataset.e !== edition) switchEdition(b.dataset.e); }
          applySettings(); paint(); }); }; });
      if (step === 1) {
        document.getElementById("wCity").onchange = function () { var c = CITIES[+this.value]; if (c) { save("qiblaLoc", [c[1], c[2], c[0]]); paint(); } };
        document.getElementById("wGps").onclick = function () {
          this.textContent = "جارٍ تحديد موقعك…";
          window.qiblaLocation = function (lat, lon) { save("qiblaLoc", [lat, lon, ""]); paint(); };
          window.qiblaLocationError = function () { toast("تعذّر تحديد الموقع، اختار مدينتك"); paint(); };
          if (window.QiblaBridge) return window.QiblaBridge.locate();
          if (navigator.geolocation) navigator.geolocation.getCurrentPosition(function (p) { window.qiblaLocation(p.coords.latitude, p.coords.longitude); }, function () { window.qiblaLocationError(); });
        };
      }
      var wT = document.getElementById("wTerms"), wDl = document.getElementById("wDl");
      if (wT) wT.onchange = function () { wDl.disabled = !wT.checked; };
      if (wDl) wDl.onclick = function () {
        save("modelConsent", { v: 1, t: Date.now() }); save("donate", document.getElementById("wDonate").checked ? 1 : 0); donatePaint();
        if (!window.EdBridge) { toast("التنزيل متاح في التطبيق على الموبايل بس"); return; }
        needAsr("asrnv", function () { asrPick("asrnv"); paintEdDl(); toast("خلص تنزيل نموذج التعرّف على التلاوة"); }); asrBtn(); paint();
      };
      d.querySelectorAll("[data-w]").forEach(function (c) { c.onchange = function () {
        if (c.dataset.w === "adhan") ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach(function (k) { cfg.adhan[k] = c.checked; }); else rc[c.dataset.w].on = c.checked;
        save("prayer", cfg); save("reminders", rc);
        if (c.checked) try { if (window.AppBridge && AppBridge.askNotifications) AppBridge.askNotifications(); } catch (e) {}
      }; });
      d.querySelector(".wel-skip").onclick = function () { if (step < LAST) { step++; paint(); } else done(); };
      var all = d.querySelector(".wel-all"); if (all) all.onclick = done;
      d.querySelector(".wel-next").onclick = function () { if (step < LAST) { step++; paint(); } else done(); };
    }
    paint();
  }

  // ---------- أدعية مختارة ----------
  function showDuas(cat) {
    titleEl.textContent = "أدعية مختارة";
    btnBack.hidden = false;
    var C = window.DUAS || [], c = C.filter(function (x) { return x.id === cat; })[0] || C[0];
    var html = '<div class="du-cats">' + C.map(function (x) { return '<button data-c="' + x.id + '"' + (x === c ? ' class="on"' : "") + ">" + ic(x.ic) + x.name + "</button>"; }).join("") + "</div>";
    c.items.forEach(function (z, i) {
      var txt = "";
      if (z.q) { if (z.basmala) txt = '<div class="z-pre">' + BASMALA + "</div>"; for (var a = z.q[1]; a <= z.q[2]; a++) txt += Q.t[z.q[0] - 1][a - 1] + ' <span class="ayah-no">﴿' + ar(a) + "﴾</span> "; }
      var ref = z.q ? "سورة " + Q.s[z.q[0] - 1][0] + " · " + (z.q[1] === z.q[2] ? "الآية " + ar(z.q[1]) : "الآيات " + ar(z.q[1]) + "–" + ar(z.q[2])) : "رواه " + z.src;
      html += '<div class="zikr du" data-i="' + i + '">' + (z.note ? '<div class="z-note">' + z.note + "</div>" : "") +
        '<div class="z-text' + (z.q ? " z-quran" : "") + '">' + (z.q ? txt : z.t) + "</div>" + (z.fadl ? '<div class="z-fadl">' + z.fadl + "</div>" : "") +
        '<div class="z-foot"><span class="z-src">' + ref + (z.n ? " · " + ar(z.n) + " مرات" : "") + '</span><button class="z-play du-sh" aria-label="مشاركة">' + ic("share") + "</button></div></div>";
    });
    view.innerHTML = '<div class="du-wrap">' + html + '<p class="about">المصدر: «حصن المسلم» لسعيد بن وهف القحطاني. الآيات من نص المصحف نفسه المستخدم في التطبيق.</p></div>';
    view.querySelectorAll(".du-cats button").forEach(function (b) { b.onclick = function () { location.replace("#/duas/" + b.dataset.c); }; });
    view.querySelectorAll(".du-sh").forEach(function (b) { b.onclick = function () {
      var z = c.items[+b.closest(".zikr").dataset.i];
      shareText(z.q ? Q.t[z.q[0] - 1].slice(z.q[1] - 1, z.q[2]).join(" ") + " [سورة " + Q.s[z.q[0] - 1][0] + "]" : z.t + " (رواه " + z.src + ")");
    }; });
  }

  // ---------- هدف القراءة اليومي ----------
  function goalCfg() { return load("goal", { pages: 0 }); }
  function todayPages() { return dayPages(load("stats", {})[todayStr()]); }
  function goalCard() {
    var g = goalCfg(), n = todayPages();
    if (!g.pages) return '<button class="mini" id="tGoal">' + ic("target") + "<span>حدد هدف يومي</span></button>";
    var pct = Math.min(100, Math.round(n / g.pages * 100));
    return '<button class="mini goal' + (n >= g.pages ? " done" : "") + '" id="tGoal" style="--p:' + pct + '"><i class="g-ring"><b>' + (n >= g.pages ? "✓" : ar(pct) + "٪") + "</b></i><span>هدف اليوم<small>" + ar(Math.min(n, g.pages)) + " من " + ar(g.pages) + " صفحة</small></span></button>";
  }
  function goalDialog() {
    var g = goalCfg(), rc = remCfg();
    var d = el('<div class="dlg-back"><div class="dlg"><b>هدف القراءة اليومي</b><p class="hint">كام صفحة في اليوم؟ الصفحات بتتحسب لوحدها وانت بتقرا.</p><div class="pv-chips g-chips">' +
      [0, 1, 2, 4, 5, 10, 20].map(function (n) { return '<button data-n="' + n + '"' + (n === g.pages ? ' class="on"' : "") + ">" + (n ? ar(n) : "بدون") + "</button>"; }).join("") +
      '</div><label class="rem-row"><span class="rem-sw"><input type="checkbox" id="gRem"' + (rc.goal.on ? " checked" : "") + "><span></span>فكّرني لو مخلصتش</span>" +
      '<input type="time" class="input rem-t" id="gT" value="' + rc.goal.t + '"></label><div class="dlg-btns"><button class="dlg-ok">تم</button></div></div></div>').firstChild;
    document.body.appendChild(d);
    d.querySelectorAll("[data-n]").forEach(function (b) { b.onclick = function () { g.pages = +b.dataset.n; d.querySelectorAll("[data-n]").forEach(function (x) { x.classList.toggle("on", x === b); }); }; });
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    d.querySelector(".dlg-ok").onclick = function () {
      rc.goal.on = d.querySelector("#gRem").checked && g.pages > 0; rc.goal.t = d.querySelector("#gT").value || rc.goal.t;
      save("goal", g); save("reminders", rc); d.remove();
      if (rc.goal.on) try { AppBridge.askNotifications(); } catch (e) {}
      syncAlarms(); if (location.hash === "#/" || !location.hash) showHome();
    };
  }

  // ---------- اختبار الحفظ: كلمات مخفية تكشفها لما تنساها ----------
  // 5.15c item 3: «السور المحفوظة» under the hifz test (q.hifzLog), fold-open, a list to look at
  function hzMemoList(L) {
    var h = '<section class="hm-memo"><details class="hl-fold" id="hmFold"' + (hzMemoOpen ? " open" : "") + '><summary class="continue hl-sbtn">' + ic("check") + " السور المحفوظة</summary>" +
      '<p class="hint">السورة بتدخل القايمة دي لما تسمّعها كلها هنا في «اختبار الحفظ» (أو من «خريطة الحفظ») بنتيجة ٨٠٪ أو أكتر. ولو جبت أقل من ٨٠٪ بتخرج منها.</p><ul class="hl-list">';
    for (var s = 1; s <= 114; s++) {
      var e = L[s];
      h += '<li data-s="' + s + '" class="' + (e ? "on" : "") + '"><span class="hl-n">' + ar(s) + "</span><b>" + Q.s[s - 1][0] + "</b><small>" + ar(Q.s[s - 1][3]) + " آية" +
        (e && e.score != null ? " · " + ar(e.score) + "٪" : "") + '</small><i class="hl-chk">' + (e ? "✓" : "") + "</i></li>";
    }
    return h + "</ul></details></section>";
  }
  function showHifzTest(s) {
    // a voice test left running on an earlier render stops, unless it goes on into the next ayat (htv.more)
    var carry = htv.on && htv.carry ? { skip: htv.carrySkip || 0 } : null;
    if (htv.on && !carry) { htv.on = false; Mic.stop(); }
    titleEl.textContent = "اختبار الحفظ";
    btnBack.hidden = false;
    var L = hifzLogData(), due = hifzDue(), st = load("hifzTest", { lv: 25 });
    if (!s) s = st.s || (due ? due.s : 1);
    var from = st.s === s && st.from ? st.from : 1, cnt = Q.s[s - 1][3], lv = st.lv || 25;
    // a range test (المراجعة › اختبرني): parts of n ayat up to the range's last ayah, across surahs; acc adds up the parts
    var rg = st.s === s && st.end != null && st.end >= gIdx(s, from) ? { end: st.end, n: st.n || 10, acc: st.acc || { h: 0, m: 0 }, pc: st.pc || [], pn: st.pn || 1, pt: st.pt || 1 } : null;
    // 5.16e: a range left over from an earlier «المراجعة» test does not follow into «اختبار الحفظ» (opened from its tab,
    // home or the map): the test here is a plain one, «قلب تلقائي» works
    if (rg && !hzFrom) { rg = null; ["end", "n", "acc", "pc", "pn", "pt", "cont"].forEach(function (x) { delete st[x]; }); save("hifzTest", st); }
    var endA = rg ? gAy(rg.end) : null, last = endA && endA[0] === s ? endA[1] : cnt;
    var to = Math.min(cnt, from + (rg ? rg.n : 10) - 1, last);
    var hzFl = load("hifzFlip", true);
    var nx = to < last ? { s: s, from: to + 1 } : rg && endA[0] > s ? { s: s + 1, from: 1 } : null;
    // a random test's next place (5.14): its first ayah, its length and end
    if (!nx && rg && rg.pc.length) { var P1 = rg.pc[0], b1 = gAy(P1[0]); nx = { s: b1[0], from: b1[1], place: P1 }; }
    // the saved test state for the next part (or this part at another level): the range goes along
    var stNext = function (o) { var c9 = load("hifzTest", {}); if (c9.ss) o.ss = c9.ss; if (rg) { var c0 = load("hifzTest", {}); o.n = rg.n; o.end = rg.end; o.acc = c0.acc || rg.acc; o.pc = rg.pc; o.pn = rg.pn; o.pt = rg.pt; } return o; };
    var goNext = function () {
      var o = stNext({ lv: lv, s: nx.s, from: nx.from });
      if (nx.place) { o.n = nx.place[1] - nx.place[0] + 1; o.end = nx.place[1]; o.pc = rg.pc.slice(1); o.pn = rg.pn + 1; hzPlaceBuzz(); }
      else o.cont = 1;   // the next ayat of the same place: not a new start (5.15b item 6)
      save("hifzTest", o);
      if (nx.s !== s) history.replaceState(null, "", "#/hifztest/" + nx.s);
      showHifzTest(nx.s);
    };
    var opts = ""; for (var i = 1; i <= 114; i++) opts += '<option value="' + i + '"' + (i === s ? " selected" : "") + ">" + ar(i) + ". " + Q.s[i - 1][0] + (L[i] ? " ✓" : "") + "</option>";
    // the start ayah, next to the surah (5.13 P2.5, like the map's «ابدأ من الآية»); the test shows ten ayat from it
    var aopts = ""; for (var i2 = 1; i2 <= cnt; i2++) aopts += '<option value="' + i2 + '"' + (i2 === from ? " selected" : "") + ">من الآية " + ar(i2) + "</option>";
    // Hide every n-th word from a random start, so each round hides different words; the level is the share hidden.
    var html = '<div class="ht">' + hzNav("#/hifztest") + '<div class="ht-top"><div class="ht-pick"><select class="input" id="htS" aria-label="السورة">' + opts + '</select><select class="input" id="htA" aria-label="ابدأ من الآية">' + aopts + '</select></div><div class="z-sort ht-lv"><span>إخفاء</span>' +
      [[25, "ربع الكلمات"], [50, "النص"], [100, "كل الكلمات"]].map(function (x) { return '<button data-l="' + x[0] + '"' + (x[0] === lv ? ' class="on"' : "") + ">" + x[1] + "</button>"; }).join("") + "</div></div>" +
      hifzMini() +
      '<p class="hint">اقرا من حفظك. لو نسيت كلمة اضغط عليها عشان تظهر، وفي الآخر اضغط «خلصت». الآيات ' + ar(from) + "–" + ar(to) + " من " + ar(cnt) + '.' + (rg ? ' <span>الاختبار لحد</span> <b>' + ayName(rg.end) + "</b>" : "") + (rg && rg.pt > 1 ? ' <b class="ht-place">' + hzPlace(rg.pn, rg.pt) + "</b>" : "") + '</p><div class="ht-text">';
    var hidden = 0, open0 = lv === 100 && !st.cont ? 3 + Math.floor(Math.random() * 3) : 0;
    for (var a = from; a <= to; a++) {
      var every = lv === 100 ? 1 : lv === 50 ? 2 : 4, off = Math.floor(Math.random() * every);
      html += Q.t[s - 1][a - 1].split(" ").map(function (w, j) {
        if (!/[ء-يٱ]/.test(w)) return w;
        var at = ' data-a="' + a + '" data-w="' + j + '"';   // ayah and word number, for donated clip labels
        if ((j + off) % every || (a === from && j < open0)) return '<span class="ht-v' + (a === from && j < open0 ? " ht-open" : "") + '"' + at + ">" + w + "</span>";
        hidden++; return '<button class="ht-w"' + at + ">" + w + "</button>";
      }).join(" ") + ' <span class="ayah-no">﴿' + ar(a) + "﴾</span> ";
    }
    // wrong ayat of this surah from earlier tests/recitations, newest first: a chip restarts the test at that ayah
    var HA = load("hifzAyat", {}), bad = [];
    Object.keys(HA).forEach(function (k) { var p = k.split(":"); if (+p[0] === s && HA[k] && HA[k].ok === 0) bad.push({ a: +p[1], d: parseDay(HA[k].d) }); });
    bad.sort(function (x, y) { return y.d - x.d || x.a - y.a; });
    html += '</div>' + (window.ReciteBridge ? '<button class="continue ht-mic" id="htMic">' + ic("mic") + " سمّع بالصوت</button>" : "") +
      '<button class="continue" id="htFix" hidden>' + ic("check") + " أنا قريت صح</button>" +
      '<div class="ht-ibs"><button class="continue" id="htQari">' + ic("aplay") + "<span>القارئ</span></button>" +
      '<button class="continue" id="htRec">' + ic("mic") + "<span>سجّل</span></button>" +
      '<button class="continue" id="htPeek">' + ic("eye") + "<span>اظهر</span></button>" +
      '<button class="continue" id="htPages">' + ic("book") + "<span>المصحف</span></button>" +
      // reciting past the last ayah always opens the next ayat with the mic still on: «قلب تلقائي» is shown on and
      // disabled (5.15c item 1)
      '<button class="continue' + (rg || hzFl ? " on" : "") + '" id="htFlip"' + (rg ? " disabled" : "") + ' aria-pressed="' + !!(rg || hzFl) + '">' + ic("anext") + "<span>قلب تلقائي</span></button></div>" +
      '<audio id="htAudio" controls hidden></audio>' +
      '<div class="ht-foot"><button class="continue" id="htDone">' + ic("check") + " خلصت</button>" +
      (nx ? '<button class="continue" id="htNext">' + (nx.place ? "الموضع اللي بعده" : "الآيات اللي بعدها") + "</button>" : "") + '</div><p class="ht-res" id="htRes"></p>' +
      (bad.length ? '<details class="ht-bad hl-fold" id="htBad"' + (htBadOpen ? " open" : "") + '><summary><b>آيات غلطت فيها قبل كده (' + ar(bad.length) + ')</b></summary><div>' + bad.map(function (x) { return '<button data-a="' + x.a + '">الآية ' + ar(x.a) + "</button>"; }).join("") + "</div></details>" : "") +
      reciteHistory() + hzMemoList(L) + "</div>";
    view.innerHTML = html;
    document.getElementById("hmFold").ontoggle = function () { hzMemoOpen = this.open; };
    var hf = document.getElementById("htFlip"); if (!hf.disabled) hf.onclick = function () { var fo = !load("hifzFlip", true); save("hifzFlip", fo); this.classList.toggle("on", fo); this.setAttribute("aria-pressed", fo); toast(fo ? "الآيات اللي بعدها هتفتح لوحدها وانت بتسمّع" : "الاختبار هيخلص في آخر الآيات دي"); };
    var hb = document.getElementById("htBad"); if (hb) hb.ontoggle = function () { htBadOpen = this.open; };
    var missed = 0, rec = null;
    document.getElementById("htQari").onclick = function () { player.playRange(s, from, to); };
    document.getElementById("htPages").onclick = function () { hifzTestPages(s, from); };
    // a peek at every hidden word (not counted as forgotten); tapped again hides them back
    document.getElementById("htPeek").onclick = function () {
      var t = view.querySelector(".ht-text"), on = t.classList.toggle("peek");
      this.classList.toggle("on", on); this.innerHTML = ic(on ? "eyeoff" : "eye") + "<span>" + (on ? "اخفي" : "اظهر") + "</span>";
    };
    document.getElementById("htRec").onclick = function () {
      var b = this, au = document.getElementById("htAudio");
      if (rec) { rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) return toast("التسجيل مش متاح على الجهاز ده");
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var parts = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = function (e) { parts.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); }); rec = null;
          if (au.src && au.src.indexOf("blob:") === 0) URL.revokeObjectURL(au.src);
          au.src = URL.createObjectURL(new Blob(parts, { type: parts[0] ? parts[0].type : "audio/webm" })); au.hidden = false;
          b.innerHTML = ic("mic") + "<span>سجّل</span>"; b.classList.remove("rec");
        };
        rec.start(); b.innerHTML = ic("astop") + "<span>إيقاف</span>"; b.classList.add("rec");
      }).catch(function () { toast("محتاج إذن الميكروفون عشان تسجّل"); });
    };
    view.querySelectorAll(".ht-w").forEach(function (b) { b.onclick = function () { if (b.classList.contains("shown")) return; b.classList.add("shown", "miss"); b.dataset.tap = 1; missed++; }; });
    // Recite from memory into the mic: each hidden word shows when it is said right, and turns red when it is skipped
    // or said wrong. The heard words are aligned with the test's words ayah by ayah (rAlign), so a misheard extra word
    // does not throw the rest off.
    var htMic = document.getElementById("htMic");
    if (htMic) htMic.onclick = function () {
      if (htv.on) { htv.on = false; Mic.stop(); htMic.classList.remove("rec"); htMic.innerHTML = ic("mic") + " سمّع بالصوت"; return; }
      htvSetup(0);
      if (!micGate(function () { htMic.click(); })) { htv.on = false; return; }
      reciteStop(); player.stop(); Mic.start(); htMic.classList.add("rec"); htMic.innerHTML = ic("astop") + " إيقاف";
      htvTop();
    };
    // the mic opens (or the next ayat open with it on): the text goes under the bar, then follows the reader (5.11 #11)
    function htvTop() {
      var t = view.querySelector(".ht-text"), bh = (document.querySelector(".bar") || { offsetHeight: 0 }).offsetHeight;
      if (t) window.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + window.scrollY - bh - 8), behavior: "auto" });
    }
    function htvSetup(skip) {
      var ws = [].slice.call(view.querySelectorAll(".ht-w, .ht-v"));
      var nth = {}, hk = ws.map(function (e) { var a = e.dataset.a; nth[a] = (nth[a] || 0); return s + ":" + a + ":" + nth[a]++; });   // "s:a:w", w = place in rWords
      htv = { on: true, ws: ws, sk: ws.map(function (e) { return rSkel(e.textContent); }), keys: hk, ptr: 0, V: {}, shownV: {}, force: {}, skip: skip || 0,
        // the next ayat with the mic on (q.hifzFlip): this part is scored and saved, then the same mic goes on
        more: nx && (rg || load("hifzFlip", true)) ? function () { htv.carry = true; document.getElementById("htDone").click(); var t = document.getElementById("htRes").textContent; goNext(); return t; } : null,
        // a word's look for a verdict: 1 green, 0 red, null not judged yet (hidden again); words the reader tapped stay
        set: function (i, v) {
          var e = ws[i]; if (!e.classList.contains("ht-w") || e.dataset.tap) return;
          if (htv.force[i]) v = 1;
          var miss = e.classList.contains("miss");
          e.classList.remove("uns");
          if (v === null) { if (miss) missed--; e.classList.remove("shown", "ok", "miss"); }
          else if (v === 1) { if (miss) missed--; e.classList.remove("miss"); e.classList.add("shown", "ok"); }
          else if (v === 2) { if (miss) missed--; e.classList.remove("miss", "ok"); e.classList.add("shown", "uns"); }   // S6
          else if (!miss) { missed++; e.classList.remove("ok"); e.classList.add("shown", "miss"); }
        },
        unmiss: function (e) { if (e.classList.contains("miss")) { e.classList.remove("miss"); e.classList.add("ok"); missed--; } },
        btn: htMic, s: s, fix: document.getElementById("htFix"), done: function () { document.getElementById("htDone").click(); },
        // the next word to say is kept in view, between the bar and 70% of the screen (5.11 #11)
        follow: function (at) {
          var e = ws[Math.min(ws.length - 1, at)]; if (!e) return;
          var r = e.getBoundingClientRect(), top = (document.querySelector(".bar") || { offsetHeight: 0 }).offsetHeight + 8;
          if (r.top < top || r.bottom > innerHeight * 0.7) window.scrollBy({ top: r.top - Math.max(top, innerHeight * 0.3), behavior: "smooth" });
        } };
      htv.fix.hidden = true;
    }
    document.getElementById("htA").onchange = function () { save("hifzTest", { lv: lv, s: s, from: +this.value }); showHifzTest(s); };
    document.getElementById("htS").onchange = function () { save("hifzTest", { lv: lv, s: +this.value, from: 1 }); location.replace("#/hifztest/" + this.value); };
    view.querySelectorAll(".ht-lv button").forEach(function (b) { b.onclick = function () { save("hifzTest", stNext({ lv: +b.dataset.l, s: s, from: from })); showHifzTest(s); }; });
    view.querySelectorAll(".ht-bad button").forEach(function (b) { b.onclick = function () { save("hifzTest", { lv: lv, s: s, from: +b.dataset.a }); showHifzTest(s); window.scrollTo(0, 0); }; });
    if (document.getElementById("htNext")) document.getElementById("htNext").onclick = function () { goNext(); window.scrollTo(0, 0); };
    // «خلصت», or the end of the test recited by voice (htv.done): the score, every ayah on the hifz map (hifzMark: right
    // if none of its hidden words was missed) and, once the surah's last part is done, the surah itself.
    var finished = false;
    document.getElementById("htDone").onclick = function () {
      view.querySelectorAll(".ht-w:not(.shown)").forEach(function (b) { b.classList.add("shown", "ok"); });
      if (!finished) {
        finished = true;
        for (var a = from; a <= to; a++) hifzMark(s + ":" + a, !view.querySelector('.ht-w.miss[data-a="' + a + '"]'));
        asrStat("ok", hidden - missed); asrStat("bad", missed);
        var c1 = load("hifzTest", {}), q0 = c1.ss && c1.ss.s === s && c1.ss.to === from - 1 ? c1.ss : { s: s, a1: from, h: 0, m: 0 };
        c1.ss = { s: s, a1: q0.a1, to: to, h: q0.h + hidden, m: q0.m + missed };
        if (rg) c1.acc = { h: rg.acc.h + hidden, m: rg.acc.m + missed };
        save("hifzTest", c1);
      }
      var score = hidden ? Math.round((hidden - missed) / hidden * 100) : 100;
      document.getElementById("htRes").innerHTML = "<b>" + ar(score) + "٪</b> افتكرت " + ar(hidden - missed) + " من " + ar(hidden) + " كلمة" + (score >= 90 ? "، ما شاء الله" : score >= 60 ? "، محتاجة مراجعة بسيطة" : "، راجعها تاني");
      // the range's last part: the result of the whole test
      if (rg && !nx) {
        var A = load("hifzTest", {}).acc || { h: hidden, m: missed }, tot = A.h ? Math.round((A.h - A.m) / A.h * 100) : 100;
        document.getElementById("htRes").innerHTML += '<span class="ht-tot" id="htTot">نتيجة الاختبار كله: <b>' + ar(tot) + "٪</b> (افتكرت " + ar(A.h - A.m) + " من " + ar(A.h) + " كلمة)</span>";
      }
      // The last part of the surah done: the surah joins the hifz map by itself.
      // the surah joins the map as memorised only once every one of its ayat has been tested (q.hifzAyat), not when
      // just its last part was
      // 5.15b item 8: the surah's score so far in this test; from «المراجعة» it marks the surah, from «اختبار الحفظ» only once
      // the whole surah was tested
      var q1 = load("hifzTest", {}).ss || { h: hidden, m: missed, a1: from, to: to }, sp = q1.h ? Math.round((q1.h - q1.m) / q1.h * 100) : 100;
      if (rg) hzSetRev(s, sp); else if (q1.a1 === 1 && q1.to === cnt) hzSetMemo(s, sp);
      syncAlarms();
      var res = load("hifzScores", {}); res[s] = { d: todayStr(), score: sp }; save("hifzScores", res);
      lastTestSave({ k: "w", r: [s + ":" + (q1.a1 || from), s + ":" + (q1.to || to)], sc: sp, wh: q1.h, wm: q1.m });
    };
    if (carry) {
      if (!htMic) { htv.on = false; Mic.stop(); return; }
      htvSetup(carry.skip); htMic.classList.add("rec"); htMic.innerHTML = ic("astop") + " إيقاف"; htvTop();
    }
  }

  // Every button of the hifz test (page and bar) flashes green when pressed, so the reader sees it took the tap.
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".ht button, .hifz-bar button, #rdMic"); if (!b || b.classList.contains("ht-w")) return;
    b.classList.remove("tap-ok"); void b.offsetWidth; b.classList.add("tap-ok");
    setTimeout(function () { b.classList.remove("tap-ok"); }, 450);
  }, true);
  // The hifz test's voice mode (showHifzTest): heard words placed in the test's words (rLocal).
  var htv = { on: false };
  var htvPrev = window.onRecite;
  window.onRecite = function (text, kind) {
    if (!htv.on) return htvPrev(text, kind);
    if (!document.body.contains(htv.btn)) { htv.on = false; Mic.stop(); return; }
    if (kind.indexOf("state:") === 0) {
      var st = kind.slice(6);
      if (st === "busy") toast("بيجهّز الموديل…");
      else if (st === "listening") { toast("سمّع من حفظك"); if (Mic.cur === "nv") ctcReady(); }
      else { if (st === "noperm") toast("محتاج إذن الميكروفون"); else if (st.indexOf("error") === 0) toast("المايك وقف (" + st.slice(6) + ")، دوس عليه تاني"); htv.on = false; htv.btn.classList.remove("rec"); htv.btn.innerHTML = ic("mic") + " سمّع بالصوت"; }
      return;
    }
    // Each piece of speech is placed anywhere in the test's words (rLocal): on from where the last one ended, or where
    // the reader started, went back or repeated. While a piece is still being heard only right words show (green), so
    // nothing turns red ahead of the reader; at its end its verdicts are kept (a word read again takes the new verdict).
    var fin = kind === "final", hyp = (text || "").split("\n")[0], n = htv.sk.length;
    // the words of this piece heard before the next ayat opened (htv.more) belong to the last part: skipped
    var hw = norm(hyp).split(/\s+/).filter(Boolean), sk = htv.skip || 0, hn = hw.length;
    if (fin) htv.skip = 0;
    var r = sk >= hw.length ? null : rLocal(hw.slice(sk).map(rSkel), htv.sk, htv.ptr), disp = {};
    if (fin && !sk) ctcJudge(r, function (i) { return htv.keys[i]; });
    // the last word heard right while the piece is still going on: this part is done now, not at the pause (5.11 #12/#16)
    var endNow = !fin && r && r.v[n - 1] === 1;
    Object.keys(htv.V).forEach(function (i) { disp[i] = htv.V[i]; });
    if (r) Object.keys(r.v).forEach(function (i) { if (fin || endNow || r.v[i] === 1) disp[i] = r.v[i]; });
    for (var i = 0; i < n; i++) { var nv = i in disp ? disp[i] : null, ov = i in htv.shownV ? htv.shownV[i] : null; if (nv !== ov) htv.set(i, nv); }
    htv.shownV = disp;
    var far = htv.ptr; Object.keys(disp).forEach(function (i) { if (disp[i] === 1 && +i + 1 > far) far = +i + 1; });
    htv.follow(far);
    if (endNow) { htv.V = disp; htv.ptr = r.b; }
    if (fin) {
      htv.fix.hidden = true;
      if (r && sk) { htv.V = disp; htv.ptr = r.b; }
      else if (r) {
        htv.V = disp; htv.ptr = r.b;
        // Q3: a piece read fully right, with the model on and the reader's consent, becomes a labelled training clip.
        // A piece with red words offers «أنا قريت صح»: it turns them green and, with consent, sends the piece as a
        // "corrected" clip (the model's hard cases; the relay still checks it is roughly those words).
        var piece = { a: r.a, b: r.b, seq: window.nvSeq, hyp: hyp }, clean = true;
        for (var k = piece.a; k < piece.b; k++) if ((r.v[k] === 0 || r.v[k] === 2) && !htv.force[k]) clean = false;   // «مش متأكد» is not auto-donated
        if (clean) htvDonate(piece, "auto");
        else if (htv.ws.slice(piece.a, piece.b).some(function (e) { return e.classList.contains("miss"); })) {
          htv.fix.hidden = false;
          htv.fix.onclick = function () {
            htv.fix.hidden = true;
            for (var k = piece.a; k < piece.b; k++) { htv.force[k] = 1; htv.V[k] = 1; htv.unmiss(htv.ws[k]); }   // the reader vouched for these
            htvDonate(piece, "corrected");
          };
        }
      }
    }
    // the end reached (the very last word may be misheard or cut by the mic): the test finishes by itself
    if ((fin || endNow) && r && htv.ptr >= n - 1) {
      setTimeout(donateSend, 1000);
      // «قلب تلقائي» on and more ayat in the surah: score this part and open the next ones with the mic still on
      if (htv.more) {
        htv.carrySkip = fin ? 0 : hn; toast((htv.more() || "").split("،")[0] + " · كمّل");
        return;
      }
      htv.on = false; Mic.stop(); htv.btn.classList.remove("rec"); htv.btn.innerHTML = ic("mic") + " سمّع بالصوت";
      htv.done(); var rs = document.getElementById("htRes"); if (rs) rs.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  // window.nvSeq names the model's piece of speech this final belongs to (NvAsr), so the clip is exactly its audio.
  function htvDonate(p, kind) {
    if (Mic.cur !== "nv" || load("donate", 0) !== 1 || !window.NvBridge || !NvBridge.donate2 || p.seq == null) return;
    var w = htv.ws.slice(p.a, p.b), f = w[0].dataset, l = w[w.length - 1].dataset;
    var meta = { v: 2, text: w.map(function (e) { return e.textContent; }).join(" "), s: htv.s, a0: +f.a, w0: +f.w, a1: +l.a, w1: +l.w,
      kind: kind, hyp: p.hyp, src: "hifz", model: "nv-fc-large-pcd-v1.0", app: window.AppBridge && AppBridge.version ? AppBridge.version() : "" };
    try { NvBridge.donate2(JSON.stringify(meta), p.seq); } catch (e) {}
  }

  // ---------- 5.17 S3: اختبار المتشابهات ----------
  // A question: the opening of an ayah that has look-alikes (window.MUTASH, loaded like mutashTab) and three ways it goes
  // on: its own and those of the look-alikes after the same words. By tap or by voice (the heard words matched to each
  // choice). The answer marks the ayah right or wrong in q.hifzAyat, so wrong ones come back in S1/S2 and here (40%).
  var mtq = { n: 0, ok: 0, q: null }, mtv = { on: false };
  function mutKey(w) { var n = norm(w); return n.length > 3 ? n.replace(/^[وف]/, "") : n; }
  // letter for letter (no vowels): «وما» and «فما», «يعملون» and «تعملون» are different words here
  function mutX(w) { return norm(w); }
  function mutBuild(k) {
    var p = k.split(":").map(Number), T = Q.t[p[0] - 1][p[1] - 1].split(" "), TX = T.map(mutX), TK = T.map(mutKey), seen = {};
    var mine = {}; TK.forEach(function (w) { mine[w] = 1; });
    var nextOf = function (v) { return v[1] < Q.s[v[0] - 1][3] ? [v[0], v[1] + 1] : null; };
    var cs = (MUTASH[k] || []).map(function (ps) { return ps[0]; }).filter(function (v) { var x = v[0] + ":" + v[1]; if (x === k || seen[x]) return false; seen[x] = 1; return true; }).map(function (v) {
      var W = Q.t[v[0] - 1][v[1] - 1].split(" "), WX = W.map(mutX), WK = W.map(mutKey), l = 0;
      while (l < W.length && l < T.length && WX[l] === TX[l]) l++;
      // wording shared with the ayah (its words found in this one): the test is about verbal look-alikes
      var ov = WK.filter(function (w) { return mine[w]; }).length / Math.max(WK.length, TK.length);
      return { v: v, W: W, l: l, ov: ov, same: WX.join(" ") === TX.join(" "), r: Math.random() };
    });
    // 5.17b: look-alikes in the same surah (الأعراف ٦١ «ضلالة» / ٦٧ «سفاهة») are told apart by the ayah before, shown
    // above the question, so one whose ayah before is the same as this one's is left out; an ayah 1 has none, so all
    // of its same-surah look-alikes are. Only close wording counts (40% of the words or more).
    var ctxK = function (s, a) { return a > 1 ? Q.t[s - 1][a - 2].split(" ").map(mutX).join(" ") : ""; }, myCtx = ctxK(p[0], p[1]);
    cs = cs.filter(function (c) { return c.ov >= 0.4 && (c.v[0] !== p[0] || (p[1] > 1 && ctxK(c.v[0], c.v[1]) !== myCtx)); });
    if (!cs.length) return null;
    var list, pre, after = false;
    if (cs.some(function (c) { return c.same; })) {
      // an ayah repeated word for word (فبأي آلاء ربكما تكذبان): only what comes after tells them apart, so the question
      // is the whole ayah and the choices are the ayah after it in each place
      var nT = nextOf(p); if (!nT) return null;
      after = true; pre = T.length;
      list = [{ v: nT, W: Q.t[nT[0] - 1][nT[1] - 1].split(" "), ok: 1 }];
      cs.filter(function (c) { return c.same; }).sort(function (x, y) { return x.r - y.r; }).forEach(function (c) { var nv = nextOf(c.v); if (nv) list.push({ v: nv, W: Q.t[nv[0] - 1][nv[1] - 1].split(" "), ok: 0 }); });
    } else {
      cs.sort(function (x, y) { return y.l - x.l || y.ov - x.ov || x.r - y.r; });
      // the opening stops before the first word (even one letter) that differs from the closest look-alike
      pre = Math.min(Math.max(cs[0].l, 2), T.length - 1);
      if (pre < 1) return null;
      list = [{ v: p, W: T.slice(pre), ok: 1 }];
      cs.forEach(function (c) { if (c.W.length > pre) list.push({ v: c.v, W: c.W.slice(pre), ok: 0 }); });
    }
    var full = function (W) { return W.map(mutX).join(" "); };
    var opts = [], have = {};
    list.forEach(function (o) { if (opts.length >= 3 || !o.W.length) return; var f = full(o.W); if (have[f]) return; have[f] = 1; opts.push(o); });
    if (opts.length < 2 || !opts[0].ok) return null;
    // each choice is cut to the fewest words (4 or more) that still tell them apart
    var mx = Math.max.apply(null, opts.map(function (o) { return o.W.length; })), n = Math.min(4, mx);
    for (; n < mx; n++) { var t = {}, dup = false; opts.forEach(function (o) { var f = full(o.W.slice(0, n)); if (t[f]) dup = true; t[f] = 1; }); if (!dup) break; }
    opts.forEach(function (o) { o.txt = o.W.slice(0, n).join(" ") + (o.W.length > n ? " …" : ""); o.cmp = o.W.slice(0, n).map(rSkel); });
    // the telling words, marked once answered: a word is marked where another choice has a different word (letter for
    // letter) in the same place, so a changed letter and a changed order (والصابئين والنصارى / والنصارى والصابئين) both show
    opts.forEach(function (o) {
      o.marked = o.W.slice(0, n).map(function (w, i) { var d = opts.some(function (x) { return x !== o && (!x.W[i] || i >= n || mutX(x.W[i]) !== mutX(w)); }); return d ? "<mark>" + esc(w) + "</mark>" : esc(w); }).join(" ") + (o.W.length > n ? " …" : "");
      // a choice that is the start of a longer one (الشعراء ٩٠ / ق ٣١): where it ends is what tells it apart
      if (o.marked.indexOf("<mark>") < 0) o.marked += ' <mark class="mt-end">(آخر الآية)</mark>';
    });
    for (var i = opts.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = opts[i]; opts[i] = opts[j]; opts[j] = x; }
    return { k: k, s: p[0], a: p[1], pre: T.slice(0, pre).join(" "), after: after, opts: opts, ctx: p[1] > 1 ? Q.t[p[0] - 1][p[1] - 2] : "" };
  }
  if (window.QA_NOFS) window.QA_mut = mutBuild;   // the UI checks (tools/qa/ui.js) build every question
  function mutPool() {
    var memo = load("mutAll", 0) ? {} : hifzLogData(), all = Object.keys(MUTASH);
    var keys = Object.keys(memo).length ? all.filter(function (k) { return memo[k.split(":")[0]]; }) : all;
    return keys.length ? keys : all;
  }
  function mutNext() {
    var keys = mutPool(), HA = load("hifzAyat", {}), bad = keys.filter(function (k) { return HA[k] && HA[k].ok === 0; });
    for (var t = 0; t < 60; t++) { var L = bad.length && Math.random() < 0.4 ? bad : keys, q = mutBuild(L[Math.floor(Math.random() * L.length)]); if (q) return q; }
    return null;
  }
  // how much of a choice was said: the longest run of its words heard in order (LCS), over its length
  function mutHit(hw, cw) {
    var m = hw.length, n = cw.length, D = []; if (!n) return 0;
    for (var i = 0; i <= m; i++) { D.push([]); for (var j = 0; j <= n; j++) D[i].push(!i || !j ? 0 : hw[i - 1] === cw[j - 1] ? D[i - 1][j - 1] + 1 : Math.max(D[i - 1][j], D[i][j - 1])); }
    return D[m][n] / n;
  }
  function mtvOff() { if (!mtv.on) return; mtv.on = false; Mic.stop(); if (mtv.btn) { mtv.btn.classList.remove("rec"); mtv.btn.innerHTML = ic("mic") + " سمّع التكملة"; } }
  function showMutashTest() {
    titleEl.textContent = "اختبار المتشابهات";
    btnBack.hidden = false;
    if (!window.MUTASH) { view.innerHTML = '<p class="hint">جارٍ التحميل…</p>'; need("mut", "mutashabihat.js", function () { if (window.MUTASH && location.hash.indexOf("#/mutash") === 0) showMutashTest(); }); return; }
    mtvOff();
    if (!mtq.q || mtq.q.done) mtq.q = mutNext();
    var q = mtq.q, all = !!load("mutAll", 0), memoN = Object.keys(hifzLogData()).length;
    view.innerHTML = '<div class="ht mt">' + hzNav("") +
      '<div class="z-sort mt-scope"><button data-m="0"' + (all ? "" : ' class="on"') + '>من محفوظي</button><button data-m="1"' + (all ? ' class="on"' : "") + ">كل القرآن</button></div>" +
      (!all && !memoN ? '<p class="hint">لسه مفيش سور محفوظة، فالأسئلة من القرآن كله.</p>' : "") +
      '<p class="hint">كمّل الآية دي صح: اختار التكملة، أو سمّعها بالصوت. <b class="mt-score" id="mtScore">صح ' + ar(mtq.ok) + " من " + ar(mtq.n) + "</b></p>" +
      (q ? '<div class="mt-q"><span class="mut-ref" id="mtRef">سورة ' + Q.s[q.s - 1][0] + " · الآية " + ar(q.a) + "</span>" + (q.ctx ? '<div class="ay-text mt-ctx" lang="ar">' + esc(q.ctx) + ' <span class="ayah-no">﴿' + ar(q.a - 1) + "﴾</span></div>" : "") + '<div class="ay-text mt-pre" lang="ar">' + esc(q.pre) + (q.after ? ' <span class="ayah-no">﴿' + ar(q.a) + '﴾</span></div><p class="hint mt-aft">الآية دي متكررة بنصها، إيه الآية اللي بعدها هنا؟</p></div>' : " …</div></div>") + '<div class="mt-opts">' +
        q.opts.map(function (o, i) { return '<button class="mt-ch" data-i="' + i + '"><span class="ay-text" lang="ar">' + esc(o.txt) + '</span><small class="mt-src" hidden>سورة ' + Q.s[o.v[0] - 1][0] + " · الآية " + ar(o.v[1]) + "</small></button>"; }).join("") + "</div>" +
        (window.ReciteBridge ? '<button class="continue ht-mic" id="mtMic">' + ic("mic") + " سمّع التكملة</button>" : "") +
        '<p class="ht-res" id="mtRes"></p><div class="ht-foot"><button class="continue" id="mtNext">' + ic("anext") + ' السؤال اللي بعده</button><button class="continue" id="mtOpen" data-s="' + q.s + '" data-a="' + q.a + '">' + ic("book") + " افتح الآية</button></div>"
        : '<p class="hint">مفيش أسئلة هنا.</p>') + "</div>";
    view.querySelectorAll(".mt-scope button").forEach(function (b) { b.onclick = function () { save("mutAll", +b.dataset.m); mtq.q = null; showMutashTest(); }; });
    if (!q) return;
    var answered = false;
    function pick(i) {
      if (answered) return; answered = true; q.done = 1; mtvOff();
      var o = q.opts[i], ok = !!o.ok;
      mtq.n++; if (ok) mtq.ok++;
      hifzMark(q.k, ok);
      view.querySelectorAll(".mt-ch").forEach(function (b, j) { b.disabled = true; b.querySelector(".mt-src").hidden = false; b.querySelector(".ay-text").innerHTML = q.opts[j].marked; if (q.opts[j].ok) b.classList.add("ok"); else if (j === i) b.classList.add("miss"); });
      document.getElementById("mtScore").textContent = "صح " + ar(mtq.ok) + " من " + ar(mtq.n);
      document.getElementById("mtRes").innerHTML = (ok ? "<b>صح</b>ما شاء الله" : "<b>غلط</b>دي تكملة سورة " + Q.s[o.v[0] - 1][0] + " · الآية " + ar(o.v[1])) +
        '<span class="ay-text mt-full" lang="ar">' + esc(Q.t[q.s - 1][q.a - 1]) + ' <span class="ayah-no">﴿' + ar(q.a) + "﴾</span></span>";
    }
    view.querySelectorAll(".mt-ch").forEach(function (b) { b.onclick = function () { pick(+b.dataset.i); }; });
    document.getElementById("mtNext").onclick = function () { mtq.q = mutNext(); showMutashTest(); window.scrollTo(0, 0); };
    document.getElementById("mtOpen").onclick = function () { if (mode === "pages") openAyahPage(q.s, q.a, ""); else location.hash = "#/s/" + q.s + "/" + q.a; };
    var mb = document.getElementById("mtMic");
    if (mb) mb.onclick = function () {
      if (mtv.on) { var L0 = mtv.last; mtvOff(); if (L0 && L0.ok) pick(L0.best); else toast("مش واضح، جرّب تاني"); return; }
      if (answered) return;
      if (!micGate(function () { mb.click(); })) return;
      reciteStop(); player.stop(); if (htv.on) { htv.on = false; Mic.stop(); }
      mtv = { on: true, btn: mb, pick: pick, q: q, last: null };
      Mic.start(); mb.classList.add("rec"); mb.innerHTML = ic("astop") + " إيقاف";
    };
  }
  var mtvPrev = window.onRecite;
  window.onRecite = function (text, kind) {
    if (!mtv.on) return mtvPrev(text, kind);
    if (!document.body.contains(mtv.btn)) { mtv.on = false; Mic.stop(); return; }
    if (kind.indexOf("state:") === 0) {
      var st = kind.slice(6);
      if (st === "busy") toast("بيجهّز الموديل…");
      else if (st === "listening") toast("سمّع التكملة");
      else { if (st === "noperm") toast("محتاج إذن الميكروفون"); mtvOff(); }
      return;
    }
    if (kind !== "final" && kind !== "partial") return;
    var hw = norm((text || "").split("\n")[0]).split(/\s+/).filter(Boolean).map(rSkel);
    if (!hw.length) return;
    var sc = mtv.q.opts.map(function (o) { return mutHit(hw, o.cmp); }), best = 0;
    sc.forEach(function (x, i) { if (x > sc[best]) best = i; });
    var tie = sc.filter(function (x) { return x === sc[best]; }).length > 1, ok = sc[best] >= 0.5 && !tie;
    mtv.last = { best: best, ok: ok };
    // a partial decides as soon as one whole choice was heard (fast); a final once one choice is clearly ahead
    if (kind === "partial") { if (sc[best] === 1 && !tie) mtv.pick(best); return; }
    if (!ok) return toast("مش واضح، كمّل التكملة");   // the opening only, or too little heard: keep listening
    mtv.pick(best);
  };

  // ---------- 5.17 S5: التلقين ----------
  // One ayah at a time: (1) the reciter reads it N times, the text hidden; (2) the text shows and the reader reads it;
  // (3) it hides and the reader recites it (by voice through the hifz test's matcher htv, or tapping forgotten words);
  // then the next ayah. Each ayah's result goes to q.hifzAyat. State: q.talqin {s, a, n}.
  function showTalqin(s0) {
    titleEl.textContent = "التلقين";
    btnBack.hidden = false;
    if (htv.on) { htv.on = false; Mic.stop(); }
    var st = load("talqin", { s: 1, a: 1, n: 3 }), s = s0 || st.s || 1;
    var cnt = Q.s[s - 1][3], a = st.s === s && st.a >= 1 && st.a <= cnt ? st.a : 1, N = st.n || 3, step = st.step || 1;
    var b = st.s === s && st.b >= a ? Math.min(cnt, st.b, a + 19) : a;   // the group's last ayah (one ayah by default, 20 at most)
    save("talqin", { s: s, a: a, b: b, n: N });
    var opts = ""; for (var i = 1; i <= 114; i++) opts += '<option value="' + i + '"' + (i === s ? " selected" : "") + ">" + ar(i) + ". " + Q.s[i - 1][0] + "</option>";
    var aopts = ""; for (var j = 1; j <= cnt; j++) aopts += '<option value="' + j + '"' + (j === a ? " selected" : "") + ">من الآية " + ar(j) + "</option>";
    var bopts = ""; for (var j2 = a; j2 <= Math.min(cnt, a + 19); j2++) bopts += '<option value="' + j2 + '"' + (j2 === b ? " selected" : "") + ">لحد الآية " + ar(j2) + "</option>";
    var words = "";
    for (var y = a; y <= b; y++) words += Q.t[s - 1][y - 1].split(" ").map(function (w, k) {
      if (!/[ء-يٱ]/.test(w)) return w;
      return '<button class="ht-w" data-a="' + y + '" data-w="' + k + '">' + w + "</button>";
    }).join(" ") + ' <span class="ayah-no">﴿' + ar(y) + "﴾</span> ";
    view.innerHTML = '<div class="ht tq">' + hzNav("") + '<div class="ht-top"><div class="ht-pick"><select class="input" id="tqS" aria-label="السورة">' + opts + '</select><select class="input" id="tqA" aria-label="من الآية">' + aopts + '</select><select class="input" id="tqB" aria-label="لحد الآية">' + bopts + "</select></div>" +
      '<div class="z-sort tq-n"><span>القارئ يقرا</span>' + [1, 3, 5, 7].map(function (x) { return '<button data-n="' + x + '"' + (x === N ? ' class="on"' : "") + ">" + ar(x) + (x === 1 ? " مرة" : " مرات") + "</button>"; }).join("") + "</div></div>" +
      '<ol class="tq-steps"><li data-st="1">اسمع</li><li data-st="2">اقرا</li><li data-st="3">سمّع</li></ol>' +
      '<p class="hint" id="tqHint"></p><div class="ht-text tq-text" id="tqText" lang="ar">' + words + "</div>" +
      '<div class="ht-ibs tq-btns" id="tqBtns"></div>' +
      '<button class="continue" id="htFix" hidden>' + ic("check") + " أنا قريت صح</button>" +
      '<p class="ht-res" id="tqRes"></p></div>';
    var T = document.getElementById("tqText"), B = document.getElementById("tqBtns"), H = document.getElementById("tqHint"), missed = 0, done = false;
    var ws = [].slice.call(T.querySelectorAll(".ht-w"));
    // the next group, the same size, in this surah (or the next surah from its first ayah)
    function nextAy() { var k = b - a, n = b < cnt ? [s, b + 1, Math.min(cnt, b + 1 + k)] : s < 114 ? [s + 1, 1, Math.min(Q.s[s][3], 1 + k)] : null; if (!n) return toast("ختمت القرآن، ما شاء الله"); save("talqin", { s: n[0], a: n[1], b: n[2], n: N, step: 1, auto: 1 }); if (n[0] !== s) history.replaceState(null, "", "#/talqin/" + n[0]); showTalqin(n[0]); window.scrollTo(0, 0); }
    function listen() { player.playRange(s, a, b, N, function () { if (document.body.contains(T) && step === 1) go(2); }); }
    function go(k) {
      step = k; htvOff();
      view.querySelectorAll(".tq-steps li").forEach(function (li) { li.classList.toggle("on", +li.dataset.st === k); li.classList.toggle("done", +li.dataset.st < k); });
      T.classList.toggle("tq-blur", k === 1); T.classList.toggle("tq-hide", k === 3);
      ws.forEach(function (e) { e.classList.remove("shown", "ok", "miss", "uns"); delete e.dataset.tap; if (k !== 3) e.classList.add("shown"); });
      missed = 0; done = false; document.getElementById("tqRes").innerHTML = "";
      if (k === 1) {
        H.textContent = (a === b ? "اسمع القارئ وهو بيقرا الآية " : "اسمع القارئ وهو بيقرا الآيات ") + ar(N) + (N === 1 ? " مرة" : " مرات") + (a === b ? "، والآية مستخبية." : "، والآيات مستخبية.");
        B.innerHTML = '<button class="continue" id="tqPlay">' + ic("aplay") + "<span>اسمع</span></button><button class=\"continue\" id=\"tqSkip\">" + ic("anext") + "<span>اقراها</span></button>";
        document.getElementById("tqPlay").onclick = listen;
        document.getElementById("tqSkip").onclick = function () { player.stop(); go(2); };
      } else if (k === 2) {
        H.textContent = "اقرا الآية وانت شايفها، ولما تبقى جاهز خبّيها وسمّعها.";
        B.innerHTML = '<button class="continue" id="tqAgain">' + ic("rep") + "<span>اسمع تاني</span></button><button class=\"continue\" id=\"tqHide\">" + ic("eyeoff") + "<span>خبّيها وسمّع</span></button>";
        document.getElementById("tqAgain").onclick = function () { player.playRange(s, a, b, 1); };
        document.getElementById("tqHide").onclick = function () { player.stop(); go(3); };
      } else {
        H.textContent = "سمّع الآية من حفظك. لو نسيت كلمة اضغط عليها عشان تظهر، وفي الآخر اضغط «خلصت».";
        B.innerHTML = (window.ReciteBridge ? '<button class="continue ht-mic" id="tqMic">' + ic("mic") + " سمّع بالصوت</button>" : "") +
          '<button class="continue" id="tqDone">' + ic("check") + "<span>خلصت</span></button><button class=\"continue\" id=\"tqRe\">" + ic("rep") + "<span>من الأول</span></button>";
        document.getElementById("tqDone").onclick = finish;
        document.getElementById("tqRe").onclick = function () { go(1); listen(); };
        var m = document.getElementById("tqMic");
        if (m) m.onclick = function () {
          if (htv.on) return htvOff();
          if (!micGate(function () { m.click(); })) return;
          reciteStop(); player.stop(); mtvOff();
          htvOn(m); Mic.start(); m.classList.add("rec"); m.innerHTML = ic("astop") + " إيقاف";
        };
      }
    }
    ws.forEach(function (b) { b.onclick = function () { if (step !== 3 || done || b.classList.contains("shown")) return; b.classList.add("shown", "miss"); b.dataset.tap = 1; missed++; }; });
    function finish() {
      if (done) return; done = true; htvOff();
      ws.forEach(function (b) { if (!b.classList.contains("shown")) b.classList.add("shown", "ok"); });
      var n = ws.length, sc = n ? Math.round((n - missed) / n * 100) : 100;
      for (var z = a; z <= b; z++) hifzMark(s + ":" + z, !T.querySelector('.ht-w.miss[data-a="' + z + '"]'));
      asrStat("ok", n - missed); asrStat("bad", missed);
      document.getElementById("tqRes").innerHTML = "<b>" + ar(sc) + "٪</b> " + (missed ? "نسيت " + ar(missed) + " من " + ar(n) + " كلمة" : "ما شاء الله، صح كلها") +
        '<span class="tq-go"><button class="continue" id="tqNext">' + ic("anext") + (a === b ? " الآية اللي بعدها" : " الآيات اللي بعدها") + '</button><button class="continue" id="tqRep">' + ic("rep") + (a === b ? " عيد الآية" : " عيد الآيات") + "</button></span>";
      document.getElementById("tqNext").onclick = nextAy;
      document.getElementById("tqRep").onclick = function () { go(1); listen(); };
    }
    function htvOff() { if (!htv.on) return; htv.on = false; Mic.stop(); var m = document.getElementById("tqMic"); if (m) { m.classList.remove("rec"); m.innerHTML = ic("mic") + " سمّع بالصوت"; } }
    // the hifz test's voice path (window.onRecite › htv): the same matcher, verdict colours, «أنا قريت صح» and donation
    function htvOn(btn) {
      var nth = {}, hk = ws.map(function (e) { var y = e.dataset.a; nth[y] = nth[y] || 0; return s + ":" + y + ":" + nth[y]++; });
      htv = { on: true, ws: ws, sk: ws.map(function (e) { return rSkel(e.textContent); }), keys: hk, ptr: 0, V: {}, shownV: {}, force: {}, skip: 0, more: null,
        set: function (i, v) {
          var e = ws[i]; if (e.dataset.tap) return;
          if (htv.force[i]) v = 1;
          var miss = e.classList.contains("miss");
          e.classList.remove("uns");
          if (v === null) { if (miss) missed--; e.classList.remove("shown", "ok", "miss"); }
          else if (v === 1) { if (miss) missed--; e.classList.remove("miss"); e.classList.add("shown", "ok"); }
          else if (v === 2) { if (miss) missed--; e.classList.remove("miss", "ok"); e.classList.add("shown", "uns"); }
          else if (!miss) { missed++; e.classList.remove("ok"); e.classList.add("shown", "miss"); }
        },
        unmiss: function (e) { if (e.classList.contains("miss")) { e.classList.remove("miss"); e.classList.add("ok"); missed--; } },
        btn: btn, s: s, fix: document.getElementById("htFix"), done: finish,
        follow: function (at) {   // a long group: the next word to say stays in view
          var e = ws[Math.min(ws.length - 1, at)]; if (!e) return;
          var r = e.getBoundingClientRect(), top = (document.querySelector(".bar") || { offsetHeight: 0 }).offsetHeight + 8;
          if (r.top < top || r.bottom > innerHeight * 0.7) window.scrollBy({ top: r.top - Math.max(top, innerHeight * 0.3), behavior: "smooth" });
        } };
      htv.fix.hidden = true;
    }
    document.getElementById("tqS").onchange = function () { save("talqin", { s: +this.value, a: 1, n: N }); location.replace("#/talqin/" + this.value); };
    document.getElementById("tqA").onchange = function () { player.stop(); var a2 = +this.value; save("talqin", { s: s, a: a2, b: Math.min(cnt, a2 + (b - a)), n: N }); showTalqin(s); };
    document.getElementById("tqB").onchange = function () { player.stop(); save("talqin", { s: s, a: a, b: +this.value, n: N }); showTalqin(s); };
    view.querySelectorAll(".tq-n button").forEach(function (bt) { bt.onclick = function () { N = +bt.dataset.n; save("talqin", { s: s, a: a, b: b, n: N }); view.querySelectorAll(".tq-n button").forEach(function (x) { x.classList.toggle("on", x === bt); }); if (step === 1) go(1); }; });
    go(1);
    if (st.auto) listen();   // the next ayah starts with the reciter by itself
  }

  // ---------- السبحة ----------
  // A free counter: tap anywhere on the big circle. Each phrase keeps its own count; an optional target buzzes when reached.
  var TASBIH = ["سُبْحَانَ اللَّهِ", "الْحَمْدُ لِلَّهِ", "اللَّهُ أَكْبَرُ", "لَا إِلَهَ إِلَّا اللَّهُ", "أَسْتَغْفِرُ اللَّهَ",
    "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ"];
  function showTasbih() {
    titleEl.textContent = "السبحة";
    btnBack.hidden = false;
    var st = load("tasbih", { i: 0, c: {}, goal: 33, total: 0 });
    // The reader's own phrases follow the ready ones (st.mine), and the target can be any number typed in.
    st.mine = st.mine || [];
    var ALL = TASBIH.concat(st.mine); if (st.i >= ALL.length) st.i = 0;
    function cnt() { return st.c[st.i] || 0; }
    var GOALS = [33, 100, 1000, 0]; if (st.goal && GOALS.indexOf(st.goal) < 0) GOALS.splice(3, 0, st.goal);
    view.innerHTML = '<div class="tsb">' +
      '<div class="tsb-ph">' + ALL.map(function (t, i) { return '<button data-i="' + i + '">' + esc(t) + (i >= TASBIH.length ? ' <i class="tsb-x" data-x="' + i + '" aria-label="حذف">×</i>' : "") + "</button>"; }).join("") +
      '<button id="tsbAdd" class="tsb-add">+ ذكر من عندك</button></div>' +
      '<div class="z-sort tsb-goal"><span>الهدف</span>' + GOALS.map(function (g) { return '<button data-g="' + g + '">' + (g ? ar(g) : "بلا حد") + "</button>"; }).join("") + '<button id="tsbGoal">عدد…</button></div>' +
      '<button class="tsb-btn" id="tsbBtn" aria-label="سبّح"><svg viewBox="0 0 100 100" class="tsb-ring"><circle cx="50" cy="50" r="45"/><circle cx="50" cy="50" r="45" id="tsbArc"/></svg>' +
      '<span class="tsb-txt" id="tsbTxt"></span><b id="tsbN"></b><small id="tsbOf"></small></button>' +
      '<div class="tsb-foot"><span id="tsbTot"></span><button class="continue" id="tsbReset">' + ic("rep") + "تصفير</button></div></div>";
    var btn = document.getElementById("tsbBtn"), arc = document.getElementById("tsbArc");
    function paint() {
      save("tasbih", st);
      view.querySelectorAll(".tsb-ph button").forEach(function (b) { b.classList.toggle("on", +b.dataset.i === st.i); });
      view.querySelectorAll(".tsb-goal button").forEach(function (b) { b.classList.toggle("on", +b.dataset.g === st.goal); });
      var n = cnt();
      document.getElementById("tsbTxt").textContent = ALL[st.i];
      document.getElementById("tsbN").textContent = ar(n);
      document.getElementById("tsbOf").textContent = st.goal ? "من " + ar(st.goal) + (n >= st.goal ? " ✓" : "") : "";
      document.getElementById("tsbTot").textContent = "المجموع كله: " + ar(st.total);
      var f = st.goal ? Math.min(1, n / st.goal) : (n % 100) / 100;
      arc.style.strokeDasharray = (f * 282.7) + " 283";
      btn.classList.toggle("done", !!st.goal && n >= st.goal);
    }
    view.querySelectorAll(".tsb-ph button[data-i]").forEach(function (b) { b.onclick = function (e) {
      var x = e.target.closest(".tsb-x");
      if (x) {
        var k = +x.dataset.x; if (!confirm("تحذف «" + ALL[k] + "»؟")) return;
        st.mine.splice(k - TASBIH.length, 1);
        var c = {}; Object.keys(st.c).forEach(function (j) { j = +j; if (j < k) c[j] = st.c[j]; else if (j > k) c[j - 1] = st.c[j]; }); st.c = c;   // counts follow their phrases
        st.i = st.i === k ? 0 : st.i > k ? st.i - 1 : st.i; save("tasbih", st); showTasbih(); return;
      }
      st.i = +b.dataset.i; paint(); }; });
    document.getElementById("tsbAdd").onclick = function () {
      var t = (prompt("اكتب الذكر") || "").trim(); if (!t) return;
      st.mine.push(t.slice(0, 120)); st.i = TASBIH.length + st.mine.length - 1; save("tasbih", st); showTasbih();
    };
    document.getElementById("tsbGoal").onclick = function () {
      var v = prompt("العدد اللي عايز توصله", st.goal || ""); if (v === null) return;
      v = parseInt(String(v).replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }), 10);
      if (!(v > 0 && v <= 100000)) return toast("اكتب رقم من ١ لـ ١٠٠٠٠٠");
      st.goal = v; save("tasbih", st); showTasbih();
    };
    view.querySelectorAll(".tsb-goal button[data-g]").forEach(function (b) { b.onclick = function () { st.goal = +b.dataset.g; paint(); }; });
    btn.onclick = function () {
      var n = st.c[st.i] = cnt() + 1; st.total++;
      // A longer buzz on reaching the target (even with the tap buzz turned off, since it is the point of a sebha).
      var hit = st.goal && n === st.goal, lv = Math.max(1, hapticLevel());
      // Target reached: one long buzz, so it is felt as different from a normal count.
      try {
        if (hit && window.AppBridge && AppBridge.buzzPattern) AppBridge.buzzPattern("700");
        else if (window.AppBridge && AppBridge.buzz) AppBridge.buzz(lv);
        else if (navigator.vibrate) navigator.vibrate(hit ? 700 : 15);
      } catch (e) {}
      btn.classList.remove("pulse"); void btn.offsetWidth; btn.classList.add("pulse");
      paint();
    };
    document.getElementById("tsbReset").onclick = function () { st.c[st.i] = 0; paint(); };
    paint();
  }

  // ---------- اتجاه القبلة ----------
  var KAABA = [21.422487, 39.826206];
  var CITIES = [
    ["القاهرة", 30.0444, 31.2357], ["الجيزة", 30.0131, 31.2089], ["الإسكندرية", 31.2001, 29.9187], ["المنصورة", 31.0409, 31.3785],
    ["طنطا", 30.7865, 31.0004], ["الزقازيق", 30.5877, 31.502], ["بنها", 30.4659, 31.1848], ["شبين الكوم", 30.5594, 31.0124],
    ["دمنهور", 31.0341, 30.4682], ["كفر الشيخ", 31.1107, 30.9388], ["دمياط", 31.4165, 31.8133], ["بورسعيد", 31.2653, 32.3019],
    ["الإسماعيلية", 30.5965, 32.2715], ["السويس", 29.9668, 32.5498], ["الفيوم", 29.3084, 30.8428], ["بني سويف", 29.0661, 31.0994],
    ["المنيا", 28.0871, 30.7618], ["أسيوط", 27.1809, 31.1837], ["سوهاج", 26.5591, 31.6957], ["قنا", 26.1551, 32.716],
    ["الأقصر", 25.6872, 32.6396], ["أسوان", 24.0889, 32.8998], ["الغردقة", 27.2579, 33.8116], ["شرم الشيخ", 27.9158, 34.33],
    ["مرسى مطروح", 31.3543, 27.2373], ["العريش", 31.1316, 33.7984],
    ["مكة المكرمة", 21.3891, 39.8579], ["المدينة المنورة", 24.5247, 39.5692], ["الرياض", 24.7136, 46.6753], ["جدة", 21.4858, 39.1925],
    ["الدمام", 26.4207, 50.0888], ["دبي", 25.2048, 55.2708], ["أبوظبي", 24.4539, 54.3773], ["الدوحة", 25.2854, 51.531],
    ["الكويت", 29.3759, 47.9774], ["المنامة", 26.2285, 50.586], ["مسقط", 23.588, 58.3829], ["صنعاء", 15.3694, 44.191],
    ["عمّان", 31.9454, 35.9284], ["القدس", 31.7683, 35.2137], ["دمشق", 33.5138, 36.2765], ["بيروت", 33.8938, 35.5018],
    ["بغداد", 33.3152, 44.3661], ["الخرطوم", 15.5007, 32.5599], ["طرابلس", 32.8872, 13.1913], ["تونس", 36.8065, 10.1815],
    ["الجزائر", 36.7538, 3.0588], ["الرباط", 34.0209, -6.8416], ["الدار البيضاء", 33.5731, -7.5898], ["نواكشوط", 18.0735, -15.9582],
    ["إسطنبول", 41.0082, 28.9784], ["لندن", 51.5074, -0.1278], ["باريس", 48.8566, 2.3522], ["برلين", 52.52, 13.405],
    ["روما", 41.9028, 12.4964], ["نيويورك", 40.7128, -74.006], ["تورنتو", 43.6532, -79.3832], ["كوالالمبور", 3.139, 101.6869],
    ["جاكرتا", -6.2088, 106.8456], ["كراتشي", 24.8607, 67.0011]
  ];
  function qiblaBearing(lat, lon) {
    var r = Math.PI / 180, f1 = lat * r, f2 = KAABA[0] * r, dl = (KAABA[1] - lon) * r;
    var y = Math.sin(dl), x = Math.cos(f1) * Math.tan(f2) - Math.sin(f1) * Math.cos(dl);
    return (Math.atan2(y, x) / r + 360) % 360;
  }
  function kaabaKm(lat, lon) {
    var r = Math.PI / 180, a = Math.sin((KAABA[0] - lat) * r / 2), b = Math.sin((KAABA[1] - lon) * r / 2);
    return 2 * 6371 * Math.asin(Math.sqrt(a * a + Math.cos(lat * r) * Math.cos(KAABA[0] * r) * b * b));
  }
  var stopQibla = null;
  function showQibla() {
    titleEl.textContent = "اتجاه القبلة";
    btnBack.hidden = false;
    var ticks = "";
    for (var d = 0; d < 360; d += 15) ticks += '<i style="transform:rotate(' + d + 'deg)"' + (d % 90 ? "" : ' class="major"') + "></i>";
    var opts = '<option value="">اختر مدينة…</option>';
    CITIES.forEach(function (c, i) { opts += '<option value="' + i + '">' + c[0] + "</option>"; });
    view.innerHTML = '<div class="qibla">' +
      '<p class="q-status" id="qStatus">جارٍ تحديد موقعك…</p>' +
      '<div class="compass" id="qCompass"><div class="dial" id="qDial">' + ticks +
      '<span class="cd n">ش</span><span class="cd e">ق</span><span class="cd s">ج</span><span class="cd w">غ</span>' +
      '<div class="q-needle" id="qNeedle"><span class="kaaba">🕋\uFE0E</span></div></div><div class="q-top"></div></div>' +
      '<p class="q-angle" id="qAngle"></p><p class="hint q-hint" id="qHint"></p>' +
      '<div class="q-loc"><button class="continue" id="qGps">' + ic("pin") + ' استخدم موقعي الحالي</button>' +
      '<select class="input" id="qCity">' + opts + "</select></div>" +
      '<button class="continue q-pr" id="qPrayer">' + ic("clock") + " مواقيت الصلاة لهذا الموقع</button></div>";
    var status = document.getElementById("qStatus"), dial = document.getElementById("qDial"), needle = document.getElementById("qNeedle");
    var angleEl = document.getElementById("qAngle"), hint = document.getElementById("qHint"), compass = document.getElementById("qCompass");
    var bearing = null, heading = null, shown = 0, buzzed = false, gotHeading = false;
    function setLocation(lat, lon, label) {
      bearing = qiblaBearing(lat, lon);
      save("qiblaLoc", [lat, lon, label || ""]); syncAlarms();
      try { if (window.QiblaBridge && QiblaBridge.setPlace) QiblaBridge.setPlace(lat, lon); } catch (e) {}
      needle.style.transform = "rotate(" + bearing + "deg)";
      angleEl.textContent = "القبلة على " + ar(Math.round(bearing)) + "° من الشمال · المسافة إلى الكعبة " + ar(Math.round(kaabaKm(lat, lon)).toLocaleString("en")) + " كم";
      status.textContent = label ? "الموقع: " + label : "الموقع: " + ar(lat.toFixed(2)) + "، " + ar(lon.toFixed(2));
      paint();
    }
    function paint() {
      if (heading === null) {
        hint.textContent = bearing === null ? "" : "البوصلة غير متاحة على هذا الجهاز: وجّه علامة ش إلى الشمال، والكعبة تشير إلى القبلة.";
        return;
      }
      // Turn the dial the short way round so it never spins a full circle at north.
      var diff = ((-heading - shown) % 360 + 540) % 360 - 180; shown += diff;
      dial.style.transform = "rotate(" + shown + "deg)";
      if (bearing === null) return;
      var off = ((bearing - heading) % 360 + 540) % 360 - 180, ok = Math.abs(off) < 5;
      compass.classList.toggle("aligned", ok);
      hint.textContent = ok ? "أنت متجه إلى القبلة" : (off > 0 ? "استدر يمينًا " : "استدر يسارًا ") + ar(Math.round(Math.abs(off))) + "°";
      if (ok && !buzzed && navigator.vibrate) navigator.vibrate(80);
      buzzed = ok;
    }
    window.qiblaLocation = function (lat, lon) { setLocation(lat, lon, ""); };
    window.qiblaLocationError = function (why) {
      if (bearing !== null) { status.textContent += " (تعذّر تحديث الموقع الآن)"; return; }
      status.textContent = why === "denied" ? "لم يُسمح بالوصول إلى الموقع. اختر مدينتك من القائمة." : "تعذّر تحديد الموقع. شغّل الموقع (GPS) أو اختر مدينتك من القائمة.";
    };
    window.qiblaHeading = function (deg, lowAccuracy) {
      gotHeading = true; heading = deg; paint();
      if (lowAccuracy && bearing !== null && !compass.classList.contains("aligned")) hint.textContent += " · حرّك الهاتف على شكل ٨ لمعايرة البوصلة";
    };
    function requestGps() {
      status.textContent = "جارٍ تحديد موقعك…";
      if (window.QiblaBridge) { window.QiblaBridge.locate(); return; }
      if (!navigator.geolocation) { window.qiblaLocationError(); return; }
      navigator.geolocation.getCurrentPosition(function (p) { setLocation(p.coords.latitude, p.coords.longitude, ""); },
        function (e) { window.qiblaLocationError(e.code === 1 ? "denied" : ""); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 600000 });
    }
    document.getElementById("qGps").onclick = requestGps;
    document.getElementById("qCity").onchange = function () { var c = CITIES[+this.value]; if (c) setLocation(c[1], c[2], c[0]); };
    document.getElementById("qPrayer").onclick = function () { location.hash = "#/prayer"; };

    // Heading: the app's own sensor bridge, or the browser's compass events on the web version.
    var onOrient = null;
    if (window.QiblaBridge) window.QiblaBridge.startCompass();
    else {
      onOrient = function (e) {
        if (typeof e.webkitCompassHeading === "number") window.qiblaHeading(e.webkitCompassHeading);
        else if (e.absolute && e.alpha !== null) window.qiblaHeading((360 - e.alpha) % 360);
      };
      window.addEventListener("deviceorientationabsolute", onOrient);
      window.addEventListener("deviceorientation", onOrient);
    }
    stopQibla = function () {
      if (window.QiblaBridge) window.QiblaBridge.stopCompass();
      if (onOrient) { window.removeEventListener("deviceorientationabsolute", onOrient); window.removeEventListener("deviceorientation", onOrient); }
      window.qiblaHeading = window.qiblaLocation = window.qiblaLocationError = function () {};
      stopQibla = null;
    };
    setTimeout(function () { if (!gotHeading) paint(); }, 1500);

    var saved = load("qiblaLoc", null);
    if (saved) setLocation(saved[0], saved[1], saved[2]);
    requestGps();
  }

  // ---------- الآية: تفسير، إعراب، معاني الكلمات ----------
  // Book files (web/books, built by tools/make_books.py) are plain scripts that call QB / QW / QL, loaded on demand.
  var BK = window.BOOKS || { books: [], lex: [] }, store = {}, loading = {};
  // ---------- tajweed colours (web/tajweed-data.js, built by tools/make_tajweed.py) ----------
  // TAJWEED.q[s-1][a-1] = flat [start, end, rule, ...] offsets into Q.t; TAJWEED.rules names the rules.
  var TJ_NAMES = ["همزة الوصل", "لام شمسية", "حرف لا يُنطق", "مد عارض أو لين (٢ أو ٤ أو ٦)", "مد منفصل (٤ أو ٥)", "مد متصل (٤ أو ٥)",
    "مد لازم (٦)", "غنة", "إخفاء", "إخفاء شفوي", "إقلاب", "إدغام بغنة", "إدغام بغير غنة", "إدغام شفوي", "إدغام متجانسين", "إدغام متقاربين", "قلقلة"];
  function withTajweed(done) {
    if (window.TAJWEED) { done(); return; }
    need("tj", "tajweed-data.js", function () { if (window.TAJWEED) done(); });
  }
  // The ayah's text with each rule's letters in a coloured span; from/to cut out a stretch of it (for examples).
  function tjHtml(s, a, from, to) {
    var t = Q.t[s - 1][a - 1], sp = (window.TAJWEED && TAJWEED.q[s - 1][a - 1]) || [], out = "", at = from || 0;
    to = to === undefined ? t.length : to;
    for (var i = 0; i < sp.length; i += 3) {
      if (sp[i] < at || sp[i + 1] > to) continue;
      out += esc(t.slice(at, sp[i])) + '<span class="tj tj' + sp[i + 2] + '">' + esc(t.slice(sp[i], sp[i + 1])) + "</span>";
      at = sp[i + 1];
    }
    return out + esc(t.slice(at, to));
  }
  function ayahHtml(s, a) { return tjOn && window.TAJWEED ? tjHtml(s, a) : Q.t[s - 1][a - 1]; }

  window.QU = function (u) { store.usul = u; };
  window.QB = function (id, s, k, rows) { store["b/" + id + "/" + s + "-" + k] = rows; };
  window.QW = function (s, d) { store["w/" + s] = d; };
  window.QL = function (id, c, d) { store["l/" + id + "/" + c] = d; };
  function need(key, src, done) {
    if (store[key]) { done(store[key]); return; }
    (loading[key] = loading[key] || []).push(done);
    if (loading[key].length > 1) return;
    var sc = document.createElement("script");
    sc.src = src;
    sc.onload = sc.onerror = function () { var cbs = loading[key]; delete loading[key]; sc.remove(); cbs.forEach(function (f) { f(store[key] || null); }); };
    document.head.appendChild(sc);
  }
  // done(rows): every passage of the book that covers ayah a (usually one; أسباب النزول can have several).
  function bookText(book, s, a, done) {
    if (!book.files[s]) { done([]); return; }
    var starts = book.files[s], k = 0;
    for (var i = 0; i < starts.length; i++) if (starts[i] <= a) k = i;
    need("b/" + book.id + "/" + s + "-" + k, "books/" + book.id + "/" + s + "-" + k + ".js", function (rows) {
      done((rows || []).filter(function (r) { return r[0] <= a && a <= r[1]; }));
    });
  }
  function balaghaOf(t) {
    var m = t.match(/(?:^|\n)البلاغة:\n/); if (!m) return "";
    var rest = t.slice(m.index + m[0].length), e = rest.search(/\n(?:الإعراب|اللغة|الفوائد|البلاغة):\n/);
    return (e < 0 ? rest : rest.slice(0, e)).trim();
  }
  // المتشابهات: verses that are easily confused with this one (mutashabihat.js). In each, the words that are not in this
  // verse are marked, as that is where a hafiz slips.
  function mutashTab(body, s, a) {
    if (!window.MUTASH) { body.innerHTML = '<p class="hint">جارٍ التحميل…</p>'; need("mut", "mutashabihat.js", function () { if (window.MUTASH && document.body.contains(body)) mutashTab(body, s, a); }); return; }
    var list = MUTASH[s + ":" + a];
    if (!list) { body.innerHTML = '<p class="hint">لا توجد في هذه القائمة آيات متشابهة مع هذه الآية.</p>' + mutashSrc(); return; }
    // Compared without a leading و or ف, so «ويقيمون» counts as the same word as «يقيمون».
    function key(w) { var n = norm(w); return n.length > 3 ? n.replace(/^[وف]/, "") : n; }
    var mine = {}; Q.t[s - 1][a - 1].split(" ").forEach(function (w) { mine[key(w)] = 1; });
    body.innerHTML = '<p class="hint">آيات يكثر الالتباس بينها وبين هذه الآية في الحفظ. الكلمات المختلفة مظللة.</p>' + list.map(function (p) {
      var txt = p.map(function (v) {
        return Q.t[v[0] - 1][v[1] - 1].split(" ").map(function (w) { var n = key(w); return n && !mine[n] ? "<mark>" + w + "</mark>" : w; }).join(" ") +
          ' <span class="ayah-no">﴿' + ar(v[1]) + "﴾</span>";
      }).join(" ");
      var v0 = p[0], ref = "سورة " + Q.s[v0[0] - 1][0] + " · " + (p.length > 1 ? "الآيات " + ar(v0[1]) + "–" + ar(p[p.length - 1][1]) : "الآية " + ar(v0[1]));
      return '<a class="mut" href="#/a/' + v0[0] + "/" + v0[1] + '"><span class="mut-ref">' + ref + '</span><div class="ay-text mut-text">' + txt + "</div></a>";
    }).join("") + mutashSrc();
  }
  function mutashSrc() { return '<p class="about">المصدر: بيانات Quran_Mutashabihat_Data (رخصة CC0) المبنية على عمل القارئ إدريس العاصم، وتشمل أكثر المتشابهات التي يخطئ فيها الحفاظ وليست حصرًا لكل المتشابهات. نص الآيات من المصحف نفسه.</p>'; }
  // Paragraphs, the editors' footnotes [[...]] in small type, and Quran quotes ﴿...﴾ in the mushaf font.
  function richText(t) {
    return esc(t).split(/\n+/).map(function (p) {
      p = p.replace(/\[\[([\s\S]*?)\]\]/g, '<span class="fn">$1</span>').replace(/﴿([^﴾]*)﴾/g, '<span class="qq">﴿$1﴾</span>')
        .replace(/\{([^{}\d][^{}]*)\}/g, '<span class="qq">﴿$1﴾</span>');
      return "<p>" + p + "</p>";
    }).join("");
  }
  function showAyah(s, a, tab) {
    var meta = Q.s[s - 1];
    titleEl.textContent = "سورة " + meta[0] + " · " + ar(a);
    btnBack.hidden = false;
    tab = tab || load("ayahTab", "tafsir");
    save("ayahTab", tab);
    var tabs = [["tafsir", "التفسير"], ["tajweed", "التجويد"], ["qiraat", "القراءات"], ["asbab", "أسباب النزول"], ["irab", "الإعراب"], ["balagha", "البلاغة"], ["mutash", "المتشابهات"], ["words", "معاني الكلمات"]];
    if ((tjOn || tab === "tajweed") && !window.TAJWEED) { withTajweed(function () { if (location.hash.indexOf("#/a/" + s + "/" + a) === 0) route(); }); }
    // The English translation of the ayah under it (its own switch here, kept between visits).
    var ayTr = load("ayahTr", false), notes = load("notes", {}), note = notes[s + ":" + a] || "";
    if (ayTr && !window.TR_EN) withTranslation(function () { if (location.hash.indexOf("#/a/" + s + "/" + a) === 0) route(); });
    view.innerHTML = '<div class="ay-head"><div class="ay-text">' + (tab === "tajweed" && window.TAJWEED ? tjHtml(s, a) : ayahHtml(s, a)) + ' <span class="ayah-no">﴿' + ar(a) + "﴾</span></div>" +
      (ayTr && window.TR_EN ? '<div class="ay-tr" dir="ltr" lang="en">' + esc(TR_EN[s - 1][a - 1]) + "<small>Saheeh International</small></div>" : "") +
      '<div class="ay-nav"><button id="ayPrev">الآية السابقة</button><button id="ayPage">صفحة ' + ar(pageOf(s, a)) + '</button><button id="ayNext">الآية التالية</button></div>' +
      (note ? '<div class="ay-note"><small>ملاحظتي</small>' + esc(note).replace(/\n/g, "<br>") + "</div>" : "") +
      '<div class="ay-acts"><button id="ayTr" class="ay-tr-btn' + (ayTr ? " on" : "") + '">' + ic("text") + (ayTr ? "إخفاء الترجمة" : "الترجمة") + "</button>" +
      '<button id="ayNote" class="ay-tr-btn">' + ic("edit") + "ملاحظة" + "</button>" +
      '<button id="ayShare" class="ay-tr-btn">' + ic("share") + "مشاركة</button></div></div>" +
      '<div class="tabs ay-tabs">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div>" +
      '<div id="ayBody"></div>';
    window.scrollTo(0, 0);
    function goto(s2, a2, t2) { history.replaceState(null, "", "#/a/" + s2 + "/" + a2 + "?t=" + (t2 || tab)); route(); }
    var prev = a > 1 ? [s, a - 1] : s > 1 ? [s - 1, Q.s[s - 2][3]] : null, next = a < meta[3] ? [s, a + 1] : s < 114 ? [s + 1, 1] : null;
    document.getElementById("ayPrev").disabled = !prev;
    document.getElementById("ayNext").disabled = !next;
    document.getElementById("ayPrev").onclick = function () { if (prev) goto(prev[0], prev[1]); };
    document.getElementById("ayNext").onclick = function () { if (next) goto(next[0], next[1]); };
    document.getElementById("ayPage").onclick = function () { openAyahPage(s, a); };
    document.getElementById("ayTr").onclick = function () { save("ayahTr", !ayTr); var y = window.scrollY; route(); window.scrollTo(0, y); };
    document.getElementById("ayShare").onclick = function () { shareDialog(s, a); };
    document.getElementById("ayNote").onclick = function () { noteDialog(s, a, function () { var y = window.scrollY; route(); window.scrollTo(0, y); }); };
    view.querySelectorAll(".ay-tabs button").forEach(function (b) { b.onclick = function () { goto(s, a, b.dataset.t); }; });
    var body = document.getElementById("ayBody");
    if (tab === "words") wordsTab(body, s, a);
    else if (tab === "mutash") mutashTab(body, s, a);
    else if (tab === "tajweed") needLessons(function () { if (document.body.contains(body)) tajweedTab(body, s, a); });
    else bookTab(body, s, a, tab);
    var on = view.querySelector(".ay-tabs .on"); if (on && on.scrollIntoView) on.scrollIntoView({ inline: "center", block: "nearest" });
  }
  function showOnChip(box) { var on = box.querySelector(".chips .on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" }); }
  function chips(list, cur, attr) {
    return '<div class="chips">' + list.map(function (x) {
      return '<button ' + attr + '="' + x[0] + '"' + (x[0] === cur ? ' class="on"' : "") + ">" + x[1] + "</button>";
    }).join("") + "</div>";
  }
  function bookTab(body, s, a, kind) {
    // البلاغة: the «البلاغة» sections of Muhyi al-Din Darwish's «إعراب القرآن وبيانه».
    var books = BK.books.filter(function (b) { return kind === "balagha" ? b.id === "darwish" : b.kind === kind; });
    if (!books.length) { body.innerHTML = '<p class="hint">الكتب غير موجودة في هذه النسخة.</p>'; return; }
    var cur = load("book." + kind, books[0].id);
    if (!books.some(function (b) { return b.id === cur; })) cur = books[0].id;
    function render() {
      var book = books.filter(function (b) { return b.id === cur; })[0];
      body.innerHTML = (books.length > 1 ? chips(books.map(function (b) { return [b.id, b.title]; }), cur, "data-b") : "") +
        (kind === "qiraat" ? '<a class="learn-link" href="#/qiraat">القراء العشرة ورواتهم، ومعاني الرموز، والأصول العامة ‹</a>' : "") +
        '<div class="book"><p class="hint">' + (books.length > 1 ? "" : book.title + " · ") + book.author + '</p><div class="book-text"><p class="hint">جارٍ التحميل…</p></div></div>';
      body.querySelectorAll("[data-b]").forEach(function (c) { c.onclick = function () { cur = c.dataset.b; save("book." + kind, cur); render(); }; });
      showOnChip(body);
      bookText(book, s, a, function (hits) {
        var box = body.querySelector(".book-text"); if (!box || cur !== book.id) return;
        if (kind === "balagha") hits = hits.map(function (h) { return [h[0], h[1], balaghaOf(h[2])]; }).filter(function (h) { return h[2]; });
        if (!hits.length) {
          box.innerHTML = '<p class="hint">' + (kind === "asbab" ? "لم يذكر الواحدي سببًا لنزول هذه الآية." :
            kind === "balagha" ? "لم يذكر الكتاب فنونًا بلاغية خاصة بهذه الآية." :
            kind === "qiraat" ? "لم يذكر ابن الجزري في هذه الآية خلافًا خاصًا بكلماتها. أما الأصول العامة (كالمد والإمالة والهمز) فتجدها في صفحة القراءات العشر." :
            "لا يوجد نص لهذه الآية في هذا الكتاب.") + "</p>";
          return;
        }
        var what = { irab: "إعراب", tafsir: "تفسير", asbab: "سبب نزول", balagha: "بلاغة" }[kind];
        box.innerHTML = hits.map(function (hit) {
          var span = hit[0] === hit[1] ? "" : hit[0] === 1 && hit[1] === Q.s[s - 1][3] ? "عن السورة كلها" : what + " الآيات " + ar(hit[0]) + "–" + ar(hit[1]) + " معًا";
          return (span ? '<p class="span-note">' + span + "</p>" : "") + richText(hit[2]);
        }).join('<hr class="sep">');
      });
    }
    render();
  }
  // Tajweed tab: each rule met in the ayah, with the words it is in and what it means.
  function tajweedTab(body, s, a) {
    if (!window.TAJWEED) { body.innerHTML = '<p class="hint">جارٍ التحميل…</p>'; return; }
    var t = Q.t[s - 1][a - 1], sp = TAJWEED.q[s - 1][a - 1], by = {}, order = [];
    for (var i = 0; i < sp.length; i += 3) {
      var r = sp[i + 2], b = t.lastIndexOf(" ", sp[i]) + 1, e = t.indexOf(" ", sp[i + 1] - 1);
      if (e < 0) e = t.length;
      if (!by[r]) { by[r] = []; order.push(r); }
      var w = tjHtml(s, a, b, e);
      if (by[r].indexOf(w) < 0) by[r].push(w);
    }
    order.sort(function (x, y) { return x - y; });
    var lessons = window.TAJWEED_LESSONS || [];
    body.innerHTML = (order.length ? "" : '<p class="hint">لا توجد في هذه الآية أحكام ملوّنة غير المد الطبيعي.</p>') +
      order.map(function (r) {
        var les = lessons.filter(function (l) { return l.rule === r; })[0];
        return '<div class="tj-rule"><div class="tj-head"><i class="tj-dot tjb' + r + '"></i>' + TJ_NAMES[r] + "</div>" +
          '<div class="tj-words">' + by[r].join('<span class="tj-sep">،</span> ') + "</div>" +
          (les ? '<p class="tj-why">' + les.p[0] + "</p>" : "") + "</div>";
      }).join("") +
      '<a class="learn-link" href="#/tajweed">دروس أحكام التجويد لرواية حفص ‹</a>' +
      '<p class="hint">المد الطبيعي (حركتان) غير ملوّن. ألوان التجويد مأخوذة من بيانات مشروع quran-tajweed المفتوحة.</p>';
  }
  function needLessons(done) {
    if (window.TAJWEED_LESSONS) { done(); return; }
    need("tjl", "tajweed-lessons.js", function () { if (window.TAJWEED_LESSONS) done(); });
  }

  function showTajweed() {
    titleEl.textContent = "أحكام التجويد";
    btnBack.hidden = false;
    view.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
    needLessons(function () { withTajweed(function () {
      if (location.hash !== "#/tajweed") return;
      var L = window.TAJWEED_LESSONS;
      var legend = '<div class="tj-legend">' + TJ_NAMES.map(function (n, r) {
        return '<span><i class="tj-dot tjb' + r + '"></i>' + n + "</span>";
      }).join("") + "</div>";
      view.innerHTML = '<div class="learn-hero"><b>أحكام التجويد</b><span>رواية حفص عن عاصم من طريق الشاطبية</span></div>' +
        '<div class="learn-card"><h3>ألوان التجويد في عرض النص</h3>' + legend +
        '<p class="hint">تظهر الألوان في عرض النص وفي صفحة الآية، ويمكن إيقافها من الإعدادات. صفحات المصحف المصوّرة تبقى كما طُبعت.</p></div>' +
        L.map(function (l, i) {
          return '<details class="learn-card"' + (i === 0 ? " open" : "") + "><summary>" +
            (l.rule !== undefined ? '<i class="tj-dot tjb' + l.rule + '"></i>' : "") + l.t + "</summary>" +
            l.p.map(function (x) { return "<p>" + x + "</p>"; }).join("") +
            (l.ex ? '<div class="tj-examples">' + l.ex.map(function (e) {
              var words = Q.t[e[0] - 1][e[1] - 1].split(" "), from = words.slice(0, e[2]).join(" ").length + (e[2] ? 1 : 0),
                to = from + words.slice(e[2], e[2] + e[3]).join(" ").length;
              return '<button data-s="' + e[0] + '" data-a="' + e[1] + '"><span class="tj-ex">' + tjHtml(e[0], e[1], from, to) + "</span><small>" +
                Q.s[e[0] - 1][0] + " " + ar(e[1]) + "</small></button>";
            }).join("") + "</div>" : "") + "</details>";
        }).join("");
      view.querySelectorAll(".tj-examples button").forEach(function (b) {
        b.onclick = function () { location.hash = "#/a/" + b.dataset.s + "/" + b.dataset.a + "?t=tajweed"; };
      });
    }); });
  }

  // The ten readers: who they are, the book's shorthand, then the usul chapters of تحبير التيسير.
  var READERS = [["نافع المدني", "قالون", "ورش"], ["ابن كثير المكي", "البزي", "قنبل"], ["أبو عمرو البصري", "الدوري", "السوسي"],
    ["ابن عامر الشامي", "هشام", "ابن ذكوان"], ["عاصم الكوفي", "شعبة (أبو بكر)", "حفص"], ["حمزة الكوفي", "خلف", "خلاد"],
    ["الكسائي الكوفي", "أبو الحارث", "الدوري"], ["أبو جعفر المدني", "ابن وردان", "ابن جماز"], ["يعقوب الحضرمي", "رويس", "روح"],
    ["خلف العاشر", "إسحاق", "إدريس"]];
  var TERMS = [["الحرميان", "نافع وابن كثير"], ["المدنيان", "نافع وأبو جعفر"], ["البصريان", "أبو عمرو ويعقوب"],
    ["الكوفيون", "عاصم وحمزة والكسائي"], ["الأخوان", "حمزة والكسائي"], ["الابنان", "ابن كثير وابن عامر"],
    ["أبو بكر", "شعبة راوي عاصم"], ["الباقون", "بقية القراء العشرة غير من ذُكر"]];
  function showQiraat() {
    titleEl.textContent = "القراءات العشر";
    btnBack.hidden = false;
    var html = '<div class="learn-hero"><b>القراءات العشر</b><span>من «تحبير التيسير في القراءات العشر» لابن الجزري (ت ٨٣٣هـ)</span></div>' +
      '<div class="learn-card"><h3>القراء العشرة ورواتهم</h3><div class="readers">' +
      READERS.map(function (r, i) { return '<div><span class="num"><span>' + ar(i + 1) + "</span></span><b>" + r[0] + "</b><small>" + r[1] + " · " + r[2] + "</small></div>"; }).join("") +
      '</div><p class="hint">المصحف في هذا التطبيق برواية حفص عن عاصم.</p></div>' +
      '<div class="learn-card"><h3>رموز يستعملها الكتاب</h3><div class="terms">' +
      TERMS.map(function (t) { return "<div><b>" + t[0] + "</b><span>" + t[1] + "</span></div>"; }).join("") +
      '</div><p class="hint">أصل الكتاب «التيسير» لأبي عمرو الداني في القراءات السبع، وزاد عليه ابن الجزري القراءات الثلاث (أبا جعفر ويعقوب وخلفًا) وما يبدأ بقوله «قلت».</p></div>' +
      '<div class="learn-card"><h3>كيف تقرأ الخلاف في آية؟</h3><p>افتح أي آية (اضغط عليها ثم «تفسير وإعراب ومعاني») واختر تبويب «القراءات»، فيظهر كلام ابن الجزري عن كلماتها.</p></div>' +
      '<h3 class="learn-sub">أصول القراءات</h3><div id="usul"><p class="hint">جارٍ التحميل…</p></div>';
    view.innerHTML = html;
    need("usul", "books/qiraat-usul.js", function (u) {
      var box = document.getElementById("usul"); if (!box) return;
      if (!u) { box.innerHTML = '<p class="hint">تعذّر التحميل.</p>'; return; }
      box.innerHTML = u.map(function (c) {
        return '<details class="learn-card"><summary>' + esc(c[0]) + '</summary><div class="book-text">' + richText(c[1].replace(/\(([^()\d]+)\)/g, "{$1}")) + "</div></details>";
      }).join("");
    });
  }

  function wordsTab(body, s, a, pick0, tok) {
    body.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
    need("w/" + s, "books/words/" + s + ".js", function (d) {
      var words = d && d[a];
      if (!words) { body.innerHTML = '<p class="hint">تعذّر تحميل كلمات الآية.</p>'; return; }
      var pick = pick0 >= 0 && pick0 < words.length ? pick0 : -1;
      // the tapped word by its letters (a few ayat split their words differently from the text): the nearest same word
      if (tok && pick >= 0 && norm(words[pick][0]) !== norm(tok)) {
        var best = -1; words.forEach(function (w, i) { if (norm(w[0]) === norm(tok) && (best < 0 || Math.abs(i - pick0) < Math.abs(best - pick0))) best = i; });
        if (best >= 0) pick = best;
      }
      words.forEach(function (w, i) { if (pick < 0 && w[1] >= 0) pick = i; });
      var dict = load("dict", BK.lex.length ? BK.lex[0].id : "");
      function render() {
        var html = '<div class="words">' + words.map(function (w, i) {
          return '<button data-w="' + i + '" class="' + (i === pick ? "on" : "") + (w[1] < 0 ? " noroot" : "") + '">' + w[0] + "</button>";
        }).join("") + "</div>";
        var w = words[pick];
        if (!w) { body.innerHTML = html + '<p class="hint">لا توجد في هذه الآية كلمات لها جذر.</p>'; return; }
        if (w[1] < 0) { body.innerHTML = html + '<p class="hint">«' + w[0] + "» حرف أو ضمير، وليس لها جذر في المعاجم.</p>"; bind(); return; }
        var root = BK.roots[w[1]];
        if (BK.lex.length && !BK.lex.some(function (l) { return l.id === dict; })) dict = BK.lex[0].id;
        html += '<p class="root">الجذر: <b>' + root.split("").join(" ") + "</b></p>" +
          chips(BK.lex.map(function (l) { return [l.id, l.title + (l.has.indexOf(w[1]) < 0 ? " ·" : "")]; }), dict, "data-d") +
          '<div class="book"><p class="hint">' + (BK.lex.filter(function (l) { return l.id === dict; })[0] || {}).author + '</p><div class="book-text lex"><p class="hint">جارٍ التحميل…</p></div></div>';
        body.innerHTML = html; bind(); showOnChip(body);
        var c = Math.floor(w[1] / 40), want = w[1], d0 = dict;
        need("l/" + dict + "/" + c, "books/lex/" + dict + "/" + c + ".js", function (entries) {
          var box = body.querySelector(".book-text"); if (!box || want !== words[pick][1] || d0 !== dict) return;
          var t = entries && entries[want];
          box.innerHTML = t ? richText(t) : '<p class="hint">لا توجد مادة «' + root + "» في هذا المعجم.</p>";
        });
      }
      function bind() {
        body.querySelectorAll("[data-w]").forEach(function (b) { b.onclick = function () { pick = +b.dataset.w; render(); }; });
        body.querySelectorAll("[data-d]").forEach(function (b) { b.onclick = function () { dict = b.dataset.d; save("dict", dict); render(); }; });
      }
      render();
    });
  }

  // S9 (5.18): a long press on a word in the text view opens its meaning (root + dictionaries, the words tab) in a
  // dialog. A plain tap still opens the ayah bar, and in hifz mode the long press does nothing (it would show hidden words).
  function wordSheet(s, a, wi, tok) {
    var d = el('<div class="dlg-back"><div class="dlg wm-dlg"><b>معنى الكلمة · سورة ' + Q.s[s - 1][0] + " " + ar(a) + '</b><div class="wm-body"></div>' +
      '<div class="dlg-btns"><button class="wm-ayah">التفسير والإعراب</button><button class="dlg-ok">تم</button></div></div></div>').firstChild;
    document.body.appendChild(d);
    // the finger of the long press is still down when the sheet opens: Android would select the text under it (5.19)
    var unsel = function () { try { var g = window.getSelection(); if (g && g.rangeCount) g.removeAllRanges(); } catch (er) {} };
    unsel(); document.addEventListener("selectionchange", unsel); setTimeout(function () { document.removeEventListener("selectionchange", unsel); unsel(); }, 1200);
    d.querySelector(".dlg-ok").onclick = function () { d.remove(); };
    d.querySelector(".wm-ayah").onclick = function () { d.remove(); location.hash = "#/a/" + s + "/" + a; };
    d.onclick = function (e) { if (e.target === d) d.remove(); };
    wordsTab(d.querySelector(".wm-body"), s, a, wi, tok);
  }
  // which word of the ayah span sp is under the point (x, y): its place among the ayah's words (rWords), or -1
  function wordAt(sp, x, y) {
    var r = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
    if (!r || !sp.contains(r.startContainer)) return -1;
    var no = sp.querySelector(".ayah-no"); if (no && no.contains(r.startContainer)) return -1;
    var pre = document.createRange(); pre.setStart(sp, 0); pre.setEnd(r.startContainer, r.startOffset);
    var toks = pre.toString().split(" "), last = toks.pop();
    var real = function (w) { return norm(w).replace(/\s/g, ""); };
    var i = toks.filter(real).length; if (!real(last) && !toks.length) return 0;
    return i;
  }
  window.QA_wordAt = wordAt;

  // ---------- ملء الشاشة على المصحف ----------
  // Going in or out of full screen, the page glides from its old place and size to the new one (FLIP) instead of
  // jumping; the WebView resize that follows (immersive system bars) gets one more glide (5.11 G2).
  var fsFlipUntil = 0, fsFlipRects = null;
  function fsBoxes() { return [].slice.call(document.querySelectorAll("#view .page-wrap .page-box")); }
  function fsFlipStart() { var bs = fsBoxes(); return bs.length ? bs.map(function (b) { return [b, b.getBoundingClientRect()]; }) : null; }
  function fsFlip(fl) {
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var lay = [];
    fl.forEach(function (x) {
      var b = x[0], r0 = x[1]; if (!b.isConnected) return;
      b.style.transition = "none"; b.style.transform = "";
      var r1 = b.getBoundingClientRect(); lay.push([b, r1]); if (!r1.width || reduce) return;
      var sc = r0.width / r1.width, dx = r0.left - r1.left, dy = r0.top - r1.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sc - 1) < 0.005) return;
      b.style.transformOrigin = "0 0";
      b.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + sc.toFixed(4) + ")";
      void b.offsetWidth;
      b.style.transition = "transform .42s cubic-bezier(.4,0,.2,1)"; b.style.transform = "";
      clearTimeout(b._fsT); b._fsT = setTimeout(function () { b.style.transition = b.style.transformOrigin = ""; }, 460);
    });
    fsFlipUntil = Date.now() + 900; fsFlipRects = lay;
  }
  // the resize from immersive(): glide from where the page was laid out before it (only when the insets are not known, see fsPend)
  window.addEventListener("resize", function () {
    if (fsPend) { fsLand(); return; }
    if (Date.now() > fsFlipUntil || !fsFlipRects) return;
    // where each page is drawn right now: its layout before the resize moved by the running glide
    var fl = fsFlipRects.map(function (x) {
      var b = x[0], r = x[1], m = new DOMMatrix(getComputedStyle(b).transform === "none" ? undefined : getComputedStyle(b).transform);
      return [b, { left: r.left + m.e, top: r.top + m.f, width: r.width * m.a }];
    });
    fsFlipRects = null; fsFlipUntil = 0; fsFlip(fl);
  });
  // 5.11 G2 5c/5d: hiding the system bars both grows the WebView and moves its top up by the status bar (MainActivity pads it
  // by the insets), which a CSS glide cannot see: the page went down, jumped up 24 px and glided back. AppBridge.insets()
  // tells where the WebView will be, so the page is laid out for the final viewport (--vh) and shifted by the coming move
  // (--fsdy) at once: ONE glide goes straight to its last place, and when the resize lands both are cleared in the same
  // frame (the CSS moves by S, the WebView by -S: nothing moves on screen).
  var fsNorm = null, fsPend = null;   // fsNorm: [S, G] = top shift and height growth of full screen, read while the bars show
  function fsInsets() {
    try { var t = window.AppBridge && AppBridge.insets && AppBridge.insets(); if (!t) return null; var a = t.split(",").map(Number);
      return a.length === 4 && a.every(isFinite) ? [a[0] - a[2], a[0] + a[1] - a[2] - a[3]] : null; } catch (e) { return null; }
  }
  var fsDy = 0;   // --fsdy now
  function fsVar(k, v) { if (k === "--fsdy") fsDy = v || 0; if (v === null) root.style.removeProperty(k); else root.style.setProperty(k, v + "px"); }
  // the resize came (or never will): the page is laid out for the real viewport again
  function fsLand(timedOut) {
    var pd = fsPend; fsPend = null; if (!pd) return; clearTimeout(pd.t);
    if (timedOut && !pd.vr) { var fl = fsFlipStart(); fsVar("--vh", null); fsVar("--fsdy", 0); if (fl) fsFlip(fl); return; }
    fsVar("--vh", null); fsVar("--fsdy", timedOut ? 0 : pd.after);
  }
  // A tap on a mushaf page hides the bars and buttons a moment later, leaving only the page; the next tap brings them back.
  var fsT = 0;
  function fsSet(on) {
    clearTimeout(fsT);
    if (on) fsAuto = false;
    if (document.body.classList.contains("fs") === on) return;
    var bar = document.querySelector(".bar"), h = bar ? bar.offsetHeight : 0, vr = document.body.classList.contains("vread");
    if (h) root.style.setProperty("--barh", h + "px");   // the bar's height, so its space can shrink with the slide (style.css body.fs .bar)
    if (fsPend) fsLand(true);
    // vertical reading: the page on screen stays where it is while the bars go or come back (its top is put back
    // after the change and once more after the layout settles), so full screen never moves to another page; its size change
    // (the side padding goes) glides like the single page (5.11 G2 5c)
    var anc = null, t0 = 0, vis = [];
    if (vr) { var vb = document.querySelectorAll(".vp-c"); for (var i = 0; i < vb.length; i++) { var r = vb[i].getBoundingClientRect(); if (r.bottom > 80 && !anc) { anc = vb[i]; t0 = r.top; } if (r.bottom > 0 && r.top < innerHeight) vis.push([vb[i], r]); else if (anc) break; } }
    var fl = vr ? (vis.length ? vis : null) : fsFlipStart();
    var dy0 = fsDy;
    if (on) { var ins = fsInsets(); if (ins) fsNorm = ins; }
    var sg = fsNorm && window.AppBridge && AppBridge.immersive ? fsNorm : null;
    if (sg && (sg[0] || sg[1])) {
      // vertical: the list keeps its place, so only the WebView's move is made up for (by S while the bars are hidden)
      fsPend = { vr: vr, after: vr ? (on ? sg[0] : 0) : 0, t: setTimeout(function () { fsLand(true); }, 900) };
      fsVar("--vh", innerHeight + (on ? sg[1] : -sg[1]));
      fsVar("--fsdy", vr ? (on ? 0 : sg[0]) : (on ? -sg[0] : sg[0]));
    }
    document.body.classList.toggle("fs", on);
    // (the --fsdy shift that makes up for the WebView's move is not undone by the scroll)
    if (anc) { var fix = function () { var d = anc.getBoundingClientRect().top - t0 - (fsDy - dy0); if (Math.abs(d) > 1) window.scrollBy(0, d); }; fix(); requestAnimationFrame(fix); setTimeout(fix, 320); }
    if (fl) fsFlip(fl);
    // the system bars go (or come back) together with the glide: with the insets known the resize no longer moves the page
    clearTimeout(fsImmT);
    var imm = function () { try { if (window.AppBridge && AppBridge.immersive) AppBridge.immersive(on); } catch (e) {} };
    if (on && !sg) fsImmT = setTimeout(function () { if (document.body.classList.contains("fs")) imm(); }, 440); else imm();
  }
  var fsImmT = 0;
  document.addEventListener("click", function (e) {
    // While auto-scroll runs in full screen a tap anywhere (but on its own bar) brings the bars back; the scrolling goes on.
    if (auto.on && autoFs && document.body.classList.contains("fs") && !e.target.closest("#autoBar")) { e.stopPropagation(); e.preventDefault(); autoFs = false; fsSet(false); return; }
    if (!/^#\/p\//.test(location.hash) || !e.target.closest(".page-box")) return;
    if (document.body.classList.contains("fs")) { e.stopPropagation(); e.preventDefault(); fsSet(false); return; }
    clearTimeout(fsT); fsT = setTimeout(function () { if (/^#\/p\//.test(location.hash) && !window.QA_NOFS && !hifz.on && !document.getElementById("ayahBar")) fsSet(true); }, 1200);   // not while an ayah is chosen
  }, true);

  // While that first full screen is pending, every touch or scroll starts the 5 s again.
  var fsAuto = false;
  ["pointerdown", "wheel", "touchmove"].forEach(function (ev) {
    document.addEventListener(ev, function () { if (fsAuto && /^#\/p\//.test(location.hash) && !document.body.classList.contains("fs")) fsLater(5000); }, { passive: true, capture: true });
  });
  function fsLater(ms) {
    clearTimeout(fsT); fsT = setTimeout(function () { if (/^#\/p\//.test(location.hash) && !window.QA_NOFS && !hifz.on && !document.getElementById("ayahBar") && !rd.on) fsSet(true); }, ms);
  }
  var wasPage = false;
  function route() {
    // the backup reminder (S10): home, then Settings opened at the backup row
    if (location.hash === "#/backup") { history.replaceState(null, "", "#/"); setTimeout(function () {
      document.getElementById("btnSettings").click(); var b = document.getElementById("bkOut"); if (b) b.scrollIntoView({ block: "center" }); }, 50); }
    ayahBar(null);
    var isPage = /^#\/p\//.test(location.hash);
    if (!isPage) fsSet(false);
    else if (!wasPage) { fsAuto = true; fsLater(5000); }   // opening the mushaf goes full screen after 5 s without a touch
    var pageToPage = isPage && wasPage;   // a page turn: no view-entry fade (it dimmed and nudged the page as it settled, 5.11 G2)
    wasPage = isPage;
    autoSet(false); zikrSpeech.stop();
    document.body.classList.remove("vread");
    document.body.classList.toggle("reading", /^#\/(p|s)\//.test(location.hash));
    document.body.classList.toggle("pgview", /^#\/p\//.test(location.hash));
    tabbar();
    view.classList.remove("v-in"); if (!pageToPage) { void view.offsetWidth; view.classList.add("v-in"); }
    if (!/^#\/(p|s)\//.test(location.hash) && hifz.on) { hifz.on = false; hifz.test = null; reciteStop(); hifzBar(); }
    if (stopQibla) stopQibla();
    sheet.hidden = true;
    indexSheet.hidden = true;
    currentSurah = 0;
    var h = location.hash, m;
    if ((m = h.match(/^#\/p\/(\d+)/))) {
      var am = h.match(/[?&]a=(\d+):(\d+)/), hm = h.match(/[?&]h=([^&]*)/), hl = null;
      if (am && +am[1] >= 1 && +am[1] <= 114 && +am[2] >= 1 && +am[2] <= Q.s[+am[1] - 1][3]) {
        var pq = hm ? hm[1] : "";
        try { pq = decodeURIComponent(pq); } catch (e) {}
        hl = { s: +am[1], a: +am[2], q: norm(pq) };
      }
      showPage(Math.min(Q.count - 1, Math.max(Q.min, +m[1])), hl);
    } else if ((m = h.match(/^#\/s\/(\d+)\/(\d+)/))) {
      var s = Math.min(114, Math.max(1, +m[1]));
      var hq = (h.split("?h=")[1] || "");
      try { hq = decodeURIComponent(hq); } catch (e) {}
      showSurah(s, Math.min(Q.s[s - 1][3], Math.max(1, +m[2])), norm(hq));
    } else if ((m = h.match(/^#\/a\/(\d+)\/(\d+)/))) {
      var as = Math.min(114, Math.max(1, +m[1])), tm = h.match(/[?&]t=(\w+)/);
      showAyah(as, Math.min(Q.s[as - 1][3], Math.max(1, +m[2])), tm && tm[1]);
    } else if (h.indexOf("#/azkar") === 0) {
      showAzkar(h.split("/")[2]);
    } else if (h === "#/tajweed") {
      showTajweed();
    } else if (h === "#/qiraat") {
      showQiraat();
    } else if (h === "#/khatma") {
      showKhatma();
    } else if (h === "#/hifzmap") {
      showHifzMap();
    } else if (h === "#/family") {
      showFamily();
    } else if ((m = h.match(/^#\/topics(?:\/(\d+)\/(\d+))?/))) {
      showTopics(m[1] != null ? +m[1] : null, +m[2]);
    } else if (h === "#/hifzlog") {
      showHifzLog();
    } else if (h === "#/imsakia") {
      showImsakia();
    } else if (h === "#/prayer") {
      showPrayer();
    } else if (h === "#/tasbih") {
      showTasbih();
    } else if (h === "#/more") {
      showMore();
    } else if (h === "#/stats") {
      showStats();
    } else if ((m = h.match(/^#\/duas(?:\/(\w+))?/))) {
      showDuas(m[1]);
    } else if ((m = h.match(/^#\/hifztest(?:\/(\d+))?/))) {
      showHifzTest(m[1] ? +m[1] : 0);
    } else if (h === "#/mutash") {
      showMutashTest();
    } else if (h === "#/students") {
      showStudents();
    } else if ((m = h.match(/^#\/talqin(?:\/(\d+))?/))) {
      showTalqin(m[1] ? +m[1] : 0);
    } else if (h === "#/welcome") {
      location.replace("#/"); setTimeout(showWelcome, 50);
    } else if (h === "#/qibla") {
      showQibla();
    } else if (h.indexOf("#/search") === 0) {
      var q = (h.split("?q=")[1] || "");
      try { q = decodeURIComponent(q); } catch (e) {}
      showSearch(q);
    } else {
      showHome();
    }
    // The home screen already is the index, so the button shows only elsewhere.
    document.getElementById("btnIndex").hidden = btnBack.hidden;
  }
  window.addEventListener("hashchange", route);
  sunCheck();   // here, not up with applySettings(): sunDark() needs the prayer-time code below it, which only exists once the script has run this far
  route();
  // First run: a short welcome (edition, city, reminders). Skipped under automated tests.
  if (!load("onboarded", false) && !navigator.webdriver) { if (load("last", null)) save("onboarded", true); else setTimeout(showWelcome, 300); }
  // Hand the phone the coming reminders / prayer alarms and the widget's content: now, and shortly after each screen change
  // (the reading place, the khatma plan and the location may have changed).
  var syncT = 0;
  function syncSoon() { clearTimeout(syncT); syncT = setTimeout(function () { syncAlarms(); syncWidget(); }, 1500); }
  window.addEventListener("hashchange", syncSoon);
  document.addEventListener("visibilitychange", function () { if (document.hidden) { syncAlarms(); syncWidget(); } });
  syncSoon();

  // The mushaf pages are AVIF (under half the size of WebP). Very old WebView versions (before 85) cannot show them.
  var avifTest = new Image();
  avifTest.onerror = function () {
    var t = document.createElement("div"); t.className = "toast"; t.style.cssText = "bottom:auto;top:12px;cursor:pointer";
    t.textContent = "صور صفحات المصحف تحتاج تحديث «Android System WebView» من متجر Play. اضغط للإخفاء.";
    t.onclick = function () { t.remove(); }; document.body.appendChild(t);
  };
  avifTest.src = "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAAAIQAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAAQAAAAEAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAAAKW1kYXQSAAoIGAAGiAhoNCAyExlHh4Yhh5555oAAAJBAyRxgimo=";

  // Offline support when hosted on the web (not used inside the Android app).
  if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
