# Foreground Android Node capability probe

This is **not the mobile product or a passed G0 gate**. It has no WebView,
JavaScript bridge, background service, credential access, or storage permission.
The normal `INTERNET` permission is needed for native loopback socket tests.

- Namespace: `app.nexttavern.android.probe`; Java platform UI, API 26 provisional
  probe floor, compile/target 36, Java 17. No Kotlin/Compose/AndroidX dependency.
- Supply an audited **Android arm64 executable**, named
  `src/main/jniLibs/arm64-v8a/libnexttavern_node.so`. Do not substitute desktop
  Node, a stub, or a downloaded executable copied into writable app data.
  Packaging fails if it is absent. Runtime ABI/ELF/dependency provenance and
  actual release-APK execution remain separate acceptance requirements.
- `useLegacyPackaging = true` and `extractNativeLibs = true` request installer
  extraction. The app launches only `ApplicationInfo.nativeLibraryDir` directly,
  with an argument vector, never a shell. It does not chmod or copy native code.
- Gradle stages only root `android/probe/*.mts` and `fixtures/**` into `assets/probe/`.
  A worker copies the bundle to a fresh private staging directory, fsyncs files,
  then renames the complete directory before use. Working data stays at
  `filesDir/probe-data`. Only the temporary code bundle is removed afterward.
- Command: `<nativeLibraryDir>/libnexttavern_node.so
  --experimental-strip-types <private-bundle>/run.mts`; 180-second deadline.
  `NODE_OPTIONS`/`NODE_PATH` are removed, stdin closed, stderr kept separate.
  `LD_LIBRARY_PATH` and `NEXTTAVERN_FLOCK_ADDON` point only at installer native
  libraries; the native locking adapter is never copied into writable data.
- JSONL protocol is `nexttavern-g0`; one `ready` plus exactly one valid `result`
  and exit zero are required for **Android capabilities passed**. The record
  must report `actualPlatform: "android"`, `status: "passed"`, `ok: true`, and
  `androidGate: false`. Missing native runtime/launch failure is BLOCKED.
  An Android capability pass still does not accept the complete G0 gate.
- A native copy-records button copies device/build metadata (including OS page size), the full bounded final
  JSON record, and bounded separate stdout/stderr to the clipboard; no adb or
  additional permission is needed. It always labels full G0 unaccepted.
- Logs, individual lines, asset size/count/depth, and UI refresh queue are bounded.
  Leaving the foreground cancels, sends termination, then forcibly stops the
  child if needed. Probe child processes must perform their own signal cleanup.
  Force-killing the Android app itself has no verified process-tree guarantee.
- Debug uses a `.debug` application ID suffix. Release is non-debuggable and
  deliberately unsigned; a debug build or unsigned APK is not signed-release
  installation/execution evidence. No device test is claimed by source checks.

## SDK-independent behavioral checks

```sh
# JDK 17+; JAVAC/JAVA may be explicit executable paths.
bash android/app/tools/test-core.sh
```

The script compiles only `core/` plus the standalone test main, with Java 8
language/API compatibility and compiler warnings treated as errors. It tests
path isolation, transactional copy rollback, bounded logs, stdout/stderr
separation, readiness/result/exit mismatches, timeout, exec denial, and active
cancellation using fake subprocesses. It does not prove Android APIs, native
execution, Node capabilities, APK alignment, signing, or release installation.
