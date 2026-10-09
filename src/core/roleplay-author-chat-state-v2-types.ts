/** Versioned ordinary Source-key facts. Actual declaration/currentness comes
 * from Core's retained compiled program under the existing Source FIFO. */
import type {AuthorChatBindingV1,AuthorChatCaptureV1,AuthorChatEventV1,AuthorChatHeadV1,
  AuthorChatRefV1,AuthorChatRevisionV1} from './roleplay-author-chat-state-types.js'
import type {BrowserDeclaredChatKeyV3,BrowserWriterOriginV3} from './tavern-author-browser-types-v3.mjs'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'

export interface AuthorChatDeclarationRefV2 {
  readonly declarationId:string
  readonly writerIdentitySha256:string
  readonly writer:BrowserWriterOriginV3
}
export interface AuthorChatBindingV2 extends AuthorChatBindingV1 {
  readonly schemaVersion:2
  readonly declarationId:string
}
export interface AuthorChatCaptureV2 extends Omit<AuthorChatCaptureV1,'schemaVersion'|'encoding'|'binding'> {
  readonly schemaVersion:2
  readonly encoding:'native-author-chat-capture-v2'
  readonly binding:AuthorChatBindingV2
}
export interface AuthorChatCommitV2 {
  readonly kind:'committed'|'replayed'
  readonly event:AuthorChatRefV1
  readonly capture:AuthorChatCaptureV2
}
export type AuthorChatCauseV2=
  |{readonly kind:'ordinary-source-key';readonly declaration:AuthorChatDeclarationRefV2}
  |{readonly kind:'reserved-source-fork';readonly prepared:AuthorChatRefV1;
    readonly seedSha256:string;readonly parentHead:AuthorChatRefV1;
    readonly declaration:AuthorChatDeclarationRefV2}
export interface AuthorChatEventV2 extends Omit<AuthorChatEventV1,'schemaVersion'|'encoding'|'cause'|'binding'> {
  readonly schemaVersion:2
  readonly encoding:'native-author-chat-event-v2'
  readonly cause:AuthorChatCauseV2
  readonly binding:AuthorChatBindingV2
}
export interface AuthorChatHeadV2 extends Omit<AuthorChatHeadV1,'schemaVersion'|'encoding'|'binding'> {
  readonly schemaVersion:2
  readonly encoding:'native-author-chat-head-v2'
  readonly binding:AuthorChatBindingV2
}
export type AuthorChatStoredEvent=AuthorChatEventV1|AuthorChatEventV2
export type AuthorChatStoredHead=AuthorChatHeadV1|AuthorChatHeadV2
export interface OrdinaryAuthorChatUpdateV2 {
  readonly binding:AuthorChatBindingV2
  readonly declaration:AuthorChatDeclarationRefV2
  readonly expected:AuthorChatRevisionV1
  readonly operationId:string
  readonly value:MvuJsonValue
}
export interface OrdinaryAuthorChatOwnerV2 {
  /** The existing actual program declaration is joined once; DATA alone
   * cannot authorize this writer. No completed Native job is fabricated. */
  ownsDeclaration(binding:AuthorChatBindingV2,declaration:AuthorChatDeclarationRefV2):boolean
  isCurrent(binding:AuthorChatBindingV2):boolean|PromiseLike<boolean>
}
export interface AuthorChatForkSeedV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-chat-fork-seed-v2'
  readonly authority:'consumer-data-only'
  readonly operationId:string
  readonly parent:AuthorChatCaptureV2
  readonly declaration:AuthorChatDeclarationRefV2
  readonly childSessionId:string
  readonly nativeCutSha256:string
  readonly seedSha256:string
}
export interface AuthorChatForkOwnerV2 {
  accepts(seed:AuthorChatForkSeedV2,prepared:AuthorChatRefV1,
    actualChildBinding:AuthorChatBindingV2,declaration:BrowserDeclaredChatKeyV3):boolean|PromiseLike<boolean>
  isCurrent(binding:AuthorChatBindingV2):boolean|PromiseLike<boolean>
}
