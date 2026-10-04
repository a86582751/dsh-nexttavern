/** A child's numerical genesis is a new authority over frozen inherited facts.
 * Native input/terminal capabilities never cross this boundary. Reads cannot
 * publish, ACK, resend input or promote a partial basis after a cold restart. */
import {recordSha256, sha256, textOf} from './roleplay-data.js'
import {eventsOf, canonicalAssistantForTurn} from './roleplay-context.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import {mvuInitializationEventKey, mvuInitializationHeadKey,
  verifyFrozenMvuInitializationFacts} from './roleplay-mvu-initialization.js'
import {createRoleplayMvuLineage} from './roleplay-mvu-lineage.js'
import {createRoleplayMvuFrozenLineage} from './roleplay-mvu-frozen-lineage.js'
import type {MvuDerivedSourceProofUnion,MvuDerivedSourceProofV2,MvuFrozenLineageDeps}
  from './roleplay-mvu-frozen-lineage.js'
import type {TavernSourceFrozenRefV1} from './roleplay-tavern-source-inheritance-types.js'
import {createRoleplayMvuPrefixLedger,validateProgramDerivedOpeningClosureV1,
  programDerivedGenesisSnapshotV1,programDerivedOpeningFloorSeqV1} from './roleplay-mvu-prefix-ledger.js'
export {createProgramDerivedOpeningClosureV1,validateProgramDerivedOpeningClosureV1} from './roleplay-mvu-prefix-ledger.js'
export type {ProgramDerivedOpeningClosureV1,ProgramDerivedOpeningClosureDataV1,
  ProgramDerivedOpeningAtCutRequestV1,ProgramDerivedOpeningAtCutReadV1,ProgramDerivedOpeningAtCutReaderV1}
  from './roleplay-mvu-prefix-ledger.js'
import {formatInheritedMvuPromptFactsV1,formatInheritedMvuPromptFactsV2,
  MvuPromptFactsRefusal} from './roleplay-mvu-prompt-numerical-facts.js'
import type {MvuPromptFactCaptureV1,MvuPromptInheritedNumericalFactsV1,MvuPromptInheritedLayerV1,
  MvuPromptPrefixNumericalFactsV1,MvuPromptValidatedOpeningInputV1,
  MvuPromptValidatedProgramOpeningInputV1,MvuPromptInheritedNumericalFactsV2}
  from './roleplay-mvu-prompt-numerical-facts.js'
import type {MvuLineageDeps, MvuDerivedSourceProof} from './roleplay-mvu-lineage.js'
import type {MvuPrefixLedgerProofV1,MvuPrefixLedgerProofV2,MvuPrefixLedgerProofV3,MvuPrefixInputClosureV1,
  MvuPrefixLedgerResult,MvuPrefixPromptFactsResult,ProgramDerivedOpeningClosureV1,
  ProgramDerivedOpeningAtCutReaderV1} from './roleplay-mvu-prefix-ledger.js'
import type {MvuInheritedPrefixEvent,MvuInheritedMessageEditProtocol} from './roleplay-mvu-prefix-facts.js'
import type {VerifiedMvuGenesis, VerifiedMvuDerivedGenesis, MvuDerivedGenesisEvent,
  MvuDerivedGenesisHead, MvuNumericalSnapshot, MvuStateRoot, createRoleplayMvuState} from './roleplay-mvu-state.js'
import type {ForkOperation, ReadBranchSession, StoryEvent, WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {ForkReservation} from './roleplay-branch-routes-types.js'
import type {VerifiedMvuProgramGenesis} from './roleplay-program-genesis-types.js'
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'

interface Table {get(key:string):unknown; entries():Iterable<[string,unknown]>; put(key:string,value:object):Promise<unknown>}
type Genesis = VerifiedMvuGenesis | VerifiedMvuDerivedGenesis | VerifiedMvuProgramGenesis
type GenesisFact = {kind:'opening';eventKey:string;headKey:string;intentKey:string;intentSha256:string}
  | {kind:'derived';basisKey:string;basisSha256:string}
  | {kind:'program-opening';eventKey:string;headKey:string;closureSha256:string}
interface MvuDerivedPreparedFields {
  operationId:string
  anchorSha256:string
  parentSessionId:string
  childSessionId:string
  seedLength:number
  parentInheritedEventCount:number
  parentSourceSha256:string
  prefixSha256:string
  genesis:Genesis
  genesisFact:GenesisFact
  initial:MvuNumericalSnapshot
  preparedSha256:string
}
export interface MvuDerivedPreparedV1 extends MvuDerivedPreparedFields {
  schemaVersion:1
  encoding:'native-mvu-derived-prepared-v1'
  ledger:MvuPrefixLedgerProofV1
}
export interface MvuDerivedPreparedV2 extends MvuDerivedPreparedFields {
  schemaVersion:2
  encoding:'native-mvu-derived-prepared-v2'
  ledger:MvuPrefixLedgerProofV2
}
export interface MvuDerivedPreparedV3 extends MvuDerivedPreparedFields {
  schemaVersion:3
  encoding:'native-mvu-derived-prepared-v3'
  ledger:MvuPrefixLedgerProofV1|MvuPrefixLedgerProofV2
  sourcePreparedRef:TavernSourceFrozenRefV1
  parentNumericDescriptorSha256:string
  prefixClosureRef:{key:string;sha256:string;closureSha256:string}
  forkReservationBinding:{operationId:string;anchor:ForkOperation['anchor'];reservation:ForkReservation;
    bindingSha256:string}
  genesisClosure:{kind:'opening';intent:Record<string,unknown>;intentSha256:string}
    |{kind:'derived';basisKey:string;basisSha256:string}
}
/** New root family has its own persistent preparation. Older protocols never
 * reinterpret a generated model body as a copied author opening. */
export interface MvuDerivedPreparedV4 extends MvuDerivedPreparedFields {
  schemaVersion:4
  encoding:'native-program-mvu-derived-prepared-v4'
  genesis:VerifiedMvuProgramGenesis
  genesisFact:Extract<GenesisFact,{kind:'program-opening'}>
  ledger:MvuPrefixLedgerProofV3
  sourcePreparedRef:TavernSourceFrozenRefV1
  parentNumericDescriptorSha256:string
  prefixClosureRef:{key:string;sha256:string;closureSha256:string}
  forkReservationBinding:MvuDerivedPreparedV3['forkReservationBinding']
  genesisClosure:ProgramDerivedOpeningClosureV1
}
export type MvuDerivedPrepared = MvuDerivedPreparedV1 | MvuDerivedPreparedV2 | MvuDerivedPreparedV3 | MvuDerivedPreparedV4
export interface MvuDerivedBasisV1 {
  schemaVersion:1
  encoding:'native-mvu-derived-basis-v1'
  prepared:MvuDerivedPreparedV1
  source:MvuDerivedSourceProof
  basisSha256:string
}
export interface MvuDerivedBasisV2 {
  schemaVersion:2
  encoding:'native-mvu-derived-basis-v2'
  prepared:MvuDerivedPreparedV2
  source:MvuDerivedSourceProof
  basisSha256:string
}
export interface MvuDerivedBasisV3 {
  schemaVersion:3
  encoding:'native-mvu-derived-basis-v3'
  prepared:MvuDerivedPreparedV3
  source:MvuDerivedSourceProofV2
  basisSha256:string
}
export interface MvuDerivedBasisV4 {
  schemaVersion:4
  encoding:'native-program-mvu-derived-basis-v4'
  prepared:MvuDerivedPreparedV4
  source:MvuDerivedSourceProofV2
  basisSha256:string
}
export type MvuDerivedBasis = MvuDerivedBasisV1 | MvuDerivedBasisV2 | MvuDerivedBasisV3 | MvuDerivedBasisV4
export interface MvuDerivedDeps extends MvuLineageDeps {
  branch:Table
  status:Table
  session(id:string):ReadBranchSession | undefined
  withSourceLock<T>(sid:string,work:()=>Promise<T>):Promise<T>
  readGenesis(sid:string):Genesis | undefined
  state():ReturnType<typeof createRoleplayMvuState>
  projectPrefix:WorldlineMessageEdits['projectPrefix']
  editProtocol:MvuInheritedMessageEditProtocol
  sourceInheritance?:MvuFrozenLineageDeps['sourceInheritance']
  readSourceDescriptor?:MvuFrozenLineageDeps['readSourceDescriptor']
  readProgramGenesisAtCut?:ProgramDerivedOpeningAtCutReaderV1
}
export const mvuDerivedPreparedKey = (sid:string) => `${sid}__mvu-derived-prepared`
export const mvuDerivedBasisKey = (sid:string) => `${sid}__mvu-derived-basis`
export const mvuDerivedEventKey = (sid:string) => `${sid}__mvu-derived-event`
export const mvuDerivedHeadKey = (sid:string) => `${sid}__mvu-derived-head`
const prefixClosureKey=(sid:string,sha256:string)=>`${sid}__mvu-prefix-closure-v1-${sha256}`
type HistoricalSuccessor=MvuDerivedSourceProofUnion|TavernSourceFrozenRefV1
const same = (a:unknown,b:unknown) => recordSha256(a) === recordSha256(b)
const id = (v:unknown):v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v)
function fail(code:string):never {throw new Error(code)}
function preparedVersion(prepared:MvuDerivedPrepared):boolean {
  if('programEvent' in prepared.genesis)return prepared.schemaVersion===4
    &&prepared.encoding==='native-program-mvu-derived-prepared-v4'
    &&prepared.genesisFact.kind==='program-opening'&&prepared.ledger?.schemaVersion===3
    &&prepared.ledger.encoding==='native-program-mvu-prefix-ledger-proof-v3'
  return prepared.schemaVersion===1&&prepared.encoding==='native-mvu-derived-prepared-v1'
    &&prepared.ledger?.schemaVersion===1&&prepared.ledger.encoding==='native-mvu-prefix-ledger-proof-v1'
    ||prepared.schemaVersion===2&&prepared.encoding==='native-mvu-derived-prepared-v2'
    &&prepared.ledger?.schemaVersion===2&&prepared.ledger.encoding==='native-mvu-prefix-ledger-proof-v2'
    ||prepared.schemaVersion===3&&prepared.encoding==='native-mvu-derived-prepared-v3'
    &&(prepared.ledger?.schemaVersion===1&&prepared.ledger.encoding==='native-mvu-prefix-ledger-proof-v1'
      ||prepared.ledger?.schemaVersion===2&&prepared.ledger.encoding==='native-mvu-prefix-ledger-proof-v2')
}
function basisVersion(basis:MvuDerivedBasis):boolean {
  return preparedVersion(basis.prepared)&&(basis.schemaVersion===1&&basis.encoding==='native-mvu-derived-basis-v1'
    &&basis.prepared.schemaVersion===1||basis.schemaVersion===2&&basis.encoding==='native-mvu-derived-basis-v2'
    &&basis.prepared.schemaVersion===2||basis.schemaVersion===3&&basis.encoding==='native-mvu-derived-basis-v3'
    &&basis.prepared.schemaVersion===3&&basis.source.schemaVersion===2
    ||basis.schemaVersion===4&&basis.encoding==='native-program-mvu-derived-basis-v4'
    &&basis.prepared.schemaVersion===4&&basis.source.schemaVersion===2)
}
function frozenPrepared(prepared:MvuDerivedPrepared):prepared is MvuDerivedPreparedV3|MvuDerivedPreparedV4 {
  return prepared.schemaVersion===3||prepared.schemaVersion===4
}
/** Domain evidence is bounded plain JSON. Inspect before cloning/hashing so a
 * forged descriptor cannot execute accessors or disappear during serialization. */
function data<T>(input:T):T {
  let nodes=0,bytes=0
  const ancestors=new Set<object>()
  function inspect(v:unknown,depth:number):void {
    if(++nodes>192000||depth>80)fail('DERIVED_RECORD_LIMIT')
    if(v===null||typeof v==='boolean')return
    if(typeof v==='string') {bytes+=Buffer.byteLength(v);if(bytes>8*1048576)fail('DERIVED_RECORD_LIMIT');return}
    if(typeof v==='number') {if(!Number.isFinite(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER)fail('DERIVED_RECORD_INVALID');return}
    if(!v||typeof v!=='object'||ancestors.has(v)||Object.getOwnPropertySymbols(v).length)fail('DERIVED_RECORD_INVALID')
    const array=Array.isArray(v),proto=Object.getPrototypeOf(v),descriptors=Object.getOwnPropertyDescriptors(v)
    if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)fail('DERIVED_RECORD_INVALID')
    if(array&&(v.length>32000||Object.keys(descriptors).length!==v.length+1))fail('DERIVED_RECORD_INVALID')
    ancestors.add(v)
    for(const [key,d] of Object.entries(descriptors)) {
      if(array&&key==='length')continue
      if(!d.enumerable||!Object.hasOwn(d,'value')||['constructor','prototype','__proto__'].includes(key)
        ||array&&(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=v.length))fail('DERIVED_RECORD_INVALID')
      bytes+=Buffer.byteLength(key);if(bytes>8*1048576)fail('DERIVED_RECORD_LIMIT')
      inspect(d.value,depth+1)
    }
    ancestors.delete(v)
  }
  inspect(input,0)
  return structuredClone(input)
}
function exact(v:object,keys:readonly string[]):void {
  if(!same(Object.keys(v).sort(),[...keys].sort()))fail('DERIVED_RECORD_INVALID')
}
/** A projection over the actual supplied prefix, with Native surface folding
 * and the maintained edit projection. This is a read view, never an Agent or
 * a source of Native ownership/flush/completion authority. */
export function readMvuPrefixCanonical(events:readonly MvuInheritedPrefixEvent[],turn:number,
  projectPrefix:WorldlineMessageEdits['projectPrefix']) {
  const surface=projectPrefix(events as readonly StoryEvent[])
  const body=canonicalAssistantForTurn({id:'inherited-prefix-projection',events:events as never,
    surface:{nodes:surface.nodes},deriveEventMessage:event => surface.projectedMessageAt(event.seq)},turn)
  const message=body?.data?.message
  return body&&message&&typeof message.id==='string'?{seq:body.seq,messageId:message.id,
    versionSha256:recordSha256(message),narrative:textOf(message.content)}:undefined
}
export function createRoleplayMvuDerived(deps:MvuDerivedDeps) {
  const lineage=createRoleplayMvuLineage(deps)
  const frozenLineage=deps.sourceInheritance&&deps.readSourceDescriptor?createRoleplayMvuFrozenLineage({
    ...deps,sourceInheritance:deps.sourceInheritance,readSourceDescriptor:deps.readSourceDescriptor}):undefined
  const ledger=createRoleplayMvuPrefixLedger({branch:deps.branch,status:deps.status,
    verifySettlementFacts:input => deps.state().verifyConsumedSettlementFacts(input),
    verifyManualSettlementFacts:input => deps.state().verifyConsumedManualSettlementFacts(input),
    readProjectedCanonical:(events,turn)=>readMvuPrefixCanonical(events,turn,deps.projectPrefix),editProtocol:deps.editProtocol,
    ...deps.readProgramGenesisAtCut?{readProgramGenesisAtCut:deps.readProgramGenesisAtCut}:{}})
  type PromptCollection={prefixes:MvuPromptPrefixNumericalFactsV1[];openings:MvuPromptValidatedOpeningInputV1[];
    programOpenings:MvuPromptValidatedProgramOpeningInputV1[];
    layers:MvuPromptInheritedLayerV1[];byPrepared:Map<string,MvuPromptPrefixNumericalFactsV1>;failure?:string}
  const promptCollection=():PromptCollection=>({prefixes:[],openings:[],programOpenings:[],layers:[],byPrepared:new Map()})
  function prefix(session:ReadBranchSession,cut:number) {
    const events=eventsOf(session)
    if(!Number.isSafeInteger(cut)||cut<1||cut>events.length||events.some((e,i)=>e.seq!==i))fail('DERIVED_PREFIX_UNPROVEN')
    return events.slice(0,cut)
  }
  function operationCurrent(prepared:MvuDerivedPrepared) {
    const operation=deps.branch.get(`fork-op-${prepared.operationId}`) as ForkOperation & {
      reservedChildSessionId?:string;state?:string;abortedAt?:number} | undefined
    return !!operation&&operation.operationId===prepared.operationId&&operation.reservedChildSessionId===prepared.childSessionId
      &&operation.state!=='failed'&&operation.state!=='aborted'&&!operation.abortedAt
      &&operation.anchor.sourceSessionId===prepared.parentSessionId&&recordSha256(operation.anchor)===prepared.anchorSha256
      &&operation.anchor.expectedSeedLength===prepared.seedLength
  }
  function openingFact(g:VerifiedMvuGenesis):GenesisFact {
    const event=g.initEvent,owner=event.plan.identity.sessionId,importId=event.plan.identity.source.importId
    const intentKey=openingIntentKey(owner,importId),intent=deps.branch.get(intentKey)
    if(!intent)fail('DERIVED_OPENING_OWNER_UNPROVEN')
    return {kind:'opening',eventKey:mvuInitializationEventKey(owner,event.eventId),
      headKey:mvuInitializationHeadKey(owner),intentKey,intentSha256:recordSha256(intent)}
  }
  function openingCurrent(prepared:MvuDerivedPrepared,input:readonly MvuInheritedPrefixEvent[],prompt?:PromptCollection) {
    const events=input as readonly StoryEvent[]
    const g=prepared.genesis,fact=prepared.genesisFact
    if(!('initEvent' in g)||fact.kind!=='opening')return false
    const event=g.initEvent,identity=event.plan.identity,r=event.native
    if(!verifyFrozenMvuInitializationFacts(event,g.initHead))return false
    const intent=prepared.schemaVersion===3&&prepared.genesisClosure.kind==='opening'
      ?prepared.genesisClosure.intent:deps.branch.get(fact.intentKey) as Record<string,unknown> | undefined
    if(!intent||!same(deps.status.get(fact.eventKey),event)
      ||recordSha256(intent)!==fact.intentSha256||intent.schemaVersion!==4||intent.status!=='completed'
      ||intent.mode!=='native-json'||!same(intent.initialization,event.plan)||!same(intent.nativeReceipt,r)
      ||r.flushed!==true||identity.sessionId!==prepared.parentSessionId||r.sessionId!==identity.sessionId
      ||r.turnStartSeq<prepared.parentInheritedEventCount||r.turnEndSeq>=events.length)return false
    const start=events[r.turnStartSeq],body=events[r.assistantSeq],end=events[r.turnEndSeq]
    const marker={schemaVersion:1,operationId:identity.operationId,messageId:identity.messageId,
      producer:'dsh-nexttavern',origin:`card-opening:${identity.source.importId}`,textSha256:identity.renderedSha256}
    const source={kind:'programmatic',schemaVersion:1,producer:'dsh-nexttavern',
      origin:`card-opening:${identity.source.importId}`,operationId:identity.operationId}
    if(start?.type!=='turn/start'||!same(start.data?.['programmatic'],marker)||start.data?.turn!==r.turn
      ||body?.type!=='assistant/message'||body.data?.turn!==r.turn||body.data?.step!==1
      ||body.data?.message?.id!==identity.messageId||body.data.message.role!=='assistant'
      ||!same(body.data.message.source,source)||!same(body.data.message.content,[{type:'text',text:intent.renderedText}])
      ||sha256(String(intent.renderedText))!==identity.renderedSha256||!same(body.data?.['stream'],[])
      ||recordSha256(body)!==r.messageVersion.eventSha256||end?.type!=='turn/end'
      ||end.data?.turn!==r.turn||!same(end.data?.reason,{kind:'completed'}))return false
    const span=events.slice(start.seq,end.seq+1),stepStart=span.filter(e=>e.type==='step/start'),stepEnd=span.filter(e=>e.type==='step/end')
    if(!(start.seq<stepStart[0]?.seq!&&stepStart[0]?.seq!<body.seq&&body.seq<stepEnd[0]?.seq!&&stepEnd[0]?.seq!<end.seq)
      ||stepStart.length!==1||stepEnd.length!==1||stepStart[0]?.data?.turn!==r.turn||stepEnd[0]?.data?.turn!==r.turn
      ||stepStart[0]?.data?.step!==1||stepEnd[0]?.data?.step!==1
      ||span.filter(e=>e.type==='turn/start').length!==1||span.filter(e=>e.type==='turn/end').length!==1
      ||span.filter(e=>e.type==='assistant/message').length!==1||span.some(e=>!['turn/start','step/start','system/message',
        'assistant/message','step/end','turn/end'].includes(e.type)))return false
    const folded=deps.projectPrefix(events)
    const valid=folded.nodes.includes(body.seq)&&!folded.projectedMessageAt(body.seq)
      &&!events.some(e=>e.type==='roleplay/message-edit'&&e.data?.['targetSeq']===body.seq)
    if(valid&&prompt)prompt.openings.push({genesis:g,snapshot:prepared.initial,
      canonical:{seq:body.seq,messageId:body.data.message.id,versionSha256:recordSha256(body.data.message),
        narrativeSha256:sha256(textOf(body.data.message.content))},nativeEventRecordSha256:recordSha256(body),
      intent:prepared.schemaVersion===3?{table:'branch',key:mvuDerivedPreparedKey(prepared.childSessionId),
        recordSha256:recordSha256(prepared),fieldPointer:'/genesisClosure/intent'}
        :{table:'branch',key:fact.intentKey,recordSha256:fact.intentSha256},
      ...prepared.schemaVersion===3?{historical:{
        event:{table:'branch' as const,key:mvuDerivedPreparedKey(prepared.childSessionId),
          recordSha256:recordSha256(prepared),fieldPointer:'/genesis/initEvent'},
        head:{table:'branch' as const,key:mvuDerivedPreparedKey(prepared.childSessionId),
          recordSha256:recordSha256(prepared),fieldPointer:'/genesis/initHead'}}}:{}})
    return valid
  }
  function readProgramAtCut(genesis:VerifiedMvuProgramGenesis,events:readonly MvuInheritedPrefixEvent[],
    ownerInheritedEventCount:number,successorSourcePreparedRef:TavernSourceFrozenRefV1) {
    if(typeof deps.readProgramGenesisAtCut!=='function')fail('DERIVED_PROGRAM_ROOT_READER_REQUIRED')
    const result=deps.readProgramGenesisAtCut({genesis,ownerSessionId:genesis.sessionId,
      ownerInheritedEventCount,events,successorSourcePreparedRef})
    if(result.kind==='blocked')fail(result.code)
    if(result.kind!=='verified-program-opening'||typeof result.assertCurrent!=='function')
      fail('DERIVED_PROGRAM_ROOT_READER_UNPROVEN')
    result.assertCurrent()
    const closure=validateProgramDerivedOpeningClosureV1(result.closure,genesis,result.native)
    if(programDerivedOpeningFloorSeqV1(result.native)<ownerInheritedEventCount
      ||programDerivedOpeningFloorSeqV1(result.native)>=events.length)fail('DERIVED_PROGRAM_GENESIS_OUTSIDE_CUT')
    return {closure,native:result.native,assertCurrent:result.assertCurrent}
  }
  function programCurrent(prepared:MvuDerivedPreparedV4,input:readonly MvuInheritedPrefixEvent[],prompt?:PromptCollection) {
    const actual=readProgramAtCut(prepared.genesis,input,prepared.parentInheritedEventCount,prepared.sourcePreparedRef),
      fact=prepared.genesisFact,packet=actual.closure.data
    exact(fact,['kind','eventKey','headKey','closureSha256'])
    if(fact.kind!=='program-opening'||fact.eventKey!==packet.genesisEventRef.key||fact.headKey!==packet.genesisHeadRef.key
      ||fact.closureSha256!==actual.closure.closureSha256||!same(prepared.genesisClosure,actual.closure))return false
    const native=actual.native,seq=native.production==='selected-card-copy'?native.receipt.assistantSeq:
      native.receipt.terminalOutput.eventRef.seq,events=input as readonly StoryEvent[],event=events[seq],message=event?.data?.message
    if(event?.type!=='assistant/message'||!message||!Array.isArray(message.content))return false
    if(message.content.some(block=>block.type==='text'&&typeof block.text!=='string'))return false
    const narrative=message.content.filter(block=>block.type==='text').map(block=>block.text).join(''),
      canonical={seq,messageId:String(message.id),versionSha256:nativeInputSha256(message),narrativeSha256:sha256(narrative)},
      nativeEventRecordSha256=native.production==='selected-card-copy'?recordSha256(event):nativeInputSha256(event)
    if(native.production==='selected-card-copy') {
      if(native.receipt.messageId!==canonical.messageId||native.receipt.messageVersion.eventSha256!==nativeEventRecordSha256
        ||native.receipt.renderedSha256!==canonical.narrativeSha256||packet.input.source.selected.renderedText!==narrative)return false
    }else if(!same(native.canonical,{seq,messageId:canonical.messageId,versionSha256:canonical.versionSha256,narrative})
      ||native.receipt.terminalOutput.eventRef.sha256!==nativeEventRecordSha256)return false
    const surface=deps.projectPrefix(events),projected=surface.projectedMessageAt(seq)??message
    if(!surface.nodes.includes(seq)||nativeInputSha256(projected)!==canonical.versionSha256
      ||events.some(row=>row.type==='roleplay/message-edit'&&row.data?.['targetSeq']===seq))return false
    actual.assertCurrent()
    if(prompt) {
      const row=(ref:{key:string;sha256:string},table:'branch'|'status')=>
        ({table,key:ref.key,recordSha256:ref.sha256})
      const publication={genesis:prepared.genesis,snapshot:prepared.initial,canonical,nativeEventRecordSha256,
        packets:{seed:packet.seed,input:packet.input,plan:packet.planRecord,intent:packet.intent},
        closureRef:{table:'branch',key:mvuDerivedPreparedKey(prepared.childSessionId),
          recordSha256:recordSha256(prepared),fieldPointer:'/genesisClosure'},
        refs:{seed:row(packet.refs.seed,'branch'),input:row(packet.refs.input,'branch'),plan:row(packet.refs.plan,'branch'),
          intent:row(packet.refs.intent,'branch'),genesisEvent:row(packet.genesisEventRef,'status'),
          genesisHead:row(packet.genesisHeadRef,'status')}}
      // Complete closure validation above and the prompt formatter below own
      // these data checks. Avoid recursively remapping the immutable JSON and
      // legacy mutable import-array declarations at this internal handoff.
      prompt.programOpenings.push(publication as unknown as MvuPromptValidatedProgramOpeningInputV1)
    }
    return true
  }
  function genesisCurrent(prepared:MvuDerivedPrepared,events:readonly MvuInheritedPrefixEvent[],seen:Set<string>,
    successor?:HistoricalSuccessor,prompt?:PromptCollection):boolean {
    if(prepared.schemaVersion===4)return programCurrent(prepared,events,prompt)
    if(prepared.genesisFact.kind==='opening')return openingCurrent(prepared,events,prompt)
    if(prepared.genesisFact.kind!=='derived')return false
    const fact=prepared.genesisFact,raw=deps.branch.get(fact.basisKey) as MvuDerivedBasis | undefined
    const next=frozenPrepared(prepared)?prepared.sourcePreparedRef:successor,
      previous=raw&&next&&readHistorical(raw.prepared.childSessionId,events,next,seen,prompt)
    return !!raw&&raw.basisSha256===fact.basisSha256&&!!previous&&same(previous,prepared.genesis)
  }
  function validPrepared(input:unknown,events:readonly MvuInheritedPrefixEvent[],seen:Set<string>,
    successor?:HistoricalSuccessor,prompt?:PromptCollection):MvuDerivedPrepared {
    const prepared=data(input) as MvuDerivedPrepared
    exact(prepared,['schemaVersion','encoding','operationId','anchorSha256','parentSessionId','childSessionId','seedLength',
      'parentInheritedEventCount','parentSourceSha256','prefixSha256','genesis','genesisFact','initial','ledger','preparedSha256',
      ...frozenPrepared(prepared)?['sourcePreparedRef','parentNumericDescriptorSha256','prefixClosureRef',
        'forkReservationBinding','genesisClosure']:[]])
    if(frozenPrepared(prepared)) {
      if(!frozenLineage)fail('DERIVED_FROZEN_SOURCE_OWNER_UNAVAILABLE')
      const source=frozenLineage.prepared(prepared.childSessionId),binding=prepared.forkReservationBinding,
        {bindingSha256,...bindingBody}=binding
      exact(binding,['operationId','anchor','reservation','bindingSha256'])
      exact(prepared.prefixClosureRef,['key','sha256','closureSha256'])
      if(!same(source.ref,prepared.sourcePreparedRef)||source.frozen.operationId!==prepared.operationId
        ||source.frozen.anchorSha256!==prepared.anchorSha256||source.frozen.parentSessionId!==prepared.parentSessionId
        ||source.frozen.nativeCut.seedLength!==prepared.seedLength
        ||source.frozen.nativeCut.parentInheritedEventCount!==prepared.parentInheritedEventCount
        ||source.parentSourceSha256!==prepared.parentSourceSha256
        ||prepared.parentNumericDescriptorSha256!==source.parentSourceSha256
        ||binding.operationId!==prepared.operationId||recordSha256(binding.anchor)!==prepared.anchorSha256
        ||!same(binding.reservation,{sourceSessionId:prepared.parentSessionId,
          childSessionId:prepared.childSessionId,seedLength:prepared.seedLength})
        ||bindingSha256!==recordSha256(bindingBody)
        ||prepared.prefixClosureRef.key!==prefixClosureKey(prepared.childSessionId,prepared.prefixClosureRef.closureSha256))
        fail('DERIVED_FROZEN_SOURCE_CHANGED')
      if(prepared.schemaVersion===4) {
        if(prepared.genesisClosure.kind!=='program-opening'
          ||prepared.genesisFact.closureSha256!==prepared.genesisClosure.closureSha256)
          fail('DERIVED_PROGRAM_CLOSURE_CHANGED')
      }else if(prepared.genesisFact.kind==='opening') {
        if(prepared.genesisClosure.kind!=='opening')fail('DERIVED_OPENING_OWNER_UNPROVEN')
        exact(prepared.genesisClosure,['kind','intent','intentSha256'])
        if(prepared.genesisClosure.intentSha256!==prepared.genesisFact.intentSha256
          ||recordSha256(prepared.genesisClosure.intent)!==prepared.genesisClosure.intentSha256)
          fail('DERIVED_OPENING_OWNER_UNPROVEN')
      }else if(!same(prepared.genesisClosure,prepared.genesisFact))fail('DERIVED_PARENT_BASIS_UNPROVEN')
    }
    const {preparedSha256,...descriptor}=prepared
    if(!preparedVersion(prepared)
      ||![prepared.parentSessionId,prepared.childSessionId,prepared.operationId].every(id)
      ||prepared.parentSessionId===prepared.childSessionId||prepared.seedLength!==events.length
      ||!Number.isSafeInteger(prepared.parentInheritedEventCount)||prepared.parentInheritedEventCount<0
      ||prepared.parentInheritedEventCount>=prepared.seedLength
      ||deps.readSession(prepared.parentSessionId)?.inheritedEventCount!==prepared.parentInheritedEventCount
      ||recordSha256(descriptor)!==preparedSha256
      ||prepared.prefixSha256!==recordSha256(events)||!frozenPrepared(prepared)&&!operationCurrent(prepared)
      ||!genesisCurrent(prepared,events,seen,successor,prompt))fail('DERIVED_BASIS_UNPROVEN')
    const g=prepared.genesis
    let expectedInitial:unknown
    if('programEvent' in g)expectedInitial=programDerivedGenesisSnapshotV1(g)
    else {
      const head='initHead' in g?g.initHead:g.derivedHead,
        values='initEvent' in g?g.initEvent.plan.values:g.derivedEvent.values,
        root='initEvent' in g?{initEventId:g.initEvent.eventId,initEventSha256:g.initEvent.eventSha256,
          initHeadSha256:recordSha256(head),planSha256:g.initEvent.plan.planSha256}:{schemaVersion:1,
          encoding:'native-mvu-derived-state-root-v1',derivedEventId:g.derivedEvent.eventId,
          derivedEventSha256:g.derivedEvent.eventSha256,derivedHeadSha256:recordSha256(head),basisSha256:g.derivedEvent.basisSha256},
        descriptor={schemaVersion:1,encoding:'native-mvu-state-snapshot-v1',sessionId:g.sessionId,
          sourceSha256:g.sourceSha256,root,currentHead:head,revision:1,headSha256:recordSha256(head),values,
          valuesSha256:recordSha256(values)}
      expectedInitial={...descriptor,stateSnapshotSha256:recordSha256(descriptor)}
    }
    if(g.sessionId!==prepared.parentSessionId||g.sourceSha256!==prepared.parentSourceSha256
      ||!same(prepared.initial,expectedInitial))fail('DERIVED_INITIAL_BASIS_INVALID')
    const request={ownerSessionId:prepared.parentSessionId,
      ownerInheritedEventCount:prepared.parentInheritedEventCount,events,sourceSha256:prepared.parentSourceSha256,
      genesis:prepared.initial,...prepared.schemaVersion===4?{
        programOpening:{genesis:prepared.genesis,closure:prepared.genesisClosure,
          native:prepared.genesisClosure.data.intent.nativeReceipt!},successorSourcePreparedRef:prepared.sourcePreparedRef}:{}}
    let current:MvuPrefixLedgerResult,facts:MvuPromptPrefixNumericalFactsV1|undefined
    if(frozenPrepared(prepared)) {
      const closure=deps.branch.get(prepared.prefixClosureRef.key) as MvuPrefixInputClosureV1|undefined
      if(!closure||recordSha256(closure)!==prepared.prefixClosureRef.sha256
        ||closure.closureSha256!==prepared.prefixClosureRef.closureSha256)fail('DERIVED_PREFIX_CLOSURE_CHANGED')
      if(prompt) {
        const result=ledger.verifyFrozenPromptFacts(request,closure)
        current=result
        if(result.kind==='ready')facts=result.facts
      }else current=ledger.verifyFrozen(request,closure)
    }else if(prompt) {
      const result=ledger.capturePromptFacts(request)
      current=result
      if(result.kind==='ready')facts=result.facts
    }else current=ledger.capture(request)
    if(prompt&&current.kind==='blocked')prompt.failure??=current.code
    if(current.kind!=='ready'||!same(current.proof,prepared.ledger))fail('DERIVED_TERMINAL_FACTS_CHANGED')
    if(prompt&&facts) {
      if(frozenPrepared(prepared)) {
        const {factsSha256:_hash,...body}=facts,
          closed={...body,inputClosure:Object.freeze({table:'branch' as const,key:prepared.prefixClosureRef.key,
            recordSha256:prepared.prefixClosureRef.sha256,closureSha256:prepared.prefixClosureRef.closureSha256})}
        facts=Object.freeze({...closed,factsSha256:recordSha256(closed)})
      }
      prompt.prefixes.push(facts)
      prompt.byPrepared.set(prepared.preparedSha256,facts)
    }
    return prepared
  }
  async function putExact(table:Table,key:string,value:object) {
    const before=table.get(key)
    if(before!==undefined&&!same(before,value))fail('DERIVED_WRITE_CONFLICT')
    if(before===undefined)try {await table.put(key,data(value))} catch { /* exact committed readback below */ }
    if(!same(table.get(key),value))fail('DERIVED_WRITE_UNCONFIRMED')
  }
  async function putPrefixClosure(childId:string,closure:MvuPrefixInputClosureV1) {
    const key=prefixClosureKey(childId,closure.closureSha256),before=deps.branch.get(key)
    if(before!==undefined&&!same(before,closure))fail('DERIVED_WRITE_CONFLICT')
    // captureFrozen already inspected every input and the complete closure
    // budget. A purpose-owned archive must not use the smaller basis clone.
    if(before===undefined)try {await deps.branch.put(key,structuredClone(closure))} catch { /* exact readback below */ }
    if(!same(deps.branch.get(key),closure))fail('DERIVED_WRITE_UNCONFIRMED')
    return {key,sha256:recordSha256(closure),closureSha256:closure.closureSha256}
  }
  /** Runs in Native's reservation callback, before child publication. Parent
   * capture has its Source lock; no lock spans Native creation or Agent waits. */
  async function prepare(operation:ForkOperation,reservation:ForkReservation) {
    if(operation.anchor.openingOnly||reservation.seedLength===0)return
    await deps.withSourceLock(reservation.sourceSessionId,async()=>{
      const owner=deps.session(reservation.sourceSessionId)
      if(!owner||owner.id!==operation.anchor.sourceSessionId||reservation.seedLength!==operation.anchor.expectedSeedLength
        ||!id(reservation.childSessionId)||reservation.childSessionId===owner.id)fail('DERIVED_RESERVATION_INVALID')
      const existing=deps.branch.get(mvuDerivedPreparedKey(reservation.childSessionId)) as MvuDerivedPrepared|undefined
      if(existing&&frozenPrepared(existing)) {
        const validated=validPrepared(existing,prefix(owner,existing.seedLength) as readonly MvuInheritedPrefixEvent[],
          new Set([reservation.childSessionId]))
        if(validated.operationId!==operation.operationId||validated.anchorSha256!==recordSha256(operation.anchor)
          ||validated.parentSessionId!==reservation.sourceSessionId||validated.seedLength!==reservation.seedLength)
          fail('DERIVED_RESERVATION_INVALID')
        return
      }
      const g=deps.readGenesis(owner.id)
      // Plain/legacy branches retain their established import/opening contract.
      // A numerical reader can only proceed from an actually verified root.
      if(!g)return
      const initial=deps.state().readGenesisAuthority(owner.id)
      if(initial.kind!=='ready')fail(initial.code)
      const events=prefix(owner,reservation.seedLength),sourceSha256=deps.readSourceSha256(owner.id)
      const source=frozenLineage?.prepared(reservation.childSessionId)
      if(source) {
        deps.sourceInheritance!()!.assertPreparedParentCurrent(reservation.childSessionId)
        if(source.frozen.operationId!==operation.operationId||source.frozen.anchorSha256!==recordSha256(operation.anchor)
          ||source.frozen.parentSessionId!==owner.id||source.frozen.nativeCut.seedLength!==reservation.seedLength
          ||source.frozen.nativeCut.parentInheritedEventCount!==owner.inheritedEventCount
          ||source.frozen.nativeCut.prefixSha256!==recordSha256(events)||source.parentSourceSha256!==sourceSha256
          ||g.sourceSha256!==sourceSha256||!same(deps.readSourceDescriptor!(owner.id),source.parentDescriptor))
          fail('DERIVED_FROZEN_SOURCE_CHANGED')
      }
      if('programEvent' in g&&!source)fail('DERIVED_PROGRAM_FROZEN_SOURCE_REQUIRED')
      const program='programEvent' in g&&source
        ?readProgramAtCut(g,events as readonly MvuInheritedPrefixEvent[],owner.inheritedEventCount!,source.ref):undefined
      if(program&&'programEvent' in g&&!same(initial.snapshot,programDerivedGenesisSnapshotV1(g)))
        fail('DERIVED_PROGRAM_INITIAL_BASIS_CHANGED')
      const request={ownerSessionId:owner.id,ownerInheritedEventCount:owner.inheritedEventCount!,
        events:events as readonly MvuInheritedPrefixEvent[],sourceSha256,genesis:initial.snapshot,
        ...program&&'programEvent' in g&&source?{programOpening:{genesis:g,closure:program.closure,native:program.native},
          successorSourcePreparedRef:source.ref}:{}},
        frozen=source?ledger.captureFrozen(request):undefined,captured=frozen??ledger.capture(request)
      if(captured.kind!=='ready')fail(captured.code)
      const prior:GenesisFact=program?{kind:'program-opening',eventKey:program.closure.data.genesisEventRef.key,
        headKey:program.closure.data.genesisHeadRef.key,closureSha256:program.closure.closureSha256}:
        'initEvent' in g?openingFact(g):(()=>{
        if('programEvent' in g)fail('DERIVED_PROGRAM_CLOSURE_REQUIRED')
        const basis=deps.branch.get(mvuDerivedBasisKey(owner.id)) as MvuDerivedBasis | undefined
        if(!basis)fail('DERIVED_PARENT_BASIS_UNPROVEN')
        return {kind:'derived' as const,basisKey:mvuDerivedBasisKey(owner.id),basisSha256:basis.basisSha256}
      })()
      const fields={
        operationId:operation.operationId,anchorSha256:recordSha256(operation.anchor),parentSessionId:owner.id,
        childSessionId:reservation.childSessionId,seedLength:reservation.seedLength,
        parentInheritedEventCount:owner.inheritedEventCount!,parentSourceSha256:sourceSha256,
        prefixSha256:recordSha256(events),genesis:g,genesisFact:prior,initial:initial.snapshot}
      if(source) {
        if(!frozen||frozen.kind!=='ready')fail('DERIVED_PREFIX_CLOSURE_CHANGED')
        const prefixClosureRef=await putPrefixClosure(reservation.childSessionId,frozen.closure)
        frozen.assertCurrent()
        program?.assertCurrent()
        const bindingBody={operationId:operation.operationId,anchor:data(operation.anchor),reservation:data(reservation)},
          forkReservationBinding={...bindingBody,bindingSha256:recordSha256(bindingBody)},
          genesisClosure=program?program.closure:prior.kind==='opening'?{kind:'opening' as const,
            intent:data(deps.branch.get(prior.intentKey)) as Record<string,unknown>,intentSha256:prior.intentSha256}:prior,
          version=program?{schemaVersion:4 as const,encoding:'native-program-mvu-derived-prepared-v4' as const}:
            {schemaVersion:3 as const,encoding:'native-mvu-derived-prepared-v3' as const},
          body={...version,...fields,
            ledger:captured.proof,sourcePreparedRef:source.ref,parentNumericDescriptorSha256:source.parentSourceSha256,
            prefixClosureRef,forkReservationBinding,genesisClosure}
        if(deps.readSourceSha256(owner.id)!==sourceSha256
          ||!same(deps.readSourceDescriptor!(owner.id),source.parentDescriptor))fail('DERIVED_FROZEN_SOURCE_CHANGED')
        if(program&&captured.proof.schemaVersion!==3)fail('DERIVED_PROGRAM_LEDGER_REQUIRED')
        await putExact(deps.branch,mvuDerivedPreparedKey(reservation.childSessionId),{...body,preparedSha256:recordSha256(body)})
        frozen.assertCurrent()
        program?.assertCurrent()
        return
      }
      const body=captured.proof.schemaVersion===1
        ?{schemaVersion:1 as const,encoding:'native-mvu-derived-prepared-v1' as const,...fields,ledger:captured.proof}
        :{schemaVersion:2 as const,encoding:'native-mvu-derived-prepared-v2' as const,...fields,ledger:captured.proof}
      await putExact(deps.branch,mvuDerivedPreparedKey(reservation.childSessionId),{...body,preparedSha256:recordSha256(body)})
    })
  }
  function generated(basis:MvuDerivedBasis):VerifiedMvuDerivedGenesis {
    const sid=basis.prepared.childSessionId,sourceSha256=basis.source.childSourceSha256,values=basis.prepared.ledger.numericalSnapshot.values
    const eventId=recordSha256({encoding:'native-mvu-derived-genesis-identity-v1',sessionId:sid,
      operationId:basis.prepared.operationId,basisSha256:basis.basisSha256})
    const descriptor={schemaVersion:1 as const,encoding:'native-mvu-derived-genesis-event-v1' as const,sessionId:sid,
      sourceSha256,revision:1 as const,eventId,basisSha256:basis.basisSha256,values,valuesSha256:recordSha256(values)}
    const derivedEvent:MvuDerivedGenesisEvent={...descriptor,eventSha256:recordSha256(descriptor)}
    const derivedHead:MvuDerivedGenesisHead={schemaVersion:1,encoding:'native-mvu-derived-genesis-head-v1',sessionId:sid,
      sourceSha256,revision:1,eventId,eventSha256:derivedEvent.eventSha256,basisSha256:basis.basisSha256,valuesSha256:derivedEvent.valuesSha256}
    return {sessionId:sid,sourceSha256,derivedEvent,derivedHead}
  }
  function sourceMatchesGenesis(basis:MvuDerivedBasis):boolean {
    const g=basis.prepared.genesis,original=basis.source.originalImport
    if('initEvent' in g||'programEvent' in g) {
      // Source identity remains the original author/import inventory. A
      // generated terminal body is separately bound by the program closure.
      const source='programEvent' in g?g.programEvent.plan.source.source:g.initEvent.plan.identity.source
      return source.sourceRecordSessionId===original.ownerSessionId&&source.importId===original.importId
        &&source.rawSha256===original.rawSha256&&source.normalizedSha256===original.normalizedSha256
        &&source.coverageSha256===original.coverageSha256&&source.transactionId===original.transactionId
    }
    const fact=basis.prepared.genesisFact
    const parent=fact.kind==='derived'?deps.branch.get(fact.basisKey) as MvuDerivedBasis | undefined:undefined
    return !!parent&&same(parent.source.originalImport,original)
  }
  function historicalSource(source:MvuDerivedSourceProofUnion,successor:HistoricalSuccessor):boolean {
    if(successor.encoding==='native-tavern-source-inheritance-frozen-ref-v1')
      return frozenLineage?.historicalPrepared(source,successor)===true
    if(successor.schemaVersion===2)return frozenLineage?.historical(source,successor)===true
    return source.schemaVersion===1&&lineage.historical(source,successor)
  }
  function sourceReadable(source:MvuDerivedSourceProofUnion,currentSource:boolean):boolean {
    if(source.schemaVersion===2)return (currentSource?frozenLineage?.current(source)
      :frozenLineage?.verifyDenialBindingFacts(source))===true
    return currentSource?lineage.current(source):lineage.verifyDenialBindingFacts(source)
  }
  /** The descendant's actual Source anchors the chain. Older sources are
   * checked against the next generation and Native headers, not today's
   * ancestor pointer, context, state head or retained Agent. */
  function readHistorical(sid:string,inherited:readonly MvuInheritedPrefixEvent[],successor:HistoricalSuccessor,
    seen:Set<string>,prompt?:PromptCollection):VerifiedMvuDerivedGenesis | undefined {
    try {
      if(seen.size>=32||seen.has(sid))return
      seen.add(sid)
      const raw=deps.branch.get(mvuDerivedBasisKey(sid))
      if(!raw)return
      const basis=data(raw) as MvuDerivedBasis
      exact(basis,['schemaVersion','encoding','prepared','source','basisSha256'])
      const {basisSha256,...body}=basis
      if(!basisVersion(basis)||recordSha256(body)!==basisSha256
        ||basis.prepared.childSessionId!==sid||!same(deps.branch.get(mvuDerivedPreparedKey(sid)),basis.prepared)
        ||!historicalSource(basis.source,successor)||basis.source.parentSourceSha256!==basis.prepared.parentSourceSha256
        ||basis.source.parentSessionId!==basis.prepared.parentSessionId||basis.source.childSessionId!==sid
        ||basis.source.expectedSeedLength!==basis.prepared.seedLength||!sourceMatchesGenesis(basis)
        ||basis.prepared.seedLength>inherited.length)return
      const events=inherited.slice(0,basis.prepared.seedLength)
      validPrepared(basis.prepared,events,seen,basis.source,prompt)
      const g=generated(basis)
      if(!same(deps.status.get(mvuDerivedEventKey(sid)),g.derivedEvent)
        ||!same(deps.status.get(mvuDerivedHeadKey(sid)),g.derivedHead))return
      if(prompt)collectPromptLayer(basis,g,prompt)
      return data(g)
    } catch(error) {
      if(prompt&&error instanceof Error&&/^(PROMPT_NUMERICAL|DERIVED|SOURCE)_[A-Z_]+$/.test(error.message)) {
        prompt.failure??=error.message
      }
      return undefined
    }
  }
  function readClosedGenesis(sid:string,currentSource:boolean,seen=new Set<string>(),prompt?:PromptCollection)
    :VerifiedMvuDerivedGenesis | undefined {
    try {
      if(seen.size>=32||seen.has(sid))return
      seen.add(sid)
      const session=deps.session(sid),raw=deps.branch.get(mvuDerivedBasisKey(sid))
      if(!session||!raw)return
      const basis=data(raw) as MvuDerivedBasis
      exact(basis,['schemaVersion','encoding','prepared','source','basisSha256'])
      const {basisSha256,...body}=basis
      if(!basisVersion(basis)||recordSha256(body)!==basisSha256
        ||basis.prepared.childSessionId!==sid||!same(deps.branch.get(mvuDerivedPreparedKey(sid)),basis.prepared)
        ||!sourceReadable(basis.source,currentSource)
        ||basis.source.parentSourceSha256!==basis.prepared.parentSourceSha256
        ||basis.source.parentSessionId!==basis.prepared.parentSessionId||basis.source.childSessionId!==sid
        ||basis.source.expectedSeedLength!==basis.prepared.seedLength||!sourceMatchesGenesis(basis))return
      validPrepared(basis.prepared,prefix(session,basis.prepared.seedLength) as readonly MvuInheritedPrefixEvent[],seen,basis.source,prompt)
      const g=generated(basis)
      if(!same(deps.status.get(mvuDerivedEventKey(sid)),g.derivedEvent)
        ||!same(deps.status.get(mvuDerivedHeadKey(sid)),g.derivedHead))return
      if(prompt)collectPromptLayer(basis,g,prompt)
      return data(g)
    } catch(error) {
      if(prompt&&error instanceof Error&&/^(PROMPT_NUMERICAL|DERIVED|SOURCE)_[A-Z_]+$/.test(error.message)) {
        prompt.failure??=error.message
      }
      return undefined
    }
  }
  /** A changed current Source cannot erase the immutable numerical root's denial
   * identity. Expose neither values nor a VerifiedGenesis to an authority reader. */
  function readDenialBasis(sid:string):{root:MvuStateRoot;editFloorSeq:number}|undefined {
    const genesis=readClosedGenesis(sid,false),session=deps.session(sid)
    if(!genesis||!session||!Number.isSafeInteger(session.inheritedEventCount))return
    const event=genesis.derivedEvent,head=genesis.derivedHead
    return {root:{schemaVersion:1,encoding:'native-mvu-derived-state-root-v1',
      derivedEventId:event.eventId,derivedEventSha256:event.eventSha256,
      derivedHeadSha256:recordSha256(head),basisSha256:event.basisSha256},editFloorSeq:session.inheritedEventCount!}
  }
  /** Only successful original closed-prefix validation can populate a layer.
   * Its source is bound to the actual successor, not today's ancestor Source. */
  function collectPromptLayer(basis:MvuDerivedBasis,g:VerifiedMvuDerivedGenesis,prompt:PromptCollection) {
    const prepared=basis.prepared,facts=prompt.byPrepared.get(prepared.preparedSha256)
    if(!facts)fail('PROMPT_NUMERICAL_PREFIX_UNAVAILABLE')
    const operation=frozenPrepared(prepared)?undefined:data(deps.branch.get(`fork-op-${prepared.operationId}`))
    prompt.layers.push({parentSessionId:prepared.parentSessionId,childSessionId:prepared.childSessionId,source:basis.source,
      basis:{table:'branch',key:mvuDerivedBasisKey(g.sessionId),recordSha256:recordSha256(basis),basisSha256:basis.basisSha256},
      prepared:{table:'branch',key:mvuDerivedPreparedKey(g.sessionId),recordSha256:recordSha256(prepared),
        preparedSha256:prepared.preparedSha256},
      derivedEvent:{table:'status',key:mvuDerivedEventKey(g.sessionId),recordSha256:recordSha256(g.derivedEvent)},
      derivedHead:{table:'status',key:mvuDerivedHeadKey(g.sessionId),recordSha256:recordSha256(g.derivedHead)},
      operation:frozenPrepared(prepared)?{table:'branch',key:mvuDerivedPreparedKey(prepared.childSessionId),
        recordSha256:recordSha256(prepared),fieldPointer:'/forkReservationBinding'}
        :{table:'branch',key:`fork-op-${prepared.operationId}`,recordSha256:recordSha256(operation)},
      prefixFactsSha256:facts.factsSha256,ledgerProofSha256:prepared.ledger.proofSha256,
      parentInheritedEventCount:prepared.parentInheritedEventCount,inheritedPrefixLength:prepared.seedLength,
      historyPrefixSha256:prepared.prefixSha256})
  }
  function promptMessagesCurrent(session:ReadBranchSession,
    facts:MvuPromptInheritedNumericalFactsV1|MvuPromptInheritedNumericalFactsV2):boolean {
    const events=eventsOf(session)
    if(events.some((event,index)=>event.seq!==index))return false
    const surface=deps.projectPrefix(events)
    for(const row of [...facts.openingPublications,...facts.storyPublications]) {
      const canonical=row.canonical,event=events[canonical.seq]
      const message=surface.projectedMessageAt(canonical.seq)??event?.data?.message
      if(!surface.nodes.includes(canonical.seq)||event?.type!=='assistant/message'||!message
        ||message.id!==canonical.messageId||recordSha256(message)!==canonical.versionSha256
        ||sha256(textOf(message.content))!==canonical.narrativeSha256)return false
    }
    if(facts.schemaVersion===2)for(const row of facts.programOpeningPublications) {
      const canonical=row.canonical,event=events[canonical.seq],
        message=surface.projectedMessageAt(canonical.seq)??event?.data?.message
      if(!surface.nodes.includes(canonical.seq)||event?.type!=='assistant/message'||!message
        ||String(message.id)!==canonical.messageId||nativeInputSha256(message)!==canonical.versionSha256
        ||!Array.isArray(message.content)||message.content.some(block=>block.type==='text'&&typeof block.text!=='string')
        ||sha256(message.content.filter(block=>block.type==='text').map(block=>block.text).join(''))!==canonical.narrativeSha256)
        return false
    }
    return true
  }
  function promptInheritedData(sid:string,session:ReadBranchSession)
    :MvuPromptInheritedNumericalFactsV1|MvuPromptInheritedNumericalFactsV2 {
    if(deps.session(sid)!==session)fail('PROMPT_NUMERICAL_SESSION_CHANGED')
    const prompt=promptCollection(),g=readClosedGenesis(sid,true,new Set(),prompt)
    const layer=prompt.layers.find(row=>row.childSessionId===sid)
    if(!g||!layer)fail(prompt.failure??'PROMPT_NUMERICAL_INHERITED_UNAVAILABLE')
    const input={childSessionId:sid,genesis:g,source:layer.source,
      layers:prompt.layers,prefixes:prompt.prefixes,openings:prompt.openings},
      facts=prompt.programOpenings.length?formatInheritedMvuPromptFactsV2({...input,programOpenings:prompt.programOpenings})
        :formatInheritedMvuPromptFactsV1(input)
    if(deps.session(sid)!==session||!promptMessagesCurrent(session,facts))fail('PROMPT_NUMERICAL_MESSAGE_CHANGED')
    return facts
  }
  function capturePromptInheritedFacts(sid:string)
    :MvuPromptFactCaptureV1<MvuPromptInheritedNumericalFactsV1|MvuPromptInheritedNumericalFactsV2> {
    try {
      const session=deps.session(sid)
      if(!session)fail('PROMPT_NUMERICAL_SESSION_UNAVAILABLE')
      const data=promptInheritedData(sid,session)
      return Object.freeze({kind:'ready' as const,data})
    }catch(error) {
      return {kind:'unavailable',code:error instanceof MvuPromptFactsRefusal?error.code:
        error instanceof Error&&/^(PROMPT_NUMERICAL|DERIVED|PREFIX|NUMERICAL|LEDGER|STATE|WORK|TERMINAL|SOURCE|MVU_PLAYER|PREPARATION|PHASE_BC)_[A-Z_]+$/.test(error.message)
          ?error.message:'PROMPT_NUMERICAL_INHERITED_UNAVAILABLE'}
    }
  }
  async function commit(operation:ForkOperation,child:ReadBranchSession) {
    const raw=deps.branch.get(mvuDerivedPreparedKey(child.id))
    if(raw===undefined)return
    await deps.withSourceLock(child.id,async()=>{
      const existing=deps.branch.get(mvuDerivedBasisKey(child.id))
      if(existing!==undefined) {if(!readClosedGenesis(child.id,true))fail('DERIVED_READY_INVALID');return}
      const candidate=data(raw) as MvuDerivedPrepared
      const source=frozenPrepared(candidate)
        ?frozenLineage?.capture(child.id,candidate.sourcePreparedRef)
        :lineage.capture(candidate.parentSessionId,child.id,child.inheritedEventCount!)
      if(!source)fail('DERIVED_FROZEN_SOURCE_OWNER_UNAVAILABLE')
      const prepared=validPrepared(candidate,prefix(child,child.inheritedEventCount!) as readonly MvuInheritedPrefixEvent[],
        new Set([child.id]),source)
      if(prepared.operationId!==operation.operationId)fail('DERIVED_OPERATION_MISMATCH')
      if(!operationCurrent(prepared))fail('DERIVED_OPERATION_MISMATCH')
      if(source.parentSourceSha256!==prepared.parentSourceSha256)fail('DERIVED_PARENT_SOURCE_CHANGED')
      let basis:MvuDerivedBasis
      if(frozenPrepared(prepared)) {
        if(source.schemaVersion!==2)fail('DERIVED_FROZEN_SOURCE_OWNER_UNAVAILABLE')
        if(prepared.schemaVersion===4) {
          const descriptor={schemaVersion:4 as const,encoding:'native-program-mvu-derived-basis-v4' as const,prepared,source}
          basis={...descriptor,basisSha256:recordSha256(descriptor)}
        }else {
          const descriptor={schemaVersion:3 as const,encoding:'native-mvu-derived-basis-v3' as const,prepared,source}
          basis={...descriptor,basisSha256:recordSha256(descriptor)}
        }
      }else {
        if(source.schemaVersion!==1)fail('DERIVED_FROZEN_SOURCE_OWNER_UNAVAILABLE')
        if(prepared.schemaVersion===1) {
          const descriptor={schemaVersion:1 as const,encoding:'native-mvu-derived-basis-v1' as const,prepared,source}
          basis={...descriptor,basisSha256:recordSha256(descriptor)}
        }else {
          const descriptor={schemaVersion:2 as const,encoding:'native-mvu-derived-basis-v2' as const,prepared,source}
          basis={...descriptor,basisSha256:recordSha256(descriptor)}
        }
      }
      const g=generated(basis)
      await putExact(deps.status,mvuDerivedEventKey(child.id),g.derivedEvent)
      await putExact(deps.status,mvuDerivedHeadKey(child.id),g.derivedHead)
      if(!operationCurrent(prepared))fail('DERIVED_OPERATION_MISMATCH')
      await putExact(deps.branch,mvuDerivedBasisKey(child.id),basis)
      if(!readClosedGenesis(child.id,true))fail('DERIVED_READY_UNCONFIRMED')
    })
  }
  return {prepare,commit,readGenesis:(sid:string)=>readClosedGenesis(sid,true),readDenialBasis,capturePromptInheritedFacts,
    required:(sid:string)=>deps.branch.get(mvuDerivedPreparedKey(sid))!==undefined
      ||deps.branch.get(mvuDerivedBasisKey(sid))!==undefined}
}
