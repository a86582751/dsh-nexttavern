import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type TavernTemplateScopeV1='card'|'chat'|'message'|'script'|'global'|'initial'|'cache'
/** Scope names only select one explicit frozen binding. They cannot establish
 * actual Source/current ownership, a runtime lease or Native authority. */
export interface TavernTemplateScopeBindingV1 {
  readonly scope:TavernTemplateScopeV1
  readonly ownerId:string
  readonly versionSha256:string
  readonly values:MvuJsonObject
  readonly valuesSha256:string
}
export interface TavernTemplateLoreBindingV1 {
  readonly key:string
  readonly bookId:string
  readonly entryId:string
  readonly sourcePointer:string
  readonly sourceSnapshotSha256:string
  readonly content:string
  readonly contentSha256:string
  readonly activationAllowed:boolean
  /** Fixed primary-book lookup order is the array order. Repeated comments are
   * retained; getwi selects the first actual matching entry. */
  readonly lookup?:{readonly world:string;readonly title:string;readonly uid:number|null}
  /** Catalog staging never grants admission to unsupported transformed text. */
  readonly readDiagnostic?:{readonly code:string;readonly projectionSha256:string}
}
export interface TavernTemplateFrozenSnapshotV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-frozen-snapshot-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly branchId:string
  readonly revision:number
  readonly turnId:string
  readonly attemptId:string
  readonly packageSha256:string
  readonly sourceSnapshotSha256:string
  readonly stateSnapshotSha256:string
  readonly defaultVariableScope:TavernTemplateScopeV1
  readonly scopes:readonly TavernTemplateScopeBindingV1[]
  readonly scopesSha256:string
  readonly lore:readonly TavernTemplateLoreBindingV1[]
  readonly loreSha256:string
  readonly clockEpochMs:number
  readonly randomSeed:string
  readonly randomSeedSha256:string
  readonly snapshotSha256:string
}
export interface TavernTemplateRequestV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-request-v1'
  readonly source:{readonly pointer:string;readonly template:string;readonly templateSha256:string;
    readonly sourceSnapshotSha256:string;readonly packageSha256:string;readonly rootEntryId?:string}
  readonly snapshot:TavernTemplateFrozenSnapshotV1
  readonly requestSha256:string
}
export interface TavernTemplateReadV1 {
  readonly kind:'variable'|'lore'
  readonly purpose:'read'|'activation-proposal'
  readonly scope:TavernTemplateScopeV1|null
  readonly ownerId:string|null
  readonly key:string|null
  readonly present:boolean
  readonly versionSha256:string
  readonly valueSha256:string|null
  readonly entryId:string|null
  readonly sourcePointer:string|null
}
export interface TavernTemplateActivationProposalV1 {
  readonly schemaVersion:1
  readonly kind:'activate-lore-entry'
  readonly entryId:string
  readonly bookId:string
  readonly sourcePointer:string
  readonly contentSha256:string
  readonly sourceSnapshotSha256:string
  readonly baseSnapshotSha256:string
  readonly branchId:string
  readonly turnId:string
  readonly attemptId:string
}
export interface TavernTemplateEngineIdentityV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-engine-identity-v1'
  readonly packageName:'dsh-nexttavern-template-runtime-v1'
  readonly packageVersion:'0.1.0'
  readonly protectedGeneration:string
  readonly implementationSha256:string
  readonly policySha256:string
  readonly dependencies:{readonly 'quickjs-emscripten-core':'0.32.0';
    readonly '@jitl/quickjs-wasmfile-release-sync':'0.32.0';readonly '@jitl/quickjs-ffi-types':'0.32.0'}
}
/** Each actual nested invocation owns an accumulator and an ancestor chain.
 * These hashes are replay data; they do not grant Source or Native permission. */
export interface TavernTemplateNestedRenderV1 {
  readonly invocation:number
  readonly parentInvocation:number
  readonly entryId:string
  readonly sourcePointer:string
  readonly contentSha256:string
  readonly compiledSourceSha256:string
  readonly renderedTextSha256:string
  readonly outputChars:number
  readonly outputBytes:number
}
export interface TavernTemplateOutputV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-output-v1'
  readonly authority:'consumer-data-only'
  readonly requestSha256:string
  readonly sourceSha256:string
  readonly sourcePointer:string
  readonly snapshotSha256:string
  readonly engine:TavernTemplateEngineIdentityV1
  readonly renderedText:string
  readonly renderedTextSha256:string
  readonly readDependencies:readonly TavernTemplateReadV1[]
  readonly activationProposals:readonly TavernTemplateActivationProposalV1[]
  readonly nestedRenders:readonly TavernTemplateNestedRenderV1[]
  /** Present only when this execution performed an injection effect. */
  readonly injectionEffects?:readonly TavernTemplateInjectionEffectV1[]
  readonly outputSha256:string
}
export interface TavernTemplateDiagnosticV1 {
  readonly schemaVersion:1
  readonly code:string
  readonly sourcePointer:string|null
  readonly limit:{readonly field:string;readonly observed:number|null;readonly maximum:number}|null
}
export type TavernTemplateResultV1={readonly kind:'rendered';readonly output:TavernTemplateOutputV1}
  |{readonly kind:'refused'|'cancelled';readonly diagnostics:readonly TavernTemplateDiagnosticV1[]}
export interface TavernTemplateRuntimeV1 {
  readonly identity:TavernTemplateEngineIdentityV1
  render(input:unknown,signal?:AbortSignal):Promise<TavernTemplateResultV1>
  /** Actual guest replay, followed by exact whole-output comparison. */
  verify(input:unknown,output:unknown,signal?:AbortSignal):Promise<boolean>
  restoreAndEvaluateInjectionsV1(input:unknown,signal?:AbortSignal):Promise<TavernTemplateInjectionResultV1>
  dispose():Promise<void>
}
/** Internal product/component current protocol. These extra readonly guards
 * are not part of the prior public identity/render/replay/dispose promise.
 * A scope owns one synchronous read boundary, never execution permission. */
export interface TavernTemplateCurrentRuntimeV1 extends TavernTemplateRuntimeV1 {
  checkCurrent():TavernTemplateOwnedInventoryV1
  checkCurrentSync(checks:()=>void):void
  invalidateCurrent():void
  assertCurrentScopeInactive():void
}
export interface TavernTemplatePackageFileV1 {readonly path:string;readonly sha256:string}
export interface TavernTemplateOwnedInventoryV1 {
  readonly name:'dsh-nexttavern-template-runtime-v1'
  readonly version:'0.1.0'
  readonly generation:string
  readonly files:readonly TavernTemplatePackageFileV1[]
}
export type TavernTemplateWorkerRequestV1={readonly request:TavernTemplateRequestV1;
  readonly engine:TavernTemplateEngineIdentityV1;readonly inventory:TavernTemplateOwnedInventoryV1}
export type TavernTemplateWorkerResponseV1={readonly kind:'rendered';readonly output:TavernTemplateOutputV1}
  |{readonly kind:'refused';readonly diagnostic:TavernTemplateDiagnosticV1}

export interface TavernTemplateInjectionPromptV1 {
  readonly id:string
  readonly position:'in_chat'|'none'
  readonly depth:number
  readonly role:'system'|'user'|'assistant'
  readonly content:string
  readonly should_scan:boolean
  readonly once:boolean
  readonly batchOrdinal:number
  readonly callbackOrdinal:number|null
}
/** Ordinals identify private functions in the one reconstructed realm. They
 * are replay data and never grant logical Source/Native owner authority. */
export type TavernTemplateInjectionEffectV1=
  |{readonly ordinal:number;readonly kind:'batch-created';readonly batchOrdinal:number;readonly once:boolean;
    readonly ids:readonly string[]}
  |{readonly ordinal:number;readonly kind:'register';readonly prompt:TavernTemplateInjectionPromptV1}
  |{readonly ordinal:number;readonly kind:'remove-ids';readonly ids:readonly string[];
    readonly batchOrdinal:number|null}
export type TavernTemplateInjectionActionV1=
  |{readonly kind:'filter';readonly callbackOrdinal:number;readonly consumer:'scan'|'chat';readonly invocationId:string}
  |{readonly kind:'dispose-batch';readonly batchOrdinal:number;readonly consumer:'terminal'|'owner-close';
    readonly invocationId:string}
export interface TavernTemplateInjectionPhaseV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-injection-phase-v1'
  readonly snapshot:TavernTemplateFrozenSnapshotV1
  readonly schedule:readonly TavernTemplateInjectionActionV1[]
  readonly phaseSha256:string
}
export interface TavernTemplateInjectionReceiptV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-injection-receipt-v1'
  readonly authority:'consumer-data-only'
  readonly programInstanceId:string
  readonly phaseSha256:string
  readonly previousHeadSha256:string
  readonly engine:TavernTemplateEngineIdentityV1
  readonly invocations:readonly {readonly action:TavernTemplateInjectionActionV1;
    readonly accepted:boolean|null;readonly output:TavernTemplateOutputV1}[]
  readonly nextBatchOrdinal:number
  readonly nextCallbackOrdinal:number
  readonly nextEffectOrdinal:number
  readonly receiptSha256:string
}
export interface TavernTemplateInjectionRestoreV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-injection-restore-v1'
  readonly programInstanceId:string
  readonly creation:{readonly request:TavernTemplateRequestV1;readonly expectedOutput:TavernTemplateOutputV1}
  readonly journal:readonly {readonly phase:TavernTemplateInjectionPhaseV1;
    readonly expectedReceipt:TavernTemplateInjectionReceiptV1}[]
  readonly expectedHeadSha256:string
  readonly current:TavernTemplateInjectionPhaseV1
}
export type TavernTemplateInjectionResultV1={readonly kind:'evaluated';readonly receipt:TavernTemplateInjectionReceiptV1}
  |Extract<TavernTemplateResultV1,{kind:'refused'|'cancelled'}>
export interface TavernTemplateDisposalDerivationV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-disposal-derived-v1'
  readonly authority:'consumer-data-only'
  readonly origin:'derived-trusted-disposal'
  readonly policySha:string
  readonly programInstanceId:string
  readonly creationRequestSha256:string
  readonly creationOutputSha256:string
  readonly previousHeadSha256:string
  readonly phaseSha256:string
  readonly receiptSha256:string
  readonly observedGuestExecution:false
  readonly derivationSha256:string
}
export interface TavernTemplateTrustedDisposalV1 {
  readonly receipt:TavernTemplateInjectionReceiptV1
  readonly derivation:TavernTemplateDisposalDerivationV1
}
