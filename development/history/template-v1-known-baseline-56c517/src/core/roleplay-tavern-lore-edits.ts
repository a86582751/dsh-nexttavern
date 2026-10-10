/** Actual branch writer. The supplied import lock serializes cooperating Core
 * writers; get/put/entries do not pretend to provide a database transaction. */
import {recordSha256} from './roleplay-data.js'
import {TAVERN_LORE_EDITS_BOUNDS_V1,LoreEditFailureV1,fail,freeze,same,sessionId,requestData,
  strictData,identityOf,eventKey,rowRef,headRef,eventFrom,nextHead,receiptOf,validateFields}
  from './roleplay-tavern-lore-edits-data.js'
import {readJournal,readJournalData,publishedData,publishedJournalData,plannedPublication,journalReferencesShaV1}
  from './roleplay-tavern-lore-edits-journal.js'
import type {LoreEditJournalV1} from './roleplay-tavern-lore-edits-journal.js'
import type {TavernLoreSourceDataV1,TavernLoreContributionInputV1} from './roleplay-tavern-lore-source-types.js'
import {produceRoleplayTavernCurrentLegacyOverlayV1} from './roleplay-tavern-current-overlay.js'
import type {TavernLoreCurrentNativeOverlayV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreEditsDepsV1,TavernLoreEditRequestV1,TavernLoreEditEventV1,
  TavernLoreEditRecoveryAnchorV1,TavernLoreEditsDataV1,TavernLoreEditRefusalV1,
  TavernLoreEditObservationV1,TavernLoreEditJournalObservationV1,TavernLoreEditResultV1,TavernLoreEditSourceDataCaptureV1}
  from './roleplay-tavern-lore-edits-types.js'
export type * from './roleplay-tavern-lore-edits-types.js'
export {TAVERN_LORE_EDITS_BOUNDS_V1} from './roleplay-tavern-lore-edits-data.js'

function refusal(error:unknown,recovery?:TavernLoreEditRecoveryAnchorV1):TavernLoreEditRefusalV1 {
  const diagnostic=error instanceof LoreEditFailureV1?error.diagnostic:{code:'STORAGE_READ_FAILED' as const}
  return freeze({schemaVersion:1,kind:'refused',authority:'none',
    diagnostics:[{...diagnostic,...(recovery?{recovery}:{})}]})
}
function pendingFailure(event:TavernLoreEditEventV1):never {
  throw new LoreEditFailureV1({code:'PENDING_INTENT',pending:{operationId:event.request.operationId,
    payloadSha256:event.payloadSha256,eventRef:rowRef(eventKey(event.identitySha256,event.request.operationId),event)}})
}
export function createRoleplayTavernLoreEditsV1(deps:TavernLoreEditsDepsV1) {
  function currentLegacyData(input:TavernLoreContributionInputV1,options:{suppressBookConstants?:boolean}={}) {
    try {return produceRoleplayTavernCurrentLegacyOverlayV1(input,options)}
    catch(error) {fail('FIELDS_INVALID',error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
      ?error.message:'current-legacy-overlay-unavailable')}
  }
  function captureSource(sid:string):{source:TavernLoreSourceDataV1;editorBaseOverlay:TavernLoreCurrentNativeOverlayV1} {
    sessionId(sid)
    try {
      const result=deps.source.capture(sid)
      if(result.kind!=='captured-data')fail('SOURCE_UNAVAILABLE',result.kind)
      const source=result.source
      if(source.sessionId!==sid)fail('SOURCE_IDENTITY_INVALID')
      identityOf(source)
      if(!deps.source.current(source))fail('SOURCE_CHANGED')
      return {source:freeze(source),editorBaseOverlay:currentLegacyData(result.contributionInput).overlay}
    }catch(error){if(error instanceof LoreEditFailureV1)throw error;fail('SOURCE_UNAVAILABLE')}
  }
  function observe(sid:string):TavernLoreEditObservationV1 {
    try {
      const {source,editorBaseOverlay}=captureSource(sid),journal=readJournal(deps,source)
      if(journal.pending)pendingFailure(journal.pending)
      const packet=publishedData(source,journal,editorBaseOverlay)
      // Compilation/clone is synchronous, but trusted readers can still report
      // changed records. Re-read the full namespace and Source before delivery.
      const actual=readJournal(deps,source)
      if(actual.refsSha256!==journal.refsSha256||!same(actual.headRef,journal.headRef))fail('HEAD_CHANGED')
      return freeze({schemaVersion:1,kind:'captured-data',...packet})
    }catch(error){return refusal(error)}
  }
  /** The actual input Owner already captured Source under the shared lock.
   * Parse its editor namespace once; no second Source capture or live callback
   * is created for this synchronous DATA supplier. */
  function observeSourceData(captured:TavernLoreEditSourceDataCaptureV1):TavernLoreEditObservationV1 {
    return observeSourceDataWithLegacyData(captured).observed
  }
  function sourceJournal(captured:TavernLoreEditSourceDataCaptureV1,options:{suppressBookConstants?:boolean}) {
    if(!captured||captured.schemaVersion!==1||captured.kind!=='captured-data')fail('SOURCE_UNAVAILABLE')
    const source=captured.source
    const legacy=currentLegacyData(captured.contributionInput,options),journal=readJournalData(deps,source)
    if(journal.pending)pendingFailure(journal.pending)
    return {source,legacy,journal}
  }
  /** Raw author JSON needs published fields and their provenance, without
   * building a semantic editor view or acquiring another Source reader. */
  function observeJournalDataWithLegacyData(captured:TavernLoreEditSourceDataCaptureV1,
    options:{suppressBookConstants?:boolean}={}):{
    observed:TavernLoreEditJournalObservationV1;
    legacy:ReturnType<typeof produceRoleplayTavernCurrentLegacyOverlayV1>|null
  } {
    try {
      const {source,legacy,journal}=sourceJournal(captured,options),data=publishedJournalData(source,journal)
      return {observed:freeze({schemaVersion:1,kind:'captured-data',data}),legacy}
    }catch(error){return {observed:refusal(error),legacy:null}}
  }
  /** Export uses the same already-resolved legacy bindings as this editor.
   * Returning resolved DATA avoids a second Source/journal/resolver capture. */
  function observeSourceDataWithLegacyData(captured:TavernLoreEditSourceDataCaptureV1,
    options:{suppressBookConstants?:boolean}={}):{
    observed:TavernLoreEditObservationV1;
    legacy:ReturnType<typeof produceRoleplayTavernCurrentLegacyOverlayV1>|null
  } {
    try {
      const {source,legacy,journal}=sourceJournal(captured,options),packet=publishedData(source,journal,legacy.overlay)
      return {observed:freeze({schemaVersion:1,kind:'captured-data',...packet}),legacy}
    }catch(error){return {observed:refusal(error),legacy:null}}
  }
  /** Currency of already parsed owner DATA; raw records enter through the
   * journal/Source parsers, not through this derived-output comparison. */
  function current(data:TavernLoreEditsDataV1):boolean {
    try {
      if(!data||data.schemaVersion!==1||data.encoding!=='tavern-lore-edits-current-data-v1'
        ||data.authority!=='consumer-data-only')return false
      const {dataSha256,...body}=data
      if(recordSha256(body)!==dataSha256)return false
      const live=deps.source.captureCurrent?.(data.sessionId),captured=live?.captured??deps.source.capture(data.sessionId)
      if(captured.kind!=='captured-data')return false
      const source=captured.source,journal=readJournal(deps,source,live?.assertCurrent)
      return same(data,publishedJournalData(source,journal))
    }catch{return false}
  }
  function observeCurrent(sid:string):{observed:TavernLoreEditObservationV1;assertCurrent():void} {
    try {
      sessionId(sid)
      const live=deps.source.captureCurrent?.(sid),captured=live?.captured??deps.source.capture(sid)
      if(captured.kind!=='captured-data')fail('SOURCE_UNAVAILABLE')
      const source=captured.source,sourceCurrent=()=>{
        if(live)live.assertCurrent()
        else if(!deps.source.current(source))fail('SOURCE_CHANGED')
      }
      sourceCurrent()
      const journal=readJournal(deps,source,sourceCurrent)
      if(journal.pending)pendingFailure(journal.pending)
      const packet=publishedData(source,journal,currentLegacyData(captured.contributionInput).overlay)
      const assertCurrent=()=>{
        sourceCurrent()
        // Full namespace replay still catches absent head, added orphan/pending
        // rows and inherited baseline changes. Overlay compilation is immutable
        // while every original journal input and Source input stays identical.
        const actual=readJournal(deps,source,sourceCurrent)
        if(actual.pending||actual.refsSha256!==journal.refsSha256||!same(actual.headRef,journal.headRef))fail('HEAD_CHANGED')
      }
      assertCurrent()
      return {observed:freeze({schemaVersion:1,kind:'captured-data',...packet}),assertCurrent}
    }catch(error){return {observed:refusal(error),assertCurrent:()=>{fail('SOURCE_CHANGED')}}}
  }
  function checkpoint(source:TavernLoreSourceDataV1,expected:LoreEditJournalV1):LoreEditJournalV1 {
    const actual=readJournal(deps,source)
    if(actual.refsSha256!==expected.refsSha256||!same(actual.headRef,expected.headRef))fail('HEAD_CHANGED')
    return actual
  }
  async function put(key:string,value:unknown,source:TavernLoreSourceDataV1,
    recovery:TavernLoreEditRecoveryAnchorV1):Promise<void> {
    try {await deps.branch.put(key,value)}
    catch {
      // A rejected/unknown put may already be durable. Never delete or rewrite
      // the intent. Attempt an actual readback but leave outcome unknown.
      let detail='readback-unavailable'
      try {
        const journal=readJournal(deps,source)
        detail=journal.pending?'prepared-intent-present':journal.events.has(recovery.eventRef.key)
          ?'published-event-present':'intent-absent'
      }catch(error){detail=error instanceof LoreEditFailureV1?error.diagnostic.code:'readback-unavailable'}
      throw new LoreEditFailureV1({code:'WRITE_UNKNOWN',detail,recovery})
    }
  }
  async function lockedEdit(request:TavernLoreEditRequestV1):Promise<TavernLoreEditResultV1> {
    let recovery:TavernLoreEditRecoveryAnchorV1|undefined
    try {
      const {source,editorBaseOverlay}=captureSource(request.sessionId),journal=readJournal(deps,source)
      const key=eventKey(journal.identitySha256,request.operationId),existing=journal.events.get(key)
      const actualOperation=deps.branch.get(key)
      if((actualOperation===undefined)!==!existing||actualOperation!==undefined
        &&!same(strictData(actualOperation,TAVERN_LORE_EDITS_BOUNDS_V1.recordBytes),existing))fail('HEAD_CHANGED')
      if(existing&&(existing.request.operationId!==request.operationId||!same(existing.request,request))) {
        fail('OPERATION_PAYLOAD_CONFLICT')
      }
      if(request.expectedSourceSha256!==source.sourceSha256)fail('SOURCE_CHANGED')
      if(journal.pending&&journal.pending!==existing)pendingFailure(journal.pending)
      if(existing&&journal.published.some(event=>event.request.operationId===request.operationId)) {
        const packet=publishedData(source,journal,editorBaseOverlay)
        checkpoint(source,journal)
        return freeze({schemaVersion:1,kind:'edited-data',receipt:receiptOf(existing),...packet})
      }
      if(request.expectedRevision!==journal.head.revision)fail('REVISION_MISMATCH')
      validateFields(source,request)
      let event:TavernLoreEditEventV1,prepared:LoreEditJournalV1,publication:LoreEditJournalV1
      if(existing) {
        // The only unreferenced event is this exact operation/payload. A cold
        // restart can finish the original head without appending another event.
        if(journal.pending!==existing)fail('JOURNAL_ORPHAN_CONFLICT')
        event=existing;prepared=journal
        const next=nextHead(event),refs=journal.refs.filter(ref=>ref.key!==journal.headRef.key)
        refs.push(rowRef(journal.headRef.key,next));refs.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
        publication={...journal,head:next,headRef:headRef(next,true),published:[...journal.published,event],
          pending:null,refs,refsSha256:journalReferencesShaV1(refs,journal.inherited)}
        publishedData(source,publication,editorBaseOverlay)
      }else {
        if(journal.pending)pendingFailure(journal.pending)
        if(journal.head.revision>=TAVERN_LORE_EDITS_BOUNDS_V1.events)fail('JOURNAL_LIMIT')
        event=eventFrom(request,journal.head,journal.headRef.exists)
        publication=plannedPublication(source,journal,event)
        const refs=[...journal.refs,rowRef(key,event)].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0)
        prepared={...journal,events:new Map([...journal.events,[key,event] as const]),pending:event,refs,
          refsSha256:journalReferencesShaV1(refs,journal.inherited)}
      }
      recovery={phase:'intent-write',identitySha256:journal.identitySha256,operationId:request.operationId,
        payloadSha256:event.payloadSha256,eventRef:rowRef(key,event),baseHeadRef:journal.headRef,
        nextHeadRef:publication.headRef}
      checkpoint(source,journal)
      if(!existing) {
        if(deps.branch.get(key)!==undefined)fail('HEAD_CHANGED')
        // First write is immutable intent; readers must refuse this intermediate
        // state. Await and compare exact head AND complete journal membership.
        await put(key,event,source,recovery)
        checkpoint(source,prepared)
      }
      recovery={...recovery,phase:'head-publication'}
      checkpoint(source,prepared)
      await put(publication.headRef.key,publication.head,source,recovery)
      recovery={...recovery,phase:'readback'}
      const actual=checkpoint(source,publication)
      const packet=publishedData(source,actual,editorBaseOverlay)
      checkpoint(source,actual)
      return freeze({schemaVersion:1,kind:'edited-data',receipt:receiptOf(event),...packet})
    }catch(error){return refusal(error,recovery)}
  }
  async function edit(raw:unknown):Promise<TavernLoreEditResultV1> {
    try {
      const request=freeze(requestData(raw))
      return await deps.withSourceLock(request.sessionId,()=>lockedEdit(request))
    }catch(error){return refusal(error)}
  }
  return {observe,captureCurrentData:observe,observeSourceData,observeSourceDataWithLegacyData,
    observeJournalDataWithLegacyData,current,edit,observeCurrent}
}
