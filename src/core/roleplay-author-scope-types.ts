import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AcceptedAuthorChatWriteV3,AuthorChatRefV1,AcceptedAuthorChatContributionV3}
  from './roleplay-author-chat-state-types.js'

export type AuthorPersistentScopeAddressV1={readonly schemaVersion:1;readonly profileId:string}&(
  |{readonly scope:'global'}
  |{readonly scope:'character';readonly characterId:string}
  |{readonly scope:'preset';readonly presetId:string}
  |{readonly scope:'extension';readonly extensionId:string})

export interface AuthorPersistentScopeRootV1 {
  readonly address:AuthorPersistentScopeAddressV1
  readonly head:AuthorChatRefV1|null
}
export interface AuthorPersistentScopeCaptureV1 {
  readonly schemaVersion:1
  readonly authority:'consumer-data-only'
  readonly root:AuthorPersistentScopeRootV1
  readonly revision:number
  readonly values:Readonly<MvuJsonObject>
  readonly valuesSha256:string
}
export interface AuthorPersistentScopeOwnerV1 {
  owns(address:AuthorPersistentScopeAddressV1):boolean
  isCurrent():boolean|PromiseLike<boolean>
  beforeWrite?(row:{readonly key:string;readonly value:object}):()=>void
}
export interface AuthorPersistentScopeReplaceV1 {
  readonly expectedRoot:AuthorPersistentScopeRootV1
  readonly operationId:string
  readonly values:Readonly<MvuJsonObject>
  readonly cause:MvuJsonValue
}
export interface AuthorPersistentScopeContributionV1 {
  readonly address:AuthorPersistentScopeAddressV1
  readonly operationId:string
  readonly contributionId:string
  readonly attemptId:string
  readonly replacesAttemptId:string|null
  readonly writes:readonly AcceptedAuthorChatWriteV3[]
  readonly source:AcceptedAuthorChatContributionV3['source']
  readonly cause:MvuJsonValue
}
export interface AuthorPersistentScopeCommitV1 {
  readonly kind:'committed'|'replayed'
  readonly inputSha256:string
  readonly event:AuthorChatRefV1
  readonly publication:AuthorChatRefV1
  readonly root:AuthorPersistentScopeRootV1
}
export type AuthorPersistentScopeReceiptV1=
  |{readonly kind:'unconfirmed';readonly inputSha256:string}
  |{readonly kind:'pending';readonly inputSha256:string;readonly event:AuthorChatRefV1}
  |{readonly kind:'applied';readonly inputSha256:string;readonly event:AuthorChatRefV1;
    readonly publication:AuthorChatRefV1;readonly root:AuthorPersistentScopeRootV1}
