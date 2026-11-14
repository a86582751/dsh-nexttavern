// Generated from runtime/alpha3/src/core/tavern-template-ejs-runtime-types.mts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
import { TEMPLATE_LIMITS_V1 } from './tavern-template-data.mjs';
/** Source catalogue capacity, actor transport capacity and final HTML capacity
 * are independent owners. VM execution limits remain the existing limits. */
export const EJS_READER_RENDER_POLICY_V1 = Object.freeze({ id: 'reader-render-v1',
    sourceBytes: 2_000_000, cumulativeSourceBytes: TEMPLATE_LIMITS_V1.workerInputBytes,
    cumulativeCompiledBytes: TEMPLATE_LIMITS_V1.workerInputBytes,
    htmlBytes: 8 * 1_048_576, packetBytes: TEMPLATE_LIMITS_V1.workerInputBytes,
    effects: 'refused' });
export const EJS_READER_RENDER_POLICY_SHA256 = recordSha256(EJS_READER_RENDER_POLICY_V1);
export const EJS_READER_REGEX_PHASE_POLICY_V1 = Object.freeze({ ...EJS_READER_RENDER_POLICY_V1,
    id: 'reader-regex-phase-v1', effects: 'regex-only' });
export const EJS_READER_REGEX_PHASE_POLICY_SHA256 = recordSha256(EJS_READER_REGEX_PHASE_POLICY_V1);
export const EJS_RUNTIME_PACKAGE = 'dsh-nexttavern-template-runtime-v3';
export const EJS_RUNTIME_VERSION = '0.1.0';
export const EJS_RUNTIME_POLICY = Object.freeze({ schemaVersion: 1, factory: 'template-ejs-v1',
    compiler: 'ejs-3.1.10', quickjs: '0.32.0', execution: 'retained-actor-realms',
    maxActors: 4, actorOldGenerationMiB: 128, programCapacity: 'registry-owner',
    replay: 'creation-and-ordered-action-deltas', publication: 'consumer-data-only' });
