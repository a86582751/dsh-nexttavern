/** An inherited domain is verified against frozen original opening facts and
 * the actual child's Source/Native owners. It never rewrites a parent proof. */
import {recordSha256} from './roleplay-data.js'
import {compileTavernOpeningCandidates} from './tavern-card.js'
import {assertImportRecordIntegrity,readStructuredImportDataV1} from './roleplay-import-record.js'
import type {ImportRecord} from './roleplay-import-types.js'
import {createRoleplayTavernLoreSourceV1,tavernLoreSourceCurrentIdentityV1} from './roleplay-tavern-lore-source.js'
import {validateTavernSourceInheritanceDescriptorV1,tavernSourceOwnedRecordKeysV1}
  from './roleplay-tavern-source-inheritance-data.js'
import {inspectPromptTemplateCurrentRowsV1} from './roleplay-prompt-template-only-source.js'
import {mapPromptTemplateOnlyOriginsV1} from './roleplay-prompt-template-only-origins.js'
import {clonePromptTemplateOnlyDataV1,freezePromptTemplateOnlyDataV1,promptTemplateOnlyFail,
  validatePromptTemplateOnlyOpeningIntentV6} from './roleplay-prompt-template-only-data.js'
import type {PromptTemplateOnlySourceDepsV1,PromptTemplateOnlyInheritedSourceInputV2,
  PromptNonNumericalInventoryV2,PromptInheritedSourceProofV2} from './roleplay-prompt-template-only-types.js'
import type {MvuSourceRowRef} from './roleplay-mvu-source.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'

const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
function fail(pointer:string):never {return promptTemplateOnlyFail('PROMPT_TEMPLATE_INHERITANCE_UNPROVEN',pointer)}
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function exact(value:unknown,fields:readonly string[]):asserts value is Record<string,unknown> {
  if(!object(value)||Object.keys(value).length!==fields.length||Object.keys(value).some(key=>!fields.includes(key)))fail('/record/shape')
}
function sealed(value:unknown,encoding:string,key:string):asserts value is Record<string,unknown> {
  if(!object(value)||value.encoding!==encoding||!hash(value[key]))fail('/record')
  const body={...value};delete body[key]
  if(recordSha256(body)!==value[key])fail('/record')
}
function noOpaque(value:unknown,pointer:string):void {
  if(!value||typeof value!=='object')return
  for(const [key,child] of Object.entries(value)) {
    if(/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)||key.startsWith('$')) {
      promptTemplateOnlyFail('PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT',pointer)
    }
    noOpaque(child,pointer)
  }
}
/** This uses actual complete table enumerations. The membership evidence
 * excludes Source-owner packet bodies; their immutable references and current
 * contracts are independently verified by the actual inheritance service. */
export function readPromptNonNumericalInventoryV2(deps:PromptTemplateOnlySourceDepsV1,
  sessionId:string):PromptNonNumericalInventoryV2 {
  const session=deps.session(sessionId)
  if(!session||session.id!==sessionId||!deps.branchReady(sessionId)
    ||typeof session.inheritedEventCount!=='number'
    ||!Number.isSafeInteger(session.inheritedEventCount)||session.inheritedEventCount<0)fail('/inventory/session')
  const prefix=`${sessionId}__`,seen=new Set<string>(),statusRows:MvuSourceRowRef[]=[]
  const owned=new Set(tavernSourceOwnedRecordKeysV1(sessionId)),branchClasses:unknown[]=[]
  owned.add(`${sessionId}__tavern-source-frozen-prompt-scope-v1`)
  let count=0
  for(const table of ['branch','status'] as const)for(const [key,supplied] of deps.entries(table)) {
    if(typeof key!=='string'||!key.startsWith(prefix))continue
    if(++count>16_384||seen.has(`${table}:${key}`))promptTemplateOnlyFail('PROMPT_TEMPLATE_BUDGET','/inventory')
    seen.add(`${table}:${key}`)
    const value=clonePromptTemplateOnlyDataV1(supplied)
    if(supplied===undefined||!same(supplied,deps.readRow(table,key)))fail('/inventory/rows')
    const suffix=key.slice(prefix.length)
    if(table==='status'&&!['spec','panel'].includes(suffix)
      ||/^(?:mvu|state|stat_data|statData|variables|schema|opaqueState)(?:[-_]|$)/i.test(suffix)) {
      promptTemplateOnlyFail('PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT','/inventory')
    }
    if(table==='status') {
      noOpaque(value,'/inventory/status')
      statusRows.push({table,key,exists:true,sha256:recordSha256(value)})
    }else if(!owned.has(key)) {
      // Activation imports carry immutable author bytes checked by Source.
      // Opening/input ledgers carry typed absence declarations checked by
      // their respective owners. All other actual branch data is inspected.
      const importRow=object(value)&&suffix===`import-${String(value.importId)}`
      if(importRow)assertImportRecordIntegrity(value as unknown as ImportRecord)
      const inputRow=/^native-input-v2-(?:current|(?:work|stop)-[a-f0-9]{64})$/.test(suffix)
      const openingRow=object(value)&&suffix===`opening-choice-${String((value.source as Record<string,unknown>)?.importId)}`
      if(openingRow&&(value.schemaVersion===5||value.schemaVersion===4&&value.mode==='native-json')) {
        promptTemplateOnlyFail('PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT','/inventory/opening')
      }
      const managed=importRow||suffix==='import-active'||inputRow||openingRow
      if(!importRow)noOpaque(value,'/inventory/branch')
      if(!managed&&suffix!=='meta'&&suffix!=='settings')branchClasses.push({key,sha256:recordSha256(value)})
    }
  }
  statusRows.sort((a,b)=>a.key.localeCompare(b.key));branchClasses.sort((a,b)=>recordSha256(a).localeCompare(recordSha256(b)))
  const parentSessionId=typeof session.header?.parentSession==='string'?session.header.parentSession:null
  const body={schemaVersion:2 as const,encoding:'native-prompt-nonnumerical-inventory-v2' as const,
    authority:'consumer-data-only' as const,sessionId,parentSessionId,inheritedEventCount:session.inheritedEventCount,
    numericalRows:[] as [],opaqueRows:[] as [],statusRows,
    branchMembershipSha256:recordSha256(branchClasses),statusMembershipSha256:recordSha256(statusRows)}
  return freezePromptTemplateOnlyDataV1({...body,inventorySha256:recordSha256(body)})
}
export function validatePromptNonNumericalInventoryV2(value:unknown):PromptNonNumericalInventoryV2 {
  const data=clonePromptTemplateOnlyDataV1(value)
  exact(data,['schemaVersion','encoding','authority','sessionId','parentSessionId','inheritedEventCount',
    'numericalRows','opaqueRows','statusRows','branchMembershipSha256','statusMembershipSha256','inventorySha256'])
  sealed(data,'native-prompt-nonnumerical-inventory-v2','inventorySha256')
  if(data.schemaVersion!==2||data.authority!=='consumer-data-only'||typeof data.sessionId!=='string'
    ||data.parentSessionId!==null&&typeof data.parentSessionId!=='string'
    ||!Number.isSafeInteger(data.inheritedEventCount)||Number(data.inheritedEventCount)<0
    ||!same(data.numericalRows,[])||!same(data.opaqueRows,[])||!Array.isArray(data.statusRows)
    ||data.statusRows.some(row=>!object(row)||row.table!=='status'||row.exists!==true||!hash(row.sha256)
      ||row.key!==`${data.sessionId}__spec`&&row.key!==`${data.sessionId}__panel`)
    ||!hash(data.branchMembershipSha256)||data.statusMembershipSha256!==recordSha256(data.statusRows))fail('/inventory')
  return freezePromptTemplateOnlyDataV1(data as unknown as PromptNonNumericalInventoryV2)
}
export function validatePromptInheritedSourceInputV2(value:unknown):PromptTemplateOnlyInheritedSourceInputV2 {
  const data=clonePromptTemplateOnlyDataV1(value)
  exact(data,['schemaVersion','encoding','authority','childSessionId','parentSessionId','sourceInheritance','childSource',
    'frozenOpening','actualChildCut','inputSha256'])
  sealed(data,'native-prompt-template-only-inherited-source-input-v2','inputSha256')
  const input=data as unknown as PromptTemplateOnlyInheritedSourceInputV2
  const inheritance=validateTavernSourceInheritanceDescriptorV1(input.sourceInheritance)
  const frozen=input.frozenOpening,row=frozen?.intent,cut=input.actualChildCut
  exact(frozen,['ownerSessionId','intent','intentRef','nativeReceipt','scopeFacts','scopeFactsRef','scopeFactsRecord','noNumericalInventory'])
  exact(cut,['sessionId','parentSessionId','inheritedEventCount','cut','childPrefixSha256','openingEventSeq',
    'openingEventSha256','originalMessageVersionSha256'])
  if(input.schemaVersion!==2||input.authority!=='consumer-data-only'||input.childSessionId===input.parentSessionId
    ||inheritance.childSessionId!==input.childSessionId||inheritance.parentSessionId!==input.parentSessionId
    ||!row||row.status!=='completed'||!row.textRetained||row.sessionId!==frozen.ownerSessionId
    ||!same(row.nativeReceipt,frozen.nativeReceipt)||!hash(frozen.intentRef?.sha256)
    ||frozen.intentRef.sha256!==recordSha256(row)||!hash(frozen.scopeFactsRef?.sha256)
    ||frozen.scopeFactsRef.key!==`${input.childSessionId}__tavern-source-frozen-prompt-scope-v1`
    ||frozen.scopeFactsRef.sha256!==recordSha256(frozen.scopeFactsRecord)
    ||frozen.nativeReceipt?.sessionId!==row.sessionId||frozen.nativeReceipt.flushed!==true
    ||cut?.sessionId!==input.childSessionId||cut.parentSessionId!==input.parentSessionId
    ||cut.cut.kind!=='native-fork'||!same(cut.cut,inheritance.nativeCut)
    ||cut.inheritedEventCount!==cut.cut.seedLength||cut.childPrefixSha256!==cut.cut.prefixSha256)fail('/inherited')
  exact(frozen.scopeFactsRecord,['schemaVersion','encoding','authority','childSessionId','parentSessionId',
    'scopeFacts','scopeFactsSha256','recordSha256'])
  sealed(frozen.scopeFactsRecord,'native-tavern-frozen-prompt-scope-record-v1','recordSha256')
  if(frozen.scopeFactsRecord.schemaVersion!==1||frozen.scopeFactsRecord.authority!=='consumer-data-only'
    ||frozen.scopeFactsRecord.childSessionId!==input.childSessionId||frozen.scopeFactsRecord.parentSessionId!==input.parentSessionId
    ||!same(frozen.scopeFactsRecord.scopeFacts,frozen.scopeFacts)
    ||frozen.scopeFactsRecord.scopeFactsSha256!==recordSha256(frozen.scopeFacts))fail('/inherited/scope-record')
  const inventory=validatePromptNonNumericalInventoryV2(frozen.noNumericalInventory)
  if(inventory.sessionId!==input.parentSessionId)fail('/inherited/parent-inventory')
  const inheritedScope=object(frozen.scopeFacts)&&frozen.scopeFacts.encoding==='native-prompt-inherited-scope-facts-v2'
  if(inheritedScope) {
    const facts=frozen.scopeFacts as Record<string,unknown>
    sealed(facts,'native-prompt-inherited-scope-facts-v2','factsSha256')
    const previous=validatePromptInheritedSourceProofV2(facts.sourceProof)
    if(facts.sessionId!==input.parentSessionId||!same(previous.input.frozenOpening.intent,row)
      ||!same(facts.nativeOpening,row.nativeReceipt)||!same(facts.inventory,inventory))fail('/inherited/scope')
  }
  if(row.schemaVersion===6) {
    validatePromptTemplateOnlyOpeningIntentV6(row)
    if(!inheritedScope&&(!object(frozen.scopeFacts)||frozen.scopeFacts.encoding!=='native-prompt-template-only-scope-facts-v1'
      ||!same(frozen.scopeFacts.sourceProof,row.promptTemplateSourceProof)
      ||!same(frozen.scopeFacts.nativeOpening,row.nativeReceipt)))fail('/inherited/scope')
  }else if(row.schemaVersion===4) {
    if(row.mode!=='plain'||row.initialization||row.initializationReceipt||!row.absenceScopeProof)fail('/inherited/plain')
    sealed(row.absenceScopeProof,'native-mvu-absence-scope-proof-v1','proofSha256')
    sealed(row.absenceScopeProof.sourceSnapshot,'native-mvu-source-snapshot-v1','snapshotSha256')
    if(row.absenceScopeProof.reason!=='closed-native-scope-no-initialization'
      ||!same(row.absenceScopeProof.sourceSnapshot.source,row.source)
      ||!inheritedScope&&(!object(frozen.scopeFacts)||frozen.scopeFacts.encoding!=='native-plain-prompt-scope-facts-v1'
      ||!same(frozen.scopeFacts.absenceScopeProof,row.absenceScopeProof)
      ||!same(frozen.scopeFacts.nativeOpening,row.nativeReceipt)))fail('/inherited/plain')
  }else fail('/inherited/intent')
  return freezePromptTemplateOnlyDataV1(input)
}
export function validatePromptInheritedSourceProofV2(value:unknown):PromptInheritedSourceProofV2 {
  const data=clonePromptTemplateOnlyDataV1(value)
  exact(data,['schemaVersion','encoding','authority','mode','sessionId','parentSessionId','input',
    'childSourceBindingSha256','hashEncoding','childInventory','templateFields','requiredPromptRuntime','proofSha256'])
  if(!object(data.input)||!object(data.input.childSource))fail('/proof/input')
  if(!object(data)||data.encoding!=='native-prompt-inherited-source-proof-v2'||!hash(data.proofSha256)
    ||inheritedProofSha256V2(data as unknown as PromptInheritedSourceProofV2)!==data.proofSha256)fail('/proof/hash')
  const proof=data as unknown as PromptInheritedSourceProofV2
  const input=validatePromptInheritedSourceInputV2(proof.input),inventory=validatePromptNonNumericalInventoryV2(proof.childInventory)
  if(proof.schemaVersion!==2||proof.authority!=='consumer-data-only'||proof.sessionId!==input.childSessionId
    ||proof.parentSessionId!==input.parentSessionId||inventory.sessionId!==proof.sessionId
    ||inventory.parentSessionId!==proof.parentSessionId||inventory.inheritedEventCount!==input.actualChildCut.inheritedEventCount
    ||proof.childSourceBindingSha256!==childSourceBindingSha256V2(input.childSource)
    ||proof.hashEncoding!=='native-prompt-inherited-stable-source-projection-v2'
    ||proof.mode!==input.frozenOpening.intent.mode||!Array.isArray(proof.templateFields)
    ||proof.mode==='plain'&&(!same(proof.templateFields,[])||proof.requiredPromptRuntime!==null)
    ||proof.mode==='prompt-template-only'&&(!proof.requiredPromptRuntime||proof.templateFields.length!==6
      ||input.frozenOpening.intent.schemaVersion!==6
      ||!same(proof.requiredPromptRuntime,input.frozenOpening.intent.promptTemplateSourceProof.requiredPromptRuntime)))fail('/proof')
  return freezePromptTemplateOnlyDataV1(proof)
}
/** The complete actual Source stays in input for audit. Only the explicitly
 * listed Native progress counters are projected out of prompt currency; all
 * other metadata fields remain classified and hashed. No canonical Source
 * digest is relabelled as this independently versioned material digest. */
function childSourceBindingSha256V2(source:TavernLoreSourceDataV1):string {
  for(const row of source.current.rows) {
    if(row.ref.table!=='branch'||row.ref.key!==`${source.sessionId}__meta`)continue
    if(!object(row.value))fail('/child/meta')
    const allowed=['createdAt','lastTurn','lastSeq','surfaceTokens','inheritanceState','inheritedFrom',
      'freshBranchFrom','truncatedFrom','inheritedAtSeedLength','sourceInheritance']
    if(Object.keys(row.value).some(key=>!allowed.includes(key))||row.value.inheritanceState!=='ready'
      ||row.value.freshBranchFrom||row.value.truncatedFrom)fail('/child/meta')
    for(const key of ['lastTurn','lastSeq','surfaceTokens']) {
      if(row.value[key]!==undefined&&(typeof row.value[key]!=='number'||!Number.isFinite(row.value[key])))fail('/child/meta')
    }
  }
  return recordSha256({schemaVersion:2,encoding:'native-prompt-inherited-child-source-binding-v2',
    excludedNativeProgressFields:['lastTurn','lastSeq','surfaceTokens'],
    sourceIdentity:tavernLoreSourceCurrentIdentityV1(source)})
}
function inheritedProofSha256V2(proof:Omit<PromptInheritedSourceProofV2,'proofSha256'>|PromptInheritedSourceProofV2):string {
  const {proofSha256:_,...body}=proof as PromptInheritedSourceProofV2
  const {inputSha256:__,childSource:___,...input}=proof.input
  return recordSha256({...body,input:{...input,childSourceBindingSha256:childSourceBindingSha256V2(proof.input.childSource)}})
}
export function createRoleplayPromptInheritedSourceV2(deps:PromptTemplateOnlySourceDepsV1,
  nativeCurrent:(input:PromptTemplateOnlyInheritedSourceInputV2)=>boolean) {
  const lore=createRoleplayTavernLoreSourceV1(deps)
  function produce(sessionId:string):{kind:'ready';proof:PromptInheritedSourceProofV2}|{kind:'blocked';code:string} {
    try {
      const actualOwner=deps.readInheritedPromptTemplateSource?.(sessionId)
      if(!actualOwner||actualOwner.kind!=='ready'||!actualOwner.current())fail('/owner')
      const input=validatePromptInheritedSourceInputV2(actualOwner.data)
      if(input.childSessionId!==sessionId||!nativeCurrent(input))fail('/native')
      const scopeRecord=deps.readRow('branch',input.frozenOpening.scopeFactsRef.key)
      if(!same(scopeRecord,input.frozenOpening.scopeFactsRecord)
        ||recordSha256(scopeRecord)!==input.frozenOpening.scopeFactsRef.sha256)fail('/scope-record/current')
      const capture=lore.capture(sessionId)
      if(capture.kind!=='captured-data'||!same(capture.source,input.childSource))fail('/child/source')
      const source=capture.source as TavernLoreSourceDataV1&{inheritance?:unknown}
      if(!same(source.inheritance,input.sourceInheritance))fail('/child/inheritance')
      const record=capture.contributionInput.activeImport as ImportRecord
      assertImportRecordIntegrity(record)
      const original=input.sourceInheritance.originalBinding,frozen=input.frozenOpening.intent
      const snapshot=frozen.schemaVersion===6?frozen.promptTemplateSourceProof.sourceSnapshot:frozen.absenceScopeProof!.sourceSnapshot
      if(source.sourceRecordSessionId!==original.sourceRecordSessionId||record.importId!==original.importId
        ||record.rawSha256!==original.rawSha256||record.normalizedSha256!==original.normalizedSha256
        ||recordSha256(record)!==original.importRecordRef.sha256||source.original.documentSha256!==original.documentSha256
        ||source.original.dataSha256!==original.dataSha256||recordSha256(record.activation)!==original.activationSha256
        ||snapshot.source.importId!==original.importId||snapshot.source.rawSha256!==original.rawSha256
        ||snapshot.source.normalizedSha256!==original.normalizedSha256||snapshot.source.transactionId!==original.transactionId
        ||snapshot.importRecordSha256!==original.importRecordRef.sha256||snapshot.coverageSha256!==original.coverageSha256
        ||!same(snapshot.source.pointer,original.originalPointer))fail('/original/binding')
      const envelope=record.sourceEnvelope
      if(!envelope)fail('/original/envelope')
      const decoded=readStructuredImportDataV1(record).decoded
      const context=source.current.openingContext.context,candidates=compileTavernOpeningCandidates(decoded,context)
      const selected=candidates.find(candidate=>candidate.index===frozen.index)
      if(!selected||selected.sourcePointer!==frozen.sourcePointer||selected.sourceSha256!==frozen.sourceSha256
        ||selected.renderedText!==frozen.renderedText||!same(source.current.openingContext.context,
          deps.readOpeningContext(sessionId).context))fail('/opening')
      let fields:PromptInheritedSourceProofV2['templateFields']=[]
      let runtime:PromptInheritedSourceProofV2['requiredPromptRuntime']=null
      if(frozen.schemaVersion===6) {
        if(Object.hasOwn(decoded.data,'character_book')||source.original.primary.binding!=='proven-absence')fail('/book')
        const mapped=mapPromptTemplateOnlyOriginsV1({decoded,record,source})
        const old=frozen.promptTemplateSourceProof.templateFields
        // Origins target actual child keys. Programs and raw/normalised bytes
        // remain identical to the independently classified frozen root.
        if(!same(mapped.fields.map(({projection,...field})=>field),old.map(({projection,...field})=>field)))fail('/fields')
        inspectPromptTemplateCurrentRowsV1(source,mapped.owned,context)
        fields=mapped.fields;runtime=frozen.promptTemplateSourceProof.requiredPromptRuntime
      }else inspectPromptTemplateCurrentRowsV1(source,new Map(),context)
      const inventory=readPromptNonNumericalInventoryV2(deps,sessionId)
      if(!actualOwner.current()||!nativeCurrent(input))fail('/current')
      const body={schemaVersion:2 as const,encoding:'native-prompt-inherited-source-proof-v2' as const,
        authority:'consumer-data-only' as const,mode:frozen.mode as 'plain'|'prompt-template-only',sessionId,
        parentSessionId:input.parentSessionId,input,childSourceBindingSha256:childSourceBindingSha256V2(source),
        hashEncoding:'native-prompt-inherited-stable-source-projection-v2' as const,childInventory:inventory,
        templateFields:fields,requiredPromptRuntime:runtime}
      return {kind:'ready',proof:validatePromptInheritedSourceProofV2({...body,proofSha256:inheritedProofSha256V2(body)})}
    }catch(error) {return {kind:'blocked',code:error instanceof Error?error.message:'PROMPT_TEMPLATE_INHERITANCE_UNPROVEN'}}
  }
  function current(value:PromptInheritedSourceProofV2):boolean {
    try {const saved=validatePromptInheritedSourceProofV2(value),actual=produce(saved.sessionId)
      return actual.kind==='ready'&&saved.proofSha256===actual.proof.proofSha256}catch{return false}
  }
  return {produce,current,readScopeInventory:(sid:string)=>readPromptNonNumericalInventoryV2(deps,sid)}
}
