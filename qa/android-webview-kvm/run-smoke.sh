#!/usr/bin/env bash
# Draft QA only. No Gradle, product APK, Harness, model, cache/artifact upload or secrets.
# Official source references:
# https://developer.android.com/studio/run/emulator-acceleration
# https://developer.android.com/studio/run/emulator-commandline
# SDK pins: existing official repository XML; API35 r9 SHA256 was already verified locally.
set -Eeuo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${RUNNER_TEMP:?}/webview-kvm.XXXXXX")"
phase=INITIALIZE
serial=emulator-5554
pkg=app.nexttavern.android.webviewcontrol
emulator_pid=
adb=
input_name=
mark() { printf '%s\n' "$1"; }

crash_summary() {
  python3 - "$work/crash.log" <<'PY'
import pathlib,re,sys
p=pathlib.Path(sys.argv[1]); text=p.read_text(errors='replace') if p.exists() else ''
relevant=bool(re.search(r'Process: app\.nexttavern\.android\.webviewcontrol\b|>>> [^\n]*(?:app\.nexttavern\.android\.webviewcontrol|sandboxed_process)[^\n]* <<<',text))
if relevant:
 print('RELEVANT_APP_OR_RENDERER_CRASH')
 for signal in sorted(set(re.findall(r'\b(SIG[A-Z0-9]+)\b',text))):print('CRASH_SIGNAL='+signal)
 for kind in sorted(set(re.findall(r'\b((?:java|android)\.[A-Za-z0-9_.]*(?:Exception|Error))\b',text))):print('CRASH_CLASS='+kind)
 raise SystemExit(1)
PY
}
cleanup() {
  result=$?
  trap - EXIT
  if (( result != 0 )); then
    mark "FAILED_PHASE=$phase EXIT=$result"
    # Only fixed public SDK/control-input diagnostics may reach the job log.
    # Emulator output, raw logcat and dumps remain private and are never tailed.
    case "$phase" in
      PINNED_OFFICIAL_INPUTS)
        mark "PUBLIC_SDK_LAST_DOWNLOAD=$input_name"
        if [[ -f "$work/download.log" ]]; then tail -n 16 "$work/download.log"; fi ;;
      REQUIRED_KVM_ACCELERATION)
        if [[ -f "$work/accel.log" ]]; then tail -n 12 "$work/accel.log"; fi ;;
      MINIMAL_CONTROL_BUILD)
        if [[ -f "$work/build.log" ]]; then tail -n 20 "$work/build.log"; fi ;;
      AVD_CREATION)
        if [[ -f "$work/avd.log" ]]; then tail -n 16 "$work/avd.log"; fi ;;
    esac
    if [[ -n "$adb" && -n "$emulator_pid" ]]; then
      if "$adb" -s "$serial" logcat -b crash -d > "$work/crash.log" 2>/dev/null; then
        if crash_summary; then :; fi
      fi
    fi
  fi
  if [[ -n "$emulator_pid" ]] && kill -0 "$emulator_pid" 2>/dev/null; then
    kill "$emulator_pid"
    if wait "$emulator_pid" 2>/dev/null; then :; fi
  fi
  rm -rf -- "$work"
  exit "$result"
}
trap cleanup EXIT

phase=KVM_DEVICE
[[ -c /dev/kvm ]]
if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  # Grant only the existing runner group access on this ephemeral hosted runner.
  sudo chgrp "$(id -gn)" /dev/kvm
  sudo chmod g+rw /dev/kvm
fi
[[ -r /dev/kvm && -w /dev/kvm ]]
mark KVM_DEVICE_ACCESSIBLE
export JAVA_HOME="${JAVA_HOME_17_X64:?}"
export PATH="$JAVA_HOME/bin:$PATH"
"$JAVA_HOME/bin/javac" -version
sdk="$work/sdk"
export ANDROID_HOME="$sdk" ANDROID_SDK_ROOT="$sdk"
export ANDROID_USER_HOME="$work/android-user" ANDROID_AVD_HOME="$work/avd"
mkdir -p "$sdk" "$ANDROID_USER_HOME" "$ANDROID_AVD_HOME" "$work/downloads"

phase=PINNED_OFFICIAL_INPUTS
fetch() {
  local filename=$1 algorithm=$2 expected=$3
  input_name="${filename##*/}"
  curl --fail --location --silent --show-error --retry 2 --connect-timeout 30 --max-time 300 \
    "https://dl.google.com/android/repository/$filename" -o "$work/downloads/${filename##*/}" \
    >> "$work/download.log" 2>&1
  printf '%s  %s\n' "$expected" "$work/downloads/${filename##*/}" | "${algorithm}sum" -c - >> "$work/download.log"
}
fetch emulator-linux_x64-16428233.zip sha1 cd7362ea55dfb86a418958138dc396e74165dd01
fetch commandlinetools-linux-15859902_latest.zip sha1 040d3996a65543d22ec4bf73e4c37aa37a8d4af4
fetch platform-tools_r37.0.1-linux.zip sha1 477254aa5f903c15cf51001717bdf347fb6b53e0
fetch platform-36_r02.zip sha1 2c1a80dd4d9f7d0e6dd336ec603d9b5c55a6f576
fetch build-tools_r36_linux.zip sha1 b0b6376977657e8ad9b969bacf4093601da2c6fb
fetch sys-img/google_apis/x86_64-35_r09.zip sha256 c67b9ba0ff5bc0eb6d046871bfa228af14d4d47b02f0cdae94f048e511b7566e
python3 - "$work/downloads" "$sdk" >> "$work/download.log" 2>&1 <<'PY'
import pathlib,stat,sys,zipfile
downloads,sdk=map(pathlib.Path,sys.argv[1:])
archives=[('emulator-linux_x64-16428233.zip',sdk),
 ('platform-tools_r37.0.1-linux.zip',sdk),
 ('commandlinetools-linux-15859902_latest.zip',sdk/'cmdline-tools/22.0'),
 ('platform-36_r02.zip',sdk/'platforms/android-36'),
 ('build-tools_r36_linux.zip',sdk/'build-tools/36.0.0'),
 ('x86_64-35_r09.zip',sdk/'system-images/android-35/google_apis/x86_64')]
for name,dest in archives:
 print('PUBLIC_SDK_EXTRACT='+name,flush=True)
 with zipfile.ZipFile(downloads/name) as z:
  strip=name not in ['emulator-linux_x64-16428233.zip','platform-tools_r37.0.1-linux.zip']
  for info in z.infolist():
   parts=pathlib.PurePosixPath(info.filename).parts
   if strip:parts=parts[1:]
   if not parts:continue
   out=dest.joinpath(*parts)
   if info.is_dir():out.mkdir(parents=True,exist_ok=True);continue
   out.parent.mkdir(parents=True,exist_ok=True)
   if stat.S_ISLNK(info.external_attr>>16):
    out.symlink_to(z.read(info).decode());continue
   with z.open(info) as src,out.open('wb') as target:
    import shutil
    shutil.copyfileobj(src,target)
   mode=(info.external_attr>>16)&0o777
   if mode:out.chmod(mode)
PY
mark PINNED_OFFICIAL_INPUTS_VERIFIED
emulator="$sdk/emulator/emulator"
adb="$sdk/platform-tools/adb"
tools="$sdk/build-tools/36.0.0"
android_jar="$sdk/platforms/android-36/android.jar"
version="$("$emulator" -version 2>/dev/null)"
printf '%s\n' "${version%%$'\n'*}"
"$adb" version | sed -n '1,2p'
phase=REQUIRED_KVM_ACCELERATION
"$emulator" -accel-check > "$work/accel.log" 2>&1
grep -q 'KVM.*installed and usable' "$work/accel.log"
mark KVM_ACCEL_CHECK_PASSED

phase=MINIMAL_CONTROL_BUILD
mkdir -p "$work/classes" "$work/dex"
"$JAVA_HOME/bin/javac" --release 17 -cp "$android_jar" -d "$work/classes" \
  "$source_dir/MainActivity.java" > "$work/build.log" 2>&1
mapfile -t classes < <(find "$work/classes" -name '*.class' -print)
"$tools/d8" --release --min-api 26 --lib "$android_jar" --output "$work/dex" "${classes[@]}" >> "$work/build.log" 2>&1
cat > "$work/AndroidManifest.xml" <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="app.nexttavern.android.webviewcontrol">
 <uses-sdk android:minSdkVersion="26" android:targetSdkVersion="36" />
 <uses-permission android:name="android.permission.INTERNET" />
 <application android:debuggable="true" android:allowBackup="false" android:hardwareAccelerated="true"
  android:label="WebView-only QA control" android:theme="@android:style/Theme.Material.Light.NoActionBar">
  <activity android:name=".MainActivity" android:exported="true">
   <intent-filter><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent-filter>
  </activity>
 </application>
</manifest>
XML
"$tools/aapt2" link -I "$android_jar" --manifest "$work/AndroidManifest.xml" -o "$work/unsigned.apk" >> "$work/build.log" 2>&1
python3 - "$work" <<'PY'
import pathlib,sys,zipfile
p=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(p/'unsigned.apk','a',compression=zipfile.ZIP_DEFLATED) as z:z.write(p/'dex/classes.dex','classes.dex')
PY
"$tools/zipalign" -f 4 "$work/unsigned.apk" "$work/aligned.apk" >> "$work/build.log" 2>&1
"$JAVA_HOME/bin/keytool" -genkeypair -noprompt -keystore "$work/control.p12" -storetype PKCS12 \
  -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 30 \
  -dname 'CN=Ephemeral WebView QA,O=Local control,C=ZZ' >> "$work/build.log" 2>&1
"$tools/apksigner" sign --ks "$work/control.p12" --ks-pass pass:android --key-pass pass:android \
  --out "$work/control.apk" "$work/aligned.apk" >> "$work/build.log" 2>&1
"$tools/apksigner" verify "$work/control.apk" >> "$work/build.log" 2>&1
mark MINIMAL_CONTROL_BUILT

phase=AVD_CREATION
printf 'no\n' | "$sdk/cmdline-tools/22.0/bin/avdmanager" create avd --force --name webview-kvm \
  --package 'system-images;android-35;google_apis;x86_64' --device 'Nexus S' > "$work/avd.log" 2>&1
phase=SINGLE_COLD_KVM_BOOT
# Same documented SwiftShader renderer as the retained local control. KVM is
# the changed execution condition; do not add Vulkan/DPI/sandbox overrides.
"$emulator" -avd webview-kvm -no-window -no-audio -no-boot-anim -no-snapshot -wipe-data \
  -no-metrics -gpu swiftshader -accel on -port 5554 > "$work/emulator.log" 2>&1 &
emulator_pid=$!
timeout 300 "$adb" -s "$serial" wait-for-device > "$work/adb.log" 2>&1
booted=false
for ((i=0;i<300;i++)); do
  kill -0 "$emulator_pid" 2>/dev/null
  if [[ "$("$adb" -s "$serial" shell getprop sys.boot_completed | tr -d '\r')" == 1 ]]; then booted=true; break; fi
  sleep 1
done
[[ "$booted" == true ]]
[[ "$("$adb" -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')" == 35 ]]
[[ "$("$adb" -s "$serial" shell getprop ro.product.cpu.abi | tr -d '\r')" == x86_64 ]]
mark API35_X86_64_KVM_BOOTED
"$adb" -s "$serial" install --no-incremental "$work/control.apk" > "$work/install.log" 2>&1
"$adb" -s "$serial" logcat -c
"$adb" -s "$serial" shell input keyevent KEYCODE_WAKEUP
"$adb" -s "$serial" shell wm dismiss-keyguard
"$adb" -s "$serial" shell am start -W -n "$pkg/.MainActivity" > "$work/launch.log" 2>&1
pid="$("$adb" -s "$serial" shell pidof "$pkg" | tr -d '\r')"
[[ "$pid" =~ ^[0-9]+$ ]]

check_control() {
  kill -0 "$emulator_pid" 2>/dev/null
  [[ "$("$adb" -s "$serial" shell pidof "$pkg" | tr -d '\r')" == "$pid" ]]
  "$adb" -s "$serial" logcat -d -v brief -s 'NextTavernKvmControl:I' '*:S' > "$work/control.log"
  if grep -Eq 'RENDERER_GONE|PAGE_ERROR|JS_DOM_FAILED' "$work/control.log"; then return 1; fi
  "$adb" -s "$serial" logcat -b crash -d > "$work/crash.log"
  crash_summary
}
wait_marker() {
  local marker=$1
  for ((i=0;i<90;i++)); do
    check_control
    if grep -q "$marker" "$work/control.log"; then return; fi
    sleep 1
  done
  return 1
}
phase=NATIVE_ONLY_CONTROL
wait_marker NATIVE_READY
sleep 5
check_control
if grep -q WEBVIEW_REQUESTED "$work/control.log"; then exit 1; fi
mark NATIVE_ONLY_CONTROL_SURVIVED

phase=EXPLICIT_WEBVIEW_LOCAL_HTML
"$adb" -s "$serial" shell uiautomator dump /sdcard/kvm-control-ui.xml > "$work/ui-dump.log" 2>&1
"$adb" -s "$serial" exec-out cat /sdcard/kvm-control-ui.xml > "$work/ui.xml"
read -r x y < <(python3 - "$work/ui.xml" 2>> "$work/ui-dump.log" <<'PY'
import re,sys,xml.etree.ElementTree as E
node=next(n for n in E.parse(sys.argv[1]).iter('node') if n.get('content-desc')=='WEBVIEW_CREATE')
x1,y1,x2,y2=map(int,re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]',node.get('bounds')).groups())
print((x1+x2)//2,(y1+y2)//2)
PY
)
"$adb" -s "$serial" shell input tap "$x" "$y"
wait_marker WEBVIEW_REQUESTED
wait_marker JS_DOM_READY
wait_marker PAGE_FINISHED
grep -q 'PROVIDER com.google.android.webview 124.0.6367.219' "$work/control.log"
mark WEBVIEW_PROVIDER=com.google.android.webview/124.0.6367.219
mark INLINE_JS_DOM_READY
mark LOCAL_PAGE_FINISHED
phase=POST_PAGE_PROCESS_SURVIVAL
for ((i=0;i<10;i++)); do sleep 1; check_control; done
mark SAME_CONTROL_PROCESS_SURVIVED
mark 'KVM_WEBVIEW_CONTROL_PASSED_NOT_PRODUCT_OR_G0'
