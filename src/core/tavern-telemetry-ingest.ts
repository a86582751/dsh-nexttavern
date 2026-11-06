import {createHash} from 'node:crypto'
import type {DomainChanged} from '@deepseek-ai/dsh-storage-domain'
import {sessionHistoryCut} from './session-history.js'
import {createSessionCallFold, type TelemetryEvent} from './tavern-telemetry-fold.js'
import {failureText, safeTelemetryId, type TelemetryCallRecord} from './tavern-telemetry-normalize.js'
import type {LogRecord, RuntimeSession, StoredCall, TelemetryJob, TelemetryTable} from './tavern-telemetry.js'

export const TELEMETRY_USAGE_PREFIX='tavern_usage__', TELEMETRY_LOG_PREFIX='tavern_log__', TELEMETRY_META_PREFIX='tavern_usage_session__'
const USAGE=TELEMETRY_USAGE_PREFIX, LOG=TELEMETRY_LOG_PREFIX, META=TELEMETRY_META_PREFIX
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
type Start=TelemetryCallRecord['source']['startSeq']
type Turn=TelemetryCallRecord['source']['turn']
type Step=TelemetryCallRecord['source']['step']
interface Operation {event:TelemetryEvent; start?:TelemetryEvent}
interface Member {order:number; session?:string; start?:Start; stream:boolean; child?:string; jobId?:string; jobOwner?:string}
interface NativeState {
  id:string
  processed:number
  fold:ReturnType<typeof createSessionCallFold>
  byId:Map<string,TelemetryCallRecord>
  byStart:Map<Start,Set<TelemetryCallRecord>>
  lastByTurn:Map<Turn,TelemetryCallRecord>
  lastByStep:Map<Turn,Map<Step,TelemetryCallRecord>>
  operations:Map<number,Operation>
  turnOperations:Map<Turn,Set<number>>
  stepOperations:Map<Turn,Map<Step,Set<number>>>
  toolStarts:Map<unknown,TelemetryEvent>
  dirty:Map<string,number>
  dirtyOperations:Map<number,number>
  ownerSessionId:string|null
  jobsDirty:boolean
  associationKeys:Set<string>
  metaDirty:boolean
  selectedPreset?:string
  boundary?:TelemetryEvent
  message?:TelemetryEvent
  title?:unknown
}
interface Dependencies {
  table:TelemetryTable
  domainRecords?:{observe(listener:(change:DomainChanged)=>void):()=>void;jobPrefixes:readonly string[]}
  isTelemetryJob(value:unknown):value is TelemetryJob
  active:ReadonlySet<string>
  owner(session:RuntimeSession):string|null
  meta(session:RuntimeSession):unknown
  headerPreset(session:RuntimeSession):string|undefined
  eligible(session:RuntimeSession,preset:string|undefined):boolean
}
function bump<K>(pending:Map<K,number>,key:K) {pending.set(key,(pending.get(key)??0)+1)}
function add<K,V>(index:Map<K,Set<V>>,key:K,value:V) {
  let group=index.get(key)
  if(!group){group=new Set();index.set(key,group)}
  group.add(value)
}
function remove<K,V>(index:Map<K,Set<V>>,key:K,value:V) {
  const group=index.get(key)
  if(group?.delete(value)&&!group.size)index.delete(key)
}

/** The actual Domain feed owns row membership; accepted Native owners own
 * append cursors. Neither is a current permission or a durability receipt. */
export function createTelemetryIngest(deps:Dependencies) {
  const {table}=deps
  const enabled=Boolean(deps.domainRecords&&table.entriesPrefix)
  const persisted=new Map<string,string>(), revisions=new Map<string,number>()
  const inFlight=new Map<string,string>()
  const members=new Map<string,Member>()
  const streams=new Map<string,Map<Start,Set<string>>>(), jobChildren=new Map<string,Set<string>>()
  const states=new WeakMap<object,NativeState>(), currentStates=new Map<string,WeakRef<NativeState>>()
  const outputs=new Map<string,{state:WeakRef<NativeState>;operation?:number}>()
  const currentState=(id:string)=>currentStates.get(id)?.deref()
  let indexed=false, ordinal=0
  const jobPrefixes=deps.domainRecords?.jobPrefixes??[]
  const relevant=(key:string)=>key.startsWith(USAGE)||jobPrefixes.some(prefix=>key.startsWith(prefix))
  function dirtyStart(session:string|undefined,start:Start) {
    if(!session)return
    const state=currentState(session)
    for(const call of state?.byStart.get(start)??[])bump(state!.dirty,call.id)
  }
  function index(key:string,value:unknown,external:boolean) {
    const previous=members.get(key)
    if(previous?.stream) {
      const session=streams.get(previous.session!)
      if(session){remove(session,previous.start,key);if(!session.size)streams.delete(previous.session!)}
    }
    if(previous?.child)remove(jobChildren,previous.child,key)
    const row=value as StoredCall|undefined
    const job=deps.isTelemetryJob(value)?value:undefined
    const member:Member={order:previous?.order??ordinal++,stream:false}
    if(key.startsWith(USAGE)&&row) {
      member.session=typeof row.sessionId==='string'?row.sessionId:undefined
      member.start=row.source?.startSeq
      member.stream=!row.superseded&&row.source?.kind==='stream'
      if(member.stream&&member.session) {
        let session=streams.get(member.session)
        if(!session){session=new Map();streams.set(member.session,session)}
        add(session,member.start,key)
      }
    }
    if(job&&jobPrefixes.some(prefix=>key.startsWith(prefix))&&job.childSessionId) {
      member.child=job.childSessionId
      member.jobId=job.id
      member.jobOwner=job.sessionId??job.branchId
      add(jobChildren,member.child,key)
    }
    if(value===undefined)members.delete(key)
    else members.set(key,member)
    if(indexed) {
      if(previous?.stream||external)dirtyStart(previous?.session,previous?.start)
      if(member.stream||external)dirtyStart(member.session,member.start)
      if(member.stream&&member.session)currentState(member.session)?.associationKeys.add(key)
      // Status/progress changes do not alter historical call association.
      // A new relation must reach existing streams; removal keeps the same
      // historical jobIds that the full parser retains.
      if(member.child&&(member.child!==previous?.child||member.jobId!==previous?.jobId||member.jobOwner!==previous?.jobOwner)) {
        const state=currentState(member.child)
        if(state)state.jobsDirty=true
      }
    }
  }
  const stop=enabled?deps.domainRecords!.observe(change=>{
    if(change.table!=='branch')return
    if(!relevant(change.key)&&!outputs.has(change.key)&&!persisted.has(change.key)&&!inFlight.has(change.key))return
    const value=change.operation==='put'?change.value:undefined
    const pending=inFlight.get(change.key)
    const own=change.operation==='put'&&pending!==undefined&&pending===JSON.stringify(value)
    if(!own) {
      persisted.delete(change.key)
      revisions.set(change.key,(revisions.get(change.key)??0)+1)
      const output=outputs.get(change.key),state=output?.state.deref()
      if(state) {
        if(output!.operation!==undefined)bump(state.dirtyOperations,output!.operation)
        else state.metaDirty=true
      }
    }
    if(indexed&&relevant(change.key))index(change.key,value,!own)
  }):()=>{}
  function ensureIndex() {
    if(indexed)return
    for(const [key,value] of table.entriesPrefix!([USAGE,...jobPrefixes]))if(relevant(key))index(key,value,false)
    indexed=true
  }
  /** Serialize before yielding and give storage a detached value: stream
   * objects and parser attempts continue changing after each accepted write. */
  async function writeChanged(key:string,value:unknown) {
    const snapshot=JSON.stringify(value)
    if(persisted.get(key)===snapshot)return
    const revision=revisions.get(key)??0
    inFlight.set(key,snapshot)
    try {
      await table.put(key,JSON.parse(snapshot))
      if((revisions.get(key)??0)===revision)persisted.set(key,snapshot)
    } finally {if(inFlight.get(key)===snapshot)inFlight.delete(key)}
  }
  const ordered=(keys:Iterable<string>)=>[...keys].filter(key=>members.has(key))
    .sort((a,b)=>members.get(a)!.order-members.get(b)!.order)
  function jobs(sessionId:string):TelemetryJob[] {
    ensureIndex()
    return ordered(jobChildren.get(sessionId)??[]).map(key=>table.get(key)).filter(deps.isTelemetryJob)
  }
  function streamRows(sessionId:string,start?:Start,exact=false):StoredCall[] {
    const groups=streams.get(sessionId)
    const keys=exact?(groups?.get(start)??[]):[...(groups?.values()??[])].flatMap(group=>[...group])
    return ordered(keys).map(key=>table.get(key) as StoredCall)
      .filter(row=>row&&!row.superseded&&row.sessionId===sessionId&&row.source?.kind==='stream')
  }
  function stateOf(session:RuntimeSession):NativeState|undefined {
    if(!enabled)return
    const cut=sessionHistoryCut<TelemetryEvent>(session)
    if(cut.source!=='native')return
    ensureIndex()
    let state=states.get(cut.owner)
    if(!state) {
      state={id:session.id,processed:0,fold:createSessionCallFold(session),byId:new Map(),byStart:new Map(),
        lastByTurn:new Map(),lastByStep:new Map(),operations:new Map(),turnOperations:new Map(),stepOperations:new Map(),
        toolStarts:new Map(),dirty:new Map(),dirtyOperations:new Map(),ownerSessionId:deps.owner(session),
        jobsDirty:true,associationKeys:new Set(),metaDirty:true}
      states.set(cut.owner,state)
      currentStates.set(session.id,new WeakRef(state))
    }
    const seed=Number(session.inheritedEventCount??0)
    for(const event of cut.range(state.processed)) {
      state.fold.advance(event)
      const data=event.data??{}
      if(event.type==='agent-preset/selected')state.selectedPreset=data.agentPreset??state.selectedPreset
      if(event.type==='step/start'||event.type==='llm/retry-started')state.boundary=event
      if(event.type==='user/message')state.message=event
      if(event.type==='session/title'){state.title=data.title;state.metaDirty=true}
      if(event.seq<seed||typeof event.time!=='number'||!Number.isFinite(event.time))continue
      if(event.type==='tool/call')state.toolStarts.set(data.callId,event)
      if(!['tool/result','turn/end','compaction/end','assistant/message'].includes(event.type))continue
      const block=data.message?.content?.find(value=>value.type==='tool-result')
      const operation={event,start:state.toolStarts.get(data.callId??data.message?.toolCallId??data.message?.source?.callId??block?.toolCallId)}
      state.operations.set(event.seq,operation)
      if(data.step) {
        let turns=state.stepOperations.get(data.turn)
        if(!turns){turns=new Map();state.stepOperations.set(data.turn,turns)}
        add(turns,data.step,event.seq)
      } else add(state.turnOperations,data.turn,event.seq)
      bump(state.dirtyOperations,event.seq)
    }
    state.processed=cut.length
    for(const call of state.fold.changed) {
      const previous=state.byId.get(call.id)
      if(previous!==call) {
        if(previous)remove(state.byStart,previous.source.startSeq,previous)
        state.byId.set(call.id,call)
        add(state.byStart,call.source.startSeq,call)
        state.lastByTurn.set(call.source.turn,call)
        let steps=state.lastByStep.get(call.source.turn)
        if(!steps){steps=new Map();state.lastByStep.set(call.source.turn,steps)}
        steps.set(call.source.step,call)
      }
      bump(state.dirty,call.id)
      if(state.lastByTurn.get(call.source.turn)===call)
        for(const seq of state.turnOperations.get(call.source.turn)??[])bump(state.dirtyOperations,seq)
      if(state.lastByStep.get(call.source.turn)?.get(call.source.step)===call)
        for(const seq of state.stepOperations.get(call.source.turn)?.get(call.source.step)??[])bump(state.dirtyOperations,seq)
    }
    state.fold.changed.clear()
    const owner=deps.owner(session)
    if(state.ownerSessionId!==owner) {
      state.ownerSessionId=owner;state.metaDirty=true;state.jobsDirty=true
      for(const call of state.byId.values())bump(state.dirty,call.id)
      for(const seq of state.operations.keys())bump(state.dirtyOperations,seq)
    }
    return state
  }
  function operationRow(state:NativeState,operation:Operation):LogRecord|undefined {
    const {event:e,start}=operation,d=e.data??{},block=d.message?.content?.find(value=>value.type==='tool-result')
    const attempt=d.step?state.lastByStep.get(d.turn)?.get(d.step):state.lastByTurn.get(d.turn)
    if(e.type==='assistant/message'&&(attempt?.kind!=='narrative'||!d.message?.content?.some(value=>value.type==='text')
      ||d.message?.content?.some(value=>value.type==='tool-call')))return
    const bad=Boolean(d.error)||block?.isError===true||d.message?.isError===true||d.isError===true
      ||d.result?.isError===true||d.reason?.kind==='error'
    return {schemaVersion:1,id:hash([state.id,e.seq,'operation']),sessionId:state.id,ownerSessionId:state.ownerSessionId,
      kind:e.type==='tool/result'?'tool':e.type==='compaction/end'?'memory':e.type==='assistant/message'?'narrative':'turn',
      label:e.type==='tool/result'?`工具 · ${safeTelemetryId(start?.data?.name??d.name)??'未知工具'}`
        :e.type==='compaction/end'?'记忆整理':e.type==='assistant/message'?'正文生成完毕':'轮次结束',
      status:bad?'failed':'completed',provider:attempt?.provider??null,model:attempt?.model??null,
      startedAt:start?.time??e.time!,completedAt:e.time!,durationMs:start?.time!==undefined?Math.max(0,e.time!-start.time):null,
      error:bad?failureText(d.error??d.reason??d):null,source:{kind:'session-event',sessionId:state.id,seq:e.seq}}
  }
  async function ingest(session:RuntimeSession):Promise<boolean> {
    let state=stateOf(session)
    if(!state)return false
    deps.meta(session)
    if(!deps.eligible(session,state.selectedPreset??deps.headerPreset(session)))return true
    // Refresh after every persistence boundary; an awaited write may publish
    // new Native events or Domain rows before its ACK resumes this consumer.
    const refresh=()=>{state=stateOf(session)!}
    for(;;) {
      if(state.jobsDirty) {
        for(const row of streamRows(session.id))state.associationKeys.add(USAGE+row.id)
        state.jobsDirty=false
      }
      const association=state.associationKeys.values().next().value as string|undefined
      if(association) {
        state.associationKeys.delete(association)
        const row=table.get(association) as StoredCall|undefined
        const ids=jobs(session.id).filter(job=>job.id&&(job.sessionId??job.branchId)===state!.ownerSessionId).map(job=>job.id)
        if(ids.length&&row&&!row.superseded&&row.sessionId===session.id&&row.source?.kind==='stream') {
          const jobIds=[...new Set([...(row.source.jobIds??[]),...(row.source.jobId?[row.source.jobId]:[]),...ids])]
          try {await writeChanged(USAGE+row.id,{...row,source:{...row.source,jobIds}})}
          catch(error){state.associationKeys.add(association);throw error}
          refresh()
        }
        continue
      }
      const pending=state.dirty.entries().next().value as [string,number]|undefined
      if(pending) {
        const [id,version]=pending,call=state.byId.get(id)!
        const value={...call,ownerSessionId:state.ownerSessionId}
        const actual=streamRows(session.id,call.source.startSeq,true).find(row=>!row.source.purpose
          &&row.startedAt>=call.startedAt&&row.startedAt<=(call.completedAt??Infinity))
        if(actual) {
          if(!deps.active.has(actual.id)) {
            await writeChanged(USAGE+actual.id,{...actual,status:call.status,completedAt:call.completedAt,
              durationMs:call.durationMs,firstTokenMs:call.firstTokenMs??actual.firstTokenMs,usage:call.usage??actual.usage,
              error:call.error??actual.error,provider:call.provider??actual.provider,model:call.model??actual.model,
              source:{...actual.source,evidenceSeq:call.source.evidenceSeq,taskIds:call.source.taskIds??actual.source.taskIds}})
            refresh()
          }
          if(table.get(USAGE+call.id)){await writeChanged(USAGE+call.id,{...value,superseded:true});refresh()}
        } else {await writeChanged(USAGE+call.id,value);refresh()}
        if(state.dirty.get(id)===version)state.dirty.delete(id)
        continue
      }
      const pendingOperation=state.dirtyOperations.entries().next().value as [number,number]|undefined
      if(pendingOperation) {
        const [seq,version]=pendingOperation,row=operationRow(state,state.operations.get(seq)!)
        if(row){
          outputs.set(LOG+row.id,{state:new WeakRef(state),operation:seq})
          await writeChanged(LOG+row.id,row);refresh()
        }
        if(state.dirtyOperations.get(seq)===version)state.dirtyOperations.delete(seq)
        continue
      }
      if(state.metaDirty) {
        state.metaDirty=false
        outputs.set(META+hash(session.id),{state:new WeakRef(state)})
        try {
          await writeChanged(META+hash(session.id),{schemaVersion:1,sessionId:session.id,ownerSessionId:state.ownerSessionId,
            label:safeTelemetryId(state.title)??`会话 ${session.id.slice(-8)}`,source:{kind:'session-header'},updatedAt:Date.now()})
        } catch(error){state.metaDirty=true;throw error}
        refresh()
        continue
      }
      return true
    }
  }
  return {ingest,writeChanged,jobs,
    recent(session:object) {
      const state=stateOf(session as RuntimeSession)
      return state?{preset:state.selectedPreset??deps.headerPreset(session as RuntimeSession),boundary:state.boundary,message:state.message}:undefined
    },
    dispose(){stop();currentStates.clear();outputs.clear();members.clear();streams.clear();jobChildren.clear();persisted.clear();revisions.clear()},
  }
}
