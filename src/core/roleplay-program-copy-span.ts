/** Pure shared copy-span facts and their interfaces. Root validates immutable
 * seed/input/intent and owns lookup/flush/current permission. No Native runtime
 * import enters the old legacy reader's pure dependency closure. */
import {recordSha256,sha256} from './roleplay-data.js'
import type {MvuNativeOpeningReceipt} from './roleplay-mvu-initialization.js'
import type {StoryEvent,WorldlineMessageEdits} from './roleplay-worldline-types.js'

export interface ProgramCardCopyNativeIdentityV1 {
  readonly sessionId:string
  readonly importId:string
  readonly operationId:string
  readonly requestedMessageId:string
  readonly renderedText:string
  readonly renderedSha256:string
}
export interface ProgramCardCopyNativeObservationV1 {
  readonly id:string
  readonly header?:{readonly id?:unknown;readonly parentSession?:unknown}
  readonly inheritedEventCount:number
  readonly seq?:number
  readonly events:readonly StoryEvent[]
  readonly surfaceNodes?:readonly number[]
  /** Lazy actual legacy fold preserves old short-circuit/read order. New Root
   * suppliers may pass their actual immutable deletion cut directly. */
  readonly deletedMessageIds:readonly string[]|(()=>readonly string[])
  /** Optional solely to preserve old reader's existing loaded-view contract.
   * New Root suppliers must supply the actual registered projection reader. */
  readonly deriveEventMessage?:((event:StoryEvent)=>unknown)
}
export interface ProgramCardCopyNativeReadInputV1 {
  readonly identity:ProgramCardCopyNativeIdentityV1
  /** Already owned/verified SDK acknowledgement, not an id/text inference. */
  readonly acknowledgedTurn:number
  readonly observation:ProgramCardCopyNativeObservationV1
  readonly messageEdits:Pick<WorldlineMessageEdits,'latest'>
}
export interface ProgramInheritedOpeningOriginV1 {
  readonly sessionId:string
  readonly inheritedEventCount:number
}
/** Source owns this record-hash cut. Native generated references use their
 * independent native-input hash encoding over the same actual prefix. */
export interface ProgramInheritedOpeningSourceCutV1 {
  readonly seedLength:number
  readonly prefixEncoding:'record-sha256-native-events-prefix-v1'
  readonly prefixSha256:string
}
export interface ProgramInheritedCardCopyNativeObservationV1 extends ProgramCardCopyNativeObservationV1 {
  readonly header:{readonly id?:unknown;readonly parentSession?:unknown}
  readonly seq:number
  readonly surfaceNodes:readonly number[]
  readonly deriveEventMessage:(event:StoryEvent)=>unknown
}
export interface ProgramInheritedCardCopyNativeReadInputV1 extends Omit<ProgramCardCopyNativeReadInputV1,'observation'> {
  readonly kind:'inherited-opening-carrier-v1'
  readonly observation:ProgramInheritedCardCopyNativeObservationV1
  readonly origin:ProgramInheritedOpeningOriginV1
  readonly sourceCut:ProgramInheritedOpeningSourceCutV1
  /** Root's actual carrier/Source/archive currency; not a serialized grant. */
  readonly assertCurrent:()=>void
}
/** Actual retained prefix, not a current Session or a current-visible surface.
 * Root supplies the real observation length separately from this exact cut. */
export interface ProgramRetainedCardCopyPublicationObservationV1 {
  readonly id:string
  readonly header:{readonly id?:unknown;readonly parentSession?:unknown}
  readonly inheritedEventCount:number
  readonly observedSeq:number
  readonly events:readonly StoryEvent[]
  readonly surfaceNodes:readonly number[]
  readonly deriveEventMessage:(event:StoryEvent)=>unknown
}
export interface ProgramInheritedCardCopyPublicationReadInputV1
  extends Omit<ProgramInheritedCardCopyNativeReadInputV1,'observation'> {
  readonly observation:ProgramRetainedCardCopyPublicationObservationV1
}
export type ProgramCardCopyPublicationFactsReadV1={readonly kind:'complete';readonly production:'selected-card-copy';
  readonly scope:'retained-byte-publication';readonly navigationCurrentEvidence:'not-checked';
  readonly durability:'caller-owned-not-proven';readonly receipt:MvuNativeOpeningReceipt}
  |{readonly kind:'unknown';readonly code:string}
export type ProgramCardCopyNativeSpanFactsV1=Omit<MvuNativeOpeningReceipt,'flushed'>
export type ProgramCardCopyNativeSpanReadV1={readonly kind:'matched';readonly facts:ProgramCardCopyNativeSpanFactsV1}
  |{readonly kind:'unknown';readonly code:string}
export type ProgramCardCopyNativeReadV1={readonly kind:'complete';readonly production:'selected-card-copy';
  readonly durability:'caller-owned-not-proven';readonly receipt:MvuNativeOpeningReceipt}
  |{readonly kind:'unknown';readonly code:string}
const unknown=(code:string):{kind:'unknown';code:string}=>({kind:'unknown',code})
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=0&&!Object.is(value,-0)
const sourceOf=(event:StoryEvent)=>event.data?.message?.source as Record<string,unknown>|undefined
const programmaticOf=(event:StoryEvent)=>event.data?.['programmatic'] as Record<string,unknown>|undefined

/** Shared old/new exact card-copy span. The old strict intent reader remains
 * the authority for its row, Source and acknowledgement preconditions. Facts
 * intentionally omit flushed; only the actual caller owns that assertion. */
export function verifyProgrammaticCardCopySpanV1(input:ProgramCardCopyNativeReadInputV1):ProgramCardCopyNativeSpanReadV1 {
  try {
    const {identity,observation,acknowledgedTurn,messageEdits}=input,events=observation.events,
      boundary=observation.inheritedEventCount
    if(!integer(acknowledgedTurn)||observation.id!==identity.sessionId
      ||!integer(boundary)||boundary>events.length||events.some((event,index)=>event.seq!==index)
      ||observation.seq!==undefined&&observation.seq!==events.length
      ||typeof identity.renderedText!=='string'||Buffer.byteLength(identity.renderedText,'utf8')>65_536
      ||sha256(identity.renderedText)!==identity.renderedSha256)return unknown('PROGRAM_COPY_HISTORY_OR_IDENTITY_INVALID')
    return verifyCopySpanFromOriginV1(input,events,boundary)
  }catch{return unknown('PROGRAM_COPY_FACTS_INVALID')}
}
/** Only the named mode-specific gates call this private fold. The original
 * opening boundary is explicit; the actual carrier object is never renamed. */
function verifyCopySpanFromOriginV1(input:ProgramCardCopyNativeReadInputV1|ProgramInheritedCardCopyPublicationReadInputV1,
  events:readonly StoryEvent[],boundary:number,mode:'current-visible'|'retained-publication'='current-visible')
  :ProgramCardCopyNativeSpanReadV1 {
  try {
    const {identity,observation,acknowledgedTurn,messageEdits}=input
    const starts=events.filter(event=>event.type==='turn/start'),candidates=starts.filter(event=>
      programmaticOf(event)?.['operationId']===identity.operationId
      ||programmaticOf(event)?.['messageId']===identity.requestedMessageId),start=candidates[0],
      expectedMarker={schemaVersion:1,operationId:identity.operationId,messageId:identity.requestedMessageId,
        producer:'dsh-nexttavern',origin:`card-opening:${identity.importId}`,textSha256:identity.renderedSha256}
    if(candidates.length!==1||!start||start.data?.turn!==acknowledgedTurn
      ||!same(programmaticOf(start),expectedMarker)
      ||starts.filter(event=>event.data?.turn===acknowledgedTurn).length!==1)return unknown('PROGRAM_COPY_TURN_UNPROVEN')
    const assistants=events.filter(event=>event.type==='assistant/message'
      &&(event.data?.message?.id===identity.requestedMessageId||sourceOf(event)?.['operationId']===identity.operationId)),
      assistant=assistants[0],message=assistant?.data?.message,
      expectedSource={kind:'programmatic',schemaVersion:1,producer:'dsh-nexttavern',
        origin:`card-opening:${identity.importId}`,operationId:identity.operationId}
    if(assistants.length!==1||!assistant||!message||message.id!==identity.requestedMessageId||message.role!=='assistant'
      ||!same(message.source,expectedSource)||!Array.isArray(message.content)
      ||!same(message.content,[{type:'text',text:identity.renderedText}])||assistant.data?.turn!==acknowledgedTurn
      ||assistant.data?.step!==1||!same(assistant.data?.['stream'],[]))return unknown('PROGRAM_COPY_ASSISTANT_UNPROVEN')
    const ends=events.filter(event=>event.type==='turn/end'&&event.data?.turn===acknowledgedTurn),end=ends[0]
    if(ends.length!==1||!end||!same(end.data?.reason,{kind:'completed'})
      ||!(boundary<=start.seq&&start.seq<assistant.seq&&assistant.seq<end.seq))return unknown('PROGRAM_COPY_TERMINAL_UNPROVEN')
    const span=events.slice(start.seq,end.seq+1),stepStarts=span.filter(event=>event.type==='step/start'),
      stepEnds=span.filter(event=>event.type==='step/end'),stepStart=stepStarts[0],stepEnd=stepEnds[0]
    if(span.filter(event=>event.type==='turn/start').length!==1||span.filter(event=>event.type==='turn/end').length!==1
      ||span.filter(event=>event.type==='assistant/message').length!==1||stepStarts.length!==1||stepEnds.length!==1
      ||!stepStart||!stepEnd||stepStart.data?.turn!==acknowledgedTurn||stepEnd.data?.turn!==acknowledgedTurn
      ||stepStart.data?.step!==1||stepEnd.data?.step!==1
      ||!(start.seq<stepStart.seq&&stepStart.seq<assistant.seq&&assistant.seq<stepEnd.seq&&stepEnd.seq<end.seq)
      ||span.some(event=>!['turn/start','step/start','system/message','assistant/message','step/end','turn/end'].includes(event.type))) {
      return unknown('PROGRAM_COPY_SPAN_UNPROVEN')
    }
    const nodes=observation.surfaceNodes,currentObservation=observation as ProgramCardCopyNativeObservationV1
    if(!Array.isArray(nodes)||nodes.filter(seq=>seq===assistant.seq).length!==1
      ||messageEdits.latest(events,assistant.seq)!==null
      ||mode==='current-visible'&&(typeof currentObservation.deletedMessageIds==='function'
        ?currentObservation.deletedMessageIds():currentObservation.deletedMessageIds).includes(identity.requestedMessageId)
      ||observation.deriveEventMessage&&!same(observation.deriveEventMessage(assistant),message)) {
      return unknown('PROGRAM_COPY_ORIGINAL_VERSION_CHANGED')
    }
    return {kind:'matched',facts:{sessionId:identity.sessionId,operationId:identity.operationId,
      messageId:identity.requestedMessageId,renderedSha256:identity.renderedSha256,turn:acknowledgedTurn,
      assistantSeq:assistant.seq,turnStartSeq:start.seq,turnEndSeq:end.seq,
      messageVersion:{kind:'original',eventSha256:recordSha256(assistant)}}}
  }catch{return unknown('PROGRAM_COPY_FACTS_INVALID')}
}
/** Original copy facts inside a real positive child cut, followed by full
 * current-carrier projection/edit/deletion checks. No lookup or flush occurs. */
export function verifyInheritedProgrammaticCardCopySpanV1(input:ProgramInheritedCardCopyNativeReadInputV1)
  :ProgramCardCopyNativeSpanReadV1 {
  try {
    if(typeof input.assertCurrent!=='function')return unknown('PROGRAM_COPY_INHERITED_OWNER_UNAVAILABLE')
    input.assertCurrent()
    const result=inheritedCopySpanFactsV1(input)
    input.assertCurrent()
    return result
  }catch{return unknown('PROGRAM_COPY_INHERITED_CURRENT_REFUSED')}
}
function inheritedCopySpanFactsV1(input:ProgramInheritedCardCopyNativeReadInputV1):ProgramCardCopyNativeSpanReadV1 {
  const {identity,observation,origin,sourceCut}=input,events=observation.events
  if(input.kind!=='inherited-opening-carrier-v1'||typeof observation.id!=='string'||!observation.id
    ||observation.id===origin.sessionId||!observation.header
    ||observation.header.id!==undefined&&observation.header.id!==observation.id
    ||typeof observation.header.parentSession!=='string'||!observation.header.parentSession
    ||observation.header.parentSession===observation.id||typeof origin.sessionId!=='string'||!origin.sessionId
    ||origin.sessionId!==identity.sessionId
    ||!integer(origin.inheritedEventCount)||!integer(observation.inheritedEventCount)
    ||!integer(observation.seq)||observation.seq!==events.length
    ||events.some((event,index)=>!integer(event.seq)||event.seq!==index)
    ||!integer(sourceCut.seedLength)||sourceCut.seedLength===0||sourceCut.seedLength!==observation.inheritedEventCount
    ||sourceCut.seedLength>events.length||origin.inheritedEventCount>=sourceCut.seedLength
    ||sourceCut.prefixEncoding!=='record-sha256-native-events-prefix-v1'
    ||typeof sourceCut.prefixSha256!=='string'||!/^[a-f0-9]{64}$/.test(sourceCut.prefixSha256)
    ||recordSha256(events.slice(0,sourceCut.seedLength))!==sourceCut.prefixSha256
    ||typeof observation.deriveEventMessage!=='function'||!Array.isArray(observation.surfaceNodes)
    ||!integer(input.acknowledgedTurn)||typeof identity.renderedText!=='string'
    ||Buffer.byteLength(identity.renderedText,'utf8')>65_536||sha256(identity.renderedText)!==identity.renderedSha256) {
    return unknown('PROGRAM_COPY_INHERITED_CARRIER_INVALID')
  }
  return inheritedCopyCarrierSpanFactsV1(input,events,'current-visible',identity,origin,sourceCut)
}
/** New factual entry has no deletion input. It cannot claim current visibility.
 * Original current wrappers above keep their full-carrier and deletion checks. */
export function verifyInheritedProgrammaticCardCopyPublicationSpanV1(input:ProgramInheritedCardCopyPublicationReadInputV1)
  :ProgramCardCopyNativeSpanReadV1 {
  try {
    const assertCurrent=input.assertCurrent
    if(typeof assertCurrent!=='function')return unknown('PROGRAM_COPY_PUBLICATION_OWNER_UNAVAILABLE')
    if(Reflect.apply(assertCurrent,input,[])!==undefined)return unknown('PROGRAM_COPY_PUBLICATION_OWNER_INVALID')
    const observation=input.observation,events=observation.events,cut=input.sourceCut,cutLength=cut.seedLength,
      cutSha256=cut.prefixSha256,derive=observation.deriveEventMessage,latest=input.messageEdits.latest,
      result=inheritedCopyPublicationSpanFactsV1(input)
    if(Reflect.apply(assertCurrent,input,[])!==undefined)return unknown('PROGRAM_COPY_PUBLICATION_OWNER_INVALID')
    if(input.assertCurrent!==assertCurrent||input.observation!==observation||observation.events!==events
      ||input.sourceCut!==cut||cut.seedLength!==cutLength||cut.prefixSha256!==cutSha256
      ||events.length!==cutLength||recordSha256(events)!==cutSha256
      ||observation.deriveEventMessage!==derive||input.messageEdits.latest!==latest)
      return unknown('PROGRAM_COPY_PUBLICATION_READERS_CHANGED')
    return result
  }catch{return unknown('PROGRAM_COPY_PUBLICATION_CURRENT_REFUSED')}
}
function inheritedCopyPublicationSpanFactsV1(input:ProgramInheritedCardCopyPublicationReadInputV1):ProgramCardCopyNativeSpanReadV1 {
  const {observation,origin,sourceCut,identity}=input,events=observation.events
  if(input.kind!=='inherited-opening-carrier-v1'||typeof observation.id!=='string'||!observation.id
      ||observation.id===origin.sessionId||!observation.header
      ||observation.header.id!==undefined&&observation.header.id!==observation.id
      ||typeof observation.header.parentSession!=='string'||!observation.header.parentSession
      ||observation.header.parentSession===observation.id||typeof origin.sessionId!=='string'||!origin.sessionId
      ||origin.sessionId!==identity.sessionId||!integer(origin.inheritedEventCount)
      ||!integer(observation.inheritedEventCount)||!integer(observation.observedSeq)
      ||!integer(sourceCut.seedLength)||sourceCut.seedLength===0||events.length!==sourceCut.seedLength
      ||observation.observedSeq<events.length||sourceCut.seedLength!==observation.inheritedEventCount
      ||origin.inheritedEventCount>=sourceCut.seedLength
      ||events.some((event,index)=>!integer(event.seq)||event.seq!==index)
      ||sourceCut.prefixEncoding!=='record-sha256-native-events-prefix-v1'
      ||typeof sourceCut.prefixSha256!=='string'||!/^[a-f0-9]{64}$/.test(sourceCut.prefixSha256)
      ||recordSha256(events)!==sourceCut.prefixSha256||typeof observation.deriveEventMessage!=='function'
      ||typeof input.messageEdits.latest!=='function'
      ||!Array.isArray(observation.surfaceNodes)||!integer(input.acknowledgedTurn)
      ||typeof identity.renderedText!=='string'||Buffer.byteLength(identity.renderedText,'utf8')>65_536
      ||sha256(identity.renderedText)!==identity.renderedSha256) {
      return unknown('PROGRAM_COPY_PUBLICATION_CARRIER_INVALID')
    }
  return inheritedCopyCarrierSpanFactsV1(input,events,'retained-publication',identity,origin,sourceCut)
}
/** Both gates inspect every event in their chosen carrier window. The retained
 * gate owns an exact prefix; the current gate owns the entire current carrier. */
function inheritedCopyCarrierSpanFactsV1(input:ProgramInheritedCardCopyNativeReadInputV1|ProgramInheritedCardCopyPublicationReadInputV1,
  events:readonly StoryEvent[],mode:'current-visible'|'retained-publication',identity:ProgramCardCopyNativeIdentityV1,
  origin:ProgramInheritedOpeningOriginV1,sourceCut:ProgramInheritedOpeningSourceCutV1):ProgramCardCopyNativeSpanReadV1 {
  // A generated writer in the selected window cannot reuse this operation or
  // output id. Current callers pass the full carrier; publication passes cut.
  for(const event of events)if(event.type==='opening/invocation'||event.type==='opening/generated-receipt') {
    const candidate=event.data?.['identity'] as Record<string,unknown>|undefined
    if(candidate?.operationId===identity.operationId||candidate?.messageId===identity.requestedMessageId) {
      return unknown('PROGRAM_COPY_INHERITED_OPERATION_CONFLICT')
    }
  }
  const matched=verifyCopySpanFromOriginV1(input,events,origin.inheritedEventCount,mode)
  if(matched.kind!=='matched')return matched
  // A later user/system/tool event cannot reuse this original output ID.
  // Only the inherited gate adds this full-carrier uniqueness contract.
  const idEvents=events.filter(event=>event.type==='user/message'
    ?event.data?.['id']===identity.requestedMessageId
    :['assistant/message','system/message','developer/message','tool/result'].includes(event.type)
      &&event.data?.message?.id===identity.requestedMessageId)
  if(idEvents.length!==1||idEvents[0]?.seq!==matched.facts.assistantSeq)
    return unknown('PROGRAM_COPY_INHERITED_MESSAGE_ID_AMBIGUOUS')
  if(matched.facts.turnEndSeq>=sourceCut.seedLength)return unknown('PROGRAM_COPY_INHERITED_SPAN_OUTSIDE_CUT')
  return matched
}
