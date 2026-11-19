/** Catalog and bound-book DATA captured by the actual Core read owner. */
import {recordSha256} from './roleplay-data.js'
import {freezeAuthorWorldbookDataV1} from './roleplay-author-worldbook-journal.js'
import type {RoleplayAuthorContextV1,AuthorCharacterDirectoryEntryV1,AuthorSourceContextRegistrationV1}
  from './roleplay-author-source-context.js'
import type {AuthorWorldbookCatalogCaptureV1,AuthorWorldbookCaptureV1,AuthorWorldbookBindingCaptureV1,
  AuthorWorldbookRefV1,AuthorWorldbookReceiptV1,AuthorWorldbookWriteAddressV1,AuthorWorldbookImportLocatorV1,
  AuthorWorldbookBindingOwnerV1,AuthorWorldbookBindingSelectionV1,AuthorWorldbookHelperCaptureV1,
  AuthorWorldbookReadResultV1}
  from './roleplay-author-worldbook-types.js'
import type {WorldbookEntryInputV1,WorldbookEntryWireV1} from './tavern-named-worldbook-data.js'
import {nativeNamedWorldbookEntryToWireV1} from './tavern-named-worldbook-data.js'
import type {NativeNamedWorldbookEntryDataV1} from './tavern-named-worldbook-data.js'
import type {TavernLoreMembershipDataV1,TavernLoreMemberV1} from './roleplay-tavern-lore-membership.js'

type HelperMember=Pick<TavernLoreMemberV1,'uid'|'rawEntry'>
const wireEntries=new WeakMap<HelperMember,WorldbookEntryWireV1>()
const helperCaptures=new WeakMap<AuthorWorldbookCaptureV1,AuthorWorldbookHelperCaptureV1>()
export function authorWorldbookHelperEntryV1(member:HelperMember,prepared?:WorldbookEntryWireV1):WorldbookEntryWireV1 {
  let entry=wireEntries.get(member)
  if(!entry){
    entry=prepared??nativeNamedWorldbookEntryToWireV1(member.rawEntry as NativeNamedWorldbookEntryDataV1,{uid:member.uid})
    wireEntries.set(member,entry)
  }
  return entry
}
export function authorWorldbookHelperEntriesV1(membership:TavernLoreMembershipDataV1,
  preparedEntries?:ReadonlyMap<number,WorldbookEntryWireV1>):readonly WorldbookEntryWireV1[] {
  return [...membership.members].sort((a,b)=>a.displayIndex-b.displayIndex)
    .map(member=>authorWorldbookHelperEntryV1(member,preparedEntries?.get(member.uid)))
}
export function authorWorldbookHelperCaptureV1(book:AuthorWorldbookCaptureV1,
  preparedEntries?:readonly WorldbookEntryWireV1[]):AuthorWorldbookHelperCaptureV1 {
  let helper=helperCaptures.get(book)
  if(!helper){
    if(preparedEntries) {
      // The publisher supplies prepared DTOs only for this exact captured membership.
      const members=[...book.membership.members].sort((a,b)=>a.displayIndex-b.displayIndex)
      members.forEach((member,index)=>wireEntries.set(member,preparedEntries[index]!))
    }
    helper=freezeAuthorWorldbookDataV1({...book,entries:preparedEntries??authorWorldbookHelperEntriesV1(book.membership)})
    helperCaptures.set(book,helper)
  }
  return helper
}

export interface AuthorNamedWorldbookDataV3 {
  readonly schemaVersion:3
  readonly encoding:'author-worldbook-catalog-data-v3'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly profileId:string
  readonly catalog:AuthorWorldbookCatalogCaptureV1
  /** Preparation contains only actual bound books. Other catalog books are
   * captured once on an explicit asynchronous SDK read in that read scope. */
  readonly books:readonly AuthorWorldbookCaptureV1[]
  readonly bindings:readonly AuthorWorldbookBindingCaptureV1[]
  readonly primaryBookId:string|null
  readonly primaryName:string|null
  readonly characterNames:{readonly primary:string|null;readonly additional:readonly string[]}
  readonly globalNames:readonly string[]
  readonly chatName:string|null
  readonly names:readonly string[]
  readonly dataSha256:string
}
export type AuthorNamedWorldbookData=AuthorNamedWorldbookDataV3
export interface AuthorWorldbookReadTargetV1 {
  readonly bookId:string
  readonly contentRef:AuthorWorldbookRefV1
  readonly metadataRef:AuthorWorldbookRefV1
}
declare const namedBindingToken:unique symbol
/** Private process reference. A JSON reconstruction cannot admit a mutation. */
export interface AuthorNamedCharacterWorldbookBindingTokenV1 {readonly [namedBindingToken]:true}
export interface AuthorNamedCharacterWorldbookBindingLocatorV1 {
  readonly kind:'named-character-bindings'
  readonly profileId:string
  readonly locator:AuthorWorldbookImportLocatorV1
  readonly registration:AuthorWorldbookRefV1
  readonly characterId:string
  readonly owner:Extract<AuthorWorldbookBindingOwnerV1,{kind:'character'}>
}
export interface AuthorNamedCharacterWorldbookBindingReadV1 {
  readonly descriptor:AuthorCharacterDirectoryEntryV1
  readonly registration:AuthorSourceContextRegistrationV1
  readonly binding:AuthorWorldbookBindingCaptureV1
  readonly catalog:AuthorWorldbookCatalogCaptureV1
  readonly names:{readonly primary:string|null;readonly additional:readonly string[]}
  readonly target:AuthorNamedCharacterWorldbookBindingLocatorV1
  readonly token:AuthorNamedCharacterWorldbookBindingTokenV1
  current():boolean
}
export interface AuthorNamedCharacterWorldbookBindingRequestV1 {
  readonly token:AuthorNamedCharacterWorldbookBindingTokenV1
  readonly operationId:string
  readonly selection:Extract<AuthorWorldbookBindingSelectionV1,{kind:'character'}>
}
export type AuthorWorldbookRetryLocatorV1=AuthorWorldbookWriteAddressV1|AuthorNamedCharacterWorldbookBindingLocatorV1
export type AuthorWorldbookResultV1=
  |{readonly kind:'committed';readonly receipt:AuthorWorldbookReceiptV1}
  |{readonly kind:'refused';readonly diagnostics:readonly {readonly code:string;
    readonly recovery?:AuthorWorldbookRetryLocatorV1}[]}
export type AuthorWorldbookPublicationObserverV1=()=>((receipt:AuthorWorldbookReceiptV1)=>void)|undefined
export type AuthorWorldbookMutationV1=
  |{kind:'create-entries';entries:readonly WorldbookEntryInputV1[]}
  |{kind:'delete-entries';uids:readonly number[]}
  |{kind:'replace-entries';entries:readonly (WorldbookEntryInputV1&{uid:number})[]}
  |{kind:'replace-worldbook';entries:readonly WorldbookEntryInputV1[]}
export type AuthorWorldbookManagementV1=
  |{readonly kind:'create-book';readonly name:string;readonly entries:readonly WorldbookEntryInputV1[]}
  |{readonly kind:'delete-book';readonly name:string;readonly target:AuthorWorldbookReadTargetV1}
  |{readonly kind:'bind-books';
    readonly target:Pick<AuthorWorldbookBindingCaptureV1,'owner'|'head'>;
    readonly selection:AuthorWorldbookBindingCaptureV1['selection']}
const catalogNames=new WeakMap<AuthorWorldbookCatalogCaptureV1,{
  readonly index:ReadonlyMap<string,string>;readonly names:readonly string[]}>()
function namesForCatalog(catalog:AuthorWorldbookCatalogCaptureV1) {
  let named=catalogNames.get(catalog)
  if(!named) {
    named={index:new Map(catalog.books.map(book=>[book.address.bookId,book.name])),
      names:catalog.books.map(book=>book.name)}
    catalogNames.set(catalog,named)
  }
  return named
}
export function authorNamedCharacterWorldbookNamesV1(binding:AuthorWorldbookBindingCaptureV1,
  catalog:AuthorWorldbookCatalogCaptureV1):AuthorNamedCharacterWorldbookBindingReadV1['names'] {
  const selection=binding.selection
  if(selection.kind!=='character')throw Error('AUTHOR_WORLDBOOK_BINDING_KIND_MISMATCH')
  const {index}=namesForCatalog(catalog)
  return freezeAuthorWorldbookDataV1({primary:selection.primary===null?null:index.get(selection.primary)??null,
    additional:selection.additional.flatMap(bookId=>{
      const name=index.get(bookId)
      return name===undefined?[]:[name]
    })})
}

export function captureAuthorNamedWorldbookDataV3(sessionId:string,sourceSha256:string,
  context:ReturnType<RoleplayAuthorContextV1['capture']>,catalog:AuthorWorldbookCatalogCaptureV1)
  :AuthorNamedWorldbookDataV3 {
  const named=namesForCatalog(catalog)
  const {index,names}=named,character=context.bindings.find(binding=>binding.owner.kind==='character')?.selection,
    global=context.bindings.find(binding=>binding.owner.kind==='profile')?.selection,
    chat=context.bindings.find(binding=>binding.owner.kind==='chat')?.selection
  if(character?.kind!=='character')throw Error('AUTHOR_SOURCE_CONTEXT_BINDING_INVALID')
  const primaryBookId=context.primary?.address.bookId??null,primaryName=primaryBookId===null?null:index.get(primaryBookId)??null,
    characterNames={primary:primaryName,additional:character.additional.flatMap(bookId=>{
      const name=index.get(bookId)
      return name===undefined?[]:[name]
    })},
    globalNames=global?.kind==='profile'?global.enabled.flatMap(bookId=>{
      const name=index.get(bookId)
      return name===undefined?[]:[name]
    }):[],chatName=chat?.kind==='chat'&&chat.bookId!==null?index.get(chat.bookId)??null:null,
    refs=context.books.map(book=>({bookId:book.address.bookId,content:book.content,metadata:book.metadata})),
    bindingRefs=context.bindings.map(binding=>({owner:binding.owner,head:binding.head}))
  const dataSha256=recordSha256({sessionId,sourceSha256,profileId:catalog.profileId,
    catalog:catalog.head,bindings:bindingRefs,books:refs,primaryBookId})
  return freezeAuthorWorldbookDataV1({schemaVersion:3,encoding:'author-worldbook-catalog-data-v3',
    authority:'consumer-data-only',sessionId,sourceSha256,profileId:catalog.profileId,catalog,
    books:context.books,bindings:context.bindings,primaryBookId,primaryName,characterNames,globalNames,chatName,names,dataSha256})
}

export function authorWorldbookReadTargetV1(book:AuthorWorldbookCaptureV1):AuthorWorldbookReadTargetV1 {
  return {bookId:book.address.bookId,contentRef:book.content,metadataRef:book.metadata}
}

/** The fixed Helper resolves collisions over the whole result, with quadratic
 * probing modulo one million. A default candidate here derives from the real
 * operation, so a lost reply never reallocates IDs when that operation retries.
 * Evidence: JS-Slash-Runner 519599bc... src/function/worldbook.ts 306–331. */
export function allocateAuthorWorldbookUidV1(desired:number|undefined,used:Set<number>,operationId:string,ordinal:number):number {
  let candidate=desired??Number.parseInt(recordSha256({operationId,ordinal}).slice(0,12),16)%1_000_000
  let probe=1
  while(used.has(candidate)) {candidate=(candidate+probe*probe)%1_000_000;probe++}
  used.add(candidate)
  return candidate
}

export function authorWorldbookMutationReplyV1(result:AuthorWorldbookReadResultV1&{
  readonly createdEntries:readonly WorldbookEntryWireV1[];readonly deletedEntries:readonly WorldbookEntryWireV1[]}) {
  if(result.readError)return {readError:result.readError}
  try {
    const entries=authorWorldbookHelperCaptureV1(result.book).entries
    return {worldbook:entries,new_entries:result.createdEntries,
      deleted_entries:result.deletedEntries,target:authorWorldbookReadTargetV1(result.book)}
  }catch(error) {
    return {readError:{code:error instanceof Error?error.message:'AUTHOR_WORLDBOOK_READ_UNKNOWN'}}
  }
}
