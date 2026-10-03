/** Read an original completed opening through an actual retained Native cut.
 * The Source reservation owns the immutable predecessor. It never resolves
 * an ancestor Agent or borrows its current numerical head. */
import {recordSha256} from './roleplay-data.js'
import {describeRoleplayInputSourceV1} from './roleplay-input-source-data.js'
import {tavernLoreSourceCurrentIdentityV1} from './roleplay-tavern-lore-source.js'
import {frozenInheritanceRefV1} from './roleplay-tavern-source-inheritance-data.js'
import {validateProgramDerivedOpeningClosureV1} from './roleplay-mvu-prefix-ledger.js'
import type {ProgramDerivedOpeningClosureV1,ProgramDerivedOpeningAtCutReaderV1}
  from './roleplay-mvu-prefix-ledger.js'
import {readProgramGeneratedNativeObservationV1,readProgramCardCopyNativeV1}
  from './roleplay-program-native-reader.js'
import type {ProgramGeneratedNativeObservationV1} from './roleplay-program-native-reader.js'
import {createProgramOpeningNativeFactsV1} from './roleplay-program-opening-records.js'
import type {TavernSourceInheritanceOwnerV1} from './roleplay-tavern-source-inheritance-types.js'
import type {SessionMessageProjection,SessionEvent} from '@deepseek-ai/dsh-session'
import type {WorldlineMessageEdits,StoryEvent} from './roleplay-worldline-types.js'
interface Dependencies {
  readonly branch:{get(key:string):unknown}
  readonly sourceInheritance:()=>TavernSourceInheritanceOwnerV1
  readonly captureCompletedClosure:(sid:string)=>{closure:ProgramDerivedOpeningClosureV1;assertCurrent:()=>void}|undefined
  readonly observation:(sid:string,count:number)=>{readonly data:ProgramGeneratedNativeObservationV1;
    readonly deletedMessageIds:readonly string[];readonly assertCurrent:()=>void}|undefined
  readonly projections:()=>readonly SessionMessageProjection[]
  readonly messageEdits:WorldlineMessageEdits
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
function fail(code:string):never{throw Error(code)}
export function createProgramOpeningAtCutReaderV1(deps:Dependencies):ProgramDerivedOpeningAtCutReaderV1 {
  return request=>{
    try {
      const sourceRef=request.successorSourcePreparedRef
      if(!sourceRef)fail('PROGRAM_HISTORY_FROZEN_SOURCE_REQUIRED')
      const owner=deps.sourceInheritance(),source=owner.readPreparedSourceInheritance(sourceRef.childSessionId)
      if(!same(frozenInheritanceRefV1(source),sourceRef)||source.parentSessionId!==request.ownerSessionId
        ||source.nativeCut.kind!=='native-fork'||source.nativeCut.seedLength!==request.events.length
        ||source.nativeCut.parentInheritedEventCount!==request.ownerInheritedEventCount
        ||source.nativeCut.prefixSha256!==recordSha256(request.events))fail('PROGRAM_HISTORY_SOURCE_CUT_CHANGED')
      const key=sourceRef.childSessionId+'__mvu-derived-prepared',stored=deps.branch.get(key)
      let closure:ProgramDerivedOpeningClosureV1,originCurrent:()=>void
      if(stored!==undefined) {
        if(!object(stored)||stored.schemaVersion!==4||stored.encoding!=='native-program-mvu-derived-prepared-v4')
          fail('PROGRAM_HISTORY_PREPARED_INVALID')
        const {preparedSha256,...body}=stored
        if(preparedSha256!==recordSha256(body)||!same(stored.sourcePreparedRef,sourceRef)
          ||!same(stored.genesis,request.genesis))fail('PROGRAM_HISTORY_PREPARED_CHANGED')
        closure=stored.genesisClosure as ProgramDerivedOpeningClosureV1
        const digest=recordSha256(stored)
        originCurrent=()=>{if(recordSha256(deps.branch.get(key))!==digest)fail('PROGRAM_HISTORY_PREPARED_CHANGED')}
      }else {
        // Before the first child write, only the actual parent's completed
        // transaction may supply these records. This path freezes them once.
        owner.assertPreparedParentCurrent(sourceRef.childSessionId)
        const captured=deps.captureCompletedClosure(request.ownerSessionId)
        if(!captured)fail('PROGRAM_HISTORY_COMPLETED_ROOT_UNAVAILABLE')
        closure=captured.closure
        originCurrent=()=>{
          captured.assertCurrent()
          owner.assertPreparedParentCurrent(sourceRef.childSessionId)
          const now=deps.branch.get(key)
          // The caller may persist its exact closure during this synchronous
          // capture's lifetime; replacing it with another packet is refused.
          if(now!==undefined&&(!object(now)||!same(now.genesisClosure,closure)||!same(now.sourcePreparedRef,sourceRef)))
            fail('PROGRAM_HISTORY_PREPARED_CHANGED')
        }
      }
      const packet=closure.data,seed=packet.seed,input=packet.input,expected=packet.intent.nativeReceipt
      if(!expected)fail('PROGRAM_HISTORY_NATIVE_RECEIPT_REQUIRED')
      closure=validateProgramDerivedOpeningClosureV1(closure,request.genesis,expected)
      const tuple=input.source.program.importTuple,original=source.originalBinding
      if(seed.sessionId!==request.ownerSessionId||input.numericalSourceSha256!==request.genesis.sourceSha256
        ||recordSha256(describeRoleplayInputSourceV1(source.parentNumericalSource.inputSource))!==request.genesis.sourceSha256
        ||tuple.sourceRecordSessionId!==original.sourceRecordSessionId||tuple.importId!==original.importId
        ||tuple.rawSha256!==original.rawSha256||tuple.normalizedSha256!==original.normalizedSha256
        ||tuple.coverageSha256!==original.coverageSha256||tuple.transactionId!==original.transactionId
        ||!same(tuple.importRecordRef,original.importRecordRef)||tuple.activationSha256!==original.activationSha256
        ||input.source.program.sourceCurrentIdentitySha256!==recordSha256(tavernLoreSourceCurrentIdentityV1(source.parentSource))
        ||!same(input.source.context.values,source.parentNumericalSource.openingContext.context)
        ||input.source.context.bindingSha256!==source.parentNumericalSource.openingContext.bindingSha256)
        fail('PROGRAM_HISTORY_ORIGINAL_SOURCE_CHANGED')
      const observed=deps.observation(request.ownerSessionId,request.events.length)
      if(!observed||observed.data.inheritedEventCount!==request.ownerInheritedEventCount
        ||!same(observed.data.events,request.events))fail('PROGRAM_HISTORY_NATIVE_CUT_CHANGED')
      const assertCurrent=()=>{
        originCurrent();observed.assertCurrent()
        if(!same(frozenInheritanceRefV1(owner.readPreparedSourceInheritance(sourceRef.childSessionId)),sourceRef))
          fail('PROGRAM_HISTORY_FROZEN_SOURCE_CHANGED')
      }
      assertCurrent()
      let actual
      if(seed.production==='selected-card-copy') {
        actual=readProgramCardCopyNativeV1({identity:{sessionId:seed.sessionId,importId:seed.source.importId,
          operationId:seed.operationId,requestedMessageId:seed.requestedMessageId,
          renderedText:input.source.selected.renderedText,renderedSha256:input.source.selected.renderedSha256},
          acknowledgedTurn:expected.receipt.turn,
          observation:{...observed.data,events:observed.data.events as unknown as readonly StoryEvent[],
            deriveEventMessage:event=>observed.data.deriveEventMessage(event as unknown as SessionEvent),
            deletedMessageIds:observed.deletedMessageIds},messageEdits:deps.messageEdits})
      }else {
        if(input.instruction===null||seed.instructionSha256===null)fail('PROGRAM_HISTORY_GENERATION_IDENTITY_INVALID')
        actual=readProgramGeneratedNativeObservationV1({observation:observed.data,
          identity:{kind:'programmatic-opening',sessionId:seed.sessionId,operationId:seed.operationId,
            messageId:seed.requestedMessageId,intentRef:input.seedRef,instruction:input.instruction,
            instructionSha256:seed.instructionSha256},projections:deps.projections(),messageEdits:deps.messageEdits,
          deletedMessageIds:observed.deletedMessageIds,assertCurrent})
        if(actual.kind==='complete'&&(!actual.closingAck
          ||actual.closingAck.data.ownerReceiptSha256!==recordSha256(packet.intent.domainReceipt)))
          fail('PROGRAM_HISTORY_NATIVE_ACK_REQUIRED')
      }
      if(actual.kind!=='complete')fail('PROGRAM_HISTORY_NATIVE_UNPROVEN')
      const native=actual.production==='generated-opening'
        ?createProgramOpeningNativeFactsV1({production:'generated-opening',receipt:actual.receipt,canonical:actual.canonical},seed,input)
        :createProgramOpeningNativeFactsV1({production:'selected-card-copy',receipt:actual.receipt,canonical:null},seed,input)
      if(!same(native,expected))fail('PROGRAM_HISTORY_NATIVE_CHANGED')
      assertCurrent()
      return {kind:'verified-program-opening',closure,native,assertCurrent}
    }catch(error) {
      return {kind:'blocked',code:error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
        ?error.message:'PROGRAM_HISTORY_UNPROVEN'}
    }
  }
}
