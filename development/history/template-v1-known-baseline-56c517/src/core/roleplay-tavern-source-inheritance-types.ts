import type {ForkOperation} from './roleplay-worldline-types.js'
import type {ForkReservation} from './roleplay-branch-routes-types.js'
import type {ImportPointer} from './roleplay-import-types.js'
import type {TavernOpeningContext} from './tavern-card.js'
import type {RoleplayInputSourceCaptureV1} from './roleplay-input-source-data.js'
import type {TavernLoreSourceCaptureV1,TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreBookAbsenceProofV1,TavernLoreCurrentNativeOverlayV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreEditIdentityV1,TavernLoreEditHeadV1,TavernLoreEditEventV1,
  TavernLoreEditRefV1,TavernLoreEditHeadRefV1} from './roleplay-tavern-lore-edits-types.js'
import type {LoreEditJournalV1} from './roleplay-tavern-lore-edits-journal.js'
import type {PromptTemplateOnlyInheritedSourceInputV2} from './roleplay-prompt-template-only-types.js'
import type {ProgramAbsenceOpeningClosureV1} from './roleplay-program-absence-inheritance-data.js'
import type {ProgramAbsenceInventoryV1} from './roleplay-program-absence-inventory.js'
import type {AuthorChatForkSeedV1,AuthorChatRefV1} from './roleplay-author-chat-state-types.js'

export type TavernSourceStaticTableV1='cards'|'worldbook'|'rules'|'opening'|'status'|'branch'
export interface TavernSourceInheritanceTableV1 {
  get(key:string):unknown
  entries():Iterable<[string,unknown]>
  put(key:string,value:object):PromiseLike<unknown>
}
export interface TavernSourceInheritanceRefV1 {readonly key:string;readonly sha256:string}
export interface TavernSourceStaticRowV1 {
  readonly table:TavernSourceStaticTableV1
  readonly key:string
  readonly exists:boolean
  readonly sha256:string|'missing'
  readonly value:Readonly<Record<string,unknown>>|null
}
export interface TavernSourceStaticWriteV1 {
  readonly table:TavernSourceStaticTableV1
  readonly parentKey:string
  readonly childKey:string
  readonly prior:TavernSourceStaticRowV1
  readonly next:TavernSourceStaticRowV1
  readonly policy:'exact-static-copy'|'parent-settings-then-explicit-child-fields'
}
/** Actual inputs for Root's sole observation-v1 body constructor. No inferred
 * numeric SHA, stripped fieldProof, latest numerical head or lore journal. */
export interface TavernSourceNumericalCaptureV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-numerical-source-capture-v1'
  readonly inputSource:RoleplayInputSourceCaptureV1
  readonly sessionId:string
  readonly pointer:Readonly<ImportPointer>
  readonly importIdentity:{readonly importId:string;readonly rawSha256:string;readonly normalizedSha256:string;
    readonly fieldProof?:unknown;readonly activation:unknown}
  readonly recordVersions:{readonly cards:Readonly<Record<string,string>>;readonly worldbook:Readonly<Record<string,string>>;
    readonly rules:string;readonly settings:string}
  readonly statusSpec:TavernSourceStaticRowV1
  readonly openingScene:TavernSourceStaticRowV1
  readonly openingContext:{readonly context:TavernOpeningContext;readonly bindingSha256:string}
  readonly staticRows:readonly TavernSourceStaticRowV1[]
  readonly captureSha256:string
}
/** Supplied only by Core's actual live/retained Native Session lookup. This
 * reference is never accepted in an operation body or deserialized from a row. */
export interface TavernSourceNativeSessionV1 {
  readonly id:string
  readonly header:{readonly id?:unknown;readonly parentSession?:unknown;readonly isSeeded?:unknown}
  readonly inheritedEventCount:unknown
  snapshotEvents():readonly {readonly seq:number;readonly type:string;readonly data?:unknown}[]
}
export type TavernSourceNativeCutV1={
  readonly kind:'native-fork'
  readonly seedLength:number
  readonly parentInheritedEventCount:number
  readonly prefixEncoding:'record-sha256-native-events-prefix-v1'
  readonly prefixSha256:string
} | {
  readonly kind:'reserved-fresh-branch'
  readonly seedLength:0
  readonly parentInheritedEventCount:number
  readonly prefixEncoding:'record-sha256-native-events-prefix-v1'
  readonly prefixSha256:string
}
export interface TavernSourceOriginalBindingV1 {
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly rawSha256:string
  readonly normalizedSha256:string
  readonly coverageSha256:string
  readonly transactionId:string
  readonly normalizer:'tavern-fields-v1'|'tavern-fields-v2'|'nexttavern-fields-v1'
  readonly documentSha256:string
  readonly dataSha256:string
  readonly importRecordRef:TavernSourceInheritanceRefV1
  readonly activationSha256:string
  /** Historical original pointer; never reread the ancestor's current head. */
  readonly originalPointer:Readonly<ImportPointer>
  readonly originalPointerRef:{readonly table:'branch';readonly key:string;readonly exists:true;readonly sha256:string}
}
export interface TavernSourceMaterialPublicationV1 {
  readonly ownerSessionId:string
  readonly nativeSeq:number
  readonly nativeEventSha256:string
  readonly snapshotRef:TavernSourceInheritanceRefV1
  readonly planRef:TavernSourceInheritanceRefV1
  readonly nativeRecordSha256:string
}
export interface TavernSourceFrozenPromptScopeRecordV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-frozen-prompt-scope-record-v1'
  readonly authority:'consumer-data-only'
  readonly childSessionId:string
  readonly parentSessionId:string
  readonly scopeFacts:unknown
  readonly scopeFactsSha256:string
  readonly recordSha256:string
}
export interface TavernSourceFrozenOpeningEventSpanV1 {
  readonly turnStartSeq:number
  readonly assistantSeq:number
  readonly turnEndSeq:number
  readonly turnStartSha256:string
  readonly assistantSha256:string
  readonly turnEndSha256:string
}
export type TavernSourceFrozenNonNumericalOpeningV1 = {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-nonnumerical-opening-v1'
  readonly kind:'plain'|'prompt-template-only'
  readonly frozenOpening:PromptTemplateOnlyInheritedSourceInputV2['frozenOpening'] & {
    readonly scopeFactsRecord:TavernSourceFrozenPromptScopeRecordV1
  }
  readonly openingEventSpan:TavernSourceFrozenOpeningEventSpanV1
  readonly frozenSha256:string
} | {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-nonnumerical-opening-v1'
  readonly kind:'not-inherited'
  readonly reason:'fresh-cut-zero'
  readonly frozenSha256:string
}
/** Core captures actual facts. Source adds a genuinely persisted envelope ref;
 * a naked facts checksum cannot stand in for that persisted row. */
type TavernSourceFrozenInheritedOpeningV1=Exclude<TavernSourceFrozenNonNumericalOpeningV1,{kind:'not-inherited'}>
export type TavernSourceFrozenNonNumericalOpeningCaptureV1 =
  Omit<TavernSourceFrozenInheritedOpeningV1,'frozenSha256'|'frozenOpening'> & {
    readonly frozenOpening:Omit<TavernSourceFrozenInheritedOpeningV1['frozenOpening'],'scopeFactsRef'|'scopeFactsRecord'>
  } | Omit<Extract<TavernSourceFrozenNonNumericalOpeningV1,{kind:'not-inherited'}>,'frozenSha256'>
/** This child-addressed archive owns storage provenance only. Original closure
 * records keep their original owner and never refer back to prepared. */
export interface TavernSourceProgramAbsenceOpeningRecordV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-program-absence-opening-record-v1'
  readonly authority:'consumer-data-only'
  readonly childSessionId:string
  readonly parentSessionId:string
  readonly closure:ProgramAbsenceOpeningClosureV1
  readonly closureSha256:string
  readonly recordSha256:string
}
export type TavernSourceFrozenProgramAbsenceOpeningV1 = {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-program-absence-opening-v1'
  readonly kind:'not-inherited'
  readonly reason:'fresh-cut-zero'
  readonly frozenSha256:string
} | {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-program-absence-opening-v1'
  readonly kind:'program-absence'
  readonly record:TavernSourceProgramAbsenceOpeningRecordV1
  readonly recordRef:TavernSourceInheritanceRefV1
  readonly frozenSha256:string
}
export interface TavernSourcePublishedEditLayerV1 {
  readonly ownerSessionId:string
  readonly sourceSha256:string
  readonly identity:TavernLoreEditIdentityV1
  readonly identitySha256:string
  readonly head:TavernLoreEditHeadV1
  readonly headRef:TavernLoreEditHeadRefV1
  readonly journalRefs:readonly TavernLoreEditRefV1[]
  readonly journalSha256:string
  readonly events:readonly {readonly ref:TavernLoreEditRefV1;readonly value:TavernLoreEditEventV1}[]
  readonly overlay:TavernLoreCurrentNativeOverlayV1
  readonly layerSha256:string
}
export interface TavernSourceInheritanceLayerRefV1 {
  readonly childSessionId:string
  readonly parentSessionId:string
  readonly operationId:string
  readonly nativeCut:TavernSourceNativeCutV1
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly applyIntentRef:TavernSourceInheritanceRefV1
  readonly commitRef:TavernSourceInheritanceRefV1
  readonly readyRef:TavernSourceInheritanceRefV1
}
/** Source consumer data only. Own-source packets omit this field entirely. */
export interface TavernSourceInheritanceDescriptorV1 extends TavernSourceInheritanceLayerRefV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-inheritance-data-v1'
  readonly authority:'consumer-data-only'
  readonly anchorSha256:string
  readonly parentSourceSha256:string
  readonly parentInventorySha256:string
  readonly originalBinding:TavernSourceOriginalBindingV1
  readonly childPointerAtCommitSha256:string
  readonly editBaselineRef:TavernSourceInheritanceRefV1
  readonly editBaselineSlotRef:TavernSourceInheritanceRefV1
  readonly materialBaselineRef:TavernSourceInheritanceRefV1
  readonly ancestors:readonly TavernSourceInheritanceLayerRefV1[]
  readonly inheritanceSha256:string
}
export interface TavernSourceEditBaselineV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-edit-baseline-v1'
  readonly childSessionId:string
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly layers:readonly TavernSourcePublishedEditLayerV1[]
  readonly effectiveOverlay:TavernLoreCurrentNativeOverlayV1
  readonly baselineSha256:string
}
export interface TavernSourceEditBaselineSlotV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-edit-baseline-slot-v1'
  readonly identity:TavernLoreEditIdentityV1
  readonly identitySha256:string
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly baselineRef:TavernSourceInheritanceRefV1
  readonly slotSha256:string
}
export interface TavernSourceMaterialBaselineV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-material-baseline-v1'
  readonly childSessionId:string
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly nativeCut:TavernSourceNativeCutV1
  readonly publications:readonly TavernSourceMaterialPublicationV1[]
  readonly baselineSha256:string
}
export interface TavernSourcePreparedV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-inheritance-prepared-v1'
  readonly origin:'core-reservation'
  readonly operationId:string
  readonly operationKey:string
  readonly anchorSha256:string
  readonly parentSessionId:string
  readonly childSessionId:string
  readonly nativeCut:TavernSourceNativeCutV1
  readonly parentSource:TavernLoreSourceDataV1
  readonly parentNumericalSource:TavernSourceNumericalCaptureV1
  readonly originalBinding:TavernSourceOriginalBindingV1
  readonly originalAbsenceProof:TavernLoreBookAbsenceProofV1|null
  readonly parentInventory:readonly TavernSourceStaticRowV1[]
  readonly parentInventorySha256:string
  readonly childPointer:Readonly<ImportPointer>&{readonly inheritedFrom:string;readonly sourceRecordSessionId:string}
  readonly editLayers:readonly TavernSourcePublishedEditLayerV1[]
  readonly materialPublications:readonly TavernSourceMaterialPublicationV1[]
  readonly frozenNonNumericalOpeningV1?:TavernSourceFrozenNonNumericalOpeningV1
  readonly frozenProgramAbsenceOpeningV1?:TavernSourceFrozenProgramAbsenceOpeningV1
  readonly frozenAuthorChatSeedV1?:AuthorChatForkSeedV1
  readonly ancestors:readonly TavernSourceInheritanceLayerRefV1[]
  readonly preparedSha256:string
}
export interface TavernSourceApplyIntentV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-inheritance-apply-intent-v1'
  readonly childSessionId:string
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly createdAt:number
  readonly nativeSetup:{readonly eventCount:number;readonly prefixSha256:string}|null
  readonly priorMeta:TavernSourceStaticRowV1
  readonly priorPointer:TavernSourceStaticRowV1
  readonly writes:readonly TavernSourceStaticWriteV1[]
  readonly childInventorySha256:string
  readonly applyIntentSha256:string
}
export interface TavernSourceCommitV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-inheritance-commit-v1'
  readonly childSessionId:string
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly applyIntentRef:TavernSourceInheritanceRefV1
  readonly editBaselineRef:TavernSourceInheritanceRefV1
  readonly editBaselineSlotRef:TavernSourceInheritanceRefV1
  readonly materialBaselineRef:TavernSourceInheritanceRefV1
  readonly childInventorySha256:string
  readonly childPointerSha256:string
  readonly childNumericalSource:TavernSourceNumericalCaptureV1
  readonly commitSha256:string
}
export interface TavernSourceReadyV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-inheritance-ready-v1'
  readonly childSessionId:string
  readonly binding:{readonly schemaVersion:1;readonly preparedRef:TavernSourceInheritanceRefV1;
    readonly applyIntentRef:TavernSourceInheritanceRefV1;readonly commitRef:TavernSourceInheritanceRefV1}
  readonly priorMeta:TavernSourceStaticRowV1
  readonly metadata:Readonly<Record<string,unknown>>
  readonly readySha256:string
}
export type TavernSourceInheritanceReadyBindingV1 = TavernSourceReadyV1['binding'] & {
  readonly readyRef:TavernSourceInheritanceRefV1
}
/** Minimal numerical-prepare reference. This never grants a Native capability. */
export interface TavernSourceFrozenRefV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-inheritance-frozen-ref-v1'
  readonly childSessionId:string
  readonly parentSessionId:string
  readonly operationId:string
  readonly anchorSha256:string
  readonly seedLength:number
  readonly prefixSha256:string
  readonly parentSourceSha256:string
  readonly parentInventorySha256:string
  readonly originalIdentitySha256:string
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly frozenRefSha256:string
}
export type TavernSourceInheritancePreparationV1={readonly kind:'legacy-unchanged'}
  |{readonly kind:'prepared-data';readonly disposition:'created'|'replayed';readonly frozenRef:TavernSourceFrozenRefV1}
export type TavernSourceInheritanceReadV1={readonly kind:'committed-data';readonly data:TavernSourceInheritanceDescriptorV1;
  readonly originalAbsenceProof:TavernLoreBookAbsenceProofV1|null;
  readonly editBaseline:TavernSourceEditBaselineV1;readonly materialBaseline:TavernSourceMaterialBaselineV1}
  |{readonly kind:'refused';readonly code:TavernSourceInheritanceCodeV1;readonly missingEvidence:readonly string[]}
export type TavernSourceInheritanceCodeV1='SOURCE_INHERITANCE_INVALID'|'SOURCE_INHERITANCE_MISSING'
  |'SOURCE_INHERITANCE_BUDGET'|'SOURCE_INHERITANCE_NATIVE_UNAVAILABLE'|'SOURCE_INHERITANCE_NATIVE_CHANGED'
  |'SOURCE_INHERITANCE_OPERATION_CHANGED'|'SOURCE_INHERITANCE_SOURCE_CHANGED'|'SOURCE_INHERITANCE_ORIGINAL_CHANGED'
  |'SOURCE_INHERITANCE_NUMERICAL_CAPTURE_UNAVAILABLE'
  |'SOURCE_INHERITANCE_OPENING_UNAVAILABLE'|'SOURCE_INHERITANCE_OPENING_INVALID'
  |'SOURCE_INHERITANCE_JOURNAL_PENDING'|'SOURCE_INHERITANCE_JOURNAL_INVALID'|'SOURCE_INHERITANCE_MATERIAL_INVALID'
  |'SOURCE_INHERITANCE_CHILD_CONFLICT'|'SOURCE_INHERITANCE_WRITE_UNCONFIRMED'|'SOURCE_INHERITANCE_NOT_READY'
  |'SOURCE_INHERITANCE_STATIC_OWNER_UNSUPPORTED'|'SOURCE_INHERITANCE_REQUIRES_NEW_SOURCE_ACTIVATION'
export interface TavernSourceInheritanceDepsV1 {
  readonly tables:Readonly<Record<TavernSourceStaticTableV1,TavernSourceInheritanceTableV1>>
  /** Same actual Source FIFO as import/editor. No lock spans parent and child. */
  readonly withSourceLock:<T>(sessionId:string,work:()=>Promise<T>)=>Promise<T>
  readonly readNativeSession:(sessionId:string)=>TavernSourceNativeSessionV1|undefined
  readonly source:{capture(sessionId:string):TavernLoreSourceCaptureV1;current(source:TavernLoreSourceDataV1):boolean}
  readonly readOpeningContext:(sessionId:string)=>{readonly context:TavernOpeningContext;readonly bindingSha256:string}
  /** Root's actual observation-v1 supplier. Missing data is refusal, never a
   * guessed numeric descriptor assembled from the unrelated lore Source SHA. */
  readonly readNumericalSourceCapture?:(sessionId:string)=>RoleplayInputSourceCaptureV1
  readonly readPublishedLocalEditJournal:(source:TavernLoreSourceDataV1)=>LoreEditJournalV1
  /** Actual Native reconstruction and Core material ownership remain in Core. */
  readonly captureMaterialPublications:(sessionId:string,seedLength:number)=>readonly TavernSourceMaterialPublicationV1[]
  readonly assertMaterialPublications:(childSessionId:string,publications:readonly TavernSourceMaterialPublicationV1[])=>void
  readonly captureNonNumericalOpening?:(parentSessionId:string,cut:TavernSourceNativeCutV1)=>
    TavernSourceFrozenNonNumericalOpeningCaptureV1|undefined
  readonly assertNonNumericalOpening?:(childSessionId:string,packet:TavernSourceFrozenNonNumericalOpeningV1,
    cut:TavernSourceNativeCutV1)=>void
  /** Root proves current complete parent namespace, actual Source and complete
   * retained Native prefix. Source only freezes the returned inert closure. */
  readonly captureProgramAbsenceOpening?:(parentSessionId:string,cut:TavernSourceNativeCutV1)=>
    ProgramAbsenceOpeningClosureV1|undefined
  /** Actual child's complete namespace/Native cut and original Source joins.
   * Called within Source's closed read; must not recursively re-enter it. */
  readonly assertProgramAbsenceOpening?:(childSessionId:string,packet:TavernSourceFrozenProgramAbsenceOpeningV1,
    cut:TavernSourceNativeCutV1,sourceRows:TavernSourceOwnedRowFactsV1)=>TavernSourceProgramAbsenceObservationV1|void
  /** State1's binding comes from the compiled Browser2 writer proof. Called
   * once at the actual reservation cut while this owner's parent FIFO holds. */
  readonly captureAuthorChatForkSeed?:(parentSessionId:string,childSessionId:string,
    operationId:string,cut:TavernSourceNativeCutV1,source:TavernLoreSourceDataV1)=>AuthorChatForkSeedV1|undefined
  /** Called inside reserved child apply before Source commit. Root supplies
   * the actual prepared-ref owner; the seed alone cannot authorize a write. */
  readonly applyAuthorChatForkSeed?:(seed:AuthorChatForkSeedV1,preparedRef:AuthorChatRefV1,
    prepared:TavernSourcePreparedV1,sourceCurrent:()=>boolean)=>PromiseLike<unknown>
  /** Called before the parent FIFO, never from an already-locked body. */
  readonly ensureParentBranch:(sessionId:string)=>Promise<void>
}
export interface TavernSourceStaticTransactionV1 {
  readonly prepared:TavernSourcePreparedV1
  readonly applyIntent:TavernSourceApplyIntentV1
  readonly commit:TavernSourceCommitV1
  readonly ready:TavernSourceReadyV1
  readonly inheritance:TavernSourceInheritanceDescriptorV1
  readonly editBaseline:TavernSourceEditBaselineV1
  readonly materialBaseline:TavernSourceMaterialBaselineV1
}
/** DATA produced by the original Native/namespace reader in this closed read.
 * It retains no Source frame, callback or dispatch permission. */
export interface TavernSourceProgramAbsenceObservationV1 {
  readonly closure:ProgramAbsenceOpeningClosureV1
  readonly inventory?:ProgramAbsenceInventoryV1
}
/** Historical inspection/control data. Its Source binding does not prove an
 * original Native writer ACK or authorize any migration/recovery action. */
export interface TavernSourceLegacyMigrationRecordV1 extends Readonly<Record<string,unknown>> {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-legacy-migration-v1'
  readonly childSessionId:string
  readonly evidenceSha256:string
  readonly priorMeta:TavernSourceStaticRowV1
  readonly readyBinding:TavernSourceInheritanceReadyBindingV1
  readonly migrationSha256:string
}
/** Inert observations. Only this factory's active synchronous frame is live
 * evidence; its JSON body, hashes and frozen state confer no permission. */
export interface TavernSourceOwnedRowFactsV1 {
  readonly schemaVersion:1
  readonly encoding:'native-tavern-source-owned-row-facts-v1'
  readonly subjectSessionId:string
  readonly recordSessionId:string
  readonly purpose:'subject'|'lineage-dependency'
  readonly phase:'prepared'|'apply-partial'|'closed-unpublished'|'closed-ready'
  readonly preparedRef:TavernSourceInheritanceRefV1
  readonly validatedRecords:readonly TavernSourceStaticRowV1[]
  readonly missingRecords:readonly TavernSourceStaticRowV1[]
  /** Mutable values are observations and are never owned-record exemptions. */
  readonly observations:readonly TavernSourceStaticRowV1[]
  /** Exact, strictly parsed control bytes associated with this closed Source.
   * These are not whole-row Native writer/publication provenance. */
  readonly associatedControlRecords?:readonly TavernSourceStaticRowV1[]
}
export interface TavernSourceCommittedLineageV1 {
  readonly current:TavernSourceStaticTransactionV1
  readonly ancestors:readonly TavernSourceStaticTransactionV1[]
}
export interface TavernSourceInheritanceOwnerV1 {
  prepareSourceInheritance(operation:ForkOperation,reservation:ForkReservation):Promise<TavernSourceInheritancePreparationV1>
  readPreparedFrozenSourceRef(childSessionId:string):TavernSourceFrozenRefV1
  readPreparedSourceInheritance(childSessionId:string):TavernSourcePreparedV1
  readCommittedStaticSourceInheritance(childSessionId:string):TavernSourceStaticTransactionV1
  readCommittedSourceLineage(childSessionId:string,consume?:(lineage:TavernSourceCommittedLineageV1,
    sourceRows:TavernSourceOwnedRowFactsV1,opening:TavernSourceProgramAbsenceObservationV1|undefined)=>void)
    :TavernSourceCommittedLineageV1
  /** Dependency-only historical read. Optional subject is an actual caller
   * context, never a stored packet flag or mutable ancestor authorization. */
  readFrozenParent(committedRef:TavernSourceInheritanceRefV1,subjectSessionId?:string):TavernSourceNumericalCaptureV1
  assertOwnedRowFactsCurrent(sourceRows:TavernSourceOwnedRowFactsV1):void
  /** Synchronous consumer only; frames expire before this method returns. */
  withOwnedRowFacts<T>(childSessionId:string,consume:(sourceRows:TavernSourceOwnedRowFactsV1,
    transaction:TavernSourceStaticTransactionV1,opening:TavernSourceProgramAbsenceObservationV1|undefined)=>T):T
  assertPreparedParentCurrent(childSessionId:string):void
  applyPreparedSourceInheritance(childSessionId:string):Promise<TavernSourceInheritanceReadyBindingV1|null>
  publishSourceInheritanceReady(childSessionId:string,metadata:Readonly<Record<string,unknown>>):Promise<void>
  readCommittedSourceInheritance(childSessionId:string):TavernSourceInheritanceReadV1
  assertSourceInheritanceReady(childSessionId:string):void
  migrateProvenLegacyInheritance(childSessionId:string,expectedEvidenceSha256:string):Promise<
    {readonly kind:'migrated-data';readonly readyBinding:TavernSourceInheritanceReadyBindingV1}
    |{readonly kind:'requires-new-source-activation'|'conflict';readonly evidenceSha256:string;
      readonly missingEvidence:readonly string[]}>
  inspectLegacySourceInheritance(childSessionId:string):{readonly kind:'provable'|'requires-new-source-activation'|'conflict';
    readonly evidenceSha256:string;readonly missingEvidence:readonly string[]}
}
