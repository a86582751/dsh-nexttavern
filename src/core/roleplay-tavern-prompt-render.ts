/** Owns the phase chain around the independent protected template runtime.
 * Macro/regex receipts retain raw text; guest output is rendered exactly once. */
import {recordSha256,sha256} from './roleplay-data.js'
import {createTavernSourceRenderCatalogV1,projectTavernSourceRenderLoreV1,projectTavernSourceRenderEntriesV1}
  from './tavern-source-render-catalog.mjs'
import type {TavernSourceRenderCatalogV1} from './tavern-source-render-catalog.mjs'
import {applyTavernPromptTransformsV1,assertTavernPromptProjectionReadyV1} from './tavern-prompt-transform.mjs'
import {validateTemplateSnapshotV1} from './tavern-template-data.mjs'
import type {TavernLorePlanV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreEvaluationCompositionV1} from './tavern-lore-derived.mjs'
import type {TavernPromptMacroSnapshotV1,TavernPromptRegexRuleV1,TavernPromptProjectionV1,
  TavernPromptTransformEntryV1,TavernPromptTransformOutputV1} from './tavern-prompt-transform-types.mjs'
import type {TavernTemplateFrozenSnapshotV1,TavernTemplateScopeBindingV1,TavernTemplateReadV1,
  TavernTemplateActivationProposalV1} from './tavern-template-types.mjs'
import type {TavernLoreTemplateProducerV1,TavernLoreSelectedTemplateRequestV1} from './tavern-lore-evaluator-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernInjectionDefinitionV1} from './roleplay-tavern-injections.js'
import type {TavernEjsResource} from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsReplayRecord} from './tavern-template-ejs-replay.mjs'
import type {TavernEjsRuntimeIdentity} from './tavern-template-ejs-runtime-types.mjs'
import {hasTavernPromptMacroSyntaxV1} from './tavern-prompt-transform-execution.mjs'
import {ST_LORE_POSITION_V1,ST_LORE_ROLE_V1} from './tavern-lore-fixed-profile.mjs'
import type {TavernSourceRenderCatalogEntryV1} from './tavern-source-render-catalog.mjs'
import type {TavernGenerateLoaderPhaseV1,TavernGenerateLoaderCallV1,TavernGenerateLoaderEntryResultV1}
  from './roleplay-tavern-generate-loader.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import {sealTavernLoreOrdinaryPreparationV1} from './tavern-lore-ordinary-preparation.mjs'
import type {TavernLoreOrdinaryPreparationV1,TavernLoreOrdinaryFormalChangeV1,TavernLoreOrdinaryPreparedTextV1,
  TavernLoreOrdinaryExecutionEvidenceV1}
  from './tavern-lore-ordinary-preparation.mjs'
import type {createTavernLoreSourceEligibilityV1} from './tavern-lore-derived.mjs'

export const TAVERN_NATIVE_RENDER_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'native-tavern-template-phase-policy-v1',
  normalLore:'formal-clean; macro; selected-standalone-EJS; cumulative-budget; WORLD_INFO-prompt-regex',
  getwi:'complete-primary-clean-source-regex-catalog; captured-early-regex-cut; current-macro-on-read; nested-EJS-in-same-realm',
  ordinaryFormal:'reverse-Source-conditions-and-preprocessing; each-own-key; selected-private-IIFE; actual-staged-source-regex-cut',
  catalogLookup:'fixed-template-depth-desc-order-asc-uid-desc; stable-source-ties; native-AN-in-chat-adaptation',
  selectedOnly:'no-eager-standalone-guest-renders-for-unselected-entries',
  output:'complete-bounded-guest-result-before-consumption; literal-output-markers-inert',
  generateLoaders:'formal-buckets; selected-subset-depth; condition-previous-context; macro-worldinfo-regex-EJS; native-transport-index',
  scope:'explicit-frozen-owner-bindings; unavailable-default-refuses-on-read',
  cache:'invocation-output-never-replaces-another-entry-standalone-receipt'})
export const TAVERN_NATIVE_RENDER_POLICY_SHA256=recordSha256(TAVERN_NATIVE_RENDER_POLICY_V1)
type SnapshotBasis=Pick<TavernTemplateFrozenSnapshotV1,'sessionId'|'branchId'|'revision'|'turnId'|'attemptId'
  |'packageSha256'|'sourceSnapshotSha256'|'stateSnapshotSha256'|'clockEpochMs'|'randomSeed'>
export interface TavernPromptRenderResultV1 {
  readonly renderedText:string
  readonly renderedTextSha256:string
  readonly activationProposals:readonly TavernTemplateActivationProposalV1[]
  readonly readDependencies:readonly TavernTemplateReadV1[]
}
export interface TavernPromptEjsExecutionV1 {
  readonly snapshot:TavernTemplateFrozenSnapshotV1
  readonly resource:TavernEjsResource
  readonly definition:TavernInjectionDefinitionV1
  readonly phase:'initial'|'lore-selected'|'late-author'|'generate-final'|'ordinary-condition'|'ordinary-preprocess'
    |TavernGenerateLoaderPhaseV1
  readonly macros:TavernPromptMacroSnapshotV1
  readonly context?:Readonly<Record<string,unknown>>
}
interface Dependencies {
  readonly source:TavernLoreSourceDataV1
  readonly plan:TavernLorePlanV1
  readonly sourceCatalog?:TavernSourceRenderCatalogV1
  readonly evaluationComposition?:TavernLoreEvaluationCompositionV1
  readonly macros:TavernPromptMacroSnapshotV1
  readonly rules:readonly TavernPromptRegexRuleV1[]
  readonly scriptOrder?:readonly ('global'|'preset'|'scoped')[]
  readonly scopes:readonly TavernTemplateScopeBindingV1[]
  readonly basis:SnapshotBasis
  /** Exact initial selected note distance captured by Core, not a guessed
   * tail position. Native resolves actual insertion anchors separately. */
  readonly authorsNoteDepth:number
  readonly assertCurrent:()=>void
  readonly signal:AbortSignal
  /** Core owns capture, retained programs, registry acceptance and writes. */
  readonly ejs:{
    readonly identity:TavernEjsRuntimeIdentity
    /** The owner supplies this phase's staged ordinary values. Equal base and
     * staged state retain the same snapshot identity for key projection reuse. */
    macros(base:TavernPromptMacroSnapshotV1):TavernPromptMacroSnapshotV1
    execute(input:TavernPromptEjsExecutionV1):Promise<TavernEjsReplayRecord>
  }
  readonly definitionFor:(pointer:string,entryId:string|undefined)=>TavernInjectionDefinitionV1
  readonly dynamicRegex?:{
    hasBasic():boolean
    apply(phase:'basic-prompt'|'generate',snapshot:TavernTemplateFrozenSnapshotV1,
      rows:readonly {id:string;text:string;role?:'user'|'assistant'|'system';depth?:number;worldinfo?:boolean;
        env?:Readonly<MvuJsonObject>}[])
      :Promise<readonly {id:string;text:string}[]>
  }
}
function fail(code:string):never {throw Error(code)}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}
  return value
}
type RenderExecution={
  readonly ordinaryField?:{readonly phaseId:string;readonly entryId:string;readonly field:string}
  readonly macroProjectionSha256?:string
  readonly conditionResult?:{readonly passed:boolean;readonly outputSha256:string}
}&({readonly kind:'program-literal';readonly resource:Omit<TavernEjsResource,'text'>;readonly snapshotSha256:string}
  |{readonly kind:'protected-ejs-runtime';readonly record:TavernEjsReplayRecord})
export async function prepareRoleplayTavernRenderCatalogV1(deps:Dependencies) {
  const {source,plan,basis,signal}=deps,transforms:unknown[]=[],executions:RenderExecution[]=[],scopeSets:unknown[]=[]
  const scopeSetIds=new Set<string>()
  // Pure catalog work uses captured DATA. The owner closes real awaits and
  // callbacks; the independent runtime admits its worker at execution gates.
  const checkpoint=()=>signal.throwIfAborted()
  const ownerCheckpoint=()=>{checkpoint();deps.assertCurrent()}
  ownerCheckpoint()
  if(basis.sessionId!==source.sessionId||basis.branchId!==source.sessionId
    ||basis.sourceSnapshotSha256!==source.sourceSha256||plan.source.sourceSnapshotSha256!==source.sourceSha256
    ||!Number.isSafeInteger(deps.authorsNoteDepth)||deps.authorsNoteDepth<0)fail('INPUT_MATERIAL_RENDER_SOURCE_CHANGED')
  const sourceCatalog=deps.sourceCatalog??createTavernSourceRenderCatalogV1({source,plan})
  const currentMacros=(base=deps.macros)=>deps.ejs.macros(base)
  const transform=async(rows:readonly TavernPromptTransformEntryV1[],macros=currentMacros(),
    rules:readonly TavernPromptRegexRuleV1[]=deps.rules)=>{
    ownerCheckpoint()
    const result=await applyTavernPromptTransformsV1({schemaVersion:1,encoding:'owned-tavern-prompt-transform-v1',
      authority:'consumer-data-only',sourceSnapshotSha256:source.sourceSha256,regexDisabled:false,
      macros,rules,entries:rows,...deps.scriptOrder?{scriptOrder:deps.scriptOrder}:{}},{assertCurrent:checkpoint,signal})
    ownerCheckpoint()
    if(result.kind!=='transformed')fail(result.diagnostics[0]?.code??'INPUT_MATERIAL_PROMPT_TRANSFORM_REFUSED')
    const {entries:fullEntries,...metadata}=result.output
    // Original text is in the captured Source/author fields. Keep each exact
    // consumed/output hash and one transformed text, instead of archiving the
    // entire raw/story/input strings again for every phase.
    transforms.push({...metadata,entries:fullEntries.map(({rawText:_raw,storyText:_story,inputText:_input,...entry})=>entry)})
    return result.output
  }
  const row=(key:string,pointer:string,text:string,pipeline:TavernPromptTransformEntryV1['pipeline'],
    channel:TavernPromptTransformEntryV1['channel'],required:boolean,entryId:string|null,
    placement:TavernPromptTransformEntryV1['placement']=5,depth:number|null=null):TavernPromptTransformEntryV1=>
    ({key,bookId:entryId&&!pointer.startsWith('derived:')?plan.bookId:null,entryId,
      sourcePointer:pointer,sourceSnapshotSha256:source.sourceSha256,
      rawText:text,storyText:'',inputText:text,pipeline,channel,placement,depth,isEdit:false,
      characterOverride:null,required})
  const evaluationComposition:TavernLoreEvaluationCompositionV1=deps.evaluationComposition
      ??Object.freeze({sourcePlan:plan,entries:plan.entries,planSha256:plan.planSha256}),sourceMacros=currentMacros(),
    {lore,byEntryId:sourceProjections}=await projectTavernSourceRenderLoreV1({catalog:sourceCatalog,
      authorsNoteDepth:deps.authorsNoteDepth,macros:sourceMacros,evaluationComposition,transform})
  const snapshotBody={schemaVersion:1 as const,encoding:'owned-template-frozen-snapshot-v1' as const,
    authority:'consumer-data-only' as const,...basis,defaultVariableScope:'cache' as const,scopes:deps.scopes,
    scopesSha256:recordSha256(deps.scopes),lore,loreSha256:recordSha256(lore),randomSeedSha256:sha256(basis.randomSeed)}
  let snapshot=validateTemplateSnapshotV1({...snapshotBody,snapshotSha256:recordSha256(snapshotBody)})
  let variablesBound=false,standaloneStarted=false
  let ordinaryPreparation:TavernLoreOrdinaryPreparationV1|undefined
  const ordinaryChanges=new Map<string,TavernLoreOrdinaryFormalChangeV1>()
  const executeResource=async(resource:TavernEjsResource,actualSnapshot:TavernTemplateFrozenSnapshotV1,
    macros:TavernPromptMacroSnapshotV1,definition:()=>TavernInjectionDefinitionV1,
    phase:TavernPromptEjsExecutionV1['phase']|undefined,context:Readonly<Record<string,unknown>>|undefined,
    evidence:{readonly macroProjectionSha256?:string;readonly ordinaryField?:{
      readonly phaseId:string;readonly entryId:string;readonly field:string};readonly generateLoader?:{
      readonly phase:TavernGenerateLoaderPhaseV1;readonly callId:string;readonly entryId:string;readonly step:'condition'|'body'}})
    :Promise<TavernPromptRenderResultV1>=>{
    if(!resource.text.includes('<%')) {
      const literal={renderedText:resource.text,renderedTextSha256:resource.contentSha256,
        activationProposals:[],readDependencies:[],nestedRenders:[]}
      const {text:_text,...resourceRef}=resource
      executions.push(freeze({kind:'program-literal',resource:resourceRef,snapshotSha256:actualSnapshot.snapshotSha256,
        ...evidence,...literal}))
      checkpoint();return literal
    }
    if(!phase)fail('INPUT_MATERIAL_INJECTION_PHASE_UNPROVEN')
    ownerCheckpoint()
    const record=await deps.ejs.execute({snapshot:actualSnapshot,resource,macros,definition:definition(),phase,
      ...context?{context}:{}})
    ownerCheckpoint()
    if(record.creation.kind!=='rendered')fail(record.creation.diagnostic.code)
    const output=record.creation.output,renderedTextSha256=sha256(output.renderedText)
    executions.push(freeze({kind:'protected-ejs-runtime',record,...evidence,
      ...evidence.ordinaryField?.field==='condition'?{conditionResult:{
        passed:output.renderedText!=='false',outputSha256:renderedTextSha256}}:{}}))
    return {renderedText:output.renderedText,renderedTextSha256,
      activationProposals:output.activations,readDependencies:output.reads}
  }
  const render=async(pointer:string,text:string,options:{entryId?:string;placement?:1|2|5;
    macros?:TavernPromptMacroSnapshotV1;scopes?:readonly TavernTemplateScopeBindingV1[];
    resourceId?:string;ordinaryField?:{phaseId:string;entryId:string;field:string};
    phase?:'initial'|'lore-selected'|'late-author'|'ordinary-preprocess'}={}):Promise<TavernPromptRenderResultV1>=>{
    const macros=currentMacros(options.macros),
      projection=(await transform([row(`render-${executions.length}`,pointer,text,'macro-only','source',true,
        options.entryId??null,options.placement??5)],macros,[])).entries[0]!
    assertTavernPromptProjectionReadyV1(projection)
    let actualSnapshot=snapshot
    if(options.scopes){const {snapshotSha256:_sha,...body}=snapshot,
      changed={...body,scopes:options.scopes,scopesSha256:recordSha256(options.scopes)}
      actualSnapshot=validateTemplateSnapshotV1({...changed,snapshotSha256:recordSha256(changed)})}
    let inputText=projection.outputText
    if(deps.dynamicRegex&&options.phase!=='late-author') {
      // Normal WI evaluation uses generate selection without the loader-only
      // worldinfo flag. Explicit render/generate loaders are separate phases.
      const result=await deps.dynamicRegex.apply('generate',actualSnapshot,[{id:pointer,text:inputText}])
      inputText=result[0]!.text
    }
    const resource:TavernEjsResource={id:options.resourceId??pointer,sourcePointer:pointer,sourceSnapshotSha256:source.sourceSha256,
      contentSha256:inputText===projection.outputText?projection.outputSha256:sha256(inputText),text:inputText}
    const scopeSha=actualSnapshot.scopesSha256
    if(scopeSha!==snapshot.scopesSha256&&!scopeSetIds.has(scopeSha)) {
      scopeSetIds.add(scopeSha);scopeSets.push({scopes:actualSnapshot.scopes,scopesSha256:scopeSha,
        snapshotSha256:actualSnapshot.snapshotSha256})
    }
    return executeResource(resource,actualSnapshot,macros,()=>deps.definitionFor(pointer,options.entryId),
      options.phase,undefined,{macroProjectionSha256:projection.projectionSha256,
        ...options.ordinaryField?{ordinaryField:options.ordinaryField}:{}})
  }
  const engine=deps.ejs.identity
  const identity=`${engine.packageName}@${engine.version}`,
    implementationSha256=recordSha256({engine,
      policy:TAVERN_NATIVE_RENDER_POLICY_SHA256,macroPolicy:deps.macros.sourceSnapshotSha256})
  const keyProjections=new Map<string,Pick<TavernPromptProjectionV1,'outputText'|'outputSha256'>>()
  let keyMacros:TavernPromptMacroSnapshotV1|undefined,macroSnapshotSha256:string|undefined
  const renderKey=async(request:{entryId:string;pointer:string;text:string},baseMacros?:TavernPromptMacroSnapshotV1)=>{
      ownerCheckpoint()
      const macros=currentMacros(baseMacros)
      if(keyMacros!==macros) {
        keyMacros=macros;keyProjections.clear();macroSnapshotSha256=undefined
      }
      let projection=keyProjections.get(request.text)
      if(!projection) {
        const rendered=(await transform([row(`key-${request.pointer}`,request.pointer,request.text,
          'macro-only','source',true,request.entryId)],macros,[])).entries[0]!
        assertTavernPromptProjectionReadyV1(rendered)
        projection={outputText:rendered.outputText,outputSha256:rendered.outputSha256}
        keyProjections.set(request.text,projection)
      }
      macroSnapshotSha256??=recordSha256(macros)
      return {pointer:request.pointer,rawContentSha256:sha256(request.text),renderedText:projection.outputText,
        renderedSha256:projection.outputSha256,rendererIdentity:identity,rendererImplementationSha256:implementationSha256,
        readDependencies:[{kind:'source' as const,identity:'actual-tavern-source',versionSha256:source.sourceSha256,
          valueSha256:source.sourceSha256},{kind:'state' as const,identity:'actual-frozen-macro-scopes',
          versionSha256:basis.stateSnapshotSha256,valueSha256:macroSnapshotSha256}]}
    }
  const loreProducer:TavernLoreTemplateProducerV1=Object.freeze({identity,implementationSha256,signal,
    renderKey:(request:Parameters<typeof renderKey>[0])=>renderKey(request),
    assertCurrent:checkpoint,async render(request:TavernLoreSelectedTemplateRequestV1) {
      standaloneStarted=true
      const row=sourceCatalog.entryById.get(request.entryId),entry=row?.entry,change=ordinaryChanges.get(request.entryId),
        program=change?.program,text=program?row!.formal.body:row?.resolved.text,
        contentSha256=program?.contentSha256??row?.resolved.contentSha256
      if(!entry||entry.rawEntrySha256!==request.rawEntrySha256||request.compilerPlanSha256!==plan.planSha256
        ||request.attemptId!==basis.attemptId||request.text!==text||request.rawContentSha256!==contentSha256)
        fail('INPUT_MATERIAL_TEMPLATE_SELECTION_CHANGED')
      const authorText=program?.private?'<% await (async()=>{%>'+request.text+'<%})(); %>':request.text,
        output=await render(entry.sourcePointer+'/content',authorText,{entryId:entry.entryId,phase:'lore-selected'})
      const activationProposals=output.activationProposals.map(proposal=>{
        const target=sourceCatalog.entryById.get(proposal.entryId)?.entry
        if(!target||proposal.sourceSnapshotSha256!==source.sourceSha256||proposal.branchId!==source.sessionId
          ||proposal.turnId!==basis.turnId||proposal.attemptId!==basis.attemptId)fail('INPUT_MATERIAL_ACTIVATION_CHANGED')
        return {entryId:target.entryId,rawEntrySha256:target.rawEntrySha256}
      })
      return {receipt:{pointer:request.pointer,rawContentSha256:request.rawContentSha256,
        renderedText:output.renderedText,renderedSha256:output.renderedTextSha256,rendererIdentity:identity,
        rendererImplementationSha256:implementationSha256,readDependencies:[
          {kind:'source' as const,identity:'actual-tavern-source',versionSha256:source.sourceSha256,valueSha256:source.sourceSha256},
          {kind:'state' as const,identity:'actual-frozen-template-scopes',versionSha256:basis.stateSnapshotSha256,
            valueSha256:snapshot.scopesSha256}]},activationProposals}
    }})
  return {get snapshot(){return snapshot},evaluationComposition,loreProducer,render,
    async prepareOrdinaryWorldInfo(input:{readonly phaseId:string;readonly baseMacros:TavernPromptMacroSnapshotV1;
      readonly sourceEligibility:ReturnType<typeof createTavernLoreSourceEligibilityV1>})
      :Promise<TavernLoreOrdinaryPreparationV1|undefined> {
      const changes:TavernLoreOrdinaryFormalChangeV1[]=[],activationProposals:TavernLoreOrdinaryPreparationV1['activationProposals'][number][]=[]
      const accept=(proposals:readonly TavernTemplateActivationProposalV1[])=>{
        for(const proposal of proposals){
          const entry=sourceCatalog.entryById.get(proposal.entryId)?.entry
          if(!entry||proposal.sourceSnapshotSha256!==source.sourceSha256||proposal.branchId!==source.sessionId
            ||proposal.turnId!==basis.turnId||proposal.attemptId!==basis.attemptId)fail('INPUT_MATERIAL_ACTIVATION_CHANGED')
          activationProposals.push({entryId:entry.entryId,rawEntrySha256:entry.rawEntrySha256})
        }
      }
      const field=async(entry:TavernSourceRenderCatalogEntryV1,name:string,pointer:string,text:string)
        :Promise<TavernLoreOrdinaryPreparedTextV1>=>{
        const executionIndex=executions.length,result=await render(pointer,text,{entryId:entry.entry.entryId,
          macros:input.baseMacros,phase:'ordinary-preprocess',resourceId:`${input.phaseId}:${entry.entry.entryId}:${name}`,
          ordinaryField:{phaseId:input.phaseId,entryId:entry.entry.entryId,field:name}})
        accept(result.activationProposals)
        return {text:result.renderedText,textSha256:result.renderedTextSha256,executionIndex}
      }
      for(let index=sourceCatalog.ordinaryFormalEntries.length-1;index>=0;index--){
        ownerCheckpoint()
        const row=sourceCatalog.ordinaryFormalEntries[index]!,{entry,formal,semantic}=row,enabled=formal.enabled,
          has=(name:string)=>formal.names.includes(name)
        if(evaluationComposition.suppressedOriginalEntryIds?.has(entry.entryId))continue
        const forced=has('@@activate')&&!has('@@dont_activate')
        if(!enabled&&!forced)continue
        if(!input.sourceEligibility(entry))fail('LORE_COMPILER_INPUT_INELIGIBLE')
        let condition:TavernLoreOrdinaryFormalChangeV1['condition']
        const conditional=formal.directives.find(directive=>directive.name==='@@if')
        if(enabled&&conditional){
          const text='<%- !!('+conditional.args+') %>',executionIndex=executions.length,
            resource:TavernEjsResource={id:`${input.phaseId}:${entry.entryId}:condition`,
              sourcePointer:row.resolved.pointer,sourceSnapshotSha256:source.sourceSha256,contentSha256:sha256(text),text},
            output=await executeResource(resource,snapshot,currentMacros(input.baseMacros),
              ()=>deps.definitionFor(row.resolved.pointer,entry.entryId),'ordinary-condition',undefined,
              {ordinaryField:{phaseId:input.phaseId,entryId:entry.entryId,field:'condition'}})
          condition={executionIndex};accept(output.activationProposals)
          if(output.renderedText==='false'){
            const change:TavernLoreOrdinaryFormalChangeV1={entryId:entry.entryId,ordinal:entry.ordinal,
              condition,admission:'condition-excluded'}
            changes.push(change);ordinaryChanges.set(entry.entryId,change);continue
          }
        }
        const early=sourceProjections.get(entry.entryId)!,preprocess=enabled
          &&(has('@@preprocessing')||String(row.raw.comment??'').includes('[Preprocessing]')),
          program={bodyOffset:formal.bodyOffset,contentSha256:early.inputSha256,
            private:enabled&&!preprocess&&has('@@private')}
        let preprocessed:TavernLoreOrdinaryFormalChangeV1['preprocessed']
        if(preprocess){
          const macros=currentMacros(input.baseMacros),projection=macros===sourceMacros?early:
            (await projectTavernSourceRenderEntriesV1({catalog:sourceCatalog,entries:[row],macros,transform})).get(entry.entryId)!
          assertTavernPromptProjectionReadyV1(projection)
          const body=await field(row,'body',row.resolved.pointer,projection.outputText),
            primaryKeys:TavernLoreOrdinaryPreparedTextV1[]=[],secondaryKeys:TavernLoreOrdinaryPreparedTextV1[]=[]
          for(const [key,text] of semantic.primaryKeys.entries())
            primaryKeys.push(await field(row,`primary-key:${key}`,`${entry.sourcePointer}/@primaryKeys/${key}`,text))
          for(const [key,text] of semantic.secondaryKeys.entries())
            secondaryKeys.push(await field(row,`secondary-key:${key}`,`${entry.sourcePointer}/@secondaryKeys/${key}`,text))
          preprocessed={body,primaryKeys,secondaryKeys}
        }
        const change:TavernLoreOrdinaryFormalChangeV1={entryId:entry.entryId,ordinal:entry.ordinal,
          ...condition?{condition}:{},...has('@@dont_activate')?{admission:'dont-activate' as const}:
            !semantic.enabled&&(enabled||forced)?{admission:'force-enabled' as const}:{},
          ...forced?{forceActivation:true as const}:{},program,...preprocessed?{preprocessed}:{}}
        changes.push(change);ordinaryChanges.set(entry.entryId,change)
      }
      ownerCheckpoint()
      ordinaryPreparation=changes.length?sealTavernLoreOrdinaryPreparationV1({schemaVersion:1,
        encoding:'owned-st-lore-ordinary-preparation-v1',sourceSnapshotSha256:source.sourceSha256,
        compilerPlanSha256:plan.planSha256,phaseId:input.phaseId,snapshotSha256:snapshot.snapshotSha256,
        changes,activationProposals}):undefined
      return ordinaryPreparation
    },
    ordinaryPreparationEvidence():TavernLoreOrdinaryExecutionEvidenceV1|undefined {
      if(!ordinaryPreparation)return
      type EvidenceExecution=TavernLoreOrdinaryExecutionEvidenceV1['executions'][number]
      const selected:EvidenceExecution[]=[],entries:TavernLoreOrdinaryExecutionEvidenceV1['entries'][number][]=[]
      let protectedRuntime=false
      const append=(executionIndex:number,output:EvidenceExecution['output'])=>{
        const actual=executions[executionIndex]!,record=actual.kind==='protected-ejs-runtime'?actual.record:undefined,
          resource=actual.kind==='protected-ejs-runtime'?actual.record.resource:actual.resource,
          result=record?.creation.kind==='rendered'?record.creation.output:undefined
        if(record)protectedRuntime=true
        selected.push(Object.freeze({executionIndex,kind:actual.kind,
          resource:Object.freeze({id:resource.id,sourcePointer:resource.sourcePointer,
            sourceSnapshotSha256:resource.sourceSnapshotSha256,contentSha256:resource.contentSha256}),
          snapshotSha256:actual.kind==='protected-ejs-runtime'?actual.record.capture.snapshot.snapshotSha256:
            actual.snapshotSha256,
          ...record?{engineIndex:0}:{},...actual.ordinaryField?{ordinaryField:actual.ordinaryField}:{},
          ...actual.macroProjectionSha256?{macroProjectionSha256:actual.macroProjectionSha256}:{},output,
          ...result?{reads:result.reads,resourceReads:result.resourceReads,ordinaryReadFacts:Object.freeze({
            ...result.ordinaryRoot?{ordinaryRoot:result.ordinaryRoot}:{},ordinaryReads:result.ordinaryReads,
            ordinaryReadAll:result.ordinaryReadAll,ordinaryMessageReads:result.ordinaryMessageReads})}:{}}))
      }
      // Only this prepass's actual indices are selected. Dialogue stores these
      // facts with its frozen prompt; it never restores a Source VM/capture.
      for(const change of ordinaryPreparation.changes){
        const row=sourceCatalog.entryById.get(change.entryId)!
        entries.push(Object.freeze({entryId:row.entry.entryId,ordinal:row.entry.ordinal,
          sourcePointer:row.entry.sourcePointer,rawEntrySha256:row.entry.rawEntrySha256,
          contentPointer:row.resolved.pointer,contentSha256:row.resolved.contentSha256}))
        if(change.condition){
          const index=change.condition.executionIndex
          append(index,Object.freeze({kind:'condition',...executions[index]!.conditionResult!}))
        }
        if(change.preprocessed){
          append(change.preprocessed.body.executionIndex,Object.freeze({kind:'prepared-text',
            entryId:change.entryId,field:'body'}))
          for(const field of ['primaryKeys','secondaryKeys'] as const)
            for(const [index,text] of change.preprocessed[field].entries())
              append(text.executionIndex,Object.freeze({kind:'prepared-text',entryId:change.entryId,field,index}))
        }
      }
      return Object.freeze({schemaVersion:1,encoding:'author-dialog-ordinary-preparation-evidence-v1',
        policySha256:TAVERN_NATIVE_RENDER_POLICY_SHA256,source:plan.source,preparation:ordinaryPreparation,
        entries:Object.freeze(entries),executions:Object.freeze(selected),
        engines:Object.freeze(protectedRuntime?[engine]:[])})
    },
    projectGenerateKey(entry:TavernSourceRenderCatalogEntryV1,field:'primaryKeys'|'secondaryKeys',index:number,text:string,
      baseMacros?:TavernPromptMacroSnapshotV1) {
      return hasTavernPromptMacroSyntaxV1(text)?renderKey({entryId:entry.entry.entryId,
        pointer:`${entry.entry.sourcePointer}/@${field}/${index}`,text},baseMacros).then(result=>result.renderedText):text
    },
    async renderGenerateLoaderEntry(entry:TavernSourceRenderCatalogEntryV1,call:TavernGenerateLoaderCallV1,
      baseMacros?:TavernPromptMacroSnapshotV1):Promise<TavernGenerateLoaderEntryResultV1> {
      const pointer=entry.resolved.pointer,entryId=entry.entry.entryId,macros=currentMacros(baseMacros),
        definition=()=>deps.definitionFor(pointer,entryId),
        evidence=(step:'condition'|'body')=>({phase:call.phase,callId:call.callId,entryId,step}),
        condition=entry.formal.directives.find(directive=>directive.name==='@@if')
      if(condition){
        const text='<%- !!('+condition.args+') %>',resource:TavernEjsResource={
          id:`${call.callId}:${entryId}:condition`,sourcePointer:pointer,sourceSnapshotSha256:source.sourceSha256,
          contentSha256:sha256(text),text},output=await executeResource(resource,snapshot,macros,definition,
            call.phase,call.previousContext,{generateLoader:evidence('condition')})
        if(output.activationProposals.length)fail('INPUT_MATERIAL_GENERATE_LOADER_ACTIVATION_UNSUPPORTED')
        if(output.renderedText==='false')return {renderedText:'',context:call.previousContext}
      }
      const projection=(await transform([row(`generate-loader-${executions.length}`,pointer,entry.formal.body,
        'macro-only','source',true,entryId)],currentMacros(baseMacros),[])).entries[0]!
      assertTavernPromptProjectionReadyV1(projection)
      let text=projection.outputText
      if(deps.dynamicRegex){
        const result=await deps.dynamicRegex.apply('generate',snapshot,[{
          id:`${call.callId}:${entryId}:body`,text,worldinfo:true,env:call.previousContext}])
        text=result[0]!.text
      }
      const semantic=entry.semantic,worldInfo={...entry.raw,...semantic,content:entry.formal.body,
        key:semantic.primaryKeys,keysecondary:semantic.secondaryKeys,disable:!semantic.enabled,
        position:ST_LORE_POSITION_V1.indexOf(semantic.position),role:ST_LORE_ROLE_V1.indexOf(semantic.role),world:sourceCatalog.world,
        ...Number.isFinite(entry.uid)?{uid:entry.uid}:{}},context:Readonly<MvuJsonObject>={...call.previousContext,
          // Raw Source and the semantic compiler already admit this JSON DTO.
          world_info:worldInfo as unknown as MvuJsonObject,generateBuffer:call.buffer()},resource:TavernEjsResource={
          id:`${call.callId}:${entryId}:body`,sourcePointer:pointer,sourceSnapshotSha256:source.sourceSha256,
          contentSha256:text===projection.outputText?projection.outputSha256:sha256(text),text},
        output=await executeResource(resource,snapshot,currentMacros(baseMacros),definition,call.phase,context,
          {macroProjectionSha256:projection.projectionSha256,generateLoader:evidence('body')})
      if(output.activationProposals.length)fail('INPUT_MATERIAL_GENERATE_LOADER_ACTIVATION_UNSUPPORTED')
      return {renderedText:output.renderedText,context}
    },
    async transformInjectionContent(rows:readonly {key:string;content:string;depth:number;role:'system'|'user'|'assistant'}[],
      macros=deps.macros) {
      const output=await transform(rows.map(item=>row(item.key,`/native/injection/${item.key}`,item.content,
        'macro-only','source',true,null,item.role==='user'?1:2,item.depth)),currentMacros(macros),[])
      return output.entries.map(item=>{assertTavernPromptProjectionReadyV1(item);return {key:item.key,
        text:item.outputText,textSha256:item.outputSha256,projectionSha256:item.projectionSha256}})
    },
    /** Prompt-only history regex runs on each text block. This preserves
     * Native images/reasoning and matches ST mes semantics for single-text
     * messages; it never adds a whole-message macro pass or source regex. */
    async transformHistoryContent(rows:readonly {key:string;text:string;role:'user'|'assistant';depth:number}[],
      macros=deps.macros) {
      if(!rows.length||!deps.dynamicRegex?.hasBasic()&&!deps.rules.some(rule=>rule.allowed&&!rule.disabled&&rule.promptOnly
        &&rule.placement.some(placement=>placement===1||placement===2)))return []
      const output=await transform(rows.map(item=>row(item.key,
        `/native/history/${item.key}`,item.text,'regex-only','prompt',true,null,
        item.role==='user'?1:2,item.depth)),currentMacros(macros))
      const result=output.entries.map(item=>{
        assertTavernPromptProjectionReadyV1(item)
        return {key:item.key,text:item.outputText}
      })
      if(!deps.dynamicRegex?.hasBasic())return result
      const changed=await deps.dynamicRegex.apply('basic-prompt',snapshot,result.map((item,index)=>({
        id:item.key,text:item.text,role:rows[index]!.role,depth:rows[index]!.depth})))
      return changed.map(item=>({key:item.id,text:item.text}))
    },
    /** InitialVariables runs against its explicit pre-initial scopes. Only
     * its completed readonly packet can become the default for later renders. */
    bindVariableScopes(scopes:readonly TavernTemplateScopeBindingV1[]) {
      checkpoint()
      if(variablesBound||standaloneStarted)fail('INPUT_MATERIAL_VARIABLE_PHASE_CHANGED')
      variablesBound=true
      scopeSets.push({scopes:snapshot.scopes,scopesSha256:snapshot.scopesSha256,
        snapshotSha256:snapshot.snapshotSha256})
      scopeSetIds.add(snapshot.scopesSha256)
      const {snapshotSha256:_old,...body}=snapshot
      const changed={...body,scopes,scopesSha256:recordSha256(scopes)}
      snapshot=validateTemplateSnapshotV1({...changed,snapshotSha256:recordSha256(changed)})
      checkpoint()
    },
    async renderWithEvidence(pointer:string,text:string,options:Parameters<typeof render>[2]={}) {
      const executionIndex=executions.length,transformIndex=transforms.length
      const output=await render(pointer,text,options)
      checkpoint()
      if(executions.length!==executionIndex+1)fail('INPUT_MATERIAL_RENDER_RECEIPT_AMBIGUOUS')
      return {output,evidence:freeze({schemaVersion:1,encoding:'native-tavern-single-render-receipt-v1',
        policySha256:TAVERN_NATIVE_RENDER_POLICY_SHA256,executionIndex,execution:executions[executionIndex],
        transforms:transforms.slice(transformIndex),scopeSets:[...scopeSets]})}
    },
    async finalLore(placements:readonly {entryId:string;sourcePointer:string;text:string;effectiveContentSha256:string;
      position?:string;depth?:number}[],
      macros=deps.macros) {
      if(!deps.rules.length) {
        ownerCheckpoint()
        // The evaluator owns the text/hash pair. With no regex rules there
        // is no transformation to execute or projection receipt to publish.
        if(!deps.dynamicRegex?.hasBasic())return placements.map(item=>({entryId:item.entryId,inputSha256:item.effectiveContentSha256,
          text:item.text,outputSha256:item.effectiveContentSha256}))
        const changed=await deps.dynamicRegex.apply('basic-prompt',snapshot,placements.map(item=>({
          id:item.entryId,text:item.text,worldinfo:true,
          ...item.position==='at-chat-depth'?{depth:item.depth??0}:{}})))
        return changed.map((item,index)=>({entryId:item.id,inputSha256:placements[index]!.effectiveContentSha256,
          text:item.text,outputSha256:item.text===placements[index]!.text?placements[index]!.effectiveContentSha256:sha256(item.text)}))
      }
      const output=await transform(placements.map(item=>row(`final-${item.entryId}`,item.sourcePointer,item.text,
        'regex-only','prompt',true,item.entryId,5,item.position==='at-chat-depth'?item.depth??null:null)),currentMacros(macros))
      const projected=output.entries.map((projection,index)=>{
        assertTavernPromptProjectionReadyV1(projection)
        return {entryId:placements[index]!.entryId,inputSha256:placements[index]!.effectiveContentSha256,
          text:projection.outputText,outputSha256:projection.outputSha256}
      })
      if(!deps.dynamicRegex?.hasBasic())return projected
      const changed=await deps.dynamicRegex.apply('basic-prompt',snapshot,projected.map((item,index)=>({
        id:item.entryId,text:item.text,worldinfo:true,
        ...placements[index]!.position==='at-chat-depth'?{depth:placements[index]!.depth??0}:{}})))
      return projected.map((item,index)=>changed[index]!.text===item.text?item:{...item,
        text:changed[index]!.text,outputSha256:sha256(changed[index]!.text)})
    },audit:()=>freeze({schemaVersion:1,encoding:'native-tavern-render-chain-audit-v1',authority:'consumer-data-only',
      policySha256:TAVERN_NATIVE_RENDER_POLICY_SHA256,snapshot,scopeSets:[...scopeSets],
      transforms:[...transforms],executions:[...executions]}),
    assertCurrent:ownerCheckpoint}
}
