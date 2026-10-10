/** Pure consumer data. No type here represents a Source/Native lease, an
 * activated entry, a provider prompt or authority to mutate a database. */
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'
import type {ImportPointer,ImportRecord} from './roleplay-import-types.js'
import type {TavernSourceInheritanceDescriptorV1} from './roleplay-tavern-source-inheritance-types.js'

/** An absence is a fact about one complete verified document and activation,
 * never a synthetic character_book archive or a Source/Native capability. */
export interface TavernLoreBookAbsenceProofV1 {
  readonly schemaVersion:1
  readonly encoding:'st-character-book-proven-absence-data-v1'
  readonly authority:'consumer-data-only'
  readonly ownerSessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly documentDataRootPointer:'/data'
  readonly bookPointer:'/data/character_book'
  readonly decodedFormat:'json-v2'|'json-v3'|'png-v2'|'png-v3'|'json-nexttavern-v1'
  readonly document:MvuJsonObject
  readonly documentSha256:string
  readonly dataSha256:string
  readonly rawSha256:string
  readonly normalizedSha256:string
  readonly coverageSha256:string
  readonly transactionId:string
  readonly activatedAt:number|null
  readonly activePointer:Readonly<ImportPointer>
  readonly activePointerRef:{readonly table:'branch';readonly key:string;readonly exists:true;readonly sha256:string}
  readonly importRecordRef:{readonly table:'branch';readonly key:string;readonly exists:true;readonly sha256:string}
  readonly activation:Readonly<NonNullable<ImportRecord['activation']>>
  readonly absenceProofSha256:string
}
export interface TavernLorePresentSourceReferenceV1 {
  readonly schemaVersion:1
  readonly encoding:'st-character-book-source-reference-v1'
  readonly ownerSessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly rawSourceSha256:string
  readonly importRecordSha256:string
  readonly sourceSnapshotSha256:string
  readonly documentSha256:string
  readonly bookPointer:string
  readonly bookValueSha256:string
  /** The caller supplies both source identity and the format it decoded. */
  readonly sourceFormat:'ccv2-character-book'|'ccv3-character-book'|'nexttavern-character-book'
  readonly inheritance?:TavernSourceInheritanceDescriptorV1
}
export interface TavernLoreAbsentSourceReferenceV1 extends TavernLorePresentSourceReferenceV1 {
  readonly bookPresence:'proven-absence'
  readonly absenceProof:TavernLoreBookAbsenceProofV1
}
export type TavernLoreSourceReferenceV1=TavernLorePresentSourceReferenceV1|TavernLoreAbsentSourceReferenceV1
export interface TavernLoreCompilationInputV1 {
  readonly schemaVersion:1
  readonly encoding:'st-character-book-compilation-input-v1'
  readonly source:TavernLoreSourceReferenceV1
  readonly book:MvuJsonObject|null
  readonly currentNativeOverlay?:TavernLoreCurrentNativeOverlayV1
}
/** The live owner verifies the concrete ref schema against its current row or
 * append-only event/head. A ref and its hash here are consumer data only. */
export interface TavernLoreCurrentNativeOriginV1 {
  readonly kind:'current-row'|'append-only-lore-overlay'
  readonly ref:MvuJsonObject
  readonly refSha256:string
}
export type TavernLoreCurrentNativeFieldsV1=Partial<Omit<TavernLoreSemanticEntryV1,'content'>>
  &{readonly content?:string}
export interface TavernLoreCurrentNativeOverlayEntryV1 {
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly origin:TavernLoreCurrentNativeOriginV1
  /** Presence means an explicit edit; absence preserves original semantics. */
  readonly fields:TavernLoreCurrentNativeFieldsV1
}
export interface TavernLoreCurrentNativeOverlayV1 {
  readonly schemaVersion:1
  readonly encoding:'st-character-book-current-native-overlay-v1'
  readonly entries:readonly TavernLoreCurrentNativeOverlayEntryV1[]
}
export type TavernLorePositionV1='before-character'|'after-character'
  |'before-authors-note'|'after-authors-note'|'at-chat-depth'
  |'before-examples'|'after-examples'|'named-outlet'
export type TavernLoreRoleV1='system'|'user'|'assistant'
export type TavernLoreSelectiveLogicV1='and-any'|'not-all'|'not-any'|'and-all'
export interface TavernLoreContentReferenceV1 {
  readonly kind:'unexecuted-source-text'
  readonly pointer:string
  readonly contentSha256:string
  readonly currentNative?:{
    readonly text:string
    readonly contentSha256:string
    readonly origin:TavernLoreCurrentNativeOriginV1
  }
}
/** Null scan/match controls require the actual frozen runtime setting. They
 * never mean the startup globals from a different ST installation. */
export interface TavernLoreSemanticEntryV1 {
  readonly content:TavernLoreContentReferenceV1
  readonly primaryKeys:readonly string[]
  readonly secondaryKeys:readonly string[]
  readonly enabled:boolean
  readonly constant:boolean
  readonly selective:boolean
  readonly selectiveLogic:TavernLoreSelectiveLogicV1
  readonly keyMatcher:'st-slash-regex-or-literal-v1'
  readonly caseSensitive:boolean|null
  readonly matchWholeWords:boolean|null
  readonly scanDepth:number|null
  readonly position:TavernLorePositionV1
  readonly role:TavernLoreRoleV1
  readonly depth:number
  readonly order:number
  readonly displayIndex:number
  readonly ignoreBudget:boolean
  readonly excludeRecursion:boolean
  readonly preventRecursion:boolean
  readonly delayUntilRecursion:boolean|number
  readonly probability:number
  readonly useProbability:boolean
  readonly group:string
  readonly groupOverride:boolean
  readonly groupWeight:number
  readonly useGroupScoring:boolean|null
  readonly sticky:number|null
  readonly cooldown:number|null
  readonly delay:number|null
  readonly outletName:string
  readonly vectorized:boolean
  readonly automationId:string
  readonly triggers:readonly string[]
  readonly matchPersonaDescription:boolean
  readonly matchCharacterDescription:boolean
  readonly matchCharacterPersonality:boolean
  readonly matchCharacterDepthPrompt:boolean
  readonly matchScenario:boolean
  readonly matchCreatorNotes:boolean
}
export type TavernLoreSemanticFieldV1=keyof TavernLoreSemanticEntryV1
export interface TavernLoreFieldSourceV1 {
  readonly field:TavernLoreSemanticFieldV1|string
  readonly pointer:string
  readonly valueSha256:string
  readonly disposition:'interpreted-input'|'source-metadata'|'known-unapplied-by-profile'|'current-native-origin'
  readonly currentNativeOrigin?:TavernLoreCurrentNativeOriginV1
}
export interface TavernLoreMetadataReferenceV1 {
  readonly pointer:string
  readonly valueSha256:string
  readonly disposition:'source-metadata'|'known-unapplied-by-profile'|'retained-uninterpreted'
}
/** Legacy declarations stay typed and separate from the fixed ST importer
 * semantics. Presence here never turns them into an override or a prompt. */
export interface TavernLoreRetainedDeclarationsV1 {
  readonly primaryKeys?:readonly string[]
  readonly secondaryKeys?:readonly string[]
  readonly disabled?:boolean
  readonly order?:number
  readonly priority?:number
  readonly caseSensitive?:boolean
  readonly useRegex?:boolean
  readonly selectiveLogic?:number
  readonly matchWholeWords?:boolean
  readonly tokenBudget?:number
  readonly role?:string|number
  readonly depth?:number
}
export interface TavernLoreEntryPlanV1 {
  readonly entryId:string
  readonly ordinal:number
  readonly sourceKey:string
  readonly sourcePointer:string
  readonly rawEntrySha256:string
  readonly upstreamUid:{readonly origin:'explicit'|'ordinal-fallback'|'invalid';readonly value:string|number|null}
  readonly disposition:'eligible-semantic-data'|'disabled'|'retained-ineligible'
  /** Missing controls come only from the fixed convertCharacterBook profile.
   * Overrides and fieldSources preserve explicit false/0/null without merging
   * them with absence. The complete original value remains in rawBook. */
  readonly semanticOverrides:Partial<TavernLoreSemanticEntryV1>
  readonly fieldSources:readonly TavernLoreFieldSourceV1[]
  readonly retainedMetadata:readonly TavernLoreMetadataReferenceV1[]
  readonly retainedDeclarations:TavernLoreRetainedDeclarationsV1
  readonly diagnosticIndexes:readonly number[]
  readonly entryPlanSha256:string
}
export interface TavernLoreDiagnosticV1 {
  readonly schemaVersion:1
  readonly encoding:'st-character-book-compiler-diagnostic-v1'
  readonly code:string
  readonly pointer:string
  readonly entryOrdinal:number|null
  readonly blocking:boolean
  readonly observedType:string|null
  readonly limit:{readonly field:string;readonly observed:number;readonly maximum:number}|null
}
export interface TavernLorePlanV1 {
  readonly schemaVersion:1
  readonly encoding:'st-character-book-semantic-plan-inputs-v1'
  readonly authority:'consumer-data-only'
  readonly compiler:{readonly id:'owned-st-character-book-compiler';readonly version:1;
    readonly upstreamCommit:string;readonly semanticProfileSha256:string;readonly currentNativeOverlayProfileSha256?:string}
  readonly source:TavernLoreSourceReferenceV1
  readonly sourceReferenceSha256:string
  readonly bookId:string
  /** One complete archive, including disabled entries and unknown metadata.
   * Content references never duplicate or execute this text in a prompt. */
  readonly rawBook:MvuJsonObject|null
  readonly rawBookSha256:string
  /** Present only for a real absence. rawBook stays null; no imported object is invented. */
  readonly ownedEmptyPlan?:{readonly origin:'program-owned-empty-from-proven-absence';
    readonly absenceProofSha256:string;readonly bookPointer:'/data/character_book';readonly rawBookValue:null}
  readonly currentNativeOverlay?:TavernLoreCurrentNativeOverlayV1
  readonly currentNativeOverlaySha256?:string
  readonly bookDisposition:'eligible-semantic-data'|'retained-ineligible'
  readonly collection:{readonly kind:'source-array'|'source-object'|'object-retained-unsupported'|'proven-absent-book';readonly count:number}
  readonly bookMetadata:readonly TavernLoreMetadataReferenceV1[]
  readonly declaredBookSettings:{readonly disposition:'not-applied-by-fixed-importer';
    readonly scanDepth?:number;readonly tokenBudget?:number;readonly recursiveScanning?:boolean}
  readonly entries:readonly TavernLoreEntryPlanV1[]
  readonly eligibleEntryIds:readonly string[]
  readonly evaluatorRequirements:readonly string[]
  readonly diagnosticsSha256:string
  readonly planSha256:string
}
export type TavernLoreCompilationV1={readonly kind:'compiled';readonly plan:TavernLorePlanV1;
  readonly diagnostics:readonly TavernLoreDiagnosticV1[]}
  |{readonly kind:'refused';readonly diagnostics:readonly TavernLoreDiagnosticV1[]}

/** Future evaluator input seam only. The real prepare/assemble owner must
 * capture these dependencies and compare Source/revision across its awaits.
 * This compiler neither creates this envelope nor treats it as authority. */
export interface TavernLoreEvaluatorDependenciesV1 {
  readonly schemaVersion:1
  readonly encoding:'st-lore-evaluator-dependencies-v1'
  readonly planSha256:string
  readonly sourceSnapshotSha256:string
  readonly stateSnapshotSha256:string
  readonly messageVersions:readonly {readonly messageId:string;readonly versionSha256:string}[]
  readonly attemptId:string
  readonly revision:number
  readonly frozenSettingsSha256:string
  readonly branchTimedEffectsSha256:string
  readonly deterministicRandomSeedSha256:string
  readonly tokenizerIdentity:string
  readonly templateEvaluatorIdentity:string
}
export type TavernLoreRawValueV1=MvuJsonValue
