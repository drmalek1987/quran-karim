# Offline tests for the relay: a fake HfApi records commits, a fake model stands in for the NVIDIA ASR.
# Run: uv run --with-requirements requirements.txt --with pytest --with httpx pytest -q test_relay.py
import os, io, json, time, hmac, hashlib
os.environ.update(APP_KEY="k", WINDOW="0.05", HF_HUB_OFFLINE="1", MODEL_REPO="none/none", HF_TOKEN="x")
import numpy as np, soundfile as sf, pytest
from fastapi.testclient import TestClient
import app as R

class FakeApi:
    token = "x"
    def __init__(s): s.commits, s.files = [], []
    def create_commit(s, repo, repo_type, commit_message, operations):
        s.commits.append(operations)
        for o in operations:
            if hasattr(o, "path_or_fileobj"): s.files.append(o.path_in_repo)
            else: s.files = [f for f in s.files if not f.startswith(o.path_in_repo)]
    def list_repo_files(s, repo, repo_type): return list(s.files)

@pytest.fixture
def c(monkeypatch):
    R.asr(); monkeypatch.setattr(R, "api", FakeApi()); R._asr[:] = [lambda y: "بسم الله الرحمن الرحيم"]
    R.state.update(day="", dev={}, ip={}, total=0); return TestClient(R.app)

def flac(sec=2.0, amp=0.1, sr=16000):
    t = np.arange(int(sec * sr)) / sr; b = io.BytesIO()
    sf.write(b, (amp * np.sin(2 * np.pi * 220 * t)).astype(np.float32), sr, format="FLAC", subtype="PCM_16"); return b.getvalue()
def meta(**k): return json.dumps(dict(v=2, text="بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", s=1, a0=1, w0=0, a1=1, w1=3, **{"kind": "auto", **k}), ensure_ascii=False)
def sign(*parts, key=b"k"): return hmac.new(key, "|".join(parts).encode(), hashlib.sha256).hexdigest()
def post(c, clips, device="dev-abcdefgh", ts=None, key=b"k", ip="1.2.3.4"):
    ts = str(int(ts or time.time())); data = {"device": device, "ts": ts}; files = {}
    for i, (m, b) in enumerate(clips): data["meta%d" % i] = m; files["audio%d" % i] = ("a.flac", b)
    data["sig"] = sign(ts, device, "".join(hashlib.sha256(m.encode()).hexdigest() + hashlib.sha256(b).hexdigest() for m, b in clips), key=key)
    return c.post("/batch", data=data, files=files, headers={"x-forwarded-for": ip})

def test_good_batch_one_commit(c):
    r = post(c, [(meta(), flac()), (meta(), flac(3))])
    assert r.status_code == 200 and all(x["ok"] for x in r.json()["results"])
    assert len(R.api.commits) == 1
    paths = [o.path_in_repo for o in R.api.commits[0]]
    assert "state/limits.json" in paths and sum(p.endswith(".flac") for p in paths) == 2
    dev = R.h16("dev-abcdefgh"); assert all(p.startswith("clips/%s/" % dev) for p in paths if p.startswith("clips/"))
    j = json.loads([o for o in R.api.commits[0] if o.path_in_repo.endswith(".json") and "clips/" in o.path_in_repo][0].path_or_fileobj)
    assert "dev-abcdefgh" not in json.dumps(j) and j["srv_cer"] == 0 and j["s"] == 1 and j["kind"] == "auto"

def test_bad_signature_and_old_ts(c):
    assert post(c, [(meta(), flac())], key=b"wrong").status_code == 401
    assert post(c, [(meta(), flac())], ts=time.time() - 3600).status_code == 401
    assert R.api.commits == []

def test_rejects_with_reasons(c):
    R._asr[:] = [lambda y: "قل هو الله احد"]
    r = post(c, [(meta(), flac()), (meta(), flac(0.2)), (meta(), flac(amp=0.001)), (meta(), flac(amp=2.0)), (meta(kind="corrected"), flac())])
    reasons = [x.get("reason") for x in r.json()["results"]]
    assert reasons[:4] == ["mismatch", "length", "quiet", "clipped"] and reasons[4] == "mismatch"

def test_corrected_has_looser_threshold(c):
    R._asr[:] = [lambda y: "بسم الله الرح"]   # CER 0.41: too high for auto, fine for corrected
    r = post(c, [(meta(), flac()), (meta(kind="corrected"), flac())]).json()["results"]
    assert [x["ok"] for x in r] == [False, True]

def test_limits_per_device_ip_and_restart(c, monkeypatch):
    monkeypatch.setitem(R.LIM, "dev", 3)
    assert post(c, [(meta(), flac())] * 3).status_code == 200
    assert post(c, [(meta(), flac())]).status_code == 429
    saved = json.loads([o for o in R.api.commits[-1] if o.path_in_repo == "state/limits.json"][0].path_or_fileobj)
    R.state.update(day="", dev={}, ip={}, total=0); R.state.update(saved)   # what load_state() does after a restart
    assert post(c, [(meta(), flac())]).status_code == 429
    monkeypatch.setitem(R.LIM, "dev", 100); monkeypatch.setitem(R.LIM, "ip", 4)
    assert post(c, [(meta(), flac())], device="other-device1").status_code == 200
    assert post(c, [(meta(), flac())], device="other-device2").status_code == 429

def test_delete_removes_only_that_device(c):
    post(c, [(meta(), flac())]); post(c, [(meta(), flac())], device="someone-else1")
    ts = str(int(time.time()))
    assert c.post("/delete", data={"device": "dev-abcdefgh", "ts": ts, "sig": sign(ts, "dev-abcdefgh", "wrong")}).status_code == 401
    r = c.post("/delete", data={"device": "dev-abcdefgh", "ts": ts, "sig": sign(ts, "dev-abcdefgh", "delete")})
    assert r.json() == {"deleted": 1}
    assert not any(f.startswith("clips/%s/" % R.h16("dev-abcdefgh")) for f in R.api.files)
    assert any(f.startswith("clips/%s/" % R.h16("someone-else1")) for f in R.api.files)

def test_legacy_clip(c):
    b = io.BytesIO(); sf.write(b, (0.1 * np.sin(np.arange(32000) / 10)).astype(np.float32), 16000, format="WAV", subtype="PCM_16")
    r = c.post("/clip", data={"meta": json.dumps({"text": "بسم الله الرحمن الرحيم", "src": "hifz", "v": 1}), "device": "abc123"}, files={"audio": ("a.wav", b.getvalue())})
    assert r.status_code == 200 and any(f.endswith(".wav") for f in R.api.files)
    R._asr[:] = [lambda y: "قل هو الله احد"]
    r = c.post("/clip", data={"meta": json.dumps({"text": "بسم الله الرحمن الرحيم"}), "device": "abc123"}, files={"audio": ("a.wav", b.getvalue())})
    assert r.status_code == 400

def test_features_match_librosa_mel():
    librosa = pytest.importorskip("librosa")
    want = librosa.filters.mel(sr=16000, n_fft=512, n_mels=80, fmin=0, fmax=8000, norm="slaney", htk=False)
    assert np.abs(R.mel(512, 80) - want).max() < 1e-6
