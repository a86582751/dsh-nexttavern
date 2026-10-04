/** Numerical authority and Source-lock publication. This module never owns a
 * Native receipt/token, input queue, model request or the genesis writer. */
import {recordSha256} from './roleplay-data.js'
import {reduceMvuUpdateOperations} from './roleplay-mvu-update.js'
import type {MvuUpdatePreparation, PreparedMvuUpdate} from './roleplay-mvu-update.js'
import {reduceMvuUpdateOperationsV2} from './roleplay-mvu-update-v2.js'
import type {MvuUpdatePreparationV2,PreparedMvuUpdateV2} from './roleplay-mvu-update-v2.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuInitializationEvent, MvuInitializationHead} from './roleplay-mvu-initialization.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import type {MvuEditInvalidation} from './roleplay-mvu-edit-facts.js'
import {cloneMvuPlayerReplacement,mvuPlayerEventFor,mvuPlayerHeadFor,mvuPlayerSettlementFor,MvuPlayerDataRefusal}
  from './roleplay-mvu-player-records.js'
import type {MvuPlayerStateIntent,MvuPlayerStateUpdateEvent,MvuPlayerStateCurrentHead,
  MvuPlayerStatePublisherSettlement,MvuPlayerStateFacts,MvuPlayerStatePublication,MvuPlayerStateReplacement,
  MvuConsumedManualSettlementFactsInput} from './roleplay-mvu-player-records.js'
import {formatLocalMvuPromptFactsV1,formatLocalMvuPromptFactsV2,MvuPromptFactsRefusal}
  from './roleplay-mvu-prompt-numerical-facts.js'
import type {MvuPromptFactCaptureV1,MvuPromptLocalNumericalFactsV1,MvuPromptLocalNumericalFactsV2}
  from './roleplay-mvu-prompt-numerical-facts.js'
import {validateProgramMvuGenesisFactsV1,ProgramGenesisDataFailureV1} from './roleplay-program-genesis-data.js'
import type {VerifiedMvuProgramGenesis,ProgramMvuGenesisHeadV1} from './roleplay-program-genesis-types.js'
import {acceptedMvuDisplayUpdate,formatMvuDisplayUpdates} from './roleplay-mvu-display-facts.js'
import type {MvuAcceptedDisplayUpdate} from './roleplay-mvu-display-facts.js'
export type {VerifiedMvuProgramGenesis} from './roleplay-program-genesis-types.js'

export interface VerifiedMvuGenesis {
  sessionId: string
  sourceSha256: string
  initEvent: MvuInitializationEvent
  initHead: MvuInitializationHead
}
export interface MvuDerivedGenesisEvent {
  schemaVersion: 1
  encoding: 'native-mvu-derived-genesis-event-v1'
  sessionId: string
  sourceSha256: string
  revision: 1
  eventId: string
  eventSha256: string
  basisSha256: string
  values: MvuJsonObject
  valuesSha256: string
}
export interface MvuDerivedGenesisHead {
  schemaVersion: 1
  encoding: 'native-mvu-derived-genesis-head-v1'
  sessionId: string
  sourceSha256: string
  revision: 1
  eventId: string
  eventSha256: string
  basisSha256: string
  valuesSha256: string
}
/** The trusted producer owns lineage/Native/Source verification and genesis writes. */
export interface VerifiedMvuDerivedGenesis {
  sessionId: string
  sourceSha256: string
  derivedEvent: MvuDerivedGenesisEvent
  derivedHead: MvuDerivedGenesisHead
}
export interface MvuOpeningStateRoot {
  initEventId: string
  initEventSha256: string
  initHeadSha256: string
  planSha256: string
}
export interface MvuDerivedStateRoot {
  schemaVersion: 1
  encoding: 'native-mvu-derived-state-root-v1'
  derivedEventId: string
  derivedEventSha256: string
  derivedHeadSha256: string
  basisSha256: string
}
export interface MvuProgramStateRoot {
  schemaVersion:1
  encoding:'native-program-mvu-state-root-v1'
  programEventId:string
  programEventSha256:string
  programHeadSha256:string
  planSha256:string
}
export type MvuStateRoot = MvuOpeningStateRoot | MvuDerivedStateRoot | MvuProgramStateRoot
export type StateGenesis = VerifiedMvuGenesis | VerifiedMvuDerivedGenesis | VerifiedMvuProgramGenesis
export interface MvuStateCurrentHead {
  schemaVersion: 1
  encoding: 'native-mvu-state-current-head-v1'
  sessionId: string
  sourceSha256: string
  root: MvuStateRoot
  revision: number
  eventId: string
  eventSha256: string
  valuesSha256: string
  intentSha256: string
}
export type MvuNumericalHead = MvuInitializationHead | MvuDerivedGenesisHead | ProgramMvuGenesisHeadV1
  | MvuStateCurrentHead | MvuPlayerStateCurrentHead
export interface MvuStateBase {
  root: MvuStateRoot
  currentHead: MvuNumericalHead
  revision: number
  headSha256: string
  valuesSha256: string
  stateSnapshotSha256: string
}
export interface MvuNumericalSnapshot extends MvuStateBase {
  schemaVersion: 1
  encoding: 'native-mvu-state-snapshot-v1'
  sessionId: string
  sourceSha256: string
  values: MvuJsonObject
}
export type MvuStateUpdatePreparation = MvuUpdatePreparation | MvuUpdatePreparationV2
export type MvuStateCandidate = Exclude<MvuStateUpdatePreparation, {kind: 'rejected'}>
interface MvuStateTerminalIntentFields {
  sessionId: string
  sourceSha256: string
  preparationId: string
  credentialSha256: string
  refsSha256: string
  receiptGeneration: number
  attemptGeneration: number
  stopGeneration: number
  preparationSnapshot: {key: string; sha256: string}
  completedReceiptSha256: string
  canonical: {seq: number; messageId: string; versionSha256: string; narrativeSha256: string}
  base: MvuStateBase
  candidate: {kind: 'prepared' | 'no-update'; candidateSha256: string}
  intentSha256: string
}
// The outer intent selects the historical parser even for no-update facts,
// which had no inner version in v1. Never infer a new dialect from old text.
export type MvuStateTerminalIntent = MvuStateTerminalIntentFields & (
  | {schemaVersion:1;encoding:'native-mvu-state-terminal-intent-v1'}
  | {schemaVersion:2;encoding:'native-mvu-state-terminal-intent-v2'}
)
export interface MvuStateUpdateEvent {
  schemaVersion: 1
  encoding: 'native-mvu-state-update-event-v1'
  sessionId: string
  sourceSha256: string
  root: MvuStateRoot
  eventId: string
  revision: number
  intent: MvuStateTerminalIntent
  proposal: PreparedMvuUpdate | PreparedMvuUpdateV2
  valuesSha256: string
  eventSha256: string
}
export interface MvuStatePublisherSettlement {
  schemaVersion: 1
  encoding: 'native-mvu-state-publisher-settlement-v1'
  sessionId: string
  sourceSha256: string
  intent: MvuStateTerminalIntent
  candidate: MvuStateCandidate
  outcome: 'updated' | 'no-update'
  result: {
    head: MvuNumericalHead
    headSha256: string
    revision: number
    valuesSha256: string
    event?: {key: string; sha256: string}
  }
  completedReceiptSha256: string
  settlementSha256: string
}
export type MvuStateRecord = MvuStateCurrentHead | MvuStateUpdateEvent | MvuStatePublisherSettlement
  | MvuPlayerStateCurrentHead | MvuPlayerStateUpdateEvent | MvuPlayerStatePublisherSettlement
export interface MvuStateTable {
  get(key: string): unknown
  put(key: string, value: MvuStateRecord): Promise<unknown>
  /** Complete synchronous inventory, including every owned partial row. */
  entries(): Iterable<[string, unknown]>
}
export type MvuStatePermissionPhase = 'before-write' | 'before-head' | 'after-head' | 'after-settlement'
export interface MvuStateDeps {
  table: MvuStateTable
  /** Sole producer verifies actual opening/derived/program genesis and current
   * static Source. Pure program validation below does not recreate its owner. */
  readGenesis(sessionId: string): StateGenesis | undefined
  withSourceLock<T>(sessionId: string, action: () => Promise<T>): Promise<T>
  /** Historical closed Native/canonical/owner facts, independent of latest turn/head. */
  verifyStoredIntent(intent: MvuStateTerminalIntent): boolean
  /** Synchronous opaque hot token and stop-generation check; never enter owner queue here. */
  checkPermission(token: object, intent: MvuStateTerminalIntent, phase: MvuStatePermissionPhase): boolean
  /** Current numerical use only. Immutable genesis/prefix facts remain read-only
   * facts, independent of subsequent edits and never grant story permission. */
  readEditInvalidation?(sessionId: string): MvuEditInvalidation
  /** Actual immutable player request/operation and flushed Native marker facts. */
  verifyStoredManualIntent?(intent:MvuPlayerStateIntent):boolean
  /** The coordinator's private lease must affirm its existing Source lock. */
  checkManualPermission?(token:object,intent:MvuPlayerStateIntent,phase:MvuStatePermissionPhase):boolean
  /** Current readers may not bypass a pending operation. Only publishManual
   * supplies its exact hot-verified intent, never a caller-controlled exemption. */
  manualGate?(sessionId:string,allowedIntent?:MvuPlayerStateIntent):string|undefined
  /** Only the new prompt-facts view needs an actual current Session/admitted
   * Agent. Core captures those object identities and returns a read guard;
   * this issues no permission token and does not relax stored-intent checks. */
  capturePromptFactsOwner?(sessionId:string):(()=>boolean)|undefined
  /** UI only: the existing derived owner captures its actual frozen prefix,
   * including the original owners. Missing/stale data omits inherited hints. */
  captureInheritedDisplayUpdates?(sessionId:string,genesis:StateGenesis):{
    updates:readonly MvuAcceptedDisplayUpdate[]
  }|undefined
}
export type MvuNumericalAuthority = {kind: 'ready'; snapshot: MvuNumericalSnapshot}
  | {kind: 'blocked'; code: string}
export type MvuNumericalObservation = {kind:'ready';snapshot:MvuNumericalSnapshot;
  displayUpdates:readonly MvuAcceptedDisplayUpdate[]} | {kind:'blocked';code:string}
export type MvuStateFacts = {kind: 'committed'; settlement: MvuStatePublisherSettlement}
  | {kind: 'absent' | 'unknown'; code: string}
export type MvuStatePublication = {kind: 'acknowledged'; settlement: MvuStatePublisherSettlement}
  | {kind: 'blocked'; code: string}
  | {kind: 'unknown'; code: string; settlement?: MvuStatePublisherSettlement}
export interface MvuConsumedSettlementFactsInput {
  intent: MvuStateTerminalIntent
  base: MvuNumericalSnapshot
  proposal: MvuStateUpdatePreparation
  settlement: unknown
}

export const mvuStateCurrentHeadKey = (sid: string) => `${sid}__mvu-state-current-head`
export const mvuStateEventKey = (sid: string, sha256: string) => `${sid}__mvu-state-event-${sha256}`
export const mvuStateSettlementKey = (sid: string, sha256: string) => `${sid}__mvu-state-settlement-${sha256}`
export const MVU_STATE_BOUNDS = Object.freeze({records: 4096, recordBytes: 4 * 1048576,
  descriptorDepth: 64, descriptorNodes: 96000, arrayLength: 32000})
const MAX_RECORDS = MVU_STATE_BOUNDS.records
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && Number(value) >= min
const same = (a: unknown, b: unknown) => recordSha256(a) === recordSha256(b)
class StateRefusal extends Error {constructor(readonly code: string) {super(code)}}
function fail(code: string): never {throw new StateRefusal(code)}

/** Inspect descriptors before reading: no getters, aliases with cycles, exotic
 * prototypes or dangerous keys may enter either a hash or a table write. */
function cloneJson<T>(input: T): T {
  const ancestors = new Set<object>()
  let nodes = 0, bytes = 0
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > MVU_STATE_BOUNDS.descriptorNodes || depth > MVU_STATE_BOUNDS.descriptorDepth) fail('RECORD_LIMIT')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'string') {
      bytes += Buffer.byteLength(value, 'utf8')
      if (bytes > MVU_STATE_BOUNDS.recordBytes) fail('RECORD_LIMIT')
      return value
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) fail('RECORD_INVALID')
      return Object.is(value, -0) ? 0 : value
    }
    if (!value || typeof value !== 'object' || ancestors.has(value)) fail('RECORD_INVALID')
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value)
    if ((array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
      || Object.getOwnPropertySymbols(value).length) fail('RECORD_INVALID')
    const descriptors = Object.getOwnPropertyDescriptors(value)
    ancestors.add(value)
    const result: unknown[] | Record<string, unknown> = array ? [] : {}
    if (array) {
      const length = descriptors.length?.value as unknown
      if (!integer(length) || length > MVU_STATE_BOUNDS.arrayLength
        || Object.keys(descriptors).length !== length + 1) fail('RECORD_INVALID')
      for (let i = 0; i < length; i++) {
        const descriptor = descriptors[String(i)]
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail('RECORD_INVALID')
        ;(result as unknown[]).push(visit(descriptor.value, depth + 1))
      }
    } else for (const [key, descriptor] of Object.entries(descriptors)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key) || !Object.hasOwn(descriptor, 'value')
        || !descriptor.enumerable) fail('RECORD_INVALID')
      bytes += Buffer.byteLength(key, 'utf8')
      if (bytes > MVU_STATE_BOUNDS.recordBytes) fail('RECORD_LIMIT')
      ;(result as Record<string, unknown>)[key] = visit(descriptor.value, depth + 1)
    }
    ancestors.delete(value)
    return result
  }
  return visit(input, 0) as T
}
function keys(value: unknown, expected: string[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !same(Object.keys(value).sort(), [...expected].sort())) fail('RECORD_INVALID')
}
function rootValid(root: MvuStateRoot): void {
  if ('encoding' in root) {
    if(root.encoding==='native-program-mvu-state-root-v1') {
      keys(root,['schemaVersion','encoding','programEventId','programEventSha256','programHeadSha256','planSha256'])
      if(root.schemaVersion!==1
        ||![root.programEventId,root.programEventSha256,root.programHeadSha256,root.planSha256].every(hash))fail('ROOT_INVALID')
      return
    }
    keys(root, ['schemaVersion', 'encoding', 'derivedEventId', 'derivedEventSha256', 'derivedHeadSha256', 'basisSha256'])
    if (root.schemaVersion !== 1 || root.encoding !== 'native-mvu-derived-state-root-v1'
      || ![root.derivedEventId, root.derivedEventSha256, root.derivedHeadSha256, root.basisSha256].every(hash)) fail('ROOT_INVALID')
  } else {
    keys(root, ['initEventId', 'initEventSha256', 'initHeadSha256', 'planSha256'])
    if (!Object.values(root).every(hash)) fail('ROOT_INVALID')
  }
}
function headValid(head: MvuNumericalHead, sid: string, source: string, root: MvuStateRoot): void {
  if (head.encoding === 'mvu-programmatic-opening-head-v1') {
    if ('encoding' in root) fail('HEAD_INVALID')
    keys(head, ['schemaVersion', 'encoding', 'sessionId', 'eventId', 'revision', 'eventSha256', 'planSha256', 'valuesSha256'])
    if (head.schemaVersion !== 1 || head.revision !== 1 || head.sessionId !== sid
      || head.eventId !== root.initEventId || head.eventSha256 !== root.initEventSha256
      || head.planSha256 !== root.planSha256 || !hash(head.valuesSha256)
      || recordSha256(head) !== root.initHeadSha256) fail('HEAD_INVALID')
  } else if (head.encoding === 'native-mvu-derived-genesis-head-v1') {
    if (!('encoding' in root)||root.encoding!=='native-mvu-derived-state-root-v1') fail('HEAD_INVALID')
    keys(head, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'revision',
      'eventId', 'eventSha256', 'basisSha256', 'valuesSha256'])
    if (head.schemaVersion !== 1 || head.revision !== 1 || head.sessionId !== sid || head.sourceSha256 !== source
      || head.eventId !== root.derivedEventId || head.eventSha256 !== root.derivedEventSha256
      || head.basisSha256 !== root.basisSha256 || !hash(head.valuesSha256)
      || recordSha256(head) !== root.derivedHeadSha256) fail('HEAD_INVALID')
  } else if(head.encoding==='native-program-mvu-genesis-head-v1') {
    if(!('encoding' in root)||root.encoding!=='native-program-mvu-state-root-v1')fail('HEAD_INVALID')
    keys(head,['schemaVersion','encoding','sessionId','eventId','revision','eventSha256','planSha256','valuesSha256'])
    if(head.schemaVersion!==1||head.revision!==1||head.sessionId!==sid||!hash(source)
      ||head.eventId!==root.programEventId||head.eventSha256!==root.programEventSha256
      ||head.planSha256!==root.planSha256||!hash(head.valuesSha256)
      ||recordSha256(head)!==root.programHeadSha256)fail('HEAD_INVALID')
  } else {
    const player=head.encoding==='native-mvu-state-current-head-v2'
    keys(head, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'root', 'revision',
      'eventId', 'eventSha256', 'valuesSha256', 'intentSha256',...(player?['provenance']:[])])
    if (!(player?head.schemaVersion===2&&head.provenance==='player'
      :head.encoding==='native-mvu-state-current-head-v1'&&head.schemaVersion===1)
      || head.sessionId !== sid || head.sourceSha256 !== source || !same(head.root, root)
      || !integer(head.revision, 2) || head.revision > MAX_RECORDS + 1
      || head.eventId !== head.intentSha256 || ![head.eventId, head.eventSha256, head.valuesSha256].every(hash)) fail('HEAD_INVALID')
  }
}
function baseValid(base: MvuStateBase, sid: string, source: string): void {
  keys(base, ['root', 'currentHead', 'revision', 'headSha256', 'valuesSha256', 'stateSnapshotSha256'])
  rootValid(base.root)
  headValid(base.currentHead, sid, source, base.root)
  if (base.revision !== base.currentHead.revision || base.valuesSha256 !== base.currentHead.valuesSha256
    || base.headSha256 !== recordSha256(base.currentHead) || !hash(base.stateSnapshotSha256)) fail('BASE_INVALID')
}
function intentValid(intent: MvuStateTerminalIntent): void {
  keys(intent, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'preparationId', 'credentialSha256',
    'refsSha256', 'receiptGeneration', 'attemptGeneration', 'stopGeneration', 'preparationSnapshot',
    'completedReceiptSha256', 'canonical', 'base', 'candidate', 'intentSha256'])
  keys(intent.preparationSnapshot, ['key', 'sha256'])
  keys(intent.canonical, ['seq', 'messageId', 'versionSha256', 'narrativeSha256'])
  keys(intent.candidate, ['kind', 'candidateSha256'])
  const versioned=intent.schemaVersion===1?intent.encoding==='native-mvu-state-terminal-intent-v1'
    :intent.schemaVersion===2&&intent.encoding==='native-mvu-state-terminal-intent-v2'
  if (!versioned
    || !id(intent.sessionId) || !id(intent.preparationId) || !id(intent.canonical.messageId)
    || typeof intent.preparationSnapshot.key !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(intent.preparationSnapshot.key)
    || ![intent.sourceSha256, intent.credentialSha256, intent.refsSha256, intent.preparationSnapshot.sha256,
      intent.completedReceiptSha256, intent.canonical.versionSha256, intent.canonical.narrativeSha256,
      intent.candidate.candidateSha256, intent.intentSha256].every(hash)
    || !integer(intent.receiptGeneration, 1) || !integer(intent.attemptGeneration, 1)
    || !integer(intent.stopGeneration) || !integer(intent.canonical.seq)
    || !['prepared', 'no-update'].includes(intent.candidate.kind)) fail('INTENT_INVALID')
  baseValid(intent.base, intent.sessionId, intent.sourceSha256)
  const {intentSha256, ...descriptor} = intent
  if (recordSha256(descriptor) !== intentSha256) fail('INTENT_INVALID')
}
function manualIntentValid(intent:MvuPlayerStateIntent):void {
  keys(intent,['schemaVersion','encoding','sessionId','sourceSha256','operationId','requestSha256',
    'operation','marker','base','replacement','intentSha256'])
  keys(intent.operation,['key','sha256']);keys(intent.marker,['seq','sha256'])
  if(intent.schemaVersion!==1||intent.encoding!=='native-mvu-player-state-intent-v1'
    ||!id(intent.sessionId)||!id(intent.operationId)||typeof intent.operation.key!=='string'
    ||!/^[a-zA-Z0-9_-]{1,512}$/.test(intent.operation.key)||!integer(intent.marker.seq)
    ||![intent.sourceSha256,intent.requestSha256,intent.operation.sha256,intent.marker.sha256,intent.intentSha256].every(hash)) {
    fail('MANUAL_INTENT_INVALID')
  }
  baseValid(intent.base,intent.sessionId,intent.sourceSha256)
  const replacement=cloneMvuPlayerReplacement(intent.replacement)
  if(!same(replacement,intent.replacement))fail('MANUAL_REPLACEMENT_INVALID')
  const {intentSha256,...descriptor}=intent
  if(recordSha256(descriptor)!==intentSha256)fail('MANUAL_INTENT_INVALID')
}
function snapshot(head: MvuNumericalHead, values: MvuJsonObject, sid: string,
  sourceSha256: string, root: MvuStateRoot): MvuNumericalSnapshot {
  const descriptor = {schemaVersion: 1 as const, encoding: 'native-mvu-state-snapshot-v1' as const,
    sessionId: sid, sourceSha256, root, currentHead: head, revision: head.revision,
    headSha256: recordSha256(head), values, valuesSha256: recordSha256(values)}
  return {...descriptor, stateSnapshotSha256: recordSha256(descriptor)}
}
function baseOf(state: MvuNumericalSnapshot): MvuStateBase {
  return {root: state.root, currentHead: state.currentHead, revision: state.revision,
    headSha256: state.headSha256, valuesSha256: state.valuesSha256, stateSnapshotSha256: state.stateSnapshotSha256}
}
function candidateValid(candidate: MvuStateCandidate, state: MvuNumericalSnapshot,
  intent: MvuStateTerminalIntent): void {
  if(intent.schemaVersion===2) {
    if(candidate.kind==='no-update') {
      keys(candidate,['kind','schemaVersion','protocol'])
      if(!('schemaVersion' in candidate)||candidate.schemaVersion!==2
        ||candidate.protocol!=='native-mvu-update-v2')fail('CANDIDATE_INVALID')
    }else {
      const result=reduceMvuUpdateOperationsV2(state.values,candidate.operations)
      if(result.kind!=='prepared'||!same(candidate,result))fail('CANDIDATE_INVALID')
    }
  } else if (candidate.kind === 'no-update') keys(candidate, ['kind'])
  else {
    keys(candidate, ['kind', 'schemaVersion', 'protocol', 'operations', 'baseValuesSha256',
      'values', 'valuesSha256', 'proposalSha256'])
    // These are already decoded historical operations. Replay the v1 reducer
    // directly; a synthetic escaped container would impose a different byte
    // budget on data that passed the original parser, without changing hashes.
    const result = reduceMvuUpdateOperations(state.values, candidate.operations)
    if (result.kind !== 'prepared' || !same(candidate, result)) fail('CANDIDATE_INVALID')
  }
  if (candidate.kind !== intent.candidate.kind || recordSha256(candidate) !== intent.candidate.candidateSha256) fail('CANDIDATE_INVALID')
}
function eventFor(intent: MvuStateTerminalIntent, proposal: PreparedMvuUpdate | PreparedMvuUpdateV2): MvuStateUpdateEvent {
  const descriptor = {schemaVersion: 1 as const, encoding: 'native-mvu-state-update-event-v1' as const,
    sessionId: intent.sessionId, sourceSha256: intent.sourceSha256, root: intent.base.root,
    eventId: intent.intentSha256, revision: intent.base.revision + 1, intent, proposal, valuesSha256: proposal.valuesSha256}
  return {...descriptor, eventSha256: recordSha256(descriptor)}
}
function headFor(event: MvuStateUpdateEvent): MvuStateCurrentHead {
  return {schemaVersion: 1, encoding: 'native-mvu-state-current-head-v1', sessionId: event.sessionId,
    sourceSha256: event.sourceSha256, root: event.root, revision: event.revision,
    eventId: event.eventId, eventSha256: event.eventSha256, valuesSha256: event.valuesSha256,
    intentSha256: event.intent.intentSha256}
}
function settlementFor(intent: MvuStateTerminalIntent, candidate: MvuStateCandidate,
  head: MvuNumericalHead, event?: MvuStateUpdateEvent): MvuStatePublisherSettlement {
  const result: MvuStatePublisherSettlement['result'] = {head, headSha256: recordSha256(head),
    revision: head.revision, valuesSha256: head.valuesSha256}
  if (event) result.event = {key: mvuStateEventKey(intent.sessionId, event.eventId), sha256: event.eventSha256}
  const descriptor = {schemaVersion: 1 as const, encoding: 'native-mvu-state-publisher-settlement-v1' as const,
    sessionId: intent.sessionId, sourceSha256: intent.sourceSha256, intent, candidate,
    outcome: event ? 'updated' as const : 'no-update' as const, result,
    completedReceiptSha256: intent.completedReceiptSha256}
  return {...descriptor, settlementSha256: recordSha256(descriptor)}
}

export function createRoleplayMvuState(deps: MvuStateDeps) {
  function unedited(sid:string):void {
    if(!deps.readEditInvalidation)return
    const gate=deps.readEditInvalidation(sid)
    if(!gate||!['clear','invalidated','unknown'].includes(gate.kind))fail('NUMERICAL_EDIT_UNKNOWN')
    if(gate.kind!=='clear')fail(typeof gate.code==='string'?gate.code:'NUMERICAL_EDIT_UNKNOWN')
  }
  function verified(intent: MvuStateTerminalIntent): void {
    if (!deps.verifyStoredIntent(cloneJson(intent))) fail('STORED_INTENT_UNPROVEN')
  }
  function verifiedManual(intent:MvuPlayerStateIntent):void {
    if(!deps.verifyStoredManualIntent?.(cloneJson(intent)))fail('MANUAL_STORED_INTENT_UNPROVEN')
  }
  function manualGate(sid:string,allowedIntent?:MvuPlayerStateIntent):void {
    const code=deps.manualGate?.(sid,allowedIntent&&cloneJson(allowedIntent))
    if(code!==undefined)fail(typeof code==='string'&&code?code:'MANUAL_GATE_UNKNOWN')
  }
  function genesis(sid: string): {genesis: StateGenesis; state: MvuNumericalSnapshot} {
    if (!id(sid)) fail('SESSION_INVALID')
    const supplied = deps.readGenesis(sid)
    if (!supplied) fail('GENESIS_UNPROVEN')
    const g = cloneJson(supplied)
    if('programEvent' in g) {
      keys(g,['sessionId','sourceSha256','programEvent','programHead'])
      // The writer's validated final values already include the one generated
      // opening-body settlement. Never reapply that body as a story terminal,
      // and never reinterpret a copied raw opening as an update proposal.
      const actual=validateProgramMvuGenesisFactsV1(g.programEvent,g.programHead)
      if(actual.sessionId!==sid||!hash(g.sourceSha256)||!same(actual,g))fail('GENESIS_INVALID')
      const persistedEvent=deps.table.get(mvuInitializationEventKey(sid,actual.programEvent.eventId)),
        persistedHead=deps.table.get(mvuInitializationHeadKey(sid))
      if(persistedEvent===undefined||persistedHead===undefined
        ||!same(cloneJson(persistedEvent),actual.programEvent)||!same(cloneJson(persistedHead),actual.programHead)) {
        fail('PROGRAM_GENESIS_RECORD_MISSING_OR_CHANGED')
      }
      const event=actual.programEvent,head=actual.programHead,
        root:MvuProgramStateRoot={schemaVersion:1,encoding:'native-program-mvu-state-root-v1',
          programEventId:event.eventId,programEventSha256:event.eventSha256,
          programHeadSha256:recordSha256(head),planSha256:event.plan.planSha256}
      rootValid(root);headValid(head,sid,actual.sourceSha256,root)
      if(head.valuesSha256!==event.valuesSha256||event.valuesSha256!==recordSha256(event.finalValues))fail('GENESIS_INVALID')
      return {genesis:actual,state:snapshot(head,event.finalValues,sid,actual.sourceSha256,root)}
    }
    if ('derivedEvent' in g) {
      keys(g, ['sessionId', 'sourceSha256', 'derivedEvent', 'derivedHead'])
      const event = g.derivedEvent, head = g.derivedHead
      keys(event, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'revision',
        'eventId', 'eventSha256', 'basisSha256', 'values', 'valuesSha256'])
      const {eventSha256, ...descriptor} = event
      if (g.sessionId !== sid || !hash(g.sourceSha256) || event.schemaVersion !== 1
        || event.encoding !== 'native-mvu-derived-genesis-event-v1' || event.revision !== 1
        || event.sessionId !== sid || event.sourceSha256 !== g.sourceSha256
        || ![event.eventId, eventSha256, event.basisSha256, event.valuesSha256].every(hash)
        || !event.values || typeof event.values !== 'object' || Array.isArray(event.values)
        || event.valuesSha256 !== recordSha256(event.values) || eventSha256 !== recordSha256(descriptor)) fail('GENESIS_INVALID')
      const root: MvuDerivedStateRoot = {schemaVersion: 1, encoding: 'native-mvu-derived-state-root-v1',
        derivedEventId: event.eventId, derivedEventSha256: eventSha256,
        derivedHeadSha256: recordSha256(head), basisSha256: event.basisSha256}
      rootValid(root)
      headValid(head, sid, g.sourceSha256, root)
      if (head.valuesSha256 !== event.valuesSha256) fail('GENESIS_INVALID')
      return {genesis: g, state: snapshot(head, event.values, sid, g.sourceSha256, root)}
    }
    const event = g.initEvent, head = g.initHead
    const {eventSha256, ...eventDescriptor} = event
    const {planSha256, ...planDescriptor} = event.plan
    if (g.sessionId !== sid || !hash(g.sourceSha256) || event.schemaVersion !== 1
      || event.encoding !== 'mvu-programmatic-opening-event-v1' || event.revision !== 1
      || event.plan.identity.sessionId !== sid || recordSha256(eventDescriptor) !== eventSha256
      || recordSha256(planDescriptor) !== planSha256 || event.valuesSha256 !== recordSha256(event.plan.values)
      || event.plan.valuesSha256 !== event.valuesSha256) fail('GENESIS_INVALID')
    const root = {initEventId: event.eventId, initEventSha256: eventSha256,
      initHeadSha256: recordSha256(head), planSha256}
    rootValid(root)
    headValid(head, sid, g.sourceSha256, root)
    if (head.valuesSha256 !== event.valuesSha256) fail('GENESIS_INVALID')
    return {genesis: g, state: snapshot(head, event.plan.values, sid, g.sourceSha256, root)}
  }
  function scan(sid: string): Map<string, unknown> {
    const rows = new Map<string, unknown>(), prefix = `${sid}__mvu-state-`
    for (const [key, value] of deps.table.entries()) if (key.startsWith(prefix)) {
      if (rows.size >= MAX_RECORDS || rows.has(key)) fail('RECORD_LIMIT')
      if (value === undefined) fail('RECORD_INVALID')
      const actual = deps.table.get(key)
      if (actual === undefined || !same(cloneJson(value), cloneJson(actual))) fail('READ_UNCERTAIN')
      rows.set(key, cloneJson(actual))
    }
    // Require enumerated ownership: a missing enumeration cannot hide a pointer.
    const current = deps.table.get(mvuStateCurrentHeadKey(sid))
    if ((current !== undefined) !== rows.has(mvuStateCurrentHeadKey(sid))) fail('READ_UNCERTAIN')
    return rows
  }
  function inspect(sid: string,allowedIntent?:MvuPlayerStateIntent): {state: MvuNumericalSnapshot;
    settlements:Map<string,MvuStatePublisherSettlement|MvuPlayerStatePublisherSettlement>;
    genesis:StateGenesis;states:Map<string,MvuNumericalSnapshot>;rows:Map<string,unknown>} {
    unedited(sid)
    manualGate(sid,allowedIntent)
    const capturedGenesis=genesis(sid)
    const initial = capturedGenesis.state, rows = scan(sid), consumed = new Set<string>()
    const settlements = new Map<string,MvuStatePublisherSettlement|MvuPlayerStatePublisherSettlement>()
    const chain:(MvuStateUpdateEvent|MvuPlayerStateUpdateEvent)[] = [], seen = new Set<string>()
    const currentKey = mvuStateCurrentHeadKey(sid)
    let head = rows.get(currentKey) as MvuNumericalHead | undefined
    if (head) consumed.add(currentKey)
    else head = initial.currentHead
    const target = head
    while (head.revision !== 1) {
      headValid(head, sid, initial.sourceSha256, initial.root)
      if ((head.encoding !== 'native-mvu-state-current-head-v1'&&head.encoding !== 'native-mvu-state-current-head-v2')
        || seen.has(head.eventId)) fail('CHAIN_INVALID')
      seen.add(head.eventId)
      const eventKey = mvuStateEventKey(sid, head.eventId)
      const event=rows.get(eventKey) as MvuStateUpdateEvent|MvuPlayerStateUpdateEvent|undefined
      if (!event) fail('EVENT_MISSING')
      if(event.encoding==='native-mvu-player-state-update-event-v1') {
        manualIntentValid(event.intent);verifiedManual(event.intent)
        if(!same(event,mvuPlayerEventFor(event.intent))||!same(head,mvuPlayerHeadFor(event)))fail('EVENT_INVALID')
      } else {
        if(event.encoding!=='native-mvu-state-update-event-v1')fail('EVENT_INVALID')
        intentValid(event.intent);verified(event.intent)
        if(!same(event,eventFor(event.intent,event.proposal))||!same(head,headFor(event)))fail('EVENT_INVALID')
      }
      if (event.intent.sessionId !== sid || event.intent.sourceSha256 !== initial.sourceSha256
        || !same(event.root, initial.root)) fail('EVENT_INVALID')
      consumed.add(eventKey)
      chain.push(event)
      head = event.intent.base.currentHead
      if (chain.length > MAX_RECORDS) fail('CHAIN_INVALID')
    }
    if (!same(head, initial.currentHead)) fail('ROOT_INVALID')
    let state = initial
    const states = new Map<string, MvuNumericalSnapshot>([[state.headSha256, state]])
    for (const event of chain.reverse()) {
      if (!same(event.intent.base, baseOf(state))) fail('BASE_INVALID')
      let expected:MvuStatePublisherSettlement|MvuPlayerStatePublisherSettlement,next:MvuNumericalSnapshot
      if(event.encoding==='native-mvu-player-state-update-event-v1') {
        if(same(event.replacement.values,state.values))fail('MANUAL_EVENT_NO_CHANGE')
        const head=mvuPlayerHeadFor(event)
        expected=mvuPlayerSettlementFor(event.intent,head,{key:mvuStateEventKey(sid,event.eventId),sha256:event.eventSha256})
        next=snapshot(head,event.replacement.values,sid,initial.sourceSha256,initial.root)
      } else {
        candidateValid(event.proposal,state,event.intent)
        expected=settlementFor(event.intent,event.proposal,headFor(event),event)
        next=snapshot(headFor(event),event.proposal.values,sid,initial.sourceSha256,initial.root)
      }
      const key = mvuStateSettlementKey(sid, event.eventId), actual = rows.get(key)
      if (!actual || !same(actual, expected)) fail('SETTLEMENT_MISSING_OR_INVALID')
      consumed.add(key)
      settlements.set(event.eventId, expected)
      state = next
      states.set(state.headSha256, state)
    }
    if (!same(state.currentHead, target)) fail('HEAD_INVALID')
    for (const [key, raw] of rows) if (!consumed.has(key)) {
      const item = raw as MvuStatePublisherSettlement|MvuPlayerStatePublisherSettlement
      if(!key.startsWith(`${sid}__mvu-state-settlement-`))fail('OWNED_PARTIAL_OR_ORPHAN')
      const player=item.encoding==='native-mvu-player-state-publisher-settlement-v1'
      if(player) {
        if(item.outcome!=='no-update')fail('OWNED_PARTIAL_OR_ORPHAN')
        manualIntentValid(item.intent);verifiedManual(item.intent)
      } else {
        if(item.encoding!=='native-mvu-state-publisher-settlement-v1'||item.candidate?.kind!=='no-update') {
          fail('OWNED_PARTIAL_OR_ORPHAN')
        }
        intentValid(item.intent);verified(item.intent)
      }
      const base = states.get(item.intent.base.headSha256)
      if (!base || !same(item.intent.base, baseOf(base)) || item.intent.sessionId !== sid
        || item.intent.sourceSha256 !== initial.sourceSha256) fail('BASE_INVALID')
      let expected:MvuStatePublisherSettlement|MvuPlayerStatePublisherSettlement
      if(player) {
        if(!same(item.replacement.values,base.values))fail('MANUAL_NO_UPDATE_INVALID')
        expected=mvuPlayerSettlementFor(item.intent,base.currentHead)
      } else {
        candidateValid(item.candidate,base,item.intent)
        expected=settlementFor(item.intent,item.candidate,base.currentHead)
      }
      if (key !== mvuStateSettlementKey(sid, item.intent.intentSha256) || !same(item, expected)) fail('SETTLEMENT_INVALID')
      consumed.add(key)
      settlements.set(item.intent.intentSha256, expected)
    }
    return {state, settlements,genesis:capturedGenesis.genesis,states,rows}
  }
  const codeOf = (error: unknown) => error instanceof StateRefusal||error instanceof MvuPlayerDataRefusal
    ||error instanceof MvuPromptFactsRefusal||error instanceof ProgramGenesisDataFailureV1
    ? error.code : 'READ_OR_PERMISSION_UNKNOWN'
  /** A single existing inspect owns all numerical verification/replay. The
   * formatter only associates its already-verified settlements with snapshots.
   * No-update rows matter even when the latest head is unchanged. */
  function formatPromptFacts(actual:ReturnType<typeof inspect>):MvuPromptLocalNumericalFactsV1|MvuPromptLocalNumericalFactsV2 {
    if('programEvent' in actual.genesis)return formatLocalMvuPromptFactsV2({...actual,genesis:actual.genesis})
    return formatLocalMvuPromptFactsV1({...actual,genesis:actual.genesis})
  }
  function capturePromptNumericalFacts(sid:string)
    :MvuPromptFactCaptureV1<MvuPromptLocalNumericalFactsV1|MvuPromptLocalNumericalFactsV2> {
    try {
      const owner=deps.capturePromptFactsOwner?.(sid)
      if(!owner||!owner())fail('PROMPT_NUMERICAL_OWNER_UNAVAILABLE')
      const data=formatPromptFacts(inspect(sid))
      if(!owner())fail('PROMPT_NUMERICAL_OWNER_UNAVAILABLE')
      return Object.freeze({kind:'ready' as const,data})
    }catch(error){return Object.freeze({kind:'unavailable' as const,code:codeOf(error)})}
  }
  function readNumericalAuthority(sid: string): MvuNumericalAuthority {
    try {return {kind: 'ready', snapshot: cloneJson(inspect(sid).state)}}
    catch (error) {return {kind: 'blocked', code: codeOf(error)}}
  }
  function readNumericalObservation(sid:string):MvuNumericalObservation {
    let actual:ReturnType<typeof inspect>,state:MvuNumericalSnapshot
    try {actual=inspect(sid);state=cloneJson(actual.state)}
    catch(error) {return {kind:'blocked',code:codeOf(error)}}
    // inspect has already checked all Native/canonical intent, event, reducer,
    // head and settlement facts. Do not reconcile each message a second time.
    const updates:MvuAcceptedDisplayUpdate[]=[]
    for(const settlement of actual.settlements.values()) {
      if(settlement.encoding!=='native-mvu-state-publisher-settlement-v1'
        ||settlement.outcome!=='updated'||settlement.candidate.kind!=='prepared')continue
      const item=acceptedMvuDisplayUpdate(settlement.sessionId,settlement.intent.canonical,settlement.candidate.protocol)
      if(item)updates.push(item)
    }
    try {
      const inherited=deps.captureInheritedDisplayUpdates?.(sid,actual.genesis)
      if(inherited) {
        const captured=formatMvuDisplayUpdates(inherited.updates)
        updates.push(...captured)
      }
    }catch { /* Optional display data must not change numerical readiness. */ }
    return {kind:'ready',snapshot:state,displayUpdates:formatMvuDisplayUpdates(updates)}
  }
  function reconcileFacts(input: MvuStateTerminalIntent): MvuStateFacts {
    try {
      const intent = cloneJson(input)
      intentValid(intent)
      unedited(intent.sessionId)
      verified(intent)
      const {state, settlements} = inspect(intent.sessionId)
      if (state.sourceSha256 !== intent.sourceSha256 || !same(state.root, intent.base.root)) fail('SOURCE_CHANGED')
      const settlement = settlements.get(intent.intentSha256)
      if (!settlement) return {kind: 'absent', code: 'SETTLEMENT_ABSENT'}
      if (settlement.encoding!=='native-mvu-state-publisher-settlement-v1'||!same(settlement.intent, intent)) fail('INTENT_CONFLICT')
      return {kind: 'committed', settlement: cloneJson(settlement)}
    } catch (error) {return {kind: 'unknown', code: codeOf(error)}}
  }
  function permitted(token: object, intent: MvuStateTerminalIntent, phase: MvuStatePermissionPhase): void {
    unedited(intent.sessionId)
    manualGate(intent.sessionId)
    verified(intent)
    const current = genesis(intent.sessionId).state
    if (current.sourceSha256 !== intent.sourceSha256 || !same(current.root, intent.base.root)) fail('SOURCE_CHANGED')
    if (!deps.checkPermission(token, cloneJson(intent), phase)) fail('PERMISSION_REVOKED')
  }
  /** A terminal owner's already-confirmed immutable result is a historical
   * consumption fact. A later import must not force it through the current
   * genesis/Source reader, nor can this method mint permission or continue a
   * partial publication. The current authority reader remains strict. */
  /** Immutable numerical facts only. The prefix consumer separately verifies
   * Native/owner lineage; this method creates no token or continuation rights. */
  function verifyConsumedSettlementFacts(input:MvuConsumedSettlementFactsInput):boolean {
    try {
      const intent=cloneJson(input.intent),base=cloneJson(input.base),proposal=cloneJson(input.proposal)
      intentValid(intent)
      if(proposal.kind==='rejected'||!same(base,snapshot(base.currentHead,base.values,base.sessionId,base.sourceSha256,base.root))
        ||!same(intent.base,baseOf(base))||base.sessionId!==intent.sessionId||base.sourceSha256!==intent.sourceSha256)return false
      candidateValid(proposal,base,intent)
      const event=proposal.kind==='prepared'?eventFor(intent,proposal):undefined
      const expected=settlementFor(intent,proposal,event?headFor(event):base.currentHead,event)
      return same(cloneJson(input.settlement),expected)
        &&same(cloneJson(deps.table.get(mvuStateSettlementKey(intent.sessionId,intent.intentSha256))),expected)
        &&(!event||same(cloneJson(deps.table.get(mvuStateEventKey(intent.sessionId,event.eventId))),event))
    } catch {return false}
  }
  function verifyConsumedSettlement(input:MvuConsumedSettlementFactsInput):boolean {
    try {
      const intent=cloneJson(input.intent)
      intentValid(intent);verified(intent)
      return verifyConsumedSettlementFacts(input)
    }
    catch {return false}
  }
  function manualFacts(input:MvuPlayerStateIntent,allowedIntent?:MvuPlayerStateIntent):MvuPlayerStateFacts {
    try {
      const intent=cloneJson(input)
      manualIntentValid(intent);verifiedManual(intent)
      const {state,settlements}=inspect(intent.sessionId,allowedIntent)
      if(state.sourceSha256!==intent.sourceSha256||!same(state.root,intent.base.root))fail('SOURCE_CHANGED')
      const settlement=settlements.get(intent.intentSha256)
      if(!settlement)return {kind:'absent',code:'SETTLEMENT_ABSENT'}
      if(settlement.encoding!=='native-mvu-player-state-publisher-settlement-v1'||!same(settlement.intent,intent)) {
        fail('MANUAL_INTENT_CONFLICT')
      }
      return {kind:'committed',settlement:cloneJson(settlement)}
    } catch(error) {return {kind:'unknown',code:codeOf(error)}}
  }
  function reconcileManualFacts(intent:MvuPlayerStateIntent):MvuPlayerStateFacts {return manualFacts(intent)}
  /** Historical exact numerical descriptors only. The prefix/coordinator owns
   * independent validation of the original operation and actual Native marker.
   * Today's Source/head/gate and hot publication rights are never consulted. */
  function verifyConsumedManualSettlementFacts(input:MvuConsumedManualSettlementFactsInput):boolean {
    try {
      const intent=cloneJson(input.intent),base=cloneJson(input.base)
      const replacement=cloneMvuPlayerReplacement(input.replacement)
      manualIntentValid(intent)
      if(!same(base,snapshot(base.currentHead,base.values,base.sessionId,base.sourceSha256,base.root))
        ||!same(intent.base,baseOf(base))||!same(intent.replacement,replacement)
        ||base.sessionId!==intent.sessionId||base.sourceSha256!==intent.sourceSha256)return false
      const event=same(replacement.values,base.values)?undefined:mvuPlayerEventFor(intent)
      const expected=mvuPlayerSettlementFor(intent,event?mvuPlayerHeadFor(event):base.currentHead,
        event?{key:mvuStateEventKey(intent.sessionId,event.eventId),sha256:event.eventSha256}:undefined)
      return same(cloneJson(input.settlement),expected)
        &&same(cloneJson(deps.table.get(mvuStateSettlementKey(intent.sessionId,intent.intentSha256))),expected)
        &&(event?same(cloneJson(deps.table.get(mvuStateEventKey(intent.sessionId,event.eventId))),event)
          :deps.table.get(mvuStateEventKey(intent.sessionId,intent.intentSha256))===undefined)
    } catch {return false}
  }
  function permittedManual(token:object,intent:MvuPlayerStateIntent,phase:MvuStatePermissionPhase):void {
    unedited(intent.sessionId);verifiedManual(intent)
    const current=genesis(intent.sessionId).state
    if(current.sourceSha256!==intent.sourceSha256||!same(current.root,intent.base.root))fail('SOURCE_CHANGED')
    if(!deps.checkManualPermission?.(token,cloneJson(intent),phase))fail('MANUAL_PERMISSION_REVOKED')
    manualGate(intent.sessionId,intent)
  }
  /** Exact verified revision-one basis, independent of later state rows. */
  function readGenesisAuthority(sid:string):MvuNumericalAuthority {
    try {return {kind:'ready',snapshot:cloneJson(genesis(sid).state)}}
    catch(error) {return {kind:'blocked',code:codeOf(error)}}
  }
  /** A lost put response is classified by exact immediate readback. Never retry
   * inside this invocation; a durable partial also blocks every later invocation.
   * An entirely absent write leaves the terminal owner responsible for revoking
   * the one-shot hot permission, independently of this numerical reader. */
  async function putExact(key: string, value: MvuStateRecord): Promise<void> {
    let failed = false
    try {await deps.table.put(key, cloneJson(value))} catch {failed = true}
    const actual = deps.table.get(key)
    if (actual === undefined) fail(failed ? 'WRITE_ABSENT' : 'WRITE_UNCONFIRMED')
    if (!same(cloneJson(actual), value)) fail('WRITE_CONFLICT')
  }
  async function publish(input: {token: object; intent: MvuStateTerminalIntent;
    base: MvuNumericalSnapshot; proposal: MvuStateUpdatePreparation}): Promise<MvuStatePublication> {
    const token = input.token
    let intent: MvuStateTerminalIntent, base: MvuNumericalSnapshot, candidate: MvuStateCandidate
    try {
      intent = cloneJson(input.intent)
      base = cloneJson(input.base)
      intentValid(intent)
      const proposal = cloneJson(input.proposal)
      if (!proposal || proposal.kind === 'rejected') fail('CANDIDATE_REJECTED')
      candidate = proposal
      if (!same(base, snapshot(base.currentHead, base.values, base.sessionId, base.sourceSha256, base.root))
        || base.sessionId !== intent.sessionId || base.sourceSha256 !== intent.sourceSha256
        || !same(baseOf(base), intent.base)) fail('BASE_INVALID')
      if (!token || typeof token !== 'object') fail('PERMISSION_REVOKED')
    } catch (error) {return {kind: 'blocked', code: codeOf(error)}}
    let wrote = false
    try {
      return await deps.withSourceLock(intent.sessionId, async (): Promise<MvuStatePublication> => {
        permitted(token, intent, 'before-write')
        const facts = reconcileFacts(intent)
        if (facts.kind === 'committed') {
          if (!same(facts.settlement.candidate, candidate)) fail('CANDIDATE_INVALID')
          permitted(token, intent, 'after-settlement')
          return {kind: 'acknowledged', settlement: facts.settlement}
        }
        // A partial event/head cannot be promoted by hot retry or cold readback.
        if (facts.kind === 'unknown') return {kind: 'unknown', code: facts.code}
        const actual = inspect(intent.sessionId).state
        if (!same(actual, base)) fail('BASE_CHANGED')
        candidateValid(candidate, actual, intent)
        const event = candidate.kind === 'prepared' ? eventFor(intent, candidate) : undefined
        const head = event ? headFor(event) : actual.currentHead
        const settlement = settlementFor(intent, candidate, head, event)
        if (event) {
          permitted(token, intent, 'before-write')
          wrote = true
          await putExact(mvuStateEventKey(intent.sessionId, event.eventId), event)
          permitted(token, intent, 'before-head')
          // Recheck the original pointer only; inspect would rightly block our
          // incomplete event until settlement. No broad partial exemption exists.
          const pointer = deps.table.get(mvuStateCurrentHeadKey(intent.sessionId))
          if (!same(pointer ?? genesis(intent.sessionId).state.currentHead, actual.currentHead)) fail('BASE_CHANGED')
          await putExact(mvuStateCurrentHeadKey(intent.sessionId), head as MvuStateCurrentHead)
          permitted(token, intent, 'after-head')
        }
        permitted(token, intent, 'after-head')
        wrote = true
        await putExact(mvuStateSettlementKey(intent.sessionId, intent.intentSha256), settlement)
        permitted(token, intent, 'after-settlement')
        const completed = reconcileFacts(intent)
        if (completed.kind !== 'committed' || !same(completed.settlement, settlement)) fail('SETTLEMENT_UNCONFIRMED')
        return {kind: 'acknowledged', settlement: completed.settlement}
      })
    } catch (error) {
      // Retain complete facts when a late cancellation follows an already
      // issued settlement, but never turn those facts back into hot authority.
      const facts = reconcileFacts(intent)
      if (facts.kind === 'committed') return {kind: 'unknown', code: codeOf(error), settlement: facts.settlement}
      return {kind: wrote ? 'unknown' : 'blocked', code: codeOf(error)}
    }
  }
  /** The actual coordinator must already hold this session's Source lock. Its
   * private lease affirms that fact in checkManualPermission at every boundary.
   * Do not re-enter withSourceLock or accept an HTTP-supplied exemption/token. */
  async function publishManual(input:{token:object;intent:MvuPlayerStateIntent;
    base:MvuNumericalSnapshot;replacement:MvuPlayerStateReplacement}):Promise<MvuPlayerStatePublication> {
    let intent:MvuPlayerStateIntent,base:MvuNumericalSnapshot,replacement:MvuPlayerStateReplacement
    const token=input.token
    try {
      intent=cloneJson(input.intent);base=cloneJson(input.base)
      replacement=cloneMvuPlayerReplacement(input.replacement);manualIntentValid(intent)
      if(!same(base,snapshot(base.currentHead,base.values,base.sessionId,base.sourceSha256,base.root))
        ||base.sessionId!==intent.sessionId||base.sourceSha256!==intent.sourceSha256
        ||!same(intent.base,baseOf(base))||!same(intent.replacement,replacement))fail('BASE_INVALID')
      if(!token||typeof token!=='object')fail('MANUAL_PERMISSION_REVOKED')
    } catch(error) {return {kind:'blocked',code:codeOf(error)}}
    let wrote=false,settlement:MvuPlayerStatePublisherSettlement|undefined
    try {
      permittedManual(token,intent,'before-write')
      const facts=manualFacts(intent,intent)
      if(facts.kind==='committed') {
        permittedManual(token,intent,'after-settlement')
        return {kind:'acknowledged',settlement:facts.settlement}
      }
      if(facts.kind==='unknown')return {kind:'unknown',code:facts.code}
      const actual=inspect(intent.sessionId,intent).state
      if(!same(actual,base))fail('BASE_CHANGED')
      const event=same(replacement.values,actual.values)?undefined:mvuPlayerEventFor(intent)
      const head=event?mvuPlayerHeadFor(event):actual.currentHead
      settlement=mvuPlayerSettlementFor(intent,head,
        event?{key:mvuStateEventKey(intent.sessionId,event.eventId),sha256:event.eventSha256}:undefined)
      if(event) {
        permittedManual(token,intent,'before-write');wrote=true
        await putExact(mvuStateEventKey(intent.sessionId,event.eventId),event)
        permittedManual(token,intent,'before-head')
        const pointer=deps.table.get(mvuStateCurrentHeadKey(intent.sessionId))
        if(!same(pointer??genesis(intent.sessionId).state.currentHead,actual.currentHead))fail('BASE_CHANGED')
        await putExact(mvuStateCurrentHeadKey(intent.sessionId),head as MvuPlayerStateCurrentHead)
        permittedManual(token,intent,'after-head')
      }
      permittedManual(token,intent,'after-head');wrote=true
      await putExact(mvuStateSettlementKey(intent.sessionId,intent.intentSha256),settlement)
      permittedManual(token,intent,'after-settlement')
      const completed=manualFacts(intent,intent)
      if(completed.kind!=='committed'||!same(completed.settlement,settlement))fail('SETTLEMENT_UNCONFIRMED')
      return {kind:'acknowledged',settlement:completed.settlement}
    } catch(error) {
      if(settlement&&verifyConsumedManualSettlementFacts({intent,base,replacement,settlement})) {
        return {kind:'unknown',code:codeOf(error),settlement:cloneJson(settlement)}
      }
      return {kind:wrote?'unknown':'blocked',code:codeOf(error)}
    }
  }
  return {readNumericalAuthority,readNumericalObservation,readGenesisAuthority,capturePromptNumericalFacts,publish,reconcileFacts,
    verifyConsumedSettlement,verifyConsumedSettlementFacts,publishManual,reconcileManualFacts,verifyConsumedManualSettlementFacts}
}
