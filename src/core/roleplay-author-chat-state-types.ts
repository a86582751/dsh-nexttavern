/** Ordinary addresses belong to the actual Source import incarnation.
 * Descriptor digests and snapshot provenance are read bases, never addresses. */
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AuthorChatRootMarkerV1} from 'dsh-nexttavern-session-format/author-chat-marker'

export interface AuthorChatRefV1 {readonly key:string;readonly sha256:string}
export interface AuthorChatRevisionV1 {
  readonly revision:number
  readonly head:AuthorChatRefV1|null
}
export interface AuthorChatTableV1 {
  get(key:string):unknown
  put(key:string,value:object):unknown|PromiseLike<unknown>
}

export interface AuthorMessageTargetV3 {
  readonly kind:'message'
  readonly identity:{readonly ownerSessionId:string;readonly nativeSeq:number;readonly messageId:string;
    readonly variant:{readonly kind:'native-canonical'}|{readonly kind:'opening-variant';readonly id:string}}
}
export interface AuthorScriptTargetV3 {
  readonly kind:'script'
  readonly identity:{readonly scriptIdentity:string}
}
export interface AuthorChatNamespaceV3 {
  readonly schemaVersion:3
  readonly sessionId:string
  readonly importIncarnation:{readonly sourceRecordSessionId:string;readonly importId:string;
    readonly transactionId:string;readonly activationSha256:string}|null
  /** A stable actual Native message/variant or admitted Source script address;
   * body/descriptor versions never move the same target's ordinary variables. */
  readonly target?:AuthorMessageTargetV3|AuthorScriptTargetV3
}
/** The head is always a local publication. The base points to an immutable
 * fork record containing the frozen parent root, including its own base. */
export interface AuthorChatNamespaceRootV3 {
  readonly namespace:AuthorChatNamespaceV3
  readonly head:AuthorChatRefV1|null
  readonly base:AuthorChatRefV1|null
}
export interface AuthorChatNativeCutV3 {
  readonly session:{readonly id:string}
  readonly length:number
}
/** The Native owner reads and appends the actual session carrier. State owns
 * namespace identity and immutable Domain rows, including fixed fork bases. */
export interface AuthorChatNativeRootsV3 {
  currentRoot(namespace:AuthorChatNamespaceV3,namespaceSha256:string):AuthorChatNamespaceRootV3|undefined
  cutRoot(namespace:AuthorChatNamespaceV3,namespaceSha256:string,
    cut:AuthorChatNativeCutV3):AuthorChatNamespaceRootV3|undefined
  markerHeadsAtCut(cut:AuthorChatNativeCutV3):readonly AuthorChatRootMarkerV1[]
  publish(root:AuthorChatNamespaceRootV3,namespaceSha256:string,expectedHead:AuthorChatRefV1|null):void
  flush(namespace:AuthorChatNamespaceV3):Promise<void>
}
export interface AuthorChatCaptureV3 {
  readonly schemaVersion:3
  readonly authority:'consumer-data-only'
  readonly namespace:AuthorChatNamespaceV3
  readonly key:string
  readonly root:AuthorChatNamespaceRootV3
  readonly revision:AuthorChatRevisionV1
  readonly exists:boolean
  readonly value:MvuJsonValue|null
}
export interface OrdinaryAuthorChatUpdateV3 {
  readonly namespace:AuthorChatNamespaceV3
  readonly key:string
  readonly expected:AuthorChatRevisionV1
  readonly operationId:string
  readonly value:MvuJsonValue
  readonly cause:MvuJsonValue
}
export interface OrdinaryAuthorChatOwnerV3 {
  ownsNamespace(namespace:AuthorChatNamespaceV3,cause:MvuJsonValue):boolean
  isCurrent(namespace:AuthorChatNamespaceV3):boolean|PromiseLike<boolean>
  beforeWrite?(row:{readonly key:string;readonly value:object}):()=>void
}
export interface OrdinaryAuthorChatBatchUpdateV3 {
  readonly namespace:AuthorChatNamespaceV3
  readonly expectedRoot:AuthorChatNamespaceRootV3
  readonly operationId:string
  readonly values:Readonly<Record<string,MvuJsonValue>>
  readonly cause:MvuJsonValue
}
/** Parent outboxes and the canonical admission serialize this same operation.
 * Numerical DATA is checked by the writer but never enters an ordinary row. */
export function prepareOrdinaryAuthorChatBatchV3(root:AuthorChatNamespaceRootV3,
  nextVariables:Readonly<Record<string,MvuJsonValue>>,operationId:string,cause:MvuJsonValue):OrdinaryAuthorChatBatchUpdateV3 {
  const {stat_data:_reserved,...values}=nextVariables
  return {namespace:root.namespace,expectedRoot:root,operationId,values,cause}
}
export interface OrdinaryAuthorChatBatchOwnerV3 extends OrdinaryAuthorChatOwnerV3 {
  readonly basisValues?:Readonly<Record<string,MvuJsonValue>>
}
export type OrdinaryAuthorChatBatchCommitV3=AcceptedAuthorChatCommitV3
  |{readonly kind:'no-update';readonly root:AuthorChatNamespaceRootV3}
export type OrdinaryAuthorChatBatchReceiptV3=AcceptedAuthorChatReceiptV3
/** Apply the owner's effective overlay, including explicit deletion of Native fallback. */
export function applyAuthorChatOverlayV3<T>(base:Readonly<Record<string,T>>,
  capture:{readonly values:Readonly<Record<string,T>>;readonly deletedKeys?:readonly string[]}):Record<string,T> {
  const values={...base,...capture.values}
  for(const key of capture.deletedKeys??[])delete values[key]
  return values
}
export interface AuthorChatCommitV3 {
  readonly kind:'committed'|'replayed'
  readonly event:AuthorChatRefV1
  readonly committedRevision:AuthorChatRevisionV1
  readonly capture:AuthorChatCaptureV3
}
export type OrdinaryAuthorChatReceiptV3=
  |{readonly kind:'applied';readonly inputSha256:string;readonly event:AuthorChatRefV1;
    readonly committedRevision:AuthorChatRevisionV1;
    readonly capture:AuthorChatCaptureV3}
  |{readonly kind:'pending';readonly inputSha256:string;readonly event:AuthorChatRefV1}
  |{readonly kind:'unconfirmed';readonly inputSha256:string}
export type AcceptedAuthorChatWriteV3=
  |{readonly key:string;readonly operation:'set'|'add'|'append';readonly value:MvuJsonValue}
  |{readonly key:string;readonly operation:'delete'}
export interface AcceptedAuthorChatContributionV3 {
  readonly namespace:AuthorChatNamespaceV3
  readonly contributionId:string
  readonly attemptId:string
  readonly operationId:string
  readonly replacesAttemptId:string|null
  readonly writes:readonly AcceptedAuthorChatWriteV3[]
  readonly source:{readonly kind:'native-material';readonly ref:AuthorChatRefV1}
    |{readonly kind:'preset-configuration';readonly configurationId:string;readonly presetId:string;
      readonly conversationId:string|null}
  readonly cause:MvuJsonValue
}
export interface AcceptedAuthorChatCommitV3 {
  readonly kind:'committed'|'replayed'
  readonly event:AuthorChatRefV1
  readonly publication:AuthorChatRefV1
  /** The first published cut remains the receipt even after replacement. */
  readonly root:AuthorChatNamespaceRootV3
}
export type AcceptedAuthorChatReceiptV3=
  |{readonly kind:'applied';readonly inputSha256:string;readonly event:AuthorChatRefV1;
    readonly publication:AuthorChatRefV1;readonly root:AuthorChatNamespaceRootV3}
  |{readonly kind:'pending';readonly inputSha256:string;readonly event:AuthorChatRefV1}
  |{readonly kind:'unconfirmed';readonly inputSha256:string}
export interface AuthorChatForkBaseV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-chat-fork-base-v3'
  readonly operationId:string
  readonly parentRoot:AuthorChatNamespaceRootV3
  readonly childNamespace:AuthorChatNamespaceV3
  readonly nativeCutSha256:string
  readonly sha256:string
}
export interface AuthorChatForkOwnerV3 {
  accepts(seed:AuthorChatForkBaseV3,prepared:AuthorChatRefV1,
    actualChildNamespace:AuthorChatNamespaceV3):boolean|PromiseLike<boolean>
  isCurrent(namespace:AuthorChatNamespaceV3):boolean|PromiseLike<boolean>
}
