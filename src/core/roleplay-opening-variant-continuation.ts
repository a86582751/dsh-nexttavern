/** Detached candidate execution. The caller owns donor capture and publication. */
import {recordSha256} from './roleplay-data.js'
import type {SchemaAuthorProgram,SchemaTraceRunner,SchemaRealmLoadFrame,SchemaTraceStepRecord,
  SchemaTraceRequestedStep,SchemaTraceEvaluationStep,SchemaTraceInput}
  from './roleplay-mvu-schema-executor-types.js'
import type {SchemaJournalRef} from './roleplay-mvu-schema-journal.js'
import type {MvuScopeReadObjectV2} from './tavern-mvu-scope-view-v2.js'

export interface OpeningVariantContinuationV1 {
  readonly schemaVersion:1
  readonly encoding:'opening-variant-continuation-v1'
  readonly donorRef:SchemaJournalRef
  /** Donor resolution supplies the same material when restoring this frame. */
  readonly requested:{readonly eventId:string;readonly frame:Omit<SchemaTraceRequestedStep['frame'],'material'>}
  readonly record:SchemaTraceEvaluationStep
  readonly scopeObjects:readonly MvuScopeReadObjectV2[]
  readonly sha256:string
}
export interface OpeningVariantContinuationInput {
  readonly donorRef:SchemaJournalRef
  readonly donor:{readonly realmEpoch:string;readonly loadFrame:SchemaRealmLoadFrame;
    readonly completedPrefix:readonly SchemaTraceStepRecord[]}
  /** The caller supplies its actual external-pack-replacement request. */
  readonly requestedStep:SchemaTraceRequestedStep
  readonly program:SchemaAuthorProgram
  readonly runner:SchemaTraceRunner
  readonly scopeObjects?:readonly MvuScopeReadObjectV2[]
}

export async function evaluateOpeningVariantContinuation(input:OpeningVariantContinuationInput,
  signal?:AbortSignal):Promise<OpeningVariantContinuationV1> {
  const {donor,requestedStep,program,runner}=input
  const fields={schemaVersion:4 as const,realmEpoch:donor.realmEpoch,
    prefix:donor.completedPrefix,requestedStep}
  const trace:SchemaTraceInput=donor.loadFrame.scopeReadRef||requestedStep.frame.input.scopeReadRef
    ?{...fields,encoding:'native-mvu-author-schema-trace-input-v4-scope-ref-v2',loadFrame:donor.loadFrame}
    :{...fields,encoding:'native-mvu-author-schema-trace-input-v4',
      loadFrame:donor.loadFrame as Extract<SchemaRealmLoadFrame,{encoding?:never}>}
  let record:SchemaTraceEvaluationStep
  if(runner.openManualRun) {
    const opened=await runner.openManualRun(program,trace,signal)
    if(opened.kind!=='opened-manual-run')throw Error(opened.diagnostics[0]?.code??'OPENING_VARIANT_CONTINUATION_UNAVAILABLE')
    // Publication cannot observe the receipt until actual candidate cleanup
    // and Worker termination have succeeded. This run is never the main realm.
    await opened.run.close()
    record=opened.record
  }else {
    const evaluated=await runner.evaluateTrace(program,trace,signal)
    if(evaluated.kind!=='evaluated-trace')throw Error(evaluated.diagnostics[0]?.code??'OPENING_VARIANT_CONTINUATION_UNAVAILABLE')
    record=evaluated.evaluation.records.at(-1)!
  }
  const {ownerSessionId,sourceNativeCutSha256,input:phaseInput}=requestedStep.frame
  const body={schemaVersion:1 as const,encoding:'opening-variant-continuation-v1' as const,donorRef:input.donorRef,
    requested:{eventId:requestedStep.eventId,frame:{ownerSessionId,sourceNativeCutSha256,input:phaseInput}},
    record,scopeObjects:input.scopeObjects??[]}
  return {...body,sha256:recordSha256(body)}
}
