/** Reader consumes current author DATA and selected committed Native messages.
 * Display projections never replace canonical text or own a Native write. */
import {randomUUID} from 'node:crypto'
import {createAuthorNativeMessageVariables} from './author-native-message-variables.js'
import {readerNativeNamespaceCauseV1,readerNativeSourceOriginV1} from './author-native-origin.js'
import {applyAuthorChatOverlayV3} from './roleplay-author-chat-state-types.js'
import type {OrdinaryAuthorChatBatchUpdateV3} from './roleplay-author-chat-state-types.js'
import type {CapturedOrdinaryNamespaceMutationV1} from './roleplay-author-browser-key-core-v3.js'
import {createReaderVariablePrefix} from './roleplay-reader-variable-prefix.js'
import type {AuthorMessageMetadataV1,AuthorMessageViewV1} from './roleplay-author-message-capture.js'
import type {AuthorPromptOpeningFactsV1} from './roleplay-author-prompt-capture.js'
import {recordSha256,sha256,textOf} from './roleplay-data.js'
import {sourceLiteralReaderCss} from './roleplay-reader-style-parser.mjs'
import {eventsOf,surfaceEntries} from './roleplay-context.js'
import type {ContextMessage,ContextSession} from './roleplay-context.js'
import type {WorldlineMessageEdits} from './roleplay-worldline-types.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'
import type {createRoleplayTavernLoreSourceV1} from './roleplay-tavern-lore-source.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {MvuScopeSourceIdentityV1} from './tavern-mvu-scope-read-types.js'
import type {MvuAcceptedDisplayUpdate} from './roleplay-mvu-display-facts.js'
import {produceRoleplayTavernMacroSnapshotV1,captureRoleplayTavernScopedRegexV1}
  from './roleplay-tavern-prompt-macros.js'
import {applyTavernPromptTransformsV1} from './tavern-prompt-transform.mjs'
import {projectReaderNarrativeDisplay} from './roleplay-reader-narrative-display.js'
import type {ReaderMvuDisplayScope} from './roleplay-reader-narrative-display.js'
import type {TavernPromptTransformInputV1,TavernPromptDisplayPartV1,
  TavernPromptDisplayReplacementV1} from './tavern-prompt-transform-types.mjs'
import type {ReaderRegexDocumentInputV1,ReaderRegexDocumentReadFactsV1} from './reader-regex-document-types.mjs'
import type {ReaderRegexDocumentBindingV1,ReaderRegexDocumentSnapshotV1,ReaderOpeningVariantCaptureV1,
  ReaderOpeningVariantReplyV1,ReaderOpeningVariantResultV1,ReaderNumericalReplyV1} from './reader-regex-document-types.mjs'
import type {ReaderCommandReplyV1} from './reader-regex-document-types.mjs'
import type {ReaderOrdinaryNamespaceRequestV1,ReaderOrdinaryNamespaceReplyV1} from './reader-regex-document-types.mjs'
import type {AuthorNativeCommandRequestV1,AuthorNativeCommandResultV1} from './roleplay-author-commands.js'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {OpeningVariantMutationRequestV1} from './roleplay-opening-variant-types.js'
import {readerRegexDocumentHtmlSpan} from './reader-source-document-data.mjs'
import type {AuthorNativeDiagnosticV1} from './author-native-helper-types.js'
import {authorMessageBodyRequestValid} from './roleplay-author-message-edit-types.js'
import type {AuthorMessageBodyRequestV1,AuthorMessageEditInputV1,AuthorMessageEditResultV1,ReaderMessageEditOriginV1}
  from './roleplay-author-message-edit-types.js'
import {createMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'
import type {MvuNumericalObservation} from './roleplay-mvu-state.js'
import {communityRegexRules,communityRegexMacros} from './community-regex.js'
import {nativeCommunityDisplayRule} from './community-preset-display.js'
import type {CommunityPresetPolicy} from './community-presets.js'
import type {CommunityJson} from './community-preset-types.js'
import type {createRoleplayTavernPromptMaterialV1} from './roleplay-tavern-prompt.js'
import {prepareReaderWorldbookV1,projectReaderWorldbookDocumentsV1}
  from './roleplay-reader-worldbook.js'
import type {ReaderRegexInputsV1,ReaderNarrativeHtmlV1,ReaderWorldbookProjectionV1}
  from './roleplay-reader-worldbook.js'
import type {TavernEjsReplayEngine} from './tavern-template-ejs-replay.mjs'
import type {ReaderNativeDocumentExecutionV1,ReaderNativeDocumentProgramV1}
  from './reader-native-document-types.js'
import type {TavernEjsRuntime} from './tavern-template-ejs-runtime-types.mjs'
import type {ReaderWorldbookDocumentOriginV1} from './reader-regex-document-types.mjs'
import type {CaptureRoleplayStoryText} from './roleplay-story-text.js'
import type {CanonicalChatMessageFacts} from '../memory/memory-history.js'

export type ReaderDisplayFragment={readonly kind:'text';readonly text:string}|{
  readonly kind:'author-document'
  readonly origin:(Pick<TavernPromptDisplayReplacementV1,'ruleId'|'sourcePointer'|'sourceSnapshotSha256'>
    &{readonly displaySpan:{readonly start:number;readonly end:number}})|ReaderWorldbookDocumentOriginV1
  readonly parts:readonly TavernPromptDisplayPartV1[]
  readonly documentPlanSha256?:string
  readonly documentDiagnostics?:readonly AuthorNativeDiagnosticV1[]
  readonly documentPending?:true
}
/** A document is selected from the applied Source template, never from the
 * mixed final text. Captures cannot join literal pieces into a document tag.
 * The DOM owner separately admits their ordinary text slots. */
export function projectReaderDisplayFragments(text:string,replacements:readonly TavernPromptDisplayReplacementV1[])
  :readonly ReaderDisplayFragment[]|undefined {
  const fragments:ReaderDisplayFragment[]=[]
  let cursor=0,documents=0
  for(const replacement of replacements){
    const template=replacement.parts.map(part=>part.kind==='literal'?part.text
      :part.kind==='macro'?part.sourceText:'\ufffc').join('')
    if(!readerRegexDocumentHtmlSpan(template))continue
    if(replacement.start>cursor)fragments.push({kind:'text',text:text.slice(cursor,replacement.start)})
    const {ruleId,sourcePointer,sourceSnapshotSha256}=replacement
    fragments.push({kind:'author-document',origin:{ruleId,sourcePointer,sourceSnapshotSha256,
      displaySpan:{start:replacement.start,end:replacement.end}},parts:replacement.parts})
    documents++;cursor=replacement.end
  }
  if(!documents)return
  if(cursor<text.length)fragments.push({kind:'text',text:text.slice(cursor)})
  return fragments
}

export interface ReaderDisplayMessageRef {
  readonly seq:number
  readonly messageId:string
}
export type ReaderDisplayExecution=ReaderNativeDocumentExecutionV1
export interface ReaderDisplayRow extends ReaderDisplayMessageRef {
  readonly rawText:string
  readonly messageVersionSha256:string
  readonly depth:number
  readonly isEdit:boolean
  readonly displayText:string
  readonly fragments?:readonly ReaderDisplayFragment[]
  /** Ephemeral CSS from matched Source literals, never mixed model text. */
  readonly css?:string
  readonly renderDiagnostics?:readonly AuthorNativeDiagnosticV1[]
}
export interface ReaderDisplayResponse {
  readonly ok:true
  readonly sessionId:string
  readonly contextRevision:string
  readonly rows:readonly ReaderDisplayRow[]
  readonly execution?:ReaderDisplayExecution
  readonly documentDiagnostics?:readonly AuthorNativeDiagnosticV1[]
  /** Compiler availability/transport errors are not authored document failures. */
  readonly compilerDiagnostics?:readonly AuthorNativeDiagnosticV1[]
  readonly phase?:ReaderRenderPhaseBindingV1
}
export interface ReaderRenderPhaseBindingV1 {
  readonly sessionId:string
  readonly phaseId:string
  readonly generation:string
  readonly contextRevision:string
}
export interface ReaderRenderHtmlRequestV1 {
  readonly binding:ReaderRenderPhaseBindingV1
  readonly rows:readonly {readonly seq:number;readonly messageId:string;readonly messageVersionSha256:string;
    readonly narrative:readonly {readonly fragmentIndex:number|null;readonly html:string}[]}[]
}
export interface ReaderRenderHtmlReplyV1 {
  readonly ok:true
  readonly binding:ReaderRenderPhaseBindingV1
  readonly display:ReaderDisplayResponse
  readonly narrative:readonly ReaderNarrativeHtmlV1[]
}
/** Only completed current chat/global facts reach the display macro registry. */
export interface ReaderDisplayScopes {
  readonly source?:Pick<MvuScopeSourceIdentityV1,'sessionId'|'sourceRecordSessionId'|'importId'|'rawSha256'>
  readonly bindings:readonly TavernTemplateScopeBindingV1[]
  readonly versionSha256:string
  readonly displayUpdates:readonly MvuAcceptedDisplayUpdate[]
}
interface Dependencies {
  captureStoryText?:CaptureRoleplayStoryText
  selectedMessageFacts?(message:object&{readonly content?:unknown}):CanonicalChatMessageFacts
  readonly inputState:RoleplayInputStateOwner
  readonly source:Pick<ReturnType<typeof createRoleplayTavernLoreSourceV1>,'capture'>
  readonly authorSource?:ReturnType<typeof createRoleplayTavernPromptMaterialV1>['captureAuthorSource']
  readonly messageEdits:Pick<WorldlineMessageEdits,'current'>
  session(id:string):ContextSession|undefined
  includeCardStyle(id:string):boolean
  /** Core's shared observation supplies current positive/negative scope DATA. */
  scopes(id:string,source:TavernLoreSourceDataV1):ReaderDisplayScopes|undefined
  templateRuntime?(signal:AbortSignal,engine?:TavernEjsReplayEngine):Promise<TavernEjsRuntime>
  captureRegexInputs?(sid:string,source:TavernLoreSourceDataV1,signal:AbortSignal):ReaderRegexInputsV1|Promise<ReaderRegexInputsV1>
  documentFacts?(id:string,read:ReaderDocumentSourceRead):Promise<ReaderRegexDocumentReadFactsV1|undefined>
  nativeParentOrigins?(groups:readonly ('source-regex'|'none')[]):Promise<ReaderNativeDocumentExecutionV1['parentOrigins']>
  mutateOpeningVariants?(capture:ReaderOpeningVariantCaptureV1,request:OpeningVariantMutationRequestV1,
    signal:AbortSignal):Promise<ReaderOpeningVariantResultV1>
  confirmOpeningVariants?(sessionId:string,operationId:string,signal:AbortSignal):Promise<ReaderOpeningVariantResultV1>
  replaceNumerical?(operation:MvuPlayerEditRequest,current:()=>boolean):Promise<MvuPlayerEditResponse>
  editMessageBody?(sid:string,input:AuthorMessageEditInputV1,current:()=>boolean,signal:AbortSignal):Promise<AuthorMessageEditResultV1>
  mutateNamespace?(sid:string,input:CapturedOrdinaryNamespaceMutationV1,current:()=>boolean,
    signal:AbortSignal):Promise<ReaderOrdinaryNamespaceReplyV1['reply']>
  retryNamespace?(sid:string,operation:OrdinaryAuthorChatBatchUpdateV3,
    cause:ReturnType<typeof readerNativeNamespaceCauseV1>,current:()=>boolean,
    signal:AbortSignal):Promise<ReaderOrdinaryNamespaceReplyV1['reply']>
  commands?(sid:string,origin:string,request:AuthorNativeCommandRequestV1,current:()=>boolean,
    signal:AbortSignal):Promise<AuthorNativeCommandResultV1>
  readonly community?:{
    policy(id:string):CommunityPresetPolicy
    variables(id:string,presetId:string):{chat:Record<string,CommunityJson>;global:Record<string,CommunityJson>}
  }
}
interface ReaderDocumentSourceRead {
  readonly source:TavernLoreSourceDataV1
  readonly session:ContextSession
  readonly entries:ReturnType<typeof surfaceEntries>
  readonly events:ReturnType<typeof eventsOf>
  readonly cardData:Record<string,unknown>
  readonly selectedMessageFacts?:Dependencies['selectedMessageFacts']
  readonly nativePrefixSha256?:string
}
interface ReaderBinding {
  readonly binding:ReaderRegexDocumentBindingV1
  readonly program:ReaderNativeDocumentProgramV1
  readonly sourceRead:ReaderDocumentSourceRead
  readonly sourceCurrent:()=>boolean
  facts:ReaderRegexDocumentReadFactsV1
  snapshot:ReaderRegexDocumentSnapshotV1
}
/** A completed nonnumerical opening proves absence, not initialized empty variables.
 * Reuse the Reader's current Source and Native projection without schema replay. */
export function capturePlainReaderDocumentFacts(read:ReaderDocumentSourceRead,
  opening:{readonly assistantSeq:number;readonly messageId:string;readonly absenceScopeSha256:string;
    readonly copiedCandidates?:AuthorPromptOpeningFactsV1['copiedCandidates'];current():boolean},
  numerical:Exclude<MvuNumericalObservation,{kind:'ready'}>,
  ordinary:{readonly data:ReaderRegexDocumentReadFactsV1['data']['ordinaryChat'];current():boolean;
    nativeOwnerForSeq(seq:number):string;
    messageView<T extends AuthorMessageMetadataV1>(messages:readonly T[],opening:AuthorPromptOpeningFactsV1,
      targetSetIdentity:string,current:()=>boolean):AuthorMessageViewV1<T>})
  :ReaderRegexDocumentReadFactsV1 {
  const {source,session,events,entries,cardData}=read,receipt=opening,
    start=entries.findIndex(entry=>entry.seq===receipt.assistantSeq&&entry.messageId===receipt.messageId)
  if(start<0)fail('READER_DISPLAY_MESSAGE_UNAVAILABLE')
  const originalOpening=events[receipt.assistantSeq]!.data!.message as ContextMessage,
    originalOpeningVersion=read.selectedMessageFacts?.(originalOpening)?.messageVersionSha256??recordSha256(originalOpening),
    variables={kind:'unavailable' as const,code:'MESSAGE_STATE_UNAVAILABLE' as const},
    messages=entries.slice(start).map((entry,index)=>{
      const event=events[entry.seq]!,message=(session.deriveEventMessage?.(event)
        ??(entry.kind==='assistant'?event.data?.message:event.data)) as ContextMessage
      const ownerSessionId=ordinary.nativeOwnerForSeq(entry.seq),
        raw=read.selectedMessageFacts?.(message),version=raw?.messageVersionSha256??recordSha256(message)
      return {index,ownerSessionId,nativeSeq:entry.seq,messageId:entry.messageId,
        messageVersionSha256:version,role:entry.kind,
        message:raw?.text??textOf(message.content),variables,
        variants:entry.messageId===opening.messageId&&version===originalOpeningVersion?opening.copiedCandidates??null:null}
    }),
    basis={sessionId:session.id,sourceSnapshotSha256:source.sourceSha256,materialSha256:source.current.materialSha256,
      // Reuse the owner's completed absence identity, never an MVU head.
      numericalSnapshotSha256:opening.absenceScopeSha256,
      nativeCut:events.length,nativePrefixSha256:read.nativePrefixSha256??recordSha256(events)},
    unavailable={kind:'unavailable' as const,code:'SCOPE_SOURCE_UNAVAILABLE' as const},
    scopeFrame=createMvuScopeReadFrameV1({schemaVersion:1,encoding:'native-mvu-scope-read-frame-v1',
      source:{sessionId:session.id,sourceRecordSessionId:source.sourceRecordSessionId,
        importId:source.original.activePointer.importId,rawSha256:source.original.rawSha256,sourceSnapshotSha256:source.sourceSha256},
      sourceNativeCutSha256:recordSha256(basis),viewKind:'script',
      scopes:{chat:unavailable,character:unavailable,global:unavailable},scripts:[],
      messages:messages.map(({index,ownerSessionId,nativeSeq,messageId,messageVersionSha256})=>({position:index,
        ownerSessionId,nativeSeq,messageId,messageVersionSha256,selectedVariant:messageVersionSha256,isSystem:false,variables}))}),
    context=source.current.openingContext.context
  const current=()=>opening.current()&&ordinary.current(),
    messageView=ordinary.messageView(messages,{messageId:receipt.messageId,
      originalMessageVersionSha256:originalOpeningVersion,
      copiedCandidates:opening.copiedCandidates??null},basis.nativePrefixSha256,current),
    actualMessages=messageView.messages,bySeq=new Map(actualMessages.map(message=>[message.nativeSeq,message])),
    variablesFor=createAuthorNativeMessageVariables(messageView),prefix=createReaderVariablePrefix(),
    positions=new Map(actualMessages.map(message=>[message.nativeSeq,message.index]))
  prefix.reset(actualMessages.map(message=>({target:{ownerSessionId:message.ownerSessionId,nativeSeq:message.nativeSeq,
    messageId:message.messageId,messageVersionSha256:message.messageVersionSha256,
    selectedVariant:message.messageVersionSha256},variables:variablesFor.forMessage(message).values})),seq=>positions.get(seq))
  return {kind:'reader-regex-document-facts',current:()=>current()&&messageView.current(),
    readMessagePrefix:target=>{
      const message=bySeq.get(target.seq)
      if(!message||message.messageId!==target.messageId||message.messageVersionSha256!==target.messageVersionSha256)
        fail('READER_VARIABLE_TARGET_UNAVAILABLE')
      const actual={ownerSessionId:message.ownerSessionId,nativeSeq:message.nativeSeq,messageId:message.messageId,
        messageVersionSha256:message.messageVersionSha256,selectedVariant:message.messageVersionSha256},base={...ordinary.data.values}
      for(const key of ordinary.data.deletedKeys??[])delete base[key]
      return {target:actual,values:prefix.read(actual,base)}
    },
    data:{schemaVersion:1,encoding:'reader-regex-document-snapshot-v1',basis,scopeFrame,messages:actualMessages,
      ordinaryMessages:messageView.ordinaryMessages,
      numerical:{kind:numerical.kind,code:numerical.code,canEdit:false},
      persona:{name:context.user??'',...context.user_gender!==undefined?{gender:context.user_gender}:{},avatar:null},
      character:{sourceId:source.original.activePointer.importId,name:String(cardData.name),
        ...typeof cardData.avatar==='string'?{avatar:cardData.avatar}:{}},ordinaryChat:ordinary.data}}
}
function fail(code:string):never {throw Error(code)}
/** Only actual compiled documents consume a Reader prefix. Multiple fragments
 * of one mounted message share the same output; no full-history prefix packet. */
function documentVariables(facts:ReaderRegexDocumentReadFactsV1,program:ReaderNativeDocumentProgramV1)
  :ReaderRegexDocumentSnapshotV1['readerVariables'] {
  if(!facts.readMessagePrefix)return undefined
  const targets=new Map<number,NonNullable<ReaderRegexDocumentSnapshotV1['readerVariables']>[number]>()
  for(const document of program.documents) {
    const target=document.origin.message
    if(!targets.has(target.seq))targets.set(target.seq,facts.readMessagePrefix(target))
  }
  return [...targets.values()]
}
function acceptedScope(row:Omit<ReaderDisplayRow,'displayText'>,
  updates:readonly MvuAcceptedDisplayUpdate[]):ReaderMvuDisplayScope|undefined {
  const matches=updates.filter(update=>update.canonical.seq===row.seq&&update.canonical.messageId===row.messageId)
  if(matches.length!==1)return
  const update=matches[0]!
  if(update.canonical.versionSha256!==row.messageVersionSha256
    ||update.canonical.narrativeSha256!==sha256(row.rawText))return
  const start=row.rawText.indexOf('<UpdateVariable>'),close=row.rawText.indexOf('</UpdateVariable>')
  if(start<0||close<start)return
  return {role:'assistant',protocol:update.protocol,acceptedRange:{start,end:close+'</UpdateVariable>'.length}}
}
export function createRoleplayReaderDisplay(deps:Dependencies) {
  const bindings=new Map<string,ReaderBinding>()
  const phases=new Map<string,{binding:ReaderRenderPhaseBindingV1;
    complete(request:ReaderRenderHtmlRequestV1,signal:AbortSignal):Promise<ReaderRenderHtmlReplyV1>;
    dispose():Promise<void>}>()
  let disposed=false
  let readRevision=0
  async function releasePhase(binding:ReaderRenderPhaseBindingV1):Promise<void> {
    const phase=phases.get(binding.phaseId)
    if(!phase||phase.binding.sessionId!==binding.sessionId||phase.binding.generation!==binding.generation)return
    phases.delete(binding.phaseId);await phase.dispose()
  }
  async function renderHtml(request:ReaderRenderHtmlRequestV1,signal:AbortSignal):Promise<ReaderRenderHtmlReplyV1> {
    signal.throwIfAborted()
    const phase=phases.get(request.binding.phaseId)
    if(!phase||phase.binding.sessionId!==request.binding.sessionId||phase.binding.generation!==request.binding.generation
      ||phase.binding.contextRevision!==request.binding.contextRevision)fail('READER_REGEX_PHASE_CHANGED')
    try{return await phase.complete(request,signal)}finally{await releasePhase(phase.binding)}
  }
  const sameBinding=(left:ReaderRegexDocumentBindingV1,right:ReaderRegexDocumentBindingV1)=>
    left.principal===right.principal&&left.browserSessionId===right.browserSessionId
    &&left.generation===right.generation&&left.sessionId===right.sessionId&&left.programSha256===right.programSha256
  function releaseBinding(binding:ReaderRegexDocumentBindingV1):void {
    const value=bindings.get(binding.browserSessionId)
    if(value&&sameBinding(value.binding,binding))bindings.delete(binding.browserSessionId)
  }
  function bindingCurrent(value:ReaderBinding):boolean {
    return !disposed&&bindings.get(value.binding.browserSessionId)===value&&value.sourceCurrent()&&value.facts.current()
  }
  async function mutateNamespace(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:ReaderOrdinaryNamespaceRequestV1|OrdinaryAuthorChatBatchUpdateV3,signal:AbortSignal,
    retry=false):Promise<ReaderOrdinaryNamespaceReplyV1> {
    signal.throwIfAborted()
    const value=bindings.get(binding.browserSessionId)
    if(!value||!sameBinding(value.binding,binding)||!bindingCurrent(value)) {
      releaseBinding(binding);fail('READER_BINDING_REVOKED')
    }
    const document=value.program.documents.find(plan=>plan.documentPlanSha256===documentPlanSha256
      &&plan.writes==='source-regex'&&plan.origin.encoding==='reader-regex-document-origin-v1')
    if(!document||document.origin.encoding!=='reader-regex-document-origin-v1')fail('READER_NAMESPACE_WRITE_UNAVAILABLE')
    const cause=readerNativeNamespaceCauseV1(document.origin),
      sourceCurrent=()=>!signal.aborted&&!disposed&&bindings.get(binding.browserSessionId)===value&&value.sourceCurrent()
    let reply:ReaderOrdinaryNamespaceReplyV1['reply']
    if(retry) {
      if(!deps.retryNamespace)fail('READER_NAMESPACE_WRITE_UNAVAILABLE')
      const operation=request as OrdinaryAuthorChatBatchUpdateV3
      if(operation.namespace.target?.kind==='script')fail('READER_VARIABLE_SCOPE_UNAVAILABLE')
      reply=await deps.retryNamespace(binding.sessionId,operation,cause,sourceCurrent,signal)
    }else {
      if(!deps.mutateNamespace)fail('READER_NAMESPACE_WRITE_UNAVAILABLE')
      const mutation=request as ReaderOrdinaryNamespaceRequestV1
      if(mutation.readRevision!==value.snapshot.readRevision)fail('READER_READ_BASIS_CHANGED')
      const selector=mutation.selector,scope=value.snapshot.scopeFrame.scopes.chat
      if(selector&&selector.type!=='message')fail('READER_VARIABLE_SCOPE_UNAVAILABLE')
      const selected=selector?createAuthorNativeMessageVariables(value.snapshot).resolve(selector,true):undefined,
        capture=selected?.capture??value.snapshot.ordinaryChat,
        previous=selected?.values??applyAuthorChatOverlayV3(scope.kind==='available'?scope.variables:{},capture)
      reply=await deps.mutateNamespace(binding.sessionId,{root:capture.root,previous,
        nextVariables:mutation.nextVariables,operationId:mutation.operationId,cause},sourceCurrent,signal)
    }
    if(reply.kind==='no-update')return {reply,...bindingCurrent(value)?{snapshot:value.snapshot}:{}}
    const snapshot=await adoptCommittedData(value)
    return {reply,...snapshot?{snapshot}:{}}
  }
  async function mutateMessageBody(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:AuthorMessageBodyRequestV1,signal:AbortSignal,originalOrigin?:ReaderMessageEditOriginV1) {
    signal.throwIfAborted()
    const value=bindings.get(binding.browserSessionId)
    if(!value||!sameBinding(value.binding,binding)||!bindingCurrent(value)) {
      releaseBinding(binding);fail('READER_BINDING_REVOKED')
    }
    const document=value.program.documents.find(plan=>plan.documentPlanSha256===documentPlanSha256
      &&plan.writes==='source-regex'&&plan.origin.encoding==='reader-regex-document-origin-v1')
    if(!document||document.origin.encoding!=='reader-regex-document-origin-v1'||!deps.editMessageBody)
      fail('READER_MESSAGE_BODY_WRITE_UNAVAILABLE')
    if(!authorMessageBodyRequestValid(request))fail('AUTHOR_MESSAGE_EDIT_REQUEST_INVALID')
    const admitted=readerNativeSourceOriginV1(document.origin)
    if(originalOrigin) {
      // The current literal is a Source-group permission witness. Preserve the
      // original operation provenance and expected message version on retry.
      if(originalOrigin.principal!==admitted.principal
        ||originalOrigin.sourceRecordSessionId!==admitted.sourceRecordSessionId
        ||originalOrigin.importId!==admitted.importId||originalOrigin.rawSha256!==admitted.rawSha256
        ||originalOrigin.descriptorSha256!==admitted.descriptorSha256||originalOrigin.htmlSha256!==admitted.htmlSha256
        ||originalOrigin.htmlSpan.start!==admitted.htmlSpan.start||originalOrigin.htmlSpan.end!==admitted.htmlSpan.end
        ||originalOrigin.carrier.seq!==admitted.carrier.seq||originalOrigin.carrier.messageId!==admitted.carrier.messageId)
        fail('READER_MESSAGE_BODY_DOCUMENT_CHANGED')
    }else if(request.readRevision!==value.snapshot.readRevision)fail('READER_READ_BASIS_CHANGED')
    const expected=request.expected,row=value.snapshot.messages.find(message=>message.nativeSeq===expected.seq
      &&message.messageId===expected.messageId)
    if(!originalOrigin&&(!row||row.nativeSeq===null||expected.sessionId!==binding.sessionId||row.role!==expected.role
      ||row.messageVersionSha256!==expected.messageVersionSha256))fail('READER_READ_BASIS_CHANGED')
    if(row?.variants||row?.ordinary?.selectedTarget.identity.variant.kind==='opening-variant')
      fail('AUTHOR_MESSAGE_EDIT_OPENING_VARIANTS_REQUIRED')
    const sourceCurrent=()=>!signal.aborted&&!disposed&&bindings.get(binding.browserSessionId)===value&&value.sourceCurrent(),
      result=await deps.editMessageBody(binding.sessionId,{schemaVersion:1,operationId:request.operationId,
        expected:request.expected,text:request.text,origin:originalOrigin??admitted},sourceCurrent,signal)
    // A new body changes document provenance. Receipt delivery precedes the
    // parent's normal Reader recapture; never attach fresh DATA to the old plan.
    if(result.kind==='committed'||result.kind==='unknown'||!value.facts.current())releaseBinding(binding)
    return {result}
  }
  async function mutateBinding(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:OpeningVariantMutationRequestV1,signal:AbortSignal):Promise<ReaderOpeningVariantReplyV1> {
    signal.throwIfAborted()
    const value=bindings.get(binding.browserSessionId)
    if(!value||!sameBinding(value.binding,binding)||!bindingCurrent(value)) {
      releaseBinding(binding);fail('READER_BINDING_REVOKED')
    }
    const document=value.program.documents.find(plan=>plan.documentPlanSha256===documentPlanSha256
      &&plan.writes==='source-regex')
    if(!document||!deps.mutateOpeningVariants)
      fail('READER_OPENING_VARIANTS_UNAVAILABLE')
    if(request.readRevision!==value.snapshot.readRevision)fail('READER_READ_BASIS_CHANGED')
    const capture:ReaderOpeningVariantCaptureV1={binding:value.binding,program:value.program,document,snapshot:value.snapshot,
      openingMessage:document.origin.message,
      current:()=>bindingCurrent(value),sourceCurrent:()=>!disposed
        &&bindings.get(value.binding.browserSessionId)===value&&value.sourceCurrent()}
    const result=await deps.mutateOpeningVariants(capture,request,signal)
    if(result.kind!=='committed') {
      if(result.kind==='unknown')releaseBinding(binding)
      return {result}
    }
    if(result.navigation) {
      // The committed child owns a new Session and Reader realm. Its receipt
      // closes this binding instead of lending a parent snapshot to that child.
      releaseBinding(binding)
      return {result}
    }
    // The canonical receipt survives a changed branch or disposed UI. Only
    // its original live Source can adopt fresh DATA for the existing realm.
    const snapshot=await adoptCommittedData(value)
    return {result,...snapshot?{snapshot}:{}}
  }
  async function adoptCommittedData(value:ReaderBinding):Promise<ReaderRegexDocumentSnapshotV1|undefined> {
    const binding=value.binding
    if(!value.sourceCurrent()||disposed||bindings.get(binding.browserSessionId)!==value) {
      releaseBinding(binding);return
    }
    try {
      const facts=await deps.documentFacts?.(binding.sessionId,value.sourceRead)
      if(!facts||!facts.current()||!value.sourceCurrent()||disposed
        ||bindings.get(binding.browserSessionId)!==value) {releaseBinding(binding);return}
      const previous=value.snapshot,root=facts.data.ordinaryChat.root,oldRoot=previous.ordinaryChat.root
      const unchanged=facts.data.scopeFrame.frameSha256===previous.scopeFrame.frameSha256
        &&facts.data.ordinaryPublicationSeq===previous.ordinaryPublicationSeq
        &&facts.data.worldbook?.dataSha256===previous.worldbook?.dataSha256
        &&root.head?.sha256===oldRoot.head?.sha256&&root.base?.sha256===oldRoot.base?.sha256
        &&facts.data.readonlyPreset?.fingerprint===previous.readonlyPreset?.fingerprint
        &&facts.data.avatarPaths?.user===previous.avatarPaths?.user
        &&facts.data.avatarPaths?.character===previous.avatarPaths?.character
      value.facts=facts
      value.snapshot={...facts.data,generation:binding.generation,
        readerVariables:documentVariables(facts,value.program),
        readRevision:unchanged?previous.readRevision:++readRevision}
      return value.snapshot
    }catch {
      // A committed mutation never becomes a rejected write because its
      // refreshed display is unavailable. The parent retains the receipt.
      releaseBinding(binding)
      return
    }
  }
  async function replaceNumerical(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    readRevision:number,operation:MvuPlayerEditRequest,signal:AbortSignal):Promise<ReaderNumericalReplyV1> {
    signal.throwIfAborted()
    const value=bindings.get(binding.browserSessionId)
    if(!value||!sameBinding(value.binding,binding)||!bindingCurrent(value)) {
      releaseBinding(binding);fail('READER_BINDING_REVOKED')
    }
    const document=value.program.documents.find(plan=>plan.documentPlanSha256===documentPlanSha256
      &&plan.writes==='source-regex'&&plan.origin.encoding==='reader-regex-document-origin-v1')
    if(!document||!deps.replaceNumerical)fail('READER_NUMERICAL_WRITE_UNAVAILABLE')
    if(readRevision!==value.snapshot.readRevision)fail('READER_READ_BASIS_CHANGED')
    if(operation.sessionId!==binding.sessionId)fail('READER_NUMERICAL_REQUEST_INVALID')
    // Admission consumes current DATA. Publication holds the original Source
    // lifetime, because this write itself invalidates its old numerical facts.
    const sourceCurrent=()=>!signal.aborted&&!disposed&&bindings.get(binding.browserSessionId)===value&&value.sourceCurrent()
    const result=await deps.replaceNumerical(operation,sourceCurrent)
    if(result.operation?.outcome==='unknown'){releaseBinding(binding);return {result}}
    if(!result.operation)return {result}
    const snapshot=await adoptCommittedData(value)
    return {result,...snapshot?{snapshot}:{},
      ...result.operation.outcome==='updated'&&!result.operation.replayed
        ?{sourceEvents:[{type:'nexttavern_numerical_updated',args:[]}]}:{}}
  }
  async function executeCommands(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:AuthorNativeCommandRequestV1,signal:AbortSignal):Promise<ReaderCommandReplyV1> {
    signal.throwIfAborted()
    const value=bindings.get(binding.browserSessionId)
    if(!value||!sameBinding(value.binding,binding)||!bindingCurrent(value))fail('READER_BINDING_REVOKED')
    const document=value.program.documents.find(plan=>plan.documentPlanSha256===documentPlanSha256
      &&plan.writes==='source-regex'&&plan.origin.encoding==='reader-regex-document-origin-v1')
    if(!document||!deps.commands)fail('READER_NATIVE_COMMANDS_UNAVAILABLE')
    const sourceCurrent=()=>!disposed&&bindings.get(binding.browserSessionId)===value&&value.sourceCurrent()
    const result=await deps.commands(binding.sessionId,
      `reader:${value.program.programSha256}:${documentPlanSha256}`,request,sourceCurrent,signal)
    const snapshot=await adoptCommittedData(value)
    return {result,...snapshot?{snapshot}:{}}
  }
  async function confirmOperation(sessionId:string,operationId:string,signal:AbortSignal):Promise<ReaderOpeningVariantResultV1> {
    if(!deps.confirmOpeningVariants)fail('READER_OPENING_VARIANTS_RECOVERY_UNAVAILABLE')
    return deps.confirmOpeningVariants(sessionId,operationId,signal)
  }
  async function capture(sid:string,messages:readonly ReaderDisplayMessageRef[],signal:AbortSignal)
    :Promise<ReaderDisplayResponse> {
    signal.throwIfAborted()
    if(disposed)fail('READER_DISPLAY_DISPOSED')
    const session=deps.session(sid)
    if(!session)fail('READER_DISPLAY_SESSION_INACTIVE')
    // Keep only author/scopes in the existing Source slot. Native rows and their
    // full canonical depth are fresh for each requested batch, never cached here.
    const read=deps.inputState.captureSource(sid,'reader-display-author',()=>{
      const authorRead=deps.authorSource?.(sid),author=authorRead?.data
      const captured=author?.kind==='author-data'?author.captured:deps.source.capture(sid)
      if(captured.kind!=='captured-data')fail(captured.kind==='refused'
        ?captured.diagnostics[0]?.code??'READER_DISPLAY_SOURCE_UNAVAILABLE':'READER_DISPLAY_SOURCE_UNAVAILABLE')
      // Negative schema scope reads must expire when its owner publishes a
      // recovered view. The existing observation slot propagates that change
      // to this Source capture without rebuilding any prompt scope.
      const scopes=deps.scopes(sid,captured.source),
        identity=scopes?.source,source=captured.source
      if(identity&&(identity.sessionId!==sid||identity.sourceRecordSessionId!==source.sourceRecordSessionId
        ||identity.importId!==source.original.activePointer.importId||identity.rawSha256!==source.original.rawSha256))
        fail('READER_DISPLAY_SCOPE_SOURCE_CHANGED')
      const cardData='contributionInput' in captured?captured.contributionInput.rawDecoded.data:captured.cardData
      const scopedRules=captureRoleplayTavernScopedRegexV1(cardData,source.sourceSha256,true)
      const policy=deps.community?.policy(sid)
      const variables=policy?.preset?deps.community!.variables(sid,policy.preset.id):undefined
      const adapted=policy?{...policy,
        preset:policy.preset?{...policy.preset,regexes:policy.preset.regexes.map(nativeCommunityDisplayRule)}:null,
        regexes:policy.regexes.map(library=>({...library,rules:library.rules.map(nativeCommunityDisplayRule)}))}:undefined
      const rules=adapted?communityRegexRules(adapted,scopedRules):scopedRules
      const rawRules=(cardData.extensions as {regex_scripts?:readonly Record<string,unknown>[]} |undefined)?.regex_scripts??[]
      const nativeMacros=produceRoleplayTavernMacroSnapshotV1({source,cardData,
          includeCardStyle:deps.includeCardStyle(sid),inputText:null,scopes:scopes?.bindings??[],
          presetVariables:policy?.helperVariables,
          ...author?.kind==='author-data'?{avatarPaths:{user:author.personas?.selectedAvatarDataUrl??null,
            character:author.captured.avatarPath}}:{},
          randomSeed:source.sourceSha256,outlets:[],declaredOutlets:[]}).snapshot
      const communityBindings=variables&&policy?communityRegexMacros({},variables.chat,variables.global,policy.fingerprint,
        {preset:policy.helperVariables}):undefined
      // Source owns MVU and native scopes; accepted community values overlay
      // only their matching chat/global keys without mutating its frozen input.
      const mergeBindings=(key:'localVariables'|'globalVariables')=>[...new Map(
        [...nativeMacros[key],...communityBindings![key]].map(binding=>[binding.key,binding])).values()]
      let macros=nativeMacros
      if(communityBindings) {
        const chat=nativeMacros.variableScopes?.chat,global=nativeMacros.variableScopes?.global,
          currentChat=communityBindings.variableScopes!.chat!,currentGlobal=communityBindings.variableScopes!.global!
        const chatValues={...chat&&Object.hasOwn(chat.values,'stat_data')?{stat_data:chat.values.stat_data}:{},...currentChat.values},
          globalValues={...global?.values,...currentGlobal.values}
        macros={...nativeMacros,localVariables:mergeBindings('localVariables'),globalVariables:mergeBindings('globalVariables'),
          variableScopes:{...nativeMacros.variableScopes,
            chat:{...currentChat,values:chatValues,valuesSha256:recordSha256(chatValues)},
            global:{...currentGlobal,values:globalValues,valuesSha256:recordSha256(globalValues)}}}
      }
      return {source,cardData,sourceIdentitySha256:captured.currentIdentitySha256,scopes,macros,policy,variables,
        authorRead,sourceCatalog:author?.kind==='author-data'?author.sourceCatalog:undefined,
        literalStyles:new Map<string,string>(),
        rules,documentRules:scopedRules.map((rule,ordinal)=>({
          ruleId:rules.find(effective=>effective.sourcePointer===rule.sourcePointer
            &&effective.sourceSnapshotSha256===rule.sourceSnapshotSha256)!.id,
          ordinal,id:typeof rawRules[ordinal]!.id==='string'
          ?rawRules[ordinal]!.id as string:rule.id,pointer:rule.sourcePointer,
          descriptorSha256:recordSha256(rawRules[ordinal]),replacement:rule.replaceString}))}
    })
    const storyText=deps.captureStoryText?.(sid)
    const current=()=>{
      signal.throwIfAborted()
      read.assertCurrent()
      read.data.authorRead?.assertCurrent()
      if(storyText&&!storyText.current())fail('READER_DISPLAY_MESSAGE_CHANGED')
    }
    current()
    const events=eventsOf(session),nativeCut=deps.inputState.nativeHistory?.cut?.(session),
      nativeMessages=nativeCut?.source==='native',
      edits=new Map(deps.messageEdits.current(session,events)
      .map(event=>[Number(event.data?.targetSeq),event]))
    const select=()=>{
      const actual=eventsOf(session),entries=surfaceEntries(session),bySeq=new Map(entries.map((entry,index)=>[entry.seq,{entry,index}]))
      const rows=messages.map(ref=>{
        const found=bySeq.get(ref.seq),event=actual[ref.seq]
        if(!found||found.entry.kind!=='assistant'||found.entry.messageId!==ref.messageId
          ||event?.type!=='assistant/message')fail('READER_DISPLAY_MESSAGE_UNAVAILABLE')
        const message=(session.deriveEventMessage?.(event)??event.data?.message) as ContextMessage|undefined
        if(!message||message.id!==ref.messageId)fail('READER_DISPLAY_MESSAGE_CHANGED')
        const edit=edits.get(ref.seq)
        const raw=nativeMessages?deps.selectedMessageFacts?.(message):undefined,
          rawText=raw?.text??textOf(message.content),messageVersionSha256=raw?.messageVersionSha256??recordSha256(message)
        return {seq:ref.seq,messageId:ref.messageId,rawText,
          effectiveText:storyText?.text(ref.seq,message as Parameters<NonNullable<typeof storyText>['text']>[1],rawText,
            messageVersionSha256)??rawText,
          messageVersionSha256,depth:entries.length-found.index-1,
          isEdit:edit?.data?.role==='assistant'&&edit.data.messageId===ref.messageId}
      })
      return {rows,entries,events:actual,order:entries.map(entry=>({seq:entry.seq,messageId:entry.messageId,kind:entry.kind}))}
    }
    const selected=select(),{source,scopes,macros,rules,policy,variables}=read.data
    const regexInputs=await deps.captureRegexInputs?.(sid,source,signal)
    current()
    const contextRevision=recordSha256({source:read.data.sourceIdentitySha256,
      avatars:read.data.macros.dynamic.filter(row=>row.key==='userAvatarPath'||row.key==='charAvatarPath')
        .map(row=>row.valueSha256),regex:regexInputs?.basisSha256??null,
      scopes:scopes?.versionSha256??null,community:policy?{fingerprint:policy.fingerprint,variables}:null,order:selected.order,
      messages:selected.rows.map(({seq,messageId,messageVersionSha256,depth,isEdit})=>
        ({seq,messageId,messageVersionSha256,depth,isEdit}))})
    const phaseId=randomUUID(),phaseController=new AbortController(),requestSignal=signal
    const abortPhase=()=>{
      phaseController.abort(requestSignal.reason)
      const phase=phases.get(phaseId)
      if(phase)void releasePhase(phase.binding)
    }
    requestSignal.addEventListener('abort',abortPhase,{once:true})
    signal=phaseController.signal
    const phaseCurrent=()=>{
      current()
      if(regexInputs&&!regexInputs.current())fail('READER_REGEX_PHASE_CHANGED')
    }
    const sourceRead={source,session,entries:selected.entries,events:selected.events,cardData:read.data.cardData,
      ...nativeMessages?{selectedMessageFacts:deps.selectedMessageFacts,
        nativePrefixSha256:nativeCut.prefixSha256(selected.events.length)}:{}}
    let documentRead:Promise<ReaderRegexDocumentReadFactsV1|undefined>|undefined
    const documentFacts=()=>documentRead??=(async()=>{
      const facts=await deps.documentFacts?.(sid,sourceRead)
      current()
      if(!facts)return
      if(!facts.current())fail('READER_REGEX_DOCUMENT_SCOPE_CHANGED')
      const scopeSource=facts.data.scopeFrame.source
      if(scopeSource.sessionId!==sid||scopeSource.sourceRecordSessionId!==source.sourceRecordSessionId
        ||scopeSource.importId!==source.original.activePointer.importId||scopeSource.rawSha256!==source.original.rawSha256)
        fail('READER_REGEX_DOCUMENT_SCOPE_SOURCE_CHANGED')
      return facts
    })()
    let worldbook:Awaited<ReturnType<typeof prepareReaderWorldbookV1>>
    try {
    const renderDiagnostics=new Map<number,readonly AuthorNativeDiagnosticV1[]>()
    const renderFailure=(error:unknown)=>{
      current()
      const code=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)
        ?error.message:'READER_WORLDBOOK_RENDER_UNAVAILABLE'
      if(code.endsWith('_SCOPE_CHANGED'))fail(code)
      for(const [index] of selected.rows.entries())renderDiagnostics.set(index,[{code}])
    }
    if(read.data.sourceCatalog&&deps.templateRuntime)try {
      worldbook=await prepareReaderWorldbookV1({catalog:read.data.sourceCatalog,rows:selected.rows,macros,rules,
        scriptOrder:policy?.regexOrder,signal,assertCurrent:current,facts:documentFacts,
        clockEpochMs:row=>selected.events[row.seq]?.time,runtime:engine=>deps.templateRuntime!(signal,engine),
        regexInputs,phaseId})
    }catch(error){renderFailure(error)}
    let input:TavernPromptTransformInputV1={schemaVersion:1,encoding:'owned-tavern-prompt-transform-v1',
      authority:'consumer-data-only',sourceSnapshotSha256:source.sourceSha256,regexDisabled:false,macros,rules,
      ...policy?{scriptOrder:policy.regexOrder}:{},
      entries:selected.rows.map(row=>{
        let scope=acceptedScope(row,scopes?.displayUpdates??[])
        if(scope&&row.effectiveText!==row.rawText){
          // Only the exact accepted protocol block may stay hidden after an
          // author moves surrounding prose. New hook-authored blocks are data.
          const block=row.rawText.slice(scope.acceptedRange.start,scope.acceptedRange.end),start=row.effectiveText.indexOf(block)
          scope=start<0?undefined:{...scope,acceptedRange:{start,end:start+block.length}}
        }
        const storyText=projectReaderNarrativeDisplay(row.effectiveText,scope)
        return {key:`reader:${row.seq}:${row.messageId}:${row.messageVersionSha256}`,bookId:null,entryId:null,
          sourcePointer:`/native/messages/${row.seq}`,sourceSnapshotSha256:source.sourceSha256,
          rawText:row.rawText,storyText,inputText:storyText,pipeline:'regex-only',channel:'display',placement:2,
          depth:row.depth,isEdit:row.isEdit,characterOverride:null,required:true}
      })}
    if(worldbook?.dynamic) {
      const before=await worldbook.dynamic.before(input.entries.map(entry=>entry.inputText))
      phaseCurrent()
      input={...input,entries:input.entries.map((entry,index)=>({...entry,
        inputText:before[index]!,storyText:before[index]!}))}
    }
    const transformed=rules.length
      ?await applyTavernPromptTransformsV1(input,{assertCurrent:current,signal,displayProvenance:true}):undefined
    current()
    if(transformed&&transformed.kind!=='transformed')fail(transformed.diagnostics[0]?.code??'READER_DISPLAY_UNAVAILABLE')
    let rows:ReaderDisplayRow[]=selected.rows.map((row,index)=>{
      const displayText=transformed?.output.entries[index]!.outputText??input.entries[index]!.inputText,
        replacements=transformed?.displayProvenance?.[index]?.replacements??[],
        fragments=projectReaderDisplayFragments(displayText,replacements),styles=new Set<string>()
      for(const replacement of replacements) {
        if(fragments?.some(fragment=>fragment.kind==='author-document'
          &&'displaySpan' in fragment.origin
          &&fragment.origin.displaySpan.start===replacement.start&&fragment.origin.displaySpan.end===replacement.end))continue
        for(const part of replacement.parts)if(part.kind==='literal') {
          let css=read.data.literalStyles.get(part.text)
          if(css===undefined){css=sourceLiteralReaderCss(part.text);if(css)read.data.literalStyles.set(part.text,css)}
          if(css){styles.delete(css);styles.add(css)}
        }
      }
      const css=Array.from(styles).join('\n')
      const {effectiveText:_effectiveText,...original}=row
      return {...original,displayText,...fragments?{fragments}:{},...css?{css}:{}}
    })
    let execution:ReaderDisplayExecution|undefined,documentDiagnostics:readonly AuthorNativeDiagnosticV1[]|undefined
    let worldbookProjections=worldbook?.before??[]
    if(worldbook&&!worldbook.dynamic)try {worldbookProjections=[...worldbookProjections,...await worldbook.after(rows)]}
    catch(error){renderFailure(error)}
    for(const [index,diagnostics] of worldbook?.diagnostics??[])
      renderDiagnostics.set(index,[...renderDiagnostics.get(index)??[],...diagnostics])
    if(renderDiagnostics.size)rows=rows.map((row,index)=>renderDiagnostics.has(index)
      ?{...row,renderDiagnostics:renderDiagnostics.get(index)}:row)
    async function finish(worldbookProjections:readonly ReaderWorldbookProjectionV1[]):Promise<ReaderDisplayResponse> {
    let writerFacts:ReaderRegexDocumentReadFactsV1|undefined,writerSourceRead:ReaderDocumentSourceRead|undefined
    let compilerDiagnostics:readonly AuthorNativeDiagnosticV1[]|undefined
    const documents:ReaderRegexDocumentInputV1['documents'][number][]=[],locations:{row:number;fragment:number}[]=[]
    for(const [rowIndex,row] of rows.entries())for(const [fragmentIndex,fragment] of (row.fragments??[]).entries()) {
      if(fragment.kind!=='author-document')continue
      if(!('ruleId' in fragment.origin))continue
      const origin=fragment.origin,regex=read.data.documentRules.find(rule=>rule.ruleId===origin.ruleId)
      // This routes Source markup to the complete parser; it grants no script
      // permission. Script-free documents retain the existing static owner.
      if(!regex||!/<script(?:\s|>)/i.test(regex.replacement))continue
      const {seq,messageId,messageVersionSha256,depth,isEdit}=row
      documents.push({regex,message:{seq,messageId,messageVersionSha256,depth,isEdit},
        replacementSpan:fragment.origin.displaySpan,parts:fragment.parts})
      locations.push({row:rowIndex,fragment:fragmentIndex})
    }
    const documentSource={sessionId:sid,sourceRecordSessionId:source.sourceRecordSessionId,
      importId:source.original.activePointer.importId,rawSha256:source.original.rawSha256,
      sourceSnapshotSha256:source.sourceSha256,materialSha256:source.current.materialSha256}
    if(documents.length||worldbookProjections.length) {
      const {compileReaderNativeDocumentsV1,createReaderNativeDocumentProgramV1}=
        await import('./reader-native-document-compiler.mjs')
      const facts=await documentFacts()
      if(!facts)compilerDiagnostics=[{code:'READER_REGEX_DOCUMENT_SCOPE_UNAVAILABLE'}]
      else {
        current()
        const regex=compileReaderNativeDocumentsV1({schemaVersion:1,encoding:'reader-regex-document-input-v1',
          source:documentSource,documents})
        const worldbookProjection=projectReaderWorldbookDocumentsV1({source:documentSource,rows,
          projections:worldbookProjections})
        const worldbook=compileReaderNativeDocumentsV1(worldbookProjection.bound)
        const byLocation=new Map(regex.documentInputIndices.map((inputIndex,index)=>{
          const location=locations[inputIndex]!
          return [location.row+':'+location.fragment,regex.documents[index]!.documentPlanSha256]
        }))
        const failedLocations=new Map(regex.documentFailures.map(failure=>{
          const location=locations[failure.inputIndex]!
          return [location.row+':'+location.fragment,failure.diagnostics]
        }))
        rows=rows.map((row,rowIndex)=>({...row,fragments:row.fragments?.map((fragment,fragmentIndex)=>
          fragment.kind==='author-document'?{...fragment,documentPlanSha256:byLocation.get(rowIndex+':'+fragmentIndex),
            documentDiagnostics:failedLocations.get(rowIndex+':'+fragmentIndex)}:fragment)}))
        for(const [index,inputIndex] of worldbook.documentInputIndices.entries())
          worldbookProjection.fragments[inputIndex]={...worldbookProjection.fragments[inputIndex]!,
            documentPlanSha256:worldbook.documents[index]!.documentPlanSha256}
        for(const failure of worldbook.documentFailures)
          worldbookProjection.fragments[failure.inputIndex]={...worldbookProjection.fragments[failure.inputIndex]!,
            documentDiagnostics:failure.diagnostics}
        rows=worldbookProjection.append(rows)
        const program=createReaderNativeDocumentProgramV1(documentSource,{
          documents:[...regex.documents,...worldbook.documents],
          failedDocuments:regex.failedDocuments,failedWorldbookDocuments:worldbook.failedWorldbookDocuments,
          worldbookProducers:worldbook.worldbookProducers})
        const groups=[...new Set(program.documents.map(document=>document.writes))]
        const parentOrigins=await deps.nativeParentOrigins?.(groups)??{}
        current()
        execution={backend:'browser-native-v1',program,parentOrigins,snapshot:{...facts.data,
          readerVariables:documentVariables(facts,program),generation:program.programSha256,readRevision:++readRevision}}
        writerFacts=facts;writerSourceRead=sourceRead
      }
    }
    if(documentDiagnostics?.length) {
      const failedLocations=new Set(locations.map(location=>location.row+':'+location.fragment))
      rows=rows.map((row,rowIndex)=>({...row,fragments:row.fragments?.map((fragment,fragmentIndex)=>
        fragment.kind==='author-document'&&failedLocations.has(rowIndex+':'+fragmentIndex)
          ?{...fragment,documentDiagnostics}:fragment)}))
    }
    if(compilerDiagnostics?.length&&!execution) {
      const pendingLocations=new Set(locations.map(location=>location.row+':'+location.fragment))
      rows=rows.map((row,rowIndex)=>({...row,fragments:row.fragments?.map((fragment,fragmentIndex)=>
        fragment.kind==='author-document'&&pendingLocations.has(rowIndex+':'+fragmentIndex)
          ?{...fragment,documentPending:true as const}:fragment)}))
    }
    // A new visible user/assistant can change depth without editing these rows.
    // Rejoin the actual selected messages after Worker completion before reply.
    const latest=select()
    for(let index=0;index<selected.rows.length;index++) {
      const before=selected.rows[index]!,after=latest.rows[index]!
      if(before.messageVersionSha256!==after.messageVersionSha256||before.depth!==after.depth)
        fail('READER_DISPLAY_MESSAGE_CHANGED')
    }
    const writerGranted=execution?.program.documents.some(document=>document.writes==='source-regex')
    if(execution&&writerFacts?.sourceCurrent&&writerSourceRead
      &&(deps.mutateOpeningVariants||deps.editMessageBody||deps.mutateNamespace)&&writerGranted) {
      current()
      if(!writerFacts.current()||!writerFacts.sourceCurrent())fail('READER_REGEX_DOCUMENT_SCOPE_CHANGED')
      const binding:ReaderRegexDocumentBindingV1={principal:'reader-regex-document',sessionId:sid,
        browserSessionId:randomUUID(),generation:randomUUID(),programSha256:execution.program.programSha256}
      const snapshot={...execution.snapshot,generation:binding.generation}
      const sourceCurrent=writerFacts.sourceCurrent
      bindings.set(binding.browserSessionId,{binding,program:execution.program,sourceRead:writerSourceRead,
        sourceCurrent:()=>!disposed&&sourceCurrent(),facts:writerFacts,snapshot})
      execution={...execution,binding,snapshot}
    }
    return {ok:true,sessionId:sid,contextRevision,
      rows,...execution?{execution}:{},...documentDiagnostics?{documentDiagnostics}:{},
      ...compilerDiagnostics?{compilerDiagnostics}:{}}
    }
    if(!worldbook?.dynamic) {
      try{return await finish(worldbookProjections)}finally{
        requestSignal.removeEventListener('abort',abortPhase);await worldbook?.dispose()
      }
    }
    const initialRows=rows,binding:ReaderRenderPhaseBindingV1={sessionId:sid,phaseId,
        generation:randomUUID(),contextRevision}
    for(const previous of [...phases.values()])if(previous.binding.sessionId===sid)await releasePhase(previous.binding)
    let completing=false
    const close=async()=>{
      phaseController.abort();requestSignal.removeEventListener('abort',abortPhase);await worldbook!.dispose()
    }
    phases.set(phaseId,{binding,dispose:close,async complete(request,requestSignal){
      if(completing)fail('READER_REGEX_PHASE_BUSY')
      completing=true
      const abort=()=>phaseController.abort(requestSignal.reason)
      requestSignal.addEventListener('abort',abort,{once:true})
      try {
        requestSignal.throwIfAborted();phaseCurrent()
        if(request.rows.length!==initialRows.length)fail('READER_REGEX_TARGET_CHANGED')
        const slots:ReaderNarrativeHtmlV1[]=[]
        for(const [index,row] of initialRows.entries()) {
          const actual=request.rows[index]!,expected=row.fragments
            ?row.fragments.flatMap((fragment,fragmentIndex)=>fragment.kind==='text'?[fragmentIndex]:[]):[null]
          if(actual.seq!==row.seq||actual.messageId!==row.messageId||actual.messageVersionSha256!==row.messageVersionSha256
            ||actual.narrative.length!==expected.length)fail('READER_REGEX_TARGET_CHANGED')
          for(const [slotIndex,fragmentIndex] of expected.entries()) {
            const slot=actual.narrative[slotIndex]!
            if(slot.fragmentIndex!==fragmentIndex||typeof slot.html!=='string')fail('READER_REGEX_TARGET_CHANGED')
            slots.push({row:index,fragmentIndex,html:slot.html})
          }
        }
        const narrative=await worldbook!.dynamic!.html(slots)
        phaseCurrent()
        const after=await worldbook!.after(rows.map((_row,index)=>({
          displayText:narrative.filter(slot=>slot.row===index).map(slot=>slot.html).join('')})))
        phaseCurrent()
        const display=await finish([...worldbookProjections,...after])
        phaseCurrent()
        return {ok:true,binding,display,narrative}
      }finally{requestSignal.removeEventListener('abort',abort)}
    }})
    return {ok:true,sessionId:sid,contextRevision,rows,phase:binding}
    }catch(error){
      requestSignal.removeEventListener('abort',abortPhase);phaseController.abort();await worldbook?.dispose()
      throw error
    }
  }
  return {capture,renderHtml,releasePhase,mutateBinding,mutateMessageBody,mutateNamespace,replaceNumerical,executeCommands,releaseBinding,confirmOperation,
    invalidateSession(sid:string){
      for(const value of bindings.values())if(value.binding.sessionId===sid)releaseBinding(value.binding)
      for(const value of phases.values())if(value.binding.sessionId===sid)void releasePhase(value.binding)
    },
    dispose(){disposed=true;bindings.clear();for(const value of [...phases.values()])void releasePhase(value.binding)}}
}
