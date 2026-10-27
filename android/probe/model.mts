/** Node capability evidence, never full Android G0 certification. */
export const PROTOCOL = 'nexttavern-g0' as const;
export const REQUIRED_CAPABILITIES = [
  'runtime-executable', 'sqlite-wal-crash', 'fork-ipc', 'worker-threads',
  'zstd-integrity', 'hardlink-no-clobber', 'directory-fsync', 'native-flock',
  'tls-local-ca', 'dns-localhost',
] as const;
export type CapabilityId = typeof REQUIRED_CAPABILITIES[number];
export type Status = 'passed' | 'failed' | 'blocked';
export type Evidence = Record<string, unknown>;
export interface CheckResult {
  id: CapabilityId; status: Status; durationMs: number; evidence: Evidence;
  error?: {name: string; code?: string; message: string};
}
export interface RuntimeIdentity {
  platform: string; arch: string; node: string; execPath: string;
  executableRealPath: string; cwd: string; osRelease: string;
  versions: Record<string, string>;
}
export interface Summary {
  schemaVersion: 1; protocol: typeof PROTOCOL; scope: 'node-capabilities-only';
  startedAt: string; finishedAt: string; actualPlatform: string; platform: string;
  runtime: RuntimeIdentity; capabilityStatus: Status; status: Status; ok: boolean;
  androidGate: false; targetBlockers: string[]; unverified: string[]; checks: CheckResult[];
}
export interface ProbeContext {directory: string; signal: AbortSignal}
export type Probe = (context: ProbeContext) => Promise<Evidence>;
export type ProbeMap = Partial<Record<CapabilityId, Probe>>;
export type Event =
  | {protocol: typeof PROTOCOL; event: 'ready'; platform: string; actualPlatform: string; pid: number; scope: 'node-capabilities-only'}
  | {protocol: typeof PROTOCOL; event: 'check'; check: CheckResult}
  | {protocol: typeof PROTOCOL; event: 'result'; status: Status; ok: boolean; platform: string; actualPlatform: string; androidGate: false; summary: Summary};

export class BlockedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message); this.name = 'BlockedError'; this.code = code;
  }
}
export function errorRecord(error: unknown): {name: string; code?: string; message: string} {
  const value = error instanceof Error ? error : new Error(String(error));
  const code = (value as Error & {code?: unknown}).code;
  return {name: value.name, ...(typeof code === 'string' ? {code} : {}), message: value.message};
}
export function aggregateStatus(checks: Pick<CheckResult, 'status'>[]): Status {
  if (checks.some(check => check.status === 'failed')) return 'failed';
  return checks.some(check => check.status === 'blocked') ? 'blocked' : 'passed';
}
export function targetBlockers(identity: RuntimeIdentity): string[] {
  const blockers: string[] = [];
  if (identity.platform !== 'android') blockers.push(`Actual platform is ${identity.platform}; desktop evidence is not Android evidence`);
  if (identity.arch !== 'arm64') blockers.push(`Initial Android target is arm64, not ${identity.arch}`);
  if (Number(identity.node.split('.')[0]) !== 24) blockers.push(`Node 24 is required, not ${identity.node}`);
  return blockers;
}
export function exitCode(summary: Summary): number {
  return summary.status === 'failed' ? 1 : summary.status === 'blocked' ? 2 : 0;
}
