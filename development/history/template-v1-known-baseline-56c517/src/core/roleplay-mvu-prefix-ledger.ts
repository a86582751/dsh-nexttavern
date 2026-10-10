/** Read-only numerical consumption evidence for an actual inherited Native cut.
 * Core supplies verified genesis and the frozen cut. This reader never borrows
 * a live Agent, current owner/head pointer, permission token or flush capability. */
import {recordSha256,sha256} from './roleplay-data.js'
import {formatPrefixMvuPromptFactsV1,MvuPromptFactsRefusal} from './roleplay-mvu-prompt-numerical-facts.js'
import type {MvuPromptPrefixNumericalFactsV1,MvuPromptValidatedStoryInputV1,
  MvuPromptValidatedManualInputV1,MvuPromptRowRefV1} from './roleplay-mvu-prompt-numerical-facts.js'
import {prepareMvuUpdate} from './roleplay-mvu-update.js'
import {prepareMvuUpdateV2} from './roleplay-mvu-update-v2.js'
import {verifyInheritedCompletedFact} from './roleplay-mvu-prefix-facts.js'
import {mvuStateEventKey, mvuStateSettlementKey, MVU_STATE_BOUNDS} from './roleplay-mvu-state.js'
import {readMvuPlayerOperationFacts, mvuPlayerOperationKey, mvuPlayerCompletionKey} from './roleplay-mvu-player-facts.js'
import {MVU_PLAYER_EDIT_EVENT, assertMvuPlayerEditEvent} from 'dsh-nexttavern-session-format/mvu-player-marker'
import type {SessionEvent} from '@deepseek-ai/dsh-session'
import type {MvuConsumedManualSettlementFactsInput} from './roleplay-mvu-player-records.js'
import type {MvuInheritedPrefixEvent, MvuInheritedCompletedFactDeps} from './roleplay-mvu-prefix-facts.js'
import type {InputCompletionRecord, InputCompletionScope} from './roleplay-input-completion.js'
import type {InputPreparationCurrency} from './roleplay-input-preparation.js'
import type {NativeDurableInputWorkReceiptV1, NativeInputRef, NativePreparationReceiptV1}
  from '@deepseek-ai/dsh-agent-loop'
import type {MvuNumericalSnapshot, MvuStateTerminalIntent, MvuStatePublisherSettlement,MvuStateUpdatePreparation} from './roleplay-mvu-state.js'
import {validateProgramMvuGenesisFactsV1,cloneProgramGenesisDataV1} from './roleplay-program-genesis-data.js'
import type {VerifiedMvuProgramGenesis,ProgramGenesisDataRefV1} from './roleplay-program-genesis-types.js'
import {validateProgramOpeningSeedV1,validateProgramOpeningInputV1,validateProgramOpeningPlanRecordV1,
  validateOpeningIntentV7,validateProgramOpeningNativeFactsV1,validateProgramOpeningGenesisEnvelopeV1,
  programOpeningSeedKeyV1,programOpeningInputKeyV1,programOpeningPlanKeyV1} from './roleplay-program-opening-records.js'
import type {ProgramOpeningIntentSeedV1,ProgramOpeningInputPacketV1,ProgramOpeningPlanRecordV1,
  OpeningIntentV7,ProgramOpeningNativeFactsV1} from './roleplay-program-opening-records.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import type {TavernSourceFrozenRefV1} from './roleplay-tavern-source-inheritance-types.js'

const NAMESPACE = 'nexttavern.roleplay.input.v2'
export interface MvuPrefixLedgerTable {get(key: string): unknown; entries(): Iterable<[string, unknown]>}
export interface MvuPrefixSettlementFactsInput {
  intent: MvuStateTerminalIntent
  base: MvuNumericalSnapshot
  proposal: MvuStateUpdatePreparation
  settlement: unknown
}
export interface ProgramDerivedOpeningClosureDataV1 {
  readonly seed:ProgramOpeningIntentSeedV1
  readonly input:ProgramOpeningInputPacketV1
  readonly planRecord:ProgramOpeningPlanRecordV1
  readonly intent:OpeningIntentV7
  readonly refs:{readonly seed:ProgramGenesisDataRefV1;readonly input:ProgramGenesisDataRefV1;
    readonly plan:ProgramGenesisDataRefV1;readonly intent:ProgramGenesisDataRefV1}
  readonly genesisEventRef:ProgramGenesisDataRefV1
  readonly genesisHeadRef:ProgramGenesisDataRefV1
}
/** Complete immutable original records, never a live Source/Native lease. */
export interface ProgramDerivedOpeningClosureV1 {
  readonly schemaVersion:1
  readonly encoding:'native-program-derived-opening-closure-v1'
  readonly authority:'consumer-data-only'
  readonly kind:'program-opening'
  readonly data:ProgramDerivedOpeningClosureDataV1
  readonly closureSha256:string
}
export interface ProgramDerivedOpeningAtCutRequestV1 {
  readonly genesis:VerifiedMvuProgramGenesis
  readonly ownerSessionId:string
  readonly ownerInheritedEventCount:number
  readonly events:readonly MvuInheritedPrefixEvent[]
  readonly successorSourcePreparedRef?:TavernSourceFrozenRefV1
}
export type ProgramDerivedOpeningAtCutReadV1={readonly kind:'verified-program-opening';
  readonly closure:ProgramDerivedOpeningClosureV1;readonly native:ProgramOpeningNativeFactsV1;
  readonly assertCurrent:()=>void}|{readonly kind:'blocked';readonly code:string}
export type ProgramDerivedOpeningAtCutReaderV1=(request:ProgramDerivedOpeningAtCutRequestV1)=>ProgramDerivedOpeningAtCutReadV1
export interface MvuProgramPrefixOpeningInputV1 {
  readonly genesis:VerifiedMvuProgramGenesis
  readonly closure:ProgramDerivedOpeningClosureV1
  readonly native:ProgramOpeningNativeFactsV1
}
export interface MvuPrefixLedgerDeps {
  branch: MvuPrefixLedgerTable
  status: MvuPrefixLedgerTable
  /** Pure numerical algorithm/readback verification, independent of owner/hot permissions. */
  verifySettlementFacts(input: MvuPrefixSettlementFactsInput): boolean
  verifyManualSettlementFacts?(input: MvuConsumedManualSettlementFactsInput): boolean
  readProjectedCanonical: MvuInheritedCompletedFactDeps['readProjectedCanonical']
  editProtocol?:MvuInheritedCompletedFactDeps['editProtocol']
  /** Root's actual retained cut/official projection/frozen Source reader. */
  readProgramGenesisAtCut?:ProgramDerivedOpeningAtCutReaderV1
}
export interface MvuPrefixLedgerRequest {
  ownerSessionId: string
  ownerInheritedEventCount: number
  events: readonly MvuInheritedPrefixEvent[]
  sourceSha256: string
  /** Actual producer-verified revision-one authority, never the parent's latest head. */
  genesis: MvuNumericalSnapshot
  programOpening?:MvuProgramPrefixOpeningInputV1
  successorSourcePreparedRef?:TavernSourceFrozenRefV1
}
export interface MvuPrefixLedgerRowRef {key: string; sha256: string}
export interface MvuPrefixLedgerStep {
  preparationId: string
  receiptTurnEndSeq: number
  scopeSha256: string
  intentSha256: string
  work: MvuPrefixLedgerRowRef
  terminal: MvuPrefixLedgerRowRef
  snapshot: MvuPrefixLedgerRowRef
  phaseB: MvuPrefixLedgerRowRef
  settlement: MvuPrefixLedgerRowRef
  event?: MvuPrefixLedgerRowRef
  baseSnapshotSha256: string
  resultSnapshotSha256: string
}
interface MvuPrefixLedgerProofFields {
  ownerSessionId: string
  ownerInheritedEventCount: number
  inheritedPrefixLength: number
  historyPrefixSha256: string
  sourceSha256: string
  genesisSnapshotSha256: string
  numericalSnapshot: MvuNumericalSnapshot
  proofSha256: string
}
export interface MvuPrefixLedgerPlayerStep {
  kind: 'player'
  operationId: string
  marker: {seq: number; sha256: string}
  intentSha256: string
  operation: MvuPrefixLedgerRowRef
  completion: MvuPrefixLedgerRowRef
  settlement: MvuPrefixLedgerRowRef
  event?: MvuPrefixLedgerRowRef
  baseSnapshotSha256: string
  resultSnapshotSha256: string
}
export type MvuPrefixLedgerStepV2 = (MvuPrefixLedgerStep & {kind: 'story'}) | MvuPrefixLedgerPlayerStep
export interface MvuPrefixLedgerProofV1 extends MvuPrefixLedgerProofFields {
  schemaVersion: 1
  encoding: 'native-mvu-prefix-ledger-proof-v1'
  steps: readonly MvuPrefixLedgerStep[]
}
export interface MvuPrefixLedgerProofV2 extends MvuPrefixLedgerProofFields {
  schemaVersion: 2
  encoding: 'native-mvu-prefix-ledger-proof-v2'
  steps: readonly MvuPrefixLedgerStepV2[]
}
export interface MvuPrefixLedgerProofV3 extends MvuPrefixLedgerProofFields {
  readonly schemaVersion:3
  readonly encoding:'native-program-mvu-prefix-ledger-proof-v3'
  readonly steps:readonly MvuPrefixLedgerStepV2[]
  readonly programOpening:{readonly closureSha256:string;readonly nativeFactsSha256:string;
    readonly planSha256:string;readonly genesisEventRef:ProgramGenesisDataRefV1;
    readonly genesisHeadRef:ProgramGenesisDataRefV1;readonly editFloorSeq:number}
}
export type MvuPrefixLedgerProof = MvuPrefixLedgerProofV1 | MvuPrefixLedgerProofV2 | MvuPrefixLedgerProofV3
export type MvuPrefixLedgerResult = {kind: 'ready'; proof: MvuPrefixLedgerProof} | {kind: 'blocked'; code: string}
export type MvuPrefixPromptFactsResult={kind:'ready';proof:MvuPrefixLedgerProof;facts:MvuPromptPrefixNumericalFactsV1}
  |{kind:'blocked';code:string}
export interface MvuPrefixInputClosureV1 {
  readonly schemaVersion:1
  readonly encoding:'native-mvu-prefix-input-closure-v1'
  readonly authority:'consumer-data-only'
  readonly request:{readonly ownerSessionId:string;readonly ownerInheritedEventCount:number;
    readonly prefixLength:number;readonly prefixSha256:string;readonly sourceSha256:string;
    readonly genesisSnapshotSha256:string;readonly programOpeningSha256?:string;
    readonly successorSourcePreparedRefSha256?:string}
  readonly tables:readonly {readonly table:'branch'|'status';readonly membership:readonly string[];
    readonly rows:readonly {readonly key:string;readonly exists:boolean;readonly sha256:string;
      readonly value:unknown}[]}[]
  readonly ledgerProofSha256:string
  readonly closureSha256:string
}
export type MvuPrefixFrozenResult={kind:'ready';proof:MvuPrefixLedgerProof;closure:MvuPrefixInputClosureV1;
  assertCurrent():void}|Extract<MvuPrefixLedgerResult,{kind:'blocked'}>
interface Work {
  schemaVersion: 2
  namespace: string
  sessionId: string
  branchId: string
  preparationId: string
  receiptGeneration: number
  refs: readonly NativeInputRef[]
  credentialSha256: string
  preparation: NativePreparationReceiptV1
  status: string
  source: InputPreparationCurrency['source']
  attemptGeneration: number
  attempt?: {turn: number; step: number; prepared: boolean; legacyPreparationId?: string; snapshot?: {key: string; sha256: string}}
  checkpoint?: NativeDurableInputWorkReceiptV1
  terminalRequired?: true
  stop?: unknown
  transition?: unknown
  unclaimedRefusal?: unknown
}
class LedgerRefusal extends Error {constructor(readonly code: string) {super(code)}}
function fail(code: string): never {throw new LedgerRefusal(code)}
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const pathKey = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,512}$/.test(value)
const integer = (value: unknown, min = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value)
  && value >= min && !Object.is(value, -0)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const same = (left: unknown, right: unknown) => recordSha256(left) === recordSha256(right)
const ownPrefix = (sid: string) => `${sid}__native-input-v2-`
const terminalKey = (sid: string, prep: string) => `${ownPrefix(sid)}terminal-${prep}`
const workKey = (sid: string, refs: readonly NativeInputRef[]) => `${ownPrefix(sid)}work-${recordSha256(refs)}`
const refKey = (ref: Pick<NativeInputRef, 'insertSeq' | 'messageId'>) => `${ref.insertSeq}:${ref.messageId}`
function exact(value: unknown, required: readonly string[], optional: readonly string[] = []): asserts value is Record<string, unknown> {
  if (!object(value) || required.some(name => !Object.hasOwn(value, name))
    || Object.keys(value).some(name => !required.includes(name) && !optional.includes(name))) fail('LEDGER_SCHEMA_INVALID')
}
/** Inspect persisted ledger descriptors before any hashes or field reads. Bounds
 * mirror numerical-record limits; the larger Native cut gets its own byte limit.
 * Undefined is retained for actual Native events, never converted to Core missing. */
function inspect(value: unknown, byteLimit = MVU_STATE_BOUNDS.recordBytes): void {
  let nodes = 0, bytes = 0
  const ancestors = new Set<object>()
  function visit(item: unknown, depth: number): void {
    if (++nodes > MVU_STATE_BOUNDS.descriptorNodes || depth > MVU_STATE_BOUNDS.descriptorDepth) fail('LEDGER_BUDGET')
    if (item === null || item === undefined || typeof item === 'boolean') return
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER) fail('LEDGER_DATA_INVALID')
      return
    }
    if (typeof item === 'string') {
      bytes += Buffer.byteLength(item, 'utf8')
      if (bytes > byteLimit) fail('LEDGER_BUDGET')
      return
    }
    if (!item || typeof item !== 'object' || ancestors.has(item)) fail('LEDGER_DATA_INVALID')
    const array = Array.isArray(item), proto = Object.getPrototypeOf(item)
    if ((array ? proto !== Array.prototype : ![Object.prototype, null].includes(proto))
      || Object.getOwnPropertySymbols(item).length) fail('LEDGER_DATA_INVALID')
    const descriptors = Object.getOwnPropertyDescriptors(item)
    if (array && (item.length > 100_000 || Object.keys(descriptors).length !== item.length + 1)) fail('LEDGER_BUDGET')
    ancestors.add(item)
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (array && name === 'length') continue
      if (!('value' in descriptor) || !descriptor.enumerable || ['__proto__', 'constructor', 'prototype'].includes(name)) {
        fail('LEDGER_DATA_INVALID')
      }
      if (array && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= item.length)) fail('LEDGER_DATA_INVALID')
      bytes += Buffer.byteLength(name, 'utf8')
      if (bytes > byteLimit) fail('LEDGER_BUDGET')
      visit(descriptor.value, depth + 1)
    }
    ancestors.delete(item)
  }
  visit(value, 0)
}
function snapshotValid(value: unknown, sid: string, source: string): asserts value is MvuNumericalSnapshot {
  inspect(value)
  exact(value, ['schemaVersion', 'encoding', 'sessionId', 'sourceSha256', 'root', 'currentHead', 'revision',
    'headSha256', 'values', 'valuesSha256', 'stateSnapshotSha256'])
  if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-state-snapshot-v1'
    || value.sessionId !== sid || value.sourceSha256 !== source || !object(value.root) || !object(value.currentHead)
    || !object(value.values) || !integer(value.revision, 1) || value.currentHead.sessionId !== sid
    || value.currentHead.revision !== value.revision || value.currentHead.valuesSha256 !== value.valuesSha256
    || value.headSha256 !== recordSha256(value.currentHead) || value.valuesSha256 !== recordSha256(value.values)) fail('NUMERICAL_SNAPSHOT_INVALID')
  const {stateSnapshotSha256, ...body} = value
  if (!hash(stateSnapshotSha256) || stateSnapshotSha256 !== recordSha256(body)) fail('NUMERICAL_SNAPSHOT_INVALID')
}
function validateRefs(value: unknown, sid: string): asserts value is readonly NativeInputRef[] {
  if (!Array.isArray(value) || !value.length || value.length > 64) fail('WORK_REFS_INVALID')
  const ids = new Set<string>()
  for (const ref of value) {
    exact(ref, ['sessionId', 'insertSeq', 'messageId', 'messageSha256'])
    if (ref.sessionId !== sid || !integer(ref.insertSeq) || typeof ref.messageId !== 'string' || !ref.messageId.length
      || ref.messageId.length > 1024 || /[\u0000-\u001f\u007f-\u009f]/.test(ref.messageId)
      || !hash(ref.messageSha256) || ids.has(ref.messageId)) fail('WORK_REFS_INVALID')
    ids.add(ref.messageId)
  }
}
function validateWork(value: unknown, sid: string): Work {
  exact(value, ['schemaVersion', 'namespace', 'sessionId', 'branchId', 'preparationId', 'receiptGeneration', 'refs',
    'credentialSha256', 'preparation', 'status', 'source', 'attemptGeneration'],
  ['attempt', 'checkpoint', 'terminalRequired', 'stop', 'transition', 'unclaimedRefusal'])
  validateRefs(value.refs, sid)
  if (value.schemaVersion !== 2 || value.namespace !== NAMESPACE || value.sessionId !== sid || value.branchId !== sid
    || !id(value.preparationId) || !integer(value.receiptGeneration, 1) || !integer(value.attemptGeneration)
    || !['created', 'active', 'stopped', 'unknown'].includes(String(value.status))
    || (value.terminalRequired !== undefined && value.terminalRequired !== true)) fail('WORK_IDENTITY_INVALID')
  if (!object(value.source) || !['story', 'management', 'legacy'].includes(String(value.source.kind))
    || !hash(value.source.sourceSha256)) fail('WORK_SOURCE_INVALID')
  const identity = {schemaVersion: 2, namespace: NAMESPACE, sessionId: sid, branchId: sid,
    preparationId: value.preparationId, receiptGeneration: value.receiptGeneration, refs: value.refs,
    ...(value.terminalRequired ? {terminalRequired: true} : {})}
  if (!hash(value.credentialSha256) || value.credentialSha256 !== recordSha256(identity)
    || !same(value.preparation, {schemaVersion: 1, namespace: NAMESPACE,
      preparationKeySha256: recordSha256({sessionId: sid, preparationId: value.preparationId}),
      credentialSha256: value.credentialSha256})) fail('WORK_CREDENTIAL_INVALID')
  if (value.attempt !== undefined) {
    exact(value.attempt, ['turn', 'step', 'prepared'], ['legacyPreparationId', 'snapshot'])
    if (!integer(value.attempt.turn) || !integer(value.attempt.step, 1) || typeof value.attempt.prepared !== 'boolean') {
      fail('WORK_ATTEMPT_INVALID')
    }
  }
  return value as unknown as Work
}
function numerical(work: Work): boolean {
  return work.terminalRequired === true || work.source?.kind === 'story' && !!work.source.headRef
}
function currency(work: Work): InputPreparationCurrency {
  return {schemaVersion: 2, preparationId: work.preparationId, credentialSha256: work.credentialSha256,
    receiptGeneration: work.receiptGeneration, attemptGeneration: work.attemptGeneration, source: structuredClone(work.source),
    ...(work.attempt?.snapshot ? {snapshot: structuredClone(work.attempt.snapshot)} : {})}
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {for (const child of Object.values(value)) freeze(child); Object.freeze(value)}
  return value
}

/** Strict packet/ref joins are consumer validation. The actual cut, projection,
 * immutable predecessor Source and table-read provenance remain Root-owned. */
export function validateProgramDerivedOpeningClosureV1(input:unknown,suppliedGenesis:VerifiedMvuProgramGenesis,
  suppliedNative:ProgramOpeningNativeFactsV1):ProgramDerivedOpeningClosureV1 {
  const closure=cloneProgramGenesisDataV1(input),
    genesis=validateProgramMvuGenesisFactsV1(suppliedGenesis.programEvent,suppliedGenesis.programHead)
  exact(closure,['schemaVersion','encoding','authority','kind','data','closureSha256'])
  const {closureSha256,...body}=closure
  if(closure.schemaVersion!==1||closure.encoding!=='native-program-derived-opening-closure-v1'
    ||closure.authority!=='consumer-data-only'||closure.kind!=='program-opening'
    ||!hash(closureSha256)||recordSha256(body)!==closureSha256||!same(genesis,suppliedGenesis))
    fail('PREFIX_PROGRAM_CLOSURE_INVALID')
  exact(closure.data,['seed','input','planRecord','intent','refs','genesisEventRef','genesisHeadRef'])
  const packet=closure.data,seed=validateProgramOpeningSeedV1(packet.seed),
    sourceInput=validateProgramOpeningInputV1(packet.input,seed),
    planRecord=validateProgramOpeningPlanRecordV1(packet.planRecord,seed,sourceInput),
    context={seed,input:sourceInput,planRecord,
      genesis:{programEvent:genesis.programEvent,programHead:genesis.programHead}},
    intent=validateOpeningIntentV7(packet.intent,context),
    native=validateProgramOpeningNativeFactsV1(suppliedNative,seed,sourceInput),sid=genesis.sessionId
  exact(packet.refs,['seed','input','plan','intent'])
  const records=[['seed',seed,programOpeningSeedKeyV1(sid,seed.operationId)],
    ['input',sourceInput,programOpeningInputKeyV1(sid,seed.operationId)],
    ['plan',planRecord,programOpeningPlanKeyV1(sid,seed.operationId)],
    ['intent',intent,openingIntentKey(sid,seed.source.importId)]] as const
  for(const [name,value,key] of records) {
    const ref=packet.refs[name]
    exact(ref,['key','sha256'])
    if(ref.key!==key||ref.sha256!==recordSha256(value))fail('PREFIX_PROGRAM_PACKET_REF_CHANGED')
  }
  for(const [ref,value,key] of [
    [packet.genesisEventRef,genesis.programEvent,mvuInitializationEventKey(sid,genesis.programEvent.eventId)],
    [packet.genesisHeadRef,genesis.programHead,mvuInitializationHeadKey(sid)]] as const) {
    exact(ref,['key','sha256'])
    if(ref.key!==key||ref.sha256!==recordSha256(value))fail('PREFIX_PROGRAM_GENESIS_REF_CHANGED')
  }
  if(intent.status!=='completed'||!intent.nativeReceipt||!intent.genesisEnvelope
    ||seed.sessionId!==sid||sourceInput.numericalSourceSha256!==genesis.sourceSha256
    ||!same(planRecord.plan,genesis.programEvent.plan)||!same(intent.nativeReceipt,native)
    ||!same(intent.genesisEnvelope,genesis.programEvent.native))fail('PREFIX_PROGRAM_OPENING_UNCLOSED')
  validateProgramOpeningGenesisEnvelopeV1(genesis.programEvent.native,native,context)
  return closure as unknown as ProgramDerivedOpeningClosureV1
}
/** Root may seal its actual read packet; this constructor grants no current
 * Source/cut, original-row provenance, dispatch or publication permission. */
export function createProgramDerivedOpeningClosureV1(data:ProgramDerivedOpeningClosureDataV1,
  genesis:VerifiedMvuProgramGenesis,native:ProgramOpeningNativeFactsV1):ProgramDerivedOpeningClosureV1 {
  const packet=cloneProgramGenesisDataV1(data)
  const body={schemaVersion:1 as const,encoding:'native-program-derived-opening-closure-v1' as const,
    authority:'consumer-data-only' as const,kind:'program-opening' as const,data:packet}
  return validateProgramDerivedOpeningClosureV1({...body,closureSha256:recordSha256(body)},genesis,native)
}
export function programDerivedGenesisSnapshotV1(supplied:VerifiedMvuProgramGenesis):MvuNumericalSnapshot {
  const genesis=validateProgramMvuGenesisFactsV1(supplied.programEvent,supplied.programHead)
  if(!same(genesis,supplied))fail('PREFIX_PROGRAM_GENESIS_INVALID')
  const event=genesis.programEvent,head=genesis.programHead,
    root={schemaVersion:1 as const,encoding:'native-program-mvu-state-root-v1' as const,
      programEventId:event.eventId,programEventSha256:event.eventSha256,
      programHeadSha256:recordSha256(head),planSha256:event.plan.planSha256},
    body={schemaVersion:1 as const,encoding:'native-mvu-state-snapshot-v1' as const,
      sessionId:genesis.sessionId,sourceSha256:genesis.sourceSha256,root,currentHead:head,revision:1,
      headSha256:recordSha256(head),values:event.finalValues,valuesSha256:event.valuesSha256}
  return cloneProgramGenesisDataV1({...body,stateSnapshotSha256:recordSha256(body)})
}
export const programDerivedOpeningFloorSeqV1=(native:ProgramOpeningNativeFactsV1)=>
  native.production==='selected-card-copy'?native.receipt.turnEndSeq:native.receipt.turnEndRef.seq

export function createRoleplayMvuPrefixLedger(deps: MvuPrefixLedgerDeps) {
  type Captured={kind:'ready';proof:MvuPrefixLedgerProof;facts?:MvuPromptPrefixNumericalFactsV1}
    |Extract<MvuPrefixLedgerResult,{kind:'blocked'}>
  /** The collection mode is private. Neither public entry point accepts a
   * callback sink, partial-read flag or Native-verification exemption. */
  function captureCore(request: MvuPrefixLedgerRequest,collect:boolean):Captured {
    try {
      inspect(request, 16_777_216)
      exact(request, ['ownerSessionId', 'ownerInheritedEventCount', 'events', 'sourceSha256', 'genesis'],
        ['programOpening','successorSourcePreparedRef'])
      const sid = request.ownerSessionId, cut = request.events.length
      if (!id(sid) || !hash(request.sourceSha256) || !integer(request.ownerInheritedEventCount)
        || !Array.isArray(request.events) || cut > 100_000 || request.ownerInheritedEventCount > cut
        || request.events.some((event, index) => event.seq !== index || typeof event.type !== 'string')) fail('PREFIX_REQUEST_INVALID')
      snapshotValid(request.genesis, sid, request.sourceSha256)
      if (request.genesis.revision !== 1) fail('GENESIS_REQUIRED')
      let programRead:Extract<ProgramDerivedOpeningAtCutReadV1,{kind:'verified-program-opening'}>|undefined,
        programClosure:ProgramDerivedOpeningClosureV1|undefined,programFloor=-1
      const programRoot='encoding' in request.genesis.root
        &&request.genesis.root.encoding==='native-program-mvu-state-root-v1'
      if(programRoot) {
        if(!request.programOpening||typeof deps.readProgramGenesisAtCut!=='function')
          fail('PREFIX_PROGRAM_GENESIS_READER_REQUIRED')
        exact(request.programOpening,['genesis','closure','native'])
        const opening=request.programOpening,result=deps.readProgramGenesisAtCut({genesis:opening.genesis,
          ownerSessionId:sid,ownerInheritedEventCount:request.ownerInheritedEventCount,events:request.events,
          ...request.successorSourcePreparedRef?{successorSourcePreparedRef:request.successorSourcePreparedRef}:{}})
        if(result.kind==='blocked')fail(result.code)
        if(result.kind!=='verified-program-opening'||typeof result.assertCurrent!=='function')
          fail('PREFIX_PROGRAM_GENESIS_READER_UNPROVEN')
        result.assertCurrent()
        programClosure=validateProgramDerivedOpeningClosureV1(result.closure,opening.genesis,result.native)
        if(!same(programClosure,opening.closure)||!same(result.native,opening.native)
          ||opening.genesis.sessionId!==sid||opening.genesis.sourceSha256!==request.sourceSha256
          ||!same(programDerivedGenesisSnapshotV1(opening.genesis),request.genesis))
          fail('PREFIX_PROGRAM_GENESIS_CHANGED')
        programFloor=programDerivedOpeningFloorSeqV1(result.native)
        if(!integer(programFloor)||programFloor<request.ownerInheritedEventCount||programFloor>=cut)
          fail('PREFIX_PROGRAM_GENESIS_OUTSIDE_CUT')
        programRead=result
      }else if(request.programOpening||request.successorSourcePreparedRef)fail('PREFIX_PROGRAM_ROOT_INVALID')
      const factStories:MvuPromptValidatedStoryInputV1[]=[],factManuals:MvuPromptValidatedManualInputV1[]=[]
      const factRows:MvuPromptRowRefV1[]=[]
      const factRef=(table:'branch'|'status',row:MvuPrefixLedgerRowRef)=>{
        factRows.push({table,key:row.key,recordSha256:row.sha256})
      }
      const completed=(proof:MvuPrefixLedgerProof):Captured=>{
        programRead?.assertCurrent()
        return collect?{kind:'ready',proof,
          facts:formatPrefixMvuPromptFactsV1({proof,genesis:request.genesis,
            stories:factStories,manuals:factManuals,rows:factRows})}:{kind:'ready',proof}
      }
      const branchRows = new Map<string, unknown>(), statusRows = new Map<string, unknown>()
      const read = (table: MvuPrefixLedgerTable, rowKey: string, observed?: unknown): unknown => {
        if (!pathKey(rowKey) || !rowKey.startsWith(`${sid}__`)) fail('LEDGER_KEY_INVALID')
        const value = table.get(rowKey)
        inspect(value)
        if (observed !== undefined && !same(value, observed)) fail('LEDGER_READBACK_CHANGED')
        return value
      }
      if(programClosure&&request.programOpening) {
        // Root selects actual first-owner or archived predecessor records.
        // Never replace that closed packet with today's ancestor table rows.
        // The v4 preparation and closure request hash bind the complete packet.
        const {data}=programClosure
        if(collect)for(const [table,ref] of [
          ['branch',data.refs.seed],['branch',data.refs.input],['branch',data.refs.plan],['branch',data.refs.intent],
          ['status',data.genesisEventRef],['status',data.genesisHeadRef]] as const)factRef(table,ref)
      }
      for (const [rowKey, row] of deps.branch.entries()) {
        if (!rowKey.startsWith(ownPrefix(sid)) && !rowKey.startsWith(`${sid}__mvu-player-operation-`)
          && !rowKey.startsWith(`${sid}__mvu-player-complete-`)) continue
        if (branchRows.size >= MVU_STATE_BOUNDS.records) fail('LEDGER_BUDGET')
        branchRows.set(rowKey, read(deps.branch, rowKey, row))
      }
      for (const [rowKey, row] of deps.status.entries()) {
        if (!rowKey.startsWith(`${sid}__mvu-state-event-`) && !rowKey.startsWith(`${sid}__mvu-state-settlement-`)) continue
        if (statusRows.size >= MVU_STATE_BOUNDS.records) fail('LEDGER_BUDGET')
        statusRows.set(rowKey, read(deps.status, rowKey, row))
      }
      // Classification uses actual queue removals and actual Native starts.
      // Ref insertion alone is insufficient: pending target input can be inside
      // the cut although the parent's later claim/start is strictly outside it.
      const queues: Record<'next-turn' | 'next-step', {insertSeq: number; messageId: string}[]> = {'next-turn': [], 'next-step': []}
      const claimed = new Set<string>(), starts: {seq: number; link: Record<string, unknown>}[] = []
      for (const event of request.events) {
        if (event.type === 'agent/inbox/spliced') {
          const row = event.data
          if (!object(row) || (row.target !== 'next-turn' && row.target !== 'next-step') || !integer(row.start)
            || !integer(row.removedCount ?? 0) || !Array.isArray(row.inserted)) fail('PREFIX_QUEUE_INVALID')
          const queue = queues[row.target], count = Number(row.removedCount ?? 0)
          if (row.start > queue.length || row.start + count > queue.length
            || (row.outcome !== undefined && row.outcome !== 'canceled')) fail('PREFIX_QUEUE_INVALID')
          const inserted = row.inserted.map(message => {
            if (!object(message) || typeof message.id !== 'string' || !message.id.length) fail('PREFIX_QUEUE_INVALID')
            return {insertSeq: event.seq, messageId: message.id}
          })
          // Full queue replay retains inherited entries, but only a removal and
          // insertion in this owner's actual owned interval can select its work.
          // An ancestor claim or an inherited pending ref grants no child rights.
          if (row.outcome !== 'canceled' && event.seq >= request.ownerInheritedEventCount) {
            for (const ref of queue.slice(row.start, row.start + count)) {
              if (ref.insertSeq >= request.ownerInheritedEventCount) claimed.add(refKey(ref))
            }
          }
          queue.splice(row.start, count, ...inserted)
          const ids = [...queues['next-turn'], ...queues['next-step']].map(ref => ref.messageId)
          if (new Set(ids).size !== ids.length) fail('PREFIX_QUEUE_INVALID')
        } else if (event.type === 'turn/start' && object(event.data) && object(event.data.nativeInputLink)) {
          const link = event.data.nativeInputLink
          if (event.seq >= request.ownerInheritedEventCount && object(link.preparation)
            && link.preparation.namespace === NAMESPACE) starts.push({seq: event.seq, link})
        }
      }
      const allWorks: {key: string; work: Work; inside: boolean}[] = []
      for (const [rowKey, raw] of branchRows) {
        if (!rowKey.startsWith(`${ownPrefix(sid)}work-`)) continue
        const work = validateWork(raw, sid)
        if (rowKey !== workKey(sid, work.refs)) fail('WORK_KEY_INVALID')
        const inside = work.refs.some(ref => claimed.has(refKey(ref)))
          || starts.some(start => same(start.link.preparation, work.preparation))
          || !!work.checkpoint && integer(work.checkpoint.startSeq) && work.checkpoint.startSeq < cut
        allWorks.push({key: rowKey, work, inside})
      }
      if(collect)for(const item of allWorks)if(item.inside) {
        factRef('branch',{key:item.key,sha256:recordSha256(item.work)})
      }
      for (const start of starts) {
        const matches = allWorks.filter(({work}) => same(work.preparation, start.link.preparation) && same(work.refs, start.link.refs))
        if (matches.length !== 1) fail('PREFIX_OWNER_WORK_ORPHAN')
      }
      const selected = allWorks.filter(({work, inside}) => inside && numerical(work))
      const preparations = new Set<string>(), selectedRefs = new Set<string>(), seenGenerations = new Set<number>()
      for (const {work} of allWorks.filter(item => item.inside)) {
        if (preparations.has(work.preparationId) || seenGenerations.has(work.receiptGeneration)) fail('PREFIX_WORK_COLLISION')
        preparations.add(work.preparationId); seenGenerations.add(work.receiptGeneration)
        for (const ref of work.refs) {
          if (selectedRefs.has(refKey(ref))) fail('PREFIX_WORK_COLLISION')
          selectedRefs.add(refKey(ref))
        }
      }
      const closed: {key: string; work: Work; terminal: InputCompletionRecord}[] = []
      for (const {key: rowKey, work} of selected) {
        const raw = read(deps.branch, terminalKey(sid, work.preparationId))
        if (!object(raw)) fail('PREFIX_NUMERICAL_UNRESOLVED')
        exact(raw, ['schemaVersion', 'encoding', 'sessionId', 'scope', 'plan', 'status', 'recordSha256'], ['settlement', 'code'])
        const {recordSha256: checksum, ...body} = raw
        const versioned=raw.schemaVersion===1&&raw.encoding==='roleplay-input-completion-v1'
          ||raw.schemaVersion===3&&raw.encoding==='roleplay-input-completion-v3'
        if (!versioned || raw.sessionId !== sid
          || raw.status !== 'settled' || raw.code !== undefined || !hash(checksum) || checksum !== recordSha256(body)
          || !object(raw.plan) || raw.plan.kind !== 'numerical') fail('PREFIX_NUMERICAL_UNRESOLVED')
        const terminal = raw as unknown as InputCompletionRecord
        if (!integer(terminal.scope?.receipt?.turnEndSeq) || terminal.scope.receipt.turnEndSeq >= cut) fail('PREFIX_NUMERICAL_UNRESOLVED')
        closed.push({key: rowKey, work, terminal})
      }
      // Terminal/state records inside the cut cannot disappear from the chain
      // merely because the original owner Work row is missing or reclassified.
      for (const [rowKey, raw] of branchRows) {
        if (!rowKey.startsWith(`${ownPrefix(sid)}terminal-`) || !object(raw) || !object(raw.plan)
          || raw.plan.kind !== 'numerical') continue
        const scope = raw.scope
        if (!object(scope) || !object(scope.receipt) || !integer(scope.receipt.turnEndSeq)) fail('TERMINAL_SCOPE_INVALID')
        if (scope.receipt.turnEndSeq < cut && !closed.some(item => terminalKey(sid, item.work.preparationId) === rowKey)) {
          fail('PREFIX_NUMERICAL_ORPHAN')
        }
      }
      const players: ReturnType<typeof readMvuPlayerOperationFacts>[] = []
      for (const event of request.events) {
        if (event.type !== MVU_PLAYER_EDIT_EVENT || event.seq < request.ownerInheritedEventCount) continue
        if (!deps.verifyManualSettlementFacts) fail('PREFIX_MANUAL_PROTOCOL_UNPROVEN')
        const marker = event as SessionEvent
        let facts: ReturnType<typeof readMvuPlayerOperationFacts>
        try {
          assertMvuPlayerEditEvent(marker)
          facts = readMvuPlayerOperationFacts({branch: deps.branch, status: deps.status,
            events: request.events as readonly SessionEvent[], sessionId: sid, sourceSha256: request.sourceSha256,
            marker, verifySettlementFacts: deps.verifyManualSettlementFacts})
        } catch (error) {
          // Preserve the maintained protocol's explicit refusal; never fall back
          // to the current head or treat an unproved marker as a no-op.
          fail(error instanceof Error && /^MVU_PLAYER_[A-Z_]+$/.test(error.message)
            ? error.message : 'PREFIX_MANUAL_UNPROVEN')
        }
        const operationKey = mvuPlayerOperationKey(sid, facts.operation.operationId)
        const completionKey = mvuPlayerCompletionKey(sid, facts.operation.operationId)
        if (!branchRows.has(operationKey) || !branchRows.has(completionKey)) fail('PREFIX_MANUAL_ORPHAN')
        read(deps.branch, operationKey, facts.operation)
        read(deps.branch, completionKey, facts.completion)
        if (!same(branchRows.get(operationKey), facts.operation) || !same(branchRows.get(completionKey), facts.completion)) {
          fail('LEDGER_READBACK_CHANGED')
        }
        players.push(facts)
      }
      for (const raw of statusRows.values()) {
        if (object(raw) && object(raw.intent) && raw.intent.encoding === 'native-mvu-player-state-intent-v1') {
          if (!object(raw.intent.marker) || !integer(raw.intent.marker.seq)) fail('STATE_LEDGER_INVALID')
          if (raw.intent.marker.seq < cut && !players.some(item => same(item.intent, raw.intent))) {
            fail('PREFIX_MANUAL_ORPHAN')
          }
          continue
        }
        if (!object(raw) || !object(raw.intent) || !object(raw.intent.canonical) || !integer(raw.intent.canonical.seq)) {
          fail('STATE_LEDGER_INVALID')
        }
        if (raw.intent.canonical.seq < cut && !closed.some(item => item.terminal.plan.kind === 'numerical'
          && same(item.terminal.plan.intent, raw.intent))) fail('PREFIX_NUMERICAL_ORPHAN')
      }
      closed.sort((a, b) => a.terminal.scope.receipt.turnEndSeq - b.terminal.scope.receipt.turnEndSeq)
      let current = structuredClone(request.genesis), previousEnd = -1
      const steps: MvuPrefixLedgerStep[] = []
      const mixedSteps: MvuPrefixLedgerStepV2[] = []
      const timeline = [
        ...closed.map(item => ({kind: 'story' as const, seq: item.terminal.scope.receipt.turnEndSeq, item})),
        ...players.map(item => ({kind: 'player' as const, seq: item.intent.marker.seq, item})),
      ].sort((a, b) => a.seq - b.seq)
      let previousSeq = -1
      for (const entry of timeline) {
        if (entry.seq <= previousSeq) fail('PREFIX_TIMELINE_COLLISION')
        previousSeq = entry.seq
        // Program revision one already includes its one sealed opening-body
        // settlement. A later story/manual consumer must start after that turn.
        if(programRead&&(entry.seq<=programFloor||entry.kind==='story'
          &&entry.item.terminal.scope.receipt.checkpoint.startSeq<=programFloor))
          fail('PREFIX_PROGRAM_GENESIS_REPLAY_REFUSED')
        if (entry.kind === 'player') {
          const {operation, completion, intent, base, settlement, result} = entry.item
          snapshotValid(base, sid, request.sourceSha256)
          snapshotValid(result, sid, request.sourceSha256)
          if (!same(base, current)) fail('PREFIX_CHAIN_DISCONTINUOUS')
          const settlementKey = mvuStateSettlementKey(sid, intent.intentSha256)
          const storedSettlement = read(deps.status, settlementKey, settlement)
          if (!statusRows.has(settlementKey) || !same(statusRows.get(settlementKey), settlement)) fail('PREFIX_MANUAL_ORPHAN')
          const step: MvuPrefixLedgerPlayerStep = {kind: 'player', operationId: operation.operationId,
            marker: structuredClone(intent.marker), intentSha256: intent.intentSha256,
            operation: {key: mvuPlayerOperationKey(sid, operation.operationId), sha256: recordSha256(operation)},
            completion: {key: mvuPlayerCompletionKey(sid, operation.operationId), sha256: recordSha256(completion)},
            settlement: {key: settlementKey, sha256: recordSha256(storedSettlement)},
            baseSnapshotSha256: base.stateSnapshotSha256, resultSnapshotSha256: result.stateSnapshotSha256}
          if (settlement.result.event) {
            const eventKey = mvuStateEventKey(sid, intent.intentSha256), event = read(deps.status, eventKey)
            if (!object(event) || settlement.result.event.key !== eventKey
              || settlement.result.event.sha256 !== event.eventSha256 || !same(statusRows.get(eventKey), event)) {
              fail('NUMERICAL_EVENT_UNPROVEN')
            }
            step.event = {key: eventKey, sha256: recordSha256(event)}
          }
          if(collect) {
            factManuals.push({settlement,base,result,ledgerStep:step})
            factRef('branch',step.operation);factRef('branch',step.completion);factRef('status',step.settlement)
            if(step.event)factRef('status',step.event)
          }
          mixedSteps.push(step); current = result
          continue
        }
        const item = entry.item
        const {work, terminal} = item, scope = terminal.scope
        if (terminal.plan.kind !== 'numerical') fail('TERMINAL_PLAN_INVALID')
        const {intent, base, proposal} = terminal.plan
        if(terminal.schemaVersion===1
          ?intent.schemaVersion!==1||intent.encoding!=='native-mvu-state-terminal-intent-v1'
          :intent.schemaVersion!==2||intent.encoding!=='native-mvu-state-terminal-intent-v2')fail('TERMINAL_INTENT_MISMATCH')
        exact(terminal.plan, ['kind', 'intent', 'base', 'proposal'])
        exact(scope, ['currency', 'receipt', 'stopGeneration'])
        exact(scope.currency, ['schemaVersion', 'preparationId', 'credentialSha256', 'receiptGeneration',
          'attemptGeneration', 'source', 'snapshot'])
        if (work.status !== 'active' || work.stop !== undefined || work.transition !== undefined || work.unclaimedRefusal !== undefined
          || work.terminalRequired !== true || work.source.kind !== 'story' || work.source.sourceSha256 !== request.sourceSha256
          || work.source.headRef?.kind !== 'numerical-head' || !work.checkpoint || !work.attempt?.prepared
          || !integer(work.attemptGeneration, 1) || work.attempt.turn !== scope.receipt.checkpoint.actualTurn
          || !same(work.checkpoint, scope.receipt.checkpoint) || !same(work.refs, scope.receipt.checkpoint.refs)
          || !same(currency(work), scope.currency) || !integer(scope.stopGeneration)
          || scope.receipt.turnEndSeq <= previousEnd) fail('TERMINAL_OWNER_MISMATCH')
        previousEnd = scope.receipt.turnEndSeq
        for (const [rowKey, stop] of branchRows) {
          if (!rowKey.startsWith(`${ownPrefix(sid)}stop-`)) continue
          if (!object(stop) || !Array.isArray(stop.refs)) fail('PREFIX_STOP_UNPROVEN')
          if (stop.refs.some(ref => work.refs.some(owned => same(ref, owned)))
            || object(stop.notice) && object(stop.notice.preparation) && same(stop.notice.preparation, work.preparation)) fail('PREFIX_STOPPED_WORK')
        }
        snapshotValid(base, sid, request.sourceSha256)
        if (!same(base, current) || work.source.headRef.sha256 !== base.headSha256) fail('PREFIX_CHAIN_DISCONTINUOUS')
        const snapshotRef = scope.currency.snapshot
        if (!snapshotRef || snapshotRef.key !== `${sid}__task-input-snapshot-${work.preparationId}-${work.attemptGeneration}`
          || !hash(snapshotRef.sha256) || !same(snapshotRef, work.attempt.snapshot)) fail('PREPARATION_SNAPSHOT_INVALID')
        const storedSnapshot = read(deps.branch, snapshotRef.key)
        if (!object(storedSnapshot) || storedSnapshot.schemaVersion !== 1 || storedSnapshot.sessionId !== sid
          || storedSnapshot.branchId !== sid || storedSnapshot.turnId !== scope.receipt.checkpoint.actualTurn
          || recordSha256(storedSnapshot) !== snapshotRef.sha256 || !same(storedSnapshot.numericalState, base)) fail('PREPARATION_SNAPSHOT_INVALID')
        const {snapshot: _ref, ...inputBasis} = scope.currency
        if (!same(storedSnapshot.inputPreparation, inputBasis)) fail('PREPARATION_SNAPSHOT_INVALID')
        const phaseKey = `${sid}__phaseb-${scope.receipt.checkpoint.actualTurn}`, phase = read(deps.branch, phaseKey)
        if (!object(phase) || phase.state !== 'completed' || phase.sessionId !== sid
          || phase.turnId !== scope.receipt.checkpoint.actualTurn || phase.assistantSeq !== intent.canonical.seq) fail('PHASE_BC_UNRESOLVED')
        const canonical = deps.readProjectedCanonical(request.events, scope.receipt.checkpoint.actualTurn)
        if (!canonical) fail('PREFIX_CANONICAL_UNPROVEN')
        inspect(canonical)
        // One actual selection supplies both Native version validation and the
        // deterministic parser. A second callback read must not change the body
        // between the historical receipt check and candidate reconstruction.
        const frozenCanonical = structuredClone(canonical)
        if (!verifyInheritedCompletedFact({ownerSessionId: sid, ownerInheritedEventCount: request.ownerInheritedEventCount,
          events: request.events, receipt: scope.receipt, canonical: intent.canonical},
        {readProjectedCanonical: () => frozenCanonical,editProtocol:deps.editProtocol})) fail('PREFIX_NATIVE_COMPLETION_UNPROVEN')
        const expectedProposal = intent.schemaVersion===1
          ?prepareMvuUpdate(frozenCanonical.narrative,base.values):prepareMvuUpdateV2(frozenCanonical.narrative,base.values)
        const {intentSha256, ...intentBody} = intent
        const {schemaVersion: _schema, encoding: _encoding, sessionId: _sid, sourceSha256: _source, values: _values, ...baseIdentity} = base
        if (expectedProposal.kind === 'rejected' || !same(expectedProposal, proposal) || !hash(intentSha256)
          || recordSha256(intentBody) !== intentSha256 || intent.sessionId !== sid || intent.sourceSha256 !== request.sourceSha256
          || intent.preparationId !== work.preparationId || intent.credentialSha256 !== work.credentialSha256
          || intent.receiptGeneration !== work.receiptGeneration || intent.attemptGeneration !== work.attemptGeneration
          || intent.stopGeneration !== scope.stopGeneration || !same(intent.preparationSnapshot, snapshotRef)
          || intent.completedReceiptSha256 !== recordSha256(scope.receipt) || intent.refsSha256 !== recordSha256(work.refs)
          || !same(intent.base, baseIdentity) || !same(intent.candidate, {kind: proposal.kind, candidateSha256: recordSha256(proposal)})) {
          fail('TERMINAL_INTENT_MISMATCH')
        }
        const storedSettlementKey = mvuStateSettlementKey(sid, intent.intentSha256)
        const storedSettlement = read(deps.status, storedSettlementKey)
        if (!same(storedSettlement, terminal.settlement) || !deps.verifySettlementFacts({intent, base, proposal, settlement: storedSettlement})) {
          fail('NUMERICAL_SETTLEMENT_UNPROVEN')
        }
        const settlement = storedSettlement as MvuStatePublisherSettlement
        const resultValues = proposal.kind === 'prepared' ? proposal.values : base.values
        const resultBody = {schemaVersion: 1 as const, encoding: 'native-mvu-state-snapshot-v1' as const,
          sessionId: sid, sourceSha256: request.sourceSha256, root: base.root, currentHead: settlement.result.head,
          revision: settlement.result.revision, headSha256: settlement.result.headSha256,
          values: structuredClone(resultValues), valuesSha256: settlement.result.valuesSha256}
        const result = {...resultBody, stateSnapshotSha256: recordSha256(resultBody)}
        snapshotValid(result, sid, request.sourceSha256)
        const step: MvuPrefixLedgerStep = {preparationId: work.preparationId, receiptTurnEndSeq: scope.receipt.turnEndSeq,
          scopeSha256: recordSha256(scope), intentSha256: intent.intentSha256,
          work: {key: item.key, sha256: recordSha256(read(deps.branch, item.key, work))},
          terminal: {key: terminalKey(sid, work.preparationId),
            sha256: recordSha256(read(deps.branch, terminalKey(sid, work.preparationId), terminal))},
          snapshot: {key: snapshotRef.key, sha256: snapshotRef.sha256}, phaseB: {key: phaseKey, sha256: recordSha256(phase)},
          settlement: {key: storedSettlementKey, sha256: recordSha256(storedSettlement)},
          baseSnapshotSha256: base.stateSnapshotSha256, resultSnapshotSha256: result.stateSnapshotSha256}
        if (proposal.kind === 'prepared') {
          const eventKey = mvuStateEventKey(sid, intent.intentSha256), event = read(deps.status, eventKey)
          if (!object(event) || settlement.result.event?.key !== eventKey || settlement.result.event.sha256 !== event.eventSha256) {
            fail('NUMERICAL_EVENT_UNPROVEN')
          }
          step.event = {key: eventKey, sha256: recordSha256(event)}
        }
        if(collect) {
          factStories.push({settlement,base,result,ledgerStep:step,frozenCanonical:{seq:frozenCanonical.seq,
            messageId:frozenCanonical.messageId,versionSha256:frozenCanonical.versionSha256,
            narrativeSha256:sha256(frozenCanonical.narrative)}})
          factRef('branch',step.work);factRef('branch',step.terminal);factRef('branch',step.snapshot)
          factRef('branch',step.phaseB);factRef('status',step.settlement)
          if(step.event)factRef('status',step.event)
        }
        steps.push(step); mixedSteps.push({kind: 'story', ...step}); current = result
      }
      if(programClosure&&programRead&&request.programOpening) {
        const body={schemaVersion:3 as const,encoding:'native-program-mvu-prefix-ledger-proof-v3' as const,
          ownerSessionId:sid,ownerInheritedEventCount:request.ownerInheritedEventCount,inheritedPrefixLength:cut,
          historyPrefixSha256:recordSha256(request.events),sourceSha256:request.sourceSha256,
          genesisSnapshotSha256:request.genesis.stateSnapshotSha256,steps:mixedSteps,numericalSnapshot:current,
          programOpening:{closureSha256:programClosure.closureSha256,nativeFactsSha256:programRead.native.factsSha256,
            planSha256:request.programOpening.genesis.programEvent.plan.planSha256,
            genesisEventRef:programClosure.data.genesisEventRef,genesisHeadRef:programClosure.data.genesisHeadRef,
            editFloorSeq:programFloor}}
        return completed(freeze(structuredClone({...body,proofSha256:recordSha256(body)})))
      }
      if (players.length) {
        const body = {schemaVersion: 2 as const, encoding: 'native-mvu-prefix-ledger-proof-v2' as const,
          ownerSessionId: sid, ownerInheritedEventCount: request.ownerInheritedEventCount, inheritedPrefixLength: cut,
          historyPrefixSha256: recordSha256(request.events), sourceSha256: request.sourceSha256,
          genesisSnapshotSha256: request.genesis.stateSnapshotSha256, steps: mixedSteps, numericalSnapshot: current}
        return completed(freeze(structuredClone({...body, proofSha256: recordSha256(body)})))
      }
      const body = {schemaVersion: 1 as const, encoding: 'native-mvu-prefix-ledger-proof-v1' as const,
        ownerSessionId: sid, ownerInheritedEventCount: request.ownerInheritedEventCount, inheritedPrefixLength: cut,
        historyPrefixSha256: recordSha256(request.events), sourceSha256: request.sourceSha256,
        genesisSnapshotSha256: request.genesis.stateSnapshotSha256, steps, numericalSnapshot: current}
      return completed(freeze(structuredClone({...body, proofSha256: recordSha256(body)})))
    } catch (error) {
      return {kind: 'blocked', code: error instanceof LedgerRefusal||error instanceof MvuPromptFactsRefusal
        ?error.code:'PREFIX_LEDGER_UNPROVEN'}
    }
  }
  function capture(request:MvuPrefixLedgerRequest):MvuPrefixLedgerResult {
    const result=captureCore(request,false)
    return result.kind==='ready'?{kind:'ready',proof:result.proof}:result
  }
  function capturePromptFacts(request:MvuPrefixLedgerRequest):MvuPrefixPromptFactsResult {
    const result=captureCore(request,true)
    if(result.kind!=='ready')return result
    return result.facts?{kind:'ready',proof:result.proof,facts:result.facts}
      :{kind:'blocked',code:'PROMPT_NUMERICAL_PREFIX_UNAVAILABLE'}
  }
  const closureRequest=(request:MvuPrefixLedgerRequest)=>({ownerSessionId:request.ownerSessionId,
    ownerInheritedEventCount:request.ownerInheritedEventCount,prefixLength:request.events.length,
    prefixSha256:recordSha256(request.events),sourceSha256:request.sourceSha256,
    genesisSnapshotSha256:request.genesis.stateSnapshotSha256,
    ...request.programOpening?{programOpeningSha256:recordSha256(request.programOpening)}:{},
    ...request.successorSourcePreparedRef?{successorSourcePreparedRefSha256:recordSha256(request.successorSourcePreparedRef)}:{}})
  const enumeratedKey=(table:'branch'|'status',sid:string,key:string)=>table==='branch'
    ?key.startsWith(ownPrefix(sid))||key.startsWith(`${sid}__mvu-player-operation-`)
      ||key.startsWith(`${sid}__mvu-player-complete-`)
    :key.startsWith(`${sid}__mvu-state-event-`)||key.startsWith(`${sid}__mvu-state-settlement-`)
  function validateClosure(input:unknown,request:MvuPrefixLedgerRequest):MvuPrefixInputClosureV1 {
    inspect(request,16_777_216)
    inspect(input,67_108_864)
    exact(input,['schemaVersion','encoding','authority','request','tables','ledgerProofSha256','closureSha256'])
    if(input.schemaVersion!==1||input.encoding!=='native-mvu-prefix-input-closure-v1'
      ||input.authority!=='consumer-data-only'||!hash(input.ledgerProofSha256)||!hash(input.closureSha256)
      ||!same(input.request,closureRequest(request))||!Array.isArray(input.tables)||input.tables.length!==2)
      fail('PREFIX_FROZEN_CLOSURE_INVALID')
    let bytes=0,totalRows=0
    for(const [index,raw] of input.tables.entries()) {
      exact(raw,['table','membership','rows'])
      const table=index===0?'branch':'status'
      if(raw.table!==table||!Array.isArray(raw.membership)||!Array.isArray(raw.rows)
        ||raw.membership.length>MVU_STATE_BOUNDS.records||raw.rows.length>12_288)
        fail('PREFIX_FROZEN_CLOSURE_INVALID')
      const rows=new Map<string,unknown>()
      for(const row of raw.rows) {
        exact(row,['key','exists','sha256','value'])
        if(!pathKey(row.key)||!row.key.startsWith(`${request.ownerSessionId}__`)
          ||typeof row.exists!=='boolean'||rows.has(row.key)
          ||(row.exists?!hash(row.sha256)||row.sha256!==recordSha256(row.value)
            :row.sha256!=='missing'||row.value!==null))
          fail('PREFIX_FROZEN_CLOSURE_INVALID')
        inspect(row.value)
        bytes+=Buffer.byteLength(JSON.stringify(row),'utf8')
        if(++totalRows>16_384||bytes>67_108_864)fail('PREFIX_FROZEN_CLOSURE_BUDGET')
        rows.set(row.key,row)
      }
      const seen=new Set<string>()
      for(const key of raw.membership) {
        const row=rows.get(key) as {exists:boolean}|undefined
        if(!pathKey(key)||!enumeratedKey(table,request.ownerSessionId,key)||seen.has(key)||!row?.exists)
          fail('PREFIX_FROZEN_CLOSURE_INVALID')
        seen.add(key)
      }
    }
    const {closureSha256,...body}=input
    if(recordSha256(body)!==closureSha256)fail('PREFIX_FROZEN_CLOSURE_INVALID')
    return freeze(structuredClone(input)) as unknown as MvuPrefixInputClosureV1
  }
  function captureFrozen(request:MvuPrefixLedgerRequest):MvuPrefixFrozenResult {
    try {
      inspect(request,16_777_216)
      const views=(['branch','status'] as const).map(table=>{
        const live=deps[table],rows=new Map<string,{key:string;exists:boolean;sha256:string;value:unknown}>()
        let membership:readonly string[]|undefined
        const remember=(key:string,value:unknown)=>{
          inspect(value)
          const row={key,exists:value!==undefined,sha256:recordSha256(value),
            value:value===undefined?null:structuredClone(value)},previous=rows.get(key)
          if(previous&&!same(previous,row))fail('LEDGER_READBACK_CHANGED')
          if(!previous&&rows.size>=12_288)fail('PREFIX_FROZEN_CLOSURE_BUDGET')
          rows.set(key,row);return value
        }
        const actualEntries=()=>[...live.entries()].filter(([key])=>enumeratedKey(table,request.ownerSessionId,key))
        const view:MvuPrefixLedgerTable={get:key=>remember(key,live.get(key)),entries:()=>{
          const entries=actualEntries(),keys=entries.map(([key])=>key)
          if(membership&&!same(membership,keys))fail('LEDGER_READBACK_CHANGED')
          membership=keys
          return entries.map(([key,value])=>[key,remember(key,value)] as [string,unknown])
        }}
        return {table,view,rows,readMembership:()=>membership??[],assertCurrent:()=>{
          if(!same(actualEntries().map(([key])=>key),membership??[]))fail('LEDGER_READBACK_CHANGED')
          for(const row of rows.values())if(recordSha256(live.get(row.key))!==row.sha256)fail('LEDGER_READBACK_CHANGED')
        }}
      })
      // This is the unchanged fold over a recording view of actual tables.
      // It captures enumeration and missing reads as well as successful steps.
      const result=createRoleplayMvuPrefixLedger({...deps,branch:views[0]!.view,status:views[1]!.view}).capture(request)
      if(result.kind!=='ready')return result
      const body={schemaVersion:1 as const,encoding:'native-mvu-prefix-input-closure-v1' as const,
        authority:'consumer-data-only' as const,request:closureRequest(request),
        tables:views.map(view=>({table:view.table,membership:view.readMembership(),rows:[...view.rows.values()]})),
        ledgerProofSha256:result.proof.proofSha256}
      const closure=validateClosure({...body,closureSha256:recordSha256(body)},request),
        assertCurrent=()=>{for(const view of views)view.assertCurrent()}
      assertCurrent()
      return {kind:'ready',proof:result.proof,closure,assertCurrent}
    }catch(error) {return {kind:'blocked',code:error instanceof LedgerRefusal?error.code:'PREFIX_FROZEN_CLOSURE_UNPROVEN'}}
  }
  function frozenReader(request:MvuPrefixLedgerRequest,input:unknown) {
    const closure=validateClosure(input,request),views=closure.tables.map(table=>{
      const rows=new Map(table.rows.map(row=>[row.key,row])),view:MvuPrefixLedgerTable={
        get(key) {
          const row=rows.get(key)
          if(!row)fail('PREFIX_FROZEN_READ_UNRECORDED')
          return row.exists?structuredClone(row.value):undefined
        },
        entries:()=>table.membership.map(key=>[key,structuredClone(rows.get(key)!.value)] as [string,unknown]),
      }
      return view
    })
    return {closure,reader:createRoleplayMvuPrefixLedger({...deps,branch:views[0]!,status:views[1]!})}
  }
  function verifyFrozen(request:MvuPrefixLedgerRequest,input:unknown):MvuPrefixLedgerResult {
    try {
      const {closure,reader}=frozenReader(request,input),result=reader.capture(request)
      if(result.kind==='ready'&&result.proof.proofSha256!==closure.ledgerProofSha256)
        fail('PREFIX_FROZEN_FOLD_CHANGED')
      return result
    }catch(error) {return {kind:'blocked',code:error instanceof LedgerRefusal?error.code:'PREFIX_FROZEN_CLOSURE_UNPROVEN'}}
  }
  function verifyFrozenPromptFacts(request:MvuPrefixLedgerRequest,input:unknown):MvuPrefixPromptFactsResult {
    try {
      const {closure,reader}=frozenReader(request,input),result=reader.capturePromptFacts(request)
      if(result.kind==='ready'&&result.proof.proofSha256!==closure.ledgerProofSha256)
        fail('PREFIX_FROZEN_FOLD_CHANGED')
      return result
    }catch(error) {return {kind:'blocked',code:error instanceof LedgerRefusal?error.code:'PREFIX_FROZEN_CLOSURE_UNPROVEN'}}
  }
  return {capture,capturePromptFacts,captureFrozen,verifyFrozen,verifyFrozenPromptFacts}
}
