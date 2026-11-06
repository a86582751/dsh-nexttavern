/** Incremental Schema-visible history. Canonical-chat keeps its separate legacy
 * archived-story policy; this owner never substitutes a current surface for a cut. */
import {createSurfaceCursor} from 'dsh-nexttavern-native-session/surface'
import type {SessionMessageProjection,SurfaceCursorTransition} from 'dsh-nexttavern-native-session/surface'
import type {SessionEvent} from 'dsh-nexttavern-native-session/types'
import {recordSha256,textOf} from './roleplay-data.js'
import {projectStoryEvent} from './roleplay-message-view.js'
import {createTaskHistoryClassification} from './tavern-task-context.js'
import type {TaskProjectionTurn,TaskEvent} from './tavern-task-context.js'
import type {SessionHistoryCut,SessionHistoryReader} from './session-history.js'
import type {CompletedStoryBody} from './roleplay-mvu-story.js'

export interface MvuScopeProjectedMessageV2 {
  nativeOwnerSessionId:string
  nativeSeq:number
  messageId:string
  messageVersionSha256:string
  selectedVariant:string
  isSystem:false
}
export interface MvuScopeMessageProjectionViewV2 {
  readonly length:number
  at(index:number):MvuScopeProjectedMessageV2|undefined
  indexOfNativeSeq(seq:number):number|undefined
  range(start?:number,end?:number):IterableIterator<MvuScopeProjectedMessageV2>
}
export interface MvuScopeMessageSpliceV2 {
  kind:'message-splice';index:number;deleteCount:number;messages:readonly MvuScopeProjectedMessageV2[]
}
export interface MvuScopeProjectionResultV2 {
  selection:'visible';owner:object;nativeCut:number;cold:boolean
  messages:MvuScopeMessageProjectionViewV2;changes:readonly MvuScopeMessageSpliceV2[]
}
/** Task consumers intentionally read a structural JSON vocabulary: other
 * Native records (including opening records) remain opaque to these rules. */
const taskFact=(event:SessionEvent)=>event as unknown as TaskEvent

interface Tree {
  readonly key:number;readonly priority:number;readonly size:number
  readonly item:MvuScopeProjectedMessageV2;readonly left:Tree|undefined;readonly right:Tree|undefined
}
const size=(tree:Tree|undefined)=>tree?.size??0
function node(key:number,item:MvuScopeProjectedMessageV2,left?:Tree,right?:Tree,priority=priorityFor(item.nativeSeq)):Tree {
  return {key,item,left,right,priority,size:1+size(left)+size(right)}
}
function priorityFor(seq:number) {
  let value=seq|0
  value=Math.imul(value^(value>>>16),0x45d9f3b);value=Math.imul(value^(value>>>16),0x45d9f3b)
  return (value^(value>>>16))>>>0
}
function split(tree:Tree|undefined,key:number):[Tree|undefined,Tree|undefined] {
  if(!tree)return [undefined,undefined]
  if(tree.key<key) {
    const [left,right]=split(tree.right,key)
    return [node(tree.key,tree.item,tree.left,left,tree.priority),right]
  }
  const [left,right]=split(tree.left,key)
  return [left,node(tree.key,tree.item,right,tree.right,tree.priority)]
}
function merge(left:Tree|undefined,right:Tree|undefined):Tree|undefined {
  if(!left)return right
  if(!right)return left
  return left.priority>=right.priority?node(left.key,left.item,left.left,merge(left.right,right),left.priority)
    :node(right.key,right.item,merge(left,right.left),right.right,right.priority)
}
function put(tree:Tree|undefined,key:number,item:MvuScopeProjectedMessageV2):Tree {
  if(!tree)return node(key,item)
  if(tree.key===key)return node(key,item,tree.left,tree.right,tree.priority)
  const priority=priorityFor(item.nativeSeq)
  if(priority>tree.priority){const [left,right]=split(tree,key);return node(key,item,left,right,priority)}
  return key<tree.key?node(tree.key,tree.item,put(tree.left,key,item),tree.right,tree.priority)
    :node(tree.key,tree.item,tree.left,put(tree.right,key,item),tree.priority)
}
function remove(tree:Tree|undefined,key:number):Tree|undefined {
  if(!tree)return
  if(tree.key===key)return merge(tree.left,tree.right)
  return key<tree.key?node(tree.key,tree.item,remove(tree.left,key),tree.right,tree.priority)
    :node(tree.key,tree.item,tree.left,remove(tree.right,key),tree.priority)
}
function rank(tree:Tree|undefined,key:number):number {
  let count=0
  while(tree) {
    if(tree.key>=key)tree=tree.left
    else {count+=size(tree.left)+1;tree=tree.right}
  }
  return count
}
function messageView(root:Tree|undefined,orders:ReadonlyMap<number,number>):MvuScopeMessageProjectionViewV2 {
  const length=size(root)
  return Object.freeze({length,
    indexOfNativeSeq(seq:number) {
      const order=orders.get(seq)
      if(order===undefined)return
      let tree=root
      while(tree&&tree.key!==order)tree=tree.key>order?tree.left:tree.right
      return tree?.item.nativeSeq===seq?rank(root,order):undefined
    },
    at(index:number) {
      if(!Number.isSafeInteger(index)||index<0||index>=length)return
      let tree=root
      while(tree) {
        const left=size(tree.left)
        if(index===left)return tree.item
        if(index<left)tree=tree.left
        else {index-=left+1;tree=tree.right}
      }
      return undefined
    },
    *range(start=0,end=length) {
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>length) {
        throw Error('SCHEMA_SCOPE_PROJECTION_RANGE_INVALID')
      }
      function* visit(tree:Tree|undefined,base:number):IterableIterator<MvuScopeProjectedMessageV2> {
        if(!tree||base>=end||base+tree.size<=start)return
        const position=base+size(tree.left)
        yield* visit(tree.left,base)
        if(position>=start&&position<end)yield tree.item
        yield* visit(tree.right,position+1)
      }
      yield* visit(root,0)
    },
  })
}
type MessageEvent=Extract<SessionEvent,{type:'user/message'|'assistant/message'}>
interface Candidate {
  event:MessageEvent;order:number;turn:number|string|undefined;effective:TaskProjectionTurn
  text:boolean;messageId:string;message:ReturnType<ReturnType<typeof createSurfaceCursor>['projectedMessageAt']>
  versionMessage?:Candidate['message'];metadata?:MvuScopeProjectedMessageV2
}

/** Completed-turn selection uses Native event order, while scope rows use
 * surface order. Share the task/receipt classifier and exact surface fold,
 * without substituting canonical-chat archives or a nominated message seq. */
export function createMvuCanonicalAssistantCursor(deps:{
  read():SessionHistoryCut<SessionEvent>
  projections:readonly SessionMessageProjection[]
}) {
  const surface=createSurfaceCursor(deps),eventAt=(seq:number)=>seq<surface.length?deps.read().at(seq):undefined,
    tasks=createTaskHistoryClassification(seq=>{const event=eventAt(seq);return event?taskFact(event):undefined}),
    completed=new Set<number>()
  type Assistant=Extract<SessionEvent,{type:'assistant/message'}>
  interface Entry {
    event:Assistant
    effective:TaskProjectionTurn
    message:ReturnType<typeof surface.deriveEventMessage>
    narrative:string
    body?:CompletedStoryBody
  }
  const entries=new Map<number,Entry>(),byTurn=new Map<number,Set<number>>(),
    byTaskTurn=new Map<TaskProjectionTurn,Set<number>>(),canonical=new Map<number,Entry>(),
    endings=new Map<number,{turn:number;body:CompletedStoryBody|undefined}>()
  function refresh(entry:Entry):void {
    const message=surface.deriveEventMessage(entry.event)
    if(message!==entry.message) {
      entry.message=message;entry.narrative=textOf(message?.content);entry.body=undefined
    }
  }
  function body(entry:Entry|undefined):CompletedStoryBody|undefined {
    const message=entry?.message
    if(!entry||!message||typeof message.id!=='string')return
    return entry.body??=Object.freeze({seq:entry.event.seq,messageId:message.id,
      versionSha256:recordSha256(message),narrative:entry.narrative})
  }
  function advance(end:number):void {
    let transition:SurfaceCursorTransition|undefined
    surface.advanceTo(end,value=>{transition=value},event=>{
      const actual=transition;transition=undefined
      const delta=tasks.advance(taskFact(event),actual),dirty=new Set<number>()
      function mark(seq:number):void {
        const entry=entries.get(seq)
        if(entry)dirty.add(Number(entry.event.data.turn))
      }
      function drop(seq:number):void {
        const entry=entries.get(seq)
        if(!entry)return
        const turn=Number(entry.event.data.turn)
        entries.delete(seq);byTurn.get(turn)?.delete(seq);byTaskTurn.get(entry.effective)?.delete(seq);dirty.add(turn)
      }
      if(actual?.kind==='replace')for(const seq of actual.removed)drop(seq)
      if((actual?.kind==='append'||actual?.kind==='replace')&&event.type==='assistant/message') {
        const turn=Number(event.data.turn),effective=tasks.effective(taskFact(event)),
          entry:Entry={event,effective,message:null,narrative:''}
        refresh(entry);entries.set(event.seq,entry)
        let peers=byTurn.get(turn)
        if(!peers){peers=new Set();byTurn.set(turn,peers)}
        peers.add(event.seq)
        let taskPeers=byTaskTurn.get(effective)
        if(!taskPeers){taskPeers=new Set();byTaskTurn.set(effective,taskPeers)}
        taskPeers.add(event.seq);dirty.add(turn)
      }
      if(actual?.kind==='project')for(const seq of actual.changedSeqs) {
        const entry=entries.get(seq)
        if(entry){refresh(entry);mark(seq)}
      }
      if(event.type==='turn/end') {
        const turn=Number(event.data.turn)
        if(event.data.reason.kind==='completed')completed.add(turn)
        dirty.add(turn)
      }
      for(const turn of delta.dirty)for(const seq of byTaskTurn.get(turn)??[])mark(seq)
      for(const seq of delta.changedSeqs)mark(seq)
      for(const turn of dirty) {
        let selected:Entry|undefined
        for(const seq of byTurn.get(turn)??[]) {
          const entry=entries.get(seq)!
          if(entry.event.data.interrupted===true||!entry.narrative.trim()||tasks.internal(taskFact(entry.event))
            ||!completed.has(turn)&&!tasks.committed(seq))continue
          if(!selected||seq>selected.event.seq)selected=entry
        }
        if(selected)canonical.set(turn,selected);else canonical.delete(turn)
      }
      if(event.type==='turn/end') {
        const turn=Number(event.data.turn)
        endings.set(event.seq+1,{turn,body:body(canonical.get(turn))})
      }
    })
  }
  return {
    get length(){return surface.length},
    /** A recorded end keeps its own projected body after later edits/windows. */
    hasEnd(turn:number,end:number):boolean {return endings.get(end)?.turn===turn},
    read(turn:number,end:number):CompletedStoryBody|undefined {
      if(end>=surface.length)advance(end)
      else surface.advanceTo(surface.length)
      const closed=endings.get(end)
      if(closed?.turn===turn)return closed.body
      if(end!==surface.length)throw Error('CANONICAL_ASSISTANT_CUT_UNAVAILABLE')
      return body(canonical.get(turn))
    },
  }
}

export function createMvuScopeProjectionV2(deps:{
  history:SessionHistoryReader
  projections:readonly SessionMessageProjection[]
  ownerForSeq(session:object,seq:number):string
}) {
  let states=new WeakMap<object,ReturnType<typeof createState>>(),disposed=false
  function createState(session:object,cut:SessionHistoryCut<SessionEvent>) {
    let currentCut=cut,nextOrder=0,root:Tree|undefined
    const surface=createSurfaceCursor({read:()=>currentCut,projections:deps.projections})
    const readEvent=(seq:number)=>seq<surface.length?currentCut.at(seq):undefined
    const tasks=createTaskHistoryClassification(seq=>{const event=readEvent(seq);return event?taskFact(event):undefined}),
      positions=new Map<number,number>(),candidates=new Map<number,Candidate>()
    const byTurn=new Map<number|string,Set<number>>(),byTaskTurn=new Map<TaskProjectionTurn,Set<number>>()
    const canonical=new Map<number|string,number>(),published=new Map<number,{candidate:Candidate;metadata:MvuScopeProjectedMessageV2}>()
    const ended=new Set<number>(),completed=new Set<number>()
    let quiet:MvuScopeProjectionResultV2|undefined
    function refresh(candidate:Candidate) {
      const event=candidate.event
      if(event.type==='user/message') {
        const rendered=projectStoryEvent({deriveEventMessage:()=>surface.deriveEventMessage(event)},event)
        candidate.text=!!textOf(rendered.data.content).trim();candidate.messageId=String(rendered.data.id??'')
        candidate.message=surface.projectedMessageAt(event.seq)??event.data
      } else {
        const rendered=projectStoryEvent({deriveEventMessage:()=>surface.deriveEventMessage(event)},event)
        candidate.text=!!textOf(rendered.data.message.content).trim();candidate.messageId=String(rendered.data.message.id??'')
        candidate.message=surface.projectedMessageAt(event.seq)??event.data.message
      }
    }
    function metadata(candidate:Candidate) {
      if(candidate.metadata&&candidate.versionMessage===candidate.message)return candidate.metadata
      const message=candidate.message,nativeOwnerSessionId=deps.ownerForSeq(session,candidate.event.seq)
      if(!message||message.id!==candidate.messageId||!nativeOwnerSessionId)throw Error('SCHEMA_SCOPE_MESSAGE_UNPROVEN')
      const version=recordSha256(message)
      candidate.versionMessage=message
      if(candidate.metadata?.messageVersionSha256===version&&candidate.metadata.nativeOwnerSessionId===nativeOwnerSessionId) {
        return candidate.metadata
      }
      return candidate.metadata=Object.freeze({nativeOwnerSessionId,nativeSeq:candidate.event.seq,messageId:candidate.messageId,
        messageVersionSha256:version,selectedVariant:version,isSystem:false as const})
    }
    function advance(next:SessionHistoryCut<SessionEvent>,end:number,cold:boolean):MvuScopeProjectionResultV2 {
      currentCut=next
      if(quiet&&surface.length===end){surface.advanceTo(end);return quiet}
      const changes:MvuScopeMessageSpliceV2[]=[]
      function output(candidate:Candidate,present:boolean) {
        const seq=candidate.event.seq,old=published.get(seq)
        if(!present) {
          if(!old)return
          const index=rank(root,old.candidate.order);root=remove(root,old.candidate.order);published.delete(seq)
          changes.push({kind:'message-splice',index,deleteCount:1,messages:[]});return
        }
        const value=metadata(candidate)
        if(old&&old.metadata===value)return
        const index=rank(root,candidate.order)
        root=put(root,candidate.order,value);published.set(seq,{candidate,metadata:value})
        changes.push({kind:'message-splice',index,deleteCount:old?1:0,messages:[value]})
      }
      let transition:SurfaceCursorTransition|undefined
      surface.advanceTo(end,value=>{transition=value},event=>{
        const actual=transition;transition=undefined
        const dirty=new Set<number>(),dirtyTurns=new Set<number|string>()
        const delta=tasks.advance(taskFact(event),actual)
        function mark(seq:number) {
          const candidate=candidates.get(seq)
          if(candidate?.event.type==='assistant/message')dirtyTurns.add(candidate.turn!)
          else if(candidate)dirty.add(seq)
        }
        function drop(seq:number) {
          const candidate=candidates.get(seq)
          if(!candidate)return
          output(candidate,false);candidates.delete(seq)
          byTaskTurn.get(candidate.effective)?.delete(seq)
          if(candidate.turn!==undefined){byTurn.get(candidate.turn)?.delete(seq);dirtyTurns.add(candidate.turn)}
        }
        if(actual?.kind==='replace') {
          // Retain historical positions for views whose persistent root still
          // contains a replaced message; current replacements reuse that order.
          const order=positions.get(actual.removed[0]!)!
          for(const seq of actual.removed)drop(seq)
          positions.set(actual.seq,order)
        } else if(actual?.kind==='append') {
          positions.set(actual.seq,nextOrder++)
        }
        if((actual?.kind==='append'||actual?.kind==='replace')
          &&(event.type==='user/message'||event.type==='assistant/message')) {
          const turn=event.type==='assistant/message'?Number(event.data.turn):undefined
          const key=turn===undefined?undefined:Number.isSafeInteger(turn)?turn:`seq:${event.seq}`
          const candidate:Candidate={event,order:positions.get(event.seq)!,turn:key,effective:tasks.effective(taskFact(event)),
            text:false,messageId:'',message:undefined}
          refresh(candidate);candidates.set(event.seq,candidate)
          let peers=byTaskTurn.get(candidate.effective)
          if(!peers){peers=new Set();byTaskTurn.set(candidate.effective,peers)}
          peers.add(event.seq)
          if(key!==undefined){let bucket=byTurn.get(key);if(!bucket){bucket=new Set();byTurn.set(key,bucket)}bucket.add(event.seq)}
          mark(event.seq)
        }
        if(actual?.kind==='project')for(const seq of actual.changedSeqs) {
          const candidate=candidates.get(seq)
          if(candidate){refresh(candidate);mark(seq)}
        }
        if(event.type==='turn/end') {
          const turn=Number(event.data.turn);ended.add(turn)
          if(event.data.reason?.kind==='completed'&&Number.isSafeInteger(turn))completed.add(turn)
          dirtyTurns.add(turn)
        }
        for(const turn of delta.dirty)for(const seq of byTaskTurn.get(turn)??[])mark(seq)
        for(const seq of delta.changedSeqs)mark(seq)
        for(const seq of dirty) {
          const candidate=candidates.get(seq)!,source=candidate.event.type==='user/message'?taskFact(candidate.event).data?.source:undefined
          output(candidate,candidate.text&&!tasks.internal(taskFact(candidate.event))
            &&(source?.kind==='user'||source?.kind==='roleplay'&&source.form==='branch-user'))
        }
        for(const turn of dirtyTurns) {
          let selected:Candidate|undefined
          for(const seq of byTurn.get(turn)??[]) {
            const candidate=candidates.get(seq)!
            if(candidate.event.type!=='assistant/message'||candidate.event.data.interrupted===true
              ||!candidate.text||tasks.internal(taskFact(candidate.event)))continue
            const number=Number(candidate.event.data.turn)
            if(ended.has(number)&&!completed.has(number)&&!tasks.committed(seq))continue
            if(!selected||candidate.order>selected.order)selected=candidate
          }
          const prior=canonical.get(turn)
          if(prior!==undefined&&prior!==selected?.event.seq) {
            const old=published.get(prior)
            if(old)output(old.candidate,false)
          }
          if(selected){canonical.set(turn,selected.event.seq);output(selected,true)}
          else canonical.delete(turn)
        }
      })
      const view=messageView(root,positions)
      const result:MvuScopeProjectionResultV2=Object.freeze({selection:'visible',owner:cut.owner,nativeCut:end,cold,
        messages:view,changes:Object.freeze(changes.map(change=>Object.freeze({...change,messages:Object.freeze(change.messages)})))})
      quiet=Object.freeze({...result,cold:false,changes:Object.freeze([])})
      return result
    }
    return {owner:cut.owner,get nativeCut(){return surface.length},advance}
  }
  return Object.freeze({
    read(session:object,logicalCut:number):MvuScopeProjectionResultV2 {
      if(disposed)throw Error('SCHEMA_SCOPE_PROJECTION_DISPOSED')
      if(!deps.history.cut)throw Error('SCHEMA_SCOPE_PROJECTION_CUT_REQUIRED')
      const cut=deps.history.cut<SessionEvent>(session)
      if(!Number.isSafeInteger(logicalCut)||logicalCut<0||logicalCut>cut.length)throw Error('SCHEMA_SCOPE_PROJECTION_CUT_INVALID')
      let state=states.get(session)
      const cold=!state||state.owner!==cut.owner||logicalCut<state.nativeCut
      if(cold){state=createState(session,cut);states.set(session,state)}
      try {return state!.advance(cut,logicalCut,cold)} catch(error) {
        // Native transitions already committed before the observer runs. A
        // failed owner/message join must rebuild, never publish a partial cut.
        states.delete(session)
        throw error
      }
    },
    dispose(){disposed=true;states=new WeakMap()},
  })
}
