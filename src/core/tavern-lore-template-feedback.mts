/** Standalone selected-entry rendering and replay ledger. Nested frames remain
 * invocation-scoped Root audit; they never replace another entry's receipt. */
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,schemaTextSha256} from './tavern-mvu-schema-data.js'
import {resolveTavernLoreEvaluationContentV1,isTavernLoreDerivedEntryV1,tavernLoreEvaluationSemanticV1,
  tavernLoreOriginalEvaluationEntryV1}
  from './tavern-lore-derived.mjs'
import {exact,sealTavernLoreSnapshotV1,LORE_EVALUATOR_POLICY_V1,freezeLoreData} from './tavern-lore-snapshot.mjs'
import {refuse} from './tavern-lore-match.mjs'
import {tavernLoreEntrySemanticSha256V1} from './tavern-lore-timed.mjs'
import {hasTavernPromptMacroSyntaxV1} from './tavern-prompt-transform-execution.mjs'
import type {TavernLoreSemanticEntryV1,TavernLoreCompilationV1}
  from './tavern-lore-plan-types.mjs'
import type {TavernLoreEvaluationCompositionV1,TavernLoreEvaluationEntryV1} from './tavern-lore-derived.mjs'
import type {TavernLoreFrozenSnapshotV1,TavernLoreTemplateProducerV1,TavernLoreTemplateFeedbackV1,
  TavernLoreSelectedTemplateRequestV1,TavernLoreScanStateV1,TavernLoreTemplateActivationV1,
  TavernLoreRenderedTextV1} from './tavern-lore-evaluator-types.mjs'
import type {TavernLoreInjectionFeedbackV1} from './tavern-lore-evaluator-types.mjs'

export class TavernLoreTemplateFeedbackStateV1 {
  private snapshot:TavernLoreFrozenSnapshotV1
  private readonly receipts=new Map<string,TavernLoreRenderedTextV1>()
  private readonly pendingKeyReceipts:TavernLoreRenderedTextV1[]=[]
  private readonly rows=new Map<string,TavernLoreTemplateFeedbackV1>()
  private readonly consumed=new Set<string>()
  private readonly scanRows=new Map<string,TavernLoreInjectionFeedbackV1>()
  private readonly consumedScans=new Set<string>()
  private readonly activationModes=new Map<string,NonNullable<TavernLoreTemplateActivationV1['mode']>>()
  private readonly activatedSources=new Map<string,{pointer:string;text:string;contentSha256:string;bodyOffset:number;
    semantic:TavernLoreSemanticEntryV1}>()
  constructor(private readonly composition:TavernLoreEvaluationCompositionV1,snapshot:TavernLoreFrozenSnapshotV1,
    private readonly activationTargets:ReadonlyMap<string,{readonly entry:TavernLoreEvaluationEntryV1;
      semantic:TavernLoreSemanticEntryV1;eligible:boolean;readonly sourceEligible:boolean}>,
    private readonly checkpoint:()=>void,private readonly producer?:TavernLoreTemplateProducerV1,
    private readonly defaultSignal?:AbortSignal,
    private readonly compilation?:Extract<TavernLoreCompilationV1,{kind:'compiled'}>,
    private readonly changed?:(entryId:string)=>void) {
    this.snapshot=snapshot
    if(producer&&(snapshot.renderedTexts.length||(snapshot.activationFeedback?.length??0)
      ||(snapshot.injectionFeedback?.length??0))) {
      refuse('LORE_TEMPLATE_PREPARATION_NOT_FRESH')
    }
    for(const proposal of composition.ordinaryPreparation?.activationProposals??[])if(proposal.mode)this.source(proposal)
    for(const row of snapshot.activationFeedback??[])for(const proposal of row.activationProposals)
      if(proposal.mode)this.source(proposal)
    for(const row of snapshot.injectionFeedback??[])for(const proposal of row.activationProposals)
      if(proposal.mode)this.source(proposal)
    for(const receipt of snapshot.renderedTexts) {
      const resolved=this.resolveText(receipt.pointer)
      if(resolved.contentSha256!==receipt.rawContentSha256)refuse('LORE_TEMPLATE_SOURCE_MISMATCH')
      this.receipts.set(receipt.pointer,receipt)
    }
    for(const row of snapshot.activationFeedback??[])this.rows.set(row.request.entryId,row)
    for(const row of snapshot.injectionFeedback??[])this.scanRows.set(`${row.loop}:${row.stage}`,row)
  }
  private resolveText(pointer:string):{contentSha256:string} {
    const activated=this.activatedSources.get(pointer)
    if(activated)return activated
    for(const source of this.activatedSources.values())for(const field of ['primaryKeys','secondaryKeys'] as const) {
      const prefix=source.pointer.slice(0,-'/content'.length)+`/@${field}/`
      if(!pointer.startsWith(prefix))continue
      const index=Number(pointer.slice(prefix.length)),keys=source.semantic[field]
      if(!Number.isSafeInteger(index)||index<0||index>=keys.length||`${prefix}${index}`!==pointer)
        refuse('LORE_KEY_RECEIPT_POINTER_INVALID')
      return {contentSha256:schemaTextSha256(keys[index]!)}
    }
    for(const entry of this.composition.entries) {
      if(isTavernLoreDerivedEntryV1(entry))continue
      for(const field of ['primaryKeys','secondaryKeys'] as const) {
        const prefix=`${entry.sourcePointer}/@${field}/`
        if(!pointer.startsWith(prefix))continue
        const index=Number(pointer.slice(prefix.length)),keys=tavernLoreEvaluationSemanticV1(entry)[field]
        if(!Number.isSafeInteger(index)||index<0||index>=keys.length||`${prefix}${index}`!==pointer)
          refuse('LORE_KEY_RECEIPT_POINTER_INVALID',entry.entryId)
        return {contentSha256:schemaTextSha256(keys[index]!)}
      }
    }
    return resolveTavernLoreEvaluationContentV1(this.composition,pointer)
  }
  async keys(entry:TavernLoreEvaluationEntryV1,field:'primaryKeys'|'secondaryKeys'):Promise<readonly string[]> {
    const semantic=this.activationTargets.get(entry.entryId)?.semantic??tavernLoreEvaluationSemanticV1(entry),
      keys=semantic[field],result:string[]=[]
    if(!this.activationModes.has(entry.entryId)&&'ordinaryChange' in entry&&entry.ordinaryChange.preprocessed)return keys
    for(const [index,text] of keys.entries()) {
      const templated=this.snapshot.settings.macroPolicy==='frozen-key-alias-receipt-v2'
        ?hasTavernPromptMacroSyntaxV1(text):text.includes('{{')
      if(!templated){result.push(text);continue}
      if(isTavernLoreDerivedEntryV1(entry))refuse('LORE_KEY_TEMPLATE_UNRENDERED',entry.entryId)
      const keyBase=this.activationModes.has(entry.entryId)?`/prepared/template-activation/${entry.entryId}`:entry.sourcePointer,
        pointer=`${keyBase}/@${field}/${index}`
      let receipt=this.receipts.get(pointer)
      if(!receipt&&this.producer?.renderKey) {
        this.checkpoint()
        const supplied=await this.producer.renderKey({entryId:entry.entryId,pointer,text},
          this.producer.signal??this.defaultSignal)
        this.checkpoint()
        if(supplied.pointer!==pointer||supplied.rawContentSha256!==schemaTextSha256(text)
          ||supplied.rendererIdentity!==this.producer.identity
          ||supplied.rendererImplementationSha256!==this.producer.implementationSha256)
          refuse('LORE_KEY_PRODUCER_MISMATCH',entry.entryId)
        this.pendingKeyReceipts.push(supplied)
        this.receipts.set(pointer,supplied)
        receipt=supplied
      }
      if(!receipt)refuse('LORE_KEY_TEMPLATE_UNRENDERED',entry.entryId,pointer)
      result.push(receipt.renderedText)
    }
    return result
  }
  async scan(loop:number,state:TavernLoreScanStateV1,stage:TavernLoreInjectionFeedbackV1['stage']) {
    const key=`${loop}:${stage}`
    if(this.consumedScans.has(key))refuse('LORE_INJECTION_SCAN_REPEATED')
    let row=this.scanRows.get(key)
    if(this.producer?.consumeScan) {
      this.checkpoint()
      const result=await this.producer.consumeScan({loop,state,stage},this.producer.signal??this.defaultSignal)
      this.checkpoint()
      const output=cloneSchemaData(result,LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes,{nodes:100000,depth:48})
      exact(output,['contributions','activationProposals'])
      if(Array.isArray(output.contributions)&&!output.contributions.length
        &&Array.isArray(output.activationProposals)&&!output.activationProposals.length) {
        this.consumedScans.add(key)
        return {contributions:[],activationProposals:[]} as const
      }
      const body={loop,state,stage,contributions:output.contributions,activationProposals:output.activationProposals,
        producerIdentity:this.producer.identity,producerImplementationSha256:this.producer.implementationSha256}
      row={...body,feedbackSha256:recordSha256(body)} as TavernLoreInjectionFeedbackV1
      this.snapshot=sealTavernLoreSnapshotV1({...this.snapshot,injectionFeedback:[...(this.snapshot.injectionFeedback??[]),row]})
      row=this.snapshot.injectionFeedback!.at(-1)!
      this.scanRows.set(key,row)
    }
    this.consumedScans.add(key)
    if(!row)return {contributions:[],activationProposals:[]} as const
    if(row.loop!==loop||row.state!==state||row.stage!==stage)refuse('LORE_INJECTION_SCAN_REPLAY_CHANGED')
    for(const proposal of row.activationProposals)this.activation(proposal)
    return {contributions:row.contributions,activationProposals:row.activationProposals}
  }
  activation(proposal:TavernLoreTemplateActivationV1):void {
    const target=this.activationTargets.get(proposal.entryId),entry=target?.entry
    if(!entry||entry.rawEntrySha256!==proposal.rawEntrySha256)refuse('LORE_FEEDBACK_ENTRY_UNKNOWN',proposal.entryId)
    if(!proposal.mode) {
      if(!target!.semantic.enabled)refuse('LORE_FEEDBACK_ENTRY_DISABLED',entry.entryId)
      if(!target!.eligible)refuse('LORE_FEEDBACK_ENTRY_INELIGIBLE',entry.entryId)
      return
    }
    if(this.activationModes.get(entry.entryId)===proposal.mode)return
    const source=this.source(proposal),original=tavernLoreOriginalEvaluationEntryV1(entry)!,force=proposal.mode==='force-world-info'
    const blocking=original.diagnosticIndexes.map(index=>this.compilation?.diagnostics[index]).filter(row=>row?.blocking)
    const eligible=target!.sourceEligible||force&&blocking.length>0&&blocking.every(row=>
      row!.code==='LORE_VECTORIZED_EVALUATOR_REQUIRED'||row!.code==='LORE_TRIGGER_ENUM_PROFILE_REQUIRED')
    if(!eligible)refuse('LORE_FEEDBACK_ENTRY_INELIGIBLE',entry.entryId)
    const semantic=source.semantic
    target!.semantic={...semantic,enabled:true,delayUntilRecursion:force?false:semantic.vectorized,
      content:source.bodyOffset===0?semantic.content:{kind:'template-activated-source-text',pointer:source.pointer,
        contentSha256:source.contentSha256},
      ...force?{constant:true,cooldown:0,delay:0,vectorized:false,triggers:[],ignoreBudget:true,group:''}:{}}
    target!.eligible=true
    this.activationModes.set(entry.entryId,proposal.mode)
    this.changed?.(entry.entryId)
  }
  private source(proposal:TavernLoreTemplateActivationV1) {
    const entry=this.activationTargets.get(proposal.entryId)?.entry,original=entry&&tavernLoreOriginalEvaluationEntryV1(entry),
      program=proposal.sourceProgram,pointer=`/prepared/template-activation/${proposal.entryId}/content`,
      known=this.activatedSources.get(pointer)
    if(!original||original.rawEntrySha256!==proposal.rawEntrySha256||!program)refuse('LORE_FEEDBACK_ENTRY_UNKNOWN',proposal.entryId)
    if(known) {
      if(known.bodyOffset!==program.bodyOffset||known.contentSha256!==program.contentSha256)
        refuse('LORE_TEMPLATE_SOURCE_MISMATCH',proposal.entryId)
      return known
    }
    const semantic=tavernLoreEvaluationSemanticV1(original),raw=resolveTavernLoreEvaluationContentV1(this.composition,semantic.content.pointer),
      text=raw.text.slice(program.bodyOffset),contentSha256=program.bodyOffset===0?raw.contentSha256:schemaTextSha256(text)
    if(program.bodyOffset>raw.text.length||contentSha256!==program.contentSha256)refuse('LORE_TEMPLATE_SOURCE_MISMATCH',proposal.entryId)
    const source={pointer,text,contentSha256,bodyOffset:program.bodyOffset,semantic}
    this.activatedSources.set(pointer,source)
    return source
  }
  content(entry:TavernLoreEvaluationEntryV1,semantic:TavernLoreSemanticEntryV1) {
    if(semantic.content.kind==='template-activated-source-text') {
      const source=this.activatedSources.get(semantic.content.pointer)
      if(!source)refuse('LORE_TEMPLATE_SOURCE_MISMATCH',entry.entryId)
      return source
    }
    return resolveTavernLoreEvaluationContentV1(this.composition,semantic.content.pointer)
  }
  async selected(entry:TavernLoreEvaluationEntryV1,semantic:TavernLoreSemanticEntryV1,loop:number,state:TavernLoreScanStateV1)
    :Promise<{text:string;proposals:readonly TavernLoreTemplateActivationV1[]}> {
    const resolved=this.content(entry,semantic),activationMode=this.activationModes.get(entry.entryId)
    if(isTavernLoreDerivedEntryV1(entry)||!activationMode&&'ordinaryChange' in entry&&entry.ordinaryChange.preprocessed) {
      // Model output and completed prepass output are literal here. The latter
      // already has its actual execution in the same preparation audit.
      if(Buffer.byteLength(resolved.text,'utf8')>LORE_EVALUATOR_POLICY_V1.bounds.contentBytes)
        refuse('LORE_CONTENT_LIMIT',entry.entryId)
      return {text:resolved.text,proposals:[]}
    }
    const selection={schemaVersion:1 as const,encoding:'owned-st-lore-template-selection-v1',entryId:entry.entryId,
      rawEntrySha256:entry.rawEntrySha256,entrySemanticSha256:tavernLoreEntrySemanticSha256V1(semantic),
      pointer:resolved.pointer,rawContentSha256:resolved.contentSha256,attemptId:this.snapshot.attemptId,
      compilerPlanSha256:this.composition.sourcePlan.planSha256,loop,state,...activationMode?{activationMode}:{}}
    const request:TavernLoreSelectedTemplateRequestV1={...selection,
      encoding:'owned-st-lore-selected-template-request-v1',text:resolved.text,selectionSha256:recordSha256(selection)}
    let receipt=this.receipts.get(resolved.pointer),feedback=this.rows.get(entry.entryId)
    if(this.producer&&!receipt) {
      this.checkpoint()
      const result=await this.producer.render(freezeLoreData(request),this.producer.signal??this.defaultSignal)
      this.checkpoint()
      const output=cloneSchemaData(result,LORE_EVALUATOR_POLICY_V1.bounds.snapshotBytes,{nodes:100000,depth:48})
      exact(output,['receipt','activationProposals'])
      const supplied=output.receipt as unknown as TavernLoreRenderedTextV1
      exact(supplied,['pointer','rawContentSha256','renderedText','renderedSha256','rendererIdentity',
        'rendererImplementationSha256','readDependencies'])
      if(supplied.rendererIdentity!==this.producer.identity
        ||supplied.rendererImplementationSha256!==this.producer.implementationSha256
        ||supplied.pointer!==resolved.pointer||supplied.rawContentSha256!==resolved.contentSha256) {
        refuse('LORE_TEMPLATE_PRODUCER_MISMATCH',entry.entryId)
      }
      const body={request,renderedSha256:supplied.renderedSha256,
        activationProposals:output.activationProposals as unknown as readonly TavernLoreTemplateActivationV1[]}
      const row:TavernLoreTemplateFeedbackV1={...body,feedbackSha256:recordSha256(body)}
      // The real snapshot validator checks receipt fields/read dependencies and
      // the exact feedback shape/bounds before any returned data is consumed.
      this.snapshot=sealTavernLoreSnapshotV1({...this.snapshot,
        renderedTexts:[...this.snapshot.renderedTexts,supplied],activationFeedback:[...(this.snapshot.activationFeedback??[]),row]})
      receipt=this.snapshot.renderedTexts.find(item=>item.pointer===resolved.pointer)!
      feedback=this.snapshot.activationFeedback!.find(item=>item.request.entryId===entry.entryId)!
      this.receipts.set(resolved.pointer,receipt);this.rows.set(entry.entryId,feedback)
    }
    let proposals:readonly TavernLoreTemplateActivationV1[]=[]
    if(feedback&&!this.consumed.has(entry.entryId)) {
      if(recordSha256(feedback.request)!==recordSha256(request)||!receipt
        ||feedback.renderedSha256!==receipt.renderedSha256)refuse('LORE_FEEDBACK_SELECTION_MISMATCH',entry.entryId)
      for(const proposal of feedback.activationProposals)this.activation(proposal)
      proposals=feedback.activationProposals;this.consumed.add(entry.entryId)
    }
    const text=receipt?.renderedText??resolved.text
    // A standalone renderer may deliberately output literal template markers.
    // Its frozen output is inert text and is never fed through another VM.
    if(!receipt&&(text.includes('<%')||text.includes('{{')))refuse('LORE_CONTENT_TEMPLATE_UNRENDERED',entry.entryId)
    if(text.split('\n').some(line=>line.trimStart().startsWith('@@')))refuse('LORE_DECORATOR_UNSUPPORTED',entry.entryId)
    if(Buffer.byteLength(text,'utf8')>LORE_EVALUATOR_POLICY_V1.bounds.contentBytes)refuse('LORE_CONTENT_LIMIT',entry.entryId)
    return {text,proposals}
  }
  final():TavernLoreFrozenSnapshotV1 {
    if(this.consumed.size!==this.rows.size)refuse('LORE_FEEDBACK_UNSELECTED')
    if([...this.scanRows.keys()].some(key=>!this.consumedScans.has(key)))refuse('LORE_INJECTION_SCAN_UNCONSUMED')
    if(this.pendingKeyReceipts.length)return sealTavernLoreSnapshotV1({...this.snapshot,
      renderedTexts:[...this.snapshot.renderedTexts,...this.pendingKeyReceipts]})
    return this.snapshot
  }
}
