# Android G0: standalone Node capability probes

Maintained `.mts`, directly runnable with Node 24 type stripping. No build,
model credentials, provider calls, package installation, or internet access is
performed by the suite. TLS connects only to `127.0.0.1`; DNS asks the OS for
`localhost`. Public CA trust, external DNS and network access remain unverified.

```sh
cd android/probe
node run.mts --output artifacts/result.json
node --test tests/*.test.mts
```

Use the Node **executable path**, not the shebang, in the APK supervisor. The
supervisor sets an app-private cwd before invoking `run.mts [--output path]`.
Temporary databases, files and locks live only under
`cwd/artifacts/test-temp/run-*` and are removed after the run; tests use this
directory below `android/probe`. An abrupt kill can leave disposable run files.
The suite never opens a Harness profile, session or credential store. Each
capability has a 12-second deadline (at most 120 seconds plus cleanup); the
supervisor should allow 180 seconds. SIGTERM/SIGINT cancel current work, kill
owned child processes and terminate workers. Child IPC disconnect exits any
remaining descendant; every child also has a 20-second safety deadline.

## Protocol and meaning

Stdout is JSONL, one object per line, all with `protocol: "nexttavern-g0"`:

1. `event: "ready"`: `scope`, `pid`, `platform`, `actualPlatform`.
2. Ten `event: "check"` objects, each containing `check` with `id`, `status`,
   `durationMs`, `evidence`, and `error` on `failed`/`blocked`.
3. `event: "result"`: `status`, `ok`, `platform`, `actualPlatform`,
   `androidGate: false`, and the full `summary`.

`--output` writes that same summary as a single JSON document (parent directory
must exist). Its schema is [`result.schema.json`](result.schema.json). Stderr
contains diagnostics; CLI/setup/output failures are structured `event: "error"`
records. Invalid arguments do not run any probes.

Exit codes: **0** = all capabilities passed on actual `android` / `arm64` /
Node 24; **1** = failure; **2** = unavailable capability or non-target platform;
**64** = bad arguments; **130/143** = interrupted. A missing or unloaded native
addon is `blocked`, never skipped or treated as a successful no-op. Failures
take precedence over blockers. Every required capability is always reported.

`capabilityStatus` aggregates probe results; `status` also enforces the runtime
target. Platform comes from `process.platform`, not an environment variable.
**Desktop tests can never produce an Android pass. `androidGate` is always
false, even if all Android Node capabilities pass:** release APK install/upgrade,
modern target, installer-native execution, SELinux, 4 KiB/16 KiB devices, ELF
closure, real Harness/JSONL integration and lifecycle/recovery gates require
independent evidence. A passing `node:test` run means the test assertions passed,
not that unavailable Android/native capabilities have become available.

## Required behavior

| Capability | Exercised behavior |
| --- | --- |
| `runtime-executable` | Node 24, real executable path, execute access, actual arch/platform |
| `sqlite-wal-crash` | Real child writes WAL + committed/uncommitted transactions; independent reader; SIGKILL; reopen, integrity check, rollback and new committed write |
| `fork-ipc` | Parent/child/nested-child IPC with Unicode payload and actual `process.execPath`; normal and abnormal exits |
| `worker-threads` | Real MTS Worker, message roundtrip, SharedArrayBuffer/Atomics, normal exit |
| `zstd-integrity` | Sync+async roundtrip, enabled checksum, corrupted checksum and truncated frame rejection (not historical Harness fixtures) |
| `hardlink-no-clobber` | Two real processes race `link(temp, final)`; exactly one winner, one EEXIST, unchanged contents/inode/dev |
| `directory-fsync` | File sync plus directory sync before/after rename (not a physical power-loss test) |
| `native-flock` | Real nonblocking exclusive native syscall across processes; contention, fd-close release, SIGKILL release, stable lock inode, never unlink lock |
| `tls-local-ca` | Loopback TLS roundtrip using public test-only fixture CA; rejects untrusted CA (not system/public CA validation) |
| `dns-localhost` | OS `getaddrinfo`/lookup of localhost must return only loopback addresses |

## Native flock: explicit Android loader adapter

The maintained public Harness lease at
`development/session-persistence-jsonl/src/lease.ts` imports
`tryLockExclusive(fd)` from `@deepseek-ai/node-addon-system/flock`. It awaits the
Promise, treats EAGAIN/EWOULDBLOCK as contention, verifies inode/dev and releases
by close without unlink. This suite tests those essential kernel semantics;
it does not claim full Harness lease integration.

Default desktop mode uses that exact package entry. Pinned upstream **0.1.2**
loads its binding lazily and supports only Linux/Darwin in the JS loader. An
Android run therefore needs the explicit probe-only loader adaptation:

```text
NEXTTAVERN_FLOCK_ADDON=<ApplicationInfo.nativeLibraryDir>/libnexttavern_flock.so
```

The supervisor supplies the absolute, APK-installed path. `flock.mts` uses
`process.dlopen` to load the real Node-API `tryLock(fd, callback)` binding built
from pinned package `src/flock.c`, then preserves its callback errno → Promise /
`getSystemErrorName(-errno)` mapping. The C implementation still performs
`flock(fd, LOCK_EX | LOCK_NB)`; no lock is faked, bypassed or replaced by an
exists/rename scheme. Evidence names `explicit-installed-native-dlopen` versus
`upstream-package`. An explicit bad path blocks, with no fallback. Native build,
hash, license and APK provenance are owned by the runtime packaging workflow,
not established by this adapter or desktop execution. This is **not** a patch
to the actual Harness loader; the integration gate remains open.

For optional desktop native verification only, install pinned test dependencies
without root package changes (network occurs in this command, not the suite):

```sh
npm install --prefix . --cache artifacts/npm-cache --ignore-scripts \
  --no-save --no-package-lock --no-audit --no-fund @deepseek-ai/node-addon-system@0.1.2
```

Tests separately create isolated missing-addon and generated no-op-addon
fixtures, proving they report BLOCKED and FAILED respectively. The TLS fixture
private key is intentionally public **test data only**, never an app credential.
APK assets need root `*.mts` and `fixtures/**`; exclude tests, artifacts and
node_modules. No generated JS is maintained or needed by the production probes.

### Public localhost TLS fixture

`fixtures/localhost-key.txt` and its self-signed certificate were generated only
for this probe's in-process localhost TLS test. The private key is deliberately
public test data: it grants no access to an account or external service. It must
never be reused as a service credential or added to a system trust store. Only
this exact key path and SHA256
`d89d9f07f2d66b4fcd8cb71f2e9d6557df42f2ed04ca453f85ced12c50dd114b`
are admitted as test material by the release text guard; all other private keys
remain rejected. The playable app's `host.zip` does not include probe fixtures.

### Explicit software-emulator timing diagnostics

Device/default runs keep the original 12,000ms per-capability deadline and
20,000ms child guard. `--timeout-ms N` is an explicit **test-only software timing**
option (positive integer, maximum 120000), combinable with `--output path`. It
sets the per-capability deadline and forwards that same validated budget to
forked helpers through `NEXTTAVERN_G0_CHILD_TIMEOUT_MS`; the guard is not removed.
A default CLI invocation clears that private override rather than inheriting it.
The option does not skip assertions, change the arm64 target gate, lower TLS
requirements, or certify device performance.

Only the separately named native `.x86diagnostic` test build passes 120000 and
uses a 1800-second supervisor budget. Its UI/copied evidence labels TCG timing
as test-only. Original frozen APKs/hashes and their failed results remain
unchanged; a new diagnostic candidate needs its own execution evidence.
