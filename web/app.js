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
  // page fonts by tools/kfgqpc (web/editions/kfgqpc, data in editions/kfgqpc.js); طبعة الشمرلي = typeset with the Complex's
  // Hafs font to the Shamarly page and line layout by tools/shamarly (web/editions/shamarly, pages 2..522).
  var EDS = {
    harmain: { name: "طبعة الحرمين", dir: "pages/", tj: "tjpages/", p: Q.p, r: Q.r, first: Q.first, last: Q.last, count: Q.count, min: 0 }
  };
  if (window.ED_KFGQPC) EDS.kfgqpc = Object.assign({ name: "طبعة الملك فهد", dir: "editions/kfgqpc/", min: 1 }, window.ED_KFGQPC);
  if (window.ED_SHAMARLY) EDS.shamarly = Object.assign({ name: "طبعة الشمرلي", dir: "editions/shamarly/", min: 2 }, window.ED_SHAMARLY);
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
      var loc = load("qiblaLoc", null); if (!loc || typeof PR_METHODS === "undefined") throw 0;
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
  function isDark() { return themeDark(theme); }
  function applySettings() {
    root.style.setProperty("--quran-size", fontSize + "px");
    if (theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme === "sun" ? (sunDark() ? "dark" : "light") : theme);
    document.querySelectorAll("#theme button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === theme); });
    document.querySelectorAll("#mode button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === (mode === "text" ? "text" : edition)); });
    document.querySelectorAll("#flip button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === (turnMode === "v" ? "v" : flipMode)); });
    document.querySelectorAll("#tjSet button").forEach(function (b) { b.classList.toggle("on", (b.dataset.v === "on") === tjOn); });
    document.querySelectorAll("#trSet button").forEach(function (b) { b.classList.toggle("on", (b.dataset.v === "on") === trOn); });
    document.querySelectorAll("#langSet button").forEach(function (b) {
    b.classList.toggle("on", b.dataset.v === (window.LANG || "ar"));
    b.addEventListener("click", function () {
      if (b.dataset.v === (window.LANG || "ar")) return;
      save("lang", b.dataset.v); location.reload();
    });
  });
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
  (function () {
    var body = document.querySelector("#settings .sheet-body"), h2 = body.querySelector("h2"), groups = body.querySelectorAll(".set-group");
    var j = document.createElement("div"); j.className = "set-jump";
    groups.forEach(function (g, i) { g.id = g.id || "sg" + i; var b = document.createElement("button"); b.textContent = g.textContent; b.onclick = function () { g.scrollIntoView({ behavior: "smooth", block: "start" }); }; j.appendChild(b); });
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
      if (was !== turnMode && /^#\/p\//.test(location.hash)) { route(); sheet.hidden = false; }
    });
  });
  // Mushaf page images are downloaded per edition (EdStore.java), not shipped in the app; the web build has them all.
  var ED_BASE = "https://raw.githubusercontent.com/drmalek1987/quran-karim/editions/";
  var ED_MB = { kfgqpc: 56, shamarly: 46, harmain: 48 };
  function edReady(id) { return !window.EdBridge || EdBridge.state(id) === "ready"; }
  function needEd(id, then) {
    if (id === "text" || !EDS[id] || edReady(id)) { then(); return; }
    var d = document.createElement("div"); d.className = "wel"; d.style.zIndex = 9999;
    d.innerHTML = '<div class="wel-card"><h2>' + EDS[id].name + '</h2><p>صفحات المصحف هتتنزل مرة واحدة (حوالي ' + (ED_MB[id] || "") + ' ميجا) وبعدها تشتغل من غير إنترنت.</p>' +
      '<div class="dl-bar" style="height:10px;border-radius:5px;background:#0002;overflow:hidden"><i style="display:block;height:100%;width:0;background:#2e7d5b"></i></div><p class="dl-t"></p>' +
      '<div class="wel-btns"><button class="wel-skip">إلغاء</button><button class="wel-next">تنزيل</button></div></div>';
    document.body.appendChild(d);
    var bar = d.querySelector(".dl-bar i"), t = d.querySelector(".dl-t"), go = d.querySelector(".wel-next");
    d.querySelector(".wel-skip").onclick = function () { window.onEdDl = null; d.remove(); };
    go.onclick = function () {
      go.disabled = true; t.textContent = "جارٍ التنزيل…";
      window.onEdDl = function (e, v) {
        if (e !== id) return;
        if (v === "done") { window.onEdDl = null; d.remove(); paintEdDl(); then(); }
        else if (v === "error") { go.disabled = false; go.textContent = "حاول تاني"; t.textContent = "التنزيل فشل. اتأكد من الإنترنت وحاول تاني."; }
        else { bar.style.width = v + "%"; t.textContent = v + "%"; }
      };
      EdBridge.download(id, ED_BASE + id + ".zip");
    };
  }
  // Settings: each edition with its download state, to fetch or free it.
  function paintEdDl() {
    var box = document.getElementById("edDl"); if (!box) return;
    if (!window.EdBridge) { box.parentNode.hidden = true; return; }
    box.innerHTML = ["kfgqpc", "shamarly", "harmain"].filter(function (k) { return EDS[k]; }).map(function (k) {
      var st = EdBridge.state(k);
      return '<div class="row">' + EDS[k].name + ' <button class="btn" data-dl="' + k + '">' + (st === "ready" ? "حذف (" + ED_MB[k] + " ميجا)" : st === "busy" ? "جارٍ التنزيل…" : "تنزيل (" + ED_MB[k] + " ميجا)") + "</button></div>";
    }).join("");
    box.querySelectorAll("[data-dl]").forEach(function (b) { b.onclick = function () {
      var k = b.dataset.dl;
      if (EdBridge.state(k) === "ready") {
        if (k === edition && mode === "pages") { alert("اختار مصحف تاني الأول قبل حذف ده."); return; }
        if (confirm("تحذف صفحات " + EDS[k].name + " من الموبايل؟")) { EdBridge.remove(k); paintEdDl(); }
      } else needEd(k, function () {});
    }; });
  }
  // Without the pages of the chosen edition (skipped download, or deleted) the reader opens the text until one is fetched.
  if (mode === "pages" && !edReady(edition) && load("onboarded", false)) mode = "text";
  // A tap on an edition not yet on the phone downloads it first, then goes on as a normal tap.
  document.getElementById("mode").addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b || edReady(b.dataset.v) || b.dataset.v === "text") return;
    ev.stopPropagation(); ev.preventDefault(); needEd(b.dataset.v, function () { b.click(); });
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
      if (/^#\/(s|a)\//.test(location.hash)) { var keep = window.scrollY; route(); sheet.hidden = false; window.scrollTo(0, keep); }
    });
  });
  document.querySelectorAll("#trSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      trOn = b.dataset.v === "on"; save("translation", trOn); applySettings();
      if (/^#\/s\//.test(location.hash)) { var keep = window.scrollY; route(); sheet.hidden = false; window.scrollTo(0, keep); }
    });
  });
  document.querySelectorAll("#hapticSet button").forEach(function (b) {
    b.addEventListener("click", function () { save("hapticLevel", +b.dataset.v); applySettings(); });
  });
  document.querySelectorAll("#spreadSet button").forEach(function (b) {
    b.addEventListener("click", function () {
      spreadPref = b.dataset.v === "on"; save("spread", spreadPref); applySettings();
      if (/^#\/p\//.test(location.hash)) { route(); sheet.hidden = false; }
    });
  });
  // Every button and link answers a tap with the chosen buzz, except page turns (asked) and the azkar counter (its own vibration).
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("button, a, select, label.row, .swatches label");
    if (t && !t.closest(".z-count, #pNext, #pPrev, #tsbBtn")) tick();
  });
  var sheet = document.getElementById("settings");
  document.getElementById("btnSettings").onclick = function () { sheet.hidden = false; paintEdDl(); };
  document.getElementById("closeSettings").onclick = function () { sheet.hidden = true; };
  sheet.addEventListener("click", function (e) { if (e.target === sheet) sheet.hidden = true; });
  document.getElementById("btnSearch").onclick = function () { location.hash = "#/search"; };
  // Elastic ends: pulling past the top or bottom of a scrolled screen stretches it a little, and it springs back on release.
  (function elastic() {
    var v = document.getElementById("view"), y0 = null, edge = 0;
    function atEnd(dir) { return dir > 0 ? window.scrollY <= 0 : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1; }
    v.addEventListener("touchstart", function (e) {
      y0 = e.touches.length === 1 && !/^#\/p\//.test(location.hash) ? e.touches[0].clientY : null; edge = 0;
      v.classList.remove("springback");
    }, { passive: true });
    v.addEventListener("touchmove", function (e) {
      if (y0 === null) return;
      var y = e.touches[0].clientY;
      if (!edge) { var dir = y > y0 ? 1 : -1; if (y === y0 || !atEnd(dir)) return; edge = dir; y0 = y; }
      var d = (y - y0) * edge;
      if (d < 0) { edge = 0; v.style.transform = ""; return; }
      if (e.cancelable) e.preventDefault();
      v.style.transform = "translateY(" + (edge * 110 * (1 - Math.exp(-d / 260))).toFixed(1) + "px)";
    }, { passive: false });
    function release() { if (edge) { v.classList.add("springback"); v.style.transform = ""; } y0 = null; edge = 0; }
    v.addEventListener("touchend", release); v.addEventListener("touchcancel", release);
  })();
  window.qBack = function () {
    var d = document.querySelector(".dlg-back");
    if (d) { d.remove(); return true; }
    if (!sheet.hidden) { sheet.hidden = true; return true; }
    if (!indexSheet.hidden) { indexSheet.hidden = true; return true; }
    var x = document.querySelector('#ayahBar button[data-c="x"]');
    if (x) { x.click(); return true; }
    return false;
  };
  btnBack.onclick = function () { history.length > 1 ? history.back() : (location.hash = "#/"); };
  // Before 3.0 there was only the scanned edition: carry its reading place and khatma over to the new default edition.
  if (EDS.harmain && load("edition", null) === null && edition !== "harmain" && (load("lastPage", null) !== null || load("khatma", null))) {
    var to = edition; useEdition("harmain"); switchEdition(to);
  }
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
    if (hj) html += '<div class="hj-bar">' + ic("moon") + "<span>" + new Date().toLocaleDateString("ar-EG", { weekday: "long" }) + " " + hj.text + "</span>" + (fs ? "<small>يُستحب صيامه: " + fs + "</small>" : "") + "</div>";
    html += '<div class="home-row"><button class="mini" id="tPrayer">' + ic("clock") + "<span>" + prayerTileText() + "</span></button>" + goalCard() + "</div>";
    html += khatmaCard();
    view.innerHTML = html + '<div id="idx"></div>';
    document.getElementById("kCard").onclick = function () { location.hash = "#/khatma"; };
    document.getElementById("tPrayer").onclick = function () { location.hash = "#/prayer"; };
    document.getElementById("tGoal").onclick = goalDialog;
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
    if (hifz.on) hifzMount(Q.t[s - 1].map(function (t, i) { return s + ":" + (i + 1); }), function () {
      view.querySelectorAll(".ayah").forEach(function (x) { x.classList.toggle("hid", !hifz.shown[s + ":" + x.dataset.a]); });
    });
    view.querySelector(".quran").addEventListener("click", function (e) {
      var sp = e.target.closest(".ayah"); if (!sp) return;
      if (hifz.on) return hifzFlip(s + ":" + sp.dataset.a);
      view.querySelectorAll(".ayah.sel").forEach(function (x) { x.classList.remove("sel"); });
      sp.classList.add("sel");
      save("last", [s, +sp.dataset.a]);
      ayahBar(s, +sp.dataset.a, function () { sp.classList.remove("sel"); });
    });

    var target = document.getElementById("a" + a);
    if (a > 1 && target) {
      target.classList.add("sel");
      setTimeout(function () { target.scrollIntoView({ block: "center" }); }, 0);
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
    view.innerHTML = '<input id="q" class="input" type="search" placeholder="ابحث في الآيات والسور والأذكار، أو ٢:٢٥٥" autocomplete="off">' +
      '<div id="res"></div>';
    var input = document.getElementById("q"), res = document.getElementById("res");
    input.value = q || lastQuery;
    var timer, hq = "";
    function run() {
      hq = "";
      var raw = input.value.trim(); lastQuery = raw;
      history.replaceState(null, "", "#/search?q=" + encodeURIComponent(raw));
      if (!raw) { res.innerHTML = '<p class="hint">ابحث بالكلمات دون تشكيل، مثل: الصلاة، يؤمنون، الرحمن. أو اكتب رقم السورة والآية مثل 2:255.</p>' + SEARCH_HELP; return; }
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
        var zk = [];
        (window.AZKAR || []).forEach(function (z) { var t = z.t || z.m || z.e; if (t && norm(t).indexOf(nr) >= 0) zk.push(['#/azkar/' + (z.only || "m"), t, "الأذكار"]); });
        (window.DUAS || []).forEach(function (c) { c.items.forEach(function (z) { if (z.t && norm(z.t).indexOf(nr) >= 0) zk.push(["#/duas/" + c.id, z.t, c.name]); }); });
        if (zk.length) extra += '<div class="sr-sec"><b>في الأذكار والأدعية</b>' + zk.slice(0, 6).map(function (x) { return '<a class="sr-zk" href="' + x[0] + '"><small>' + x[2] + "</small>" + x[1].slice(0, 110) + (x[1].length > 110 ? "…" : "") + "</a>"; }).join("") + "</div>";
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
    return EDS[edition].tj && n >= Q.first && n <= Q.last ? '<img class="tjo" alt="" loading="lazy" src="' + EDS[edition].tj + pad(n) + '.webp" onerror="this.remove()">' : "";
  }
  // Tablet held sideways: two pages side by side like an open mushaf (the even page on the right, as printed: 2-3, 4-5, ...).
  function spreadOn() { return mode === "pages" && spreadPref && window.innerWidth > window.innerHeight && window.innerWidth >= 900 && window.innerHeight >= 500; }
  var lastSpread = null;
  window.addEventListener("resize", function () {
    if (/^#\/p\//.test(location.hash) && lastSpread !== null && spreadOn() !== lastSpread) route();
  });
  // ---------- vertical reading: every page of the edition in one scroll ----------
  var vCur = 0, vHold = false;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function showPagesV(n, hl) {
    var ed = EDS[edition], ratio = edition === "harmain" ? 160.6 : edition === "kfgqpc" ? 143.7 : 141.4, html = '<div class="vpages">';
    btnBack.hidden = false;
    document.body.classList.add("vread");
    for (var p = Q.min; p < Q.count; p++)
      html += '<div class="page-box vp" data-p="' + p + '" style="padding-top:' + ratio + '%"><img loading="lazy" alt="صفحة ' + p + '" src="' + ed.dir + pad(p) + '.avif">' + tjLayer(p) + "</div>";
    view.innerHTML = html + '</div><div class="vbar"><button id="vPlay" class="dark-btn play-btn" aria-label="استماع">' + ic("aplay") +
      '</button><button id="vDark" class="dark-btn" aria-label="قراءة ليلية">' + ic(pageIsDark() ? "sun" : "moon") + "</button></div>";
    var list = view.querySelector(".vpages"), hl0 = hl;
    function boxOf(p) { return list.querySelector('.page-box[data-p="' + p + '"]'); }
    // An image that is not the usual page shape: set its real height, keeping the place being read still.
    list.addEventListener("load", function (e) {
      var im = e.target; if (im.tagName !== "IMG" || im.classList.contains("tjo")) return;
      var bx = im.parentNode, r = im.naturalHeight / im.naturalWidth * 100;
      if (Math.abs(r - ratio) < 0.3) return;
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
    }
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
    list.addEventListener("click", function (e) {
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
        if (!/\?a=/.test(location.hash)) history.replaceState(null, "", "#/p/" + p); save(edKey("lastPage"), p); trackPage(p); }
    }
  }, { passive: true });

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
  function autoSet(on) {
    auto.on = on; auto.t = 0; auto.acc = 0;
    document.body.classList.toggle("autoing", on);
    var bar = document.getElementById("autoBar");
    if (!on) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement("div"); bar.id = "autoBar"; bar.className = "auto-bar";
      bar.innerHTML = '<button data-c="slow" aria-label="أبطأ">−</button><span class="auto-sp"></span><button data-c="fast" aria-label="أسرع">+</button><button data-c="stop" class="auto-stop">إيقاف</button>';
      bar.onclick = function (e) {
        var c = (e.target.closest("button") || {}).dataset; c = c && c.c; if (!c) return;
        if (c === "stop") return autoSet(false);
        auto.speed = Math.max(0, Math.min(SPEEDS.length - 1, auto.speed + (c === "fast" ? 1 : -1))); save("autoSpeed", auto.speed);
        bar.querySelector(".auto-sp").textContent = "السرعة " + ar(auto.speed + 1);
      };
      document.body.appendChild(bar);
    }
    bar.querySelector(".auto-sp").textContent = "السرعة " + ar(auto.speed + 1);
    requestAnimationFrame(autoStep);
  }
  document.getElementById("btnAuto").onclick = function () { autoSet(!auto.on); };

  var shownPage = 0;
  function showPage(n, hl) {
    if (turnMode === "v" && !hifz.on) return showPagesV(n, hl);
    shownPage = n;
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
    view.innerHTML = cap + '<div class="page-wrap' + (sp ? " spread" : "") + '">' + (sp ? '<div class="spread-row">' : "") + pages.map(function (p) {
        return '<div class="page-box" data-p="' + p + '"><img' + (p === n ? ' id="pg"' : "") + ' alt="صفحة ' + p + '" src="' + EDS[edition].dir + pad(p) + '.avif">' + tjLayer(p) + "</div>";
      }).join("") + (sp ? "</div>" : "") + "</div>" +
      '<div class="page-tools"><button id="pHifz">' + ic(hifz.on ? "eye" : "eyeoff") + (hifz.on ? "إنهاء وضع الحفظ" : "وضع الحفظ") + '</button><button id="pMark">' + ic("mark") + 'علامة على هذه الصفحة</button><a class="tj-key" href="#/tajweed">' + ic("book") + "دليل ألوان التجويد</a></div>" +
      '<p class="page-info">' + info + "</p>" +
      '<div class="page-nav"><button id="pPrev">' + ic("right") + 'السابقة</button><input id="pNum" type="number" inputmode="numeric" min="' + Q.min + '" max="' + (Q.count - 1) +
      '" value="' + n + '"><button id="pNext">التالية' + ic("left") + '</button>' +
      '<button id="pPlay" class="dark-btn play-btn" aria-label="استماع">' + ic("aplay") + "</button>" +
      '<button id="pDark" class="dark-btn" aria-label="قراءة ليلية">' + ic(pageIsDark() ? "sun" : "moon") + "</button></div>" +
      (cap ? "" : '<p class="hint page-tip">اضغط على أي آية في الصفحة لتظليلها ونسخها.</p>');
    var box = view.querySelector('.page-box[data-p="' + n + '"]'), boxes = view.querySelectorAll(".page-box");
    function boxOf(p) { return view.querySelector('.page-box[data-p="' + p + '"]'); }
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
    if (first && first.offsetTop > window.innerHeight * 0.6) window.scrollTo(0, first.getBoundingClientRect().top - window.innerHeight / 3);
    save(edKey("lastPage"), n);
    trackPage(pages[0]);
    (sp ? [base - 2, base - 1, base + 2, base + 3] : [n - 1, n + 1]).forEach(function (k) { if (k >= Q.min && k < Q.count) new Image().src = EDS[edition].dir + pad(k) + ".avif"; });

    // Tapping the scan picks the ayah under the finger, using the same measured boxes.
    boxes.forEach(function (bx) {
      bx.addEventListener("click", function (e) {
        if (Date.now() - dragEnd < 400) return;
        var r = bx.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 1000, y = (e.clientY - r.top) / r.height * 1000;
        var hit = ayahAt(+bx.dataset.p, x, y);
        if (hifz.on) { if (hit) hifzFlip(hit[0] + ":" + hit[1]); return; }
        if (!hit || (hl && hl.s === hit[0] && hl.a === hit[1])) mark(null); else mark(hit[0], hit[1]);
      });
    });
    document.getElementById("pHifz").onclick = function () { hifzToggle(); };
    if (hifz.on) {
      var items = [];
      for (var hs = surahOfPage(pages[0] - 1); hs <= surahOfPage(pages[pages.length - 1]) && hs <= 114; hs++)
        for (var ha = 1; ha <= Q.s[hs - 1][3]; ha++) {
          var rs = (Q.r && Q.r[hs - 1] && Q.r[hs - 1][ha - 1]) || [];
          if (rs.some(function (b) { return pages.indexOf(b[0]) >= 0; })) items.push(hs + ":" + ha);
        }
      hifzMount(items, function () {
        view.querySelectorAll(".hifz-mask").forEach(function (x) { x.remove(); });
        items.forEach(function (k) {
          if (hifz.shown[k]) return;
          var sa = k.split(":");
          Q.r[sa[0] - 1][sa[1] - 1].forEach(function (b) {
            var bx = boxOf(b[0]); if (!bx) return;
            var d = document.createElement("div"); d.className = "hifz-mask";
            d.style.cssText = "left:" + b[1] / 10 + "%;top:" + (b[2] + 5) / 10 + "%;width:" + (b[3] - b[1]) / 10 + "%;height:" + (b[4] - b[2] - 9) / 10 + "%";
            bx.appendChild(d);
          });
        });
      });
      // Revealing the page's last ayah turns to the next page by itself.
      hifz.next = function () { if (n + (sp ? 2 : 1) < Q.count) turn(1); };
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

  // Ayah boxes grouped by page, built on first use: byPage[n] = [[s, a, x0, y0, x1, y1], ...].
  var byPage = null;
  function ayahAt(n, x, y) {
    if (!Q.r) return null;
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
  function pageTurnFx(box, n, k, commit) { return flipMode === "slide" ? pageSlide(box, n, k, commit) : pageCurl(box, n, k, commit); }
  // Sideways slide: the page moves with the finger and the next one comes in beside it (from the left going forward,
  // as the mushaf reads right to left). Same controls as pageCurl.
  function pageSlide(box, n, k, commit) {
    var r = box.getBoundingClientRect(), W = r.width, H = r.height;
    if (curling || !W || !H) return null;
    curling = true;
    var fwd = k > n, GAP = 16;
    var layer = document.createElement("div"); layer.className = "curl slide";
    layer.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + W + "px;height:" + H + "px";
    var cur = box.cloneNode(true), nxt = el('<div class="page-box"><img alt="" src="' + EDS[edition].dir + pad(k) + '.avif">' + tjLayer(k) + "</div>").firstChild;
    cur.classList.add("curl-page"); nxt.classList.add("curl-page");
    layer.appendChild(cur); layer.appendChild(nxt); document.body.appendChild(layer);
    box.style.visibility = "hidden";
    var x = 0, dir = fwd ? 1 : -1;   // x: how far the current page has moved, in the turning direction
    function draw() {
      cur.style.transform = "translateX(" + (dir * x).toFixed(1) + "px)";
      nxt.style.transform = "translateX(" + (dir * (x - W - GAP)).toFixed(1) + "px)";
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
      drag: function (dx) { x = Math.max(0, Math.min(W + GAP, dir * dx)); draw(); },
      finish: function (v) {
        var sp = v ? dir * v : 0, ok = v === null || (v !== false && (sp > 0.3 || (x > W * 0.3 && sp > -0.2)));
        var to = ok ? W + GAP : 0;
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
      b.classList.add("curl-page"); return b;
    }
    function shade(cls, parent) { var d = document.createElement("div"); d.className = "curl-shade " + cls; parent.appendChild(d); return d; }
    var layer = document.createElement("div"); layer.className = "curl";
    layer.style.cssText = "left:" + r.left + "px;top:" + r.top + "px;width:" + W + "px;height:" + H + "px";
    var under = sheetOf(fwd ? k : n), sheet = sheetOf(fwd ? n : k), flap = sheet.cloneNode(true), wrapF = document.createElement("div");
    flap.classList.add("curl-back"); wrapF.className = "curl-flap";
    flap.insertAdjacentHTML("beforeend", '<div class="curl-paper"></div>');
    var us = shade("curl-ushade", under), fs = shade("curl-fshade", sheet), bs = shade("curl-bshade", flap);
    wrapF.appendChild(flap); layer.appendChild(under); layer.appendChild(sheet); layer.appendChild(wrapF);
    document.body.appendChild(layer);

    var cy = H, t = fwd ? 0 : 1, dy = 0, RECT = [[0, 0], [W, 0], [W, H], [0, H]];
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
      var px = 2 * W * t, py = cy + dy - (cy ? 1 : -1) * Math.sin(Math.PI * t) * H * 0.07;
      // The sheet stays bound at the spine: P can't be farther from the spine corners than the paper reaches.
      [[W, cy, W], [W, H - cy, Math.sqrt(W * W + H * H)]].forEach(function (a) {
        var ex = px - a[0], ey = py - a[1], d = Math.sqrt(ex * ex + ey * ey);
        if (d > a[2]) { px = a[0] + ex * a[2] / d; py = a[1] + ey * a[2] / d; }
      });
      var vx = px, vy = py - cy, len = Math.sqrt(vx * vx + vy * vy);
      if (len < 0.5) { sheet.style.clipPath = sheet.style.webkitClipPath = ""; wrapF.style.display = "none"; us.style.opacity = 0; return; }
      wrapF.style.display = "";
      var nx = vx / len, ny = vy / len, mx = px / 2, my = (cy + py) / 2, c = mx * nx + my * ny, deg = Math.atan2(ny, nx) * 180 / Math.PI;
      sheet.style.clipPath = sheet.style.webkitClipPath = cut(nx, ny, c, 1);
      flap.style.clipPath = flap.style.webkitClipPath = cut(nx, ny, c, -1);
      flap.style.transform = "matrix(" + [1 - 2 * nx * nx, -2 * nx * ny, -2 * nx * ny, 1 - 2 * ny * ny, 2 * c * nx, 2 * c * ny].map(function (v) { return v.toFixed(4); }).join(",") + ")";
      var s = Math.min(1, len / 90);
      place(us, mx, my, deg + 180); us.style.opacity = s;
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
      grab: function (y) { cy = y < H / 2 ? 0 : H; draw(); },
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
          else if (c === "dl") saveSurah(cur.s);
          else if (c === "sp") { ratesOpen = !ratesOpen; show(); }
          else if (c === "r") { rate = +b.dataset.r; save("rate", rate); setRate(); ratesOpen = false; show(); }
          else if (c === "rp") { reps = REPS[(REPS.indexOf(reps) + 1) % REPS.length]; save("repeat", reps); show(); toast(reps === 1 ? "بدون تكرار" : reps ? "تكرار كل آية " + ar(reps) + " مرات" : "تكرار الآية بلا توقف"); }
        };
      }
      bar.classList.toggle("rates", ratesOpen);
      bar.innerHTML = '<div class="pl-info"><b>' + Q.s[cur.s - 1][0] + " · " + (cur.step === "b" ? "البسملة" : "آية " + ar(cur.a)) + (reps !== 1 && cur.step === "a" ? " · " + ar(Math.min(heard + 1, reps || heard + 1)) + (reps ? "/" + ar(reps) : "") : "") + "</b><span>" + (range ? "المقطع " + ar(range.from) + "–" + ar(range.to) +
        (range.times !== 1 ? " · " + (range.times ? ar(range.done + 1) + "/" + ar(range.times) : "∞") : "") + " · " : "") + reciterName() + "</span></div>" +
        (ratesOpen ? '<div class="pl-rates">' + RATES.map(function (r) { return '<button data-c="r" data-r="' + r + '"' + (r === rate ? ' class="on"' : "") + ">" + rateText(r) + "</button>"; }).join("") + "</div>" : "") +
        '<div class="pl-btns"><button data-c="sp" class="pl-sp' + (rate !== 1 ? " on" : "") + '" aria-label="سرعة التلاوة">' + rateText(rate) + "</button>" +
        '<button data-c="rp" class="pl-rep' + (reps !== 1 ? " on" : "") + '" aria-label="تكرار الآية">' + ic("rep") + (reps === 1 ? "" : "<i>" + (reps ? ar(reps) : "∞") + "</i>") + "</button>" +
        '<button data-c="pv" aria-label="الآية السابقة">' + ic("aprev") + '</button><button data-c="pp" class="pl-main" aria-label="' + (playing ? "إيقاف مؤقت" : "تشغيل") + '">' +
        ic(playing ? "apause" : "aplay") + '</button><button data-c="nx" aria-label="الآية التالية">' + ic("anext") + "</button>" +
        (window.AppBridge ? '<button data-c="dl" aria-label="حفظ السورة للاستماع بدون إنترنت">' + ic("dl") + "</button>" : "") +
        '<button data-c="st" aria-label="إيقاف">' + ic("astop") + "</button></div>";
    }
    // Downloads every ayah of the surah once, so it plays without internet.
    var saving = false;
    function saveSurah(s) {
      if (saving) return toast("جارٍ الحفظ…");
      saving = true; var n = Q.s[s - 1][3], done = 0, failed = 0, rec = reciter;
      toast("جارٍ حفظ سورة " + Q.s[s - 1][0] + "…");
      function one(a) {
        if (a > n) {
          saving = false;
          return toast(failed ? "تعذّر حفظ " + ar(failed) + " آية، حاول مرة أخرى" : "حُفظت سورة " + Q.s[s - 1][0] + " بصوت " + reciterName() + " للاستماع بدون إنترنت");
        }
        fetch("https://everyayah.com/data/" + rec + "/" + pad(s) + pad(a) + ".mp3").then(function (r) { if (!r.ok) throw 0; done++; })
          .catch(function () { failed++; }).then(function () { if (done && done % 20 === 0) toast(ar(done) + " من " + ar(n)); one(a + 1); });
      }
      one(1);
    }
    return { play: function (s, a) { range = null; start(s, a); },
      // onDone: called when the passage has finished by itself (not when it is stopped).
      // onRep: after each time through the passage.
      playRange: function (s, a, b, times, onDone, onRep) { range = { s: s, from: a, to: b, times: times === undefined ? 1 : times, done: 0, onDone: onDone, onRep: onRep }; start(s, a); }, paint: function () { paint(false); }, stop: stop,
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
  function hifzToggle() { hifz.on = !hifz.on; hifz.shown = {}; if (!hifz.on) { hifz.test = null; reciteStop(); } var y = window.scrollY; route(); hifzBar(); window.scrollTo(0, y); }
  function hifzMount(items, paint) { hifz.items = items; hifz.shown = {}; hifz.paint = paint; hifz.next = null; paint(); hifzBar(); }
  function hifzFlip(k) {
    hifz.shown[k] = !hifz.shown[k];
    // In a test on the mushaf, an ayah tapped open counts as forgotten; one opened with «افتكرتها» counts as remembered.
    if (hifz.test && hifz.shown[k]) { hifz.test.seen[k] = 1; hifz.test.miss[k] = 1; }
    hifz.paint(); hifzBar(); hifzRevealed(k);
  }
  // The hifz test on the pages of the chosen edition: whole ayat are hidden, and the score is the share remembered.
  function hifzTestPages(s, a) {
    hifz.on = true; hifz.shown = {}; hifz.test = { s: s, a: a, seen: {}, miss: {} };
    recite.ok = recite.words = 0; recite.bad = {}; recite.wrong = []; recite.k = null; recite.base = null;
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
  function hifzTestDone() {
    var t = hifz.test, seen = Object.keys(t.seen).length, miss = Object.keys(t.miss).length;
    if (!seen) return toast("اكشف آية واحدة على الأقل الأول");
    var score = Math.round((seen - miss) / seen * 100), s = t.s, rw = recite.words, rb = recite.wrong.slice();
    if (rw) { var log = load("reciteLog", []); log.unshift({ d: todayStr(), s: s, ay: seen, w: rw, bad: rb.length, wrong: rb.slice(0, 40) }); save("reciteLog", log.slice(0, 60)); }
    var D = hifzLogData(); if (D[s]) { D[s].r = todayStr(); D[s].score = score; save("hifzLog", D); }
    var res = load("hifzScores", {}); res[s] = { d: todayStr(), score: score }; save("hifzScores", res);
    hifzToggle();
    if (rw) reciteSummary({ ay: seen, w: rw, bad: rb.length, wrong: rb });
    else cheer(ar(score) + "٪: افتكرت " + ar(seen - miss) + " من " + ar(seen) + " آية");
  }
  // On a mushaf page, once the last ayah is revealed (and so every ayah is), the next page comes after a moment to read it.
  function hifzRevealed(k) {
    var items = hifz.items, next = hifz.next;
    if (!next || !hifz.shown[k] || k !== items[items.length - 1] || items.some(function (x) { return !hifz.shown[x]; })) return;
    setTimeout(function () { if (hifz.on && hifz.next === next && hifz.shown[k]) next(); }, 1200);
  }
  function hifzBar() {
    var bar = document.getElementById("hifzBar");
    document.body.classList.toggle("has-hifz", hifz.on);
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
        hifz.paint(); hifzBar();
        if (c === "nx" && k) hifzRevealed(k);
      };
    }
    var n = hifz.items.filter(function (x) { return hifz.shown[x]; }).length;
    var T = hifz.test, tm = T ? Object.keys(T.miss).length : 0, ts = T ? Object.keys(T.seen).length : 0;
    bar.innerHTML = (T ? '<div class="hz-info"><b>' + (recite.on ? "بسمع…" : "اختبار الحفظ") + "</b><span>" + (recite.words ? "كلمات صح " + ar(recite.words - recite.wrong.length) + " · غلط " + ar(recite.wrong.length) : "افتكرت " + ar(ts - tm) + " · نسيت " + ar(tm)) + "</span></div>" :
      '<div class="hz-info"><b>وضع الحفظ</b><span>' + ar(n) + " من " + ar(hifz.items.length) + " آية ظاهرة</span></div>") +
      '<div class="hz-btns"><button data-c="nx" class="hz-main">' + ic("eye") + (T ? "افتكرتها" : "اكشف التالية") + "</button>" + (T ? '<button data-c="mic"' + (recite.on ? ' class="rec"' : "") + ' aria-label="سمّع بصوتك">' + ic("mic") + '</button><button data-c="done">' + ic("check") + "خلصت</button>" : "") + (T ? "" : '<button data-c="pv" aria-label="أخفِ آخر آية">' + ic("eyeoff") + "</button>") +
      (T ? "" : '<button data-c="all">الكل</button><button data-c="none">إخفاء</button>') + '<button data-c="x" aria-label="إنهاء وضع الحفظ">' + ic("x") + "</button></div>";
  }

  // ---------- التسميع بالصوت ----------
  // In the hifz test, the reader recites from memory and the phone's speech recogniser (ReciteBridge) hears it. Each heard
  // word is matched to the next hidden ayah's words; an ayah shows once its last word is reached, wrong or skipped words are
  // kept for the summary, and the page turns by itself after its last ayah (hifzRevealed). q.reciteLog keeps every session.
  var recite = { on: false, k: null, pos: 0, bad: {}, ok: 0, words: 0, base: null, wrong: [] };
  function rSkel(w) { return norm(w).replace(/[اءؤئوي]/g, ""); }
  function rSame(a, b) {
    if (!a || !b) return false; if (a === b) return true;
    var m = a.length, n = b.length, d = [], i, j; for (j = 0; j <= n; j++) d[j] = j;
    for (i = 1; i <= m; i++) { var p = d[0]; d[0] = i; for (j = 1; j <= n; j++) { var t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } }
    return 1 - d[n] / Math.max(m, n) >= 0.6;
  }
  function rWords(k) { var sa = k.split(":"); return Q.t[sa[0] - 1][sa[1] - 1].split(" ").filter(function (w) { return norm(w).replace(/\s/g, ""); }); }
  // The next hidden ayah from where the test started (ayat of an earlier surah on the same page are left alone).
  function rNext() {
    var t = hifz.test, st = t ? t.s * 1000 + (t.a || 1) : 0, hid = hifz.items.filter(function (x) { return !hifz.shown[x]; });
    return hid.filter(function (x) { var sa = x.split(":"); return sa[0] * 1000 + +sa[1] >= st; })[0] || hid[0] || null;
  }
  // Replays one utterance's words from the state at its start, so partial results can be redone as they grow.
  function reciteHear(text, fin) {
    if (!recite.on || !hifz.on) return;
    if (!recite.base) recite.base = { k: recite.k, pos: recite.pos, bad: JSON.stringify(recite.bad), ok: recite.ok, words: recite.words, wrong: recite.wrong.length, shown: JSON.stringify(hifz.shown) };
    var b = recite.base;
    recite.k = b.k; recite.pos = b.pos; recite.bad = JSON.parse(b.bad); recite.ok = b.ok; recite.words = b.words; recite.wrong.length = b.wrong;
    var shownBefore = JSON.parse(b.shown), heard = norm(text).split(" ").filter(Boolean).map(rSkel), revealed = [];
    hifz.items.forEach(function (x) { hifz.shown[x] = !!shownBefore[x]; });
    if (!recite.k || hifz.shown[recite.k]) { recite.k = rNext(); recite.pos = 0; }
    for (var h = 0; h < heard.length && recite.k; h++) {
      var exp = rWords(recite.k).map(rSkel), pos = recite.pos;
      if (rSame(heard[h], exp[pos]) || (h + 1 < heard.length && rSame(heard[h] + heard[h + 1], exp[pos]) && ++h)) { recite.ok++; recite.pos++; }
      else if (pos + 1 < exp.length && rSame(heard[h], exp[pos + 1])) { recite.bad[recite.k + ":" + pos] = 1; recite.pos += 2; recite.ok++; }
      else if (pos > 0 && rSame(heard[h], exp[pos - 1])) continue;          // a repeated word
      else { recite.bad[recite.k + ":" + pos] = 1; recite.pos++; }
      if (recite.pos >= exp.length) {
        var k = recite.k, miss = Object.keys(recite.bad).filter(function (x) { return x.indexOf(k + ":") === 0; });
        recite.words += exp.length; hifz.shown[k] = true; hifz.test.seen[k] = 1; if (miss.length) hifz.test.miss[k] = 1; else delete hifz.test.miss[k];
        miss.forEach(function (x) { var w = rWords(k)[+x.split(":")[2]]; recite.wrong.push([k, w]); });
        revealed.push(k); recite.k = rNext(); recite.pos = 0;
      }
    }
    hifz.paint(); hifzBar();
    if (fin) { recite.base = null; revealed.forEach(hifzRevealed); }
  }
  window.onRecite = function (text, kind) {
    if (kind.indexOf("state:") === 0) {
      var st = kind.slice(6);
      if (st === "noperm") toast("محتاج إذن الميكروفون عشان التسميع");
      else if (st === "none") toast("الموبايل مفيهوش خدمة التعرّف على الكلام");
      else if (st.indexOf("error") === 0) toast("التسميع وقف (" + st.slice(6) + ")، دوس على المايك تاني");
      if (st !== "listening") { recite.on = false; recite.base = null; } hifzBar(); return;
    }
    reciteHear(text, kind === "final");
  };
  function reciteToggle() {
    if (recite.on) { recite.on = false; recite.base = null; try { ReciteBridge.stop(); } catch (e) {} hifzBar(); return; }
    if (!window.ReciteBridge) return toast("التسميع بالصوت شغال في التطبيق على الموبايل بس");
    recite.on = true; recite.k = rNext(); recite.pos = 0; recite.base = null; ReciteBridge.start(); hifzBar();
  }
  function reciteStop() { if (recite.on) { recite.on = false; try { ReciteBridge.stop(); } catch (e) {} } }

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
    if (d.querySelector(".dlg-del")) d.querySelector(".dlg-del").onclick = function () { put(""); };
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
  function trackPage(n) {
    statPage(n);
    var k = load(edKey("khatma"), null);
    if (!k || n - 1 < k.from || n - 1 <= k.done || n - 1 > k.done + 2) return;   // only pages turned in order
    k.done = Math.min(k.to, n - 1); save(edKey("khatma"), k);
    rewardCheck();
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
  // Distinct mushaf pages opened each day (q.stats = {"Y-M-D": [pages]}), the last 120 days kept.
  function statPage(n) {
    var st = load("stats", {}), d = todayStr(), a = st[d] || (st[d] = []);
    if (a.indexOf(n) >= 0) return;
    a.push(n);
    var g = load("goal", { pages: 0 }); if (g.pages && a.length === g.pages) setTimeout(function () { cheer("حققت هدف النهارده: " + ar(g.pages) + " صفحة"); }, 400);
    var wl = load("statsWL", {}), c = pageWL(n), x = wl[d] || (wl[d] = [0, 0]); x[0] += c[0]; x[1] += c[1];
    Object.keys(wl).forEach(function (k) { if (!st[k] && k !== d) delete wl[k]; }); save("statsWL", wl);
    var keys = Object.keys(st); if (keys.length > 120) keys.sort(function (x, y) { return parseDay(x) - parseDay(y); }).slice(0, keys.length - 120).forEach(function (k) { delete st[k]; });
    save("stats", st);
  }
  // Words and letters on a mushaf page of the current edition (letters without tashkeel or signs).
  var wlCache = {};
  function pageWL(n) {
    var key = edition + n; if (wlCache[key]) return wlCache[key];
    var w = 0, l = 0;
    for (var s = 0; s < 114; s++) for (var a = 0; a < Q.p[s].length; a++) if (Q.p[s][a] === n) {
      var t = Q.t[s][a]; w += t.split(/\s+/).filter(function (x) { return /[\u0621-\u064A\u0671]/.test(x); }).length; l += (t.match(/[\u0621-\u064A\u0671]/g) || []).length;
    }
    return (wlCache[key] = [w, l]);
  }
  function wlSum(from, days) { var wl = load("statsWL", {}), r = [0, 0]; for (var i = 0; i < days; i++) { var t = new Date((from - i) * 864e5), k = t.getUTCFullYear() + "-" + (t.getUTCMonth() + 1) + "-" + t.getUTCDate(); if (wl[k]) { r[0] += wl[k][0]; r[1] += wl[k][1]; } } return r; }
  function statsHtml() {
    var st = load("stats", {}), today = dayNum(new Date()), cnt = function (dn) { var t = new Date(dn * 864e5), k = t.getUTCFullYear() + "-" + (t.getUTCMonth() + 1) + "-" + t.getUTCDate(); return (st[k] || []).length; };
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
    html += ramadanHtml() + "</section>" + statsHtml() + rewardsHtml() +
      '<section class="kh-sec"><h3>' + ic("check") + 'متابعة الحفظ</h3><button class="kh-main" id="kHifz">' + ic("book") + hifzSummary() + "</button></section>" +
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
      else if (e.target.closest(".mk-del")) { M.splice(i, 1); save("marks", M); showKhatma(); toast("حُذفت العلامة"); }
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
      '<button class="z-all" id="zAll">' + ic("aplay") + "استمع للكل</button>" +
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
        '<button class="z-play" aria-label="استماع">' + ic("aplay") + "</button>" + '<button class="z-count" aria-label="عدّ">' +
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
    var allBtn = document.getElementById("zAll"), allOn = false;
    function allSet(on) {
      allOn = on; allBtn.classList.toggle("on", on);
      allBtn.innerHTML = ic(on ? "astop" : "aplay") + (on ? "إيقاف الاستماع" : "استمع للكل");
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
      player.stop();
      var text = (c.querySelector(".z-text") || c).textContent;
      (function again(k) {
        zikrSpeech.toggle(c, text, function () { said(1); if (k + 1 < reps && allOn) again(k + 1); else nx(); });
      })(0);
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

  // ---------- متابعة الحفظ ----------
  // q.hifzLog = {surah: {m: "Y-M-D" memorised, r: "Y-M-D" last revised}}. The one revised longest ago comes up for revision.
  function hifzLogData() { return load("hifzLog", {}); }
  function hifzStats() {
    var L = hifzLogData(), ay = 0, n = 0;
    Object.keys(L).forEach(function (s) { n++; ay += Q.s[+s - 1][3]; });
    return { n: n, ay: ay, pct: Math.round(ay / 6236 * 1000) / 10 };
  }
  function hifzSummary() { var h = hifzStats(); return h.n ? "حفظت " + ar(h.n) + " سورة (" + ar(h.pct) + "٪ من القرآن)" : "سجّل السور اللي حفظتها"; }
  function hifzDue() {
    var L = hifzLogData(), best = null;
    Object.keys(L).forEach(function (s) { var r = parseDay(L[s].r || L[s].m); if (!best || r < best.r) best = { s: +s, r: r }; });
    return best;
  }
  function showHifzLog() {
    titleEl.textContent = "متابعة الحفظ";
    btnBack.hidden = false;
    var L = hifzLogData(), h = hifzStats(), due = hifzDue(), today = dayNum(new Date());
    var html = '<div class="hl-top"><div class="hl-ring" style="--p:' + h.pct + '"><b>' + ar(h.pct) + "٪</b></div><div><b>حفظت " + ar(h.n) + " سورة</b><small>" + ar(h.ay) + " آية من ٦٢٣٦</small></div></div>";
    if (due) html += '<div class="hl-due">' + ic("rep") + "<div><small>راجع اليوم</small><b>سورة " + Q.s[due.s - 1][0] + "</b><small>آخر مراجعة من " + ar(today - due.r) + " يوم</small></div>" +
      '<button data-go="' + due.s + '">اقرأ</button><button data-test="' + due.s + '">اختبرني</button><button data-rev="' + due.s + '">راجعتها ✓</button></div>';
    html += '<button class="continue" id="hlMap">' + ic("grid") + ' خريطة الحفظ</button><p class="hint">اضغط على السورة لما تحفظها. وبعد ما تراجع سورة اضغط «راجعتها» عشان التطبيق يرشّح لك اللي بعدها.</p><ul class="hl-list">';
    for (var s = 1; s <= 114; s++) {
      var e = L[s];
      html += '<li data-s="' + s + '" class="' + (e ? "on" : "") + '"><span class="hl-n">' + ar(s) + "</span><b>" + Q.s[s - 1][0] + "</b>" +
        (e ? "<small>راجعتها من " + ar(today - parseDay(e.r || e.m)) + " يوم</small>" : "<small>" + ar(Q.s[s - 1][3]) + " آية</small>") + '<i class="hl-chk">' + (e ? "✓" : "") + "</i></li>";
    }
    view.innerHTML = '<div class="hl">' + html + "</ul></div>";
    function put(s, v) { var D = hifzLogData(); if (v) D[s] = v; else delete D[s]; save("hifzLog", D); syncAlarms(); var y = window.scrollY; showHifzLog(); window.scrollTo(0, y); }
    view.querySelectorAll(".hl-list li").forEach(function (li) { li.onclick = function () { var s = +li.dataset.s; put(s, L[s] ? null : { m: todayStr(), r: todayStr() }); }; });
    view.querySelectorAll("[data-rev]").forEach(function (b) { b.onclick = function () { var s = +b.dataset.rev, e = L[s]; e.r = todayStr(); put(s, e); toast("تقبّل الله، اتسجلت المراجعة"); }; });
    view.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { location.hash = "#/s/" + b.dataset.go + "/1"; }; });
    view.querySelectorAll("[data-test]").forEach(function (b) { b.onclick = function () { location.hash = "#/hifztest/" + b.dataset.test; }; });
    document.getElementById("hlMap").onclick = function () { location.hash = "#/hifzmap"; };
  }

  // ---------- نسخة احتياطية ----------
  // Everything the app keeps (bookmarks, khatma, notes, sebha, settings...) as one JSON file to share / save, and back.
  function exportBackup() {
    var data = { app: "quran-karim", v: 1, at: new Date().toISOString(), keys: {} };
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf("q.") === 0) data.keys[k] = localStorage.getItem(k); } } catch (e) {}
    var json = JSON.stringify(data), d = new Date(), name = "quran-backup-" + d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + ".json";
    try { if (window.AppBridge && AppBridge.shareFile) return AppBridge.shareFile(json, name); } catch (e) {}
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
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
  var PRE_MIN = [0, 5, 10, 15, 20, 30, 45, 60];
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
      o.text = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric" }).format(d);
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
      if (rc.hifz && rc.hifz.on) { var hd = hifzDue(); if (hd) ev.push({ at: at(rc.hifz.t), kind: "rem", title: "مراجعة الحفظ", text: "راجع اليوم سورة " + Q.s[hd.s - 1][0] + ".", hash: "#/hifzlog" }); }
      if (rc.stat && rc.stat.on) {
        var isToday = d === 0, sp = isToday ? (load("stats", {})[todayStr()] || []).length : 0, sw = isToday ? wlSum(dayNum(base), 1) : [0, 0];
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
    try { AppBridge.setAlarms(JSON.stringify(ev.filter(function (e) { return e.at > Date.now(); }))); } catch (e) {}
  }
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
        '<div class="pr-tiles"><button id="prMonth">' + ic("calendar") + "إمساكية رمضان</button><button id=\"prQibla\">" + ic("compass") + "اتجاه القبلة</button></div>";
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
  var TABS = [["#/", "home", "المصحف"], ["#/azkar", "sun", "الأذكار"], ["#/prayer", "clock", "الصلاة"], ["#/more", "grid", "المزيد"]];
  function tabbar() {
    var bar = document.getElementById("tabbar"), h = location.hash || "#/";
    if (!bar) {
      bar = document.createElement("nav"); bar.id = "tabbar";
      bar.innerHTML = TABS.map(function (t) { return '<button data-h="' + t[0] + '">' + ic(t[1]) + "<span>" + t[2] + "</span></button>"; }).join("");
      document.body.appendChild(bar);
      bar.querySelectorAll("button").forEach(function (b) { b.onclick = function () { location.hash = b.dataset.h; }; });
    }
    var cur = h === "#" ? "#/" : h;
    var show = cur === "#/" || /^#\/(azkar|prayer|more|duas|tasbih|qibla|khatma|hifzlog|hifztest|hifzmap|family|topics|imsakia|tajweed|qiraat)/.test(cur);
    bar.hidden = !show; document.body.classList.toggle("has-tabs", show);
    bar.querySelectorAll("button").forEach(function (b) {
      var t = b.dataset.h, on = t === "#/" ? cur === "#/" : cur.indexOf(t) === 0 || (t === "#/prayer" && /^#\/(imsakia|qibla)/.test(cur)) ||
        (t === "#/more" && /^#\/(duas|tasbih|khatma|hifz|family|topics|tajweed|qiraat)/.test(cur));
      b.classList.toggle("on", on);
    });
  }

  // ---------- خريطة الحفظ ----------
  // Every page of the current edition as a square, coloured from hifzLog (memorised surahs and when they were last revised).
  function showHifzMap() {
    titleEl.textContent = "خريطة الحفظ";
    btnBack.hidden = false;
    var L = hifzLogData(), sc = load("hifzScores", {}), today = dayNum(new Date()), cnt = [0, 0, 0, 0], cells = "";
    for (var n = Q.first; n <= Q.last; n++) {
      var ss = [], on = 0, age = 0, weak = false;
      for (var s = 1; s <= 114; s++) { var ps = Q.p[s - 1]; if (ps[0] <= n && ps[ps.length - 1] >= n) ss.push(s); }
      ss.forEach(function (s) { var e = L[s]; if (e) { on++; age = Math.max(age, today - parseDay(e.r || e.m)); if (sc[s] && sc[s].score < 70) weak = true; } });
      var c = !on ? 0 : on < ss.length ? 1 : age > 14 || weak ? 2 : 3; cnt[c]++;
      cells += '<a class="hm-c c' + c + '" href="#/p/' + n + '" title="' + ar(n) + '"></a>';
    }
    var tot = Q.last - Q.first + 1, pct = Math.round(cnt[3] * 1000 / tot + cnt[2] * 1000 / tot) / 10;
    var lg = [["c3", "محفوظة ومراجَعة", cnt[3]], ["c2", "محتاجة مراجعة", cnt[2]], ["c1", "محفوظة جزئيًا", cnt[1]], ["c0", "لسه", cnt[0]]];
    view.innerHTML = '<div class="hm"><div class="hl-top"><div class="hl-ring" style="--p:' + pct + '"><b>' + ar(pct) + "٪</b></div><div><b>" + ar(cnt[2] + cnt[3]) + " صفحة محفوظة</b><small>من " + ar(tot) + " صفحة</small><small>" + EDS[edition].name + "</small></div></div>" +
      '<div class="hm-lg">' + lg.map(function (l) { return '<span><i class="hm-c ' + l[0] + '"></i>' + l[1] + " (" + ar(l[2]) + ")</span>"; }).join("") + "</div>" +
      '<div class="hm-grid">' + cells + "</div>" +
      '<p class="hint">كل مربع صفحة، اضغط عليه يفتحها. «محتاجة مراجعة» لو آخر مراجعة من أكتر من ١٤ يوم أو نتيجة الاختبار أقل من ٧٠٪.</p>' +
      '<button class="continue" id="hmLog">' + ic("check") + " سجّل السور اللي حفظتها</button></div>";
    document.getElementById("hmLog").onclick = function () { location.hash = "#/hifzlog"; };
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
    var T = [["#/khatma", "target", "الختمة والعلامات", "kh"], ["#/duas", "hands", "أدعية مختارة", "sun"], ["#/tasbih", "beads", "السبحة", "sun"],
      ["#/hifzlog", "check", "متابعة الحفظ", "qib"], ["#/hifztest", "eyeoff", "اختبار الحفظ", "tjw"], ["#/qibla", "compass", "اتجاه القبلة", "qib"],
      ["#/tajweed", "wave", "أحكام التجويد", "tjw"], ["#/qiraat", "book", "القراءات العشر", "qra"], ["#/imsakia", "calendar", "إمساكية رمضان", "kh"],
      ["#/topics", "list", "مواضيع القرآن", "qra"], ["#/hifzmap", "grid", "خريطة الحفظ", "tjw"], ["#/family", "users", "ختمة العيلة", "kh"]];
    view.innerHTML = '<div class="tiles more">' + T.map(function (t) { return '<button class="tile" data-h="' + t[0] + '"><span class="tile-ic ' + t[3] + '">' + ic(t[1]) + "</span>" + t[2] + "</button>"; }).join("") + "</div>" +
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
      var dots = '<div class="wel-dots">' + [0, 1, 2].map(function (i) { return "<i" + (i === step ? ' class="on"' : "") + "></i>"; }).join("") + "</div>", body;
      if (step === 0) body = '<div class="wel-ic">' + ic("book") + "</div><h2>أهلًا بيك في القرآن الكريم</h2><p>اختار المصحف اللي متعود تقرا فيه. تقدر تغيّره بعدين من الإعدادات.</p>" +
        '<div class="wel-opts">' + ["kfgqpc", "shamarly", "harmain"].filter(function (k) { return EDS[k]; }).map(function (k) { return '<button data-e="' + k + '"' + (k === edition && mode === "pages" ? ' class="on"' : "") + ">" + EDS[k].name + "</button>"; }).join("") +
        '<button data-e="text"' + (mode === "text" ? ' class="on"' : "") + ">نص مشكول (بدون صور)</button></div>";
      else if (step === 1) {
        var loc = load("qiblaLoc", null);
        body = '<div class="wel-ic">' + ic("pin") + "</div><h2>مدينتك</h2><p>عشان مواقيت الصلاة والأذان والقبلة. كل الحساب بيتم على الموبايل من غير إنترنت.</p>" +
          '<button class="continue" id="wGps">' + ic("pin") + ' استخدم موقعي</button><select class="input" id="wCity"><option value="">أو اختار مدينة…</option>' +
          CITIES.map(function (c, i) { return '<option value="' + i + '"' + (loc && loc[2] === c[0] ? " selected" : "") + ">" + c[0] + "</option>"; }).join("") + "</select>" +
          '<p class="wel-got">' + (loc ? "✓ " + (loc[2] || "اتحدد موقعك") : "") + "</p>";
      } else body = '<div class="wel-ic">' + ic("bell") + "</div><h2>تحب نفكّرك بإيه؟</h2><p>تقدر تغيّر المواعيد بعدين من شاشة الصلاة.</p>" +
        [["adhan", "الأذان في مواعيده"], ["m", "أذكار الصباح"], ["e", "أذكار المساء"], ["kahf", "الكهف يوم الجمعة"], ["stat", "ملخص قراءة اليوم"]].map(function (r) {
          var on = r[0] === "adhan" ? cfg.adhan.fajr : rc[r[0]].on;
          return '<label class="rem-row"><span class="rem-sw"><input type="checkbox" data-w="' + r[0] + '"' + (on ? " checked" : "") + "><span></span>" + r[1] + "</span></label>";
        }).join("");
      d.innerHTML = '<div class="wel-card">' + dots + body + '<div class="wel-btns"><button class="wel-skip">' + (step < 2 ? "تخطي" : "") + '</button><button class="wel-next">' + (step < 2 ? "التالي" : "يلا نبدأ") + "</button></div></div>";
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
      d.querySelectorAll("[data-w]").forEach(function (c) { c.onchange = function () {
        if (c.dataset.w === "adhan") ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach(function (k) { cfg.adhan[k] = c.checked; }); else rc[c.dataset.w].on = c.checked;
        save("prayer", cfg); save("reminders", rc);
        if (c.checked) try { if (window.AppBridge && AppBridge.askNotifications) AppBridge.askNotifications(); } catch (e) {}
      }; });
      d.querySelector(".wel-skip").onclick = done;
      d.querySelector(".wel-next").onclick = function () { if (step < 2) { step++; paint(); } else done(); };
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
  function todayPages() { return (load("stats", {})[todayStr()] || []).length; }
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
  function showHifzTest(s) {
    titleEl.textContent = "اختبار الحفظ";
    btnBack.hidden = false;
    var L = hifzLogData(), due = hifzDue(), st = load("hifzTest", { lv: 25 });
    if (!s) s = st.s || (due ? due.s : 1);
    var from = st.s === s && st.from ? st.from : 1, cnt = Q.s[s - 1][3], to = Math.min(cnt, from + 9), lv = st.lv || 25;
    var opts = ""; for (var i = 1; i <= 114; i++) opts += '<option value="' + i + '"' + (i === s ? " selected" : "") + ">" + ar(i) + ". " + Q.s[i - 1][0] + (L[i] ? " ✓" : "") + "</option>";
    // Hide every n-th word from a random start, so each round hides different words; the level is the share hidden.
    var html = '<div class="ht"><div class="ht-top"><select class="input" id="htS">' + opts + '</select><div class="z-sort ht-lv"><span>إخفاء</span>' +
      [[25, "ربع الكلمات"], [50, "النص"], [100, "كل الكلمات"]].map(function (x) { return '<button data-l="' + x[0] + '"' + (x[0] === lv ? ' class="on"' : "") + ">" + x[1] + "</button>"; }).join("") + "</div></div>" +
      '<p class="hint">اقرا من حفظك. لو نسيت كلمة اضغط عليها عشان تظهر، وفي الآخر اضغط «خلصت». الآيات ' + ar(from) + "–" + ar(to) + " من " + ar(cnt) + '.</p><div class="ht-text">';
    var hidden = 0;
    for (var a = from; a <= to; a++) {
      var every = lv === 100 ? 1 : lv === 50 ? 2 : 4, off = Math.floor(Math.random() * every);
      html += Q.t[s - 1][a - 1].split(" ").map(function (w, j) {
        if (!/[ء-يٱ]/.test(w) || (j + off) % every) return w;
        hidden++; return '<button class="ht-w">' + w + "</button>";
      }).join(" ") + ' <span class="ayah-no">﴿' + ar(a) + "﴾</span> ";
    }
    html += '</div><div class="ht-rec"><button class="continue" id="htRec">' + ic("mic") + ' سجّل تلاوتك</button><button class="continue" id="htQari">' + ic("aplay") + " اسمع القارئ</button></div>" +
      '<audio id="htAudio" controls hidden></audio>' +
      '<button class="continue ht-pg" id="htPages">' + ic("book") + " اختبرني على صفحات " + (mode === "pages" ? EDS[edition].name : "المصحف") + "</button>" +
      '<div class="ht-foot"><button class="continue" id="htDone">' + ic("check") + " خلصت</button>" +
      (to < cnt ? '<button class="continue" id="htNext">الآيات اللي بعدها</button>' : "") + '</div><p class="ht-res" id="htRes"></p>' + reciteHistory() + "</div>";
    view.innerHTML = html;
    var missed = 0, rec = null;
    document.getElementById("htQari").onclick = function () { player.playRange(s, from, to); };
    document.getElementById("htPages").onclick = function () { hifzTestPages(s, from); };
    document.getElementById("htRec").onclick = function () {
      var b = this, au = document.getElementById("htAudio");
      if (rec) { rec.stop(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) return toast("التسجيل مش متاح على الجهاز ده");
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        var parts = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = function (e) { parts.push(e.data); };
        rec.onstop = function () {
          stream.getTracks().forEach(function (t) { t.stop(); }); rec = null;
          au.src = URL.createObjectURL(new Blob(parts, { type: parts[0] ? parts[0].type : "audio/webm" })); au.hidden = false;
          b.innerHTML = ic("mic") + " سجّل تاني"; b.classList.remove("rec");
        };
        rec.start(); b.innerHTML = ic("astop") + " إيقاف التسجيل"; b.classList.add("rec");
      }).catch(function () { toast("محتاج إذن الميكروفون عشان تسجّل"); });
    };
    view.querySelectorAll(".ht-w").forEach(function (b) { b.onclick = function () { if (b.classList.contains("shown")) return; b.classList.add("shown", "miss"); missed++; }; });
    document.getElementById("htS").onchange = function () { save("hifzTest", { lv: lv, s: +this.value, from: 1 }); location.replace("#/hifztest/" + this.value); };
    view.querySelectorAll(".ht-lv button").forEach(function (b) { b.onclick = function () { save("hifzTest", { lv: +b.dataset.l, s: s, from: from }); showHifzTest(s); }; });
    if (document.getElementById("htNext")) document.getElementById("htNext").onclick = function () { save("hifzTest", { lv: lv, s: s, from: to + 1 }); showHifzTest(s); window.scrollTo(0, 0); };
    document.getElementById("htDone").onclick = function () {
      view.querySelectorAll(".ht-w:not(.shown)").forEach(function (b) { b.classList.add("shown", "ok"); });
      var score = hidden ? Math.round((hidden - missed) / hidden * 100) : 100;
      document.getElementById("htRes").innerHTML = "<b>" + ar(score) + "٪</b> افتكرت " + ar(hidden - missed) + " من " + ar(hidden) + " كلمة" + (score >= 90 ? "، ما شاء الله" : score >= 60 ? "، محتاجة مراجعة بسيطة" : "، راجعها تاني");
      var D = hifzLogData(); if (D[s]) { D[s].r = todayStr(); D[s].score = score; save("hifzLog", D); }
      var res = load("hifzScores", {}); res[s] = { d: todayStr(), score: score }; save("hifzScores", res);
    };
  }

  // ---------- السبحة ----------
  // A free counter: tap anywhere on the big circle. Each phrase keeps its own count; an optional target buzzes when reached.
  var TASBIH = ["سُبْحَانَ اللَّهِ", "الْحَمْدُ لِلَّهِ", "اللَّهُ أَكْبَرُ", "لَا إِلَهَ إِلَّا اللَّهُ", "أَسْتَغْفِرُ اللَّهَ",
    "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ"];
  function showTasbih() {
    titleEl.textContent = "السبحة";
    btnBack.hidden = false;
    var st = load("tasbih", { i: 0, c: {}, goal: 33, total: 0 });
    function cnt() { return st.c[st.i] || 0; }
    view.innerHTML = '<div class="tsb">' +
      '<div class="tsb-ph">' + TASBIH.map(function (t, i) { return '<button data-i="' + i + '">' + t + "</button>"; }).join("") + "</div>" +
      '<div class="z-sort tsb-goal"><span>الهدف</span>' + [33, 100, 1000, 0].map(function (g) { return '<button data-g="' + g + '">' + (g ? ar(g) : "بلا حد") + "</button>"; }).join("") + "</div>" +
      '<button class="tsb-btn" id="tsbBtn" aria-label="سبّح"><svg viewBox="0 0 100 100" class="tsb-ring"><circle cx="50" cy="50" r="45"/><circle cx="50" cy="50" r="45" id="tsbArc"/></svg>' +
      '<span class="tsb-txt" id="tsbTxt"></span><b id="tsbN"></b><small id="tsbOf"></small></button>' +
      '<div class="tsb-foot"><span id="tsbTot"></span><button class="continue" id="tsbReset">' + ic("rep") + "تصفير</button></div></div>";
    var btn = document.getElementById("tsbBtn"), arc = document.getElementById("tsbArc");
    function paint() {
      save("tasbih", st);
      view.querySelectorAll(".tsb-ph button").forEach(function (b) { b.classList.toggle("on", +b.dataset.i === st.i); });
      view.querySelectorAll(".tsb-goal button").forEach(function (b) { b.classList.toggle("on", +b.dataset.g === st.goal); });
      var n = cnt();
      document.getElementById("tsbTxt").textContent = TASBIH[st.i];
      document.getElementById("tsbN").textContent = ar(n);
      document.getElementById("tsbOf").textContent = st.goal ? "من " + ar(st.goal) + (n >= st.goal ? " ✓" : "") : "";
      document.getElementById("tsbTot").textContent = "المجموع كله: " + ar(st.total);
      var f = st.goal ? Math.min(1, n / st.goal) : (n % 100) / 100;
      arc.style.strokeDasharray = (f * 282.7) + " 283";
      btn.classList.toggle("done", !!st.goal && n >= st.goal);
    }
    view.querySelectorAll(".tsb-ph button").forEach(function (b) { b.onclick = function () { st.i = +b.dataset.i; paint(); }; });
    view.querySelectorAll(".tsb-goal button").forEach(function (b) { b.onclick = function () { st.goal = +b.dataset.g; paint(); }; });
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

  function wordsTab(body, s, a) {
    body.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
    need("w/" + s, "books/words/" + s + ".js", function (d) {
      var words = d && d[a];
      if (!words) { body.innerHTML = '<p class="hint">تعذّر تحميل كلمات الآية.</p>'; return; }
      var pick = -1;
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

  // ---------- ملء الشاشة على المصحف ----------
  // A tap on a mushaf page hides the bars and buttons a moment later, leaving only the page; the next tap brings them back.
  var fsT = 0;
  function fsSet(on) {
    clearTimeout(fsT);
    if (document.body.classList.contains("fs") === on) return;
    var bar = document.querySelector(".bar"), h = bar ? bar.offsetHeight : 0, vr = document.body.classList.contains("vread");
    document.body.classList.toggle("fs", on);
    if (vr) window.scrollBy(0, on ? -h : h);          // keep the page still while the top bar goes or comes back
    try { if (window.AppBridge && AppBridge.immersive) AppBridge.immersive(on); } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    if (!/^#\/p\//.test(location.hash) || !e.target.closest(".page-box")) return;
    if (document.body.classList.contains("fs")) { e.stopPropagation(); e.preventDefault(); fsSet(false); return; }
    clearTimeout(fsT); fsT = setTimeout(function () { if (/^#\/p\//.test(location.hash) && !window.QA_NOFS && !hifz.on && !document.getElementById("ayahBar")) fsSet(true); }, 1200);   // not while an ayah is chosen
  }, true);

  function route() {
    ayahBar(null);
    if (!/^#\/p\//.test(location.hash)) fsSet(false);
    autoSet(false); zikrSpeech.stop();
    document.body.classList.remove("vread");
    document.body.classList.toggle("reading", /^#\/(p|s)\//.test(location.hash));
    document.body.classList.toggle("pgview", /^#\/p\//.test(location.hash));
    tabbar();
    view.classList.remove("v-in"); void view.offsetWidth; view.classList.add("v-in");
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
    } else if ((m = h.match(/^#\/duas(?:\/(\w+))?/))) {
      showDuas(m[1]);
    } else if ((m = h.match(/^#\/hifztest(?:\/(\d+))?/))) {
      showHifzTest(m[1] ? +m[1] : 0);
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
