#!/usr/bin/env bash
# QA only. Default tiny control has no Harness/APK; --mobile builds public inputs
# in runner-temp. Neither mode uploads payloads, artifacts, caches or secrets.
# Official source references:
# https://developer.android.com/studio/run/emulator-acceleration
# https://developer.android.com/studio/run/emulator-commandline
# SDK pins: existing official repository XML; API35 r9 SHA256 was already verified locally.
set -Eeuo pipefail
umask 077 # Runner-private diagnostics, including raw emulator/ADB stderr.
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${RUNNER_TEMP:?}/webview-kvm.XXXXXX")"
mode="${1:-control}"
[[ "$mode" == control || "$mode" == --mobile ]]
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
relevant=bool(re.search(r'Process: app\.nexttavern\.android\.(?:webviewcontrol|x86diagnostic|probe\.x86kvm)\b|>>> [^\n]*(?:app\.nexttavern\.android\.(?:webviewcontrol|x86diagnostic|probe\.x86kvm)|sandboxed_process)[^\n]* <<<',text))
if relevant:
 print('RELEVANT_APP_OR_RENDERER_CRASH')
 for signal in sorted(set(re.findall(r'\b(SIG[A-Z0-9]+)\b',text))):print('CRASH_SIGNAL='+signal)
 for kind in sorted(set(re.findall(r'\b((?:java|android)\.[A-Za-z0-9_.]*(?:Exception|Error))\b',text))):print('CRASH_CLASS='+kind)
 raise SystemExit(1)
PY
}
failure_runtime_context() {
  local emulator_exit=0 adb_exit=0
  if [[ -n "$emulator_pid" ]]; then
    if kill -0 "$emulator_pid" 2>/dev/null; then
      mark "OWNED_EMULATOR_PID=$emulator_pid ALIVE=true EXIT=unknown"
    else
      # Only wait after this owned child is dead; never block a live emulator
      # just to diagnose a transport failure, and never call an OOM cause proven.
      wait "$emulator_pid" 2>/dev/null || emulator_exit=$?
      mark "OWNED_EMULATOR_PID=$emulator_pid ALIVE=false EXIT=$emulator_exit"
      case "$emulator_exit" in
        137) mark EMULATOR_EXIT_CONVENTION=SIGKILL ;;
        139) mark EMULATOR_EXIT_CONVENTION=SIGSEGV ;;
        134) mark EMULATOR_EXIT_CONVENTION=SIGABRT ;;
        135) mark EMULATOR_EXIT_CONVENTION=SIGBUS ;;
        132) mark EMULATOR_EXIT_CONVENTION=SIGILL ;;
        143) mark EMULATOR_EXIT_CONVENTION=SIGTERM ;;
      esac
    fi
    if [[ -f "$work/emulator.log" ]]; then
      chmod 600 "$work/emulator.log"
      node "$source_dir/../android-mobile-terminal/safe-diagnostics.mts" --file "$work/emulator.log" --source emulator || :
    fi
  fi
  if [[ -n "$adb" && -n "$emulator_pid" ]]; then
    timeout 5 "$adb" -s "$serial" get-state > "$work/failure-adb-state.log" 2>&1 || adb_exit=$?
    chmod 600 "$work/failure-adb-state.log"
    node "$source_dir/../android-mobile-terminal/safe-diagnostics.mts" --file "$work/failure-adb-state.log" --source adb-state --exit "$adb_exit" || :
    if ((adb_exit==0)) && grep -qx 'device' "$work/failure-adb-state.log"; then
      if timeout 5 "$adb" -s "$serial" logcat -b crash -d > "$work/crash.log" 2>/dev/null; then
        if crash_summary; then :; fi
      else mark CRASH_BUFFER_UNAVAILABLE; fi
    fi
  fi
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
      SDK_TOOL_VERSIONS)
        if [[ -f "$work/versions.log" ]]; then tail -n 12 "$work/versions.log"; fi ;;
      SDK_HOST_DEPENDENCY)
        if [[ -f "$work/host-dependency.log" ]]; then tail -n 20 "$work/host-dependency.log"; fi ;;
      MINIMAL_CONTROL_BUILD)
        if [[ -f "$work/build.log" ]]; then tail -n 20 "$work/build.log"; fi ;;
      AVD_CREATION)
        if [[ -f "$work/avd.log" ]]; then tail -n 16 "$work/avd.log"; fi ;;
    esac
    failure_runtime_context || :
  fi
  if [[ -n "$emulator_pid" ]] && kill -0 "$emulator_pid" 2>/dev/null; then
    kill "$emulator_pid" 2>/dev/null || :
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
phase=SDK_HOST_DEPENDENCY
# The standard Ubuntu 24.04 runner lacks the SDK QEMU binary's libpulse.so.0.
# This is a Linux SDK dependency, not a graphics/sandbox change inside Android.
timeout 120 sudo apt-get update -qq > "$work/host-dependency.log" 2>&1
timeout 120 sudo apt-get install --no-install-recommends -y libpulse0 >> "$work/host-dependency.log" 2>&1
mark SDK_HOST_LIBPULSE_INSTALLED
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
# Exact local SDK registration converted from official repository metadata
# https://dl.google.com/android/repository/repository2-3.xml
# Cached metadata SHA256: 1f0ca6d8b3109ab83afc3e409d53626659b8a233a908e477ac83017919339296
# Only bookkeeping for the already hash-verified emulator 37.2.12; its official
# version and referenced license are retained, with no floating SDK install.
cat > "$sdk/emulator/package.xml" <<'SDK_PACKAGE'
<?xml version="1.0" encoding="UTF-8"?>
<repo:repository xmlns:repo="http://schemas.android.com/repository/android/common/02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:generic="http://schemas.android.com/repository/android/generic/02">
  <license id="android-sdk-license" type="text">Terms and Conditions

This is the Android Software Development Kit License Agreement

1. Introduction

1.1 The Android Software Development Kit (referred to in the License Agreement as the "SDK" and specifically including the Android system files, packaged APIs, and Google APIs add-ons) is licensed to you subject to the terms of the License Agreement. The License Agreement forms a legally binding contract between you and Google in relation to your use of the SDK.

1.2 "Android" means the Android software stack for devices, as made available under the Android Open Source Project, which is located at the following URL: http://source.android.com/, as updated from time to time.

1.3 A "compatible implementation" means any Android device that (i) complies with the Android Compatibility Definition document, which can be found at the Android compatibility website (http://source.android.com/compatibility) and which may be updated from time to time; and (ii) successfully passes the Android Compatibility Test Suite (CTS).

1.4 "Google" means Google Inc., a Delaware corporation with principal place of business at 1600 Amphitheatre Parkway, Mountain View, CA 94043, United States.


2. Accepting the License Agreement

2.1 In order to use the SDK, you must first agree to the License Agreement. You may not use the SDK if you do not accept the License Agreement.

2.2 By clicking to accept, you hereby agree to the terms of the License Agreement.

2.3 You may not use the SDK and may not accept the License Agreement if you are a person barred from receiving the SDK under the laws of the United States or other countries, including the country in which you are resident or from which you use the SDK.

2.4 If you are agreeing to be bound by the License Agreement on behalf of your employer or other entity, you represent and warrant that you have full legal authority to bind your employer or such entity to the License Agreement. If you do not have the requisite authority, you may not accept the License Agreement or use the SDK on behalf of your employer or other entity.


3. SDK License from Google

3.1 Subject to the terms of the License Agreement, Google grants you a limited, worldwide, royalty-free, non-assignable, non-exclusive, and non-sublicensable license to use the SDK solely to develop applications for compatible implementations of Android.

3.2 You may not use this SDK to develop applications for other platforms (including non-compatible implementations of Android) or to develop another SDK. You are of course free to develop applications for other platforms, including non-compatible implementations of Android, provided that this SDK is not used for that purpose.

3.3 You agree that Google or third parties own all legal right, title and interest in and to the SDK, including any Intellectual Property Rights that subsist in the SDK. "Intellectual Property Rights" means any and all rights under patent law, copyright law, trade secret law, trademark law, and any and all other proprietary rights. Google reserves all rights not expressly granted to you.

3.4 You may not use the SDK for any purpose not expressly permitted by the License Agreement.  Except to the extent required by applicable third party licenses, you may not copy (except for backup purposes), modify, adapt, redistribute, decompile, reverse engineer, disassemble, or create derivative works of the SDK or any part of the SDK.

3.5 Use, reproduction and distribution of components of the SDK licensed under an open source software license are governed solely by the terms of that open source software license and not the License Agreement.

3.6 You agree that the form and nature of the SDK that Google provides may change without prior notice to you and that future versions of the SDK may be incompatible with applications developed on previous versions of the SDK. You agree that Google may stop (permanently or temporarily) providing the SDK (or any features within the SDK) to you or to users generally at Google's sole discretion, without prior notice to you.

3.7 Nothing in the License Agreement gives you a right to use any of Google's trade names, trademarks, service marks, logos, domain names, or other distinctive brand features.

3.8 You agree that you will not remove, obscure, or alter any proprietary rights notices (including copyright and trademark notices) that may be affixed to or contained within the SDK.


4. Use of the SDK by You

4.1 Google agrees that it obtains no right, title or interest from you (or your licensors) under the License Agreement in or to any software applications that you develop using the SDK, including any intellectual property rights that subsist in those applications.

4.2 You agree to use the SDK and write applications only for purposes that are permitted by (a) the License Agreement and (b) any applicable law, regulation or generally accepted practices or guidelines in the relevant jurisdictions (including any laws regarding the export of data or software to and from the United States or other relevant countries).

4.3 You agree that if you use the SDK to develop applications for general public users, you will protect the privacy and legal rights of those users. If the users provide you with user names, passwords, or other login information or personal information, you must make the users aware that the information will be available to your application, and you must provide legally adequate privacy notice and protection for those users. If your application stores personal or sensitive information provided by users, it must do so securely. If the user provides your application with Google Account information, your application may only use that information to access the user's Google Account when, and for the limited purposes for which, the user has given you permission to do so.

4.4 You agree that you will not engage in any activity with the SDK, including the development or distribution of an application, that interferes with, disrupts, damages, or accesses in an unauthorized manner the servers, networks, or other properties or services of any third party including, but not limited to, Google or any mobile communications carrier.

4.5 You agree that you are solely responsible for (and that Google has no responsibility to you or to any third party for) any data, content, or resources that you create, transmit or display through Android and/or applications for Android, and for the consequences of your actions (including any loss or damage which Google may suffer) by doing so.

4.6 You agree that you are solely responsible for (and that Google has no responsibility to you or to any third party for) any breach of your obligations under the License Agreement, any applicable third party contract or Terms of Service, or any applicable law or regulation, and for the consequences (including any loss or damage which Google or any third party may suffer) of any such breach.

5. Your Developer Credentials

5.1 You agree that you are responsible for maintaining the confidentiality of any developer credentials that may be issued to you by Google or which you may choose yourself and that you will be solely responsible for all applications that are developed under your developer credentials.

6. Privacy and Information

6.1 In order to continually innovate and improve the SDK, Google may collect certain usage statistics from the software including but not limited to a unique identifier, associated IP address, version number of the software, and information on which tools and/or services in the SDK are being used and how they are being used. Before any of this information is collected, the SDK will notify you and seek your consent. If you withhold consent, the information will not be collected.

6.2 The data collected is examined in the aggregate to improve the SDK and is maintained in accordance with Google's Privacy Policy.


7. Third Party Applications

7.1 If you use the SDK to run applications developed by a third party or that access data, content or resources provided by a third party, you agree that Google is not responsible for those applications, data, content, or resources. You understand that all data, content or resources which you may access through such third party applications are the sole responsibility of the person from which they originated and that Google is not liable for any loss or damage that you may experience as a result of the use or access of any of those third party applications, data, content, or resources.

7.2 You should be aware the data, content, and resources presented to you through such a third party application may be protected by intellectual property rights which are owned by the providers (or by other persons or companies on their behalf). You may not modify, rent, lease, loan, sell, distribute or create derivative works based on these data, content, or resources (either in whole or in part) unless you have been specifically given permission to do so by the relevant owners.

7.3 You acknowledge that your use of such third party applications, data, content, or resources may be subject to separate terms between you and the relevant third party. In that case, the License Agreement does not affect your legal relationship with these third parties.


8. Using Android APIs

8.1 Google Data APIs

8.1.1 If you use any API to retrieve data from Google, you acknowledge that the data may be protected by intellectual property rights which are owned by Google or those parties that provide the data (or by other persons or companies on their behalf). Your use of any such API may be subject to additional Terms of Service. You may not modify, rent, lease, loan, sell, distribute or create derivative works based on this data (either in whole or in part) unless allowed by the relevant Terms of Service.

8.1.2 If you use any API to retrieve a user's data from Google, you acknowledge and agree that you shall retrieve data only with the user's explicit consent and only when, and for the limited purposes for which, the user has given you permission to do so. If you use the Android Recognition Service API, documented at the following URL: https://developer.android.com/reference/android/speech/RecognitionService, as updated from time to time, you acknowledge that the use of the API is subject to the Data Processing Addendum for Products where Google is a Data Processor, which is located at the following URL: https://privacy.google.com/businesses/gdprprocessorterms/, as updated from time to time. By clicking to accept, you hereby agree to the terms of the Data Processing Addendum for Products where Google is a Data Processor.


9. Terminating the License Agreement

9.1 The License Agreement will continue to apply until terminated by either you or Google as set out below.

9.2 If you want to terminate the License Agreement, you may do so by ceasing your use of the SDK and any relevant developer credentials.

9.3 Google may at any time, terminate the License Agreement with you if:
(A) you have breached any provision of the License Agreement; or
(B) Google is required to do so by law; or
(C) the partner with whom Google offered certain parts of SDK (such as APIs) to you has terminated its relationship with Google or ceased to offer certain parts of the SDK to you; or
(D) Google decides to no longer provide the SDK or certain parts of the SDK to users in the country in which you are resident or from which you use the service, or the provision of the SDK or certain SDK services to you by Google is, in Google's sole discretion, no longer commercially viable.

9.4 When the License Agreement comes to an end, all of the legal rights, obligations and liabilities that you and Google have benefited from, been subject to (or which have accrued over time whilst the License Agreement has been in force) or which are expressed to continue indefinitely, shall be unaffected by this cessation, and the provisions of paragraph 14.7 shall continue to apply to such rights, obligations and liabilities indefinitely.


10. DISCLAIMER OF WARRANTIES

10.1 YOU EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SDK IS AT YOUR SOLE RISK AND THAT THE SDK IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND FROM GOOGLE.

10.2 YOUR USE OF THE SDK AND ANY MATERIAL DOWNLOADED OR OTHERWISE OBTAINED THROUGH THE USE OF THE SDK IS AT YOUR OWN DISCRETION AND RISK AND YOU ARE SOLELY RESPONSIBLE FOR ANY DAMAGE TO YOUR COMPUTER SYSTEM OR OTHER DEVICE OR LOSS OF DATA THAT RESULTS FROM SUCH USE.

10.3 GOOGLE FURTHER EXPRESSLY DISCLAIMS ALL WARRANTIES AND CONDITIONS OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO THE IMPLIED WARRANTIES AND CONDITIONS OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.


11. LIMITATION OF LIABILITY

11.1 YOU EXPRESSLY UNDERSTAND AND AGREE THAT GOOGLE, ITS SUBSIDIARIES AND AFFILIATES, AND ITS LICENSORS SHALL NOT BE LIABLE TO YOU UNDER ANY THEORY OF LIABILITY FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR EXEMPLARY DAMAGES THAT MAY BE INCURRED BY YOU, INCLUDING ANY LOSS OF DATA, WHETHER OR NOT GOOGLE OR ITS REPRESENTATIVES HAVE BEEN ADVISED OF OR SHOULD HAVE BEEN AWARE OF THE POSSIBILITY OF ANY SUCH LOSSES ARISING.


12. Indemnification

12.1 To the maximum extent permitted by law, you agree to defend, indemnify and hold harmless Google, its affiliates and their respective directors, officers, employees and agents from and against any and all claims, actions, suits or proceedings, as well as any and all losses, liabilities, damages, costs and expenses (including reasonable attorneys fees) arising out of or accruing from (a) your use of the SDK, (b) any application you develop on the SDK that infringes any copyright, trademark, trade secret, trade dress, patent or other intellectual property right of any person or defames any person or violates their rights of publicity or privacy, and (c) any non-compliance by you with the License Agreement.


13. Changes to the License Agreement

13.1 Google may make changes to the License Agreement as it distributes new versions of the SDK. When these changes are made, Google will make a new version of the License Agreement available on the website where the SDK is made available.


14. General Legal Terms

14.1 The License Agreement constitutes the whole legal agreement between you and Google and governs your use of the SDK (excluding any services which Google may provide to you under a separate written agreement), and completely replaces any prior agreements between you and Google in relation to the SDK.

14.2 You agree that if Google does not exercise or enforce any legal right or remedy which is contained in the License Agreement (or which Google has the benefit of under any applicable law), this will not be taken to be a formal waiver of Google's rights and that those rights or remedies will still be available to Google.

14.3 If any court of law, having the jurisdiction to decide on this matter, rules that any provision of the License Agreement is invalid, then that provision will be removed from the License Agreement without affecting the rest of the License Agreement. The remaining provisions of the License Agreement will continue to be valid and enforceable.

14.4 You acknowledge and agree that each member of the group of companies of which Google is the parent shall be third party beneficiaries to the License Agreement and that such other companies shall be entitled to directly enforce, and rely upon, any provision of the License Agreement that confers a benefit on (or rights in favor of) them. Other than this, no other person or company shall be third party beneficiaries to the License Agreement.

14.5 EXPORT RESTRICTIONS. THE SDK IS SUBJECT TO UNITED STATES EXPORT LAWS AND REGULATIONS. YOU MUST COMPLY WITH ALL DOMESTIC AND INTERNATIONAL EXPORT LAWS AND REGULATIONS THAT APPLY TO THE SDK. THESE LAWS INCLUDE RESTRICTIONS ON DESTINATIONS, END USERS AND END USE.

14.6 The rights granted in the License Agreement may not be assigned or transferred by either you or Google without the prior written approval of the other party. Neither you nor Google shall be permitted to delegate their responsibilities or obligations under the License Agreement without the prior written approval of the other party.

14.7 The License Agreement, and your relationship with Google under the License Agreement, shall be governed by the laws of the State of California without regard to its conflict of laws provisions. You and Google agree to submit to the exclusive jurisdiction of the courts located within the county of Santa Clara, California to resolve any legal matter arising from the License Agreement. Notwithstanding this, you agree that Google shall still be allowed to apply for injunctive remedies (or an equivalent type of urgent legal relief) in any jurisdiction.


January 16, 2019
</license>
  <localPackage path="emulator" obsolete="false">
    <type-details xsi:type="generic:genericDetailsType" />
    <revision>
      <major>37</major>
      <minor>2</minor>
      <micro>12</micro>
    </revision>
    <display-name>Android Emulator</display-name>
    <uses-license ref="android-sdk-license" />
  </localPackage>
</repo:repository>
SDK_PACKAGE
mark PINNED_OFFICIAL_INPUTS_VERIFIED
emulator="$sdk/emulator/emulator"
adb="$sdk/platform-tools/adb"
tools="$sdk/build-tools/36.0.0"
android_jar="$sdk/platforms/android-36/android.jar"
phase=SDK_TOOL_VERSIONS
version="$("$emulator" -version 2> "$work/versions.log")"
printf '%s\n' "${version%%$'\n'*}"
"$adb" version | sed -n '1,2p'
phase=REQUIRED_KVM_ACCELERATION
"$emulator" -accel-check > "$work/accel.log" 2>&1
grep -q 'KVM.*installed and usable' "$work/accel.log"
mark KVM_ACCEL_CHECK_PASSED

if [[ "$mode" == --mobile ]]; then
  export MOBILE_QA_WORK="$work" MOBILE_QA_SDK="$sdk" MOBILE_QA_ADB="$adb" MOBILE_QA_SERIAL="$serial"
  phase=MOBILE_PREPARE
  rm -rf -- "$work/downloads" # verified SDK archives are not runtime inputs
  bash "$source_dir/../android-mobile-terminal/run-mobile.sh" prepare
else
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
fi

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
if [[ "$mode" == --mobile ]]; then
  phase=MOBILE_UI_EXERCISE
  # The child records UI and independent probe outcomes before returning;
  # retain its original UI failure even when the scoped probe is successful.
  mobile_rc=0
  bash "$source_dir/../android-mobile-terminal/run-mobile.sh" exercise || mobile_rc=$?
  if ((mobile_rc==0)); then
    mark MOBILE_UI_AND_SEPARATE_SCOPED_CORE_HTTPS_PASSED_NOT_ARM64_OR_FULL_G0
  else
    mark "MOBILE_UI_OR_SCOPED_PROBE_FAILED EXIT=$mobile_rc"
  fi
  exit "$mobile_rc"
fi
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
