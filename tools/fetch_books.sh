#!/usr/bin/env bash
# Downloads the sources for tools/make_books.py into ./build-src (about 430 MB, not shipped).
#   tafsir + i'rab: github.com/spa5k/tafsir_api (per-surah JSON)
#   word roots:     Quranic Arabic Corpus morphology, via github.com/mustafa0x/quran-morphology
#   dictionaries:   OpenITI corpus (github.com/OpenITI), Shamela-based mARkdown texts
#   qira'at:        Ibn al-Jazari, Tahbir al-Taysir (OpenITI); tajweed colours: quran-tajweed-embedded
set -euo pipefail
SRC="${1:-$(cd "$(dirname "$0")/.." && pwd)/build-src}"
mkdir -p "$SRC/tafsir" "$SRC/lex"
for b in ar-tafsir-ibn-kathir ar-tafsir-al-tabari ar-tafseer-tahrir-al-tanwir ar-tafseer-al-qurtubi ar-tafsir-as-saadi \
         i-rab-al-quran-li-al-darwish al-jadwal-fi-i-rab-al-quran; do
  mkdir -p "$SRC/tafsir/$b"
  for s in $(seq 1 114); do echo "$b $s"; done
done | xargs -P 16 -n 2 sh -c 'curl -sS --retry 4 -o "'"$SRC"'/tafsir/$0/$1.json" "https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/$0/$1.json"'
curl -sS -o "$SRC/morphology.txt" https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt
O=https://raw.githubusercontent.com/OpenITI
curl -sS -o "$SRC/lex/mufradat" "$O/0525AH/master/data/0502RaghibIsbahani/0502RaghibIsbahani.Mufradat/0502RaghibIsbahani.Mufradat.Shamela0023636-ara1"
curl -sS -o "$SRC/lex/sihah" "$O/0400AH/master/data/0393IbnHammadJawhari/0393IbnHammadJawhari.SihahTajLugha/0393IbnHammadJawhari.SihahTajLugha.Shamela0023235-ara1"
curl -sS -o "$SRC/lex/maqayis" "$O/0400AH/master/data/0395IbnFarisQazwini/0395IbnFarisQazwini.MucjamMaqayis/0395IbnFarisQazwini.MucjamMaqayis.Shamela0021710-ara1"
curl -sS -o "$SRC/lex/lisan" "$O/0725AH/master/data/0711IbnManzurIfriqi/0711IbnManzurIfriqi.LisanCarab/0711IbnManzurIfriqi.LisanCarab.Shamela0001687-ara1.mARkdown"
curl -sS -o "$SRC/lex/asas" "$O/0550AH/master/data/0538JarAllahZamakhshari/0538JarAllahZamakhshari.AsasBalagha/0538JarAllahZamakhshari.AsasBalagha.Shamela0021568-ara1"
curl -sS -o "$SRC/asbab" "$O/0475AH/master/data/0468IbnAhmadWahidiNaysaburi/0468IbnAhmadWahidiNaysaburi.AsbabNuzul/0468IbnAhmadWahidiNaysaburi.AsbabNuzul.Shamela0011314-ara1"
# القراءات العشر: Ibn al-Jazari, تحبير التيسير
curl -sS -o "$SRC/qiraat-tahbir" "$O/0850AH/master/data/0833IbnJazari/0833IbnJazari.TahbirTaysir/0833IbnJazari.TahbirTaysir.Shamela0005556-ara1"
# Tajweed (Hafs): tarekeldeeb/quran-tajweed-embedded, fork of cpfair/quran-tajweed (CC BY 4.0); used by tools/make_tajweed.py
mkdir -p "$SRC/tajweed"
curl -sS -o "$SRC/tajweed/tajweed.hafs.embeded.txt" https://raw.githubusercontent.com/tarekeldeeb/quran-tajweed-embedded/master/output/tajweed.hafs.embeded.txt
# KFGQPC Uthmanic Hafs font (as served by quran.com); renders the text for tools/page_geometry/tajweed_pages.py
mkdir -p "$SRC/fonts"
curl -sS -o "$SRC/fonts/UthmanicHafs1Ver18.ttf" https://raw.githubusercontent.com/quran/quran.com-frontend-next/master/public/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.ttf
echo "sources in $SRC"
