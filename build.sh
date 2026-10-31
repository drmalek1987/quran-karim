#!/usr/bin/env bash
# Builds quran-karim-vX.Y.apk (version from android/AndroidManifest.xml) without Gradle, using the Android tools from Ubuntu's
# packages:  apt-get install aapt apksigner zipalign dalvik-exchange
# Usage: [PLAY=1] ./build.sh [path/to/android.jar]   (android-34 platform jar is enough: targetSdk 36 is only a number here; PLAY=1 = the Google Play build)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BT=/usr/lib/android-sdk/build-tools/debian
ANDROID_JAR="${1:-${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}}"
OUT="${OUT:-$HERE/build}"
KEYSTORE="${KEYSTORE:-$HERE/debug.keystore}"

rm -rf "$OUT"
mkdir -p "$OUT/assets" "$OUT/gen" "$OUT/classes"

python3 -I "$HERE/tools/make_data.py"
cp -r "$HERE/web" "$OUT/assets/web" && rm -f "$OUT/assets/web/icons/icon.svg" "$OUT/assets/web/sw.js" "$OUT/assets/web/manifest.webmanifest"
# PLAY=1: the Google Play build, without the scanned edition (no publishing licence) and its tajweed layer.
if [ "${PLAY:-}" = 1 ]; then
  rm -rf "$OUT/assets/web/pages" "$OUT/assets/web/tjpages"
  echo 'window.NO_HARMAIN = true;' > "$OUT/assets/web/flags.js"
fi

# Mushaf page images are not in the APK: one zip per edition (paths as under web/) for the GitHub release that the app
# downloads from when the reader picks the edition (EdStore.java). Zips land in $OUT/editions-zips.
mkdir -p "$OUT/editions-zips"
for ED in kfgqpc shamarly harmain; do
  W="$OUT/assets/web"
  if [ "$ED" = harmain ]; then SUB="pages tjpages"; else SUB="editions/$ED editions/$ED-tj"; fi
  HAVE=""; for d in $SUB; do [ -d "$W/$d" ] && HAVE="$HAVE $d"; done
  [ -n "$HAVE" ] || continue
  (cd "$W" && zip -q -0 -r "$OUT/editions-zips/$ED.zip" $HAVE && rm -rf $HAVE)
done
# The thematic mushaf's page margins (tools/thematic_notes.py) are downloaded the same way, on first use.
[ -d "$OUT/assets/web/thmnotes" ] && (cd "$OUT/assets/web" && zip -q -0 -r "$OUT/editions-zips/thmnotes.zip" thmnotes && rm -rf thmnotes)
ls -la "$OUT/editions-zips"

python3 -I "$HERE/tools/brotli_books.py" "$OUT/assets/web/books"

"$BT/aapt2" compile --dir "$HERE/android/res" -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$ANDROID_JAR" \
  --manifest "$HERE/android/AndroidManifest.xml" \
  -0 br --min-sdk-version 21 --target-sdk-version 36 \
  -A "$OUT/assets" --java "$OUT/gen" "$OUT/res.zip"

LIBS=$(ls "$HERE"/android/libs/*.jar | tr '\n' ':')
javac -nowarn -Xlint:-options --release 8 -cp "$ANDROID_JAR:$LIBS" -d "$OUT/classes" \
  $(find "$HERE/android/src" "$OUT/gen" -name '*.java')
for j in "$HERE"/android/libs/*.jar; do (cd "$OUT/classes" && unzip -qo "$j" '*.class'); done
"$BT/dx" --dex --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && zip -q -j unsigned.apk classes.dex)

"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -keystore "$KEYSTORE" -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi
VER=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' "$HERE/android/AndroidManifest.xml")
APK="$HERE/quran-karim-v$VER.apk"
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out "$APK" "$OUT/aligned.apk"
"$BT/apksigner" verify --print-certs "$APK" | head -3
ls -la "$APK"
