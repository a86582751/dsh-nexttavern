/** Prepare durable owned-package references after the host released its profile writer lock. */
import type {PluginChange} from '@deepseek-ai/dsh-plugin-manager'
import type {Context} from '@deepseek-ai/cordis'
import fs from 'node:fs'
import {dirname, join} from 'node:path'
import {bootstrapBundledPackages, isWriterLockBusy, readBundleIdentity,
  type PeerManifestResolver} from './bundled-package-bootstrap.mjs'

/** Receipt the preparing transaction writes into the profile it edits. */
const RECEIPT = '.nexttavern-protected-packages.json'
/**
 * The official manager holds this lock across its own operation, including the
 * reload it awaits before publishing `plugin-manager/changed`. This bound
 * covers the remainder of that transaction; a longer hold is reported as a
 * busy profile and resolved by the host's next notice or activation.
 */
const LOCK_WAIT_MS = 120_000

/**
 * Host-side state of the durable references for this product's own bundled
 * packages, from this instance's observations only. The manager-owned
 * `package.json` dependency edit and its package-manager relink are distinct
 * steps; `relinkPending` keeps that distinction instead of reporting success.
 */
export interface PackagePreparationState {
  state: 'inspect-only' | 'prepared' | 'failed'
  relinkPending: boolean
  detail?: string
}

export type PreparationOutcome =
  /** The installed references already describe this bundle; nothing was written. */
  | {state: 'current'}
  /** The host still held its own profile writer lock; the scheduler retries once. */
  | {state: 'lock-busy'}
  | {state: 'prepared'; version: string}
  | {state: 'failed'}

export interface PreparationLogger {
  info(message: string): void
  warn(message: string, error?: unknown): void
}

export interface PackagePreparationOptions {
  /** Read the version the profile currently pins, or null when nothing is prepared. */
  inspect(): {installedVersion: string | null}
  /** Acquire the host writer lock, verify the bundle, and write the durable references. */
  prepare(): Promise<PreparationOutcome>
  logger?: PreparationLogger
  /** Named timer hooks keep the re-attempt observable in tests without fake clocks. */
  setTimer?: (callback: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  /** First delay before re-attempting a lock the host still holds. */
  retryDelayMs?: number
  /** Longest delay between such attempts, so a long host transaction is not polled. */
  maxRetryDelayMs?: number
  /** Attempts one schedule may spend on a lock the host still holds. */
  retryLimit?: number
}

const RETRY_DELAY_MS = 100
const MAX_RETRY_DELAY_MS = 1_600
const RETRY_LIMIT = 6
/** Further attempts the host's own later notices may start after the timer budget. */
const NOTICE_RESUME_LIMIT = 8

/**
 * The product's handle on that deferred work.
 *
 * Every entry point returns synchronously: the work must never be awaited from
 * the loading lifecycle, which either runs inside the manager's own transaction
 * or would make product startup depend on another component's.
 */
export interface PackagePreparationScheduler {
  /** Safe to call from a notice, an activation, or both; each call starts a round while the profile is merely busy. */
  schedule(): void
  /** Resolves once no attempt is running and no retry is scheduled. */
  settle(): Promise<void>
  /** Cancel a scheduled attempt that has not started. */
  close(): void
  state(): PackagePreparationState
}

export function createPackagePreparation(options: PackagePreparationOptions): PackagePreparationScheduler {
  const logger = options.logger
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms))
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as NodeJS.Timeout))
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS
  const maxRetryDelayMs = options.maxRetryDelayMs ?? MAX_RETRY_DELAY_MS
  const retryLimit = options.retryLimit ?? RETRY_LIMIT
  // One in-flight attempt, one retry timer, and a bounded number of attempts:
  // a repeated change notice cannot stack writer-lock waits behind one shutdown.
  let running: Promise<void> | undefined
  let retry: unknown
  let attempts = 0
  let attempted = false
  let closed = false
  let current: PackagePreparationState = {state: 'inspect-only', relinkPending: true}

  async function attempt(): Promise<void> {
    attempts += 1
    let inspectedVersion: string | null
    try {
      inspectedVersion = options.inspect().installedVersion
    } catch (error) {
      current = {state: 'failed', relinkPending: true, detail: text(error)}
      logger?.warn('NextTavern cannot read its prepared package references', error)
      return
    }
    let outcome: PreparationOutcome
    try {
      outcome = await options.prepare()
    } catch (error) {
      current = {state: 'failed', relinkPending: true, detail: text(error)}
      logger?.warn('NextTavern could not prepare durable bundled package references', error)
      return
    }
    if (outcome.state === 'lock-busy') {
      // The host holds its own writer lock. That is a busy profile, not a failed
      // install, so a bounded backoff follows it. A notice or activation the
      // host raises after that starts the next round, so this never polls.
      if (attempts <= retryLimit && !closed) {
        const delay = Math.min(retryDelayMs * 2 ** (attempts - 1), maxRetryDelayMs)
        retry = setTimer(() => {retry = undefined; run()}, delay)
      }
      return
    }
    if (outcome.state === 'failed') {
      current = {state: 'failed', relinkPending: true}
      return
    }
    current = {state: 'prepared', relinkPending: false}
    if (outcome.state === 'current') return
    logger?.info(inspectedVersion === null
      ? `NextTavern prepared durable references to its bundled packages at ${outcome.version}`
      : `NextTavern refreshed durable bundled package references from ${inspectedVersion} to ${outcome.version}`)
  }

  function run(): void {
    running = attempt().finally(() => {running = undefined})
  }

  /**
   * A busy profile keeps its question open, a verified or rejected bundle does
   * not. Timers stop at `retryLimit` so a long host transaction is not polled;
   * the host's own later notice or activation may still finish the job, up to a
   * hard ceiling that no sequence of notices can push past.
   */
  const canRetry = () => current.state === 'inspect-only' && attempts <= retryLimit
  const canResume = () => current.state === 'inspect-only' && attempts < retryLimit + NOTICE_RESUME_LIMIT

  return {
    schedule(): void {
      if (closed || running || retry !== undefined) return
      if (!attempted) {
        attempted = true
        run()
        return
      }
      if (canRetry() || canResume()) run()
    },
    settle(): Promise<void> {
      // One read is enough: the caller observes the attempt it just scheduled,
      // and an attempt that is still pending is exactly what it must wait for.
      return running ?? Promise.resolve()
    },
    close(): void {
      closed = true
      if (retry !== undefined) {
        clearTimer(retry)
        retry = undefined
      }
    },
    state: () => current,
  }
}

/**
 * Bind the preparation to this product's running context. The change notice
 * reports a completed manager operation on this profile; only an instance that
 * owns the profile prepares references through it, never a host that merely
 * loaded this package.
 */
export function bindPackagePreparation(ctx: Context, preparation: PackagePreparationScheduler): void {
  ctx.on('plugin-manager/changed', (_change: PluginChange) => {
    // Returns without awaiting: this notice is published while the manager
    // still holds the writer lock this work has to acquire.
    preparation.schedule()
  })
}

export interface OwnedPackageFacts {
  productRoot: string
  /** The host's installed package manifest; anchor for every shared peer. */
  hostAnchor: string
  home: string
  profile: string
  /** Resolve a peer through the host's running package owner when it provides one. */
  resolvePeerManifest?: PeerManifestResolver
  logger?: PreparationLogger
  /** Bound on waiting for the host's profile writer lock; tests state their own. */
  lockWaitMs?: number
}

/**
 * The profile receipt currently recording durable references for one profile,
 * or null when nothing was prepared yet. The receipt's own paths and hashes are
 * revalidated inside the preparing transaction; this read only decides whether
 * that transaction is needed at all.
 */
function preparedVersions(facts: Pick<OwnedPackageFacts, 'home' | 'profile'>): Map<string, string> | null {
  try {
    const receipt = JSON.parse(fs.readFileSync(
      join(facts.home, 'profiles', facts.profile, RECEIPT), 'utf8')) as {
        schemaVersion?: unknown; profile?: unknown; packages?: {name?: unknown; version?: unknown}[]}
    if (receipt?.schemaVersion !== 1 || receipt.profile !== facts.profile || !Array.isArray(receipt.packages)) return null
    const recorded = new Map<string, string>()
    for (const item of receipt.packages) {
      if (typeof item?.name !== 'string' || typeof item.version !== 'string') return null
      recorded.set(item.name, item.version)
    }
    return recorded
  } catch {
    return null
  }
}

/** Whether the receipt already records exactly this bundle's owned packages at these versions. */
function referencesCurrent(recorded: Map<string, string> | null, version: string, names: readonly string[]): boolean {
  if (!recorded || recorded.size !== names.length) return false
  return names.every(name => recorded.get(name) === version)
}

/**
 * The product's own durable-reference work against one installed profile.
 *
 * The read-only step decides from the bundle's identity alone whether the
 * durable references already describe it; admission of the bytes, the peers and
 * the entry points happens once inside the locked transaction that may write.
 * A profile or tree edited after that decision is still rejected by the
 * transaction, because nothing is written against unverified bytes.
 */
export function createOwnedPackagePreparation(facts: OwnedPackageFacts): PackagePreparationScheduler {
  return createPackagePreparation({
    logger: facts.logger,
    inspect: () => {
      const versions = new Set(preparedVersions(facts)?.values() ?? [])
      return {installedVersion: versions.size === 1 ? [...versions][0]! : null}
    },
    prepare: async (): Promise<PreparationOutcome> => {
      const identity = readBundleIdentity(facts.productRoot)
      const names = identity.packages.map(spec => spec.name)
      if (referencesCurrent(preparedVersions(facts), identity.version, names)) return {state: 'current'}
      let version: string
      try {
        const prepared = await bootstrapBundledPackages({
          productRoot: facts.productRoot, hostAnchor: facts.hostAnchor,
          home: facts.home, profile: facts.profile,
          // A preparation transaction keeps its rollback copy beside the home it
          // edits: the profile tree itself must never receive these journals.
          backup: join(dirname(facts.home), 'nexttavern-prepare-backup', `${Date.now()}-${process.pid}`),
          resolvePeerManifest: facts.resolvePeerManifest,
          lockWaitMs: facts.lockWaitMs ?? LOCK_WAIT_MS,
        })
        version = prepared.version
      } catch (error) {
        // A lock the host held for longer than that bound is a busy profile,
        // not a rejected bundle: the next notice or activation retries it.
        if (isWriterLockBusy(error)) return {state: 'lock-busy'}
        throw error
      }
      return {state: 'prepared', version}
    },
  })
}

function text(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
