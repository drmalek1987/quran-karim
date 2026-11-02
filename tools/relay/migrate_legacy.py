# One-off: moves clips stored by the 4.8 relay (clips/<YYYYMMDD>/<uuid>.wav + .json with the raw device id) into the
# v2 layout clips/<devhash16>/<YYYYMMDD>/<uuid>.*, with the raw id removed from the label, so «امسح كل تسجيلاتي» can
# delete them too and the dataset holds no raw ids. Dry run by default; --apply to commit (500 files per commit).
# Run: uv run --no-project --with huggingface_hub python migrate_legacy.py [--apply]   (HF_TOKEN with write access)
import os, re, sys, json, hashlib
from huggingface_hub import HfApi, CommitOperationAdd, CommitOperationCopy, CommitOperationDelete, hf_hub_download

REPO = os.environ.get("DATASET", "DrAbdelraman/quran-voice-donations")
api = HfApi(token=os.environ["HF_TOKEN"])
def h16(s): return hashlib.sha256(s.encode()).hexdigest()[:16]   # same as tools/relay/app.py

old = [f for f in api.list_repo_files(REPO, repo_type="dataset") if re.match(r"clips/\d{8}/[0-9a-f]+\.json$", f)]
print("%d legacy clips" % len(old))
ops = []
for j in old:
    m = json.load(open(hf_hub_download(REPO, j, repo_type="dataset", token=api.token), encoding="utf8"))
    dev = h16(str(m.pop("device", "") or "anon")[:40]); m.setdefault("v", 1)
    _, day, name = j.split("/"); base = name[:-5]; new = "clips/%s/%s/%s" % (dev, day, base)
    ops += [CommitOperationCopy("clips/%s/%s.wav" % (day, base), new + ".wav"), CommitOperationAdd(new + ".json", json.dumps(m, ensure_ascii=False).encode()),
            CommitOperationDelete("clips/%s/%s.wav" % (day, base)), CommitOperationDelete(j)]
if "--apply" not in sys.argv:
    print("dry run: would move %d clips (%d operations); add --apply" % (len(old), len(ops))); sys.exit()
# copies must land before the deletes of the same files, so each clip's 4 operations stay in one commit
for i in range(0, len(ops), 500):
    api.create_commit(REPO, repo_type="dataset", operations=ops[i:i + 500], commit_message="v2 layout: legacy clips %d-%d" % (i // 4, (i + len(ops[i:i + 500])) // 4))
    print("committed", i // 4 + len(ops[i:i + 500]) // 4)
