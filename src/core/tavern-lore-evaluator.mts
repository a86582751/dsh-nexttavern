import {recordSha256} from './roleplay-data.js'
import {types} from 'node:util'
import {schemaTextSha256} from './tavern-mvu-schema-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import {validateTavernLoreCompilationV1,resolveTavernLoreContentTextV1} from './tavern-lore-compiler.mjs'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {LoreEvaluationRefusal,TavernLoreBoundedMatcherV1,refuse} from './tavern-lore-match.mjs'
import {exact,freezeLoreData,validateTavernLoreSnapshotV1,sealTavernLoreSnapshotV1,
  LORE_EVALUATOR_POLICY_V1,LORE_EVALUATOR_POLICY_SHA256} from './tavern-lore-snapshot.mjs'
import {TavernLoreScanBufferV1,nextLoreScanStateV1} from './tavern-lore-scan.mjs'
import {TavernLoreTimedStateV1} from './tavern-lore-timed.mjs'
import {TavernLoreTemplateFeedbackStateV1} from './tavern-lore-template-feedback.mjs'
import type {TavernLoreEntryPlanV1,TavernLoreSemanticEntryV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreEvaluationV1,TavernLoreFrozenSnapshotV1,TavernLoreEntryDecisionV1,
  TavernLorePlacementV1,TavernLoreEvaluationPlanV1,TavernLorePreparedEvaluationV1,
  TavernLoreTokenCountProducerV1,TavernLoreEvaluatorInputV1,TavernLoreTemplateProducerV1,
  TavernLoreScanStateV1,TavernLoreScanTraceV1,TavernLorePreparationOwnerV1} from './tavern-lore-evaluator-types.mjs'

type Mutable<T>={-readonly [K in keyof T]:T[K]}
interface Candidate {
  entry:TavernLoreEntryPlanV1
  semantic:TavernLoreSemanticEntryV1
  text:string
  sticky:boolean
  decision:Mutable<TavernLoreEntryDecisionV1>
}
const semantics=(entry:TavernLoreEntryPlanV1):TavernLoreSemanticEntryV1=>({
  ...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,...entry.semanticOverrides,
}) as TavernLoreSemanticEntryV1
function secondaryPass(semantic:TavernLoreSemanticEntryV1,matches:readonly boolean[]):boolean {
  if(!semantic.selective||!matches.length)return true
  if(semantic.selectiveLogic==='and-any')return matches.some(Boolean)
  if(semantic.selectiveLogic==='not-all')return !matches.every(Boolean)
  if(semantic.selectiveLogic==='not-any')return !matches.some(Boolean)
  return matches.every(Boolean)
}
function score(semantic:TavernLoreSemanticEntryV1,primary:readonly boolean[],secondary:readonly boolean[]):number {
  if(!primary.length)return 0
  const first=primary.filter(Boolean).length,last=secondary.filter(Boolean).length
  return secondary.length&&(semantic.selectiveLogic==='and-any'
    ||semantic.selectiveLogic==='and-all'&&secondary.every(Boolean))?first+last:first
}
function seededRoll(snapshot:TavernLoreFrozenSnapshotV1,domain:string):number {
  const digest=recordSha256({policy:snapshot.settings.seedPolicy,seed:snapshot.seed,branchId:snapshot.branchId,
    turnId:snapshot.turnId,attemptId:snapshot.attemptId,compilerPlanSha256:snapshot.compilerPlanSha256,domain})
  return (Number.parseInt(digest.slice(0,13),16)+0.5)/4503599627370496
}
function inclusionGroups(candidates:Candidate[],activated:readonly Candidate[],snapshot:TavernLoreFrozenSnapshotV1,
  timed:TavernLoreTimedStateV1,loop:number):Candidate[] {
  const grouped=new Map<string,Candidate[]>()
  for(const item of candidates) {
    if(!item.semantic.group)continue
    if(item.semantic.group.includes(','))refuse('LORE_MULTI_GROUP_UNSUPPORTED',item.entry.entryId)
    const rows=grouped.get(item.semantic.group)??[]
    rows.push(item);grouped.set(item.semantic.group,rows)
  }
  const losers=new Set<string>()
  for(const [group,rows] of grouped) {
    const sticky=rows.filter(item=>item.sticky)
    if(sticky.length) {
      // Fixed timed group filtering preserves all sticky members, then removes
      // cooldown entries even if the pre-group sticky gate admitted them.
      for(const item of rows)if(!item.sticky||timed.cooldown(item.entry.entryId))losers.add(item.entry.entryId)
      continue
    }
    if(activated.some(item=>item.semantic.group===group)) {
      for(const item of rows)losers.add(item.entry.entryId)
      continue
    }
    let remaining=rows
    if(snapshot.settings.useGroupScoring||rows.some(item=>item.semantic.useGroupScoring===true)) {
      const maximum=Math.max(...rows.map(item=>item.decision.groupScore))
      remaining=rows.filter(item=>!(item.semantic.useGroupScoring??snapshot.settings.useGroupScoring)
        ||item.decision.groupScore===maximum)
    }
    const priority=remaining.filter(item=>item.semantic.groupOverride)
      .sort((a,b)=>b.semantic.order-a.semantic.order||a.entry.ordinal-b.entry.ordinal)
    let winner=priority[0]??remaining[0]
    if(!priority.length&&remaining.length>1) {
      const total=remaining.reduce((value,item)=>value+item.semantic.groupWeight,0)
      if(!Number.isFinite(total)||total<0||total>Number.MAX_SAFE_INTEGER
        ||remaining.some(item=>item.semantic.groupWeight<0))refuse('LORE_GROUP_WEIGHT_UNSUPPORTED')
      const roll=seededRoll(snapshot,`group:${group}:loop:${loop}`)*total
      let current=0
      for(const item of remaining){current+=item.semantic.groupWeight;if(roll<=current){winner=item;break}}
    }
    for(const item of rows)if(item!==winner)losers.add(item.entry.entryId)
  }
  for(const item of candidates)if(losers.has(item.entry.entryId))item.decision.decision='group-loser'
  return candidates.filter(item=>!losers.has(item.entry.entryId))
}
function placementsOf(activated:Candidate[]):TavernLorePlacementV1[] {
  const slots=new Map<string,Candidate[]>()
  // Fixed final placement sorts all passes together by order, not the discovery
  // round. Source ordinal provides the fixed stable-sort tie order.
  const sorted=[...activated].sort((a,b)=>b.semantic.order-a.semantic.order||a.entry.ordinal-b.entry.ordinal)
  for(const item of sorted) {
    const semantic=item.semantic
    if(!item.text){item.decision.decision='empty-content';continue}
    if(semantic.position==='named-outlet'&&!semantic.outletName)refuse('LORE_OUTLET_NAME_REQUIRED',item.entry.entryId)
    const slot=JSON.stringify([semantic.position,semantic.position==='at-chat-depth'?semantic.role:null,
      semantic.position==='at-chat-depth'?semantic.depth:null,semantic.position==='named-outlet'?semantic.outletName:null])
    const rows=slots.get(slot)??[]
    if(semantic.position==='named-outlet')rows.push(item)
    else rows.unshift(item)
    slots.set(slot,rows)
  }
  const result:TavernLorePlacementV1[]=[]
  for(const rows of slots.values())rows.forEach((item,slotIndex)=>result.push({entryId:item.entry.entryId,
    sourcePointer:item.semantic.content.pointer,sourceContentSha256:item.semantic.content.contentSha256,
    effectiveContentSha256:schemaTextSha256(item.text),position:item.semantic.position,role:item.semantic.role,
    depth:item.semantic.depth,order:item.semantic.order,
    roleDisposition:item.semantic.position==='at-chat-depth'?'at-depth-role':'slot-owner-role',
    depthDisposition:item.semantic.position==='at-chat-depth'?'at-depth-distance':'slot-owner-anchor',
    outletName:item.semantic.outletName,slotIndex,text:item.text}))
  return result
}
function rawEvaluatorInput(input:unknown):TavernLoreEvaluatorInputV1 {
  if(input===null||typeof input!=='object')refuse('LORE_EVALUATOR_INPUT_INVALID')
  if(types.isProxy(input))throw Error('SCHEMA_PROXY_VALUE')
  const prototype=Object.getPrototypeOf(input)
  if(Array.isArray(input)||prototype!==Object.prototype&&prototype!==null)throw Error('SCHEMA_OBJECT_PROTOTYPE')
  const value:Record<string,unknown>={}
  for(const key of Reflect.ownKeys(input)) {
    if(typeof key!=='string')throw Error('SCHEMA_NON_JSON_VALUE')
    const descriptor=Object.getOwnPropertyDescriptor(input,key)!
    if(!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw Error('SCHEMA_NON_JSON_VALUE')
    Object.defineProperty(value,key,{value:descriptor.value,enumerable:true})
  }
  exact(value,['schemaVersion','encoding','compilation','snapshot'])
  if(value.schemaVersion!==1||value.encoding!=='owned-st-lore-evaluator-input-v1')refuse('LORE_EVALUATOR_INPUT_INVALID')
  return {schemaVersion:1,encoding:'owned-st-lore-evaluator-input-v1',
    compilation:validateTavernLoreCompilationV1(value.compilation),
    snapshot:validateTavernLoreSnapshotV1(value.snapshot)}
}
async function evaluate(input:TavernLoreEvaluatorInputV1,producer?:TavernLoreTokenCountProducerV1,
  templateProducer?:TavernLoreTemplateProducerV1,owner?:TavernLorePreparationOwnerV1)
  :Promise<Extract<TavernLorePreparedEvaluationV1,{kind:'prepared'}>> {
  const ownerCurrent=owner?.assertCurrent
  if(owner&&(typeof ownerCurrent!=='function'||!producer||!templateProducer))refuse('LORE_PREPARATION_OWNER_INVALID')
  const compilation=input.compilation,plan=compilation.plan
  let snapshot=input.snapshot
  const began=performance.now()
  const checkpoint=()=>{
    if(producer?.signal?.aborted||templateProducer?.signal?.aborted)refuse('LORE_PREPARATION_CANCELLED')
    if((producer||templateProducer)&&performance.now()-began>10_000)refuse('LORE_PREPARATION_DEADLINE')
  }
  const ownerCheckpoint=()=>{
    checkpoint()
    if(owner) {
      ownerCurrent!.call(owner)
    }else {
      producer?.assertCurrent();templateProducer?.assertCurrent()
    }
  }
  const boundary=async<T,>(operation:()=>T|Promise<T>):Promise<T>=>{
    ownerCheckpoint()
    const result=await operation()
    ownerCheckpoint()
    return result
  }
  ownerCheckpoint()
  if(producer&&(snapshot.tokenizer.identity!==producer.identity
    ||snapshot.tokenizer.implementationSha256!==producer.implementationSha256
    ||snapshot.tokenizer.method!==producer.method||snapshot.tokenizer.counts.length!==0))refuse('LORE_TOKEN_PRODUCER_MISMATCH')
  if(snapshot.compilerPlanSha256!==plan.planSha256||snapshot.sourceReferenceSha256!==plan.sourceReferenceSha256
    ||snapshot.sourceSnapshotSha256!==plan.source.sourceSnapshotSha256)refuse('LORE_EVALUATOR_SOURCE_MISMATCH')
  const eligible=(entry:TavernLoreEntryPlanV1)=>{
    if(entry.disposition!=='retained-ineligible')return true
    const blocking=entry.diagnosticIndexes.map(index=>compilation.diagnostics[index]!).filter(row=>row.blocking)
    return blocking.length>0&&blocking.every(row=>row.code==='LORE_VECTORIZED_EVALUATOR_REQUIRED')
  }
  const items=plan.entries.map(entry=>({entry,semantic:semantics(entry),eligible:eligible(entry)}))
  for(const item of items)if(!item.semantic.enabled) {
    const invalidEnabled=item.entry.diagnosticIndexes.some(index=>{
      const diagnostic=compilation.diagnostics[index]!
      return diagnostic.blocking&&diagnostic.code==='LORE_FIELD_VALUE_UNSUPPORTED'
        &&diagnostic.pointer===`${item.entry.sourcePointer}/enabled`
    })
    const explicitlyDisabled=item.entry.fieldSources.some(row=>row.field==='enabled'
      &&row.disposition==='current-native-origin'&&row.valueSha256===recordSha256(false))
    if(invalidEnabled&&!explicitlyDisabled)refuse('LORE_COMPILER_INPUT_INELIGIBLE',item.entry.entryId)
  }
  if(plan.bookDisposition!=='eligible-semantic-data'&&items.some(item=>item.semantic.enabled))refuse('LORE_COMPILER_INPUT_INELIGIBLE')
  const diagnostics:{code:string;entryId:string}[]=[]
  const decisions:Mutable<TavernLoreEntryDecisionV1>[]=items.map(({entry,semantic})=>({
    entryId:entry.entryId,rawEntrySha256:entry.rawEntrySha256,decision:'disabled',primaryMatches:[],secondaryMatches:[],
    groupScore:0,probabilityRoll:null,sourceContentSha256:semantic.content?.contentSha256??null,
    effectiveContentSha256:semantic.content?.contentSha256??null}))
  for(const item of items)if(item.semantic.enabled) {
    if(!item.eligible)refuse('LORE_COMPILER_INPUT_INELIGIBLE',item.entry.entryId)
    if(item.semantic.automationId||item.semantic.triggers.length)refuse('LORE_ENTRY_CONTROL_UNSUPPORTED',item.entry.entryId)
    if(item.semantic.vectorized)diagnostics.push({code:'LORE_VECTORIZED_KEYWORD_FALLBACK',entryId:item.entry.entryId})
  }
  const byId=new Map(items.map(item=>[item.entry.entryId,item] as const))
  const timed=new TavernLoreTimedStateV1(snapshot.timed,byId),buffer=new TavernLoreScanBufferV1(snapshot)
  const templates=new TavernLoreTemplateFeedbackStateV1(plan,snapshot,eligible,checkpoint,templateProducer,producer?.signal)
  const matcher=new TavernLoreBoundedMatcherV1(checkpoint),activated:Candidate[]=[],admitted=new Set<string>()
  const failedProbability=new Set<string>(),queued=new Set<string>(),feedbackSeen=new Set<string>()
  const externalActivations=new Set<string>(),standaloneSelected=new Set<string>()
  const initialInjection=await boundary(()=>templates.scan(0,'initial','before-initial'))
  checkpoint()
  for(const contribution of initialInjection.contributions)buffer.inject(contribution.text)
  for(const proposal of initialInjection.activationProposals)externalActivations.add(proposal.entryId)
  const counts=new Map(snapshot.tokenizer.counts.map(row=>[row.textSha256,row.tokens]))
  let countWorkBytes=0,renderedBytes=0,consumed=0,overflowed=false,cumulative='',loop=0
  const count=async(text:string):Promise<number>=>{
    checkpoint()
    const hash=schemaTextSha256(text),cached=counts.get(hash)
    if(cached!==undefined)return cached
    if(!producer)refuse('LORE_TOKEN_COUNT_MISSING')
    if(counts.size>=4096)refuse('LORE_TOKEN_COUNT_LIMIT')
    countWorkBytes+=Buffer.byteLength(text,'utf8')
    if(countWorkBytes>16_777_216)refuse('LORE_TOKEN_COUNT_WORK_LIMIT')
    const tokens=await boundary(()=>producer.count(text,producer.signal))
    checkpoint()
    if(!Number.isSafeInteger(tokens)||tokens<0||tokens>10_000_000)refuse('LORE_TOKEN_PRODUCER_RESULT_INVALID')
    counts.set(hash,tokens);return tokens
  }
  const delayLevels=[...new Set(items.map(item=>item.semantic.delayUntilRecursion===true?1:
    Number(item.semantic.delayUntilRecursion)).filter(level=>level>0))].sort((a,b)=>a-b)
  let delayLevel=delayLevels.shift()??0,state:TavernLoreScanStateV1|null='initial'
  let termination:TavernLoreEvaluationPlanV1['termination']='converged'
  const trace:TavernLoreScanTraceV1[]=[]
  while(state) {
    checkpoint()
    if(snapshot.settings.maxRecursionSteps>0&&loop>=snapshot.settings.maxRecursionSteps) {
      termination='configured-step-limit';break
    }
    if(++loop>LORE_EVALUATOR_POLICY_V1.bounds.scanSteps)refuse('LORE_SCAN_STEP_LIMIT')
    const scanState=state,scanDepth=buffer.depth,scanDelayLevel=delayLevel,candidates:Candidate[]=[]
    queued.clear()
    for(const [index,item] of items.entries()) {
      checkpoint()
      const {entry,semantic}=item,decision=decisions[index]!
      if(!semantic.enabled||admitted.has(entry.entryId)||failedProbability.has(entry.entryId))continue
      const sticky=timed.sticky(entry.entryId)
      if(timed.delay(item)){decision.decision='delay';continue}
      if(timed.cooldown(entry.entryId)&&!sticky){decision.decision='cooldown';continue}
      const delayed=semantic.delayUntilRecursion===true?1:Number(semantic.delayUntilRecursion)
      if(!sticky&&(scanState!=='recursion'&&delayed>0||scanState==='recursion'&&delayed>delayLevel)) {
        decision.decision='waiting-recursion';continue
      }
      if(!sticky&&scanState==='recursion'&&snapshot.settings.recursiveScanning&&semantic.excludeRecursion) {
        decision.decision='excluded-recursion';continue
      }
      let primary:boolean[]=[],secondary:boolean[]=[]
      const immediate=semantic.constant||sticky||externalActivations.has(entry.entryId)
      if(!immediate) {
        const haystack=buffer.text(semantic,scanState)
        primary=await boundary(()=>matcher.matches(haystack,semantic.primaryKeys,
          semantic.caseSensitive??snapshot.settings.caseSensitive,semantic.matchWholeWords??snapshot.settings.matchWholeWords))
        checkpoint()
        if(!primary.some(Boolean)){decision.decision='keys-unmatched';continue}
        secondary=await boundary(()=>matcher.matches(haystack,semantic.secondaryKeys,
          semantic.caseSensitive??snapshot.settings.caseSensitive,semantic.matchWholeWords??snapshot.settings.matchWholeWords))
        checkpoint()
        if(!secondaryPass(semantic,secondary)){decision.decision='secondary-unmatched';continue}
      }
      decision.primaryMatches=primary;decision.secondaryMatches=secondary;decision.groupScore=score(semantic,primary,secondary)
      candidates.push({entry,semantic,text:'',sticky,decision})
    }
    // Constants/sticky/forced activations bypass key admission but group scoring
    // still scans their keys when any member enables that fixed group policy.
    for(const item of candidates)if(item.semantic.group&&(snapshot.settings.useGroupScoring
      ||candidates.some(peer=>peer.semantic.group===item.semantic.group&&peer.semantic.useGroupScoring===true))) {
      const haystack=buffer.text(item.semantic,scanState)
      const primary=await boundary(()=>matcher.matches(haystack,item.semantic.primaryKeys,
        item.semantic.caseSensitive??snapshot.settings.caseSensitive,item.semantic.matchWholeWords??snapshot.settings.matchWholeWords))
      const secondary=await boundary(()=>matcher.matches(haystack,item.semantic.secondaryKeys,
        item.semantic.caseSensitive??snapshot.settings.caseSensitive,item.semantic.matchWholeWords??snapshot.settings.matchWholeWords))
      checkpoint()
      item.decision.groupScore=score(item.semantic,primary,secondary)
    }
    candidates.sort((a,b)=>Number(b.sticky)-Number(a.sticky)||b.semantic.order-a.semantic.order||a.entry.ordinal-b.entry.ordinal)
    const grouped=inclusionGroups(candidates,activated,snapshot,timed,loop),baseText=buffer.budgetBaseText
    const baseTokens=await count(baseText),selectedIds:string[]=[],newIds:string[]=[],probabilityIds:string[]=[]
    const feedback:TavernLoreScanTraceV1['feedback'][number][]=[],rendered:Candidate[]=[]
    cumulative='';consumed=baseTokens
    for(const item of grouped) {
      checkpoint()
      if(overflowed&&!item.semantic.ignoreBudget){item.decision.decision='budget-excluded';continue}
      if(!item.sticky&&item.semantic.useProbability&&item.semantic.probability!==100) {
        const roll=seededRoll(snapshot,`probability:${item.entry.entryId}:loop:${loop}`)*100
        item.decision.probabilityRoll=roll
        if(roll>item.semantic.probability) {
          failedProbability.add(item.entry.entryId);probabilityIds.push(item.entry.entryId)
          queued.delete(item.entry.entryId)
          item.decision.decision='probability-failed';continue
        }
      }
      selectedIds.push(item.entry.entryId)
      const result=await boundary(()=>templates.selected(item.entry,item.semantic,loop,scanState))
      checkpoint()
      standaloneSelected.add(item.entry.entryId)
      item.text=result.text;item.decision.effectiveContentSha256=schemaTextSha256(result.text)
      renderedBytes+=Buffer.byteLength(result.text,'utf8')
      if(renderedBytes>2_000_000)refuse('LORE_EFFECTIVE_CONTENT_LIMIT')
      rendered.push(item)
      for(const proposal of result.proposals) {
        const disposition=admitted.has(proposal.entryId)||standaloneSelected.has(proposal.entryId)
          ||failedProbability.has(proposal.entryId)
          ?'already-seen':feedbackSeen.has(proposal.entryId)?'duplicate':'queued'
        feedback.push({entryId:proposal.entryId,disposition})
        feedbackSeen.add(proposal.entryId)
        if(disposition==='queued'){queued.add(proposal.entryId);externalActivations.add(proposal.entryId)}
      }
      // Count each pass's newContent separately from the recursive base text.
      // Keep an overflow candidate in newContent for later ignoreBudget queries.
      cumulative+=`${item.text}\n`
      if(Buffer.byteLength(cumulative,'utf8')>2_000_000)refuse('LORE_BUDGET_TEXT_LIMIT')
      consumed=baseTokens+await count(cumulative)
      if(!item.semantic.ignoreBudget&&consumed>=snapshot.settings.budgetTokens) {
        overflowed=true;item.decision.decision='budget-excluded';continue
      }
      item.decision.decision='activated';activated.push(item);admitted.add(item.entry.entryId);newIds.push(item.entry.entryId)
      queued.delete(item.entry.entryId)
    }
    const injection=await boundary(()=>templates.scan(loop,scanState,'after-selected'))
    checkpoint()
    for(const contribution of injection.contributions)buffer.inject(contribution.text)
    for(const proposal of injection.activationProposals) {
      const disposition=admitted.has(proposal.entryId)||standaloneSelected.has(proposal.entryId)
        ||failedProbability.has(proposal.entryId)
        ?'already-seen':feedbackSeen.has(proposal.entryId)?'duplicate':'queued'
      feedback.push({entryId:proposal.entryId,disposition});feedbackSeen.add(proposal.entryId)
      if(disposition==='queued'){queued.add(proposal.entryId);externalActivations.add(proposal.entryId)}
    }
    const recursing=grouped.filter(item=>!failedProbability.has(item.entry.entryId)&&!item.semantic.preventRecursion)
    let next=nextLoreScanStateV1({snapshot,buffer,state:scanState,overflowed,recursingEntries:recursing.length,
      activatedCount:admitted.size,remainingDelayLevels:delayLevels.length})
    // Template activation is a declared program extension of the fixed scan
    // hook. It schedules one bounded extra scan even without keyword recursion.
    if((queued.size||injection.contributions.some(row=>row.text))&&!next.state)next={state:'recursion',advanceDelay:false}
    if(next.advanceDelay)delayLevel=delayLevels.shift()!
    const scanOnly:TavernLoreScanTraceV1['scanOnly'][number][]=[],renderedIds=new Set(rendered.map(item=>item.entry.entryId))
    if(next.state) {
      const texts=recursing.map(item=>{
        if(renderedIds.has(item.entry.entryId))return item.text
        // Fixed source 5080/5130/5140 includes overflow-skipped candidates in
        // successfulNewEntries. This is raw scan input, never VM execution,
        // a rendered receipt, a final activation or a placement.
        if(!overflowed)refuse('LORE_RECURSION_SOURCE_UNPROVEN',item.entry.entryId)
        const raw=resolveTavernLoreContentTextV1(plan,item.semantic.content.pointer)
        scanOnly.push({entryId:item.entry.entryId,pointer:raw.pointer,contentSha256:raw.contentSha256,
          disposition:'scan-only-after-overflow',loop})
        return raw.text
      })
      buffer.feedback(texts.join('\n'))
    }
    trace.push({loop,state:scanState,depth:scanDepth,recursionDelayLevel:scanDelayLevel,selectedEntryIds:selectedIds,
      admittedEntryIds:newIds,probabilityFailedEntryIds:probabilityIds,feedback,
      baseTextSha256:schemaTextSha256(baseText),candidateTextSha256:schemaTextSha256(cumulative),scanOnly,nextState:next.state})
    state=next.state
  }
  snapshot=templates.final()
  if(producer)snapshot=sealTavernLoreSnapshotV1({...snapshot,
    tokenizer:{...snapshot.tokenizer,counts:[...counts].map(([textSha256,tokens])=>({textSha256,tokens}))}})
  ownerCheckpoint()
  timed.activated(activated.map(item=>item.entry.entryId))
  const placements=placementsOf(activated)
  const descriptor:Omit<TavernLoreEvaluationPlanV1,'planSha256'>={schemaVersion:1,
    encoding:'owned-st-lore-evaluation-plan-v1',authority:'consumer-data-only',evaluatorPolicySha256:LORE_EVALUATOR_POLICY_SHA256,
    snapshotSha256:snapshot.snapshotSha256,compilerPlanSha256:plan.planSha256,sourceReferenceSha256:plan.sourceReferenceSha256,
    branchId:snapshot.branchId,sessionId:snapshot.sessionId,turnId:snapshot.turnId,attemptId:snapshot.attemptId,
    decisions,activatedEntryIds:activated.map(item=>item.entry.entryId),scanTrace:trace,termination,diagnostics,placements,
    budget:{limitTokens:snapshot.settings.budgetTokens,consumedCandidateTokens:consumed,
      cumulativeCandidateTextSha256:schemaTextSha256(cumulative),overflowed,countMethod:snapshot.tokenizer.method},
    timedProposal:{schemaVersion:1,encoding:'owned-st-timed-proposals-v1',branchId:snapshot.branchId,
      baseRevision:snapshot.revision,baseSha256:snapshot.timedSha256,chatIndex:snapshot.timed.chatIndex,
      actions:timed.actions,disposition:timed.actions.length?'proposed-consumer-data-only':'empty-no-timed-effects'}}
  const finalPlan=freezeLoreData(cloneRoleplayTavernLoreDataV1({...descriptor,planSha256:recordSha256(descriptor)},
    LORE_EVALUATOR_POLICY_V1.bounds.outputBytes,{nodes:131072,depth:66}) as unknown as TavernLoreEvaluationPlanV1)
  const finalInput=Object.freeze({schemaVersion:1 as const,
    encoding:'owned-st-lore-evaluator-input-v1' as const,compilation,snapshot} satisfies TavernLoreEvaluatorInputV1)
  return Object.freeze({kind:'prepared',input:finalInput,plan:finalPlan})
}
function refusal(error:unknown):Extract<TavernLoreEvaluationV1,{kind:'refused'}> {
  const code=error instanceof LoreEvaluationRefusal?error.code
    :error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)?error.message:'LORE_EVALUATION_REFUSED'
  return freezeLoreData({kind:'refused',diagnostics:[{schemaVersion:1,code,
    entryId:error instanceof LoreEvaluationRefusal?error.entryId:null,
    pointer:error instanceof LoreEvaluationRefusal?error.pointer:null,blocking:true}]})
}
export async function evaluateTavernLoreV1(input:unknown):Promise<TavernLoreEvaluationV1> {
  try {const result=await evaluate(rawEvaluatorInput(input));return freezeLoreData({kind:'evaluated',plan:result.plan})}
  catch(error){return refusal(error)}
}
export async function prepareTavernLoreV1(input:unknown,producer:TavernLoreTokenCountProducerV1,
  templateProducer?:TavernLoreTemplateProducerV1):Promise<TavernLorePreparedEvaluationV1> {
  try{return await evaluate(rawEvaluatorInput(input),producer,templateProducer)}catch(error){return refusal(error)}
}
export async function prepareTavernLoreWithOwnerV1(input:unknown,owner:TavernLorePreparationOwnerV1)
  :Promise<TavernLorePreparedEvaluationV1> {
  try {
    if(!owner||typeof owner.assertCurrent!=='function')refuse('LORE_PREPARATION_OWNER_INVALID')
    return await evaluate(rawEvaluatorInput(input),owner.tokenCount,owner.templates,owner)
  }catch(error){return refusal(error)}
}
/** Core supplies its already compiled DATA and parsed frozen snapshot. The
 * actual owner still controls every asynchronous producer boundary below. */
export async function prepareOwnedTavernLoreWithOwnerV1(input:TavernLoreEvaluatorInputV1,
  owner:TavernLorePreparationOwnerV1):Promise<TavernLorePreparedEvaluationV1> {
  try {return await evaluate(input,owner.tokenCount,owner.templates,owner)}
  catch(error){return refusal(error)}
}
export async function validateTavernLoreEvaluationV1(input:unknown,result:unknown)
  :Promise<Extract<TavernLoreEvaluationV1,{kind:'evaluated'}>> {
  const value=cloneRoleplayTavernLoreDataV1(result,LORE_EVALUATOR_POLICY_V1.bounds.outputBytes,{nodes:131072,depth:66})
  const rebuilt=await evaluateTavernLoreV1(input)
  if(rebuilt.kind!=='evaluated'||recordSha256(value)!==recordSha256(rebuilt))refuse('LORE_EVALUATION_RECOMPUTATION_MISMATCH')
  return rebuilt
}
