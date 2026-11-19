/** One Core preparation retains actual guest packets across pricing passes.
 * Source permissions and accepted publication remain with the calling owner. */
import {recordSha256} from './roleplay-data.js'
import type {createRoleplayTavernEjsPrograms,TavernEjsProgramInvocation} from './roleplay-tavern-ejs-programs.js'
import type {TavernPromptEjsExecutionV1} from './roleplay-tavern-prompt-render.js'
import type {TavernEjsRuntimeInvocation,TavernEjsRuntimeInput}
  from './tavern-template-ejs-runtime-types.mjs'
import type {TavernEjsReplayRecord} from './tavern-template-ejs-replay.mjs'
import type {TavernEjsHostCapture,TavernEjsHostOutput,TavernEjsResource,TavernEjsHostAction}
  from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsNamedPromptQueuesV1} from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsCapturedReadOwnerV1} from './tavern-template-ejs-host-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernPromptTransformInputV1} from './tavern-prompt-transform-types.mjs'
import type {TavernTemplateFrozenSnapshotV1,TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import {applyAuthorVariableWritesV1} from './roleplay-author-variable-effects.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {TavernPromptMacroSnapshotV1} from './tavern-prompt-transform-types.mjs'
import type {TavernOrdinaryPreparationStage} from './roleplay-tavern-ordinary-stage.js'
import type {TavernSharedScopePreparationStageV1} from './roleplay-tavern-shared-scope-stage.js'
import type {AcceptedAuthorChatWriteV3} from './roleplay-author-chat-state-types.js'

export interface TavernEjsPreparationIdentity {
  readonly preparationId:string
  readonly attemptGeneration:string
  readonly scriptIdentity:string
  readonly sourceSnapshotSha256:string
}

export type TavernEjsReadSupplierV1=(capture:TavernEjsHostCapture)=>TavernEjsCapturedReadOwnerV1
export type TavernEjsReadSupplierFactoryV1=(input:{
  readonly sessionId:string
  readonly source:TavernLoreSourceDataV1
  readonly rules:TavernPromptTransformInputV1['rules']
  readonly scriptOrder?:TavernPromptTransformInputV1['scriptOrder']
  readonly currentCharacter?:import('./tavern-template-ejs-host-types.mjs').TavernEjsCurrentCharacterSupplierV1
  assertCurrent():void
})=>TavernEjsReadSupplierV1

export type TavernEjsPreparationInvocation=Pick<TavernEjsProgramInvocation,
  'programInstanceId'|'creation'|'journalCut'|'head'|'operationId'|'nativeDisposals'> & {
  readonly action:Exclude<TavernEjsHostAction,{readonly kind:'dispose'}>
  readonly snapshot:TavernTemplateFrozenSnapshotV1
  readonly macros:TavernPromptMacroSnapshotV1
  readonly consumer:'scan'|'chat'|'generate'|'message-before'|'message-after'|'message-html'
}
interface Dependencies {
  readonly identity:TavernEjsPreparationIdentity
  readonly programs:ReturnType<typeof createRoleplayTavernEjsPrograms>
  readonly context:TavernEjsHostCapture['context']
  readonly worldInfoSettings?:TavernEjsHostCapture['worldInfoSettings']
  readonly resources?:(snapshot:TavernTemplateFrozenSnapshotV1)=>readonly TavernEjsResource[]
  readonly assertCurrent:()=>void
  readonly signal:AbortSignal
}
type Packet={readonly sha256:string;readonly result:Promise<unknown>}
type Output=TavernEjsHostOutput|Omit<TavernEjsHostOutput,'renderedText'>

export function createRoleplayTavernEjsPreparation(deps:Dependencies) {
  const packets:Packet[]=[],creationIds=new WeakMap<TavernEjsReplayRecord,string>(),programIds=new Set<string>()
  let activePlan=0
  const checkpoint=()=>{deps.signal.throwIfAborted();deps.assertCurrent()}
  return {retire(){
    // A discarded pricing pass cannot leave an unpublished advanced realm
    // available to the next cut. Published journal DATA restores it as needed.
    for(const id of programIds)deps.programs.retire(id)
    programIds.clear()
  },beginPlan(ordinary:TavernOrdinaryPreparationStage,options?:{
    shared?:TavernSharedScopePreparationStageV1
    namedQueues?:()=>TavernEjsNamedPromptQueuesV1
    ordinaryMessageView?:()=>TavernEjsHostCapture['ordinaryMessageView']|Promise<TavernEjsHostCapture['ordinaryMessageView']>
    presetCatalog?:()=>TavernEjsHostCapture['presetCatalog']
    helperMessages?:()=>TavernEjsHostCapture['helperMessages']
    currentCharacterReference?:TavernEjsHostCapture['currentCharacterReference']
    generationModel?:()=>TavernEjsHostCapture['generationModel']
    readCaptured?:TavernEjsReadSupplierV1
  }){
    const token=++activePlan
    let cursor=0,finalized=false
    let initialBinding:TavernTemplateScopeBindingV1|undefined
    const current=()=>{
      checkpoint()
      if(token!==activePlan)throw Error('TEMPLATE_EJS_PREPARATION_PLAN_REPLACED')
    }
    const capture=async(snapshot:TavernTemplateFrozenSnapshotV1,macros:TavernPromptMacroSnapshotV1)=>{
      const ordinaryMessageView=await options?.ordinaryMessageView?.(),presetCatalog=options?.presetCatalog?.(),
        helperMessages=options?.helperMessages?.(),
        generationModel=options?.generationModel?.()
      if(!initialBinding)initialBinding=snapshot.scopes.find(row=>row.scope==='initial')
      return {snapshot,macros:options?.shared?.macros(macros)??macros,
      ...initialBinding?{initialBinding}:{},
      resources:deps.resources?.(snapshot)??[],context:deps.context,
      ...deps.worldInfoSettings?{worldInfoSettings:deps.worldInfoSettings}:{},
      ...options?.namedQueues?{namedPromptQueues:options.namedQueues()}:{},
      ...ordinaryMessageView?{ordinaryMessageView}:{},
      ...presetCatalog?{presetCatalog}:{},
      ...helperMessages?{helperMessages}:{},
      ...options?.currentCharacterReference?{currentCharacterReference:options.currentCharacterReference}:{},
      ...generationModel?{generationModel}:{},
      ordinaryNamespace:{root:ordinary.initialRoot,values:ordinary.values}}
    }
    async function memo<T>(input:unknown,run:()=>Promise<T>):Promise<T> {
      current()
      if(finalized)throw Error('TEMPLATE_EJS_PREPARATION_FINALIZED')
      const sha256=recordSha256(input),prior=packets[cursor++]
      if(prior&&prior.sha256!==sha256)throw Error('TEMPLATE_EJS_PREPARATION_PACKET_CHANGED')
      const packet=prior??{sha256,result:Promise.resolve().then(run)}
      if(!prior)packets.push(packet)
      const result=await packet.result as T
      current()
      return result
    }
    const stage=(output:Output)=>{
      const ordinaryWrites:TavernEjsHostOutput['ordinaryWrites'][number][]=[],sharedWrites:AcceptedAuthorChatWriteV3[]=[],
        initialWrites:AcceptedAuthorChatWriteV3[]=[]
      for(const effect of output.ordinaryWrites) {
        if(effect.scope==='global'||effect.scope==='initial') {
          const writes=effect.scope==='global'?sharedWrites:initialWrites
          writes.push(effect.operation==='delete'?{key:effect.key,operation:'delete'}
            :{key:effect.key,operation:'set',value:effect.value})
        }else ordinaryWrites.push(effect)
      }
      if(initialWrites.length) {
        if(!initialBinding)throw Error('TEMPLATE_SCOPE_UNAVAILABLE')
        const values:MvuJsonObject={...initialBinding.values}
        for(const write of initialWrites) {
          const result=applyAuthorVariableWritesV1({exists:Object.hasOwn(values,write.key),value:values[write.key]??null},[write])
          if(result.exists)values[write.key]=result.value
          else delete values[write.key]
        }
        initialBinding={...initialBinding,values,valuesSha256:recordSha256(values),
          versionSha256:recordSha256({previous:initialBinding.versionSha256,writes:initialWrites})}
      }
      // Guest execution already fixed cross-scope reads. Independent stage
      // owners can fold each target's ordered packet once without rescanning.
      ordinary.applyEffects(ordinaryWrites)
      if(sharedWrites.length) {
        if(!options?.shared)throw Error('TEMPLATE_SHARED_SCOPE_UNAVAILABLE')
        options.shared.apply(sharedWrites)
      }
    }
    return {
      get hasPackets(){return cursor>0},
      getInitialValues(base:TavernTemplateScopeBindingV1):Readonly<MvuJsonObject> {
        current()
        initialBinding??=base
        return initialBinding.values
      },
      bindInitial(binding:TavernTemplateScopeBindingV1):void {
        current()
        initialBinding=binding
      },
      macros:(base:TavernPromptMacroSnapshotV1)=>options?.shared?.macros(ordinary.macros(base))??ordinary.macros(base),
      async execute(input:TavernPromptEjsExecutionV1):Promise<TavernEjsReplayRecord> {
        const ordinal=cursor,programInstanceId='ejs-program-'+recordSha256({identity:deps.identity,
          ordinal,definition:input.definition}),runtimeInput:TavernEjsRuntimeInput={
          capture:{...await capture(input.snapshot,input.macros),
            ...input.context?{context:{...deps.context,...input.context}}:{}},resource:input.resource}
        programIds.add(programInstanceId)
        const record=await memo({kind:'creation',input,runtimeInput},async()=>{
          const result=await deps.programs.prepare(programInstanceId,runtimeInput,
            deps.identity.attemptGeneration,deps.signal,options?.readCaptured?.(runtimeInput.capture))
          const record=result.creation
          if(record.creation.kind!=='rendered'||!record.creation.output.injections.length
            &&!record.creation.output.regexEffects?.length)
            deps.programs.retire(programInstanceId)
          return record
        })
        creationIds.set(record,programInstanceId)
        if(record.creation.kind==='rendered')stage(record.creation.output)
        return record
      },
      creationId(record:TavernEjsReplayRecord):string {
        const id=creationIds.get(record)
        if(!id)throw Error('TEMPLATE_EJS_PREPARATION_CREATION_MISSING')
        return id
      },
      async invoke(input:TavernEjsPreparationInvocation):Promise<{invocations:readonly TavernEjsRuntimeInvocation[]}> {
        programIds.add(input.programInstanceId)
        const {context:_context,generationModel:_generationModel,...phaseCapture}=await capture(input.snapshot,input.macros)
        const {snapshot:_snapshot,macros:_macros,consumer,...basis}=input
        const request:TavernEjsProgramInvocation={...basis,generationId:deps.identity.attemptGeneration,
          capture:phaseCapture,signal:deps.signal,
          ...options?.readCaptured?{readCaptured:options.readCaptured({context:deps.context,...phaseCapture})}:{}}
        const {signal:_signal,readCaptured:_readCaptured,...requestData}=request
        const result=await memo({kind:'invocation',consumer,request:requestData},
          ()=>deps.programs.invoke(request))
        for(const invocation of result.invocations) {
          if(invocation.result.kind!=='evaluated')throw Error(invocation.result.diagnostic.code)
          if(!invocation.delta)throw Error('INPUT_MATERIAL_INJECTION_EJS_DELTA_MISSING')
          stage(invocation.result.output)
        }
        return result
      },
      finish() {
        current()
        if(cursor!==packets.length)throw Error('TEMPLATE_EJS_PREPARATION_PACKET_CHANGED')
        finalized=true
        return {identity:deps.identity,packets:packets.map(packet=>packet.sha256)}
      },
    }
  }}
}
