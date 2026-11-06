/** Current captured Native prompt DATA and normalized injection records.
 * Core owns Source lifetime and publication; no executable program is carried. */
import type {MvuScopeReadFrameV1,MvuScopeVariablesV1} from './tavern-mvu-scope-read-types.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {AuthorMessageTargetV3} from './roleplay-author-chat-state-types.js'
export type AuthorOrdinaryMessageCaptureV1=ReturnType<CanonicalAuthorChatStateV1['captureNamespaceV3']>&{
  readonly root:{readonly namespace:{readonly target:AuthorMessageTargetV3}}
}
export interface AuthorMessageOrdinaryV1 {
  readonly selectedTarget:AuthorMessageTargetV3
  readonly variants:readonly AuthorMessageTargetV3[]
}

export interface PromptCapturedMessageV1 {
  readonly index:number
  readonly messageId:string
  readonly ownerSessionId:string
  readonly nativeSeq:number|null
  readonly messageVersionSha256:string
  readonly role:'user'|'assistant'
  readonly message:string
  readonly variables:MvuScopeVariablesV1
  readonly ordinary?:AuthorMessageOrdinaryV1
  readonly variants:null|{readonly source:'native-author-copy-opening-candidates-v1';
    readonly swipes:readonly string[];readonly swipe_id:number;
    readonly swipes_data?:readonly (MvuJsonObject|null)[]}
}
export interface PromptCaptureV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-prompt-capture-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSnapshotSha256:string
  readonly nativeCut:number
  readonly nativePrefixSha256:string
  readonly attemptId:string
  readonly clockEpochMs:number
  readonly randomSeed:string
  readonly messages:readonly PromptCapturedMessageV1[]
  readonly scopeFrame:MvuScopeReadFrameV1
  /** The actual Source/import namespace supplies ordinary keys together. */
  readonly ordinaryChat?:ReturnType<CanonicalAuthorChatStateV1['captureNamespaceV3']>
  readonly ordinaryMessages?:readonly AuthorOrdinaryMessageCaptureV1[]
  readonly captureSha256:string
}
export interface PromptDiagnosticV1 {
  readonly code:string
  readonly ordinal?:number
  readonly scriptIdentity?:string
  readonly pointer?:string
  readonly line?:number
  readonly column?:number
  /** A capability/syntax name only; never original text or a guest stack. */
  readonly feature?:string
}
export interface AuthorPromptInjectionV1 {
  readonly id:string
  readonly position:'none'|'in_chat'
  readonly depth:number
  readonly role:'system'|'user'|'assistant'
  readonly content:string
  readonly should_scan:boolean
}
