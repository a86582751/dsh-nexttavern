import type {TavernLoreCompilationV1,TavernLorePositionV1,TavernLoreRoleV1}
  from './tavern-lore-plan-types.mjs'

/** Every identity is supplied by the real capture owner. This is data, never a
 * current-state assertion, lease, Native permission or provider receipt. */
export interface TavernLoreFrozenSettingsV1 {
  readonly policy:'owned-st-single-book-initial-scan-v1'|'owned-st-single-book-scan-feedback-v1'
  readonly provenance:'actual-runtime-settings'|'explicit-native-fallback-v1'
  readonly caseSensitive:boolean
  readonly matchWholeWords:boolean
  readonly scanDepth:number
  readonly useGroupScoring:boolean
  readonly recursiveScanning:boolean
  readonly minimumActivations:number
  readonly minimumActivationDepthMax:number
  readonly maxRecursionSteps:number
  readonly includeNames:boolean
  readonly characterStrategy:'single-character-book-v1'
  readonly budgetTokens:number
  readonly contentTransformPolicy:'no-world-info-output-regex-v1'
  readonly macroPolicy:'frozen-rendered-receipt-or-marker-free-v1'
  readonly seedPolicy:'sha256-counter-domain-separated-v1'
  readonly budgetPolicy:'frozen-cumulative-token-ledger-st-gte-v1'
}
export interface TavernLoreVisibleMessageV1 {
  readonly messageId:string
  readonly versionSha256:string
  readonly role:TavernLoreRoleV1
  readonly speakerName:string
  readonly text:string
  readonly textSha256:string
  /** Actual owner-captured ST scan string, including its name/filter policy.
   * The evaluator does not reconstruct that string from a speaker guess. */
  readonly scanPolicy:'owner-captured-st-message-string-v1'
  readonly scanText:string
  readonly scanTextSha256:string
}
export interface TavernLoreFrozenReadV1 {
  readonly kind:'state'|'source'|'message'|'settings'
  readonly identity:string
  readonly versionSha256:string
  readonly valueSha256:string
}
/** A frozen result supplied by a template owner, not an executable callback.
 * Hashes cannot prove that the renderer actually ran or had read permission. */
export interface TavernLoreRenderedTextV1 {
  readonly pointer:string
  readonly rawContentSha256:string
  readonly renderedText:string
  readonly renderedSha256:string
  readonly rendererIdentity:string
  readonly rendererImplementationSha256:string
  readonly readDependencies:readonly TavernLoreFrozenReadV1[]
}
export interface TavernLoreBranchTimedInputV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-st-branch-timed-input-v1'
  readonly branchId:string
  readonly revision:number
  readonly chatIndex:number
  readonly intervals:readonly {readonly entryId:string;readonly rawEntrySha256:string;
    readonly entrySemanticSha256:string;
    readonly kind:'sticky'|'cooldown';readonly start:number;readonly end:number;readonly protected:boolean}[]
}
export interface TavernLoreTimedActionV1 {
  readonly kind:'set'|'clear'
  readonly entryId:string
  readonly rawEntrySha256:string
  readonly entrySemanticSha256:string
  readonly effect:'sticky'|'cooldown'
  readonly before:TavernLoreBranchTimedInputV1['intervals'][number]|null
  readonly after:TavernLoreBranchTimedInputV1['intervals'][number]|null
  readonly reason:'chat-not-advanced'|'entry-unavailable'|'entry-edited'|'control-cleared'|'expired'
    |'sticky-ended-cooldown-protected'|'activation'
}
export type TavernLoreScanStateV1='initial'|'recursion'|'minimum-activations'
export interface TavernLoreTemplateActivationV1 {readonly entryId:string;readonly rawEntrySha256:string}
export interface TavernLoreSelectedTemplateRequestV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-st-lore-selected-template-request-v1'
  readonly entryId:string
  readonly rawEntrySha256:string
  readonly entrySemanticSha256:string
  readonly pointer:string
  readonly rawContentSha256:string
  readonly text:string
  readonly attemptId:string
  readonly compilerPlanSha256:string
  readonly loop:number
  readonly state:TavernLoreScanStateV1
  readonly selectionSha256:string
}
export interface TavernLoreTemplateFeedbackV1 {
  readonly request:TavernLoreSelectedTemplateRequestV1
  readonly renderedSha256:string
  readonly activationProposals:readonly TavernLoreTemplateActivationV1[]
  readonly feedbackSha256:string
}
export interface TavernLoreInjectionFeedbackV1 {
  readonly loop:number
  readonly state:TavernLoreScanStateV1
  readonly stage:'before-initial'|'after-selected'
  readonly contributions:readonly {readonly identity:string;readonly text:string;readonly textSha256:string}[]
  readonly activationProposals:readonly TavernLoreTemplateActivationV1[]
  readonly producerIdentity:string
  readonly producerImplementationSha256:string
  readonly feedbackSha256:string
}
/** Callback is trusted program state, outside the cloned author input. Nested
 * getwi frame output stays in Root's audit; only this standalone receipt is here. */
export interface TavernLoreTemplateProducerV1 {
  readonly identity:string
  readonly implementationSha256:string
  readonly signal?:AbortSignal
  assertCurrent():void
  consumeScan?(request:{readonly loop:number;readonly state:TavernLoreScanStateV1;
    readonly stage:TavernLoreInjectionFeedbackV1['stage']},signal?:AbortSignal):
    Promise<Pick<TavernLoreInjectionFeedbackV1,'contributions'|'activationProposals'>>
  render(request:TavernLoreSelectedTemplateRequestV1,signal?:AbortSignal):
    {readonly receipt:TavernLoreRenderedTextV1;readonly activationProposals:readonly TavernLoreTemplateActivationV1[]}
    |Promise<{readonly receipt:TavernLoreRenderedTextV1;readonly activationProposals:readonly TavernLoreTemplateActivationV1[]}>
}
export interface TavernLoreTokenizerLedgerV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-frozen-token-count-ledger-v1'
  readonly identity:string
  readonly implementationSha256:string
  /** Estimates remain explicitly labelled in both the ledger and budget result. */
  readonly method:'actual-local-tokenizer'|'estimated-utf16-div2_5-v1'
  /** Exact UTF-8 text hashes, including cumulative trailing newlines. */
  readonly counts:readonly {readonly textSha256:string;readonly tokens:number}[]
}
/** Trusted program-side preparation dependency. This callback is outside the
 * cloned author input and does not confer Source, state or Native permission. */
export interface TavernLoreTokenCountProducerV1 {
  readonly identity:string
  readonly implementationSha256:string
  readonly method:TavernLoreTokenizerLedgerV1['method']
  count(text:string,signal?:AbortSignal):number|Promise<number>
  assertCurrent():void
  readonly signal?:AbortSignal
}
/** The actual preparation caller explicitly owns both producer objects and
 * supplies their complete combined current-state check. This relationship is
 * trusted program state, never inferred from author data or receipt hashes. */
export interface TavernLorePreparationOwnerV1 {
  readonly tokenCount:TavernLoreTokenCountProducerV1
  readonly templates:TavernLoreTemplateProducerV1
  assertCurrent():void
}
export interface TavernLoreFrozenSnapshotV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-st-lore-frozen-snapshot-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly branchId:string
  readonly revision:number
  readonly turnId:string
  readonly attemptId:string
  readonly sourceSnapshotSha256:string
  readonly stateSnapshotSha256:string
  readonly sourceReferenceSha256:string
  readonly packageSha256:string
  readonly compilerPlanSha256:string
  /** Ascending chat depth: newest visible message first, no sorting guesses. */
  readonly visibleMessages:readonly TavernLoreVisibleMessageV1[]
  readonly messagesSha256:string
  readonly settings:TavernLoreFrozenSettingsV1
  readonly settingsSha256:string
  readonly seed:string
  readonly seedSha256:string
  readonly globalScanData:{readonly personaDescription:string;readonly characterDescription:string;
    readonly characterPersonality:string;readonly characterDepthPrompt:string;readonly scenario:string;readonly creatorNotes:string}
  readonly globalScanDataSha256:string
  readonly timed:TavernLoreBranchTimedInputV1
  readonly timedSha256:string
  readonly tokenizer:TavernLoreTokenizerLedgerV1
  readonly tokenizerSha256:string
  readonly renderedTexts:readonly TavernLoreRenderedTextV1[]
  readonly renderedTextsSha256:string
  readonly activationFeedback?:readonly TavernLoreTemplateFeedbackV1[]
  readonly activationFeedbackSha256?:string
  readonly injectionFeedback?:readonly TavernLoreInjectionFeedbackV1[]
  readonly injectionFeedbackSha256?:string
  readonly snapshotSha256:string
}
export interface TavernLoreEvaluatorInputV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-st-lore-evaluator-input-v1'
  readonly compilation:Extract<TavernLoreCompilationV1,{kind:'compiled'}>
  readonly snapshot:TavernLoreFrozenSnapshotV1
}
export interface TavernLoreEvaluationDiagnosticV1 {
  readonly schemaVersion:1
  readonly code:string
  readonly entryId:string|null
  readonly pointer:string|null
  readonly blocking:true
}
export type TavernLoreDecisionV1='disabled'|'keys-unmatched'|'secondary-unmatched'|'group-loser'
  |'probability-failed'|'budget-excluded'|'activated'|'empty-content'|'cooldown'|'delay'
  |'excluded-recursion'|'waiting-recursion'
export interface TavernLoreEntryDecisionV1 {
  readonly entryId:string
  readonly rawEntrySha256:string
  readonly decision:TavernLoreDecisionV1
  readonly primaryMatches:readonly boolean[]
  readonly secondaryMatches:readonly boolean[]
  readonly groupScore:number
  readonly probabilityRoll:number|null
  readonly sourceContentSha256:string|null
  readonly effectiveContentSha256:string|null
}
export interface TavernLoreScanTraceV1 {
  readonly loop:number
  readonly state:TavernLoreScanStateV1
  readonly depth:number
  readonly recursionDelayLevel:number
  readonly selectedEntryIds:readonly string[]
  readonly admittedEntryIds:readonly string[]
  readonly probabilityFailedEntryIds:readonly string[]
  readonly feedback:readonly {readonly entryId:string;readonly disposition:'queued'|'already-seen'|'duplicate'}[]
  readonly baseTextSha256:string
  readonly candidateTextSha256:string
  readonly scanOnly:readonly {readonly entryId:string;readonly pointer:string;readonly contentSha256:string;
    readonly disposition:'scan-only-after-overflow';readonly loop:number}[]
  readonly nextState:TavernLoreScanStateV1|null
}
export interface TavernLorePlacementV1 {
  readonly entryId:string
  readonly sourcePointer:string
  readonly sourceContentSha256:string
  readonly effectiveContentSha256:string
  readonly position:TavernLorePositionV1
  readonly role:TavernLoreRoleV1
  readonly depth:number
  readonly roleDisposition:'at-depth-role'|'slot-owner-role'
  readonly depthDisposition:'at-depth-distance'|'slot-owner-anchor'
  readonly order:number
  readonly outletName:string
  readonly slotIndex:number
  readonly text:string
}
export interface TavernLoreEvaluationPlanV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-st-lore-evaluation-plan-v1'
  readonly authority:'consumer-data-only'
  readonly evaluatorPolicySha256:string
  readonly snapshotSha256:string
  readonly compilerPlanSha256:string
  readonly sourceReferenceSha256:string
  readonly branchId:string
  readonly sessionId:string
  readonly turnId:string
  readonly attemptId:string
  readonly decisions:readonly TavernLoreEntryDecisionV1[]
  readonly activatedEntryIds:readonly string[]
  readonly scanTrace:readonly TavernLoreScanTraceV1[]
  readonly termination:'converged'|'configured-step-limit'
  readonly diagnostics:readonly {readonly code:string;readonly entryId:string}[]
  readonly placements:readonly TavernLorePlacementV1[]
  readonly budget:{readonly limitTokens:number;readonly consumedCandidateTokens:number;
    readonly cumulativeCandidateTextSha256:string;readonly overflowed:boolean;
    readonly countMethod:TavernLoreTokenizerLedgerV1['method']}
  readonly timedProposal:{readonly schemaVersion:1;readonly encoding:'owned-st-timed-proposals-v1';
    readonly branchId:string;readonly baseRevision:number;readonly baseSha256:string;
    readonly chatIndex:number;readonly actions:readonly TavernLoreTimedActionV1[];
    readonly disposition:'empty-no-timed-effects'|'proposed-consumer-data-only'}
  readonly planSha256:string
}
export type TavernLoreEvaluationV1={readonly kind:'evaluated';readonly plan:TavernLoreEvaluationPlanV1}
  |{readonly kind:'refused';readonly diagnostics:readonly TavernLoreEvaluationDiagnosticV1[]}
export type TavernLorePreparedEvaluationV1={readonly kind:'prepared';
  readonly input:TavernLoreEvaluatorInputV1;readonly plan:TavernLoreEvaluationPlanV1}
  |Extract<TavernLoreEvaluationV1,{kind:'refused'}>
