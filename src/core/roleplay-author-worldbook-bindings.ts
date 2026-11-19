/** Binding order belongs to its actual profile/character/chat owner. Shared
 * library content is referenced by stable ID and is never copied on bind. */
import {recordSha256} from './roleplay-data.js'
import {createAuthorWorldbookJournalV1,freezeAuthorWorldbookDataV1,sameAuthorWorldbookRefV1}
  from './roleplay-author-worldbook-journal.js'
import type {AuthorWorldbookDependenciesV1,AuthorWorldbookBindingOwnerV1,AuthorWorldbookBindingSelectionV1,
  AuthorWorldbookBindingCaptureV1,AuthorWorldbookWriterV1,AuthorWorldbookCaptureV1} from './roleplay-author-worldbook-types.js'

interface Dependencies extends AuthorWorldbookDependenciesV1 {
  /** The real catalog owner resolves membership. A string supplied by an SDK
   * caller never registers a new book or invents a content owner. */
  captureBook(bookId:string):AuthorWorldbookCaptureV1
}
export function authorWorldbookBindingBookIdsV1(selection:AuthorWorldbookBindingSelectionV1):readonly string[] {
  if(selection.kind==='profile')return selection.enabled
  if(selection.kind==='chat')return selection.bookId===null?[]:[selection.bookId]
  const primary=selection.primary===null?[]:[selection.primary]
  return [...primary,...selection.additional]
}
function empty(owner:AuthorWorldbookBindingOwnerV1):AuthorWorldbookBindingSelectionV1 {
  if(owner.kind==='profile')return {kind:'profile',enabled:[]}
  if(owner.kind==='character')return {kind:'character',primary:null,additional:[]}
  return {kind:'chat',bookId:null}
}
export function createRoleplayAuthorWorldbookBindingsV1(deps:Dependencies) {
  const profileId=deps.profile.profileId
  function makeJournal(owner:AuthorWorldbookBindingOwnerV1) {
    return createAuthorWorldbookJournalV1<AuthorWorldbookBindingSelectionV1,AuthorWorldbookBindingSelectionV1>(
      deps,{kind:'bindings',profileId,owner},()=>empty(owner),(_state,payload)=>payload)
  }
  const journals=new Map<string,ReturnType<typeof makeJournal>>()
  const captures=new Map<string,AuthorWorldbookBindingCaptureV1>()
  function selected(owner:AuthorWorldbookBindingOwnerV1) {
    if(owner.kind==='profile'&&owner.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
    if(owner.kind==='character'&&!owner.characterId)throw Error('AUTHOR_WORLDBOOK_CHARACTER_REQUIRED')
    if(owner.kind==='chat'&&owner.namespace.target)throw Error('AUTHOR_WORLDBOOK_CHAT_OWNER_REQUIRED')
    const key=recordSha256(owner)
    let journal=journals.get(key)
    if(!journal) {journal=makeJournal(owner);journals.set(key,journal)}
    return {key,journal}
  }
  function captureBindings(owner:AuthorWorldbookBindingOwnerV1):AuthorWorldbookBindingCaptureV1 {
    const {key,journal}=selected(owner),state=journal.capture(),previous=captures.get(key)
    if(previous&&sameAuthorWorldbookRefV1(previous.head,state.head))return previous
    const result=freezeAuthorWorldbookDataV1({schemaVersion:1 as const,authority:'consumer-data-only' as const,
      profileId,owner,head:state.head,revision:state.revision,selection:state.state})
    captures.set(key,result)
    return result
  }
  async function bindBooks(basis:AuthorWorldbookBindingCaptureV1,next:AuthorWorldbookBindingSelectionV1,
    operationId:string,writer:AuthorWorldbookWriterV1) {
    if(basis.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
    if(next.kind!==basis.owner.kind)throw Error('AUTHOR_WORLDBOOK_BINDING_KIND_MISMATCH')
    const {journal}=selected(basis.owner)
    const result=await journal.commit({expectedHead:basis.head,operationId,
      input:{expectedHead:basis.head,selection:next},plan:()=>{
        const ids=authorWorldbookBindingBookIdsV1(next)
        for(const bookId of ids)deps.captureBook(bookId)
        return next
      }},writer)
    return {receipt:result.receipt,bindings:captureBindings(basis.owner)}
  }
  async function retryBindings(owner:AuthorWorldbookBindingOwnerV1,operationId:string,writer:AuthorWorldbookWriterV1) {
    const result=await selected(owner).journal.retry(operationId,writer)
    return {receipt:result.receipt,bindings:captureBindings(owner)}
  }
  function resolveBindings(owner:AuthorWorldbookBindingOwnerV1,head:AuthorWorldbookBindingCaptureV1['head']) {
    const state=selected(owner).journal.resolve(head)
    return freezeAuthorWorldbookDataV1({schemaVersion:1 as const,authority:'consumer-data-only' as const,
      profileId,owner,head,revision:state.revision,selection:state.state})
  }
  function publishedReceipt(owner:AuthorWorldbookBindingOwnerV1,operationId:string,
    input?:{expectedHead:AuthorWorldbookBindingCaptureV1['head'];selection:AuthorWorldbookBindingSelectionV1}) {
    return selected(owner).journal.publishedReceipt(operationId,input)
  }
  return {captureBindings,bindBooks,retryBindings,resolveBindings,publishedReceipt}
}

/** Preparation supplies bindings in the fixed upstream precedence order.
 * Provenance keeps every role, while content participates once per stable ID. */
export function resolveAuthorWorldbookBindingsV1(bindings:readonly AuthorWorldbookBindingCaptureV1[]) {
  const bookIds:string[]=[],seen=new Set<string>()
  const provenance:{bookId:string;binding:AuthorWorldbookBindingCaptureV1;ordinal:number}[]=[]
  for(const binding of bindings) {
    for(const [ordinal,bookId] of authorWorldbookBindingBookIdsV1(binding.selection).entries()) {
      provenance.push({bookId,binding,ordinal})
      if(!seen.has(bookId)) {seen.add(bookId);bookIds.push(bookId)}
    }
  }
  return freezeAuthorWorldbookDataV1({bookIds,provenance})
}
