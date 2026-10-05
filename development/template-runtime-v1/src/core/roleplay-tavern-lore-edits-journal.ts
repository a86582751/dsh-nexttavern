/** Complete cold-reader ownership. Only a valid head publishes immutable events;
 * full namespace membership is retained to catch pending/orphan writes. */
import {recordSha256} from './roleplay-data.js'
import {compileTavernLoreBookV1,resolveTavernLoreContentTextV1} from './tavern-lore-compiler.mjs'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {composeRoleplayTavernCurrentOverlayV1} from './roleplay-tavern-current-overlay.js'
import {validateFrozenSourceEditBaselineV1,validateInheritanceEditSlotV1}
  from './roleplay-tavern-source-edit-baseline.js'
import {tavernSourceEditSlotKeyV1} from './roleplay-tavern-source-inheritance-data.js'
import type {TavernSourceEditBaselineV1,TavernSourceInheritanceRefV1}
  from './roleplay-tavern-source-inheritance-types.js'
import {TAVERN_LORE_EDITS_BOUNDS_V1,fail,freeze,strictData,same,identityOf,namespace,headKey,eventKey,
  rowRef,headRef,genesis,parseHead,parseEvent,nextHead,validateFields,compilerInput,LoreEditFailureV1}
  from './roleplay-tavern-lore-edits-data.js'
import type {EditAccumulationV1} from './roleplay-tavern-lore-edits-data.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreCurrentNativeOverlayV1,TavernLoreSemanticEntryV1}
  from './tavern-lore-plan-types.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {TavernLoreEditsDepsV1,TavernLoreEditIdentityV1,TavernLoreEditHeadV1,TavernLoreEditEventV1,
  TavernLoreEditRefV1,TavernLoreEditHeadRefV1,TavernLoreEditsDataV1,TavernLoreEditEditorDataV1}
  from './roleplay-tavern-lore-edits-types.js'

export interface LoreEditJournalV1 {
  readonly identity:TavernLoreEditIdentityV1
  readonly identitySha256:string
  readonly head:TavernLoreEditHeadV1
  readonly headRef:TavernLoreEditHeadRefV1
  readonly events:ReadonlyMap<string,TavernLoreEditEventV1>
  readonly published:readonly TavernLoreEditEventV1[]
  readonly pending:TavernLoreEditEventV1|null
  readonly refs:readonly TavernLoreEditRefV1[]
  readonly refsSha256:string
  readonly inherited?:{readonly baseline:TavernSourceEditBaselineV1;
    readonly baselineRef:TavernSourceInheritanceRefV1;readonly slotRef:TavernSourceInheritanceRefV1}
}
export const journalReferencesShaV1=(refs:readonly TavernLoreEditRefV1[],inherited?:LoreEditJournalV1['inherited'])=>
  recordSha256(inherited?{local:refs,inherited:{baselineRef:inherited.baselineRef,slotRef:inherited.slotRef,
    baselineSha256:inherited.baseline.baselineSha256}}:refs)
/** Existing live consumers retain the Source checkpoint after the complete
 * namespace parser. Owned synchronous input capture uses that parser directly. */
export function readJournal(deps:TavernLoreEditsDepsV1,source:TavernLoreSourceDataV1,
  assertCapturedSourceCurrent?:()=>void):LoreEditJournalV1 {
  const journal=readJournalData(deps,source)
  if(assertCapturedSourceCurrent)assertCapturedSourceCurrent()
  else if(!deps.source.current(source))fail('SOURCE_CHANGED')
  return journal
}
/** Read and validate the actual whole edit namespace once. Source currency
 * belongs to the surrounding input Owner or the live wrapper above. */
export function readJournalData(deps:Pick<TavernLoreEditsDepsV1,'branch'>,source:TavernLoreSourceDataV1):LoreEditJournalV1 {
  const identity=identityOf(source),identitySha256=recordSha256(identity),prefix=namespace(identitySha256)
  const values=new Map<string,unknown>(),refs:TavernLoreEditRefV1[]=[]
  let inherited:LoreEditJournalV1['inherited']
  if(source.inheritance) {
    try {
      const {editBaselineRef:baselineRef,editBaselineSlotRef:slotRef,preparedRef}=source.inheritance,
        baselineRaw=deps.branch.get(baselineRef.key),slotRaw=deps.branch.get(slotRef.key)
      if(source.inheritance.childSessionId!==source.sessionId||slotRef.key!==tavernSourceEditSlotKeyV1(identitySha256)
        ||recordSha256(baselineRaw)!==baselineRef.sha256||recordSha256(slotRaw)!==slotRef.sha256)
        fail('JOURNAL_INHERITANCE_INVALID')
      const baseline=validateFrozenSourceEditBaselineV1(baselineRaw),slot=validateInheritanceEditSlotV1(slotRaw)
      if(baseline.childSessionId!==source.sessionId||!same(baseline.preparedRef,preparedRef)
        ||!same(slot.identity,identity)||slot.identitySha256!==identitySha256
        ||!same(slot.preparedRef,preparedRef)||!same(slot.baselineRef,baselineRef))fail('JOURNAL_INHERITANCE_INVALID')
      inherited={baseline,baselineRef,slotRef}
    }catch {fail('JOURNAL_INHERITANCE_INVALID')}
  }
  let bytes=0,seenInheritedSlot=false
  try {
    // The prefix declares membership to the central read Owner. Iteration and
    // this parser's filtering/order stay identical for ordinary table adapters.
    for(const [key,raw] of deps.branch.entries(prefix)) {
      if(typeof key!=='string')fail('STORAGE_READ_FAILED')
      if(!key.startsWith(prefix))continue
      if(inherited&&key===inherited.slotRef.key) {
        if(seenInheritedSlot)fail('JOURNAL_INHERITANCE_INVALID')
        seenInheritedSlot=true
        if(recordSha256(raw)!==inherited.slotRef.sha256
          ||recordSha256(deps.branch.get(key))!==inherited.slotRef.sha256)fail('JOURNAL_INHERITANCE_INVALID')
        continue
      }
      if(values.has(key))fail('JOURNAL_ORPHAN_CONFLICT')
      if(values.size>=TAVERN_LORE_EDITS_BOUNDS_V1.events+1)fail('JOURNAL_LIMIT')
      const value=strictData(raw,TAVERN_LORE_EDITS_BOUNDS_V1.recordBytes)
      bytes+=Buffer.byteLength(JSON.stringify(value),'utf8')
      if(bytes>TAVERN_LORE_EDITS_BOUNDS_V1.journalBytes)fail('JOURNAL_LIMIT')
      if(key!==headKey(identitySha256)&&!/^event__[a-f0-9]{64}$/.test(key.slice(prefix.length))) {
        fail('JOURNAL_SCHEMA_INVALID')
      }
      const actual=deps.branch.get(key)
      if(actual===undefined||!same(value,strictData(actual,TAVERN_LORE_EDITS_BOUNDS_V1.recordBytes)))fail('HEAD_CHANGED')
      values.set(key,value);refs.push(rowRef(key,value))
    }
    if(inherited&&!seenInheritedSlot)fail('JOURNAL_INHERITANCE_INVALID')
    // get()/entries() must agree even for an absent head. Otherwise a partial
    // inventory could create a fresh genesis over evidence it failed to see.
    const actual=deps.branch.get(headKey(identitySha256))
    if((actual===undefined)!==!values.has(headKey(identitySha256))
      ||actual!==undefined&&!same(strictData(actual,TAVERN_LORE_EDITS_BOUNDS_V1.recordBytes),
        values.get(headKey(identitySha256))))fail('HEAD_CHANGED')
  }catch(error) {
    if(error instanceof LoreEditFailureV1)throw error
    fail('STORAGE_READ_FAILED')
  }
  // Charge complete journal shape/nodes once, not just individual records.
  strictData([...values],TAVERN_LORE_EDITS_BOUNDS_V1.journalBytes)
  refs.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
  const rawHead=values.get(headKey(identitySha256)),exists=rawHead!==undefined
  const head=exists?parseHead(rawHead,identity):genesis(identity)
  if(exists&&head.revision===0)fail('JOURNAL_CHAIN_INVALID')
  const events=new Map<string,TavernLoreEditEventV1>()
  for(const [key,value] of values)if(key!==headKey(identitySha256)) {
    const event=parseEvent(value,key,identity)
    validateFields(source,event.request)
    events.set(key,event)
  }
  const reversed:TavernLoreEditEventV1[]=[],seen=new Set<string>()
  let link=head.lastEvent
  while(link) {
    if(seen.has(link.key)||reversed.length>=TAVERN_LORE_EDITS_BOUNDS_V1.events)fail('JOURNAL_CHAIN_INVALID')
    seen.add(link.key)
    const event=events.get(link.key)
    if(!event)fail('JOURNAL_MISSING_EVENT')
    if(link.sha256!==recordSha256(event))fail('JOURNAL_HASH_INVALID')
    reversed.push(event);link=event.baseHead.lastEvent
  }
  const published=reversed.reverse()
  let expected=genesis(identity)
  for(const event of published) {
    if(!same(event.baseHead,expected)
      ||event.baseHeadRowSha256!==(expected.revision===0?'missing':recordSha256(expected)))fail('JOURNAL_CHAIN_INVALID')
    expected=nextHead(event)
  }
  if(!same(expected,head)||published.length!==head.revision)fail('JOURNAL_CHAIN_INVALID')
  const extras=[...events].filter(([key])=>!seen.has(key)).map(([,event])=>event)
  if(extras.length>1)fail('JOURNAL_ORPHAN_CONFLICT')
  const pending=extras[0]??null
  if(pending&&(!same(pending.baseHead,head)||pending.baseHeadRowSha256!==headRef(head,exists).sha256
    ||pending.revision!==head.revision+1))fail('JOURNAL_ORPHAN_CONFLICT')
  return {identity,identitySha256,head,headRef:headRef(head,exists),events,published,pending,
    refs:freeze(refs),refsSha256:journalReferencesShaV1(refs,inherited),...(inherited?{inherited}:{})}
}
/** Validate the exact planned namespace and consumer envelope before intent
 * append. These are prospective hashes, never returned as live publication. */
export function plannedPublication(source:TavernLoreSourceDataV1,journal:LoreEditJournalV1,event:TavernLoreEditEventV1)
  :LoreEditJournalV1 {
  const key=eventKey(event.identitySha256,event.request.operationId),events=new Map(journal.events)
  if(events.has(key)||events.size>=TAVERN_LORE_EDITS_BOUNDS_V1.events)fail('JOURNAL_LIMIT')
  events.set(key,event)
  const head=nextHead(event),values=[...events].map(([eventKey,event])=>[eventKey,event] as const)
  strictData([[headKey(head.identitySha256),head],...values],TAVERN_LORE_EDITS_BOUNDS_V1.journalBytes)
  const refs=[rowRef(headKey(head.identitySha256),head),...values.map(([key,value])=>rowRef(key,value))]
    .sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
  const result={...journal,head,headRef:headRef(head,true),events,published:[...journal.published,event],
    pending:null,refs,refsSha256:journalReferencesShaV1(refs,journal.inherited)}
  publishedData(source,result)
  return result
}
/** Published journal fields are author DATA. Reading them does not need the
 * semantic editor plan, which has its own compiler output contract. */
export function publishedJournalData(source:TavernLoreSourceDataV1,journal:LoreEditJournalV1):TavernLoreEditsDataV1 {
  if(journal.pending)fail('PENDING_INTENT')
  const edited=new Map<string,EditAccumulationV1>()
  for(const event of journal.published) {
    const {request}=event,previous=edited.get(request.rawEntryPointer)
    const ref=rowRef(eventKey(event.identitySha256,request.operationId),event)
    edited.set(request.rawEntryPointer,{rawEntrySha256:request.rawEntrySha256,
      fields:{...previous?.fields,...request.fields},events:[...(previous?.events??[]),ref]})
  }
  const journalRefs=journal.refs.filter(row=>row.key!==journal.headRef.key),journalSha256=recordSha256(journalRefs)
  const entries:TavernLoreCurrentNativeOverlayV1['entries'][number][]=[]
  for(const [rawEntryPointer,row] of [...edited].sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    const ref={schemaVersion:1,encoding:'tavern-lore-edit-origin-ref-v1',table:'branch',
      sessionId:source.sessionId,identitySha256:journal.identitySha256,revision:journal.head.revision,
      headRef:journal.headRef,journalSha256,eventRefs:row.events}
    entries.push({rawEntryPointer,rawEntrySha256:row.rawEntrySha256,fields:row.fields,
      origin:{kind:'append-only-lore-overlay',ref:ref as unknown as MvuJsonObject,refSha256:recordSha256(ref)}})
  }
  const inheritedEntries=journal.inherited?.baseline.effectiveOverlay.entries??[],
    effective=new Map(inheritedEntries.map(entry=>[entry.rawEntryPointer,entry]))
  for(const entry of entries) {
    const prior=effective.get(entry.rawEntryPointer)
    if(!prior){effective.set(entry.rawEntryPointer,entry);continue}
    if(prior.rawEntrySha256!==entry.rawEntrySha256)fail('JOURNAL_INHERITANCE_INVALID')
    const ref={schemaVersion:1,encoding:'native-tavern-inherited-then-local-edit-origin-v1',
      baselineRef:journal.inherited!.baselineRef,slotRef:journal.inherited!.slotRef,
      inherited:prior.origin,local:entry.origin}
    effective.set(entry.rawEntryPointer,{...entry,fields:{...prior.fields,...entry.fields},
      origin:{kind:'append-only-lore-overlay',ref:ref as unknown as MvuJsonObject,refSha256:recordSha256(ref)}})
  }
  const overlay:TavernLoreCurrentNativeOverlayV1={schemaVersion:1,
    encoding:'st-character-book-current-native-overlay-v1',entries:journal.inherited
      ?[...effective].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,entry])=>entry):entries}
  const body={schemaVersion:1 as const,encoding:'tavern-lore-edits-current-data-v1' as const,
    authority:'consumer-data-only' as const,sessionId:source.sessionId,source,identity:journal.identity,
    identitySha256:journal.identitySha256,revision:journal.head.revision,head:journal.head,
    headRef:journal.headRef,journalRefs,journalSha256,overlay,...journal.inherited?{inheritance:{
      baselineRef:journal.inherited.baselineRef,slotRef:journal.inherited.slotRef,
      baselineSha256:journal.inherited.baseline.baselineSha256,
      effectiveOverlaySha256:recordSha256(journal.inherited.baseline.effectiveOverlay)}}:{}}
  return freeze({...body,dataSha256:recordSha256(body)})
}
export function publishedData(source:TavernLoreSourceDataV1,journal:LoreEditJournalV1,
  editorBaseOverlay?:TavernLoreCurrentNativeOverlayV1)
  :{data:TavernLoreEditsDataV1;editor:TavernLoreEditEditorDataV1} {
  const data=publishedJournalData(source,journal)
  // Only the editor view includes actual pre-existing legacy differences.
  // The journal data/encodings remain append-only fields, so the prompt owner
  // applies its own same baseline exactly once and retains original receipts.
  const editorOverlay=editorBaseOverlay?composeRoleplayTavernCurrentOverlayV1(editorBaseOverlay,data.overlay):data.overlay,
    compiled=compileTavernLoreBookV1(compilerInput(source,editorOverlay))
  if(compiled.kind!=='compiled')fail('FIELDS_INVALID',compiled.diagnostics[0]?.code)
  const editor:TavernLoreEditEditorDataV1={authority:'consumer-data-only',sessionId:source.sessionId,
    sourceSha256:source.sourceSha256,dataSha256:data.dataSha256,revision:journal.head.revision,
    entries:compiled.plan.entries.map(entry=>({entryId:entry.entryId,rawEntryPointer:entry.sourcePointer,
      rawEntrySha256:entry.rawEntrySha256,disposition:entry.disposition,
      semantic:{...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,...entry.semanticOverrides} as TavernLoreSemanticEntryV1,
      contentText:resolveTavernLoreContentTextV1(compiled.plan,`${entry.sourcePointer}/content`).text,
      fieldSources:entry.fieldSources,diagnosticCodes:entry.diagnosticIndexes.map(index=>compiled.diagnostics[index]!.code)}))}
  // These are owner outputs. Raw requests, journal records and compiler inputs
  // keep their admission budgets; combining their results is not another input.
  return freeze({data,editor})
}
