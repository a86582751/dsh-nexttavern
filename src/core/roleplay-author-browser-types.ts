/** Browser HTTP payloads locate a private Core attachment. None is a Native
 * execution lease or a replacement for the numerical writer's own reservation. */
import type {BrowserBindingV1,BrowserProgramV1,BrowserRuntimeArtifactV1,
  BrowserSaveRequestV1,BrowserSnapshotV1} from './tavern-author-browser-types.mjs'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'

export interface AuthorBrowserAttachmentV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-browser-attachment-v1'
  readonly binding:BrowserBindingV1
  readonly program:BrowserProgramV1
  readonly artifact:BrowserRuntimeArtifactV1
  readonly snapshot:BrowserSnapshotV1
}
export type AuthorBrowserRequestV1=
  |{action:'attach';sessionId:string;binding?:BrowserBindingV1}
  |{action:'capture';binding:BrowserBindingV1}
  |{action:'save';binding:BrowserBindingV1;
    request:Pick<BrowserSaveRequestV1,'requestId'|'generation'|'readRevision'|'scriptIdentity'>;operation:MvuPlayerEditRequest}
  |{action:'confirm';operation:MvuPlayerEditRequest}
  |{action:'retry';operation:MvuPlayerEditRequest}
  |{action:'dispose';binding:BrowserBindingV1}
export type AuthorBrowserReplyV1=
  |{ok:true;kind:'attached';attachment:AuthorBrowserAttachmentV1}
  |{ok:true;kind:'inactive';code:string}
  |{ok:true;kind:'snapshot';snapshot:BrowserSnapshotV1}
  |{ok:true;kind:'saved';result:MvuPlayerEditResponse;snapshot?:BrowserSnapshotV1}
  |{ok:true;kind:'confirmed';result:MvuPlayerEditResponse}
  |{ok:true;kind:'disposed'}
  |{ok:false;code:string;error?:string}
