import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuNumericalSnapshot, MvuStateRoot} from './roleplay-mvu-state.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaStoryRoot} from './roleplay-mvu-schema-story-types.js'
import type {MvuAcceptedDisplayUpdate} from './roleplay-mvu-display-facts.js'
import type {CombinedPlanRowV4} from './tavern-author-combined-types.mjs'
import type {MvuSchemaPhase} from './tavern-mvu-schema-types.js'
import type {MvuSchemaDiagnosticV4} from './tavern-mvu-schema-types-v4.js'

export type MvuDiscardedCommandObservation = {
  source:'opening'|'story'
  nativeSeq:number
} & ({
  commandIndex:number
  code:'SCHEMA_VALIDATION_FAILED'|'SCHEMA_UPDATE_OPERATION_REJECTED'
  pointer?:string
} | ({kind:'batch-refusal';phase:MvuSchemaPhase} & MvuSchemaDiagnosticV4))

/** A display hint is not permission. The writer rechecks the active Native
 * owner, Source, root and every base hash under its own mutation boundary. */
export type MvuStateObservation = {
  schemaVersion: 1
  sessionId: string
  observedNativeSeq: number
} & (
  | {kind: 'ready'; snapshot: MvuNumericalSnapshot; canEdit: boolean; editBlockCode?: string;
    displayUpdates?:readonly MvuAcceptedDisplayUpdate[]}
  | {kind:'schema-ready';values:MvuJsonObject;valuesSha256:string;sourceSha256:string;eventId:string;
    hasFinalizedMessages?:boolean;
    snapshot:MvuSchemaNumericalSnapshotV2;canEdit:boolean;editBlockCode?:string;
    displayUpdates?:readonly MvuAcceptedDisplayUpdate[];
    unavailableExternalAddons?:readonly Extract<CombinedPlanRowV4,{disposition:'external-addon-unavailable'}>[];
    commandDiagnostics?:readonly MvuDiscardedCommandObservation[]}
  | {kind: 'blocked' | 'unknown'; code: string; canEdit: false}
)

export interface MvuPlayerEditExpected {
  sourceSha256: string
  root: MvuStateRoot|MvuSchemaStoryRoot
  revision: number
  headSha256: string
  valuesSha256: string
  stateSnapshotSha256: string
  observedNativeSeq: number
}

/** The numerical owner names the exact message carrying its current values.
 * This DATA is a target address; admission still requires the current CAS. */
export interface MvuMessageTargetV1 {
  readonly kind:'message'
  readonly ownerSessionId:string
  readonly nativeSeq:number
  readonly messageId:string
  readonly messageVersionSha256:string
}

export interface MvuPlayerEditRequest {
  schemaVersion: 1
  sessionId: string
  operationId: string
  action: 'replace-values'
  expected: MvuPlayerEditExpected
  values: MvuJsonObject
  target?: MvuMessageTargetV1
}

export interface MvuPlayerEditResponse {
  ok: boolean
  numericalState?: MvuStateObservation
  operation?: {
    operationId: string
    payloadSha256: string
    outcome: 'updated' | 'no-update' | 'refused' | 'unknown'
    replayed: boolean
    refusalCode?:string
  }
  code?: string
  error?: string
}
