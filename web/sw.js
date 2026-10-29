// Caches the whole app so it works offline after the first visit.
var CACHE = "quran-v29";
var FILES = ["./", "index.html", "style.css", "app.js", "azkar.js", "duas.js", "topics.js", "flags.js", "i18n.js", "quran-data.js", "thematic.js", "fonts/amiri-quran.woff2", "fonts/cairo-400.woff2", "fonts/cairo-600.woff2", "fonts/cairo-700.woff2",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  // Mushaf pages are cached as they are opened, so pages already read work offline.
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request).then(function (res) {
      if (res.ok && /\/(pages|tjpages)\//.test(e.request.url)) {
        var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    });
  }));
});
