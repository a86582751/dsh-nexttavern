/** Owned Domain execution facts. Numerical commits never select this history;
 * accepted and completed refused guest steps have the same ordering contract. */
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {recordSha256,stableJson} from './roleplay-data.js'
import {cloneSchemaEnvelopeV4,cloneSchemaValues} from './tavern-mvu-schema-data.js'
import {validateSchemaAuthorProgram} from './roleplay-mvu-schema-executor-types.js'
import {validateSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import {validateCombinedAuthorProgram} from './tavern-author-combined-data.mjs'
import type {AuthorHostEpochV5,AuthorHostDispatchV5,AuthorHostCompletionV5,AuthorHostUnavailableV5}
  from './roleplay-author-host-types-v5.js'
import type {MvuSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {validateSchemaEvaluationInputV2,validateSchemaGuestOutputV2} from './tavern-mvu-schema-runner-v2.js'
import {validateSchemaEvaluationInputV3,validateSchemaGuestOutputV3,
  validateSchemaScopeProgramFrameV3} from './tavern-mvu-schema-runner-v3.js'
import {validateSchemaEvaluationInputV4,validateSchemaGuestOutputV4,
  assertSchemaGuestOutputBindingsV4,validateSchemaScopeProgramFrameV4} from './tavern-mvu-schema-runner-v4.js'
import {validateMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import type {mvuSchemaMarkers}
  from 'dsh-nexttavern-session-format/mvu-schema-marker'
import type {SessionEvent} from '@deepseek-ai/dsh-session'
import type {MvuSchemaProgram,MvuSchemaRunnerIdentity,MvuSchemaRealmLoadFrame,
  MvuSchemaTraceRequestedStep,MvuSchemaTraceEvaluationStep}
  from './tavern-mvu-schema-types.js'
import type {MvuSchemaRealmLoadFrameV2,MvuSchemaTraceRequestedStepV2,MvuSchemaTraceEvaluationStepV2}
  from './tavern-mvu-schema-types-v2.js'
import type {MvuSchemaRealmLoadFrameV3,MvuSchemaTraceRequestedStepV3,MvuSchemaTraceEvaluationStepV3}
  from './tavern-mvu-schema-types-v3.js'
import type {MvuSchemaRealmLoadFrameV4,MvuSchemaTraceRequestedStepV4,MvuSchemaTraceEvaluationStepV4,
  MvuSchemaEvaluationInputV4,MvuSchemaGuestOutputV4}
  from './tavern-mvu-schema-types-v4.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {SchemaRealmLoadFrame,SchemaTraceRequestedStep,SchemaTraceStepRecord,
  SchemaGuestOutput} from './roleplay-mvu-schema-executor-types.js'

export type SchemaExecutionAnchor =
  | {kind:'opening';operationId:string;messageId:string;importId:string;selectedIndex:number}
  | {kind:'story';preparationId:string;attemptGeneration:number;receiptGeneration:number;
    turn:number;canonicalSeq:number;messageId:string;messageVersionSha256:string}
  | {kind:'manual';operationId:string;requestSha256:string;observedNativeSeq:number}
export interface SourceNativeCutFacts {
  schemaVersion:1
  sessionId:string
  ownerSessionId:string
  /** Exclusive prefix length, including zero; seq at the cut is excluded. */
  nativeCut:number
  nativePrefixSha256:string
  sourceSnapshotSha256:string
  materialSha256:string
  stopGeneration:number
  anchor:SchemaExecutionAnchor
}
export interface SchemaJournalRef {key:string;sha256:string}
export interface SchemaNativeMarkerRef {seq:number;sha256:string}
interface Header {schemaVersion:1|2|3|4;sessionId:string;realmEpoch:string;recordSha256:string}
interface EpochBody extends Header {
  runner:MvuSchemaRunnerIdentity
  loadAnchorSha256:string
}
export type LegacySchemaEpochRecord=EpochBody&(
  {schemaVersion:1;encoding:'native-mvu-schema-epoch-v1';loadFrame:MvuSchemaRealmLoadFrame;program:MvuSchemaProgram}
  |{schemaVersion:2;encoding:'native-mvu-schema-epoch-v2';loadFrame:MvuSchemaRealmLoadFrameV2;program:MvuSchemaProgram}
  |{schemaVersion:3;encoding:'native-mvu-schema-epoch-v3';loadFrame:MvuSchemaRealmLoadFrameV3;program:MvuSchemaProgram}
  |{schemaVersion:4;encoding:'native-mvu-schema-epoch-v4';loadFrame:MvuSchemaRealmLoadFrameV4;program:MvuSchemaProgramV4})
export type SchemaEpochRecord=LegacySchemaEpochRecord|AuthorHostEpochV5
interface DispatchBody extends Header {
  batchId:string
  ordinal:number
  epoch:SchemaJournalRef
  previousTailSha256:string
  sourceNativeCut:SourceNativeCutFacts
}
export type LegacySchemaDispatchRecord=DispatchBody&(
  {schemaVersion:1;encoding:'native-mvu-schema-dispatch-v1';requestedStep:MvuSchemaTraceRequestedStep}
  |{schemaVersion:2;encoding:'native-mvu-schema-dispatch-v2';requestedStep:MvuSchemaTraceRequestedStepV2}
  |{schemaVersion:3;encoding:'native-mvu-schema-dispatch-v3';requestedStep:MvuSchemaTraceRequestedStepV3}
  |{schemaVersion:4;encoding:'native-mvu-schema-dispatch-v4';requestedStep:MvuSchemaTraceRequestedStepV4})
export type SchemaDispatchRecord=LegacySchemaDispatchRecord|AuthorHostDispatchV5
interface CompletionBody extends Header {
  batchId:string
  dispatch:SchemaJournalRef
  dispatchMarker:SchemaNativeMarkerRef
  runner:MvuSchemaRunnerIdentity
  /** Full original frame lives once in dispatch, like the runner receipt. */
}
export type LegacySchemaCompletionRecord=CompletionBody&(
  {schemaVersion:1;encoding:'native-mvu-schema-completion-v1';step:MvuSchemaTraceEvaluationStep}
  |{schemaVersion:2;encoding:'native-mvu-schema-completion-v2';step:MvuSchemaTraceEvaluationStepV2}
  |{schemaVersion:3;encoding:'native-mvu-schema-completion-v3';step:MvuSchemaTraceEvaluationStepV3}
  |{schemaVersion:4;encoding:'native-mvu-schema-completion-v4';step:MvuSchemaTraceEvaluationStepV4})
export type SchemaCompletionRecord=LegacySchemaCompletionRecord|AuthorHostCompletionV5
interface UnavailableBody extends Header {
  batchId:string
  dispatch:SchemaJournalRef|null
  sourceNativeCut:SourceNativeCutFacts
  code:string
}
export type LegacySchemaUnavailableRecord=UnavailableBody&(
  {schemaVersion:1;encoding:'native-mvu-schema-unavailable-v1'}
  |{schemaVersion:2;encoding:'native-mvu-schema-unavailable-v2'}
  |{schemaVersion:3;encoding:'native-mvu-schema-unavailable-v3'}
  |{schemaVersion:4;encoding:'native-mvu-schema-unavailable-v4'})
export type SchemaUnavailableRecord=LegacySchemaUnavailableRecord|AuthorHostUnavailableV5
export type SchemaJournalRecord=SchemaEpochRecord|SchemaDispatchRecord|SchemaCompletionRecord|SchemaUnavailableRecord
function isEpoch(row:SchemaJournalRecord):row is SchemaEpochRecord {
  return row.encoding==='native-mvu-schema-epoch-v1'||row.encoding==='native-mvu-schema-epoch-v2'
    ||row.encoding==='native-mvu-schema-epoch-v3'||row.encoding==='native-mvu-schema-epoch-v4'
    ||row.encoding==='native-mvu-schema-epoch-v5'
}
function isDispatch(row:SchemaJournalRecord):row is SchemaDispatchRecord {
  return row.encoding==='native-mvu-schema-dispatch-v1'||row.encoding==='native-mvu-schema-dispatch-v2'
    ||row.encoding==='native-mvu-schema-dispatch-v3'||row.encoding==='native-mvu-schema-dispatch-v4'
    ||row.encoding==='native-mvu-schema-dispatch-v5'
}
function isCompletion(row:SchemaJournalRecord):row is SchemaCompletionRecord {
  return row.encoding==='native-mvu-schema-completion-v1'||row.encoding==='native-mvu-schema-completion-v2'
    ||row.encoding==='native-mvu-schema-completion-v3'||row.encoding==='native-mvu-schema-completion-v4'
    ||row.encoding==='native-mvu-schema-completion-v5'
}
function isUnavailable(row:SchemaJournalRecord):row is SchemaUnavailableRecord {
  return row.encoding==='native-mvu-schema-unavailable-v1'||row.encoding==='native-mvu-schema-unavailable-v2'
    ||row.encoding==='native-mvu-schema-unavailable-v3'||row.encoding==='native-mvu-schema-unavailable-v4'
    ||row.encoding==='native-mvu-schema-unavailable-v5'
}
export interface SchemaJournalRow {key:string;record:SchemaJournalRecord}
export interface SchemaJournalTable {
  get(key:string):unknown
  entries():Iterable<[string,unknown]>
  put(key:string,value:SchemaJournalRecord):Promise<unknown>
}
export interface SchemaJournalFrozenCut {
  schemaVersion:1
  encoding:'native-mvu-schema-frozen-cut-v1'
  sessionId:string
  realmEpoch:string
  nativeCut:number
  nativePrefixSha256:string
  records:readonly SchemaJournalRow[]
  frontierSha256:string
}
export interface SchemaJournalStepFacts {
  dispatch:SchemaDispatchRecord
  completion:SchemaCompletionRecord
  dispatchRef:SchemaJournalRef
  completionRef:SchemaJournalRef
  dispatchMarker:SchemaNativeMarkerRef
  completionMarker:SchemaNativeMarkerRef
  step:SchemaTraceStepRecord
}
export interface LegacySchemaJournalReady {
  kind:'ready'
  epoch:LegacySchemaEpochRecord
  epochRef:SchemaJournalRef
  steps:readonly SchemaJournalStepFacts[]
  tailSha256:string
  frontierSha256:string
  frozen:SchemaJournalFrozenCut
}
export interface AuthorHostJournalReadyV5 extends Omit<LegacySchemaJournalReady,
  'epoch'|'tailSha256'|'frontierSha256'> {
  hostProtocol:5
  epoch:AuthorHostEpochV5
  serverTailSha256:string
  hostFrontierSha256:string
}
export type SchemaJournalReady=LegacySchemaJournalReady|AuthorHostJournalReadyV5
export type SchemaJournalCapture=SchemaJournalReady|{kind:'absent'|'blocked';code:string}
/** Execution projections consume an already validated epoch. Host identity
 * never substitutes for its retained real server program or v4 load frame. */
export function schemaEpochExecution(epoch:SchemaEpochRecord):{
  program:MvuSchemaProgram|MvuSchemaProgramV4;runner:MvuSchemaRunnerIdentity;
  loadFrame:SchemaRealmLoadFrame;loadAnchorSha256:string} {
  return epoch.schemaVersion===5?{program:epoch.program.serverProgram!,runner:epoch.server.executor.runner,
    loadFrame:epoch.server.loadFrame,loadAnchorSha256:epoch.server.loadAnchorSha256}:epoch
}
export function schemaEpochAuthorIdentity(epoch:SchemaEpochRecord):{programSha256:string;sourceSha256:string} {
  return epoch.schemaVersion===5?{programSha256:epoch.program.combinedProgramSha256,
    sourceSha256:epoch.program.original.source.sourceSha256}:
    {programSha256:epoch.program.programSha256,sourceSha256:epoch.program.source.sourceSha256}
}
export function isAuthorHostJournalReadyV5(ready:SchemaJournalReady):ready is AuthorHostJournalReadyV5 {
  return ready.epoch.schemaVersion===5
}
export const schemaJournalServerTailSha256=(ready:SchemaJournalReady)=>
  isAuthorHostJournalReadyV5(ready)?ready.serverTailSha256:ready.tailSha256
export const schemaJournalHostFrontierSha256=(ready:SchemaJournalReady)=>
  isAuthorHostJournalReadyV5(ready)?ready.hostFrontierSha256:ready.frontierSha256
export const SCHEMA_JOURNAL_BOUNDS=Object.freeze({records:512,
  bytes:MVU_SCHEMA_BOUNDS.programBytes+MVU_SCHEMA_BOUNDS.inputBytes+MVU_SCHEMA_BOUNDS.outputBytes+131072})
const bounds={nodes:MVU_SCHEMA_BOUNDS.evaluationNodes,depth:MVU_SCHEMA_BOUNDS.evaluationDepth}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&!Object.is(v,-0)
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'SCHEMA_JOURNAL_UNPROVEN'
function fail(code:string):never {throw Error(code)}
/** Exclusive Native prefixes use the existing recordSha256(array) bytes.
 * Each event is serialized once per snapshot; copies add only the closing
 * bracket. No hash state survives this call or substitutes for actual reads. */
export function schemaNativePrefixSha256(events:readonly unknown[],cuts:readonly number[]):ReadonlyMap<number,string> {
  for(const cut of cuts)if(!integer(cut)||cut>events.length)fail('SCHEMA_NATIVE_CUT_INVALID')
  const selected=new Set([...cuts,events.length])
  const digest=createHash('sha256').update('[','utf8'),prefixes=new Map<number,string>()
  if(selected.has(0))prefixes.set(0,digest.copy().update(']','utf8').digest('hex'))
  for(let index=0;index<events.length;index++) {
    if(index)digest.update(',','utf8')
    // Match stableJson's Array.map/join semantics, including undefined and
    // sparse slots, rather than introducing a second serialization protocol.
    digest.update(index in events?(stableJson(events[index])??''):'','utf8')
    if(selected.has(index+1))prefixes.set(index+1,digest.copy().update(']','utf8').digest('hex'))
  }
  return prefixes
}
function exact(value:object,keys:readonly string[]) {
  if(!same(Object.keys(value).sort(),[...keys].sort()))fail('SCHEMA_JOURNAL_SHAPE')
}
export function freezeSchemaJournalData<T>(input:T):T {
  const value=cloneSchemaEnvelopeV4(input,SCHEMA_JOURNAL_BOUNDS.bytes,bounds)
  function freeze(item:unknown):void {
    if(item&&typeof item==='object'){for(const child of Object.values(item))freeze(child);Object.freeze(item)}
  }
  freeze(value)
  return value
}
export function sealSchemaJournalRecord<T extends {schemaVersion:1|2|3|4|5}>(body:T):T&{recordSha256:string} {
  const frozen=freezeSchemaJournalData(body)
  return Object.freeze({...frozen,recordSha256:recordSha256(frozen)})
}
export function validateSchemaAnchor(input:SchemaExecutionAnchor):void {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('SCHEMA_ANCHOR_INVALID')
  if(input.kind==='opening') {
    exact(input,['kind','operationId','messageId','importId','selectedIndex'])
    if(!id(input.operationId)||!id(input.importId)||!integer(input.selectedIndex)||typeof input.messageId!=='string'||!input.messageId
      ||input.messageId.length>1024)fail('SCHEMA_ANCHOR_INVALID')
  } else if(input.kind==='story') {
    exact(input,['kind','preparationId','attemptGeneration','receiptGeneration','turn','canonicalSeq','messageId','messageVersionSha256'])
    if(!id(input.preparationId)||!integer(input.attemptGeneration,1)||!integer(input.receiptGeneration,1)
      ||!integer(input.turn)||!integer(input.canonicalSeq)||typeof input.messageId!=='string'
      ||!input.messageId.length||input.messageId.length>1024||!hash(input.messageVersionSha256))fail('SCHEMA_ANCHOR_INVALID')
  } else if(input.kind==='manual') {
    exact(input,['kind','operationId','requestSha256','observedNativeSeq'])
    if(!id(input.operationId)||!hash(input.requestSha256)||!integer(input.observedNativeSeq,-1))fail('SCHEMA_ANCHOR_INVALID')
  } else fail('SCHEMA_ANCHOR_INVALID')
}
export function validateSchemaSourceCut(input:SourceNativeCutFacts):SourceNativeCutFacts {
  const value=freezeSchemaJournalData(input)
  exact(value,['schemaVersion','sessionId','ownerSessionId','nativeCut','nativePrefixSha256',
    'sourceSnapshotSha256','materialSha256','stopGeneration','anchor'])
  if(value.schemaVersion!==1||!id(value.sessionId)||!id(value.ownerSessionId)||!integer(value.nativeCut)
    ||!integer(value.stopGeneration)||![value.nativePrefixSha256,value.sourceSnapshotSha256,value.materialSha256].every(hash)) {
    fail('SCHEMA_SOURCE_CUT_INVALID')
  }
  validateSchemaAnchor(value.anchor)
  return value
}
function ref(value:SchemaJournalRef):void {
  exact(value,['key','sha256'])
  if(typeof value.key!=='string'||!/^[A-Za-z0-9_-]{1,512}$/.test(value.key)||!hash(value.sha256))fail('SCHEMA_JOURNAL_REF_INVALID')
}
function markerRef(value:SchemaNativeMarkerRef):void {
  exact(value,['seq','sha256'])
  if(!integer(value.seq)||!hash(value.sha256))fail('SCHEMA_JOURNAL_REF_INVALID')
}
function runnerIdentity(value:MvuSchemaRunnerIdentity):void {
  exact(value,['id','version','implementationSha256','quickjsVersion'])
  if(typeof value.id!=='string'||!/^[A-Za-z0-9._-]{1,128}$/.test(value.id)
    ||!integer(value.version,1)||!hash(value.implementationSha256)||value.quickjsVersion!=='0.32.0') {
    fail('SCHEMA_RUNNER_IDENTITY_INVALID')
  }
}
function scopeBinding(input:unknown,ownerSessionId:string,sourceNativeCutSha256:string):MvuScopeReadFrameV1 {
  const frame=validateMvuScopeReadFrameV1(input)
  if(frame.source.sessionId!==ownerSessionId||frame.sourceNativeCutSha256!==sourceNativeCutSha256) {
    fail('SCHEMA_SCOPE_BINDING_INVALID')
  }
  return frame
}
function loadFrame(value:SchemaRealmLoadFrame,version:1|2|3|4):void {
  exact(value,['schemaVersion','ownerSessionId','sourceNativeCutSha256','material','values','context','clockEpochMs','randomSeed',
    ...(version>=3?['scopeReadFrame']:[])])
  if(value.schemaVersion!==version||!id(value.ownerSessionId)||!hash(value.sourceNativeCutSha256)
    ||!integer(value.clockEpochMs)||typeof value.randomSeed!=='string'||!value.randomSeed.length||value.randomSeed.length>256) {
    fail('SCHEMA_LOAD_FRAME_INVALID')
  }
  cloneSchemaValues(value.values);cloneSchemaValues(value.context)
  if(version!==4)cloneSchemaValues(value.material)
  if(Object.hasOwn(value.context,'stat_data'))fail('SCHEMA_CONTEXT_INVALID')
  if(version>=3) {
    if(value.schemaVersion!==3&&value.schemaVersion!==4)fail('SCHEMA_LOAD_FRAME_INVALID')
    scopeBinding(value.scopeReadFrame,value.ownerSessionId,value.sourceNativeCutSha256)
  }
}
function requested(value:SchemaTraceRequestedStep,version:1|2|3|4):void {
  exact(value,['eventId','frame'])
  if(typeof value.eventId!=='string'||!value.eventId.length||value.eventId.length>256)fail('SCHEMA_STEP_INVALID')
  const frame=value.frame
  exact(frame,['ownerSessionId','sourceNativeCutSha256','material','input'])
  if(!id(frame.ownerSessionId)||!hash(frame.sourceNativeCutSha256))fail('SCHEMA_STEP_INVALID')
  if(version!==4)cloneSchemaValues(frame.material)
  const input=frame.input
  if(version===4) {
    const validated=validateSchemaEvaluationInputV4(input)
    scopeBinding(validated.scopeReadFrame,frame.ownerSessionId,frame.sourceNativeCutSha256)
    return
  }
  if(version===3) {
    const validated=validateSchemaEvaluationInputV3(input)
    scopeBinding(validated.scopeReadFrame,frame.ownerSessionId,frame.sourceNativeCutSha256)
    return
  }
  if(version===2) {
    validateSchemaEvaluationInputV2(input)
    return
  }
  exact(input,['schemaVersion','phase','base','values','commands','context','clockEpochMs','randomSeed'])
  if(input.schemaVersion!==1||!['initialization','command-parsed','commands-parsed','update-ended','manual-replacement'].includes(input.phase)
    ||!Array.isArray(input.commands)||!integer(input.clockEpochMs)||typeof input.randomSeed!=='string'
    ||!input.randomSeed.length||input.randomSeed.length>256)fail('SCHEMA_STEP_INVALID')
  cloneSchemaValues(input.values);cloneSchemaValues(input.context)
  if(input.base!==null)cloneSchemaValues(input.base)
  for(const command of input.commands)cloneSchemaValues(command)
  if(Object.hasOwn(input.context,'stat_data'))fail('SCHEMA_CONTEXT_INVALID')
}
const partialCodes=new Set(['SCHEMA_VM_TIMEOUT','SCHEMA_HARD_TIMEOUT','SCHEMA_JOB_LIMIT','SCHEMA_ASYNC_UNSETTLED',
  'SCHEMA_OUTPUT_LIMIT','SCHEMA_MEMORY_LIMIT','SCHEMA_GUEST_ERROR'])
function output(value:SchemaGuestOutput,version:1|2|3|4):void {
  if(version===4) {
    validateSchemaGuestOutputV4(value)
    if(value.kind==='refused'&&value.diagnostics.some(item=>partialCodes.has(item.code)))fail('SCHEMA_PARTIAL_EXECUTION')
    return
  }
  if(version===3) {
    validateSchemaGuestOutputV3(value)
    if(value.kind==='refused'&&value.diagnostics.some(item=>partialCodes.has(item.code)))fail('SCHEMA_PARTIAL_EXECUTION')
    return
  }
  if(version===2) {
    validateSchemaGuestOutputV2(value)
    if(value.kind==='refused'&&value.diagnostics.some(item=>partialCodes.has(item.code)))fail('SCHEMA_PARTIAL_EXECUTION')
    return
  }
  if(value.kind==='accepted') {
    exact(value,['kind','values','commands','context','registrations'])
    cloneSchemaValues(value.values);cloneSchemaValues(value.context)
    if(!integer(value.registrations,1)||value.registrations>MVU_SCHEMA_BOUNDS.scripts||!Array.isArray(value.commands)
      ||Object.hasOwn(value.context,'stat_data'))fail('SCHEMA_OUTPUT_INVALID')
    for(const command of value.commands)cloneSchemaValues(command)
  } else if(value.kind==='refused') {
    exact(value,['kind','diagnostics'])
    if(!Array.isArray(value.diagnostics)||!value.diagnostics.length||value.diagnostics.length>64)fail('SCHEMA_OUTPUT_INVALID')
    for(const diagnostic of value.diagnostics) {
      exact(diagnostic,['code'])
      if(typeof diagnostic.code!=='string'||!/^SCHEMA_[A-Z_]+$/.test(diagnostic.code)||partialCodes.has(diagnostic.code)) {
        fail('SCHEMA_PARTIAL_EXECUTION')
      }
    }
  } else fail('SCHEMA_OUTPUT_INVALID')
}
/** Only the public wrapper or a raw container's aggregate clone supplies rows.
 * Keep semantic/hash checks intact while avoiding a second whole-row clone. */
function validateClonedSchemaJournalRecord(row:SchemaJournalRecord):SchemaJournalRecord {
  const common=['schemaVersion','encoding','sessionId','realmEpoch','recordSha256']
  if(![1,2,3,4,5].includes(row.schemaVersion)||!id(row.sessionId)||!hash(row.realmEpoch)||!hash(row.recordSha256))fail('SCHEMA_JOURNAL_INVALID')
  const {recordSha256:checksum,...body}=row
  if(recordSha256(body)!==checksum)fail('SCHEMA_JOURNAL_HASH_MISMATCH')
  if(!row.encoding.endsWith(`-v${row.schemaVersion}`))fail('SCHEMA_JOURNAL_VERSION_MISMATCH')
  if(isEpoch(row)) {
    if(row.schemaVersion===5) {
      exact(row,[...common,'host','program','server'])
      exact(row.host,['id','version','implementationSha256'])
      if(row.host.id!=='native-author-host'||row.host.version!==5||!hash(row.host.implementationSha256)) {
        fail('SCHEMA_IMPLEMENTATION_CHANGED')
      }
      const combined=validateCombinedAuthorProgram(row.program),program=combined.serverProgram
      if(!program)fail('SCHEMA_HOST_SERVER_PROGRAM_REQUIRED')
      exact(row.server,['executor','loadFrame','loadAnchorSha256'])
      exact(row.server.executor,['compiler','bridge','libraries','stateLoader','runner'])
      const {runner,...executor}=row.server.executor
      runnerIdentity(runner);loadFrame(row.server.loadFrame,4)
      if(runner.version!==4||!same(executor,{compiler:program.compiler,bridge:program.bridge,
        libraries:program.libraries,stateLoader:program.stateLoader}))fail('SCHEMA_IMPLEMENTATION_CHANGED')
      validateSchemaScopeProgramFrameV4(program,row.server.loadFrame.scopeReadFrame,row.server.loadFrame,true)
      if(row.server.loadFrame.ownerSessionId!==row.sessionId||row.server.loadAnchorSha256!==recordSha256({
        programSha256:program.programSha256,realmEpoch:row.realmEpoch,loadFrame:row.server.loadFrame})) {
        fail('SCHEMA_LOAD_ANCHOR_INVALID')
      }
      return row
    }
    exact(row,[...common,'program','runner','loadFrame','loadAnchorSha256'])
    validateSchemaAuthorProgram(row.program);runnerIdentity(row.runner);loadFrame(row.loadFrame,row.schemaVersion)
    if(row.schemaVersion===4) {
      const program=validateSchemaProgramV4(row.program)
      if(program.compiler.version!==4||program.bridge.version!==4||row.runner.version!==4)fail('SCHEMA_IMPLEMENTATION_CHANGED')
      validateSchemaScopeProgramFrameV4(program,row.loadFrame.scopeReadFrame,row.loadFrame,true)
    }else if(row.program.schemaVersion!==1)fail('SCHEMA_IMPLEMENTATION_CHANGED')
    if(row.schemaVersion===2&&(row.program.compiler.version!==2||row.program.bridge.version!==2||row.runner.version!==2)) {
      fail('SCHEMA_IMPLEMENTATION_CHANGED')
    }
    if(row.schemaVersion===3) {
      if(row.program.compiler.version!==3||row.program.bridge.version!==3||row.runner.version!==3) {
        fail('SCHEMA_IMPLEMENTATION_CHANGED')
      }
      validateSchemaScopeProgramFrameV3(row.program,row.loadFrame.scopeReadFrame,row.loadFrame,true)
    }
    if(row.loadFrame.ownerSessionId!==row.sessionId||row.loadAnchorSha256!==recordSha256({
      programSha256:row.program.programSha256,realmEpoch:row.realmEpoch,loadFrame:row.loadFrame}))fail('SCHEMA_LOAD_ANCHOR_INVALID')
  } else if(isDispatch(row)) {
    exact(row,[...common,'batchId','ordinal','epoch','previousTailSha256','requestedStep','sourceNativeCut',
      ...row.schemaVersion===5?['combinedProgramSha256','serverProgramSha256']:[]])
    if(row.schemaVersion===5&&![row.combinedProgramSha256,row.serverProgramSha256].every(hash)) {
      fail('SCHEMA_DISPATCH_INVALID')
    }
    ref(row.epoch);requested(row.requestedStep,row.schemaVersion===5?4:row.schemaVersion);validateSchemaSourceCut(row.sourceNativeCut)
    if(!id(row.batchId)||!integer(row.ordinal,1)||!hash(row.previousTailSha256)
      ||row.sourceNativeCut.sessionId!==row.sessionId||row.sourceNativeCut.ownerSessionId!==row.sessionId
      ||row.requestedStep.frame.ownerSessionId!==row.sessionId
      ||row.requestedStep.frame.sourceNativeCutSha256!==recordSha256(row.sourceNativeCut)
      ||recordSha256(row.requestedStep.frame.material)!==row.sourceNativeCut.materialSha256)fail('SCHEMA_DISPATCH_INVALID')
    if((row.schemaVersion===3||row.schemaVersion===4||row.schemaVersion===5)
      &&row.requestedStep.frame.input.scopeReadFrame.source.sourceSnapshotSha256!==row.sourceNativeCut.sourceSnapshotSha256) {
      fail('SCHEMA_SCOPE_BINDING_INVALID')
    }
  } else if(isCompletion(row)) {
    exact(row,[...common,'batchId','dispatch','dispatchMarker','runner','step',
      ...row.schemaVersion===5?['combinedProgramSha256','serverProgramSha256']:[]])
    if(row.schemaVersion===5&&![row.combinedProgramSha256,row.serverProgramSha256].every(hash)) {
      fail('SCHEMA_COMPLETION_UNPROVEN')
    }
    ref(row.dispatch);markerRef(row.dispatchMarker)
    runnerIdentity(row.runner)
    if(row.schemaVersion===2&&row.runner.version!==2)fail('SCHEMA_IMPLEMENTATION_CHANGED')
    if(row.schemaVersion===3&&row.runner.version!==3)fail('SCHEMA_IMPLEMENTATION_CHANGED')
    if((row.schemaVersion===4||row.schemaVersion===5)&&row.runner.version!==4)fail('SCHEMA_IMPLEMENTATION_CHANGED')
    if(!id(row.batchId))fail('SCHEMA_JOURNAL_INVALID')
    exact(row.step,['eventId','frameSha256','ordinal','previousStepSha256','output','stepSha256'])
    output(row.step.output,row.schemaVersion===5?4:row.schemaVersion)
    if(typeof row.step.eventId!=='string'||!row.step.eventId.length||row.step.eventId.length>256
      ||!integer(row.step.ordinal,1)||![row.step.previousStepSha256,row.step.frameSha256,row.step.stepSha256].every(hash)) {
      fail('SCHEMA_STEP_INVALID')
    }
  } else if(isUnavailable(row)) {
    exact(row,[...common,'batchId','dispatch','sourceNativeCut','code',
      ...row.schemaVersion===5?['combinedProgramSha256']:[]])
    if(row.schemaVersion===5&&!hash(row.combinedProgramSha256))fail('SCHEMA_UNAVAILABLE_INVALID')
    if(row.dispatch!==null)ref(row.dispatch)
    validateSchemaSourceCut(row.sourceNativeCut)
    if(!id(row.batchId)||row.sourceNativeCut.sessionId!==row.sessionId
      ||typeof row.code!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(row.code))fail('SCHEMA_UNAVAILABLE_INVALID')
    if(row.schemaVersion>=3&&row.sourceNativeCut.ownerSessionId!==row.sessionId)fail('SCHEMA_UNAVAILABLE_INVALID')
  } else fail('SCHEMA_JOURNAL_SHAPE')
  return row
}
export function validateSchemaJournalRecord(input:SchemaJournalRecord):SchemaJournalRecord {
  return validateClonedSchemaJournalRecord(freezeSchemaJournalData(input))
}
export const schemaEpochKey=(sid:string,epoch:string)=>`${sid}__mvu-schema-epoch-${epoch}`
export const schemaDispatchKey=(sid:string,epoch:string,batch:string)=>`${sid}__mvu-schema-dispatch-${epoch}-${batch}`
export const schemaCompletionKey=(sid:string,epoch:string,batch:string)=>`${sid}__mvu-schema-completion-${epoch}-${batch}`
export const schemaUnavailableKey=(sid:string,epoch:string,batch:string)=>`${sid}__mvu-schema-unavailable-${epoch}-${batch}`
export function schemaJournalKey(row:SchemaJournalRecord):string {
  if(isEpoch(row))return schemaEpochKey(row.sessionId,row.realmEpoch)
  if(isDispatch(row))return schemaDispatchKey(row.sessionId,row.realmEpoch,row.batchId)
  if(isCompletion(row))return schemaCompletionKey(row.sessionId,row.realmEpoch,row.batchId)
  return schemaUnavailableKey(row.sessionId,row.realmEpoch,row.batchId)
}
const reference=(row:SchemaJournalRecord):SchemaJournalRef=>({key:schemaJournalKey(row),sha256:row.recordSha256})
/** Call-local immutable row grammar/key/checksum facts from actual owner reads,
 * never Native authority. Raw containers receive their complete DATA parse. */
class CheckedRows {
  private declare checkedRows:void
  constructor(readonly records:readonly SchemaJournalRow[]) {}
}
class BoundedRows {
  private declare boundedRows:void
  constructor(readonly records:readonly SchemaJournalRow[]) {}
}
function captured(markers:typeof mvuSchemaMarkers,sessionId:string,realmEpoch:string,events:readonly SessionEvent[],
  input:CheckedRows|BoundedRows|{records:readonly SchemaJournalRow[]},historical=false,
  recordOwner?:SchemaJournalRecordOwner):SchemaJournalCapture {
  try {
    if(!id(sessionId)||!hash(realmEpoch))fail('SCHEMA_JOURNAL_LIMIT')
    const checked=input instanceof CheckedRows
    const bounded=input instanceof BoundedRows
    const rows=input.records
    // Reject an untrusted container before even observing its length. Normal
    // arrays retain the early record-count limit before the aggregate clone.
    if(types.isProxy(rows))fail('SCHEMA_PROXY_VALUE')
    const length=Object.getOwnPropertyDescriptor(rows,'length')
    if(!length||!Object.hasOwn(length,'value')||typeof length.value!=='number')fail('SCHEMA_NON_JSON_VALUE')
    if(length.value>SCHEMA_JOURNAL_BOUNDS.records)fail('SCHEMA_JOURNAL_LIMIT')
    markers.assertHistory(events)
    const records=checked?Object.freeze(rows):bounded?rows:freezeSchemaJournalData(rows),
      all=new Map<string,SchemaJournalRecord>()
    for(const {key,record} of records) {
      if(!checked)validateClonedSchemaJournalRecord(record)
      if(key!==schemaJournalKey(record)||all.has(key))fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID')
      all.set(key,record)
    }
    const relevant=records.filter(item=>item.record.realmEpoch===realmEpoch)
    const epochs=relevant.filter(item=>isEpoch(item.record))
    const native=events.filter(event=>(event.type===markers.dispatchEventType||event.type===markers.completionEventType)
      &&event.data.realmEpoch===realmEpoch)
    if(!epochs.length&&!relevant.length&&!native.length)return {kind:'absent',code:'SCHEMA_REALM_HISTORY_UNPROVEN'}
    if(epochs.length!==1)fail('SCHEMA_REALM_HISTORY_UNPROVEN')
    const epoch=epochs[0]!.record as SchemaEpochRecord,epochRef=reference(epoch)
    const execution=schemaEpochExecution(epoch),authorIdentity=schemaEpochAuthorIdentity(epoch)
    // The epoch chooses one execution protocol for all its retained frames.
    // A valid checksum cannot permit a dispatch/completion from another wire.
    if(relevant.some(item=>item.record.schemaVersion!==epoch.schemaVersion))fail('SCHEMA_JOURNAL_VERSION_MISMATCH')
    const nativePrefixes=schemaNativePrefixSha256(events,
      native.filter(event=>event.type===markers.dispatchEventType).map(event=>event.seq))
    let tail=execution.loadAnchorSha256
    let pending:Pick<SchemaJournalStepFacts,'dispatch'|'dispatchRef'|'dispatchMarker'>|undefined
    const steps:SchemaJournalStepFacts[]=[],selected=new Set<string>([epochRef.key]),seenEvents=new Set<string>()
    for(const event of native) {
      if(event.type===markers.dispatchEventType) {
        const marker=event.data
        const key=schemaDispatchKey(marker.sessionId,realmEpoch,marker.batchId),row=all.get(key)
        if(!row||!isDispatch(row))fail('SCHEMA_DISPATCH_UNPROVEN')
        if(row.recordSha256!==marker.dispatchRecordSha256||!same(row.epoch,epochRef)||row.ordinal!==steps.length+1
          ||row.previousTailSha256!==tail||marker.previousTailSha256!==tail
          ||marker.programSha256!==authorIdentity.programSha256||marker.sourceSha256!==authorIdentity.sourceSha256
          ||marker.loadDescriptorSha256!==(steps.length===0?epoch.recordSha256:null)
          ||row.sourceNativeCut.nativeCut!==event.seq||row.sourceNativeCut.nativePrefixSha256!==nativePrefixes.get(event.seq)
          ||seenEvents.has(row.requestedStep.eventId))fail('SCHEMA_DISPATCH_UNPROVEN')
        if(steps.length===0&&!same(execution.loadFrame.sourceNativeCutSha256,row.requestedStep.frame.sourceNativeCutSha256)) {
          fail('SCHEMA_LOAD_BOUNDARY_INVALID')
        }
        if(row.schemaVersion===3) {
          if(epoch.schemaVersion!==3)fail('SCHEMA_JOURNAL_VERSION_MISMATCH')
          validateSchemaScopeProgramFrameV3(epoch.program,row.requestedStep.frame.input.scopeReadFrame,row.requestedStep.frame)
        }
        if(row.schemaVersion===4) {
          if(epoch.schemaVersion!==4)fail('SCHEMA_JOURNAL_VERSION_MISMATCH')
          validateSchemaScopeProgramFrameV4(epoch.program,row.requestedStep.frame.input.scopeReadFrame,row.requestedStep.frame)
        }
        if(row.schemaVersion===5) {
          if(epoch.schemaVersion!==5)fail('SCHEMA_JOURNAL_VERSION_MISMATCH')
          if(row.combinedProgramSha256!==epoch.program.combinedProgramSha256
            ||row.serverProgramSha256!==epoch.program.serverProgram!.programSha256)fail('SCHEMA_DISPATCH_UNPROVEN')
          validateSchemaScopeProgramFrameV4(epoch.program.serverProgram!,
            row.requestedStep.frame.input.scopeReadFrame,row.requestedStep.frame)
        }
        seenEvents.add(row.requestedStep.eventId);selected.add(key)
        pending={dispatch:row,dispatchRef:reference(row),dispatchMarker:{seq:event.seq,sha256:recordSha256(event)}}
      } else if(event.type===markers.completionEventType) {
        const marker=event.data,key=schemaCompletionKey(marker.sessionId,realmEpoch,marker.batchId),row=all.get(key)
        if(!pending||!row||!isCompletion(row))fail('SCHEMA_COMPLETION_UNPROVEN')
        if(row.recordSha256!==marker.completionRecordSha256||!same(row.runner,execution.runner)||!same(row.dispatch,pending.dispatchRef)
          ||!same(row.dispatchMarker,pending.dispatchMarker)||marker.dispatchSeq!==pending.dispatchMarker.seq
          ||marker.dispatchRecordSha256!==pending.dispatch.recordSha256||row.step.ordinal!==steps.length+1
          ||row.step.previousStepSha256!==tail||row.step.eventId!==pending.dispatch.requestedStep.eventId
          ||row.step.frameSha256!==(recordOwner?.dispatchFrameSha256?.(pending.dispatch)
            ??recordSha256(pending.dispatch.requestedStep.frame))
          ||marker.completedTailSha256!==row.step.stepSha256)fail('SCHEMA_COMPLETION_UNPROVEN')
        if(row.schemaVersion===5) {
          if(epoch.schemaVersion!==5||row.combinedProgramSha256!==epoch.program.combinedProgramSha256
            ||row.serverProgramSha256!==epoch.program.serverProgram!.programSha256)fail('SCHEMA_COMPLETION_UNPROVEN')
        }
        const {frameSha256:_frameHash,...receipt}=row.step
        const step={...receipt,frame:pending.dispatch.requestedStep.frame} as SchemaTraceStepRecord
        const {stepSha256}=step
        if(epoch.schemaVersion===2) {
          validateSchemaGuestOutputV2(step.output,validateSchemaEvaluationInputV2(pending.dispatch.requestedStep.frame.input))
        }
        if(epoch.schemaVersion===3) {
          validateSchemaGuestOutputV3(step.output,validateSchemaEvaluationInputV3(pending.dispatch.requestedStep.frame.input))
        }
        if(epoch.schemaVersion===4) {
          // Each row was parsed before this fold. The epoch fixes their wire;
          // only the actual program/phase/output relationships remain here.
          assertSchemaGuestOutputBindingsV4(step.output as MvuSchemaGuestOutputV4,epoch.program,
            pending.dispatch.requestedStep.frame.input as MvuSchemaEvaluationInputV4)
        }
        if(epoch.schemaVersion===5) {
          assertSchemaGuestOutputBindingsV4(step.output as MvuSchemaGuestOutputV4,epoch.program.serverProgram!,
            pending.dispatch.requestedStep.frame.input as MvuSchemaEvaluationInputV4)
        }
        if((recordOwner?.fullStepSha256?.(row,pending.dispatch)
          ??schemaJournalFullStepSha256(row,pending.dispatch))!==stepSha256)fail('SCHEMA_COMPLETION_UNPROVEN')
        selected.add(key)
        steps.push({...pending,completion:row,completionRef:reference(row),step,
          completionMarker:{seq:event.seq,sha256:recordSha256(event)}})
        tail=row.step.stepSha256;pending=undefined
      }
    }
    if(pending)fail('SCHEMA_NATIVE_PAIR_PENDING')
    if(steps.length>MVU_SCHEMA_BOUNDS.traceSteps)fail('SCHEMA_JOURNAL_LIMIT')
    for(const {key,record} of relevant)if(!selected.has(key)) {
      if(historical&&isDispatch(record)&&record.sourceNativeCut.nativeCut>=events.length)continue
      if(historical&&isCompletion(record)&&record.dispatchMarker.seq>=events.length)continue
      if(historical&&isUnavailable(record)&&record.sourceNativeCut.nativeCut>=events.length)continue
      fail(isUnavailable(record)?'SCHEMA_EPOCH_UNAVAILABLE':'SCHEMA_DISPATCH_PENDING')
    }
    if(!steps.length)fail('SCHEMA_REALM_HISTORY_UNPROVEN')
    const frontierSha256=schemaJournalFrontierSha256(epochRef,steps)
    const frozen:SchemaJournalFrozenCut={schemaVersion:1,encoding:'native-mvu-schema-frozen-cut-v1',sessionId,realmEpoch,
      nativeCut:events.length,nativePrefixSha256:nativePrefixes.get(events.length)!,
      records:Object.freeze(records.filter(item=>selected.has(item.key))),frontierSha256}
    // Actual owner reads or the public container parse deeply froze these rows.
    // Reuse their immutable frames in facts rather than cloning the same input
    // again into both the steps view and its persisted-cut view.
    for(const step of steps) {
      Object.freeze(step.dispatchRef);Object.freeze(step.completionRef)
      Object.freeze(step.dispatchMarker);Object.freeze(step.completionMarker)
      Object.freeze(step.step);Object.freeze(step)
    }
    const common={kind:'ready' as const,epochRef:Object.freeze(epochRef),steps:Object.freeze(steps),
      frozen:Object.freeze(frozen)}
    if(epoch.schemaVersion===5)return Object.freeze({...common,epoch,hostProtocol:5 as const,
      serverTailSha256:tail,hostFrontierSha256:frontierSha256})
    return Object.freeze({...common,epoch,tailSha256:tail,frontierSha256})
  } catch(error) {return {kind:'blocked',code:codeOf(error)}}
}
/** Pure frontier derivation. Inputs must already be captured journal facts;
 * this hash neither validates a Source/Native cut nor grants publication. */
export function schemaJournalFrontierSha256(epoch:SchemaJournalRef,steps:readonly SchemaJournalStepFacts[]):string {
  return recordSha256({epoch,steps:steps.map(step=>({
    dispatch:step.dispatchRef,completion:step.completionRef,
    dispatchMarker:step.dispatchMarker,completionMarker:step.completionMarker,
    tail:step.completion.step.stepSha256,
  }))})
}
/** Exact stored receipt plus its dispatch frame. This DATA hash neither
 * proves a Native pair nor grants execution or publication permission. */
export function schemaJournalFullStepSha256(completion:SchemaCompletionRecord,dispatch:SchemaDispatchRecord):string {
  const {frameSha256:_frameHash,stepSha256:_stepHash,...receipt}=completion.step
  return recordSha256({...receipt,frame:dispatch.requestedStep.frame})
}
export interface SchemaJournalRecordOwner {
  /** One DATA codec for production inputs and actual stored rows. */
  decode?(input:SchemaJournalRecord):SchemaJournalRecord
  read(key:string,raw:unknown):SchemaJournalRecord|undefined
  /** Derived DATA from this owner's exact parsed row; Native joins stay in capture. */
  dispatchFrameSha256?(record:SchemaDispatchRecord):string|undefined
  fullStepSha256?(completion:SchemaCompletionRecord,dispatch:SchemaDispatchRecord):string|undefined
}
export function createRoleplayMvuSchemaJournal(deps:{table:SchemaJournalTable;markers:typeof mvuSchemaMarkers;
  recordOwner?:SchemaJournalRecordOwner}) {
  function read(key:string):SchemaJournalRecord|undefined {
    // Every consumer must read its own table first. That read registers actual
    // Domain dependencies and can reject a missing address in a closed prefix.
    const row=deps.table.get(key)
    if(deps.recordOwner)return deps.recordOwner.read(key,row)
    if(row===undefined)return
    const record=validateSchemaJournalRecord(row as SchemaJournalRecord)
    if(schemaJournalKey(record)!==key)fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID')
    return record
  }
  function inventory(sessionId:string):readonly SchemaJournalRow[] {
    if(!id(sessionId))fail('SCHEMA_JOURNAL_OWNER_INVALID')
    const rows:SchemaJournalRow[]=[]
    for(const [key] of deps.table.entries())if(key.startsWith(`${sessionId}__mvu-schema-`)) {
      if(rows.length>=SCHEMA_JOURNAL_BOUNDS.records)fail('SCHEMA_JOURNAL_LIMIT')
      const record=read(key)
      if(!record||record.sessionId!==sessionId)fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID')
      rows.push(Object.freeze({key,record}))
    }
    // read owns each immutable record. Enumeration freezes only its new
    // container and retains those checked records for the synchronous fold.
    return Object.freeze(rows)
  }
  async function put(input:SchemaJournalRecord):Promise<SchemaJournalRef> {
    const record=deps.recordOwner?.decode?.(input)??validateSchemaJournalRecord(input)
    return write(record)
  }
  async function write(record:SchemaJournalRecord):Promise<SchemaJournalRef> {
    const key=schemaJournalKey(record),prior=read(key)
    if(prior&&prior.recordSha256!==record.recordSha256)fail('SCHEMA_JOURNAL_WRITE_CONFLICT')
    // A matching existing row has no write or await to confirm. Reuse the
    // validated read; only an actual write needs lost-ACK readback below.
    if(prior)return freezeSchemaJournalData(reference(prior))
    try {await deps.table.put(key,record)}catch { /* Lost ACK is resolved only by exact readback. */ }
    const actual=read(key)
    // read owns the complete grammar, checksum and requested-key membership.
    // Its verified checksum identifies this exact record without a second hash.
    if(!actual||actual.recordSha256!==record.recordSha256)fail('SCHEMA_JOURNAL_WRITE_UNKNOWN')
    return freezeSchemaJournalData(reference(actual))
  }
  function capture(sessionId:string,realmEpoch:string,events:readonly SessionEvent[],
    inherited:SchemaJournalFrozenCut|null=null,historical=false):SchemaJournalCapture {
    try {
      // Historical Source selection consumes this owner's checked inventory.
      // Keep every enumerated row, including duplicates and future rows; the
      // historical fold selects its Native cut without re-parsing those DATA.
      if(historical&&inherited===null)return captured(deps.markers,sessionId,realmEpoch,events,
        new CheckedRows(inventory(sessionId)),true,deps.recordOwner)
      const inheritedRows=inherited?validateFrozen(inherited,events.slice(0,inherited.nativeCut)).records:[]
      const rows=[...inheritedRows]
      for(const row of inventory(sessionId)) {
        const previous=rows.find(item=>item.key===row.key)
        if(previous&&previous.record.recordSha256!==row.record.recordSha256)fail('SCHEMA_JOURNAL_WRITE_CONFLICT')
        if(!previous)rows.push(row)
      }
      // Inherited records passed the public frozen-container parse; local
      // records passed their actual owner reads. Freeze only the merged array.
      return captured(deps.markers,sessionId,realmEpoch,events,
        new CheckedRows(rows),historical,deps.recordOwner)
    } catch(error) {return {kind:'blocked',code:codeOf(error)}}
  }
  function validateFrozenReady(input:SchemaJournalFrozenCut,events:readonly SessionEvent[]):SchemaJournalReady {
    const frozen=freezeSchemaJournalData(input)
    exact(frozen,['schemaVersion','encoding','sessionId','realmEpoch','nativeCut','nativePrefixSha256','records','frontierSha256'])
    if(frozen.schemaVersion!==1||frozen.encoding!=='native-mvu-schema-frozen-cut-v1'||frozen.nativeCut!==events.length
      ||frozen.nativePrefixSha256!==recordSha256(events))fail('SCHEMA_FROZEN_CUT_INVALID')
    const result=captured(deps.markers,frozen.sessionId,frozen.realmEpoch,events,new BoundedRows(frozen.records),true)
    if(result.kind!=='ready'||schemaJournalHostFrontierSha256(result)!==frozen.frontierSha256) {
      fail(result.kind==='blocked'?result.code:'SCHEMA_FROZEN_CUT_INVALID')
    }
    // Capture validates every supplied row before selecting this cut. Expose
    // those same facts so a synchronous caller need not capture the selection
    // again; this is neither cached evidence nor a historical executor proof.
    return result
  }
  function validateFrozen(input:SchemaJournalFrozenCut,events:readonly SessionEvent[]):SchemaJournalFrozenCut {
    return validateFrozenReady(input,events).frozen
  }
  return {put,
    // Replay constructs and seals each production row from its owned inputs.
    // The actual readback owns its grammar; a producer receipt cannot settle it.
    putProduced:write,read,inventory,capture,validateFrozen,validateFrozenReady,
    captureFrozen:(sessionId:string,realmEpoch:string,events:readonly SessionEvent[],rows:readonly SchemaJournalRow[])=>
      captured(deps.markers,sessionId,realmEpoch,events,{records:rows},true)}
}
