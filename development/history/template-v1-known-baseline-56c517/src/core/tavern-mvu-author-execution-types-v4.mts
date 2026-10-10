/** Local, unapplied proposal. A plan classifies bytes; it grants no Source,
 * Native publication, state-ready, persistence, or zero-registration authority.
 * Existing executor 1–3 input/program records remain schemaVersion: 1. */
import type {
  MvuSchemaAuthorScript, MvuSchemaSourceBinding, MvuSchemaCompilerIdentity,
  MvuSchemaImplementationIdentity, MvuSchemaLibraryIdentity,
} from './tavern-mvu-schema-types.js'
import type ts from 'typescript'

export type StateLoaderGroupV1 = 'A' | 'B' | 'D'
export type ScriptCapabilityV1 = 'disabled' | 'server-schema' | 'native-state-loader'
  | 'browser-bootstrap' | 'browser-script' | 'unsupported'
export type ScriptDispositionV1 = 'disabled' | 'server' | 'native-owned' | 'browser-deferred' | 'refused'
export interface ImportBindingV4 {
  readonly specifier: string
  readonly kind: 'zod' | 'lodash' | 'schema-bridge' | 'native-state-loader'
  readonly implementationSha256: string
}
export interface RawAuthorScriptV4 extends Omit<MvuSchemaAuthorScript, 'imports'> {
  readonly imports: readonly ImportBindingV4[]
}
export interface AstSpanV1 { readonly start: number; readonly end: number }
export interface ScriptAstCoverageV1 {
  readonly encoding: 'native-mvu-complete-script-ast-coverage-v1'
  readonly sourceSha256: string
  readonly nodeCount: number
  readonly statementSpans: readonly AstSpanV1[]
}
export interface FixedStateDependencyV1 {
  readonly exactSpecifier: string
  readonly group: StateLoaderGroupV1
  readonly upstreamRootSha256: string
  readonly upstreamRootBytes: number
  readonly namespaceContract: 'empty-esm-namespace' | 'side-effect-only'
  readonly ownedImplementation: MvuSchemaImplementationIdentity
  /** Source order, not an HTTP attempt, winning CDN, or successful import. */
  readonly candidateOrdinal: number
}
export interface LoaderImportSiteV1 {
  readonly kind: 'bare-static' | 'bare-await-literal' | 'bounded-const-forof'
  readonly importSpan: AstSpanV1
  readonly argumentSpan: AstSpanV1
  readonly dependencies: readonly FixedStateDependencyV1[]
  /** Only an import argument may be lowered. Array strings, logs, return URLs,
   * try/catch and author source bytes remain the original values. */
  readonly lowering: 'replace-literal-specifier' | 'exact-url-conditional'
}
export interface ExecutionPlanScriptV1 {
  readonly ordinal: number
  readonly identity: string
  readonly pointer: string
  readonly enabled: boolean
  readonly sourceSha256: string
  readonly rawDescriptorSha256: string
  readonly classification: ScriptCapabilityV1
  readonly disposition: ScriptDispositionV1
  readonly coverage: ScriptAstCoverageV1 | null
  readonly loaderImports: readonly LoaderImportSiteV1[]
  readonly diagnosticCodes: readonly string[]
  readonly evidence: 'complete-loader-ast' | 'trusted-schema-worker'
    | 'local-audit-only' | 'disabled-source-retained' | 'none'
}
export interface RegisteredCommandPolicyBindingV1 {
  readonly scriptOrdinal:number
  readonly scriptIdentity:string
  readonly sourceSpan:AstSpanV1
  readonly specifier:string
  readonly importKind:'named'|'namespace'|'dynamic-namespace'
  readonly importedName:'registerMvuSchema'|'*'
  readonly localName:string|null
  readonly policy:'stagedog-command-discard-v1'
}
/** The protected compiler records real import sites, not the script's allowed
 * import inventory. The distinct lowered export owns each live registration. */
export interface RegisteredCommandPolicyProfileV1 {
  readonly schemaVersion:1
  readonly encoding:'native-mvu-registered-command-policy-profile-v1'
  readonly errorPolicy:'registered-command-policy-v1'
  readonly bindings:readonly RegisteredCommandPolicyBindingV1[]
  readonly profileSha256:string
}
export interface AuthorExecutionPlanV1 {
  readonly schemaVersion: 1
  readonly encoding: 'native-mvu-author-execution-plan-v1'
  readonly classifier: { readonly id: 'owned-author-ast-classifier'; readonly version: 1;
    readonly typescriptVersion: '5.9.3' }
  readonly dependencyPolicySha256: string
  readonly scripts: readonly ExecutionPlanScriptV1[]
  readonly summary: {
    readonly enabledServerSchema: number
    readonly enabledNativeLoaders: number
    readonly enabledBrowserDeferred: number
    readonly unsupportedEnabled: number
  }
  /** An enabled schema script always needs real registration and validation.
   * Schema failure/zero registration cannot fall back to an identity schema.
   * State-only still requires fully validated program and actual owned Native
   * initialization/publication. Import fulfilment cannot satisfy that rule. */
  readonly zeroRegistrationPolicy: 'forbid-if-any-enabled-server-schema'
  readonly rawExecutionPolicy: 'execute-only-server-schema'
  /** Public program validation must refuse local audit evidence. This flag is
   * descriptive, never a capability or production admission result. */
  readonly containsLocalAuditEvidence: boolean
  /** Absent in retained atomic plans; no historical shape or hash is upgraded. */
  readonly commandPolicyProfile?:RegisteredCommandPolicyProfileV1
  readonly executionPlanSha256: string
}
export interface MvuSchemaCompilationInputV4 {
  readonly schemaVersion: 2
  readonly encoding: 'native-mvu-author-compilation-input-v2'
  readonly source: MvuSchemaSourceBinding
  readonly scripts: readonly RawAuthorScriptV4[]
  readonly libraries: readonly MvuSchemaLibraryIdentity[]
  readonly bridge: MvuSchemaImplementationIdentity
  /** Root proposes deriving this owned mapper identity deterministically from
   * runtime4 bridge identity and the fixed policy SHA. The compiler must verify
   * that same formula. No upstream fetch/evaluation contributes authority. */
  readonly stateLoader: MvuSchemaImplementationIdentity
  /** Fresh compilation supplies null. The worker independently computes the
   * complete plan. Historical verifyProgram supplies the expected stored plan;
   * the worker still recomputes and compares it, never trusting caller data to
   * grant 0REG or Native publication. */
  readonly executionPlan: AuthorExecutionPlanV1 | null
}
export interface CompiledAuthorScriptV4 extends RawAuthorScriptV4 {
  /** Empty JS plus its real empty-string hash retains disabled/deferred raw
   * descriptors without pretending
   * that an empty module implemented the author's browser behavior. Native
   * loader source is also retained with empty JS: only its full AST proof enters
   * the plan/epoch, while owned Native initialization handles numerical state.
   * Only server-schema may contain executable owned-compiled JavaScript. */
  readonly javascript: string
  readonly javascriptSha256: string
}
export interface MvuSchemaProgramV4 extends Omit<MvuSchemaCompilationInputV4,
  'scripts' | 'encoding' | 'executionPlan'> {
  readonly encoding: 'native-mvu-author-schema-program-v2'
  readonly compiler: MvuSchemaCompilerIdentity & { readonly version: 4 }
  readonly scripts: readonly CompiledAuthorScriptV4[]
  /** Always the worker-recomputed plan, including full raw descriptor order. */
  readonly executionPlan: AuthorExecutionPlanV1
  readonly programSha256: string
}
export interface WorkerSchemaAstAdmissionRequest {
  readonly script: RawAuthorScriptV4
  readonly ordinal: number
  readonly sourceFile: ts.SourceFile
  readonly checker: ts.TypeChecker
}
export type WorkerSchemaAstAdmissionResult = {
  readonly kind: 'accepted-schema'
  readonly admittedSourceSha256: string
  readonly statementSpans: readonly AstSpanV1[]
  /** The worker must run its existing full AST/import/host/budget gates and
   * require actual schema registration intent. This is not a syntax hint. */
} | { readonly kind: 'not-schema' | 'refused'; readonly diagnosticCodes: readonly string[] }
/** PRIVATE TRUSTED WORKER CLOSURE ONLY. Never deserialize this function or an
 * accepted result from author input, host API requests or persisted records.
 * The production worker constructs it from its canonical schema AST gates. */
export type WorkerOwnedSchemaAstAdmission =
  (request: WorkerSchemaAstAdmissionRequest) => WorkerSchemaAstAdmissionResult

export interface LocalBrowserAuditEvidenceV1 {
  readonly localOnly: true
  readonly sourceSha256: string
  readonly classification: 'browser-bootstrap' | 'browser-script'
  readonly exactSpecifiers: readonly string[]
}
export interface PlannerOwnedDependenciesV1 {
  readonly stateLoaderImplementation: MvuSchemaImplementationIdentity & { readonly version: 4 }
  readonly admitSchemaAst?: WorkerOwnedSchemaAstAdmission
  /** Optional local review aid. Production must reject this evidence kind;
   * publishing support requires a complete known AST profile, not this hash. */
  readonly localBrowserAuditEvidence?: readonly LocalBrowserAuditEvidenceV1[]
}
export interface ExecutorSelectionHintV1 {
  readonly suggestedExecutorVersion: 3 | 4
  readonly authority: 'selection-hint-only'
  readonly knownEnabledDependencies: readonly {
    readonly scriptOrdinal: number
    readonly exactSpecifier: string
    readonly group: StateLoaderGroupV1
  }[]
  /** A v4 hint may accompany an unsupported complete script. Only validated
   * ProgramV2 plan plus actual Core/Native producers can admit execution. */
  readonly diagnosticCodes: readonly string[]
}
