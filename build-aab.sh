#!/usr/bin/env bash
# Builds quran-karim-vX.Y.aab, the Android App Bundle that Google Play takes, from what build.sh leaves in $OUT
# (run build.sh first with the same OUT). Signed with the upload key (keys/upload.jks, password in keys/upload-key.txt).
# Usage: OUT=... ./build-aab.sh path/to/android.jar path/to/bundletool.jar
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BT=/usr/lib/android-sdk/build-tools/debian
ANDROID_JAR="$1"; BUNDLETOOL="$2"
OUT="${OUT:-$HERE/build}"
KS="$HERE/keys/upload.jks"; PASS="$(sed -n 's/^password: //p' "$HERE/keys/upload-key.txt")"

# Resources in the protobuf format bundles use, then the module laid out as bundletool expects.
"$BT/aapt2" link --proto-format -o "$OUT/proto.apk" -I "$ANDROID_JAR" \
  --manifest "$HERE/android/AndroidManifest.xml" --min-sdk-version 21 --target-sdk-version 36 \
  -A "$OUT/assets" "$OUT/res.zip"
rm -rf "$OUT/base" "$OUT/base.zip" && mkdir -p "$OUT/base/manifest" "$OUT/base/dex"
(cd "$OUT/base" && unzip -q ../proto.apk && mv AndroidManifest.xml manifest/ && cp ../classes.dex dex/ && zip -qr ../base.zip .)

VER=$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' "$HERE/android/AndroidManifest.xml")
AAB="$HERE/quran-karim-v$VER.aab"
rm -f "$AAB"
java -jar "$BUNDLETOOL" build-bundle --modules="$OUT/base.zip" --output="$AAB"
jarsigner -keystore "$KS" -storepass "$PASS" -keypass "$PASS" "$AAB" upload >/dev/null
jarsigner -verify "$AAB" | tail -1
ls -la "$AAB"
