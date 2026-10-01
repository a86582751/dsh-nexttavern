import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuNumericalSnapshot, MvuStateRoot} from './roleplay-mvu-state.js'

/** A display hint is not permission. The writer rechecks the active Native
 * owner, Source, root and every base hash under its own mutation boundary. */
export type MvuStateObservation = {
  schemaVersion: 1
  sessionId: string
  observedNativeSeq: number
} & (
  | {kind: 'ready'; snapshot: MvuNumericalSnapshot; canEdit: boolean; editBlockCode?: string}
  | {kind:'schema-ready';values:MvuJsonObject;valuesSha256:string;sourceSha256:string;eventId:string;
    canEdit:false;editBlockCode:'SCHEMA_MANUAL_NOT_ENABLED'}
  | {kind: 'blocked' | 'unknown'; code: string; canEdit: false}
)

export interface MvuPlayerEditExpected {
  sourceSha256: string
  root: MvuStateRoot
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
    outcome: 'updated' | 'no-update' | 'unknown'
    replayed: boolean
  }
  code?: string
  error?: string
}
