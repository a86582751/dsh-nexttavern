// Generated from runtime/alpha3/src/core/reader-regex-document-profile-v1.mts; edit the TypeScript source.
/** Reader-specific absent-global semantics are compile DATA and identity.
 * QuickJS supplies no indexedDB binding: original author catch code handles
 * the actual ReferenceError. This grants no database or persistence facade. */
import { recordSha256 } from './roleplay-data.js';
import { READER_PAGE_AST_APIS_V3 } from './tavern-author-browser-profile-v3.mjs';
/** Reader origin reads do not alter the shared Author Profile4/5/6 tables. */
export const READER_REGEX_DOCUMENT_PAGE_APIS_V1 = Object.freeze({ ...READER_PAGE_AST_APIS_V3,
    apis: Object.freeze({ ...READER_PAGE_AST_APIS_V3.apis,
        getCurrentMessageId: Object.freeze({ capability: 'owned-message-snapshot', returns: 'guest' }) }) });
const body = { id: 'nexttavern-reader-regex-document', version: 2,
    absentGlobals: ['indexedDB'], sourceReads: 'captured-source-and-selected-native-scope-frame',
    writes: 'none', modelRequests: 'none', pageApis: READER_REGEX_DOCUMENT_PAGE_APIS_V1,
    inlineModules: { linkage: 'none', topLevelAwait: false, evaluation: 'quickjs-module',
        timing: 'parser-ended-before-dom-content-loaded' },
    mvuReady: 'captured-numerical-state-ready', mvuUpdate: 'selected-published-state-snapshot' };
export const READER_REGEX_DOCUMENT_PROFILE_V1 = Object.freeze({
    ...body, sha256: recordSha256(body)
});
/** Shared DOM/media/event receiver contracts stay with their real owners.
 * No Source write, generation, script-self or unrelated account API is added. */
export const READER_REGEX_DOCUMENT_CAPABILITIES_V1 = Object.freeze([
    'isolated-dom-text', 'isolated-dom-events', 'isolated-dom-style', 'owned-variable-snapshot',
    'owned-message-snapshot', 'owned-persona-snapshot', 'owned-numerical-snapshot', 'owned-resource-callbacks',
    'owned-media', 'owned-source-html-page', 'owned-synchronous-page-events', 'owned-page-canvas-svg',
    'owned-page-audio', 'owned-page-ephemeral-preferences', 'owned-page-file-gesture',
    'owned-page-frame-lifecycle',
]);
