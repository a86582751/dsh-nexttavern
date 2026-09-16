export interface BranchScope { isFork: boolean; seedLength: number | null }
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const eventsOf = (session: unknown): readonly Record<string, unknown>[] => {
  if (!record(session)) return []
  const events = Array.isArray(session.events) ? session.events : Array.isArray(session.log) ? session.log : []
  return events.filter(record)
}
export function lastSeqOf(session: unknown): number {
  if (record(session) && Number.isSafeInteger(session.seq)) return Number(session.seq) - 1
  const events = eventsOf(session)
  return events.length > 0 ? Number(events.at(-1)?.seq ?? events.length - 1) : -1
}
export function estimateTokens(text: unknown): number { return Math.ceil(String(text ?? '').length / 2.5) }
export function textOf(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content.filter(record).filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text as string).join('\n')
}
export function branchScope(session: unknown): BranchScope {
  const header = record(session) && record(session.header) ? session.header : null
  const parent = typeof header?.parentSession === 'string' ? header.parentSession.trim() : ''
  if (!parent) return { isFork: false, seedLength: null }
  const raw = header?.seedLength
  return { isFork: true, seedLength: Number.isSafeInteger(raw) && Number(raw) >= 0 ? Number(raw) : null }
}
export function durableSeq(value: unknown): number | null { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null }
export function provenanceSeqOf(item: unknown): number | null {
  if (!record(item)) return null
  const range = record(item.range) ? item.range : null
  for (const candidate of [item.atSeq, item.evidenceSeq, item.updatedAtSeq, item.checkpointSeq, item.summaryAtSeq, item.summarySeq, item.sourceSeq, item.seq, range?.end]) {
    const seq = durableSeq(candidate); if (seq !== null) return seq
  }
  return null
}
export function belongsToBranch(item: unknown, session: unknown, scope = branchScope(session)): boolean {
  if (!scope.isFork || !record(item)) return !scope.isFork
  const branchId = record(session) ? String(session.id ?? '') : ''
  const owners = [item.sessionId, item.branchId, item.ownerSessionId].map(value => String(value ?? '').trim()).filter(Boolean)
  if (branchId && owners.length > 0 && owners.every(owner => owner === branchId)) return true
  const seq = provenanceSeqOf(item)
  return scope.seedLength !== null && seq !== null && seq < scope.seedLength
}
export function scopedLedgerItems(items: unknown, session: unknown, scope = branchScope(session)): Record<string, unknown>[] {
  return (Array.isArray(items) ? items : []).filter(item => belongsToBranch(item, session, scope)).filter(record)
}
interface SummaryResult { text: string; seq: number | null; source: 'surface' | 'none' | 'ledger' | 'child-ledger' | 'seed-ledger' | 'inherited-ledger' | 'unproven' }
const summarySeqOf = (value: unknown): number | null => {
  if (!record(value)) return null
  for (const key of ['summaryAtSeq', 'summarySeq', 'surfaceCheckpointSeq', 'lastCompactedSeq']) {
    const seq = durableSeq(value[key]); if (seq !== null) return seq
  }
  return null
}
const inheritedSummaryIsSafe = (value: unknown, session: unknown, scope: BranchScope, seq: number | null): boolean => {
  if (!scope.isFork || scope.seedLength === null || !record(value) || !record(session)) return false
  const header = record(session.header) ? session.header : null
  const parent = typeof header?.parentSession === 'string' ? header.parentSession.trim() : ''
  const inheritedFrom = String(value.inheritedFrom ?? '').trim(), inheritedAt = value.inheritedAtSeedLength
  return Boolean(parent && inheritedFrom === parent && Number.isSafeInteger(inheritedAt) && inheritedAt === scope.seedLength && (seq === null || seq < scope.seedLength))
}
export function safeSummaryForBranch(value: unknown, session: unknown, checkpoint: unknown = null, scope = branchScope(session)): SummaryResult {
  const point = record(checkpoint) ? checkpoint : null, visibleText = String(point?.text ?? '').trim()
  if (visibleText) return { text: visibleText, seq: durableSeq(point?.seq), source: 'surface' }
  const summary = record(value) ? String(value.summary ?? '').trim() : ''
  if (!summary) return { text: '', seq: null, source: 'none' }
  const seq = summarySeqOf(value)
  if (!scope.isFork) return { text: summary, seq, source: 'ledger' }
  const branchId = record(session) ? String(session.id ?? '') : ''
  const owners = record(value) ? [value.summarySessionId, value.summaryBranchId].map(item => String(item ?? '').trim()).filter(Boolean) : []
  if (branchId && owners.length > 0 && owners.every(owner => owner === branchId)) return { text: summary, seq, source: 'child-ledger' }
  if (scope.seedLength !== null && seq !== null && seq < scope.seedLength) return { text: summary, seq, source: 'seed-ledger' }
  if (inheritedSummaryIsSafe(value, session, scope, seq)) return { text: summary, seq, source: 'inherited-ledger' }
  return { text: '', seq: null, source: 'unproven' }
}
export interface MemoryRecordProjection extends Record<string, unknown> {
  summary: string
  archives: Record<string, unknown>[]
  archiveDigests: Record<string, unknown>[]
  deltas: Record<string, unknown>[]
  pendingConfirmations: Record<string, unknown>[]
  lockedFacts: Record<string, unknown>[]
  styleNotes: Record<string, unknown>[]
  userPrefs: Record<string, unknown>[]
}
export function filterMemoryRecordForBranch(value: unknown, session: unknown, checkpoint: unknown = null): MemoryRecordProjection | null {
  const source = record(value) ? structuredClone(value) : {}
  if (!record(value) && !(record(checkpoint) && checkpoint.text)) return null
  const scope = branchScope(session), summary = safeSummaryForBranch(source, session, checkpoint, scope)
  const result: MemoryRecordProjection = { ...source, summary: summary.text,
    archives: scopedLedgerItems(source.archives, session, scope),
    archiveDigests: scopedLedgerItems(source.archiveDigests, session, scope),
    deltas: scopedLedgerItems(source.deltas, session, scope),
    pendingConfirmations: scopedLedgerItems(source.pendingConfirmations, session, scope),
    lockedFacts: scopedLedgerItems(source.lockedFacts, session, scope),
    styleNotes: scopedLedgerItems(source.styleNotes, session, scope),
    userPrefs: scopedLedgerItems(source.userPrefs, session, scope),
  }
  if (summary.seq !== null) result.surfaceCheckpointSeq = summary.seq
  else if (scope.isFork) result.surfaceCheckpointSeq = null
  if (scope.isFork) result.lastCompactedSeq = summary.seq ?? -1
  return result
}
/** Match the native result wrapper to its call; retain direct-text replay compatibility. */
export function adaptationToolResult(value: unknown): {text:string;failed:boolean}|null {
  if(!record(value)||!record(value.source)||typeof value.source.callId!=='string'||!Array.isArray(value.content))return null
  const wrapped=value.content.filter(b=>record(b)&&b.type==='tool-result')
  if(wrapped.length&&(wrapped.length!==1||wrapped[0].toolCallId!==value.source.callId))return null
  const result=wrapped[0]??value
  if(!Array.isArray(result.content))return null
  return {text:(result.content as unknown[]).flatMap(b=>record(b)&&b.type==='text'&&typeof b.text==='string'?[b.text]:[]).join('\n'),failed:value.isError===true||result.isError===true}
}
/** Only a successful, explicit adaptation start opens research mode. Never infer it from novel/user text. */
function adaptationActivity(events: readonly {type:string;data?:{turn?:unknown;name?:unknown;id?:unknown;callId?:unknown;message?:unknown}}[]) {
  const turns=new Set<number>(),pending=new Map<string,{name:string;turn:number}>(),closing=new Map<string,{name:string;turn:number}>();let active=false,turn=-1
  for(const e of events){
    if(e.type==='turn/start'){turn=Number(e.data?.turn);if(active)turns.add(turn)}
    const callId=e.data?.callId??e.data?.id
    const name=String(e.data?.name)
    if(e.type==='tool/call'&&['rp_source_begin','rp_source_library'].includes(name)&&typeof callId==='string')pending.set(callId,{name,turn:Number(e.data?.turn??turn)})
    // A source-status consultation is a management turn even though it does
    // not open persistent research mode or constrain later original writing.
    if(e.type==='tool/call'&&/^rp_source_/.test(name))turns.add(Number(e.data?.turn??turn))
    if(e.type==='tool/call'&&['rp_commit_card','rp_card_import_begin','rp_source_close'].includes(String(e.data?.name))&&typeof callId==='string')closing.set(callId,{name:String(e.data?.name),turn:Number(e.data?.turn??turn)})
    if(e.type==='tool/result'){
      const message=e.data?.message as {source?:{callId?:string};isError?:boolean;content?:{text?:string}[]}|undefined
      const resultId=message?.source?.callId
      const start=resultId?pending.get(resultId):undefined
      if(start){
        pending.delete(resultId!)
        try{const proof=adaptationToolResult(message),result=proof&&!proof.failed?JSON.parse(proof.text):null
          // begin freezes/chooses a source; library only starts after an explicit attach.
          if(result?.sourceId&&(start.name==='rp_source_begin'||result?.attached===true)){active=true;turns.add(start.turn)}
        }catch{}
      }
      const close=resultId?closing.get(resultId):undefined
      if(close){
        closing.delete(resultId!)
        // Failed or unproven commits must retain research isolation and allow recovery.
        try{const proof=adaptationToolResult(message),result=proof&&!proof.failed?JSON.parse(proof.text):null;if(result?.ok===true&&(close.name!=='rp_source_close'||['roleplay','authoring'].includes(result.mode))){active=false;turns.delete(close.turn)}}catch{}
      }
    }
  }
  return {turns,active}
}
export const adaptationTurns=(events:Parameters<typeof adaptationActivity>[0])=>adaptationActivity(events).turns
export const adaptationIsActive=(events:Parameters<typeof adaptationActivity>[0])=>adaptationActivity(events).active

/** A questionnaire need not end a native turn. Only a verified activation and
 * its selected program opening phase can end management isolation mid-turn. */
export function importedStoryProjection(events:readonly {seq:number;type:string;data?:{turn?:unknown;message?:unknown;source?:unknown};sourceEventSeqs?:unknown}[],nodes:readonly number[]) {
  const visible=new Set(nodes),selected=new Set(nodes),bySeq=new Map(events.map(e=>[e.seq,e]));
  const pending=[...nodes];
  for(let i=0;i<pending.length;i++){
    const event=bySeq.get(pending[i]!),source=record(event?.data?.source)?event.data.source:null;
    if(event?.type!=='user/message'||source?.kind!=='plugin'||source.plugin!=='roleplay-tasks'||source.form!=='management-receipt'||!Array.isArray(event.sourceEventSeqs))continue;
    for(const seq of event.sourceEventSeqs)if(bySeq.has(seq)&&!selected.has(seq)){selected.add(seq);pending.push(seq)}
  }
  const prose=new Set<number>(),boundaries:{turn:number;finalizeSeq:number;storyPhaseSeq:number;importId:string;normalizedSha256:string}[]=[];
  const calls=new Map<string,{name:string;turn:number}>();
  let turn=-1,begin:{id:string;hash:string}|null=null,final:{id:string;hash:string;seq:number}|null=null,story=false;
  for(const event of events){
    if(event.type==='turn/start'){turn=Number(event.data?.turn);begin=null;final=null;story=false;calls.clear()}
    const message=record(event.data?.message)?event.data.message:null,source=record(event.data?.source)?event.data.source:null;
    if(event.type==='assistant/message'&&selected.has(event.seq)&&Array.isArray(message?.content))for(const block of message.content){
      if(!record(block)||block.type!=='tool-call'||typeof block.id!=='string'||typeof block.name!=='string')continue;
      if(/^(?:rp_card_|rp_source_|rp_preset$|rp_diagnose$)/.test(block.name))story=false;
      if(block.name==='rp_card_import_begin'){begin=null;final=null}
      if(['rp_card_import_begin','rp_card_import_finalize'].includes(block.name))calls.set(block.id,{name:block.name,turn});
    }
    if(event.type==='tool/result'&&selected.has(event.seq)&&record(message?.source)){
      const call=typeof message.source.callId==='string'?calls.get(message.source.callId):undefined;
      if(call&&call.turn===turn){
        calls.delete(String(message.source.callId));
        const decoded=adaptationToolResult(message);let proof:unknown;
        try{proof=decoded&&!decoded.failed?JSON.parse(decoded.text):null}catch{proof=null}
        if(record(proof)&&proof.ok===true&&typeof proof.importId==='string'&&/^[a-f0-9]{64}$/.test(String(proof.normalizedSha256))){
          if(call.name==='rp_card_import_begin')begin={id:proof.importId,hash:String(proof.normalizedSha256)};
          else if(begin?.id===proof.importId&&begin.hash===proof.normalizedSha256&&proof.coverage===1&&typeof proof.activatedAt==='number'&&Number.isFinite(proof.activatedAt)&&proof.activatedAt>0)final={...begin,seq:event.seq};
        }
      }
    }
    if(event.type==='user/message'&&visible.has(event.seq)&&source?.kind==='plugin'&&source.plugin==='roleplay-tasks'&&source.form==='phase'){
      story=source.stage==='story'&&!!final&&source.openingImportId===final.id&&event.seq>final.seq;
      if(story&&final)boundaries.push({turn,finalizeSeq:final.seq,storyPhaseSeq:event.seq,importId:final.id,normalizedSha256:final.hash});
    }
    if(story&&visible.has(event.seq)&&event.type==='assistant/message'&&Number(event.data?.turn)===turn&&Array.isArray(message?.content)&&!message.content.some(b=>record(b)&&b.type==='tool-call')&&textOf(message.content).trim())prose.add(event.seq);
    if(event.type==='turn/end'){story=false;begin=null;final=null;calls.clear()}
  }
  return {prose,boundaries};
}
