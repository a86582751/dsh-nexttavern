/** Actual first-opening inventory and historical prefix. A saved digest is
 * consumer data; only these private actual readers establish fresh currency. */
import {recordSha256} from './roleplay-data.js'
import {eventsOf} from './roleplay-context.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {assertImportRecordIntegrity} from './roleplay-import-record.js'
import {tavernSourceOwnedRecordKeysV1} from './roleplay-tavern-source-inheritance-data.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {programOpeningBasisDataHashesV1} from './roleplay-program-opening-records.js'
import type {ImportRecord} from './roleplay-import-types.js'
import type {ReadBranchSession,StoryEvent} from './roleplay-worldline-types.js'
import type {TavernSourceStaticRowV1} from './roleplay-tavern-source-inheritance-types.js'
import type {PromptOpeningSourceProofV1} from './roleplay-prompt-opening-source-types.js'
import type {ProgramOpeningBasisProofV1} from './roleplay-program-opening-basis-types.js'
import type {ProgramGenesisIdentityV1,FrozenProgramMvuOpeningPlanV3,ProgramGenesisNativeEnvelopeV1,
  ProgramMvuGenesisEventV1,ProgramMvuGenesisHeadV1} from './roleplay-program-genesis-types.js'
import type {ProgramOpeningNativeFactsV1} from './roleplay-program-opening-records.js'

interface ActualReadTable {get(key:string):unknown;entries():Iterable<[string,unknown]>}
type CaptureIdentity=Pick<ProgramGenesisIdentityV1,'sessionId'|'operationId'|'requestedMessageId'>
export interface ProgramOpeningOwnedBranchRowV1 {readonly key:string;readonly value:Readonly<Record<string,unknown>>}
export interface ProgramOpeningBasisDepsV1 {
  readonly tables:Record<'branch'|'status',ActualReadTable>
  readonly session:(sid:string)=>ReadBranchSession|undefined
  readonly branchReady:(sid:string)=>boolean
  readonly assertSourceCurrent:(source:PromptOpeningSourceProofV1)=>void
  /** Reuse the sole Source current projection, then read its exact meta ref.
   * The implementation may not invent another counter-masking policy. */
  readonly readMetaCurrentIdentitySha256:(sid:string)=>string
  /** Actual immutable seed/input, mutable intent and material writer only.
   * Exact current values and registered keys are checked by this owner. */
  readonly assertOwnedBranchRows:(identity:CaptureIdentity,
    rows:readonly ProgramOpeningOwnedBranchRowV1[])=>void
  readonly isNativeCurrent:(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1)=>boolean
  /** Actual complete record/Native predicate only. This callback must not
   * enter Source: full basis owns that gate, while factual reads grant none. */
  readonly isNativeFactsCurrent:(identity:ProgramGenesisIdentityV1,facts:ProgramOpeningNativeFactsV1)=>boolean
  /** Called only by the actual Native owner's callbacks. Its original live
   * registration/phase and Weak selection remain with Native and Root. */
  readonly isOpeningInvocationCurrent:(identity:ProgramGenesisIdentityV1,
    invocationRef:{readonly seq:number;readonly sha256:string})=>boolean
}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const object=(value:unknown):value is Record<string,unknown>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function fail(code:string):never {throw Error(code)}
function frozen<T>(input:T):T {
  const data=cloneRoleplayTavernLoreDataV1(input),pending:unknown[]=[data]
  while(pending.length) {
    const value=pending.pop()
    if(value&&typeof value==='object') {
      pending.push(...Object.values(value));Object.freeze(value)
    }
  }
  return data
}
function noOpaque(value:unknown):void {
  if(!value||typeof value!=='object')return
  for(const [key,child] of Object.entries(value)) {
    if(/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)
      ||key.startsWith('$'))fail('PROGRAM_OPENING_NUMERICAL_STATE_PRESENT')
    noOpaque(child)
  }
}
function oldOpening(event:StoryEvent):boolean {
  const source=event.data?.message?.source as Record<string,unknown>|undefined
  return event.type==='opening/invocation'||event.type==='opening/generated-receipt'
    ||event.type==='opening/closing-ack'||event.type==='turn/start'&&object(event.data?.['programmatic'])
    ||event.type==='assistant/message'&&source?.['kind']==='programmatic'
      &&source['producer']==='dsh-nexttavern'&&String(source['origin']).startsWith('card-opening:')
}

export function createRoleplayProgramOpeningBasisV1(deps:ProgramOpeningBasisDepsV1) {
  function native(source:PromptOpeningSourceProofV1) {
    const sid=source.source.sessionId,session=deps.session(sid),metaKey=sid+'__meta',meta=deps.tables.branch.get(metaKey)
    deps.assertSourceCurrent(source)
    return nativeFrameFacts(source,session,metaKey,meta)
  }
  /** Read the same actual frame without acquiring Source permission. Only
   * completed absence owner facts use this entry; all older paths use native. */
  function nativeOwnerFacts(source:PromptOpeningSourceProofV1) {
    const sid=source.source.sessionId,session=deps.session(sid),metaKey=sid+'__meta',meta=deps.tables.branch.get(metaKey)
    return nativeFrameFacts(source,session,metaKey,meta)
  }
  function nativeFrameFacts(source:PromptOpeningSourceProofV1,session:ReadBranchSession|undefined,
    metaKey:string,meta:unknown) {
    const sid=source.source.sessionId
    if(!session||session.id!==sid||session.header?.id!==undefined&&session.header.id!==sid
      ||session.header?.parentSession||session.header?.origin==='subagent'||session.inheritedEventCount!==0
      ||!deps.branchReady(sid)||!object(meta)
      ||meta.inheritanceState!==undefined&&meta.inheritanceState!=='ready')fail('PROGRAM_OPENING_RELATION_CHANGED')
    const relation=source.sourceRelation
    if(relation.native.sessionId!==sid||relation.native.parentSessionId!==null||relation.native.inheritedEventCount!==0
      ||relation.branchMetaRef.key!==metaKey)fail('PROGRAM_OPENING_RELATION_CHANGED')
    if(relation.kind==='own-root-source') {
      if(['inheritedFrom','freshBranchFrom','truncatedFrom'].some(key=>Object.hasOwn(meta,key))) {
        fail('PROGRAM_OPENING_RELATION_CHANGED')
      }
    }else if(relation.kind!=='committed-fresh-cut0-source'||relation.inheritance.childSessionId!==sid
      ||relation.inheritance.nativeCut.kind!=='reserved-fresh-branch'||relation.inheritance.nativeCut.seedLength!==0) {
      fail('PROGRAM_OPENING_RELATION_CHANGED')
    }
    const events=eventsOf(session)
    if(events.some((event,index)=>event.seq!==index)
      ||session.seq!==undefined&&session.seq!==events.length)fail('PROGRAM_OPENING_NATIVE_PREFIX_INVALID')
    const metaCurrentIdentitySha256=deps.readMetaCurrentIdentitySha256(sid)
    if(!hash(metaCurrentIdentitySha256))fail('PROGRAM_OPENING_META_IDENTITY_INVALID')
    return {session,events,branch:{metaKey,metaCurrentIdentitySha256,parentSessionId:null,
      inheritedEventCount:0,ready:true} as const}
  }
  function inventory(source:PromptOpeningSourceProofV1,identity:CaptureIdentity,
    ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]=[],proposed?:{event:ProgramMvuGenesisEventV1;head:ProgramMvuGenesisHeadV1}) {
    const sid=source.source.sessionId,prefix=sid+'__',seen=new Set<string>(),
      statusRows:TavernSourceStaticRowV1[]=[],branchRows:TavernSourceStaticRowV1[]=[],
      sourceKeys=tavernSourceOwnedRecordKeysV1(sid),owned=new Map<string,Readonly<Record<string,unknown>>>()
    deps.assertOwnedBranchRows(identity,ownedRows)
    for(const row of ownedRows) {
      if(!row.key.startsWith(prefix)||owned.has(row.key)||!same(deps.tables.branch.get(row.key),row.value)) {
        fail('PROGRAM_OPENING_OWNED_ROW_CHANGED')
      }
      owned.set(row.key,row.value)
    }
    const eventKey=proposed&&mvuInitializationEventKey(sid,proposed.event.eventId),headKey=mvuInitializationHeadKey(sid)
    for(const table of ['branch','status'] as const)for(const [key,supplied] of deps.tables[table].entries()) {
      if(typeof key!=='string'||!key.startsWith(prefix))continue
      const address=table+':'+key
      if(seen.has(address)||seen.size>=16_384)fail('PROGRAM_OPENING_INVENTORY_INVALID_OR_BUDGET')
      seen.add(address)
      const value=frozen(supplied)
      if(!object(value)||!same(value,deps.tables[table].get(key)))fail('PROGRAM_OPENING_ROW_CHANGED')
      const suffix=key.slice(prefix.length)
      if(table==='status'&&proposed&&(key===eventKey&&same(value,proposed.event)
        ||key===headKey&&same(value,proposed.head)))continue
      if(table==='branch'&&owned.has(key))continue
      if(/^(?:mvu|state|stat_data|statData|variables|schema|opaqueState)(?:[-_]|$)/i.test(suffix)
        ||table==='status'&&!['spec','panel'].includes(suffix))fail('PROGRAM_OPENING_NUMERICAL_STATE_PRESENT')
      if(table==='branch') {
        // These exact Source families have independent actual immutable/current
        // validation. Their author payload is not opaque numerical state.
        if(sourceKeys.has(key)||suffix==='meta'||suffix==='settings'||suffix==='import-active')continue
        if(suffix===`import-${String(value.importId)}`) {
          assertImportRecordIntegrity(value as unknown as ImportRecord);continue
        }
        if(suffix.startsWith('opening-choice-'))fail('PROGRAM_OPENING_PREVIOUS_OPENING_PRESENT')
        const inputWork=/^native-input-v2-(?:current|work-[a-f0-9]{64})$/.test(suffix)
          &&value.schemaVersion===2&&value.namespace==='nexttavern.roleplay.input.v2'
          &&value.sessionId===sid&&value.branchId===sid
        if(inputWork) {
          // Management/import work may precede an actual first opening. A
          // numerical terminal promise or numerical observation never may.
          const observed=value.source
          if(value.terminalRequired!==undefined||!object(observed)
            ||observed.kind!=='legacy'&&observed.kind!=='management'
            ||Object.hasOwn(observed,'headRef'))fail('PROGRAM_OPENING_NUMERICAL_STATE_PRESENT')
        }else noOpaque(value)
      }else noOpaque(value)
      const row:TavernSourceStaticRowV1={table,key,exists:true,sha256:recordSha256(value),value}
      ;(table==='status'?statusRows:branchRows).push(row)
    }
    statusRows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
    branchRows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
    return {statusRows,branchRows,membershipSha256:recordSha256({statusRows,branchRows}),
      ownedInitializationCount:0,opaqueStateCount:0} as const
  }
  function capture(source:PromptOpeningSourceProofV1,identity:CaptureIdentity):ProgramOpeningBasisProofV1 {
    if(identity.sessionId!==source.source.sessionId)fail('PROGRAM_OPENING_IDENTITY_INVALID')
    const actual=native(source)
    if(actual.events.some(oldOpening))fail('PROGRAM_OPENING_PREVIOUS_OPENING_PRESENT')
    const numerical=inventory(source,identity),relation=source.sourceRelation,
      sourceRelation=relation.kind==='own-root-source'?{kind:'own-root' as const,inheritance:null}:
        {kind:'reserved-fresh-child' as const,inheritance:relation.inheritance,setup:relation.setup,
          setupSha256:recordSha256(relation.setup)}
    const body={schemaVersion:1 as const,encoding:'native-program-opening-fresh-basis-proof-v1' as const,
      authority:'consumer-data-only' as const,sessionId:identity.sessionId,ownerSessionId:identity.sessionId,
      origin:relation.kind==='own-root-source'?'own-root' as const:'fresh-scene' as const,
      operationId:identity.operationId,requestedMessageId:identity.requestedMessageId,
      sourceBindingSha256:source.bindingSha256,sourceRelation,branch:actual.branch,
      native:{observedThroughSeq:actual.events.length-1,eventCount:actual.events.length,
        historySha256:recordSha256(actual.events)},numerical}
    return frozen({...body,basisSha256:recordSha256(body)})
  }
  function expectedInventory(proof:ProgramOpeningBasisProofV1,ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]) {
    const owned=new Set(ownedRows.map(row=>row.key)),statusRows=proof.numerical.statusRows,
      branchRows=proof.numerical.branchRows.filter(row=>!owned.has(row.key))
    // An actual Phase-A writer may replace its prior nonnumerical snapshot or
    // window row. Exclude the same precise keys on both sides, only after that
    // private writer/Native material provenance has been checked by inventory.
    return {...proof.numerical,statusRows,branchRows,membershipSha256:recordSha256({statusRows,branchRows})}
  }
  function historical(plan:FrozenProgramMvuOpeningPlanV3,envelope:ProgramGenesisNativeEnvelopeV1):boolean {
    const proof=plan.basis,{basisSha256,...body}=proof,actual=native(plan.source),count=proof.native.eventCount,
      start=envelope.production==='selected-card-copy'?envelope.receipt.turnStartSeq:envelope.receipt.invocationRef.seq
    if(basisSha256!==recordSha256(body)||proof.sessionId!==plan.identity.sessionId
      ||proof.operationId!==plan.identity.operationId||proof.requestedMessageId!==plan.identity.requestedMessageId
      ||proof.sourceBindingSha256!==plan.source.bindingSha256||!same(actual.branch,proof.branch)
      ||!Number.isSafeInteger(count)||count<0||proof.native.observedThroughSeq!==count-1
      ||count>actual.events.length||recordSha256(actual.events.slice(0,count))!==proof.native.historySha256
      ||actual.events.slice(0,count).some(oldOpening)||start!==count) return false
    const relation=plan.source.sourceRelation,expected=relation.kind==='own-root-source'?{kind:'own-root',inheritance:null}:
      {kind:'reserved-fresh-child',inheritance:relation.inheritance,setup:relation.setup,setupSha256:recordSha256(relation.setup)}
    return same(proof.sourceRelation,expected)&&deps.isNativeCurrent(plan,envelope)
  }
  function currentBefore(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramGenesisIdentityV1,ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {
      const actual=native(source),{basisSha256,...body}=proof
      return basisSha256===recordSha256(body)&&identity.sessionId===proof.sessionId
        &&identity.operationId===proof.operationId&&identity.requestedMessageId===proof.requestedMessageId
        &&source.bindingSha256===proof.sourceBindingSha256&&same(actual.branch,proof.branch)
        &&actual.events.length===proof.native.eventCount&&actual.events.length-1===proof.native.observedThroughSeq
        &&recordSha256(actual.events)===proof.native.historySha256&&!actual.events.some(oldOpening)
        &&same(inventory(source,identity,ownedRows),expectedInventory(proof,ownedRows))
    }catch{return false}
  }
  function prefixCurrent(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramGenesisIdentityV1):boolean {
    const actual=native(source)
    return prefixMatches(proof,source,identity,actual)
  }
  function prefixMatches(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramGenesisIdentityV1,actual:ReturnType<typeof nativeFrameFacts>):boolean {
    const {basisSha256,...body}=proof,count=proof.native.eventCount,
      dataHashes=programOpeningBasisDataHashesV1(proof,source,identity)
    return basisSha256===(dataHashes?.bodySha256??recordSha256(body))&&proof.sessionId===identity.sessionId
      &&proof.operationId===identity.operationId&&proof.requestedMessageId===identity.requestedMessageId
      &&proof.sourceBindingSha256===source.bindingSha256
      &&recordSha256(actual.branch)===(dataHashes?.branchSha256??recordSha256(proof.branch))
      &&Number.isSafeInteger(count)&&count>=0&&proof.native.observedThroughSeq===count-1
      &&count<=actual.events.length&&recordSha256(actual.events.slice(0,count))===proof.native.historySha256
      &&!actual.events.slice(0,count).some(oldOpening)
  }
  function currentDuring(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramGenesisIdentityV1,invocationRef:{readonly seq:number;readonly sha256:string},
    ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {
      if(!prefixCurrent(proof,source,identity)||invocationRef.seq!==proof.native.eventCount
        ||!deps.isOpeningInvocationCurrent(identity,invocationRef))return false
      return same(inventory(source,identity,ownedRows),expectedInventory(proof,ownedRows))
    }catch{return false}
  }
  function historicalFactsCurrent(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramGenesisIdentityV1,facts:ProgramOpeningNativeFactsV1):boolean {
    try {
      const start=facts.production==='selected-card-copy'?facts.receipt.turnStartSeq:facts.receipt.invocationRef.seq
      return prefixCurrent(proof,source,identity)&&start===proof.native.eventCount
        &&deps.isNativeFactsCurrent(identity,facts)
    }catch{return false}
  }
  /** Source-free historical facts over the actual current Session and Native
   * output. The factory separately binds its private completed record capture
   * and requires the generated closing ACK; this result grants no permission. */
  function historicalOwnerFactsCurrent(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramGenesisIdentityV1,facts:ProgramOpeningNativeFactsV1):boolean {
    try {
      if(source.initialization.kind!=='absent')return false
      const actual=nativeOwnerFacts(source),relation=source.sourceRelation,
        start=facts.production==='selected-card-copy'?facts.receipt.turnStartSeq:facts.receipt.invocationRef.seq,
        dataHashes=programOpeningBasisDataHashesV1(proof,source,identity),
        expectedRelation=dataHashes?undefined:relation.kind==='own-root-source'?{kind:'own-root',inheritance:null}:
          {kind:'reserved-fresh-child',inheritance:relation.inheritance,setup:relation.setup,
            setupSha256:recordSha256(relation.setup)}
      return (actual.session.header?.id??null)===relation.native.headerId
        &&(actual.session.header?.origin??null)===relation.native.origin
        &&(dataHashes?dataHashes.sourceRelationSha256===dataHashes.expectedSourceRelationSha256:
          same(proof.sourceRelation,expectedRelation))&&prefixMatches(proof,source,identity,actual)
        &&start===proof.native.eventCount&&deps.isNativeFactsCurrent(identity,facts)
    }catch{return false}
  }
  function currentForAbsencePublication(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramGenesisIdentityV1,facts:ProgramOpeningNativeFactsV1,
    ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {
      if(source.initialization.kind!=='absent'||!historicalFactsCurrent(proof,source,identity,facts))return false
      const actual=native(source),end=facts.production==='selected-card-copy'?facts.receipt.turnEndSeq:facts.receipt.turnEndRef.seq
      if(facts.production==='selected-card-copy'?actual.events.at(-1)?.seq!==end:
        actual.events.slice(end+1).some(row=>row.type!=='opening/generated-receipt'&&row.type!=='opening/closing-ack'))return false
      return same(inventory(source,identity,ownedRows),expectedInventory(proof,ownedRows))
    }catch{return false}
  }
  function currentForPublication(plan:FrozenProgramMvuOpeningPlanV3,envelope:ProgramGenesisNativeEnvelopeV1,
    event:ProgramMvuGenesisEventV1,head:ProgramMvuGenesisHeadV1,ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {
      if(!historical(plan,envelope))return false
      const actual=native(plan.source),lastSeq=actual.events.at(-1)?.seq,
        terminalSeq=envelope.production==='selected-card-copy'?envelope.receipt.turnEndSeq:envelope.receipt.turnEndRef.seq
      if(envelope.production==='selected-card-copy'?lastSeq!==terminalSeq:
        actual.events.slice(terminalSeq+1).some(row=>row.type!=='opening/generated-receipt'&&row.type!=='opening/closing-ack'))return false
      return same(inventory(plan.source,plan.identity,ownedRows,{event,head}),expectedInventory(plan.basis,ownedRows))
    }catch{return false}
  }
  return {capture,currentBefore,currentDuring,currentForPublication,currentForAbsencePublication,historicalFactsCurrent,
    historicalOwnerFactsCurrent,
    historicalCurrent:(plan:FrozenProgramMvuOpeningPlanV3,envelope:ProgramGenesisNativeEnvelopeV1)=>{
      try {return historical(plan,envelope)}catch{return false}
    }}
}
