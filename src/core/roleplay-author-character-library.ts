/** Process-local attachment DATA rebuilt from the canonical directory and its
 * actual published owners. Source, book bodies and execution state stay out. */
import {randomUUID} from 'node:crypto'
import {freezeAuthorWorldbookDataV1,sameAuthorWorldbookRefV1} from './roleplay-author-worldbook-journal.js'
import type {AuthorCharacterDirectoryEntryV1,AuthorSourceContextRegistrationV1}
  from './roleplay-author-source-context.js'
import type {TavernAuthorMetadataDataV1} from './roleplay-tavern-lore-edits-types.js'
import type {AuthorNativeTavernRegexV1} from './author-native-helper-types.js'
import type {AuthorWorldbookBindingCaptureV1,AuthorWorldbookCatalogCaptureV1,AuthorWorldbookWriteAddressV1}
  from './roleplay-author-worldbook-types.js'

export interface AuthorCharacterLibraryRegexV1 extends Pick<TavernAuthorMetadataDataV1,
  'identity'|'identitySha256'|'revision'|'head'|'headRef'> {
  readonly sourceSha256:string
  readonly rules:readonly AuthorNativeTavernRegexV1[]
}
export interface AuthorCharacterLibraryEntryV1 {
  readonly descriptor:AuthorCharacterDirectoryEntryV1
  readonly registration:AuthorSourceContextRegistrationV1
  readonly regex:AuthorCharacterLibraryRegexV1
  readonly binding:AuthorWorldbookBindingCaptureV1
}
export interface AuthorCharacterLibraryPacketV1 {
  readonly profileId:string
  /** Random process lifetime and semantic publication sequence, never durable. */
  readonly epoch:string
  readonly entries:readonly AuthorCharacterLibraryEntryV1[]
  readonly catalog:Pick<AuthorWorldbookCatalogCaptureV1,'head'|'revision'>&{
    readonly names:readonly {readonly bookId:string;readonly name:string}[]
  }
}
export interface AuthorCharacterLibraryEntryCaptureV1 {
  readonly registration:AuthorSourceContextRegistrationV1
  readonly regex:AuthorCharacterLibraryRegexV1
  /** Checked before asynchronous readiness publishes, never polled per realm. */
  current():boolean
}
export interface AuthorCharacterLibraryDependenciesV1 {
  readonly profileId:string
  profileCurrent():boolean
  readyDirectory():Promise<void>
  characters():readonly AuthorCharacterDirectoryEntryV1[]
  captureEntry(descriptor:AuthorCharacterDirectoryEntryV1):
    AuthorCharacterLibraryEntryCaptureV1|undefined|Promise<AuthorCharacterLibraryEntryCaptureV1|undefined>
  captureBindings(owner:AuthorSourceContextRegistrationV1['characterBinding']):AuthorWorldbookBindingCaptureV1
  captureCatalog():AuthorWorldbookCatalogCaptureV1
}

function sameDescriptor(left:AuthorCharacterDirectoryEntryV1,right:AuthorCharacterDirectoryEntryV1):boolean {
  const a=left.locator,b=right.locator
  return left.characterId===right.characterId&&left.name===right.name&&left.avatar===right.avatar
    &&left.ordinal===right.ordinal&&a.ownerSessionId===b.ownerSessionId
    &&a.sourceRecordSessionId===b.sourceRecordSessionId&&a.importId===b.importId
    &&a.transactionId===b.transactionId&&a.bookPointer===b.bookPointer
}
function sameRegex(left:AuthorCharacterLibraryRegexV1,right:AuthorCharacterLibraryRegexV1):boolean {
  return left===right||left.sourceSha256===right.sourceSha256&&left.identitySha256===right.identitySha256
    &&left.revision===right.revision&&left.headRef.exists===right.headRef.exists
    &&sameAuthorWorldbookRefV1(left.headRef,right.headRef)
}

export function createRoleplayAuthorCharacterLibraryV1(deps:AuthorCharacterLibraryDependenciesV1) {
  const lifetime=randomUUID(),entries=new Map<string,AuthorCharacterLibraryEntryV1>(),dirtySources=new Set<string>(),
    dirtyBindings=new Set<string>()
  let descriptors:readonly AuthorCharacterDirectoryEntryV1[]=[],descriptorOwners=new Map<string,AuthorCharacterDirectoryEntryV1>(),
    directoryDirty=true,catalogDirty=true,
    sequence=0,packet:AuthorCharacterLibraryPacketV1|undefined,
    catalog:AuthorCharacterLibraryPacketV1['catalog']|undefined,preparing:Promise<void>|undefined
  const bindingKey=(owner:AuthorSourceContextRegistrationV1['characterBinding'])=>
    owner.characterId+'\u0000'+(owner.sourceBranchId??'')
  const dirty=()=>directoryDirty||catalogDirty||dirtySources.size>0||dirtyBindings.size>0
  function dirtyDirectory() {directoryDirty=true}
  function dirtySource(ownerSessionId:string) {dirtySources.add(ownerSessionId)}
  function dirtyWorldbooks(address:AuthorWorldbookWriteAddressV1) {
    const profileId=address.kind==='book'?address.address.profileId:address.profileId
    if(profileId!==deps.profileId)return
    if(address.kind==='bindings') {
      if(address.owner.kind==='character')dirtyBindings.add(bindingKey(address.owner))
    }else catalogDirty=true
  }
  function current(value:AuthorCharacterLibraryPacketV1):boolean {
    return value===packet&&!dirty()&&deps.profileCurrent()
  }
  function capture():AuthorCharacterLibraryPacketV1 {
    if(!packet||!current(packet))throw Error('AUTHOR_CHARACTER_LIBRARY_NOT_READY')
    return packet
  }
  async function refresh() {
    while(dirty()) {
      if(!deps.profileCurrent())throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED')
      if(directoryDirty) {
        directoryDirty=false
        try {await deps.readyDirectory()}
        catch(error) {directoryDirty=true;throw error}
        const next=deps.characters(),byOwner=new Map(next.map(row=>[row.locator.ownerSessionId,row]))
        for(const [owner,entry] of entries)if(!byOwner.has(owner))entries.delete(owner)
        for(const descriptor of next) {
          const owner=descriptor.locator.ownerSessionId,previous=entries.get(owner)
          if(!previous||!sameDescriptor(previous.descriptor,descriptor))dirtySources.add(owner)
        }
        descriptors=next;descriptorOwners=byOwner
      }
      const sources=[...dirtySources]
      for(const owner of sources) {
        dirtySources.delete(owner)
        const descriptor=descriptorOwners.get(owner)
        if(!descriptor)continue
        const previous=entries.get(owner)
        // A failed recapture or reimport must never retain the previous identity.
        entries.delete(owner)
        try {
          const actual=await deps.captureEntry(descriptor)
          if(!actual)continue
          if(!actual.current())throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED')
          const binding=deps.captureBindings(actual.registration.characterBinding),
            entry=freezeAuthorWorldbookDataV1({descriptor,registration:actual.registration,regex:actual.regex,binding})
          entries.set(owner,previous&&sameDescriptor(previous.descriptor,descriptor)
            &&previous.registration.sha256===entry.registration.sha256&&sameRegex(previous.regex,entry.regex)
            &&sameAuthorWorldbookRefV1(previous.binding.head,binding.head)?previous:entry)
        }catch(error) {dirtySources.add(owner);throw error}
      }
      for(const key of [...dirtyBindings]) {
        dirtyBindings.delete(key)
        for(const [owner,entry] of entries)if(bindingKey(entry.registration.characterBinding)===key) {
          try {
            const binding=deps.captureBindings(entry.registration.characterBinding)
            if(!sameAuthorWorldbookRefV1(entry.binding.head,binding.head))
              entries.set(owner,freezeAuthorWorldbookDataV1({...entry,binding}))
          }catch(error) {dirtyBindings.add(key);throw error}
        }
      }
      if(catalogDirty) {
        catalogDirty=false
        try {
          const actual=deps.captureCatalog()
          if(!catalog||!sameAuthorWorldbookRefV1(catalog.head,actual.head))
            catalog=freezeAuthorWorldbookDataV1({head:actual.head,revision:actual.revision,
              names:actual.books.map(book=>({bookId:book.address.bookId,name:book.name}))})
        }catch(error) {catalogDirty=true;throw error}
      }
    }
    if(!deps.profileCurrent())throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED')
    const ordered=descriptors.flatMap(row=>{
      const entry=entries.get(row.locator.ownerSessionId)
      return entry?[entry]:[]
    })
    if(packet&&packet.catalog===catalog&&packet.entries.length===ordered.length
      &&packet.entries.every((entry,index)=>entry===ordered[index]))return
    packet=freezeAuthorWorldbookDataV1({profileId:deps.profileId,epoch:lifetime+':'+(++sequence),
      entries:ordered,catalog:catalog!})
  }
  async function prepare():Promise<void> {
    if(preparing)return preparing
    if(packet&&!dirty()) {
      if(!deps.profileCurrent())throw Error('AUTHOR_CHARACTER_LIBRARY_CHANGED')
      return
    }
    const work=refresh()
    preparing=work
    try {await work}
    finally {if(preparing===work)preparing=undefined}
  }
  function resolve(name:string,value=capture()):AuthorCharacterLibraryEntryV1|undefined {
    const key=name.toLowerCase()
    return value.entries.find(entry=>entry.descriptor.name.toLowerCase()===key
      ||entry.descriptor.avatar?.toLowerCase()===key)
  }
  return {ready:prepare,prepare,capture,current,resolve,dirtyDirectory,dirtySource,dirtyWorldbooks}
}

export type RoleplayAuthorCharacterLibraryV1=ReturnType<typeof createRoleplayAuthorCharacterLibraryV1>
