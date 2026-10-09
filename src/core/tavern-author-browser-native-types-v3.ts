/** Wire DATA for one trusted page renderer. The live renderer/Worker route
 * supplies ownership; these tags and IDs do not grant attachment authority. */
export type NativeHandleKindV3='document'|'node'|'style'|'dataset'|'class-list'
  |'canvas'|'gradient'|'point'|'matrix'|'event'|'audio'|'file'|'blob'
  |'file-reader'|'observer'|'media-query'|'viewport'
  |'frame'|'frame-parent'|'frame-style'

export interface NativeHandleV3 {
  readonly tag:'handle'
  readonly pageId:string
  readonly handle:number
  readonly kind:NativeHandleKindV3
}
export interface OwnedNativeCallbackV3 {
  readonly tag:'callback'
  readonly pageId:string
  readonly callbackId:number
}
export interface NativePromiseV3 {
  readonly tag:'promise'
  readonly pageId:string
  readonly promiseId:number
}
export interface NativePageWindowV3 {
  readonly tag:'page-window'
  readonly pageId:string
}
/** Ordinary DATA is wrapped so an author's own `tag: 'handle'` field is
 * preserved as data rather than decoded as a native ownership reference. */
export interface NativeWireRecordV3 {
  readonly tag:'record'
  readonly entries:Readonly<Record<string,NativeWireValueV3>>
}
export type NativeWireObjectV3={readonly tag:'undefined'}|NativeHandleV3|OwnedNativeCallbackV3
  |NativePromiseV3|NativePageWindowV3|NativeWireRecordV3
export type NativeWireValueV3=null|boolean|number|string
  |NativeWireObjectV3|readonly NativeWireValueV3[]

export type NativeCreateV3=
  |{readonly kind:'image'}
  |{readonly kind:'audio';readonly source?:string}
  |{readonly kind:'event';readonly type:string;readonly options?:NativeWireRecordV3}
  |{readonly kind:'custom-event';readonly type:string;readonly options?:NativeWireRecordV3}
  |{readonly kind:'mouse-event';readonly type:string;readonly options?:NativeWireRecordV3}
  |{readonly kind:'mutation-observer'|'resize-observer';readonly callback:OwnedNativeCallbackV3}
  |{readonly kind:'file-reader'}
  |{readonly kind:'blob';readonly parts:readonly NativeWireValueV3[];readonly mime:string}

export type NativeRequestV3=
  |{readonly op:'get';readonly target:NativeHandleV3;readonly key:string}
  |{readonly op:'set';readonly target:NativeHandleV3;readonly key:string;readonly value:NativeWireValueV3}
  |{readonly op:'call';readonly target:NativeHandleV3;readonly method:string;readonly args:readonly NativeWireValueV3[]}
  |{readonly op:'create';readonly creation:NativeCreateV3}
  |{readonly op:'timer';readonly mode:'timeout'|'interval'|'raf';readonly callback:OwnedNativeCallbackV3;readonly delay?:number}
  |{readonly op:'clear-timer';readonly timerId:number}
  |{readonly op:'consume-listener';readonly listenerId:number}
  |{readonly op:'window-read';readonly key:'devicePixelRatio'|'innerWidth'|'innerHeight'|'visualViewport'|'performance-now'|'navigator'}
  |{readonly op:'window-dispatch';readonly event:NativeHandleV3}
  |{readonly op:'window-listen';readonly type:string;readonly callback:OwnedNativeCallbackV3;readonly options?:NativeWireValueV3}
  |{readonly op:'window-unlisten';readonly type:string;readonly callback:OwnedNativeCallbackV3;readonly options?:NativeWireValueV3}
  |{readonly op:'computed-style';readonly target:NativeHandleV3}
  |{readonly op:'match-media';readonly query:string}
  |{readonly op:'object-url';readonly target:NativeHandleV3}
  |{readonly op:'revoke-object-url';readonly url:string}

export interface NativeCallbackDeliveryV3 {
  readonly callback:OwnedNativeCallbackV3
  readonly args:readonly NativeWireValueV3[]
  /** Actual resource receiver captured during native dispatch, before the
   * event's currentTarget resets. Windows remain actual guest-global values. */
  readonly receiver?:NativeWireValueV3
  readonly resourceKind:'native-event'|'resource'|'timer'|'raf'|'observer'
  readonly registration?:{
    readonly listenerId:number
    readonly type:string
    readonly capture:boolean
    readonly once:boolean
    /** A native property slot is distinct from addEventListener with the
     * same function. Replacing it must not consume the ordinary listener. */
    readonly property?:string
  }
  /** Original Event identity survives dispatchEvent's round trip. Native
   * dispatch resets currentTarget/phase before an RPC returns, so each delivery
   * carries its actual listener-site state for the guest's inline invocation. */
  readonly event?:{
    readonly reference:NativeHandleV3
    readonly target:NativeWireValueV3
    readonly currentTarget:NativeWireValueV3
    readonly eventPhase:number
    readonly cancelable:boolean
    readonly defaultPrevented:boolean
  }
  /** In-process trusted owner hook only; never a serialized gesture proof. */
  readonly nativeEvent?:Event
}
export interface NativeReplyV3 {
  readonly value:NativeWireValueV3
  /** Only callbacks fired on this native RPC stack. Real later UI/resource
   * events are delivered by the retained asynchronous callback owner. */
  readonly callbacks?:readonly NativeCallbackDeliveryV3[]
}
export type NativePromiseSettlementV3=
  |{readonly pageId:string;readonly promiseId:number;readonly kind:'fulfilled';readonly value:NativeWireValueV3}
  |{readonly pageId:string;readonly promiseId:number;readonly kind:'rejected';readonly error:string}

export interface BrowserPageApplyResultV3 {
  readonly nextStep:number
  readonly boundary:null|{readonly nodeId:number;readonly inlineOrdinal:number}
  readonly ended:boolean
}
export interface BrowserPageNativeResourcesV3 {
  readonly handles:number
  readonly nodes:number
  readonly listeners:number
  readonly timers:number
  readonly observers:number
  readonly media:number
  readonly fileReaders:number
  readonly objectURLs:number
  readonly pendingPromises:number
  readonly pendingLoads:number
  readonly readinessWaiters:number
}
export interface BrowserPageRendererV3 {
  /** Stops at the first script-boundary, consuming that checkpoint. The
   * Worker runs its retained classic script before calling applyUntil again. */
  applyUntil(exclusiveEnd:number):BrowserPageApplyResultV3
  getDocumentHandle():NativeHandleV3
  getParsedNodeHandle(nodeId:number):NativeHandleV3
  request(request:NativeRequestV3):NativeWireValueV3
  requestReply(request:NativeRequestV3):NativeReplyV3
  /** Trusted lifecycle owner publishes actual milestones; no event is fired. */
  setDocumentState(state:'loading'|'interactive'|'complete'):void
  /** Parser completion and actual owned load/error outcomes precede this ACK.
   * Load failure completes a resource attempt; cancellation rejects the wait. */
  awaitResourcesReady(signal:AbortSignal):Promise<void>
  resources():BrowserPageNativeResourcesV3
  dispose():Promise<BrowserPageNativeResourcesV3>
}

/** Trusted external resource owner. Its negative handles occupy a separate
 * namespace; the renderer never promotes the iframe to an ordinary DOM node. */
export interface BrowserNativeFrameHookV3 {
  /** The renderer exports only its already owned node identities. An external
   * frame owner cannot turn an unrelated native node into a new DOM handle. */
  registerDocument?(document:NativeHandleV3,exportOwnedNode:(node:Node|null)=>NativeWireValueV3):void
  /** External iframe listeners use their resource owner's negative IDs. */
  consumeListener?(listenerId:number):boolean
  create(document:Document,pageId:string,styleValue:(value:string)=>string):NativeHandleV3
  encode(node:Node):NativeHandleV3|undefined
  /** Consume the initial placement already performed by a suspended mount. */
  acceptPlacement?(parent:Node,node:Node):NativeHandleV3|undefined
  resolve(reference:NativeHandleV3):Node|undefined
  request(request:Extract<NativeRequestV3,{target:NativeHandleV3}>,
    styleValue:(value:string)=>string):NativeWireValueV3
  removed(node:Node):void
  disposeDocument(document:Document):void
}
