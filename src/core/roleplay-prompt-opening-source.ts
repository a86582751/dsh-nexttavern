/** Actual Source/Native relationship readers plus original declarations.
 * Root separately owns fresh basis, protected execution, intent and publication. */
import {recordSha256,sha256} from './roleplay-data.js'
import {validateTavernSourceLegacyCopyV1} from './roleplay-tavern-source-inheritance-data.js'
import {compileTavernOpeningCandidates} from './tavern-card.js'
import {assertImportRecordIntegrity,projectStructuredImport,readStructuredImportDataV1} from './roleplay-import-record.js'
import {createRoleplayPromptProgramSourceV1,validatePromptProgramSourceInventoryV2,promptProgramSourceImportTupleV1}
  from './roleplay-prompt-program-source.js'
import {PROMPT_OPENING_SOURCE_POLICY_SHA256,NEXTTAVERN_PROMPT_OPENING_SOURCE_POLICY_SHA256,PromptOpeningSourceFailureV1,openingSourceFail,
  clonePromptOpeningSourceDataV1,freezePromptOpeningSourceDataV1,openingSourceObject,
  capturePromptOpeningDeclarationsV1,inspectPromptOpeningWholeSourceV1,promptOpeningInitializationInputBindingV1,
  readPromptOpeningGreetingFactsV1}
  from './roleplay-prompt-opening-source-data.js'
import type {ImportRecord} from './roleplay-import-types.js'
import type {PromptProgramSourceInventoryV2,PromptProgramTextV1} from './roleplay-prompt-program-source-types.js'
import type {OpeningSource,OpeningCatalog} from './roleplay-opening-selection.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {PromptOpeningSourceDepsV1,PromptOpeningSourceProofV1,PromptOpeningSourceRelationV1,
  PromptOpeningSourceCaptureV1,PromptOpeningInitializationV1,PromptOpeningGreetingFactsV1,PromptOpeningSourceNotApplicableV1}
  from './roleplay-prompt-opening-source-types.js'

const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const seal=<T>(value:T):T=>freezePromptOpeningSourceDataV1(clonePromptOpeningSourceDataV1(value))
// Only this module's constructed or parsed, deeply frozen outputs are reusable.
// A stored clone, another process or a live Source capture still needs its own
// validation/current-owner checks; this set supplies no runtime permission.
const parsedOpeningSourceProofs=new WeakSet<PromptOpeningSourceProofV1>()
class OpeningSourceNotApplicable extends Error {
  constructor(readonly result:PromptOpeningSourceNotApplicableV1) {super(result.reason)}
}
function hasPromptProgram(program:PromptProgramSourceInventoryV2):boolean {
  const hasProgram=(text:PromptProgramTextV1|null)=>text!==null
    &&(text.tokenization!=='complete-UTF16-partition'||text.segments!.some(part=>part.kind!=='literal'))
  return program.authorFields.some(field=>hasProgram(field.raw)||hasProgram(field.normalized))
    ||program.authorGroups.some(group=>hasProgram(group.original)||hasProgram(group.effective))
    ||program.bookEntries.some(entry=>hasProgram(entry.original)||hasProgram(entry.effective))
}
function exact(value:unknown,keys:readonly string[],pointer:string):asserts value is Record<string,unknown> {
  if(!openingSourceObject(value)||!same(Object.keys(value).sort(),[...keys].sort())) {
    openingSourceFail('OPENING_SOURCE_PROOF_INVALID',pointer)
  }
}
function relationBinding(relation:PromptOpeningSourceRelationV1,sourceIdentitySha256:string) {
  // Keep the whole actual ref in the audit proof. Its semantic currency is the
  // Source owner's sole projection, which excludes only three Native counters.
  return {...relation,branchMetaRef:{...relation.branchMetaRef,sha256:sourceIdentitySha256}}
}
function bindingBody(body:Omit<PromptOpeningSourceProofV1,'bindingSha256'|'proofSha256'>) {
  const {program,catalog,catalogSha256,...rest}=body
  return {...rest,sourceRelation:relationBinding(body.sourceRelation,program.sourceCurrentIdentitySha256),
    program:{encoding:program.encoding,inventoryBindingSha256:program.bindingSha256},catalog,
    catalogSha256,initialization:body.initialization}
}
function validateInitialization(initialization:PromptOpeningInitializationV1,proof:PromptOpeningSourceProofV1):void {
  const value=initialization,bindings=value.bindings
  const hasCurrentBooks=proof.program.book.currentNativeMembershipSha256!==undefined||proof.program.book.boundBooks!==undefined
  exact(value,value.kind==='absent'
    ?['kind','reason','markerCount','inputBindingSha256','bindings','schemaExecution','descriptorPolicy']
    :['kind','markerCount','inputBindingSha256','bindings','schemaExecution','descriptorPolicy'],'/initialization')
  exact(bindings,['domain','bookPresence','bookPointer','rawBook','rawBookSha256','rawEntries','entryOrderSha256',
    'bookInitEntryPointers','greetingFacts','greetingFactsSha256','originalBookAbsence','baselinePolicy','otherBindings',
    'schemaExecution'],'/initialization/bindings')
  if(value.schemaExecution!=='none'||value.descriptorPolicy!=='immutable-raw-initialization-declarations-v1'
    ||bindings.domain!=='immutable-raw-embedded-primary-and-complete-original-greetings'
    ||bindings.bookPointer!=='/data/character_book'||bindings.baselinePolicy!=='original-declarations-only'
    ||bindings.otherBindings!=='not-selected-for-execution'||bindings.schemaExecution!=='none'
    ||!Array.isArray(bindings.rawEntries)||bindings.rawEntries.length>4096
    ||!Array.isArray(bindings.greetingFacts)||bindings.greetingFacts.length>4096
    ||recordSha256(bindings.rawBook)!==bindings.rawBookSha256
    ||bindings.rawBookSha256!==(proof.program.book.consumerSource?.bookValueSha256??proof.program.book.rawBookSha256)
    ||!hasCurrentBooks&&bindings.rawEntries.length!==proof.program.bookEntries.length)openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/bindings')
  const rawBook=bindings.rawBook,rawContainer=rawBook?.entries
  const actualEntries=Array.isArray(rawContainer)?rawContainer.map((entry,index)=>[String(index),entry] as const)
    :openingSourceObject(rawContainer)?Object.entries(rawContainer):[]
  if(bindings.bookPresence==='actual-primary-book') {
    if(!openingSourceObject(rawBook)||bindings.originalBookAbsence!==null
      ||actualEntries.length!==bindings.rawEntries.length)openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/rawBook')
  }else if(bindings.bookPresence!=='actual-proven-book-absence'||rawBook!==null||bindings.rawEntries.length
    ||!bindings.originalBookAbsence)openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/bookAbsence')
  let markerCount=0
  for(const [index,entry] of bindings.rawEntries.entries()) {
    exact(entry,['ordinal','entryId','sourceKey','sourcePointer','rawEntrySha256','original','isInitVar','enabled',
      'effectivePromptContentSha256'],'/rawEntries/'+index)
    const original=entry.original,actual=actualEntries[index],
      programEntry=proof.program.bookEntries.find(item=>item.originalAddress===entry.sourcePointer)
    if(!openingSourceObject(original)||!actual||actual[0]!==entry.sourceKey||!same(actual[1],original)
      ||entry.ordinal!==index||!same(original,actual[1])||recordSha256(original)!==entry.rawEntrySha256
      ||(hasCurrentBooks
        ?entry.entryId!==(programEntry?.entryId??null)
          ||entry.effectivePromptContentSha256!==(programEntry?.effective.textSha256??null)
        :!programEntry||programEntry.entryId!==entry.entryId||programEntry.sourceKey!==entry.sourceKey
          ||programEntry.effective.textSha256!==entry.effectivePromptContentSha256
          ||!hash(entry.effectivePromptContentSha256))
      ||programEntry&&(programEntry.rawEntrySha256!==entry.rawEntrySha256||programEntry.original?.text!==original.content)
      ||typeof original.content!=='string'
      ||entry.sourcePointer!=='/data/character_book/entries/'+entry.sourceKey.replace(/~/g,'~0').replace(/\//g,'~1')
      ||entry.isInitVar!==String(original.comment??'').toLowerCase().includes('[initvar]')
      ||entry.enabled!==(original.enabled!==false&&original.disable!==true)) {
      openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/rawEntries/'+index)
    }
    if(entry.isInitVar)markerCount++
  }
  if(!same(bindings.bookInitEntryPointers,bindings.rawEntries.filter(entry=>entry.isInitVar).map(entry=>entry.sourcePointer))
    ||bindings.entryOrderSha256!==recordSha256(bindings.rawEntries.map(entry=>({ordinal:entry.ordinal,
      pointer:entry.sourcePointer,rawEntrySha256:entry.rawEntrySha256,isInitVar:entry.isInitVar})))
    ||bindings.greetingFactsSha256!==recordSha256(bindings.greetingFacts)
    ||bindings.greetingFacts.length!==proof.catalog.candidates.length)openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/bindings/order')
  // Array.isArray narrows a serialized readonly array to an untyped JS array.
  // Restore the protocol row type only after that real shape/budget check;
  // every row still passes exact keys and primitive checks before parsing.
  const greetings:readonly PromptOpeningGreetingFactsV1[]=bindings.greetingFacts
  for(const [index,greeting] of greetings.entries()) {
    exact(greeting,['index','sourcePointer','sourceSha256','rawText','renderedText','renderedSha256','macros',
      'identityRendering','originalInitBlocks','renderedInitBlocks',
      ...greeting.materialization===undefined?[]:['materialization']],'/greetings/'+index)
    if(typeof greeting.rawText!=='string'||typeof greeting.sourcePointer!=='string'||typeof greeting.renderedText!=='string') {
      openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/greetings/'+index)
    }
    const candidate=proof.catalog.candidates[index]
    if(!candidate||!same(greeting,readPromptOpeningGreetingFactsV1(candidate,proof.context.values))) {
      openingSourceFail('OPENING_SOURCE_PROOF_INVALID',greeting.sourcePointer)
    }
    markerCount+=greeting.originalInitBlocks.length
  }
  if(value.inputBindingSha256!==promptOpeningInitializationInputBindingV1(proof.program,bindings)) {
    openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/initialization/declarations')
  }
  if(value.markerCount!==markerCount||markerCount>0&&value.kind!=='raw-init-data'
    ||markerCount===0&&(value.kind!=='absent'||value.reason!=='no-actual-initvar-markers')) {
    openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/initialization/kind')
  }
}
/** Stored consistency only. Readers must also call the actual owner's current
 * predicate; declaration integrity grants no runtime capability. */
export function validatePromptOpeningSourceProofV1(input:unknown):PromptOpeningSourceProofV1 {
  try {
    if(input!==null&&typeof input==='object'&&parsedOpeningSourceProofs.has(input as PromptOpeningSourceProofV1)) {
      return input as PromptOpeningSourceProofV1
    }
    const value=clonePromptOpeningSourceDataV1(input)
    exact(value,['schemaVersion','encoding','authority','policySha256','schemaOpeningSourceSha256','source','sourceRelation','program','catalog',
      'catalogSha256','context','selected','initialization','initializationInputBindingSha256',
      'promptCurrentInputBindingSha256','authorityLimits','bindingSha256','proofSha256'],'/proof')
    const proof=value as unknown as PromptOpeningSourceProofV1
    const {proofSha256,bindingSha256,...body}=proof
    if(proof.schemaVersion!==1||proof.encoding!=='native-prompt-opening-source-proof-v1'
      ||proof.schemaOpeningSourceSha256!==null&&!hash(proof.schemaOpeningSourceSha256)
      ||proof.authority!=='consumer-data-only'||proof.policySha256!==(proof.program?.importTuple?.format==='json-nexttavern-v1'
        ?NEXTTAVERN_PROMPT_OPENING_SOURCE_POLICY_SHA256:PROMPT_OPENING_SOURCE_POLICY_SHA256)
      ||proofSha256!==recordSha256({bindingSha256,...body})||bindingSha256!==recordSha256(bindingBody(body))) {
      openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/proof/hash')
    }
    const program=validatePromptProgramSourceInventoryV2(proof.program),tuple=program.importTuple,selected=proof.selected
    exact(proof.source,['sessionId','importId','sourceRecordSessionId','rawSha256','normalizedSha256','transactionId',
      'coverageSha256','pointer'],'/source')
    exact(proof.context,['values','bindingSha256','valuesSha256','policy'],'/context')
    exact(selected,['index','sourcePointer','sourceSha256','rawText','renderedText','renderedSha256',
      ...selected.materialization===undefined?[]:['materialization']],'/selected')
    if(proof.source.sessionId!==program.sessionId||proof.source.sourceRecordSessionId!==tuple.sourceRecordSessionId
      ||proof.source.importId!==tuple.importId||proof.source.rawSha256!==tuple.rawSha256
      ||proof.source.normalizedSha256!==tuple.normalizedSha256||proof.source.transactionId!==tuple.transactionId
      ||proof.source.coverageSha256!==tuple.coverageSha256||!same(proof.source.pointer,tuple.activePointer)
      ||!same(proof.catalog.source,proof.source)||proof.catalogSha256!==recordSha256(proof.catalog)
      ||proof.context.policy!=='only-actual-three-identity-macros-v1'||!hash(proof.context.bindingSha256)
      ||proof.context.valuesSha256!==recordSha256(proof.context.values)
      ||!Number.isSafeInteger(selected.index)||selected.index<0)openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/source/binding')
    const candidate=proof.catalog.candidates.find(item=>item.index===selected.index)
    if(!candidate||candidate.sourcePointer!==selected.sourcePointer||candidate.sourceSha256!==selected.sourceSha256
      ||candidate.rawText!==selected.rawText||candidate.renderedText!==selected.renderedText
      ||candidate.materialization!==selected.materialization
      ||selected.renderedSha256!==sha256(selected.renderedText)
      ||!same(proof.authorityLimits,{freshBasis:'not-proven',numericalAbsence:'not-proven',initialized:'not-claimed',
        schemaExecution:'none',native:'not-authorized',protectedRenderer:'not-authorized',publish:'not-authorized'})) {
      openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/selection')
    }
    exact(proof.sourceRelation,['kind','native','branchMetaRef','inheritance','setup',
      ...proof.sourceRelation.kind==='legacy-fresh-copy-source'?['legacyCopy']:[]],'/sourceRelation')
    exact(proof.sourceRelation.native,['sessionId','headerId','parentSessionId','inheritedEventCount','origin'],'/native')
    const relation=proof.sourceRelation
    if(relation.native.sessionId!==program.sessionId||relation.native.parentSessionId!==null
      ||relation.native.inheritedEventCount!==0||relation.branchMetaRef.table!=='branch'
      ||relation.branchMetaRef.key!==program.sessionId+'__meta'||relation.branchMetaRef.exists!==true
      ||!program.currentRows.some(row=>same(row,relation.branchMetaRef)))openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/relation')
    if(relation.kind==='own-root-source') {
      if(relation.inheritance!==null||relation.setup!==null||tuple.sourceInheritance!==null
        ||tuple.sourceRecordSessionId!==program.sessionId)openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/relation/root')
    }else if(relation.kind==='legacy-fresh-copy-source') {
      const copy=validateTavernSourceLegacyCopyV1(relation.legacyCopy)
      if(relation.inheritance!==null||relation.setup!==null||tuple.sourceInheritance!==null
        ||copy.childSessionId!==program.sessionId||copy.freshFirstTurn!==true||copy.seedLength!==0
        ||copy.parentSessionId!==(tuple.activePointer as unknown as Record<string,unknown>).inheritedFrom) {
        openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/relation/legacy-fresh')
      }
    }else if(relation.kind!=='committed-fresh-cut0-source'||!same(relation.inheritance,tuple.sourceInheritance)
      ||relation.inheritance.childSessionId!==program.sessionId||relation.inheritance.nativeCut.kind!=='reserved-fresh-branch'
      ||relation.inheritance.nativeCut.seedLength!==0||!same(relation.setup.applyIntentRef,relation.inheritance.applyIntentRef)
      ||relation.setup.nativeSetupSha256!==recordSha256(relation.setup.nativeSetup)) {
      openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/relation/fresh')
    }
    validateInitialization(proof.initialization,proof)
    if(proof.initializationInputBindingSha256!==proof.initialization.inputBindingSha256
      ||proof.promptCurrentInputBindingSha256!==program.bindingSha256)openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/inputBindings')
    // Keep the exact validated child so downstream readers can reuse its DATA
    // consistency without revalidating a discarded clone of the inventory.
    const checked=freezePromptOpeningSourceDataV1({...proof,program})
    parsedOpeningSourceProofs.add(checked)
    return checked
  }catch(error) {
    if(error instanceof PromptOpeningSourceFailureV1)throw error
    return openingSourceFail('OPENING_SOURCE_PROOF_INVALID','/proof')
  }
}

export function createRoleplayPromptOpeningSourceV1(deps:PromptOpeningSourceDepsV1) {
  const programs=createRoleplayPromptProgramSourceV1(deps)
  let closed=false
  type LiveCapture={readonly wholeSha256:string;readonly proofSha256:string;
    assertCurrent():void;assertOwnerFactsCurrent():void}
  let captures=new WeakMap<PromptOpeningSourceProofV1,LiveCapture>()
  function readRelation(source:TavernLoreSourceDataV1):PromptOpeningSourceRelationV1 {
    const sid=source.sessionId,session=deps.session(sid),header=session?.header,
      meta=source.current.rows.find(row=>row.ref.table==='branch'&&row.ref.key===sid+'__meta')
    if(!session||session.id!==sid||!header||header.parentSession!==undefined&&header.parentSession!==''
      ||session.inheritedEventCount!==0||!meta?.ref.exists||!meta.value) {
      openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN','/native')
    }
    const native={sessionId:sid,headerId:typeof header.id==='string'?header.id:null,parentSessionId:null,
      inheritedEventCount:0,origin:typeof header.origin==='string'?header.origin:null} as const
    const copy=source.legacyInheritance
    if(copy) {
      if(copy.freshFirstTurn!==true||copy.seedLength!==0) {
        openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN','/source/legacy-fresh')
      }
      // Source14 owns the copy's metadata/import/Native provenance. This is a
      // distinct zero-cut relation, with no invented reservation or setup.
      return seal({kind:'legacy-fresh-copy-source',native,branchMetaRef:meta.ref,
        inheritance:null,setup:null,legacyCopy:copy})
    }
    if(!source.inheritance) {
      const pointer=source.original.activePointer as unknown as Record<string,unknown>
      if(source.sourceRecordSessionId!==sid||pointer.inheritedFrom!==undefined
        ||['sourceInheritance','inheritanceState','freshBranchFrom','inheritedFrom','inheritedAtSeedLength']
          .some(key=>Object.hasOwn(meta.value!,key)))openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN','/source/root')
      return seal({kind:'own-root-source',native,branchMetaRef:meta.ref,inheritance:null,setup:null})
    }
    if(!deps.sourceInheritance)openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN','/source/inheritance-owner')
    const actual=deps.sourceInheritance.readCommittedStaticSourceInheritance(sid),inheritance=actual.inheritance,
      apply=actual.applyIntent
    if(!same(inheritance,source.inheritance)||inheritance.childSessionId!==sid
      ||inheritance.nativeCut.kind!=='reserved-fresh-branch'||inheritance.nativeCut.seedLength!==0
      ||actual.prepared.childSessionId!==sid||actual.prepared.nativeCut.kind!=='reserved-fresh-branch'
      ||actual.prepared.nativeCut.seedLength!==0||apply.childSessionId!==sid||!apply.nativeSetup
      ||recordSha256(actual.prepared)!==inheritance.preparedRef.sha256
      ||recordSha256(apply)!==inheritance.applyIntentRef.sha256
      ||recordSha256(actual.commit)!==inheritance.commitRef.sha256
      ||recordSha256(actual.ready)!==inheritance.readyRef.sha256
      ||!Number.isSafeInteger(apply.nativeSetup.eventCount)||apply.nativeSetup.eventCount<0
      ||!hash(apply.nativeSetup.prefixSha256)||!same(apply.preparedRef,inheritance.preparedRef)
      ||!same(actual.commit.applyIntentRef,inheritance.applyIntentRef)
      ||!same(actual.ready.binding.commitRef,inheritance.commitRef)
      ||inheritance.originalBinding.sourceRecordSessionId!==source.sourceRecordSessionId
      ||inheritance.originalBinding.importId!==source.original.activePointer.importId
      ||inheritance.originalBinding.importRecordRef.sha256!==source.original.importRecordRef.sha256
      ||inheritance.originalBinding.rawSha256!==source.original.rawSha256
      ||inheritance.originalBinding.normalizedSha256!==source.original.normalizedSha256
      ||inheritance.originalBinding.coverageSha256!==source.original.coverageSha256
      ||inheritance.originalBinding.transactionId!==source.original.transactionId
      ||inheritance.originalBinding.normalizer!==source.normalizer
      ||inheritance.originalBinding.documentSha256!==source.original.documentSha256
      ||inheritance.originalBinding.dataSha256!==source.original.dataSha256) {
      openingSourceFail('OPENING_SOURCE_RELATION_UNPROVEN','/source/fresh')
    }
    // The actual Source owner has validated the original setup prefix in the
    // real Session. Do not require today's events to be empty after append.
    return seal({kind:'committed-fresh-cut0-source',native,branchMetaRef:meta.ref,inheritance,
      setup:{applyIntentRef:inheritance.applyIntentRef,nativeSetup:apply.nativeSetup,
        nativeSetupSha256:recordSha256(apply.nativeSetup)}})
  }
  function read(sid:string,index:number,style:boolean,assertOwnerCurrent:()=>void,
    saveCapture?:(proof:PromptOpeningSourceProofV1,live:LiveCapture)=>void,
    schemaOpeningSourceSha256:string|null=null):PromptOpeningSourceProofV1 {
    if(closed)openingSourceFail('OPENING_SOURCE_CHANGED','/owner/disposed')
    assertOwnerCurrent()
    if(!sid||!Number.isSafeInteger(index)||index<0||typeof style!=='boolean') {
      openingSourceFail('OPENING_SOURCE_SELECTION_INVALID','/request')
    }
    const sessionReader=deps.session,contextReader=deps.readOpeningContext,inheritanceOwner=deps.sourceInheritance,
      inheritanceReader=inheritanceOwner?.readCommittedStaticSourceInheritance,actualSession=deps.session(sid)
    const supplied=deps.inputState?programs.captureDataWithCurrentSource(sid,style,assertOwnerCurrent)
      :programs.captureWithCurrentSource(sid,style,assertOwnerCurrent)
    if(supplied.kind==='not-applicable')throw new OpeningSourceNotApplicable(supplied)
    if(supplied.kind!=='captured-program-source')openingSourceFail('OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE','/program')
    const source=supplied.source,program=supplied.data,tuple=program.importTuple
    if(program.audit.wholeSourceSha256!==source.sourceSha256) {
      openingSourceFail('OPENING_SOURCE_CHANGED','/source/program')
    }
    const suppliedData='record' in supplied?supplied:undefined,
      record=suppliedData?.record??clonePromptOpeningSourceDataV1(
        deps.readImportRecord(source.sourceRecordSessionId,tuple.importId)) as ImportRecord
    if(!suppliedData)assertImportRecordIntegrity(record)
    if(!record.sourceEnvelope||!record.activation||record.status!=='active'||record.sessionId!==source.sourceRecordSessionId
      ||record.importId!==tuple.importId||recordSha256(record)!==tuple.importRecordRef.sha256
      ||record.rawSha256!==tuple.rawSha256||record.normalizedSha256!==tuple.normalizedSha256
      ||recordSha256(record.activation)!==tuple.activationSha256)openingSourceFail('OPENING_SOURCE_IMPORT_UNPROVEN','/importRecord')
    const decoded=suppliedData?.decoded??readStructuredImportDataV1(record).decoded
    if(!suppliedData&&(decoded.data!==decoded.document.data||decoded.format!==tuple.format
      ||recordSha256(decoded.document)!==tuple.documentSha256||recordSha256(decoded.data)!==tuple.dataSha256
      ||projectStructuredImport(record,decoded).text!==record.normalizedSource)) {
      openingSourceFail('OPENING_SOURCE_IMPORT_UNPROVEN','/decoded')
    }
    const context=suppliedData?{context:source.current.openingContext.context,
      bindingSha256:source.current.openingContext.bindingSha256}:clonePromptOpeningSourceDataV1(deps.readOpeningContext(sid))
    if(!same(context.context,source.current.openingContext.context)
      ||context.bindingSha256!==source.current.openingContext.bindingSha256
      ||recordSha256(context.context)!==source.current.openingContext.valuesSha256)openingSourceFail('OPENING_SOURCE_CHANGED','/context')
    const openingSource:OpeningSource={sessionId:sid,importId:tuple.importId,sourceRecordSessionId:tuple.sourceRecordSessionId,
      rawSha256:tuple.rawSha256,normalizedSha256:tuple.normalizedSha256,transactionId:tuple.transactionId,
      coverageSha256:tuple.coverageSha256,pointer:tuple.activePointer}
    const catalog:OpeningCatalog={source:openingSource,candidates:compileTavernOpeningCandidates(decoded,context.context)},
      candidate=catalog.candidates.find(item=>item.index===index)
    if(!candidate)openingSourceFail('OPENING_SOURCE_SELECTION_INVALID','/selection')
    const sourceRelation=readRelation(source),initialization=capturePromptOpeningDeclarationsV1({source,program,
      candidates:catalog.candidates,context:context.context})
    // Literal inputs remain with the existing plain owner. This decision uses
    // the actual prompt partitions and captured original declarations;
    // it neither treats a refusal as absence nor runs another classifier.
    if(schemaOpeningSourceSha256===null&&!hasPromptProgram(program)&&initialization.kind==='absent')throw new OpeningSourceNotApplicable(
      {kind:'not-applicable',reason:'no-program-or-raw-init'})
    inspectPromptOpeningWholeSourceV1({source,decoded,record,program,context:context.context,
      bindings:initialization.bindings,schemaOpening:schemaOpeningSourceSha256!==null})
    const body={schemaVersion:1 as const,encoding:'native-prompt-opening-source-proof-v1' as const,
      authority:'consumer-data-only' as const,schemaOpeningSourceSha256,policySha256:tuple.format==='json-nexttavern-v1'
        ?NEXTTAVERN_PROMPT_OPENING_SOURCE_POLICY_SHA256:PROMPT_OPENING_SOURCE_POLICY_SHA256,
      source:openingSource,sourceRelation,program,catalog,catalogSha256:recordSha256(catalog),
      context:{values:context.context,bindingSha256:context.bindingSha256,valuesSha256:recordSha256(context.context),
        policy:'only-actual-three-identity-macros-v1' as const},
      selected:{index,sourcePointer:candidate.sourcePointer,sourceSha256:candidate.sourceSha256,rawText:candidate.rawText,
        renderedText:candidate.renderedText,renderedSha256:sha256(candidate.renderedText),
        ...(candidate.materialization?{materialization:candidate.materialization}:{})},initialization,
      initializationInputBindingSha256:initialization.inputBindingSha256,promptCurrentInputBindingSha256:program.bindingSha256,
      authorityLimits:{freshBasis:'not-proven' as const,numericalAbsence:'not-proven' as const,initialized:'not-claimed' as const,
        schemaExecution:'none' as const,native:'not-authorized' as const,protectedRenderer:'not-authorized' as const,
        publish:'not-authorized' as const}}
    const bound={...body,bindingSha256:recordSha256(bindingBody(body))}
    // These fields came from the actual Source and declaration owners above.
    // Parsing this constructed proof would clone and reparse their results.
    const proof=freezePromptOpeningSourceDataV1({...bound,proofSha256:recordSha256(bound)})
    parsedOpeningSourceProofs.add(proof)
    if(deps.inputState)return proof
    const
      importRecordSha256=tuple.importRecordRef.sha256,contextSha256=recordSha256(context),
      relationSha256=recordSha256(relationBinding(sourceRelation,program.sourceCurrentIdentitySha256))
    const assertReaderOwners=()=>{
      if(closed||deps.session!==sessionReader||deps.readOpeningContext!==contextReader
        ||deps.sourceInheritance!==inheritanceOwner
        ||inheritanceOwner?.readCommittedStaticSourceInheritance!==inheritanceReader
        ||!actualSession||deps.session(sid)!==actualSession) {
        openingSourceFail('OPENING_SOURCE_CHANGED','/owner/readers')
      }
    }
    // Opening also pins the actual Session/relation readers. Older supplied
    // captures retain their full currency guard instead of gaining a cheaper
    // owner contract from detached proof data or an unregistered reader.
    const assertOwnerFactsCurrent=()=>{
      assertReaderOwners();assertOwnerCurrent()
      if('assertCurrent' in supplied) {
        if(supplied.assertOwnerFactsCurrent)supplied.assertOwnerFactsCurrent()
        else supplied.assertCurrent()
      }
      assertReaderOwners();assertOwnerCurrent();assertReaderOwners()
    }
    const assertCurrent=()=>{
      assertReaderOwners();assertOwnerCurrent()
      // Same producer-owned Source/edit footprint as the program inventory.
      // Decode, catalog and declarations are pure results from that complete
      // first validation; the actual Session/setup reader remains live.
      if('assertCurrent' in supplied)supplied.assertCurrent()
      if(recordSha256(deps.readImportRecord(source.sourceRecordSessionId,tuple.importId))!==importRecordSha256
        ||recordSha256(clonePromptOpeningSourceDataV1(deps.readOpeningContext(sid)))!==contextSha256
        ||recordSha256(relationBinding(readRelation(source),program.sourceCurrentIdentitySha256))!==relationSha256) {
        openingSourceFail('OPENING_SOURCE_CHANGED','/current')
      }
      assertReaderOwners();assertOwnerCurrent()
    }
    assertCurrent()
    saveCapture?.(proof,{wholeSha256:recordSha256(proof),proofSha256:proof.proofSha256,
      assertCurrent,assertOwnerFactsCurrent})
    return proof
  }
  function capture(sessionId:string,selectedIndex:number,includeCardStyle:boolean,
    assertOwnerCurrent:()=>void,
    outputs?:Parameters<NonNullable<PromptOpeningSourceDepsV1['inputState']>['captureSource']>[3],
    schemaOpeningSourceSha256:string|null=null)
    :PromptOpeningSourceCaptureV1 {
    try {
      if(deps.inputState) {
        const owned=deps.inputState.captureSource(sessionId,`program-opening:${selectedIndex}:${includeCardStyle}:${schemaOpeningSourceSha256??'absence'}`,
          ()=>read(sessionId,selectedIndex,includeCardStyle,assertOwnerCurrent,undefined,schemaOpeningSourceSha256),outputs)
        const assertOwnerFactsCurrent=()=>{
          if(closed)openingSourceFail('OPENING_SOURCE_CHANGED','/owner/disposed')
          assertOwnerCurrent()
        }
        return {kind:'captured-opening-source',proof:owned.data,assertOwnerFactsCurrent,
          assertCurrent:()=>{assertOwnerFactsCurrent();owned.assertCurrent()}}
      }
      const proof=read(sessionId,selectedIndex,includeCardStyle,assertOwnerCurrent,
        (owned,currency)=>captures.set(owned,currency),schemaOpeningSourceSha256),
        live=captures.get(proof)
      if(!live)openingSourceFail('OPENING_SOURCE_UNAVAILABLE','/capture')
      return {kind:'captured-opening-source',proof,assertCurrent:live.assertCurrent,
        assertOwnerFactsCurrent:live.assertOwnerFactsCurrent}
    }catch(error) {
      if(error instanceof OpeningSourceNotApplicable)return seal(error.result)
      const diagnostic=error instanceof PromptOpeningSourceFailureV1
        ?{code:error.code,pointer:error.pointer}
        :{code:'OPENING_SOURCE_UNAVAILABLE' as const,pointer:'/source'}
      return seal({kind:'refused',authority:'none',diagnostics:[diagnostic]})
    }
  }
  function current(input:unknown,assertOwnerCurrent:()=>void):boolean {
    try {
      const proof=validatePromptOpeningSourceProofV1(input)
      if(deps.inputState) {
        const actual=capture(proof.source.sessionId,proof.selected.index,proof.program.includeCardStyle,assertOwnerCurrent,
          undefined,proof.schemaOpeningSourceSha256)
        return actual.kind==='captured-opening-source'&&actual.proof.bindingSha256===proof.bindingSha256
      }
      return read(proof.source.sessionId,proof.selected.index,proof.program.includeCardStyle,assertOwnerCurrent)
        .bindingSha256===proof.bindingSha256
    }catch{return false}
  }
  /** A completed opening keeps its original archive and Native relation.
   * Today's editable author groups are captured independently for the input. */
  function historicalCurrent(input:unknown,assertOwnerCurrent:()=>void):boolean {
    try {
      if(closed)return false
      assertOwnerCurrent()
      const proof=validatePromptOpeningSourceProofV1(input),sid=proof.source.sessionId
      const relationOrigin=(relation:PromptOpeningSourceRelationV1)=>{
        const {sha256:_auditHash,...branchMetaRef}=relation.branchMetaRef
        // Basis owns current complete metadata equality; this relation pins
        // its address and the actual Native/inheritance/setup provenance.
        return {...relation,branchMetaRef}
      }
      const readOrigin=()=>{
        const captured=deps.source.capture(sid)
        if(captured.kind!=='captured-data')openingSourceFail('OPENING_SOURCE_IMPORT_UNPROVEN','/origin')
        const source=captured.source
        return {tuple:promptProgramSourceImportTupleV1(source,captured.contributionInput.activeImport),
          relation:relationOrigin(readRelation(source))}
      }
      const actual=deps.inputState?deps.inputState.captureSource(sid,'program-origin',readOrigin).data:readOrigin()
      assertOwnerCurrent()
      return same(actual.tuple,proof.program.importTuple)&&same(actual.relation,relationOrigin(proof.sourceRelation))
    }catch{return false}
  }
  function currentCaptured(input:unknown,assertActualOwnerCurrent:()=>void):boolean {
    try {
      assertActualOwnerCurrent()
      const live=input&&typeof input==='object'?captures.get(input as PromptOpeningSourceProofV1):undefined
      if(!live)return current(input,assertActualOwnerCurrent)
      if(closed||!Object.isFrozen(input)||(input as PromptOpeningSourceProofV1).proofSha256!==live.proofSha256) {
        openingSourceFail('OPENING_SOURCE_CHANGED','/capture')
      }
      live.assertCurrent();assertActualOwnerCurrent();return true
    }catch{return false}
  }
  function dispose():void {closed=true;captures=new WeakMap();programs.dispose()}
  return {capture,current,currentCaptured,historicalCurrent,dispose}
}
