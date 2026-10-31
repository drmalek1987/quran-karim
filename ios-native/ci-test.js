// CI only (appended to web/ios/ed-bridge.js by the workflow): skip the welcome, download King Fahd, open page 3.
(function () {
  if (!window.EdBridge) return;
  if (!localStorage.getItem("q.onboarded")) { localStorage.setItem("q.onboarded", "true"); localStorage.setItem("q.edition", '"kfgqpc"'); localStorage.setItem("q.mode", '"pages"'); }
  var t = setInterval(function () {
    var s = EdBridge.state("kfgqpc");
    if (s === "ready") { clearInterval(t); if (location.hash !== "#/p/3") { location.hash = "#/p/3"; location.reload(); } }
    else if (s !== "busy" && EdBridge.base) EdBridge.download("kfgqpc", "https://raw.githubusercontent.com/drmalek1987/quran-karim/editions/kfgqpc.zip");
  }, 3000);
})();
