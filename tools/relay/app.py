# Relay for consented recitation clips. The phone POSTs a batch of 16 kHz FLAC clips + JSON labels, signed with the
# app key; the relay checks each clip (quality, and the NVIDIA model must hear the labelled words), then commits all
# clips that arrived in the last few seconds to the private dataset in one commit, with the Space secret HF_TOKEN
# (the token never ships inside the app). Limits per device, per IP and per day survive restarts (state/limits.json).
# Layout: clips/<devhash16>/<YYYYMMDD>/<uuid>.flac|.wav + .json; the raw device id is never stored, only its hash.
import os, io, re, time, uuid, json, hmac, hashlib, asyncio, threading
import numpy as np, soundfile as sf
from fastapi import FastAPI, Request, UploadFile, Form, HTTPException
from huggingface_hub import HfApi, CommitOperationAdd, CommitOperationDelete, hf_hub_download

REPO = os.environ.get("DATASET", "DrAbdelraman/quran-voice-donations")
APP_KEY = os.environ.get("APP_KEY", "").encode()
MODEL_REPO = os.environ.get("MODEL_REPO", "DrAbdelraman/quran-train-progress")   # export_onnx.py uploads phone/* here
LIM = {"dev": int(os.environ.get("LIM_DEV", 300)), "ip": int(os.environ.get("LIM_IP", 600)), "total": int(os.environ.get("LIM_TOTAL", 20000))}
MAX_AUTO, MAX_CORR = 0.35, 0.6          # highest character error rate accepted for auto / user-corrected clips
WINDOW = float(os.environ.get("WINDOW", 20))   # seconds clips wait so several batches share one commit
api = HfApi(token=os.environ.get("HF_TOKEN"))
app = FastAPI()

def h16(s): return hashlib.sha256(s.encode()).hexdigest()[:16]
def day(): return time.strftime("%Y%m%d", time.gmtime())

# ---- limits, kept in the dataset so a restart does not reset them
state = {"day": "", "dev": {}, "ip": {}, "total": 0}
def load_state():
    try: state.update(json.load(open(hf_hub_download(REPO, "state/limits.json", repo_type="dataset", token=api.token))))
    except Exception: pass
def take(dev, ip, n):
    """Reserves n clips for this device and IP, or returns False when a limit is reached."""
    if state["day"] != day(): state.update(day=day(), dev={}, ip={}, total=0)
    d, i = state["dev"].get(dev, 0), state["ip"].get(ip, 0)
    if d + n > LIM["dev"] or i + n > LIM["ip"] or state["total"] + n > LIM["total"]: return False
    state["dev"][dev], state["ip"][ip] = d + n, i + n; state["total"] += n; return True
def client_ip(req):
    f = req.headers.get("x-forwarded-for", "")
    return h16(f.split(",")[0].strip() or (req.client.host if req.client else "?"))

# ---- the NVIDIA model (CTC branch, int8 ONNX), with the same numpy features the app computes
T = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]")
def norm(t):
    t = T.sub("", t); t = re.sub("[ٱأإآ]", "ا", t); t = re.sub("[ىی]", "ي", t)
    t = t.replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي"); t = re.sub("[^ء-ي ]", " ", t); return re.sub(r"\s+", " ", t).strip()
def ed(a, b):
    p = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        c = [i]
        for j, y in enumerate(b, 1): c.append(min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (x != y)))
        p = c
    return p[-1]
def cer(hyp, ref):
    r = norm(ref); return min(ed(norm(hyp), r), len(r)) / max(len(r), 1)

class Asr:
    def __init__(self):
        import onnxruntime as ort
        cfg = json.load(open(hf_hub_download(MODEL_REPO, "phone/model.json", repo_type="dataset", token=api.token), encoding="utf8"))
        self.s = ort.InferenceSession(hf_hub_download(MODEL_REPO, "phone/model.int8.onnx", repo_type="dataset", token=api.token), providers=["CPUExecutionProvider"])
        self.names = [i.name for i in self.s.get_inputs()]; self.vocab = cfg["vocab"]; pp = cfg["preprocessor"]
        self.nf = int(pp.get("n_fft") or 512); self.win = int(float(pp.get("window_size", 0.025)) * 16000); self.hop = int(float(pp.get("window_stride", 0.01)) * 16000)
        self.fb = mel(self.nf, int(pp.get("features", 80))); n = np.arange(self.win); self.hann = (0.5 - 0.5 * np.cos(2 * np.pi * n / (self.win - 1))).astype(np.float32)
    def feats(self, y):   # export_onnx.py feats(): pre-emphasis, centred STFT, log-mel, per-feature normalisation
        NF, HOP = self.nf, self.hop
        y = np.append(y[0], y[1:] - 0.97 * y[:-1]).astype(np.float32); y = np.pad(y, NF // 2); n = 1 + (len(y) - NF) // HOP
        w = np.zeros(NF, np.float32); o = (NF - self.win) // 2; w[o:o + self.win] = self.hann
        fr = np.stack([y[i * HOP:i * HOP + NF] * w for i in range(n)])
        x = np.log((np.abs(np.fft.rfft(fr, NF)) ** 2) @ self.fb.T + 2 ** -24).T
        x = x[:, :max(1 + len(y[NF // 2:-NF // 2]) // HOP, 1)]
        return ((x - x.mean(1, keepdims=True)) / (x.std(1, ddof=1, keepdims=True) + 1e-5)).astype(np.float32)
    def __call__(self, y):
        f = self.feats(y); ids = self.s.run(None, {self.names[0]: f[None], self.names[1]: np.array([f.shape[1]], np.int64)})[0][0].argmax(-1)
        out, prev = [], -1
        for t in ids:
            if t != prev and t < len(self.vocab): out.append(self.vocab[t])
            prev = t
        return "".join(out).replace("▁", " ").strip()
def mel(nf, nm, sr=16000):   # librosa.filters.mel(norm='slaney', htk=False) without librosa
    def hz2m(f): f = np.asarray(f, float); return np.where(f >= 1000, 15 + np.log(np.maximum(f, 1e-9) / 1000) / (np.log(6.4) / 27), f / (200 / 3))
    def m2hz(m): m = np.asarray(m, float); return np.where(m >= 15, 1000 * np.exp((np.log(6.4) / 27) * (m - 15)), m * 200 / 3)
    hz = m2hz(np.linspace(hz2m(0), hz2m(sr / 2), nm + 2)); fft = np.linspace(0, sr / 2, nf // 2 + 1)
    d = np.diff(hz); r = hz[:, None] - fft[None]
    w = np.maximum(0, np.minimum(-r[:-2] / d[:-1, None], r[2:] / d[1:, None]))
    return (w * (2 / (hz[2:nm + 2] - hz[:nm]))[:, None]).astype(np.float32)
_asr, _asr_lock = [], threading.Lock()
def asr():
    with _asr_lock:
        if not _asr:
            try: _asr.append(Asr())
            except Exception as e: print("ASR model unavailable, clips are stored unchecked:", e, flush=True); _asr.append(None)
        return _asr[0]

def check(b, m):
    """Returns (stored meta, None) for a good clip or (None, reason)."""
    if not isinstance(m.get("text"), str) or not 0 < len(m["text"]) < 2000: return None, "text"
    try: y, sr = sf.read(io.BytesIO(b), dtype="float32", always_2d=True)
    except Exception: return None, "audio"
    if sr != 16000 or y.shape[1] != 1: return None, "format"
    y = y[:, 0]; dur = len(y) / 16000
    if not 0.5 <= dur <= 20: return None, "length"
    rms = 20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-9); clip = float(np.mean(np.abs(y) >= 0.999))
    if rms < -45: return None, "quiet"
    if clip > 0.01: return None, "clipped"
    kind = "corrected" if m.get("kind") == "corrected" else "auto"
    a = asr(); hyp, c = (a(y), None) if a else (None, None)
    if hyp is not None:
        c = round(cer(hyp, m["text"]), 3)
        if c > (MAX_CORR if kind == "corrected" else MAX_AUTO): return None, "mismatch"
    keep = {k: m[k] for k in ("v", "text", "s", "a0", "w0", "a1", "w1", "hyp", "model", "app", "q") if k in m}
    keep.update(kind=kind, src=str(m.get("src", "hifz"))[:20], dur=round(dur, 2), rms=round(float(rms), 1), clip=round(clip, 4), srv_hyp=hyp, srv_cer=c)
    return keep, None

# ---- commits: clips that arrive within WINDOW seconds go into one commit; replies wait until it has landed
pending, lock = [], asyncio.Lock()
async def commit(ops):
    fut = asyncio.get_running_loop().create_future(); pending.append((ops, fut))
    async with lock:
        if not fut.done():
            await asyncio.sleep(WINDOW)
            batch = pending[:]; del pending[:]
            allops = [o for ops_, _ in batch for o in ops_] + [CommitOperationAdd("state/limits.json", json.dumps(state).encode())]
            try:
                await asyncio.to_thread(api.create_commit, REPO, repo_type="dataset", commit_message="%d clips" % (len(allops) // 2), operations=allops)
                for _, f in batch: f.done() or f.set_result(True)
            except Exception as e:
                for _, f in batch: f.done() or f.set_exception(e)
    return await fut

def signed(sig, ts, *parts):
    if not APP_KEY: raise HTTPException(503, "no key")
    try: ok = abs(time.time() - int(ts)) < 600
    except ValueError: ok = False
    want = hmac.new(APP_KEY, "|".join([ts, *parts]).encode(), hashlib.sha256).hexdigest()
    if not ok or not hmac.compare_digest(want, sig or ""): raise HTTPException(401)

def store(dev, ext, b, keep):
    cid = "clips/%s/%s/%s" % (dev, day(), uuid.uuid4().hex)
    return [CommitOperationAdd(cid + ext, b), CommitOperationAdd(cid + ".json", json.dumps(keep, ensure_ascii=False).encode())]

@app.get("/")
def ok(): return {"ok": True}

@app.post("/batch")
async def batch(req: Request):
    form = await req.form(); device, ts, sig = form.get("device", ""), form.get("ts", ""), form.get("sig", "")
    clips = []
    for i in range(20):
        if "meta%d" % i not in form: break
        clips.append((form["meta%d" % i], await form["audio%d" % i].read()))
    if not clips or not 8 <= len(device) <= 64: raise HTTPException(400)
    signed(sig, ts, device, "".join(hashlib.sha256(m.encode()).hexdigest() + hashlib.sha256(b).hexdigest() for m, b in clips))
    dev = h16(device)
    if not take(dev, client_ip(req), len(clips)): raise HTTPException(429)
    results, ops = [], []
    for i, (meta, b) in enumerate(clips):
        try: m = json.loads(meta)
        except ValueError: m = {}
        keep, why = await asyncio.to_thread(check, b, m) if isinstance(m, dict) else (None, "meta")
        if keep: ops += store(dev, ".flac", b, keep); results.append({"i": i, "ok": True})
        else: results.append({"i": i, "ok": False, "reason": why})
    await commit(ops)   # also saves the limits, even when every clip was rejected
    return {"results": results}

@app.post("/delete")
async def delete(device: str = Form(...), ts: str = Form(...), sig: str = Form(...)):
    signed(sig, ts, device, "delete"); dev = h16(device)
    for ops, _ in pending: ops[:] = [o for o in ops if not o.path_in_repo.startswith("clips/%s/" % dev)]
    files = await asyncio.to_thread(api.list_repo_files, REPO, repo_type="dataset")
    gone = [f for f in files if f.startswith("clips/%s/" % dev)]
    if gone: await asyncio.to_thread(api.create_commit, REPO, repo_type="dataset", commit_message="delete on request", operations=[CommitOperationDelete("clips/%s/" % dev)])
    return {"deleted": len(gone) // 2}

# App 4.8 and older: one unsigned WAV per request, deleted on the phone for 200 and 400. Same checks and limits.
@app.post("/clip")
async def clip(req: Request, audio: UploadFile, meta: str = Form(...), device: str = Form("")):
    try: m = json.loads(meta)
    except ValueError: raise HTTPException(400)
    b = await audio.read(); dev = h16(device[:40] or "anon")
    if not isinstance(m, dict) or not b.startswith(b"RIFF"): raise HTTPException(400)
    if not take(dev, client_ip(req), 1): raise HTTPException(429)
    keep, why = await asyncio.to_thread(check, b, m)
    await commit(store(dev, ".wav", b, keep) if keep else [])
    if not keep: raise HTTPException(400, why)
    return {"ok": True}

load_state()
threading.Thread(target=asr, daemon=True).start()   # loads the model in the background so the first clip is quick

if __name__ == "__main__":
    # Gradio Space entry (free hardware here is ZeroGPU, which only keeps Gradio apps alive): a tiny status page
    # mounted next to the API, plus the `spaces` import ZeroGPU looks for.
    import gradio as gr
    try:
        import spaces
        @spaces.GPU
        def _noop(): return 0
    except Exception: pass
    with gr.Blocks() as demo:
        gr.Markdown("Quran voice relay: receives clips that readers chose to share.")
    # The Space starts the Gradio server itself, so the API routes are added onto Gradio's own FastAPI app.
    demo.launch(prevent_thread_lock=True, ssr_mode=False)
    for r in app.routes:
        if getattr(r, "path", "") in ("/clip", "/batch", "/delete"): demo.app.router.routes.insert(0, r)
    demo.block_thread()
