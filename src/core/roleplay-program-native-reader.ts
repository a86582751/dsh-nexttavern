/** Synchronous actual Native facts only. No intent cast, Session/Agent creation,
 * lookup, flush, append, model request, protected renderer or Source grant. */
import {recordSha256,sha256} from './roleplay-data.js'
import {types as utilTypes} from 'node:util'
import {inspectNativeOpeningGenerationObservationV1,inspectInheritedOpeningGenerationObservationV1,nativeInputSha256}
  from '@deepseek-ai/dsh-agent-loop'
import type {Session,SessionEvent,SessionMessageProjection} from '@deepseek-ai/dsh-session'
import type {NativeOpeningIdentityV1,NativeGeneratedOpeningReceiptV1,NativeOpeningClosingAckV1,
  NativeOpeningEventRefV1,NativeOpeningHistoryObservationV1,NativeOpeningGenerationInspectionV1} from '@deepseek-ai/dsh-agent-loop'
import type {StoryEvent,WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'
import {verifyProgrammaticCardCopySpanV1,verifyInheritedProgrammaticCardCopySpanV1,
  verifyInheritedProgrammaticCardCopyPublicationSpanV1} from './roleplay-program-copy-span.js'
import type {ProgramCardCopyNativeReadInputV1,ProgramCardCopyNativeReadV1,ProgramInheritedCardCopyNativeReadInputV1,
  ProgramInheritedOpeningOriginV1,ProgramInheritedOpeningSourceCutV1,
  ProgramInheritedCardCopyPublicationReadInputV1,ProgramCardCopyPublicationFactsReadV1} from './roleplay-program-copy-span.js'
export {verifyProgrammaticCardCopySpanV1,verifyInheritedProgrammaticCardCopySpanV1} from './roleplay-program-copy-span.js'
export type {ProgramCardCopyNativeIdentityV1,ProgramCardCopyNativeObservationV1,ProgramCardCopyNativeReadInputV1,
  ProgramCardCopyNativeSpanFactsV1,ProgramCardCopyNativeSpanReadV1,ProgramCardCopyNativeReadV1,
  ProgramInheritedCardCopyNativeReadInputV1,ProgramInheritedCardCopyNativeObservationV1,
  ProgramInheritedOpeningOriginV1,ProgramInheritedOpeningSourceCutV1}
  from './roleplay-program-copy-span.js'
export type {ProgramRetainedCardCopyPublicationObservationV1,ProgramInheritedCardCopyPublicationReadInputV1,
  ProgramCardCopyPublicationFactsReadV1} from './roleplay-program-copy-span.js'

export interface ProgramGeneratedNativeReadInputV1 {
  readonly session:Session
  readonly identity:NativeOpeningIdentityV1
  readonly projections:readonly SessionMessageProjection[]
  readonly messageEdits:Pick<WorldlineMessageEdits,'latest'>
  readonly deletedMessageIds:readonly string[]
}
/** Facts from Root's actual retained Native cut and official projection.
 * Header provenance/current Source/worldline permission stay with that owner. */
export interface ProgramGeneratedNativeObservationV1 extends NativeOpeningHistoryObservationV1 {
  readonly header?:{readonly id?:unknown;readonly parentSession?:unknown}
  readonly seq:number
  readonly surfaceNodes:readonly number[]
  readonly deriveEventMessage:(event:SessionEvent)=>unknown
}
export interface ProgramGeneratedNativeObservationReadInputV1 {
  readonly observation:ProgramGeneratedNativeObservationV1
  readonly identity:NativeOpeningIdentityV1
  readonly projections:readonly SessionMessageProjection[]
  readonly messageEdits:Pick<WorldlineMessageEdits,'latest'>
  readonly deletedMessageIds:readonly string[]
  /** Original private retained-cut/current callback. A JSON observation cannot
   * supply provenance, frozen Source/prefix currency or publication permission. */
  readonly assertCurrent:()=>void
}
export interface ProgramInheritedGeneratedNativeObservationReadInputV1
  extends Omit<ProgramGeneratedNativeObservationReadInputV1,'observation'> {
  readonly kind:'inherited-opening-carrier-v1'
  readonly observation:ProgramGeneratedNativeObservationV1&{
    readonly header:{readonly id?:unknown;readonly parentSession?:unknown}
  }
  readonly origin:ProgramInheritedOpeningOriginV1
  readonly sourceCut:ProgramInheritedOpeningSourceCutV1
}
/** Prefix bytes from an actual carrier. observedSeq is the actual reader's
 * observed history length; no Session.seq or inherited boundary is rewritten. */
export interface ProgramRetainedGeneratedPublicationObservationV1 extends NativeOpeningHistoryObservationV1 {
  readonly id:string
  readonly header:{readonly id?:unknown;readonly parentSession?:unknown}
  readonly inheritedEventCount:number
  readonly observedSeq:number
  readonly surfaceNodes:readonly number[]
  readonly deriveEventMessage:(event:SessionEvent)=>unknown
}
export interface ProgramInheritedGeneratedPublicationReadInputV1
  extends Omit<ProgramInheritedGeneratedNativeObservationReadInputV1,'observation'|'deletedMessageIds'> {
  readonly observation:ProgramRetainedGeneratedPublicationObservationV1
}
export type ProgramGeneratedNativeReadV1={readonly kind:'complete';readonly production:'generated-opening';
  readonly durability:'caller-owned-not-proven';readonly receipt:NativeGeneratedOpeningReceiptV1;
  readonly canonical:CompletedStoryBody;readonly generatedReceiptRef:NativeOpeningEventRefV1;
  readonly closingAck?:{readonly ref:NativeOpeningEventRefV1;readonly data:NativeOpeningClosingAckV1}}
  |{readonly kind:'absent'}|{readonly kind:'unknown';readonly code:string}
export type ProgramGeneratedPublicationFactsReadV1={readonly kind:'complete';readonly production:'generated-opening';
  readonly scope:'retained-byte-publication';readonly navigationCurrentEvidence:'not-checked';
  readonly durability:'caller-owned-not-proven';readonly receipt:NativeGeneratedOpeningReceiptV1;
  readonly canonical:CompletedStoryBody;readonly generatedReceiptRef:NativeOpeningEventRefV1;
  readonly closingAck:{readonly ref:NativeOpeningEventRefV1;readonly data:NativeOpeningClosingAckV1}}
  |{readonly kind:'unknown';readonly code:string}

const unknown=(code:string):{kind:'unknown';code:string}=>({kind:'unknown',code})
const integer=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)
  &&value>=0&&!Object.is(value,-0)
export function readProgramCardCopyNativeV1(input:ProgramCardCopyNativeReadInputV1):ProgramCardCopyNativeReadV1 {
  if(typeof input.observation.deriveEventMessage!=='function')return unknown('PROGRAM_COPY_PROJECTION_UNAVAILABLE')
  const matched=verifyProgrammaticCardCopySpanV1(input)
  if(matched.kind!=='matched')return matched
  // Preserve the old receipt format. This literal is a caller-owned precondition
  // carried as data; this reader performed no durability operation or lookup.
  return {kind:'complete',production:'selected-card-copy',durability:'caller-owned-not-proven',
    receipt:{...matched.facts,flushed:true}}
}
export function readInheritedProgramCardCopyNativeV1(input:ProgramInheritedCardCopyNativeReadInputV1)
  :ProgramCardCopyNativeReadV1 {
  const matched=verifyInheritedProgrammaticCardCopySpanV1(input)
  if(matched.kind!=='matched')return matched
  return {kind:'complete',production:'selected-card-copy',durability:'caller-owned-not-proven',
    receipt:{...matched.facts,flushed:true}}
}
/** Historical publication facts only; current navigation evidence is absent
 * from this interface and must be checked independently by the actual subject. */
export function readInheritedProgramCardCopyPublicationFactsV1(input:ProgramInheritedCardCopyPublicationReadInputV1)
  :ProgramCardCopyPublicationFactsReadV1 {
  const matched=verifyInheritedProgrammaticCardCopyPublicationSpanV1(input)
  if(matched.kind!=='matched')return matched
  return Object.freeze({kind:'complete' as const,production:'selected-card-copy' as const,
    scope:'retained-byte-publication' as const,navigationCurrentEvidence:'not-checked' as const,
    durability:'caller-owned-not-proven' as const,receipt:Object.freeze({...matched.facts,
      messageVersion:Object.freeze({...matched.facts.messageVersion}),flushed:true as const})})
}
function messageIdOf(event:SessionEvent):string|undefined {
  if(event.type==='user/message')return String(event.data.id)
  if(event.type==='assistant/message'||event.type==='system/message'
    ||event.type==='developer/message'||event.type==='tool/result')return String(event.data.message.id)
}
export function readProgramGeneratedNativeV1(input:ProgramGeneratedNativeReadInputV1):ProgramGeneratedNativeReadV1 {
  try {
    const {session,identity,projections,messageEdits,deletedMessageIds}=input,events=session.snapshotEvents()
    return readProgramGeneratedNativeFactsV1({identity,projections,messageEdits,deletedMessageIds,
      // Keep actual Session fields lazy: an absent/invalid Native proof must
      // retain the original short-circuit before materializing the surface.
      observation:{events,get id(){return String(session.id)},get header(){return session.header},
        get seq(){return Number(session.seq)},get inheritedEventCount(){return Number(session.inheritedEventCount)},
        get surfaceNodes(){return session.surface.nodes},
        deriveEventMessage:event=>session.deriveEventMessage(event)}})
  }catch{return unknown('PROGRAM_GENERATED_FACTS_INVALID')}
}
/** Named cold/ancestor entry: actual owner facts and private currency are
 * mandatory. This reads only; no Session cast, Agent lookup or live right exists. */
export function readProgramGeneratedNativeObservationV1(input:ProgramGeneratedNativeObservationReadInputV1)
  :ProgramGeneratedNativeReadV1 {
  try {
    if(typeof input.assertCurrent!=='function')return unknown('PROGRAM_GENERATED_OBSERVATION_OWNER_UNAVAILABLE')
    input.assertCurrent()
    const result=readProgramGeneratedNativeFactsV1(input)
    input.assertCurrent()
    return result
  }catch{return unknown('PROGRAM_GENERATED_OBSERVATION_CURRENT_REFUSED')}
}
function readProgramGeneratedNativeFactsV1(input:Omit<ProgramGeneratedNativeObservationReadInputV1,'assertCurrent'>)
  :ProgramGeneratedNativeReadV1 {
  try {
    const {observation,identity,projections}=input,events=observation.events
    if(String(observation.id)!==identity.sessionId||!integer(Number(observation.seq))||Number(observation.seq)!==events.length
      ||!integer(Number(observation.inheritedEventCount))||Number(observation.inheritedEventCount)>events.length
      ||events.some((event,index)=>Number(event.seq)!==index)) {
      return unknown('PROGRAM_GENERATED_ACTUAL_HISTORY_CHANGED')
    }
    const inspected=inspectNativeOpeningGenerationObservationV1(observation,identity,projections)
    if(inspected.kind!=='complete')return inspected
    return readGeneratedProjectionFactsV1(input,inspected)
  }catch{return unknown('PROGRAM_GENERATED_FACTS_INVALID')}
}
/** Original bytes establish the receipt. An inherited current carrier may
 * project a later edit while retaining that exact historical publication. */
function readGeneratedProjectionFactsV1(input:Omit<ProgramGeneratedNativeObservationReadInputV1,'assertCurrent'>
  |ProgramInheritedGeneratedPublicationReadInputV1,
  inspected:Extract<NativeOpeningGenerationInspectionV1,{kind:'complete'}>,
  mode:'current-visible'|'current-carrier-original'|'retained-publication'='current-visible'):ProgramGeneratedNativeReadV1 {
  const {observation,identity,messageEdits}=input,
    deletedMessageIds=mode!=='retained-publication'
      ?(input as Omit<ProgramGeneratedNativeObservationReadInputV1,'assertCurrent'>).deletedMessageIds:undefined,
    events=observation.events
    if(!inspected.receiptEvent)return unknown('PROGRAM_GENERATED_RECEIPT_NOT_PUBLISHED')
    // A card-copy/other programmatic writer using the same operation or ID
    // cannot coexist with this actual generated invocation, even later.
    if(events.some(event=>event.type==='turn/start'&&(event.data.programmatic?.operationId===identity.operationId
      ||event.data.programmatic?.messageId===identity.messageId)))return unknown('PROGRAM_GENERATED_OPERATION_DUPLICATE')
    const {receipt}=inspected,nodes=observation.surfaceNodes
    const coreEvents=events as unknown as readonly StoryEvent[]
    for(const output of receipt.outputs) {
      const event=events[output.eventRef.seq]
      if(!event||event.type!=='assistant/message'||event.data.message.source.kind!=='model'
        ||event.data.interrupted||event.data.turn!==receipt.turn||event.data.step!==output.step
        ||String(event.data.message.id)!==output.messageId
        ||nativeInputSha256(event)!==output.eventRef.sha256
        ||nativeInputSha256(event.data.message)!==output.messageSha256
        ||events.filter(candidate=>messageIdOf(candidate)===output.messageId).length!==1
        ||nodes.filter(seq=>Number(seq)===output.eventRef.seq).length!==1
        ||mode!=='retained-publication'&&deletedMessageIds!.includes(output.messageId)
        ||mode!=='current-carrier-original'&&(messageEdits.latest(coreEvents,output.eventRef.seq)!==null
          ||nativeInputSha256(observation.deriveEventMessage(event))!==output.messageSha256)) {
        return unknown('PROGRAM_GENERATED_ORIGINAL_OUTPUT_CHANGED')
      }
      const text=event.data.message.content.filter(block=>block.type==='text').map(block=>block.text).join('')
      if(sha256(text)!==output.textSha256)return unknown('PROGRAM_GENERATED_ORIGINAL_TEXT_CHANGED')
    }
    const terminal=events[receipt.terminalOutput.eventRef.seq]
    if(!terminal||terminal.type!=='assistant/message')return unknown('PROGRAM_GENERATED_TERMINAL_MISSING')
    const narrative=terminal.data.message.content.filter(block=>block.type==='text').map(block=>block.text).join(''),
      canonical={seq:Number(terminal.seq),messageId:String(terminal.data.message.id),
        versionSha256:nativeInputSha256(terminal.data.message),narrative}
    if(canonical.seq!==receipt.terminalOutput.eventRef.seq||canonical.messageId!==receipt.terminalOutput.messageId
      ||canonical.versionSha256!==receipt.terminalOutput.messageSha256||sha256(narrative)!==receipt.terminalOutput.textSha256) {
      return unknown('PROGRAM_GENERATED_CANONICAL_CHANGED')
    }
    const receiptEvent=inspected.receiptEvent,generatedReceiptRef=Object.freeze({seq:Number(receiptEvent.seq),
      sha256:nativeInputSha256(receiptEvent)}),ack=inspected.closingAck
    return Object.freeze({kind:'complete' as const,production:'generated-opening' as const,
      durability:'caller-owned-not-proven' as const,
      receipt,canonical:Object.freeze(canonical),generatedReceiptRef,...ack?{closingAck:Object.freeze({
        ref:Object.freeze({seq:Number(ack.seq),sha256:nativeInputSha256(ack)}),data:ack.data})}:{}})
}
/** A private actual child supplier is required before and after factual reads.
 * This never resolves an ancestor Agent or registers a child opening owner. */
export function readInheritedProgramGeneratedNativeObservationV1(input:ProgramInheritedGeneratedNativeObservationReadInputV1)
  :ProgramGeneratedNativeReadV1 {
  try {
    if(typeof input.assertCurrent!=='function')return unknown('PROGRAM_GENERATED_INHERITED_OWNER_UNAVAILABLE')
    input.assertCurrent()
    const result=inheritedGeneratedFactsV1(input)
    input.assertCurrent()
    return result
  }catch{return unknown('PROGRAM_GENERATED_INHERITED_CURRENT_REFUSED')}
}
function inheritedGeneratedFactsV1(input:ProgramInheritedGeneratedNativeObservationReadInputV1):ProgramGeneratedNativeReadV1 {
  const {observation,origin,sourceCut,identity,projections}=input,events=observation.events
  if(input.kind!=='inherited-opening-carrier-v1'||typeof observation.id!=='string'||!observation.id
    ||observation.id===origin.sessionId||!observation.header
    ||observation.header.id!==undefined&&observation.header.id!==observation.id
    ||typeof observation.header.parentSession!=='string'||!observation.header.parentSession
    ||observation.header.parentSession===observation.id||typeof origin.sessionId!=='string'||!origin.sessionId
    ||origin.sessionId!==identity.sessionId
    ||!integer(origin.inheritedEventCount)||!integer(observation.inheritedEventCount)||!integer(observation.seq)
    ||observation.seq!==events.length||events.some((event,index)=>!integer(event.seq)||event.seq!==index)
    ||!integer(sourceCut.seedLength)||sourceCut.seedLength===0||sourceCut.seedLength!==observation.inheritedEventCount
    ||sourceCut.seedLength>events.length||origin.inheritedEventCount>=sourceCut.seedLength
    ||sourceCut.prefixEncoding!=='record-sha256-native-events-prefix-v1'
    ||typeof sourceCut.prefixSha256!=='string'||!/^[a-f0-9]{64}$/.test(sourceCut.prefixSha256)
    ||typeof observation.deriveEventMessage!=='function'||!Array.isArray(observation.surfaceNodes)) {
    return unknown('PROGRAM_GENERATED_INHERITED_CARRIER_INVALID')
  }
  const prefix=events.slice(0,sourceCut.seedLength)
  if(recordSha256(prefix)!==sourceCut.prefixSha256)return unknown('PROGRAM_GENERATED_INHERITED_SOURCE_CUT_CHANGED')
  const inspected=inspectInheritedOpeningGenerationObservationV1({kind:input.kind,carrier:observation,origin,
    cut:{seedLength:sourceCut.seedLength,prefixEncoding:'native-input-sha256-events-prefix-v1',
      prefixSha256:nativeInputSha256(prefix)}},identity,projections)
  if(inspected.kind!=='complete')return inspected.kind==='absent'
    ?unknown('PROGRAM_GENERATED_INHERITED_OPENING_MISSING'):inspected
  return inheritedGeneratedCarrierWindowFactsV1(input,inspected,'current-carrier-original',events,identity)
}
/** The retained gate supplies exactly the preserved prefix; the existing
 * current gate supplies all carrier bytes. Duplicate/edit/derive rules are
 * shared, and only the current gate additionally reads navigation deletion. */
function inheritedGeneratedCarrierWindowFactsV1(input:ProgramInheritedGeneratedNativeObservationReadInputV1
  |ProgramInheritedGeneratedPublicationReadInputV1,
  inspected:Extract<NativeOpeningGenerationInspectionV1,{kind:'complete'}>,
  mode:'current-visible'|'current-carrier-original'|'retained-publication',events:readonly SessionEvent[],identity:NativeOpeningIdentityV1)
  :ProgramGeneratedNativeReadV1 {
  if(!inspected.receiptEvent||!inspected.closingAck)return unknown('PROGRAM_GENERATED_INHERITED_CLOSURE_UNCONFIRMED')
  const invocationRef=inspected.receipt.invocationRef,receiptEvent=inspected.receiptEvent,ack=inspected.closingAck,
    invocations=events.filter(event=>event.type==='opening/invocation'
      &&(event.data.identity.operationId===identity.operationId||event.data.identity.messageId===identity.messageId)),
    receipts=events.filter(event=>event.type==='opening/generated-receipt'
      &&(event.data.invocationRef.seq===invocationRef.seq||event.data.invocationRef.sha256===invocationRef.sha256
        ||event.data.identity.operationId===identity.operationId||event.data.identity.messageId===identity.messageId)),
    acknowledgements=events.filter(event=>event.type==='opening/closing-ack'
      &&(event.data.invocationRef.seq===invocationRef.seq||event.data.invocationRef.sha256===invocationRef.sha256
        ||event.data.generatedReceiptRef.seq===receiptEvent.seq
        ||event.data.generatedReceiptRef.sha256===nativeInputSha256(receiptEvent)
        ||event.data.receiptSha256===inspected.receipt.receiptSha256))
  // Identity uniqueness is checked over this selected observation window.
  // Current callers include today's suffix; publication callers include cut.
  if(invocations.length!==1||invocations[0]!==inspected.invocation||receipts.length!==1||receipts[0]!==receiptEvent
    ||acknowledgements.length!==1||acknowledgements[0]!==ack
    ||events.some(event=>event.type==='assistant/message'&&event.data.message.source.kind==='programmatic'
      &&event.data.message.source.operationId===identity.operationId)) {
    return unknown('PROGRAM_GENERATED_INHERITED_IDENTITY_DUPLICATE')
  }
  return readGeneratedProjectionFactsV1(input,inspected,mode)
}
interface PublicationProjectionPinV1 {
  readonly definition:SessionMessageProjection
  readonly type:string
  readonly project:SessionMessageProjection['project']
}
function publicationProjectionPinsV1(projections:readonly SessionMessageProjection[]):readonly PublicationProjectionPinV1[] {
  if(!Array.isArray(projections)||utilTypes.isProxy(projections))throw Error('PROGRAM_PUBLICATION_PROJECTIONS_INVALID')
  const descriptors=Object.getOwnPropertyDescriptors(projections),length=Object.getOwnPropertyDescriptor(projections,'length')?.value
  if(!integer(length)||Reflect.ownKeys(descriptors).length!==length+1)
    throw Error('PROGRAM_PUBLICATION_PROJECTIONS_INVALID')
  const pins:PublicationProjectionPinV1[]=[],types=new Set<string>()
  for(let index=0;index<length;index++) {
    const slot=descriptors[String(index)],definition=slot&&'value' in slot?slot.value:undefined
    if(!definition||typeof definition!=='object'||utilTypes.isProxy(definition))
      throw Error('PROGRAM_PUBLICATION_PROJECTIONS_INVALID')
    const fields=Object.getOwnPropertyDescriptors(definition),type=fields['type']?.value,project=fields['project']?.value
    if(typeof type!=='string'||!type||types.has(type)||typeof project!=='function'||utilTypes.isProxy(project))
      throw Error('PROGRAM_PUBLICATION_PROJECTIONS_INVALID')
    types.add(type);pins.push({definition,type,project})
  }
  return pins
}
function publicationProjectionPinsCurrentV1(projections:readonly SessionMessageProjection[],pins:readonly PublicationProjectionPinV1[]) {
  const current=publicationProjectionPinsV1(projections)
  return current.length===pins.length&&current.every((pin,index)=>pin.definition===pins[index]!.definition
    &&pin.type===pins[index]!.type&&pin.project===pins[index]!.project)
}
/** Actual retained-byte publication reconstruction. No deletion argument,
 * current visibility result, Session/Agent creation or permission is exposed. */
export function readInheritedProgramGeneratedPublicationFactsV1(input:ProgramInheritedGeneratedPublicationReadInputV1)
  :ProgramGeneratedPublicationFactsReadV1 {
  try {
    const assertCurrent=input.assertCurrent
    if(typeof assertCurrent!=='function')return unknown('PROGRAM_GENERATED_PUBLICATION_OWNER_UNAVAILABLE')
    if(Reflect.apply(assertCurrent,input,[])!==undefined)return unknown('PROGRAM_GENERATED_PUBLICATION_OWNER_INVALID')
    const observation=input.observation,events=observation.events,cut=input.sourceCut,cutLength=cut.seedLength,
      cutSha256=cut.prefixSha256,projections=input.projections,pins=publicationProjectionPinsV1(projections),
      derive=observation.deriveEventMessage,latest=input.messageEdits.latest,
      result=inheritedGeneratedPublicationFactsV1(input)
    if(Reflect.apply(assertCurrent,input,[])!==undefined)return unknown('PROGRAM_GENERATED_PUBLICATION_OWNER_INVALID')
    if(input.assertCurrent!==assertCurrent||input.observation!==observation||observation.events!==events
      ||input.sourceCut!==cut||cut.seedLength!==cutLength||cut.prefixSha256!==cutSha256
      ||events.length!==cutLength||recordSha256(events)!==cutSha256
      ||input.projections!==projections||!publicationProjectionPinsCurrentV1(projections,pins)
      ||observation.deriveEventMessage!==derive||input.messageEdits.latest!==latest) {
      return unknown('PROGRAM_GENERATED_PUBLICATION_READERS_CHANGED')
    }
    if(result.kind!=='complete')return result.kind==='absent'
      ?unknown('PROGRAM_GENERATED_PUBLICATION_OPENING_MISSING'):result
    if(!result.closingAck)return unknown('PROGRAM_GENERATED_PUBLICATION_CLOSURE_UNCONFIRMED')
    return Object.freeze({...result,scope:'retained-byte-publication' as const,
      navigationCurrentEvidence:'not-checked' as const,closingAck:result.closingAck})
  }catch{return unknown('PROGRAM_GENERATED_PUBLICATION_CURRENT_REFUSED')}
}
function inheritedGeneratedPublicationFactsV1(input:ProgramInheritedGeneratedPublicationReadInputV1):ProgramGeneratedNativeReadV1 {
  const {observation,origin,sourceCut,identity,projections}=input,events=observation.events
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
    ||typeof input.messageEdits.latest!=='function'||!Array.isArray(observation.surfaceNodes)) {
    return unknown('PROGRAM_GENERATED_PUBLICATION_CARRIER_INVALID')
  }
  // This inspector validates the original origin separately from the actual
  // carrier and rebuilds receipt/ACK/material from these exact real bytes.
  const inspected=inspectInheritedOpeningGenerationObservationV1({kind:input.kind,carrier:observation,origin,
    cut:{seedLength:sourceCut.seedLength,prefixEncoding:'native-input-sha256-events-prefix-v1',
      prefixSha256:nativeInputSha256(events)}},identity,projections)
  if(inspected.kind!=='complete')return inspected.kind==='absent'
    ?unknown('PROGRAM_GENERATED_PUBLICATION_OPENING_MISSING'):inspected
  return inheritedGeneratedCarrierWindowFactsV1(input,inspected,'retained-publication',events,identity)
}
