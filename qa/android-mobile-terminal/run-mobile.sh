#!/usr/bin/env bash
# One runner-owned product/Harness, then one non-debug x64 app in the required KVM VM.
set -Eeuo pipefail
umask 077 # Raw runner diagnostics are never public artifacts.
repo="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
work="${MOBILE_QA_WORK:?}/mobile"
sdk="${MOBILE_QA_SDK:?}"
mkdir -p "$work"
phase=INITIALIZE
fixture_pid=
mode="${1:-}"
cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "$fixture_pid" ]] && kill -0 "$fixture_pid" 2>/dev/null; then
    kill "$fixture_pid"
    if wait "$fixture_pid" 2>/dev/null; then :; fi
  fi
  if ((result!=0)); then
    printf 'MOBILE_FAILED_PHASE=%s EXIT=%s\n' "$phase" "$result"
    # Preparation has only fixed public inputs, no running Host/authentication.
    if [[ "$mode" == prepare && -f "$work/build.log" ]]; then tail -n 20 "$work/build.log"; fi
    if [[ "$mode" == prepare && -f "$work/prepare-host.log" ]]; then tail -n 20 "$work/prepare-host.log"; fi
  fi
  exit "$result"
}
trap cleanup EXIT
export npm_config_cache="$work/npm-cache" GRADLE_USER_HOME="$work/gradle"
export ANDROID_HOME="$sdk" ANDROID_SDK_ROOT="$sdk" ANDROID_NDK_HOME="$sdk/ndk/28.2.13676358"
apk="$work/mobile-x64-release.apk"
probe_apk="$work/probe-x64-kvm.apk"
hierarchy_apk="$work/hierarchy.apk"
if [[ "${1:-}" == prepare ]]; then
  phase=PINNED_BUILD_TOOLS
  node --version
  [[ "$(node --version)" == v24.22.1 ]]
  curl -fsSL --connect-timeout 30 --max-time 300 \
    https://dl.google.com/android/repository/android-ndk-r28c-linux.zip -o "$work/ndk.zip" > "$work/build.log" 2>&1
  printf '%s  %s\n' a7b54a5de87fecd125a17d54f73c446199e72a64 "$work/ndk.zip" | sha1sum -c - >> "$work/build.log"
  mkdir -p "$sdk/ndk"
  unzip -q "$work/ndk.zip" -d "$sdk/ndk"
  mv "$sdk/ndk/android-ndk-r28c" "$ANDROID_NDK_HOME"
  rm "$work/ndk.zip"
  python3 -m venv "$work/tools"
  wheel=patchelf-0.19.1.0-py3-none-manylinux1_x86_64.manylinux_2_5_x86_64.musllinux_1_1_x86_64.whl
  curl -fsSL --connect-timeout 30 --max-time 120 \
    "https://files.pythonhosted.org/packages/e7/03/afd9bdd2ba5f96997196109f25dadbe5141bc6e70dffd85f3f84cc85d69c/$wheel" \
    -o "$work/$wheel" >> "$work/build.log" 2>&1
  printf '%s  %s\n' a8f6331ccf40c345507279f755f4a38c2cb00b9efda746fd43c17713cce0aba4 "$work/$wheel" | sha256sum -c - >> "$work/build.log"
  "$work/tools/bin/pip" install --no-index --no-deps "$work/$wheel" >> "$work/build.log" 2>&1
  export PATH="$work/tools/bin:$PATH"
  patchelf --version
  cd "$repo"
  phase=LOCKED_PUBLIC_MODULE_BUILD
  npm ci --prefix build-tools --no-audit --no-fund >> "$work/build.log" 2>&1
  npm ci --prefix integrations/auth-webserver --no-audit --no-fund >> "$work/build.log" 2>&1
  node tools/build-modules.mjs --write >> "$work/build.log" 2>&1
  printf 'PUBLIC_MODULE_BUILD_COMPLETE\n'
  phase=TARGET_X64_RUNTIME_AND_ADDONS
  node android/tools/prepare-runtime.mts --abi x64 >> "$work/build.log" 2>&1
  node android/tools/build-flock.mts --abi x64 >> "$work/build.log" 2>&1
  node android/tools/build-require-builtin.mjs "$repo/android/artifacts/runtime-inputs-x64" >> "$work/build.log" 2>&1
  printf 'X64_BIONIC_RUNTIME_AND_REAL_ADDONS_BUILT\n'
  phase=PUBLIC_PRODUCT_AND_OFFICIAL_PROFILE
  node qa/android-mobile-terminal/prepare-host.mts "$repo" "$work" >> "$work/build.log" 2>&1
  printf 'PUBLIC_PRODUCT_PROFILE_AND_PACK_COMPLETE\n'
  phase=NONDEBUG_X64_APK_BUILD
  cat > "$work/runner-build.gradle" <<'GRADLE'
gradle.beforeProject { project ->
    project.layout.buildDirectory.set(new File(System.getenv('MOBILE_QA_WORK'), 'mobile/gradle-build/' + project.name))
}
GRADLE
  (cd android && ./gradlew --no-daemon --init-script "$work/runner-build.gradle" :mobile:assembleX86DiagnosticRelease) >> "$work/build.log" 2>&1
  "$JAVA_HOME/bin/keytool" -genkeypair -noprompt -keystore "$work/preview.p12" -storetype PKCS12 \
    -storepass android -keypass android -alias preview -keyalg RSA -keysize 2048 -validity 30 \
    -dname 'CN=Ephemeral Android CI Preview,O=QA only,C=ZZ' >> "$work/build.log" 2>&1
  tools="$sdk/build-tools/36.0.0"
  "$tools/apksigner" sign --ks "$work/preview.p12" --ks-pass pass:android --key-pass pass:android \
    --out "$apk" "$work/gradle-build/mobile/outputs/apk/x86Diagnostic/release/mobile-x86Diagnostic-release-unsigned.apk" >> "$work/build.log" 2>&1
  "$tools/apksigner" verify "$apk" >> "$work/build.log" 2>&1
  printf 'NONDEBUG_X64_PREVIEW_APK_BUILT_NOT_ARM64_QUALIFICATION\n'
  phase=SEPARATE_NONDEBUG_X64_KVM_PROBE_BUILD
  # Reuse the already prepared JNI/locked CA and preview key. This is a new
  # runner-local APK, not a frozen probe replacement or the legacy TCG variant.
  (cd android && ./gradlew --no-daemon --init-script "$work/runner-build.gradle" \
    -PnexttavernProbeAbi=x86_64 :app:assembleRelease) >> "$work/build.log" 2>&1
  "$tools/apksigner" sign --ks "$work/preview.p12" --ks-pass pass:android --key-pass pass:android \
    --out "$probe_apk" "$work/gradle-build/app/outputs/apk/release/app-release-unsigned.apk" >> "$work/build.log" 2>&1
  "$tools/apksigner" verify "$probe_apk" >> "$work/build.log" 2>&1
  printf 'SEPARATE_NONDEBUG_X64_KVM_PROBE_BUILT_DEFAULT_BUDGET_NOT_ARM64_OR_FULL_G0\n'
  phase=PUBLIC_ACCESSIBILITY_HELPER_BUILD
  bash "$repo/qa/android-mobile-terminal/build-hierarchy.sh" "$work" "$sdk" "$work/preview.p12" "$hierarchy_apk"
  printf 'SELF_TARGET_ACCESSIBILITY_SNAPSHOT_FOCUS_HELPER_BUILT\n'
  exit 0
fi
[[ "${1:-}" == exercise ]]
phase=ORDINARY_APP_INSTALL
adb="${MOBILE_QA_ADB:?}"; serial="${MOBILE_QA_SERIAL:?}"
phase=ACCESSIBILITY_HELPER_INSTALL
# Self-targeting test helper only; no instrumentation/signature/debug change to either product APK.
"$adb" -s "$serial" install --no-incremental -t "$hierarchy_apk" > "$work/hierarchy-install.log" 2>&1
phase=ORDINARY_APP_INSTALL
# Preserve installation/navigation failures too; the independent same-VM probe
# is still attempted and can never turn a failed product/UI attempt green.
ui_rc=0
if "$adb" -s "$serial" install --no-incremental "$apk" > "$work/install.log" 2>&1; then
  phase=LOCAL_PROTOCOL_FIXTURE
  node "$repo/android/host/protocol-fixture.mts" 18765 > "$work/protocol-fixture.log" 2>&1 &
  fixture_pid=$!
  # Official emulator host-loopback alias; no ADB reverse tunnel to lose when
  # the independent UI reader reconnects. Product Host remains on its own loopback.
  if node --input-type=module -e '
    for(let i=0;i<20;i++) {
      try {const r=await fetch("http://127.0.0.1:18765/v1/models",{signal:AbortSignal.timeout(1000)});
        if(r.status===200){console.log("LOCAL_FIXTURE_READY_HTTP_200");process.exit(0)}}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    process.exit(1)' &&
    "$adb" -s "$serial" shell 'printf "GET /v1/models HTTP/1.1\r\nHost: fixture\r\nConnection: close\r\n\r\n" | toybox nc -w 5 10.0.2.2 18765 | head -n 1' > "$work/fixture-alias-status.log" &&
    grep -q '^HTTP/1.1 200' "$work/fixture-alias-status.log"; then
    printf 'EMULATOR_HOST_ALIAS_FIXTURE_HTTP_200_NOT_APP_UID_EVIDENCE\n'
    phase=REAL_MAIN_ACTIVITY_SYNTHETIC_FLOW
    node "$repo/qa/android-mobile-terminal/ui-first-stage.mts" --adb "$adb" --serial "$serial" \
      --package app.nexttavern.android.x86diagnostic --phase create --work-dir "$work/ui" --fixture-events "$work/protocol-fixture.log" || ui_rc=$?
  else
    ui_rc=1
    printf 'MOBILE_FIXTURE_READY_OR_HOST_ALIAS_FAILED_NOT_PASSED\n'
  fi
  if kill -0 "$fixture_pid" 2>/dev/null; then
    printf 'LOCAL_FIXTURE_PROCESS_ALIVE_AFTER_UI=true\n'
  else
    fixture_exit=0; wait "$fixture_pid" || fixture_exit=$?
    printf 'LOCAL_FIXTURE_PROCESS_ALIVE_AFTER_UI=false EXIT=%s\n' "$fixture_exit"
  fi

else
  ui_rc=1
  printf 'MOBILE_INSTALL_FAILED_NOT_PASSED\n'
fi
if ((ui_rc==0)); then printf 'ORDINARY_NONDEBUG_APP_SYNTHETIC_FLOW_COMPLETE_NOT_ARM64_OR_G0\n'; fi
phase=SEPARATE_ORDINARY_APP_KVM_PROBE
probe_rc=0
# A failed UI reader can coincide with a brief transport outage. Wait once
# before the independent first install; never replay an ambiguous installation.
if timeout 15 "$adb" -s "$serial" wait-for-device > "$work/probe-install.log" 2>&1 &&
  "$adb" -s "$serial" install --no-incremental "$probe_apk" >> "$work/probe-install.log" 2>&1; then
  node "$repo/qa/android-mobile-terminal/probe-core.mts" --adb "$adb" --serial "$serial" || probe_rc=$?
else
  probe_rc=$?
  chmod 600 "$work/probe-install.log"
  printf 'PROBE_DEVICE_READY_OR_INSTALL_FAILED_NOT_PASSED EXIT=%s\n' "$probe_rc"
  node "$repo/qa/android-mobile-terminal/safe-diagnostics.mts" --file "$work/probe-install.log" \
    --source probe-install --exit "$probe_rc" || :
fi
printf 'MOBILE_UI_EXIT=%s SEPARATE_ANDROID_PUBLICATION_HTTPS_PROBE_EXIT=%s FULL_G0_ACCEPTED=false\n' "$ui_rc" "$probe_rc"
phase=INDEPENDENT_UI_AND_SCOPED_PROBE_RESULTS
if ((ui_rc!=0)); then exit "$ui_rc"; fi
exit "$probe_rc"
