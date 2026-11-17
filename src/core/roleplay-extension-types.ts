/** Diagnostic DATA from the owner that observed an extension failure. It does
 * not grant execution, replay or numerical publication permission. */
export interface RoleplayExtensionFailureV1 {
  readonly schemaVersion:1
  readonly sessionId:string
  readonly id:string
  readonly extension:'mvu'|'ruby'|'ejs'|'author-script'|'reader'
  readonly code:string
  readonly phase:string
  readonly sourceRevision:string
  readonly impact:'partial'|'story-paused'
  readonly reason?:string
  readonly sourcePointer?:string
  readonly scriptIdentity?:string
  readonly messageId?:string
  readonly line?:number
  readonly column?:number
  readonly helper?:string
  readonly taskId?:string
}

/** A preview freezes no execution permission. Preparation checks its exact
 * source revision before reserving the one recoverable target Session. */
export interface TextOnlyContinuationPreviewV1 {
  readonly ok:true
  readonly operationId:string
  readonly sourceSessionId:string
  readonly revision:string
  readonly retainedCards:number
  readonly retainedWorldbook:number
  readonly historyMessages:number
  readonly confirmedTurn:number|null
  readonly historyFromSeq:number|null
  readonly historyThroughSeq:number|null
  readonly omittedCount:number
  readonly draftText:string
  readonly attachmentCount:number
}

export interface TextOnlyContinuationResultV1 {
  readonly ok:boolean
  readonly operationId:string
  readonly sourceSessionId:string
  readonly childSessionId:string|null
  readonly status:'prepared'|'ready'
  readonly omittedCount:number
  readonly historyMessages:number
  readonly draftText:string
  readonly attachmentCount:number
  readonly error?:string
}
