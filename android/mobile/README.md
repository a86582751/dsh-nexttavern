# Native mobile host shell (in development)

This module hosts the real bundled Harness/NextTavern UI. Source implementation
and compilation do not establish a playable APK, Android G0, or production release.
It adds no model calls: installation, process ownership and navigation are native
and deterministic; model requests remain owned by the existing host.

## Build/input contract

- Java platform APIs only, Java 17, compile/target 36, min 30 (Android 11).
- `arm64` application ID `app.nexttavern.android`; `x86Diagnostic` adds
  `.x86diagnostic`, a diagnostic ABI rather than accepted arm64 support.
- The producer supplies ignored `src/main/assets/host.zip` and
  `host-version.txt` (the ZIP's lowercase SHA-256). The ZIP root contains
  `host-launch.mjs`, `android-host.mjs`, and the complete selected dependency
  closure. No networking/install is performed on the Android device.
- JNI inputs are reused from `../app/src/main/jniLibs`, filtered by flavor ABI.
  Packaging requires `libnexttavern_node.so`, `libnexttavern_flock.so`, and
  `libnexttavern_require_builtin.so`; the parent tooling owns their audited
  dependency closure, licensing and 16 KiB static checks. Libraries must be
  installer-extracted (`useLegacyPackaging` / `extractNativeLibs`); no native executable is staged/chmod'ed for execution from app-writable
  directories.
- Release is non-debuggable and unsigned by default; task-only signing and exact
  install/execution evidence belong to the selected validation batch.

## Android publication boundary

Android's ordinary-app SELinux policy forbids hard links, including app-owned
files ([official Android 15 policy](https://android.googlesource.com/platform/system/sepolicy/+/refs/tags/android-15.0.0_r1/private/app_neverallows.te)).
The original hard-link capability probe therefore remains unavailable/failed,
not relabeled as a pass. The Android adaptation uses a separate atomic
`renameat2(RENAME_NOREPLACE)` contract, whose public Bionic symbol requires
API 30: an existing destination must never be replaced, concurrent publication
must have one winner, and staged data/directory durability must be retained.
Immutable aliases require a staged copy so their source object survives.
Desktop hard-link semantics remain unchanged. Android execution evidence for
this replacement is still pending; compilation is not acceptance. The separate
API 26 probe is diagnostic tooling, not an API 26 mobile support promise.

## Runtime/lifecycle contract

A user starts `RuntimeService` while the Activity is visible. It uses a declared
`specialUse` foreground service and visible ongoing notification, with no boot
receiver, sticky restart, periodic automation, or generic JS bridge. Notification
permission is optional platform user choice and does not gate starting work.

The service installs a new asset version into `files/code/<sha>/` through staging
and rename. `.complete` is a schema-1 completion marker; an already completed
version is reused without reading/decompressing the ZIP. Persistent `files/home`,
`workspace`, and `memory` are never extraction targets or deleted on upgrades.

Direct argument vector: `<nativeLibraryDir>/libnexttavern_node.so
<codeRoot>/host-launch.mjs`; no shell or strip-types flag. Environment:

- `HOME` / `DSH_HOME`: `files/home`
- cwd: `files/workspace`; `NEXTTAVERN_MEMORY_HOME`: `files/memory`
- `TMPDIR`: `files/tmp`
- `SSL_CERT_FILE`: `<code>/certs/ca-certificates.pem`; `SSL_CERT_DIR`:
  `<code>/certs`; `OPENSSL_CONF` is empty. This relocates this Termux build's
  OpenSSL-default public CA store. The API 35 x64 ordinary-App probe verified
  public HTTPS with certificate validation; live product model APIs remain unverified.
- `LD_LIBRARY_PATH` / `NEXTTAVERN_NATIVE_LIBRARY_DIR`: installer native directory
- `NEXTTAVERN_FLOCK_ADDON`: installer `libnexttavern_flock.so` (the native-system
  binding for flock and Android atomic no-clobber publication; the historical
  library/environment names remain stable).
- `NEXTTAVERN_GENERATION`: fresh UUID per start; inherited Node loader hooks removed

Stdout control records use `nexttavern-mobile-v1`, matching `generation`, and
`event: "READY"` (`url`, `pid`, `hostVersion`) or `event: "ERROR"` (`code`). Only
one READY from the current owned session can nominate an exact
`http://127.0.0.1:<port>` origin. Raw stdout/stderr and official token URLs are not
logged, displayed, serialized, put into notifications, or saved in Activity
state. Outside the explicit debug-only exception below, READY URLs live only in
the non-exported local service binder's memory.

Stopping writes `{protocol,generation,command:"stop"}` to stdin and waits for
host-owned cancellation/drain without an arbitrary process-lifetime timeout.
The current-generation STOPPED acknowledgement means interruption after known
owners settled and root disposal, **not universal drain/business completion**.
Only after that ACK does native request ordinary SIGTERM to release remaining
CLI handles; it does not force-kill on a deadline. An additional explicit UI
confirmation can force-stop stalled work. Back, rotation,
file selection and temporarily backgrounding the UI do not stop the service.
Service destruction requests ordinary native termination; it does not silently
force-kill an unresponsive process. Android force-kill itself
has no verified process-tree guarantee.

## Web surface

The Activity enables the actual UI's JS/DOM storage but disables file/content
URL access, cross-file access, mixed content, WebView debugging, and third-party
cookies. There is no `addJavascriptInterface`. Only the current exact owned
origin stays embedded; external HTTP(S) main-frame links go to the system browser
and different local origins are blocked. Cleartext network policy allows only
127.0.0.1, not remote cleartext pages. Raw browser console messages are never
logged. The arm64 flavor is a diagnostic no-op and does not read cookies for this
purpose. In controlled fresh synthetic QA only, `x86Diagnostic` emits fixed error
categories, React error numbers, allowlisted public identifiers/bundle positions,
and navigation/renderer metadata. A console ERROR may include a sanitized
description of at most 1000 characters: the current in-memory startup token
(raw and decoded), current origin cookie values and fixture credential are
removed first; URLs, queries/fragments, auth/cookie headers, bearer/key assignments,
JWTs and opaque long values are then removed, with line breaks escaped. Missing
auth context suppresses the description. The auth URL/cookies are never retained
or logged, and no raw console channel, WebView debugging or automatic recovery is
enabled. These diagnostic records do not establish UI success or live-model support.

File inputs use Android SAF `ACTION_OPEN_DOCUMENT`, no broad storage permission
or native card-import bridge. Selection cancellation/rotation cancels the pending
browser callback; users can retry without stopping their host. File upload,
rotation, startup/auth, live model requests, persistence and stop/drain must still
be exercised in the actual app; source settings are not evidence they work.

## Focused checks

```sh
JAVAC=/path/to/jdk/bin/javac JAVA=/path/to/jdk/bin/java \
  bash android/mobile/tools/test-core.sh
# Parent coordinates the selected Android compile/build, for example:
# ./gradlew :mobile:compileX86DiagnosticReleaseJavaWithJavac
```

The standalone test covers code-version reuse, transactional cancellation and
upgrade preservation plus same-origin navigation policy; it does not run Android,
WebView, foreground services, native Node or the actual host.

## Diagnostic-only private stderr

Only **x86Diagnostic + debug** builds retain the first 128 KiB of stderr in
app-private `cache/node-stderr.log`, replaced each native start. They never
capture stdout/READY records and never send these bytes to logcat or the UI.
Release builds do not create that file. A fixture QA session can retrieve it with
`adb shell run-as app.nexttavern.android.x86diagnostic.debug cat cache/node-stderr.log`
redirected to a private local file. It may contain Host data: do not publish it or
print unreviewed contents. Debug fixture evidence is not non-debug G0 evidence.

## Explicit x86 debug backend diagnostic

This source-only variant has XML validation only. Java/Gradle compilation, APK
assembly and device launch remain pending; no runtime pass is claimed. Keep this
component exclusively under `src/x86DiagnosticDebug`, not `src/main`, general
`debug`, arm64 or release builds.

Only `x86DiagnosticDebug` contains `RuntimeDiagnosticActivity`, an exported
explicit component without a launcher or automatic start. It uses native
Start/Stop controls and the same `RuntimeService` under the ordinary app UID,
without constructing a WebView. Launch only for controlled fixture QA:

```sh
adb shell am start -n app.nexttavern.android.x86diagnostic.debug/app.nexttavern.android.mobile.RuntimeDiagnosticActivity
```

While this Activity is active, current-generation readiness is written once to
app-private `cache/runtime-diagnostic-ready.json` as
`{schemaVersion:1,generation,url}`. The service does not expose a Host PID, so the
diagnostic does not fabricate one. A single serial writer deletes the file on
non-ready state, generation change or Activity stop; shutdown drains cleanup.
This exception exists only for the authorized test process to read privately and
use directly for authenticated loopback requests. Never print/copy its token to
logs, screenshots, repository files or public artifacts. The component and writer
are absent from arm64 debug and all release builds. Backend success here does
not establish WebView/UI success, non-debug G0 or a playable release.

The cold installer canonicalizes its fresh private staging root once, applies
lexical normalized ZIP containment per entry, and creates no symlinks. A 64 KiB
compressed-input buffer avoids Inflater's small reads repeatedly crossing
AssetManager JNI; adjacent files reuse their already-created parent directory.
Completed-version reuse remains unchanged and does not read the ZIP. These are
implementation changes pending the new APK's actual cold-start timing, not a
claimed device performance improvement.
