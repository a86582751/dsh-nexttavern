/** Native generated opening recovery data. Actual request reconstruction uses
 * the maintained material fold; this reader never creates a Session or a live
 * material owner, and partial invocation never permits another provider call. */
import type {Session,SessionEvent,NativeOpeningIdentityV1,
  NativeOpeningEventRefV1,NativeGeneratedOpeningReceiptV1,NativeOpeningRequestPublicationV1,
  NativeOpeningOutputRefV1,NativeOpeningClosingAckV1,SessionMessageProjection} from '@deepseek-ai/dsh-session'
import {nativeInputSha256} from './input-admission.js'
import {reconstructNativeRequestMaterialV1} from './request-material.js'
import {sealNativeOpeningRecordV1,validateNativeOpeningInvocationV1,validateNativeOpeningRequestAttemptV1,
  validateNativeGeneratedOpeningReceiptV1,validateNativeOpeningClosingAckV1,nativeOpeningTextSha256V1} from './opening-record-hashes.js'
import {NativeOpeningRecordFailureV1,NATIVE_OPENING_RECORD_BOUNDS_V1} from '@deepseek-ai/dsh-session/surface'

export const openingEventRefV1=(event:SessionEvent):NativeOpeningEventRefV1=>Object.freeze({
  seq:Number(event.seq),sha256:nativeInputSha256(event)})
const same=(left:unknown,right:unknown)=>nativeInputSha256(left)===nativeInputSha256(right)
function fail(code:string):never {throw new NativeOpeningRecordFailureV1(code)}
type InvocationEvent=SessionEvent<'opening/invocation'>
type ReceiptEvent=SessionEvent<'opening/generated-receipt'>
/** Read-only Native history facts supplied by an actual retained cut owner.
 * This structural data grants no Session/Agent, lookup, flush or dispatch right. */
export interface NativeOpeningHistoryObservationV1 {
  readonly id:string
  readonly events:readonly SessionEvent[]
  readonly inheritedEventCount:number
}
/** The carrier keeps its actual child identity. Origin describes the historical
 * owner of these opening events; neither object is a Session or live right. */
export interface NativeInheritedOpeningGenerationObservationV1 {
  readonly kind:'inherited-opening-carrier-v1'
  readonly carrier:NativeOpeningHistoryObservationV1&{
    readonly header:{readonly id?:unknown;readonly parentSession?:unknown}
  }
  readonly origin:{readonly sessionId:string;readonly inheritedEventCount:number}
  readonly cut:{readonly seedLength:number;readonly prefixEncoding:'native-input-sha256-events-prefix-v1';
    readonly prefixSha256:string}
}
export type NativeOpeningGenerationInspectionV1={readonly kind:'absent'}
  |{readonly kind:'unknown';readonly code:string;readonly invocationRef?:NativeOpeningEventRefV1}
  |{readonly kind:'complete';readonly invocation:InvocationEvent;readonly receipt:NativeGeneratedOpeningReceiptV1;
    readonly receiptEvent?:ReceiptEvent;readonly closingAck?:SessionEvent<'opening/closing-ack'>}

function actual(events:readonly SessionEvent[],ref:NativeOpeningEventRefV1,type?:SessionEvent['type']):SessionEvent {
  const event=events[ref.seq]
  if(!event||Number(event.seq)!==ref.seq||type!==undefined&&event.type!==type||!same(openingEventRefV1(event),ref))
    return fail('OPENING_ACTUAL_EVENT_CHANGED')
  return event
}
/** Full actual prefix, historical projections and original model bytes. Later
 * Source rows/heads and later message edits do not replace these immutable refs. */
export function buildNativeGeneratedOpeningReceiptV1(session:Session,invocation:InvocationEvent,
  projections:readonly SessionMessageProjection[]):NativeGeneratedOpeningReceiptV1 {
  const events=session.snapshotEvents()
  return buildNativeGeneratedOpeningReceiptObservationV1({events,
    get id(){return String(session.id)},get inheritedEventCount(){return session.inheritedEventCount}},invocation,projections)
}
/** Same receipt algorithm over original read-only bytes. `flushed` remains
 * receipt vocabulary; this pure builder performs no durability operation. */
export function buildNativeGeneratedOpeningReceiptObservationV1(observation:NativeOpeningHistoryObservationV1,
  invocation:InvocationEvent,projections:readonly SessionMessageProjection[]):NativeGeneratedOpeningReceiptV1 {
  const events=observation.events
  return buildReceiptFromOriginV1(events,{get sessionId(){return String(observation.id)},
    get inheritedEventCount(){return observation.inheritedEventCount}},invocation,projections)
}
/** One receipt algorithm, with origin facts explicitly separate from the
 * carrier. The own wrapper keeps its actual id/boundary and lazy read order. */
function buildReceiptFromOriginV1(events:readonly SessionEvent[],
  origin:{readonly sessionId:string;readonly inheritedEventCount:number},
  invocation:InvocationEvent,projections:readonly SessionMessageProjection[]):NativeGeneratedOpeningReceiptV1 {
  const record=validateNativeOpeningInvocationV1(invocation.data),invRef=openingEventRefV1(invocation)
  if(events[Number(invocation.seq)]!==invocation||record.identity.sessionId!==origin.sessionId
    ||record.prefix.eventCount!==Number(invocation.seq)||record.prefix.inheritedEventCount!==origin.inheritedEventCount
    ||nativeInputSha256(events.slice(0,Number(invocation.seq)))!==record.prefix.sha256)
    return fail('OPENING_INVOCATION_PREFIX_CHANGED')
  const suffix=events.slice(Number(invocation.seq)+1),turn=record.expectedTurn
  const starts=suffix.filter((event):event is SessionEvent<'turn/start'>=>event.type==='turn/start'&&event.data.turn===turn)
  const ends=suffix.filter((event):event is SessionEvent<'turn/end'>=>event.type==='turn/end'&&event.data.turn===turn)
  if(starts.length!==1||ends.length!==1||ends[0]!.data.reason.kind!=='completed'
    ||starts[0]!.seq>=ends[0]!.seq||Object.keys(starts[0]!.data).length!==1)
    return fail('OPENING_GENERATION_TERMINAL_UNCONFIRMED')
  const start=starts[0]!,end=ends[0]!,span=events.slice(Number(start.seq)+1,Number(end.seq))
  const beforeTurn=events.slice(Number(invocation.seq)+1,Number(start.seq))
  if(beforeTurn.some(event=>['turn/start','turn/end','step/start','step/end','assistant/message','assistant/attempt',
    'tool/call','tool/result','request/material','opening/invocation','opening/request-attempt',
    'opening/generated-receipt','opening/closing-ack'].includes(event.type)))
    return fail('OPENING_INVOCATION_FOREIGN_WORK')
  if(span.some(event=>event.type==='turn/start'||event.type==='turn/end'||event.type==='user/message'
    ||event.type==='opening/invocation'||event.type==='opening/generated-receipt'||event.type==='opening/closing-ack'))
    return fail('OPENING_GENERATION_FOREIGN_TURN_DATA')
  const stepStarts=span.filter((event):event is SessionEvent<'step/start'>=>event.type==='step/start'),
    stepEnds=span.filter((event):event is SessionEvent<'step/end'>=>event.type==='step/end')
  if(!stepStarts.length||stepStarts.length!==stepEnds.length||stepStarts.length>NATIVE_OPENING_RECORD_BOUNDS_V1.steps)
    return fail('OPENING_GENERATION_STEPS_INVALID')
  let requestCount=0
  const steps=stepStarts.map((stepStart,index)=>{
    const step=index+1,stepEnd=stepEnds[index]!
    if(stepStart.data.turn!==turn||stepStart.data.step!==step||stepEnd.data.turn!==turn||stepEnd.data.step!==step
      ||stepEnd.seq<=stepStart.seq||index>0&&stepStart.seq<=stepEnds[index-1]!.seq)
      return fail('OPENING_GENERATION_STEPS_INVALID')
    const local=events.slice(Number(stepStart.seq)+1,Number(stepEnd.seq)),
      attempts=local.filter((event):event is SessionEvent<'opening/request-attempt'>=>event.type==='opening/request-attempt'),
      materials=local.filter((event):event is SessionEvent<'request/material'>=>event.type==='request/material')
    if(!attempts.length||attempts.length!==materials.length)return fail('OPENING_GENERATION_MATERIAL_MISSING')
    const requests:NativeOpeningRequestPublicationV1[]=attempts.map((attemptEvent,attemptIndex)=>{
      if(++requestCount>NATIVE_OPENING_RECORD_BOUNDS_V1.requests)return fail('OPENING_RECORD_BUDGET')
      const attempt=validateNativeOpeningRequestAttemptV1(attemptEvent.data),material=materials[attemptIndex]!
      if(attempt.turn!==turn||attempt.step!==step||attempt.attempt!==attemptIndex+1
        ||!same(attempt.invocationRef,invRef)||attemptEvent.seq>=material.seq
        ||attemptIndex>0&&attemptEvent.seq<=materials[attemptIndex-1]!.seq
        ||material.data.turn!==turn||material.data.step!==step)return fail('OPENING_GENERATION_ATTEMPT_CHANGED')
      const header=events[material.data.header.seq]
      if(!header||header.type!=='request/header'||nativeInputSha256(header.data.header)!==material.data.header.sha256)
        return fail('OPENING_GENERATION_HEADER_CHANGED')
      const reconstructed=reconstructNativeRequestMaterialV1({materialEvent:material,events,
        projections,expectedHeaderSha256:material.data.header.sha256})
      return Object.freeze({attemptRef:openingEventRefV1(attemptEvent),materialRef:openingEventRefV1(material),
        headerRef:openingEventRefV1(header),configSha256:nativeInputSha256(header.data.header.config),
        requestMessagesSha256:nativeInputSha256(reconstructed.messages),snapshot:material.data.snapshot,plan:material.data.plan})
    })
    return Object.freeze({step,startRef:openingEventRefV1(stepStart),endRef:openingEventRefV1(stepEnd),requests:Object.freeze(requests)})
  })
  const modelEvents=span.filter((event):event is SessionEvent<'assistant/message'>=>event.type==='assistant/message')
  if(!modelEvents.length||modelEvents.some(event=>event.data.turn!==turn||event.data.interrupted
    ||event.data.message.source.kind!=='model'))return fail('OPENING_GENERATION_OUTPUT_INVALID')
  const outputs:NativeOpeningOutputRefV1[]=modelEvents.map(event=>Object.freeze({eventRef:openingEventRefV1(event),
    messageId:String(event.data.message.id),messageSha256:nativeInputSha256(event.data.message),
    textEncoding:'native-model-text-blocks-concat-v1' as const,textSha256:nativeOpeningTextSha256V1(event.data.message.content
      .filter(block=>block.type==='text').map(block=>block.text).join('')),step:event.data.step}))
  const named=outputs.filter(output=>output.messageId===record.identity.messageId)
  if(named.length!==1||named[0]!.step!==1)return fail('OPENING_GENERATION_OUTPUT_IDENTITY_CHANGED')
  const toolEvents=span.filter((event):event is SessionEvent<'tool/call'|'tool/result'>=>
    event.type==='tool/call'||event.type==='tool/result')
  if(toolEvents.some(event=>event.data.turn!==turn))return fail('OPENING_GENERATION_TOOL_OWNER_CHANGED')
  const calls=toolEvents.filter((event):event is SessionEvent<'tool/call'>=>event.type==='tool/call'),
    results=toolEvents.filter((event):event is SessionEvent<'tool/result'>=>event.type==='tool/result'),
    requested=modelEvents.flatMap(event=>event.data.message.content.filter(block=>block.type==='tool-call')
      .map(block=>({block,step:event.data.step,seq:event.seq})))
  if(calls.length!==requested.length||results.length!==calls.length
    ||new Set(calls.map(event=>String(event.data.callId))).size!==calls.length)
    return fail('OPENING_GENERATION_TOOL_TERMINAL_INVALID')
  for(const call of calls) {
    const matches=requested.filter(item=>item.block.id===call.data.callId),paired=results.filter(event=>
      event.data.message.toolCallId===call.data.callId)
    if(matches.length!==1||paired.length!==1)return fail('OPENING_GENERATION_TOOL_TERMINAL_INVALID')
    const request=matches[0]!,result=paired[0]!
    if(request.seq>=call.seq||request.step!==call.data.step||request.block.name!==call.data.name
      ||request.block.arguments!==call.data.arguments||result.seq<=call.seq||result.data.step!==call.data.step
      ||result.data.message.source.kind!=='tool'||result.data.message.source.callId!==call.data.callId
      ||result.sourceEventSeqs?.length!==1||result.sourceEventSeqs[0]!==call.seq)
      return fail('OPENING_GENERATION_TOOL_TERMINAL_INVALID')
  }
  // Only actual paired model calls/results close. Repair's aborted/error turn
  // cannot become a successful generated-opening receipt through this reader.
  return validateNativeGeneratedOpeningReceiptV1(sealNativeOpeningRecordV1({schemaVersion:1 as const,
    encoding:'native-generated-opening-receipt-v1' as const,production:'generated-opening' as const,
    invocationRef:invRef,identity:record.identity,turn,turnStartRef:openingEventRefV1(start),turnEndRef:openingEventRefV1(end),
    turnSpanSha256:nativeInputSha256(events.slice(Number(start.seq),Number(end.seq)+1)),
    invocationSpanSha256:nativeInputSha256(events.slice(Number(invocation.seq),Number(end.seq)+1)),
    steps:Object.freeze(steps),outputs:Object.freeze(outputs),requestedOutput:named[0]!,terminalOutput:outputs.at(-1)!,
    toolEvents:Object.freeze(toolEvents.map(event=>Object.freeze({type:event.type,eventRef:openingEventRefV1(event)}))),
    flushed:true as const},'receiptSha256'))
}
export function inspectNativeOpeningGenerationV1(session:Session,identity:NativeOpeningIdentityV1,
  projections:readonly SessionMessageProjection[]):NativeOpeningGenerationInspectionV1 {
  try {
    const events=session.snapshotEvents()
    return inspectNativeOpeningGenerationObservationV1({events,
      get id(){return String(session.id)},get inheritedEventCount(){return session.inheritedEventCount}},identity,projections)
  }catch(error) {
    return Object.freeze({kind:'unknown',code:error instanceof NativeOpeningRecordFailureV1
      ?error.code:'OPENING_GENERATION_PROOF_INVALID'})
  }
}
/** Factual inspection for retained ancestor cuts without creating/loading a
 * Session or Agent. Caller independently proves the observation's provenance. */
export function inspectNativeOpeningGenerationObservationV1(observation:NativeOpeningHistoryObservationV1,
  identity:NativeOpeningIdentityV1,projections:readonly SessionMessageProjection[]):NativeOpeningGenerationInspectionV1 {
  try {
    return inspectGenerationFactsV1(observation.events,identity,
      invocation=>buildNativeGeneratedOpeningReceiptObservationV1(observation,invocation,projections))
  }catch(error) {
    return Object.freeze({kind:'unknown',code:error instanceof NativeOpeningRecordFailureV1
      ?error.code:'OPENING_GENERATION_PROOF_INVALID'})
  }
}
/** Private receipt selection is never a caller-supplied verification bypass.
 * Both public gates establish their own identity/boundary before this fold. */
function inspectGenerationFactsV1(events:readonly SessionEvent[],identity:NativeOpeningIdentityV1,
  buildReceipt:(invocation:InvocationEvent)=>NativeGeneratedOpeningReceiptV1):NativeOpeningGenerationInspectionV1 {
  let invocationRef:NativeOpeningEventRefV1|undefined
  try {
    const markers:InvocationEvent[]=[]
    for(const event of events) {
      if(event.type==='opening/invocation') {
        const marker=validateNativeOpeningInvocationV1(event.data)
        if(marker.identity.operationId===identity.operationId||marker.identity.messageId===identity.messageId)markers.push(event)
      }else if(event.type==='opening/request-attempt')validateNativeOpeningRequestAttemptV1(event.data)
      else if(event.type==='opening/generated-receipt')validateNativeGeneratedOpeningReceiptV1(event.data)
      else if(event.type==='opening/closing-ack')validateNativeOpeningClosingAckV1(event.data)
    }
    if(!markers.length) {
      if(events.some(event=>event.type==='assistant/message'&&String(event.data.message.id)===identity.messageId))
        return {kind:'unknown',code:'OPENING_MESSAGE_ID_ALREADY_USED'}
      if(events.some(event=>event.type==='turn/start'&&event.data.programmatic?.operationId===identity.operationId))
        return {kind:'unknown',code:'OPENING_OPERATION_ID_ALREADY_USED'}
      return {kind:'absent'}
    }
    if(markers.length!==1)return {kind:'unknown',code:'OPENING_INVOCATION_AMBIGUOUS'}
    const invocation=markers[0]!
    invocationRef=openingEventRefV1(invocation)
    if(!same(invocation.data.identity,identity))return {kind:'unknown',code:'OPENING_INVOCATION_IDENTITY_CHANGED',invocationRef}
    const receipt=buildReceipt(invocation),receipts=events.filter(
      (event):event is ReceiptEvent=>event.type==='opening/generated-receipt'&&same(event.data.invocationRef,invocationRef)),
      acknowledgements=events.filter((event):event is SessionEvent<'opening/closing-ack'>=>
        event.type==='opening/closing-ack'&&same(event.data.invocationRef,invocationRef))
    const namedOutputs=events.filter((event):event is SessionEvent<'assistant/message'>=>
      event.type==='assistant/message'&&String(event.data.message.id)===identity.messageId)
    if(namedOutputs.length!==1||!same(openingEventRefV1(namedOutputs[0]!),receipt.requestedOutput.eventRef))
      return fail('OPENING_MESSAGE_ID_ALREADY_USED')
    if(receipts.length>1||acknowledgements.length>1)return fail('OPENING_GENERATION_RECEIPT_AMBIGUOUS')
    const receiptEvent=receipts[0],closingAck=acknowledgements[0]
    if(receiptEvent&&(!same(receiptEvent.data,receipt)||receiptEvent.seq<=receipt.turnEndRef.seq))
      return fail('OPENING_GENERATION_RECEIPT_CHANGED')
    if(closingAck) {
      const ack:NativeOpeningClosingAckV1=validateNativeOpeningClosingAckV1(closingAck.data)
      if(!receiptEvent||!same(ack.generatedReceiptRef,openingEventRefV1(receiptEvent))
        ||ack.receiptSha256!==receipt.receiptSha256||closingAck.seq<=receiptEvent.seq)
        return fail('OPENING_GENERATION_CLOSING_ACK_CHANGED')
      actual(events,ack.generatedReceiptRef,'opening/generated-receipt')
    }
    return Object.freeze({kind:'complete',invocation,receipt,...receiptEvent?{receiptEvent}:{},...closingAck?{closingAck}:{}})
  }catch(error) {
    return Object.freeze({kind:'unknown',code:error instanceof NativeOpeningRecordFailureV1
      ?error.code:'OPENING_GENERATION_PROOF_INVALID',...invocationRef?{invocationRef}:{}})
  }
}
/** Completed inherited facts from one actual carrier prefix. Source provenance,
 * current projections and durability remain with the private Core supplier.
 * No missing receipt/ACK can be repaired from the carrier's later suffix. */
export function inspectInheritedOpeningGenerationObservationV1(input:NativeInheritedOpeningGenerationObservationV1,
  identity:NativeOpeningIdentityV1,projections:readonly SessionMessageProjection[]):NativeOpeningGenerationInspectionV1 {
  try {
    const {carrier,origin,cut}=input,events=carrier.events,
      count=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0&&!Object.is(value,-0)
    if(input.kind!=='inherited-opening-carrier-v1'||typeof carrier.id!=='string'||!carrier.id
      ||carrier.id===origin.sessionId||!carrier.header
      ||carrier.header.id!==undefined&&carrier.header.id!==carrier.id
      ||typeof carrier.header.parentSession!=='string'||!carrier.header.parentSession
      ||carrier.header.parentSession===carrier.id||typeof origin.sessionId!=='string'||!origin.sessionId
      ||origin.sessionId!==identity.sessionId
      ||!count(origin.inheritedEventCount)||!count(carrier.inheritedEventCount)||!count(cut.seedLength)
      ||cut.seedLength===0||cut.seedLength!==carrier.inheritedEventCount||cut.seedLength>events.length
      ||origin.inheritedEventCount>=cut.seedLength||events.some((event,index)=>!count(event.seq)||event.seq!==index)
      ||cut.prefixEncoding!=='native-input-sha256-events-prefix-v1'
      ||typeof cut.prefixSha256!=='string'||!/^[a-f0-9]{64}$/.test(cut.prefixSha256)) {
      return {kind:'unknown',code:'OPENING_INHERITED_CARRIER_INVALID'}
    }
    const prefix=events.slice(0,cut.seedLength)
    if(nativeInputSha256(prefix)!==cut.prefixSha256)return {kind:'unknown',code:'OPENING_INHERITED_PREFIX_CHANGED'}
    const inspected=inspectGenerationFactsV1(prefix,identity,
      invocation=>buildReceiptFromOriginV1(prefix,origin,invocation,projections))
    if(inspected.kind!=='complete')return inspected
    if(!inspected.receiptEvent||!inspected.closingAck
      ||origin.inheritedEventCount>inspected.invocation.seq
      ||inspected.receiptEvent.seq>=cut.seedLength||inspected.closingAck.seq>=cut.seedLength) {
      return {kind:'unknown',code:'OPENING_INHERITED_CLOSURE_UNCONFIRMED',
        invocationRef:openingEventRefV1(inspected.invocation)}
    }
    return inspected
  }catch(error) {
    return Object.freeze({kind:'unknown',code:error instanceof NativeOpeningRecordFailureV1
      ?error.code:'OPENING_INHERITED_PROOF_INVALID'})
  }
}
/** Constructor/factory gate is data only until an actual registration performs
 * exact current and closing recovery. Malformed/pending records fail closed. */
export function hasUnclosedNativeOpeningV1(session:Session,projections:readonly SessionMessageProjection[]):boolean {
  try {
    const events=session.snapshotEvents()
    for(const event of events) {
      if(event.type==='opening/request-attempt'||event.type==='opening/generated-receipt'||event.type==='opening/closing-ack') {
        const record=event.type==='opening/request-attempt'?validateNativeOpeningRequestAttemptV1(event.data)
          :event.type==='opening/generated-receipt'?validateNativeGeneratedOpeningReceiptV1(event.data)
            :validateNativeOpeningClosingAckV1(event.data)
        const parent=actual(events,record.invocationRef,'opening/invocation')
        if(parent.type!=='opening/invocation')return true
        validateNativeOpeningInvocationV1(parent.data)
      }
    }
    for(const invocation of events.filter((event):event is InvocationEvent=>event.type==='opening/invocation')) {
      if(invocation.data.identity.sessionId!==String(session.id))continue
      const inspected=inspectNativeOpeningGenerationV1(session,validateNativeOpeningInvocationV1(invocation.data).identity,projections)
      if(inspected.kind!=='complete'||!inspected.closingAck)return true
    }
    return false
  }catch{return true}
}
