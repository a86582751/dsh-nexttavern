/** Owned browser compiler and realm contracts. A compiled browser program is DATA, never a
 * current BrowserSession, a Core snapshot, or numerical publication authority. */
import type {RawAuthorScriptV4} from './tavern-mvu-author-execution-types-v4.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuPlayerEditExpected,MvuPlayerEditResponse}
  from './roleplay-mvu-player-types.js'
import type {MvuVariableReadOption} from './tavern-mvu-scope-read-types.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'

export type BrowserCapabilityV1='isolated-dom-text'|'isolated-dom-events'
  |'owned-variable-snapshot'|'owned-message-snapshot'
  |'owned-numerical-snapshot'|'owned-numerical-player-save'

export interface BrowserCapabilityContractV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-capability-contract-v1'
  readonly authority:'requirements-only'
  readonly capabilities:readonly BrowserCapabilityV1[]
  readonly getters:'synchronous-proven-snapshot-or-explicit-denial'
  readonly writer:'nexttavern-replace-values-with-parent-owned-operation'
  readonly modelRequests:'none'
  readonly contractSha256:string
}
export interface BrowserRuntimeIdentityV1 {
  readonly id:'native-author-browser-runtime'
  readonly version:1
  /** Supplied only by the trusted future asset/worker constructor. This hash
   * binds an implementation; it cannot prove its live owner or enable a route. */
  readonly implementationSha256:string
  readonly capabilityContractSha256:string
}
export interface BrowserCompilerIdentityV1 {
  readonly id:'native-author-browser-profile-compiler'
  readonly version:1
  readonly typescriptVersion:'5.9.3'
  readonly implementationSha256:string
}
export interface BrowserRawScriptV1 {
  /** Position in the complete original author descriptor list, not a sorted
   * browser-only index. The future combined planner proves the association. */
  readonly ordinal:number
  readonly descriptor:RawAuthorScriptV4
}
/** Original code provenance, supplied by the actual Host Source owner. Full
 * material and its existing schema spelling remain in the Host combined DATA.
 * Attaching this code to a current BrowserSession requires a separate Core
 * proof of the current session/worldline/Source/cut; this locator grants none. */
export interface BrowserProgramSourceLocatorV1 {
  readonly ownerSessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly sourceSha256:string
  readonly importRecordSha256:string
  readonly sourceSnapshotSha256:string
  readonly materialSha256:string
}
export interface BrowserCompilationInputV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-compilation-input-v1'
  readonly source:BrowserProgramSourceLocatorV1
  readonly scripts:readonly BrowserRawScriptV1[]
}
export interface BrowserAstSpanV1 {
  readonly start:number
  readonly end:number
  readonly syntaxKind:string
}
export interface BrowserAstCoverageV1 {
  readonly encoding:'native-author-browser-complete-ast-coverage-v1'
  readonly sourceSha256:string
  readonly nodeCount:number
  /** Every nested statement, including dormant branches and callbacks. */
  readonly statements:readonly BrowserAstSpanV1[]
  readonly startupWork:number
  readonly callableWork:readonly {start:number;end:number;work:number}[]
}
export interface BrowserCompiledScriptV1 extends BrowserRawScriptV1 {
  readonly descriptorSha256:string
  readonly disposition:'compiled-browser'|'disabled-source-retained'
  readonly javascript:string
  readonly javascriptSha256:string
  readonly entrypoint:'promise-returning-function-body'|'disabled'
  readonly coverage:BrowserAstCoverageV1|null
  readonly requiredCapabilities:readonly BrowserCapabilityV1[]
}
export interface BrowserProgramV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-program-v1'
  readonly authority:'compiled-program-data-only'
  readonly source:BrowserProgramSourceLocatorV1
  readonly compiler:BrowserCompilerIdentityV1
  readonly profile:{readonly id:'nexttavern-browser-dom-snapshot-player';readonly version:1;readonly sha256:string}
  readonly runtime:BrowserRuntimeIdentityV1
  readonly capabilityContract:BrowserCapabilityContractV1
  readonly scripts:readonly BrowserCompiledScriptV1[]
  readonly requiredCapabilities:readonly BrowserCapabilityV1[]
  readonly programSha256:string
}
export interface BrowserDiagnosticV1 {
  readonly code:string
  readonly scriptIdentity?:string
  readonly pointer?:string
  readonly ordinal?:number
  readonly line?:number
  readonly column?:number
  /** A syntax/member/capability name, never original author body or a stack. */
  readonly feature?:string
}
export type BrowserCompilationV1={readonly kind:'compiled';readonly program:BrowserProgramV1}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV1[]}
export type BrowserCandidateRowV1=BrowserRawScriptV1&(
  |{readonly kind:'compiled'|'disabled';readonly compiled:BrowserCompiledScriptV1}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV1[]})
export interface BrowserCandidateBatchV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-candidate-batch-v1'
  readonly source:BrowserProgramSourceLocatorV1
  readonly rows:readonly BrowserCandidateRowV1[]
}
export interface BrowserCompilerV1 {
  readonly identity:BrowserCompilerIdentityV1
  compile(input:BrowserCompilationInputV1):BrowserCompilationV1
  compileCandidates(input:BrowserCompilationInputV1):BrowserCandidateBatchV1
  assembleAccepted(batch:BrowserCandidateBatchV1,ordinals:readonly number[]):BrowserCompilationV1
  /** Repeats actual AST/semantic compilation with this trusted runtime binding.
   * No caller-provided audit hash or cached classification can replace it. */
  verifyProgram(program:BrowserProgramV1):boolean
}
export type BrowserPartitionV1={readonly kind:'partitioned';readonly source:BrowserProgramSourceLocatorV1;
  readonly browserProgram:BrowserProgramV1|null;readonly serverOrdinals:readonly number[]}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV1[]}
export interface OwnedAuthorBrowserRuntimeV1 extends BrowserPartitionCompilerV1 {
  readonly artifact:BrowserRuntimeArtifactV1
}
export interface BrowserPartitionCompilerV1 {
  readonly identity:BrowserCompilerIdentityV1
  readonly runtime:BrowserRuntimeIdentityV1
  partition(input:BrowserCompilationInputV1,signal?:AbortSignal):Promise<BrowserPartitionV1>
  dispose():Promise<void>
}

export interface BrowserChatMessageSnapshotV1 {
  readonly position:number
  readonly ownerSessionId:string
  readonly nativeSeq:number
  readonly messageId:string
  readonly messageVersionSha256:string
  readonly selectedVariant:string
  readonly role:'user'|'assistant'
  readonly text:string
}
export type BrowserNumericalSnapshotV1=
  |{readonly kind:'ready'|'schema-ready';readonly values:MvuJsonObject;
    readonly expected:MvuPlayerEditExpected;readonly canEdit:boolean;readonly editBlockCode?:string}
  |{readonly kind:'blocked';readonly code:string;readonly canEdit:false}
  |{readonly kind:'unknown';readonly code:string;readonly canEdit:false}
/** Product APIs, not aliases for TavernHelper chat/message variable writes.
 * The future parent owner installs returned actual snapshots before resolving
 * a save, retains the exact unknown-write request for confirmation, and revokes
 * late results when its session/worldline/Source generation changes. */
export interface BrowserOwnedSnapshotsV1 {
  getVariables(option?:MvuVariableReadOption):Readonly<MvuJsonObject>|undefined
  getChatMessages():readonly BrowserChatMessageSnapshotV1[]
  getNumericalState():BrowserNumericalSnapshotV1
  replaceNumericalValues(values:MvuJsonObject,expected:MvuPlayerEditExpected):Promise<MvuPlayerEditResponse>
}

/** Real Core supplies this projection. Its metadata describes the captured
 * cut; it creates no Native permission and includes no complete Source body. */
export interface BrowserSnapshotV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-snapshot-v1'
  readonly generation:string
  readonly readRevision:number
  readonly basis:{readonly sessionId:string;readonly sourceSnapshotSha256:string;
    readonly materialSha256:string;readonly numericalSnapshotSha256:string;
    readonly nativeCut:number;readonly nativePrefixSha256:string}
  readonly scopeFrame:MvuScopeReadFrameV1
  readonly messages:readonly BrowserChatMessageSnapshotV1[]
  readonly numerical:BrowserNumericalSnapshotV1
}
export interface BrowserBindingV1 {
  readonly browserSessionId:string
  readonly generation:string
  readonly sessionId:string
  readonly programSha256:string
}
export interface BrowserRenderV1 {
  readonly renderRevision:number
  readonly css:string
  /** Trusted Reader has already sanitized html under its existing policy. */
  readonly parts:readonly {readonly key:string;readonly text:string;readonly html:string;
    readonly kind:'user'|'narrator'}[]
}
export interface BrowserSaveRequestV1 {
  readonly requestId:number
  readonly generation:string
  readonly readRevision:number
  readonly scriptIdentity:string
  readonly values:MvuJsonObject
  readonly expected:MvuPlayerEditExpected
}
export interface BrowserSaveReplyV1 {
  readonly requestId:number
  readonly generation:string
  readonly result:MvuPlayerEditResponse
  readonly snapshot:BrowserSnapshotV1
}
/** Actual adapter, implemented later by Root against the existing Core owner.
 * It owns operationId and retained unknown-ACK request bytes. Confirming reuses
 * that request; the bridge never asks author code to transform values again. */
export interface BrowserHostBridgeV1 {
  capture(binding:BrowserBindingV1,signal:AbortSignal):Promise<BrowserSnapshotV1>
  save(binding:BrowserBindingV1,request:BrowserSaveRequestV1,signal:AbortSignal):Promise<BrowserSaveReplyV1>
}
export interface BrowserRuntimeArtifactV1 {
  readonly schemaVersion:1
  readonly childJavascript:string
  readonly childSha256:string
  readonly guardJavascript:string
  readonly guardSha256:string
  readonly identity:BrowserRuntimeIdentityV1
}

