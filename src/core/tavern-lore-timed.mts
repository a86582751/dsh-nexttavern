/** Pure timed-state proposal owner. No table writes or Native authority here. */
import {recordSha256} from './roleplay-data.js'
import {refuse} from './tavern-lore-match.mjs'
import type {TavernLoreEntryPlanV1,TavernLoreSemanticEntryV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreBranchTimedInputV1,TavernLoreTimedActionV1} from './tavern-lore-evaluator-types.mjs'

export function tavernLoreEntrySemanticSha256V1(semantic:TavernLoreSemanticEntryV1):string {
  // Origin/head refs describe provenance, not changed runtime semantics. Timers
  // survive unrelated bookkeeping and expire on actual effective edits.
  const {content,...fields}=semantic
  return recordSha256({...fields,content:{kind:content.kind,pointer:content.pointer,contentSha256:content.contentSha256}})
}
export interface LoreTimedEntryV1 {entry:TavernLoreEntryPlanV1;semantic:TavernLoreSemanticEntryV1;eligible:boolean}
type Interval=TavernLoreBranchTimedInputV1['intervals'][number]
export class TavernLoreTimedStateV1 {
  private readonly rows={sticky:new Map<string,Interval>(),cooldown:new Map<string,Interval>()}
  private readonly active={sticky:new Set<string>(),cooldown:new Set<string>()}
  readonly actions:TavernLoreTimedActionV1[]=[]
  constructor(private readonly input:TavernLoreBranchTimedInputV1,
    private readonly entries:ReadonlyMap<string,LoreTimedEntryV1>) {
    for(const row of input.intervals)this.rows[row.kind].set(row.entryId,row)
    // Fixed source checks sticky first: expiry starts a protected cooldown that
    // must be visible when cooldown is checked during this same evaluation.
    for(const kind of ['sticky','cooldown'] as const)for(const row of [...this.rows[kind].values()]) {
      const item=entries.get(row.entryId)
      if(input.chatIndex<=row.start&&!row.protected){this.clear(row,'chat-not-advanced');continue}
      if(!item||!item.semantic.enabled||!item.eligible){this.clear(row,'entry-unavailable');continue}
      if(item.entry.rawEntrySha256!==row.rawEntrySha256
        ||tavernLoreEntrySemanticSha256V1(item.semantic)!==row.entrySemanticSha256) {
        this.clear(row,'entry-edited');continue
      }
      if(!item.semantic[kind]){this.clear(row,'control-cleared');continue}
      if(input.chatIndex>=row.end) {
        this.clear(row,'expired')
        if(kind==='sticky'&&item.semantic.cooldown)this.set(item,'cooldown',true,'sticky-ended-cooldown-protected',true)
        continue
      }
      this.active[kind].add(row.entryId)
    }
  }
  private clear(row:Interval,reason:TavernLoreTimedActionV1['reason']):void {
    this.rows[row.kind].delete(row.entryId);this.active[row.kind].delete(row.entryId)
    this.actions.push({kind:'clear',entryId:row.entryId,rawEntrySha256:row.rawEntrySha256,
      entrySemanticSha256:row.entrySemanticSha256,effect:row.kind,before:row,after:null,reason})
    this.limit()
  }
  private set(item:LoreTimedEntryV1,kind:Interval['kind'],protectedEffect:boolean,
    reason:TavernLoreTimedActionV1['reason'],replace=false):void {
    const duration=item.semantic[kind]
    if(!duration||!replace&&this.rows[kind].has(item.entry.entryId))return
    if(!Number.isSafeInteger(duration)||duration<0||!Number.isSafeInteger(this.input.chatIndex+duration)) {
      refuse('LORE_TIMED_RANGE_LIMIT',item.entry.entryId)
    }
    const before=this.rows[kind].get(item.entry.entryId)??null
    const after:Interval={entryId:item.entry.entryId,rawEntrySha256:item.entry.rawEntrySha256,
      entrySemanticSha256:tavernLoreEntrySemanticSha256V1(item.semantic),kind,start:this.input.chatIndex,
      end:this.input.chatIndex+duration,protected:protectedEffect}
    this.rows[kind].set(item.entry.entryId,after)
    if(protectedEffect)this.active[kind].add(item.entry.entryId)
    this.actions.push({kind:'set',entryId:after.entryId,rawEntrySha256:after.rawEntrySha256,
      entrySemanticSha256:after.entrySemanticSha256,effect:kind,before,after,reason})
    this.limit()
  }
  private limit():void {if(this.actions.length>8192)refuse('LORE_TIMED_PROPOSAL_LIMIT')}
  sticky(entryId:string):boolean{return this.active.sticky.has(entryId)}
  cooldown(entryId:string):boolean{return this.active.cooldown.has(entryId)}
  delay(item:LoreTimedEntryV1):boolean {
    return (item.semantic.delay??0)>this.input.chatIndex
  }
  activated(entryIds:readonly string[]):void {
    for(const id of entryIds) {
      const item=this.entries.get(id)
      if(!item)refuse('LORE_TIMED_ENTRY_UNKNOWN',id)
      this.set(item,'sticky',false,'activation')
      this.set(item,'cooldown',false,'activation')
    }
  }
}
