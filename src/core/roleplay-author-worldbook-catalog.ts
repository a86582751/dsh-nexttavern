/** Profile book identities, unique names and the sole current content history
 * after an import's immutable membership cut has been adopted. */
import {randomUUID} from 'node:crypto'
import {recordSha256} from './roleplay-data.js'
import {createAuthorWorldbookJournalV1,freezeAuthorWorldbookDataV1,sameAuthorWorldbookRefV1}
  from './roleplay-author-worldbook-journal.js'
import {planAuthorCatalogWorldbookMutationV1,createdAuthorCatalogWorldbookEntriesV1} from './roleplay-author-worldbook-planner.js'
import {allocateAuthorWorldbookUidV1,authorWorldbookHelperEntriesV1,authorWorldbookHelperCaptureV1}
  from './roleplay-author-worldbook-data.js'
import {parseAuthorWorldbookFileV1} from './roleplay-worldbook-file.js'
import {applyTavernLoreMembershipMutationV1,applyTavernLoreMemberFieldsV1,originalTavernLoreMembershipV1,
  tavernLoreMemberIdentitySha256V1}
  from './roleplay-tavern-lore-membership.js'
import {nativeNamedWorldbookEntryToWireV1} from './tavern-named-worldbook-data.js'
import type {NativeNamedWorldbookEntryDataV1,WorldbookEntryWireV1} from './tavern-named-worldbook-data.js'
import type {TavernLoreMembershipDataV1} from './roleplay-tavern-lore-membership.js'
import type {TavernLoreMemberIdentityV1} from './roleplay-tavern-lore-membership.js'
import {validateTavernLoreCurrentNativeFieldsV1} from './tavern-lore-compiler.mjs'
import type {TavernLoreCurrentNativeFieldsV1} from './tavern-lore-plan-types.mjs'
import type {AuthorWorldbookCatalogDependenciesV1,AuthorWorldbookDescriptorV1,AuthorWorldbookRefV1,
  AuthorWorldbookCaptureV1,AuthorWorldbookCatalogCaptureV1,AuthorWorldbookCreateInputV1,
  AuthorWorldbookMutationV1,AuthorWorldbookWriterV1,AuthorWorldbookMutationResultV1,
  AuthorWorldbookOriginV1,AuthorWorldbookAdoptionInputV1,AuthorWorldbookImportLocatorV1,
  AuthorWorldbookImportSeedV1,AuthorWorldbookImportFileInputV1,AuthorWorldbookReadResultV1,
  AuthorWorldbookReceiptV1} from './roleplay-author-worldbook-types.js'

type ContentPayload=ReturnType<typeof planAuthorCatalogWorldbookMutationV1>&{
    expectedMetadata?:AuthorWorldbookRefV1}
type ContentJournal=ReturnType<typeof createAuthorWorldbookJournalV1<ContentState,ContentPayload>>
type CatalogPayload=
  |{kind:'create';bookId:string;name:string;origin:AuthorWorldbookOriginV1;content:ContentPayload}
  |{kind:'import-file';bookId:string;name:string;origin:AuthorWorldbookOriginV1;content:ContentPayload;
    fileName:string;json:string;rawSha256:string;bookData:ContentState['bookData']}
  |{kind:'adopt-imported';bookId:string;name:string;origin:AuthorWorldbookOriginV1;seed:AuthorWorldbookImportSeedV1}
  |{kind:'reuse-imported';bookId:string}
  |{kind:'rename';bookId:string;name:string}
  |{kind:'delete';bookId:string;expectedContent:AuthorWorldbookRefV1}
interface CatalogState {
  readonly books:ReadonlyMap<string,AuthorWorldbookDescriptorV1>
  readonly names:ReadonlyMap<string,string>
  readonly deleted:ReadonlyMap<string,AuthorWorldbookDescriptorV1>
  readonly origins:ReadonlyMap<string,string>
}
interface ContentState {
  readonly membership:TavernLoreMembershipDataV1
  readonly bookData:AuthorWorldbookCaptureV1['bookData']
}
const empty=()=>originalTavernLoreMembershipV1([])
function contentState(membership:TavernLoreMembershipDataV1,bookData:ContentState['bookData']={},
  preparedEntries?:ReadonlyMap<number,WorldbookEntryWireV1>):ContentState {
  if(preparedEntries)authorWorldbookHelperEntriesV1(membership,preparedEntries)
  return {membership,bookData}
}
function applyContent(state:TavernLoreMembershipDataV1,payload:ContentPayload,ref:AuthorWorldbookRefV1) {
  if(payload.mutation.kind!=='update-entries')return applyTavernLoreMembershipMutationV1(state,payload.mutation,ref)
  const replacements=new Map(payload.mutation.entries.map(member=>[tavernLoreMemberIdentitySha256V1(member.identity),member]))
  return {...state,members:state.members.map(member=>replacements.get(tavernLoreMemberIdentitySha256V1(member.identity))??member)}
}
function checkedName(name:string) {
  if(typeof name!=='string'||!name.length)throw Error('AUTHOR_WORLDBOOK_NAME_REQUIRED')
  return name
}
function originKey(locator:AuthorWorldbookImportLocatorV1) {
  const {ownerSessionId,sourceRecordSessionId,importId,transactionId,bookPointer}=locator
  return recordSha256({ownerSessionId,sourceRecordSessionId,importId,transactionId,bookPointer})
}
function importedName(name:string,bookId:string,names:ReadonlyMap<string,string>) {
  if(!names.has(name))return name
  const suffix=bookId.replace(/-/g,'')
  for(let length=8;length<=suffix.length;length+=4) {
    const candidate=`${name} (${suffix.slice(0,length)})`
    if(!names.has(candidate))return candidate
  }
  let ordinal=1
  while(names.has(`${name} (${suffix}-${ordinal})`))ordinal++
  return `${name} (${suffix}-${ordinal})`
}
export function createRoleplayAuthorWorldbookCatalogV1(deps:AuthorWorldbookCatalogDependenciesV1) {
  if(!deps.completionWriter)throw Error('AUTHOR_WORLDBOOK_DOMAIN_OWNER_REQUIRED')
  const profileId=deps.profile.profileId,catalogOwner={kind:'catalog' as const,profileId}
  const catalog=createAuthorWorldbookJournalV1<CatalogState,CatalogPayload>(deps,catalogOwner,
    ()=>({books:new Map(),names:new Map(),deleted:new Map(),origins:new Map()}),(state,payload,ref)=>{
      if(payload.kind==='reuse-imported')return state
      const books=new Map(state.books),names=new Map(state.names),existing=books.get(payload.bookId)
      if(payload.kind==='delete') {
        if(!existing)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
        books.delete(payload.bookId)
        names.delete(existing.name)
        const deleted=new Map(state.deleted)
        deleted.set(payload.bookId,existing)
        return {books,names,deleted,origins:state.origins}
      }
      const conflict=names.get(payload.name)
      if(conflict&&conflict!==payload.bookId)throw Error('AUTHOR_WORLDBOOK_NAME_CONFLICT')
      let origins=state.origins
      if(payload.kind==='create'||payload.kind==='import-file'||payload.kind==='adopt-imported') {
        if(existing)throw Error('AUTHOR_WORLDBOOK_ID_CONFLICT')
        books.set(payload.bookId,{address:{profileId,bookId:payload.bookId},name:payload.name,origin:payload.origin,
          initialContent:ref,metadata:ref})
        if(payload.kind==='adopt-imported') {
          if(payload.origin.kind!=='adopted-import')throw Error('AUTHOR_WORLDBOOK_ORIGIN_INVALID')
          origins=new Map(origins).set(originKey(payload.origin.locator),payload.bookId)
        }
      }else {
        if(!existing)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
        names.delete(existing.name)
        books.set(payload.bookId,{...existing,name:payload.name,metadata:ref})
      }
      names.set(payload.name,payload.bookId)
      return {books,names,deleted:state.deleted,origins}
    },undefined,deps.completionWriter)
  const contents=new Map<string,ReturnType<typeof makeContent>>()
  const captured=new Map<string,AuthorWorldbookCaptureV1>()
  const descriptorReaders=new Map<string,()=>AuthorWorldbookDescriptorV1|undefined>()
  let catalogData:{head:AuthorWorldbookRefV1|null;data:AuthorWorldbookCatalogCaptureV1}|undefined
  function descriptor(bookId:string,includeDeleted=false) {
    const key=(includeDeleted?'retained:':'current:')+bookId
    let read=descriptorReaders.get(key)
    if(!read) {
      read=()=>{
        const state=catalog.capture().state
        return state.books.get(bookId)??(includeDeleted?state.deleted.get(bookId):undefined)
      }
      // Repeated Source DATA refreshes consume the same selected fact. They
      // must not add another lasting identity subscription for this book.
      descriptorReaders.set(key,read)
    }
    const selected=deps.readSelectedData?deps.readSelectedData(read):read()
    if(!selected)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
    return selected
  }
  function makeContent(book:AuthorWorldbookDescriptorV1,
    preparedEntries?:ReadonlyMap<number,WorldbookEntryWireV1>):ContentJournal {
    return createAuthorWorldbookJournalV1<ContentState,ContentPayload>(deps,{kind:'book',address:book.address},()=>{
      const event=catalog.eventAt(book.initialContent)
      const payload=event.payload
      if((payload.kind!=='create'&&payload.kind!=='import-file'&&payload.kind!=='adopt-imported')||payload.bookId!==book.address.bookId)
        throw Error('AUTHOR_WORLDBOOK_HISTORY_INVALID')
      if(payload.kind==='create')return contentState(applyContent(empty(),payload.content,book.initialContent))
      if(payload.kind==='import-file'){
        const state=contentState(applyContent(empty(),payload.content,book.initialContent),payload.bookData,preparedEntries)
        preparedEntries=undefined
        return state
      }
      if(payload.seed.kind==='membership')return contentState(payload.seed.membership,payload.seed.bookData)
      const parent=payload.seed.parent
      if(parent.address.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
      return content(parent).resolve(sameAuthorWorldbookRefV1(payload.seed.content,parent.initialContent)
        ?null:payload.seed.content).state
    },(state,payload,ref)=>contentState(applyContent(state.membership,payload,ref),state.bookData),async()=>{
      // Content -> catalog remains the only lock order. An accepted deletion
      // finishes before this content owner can publish another revision.
      await catalog.finishPending()
      if(!catalog.capture().state.books.has(book.address.bookId))throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
    })
  }
  function content(book:AuthorWorldbookDescriptorV1):ContentJournal {
    let result=contents.get(book.address.bookId)
    if(!result) {result=makeContent(book);contents.set(book.address.bookId,result)}
    return result
  }
  function captureCatalog():AuthorWorldbookCatalogCaptureV1 {
    const current=catalog.capture()
    if(catalogData&&sameAuthorWorldbookRefV1(catalogData.head,current.head))return catalogData.data
    const data=freezeAuthorWorldbookDataV1({schemaVersion:1 as const,authority:'consumer-data-only' as const,
      profileId,head:current.head,revision:current.revision,books:[...current.state.books.values()]})
    catalogData={head:current.head,data}
    return data
  }
  function captureBook(bookId:string):AuthorWorldbookCaptureV1 {
    const book=descriptor(bookId),state=content(book).capture(),contentRef=state.head??book.initialContent,
      previous=captured.get(bookId)
    if(previous&&sameAuthorWorldbookRefV1(previous.content,contentRef)
      &&sameAuthorWorldbookRefV1(previous.metadata,book.metadata))return previous
    const result=freezeAuthorWorldbookDataV1({schemaVersion:1 as const,authority:'consumer-data-only' as const,
      address:book.address,name:book.name,origin:book.origin,content:contentRef,metadata:book.metadata,
      revision:state.revision,...state.state})
    captured.set(bookId,result)
    return result
  }
  function readAfterCommit(read:()=>AuthorWorldbookCaptureV1):AuthorWorldbookReadResultV1 {
    try {return {book:read()}}
    catch(error) {return {readError:{code:error instanceof Error?error.message:'AUTHOR_WORLDBOOK_READ_UNKNOWN'}}}
  }
  function resolveName(name:string):string|undefined {return catalog.capture().state.names.get(name)}
  function resolveOrigin(locator:AuthorWorldbookImportLocatorV1):string|undefined {
    return catalog.capture().state.origins.get(originKey(locator))
  }
  async function adoptImportedBook(actualSeed:AuthorWorldbookAdoptionInputV1,operationId:string,
    writer:AuthorWorldbookWriterV1) {
    const {ownerSessionId,sourceRecordSessionId,importId,transactionId,bookPointer}=actualSeed.locator
    const locator={ownerSessionId,sourceRecordSessionId,importId,transactionId,bookPointer}
    // This is import-owner registration, planned against current state inside
    // the catalog lock. CRUD callers continue supplying their expected heads.
    const result=await catalog.commit({operationId,input:{kind:'adopt-imported',locator},plan:state=>{
      const existing=state.origins.get(originKey(locator))
      if(existing)return {kind:'reuse-imported',bookId:existing}
      const originalName=checkedName(actualSeed.name),bookId=randomUUID()
      const origin:AuthorWorldbookOriginV1={kind:'adopted-import',locator,originalName,
        ...actualSeed.effectiveCutRef?{effectiveCutRef:actualSeed.effectiveCutRef}:{},
        ...actualSeed.seed.kind==='fork'?{originBookId:actualSeed.seed.parent.address.bookId,
          parentContentRef:actualSeed.seed.content}:{}}
      return {kind:'adopt-imported',bookId,name:importedName(originalName,bookId,state.names),origin,seed:actualSeed.seed}
    }},writer)
    if(result.event.payload.kind!=='adopt-imported'&&result.event.payload.kind!=='reuse-imported')
      throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT')
    const registered=descriptor(result.event.payload.bookId,true)
    const deleted=!catalog.capture().state.books.has(registered.address.bookId)
    const book=deleted?resolveBook(registered,content(registered).capture().head??registered.initialContent)
      :captureBook(registered.address.bookId)
    return {receipt:result.receipt,registration:registered.initialContent,book,deleted}
  }
  async function createBook(input:AuthorWorldbookCreateInputV1,operationId:string,writer:AuthorWorldbookWriterV1)
    :Promise<AuthorWorldbookMutationResultV1> {
    const name=checkedName(input.name),origin=input.origin??{kind:'library' as const}
    let preparedEntries:readonly WorldbookEntryWireV1[]|undefined
    let createdEntries:readonly WorldbookEntryWireV1[]|undefined
    const result=await catalog.commit({expectedHead:input.expectedHead,operationId,input:{kind:'create',...input,origin},
      plan:state=>{
        if(state.names.has(name))throw Error('AUTHOR_WORLDBOOK_NAME_CONFLICT')
        return {kind:'create',bookId:randomUUID(),name,origin,
          content:planAuthorCatalogWorldbookMutationV1(empty(),operationId,{kind:'create-entries',entries:input.entries},
            (entries,created)=>{preparedEntries=entries;createdEntries=created})}
      }},writer)
    if(result.event.payload.kind!=='create')throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT')
    const payload=result.event.payload
    const read=readAfterCommit(()=>{
      const book=captureBook(payload.bookId)
      if(preparedEntries&&sameAuthorWorldbookRefV1(book.content,result.receipt.event))
        authorWorldbookHelperCaptureV1(book,preparedEntries)
      return book
    })
    return {receipt:result.receipt,...read,createdUids:payload.content.createdUids,
      createdEntries:createdEntries??createdAuthorCatalogWorldbookEntriesV1(payload.content),
      deletedEntries:payload.content.deletedEntries}
  }
  async function importBook(input:AuthorWorldbookImportFileInputV1,operationId:string,writer:AuthorWorldbookWriterV1) {
    let preparedEntries:Map<number,WorldbookEntryWireV1>|undefined
    const result=await catalog.commit({expectedHead:input.expectedHead,operationId,input:{kind:'import-file',...input},
      plan:state=>{
        const parsed=parseAuthorWorldbookFileV1(input),originalName=checkedName(parsed.name),
          bookId=randomUUID(),used=new Set<number>(),createdUids:number[]=[]
        preparedEntries=new Map()
        const entries=parsed.members.map((member,ordinal)=>{
          const uid=allocateAuthorWorldbookUidV1(member.desiredUid,used,operationId,ordinal)
          try{
            preparedEntries!.set(uid,nativeNamedWorldbookEntryToWireV1(member.rawEntry as NativeNamedWorldbookEntryDataV1,{uid}))
          }catch(cause){throw Error('AUTHOR_WORLDBOOK_FILE_ENTRY_INVALID',{cause})}
          createdUids.push(uid)
          return {uid,displayIndex:member.displayIndex,rawEntry:member.rawEntry}
        })
        return {kind:'import-file',bookId,name:importedName(originalName,bookId,state.names),
          origin:{kind:'uploaded-library',fileName:input.fileName,rawSha256:parsed.rawSha256},
          fileName:input.fileName,json:input.json,rawSha256:parsed.rawSha256,bookData:parsed.bookData,
          content:{mutation:{kind:'append',entries},createdUids,deletedEntries:[]}}
      }},writer)
    if(result.event.payload.kind!=='import-file')throw Error('AUTHOR_WORLDBOOK_OPERATION_CONFLICT')
    const {bookId}=result.event.payload,read=readAfterCommit(()=>{
      const registered=descriptor(bookId,true)
      // New import validation already produced these DTOs. Membership is built
      // only now, using the accepted event's real introduced identity.
      if(preparedEntries){contents.set(bookId,makeContent(registered,preparedEntries));preparedEntries=undefined}
      return catalog.capture().state.books.has(bookId)?captureBook(bookId):resolveBook(registered,registered.initialContent)
    })
    return {receipt:result.receipt,bookId,...read}
  }
  async function mutateBook(basis:AuthorWorldbookCaptureV1,mutation:AuthorWorldbookMutationV1,
    operationId:string,writer:AuthorWorldbookWriterV1):Promise<AuthorWorldbookMutationResultV1> {
    if(basis.address.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
    const book=descriptor(basis.address.bookId),journal=content(book)
    let preparedEntries:readonly WorldbookEntryWireV1[]|undefined
    let createdEntries:readonly WorldbookEntryWireV1[]|undefined
    const result=await journal.commit({expectedHead:sameAuthorWorldbookRefV1(basis.content,book.initialContent)?null:basis.content,
      operationId,input:{kind:'content',bookId:book.address.bookId,expectedContent:basis.content,expectedMetadata:basis.metadata,mutation},
      plan:state=>({...planAuthorCatalogWorldbookMutationV1(state.membership,operationId,mutation,
        (entries,created)=>{preparedEntries=entries;createdEntries=created}),
        expectedMetadata:basis.metadata})},contentWriter(basis,writer))
    const read=readAfterCommit(()=>{
      const captured=captureBook(book.address.bookId)
      if(preparedEntries&&captured.membership===result.index.state.membership)
        authorWorldbookHelperCaptureV1(captured,preparedEntries)
      return captured
    })
    return {receipt:result.receipt,...read,createdUids:result.event.payload.createdUids,
      createdEntries:createdEntries??createdAuthorCatalogWorldbookEntriesV1(result.event.payload),
      deletedEntries:result.event.payload.deletedEntries}
  }
  function contentWriter(basis:Pick<AuthorWorldbookCaptureV1,'address'|'metadata'>,
    writer:AuthorWorldbookWriterV1):AuthorWorldbookWriterV1 {
    return {owns:owner=>writer.owns(owner),isCurrent:()=>writer.isCurrent(),beforeWrite:row=>{
      const actual=catalog.capture().state.books.get(basis.address.bookId)
      if(!actual)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
      if(!sameAuthorWorldbookRefV1(actual.metadata,basis.metadata))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
      return writer.beforeWrite?.(row)??(()=>{})
    }}
  }
  async function renameBook(basis:AuthorWorldbookCaptureV1,name:string,operationId:string,writer:AuthorWorldbookWriterV1)
    :Promise<AuthorWorldbookReadResultV1&{readonly receipt:AuthorWorldbookReceiptV1}> {
    if(basis.address.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
    checkedName(name)
    const current=catalog.capture()
    const result=await catalog.commit({expectedHead:current.head,operationId,
      input:{kind:'rename',bookId:basis.address.bookId,expectedMetadata:basis.metadata,name},plan:state=>{
        const actual=state.books.get(basis.address.bookId)
        if(!actual)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
        if(!sameAuthorWorldbookRefV1(actual.metadata,basis.metadata))throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
        const conflict=state.names.get(name)
        if(conflict&&conflict!==basis.address.bookId)throw Error('AUTHOR_WORLDBOOK_NAME_CONFLICT')
        return {kind:'rename',bookId:basis.address.bookId,name}
      }},writer)
    return {receipt:result.receipt,...readAfterCommit(()=>captureBook(basis.address.bookId))}
  }
  async function mutateMemberFields(basis:AuthorWorldbookCaptureV1,target:TavernLoreMemberIdentityV1,
    fields:TavernLoreCurrentNativeFieldsV1,operationId:string,writer:AuthorWorldbookWriterV1) {
    if(basis.address.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
    validateTavernLoreCurrentNativeFieldsV1(fields)
    const book=descriptor(basis.address.bookId),journal=content(book),mutation={kind:'fields' as const,target,fields}
    const result=await journal.commit({expectedHead:sameAuthorWorldbookRefV1(basis.content,book.initialContent)?null:basis.content,
      operationId,input:{kind:'member-fields',bookId:book.address.bookId,expectedContent:basis.content,
        expectedMetadata:basis.metadata,mutation},plan:state=>{
        const changed=applyTavernLoreMemberFieldsV1(state.membership,target,fields)
        return {mutation:{kind:'update-entries' as const,
          entries:changed.members.filter((member,index)=>member!==state.membership.members[index])},
          createdUids:[],deletedEntries:[],expectedMetadata:basis.metadata}
      }},contentWriter(basis,writer))
    return {receipt:result.receipt}
  }
  async function retryCatalog(operationId:string,writer:AuthorWorldbookWriterV1) {
    const event=catalog.operation(operationId)
    if(event.payload.kind==='delete') {
      const payload=event.payload,bookJournal=content(descriptor(payload.bookId,true))
      return bookJournal.withLock(async()=>{
        const current=catalog.capture().state.books.get(payload.bookId)
        if(current&&!sameAuthorWorldbookRefV1(bookJournal.capture().head??current.initialContent,payload.expectedContent))
          throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
        const result=await catalog.retry(operationId,writer)
        return {receipt:result.receipt,deletedBookId:payload.bookId}
      })
    }
    const result=await catalog.retry(operationId,writer)
    if(result.event.payload.kind==='delete')return {receipt:result.receipt,deletedBookId:result.event.payload.bookId}
    return {receipt:result.receipt,...readAfterCommit(()=>{
      const book=descriptor(result.event.payload.bookId,true)
      return catalog.capture().state.books.has(book.address.bookId)
        ?captureBook(book.address.bookId):resolveBook(book,content(book).capture().head??book.initialContent)
    })}
  }
  async function deleteBook(basis:AuthorWorldbookCaptureV1,operationId:string,writer:AuthorWorldbookWriterV1) {
    if(basis.address.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
    // Content -> catalog is the only multi-owner lock order. A deletion cannot
    // race an in-flight content write past the caller's captured content head.
    const bookJournal=content(descriptor(basis.address.bookId,true))
    return bookJournal.withLock(async()=>{
      const state=catalog.capture()
      const actual=state.state.books.get(basis.address.bookId)
      if(actual&&(!sameAuthorWorldbookRefV1(actual.metadata,basis.metadata)
        ||!sameAuthorWorldbookRefV1(bookJournal.capture().head??actual.initialContent,basis.content)))
        throw Error('AUTHOR_WORLDBOOK_HEAD_CHANGED')
      const result=await catalog.commit({expectedHead:state.head,operationId,
        input:{kind:'delete',bookId:basis.address.bookId,expectedContent:basis.content,expectedMetadata:basis.metadata},
        plan:current=>{
          if(!current.books.has(basis.address.bookId))throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
          return {kind:'delete',bookId:basis.address.bookId,expectedContent:basis.content}
        }},writer)
      return {receipt:result.receipt,deletedBookId:basis.address.bookId}
    })
  }
  async function retryBook(bookId:string,operationId:string,writer:AuthorWorldbookWriterV1) {
    const book=descriptor(bookId,true),journal=content(book),event=journal.operation(operationId),
      result=await journal.retry(operationId,contentWriter({address:book.address,
        metadata:event.payload.expectedMetadata!},writer))
    return {receipt:result.receipt,...readAfterCommit(()=>catalog.capture().state.books.has(bookId)?captureBook(bookId)
      :resolveBook(book,journal.capture().head??book.initialContent)),createdUids:result.event.payload.createdUids,
      deletedEntries:result.event.payload.deletedEntries}
  }
  /** Frozen material resolves its exact content ref after later edits. Names
   * and metadata are taken from the supplied accepted descriptor. */
  function resolveBook(book:AuthorWorldbookDescriptorV1,ref:AuthorWorldbookRefV1):AuthorWorldbookCaptureV1
  function resolveBook(book:AuthorWorldbookCaptureV1):AuthorWorldbookCaptureV1
  function resolveBook(book:AuthorWorldbookDescriptorV1|AuthorWorldbookCaptureV1,
    requestedRef?:AuthorWorldbookRefV1):AuthorWorldbookCaptureV1 {
    if(book.address.profileId!==profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
    const registered='initialContent' in book?book:descriptor(book.address.bookId,true)
    const ref=requestedRef??('content' in book?book.content:registered.initialContent)
    const state=content(registered).resolve(sameAuthorWorldbookRefV1(ref,registered.initialContent)?null:ref)
    return freezeAuthorWorldbookDataV1({schemaVersion:1,authority:'consumer-data-only',address:book.address,
      name:book.name,origin:book.origin,content:ref,metadata:book.metadata,revision:state.revision,...state.state})
  }
  function resolveBookRefs(bookId:string,contentRef:AuthorWorldbookRefV1,metadataRef:AuthorWorldbookRefV1) {
    const registered=descriptor(bookId,true),event=catalog.eventAt(metadataRef),payload=event.payload
    if((payload.kind!=='create'&&payload.kind!=='import-file'&&payload.kind!=='adopt-imported'&&payload.kind!=='rename')||payload.bookId!==bookId)
      throw Error('AUTHOR_WORLDBOOK_METADATA_REF_INVALID')
    return resolveBook({...registered,name:payload.name,metadata:metadataRef},contentRef)
  }
  return {captureCatalog,captureBook,resolveName,resolveOrigin,adoptImportedBook,createBook,importBook,mutateBook,mutateMemberFields,renameBook,
    deleteBook,retryCatalog,retryBook,resolveBook,resolveBookRefs,finishPending:catalog.finishPending}
}
