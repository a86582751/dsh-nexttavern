import type {TavernTemplateReadV1} from './tavern-template-types.mjs'

export const TAVERN_PROMPT_TRANSFORM_LIMITS_V1=Object.freeze({
  entries:4096,rules:256,bindings:4096,inputChars:8_000_000,outputChars:2_000_000,
  workChars:16_000_000,jobs:1_000_000,matches:20_000,patternChars:4096,
  receipts:65_536,receiptChars:8_000_000,
  replacementChars:65_536,deadlineMs:250,concurrentWorkers:4,
})
export const TAVERN_PROMPT_CARD_ORDER_V1=Object.freeze(['charPrompt','charJailbreak','charInstruction',
  'description','personality','scenario','persona','mesExamples','mesExamplesRaw','charVersion',
  'char_version','charDepthPrompt','creatorNotes'])
export const TAVERN_PROMPT_POST_ORDER_V1=Object.freeze(['maxPrompt','maxPromptTokens','maxContext',
  'maxContextTokens','maxResponse','maxResponseTokens','lastMessage','lastMessageId','lastUserMessage',
  'lastCharMessage','firstIncludedMessageId','firstDisplayedMessageId','lastSwipeId','currentSwipeId',
  'allChatRange','time','date','weekday','isotime','isodate','idle_duration'])
export const TAVERN_PROMPT_INSTRUCT_ORDER_V1=Object.freeze(['instructStoryStringPrefix','instructStoryStringSuffix',
  'instructInput|instructUserPrefix','instructUserSuffix','instructOutput|instructAssistantPrefix',
  'instructSeparator|instructAssistantSuffix','instructSystemPrefix','instructSystemSuffix',
  'instructFirstOutput|instructFirstAssistantPrefix','instructLastOutput|instructLastAssistantPrefix',
  'instructStop','instructUserFiller','instructSystemInstructionPrefix','instructFirstInput|instructFirstUserPrefix',
  'instructLastInput|instructLastUserPrefix','systemPrompt','defaultSystemPrompt|instructSystem|instructSystemPrompt',
  'chatSeparator','chatStart'])
/** All character limits count UTF-16 code units. No entry is truncated. */
export type TavernPromptPipelineV1='macro-only'|'regex-only'|'macro-then-regex'|'regex-then-macro'
export type TavernPromptChannelV1='source'|'prompt'|'display'
export type TavernRegexPlacementV1=0|1|2|3|4|5|6
export interface TavernPromptBindingV1 {
  readonly key:string
  /** Owner has already applied ST's string conversion. Null is an explicit absent read. */
  readonly value:string|null
  readonly valueSha256:string|null
  readonly read:TavernTemplateReadV1
}
export interface TavernPromptNamesV1 {
  readonly user:TavernPromptBindingV1
  readonly char:TavernPromptBindingV1
  readonly group:TavernPromptBindingV1
  readonly charIfNotGroup:TavernPromptBindingV1
  readonly groupNotMuted:TavernPromptBindingV1
  readonly notChar:TavernPromptBindingV1
  readonly model:TavernPromptBindingV1
}
export interface TavernPromptMacroSnapshotV1 {
  readonly schemaVersion:1
  readonly engine:'legacy'|'experimental'
  readonly authority:'consumer-data-only'
  readonly sourceSnapshotSha256:string
  readonly names:TavernPromptNamesV1
  /** Fixed ST order: charPrompt, charJailbreak, charInstruction, description,
   * personality, scenario, persona, mesExamples, mesExamplesRaw, charVersion,
   * char_version, charDepthPrompt, creatorNotes. Missing card is explicit null. */
  readonly card:readonly TavernPromptBindingV1[]|null
  readonly input:TavernPromptBindingV1
  /** Fixed alias groups, resolved enabled/default values captured by owner. */
  readonly instruct:readonly TavernPromptBindingV1[]
  readonly dynamic:readonly TavernPromptBindingV1[]
  readonly registered:readonly TavernPromptBindingV1[]
  readonly localVariables:readonly TavernPromptBindingV1[]
  readonly globalVariables:readonly TavernPromptBindingV1[]
  readonly outlets:readonly TavernPromptBindingV1[]
  /** Only these fixed post-env aliases are accepted; no implicit clock/DOM read. */
  readonly post:readonly TavernPromptBindingV1[]
  /** Data owner captures complete alternate group/notChar results for trim
   * name2Override. The worker does not infer them from one speaker string. */
  readonly characterOverrides:readonly {readonly name:string;readonly names:TavernPromptNamesV1}[]
}
export interface TavernPromptRegexRuleV1 {
  readonly id:string
  readonly sourcePointer:string
  readonly sourceSnapshotSha256:string
  readonly origin:'global'|'preset'|'scoped'
  readonly allowed:boolean
  readonly disabled:boolean
  readonly findRegex:string
  readonly replaceString:string
  readonly trimStrings:readonly string[]
  readonly placement:readonly TavernRegexPlacementV1[]
  readonly promptOnly:boolean
  readonly markdownOnly:boolean
  readonly runOnEdit:boolean
  readonly minDepth:number|null
  readonly maxDepth:number|null
  readonly substituteRegex:0|1|2
}
export interface TavernPromptTransformEntryV1 {
  readonly key:string
  readonly bookId:string|null
  readonly entryId:string|null
  readonly sourcePointer:string
  readonly sourceSnapshotSha256:string
  readonly rawText:string
  readonly storyText:string
  readonly inputText:string
  readonly pipeline:TavernPromptPipelineV1
  readonly channel:TavernPromptChannelV1
  readonly placement:TavernRegexPlacementV1
  readonly depth:number|null
  readonly isEdit:boolean
  readonly characterOverride:string|null
  /** False is catalog staging only. Its deferred diagnostics must be admitted
   * by assertTavernPromptProjectionReadyV1 before selecting a prompt entry. */
  readonly required:boolean
}
export interface TavernPromptTransformInputV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-tavern-prompt-transform-v1'
  readonly authority:'consumer-data-only'
  readonly sourceSnapshotSha256:string
  readonly regexDisabled:boolean
  readonly macros:TavernPromptMacroSnapshotV1
  /** Owner supplies authorized scripts in ST global/preset/scoped order. */
  readonly rules:readonly TavernPromptRegexRuleV1[]
  readonly entries:readonly TavernPromptTransformEntryV1[]
}
export interface TavernPromptTransformDiagnosticV1 {
  readonly schemaVersion:1
  readonly code:string
  readonly entryKey:string|null
  readonly ruleId:string|null
  readonly macro:string|null
  readonly limit:{readonly field:string;readonly observed:number;readonly maximum:number}|null
}
export interface TavernPromptRuleReceiptV1 {
  readonly ruleId:string
  readonly sourcePointer:string
  readonly status:'applied'|'skipped'|'deferred'
  readonly reason:string|null
  readonly matches:number
}
export interface TavernPromptStageReceiptV1 {
  readonly stage:'macro'|'regex'
  readonly inputSha256:string
  readonly outputSha256:string
}
export interface TavernPromptProjectionV1 extends TavernPromptTransformEntryV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-tavern-prompt-projection-v1'
  readonly authority:'consumer-data-only'
  readonly batchInputSha256:string
  readonly policySha256:string
  readonly rawSha256:string
  readonly storySha256:string
  readonly inputSha256:string
  readonly outputText:string
  readonly outputSha256:string
  readonly stages:readonly TavernPromptStageReceiptV1[]
  readonly rules:readonly TavernPromptRuleReceiptV1[]
  readonly readDependencies:readonly TavernTemplateReadV1[]
  readonly deferredDiagnostics:readonly TavernPromptTransformDiagnosticV1[]
  readonly projectionSha256:string
}
export interface TavernPromptTransformOutputV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-tavern-prompt-transform-output-v1'
  readonly authority:'consumer-data-only'
  readonly inputSha256:string
  readonly policySha256:string
  readonly entries:readonly TavernPromptProjectionV1[]
  readonly totals:{readonly inputChars:number;readonly outputChars:number;readonly workChars:number;
    readonly jobs:number;readonly matches:number;readonly compiledRules:number;
    readonly receipts:number;readonly receiptChars:number}
  readonly outputSha256:string
}
export type TavernPromptTransformResultV1={readonly kind:'transformed';readonly output:TavernPromptTransformOutputV1}
  |{readonly kind:'refused'|'cancelled';readonly diagnostics:readonly TavernPromptTransformDiagnosticV1[]}
export interface TavernPromptTransformDependenciesV1 {
  /** Actual owner assertion is retained by reference outside the data snapshot.
   * It must be synchronous. Replay hashes never replace this check. */
  readonly assertCurrent:()=>void
  readonly signal?:AbortSignal
}
export interface TavernPromptTransformWorkerInputV1 {
  readonly input:TavernPromptTransformInputV1
  readonly inputSha256:string
  readonly policySha256:string
  readonly inputChars:number
}
