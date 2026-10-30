import {mkdir, mkdtemp, realpath, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {release} from 'node:os';
import {performance} from 'node:perf_hooks';
import {aggregateStatus, BlockedError, errorRecord, OPTIONAL_HTTPS_CAPABILITY, OPTIONAL_ATOMIC_CAPABILITY, PROTOCOL, REQUIRED_CAPABILITIES, targetBlockers} from './model.mts';
import type {CapabilityId, CheckResult, Event, ProbeMap, RuntimeIdentity, Summary} from './model.mts';

export async function runtimeIdentity(): Promise<RuntimeIdentity> {
  return {
    platform: process.platform, arch: process.arch, node: process.versions.node,
    execPath: process.execPath, executableRealPath: await realpath(process.execPath),
    cwd: process.cwd(), osRelease: release(),
    versions: Object.fromEntries(Object.entries(process.versions).filter((entry): entry is [string, string] => typeof entry[1] === 'string')),
  };
}

/** Every required capability produces a record, including unavailable APIs. */
export async function runSuite(options: {
  probes: ProbeMap; workRoot: string; onEvent?: (event: Event) => void; timeoutMs?: number; signal?: AbortSignal; httpsClient?: boolean; atomicPublish?: boolean;
}): Promise<Summary> {
  const startedAt = new Date().toISOString();
  const runtime = await runtimeIdentity();
  const emit = options.onEvent ?? (() => {});
  emit({protocol: PROTOCOL, event: 'ready', platform: runtime.platform, actualPlatform: runtime.platform,
    pid: process.pid, scope: 'node-capabilities-only'});
  await mkdir(options.workRoot, {recursive: true, mode: 0o700});
  const directory = await mkdtemp(join(options.workRoot, 'run-'));
  const checks: CheckResult[] = [];
  try {
    const selected:readonly CapabilityId[]=[...REQUIRED_CAPABILITIES,
      ...(options.httpsClient?[OPTIONAL_HTTPS_CAPABILITY]:[]),...(options.atomicPublish?[OPTIONAL_ATOMIC_CAPABILITY]:[])];
    for (const id of selected) {
      const started = performance.now();
      const controller = new AbortController();
      const cancel = () => controller.abort(options.signal?.reason ?? new Error('Probe suite cancelled'));
      options.signal?.addEventListener('abort', cancel, {once: true});
      let timer: ReturnType<typeof setTimeout> | undefined;
      let check: CheckResult;
      try {
        if (options.signal?.aborted) throw options.signal.reason;
        const probe = options.probes[id];
        if (!probe) throw new BlockedError('MISSING_PROBE', `Required capability ${id} has no implementation`);
        const evidence = await Promise.race([
          probe({directory, signal: controller.signal}),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {once: true});
            timer = setTimeout(() => {
              const error = Object.assign(new Error(`Capability ${id} exceeded its deadline`), {code: 'PROBE_TIMEOUT'});
              controller.abort(error); reject(error);
            }, options.timeoutMs ?? 12_000);
          }),
        ]);
        check = {id, status: 'passed', durationMs: Math.round(performance.now() - started), evidence};
      } catch (error) {
        check = {id, status: error instanceof BlockedError ? 'blocked' : 'failed',
          durationMs: Math.round(performance.now() - started), evidence: {}, error: errorRecord(error)};
      } finally {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener('abort', cancel);
        controller.abort();
      }
      checks.push(check);
      emit({protocol: PROTOCOL, event: 'check', check});
    }
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
  const capabilityStatus = aggregateStatus(checks);
  const blockers = targetBlockers(runtime);
  const status = capabilityStatus === 'failed' ? 'failed' : capabilityStatus === 'blocked' || blockers.length ? 'blocked' : 'passed';
  const summary: Summary = {
    schemaVersion: 1, protocol: PROTOCOL, scope: 'node-capabilities-only', startedAt,
    finishedAt: new Date().toISOString(), actualPlatform: runtime.platform, platform: runtime.platform,
    runtime, capabilityStatus, status, ok: status === 'passed', androidGate: false, targetBlockers: blockers,
    unverified: [
      'Full G0 is not certified by this Node-only suite',
      'Release APK install/upgrade, nativeLibraryDir origin, modern target and SELinux execution',
      '4 KiB and 16 KiB Android device/page-size matrix and every bundled ELF',
      options.httpsClient ? 'Optional fixed-endpoint HTTPS evidence does not qualify general DNS, Android system CA integration or provider/model functionality'
        : 'System/public TLS CA trust, external DNS/connectivity and provider/model requests',
      'Harness/NextTavern integration, real JSONL lease lifecycle and Android lifecycle/data migration',
    ], checks,
  };
  emit({protocol: PROTOCOL, event: 'result', status, ok: summary.ok, platform: runtime.platform,
    actualPlatform: runtime.platform, androidGate: false, summary});
  return summary;
}
