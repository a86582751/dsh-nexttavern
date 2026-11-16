/** Actual first-opening Source relation and historical prefix. A saved digest is
 * consumer data; only these private actual readers establish fresh currency. */
import {recordSha256} from './roleplay-data.js'
import {nativeInputSha256,validateNativeOpeningInvocationV1} from 'dsh-nexttavern-native-agent-loop'
import {eventsOf} from './roleplay-context.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {programOpeningBasisDataHashesV1} from './roleplay-program-opening-records.js'
import type {ReadBranchSession,StoryEvent} from './roleplay-worldline-types.js'
import type {PromptOpeningSourceProofV1} from './roleplay-prompt-opening-source-types.js'
import type {ProgramOpeningBasisProofV1} from './roleplay-program-opening-basis-types.js'
import type {ProgramOpeningIdentityV1} from './roleplay-program-opening-records.js'
import type {ProgramOpeningNativeFactsV1} from './roleplay-program-opening-records.js'

interface ActualReadTable {get(key:string):unknown}
type CaptureIdentity=Pick<ProgramOpeningIdentityV1,'sessionId'|'operationId'|'requestedMessageId'>
export interface ProgramOpeningOwnedBranchRowV1 {
  readonly table?:'branch'|'status'
  readonly key:string
  readonly value:Readonly<Record<string,unknown>>
}
export interface ProgramOpeningBasisDepsV1 {
  readonly tables:Record<'branch'|'status',ActualReadTable>
  readonly session:(sid:string)=>ReadBranchSession|undefined
  readonly assertSourceCurrent:(source:PromptOpeningSourceProofV1)=>void
  readonly assertHistoricalSourceCurrent?:(source:PromptOpeningSourceProofV1)=>void
  /** Reuse the sole Source current projection, then read its exact meta ref.
   * The implementation may not invent another counter-masking policy. */
  readonly readMetaCurrentIdentitySha256:(sid:string)=>string
  /** Actual immutable seed/input, mutable intent and material writer only.
   * Exact current values and registered keys are checked by this owner. */
  readonly assertOwnedBranchRows:(identity:CaptureIdentity,
    rows:readonly ProgramOpeningOwnedBranchRowV1[])=>void
  /** Actual complete record/Native predicate only. This callback must not
   * enter Source: full basis owns that gate, while factual reads grant none. */
  readonly isNativeFactsCurrent:(identity:ProgramOpeningIdentityV1,facts:ProgramOpeningNativeFactsV1)=>boolean
  /** Called only by the actual Native owner's callbacks. Its original live
   * registration/phase and Weak selection remain with Native and Root. */
  readonly isOpeningInvocationCurrent:(identity:ProgramOpeningIdentityV1,
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
  function historicalNative(source:PromptOpeningSourceProofV1) {
    const sid=source.source.sessionId,session=deps.session(sid),metaKey=sid+'__meta',meta=deps.tables.branch.get(metaKey)
    ;(deps.assertHistoricalSourceCurrent??deps.assertSourceCurrent)(source)
    return nativeFrameFacts(source,session,metaKey,meta)
  }
  function nativeFrameFacts(source:PromptOpeningSourceProofV1,session:ReadBranchSession|undefined,
    metaKey:string,meta:unknown) {
    const sid=source.source.sessionId
    if(!session||session.id!==sid||session.header?.id!==undefined&&session.header.id!==sid
      ||session.header?.parentSession||session.header?.origin==='subagent'||session.inheritedEventCount!==0
      ||!object(meta)
      ||meta.inheritanceState!==undefined&&meta.inheritanceState!=='ready')fail('PROGRAM_OPENING_RELATION_CHANGED')
    const relation=source.sourceRelation
    if(relation.native.sessionId!==sid||relation.native.parentSessionId!==null||relation.native.inheritedEventCount!==0
      ||relation.branchMetaRef.key!==metaKey)fail('PROGRAM_OPENING_RELATION_CHANGED')
    if(relation.kind==='own-root-source') {
      if(['inheritedFrom','freshBranchFrom','truncatedFrom'].some(key=>Object.hasOwn(meta,key))) {
        fail('PROGRAM_OPENING_RELATION_CHANGED')
      }
    }else if(relation.kind==='committed-fresh-cut0-source'&&(relation.inheritance.childSessionId!==sid
      ||relation.inheritance.nativeCut.kind!=='reserved-fresh-branch'||relation.inheritance.nativeCut.seedLength!==0)) {
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
  function capture(source:PromptOpeningSourceProofV1,identity:CaptureIdentity):ProgramOpeningBasisProofV1 {
    if(identity.sessionId!==source.source.sessionId)fail('PROGRAM_OPENING_IDENTITY_INVALID')
    const actual=native(source)
    if(actual.events.some(oldOpening))fail('PROGRAM_OPENING_PREVIOUS_OPENING_PRESENT')
    deps.assertOwnedBranchRows(identity,[])
    const relation=source.sourceRelation,
      sourceRelation=relation.kind==='own-root-source'?{kind:'own-root' as const,inheritance:null}:
        relation.kind==='legacy-fresh-copy-source'?{kind:'legacy-fresh-child' as const,legacyCopy:relation.legacyCopy}:
        {kind:'reserved-fresh-child' as const,inheritance:relation.inheritance,setup:relation.setup,
          setupSha256:recordSha256(relation.setup)}
    const body={schemaVersion:1 as const,encoding:'native-program-opening-fresh-basis-proof-v1' as const,
      authority:'consumer-data-only' as const,sessionId:identity.sessionId,ownerSessionId:identity.sessionId,
      origin:relation.kind==='own-root-source'?'own-root' as const:'fresh-scene' as const,
      operationId:identity.operationId,requestedMessageId:identity.requestedMessageId,
      sourceBindingSha256:source.bindingSha256,sourceRelation,branch:actual.branch,
      native:{observedThroughSeq:actual.events.length-1,eventCount:actual.events.length,
        historySha256:recordSha256(actual.events)}}
    return frozen({...body,basisSha256:recordSha256(body)})
  }
  function currentBefore(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramOpeningIdentityV1,ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {
      const actual=native(source),{basisSha256,...body}=proof
      deps.assertOwnedBranchRows(identity,ownedRows)
      return basisSha256===recordSha256(body)&&identity.sessionId===proof.sessionId
        &&identity.operationId===proof.operationId&&identity.requestedMessageId===proof.requestedMessageId
        &&source.bindingSha256===proof.sourceBindingSha256&&same(actual.branch,proof.branch)
        &&actual.events.length===proof.native.eventCount&&actual.events.length-1===proof.native.observedThroughSeq
        &&recordSha256(actual.events)===proof.native.historySha256&&!actual.events.some(oldOpening)
    }catch{return false}
  }
  function prefixMatches(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramOpeningIdentityV1,actual:ReturnType<typeof nativeFrameFacts>):boolean {
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
    identity:ProgramOpeningIdentityV1,invocationRef:{readonly seq:number;readonly sha256:string},
    ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {deps.assertSourceCurrent(source);return currentDuringFacts(proof,source,identity,invocationRef,ownedRows)}
    catch{return false}
  }
  /** Native/basis DATA only. The actual InputState supplier has already joined
   * its captured current author Source; this result grants no Source rights. */
  function currentDuringFacts(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramOpeningIdentityV1,invocationRef:{readonly seq:number;readonly sha256:string},
    ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {
      const sid=source.source.sessionId,metaKey=sid+'__meta',
        actual=nativeFrameFacts(source,deps.session(sid),metaKey,deps.tables.branch.get(metaKey)),
        invocation=invocationDuringFacts(proof,source,identity,invocationRef,actual)
      if(!invocation)return false
      deps.assertOwnedBranchRows(identity,ownedRows)
      return true
    }catch{return false}
  }
  function invocationDuringFacts(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramOpeningIdentityV1,invocationRef:{readonly seq:number;readonly sha256:string},
    actual:ReturnType<typeof nativeFrameFacts>):ReturnType<typeof validateNativeOpeningInvocationV1>|undefined {
    if(!prefixMatches(proof,source,identity,actual)||invocationRef.seq!==proof.native.eventCount
      ||!deps.isOpeningInvocationCurrent(identity,invocationRef))return
    const event=actual.events[invocationRef.seq]
    if(event?.type!=='opening/invocation'||nativeInputSha256(event)!==invocationRef.sha256)return
    const invocation=validateNativeOpeningInvocationV1(event.data)
    if(invocation.identity.sessionId!==identity.sessionId||invocation.identity.operationId!==identity.operationId
      ||invocation.identity.messageId!==identity.requestedMessageId)return
    return invocation
  }
  function assertGeneratedSpan(actual:ReturnType<typeof nativeFrameFacts>,facts:ProgramOpeningNativeFactsV1):void {
    if(facts.production!=='generated-opening')return
    const {turn,turnStartRef,turnEndRef}=facts.receipt,start=actual.events[turnStartRef.seq],end=actual.events[turnEndRef.seq]
    if(start?.type!=='turn/start'||start.data?.turn!==turn||nativeInputSha256(start)!==turnStartRef.sha256
      ||end?.type!=='turn/end'||end.data?.turn!==turn||nativeInputSha256(end)!==turnEndRef.sha256) {
      fail('PROGRAM_OPENING_NATIVE_SPAN_CHANGED')
    }
  }
  function historicalFactsCurrent(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramOpeningIdentityV1,facts:ProgramOpeningNativeFactsV1):boolean {
    try {
      const start=facts.production==='selected-card-copy'?facts.receipt.turnStartSeq:facts.receipt.invocationRef.seq,
        dataHashes=programOpeningBasisDataHashesV1(proof,source,identity),relation=source.sourceRelation,
        expected=dataHashes?undefined:relation.kind==='own-root-source'?{kind:'own-root',inheritance:null}:
          relation.kind==='legacy-fresh-copy-source'?{kind:'legacy-fresh-child',legacyCopy:relation.legacyCopy}:
          {kind:'reserved-fresh-child',inheritance:relation.inheritance,setup:relation.setup,
            setupSha256:recordSha256(relation.setup)}
      // This completed-read contract retains the publisher's historical
      // relation equality even for callers outside the input-record parser.
      return (dataHashes?dataHashes.sourceRelationSha256===dataHashes.expectedSourceRelationSha256:
        same(proof.sourceRelation,expected))&&prefixMatches(proof,source,identity,historicalNative(source))
        &&start===proof.native.eventCount
        &&deps.isNativeFactsCurrent(identity,facts)
    }catch{return false}
  }
  function currentForAbsencePublication(proof:ProgramOpeningBasisProofV1,source:PromptOpeningSourceProofV1,
    identity:ProgramOpeningIdentityV1,facts:ProgramOpeningNativeFactsV1,
    ownedRows:readonly ProgramOpeningOwnedBranchRowV1[]):boolean {
    try {
      deps.assertSourceCurrent(source)
      if(source.initialization.kind!=='absent'||!historicalFactsCurrent(proof,source,identity,facts))return false
      const actual=native(source),end=facts.production==='selected-card-copy'?facts.receipt.turnEndSeq:facts.receipt.turnEndRef.seq
      // Generated publication runs inside Native's live closing callback.
      // Its receipt owns the completed span while inbox and ordinary owners
      // can append their independent events before the closing ACK.
      if(facts.production==='selected-card-copy'&&actual.events.at(-1)?.seq!==end)return false
      assertGeneratedSpan(actual,facts)
      deps.assertOwnedBranchRows(identity,ownedRows)
      return true
    }catch{return false}
  }
  return {capture,currentBefore,currentDuring,currentDuringFacts,currentForAbsencePublication,historicalFactsCurrent}
}
