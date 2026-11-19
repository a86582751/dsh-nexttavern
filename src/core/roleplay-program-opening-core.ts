/** Core's actual table, Session and Phase-A readers for program openings.
 * Saved records are evidence; the original live readers own all currency. */
import {nativeInputSha256,validateNativeOpeningInvocationV1} from 'dsh-nexttavern-native-agent-loop'
import type {Session} from 'dsh-nexttavern-native-session'
import type {NativeOpeningIdentityV1,NativeOpeningOwnerIdentityV1,NativeProgrammaticOpeningAgentV1}
  from 'dsh-nexttavern-native-agent-loop'
import {recordSha256,keyOf} from './roleplay-data.js'
import {createRoleplayPromptOpeningSourceV1} from './roleplay-prompt-opening-source.js'
import type {PromptOpeningSourceDepsV1} from './roleplay-prompt-opening-source-types.js'
import {createRoleplayProgramOpeningBasisV1} from './roleplay-program-opening-basis.js'
import type {ProgramOpeningOwnedBranchRowV1} from './roleplay-program-opening-basis.js'
import {createRoleplayProgramOpeningV1} from './roleplay-program-opening.js'
import type {ProgramOpeningDependenciesV1} from './roleplay-program-opening.js'
import {tavernLoreSourceCurrentRowIdentityV1} from './roleplay-tavern-lore-source.js'
import {readProgramGeneratedNativeV1,readProgramCardCopyNativeV1} from './roleplay-program-native-reader.js'
import {createProgramOpeningNativeFactsV1,programOpeningInputKeyV1,
  programOpeningDomainKeyV1,programOpeningRefV1} from './roleplay-program-opening-records.js'
import {createProgramAbsenceOpeningClosureV1} from './roleplay-program-absence-inheritance-data.js'
import type {ProgramAbsenceOpeningClosureDataV1} from './roleplay-program-absence-inheritance-data.js'
import type {RoleplayOpeningMaterialRecordV1} from './roleplay-opening-material.js'
import {roleplayMaterialPreparationJournalOwnerV1,readRoleplayMaterialPreparationJournalRowV1}
  from './roleplay-input-material.js'
import {openingIntentKey} from './roleplay-opening-selection.js'
import type {ProgramOpeningRecordContextV1,ProgramOpeningNativeFactsV1} from './roleplay-program-opening-records.js'
import type {CompletionSnapshot} from './roleplay-completion-types.js'
import type {WorldlineMessageEdits,ReadBranchSession,StoryEvent} from './roleplay-worldline-types.js'
import type {CoreTables} from './roleplay-core-types.js'

interface Dependencies extends Omit<ProgramOpeningDependenciesV1,'branch'|'status'|'source'|'basis'|'readPhaseA'
  |'readNativeFacts'|'readHistoricalOwnedRows'> {
  readonly tables:CoreTables
  readonly sourceReaders:PromptOpeningSourceDepsV1
  readonly projections:()=>Parameters<typeof readProgramGeneratedNativeV1>[0]['projections']
  readonly messageEdits:WorldlineMessageEdits
  readonly deletedMessageIds:(session:ReadBranchSession)=>readonly string[]
  readonly phaseSnapshot:(session:Session,turn:number)=>CompletionSnapshot|undefined
}
const same=(a:unknown,b:unknown)=>recordSha256(a)===recordSha256(b)
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
function fail(code:string):never{throw Error(code)}

export function createRoleplayProgramOpeningCoreV1(deps:Dependencies) {
  const source=createRoleplayPromptOpeningSourceV1(deps.sourceReaders)
  let flow:ReturnType<typeof createRoleplayProgramOpeningV1>
  function actualIdentity(context:ProgramOpeningRecordContextV1):NativeOpeningIdentityV1 {
    const {seed,input}=context
    if(seed.production!=='generated-opening'||input.instruction===null||!seed.instructionSha256) {
      fail('PROGRAM_OPENING_GENERATION_IDENTITY_REQUIRED')
    }
    return {kind:'programmatic-opening',sessionId:seed.sessionId,operationId:seed.operationId,
      messageId:seed.requestedMessageId,instruction:input.instruction,instructionSha256:seed.instructionSha256,
      intentRef:input.seedRef}
  }
  function readNativeFacts(context:ProgramOpeningRecordContextV1,acknowledgedTurn?:number) {
    const {seed,input}=context,session=deps.session(seed.sessionId)
    if(!session)return
    deps.assertSessionCurrent(session)
    if(seed.production==='selected-card-copy') {
      if(!Number.isSafeInteger(acknowledgedTurn))return
      const actual=readProgramCardCopyNativeV1({identity:{sessionId:seed.sessionId,importId:seed.source.importId,
        operationId:seed.operationId,requestedMessageId:seed.requestedMessageId,
        renderedText:input.source.selected.renderedText,renderedSha256:input.source.selected.renderedSha256},
        acknowledgedTurn:acknowledgedTurn!,observation:{id:String(session.id),header:session.header,
          inheritedEventCount:Number(session.inheritedEventCount),seq:Number(session.seq),
          events:session.snapshotEvents() as unknown as readonly StoryEvent[],
          surfaceNodes:session.surface.nodes,deletedMessageIds:deps.deletedMessageIds(session as unknown as ReadBranchSession),
          deriveEventMessage:event=>session.deriveEventMessage(event as never)},messageEdits:deps.messageEdits})
      if(actual.kind!=='complete')return
      return {facts:createProgramOpeningNativeFactsV1({production:'selected-card-copy',receipt:actual.receipt,
        canonical:null},seed,input),closingAcknowledged:true}
    }
    const actual=readProgramGeneratedNativeV1({session,identity:actualIdentity(context),projections:deps.projections(),
      messageEdits:deps.messageEdits,deletedMessageIds:deps.deletedMessageIds(session as unknown as ReadBranchSession)})
    if(actual.kind!=='complete'||acknowledgedTurn!==undefined&&actual.receipt.turn!==acknowledgedTurn)return
    return {facts:createProgramOpeningNativeFactsV1({production:'generated-opening',receipt:actual.receipt,
      canonical:actual.canonical},seed,input),closingAcknowledged:!!actual.closingAck,
      publicationNativeCut:actual.closingAck?actual.closingAck.ref.seq+1:session.seq,
      ...(actual.closingAck?{ownerReceiptSha256:actual.closingAck.data.ownerReceiptSha256}:{})}
  }
  function exactRow(key:string,sha256?:string):ProgramOpeningOwnedBranchRowV1 {
    const value=deps.tables.branch.get(key)
    if(!object(value)||sha256!==undefined&&recordSha256(value)!==sha256)fail('PROGRAM_OPENING_OWNED_ROW_CHANGED')
    return {key,value}
  }
  function readPhaseA(owner:NativeOpeningOwnerIdentityV1,session:Session,turn:number) {
    deps.assertSessionCurrent(session)
    const event=session.snapshotEvents()[owner.invocationRef.seq]
    if(event?.type!=='opening/invocation'||nativeInputSha256(event)!==owner.invocationRef.sha256
      ||!same(validateNativeOpeningInvocationV1(event.data).identity,owner.identity)||event.data.expectedTurn!==turn) {
      fail('PROGRAM_OPENING_PHASE_A_OWNER_CHANGED')
    }
    const snapshot=deps.phaseSnapshot(session,turn),key=keyOf(session.id,`task-snapshot-${turn}`),row=exactRow(key)
    if(!snapshot?.agent||snapshot.branchId!==session.id||snapshot.turnId!==turn||snapshot.inputPreparation) {
      fail('PROGRAM_OPENING_ACTUAL_PHASE_A_MISSING')
    }
    const {agent:_agent,...durable}=snapshot
    if(!same(row.value,{schemaVersion:1,sessionId:session.id,...durable})||!snapshot.contextMessageRefs
      ||snapshot.contextMessageRefs.sessionId!==session.id||snapshot.contextMessageRefs.turn!==turn) {
      fail('PROGRAM_OPENING_ACTUAL_PHASE_A_CHANGED')
    }
    const preparation=exactRow(keyOf(session.id,'task-preparation'))
    if(preparation.value.sessionId!==session.id||preparation.value.turn!==turn
      ||preparation.value.status!=='completed'||preparation.value.inputPreparation!==undefined) {
      fail('PROGRAM_OPENING_ACTUAL_PHASE_A_CHANGED')
    }
    const rows=[row,preparation],window=deps.tables.branch.get(keyOf(session.id,'context-window'))
    if(window!==undefined&&window!==null)rows.push(exactRow(keyOf(session.id,'context-window')))
    return {snapshot,snapshotRef:{key,sha256:recordSha256(row.value)},ownedRows:rows}
  }
  function readHistoricalOwnedRows(context:ProgramOpeningRecordContextV1,facts:ProgramOpeningNativeFactsV1) {
    if(facts.production!=='generated-opening')return []
    const rows=new Map<string,ProgramOpeningOwnedBranchRowV1>()
    for(const request of facts.receipt.steps.flatMap(step=>step.requests)) {
      const snapshot=exactRow(request.snapshot.key,request.snapshot.sha256),plan=exactRow(request.plan.key,request.plan.sha256)
      for(const row of [snapshot,plan]) {
        if(row.value.encoding!=='core-program-opening-material-record-v1'
          ||row.value.sessionId!==context.seed.sessionId||!same(row.value.identity,actualIdentity(context))
          ||!same(row.value.seedRef,context.input.seedRef)
          ||!same(row.value.inputRef,programOpeningRefV1(programOpeningInputKeyV1(context.seed.sessionId,
            context.seed.operationId),context.input)))fail('PROGRAM_OPENING_HISTORICAL_MATERIAL_CHANGED')
        rows.set(row.key,row)
      }
      const payload=snapshot.value.payload
      if(!object(payload)||!object(payload.openingPreparation)||!Array.isArray(payload.openingPreparation.ownedBranchRefs)) {
        fail('PROGRAM_OPENING_HISTORICAL_PHASE_A_MISSING')
      }
      if(context.schemaOpening) {
        const section=context.schemaOpening,scope=payload.openingPreparation.scopeFacts,
          birth=section.preparation.birth,initialized=object(scope)?scope.initialization:undefined
        if(birth.kind!=='generated'||!object(initialized)||initialized.kind!=='schema-initialized'
          ||initialized.preparationSha256!==section.preparation.preparationSha256
          ||initialized.executionSha256!==recordSha256(section.initialization.execution)
          ||!same(initialized.values,section.initialization.values)||!same(initialized.context,section.initialization.context)
          ||!same(payload.openingPreparation.snapshotRef,birth.snapshotRef)
          ||!same(payload.openingPreparation.ownedBranchRefs,birth.phaseARefs)) {
          fail('PROGRAM_OPENING_HISTORICAL_INITIALIZATION_CHANGED')
        }
      }
      for(const ref of payload.openingPreparation.ownedBranchRefs) {
        if(!object(ref)||typeof ref.key!=='string'||typeof ref.sha256!=='string') {
          fail('PROGRAM_OPENING_HISTORICAL_PHASE_A_CHANGED')
        }
        const row=exactRow(ref.key,ref.sha256)
        const prior=rows.get(row.key)
        if(prior&&!same(prior.value,row.value))fail('PROGRAM_OPENING_HISTORICAL_PHASE_A_CHANGED')
        rows.set(row.key,row)
      }
      if(payload.materialPreparationJournalRefs!==undefined) {
        if(!Array.isArray(payload.materialPreparationJournalRefs))fail('PROGRAM_OPENING_HISTORICAL_JOURNAL_CHANGED')
        const owner=roleplayMaterialPreparationJournalOwnerV1(snapshot.value)
        for(const ref of payload.materialPreparationJournalRefs) {
          if(!object(ref)||typeof ref.key!=='string'||typeof ref.sha256!=='string') {
            fail('PROGRAM_OPENING_HISTORICAL_JOURNAL_CHANGED')
          }
          const row=exactRow(ref.key,ref.sha256)
          readRoleplayMaterialPreparationJournalRowV1(row.value,{key:row.key,snapshotKey:snapshot.key,owner})
          rows.set(row.key,row)
        }
      }
    }
    return [...rows.values()]
  }
  const basis=createRoleplayProgramOpeningBasisV1({tables:deps.tables,
    session:sid=>deps.session(sid) as unknown as ReadBranchSession|undefined,
    assertSourceCurrent:proof=>{
      const session=deps.session(proof.source.sessionId)
      if(!session||!flow.sourceCurrent(proof))fail('PROGRAM_OPENING_SOURCE_CHANGED')
    },assertHistoricalSourceCurrent:proof=>{
      if(!flow.historicalSourceCurrent(proof))fail('PROGRAM_OPENING_SOURCE_CHANGED')
    },readMetaCurrentIdentitySha256:sid=>{
      const key=keyOf(sid,'meta'),value=deps.tables.branch.get(key)
      if(!object(value))fail('PROGRAM_OPENING_META_IDENTITY_INVALID')
      return tavernLoreSourceCurrentRowIdentityV1(sid,{ref:{table:'branch',key,exists:true,
        sha256:recordSha256(value)},value}).ref.sha256
    },assertOwnedBranchRows:(identity,rows)=>{
      // The flow alone assembles this list from immutable input refs, its live
      // writers and Native-bound historical refs. Recheck every actual value.
      for(const row of rows) {
        const value=deps.tables[row.table??'branch'].get(row.key)
        if(!row.key.startsWith(identity.sessionId+'__')||!same(value,row.value)) {
          fail('PROGRAM_OPENING_OWNED_ROW_CHANGED')
        }
      }
    },isNativeFactsCurrent:(identity,facts)=>flow.nativeFactsCurrent(identity,facts),
    isOpeningInvocationCurrent:(identity,ref)=>flow.invocationCurrent(identity,ref)})
  flow=createRoleplayProgramOpeningV1({...deps,branch:deps.tables.branch,status:deps.tables.status,source,basis,
    readPhaseA,readNativeFacts,readHistoricalOwnedRows})
  function captureCompletedAbsenceClosure(id:string) {
    const found=flow.verified(id)
    if(found.kind!=='ready'||found.intent.status!=='completed'||!found.intent.nativeReceipt
      ||found.context.input.initialization==='schema'||!found.context.absenceDomain)return
    const {seed,input,absenceDomain}=found.context,session=deps.session(id)
    if(!session)return
    deps.assertSessionCurrent(session)
    const refs={seed:input.seedRef,
      input:programOpeningRefV1(programOpeningInputKeyV1(id,seed.operationId),input),
      intent:programOpeningRefV1(openingIntentKey(id,seed.source.importId),found.intent),
      absenceDomain:programOpeningRefV1(programOpeningDomainKeyV1(id,seed.operationId),absenceDomain)},
      materialRows:ProgramAbsenceOpeningClosureDataV1['materialRows'][number][]=[]
    let acknowledgement:ProgramAbsenceOpeningClosureDataV1['acknowledgement']=null
    if(seed.production==='generated-opening') {
      const actual=readProgramGeneratedNativeV1({session,identity:actualIdentity(found.context),
        projections:deps.projections(),messageEdits:deps.messageEdits,
        deletedMessageIds:deps.deletedMessageIds(session as unknown as ReadBranchSession)})
      if(actual.kind!=='complete'||!actual.closingAck
        ||found.intent.nativeReceipt.production!=='generated-opening'
        ||!same(actual.receipt,found.intent.nativeReceipt.receipt)) {
        fail('PROGRAM_ABSENCE_OPENING_NATIVE_CHANGED')
      }
      acknowledgement={generatedReceiptRef:actual.generatedReceiptRef,
        closingAckRef:actual.closingAck.ref,closingAck:actual.closingAck.data}
      const retained=new Map<string,ProgramAbsenceOpeningClosureDataV1['materialRows'][number]>()
      for(const step of actual.receipt.steps)for(const request of step.requests) {
        for(const kind of ['snapshot','plan'] as const) {
          const ref=request[kind],row=exactRow(ref.key,ref.sha256),prior=retained.get(ref.key)
          if(prior&&!same(prior.ref,ref))fail('PROGRAM_ABSENCE_OPENING_MATERIAL_CHANGED')
          // Freeze only immutable Native-bound material. Later player turns
          // legitimately replace task-preparation and context-window rows.
          retained.set(ref.key,{ref,value:row.value as unknown as RoleplayOpeningMaterialRecordV1})
        }
      }
      materialRows.push(...retained.values())
    }
    const closure=createProgramAbsenceOpeningClosureV1({ownerSessionId:id,
      data:{seed,input,intent:found.intent,absenceDomain,refs,acknowledgement,materialRows}})
    const assertCurrent=()=>{
      if(deps.session(id)!==session)fail('PROGRAM_ABSENCE_OPENING_SESSION_CHANGED')
      deps.assertSessionCurrent(session)
      const actual=flow.verified(id)
      if(actual.kind!=='ready'||actual.intent.status!=='completed'||actual.context.input.initialization==='schema'
        ||!same(actual.intent,found.intent)||!same(actual.context.absenceDomain,absenceDomain)) {
        fail('PROGRAM_ABSENCE_OPENING_CLOSURE_CHANGED')
      }
      for(const ref of Object.values(refs))exactRow(ref.key,ref.sha256)
      for(const row of materialRows)exactRow(row.ref.key,row.ref.sha256)
    }
    assertCurrent()
    return {closure,assertCurrent}
  }
  return {...flow,captureCompletedAbsenceClosure}
}
