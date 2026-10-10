/** Source HTML requirements only. The attachment/renderer supplies live rights. */
import {recordSha256} from './roleplay-data.js'
import type {BrowserCapabilityContractV3,BrowserCapabilityV3} from './tavern-author-browser-types-v3.mjs'

export const BROWSER_BOUNDS_V3=Object.freeze({scripts:64,pages:64,sourceBytes:3*1_048_576,
  programBytes:24*1_048_576,syntaxNodes:131_072,syntaxDepth:512,finiteNames:32})
export type BrowserFacadeKindV3='window'|'document'|'node'|'frame'|'frame-parent'|'style'|'class-list'
  |'event'|'canvas'|'point'|'matrix'|'audio'|'file'|'file-reader'|'observer'|'media-query'
  |'viewport'|'preferences'|'url'|'helper'|'tavern'|'context'|'mvu'|'navigator'|'performance'|'gradient'|'frame-style'|'dataset'
  |'persona-catalog'|'persona-row'|'persona-dataset'
export interface BrowserOperationV3 {
  readonly capability:BrowserCapabilityV3
  readonly returns:'guest'|'void'|BrowserFacadeKindV3|'nodes'|'variables'|'source-id'|'source-trees'|'object-url'
    |'avatar-fetch'|'avatar-ids'
  readonly callbacks?:'event'|'guest'|'nodes'
  /** Resource removal targets this receiver's actual mounted frame only. */
  readonly frameTarget?:'receiver-owned-frame'
}
const operation=(capability:BrowserCapabilityV3,returns:BrowserOperationV3['returns']='guest',
  callbacks?:BrowserOperationV3['callbacks']):BrowserOperationV3=>({capability,returns,...callbacks?{callbacks}:{}})
const dom=operation('isolated-dom-text','node'),event=operation('owned-synchronous-page-events','void','event')
const resource=operation('owned-resource-callbacks','guest','guest')
export const BROWSER_APIS_V3:Readonly<Record<string,BrowserOperationV3>>=Object.freeze({
  getVariables:operation('owned-variable-snapshot','variables'),
  getAllVariables:operation('owned-variable-snapshot','variables'),
  getScriptId:operation('owned-script-source-resources','source-id'),
  getScriptTrees:operation('owned-script-source-resources','source-trees'),
  insertOrAssignVariables:operation('owned-declared-key-mutation','void'),
  eventOn:resource,eventOnce:resource,eventMakeFirst:resource,eventRemoveListener:resource,
  getButtonEvent:operation('owned-resource-callbacks'),
  getChatMessages:operation('owned-message-snapshot'),
  getWorldbookNames:operation('owned-named-worldbooks'),getWorldbook:operation('owned-named-worldbooks'),
  getCurrentCharPrimaryLorebook:operation('owned-named-worldbooks'),getCharWorldbookNames:operation('owned-named-worldbooks'),
  createWorldbookEntries:operation('owned-named-worldbooks'),deleteWorldbookEntries:operation('owned-named-worldbooks'),
  updateWorldbookWith:operation('owned-named-worldbooks'),replaceWorldbook:operation('owned-named-worldbooks'),
  getPersonaIds:operation('owned-native-personas'),getPersonaNames:operation('owned-native-personas'),
  getCurrentPersonaId:operation('owned-native-personas'),getCurrentPersonaName:operation('owned-native-personas'),
  getPersona:operation('owned-native-personas'),getPersonaAvatarPath:operation('owned-native-personas'),
  createPersona:operation('owned-native-personas'),replacePersona:operation('owned-native-personas'),
  $:operation('owned-native-personas','persona-catalog'),jQuery:operation('owned-native-personas','persona-catalog'),
  fetch:operation('owned-native-personas','avatar-fetch'),
})
/** Methods are selected only after proving the receiver's specific facade kind. */
export const BROWSER_METHODS_V3:Readonly<Partial<Record<BrowserFacadeKindV3,Readonly<Record<string,BrowserOperationV3>>>>>=Object.freeze({
  window:{...BROWSER_APIS_V3,setTimeout:resource,clearTimeout:resource,setInterval:resource,clearInterval:resource,
    requestAnimationFrame:resource,cancelAnimationFrame:resource,addEventListener:event,removeEventListener:event,
    dispatchEvent:event,matchMedia:operation('owned-resource-callbacks','media-query'),
    getComputedStyle:operation('isolated-dom-style','style')},
  helper:BROWSER_APIS_V3,
  document:{createElement:dom,createElementNS:dom,getElementById:dom,querySelector:dom,
    querySelectorAll:operation('isolated-dom-text','nodes'),addEventListener:event,removeEventListener:event},
  node:{appendChild:dom,insertBefore:dom,append:dom,prepend:dom,replaceChildren:dom,replaceWith:dom,after:dom,
    remove:dom,removeChild:dom,replaceChild:dom,setAttribute:dom,getAttribute:operation('isolated-dom-text'),hasAttribute:operation('isolated-dom-text'),removeAttribute:dom,
    querySelector:dom,querySelectorAll:operation('isolated-dom-text','nodes'),closest:dom,
    getBoundingClientRect:operation('isolated-dom-text'),contains:operation('isolated-dom-text'),
    addEventListener:event,removeEventListener:event,dispatchEvent:event,focus:dom,blur:dom,click:event,
    setPointerCapture:event,releasePointerCapture:event,getContext:operation('owned-page-canvas-svg','canvas'),
    createSVGPoint:operation('owned-page-canvas-svg','point'),getScreenCTM:operation('owned-page-canvas-svg','matrix'),
    toDataURL:operation('owned-page-canvas-svg')},
  frame:{remove:operation('owned-page-frame-lifecycle','void'),close:operation('owned-page-frame-lifecycle','void'),
    addEventListener:operation('owned-page-frame-lifecycle','void','event'),
    removeEventListener:operation('owned-page-frame-lifecycle','void','event'),
    setAttribute:operation('owned-page-frame-lifecycle'),getAttribute:operation('owned-page-frame-lifecycle'),
    removeAttribute:operation('owned-page-frame-lifecycle')},
  'frame-parent':{removeChild:{...operation('owned-page-frame-lifecycle','frame'),frameTarget:'receiver-owned-frame'}},
  style:{setProperty:operation('isolated-dom-style'),removeProperty:operation('isolated-dom-style'),
    getPropertyValue:operation('isolated-dom-style'),getPropertyPriority:operation('isolated-dom-style'),
    item:operation('isolated-dom-style')},
  'frame-style':{setProperty:operation('isolated-dom-style'),removeProperty:operation('isolated-dom-style'),
    getPropertyValue:operation('isolated-dom-style'),getPropertyPriority:operation('isolated-dom-style'),
    item:operation('isolated-dom-style')},
  'class-list':{add:operation('isolated-dom-style'),remove:operation('isolated-dom-style'),
    toggle:operation('isolated-dom-style'),contains:operation('isolated-dom-style')},
  event:{preventDefault:event,stopPropagation:event,stopImmediatePropagation:event},
  canvas:{...Object.fromEntries(['measureText','drawImage','scale','clearRect','translate','save','restore','beginPath',
    'closePath','moveTo','lineTo','arc','fill','stroke','fillRect','strokeRect','rotate','setTransform','resetTransform',
    'roundRect','quadraticCurveTo','bezierCurveTo','fillText','strokeText']
    .map(name=>[name,operation('owned-page-canvas-svg')])),
    createLinearGradient:operation('owned-page-canvas-svg','gradient'),
    createRadialGradient:operation('owned-page-canvas-svg','gradient'),getTransform:operation('owned-page-canvas-svg','matrix')},
  gradient:{addColorStop:operation('owned-page-canvas-svg')},
  point:{matrixTransform:operation('owned-page-canvas-svg','point')},
  matrix:{inverse:operation('owned-page-canvas-svg','matrix')},
  audio:{play:operation('owned-page-audio'),pause:operation('owned-page-audio'),load:operation('owned-page-audio'),
    getAttribute:operation('owned-page-audio'),
    addEventListener:event,removeEventListener:event},
  'file-reader':{readAsText:operation('owned-page-file-gesture'),readAsDataURL:operation('owned-page-file-gesture'),
    addEventListener:event,removeEventListener:event,abort:operation('owned-page-file-gesture')},
  observer:{observe:resource,unobserve:resource,disconnect:resource},
  'media-query':{addEventListener:event,removeEventListener:event},
  viewport:{addEventListener:event,removeEventListener:event},
  preferences:{getItem:operation('owned-page-ephemeral-preferences'),setItem:operation('owned-page-ephemeral-preferences'),
    removeItem:operation('owned-page-ephemeral-preferences')},
  url:{createObjectURL:operation('owned-media','object-url'),revokeObjectURL:operation('owned-media','void')},
  tavern:{getContext:operation('owned-persona-snapshot','context'),getCurrentChatId:operation('owned-persona-snapshot')},
  context:{getRequestHeaders:operation('owned-persona-snapshot')},
  'persona-catalog':{find:operation('owned-native-personas','persona-catalog'),
    attr:operation('owned-native-personas'),click:operation('owned-native-personas','persona-catalog')},
  'persona-row':{getAttribute:operation('owned-native-personas'),click:operation('owned-native-personas','void')},
  performance:{now:operation('owned-resource-callbacks')},
})
export const BROWSER_GUEST_INTRINSICS_V3=Object.freeze(['String','Number','Boolean','Array','Object','Math','JSON',
  'Promise','Date','Error','TypeError','RangeError','Map','Set','WeakMap','WeakSet','RegExp','Symbol','BigInt',
  'undefined','NaN','Infinity','parseFloat','parseInt','isFinite','isNaN','encodeURIComponent','decodeURIComponent','console'])
export const BROWSER_ABSENT_PROBES_V3=Object.freeze(['triggerSlash','waitGlobalInitialized',
  'toastr','getRequestHeaders','applyVariable'])
/** Actual server VM bindings are not unknown ordinary Browser callees. Local
 * authored bindings with these names still follow their guest value flow. */
export const BROWSER_SERVER_GLOBALS_V3=Object.freeze(['registerMvuSchema','readSchemaSource',
  'getMvuData','getMvuVariable','getvar'])
/** Dynamic reads stay inside these closed DOM method/property sets. Resource
 * catalogs and window/helper exports retain their separate admission boundary. */
export const BROWSER_CLOSED_DOM_FACADES_V3:readonly BrowserFacadeKindV3[]=Object.freeze([
  'document','node','frame','frame-parent','style','frame-style','dataset','class-list','event','canvas','point','matrix','gradient','context',
])
export const BROWSER_PROPERTIES_V3:Readonly<Partial<Record<BrowserFacadeKindV3,Readonly<Record<string,string>>>>>=Object.freeze({
  window:{name1:'guest',name2:'guest',event_types:'event-map',tavern_events:'event-map'},
  helper:{event_types:'event-map',tavern_events:'event-map',Mvu:'mvu'},
  document:{documentElement:'node',body:'node',head:'node',activeElement:'node',defaultView:'window',readyState:'guest',location:'absent'},
  node:{style:'style',classList:'class-list',ownerDocument:'document',parentNode:'node',parentElement:'node',
    children:'nodes',childNodes:'nodes',firstChild:'node',lastChild:'node',nextSibling:'node',previousSibling:'node',
    nextElementSibling:'node',offsetParent:'node',
    files:'files',dataset:'dataset'},
  frame:{nodeType:'guest',ownerDocument:'document',parentElement:'node',parent:'absent',parentNode:'node',
    style:'frame-style',id:'guest',isConnected:'guest'},
  'frame-parent':{nodeType:'absent',ownerDocument:'absent',parentElement:'absent',parentNode:'absent',parent:'absent'},
  event:{target:'node',currentTarget:'node',detail:'guest',persisted:'guest'},
  context:{name1:'guest',name2:'guest',chatId:'guest',characterId:'guest',characters:'guest',chat:'guest',chatMetadata:'guest-object',
    eventTypes:'event-map',tavern_events:'event-map',Mvu:'mvu'},
  'persona-catalog':{length:'guest'},'persona-row':{dataset:'persona-dataset'},'persona-dataset':{avatarId:'guest'},
  mvu:{events:'mvu-event-map',applyVariable:'missing-mvu-owner'},
})
const capabilities:readonly BrowserCapabilityV3[]=Object.freeze([...new Set([
  ...Object.values(BROWSER_APIS_V3).map(row=>row.capability),
  ...Object.values(BROWSER_METHODS_V3).flatMap(table=>Object.values(table!).map(row=>row.capability)),
  'owned-source-html-page' as const,'owned-numerical-snapshot' as const,
  'owned-numerical-variable-replacement' as const,
])].sort())
const contract={schemaVersion:3 as const,encoding:'native-author-browser-capability-contract-v3' as const,
  authority:'requirements-only' as const,capabilities,getters:'synchronous-owned-snapshot-and-opaque-dom' as const,
  execution:'actual-worker-quickjs-asyncify-shared-contexts' as const,
  writer:'source-fifo-declared-key-with-canonical-ack' as const,modelRequests:'explicit-parent-owned-author-dialog-only' as const}
export const BROWSER_CAPABILITY_CONTRACT_V3:BrowserCapabilityContractV3=Object.freeze({
  ...contract,contractSha256:recordSha256(contract),
})
export const BROWSER_PROFILE_V3=Object.freeze({id:'nexttavern-browser-source-html' as const,version:3 as const,
  sha256:recordSha256({encoding:'native-author-browser-profile-v3',bounds:BROWSER_BOUNDS_V3,
    apis:BROWSER_APIS_V3,methods:BROWSER_METHODS_V3,properties:BROWSER_PROPERTIES_V3,
    guestIntrinsics:BROWSER_GUEST_INTRINSICS_V3,absentProbes:BROWSER_ABSENT_PROBES_V3,
    closedDomFacades:BROWSER_CLOSED_DOM_FACADES_V3,
    serverGlobals:BROWSER_SERVER_GLOBALS_V3,
    globalObject:'window-globalThis-and-bare-name-shared',lexicalGlobals:'classic-global-lexical-environment',
    frame:'carrier-owned-element-and-filtered-renderer-dom',
    ordinaryWriter:'actual-core-attachment-and-admitted-browser-closure-declarations',
    writerPins:'source-data-provenance-only',callbacks:'private-resource-registration',
    pageClose:'owned-dom-resources-only',attachmentClose:'core-revoke-and-runtime-dispose',
    insert:'synchronous-canonical-ack-overlay-both-realms',sourcePage:'proven-captured-resource-only',
    sourceSelectors:'actual-reader-author-id-explicit-id-and-shared-character-tree-data',
    boundaryGuards:'profile-fixed-absence-only',mutationPayload:'single-runtime-json-data-owner',
    numericalInitialization:'actual-nexttavern-replace-owner-current-expected-fifo-four-phases-canonical-ack',
    personas:'source-captured-catalog-selector-and-avatar-ids-only-no-document-authority',
    avatarFetch:'source-owner-exact-post-api-avatars-get-only',requestHeaders:'source-context-json-header-only',
    events:'source-creator-bound-subscriptions-and-finite-constants-only-no-mvu-ended-producer-claim',
    guestComputation:'vm-owned-with-boundary-provenance',dynamicCode:'disabled-before-any-author-realm-entry',
    contract:BROWSER_CAPABILITY_CONTRACT_V3}),
})
