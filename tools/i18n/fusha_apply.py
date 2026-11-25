"""Sprint 6 (A2): apply tools/i18n/fusha_map.json to the sources.

Run:  py -3.11 tools/i18n/fusha_apply.py [--dry]

Every entry is an exact substring replace in its own file (no regex over files):
  literal   old/new = the full string literal as written in the source, delimiters included
  text      old/new = a whole text line of web/index.html (trimmed)
  name      old/new = a snippet carrying the app name (A1)
  i18n-key  old/new = the Arabic KEY of web/i18n.js (the English value is never touched);
            matched as the JSON string followed by a colon
Each entry carries `n`, the exact number of hits expected. The script fails loudly (exit 1, nothing written)
when an entry is not found or its hit count differs, and prints the per-entry hit counts.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
MAP = json.loads((Path(__file__).parent / "fusha_map.json").read_text(encoding="utf-8"))
dry = "--dry" in sys.argv
sys.stdout.reconfigure(encoding="utf-8")


def forms(e):
    if e["kind"] == "i18n-key":
        return json.dumps(e["old"], ensure_ascii=False) + ":", json.dumps(e["new"], ensure_ascii=False) + ":"
    return e["old"], e["new"]


texts, bad, total = {}, [], 0
by_file = {}
for e in MAP:
    by_file.setdefault(e["file"], []).append(e)
for f, entries in by_file.items():
    t = (ROOT / f).read_bytes().decode("utf-8")
    # longest first, so a short entry never eats part of a longer one
    for e in sorted(entries, key=lambda x: -len(x["old"])):
        old, new = forms(e)
        hits = t.count(old)
        print(f"{hits:3d}/{e['n']:<3d} {f}  {e['old'][:60]!r}")
        if hits == 0 or hits != e["n"]:
            bad.append((f, e["old"], hits, e["n"]))
            continue
        t = t.replace(old, new)
        total += hits
    texts[f] = t
if bad:
    print("\nFAILED: %d entries not found or with an unexpected hit count; nothing was written" % len(bad))
    for b in bad:
        print("  ", b)
    sys.exit(1)
if dry:
    print("\ndry run OK: %d entries, %d replacements" % (len(MAP), total))
    sys.exit(0)
for f, t in texts.items():
    (ROOT / f).write_bytes(t.encode("utf-8"))
print("\napplied %d entries, %d replacements in %d files" % (len(MAP), total, len(texts)))
