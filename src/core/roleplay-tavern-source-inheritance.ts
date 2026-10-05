/** Frozen Source inheritance owns one reservation's static writer and recovery.
 * Parent capture and child apply use the same Source FIFO in separate phases. */
import {recordSha256} from './roleplay-data.js'
import {genesis,parseHead,identityOf} from './roleplay-tavern-lore-edits-data.js'
import {createSourceInheritanceStorageV1,sourceReadBudgetV1} from './roleplay-tavern-source-inheritance-storage.js'
import type {TavernSourceReadBudgetV1} from './roleplay-tavern-source-inheritance-storage.js'
import {freezePublishedLocalEditLayerV1,validateFrozenPublishedEditLayerV1,sealFrozenSourceEditBaselineV1,
  validateFrozenSourceEditBaselineV1,validateInheritanceEditSlotV1} from './roleplay-tavern-source-edit-baseline.js'
import {inheritanceDataV1,inheritanceDataSha256V1,inheritanceFailV1,inheritanceSameV1,
  inheritanceObjectV1,inheritanceRefV1,inheritanceFreezeV1,
  sealInheritanceDataV1,validatePreparedInheritanceV1,validateApplyInheritanceV1,validateCommitInheritanceV1,
  validateReadyInheritanceV1,validateStaticRowV1,validateTavernSourceInheritanceDescriptorV1,frozenInheritanceRefV1,
  validateTavernSourceLegacyMigrationRecordV1,
  validateFrozenNonNumericalOpeningV1,validateFrozenPromptScopeRecordV1,
  validateFrozenProgramAbsenceOpeningV1,validateTavernSourceProgramAbsenceOpeningRecordV1,
  assertFrozenProgramAbsenceOpeningCutV1,assertProgramAbsenceOriginalBindingV1,
  tavernSourcePreparedKeyV1,tavernSourceApplyKeyV1,tavernSourceCommitKeyV1,tavernSourceReadyKeyV1,
  tavernSourceEditBaselineKeyV1,tavernSourceMaterialBaselineKeyV1,tavernSourceEditSlotKeyV1,
  tavernSourceMigrationKeyV1,tavernSourceProgramAbsenceOpeningKeyV1,tavernSourceFrozenPromptScopeKeyV1,
  TavernSourceInheritanceFailureV1,TAVERN_SOURCE_INHERITANCE_BOUNDS_V1}
  from './roleplay-tavern-source-inheritance-data.js'
import type {ForkOperation} from './roleplay-worldline-types.js'
import type {ForkReservation} from './roleplay-branch-routes-types.js'
import type {TavernSourceInheritanceDepsV1,TavernSourceInheritanceOwnerV1,TavernSourcePreparedV1,
  TavernSourceApplyIntentV1,TavernSourceNativeCutV1,TavernSourceCommitV1,TavernSourceReadyV1,
  TavernSourceMaterialBaselineV1,TavernSourceInheritanceReadyBindingV1,TavernSourceInheritanceLayerRefV1,
  TavernSourceInheritanceDescriptorV1,TavernSourceInheritanceRefV1,TavernSourceOwnedRowFactsV1,
  TavernSourceStaticRowV1,TavernSourceInheritanceTableV1,TavernSourceProgramAbsenceObservationV1}
  from './roleplay-tavern-source-inheritance-types.js'
import type {TavernSourceStaticTransactionV1,TavernSourceEditBaselineV1} from './roleplay-tavern-source-inheritance-types.js'

interface SourceClosedStateV1 extends TavernSourceStaticTransactionV1 {
  readonly edit:TavernSourceEditBaselineV1
  readonly material:TavernSourceMaterialBaselineV1
  readonly binding:TavernSourceInheritanceReadyBindingV1
}
interface SourceLineageReadV1 {
  readonly subjectSessionId:string
  readonly dependencyOnly:boolean
  readonly budget:TavernSourceReadBudgetV1
  readonly closed:Map<string,SourceClosedStateV1>
  readonly active:Set<string>
}
type SourceClosedConsumerV1=(facts:TavernSourceOwnedRowFactsV1,state:SourceClosedStateV1,
  opening:TavernSourceProgramAbsenceObservationV1|undefined)=>unknown
const sourceLineageReadV1=(subjectSessionId:string,dependencyOnly=false):SourceLineageReadV1=>
  ({subjectSessionId,dependencyOnly,budget:sourceReadBudgetV1(),closed:new Map(),active:new Set()})

const setupOnly=new Set(['session/end-seed','session/title','model/selection','agent-preset/selected',
  'permission/preset','sandbox/mode','approval/policy'])
export function createRoleplayTavernSourceInheritanceV1(deps:TavernSourceInheritanceDepsV1):TavernSourceInheritanceOwnerV1 {
  const store=createSourceInheritanceStorageV1(deps),branch=deps.tables.branch
  const preparedRef=(p:TavernSourcePreparedV1)=>inheritanceRefV1(tavernSourcePreparedKeyV1(p.childSessionId),p)
  // The registry belongs to this exact installed factory. No serialized or
  // foreign frozen observation can survive a callback or authenticate itself.
  const activeRowFacts=new WeakMap<TavernSourceOwnedRowFactsV1,()=>void>()
  // Data origin only. A final collect output can seed a readonly comparison
  // plan; this weak set cannot make a facts object active or prove currentness.
  const collectedRowFacts=new WeakSet<TavernSourceOwnedRowFactsV1>()
  let rowFactsDepth=0
  // This is only the DATA already validated for the current synchronous
  // consumer. It is unavailable during the Native/namespace callback itself.
  let consumerSource:SourceClosedStateV1|undefined
  const factoryBindings=()=>[deps.tables,deps.source,deps.source.capture,deps.source.current,
    deps.withSourceLock,deps.ensureParentBranch,deps.readNativeSession,deps.readOpeningContext,deps.readNumericalSourceCapture,
    deps.readPublishedLocalEditJournal,deps.captureMaterialPublications,deps.assertMaterialPublications,
    deps.captureNonNumericalOpening,deps.assertNonNumericalOpening,
    deps.captureProgramAbsenceOpening,deps.assertProgramAbsenceOpening,
    ...(['cards','worldbook','rules','opening','status','branch'] as const).flatMap(name=>{
      const table:TavernSourceInheritanceTableV1=deps.tables[name]
      return [table,table.get,table.entries,table.put]
    })]
  const installedBindings=factoryBindings()
  function assertFactoryCurrent() {
    const actual=factoryBindings()
    if(actual.length!==installedBindings.length||actual.some((value,index)=>value!==installedBindings[index]))
      inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED')
  }
  function assertNoRowFactsReentry() {
    if(rowFactsDepth)inheritanceFailV1('SOURCE_INHERITANCE_INVALID','Source closed-read re-entry from an active row-facts frame')
  }
  function assertOwnedRowFactsCurrent(facts:TavernSourceOwnedRowFactsV1) {
    const assertCurrent=activeRowFacts.get(facts)
    if(!assertCurrent)inheritanceFailV1('SOURCE_INHERITANCE_INVALID','inactive or foreign Source row-facts frame')
    assertCurrent()
  }
  function assertSynchronousResult(result:unknown):void {
    if(result===null||typeof result!=='object'&&typeof result!=='function')return
    let prototype:object|null=result as object,depth=0
    const seen=new Set<object>()
    while(prototype) {
      if(seen.has(prototype)||++depth>32)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
      seen.add(prototype)
      const then=Object.getOwnPropertyDescriptor(prototype,'then')
      if(then&&(!('value' in then)||typeof then.value==='function'))
        inheritanceFailV1('SOURCE_INHERITANCE_INVALID','asynchronous Source row-facts consumer')
      prototype=Object.getPrototypeOf(prototype)
    }
  }
  function withActiveRowFacts<T>(facts:TavernSourceOwnedRowFactsV1,p:TavernSourcePreparedV1,consume:()=>T):T {
    assertFactoryCurrent()
    const applyRow=facts.validatedRecords.find(row=>row.key===tavernSourceApplyKeyV1(p.childSessionId)),
      apply=applyRow?validateApplyInheritanceV1(applyRow.value):undefined
    assertNativeCut(p,apply)
    const native=store.native(p.childSessionId),nativeSha256=recordSha256({header:inheritanceDataV1(native.header),
      inheritedEventCount:native.inheritedEventCount,events:inheritanceDataV1(native.snapshotEvents())})
    const footprint=[...facts.validatedRecords,...facts.missingRecords,...facts.observations],
      compareRow=store.createReadonlyRowComparisonV1(collectedRowFacts.has(facts)?footprint:[],facts.validatedRecords)
    const assertCurrent=()=>{
      assertFactoryCurrent()
      for(const expected of footprint) {
        if(!compareRow(expected))inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED',expected.key)
        // Storage also owns the independent second read of validated branch
        // rows, preserving strict Native spelling and same-raw diagnostics.
      }
      const actualNative=store.native(p.childSessionId)
      assertNativeCut(p,apply)
      if(recordSha256({header:inheritanceDataV1(actualNative.header),inheritedEventCount:actualNative.inheritedEventCount,
        events:inheritanceDataV1(actualNative.snapshotEvents())})!==nativeSha256)
        inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED')
    }
    activeRowFacts.set(facts,assertCurrent);rowFactsDepth++
    try {
      assertOwnedRowFactsCurrent(facts)
      const result=consume()
      // These callbacks provide immediate current-state evidence. Async work
      // cannot extend the lifetime of the factory's live observation.
      assertSynchronousResult(result)
      assertOwnedRowFactsCurrent(facts)
      return result
    }finally {activeRowFacts.delete(facts);rowFactsDepth--}
  }
  function structuredPointer(sid:string) {
    const pointer=branch.get(`${sid}__import-active`)
    if(!inheritanceObjectV1(pointer)||typeof pointer.importId!=='string')return false
    const owner=typeof pointer.sourceRecordSessionId==='string'?pointer.sourceRecordSessionId:sid,
      record=branch.get(`${owner}__import-${pointer.importId}`)
    return inheritanceObjectV1(record)&&[4,5,6].includes(Number(record.schemaVersion))
      &&['tavern-fields-v1','tavern-fields-v2','nexttavern-fields-v1'].includes(String(record.normalizer))
  }
  function assertOperation(p:TavernSourcePreparedV1) {
    const operation=branch.get(p.operationKey)
    if(!inheritanceObjectV1(operation)||operation.operationId!==p.operationId
      ||operation.state==='aborted'||operation.abortedAt
      ||!inheritanceObjectV1(operation.anchor))inheritanceFailV1('SOURCE_INHERITANCE_OPERATION_CHANGED')
    // The reservation callback adds the actual cut before it persists the
    // operation. This same normalization is allowed only for that cut field.
    const anchor={...operation.anchor,expectedSeedLength:p.nativeCut.seedLength}
    if(recordSha256(anchor)!==p.anchorSha256
      ||(operation.reservedChildSessionId??operation.childSessionId??p.childSessionId)!==p.childSessionId)
      inheritanceFailV1('SOURCE_INHERITANCE_OPERATION_CHANGED')
  }
  function assertPreparedData(p:TavernSourcePreparedV1,reading=sourceLineageReadV1(p.childSessionId)) {
    const {budget}=reading
    // The append-only package is historical. A later cancellation/deletion of
    // a UI operation cannot rewrite an already committed child's Source.
    store.assertOriginal(p.originalBinding,budget)
    const source=p.parentSource,original=source.original,binding=p.originalBinding
    if(source.sourceRecordSessionId!==binding.sourceRecordSessionId||source.normalizer!==binding.normalizer
      ||original.activePointer.importId!==binding.importId||original.rawSha256!==binding.rawSha256
      ||original.normalizedSha256!==binding.normalizedSha256||original.coverageSha256!==binding.coverageSha256
      ||original.transactionId!==binding.transactionId||original.documentSha256!==binding.documentSha256
      ||original.dataSha256!==binding.dataSha256||original.primary.bookSha256!==recordSha256(original.primary.value))
      inheritanceFailV1('SOURCE_INHERITANCE_ORIGINAL_CHANGED')
    const inherited=source.inheritance?validateTavernSourceInheritanceDescriptorV1(source.inheritance):undefined
    if(inherited) {
      const {childSessionId,parentSessionId,operationId,nativeCut,preparedRef,applyIntentRef,commitRef,readyRef}=inherited
      if(childSessionId!==p.parentSessionId||!inheritanceSameV1(inherited.originalBinding,binding)
        ||!inheritanceSameV1(p.ancestors,[...inherited.ancestors,
          {childSessionId,parentSessionId,operationId,nativeCut,preparedRef,applyIntentRef,commitRef,readyRef}]))
        inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    }else if(p.ancestors.length||source.sourceRecordSessionId!==p.parentSessionId
      ||!inheritanceSameV1(original.activePointer,binding.originalPointer))
      inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    for(const layer of p.editLayers) {
      const parsed=validateFrozenPublishedEditLayerV1(layer)
      for(const event of parsed.events)store.readRef(event.ref,budget)
    }
    const local=p.editLayers.at(-1)
    if(!local||local.ownerSessionId!==p.parentSessionId||local.sourceSha256!==source.sourceSha256
      ||!inheritanceSameV1(local.identity,identityOf(source)))inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID')
    if(p.editLayers.reduce((sum,layer)=>sum+layer.events.length,0)>TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.events)
      inheritanceFailV1('SOURCE_INHERITANCE_BUDGET')
    store.publications(p.materialPublications,budget)
    assertPreparedOpening(p,budget)
    if(p.materialPublications.some(pub=>pub.nativeSeq>=p.nativeCut.seedLength))
      inheritanceFailV1('SOURCE_INHERITANCE_MATERIAL_INVALID')
    let previous:string|undefined
    const seen=new Set([p.childSessionId])
    for(const ancestor of p.ancestors) {
      if(seen.has(ancestor.childSessionId)||previous&&ancestor.parentSessionId!==previous)
        inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
      seen.add(ancestor.childSessionId);previous=ancestor.childSessionId
      // Earlier ancestors are already closed in this synchronous read. Reuse
      // their exact transactions and budget; no second graph traversal or
      // replay from a descendant's shorter Native prefix is needed.
      const closed=readStaticInLineage(ancestor.childSessionId,true,reading),
        {prepared:prior,applyIntent:apply,commit,ready}=closed
      if(prior.childSessionId!==ancestor.childSessionId||prior.parentSessionId!==ancestor.parentSessionId
        ||!inheritanceSameV1(closed.inheritance.preparedRef,ancestor.preparedRef)
        ||!inheritanceSameV1(closed.inheritance.applyIntentRef,ancestor.applyIntentRef)
        ||!inheritanceSameV1(closed.inheritance.commitRef,ancestor.commitRef)
        ||!inheritanceSameV1(closed.inheritance.readyRef,ancestor.readyRef)
        ||prior.operationId!==ancestor.operationId||!inheritanceSameV1(prior.nativeCut,ancestor.nativeCut)
        ||!inheritanceSameV1(apply.preparedRef,ancestor.preparedRef)
        ||!inheritanceSameV1(commit.preparedRef,ancestor.preparedRef)
        ||!inheritanceSameV1(commit.applyIntentRef,ancestor.applyIntentRef)
        ||!inheritanceSameV1(ready.binding,{schemaVersion:1,preparedRef:ancestor.preparedRef,
          applyIntentRef:ancestor.applyIntentRef,commitRef:ancestor.commitRef})
        ||!inheritanceSameV1(prior.originalBinding,p.originalBinding))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
      const inheritedEdit=closed.editBaseline
      if(inheritedEdit.childSessionId!==ancestor.childSessionId
        ||!inheritanceSameV1(inheritedEdit.preparedRef,ancestor.preparedRef)
        ||!inheritanceSameV1(inheritedEdit.layers,prior.editLayers))
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID')
      if(ancestor===p.ancestors.at(-1)&&!inheritanceSameV1(p.editLayers.slice(0,-1),inheritedEdit.layers))
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID')
    }
    if(previous&&previous!==p.parentSessionId)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    if(!p.ancestors.length&&p.editLayers.length!==1)inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID')
    if(p.parentSource.original.primary.binding==='proven-absence') {
      if(!inheritanceSameV1(p.originalAbsenceProof,p.parentSource.original.primary.absenceProof))
        inheritanceFailV1('SOURCE_INHERITANCE_ORIGINAL_CHANGED')
    }else if(p.originalAbsenceProof!==null)inheritanceFailV1('SOURCE_INHERITANCE_ORIGINAL_CHANGED')
  }
  function assertPreparedOpening(p:TavernSourcePreparedV1,budget:TavernSourceReadBudgetV1) {
    if(p.frozenProgramAbsenceOpeningV1!==undefined) {
      const frozen=validateFrozenProgramAbsenceOpeningV1(p.frozenProgramAbsenceOpeningV1)
      if(p.frozenNonNumericalOpeningV1!==undefined||!deps.assertProgramAbsenceOpening)
        inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
      assertFrozenProgramAbsenceOpeningCutV1(frozen,p.nativeCut)
      if(frozen.kind==='not-inherited')return
      const record=validateTavernSourceProgramAbsenceOpeningRecordV1(store.readRef(frozen.recordRef,budget))
      if(record.childSessionId!==p.childSessionId||record.parentSessionId!==p.parentSessionId
        ||!inheritanceSameV1(record,frozen.record))inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
      assertProgramAbsenceOriginalBindingV1(record.closure,p.originalBinding)
      // Only this child's archive is read. Original seed/input/intent refs
      // retain provenance; an ancestor's current intent is never cold authority.
      return
    }
    if(p.frozenNonNumericalOpeningV1===undefined)return
    const frozen=validateFrozenNonNumericalOpeningV1(p.frozenNonNumericalOpeningV1)
    if(!deps.assertNonNumericalOpening)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
    if(frozen.kind==='not-inherited') {
      if(p.nativeCut.kind!=='reserved-fresh-branch'||p.nativeCut.seedLength!==0)
        inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
      return
    }
    const opening=frozen.frozenOpening,scope=validateFrozenPromptScopeRecordV1(store.readRef(opening.scopeFactsRef,budget)),
      intent=store.readRef(opening.intentRef,budget),source=opening.intent.source,original=p.originalBinding
    if(p.nativeCut.kind!=='native-fork'||frozen.openingEventSpan.turnEndSeq>=p.nativeCut.seedLength
      ||scope.childSessionId!==p.childSessionId||scope.parentSessionId!==p.parentSessionId
      ||!inheritanceSameV1(scope,opening.scopeFactsRecord)||!inheritanceSameV1(scope.scopeFacts,opening.scopeFacts)
      ||!inheritanceSameV1(intent,opening.intent)||source.sessionId!==opening.ownerSessionId
      ||(source.sourceRecordSessionId??source.sessionId)!==original.sourceRecordSessionId
      ||source.importId!==original.importId||source.normalizedSha256!==original.normalizedSha256
      ||source.transactionId!==undefined&&source.transactionId!==original.transactionId
      ||opening.noNumericalInventory.sessionId!==p.parentSessionId
      ||opening.noNumericalInventory.inheritedEventCount!==p.nativeCut.parentInheritedEventCount)
      inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID')
  }
  function readPreparedInternal(sid:string,reading:SourceLineageReadV1) {
    assertNoRowFactsReentry()
    const {budget}=reading
    const p=validatePreparedInheritanceV1(store.readKey(tavernSourcePreparedKeyV1(sid),budget))
    if(p.childSessionId!==sid)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    assertPreparedData(p,reading)
    return p
  }
  function readPreparedSourceInheritance(sid:string) {return readPreparedInternal(sid,sourceLineageReadV1(sid))}
  function assertNativeCut(p:TavernSourcePreparedV1,apply?:TavernSourceApplyIntentV1) {
    const child=store.native(p.childSessionId),events=child.snapshotEvents(),cut=p.nativeCut
    if(cut.kind==='native-fork') {
      if(child.header.parentSession!==p.parentSessionId||child.inheritedEventCount!==cut.seedLength
        ||events.length<cut.seedLength||recordSha256(events.slice(0,cut.seedLength))!==cut.prefixSha256)
        inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED')
    }else {
      if(child.header.parentSession||Number(child.inheritedEventCount)!==0)
        inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED')
      if(apply?.nativeSetup) {
        if(events.length<apply.nativeSetup.eventCount
          ||recordSha256(events.slice(0,apply.nativeSetup.eventCount))!==apply.nativeSetup.prefixSha256)
          inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED')
      }else if(events.some(event=>!setupOnly.has(event.type)))inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED')
    }
  }
  function assertChildNative(p:TavernSourcePreparedV1,apply?:TavernSourceApplyIntentV1,
    reading=sourceLineageReadV1(p.childSessionId),
    consume?:(facts:TavernSourceOwnedRowFactsV1,opening:TavernSourceProgramAbsenceObservationV1|undefined)=>unknown) {
    assertNativeCut(p,apply)
    deps.assertMaterialPublications(p.childSessionId,p.materialPublications)
    if(p.frozenNonNumericalOpeningV1!==undefined) {
      if(!deps.assertNonNumericalOpening)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
      deps.assertNonNumericalOpening(p.childSessionId,p.frozenNonNumericalOpeningV1,p.nativeCut)
    }
    if(p.frozenProgramAbsenceOpeningV1!==undefined||consume) {
      if(p.frozenProgramAbsenceOpeningV1!==undefined&&!deps.assertProgramAbsenceOpening)
        inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
      const facts=collectOwnedRowFacts(p,apply,reading)
      return withActiveRowFacts(facts,p,()=>{
        const opening=p.frozenProgramAbsenceOpeningV1===undefined?undefined:
          deps.assertProgramAbsenceOpening!(p.childSessionId,p.frozenProgramAbsenceOpeningV1,p.nativeCut,facts)
        assertSynchronousResult(opening)
        return consume?.(facts,opening??undefined)
      })
    }
  }
  async function prepareSourceInheritance(operation:ForkOperation,reservation:ForkReservation) {
    const {sourceSessionId:parent,childSessionId:child,seedLength}=reservation
    if(operation.anchor.sourceSessionId!==parent||parent===child||!Number.isSafeInteger(seedLength)||seedLength<0)
      inheritanceFailV1('SOURCE_INHERITANCE_OPERATION_CHANGED')
    const raw=branch.get(tavernSourcePreparedKeyV1(child))
    if(raw!==undefined) {
      const p=readPreparedSourceInheritance(child)
      assertOperation(p)
      if(p.operationId!==operation.operationId||p.parentSessionId!==parent||p.nativeCut.seedLength!==seedLength
        ||p.anchorSha256!==recordSha256({...operation.anchor,expectedSeedLength:seedLength}))
        inheritanceFailV1('SOURCE_INHERITANCE_OPERATION_CHANGED')
      return {kind:'prepared-data' as const,disposition:'replayed' as const,frozenRef:frozenInheritanceRefV1(p)}
    }
    await deps.ensureParentBranch(parent)
    return deps.withSourceLock(parent,async()=>{
      // A second reservation may have waited for the same parent lock.
      if(branch.get(tavernSourcePreparedKeyV1(child))!==undefined) {
        const p=readPreparedSourceInheritance(child)
        assertOperation(p)
        if(p.operationId!==operation.operationId||p.parentSessionId!==parent||p.nativeCut.seedLength!==seedLength)
          inheritanceFailV1('SOURCE_INHERITANCE_OPERATION_CHANGED')
        return {kind:'prepared-data' as const,disposition:'replayed' as const,frozenRef:frozenInheritanceRefV1(p)}
      }
      const capture=deps.source.capture(parent)
      if(capture.kind==='outside-declared-domain'&&['ACTIVE_SOURCE_MISSING','LEGACY_SOURCE_OUTSIDE_DOMAIN']
        .includes(capture.code))return {kind:'legacy-unchanged' as const}
      if(capture.kind!=='captured-data')inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED')
      const source=capture.source,native=store.native(parent),events=native.snapshotEvents(),
        inherited=Number(native.inheritedEventCount)
      if(!Number.isSafeInteger(inherited)||inherited<0||seedLength>events.length)
        inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED')
      const nativeCut:TavernSourceNativeCutV1=operation.anchor.previousTurnEndSeq===null
        ?{kind:'reserved-fresh-branch',seedLength:0,parentInheritedEventCount:inherited,
          prefixEncoding:'record-sha256-native-events-prefix-v1',prefixSha256:recordSha256([])}
        :{kind:'native-fork',seedLength,parentInheritedEventCount:inherited,
          prefixEncoding:'record-sha256-native-events-prefix-v1',prefixSha256:recordSha256(events.slice(0,seedLength))}
      if(nativeCut.seedLength!==seedLength)inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED')
      const ancestor=source.inheritance?readCommittedSourceInheritance(parent):null
      if(ancestor&&ancestor.kind!=='committed-data')inheritanceFailV1('SOURCE_INHERITANCE_MISSING')
      const inheritedLayers=ancestor?.kind==='committed-data'?ancestor.editBaseline.layers:[],
        local=freezePublishedLocalEditLayerV1(source,deps.readPublishedLocalEditJournal(source)),
        parentInventory=store.inventory(parent),originalBinding=store.original(source)
      const ancestors:TavernSourceInheritanceLayerRefV1[]=source.inheritance?[...source.inheritance.ancestors,{
        childSessionId:source.inheritance.childSessionId,parentSessionId:source.inheritance.parentSessionId,
        operationId:source.inheritance.operationId,nativeCut:source.inheritance.nativeCut,
        preparedRef:source.inheritance.preparedRef,applyIntentRef:source.inheritance.applyIntentRef,
        commitRef:source.inheritance.commitRef,readyRef:source.inheritance.readyRef}]:[]
      const materialPublications=store.publications(deps.captureMaterialPublications(parent,seedLength))
      if(!deps.source.current(source))inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED')
      const capturedProgramAbsence=deps.captureProgramAbsenceOpening?.(parent,nativeCut)
      if(capturedProgramAbsence!==undefined&&!deps.assertProgramAbsenceOpening)
        inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
      const capturedOpening=capturedProgramAbsence===undefined?deps.captureNonNumericalOpening?.(parent,nativeCut):undefined
      if(capturedOpening!==undefined&&!deps.assertNonNumericalOpening)
        inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
      const frozenOpening=await store.freezeNonNumericalOpening(parent,child,nativeCut,capturedOpening)
      const frozenProgramAbsence=await store.freezeProgramAbsenceOpening(parent,child,nativeCut,capturedProgramAbsence)
      const p=validatePreparedInheritanceV1(sealInheritanceDataV1({schemaVersion:1,
        encoding:'native-tavern-source-inheritance-prepared-v1',origin:'core-reservation',operationId:operation.operationId,
        operationKey:`fork-op-${operation.operationId}`,anchorSha256:recordSha256({...operation.anchor,expectedSeedLength:seedLength}),
        parentSessionId:parent,childSessionId:child,nativeCut,parentSource:source,
        parentNumericalSource:store.numerical(parent,source.original.activePointer,parentInventory),originalBinding,
        originalAbsenceProof:source.original.primary.binding==='proven-absence'?source.original.primary.absenceProof:null,
        parentInventory,parentInventorySha256:recordSha256(parentInventory),childPointer:{...source.original.activePointer,
          inheritedFrom:parent,sourceRecordSessionId:source.sourceRecordSessionId},editLayers:[...inheritedLayers,local],
        materialPublications,ancestors,...(frozenOpening===undefined?{}:{frozenNonNumericalOpeningV1:frozenOpening}),
        ...(frozenProgramAbsence===undefined?{}:{frozenProgramAbsenceOpeningV1:frozenProgramAbsence})},'preparedSha256'))
      assertPreparedData(p)
      assertOperation(p)
      await store.putExact('branch',tavernSourcePreparedKeyV1(child),p)
      return {kind:'prepared-data' as const,disposition:'created' as const,frozenRef:frozenInheritanceRefV1(p)}
    })
  }
  function assertPreparedParentCurrent(sid:string) {
    const p=readPreparedSourceInheritance(sid),parent=store.native(p.parentSessionId),events=parent.snapshotEvents()
    assertOperation(p)
    if(!deps.source.current(p.parentSource)||!inheritanceSameV1(store.inventory(p.parentSessionId),p.parentInventory)
      ||!inheritanceSameV1(store.numerical(p.parentSessionId,p.parentSource.original.activePointer,p.parentInventory),
        p.parentNumericalSource)||Number(parent.inheritedEventCount)!==p.nativeCut.parentInheritedEventCount
      ||recordSha256(events.slice(0,p.nativeCut.seedLength))!==p.nativeCut.prefixSha256)
      inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED')
    const local=freezePublishedLocalEditLayerV1(p.parentSource,deps.readPublishedLocalEditJournal(p.parentSource))
    if(!inheritanceSameV1(local,p.editLayers.at(-1))
      ||!inheritanceSameV1(store.publications(deps.captureMaterialPublications(p.parentSessionId,p.nativeCut.seedLength)),
        p.materialPublications))inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED')
    if(p.frozenNonNumericalOpeningV1!==undefined) {
      if(!deps.captureNonNumericalOpening)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
      const actual=deps.captureNonNumericalOpening(p.parentSessionId,p.nativeCut),frozen=p.frozenNonNumericalOpeningV1,
        {frozenSha256:_,...body}=frozen
      let expected:unknown=body
      if(frozen.kind!=='not-inherited') {
        const {scopeFactsRef:__,scopeFactsRecord:___,...opening}=frozen.frozenOpening
        expected={...body,frozenOpening:opening}
      }
      if(!inheritanceSameV1(actual,expected))inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED')
    }
    if(p.frozenProgramAbsenceOpeningV1!==undefined) {
      if(!deps.captureProgramAbsenceOpening)inheritanceFailV1('SOURCE_INHERITANCE_OPENING_UNAVAILABLE')
      const actual=deps.captureProgramAbsenceOpening(p.parentSessionId,p.nativeCut),frozen=p.frozenProgramAbsenceOpeningV1
      if(actual===undefined||frozen.kind==='program-absence'&&!inheritanceSameV1(actual,frozen.record.closure))
        inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED')
    }
  }
  function assertApplyData(p:TavernSourcePreparedV1,a:TavernSourceApplyIntentV1) {
    if(a.childSessionId!==p.childSessionId||!inheritanceSameV1(a.preparedRef,preparedRef(p))
      ||a.writes.length!==p.parentInventory.length)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    for(let index=0;index<a.writes.length;index++) {
      const write=a.writes[index]!,parent=p.parentInventory[index]!,settings=parent.table==='branch'
        &&parent.key===`${p.parentSessionId}__settings`,childKey=`${p.childSessionId}__${parent.key.slice(p.parentSessionId.length+2)}`
      const value=settings&&write.prior.exists?{...parent.value,...write.prior.value}:parent.value
      if(parent.value)for(const key of ['sessionId','ownerSessionId','branchId'])if(parent.value[key]!==undefined)
        inheritanceFailV1('SOURCE_INHERITANCE_STATIC_OWNER_UNSUPPORTED',`${parent.table}:${parent.key}/${key}`)
      if(write.parentKey!==parent.key||write.childKey!==childKey||write.table!==parent.table
        ||write.prior.key!==childKey||write.prior.table!==parent.table||write.prior.exists&&!settings
        ||write.policy!==(settings?'parent-settings-then-explicit-child-fields':'exact-static-copy')
        ||!inheritanceSameV1(write.next,{table:parent.table,key:childKey,exists:parent.exists||settings&&write.prior.exists,
          sha256:value===null?'missing':recordSha256(value),value}))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    }
    if(recordSha256(a.writes.map(write=>write.next))!==a.childInventorySha256||a.priorPointer.exists)
      inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
  }
  function baselinesFor(p:TavernSourcePreparedV1) {
    const sid=p.childSessionId,pRef=preparedRef(p),edit=sealFrozenSourceEditBaselineV1(sid,pRef,p.editLayers),
      editRef=inheritanceRefV1(tavernSourceEditBaselineKeyV1(sid),edit),original=p.originalBinding,
      identity={schemaVersion:1 as const,encoding:'tavern-lore-edit-original-identity-v1' as const,
        sessionId:sid,sourceRecordSessionId:original.sourceRecordSessionId,importId:original.importId,
        rawSha256:original.rawSha256,transactionId:original.transactionId,documentSha256:original.documentSha256,
        bookPointer:'/data/character_book' as const,bookSha256:p.parentSource.original.primary.bookSha256}
    parseHead(genesis(identity),identity)
    const identitySha256=recordSha256(identity),slot=validateInheritanceEditSlotV1(sealInheritanceDataV1({schemaVersion:1,
      encoding:'native-tavern-source-edit-baseline-slot-v1',identity,identitySha256,preparedRef:pRef,baselineRef:editRef},'slotSha256')),
      slotRef=inheritanceRefV1(tavernSourceEditSlotKeyV1(identitySha256),slot),
      material=sealInheritanceDataV1({schemaVersion:1,encoding:'native-tavern-source-material-baseline-v1',
        childSessionId:sid,preparedRef:pRef,nativeCut:p.nativeCut,publications:p.materialPublications},'baselineSha256'),
      materialRef=inheritanceRefV1(tavernSourceMaterialBaselineKeyV1(sid),material)
    return {edit,editRef,slot,slotRef,material,materialRef}
  }
  function readyMetadata(p:TavernSourcePreparedV1,a:TavernSourceApplyIntentV1) {
    return {createdAt:a.createdAt,lastTurn:0,lastSeq:-1,inheritanceState:'ready',
      inheritedAtSeedLength:p.nativeCut.seedLength,...(p.nativeCut.kind==='reserved-fresh-branch'
        ?{freshBranchFrom:p.parentSessionId}:{inheritedFrom:p.parentSessionId})}
  }
  function collectOwnedRowFacts(p:TavernSourcePreparedV1,supplied:TavernSourceApplyIntentV1|undefined,
    reading:SourceLineageReadV1):TavernSourceOwnedRowFactsV1 {
    const sid=p.childSessionId,pRef=preparedRef(p),validatedRecords:TavernSourceStaticRowV1[]=[],
      missingRecords:TavernSourceStaticRowV1[]=[],observed=new Map<string,TavernSourceStaticRowV1>()
    const observe=(table:TavernSourceStaticRowV1['table'],key:string)=>{
      const row=store.readRow(table,key);observed.set(`${table}:${key}`,row);return row
    }
    const owned=(key:string,expected:unknown,required=false)=>{
      const row=store.readRow('branch',key)
      if(!row.exists) {
        if(required)inheritanceFailV1('SOURCE_INHERITANCE_MISSING',key)
        missingRecords.push(row);return false
      }
      const actual=store.readKey(key)
      if(expected===undefined||!inheritanceSameV1(actual,expected))inheritanceFailV1('SOURCE_INHERITANCE_INVALID',key)
      validatedRecords.push(inheritanceFreezeV1({...row,value:actual as Readonly<Record<string,unknown>>}));return true
    }
    owned(pRef.key,p,true)
    const frozen=p.frozenProgramAbsenceOpeningV1,legacy=p.frozenNonNumericalOpeningV1,
      archiveKey=tavernSourceProgramAbsenceOpeningKeyV1(sid),scopeKey=tavernSourceFrozenPromptScopeKeyV1(sid)
    if(frozen?.kind==='program-absence')owned(archiveKey,frozen.record,true)
    else {
      const row=observe('branch',archiveKey)
      if(!row.exists)missingRecords.push(row)
    }
    if(legacy&&legacy.kind!=='not-inherited')owned(scopeKey,legacy.frozenOpening.scopeFactsRecord,true)
    else {
      const row=observe('branch',scopeKey)
      if(!row.exists)missingRecords.push(row)
    }
    const aKey=tavernSourceApplyKeyV1(sid),cKey=tavernSourceCommitKeyV1(sid),rKey=tavernSourceReadyKeyV1(sid),
      aRow=store.readRow('branch',aKey),cRow=store.readRow('branch',cKey),rRow=store.readRow('branch',rKey),
      a=aRow.exists?validateApplyInheritanceV1(store.readKey(aKey)):undefined,
      c=cRow.exists?validateCommitInheritanceV1(store.readKey(cKey)):undefined,
      r=rRow.exists?validateReadyInheritanceV1(store.readKey(rKey)):undefined
    if((supplied&&!inheritanceSameV1(a,supplied))||(!a&&(c||r)))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    if(a)assertApplyData(p,a)
    owned(aKey,a)
    const baselines=baselinesFor(p),hasEdit=owned(baselines.editRef.key,a?baselines.edit:undefined),
      hasSlot=owned(baselines.slotRef.key,a?baselines.slot:undefined),
      hasMaterial=owned(baselines.materialRef.key,a?baselines.material:undefined)
    if(c) {
      if(!a||!hasEdit||!hasSlot||!hasMaterial||c.childSessionId!==sid
        ||!inheritanceSameV1(c.preparedRef,pRef)||!inheritanceSameV1(c.applyIntentRef,inheritanceRefV1(aKey,a))
        ||!inheritanceSameV1(c.editBaselineRef,baselines.editRef)||!inheritanceSameV1(c.editBaselineSlotRef,baselines.slotRef)
        ||!inheritanceSameV1(c.materialBaselineRef,baselines.materialRef)||c.childInventorySha256!==a.childInventorySha256
        ||c.childPointerSha256!==recordSha256(p.childPointer)||!inheritanceSameV1(c.childNumericalSource.pointer,p.childPointer)
        ||!inheritanceSameV1(c.childNumericalSource.staticRows,a.writes.map(write=>write.next)))
        inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    }
    owned(cKey,c)
    if(r) {
      if(!a||!c||r.childSessionId!==sid||!inheritanceSameV1(r.priorMeta,a.priorMeta)
        ||!inheritanceSameV1(r.binding,{schemaVersion:1,preparedRef:pRef,
          applyIntentRef:inheritanceRefV1(aKey,a),commitRef:inheritanceRefV1(cKey,c)})
        ||!inheritanceSameV1(r.metadata,readyMetadata(p,a)))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    }
    owned(rKey,r)
    const meta=observe('branch',`${sid}__meta`),pointer=observe('branch',`${sid}__import-active`)
    observe('branch',`${sid}__settings`);observe('status',`${sid}__spec`);observe('status',`${sid}__panel`)
    const migrationRow=observe('branch',tavernSourceMigrationKeyV1(sid))
    if(a&&!c) {
      if(!inheritanceSameV1(meta,a.priorMeta)||(!inheritanceSameV1(pointer,a.priorPointer)
        &&!inheritanceSameV1(pointer.value,p.childPointer)))inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT')
      for(const write of a.writes) {
        const actual=observe(write.table,write.childKey)
        if(!inheritanceSameV1(actual,write.prior)&&!inheritanceSameV1(actual,write.next))
          inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT',write.childKey)
      }
    }else if(!a&&(meta.exists||pointer.exists))inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT')
    const ready=!!(a&&c&&r&&meta.exists&&meta.value?.inheritanceState==='ready'
      &&inheritanceSameV1(meta.value.sourceInheritance,{...r.binding,readyRef:inheritanceRefV1(rKey,r)})
      &&['inheritedFrom','freshBranchFrom','inheritedAtSeedLength'].every(key=>meta.value?.[key]===r.metadata[key]))
    const associatedControlRecords:TavernSourceStaticRowV1[]=[]
    if(migrationRow.exists) {
      const migration=validateTavernSourceLegacyMigrationRecordV1(store.readKey(migrationRow.key))
      if(!r||migration.childSessionId!==sid||!inheritanceSameV1(migration.readyBinding,
        {...r.binding,readyRef:inheritanceRefV1(rKey,r)}))inheritanceFailV1('SOURCE_INHERITANCE_INVALID',migrationRow.key)
      // This is a historical control DTO joined to the exact closed records.
      // It neither publishes ready nor proves an original Native row writer.
      associatedControlRecords.push(inheritanceFreezeV1({...migrationRow,value:migration}))
    }
    const facts:TavernSourceOwnedRowFactsV1={schemaVersion:1,encoding:'native-tavern-source-owned-row-facts-v1',
      subjectSessionId:reading.subjectSessionId,recordSessionId:sid,
      purpose:reading.dependencyOnly||reading.subjectSessionId!==sid?'lineage-dependency':'subject',
      phase:r?(ready?'closed-ready':'closed-unpublished'):a?'apply-partial':'prepared',preparedRef:pRef,
      validatedRecords,missingRecords,observations:[...observed.values()],
      ...(associatedControlRecords.length?{associatedControlRecords}:{})}
    const collected=inheritanceFreezeV1(facts)
    collectedRowFacts.add(collected)
    return collected
  }
  function readStaticInLineage(sid:string,requireReady:boolean,reading:SourceLineageReadV1,
    consume?:SourceClosedConsumerV1):SourceClosedStateV1 {
    assertNoRowFactsReentry()
    const cached=reading.closed.get(sid)
    if(cached)return cached
    if(reading.active.has(sid))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    if(reading.active.size>=TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.ancestors)inheritanceFailV1('SOURCE_INHERITANCE_BUDGET')
    reading.active.add(sid)
    try {
    const {budget}=reading,p=readPreparedInternal(sid,reading),pRef=preparedRef(p),
      a=validateApplyInheritanceV1(store.readKey(tavernSourceApplyKeyV1(sid),budget)),aRef=inheritanceRefV1(tavernSourceApplyKeyV1(sid),a),
      c=validateCommitInheritanceV1(store.readKey(tavernSourceCommitKeyV1(sid),budget)),cRef=inheritanceRefV1(tavernSourceCommitKeyV1(sid),c),
      r=validateReadyInheritanceV1(store.readKey(tavernSourceReadyKeyV1(sid),budget)),rRef=inheritanceRefV1(tavernSourceReadyKeyV1(sid),r)
    assertApplyData(p,a)
    if(c.childSessionId!==sid||r.childSessionId!==sid||!inheritanceSameV1(c.preparedRef,pRef)
      ||!inheritanceSameV1(c.applyIntentRef,aRef)||c.childInventorySha256!==a.childInventorySha256
      ||c.childPointerSha256!==recordSha256(p.childPointer)||!inheritanceSameV1(c.childNumericalSource.pointer,p.childPointer)
      ||!inheritanceSameV1(c.childNumericalSource.staticRows,a.writes.map(write=>write.next))
      ||!inheritanceSameV1(r.binding,{schemaVersion:1,preparedRef:pRef,applyIntentRef:aRef,commitRef:cRef})
      ||!inheritanceSameV1(r.priorMeta,a.priorMeta))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    const edit=validateFrozenSourceEditBaselineV1(store.readRef(c.editBaselineRef,budget)),
      slot=validateInheritanceEditSlotV1(store.readRef(c.editBaselineSlotRef,budget)),material=readMaterialBaseline(c.materialBaselineRef,p,budget)
    if(!inheritanceSameV1(edit.preparedRef,pRef)||!inheritanceSameV1(edit.layers,p.editLayers)
      ||!inheritanceSameV1(slot.preparedRef,pRef)||!inheritanceSameV1(slot.baselineRef,c.editBaselineRef)
      ||c.editBaselineSlotRef.key!==tavernSourceEditSlotKeyV1(slot.identitySha256)
      ||slot.identity.sessionId!==sid||slot.identity.sourceRecordSessionId!==p.originalBinding.sourceRecordSessionId
      ||slot.identity.importId!==p.originalBinding.importId||slot.identity.rawSha256!==p.originalBinding.rawSha256
      ||slot.identity.transactionId!==p.originalBinding.transactionId
      ||slot.identity.documentSha256!==p.originalBinding.documentSha256
      ||slot.identity.bookSha256!==p.parentSource.original.primary.bookSha256)
      inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID')
    const binding:TavernSourceInheritanceReadyBindingV1={...r.binding,readyRef:rRef},meta=store.readRow('branch',`${sid}__meta`).value
    if(requireReady&&(!inheritanceObjectV1(meta)||meta.inheritanceState!=='ready'
      ||!inheritanceSameV1(meta.sourceInheritance,binding)))inheritanceFailV1('SOURCE_INHERITANCE_NOT_READY')
    const expectedMetadata={createdAt:a.createdAt,lastTurn:0,lastSeq:-1,inheritanceState:'ready',
      inheritedAtSeedLength:p.nativeCut.seedLength,...(p.nativeCut.kind==='reserved-fresh-branch'
        ?{freshBranchFrom:p.parentSessionId}:{inheritedFrom:p.parentSessionId})}
    if(!inheritanceSameV1(r.metadata,expectedMetadata))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
    if(requireReady)for(const key of ['inheritedFrom','freshBranchFrom','inheritedAtSeedLength'])
      if(meta?.[key]!==r.metadata[key])inheritanceFailV1('SOURCE_INHERITANCE_NOT_READY')
    const inheritanceBody={schemaVersion:1,
      encoding:'native-tavern-source-inheritance-data-v1',authority:'consumer-data-only',childSessionId:sid,
      parentSessionId:p.parentSessionId,operationId:p.operationId,nativeCut:p.nativeCut,preparedRef:pRef,
      applyIntentRef:aRef,commitRef:cRef,readyRef:rRef,anchorSha256:p.anchorSha256,
      parentSourceSha256:p.parentSource.sourceSha256,parentInventorySha256:p.parentInventorySha256,
      originalBinding:p.originalBinding,childPointerAtCommitSha256:c.childPointerSha256,
      editBaselineRef:c.editBaselineRef,editBaselineSlotRef:c.editBaselineSlotRef,
      materialBaselineRef:c.materialBaselineRef,ancestors:p.ancestors}
    // These fields are already private parsed data. The descriptor validator
    // performs the original bounded copy/freeze; a prior identical copy adds
    // no observation between hashing this body and validating its seal.
    const inheritance=validateTavernSourceInheritanceDescriptorV1({...inheritanceBody,
      inheritanceSha256:recordSha256(inheritanceBody)})
    const result=inheritanceFreezeV1({prepared:p,applyIntent:a,commit:c,ready:r,inheritance,
      editBaseline:edit,materialBaseline:material,edit,material,binding})
    // Cross-record, baseline, slot and requested readiness joins all precede
    // the live callback. The closed cache is populated only after it succeeds.
    assertChildNative(p,a,reading,consume?(facts,opening)=>{
      // The full Source joins and original Program reader precede this DATA
      // projection. Keep the same row/Native baseline through the consumer's
      // closing check; a second capture would lose its original preimage.
      consumerSource=result
      try {return consume(facts,result,opening)}finally {consumerSource=undefined}
    }:undefined)
    reading.closed.set(sid,result)
    return result
    }finally {reading.active.delete(sid)}
  }
  function readStatic(sid:string,requireReady=true) {return readStaticInLineage(sid,requireReady,sourceLineageReadV1(sid))}
  function readCommittedSourceLineage(sid:string,
    consume?:Parameters<TavernSourceInheritanceOwnerV1['readCommittedSourceLineage']>[1]) {
    const reading=sourceLineageReadV1(sid)
    const lineage=(current:SourceClosedStateV1)=>Object.freeze({current,
      ancestors:Object.freeze(current.prepared.ancestors.map(ref=>{
        const transaction=reading.closed.get(ref.childSessionId)
        if(!transaction)inheritanceFailV1('SOURCE_INHERITANCE_MISSING')
        return transaction
      }))})
    let captured:ReturnType<typeof lineage>|undefined
    const current=readStaticInLineage(sid,true,reading,consume?(facts,state,opening)=>{
      // The transaction and ancestors are already frozen by this owner.
      // Consume them inside this same closed read, without another lineage.
      captured=lineage(state)
      consume(captured,facts,opening)
    }:undefined)
    return captured??lineage(current)
  }
  function readMaterialBaseline(ref:TavernSourceInheritanceRefV1,p:TavernSourcePreparedV1,budget:TavernSourceReadBudgetV1)
    :TavernSourceMaterialBaselineV1 {
    const raw=store.readRef(ref,budget)
    if(!inheritanceObjectV1(raw))inheritanceFailV1('SOURCE_INHERITANCE_MATERIAL_INVALID')
    const {baselineSha256,...body}=raw
    if(raw.schemaVersion!==1||raw.encoding!=='native-tavern-source-material-baseline-v1'
      ||Object.keys(raw).length!==7||recordSha256(body)!==baselineSha256||raw.childSessionId!==p.childSessionId
      ||!inheritanceSameV1(raw.preparedRef,preparedRef(p))||!inheritanceSameV1(raw.nativeCut,p.nativeCut)
      ||!inheritanceSameV1(raw.publications,p.materialPublications))inheritanceFailV1('SOURCE_INHERITANCE_MATERIAL_INVALID')
    return raw as unknown as TavernSourceMaterialBaselineV1
  }
  async function writeReadyRecord(p:TavernSourcePreparedV1,a:TavernSourceApplyIntentV1,c:TavernSourceCommitV1) {
    const sid=p.childSessionId,pRef=preparedRef(p)
    const r=validateReadyInheritanceV1(sealInheritanceDataV1({schemaVersion:1,
      encoding:'native-tavern-source-inheritance-ready-v1',childSessionId:sid,binding:{schemaVersion:1,
        preparedRef:pRef,applyIntentRef:c.applyIntentRef,commitRef:inheritanceRefV1(tavernSourceCommitKeyV1(sid),c)},
      priorMeta:a.priorMeta,metadata:{createdAt:a.createdAt,lastTurn:0,lastSeq:-1,inheritanceState:'ready',
        inheritedAtSeedLength:p.nativeCut.seedLength,...(p.nativeCut.kind==='reserved-fresh-branch'
          ?{freshBranchFrom:p.parentSessionId}:{inheritedFrom:p.parentSessionId})}},'readySha256'))
    await store.putExact('branch',tavernSourceReadyKeyV1(sid),r)
  }
  async function applyPreparedSourceInheritance(sid:string) {
    if(branch.get(tavernSourcePreparedKeyV1(sid))===undefined) {
      const pointer=branch.get(`${sid}__import-active`),native=store.native(sid),parent=native.header.parentSession
      if(parent) {
        if(structuredPointer(String(parent)))inheritanceFailV1('SOURCE_INHERITANCE_MISSING')
      }
      if(structuredPointer(sid)&&inheritanceObjectV1(pointer)
        &&(pointer.inheritedFrom||pointer.sourceRecordSessionId&&pointer.sourceRecordSessionId!==sid))
        inheritanceFailV1('SOURCE_INHERITANCE_REQUIRES_NEW_SOURCE_ACTIVATION')
      return null
    }
    return deps.withSourceLock(sid,async()=>{
      const p=readPreparedSourceInheritance(sid),pRef=preparedRef(p)
      if(branch.get(tavernSourceCommitKeyV1(sid))!==undefined) {
        const a=validateApplyInheritanceV1(branch.get(tavernSourceApplyKeyV1(sid))),
          c=validateCommitInheritanceV1(branch.get(tavernSourceCommitKeyV1(sid)))
        assertApplyData(p,a)
        if(!inheritanceSameV1(c.preparedRef,pRef)||!inheritanceSameV1(c.applyIntentRef,
          inheritanceRefV1(tavernSourceApplyKeyV1(sid),a)))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
        // Existing commit/baseline rows are joined by the phase collector
        // before the callback or a recovered ready record can be written.
        assertChildNative(p,a)
        await writeReadyRecord(p,a,c)
        return readStatic(sid,false).binding
      }
      assertOperation(p)
      let a:TavernSourceApplyIntentV1
      if(branch.get(tavernSourceApplyKeyV1(sid))!==undefined)a=validateApplyInheritanceV1(branch.get(tavernSourceApplyKeyV1(sid)))
      else {
        assertChildNative(p)
        const priorMeta=store.readRow('branch',`${sid}__meta`),priorPointer=store.readRow('branch',`${sid}__import-active`)
        if(priorMeta.exists||priorPointer.exists)inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT')
        const writes=store.writesFor(p.parentSessionId,sid,p.parentInventory),events=store.native(sid).snapshotEvents()
        a=validateApplyInheritanceV1(sealInheritanceDataV1({schemaVersion:1,
          encoding:'native-tavern-source-inheritance-apply-intent-v1',childSessionId:sid,preparedRef:pRef,createdAt:Date.now(),
          nativeSetup:p.nativeCut.kind==='reserved-fresh-branch'?{eventCount:events.length,prefixSha256:recordSha256(events)}:null,
          priorMeta,priorPointer,writes,childInventorySha256:recordSha256(writes.map(write=>write.next))},'applyIntentSha256'))
        await store.putExact('branch',tavernSourceApplyKeyV1(sid),a)
      }
      assertApplyData(p,a)
      assertChildNative(p,a)
      for(const write of a.writes) {
        const actual=store.readRow(write.table,write.childKey)
        if(!inheritanceSameV1(actual,write.prior)&&!inheritanceSameV1(actual,write.next))
          inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT',write.childKey)
        if(write.next.exists)await store.putExact(write.table,write.childKey,write.next.value!,
          write.prior.exists?write.prior.value:undefined)
      }
      await store.putExact('branch',`${sid}__import-active`,p.childPointer)
      const {edit,editRef,slot,slotRef,material,materialRef}=baselinesFor(p)
      await store.putExact('branch',editRef.key,edit);await store.putExact('branch',slotRef.key,slot)
      await store.putExact('branch',materialRef.key,material)
      if(!inheritanceSameV1(store.inventory(sid),a.writes.map(write=>write.next)))
        inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT')
      const c=validateCommitInheritanceV1(sealInheritanceDataV1({schemaVersion:1,
        encoding:'native-tavern-source-inheritance-commit-v1',childSessionId:sid,preparedRef:pRef,
        applyIntentRef:inheritanceRefV1(tavernSourceApplyKeyV1(sid),a),editBaselineRef:editRef,editBaselineSlotRef:slotRef,
        materialBaselineRef:materialRef,childInventorySha256:a.childInventorySha256,
        childPointerSha256:recordSha256(p.childPointer),childNumericalSource:store.numerical(sid,p.childPointer,
          a.writes.map(write=>write.next))},'commitSha256'))
      await store.putExact('branch',tavernSourceCommitKeyV1(sid),c)
      await writeReadyRecord(p,a,c)
      return readStatic(sid,false).binding
    })
  }
  async function publishSourceInheritanceReady(sid:string,metadata:Readonly<Record<string,unknown>>) {
    await deps.withSourceLock(sid,async()=>{
      const state=readStatic(sid,false),{prepared:p,applyIntent:a,ready:r,binding}=state,
        meta=store.readRow('branch',`${sid}__meta`)
      if(meta.value?.inheritanceState==='ready'&&inheritanceSameV1(meta.value.sourceInheritance,binding))return
      assertOperation(p)
      if(!inheritanceSameV1(store.inventory(sid),a.writes.map(write=>write.next))
        ||!inheritanceSameV1(branch.get(`${sid}__import-active`),p.childPointer)
        ||!inheritanceSameV1(meta,a.priorMeta))inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT')
      for(const key of ['inheritedFrom','freshBranchFrom','inheritedAtSeedLength'])
        if(metadata[key]!==undefined&&metadata[key]!==r.metadata[key])inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT')
      await store.putExact('branch',`${sid}__meta`,{...inheritanceDataV1(metadata),...r.metadata,sourceInheritance:binding},
        a.priorMeta.exists?a.priorMeta.value:undefined)
      readStatic(sid,true)
    })
  }
  function readCommittedSourceInheritance(sid:string) {
    if(consumerSource?.prepared.childSessionId===sid)return {
      kind:'committed-data' as const,data:consumerSource.inheritance,
      originalAbsenceProof:consumerSource.prepared.originalAbsenceProof,
      editBaseline:consumerSource.edit,materialBaseline:consumerSource.material}
    if(branch.get(tavernSourcePreparedKeyV1(sid))===undefined)return {kind:'refused' as const,
      code:'SOURCE_INHERITANCE_REQUIRES_NEW_SOURCE_ACTIVATION' as const,
      missingEvidence:['immutable reservation Source, complete published edit journal and Native material terminal evidence']}
    try {
      const s=readStatic(sid,true)
      return {kind:'committed-data' as const,data:s.inheritance,originalAbsenceProof:s.prepared.originalAbsenceProof,
        editBaseline:s.edit,materialBaseline:s.material}
    }catch(error) {
      const failure=error instanceof TavernSourceInheritanceFailureV1?error:
        new TavernSourceInheritanceFailureV1('SOURCE_INHERITANCE_INVALID')
      return {kind:'refused' as const,code:failure.code,missingEvidence:failure.missingEvidence}
    }
  }
  function inspectLegacyActual(sid:string) {
    const facts={meta:store.readRow('branch',`${sid}__meta`),pointer:store.readRow('branch',`${sid}__import-active`),
      inventory:store.inventory(sid),records:['prepared','apply','commit','ready','edit-baseline','material-baseline']
        .map(kind=>({key:`${sid}__tavern-source-${kind}-v1`,value:branch.get(`${sid}__tavern-source-${kind}-v1`)??null}))}
    const evidenceSha256=recordSha256(facts)
    try {
      const state=readStatic(sid,false)
      if(!inheritanceSameV1(facts.inventory,state.applyIntent.writes.map(write=>write.next))
        ||!inheritanceSameV1(facts.pointer.value,state.prepared.childPointer)||!facts.meta.exists)
        return {kind:'conflict' as const,evidenceSha256,missingEvidence:['child rows/pointer conflict with frozen commit']}
      for(const key of ['inheritedFrom','freshBranchFrom','inheritedAtSeedLength'])
        if(facts.meta.value?.[key]!==state.ready.metadata[key])
          return {kind:'conflict' as const,evidenceSha256,missingEvidence:['Native cut and legacy meta provenance conflict']}
      if(facts.meta.value?.sourceInheritance!==undefined&&!inheritanceSameV1(facts.meta.value.sourceInheritance,state.binding))
        return {kind:'conflict' as const,evidenceSha256,missingEvidence:['existing Source binding conflict']}
      return {kind:'provable' as const,evidenceSha256,missingEvidence:[]}
    }catch(error) {
      return {kind:'requires-new-source-activation' as const,evidenceSha256,
        missingEvidence:error instanceof TavernSourceInheritanceFailureV1
          ?[error.code,...error.missingEvidence]:['complete frozen Source, journal and material terminal evidence']}
    }
  }
  function inspectLegacySourceInheritance(sid:string) {
    try {return inspectLegacyActual(sid)}catch(error) {
      const code=error instanceof TavernSourceInheritanceFailureV1?error.code:'SOURCE_INHERITANCE_INVALID'
      return {kind:'requires-new-source-activation' as const,
        evidenceSha256:recordSha256({schemaVersion:1,childSessionId:sid,readFailure:code}),
        missingEvidence:[code,'complete readable child inventory and original Source evidence']}
    }
  }
  async function migrateProvenLegacyInheritance(sid:string,expectedEvidenceSha256:string) {
    return deps.withSourceLock(sid,async()=>{
      const existing=branch.get(tavernSourceMigrationKeyV1(sid))
      if(existing!==undefined) {
        const checked=validateTavernSourceLegacyMigrationRecordV1(existing)
        if(checked.childSessionId!==sid)inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
        if(checked.evidenceSha256===expectedEvidenceSha256) {
          const state=readStatic(sid,false),meta=store.readRow('branch',`${sid}__meta`)
          if(!inheritanceSameV1(checked.readyBinding,state.binding))inheritanceFailV1('SOURCE_INHERITANCE_INVALID')
          if(meta.value?.inheritanceState!=='ready'||!inheritanceSameV1(meta.value.sourceInheritance,state.binding)) {
            if(!inheritanceSameV1(meta,checked.priorMeta)
              ||!inheritanceSameV1(store.inventory(sid),state.applyIntent.writes.map(write=>write.next))
              ||!inheritanceSameV1(branch.get(`${sid}__import-active`),state.prepared.childPointer))
              return {kind:'conflict' as const,evidenceSha256:inspectLegacySourceInheritance(sid).evidenceSha256,
                missingEvidence:['partial migration child preimage changed']}
            await store.putExact('branch',`${sid}__meta`,{...checked.priorMeta.value,
              inheritanceState:'ready',sourceInheritance:state.binding},checked.priorMeta.value)
          }
          readStatic(sid,true)
          return {kind:'migrated-data' as const,readyBinding:state.binding}
        }
        return {kind:'conflict' as const,evidenceSha256:inspectLegacySourceInheritance(sid).evidenceSha256,
          missingEvidence:['existing immutable migration is bound to another inspection preimage']}
      }
      const inspection=inspectLegacySourceInheritance(sid)
      if(inspection.evidenceSha256!==expectedEvidenceSha256)
        return {kind:'conflict' as const,evidenceSha256:inspection.evidenceSha256,missingEvidence:['migration preimage changed']}
      if(inspection.kind!=='provable')return inspection
      const state=readStatic(sid,false),prior=store.readRow('branch',`${sid}__meta`)
      // This explicit migration appends provenance and patches only metadata.
      // It never invents a zero journal or recopies the parent's current rows.
      const migration=sealInheritanceDataV1({schemaVersion:1,encoding:'native-tavern-source-legacy-migration-v1',
        childSessionId:sid,evidenceSha256:inspection.evidenceSha256,priorMeta:prior,
        readyBinding:state.binding},'migrationSha256')
      await store.putExact('branch',tavernSourceMigrationKeyV1(sid),migration)
      await store.putExact('branch',`${sid}__meta`,{...prior.value,inheritanceState:'ready',sourceInheritance:state.binding},prior.value)
      readStatic(sid,true)
      return {kind:'migrated-data' as const,readyBinding:state.binding}
    })
  }
  function withOwnedRowFacts<T>(sid:string,consume:(facts:TavernSourceOwnedRowFactsV1,
    transaction:TavernSourceStaticTransactionV1,opening:TavernSourceProgramAbsenceObservationV1|undefined)=>T):T {
    assertNoRowFactsReentry()
    let result!:T
    readStaticInLineage(sid,true,sourceLineageReadV1(sid),(facts,state,opening)=>
      result=consume(facts,state,opening))
    return result
  }
  return {prepareSourceInheritance,readPreparedSourceInheritance,assertOwnedRowFactsCurrent,withOwnedRowFacts,
    readPreparedFrozenSourceRef:sid=>frozenInheritanceRefV1(readPreparedSourceInheritance(sid)),
    readCommittedStaticSourceInheritance:sid=>readStatic(sid,true),
    readCommittedSourceLineage,
    readFrozenParent:(ref:TavernSourceInheritanceRefV1,subjectSessionId?:string)=>{
      assertNoRowFactsReentry()
      const budget=sourceReadBudgetV1(),p=validatePreparedInheritanceV1(store.readRef(ref,budget)),
        reading={...sourceLineageReadV1(subjectSessionId??p.childSessionId,true),budget}
      assertPreparedData(p,reading);assertChildNative(p,undefined,reading)
      return p.parentNumericalSource
    },assertPreparedParentCurrent,applyPreparedSourceInheritance,publishSourceInheritanceReady,
    readCommittedSourceInheritance,assertSourceInheritanceReady:sid=>{
      const pointer=branch.get(`${sid}__import-active`)
      if(inheritanceObjectV1(pointer)&&!pointer.inheritedFrom&&(pointer.sourceRecordSessionId??sid)===sid)return
      if(branch.get(tavernSourcePreparedKeyV1(sid))===undefined&&!structuredPointer(sid))return
      readStatic(sid,true)
    },inspectLegacySourceInheritance,migrateProvenLegacyInheritance}
}
