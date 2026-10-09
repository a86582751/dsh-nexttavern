/** Private Worker/Main transport. Native frame facts are supplied by the
 * actual Main resource owner; their serialized IDs grant no author authority. */
import type {BrowserBindingV1} from './tavern-author-browser-types.mjs'
import type {BrowserProgramV3,BrowserSnapshotV3} from './tavern-author-browser-types-v3.mjs'
import type {NativeHandleV3,NativeRequestV3,NativeCallbackDeliveryV3,NativePromiseSettlementV3}
  from './tavern-author-browser-native-types-v3.js'

export interface BrowserNativeFrameFactV3 {
  readonly frameId:number
  readonly reference:NativeHandleV3
  readonly carrierIdentity:string
  readonly parentPageId:string
}
export type BrowserWorkerRequestV3=
  |{readonly op:'carrier-create';readonly ordinal:number;readonly contextId:string}
  |{readonly op:'carrier-state';readonly contextId:string;readonly state:'loading'|'interactive'|'complete'}
  |{readonly op:'carrier-dispose';readonly contextId:string}
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
    readonly snapshot:BrowserSnapshotV3;readonly wasm:ArrayBuffer;readonly operationPrefix:string}
  |{readonly type:'result';readonly id:number;readonly value?:unknown;readonly error?:string;
    readonly frames?:readonly BrowserNativeFrameFactV3[]}
  |{readonly type:'snapshot';readonly snapshot:BrowserSnapshotV3}
  |{readonly type:'source-event';readonly event:BrowserSourceEventV3}
  |{readonly type:'callback';readonly delivery:NativeCallbackDeliveryV3}
  |{readonly type:'settlement';readonly settlement:NativePromiseSettlementV3}
  |{readonly type:'frame-closed';readonly frameId:number}
  |{readonly type:'dispose'}

export interface BrowserWorkerRpcV3 {
  readonly type:'rpc'
  readonly id:number
  readonly request:BrowserWorkerRequestV3
  readonly actorEntry?:number
}
