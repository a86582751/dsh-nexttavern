/** Browser2 bounds the actual Worker; AST admission preserves original JS. */
import {recordSha256} from './roleplay-data.js'
import type {BrowserCapabilityContractV2,BrowserCapabilityV2} from './tavern-author-browser-types-v2.mjs'
import {BROWSER_DOM_METHODS_V2,BROWSER_TAGS_V2,BROWSER_SEMANTIC_EVENTS_V2} from './tavern-author-browser-child-v2.js'
export {BROWSER_DOM_METHODS_V2,BROWSER_TAGS_V2,BROWSER_SEMANTIC_EVENTS_V2} from './tavern-author-browser-child-v2.js'

export const BROWSER_BOUNDS_V2=Object.freeze({scripts:64,sourceBytes:1_048_576,
  programBytes:16*1_048_576,syntaxNodes:131_072,syntaxDepth:128,
  memoryBytes:32*1_048_576,stackBytes:1_048_576,parentDeadlineMs:15_000})
export const BROWSER_CAPABILITIES_V2:readonly BrowserCapabilityV2[]=Object.freeze([
  'isolated-dom-text','isolated-dom-events','isolated-dom-style','isolated-dom-canvas',
  'owned-media','owned-resource-callbacks','owned-persona-snapshot','owned-variable-snapshot',
  'owned-message-snapshot','owned-numerical-snapshot','owned-numerical-player-save',
  'owned-chat-key-update','owned-generation-callbacks','owned-prompt-effects','owned-generate-raw-gesture',
  'owned-script-source-resources','owned-named-worldbooks','owned-native-personas',
])
const contract={schemaVersion:2 as const,encoding:'native-author-browser-capability-contract-v2' as const,
  authority:'requirements-only' as const,capabilities:BROWSER_CAPABILITIES_V2,
  getters:'synchronous-owned-snapshot-and-opaque-dom' as const,
  execution:'actual-worker-quickjs-asyncify' as const,
  writer:'parent-owned-operation-and-proven-chat-key' as const,
  modelRequests:'explicit-parent-owned-author-dialog-only' as const}
export const BROWSER_CAPABILITY_CONTRACT_V2:BrowserCapabilityContractV2=Object.freeze({
  ...contract,contractSha256:recordSha256(contract),
})
export const BROWSER_GLOBALS_V2=Object.freeze([
  'window','parent','document','root','Image','URL','MutationObserver','ResizeObserver',
  'localStorage','SillyTavern','Event','CustomEvent','structuredClone','encodeURIComponent','decodeURIComponent',
  'setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame',
  'eventOn','eventMakeFirst','eventRemoveListener','tavern_events','getVariables','getChatMessages',
  'getScriptId','getScriptTrees','TavernHelper',
  'getWorldbookNames','getWorldbook','createWorldbookEntries','deleteWorldbookEntries',
  'getCurrentCharPrimaryLorebook','getCharWorldbookNames',
  'updateWorldbookWith','replaceWorldbook',
  'getPersonaIds','getPersonaNames','getCurrentPersonaId','getCurrentPersonaName','getPersona',
  'getPersonaAvatarPath','createPersona','replacePersona','jQuery','$','fetch',
  'updateVariablesWith','injectPrompts','uninjectPrompts','generateRaw','NextTavern',
  'String','Number','Boolean','JSON','Object','Array','Map','Set','WeakMap','WeakSet',
  'Promise','Math','Date','RegExp','Error','TypeError','RangeError','Symbol','BigInt',
  'parseFloat','parseInt','isNaN','isFinite','undefined','NaN','Infinity','console',
])
export const BROWSER_UNAVAILABLE_HOSTS_V2=Object.freeze([
  'top','self','global','globalThis','frames','opener','navigator','location',
  'XMLHttpRequest','WebSocket','Worker','SharedWorker','importScripts','indexedDB',
  'process','require','module','exports','getMvuData','replaceVariables',
  'setChatMessages','createChatMessages','deleteChatMessages','triggerSlash',
  'deletePersona','createOrReplacePersona','updatePersonaWith','setUserAvatar',
])
export const BROWSER_PROFILE_V2=Object.freeze({id:'nexttavern-browser-worker-opaque-dom' as const,version:2 as const,
  sha256:recordSha256({encoding:'native-author-browser-profile-v2',bounds:BROWSER_BOUNDS_V2,
    globals:BROWSER_GLOBALS_V2,unavailableHosts:BROWSER_UNAVAILABLE_HOSTS_V2,
    domMethods:BROWSER_DOM_METHODS_V2,tags:BROWSER_TAGS_V2,events:BROWSER_SEMANTIC_EVENTS_V2,
    contract:BROWSER_CAPABILITY_CONTRACT_V2,originalSource:'not-rewritten',chatUpdate:'single-proven-key',
    asyncClosure:'live-worker-registry',termination:'main-parent-actual-Worker.terminate'})})
