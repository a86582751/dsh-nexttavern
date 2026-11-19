/** Live author operations retain their original TaskHost job. Native owns
 * dispatch, accepted material and completion. This map only delivers that
 * operation to its current browser attachment. */
import {recordSha256} from './roleplay-data.js'
import {randomUUID} from 'node:crypto'
import type {AuthorNativeGenerationFilterV1,AuthorNativeRealmLibraryReadV1,AuthorNativeResolvedLibraryReadV1}
  from './author-native-helper-types.js'
import type {AuthorChatNamespaceV3} from './roleplay-author-chat-state-types.js'
import type {AdmittedAuthorDialogTarget,AuthorDialogPromptV1,AuthorDialogResultV1}
  from './roleplay-author-dialog.js'
import type {AuthorNativeGenerateRawRequestV1,AuthorNativeGeneratedTaskV1,AuthorNativeGenerationUpdateV1}
  from './roleplay-author-browser-types.js'
import type {AuthorDialogOperationV1,AuthorDialogRequestV1} from './roleplay-task-host-types.js'

type Program={readonly programSha256:string}
type Realm={readonly realmId:string;readonly groupId:string;readonly effects?:'source'|'readonly'}
interface CapturedPrompt {
  readonly prompt:AuthorDialogPromptV1
  assertCurrent():void
  accept?():void
  onCheckpoint:NonNullable<AuthorDialogRequestV1['onCheckpoint']>
  release():void
}
type TaskHooks=Pick<AuthorDialogRequestV1,'onAdmission'|'onCheckpoint'|'onStream'>&{onAccepted?():void}
interface Dependencies {
  capturePrompt(sid:string,target:AdmittedAuthorDialogTarget,request:AuthorNativeGenerateRawRequestV1,
    operationId:string,current:()=>boolean,signal:AbortSignal):Promise<CapturedPrompt>
  restorePrompt(sid:string,prompt:AuthorDialogPromptV1,current:()=>boolean,signal:AbortSignal):Promise<CapturedPrompt>
  requestTask(sid:string,prompt:AuthorDialogPromptV1,current:()=>boolean,signal:AbortSignal,hooks:TaskHooks)
    :Promise<AuthorDialogResultV1>
  readOperation?(sid:string,binding:AdmittedAuthorDialogTarget['binding'],operationId:string)
    :AuthorDialogOperationV1|undefined
  resolveLibraryReads(sid:string,reads:readonly AuthorNativeRealmLibraryReadV1[]):readonly AuthorNativeResolvedLibraryReadV1[]
  captureCurrent(sid:string,program:Program,current:()=>boolean):Promise<{
    readonly namespace:AuthorChatNamespaceV3;readonly current:()=>boolean}>
}
interface Request {
  readonly requestSha256:string
  readonly generationId:string
  readonly current:()=>boolean
  readonly controller:AbortController
  readonly deltas:{readonly kind:'text'|'reasoning';readonly delta:string}[]
  readonly waiters:Set<()=>void>
  readonly filters:Map<string,{readonly descriptor:AuthorNativeGenerationFilterV1;readonly consumer:'scan'|'chat';
    resolve(result:{readonly accepted:boolean;readonly libraryReads:readonly AuthorNativeResolvedLibraryReadV1[]}):void;
    reject(error:Error):void}>
  readonly acknowledgedFilters:Set<string>
  result:Promise<AuthorNativeGeneratedTaskV1>
  completed?:AuthorNativeGeneratedTaskV1
  error?:string
  settled:boolean
  cancelNative?:()=>Promise<void>
}
function fail(code:string):never {throw Error(code)}
function detail(result:AuthorDialogResultV1):AuthorNativeGeneratedTaskV1 {
  const reasoning:string[]=[],signatures:string[]=[],
    toolCalls:Array<NonNullable<AuthorNativeGeneratedTaskV1['details']['tool_calls']>[number]>=[]
  for(const [index,block] of (result.message?.content??[]).entries()) {
    const metadata=result.details?.blocks[index]
    if(block.type==='reasoning') {
      reasoning.push(block.text)
      if(metadata?.type==='reasoning'&&metadata.signature)signatures.push(metadata.signature)
    }else if(block.type==='tool-call') {
      toolCalls.push({id:block.id,type:'function',function:{name:block.name,arguments:block.arguments},
        ...metadata?.type==='tool-call'&&metadata.signature?{thought_signature:metadata.signature}:{}})
    }
  }
  return {text:result.text,task:result.task,details:{content:result.text,
    ...reasoning.length?{reasoning:reasoning.join('')}:{},
    ...reasoning.length===1&&signatures.length===1?{reasoning_signature:signatures[0]}:{},
    ...toolCalls.length?{tool_calls:toolCalls}:{}}}
}
export function createRoleplayAuthorBrowserDialogCoreV1(deps:Dependencies) {
  const requests=new Map<string,Request>(),generations=new Map<string,Request>(),
    cancelledOperations=new Map<string,()=>boolean>()
  let closed=false
  const key=(sid:string,program:Program,realm:Realm,operationId:string)=>
    recordSha256({sid,programSha256:program.programSha256,realmId:realm.realmId,operationId})
  const assertLive=(current:()=>boolean,signal:AbortSignal)=>{
    signal.throwIfAborted()
    if(closed||!current())fail('BROWSER_ATTACHMENT_REVOKED')
  }
  function wake(request:Request):void {
    for(const waiter of request.waiters)waiter()
    request.waiters.clear()
  }
  function start(sid:string,program:Program,realm:Realm,request:AuthorNativeGenerateRawRequestV1,
    current:()=>boolean,signal:AbortSignal) {
    assertLive(current,signal)
    const identity=key(sid,program,realm,request.operationId),requestSha256=recordSha256(request),prior=requests.get(identity)
    if(cancelledOperations.has(identity))fail('AUTHOR_GENERATION_CANCELLED')
    if(prior) {
      if(prior.requestSha256!==requestSha256)fail('AUTHOR_CHAT_OPERATION_CHANGED')
      return {operationId:request.operationId,generationId:prior.generationId}
    }
    const generationId=typeof request.options.generation_id==='string'?request.options.generation_id:request.operationId,
      generationKey=JSON.stringify([sid,generationId])
    if(generations.has(generationKey))fail('AUTHOR_GENERATION_ID_ACTIVE')
    const controller=new AbortController(),requestSignal=AbortSignal.any([signal,controller.signal]),
      entry:Request={requestSha256,generationId,current,controller,deltas:[],waiters:new Set(),
        filters:new Map(),acknowledgedFilters:new Set(),settled:false,
        result:undefined as unknown as Promise<AuthorNativeGeneratedTaskV1>}
    requests.set(identity,entry);generations.set(generationKey,entry)
    entry.result=(async()=>{
      const source=await deps.captureCurrent(sid,program,current),binding={namespace:source.namespace,
        programSha256:program.programSha256,realmId:realm.realmId,groupId:realm.groupId}
      assertLive(source.current,requestSignal)
      const operationId=recordSha256({schemaVersion:1,encoding:'author-native-dialog-operation-v1',binding,
        operationId:request.operationId}),stored=deps.readOperation?.(sid,binding,operationId)
      if(stored?.result)return detail(stored.result)
      const captured=stored
        ?stored.status==='queued'?await deps.restorePrompt(sid,stored.prompt,current,requestSignal):undefined
        :await deps.capturePrompt(sid,{binding,effects:realm.effects??'source',
          libraryReads:deps.resolveLibraryReads(sid,request.libraryReads??[]),
          invokeFilter:(descriptor,consumer)=>new Promise((resolve,reject)=>{
            requestSignal.throwIfAborted()
            const invocationId=randomUUID(),abort=()=>{
              entry.filters.delete(invocationId)
              reject(requestSignal.reason)
            }
            entry.filters.set(invocationId,{descriptor,consumer,
              resolve(value){requestSignal.removeEventListener('abort',abort);resolve(value)},
              reject(error){requestSignal.removeEventListener('abort',abort);reject(error)}})
            requestSignal.addEventListener('abort',abort,{once:true});wake(entry)
          })},request,operationId,current,requestSignal),
        prompt=stored?.prompt??captured!.prompt
      try {
        const owner=()=>{
          try {assertLive(current,requestSignal);captured?.assertCurrent();return true}catch{return false}
        }
        const completed=await deps.requestTask(sid,prompt,owner,requestSignal,{
          async onAdmission(handle) {
            entry.cancelNative=handle.cancel
            if(requestSignal.aborted||!current())await handle.cancel()
          },
          onCheckpoint:captured?.onCheckpoint,
          onAccepted:captured?.accept,
          onStream(frame) {
            if(requestSignal.aborted||!owner()||!prompt.presentation.stream)return
            entry.deltas.push({kind:frame.kind,delta:frame.delta});wake(entry)
          },
        })
        assertLive(current,requestSignal);captured?.assertCurrent()
        return detail(completed)
      }finally{captured?.release()}
    })().then(value=>{entry.completed=value;return value},error=>{
      entry.error=error instanceof Error?error.message:String(error)
      throw error
    }).finally(()=>{
      entry.settled=true
      if(generations.get(generationKey)===entry)generations.delete(generationKey)
      wake(entry)
    })
    // Failure retains the original operation. Replaying an RPC cannot turn an
    // unknown provider outcome into another capture or another paid request.
    void entry.result.catch(()=>{})
    return {operationId:request.operationId,generationId}
  }
  function find(sid:string,program:Program,realm:Realm,operationId:string) {
    const entry=requests.get(key(sid,program,realm,operationId))
    if(!entry)fail('AUTHOR_GENERATION_UNKNOWN')
    return entry
  }
  async function next(sid:string,program:Program,realm:Realm,operationId:string,cursor:number,
    current:()=>boolean,signal:AbortSignal):Promise<AuthorNativeGenerationUpdateV1> {
    assertLive(current,signal)
    const entry=find(sid,program,realm,operationId)
    if(!Number.isSafeInteger(cursor)||cursor<0||cursor>entry.deltas.length)fail('AUTHOR_GENERATION_CURSOR_INVALID')
    if(cursor===entry.deltas.length&&!entry.settled&&!entry.filters.size)await new Promise<void>((resolve,reject)=>{
      const ready=()=>{signal.removeEventListener('abort',aborted);resolve()},
        aborted=()=>{entry.waiters.delete(ready);reject(signal.reason)}
      entry.waiters.add(ready);signal.addEventListener('abort',aborted,{once:true})
    })
    assertLive(current,signal)
    const pending=entry.filters.entries().next().value
    return {cursor:entry.deltas.length,deltas:entry.deltas.slice(cursor),settled:entry.settled,
      ...pending?{filter:{invocationId:pending[0],descriptor:pending[1].descriptor,consumer:pending[1].consumer}}:{},
      ...entry.completed?{result:entry.completed}:{},...entry.error?{error:entry.error}:{}}
  }
  function completeFilter(sid:string,program:Program,realm:Realm,operationId:string,
    input:{readonly invocationId:string;readonly accepted:boolean;readonly error?:string;
      readonly libraryReads?:readonly AuthorNativeRealmLibraryReadV1[]},current:()=>boolean,signal:AbortSignal):void {
    assertLive(current,signal)
    const entry=find(sid,program,realm,operationId)
    if(entry.acknowledgedFilters.has(input.invocationId))return
    const filter=entry.filters.get(input.invocationId)
    if(!filter||entry.controller.signal.aborted)fail('AUTHOR_GENERATION_FILTER_REVOKED')
    const libraryReads=deps.resolveLibraryReads(sid,input.libraryReads??[])
    entry.filters.delete(input.invocationId);entry.acknowledgedFilters.add(input.invocationId)
    if(input.error)filter.reject(Error(input.error))
    else filter.resolve({accepted:input.accepted,libraryReads})
  }
  async function cancel(sid:string,program:Program,realm:Realm,operationId:string,
    current:()=>boolean,signal:AbortSignal):Promise<boolean> {
    assertLive(current,signal)
    const identity=key(sid,program,realm,operationId),entry=requests.get(identity)
    if(!entry){
      // A small stop request can overtake the image-bearing start body. Keep
      // that actual operation revoked within this same attachment lifetime.
      cancelledOperations.set(identity,current)
      return true
    }
    if(entry.settled||entry.controller.signal.aborted)return false
    entry.controller.abort(Error('AUTHOR_GENERATION_CANCELLED'))
    await entry.cancelNative?.()
    return true
  }
  async function generateRaw(sid:string,program:Program,realm:Realm,request:AuthorNativeGenerateRawRequestV1,
    current:()=>boolean,signal:AbortSignal) {
    start(sid,program,realm,request,current,signal)
    const completed=await find(sid,program,realm,request.operationId).result
    assertLive(current,signal)
    return completed
  }
  function releaseOwner(current:()=>boolean) {
    for(const [identity,request] of requests)if(request.current===current) {
      if(!request.settled){
        request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'))
        void request.cancelNative?.().catch(()=>{})
      }
      requests.delete(identity)
    }
    for(const [identity,owner] of cancelledOperations)if(owner===current)cancelledOperations.delete(identity)
  }
  return {start,next,completeFilter,cancel,generateRaw,releaseOwner,dispose(){
    closed=true
    for(const request of requests.values()) {
      request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'))
      void request.cancelNative?.().catch(()=>{})
      wake(request)
    }
    requests.clear();generations.clear();cancelledOperations.clear()
  }}
}
