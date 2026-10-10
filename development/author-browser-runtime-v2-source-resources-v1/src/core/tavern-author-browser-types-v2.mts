/** Browser2 owns executable code and a live Worker, not Source or Native rights. */
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {PromptCapturedMessageV1} from './tavern-author-prompt-types.mjs'
import type {AuthorChatCaptureV1,AuthorChatUpdateV1} from './roleplay-author-chat-state-types.js'
import type {AuthorScriptResourceRequestV1} from './roleplay-author-script-resources.js'
import type {BrowserBindingV1,BrowserDiagnosticV1,BrowserProgramSourceLocatorV1,
  BrowserRawScriptV1,BrowserNumericalSnapshotV1,BrowserRenderV1,BrowserSaveRequestV1}
  from './tavern-author-browser-types.mjs'
import type {BrowserCallbackRegistrationV2,BrowserGenerationInvocationV2,BrowserGenerationResultV2}
  from './roleplay-author-browser-generation-types.js'

export type BrowserBindingV2=BrowserBindingV1
export type BrowserDiagnosticV2=BrowserDiagnosticV1
export type BrowserProgramSourceLocatorV2=BrowserProgramSourceLocatorV1
export type BrowserRawScriptV2=BrowserRawScriptV1
export type BrowserRenderV2=BrowserRenderV1
export type BrowserSaveRequestV2=BrowserSaveRequestV1
export type BrowserCapabilityV2='isolated-dom-text'|'isolated-dom-events'|'isolated-dom-style'
  |'isolated-dom-canvas'|'owned-media'|'owned-resource-callbacks'|'owned-persona-snapshot'
  |'owned-variable-snapshot'|'owned-message-snapshot'|'owned-numerical-snapshot'
  |'owned-numerical-player-save'|'owned-chat-key-update'|'owned-generation-callbacks'
  |'owned-prompt-effects'|'owned-generate-raw-gesture'
  |'owned-script-source-resources'
export interface BrowserCapabilityContractV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-capability-contract-v2'
  readonly authority:'requirements-only'
  readonly capabilities:readonly BrowserCapabilityV2[]
  readonly getters:'synchronous-owned-snapshot-and-opaque-dom'
  readonly execution:'actual-worker-quickjs-asyncify'
  readonly writer:'parent-owned-operation-and-proven-chat-key'
  readonly modelRequests:'explicit-parent-owned-author-dialog-only'
  readonly contractSha256:string
}
export interface BrowserRuntimeIdentityV2 {
  readonly id:'native-author-browser-runtime'
  readonly version:2
  readonly quickjsVersion:'0.32.0'
  readonly implementationSha256:string
  readonly capabilityContractSha256:string
}
export interface BrowserCompilerIdentityV2 {
  readonly id:'native-author-browser-profile-compiler'
  readonly version:2
  readonly typescriptVersion:'5.9.3'
  readonly implementationSha256:string
}
export interface BrowserCompilationInputV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-compilation-input-v2'
  readonly source:BrowserProgramSourceLocatorV2
  readonly scripts:readonly BrowserRawScriptV2[]
}
export interface BrowserAstCoverageV2 {
  readonly encoding:'native-author-browser-complete-ast-coverage-v2'
  readonly sourceSha256:string
  readonly nodeCount:number
  readonly statements:readonly {readonly start:number;readonly end:number;readonly syntaxKind:string}[]
}
export interface BrowserCompiledScriptV2 extends BrowserRawScriptV2 {
  readonly descriptorSha256:string
  readonly disposition:'compiled-browser'|'disabled-source-retained'
  /** The original JavaScript bytes, including dormant callbacks. */
  readonly javascript:string
  readonly javascriptSha256:string
  readonly entrypoint:'global-script'|'disabled'
  readonly coverage:BrowserAstCoverageV2|null
  readonly requiredCapabilities:readonly BrowserCapabilityV2[]
  readonly ownedChatKey:string|null
  readonly mediaSources:readonly string[]
}
export interface BrowserProgramV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-program-v2'
  readonly authority:'compiled-program-data-only'
  readonly source:BrowserProgramSourceLocatorV2
  readonly compiler:BrowserCompilerIdentityV2
  readonly profile:{readonly id:'nexttavern-browser-worker-opaque-dom';readonly version:2;readonly sha256:string}
  readonly runtime:BrowserRuntimeIdentityV2
  readonly capabilityContract:BrowserCapabilityContractV2
  readonly scripts:readonly BrowserCompiledScriptV2[]
  readonly requiredCapabilities:readonly BrowserCapabilityV2[]
  /** One static AST proof; State1 owns this key's actual scope and revision. */
  readonly ownedChatKey:string|null
  readonly ownedChatWriter:null|{readonly ordinal:number;readonly descriptorSha256:string}
  readonly programSha256:string
}
export type BrowserCompilationV2={readonly kind:'compiled';readonly program:BrowserProgramV2}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV2[]}
export type BrowserCandidateRowV2=BrowserRawScriptV2&(
  |{readonly kind:'compiled'|'disabled';readonly compiled:BrowserCompiledScriptV2}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV2[]})
export interface BrowserCandidateBatchV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-candidate-batch-v2'
  readonly source:BrowserProgramSourceLocatorV2
  readonly rows:readonly BrowserCandidateRowV2[]
}
export interface BrowserCompilerV2 {
  readonly identity:BrowserCompilerIdentityV2
  compile(input:BrowserCompilationInputV2):BrowserCompilationV2
  compileCandidates(input:BrowserCompilationInputV2):BrowserCandidateBatchV2
  assembleAccepted(batch:BrowserCandidateBatchV2,ordinals:readonly number[]):BrowserCompilationV2
  verifyProgram(program:BrowserProgramV2):boolean
}
export type BrowserPartitionV2={readonly kind:'partitioned';readonly source:BrowserProgramSourceLocatorV2;
  readonly browserProgram:BrowserProgramV2|null;readonly serverOrdinals:readonly number[]}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV2[]}
export interface BrowserPartitionCompilerV2 {
  readonly identity:BrowserCompilerIdentityV2
  readonly runtime:BrowserRuntimeIdentityV2
  partition(input:BrowserCompilationInputV2,signal?:AbortSignal):Promise<BrowserPartitionV2>
  dispose():Promise<void>
}
export interface OwnedAuthorBrowserRuntimeV2 extends BrowserPartitionCompilerV2 {
  readonly artifact:BrowserRuntimeArtifactV2
}
export interface BrowserPersonaSnapshotV2 {
  readonly name:string
  readonly gender?:string
  readonly avatar:null
}
export interface BrowserSnapshotV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-snapshot-v2'
  readonly generation:string
  readonly readRevision:number
  readonly basis:{readonly sessionId:string;readonly sourceSnapshotSha256:string;
    readonly materialSha256:string;readonly numericalSnapshotSha256:string;
    readonly nativeCut:number;readonly nativePrefixSha256:string}
  readonly scopeFrame:MvuScopeReadFrameV1
  /** Actual opening candidates, selected swipe and message version join. */
  readonly messages:readonly PromptCapturedMessageV1[]
  readonly numerical:BrowserNumericalSnapshotV1
  readonly persona:BrowserPersonaSnapshotV2
  readonly authorChat:AuthorChatCaptureV1|null
}
export interface BrowserSaveReplyV2 {
  readonly requestId:number
  readonly generation:string
  readonly result:MvuPlayerEditResponse
  readonly snapshot:BrowserSnapshotV2
}
export interface BrowserRuntimeArtifactV2 {
  readonly schemaVersion:2
  readonly childJavascript:string
  readonly childSha256:string
  readonly guardJavascript:string
  readonly guardSha256:string
  readonly executionWorkerJavascript:string
  readonly executionWorkerSha256:string
  readonly wasm:{readonly encoding:'base64';readonly data:string;readonly sha256:string}
  readonly identity:BrowserRuntimeIdentityV2
}
export interface BrowserGenerateRawRequestV2 {
  readonly scriptIdentity:string
  readonly options:MvuJsonObject
  /** Minted by the main parent from its trusted child native event. */
  readonly gestureId:string
}
export interface BrowserGeneratedTaskV2 {
  readonly text:string
  readonly task:AuthorChatUpdateV1['task']
}
export interface BrowserAuthorChatRequestV2 {
  readonly scriptIdentity:string
  readonly expected:AuthorChatCaptureV1['revision']
  readonly value:MvuJsonValue
  readonly task:AuthorChatUpdateV1['task']
}
export interface BrowserHostBridgeV2 {
  capture(binding:BrowserBindingV2,signal:AbortSignal):Promise<BrowserSnapshotV2>
  save(binding:BrowserBindingV2,request:BrowserSaveRequestV2,signal:AbortSignal):Promise<BrowserSaveReplyV2>
  generateRaw?(binding:BrowserBindingV2,request:BrowserGenerateRawRequestV2,signal:AbortSignal):Promise<BrowserGeneratedTaskV2>
  updateAuthorChat?(binding:BrowserBindingV2,request:BrowserAuthorChatRequestV2,signal:AbortSignal):Promise<AuthorChatCaptureV1>
  readSourceResource?(binding:BrowserBindingV2,request:AuthorScriptResourceRequestV1,signal:AbortSignal):Promise<MvuJsonValue>
}
export interface BrowserFrameControllerV2 {
  readonly started:Promise<void>
  readonly registrations:readonly BrowserCallbackRegistrationV2[]
  publishSnapshot(snapshot:BrowserSnapshotV2):void
  render(render:BrowserRenderV2):void
  publishSaveConfirmation(reply:BrowserSaveReplyV2):void
  invokeGeneration(invocation:BrowserGenerationInvocationV2):Promise<BrowserGenerationResultV2>
  dispose():void
}
