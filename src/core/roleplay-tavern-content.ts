/** Captured content preparation is shared by Main and explicit author dialogue.
 * This owner computes variables, templates and selected lore. Its caller owns
 * injection publication, Native layout, timing writes and provider permission. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {readTavernCardMacroFields} from './nexttavern-card.js'
import {captureRoleplayTavernInitialCatalogV1} from './roleplay-tavern-prompt-initial.js'
import {prepareRoleplayTavernPromptVariablesV1} from './roleplay-tavern-prompt-variables.js'
import {prepareRoleplayTavernRenderCatalogV1} from './roleplay-tavern-prompt-render.js'
import {createRoleplayTavernTokenCountV1} from './roleplay-tavern-token-count.js'
import {prepareOwnedTavernLoreWithOwnerV1} from './tavern-lore-evaluator.mjs'
import {validateTavernLoreSnapshotV1} from './tavern-lore-snapshot.mjs'
import type {captureRoleplayTavernPromptSourceDataV1} from './roleplay-tavern-prompt-source.js'
import type {captureRoleplayTavernPromptScopesV1} from './roleplay-tavern-prompt-scopes.js'
import type {TavernTemplateScopeBindingV1} from './tavern-template-types.mjs'
import type {TavernPromptVariableAttemptV1,TavernPromptVariableRefV1,TavernPromptVariableReadV1}
  from './roleplay-tavern-prompt-variables-types.js'
import type {TavernLoreFrozenSnapshotV1,TavernLoreTemplateProducerV1,TavernLoreVisibleMessageV1,
  TavernLoreBranchTimedInputV1,TavernLoreFrozenSettingsV1} from './tavern-lore-evaluator-types.mjs'
import type {TavernPromptMacroSnapshotV1} from './tavern-prompt-transform-types.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

/** Native has no ST global settings store. Archived character-book settings
 * remain importer metadata; absent session overrides use this content policy. */
export const TAVERN_NATIVE_PROMPT_SETTINGS_V1:Readonly<TavernLoreFrozenSettingsV1>=Object.freeze({
  policy:'owned-st-single-book-scan-feedback-v1',provenance:'explicit-native-fallback-v1',
  caseSensitive:false,matchWholeWords:false,scanDepth:2,useGroupScoring:false,recursiveScanning:true,
  minimumActivations:0,minimumActivationDepthMax:0,maxRecursionSteps:32,includeNames:true,
  characterStrategy:'single-character-book-v1',budgetTokens:2048,
  contentTransformPolicy:'no-world-info-output-regex-v1',macroPolicy:'frozen-rendered-receipt-or-marker-free-v1',
  seedPolicy:'sha256-counter-domain-separated-v1',budgetPolicy:'frozen-cumulative-token-ledger-st-gte-v1'})

type Render=Awaited<ReturnType<typeof prepareRoleplayTavernRenderCatalogV1>>
type SourceData=Exclude<ReturnType<typeof captureRoleplayTavernPromptSourceDataV1>,{kind:'outside-declared-domain'}>
/** The settings owner admits the value; Source has already captured that row.
 * Both consumers freeze the same effective budget without reading live state. */
export function resolveCapturedTavernPromptSettingsV1(source:SourceData['source']):Readonly<TavernLoreFrozenSettingsV1> {
  const row=source.current.rows.find(row=>row.ref.table==='branch'&&row.ref.key===
    `${source.sessionId}__settings`),budget=row?.value?.worldbookBudgetTokens as number|null|undefined
  return budget==null?TAVERN_NATIVE_PROMPT_SETTINGS_V1:
    {...TAVERN_NATIVE_PROMPT_SETTINGS_V1,provenance:'actual-runtime-settings',budgetTokens:budget}
}
type ScopeData=ReturnType<typeof captureRoleplayTavernPromptScopesV1>
type RenderInput=Parameters<typeof prepareRoleplayTavernRenderCatalogV1>[0]
/** A caller with an additional captured evaluation domain supplies both
 * execution operations from that same domain. Original Source uses the
 * existing renderer and two-argument evaluator directly. */
export interface TavernContentExecutionV1 {
  render(input:RenderInput):ReturnType<typeof prepareRoleplayTavernRenderCatalogV1>
  evaluate(input:Parameters<typeof prepareOwnedTavernLoreWithOwnerV1>[0],
    owner:Parameters<typeof prepareOwnedTavernLoreWithOwnerV1>[1]):ReturnType<typeof prepareOwnedTavernLoreWithOwnerV1>
}
export function produceTavernPromptVariableRefV1(ownerId:string,versionSha256:string,
  ref:Record<string,unknown>):TavernPromptVariableRefV1 {
  const data=cloneRoleplayTavernLoreDataV1(ref,65_536,{nodes:4096,depth:16}) as MvuJsonObject
  return {ownerId,versionSha256,ref:data,refSha256:recordSha256(data)}
}
interface Dependencies {
  readonly captured:SourceData
  readonly scopeData:Pick<ScopeData,'scopes'|'history'|'evidence'|'stateSnapshotSha256'>&{
    readonly bindings:readonly TavernTemplateScopeBindingV1[]
  }
  readonly attempt:TavernPromptVariableAttemptV1
  readonly timed:TavernLoreBranchTimedInputV1
  readonly visibleMessages:readonly TavernLoreVisibleMessageV1[]
  readonly settings:Readonly<TavernLoreFrozenSettingsV1>
  readonly currentCardFields?:Readonly<Record<'description'|'personality'|'scenario'|'persona',string>>
  readonly renderInput:RenderInput
  readonly execution?:TavernContentExecutionV1
  macrosFor(scopes:readonly TavernTemplateScopeBindingV1[],
    outlets?:readonly {name:string;text:string;versionSha256:string}[]):TavernPromptMacroSnapshotV1
  /** Main supplies its registry scan consumer. Readonly dialogue omits it;
   * the renderer then rejects any effects requiring a publication owner. */
  loreProducer?(render:Render,bindings:readonly TavernTemplateScopeBindingV1[]):TavernLoreTemplateProducerV1
}
function fail(code:string):never {throw Error(code)}
export async function prepareRoleplayTavernContentV1(deps:Dependencies) {
  const {captured,scopeData,attempt,timed,settings,renderInput}=deps,
    {source,compilation}=captured,{basis,signal}=renderInput
  const assertCurrent=renderInput.assertCurrent
  const assertSignal=()=>signal.throwIfAborted()
  const render=await (deps.execution?.render??prepareRoleplayTavernRenderCatalogV1)({...renderInput,assertCurrent})
  assertCurrent()
  const initialCatalog=captureRoleplayTavernInitialCatalogV1({source,plan:compilation.plan,
    assertCurrent:assertSignal,signal})
  const variables=await prepareRoleplayTavernPromptVariablesV1({schemaVersion:1,
    encoding:'owned-prompt-variable-input-v1',sessionId:source.sessionId,source,catalog:initialCatalog.catalog,
    scopes:scopeData.scopes,history:scopeData.history,attempt},{signal,assertCurrent,
    async renderInitial(request) {
      assertCurrent()
      const bindings=[...request.readonlyScopes,request.initialSoFar]
      const actual=await render.renderWithEvidence(request.entry.contentPointer,request.body,
        {entryId:request.entry.entryId,scopes:bindings,macros:deps.macrosFor(bindings),phase:'initial'})
      assertCurrent()
      const evidenceSha256=recordSha256(actual.evidence),ref=produceTavernPromptVariableRefV1,
        renderRef=ref(`${source.sessionId}:initial-render`,evidenceSha256,{
          schemaVersion:1,encoding:'native-initial-render-execution-ref-v1',requestSha256:request.requestSha256,
          executionSha256:evidenceSha256,featureRegexPolicy:initialCatalog.policySha256,
          sourceSha256:source.sourceSha256,scopeBindingsSha256:recordSha256(bindings)})
      const reads:TavernPromptVariableReadV1[]=[
        {kind:'source',identity:'actual-current-source',valueSha256:source.sourceSha256,
          provenance:ref(`${source.sessionId}:initial-source`,source.sourceSha256,{
            sourceSha256:source.sourceSha256,catalogSha256:initialCatalog.catalog.catalogSha256})},
        {kind:'scope',identity:'actual-render-scope-bindings',valueSha256:recordSha256(bindings),
          provenance:ref(`${source.sessionId}:initial-scope-bindings`,recordSha256(bindings),{
            scopeBindingsSha256:recordSha256(bindings),executionSha256:evidenceSha256,
            scopeFactsSha256:recordSha256(scopeData.evidence)})},
        {kind:'render',identity:'actual-macro-feature-regex-and-template-execution',valueSha256:evidenceSha256,
          provenance:renderRef}]
      return {schemaVersion:1,encoding:'owned-prompt-initial-render-output-v1',
        pipeline:'actual-macro-template-regex-ejs-v1',requestSha256:request.requestSha256,
        renderedText:actual.output.renderedText,renderedTextSha256:actual.output.renderedTextSha256,reads,renderRef}
    }})
  assertCurrent()
  if(variables.kind!=='prepared')fail(variables.diagnostics[0]?.code??'INPUT_MATERIAL_VARIABLES_REFUSED')
  const bindings=[...scopeData.bindings,...[variables.packet.initial,variables.packet.cache]
    .flatMap(value=>value.kind==='bound'?[value.binding]:[])]
  render.bindVariableScopes(bindings)
  const tokenCount=createRoleplayTavernTokenCountV1(assertSignal,signal),card=captured.cardData,
    text=(value:unknown)=>typeof value==='string'?value:'',
    aliases=readTavernCardMacroFields(card,source.original.decodedFormat),macros=renderInput.macros,
    globalScanData={personaDescription:macros.card?.find(value=>value.key==='persona')?.value??'',
      characterDescription:deps.currentCardFields?.description??text(aliases.description),
      characterPersonality:deps.currentCardFields?.personality??text(aliases.personality),
      characterDepthPrompt:macros.card?.find(value=>value.key==='charDepthPrompt')?.value??'',
      scenario:deps.currentCardFields?.scenario??text(aliases.scenario),creatorNotes:text(card.creator_notes)}
  const emptyCounts={schemaVersion:1 as const,encoding:'owned-frozen-token-count-ledger-v1' as const,
    identity:tokenCount.identity,implementationSha256:tokenCount.implementationSha256,method:tokenCount.method,counts:[]}
  const body:Omit<TavernLoreFrozenSnapshotV1,'snapshotSha256'>={schemaVersion:1,
    encoding:'owned-st-lore-frozen-snapshot-v1',authority:'consumer-data-only',sessionId:source.sessionId,
    branchId:source.sessionId,revision:timed.revision,turnId:basis.turnId,attemptId:basis.attemptId,
    sourceSnapshotSha256:source.sourceSha256,stateSnapshotSha256:scopeData.stateSnapshotSha256,
    sourceReferenceSha256:compilation.plan.sourceReferenceSha256,packageSha256:basis.packageSha256,
    compilerPlanSha256:compilation.plan.planSha256,visibleMessages:deps.visibleMessages,
    messagesSha256:recordSha256(deps.visibleMessages),settings,settingsSha256:recordSha256(settings),
    seed:basis.randomSeed,seedSha256:sha256(basis.randomSeed),globalScanData,globalScanDataSha256:recordSha256(globalScanData),
    timed,timedSha256:recordSha256(timed),tokenizer:emptyCounts,tokenizerSha256:recordSha256(emptyCounts),
    renderedTexts:[],renderedTextsSha256:recordSha256([])}
  const snapshot=validateTavernLoreSnapshotV1({...body,snapshotSha256:recordSha256(body)}),
    producer=deps.loreProducer?.(render,bindings)??render.loreProducer,
    evaluated=await (deps.execution?.evaluate??prepareOwnedTavernLoreWithOwnerV1)({schemaVersion:1,
      encoding:'owned-st-lore-evaluator-input-v1',compilation,snapshot},
      {tokenCount,templates:producer,assertCurrent:render.assertCurrent})
  assertCurrent()
  if(evaluated.kind!=='prepared')fail(evaluated.diagnostics[0]?.code??'INPUT_MATERIAL_LORE_REFUSED')
  const outlets=[...new Set(evaluated.plan.placements.filter(row=>row.position==='named-outlet').map(row=>row.outletName))]
    .map(name=>({name,text:evaluated.plan.placements.filter(row=>row.position==='named-outlet'&&row.outletName===name)
      .map(row=>row.text).join('\n'),versionSha256:evaluated.plan.planSha256}))
  const finalLore=await render.finalLore(evaluated.plan.placements,deps.macrosFor(bindings,outlets)),
    finalById=new Map(finalLore.map(row=>[row.entryId,row])),
    authorMacros=deps.macrosFor(bindings,outlets.map(outlet=>({...outlet,
      text:evaluated.plan.placements.filter(row=>row.position==='named-outlet'&&row.outletName===outlet.name)
        .map(row=>finalById.get(row.entryId)!.text).filter(Boolean).join('\n'),
      versionSha256:recordSha256({planSha256:evaluated.plan.planSha256,finalLore})})))
  return {render,initialCatalog,variables,bindings,evaluated,finalLore,authorMacros}
}
