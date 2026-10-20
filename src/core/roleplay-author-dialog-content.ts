/** Explicit author-dialogue prepares requested ST slots from one current
 * Source capture. It has no Main material lease, publication or user phase. */
import type {Session,SessionMessageProjection} from '@deepseek-ai/dsh-session'
import {recordSha256,sha256} from './roleplay-data.js'
import {readTavernCardMacroFields} from './nexttavern-card.js'
import {captureRoleplayTavernPromptSourceDataV1} from './roleplay-tavern-prompt-source.js'
import {captureRoleplayTavernPromptScopesV1} from './roleplay-tavern-prompt-scopes.js'
import type {TavernActualSchemaPromptScopesV1} from './roleplay-tavern-prompt-scopes.js'
import {captureReadonlyAuthorDialogChatClockV1} from './roleplay-tavern-chat-clock.js'
import {captureRoleplayTavernMaterialHistoryV1} from './roleplay-tavern-material-history.js'
import {captureRoleplayTavernTimedHistoryV2} from './roleplay-tavern-lore-timed-lineage.js'
import {produceRoleplayTavernMacroSnapshotV1,captureRoleplayTavernScopedRegexV1} from './roleplay-tavern-prompt-macros.js'
import {prepareRoleplayTavernContentV1,produceTavernPromptVariableRefV1,
  resolveCapturedTavernPromptSettingsV1} from './roleplay-tavern-content.js'
import type {TavernContentExecutionV1} from './roleplay-tavern-content.js'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {AUTHOR_DIALOG_HOST_SLOTS_V1,freezeAuthorDialogPromptV1} from './roleplay-author-dialog.js'
import type {AdmittedAuthorDialogTarget,AuthorDialogHostSlotV1} from './roleplay-author-dialog.js'
import type {AuthorChatBindingV2,AuthorChatCaptureV2} from './roleplay-author-chat-state-v2-types.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'
import type {BrowserGenerateRawRequestV2} from './tavern-author-browser-types-v2.mjs'
import type {AdmittedTavernTemplateComponentV1} from './roleplay-tavern-template-assets.js'
import type {TavernLoreVisibleMessageV1} from './tavern-lore-evaluator-types.mjs'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {TavernLorePlanV1} from './tavern-lore-plan-types.mjs'

export const AUTHOR_DIALOG_CONTENT_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'native-readonly-author-dialog-content-policy-v1',authority:'consumer-data-only',
  fields:'current-activated-ST-aliases; independent-of-edited-Native-classified-prose',
  lore:'current-edits-initial-cache-macros-selected-EJS-and-WORLD_INFO-regex',
  scan:'actual-completed-canonical-Native-prefix; provider-history-is-separately-zero',
  output:'requested-before-after-slots-and-three-fields; literal-original-dynamic-system',
  effects:'no-Main-generation-callback-or-injection-owner; stateful-template-effects-refused',
  timing:'readonly-current-fold; no-timed-proposal-or-Native-material-publication',
  requests:{normal:0,retry:0,fallback:0}})
const policySha256=recordSha256(AUTHOR_DIALOG_CONTENT_POLICY_V1)
type SourceDeps=Parameters<typeof captureRoleplayTavernPromptSourceDataV1>[0]
type TimedDeps=Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]
interface Dependencies extends SourceDeps {
  readonly inputState:RoleplayInputStateOwner
  readonly branch:Parameters<typeof captureRoleplayTavernMaterialHistoryV1>[0]['table']
  captureContentExecution?(sid:string,plan:TavernLorePlanV1):{
    execution:TavernContentExecutionV1;assertCurrent():void;release():void}|undefined
  session(sid:string):Session|undefined
  projections():readonly SessionMessageProjection[]
  schemaScopes(sid:string):TavernActualSchemaPromptScopesV1|undefined
  captureAuthorChat(binding:AuthorChatBindingV2):AuthorChatCaptureV2
  preflight(sid:string,signal:AbortSignal):Promise<void>
  includeCardStyle(sid:string):boolean
  withSourceLock<T>(sid:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
  loadTemplate(signal:AbortSignal):Promise<AdmittedTavernTemplateComponentV1>
  inheritedTiming(sid:string,source:TimedDeps['source'],assertCurrent:()=>void)
    :{sourceLineage:NonNullable<TimedDeps['sourceLineage']>;
      inheritedHistory:NonNullable<TimedDeps['inheritedHistory']>;assertCurrent():void}|undefined
}
function fail(code:string):never {throw Error(code)}
function dynamicSystem(request:BrowserGenerateRawRequestV2):string {
  const options=request.options,ordered=options.ordered_prompts
  if(Object.keys(options).length!==3||options.should_silence!==true||options.max_chat_history!==0
    ||!Array.isArray(ordered)||ordered.length!==6
    ||AUTHOR_DIALOG_HOST_SLOTS_V1.some((slot,index)=>ordered[index]!==slot))fail('AUTHOR_DIALOG_OPTIONS_UNSUPPORTED')
  const last=ordered[5]
  if(!last||typeof last!=='object'||Array.isArray(last)||Object.keys(last).length!==2
    ||last.role!=='system'||typeof last.content!=='string')fail('AUTHOR_DIALOG_OPTIONS_UNSUPPORTED')
  return last.content
}
export function createRoleplayAuthorDialogContentV1(deps:Dependencies) {
  async function capturePrompt(sid:string,target:AdmittedAuthorDialogTarget,request:BrowserGenerateRawRequestV2,
    operationId:string,current:()=>boolean,signal:AbortSignal) {
    const dynamic=dynamicSystem(request)
    await deps.preflight(sid,signal)
    const session=deps.session(sid)
    if(!session)fail('AUTHOR_DIALOG_SESSION_INACTIVE')
    const assertOwner=()=>{
      signal.throwIfAborted()
      if(!current()||deps.session(sid)!==session)fail('BROWSER_ATTACHMENT_REVOKED')
    }
    const read=await deps.withSourceLock(sid,async()=>deps.inputState.captureAuthorDialog({session,signal,
      assertOwnerFactsCurrent:assertOwner},operationId,()=>{
      const includeCardStyle=deps.includeCardStyle(sid),
        captured=captureRoleplayTavernPromptSourceDataV1(deps,sid,includeCardStyle)
      if(captured.kind==='outside-declared-domain')fail('AUTHOR_DIALOG_SOURCE_UNAVAILABLE')
      const schema=deps.schemaScopes(sid),binding=target.binding,
        browser='schemaVersion' in binding?schema?.authorBrowserV3:schema?.authorBrowser
      if(!schema||!browser||browser.program.programSha256!==target.programSha256)
        fail('AUTHOR_DIALOG_SOURCE_CHANGED')
      // Both reads occur inside this InputState operation. Its exact State2
      // head subscription includes an absent head and survives the model wait.
      const authorChat='schemaVersion' in binding?deps.captureAuthorChat(binding):schema.authorBrowser?.authorChat
      if(!authorChat)fail('AUTHOR_DIALOG_SOURCE_CHANGED')
      const clock=captureReadonlyAuthorDialogChatClockV1({session,projections:deps.projections(),assertOwnerCurrent:assertOwner}),
        scopeData=captureRoleplayTavernPromptScopesV1({source:captured.source,
          currentIdentitySha256:captured.currentIdentitySha256,schema,selected:clock.selected,
          isStoryMessage:()=>true,scriptId:target.scriptIdentity,authorChat,
          ...'schemaVersion' in binding?{authorDialogScopes:browser.scopes}:{},assertOwnerCurrent:assertOwner}),
        history=captureRoleplayTavernMaterialHistoryV1({sessionId:sid,table:deps.branch,
          events:()=>session.snapshotEvents(),projections:deps.projections,assertOwnerCurrent:assertOwner}),
        inherited=deps.inheritedTiming(sid,captured.source,assertOwner),
        timed=captureRoleplayTavernTimedHistoryV2({sessionId:sid,source:captured.source,compilation:captured.compilation,
          ownHistory:history,clock,projections:deps.projections(),sourceLineage:inherited?.sourceLineage,
          inheritedHistory:inherited?.inheritedHistory,assertOwnerCurrent:assertOwner,
          assertSourceLineageCurrent:()=>inherited?.assertCurrent()})
      return {captured,scopeData,clock,timed,binding,authorChat,includeCardStyle,
        contentExecution:deps.captureContentExecution?.(sid,captured.compilation.plan)}
    }),signal)
    try {
      read.assertCurrent()
      const {captured,scopeData,clock,timed,binding,authorChat,includeCardStyle,contentExecution}=read.data,
        {source,compilation}=captured,
        assertCurrent=()=>{read.assertCurrent();contentExecution?.assertCurrent()},
        attemptId=`author-dialog:${operationId}`,seed=recordSha256({policySha256,operationId,
          sourceSha256:source.sourceSha256,scopeEvidence:scopeData.evidence,authorChat:authorChat.captureSha256}),
        clockEpochMs=Date.now(),settings=resolveCapturedTavernPromptSettingsV1(source),
        declaredOutlets=compilation.plan.entries.flatMap(entry=>{
          const semantic={...ST_LORE_ENTRY_DEFAULTS_V1,...entry.semanticOverrides}
          return semantic.position==='named-outlet'&&semantic.outletName?[semantic.outletName]:[]
        })
      const macrosFor=(scopes:readonly TavernTemplateScopeBindingV1[],
        outlets:readonly {name:string;text:string;versionSha256:string}[]=[])=>produceRoleplayTavernMacroSnapshotV1({
          source,cardData:captured.cardData,includeCardStyle,inputText:null,scopes,outlets,declaredOutlets}).snapshot
      const macros=macrosFor(scopeData.bindings),context=source.current.openingContext.context,
        visibleMessages:TavernLoreVisibleMessageV1[]=[...clock.scanRows].reverse().map(row=>{
          const speakerName=row.role==='user'?context.user!:context.char!,text=row.text,
            scanText=settings.includeNames?`${speakerName}: ${text}`:text
          return {messageId:row.id,versionSha256:row.messageSha256,role:row.role,speakerName,text,textSha256:sha256(text),
            scanPolicy:'owner-captured-st-message-string-v1',scanText,scanTextSha256:sha256(scanText)}
        }),component=await deps.loadTemplate(signal)
      assertCurrent()
      const prepared=await prepareRoleplayTavernContentV1({captured,scopeData,timed:timed.timed,settings,visibleMessages,macrosFor,
        ...contentExecution?{execution:contentExecution.execution}:{},
        attempt:{attemptId,traceCounter:0,provenance:produceTavernPromptVariableRefV1(`${sid}:actual-author-dialog`,
          recordSha256({operationId,binding,revision:authorChat.revision}),{schemaVersion:1,
            encoding:'native-author-dialog-content-attempt-v1',policySha256,operationId,binding,
            authorChatCaptureSha256:authorChat.captureSha256,nativeClockSha256:clock.data.clockSha256})},
        renderInput:{source,plan:compilation.plan,component,macros,
          rules:captureRoleplayTavernScopedRegexV1(captured.cardData,source.sourceSha256,true),scopes:scopeData.bindings,
          authorsNoteDepth:0,basis:{sessionId:sid,branchId:sid,revision:timed.timed.revision,
            turnId:attemptId,attemptId,packageSha256:source.original.documentSha256,
            sourceSnapshotSha256:source.sourceSha256,stateSnapshotSha256:scopeData.stateSnapshotSha256,
            clockEpochMs,randomSeed:seed},assertCurrent,signal}})
      assertCurrent()
      const aliases=readTavernCardMacroFields(captured.cardData,source.original.decodedFormat),
        hostSlots={} as Record<AuthorDialogHostSlotV1,{text:string;sourceSha256:string}>,
        finalById=new Map(prepared.finalLore.map(row=>[row.entryId,row]))
      for(const [slot,position] of [['world_info_before','before-character'],['world_info_after','after-character']] as const) {
        const placements=prepared.evaluated.plan.placements.filter(row=>row.position===position),
          texts=placements.map(row=>finalById.get(row.entryId)!).filter(row=>row.text.length)
        hostSlots[slot]={text:texts.map(row=>row.text).join('\n'),sourceSha256:recordSha256({policySha256,
          sourceSha256:source.sourceSha256,placements,texts})}
      }
      for(const [slot,field] of [['char_description','description'],['char_personality','personality'],['scenario','scenario']] as const) {
        const raw=typeof aliases[field]==='string'?aliases[field].trim():'',
          rendered=await prepared.render.render(`/native/author-dialog/${slot}`,raw,
            {macros:prepared.authorMacros,placement:1,phase:'late-author'})
        assertCurrent()
        if(rendered.activationProposals.length)fail('AUTHOR_DIALOG_FIELD_ACTIVATION_UNSUPPORTED')
        hostSlots[slot]={text:rendered.renderedText,sourceSha256:recordSha256({policySha256,
          sourceSha256:source.sourceSha256,field,rawSha256:sha256(raw)})}
      }
      const prompt=freezeAuthorDialogPromptV1({binding,revision:authorChat.revision,operationId,hostSlots,
        dynamicSystem:{text:dynamic,sourceSha256:sha256(dynamic)}})
      return {prompt,assertCurrent,release(){contentExecution?.release();read.release()}}
    }catch(error) {read.data.contentExecution?.release();read.release();throw error}
  }
  return {capturePrompt}
}
