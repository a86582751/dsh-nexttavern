/** HTML3 compilation describes execution requirements. Core owns the actual
 * Source/session attachment; no page plan or declaration grants that lifetime. */
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AuthorChatCaptureV1,AuthorChatRevisionV1} from './roleplay-author-chat-state-types.js'
import type {AuthorChatCaptureV2} from './roleplay-author-chat-state-v2-types.js'
import type {BrowserBindingV1,BrowserDiagnosticV1,BrowserProgramSourceLocatorV1,
  BrowserRawScriptV1,BrowserSaveRequestV1} from './tavern-author-browser-types.mjs'
import type {BrowserCapabilityV2,BrowserCompiledScriptV2,BrowserAstCoverageV2,BrowserSnapshotV2,
  BrowserRuntimeArtifactV2,BrowserHostBridgeV2,BrowserGeneratedTaskV2,
  BrowserGenerateRawRequestV2,BrowserAuthorChatRequestV2,
  BrowserWorldbookMutationRequestV2,BrowserWorldbookMutationReplyV2,
  BrowserPersonaMutationRequestV2,BrowserPersonaMutationReplyV2} from './tavern-author-browser-types-v2.mjs'
import type {SourceHtmlInputV1,HtmlParsedCandidateV1,SourcePageOriginV1} from './tavern-author-html-types-v1.mjs'
import type {MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {BrowserSourceEventV3} from './tavern-author-browser-worker-protocol-v3.js'

export type BrowserCapabilityV3=BrowserCapabilityV2|'owned-source-html-page'
  |'owned-synchronous-page-events'|'owned-page-canvas-svg'|'owned-page-audio'
  |'owned-page-ephemeral-preferences'|'owned-declared-key-mutation'|'owned-page-file-gesture'
  |'owned-page-frame-lifecycle'|'owned-numerical-variable-replacement'
export interface BrowserCapabilityContractV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-capability-contract-v3'
  readonly authority:'requirements-only'
  readonly capabilities:readonly BrowserCapabilityV3[]
  readonly getters:'synchronous-owned-snapshot-and-opaque-dom'
  readonly execution:'actual-worker-quickjs-asyncify-shared-contexts'
  readonly writer:'source-fifo-declared-key-with-canonical-ack'
  readonly modelRequests:'explicit-parent-owned-author-dialog-only'
  readonly contractSha256:string
}
export interface BrowserCompilerIdentityV3 {
  readonly id:'native-author-browser-profile-compiler'
  readonly version:3
  readonly typescriptVersion:'5.9.3'
  readonly implementationSha256:string
}
export interface BrowserRuntimeIdentityV3 {
  readonly id:'native-author-browser-runtime'
  readonly version:3
  readonly quickjsVersion:'0.32.0'
  readonly implementationSha256:string
  readonly capabilityContractSha256:string
}
export interface BrowserCompilationInputV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-compilation-input-v3'
  readonly source:BrowserProgramSourceLocatorV1
  readonly scripts:readonly BrowserRawScriptV1[]
  /** Selected once from actual Combined Source material, never posted HTML. */
  readonly sourcePages:readonly SourceHtmlInputV1[]
  /** Selected from the same actual Source reader. Author IDs and character
   * trees keep their original semantics; code descriptor identities are pins. */
  readonly sourceResources:BrowserScriptResourceProjectionV3
}
export interface BrowserScriptResourceProjectionV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-script-resource-projection-v3'
  readonly sourceSnapshotSha256:string
  readonly callers:readonly {
    readonly originalOrdinal:number
    readonly identity:string
    readonly authorId:string
    readonly hasOriginalId:boolean
    readonly data:MvuJsonValue
  }[]
  readonly characterTrees:MvuJsonValue
}
export interface BrowserWriterOriginV3 {
  /** Source declaration provenance, not the identity of a live VM caller. */
  readonly originalOrdinal:number
  readonly scriptIdentity:string
  readonly descriptorSha256:string
  readonly page:null|{
    readonly htmlSha256:string
    readonly inlineOrdinal:number
    readonly javascriptSha256:string
  }
}
export interface BrowserDeclaredChatKeyV3 {
  readonly declarationId:string
  readonly scope:'chat'
  readonly key:string
  readonly kind:'ordinary-source-key'|'completed-author-dialog'
  readonly writer:BrowserWriterOriginV3
  /** Derived from these pins and key before the containing program hash. */
  readonly writerIdentitySha256:string
}
export interface BrowserPageAstAdmissionV3 {
  readonly encoding:'native-author-browser-page-ast-admission-v3'
  readonly inlineOrdinal:number
  readonly javascriptSha256:string
  readonly coverageSha256:string
  readonly requiredCapabilities:readonly BrowserCapabilityV3[]
  readonly declarations:readonly BrowserDeclaredChatKeyV3[]
  readonly admissionSha256:string
}
/** Literal/source resources are compiled requirements. The renderer owns
 * actual bytes, resource requests and cancellation for the attached page. */
export interface BrowserPageResourceV3 {
  readonly resourceId:string
  readonly kind:'image'|'audio'|'font-stylesheet'|'font'|'stylesheet'|'download'
  readonly location:'source-data'|'declared-url'|'owned-file'
  readonly value:string
  readonly provenance:{readonly nodeId?:number;readonly styleOrdinal?:number;
    readonly inlineOrdinal?:number;readonly start:number;readonly end:number}
}
/** The complete parsed page is necessary input, not executable admission.
 * Only Browser3's complete AST/resource compiler constructs this successor. */
export interface BrowserSourcePagePlanV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-source-page-plan-v3'
  readonly authority:'compiled-program-data-only'
  readonly origin:SourcePageOriginV1
  readonly parsed:HtmlParsedCandidateV1
  readonly scripts:readonly BrowserPageAstAdmissionV3[]
  readonly resources:readonly BrowserPageResourceV3[]
  readonly requiredCapabilities:readonly BrowserCapabilityV3[]
  readonly declarations:readonly BrowserDeclaredChatKeyV3[]
  readonly pagePlanSha256:string
}
export interface BrowserAstCoverageV3 extends Omit<BrowserAstCoverageV2,'encoding'> {
  readonly encoding:'native-author-browser-complete-ast-coverage-v3'
}
export interface BrowserCompiledScriptV3 extends Omit<BrowserCompiledScriptV2,
  'requiredCapabilities'|'ownedChatKey'|'coverage'> {
  readonly requiredCapabilities:readonly BrowserCapabilityV3[]
  readonly coverage:BrowserAstCoverageV3|null
  readonly declarations:readonly BrowserDeclaredChatKeyV3[]
  /** Carrier mount proof identifies its captured Source resource. */
  readonly sourcePagePlans:readonly string[]
}
export interface BrowserProgramV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-program-v3'
  readonly authority:'compiled-program-data-only'
  readonly source:BrowserProgramSourceLocatorV1
  readonly compiler:BrowserCompilerIdentityV3
  readonly profile:{readonly id:'nexttavern-browser-source-html';readonly version:3;readonly sha256:string}
  readonly runtime:BrowserRuntimeIdentityV3
  readonly capabilityContract:BrowserCapabilityContractV3
  readonly scripts:readonly BrowserCompiledScriptV3[]
  readonly sourcePages:readonly BrowserSourcePagePlanV3[]
  readonly declarations:readonly BrowserDeclaredChatKeyV3[]
  readonly requiredCapabilities:readonly BrowserCapabilityV3[]
  readonly programSha256:string
}
export type BrowserCompilationV3={readonly kind:'compiled';readonly program:BrowserProgramV3}
  |{readonly kind:'refused';readonly diagnostics:readonly BrowserDiagnosticV1[]}
/** Complete compilation runs in the package-owned Node worker. The parent
 * receives DATA only after that worker has stopped. */
export interface BrowserCompilerV3 {
  readonly identity:BrowserCompilerIdentityV3
  readonly runtime:BrowserRuntimeIdentityV3
  compile(input:BrowserCompilationInputV3,signal?:AbortSignal):Promise<BrowserCompilationV3>
}
export interface OwnedAuthorBrowserRuntimeV3 extends BrowserCompilerV3 {
  readonly artifact:BrowserRuntimeArtifactV3
  dispose():Promise<void>
}
export interface BrowserDeclaredChatCaptureV3 {
  readonly declarationId:string
  readonly capture:AuthorChatCaptureV2
}
export interface BrowserSnapshotV3 extends Omit<BrowserSnapshotV2,'schemaVersion'|'encoding'|'authorChat'> {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-snapshot-v3'
  readonly authorChats:readonly BrowserDeclaredChatCaptureV3[]
}
export interface BrowserOrdinaryKeyRequestV3 {
  /** Core resolves this key in its actual attachment's admitted declarations. */
  readonly key:string
  readonly operationId:string
  readonly expected:AuthorChatRevisionV1
  readonly value:MvuJsonValue
}
export interface BrowserOrdinaryKeyReplyV3 {
  readonly kind:'committed'|'replayed'
  readonly capture:BrowserDeclaredChatCaptureV3
}
export interface BrowserSaveReplyV3 {
  readonly requestId:number
  readonly generation:string
  readonly result:MvuPlayerEditResponse
  readonly snapshot:BrowserSnapshotV3
  /** Actual Core publication signals; replay and no-update have none. */
  readonly sourceEvents?:readonly BrowserSourceEventV3[]
}
/** Worker/VM/compiler package bytes. Native Main executes the product UI
 * build; it does not execute the legacy child or guard artifact modules. */
export interface BrowserRuntimeArtifactV3 extends Pick<BrowserRuntimeArtifactV2,
  'executionWorkerJavascript'|'executionWorkerSha256'|'wasm'> {
  readonly schemaVersion:3
  readonly identity:BrowserRuntimeIdentityV3
  /** The Browser3 byte producer supplies its distinct complete compiler
   * identity. DATA compilation alone cannot admit this artifact for execution. */
  readonly compiler:BrowserCompilerIdentityV3
}
export interface BrowserHostBridgeV3 extends Pick<BrowserHostBridgeV2,'readSourceResource'> {
  capture(binding:BrowserBindingV1,signal:AbortSignal):Promise<BrowserSnapshotV3>
  save(binding:BrowserBindingV1,request:BrowserSaveRequestV1,signal:AbortSignal):Promise<BrowserSaveReplyV3>
  mutateAuthorKey(binding:BrowserBindingV1,request:BrowserOrdinaryKeyRequestV3,
    signal:AbortSignal):Promise<BrowserOrdinaryKeyReplyV3&{readonly snapshot?:BrowserSnapshotV3}>
  generateRaw?(binding:BrowserBindingV1,request:BrowserGenerateRawRequestV2,
    signal:AbortSignal):Promise<BrowserGeneratedTaskV2>
  updateAuthorChat?(binding:BrowserBindingV1,request:BrowserAuthorChatRequestV2,
    signal:AbortSignal):Promise<AuthorChatCaptureV1>
  mutateWorldbook?(binding:BrowserBindingV1,request:BrowserWorldbookMutationRequestV2,
    signal:AbortSignal):Promise<Omit<BrowserWorldbookMutationReplyV2,'snapshot'>&{snapshot?:BrowserSnapshotV3}>
  mutatePersona?(binding:BrowserBindingV1,request:BrowserPersonaMutationRequestV2,
    signal:AbortSignal):Promise<Omit<BrowserPersonaMutationReplyV2,'snapshot'>&{snapshot?:BrowserSnapshotV3}>
}
