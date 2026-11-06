/** A registry is a fold of actual Native publications, never a second head
 * write. Closure archives only replay consumer data; Source and dispatch
 * rights still come from the current Core step and protected component. */
import {nativeInputSha256} from 'dsh-nexttavern-native-agent-loop'
import {createHash,type Hash} from 'node:crypto'
import {recordSha256,stableJson} from './roleplay-data.js'
import type {TavernTemplateFrozenSnapshotV1,TavernTemplateInjectionPromptV1,
  TavernTemplateInjectionEffectV1,TavernTemplateActivationProposalV1} from './tavern-template-types.mjs'
import type {captureRoleplayTavernMaterialHistoryV1} from './roleplay-tavern-material-history.js'
import type {AuthorPromptInjectionV1} from './tavern-author-prompt-types.mjs'
import type {BrowserGenerationOutputV3,BrowserEffectV3} from './roleplay-author-browser-generation-types.js'
import type {AuthorInjectionCleanupV1,AuthorInjectionDeclarationV1}
  from 'dsh-nexttavern-session-format/author-injection-cleanup'
import {appendTavernEjsJournal,tavernEjsCreationHead} from './roleplay-tavern-ejs-programs.js'
import type {TavernEjsJournalCut,TavernEjsNativeDisposal} from './roleplay-tavern-ejs-programs.js'
import type {TavernEjsReplayRecord,TavernEjsReplayDelta} from './tavern-template-ejs-replay.mjs'
import type {TavernEjsRuntimeInvocation} from './tavern-template-ejs-runtime-types.mjs'
import type {TavernEjsNamedPromptQueuesV1,TavernEjsRegexEffectV1,TavernEjsRegexInputV1,TavernEjsHostAction}
  from './tavern-template-ejs-host-types.mjs'
import type {AuthorNativeBindingV1,AuthorNativeHelperResourceV1} from './author-native-helper-types.js'
import type {SessionHistoryCut} from './session-history.js'
import type {SessionEvent} from 'dsh-nexttavern-native-session'

export const TAVERN_NATIVE_INJECTION_POLICY_V6=Object.freeze({schemaVersion:6,
  encoding:'native-author-injection-registry-policy-v6',authority:'consumer-data-only',
  owner:'session-branch-logical-Source-program; same-owner-ID-replacement',
  publication:'first-actual-Native-material-event; same-plan-retry-no-new-effects',
  program:'typed-EJS-creation-and-linked-real-action-deltas; retained-realm-between-published-generations',
  schedule:'logical-owner-then-ID; serial-await; captured-pass; new-registrations-next-pass',
  scan:'separate-filter-call-from-chat; once-per-registration-revision-per-feedback-pass',
  terminal:'Native-fixed-ID-fold; deferred-real-guest-disposal-delta-before-next-invocation',
  once:'owned-disposer-IDs-delete-current-replacements; Native-terminal-fixed-ID-fold',
  named:'EJS-key-UID-space; successful-material-assembly-advance; getter-never-consumes',
  regex:'mode-UID-space; stable-order-ties; explicit-accepted-material-boundaries; unpublished-failure-does-not-advance',
  ownerClose:'current-author-or-entry-definition-changed-disabled-or-import-replaced',
  fork:'parent-live-registration-not-inherited; no-hash-or-archive-mints-child-owner',
  atomicity:'no-material-publication-discards-provisional-creations-and-callback-effects',
  lateAuthor:'after-scan-and-chat-cuts; persistent-register-next-generation; once-clears-current-terminal',
  prompt:'whole-Source-owner-ID-space; ordered-effects; no-effects-retain-persistent',
  generation:'actual-native-realm-callbacks; shared-Source-owner-ID-space',
  provenance:'Core-pending-challenge-and-actual-realm-resource-callback; native-output-v1',
  cleanup:'Native-resource-close-removes-current-resource-registrations; explicit-remove-uses-Source-ID-space',
  retention:'latest-generation-per-producer; live-prompts-or-armed-once-or-Source-cleanup',
  bounds:{programs:256,prompts:512,operations:1024,archiveBytes:67_108_864,scanPasses:32,namedOutletBytes:1_048_576},
  requests:{normal:0,retry:0,fallback:0}})
export interface TavernInjectionDefinitionV1 {
  readonly logicalOwnerId:string
  readonly definitionSha256:string
  readonly nativeProgramSha256?:string
}
interface ClosedOwner {
  readonly kind:'owner-closed'
  readonly programInstanceId:string
  readonly definitionSha256:string
}
interface NativeGeneration {
  readonly kind:'native-creation'|'native-generation'
  readonly programInstanceId:string
  readonly definition:TavernInjectionDefinitionV1
  readonly output:BrowserGenerationOutputV3
}
interface EjsCreation {
  readonly kind:'ejs-creation'
  readonly programInstanceId:string
  readonly definition:TavernInjectionDefinitionV1
  readonly record:TavernEjsReplayRecord
  readonly phase:'initial'|'lore-selected'|'late-author'|'generate-final'
    |'generate-global-before'|'generate-indexed-before'|'generate-indexed-after'|'generate-global-after'
    |'ordinary-condition'|'ordinary-preprocess'
}
interface EjsInvocation {
  readonly kind:'ejs-invocation'
  readonly programInstanceId:string
  readonly delta:TavernEjsReplayDelta
}
type NativeArm={readonly kind:'native-arm-once';readonly programInstanceId:string;readonly batchOrdinals:readonly number[]}
export interface TavernRegexBoundaryV1 {
  readonly boundary:'generation-start'|'prompt-start'|'prompt-complete'
  readonly phaseId:string
}
export interface TavernRegexBatchInputV1 {
  readonly phase:'basic-prompt'|'generate'|'message-before'|'message-after'|'message-html'
  readonly phaseId:string
  readonly snapshot:TavernTemplateFrozenSnapshotV1
  readonly pieces:readonly (TavernEjsRegexInputV1&{readonly role?:'user'|'assistant'|'system';
    readonly depth?:number;readonly worldinfo?:boolean;readonly reasoning?:boolean})[]
}
export interface TavernRegexBatchResultV1 {
  readonly pieces:readonly {readonly id:string;readonly text:string}[]
  readonly activationProposals:readonly TavernTemplateActivationProposalV1[]
}
type Operation=ClosedOwner|NativeGeneration|NativeArm|EjsCreation|EjsInvocation
  |({readonly kind:'regex-boundary'}&TavernRegexBoundaryV1)|{readonly kind:'named-advance';readonly count:1}
export interface TavernInjectionTransactionV6 {
  readonly schemaVersion:6
  readonly encoding:'native-author-injection-transaction-v6'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly turn:number
  readonly step:number
  readonly attemptId:string
  readonly policySha256:string
  readonly baseRegistrySha256:string
  readonly operations:readonly Operation[]
  readonly finalRegistrySha256:string
  readonly transactionSha256:string
}
export type TavernInjectionTransaction=TavernInjectionTransactionV6
type Batch={ids:readonly string[];once:boolean;deleted:boolean;armedTurn:number;
  registrationOperationId?:string;resource?:AuthorInjectionCleanupV1['resource']}
interface NativeProgram {
  kind:'native'
  readonly definition:TavernInjectionDefinitionV1
  readonly programInstanceId:string
  readonly programSha256:string
  generation?:NativeGeneration
  head:string
  batches:Map<number,Batch>
  nextBatch:number
  closed:boolean
  archiveBytes:number
}
interface EjsProgram {
  kind:'ejs'
  creation:EjsCreation
  head:string
  batches:Map<number,Batch>
  nextBatch:number
  nextCallback:number
  nextEffect:number
  nextRegexEffect:number
  closed:boolean
  archiveBytes:number
  journalCut:TavernEjsJournalCut|null
  nativeDisposals:TavernEjsNativeDisposal[]
}
type Program=NativeProgram|EjsProgram
type Prompt={programInstanceId:string;owner:string;registrationSha256:string;
  nativeProgramSha256?:string}&(
  |{prompt:TavernTemplateInjectionPromptV1;origin?:never;once?:never;batchOrdinal?:never}
  |{prompt:AuthorPromptInjectionV1&{readonly filterCallbackId?:string};
    origin:Pick<BrowserEffectV3,'realmId'|'groupId'|'resource'>&{readonly callbackId?:string};
    once:boolean;batchOrdinal:number}
)
type NamedPrompt=TavernEjsNamedPromptQueuesV1[number]['entries'][number]&{
  readonly key:string;readonly owner:string;readonly programInstanceId:string;readonly registrationSha256:string}
type RegexRule={readonly descriptor:TavernEjsRegexEffectV1;readonly owner:string;
  readonly programInstanceId:string;readonly registrationSha256:string}
export interface TavernNativeFilterReferenceV1 {
  readonly binding:AuthorNativeBindingV1
  readonly realmId:string
  readonly resource:AuthorNativeHelperResourceV1
  readonly filterCallbackId:string
}
export interface TavernNativeFilterResultV1 {
  readonly accepted:boolean
  readonly actualReadBasis:Readonly<Record<string,unknown>>
  readonly changed:boolean
}
type NativeFilterPass={readonly selected:readonly Prompt[];
  readonly completed:Map<string,TavernNativeFilterResultV1>;readonly pin:object}
export interface TavernNativeInjectionConsumptionV1 {
  readonly passes:Map<string,NativeFilterPass>
}
export const createTavernNativeInjectionConsumptionV1=():TavernNativeInjectionConsumptionV1=>({passes:new Map()})
export const TAVERN_NATIVE_FILTER_RECAPTURE=Symbol('native-filter-recapture')
export const TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR=Symbol('native-filter-source-successor')
interface Dependencies {
  readonly committedOnly?:true
  readonly nativeConsumption?:TavernNativeInjectionConsumptionV1
  invokeNativeFilter?(input:{readonly reference:TavernNativeFilterReferenceV1;readonly registrationId:string;
    readonly operationId:string;readonly consumer:'scan'|'chat'}):Promise<TavernNativeFilterResultV1>
  afterNativeFilter?():Promise<boolean>
  retireNativeFilters?(references:readonly TavernNativeFilterReferenceV1[]):void
  readonly sessionId:string
  readonly turn:number
  readonly step:number
  readonly attemptId:string
  readonly history:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>
  currentNativeCut?():SessionHistoryCut<SessionEvent>
  readonly definitions:readonly TavernInjectionDefinitionV1[]
  readonly ejs:true
  invokeEjs(input:{programInstanceId:string;creation:TavernEjsReplayRecord;journalCut:TavernEjsJournalCut|null;
    head:string;operationId:string;action:Exclude<TavernEjsHostAction,{readonly kind:'dispose'}>;snapshot:TavernTemplateFrozenSnapshotV1;
    consumer:'scan'|'chat'|'generate'|'message-before'|'message-after'|'message-html';nativeDisposals:readonly TavernEjsNativeDisposal[]}):Promise<{
      invocations:readonly TavernEjsRuntimeInvocation[]}>
  retireEjs(programInstanceId:string):void
  readonly assertCurrent:()=>void
  readonly signal:AbortSignal
}
const policySha256V6=recordSha256(TAVERN_NATIVE_INJECTION_POLICY_V6)
function fail(code:string):never {throw Error(code)}
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}
function exact(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)
    ||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))
    fail('INPUT_MATERIAL_INJECTION_SCHEMA_INVALID')
}
const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=256
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const keyOf=(owner:string,id:string)=>JSON.stringify([owner,id])
const compareText=(left:string,right:string)=>left===right?0:left<right?-1:1
interface CommittedRegistry {
  readonly nativeLength:number
  readonly publicationLength:number
  readonly programs:Map<string,Program>
  readonly prompts:Map<string,Prompt>
  readonly named:Map<string,NamedPrompt>
  readonly regex:Map<string,RegexRule>
  readonly regexBoundaries:Map<TavernRegexBoundaryV1['boundary'],string>
  readonly readerRegexBasisSha256:string|null
  readonly readerRegexPrograms:ReadonlySet<string>
  readonly publishedPlans:Map<string,number>
  readonly declarations:Map<string,AuthorInjectionDeclarationV1>
  readonly archiveBytes:number
  readonly revision:number
  readonly disposalCount:number
  readonly disposalDigest:Hash
}
const committedRegistries=new WeakMap<object,Map<string,CommittedRegistry>>()
interface FilterReferences {
  nativeLength:number
  live:Map<string,TavernNativeFilterReferenceV1>
  readonly pins:Map<object,Map<string,TavernNativeFilterReferenceV1>>
  readonly retired:Map<string,TavernNativeFilterReferenceV1>
  notify?:(references:readonly TavernNativeFilterReferenceV1[])=>void
}
const filterReferences=new WeakMap<object,FilterReferences>()
const filterKey=(reference:TavernNativeFilterReferenceV1)=>JSON.stringify([
  reference.binding.browserSessionId,reference.binding.generation,reference.realmId,
  reference.resource.pageId,reference.filterCallbackId])
function filterReference(sessionId:string,row:Prompt):TavernNativeFilterReferenceV1|undefined {
  if(!row.origin||!row.nativeProgramSha256||!row.prompt.filterCallbackId)return undefined
  return {binding:{sessionId,programSha256:row.nativeProgramSha256,
    browserSessionId:row.origin.resource.browserSessionId,generation:row.origin.resource.generation},
    realmId:row.origin.realmId,resource:row.origin.resource,filterCallbackId:row.prompt.filterCallbackId}
}
function flushRetiredFilters(owner:FilterReferences):void {
  if(!owner.notify)return
  const ready:TavernNativeFilterReferenceV1[]=[]
  for(const [key,reference] of owner.retired)if(!owner.live.has(key)
    &&![...owner.pins.values()].some(refs=>refs.has(key))){owner.retired.delete(key);ready.push(reference)}
  if(ready.length)owner.notify(ready)
}
/** Captured callback pins belong to a live preparation, never to cold DATA. */
export function releaseTavernNativeInjectionConsumptionV1(consumption:TavernNativeInjectionConsumptionV1,
  history:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>):void {
  const owner=history.publicationSequence&&filterReferences.get(history.publicationSequence.owner)
  if(owner)for(const pass of consumption.passes.values())owner.pins.delete(pass.pin)
  consumption.passes.clear()
  if(owner)flushRetiredFilters(owner)
}
function copyPrograms(programs:ReadonlyMap<string,Program>):Map<string,Program> {
  return new Map([...programs].map(([id,program])=>{
    const batches=new Map([...program.batches].map(([ordinal,batch])=>[ordinal,{...batch}]))
    // Creation/generation, captures and acknowledged outputs are immutable
    // published DATA. Only these containers and local flags can change.
    const copy:Program=program.kind==='ejs'?{...program,batches,nativeDisposals:[...program.nativeDisposals]}:
      {...program,batches}
    return [id,copy]
  }))
}

export function createRoleplayTavernInjectionRegistryV1(deps:Dependencies) {
  let programs=new Map<string,Program>(),prompts=new Map<string,Prompt>()
  let named=new Map<string,NamedPrompt>(),namedCapture:TavernEjsNamedPromptQueuesV1|undefined,namedAdvanced=false
  let regex=new Map<string,RegexRule>(),regexBoundaries=new Map<TavernRegexBoundaryV1['boundary'],string>()
  let readerRegexBasisSha256:string|null=null,readerRegexPrograms:ReadonlySet<string>=new Set(),readerRegexDirty=false
  const namedTexts=new Map<string,string>()
  const operations:Operation[]=[],disposalEvidence:unknown[]=[],consumerEvidence:unknown[]=[],
    definitions=new Map<string,string>(),
    consumedScan=new Set<string>()
  let archiveBytes=0,phaseOrdinal=0,revision=0,scanPasses=0,scanConsumerOrdinal=0
  const visitedPasses=new Set<string>()
  let declarations=new Map<string,AuthorInjectionDeclarationV1>()
  const checkpoint=()=>deps.signal.throwIfAborted()
  let checkedNativeThrough=deps.history.nativeCut?.length??deps.history.events.length,registryChanged=false
  const ownerCheckpoint=()=>{
    checkpoint();deps.assertCurrent()
    if(deps.currentNativeCut) {
      const cut=deps.currentNativeCut()
      // Registry currency belongs here, rather than invalidating every input
      // frame (including the still-valid Native Phase A) on an ordinary ACK.
      // Each actual appended event is considered at most once by this read.
      for(const event of cut.range(checkedNativeThrough))if(event.type==='roleplay/author-injection-declaration'
        ||event.type==='roleplay/author-injection-cleanup')registryChanged=true
      checkedNativeThrough=cut.length
      if(registryChanged)fail('INPUT_MATERIAL_INJECTION_CAPTURE_CHANGED')
    }
  }
  ownerCheckpoint()
  for(const definition of deps.definitions) {
    if(!id(definition.logicalOwnerId)||!hash(definition.definitionSha256)||definitions.has(definition.logicalOwnerId))
      fail('INPUT_MATERIAL_INJECTION_DEFINITION_INVALID')
    definitions.set(definition.logicalOwnerId,definition.definitionSha256)
  }
  const definitionOf=(p:Program)=>p.kind==='ejs'?p.creation.definition:p.definition
  const generationState=(id:string,p:NativeProgram|EjsProgram)=>p.kind==='ejs'?{id,kind:'ejs',
    definition:p.creation.definition,head:p.head,batches:[...p.batches],nextBatch:p.nextBatch,
    nextCallback:p.nextCallback,nextEffect:p.nextEffect,nextRegexEffect:p.nextRegexEffect,
    nativeDisposals:p.nativeDisposals,closed:p.closed}:
    {id,kind:p.kind,definition:p.definition,programSha256:p.programSha256,
      captureSha256:p.generation?.output.captureSha256??null,head:p.head,batches:[...p.batches],nextBatch:p.nextBatch,
      closed:p.closed,invocationId:p.generation?.output.invocationId??null}
  const stateSha256=()=>recordSha256({schemaVersion:6,encoding:'native-author-injection-registry-state-v6',
    sessionId:deps.sessionId,policySha256:policySha256V6,revision,
    programs:[...programs].map(([id,p])=>generationState(id,p)),prompts:[...prompts],named:[...named],
    regex:[...regex],regexBoundaries:[...regexBoundaries]})
  const charge=(value:unknown)=>{
    const bytes=Buffer.byteLength(JSON.stringify(value),'utf8')
    archiveBytes+=bytes
    if(archiveBytes>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.archiveBytes)fail('INPUT_MATERIAL_INJECTION_ARCHIVE_LIMIT')
    return bytes
  }
  const pruneUnreferencedPrograms=()=>{
    const live=new Set([...prompts.values()].map(row=>row.programInstanceId))
    for(const row of named.values())live.add(row.programInstanceId)
    for(const row of regex.values())live.add(row.programInstanceId)
    for(const [id,p] of programs) {
      // A replaced once batch still owns an ID disposer until the actual end
      // of its arming turn. Removing its realm now would revive replacements.
      if(live.has(id)||[...p.batches.values()].some(batch=>batch.once&&!batch.deleted))continue
      if(p.kind==='ejs')deps.retireEjs(id)
      programs.delete(id);archiveBytes-=p.archiveBytes;revision++
    }
  }
  const readProgram=(id:string)=>{const p=programs.get(id);if(!p)fail('INPUT_MATERIAL_INJECTION_PROGRAM_MISSING');return p}
  const applyRegexEffects=(p:EjsProgram,effects:readonly TavernEjsRegexEffectV1[])=>{
    for(const descriptor of effects) {
      if(descriptor.ordinal!==p.nextRegexEffect++)fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER')
      regex.set(keyOf(descriptor.mode,descriptor.uid),{descriptor,owner:p.creation.definition.logicalOwnerId,
        programInstanceId:p.creation.programInstanceId,
        registrationSha256:recordSha256({programInstanceId:p.creation.programInstanceId,descriptor})})
      if(descriptor.mode==='message')readerRegexDirty=true
      if(regex.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.prompts)fail('INPUT_MATERIAL_INJECTION_PROMPT_LIMIT')
      revision++
    }
  }
  const applyEffects=(p:EjsProgram,effects:readonly TavernTemplateInjectionEffectV1[],
    turn:number,nativeSync?:number)=>{
    const owner=p.creation.definition.logicalOwnerId
    for(const effect of effects) {
      if(effect.ordinal!==p.nextEffect++)fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER')
      if(effect.kind==='named-upsert'){
        const {ordinal:_ordinal,kind:_kind,...entry}=effect
        named.set(keyOf(entry.key,entry.uid),{...entry,owner,programInstanceId:p.creation.programInstanceId,
          registrationSha256:recordSha256({programInstanceId:p.creation.programInstanceId,effect})})
        namedCapture=undefined;namedTexts.delete(entry.key)
        if(named.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.prompts)fail('INPUT_MATERIAL_INJECTION_PROMPT_LIMIT')
      }else if(effect.kind==='batch-created') {
        if(effect.batchOrdinal!==p.nextBatch++)fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER')
        p.batches.set(effect.batchOrdinal,{ids:effect.ids,once:effect.once,deleted:false,armedTurn:turn})
      }else if(effect.kind==='register') {
        const {prompt}=effect,batch=p.batches.get(prompt.batchOrdinal)
        if(!batch||batch.deleted||batch.once!==prompt.once||!batch.ids.includes(prompt.id)
          ||prompt.callbackOrdinal!==null&&prompt.callbackOrdinal!==p.nextCallback++)
          fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER')
        const registrationSha256=recordSha256({programInstanceId:p.creation.programInstanceId,effect})
        prompts.set(keyOf(owner,prompt.id),{owner,programInstanceId:p.creation.programInstanceId,registrationSha256,prompt})
        if(prompts.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.prompts)fail('INPUT_MATERIAL_INJECTION_PROMPT_LIMIT')
      }else {
        if(effect.batchOrdinal!==null) {
          const batch=p.batches.get(effect.batchOrdinal)
          if(!batch||batch.deleted&&nativeSync!==effect.batchOrdinal||!same(batch.ids,effect.ids))
            fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER')
          batch.deleted=true
        }
        // ID deletion intentionally reaches a replacement registered later by
        // another realm of this same logical Source owner, as the guest API does.
        if(nativeSync!==effect.batchOrdinal)for(const id of effect.ids)prompts.delete(keyOf(owner,id))
      }
      revision++
    }
  }
  const applyEjsCreation=(row:EjsCreation,turn:number)=>{
    if(programs.has(row.programInstanceId)||row.record.phases.length
      ||row.record.creation.kind!=='rendered')fail('INPUT_MATERIAL_INJECTION_EJS_CREATION_INVALID')
    const p:EjsProgram={kind:'ejs',creation:row,journalCut:null,head:tavernEjsCreationHead(row.record),
      batches:new Map(),nextBatch:0,nextCallback:0,nextEffect:0,nextRegexEffect:0,
      nativeDisposals:[],closed:false,archiveBytes:charge(row)}
    programs.set(row.programInstanceId,p)
    if(programs.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.programs)fail('INPUT_MATERIAL_INJECTION_PROGRAM_LIMIT')
    applyEffects(p,row.record.creation.output.injections,turn)
    applyRegexEffects(p,row.record.creation.output.regexEffects??[])
  }
  const applyEjsInvocation=(row:EjsInvocation,turn:number)=>{
    const p=readProgram(row.programInstanceId)
    if(p.kind!=='ejs'||p.closed||row.delta.action.result.kind!=='evaluated')
      fail('INPUT_MATERIAL_INJECTION_EJS_INVOCATION_INVALID')
    const sync=p.nativeDisposals.find(item=>item.operationId===row.delta.action.operationId)
    if(sync&&(row.delta.action.action.kind!=='dispose'||row.delta.action.action.batchOrdinal!==sync.batchOrdinal))
      fail('INPUT_MATERIAL_INJECTION_EJS_DISPOSAL_INVALID')
    applyEffects(p,row.delta.action.result.output.injections,turn,sync?.batchOrdinal)
    applyRegexEffects(p,row.delta.action.result.output.regexEffects??[])
    if(sync)p.nativeDisposals=p.nativeDisposals.filter(item=>item!==sync)
    p.journalCut=appendTavernEjsJournal(p.head,p.journalCut,row.delta)
    p.head=p.journalCut.head;p.archiveBytes+=charge(row);revision++
    if(readerRegexPrograms.has(row.programInstanceId))readerRegexDirty=true
  }
  const applyNativeGeneration=(row:NativeGeneration,turn:number)=>{
    exact(row,['kind','programInstanceId','definition','output'])
    const prior=programs.get(row.programInstanceId)
    if(row.kind==='native-creation'?!!prior:
      !prior||prior.kind!=='native'||prior.closed||!same(definitionOf(prior),row.definition))
      fail('INPUT_MATERIAL_INJECTION_NATIVE_GENERATION_INVALID')
    // The actual pending Core challenge already admitted and sealed this
    // native realm/resource output. Publication retains it as DATA; a cold
    // fold neither rehashes inner receipts nor recreates a live realm owner.
    const p:NativeProgram=prior?.kind==='native'?prior:{kind:'native',generation:row,
      definition:row.definition,programInstanceId:row.programInstanceId,programSha256:row.output.programSha256,
      head:row.output.outputSha256,
      batches:new Map(),nextBatch:0,closed:false,archiveBytes:0}
    p.generation=row
    applyGenerationEffects(p,row,turn)
  }
  const applyGenerationEffects=(p:NativeProgram,row:NativeGeneration,turn:number)=>{
    archiveBytes-=p.archiveBytes
    p.archiveBytes=charge(row);p.head=row.output.outputSha256
    programs.set(row.programInstanceId,p)
    if(programs.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.programs)fail('INPUT_MATERIAL_INJECTION_PROGRAM_LIMIT')
    const owner=row.definition.logicalOwnerId
    for(const [effectOrdinal,effect] of row.output.effects.entries()) {
      if(effect.kind==='remove') {
        for(const id of effect.ids)prompts.delete(keyOf(owner,id))
      }else {
        const batchOrdinal=p.nextBatch++
        if(effect.once)p.batches.set(batchOrdinal,{ids:effect.prompts.map(prompt=>prompt.id),once:true,
          deleted:false,armedTurn:turn})
        const origin={realmId:effect.realmId,groupId:effect.groupId,callbackId:effect.callbackId,resource:effect.resource}
        for(const [promptOrdinal,prompt] of effect.prompts.entries()) {
          const registrationSha256=recordSha256({programInstanceId:row.programInstanceId,
            outputSha256:row.output.outputSha256,effectOrdinal,promptOrdinal})
          prompts.set(keyOf(owner,prompt.id),{owner,programInstanceId:row.programInstanceId,
            registrationSha256,prompt,origin,once:effect.once,batchOrdinal,
            nativeProgramSha256:row.output.programSha256})
          if(prompts.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.prompts)fail('INPUT_MATERIAL_INJECTION_PROMPT_LIMIT')
        }
      }
      revision++
    }
    revision++
  }
  const applyNativeCleanup=(record:AuthorInjectionCleanupV1)=>{
    const owners=new Set<string>()
    for(const p of programs.values())if(p.kind==='native'
      &&p.programSha256===record.programSha256)owners.add(p.definition.logicalOwnerId)
    for(const [key,row] of prompts) {
      if(record.kind==='remove-ids') {
        if(owners.has(row.owner)&&record.ids.includes(row.prompt.id))prompts.delete(key)
      }else if(row.nativeProgramSha256===record.programSha256&&row.origin
        &&row.origin.resource.browserSessionId===record.resource.browserSessionId
        &&row.origin.resource.generation===record.resource.generation
        &&(record.resource.pageId===undefined||row.origin.resource.pageId===record.resource.pageId))prompts.delete(key)
    }
    if(record.kind==='resource-closed')for(const p of programs.values())if(p.kind==='native'
      &&p.programSha256===record.programSha256)for(const [ordinal,batch] of p.batches) {
      const resource=batch.resource
      if(resource?.browserSessionId===record.resource.browserSessionId&&resource.generation===record.resource.generation
        &&(record.resource.pageId===undefined||resource.pageId===record.resource.pageId))p.batches.delete(ordinal)
    }
    revision++
    pruneUnreferencedPrograms()
  }
  const applyNativeDeclaration=(record:AuthorInjectionDeclarationV1)=>{
    const definition={...record.definition,nativeProgramSha256:record.programSha256},owner=definition.logicalOwnerId
    declarations.set(record.operationId,record)
    if(record.mutation.kind==='remove-ids') {
      const operationId=record.mutation.registrationOperationId
      const registration=operationId?declarations.get(operationId):undefined
      const once=registration?.mutation.kind==='register'&&registration.mutation.once
      const armed=!once||[...programs.values()].some(p=>p.kind==='native'&&p.definition.logicalOwnerId===owner
        &&[...p.batches.values()].some(batch=>batch.registrationOperationId===operationId))
      // Native terminal already ran this returned disposer. A later call must
      // not delete a fresh replacement, although direct ID deletion still can.
      if(armed)for(const id of record.mutation.ids)prompts.delete(keyOf(owner,id))
      if(operationId)for(const p of programs.values())if(p.kind==='native'&&p.definition.logicalOwnerId===owner)
        for(const [ordinal,batch] of p.batches)if(batch.registrationOperationId===operationId)p.batches.delete(ordinal)
      revision++;pruneUnreferencedPrograms();return
    }
    const programInstanceId=`native-${recordSha256({sessionId:deps.sessionId,definition})}`,
      prior=programs.get(programInstanceId)
    if(prior&&(prior.kind!=='native'||prior.closed))fail('INPUT_MATERIAL_INJECTION_NATIVE_DECLARATION_INVALID')
    const p:NativeProgram=prior?.kind==='native'?prior:{kind:'native',definition,programInstanceId,
      programSha256:record.programSha256,head:'',batches:new Map(),nextBatch:0,closed:false,archiveBytes:0}
    archiveBytes-=p.archiveBytes
    p.archiveBytes=charge(record);p.head=recordSha256(record);programs.set(programInstanceId,p)
    const batchOrdinal=p.nextBatch++
    if(record.mutation.once)p.batches.set(batchOrdinal,{ids:record.mutation.prompts.map(prompt=>prompt.id),
      once:true,deleted:false,armedTurn:0,registrationOperationId:record.operationId,resource:record.resource})
    const origin={realmId:record.realmId,groupId:record.groupId,resource:record.resource}
    for(const [ordinal,prompt] of record.mutation.prompts.entries()) {
      prompts.set(keyOf(owner,prompt.id),{owner,programInstanceId,nativeProgramSha256:record.programSha256,
        registrationSha256:recordSha256({operationId:record.operationId,programInstanceId,ordinal}),
        prompt,origin,once:record.mutation.once,batchOrdinal})
    }
    if(programs.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.programs)fail('INPUT_MATERIAL_INJECTION_PROGRAM_LIMIT')
    if(prompts.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.prompts)fail('INPUT_MATERIAL_INJECTION_PROMPT_LIMIT')
    revision++
  }
  const dispose=(programInstanceId:string,batchOrdinals:readonly number[],consumer:'terminal'|'owner-close',
    actualRef:Readonly<Record<string,unknown>>)=>{
    const p=readProgram(programInstanceId)
    if(p.kind==='ejs') {
      const owner=p.creation.definition.logicalOwnerId,ids:string[]=[]
      for(const ordinal of batchOrdinals) {
        const batch=p.batches.get(ordinal)!
        ids.push(...batch.ids)
        for(const id of batch.ids)prompts.delete(keyOf(owner,id))
        batch.deleted=true;revision++
        if(consumer==='terminal')p.nativeDisposals.push({batchOrdinal:ordinal,actualRef,
          operationId:`native-dispose-${recordSha256({programInstanceId,batchOrdinal:ordinal,actualRef})}`})
      }
      if(consumer==='owner-close') {
        for(const [key,row] of prompts)if(row.owner===owner)prompts.delete(key)
        for(const [key,row] of named)if(row.owner===owner){named.delete(key);namedCapture=undefined;namedTexts.delete(row.key)}
        for(const [key,row] of regex)if(row.programInstanceId===programInstanceId){
          regex.delete(key)
          if(row.descriptor.mode==='message')readerRegexDirty=true
        }
        deps.retireEjs(programInstanceId)
      }
      if(batchOrdinals.length||consumer==='owner-close')disposalEvidence.push(freeze({schemaVersion:5,
        encoding:'native-ejs-injection-disposal-fold-v5',authority:'consumer-data-only',
        programInstanceId,consumer,actualRef,batchOrdinals,ids,observedGuestExecution:false}))
      return
    }
    const owner=p.definition.logicalOwnerId,ids:string[]=[]
    for(const ordinal of batchOrdinals) {
      const batch=p.batches.get(ordinal)!
      ids.push(...batch.ids)
      for(const id of batch.ids)prompts.delete(keyOf(owner,id))
      p.batches.delete(ordinal);revision++
    }
    if(consumer==='owner-close') {
      for(const [key,row] of prompts)if(row.owner===owner)prompts.delete(key)
    }
    if(batchOrdinals.length||consumer==='owner-close') {
      disposalEvidence.push(freeze({schemaVersion:1,encoding:'author-native-injection-disposal-fold-v1',
        authority:'consumer-data-only',programInstanceId,consumer,actualRef,batchOrdinals,ids,
        invocationId:p.generation?.output.invocationId??null,
        observedGuestExecution:false}))
    }
  }
  const applyOperation=(operation:Operation,turn:number)=>{
    if(operation.kind==='regex-boundary') {
      const {boundary,phaseId}=operation
      if(!['generation-start','prompt-start','prompt-complete'].includes(boundary)||!id(phaseId))
        fail('INPUT_MATERIAL_INJECTION_SCHEMA_INVALID')
      regexBoundaries.set(boundary,phaseId)
      for(const [key,row] of regex) {
        const {descriptor}=row
        if(descriptor.mode==='basic'&&boundary!=='generation-start')regex.delete(key)
        else if(descriptor.mode==='message'&&boundary==='generation-start'
          ||descriptor.mode==='generate'&&boundary==='prompt-complete') {
          const sticky=descriptor.sticky-1
          if(descriptor.mode==='message')readerRegexDirty=true
          if(sticky<=0)regex.delete(key)
          else regex.set(key,{...row,descriptor:{...descriptor,sticky}})
        }
      }
      revision++
    }else if(operation.kind==='native-arm-once') {
      const p=readProgram(operation.programInstanceId)
      if(p.kind!=='native')fail('INPUT_MATERIAL_INJECTION_NATIVE_DECLARATION_INVALID')
      for(const ordinal of operation.batchOrdinals) {
        const batch=p.batches.get(ordinal)
        if(!batch||batch.armedTurn!==0)fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER')
        batch.armedTurn=turn
      }
      revision++
    }else if(operation.kind==='named-advance'){
      exact(operation,['kind','count'])
      if(operation.count!==1)fail('INPUT_MATERIAL_INJECTION_SCHEMA_INVALID')
      for(const [key,row] of named){
        const sticky=row.sticky-1
        if(sticky<0)named.delete(key)
        else named.set(key,{...row,sticky})
      }
      namedCapture=undefined;namedTexts.clear();revision++
    }else if(operation.kind==='native-creation'||operation.kind==='native-generation')applyNativeGeneration(operation,turn)
    else if(operation.kind==='ejs-creation')applyEjsCreation(operation,turn)
    else if(operation.kind==='ejs-invocation')applyEjsInvocation(operation,turn)
    else {
      exact(operation,['kind','programInstanceId','definitionSha256'])
      const p=readProgram(operation.programInstanceId)
      if(operation.kind!=='owner-closed'||operation.definitionSha256!==definitionOf(p).definitionSha256||p.closed)
        fail('INPUT_MATERIAL_INJECTION_OWNER_CLOSE_INVALID')
      dispose(operation.programInstanceId,[...p.batches].filter(([,batch])=>!batch.deleted).map(([id])=>id),
        'owner-close',{turn,definitionSha256:operation.definitionSha256})
      p.closed=true;revision++
    }
  }
  const sequence=deps.history.publicationSequence,nativeCut=deps.history.nativeCut,
    reusable=sequence&&nativeCut?.source==='native'
  let ownerMemo=reusable?committedRegistries.get(sequence.owner):undefined
  if(reusable&&!ownerMemo){ownerMemo=new Map();committedRegistries.set(sequence.owner,ownerMemo)}
  let committed=ownerMemo?.get(deps.sessionId)
  if(committed&&(committed.nativeLength>nativeCut!.length
    ||committed.publicationLength>sequence.length))committed=undefined
  const publishedPlans=committed?.publishedPlans??new Map<string,number>()
  if(committed){
    deps.history.assertCurrent()
    const advancing=committed.nativeLength!==nativeCut!.length
    programs=advancing?copyPrograms(committed.programs):committed.programs
    prompts=advancing?new Map(committed.prompts):committed.prompts
    named=advancing?new Map(committed.named):committed.named
    regex=advancing?new Map(committed.regex):committed.regex
    regexBoundaries=advancing?new Map(committed.regexBoundaries):committed.regexBoundaries
    readerRegexBasisSha256=committed.readerRegexBasisSha256;readerRegexPrograms=committed.readerRegexPrograms
    archiveBytes=committed.archiveBytes;revision=committed.revision
    declarations=advancing?new Map(committed.declarations):committed.declarations
  }
  const disposalDigest=committed?.disposalDigest.copy()??createHash('sha256').update('[')
  let disposalCount=committed?.disposalCount??0,publicationCursor=committed?.publicationLength??0
  const publications=sequence??{
    length:deps.history.publications.length,at:(index:number)=>deps.history.publications[index]}
  const events=reusable?nativeCut.range(committed?.nativeLength??0,nativeCut.length):deps.history.events
  for(const event of events) {
    const candidate=publications.at(publicationCursor),
      publication=candidate?.event.seq===event.seq?candidate:undefined
    if(publication)publicationCursor++
    if(publication) {
      const {snapshot,plan}=publication,transaction=snapshot.payload.injections as TavernInjectionTransaction|undefined,
        expected=(plan.payload.promptPlan as Record<string,unknown>|undefined)?.injectionTransactionSha256
      if(!transaction&&expected===undefined)continue
      if(!transaction||!same(transaction.transactionSha256,expected))fail('INPUT_MATERIAL_INJECTION_PLAN_BINDING')
      exact(transaction,['schemaVersion','encoding','authority','sessionId','turn','step','attemptId','policySha256',
        'baseRegistrySha256','operations','finalRegistrySha256','transactionSha256'])
      const {transactionSha256,...body}=transaction
      if(transaction.schemaVersion!==6||transaction.encoding!=='native-author-injection-transaction-v6'
        ||transaction.authority!=='consumer-data-only'||transaction.sessionId!==deps.sessionId
        ||transaction.turn!==publication.event.data.turn||transaction.step!==publication.event.data.step
        ||transaction.policySha256!==policySha256V6
        ||!id(transaction.attemptId)||recordSha256(body)!==transactionSha256
        ||!Array.isArray(transaction.operations)||transaction.operations.length>1024)
        fail('INPUT_MATERIAL_INJECTION_TRANSACTION_INVALID')
      const planKey=`${publication.event.data.plan.key}:${publication.event.data.plan.sha256}`
      const firstNativeSeq=publishedPlans.get(planKey)
      // The map may include successfully folded events from a later attempt
      // whose remaining tail failed. The retained Native cut is the committed
      // bound: replay reaches each first event again before accepting retries.
      // In particular, a marker at this exact seq cannot skip this event.
      if(firstNativeSeq!==undefined&&firstNativeSeq<Number(event.seq))continue
      if(stateSha256()!==transaction.baseRegistrySha256)fail('INPUT_MATERIAL_INJECTION_BASE_CHANGED')
      for(const operation of transaction.operations)applyOperation(operation,transaction.turn)
      pruneUnreferencedPrograms()
      if(stateSha256()!==transaction.finalRegistrySha256)fail('INPUT_MATERIAL_INJECTION_FINAL_CHANGED')
      if(firstNativeSeq===undefined||firstNativeSeq>Number(event.seq))publishedPlans.set(planKey,Number(event.seq))
    }else if(event.type==='roleplay/author-injection-declaration') {
      applyNativeDeclaration(event.data)
    }else if(event.type==='roleplay/author-injection-cleanup') {
      // The Native session-format owner already decoded this non-chat event.
      // Restoring its DATA removes prompts; it grants no live realm rights.
      applyNativeCleanup(event.data)
    }else if(event.type==='turn/end') {
      const actualRef={seq:Number(event.seq),eventSha256:nativeInputSha256(event),turn:event.data.turn,reason:event.data.reason}
      for(const [id,p] of programs)dispose(id,[...p.batches].filter(([,batch])=>batch.once&&!batch.deleted
        &&batch.armedTurn===event.data.turn).map(([ordinal])=>ordinal),'terminal',actualRef)
      pruneUnreferencedPrograms()
    }
  }
  // Preserve the exact canonical array digest, without retaining or
  // serializing all terminal receipts in every new Main audit.
  for(const disposal of disposalEvidence){
    if(disposalCount++)disposalDigest.update(',')
    disposalDigest.update(stableJson(disposal)!, 'utf8')
  }
  disposalEvidence.length=0
  const historicalDisposalCount=disposalCount,
    historicalDisposalsSha256=disposalDigest.copy().update(']').digest('hex')
  if(readerRegexDirty) {
    // Only accepted mutations of message rules or their actual closure heads
    // invalidate this owner fact. Polls and unrelated registry events reuse it.
    const rows=[...regex.values()].filter(row=>row.descriptor.mode==='message'),programIds=new Set<string>()
    const basis=rows.map(row=>{
      const p=readProgram(row.programInstanceId)
      programIds.add(row.programInstanceId)
      return {registrationSha256:row.registrationSha256,sticky:row.descriptor.sticky,
        programInstanceId:row.programInstanceId,head:p.head,definitionSha256:definitionOf(p).definitionSha256}
    })
    readerRegexBasisSha256=basis.length?recordSha256(basis):null
    readerRegexPrograms=programIds;readerRegexDirty=false
  }
  if(reusable&&(!committed||committed.nativeLength!==nativeCut.length)){
    deps.history.assertCurrent()
    // Only accepted Native publications/cleanup/end events reach this memo.
    // Current Source closures and all provisional effects start below it.
    ownerMemo!.set(deps.sessionId,{nativeLength:nativeCut.length,publicationLength:publicationCursor,
      programs,prompts,named,regex,regexBoundaries,readerRegexBasisSha256,readerRegexPrograms,
      publishedPlans,declarations,archiveBytes,revision,
      disposalCount,disposalDigest})
  }
  const acceptedPrograms=programs,acceptedPrompts=prompts,acceptedDeclarations=declarations
  const acceptedRegex=regex
  let references=sequence?filterReferences.get(sequence.owner):undefined
  if(sequence&&!references){references={nativeLength:-1,live:new Map(),pins:new Map(),retired:new Map()}
    filterReferences.set(sequence.owner,references)}
  if(references){
    if(deps.retireNativeFilters)references.notify=deps.retireNativeFilters
    if((nativeCut?.length??0)>=references.nativeLength) {
      const live=new Map<string,TavernNativeFilterReferenceV1>()
      for(const row of acceptedPrompts.values()) {
        const reference=filterReference(deps.sessionId,row)
        if(reference)live.set(filterKey(reference),reference)
      }
      for(const [key,reference] of references.live)if(!live.has(key))references.retired.set(key,reference)
      references.live=live;references.nativeLength=nativeCut?.length??0
      flushRetiredFilters(references)
    }
  }
  const nativeRows=()=>[...acceptedPrompts.values()].filter(row=>!!row.origin)
  const committedView={
    readerRegexBasisSha256,
    regexRows:():readonly RegexRule[]=>[...acceptedRegex.values()],
    declaration:(operationId:string)=>acceptedDeclarations.get(operationId),
    nativeRows,
    hasResource(record:AuthorInjectionCleanupV1):boolean {
      if(record.kind==='remove-ids')return nativeRows().some(row=>row.nativeProgramSha256===record.programSha256
        &&record.ids.includes(row.prompt.id))
      return nativeRows().some(row=>row.nativeProgramSha256===record.programSha256&&row.origin
        &&row.origin.resource.browserSessionId===record.resource.browserSessionId
        &&row.origin.resource.generation===record.resource.generation
        &&(record.resource.pageId===undefined||row.origin.resource.pageId===record.resource.pageId))
        ||[...acceptedPrograms.values()].some(p=>p.kind==='native'&&p.programSha256===record.programSha256
          &&[...p.batches.values()].some(batch=>batch.resource?.browserSessionId===record.resource.browserSessionId
            &&batch.resource.generation===record.resource.generation
            &&(record.resource.pageId===undefined||batch.resource.pageId===record.resource.pageId)))
    },
    assertCapacity(record:AuthorInjectionDeclarationV1):void {
      if(record.mutation.kind!=='register')return
      const definition={...record.definition,nativeProgramSha256:record.programSha256},
        programInstanceId=`native-${recordSha256({sessionId:deps.sessionId,definition})}`
      if(!acceptedPrograms.has(programInstanceId)&&acceptedPrograms.size>=TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.programs)
        fail('INPUT_MATERIAL_INJECTION_PROGRAM_LIMIT')
      const keys=new Set(acceptedPrompts.keys())
      for(const prompt of record.mutation.prompts)keys.add(keyOf(record.definition.logicalOwnerId,prompt.id))
      if(keys.size>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.prompts)fail('INPUT_MATERIAL_INJECTION_PROMPT_LIMIT')
    },
  }
  // The accepted fold is the common read owner for ordinary Core writes and
  // preparation. Only the latter needs an isolated provisional working copy.
  if(!deps.committedOnly){programs=copyPrograms(programs);prompts=new Map(prompts);named=new Map(named)
    regex=new Map(regex);regexBoundaries=new Map(regexBoundaries)}
  const baseRegistrySha256=deps.committedOnly?'':stateSha256()
  const historySummary=()=>{
    if(deps.history.evidenceSummary)return deps.history.evidenceSummary
    const {coreRefs=[],...evidence}=deps.history.evidence
    return {...evidence,coreRefsCount:coreRefs.length,coreRefsSha256:recordSha256(coreRefs)}
  }
  const append=(operation:Operation)=>{
    if(operations.length>=1024)fail('INPUT_MATERIAL_INJECTION_OPERATION_LIMIT')
    applyOperation(operation,deps.turn);operations.push(freeze(operation))
  }
  for(const [id,p] of programs)if(!deps.committedOnly&&!p.closed
    &&definitions.get(definitionOf(p).logicalOwnerId)!==definitionOf(p).definitionSha256) {
    append({kind:'owner-closed',programInstanceId:id,definitionSha256:definitionOf(p).definitionSha256})
  }
  checkpoint()
  return {
    committedView,
    hasRegex(mode:TavernEjsRegexEffectV1['mode']):boolean {
      for(const row of regex.values())if(row.descriptor.mode===mode)return true
      return false
    },
    namedQueues():TavernEjsNamedPromptQueuesV1 {
      ownerCheckpoint()
      if(!namedCapture){
        const queues=new Map<string,{uid:string;prompt:string;order:number;sticky:number}[]>()
        for(const row of named.values()){
          const entries=queues.get(row.key)??[]
          entries.push({uid:row.uid,prompt:row.prompt,order:row.order,sticky:row.sticky});queues.set(row.key,entries)
        }
        namedCapture=freeze([...queues].map(([key,entries])=>({key,entries})))
      }
      return namedCapture
    },
    resolveNamedOutlets(text:string):string {
      ownerCheckpoint()
      if(!text.includes('{{outletPromptsInjected:'))return text
      const value=(key:string)=>{
        if(!namedTexts.has(key))namedTexts.set(key,[...named.values()].filter(row=>row.key===key)
          .sort((a,b)=>a.order-b.order).map(row=>row.prompt).join('\n'))
        return namedTexts.get(key)!
      }
      let current=text
      // Same bounded expansion model as other Native injection feedback; no
      // EJS or macro evaluation is repeated on queue-supplied text.
      for(let pass=0;pass<TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.scanPasses;pass++){
        const parts:string[]=[],pattern=/\{\{outletPromptsInjected:([^{}]+)\}\}/g
        let offset=0,bytes=0,match:RegExpExecArray|null
        const push=(part:string)=>{
          bytes+=Buffer.byteLength(part,'utf8')
          if(bytes>TAVERN_NATIVE_INJECTION_POLICY_V6.bounds.namedOutletBytes)fail('INPUT_MATERIAL_NAMED_OUTLET_LIMIT')
          parts.push(part)
        }
        // Bound before joining: a short template can repeat the same large
        // queue enough times to exhaust Node while building one replacement.
        while((match=pattern.exec(current))!==null){push(current.slice(offset,match.index));push(value(match[1]!))
          offset=match.index+match[0].length}
        push(current.slice(offset))
        const next=parts.join('')
        if(next===current)return next
        current=next
      }
      return current
    },
    advanceRegex(input:TavernRegexBoundaryV1) {
      ownerCheckpoint()
      if(regexBoundaries.get(input.boundary)===input.phaseId)return
      // This operation is provisional until its real Native material publishes.
      // Failed unpublished preparations and pricing retries consume no lifetime.
      append({kind:'regex-boundary',...input})
    },
    async applyRegexBatch(input:TavernRegexBatchInputV1):Promise<TavernRegexBatchResultV1> {
      ownerCheckpoint()
      const mode=input.phase==='basic-prompt'?'basic':input.phase==='generate'?'generate':'message',
        selected=[...regex.values()].filter(row=>row.descriptor.mode===mode)
          .sort((left,right)=>left.descriptor.order-right.descriptor.order),
        pieces=input.pieces.map(piece=>({id:piece.id,text:piece.text})),
        activationProposals:TavernTemplateActivationProposalV1[]=[]
      for(const row of selected) {
        const rule=row.descriptor,indices:number[]=[]
        for(const [index,piece] of input.pieces.entries()) {
          if(piece.role&&rule[piece.role]===false||piece.worldinfo&&!rule.worldinfo
            ||piece.reasoning&&!rule.reasoning)continue
          if(mode!=='generate'&&piece.depth!==undefined
            &&(rule.minDepth!==null&&rule.minDepth>=-1&&piece.depth<rule.minDepth
              ||rule.maxDepth!==null&&rule.maxDepth>=0&&piece.depth>rule.maxDepth))continue
          if(input.phase==='message-before'&&!rule.before||input.phase==='message-after'&&!rule.after
            ||input.phase==='message-html'&&!rule.html)continue
          indices.push(index)
        }
        if(!indices.length)continue
        const p=readProgram(row.programInstanceId)
        if(p.kind!=='ejs'||p.closed)fail('INPUT_MATERIAL_INJECTION_OWNER_CLOSED')
        const action={kind:'regex' as const,callbackOrdinal:rule.callbackOrdinal,
          inputs:indices.map(index=>({...pieces[index]!,
            ...input.pieces[index]!.env===undefined?{}:{env:input.pieces[index]!.env}}))},
          operationId=`ejs-regex-${recordSha256({attemptId:deps.attemptId,step:deps.step,
            phase:input.phase,phaseId:input.phaseId,phaseOrdinal:phaseOrdinal++,registrationSha256:row.registrationSha256})}`,
          result=await deps.invokeEjs({programInstanceId:row.programInstanceId,creation:p.creation.record,
            journalCut:p.journalCut,head:p.head,operationId,action,snapshot:input.snapshot,
            consumer:input.phase==='basic-prompt'?'generate':input.phase,nativeDisposals:p.nativeDisposals})
        ownerCheckpoint()
        for(const invocation of result.invocations) {
          if(invocation.result.kind!=='evaluated'||!invocation.delta)
            fail(invocation.result.kind==='refused'?invocation.result.diagnostic.code:'INPUT_MATERIAL_INJECTION_EJS_DELTA_MISSING')
          append({kind:'ejs-invocation',programInstanceId:row.programInstanceId,delta:invocation.delta})
          activationProposals.push(...invocation.result.output.activations)
        }
        const last=result.invocations.at(-1),results=last?.result.kind==='evaluated'?last.result.output.regexResults:undefined
        if(!results||results.length!==indices.length||results.some((item,index)=>item.id!==action.inputs[index]!.id))
          fail('INPUT_MATERIAL_REGEX_RESULT_CHANGED')
        for(const [index,value] of results.entries())pieces[indices[index]!]=value
      }
      ownerCheckpoint()
      return freeze({pieces,activationProposals})
    },
    advanceNamed(){
      ownerCheckpoint()
      if(namedAdvanced)return
      namedAdvanced=true
      if(named.size)append({kind:'named-advance',count:1})
    },
    acceptEjsCreation(programInstanceId:string,record:TavernEjsReplayRecord,definition:TavernInjectionDefinitionV1,
      phase:EjsCreation['phase']) {
      ownerCheckpoint()
      if(record.creation.kind!=='rendered'||!record.creation.output.injections.length
        &&!record.creation.output.regexEffects?.length)return
      if(definitions.get(definition.logicalOwnerId)!==definition.definitionSha256)
        fail('INPUT_MATERIAL_INJECTION_SOURCE_DEFINITION_CHANGED')
      append({kind:'ejs-creation',programInstanceId,record,definition,phase})
      ownerCheckpoint()
    },
    acceptNativeGeneration(output:BrowserGenerationOutputV3,definition:TavernInjectionDefinitionV1) {
      ownerCheckpoint()
      if(definitions.get(definition.logicalOwnerId)!==definition.definitionSha256
        ||output.programSha256!==definition.nativeProgramSha256)
        fail('INPUT_MATERIAL_INJECTION_SOURCE_DEFINITION_CHANGED')
      const programInstanceId=`native-${recordSha256({sessionId:deps.sessionId,definition})}`
      append({kind:programs.has(programInstanceId)?'native-generation':'native-creation',
        programInstanceId,definition,output})
      ownerCheckpoint()
    },
    async consume(consumer:'scan'|'chat',snapshot:TavernTemplateFrozenSnapshotV1) {
      ownerCheckpoint()
      const passIdentity=consumer==='scan'?`scan:${scanConsumerOrdinal++}`:'chat:0'
      visitedPasses.add(passIdentity)
      const fresh=[...prompts.values()].filter(row=>consumer==='scan'?row.prompt.should_scan:row.prompt.position==='in_chat')
        .filter(row=>consumer!=='scan'||!consumedScan.has(row.registrationSha256))
      let pass=deps.nativeConsumption?.passes.get(passIdentity)
      if(!pass&&deps.nativeConsumption) {
        pass={selected:fresh.filter(row=>!!row.origin),completed:new Map(),pin:{}}
        deps.nativeConsumption.passes.set(passIdentity,pass)
        if(references){
          const pins=new Map<string,TavernNativeFilterReferenceV1>()
          for(const row of pass.selected){const reference=filterReference(deps.sessionId,row)
            if(reference)pins.set(filterKey(reference),reference)}
          references.pins.set(pass.pin,pins)
        }
      }
      // Native callbacks have already committed their external writes. Only
      // that sub-schedule survives a recapture; provisional EJS is rebuilt from
      // fresh Source and merged again in its normal deterministic order.
      const selected=(pass?[...fresh.filter(row=>!row.origin),...pass.selected]:fresh)
        .sort((left,right)=>compareText(left.owner,right.owner)||compareText(left.prompt.id,right.prompt.id))
      if(consumer==='scan'&&selected.length&&++scanPasses>32)fail('INPUT_MATERIAL_INJECTION_SCAN_LIMIT')
      const accepted:Prompt[]=[]
      const results:{registrationSha256:string;accepted:boolean;receiptSha256:string|null;
        actualReadBasis?:Readonly<Record<string,unknown>>;reused?:boolean}[]=[]
      const activationProposals:TavernTemplateActivationProposalV1[]=[]
      for(const row of selected) {
        if(consumer==='scan')consumedScan.add(row.registrationSha256)
        let include=true
        let receiptSha256:string|null=null
        let actualReadBasis:Readonly<Record<string,unknown>>|undefined,reused=false
        const reference=filterReference(deps.sessionId,row)
        if(reference) {
          if(!pass||!deps.invokeNativeFilter)fail('INPUT_MATERIAL_NATIVE_FILTER_UNAVAILABLE')
          let result=pass.completed.get(row.registrationSha256)
          reused=!!result
          const operationId=`native-filter-${recordSha256({attemptId:deps.attemptId,step:deps.step,
            passIdentity,registrationSha256:row.registrationSha256})}`
          if(!result) {
            result=await deps.invokeNativeFilter({reference,registrationId:row.registrationSha256,operationId,consumer})
            // Record real execution before accepting a successor which retires
            // this input token. Re-entry consumes DATA and cannot repeat it.
            pass.completed.set(row.registrationSha256,result)
            references?.pins.get(pass.pin)?.delete(filterKey(reference))
            if(references)flushRetiredFilters(references)
            if(await deps.afterNativeFilter?.())throw TAVERN_NATIVE_FILTER_SOURCE_SUCCESSOR
            if(result.changed)throw TAVERN_NATIVE_FILTER_RECAPTURE
          }
          include=result.accepted;actualReadBasis=result.actualReadBasis
          receiptSha256=recordSha256({operationId,accepted:include,actualReadBasis})
          ownerCheckpoint()
        }else if(!row.origin&&'callbackOrdinal' in row.prompt&&row.prompt.callbackOrdinal!==null) {
          const p=readProgram(row.programInstanceId)
          if(p.kind!=='ejs'||p.closed)fail('INPUT_MATERIAL_INJECTION_OWNER_CLOSED')
          const operationId=`ejs-filter-${recordSha256({attemptId:deps.attemptId,step:deps.step,consumer,
            phaseOrdinal:phaseOrdinal++,registrationSha256:row.registrationSha256})}`
          const result=await deps.invokeEjs({programInstanceId:row.programInstanceId,creation:p.creation.record,
            journalCut:p.journalCut,head:p.head,operationId,action:{kind:'filter',callbackOrdinal:row.prompt.callbackOrdinal},
            snapshot,consumer,nativeDisposals:p.nativeDisposals})
          ownerCheckpoint()
          for(const invocation of result.invocations) {
            if(invocation.result.kind!=='evaluated'||!invocation.delta)
              fail(invocation.result.kind==='refused'?invocation.result.diagnostic.code:'INPUT_MATERIAL_INJECTION_EJS_DELTA_MISSING')
            append({kind:'ejs-invocation',programInstanceId:row.programInstanceId,delta:invocation.delta})
            activationProposals.push(...invocation.result.output.activations)
          }
          const last=result.invocations[result.invocations.length-1]
          if(!last||last.result.kind!=='evaluated')fail('INPUT_MATERIAL_INJECTION_FILTER_REFUSED')
          include=last.result.accepted===true;receiptSha256=p.head
        }
        // A captured schedule still uses its captured content even when its
        // own callback removes/replaces it. New registrations wait for a later pass.
        if(include)accepted.push(row)
        results.push({registrationSha256:row.registrationSha256,accepted:include,receiptSha256,
          ...actualReadBasis?{actualReadBasis,reused}:{}})
      }
      consumerEvidence.push(freeze({schemaVersion:1,encoding:'native-injection-consumer-cut-v1',
        authority:'consumer-data-only',consumer,snapshotSha256:snapshot.snapshotSha256,
        selectedRegistrationSha256s:selected.map(row=>row.registrationSha256),results,registryAfterSha256:stateSha256()}))
      ownerCheckpoint()
      return freeze({prompts:accepted,activationProposals})
    },
    transaction():TavernInjectionTransaction {
      ownerCheckpoint()
      if(deps.nativeConsumption)for(const [key,pass] of deps.nativeConsumption.passes)if(!visitedPasses.has(key)) {
        references?.pins.delete(pass.pin);deps.nativeConsumption.passes.delete(key)
      }
      if(references)flushRetiredFilters(references)
      for(const [programInstanceId,p] of programs)if(p.kind==='native') {
        const batchOrdinals=[...p.batches].filter(([,batch])=>batch.armedTurn===0).map(([ordinal])=>ordinal)
        if(batchOrdinals.length)append({kind:'native-arm-once',programInstanceId,batchOrdinals})
      }
      pruneUnreferencedPrograms()
      const body={schemaVersion:6 as const,encoding:'native-author-injection-transaction-v6' as const,
        authority:'consumer-data-only' as const,sessionId:deps.sessionId,turn:deps.turn,step:deps.step,
        attemptId:deps.attemptId,policySha256:policySha256V6,baseRegistrySha256,finalRegistrySha256:stateSha256(),
        operations:[...operations]}
      return freeze({...body,transactionSha256:recordSha256(body)})
    },
    audit:()=>freeze({schemaVersion:6,encoding:'native-injection-history-and-provisional-fold-v6',registryVersion:6,
      authority:'consumer-data-only',policySha256:policySha256V6,
      history:historySummary(),baseRegistrySha256,
      historicalDisposalCount,historicalDisposalsSha256,currentDisposals:[...disposalEvidence],
      consumers:consumerEvidence,finalRegistrySha256:stateSha256(),archiveBytes,scanPasses}),
    assertCurrent:ownerCheckpoint,
  }
}

/** Ordinary registration/cleanup reads the same accepted fold; no prompt
 * construction, EJS evaluation, provisional owner-close or second table. */
export function captureCommittedTavernInjectionRegistryV1(input:{
  readonly sessionId:string;readonly history:ReturnType<typeof captureRoleplayTavernMaterialHistoryV1>
  readonly signal:AbortSignal;retireEjs(programInstanceId:string):void
  retireNativeFilters?(references:readonly TavernNativeFilterReferenceV1[]):void
}) {
  return createRoleplayTavernInjectionRegistryV1({...input,turn:0,step:0,attemptId:'committed-read',
    definitions:[],committedOnly:true,ejs:true,assertCurrent:input.history.assertCurrent,
    invokeEjs:async()=>{throw Error('INPUT_MATERIAL_COMMITTED_READ_ONLY')}}).committedView
}
