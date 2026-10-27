#!/usr/bin/env bash
# Copies the scanned page images out of the PDF, unchanged, into source/pages-original/NNN.jpg.
# Then run: python3 tools/enhance_pages.py   (writes the sharpened web/pages/NNN.webp the app shows)
# Usage: bash tools/extract_pages.sh path/to/quran.pdf   (needs poppler-utils)
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
pdfimages -j "$1" "$TMP/p"
mkdir -p "$HERE/source/pages-original"
for f in "$TMP"/p-*.jpg; do n="${f##*/p-}"; cp "$f" "$HERE/source/pages-original/$n"; done
rm -rf "$TMP"
ls "$HERE/source/pages-original" | wc -l
