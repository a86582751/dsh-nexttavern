/** Hot callbacks retain real lexical cells. Cold restoration reexecutes the
 * complete source/action journal in the same admitted engine, never values. */
import {recordSha256,stableJson} from './roleplay-data.js'
import {schemaTextSha256} from './tavern-mvu-schema-data.js'
import {TEMPLATE_LIMITS_V1} from './tavern-template-data.mjs'
import {createTavernEjsHost} from './tavern-template-ejs-host.mjs'
import type {TavernEjsHost,TavernEjsHostCapture,TavernEjsPhaseCapture,TavernEjsResource,TavernEjsHostResult}
  from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsCapturedReadRecordV1} from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsConsumer} from './tavern-template-ejs-runtime-types.mjs'

/** Actual component admission supplies this identity. Journal DATA alone is
 * not admission, and no executable dependency path comes from the journal. */
export interface TavernEjsReplayEngine {
  readonly packageName:string
  readonly version:string
  readonly protectedGeneration:string
}
type Action=Parameters<TavernEjsHost['invoke']>[0]
type Invocation=ReturnType<TavernEjsHost['invoke']>
interface RecordedAction {readonly operationId:string;readonly action:Action;readonly result:Invocation;
  readonly reads?:readonly TavernEjsCapturedReadRecordV1[]}
interface RecordedPhase {readonly capture:TavernEjsPhaseCapture|null;readonly actions:readonly RecordedAction[]}
export interface TavernEjsReplayDelta {
  readonly phase:number
  readonly index:number
  readonly capture:TavernEjsPhaseCapture|null
  readonly action:RecordedAction
}
export interface TavernEjsReplayRecord {
  readonly consumer?:TavernEjsConsumer
  readonly schemaVersion:1
  readonly encoding:'ejs-host-full-replay-v1'
  readonly engine:TavernEjsReplayEngine
  readonly capture:TavernEjsHostCapture
  readonly resource:TavernEjsResource
  readonly creation:TavernEjsHostResult
  readonly creationReads?:readonly TavernEjsCapturedReadRecordV1[]
  readonly phases:readonly RecordedPhase[]
}
type Dependencies=Parameters<typeof createTavernEjsHost>[0]
const bytes=(text:string)=>Buffer.byteLength(text,'utf8')
const encode=(value:unknown)=>stableJson(value)!
const limited=(text:string,maximum:number)=>{
  if(bytes(text)>maximum)throw Error('TEMPLATE_INJECTION_RESTORE_LIMIT')
  return text
}
/** Project before cloning, encoding or hashing: context remains the original
 * lexical object, so a later unconsumed context is not part of phase identity. */
const phaseCapture=(input:TavernEjsPhaseCapture):TavernEjsPhaseCapture=>({
  snapshot:input.snapshot,resources:input.resources,macros:input.macros,
  ...(input.helperMessages===undefined?{}:{helperMessages:input.helperMessages}),
  ...(input.currentCharacterReference===undefined?{}:{currentCharacterReference:input.currentCharacterReference}),
  ...(input.initialBinding===undefined?{}:{initialBinding:input.initialBinding}),
  ...(input.ordinaryNamespace===undefined?{}:{ordinaryNamespace:input.ordinaryNamespace}),
  ...(input.ordinaryMessageView===undefined?{}:{ordinaryMessageView:input.ordinaryMessageView}),
  ...(input.namedPromptQueues===undefined?{}:{namedPromptQueues:input.namedPromptQueues}),
  ...(input.presetCatalog===undefined?{}:{presetCatalog:input.presetCatalog}),
  ...(input.worldInfoSettings===undefined?{}:{worldInfoSettings:input.worldInfoSettings}),
})
const actionWire=(operationId:string,actionText:string,resultText:string,reads?:readonly TavernEjsCapturedReadRecordV1[])=>
  `{"operationId":${JSON.stringify(operationId)},"action":${actionText},"result":${resultText}`
    +(reads?.length?`,"reads":${encode(reads)}`:'')+'}'
const phaseWire=(captureText:string)=>`{"capture":${captureText},"actions":[]}`
const skeleton=(engine:TavernEjsReplayEngine,capture:TavernEjsHostCapture,resource:TavernEjsResource,
  creation:TavernEjsHostResult|null,consumer?:TavernEjsConsumer,creationReads?:readonly TavernEjsCapturedReadRecordV1[])=>({schemaVersion:1,encoding:'ejs-host-full-replay-v1',
  ...consumer?{consumer}:{},
  engine,capture,resource,creation,...creationReads?.length?{creationReads}:{},phases:[]})

export function createReplayableTavernEjsHost(deps:Dependencies,engine:TavernEjsReplayEngine,
  input:TavernEjsHostCapture,root:TavernEjsResource,consumer?:TavernEjsConsumer) {
  limited(encode(input),TEMPLATE_LIMITS_V1.workerInputBytes)
  const capture=structuredClone(input),resource={...root},identity={...engine}
  let recordBytes=bytes(limited(encode(skeleton(identity,capture,resource,null,consumer)),
    TEMPLATE_LIMITS_V1.injectionInputBytes))-4 // Replace creation null after render.
  let reads:TavernEjsCapturedReadRecordV1[]=[],expected:readonly TavernEjsCapturedReadRecordV1[]|undefined,readIndex=0
  let readFailure:unknown
  const beginReads=(replay?:readonly TavernEjsCapturedReadRecordV1[])=>{reads=[];expected=replay;readIndex=0;readFailure=undefined}
  const finishReads=()=>{
    if(readFailure)throw readFailure
    if(expected&&readIndex!==expected.length)throw Error('TEMPLATE_REPLAY_READ_CHANGED')
    expected=undefined;return reads
  }
  const host=createTavernEjsHost({...deps,readCaptured(request){
    let result:import('./tavern-template-ejs-host-types.mjs').TavernEjsCapturedReadResultV1
    if(expected) {
      const row=expected[readIndex++]
      if(!row||row.schemaVersion!==1||row.encoding!=='ejs-captured-read-v1'
        ||encode(row.request)!==encode(request)){
        readFailure=Error('TEMPLATE_REPLAY_READ_CHANGED');throw readFailure
      }
      result=row.result
    }else {
      try {
        if(!deps.readCaptured)throw Error('TEMPLATE_CAPTURED_READ_UNAVAILABLE')
        result=deps.readCaptured(request)
      }catch(error){readFailure=error;throw error}
    }
    // The read owner and a cold replay record remain caller-owned. Detach once
    // here, then share this internal capture with the host and this action.
    const owned=structuredClone(result)
    reads.push({schemaVersion:1,encoding:'ejs-captured-read-v1',request:structuredClone(request),result:owned})
    return owned
  }},capture,consumer)
  let creationReads:readonly TavernEjsCapturedReadRecordV1[]=[]
  let creation:TavernEjsHostResult|undefined,closed=false
  const phases:{capture:TavernEjsPhaseCapture|null;actions:RecordedAction[]}[]=[]
  const operations=new Map<string,{signature:string;result:Invocation;phase:number;index:number}>()
  const refusal=(code:string):Extract<Invocation,{kind:'refused'}>=>
    ({kind:'refused',diagnostic:{code,sourcePointer:resource.sourcePointer}})
  const close=()=>{closed=true;host.dispose()}
  const admitBytes=(amount:number)=>{
    if(recordBytes+amount>TEMPLATE_LIMITS_V1.injectionInputBytes)throw Error('TEMPLATE_INJECTION_RESTORE_LIMIT')
  }
  return {
    prepare(replayReads?:readonly TavernEjsCapturedReadRecordV1[]):TavernEjsHostResult {
      if(closed)return refusal('TEMPLATE_DISPOSED')
      if(creation)return structuredClone(creation)
      try {
        beginReads(replayReads)
        const result=host.render(resource),capturedReads=finishReads(),size=bytes(encode(result)),
          readBytes=capturedReads.length?bytes(',"creationReads":'+encode(capturedReads)):0
        admitBytes(size+readBytes)
        creationReads=capturedReads
        creation=result;recordBytes+=size+readBytes
        return structuredClone(creation)
      }catch {
        close();if(readFailure)throw readFailure
        return refusal('TEMPLATE_INJECTION_RESTORE_LIMIT')
      }
    },
    invoke(operationId:string,action:Action,nextCapture?:TavernEjsPhaseCapture,
      replayReads?:readonly TavernEjsCapturedReadRecordV1[]):Invocation {
      if(closed)return refusal('TEMPLATE_DISPOSED')
      if(!creation||creation.kind!=='rendered')return refusal('TEMPLATE_CREATION_REQUIRED')
      try {
        const projected=nextCapture?phaseCapture(nextCapture):null
        const captureText=projected?limited(encode(projected),TEMPLATE_LIMITS_V1.workerInputBytes):'null'
        const actionText=encode(action)
        const signature=schemaTextSha256(`{"action":${actionText},"capture":${captureText}}`)
        const previous=operations.get(operationId)
        if(previous)return previous.signature===signature?structuredClone(previous.result):
          refusal('TEMPLATE_INJECTION_OPERATION_CHANGED')
        // Each new capture starts a phase. The actual serialized replay
        // budget bounds history without expiring small long-lived closures.
        const newPhase=projected!==null||!phases.length
        const previousPhase=newPhase?undefined:phases[phases.length-1]!
        if(previousPhase&&previousPhase.actions.length>=TEMPLATE_LIMITS_V1.injectionScheduleActions)
          return refusal('TEMPLATE_INJECTION_RESTORE_LIMIT')
        const phaseBytes=newPhase?bytes(phaseWire(captureText))+(phases.length?1:0):0
        const comma=previousPhase?.actions.length?1:0
        // Reserve known input before execution; charge output afterwards. If
        // the result cannot be recorded, dispose the unjournaled live cells.
        admitBytes(phaseBytes+comma+bytes(actionWire(operationId,actionText,'null')))
        const frame=projected?structuredClone(projected):null,savedAction=structuredClone(action)
        beginReads(replayReads)
        const result=host.invoke(savedAction,frame??undefined),capturedReads=finishReads()
        const resultText=encode(result),rowBytes=bytes(actionWire(operationId,actionText,resultText,capturedReads))
        admitBytes(phaseBytes+comma+rowBytes)
        const savedResult=result
        const phase=previousPhase??{capture:frame,actions:[]}
        phase.actions.push({operationId,action:savedAction,result:savedResult,
          ...capturedReads.length?{reads:capturedReads}:{}})
        if(newPhase)phases.push(phase)
        recordBytes+=phaseBytes+comma+rowBytes
        operations.set(operationId,{signature,result:savedResult,phase:phases.length-1,index:phase.actions.length-1})
        return structuredClone(savedResult)
      }catch {
        close();if(readFailure)throw readFailure
        return refusal('TEMPLATE_INJECTION_RESTORE_LIMIT')
      }
    },
    delta(operationId:string):TavernEjsReplayDelta|undefined {
      const location=operations.get(operationId)
      if(!location)return undefined
      const phase=phases[location.phase]!
      return structuredClone({phase:location.phase,index:location.index,
        capture:location.index===0?phase.capture:null,action:phase.actions[location.index]!})
    },
    creationReads:()=>structuredClone(creationReads),
    record():TavernEjsReplayRecord {
      if(!creation)throw Error('TEMPLATE_CREATION_REQUIRED')
      return structuredClone({...skeleton(identity,capture,resource,creation,consumer,creationReads),phases}) as TavernEjsReplayRecord
    },dispose:close,
  }
}

export function restoreReplayableTavernEjsHost(deps:Dependencies,engine:TavernEjsReplayEngine,
  record:TavernEjsReplayRecord):ReturnType<typeof createReplayableTavernEjsHost> {
  const deadline=performance.now()+TEMPLATE_LIMITS_V1.parentDeadlineMs
  const checkpoint=()=>{if(performance.now()>=deadline)throw Error('TEMPLATE_REPLAY_TIMEOUT')}
  if(record.schemaVersion!==1||record.encoding!=='ejs-host-full-replay-v1'
    ||recordSha256(record.engine)!==recordSha256(engine))throw Error('TEMPLATE_REPLAY_ENGINE_CHANGED')
  // Creation/invoke own the per-capture input bound. This pass accounts the
  // whole journal before replay, without checking those same bounds again.
  let total=bytes(encode(skeleton(record.engine,record.capture,record.resource,record.creation,record.consumer,record.creationReads)))
  const admitted:{capture:TavernEjsPhaseCapture|null;actions:readonly RecordedAction[];hashes:string[]}[]=[]
  for(const phase of record.phases){
    checkpoint()
    if(phase.actions.length>TEMPLATE_LIMITS_V1.injectionScheduleActions)
      throw Error('TEMPLATE_INJECTION_RESTORE_LIMIT')
    const capture=phase.capture?phaseCapture(phase.capture):null
    const captureText=capture?encode(capture):'null'
    total+=bytes(phaseWire(captureText))+(admitted.length?1:0)
    const hashes:string[]=[]
    for(let index=0;index<phase.actions.length;index++){
      const row=phase.actions[index]!,resultText=encode(row.result)
      total+=bytes(actionWire(row.operationId,encode(row.action),resultText,row.reads))+(index?1:0)
      if(total>TEMPLATE_LIMITS_V1.injectionInputBytes)throw Error('TEMPLATE_INJECTION_RESTORE_LIMIT')
      hashes.push(schemaTextSha256(resultText));checkpoint()
    }
    admitted.push({capture,actions:phase.actions,hashes})
  }
  if(total>TEMPLATE_LIMITS_V1.injectionInputBytes)throw Error('TEMPLATE_INJECTION_RESTORE_LIMIT')
  const creationHash=schemaTextSha256(encode(record.creation))
  checkpoint()
  // Whole-cold cooperative deadline; each VM action retains its own bound.
  // Hard interruption of Node work belongs to the actual asset worker owner.
  const session=createReplayableTavernEjsHost(deps,engine,record.capture,record.resource,record.consumer)
  try {
    checkpoint()
    if(recordSha256(session.prepare(record.creationReads??[]))!==creationHash)throw Error('TEMPLATE_REPLAY_CREATION_CHANGED')
    checkpoint()
    for(const phase of admitted){
      for(let index=0;index<phase.actions.length;index++){
        checkpoint()
        const row=phase.actions[index]!
        const actual=session.invoke(row.operationId,row.action,index===0?phase.capture??undefined:undefined,row.reads??[])
        if(recordSha256(actual)!==phase.hashes[index])throw Error('TEMPLATE_REPLAY_ACTION_CHANGED')
        checkpoint()
      }
    }
    return session
  }catch(error){session.dispose();throw error}
}
