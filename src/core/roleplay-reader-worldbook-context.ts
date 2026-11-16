/** Reader-only selected-message DATA. Source/Native capture owners have already
 * authenticated these facts; this adapter neither prepares Main nor owns effects. */
import {recordSha256,sha256} from './roleplay-data.js'
import {applyAuthorChatOverlayV3} from './roleplay-author-chat-state-types.js'
import type {ReaderRegexDocumentReadFactsV1,ReaderRegexDocumentMessageV1} from './reader-regex-document-types.mjs'
import type {ReaderWorldbookRenderTargetV1} from './tavern-reader-worldbook-render-types.mjs'
import type {TavernEjsHostCapture} from './tavern-template-ejs-host-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernTemplateLoreBindingV1,TavernTemplateScopeBindingV1,TavernTemplateFrozenSnapshotV1}
  from './tavern-template-types.mjs'
import type {TavernPromptMacroSnapshotV1} from './tavern-prompt-transform-types.mjs'
import type {MvuScopeVariablesV1} from './tavern-mvu-scope-read-types.js'

export const READER_SELECTED_MESSAGE_CACHE_POLICY_V1='reader-selected-message-cache-v1' as const
export interface ReaderWorldbookTargetCaptureInputV1 {
  readonly shared?:ReaderWorldbookSharedCaptureV1
  readonly rules?:NonNullable<TavernEjsHostCapture['helperMessages']>['rules']
  readonly scriptOrder?:NonNullable<TavernEjsHostCapture['helperMessages']>['scriptOrder']
  readonly currentCharacterReference?:TavernEjsHostCapture['currentCharacterReference']
  readonly generationModel?:TavernEjsHostCapture['generationModel']
  readonly source:TavernLoreSourceDataV1
  readonly snapshot:ReaderRegexDocumentReadFactsV1['data']
  readonly row:ReaderRegexDocumentMessageV1
  /** The selected Native event's actual time, supplied by its existing owner. */
  readonly clockEpochMs:number
  readonly lore:readonly TavernTemplateLoreBindingV1[]
  readonly worldInfo?:TavernTemplateFrozenSnapshotV1['worldInfo']
  /** The read owner can reuse the hash of its unchanged catalogue projection. */
  readonly loreSha256?:string
  readonly macros:TavernPromptMacroSnapshotV1
  readonly presetCatalog?:TavernEjsHostCapture['presetCatalog']
  readonly worldInfoSettings?:TavernEjsHostCapture['worldInfoSettings']
}
export type ReaderWorldbookTargetCaptureV1={readonly kind:'captured';
  readonly policy:typeof READER_SELECTED_MESSAGE_CACHE_POLICY_V1;
  readonly target:ReaderWorldbookRenderTargetV1;readonly capture:TavernEjsHostCapture}
  |{readonly kind:'unsupported';readonly code:'READER_WORLDBOOK_TARGET_UNAVAILABLE'|'READER_WORLDBOOK_CLOCK_UNAVAILABLE'}

/** No whole-frame/history identity is used for a variable binding. Each scope
 * carries its actual owner publication, including inherited message owners. */
function scopeBinding(scope:TavernTemplateScopeBindingV1['scope'],fact:MvuScopeVariablesV1)
  :TavernTemplateScopeBindingV1|undefined {
  if(fact.kind!=='available')return
  return {scope,ownerId:fact.provenance.owner.identity,versionSha256:recordSha256(fact.provenance),
    values:fact.variables,valuesSha256:fact.variablesSha256}
}

/** One captured Reader surface owns the common rows. Target depth and the
 * selected row's role remain per-target projections of these same facts. */
export function createReaderWorldbookSharedCaptureV1(input:Pick<ReaderWorldbookTargetCaptureInputV1,
  'source'|'snapshot'|'lore'|'macros'|'rules'|'scriptOrder'>) {
  const {source,snapshot,lore,macros}=input,
    identity=(row:{ownerSessionId:string;nativeSeq:number|null;messageId:string})=>
      JSON.stringify([row.ownerSessionId,row.nativeSeq,row.messageId]),
    systemFacts=new Map<string,boolean>()
  if(input.rules)for(const fact of snapshot.scopeFrame.messages) {
    const key=identity(fact)
    if(!systemFacts.has(key))systemFacts.set(key,fact.isSystem)
  }
  const names={user:snapshot.persona.name,char:snapshot.character?.name??source.current.openingContext.context.char}
  const helperMessages=input.rules?{rules:input.rules,...input.scriptOrder?{scriptOrder:input.scriptOrder}:{},
    rows:snapshot.messages.map(item=>({index:item.index,messageId:item.messageId,
      messageVersionSha256:item.messageVersionSha256,
      name:item.name??(item.role==='user'?macros.names.user.value!:macros.names.char.value!),
      nameSource:item.name!==undefined?'message' as const:item.role==='user'?'user' as const:'character' as const,
      isUser:item.role==='user',isSystem:systemFacts.get(identity(item))??false,text:item.message}))}:undefined
  return {names,helperMessages,
    resources:lore.map(entry=>({id:entry.key,sourcePointer:entry.sourcePointer,
      sourceSnapshotSha256:entry.sourceSnapshotSha256,contentSha256:entry.contentSha256,
      text:entry.content,loreKey:entry.key})),
    contextMessages:snapshot.messages.map(item=>({messageId:item.messageId,role:item.role,
      content:item.message,mes:item.message,is_user:item.role==='user',
      name:item.name??(item.role==='user'?names.user:names.char),is_hidden:item.is_hidden??false,extra:item.extra??{}})),
    ordinaryMessages:snapshot.messages.map(item=>({index:item.index,messageId:item.messageId,
      ownerSessionId:item.ownerSessionId,nativeSeq:item.nativeSeq,messageVersionSha256:item.messageVersionSha256,
      role:item.role,variables:item.variables,...item.ordinary?{ordinary:item.ordinary}:{},
      ...item.variants?.swipes_data?{variantVariables:item.variants.swipes_data}:{}}))}
}
type ReaderWorldbookSharedCaptureV1=ReturnType<typeof createReaderWorldbookSharedCaptureV1>

export function createReaderWorldbookTargetCaptureV1(input:ReaderWorldbookTargetCaptureInputV1)
  :ReaderWorldbookTargetCaptureV1 {
  const {source,snapshot,row,lore,macros,clockEpochMs}=input,policy=READER_SELECTED_MESSAGE_CACHE_POLICY_V1
  if(!Number.isSafeInteger(clockEpochMs)||Math.abs(clockEpochMs)>8640000000000000)
    return {kind:'unsupported',code:'READER_WORLDBOOK_CLOCK_UNAVAILABLE'}
  const matches=snapshot.messages.filter(message=>message.nativeSeq===row.seq&&message.messageId===row.messageId
    &&message.messageVersionSha256===row.messageVersionSha256)
  if(matches.length!==1)return {kind:'unsupported',code:'READER_WORLDBOOK_TARGET_UNAVAILABLE'}
  const message=matches[0]!,facts=snapshot.scopeFrame.messages.filter(fact=>fact.ownerSessionId===message.ownerSessionId
    &&fact.nativeSeq===message.nativeSeq&&fact.messageId===message.messageId
    &&fact.messageVersionSha256===message.messageVersionSha256)
  if(facts.length!==1)return {kind:'unsupported',code:'READER_WORLDBOOK_TARGET_UNAVAILABLE'}
  const selected=facts[0]!,last=snapshot.messages.at(-1),target:ReaderWorldbookRenderTargetV1={
    sessionId:source.sessionId,messageId:message.messageId,messageVersionSha256:message.messageVersionSha256,
    seq:row.seq,index:message.index,swipeId:message.variants?.swipe_id??0,
    role:selected.isSystem?'system':message.role,depth:row.depth,isLast:last===message}
  const raw=snapshot.scopeFrame.scopes,ordinary=snapshot.ordinaryChat,
    global=scopeBinding('global',raw.global),card=scopeBinding('card',raw.character),
    baseChat=scopeBinding('chat',raw.chat),messageScope=scopeBinding('message',selected.variables),
    scopes:TavernTemplateScopeBindingV1[]=[]
  if(global)scopes.push(global)
  if(card)scopes.push(card)
  if(baseChat){
    if(Object.keys(ordinary.values).length||ordinary.deletedKeys?.length){
      const values=applyAuthorChatOverlayV3(baseChat.values,ordinary)
      scopes.push({...baseChat,values,valuesSha256:recordSha256(values),
        versionSha256:recordSha256({policy,base:baseChat.versionSha256,ordinaryRoot:ordinary.root})})
    }else scopes.push(baseChat)
  }
  if(messageScope)scopes.push(messageScope)
  if(global&&baseChat&&messageScope){
    const manual=target.isLast&&raw.chat.kind==='available'&&raw.chat.provenance.kind==='published-state'
      &&raw.chat.provenance.state.kind==='manual'
      &&(snapshot.numerical.kind==='ready'||snapshot.numerical.kind==='schema-ready')
      &&raw.chat.provenance.state.revision===snapshot.numerical.expected.revision
      &&Object.hasOwn(raw.chat.variables,'stat_data')?raw.chat:null
    // This deliberately omits initial/trace. The final overlay applies once
    // after all Native layers so a tombstone cannot revive an older value.
    const values=applyAuthorChatOverlayV3({...global.values,...baseChat.values,...messageScope.values,
      ...manual?{stat_data:manual.variables.stat_data}:{}},ordinary)
    scopes.push({scope:'cache',ownerId:`${source.sessionId}:${policy}:${message.ownerSessionId}:${message.messageId}`,
      versionSha256:recordSha256({policy,global:global.versionSha256,chat:baseChat.versionSha256,
        selected:{owner:message.ownerSessionId,seq:message.nativeSeq,id:message.messageId,
          version:message.messageVersionSha256,variables:messageScope.versionSha256},
        manual:manual?.provenance??null,ordinaryRoot:ordinary.root}),values,valuesSha256:recordSha256(values)})
  }
  const turnId=`reader:${message.ownerSessionId}:${row.seq}:${message.messageId}`,
    randomSeed=`${source.sourceSha256}:${message.messageVersionSha256}`,
    body={schemaVersion:1 as const,encoding:'owned-template-frozen-snapshot-v1' as const,
      authority:'consumer-data-only' as const,sessionId:source.sessionId,branchId:source.sessionId,
      revision:snapshot.numerical.kind==='ready'||snapshot.numerical.kind==='schema-ready'
        ?snapshot.numerical.expected.revision:snapshot.basis.nativeCut,
      turnId,attemptId:`${turnId}:cut:${snapshot.basis.nativeCut}:${message.messageVersionSha256}`,
      packageSha256:source.original.documentSha256,sourceSnapshotSha256:source.sourceSha256,
      stateSnapshotSha256:snapshot.basis.numericalSnapshotSha256,defaultVariableScope:'cache' as const,
      scopes,scopesSha256:recordSha256(scopes),lore,loreSha256:input.loreSha256??recordSha256(lore),
      ...input.worldInfo?{worldInfo:input.worldInfo}:{},
      clockEpochMs,randomSeed,randomSeedSha256:sha256(randomSeed)}
  // These fields come from the authenticated Source/Native owners above. The
  // protected runtime validates its incoming DATA at its execution boundary.
  const frozen:TavernTemplateFrozenSnapshotV1={...body,snapshotSha256:recordSha256(body)},
    shared=input.shared??createReaderWorldbookSharedCaptureV1(input),{names}=shared
  const targetMacros={...macros,variableScopes:{...macros.variableScopes,message:messageScope??null}}
  return {kind:'captured',policy,target,capture:{snapshot:frozen,macros:targetMacros,
    ...input.currentCharacterReference?{currentCharacterReference:input.currentCharacterReference}:{},
    ...input.generationModel?{generationModel:input.generationModel}:{},
    ...shared.helperMessages?{helperMessages:{...shared.helperMessages,
      rows:shared.helperMessages.rows.map(item=>({...item,depth:target.depth+target.index-item.index}))}}:{},
    ...input.presetCatalog?{presetCatalog:input.presetCatalog}:{},
    ...input.worldInfoSettings?{worldInfoSettings:input.worldInfoSettings}:{},
    resources:shared.resources,
    context:{user:names.user,char:names.char,messages:shared.contextMessages.map((item,index)=>{
      if(snapshot.messages[index]!==message)return item
      const role=target.role
      return {...item,role,is_user:role==='user',name:message.name??(role==='user'?names.user:names.char)}
    }),message_id:target.index,messageId:target.messageId,
      swipe_id:target.swipeId,depth:target.depth,is_user:target.role==='user',is_system:target.role==='system',
      is_last:target.isLast},ordinaryNamespace:{root:ordinary.root,values:ordinary.values},
    ordinaryMessageView:{messages:shared.ordinaryMessages,
      captures:snapshot.ordinaryMessages??[],current:{message_id:target.index,swipe_id:target.swipeId}}}}
}
