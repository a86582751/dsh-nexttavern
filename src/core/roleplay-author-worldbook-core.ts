/** The existing SDK entry point uses the catalog's sole content publisher.
 * Private read captures retain the exact book versions given to the guest. */
import {captureAuthorNamedWorldbookDataV3,authorWorldbookMutationReplyV1,authorNamedCharacterWorldbookNamesV1,
  authorWorldbookHelperCaptureV1}
  from './roleplay-author-worldbook-data.js'
import {sameAuthorWorldbookRefV1,freezeAuthorWorldbookDataV1} from './roleplay-author-worldbook-journal.js'
import {recordSha256} from './roleplay-data.js'
import type {AuthorNamedWorldbookData,AuthorWorldbookRetryLocatorV1,AuthorWorldbookPublicationObserverV1,
  AuthorWorldbookResultV1,AuthorNamedCharacterWorldbookBindingTokenV1,AuthorNamedCharacterWorldbookBindingReadV1,
  AuthorNamedCharacterWorldbookBindingLocatorV1,AuthorNamedCharacterWorldbookBindingRequestV1}
  from './roleplay-author-worldbook-data.js'
import type {createRoleplayTavernLoreSourceV1} from './roleplay-tavern-lore-source.js'
import type {createRoleplayAuthorWorldbookCatalogV1} from './roleplay-author-worldbook-catalog.js'
import type {createRoleplayAuthorWorldbookBindingsV1} from './roleplay-author-worldbook-bindings.js'
import type {RoleplayAuthorContextV1} from './roleplay-author-source-context.js'
import type {AuthorWorldbookCaptureV1,AuthorWorldbookWriterV1,AuthorWorldbookWriteAddressV1}
  from './roleplay-author-worldbook-types.js'
import type {AuthorWorldbookImportLocatorV1} from './roleplay-author-worldbook-types.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {RoleplayInputStateRead} from './roleplay-input-state.js'
import type {AuthorNativeWorldbookReplyV1,AuthorNativeWorldbookRequestV1,AuthorNativeWorldbookManagementRequestV1}
  from './roleplay-author-browser-types.js'

interface Dependencies {
  readonly source:Pick<ReturnType<typeof createRoleplayTavernLoreSourceV1>,'capture'>
  readonly catalog:ReturnType<typeof createRoleplayAuthorWorldbookCatalogV1>
  readonly bindings:ReturnType<typeof createRoleplayAuthorWorldbookBindingsV1>
  readonly context:RoleplayAuthorContextV1
  captureRead<T>(sid:string,compute:()=>T):RoleplayInputStateRead<T>
  withSourceLock<T>(sid:string,work:()=>T|PromiseLike<T>):Promise<T>
  /** Named targets may be closed sessions. This owner captures actual Domain
   * Source/profile currency without requiring a Native Session or Agent. */
  captureNamedSource?(locator:AuthorWorldbookImportLocatorV1):{
    readonly source:TavernLoreSourceDataV1
    current():boolean
  }|undefined
}
export function createRoleplayAuthorWorldbookCoreV1(deps:Dependencies) {
  const capturedBases=new WeakMap<AuthorNamedWorldbookData,{books:Map<string,AuthorWorldbookCaptureV1>}>()
  const namedBindings=new WeakMap<AuthorNamedCharacterWorldbookBindingTokenV1,{
    callerSid:string
    read:AuthorNamedCharacterWorldbookBindingReadV1
    callerCurrent:()=>boolean
    sourceCurrent:()=>boolean
  }>()
  function capture(sid:string):Promise<RoleplayInputStateRead<AuthorNamedWorldbookData>> {
    return deps.withSourceLock(sid,()=>deps.captureRead(sid,()=>{
      const source=deps.source.capture(sid)
      if(source.kind!=='captured-data')throw Error('AUTHOR_WORLDBOOK_SOURCE_UNAVAILABLE')
      const context=deps.context.capture(source.source),catalog=deps.catalog.captureCatalog(),
        basis=captureAuthorNamedWorldbookDataV3(sid,source.source.sourceSha256,context,catalog)
      capturedBases.set(basis,{books:new Map(basis.books.map(book=>[book.address.bookId,book]))})
      return basis
    }))
  }
  function retained(sid:string,basis:AuthorNamedWorldbookData) {
    const captured=capturedBases.get(basis)
    if(!captured||basis.sessionId!==sid)throw Error('AUTHOR_WORLDBOOK_STALE_BASE')
    return captured
  }
  function assertCaller(current:()=>boolean,signal:AbortSignal) {
    signal.throwIfAborted()
    if(!current())throw Error('BROWSER_ATTACHMENT_REVOKED')
  }
  function namedRegistration(target:AuthorNamedCharacterWorldbookBindingLocatorV1) {
    const stored=deps.context.readRegisteredOrigin(target.locator)
    if(!stored||stored.registration.profileId!==target.profileId||stored.registration.characterId!==target.characterId
      ||target.locator.ownerSessionId!==target.locator.sourceRecordSessionId
      ||!sameAuthorWorldbookRefV1(stored.ref,target.registration)
      ||stored.registration.characterBinding.characterId!==target.owner.characterId
      ||stored.registration.characterBinding.sourceBranchId!==target.owner.sourceBranchId)
      throw Error('AUTHOR_WORLDBOOK_CHARACTER_REGISTRATION_CHANGED')
    return stored.registration
  }
  function namedSource(target:AuthorNamedCharacterWorldbookBindingLocatorV1) {
    const read=deps.captureNamedSource?.(target.locator)
    if(!read)throw Error('AUTHOR_WORLDBOOK_NAMED_SOURCE_UNAVAILABLE')
    const source=read.source,locator=target.locator,pointer=source.original.activePointer
    if(source.sessionId!==locator.ownerSessionId||source.sourceRecordSessionId!==locator.sourceRecordSessionId
      ||pointer.importId!==locator.importId||pointer.transactionId!==locator.transactionId
      ||source.original.primary.bookPointer!==locator.bookPointer)
      throw Error('AUTHOR_WORLDBOOK_CHARACTER_SOURCE_CHANGED')
    return read
  }
  function namedTargetCurrent(target:AuthorNamedCharacterWorldbookBindingLocatorV1,source:{current():boolean}):boolean {
    return source.current()&&deps.context.hasCharacterRegistration(namedRegistration(target))
  }
  async function captureNamedBindings(callerSid:string,name:string,callerCurrent:()=>boolean,signal:AbortSignal)
    :Promise<AuthorNamedCharacterWorldbookBindingReadV1> {
    assertCaller(callerCurrent,signal)
    await deps.context.readyCharacters(callerCurrent)
    const descriptor=deps.context.resolveCharacter(name)
    if(!descriptor)throw Error('AUTHOR_WORLDBOOK_CHARACTER_NOT_FOUND')
    return captureNamedDescriptor(callerSid,descriptor,callerCurrent,signal)
  }
  async function captureNamedBindingsByOwner(callerSid:string,ownerSessionId:string,callerCurrent:()=>boolean,signal:AbortSignal)
    :Promise<AuthorNamedCharacterWorldbookBindingReadV1> {
    assertCaller(callerCurrent,signal)
    await deps.context.readyCharacters(callerCurrent)
    const descriptor=deps.context.characters().find(entry=>entry.locator.ownerSessionId===ownerSessionId)
    if(!descriptor)throw Error('AUTHOR_WORLDBOOK_CHARACTER_NOT_FOUND')
    return captureNamedDescriptor(callerSid,descriptor,callerCurrent,signal)
  }
  function captureNamedDescriptor(callerSid:string,
    descriptor:import('./roleplay-author-source-context.js').AuthorCharacterDirectoryEntryV1,
    callerCurrent:()=>boolean,signal:AbortSignal):Promise<AuthorNamedCharacterWorldbookBindingReadV1> {
    return deps.withSourceLock(descriptor.locator.ownerSessionId,()=>{
      assertCaller(callerCurrent,signal)
      const stored=deps.context.readRegisteredOrigin(descriptor.locator)
      if(!stored||stored.registration.characterId!==descriptor.characterId)
        throw Error('AUTHOR_WORLDBOOK_CHARACTER_REGISTRATION_CHANGED')
      const registration=stored.registration,target:AuthorNamedCharacterWorldbookBindingLocatorV1={
        kind:'named-character-bindings',profileId:registration.profileId,locator:registration.locator,
        registration:stored.ref,characterId:registration.characterId,owner:registration.characterBinding},
        source=namedSource(target),sourceCurrent=()=>namedTargetCurrent(target,source)
      if(!sourceCurrent())throw Error('AUTHOR_WORLDBOOK_CHARACTER_SOURCE_CHANGED')
      const binding=deps.bindings.captureBindings(registration.characterBinding),catalog=deps.catalog.captureCatalog(),
        token=Object.freeze({}) as AuthorNamedCharacterWorldbookBindingTokenV1,
        names=authorNamedCharacterWorldbookNamesV1(binding,catalog),
        read:AuthorNamedCharacterWorldbookBindingReadV1=freezeAuthorWorldbookDataV1({
          descriptor,registration,binding,catalog,names,target,token,current:()=>{
            try {
              return !signal.aborted&&callerCurrent()&&sourceCurrent()
                &&deps.bindings.captureBindings(registration.characterBinding)===binding
                &&deps.catalog.captureCatalog()===catalog
            }catch{return false}
          }})
      namedBindings.set(token,{callerSid,read,callerCurrent,sourceCurrent})
      return read
    })
  }
  async function manageNamedBindings(callerSid:string,request:AuthorNamedCharacterWorldbookBindingRequestV1,
    callerCurrent:()=>boolean,signal:AbortSignal,observePublication?:AuthorWorldbookPublicationObserverV1)
    :Promise<AuthorNativeWorldbookReplyV1> {
    assertCaller(callerCurrent,signal)
    const captured=namedBindings.get(request.token)
    if(!captured||captured.callerSid!==callerSid)throw Error('AUTHOR_WORLDBOOK_NAMED_BINDING_READ_REQUIRED')
    const {target,binding}=captured.read
    return deps.withSourceLock(target.locator.ownerSessionId,async()=>{
      assertCaller(callerCurrent,signal)
      let published:ReturnType<AuthorWorldbookPublicationObserverV1>=undefined,publicationStarted=false
      const writer:AuthorWorldbookWriterV1={
        owns:owner=>owner.kind==='bindings'&&owner.profileId===target.profileId&&owner.owner.kind==='character'
          &&owner.owner.characterId===target.owner.characterId&&owner.owner.sourceBranchId===target.owner.sourceBranchId,
        isCurrent:()=>!signal.aborted&&callerCurrent()&&captured.callerCurrent()&&captured.sourceCurrent(),
        beforeWrite:()=>{
          if(!publicationStarted){publicationStarted=true;published=observePublication?.()}
          return ()=>{}
        }}
      try {
        if(!captured.callerCurrent()||!captured.sourceCurrent())throw Error('AUTHOR_WORLDBOOK_CHARACTER_SOURCE_CHANGED')
        const result=await deps.bindings.bindBooks(binding,request.selection,request.operationId,writer)
        try{(published as ReturnType<AuthorWorldbookPublicationObserverV1>)?.(result.receipt)}catch{}
        return {result:{kind:'committed',receipt:result.receipt},bindings:result.bindings}
      }catch(error){return {result:refused(error,target)}}
    })
  }
  async function retryNamedBindings(callerSid:string,operationId:string,
    target:AuthorNamedCharacterWorldbookBindingLocatorV1,callerCurrent:()=>boolean,signal:AbortSignal,
    observePublication?:AuthorWorldbookPublicationObserverV1):Promise<AuthorWorldbookResultV1> {
    assertCaller(callerCurrent,signal)
    try {
      if(target.profileId!==deps.catalog.captureCatalog().profileId)throw Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH')
      namedRegistration(target)
      // Published history is DATA. A retired canonical Source cannot grant a
      // new write, but it does not erase its original owner's durable receipt.
      const receipt=deps.bindings.publishedReceipt(target.owner,operationId)
      if(receipt)return {kind:'committed',receipt}
    }catch(error){return refused(error,target)}
    return deps.withSourceLock(target.locator.ownerSessionId,async()=>{
      assertCaller(callerCurrent,signal)
      let published:ReturnType<AuthorWorldbookPublicationObserverV1>=undefined,publicationStarted=false
      try {
        const source=namedSource(target),current=()=>namedTargetCurrent(target,source),
          writer:AuthorWorldbookWriterV1={
            owns:owner=>owner.kind==='bindings'&&owner.profileId===target.profileId&&owner.owner.kind==='character'
              &&owner.owner.characterId===target.owner.characterId&&owner.owner.sourceBranchId===target.owner.sourceBranchId,
            isCurrent:()=>!signal.aborted&&callerCurrent()&&current(),beforeWrite:()=>{
              if(!publicationStarted){publicationStarted=true;published=observePublication?.()}
              return ()=>{}
            }}
        if(!current())throw Error('AUTHOR_WORLDBOOK_CHARACTER_SOURCE_CHANGED')
        const result=await deps.bindings.retryBindings(target.owner,operationId,writer)
        try{(published as ReturnType<AuthorWorldbookPublicationObserverV1>)?.(result.receipt)}catch{}
        return {kind:'committed',receipt:result.receipt}
      }catch(error){return refused(error,target)}
    })
  }
  async function read(sid:string,name:string,basis:AuthorNamedWorldbookData,
    originalOwnerCurrent:()=>boolean,signal:AbortSignal):Promise<AuthorWorldbookCaptureV1> {
    assertCaller(originalOwnerCurrent,signal)
    const captured=retained(sid,basis),descriptor=basis.catalog.books.find(book=>book.name===name)
    if(!descriptor)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
    const frozen=captured.books.get(descriptor.address.bookId)
    if(frozen)return frozen
    return deps.withSourceLock(sid,()=>{
      assertCaller(originalOwnerCurrent,signal)
      const previous=captured.books.get(descriptor.address.bookId)
      if(previous)return previous
      // An explicit unbound read starts its own current book capture. It does
      // not modify the books already frozen into the preparation/WI cut.
      const current=deps.catalog.captureBook(descriptor.address.bookId)
      if(!sameAuthorWorldbookRefV1(current.metadata,descriptor.metadata))throw Error('AUTHOR_WORLDBOOK_STALE_BASE')
      captured.books.set(current.address.bookId,current)
      return current
    })
  }
  async function mutate(sid:string,request:AuthorNativeWorldbookRequestV1,basis:AuthorNamedWorldbookData,
    originalOwnerCurrent:()=>boolean,signal:AbortSignal,observePublication?:AuthorWorldbookPublicationObserverV1)
    :Promise<AuthorNativeWorldbookReplyV1> {
    assertCaller(originalOwnerCurrent,signal)
    const captured=retained(sid,basis),book=captured.books.get(request.target.bookId),
      descriptor=basis.catalog.books.find(candidate=>candidate.name===request.name)
    if(request.expectedDataSha256!==basis.dataSha256||!book||descriptor?.address.bookId!==book.address.bookId
      ||!sameAuthorWorldbookRefV1(book.content,request.target.contentRef)
      ||!sameAuthorWorldbookRefV1(book.metadata,request.target.metadataRef))throw Error('AUTHOR_WORLDBOOK_STALE_BASE')
    return deps.withSourceLock(sid,async()=>{
      assertCaller(originalOwnerCurrent,signal)
      let published:ReturnType<AuthorWorldbookPublicationObserverV1>=undefined,publicationStarted=false
      const writer:AuthorWorldbookWriterV1={
        owns:owner=>owner.kind==='book'&&owner.address.profileId===basis.profileId
          &&owner.address.bookId===book.address.bookId,
        // Core supplies the actual Source/Native identity guard. Its Source
        // FIFO stays held across the content event/head and durable waits.
        isCurrent:()=>!signal.aborted&&originalOwnerCurrent(),
        beforeWrite:()=>{
          if(!publicationStarted){publicationStarted=true;published=observePublication?.()}
          return ()=>{}
        }}
      let result:Awaited<ReturnType<Dependencies['catalog']['mutateBook']>>
      try {result=await deps.catalog.mutateBook(book,request.mutation,request.operationId,writer)}
      catch(error) {return {result:refused(error,{kind:'book',address:book.address})}}
      // Receipt publication is independent of encoding the later current read.
      try {(published as ReturnType<AuthorWorldbookPublicationObserverV1>)?.(result.receipt)}catch {}
      return {result:{kind:'committed',receipt:result.receipt},...authorWorldbookMutationReplyV1(result)}
    })
  }
  async function retry(sid:string,operationId:string,current:()=>boolean,signal:AbortSignal,
    locator?:AuthorWorldbookRetryLocatorV1):Promise<AuthorWorldbookResultV1> {
    assertCaller(current,signal)
    if(!locator)return refused(Error('AUTHOR_WORLDBOOK_RETRY_LOCATOR_REQUIRED'))
    if(locator.kind==='named-character-bindings')return retryNamedBindings(sid,operationId,locator,current,signal)
    return deps.withSourceLock(sid,async()=>{
      assertCaller(current,signal)
      const profileId=deps.catalog.captureCatalog().profileId,
        requestedProfile=locator.kind==='book'?locator.address.profileId:locator.profileId
      if(requestedProfile!==profileId)return refused(Error('AUTHOR_WORLDBOOK_PROFILE_MISMATCH'))
      if(locator.kind==='bindings') {
        const source=deps.source.capture(sid)
        if(source.kind!=='captured-data')return refused(Error('AUTHOR_WORLDBOOK_SOURCE_UNAVAILABLE'))
        const actual=deps.context.capture(source.source).bindings,
          ownerSha256=recordSha256(locator.owner)
        if(!actual.some(binding=>recordSha256(binding.owner)===ownerSha256))
          return refused(Error('AUTHOR_WORLDBOOK_BINDING_UNAVAILABLE'))
      }
      const addressSha256=recordSha256(locator)
      const writer:AuthorWorldbookWriterV1={
        owns:owner=>recordSha256(owner)===addressSha256,
        isCurrent:()=>!signal.aborted&&current()}
      try {
        const result=locator.kind==='book'?await deps.catalog.retryBook(locator.address.bookId,operationId,writer)
          :locator.kind==='bindings'?await deps.bindings.retryBindings(locator.owner,operationId,writer)
            :await deps.catalog.retryCatalog(operationId,writer)
        return {kind:'committed',receipt:result.receipt}
      }catch(error) {return refused(error,locator)}
    })
  }
  async function manage(sid:string,request:AuthorNativeWorldbookManagementRequestV1,basis:AuthorNamedWorldbookData,
    originalOwnerCurrent:()=>boolean,signal:AbortSignal,observePublication?:AuthorWorldbookPublicationObserverV1)
    :Promise<AuthorNativeWorldbookReplyV1> {
    assertCaller(originalOwnerCurrent,signal)
    const captured=retained(sid,basis),mutation=request.mutation
    if(request.expectedDataSha256!==basis.dataSha256)throw Error('AUTHOR_WORLDBOOK_STALE_BASE')
    const ownerSha256=mutation.kind==='bind-books'?recordSha256(mutation.target.owner):undefined,
      binding=mutation.kind==='bind-books'?basis.bindings.find(candidate=>
        recordSha256(candidate.owner)===ownerSha256):undefined,
      book=mutation.kind==='delete-book'?captured.books.get(mutation.target.bookId):undefined
    if(mutation.kind==='delete-book'&&(!book||book.name!==mutation.name
      ||!sameAuthorWorldbookRefV1(book.content,mutation.target.contentRef)
      ||!sameAuthorWorldbookRefV1(book.metadata,mutation.target.metadataRef)))throw Error('AUTHOR_WORLDBOOK_STALE_BASE')
    if(mutation.kind==='bind-books') {
      if(!binding||!sameAuthorWorldbookRefV1(binding.head,mutation.target.head))throw Error('AUTHOR_WORLDBOOK_STALE_BASE')
    }
    const address:AuthorWorldbookWriteAddressV1=mutation.kind==='bind-books'
      ?{kind:'bindings',profileId:basis.profileId,owner:binding!.owner}:{kind:'catalog',profileId:basis.profileId},
      addressSha256=recordSha256(address)
    return deps.withSourceLock(sid,async()=>{
      assertCaller(originalOwnerCurrent,signal)
      let published:ReturnType<AuthorWorldbookPublicationObserverV1>=undefined,publicationStarted=false
      const writer:AuthorWorldbookWriterV1={owns:owner=>recordSha256(owner)===addressSha256,
        isCurrent:()=>!signal.aborted&&originalOwnerCurrent(),beforeWrite:()=>{
          if(!publicationStarted){publicationStarted=true;published=observePublication?.()}
          return ()=>{}
        }}
      if(mutation.kind==='create-book') {
        let result:Awaited<ReturnType<Dependencies['catalog']['createBook']>>
        try {result=await deps.catalog.createBook({name:mutation.name,entries:mutation.entries,
          expectedHead:basis.catalog.head},request.operationId,writer)}
        catch(error) {return {result:refused(error,address)}}
        try{(published as ReturnType<AuthorWorldbookPublicationObserverV1>)?.(result.receipt)}catch{}
        return {result:{kind:'committed',receipt:result.receipt},...authorWorldbookMutationReplyV1(result)}
      }
      try {
        if(mutation.kind==='delete-book') {
          const result=await deps.catalog.deleteBook(book!,request.operationId,writer)
          try{(published as ReturnType<AuthorWorldbookPublicationObserverV1>)?.(result.receipt)}catch{}
          return {result:{kind:'committed',receipt:result.receipt},deletedBookId:result.deletedBookId}
        }
        const result=await deps.bindings.bindBooks(binding!,mutation.selection,request.operationId,writer)
        try{(published as ReturnType<AuthorWorldbookPublicationObserverV1>)?.(result.receipt)}catch{}
        return {result:{kind:'committed',receipt:result.receipt},bindings:result.bindings}
      }catch(error) {return {result:refused(error,address)}}
    })
  }
  async function readHelper(...args:Parameters<typeof read>) {
    return authorWorldbookHelperCaptureV1(await read(...args))
  }
  return {capture,read,readHelper,mutate,manage,retry,captureNamedBindings,captureNamedBindingsByOwner,manageNamedBindings,retryNamedBindings}
}
function refused(error:unknown,recovery?:AuthorWorldbookRetryLocatorV1):Extract<AuthorWorldbookResultV1,{kind:'refused'}> {
  const code=error instanceof Error?error.message:'AUTHOR_WORLDBOOK_WRITE_UNKNOWN'
  return {kind:'refused',diagnostics:[{code,...recovery?{recovery}:{}}]}
}
