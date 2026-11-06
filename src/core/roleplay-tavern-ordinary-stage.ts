/** One preparation owns the ordered ordinary values seen by all producers.
 * Canonical publication belongs to the accepted Native material consumer. */
import {recordSha256,sha256} from './roleplay-data.js'
import {authorChatContributionIdV3} from './roleplay-author-chat-state.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {AuthorOrdinaryMessageCaptureV1} from './tavern-author-prompt-types.mjs'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AcceptedAuthorChatWriteV3,AuthorChatNamespaceRootV3,AuthorMessageTargetV3}
  from './roleplay-author-chat-state-types.js'
import type {TavernPromptMacroSnapshotV1,TavernPromptBindingV1} from './tavern-prompt-transform-types.mjs'

export interface TavernOrdinaryPreparationPlanV1 {
  readonly schemaVersion:1
  readonly encoding:'native-ordinary-preparation-plan-v1'
  readonly inputId:string
  readonly contributionId:string
  readonly attemptId:string
  readonly replacesAttemptId:string|null
  readonly initialRoot:AuthorChatNamespaceRootV3
  readonly writes:readonly AcceptedAuthorChatWriteV3[]
  readonly previousHadWrites?:boolean
  readonly messageGroups?:readonly Omit<TavernOrdinaryPreparationPlanV1,'messageGroups'>[]
}
type Identity=Omit<TavernOrdinaryPreparationPlanV1,'schemaVersion'|'encoding'|'writes'|'messageGroups'|'previousHadWrites'>
type MessageTarget=AuthorMessageTargetV3
type NamespacePlan=Omit<TavernOrdinaryPreparationPlanV1,'messageGroups'>
type StagedOrdinaryEffect={readonly key:string;readonly messageTarget?:MessageTarget}&(
  {readonly operation?:'set';readonly value:MvuJsonValue}|{readonly operation:'delete'})
interface MessageBinding {
  readonly captures:readonly AuthorOrdinaryMessageCaptureV1[]
  readonly state:Pick<CanonicalAuthorChatStateV1,'captureNamespaceWithoutContribution'|'readAcceptedContribution'>
  readonly priorGroups?:readonly NamespacePlan[]
}
export interface TavernOrdinaryPreparationStage {
  readonly initialRoot:AuthorChatNamespaceRootV3
  readonly values:Readonly<Record<string,MvuJsonValue>>
  readonly deletedKeys:readonly string[]|undefined
  readonly hasWrites:boolean
  read(key:string):MvuJsonValue|undefined
  apply(changes:readonly AcceptedAuthorChatWriteV3[]):void
  bindMessages(input:MessageBinding):void
  captureMessages():readonly AuthorOrdinaryMessageCaptureV1[]
  applyEffects(effects:readonly StagedOrdinaryEffect[]):void
  macros(base:TavernPromptMacroSnapshotV1):TavernPromptMacroSnapshotV1
  plan():TavernOrdinaryPreparationPlanV1
}
const text=(value:MvuJsonValue|undefined)=>value==null?'':typeof value==='object'?JSON.stringify(value):String(value)

export function createRoleplayTavernOrdinaryStage(input:Identity&{
  readonly values:Readonly<Record<string,MvuJsonValue>>
  readonly deletedKeys?:readonly string[]
  readonly priorWrites?:readonly AcceptedAuthorChatWriteV3[]
  readonly previousHadWrites?:boolean
}):TavernOrdinaryPreparationStage {
  const {values:initial,deletedKeys=[],priorWrites=[],previousHadWrites,...identity}=input,writes:AcceptedAuthorChatWriteV3[]=[],
    deleted=new Set(deletedKeys)
  let values=initial,sealed=true,version=recordSha256(identity),bindings:readonly TavernPromptBindingV1[]|undefined
  let snapshots=new WeakMap<TavernPromptMacroSnapshotV1,TavernPromptMacroSnapshotV1>()
  let messageSources:readonly AuthorOrdinaryMessageCaptureV1[]=[]
  const messageStages=new Map<string,{source:AuthorOrdinaryMessageCaptureV1;stage:TavernOrdinaryPreparationStage}>(),
    messageCaptures=new Map<string,AuthorOrdinaryMessageCaptureV1>()
  const targetKey=(target:MessageTarget)=>{
    const {ownerSessionId,nativeSeq,messageId,variant}=target.identity
    return JSON.stringify([ownerSessionId,nativeSeq,messageId,variant.kind,variant.kind==='opening-variant'?variant.id:null])
  }
  let createMessageStage:((target:MessageTarget)=>TavernOrdinaryPreparationStage)|undefined
  function apply(changes:readonly AcceptedAuthorChatWriteV3[]) {
    if(!changes.length)return
    const next=sealed?{...values}:values as Record<string,MvuJsonValue>
    for(const write of changes) {
      if(write.key==='stat_data')throw Error('AUTHOR_CHAT_NUMERICAL_KEY_RESERVED')
      if(write.operation==='delete') {
        delete next[write.key]
        deleted.add(write.key)
      }else {
        deleted.delete(write.key)
        if(write.operation==='set')next[write.key]=write.value
        else if(write.operation==='append')next[write.key]=text(next[write.key])+text(write.value)
        else next[write.key]=(Number(next[write.key])||0)+(Number(write.value)||0)
      }
    }
    values=next;sealed=false;writes.push(...changes)
    version=recordSha256({previous:version,changes})
    bindings=undefined;snapshots=new WeakMap()
  }
  apply(priorWrites)
  return {
    initialRoot:identity.initialRoot,
    get values(){sealed=true;return Object.freeze(values)},
    get deletedKeys(){return deleted.size?Object.freeze([...deleted]):undefined},
    read:(key:string)=>values[key],
    apply,
    get hasWrites(){return writes.length>0},
    bindMessages(input) {
      messageSources=input.captures
      for(const capture of messageSources)messageCaptures.set(targetKey(capture.root.namespace.target!),capture)
      const priorByTarget=new Map((input.priorGroups??[]).map(plan=>[targetKey(plan.initialRoot.namespace.target as MessageTarget),plan]))
      createMessageStage=(target:MessageTarget)=>{
        const key=targetKey(target),existing=messageStages.get(key)
        if(existing)return existing.stage
        const source=messageCaptures.get(key)
        if(!source)throw Error('TEMPLATE_MESSAGE_TARGET_UNAVAILABLE')
        const namespace=source.root.namespace,contributionId=authorChatContributionIdV3(namespace,identity.inputId),
          previous=input.state.readAcceptedContribution(namespace,contributionId),
          basis=previous?input.state.captureNamespaceWithoutContribution(namespace,contributionId)
            :{root:source.root,values:source.values,deletedKeys:source.deletedKeys,priorAttemptId:null},
          child=createRoleplayTavernOrdinaryStage({inputId:identity.inputId,contributionId,attemptId:identity.attemptId,
            replacesAttemptId:basis.priorAttemptId,initialRoot:basis.root,values:basis.values,deletedKeys:basis.deletedKeys,
            previousHadWrites:previous?.hasWrites??false,priorWrites:priorByTarget.get(key)?.writes})
        messageStages.set(key,{source,stage:child})
        return child
      }
      // Keep earlier steps and a replacement's old targets, including a target
      // no longer written this step: its empty contribution withdraws old work.
      for(const prior of input.priorGroups??[]) {
        // The current captured view supplies targets. An old plan cannot grant
        // access to an address absent from that view.
        createMessageStage(prior.initialRoot.namespace.target as MessageTarget)
      }
      for(const source of messageSources) {
        const namespace=source.root.namespace,id=authorChatContributionIdV3(namespace,identity.inputId)
        if(input.state.readAcceptedContribution(namespace,id)?.hasWrites)createMessageStage(namespace.target!)
      }
    },
    captureMessages() {
      if(!messageStages.size)return messageSources
      return messageSources.map(source=>{
        const child=messageStages.get(targetKey(source.root.namespace.target!))?.stage
        if(!child)return source
        // The child owns the current deletion set, including its absence
        // after setting a deleted key. Worker captures carry JSON DATA.
        const {deletedKeys:_previousDeleted,...basis}=source,deletedKeys=child.deletedKeys
        return {...basis,values:child.values,...deletedKeys?{deletedKeys}:{},exists:source.exists||child.hasWrites}
      })
    },
    applyEffects(effects) {
      for(const effect of effects) {
        const change:AcceptedAuthorChatWriteV3=effect.operation==='delete'?{key:effect.key,operation:'delete'}
          :{key:effect.key,operation:'set',value:effect.value}
        if(effect.messageTarget) {
          if(!createMessageStage)throw Error('TEMPLATE_MESSAGE_VIEW_UNAVAILABLE')
          createMessageStage(effect.messageTarget).apply([change])
        }else apply([change])
      }
    },
    macros(base:TavernPromptMacroSnapshotV1):TavernPromptMacroSnapshotV1 {
      let snapshot=snapshots.get(base)
      if(snapshot)return snapshot
      bindings??=Object.entries(values).map(([key,value])=>{
        const rendered=text(value)
        return {key,value:rendered,valueSha256:sha256(rendered),read:{kind:'variable',purpose:'read',scope:'chat',
          ownerId:identity.initialRoot.namespace.sessionId,key,present:true,versionSha256:version,
          valueSha256:recordSha256(value),entryId:null,sourcePointer:null}} satisfies TavernPromptBindingV1
      })
      const numerical=base.variableScopes?.chat?.values.stat_data
      const chatValues={...numerical!==undefined?{stat_data:numerical}:{},...values}
      snapshot=Object.freeze({...base,localVariables:[
        ...base.localVariables.filter(binding=>binding.key==='stat_data'),...bindings],
        variableScopes:{...base.variableScopes,chat:{scope:'chat' as const,
          ownerId:identity.initialRoot.namespace.sessionId,versionSha256:version,
          values:chatValues,valuesSha256:recordSha256(chatValues)}}})
      snapshots.set(base,snapshot)
      return snapshot
    },
    plan():TavernOrdinaryPreparationPlanV1 {
      const groups=[...messageStages.values()].map(row=>row.stage.plan())
        .filter(plan=>plan.writes.length||plan.previousHadWrites===true
          ||plan.previousHadWrites===undefined&&plan.replacesAttemptId!==null)
      return {schemaVersion:1,encoding:'native-ordinary-preparation-plan-v1',...identity,writes:[...writes],
        ...previousHadWrites!==undefined?{previousHadWrites}:{},
        ...groups.length?{messageGroups:groups}:{}}
    },
  }
}
