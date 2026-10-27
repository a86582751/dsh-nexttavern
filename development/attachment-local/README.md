# Maintained local attachment store

Pinned `@deepseek-ai/dsh-attachment-local`0.1.7-rc.2, official commit
`477b4f420553e8a52c2fbccc464d7561b239c443`. MIT notices and original file hashes are in
`LICENSE.upstream` and `ORIGIN.json`. This private same-name Host override is not an upstream release.

Android's native launcher passes canonical installer-owned `ApplicationInfo.dataDir` as
`NEXTTAVERN_ANDROID_DATA_DIR`. The module captures this once per process. The filesystem owner
requires a non-root absolute boundary and a strictly descendant attachment home before creating
storage; missing/invalid/outside boundaries fail explicitly. Successful first-home proof syncs
all private parent entries through and including dataDir, never dataDir's system-owned parent.
The installer vouches for the dataDir directory entry itself. Cache membership is recorded only
after success, and the fixed captured boundary keeps that existing per-home cache identity valid.

Android 15 ordinary app policy forbids hard links even within app data. Android therefore uses
installer-owned renameat2(RENAME_NOREPLACE) through the managed native-system owner. Success
consumes a disposable stage; EEXIST preserves both paths and still verifies the existing digest.
Filename aliases use the same streamed/hash/fsync staging owner to copy bytes without moving the
committed object. The source stream opens only after successful stage setup. API 30+ and the
actual native binding are required; missing support fails, never overwrites.

Desktop ignores this Android-only environment and keeps the upstream root walk and hard links.
File/data fsync, directory modes and concurrent-writer durability remain unchanged; no
EACCES suppression, permission change outside owned paths, or durability downgrade is introduced.
No model request/retry is added.

Focused test: `runtime/alpha3/tests/attachment-local-android-boundary.test.mts` (public `tests/`
projection). It uses real POSIX directory fsync and small synthetic files, including concurrent
first publication, parent-boundary containment, propagated fsync denial/retry, and unchanged desktop
ancestor sync. It does not launch Harness or prove Android installer/App-UID behavior; that needs
the subsequently rebuilt complete APK on the owned KVM emulator.
