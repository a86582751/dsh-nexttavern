import type {SessionEvent} from '@deepseek-ai/dsh-session'
import type {CommunityMacroWrite} from './community-preset-macros.js'
import type {CommunityVariableAttempt} from './community-preset-variables.js'
import type {CommunityPresetTable} from './community-presets.js'
import {recordSha256} from './roleplay-data.js'

export interface CommunityAttemptRecord {
  schemaVersion:1
  attempt:CommunityVariableAttempt
  writes:readonly CommunityMacroWrite[]
}

/** The Native material event links the frozen write set to the same turn and
 * step that produced the accepted canonical assistant. Cold reconciliation
 * reads this data; it never recreates execution hooks or recomputes macros. */
export function acceptedCommunityAttempts(events:readonly SessionEvent[],table:CommunityPresetTable) {
  const completed=new Set(events.flatMap(event=>event.type==='turn/end'&&event.data.reason.kind==='completed'
    ?[event.data.turn]:[]))
  const accepted=new Set(events.flatMap(event=>event.type==='assistant/message'&&!event.data.interrupted
    ?[`${event.data.turn}:${event.data.step}`]:[]))
  const records=new Map<string,CommunityAttemptRecord>()
  for(const event of events) {
    if(event.type!=='request/material'||!completed.has(event.data.turn)
      ||!accepted.has(`${event.data.turn}:${event.data.step}`))continue
    const stored=table.get(event.data.plan.key) as {payload?:{promptPlan?:{community?:CommunityAttemptRecord}}}|undefined
    const record=stored?.payload?.promptPlan?.community
    if(record?.schemaVersion===1) {
      if(recordSha256(stored)!==event.data.plan.sha256)throw Error('COMMUNITY_ACCEPTED_PLAN_CHANGED')
      records.set(record.attempt.attemptId,record)
    }
  }
  return [...records.values()]
}

export function createCommunityPresetSettlement(table:CommunityPresetTable,variables:{
  commit(attempt:CommunityVariableAttempt,writes:readonly CommunityMacroWrite[]):Promise<unknown>
}) {
  const settled=new Map<string,number>()
  async function reconcile(session:{id:string;snapshotEvents():readonly SessionEvent[]}) {
    const events=session.snapshotEvents(),last=Number(events.at(-1)?.seq??0)
    if(settled.get(session.id)===last)return
    for(const record of acceptedCommunityAttempts(events,table))await variables.commit(record.attempt,record.writes)
    settled.set(session.id,last)
  }
  return {reconcile,attemptIds(events:readonly SessionEvent[]){
    return acceptedCommunityAttempts(events,table).map(record=>record.attempt.attemptId)
  }}
}
