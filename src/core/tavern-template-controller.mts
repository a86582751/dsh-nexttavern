import {Worker} from 'node:worker_threads'
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData} from './tavern-mvu-schema-data.js'
import {validateInjectionRestoreV1,validateInjectionReceiptV1,injectionCreationHeadV1}
  from './tavern-template-injection-data.mjs'
import {validateTemplateRequestV1,validateTemplateOutputV1,TemplateRefusalV1,TEMPLATE_LIMITS_V1,
  freezeTemplateData,templateExact,cloneTemplateEnvelopeV1} from './tavern-template-data.mjs'
import type {TavernTemplateRuntimeV1,TavernTemplateEngineIdentityV1,TavernTemplateOwnedInventoryV1,
  TavernTemplateResultV1,TavernTemplateRequestV1,TavernTemplateDiagnosticV1,
  TavernTemplateWorkerResponseV1,TavernTemplateInjectionRestoreV1,TavernTemplateInjectionResultV1,
  TavernTemplateInjectionReceiptV1} from './tavern-template-types.mjs'

type Failure=Extract<TavernTemplateResultV1,{kind:'refused'|'cancelled'}>
type WorkerOutcome=TavernTemplateWorkerResponseV1|Failure
  |{kind:'injection-evaluated';receipt:TavernTemplateInjectionReceiptV1}
const failed=(code:string,pointer:string|null=null,limit:TavernTemplateDiagnosticV1['limit']=null):Failure=>
  freezeTemplateData({kind:'refused',diagnostics:[{schemaVersion:1,code,sourcePointer:pointer,limit}]})
const cancelled=():Failure=>freezeTemplateData({kind:'cancelled',diagnostics:[{
  schemaVersion:1,code:'TEMPLATE_CANCELLED',sourcePointer:null,limit:null}]})
const diagnostic=(error:unknown,fallback:string):Failure=>error instanceof TemplateRefusalV1
  ?freezeTemplateData({kind:'refused',diagnostics:[error.diagnostic]}):failed(fallback)

/** Internal component module, deliberately absent from public package exports.
 * No configurable Worker constructor, URLs, loader or transport callback. */
export function createOwnedTemplateControllerV1(deps:{engine:TavernTemplateEngineIdentityV1;
  inventory:TavernTemplateOwnedInventoryV1;current():TavernTemplateOwnedInventoryV1;
  assertExecutionAllowed():void}):TavernTemplateRuntimeV1 {
  const workerURL=new URL('./tavern-template-worker.mjs',import.meta.url)
  const identity=freezeTemplateData(cloneSchemaData(deps.engine,4096))
  let disposed=false,disposing:Promise<void>|undefined
  const active=new Map<Worker,{finish():void;closed:Promise<void>}>()
  const preflight=(signal?:AbortSignal):Failure|undefined=>{
    if(signal?.aborted)return cancelled()
    if(disposed)return failed('TEMPLATE_DISPOSED')
    try {deps.assertExecutionAllowed()}catch(error) {return diagnostic(error,'TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')}
    if(active.size>=4)return failed('TEMPLATE_BUSY')
  }
  async function execute(request:TavernTemplateRequestV1,signal?:AbortSignal,restoration?:TavernTemplateInjectionRestoreV1,
    operationStarted=performance.now())
    :Promise<WorkerOutcome> {
    const blocked=preflight(signal)
    if(blocked)return blocked
    if(performance.now()-operationStarted>=TEMPLATE_LIMITS_V1.parentDeadlineMs)return failed('TEMPLATE_PARENT_TIMEOUT',
      request.source.pointer,{field:'parentDeadlineMs',observed:TEMPLATE_LIMITS_V1.parentDeadlineMs,
        maximum:TEMPLATE_LIMITS_V1.parentDeadlineMs})
    let worker:Worker
    try {
      const inventory=deps.current()
      if(inventory.generation!==deps.inventory.generation)throw Error()
      const workerData=cloneTemplateEnvelopeV1({request,engine:identity,inventory,
        ...restoration?{restore:{programInstanceId:restoration.programInstanceId,phaseCount:restoration.journal.length+1}}:{}},
        {bytes:'workerInputBytes',nodes:'workerInputNodes',depth:'workerInputDepth'})
      worker=new Worker(workerURL,{workerData,env:{TZ:'UTC'},execArgv:[],
        resourceLimits:{maxOldGenerationSizeMb:64,stackSizeMb:2}})
    } catch(error) {return diagnostic(error,'TEMPLATE_WORKER_UNAVAILABLE')}
    const closed=Promise.withResolvers<void>()
    const outcome=async()=>{try {
      return await new Promise<WorkerOutcome>(resolve=>{
        let settled=false
        let expectedSequence=0,head=restoration?injectionCreationHeadV1(restoration.programInstanceId,request,
          restoration.creation.expectedOutput):''
        const finish=(value:WorkerOutcome)=>{
          if(settled)return
          settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort)
          resolve(value)
        }
        const abort=()=>finish(cancelled())
        const timer=setTimeout(()=>finish(failed('TEMPLATE_PARENT_TIMEOUT',request.source.pointer,
          {field:'parentDeadlineMs',observed:TEMPLATE_LIMITS_V1.parentDeadlineMs,maximum:TEMPLATE_LIMITS_V1.parentDeadlineMs})),
        Math.max(0,TEMPLATE_LIMITS_V1.parentDeadlineMs-(performance.now()-operationStarted)))
        active.set(worker,{finish:()=>finish(failed('TEMPLATE_DISPOSED')),closed:closed.promise})
        signal?.addEventListener('abort',abort,{once:true})
        worker.on('message',(raw:unknown)=>{
          if(settled)return
          try {
            const message=cloneTemplateEnvelopeV1(raw,
              {bytes:'injectionReceiptBytes',nodes:'injectionReceiptNodes',depth:'injectionReceiptDepth'}) as Record<string,unknown>
            if(!message||typeof message!=='object'||Array.isArray(message))throw Error()
            if('kind' in message&&message.kind==='phase-result') {
              if(!restoration)throw Error()
              const sequence=expectedSequence
              if(sequence===0) {
                templateExact(message,['kind','sequence','output'])
                if(message.sequence!==0)throw Error()
                const actual=validateTemplateOutputV1(message.output,request,identity)
                if(recordSha256(actual)!==recordSha256(restoration.creation.expectedOutput)) {
                  finish(failed('TEMPLATE_INJECTION_CREATION_MISMATCH',request.source.pointer));return
                }
              }else {
                templateExact(message,['kind','sequence','receipt'])
                const old=restoration.journal[sequence-1]
                if(message.sequence!==sequence||!old)throw Error()
                const actual=validateInjectionReceiptV1(message.receipt,restoration.programInstanceId,head,
                  old.phase,request,identity)
                if(recordSha256(actual)!==recordSha256(old.expectedReceipt)) {
                  finish(failed('TEMPLATE_INJECTION_REPLAY_MISMATCH',request.source.pointer));return
                }
                head=actual.receiptSha256
              }
              const next=restoration.journal[sequence]?.phase??restoration.current
              // Only this controller advances the private protocol. The worker
              // reached a quiescent boundary; no guest-controlled Host RPC.
              const inventory=deps.current()
              if(inventory.generation!==deps.inventory.generation)throw Error()
              const packet=cloneTemplateEnvelopeV1({kind:'phase',sequence:sequence+1,phase:next},
                {bytes:'workerInputBytes',nodes:'workerInputNodes',depth:'workerInputDepth'})
              expectedSequence++
              worker.postMessage(packet)
            }else if('kind' in message&&message.kind==='injection-evaluated') {
              templateExact(message,['kind','receipt'])
              if(!restoration||expectedSequence!==restoration.journal.length+1||head!==restoration.expectedHeadSha256)throw Error()
              finish({kind:'injection-evaluated',receipt:validateInjectionReceiptV1(message.receipt,
                restoration.programInstanceId,head,restoration.current,request,identity)})
            }else if('kind' in message&&message.kind==='rendered') {
              if(restoration)throw Error()
              templateExact(message,['kind','output'])
              finish({kind:'rendered',output:validateTemplateOutputV1(message.output,request,identity)})
            } else {
              templateExact(message,['kind','diagnostic'])
              if(message.kind!=='refused')throw Error()
              templateExact(message.diagnostic,['schemaVersion','code','sourcePointer','limit'])
              const item=message.diagnostic
              if(item.schemaVersion!==1||typeof item.code!=='string'||!/^TEMPLATE_[A-Z_]+$/.test(item.code)
                ||item.sourcePointer!==request.source.pointer&&item.sourcePointer!==null
                  &&!request.snapshot.lore.some(row=>row.sourcePointer===item.sourcePointer)
                  &&!restoration?.current.snapshot.lore.some(row=>row.sourcePointer===item.sourcePointer)
                  &&!restoration?.journal.some(row=>row.phase.snapshot.lore.some(binding=>binding.sourcePointer===item.sourcePointer)))throw Error()
              if(item.limit!==null) {
                templateExact(item.limit,['field','observed','maximum'])
                if(typeof item.limit.field!=='string'||!Object.hasOwn(TEMPLATE_LIMITS_V1,item.limit.field)
                  ||item.limit.maximum!==TEMPLATE_LIMITS_V1[item.limit.field as keyof typeof TEMPLATE_LIMITS_V1]
                  ||item.limit.observed!==null&&(typeof item.limit.observed!=='number'
                    ||!Number.isFinite(item.limit.observed)||item.limit.observed<0))throw Error()
              }
              finish({kind:'refused',diagnostic:item as unknown as TavernTemplateDiagnosticV1})
            }
          }catch(error) {finish(diagnostic(error,'TEMPLATE_WORKER_OUTPUT_INVALID'))}
        })
        worker.once('error',()=>finish(failed('TEMPLATE_WORKER_ERROR')))
        worker.once('exit',()=>finish(failed('TEMPLATE_WORKER_EXIT')))
        if(signal?.aborted)abort()
        if(disposed)finish(failed('TEMPLATE_DISPOSED'))
      })
    } finally {
      // A received result remains unusable until the actual worker terminates.
      // Cancellation/disposal during termination overrides an earlier message.
      try {await worker.terminate()}finally {active.delete(worker);closed.resolve()}
    }}
    const result=await outcome().catch(()=>failed('TEMPLATE_WORKER_CLEANUP'))
    if(signal?.aborted)return cancelled()
    if(disposed)return failed('TEMPLATE_DISPOSED')
    try {deps.current()}catch(error) {return diagnostic(error,'TEMPLATE_ADMISSION_CHANGED')}
    return result
  }
  async function render(raw:unknown,signal?:AbortSignal):Promise<TavernTemplateResultV1> {
    const blocked=preflight(signal)
    if(blocked)return blocked
    let request:TavernTemplateRequestV1
    try {request=validateTemplateRequestV1(raw)}catch(error) {return diagnostic(error,'TEMPLATE_INPUT_INVALID')}
    const result=await execute(request,signal)
    if(signal?.aborted)return cancelled()
    if(disposed)return failed('TEMPLATE_DISPOSED')
    if('diagnostics' in result)return result
    if(result.kind==='refused')return freezeTemplateData({kind:'refused',diagnostics:[result.diagnostic]})
    if(result.kind!=='rendered')return failed('TEMPLATE_WORKER_OUTPUT_INVALID')
    return freezeTemplateData({kind:'rendered',output:result.output})
  }
  return {identity,render,
    async restoreAndEvaluateInjectionsV1(raw,signal):Promise<TavernTemplateInjectionResultV1> {
      const operationStarted=performance.now()
      const blocked=preflight(signal)
      if(blocked)return blocked
      let restoration:TavernTemplateInjectionRestoreV1
      try {restoration=validateInjectionRestoreV1(raw,identity)}catch(error) {
        return diagnostic(error,'TEMPLATE_INJECTION_INPUT_INVALID')
      }
      const result=await execute(restoration.creation.request,signal,restoration,operationStarted)
      if(signal?.aborted)return cancelled()
      if(disposed)return failed('TEMPLATE_DISPOSED')
      if('diagnostics' in result)return result
      if(result.kind==='refused')return freezeTemplateData({kind:'refused',diagnostics:[result.diagnostic]})
      if(result.kind!=='injection-evaluated')return failed('TEMPLATE_INJECTION_PROTOCOL')
      return freezeTemplateData({kind:'evaluated',receipt:result.receipt})
    },
    async verify(input,output,signal) {
      if(preflight(signal))return false
      try {
        const request=validateTemplateRequestV1(input),stored=validateTemplateOutputV1(output,request,identity)
        const replay=await render(request,signal)
        return !disposed&&!signal?.aborted&&replay.kind==='rendered'&&recordSha256(replay.output)===recordSha256(stored)
      }catch {return false}
    },
    dispose() {
      disposed=true
      for(const pending of active.values())pending.finish()
      return disposing??=Promise.all([...active.values()].map(pending=>pending.closed)).then(()=>undefined)
    },
  }
}
