// Recitation recognised on the phone itself by a Quran-trained Whisper model (the "voice packs" in Settings › Downloads),
// instead of the phone's own speech recogniser. The runtime (onnxruntime-web, WebAssembly) and each model are downloaded
// like the mushaf editions and served by the app at https://asr.app/<pack>/... (EdStore.serveAsr).
// Asr.start(model, cb) listens to the microphone, cuts the speech at its pauses and calls cb(text) for each piece;
// cb("", "state:<s>") for "listening", "busy" (still loading), "noperm" and "error:<why>".
(function () {
  var HOST = "https://asr.app/", RT = HOST + "asrrt/";
  var SR = 16000, N_FFT = 400, HOP = 160, FRAMES = 3000;
  var rt = null, models = {}, cos = null, sin = null, mel = null, sup = null, beg = null, bdec = null, inv = null;

  function loadScript(src) {
    return new Promise(function (ok, no) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { no(new Error("script")); }; document.head.appendChild(s); });
  }
  function getJson(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); }
  // The runtime and the tables every model shares: mel filters, suppressed tokens, the byte-level vocabulary.
  function runtime() {
    if (rt) return rt;
    rt = loadScript(RT + "ort.wasm.min.js").then(function () {
      ort.env.wasm.wasmPaths = RT; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
      return Promise.all([getJson(RT + "mel.json"), getJson(RT + "gen.json"), getJson(RT + "vocab.json")]);
    }).then(function (r) {
      mel = { f: Float32Array.from(r[0].mel), bins: r[0].n[0], n: r[0].n[1] };   // mel.f[m * 201 + bin]
      sup = r[1].suppress; beg = r[1].begin;
      inv = []; Object.keys(r[2]).forEach(function (k) { inv[r[2][k]] = k; });
      // GPT-2 byte-level BPE: each printable character stands for one byte
      var bs = [], cs, n = 0, i;
      for (i = 33; i <= 126; i++) bs.push(i); for (i = 161; i <= 172; i++) bs.push(i); for (i = 174; i <= 255; i++) bs.push(i);
      cs = bs.slice(); for (i = 0; i < 256; i++) if (bs.indexOf(i) < 0) { bs.push(i); cs.push(256 + n); n++; }
      bdec = {}; bs.forEach(function (b, j) { bdec[String.fromCharCode(cs[j])] = b; });
      cos = new Float32Array(N_FFT * 201); sin = new Float32Array(N_FFT * 201);
      for (var t = 0; t < N_FFT; t++) for (var k = 0; k < 201; k++) { var a = -2 * Math.PI * t * k / N_FFT; cos[t * 201 + k] = Math.cos(a); sin[t * 201 + k] = Math.sin(a); }
    });
    rt.catch(function () { rt = null; });
    return rt;
  }
  function model(id) {
    if (!models[id]) {
      models[id] = runtime().then(function () {
        var o = { executionProviders: ["wasm"] };
        return Promise.all([ort.InferenceSession.create(HOST + id + "/encoder.onnx", o), ort.InferenceSession.create(HOST + id + "/decoder.onnx", o),
          ort.InferenceSession.create(HOST + id + "p/past.onnx", o)]);
      });
      models[id].catch(function () { delete models[id]; });
    }
    return models[id];
  }

  // Whisper's log-mel spectrogram of 30 s (zero padded), as WhisperFeatureExtractor makes it.
  function logMel(y) {
    var n = Math.min(y.length, SR * 30), used = Math.min(FRAMES, Math.ceil(n / HOP) + 3), out = new Float32Array(80 * FRAMES);
    var win = new Float32Array(N_FFT), fr = new Float32Array(N_FFT), pw = new Float32Array(201), i, t, k, m;
    for (i = 0; i < N_FFT; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N_FFT);
    var at = function (j) { j -= 200; if (j < 0) j = -j; return j < n ? y[j] : 0; };   // centred frames, reflected at the start
    var mx = -1e9;
    for (var f = 0; f < used; f++) {
      for (t = 0; t < N_FFT; t++) fr[t] = at(f * HOP + t) * win[t];
      for (k = 0; k < 201; k++) { var re = 0, im = 0; for (t = 0; t < N_FFT; t++) { re += fr[t] * cos[t * 201 + k]; im += fr[t] * sin[t * 201 + k]; } pw[k] = re * re + im * im; }
      for (m = 0; m < 80; m++) { var s = 0; for (k = 0; k < 201; k++) s += mel.f[m * 201 + k] * pw[k]; var v = Math.log10(Math.max(s, 1e-10)); out[m * FRAMES + f] = v; if (v > mx) mx = v; }
    }
    if (mx < -10) mx = -10;
    for (m = 0; m < 80; m++) for (f = 0; f < FRAMES; f++) { var x = f < used ? out[m * FRAMES + f] : -10; out[m * FRAMES + f] = (Math.max(x, mx - 8) + 4) / 4; }
    return out;
  }
  // Greedy decoding (Arabic, transcribe, no timestamps). The first step runs decoder.onnx on the prompt and returns
  // every layer's keys and values; later steps feed one token to past.onnx with those, so the 1500 encoder frames are
  // attended to without being projected again.
  function transcribe(id, y) {
    return model(id).then(function (ss) {
      var feats = new ort.Tensor("float32", logMel(y), [1, 80, FRAMES]);
      return ss[0].run({ input_features: feats }).then(function (r) {
        var h = r[ss[0].outputNames[0]], ids = [50258, 50272, 50359, 50363], past = {};
        var bad = {}; sup.forEach(function (x) { bad[x] = 1; });
        function pick(o, first) {
          var lg = o.logits, V = lg.dims[2], base = (lg.dims[1] - 1) * V, best = -1, bv = -Infinity, d = lg.data, j;
          for (j = 0; j < V; j++) if (!bad[j] && !(first && beg.indexOf(j) >= 0) && d[base + j] > bv) { bv = d[base + j]; best = j; }
          Object.keys(o).forEach(function (k) { if (k.indexOf("present.") === 0 && (first || k.indexOf(".decoder.") > 0)) past["past_key_values." + k.slice(8)] = o[k]; });
          return best;
        }
        function step(i, t) {
          if (t === 50257 || i >= 110) return ids;
          ids.push(t);
          var f = { input_ids: new ort.Tensor("int64", BigInt64Array.from([BigInt(t)]), [1, 1]) };
          Object.keys(past).forEach(function (k) { f[k] = past[k]; });
          return ss[2].run(f).then(function (o) { return step(i + 1, pick(o, false)); });
        }
        var inp = new ort.Tensor("int64", BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
        return ss[1].run({ input_ids: inp, encoder_hidden_states: h }).then(function (o) { return step(0, pick(o, true)); });
      });
    }).then(function (ids) {
      var bytes = [];
      ids.slice(4).forEach(function (t) { var w = t < 50257 && inv[t]; if (w) for (var c = 0; c < w.length; c++) if (bdec[w[c]] !== undefined) bytes.push(bdec[w[c]]); });
      return new TextDecoder("utf-8").decode(new Uint8Array(bytes)).trim();
    });
  }

  // The microphone: speech is cut at a pause of 0.6 s (or after 8 s) and each piece is transcribed in turn.
  var on = false, stream = null, ctx = null, node = null, cb = null, cur = null;
  function stop() {
    on = false;
    try { if (node) node.disconnect(); if (ctx) ctx.close(); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    node = ctx = stream = null;
  }
  function start(id, fn) {
    stop(); on = true; cb = fn; cur = id;
    cb("", "state:busy");
    var work = Promise.resolve(), pend = [];
    function piece(y) {
      work = work.then(function () { if (!on) return; return transcribe(id, y).then(function (t) { if (on && t) cb(t, "final"); }); }).catch(function (e) { if (on) cb("", "state:error:" + (e && e.message || "run")); });
    }
    model(id).then(function () {
      if (!on) return;
      return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (s) {
        if (!on) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
        var src = ctx.createMediaStreamSource(s), rate = ctx.sampleRate;
        node = ctx.createScriptProcessor(4096, 1, 1);
        var buf = [], len = 0, quiet = 0, voiced = 0, floor = 0.004;
        node.onaudioprocess = function (ev) {
          if (!on) return;
          var x = ev.inputBuffer.getChannelData(0), e = 0, i;
          for (i = 0; i < x.length; i++) e += x[i] * x[i];
          e = Math.sqrt(e / x.length); floor = e < floor ? e : floor * 0.995 + e * 0.005;   // the room's own level
          var speech = e > Math.max(0.01, floor * 3), dt = x.length / rate;
          if (speech || len) { buf.push(new Float32Array(x)); len += x.length; }
          if (speech) { voiced += dt; quiet = 0; } else if (len) quiet += dt;
          if (len && (quiet > 0.6 || len / rate > 8)) {
            var y = new Float32Array(len), o = 0; buf.forEach(function (b) { y.set(b, o); o += b.length; });
            if (rate !== SR) { var r = new Float32Array(Math.floor(len * SR / rate)); for (i = 0; i < r.length; i++) r[i] = y[Math.floor(i * rate / SR)]; y = r; }
            var pk = 0; for (i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i]));
            if (voiced > 0.4 && pk > 0) { for (i = 0; i < y.length; i++) y[i] = y[i] / pk * 0.9; piece(y); }
            buf = []; len = 0; quiet = 0; voiced = 0;
          }
        };
        src.connect(node); node.connect(ctx.destination);
        cb("", "state:listening");
      });
    }).catch(function (e) {
      if (!on) return; on = false;
      cb("", e && e.name === "NotAllowedError" ? "state:noperm" : "state:error:" + (e && e.message || "load"));
    });
  }
  window.Asr = { start: start, stop: stop, transcribe: transcribe, active: function () { return on; } };
})();
