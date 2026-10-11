/** One live attachment owns its waiting Reader and pending preparation call.
 * A long-poll transports the challenge; it never grants Native permission. */
import {randomUUID} from 'node:crypto'
import {recordSha256} from './roleplay-data.js'
import type {BrowserBindingV1} from './tavern-author-browser-types.mjs'
import type {BrowserProgramV2,BrowserSnapshotV2} from './tavern-author-browser-types-v2.mjs'
import type {BrowserProgramV3,BrowserSnapshotV3} from './tavern-author-browser-types-v3.mjs'
import type {PromptCaptureV1} from './tavern-author-prompt-types.mjs'
import type {BrowserCallbackRegistrationV2,BrowserGenerationInvocationV2,
  BrowserGenerationOutputV2,BrowserGenerationResultV2,BrowserCallbackRegistrationV3,
  BrowserGenerationInvocationV3,BrowserGenerationOutputV3,BrowserGenerationResultV3,
  BrowserCallbackRegistration,BrowserGenerationInvocation,BrowserGenerationOutput,
  BrowserGenerationResult} from './roleplay-author-browser-generation-types.js'

const sameBinding=(left:BrowserBindingV1,right:BrowserBindingV1)=>
  left.browserSessionId===right.browserSessionId&&left.generation===right.generation
  &&left.sessionId===right.sessionId&&left.programSha256===right.programSha256
function fail(code:string):never {throw Error(code)}
interface Waiter {
  readonly registrations:readonly BrowserCallbackRegistration[]
  resolve(invocation:BrowserGenerationInvocation):void
  reject(error:Error):void
  cleanup():void
}
interface Pending {
  readonly invocation:BrowserGenerationInvocation
  resolve(output:BrowserGenerationOutput):void
  reject(error:Error):void
  cleanup():void
}

export function createRoleplayAuthorBrowserGeneration(options:{
  readonly binding:BrowserBindingV1
  readonly program:BrowserProgramV2|BrowserProgramV3
  current():boolean
}) {
  let closed=false,waiter:Waiter|undefined,pending:Pending|undefined
  let producedPrompts=false
  const current=()=>!closed&&options.current()
  const assertCurrent=()=>{if(!current())fail('BROWSER_ATTACHMENT_REVOKED')}
  const assertBinding=(binding:BrowserBindingV1)=>{
    if(!sameBinding(binding,options.binding))fail('BROWSER_ATTACHMENT_REVOKED')
    assertCurrent()
  }
  const admittedOrigin=(row:BrowserCallbackRegistration)=>{
    const script=options.program.scripts.find(candidate=>candidate.ordinal===row.originalOrdinal
      &&candidate.descriptor.identity===row.scriptIdentity&&candidate.descriptorSha256===row.descriptorSha256)
    if(!script)return false
    if(options.program.schemaVersion===2)return 'priority' in row
      &&script.requiredCapabilities.includes('owned-generation-callbacks')
    if(!('page' in row)||row.resource.browserSessionId!==options.binding.browserSessionId
      ||row.resource.generation!==options.binding.generation)return false
    if(row.page===null)return script.requiredCapabilities.includes('owned-generation-callbacks')
    const origin=row.page
    const mountedPages=(script as BrowserProgramV3['scripts'][number]).sourcePagePlans
    return options.program.sourcePages.some(page=>page.origin.carrier.identity===row.scriptIdentity
      &&page.origin.htmlSha256===origin.htmlSha256&&mountedPages.includes(page.pagePlanSha256)
      &&page.scripts.some(unit=>unit.inlineOrdinal===origin.inlineOrdinal
        &&unit.javascriptSha256===origin.javascriptSha256
        &&unit.requiredCapabilities.includes('owned-generation-callbacks')))
  }
  function registrations(input:readonly BrowserCallbackRegistration[]) {
    const ids=new Set<string>()
    const accepted=input.map(row=>{
      if(!admittedOrigin(row)||ids.has(row.callbackId)
        ||typeof row.callbackId!=='string'||!row.callbackId.length
        ||options.program.schemaVersion===2&&(!('priority' in row)
          ||!['first','normal'].includes(row.priority)||!Number.isSafeInteger(row.registrationOrder)
          ||row.registrationOrder<0))fail('BROWSER_GENERATION_REGISTRATION_INVALID')
      ids.add(row.callbackId)
      return Object.freeze({...row})
    })
    if(options.program.schemaVersion===2&&!accepted.length)fail('BROWSER_GENERATION_CALLBACK_UNAVAILABLE')
    // V2 transports priority metadata. V3 already carries the actual guest
    // list after eventMakeFirst, so sorting it here would change author order.
    if(options.program.schemaVersion===2) {
      (accepted as BrowserCallbackRegistrationV2[]).sort((left,right)=>{
        if(left.priority!==right.priority)return left.priority==='first'?-1:1
        return left.priority==='first'?right.registrationOrder-left.registrationOrder
          :left.registrationOrder-right.registrationOrder
      })
    }
    return Object.freeze(accepted)
  }
  function wait(binding:BrowserBindingV1,input:readonly BrowserCallbackRegistration[],
    signal:AbortSignal):Promise<BrowserGenerationInvocation> {
    assertBinding(binding)
    signal.throwIfAborted()
    if(waiter||pending)fail('BROWSER_GENERATION_BUSY')
    const callbacks=registrations(input)
    return new Promise((resolve,reject)=>{
      const abort=()=>{
        if(waiter!==value)return
        waiter=undefined;value.cleanup();reject(Error('BROWSER_GENERATION_READER_DISCONNECTED'))
      }
      const value:Waiter={registrations:callbacks,resolve,reject,
        cleanup:()=>signal.removeEventListener('abort',abort)}
      waiter=value
      signal.addEventListener('abort',abort,{once:true})
    })
  }
  function invoke(input:{readonly attemptId:string;readonly capture:PromptCaptureV1;
    readonly snapshot:BrowserSnapshotV2|BrowserSnapshotV3},signal:AbortSignal):Promise<BrowserGenerationOutput> {
    assertCurrent()
    signal.throwIfAborted()
    if(pending)fail('BROWSER_GENERATION_BUSY')
    const reader=waiter
    if(!reader)fail('BROWSER_GENERATION_READER_UNAVAILABLE')
    if(input.capture.sessionId!==options.binding.sessionId||input.snapshot.generation!==options.binding.generation
      ||input.capture.attemptId!==input.attemptId)fail('BROWSER_GENERATION_CAPTURE_CHANGED')
    const invocation=Object.freeze({schemaVersion:options.program.schemaVersion,
      encoding:options.program.schemaVersion===2?'native-author-browser-generation-invocation-v2'
        :'native-author-browser-generation-invocation-v3',invocationId:randomUUID(),
      binding:options.binding,registrations:reader.registrations,...input}) as BrowserGenerationInvocation
    const result=new Promise<BrowserGenerationOutput>((resolve,reject)=>{
      const abort=()=>{
        if(pending!==value)return
        pending=undefined;value.cleanup();reject(Error('BROWSER_GENERATION_CANCELLED'))
      }
      const value:Pending={invocation,resolve,reject,cleanup:()=>signal.removeEventListener('abort',abort)}
      pending=value
      signal.addEventListener('abort',abort,{once:true})
    })
    waiter=undefined;reader.cleanup();reader.resolve(invocation)
    return result
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
    const output=result.output,invocation=value.invocation
    if(output.schemaVersion!==options.program.schemaVersion||output.encoding!==(options.program.schemaVersion===2
        ?'native-author-browser-generation-output-v2':'native-author-browser-generation-output-v3')
      ||output.authority!=='consumer-data-only'||output.invocationId!==invocation.invocationId
      ||output.programSha256!==options.program.programSha256||output.captureSha256!==invocation.capture.captureSha256
      ||output.callbacksExecuted!==invocation.registrations.length)refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
    const callbacks=new Map(invocation.registrations.map(row=>[row.callbackId,row]))
    for(const effect of output.effects) {
      const callback=callbacks.get(effect.callbackId)
      if(!callback)return refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
      if(callback.originalOrdinal!==effect.originalOrdinal||callback.scriptIdentity!==effect.scriptIdentity
        ||callback.descriptorSha256!==effect.descriptorSha256)
        refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
      if('page' in callback) {
        if(!('page' in effect)||callback.page===null&&effect.page!==null
          ||callback.page!==null&&(effect.page===null
            ||callback.page.htmlSha256!==effect.page.htmlSha256
            ||callback.page.inlineOrdinal!==effect.page.inlineOrdinal
            ||callback.page.javascriptSha256!==effect.page.javascriptSha256))
          refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
        if(!('resource' in effect)||callback.resource.browserSessionId!==effect.resource.browserSessionId
          ||callback.resource.generation!==effect.resource.generation
          ||callback.resource.pageId!==effect.resource.pageId)refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
      }
    }
    const {outputSha256,...body}=output
    if(recordSha256(body)!==outputSha256)refuse('BROWSER_GENERATION_OUTPUT_CHANGED')
    producedPrompts ||= output.effects.some(effect=>effect.kind==='inject'&&effect.prompts.length>0)
    pending=undefined;value.cleanup();value.resolve(output)
  }
  function dispose():void {
    if(closed)return
    closed=true
    const reader=waiter,call=pending
    waiter=undefined;pending=undefined
    reader?.cleanup();call?.cleanup()
    reader?.reject(Error('BROWSER_ATTACHMENT_REVOKED'))
    call?.reject(Error('BROWSER_ATTACHMENT_REVOKED'))
  }
  function retireResource(pageId:string):void {
    const belongs=(row:BrowserCallbackRegistration)=>'resource' in row&&row.resource.pageId===pageId
    if(waiter?.registrations.some(belongs)) {
      const reader=waiter;waiter=undefined;reader.cleanup()
      reader.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'))
    }
    if(pending?.invocation.registrations.some(belongs)) {
      const call=pending;pending=undefined;call.cleanup()
      call.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'))
    }
  }
  return {wait,invoke,complete,dispose,retireResource,
    hasProducedPrompts:()=>producedPrompts,hasReader:()=>current()&&waiter!==undefined}
}

export function createRoleplayAuthorBrowserGenerationV2(options:{
  readonly binding:BrowserBindingV1;readonly program:BrowserProgramV2;current():boolean
}) {
  const owner=createRoleplayAuthorBrowserGeneration(options)
  return {...owner,
    wait:(binding:BrowserBindingV1,rows:readonly BrowserCallbackRegistrationV2[],signal:AbortSignal)=>
      owner.wait(binding,rows,signal) as Promise<BrowserGenerationInvocationV2>,
    invoke:(input:{readonly attemptId:string;readonly capture:PromptCaptureV1;readonly snapshot:BrowserSnapshotV2},signal:AbortSignal)=>
      owner.invoke(input,signal) as Promise<BrowserGenerationOutputV2>,
    complete:(result:BrowserGenerationResultV2)=>owner.complete(result)}
}
export function createRoleplayAuthorBrowserGenerationV3(options:{
  readonly binding:BrowserBindingV1;readonly program:BrowserProgramV3;current():boolean
}) {
  const owner=createRoleplayAuthorBrowserGeneration(options)
  return {...owner,
    wait:(binding:BrowserBindingV1,rows:readonly BrowserCallbackRegistrationV3[],signal:AbortSignal)=>
      owner.wait(binding,rows,signal) as Promise<BrowserGenerationInvocationV3>,
    invoke:(input:{readonly attemptId:string;readonly capture:PromptCaptureV1;readonly snapshot:BrowserSnapshotV3},signal:AbortSignal)=>
      owner.invoke(input,signal) as Promise<BrowserGenerationOutputV3>,
    complete:(result:BrowserGenerationResultV3)=>owner.complete(result)}
}
