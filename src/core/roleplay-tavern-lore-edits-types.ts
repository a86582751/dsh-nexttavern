import type {ImportTable} from './roleplay-import-types.js'
import type {TavernLoreSourceCaptureV1,TavernLoreSourceDataV1,TavernLoreSourceCounterWitnessV1}
  from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreCurrentNativeFieldsV1,TavernLoreCurrentNativeOverlayV1,
  TavernLoreSemanticEntryV1,TavernLoreFieldSourceV1} from './tavern-lore-plan-types.mjs'
import type {TavernSourceInheritanceRefV1} from './roleplay-tavern-source-inheritance-types.js'
import type {TavernLoreMembershipDataV1,TavernLoreMembershipMutationV1,TavernLoreMemberIdentityV1}
  from './roleplay-tavern-lore-membership.js'

/** Actual synchronous Source capture consumed as bounded data. It grants no
 * live currency or execution permission; the surrounding input Owner owns it. */
export type TavernLoreEditSourceDataCaptureV1=Extract<TavernLoreSourceCaptureV1,{kind:'captured-data'}>

/** Actual trusted adapters only. No operation JSON selects a table or reader. */
export interface TavernLoreEditsDepsV1 {
  readonly branch:Pick<ImportTable,'get'|'put'|'entries'>
  readonly source:{capture(sessionId:string):TavernLoreSourceCaptureV1;current(source:TavernLoreSourceDataV1):boolean;
    captureCurrent?:ReturnType<typeof import('./roleplay-tavern-lore-source.js').createRoleplayTavernLoreSourceV1>['captureCurrent']}
  readonly withSourceLock:<T>(sessionId:string,work:()=>T|PromiseLike<T>)=>Promise<T>
}
export interface TavernLoreEditRequestV1 {
  readonly sessionId:string
  readonly expectedSourceSha256:string
  readonly expectedRevision:number
  readonly operationId:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly fields:TavernLoreCurrentNativeFieldsV1
}
/** Versioned member edits use the same source lock, journal head and recovery
 * contract as historical field edits. UID allocation belongs to the caller. */
export interface TavernLoreMutationRequestV2 {
  readonly schemaVersion:2
  readonly encoding:'tavern-lore-mutation-request-v2'
  readonly sessionId:string
  readonly expectedSourceSha256:string
  readonly expectedRevision:number
  readonly operationId:string
  readonly mutation:TavernLoreMembershipMutationV1|{
    kind:'fields';target:TavernLoreMemberIdentityV1;fields:TavernLoreCurrentNativeFieldsV1}
}
export type TavernLoreJournalRequestV2=TavernLoreEditRequestV1|TavernLoreMutationRequestV2
export interface TavernLoreEditIdentityV1 {
  readonly schemaVersion:1
  readonly encoding:'tavern-lore-edit-original-identity-v1'
  readonly sessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly rawSha256:string
  readonly transactionId:string
  readonly documentSha256:string
  readonly bookPointer:string
  readonly bookSha256:string
}
export interface TavernLoreEditRefV1 {readonly key:string;readonly sha256:string}
export interface TavernLoreEditHeadRefV1 {readonly key:string;readonly exists:boolean;readonly sha256:string|'missing'}
export interface TavernLoreEditHeadV1 {
  readonly schemaVersion:1
  readonly encoding:'tavern-lore-edit-head-v1'
  readonly identity:TavernLoreEditIdentityV1
  readonly identitySha256:string
  readonly revision:number
  readonly lastEvent:TavernLoreEditRefV1|null
  readonly chainSha256:string
  readonly headSha256:string
}
/** Immutable intent. A head reference publishes it; no second event-state write. */
export interface TavernLoreEditEventV1 {
  readonly schemaVersion:1
  readonly encoding:'tavern-lore-edit-event-v1'
  readonly state:'prepared'
  readonly identity:TavernLoreEditIdentityV1
  readonly identitySha256:string
  readonly request:TavernLoreEditRequestV1
  readonly payloadSha256:string
  readonly baseHead:TavernLoreEditHeadV1
  readonly baseHeadRowSha256:string|'missing'
  readonly revision:number
  readonly eventSha256:string
}
export interface TavernLoreMutationEventV2 extends Omit<TavernLoreEditEventV1,'schemaVersion'|'encoding'|'request'> {
  readonly schemaVersion:2
  readonly encoding:'tavern-lore-mutation-event-v2'
  readonly request:TavernLoreMutationRequestV2
}
/** New mutations retain their captured counter bytes for exact cold recovery.
 * Request/receipt/head encodings and all historical event bytes remain unchanged. */
export interface TavernLoreMutationEventV3 extends Omit<TavernLoreMutationEventV2,'schemaVersion'|'encoding'> {
  readonly schemaVersion:3
  readonly encoding:'tavern-lore-mutation-event-v3'
  readonly sourceCounters:TavernLoreSourceCounterWitnessV1
}
export type TavernLoreJournalEventV2=TavernLoreEditEventV1|TavernLoreMutationEventV2|TavernLoreMutationEventV3
export interface TavernLoreEditReceiptV1 {
  readonly schemaVersion:1
  readonly encoding:'tavern-lore-edit-receipt-v1'
  readonly authority:'consumer-data-only'
  readonly identitySha256:string
  readonly operationId:string
  readonly payloadSha256:string
  readonly revision:number
  readonly editSourceSha256:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly fieldsSha256:string
  readonly eventRef:TavernLoreEditRefV1
  readonly headRef:TavernLoreEditHeadRefV1
  readonly receiptSha256:string
}
export interface TavernLoreMutationReceiptV2 extends Omit<TavernLoreEditReceiptV1,
  'schemaVersion'|'encoding'|'rawEntryPointer'|'rawEntrySha256'|'fieldsSha256'> {
  readonly schemaVersion:2
  readonly encoding:'tavern-lore-mutation-receipt-v2'
  readonly mutationSha256:string
}
export interface TavernLoreEditsDataV1 {
  readonly schemaVersion:1
  readonly encoding:'tavern-lore-edits-current-data-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly source:TavernLoreSourceDataV1
  readonly identity:TavernLoreEditIdentityV1
  readonly identitySha256:string
  readonly revision:number
  readonly head:TavernLoreEditHeadV1
  readonly headRef:TavernLoreEditHeadRefV1
  readonly journalRefs:readonly TavernLoreEditRefV1[]
  readonly journalSha256:string
  readonly overlay:TavernLoreCurrentNativeOverlayV1
  readonly currentNativeMembership?:TavernLoreMembershipDataV1
  readonly inheritance?:{readonly baselineRef:TavernSourceInheritanceRefV1;
    readonly slotRef:TavernSourceInheritanceRefV1;readonly baselineSha256:string;readonly effectiveOverlaySha256:string}
  readonly dataSha256:string
}
export interface TavernLoreEditEditorEntryV1 {
  readonly entryId:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly disposition:'eligible-semantic-data'|'disabled'|'retained-ineligible'
  readonly semantic:TavernLoreSemanticEntryV1
  readonly contentText:string
  readonly fieldSources:readonly TavernLoreFieldSourceV1[]
  readonly diagnosticCodes:readonly string[]
  readonly currentNativeMember?:{readonly identity:TavernLoreMemberIdentityV1;readonly uid:number;
    readonly displayIndex:number;readonly rawEntrySha256:string}
}
export interface TavernLoreEditEditorDataV1 {
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly dataSha256:string
  readonly revision:number
  readonly entries:readonly TavernLoreEditEditorEntryV1[]
}
export interface TavernLoreEditRecoveryAnchorV1 {
  readonly phase:'intent-write'|'head-publication'|'readback'
  readonly identitySha256:string
  readonly operationId:string
  readonly payloadSha256:string
  readonly eventRef:TavernLoreEditRefV1
  readonly baseHeadRef:TavernLoreEditHeadRefV1
  readonly nextHeadRef:TavernLoreEditHeadRefV1
}
export type TavernLoreEditFailureCodeV1='REQUEST_INVALID'|'REQUEST_DATA_INVALID'|'SOURCE_UNAVAILABLE'|'SOURCE_CHANGED'
  |'SOURCE_IDENTITY_INVALID'|'DATA_BUDGET'|'STORAGE_READ_FAILED'|'JOURNAL_SCHEMA_INVALID'|'JOURNAL_HASH_INVALID'
  |'JOURNAL_IDENTITY_MISMATCH'|'JOURNAL_MISSING_EVENT'|'JOURNAL_CHAIN_INVALID'|'JOURNAL_ORPHAN_CONFLICT'
  |'JOURNAL_LIMIT'|'HEAD_CHANGED'|'PENDING_INTENT'|'OPERATION_PAYLOAD_CONFLICT'|'REVISION_MISMATCH'
  |'ENTRY_LINK_INVALID'|'FIELDS_INVALID'|'WRITE_UNKNOWN'
  |'JOURNAL_INHERITANCE_INVALID'|'RETRY_LOCATOR_REQUIRED'|'OPERATION_NOT_RECORDED'
export interface TavernLoreEditDiagnosticV1 {
  readonly code:TavernLoreEditFailureCodeV1
  readonly detail?:string
  readonly pending?:{readonly operationId:string;readonly payloadSha256:string;readonly eventRef:TavernLoreEditRefV1}
  readonly recovery?:TavernLoreEditRecoveryAnchorV1
}
export interface TavernLoreEditRefusalV1 {
  readonly schemaVersion:1
  readonly kind:'refused'
  readonly authority:'none'
  readonly diagnostics:readonly TavernLoreEditDiagnosticV1[]
}
export type TavernLoreEditObservationV1={readonly schemaVersion:1;readonly kind:'captured-data';
  readonly data:TavernLoreEditsDataV1;readonly editor:TavernLoreEditEditorDataV1}|TavernLoreEditRefusalV1
export type TavernLoreEditJournalObservationV1={readonly schemaVersion:1;readonly kind:'captured-data';
  readonly data:TavernLoreEditsDataV1}|TavernLoreEditRefusalV1
export type TavernLoreEditResultV1={readonly schemaVersion:1;readonly kind:'edited-data';
  readonly receipt:TavernLoreEditReceiptV1;readonly data:TavernLoreEditsDataV1;
  readonly editor:TavernLoreEditEditorDataV1}|TavernLoreEditRefusalV1
export type TavernLoreMutationResultV2={readonly schemaVersion:1;readonly kind:'edited-data';
  readonly receipt:TavernLoreMutationReceiptV2;readonly data:TavernLoreEditsDataV1;
  readonly editor:TavernLoreEditEditorDataV1}|TavernLoreEditRefusalV1
export type TavernLoreJournalResultV2={readonly schemaVersion:1;readonly kind:'edited-data';
  readonly receipt:TavernLoreEditReceiptV1|TavernLoreMutationReceiptV2;readonly data:TavernLoreEditsDataV1;
  readonly editor:TavernLoreEditEditorDataV1}|TavernLoreEditRefusalV1

/** Exact historical address supplied by the actual DATA owner or its receipt.
 * It is not Source currency or execution authority. Only the journal resolves it. */
export type TavernLoreMutationRetryLocatorV1={readonly identitySha256:string}
  |{readonly eventRef:TavernLoreEditRefV1}
/** An explicit historical lookup may return only the durable published receipt.
 * It cannot construct current Source DATA from another active import. */
export type TavernLoreMutationRetryResultV2=TavernLoreMutationResultV2|{
  readonly schemaVersion:1;readonly kind:'edited-data';readonly receipt:TavernLoreMutationReceiptV2}
