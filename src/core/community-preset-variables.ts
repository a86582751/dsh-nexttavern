/** Preset globals own one record. Ordinary chat values belong solely to the
 * canonical State namespace, including accepted regeneration contributions. */
import {recordSha256} from './roleplay-data.js'
import {withTavernLock} from './tavern-task-support.js'
import {authorChatEventKeyV3,authorChatContributionIdV3} from './roleplay-author-chat-state.js'
import {readAcceptedPreparationPlanRecord} from './community-preset-settlement.js'
import type {AcceptedPreparationRecord} from './community-preset-settlement.js'
import type {TavernOrdinaryPreparationPlanV1} from './roleplay-tavern-ordinary-stage.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {AuthorChatNamespaceV3,AuthorChatNamespaceRootV3,AuthorChatRefV1,
  AcceptedAuthorChatContributionV3,AcceptedAuthorChatWriteV3,AcceptedAuthorChatReceiptV3,
  AcceptedAuthorChatCommitV3} from './roleplay-author-chat-state-types.js'
import type {CommunityPresetTable,CommunityVariableConfiguration} from './community-presets.js'
import type {CommunityJson} from './community-preset-types.js'
import type {CommunityMacroWrite} from './community-preset-macros.js'

interface ConversationGlobals {
  globalBaselines:Record<string,Record<string,CommunityJson>>
  accepted:Record<string,{digest:string}>
}
interface GlobalRecord {
  schemaVersion:1
  revision:number
  global:Record<string,CommunityJson>
  globalBase:Record<string,CommunityJson>
  publications:{source:string;writes:readonly CommunityMacroWrite[]}[]
  configurationApplied:string[]
  conversations:Record<string,ConversationGlobals>
  /** A confirmed Source replacement can retire an unpublished intent. */
  outcomes:Record<string,string>
}
interface PresetVariables extends GlobalRecord {
  pending?:{intent:AcceptedAuthorChatContributionV3;next:GlobalRecord}
}
export interface CommunityVariableAttempt {
  schemaVersion:1
  presetId:string
  sessionId:string
  inputId:string
  attemptId:string
  chat:Record<string,CommunityJson>
  global:Record<string,CommunityJson>
  chatRoot:AuthorChatNamespaceRootV3
  contributionId:string
  replacesAttemptId:string|null
  globalRevision:number
  globalContributionPresent:boolean
}
interface Dependencies {
  readonly state:Pick<CanonicalAuthorChatStateV1,'captureNamespaceWithoutContribution'|'readAcceptedContribution'
    |'lookupAcceptedContribution'|'confirmAcceptedContribution'|'replaceAcceptedContribution'>
  captureNamespace(sessionId:string):{readonly namespace:AuthorChatNamespaceV3;current():boolean}
  isNamespaceReady(namespace:AuthorChatNamespaceV3):boolean
  readyNamespace(namespace:AuthorChatNamespaceV3):Promise<void>
  withSourceLock<T>(sessionId:string,work:()=>Promise<T>):Promise<T>
}
type ChatReceipt=AcceptedAuthorChatCommitV3|Extract<AcceptedAuthorChatReceiptV3,{kind:'applied'}>
interface CommitResult {
  readonly committed:boolean
  readonly revision:number
  readonly outcome:'applied'|'retired'
  readonly chatReceipt?:ChatReceipt
}
const clone=<T>(value:T):T=>structuredClone(value)
const empty=():GlobalRecord=>({schemaVersion:1,revision:0,global:{},globalBase:{},publications:[],
  configurationApplied:[],conversations:{},outcomes:{}})
const globalKey=(presetId:string)=>`community-global-v1__${presetId}`
const operationId=(plan:TavernOrdinaryPreparationPlanV1)=>'ordinary-preparation-'+recordSha256({
  contributionId:plan.contributionId,attemptId:plan.attemptId})
function apply(target:Record<string,CommunityJson>,write:CommunityMacroWrite) {
  if(write.operation==='delete')delete target[write.key]
  else if(write.operation==='add')target[write.key]=(Number(target[write.key]??0)||0)+(Number(write.value)||0)
  else if(write.operation==='append')target[write.key]=String(target[write.key]??'')+String(write.value??'')
  else target[write.key]=clone(write.value)
}
const chatWrites=(writes:readonly CommunityMacroWrite[]):AcceptedAuthorChatWriteV3[]=>writes
  .filter(write=>write.scope==='chat').map(write=>write.operation==='delete'
    ?{key:write.key,operation:'delete'}:{key:write.key,operation:write.operation,value:write.value})

export function createCommunityPresetVariables(table:CommunityPresetTable,deps:Dependencies) {
  const publishing=new WeakMap<object,string>()
  function raw(presetId:string):PresetVariables {
    const record=table.get(globalKey(presetId)) as PresetVariables|undefined
    if(record&&record.schemaVersion!==1)throw Error('社区变量版本不受支持')
    return record??empty()
  }
  function effective(record:PresetVariables):GlobalRecord {
    return record.pending&&deps.state.lookupAcceptedContribution(record.pending.intent).kind==='applied'
      ?record.pending.next:record
  }
  function read(presetId:string):GlobalRecord {return effective(raw(presetId))}
  async function publish(presetId:string,record:PresetVariables) {
    const key=globalKey(presetId)
    publishing.set(record,key)
    try {
      try {await table.put(key,record)}catch(error) {
        // Only this exact durable row confirms a lost put ACK. A pending row
        // must be confirmed before the canonical chat publication can begin.
        if(recordSha256(table.get(key))!==recordSha256(record))throw error
      }
    }finally {publishing.delete(record)}
  }
  function intentFor(record:AcceptedPreparationRecord,hasGlobals:boolean,
    plan=record.ordinaryChat):AcceptedAuthorChatContributionV3|undefined {
    if(!plan.writes.length&&!hasGlobals&&(plan.replacesAttemptId===null||plan.previousHadWrites===false))return
    return {namespace:plan.initialRoot.namespace,contributionId:plan.contributionId,
      attemptId:plan.attemptId,replacesAttemptId:plan.replacesAttemptId,operationId:operationId(plan),
      writes:plan.writes,source:{kind:'native-material',ref:record.acceptedMaterialRef},
      cause:{kind:'ordinary-preparation',inputId:plan.inputId,attemptId:plan.attemptId}}
  }
  async function withCurrentSource<T>(namespace:AuthorChatNamespaceV3,work:(current:()=>boolean)=>Promise<T>,retire:()=>Promise<T>) {
    return deps.withSourceLock(namespace.sessionId,async()=>{
      const source=deps.captureNamespace(namespace.sessionId)
      if(!source.current())throw Error('ORDINARY_PREPARATION_SOURCE_CHANGED')
      const {target:_target,...sourceNamespace}=namespace
      if(recordSha256(source.namespace)!==recordSha256(sourceNamespace))return retire()
      return work(source.current)
    })
  }
  async function writeChat(intent:AcceptedAuthorChatContributionV3,retire:()=>Promise<CommitResult>)
    :Promise<ChatReceipt|CommitResult> {
    const published=deps.state.lookupAcceptedContribution(intent)
    if(published.kind==='applied') {
      await deps.state.confirmAcceptedContribution(intent)
      return published
    }
    return withCurrentSource<ChatReceipt|CommitResult>(intent.namespace,
      current=>deps.state.replaceAcceptedContribution(intent,{ownsNamespace:()=>true,isCurrent:current,
        beforeWrite({key,value}){publishing.set(value,key);return()=>publishing.delete(value)}}),retire)
  }
  async function retire(presetId:string,record:PresetVariables,intent:AcceptedAuthorChatContributionV3)
    :Promise<CommitResult> {
    const {pending:_pending,...base}=record,receipt=deps.state.lookupAcceptedContribution(intent),
      next={...base,revision:base.revision+1,outcomes:{...base.outcomes,[intent.operationId]:receipt.inputSha256}}
    await publish(presetId,next)
    return {committed:false,revision:next.revision,outcome:'retired'}
  }
  async function settlePending(presetId:string):Promise<CommitResult|undefined> {
    const record=raw(presetId),pending=record.pending
    if(!pending)return
    await deps.readyNamespace(pending.intent.namespace)
    const receipt=await writeChat(pending.intent,()=>retire(presetId,record,pending.intent))
    if('outcome' in receipt)return receipt
    await publish(presetId,pending.next)
    return {committed:receipt.kind==='committed',revision:pending.next.revision,outcome:'applied',chatReceipt:receipt}
  }
  async function coordinate(presetId:string,record:GlobalRecord,intent:AcceptedAuthorChatContributionV3|undefined,
    next:GlobalRecord|undefined):Promise<CommitResult> {
    if(!intent) {
      if(next)await publish(presetId,next)
      return {committed:!!next,revision:next?.revision??record.revision,outcome:'applied'}
    }
    const known=deps.state.lookupAcceptedContribution(intent)
    if(record.outcomes[intent.operationId]===known.inputSha256)
      return {committed:false,revision:record.revision,outcome:'retired'}
    if(known.kind==='applied') {
      await deps.state.confirmAcceptedContribution(intent)
      if(!next)return {committed:false,revision:record.revision,outcome:'applied',chatReceipt:known}
      return withCurrentSource<CommitResult>(intent.namespace,async current=>{
        if(!current())throw Error('ORDINARY_PREPARATION_SOURCE_CHANGED')
        await publish(presetId,next)
        return {committed:true,revision:next.revision,outcome:'applied',chatReceipt:known}
      },()=>retire(presetId,record,intent))
    }
    if(next) {
      await publish(presetId,{...record,pending:{intent,next}})
      return (await settlePending(presetId))!
    }
    const receipt=await writeChat(intent,()=>retire(presetId,record,intent))
    return 'outcome' in receipt?receipt:{committed:receipt.kind==='committed',revision:record.revision,
      outcome:'applied',chatReceipt:receipt}
  }
  function capture(presetId:string,sessionId:string,inputId:string,attemptId:string):CommunityVariableAttempt {
    const {namespace}=deps.captureNamespace(sessionId),id=authorChatContributionIdV3(namespace,inputId),record=read(presetId),
      basis=deps.state.captureNamespaceWithoutContribution(namespace,id),
      conversation=record.conversations[sessionId],saved=conversation?.globalBaselines[id]
    let global=saved??record.global
    if(!saved&&basis.priorAttemptId!==null) {
      const accepted=deps.state.readAcceptedContribution(namespace,id)
      if(accepted?.firstSource.kind==='native-material') {
        const ref=accepted.firstSource.ref,original=readAcceptedPreparationPlanRecord(table.get(ref.key),ref.sha256)
        if(!original)throw Error('COMMUNITY_ACCEPTED_PLAN_UNAVAILABLE')
        if(original.community?.attempt.presetId===presetId)global=original.community.attempt.global
      }
    }
    return {schemaVersion:1,presetId,sessionId,inputId,attemptId,chat:clone({...basis.values}),global:clone(global),
      chatRoot:basis.root,contributionId:id,replacesAttemptId:basis.priorAttemptId,globalRevision:record.revision,
      globalContributionPresent:record.publications.some(row=>row.source===id&&row.writes.length>0)}
  }
  async function commitChatPreparation(preparation:AcceptedPreparationRecord):Promise<CommitResult> {
    const {ordinaryChat:plan,community,acceptedMaterialRef}=preparation,
      globalWrites=community?.writes.filter(write=>write.scope==='global')??[],
      hasGlobals=community!==undefined&&(globalWrites.length>0||community.attempt.globalContributionPresent),
      intent=intentFor(preparation,hasGlobals)
    if(!community) {
      if(!intent)return {committed:false,revision:0,outcome:'applied'}
      await deps.readyNamespace(intent.namespace)
      const receipt=await writeChat(intent,async()=>({committed:false,revision:0,outcome:'retired'}))
      return 'outcome' in receipt?receipt:{committed:receipt.kind==='committed',revision:0,outcome:'applied',chatReceipt:receipt}
    }
    const {attempt}=community
    return withTavernLock(table,globalKey(attempt.presetId),async()=>{
      await settlePending(attempt.presetId)
      if(intent)await deps.readyNamespace(intent.namespace)
      const record=read(attempt.presetId),digest=recordSha256(acceptedMaterialRef),
        source=plan.contributionId,sessionId=plan.initialRoot.namespace.sessionId,
        receiptId=intent?.operationId??operationId(plan),conversation=record.conversations[sessionId],
        already=conversation?.accepted[receiptId]?.digest===digest,
        changesGlobal=hasGlobals
      let next:GlobalRecord|undefined
      if(changesGlobal&&!already) {
        next=clone(record)
        const chat=next.conversations[sessionId]??={globalBaselines:{},accepted:{}}
        if(!Object.hasOwn(chat.globalBaselines,source))chat.globalBaselines[source]=clone(attempt.global)
        const previous=next.publications.find(row=>row.source===source)
        next.publications=next.publications.filter(row=>row.source!==source)
        next.publications.push({source,writes:clone(globalWrites)})
        if(previous?.writes.length) {
          next.global=clone(next.globalBase)
          for(const publication of next.publications)for(const write of publication.writes)apply(next.global,write)
        }else for(const write of globalWrites)apply(next.global,write)
        chat.accepted[receiptId]={digest};next.revision++
      }
      return coordinate(attempt.presetId,record,intent,next)
    })
  }
  async function commitPreparation(preparation:AcceptedPreparationRecord):Promise<CommitResult> {
    let result=await commitChatPreparation(preparation)
    if(result.outcome==='retired')return result
    // Every group retains its own State intent/receipt. A failed later write
    // leaves the existing preparation pending; retry confirms earlier groups
    // without rerunning author code or claiming cross-namespace atomicity.
    for(const plan of preparation.ordinaryChat.messageGroups??[]) {
      const intent=intentFor(preparation,false,plan)
      if(!intent)continue
      await deps.readyNamespace(intent.namespace)
      const receipt=await writeChat(intent,async()=>({...result,outcome:'retired' as const}))
      if('outcome' in receipt)return receipt
      result={...result,committed:result.committed||receipt.kind==='committed'}
    }
    return result
  }
  async function setGlobal(presetId:string,key:string,value:CommunityJson) {
    return withTavernLock(table,globalKey(presetId),async()=>{
      await settlePending(presetId)
      const record=clone(read(presetId));record.globalBase[key]=clone(value);record.global[key]=clone(value)
      for(const publication of record.publications)publication.writes=publication.writes.filter(write=>write.key!==key)
      record.revision++;await publish(presetId,record);return record.revision
    })
  }
  async function configure(presetId:string,sessionId:string,configurations:readonly CommunityVariableConfiguration[]) {
    return withTavernLock(table,globalKey(presetId),async()=>{
      if(!configurations.length)await settlePending(presetId)
      for(const configuration of configurations) {
        await settlePending(presetId)
        const {namespace}=deps.captureNamespace(sessionId),record=read(presetId),id='community-config-'+configuration.id,
          globalPending=!record.configurationApplied.includes(configuration.id),
          chatPending=!deps.state.readAcceptedContribution(namespace,id),
          selected=configuration.writes.filter(write=>write.scope==='global'?globalPending:chatPending)
            .map(write=>write.operation==='delete'?write:{...write,operation:'set' as const}),
          local=chatWrites(selected),globalWrites=selected.filter(write=>write.scope==='global')
        if(!local.length&&!globalWrites.length)continue
        const intent:AcceptedAuthorChatContributionV3|undefined=local.length?{
          namespace,contributionId:id,attemptId:configuration.id,replacesAttemptId:null,
          operationId:'community-config-'+recordSha256({namespace,id}),writes:local,
          source:{kind:'preset-configuration',configurationId:configuration.id,presetId,
            conversationId:configuration.conversationId},cause:{kind:'community-configuration',presetId,
            configurationId:configuration.id}}:undefined
        let next:GlobalRecord|undefined
        if(globalWrites.length) {
          next=clone(record)
          for(const write of globalWrites) {
            apply(next.globalBase,write);apply(next.global,write)
            for(const publication of next.publications)publication.writes=publication.writes.filter(prior=>prior.key!==write.key)
          }
          next.configurationApplied.push(configuration.id);next.revision++
        }
        await coordinate(presetId,record,intent,next)
      }
    })
  }
  function receiptFacts(preparation:AcceptedPreparationRecord) {
    const {ordinaryChat:plan,community,acceptedMaterialRef}=preparation,
      hasGlobals=community!==undefined&&(community.writes.some(write=>write.scope==='global')||community.attempt.globalContributionPresent),
      intent=intentFor(preparation,hasGlobals),record=community?raw(community.attempt.presetId):undefined,keys:string[]=[]
    if(intent)keys.push(authorChatEventKeyV3(intent.namespace,intent.operationId))
    if(hasGlobals)keys.push(globalKey(community!.attempt.presetId))
    // A durable intent still needs the async coordinator. Its Native session
    // may not be loaded yet, so scheduling cannot use a synchronous receipt.
    if(record?.pending) {
      if(!hasGlobals)keys.push(globalKey(community!.attempt.presetId))
      return {accepted:false,keys}
    }
    let accepted=true
    if(intent) {
      if(!deps.isNamespaceReady(intent.namespace))return {accepted:false,keys}
      const receipt=deps.state.lookupAcceptedContribution(intent)
      if(record?.outcomes[intent.operationId]===receipt.inputSha256)
        return {accepted:true,keys:[...keys,globalKey(community!.attempt.presetId)]}
      accepted=receipt.kind==='applied'
      if(receipt.kind==='applied')keys.push(receipt.publication.key)
    }
    if(hasGlobals) {
      accepted&&=record!.conversations[plan.initialRoot.namespace.sessionId]?.accepted[intent?.operationId??operationId(plan)]?.digest
        ===recordSha256(acceptedMaterialRef)
    }
    for(const group of plan.messageGroups??[]) {
      const message=intentFor(preparation,false,group)
      if(!message)continue
      keys.push(authorChatEventKeyV3(message.namespace,message.operationId))
      if(!deps.isNamespaceReady(message.namespace)){accepted=false;continue}
      const receipt=deps.state.lookupAcceptedContribution(message)
      accepted&&=receipt.kind==='applied'
      if(receipt.kind==='applied')keys.push(receipt.publication.key)
    }
    return {accepted,keys}
  }
  return {capture,commitPreparation,setGlobal,configure,receiptFacts,
    isPublishing:(key:string,value:unknown)=>value!==null&&typeof value==='object'&&publishing.get(value)===key,
    readGlobal:(presetId:string)=>{const record=read(presetId);return {revision:record.revision,values:clone(record.global)}}}
}
