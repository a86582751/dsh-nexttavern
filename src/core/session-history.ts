import {createHash, type Hash} from 'node:crypto'
import {untilAborted} from './tavern-task-primitives.js'
import {stableJson} from './roleplay-data.js'

interface HistoryEvent {seq: number; type: string}
/** Current accepted Native DATA; consumers retain their own preset/origin policy. */
export interface SessionClassificationData {
  readonly hasPresetSelection:boolean
  readonly lastSelectedPreset:unknown
  readonly lastTruthySelectedPreset:unknown
  readonly localSubagentDescriptor:boolean
}
interface NativeSession {id: string; seq: number; inheritedEventCount: number}
interface Observation extends Disposable {
  source: 'live' | 'prepared'
  header: {id: string}
  cursor: number
  inheritedEventCount: number
  events: readonly HistoryEvent[]
}
export interface SessionHistoryDependencies {
  get(id: string): object | null | undefined
  observe(id: string, options: {projectionMode: 'none'; signal: AbortSignal}): Promise<Observation>
  /** The Native input owner supplies its exact encoder; no cross-package import. */
  nativeInputCanonical?(value: unknown): string
}
/** The actual Core owner passes these live readers across bundle boundaries.
 * Detached DATA and historical array copies retain their ordinary parser. */
export interface SessionHistoryReader {
  events<E>(session: object): readonly E[]
  prefixes(events: readonly unknown[], cuts: readonly number[]): ReadonlyMap<number, string> | undefined
  cut?<E>(session: object, length?:number): SessionHistoryCut<E>
}
/** An immutable DATA boundary, never a current writer/publication credential.
 * Native seq is a zero-based index; ranges use an exclusive end. */
export interface SessionHistoryCut<E> {
  readonly owner: object
  readonly source: 'native' | 'loaded'
  readonly length: number
  at(seq: number): E | undefined
  prefixSha256(cut: number): string | undefined
  /** Independent Native-input encoding; unavailable for loaded/unconfigured cuts. */
  nativeInputPrefixSha256(cut?: number): string | undefined
  forEachRange(start: number, end: number, visit: (event: E, seq: number) => void): void
  range(start?: number, end?: number): IterableIterator<E>
  /** Explicit O(length) compatibility escape hatch; cached for this cut. */
  materialize(): readonly E[]
}
interface HistoryOwner {
  get: SessionHistoryDependencies['get']
  ready(session: object, signal?: AbortSignal): Promise<void>
}
interface Ledger {
  holders: Set<HistoryOwner>
  cancellation: AbortController
  session: NativeSession
  events: HistoryEvent[]
  digest: Hash
  prefixes: string[]
  nativeInput?: {canonical: NonNullable<SessionHistoryDependencies['nativeInputCanonical']>; digest: Hash; prefixes: string[]}
  pending: Map<number, HistoryEvent>
  identity: object
  cut: SessionHistoryCut<HistoryEvent> | null
  loading: Promise<void> | null
  ready: boolean
  error: Error | null
  classification:SessionClassificationData
}

// Weak instance keys prevent an ID reused after detach from inheriting old data.
// Owners are removed by plugin disposal; no fields are attached to native Session.
const ledgers = new WeakMap<object, Ledger>()
const owners = new Set<HistoryOwner>()
// These are immutable cuts produced by this owner, not arbitrary frozen
// arrays. All cuts share one append-only digest index; an old snapshot keeps
// its original bound even when the live ledger advances.
const nativePrefixes = new WeakMap<readonly unknown[], {length: number; prefixes: readonly string[]}>()

function failure(message: string): Error {
  return Object.assign(new Error(`会话历史未就绪：${message}`), {code: 'SESSION_HISTORY_NOT_READY'})
}
function nativeSession(value: object): NativeSession {
  const candidate = value as Partial<NativeSession>
  if (typeof candidate.id !== 'string' || !Number.isSafeInteger(candidate.seq) || Number(candidate.seq) < 0 ||
      !Number.isSafeInteger(candidate.inheritedEventCount) || Number(candidate.inheritedEventCount) < 0) {
    throw failure('缺少原生会话游标或继承边界')
  }
  return candidate as NativeSession
}
function loadedEvents<E>(value: object | null | undefined): readonly E[] | null {
  if (!value) return []
  const source = value as {events?: readonly E[]; log?: readonly E[]; isOwnSeq?: unknown}
  const events = source.events
  if (Array.isArray(events)) return events
  // Plain loaded views may call their array log. Never read native TS-private log.
  if (typeof source.isOwnSeq !== 'function') {
    const log = source.log
    if (Array.isArray(log)) return log
  }
  return null
}

/** Immutable loaded cut for synchronous algorithms; live callers must await readiness first. */
export function sessionEvents<E>(session: {events?: readonly E[]; log?: readonly E[]} | null | undefined): readonly E[] {
  const loaded = loadedEvents<E>(session)
  if (loaded) return loaded
  return sessionHistoryCut<E>(session!).materialize()
}

/** Loaded arrays keep their ordinary parser. Native reads retain the same
 * owner/readiness contract as point access, without materializing history. */
export function nativeSessionClassification(session:object|null|undefined):SessionClassificationData|undefined {
  if(loadedEvents(session))return
  sessionHistoryCut(session)
  return ledgers.get(session!)!.classification
}

/** Native acquisition and point/prefix access are O(1) in history length.
 * Plain loaded arrays take an explicit copying/canonical-hashing slow path. */
export function sessionHistoryCut<E>(session: object | null | undefined, length?:number): SessionHistoryCut<E> {
  const loaded = loadedEvents<E>(session)
  if (loaded) {
    if(length!==undefined&&(!Number.isSafeInteger(length)||length<0||length>loaded.length))
      throw RangeError('Session history range is outside this cut')
    return boundedCut(Object.freeze({}), 'loaded', Object.freeze(loaded.slice(0,length)))
  }
  const ledger = ledgers.get(session!)
  let live = false
  if (ledger) for (const holder of ledger.holders) {
    if (holder.get(ledger.session.id) === session) {live = true; break}
  }
  if (!ledger || !ledger.ready || ledger.error || !live ||
      ledger.events.length !== ledger.session.seq) {
    throw ledger?.error ?? failure('请先等待公开历史观察完成')
  }
  if(length!==undefined&&length!==ledger.events.length) {
    if(!Number.isSafeInteger(length)||length<0||length>ledger.events.length)
      throw RangeError('Session history range is outside this cut')
    return boundedCut(ledger.identity,'native',ledger.events,ledger.prefixes,ledger.nativeInput?.prefixes,length) as SessionHistoryCut<E>
  }
  return (ledger.cut ??= boundedCut(ledger.identity, 'native', ledger.events, ledger.prefixes,
    ledger.nativeInput?.prefixes)) as SessionHistoryCut<E>
}

function boundedCut<E>(owner: object, source: 'native' | 'loaded', events: readonly E[],
  prefixes?: readonly string[], nativeInputPrefixes?: readonly string[],length=events.length): SessionHistoryCut<E> {
  let materialized: readonly E[] | undefined
  function bounds(start: number, end: number) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > length) {
      throw new RangeError('Session history range is outside this cut')
    }
  }
  return Object.freeze({owner, source, length,
    at(seq: number) {return Number.isSafeInteger(seq) && seq >= 0 && seq < length ? events[seq] : undefined},
    prefixSha256(cut: number) {
      if (!Number.isSafeInteger(cut) || cut < 0 || cut > length) return
      return prefixes ? prefixes[cut] : createHash('sha256').update(stableJson(events.slice(0, cut))!, 'utf8').digest('hex')
    },
    nativeInputPrefixSha256(cut = length) {
      if (!Number.isSafeInteger(cut) || cut < 0 || cut > length) return
      return nativeInputPrefixes?.[cut]
    },
    forEachRange(start: number, end: number, visit: (event: E, seq: number) => void) {
      bounds(start, end)
      for (let seq = start; seq < end; seq++) visit(events[seq]!, seq)
    },
    *range(start = 0, end = length) {
      bounds(start, end)
      for (let seq = start; seq < end; seq++) yield events[seq]!
    },
    materialize() {
      if (!materialized) {
        materialized = Object.freeze(events.slice(0, length))
        if (prefixes) nativePrefixes.set(materialized, {length, prefixes})
      }
      return materialized
    },
  })
}

/** Exact recordSha256(array-prefix) DATA from the accepted Native feed.
 * A caller with raw or detached history keeps its full canonical parser.
 * The returned hashes carry no current Source or publication authority. */
export function sessionNativePrefixSha256(events: readonly unknown[], cuts: readonly number[]): ReadonlyMap<number, string> | undefined {
  const owned = nativePrefixes.get(events)
  if (!owned) return
  const result = new Map<number, string>()
  for (const cut of cuts) {
    const digest = cut <= owned.length ? owned.prefixes[cut] : undefined
    if (digest === undefined) return
    result.set(cut, digest)
  }
  return result
}

/** Readiness is also required for HTTP activation and children outside the roleplay preset. */
export async function ensureSessionHistory(session: object | null | undefined, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  if (loadedEvents(session)) return
  const native = nativeSession(session!)
  const prior = ledgers.get(native)
  const owner = [...(prior?.holders ?? owners)].find(candidate => candidate.get(native.id) === native)
  if (!owner) throw failure('当前实例没有活动的历史所有者')
  await owner.ready(native, signal)
}

/**
 * One observation establishes the baseline, then the synchronous session feed
 * supplies the tail. Register accept before starting any asynchronous read.
 */
export function createSessionHistory(deps: SessionHistoryDependencies) {
  const owned = new Set<object>()
  const lifetime = new AbortController()
  let disposed = false
  const owner: HistoryOwner = {get: deps.get, ready}
  owners.add(owner)

  function assertLive(session: NativeSession) {
    if (disposed || deps.get(session.id) !== session) throw failure('会话已退出或已被另一实例替换')
  }
  function append(ledger: Ledger, event: HistoryEvent) {
    if (event.seq < ledger.events.length && ledger.events[event.seq] === event) return
    if (event.seq !== ledger.events.length) throw failure('增量事件存在缺口或冲突')
    // Native publishes deeply frozen events after its JSON acceptance. Keep
    // the persisted array encoding exact, including key ordering and Unicode;
    // this stream is never a hash of per-event hashes.
    const encoded = stableJson(event)!
    if (ledger.events.length) ledger.digest.update(',')
    ledger.digest.update(encoded, 'utf8')
    ledger.prefixes.push(ledger.digest.copy().update(']', 'utf8').digest('hex'))
    if (ledger.nativeInput) {
      const input = ledger.nativeInput
      if (ledger.events.length) input.digest.update(',')
      input.digest.update(input.canonical(event), 'utf8')
      input.prefixes.push(input.digest.copy().update(']', 'utf8').digest('hex'))
    }
    ledger.events.push(event)
    if(event.type==='agent-preset/selected') {
      const preset=(event as HistoryEvent&{data?:{agentPreset?:unknown}}).data?.agentPreset
      ledger.classification={...ledger.classification,hasPresetSelection:true,lastSelectedPreset:preset,
        lastTruthySelectedPreset:preset||ledger.classification.lastTruthySelectedPreset}
    } else if(event.type==='subagent/descriptor'&&event.seq>=ledger.session.inheritedEventCount
      &&!ledger.classification.localSubagentDescriptor) {
      ledger.classification={...ledger.classification,localSubagentDescriptor:true}
    }
    ledger.cut = null
  }
  function accept(session: object, event: HistoryEvent): void {
    const ledger = ledgers.get(session)
    if (!ledger?.holders.has(owner)) return
    if (!ledger.ready) {
      const prior = ledger.pending.get(event.seq)
      if (prior && prior !== event) ledger.error = failure('初始化期间收到冲突事件')
      else ledger.pending.set(event.seq, event)
      return
    }
    try {append(ledger, event)}
    catch (error) {ledger.error = error instanceof Error ? error : failure(String(error))}
  }
  async function initialize(ledger: Ledger): Promise<void> {
    const session = ledger.session
    const assertObservedInstance = () => {
      if (![...ledger.holders].some(holder => holder.get(session.id) === session)) {
        throw failure('会话已退出或已被另一实例替换')
      }
    }
    assertObservedInstance()
    using observation = await deps.observe(session.id, {
      projectionMode: 'none', signal: ledger.cancellation.signal,
    })
    assertObservedInstance()
    if (ledgers.get(session) !== ledger || ledger.error) throw ledger.error ?? failure('初始化已失效')
    if (observation.source !== 'live' || observation.header.id !== session.id ||
        observation.inheritedEventCount !== session.inheritedEventCount) throw failure('观察来源与当前实例不一致')
    const events = observation.events
    if (events.length !== observation.cursor + 1) throw failure('观察水位与事件数不一致')
    ledger.events = []
    for (const event of events) append(ledger, event)
    for (const event of [...ledger.pending.values()].sort((a, b) => a.seq - b.seq)) append(ledger, event)
    if (ledger.events.length !== session.seq) throw failure('观察之后存在未收到的增量事件')
    ledger.pending.clear()
    ledger.ready = true
  }
  async function ready(session: object, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (loadedEvents(session)) return
    const native = nativeSession(session)
    assertLive(native)
    let ledger = ledgers.get(session)
    if (ledger) {
      ledger.holders.add(owner)
      owned.add(session)
      if (!ledger.nativeInput && deps.nativeInputCanonical) {
        // A later configured mount can join the retained baseline. Install
        // this independent stream once; existing bounded cuts stay unchanged.
        const digest = createHash('sha256').update('[', 'utf8')
        const prefixes = [digest.copy().update(']', 'utf8').digest('hex')]
        for (const [index, event] of ledger.events.entries()) {
          if (index) digest.update(',')
          digest.update(deps.nativeInputCanonical(event), 'utf8')
          prefixes.push(digest.copy().update(']', 'utf8').digest('hex'))
        }
        ledger.nativeInput = {canonical: deps.nativeInputCanonical, digest, prefixes}
        ledger.cut = null
      }
    }
    if (ledger?.ready && !ledger.error && ledger.events.length === native.seq) return
    if (!ledger?.loading) {
      const digest = createHash('sha256').update('[', 'utf8')
      const canonical = ledger?.nativeInput?.canonical ?? deps.nativeInputCanonical
      const nativeInputDigest = canonical ? createHash('sha256').update('[', 'utf8') : undefined
      ledger = {holders: ledger?.holders ?? new Set([owner]), cancellation: new AbortController(), session: native, events: [], pending: new Map(),
        digest, prefixes: [digest.copy().update(']', 'utf8').digest('hex')],
        ...(canonical && nativeInputDigest ? {nativeInput: {canonical, digest: nativeInputDigest,
          prefixes: [nativeInputDigest.copy().update(']', 'utf8').digest('hex')]}} : {}),
        identity: Object.freeze({}), cut: null, loading: null, ready: false, error: null,
        classification:{hasPresetSelection:false,lastSelectedPreset:undefined,
          lastTruthySelectedPreset:undefined,localSubagentDescriptor:false}}
      ledgers.set(session, ledger)
      owned.add(session)
      const current = ledger
      current.loading = initialize(current).catch(error => {
        current.error = error instanceof Error ? error : failure(String(error))
        throw error
      }).finally(() => {current.loading = null})
    }
    const loading = ledger.loading!
    const signals = [lifetime.signal, ledger.cancellation.signal, ...(signal ? [signal] : [])]
    await untilAborted(loading, AbortSignal.any(signals))
  }
  function disposeSession(session: object): void {
    const ledger = ledgers.get(session)
    owned.delete(session)
    if (!ledger?.holders.delete(owner) || ledger.holders.size) return
    // A standing mount releases only its share. Other live mounts keep the
    // baseline and feed, including an observation currently in flight.
    ledger.cancellation.abort(failure('会话历史已释放'))
    ledgers.delete(session)
  }
  function dispose(): void {
    if (disposed) return
    disposed = true
    lifetime.abort(failure('历史插件已停止'))
    owners.delete(owner)
    for (const session of owned) disposeSession(session)
  }
  return {ready, accept, disposeSession, dispose}
}
