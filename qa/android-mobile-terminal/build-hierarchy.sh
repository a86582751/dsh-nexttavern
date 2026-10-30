#!/usr/bin/env bash
# Same self-targeting QA helper for mobile and tiny transport control.
set -Eeuo pipefail
umask 077
repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
work="${1:?private build directory}"
sdk="${2:?pinned SDK directory}"
keystore="${3:?ephemeral QA keystore}"
hierarchy_apk="${4:?output APK}"
tools="$sdk/build-tools/36.0.0"
mkdir -p "$work"
mkdir -p "$work/hierarchy/classes" "$work/hierarchy/dex"
"$JAVA_HOME/bin/javac" --release 17 -cp "$sdk/platforms/android-36/android.jar" \
  -d "$work/hierarchy/classes" "$repo/qa/android-mobile-terminal/HierarchyInstrumentation.java" >> "$work/build.log" 2>&1
"$tools/d8" --release --min-api 26 --lib "$sdk/platforms/android-36/android.jar" \
  --output "$work/hierarchy/dex" "$work/hierarchy/classes/app/nexttavern/qa/ui/HierarchyInstrumentation.class" >> "$work/build.log" 2>&1
cat > "$work/hierarchy/AndroidManifest.xml" <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="app.nexttavern.qa.ui">
 <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="36" />
 <application android:debuggable="false" android:allowBackup="false" android:testOnly="true" android:label="Runner UI accessibility helper" />
 <instrumentation android:name=".HierarchyInstrumentation" android:targetPackage="app.nexttavern.qa.ui" />
</manifest>
XML
"$tools/aapt2" link -I "$sdk/platforms/android-36/android.jar" \
  --manifest "$work/hierarchy/AndroidManifest.xml" -o "$work/hierarchy/unsigned.apk" >> "$work/build.log" 2>&1
python3 - "$work/hierarchy" <<'PY_HELPER'
import pathlib,sys,zipfile
p=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(p/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:z.write(p/'dex/classes.dex','classes.dex')
PY_HELPER
"$tools/zipalign" -f 4 "$work/hierarchy/unsigned.apk" "$work/hierarchy/aligned.apk" >> "$work/build.log" 2>&1
"$tools/apksigner" sign --ks "$keystore" --ks-pass pass:android --key-pass pass:android \
  --out "$hierarchy_apk" "$work/hierarchy/aligned.apk" >> "$work/build.log" 2>&1
"$tools/apksigner" verify "$hierarchy_apk" >> "$work/build.log" 2>&1
