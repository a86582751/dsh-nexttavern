import type {MessageEditOperationV1} from 'dsh-nexttavern-session-format'
export type {ReaderMessageEditOriginV1} from 'dsh-nexttavern-session-format'

export interface AuthorMessageEditExpectedV1 {
  readonly sessionId:string
  readonly seq:number
  readonly messageId:string
  readonly role:'assistant'|'user'
  readonly messageVersionSha256:string
}
/** The parent preserves its actual read target before dispatch. The server
 * joins it to retained DATA; the author never supplies Native coordinates. */
export interface AuthorMessageBodyRequestV1 {
  readonly schemaVersion:1
  readonly operationId:string
  readonly readRevision:number
  readonly expected:AuthorMessageEditExpectedV1
  readonly text:string
  readonly refresh:'none'|'affected'|'all'
}
/** One server admission for the fixed browser request; target identity is
 * joined to retained DATA by the caller and rechecked by the Native editor. */
export function authorMessageBodyRequestValid(request:AuthorMessageBodyRequestV1):boolean {
  return request?.schemaVersion===1&&typeof request.operationId==='string'
    &&/^[A-Za-z0-9_-]{1,128}$/.test(request.operationId)&&typeof request.text==='string'
    &&!!request.text.trim()&&request.text.length<=1_000_000
    &&['none','affected','all'].includes(request.refresh)&&!!request.expected
}
export interface AuthorMessageEditInputV1 {
  readonly schemaVersion:1
  readonly operationId:string
  readonly expected:AuthorMessageEditExpectedV1
  readonly origin:MessageEditOperationV1['origin']
  readonly text:string
}
export interface AuthorMessageEditRefV1 {readonly seq:number;readonly sha256:string}
export interface AuthorMessageEditReceiptRefV1 {readonly key:string;readonly sha256:string}
export type AuthorMessageEditResultV1={
  readonly operationId:string
  readonly kind:'committed'
  readonly edit:AuthorMessageEditRefV1
  readonly effects:AuthorMessageEditReceiptRefV1
  readonly replayed:boolean
  readonly superseded:boolean
} | {
  /** An unchanged write has no historical operation or new Native event. */
  readonly operationId:string
  readonly kind:'unchanged'
} | {
  readonly operationId:string
  readonly kind:'refused'|'unknown'
  readonly code:string
  readonly edit?:AuthorMessageEditRefV1
}
