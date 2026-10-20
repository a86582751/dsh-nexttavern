import {sessionEvents} from './session-history.js'
import { createHash } from 'node:crypto'
import type { ContextEvent } from './roleplay-context.js'
import {textOf} from './roleplay-data.js'
import {inlineTaskEnvelope} from './tavern-task-context.js'
import { normalizeUsage as usageOf, failureText as reasonText, telemetryOutcome as outcome, type TelemetryCallRecord } from './tavern-telemetry-normalize.js'
export interface TelemetrySession { id: string; inheritedEventCount?: unknown; header?: object; events?: readonly TelemetryEvent[]; log?: readonly TelemetryEvent[] }
export interface TelemetryChunk { type: string; usage?: unknown; reason?: { kind?: string } | null }
export type TelemetryEvent = ContextEvent
const hash=(value: unknown): string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const events=(session: TelemetrySession): readonly TelemetryEvent[]=>sessionEvents(session)
/** Fold raw attempts, never the selected story surface. Seeded parent events
 * only establish lifecycle state; they never create a second charge. */
export function foldSessionCalls(session: TelemetrySession): TelemetryCallRecord[] {
  const out: TelemetryCallRecord[] = [], seed = Number(session.inheritedEventCount ?? 0)
  let current: TelemetryCallRecord | null = null, route: {provider?: string | null; model?: string | null} = {}, phase = 'narrative'
  let taskPhase:readonly {id?:unknown;kind?:unknown}[]=[]
  const finish=(time: number | undefined, status?: TelemetryCallRecord['status'], error?: string | null)=>{if(!current)return;if(time!=null){current.completedAt=time;current.durationMs=Math.max(0,time-current.startedAt)}if(status)current.status=status;if(error)current.error=error}
  for(const e of events(session)) {
    if (typeof e.time !== 'number' || !Number.isFinite(e.time)) continue
    const d=e.data??{}
    if(e.type==='turn/start'||e.type==='turn/end')taskPhase=[]
    if(e.type==='compaction/summary'&&d.usage&&!d.nativeTask&&e.seq>=seed)out.push({schemaVersion:1,id:hash([session.id,'compaction',d.compactionId??e.seq]),sessionId:session.id,ownerSessionId:session.id,kind:'compaction',provider:d.provider??null,model:d.model??null,status:'completed',startedAt:e.time,completedAt:e.time,durationMs:null,firstTokenMs:null,usage:usageOf(d.usage),source:{kind:'compaction-summary',sessionId:session.id,startSeq:e.seq,evidenceSeq:e.seq}})
    if(e.type==='request/header'){route=d.header?.config??route;if(current){current.provider=route.provider??null;current.model=route.model??null}}
    if(e.type==='user/message')phase=d.source?.kind==='roleplay-tasks'?(d.source.jobKind??d.source.stage??'maintenance'):'narrative'
    if(e.type==='step/start'||e.type==='llm/retry-started') {
      if(current?.status==='running')finish(e.time,'unknown')
      current={schemaVersion:1,id:hash([session.id,e.seq]),sessionId:session.id,ownerSessionId:session.id,
        provider:route.provider??null,model:route.model??null,kind:phase,status:'running',startedAt:e.time,completedAt:null,durationMs:null,firstTokenMs:null,usage:null,
        source:{kind:'session-attempt',sessionId:session.id,startSeq:e.seq,turn:d.turn,step:d.step,evidenceSeq:e.seq}}
      if(e.seq>=seed)out.push(current)
    }
    if(e.type==='user/message'&&d.source?.kind==='roleplay-tasks'
      &&d.source.form==='phase'&&d.source.schemaVersion===1) {
      // Later steps can submit the remainder of the same durable Core phase.
      // Retain its identities until replacement or the turn boundary; this
      // accounting never recovers a live task grant or consults pending jobs.
      taskPhase=[]
      try {
        const tasks=inlineTaskEnvelope(textOf(d.content))
        if(Array.isArray(tasks))taskPhase=tasks
      }catch{}
    }
    if(!current)continue
    current.source.evidenceSeq=e.seq
    if(e.type==='tool/call'&&['rp_task_read','rp_task_submit'].includes(d.name!)) {
      try { const args=(typeof d.arguments==='string'?JSON.parse(d.arguments):d.arguments) as {id?: unknown;kind?:unknown} | null | undefined
        const matches=d.name==='rp_task_submit'&&(args?.kind==='status'||args?.kind==='decision')
          ?taskPhase.filter(task=>task?.kind===args.kind):[]
        const id=args?.id??(matches.length===1?matches[0]!.id:undefined)
        if(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id))current.source.taskIds=[...new Set([...(current.source.taskIds??[]),id])]
      }catch{}
    }
    if(e.type==='assistant/chunk') {
      if(['text-delta','reasoning-delta','tool-call-delta'].includes(d.chunk?.type!)&&current.firstTokenMs===null)current.firstTokenMs=Math.max(0,e.time-current.startedAt)
      if(d.chunk?.type==='usage')current.usage=usageOf(d.chunk.usage)
      if(d.chunk?.type==='finish')finish(e.time,outcome(d.chunk.reason),['error','aborted'].includes(d.chunk.reason?.kind!)?reasonText(d.chunk.reason):null)
    }
    if(e.type==='assistant/message') {
      if(d.usage)current.usage=usageOf(d.usage)
      const actual=d.message?.source
      if(actual?.provider)current.provider=actual.provider
      if(actual?.model)current.model=actual.model
      finish(e.time,['failed','cancelled','truncated'].includes(current.status)?current.status:d.interrupted?'truncated':'completed')
    }
    if(e.type==='llm/retry')finish(e.time,'failed',reasonText(d.failure))
    if(e.type==='step/end'){if(current.status==='running')finish(e.time,'unknown');current=null}
    if(e.type==='turn/end'){if(current && current.status==='running')finish(e.time,outcome(d.reason) as TelemetryCallRecord['status'],d.reason?.kind==='error'?reasonText(d.reason):null);current=null}
  }
  return out
}
