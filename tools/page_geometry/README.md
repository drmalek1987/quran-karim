# Ayah positions on the scanned pages

These scripts measure where every ayah sits on the page images in `web/pages/` and write `data/ayah-rects.json`
(`[surah][ayah] -> [[page, x0, y0, x1, y1], ...]`, coordinates in thousandths of the image width/height, one box per line).
The app draws these boxes in yellow over the page when it opens a search result.

Needs `pip install opencv-python-headless scipy numpy`. Run from this folder, in order (each writes a JSON file the next one reads):

1. `geo.py` finds the page frame on each scan → `quads.json`
2. `pipe.py` straightens each page and finds the text lines and surah header bands → `scan2.json`
3. `tm.py` finds the ayah-end circles by template matching with `T.npy` → `tm.json`
4. `recon.py` puts the circles in reading order and checks them against the ayah count of every surah (all 114 match, 6236 ayahs) → `seq.json`
5. `words.py` turns the circles into line spans (pages 2 and 3 have fixed line centers)
6. `export.py` writes `../../data/ayah-rects.json`

7. `tajweed_pages.py SRC` writes the tajweed colour layer of every page to `../../web/tjpages/` (needs `uharfbuzz freetype-py numba` and the font from `tools/fetch_books.sh`). `quads.json`, `scan2.json` and `seq.json` are kept in this folder so this step can run on its own.

Then `bash build.sh` packs the boxes into `web/quran-data.js`. Word-level boxes from `words.py` were only right two times in three, so they were replaced: kfgqpc and harmain now have measured word boxes (`word_boxes.py` / `word_boxes_harmain.py`, gate 59-60/60 on the check pages), loaded per page as `editions/<id>-w/NNN.js`; kfold and shamarly still use the letter-count estimate.
