// iOS (Capacitor) stand-in for Android's EdStore.java: the same window.EdBridge calls, so app.js stays as it is.
// A pack is fetched as one zip, unpacked with JSZip and written to the app's Data folder (Documents/ed/...);
// the pages are then shown from Capacitor's file URL, set as EdBridge.base for app.js.
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform() || !C.Plugins || !C.Plugins.Filesystem) return;
  var FS = C.Plugins.Filesystem, KEY = "iosEd", st = {}, busy = null;
  try { st = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  function keep() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function tell(id, v) { if (window.onEdDl) window.onEdDl(id, v); }
  function subs(id) { return /^asr/.test(id) ? ["asr/" + id] : id === "harmain" ? ["pages", "tjpages"] : ["editions/" + id, "editions/" + id + "-tj"]; }
  function b64(u8) { var s = "", i, n = 0x8000; for (i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); }
  window.EdBridge = {
    base: localStorage.getItem("iosEdBase") || "",
    state: function (id) { return id === busy ? "busy" : st[id] === "ready" ? "ready" : st[id] === "part" ? "part" : "none"; },
    download: function (id, url) {
      if (busy || !/^[a-z]+$/.test(id)) return;
      busy = id; st[id] = "part"; keep();
      var xhr = new XMLHttpRequest(); xhr.open("GET", url); xhr.responseType = "arraybuffer";
      xhr.onprogress = function (e) { if (e.lengthComputable) tell(id, Math.floor(e.loaded * 90 / e.total)); };
      xhr.onerror = function () { busy = null; tell(id, "error"); };
      xhr.onload = function () {
        if (xhr.status !== 200) { busy = null; return tell(id, "error"); }
        JSZip.loadAsync(xhr.response).then(function (z) {
          var names = Object.keys(z.files).filter(function (n) { return !z.files[n].dir && n.indexOf("..") < 0; }), i = 0;
          function next() {
            if (i >= names.length) { busy = null; st[id] = "ready"; keep(); return tell(id, "done"); }
            var n = names[i++];
            if (i % 20 === 0) tell(id, 90 + Math.floor(i * 10 / names.length));
            return z.file(n).async("uint8array").then(function (u) {
              return FS.writeFile({ path: "ed/" + n, data: b64(u), directory: "DATA", recursive: true });
            }).then(next);
          }
          return next();
        }).catch(function () { busy = null; tell(id, "error"); });
      };
      xhr.send();
    },
    remove: function (id) {
      if (id === busy) return;
      delete st[id]; keep();
      subs(id).forEach(function (s) { FS.rmdir({ path: "ed/" + s, directory: "DATA", recursive: true }).catch(function () {}); });
    }
  };
  // The file URL is known only asynchronously; the first paint waits for it (app.js reads EdBridge.base).
  window.EdBridgeReady = FS.getUri({ path: "ed", directory: "DATA" }).then(function (r) {
    EdBridge.base = C.convertFileSrc(r.uri).replace(/\/?$/, "/");
    try { localStorage.setItem("iosEdBase", EdBridge.base); } catch (e) {}
    if (window.onEdBase) window.onEdBase();
  });
})();
