/** Manual primary-book editing uses the same catalog content journal as SDK
 * writes. Workspace and Source closures provide current authority separately. */
import {recordSha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {AuthorWorldbookWriteUnknownV1} from './roleplay-author-worldbook-journal.js'
import {compileAuthorWorldbookV1} from './tavern-lore-compiler.mjs'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import type {RoleplayAuthorContextV1} from './roleplay-author-source-context.js'
import type {RoleplayInputStateRead} from './roleplay-input-state.js'
import type {createRoleplayTavernLoreSourceV1} from './roleplay-tavern-lore-source.js'
import type {createRoleplayAuthorWorldbookCatalogV1} from './roleplay-author-worldbook-catalog.js'
import type {TavernLoreEditorDataV1,TavernLoreEditorRequestV1,TavernLoreEditorReceiptV1,
  TavernLoreEditorRefusalV1} from './roleplay-tavern-lore-editor-types.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreSemanticEntryV1} from './tavern-lore-plan-types.mjs'

interface Dependencies {
  readonly source:Pick<ReturnType<typeof createRoleplayTavernLoreSourceV1>,'capture'>
  readonly context:RoleplayAuthorContextV1
  readonly catalog:ReturnType<typeof createRoleplayAuthorWorldbookCatalogV1>
  captureRead<T>(sid:string,compute:()=>T):RoleplayInputStateRead<T>
  withSourceLock<T>(sid:string,work:()=>T|PromiseLike<T>):Promise<T>
}
type Selection={readonly kind:'page';readonly cursor:number;readonly limit:number}
  |{readonly kind:'entry';readonly entryId:string}
export function parseAuthorWorldbookEditorRequestV1(raw:unknown):TavernLoreEditorRequestV1 {
  const value=cloneRoleplayTavernLoreDataV1(raw,1_048_576) as TavernLoreEditorRequestV1
  const keys=['schemaVersion','encoding','sessionId','expectedSourceSha256','bookId','expectedContent',
    'expectedMetadata','operationId','mutation']
  if(!value||typeof value!=='object'||value.schemaVersion!==3||value.encoding!=='author-worldbook-editor-request-v3'
    ||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key))
    ||typeof value.sessionId!=='string'||typeof value.expectedSourceSha256!=='string'
    ||typeof value.bookId!=='string'||typeof value.operationId!=='string'||!value.operationId
    ||!value.expectedContent||!value.expectedMetadata||value.mutation?.kind!=='fields'
    ||!value.mutation.target||!value.mutation.fields)throw Error('REQUEST_INVALID')
  for(const ref of [value.expectedContent,value.expectedMetadata]) {
    if(typeof ref.key!=='string'||typeof ref.sha256!=='string'||Object.keys(ref).length!==2)
      throw Error('REQUEST_INVALID')
  }
  if(Object.keys(value.mutation).length!==3)throw Error('REQUEST_INVALID')
  return value
}
export function createRoleplayAuthorWorldbookEditorV1(deps:Dependencies) {
  function sourceOf(sid:string) {
    const captured=deps.source.capture(sid)
    if(captured.kind!=='captured-data')throw Error('SOURCE_UNAVAILABLE')
    return captured.source
  }
  function captureBasis(source:TavernLoreSourceDataV1) {
    const book=deps.context.capture(source).primary
    return {source,book,compiled:book?compileAuthorWorldbookV1(book):undefined}
  }
  function view({source,book,compiled}:ReturnType<typeof captureBasis>,selection?:Selection):TavernLoreEditorDataV1 {
    let selected=compiled?.plan.entries??[]
    if(selection?.kind==='page')selected=selected.slice(selection.cursor,selection.cursor+selection.limit)
    else if(selection?.kind==='entry') {
      const entry=selected.find(entry=>entry.entryId===selection.entryId)
      selected=entry?[entry]:[]
    }
    const body={authority:'consumer-data-only' as const,sessionId:source.sessionId,sourceSha256:source.sourceSha256,
        bookId:book?.address.bookId??null,contentRef:book?.content??null,metadataRef:book?.metadata??null,
        revision:book?.revision??0},entries=selected.map(entry=>{
        const semantic={...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,...entry.semanticOverrides} as TavernLoreSemanticEntryV1,
          {content:_content,...fields}=semantic,raw=book!.membership.members[entry.ordinal]!.rawEntry
        return {entryId:entry.entryId,rawEntryPointer:entry.sourcePointer,rawEntrySha256:entry.rawEntrySha256,
          disposition:entry.disposition,semantic:fields,contentText:typeof raw.content==='string'?raw.content:'',fieldSources:entry.fieldSources,
          diagnosticCodes:entry.diagnosticIndexes.map(index=>compiled!.diagnostics[index]!.code),
          ...entry.currentNativeMember?{currentNativeMember:entry.currentNativeMember}:{}}
      })
    return {...body,entries,dataSha256:recordSha256({...body,planSha256:compiled?.plan.planSha256??null})}
  }
  function refused(error:unknown):TavernLoreEditorRefusalV1 {
    const code=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'STORAGE_READ_FAILED'
    return {schemaVersion:1,kind:'refused',authority:'none',diagnostics:[{code,
      ...error instanceof AuthorWorldbookWriteUnknownV1?{recovery:{operationId:error.operationId}}:{}}]}
  }
  async function observe(sid:string,selection?:Selection) {
    try {
      return await deps.withSourceLock(sid,()=>{
        // Cache the captured owner basis, then project the requested page. A
        // later page must never receive an earlier page's cached projection.
        const read=deps.captureRead(sid,()=>captureBasis(sourceOf(sid)))
        read.assertCurrent()
        const total=read.data.compiled?.plan.entries.length??0
        return {kind:'captured-data' as const,editor:view(read.data,selection),page:{total,
          nextCursor:selection?.kind==='page'&&selection.cursor+selection.limit<total
            ?selection.cursor+selection.limit:null}}
      })
    }catch(error){return refused(error)}
  }
  async function edit(request:TavernLoreEditorRequestV1,current:()=>boolean) {
    let receipt:TavernLoreEditorReceiptV1|undefined
    let attemptedWrite=false
    try {
      return await deps.withSourceLock(request.sessionId,async()=>{
        if(!current())throw Error('SOURCE_CHANGED')
        const source=sourceOf(request.sessionId),selected=deps.context.capture(source).primary
        if(source.sourceSha256!==request.expectedSourceSha256||selected?.address.bookId!==request.bookId)
          throw Error('SOURCE_CHANGED')
        const basis=deps.catalog.resolveBookRefs(request.bookId,request.expectedContent,request.expectedMetadata),
          result=await deps.catalog.mutateMemberFields(basis,request.mutation.target,request.mutation.fields,
            request.operationId,{owns:owner=>owner.kind==='book'
              &&owner.address.profileId===basis.address.profileId&&owner.address.bookId===basis.address.bookId,
              isCurrent:current,
              beforeWrite:()=>{attemptedWrite=true;return ()=>{}}})
        receipt={requestSha256:recordSha256(request),publication:result.receipt}
        return {kind:'edited-data' as const,editor:view(captureBasis(source)),receipt}
      })
    }catch(error){return {...refused(error),outcome:attemptedWrite?'unknown' as const:'no-write' as const,
      ...receipt?{receipt}:{}}}
  }
  return {observe,edit}
}
