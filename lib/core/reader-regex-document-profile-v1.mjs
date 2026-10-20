// Generated from runtime/alpha3/src/core/reader-regex-document-profile-v1.mts; edit the TypeScript source.
/** Reader-specific absent-global semantics are compile DATA and identity.
 * QuickJS supplies no indexedDB binding: original author catch code handles
 * the actual ReferenceError. This grants no database or persistence facade. */
import { recordSha256 } from './roleplay-data.js';
const body = { id: 'nexttavern-reader-regex-document', version: 1,
    absentGlobals: ['indexedDB'], sourceReads: 'captured-source-and-selected-native-scope-frame',
    writes: 'none', modelRequests: 'none' };
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
