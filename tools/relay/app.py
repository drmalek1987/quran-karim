# Relay for consented recitation clips: the phone POSTs a 16 kHz WAV + JSON label, the relay commits it to a
# private dataset with the Space secret HF_TOKEN (the token never ships inside the app).
import os, time, uuid, json
from fastapi import FastAPI, UploadFile, Form, HTTPException
from huggingface_hub import HfApi, CommitOperationAdd

REPO = os.environ.get("DATASET", "DrAbdelraman/quran-voice-donations")
api = HfApi(token=os.environ["HF_TOKEN"])
app = FastAPI()
hits = {}

@app.get("/")
def ok(): return {"ok": True}

@app.post("/clip")
async def clip(audio: UploadFile, meta: str = Form(...), device: str = Form("")):
    m = json.loads(meta)
    if not isinstance(m.get("text"), str) or not 0 < len(m["text"]) < 2000: raise HTTPException(400)
    b = await audio.read()
    if not b.startswith(b"RIFF") or len(b) > 16000 * 2 * 13 + 100: raise HTTPException(400)
    k = device[:40] or "anon"; n = [t for t in hits.get(k, []) if t > time.time() - 3600]
    if len(n) >= 200: raise HTTPException(429)
    hits[k] = n + [time.time()]
    cid = time.strftime("%Y%m%d") + "/" + uuid.uuid4().hex
    m = {"text": m["text"], "src": str(m.get("src", ""))[:20], "device": k}
    api.create_commit(REPO, repo_type="dataset", commit_message="clip",
        operations=[CommitOperationAdd("clips/%s.wav" % cid, b), CommitOperationAdd("clips/%s.json" % cid, json.dumps(m, ensure_ascii=False).encode())])
    return {"ok": True}

# Gradio Space entry (free hardware here is ZeroGPU, which only keeps Gradio apps alive): a tiny status page mounted
# next to the API, plus the `spaces` import ZeroGPU looks for.
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
    if getattr(r, "path", "") == "/clip": demo.app.router.routes.insert(0, r)
demo.block_thread()
