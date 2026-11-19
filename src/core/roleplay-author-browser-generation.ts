import type {AuthorNativeLifecycleSubscription} from './author-native-lifecycle.js'
/** One live attachment owns its waiting Reader and pending preparation call.
 * A long-poll transports the challenge; it never grants Native permission. */
import {randomUUID} from 'node:crypto'
import {recordSha256} from './roleplay-data.js'
import type {RoleplayInputSourceDataWindowV1} from './roleplay-input-preparation.js'
import type {AuthorNativeBindingV1 as BrowserBindingV1} from './author-native-helper-types.js'
import type {AuthorNativeProgramV1} from './author-native-program.mjs'
import type {AuthorNativeHelperSnapshotV1,AuthorNativeFilterInvocationV1} from './author-native-helper-types.js'
import type {AuthorNativeRealmLibraryReadV1,AuthorNativeResolvedLibraryReadV1} from './author-native-helper-types.js'
import type {PromptCaptureV1,AuthorPromptInjectionV1} from './tavern-author-prompt-types.mjs'
import type {BrowserCallbackRegistration,BrowserGenerationInvocation,BrowserGenerationOutput,
  BrowserGenerationResult,BrowserAuthorInvocation,BrowserMvuHookInvocation,BrowserMvuHookCompletion,
  BrowserFilterInvocation,BrowserFilterCompletion,BrowserFilterRetired}
  from './roleplay-author-browser-generation-types.js'
import type {AuthorNativeMvuHookRequest,AuthorNativeMvuHookResult,AuthorNativeMvuPreparedHook,AuthorNativeMvuHookStage}
  from './author-native-mvu-hook-types.js'
import {AUTHOR_NATIVE_MVU_HOOK_EVENTS} from './author-native-mvu-hook-types.js'
import type {Mvu196HookStage} from './tavern-mvu-update-protocol-v1.js'

const sameBinding=(left:BrowserBindingV1,right:BrowserBindingV1)=>
  left.browserSessionId===right.browserSessionId&&left.generation===right.generation
  &&left.sessionId===right.sessionId&&left.programSha256===right.programSha256
function fail(code:string):never {throw Error(code)}
interface Waiter {
  registrations:readonly BrowserCallbackRegistration[]
  resolve(invocation:BrowserAuthorInvocation):void
  reject(error:Error):void
  cleanup():void
}
interface Pending {
  readonly invocation:BrowserGenerationInvocation
  readonly sourceData?:RoleplayInputSourceDataWindowV1
  resolve(output:BrowserGenerationOutput):void
  reject(error:Error):void
  cleanup():void
}
interface FilterResult {
  readonly accepted:boolean
  readonly libraryReads:readonly AuthorNativeResolvedLibraryReadV1[]
}

export function createRoleplayAuthorBrowserGeneration(options:{
  readonly binding:BrowserBindingV1
  readonly program:AuthorNativeProgramV1
  resolveLibraryReads?(reads:readonly AuthorNativeRealmLibraryReadV1[]):readonly AuthorNativeResolvedLibraryReadV1[]
  current():boolean
  sourceCurrent?():boolean
  lifecycle?:AuthorNativeLifecycleSubscription
}) {
  let closed=false,waiter:Waiter|undefined,pending:Pending|undefined
  let latestRegistrations:readonly BrowserCallbackRegistration[]=[],latestRegistrationRevision:number|undefined
  let filterCall:{invocation:BrowserFilterInvocation;sourceData?:RoleplayInputSourceDataWindowV1;
    resolve(value:FilterResult):void;reject(error:Error):void;cleanup():void}|undefined
  const retired:BrowserFilterRetired[]=[]
  const readerArrivals=new Set<{resolve():void;reject(error:Error):void}>()
  let hook:{readonly invocation:BrowserMvuHookInvocation;readonly reader:Waiter;
    started:boolean;resolve?(result:AuthorNativeMvuHookResult):void;reject?(error:Error):void;cleanup():void}|undefined
  let producedPrompts=false
  const current=()=>!closed&&options.current()
  const sourceCurrent=()=>!closed&&(options.sourceCurrent?.()??options.current())
  const assertCurrent=()=>{if(!current())fail('BROWSER_ATTACHMENT_REVOKED')}
  const assertSourceCurrent=()=>{if(!sourceCurrent())fail('BROWSER_ATTACHMENT_REVOKED')}
  const assertBinding=(binding:BrowserBindingV1,assertOwner=assertCurrent)=>{
    if(!sameBinding(binding,options.binding))fail('BROWSER_ATTACHMENT_REVOKED')
    assertOwner()
  }
  const realms=new Map(options.program.realms.map(realm=>[realm.realmId,realm]))
  const admittedOrigin=(row:BrowserCallbackRegistration)=>{
    return realms.has(row.realmId)&&row.resource.browserSessionId===options.binding.browserSessionId
      &&row.resource.generation===options.binding.generation
  }
  function registrations(input:readonly BrowserCallbackRegistration[]) {
    const accepted=input.map(row=>{
      if(!admittedOrigin(row))fail('BROWSER_GENERATION_REGISTRATION_INVALID')
      return Object.freeze({...row,resource:Object.freeze({...row.resource})})
    })
    // The guest registry already applied eventMakeFirst to this exact list.
    return Object.freeze(accepted)
  }
  function acceptRegistrations(input:readonly BrowserCallbackRegistration[],revision?:number) {
    if(revision!==undefined&&(!Number.isSafeInteger(revision)||revision<0))
      fail('BROWSER_GENERATION_REGISTRATION_INVALID')
    // A poll and an explicit registry update can cross at the transport boundary.
    if(latestRegistrationRevision!==undefined&&(revision===undefined||revision<=latestRegistrationRevision))return
    latestRegistrations=registrations(input)
    latestRegistrationRevision=revision
    if(waiter)waiter.registrations=latestRegistrations
  }
  function wait(binding:BrowserBindingV1,input:readonly BrowserCallbackRegistration[],
    signal:AbortSignal,sourceCursor?:string,registrationRevision?:number):Promise<BrowserAuthorInvocation> {
    assertBinding(binding,assertSourceCurrent)
    signal.throwIfAborted()
    if(waiter||pending||hook?.started||filterCall)fail('BROWSER_GENERATION_BUSY')
    acceptRegistrations(input,registrationRevision)
    return new Promise((resolve,reject)=>{
      const abort=()=>{
        if(waiter!==value)return
        waiter=undefined;value.cleanup();reject(Error('BROWSER_GENERATION_READER_DISCONNECTED'))
      }
      let unsubscribe:(()=>void)|undefined
      const value:Waiter={registrations:latestRegistrations,resolve,reject,
        cleanup:()=>{signal.removeEventListener('abort',abort);unsubscribe?.()}}
      waiter=value
      signal.addEventListener('abort',abort,{once:true})
      if(retired.length){waiter=undefined;value.cleanup();value.resolve(retired.shift()!)}
      const deliver=()=>{
        const packet=options.lifecycle?.peek()
        if(waiter!==value||!packet)return
        waiter=undefined;value.cleanup();value.resolve({encoding:'author-native-lifecycle-invocation-v1',packet})
      }
      options.lifecycle?.peek(sourceCursor)
      if(waiter===value){unsubscribe=options.lifecycle?.onReady(deliver);deliver()}
      for(const arrival of readerArrivals)arrival.resolve()
      readerArrivals.clear()
    })
  }
  async function invokeFilter(input:AuthorNativeFilterInvocationV1,signal:AbortSignal,
    sourceData?:RoleplayInputSourceDataWindowV1):Promise<FilterResult> {
    assertCurrent();signal.throwIfAborted()
    if(!realms.has(input.realmId)||input.resource.browserSessionId!==options.binding.browserSessionId
      ||input.resource.generation!==options.binding.generation)fail('AUTHOR_NATIVE_INJECTION_FILTER_SOURCE_CHANGED')
    while(!waiter) {
      await new Promise<void>((resolve,reject)=>{
        const abort=()=>{readerArrivals.delete(arrival);reject(Error('BROWSER_GENERATION_CANCELLED'))}
        const arrival={resolve:()=>{signal.removeEventListener('abort',abort);resolve()},
          reject:(error:Error)=>{signal.removeEventListener('abort',abort);reject(error)}}
        readerArrivals.add(arrival);signal.addEventListener('abort',abort,{once:true})
      })
      assertCurrent();signal.throwIfAborted()
    }
    if(pending||hook||filterCall)fail('BROWSER_GENERATION_BUSY')
    const invocation:BrowserFilterInvocation={...input,schemaVersion:1,
      encoding:'author-native-injection-filter-invocation-v1',invocationId:randomUUID(),binding:options.binding}
    const reader=waiter;waiter=undefined;reader.cleanup()
    const result=new Promise<FilterResult>((resolve,reject)=>{
      const abort=()=>{if(filterCall!==value)return;filterCall=undefined;value.cleanup();reject(Error('BROWSER_GENERATION_CANCELLED'))}
      const value={invocation,sourceData,resolve,reject,cleanup:()=>signal.removeEventListener('abort',abort)}
      filterCall=value;signal.addEventListener('abort',abort,{once:true})
    })
    reader.resolve(invocation)
    return result
  }
  function completeFilter(result:BrowserFilterCompletion):void {
    assertBinding(result.binding)
    const value=filterCall
    if(!value||value.invocation.invocationId!==result.invocationId
      ||value.invocation.operationId!==result.operationId)fail('BROWSER_GENERATION_INVOCATION_REVOKED')
    filterCall=undefined;value.cleanup()
    if(result.kind!=='executed'){value.reject(Error(result.code));return}
    if(typeof result.accepted!=='boolean'){value.reject(Error('AUTHOR_NATIVE_INJECTION_FILTER_INVALID_RESULT'));return}
    try {value.resolve({accepted:result.accepted,libraryReads:options.resolveLibraryReads?.(result.libraryReads??[])??[]})}
    catch(error){value.reject(error instanceof Error?error:Error('AUTHOR_NATIVE_LIBRARY_READ_UNAVAILABLE'))}
  }
  function retireFilterCallbacks(message:BrowserFilterRetired):void {
    if(waiter&&!pending&&!hook&&!filterCall){const reader=waiter;waiter=undefined;reader.cleanup();reader.resolve(message)}
    else retired.push(message)
  }
  function invoke(input:{readonly attemptId:string;readonly capture:PromptCaptureV1;
    readonly snapshot:AuthorNativeHelperSnapshotV1},signal:AbortSignal,
    sourceData?:RoleplayInputSourceDataWindowV1):Promise<BrowserGenerationOutput> {
    assertCurrent()
    signal.throwIfAborted()
    if(pending||hook||filterCall)fail('BROWSER_GENERATION_BUSY')
    const reader=waiter
    if(!reader)fail('BROWSER_GENERATION_READER_UNAVAILABLE')
    if(input.capture.sessionId!==options.binding.sessionId||input.snapshot.generation!==options.binding.generation
      ||input.capture.attemptId!==input.attemptId)fail('BROWSER_GENERATION_CAPTURE_CHANGED')
    const invocation:BrowserGenerationInvocation=Object.freeze({schemaVersion:1,
      encoding:'author-native-generation-invocation-v1',invocationId:randomUUID(),
      binding:options.binding,registrations:reader.registrations.filter(row=>row.event==='GENERATION_AFTER_COMMANDS'),...input})
    const result=new Promise<BrowserGenerationOutput>((resolve,reject)=>{
      const abort=()=>{
        if(pending!==value)return
        pending=undefined;value.cleanup();reject(Error('BROWSER_GENERATION_CANCELLED'))
      }
      const value:Pending={invocation,sourceData,resolve,reject,cleanup:()=>signal.removeEventListener('abort',abort)}
      pending=value
      signal.addEventListener('abort',abort,{once:true})
    })
    waiter=undefined;reader.cleanup();reader.resolve(invocation)
    return result
  }
  async function awaitReader(signal:AbortSignal):Promise<Waiter> {
    assertSourceCurrent();signal.throwIfAborted()
    while(!waiter) {
      await new Promise<void>((resolve,reject)=>{
        const abort=()=>{readerArrivals.delete(arrival);reject(Error('BROWSER_GENERATION_CANCELLED'))}
        const arrival={resolve:()=>{signal.removeEventListener('abort',abort);resolve()},
          reject:(error:Error)=>{signal.removeEventListener('abort',abort);reject(error)}}
        readerArrivals.add(arrival);signal.addEventListener('abort',abort,{once:true})
      })
      assertSourceCurrent();signal.throwIfAborted()
    }
    return waiter
  }
  async function prepareHook(request:AuthorNativeMvuHookRequest,signal:AbortSignal)
    :Promise<AuthorNativeMvuPreparedHook|undefined> {
    // Native's closing owner supplies this stage's current graph. Its earlier
    // snapshot may have expired while the same Source realm remains live.
    assertSourceCurrent();signal.throwIfAborted()
    const event=AUTHOR_NATIVE_MVU_HOOK_EVENTS[request.stage]
    if(!latestRegistrations.some(row=>row.event===event))return undefined
    // The previous completion and the next long-poll cross HTTP separately.
    // A known listener waits for the same Reader's next admitted poll.
    const reader=await awaitReader(signal)
    if(pending||hook||filterCall)fail('BROWSER_GENERATION_BUSY')
    const callbacks=reader.registrations.filter(row=>row.event===event)
    if(!callbacks.length)return undefined
    const invocation:BrowserMvuHookInvocation={schemaVersion:1,encoding:'author-native-mvu-hook-invocation-v1',
      invocationId:randomUUID(),binding:options.binding,request,registrations:callbacks}
    const abort=()=>{
      if(hook!==value)return
      hook=undefined;value.cleanup();value.reject?.(Error('BROWSER_GENERATION_CANCELLED'))
    }
    const value={invocation,reader,started:false,resolve:undefined as ((result:AuthorNativeMvuHookResult)=>void)|undefined,
      reject:undefined as ((error:Error)=>void)|undefined,
      cleanup:()=>signal.removeEventListener('abort',abort)}
    hook=value;signal.addEventListener('abort',abort,{once:true})
    return {identity:{invocationId:invocation.invocationId,programSha256:options.program.programSha256,
      binding:options.binding,registrations:callbacks.map(row=>({realmId:row.realmId,
        groupId:realms.get(row.realmId)!.groupId,callbackId:row.callbackId,resource:row.resource}))},
      execute:()=>{
        assertSourceCurrent();signal.throwIfAborted()
        if(hook!==value||waiter!==reader||value.started)fail('BROWSER_GENERATION_INVOCATION_REVOKED')
        value.started=true
        const result=new Promise<AuthorNativeMvuHookResult>((resolve,reject)=>{value.resolve=resolve;value.reject=reject})
        waiter=undefined;reader.cleanup();reader.resolve(invocation)
        return result
      },dispose:()=>{
        if(hook!==value)return
        hook=undefined;value.cleanup();value.reject?.(Error('BROWSER_GENERATION_INVOCATION_REVOKED'))
      }}
  }
  function completeHook(result:BrowserMvuHookCompletion):void {
    assertBinding(result.binding,assertSourceCurrent)
    const value=hook
    if(!value?.started||value.invocation.invocationId!==result.invocationId)
      fail('BROWSER_GENERATION_INVOCATION_REVOKED')
    hook=undefined;value.cleanup()
    const refuse=(code:string):never=>{value.reject?.(Error(code));return fail(code)}
    if(result.kind!=='executed'){value.reject?.(Error(result.code));return}
    if(result.result.stage!==value.invocation.request.stage)return refuse('AUTHOR_NATIVE_MVU_HOOK_OUTPUT_CHANGED')
    const callbacks=new Map(value.invocation.registrations.map((row,index)=>[row.callbackId,index]))
    let previous=-1
    for(const id of result.callbackIds){
      const index=callbacks.get(id)
      if(index===undefined||index<=previous)return refuse('AUTHOR_NATIVE_MVU_HOOK_OUTPUT_CHANGED')
      previous=index
    }
    if(result.registrations) {
      try {acceptRegistrations(result.registrations,result.registrationRevision)}
      catch(error){return refuse(error instanceof Error?error.message:'BROWSER_GENERATION_REGISTRATION_INVALID')}
    }
    value.resolve?.(result.result)
  }
  function complete(result:BrowserGenerationResult):void {
    assertBinding(result.binding)
    const value=pending
    if(!value||value.invocation.invocationId!==result.invocationId)fail('BROWSER_GENERATION_INVOCATION_REVOKED')
    const refuse=(code:string):never=>{
      pending=undefined;value.cleanup();value.reject(Error(code))
      return fail(code)
    }
    if(result.kind!=='executed') {
      pending=undefined;value.cleanup()
      value.reject(Error(result.diagnostics[0]?.code??'BROWSER_GENERATION_REFUSED'))
      return
    }
    const raw=result.result,invocation=value.invocation
    if(raw.invocationId!==invocation.invocationId)refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
    const callbacks=new Map(invocation.registrations.map((row,index)=>[row.callbackId,{row,index}]))
    const executed=new Map<string,BrowserCallbackRegistration>()
    let previous=-1
    for(const id of raw.callbackIds){
      const callback=callbacks.get(id)
      if(!callback||callback.index<=previous)return refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
      previous=callback.index;executed.set(id,callback.row)
    }
    // A real callback may remove a later listener during the captured pass.
    // The returned IDs therefore form an ordered subsequence, not a fabricated
    // claim that every callback in the challenge necessarily ran.
    let effects:BrowserGenerationOutput['effects'],libraryReads:readonly AuthorNativeResolvedLibraryReadV1[]
    try {
      libraryReads=options.resolveLibraryReads?.(raw.libraryReads??[])??[]
      effects=raw.effects.map(effect=>{
        const callback=executed.get(effect.callbackId)
        if(!callback)return refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
        const realm=realms.get(callback.realmId)!
        const origin={realmId:realm.realmId,groupId:realm.groupId,callbackId:callback.callbackId,resource:callback.resource}
        if(effect.kind==='remove'){
          if(!Array.isArray(effect.ids)||effect.ids.some(id=>typeof id!=='string'))fail('AUTHOR_NATIVE_INJECTION_INVALID')
          return {...origin,kind:'remove' as const,ids:Object.freeze([...effect.ids])}
        }
        if(effect.kind!=='inject'||!Array.isArray(effect.prompts))fail('AUTHOR_NATIVE_INJECTION_INVALID')
        const prompts=effect.prompts.map(prompt=>{
          const p=prompt as Partial<AuthorPromptInjectionV1>&{filter?:unknown}
          if(!p||typeof p!=='object')fail('AUTHOR_NATIVE_INJECTION_INVALID')
          // JS-Slash-Runner 519599bc src/function/inject.ts supplies these
          // nullish defaults. Native function filters need a live callback
          // consumer contract; a serialized omission must never accept one.
          if(p.filter!==undefined&&p.filter!==null)fail('AUTHOR_NATIVE_INJECTION_FILTER_UNSUPPORTED')
          const id=p.id??randomUUID(),content=p.content??'',depth=p.depth??0,
            role=p.role??'system',should_scan=p.should_scan??false,position=p.position==='none'?'none':'in_chat'
          if(typeof id!=='string'||typeof content!=='string'||!Number.isFinite(depth)
            ||!['system','user','assistant'].includes(role)||typeof should_scan!=='boolean')
            fail('AUTHOR_NATIVE_INJECTION_INVALID')
          return Object.freeze({id,position,depth,role,content,should_scan})
        })
        return {...origin,kind:'inject' as const,prompts:Object.freeze(prompts),once:effect.once===true}
      })
    }catch(error){return refuse(error instanceof Error?error.message:'AUTHOR_NATIVE_INJECTION_INVALID')}
    const body={schemaVersion:1 as const,encoding:'author-native-generation-output-v1' as const,
      authority:'consumer-data-only' as const,invocationId:invocation.invocationId,programSha256:options.program.programSha256,
      captureSha256:invocation.capture.captureSha256,effects:Object.freeze(effects.map(effect=>Object.freeze(effect))),
      callbacksExecuted:raw.callbackIds.length,...libraryReads.length?{libraryReads}:{}}
    const output:BrowserGenerationOutput=Object.freeze({...body,outputSha256:recordSha256(body)})
    producedPrompts ||= output.effects.some(effect=>effect.kind==='inject'&&effect.prompts.length>0)
    pending=undefined;value.cleanup();value.resolve(output)
  }
  function dispose():void {
    options.lifecycle?.dispose()
    if(closed)return
    closed=true
    const filter=filterCall;filterCall=undefined;filter?.cleanup();filter?.reject(Error('BROWSER_ATTACHMENT_REVOKED'));retired.length=0
    const reader=waiter,call=pending
    waiter=undefined;pending=undefined
    const stage=hook;hook=undefined;stage?.cleanup();stage?.reject?.(Error('BROWSER_ATTACHMENT_REVOKED'))
    for(const arrival of readerArrivals)arrival.reject(Error('BROWSER_ATTACHMENT_REVOKED'))
    readerArrivals.clear()
    reader?.cleanup();call?.cleanup()
    reader?.reject(Error('BROWSER_ATTACHMENT_REVOKED'))
    call?.reject(Error('BROWSER_ATTACHMENT_REVOKED'))
  }
  function retireResource(pageId:string):void {
    if(filterCall?.invocation.resource.pageId===pageId){const call=filterCall;filterCall=undefined;
      call.cleanup();call.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'))}
    const belongs=(row:BrowserCallbackRegistration)=>row.resource.pageId===pageId
    if(waiter?.registrations.some(belongs)) {
      const reader=waiter;waiter=undefined;reader.cleanup()
      reader.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'))
    }
    if(pending?.invocation.registrations.some(belongs)) {
      const call=pending;pending=undefined;call.cleanup()
      call.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'))
    }
    latestRegistrations=latestRegistrations.filter(row=>!belongs(row))
    if(hook?.invocation.registrations.some(belongs)) {
      const stage=hook;hook=undefined;stage.cleanup();stage.reject?.(Error('BROWSER_GENERATION_RESOURCE_RETIRED'))
    }
  }
  return {wait,updateRegistrations(binding:BrowserBindingV1,input:readonly BrowserCallbackRegistration[],revision:number) {
      assertBinding(binding,assertSourceCurrent)
      if(revision===undefined)fail('BROWSER_GENERATION_REGISTRATION_INVALID')
      acceptRegistrations(input,revision)
    },awaitReader,invoke,complete,invokeFilter,completeFilter,retireFilterCallbacks,
    prepareHook,completeHook,dispose,retireResource,
    hookInterests:():readonly Mvu196HookStage[]=>sourceCurrent()?
      (Object.keys(AUTHOR_NATIVE_MVU_HOOK_EVENTS) as AuthorNativeMvuHookStage[])
      .filter((stage):stage is Mvu196HookStage=>stage!=='initialized'&&stage!=='before-message-update'
        &&latestRegistrations.some(row=>row.event===AUTHOR_NATIVE_MVU_HOOK_EVENTS[stage])):[],
    sourceDataFor:(realmId:string)=>{
      const filter=filterCall
      if(filter?.sourceData&&filter.invocation.realmId===realmId&&current())return ()=>
        filterCall===filter&&current()?filter.sourceData!.begin({invocationId:filter.invocation.invocationId,
          programSha256:options.program.programSha256,realmId,groupId:realms.get(realmId)!.groupId}):undefined
      const call=pending,realm=realms.get(realmId)
      if(!call?.sourceData||!realm||!current()
        ||!call.invocation.registrations.some(row=>row.realmId===realmId))return undefined
      return ()=>pending===call&&current()?call.sourceData!.begin({
        invocationId:call.invocation.invocationId,programSha256:options.program.programSha256,
        realmId:realm.realmId,groupId:realm.groupId}):undefined
    },
    snapshotFor:(invocationId:string)=>current()?(pending?.invocation.invocationId===invocationId
      ?pending.invocation.snapshot:filterCall?.invocation.invocationId===invocationId?filterCall.invocation.snapshot:undefined):undefined,
    hasProducedPrompts:()=>producedPrompts,hasReader:()=>current()&&waiter!==undefined&&!hook}
}

export {createRoleplayAuthorBrowserGeneration as createRoleplayAuthorBrowserGenerationV3}
