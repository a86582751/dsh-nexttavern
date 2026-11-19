/** Native acceptance coordinates chat, shared scopes and message contributions.
 * Shared values and operation receipts belong to the persistent scope owner. */
import {randomUUID} from 'node:crypto'
import {recordSha256} from './roleplay-data.js'
import {withTavernLock} from './tavern-task-support.js'
import {authorChatEventKeyV3,authorChatContributionIdV3} from './roleplay-author-chat-state.js'
import {authorPersistentScopeContributionIdV1,authorPersistentScopeEventKeyV1,authorPersistentScopeHeadKeyV1}
  from './roleplay-author-persistent-scopes.js'
import type {RoleplayAuthorPersistentScopesV1} from './roleplay-author-persistent-scopes.js'
import {AUTHOR_PROFILE_IDENTITY_KEY,readAuthorProfileIdentityV1} from './roleplay-author-profile.js'
import type {AuthorProfileIdentityV1} from './roleplay-author-profile.js'
import type {AuthorPersistentScopeAddressV1,AuthorPersistentScopeCaptureV1,
  AuthorPersistentScopeContributionV1} from './roleplay-author-scope-types.js'
import {readAcceptedPreparationPlanRecord} from './community-preset-settlement.js'
import type {AcceptedPreparationRecord,PreparationAcceptanceV1} from './community-preset-settlement.js'
import type {TavernOrdinaryPreparationPlanV1} from './roleplay-tavern-ordinary-stage.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {AuthorChatNamespaceV3,AuthorChatNamespaceRootV3,AuthorChatRefV1,
  AcceptedAuthorChatContributionV3,AcceptedAuthorChatWriteV3,AcceptedAuthorChatReceiptV3,
  AcceptedAuthorChatCommitV3} from './roleplay-author-chat-state-types.js'
import type {CommunityPresetTable,CommunityVariableConfiguration} from './community-presets.js'
import type {CommunityJson} from './community-preset-types.js'
import type {CommunityMacroWrite} from './community-preset-macros.js'

export interface SharedScopePreparationCaptureV1 {
  readonly schemaVersion:1
  readonly address:AuthorPersistentScopeAddressV1
  /** Original first accepted input, recovered by its immutable Native plan. */
  readonly baseline:AuthorPersistentScopeCaptureV1
  readonly contributionId:string
  readonly attemptId:string
  readonly replacesAttemptId:string|null
  readonly globalContributionPresent:boolean
}
export interface SharedScopePreparationPlanV1 extends SharedScopePreparationCaptureV1 {
  readonly writes:readonly AcceptedAuthorChatWriteV3[]
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
  scopeRef?:AuthorChatRefV1|null
  contributionId:string
  replacesAttemptId:string|null
  globalRevision:number
  globalContributionPresent:boolean
  sharedScope:SharedScopePreparationCaptureV1
}
interface Dependencies {
  readonly profile:AuthorProfileIdentityV1
  readonly scopes:RoleplayAuthorPersistentScopesV1
  readonly state:Pick<CanonicalAuthorChatStateV1,'captureNamespaceWithoutContribution'|'readAcceptedContribution'
    |'lookupAcceptedContribution'|'confirmAcceptedContribution'|'replaceAcceptedContribution'>
  captureNamespace(sessionId:string):{readonly namespace:AuthorChatNamespaceV3;current():boolean}
  isNamespaceReady(namespace:AuthorChatNamespaceV3):boolean
  readyNamespace(namespace:AuthorChatNamespaceV3):Promise<void>
  withSourceLock<T>(sessionId:string,work:()=>Promise<T>):Promise<T>
}
type ChatReceipt=AcceptedAuthorChatCommitV3|Extract<AcceptedAuthorChatReceiptV3,{kind:'applied'}>
interface ConfirmedReceipt {readonly event:AuthorChatRefV1;readonly publication:AuthorChatRefV1}
interface AcceptedPreparationOutcome {
  readonly schemaVersion:1
  readonly encoding:'accepted-preparation-outcome-v1'
  readonly acceptedMaterialRef:AuthorChatRefV1
  readonly contributionId:string
  readonly attemptId:string
  readonly outcome:'retired'
  readonly reason:'source-replaced'
  readonly confirmed:readonly ConfirmedReceipt[]
}
interface CommitResult {
  readonly committed:boolean
  readonly revision:number
  readonly outcome:'applied'|'retired'
  readonly chatReceipt?:ChatReceipt
}
const clone=<T>(value:T):T=>structuredClone(value)
const operationId=(plan:Pick<TavernOrdinaryPreparationPlanV1,'contributionId'|'attemptId'>)=>
  'ordinary-preparation-'+recordSha256({contributionId:plan.contributionId,attemptId:plan.attemptId})
const outcomeKey=(record:AcceptedPreparationRecord)=>'accepted-preparation-retired-'+recordSha256({
  contributionId:record.ordinaryChat.contributionId,attemptId:record.ordinaryChat.attemptId})
const variableWrites=(writes:readonly CommunityMacroWrite[],scope:'chat'|'global'):AcceptedAuthorChatWriteV3[]=>writes
  .filter(write=>write.scope===scope).map(write=>write.operation==='delete'
    ?{key:write.key,operation:'delete'}:{key:write.key,operation:write.operation,value:write.value})

export function createCommunityPresetVariables(table:CommunityPresetTable,deps:Dependencies) {
  const publishing=new WeakMap<object,string>(),address:AuthorPersistentScopeAddressV1=Object.freeze({
    schemaVersion:1,profileId:deps.profile.profileId,scope:'global'})
  const profileCurrent=()=>readAuthorProfileIdentityV1(table)?.profileId===deps.profile.profileId
  const owns=(target:AuthorPersistentScopeAddressV1)=>target.scope==='global'
    &&target.profileId===address.profileId&&target.schemaVersion===1
  function assertAcceptance(acceptance:PreparationAcceptanceV1) {
    if(!acceptance.current())throw Error('ORDINARY_PREPARATION_ACCEPTANCE_CHANGED')
  }
  function captureSharedScopes(sessionId:string,inputId:string,attemptId:string):SharedScopePreparationCaptureV1 {
    const {namespace}=deps.captureNamespace(sessionId),chatId=authorChatContributionIdV3(namespace,inputId),
      contributionId=authorPersistentScopeContributionIdV1(address,chatId),
      previous=deps.scopes.readContribution(address,contributionId),
      chat=deps.state.readAcceptedContribution(namespace,chatId),first=previous?.firstSource??chat?.firstSource
    let baseline:AuthorPersistentScopeCaptureV1
    if(first?.kind==='native-material') {
      const original=readAcceptedPreparationPlanRecord(table.get(first.ref.key),first.ref.sha256),
        saved=original?.sharedScopes?.find(scope=>scope.contributionId===contributionId)
      if(!saved)throw Error('SHARED_SCOPE_ACCEPTED_PLAN_UNAVAILABLE')
      baseline=saved.baseline
    }else baseline=deps.scopes.capture(address)
    return {schemaVersion:1,address,baseline,contributionId,attemptId,
      replacesAttemptId:previous?.attemptId??null,globalContributionPresent:previous?.hasWrites??false}
  }
  function capture(presetId:string,sessionId:string,inputId:string,attemptId:string,
    capturedScope?:SharedScopePreparationCaptureV1):CommunityVariableAttempt {
    const {namespace}=deps.captureNamespace(sessionId),id=authorChatContributionIdV3(namespace,inputId),
      basis=deps.state.captureNamespaceWithoutContribution(namespace,id),
      sharedScope=capturedScope??captureSharedScopes(sessionId,inputId,attemptId)
    return {schemaVersion:1,presetId,sessionId,inputId,attemptId,chat:clone({...basis.values}),
      global:clone({...sharedScope.baseline.values}),chatRoot:basis.root,
      ...basis.scopeRef!==undefined?{scopeRef:basis.scopeRef}:{},contributionId:id,replacesAttemptId:basis.priorAttemptId,
      globalRevision:sharedScope.baseline.revision,globalContributionPresent:sharedScope.globalContributionPresent,sharedScope}
  }
  function captureDisplay(sessionId:string) {
    const {namespace}=deps.captureNamespace(sessionId),
      chatCapture=deps.state.captureNamespaceWithoutContribution(namespace,authorChatContributionIdV3(namespace,'display')),
      global=deps.scopes.capture(address)
    return {chat:clone({...chatCapture.values}),global:clone({...global.values}),chatCapture}
  }
  function intentFor(record:AcceptedPreparationRecord,anchor=false,
    plan=record.ordinaryChat):AcceptedAuthorChatContributionV3|undefined {
    if(!plan.writes.length&&!anchor&&(plan.replacesAttemptId===null||plan.previousHadWrites===false))return
    return {namespace:plan.initialRoot.namespace,contributionId:plan.contributionId,
      ...plan.expectedScopeRef!==undefined?{expectedScopeRef:plan.expectedScopeRef}:{},
      attemptId:plan.attemptId,replacesAttemptId:plan.replacesAttemptId,operationId:operationId(plan),
      writes:plan.writes,source:{kind:'native-material',ref:record.acceptedMaterialRef},
      cause:{kind:'ordinary-preparation',inputId:plan.inputId,attemptId:plan.attemptId}}
  }
  function scopeIntents(record:AcceptedPreparationRecord):AuthorPersistentScopeContributionV1[] {
    return (record.sharedScopes??[]).filter(plan=>plan.writes.length||plan.globalContributionPresent).map(plan=>({
      address:plan.address,operationId:operationId(plan),contributionId:plan.contributionId,
      attemptId:plan.attemptId,replacesAttemptId:plan.replacesAttemptId,writes:plan.writes,
      source:{kind:'native-material',ref:record.acceptedMaterialRef},
      cause:{kind:'ordinary-preparation',inputId:record.ordinaryChat.inputId,attemptId:plan.attemptId}}))
  }
  function chatIntents(record:AcceptedPreparationRecord) {
    const main=intentFor(record,!!record.sharedScopes?.length)
    return [main,...(record.ordinaryChat.messageGroups??[]).map(plan=>intentFor(record,false,plan))]
      .filter((intent):intent is AcceptedAuthorChatContributionV3=>intent!==undefined)
  }
  function retired(record:AcceptedPreparationRecord):AcceptedPreparationOutcome|undefined {
    const value=table.get(outcomeKey(record)) as AcceptedPreparationOutcome|undefined
    if(value===undefined)return
    if(value.schemaVersion!==1||value.encoding!=='accepted-preparation-outcome-v1'
      ||value.outcome!=='retired'||value.contributionId!==record.ordinaryChat.contributionId
      ||value.attemptId!==record.ordinaryChat.attemptId
      ||recordSha256(value.acceptedMaterialRef)!==recordSha256(record.acceptedMaterialRef))
      throw Error('ORDINARY_PREPARATION_OUTCOME_CHANGED')
    return value
  }
  function confirmed(record:AcceptedPreparationRecord):ConfirmedReceipt[] {
    const receipts:ConfirmedReceipt[]=[]
    for(const intent of chatIntents(record)) {
      if(!deps.isNamespaceReady(intent.namespace))continue
      const receipt=deps.state.lookupAcceptedContribution(intent)
      if(receipt.kind==='applied')receipts.push({event:receipt.event,publication:receipt.publication})
    }
    for(const intent of scopeIntents(record)) {
      const receipt=deps.scopes.lookup(intent)
      if(receipt.kind==='applied')receipts.push({event:receipt.event,publication:receipt.publication})
    }
    return receipts
  }
  async function retire(record:AcceptedPreparationRecord,acceptance:PreparationAcceptanceV1):Promise<void> {
    assertAcceptance(acceptance)
    if(retired(record))return
    const value:AcceptedPreparationOutcome={schemaVersion:1,encoding:'accepted-preparation-outcome-v1',
      acceptedMaterialRef:record.acceptedMaterialRef,contributionId:record.ordinaryChat.contributionId,
      attemptId:record.ordinaryChat.attemptId,outcome:'retired',reason:'source-replaced',confirmed:confirmed(record)},
      key=outcomeKey(record)
    assertAcceptance(acceptance)
    publishing.set(value,key)
    try {
      try {await table.put(key,value)}catch(error) {
        if(recordSha256(table.get(key))!==recordSha256(value))throw error
      }
      if(recordSha256(table.get(key))!==recordSha256(value))throw Error('ORDINARY_PREPARATION_OUTCOME_UNKNOWN')
    }finally {publishing.delete(value)}
  }
  async function withCurrentSource<T>(record:AcceptedPreparationRecord,acceptance:PreparationAcceptanceV1,
    work:(current:()=>boolean)=>Promise<T>):Promise<{value:T}|{retired:true}> {
    const namespace=record.ordinaryChat.initialRoot.namespace
    return deps.withSourceLock(namespace.sessionId,async()=>{
      assertAcceptance(acceptance)
      const source=deps.captureNamespace(namespace.sessionId)
      if(!source.current())throw Error('ORDINARY_PREPARATION_SOURCE_CHANGED')
      const {target:_target,...sourceNamespace}=namespace
      if(recordSha256(source.namespace)!==recordSha256(sourceNamespace)) {
        await retire(record,acceptance);return {retired:true}
      }
      return {value:await work(()=>profileCurrent()&&acceptance.current()&&source.current())}
    })
  }
  async function commitPreparation(record:AcceptedPreparationRecord,acceptance:PreparationAcceptanceV1):Promise<CommitResult> {
    assertAcceptance(acceptance)
    if(retired(record))return {committed:false,revision:0,outcome:'retired'}
    let committed=false,chatReceipt:ChatReceipt|undefined
    const main=intentFor(record,!!record.sharedScopes?.length)
    async function writeChat(intent:AcceptedAuthorChatContributionV3) {
      await deps.readyNamespace(intent.namespace)
      assertAcceptance(acceptance)
      const known=deps.state.lookupAcceptedContribution(intent)
      if(known.kind==='applied') {
        await deps.state.confirmAcceptedContribution(intent)
        return {value:known}
      }
      return withCurrentSource(record,acceptance,current=>deps.state.replaceAcceptedContribution(intent,{
        ownsNamespace:target=>recordSha256(target)===recordSha256(intent.namespace),isCurrent:current,
        beforeWrite({key,value}){
          const release=acceptance.beforeWrite?.({key,value})
          publishing.set(value,key)
          return()=>{publishing.delete(value);release?.()}
        }}))
    }
    if(main) {
      const result=await writeChat(main)
      if('retired' in result)return {committed,revision:0,outcome:'retired'}
      chatReceipt=result.value;committed=result.value.kind==='committed'
    }
    for(const intent of scopeIntents(record)) {
      if(deps.scopes.lookup(intent).kind==='applied')continue
      const result=await withCurrentSource(record,acceptance,current=>deps.scopes.replaceContribution(intent,{
        owns,isCurrent:current,beforeWrite:acceptance.beforeWrite}))
      if('retired' in result)return {committed,revision:0,outcome:'retired',chatReceipt}
      committed||=result.value.kind==='committed'
    }
    for(const plan of record.ordinaryChat.messageGroups??[]) {
      const intent=intentFor(record,false,plan)
      if(!intent)continue
      const result=await writeChat(intent)
      if('retired' in result)return {committed,revision:0,outcome:'retired',chatReceipt}
      committed||=result.value.kind==='committed'
    }
    assertAcceptance(acceptance)
    return {committed,revision:deps.scopes.capture(address).revision,outcome:'applied',chatReceipt}
  }
  async function setGlobal(_presetId:string,key:string,value:CommunityJson) {
    return withTavernLock(table,'community-profile-global-ordinary',async()=>{
      const capture=deps.scopes.capture(address)
      await deps.scopes.replace({expectedRoot:capture.root,operationId:'community-global-'+randomUUID(),
        values:{...capture.values,[key]:clone(value)},cause:{kind:'community-global',key}},
      {owns,isCurrent:profileCurrent})
      return deps.scopes.capture(address).revision
    })
  }
  async function configure(presetId:string,sessionId:string,configurations:readonly CommunityVariableConfiguration[]) {
    for(const configuration of configurations) {
      await deps.withSourceLock(sessionId,async()=>{
        const source=deps.captureNamespace(sessionId),namespace=source.namespace,
          id='community-config-'+recordSha256({presetId,id:configuration.id}),
          selected=configuration.writes.map(write=>write.operation==='delete'?write:{...write,operation:'set' as const}),
          local=variableWrites(selected,'chat'),global=variableWrites(selected,'global'),
          configurationSource={kind:'preset-configuration' as const,configurationId:configuration.id,presetId,
            conversationId:configuration.conversationId},cause={kind:'community-configuration',presetId,configurationId:configuration.id},
          current=()=>profileCurrent()&&source.current()
        if(local.length) {
          await deps.readyNamespace(namespace)
          const operationId='community-config-'+recordSha256({namespace,id}),
            stored=table.get(authorChatEventKeyV3(namespace,operationId)) as AcceptedAuthorChatContributionV3|undefined
          // Forked configuration contributions are already durable at the inherited
          // cut. An own event still needs its original scope fence and flush ACK.
          if(stored||!deps.state.readAcceptedContribution(namespace,id)) {
            const scopeRef=stored?stored.expectedScopeRef:deps.state.captureNamespaceWithoutContribution(namespace,id).scopeRef,
              intent:AcceptedAuthorChatContributionV3={namespace,contributionId:id,attemptId:configuration.id,
              replacesAttemptId:null,operationId,
              writes:local,source:configurationSource,cause,...scopeRef!==undefined?{expectedScopeRef:scopeRef}:{}}
            if(deps.state.lookupAcceptedContribution(intent).kind==='applied')await deps.state.confirmAcceptedContribution(intent)
            else await deps.state.replaceAcceptedContribution(intent,{ownsNamespace:target=>recordSha256(target)===recordSha256(namespace),
              isCurrent:current,beforeWrite({key,value}){publishing.set(value,key);return()=>publishing.delete(value)}})
          }
        }
        if(global.length) {
          const intent:AuthorPersistentScopeContributionV1={address,contributionId:id,attemptId:configuration.id,
            replacesAttemptId:null,operationId:id,writes:global,source:configurationSource,cause}
          if(deps.scopes.lookup(intent).kind!=='applied')await deps.scopes.replaceContribution(intent,{owns,isCurrent:current})
        }
      })
    }
  }
  function receiptFacts(record:AcceptedPreparationRecord) {
    const keys=[outcomeKey(record),AUTHOR_PROFILE_IDENTITY_KEY]
    if(retired(record))return {accepted:true,keys}
    let accepted=true
    for(const intent of chatIntents(record)) {
      keys.push(authorChatEventKeyV3(intent.namespace,intent.operationId))
      if(!deps.isNamespaceReady(intent.namespace)){accepted=false;continue}
      const receipt=deps.state.lookupAcceptedContribution(intent)
      if(receipt.kind==='applied')keys.push(receipt.publication.key)
      else accepted=false
    }
    for(const intent of scopeIntents(record)) {
      keys.push(authorPersistentScopeEventKeyV1(intent.address,intent.operationId),authorPersistentScopeHeadKeyV1(intent.address))
      const receipt=deps.scopes.lookup(intent)
      if(receipt.kind==='applied')keys.push(receipt.publication.key)
      else accepted=false
    }
    return {accepted,keys}
  }
  return {capture,captureDisplay,captureSharedScopes,commitPreparation,setGlobal,configure,receiptFacts,
    isPublishing:(key:string,value:unknown)=>!!value&&typeof value==='object'
      &&(publishing.get(value)===key||deps.scopes.isPublishing(key,value)),
    readGlobal:(_presetId?:string)=>{const capture=deps.scopes.capture(address)
      return {revision:capture.revision,values:clone({...capture.values})}}}
}
