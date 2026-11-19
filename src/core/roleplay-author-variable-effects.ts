/** Ordered ordinary writes and replaceable accepted contributions. Native
 * chat and shared Domain scopes keep their own publication authorities. */
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AcceptedAuthorChatWriteV3,AuthorChatRefV1,AuthorChatRevisionV1}
  from './roleplay-author-chat-state-types.js'

const frozen=new WeakSet<object>()
export function freezeAuthorVariableDataV1<T>(value:T):T {
  if(value&&typeof value==='object') {
    if(frozen.has(value))return value
    for(const child of Object.values(value))freezeAuthorVariableDataV1(child)
    Object.freeze(value);frozen.add(value)
  }
  return value
}

export interface AuthorVariableKeyResultV1 {
  readonly key:string
  readonly revision:AuthorChatRevisionV1
  readonly exists:boolean
  readonly value:MvuJsonValue|null
}
export interface AuthorVariableEffectV1 {
  readonly position:number
  readonly contributionId:string|null
  readonly writes:readonly AcceptedAuthorChatWriteV3[]
  readonly result:{readonly exists:boolean;readonly value:MvuJsonValue|null}
}
export interface AuthorVariableKeyStateV1 {
  effects:AuthorVariableEffectV1[]
  current:AuthorVariableKeyResultV1
  effective?:{ref:AuthorChatRefV1|null;fence:number;
    results:WeakMap<AuthorVariableEffectV1,AuthorVariableEffectV1['result']>}
}
export interface AuthorVariableKeyChangeV1 {
  readonly start:number
  readonly remove:number
  readonly insert:AuthorVariableEffectV1|null
  readonly updates:readonly {index:number;effect:AuthorVariableEffectV1}[]
  current:AuthorVariableKeyResultV1
}
export interface AuthorVariableContributionV1<TSource> {
  position:number
  attemptId:string
  keys:readonly string[]
  firstSource:TSource
}
export interface AuthorVariableEffectIndexV1<TSource> {
  keys:Map<string,AuthorVariableKeyStateV1>
  contributions:Map<string,AuthorVariableContributionV1<TSource>>
  nextPosition:number
}
export interface AuthorVariableProjectionInputV1<TSource> {
  readonly writes:readonly AcceptedAuthorChatWriteV3[]
  readonly contribution?:{readonly id:string;readonly attemptId:string;readonly source:TSource}
}
const appendText=(value:MvuJsonValue|null):string=>value===null?'':
  typeof value==='object'?JSON.stringify(value):String(value)

export function applyAuthorVariableWritesV1(before:AuthorVariableEffectV1['result'],writes:readonly AcceptedAuthorChatWriteV3[])
  :AuthorVariableEffectV1['result'] {
  let {exists,value}=before
  for(const write of writes) {
    if(write.operation==='delete'){exists=false;value=null;continue}
    if(write.operation==='set')value=write.value
    else if(write.operation==='append')value=appendText(value)+appendText(write.value)
    else value=(Number(value)||0)+(Number(write.value)||0)
    exists=true
  }
  return {exists,value}
}

export function replaceAuthorVariableEffectV1(state:AuthorVariableKeyStateV1|undefined,
  position:number,contributionId:string|null,writes:readonly AcceptedAuthorChatWriteV3[]) {
  const effects=state?.effects??[]
  let start=effects.length
  // A replacement changes only its fixed position and dependent suffix.
  while(start>0&&effects[start-1]!.position>=position)start--
  const remove=effects[start]?.contributionId===contributionId&&effects[start]?.position===position?1:0
  let value=start?effects[start-1]!.result:{exists:false,value:null}
  const insert=writes.length?{position,contributionId,writes,result:applyAuthorVariableWritesV1(value,writes)}:null,
    updates:{index:number;effect:AuthorVariableEffectV1}[]=[]
  if(insert)value=insert.result
  let result=start+remove<effects.length?effects.at(-1)!.result:value
  for(let i=start+remove;i<effects.length;i++) {
    const effect=effects[i]!
    // Absolute writes own the rest of this key independently of the prefix.
    if(effect.writes.some(write=>write.operation==='set'||write.operation==='delete'))break
    value=applyAuthorVariableWritesV1(value,effect.writes)
    updates.push({index:i,effect:{...effect,result:value}})
    if(i===effects.length-1)result=value
  }
  return {start,remove,insert,updates,result}
}

export function projectAuthorVariableWritesV1<TSource>(current:AuthorVariableEffectIndexV1<TSource>,
  input:AuthorVariableProjectionInputV1<TSource>,eventRef:AuthorChatRefV1) {
  const contribution=input.contribution,prior=contribution?current.contributions.get(contribution.id):undefined,
    position=prior?.position??current.nextPosition,grouped=new Map<string,AcceptedAuthorChatWriteV3[]>()
  for(const write of input.writes) {
    const group=grouped.get(write.key)??[]
    group.push(write);grouped.set(write.key,group)
  }
  const affected=new Set([...(prior?.keys??[]),...grouped.keys()]),keys=new Map<string,AuthorVariableKeyChangeV1>()
  for(const key of affected) {
    const before=current.keys.get(key),change=replaceAuthorVariableEffectV1(before,position,
      contribution?.id??null,grouped.get(key)??[]),
      revision={revision:(before?.current.revision.revision??0)+1,head:eventRef}
    keys.set(key,{...change,current:{key,revision,...change.result}})
  }
  return {keys,contribution:contribution?{id:contribution.id,
    value:{position,attemptId:contribution.attemptId,keys:[...grouped.keys()],
      firstSource:prior?.firstSource??contribution.source}}:null,
    nextPosition:prior?current.nextPosition:current.nextPosition+1}
}

export function applyAuthorVariableProjectionV1<TSource>(current:AuthorVariableEffectIndexV1<TSource>,
  change:ReturnType<typeof projectAuthorVariableWritesV1<TSource>>) {
  for(const [key,value] of change.keys) {
    const state=current.keys.get(key)??{effects:[],current:value.current},shift=(value.insert?1:0)-value.remove
    if(value.insert&&value.start===state.effects.length)state.effects.push(value.insert)
    else state.effects.splice(value.start,value.remove,...(value.insert?[value.insert]:[]))
    for(const update of value.updates)state.effects[update.index+shift]=update.effect
    state.current=value.current
    current.keys.set(key,state)
  }
  if(change.contribution)current.contributions.set(change.contribution.id,change.contribution.value)
  current.nextPosition=change.nextPosition
}
