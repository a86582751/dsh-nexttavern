/** One compiler-proven chat namespace. These records are DATA; only Core's
 * current operation and actual completed task can authorize a guest write. */
import type {MvuJsonValue} from './tavern-mvu-initvar.js'

export interface AuthorChatBindingV1 {
  readonly sessionId:string
  readonly key:string
  readonly sourceSha256:string
  readonly sourceSnapshotSha256:string
  readonly descriptorSha256:string
}
export interface AuthorChatRefV1 {readonly key:string;readonly sha256:string}
export interface AuthorChatRevisionV1 {
  readonly revision:number
  readonly head:AuthorChatRefV1|null
}
export interface AuthorChatCaptureV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-chat-capture-v1'
  readonly authority:'consumer-data-only'
  readonly binding:AuthorChatBindingV1
  readonly revision:AuthorChatRevisionV1
  readonly exists:boolean
  readonly value:MvuJsonValue|null
  readonly captureSha256:string
}
export interface AuthorDialogTaskRefV1 {
  readonly taskId:string
  readonly generation:string
  readonly resultSha256:string
}
export interface AuthorChatUpdateV1 {
  readonly binding:AuthorChatBindingV1
  readonly expected:AuthorChatRevisionV1
  readonly operationId:string
  /** The callback's complete replacement for binding.key, never whole chat. */
  readonly value:MvuJsonValue
  readonly task:AuthorDialogTaskRefV1
}
export interface AuthorChatWriteOwnerV1 {
  isCurrent(binding:AuthorChatBindingV1):boolean|PromiseLike<boolean>
  /** Inspect the existing Native-backed completed job, including its actual
   * Source/descriptor/session/result association. A caller's DATA is no proof. */
  completedTask(binding:AuthorChatBindingV1,task:AuthorDialogTaskRefV1):boolean|PromiseLike<boolean>
}
export interface AuthorChatForkSeedV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-chat-fork-seed-v1'
  readonly authority:'consumer-data-only'
  readonly operationId:string
  readonly parent:AuthorChatCaptureV1
  readonly childSessionId:string
  readonly nativeCutSha256:string
  readonly seedSha256:string
}
export interface AuthorChatForkOwnerV1 {
  /** Source supplies this closure only inside its real reserved child apply
   * operation. It checks the prepared ref and frozen seed, not parent latest. */
  accepts(seed:AuthorChatForkSeedV1,prepared:AuthorChatRefV1,
    actualChildBinding:AuthorChatBindingV1):boolean|PromiseLike<boolean>
}
export interface AuthorChatEventV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-chat-event-v1'
  readonly binding:AuthorChatBindingV1
  readonly operationId:string
  readonly previous:AuthorChatRevisionV1
  readonly revision:number
  readonly value:MvuJsonValue
  readonly inputSha256:string
  readonly cause:{readonly kind:'completed-author-dialog';readonly task:AuthorDialogTaskRefV1}
    |{readonly kind:'reserved-source-fork';readonly prepared:AuthorChatRefV1;
      readonly seedSha256:string;readonly parentHead:AuthorChatRefV1}
  readonly eventSha256:string
}
export interface AuthorChatHeadV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-chat-head-v1'
  readonly binding:AuthorChatBindingV1
  readonly revision:number
  readonly event:AuthorChatRefV1
  readonly headSha256:string
}
export interface AuthorChatTableV1 {
  get(key:string):unknown
  put(key:string,value:object):unknown|PromiseLike<unknown>
}
export interface AuthorChatCommitV1 {
  readonly kind:'committed'|'replayed'
  readonly event:AuthorChatRefV1
  readonly capture:AuthorChatCaptureV1
}
