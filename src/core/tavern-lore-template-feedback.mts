/** Standalone selected-entry rendering and replay ledger. Nested frames remain
 * invocation-scoped Root audit; they never replace another entry's receipt. */
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaData,schemaTextSha256} from './tavern-mvu-schema-data.js'
import {resolveTavernLoreContentTextV1} from './tavern-lore-compiler.mjs'
import {ST_LORE_ENTRY_DEFAULTS_V1} from './tavern-lore-fixed-profile.mjs'
import {exact,sealTavernLoreSnapshotV1,LORE_EVALUATOR_POLICY_V1,freezeLoreData} from './tavern-lore-snapshot.mjs'
import {refuse} from './tavern-lore-match.mjs'
import {tavernLoreEntrySemanticSha256V1} from './tavern-lore-timed.mjs'
import type {TavernLorePlanV1,TavernLoreEntryPlanV1,TavernLoreSemanticEntryV1}
  from './tavern-lore-plan-types.mjs'
import type {TavernLoreFrozenSnapshotV1,TavernLoreTemplateProducerV1,TavernLoreTemplateFeedbackV1,
  TavernLoreSelectedTemplateRequestV1,TavernLoreScanStateV1,TavernLoreTemplateActivationV1,
  TavernLoreRenderedTextV1} from './tavern-lore-evaluator-types.mjs'
import type {TavernLoreInjectionFeedbackV1} from './tavern-lore-evaluator-types.mjs'

export class TavernLoreTemplateFeedbackStateV1 {
  private snapshot:TavernLoreFrozenSnapshotV1
  private readonly receipts=new Map<string,TavernLoreRenderedTextV1>()
  private readonly rows=new Map<string,TavernLoreTemplateFeedbackV1>()
  private readonly consumed=new Set<string>()
  private readonly scanRows=new Map<string,TavernLoreInjectionFeedbackV1>()
  private readonly consumedScans=new Set<string>()
  constructor(private readonly plan:TavernLorePlanV1,snapshot:TavernLoreFrozenSnapshotV1,
    private readonly eligible:(entry:TavernLoreEntryPlanV1)=>boolean,
    private readonly checkpoint:()=>void,private readonly producer?:TavernLoreTemplateProducerV1,
    private readonly defaultSignal?:AbortSignal) {
    this.snapshot=snapshot
    if(producer&&(snapshot.renderedTexts.length||(snapshot.activationFeedback?.length??0)
      ||(snapshot.injectionFeedback?.length??0))) {
      refuse('LORE_TEMPLATE_PREPARATION_NOT_FRESH')
    }
    for(const receipt of snapshot.renderedTexts) {
      const resolved=resolveTavernLoreContentTextV1(plan,receipt.pointer)
      if(resolved.contentSha256!==receipt.rawContentSha256)refuse('LORE_TEMPLATE_SOURCE_MISMATCH')
      this.receipts.set(receipt.pointer,receipt)
    }
    for(const row of snapshot.activationFeedback??[])this.rows.set(row.request.entryId,row)
    for(const row of snapshot.injectionFeedback??[])this.scanRows.set(`${row.loop}:${row.stage}`,row)
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
  private activation(proposal:TavernLoreTemplateActivationV1):void {
    const entry=this.plan.entries.find(item=>item.entryId===proposal.entryId)
    if(!entry||entry.rawEntrySha256!==proposal.rawEntrySha256)refuse('LORE_FEEDBACK_ENTRY_UNKNOWN',proposal.entryId)
    const semantic={...ST_LORE_ENTRY_DEFAULTS_V1,displayIndex:entry.ordinal,...entry.semanticOverrides} as TavernLoreSemanticEntryV1
    if(!semantic.enabled)refuse('LORE_FEEDBACK_ENTRY_DISABLED',entry.entryId)
    if(!this.eligible(entry))refuse('LORE_FEEDBACK_ENTRY_INELIGIBLE',entry.entryId)
  }
  async selected(entry:TavernLoreEntryPlanV1,semantic:TavernLoreSemanticEntryV1,loop:number,state:TavernLoreScanStateV1)
    :Promise<{text:string;proposals:readonly TavernLoreTemplateActivationV1[]}> {
    const resolved=resolveTavernLoreContentTextV1(this.plan,semantic.content.pointer)
    const selection={schemaVersion:1 as const,encoding:'owned-st-lore-template-selection-v1',entryId:entry.entryId,
      rawEntrySha256:entry.rawEntrySha256,entrySemanticSha256:tavernLoreEntrySemanticSha256V1(semantic),
      pointer:resolved.pointer,rawContentSha256:resolved.contentSha256,attemptId:this.snapshot.attemptId,
      compilerPlanSha256:this.plan.planSha256,loop,state}
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
    return this.snapshot
  }
}
