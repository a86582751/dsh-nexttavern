/** Actual retained Native carrier facts for a Source-owned absence archive.
 * The original opening remains owned by its original Session. No Agent, fake
 * Session, Source owner or numerical genesis is reconstructed here. */
import {recordSha256} from './roleplay-data.js'
import {validateProgramAbsenceOpeningClosureV1} from './roleplay-program-absence-inheritance-data.js'
import {validateFrozenProgramAbsenceOpeningV1,assertFrozenProgramAbsenceOpeningCutV1}
  from './roleplay-tavern-source-inheritance-data.js'
import {readInheritedProgramCardCopyNativeV1,readInheritedProgramGeneratedNativeObservationV1,
  readInheritedProgramCardCopyPublicationFactsV1,readInheritedProgramGeneratedPublicationFactsV1}
  from './roleplay-program-native-reader.js'
import type {ProgramInheritedCardCopyNativeObservationV1,ProgramRetainedCardCopyPublicationObservationV1}
  from './roleplay-program-native-reader.js'
import type {TavernSourceFrozenProgramAbsenceOpeningV1,TavernSourceNativeCutV1}
  from './roleplay-tavern-source-inheritance-types.js'
import type {SessionEvent,SessionMessageProjection} from '@deepseek-ai/dsh-session'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {TavernProgramInheritedAbsencePromptScopeDataV1}
  from './roleplay-program-opening-prompt-scopes-types.js'

interface Dependencies {
  /** Root's actual live/retained Native reader plus official surface fold.
   * This factual observation is never cast to a Session or an Agent. */
  readonly observation:(id:string)=>ProgramInheritedCardCopyNativeObservationV1|undefined
  readonly retainedObservation:(id:string,cut:TavernSourceNativeCutV1)=>{
    readonly observation:ProgramRetainedCardCopyPublicationObservationV1
    readonly projections:readonly SessionMessageProjection[]
    assertCurrent():void
  }|undefined
  readonly projections:()=>readonly SessionMessageProjection[]
  readonly messageEdits:WorldlineMessageEdits
}
function fail(code:string):never {throw Error(code)}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
/** Stable Source/domain identity. Dynamic writer rows belong only to the
 * current inventory audit, otherwise an input would stale itself on its put. */
export function programInheritedAbsenceDomainSha256V1(data:Pick<TavernProgramInheritedAbsencePromptScopeDataV1,
  'sessionId'|'sourceInheritance'|'currentSourceIdentitySha256'|'originalOpening'|'actualChildCut'>):string {
  return recordSha256({schemaVersion:1,encoding:'native-program-inherited-absence-domain-ref-v1',
    sessionId:data.sessionId,sourceInheritance:data.sourceInheritance,
    currentSourceIdentitySha256:data.currentSourceIdentitySha256,
    originalOpening:data.originalOpening,actualChildCut:data.actualChildCut})
}
export function createRoleplayProgramInheritedAbsenceReaderV1(deps:Dependencies) {
  // Only a successful current-carrier read by this factory can select the
  // factual closure. A detached packet or another factory's result cannot.
  const currentCarrierReads=new WeakMap<object,{
    childId:string;packet:TavernSourceFrozenProgramAbsenceOpeningV1;cut:TavernSourceNativeCutV1;
    closure:ReturnType<typeof validateProgramAbsenceOpeningClosureV1>;cutSha256:string
  }>()
  function readCarrier(childId:string,raw:TavernSourceFrozenProgramAbsenceOpeningV1,cut:TavernSourceNativeCutV1,
    assertObservationCurrent:()=>void,mode:'current-carrier'|'retained-publication') {
    assertObservationCurrent()
    const packet=validateFrozenProgramAbsenceOpeningV1(raw)
    assertFrozenProgramAbsenceOpeningCutV1(packet,cut)
    if(packet.kind==='not-inherited')return {kind:'not-inherited' as const}
    const closure=validateProgramAbsenceOpeningClosureV1(packet.record.closure)
    return readValidatedCarrier(childId,packet,cut,closure,assertObservationCurrent,mode)
  }
  function readValidatedCarrier(childId:string,
    packet:Extract<TavernSourceFrozenProgramAbsenceOpeningV1,{kind:'program-absence'}>,cut:TavernSourceNativeCutV1,
    closure:ReturnType<typeof validateProgramAbsenceOpeningClosureV1>,assertObservationCurrent:()=>void,
    mode:'current-carrier'|'retained-publication') {
    const retained=mode==='retained-publication'?deps.retainedObservation(childId,cut):undefined,
      currentObservation=mode==='current-carrier'?deps.observation(childId):undefined,
      observation=retained?.observation??currentObservation
    if(!observation)fail('PROGRAM_INHERITED_ABSENCE_CARRIER_MISSING')
    const {record}=packet,
      {seed,input,intent,absenceDomain,acknowledgement}=closure.data
    if(cut.kind!=='native-fork'||record.childSessionId!==childId
      ||observation.id!==childId||observation.header.parentSession!==record.parentSessionId
      ||Number(observation.inheritedEventCount)!==cut.seedLength
      ||seed.sessionId!==closure.ownerSessionId||closure.ownerSessionId===childId) {
      fail('PROGRAM_INHERITED_ABSENCE_CARRIER_MISMATCH')
    }
    const assertCurrent=()=>{
      assertObservationCurrent()
      if(retained) {
        retained.assertCurrent()
        return
      }
      const current=deps.observation(childId)
      if(!current||current.id!==childId||current.header.parentSession!==record.parentSessionId
        ||Number(current.inheritedEventCount)!==cut.seedLength||current.events.length<cut.seedLength
        ||recordSha256(current.events.slice(0,cut.seedLength))!==cut.prefixSha256) {
        fail('PROGRAM_INHERITED_ABSENCE_PREFIX_CHANGED')
      }
    }
    assertCurrent()
    const origin={sessionId:closure.ownerSessionId,inheritedEventCount:input.basis.branch.inheritedEventCount},
      sourceCut={seedLength:cut.seedLength,prefixEncoding:'record-sha256-native-events-prefix-v1' as const,
        prefixSha256:cut.prefixSha256}
    if(seed.production==='selected-card-copy') {
      if(intent.committedTurn===undefined)fail('PROGRAM_INHERITED_ABSENCE_COPY_TURN_MISSING')
      const identity={sessionId:closure.ownerSessionId,importId:seed.source.importId,operationId:seed.operationId,
          requestedMessageId:seed.requestedMessageId,renderedText:input.source.selected.renderedText,
          renderedSha256:input.source.selected.renderedSha256},
        base={kind:'inherited-opening-carrier-v1' as const,origin,sourceCut,identity,
          acknowledgedTurn:intent.committedTurn,messageEdits:deps.messageEdits,assertCurrent},
        actual=retained?readInheritedProgramCardCopyPublicationFactsV1({...base,observation:retained.observation})
          :readInheritedProgramCardCopyNativeV1({...base,observation:currentObservation!})
      if(actual.kind!=='complete'||absenceDomain.nativeFacts.production!=='selected-card-copy'
        ||!same(actual.receipt,absenceDomain.nativeFacts.receipt)) {
        fail('PROGRAM_INHERITED_ABSENCE_COPY_CHANGED')
      }
    }else {
      if(input.instruction===null||seed.instructionSha256===null||acknowledgement===null) {
        fail('PROGRAM_INHERITED_ABSENCE_GENERATION_PACKET_MISSING')
      }
      const identity={kind:'programmatic-opening' as const,sessionId:closure.ownerSessionId,
        operationId:seed.operationId,messageId:seed.requestedMessageId,instruction:input.instruction,
        instructionSha256:seed.instructionSha256,intentRef:input.seedRef},
        base={kind:'inherited-opening-carrier-v1' as const,origin,sourceCut,identity,
          messageEdits:deps.messageEdits,assertCurrent},
        actual=retained?readInheritedProgramGeneratedPublicationFactsV1({...base,
          observation:{...retained.observation,events:retained.observation.events as unknown as readonly SessionEvent[],
            deriveEventMessage:event=>retained.observation.deriveEventMessage(event as never)},
          projections:retained.projections})
          :readInheritedProgramGeneratedNativeObservationV1({...base,
            observation:{...currentObservation!,events:currentObservation!.events as unknown as readonly SessionEvent[],
              deriveEventMessage:event=>currentObservation!.deriveEventMessage(event as never)},
            projections:deps.projections(),deletedMessageIds:typeof currentObservation!.deletedMessageIds==='function'
              ?currentObservation!.deletedMessageIds():currentObservation!.deletedMessageIds,assertCurrent})
      if(actual.kind!=='complete'||!actual.closingAck||absenceDomain.nativeFacts.production!=='generated-opening'
        ||!same(actual.receipt,absenceDomain.nativeFacts.receipt)||!same(actual.canonical,absenceDomain.nativeFacts.canonical)
        ||!same(actual.generatedReceiptRef,acknowledgement.generatedReceiptRef)
        ||!same(actual.closingAck.ref,acknowledgement.closingAckRef)
        ||!same(actual.closingAck.data,acknowledgement.closingAck)) {
        fail('PROGRAM_INHERITED_ABSENCE_GENERATED_CHANGED')
      }
    }
    assertCurrent()
    return {kind:'program-absence' as const,packet,closure}
  }
  function read(childId:string,raw:TavernSourceFrozenProgramAbsenceOpeningV1,cut:TavernSourceNativeCutV1,
    assertSourceFrameCurrent:()=>void,mode:'current-carrier'|'retained-publication'='current-carrier') {
    const result=readCarrier(childId,raw,cut,assertSourceFrameCurrent,mode)
    if(mode==='current-carrier'&&result.kind==='program-absence') {
      currentCarrierReads.set(result,{childId,packet:result.packet,cut,closure:result.closure,
        cutSha256:recordSha256(cut)})
    }
    return result
  }
  function captureCurrentCarrierOwnerFacts(result:ReturnType<typeof read>,assertArchiveFactsCurrent:()=>void) {
    const captured=currentCarrierReads.get(result)
    if(!captured||result.kind!=='program-absence'||result.packet!==captured.packet||result.closure!==captured.closure
      ||recordSha256(captured.cut)!==captured.cutSha256) {
      fail('PROGRAM_INHERITED_ABSENCE_FACT_OWNER_REQUIRED')
    }
    const closureSha256=captured.closure.closureSha256
    const assertOwnerFactsCurrent=()=>{
      assertArchiveFactsCurrent()
      if(currentCarrierReads.get(result)!==captured||result.kind!=='program-absence'
        ||result.packet!==captured.packet||result.closure!==captured.closure
        ||recordSha256(captured.cut)!==captured.cutSha256)
        fail('PROGRAM_INHERITED_ABSENCE_FACT_CAPTURE_CHANGED')
      // This is the current child carrier, including its suffix, edits/deletes
      // and generated ACK. Retained-publication can never replace this read.
      // Only immutable grammar is reused. Root freshly checks the complete
      // archive/refs; every call rebuilds the current Native surface and ACK.
      if(captured.packet.kind!=='program-absence')fail('PROGRAM_INHERITED_ABSENCE_FACT_CAPTURE_CHANGED')
      const actual=readValidatedCarrier(captured.childId,captured.packet,captured.cut,captured.closure,
        assertArchiveFactsCurrent,'current-carrier')
      if(actual.closure.closureSha256!==closureSha256)
        fail('PROGRAM_INHERITED_ABSENCE_FACT_CLOSURE_CHANGED')
      assertArchiveFactsCurrent()
    }
    // The minting read just checked the full current carrier. Capture adds no
    // await or write; later factual consumption rechecks Native in full.
    assertArchiveFactsCurrent()
    return {assertOwnerFactsCurrent}
  }
  return {read,captureCurrentCarrierOwnerFacts}
}
