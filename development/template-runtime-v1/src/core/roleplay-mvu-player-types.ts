import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuNumericalSnapshot, MvuStateRoot} from './roleplay-mvu-state.js'
import type {MvuSchemaNumericalSnapshotV2,MvuSchemaStoryRoot} from './roleplay-mvu-schema-story-types.js'
import type {MvuAcceptedDisplayUpdate} from './roleplay-mvu-display-facts.js'

export interface MvuDiscardedCommandObservation {
  source:'opening'|'story'
  nativeSeq:number
  commandIndex:number
  code:'SCHEMA_VALIDATION_FAILED'|'SCHEMA_UPDATE_OPERATION_REJECTED'
  pointer?:string
}

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
    snapshot:MvuSchemaNumericalSnapshotV2;canEdit:boolean;editBlockCode?:string;
    displayUpdates?:readonly MvuAcceptedDisplayUpdate[];
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

export interface MvuPlayerEditRequest {
  schemaVersion: 1
  sessionId: string
  operationId: string
  action: 'replace-values'
  expected: MvuPlayerEditExpected
  values: MvuJsonObject
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
