/** One actual Core step owns Source capture, variable preparation, selected
 * template evaluation and Native layout data. None of the persisted receipts
 * can recreate the original step, Source lock or Native selected capability. */
import {assertNativeRequestMaterialSelectionV1,nativeInputSha256,projectNativeMessageTextV2} from 'dsh-nexttavern-native-agent-loop'
import type {NativeMaterialSelectedBaseV1,NativeRequestMaterialPrepareInputV1,NativeOpeningMaterialPrepareInputV1,
  NativeMaterialMessageTextProjectionV2,NativeMaterialTextSurfaceV1}
  from 'dsh-nexttavern-native-agent-loop'
import type {SessionMessageProjection} from 'dsh-nexttavern-native-session'
import {recordSha256,sha256,textOf} from './roleplay-data.js'
import type {RoleplayInputSourceDataWindowV1} from './roleplay-input-preparation.js'
import {createStableRoleplayFence} from './roleplay-context.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {captureRoleplayTavernPromptSourceDataV1} from './roleplay-tavern-prompt-source.js'
import {createTavernSourceRenderCatalogV1} from './tavern-source-render-catalog.mjs'
import {captureRoleplayTavernPromptScopesV1} from './roleplay-tavern-prompt-scopes.js'
import type {TavernActualSchemaPromptScopesV1,TavernActualSchemaPromptScopesV2,TavernActualSchemaPromptScopesV3,TavernActualNonnumericalPromptScopesV1,
  TavernActualNumericalPromptScopesV1} from './roleplay-tavern-prompt-scopes.js'
import type {TavernActualPendingOpeningPromptScopesV1,TavernOpeningPreparationSourceDataV1}
  from './roleplay-program-opening-prompt-scopes-types.js'
import {captureRoleplayTavernTimedHistoryV2} from './roleplay-tavern-lore-timed-lineage.js'
import {captureTavernCanonicalChatClockV2} from './roleplay-tavern-chat-clock.js'
import type {TavernCanonicalChatClockCaptureV1,TavernCanonicalChatClockCaptureV2} from './roleplay-tavern-chat-clock.js'
import type {AuthorMessageViewV1} from './roleplay-author-message-capture.js'
import type {AuthorChatNamespaceV3} from './roleplay-author-chat-state-types.js'
import {captureRoleplayTavernMaterialHistoryV1,isTavernHistoryTextOnlyMaterialV1,
  tavernMaterialPublicationRefV1} from './roleplay-tavern-material-history.js'
import {createRoleplayTavernInjectionRegistryV1,createTavernNativeInjectionConsumptionV1,
  releaseTavernNativeInjectionConsumptionV1,TAVERN_NATIVE_FILTER_RECAPTURE,TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR}
  from './roleplay-tavern-injections.js'
import type {TavernNativeFilterReferenceV1,TavernNativeFilterResultV1,TavernNativeInjectionConsumptionV1}
  from './roleplay-tavern-injections.js'
import {createRoleplayTavernEjsPreparation} from './roleplay-tavern-ejs-preparation.js'
import {createRoleplayTavernGenerateLoaderV1} from './roleplay-tavern-generate-loader.js'
import type {createRoleplayTavernEjsPrograms} from './roleplay-tavern-ejs-programs.js'
import type {createCanonicalAuthorChatStateV1,CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import {authorChatContributionIdV3} from './roleplay-author-chat-state.js'
import {createRoleplayTavernOrdinaryStage} from './roleplay-tavern-ordinary-stage.js'
import type {TavernEjsRuntime} from './tavern-template-ejs-runtime-types.mjs'
import type {TavernEjsHostCapture} from './tavern-template-ejs-host-types.mjs'
import {promptProgramSourceOrdinaryNamespaceV3} from './roleplay-prompt-program-source.js'
import {captureRoleplayTavernInjectionDefinitionsV1} from './roleplay-tavern-injection-definitions.js'
import type {TavernPromptVariableAttemptV1,TavernPromptVariableRefV1} from './roleplay-tavern-prompt-variables-types.js'
import {produceRoleplayTavernMacroSnapshotV1,captureRoleplayTavernScopedRegexV1} from './roleplay-tavern-prompt-macros.js'
import type {TavernLoreVisibleMessageV1} from './tavern-lore-evaluator-types.mjs'
import {prepareRoleplayTavernContentV1,produceTavernPromptVariableRefV1 as factRef,
  TAVERN_NATIVE_PROMPT_SETTINGS_V1,resolveCapturedTavernPromptSettingsV1} from './roleplay-tavern-content.js'
import {createRoleplayTavernDerivedContentExecutionV1} from './roleplay-tavern-derived-content-execution.js'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {produceRoleplayTavernLayoutV1,TAVERN_NATIVE_OWNED_SECTION_NAMES_V1} from './roleplay-tavern-layout.js'
import type {PreparationSnapshot} from './roleplay-preparation-types.js'
import type {RoleplayInputMaterialDependenciesV1,RoleplayInputMaterialScopeV1,RoleplayInputMaterialBuildResultV1} from './roleplay-input-material.js'
import type {RoleplayOpeningMaterialScopeV1} from './roleplay-opening-material.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'
import {produceAuthorPromptCaptureV1} from './roleplay-author-prompt-capture.js'
import type {PromptCaptureV1} from './tavern-author-prompt-types.mjs'
import type {BrowserGenerationOutput,AuthorBrowserPreparationFacts} from './roleplay-author-browser-generation-types.js'
import type {AuthorNativeProgramV1} from './author-native-program.mjs'
import {prepareCommunityPresetMaterial} from './community-preset-material.js'
import {normalizeCommunityRegexes,communityTavernRegexDto} from './community-preset-import.js'
import type {CommunityMaterialDependencies} from './community-preset-material.js'
import type {createCommunityPresetSettlement} from './community-preset-settlement.js'
import {produceCommunityPresetCardMaterialV1,produceCommunityNativeCardMaterialV1} from './community-preset-card-material.js'
import type {CommunityCardFieldMappingV1,CommunityCardMarkerV1} from './community-preset-card-material.js'
import {authorContributionTextsV1,produceAuthorContributionDataV1} from './roleplay-author-contributions.js'
import type {TavernRenderedAuthorMaterialV1} from './roleplay-tavern-prompt-types.js'
import type {TavernLoreDerivedSnapshotV1} from './tavern-lore-derived.mjs'
import type {CaptureRoleplayStoryText} from './roleplay-story-text.js'

export {TAVERN_NATIVE_PROMPT_SETTINGS_V1} from './roleplay-tavern-content.js'
export const TAVERN_NATIVE_PROMPT_POLICY_V4=Object.freeze({schemaVersion:4,
  encoding:'native-tavern-actual-core-preparation-policy-v4',
  settings:TAVERN_NATIVE_PROMPT_SETTINGS_V1,bookSettings:'fixed-importer-metadata-not-applied',
  trace:'actual-Core-input-attempt-generation; readonly-template-counter-adaptation',
  initialRegex:'fixed-feature-worldinfo-call-without-generate-selector; no-registry-read',
  author:'same-field-producer; macros-then-standalone-EJS; no-rerender-of-output',
  regex:'activated-card-scoped-rules-in-bounded-worker; explicit-native-owned-allow-policy',
  historyIdentity:'completed-canonical-assistant-text; exact-user-after-regex; opaque-update-container; request-only',
  timing:'actual-Native-material-publication; persisted-consumer-data-only',
  lateAuthor:'scan-and-chat-cut-before-author-EJS; default-persistent-next-generation; once-current-terminal',
  lateActivation:'typed-refusal-after-lore-seal; no-silent-drop-or-invented-next-generation-activation',
  retry:'same-Core-step-frozen-render-and-budget-ledger; actual-Native-selected-lineage-check',
  requests:{normal:0,retry:0,fallback:0},
  promptEffects:'Core-sealed-native-realm-output-in-the-one-published-injection-registry; existing-scan-and-chat-cuts',
  promptClose:'actual-Source-definition-close-and-Native-terminal-disposal; no-worker-or-provider-retry-close',
  promptTransport:{browserRoundTrips:1,preparedProviderRetryRoundTrips:0},
  sourceCapture:'synchronous-Source-FIFO-read; asynchronous-consumers-release-FIFO-and-retain-read-footprint',
  generationHook:'actual-live-native-realm-callbacks; same-InputState-capture',
  ordinaryKeys:'actual-import-namespace-and-ordered-preparation-stage; readonly-input-to-author-callback',
  ordinaryPublication:'one-fixed-input-contribution-after-Native-accepted-assistant-and-completed-turn'})

type SourceDependencies=Parameters<typeof captureRoleplayTavernPromptSourceDataV1>[0]
type ActualMaterialScope=Pick<RoleplayInputMaterialScopeV1,'session'|'turn'|'step'|'signal'>
type ActualNativePreparation=NativeRequestMaterialPrepareInputV1|NativeOpeningMaterialPrepareInputV1
export interface TavernOpeningPreparationReadV1 {
  readonly snapshot:Pick<PreparationSnapshot,'branchId'|'turnId'|'contextMessageRefs'>
  readonly snapshotRef:{readonly key:string;readonly sha256:string}
  readonly ownedBranchRefs:readonly {readonly key:string;readonly sha256:string}[]
  readonly scopes:TavernActualPendingOpeningPromptScopesV1
  readonly attempt:{readonly attemptId:string;readonly traceCounter:number;
    readonly provenance:TavernPromptVariableRefV1;readonly seed:Readonly<Record<string,unknown>>}
  assertCurrent():void
}
interface Dependencies extends SourceDependencies {
  capturePlainMessageView?(input:{session:RoleplayInputMaterialScopeV1['session'];namespace:AuthorChatNamespaceV3;
    chatClock:TavernCanonicalChatClockCaptureV1|TavernCanonicalChatClockCaptureV2;
    plain:Parameters<typeof captureRoleplayTavernPromptScopesV1>[0]['plain'];
    current:()=>boolean}):AuthorMessageViewV1|undefined
  ordinaryPublicationSeq?(session:RoleplayInputMaterialScopeV1['session']):number|null
  captureStoryText?:CaptureRoleplayStoryText
  personas?():ReturnType<typeof import('./roleplay-userinfo.js').captureNativePersonasV1>
  readonly tables:Parameters<typeof produceAuthorContributionDataV1>[0]
  readonly community?:CommunityMaterialDependencies
  readonly settlement:ReturnType<typeof createCommunityPresetSettlement>
  readonly inputState:RoleplayInputStateOwner
  /** Exact pending publications supplied by their actual producer. */
  readonly pendingOutputRows:(sessionId:string)=>readonly {readonly table:string;readonly key:string}[]
  readonly branch:{get(key:string):unknown}
  derivedSnapshot?(sessionId:string):{snapshot:TavernLoreDerivedSnapshotV1;assertCurrent():void;release():void}|undefined
  withSourceLock<T>(sessionId:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
  includeCardStyle(sessionId:string):boolean
  authorPolicy(sessionId:string):Readonly<Record<string,unknown>>
  readonly ejs:{
    readonly programs:ReturnType<typeof createRoleplayTavernEjsPrograms>
    readonly state:ReturnType<typeof createCanonicalAuthorChatStateV1>
    load(signal:AbortSignal):Promise<TavernEjsRuntime>
  }
  projections():readonly SessionMessageProjection[]
  /** Uses the existing selected-window continuity policy and real internal
   * maintenance provenance, with no second prompt budget or Session fold. */
  storyRows(scope:ActualMaterialScope,selected:NativeMaterialSelectedBaseV1)
    :readonly NativeMaterialSelectedBaseV1['messages'][number][]
  schemaScopes(sessionId:string,selection?:Pick<NativeMaterialSelectedBaseV1,'messages'|'sha256'>&{
    purpose?:'prompt-variable-selection-v3';ordinaryChat?:ReturnType<CanonicalAuthorChatStateV1['captureNamespaceV3']>})
    :TavernActualSchemaPromptScopesV1|TavernActualSchemaPromptScopesV2|TavernActualSchemaPromptScopesV3|undefined
  executeAuthorBrowser?(sessionId:string,program:AuthorNativeProgramV1,capture:PromptCaptureV1,
    facts:AuthorBrowserPreparationFacts,signal:AbortSignal,sourceData?:RoleplayInputSourceDataWindowV1):Promise<BrowserGenerationOutput>
  executeAuthorFilter?(input:{readonly reference:TavernNativeFilterReferenceV1;readonly registrationId:string;
    readonly operationId:string;readonly consumer:'scan'|'chat'},signal:AbortSignal,
    sourceData?:RoleplayInputSourceDataWindowV1):Promise<TavernNativeFilterResultV1>
  retireNativeFilters?(references:readonly TavernNativeFilterReferenceV1[]):void
  plainScopes(sessionId:string,currentSourceIdentitySha256:string):TavernActualNonnumericalPromptScopesV1|undefined
  numericalScopes(sessionId:string):TavernActualNumericalPromptScopesV1|undefined
  /** Reads inherited timing once while the input owner records its actual
   * dependencies. Later checkpoints use that captured dependency baseline. */
  inheritedTiming(scope:ActualMaterialScope,source:Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]['source'],
    assertOwnerFactsCurrent:()=>void,
    sourceLineage?:NonNullable<Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]['sourceLineage']>)
    :{sourceLineage:NonNullable<Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]['sourceLineage']>;
      inheritedHistory:NonNullable<Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]['inheritedHistory']>;
      assertCurrent():void}|undefined
  /** Actual no-player Native invocation, immutable inputs and genuine Phase A
   * context refs. This supplier never constructs an Input v2 Work/currency. */
  openingPreparation?(native:NativeOpeningMaterialPrepareInputV1,scope:RoleplayOpeningMaterialScopeV1,
    source:TavernOpeningPreparationSourceDataV1):TavernOpeningPreparationReadV1
}
const joinHistoryBlock=(messageIndex:number,blockIndex:number)=>`history-${messageIndex}-${blockIndex}`
type CommunityMaterial=ReturnType<Awaited<ReturnType<typeof prepareCommunityPresetMaterial>>['finish']>
/** Community owns its history transform once. Keep structural groups in its
 * original projection and publish text edits through Native's per-block V2. */
function communityMaterialV2(selected:NativeMaterialSelectedBaseV1,material:CommunityMaterial) {
  const {messageProjection,...rest}=material
  const messages=new Map(selected.messages.map(row=>[row.id,row]))
  const messageTextProjections:NativeMaterialMessageTextProjectionV2[]=(messageProjection?.textEdits??[]).map(edit=>{
    const row=messages.get(edit.target.id)!,textEdits=edit.blocks.map(block=>({
      blockIndex:block.index,replacementText:block.text}))
    return {target:{...edit.target,role:row.role as 'user'|'assistant'},textEdits,
      projectionSha256:nativeInputSha256(projectNativeMessageTextV2(row.message,textEdits))}
  })
  return {...rest,messageTextProjections,...messageProjection?.groups.length
    ?{messageProjection:{schemaVersion:messageProjection.schemaVersion,
      encoding:messageProjection.encoding,groups:messageProjection.groups}}:{}}
}
function fail(code:string):never {throw Error(code)}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function phaseASnapshot(deps:Dependencies,scope:RoleplayInputMaterialScopeV1):Omit<PreparationSnapshot,'agent'> {
  if(scope.phaseA)return scope.phaseA.current().snapshot
  const ref=scope.currency.snapshot
  if(!ref)fail('INPUT_MATERIAL_PHASE_A_SNAPSHOT_MISSING')
  const snapshot=deps.branch.get(ref.key) as Omit<PreparationSnapshot,'agent'>|undefined
  if(!snapshot||recordSha256(snapshot)!==ref.sha256||snapshot.branchId!==scope.session.id
    ||snapshot.turnId!==scope.turn||recordSha256(snapshot.inputPreparation)!==recordSha256({
      ...scope.currency,snapshot:undefined}))fail('INPUT_MATERIAL_PHASE_A_SNAPSHOT_CHANGED')
  return snapshot
}

type MaterialInvocation={readonly kind:'player';readonly scope:RoleplayInputMaterialScopeV1}
  |{readonly kind:'program-opening';readonly scope:RoleplayOpeningMaterialScopeV1;
    readonly native:NativeOpeningMaterialPrepareInputV1}
interface TavernGenerationMemo {
  readonly attemptId:string
  readonly seed:string
  readonly clockEpochMs:number
  readonly hookCapture:PromptCaptureV1|undefined
  authorBrowser?:{readonly capture:PromptCaptureV1;readonly output:BrowserGenerationOutput}
  nativeConsumption?:TavernNativeInjectionConsumptionV1
  ejs?:{
    readonly selectedSha256:string
    readonly sourceSnapshotSha256:string
    readonly stateSnapshotSha256:string
    readonly ordinaryPublicationSeq:number|null|undefined
    readonly collector:ReturnType<typeof createRoleplayTavernEjsPreparation>
    readonly identity:TavernEjsRuntime['identity']
    readonly owner:{assertCurrent:()=>void}
  }
}
function captureCommunitySource(deps:Dependencies,sessionId:string) {
  return deps.community?deps.inputState.captureSource(sessionId,'community-preset',()=>{
    const policy=deps.community!.presets.policy(sessionId)
    return {policy,configurations:policy.preset
      ?deps.community!.presets.configurations(sessionId,policy.preset.id):[]}
  }):undefined
}
function captureAuthorFields(captured:Exclude<ReturnType<typeof captureRoleplayTavernPromptSourceDataV1>,
  {kind:'outside-declared-domain'}>,
  policy:ReturnType<CommunityMaterialDependencies['presets']['policy']>|undefined,
  accountPersona:Parameters<typeof produceCommunityPresetCardMaterialV1>[0]['persona']) {
  const {residual}=captured,
    cardMaterial=policy?.preset?produceCommunityPresetCardMaterialV1({captured,persona:accountPersona,
      mappingScope:{sessionId:captured.source.sessionId,conversationId:policy.conversationId},
      override:policy.effective.features.nativeCardMapping as unknown as CommunityCardFieldMappingV1|undefined}):undefined,
    mapped=cardMaterial?.kind==='mapped'?cardMaterial:undefined,
    currentCardFields=mapped?{description:mapped.markers.charDescription.map(part=>part.text).join('\n\n'),
      personality:mapped.markers.charPersonality.map(part=>part.text).join('\n\n'),
      scenario:mapped.markers.scenario.map(part=>part.text).join('\n\n'),
      persona:mapped.markers.personaDescription.map(part=>part.text).join('\n\n')}:undefined,
    markerInputs:{pointer:string;text:string;marker:CommunityCardMarkerV1}[]=[]
  if(mapped&&policy?.preset) {
    const preset=policy.preset,byId=new Map(preset.prompts.map(prompt=>[prompt.identifier,prompt])),
      ordered=preset.promptOrder.length?preset.promptOrder.map(row=>byId.get(row.identifier)!):preset.prompts,
      seen=new Set<string>()
    for(const prompt of ordered)if(prompt?.enabled&&!prompt.unused&&!prompt.configurationOnly&&prompt.marker
      &&Object.hasOwn(mapped.markers,prompt.marker)&&!seen.has(prompt.marker)) {
      seen.add(prompt.marker)
      for(const part of mapped.markers[prompt.marker as CommunityCardMarkerV1])markerInputs.push({
        pointer:part.pointer,text:part.text,marker:prompt.marker as CommunityCardMarkerV1})
    }
  }
  const remainingParts=mapped?[...mapped.residualCards,...mapped.residualRules,
    ...residual.parts.filter(part=>part.kind==='examples')]:residual.parts,
    remaining=mapped?authorContributionTextsV1(remainingParts,true):residual,
    exampleEnabled=!policy?.preset||policy.preset.prompts.some(prompt=>prompt.marker==='dialogueExamples'
      &&prompt.enabled&&!prompt.unused&&!prompt.configurationOnly),
    authorInputs=[...markerInputs,{pointer:'/native/current-author/cards',text:remaining.cardsText},
      {pointer:'/native/current-author/rules',text:remaining.rulesText},
      {pointer:'/native/current-author/examples',text:exampleEnabled?remaining.examplesText:''}]
  const extensions=captured.cardData.extensions as Readonly<Record<string,unknown>>|undefined,
    cardRegexes=normalizeCommunityRegexes(extensions?.regex_scripts).map(communityTavernRegexDto)
  return {cardMaterial,mapped,currentCardFields,markerInputs,remainingParts,authorInputs,cardRegexes}
}
/** Main and Reader borrow the same Source/edit/compile read. The surrounding
 * consumer retains its own async lifetime, variable capture and permissions. */
function captureAuthorSource(deps:Dependencies,sessionId:string) {
  const community=captureCommunitySource(deps,sessionId)
  return deps.inputState.captureSource(sessionId,'tavern-author',()=>{
    community?.assertCurrent()
    const includeCardStyle=deps.includeCardStyle(sessionId),personas=deps.personas?.(),
      selectedPersona=personas?.data.profiles.find(row=>row.avatar_id===personas.data.selectedId),
      authorPolicy=cloneRoleplayTavernLoreDataV1(deps.authorPolicy(sessionId),262_144),
      authorPolicySha256=recordSha256(authorPolicy),
      captured=captureRoleplayTavernPromptSourceDataV1(deps,sessionId,includeCardStyle)
    const accountPersona:{key:string;pointer:string;text:string}[]=[]
    if(community?.data.policy.preset) {
      if(personas) {
        if(selectedPersona?.description)accountPersona.push({key:`account-persona:${selectedPersona.avatar_id}`,
          pointer:`/native/account/personas/${encodeURIComponent(selectedPersona.avatar_id)}/description`,
          text:selectedPersona.description})
      }else accountPersona.push(...deps.community?.persona?.()??[])
    }
    if(captured.kind==='outside-declared-domain')return {...captured,accountPersona,personas,
      plainAuthor:produceAuthorContributionDataV1(deps.tables,sessionId,includeCardStyle),
      cardRows:[...deps.tables.cards.entries()].filter(([key])=>key.startsWith(sessionId+'__'))
        .map(([key,value])=>({identity:`cards:${key}`,value}))}
    const sourceCatalog=createTavernSourceRenderCatalogV1({source:captured.source,plan:captured.compilation.plan})
    const authorFields=captureAuthorFields(captured,community?.data.policy,accountPersona)
    return {kind:'author-data' as const,includeCardStyle,authorPolicy,authorPolicySha256,captured,
      accountPersona,personas,sourceCatalog,authorFields}
  })
}
export function createRoleplayTavernPromptMaterialV1(deps:Dependencies):RoleplayInputMaterialDependenciesV1&{
  captureAuthorSource(sessionId:string):ReturnType<typeof captureAuthorSource>
  prepareOpening(native:NativeOpeningMaterialPrepareInputV1,scope:RoleplayOpeningMaterialScopeV1)
    :ReturnType<RoleplayInputMaterialDependenciesV1['prepare']>
} {
  // Replanning a window is still the same actual generation. Source callbacks
  // and once listeners run once; only their immutable output enters each plan.
  const generations=new WeakMap<object,TavernGenerationMemo>()
  const openingGenerations=new WeakMap<RoleplayOpeningMaterialScopeV1['owner'],Map<number,TavernGenerationMemo>>()
  const prepareHistoryText=async(native:NativeRequestMaterialPrepareInputV1,scope:RoleplayInputMaterialScopeV1)
    :Promise<RoleplayInputMaterialBuildResultV1>=>{
    const read=deps.inputState.captureInput({session:scope.session,signal:scope.signal,
      assertOwnerFactsCurrent:scope.assertOwnerFactsCurrent,outputRows:scope.outputRows},
    ()=>{
      const storyText=deps.captureStoryText?.(scope.session.id)
      if(!storyText?.hasValues)return {storyText}
      const history=captureRoleplayTavernMaterialHistoryV1({sessionId:scope.session.id,table:deps.branch,inputState:deps.inputState,
        session:scope.session,events:()=>scope.session.snapshotEvents(),projections:deps.projections,
        assertOwnerCurrent:scope.assertOwnerFactsCurrent}),sequence=history.publicationSequence,
        previous=sequence?.at(sequence.length-1)??history.publications.at(-1)
      // The exact prior material in this input owns the author contribution.
      // A further history-only step forwards that same real reference in O(1).
      const currency=previous?.snapshot.encoding==='core-input-material-record-v1'?previous.snapshot.currency:undefined,
        sameInput=previous?.snapshot.sessionId===scope.session.id&&previous.snapshot.turn===scope.turn
          &&currency?.preparationId===scope.currency.preparationId
          &&currency?.credentialSha256===scope.currency.credentialSha256
          &&currency?.receiptGeneration===scope.currency.receiptGeneration,
        authorMaterial=sameInput?(isTavernHistoryTextOnlyMaterialV1(previous!)
          ?previous!.snapshot.payload.authorMaterial:tavernMaterialPublicationRefV1(previous!)):undefined
      return {storyText,history,authorMaterial}
    }),{storyText}=read.data
    try {
      const messageTextProjections:NativeMaterialMessageTextProjectionV2[]=storyText?.hasValues
        ?native.selected.messages.flatMap(row=>{
          if(row.role!=='assistant'||row.eventSeq===null)return []
          const blocks=storyText.blocks(row.eventSeq,row.message,row.messageSha256)
          if(!blocks)return []
          const textEdits=row.message.content.flatMap((block,blockIndex)=>{
            if(block.type!=='text')return []
            const replacementText=blocks.get(blockIndex)!
            return replacementText===block.text?[]:[{blockIndex,replacementText}]
          })
          return textEdits.length?[{target:{id:row.id,role:'assistant' as const,messageSha256:row.messageSha256},
            textEdits,projectionSha256:nativeInputSha256(projectNativeMessageTextV2(row.message,textEdits))}]:[]
        }):[]
      if(!messageTextProjections.length) {
        read.release()
        return {kind:'outside-declared-domain',reason:'NO_SETTLED_STORY_TEXT_PROJECTION'}
      }
      // Maintenance and its return-to-Story step must see the same accepted
      // history. They do not rerun author programs or publish prompt effects.
      // Native owns these per-request text edits, budgeting and cold replay.
      return {kind:'prepared-data',requiredSections:[],sections:[],insertions:[],messageTextProjections,
        snapshot:{schemaVersion:1,encoding:'native-settled-story-text-capture-v1',authority:'consumer-data-only',
          initialNativeSelected:native.selectedCaptureV2??native.selected,
          ...read.data.authorMaterial?{authorMaterial:read.data.authorMaterial}:{}},
        plan:{schemaVersion:1,encoding:'native-settled-story-text-plan-v1',
          policy:'accepted-canonical-story-text-only-v1'},
        assertCurrent(){read.assertCurrent();read.data.history?.assertCurrent()
          if(!storyText!.current())fail('INPUT_MATERIAL_STORY_TEXT_CHANGED')},
        assertSelected(selected,firstAttempt){
          if(selected===native.selected) {
            if(!firstAttempt)fail('INPUT_MATERIAL_INITIAL_SELECTION_CHANGED')
          }else assertNativeRequestMaterialSelectionV1(native.selected,selected)
        },release:()=>read.release()}
    }catch(error){read.release();throw error}
  }
  const prepare=async(native:ActualNativePreparation,invocation:MaterialInvocation)
    :Promise<RoleplayInputMaterialBuildResultV1>=>{
    const scope=invocation.scope,openingOwner=invocation.kind==='program-opening'?invocation.native.owner:undefined,
      openingInputId=openingOwner?.identity.operationId,
      openingOrdinaryAttemptId=openingOwner?`${openingOwner.identity.operationId}:${openingOwner.invocationRef.seq}`:undefined
    let communityCapture=captureCommunitySource(deps,scope.session.id)
    const communityPolicy=communityCapture?.data.policy
    await deps.settlement.reconcile(scope.session)
    if(deps.community) {
      // Configuration can publish ordinary chat. Finish it before capturing
      // Main's root, and keep preset-lock → Source-FIFO ordering.
      if(communityPolicy?.preset)await deps.community.variables.configure(communityPolicy.preset.id,
        scope.session.id,communityCapture!.data.configurations)
      communityCapture!.assertCurrent()
    }
    const assertOwnerFactsCurrent=scope.assertOwnerFactsCurrent.bind(scope)
    const captureInput=()=>deps.withSourceLock(scope.session.id,async()=>{
      // Synchronous capture records the real read footprint once. Inner DATA
      // suppliers need cancellation, not another read of the input owner's
      // Work/current outputs, which Native legitimately updates after capture.
      const assertSignal=()=>scope.signal.throwIfAborted()
      return deps.inputState.captureInput({session:scope.session,signal:scope.signal,
        assertOwnerFactsCurrent,outputRows:[...scope.outputRows??[],...deps.pendingOutputRows(scope.session.id)]},()=>{
        communityCapture?.assertCurrent()
        const author=captureAuthorSource(deps,scope.session.id).data
        if(author.kind==='outside-declared-domain') {
          const player=invocation.kind==='player'?invocation.scope:undefined,
            snapshot=player?phaseASnapshot(deps,player):undefined,
            inputId=openingInputId??snapshot?.userMessageId??player!.currency.preparationId,
            namespace={schemaVersion:3 as const,sessionId:scope.session.id,importIncarnation:null},
            contributionId=authorChatContributionIdV3(namespace,inputId),
            ordinaryBasis=deps.ejs.state.captureNamespaceWithoutContribution(namespace,contributionId),
            attemptId=openingOrdinaryAttemptId??`${player!.currency.preparationId}:${player!.currency.attemptGeneration}`,
            ordinaryPrior=deps.settlement.capturePrior(scope.session,{turn:scope.turn,step:scope.step,inputId,
              contributionId,attemptId,namespace})
          return {...author,inputId,contributionId,ordinaryBasis,ordinaryPrior}
        }
        const opening=invocation.kind==='program-opening'
          ?deps.openingPreparation?.(invocation.native,invocation.scope,{
            sourceCurrentIdentitySha256:author.captured.currentIdentitySha256,includeCardStyle:author.includeCardStyle,
            editorRevision:author.captured.edits.revision,editorHeadSha256:author.captured.edits.headRef?.sha256??null,
            currentNativeOverlaySha256:author.captured.compilation.plan.currentNativeOverlaySha256??null}):undefined
        if(invocation.kind==='program-opening'&&!opening)fail('OPENING_MATERIAL_ACTUAL_PREPARATION_REQUIRED')
        const player=invocation.kind==='player'?invocation.scope:undefined,
          playerSnapshot=player?phaseASnapshot(deps,player):undefined,snapshot=playerSnapshot??opening!.snapshot,
          {source,compilation}=author.captured,storyRows=deps.storyRows(scope,native.selected),
          storyIds=new Set(storyRows.map(row=>row.id))
        if(storyIds.size!==storyRows.length)fail('INPUT_MATERIAL_STORY_SELECTION_DUPLICATE')
        const inputId=openingInputId??playerSnapshot?.userMessageId??player!.currency.preparationId,
          namespace=promptProgramSourceOrdinaryNamespaceV3(author.captured.source,author.captured.record),
          contributionId=authorChatContributionIdV3(namespace,inputId),
          ordinaryBasis=deps.ejs.state.captureNamespaceWithoutContribution(namespace,contributionId),
          attemptId=openingOrdinaryAttemptId??`${player!.currency.preparationId}:${player!.currency.attemptGeneration}`,
          ordinaryPrior=deps.settlement.capturePrior(scope.session,{turn:scope.turn,step:scope.step,inputId,
            contributionId,attemptId,namespace,
            messageBindingOrigin:scope.session.header?.isSeeded===false&&scope.session.header.parentSession===undefined
              &&!source.inheritance&&namespace.sessionId===scope.session.id?'complete-current-input':'unknown'}),
          ordinary={schemaVersion:3 as const,authority:'consumer-data-only' as const,
            root:ordinaryBasis.root,exists:ordinaryBasis.exists,values:ordinaryBasis.values,
            ...ordinaryBasis.deletedKeys?{deletedKeys:ordinaryBasis.deletedKeys}:{}}
        // Phase A already chose the actual numerical domain. Reading every
        // alternative would repeat complete opening and inheritance audits.
        let domain:Pick<Parameters<typeof captureRoleplayTavernPromptScopesV1>[0],'opening'|'schema'|'plain'|'numerical'>
        if(opening)domain={opening:opening.scopes}
        else if(playerSnapshot?.numericalState?.schemaVersion===2)domain={schema:deps.schemaScopes(scope.session.id,
          {messages:storyRows,sha256:native.selected.sha256,purpose:'prompt-variable-selection-v3',ordinaryChat:ordinary})}
        else if(playerSnapshot?.numericalState)domain={numerical:deps.numericalScopes(scope.session.id)}
        else domain={plain:deps.plainScopes(scope.session.id,author.captured.currentIdentitySha256)}
        const scopeData=captureRoleplayTavernPromptScopesV1({source,
          currentIdentitySha256:author.captured.currentIdentitySha256,selected:native.selected,
          ...domain,ordinaryChat:ordinary,
          isStoryMessage:row=>storyIds.has(row.id),assertOwnerCurrent:assertSignal})
        const authorBrowserFacts=domain.schema?.authorBrowserV3
        const materialHistory=captureRoleplayTavernMaterialHistoryV1({sessionId:scope.session.id,table:deps.branch,
          inputState:deps.inputState,session:scope.session,
          events:()=>scope.session.snapshotEvents(),projections:deps.projections,assertOwnerCurrent:assertSignal})
        const storyText=deps.captureStoryText?.(scope.session.id)
        const chatClock=captureTavernCanonicalChatClockV2({session:scope.session,selected:native.selected,inputState:deps.inputState,storyText,
          projections:deps.projections(),assertOwnerCurrent:assertSignal}),inheritedTiming=deps.inheritedTiming(scope,source,assertSignal,
            author.captured.sourceLineage),
          timed=captureRoleplayTavernTimedHistoryV2({sessionId:scope.session.id,source,compilation,ownHistory:materialHistory,
            inputState:deps.inputState,table:deps.branch,
            inheritedHistory:inheritedTiming?.inheritedHistory,sourceLineage:inheritedTiming?.sourceLineage,
            clock:chatClock,projections:deps.projections(),assertOwnerCurrent:assertSignal,
            assertSourceLineageCurrent:()=>inheritedTiming?.assertCurrent()})
        const {kind:_authorKind,...authorData}=author
        const derived=deps.derivedSnapshot?.(scope.session.id)
        const ordinaryPublicationSeq=deps.ordinaryPublicationSeq?.(scope.session)
        let messageCapture:{view:AuthorMessageViewV1|undefined}|undefined
        const captureMessageView=()=>{
          messageCapture??={view:domain.schema?.ordinaryMessageView?.()??(!domain.schema
            ?deps.capturePlainMessageView?.({session:scope.session,namespace,chatClock,
              plain:domain.plain,current:()=>domain.plain?.current()!==false}):undefined)}
          return messageCapture.view
        }
        // Unknown origins and old message contributions retain their complete
        // withdrawal/recovery basis. Only an owner's complete negative fact
        // can defer the view until an actual EJS consumer needs it.
        if(ordinaryPrior.messageBinding!=='none'||ordinaryPublicationSeq===undefined)captureMessageView()
        return {kind:'input-data' as const,...authorData,opening,player,playerSnapshot,snapshot,storyRows,derived,
          scopeData,materialHistory,chatClock,timed,authorBrowserFacts,ordinary,storyText,
          ordinaryBasis,ordinaryPrior,inputId,contributionId,ordinaryPublicationSeq,captureMessageView,
          get messageCapture(){return messageCapture}}
      })
    },scope.signal)
    let inputCapture=await captureInput()
      if(inputCapture.data.kind==='outside-declared-domain') {
        const outside=inputCapture.data
        if(['ACTIVE_SOURCE_MISSING','LEGACY_SOURCE_OUTSIDE_DOMAIN'].includes(outside.reason)) {
          if(!deps.community){inputCapture.release();return outside}
          const policy=communityPolicy!
          if(!policy.preset&&!policy.regexes.some(library=>library.rules.some(rule=>!rule.disabled))){inputCapture.release();return outside}
          try {
          const partition=policy.preset?produceCommunityNativeCardMaterialV1({parts:outside.plainAuthor.parts,
            cardRows:outside.cardRows,persona:outside.accountPersona,
            mappingScope:{sessionId:scope.session.id,conversationId:policy.conversationId},
            override:policy.effective.features.nativeCardMapping as unknown as CommunityCardFieldMappingV1|undefined}):undefined
          if(partition?.kind==='mapping-required')fail('COMMUNITY_CARD_MAPPING_REQUIRED')
          const mapped=partition?.kind==='mapped'?partition:undefined,
            currentFields:Record<string,string>=mapped?{description:mapped.markers.charDescription.map(part=>part.text).join('\n\n'),
              personality:mapped.markers.charPersonality.map(part=>part.text).join('\n\n'),
              scenario:mapped.markers.scenario.map(part=>part.text).join('\n\n'),persona:mapped.markers.personaDescription.map(part=>part.text).join('\n\n')}:{}
          const player=invocation.kind==='player'?invocation.scope:undefined,
            snapshot=player?phaseASnapshot(deps,player):undefined,
            generationKey=player?(player.generationOwner??player.stepToken):undefined,previous=generationKey?generations.get(generationKey):undefined,
            attemptId=previous?.attemptId??(player?`${player.currency.preparationId}:${player.currency.attemptGeneration}`:
              `${scope.session.id}:opening:${scope.turn}:${scope.step}`),
            seed=previous?.seed??recordSha256({attemptId,selected:native.selected.sha256}),
            storyRows=deps.storyRows(scope,native.selected),clockEpochMs=previous?.clockEpochMs??Date.now(),
            aliases=deps.community.aliases(scope.session.id),
            ordinaryStage=createRoleplayTavernOrdinaryStage({inputId:outside.inputId,
              contributionId:outside.contributionId,attemptId:openingOrdinaryAttemptId??attemptId,
              replacesAttemptId:outside.ordinaryBasis.priorAttemptId,
              previousHadWrites:outside.ordinaryBasis.priorHasWrites,
              initialRoot:outside.ordinaryBasis.root,values:outside.ordinaryBasis.values,
              deletedKeys:outside.ordinaryBasis.deletedKeys,
              priorWrites:outside.ordinaryPrior.writes})
          // The same plain-community generation can be repriced after its
          // checkpoint. Rebuild selected-history groups with this new cut,
          // while its random stream and clock retain their original basis.
          if(generationKey&&!previous)generations.set(generationKey,{attemptId,seed,clockEpochMs,hookCapture:undefined})
          const material=await prepareCommunityPresetMaterial(deps.community,{session:scope.session,policy,selected:native.selected,
            historyRows:storyRows,seed,clockEpochMs,inputText:snapshot?.userText??'',aliases:{...aliases,
              ...currentFields,turn:String(scope.turn),turnPlus1:String(scope.turn+1),chatMessageCount:String(storyRows.length)},
            cardData:{},inputId:outside.inputId,attemptId,ordinary:ordinaryStage,scopedRules:[]},scope.signal)
          const remaining=mapped?authorContributionTextsV1([...mapped.residualCards,...mapped.residualRules,
            ...outside.plainAuthor.parts.filter(part=>part.kind==='examples')],true):outside.plainAuthor
          const renderPlain=(text:string)=>{
            if(!policy.preset)return text
            if(text.includes('<%'))fail('COMMUNITY_NATIVE_TEMPLATE_REQUIRES_SOURCE')
            return material.renderPlainAuthor(text)
          }
          const renderedMarkers:Partial<Record<CommunityCardMarkerV1,string>>={}
          if(mapped&&policy.preset){
            const byId=new Map(policy.preset.prompts.map(prompt=>[prompt.identifier,prompt])),seen=new Set<string>()
            const ordered=policy.preset.promptOrder.length?policy.preset.promptOrder.map(row=>byId.get(row.identifier)!):policy.preset.prompts
            for(const prompt of ordered)if(prompt?.enabled&&!prompt.unused&&!prompt.configurationOnly&&prompt.marker
              &&Object.hasOwn(mapped.markers,prompt.marker)&&!seen.has(prompt.marker)){
              seen.add(prompt.marker);renderedMarkers[prompt.marker as CommunityCardMarkerV1]=
                mapped.markers[prompt.marker as CommunityCardMarkerV1].map(part=>renderPlain(part.text)).join('\n\n')
            }
          }
          const renderedAuthor={cardsText:renderPlain(remaining.cardsText),rulesText:renderPlain(remaining.rulesText),
            examplesText:policy.preset&&!policy.preset.prompts.some(prompt=>prompt.marker==='dialogueExamples'&&prompt.enabled&&!prompt.unused)
              ?'':renderPlain(remaining.examplesText)}
          const fence=createStableRoleplayFence()
          const replacement:Record<string,string>=policy.preset?{
            'roleplay:cards':renderedAuthor.cardsText.trim()?fence(renderedAuthor.cardsText,'card'):'',
            'roleplay:rules':renderedAuthor.rulesText?fence(renderedAuthor.rulesText,'rules'):'',
            'roleplay:examples':renderedAuthor.examplesText?fence(renderedAuthor.examplesText,'examples'):''}:{}
          const names=new Set(TAVERN_NATIVE_OWNED_SECTION_NAMES_V1),sections=native.finalAssembly.sections.filter(section=>names.has(section.name)),
            base={requiredSections:sections.map(section=>({name:section.name,sha256:nativeInputSha256(section)})),
              sections:sections.map(section=>({name:section.name,expectedSectionSha256:nativeInputSha256(section),
                replacementText:replacement[section.name]??section.text,interpolate:false as const})),insertions:[],anchoredInsertions:[],layout:{outlets:[]}},
            transformed=communityMaterialV2(native.selected,
              material.finish({native,layout:base,finalLore:[],evaluation:{placements:[]},renderedMarkers,renderedAuthor}))
          const versions=storyRows.map(row=>({id:row.id,messageSha256:row.messageSha256}))
          return {kind:'prepared-data' as const,...transformed,
            snapshot:freeze({schemaVersion:native.selectedCaptureV2?2:1,
              encoding:native.selectedCaptureV2?'community-preset-plain-capture-v2':'community-preset-plain-capture-v1',
              initialNativeSelected:native.selectedCaptureV2??native.selected,
              seed,clockEpochMs,sourceDomain:outside.reason,...mapped?{communityCardMaterial:mapped}:{}}),
            plan:freeze({schemaVersion:1,encoding:'community-preset-plain-plan-v1',ordinaryChat:ordinaryStage.plan(),
              ...transformed.record?{community:transformed.record}:{}}),
            assertCurrent(){inputCapture.assertCurrent();if(!outside.ordinaryPrior.current())fail('ORDINARY_PRIOR_SOURCE_CHANGED')},
            release:inputCapture.release,assertSelected(selected:NativeMaterialSelectedBaseV1,firstAttempt:boolean) {
              if(selected===native.selected){if(!firstAttempt)fail('INPUT_MATERIAL_INITIAL_SELECTION_CHANGED')}
              else assertNativeRequestMaterialSelectionV1(native.selected,selected)
              const actual=selected.messages.filter(row=>versions.some(version=>version.id===row.id))
                .map(row=>({id:row.id,messageSha256:row.messageSha256}))
              if(recordSha256(actual)!==recordSha256(versions))fail('INPUT_MATERIAL_STORY_SELECTION_CHANGED')
            }}
          }catch(error){inputCapture.release();throw error}
        }
        inputCapture.release()
        fail(`INPUT_MATERIAL_${outside.reason}`)
      }
      const generationKey=invocation.kind==='player'?(invocation.scope.generationOwner??invocation.scope.stepToken):undefined,
        openingKey=invocation.kind==='program-opening'?invocation.scope.owner:undefined
      let previous=generationKey?generations.get(generationKey):openingKey?openingGenerations.get(openingKey)?.get(scope.step):undefined
      const initial=inputCapture.data
      if(previous?.authorBrowser&&!initial.authorBrowserFacts) {
        initial.derived?.release();inputCapture.release()
        fail('INPUT_MATERIAL_AUTHOR_BROWSER_SOURCE_CHANGED')
      }
      if(initial.authorBrowserFacts&&!previous?.authorBrowser) {
        let released=false
        const releaseInitial=()=>{
          if(released)return
          released=true;initial.derived?.release();inputCapture.release()
        }
        try {
          inputCapture.assertCurrent();initial.derived?.assertCurrent()
          if(!initial.ordinaryPrior.current())fail('ORDINARY_PRIOR_SOURCE_CHANGED')
          const attemptId=previous?.attemptId??initial.opening?.attempt.attemptId
            ??`${initial.player!.currency.preparationId}:${initial.player!.currency.attemptGeneration}`,
            seed=previous?.seed??(initial.opening?recordSha256(initial.opening.attempt.seed):recordSha256({
              schemaVersion:1,encoding:'native-tavern-attempt-seed-v1',currency:initial.player!.currency,
              sourceSha256:initial.captured.source.sourceSha256,selectedSha256:native.selected.sha256})),
            clockEpochMs=previous?.clockEpochMs??Date.now(),
            hookStage=createRoleplayTavernOrdinaryStage({inputId:initial.inputId,contributionId:initial.contributionId,
              attemptId:openingOrdinaryAttemptId??attemptId,replacesAttemptId:initial.ordinaryBasis.priorAttemptId,
              previousHadWrites:initial.ordinaryBasis.priorHasWrites,
              initialRoot:initial.ordinary.root,values:initial.ordinary.values,deletedKeys:initial.ordinary.deletedKeys,
              priorWrites:initial.ordinaryPrior.writes}),
            hookCapture=previous?.hookCapture??produceAuthorPromptCaptureV1({
              history:'fullHistory' in initial.chatClock?initial.chatClock.fullHistory():initial.chatClock,
              scopes:initial.authorBrowserFacts.scopes,opening:initial.authorBrowserFacts.opening,
              attemptId,clockEpochMs,randomSeed:seed,
              ordinaryMessages:initial.authorBrowserFacts.ordinaryMessages,
              ordinaryChat:{schemaVersion:initial.ordinary.schemaVersion,authority:initial.ordinary.authority,
                root:initial.ordinary.root,exists:initial.ordinary.exists,values:hookStage.values,
                ...hookStage.deletedKeys?{deletedKeys:hookStage.deletedKeys}:{}}}),
            generation:TavernGenerationMemo=previous??{attemptId,seed,clockEpochMs,hookCapture}
          if(generationKey&&!previous)generations.set(generationKey,generation)
          if(openingKey&&!previous) {
            let steps=openingGenerations.get(openingKey)
            if(!steps){steps=new Map();openingGenerations.set(openingKey,steps)}
            steps.set(scope.step,generation)
          }
          previous=generation
          if(!deps.executeAuthorBrowser)fail('INPUT_MATERIAL_AUTHOR_BROWSER_UNAVAILABLE')
          const output=await deps.executeAuthorBrowser(scope.session.id,initial.authorBrowserFacts.program,
            hookCapture,initial.authorBrowserFacts,scope.signal,invocation.kind==='player'?invocation.scope.sourceData:undefined)
          // The callback may have durably changed the ordinary namespace and
          // invalidated this material read. Retain its actual result before
          // checking the unchanged preparation/Stop/Session owner.
          generation.authorBrowser={capture:hookCapture,output}
          scope.signal.throwIfAborted();assertOwnerFactsCurrent()
          const currentCommunity=captureCommunitySource(deps,scope.session.id)
          // Account DATA publication can retire this borrowed Source read.
          // The preset owner retains its policy object until its actual table
          // changes; reuse that fact, without configuring a new policy here.
          if(currentCommunity?.data.policy!==communityPolicy)fail('INPUT_MATERIAL_COMMUNITY_SOURCE_CHANGED')
          communityCapture=currentCommunity
          if(invocation.kind==='player'&&await invocation.scope.sourceData?.accept()) {
            releaseInitial()
            return {kind:'source-data-successor' as const}
          }
          releaseInitial()
          // One fresh Source-locked capture supplies the final stage, macros,
          // community effects and EJS. None of the pre-hook stage is reused.
          inputCapture=await captureInput()
        }catch(error){releaseInitial();throw error}
        if(inputCapture.data.kind!=='input-data'||!inputCapture.data.authorBrowserFacts) {
          if(inputCapture.data.kind==='input-data')inputCapture.data.derived?.release()
          inputCapture.release();fail('INPUT_MATERIAL_AUTHOR_BROWSER_SOURCE_CHANGED')
        }
      }
      let nativeFilterReplan:typeof TAVERN_NATIVE_FILTER_RECAPTURE|typeof TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR|undefined
      const inputData=inputCapture.data
      const {captured,opening,player,playerSnapshot,snapshot,storyRows,
        scopeData,materialHistory,chatClock,timed,authorBrowserFacts,storyText,
        includeCardStyle,authorPolicy,authorPolicySha256,accountPersona,personas,sourceCatalog,authorFields,derived,ordinary,
        ordinaryBasis,ordinaryPrior,inputId,contributionId,ordinaryPublicationSeq}=inputData,
        {source,compilation,original,residual}=captured,
        assertInputCurrent=()=>{
          // The lore evaluator returns DATA refusals for callback errors. Keep
          // this owner's actual replan signal across that result boundary,
          // before checking the read its completed callback just invalidated.
          if(nativeFilterReplan)throw nativeFilterReplan
          inputCapture.assertCurrent();derived?.assertCurrent()
          if(inputData.messageCapture?.view&&!inputData.messageCapture.view.current())fail('INPUT_MATERIAL_MESSAGE_VIEW_CHANGED')
          if(storyText&&!storyText.current())fail('INPUT_MATERIAL_STORY_TEXT_CHANGED')
          if(!ordinaryPrior.current())fail('ORDINARY_PRIOR_SOURCE_CHANGED')}
      const assertCurrent=assertInputCurrent
      try {
      assertCurrent()
      const attemptId=previous?.attemptId??opening?.attempt.attemptId??`${player!.currency.preparationId}:${player!.currency.attemptGeneration}`,
        turnId=String(scope.turn),seed=previous?.seed??(opening?recordSha256(opening.attempt.seed):
          recordSha256({schemaVersion:1,encoding:'native-tavern-attempt-seed-v1',
            currency:player!.currency,sourceSha256:source.sourceSha256,selectedSha256:native.selected.sha256})),
        clockEpochMs=previous?.clockEpochMs??Date.now(),packageSha256=source.original.documentSha256,
        ordinaryStage=createRoleplayTavernOrdinaryStage({inputId,contributionId,attemptId:openingOrdinaryAttemptId??attemptId,
          replacesAttemptId:ordinaryBasis.priorAttemptId,initialRoot:ordinary.root,values:ordinary.values,
          previousHadWrites:ordinaryBasis.priorHasWrites,
          deletedKeys:ordinary.deletedKeys,
          priorWrites:ordinaryPrior.writes}),
        policy=TAVERN_NATIVE_PROMPT_POLICY_V4
      let messagesInitialized=false,messageRows:NonNullable<TavernEjsHostCapture['ordinaryMessageView']>['messages']|undefined
      let currentMessage:NonNullable<TavernEjsHostCapture['ordinaryMessageView']>['current']
      const initializeMessages=()=>{
        if(messagesInitialized)return
        const view=inputData.captureMessageView()
        if(view) {
          ordinaryStage.bindMessages({captures:view.ordinaryMessages,state:deps.ejs.state,
            priorGroups:ordinaryPrior.messageGroups})
          const rows=[...view.messages]
          // Keep the invocation's actual last row current through every
          // final slot. Pending rows have metadata, no writable namespace.
          for(const row of chatClock.data.pendingRows) {
            if(rows.some(message=>message.messageId===row.id))continue
            rows.push({index:rows.length,messageId:row.id,ownerSessionId:scope.session.id,nativeSeq:null,
              messageVersionSha256:row.messageSha256,role:row.role,
              variables:{kind:'unavailable',code:'MESSAGE_STATE_UNAVAILABLE'}})
          }
          messageRows=rows
          const last=rows.at(-1)
          currentMessage=last?{message_id:last.index,
            swipe_id:last.ordinary?.selectedTarget.identity.variant.kind==='opening-variant'
              ?last.ordinary.variants.findIndex(target=>target===last.ordinary!.selectedTarget):0}:null
        }
        messagesInitialized=true
      }
      if(inputData.messageCapture)initializeMessages()
      const declaredOutlets=compilation.plan.entries.flatMap(entry=>{
        const semantic={...ST_LORE_ENTRY_DEFAULTS_V1,...entry.semanticOverrides}
        return semantic.position==='named-outlet'&&semantic.outletName?[semantic.outletName]:[]
      })
      const model=deps.community?.modelName(scope.session.id),preparedRoute=model?{model,configSha256:recordSha256({model})}:undefined
      const {cardMaterial,mapped,currentCardFields,markerInputs,remainingParts,authorInputs}=authorFields
      if(cardMaterial?.kind==='mapping-required')fail('COMMUNITY_CARD_MAPPING_REQUIRED')
      const baseMacros=produceRoleplayTavernMacroSnapshotV1({source,cardData:captured.cardData,includeCardStyle,clockEpochMs,randomSeed:seed,
        inputText:playerSnapshot?playerSnapshot.userText:null,scopes:scopeData.bindings,outlets:[],declaredOutlets,
        presetVariables:communityPolicy?.helperVariables,
        ...preparedRoute?{preparedRoute}:{},currentCardFields}).snapshot
      const aliases=Object.fromEntries([...Object.values(baseMacros.names),...baseMacros.card??[],...baseMacros.dynamic??[]]
        .filter(binding=>binding.value!==null).map(binding=>[binding.key,binding.value!]))
      const canonicalAssistantIds='selectedCanonicalAssistantIds' in chatClock?chatClock.selectedCanonicalAssistantIds
        :new Set(chatClock.data.rows.filter(row=>row.role==='assistant').map(row=>row.id))
      const projectHistoryText=(messageId:string,text:string)=>{
        if(!canonicalAssistantIds.has(messageId))return text
        // Old prose can retain the identity template. Expand it only in the
        // model's text projection; protocol DATA and saved messages stay exact.
        return text.replace(/<UpdateVariable>[\s\S]*?<\/UpdateVariable>|\{\{user\}\}/g,
          token=>token==='{{user}}'?baseMacros.names.user.value!:token)
      }
      const community=deps.community?await prepareCommunityPresetMaterial(deps.community,{session:scope.session,policy:communityPolicy,
        storyText,
        deferredMacroFamilies:['ejs-named-queue-outlet'],
        selected:native.selected,historyRows:storyRows,seed,clockEpochMs,inputText:playerSnapshot?.userText??'',
        ...invocation.kind==='player'?{projectHistoryText}:{},
        aliases:{...aliases,turn:String(scope.turn),turnPlus1:String(scope.turn+1),chatMessageCount:String(chatClock.data.chatIndex)},
        cardData:captured.cardData,inputId,ordinary:ordinaryStage,
        attemptId,scopedRules:captureRoleplayTavernScopedRegexV1(captured.cardData,source.sourceSha256,true),
        loreEntries:neededIds=>compilation.plan.entries.filter(entry=>neededIds.has(entry.entryId)).map(entry=>{
          const collection=compilation.plan.rawBook?.entries,
            raw=(Array.isArray(collection)?collection[entry.ordinal]:collection&&typeof collection==='object'?collection[entry.sourceKey]:null),
            metadata=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}
          return {entryId:entry.entryId,name:String(metadata.comment??metadata.name??''),
            constant:entry.semanticOverrides.constant===true,dynamic:JSON.stringify(raw).includes('<%')}
        })},scope.signal):undefined
      const initialBindings=community?.scopes(scopeData.bindings)??scopeData.bindings
      const macrosFor=(scopes:readonly TavernTemplateScopeBindingV1[],outlets:readonly {name:string;text:string;versionSha256:string}[]=[])=>
        Object.freeze({...produceRoleplayTavernMacroSnapshotV1({source,cardData:captured.cardData,includeCardStyle,clockEpochMs,randomSeed:seed,
          inputText:playerSnapshot?playerSnapshot.userText:null,scopes:community?.scopes(scopes)??scopes,outlets,declaredOutlets,
          presetVariables:communityPolicy?.helperVariables,
          avatarPaths:{user:personas?.selectedAvatarDataUrl??null,character:captured.avatarPath},
          messageVariables:scopeData.messageVariables,...preparedRoute?{preparedRoute}:{},currentCardFields}).snapshot,
          deferredMacroFamilies:['ejs-named-queue-outlet'] as const})
      const macros=macrosFor(initialBindings),rules=community?.rules??captureRoleplayTavernScopedRegexV1(captured.cardData,source.sourceSha256,true)
      const generation:TavernGenerationMemo=previous??{attemptId,seed,clockEpochMs,hookCapture:undefined}
      if(generationKey&&!previous)generations.set(generationKey,generation)
      if(openingKey&&!previous) {
        let steps=openingGenerations.get(openingKey)
        if(!steps){steps=new Map();openingGenerations.set(openingKey,steps)}
        steps.set(scope.step,generation)
      }
      previous=generation
      generation.nativeConsumption??=createTavernNativeInjectionConsumptionV1()
      const authorBrowser=generation.authorBrowser
      const note=snapshot.contextMessageRefs?.refs.find(row=>row.form==='director-notes'),
        noteIndex=note?native.selected.messages.findIndex(row=>row.id===note.id&&row.messageSha256===note.messageSha256):-1
      const definitions=captureRoleplayTavernInjectionDefinitionsV1(source,compilation.plan,residual,
        authorBrowserFacts?.program,authorInputs,sourceCatalog)
      if(generation.ejs&&(generation.ejs.selectedSha256!==native.selected.sha256
        ||generation.ejs.sourceSnapshotSha256!==source.sourceSha256
        ||generation.ejs.stateSnapshotSha256!==scopeData.stateSnapshotSha256
        ||generation.ejs.ordinaryPublicationSeq!==ordinaryPublicationSeq)) {
        // A real window checkpoint changes EJS inputs. Discard the unpublished
        // pass, including its live realms, before rebuilding the new cut.
        // The committed Native callback stays in the generation memo above.
        generation.ejs.collector.retire()
        generation.ejs=undefined
      }
      if(!generation.ejs) {
        const runtime=await deps.ejs.load(scope.signal)
        assertCurrent()
        const live={assertCurrent:assertInputCurrent}
        let context:Readonly<Record<string,unknown>>|undefined
        const collector=createRoleplayTavernEjsPreparation({
          identity:{preparationId:attemptId,attemptGeneration:`${attemptId}:${scope.step}`,
            scriptIdentity:recordSha256(definitions.definitions),sourceSnapshotSha256:source.sourceSha256},
          programs:deps.ejs.programs,
          get context(){
            if(!context) {
              const history='fullHistory' in chatClock?chatClock.fullHistory():chatClock,
                names=source.current.openingContext.context
              context={user:names.user,char:names.char,messages:history.scanRows.map(row=>({
                messageId:row.id,role:row.role,content:row.text,mes:row.text,is_user:row.role==='user',
                name:row.role==='user'?names.user:names.char}))}
            }
            return context
          },
          resources:snapshot=>snapshot.lore.map(row=>({id:row.key,sourcePointer:row.sourcePointer,
            sourceSnapshotSha256:row.sourceSnapshotSha256,contentSha256:row.contentSha256,text:row.content,loreKey:row.key})),
          assertCurrent:()=>live.assertCurrent(),signal:scope.signal})
        generation.ejs={selectedSha256:native.selected.sha256,sourceSnapshotSha256:source.sourceSha256,
          stateSnapshotSha256:scopeData.stateSnapshotSha256,ordinaryPublicationSeq,collector,identity:runtime.identity,owner:live}
      }
      if(generation.ejs) {
        generation.ejs.owner.assertCurrent=assertInputCurrent
      }
      let invocationMacros:import('./tavern-prompt-transform-types.mjs').TavernPromptMacroSnapshotV1=macros
      let injections:ReturnType<typeof createRoleplayTavernInjectionRegistryV1>
      const captureNativeCut=deps.inputState.nativeHistory?.cut
      const ejs=generation.ejs.collector.beginPlan(ordinaryStage,{
        presetCatalog:()=>deps.community?.presets.ejsPreset(scope.session.id,communityPolicy),
        namedQueues:()=>injections.namedQueues(),
        ordinaryMessageView:async()=>{
          if(!messagesInitialized)await deps.withSourceLock(scope.session.id,async()=>inputCapture.readCurrent(()=>{
            assertInputCurrent()
            // An unread namespace is outside the current footprint. Retain
            // the publication boundary captured before releasing Source FIFO
            // so a late first consumer cannot adopt a newer ordinary state.
            if(deps.ordinaryPublicationSeq?.(scope.session)!==ordinaryPublicationSeq)
              fail('INPUT_MATERIAL_MESSAGE_VIEW_CHANGED')
            initializeMessages()
          }),scope.signal)
          return messageRows?{messages:messageRows,captures:ordinaryStage.captureMessages(),current:currentMessage}:undefined
        }})
      injections=createRoleplayTavernInjectionRegistryV1({sessionId:scope.session.id,turn:scope.turn,step:scope.step,
          attemptId,history:materialHistory,definitions:definitions.definitions,
          currentNativeCut:captureNativeCut
            ?()=>captureNativeCut<import('dsh-nexttavern-native-session').SessionEvent>(scope.session):undefined,
          nativeConsumption:generation.nativeConsumption,
          invokeNativeFilter:input=>{
            if(!deps.executeAuthorFilter)fail('INPUT_MATERIAL_NATIVE_FILTER_UNAVAILABLE')
            return deps.executeAuthorFilter(input,scope.signal,invocation.kind==='player'?invocation.scope.sourceData:undefined)
          },
          afterNativeFilter:async()=>{
            scope.signal.throwIfAborted();assertOwnerFactsCurrent()
            return invocation.kind==='player'&&await invocation.scope.sourceData?.accept()===true
          },retireNativeFilters:deps.retireNativeFilters,
          ejs:true,invokeEjs:input=>ejs.invoke({...input,macros:ejs.macros(invocationMacros)}),
          retireEjs:deps.ejs.programs.retire,assertCurrent,signal:scope.signal})
      if(authorBrowser&&authorBrowserFacts&&definitions.nativeDefinition) {
        injections.acceptNativeGeneration(authorBrowser.output,definitions.nativeDefinition)
        assertCurrent()
      }
      injections.advanceRegex({boundary:'generation-start',phaseId:attemptId})
      let dynamicRegexOrdinal=0
      const initialAttempt:TavernPromptVariableAttemptV1=opening?{attemptId,traceCounter:opening.attempt.traceCounter,
        provenance:opening.attempt.provenance}:{attemptId,traceCounter:player!.currency.attemptGeneration,
        provenance:factRef(`${scope.session.id}:actual-input-attempt`,recordSha256(player!.currency),{
          schemaVersion:1,encoding:'actual-Core-prompt-variable-attempt-v1',currency:player!.currency,
          preparation:player!.preparation,turn:scope.turn,step:scope.step,policySha256:recordSha256(policy)})}
      const settings=resolveCapturedTavernPromptSettingsV1(source),context=source.current.openingContext.context
      if(typeof context.user!=='string'||typeof context.char!=='string')fail('INPUT_MATERIAL_OPENING_NAMES_UNAVAILABLE')
      const scanDepth=Math.max(settings.scanDepth,settings.minimumActivations>0
        ?settings.minimumActivationDepthMax>0?settings.minimumActivationDepthMax+1:1000:0,
        ...compilation.plan.entries.map(entry=>entry.semanticOverrides.scanDepth??0)),
        scanRows='recentScanRows' in chatClock?chatClock.recentScanRows(Math.min(1000,scanDepth)):chatClock.scanRows,
        visibleMessages:TavernLoreVisibleMessageV1[]=[...scanRows].reverse().map(row=>{
        if(row.role!=='user'&&row.role!=='assistant')fail('INPUT_MATERIAL_STORY_ROLE_CHANGED')
        const text=row.text,speakerName=row.role==='user'?context.user!:context.char!,
          scanText=settings.includeNames?`${speakerName}: ${text}`:text
        return {messageId:row.id,versionSha256:row.messageSha256,role:row.role,speakerName,text,textSha256:sha256(text),
          scanPolicy:'owner-captured-st-message-string-v1',scanText,scanTextSha256:sha256(scanText)}
      })
      const authorsNoteDepth=noteIndex<0?0:native.selected.messages.length-noteIndex-1
      let generateLoader:ReturnType<typeof createRoleplayTavernGenerateLoaderV1>|undefined
      const {render,initialCatalog,variables,bindings,evaluated,finalLore:unexpandedLore,authorMacros}=
        await prepareRoleplayTavernContentV1({captured,scopeData:{...scopeData,bindings:initialBindings},
          attempt:initialAttempt,timed:timed.timed,
          ...derived?{execution:createRoleplayTavernDerivedContentExecutionV1(compilation.plan,derived)}:{},
          settings,visibleMessages,scanMessageCount:chatClock.data.chatIndex,macrosFor,currentCardFields,
          beforeLore:async({render,bindings})=>{
            invocationMacros=macrosFor(bindings)
            generateLoader=createRoleplayTavernGenerateLoaderV1({catalog:sourceCatalog,lookup:render.snapshot.lore,
              authorsNoteDepth,settings,phaseId:`${attemptId}:${scope.step}`,seed,
              projectKey:(row,field,index,text)=>render.projectGenerateKey(row,field,index,text,invocationMacros),
              renderEntry:(row,call)=>render.renderGenerateLoaderEntry(row,call,invocationMacros),
              assertCurrent,signal:scope.signal})
            await generateLoader.startBefore()
          },
          renderInput:{source,plan:compilation.plan,sourceCatalog,macros,rules,scopes:initialBindings,
            ejs:{identity:generation.ejs.identity,macros:ejs.macros,execute:async input=>{
              const record=await ejs.execute(input)
              injections.acceptEjsCreation(ejs.creationId(record),record,input.definition,input.phase)
              return record
            }},
            dynamicRegex:{hasBasic:()=>injections.hasRegex('basic'),
              async apply(phase,snapshot,rows) {
                if(!injections.hasRegex(phase==='generate'?'generate':'basic'))return rows
                const result=await injections.applyRegexBatch({phase,phaseId:`render:${dynamicRegexOrdinal++}`,
                  snapshot,pieces:rows})
                if(result.activationProposals.length)fail('INPUT_MATERIAL_REGEX_ACTIVATION_REQUIRES_FEEDBACK')
                return result.pieces
              }},
            ...community?{scriptOrder:community.regexOrder}:{},
            authorsNoteDepth,
            basis:{sessionId:scope.session.id,branchId:scope.session.id,revision:timed.timed.revision,turnId,attemptId,
              packageSha256,sourceSnapshotSha256:source.sourceSha256,stateSnapshotSha256:scopeData.stateSnapshotSha256,
              clockEpochMs,randomSeed:seed},assertCurrent,signal:scope.signal,definitionFor:definitions.definitionFor},
          loreProducer:(render,bindings)=>Object.freeze({...render.loreProducer,async consumeScan() {
            invocationMacros=macrosFor(bindings)
            let consumed:Awaited<ReturnType<typeof injections.consume>>
            try {consumed=await injections.consume('scan',render.snapshot)}catch(error) {
              if(error===TAVERN_NATIVE_FILTER_RECAPTURE||error===TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR)
                nativeFilterReplan=error
              throw error
            }
            const texts=await render.transformInjectionContent(consumed.prompts.map(row=>({key:row.registrationSha256,
              content:row.prompt.content,depth:row.prompt.depth,role:row.prompt.role})),macrosFor(bindings))
            const activationProposals=consumed.activationProposals.map(proposal=>{
              const entry=compilation.plan.entries.find(row=>row.entryId===proposal.entryId)
              if(!entry||proposal.sourceSnapshotSha256!==source.sourceSha256||proposal.branchId!==scope.session.id
                ||proposal.turnId!==turnId||proposal.attemptId!==attemptId)fail('INPUT_MATERIAL_INJECTION_ACTIVATION_CHANGED')
              return {entryId:entry.entryId,rawEntrySha256:entry.rawEntrySha256}
            })
            return {contributions:texts.map(row=>({identity:row.key,text:row.text,textSha256:row.textSha256})),activationProposals}
          }})})
      assertCurrent()
      // The fixed host consumes in-chat extension prompts before its final
      // author EJS pass. Capture this cut once: late persistent registrations
      // belong to the following generation and late once still closes here.
      invocationMacros=authorMacros
      const injectedChat=await injections.consume('chat',render.snapshot)
      const injectedTexts=await render.transformInjectionContent(injectedChat.prompts.map(row=>({key:row.registrationSha256,
        content:row.prompt.content,depth:row.prompt.depth,role:row.prompt.role})),authorMacros)
      if(injectedChat.activationProposals.length)fail('INPUT_MATERIAL_POST_LORE_INJECTION_ACTIVATION_REQUIRES_FEEDBACK')
      // These calls share an ordered execution journal; serial invocation keeps
      // each source pointer, macro receipt and standalone output unambiguous.
      const renderedMarkers:Partial<Record<CommunityCardMarkerV1,string>>={},rendered=[]
      for(const input of authorInputs){
        const output=await render.render(input.pointer,input.text,{macros:authorMacros,placement:1,phase:'late-author'})
        if(output.activationProposals.length)fail('INPUT_MATERIAL_LATE_AUTHOR_ACTIVATION_UNSUPPORTED')
        rendered.push(output)
        if('marker' in input){
          const marker=input.marker as CommunityCardMarkerV1
          renderedMarkers[marker]=[renderedMarkers[marker],output.renderedText].filter(Boolean).join('\n\n')
        }
      }
      // EJS may upsert a named queue after an earlier field emitted its outlet.
      // Resolve only now, without executing any template, macro or regex again.
      const finalizeText=(text:string)=>injections.resolveNamedOutlets(text)
      const author=rendered.slice(markerInputs.length).map(row=>{
        const renderedText=finalizeText(row.renderedText)
        return renderedText===row.renderedText?row:{...row,renderedText,renderedTextSha256:sha256(renderedText)}
      })
      const finalLore=unexpandedLore.map(row=>{
        const text=finalizeText(row.text)
        return text===row.text?row:{...row,text,outputSha256:sha256(text)}
      })
      for(const marker of Object.keys(renderedMarkers) as CommunityCardMarkerV1[])
        renderedMarkers[marker]=finalizeText(renderedMarkers[marker]!)
      const finalInjectedTexts=injectedTexts.map(row=>{
        const text=finalizeText(row.text)
        return text===row.text?row:{...row,text,textSha256:sha256(text)}
      })
      const messageTextProjections:NativeMaterialMessageTextProjectionV2[]=[]
      // The community bridge already transformed these selected history rows
      // with the merged global/preset/scoped registry. Legacy independent
      // callers retain the original Native V2 path instead of running it twice.
      if(!community) {
        // The chat-clock owner classified canonical prose; a maintenance
        // assistant never acquires AI_OUTPUT placement through continuity rows.
        const historyRows=invocation.kind==='player'?native.selected.messages.filter(row=>
            row.role==='user'&&row.message.role==='user'&&row.message.source.kind==='user'
            ||row.role==='assistant'&&canonicalAssistantIds.has(row.id)):[],
          historyBlocks=historyRows.flatMap((selected,index)=>{
            const settled=selected.eventSeq===null?undefined:storyText?.blocks(selected.eventSeq,selected.message,selected.messageSha256)
            return selected.message.content.flatMap((block,blockIndex)=>
            block.type==='text'?[{key:joinHistoryBlock(index,blockIndex),text:settled?.get(blockIndex)??block.text,
              role:selected.role==='user'?'user' as const:'assistant' as const,
              depth:historyRows.length-index-1}]:[])}),
          historyTexts=new Map((await render.transformHistoryContent(historyBlocks,authorMacros))
            .map(row=>[row.key,row.text]))
        for(const [index,selected] of historyRows.entries()) {
          const textEdits=selected.message.content.flatMap((block,blockIndex)=>{
            if(block.type!=='text')return []
            const transformed=historyTexts.get(joinHistoryBlock(index,blockIndex))??block.text,
              replacementText=finalizeText(projectHistoryText(selected.id,transformed))
            return replacementText!==block.text?[{blockIndex,replacementText}]:[]
          })
          if(!textEdits.length)continue
          const projected=projectNativeMessageTextV2(selected.message,textEdits)
          messageTextProjections.push({target:{id:selected.id,
            role:selected.role==='user'?'user':'assistant',messageSha256:selected.messageSha256},
            textEdits,projectionSha256:nativeInputSha256(projected)})
        }
      }
      assertCurrent()
      const layout=produceRoleplayTavernLayoutV1({native,original,residual,evaluation:evaluated.plan,finalLore,
        phaseASnapshot:snapshot.contextMessageRefs,renderedAuthor:{cardsText:author[0]!.renderedText,
          rulesText:author[1]!.renderedText,examplesText:author[2]!.renderedText},injected:injectedChat.prompts.map((row,index)=>({
            contributionRef:`inject-${row.registrationSha256}`,sourceSha256:sha256(row.prompt.content),
            requestedRole:row.prompt.role,requestedDepth:row.prompt.depth,renderedText:finalInjectedTexts[index]!.text,
            renderedSha256:finalInjectedTexts[index]!.textSha256}))})
      const semanticStory=storyRows.map(row=>({id:row.id,role:row.role,messageSha256:row.messageSha256})),
        semanticStoryIds=new Set(semanticStory.map(row=>row.id)),semanticStorySha256=recordSha256(semanticStory)
      const {source:_editSource,...editData}=captured.edits,
        {source:_variableSource,...variableInput}=variables.input
      const communityMaterial=community?communityMaterialV2(native.selected,
        community.finish({native,layout,finalLore,evaluation:evaluated.plan,renderedMarkers,finalizeText,
          renderedAuthor:{cardsText:author[0]!.renderedText,rulesText:author[1]!.renderedText,
            examplesText:author[2]!.renderedText}})):undefined
      const renderedAuthorMaterial:TavernRenderedAuthorMaterialV1=freeze({
        sourceCurrentIdentitySha256:captured.currentIdentitySha256,
        // Mapped fields leave partial author outputs that must not replace a
        // complete persona. A future bridge needs producer partition coverage
        // and execution outputs, rather than attribution inferred from pointers.
        authorGroups:mapped?[]:[
          {id:'/native/current-author/cards',text:author[0]!.renderedText,
            parts:remainingParts.filter(part=>part.kind==='card')},
          {id:'/native/current-author/rules',text:author[1]!.renderedText,
            parts:remainingParts.filter(part=>part.kind!=='card'&&part.kind!=='examples')},
          {id:'/native/current-author/examples',text:author[2]!.renderedText,
            parts:remainingParts.filter(part=>part.kind==='examples')},
        ],finalLore,compilationEntries:compilation.plan.entries.map(({entryId,ordinal,sourceKey,sourcePointer})=>
          ({entryId,ordinal,sourceKey,sourcePointer})),currentNativeMembership:!!compilation.plan.currentNativeMembership,
      })
      const authorBrowserIdentity=authorBrowser?{
          schemaVersion:1,encoding:'author-native-generation-identity-v1',
          sessionId:authorBrowser.capture.sessionId,sourceSnapshotSha256:authorBrowser.capture.sourceSnapshotSha256,
          nativeCut:authorBrowser.capture.nativeCut,nativePrefixSha256:authorBrowser.capture.nativePrefixSha256,
          scopeFrameSha256:authorBrowser.capture.scopeFrame.frameSha256,
          attemptId:authorBrowser.capture.attemptId,clockEpochMs:authorBrowser.capture.clockEpochMs,
          randomSeed:authorBrowser.capture.randomSeed,captureSha256:authorBrowser.capture.captureSha256,
          invocationId:authorBrowser.output.invocationId,programSha256:authorBrowser.output.programSha256,
          outputSha256:authorBrowser.output.outputSha256,callbacksExecuted:authorBrowser.output.callbacksExecuted,
        }:undefined
      const finishMaterial=()=>{
        injections.advanceRegex({boundary:'prompt-complete',phaseId:`${attemptId}:${scope.step}`})
        injections.advanceNamed()
        const injectionTransaction=injections.transaction(),ejsPreparation=ejs.finish(),ordinaryChat=ordinaryStage.plan()
        return {snapshot:freeze({schemaVersion:native.selectedCaptureV2?2:1,
          encoding:native.selectedCaptureV2?'native-tavern-prompt-capture-v2':'native-tavern-prompt-capture-v1',authority:'consumer-data-only',
          policy,source,ejsPreparation,...authorBrowserIdentity?{authorBrowser:authorBrowserIdentity}:{},
          authorPolicy,authorPolicySha256,
          edits:{...editData,sourceRef:{sourceSha256:source.sourceSha256}},
          initialCatalogReceipt:initialCatalog.receipt,
          variablesInput:{...variableInput,sourceRef:{sourceSha256:source.sourceSha256}},variables:variables.packet,
          scopes:scopeData.evidence,timed:timed.evidence,canonicalChatClock:chatClock.data,
          originalAuthor:original,residualAuthor:residual,...mapped?{communityCardMaterial:mapped}:{},
          injections:injectionTransaction,injectionAudit:injections.audit(),
          tavernEvaluationInput:evaluated.input,render:render.audit(),initialNativeSelected:native.selectedCaptureV2??native.selected,
          ...opening?{openingPreparation:{snapshotRef:opening.snapshotRef,ownedBranchRefs:opening.ownedBranchRefs,scopeFacts:opening.scopes.data,
            attempt:opening.attempt}}:{phaseASnapshotRef:player!.phaseA?.current().reference??player!.currency.snapshot}}),
        plan:freeze({schemaVersion:1,encoding:'native-tavern-prompt-plan-v1',authority:'consumer-data-only',
          policySha256:recordSha256(policy),tavernEvaluationPlan:evaluated.plan,
          finalLore,layout:layout.layout,variablePacketSha256:variables.packet.packetSha256,ordinaryChat,
          ...messageTextProjections.length?{historyTextProjection:{
            policy:'selected-real-user-and-canonical-assistant-per-text-block-prompt-regex-and-assistant-user-identity-v1',
            messageTextProjections}}:{},
          ...authorBrowser?{authorBrowserOutputSha256:authorBrowser.output.outputSha256}:{},
          injectionTransactionSha256:injectionTransaction.transactionSha256,
          ...communityMaterial?.record?{community:communityMaterial.record}:{}})}
      }
      const preparedBasis={...layout,...communityMaterial,renderedAuthorMaterial,
        ...messageTextProjections.length?{messageTextProjections}:{},assertCurrent:injections.assertCurrent,
        release(){derived?.release();inputCapture.release()},
        assertSelected(selected:NativeMaterialSelectedBaseV1,firstAttempt:boolean) {
          // Native's original callback DATA is already deeply immutable. Later
          // objects must carry its actual lineage; hashing the same original
          // bodies again cannot grant additional ownership or detect a change.
          if(selected===native.selected) {
            if(!firstAttempt)
              fail('INPUT_MATERIAL_INITIAL_SELECTION_CHANGED')
          }else assertNativeRequestMaterialSelectionV1(native.selected,selected)
          const actual=selected.messages.filter(row=>semanticStoryIds.has(row.id))
            .map(row=>({id:row.id,role:row.role,messageSha256:row.messageSha256}))
          if(recordSha256(actual)!==semanticStorySha256)fail('INPUT_MATERIAL_STORY_SELECTION_CHANGED')
        }}
      return {kind:'text-draft' as const,...preparedBasis,
        async finishRequestText(surface:NativeMaterialTextSurfaceV1) {
          try {
            assertCurrent()
            // Static/built-in regex has already processed its real channels.
            // Upstream clears temporary basic rules at this final prompt edge.
            injections.advanceRegex({boundary:'prompt-start',phaseId:`${attemptId}:${scope.step}`})
            const textOutputs=await generateLoader!.finish(surface,async(slot,loaderContext)=>{
              const id=`generate:${slot.messageOrdinal}:${slot.blockOrdinal??'string'}`,
                env={...loaderContext,role:slot.role,is_user:slot.role==='user',is_system:slot.role==='system',
                  message_ordinal:slot.messageOrdinal,block_ordinal:slot.blockOrdinal},
                role=slot.role==='user'||slot.role==='assistant'||slot.role==='system'?slot.role:undefined
              let text=slot.text
              if(injections.hasRegex('generate')) {
                const transformed=await injections.applyRegexBatch({phase:'generate',phaseId:id,
                  snapshot:render.snapshot,pieces:[{id,text,...role?{role}:{},env}]})
                if(transformed.activationProposals.length)fail('INPUT_MATERIAL_LATE_REGEX_ACTIVATION_UNSUPPORTED')
                text=transformed.pieces[0]!.text
              }
              // Each final slot is its own actual producer. Do not run source
              // macro preprocessing again, or evaluate all EJS after all regex:
              // this slot's registrations are visible to the following slot.
              if(text.includes('<%')) {
                const pointer=`derived:generate/${slot.messageOrdinal}/${slot.blockOrdinal??'string'}`,
                  record=await ejs.execute({snapshot:render.snapshot,macros:ejs.macros(authorMacros),
                    definition:definitions.finalMessageDefinition,phase:'generate-final',context:env,
                    resource:{id:pointer,sourcePointer:pointer,sourceSnapshotSha256:source.sourceSha256,
                      contentSha256:sha256(text),text}})
                if(record.creation.kind!=='rendered')fail(record.creation.diagnostic.code)
                if(record.creation.output.activations.length)fail('INPUT_MATERIAL_LATE_AUTHOR_ACTIVATION_UNSUPPORTED')
                injections.acceptEjsCreation(ejs.creationId(record),record,definitions.finalMessageDefinition,'generate-final')
                text=record.creation.output.renderedText
              }
              return text
            })
            // Final-slot EJS can upsert a named outlet after an earlier slot
            // emitted it. Resolve only that inert text family once, as above.
            for(const [index,output] of textOutputs.entries())if(output.text.includes('{{outletPromptsInjected:')) {
              const text=finalizeText(output.text)
              if(text!==output.text)textOutputs[index]={...output,text}
            }
            assertCurrent()
            return {...finishMaterial(),textOutputs}
          }catch(error) {
            generation.ejs?.collector.retire()
            throw error
          }
        }}
      }catch(error) {
        derived?.release();inputCapture.release()
        if(error===TAVERN_NATIVE_FILTER_RECAPTURE||error===TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR) {
          // The Native callback and its writer ACKs already happened. Fresh
          // Source rebuilds deterministic EJS work; its Native sub-schedules
          // remain with this actual generation and consume completed DATA.
          previous?.ejs?.collector.retire()
          if(previous)previous.ejs=undefined
          if(error===TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR)return {kind:'source-data-successor' as const}
          return prepare(native,invocation)
        }
        if(previous?.nativeConsumption)releaseTavernNativeInjectionConsumptionV1(previous.nativeConsumption,materialHistory)
        throw error
      }
  }
  return {sectionNames:[...TAVERN_NATIVE_OWNED_SECTION_NAMES_V1,...deps.community?['roleplay:community-preset']:[]],
    captureAuthorSource:sessionId=>captureAuthorSource(deps,sessionId),
    prepare:(native,scope)=>scope.stepToken.kind==='story'?prepare(native,{kind:'player',scope}):prepareHistoryText(native,scope),
    prepareOpening:(native,scope)=>prepare(native,{kind:'program-opening',scope,native})}
}
