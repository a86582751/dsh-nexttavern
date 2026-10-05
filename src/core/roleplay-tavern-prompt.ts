/** One actual Core step owns Source capture, variable preparation, selected
 * template evaluation and Native layout data. None of the persisted receipts
 * can recreate the original step, Source lock or Native selected capability. */
import {assertNativeRequestMaterialSelectionV1,nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {NativeMaterialSelectedBaseV1,NativeRequestMaterialPrepareInputV1,NativeOpeningMaterialPrepareInputV1}
  from '@deepseek-ai/dsh-agent-loop'
import type {SessionMessageProjection} from '@deepseek-ai/dsh-session'
import {recordSha256,sha256,textOf} from './roleplay-data.js'
import {readTavernCardMacroFields} from './nexttavern-card.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {captureRoleplayTavernPromptSourceDataV1} from './roleplay-tavern-prompt-source.js'
import {captureRoleplayTavernPromptScopesV1} from './roleplay-tavern-prompt-scopes.js'
import type {TavernActualSchemaPromptScopesV1,TavernActualNonnumericalPromptScopesV1,
  TavernActualNumericalPromptScopesV1} from './roleplay-tavern-prompt-scopes.js'
import type {TavernActualPendingOpeningPromptScopesV1,TavernOpeningPreparationSourceDataV1}
  from './roleplay-program-opening-prompt-scopes-types.js'
import {captureRoleplayTavernTimedHistoryV2} from './roleplay-tavern-lore-timed-lineage.js'
import {captureTavernCanonicalChatClockV1} from './roleplay-tavern-chat-clock.js'
import {captureRoleplayTavernMaterialHistoryV1} from './roleplay-tavern-material-history.js'
import {createRoleplayTavernInjectionRegistryV1} from './roleplay-tavern-injections.js'
import {captureRoleplayTavernInjectionDefinitionsV1} from './roleplay-tavern-injection-definitions.js'
import {captureRoleplayTavernInitialCatalogV1} from './roleplay-tavern-prompt-initial.js'
import {prepareRoleplayTavernPromptVariablesV1} from './roleplay-tavern-prompt-variables.js'
import type {TavernPromptVariableAttemptV1,TavernPromptVariableReadV1,
  TavernPromptVariableRefV1} from './roleplay-tavern-prompt-variables-types.js'
import {produceRoleplayTavernMacroSnapshotV1,captureRoleplayTavernScopedRegexV1} from './roleplay-tavern-prompt-macros.js'
import {prepareRoleplayTavernRenderCatalogV1} from './roleplay-tavern-prompt-render.js'
import {prepareOwnedTavernLoreWithOwnerV1} from './tavern-lore-evaluator.mjs'
import {validateTavernLoreSnapshotV1} from './tavern-lore-snapshot.mjs'
import type {TavernLoreFrozenSettingsV1,TavernLoreFrozenSnapshotV1,
  TavernLoreVisibleMessageV1} from './tavern-lore-evaluator-types.mjs'
import {createRoleplayTavernTokenCountV1} from './roleplay-tavern-token-count.js'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {produceRoleplayTavernLayoutV1,TAVERN_NATIVE_OWNED_SECTION_NAMES_V1} from './roleplay-tavern-layout.js'
import type {AdmittedTavernTemplateComponentV1} from './roleplay-tavern-template-assets.js'
import type {PreparationSnapshot} from './roleplay-preparation-types.js'
import type {RoleplayInputMaterialDependenciesV1,RoleplayInputMaterialScopeV1} from './roleplay-input-material.js'
import type {RoleplayOpeningMaterialScopeV1} from './roleplay-opening-material.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'
import {produceAuthorPromptCaptureV1} from './roleplay-author-prompt-capture.js'
import type {PromptProgramV1,PromptCaptureV1,PromptExecutionV1,PromptExecutionOutputV1}
  from './tavern-author-prompt-types.mjs'

/** Native has no ST global settings store. This versioned program policy is
 * explicit; archived character-book settings remain importer metadata. */
export const TAVERN_NATIVE_PROMPT_SETTINGS_V1:Readonly<TavernLoreFrozenSettingsV1>=Object.freeze({
  policy:'owned-st-single-book-scan-feedback-v1',provenance:'explicit-native-fallback-v1',
  caseSensitive:false,matchWholeWords:false,scanDepth:2,useGroupScoring:false,recursiveScanning:true,
  minimumActivations:0,minimumActivationDepthMax:0,maxRecursionSteps:32,includeNames:true,
  characterStrategy:'single-character-book-v1',budgetTokens:2048,
  contentTransformPolicy:'no-world-info-output-regex-v1',macroPolicy:'frozen-rendered-receipt-or-marker-free-v1',
  seedPolicy:'sha256-counter-domain-separated-v1',budgetPolicy:'frozen-cumulative-token-ledger-st-gte-v1'})
export const TAVERN_NATIVE_PROMPT_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'native-tavern-actual-core-preparation-policy-v1',
  settings:TAVERN_NATIVE_PROMPT_SETTINGS_V1,bookSettings:'fixed-importer-metadata-not-applied',
  trace:'actual-Core-input-attempt-generation; readonly-template-counter-adaptation',
  initialRegex:'fixed-feature-worldinfo-call-without-generate-selector; no-registry-read',
  author:'same-field-producer; macros-then-standalone-EJS; no-rerender-of-output',
  regex:'activated-card-scoped-rules-in-bounded-worker; explicit-native-owned-allow-policy',
  timing:'actual-Native-material-publication; persisted-consumer-data-only',
  lateAuthor:'scan-and-chat-cut-before-author-EJS; default-persistent-next-generation; once-current-terminal',
  lateActivation:'typed-refusal-after-lore-seal; no-silent-drop-or-invented-next-generation-activation',
  retry:'same-Core-step-frozen-render-and-budget-ledger; actual-Native-selected-lineage-check',
  requests:{normal:0,retry:0,fallback:0}})
/** New optional producer policy leaves existing completed v1 bodies intact. */
export const TAVERN_NATIVE_PROMPT_POLICY_V2=Object.freeze({...TAVERN_NATIVE_PROMPT_POLICY_V1,schemaVersion:2,
  encoding:'native-tavern-actual-core-preparation-policy-v2',
  generationHook:'complete-stateless-PromptProgram1; actual-opening-anchored-Native-history-and-variable-DATA',
  promptEffects:'typed-Prompt-producer-in-the-one-published-injection-registry; existing-scan-and-chat-cuts',
  promptClose:'actual-Source-definition-close-and-Native-terminal-disposal; no-worker-or-provider-retry-close',
  promptTransport:{newPreparationWorkerRoundTrips:1,browserRoundTrips:0,preparedProviderRetryWorkerRoundTrips:0}})

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
  readonly inputState:RoleplayInputStateOwner
  /** Exact pending publications supplied by their actual producer. */
  readonly pendingOutputRows:(sessionId:string)=>readonly {readonly table:string;readonly key:string}[]
  readonly branch:{get(key:string):unknown}
  withSourceLock<T>(sessionId:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
  includeCardStyle(sessionId:string):boolean
  authorPolicy(sessionId:string):Readonly<Record<string,unknown>>
  loadTemplate(signal:AbortSignal):Promise<AdmittedTavernTemplateComponentV1>
  projections():readonly SessionMessageProjection[]
  /** Uses the existing selected-window continuity policy and real internal
   * maintenance provenance, with no second prompt budget or Session fold. */
  storyRows(scope:ActualMaterialScope,selected:NativeMaterialSelectedBaseV1)
    :readonly NativeMaterialSelectedBaseV1['messages'][number][]
  schemaScopes(sessionId:string):TavernActualSchemaPromptScopesV1|undefined
  executeAuthorPrompt(sessionId:string,program:PromptProgramV1,capture:PromptCaptureV1,signal?:AbortSignal)
    :Promise<PromptExecutionV1>
  plainScopes(sessionId:string,currentSourceIdentitySha256:string):TavernActualNonnumericalPromptScopesV1|undefined
  numericalScopes(sessionId:string):TavernActualNumericalPromptScopesV1|undefined
  /** Reads inherited timing once while the input owner records its actual
   * dependencies. Later checkpoints use that captured dependency baseline. */
  inheritedTiming(scope:ActualMaterialScope,source:Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]['source'],
    assertOwnerFactsCurrent:()=>void)
    :{sourceLineage:NonNullable<Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]['sourceLineage']>;
      inheritedHistory:NonNullable<Parameters<typeof captureRoleplayTavernTimedHistoryV2>[0]['inheritedHistory']>;
      assertCurrent():void}|undefined
  /** Actual no-player Native invocation, immutable inputs and genuine Phase A
   * context refs. This supplier never constructs an Input v2 Work/currency. */
  openingPreparation?(native:NativeOpeningMaterialPrepareInputV1,scope:RoleplayOpeningMaterialScopeV1,
    source:TavernOpeningPreparationSourceDataV1):TavernOpeningPreparationReadV1
}
function fail(code:string):never {throw Error(code)}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
function factRef(ownerId:string,versionSha256:string,ref:Record<string,unknown>):TavernPromptVariableRefV1 {
  const data=cloneRoleplayTavernLoreDataV1(ref,65_536,{nodes:4096,depth:16}) as MvuJsonObject
  return {ownerId,versionSha256,ref:data,refSha256:recordSha256(data)}
}
function phaseASnapshot(deps:Dependencies,scope:RoleplayInputMaterialScopeV1):Omit<PreparationSnapshot,'agent'> {
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
export function createRoleplayTavernPromptMaterialV1(deps:Dependencies):RoleplayInputMaterialDependenciesV1&{
  prepareOpening(native:NativeOpeningMaterialPrepareInputV1,scope:RoleplayOpeningMaterialScopeV1)
    :ReturnType<RoleplayInputMaterialDependenciesV1['prepare']>
} {
  const prepare=(native:ActualNativePreparation,invocation:MaterialInvocation)=>{
    const scope=invocation.scope
    const assertOwnerFactsCurrent=scope.assertOwnerFactsCurrent.bind(scope)
    return deps.withSourceLock(scope.session.id,async()=>{
      // Synchronous capture records the real read footprint once. Inner DATA
      // suppliers need cancellation, not another read of the input owner's
      // Work/current outputs, which Native legitimately updates after capture.
      const assertSignal=()=>scope.signal.throwIfAborted()
      const inputCapture=deps.inputState.captureInput({session:scope.session,signal:scope.signal,
        assertOwnerFactsCurrent,outputRows:[...scope.outputRows??[],...deps.pendingOutputRows(scope.session.id)]},()=>{
        const author=deps.inputState.captureSource(scope.session.id,'tavern-author',()=>{
          const includeCardStyle=deps.includeCardStyle(scope.session.id),
            authorPolicy=cloneRoleplayTavernLoreDataV1(deps.authorPolicy(scope.session.id),262_144),
            authorPolicySha256=recordSha256(authorPolicy),
            captured=captureRoleplayTavernPromptSourceDataV1(deps,scope.session.id,includeCardStyle)
          if(captured.kind==='outside-declared-domain')return captured
          return {kind:'author-data' as const,includeCardStyle,authorPolicy,authorPolicySha256,captured}
        }).data
        if(author.kind==='outside-declared-domain')return author
        const opening=invocation.kind==='program-opening'
          ?deps.openingPreparation?.(invocation.native,invocation.scope,{
            sourceCurrentIdentitySha256:author.captured.currentIdentitySha256,includeCardStyle:author.includeCardStyle,
            editorRevision:author.captured.edits.revision,editorHeadSha256:author.captured.edits.headRef?.sha256??null,
            currentNativeOverlaySha256:author.captured.compilation.plan.currentNativeOverlaySha256??null}):undefined
        if(invocation.kind==='program-opening'&&!opening)fail('OPENING_MATERIAL_ACTUAL_PREPARATION_REQUIRED')
        const player=invocation.kind==='player'?invocation.scope:undefined,
          playerSnapshot=player?phaseASnapshot(deps,player):undefined,snapshot=playerSnapshot??opening!.snapshot,
          {source,compilation}=author.captured,storyRows=deps.storyRows(scope,native.selected),
          storyIds=new Set(storyRows.map(row=>row.id)),initialSelectedSha256=nativeInputSha256(native.selected)
        if(storyIds.size!==storyRows.length)fail('INPUT_MATERIAL_STORY_SELECTION_DUPLICATE')
        // Phase A already chose the actual numerical domain. Reading every
        // alternative would repeat complete opening and inheritance audits.
        let domain:Pick<Parameters<typeof captureRoleplayTavernPromptScopesV1>[0],'opening'|'schema'|'plain'|'numerical'>
        if(opening)domain={opening:opening.scopes}
        else if(playerSnapshot?.numericalState?.schemaVersion===2)domain={schema:deps.schemaScopes(scope.session.id)}
        else if(playerSnapshot?.numericalState)domain={numerical:deps.numericalScopes(scope.session.id)}
        else domain={plain:deps.plainScopes(scope.session.id,author.captured.currentIdentitySha256)}
        const scopeData=captureRoleplayTavernPromptScopesV1({source,
          currentIdentitySha256:author.captured.currentIdentitySha256,selected:native.selected,
          ...domain,
          isStoryMessage:row=>storyIds.has(row.id),assertOwnerCurrent:assertSignal})
        const authorPromptFacts=domain.schema?.authorPrompt
        const materialHistory=captureRoleplayTavernMaterialHistoryV1({sessionId:scope.session.id,table:deps.branch,
          events:()=>scope.session.snapshotEvents(),projections:deps.projections,assertOwnerCurrent:assertSignal})
        const chatClock=captureTavernCanonicalChatClockV1({session:scope.session,selected:native.selected,
          assertOwnerCurrent:assertSignal}),inheritedTiming=deps.inheritedTiming(scope,source,assertSignal),
          timed=captureRoleplayTavernTimedHistoryV2({sessionId:scope.session.id,source,compilation,ownHistory:materialHistory,
            inheritedHistory:inheritedTiming?.inheritedHistory,sourceLineage:inheritedTiming?.sourceLineage,
            clock:chatClock,projections:deps.projections(),assertOwnerCurrent:assertSignal,
            assertSourceLineageCurrent:()=>inheritedTiming?.assertCurrent()})
        const {kind:_authorKind,...authorData}=author
        return {kind:'input-data' as const,...authorData,opening,player,playerSnapshot,snapshot,storyRows,
          initialSelectedSha256,scopeData,materialHistory,chatClock,timed,authorPromptFacts}
      })
      if(inputCapture.data.kind==='outside-declared-domain') {
        const outside=inputCapture.data
        inputCapture.release()
        if(['ACTIVE_SOURCE_MISSING','LEGACY_SOURCE_OUTSIDE_DOMAIN'].includes(outside.reason))return outside
        fail(`INPUT_MATERIAL_${outside.reason}`)
      }
      const {captured,opening,player,playerSnapshot,snapshot,storyRows,initialSelectedSha256,
        scopeData,materialHistory,chatClock,timed,authorPromptFacts,includeCardStyle,authorPolicy,authorPolicySha256}=inputCapture.data,
        {source,compilation,original,residual}=captured,assertCurrent=inputCapture.assertCurrent
      try {
      assertCurrent()
      const attemptId=opening?.attempt.attemptId??`${player!.currency.preparationId}:${player!.currency.attemptGeneration}`,
        turnId=String(scope.turn),seed=opening?recordSha256(opening.attempt.seed):
          recordSha256({schemaVersion:1,encoding:'native-tavern-attempt-seed-v1',
            currency:player!.currency,sourceSha256:source.sourceSha256,selectedSha256:native.selected.sha256}),
        clockEpochMs=Date.now(),packageSha256=source.original.documentSha256,
        policy=authorPromptFacts?TAVERN_NATIVE_PROMPT_POLICY_V2:TAVERN_NATIVE_PROMPT_POLICY_V1
      const declaredOutlets=compilation.plan.entries.flatMap(entry=>{
        const semantic={...ST_LORE_ENTRY_DEFAULTS_V1,...entry.semanticOverrides}
        return semantic.position==='named-outlet'&&semantic.outletName?[semantic.outletName]:[]
      })
      const macrosFor=(scopes:readonly TavernTemplateScopeBindingV1[],outlets:readonly {name:string;text:string;versionSha256:string}[]=[])=>
        produceRoleplayTavernMacroSnapshotV1({source,cardData:captured.cardData,includeCardStyle,
          inputText:playerSnapshot?playerSnapshot.userText:null,scopes,outlets,declaredOutlets}).snapshot
      const macros=macrosFor(scopeData.bindings),rules=captureRoleplayTavernScopedRegexV1(captured.cardData,source.sourceSha256,true)
      const component=await deps.loadTemplate(scope.signal)
      assertCurrent()
      let authorPrompt:{readonly capture:PromptCaptureV1;readonly output:PromptExecutionOutputV1}|undefined
      if(authorPromptFacts) {
        const capture=produceAuthorPromptCaptureV1({history:chatClock,scopes:authorPromptFacts.scopes,
          opening:authorPromptFacts.opening,attemptId,clockEpochMs,randomSeed:seed})
        const execution=await deps.executeAuthorPrompt(scope.session.id,authorPromptFacts.program,capture,scope.signal)
        assertCurrent()
        if(execution.kind!=='executed')fail(execution.diagnostics[0]?.code??'INPUT_MATERIAL_AUTHOR_PROMPT_REFUSED')
        authorPrompt={capture,output:execution.output}
      }
      const note=snapshot.contextMessageRefs?.refs.find(row=>row.form==='director-notes'),
        noteIndex=note?native.selected.messages.findIndex(row=>row.id===note.id&&row.messageSha256===note.messageSha256):-1
      const definitions=captureRoleplayTavernInjectionDefinitionsV1(source,compilation.plan,residual,authorPromptFacts?.program),
        injections=createRoleplayTavernInjectionRegistryV1({sessionId:scope.session.id,turn:scope.turn,step:scope.step,
          attemptId,history:materialHistory,definitions:definitions.definitions,promptDefinition:definitions.promptDefinition,
          component,assertCurrent,signal:scope.signal})
      if(authorPrompt&&authorPromptFacts&&definitions.promptDefinition) {
        await injections.acceptPromptGeneration(authorPromptFacts.program,authorPrompt.capture,
          authorPrompt.output,definitions.promptDefinition)
        assertCurrent()
      }
      const render=await prepareRoleplayTavernRenderCatalogV1({source,plan:compilation.plan,macros,rules,
        component,scopes:scopeData.bindings,authorsNoteDepth:noteIndex<0?0:native.selected.messages.length-noteIndex-1,
        basis:{sessionId:scope.session.id,branchId:scope.session.id,revision:timed.timed.revision,turnId,attemptId,
          packageSha256,sourceSnapshotSha256:source.sourceSha256,stateSnapshotSha256:scopeData.stateSnapshotSha256,
          clockEpochMs,randomSeed:seed},assertCurrent,signal:scope.signal,definitionFor:definitions.definitionFor,
        onCreation:(request,output,definition,phase)=>injections.acceptCreation(request,output,definition,phase)})
      assertCurrent()
      const initialCatalog=captureRoleplayTavernInitialCatalogV1({source,plan:compilation.plan,
        assertCurrent:assertSignal,signal:scope.signal})
      const attempt:TavernPromptVariableAttemptV1=opening?{attemptId,traceCounter:opening.attempt.traceCounter,
        provenance:opening.attempt.provenance}:{attemptId,traceCounter:player!.currency.attemptGeneration,
        provenance:factRef(`${scope.session.id}:actual-input-attempt`,recordSha256(player!.currency),{
          schemaVersion:1,encoding:'actual-Core-prompt-variable-attempt-v1',currency:player!.currency,
          preparation:player!.preparation,turn:scope.turn,step:scope.step,policySha256:recordSha256(policy)})}
      const variables=await prepareRoleplayTavernPromptVariablesV1({schemaVersion:1,
        encoding:'owned-prompt-variable-input-v1',sessionId:scope.session.id,source,catalog:initialCatalog.catalog,
        scopes:scopeData.scopes,history:scopeData.history,attempt},{signal:scope.signal,assertCurrent,
        async renderInitial(request) {
          assertCurrent()
          const bindings=[...request.readonlyScopes,request.initialSoFar]
          const actual=await render.renderWithEvidence(request.entry.contentPointer,request.body,
            {entryId:request.entry.entryId,scopes:bindings,macros:macrosFor(bindings),phase:'initial'})
          assertCurrent()
          const evidenceSha256=recordSha256(actual.evidence),renderRef=factRef(`${scope.session.id}:initial-render`,evidenceSha256,{
            schemaVersion:1,encoding:'native-initial-render-execution-ref-v1',requestSha256:request.requestSha256,
            executionSha256:evidenceSha256,featureRegexPolicy:initialCatalog.policySha256,
            sourceSha256:source.sourceSha256,scopeBindingsSha256:recordSha256(bindings)})
          const reads:TavernPromptVariableReadV1[]=[
            {kind:'source',identity:'actual-current-source',valueSha256:source.sourceSha256,
              provenance:factRef(`${scope.session.id}:initial-source`,source.sourceSha256,{
                sourceSha256:source.sourceSha256,catalogSha256:initialCatalog.catalog.catalogSha256})},
            {kind:'scope',identity:'actual-render-scope-bindings',valueSha256:recordSha256(bindings),
              provenance:factRef(`${scope.session.id}:initial-scope-bindings`,recordSha256(bindings),{
                scopeBindingsSha256:recordSha256(bindings),executionSha256:evidenceSha256,
                scopeFactsSha256:recordSha256(scopeData.evidence)})},
            {kind:'render',identity:'actual-macro-feature-regex-and-template-execution',
              valueSha256:evidenceSha256,provenance:renderRef}]
          return {schemaVersion:1,encoding:'owned-prompt-initial-render-output-v1',
            pipeline:'actual-macro-template-regex-ejs-v1',requestSha256:request.requestSha256,
            renderedText:actual.output.renderedText,renderedTextSha256:actual.output.renderedTextSha256,reads,renderRef}
        }})
      assertCurrent()
      if(variables.kind!=='prepared')fail(variables.diagnostics[0]?.code??'INPUT_MATERIAL_VARIABLES_REFUSED')
      const bindings=[...scopeData.bindings,...[variables.packet.initial,variables.packet.cache]
        .flatMap(value=>value.kind==='bound'?[value.binding]:[])]
      render.bindVariableScopes(bindings)
      const tokenCount=createRoleplayTavernTokenCountV1(assertSignal,scope.signal),settings=TAVERN_NATIVE_PROMPT_SETTINGS_V1,
        context=source.current.openingContext.context
      if(typeof context.user!=='string'||typeof context.char!=='string')fail('INPUT_MATERIAL_OPENING_NAMES_UNAVAILABLE')
      const visibleMessages:TavernLoreVisibleMessageV1[]=[...chatClock.scanRows].reverse().map(row=>{
        if(row.role!=='user'&&row.role!=='assistant')fail('INPUT_MATERIAL_STORY_ROLE_CHANGED')
        const text=row.text,speakerName=row.role==='user'?context.user!:context.char!,
          scanText=settings.includeNames?`${speakerName}: ${text}`:text
        return {messageId:row.id,versionSha256:row.messageSha256,role:row.role,speakerName,text,textSha256:sha256(text),
          scanPolicy:'owner-captured-st-message-string-v1',scanText,scanTextSha256:sha256(scanText)}
      })
      const card=captured.cardData,text=(value:unknown)=>typeof value==='string'?value:'',
        aliases=readTavernCardMacroFields(card,source.original.decodedFormat),
        globalScanData={personaDescription:macros.card?.find(value=>value.key==='persona')?.value??'',
          characterDescription:text(aliases.description),characterPersonality:text(aliases.personality),
          characterDepthPrompt:macros.card?.find(value=>value.key==='charDepthPrompt')?.value??'',
          scenario:text(aliases.scenario),creatorNotes:text(card.creator_notes)}
      const emptyCounts={schemaVersion:1 as const,encoding:'owned-frozen-token-count-ledger-v1' as const,
        identity:tokenCount.identity,implementationSha256:tokenCount.implementationSha256,method:tokenCount.method,counts:[]}
      const body:Omit<TavernLoreFrozenSnapshotV1,'snapshotSha256'>={schemaVersion:1,
        encoding:'owned-st-lore-frozen-snapshot-v1',authority:'consumer-data-only',sessionId:scope.session.id,
        branchId:scope.session.id,revision:timed.timed.revision,turnId,attemptId,sourceSnapshotSha256:source.sourceSha256,
        stateSnapshotSha256:scopeData.stateSnapshotSha256,sourceReferenceSha256:compilation.plan.sourceReferenceSha256,
        packageSha256,compilerPlanSha256:compilation.plan.planSha256,visibleMessages,messagesSha256:recordSha256(visibleMessages),
        settings,settingsSha256:recordSha256(settings),seed,seedSha256:sha256(seed),globalScanData,
        globalScanDataSha256:recordSha256(globalScanData),timed:timed.timed,timedSha256:recordSha256(timed.timed),
        tokenizer:emptyCounts,tokenizerSha256:recordSha256(emptyCounts),renderedTexts:[],renderedTextsSha256:recordSha256([])}
      const frozenSnapshot=validateTavernLoreSnapshotV1({...body,snapshotSha256:recordSha256(body)})
      const loreProducer=Object.freeze({...render.loreProducer,async consumeScan() {
        const consumed=await injections.consume('scan',render.snapshot)
        const texts=await render.transformInjectionContent(consumed.prompts.map(row=>({key:row.registrationSha256,
          content:row.prompt.content,depth:row.prompt.depth,role:row.prompt.role})),macrosFor(bindings))
        const activationProposals=consumed.activationProposals.map(proposal=>{
          const entry=compilation.plan.entries.find(row=>row.entryId===proposal.entryId)
          if(!entry||proposal.sourceSnapshotSha256!==source.sourceSha256||proposal.branchId!==scope.session.id
            ||proposal.turnId!==turnId||proposal.attemptId!==attemptId)fail('INPUT_MATERIAL_INJECTION_ACTIVATION_CHANGED')
          return {entryId:entry.entryId,rawEntrySha256:entry.rawEntrySha256}
        })
        return {contributions:texts.map(row=>({identity:row.key,text:row.text,textSha256:row.textSha256})),activationProposals}
      }})
      // The input owner closes the actual asynchronous producer calls. The
      // protected runtime admits template assets at its own worker boundary.
      const lorePreparationOwner=Object.freeze({tokenCount,templates:loreProducer,assertCurrent:render.assertCurrent})
      const evaluated=await prepareOwnedTavernLoreWithOwnerV1({schemaVersion:1,encoding:'owned-st-lore-evaluator-input-v1',
        compilation,snapshot:frozenSnapshot},lorePreparationOwner)
      assertCurrent()
      if(evaluated.kind!=='prepared')fail(evaluated.diagnostics[0]?.code??'INPUT_MATERIAL_LORE_REFUSED')
      const outlets=[...new Set(evaluated.plan.placements.filter(row=>row.position==='named-outlet').map(row=>row.outletName))]
        .map(name=>({name,text:evaluated.plan.placements.filter(row=>row.position==='named-outlet'&&row.outletName===name)
          .map(row=>row.text).join('\n'),versionSha256:evaluated.plan.planSha256}))
      const finalMacros=macrosFor(bindings,outlets),finalLore=await render.finalLore(evaluated.plan.placements,finalMacros)
      const finalById=new Map(finalLore.map(row=>[row.entryId,row])),authorMacros=macrosFor(bindings,outlets.map(outlet=>({
        ...outlet,text:evaluated.plan.placements.filter(row=>row.position==='named-outlet'&&row.outletName===outlet.name)
          .map(row=>finalById.get(row.entryId)!.text).filter(Boolean).join('\n'),
        versionSha256:recordSha256({planSha256:evaluated.plan.planSha256,finalLore})})))
      // The fixed host consumes in-chat extension prompts before its final
      // author EJS pass. Capture this cut once: late persistent registrations
      // belong to the following generation and late once still closes here.
      const injectedChat=await injections.consume('chat',render.snapshot)
      const injectedTexts=await render.transformInjectionContent(injectedChat.prompts.map(row=>({key:row.registrationSha256,
        content:row.prompt.content,depth:row.prompt.depth,role:row.prompt.role})),authorMacros)
      if(injectedChat.activationProposals.length)fail('INPUT_MATERIAL_POST_LORE_INJECTION_ACTIVATION_REQUIRES_FEEDBACK')
      // These calls share an ordered execution journal; serial invocation keeps
      // each source pointer, macro receipt and standalone output unambiguous.
      const author=[]
      author.push(await render.render('/native/current-author/cards',residual.cardsText,
        {macros:authorMacros,placement:1,phase:'late-author'}))
      author.push(await render.render('/native/current-author/rules',residual.rulesText,
        {macros:authorMacros,placement:1,phase:'late-author'}))
      author.push(await render.render('/native/current-author/examples',residual.examplesText,
        {macros:authorMacros,placement:1,phase:'late-author'}))
      if(author.some(row=>row.activationProposals.length))fail('INPUT_MATERIAL_LATE_AUTHOR_ACTIVATION_UNSUPPORTED')
      const injectionTransaction=injections.transaction()
      assertCurrent()
      const layout=produceRoleplayTavernLayoutV1({native,original,residual,evaluation:evaluated.plan,finalLore,
        phaseASnapshot:snapshot.contextMessageRefs,renderedAuthor:{cardsText:author[0]!.renderedText,
          rulesText:author[1]!.renderedText,examplesText:author[2]!.renderedText},injected:injectedChat.prompts.map((row,index)=>({
            contributionRef:`inject-${row.registrationSha256}`,sourceSha256:sha256(row.prompt.content),
            requestedRole:row.prompt.role,requestedDepth:row.prompt.depth,renderedText:injectedTexts[index]!.text,
            renderedSha256:injectedTexts[index]!.textSha256}))})
      const semanticStory=storyRows.map(row=>({id:row.id,role:row.role,messageSha256:row.messageSha256})),
        semanticStoryIds=new Set(semanticStory.map(row=>row.id)),semanticStorySha256=recordSha256(semanticStory)
      const {source:_editSource,...editData}=captured.edits,
        {source:_variableSource,...variableInput}=variables.input
      return {kind:'prepared-data' as const,...layout,
        snapshot:freeze({schemaVersion:1,encoding:'native-tavern-prompt-capture-v1',authority:'consumer-data-only',
          policy,source,...authorPrompt?{authorPrompt}:{},
          authorPolicy,authorPolicySha256,
          edits:{...editData,sourceRef:{sourceSha256:source.sourceSha256}},
          initialCatalogReceipt:initialCatalog.receipt,
          variablesInput:{...variableInput,sourceRef:{sourceSha256:source.sourceSha256}},variables:variables.packet,
          scopes:scopeData.evidence,timed:timed.evidence,canonicalChatClock:chatClock.data,
          originalAuthor:original,residualAuthor:residual,
          injections:injectionTransaction,injectionAudit:injections.audit(),
          tavernEvaluationInput:evaluated.input,render:render.audit(),initialNativeSelected:native.selected,
          ...opening?{openingPreparation:{snapshotRef:opening.snapshotRef,ownedBranchRefs:opening.ownedBranchRefs,scopeFacts:opening.scopes.data,
            attempt:opening.attempt}}:{phaseASnapshotRef:player!.currency.snapshot}}),
        plan:freeze({schemaVersion:1,encoding:'native-tavern-prompt-plan-v1',authority:'consumer-data-only',
          policySha256:recordSha256(policy),tavernEvaluationPlan:evaluated.plan,
          finalLore,layout:layout.layout,variablePacketSha256:variables.packet.packetSha256,
          ...authorPrompt?{authorPromptOutputSha256:authorPrompt.output.outputSha256}:{},
          injectionTransactionSha256:injectionTransaction.transactionSha256}),assertCurrent,release:inputCapture.release,
        assertSelected(selected:NativeMaterialSelectedBaseV1,firstAttempt:boolean) {
          // Only the original callback object is accepted during preparation,
          // before Native registers its private lineage. All later objects must
          // carry that real lineage; copied snapshots cannot pass this check.
          if(selected===native.selected) {
            if(!firstAttempt||nativeInputSha256(selected)!==initialSelectedSha256)
              fail('INPUT_MATERIAL_INITIAL_SELECTION_CHANGED')
          }else assertNativeRequestMaterialSelectionV1(native.selected,selected)
          const actual=selected.messages.filter(row=>semanticStoryIds.has(row.id))
            .map(row=>({id:row.id,role:row.role,messageSha256:row.messageSha256}))
          if(recordSha256(actual)!==semanticStorySha256)fail('INPUT_MATERIAL_STORY_SELECTION_CHANGED')
        }}
      }catch(error) {inputCapture.release();throw error}
    },scope.signal)
  }
  return {sectionNames:TAVERN_NATIVE_OWNED_SECTION_NAMES_V1,
    prepare:(native,scope)=>prepare(native,{kind:'player',scope}),
    prepareOpening:(native,scope)=>prepare(native,{kind:'program-opening',scope,native})}
}
