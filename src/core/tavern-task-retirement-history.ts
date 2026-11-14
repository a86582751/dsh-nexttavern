/** Native retirement DATA: accepted history, actual surface order and the
 * remaining visible work. Task and source publication permissions stay with
 * their owners and are read by the retiring consumer. */
import {createSurfaceCursor} from 'dsh-nexttavern-native-session/surface'
import type {SessionMessageProjection,SurfaceCursorTransition} from 'dsh-nexttavern-native-session/surface'
import type {SessionEvent} from 'dsh-nexttavern-native-session'
import {sessionHistoryCut} from './session-history.js'
import type {SessionHistoryCut} from './session-history.js'
import type {TaskContextSession,TaskEvent,createTaskHistoryClassification} from './tavern-task-context.js'

export interface RetirementTurn {
  turn:number|undefined
  start:number
  end:number|undefined
  export:boolean
  story:boolean
  completed:boolean
  visible:Map<number,VisibleRetirementRow>
  imports:Set<number>
}
interface VisibleRetirementRow {
  seq:number
  order:number
  previous:number|undefined
  next:number|undefined
  turn:RetirementTurn|undefined
  categories:readonly RetirementCategory[]
}
export type RetirementCategory='phase'|'read'|'research-read'|'research-proof'|'coarse-evidence'
  |'maintenance-receipt'|'read-evidence-receipt'|'adaptation-receipt'
interface Category {
  visible:Map<number,number>
  additions:number[]
  repairSeq:number
}
export interface RetirementFold<T> {advance(event:TaskEvent):void;data:T}
interface VisibleFold<T> {category:RetirementCategory;through:number;repairSeq:number;fold:RetirementFold<T>}
interface NativeFold<T> {through:number;fold:RetirementFold<T>}
type Classification=ReturnType<typeof createTaskHistoryClassification>
export interface RetirementHistoryOptions {
  projections?():readonly SessionMessageProjection[]
  createClassification:typeof createTaskHistoryClassification
}
export type RetirementHistoryAccess=(session:TaskContextSession)=>RetirementHistory|undefined

export function createRetirementHistory({projections,createClassification}:RetirementHistoryOptions) {
  const owners=new WeakMap<object,RetirementHistory>()
  return (session:TaskContextSession):RetirementHistory|undefined=>{
    if(!projections)return
    const cut=sessionHistoryCut<TaskEvent>(session)
    if(cut.source!=='native')return
    let owner=owners.get(cut.owner)
    if(!owner) {
      owner=new RetirementHistory(cut,projections(),createClassification)
      owners.set(cut.owner,owner)
    }
    owner.advance(cut)
    return owner
  }
}

export class RetirementHistory {
  private cut:SessionHistoryCut<TaskEvent>
  private readonly surface:ReturnType<typeof createSurfaceCursor>
  private readonly classification:Classification
  private readonly turns:RetirementTurn[]=[]
  private currentTurn:RetirementTurn|undefined
  private readonly rows=new Map<number,VisibleRetirementRow>()
  private readonly selectedSeqs:number[]=[]
  private readonly selectedPositions=new Map<number,number>()
  private readonly selectedCounts:number[]=[0]
  private readonly management=new Set<RetirementTurn>()
  private readonly categories=new Map<RetirementCategory,Category>()
  private readonly nativeFolds=new Map<object,NativeFold<unknown>>()
  private readonly visibleFolds=new Map<object|string,VisibleFold<unknown>>()
  private readonly researchCalls=new Set<string>()
  private lastRow:number|undefined
  private nextOrder=0
  readonly ended=new Set<number>()
  readonly completed=new Set<number>()
  readonly bodies=new Map<number,number>()
  readonly visibleResults=new Map<string,Set<number>>()
  readonly lookup:{get:(seq:number)=>TaskEvent|undefined;has:(seq:number)=>boolean}
  readonly owner:{get:(seq:number)=>number|undefined}
  readonly internal:{has:(seq:number)=>boolean}

  constructor(cut:SessionHistoryCut<TaskEvent>,projections:readonly SessionMessageProjection[],
    createClassification:typeof createTaskHistoryClassification) {
    this.cut=cut
    this.surface=createSurfaceCursor({read:()=>this.cut as unknown as SessionHistoryCut<SessionEvent>,projections})
    this.classification=createClassification(seq=>seq<this.surface.length?this.cut.at(seq):undefined)
    this.lookup={get:seq=>this.cut.at(seq),has:seq=>this.cut.at(seq)!==undefined}
    this.owner={get:seq=>this.turnAt(seq)?.turn}
    // Classification owns its mutable derived facts. Consumers ask the actual
    // current classifier rather than copying internal flags into another cache.
    this.internal={has:seq=>{const event=this.cut.at(seq);return !!event&&this.classification.internal(event)}}
  }
  private turnAt(seq:number):RetirementTurn|undefined {
    let low=0,high=this.turns.length
    while(low<high){const middle=(low+high)>>>1;if(this.turns[middle]!.start<=seq)low=middle+1;else high=middle}
    const turn=this.turns[low-1]
    return turn&&(turn.end===undefined||seq<=turn.end)?turn:undefined
  }
  private category(kind:RetirementCategory):Category {
    let category=this.categories.get(kind)
    if(!category)this.categories.set(kind,category={visible:new Map(),additions:[],repairSeq:-1})
    return category
  }
  private categoriesFor(event:TaskEvent):RetirementCategory[] {
    const source=event.type==='user/message'?event.data?.source:undefined,categories:RetirementCategory[]=[]
    if(source?.kind==='roleplay-tasks') {
      if(source.form==='phase'&&['after-story','prepare','management'].includes(source.stage??''))categories.push('phase')
      if(source.form==='coarse-research-evidence')categories.push('coarse-evidence')
      if(['maintenance-receipt','read-evidence-receipt'].includes(source.form??'')
        &&((event.data as {content?:readonly unknown[]}).content?.length??0)>0)
        categories.push(source.form as RetirementCategory)
    }
    if(source?.form==='adaptation-receipt')categories.push('adaptation-receipt')
    const calls=event.type==='assistant/message'?(event.data?.message?.content??[]).filter(block=>block.type==='tool-call'):[]
    if(calls.some(block=>['rp_history','rp_worldbook_list','rp_worldbook_search'].includes(block.name??'')))categories.push('read')
    if(calls.some(block=>/^rp_source_(?:read|search|notes|note|status|index)$/.test(block.name??'')))categories.push('research-read')
    if(calls.some(block=>/^rp_source_/.test(block.name??''))
      ||event.type==='tool/result'&&this.researchCalls.has(event.data?.message?.source?.callId??''))categories.push('research-proof')
    return categories
  }
  private drop(row:VisibleRetirementRow,at:number):void {
    this.rows.delete(row.seq)
    const position=this.selectedPositions.get(row.seq)!
    this.selectedPositions.delete(row.seq)
    for(let index=position;index<this.selectedCounts.length;index+=index&-index)
      this.selectedCounts[index]=this.selectedCounts[index]!-1
    if(row.turn) {
      row.turn.visible.delete(row.seq);row.turn.imports.delete(row.seq)
      if(!row.turn.visible.size||!row.turn.export&&!row.turn.imports.size)this.management.delete(row.turn)
    }
    for(const kind of row.categories) {
      const category=this.category(kind)
      category.visible.delete(row.seq);category.repairSeq=at
    }
    const event=this.cut.at(row.seq),id=event?.type==='tool/result'?event.data?.message?.source?.callId:undefined
    if(typeof id==='string') {
      const results=this.visibleResults.get(id)!
      results.delete(row.seq);if(!results.size)this.visibleResults.delete(id)
    }
  }
  private select(event:TaskEvent,transition:SurfaceCursorTransition):void {
    if(transition.kind==='project')return
    let previous=this.lastRow,next:number|undefined,order=this.nextOrder++
    if(transition.kind==='replace') {
      const first=this.rows.get(transition.removed[0]!)!,last=this.rows.get(transition.removed.at(-1)!)!
      previous=first.previous;next=last.next;order=first.order
      for(const seq of transition.removed)this.drop(this.rows.get(seq)!,event.seq)
    }
    const turn=this.turnAt(event.seq),categories=this.categoriesFor(event),
      row:VisibleRetirementRow={seq:event.seq,order,previous,next,turn,categories}
    this.rows.set(event.seq,row)
    const position=this.selectedSeqs.length+1
    this.selectedSeqs.push(event.seq);this.selectedPositions.set(event.seq,position)
    this.selectedCounts.push(1+this.selectedPrefix(position-1)-this.selectedPrefix(position-(position&-position)))
    if(previous!==undefined)this.rows.get(previous)!.next=event.seq
    if(next!==undefined)this.rows.get(next)!.previous=event.seq
    else this.lastRow=event.seq
    if(turn) {
      turn.visible.set(event.seq,row)
      if(event.type==='assistant/message'&&(event.data?.message?.content??[])
        .some(block=>block.type==='tool-call'&&block.name==='rp_card_import_begin'))turn.imports.add(event.seq)
      if(turn.export||turn.imports.size)this.management.add(turn)
    }
    for(const kind of categories) {
      const category=this.category(kind)
      category.visible.set(event.seq,order);category.additions.push(event.seq)
      if(transition.kind==='replace')category.repairSeq=event.seq
    }
    const id=event.type==='tool/result'?event.data?.message?.source?.callId:undefined
    if(typeof id==='string') {
      let results=this.visibleResults.get(id)
      if(!results)this.visibleResults.set(id,results=new Set())
      results.add(event.seq)
    }
  }
  advance(cut:SessionHistoryCut<TaskEvent>):void {
    this.cut=cut
    let transition:SurfaceCursorTransition|undefined
    this.surface.advanceTo(cut.length,value=>{transition=value},actual=>{
      const event=actual as unknown as TaskEvent,change=transition
      transition=undefined
      if(event.type==='turn/start') {
        this.currentTurn={turn:event.data?.turn,start:event.seq,end:undefined,export:false,story:false,
          completed:false,visible:new Map(),imports:new Set()}
        this.turns.push(this.currentTurn)
      }
      const turn=this.currentTurn,source=event.type==='user/message'?event.data?.source:undefined
      if(turn&&source?.kind==='roleplay-tasks') {
        if(['card-export','novel-export'].includes(source.jobKind??''))turn.export=true
        if(source.form==='phase'&&['story','after-story'].includes(source.stage??''))turn.story=true
        if(source.form==='phase'&&source.stage==='after-story'&&source.turn===turn.turn
          &&Number.isSafeInteger(source.storySeq)) {
          const body=this.cut.at(Number(source.storySeq))
          if(body?.type==='assistant/message'&&this.turnAt(body.seq)?.turn===turn.turn&&body.seq<event.seq)
            this.bodies.set(turn.turn!,body.seq)
        }
      }
      if(turn&&event.type==='tool/call'
        &&/^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export)$/.test(event.data?.name??''))turn.export=true
      if(turn?.export&&turn.visible.size)this.management.add(turn)
      if(event.type==='assistant/message')for(const block of event.data?.message?.content??[]) {
        if(block.type==='tool-call'&&block.id&&/^rp_source_/.test(block.name??''))this.researchCalls.add(block.id)
      }
      if(event.type==='tool/call'&&/^rp_source_/.test(event.data?.name??'')) {
        const id=event.data?.callId??event.data?.id
        if(typeof id==='string')this.researchCalls.add(id)
      }
      if(turn&&event.type==='turn/end') {
        turn.end=event.seq;turn.completed=event.data?.reason?.kind==='completed'
        if(turn.turn!==undefined) {
          this.ended.add(turn.turn)
          if(turn.completed)this.completed.add(turn.turn)
        }
        this.currentTurn=undefined
      }
      if(change)this.select(event,change)
      this.classification.advance(event,change)
    })
  }
  managementTurns():RetirementTurn[] {return [...this.management].sort((left,right)=>left.start-right.start)}
  group(seq:number):RetirementTurn|undefined {return this.turnAt(seq)}
  nodes(turn:RetirementTurn):number[] {return [...turn.visible.values()].sort((left,right)=>left.order-right.order).map(row=>row.seq)}
  selected(kind:RetirementCategory):number[] {
    return [...this.category(kind).visible].sort((left,right)=>left[1]-right[1]).map(([seq])=>seq)
  }
  next(seq:number):number|undefined {return this.rows.get(seq)?.next}
  visible(seq:number):boolean {return this.rows.has(seq)}
  private selectedPrefix(end:number):number {
    let count=0
    for(let index=end;index>0;index-=index&-index)count+=this.selectedCounts[index]!
    return count
  }
  private selectedBoundary(seq:number):number {
    let low=0,high=this.selectedSeqs.length
    while(low<high){const middle=(low+high)>>>1;if(this.selectedSeqs[middle]!<seq)low=middle+1;else high=middle}
    return low
  }
  private selectedAt(rank:number):number {
    let index=0,step=1
    while(step*2<=this.selectedSeqs.length)step*=2
    for(;step;step>>=1) {
      const next=index+step
      if(next<this.selectedCounts.length&&this.selectedCounts[next]!<rank) {
        index=next;rank-=this.selectedCounts[next]!
      }
    }
    return this.selectedSeqs[index]!
  }
  hasRange(start:number,end:number):boolean {
    return this.selectedPrefix(this.selectedBoundary(end+1))>this.selectedPrefix(this.selectedBoundary(start))
  }
  range(start:number,end:number):number[] {
    const first=this.selectedPrefix(this.selectedBoundary(start)),last=this.selectedPrefix(this.selectedBoundary(end+1)),rows:VisibleRetirementRow[]=[]
    for(let rank=first+1;rank<=last;rank++)rows.push(this.rows.get(this.selectedAt(rank))!)
    return rows.sort((left,right)=>left.order-right.order).map(row=>row.seq)
  }
  contiguous(selected:readonly number[]):boolean {
    return selected.every((seq,index)=>this.rows.has(seq)&&(index===selected.length-1||this.next(seq)===selected[index+1]))
  }
  inlineGroups(currentTurn:number):number[][] {
    const groups:number[][]=[]
    for(const start of this.selected('phase')) {
      const owner=this.owner.get(start)
      if(owner===undefined||owner>=currentTurn||!this.ended.has(owner))continue
      const selected=[start]
      let seq=this.next(start)
      while(seq!==undefined&&this.owner.get(seq)===owner) {
        const event=this.cut.at(seq)!
        if(event.type==='tool/result'||event.type==='assistant/message'&&this.internal.has(seq))selected.push(seq)
        else break
        seq=this.next(seq)
      }
      groups.push(selected)
    }
    return groups
  }
  foldNative<T>(identity:object,create:()=>RetirementFold<T>):T {
    let state=this.nativeFolds.get(identity) as NativeFold<T>|undefined
    if(!state) {state={through:0,fold:create()};this.nativeFolds.set(identity,state as NativeFold<unknown>)}
    this.cut.forEachRange(state.through,this.cut.length,event=>state!.fold.advance(event))
    state.through=this.cut.length
    return state.fold.data
  }
  foldVisible<T>(identity:object|string,kind:RetirementCategory,create:()=>RetirementFold<T>):T {
    const category=this.category(kind)
    let state=this.visibleFolds.get(identity) as VisibleFold<T>|undefined
    if(!state||state.repairSeq!==category.repairSeq) {
      state={category:kind,through:category.additions.length,repairSeq:category.repairSeq,fold:create()}
      for(const seq of this.selected(kind))state.fold.advance(this.cut.at(seq)!)
      this.visibleFolds.set(identity,state as VisibleFold<unknown>)
    }else {
      for(let index=state.through;index<category.additions.length;index++) {
        const seq=category.additions[index]!
        if(this.rows.has(seq))state.fold.advance(this.cut.at(seq)!)
      }
      state.through=category.additions.length
    }
    return state.fold.data
  }
}
