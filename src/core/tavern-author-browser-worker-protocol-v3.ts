/** Private Worker/Main transport. Native frame facts are supplied by the
 * actual Main resource owner; their serialized IDs grant no author authority. */
import type {BrowserBindingV1} from './tavern-author-browser-types.mjs'
import type {BrowserProgramV3,BrowserSnapshotV3} from './tavern-author-browser-types-v3.mjs'
import type {OwnedBrowserStateBindingV1} from './tavern-author-browser-state-imports-v1.mjs'
import type {ReaderRegexDocumentProgramV1,ReaderRegexDocumentSnapshotV1}
  from './reader-regex-document-types.mjs'
import type {BrowserGenerationInvocationV3,BrowserGenerationResultV3,BrowserCallbackRegistrationV3}
  from './roleplay-author-browser-generation-types.js'
import type {NativeHandleV3,NativeRequestV3,NativeCallbackDeliveryV3,NativePromiseSettlementV3}
  from './tavern-author-browser-native-types-v3.js'

interface NativeFrameFactBase {
  readonly frameId:number
  readonly reference:NativeHandleV3
  readonly parentPageId:string
}
export type BrowserNativeFrameFactV3=NativeFrameFactBase&(
  |{readonly kind?:'helper';readonly carrierIdentity:string}
  |{readonly kind:'reader-regex-document';readonly programSha256:string;readonly documentPlanSha256:string})
export type BrowserWorkerRequestV3=
  |{readonly op:'carrier-create';readonly ordinal:number;readonly contextId:string}
  |{readonly op:'carrier-state';readonly contextId:string;readonly state:'loading'|'interactive'|'complete'}
  |{readonly op:'carrier-dispose';readonly contextId:string}
  |{readonly op:'reader-root-create'}
  |{readonly op:'helper-root-create'}
  |{readonly op:'native';readonly contextId:string;readonly request:NativeRequestV3}
  |{readonly op:'page-mount';readonly frameId:number;readonly pageId:string;readonly planSha256:string}
  |{readonly op:'page-dispose';readonly frameId:number;readonly pageId:string}
  |{readonly op:'page-apply';readonly pageId:string;readonly exclusiveEnd:number}
  |{readonly op:'page-document';readonly pageId:string}
  |{readonly op:'page-node';readonly pageId:string;readonly nodeId:number}
  |{readonly op:'page-state';readonly pageId:string;readonly state:'loading'|'interactive'|'complete'}
  |{readonly op:'page-resources';readonly pageId:string}
  |{readonly op:'page-loaded';readonly frameId:number;readonly pageId:string}
  |{readonly op:'frame-location';readonly frameId:number;readonly location:{readonly src?:string;readonly srcdoc?:string}}
  |{readonly op:'source';readonly payload:unknown}
  |{readonly op:'host';readonly payload:unknown}

/** Private Main producer delivery; never populated from a guest DOM event. */
export interface BrowserSourceEventV3 {
  readonly type:string
  readonly args:readonly unknown[]
}

export type BrowserWorkerInputV3=
  |{readonly type:'start';readonly binding:BrowserBindingV1;readonly program:BrowserProgramV3;
    readonly snapshot:BrowserSnapshotV3;readonly wasm:ArrayBuffer;readonly operationPrefix:string;
    readonly stateProgramBinding?:OwnedBrowserStateBindingV1}
  |{readonly type:'reader-start';readonly binding:BrowserBindingV1;readonly program:ReaderRegexDocumentProgramV1;
    readonly snapshot:ReaderRegexDocumentSnapshotV1;readonly wasm:ArrayBuffer;readonly operationPrefix:string}
  |{readonly type:'result';readonly id:number;readonly value?:unknown;readonly error?:string;
    readonly frames?:readonly BrowserNativeFrameFactV3[]}
  |{readonly type:'snapshot';readonly snapshot:BrowserSnapshotV3}
  |{readonly type:'reader-snapshot';readonly snapshot:ReaderRegexDocumentSnapshotV1}
  |{readonly type:'source-event';readonly event:BrowserSourceEventV3}
  |{readonly type:'generation-registrations-request';readonly id:number}
  |{readonly type:'generation-invocation';readonly invocation:BrowserGenerationInvocationV3}
  |{readonly type:'generation-cancel';readonly invocationId:string}
  |{readonly type:'callback';readonly delivery:NativeCallbackDeliveryV3}
  |{readonly type:'settlement';readonly settlement:NativePromiseSettlementV3}
  |{readonly type:'frame-closed';readonly frameId:number}
  |{readonly type:'dispose'}

export type BrowserGenerationWorkerReplyV3=
  |{readonly type:'generation-registrations-result';readonly id:number;
    readonly registrations?:readonly BrowserCallbackRegistrationV3[];readonly error?:string}
  |{readonly type:'generation-result-v3';readonly result:BrowserGenerationResultV3}

export interface BrowserWorkerRpcV3 {
  readonly type:'rpc'
  readonly id:number
  readonly request:BrowserWorkerRequestV3
  readonly actorEntry?:number
}
