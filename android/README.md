# NextTavern Android — option B runtime checkpoint

This is a **G0 capability probe, not the NextTavern phone app**. It does not
contain a running Harness, chat interface, model keys, or local embedding support.
No existing NextTavern feature is declared removed: those integrations remain
pending until the standalone runtime is proven on Android.

## Architecture and current boundary

The native Java Activity starts a standalone Bionic Node 24 process from
`ApplicationInfo.nativeLibraryDir/libnexttavern_node.so`. Android's package
installer extracts native files (`extractNativeLibs` / legacy JNI packaging).
Scripts and test data are app-private; executable binaries never run from
writable app data. There is no PRoot, Linux distribution, root access, JNI-embedded
Node, background service, or targetSdk 28 workaround. This probe targets API 36.
API 26 and arm64-v8a are provisional probe parameters, not approved product scope.

The upstream system addon 0.1.2's C `flock` implementation is cross-compiled
unchanged using NDK r28c. Its published JS loader rejects `android`; the probe
therefore explicitly loads the installer-owned addon and adapts its callback API.
This does **not** claim the unmodified npm package or the full Host already works.

Development source baseline: maintenance `release/public-v0.3.0`, commit
`2f5a9dffdeb1afe1545655b280e4b89875e452a3`. Host remains `0.1.7-rc.2`.
The Android directory is an independent additive patch; no private maintenance
history/configuration or unrelated 0.3 runtime changes are projected publicly.

## Build on Linux

Requires Node 24, JDK 17+, Android SDK platform 36 / build-tools 36.0.0, NDK
28.2.13676358, `curl`, `dpkg-deb`, `tar`, and patchelf 0.19.1. Accept Google's SDK
license before installing/using SDK components. Gradle 8.13 and AGP 8.13.2 are
pinned; the wrapper verifies its distribution SHA-256.

```sh
# From repository root. Download only the exact archives in the lock, verify
# their hashes, and stage the native closure. No package maintainer script runs.
node android/tools/prepare-runtime.mts
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"
node android/tools/build-flock.mts
cd android
./gradlew :app:assembleRelease
```

For x86_64 emulator diagnostics only, explicitly select `--abi x64` with both
runtime tools:

```sh
node android/tools/prepare-runtime.mts --abi x64
ANDROID_NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358" node android/tools/build-flock.mts --abi x64
```

This uses the separate `runtime-inputs.x64.lock.json` and x86_64 output/cache;
the default remains arm64. The x64 build is diagnostic-only, not arm64 G0 or
product support.

`prepare-runtime.mts [cache-dir] [patchelf-path]` accepts reusable build inputs;
`build-flock.mts [cache-dir]` uses that same cache. Downloaded native bytes and
inventories are ignored build products, not tracked source. The tool rewrites
Termux RUNPATH/SONAME/DT_NEEDED to an APK-compatible `$ORIGIN` closure and retains
license notices. It does not install Termux or execute its package scripts.

Release output is **unsigned**. Sign a test candidate with a private testing key
outside the repository, then verify it with `apksigner`. Never commit a keystore,
signing password, GitHub App key, token, or user data. Debug installation cannot
establish the required non-debug execution evidence.

## Full mobile build from a public checkout

This flow uses the public checkout and its pinned inputs directly; it does not
require a private `artifacts/development/package` tree or private product
builder. The checkout's `build-tools`, `integrations/auth-webserver`, and
`harness` package/lock files are the public npm inputs. Start with Node 24 and
the public lockfiles:

```sh
npm ci --prefix build-tools
npm ci --prefix integrations/auth-webserver
node tools/build-modules.mjs --write
```

The most recent public module build passed 923 modules. Prepare a **new** product
directory from the public build map and a `pi-ai@0.85.1` archive matching the
public `build-tools/package-lock.json` entry. `ABI=arm64` is the arm64 product
preview; `ABI=x64` is diagnostic-only and is not product support.

```sh
ABI=arm64 # set x64 only for the diagnostic emulator build
INPUTS=/absolute/path/to/pinned-public-inputs
P="$PWD/artifacts/android-product-$ABI"
```

Linux `npm ci` may omit the selected Android optional package from the public
build-tools lock. If `@koromix/koffi-android-$ABI@3.3.1` is absent, use only its
exact lockfile tarball and verify SRI **before extracting** it into a fresh
`build-tools/node_modules/@koromix/koffi-android-$ABI` directory. Do not force
install every platform package. Current public lock rows:

| ABI | `resolved` | `integrity` |
| --- | --- | --- |
| arm64 | `https://registry.npmjs.org/@koromix/koffi-android-arm64/-/koffi-android-arm64-3.3.1.tgz` | `sha512-S3yMzUGca5UJRioY7wdBjeO+LuW9mQhrksL+Wd5ri1X7kWMB2IGLzrT1mn1xqx02Vicgvuy5GtkhHuxG5mkzYw==` |
| x64 | `https://registry.npmjs.org/@koromix/koffi-android-x64/-/koffi-android-x64-3.3.1.tgz` | `sha512-QaKSyVi37j19CfN2tR3q8lQMosZ+mQIOQXcNQmWXfYDUs9x2CSCxzvMTeQyFyGdAqB58dBluEiy8V5ZMvARSHg==` |

For the selected row, `npm pack` the exact `resolved` URL into a fresh temporary
directory, compare the tarball's computed `sha512-<base64>` value to `integrity`,
and only then extract it. Run this block only if the selected package is absent
after `npm ci`; do not overwrite an existing package directory:

```sh
set -eu
case "$ABI" in
  arm64)
    KOFFI_URL='https://registry.npmjs.org/@koromix/koffi-android-arm64/-/koffi-android-arm64-3.3.1.tgz'
    KOFFI_SRI='sha512-S3yMzUGca5UJRioY7wdBjeO+LuW9mQhrksL+Wd5ri1X7kWMB2IGLzrT1mn1xqx02Vicgvuy5GtkhHuxG5mkzYw==' ;;
  x64)
    KOFFI_URL='https://registry.npmjs.org/@koromix/koffi-android-x64/-/koffi-android-x64-3.3.1.tgz'
    KOFFI_SRI='sha512-QaKSyVi37j19CfN2tR3q8lQMosZ+mQIOQXcNQmWXfYDUs9x2CSCxzvMTeQyFyGdAqB58dBluEiy8V5ZMvARSHg==' ;;
  *) echo 'ABI must be arm64 or x64' >&2; exit 2 ;;
esac
mkdir -p "$PWD/artifacts"
TMP="$(mktemp -d "$PWD/artifacts/koffi-$ABI.XXXXXX")"
npm pack --ignore-scripts --pack-destination "$TMP" "$KOFFI_URL"
TARBALL="$(find "$TMP" -maxdepth 1 -type f -name '*.tgz' -print -quit)"
node - "$TARBALL" "$KOFFI_SRI" <<'NODE'
const fs = require('node:fs')
const crypto = require('node:crypto')
const actual = 'sha512-' + crypto.createHash('sha512').update(fs.readFileSync(process.argv[2])).digest('base64')
if (actual !== process.argv[3]) throw new Error('koffi lockfile SRI mismatch')
NODE
tar -tvzf "$TARBALL"
```

Review the archive listing before extraction. Reject absolute or escaping paths,
links and non-file entries; only regular files/directories under the `package/`
root are expected. After review, extract into the fresh package directory:

```sh
DEST="build-tools/node_modules/@koromix/koffi-android-$ABI"
test ! -e "$DEST" || { echo 'Refusing to overwrite an existing package directory' >&2; exit 1; }
mkdir -p "$DEST"
tar -xzf "$TARBALL" --strip-components=1 -C "$DEST"
```

Now assemble into the new product directory. The public preparation tool uses
the public build map and `build-tools/node_modules`; it does not invoke a private
development-package builder:

```sh
node android/tools/prepare-product.mjs --repo "$PWD" --out "$P" --abi "$ABI" \
  --pi-ai-archive "$INPUTS/earendil-works__pi-ai-0.85.1.tgz"
```

The recorded x64 `prepare-product` run emitted 17
packages, 11 Host forks and one skin bundle; this is product-assembly evidence
for x64 diagnostics, not arm64 or Android runtime evidence.

Current source recipes additionally register
`@deepseek-ai/dsh-attachment-local@0.1.7-rc.2` as the twelfth Host fork. Its Android
upload-directory durability walk stops at the installer-supplied app data
boundary rather than inaccessible OS ancestors; desktop behavior is unchanged.
This source addition does not qualify the earlier assembly run or the still
pending Android upload, SAF, chat and recovery flows.

Create exactly one fresh, task-owned Harness installation from the public
Harness manifest and lock; keep its home separate from any personal or
production data. Keep all Harness, pnpm and XDG state under this root rather
than inheriting host-machine locations. Install the prepared product into its
`web` profile. Keep the original assembled product `$P`; resolve the installed
package root as `P_INSTALLED` only for the bundled-package bootstrap below.
pnpm may link packages outside `$H`, so do not assume the product is physically
copied into the Harness:

```sh
H="$PWD/artifacts/android-harness"
export H
mkdir "$H" # must be a new directory
cp harness/package.json harness/package-lock.json "$H/"
npm ci --prefix "$H"
export HOME="$H/home"
export DSH_HOME="$H/home"
export PNPM_HOME="$H/home/pnpm"
export XDG_CACHE_HOME="$H/home/.cache"
export XDG_DATA_HOME="$H/home/.local/share"
export XDG_CONFIG_HOME="$H/home/.config"
export PATH="$H/node_modules/.bin:$PNPM_HOME:$PATH" # use the pinned local dsh/pnpm
mkdir -p "$HOME" "$PNPM_HOME" "$XDG_CACHE_HOME" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME"
"$H/node_modules/.bin/dsh" plugin --profile web add "$P"
P_INSTALLED="$(realpath "$H/home/profiles/web/node_modules/dsh-nexttavern")"
export P_INSTALLED
(cd "$H" && DSH_HOME="$H/home" node --input-type=module -e \
  'import {prepareProfile} from "@deepseek-ai/dsh/profile-boot"; await prepareProfile("web")')
```

Use this one Harness root for both ABI variants; stop and reuse or reprepare it
when switching ABI. Do not create a parallel second Harness. Do not use
`--preserve-symlinks`; use the official Host profile resolver to discover linked
package roots and Host peers.

`prepareProfile("web")` creates the profile configuration needed by bootstrap;
it does not relink the bundled package entries. Create the official runtime
resolution before importing
`bootstrapBundledPackages` from the **installed** product's
`lib/operations/bundled-package-bootstrap.mjs`. The backup path must be
absolute, new, and outside the Harness home and product tree. Since `mktemp -d`
returns an existing directory, pass a not-yet-created child path:

```sh
BACKUP_PARENT="$(mktemp -d "$PWD/artifacts/mobile-bootstrap-backup.XXXXXX")"
BACKUP="$BACKUP_PARENT/backup"
test ! -e "$BACKUP"
export BACKUP
node --input-type=module <<'NODE'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const productRoot=fs.realpathSync(process.env.P_INSTALLED)
const harnessRoot=fs.realpathSync(process.env.H)
const home=path.join(harnessRoot,'home')
const hostAnchor=path.join(harnessRoot,'node_modules/@deepseek-ai/dsh/package.json')
const require=createRequire(hostAnchor)
const {Context}=await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href)
const {loadProfileDirectory,createRuntimeResolution,PluginPackages}=await import(
  pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')).href)
const profile=loadProfileDirectory('android-prepare',path.join(home,'profiles/web'),hostAnchor)
const resolution=await createRuntimeResolution({installAnchor:hostAnchor,profile,home})
const ctx=new Context()
try {
  await ctx.plugin(PluginPackages,{resolution})
  const {bootstrapBundledPackages}=await import(pathToFileURL(path.join(productRoot,
    'lib/operations/bundled-package-bootstrap.mjs')).href)
  const result=await bootstrapBundledPackages({productRoot,hostAnchor,home,profile:'web',
    backup:process.env.BACKUP,
    resolvePeerManifest:(name,parentURL)=>ctx.get('pluginPackages')
      .packageOf(name,parentURL)?.manifestPath})
  process.stdout.write(JSON.stringify(result,null,2)+'\n')
} finally {
  await ctx.root.fiber.dispose()
}
NODE
```

The bootstrap returns `bundled-runtime-prepared` with the bundled modules and
`profileGraph: relink-pending`. If `dshmarket` is not already declared by this
profile, declare the pinned version once; skip this command when the profile
already has it:

```sh
"$H/node_modules/.bin/dsh" plugin --profile web add --save-exact dshmarket@1.71.1
```

Then run the official profile install to resolve declared dependencies and
relink the prepared entries:

```sh
"$H/node_modules/.bin/dsh" plugin --profile web install
```

In the verified Harness, `dshmarket@1.71.1` was already declared, so it was not
added again. `plugin install` completed successfully (exit 0; 18 reused, 0
downloaded, 3 added) and performed the profile relink. `prepareProfile` creates
the profile configuration but is not the relink owner.

For a fresh Harness, prepare the profile before bootstrap, add the exact market
version only if it is not already declared, then run `plugin install` to resolve
profile dependencies and relink prepared package entries. The transitive
market lock is not frozen by the public checkout, so this sequence does not
promise byte-for-byte profile rebuilds.

Before packaging, use the public `tools/native-fork-host-cli.mjs` to audit then
activate the exact product forks into this **stopped** Harness. Its absolute-path
`schemaVersion: 1` request uses the immutable assembled product `$P` as
`packageRoot`, `$H` as `hostRoot`, and both `$H/package.json` and
`$H/home/profiles/web/package.json` as Node-resolution anchors. `control` supplies
new absolute lock/receipt paths and a real Host-idle probe. The probe must return
success only when this Harness is stopped; `/bin/true` is not an idle check.
Review the audit before activation. For example, after replacing every
placeholder with an absolute path:

```json
{
  "schemaVersion": 1,
  "input": {
    "packageRoot": "/absolute/path/to/android-product",
    "hostRoot": "/absolute/path/to/android-harness",
    "anchors": [
      "/absolute/path/to/android-harness/package.json",
      "/absolute/path/to/android-harness/home/profiles/web/package.json"
    ]
  },
  "control": {
    "lockPath": "/absolute/path/to/artifacts/host-activation.lock",
    "receiptPath": "/absolute/path/to/artifacts/host-activation.json",
    "probe": {
      "executable": "/absolute/path/to/real-host-idle-probe",
      "args": [],
      "timeoutMs": 10000
    }
  }
}
```

```sh
node tools/native-fork-host-cli.mjs audit --request "$REQUEST" --audit-out "$AUDIT"
# Review the complete audit before applying its exact plan.
node tools/native-fork-host-cli.mjs activate --request "$REQUEST" --audit "$AUDIT"
```

Prepare the selected ABI's native runtime before packing; this also materializes
the locked Termux CA bundle used by `pack-host`:

```sh
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/28.2.13676358"
RUNTIME_CACHE="$PWD/android/artifacts/runtime-inputs"
if [ "$ABI" = x64 ]; then RUNTIME_CACHE="$PWD/android/artifacts/runtime-inputs-x64"; fi
node android/tools/prepare-runtime.mts --abi "$ABI"
CA_BUNDLE="$RUNTIME_CACHE/extracted/ca-certificates/data/data/com.termux/files/usr/etc/tls/cert.pem"
test -f "$CA_BUNDLE"
node android/tools/build-flock.mts --abi "$ABI"
node android/tools/build-require-builtin.mts "$RUNTIME_CACHE"
```

Pack only after the product, profile, fork activation, runtime and locked CA
inputs are ready. Pass the original admitted product `$P` to `--product-root`;
the packer resolves and incorporates its physical profile installation too.
`pack-host` writes a ZIP, matching version file, and a local receipt; copy only
the first two into the mobile assets:

```sh
OUT="$PWD/artifacts/android-host-$ABI"
node android/tools/pack-host.mjs --harness-root "$H" --product-root "$P" \
  --out "$OUT" --abi "$ABI" --ca-bundle "$CA_BUNDLE"
cp "$OUT/host.zip" android/mobile/src/main/assets/host.zip
cp "$OUT/host-version.txt" android/mobile/src/main/assets/host-version.txt
```

Keep `host-pack.json` outside the APK. Build the mobile variant with the pinned
NDK. `build-require-builtin.mts` emits both ABI libraries; the release APK is
unsigned and any test signature stays outside the repository:

```sh
cd android
./gradlew :mobile:assembleArm64Release       # arm64 preview (unsigned)
# Or, for emulator diagnostics only:
./gradlew :mobile:assembleX86DiagnosticDebug # x64 debug, not final-qualified
```

The public pack step has passed with 540 packages; its ZIP is 183,418,362 bytes
(SHA-256 `f26cd021a41d8309e62ed9746556f0e9f86bb8692063cbc6d627eb3c3002b34d`).
The current x64 debug candidate (248,817,677 bytes; SHA-256
`696899953a08ed4f3a648fa05b5c9222264d67c27c746ba7d39031e494e46c3b`) includes
the public payload, debug-only diagnostic Activity, and corrected pinned ICU
notice; signature verification passed. Installation/device entry remains
pending. This candidate is not final-qualified; mobile G0, foreground service
and runtime gates remain open. No formal release or production signing is
claimed.

## Focused checks

See [`probe/README.md`](probe/README.md) for Node checks and their prerequisites;
see [`app/README.md`](app/README.md) for the Java core checks. Use local checks for
this batch; no second CI execution is required merely for the same inputs.
Successful desktop checks are not Android G0 acceptance. Missing native bindings
are reported BLOCKED, and a no-op lock cannot satisfy the contention probe.

## Device handoff

Install the test-signed, non-debug arm64 APK on a modern Android phone, run the
probe in the foreground, then copy its result. Switching away cancels the run.
Keep the exact APK SHA-256 and returned device/API/page-size/build context with
the results. Test data is synthetic and isolated from NextTavern user data.

One successful phone run proves only that device/configuration. G0 still needs
the planned cold install / replacement upgrade, 4 KB / 16 KB, dependency closure,
and process-lifecycle evidence. In particular, force-killing the parent is not
yet a proven process-tree cleanup strategy. Do not infer those gates from a
green capability summary or a successfully compiled APK.

Next: use actual device evidence to fix runtime issues, then integrate the
correct release-branch Host, stable homes/profile, native lifecycle, authenticated
loopback WebView, SAF, and real product flows. No automatic paid model calls or
production deployment is introduced by this checkpoint.
