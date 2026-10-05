import type {MvuSourceDeps, MvuSourceRowRef} from './roleplay-mvu-source.js'
import type {ImportPointer} from './roleplay-import-types.js'
import type {TavernOpeningContext} from './tavern-card.js'
import type {LegacyContributionDataRequestV1, LegacyRawEntryDataRefV1,
  LegacyRowRefDataV1} from './roleplay-tavern-lore-contributions.js'
import type {TavernLoreBookAbsenceProofV1} from './tavern-lore-plan-types.mjs'
import type {TavernSourceInheritanceDescriptorV1,TavernSourceInheritanceReadV1} from './roleplay-tavern-source-inheritance-types.js'

/** Core supplies its actual synchronous tables under the existing import lock.
 * No Helper/opening producer, Native lease or user-selected source reader is used. */
export type TavernLoreSourceDepsV1 = Pick<MvuSourceDeps,
  'readActivePointer' | 'readImportRecord' | 'readRow' | 'recordVersionsFor' | 'readOpeningContext'> & {
    readonly readSourceInheritance?:(sessionId:string)=>TavernSourceInheritanceReadV1
  }
export type TavernLoreContributionInputV1 = Omit<LegacyContributionDataRequestV1,
  'suppressRawEntryPointers' | 'suppressAlwaysOnRowKeys'>

export interface TavernLoreSourceRowDataV1 {
  readonly ref: Readonly<MvuSourceRowRef>
  /** null represents an absent row only; exists is the actual table fact. */
  readonly value: Readonly<Record<string, unknown>> | null
}
export interface TavernLoreRawEntryDataV1 {
  readonly ref: LegacyRawEntryDataRefV1
  /** Object keys stay distinct from the legacy projection's ordinal. */
  readonly entryKey: string
  readonly value: Readonly<Record<string, unknown>>
}
export type TavernLoreSourcePrimaryV1 = {
  readonly binding:'primary'
  readonly bookPointer:'/data/character_book'
  readonly bookSha256:string
  readonly value:Readonly<Record<string,unknown>>
  readonly entries:readonly TavernLoreRawEntryDataV1[]
} | {
  readonly binding:'proven-absence'
  readonly bookPointer:'/data/character_book'
  /** recordSha256(null), not a hash of an invented {entries: []}. */
  readonly bookSha256:string
  readonly value:null
  readonly entries:readonly []
  readonly absenceProof:TavernLoreBookAbsenceProofV1
}
export interface TavernLoreSourceDataV1 {
  readonly schemaVersion: 1
  readonly encoding: 'tavern-lore-current-source-data-v1'
  readonly authority: 'consumer-data-only'
  readonly sessionId: string
  readonly sourceRecordSessionId: string
  readonly normalizer: 'tavern-fields-v1' | 'tavern-fields-v2' | 'nexttavern-fields-v1'
  readonly inheritance?:TavernSourceInheritanceDescriptorV1
  readonly original: {
    readonly activePointer: Readonly<ImportPointer>
    readonly activePointerRef: LegacyRowRefDataV1
    readonly importRecordRef: LegacyRowRefDataV1
    readonly rawSha256: string
    readonly normalizedSha256: string
    readonly coverageSha256: string
    readonly transactionId: string
    readonly decodedFormat: 'json-v2' | 'json-v3' | 'png-v2' | 'png-v3' | 'json-nexttavern-v1'
    readonly documentSha256: string
    readonly dataSha256: string
    /** Determined from the fresh decoder's alias before any generic clone. */
    readonly documentDataRootPointer: '/data'
    readonly primary:TavernLoreSourcePrimaryV1
  }
  readonly current: {
    readonly rows: readonly TavernLoreSourceRowDataV1[]
    readonly materialSha256: string
    readonly cards: Readonly<Record<string, string>>
    readonly worldbook: Readonly<Record<string, string>>
    readonly rules: string
    readonly settings: string
    /** Includes the complete cards/worldbook membership and both fixed versions. */
    readonly membershipSha256: string
    readonly openingContext: {
      readonly context: TavernOpeningContext
      readonly bindingSha256: string
      readonly valuesSha256: string
    }
  }
  readonly sourceSha256: string
}

export type TavernLoreSourceFailureCodeV1 = 'REQUEST_INVALID' | 'SOURCE_READ_FAILED'
  | 'DATA_INVALID' | 'SOURCE_BUDGET' | 'ACTIVE_POINTER_INVALID' | 'ACTIVE_POINTER_REF_CHANGED'
  | 'IMPORT_RECORD_INVALID' | 'IMPORT_RECORD_REF_CHANGED' | 'ACTIVATION_INVALID'
  | 'COVERAGE_INVALID' | 'ASSIGNMENT_INVALID' | 'MEMBERSHIP_INVALID' | 'ROW_INVALID'
  | 'BRANCH_UNAVAILABLE' | 'RULES_UNAVAILABLE' | 'OPENING_CONTEXT_INVALID'
export type TavernLoreSourceOutsideCodeV1 = 'ACTIVE_SOURCE_MISSING' | 'LEGACY_SOURCE_OUTSIDE_DOMAIN'
  | 'STRUCTURED_VERSION_OUTSIDE_DOMAIN' | 'INHERITED_SOURCE_EVIDENCE_MISSING'
  | 'MERGE_PROVENANCE_UNPROVEN' | 'PRIMARY_BOOK_MISSING'
export interface TavernLoreSourceDiagnosticV1 {
  readonly code: TavernLoreSourceFailureCodeV1
  readonly pointer: string
  readonly limit?: {readonly field: string; readonly maximum: number; readonly observed?: number}
}
export type TavernLoreSourceCaptureV1 =
  | {readonly schemaVersion: 1; readonly kind: 'captured-data'; readonly source: TavernLoreSourceDataV1;
      readonly currentIdentitySha256: string;
      readonly contributionInput: TavernLoreContributionInputV1}
  | {readonly schemaVersion: 1; readonly kind: 'outside-declared-domain';
      readonly code: TavernLoreSourceOutsideCodeV1; readonly pointer: string;
      readonly missingEvidence: readonly string[]; readonly authority: 'none'}
  | {readonly schemaVersion: 1; readonly kind: 'refused';
      readonly diagnostics: readonly TavernLoreSourceDiagnosticV1[]; readonly authority: 'none'}
