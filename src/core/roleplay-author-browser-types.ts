/** Browser HTTP payloads locate a private Core attachment. None is a Native
 * execution lease or a replacement for the numerical writer's own reservation. */
import type {BrowserBindingV1,BrowserProgramV1,BrowserRuntimeArtifactV1,
  BrowserSaveRequestV1,BrowserSnapshotV1} from './tavern-author-browser-types.mjs'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {BrowserProgramV2,BrowserRuntimeArtifactV2,
  BrowserSnapshotV2,BrowserWorldbookMutationRequestV2,
  BrowserWorldbookMutationReplyV2,BrowserPersonaMutationRequestV2,
  BrowserPersonaMutationReplyV2} from './tavern-author-browser-types-v2.mjs'
import type {TavernLoreMutationRetryLocatorV1} from './roleplay-tavern-lore-edits-types.js'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AuthorScriptResourceRequestV1} from './roleplay-author-script-resources.js'
import type {BrowserProgramV3,BrowserRuntimeArtifactV3,BrowserSnapshotV3,
  BrowserOrdinaryKeyRequestV3,BrowserOrdinaryKeyReplyV3} from './tavern-author-browser-types-v3.mjs'

export interface AuthorBrowserAttachmentV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-attachment-v1'
  readonly binding:BrowserBindingV1
  readonly program:BrowserProgramV1
  readonly artifact:BrowserRuntimeArtifactV1
  readonly snapshot:BrowserSnapshotV1
}
export interface AuthorBrowserAttachmentV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-attachment-v2'
  readonly binding:BrowserBindingV1
  readonly program:BrowserProgramV2
  readonly artifact:BrowserRuntimeArtifactV2
  readonly snapshot:BrowserSnapshotV2
}
export interface AuthorBrowserAttachmentV3 {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-attachment-v3'
  readonly binding:BrowserBindingV1
  readonly program:BrowserProgramV3
  readonly artifact:BrowserRuntimeArtifactV3
  readonly snapshot:BrowserSnapshotV3
}
export type AuthorBrowserAttachment=AuthorBrowserAttachmentV1|AuthorBrowserAttachmentV2|AuthorBrowserAttachmentV3
export type AuthorBrowserSnapshot=BrowserSnapshotV1|BrowserSnapshotV2|BrowserSnapshotV3
export type AuthorBrowserWriteProgram=BrowserProgramV2|BrowserProgramV3
export type AuthorBrowserWorldbookMutationReply=Omit<BrowserWorldbookMutationReplyV2,'snapshot'>
  &{readonly snapshot?:BrowserSnapshotV2|BrowserSnapshotV3}
export type AuthorBrowserPersonaMutationReply=Omit<BrowserPersonaMutationReplyV2,'snapshot'>
  &{readonly snapshot?:BrowserSnapshotV2|BrowserSnapshotV3}
export type AuthorBrowserRequestV1=
  {action:'attach';sessionId:string;binding?:BrowserBindingV1}
  |{action:'capture';binding:BrowserBindingV1}
  |{action:'save';binding:BrowserBindingV1;
    request:Pick<BrowserSaveRequestV1,'requestId'|'generation'|'readRevision'|'scriptIdentity'>;operation:MvuPlayerEditRequest}
  |{action:'confirm';operation:MvuPlayerEditRequest}
  |{action:'retry';operation:MvuPlayerEditRequest}
  |{action:'dispose';binding:BrowserBindingV1}
  |{action:'read-source-resource';binding:BrowserBindingV1;request:AuthorScriptResourceRequestV1}
  |{action:'mutate-worldbook';binding:BrowserBindingV1;request:BrowserWorldbookMutationRequestV2}
  |{action:'retry-worldbook';sessionId:string;operationId:string;locator?:TavernLoreMutationRetryLocatorV1}
  |{action:'mutate-persona';binding:BrowserBindingV1;request:BrowserPersonaMutationRequestV2}
  |{action:'retry-persona';sessionId:string;operationId:string}
export type AuthorBrowserReplyV1=
  {ok:true;kind:'attached';attachment:AuthorBrowserAttachmentV1|AuthorBrowserAttachmentV2}
  |{ok:true;kind:'inactive';code:string}
  |{ok:true;kind:'snapshot';snapshot:BrowserSnapshotV1|BrowserSnapshotV2}
  |{ok:true;kind:'saved';result:MvuPlayerEditResponse;snapshot?:BrowserSnapshotV1|BrowserSnapshotV2}
  |{ok:true;kind:'confirmed';result:MvuPlayerEditResponse}
  |{ok:true;kind:'disposed'}
  |{ok:true;kind:'source-resource';value:MvuJsonValue}
  |{ok:false;code:string;error?:string}
  |{ok:true;kind:'worldbook-mutated';reply:BrowserWorldbookMutationReplyV2}
  |{ok:true;kind:'worldbook-retried';result:BrowserWorldbookMutationReplyV2['result']}
  |{ok:true;kind:'persona-mutated';reply:BrowserPersonaMutationReplyV2}
  |{ok:true;kind:'persona-retried';result:BrowserPersonaMutationReplyV2['result']}
/** Legacy Reader transports remain explicitly V1/V2. A V3 caller consumes
 * this full service contract rather than passing V3 to a legacy frame. */
export type AuthorBrowserRequest=AuthorBrowserRequestV1
  |{action:'mutate-author-key';binding:BrowserBindingV1;request:BrowserOrdinaryKeyRequestV3}
export type AuthorBrowserReply=Exclude<AuthorBrowserReplyV1,
  {kind:'attached'|'snapshot'|'saved'|'worldbook-mutated'|'persona-mutated'}>
  |{ok:true;kind:'attached';attachment:AuthorBrowserAttachment}
  |{ok:true;kind:'snapshot';snapshot:AuthorBrowserSnapshot}
  |{ok:true;kind:'saved';result:MvuPlayerEditResponse;snapshot?:AuthorBrowserSnapshot;
    sourceEvents?:readonly import('./tavern-author-browser-worker-protocol-v3.js').BrowserSourceEventV3[]}
  |{ok:true;kind:'author-key-mutated';reply:BrowserOrdinaryKeyReplyV3;snapshot?:BrowserSnapshotV3}
  |{ok:true;kind:'worldbook-mutated';reply:AuthorBrowserWorldbookMutationReply}
  |{ok:true;kind:'persona-mutated';reply:AuthorBrowserPersonaMutationReply}
