/** Reader-specific absent-global semantics are compile DATA and identity.
 * QuickJS supplies no indexedDB binding: original author catch code handles
 * the actual ReferenceError. This grants no database or persistence facade. */
import {recordSha256} from './roleplay-data.js'
import type {BrowserCapabilityV3} from './tavern-author-browser-types-v3.mjs'
import type {ReaderRegexDocumentProfileV1} from './reader-regex-document-types.mjs'
import {READER_PAGE_AST_APIS_V3} from './tavern-author-browser-profile-v3.mjs'

const body={id:'nexttavern-reader-regex-document' as const,version:2 as const,
  absentGlobals:['indexedDB'] as const,sourceReads:'captured-source-and-selected-native-scope-frame' as const,
  writes:'none' as const,modelRequests:'none' as const,pageApis:READER_PAGE_AST_APIS_V3,
  inlineModules:{linkage:'none',topLevelAwait:false,evaluation:'quickjs-module',
    timing:'parser-ended-before-dom-content-loaded'},
  mvuReady:'captured-numerical-state-ready',mvuUpdate:'selected-published-state-snapshot'}
export const READER_REGEX_DOCUMENT_PROFILE_V1:ReaderRegexDocumentProfileV1=Object.freeze({
  ...body,sha256:recordSha256(body)})
/** Shared DOM/media/event receiver contracts stay with their real owners.
 * No Source write, generation, script-self or unrelated account API is added. */
export const READER_REGEX_DOCUMENT_CAPABILITIES_V1:readonly BrowserCapabilityV3[]=Object.freeze([
  'isolated-dom-text','isolated-dom-events','isolated-dom-style','owned-variable-snapshot',
  'owned-message-snapshot','owned-persona-snapshot','owned-numerical-snapshot','owned-resource-callbacks',
  'owned-media','owned-source-html-page','owned-synchronous-page-events','owned-page-canvas-svg',
  'owned-page-audio','owned-page-ephemeral-preferences','owned-page-file-gesture',
  'owned-page-frame-lifecycle',
])
