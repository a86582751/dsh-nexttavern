/** Consumer facts for a distinct nonnumerical template Source domain. None of
 * these serialized records grants a VM, Source lease or numerical writer. */
import type {OpeningCatalog,OpeningIntentIdentity,OpeningIntentV4,OpeningInitializationCode,OpeningRejectionCode,
  OpeningSource} from './roleplay-opening-selection.js'
import type {MvuNativeOpeningReceipt} from './roleplay-mvu-initialization.js'
import type {MvuSourceDeps,MvuSourceRequest,MvuSourceRowRef} from './roleplay-mvu-source.js'
import type {TavernLoreBookAbsenceProofV1} from './tavern-lore-plan-types.mjs'
import type {ReadBranchSession} from './roleplay-worldline-types.js'
import type {TavernOpeningContext} from './tavern-card.js'
import type {TavernLoreSourceDataV1,TavernLoreSourceDepsV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernSourceInheritanceDescriptorV1,TavernSourceNativeCutV1,TavernSourceInheritanceRefV1}
  from './roleplay-tavern-source-inheritance-types.js'

export type PromptTemplateOnlyFieldV1='description'|'personality'|'scenario'|'mes_example'
  |'system_prompt'|'post_history_instructions'
export type PromptTemplateOnlyCodeV1='PROMPT_TEMPLATE_SOURCE_OUTSIDE_DOMAIN'
  |'PROMPT_TEMPLATE_OPENING_UNSUPPORTED'|'PROMPT_TEMPLATE_CURRENT_ORIGIN_UNPROVEN'
  |'PROMPT_TEMPLATE_RUNTIME_REQUIRED'|'PROMPT_TEMPLATE_PROTOCOL_UNAVAILABLE'
  |'PROMPT_TEMPLATE_NUMERICAL_STATE_PRESENT'|'PROMPT_TEMPLATE_SOURCE_CHANGED'
  |'PROMPT_TEMPLATE_SEGMENT_INVALID'|'PROMPT_TEMPLATE_BUDGET'|'PROMPT_TEMPLATE_RECORD_INVALID'
  |'PROMPT_TEMPLATE_INHERITANCE_UNPROVEN'
export interface PromptTemplateOnlyDiagnosticV1 {
  readonly code:PromptTemplateOnlyCodeV1
  readonly pointer:string
}
export interface PromptTemplateOnlyRequiredRuntimeV1 {
  readonly protocol:'owned-template-v1'
  readonly policySha256:string
}
export interface PromptTemplateOnlyRuntimeRequestV1 {
  readonly sessionId:string
  readonly sourceProofSha256:string
  readonly required:PromptTemplateOnlyRequiredRuntimeV1
}
/** Private actual owner methods. A data proof or persisted generation string
 * cannot satisfy this interface; cold current must inspect an actual owner. */
export interface PromptTemplateOnlyRuntimeOwnerV1 {
  preflight(request:PromptTemplateOnlyRuntimeRequestV1,signal?:AbortSignal):Promise<void>
  current(request:PromptTemplateOnlyRuntimeRequestV1):boolean
  /** Availability alone cannot authorize consuming executable package bytes.
   * Existing owners without this seam retain full current checks. */
  observe?(request:PromptTemplateOnlyRuntimeRequestV1):boolean
}
export interface PromptTemplateOnlySegmentV1 {
  readonly kind:'literal'|'expression'|'statement'
  /** Offsets count UTF-16 code units in the complete raw field value. */
  readonly start:number
  readonly end:number
  readonly textSha256:string
  readonly sourcePointer:string
  readonly program: {readonly disposition:'protected-prompt-program';readonly bodyStart:number;
    readonly bodyEnd:number;readonly bodySha256:string;readonly output:'raw-expression-equals'|'raw-expression-minus'|'code'}|null
}
export interface PromptTemplateOnlyProjectionOriginV1 {
  readonly row:MvuSourceRowRef
  readonly fieldPointer:string
  readonly valueSha256:string
  readonly valueLength:number
  readonly start:number
  readonly end:number
  readonly normalizedTextSha256:string
  readonly assignmentIndex:number
  readonly assignmentSha256:string
  readonly sourceDescriptorSha256:string
  readonly sourceSpans:readonly {readonly startLine:number;readonly endLine:number}[]
}
export interface PromptTemplateOnlyFieldOriginV1 {
  readonly field:PromptTemplateOnlyFieldV1
  readonly sourcePointer:string
  readonly presence:'absent'|'text'
  readonly rawText:string|null
  readonly rawTextSha256:string|null
  readonly rawLength:number
  readonly segments:readonly PromptTemplateOnlySegmentV1[]
  readonly segmentsSha256:string
  readonly normalizedText:string|null
  readonly normalizedSegments:readonly PromptTemplateOnlySegmentV1[]
  readonly normalizedSegmentsSha256:string
  readonly projection:PromptTemplateOnlyProjectionOriginV1|null
}
export interface PromptTemplateOnlyRootDomainV1 {
  readonly sessionId:string
  readonly ownerSessionId:string
  readonly metaKey:string
  readonly inheritance:'root'
  readonly parentSessionId:null
  readonly inheritedEventCount:0
  readonly ready:true
  readonly meta: {readonly createdAt:number|null;readonly inheritanceState:'ready'|null;
    readonly inheritedFrom:null;readonly freshBranchFrom:null;readonly truncatedFrom:null}
  readonly rootDomainSha256:string
}
export interface PromptTemplateOnlyScopeInventoryV1 {
  readonly schemaVersion:1
  readonly encoding:'native-prompt-template-only-empty-state-inventory-v1'
  readonly sessionId:string
  readonly root:PromptTemplateOnlyRootDomainV1
  readonly numericalRows:readonly []
  readonly opaqueRows:readonly []
  readonly numericalMembershipSha256:string
  readonly opaqueMembershipSha256:string
  readonly inventorySha256:string
}
export interface PromptTemplateOnlySourceSnapshotV1 {
  readonly schemaVersion:1
  readonly encoding:'native-prompt-template-only-source-snapshot-v1'
  readonly source:OpeningSource
  readonly normalizer:'tavern-fields-v1'|'tavern-fields-v2'
  readonly documentSha256:string
  readonly dataSha256:string
  readonly pointerSha256:string
  readonly importRecordSha256:string
  readonly coverageSha256:string
  /** Complete actual author rows and fixed absence facts. Meta has its own
   * structural root inventory; lastTurn/lastSeq/surfaceTokens are not Source. */
  readonly materialRows:readonly MvuSourceRowRef[]
  readonly materialRowsSha256:string
  readonly membership: {readonly cards:Readonly<Record<string,string>>;
    readonly worldbook:Readonly<Record<string,string>>;readonly rules:string;readonly settings:string;
    readonly membershipSha256:string}
  readonly selected: {readonly index:number;readonly pointer:string;readonly sourceSha256:string;
    readonly renderedSha256:string}
  readonly swipes:readonly {readonly index:number;readonly pointer:string;readonly sourceSha256:string;
    readonly renderedSha256:string}[]
  readonly openingContext: {readonly context:TavernOpeningContext;readonly bindingSha256:string;readonly valuesSha256:string}
  readonly scopeInventory:PromptTemplateOnlyScopeInventoryV1
  readonly snapshotSha256:string
}
export interface PromptTemplateOnlySourceProofV1 {
  readonly schemaVersion:1
  readonly encoding:'native-prompt-template-only-source-proof-v1'
  readonly authority:'consumer-data-only'
  readonly policySha256:string
  readonly sourceSnapshot:PromptTemplateOnlySourceSnapshotV1
  readonly primaryBookAbsence:TavernLoreBookAbsenceProofV1
  readonly templateFields:readonly PromptTemplateOnlyFieldOriginV1[]
  readonly fieldInventorySha256:string
  readonly exclusionInventorySha256:string
  readonly initialization: {readonly kind:'none';readonly scopeInventorySha256:string}
  readonly requiredPromptRuntime:PromptTemplateOnlyRequiredRuntimeV1
  readonly proofSha256:string
}
export type PromptTemplateOnlySourceDecisionV1={readonly kind:'prompt-template-only';readonly proof:PromptTemplateOnlySourceProofV1}
  |{readonly kind:'not-applicable'}|{readonly kind:'unsupported';readonly diagnostics:readonly PromptTemplateOnlyDiagnosticV1[]}
export interface PromptTemplateOnlySourceDepsV1 extends Pick<MvuSourceDeps,
  'readActivePointer'|'readImportRecord'|'readRow'|'recordVersionsFor'|'readOpeningContext'> {
  session(sessionId:string):ReadBranchSession|undefined
  branchReady(sessionId:string):boolean
  entries(table:'branch'|'status'):Iterable<[string,unknown]>
  readSourceInheritance?:TavernLoreSourceDepsV1['readSourceInheritance']
  /** The separate inherited v2 producer consumes this actual owner reader;
   * own-root v1 still refuses children and never relabels a parent proof. */
  readInheritedPromptTemplateSource?:PromptTemplateOnlyInheritedReadOwnerV2['read']
}
export interface OpeningIntentV6 extends OpeningIntentIdentity {
  readonly schemaVersion:6
  readonly mode:'prompt-template-only'
  readonly status:'pending'|'busy'|'unknown'|'blocked'|'native-committed'|'completed'
  readonly textRetained:true
  readonly promptTemplateSourceProof:PromptTemplateOnlySourceProofV1
  readonly nativeReceipt?:MvuNativeOpeningReceipt
  readonly initializationCode?:OpeningInitializationCode
  readonly rejectionCode?:OpeningRejectionCode
}
export type PromptTemplateOnlyPreflightDecisionV1={readonly kind:'not-applicable'}
  |{readonly kind:'ready';readonly proof:PromptTemplateOnlySourceProofV1}
  |{readonly kind:'blocked';readonly proof:PromptTemplateOnlySourceProofV1;readonly code:PromptTemplateOnlyCodeV1}
export interface PromptTemplateOnlySelectionCallbacksV1 {
  /** Invoked outside Source FIFO. The actual Source producer may acquire its
   * own synchronous capture lock before and after Runtime waits. */
  preflightPromptTemplateOpening(request:MvuSourceRequest):Promise<PromptTemplateOnlyPreflightDecisionV1>
  preflightPromptTemplateRuntime(proof:PromptTemplateOnlySourceProofV1):Promise<void>
  isPromptTemplateOnlySourceCurrent(proof:PromptTemplateOnlySourceProofV1):boolean
  isPromptTemplateRuntimeCurrent(proof:PromptTemplateOnlySourceProofV1):boolean
}
export interface PromptTemplateOnlyDomainRefV1 {
  readonly kind:'prompt-template-only-domain'
  readonly sha256:string
}
export interface PromptTemplateOnlyScopeFactsV1 {
  readonly schemaVersion:1
  readonly encoding:'native-prompt-template-only-scope-facts-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly sourceIdentity:OpeningCatalog['source']
  readonly domainRef:PromptTemplateOnlyDomainRefV1
  readonly sourceProof:PromptTemplateOnlySourceProofV1
  readonly nativeOpening:MvuNativeOpeningReceipt
  readonly inventory:PromptTemplateOnlyScopeInventoryV1
  readonly variables: {readonly global:'readonly-absent';readonly chat:'readonly-absent';readonly card:'readonly-absent';
    readonly script:'unavailable-no-executing-script';readonly messages:'readonly-uninitialized-selected-cut'}
  readonly factsSha256:string
}

/** Concrete private service seam for the inherited domain version. These
 * are frozen facts supplied by actual Source/Native inheritance owners. Data
 * alone does not authorize a child, and own-root v1 never admits this packet. */
export interface PromptTemplateOnlyInheritedSourceInputV2 {
  readonly schemaVersion:2
  readonly encoding:'native-prompt-template-only-inherited-source-input-v2'
  readonly authority:'consumer-data-only'
  readonly childSessionId:string
  readonly parentSessionId:string
  readonly sourceInheritance:TavernSourceInheritanceDescriptorV1
  readonly childSource:TavernLoreSourceDataV1
  readonly frozenOpening: {readonly ownerSessionId:string;readonly intent:OpeningIntentV4|OpeningIntentV6;
    readonly intentRef:TavernSourceInheritanceRefV1;readonly nativeReceipt:MvuNativeOpeningReceipt;
    readonly scopeFacts:unknown;readonly scopeFactsRef:TavernSourceInheritanceRefV1;
    readonly scopeFactsRecord:{readonly schemaVersion:1;readonly encoding:'native-tavern-frozen-prompt-scope-record-v1';
      readonly authority:'consumer-data-only';readonly childSessionId:string;readonly parentSessionId:string;
      readonly scopeFacts:unknown;readonly scopeFactsSha256:string;readonly recordSha256:string};
    readonly noNumericalInventory:PromptNonNumericalInventoryV2}
  readonly actualChildCut: {readonly sessionId:string;readonly parentSessionId:string;
    readonly inheritedEventCount:number;readonly cut:TavernSourceNativeCutV1;
    readonly childPrefixSha256:string;readonly openingEventSeq:number;readonly openingEventSha256:string;
    readonly originalMessageVersionSha256:string}
  readonly inputSha256:string
}
/** Complete actual branch/status membership is classified independently of
 * the selected opening. Neither a Plain proof nor an empty frame replaces it. */
export interface PromptNonNumericalInventoryV2 {
  readonly schemaVersion:2
  readonly encoding:'native-prompt-nonnumerical-inventory-v2'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly parentSessionId:string|null
  readonly inheritedEventCount:number
  readonly numericalRows:readonly []
  readonly opaqueRows:readonly []
  readonly statusRows:readonly MvuSourceRowRef[]
  readonly branchMembershipSha256:string
  readonly statusMembershipSha256:string
  readonly inventorySha256:string
}
export interface PromptInheritedSourceProofV2 {
  readonly schemaVersion:2
  readonly encoding:'native-prompt-inherited-source-proof-v2'
  readonly authority:'consumer-data-only'
  readonly mode:'plain'|'prompt-template-only'
  readonly sessionId:string
  readonly parentSessionId:string
  readonly input:PromptTemplateOnlyInheritedSourceInputV2
  readonly childSourceBindingSha256:string
  readonly hashEncoding:'native-prompt-inherited-stable-source-projection-v2'
  readonly childInventory:PromptNonNumericalInventoryV2
  readonly templateFields:readonly PromptTemplateOnlyFieldOriginV1[]
  readonly requiredPromptRuntime:PromptTemplateOnlyRequiredRuntimeV1|null
  readonly proofSha256:string
}
export interface PromptInheritedScopeFactsV2 {
  readonly schemaVersion:2
  readonly encoding:'native-prompt-inherited-scope-facts-v2'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly mode:'plain'|'prompt-template-only'
  readonly domainRef:{readonly kind:'inherited-prompt-domain';readonly sha256:string}
  readonly sourceProof:PromptInheritedSourceProofV2
  readonly nativeOpening:MvuNativeOpeningReceipt
  readonly inventory:PromptNonNumericalInventoryV2
  readonly variables:PromptTemplateOnlyScopeFactsV1['variables']
  readonly factsSha256:string
}
export interface PromptTemplateOnlyInheritedReadOwnerV2 {
  /** Actual frozen Source, exact child Native prefix and immutable parent
   * opening/absence inventory. Do not consult today's ancestor rows or head. */
  read(sessionId:string):{readonly kind:'ready';readonly data:PromptTemplateOnlyInheritedSourceInputV2;
    readonly current:()=>boolean}|{readonly kind:'unavailable';readonly missingEvidence:readonly string[]}
}
