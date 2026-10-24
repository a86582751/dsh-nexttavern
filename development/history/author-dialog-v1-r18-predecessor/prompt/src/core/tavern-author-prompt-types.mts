/** Prompt programs and their effects are consumer DATA. Core owns capture,
 * Source lifetime and publication; this contract grants none of those rights. */
import type {RawAuthorScriptV4} from './tavern-mvu-author-execution-types-v4.mjs'
import type {BrowserProgramSourceLocatorV1} from './tavern-author-browser-types.mjs'
import type {MvuScopeReadFrameV1,MvuScopeVariablesV1} from './tavern-mvu-scope-read-types.js'
import type {AuthorChatCaptureV1} from './roleplay-author-chat-state-types.js'

export interface PromptCapturedMessageV1 {
  readonly index:number
  readonly messageId:string
  readonly ownerSessionId:string
  readonly nativeSeq:number|null
  readonly messageVersionSha256:string
  readonly role:'user'|'assistant'
  readonly message:string
  readonly variables:MvuScopeVariablesV1
  readonly variants:null|{readonly source:'native-author-copy-opening-candidates-v1';
    readonly swipes:readonly string[];readonly swipe_id:number}
}
export interface PromptCaptureV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-prompt-capture-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSnapshotSha256:string
  readonly nativeCut:number
  readonly nativePrefixSha256:string
  readonly attemptId:string
  readonly clockEpochMs:number
  readonly randomSeed:string
  readonly messages:readonly PromptCapturedMessageV1[]
  readonly scopeFrame:MvuScopeReadFrameV1
  /** State1 supplies this separate namespace; MVU provenance stays intact. */
  readonly authorChat?:AuthorChatCaptureV1
  readonly captureSha256:string
}
export interface PromptRawScriptV1 {readonly ordinal:number;readonly descriptor:RawAuthorScriptV4}
export interface PromptCompilationInputV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-prompt-compilation-input-v1'
  readonly source:BrowserProgramSourceLocatorV1
  readonly scripts:readonly PromptRawScriptV1[]
}
export interface PromptDiagnosticV1 {
  readonly code:string
  readonly ordinal?:number
  readonly scriptIdentity?:string
  readonly pointer?:string
  readonly line?:number
  readonly column?:number
  /** A capability/syntax name only; never original text or a guest stack. */
  readonly feature?:string
}
export interface PromptCompiledScriptV1 extends PromptRawScriptV1 {
  readonly descriptorSha256:string
  readonly disposition:'compiled-prompt'|'disabled-source-retained'
  readonly javascript:string
  readonly javascriptSha256:string
  readonly coverage:null|{readonly encoding:'native-author-prompt-complete-ast-coverage-v1';
    readonly sourceSha256:string;readonly nodeCount:number;
    readonly statements:readonly {readonly start:number;readonly end:number}[]}
  readonly reinstantiation:'stateless-captured-input-v1'|'disabled'
}
export interface PromptCompilerIdentityV1 {
  readonly id:'native-author-prompt-profile-compiler'
  readonly version:1
  readonly typescriptVersion:'5.9.3'
  readonly implementationSha256:string
}
export interface PromptRuntimeIdentityV1 {
  readonly id:'native-author-prompt-quickjs-runtime'
  readonly version:1
  readonly quickjsVersion:'0.32.0'
  readonly implementationSha256:string
}
export interface PromptProgramV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-prompt-program-v1'
  readonly authority:'compiled-program-data-only'
  readonly source:BrowserProgramSourceLocatorV1
  readonly compiler:PromptCompilerIdentityV1
  readonly runtime:PromptRuntimeIdentityV1
  readonly profileSha256:string
  readonly scripts:readonly PromptCompiledScriptV1[]
  readonly programSha256:string
}
export type PromptCompilationV1={readonly kind:'compiled';readonly program:PromptProgramV1}
  |{readonly kind:'refused';readonly diagnostics:readonly PromptDiagnosticV1[]}
export type PromptCandidateRowV1=PromptRawScriptV1&(
  |{readonly kind:'compiled'|'disabled';readonly compiled:PromptCompiledScriptV1}
  |{readonly kind:'refused';readonly diagnostics:readonly PromptDiagnosticV1[]})
export interface PromptCandidateBatchV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-prompt-candidate-batch-v1'
  readonly source:BrowserProgramSourceLocatorV1
  readonly rows:readonly PromptCandidateRowV1[]
}
export interface PromptCompilerV1 {
  readonly identity:PromptCompilerIdentityV1
  readonly runtime:PromptRuntimeIdentityV1
  compile(input:PromptCompilationInputV1,signal?:AbortSignal):Promise<PromptCompilationV1>
  compileCandidates(input:PromptCompilationInputV1,signal?:AbortSignal):Promise<PromptCandidateBatchV1>
  assembleAccepted(batch:PromptCandidateBatchV1,ordinals:readonly number[]):PromptCompilationV1
  verifyProgram(program:PromptProgramV1,signal?:AbortSignal):Promise<boolean>
}
export interface AuthorPromptInjectionV1 {
  readonly id:string
  readonly position:'none'|'in_chat'
  readonly depth:number
  readonly role:'system'|'user'|'assistant'
  readonly content:string
  readonly should_scan:boolean
}
export interface PromptEffectOriginV1 {
  readonly originalOrdinal:number
  readonly scriptIdentity:string
  readonly descriptorSha256:string
}
export type PromptEffectV1=PromptEffectOriginV1&(
  |{readonly kind:'inject';readonly prompts:readonly AuthorPromptInjectionV1[];readonly once:boolean}
  |{readonly kind:'remove';readonly ids:readonly string[]})
export interface PromptExecutionOutputV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-prompt-execution-output-v1'
  readonly authority:'consumer-data-only'
  readonly programSha256:string
  readonly captureSha256:string
  readonly effects:readonly PromptEffectV1[]
  /** Source owner consumes these on actual close. Worker exit is no event. */
  readonly cleanupRemovals:readonly (PromptEffectOriginV1&{readonly ids:readonly string[]})[]
  readonly callbacksExecuted:number
  readonly outputSha256:string
}
export type PromptExecutionV1={readonly kind:'executed';readonly output:PromptExecutionOutputV1}
  |{readonly kind:'refused'|'cancelled';readonly diagnostics:readonly PromptDiagnosticV1[]}
export type PromptWorkerRequestV1=
  |{readonly kind:'compile';readonly input:PromptCompilationInputV1;
    readonly compiler:PromptCompilerIdentityV1;readonly runtime:PromptRuntimeIdentityV1}
  |{readonly kind:'execute';readonly program:PromptProgramV1;readonly capture:PromptCaptureV1}
export interface AuthorPromptOwnedInventoryV1 {
  readonly name:'dsh-nexttavern-author-prompt-runtime-v1'
  readonly version:'0.1.0'
  readonly files:readonly {readonly path:string;readonly sha256:string}[]
  readonly generation:string
}
export interface OwnedAuthorPromptRuntimeV1 {
  readonly compiler:PromptCompilerV1
  readonly runtime:PromptRuntimeIdentityV1
  execute(program:PromptProgramV1,capture:PromptCaptureV1,signal?:AbortSignal):Promise<PromptExecutionV1>
  checkCurrent():void
  dispose():Promise<void>
}
