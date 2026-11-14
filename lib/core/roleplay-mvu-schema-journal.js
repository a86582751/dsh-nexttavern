// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-journal.ts; edit the TypeScript source.
/** Owned Domain execution facts. Numerical commits never select this history;
 * accepted and completed refused guest steps have the same ordering contract. */
import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { recordSha256, stableJson } from './roleplay-data.js';
import { cloneSchemaDescriptorEnvelopeV4, cloneSchemaValues, schemaDescriptorEnvelopeSequenceClonerV4 } from './tavern-mvu-schema-data.js';
import { validateSchemaProgramV4 } from './tavern-mvu-schema-program-v4.js';
import { validateCombinedAuthorProgram } from './tavern-author-combined-data.mjs';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
import { COMBINED_AUTHOR_DATA_BOUNDS_V8 } from './tavern-author-combined-types-v8.mjs';
import { validateSchemaEvaluationInputV4, validateSchemaGuestOutputV4, assertSchemaGuestOutputBindingsV4, validateSchemaScopeProgramFrameV4, validateSchemaScopeProgramViewV2 } from './tavern-mvu-schema-runner-v4.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
import { validateMvuScopeReadRefV2, validateMvuScopeObjectV2, scopeObjectRefV2, createMvuScopeViewResolverV2 } from './tavern-mvu-scope-view-v2.js';
export const isSchemaBrowserDispatch = (row) => row.encoding === 'native-author-browser-hook-dispatch-v5';
export const isSchemaBrowserCompletion = (row) => row.encoding === 'native-author-browser-hook-completion-v5';
const isBrowser = (row) => isSchemaBrowserDispatch(row) || isSchemaBrowserCompletion(row);
const matchingWire = (record, epoch) => record.schemaVersion === epoch.schemaVersion
    && (isBrowser(record) || scopeRefRecord(record) === scopeRefRecord(epoch));
function isEpoch(row) {
    return row.encoding === 'native-mvu-schema-epoch-v4'
        || row.encoding === 'native-mvu-schema-epoch-v5' || row.encoding === 'native-mvu-schema-epoch-v5-scope-ref-v2';
}
function isDispatch(row) {
    return row.encoding === 'native-mvu-schema-dispatch-v4'
        || row.encoding === 'native-mvu-schema-dispatch-v5' || row.encoding === 'native-mvu-schema-dispatch-v5-scope-ref-v2';
}
function isCompletion(row) {
    return row.encoding === 'native-mvu-schema-completion-v4'
        || row.encoding === 'native-mvu-schema-completion-v5' || row.encoding === 'native-mvu-schema-completion-v5-scope-ref-v2';
}
function isUnavailable(row) {
    return row.encoding === 'native-mvu-schema-unavailable-v4'
        || row.encoding === 'native-mvu-schema-unavailable-v5' || row.encoding === 'native-mvu-schema-unavailable-v5-scope-ref-v2';
}
function scopeRefRecord(row) { return row.encoding.endsWith('-v5-scope-ref-v2'); }
export const isSchemaBrowserFacts = (entry) => isSchemaBrowserDispatch(entry.dispatch);
/** Execution projections consume an already validated epoch. Host identity
 * never substitutes for its retained real server program or v4 load frame. */
export function schemaEpochExecution(epoch) {
    return epoch.schemaVersion === 5 ? { program: epoch.program.serverProgram, runner: epoch.server.executor.runner,
        loadFrame: epoch.server.loadFrame, loadAnchorSha256: epoch.server.loadAnchorSha256 } : epoch;
}
export function schemaEpochAuthorIdentity(epoch) {
    return epoch.schemaVersion === 5 ? { programSha256: epoch.program.combinedProgramSha256,
        sourceSha256: epoch.program.original.source.sourceSha256 } :
        { programSha256: epoch.program.programSha256, sourceSha256: epoch.program.source.sourceSha256 };
}
export function isAuthorHostJournalReadyV5(ready) {
    return ready.epoch.schemaVersion === 5;
}
export const schemaJournalServerTailSha256 = (ready) => 'serverTailSha256' in ready ? ready.serverTailSha256 : ready.tailSha256;
export const schemaJournalHostFrontierSha256 = (ready) => 'hostFrontierSha256' in ready ? ready.hostFrontierSha256 : ready.frontierSha256;
export const SCHEMA_JOURNAL_BOUNDS = Object.freeze({
    bytes: COMBINED_AUTHOR_DATA_BOUNDS_V8.descriptorBytes + MVU_SCHEMA_BOUNDS.inputBytes + MVU_SCHEMA_BOUNDS.outputBytes + 131072
});
// Journal records and frozen cuts contain the complete Combined6 descriptor.
// Its DATA budget belongs here; individual server execution frames keep ABI4's
// existing limits, and Source material remains separately owned by its codec.
const bounds = { nodes: COMBINED_AUTHOR_DATA_BOUNDS_V8.descriptorNodes,
    depth: COMBINED_AUTHOR_DATA_BOUNDS_V8.descriptorDepth,
    arrayLength: COMBINED_AUTHOR_DATA_BOUNDS_V8.descriptorArrayLength };
const same = (a, b) => recordSha256(a) === recordSha256(b);
const hash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const id = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const integer = (v, min = 0) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && !Object.is(v, -0);
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'SCHEMA_JOURNAL_UNPROVEN';
function fail(code) { throw Error(code); }
/** Exclusive Native prefixes use the existing recordSha256(array) bytes.
 * Each event is serialized once per snapshot; copies add only the closing
 * bracket. No hash state survives this call or substitutes for actual reads. */
export function schemaNativePrefixSha256(events, cuts, owned) {
    for (const cut of cuts)
        if (!integer(cut) || cut > events.length)
            fail('SCHEMA_NATIVE_CUT_INVALID');
    const selected = new Set([...cuts, events.length]);
    const accepted = owned?.(events, [...selected]);
    if (accepted)
        return accepted;
    const digest = createHash('sha256').update('[', 'utf8'), prefixes = new Map();
    if (selected.has(0))
        prefixes.set(0, digest.copy().update(']', 'utf8').digest('hex'));
    for (let index = 0; index < events.length; index++) {
        if (index)
            digest.update(',', 'utf8');
        // Match stableJson's Array.map/join semantics, including undefined and
        // sparse slots, rather than introducing a second serialization protocol.
        digest.update(index in events ? (stableJson(events[index]) ?? '') : '', 'utf8');
        if (selected.has(index + 1))
            prefixes.set(index + 1, digest.copy().update(']', 'utf8').digest('hex'));
    }
    return prefixes;
}
/** One cut keeps the existing raw canonical fallback; genuine Native cuts
 * consume the single history owner's already established exact identity. */
export function schemaNativeCutSha256(events, cut = events.length, owned) {
    return owned?.(events, [cut])?.get(cut)
        ?? recordSha256(cut === events.length ? events : events.slice(0, cut));
}
function exact(value, keys) {
    if (!same(Object.keys(value).sort(), [...keys].sort()))
        fail('SCHEMA_JOURNAL_SHAPE');
}
export function freezeSchemaJournalData(input) {
    return freezeJournalData(input, cloneSchemaDescriptorEnvelopeV4);
}
function freezeJournalData(input, clone) {
    const value = clone(input, SCHEMA_JOURNAL_BOUNDS.bytes, bounds);
    function freeze(item) {
        // Clone output contains only fresh metadata and this DATA owner's deeply
        // frozen Source material. Repeated material must not be walked per row.
        if (item && typeof item === 'object' && !Object.isFrozen(item)) {
            for (const child of Object.values(item))
                freeze(child);
            Object.freeze(item);
        }
    }
    freeze(value);
    return value;
}
export function sealSchemaJournalRecord(body) {
    const frozen = freezeSchemaJournalData(body);
    return Object.freeze({ ...frozen, recordSha256: recordSha256(frozen) });
}
export function validateSchemaAnchor(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        fail('SCHEMA_ANCHOR_INVALID');
    if (input.kind === 'opening') {
        exact(input, ['kind', 'operationId', 'messageId', 'importId', 'selectedIndex']);
        if (!id(input.operationId) || !id(input.importId) || !integer(input.selectedIndex) || typeof input.messageId !== 'string' || !input.messageId
            || input.messageId.length > 1024)
            fail('SCHEMA_ANCHOR_INVALID');
    }
    else if (input.kind === 'story') {
        exact(input, ['kind', 'preparationId', 'attemptGeneration', 'receiptGeneration', 'turn', 'canonicalSeq', 'messageId', 'messageVersionSha256']);
        if (!id(input.preparationId) || !integer(input.attemptGeneration, 1) || !integer(input.receiptGeneration, 1)
            || !integer(input.turn) || !integer(input.canonicalSeq) || typeof input.messageId !== 'string'
            || !input.messageId.length || input.messageId.length > 1024 || !hash(input.messageVersionSha256))
            fail('SCHEMA_ANCHOR_INVALID');
    }
    else if (input.kind === 'manual') {
        exact(input, ['kind', 'operationId', 'requestSha256', 'observedNativeSeq']);
        if (!id(input.operationId) || !hash(input.requestSha256) || !integer(input.observedNativeSeq, -1))
            fail('SCHEMA_ANCHOR_INVALID');
    }
    else
        fail('SCHEMA_ANCHOR_INVALID');
}
export function validateSchemaSourceCut(input) {
    const value = freezeSchemaJournalData(input);
    exact(value, ['schemaVersion', 'sessionId', 'ownerSessionId', 'nativeCut', 'nativePrefixSha256',
        'sourceSnapshotSha256', 'materialSha256', 'stopGeneration', 'anchor']);
    if (value.schemaVersion !== 1 || !id(value.sessionId) || !id(value.ownerSessionId) || !integer(value.nativeCut)
        || !integer(value.stopGeneration) || ![value.nativePrefixSha256, value.sourceSnapshotSha256, value.materialSha256].every(hash)) {
        fail('SCHEMA_SOURCE_CUT_INVALID');
    }
    validateSchemaAnchor(value.anchor);
    return value;
}
function ref(value) {
    exact(value, ['key', 'sha256']);
    if (typeof value.key !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(value.key) || !hash(value.sha256))
        fail('SCHEMA_JOURNAL_REF_INVALID');
}
function markerRef(value) {
    exact(value, ['seq', 'sha256']);
    if (!integer(value.seq) || !hash(value.sha256))
        fail('SCHEMA_JOURNAL_REF_INVALID');
}
function runnerIdentity(value) {
    exact(value, ['id', 'version', 'implementationSha256', 'quickjsVersion']);
    if (typeof value.id !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value.id)
        || !integer(value.version, 1) || !hash(value.implementationSha256) || value.quickjsVersion !== '0.32.0') {
        fail('SCHEMA_RUNNER_IDENTITY_INVALID');
    }
}
function scopeBinding(input, ownerSessionId, sourceNativeCutSha256) {
    const frame = validateMvuScopeReadFrameV1(input);
    if (frame.source.sessionId !== ownerSessionId || frame.sourceNativeCutSha256 !== sourceNativeCutSha256) {
        fail('SCHEMA_SCOPE_BINDING_INVALID');
    }
    return frame;
}
function loadFrame(value, scopeRef = false) {
    const referenced = value.encoding === 'native-mvu-author-schema-realm-load-v4-scope-ref-v2';
    if (referenced && !scopeRef)
        fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
    exact(value, ['schemaVersion', 'ownerSessionId', 'sourceNativeCutSha256', 'material', 'values', 'context', 'clockEpochMs', 'randomSeed',
        ...(referenced ? ['encoding', 'scopeReadRef'] : ['scopeReadFrame'])]);
    if (value.schemaVersion !== 4 || !id(value.ownerSessionId) || !hash(value.sourceNativeCutSha256)
        || !integer(value.clockEpochMs) || typeof value.randomSeed !== 'string' || !value.randomSeed.length || value.randomSeed.length > 256) {
        fail('SCHEMA_LOAD_FRAME_INVALID');
    }
    cloneSchemaValues(value.values);
    cloneSchemaValues(value.context);
    if (Object.hasOwn(value.context, 'stat_data'))
        fail('SCHEMA_CONTEXT_INVALID');
    if (referenced) {
        const ref = validateMvuScopeReadRefV2(value.scopeReadRef);
        if (ref.sourceNativeCutSha256 !== value.sourceNativeCutSha256)
            fail('SCHEMA_SCOPE_BINDING_INVALID');
    }
    else
        scopeBinding(value.scopeReadFrame, value.ownerSessionId, value.sourceNativeCutSha256);
}
function requested(value, scopeRef = false) {
    exact(value, ['eventId', 'frame']);
    if (typeof value.eventId !== 'string' || !value.eventId.length || value.eventId.length > 256)
        fail('SCHEMA_STEP_INVALID');
    const frame = value.frame;
    exact(frame, ['ownerSessionId', 'sourceNativeCutSha256', 'material', 'input']);
    if (!id(frame.ownerSessionId) || !hash(frame.sourceNativeCutSha256))
        fail('SCHEMA_STEP_INVALID');
    const input = frame.input;
    const validated = validateSchemaEvaluationInputV4(input);
    if (validated.encoding === 'native-mvu-author-schema-phase-input-v4-scope-ref-v2' && !scopeRef) {
        fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
    }
    if (validated.encoding === 'native-mvu-author-schema-phase-input-v4-scope-ref-v2') {
        if (validated.scopeReadRef.sourceNativeCutSha256 !== frame.sourceNativeCutSha256)
            fail('SCHEMA_SCOPE_BINDING_INVALID');
    }
    else
        scopeBinding(validated.scopeReadFrame, frame.ownerSessionId, frame.sourceNativeCutSha256);
}
const partialCodes = new Set(['SCHEMA_VM_TIMEOUT', 'SCHEMA_HARD_TIMEOUT', 'SCHEMA_JOB_LIMIT', 'SCHEMA_ASYNC_UNSETTLED',
    'SCHEMA_OUTPUT_LIMIT', 'SCHEMA_MEMORY_LIMIT', 'SCHEMA_GUEST_ERROR']);
function output(value) {
    validateSchemaGuestOutputV4(value);
    if (value.kind === 'refused' && value.diagnostics.some(item => partialCodes.has(item.code)))
        fail('SCHEMA_PARTIAL_EXECUTION');
}
/** The public wrapper or an admitted container's aggregate clone supplies rows.
 * Keep semantic/hash checks intact while avoiding a second whole-row clone. */
function validateClonedSchemaJournalRecord(row) {
    const common = ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'recordSha256'];
    if (![4, 5].includes(row.schemaVersion) || !id(row.sessionId) || !hash(row.realmEpoch) || !hash(row.recordSha256))
        fail('SCHEMA_JOURNAL_INVALID');
    const { recordSha256: checksum, ...body } = row;
    if (recordSha256(body) !== checksum)
        fail('SCHEMA_JOURNAL_HASH_MISMATCH');
    if (!row.encoding.endsWith(`-v${row.schemaVersion}`) && !(row.schemaVersion === 5 && scopeRefRecord(row))) {
        fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
    }
    if (isEpoch(row)) {
        if (row.schemaVersion === 5) {
            exact(row, [...common, 'host', 'program', 'server']);
            exact(row.host, ['id', 'version', 'implementationSha256']);
            if (row.host.id !== 'native-author-host' || row.host.version !== 5 || !hash(row.host.implementationSha256)) {
                fail('SCHEMA_IMPLEMENTATION_CHANGED');
            }
            const combined = validateCombinedAuthorProgram(row.program), program = combined.serverProgram;
            if (!program)
                fail('SCHEMA_HOST_SERVER_PROGRAM_REQUIRED');
            exact(row.server, ['executor', 'loadFrame', 'loadAnchorSha256']);
            exact(row.server.executor, ['compiler', 'bridge', 'libraries', 'stateLoader', 'runner']);
            const { runner, ...executor } = row.server.executor;
            runnerIdentity(runner);
            loadFrame(row.server.loadFrame, scopeRefRecord(row));
            if (runner.version !== 4 || !same(executor, { compiler: program.compiler, bridge: program.bridge,
                libraries: program.libraries, stateLoader: program.stateLoader }))
                fail('SCHEMA_IMPLEMENTATION_CHANGED');
            if (row.server.loadFrame.encoding !== 'native-mvu-author-schema-realm-load-v4-scope-ref-v2') {
                validateSchemaScopeProgramFrameV4(program, row.server.loadFrame.scopeReadFrame, row.server.loadFrame, true);
            }
            if (row.server.loadFrame.ownerSessionId !== row.sessionId || row.server.loadAnchorSha256 !== recordSha256({
                programSha256: program.programSha256, realmEpoch: row.realmEpoch, loadFrame: row.server.loadFrame
            })) {
                fail('SCHEMA_LOAD_ANCHOR_INVALID');
            }
            // Retain the Combined owner's canonical result. Passing the cloned raw
            // program onward would discard its DATA work before every consumer.
            return Object.freeze({ ...row, program: combined });
        }
        exact(row, [...common, 'program', 'runner', 'loadFrame', 'loadAnchorSha256']);
        runnerIdentity(row.runner);
        loadFrame(row.loadFrame);
        const program = validateSchemaProgramV4(row.program);
        if (program.compiler.version !== 4 || program.bridge.version !== 4 || row.runner.version !== 4)
            fail('SCHEMA_IMPLEMENTATION_CHANGED');
        if (row.loadFrame.encoding !== 'native-mvu-author-schema-realm-load-v4-scope-ref-v2') {
            validateSchemaScopeProgramFrameV4(program, row.loadFrame.scopeReadFrame, row.loadFrame, true);
        }
        if (row.loadFrame.ownerSessionId !== row.sessionId || row.loadAnchorSha256 !== recordSha256({
            programSha256: row.program.programSha256, realmEpoch: row.realmEpoch, loadFrame: row.loadFrame
        }))
            fail('SCHEMA_LOAD_ANCHOR_INVALID');
    }
    else if (isDispatch(row)) {
        exact(row, [...common, 'batchId', 'ordinal', 'epoch', 'previousTailSha256', 'requestedStep', 'sourceNativeCut',
            ...row.schemaVersion === 5 ? ['combinedProgramSha256', 'serverProgramSha256'] : []]);
        if (row.schemaVersion === 5 && ![row.combinedProgramSha256, row.serverProgramSha256].every(hash)) {
            fail('SCHEMA_DISPATCH_INVALID');
        }
        ref(row.epoch);
        requested(row.requestedStep, scopeRefRecord(row));
        validateSchemaSourceCut(row.sourceNativeCut);
        if (!id(row.batchId) || !integer(row.ordinal, 1) || !hash(row.previousTailSha256)
            || row.sourceNativeCut.sessionId !== row.sessionId || row.sourceNativeCut.ownerSessionId !== row.sessionId
            || row.requestedStep.frame.ownerSessionId !== row.sessionId
            || row.requestedStep.frame.sourceNativeCutSha256 !== recordSha256(row.sourceNativeCut)
            || recordSha256(row.requestedStep.frame.material) !== row.sourceNativeCut.materialSha256)
            fail('SCHEMA_DISPATCH_INVALID');
        if (row.requestedStep.frame.input.scopeReadFrame
            && row.requestedStep.frame.input.scopeReadFrame.source.sourceSnapshotSha256 !== row.sourceNativeCut.sourceSnapshotSha256) {
            fail('SCHEMA_SCOPE_BINDING_INVALID');
        }
    }
    else if (isCompletion(row)) {
        exact(row, [...common, 'batchId', 'dispatch', 'dispatchMarker', 'runner', 'step',
            ...row.schemaVersion === 5 ? ['combinedProgramSha256', 'serverProgramSha256'] : []]);
        if (row.schemaVersion === 5 && ![row.combinedProgramSha256, row.serverProgramSha256].every(hash)) {
            fail('SCHEMA_COMPLETION_UNPROVEN');
        }
        ref(row.dispatch);
        markerRef(row.dispatchMarker);
        runnerIdentity(row.runner);
        if (row.runner.version !== 4)
            fail('SCHEMA_IMPLEMENTATION_CHANGED');
        if (!id(row.batchId))
            fail('SCHEMA_JOURNAL_INVALID');
        exact(row.step, ['eventId', 'frameSha256', 'ordinal', 'previousStepSha256', 'output', 'stepSha256']);
        output(row.step.output);
        if (typeof row.step.eventId !== 'string' || !row.step.eventId.length || row.step.eventId.length > 256
            || !integer(row.step.ordinal, 1) || ![row.step.previousStepSha256, row.step.frameSha256, row.step.stepSha256].every(hash)) {
            fail('SCHEMA_STEP_INVALID');
        }
    }
    else if (isSchemaBrowserDispatch(row)) {
        exact(row, [...common, 'batchId', 'epoch', 'previousTailSha256', 'sourceNativeCut', 'request', 'identity']);
        ref(row.epoch);
        validateSchemaSourceCut(row.sourceNativeCut);
        const request = row.request, identity = row.identity;
        if (!id(row.batchId) || !hash(row.previousTailSha256) || row.batchId !== identity.invocationId
            || request.sessionId !== row.sessionId || identity.binding.sessionId !== row.sessionId
            || identity.binding.programSha256 !== identity.programSha256
            || row.sourceNativeCut.sessionId !== row.sessionId || !hash(request.planSha256) || !hash(identity.programSha256)
            || !['command-parsed', 'update-ended', 'before-message-update'].includes(request.stage)
            || !Array.isArray(identity.registrations) || !identity.registrations.length)
            fail('SCHEMA_BROWSER_DISPATCH_INVALID');
    }
    else if (isSchemaBrowserCompletion(row)) {
        exact(row, [...common, 'batchId', 'dispatch', 'dispatchMarker', 'result']);
        ref(row.dispatch);
        markerRef(row.dispatchMarker);
        if (!id(row.batchId) || !['command-parsed', 'update-ended', 'before-message-update'].includes(row.result.stage)
            || !Array.isArray(row.result.diagnostics))
            fail('SCHEMA_BROWSER_COMPLETION_INVALID');
    }
    else if (isUnavailable(row)) {
        exact(row, [...common, 'batchId', 'dispatch', 'sourceNativeCut', 'code',
            ...row.schemaVersion === 5 ? ['combinedProgramSha256'] : []]);
        if (row.schemaVersion === 5 && !hash(row.combinedProgramSha256))
            fail('SCHEMA_UNAVAILABLE_INVALID');
        if (row.dispatch !== null)
            ref(row.dispatch);
        validateSchemaSourceCut(row.sourceNativeCut);
        if (!id(row.batchId) || row.sourceNativeCut.sessionId !== row.sessionId
            || typeof row.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,95}$/.test(row.code))
            fail('SCHEMA_UNAVAILABLE_INVALID');
        if (row.sourceNativeCut.ownerSessionId !== row.sessionId)
            fail('SCHEMA_UNAVAILABLE_INVALID');
    }
    else
        fail('SCHEMA_JOURNAL_SHAPE');
    return row;
}
export function validateSchemaJournalRecord(input) {
    return validateClonedSchemaJournalRecord(freezeSchemaJournalData(input));
}
export const schemaEpochKey = (sid, epoch) => `${sid}__mvu-schema-epoch-${epoch}`;
export const schemaDispatchKey = (sid, epoch, batch) => `${sid}__mvu-schema-dispatch-${epoch}-${batch}`;
export const schemaCompletionKey = (sid, epoch, batch) => `${sid}__mvu-schema-completion-${epoch}-${batch}`;
export const schemaUnavailableKey = (sid, epoch, batch) => `${sid}__mvu-schema-unavailable-${epoch}-${batch}`;
export function schemaJournalKey(row) {
    if (isEpoch(row))
        return schemaEpochKey(row.sessionId, row.realmEpoch);
    if (isDispatch(row) || isSchemaBrowserDispatch(row))
        return schemaDispatchKey(row.sessionId, row.realmEpoch, row.batchId);
    if (isCompletion(row) || isSchemaBrowserCompletion(row))
        return schemaCompletionKey(row.sessionId, row.realmEpoch, row.batchId);
    return schemaUnavailableKey(row.sessionId, row.realmEpoch, row.batchId);
}
const reference = (row) => ({ key: schemaJournalKey(row), sha256: row.recordSha256 });
/** Call-local immutable row grammar/key/checksum facts from actual owner reads,
 * never Native authority. Raw containers receive their complete DATA parse. */
class CheckedRows {
    records;
    constructor(records) {
        this.records = records;
    }
}
class BoundedRows {
    records;
    constructor(records) {
        this.records = records;
    }
}
/** History is a sequence of individually bounded records, not one execution
 * payload. Keep the existing row codec; a long SID must not consume its whole
 * lifetime budget at the 513th row. The enclosing Source/inheritance owner
 * retains its own transport budget. */
function journalArray(input) {
    if (types.isProxy(input))
        fail('SCHEMA_PROXY_VALUE');
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype)
        fail('SCHEMA_NON_JSON_VALUE');
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Object.getOwnPropertySymbols(input).length)
        fail('SCHEMA_NON_JSON_VALUE');
    const length = descriptors.length.value;
    if (Object.keys(descriptors).length !== length + 1)
        fail('SCHEMA_NON_JSON_VALUE');
    const rows = [];
    for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
            fail('SCHEMA_NON_JSON_VALUE');
        rows.push(descriptor.value);
    }
    return rows;
}
const checkedScopeObjects = new WeakSet();
function scopeObject(input) {
    if (input && typeof input === 'object' && checkedScopeObjects.has(input))
        return input;
    if (types.isProxy(input) || !input || typeof input !== 'object' || Array.isArray(input)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.getOwnPropertySymbols(input).length) {
        fail('SCOPE_VIEW_DATA_INVALID');
    }
    const fields = Object.getOwnPropertyDescriptors(input);
    if (Object.keys(fields).length !== 2 || ['ref', 'object'].some(key => !fields[key]?.enumerable || !Object.hasOwn(fields[key], 'value'))) {
        fail('SCOPE_VIEW_DATA_INVALID');
    }
    const ref = freezeSchemaJournalData(fields.ref.value);
    exact(ref, ['ownerSessionId', 'key', 'sha256']);
    const object = validateMvuScopeObjectV2(fields.object.value), actual = scopeObjectRefV2(ref.ownerSessionId, ref.key, object);
    if (actual.sha256 !== ref.sha256)
        fail('SCOPE_VIEW_OBJECT_HASH_MISMATCH');
    const result = Object.freeze({ ref: actual, object });
    checkedScopeObjects.add(result);
    return result;
}
const scopeAddress = (ref) => JSON.stringify([ref.ownerSessionId, ref.key, ref.sha256]);
function* scopeDependencies(object) {
    if (object.encoding === 'native-mvu-scope-base-v2') {
        yield object.scopes.chat;
        yield object.scopes.character;
        yield object.scopes.global;
        for (const script of object.scripts)
            yield script.valueRef;
        for (const message of object.messages)
            yield message.valueRef;
    }
    else if (object.encoding === 'native-mvu-scope-delta-v2') {
        yield object.baseRef;
        yield object.previousRef;
        for (const change of object.changes) {
            if (change.kind === 'scope')
                yield change.valueRef;
            else if (change.kind === 'script-upsert')
                yield change.script.valueRef;
            else if (change.kind === 'message-splice')
                for (const message of change.messages)
                    yield message.valueRef;
        }
    }
}
/** A frozen cut resolves its retained objects and an optional retained execution
 * baseline. Neither reader can acquire a live ancestor table. */
export function createSchemaJournalScopeClosure(objects, inherited) {
    const rows = new Map(objects.map(input => { const row = scopeObject(input); return [scopeAddress(row.ref), row]; })), resolvers = new Map();
    const readObject = (ref) => rows.get(scopeAddress(ref)) ?? inherited?.readObject(ref);
    const read = (ref) => {
        const row = readObject(ref);
        if (!row)
            fail('SCOPE_VIEW_OBJECT_MISSING');
        return row.object;
    };
    const readScopeReferences = (program, ref, binding, load) => {
        const base = scopeAddress(ref.baseRef);
        let resolver = resolvers.get(base);
        if (!resolver)
            resolvers.set(base, resolver = createMvuScopeViewResolverV2({ read }));
        const resolved = resolver.resolve(ref);
        validateSchemaScopeProgramViewV2(program, resolved.view, resolved.scripts(), binding, load);
        if (resolved.realmEpoch !== binding.realmEpoch
            || resolved.view.source.sourceSnapshotSha256 !== binding.sourceSnapshotSha256)
            fail('SCHEMA_SCOPE_BINDING_INVALID');
    };
    return { readObject, readScopeReferences, has: (ref) => !!readObject(ref.baseRef) && !!readObject(ref.tailRef),
        captureScopeObjects(refs) {
            const seen = new Set(), selected = [];
            for (const ref of refs) {
                const pending = [ref.baseRef, ref.tailRef];
                while (pending.length) {
                    const reference = pending.pop(), key = scopeAddress(reference);
                    if (seen.has(key))
                        continue;
                    const row = readObject(reference);
                    if (!row)
                        fail('SCOPE_VIEW_OBJECT_MISSING');
                    seen.add(key);
                    selected.push(row);
                    for (const dependency of scopeDependencies(row.object))
                        pending.push(dependency);
                }
            }
            return Object.freeze(selected);
        } };
}
function* recordScopeRefs(records) {
    for (const { record } of records) {
        if (isEpoch(record)) {
            const frame = schemaEpochExecution(record).loadFrame;
            if (frame.schemaVersion === 4 && frame.encoding === 'native-mvu-author-schema-realm-load-v4-scope-ref-v2')
                yield frame.scopeReadRef;
        }
        else if (isDispatch(record)) {
            const input = record.requestedStep.frame.input;
            if (input.schemaVersion === 4 && input.encoding === 'native-mvu-author-schema-phase-input-v4-scope-ref-v2')
                yield input.scopeReadRef;
        }
    }
}
function frozenScopeObjects(records, captureScopeObjects) {
    const refs = [...recordScopeRefs(records)];
    if (!refs.length)
        return Object.freeze([]);
    if (!captureScopeObjects)
        fail('SCHEMA_SCOPE_REFERENCE_UNPROVEN');
    const objects = captureScopeObjects(refs);
    return createSchemaJournalScopeClosure(objects).captureScopeObjects(refs);
}
const frozenJournalCuts = new WeakSet();
function frozenKeys(frozen) {
    return ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'nativeCut', 'nativePrefixSha256', 'records', 'frontierSha256',
        ...(frozen.schemaVersion !== 1 ? ['revisions'] : []), ...(frozen.schemaVersion >= 3 ? ['scopeObjects'] : []),
        ...(frozen.schemaVersion === 4 ? ['executionBaseline'] : [])];
}
function frozenEncoding(frozen) {
    return frozen.schemaVersion === 1 && frozen.encoding === 'native-mvu-schema-frozen-cut-v1'
        || frozen.schemaVersion === 2 && frozen.encoding === 'native-mvu-schema-frozen-cut-v2'
        || frozen.schemaVersion === 3 && frozen.encoding === 'native-mvu-schema-frozen-cut-v3'
        || frozen.schemaVersion === 4 && frozen.encoding === 'native-mvu-schema-frozen-cut-v4';
}
export function freezeSchemaJournalCut(input) {
    if (frozenJournalCuts.has(input))
        return input;
    if (types.isProxy(input))
        fail('SCHEMA_PROXY_VALUE');
    const descriptors = Object.getOwnPropertyDescriptors(input), rows = descriptors.records, objects = descriptors.scopeObjects;
    if (!rows || !Object.hasOwn(rows, 'value'))
        fail('SCHEMA_NON_JSON_VALUE');
    if (objects && !Object.hasOwn(objects, 'value'))
        fail('SCHEMA_NON_JSON_VALUE');
    // Preserve every metadata descriptor so the JSON codec rejects accessors and
    // unknown fields as before without executing a caller's getter.
    const metadata = Object.create(Object.getPrototypeOf(input), { ...descriptors,
        records: { ...rows, value: [] }, ...(objects ? { scopeObjects: { ...objects, value: [] } } : {}) });
    const clone = schemaDescriptorEnvelopeSequenceClonerV4();
    const frozen = freezeJournalData(metadata, clone);
    const cut = Object.freeze({ ...frozen, records: Object.freeze(journalArray(rows.value)
            .map(row => freezeJournalData(row, clone))),
        ...(objects ? { scopeObjects: Object.freeze(journalArray(objects.value).map(scopeObject)) } : {}) });
    // DATA ownership only: Native joins and persisted checksums are still
    // validated on every new capture. External Object.freeze cannot mint it.
    frozenJournalCuts.add(cut);
    return cut;
}
// The association belongs to this concrete read result, never a persisted cut
// or a raw/copy/frozen DTO. Its rows have already paid their complete DATA parse.
const checkedJournalRows = Symbol('checked-schema-journal-rows');
function rowsForReady(ready) {
    const rows = Object.getOwnPropertyDescriptor(ready, checkedJournalRows)?.value;
    if (!(rows instanceof CheckedRows))
        fail('SCHEMA_CHECKED_JOURNAL_REQUIRED');
    return rows;
}
function scopeProgram(program, input, binding, readScopeReferences) {
    if (input.encoding === 'native-mvu-author-schema-phase-input-v4-scope-ref-v2') {
        if (!readScopeReferences)
            fail('SCHEMA_SCOPE_REFERENCE_UNPROVEN');
        readScopeReferences(program, input.scopeReadRef, binding, false);
    }
    else
        validateSchemaScopeProgramFrameV4(program, input.scopeReadFrame, binding);
}
function scopeLoad(epoch, readScopeReferences) {
    if (epoch.schemaVersion !== 5)
        return;
    const frame = epoch.server.loadFrame;
    if (frame.encoding !== 'native-mvu-author-schema-realm-load-v4-scope-ref-v2')
        return;
    if (!readScopeReferences)
        fail('SCHEMA_SCOPE_REFERENCE_UNPROVEN');
    const program = epoch.program.serverProgram;
    readScopeReferences(program, frame.scopeReadRef, { realmEpoch: epoch.realmEpoch, ownerSessionId: frame.ownerSessionId,
        sourceNativeCutSha256: frame.sourceNativeCutSha256, sourceSnapshotSha256: program.source.sourceSnapshotSha256 }, true);
}
function joinBrowserDispatch(event, row, context, nativePrefix) {
    if (!row || !isSchemaBrowserDispatch(row) || context.epoch.schemaVersion !== 5
        || row.identity.programSha256 !== context.epoch.program.nativeProgram?.programSha256
        || !same(row.epoch, context.epochRef) || row.previousTailSha256 !== context.tail
        || row.recordSha256 !== event.data.dispatchRecordSha256 || event.data.previousTailSha256 !== context.tail
        || row.sourceNativeCut.nativeCut !== event.seq || row.sourceNativeCut.nativePrefixSha256 !== nativePrefix
        || event.data.programSha256 !== schemaEpochAuthorIdentity(context.epoch).programSha256
        || event.data.sourceSha256 !== schemaEpochAuthorIdentity(context.epoch).sourceSha256)
        fail('SCHEMA_BROWSER_DISPATCH_UNPROVEN');
    return { dispatch: row, dispatchRef: reference(row), dispatchMarker: { seq: event.seq, sha256: recordSha256(event) } };
}
function joinBrowserCompletion(event, row, pending, tail) {
    if (!row || !isSchemaBrowserCompletion(row) || !same(row.dispatch, pending.dispatchRef)
        || !same(row.dispatchMarker, pending.dispatchMarker) || row.batchId !== pending.dispatch.batchId
        || row.result.stage !== pending.dispatch.request.stage || row.recordSha256 !== event.data.completionRecordSha256
        || event.data.dispatchRecordSha256 !== pending.dispatchRef.sha256 || event.data.dispatchSeq !== pending.dispatchMarker.seq
        || event.data.completedTailSha256 !== tail)
        fail('SCHEMA_BROWSER_COMPLETION_UNPROVEN');
    return Object.freeze({ ...pending, completion: row, completionRef: reference(row),
        completionMarker: { seq: event.seq, sha256: recordSha256(event) } });
}
function joinDispatch(event, row, context, nativePrefix, seenEvent, inherited = false, readScopeReferences) {
    const { epoch, epochRef, ordinal, tail } = context, marker = event.data, execution = schemaEpochExecution(epoch), authorIdentity = schemaEpochAuthorIdentity(epoch);
    if (!row || !isDispatch(row))
        fail('SCHEMA_DISPATCH_UNPROVEN');
    if (row.schemaVersion !== epoch.schemaVersion || scopeRefRecord(row) !== scopeRefRecord(epoch))
        fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
    if (row.recordSha256 !== marker.dispatchRecordSha256 || !same(row.epoch, epochRef) || row.ordinal !== ordinal
        || row.previousTailSha256 !== tail || marker.previousTailSha256 !== tail
        || marker.programSha256 !== authorIdentity.programSha256 || marker.sourceSha256 !== authorIdentity.sourceSha256
        || marker.loadDescriptorSha256 !== (ordinal === 1 ? epoch.recordSha256 : null)
        || row.sourceNativeCut.nativeCut !== event.seq || row.sourceNativeCut.nativePrefixSha256 !== nativePrefix
        || seenEvent)
        fail('SCHEMA_DISPATCH_UNPROVEN');
    if (ordinal === 1 && !context.executionOffset && !same(execution.loadFrame.sourceNativeCutSha256, row.requestedStep.frame.sourceNativeCutSha256)) {
        fail('SCHEMA_LOAD_BOUNDARY_INVALID');
    }
    if (row.schemaVersion === 4) {
        if (epoch.schemaVersion !== 4)
            fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
        if (!inherited)
            scopeProgram(epoch.program, row.requestedStep.frame.input, { ...row.requestedStep.frame, realmEpoch: row.realmEpoch, sourceSnapshotSha256: row.sourceNativeCut.sourceSnapshotSha256 }, readScopeReferences);
    }
    if (row.schemaVersion === 5) {
        if (epoch.schemaVersion !== 5)
            fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
        if (row.combinedProgramSha256 !== epoch.program.combinedProgramSha256
            || row.serverProgramSha256 !== epoch.program.serverProgram.programSha256)
            fail('SCHEMA_DISPATCH_UNPROVEN');
        if (!inherited)
            scopeProgram(epoch.program.serverProgram, row.requestedStep.frame.input, { ...row.requestedStep.frame, realmEpoch: row.realmEpoch, sourceSnapshotSha256: row.sourceNativeCut.sourceSnapshotSha256 }, readScopeReferences);
    }
    return { dispatch: row, dispatchRef: reference(row), dispatchMarker: { seq: event.seq, sha256: recordSha256(event) } };
}
function joinCompletion(event, row, pending, context, recordOwner, inheritedStep) {
    if (!pending || !row || !isCompletion(row))
        fail('SCHEMA_COMPLETION_UNPROVEN');
    const { epoch, ordinal, tail } = context, execution = schemaEpochExecution(epoch), marker = event.data, dispatch = pending.dispatch;
    if (row.schemaVersion !== epoch.schemaVersion || scopeRefRecord(row) !== scopeRefRecord(epoch))
        fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
    if (row.recordSha256 !== marker.completionRecordSha256 || !same(row.runner, execution.runner) || !same(row.dispatch, pending.dispatchRef)
        || !same(row.dispatchMarker, pending.dispatchMarker) || marker.dispatchSeq !== pending.dispatchMarker.seq
        || marker.dispatchRecordSha256 !== dispatch.recordSha256 || row.step.ordinal !== (context.executionOffset ?? 0) + ordinal
        || row.step.previousStepSha256 !== tail || row.step.eventId !== dispatch.requestedStep.eventId
        || (!inheritedStep && row.step.frameSha256 !== (recordOwner?.dispatchFrameSha256?.(dispatch)
            ?? recordSha256(dispatch.requestedStep.frame)))
        || marker.completedTailSha256 !== row.step.stepSha256)
        fail('SCHEMA_COMPLETION_UNPROVEN');
    if (row.schemaVersion === 5 && (epoch.schemaVersion !== 5 || row.combinedProgramSha256 !== epoch.program.combinedProgramSha256
        || row.serverProgramSha256 !== epoch.program.serverProgram.programSha256))
        fail('SCHEMA_COMPLETION_UNPROVEN');
    let step;
    if (inheritedStep)
        step = inheritedStep.step;
    else {
        const { frameSha256: _frameHash, ...receipt } = row.step;
        step = { ...receipt, frame: dispatch.requestedStep.frame };
        assertSchemaGuestOutputBindingsV4(step.output, epoch.schemaVersion === 5 ? epoch.program.serverProgram : epoch.program, dispatch.requestedStep.frame.input);
        if ((recordOwner?.fullStepSha256?.(row, dispatch)
            ?? schemaJournalFullStepSha256(row, dispatch)) !== step.stepSha256)
            fail('SCHEMA_COMPLETION_UNPROVEN');
    }
    return { ...pending, completion: row, completionRef: reference(row), step,
        completionMarker: { seq: event.seq, sha256: recordSha256(event) } };
}
function freezeStepFacts(step) {
    Object.freeze(step.dispatchRef);
    Object.freeze(step.completionRef);
    Object.freeze(step.dispatchMarker);
    Object.freeze(step.completionMarker);
    Object.freeze(step.step);
    return Object.freeze(step);
}
function revisionFact(revision, realmEpoch, readRevision, reuse) {
    const marker = revision.event, ref = marker.data.descriptor, value = readRevision(ref, marker.seq);
    if (value === undefined || recordSha256(value) !== ref.sha256)
        fail('SCHEMA_REVISION_DESCRIPTOR_UNPROVEN');
    // Only the actual append-only Native owner's same revision position may
    // reuse this immutable payload; a new closure still reads its exact descriptor.
    if (reuse)
        return reuse;
    return freezeSchemaJournalData({ marker: { seq: marker.seq, sha256: recordSha256(marker) }, descriptor: { ...ref, value },
        editSeq: marker.data.editSeq, completionSeq: marker.data.completionSeq,
        superseded: revision.superseded.map(pair => ({ batchId: pair.dispatch.data.batchId,
            dispatch: { key: schemaDispatchKey(pair.dispatch.data.sessionId, realmEpoch, pair.dispatch.data.batchId),
                sha256: pair.dispatch.data.dispatchRecordSha256 },
            completion: { key: schemaCompletionKey(pair.completion.data.sessionId, realmEpoch, pair.completion.data.batchId),
                sha256: pair.completion.data.completionRecordSha256 },
            dispatchMarker: { seq: pair.dispatch.seq, sha256: recordSha256(pair.dispatch) },
            completionMarker: { seq: pair.completion.seq, sha256: recordSha256(pair.completion) } })) });
}
function revisionFacts(revisions, realmEpoch, readRevision) {
    return Object.freeze(Array.from(revisions, revision => revisionFact(revision, realmEpoch, readRevision)));
}
function captured(markers, sessionId, realmEpoch, events, input, historical = false, recordOwner, inherited, readRevision, nativePrefixesReader, readScopeReferences, captureScopeObjects, executionBaseline) {
    try {
        if (!id(sessionId) || !hash(realmEpoch))
            fail('SCHEMA_JOURNAL_LIMIT');
        const checked = input instanceof CheckedRows;
        const bounded = input instanceof BoundedRows;
        const rows = input.records;
        // Reject executable containers before consulting Native history. Each
        // retained row subsequently pays its own complete DATA budget.
        if (types.isProxy(rows))
            fail('SCHEMA_PROXY_VALUE');
        const length = Object.getOwnPropertyDescriptor(rows, 'length');
        if (!length || !Object.hasOwn(length, 'value') || typeof length.value !== 'number')
            fail('SCHEMA_NON_JSON_VALUE');
        // Only Core's actual immutable Native array can select its marker owner's
        // bounded reader. Raw/frozen transport keeps the standalone full parser;
        // it must not acquire a live ancestor merely by naming the same Session.
        const ownedPrefix = nativePrefixesReader?.(events, [events.length])?.get(events.length);
        const ownedMarkers = ownedPrefix && markers.readEffectiveCut?.(sessionId, events.length);
        if (ownedMarkers && ownedMarkers.nativePrefixSha256 !== ownedPrefix)
            fail('SCHEMA_NATIVE_CUT_INVALID');
        const ownedEpoch = ownedMarkers ? ownedMarkers.epochs.get(realmEpoch) : undefined;
        const rawEpoch = ownedMarkers ? undefined : markers.readEffectiveHistory(events).epochs.get(realmEpoch);
        const nativeEpoch = ownedEpoch ?? rawEpoch;
        const nativePairs = ownedMarkers ? ownedEpoch?.pairs.range() ?? [] : rawEpoch?.pairs ?? [];
        const nativeRevisions = ownedMarkers ? [...ownedEpoch?.revisions.range() ?? []] : rawEpoch?.revisions ?? [];
        const supplied = checked ? rows : bounded ? rows : journalArray(rows), all = new Map(), records = [];
        const clone = !checked && !bounded ? schemaDescriptorEnvelopeSequenceClonerV4() : undefined;
        for (const row of supplied) {
            const boundedRow = clone ? freezeJournalData(row, clone) : row;
            const { key } = boundedRow, record = checked ? boundedRow.record : validateClonedSchemaJournalRecord(boundedRow.record);
            if (key !== schemaJournalKey(record) || all.has(key))
                fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID');
            all.set(key, record);
            records.push(record === boundedRow.record ? boundedRow : Object.freeze({ key, record }));
        }
        Object.freeze(records);
        const relevant = records.filter(item => item.record.realmEpoch === realmEpoch);
        const epochs = relevant.filter(item => isEpoch(item.record));
        const native = Array.from(nativePairs).flatMap(pair => [pair.dispatch, pair.completion]);
        if (nativeEpoch?.pending)
            native.push(events[nativeEpoch.pending.seq]);
        const superseded = new Set(nativeRevisions.flatMap(revision => revision.superseded.map(pair => pair.dispatch.data.batchId)));
        const revisions = revisionFacts(nativeRevisions, realmEpoch, (ref, seq) => readRevision?.(ref, seq));
        if (!epochs.length && !relevant.length && !native.length && !executionBaseline)
            return { kind: 'absent', code: 'SCHEMA_REALM_HISTORY_UNPROVEN' };
        if (executionBaseline ? epochs.length !== 0 : epochs.length !== 1)
            fail('SCHEMA_REALM_HISTORY_UNPROVEN');
        const epoch = executionBaseline?.epoch ?? epochs[0].record, epochRef = reference(epoch);
        const execution = schemaEpochExecution(epoch);
        // The epoch chooses one execution protocol for all its retained frames.
        // A valid checksum cannot permit a dispatch/completion from another wire.
        if (relevant.some(item => !matchingWire(item.record, epoch)))
            fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
        if (inherited?.epoch !== epoch)
            scopeLoad(epoch, readScopeReferences);
        const cuts = native.filter(event => event.type === markers.dispatchEventType).map(event => event.seq);
        if (inherited)
            cuts.push(inherited.frozen.nativeCut);
        const nativePrefixes = schemaNativePrefixSha256(events, cuts, nativePrefixesReader);
        // A checked DATA result never fixes the descendant's actual Native prefix.
        // Join its cut in this fold's existing prefix derivation, without a second
        // inherited serialization/hash or another complete journal parse.
        if (inherited && (inherited.frozen.realmEpoch !== realmEpoch
            || nativePrefixes.get(inherited.frozen.nativeCut) !== inherited.frozen.nativePrefixSha256))
            fail('SCHEMA_FROZEN_CUT_INVALID');
        let tail = executionBaseline?.tailSha256 ?? execution.loadAnchorSha256;
        const inheritedDispatches = new Set(inherited?.steps.map(pair => pair.dispatch));
        const inheritedCompletions = new Map(inherited?.steps.map(pair => [pair.completion, pair]));
        let pending, pendingBrowser;
        const steps = [], entries = [], selected = new Set([epochRef.key]), seenEvents = new Set();
        for (const event of native) {
            if (event.type === markers.dispatchEventType) {
                const marker = event.data;
                const key = schemaDispatchKey(marker.sessionId, realmEpoch, marker.batchId), row = all.get(key);
                if (row && isSchemaBrowserDispatch(row)) {
                    pendingBrowser = joinBrowserDispatch(event, row, { epoch, epochRef, ordinal: steps.length + 1, tail }, nativePrefixes.get(event.seq));
                    selected.add(key);
                    continue;
                }
                pending = joinDispatch(event, row, { epoch, epochRef, ordinal: steps.length + 1, executionOffset: executionBaseline?.length, tail }, nativePrefixes.get(event.seq), !!row && isDispatch(row) && (seenEvents.has(row.requestedStep.eventId) || !!executionBaseline?.hasEvent(row.requestedStep.eventId)), !!row && inheritedDispatches.has(row), readScopeReferences);
                seenEvents.add(pending.dispatch.requestedStep.eventId);
                selected.add(key);
            }
            else if (event.type === markers.completionEventType) {
                const marker = event.data, key = schemaCompletionKey(marker.sessionId, realmEpoch, marker.batchId), row = all.get(key);
                if (pendingBrowser) {
                    entries.push(joinBrowserCompletion(event, row, pendingBrowser, tail));
                    pendingBrowser = undefined;
                    selected.add(key);
                    continue;
                }
                if (!pending || !row || !isCompletion(row))
                    fail('SCHEMA_COMPLETION_UNPROVEN');
                const dispatch = pending.dispatch, priorStep = inheritedCompletions.get(row), inheritedStep = priorStep?.dispatch === dispatch ? priorStep : undefined;
                selected.add(key);
                const joined = joinCompletion(event, row, pending, { epoch, epochRef, ordinal: steps.length + 1, executionOffset: executionBaseline?.length, tail }, recordOwner, inheritedStep);
                steps.push(joined);
                entries.push(joined);
                tail = row.step.stepSha256;
                pending = undefined;
            }
        }
        if (pending || pendingBrowser)
            fail('SCHEMA_NATIVE_PAIR_PENDING');
        for (const { key, record } of relevant)
            if (!selected.has(key)) {
                if (!isEpoch(record) && superseded.has(record.batchId))
                    continue;
                if (historical && (isDispatch(record) || isSchemaBrowserDispatch(record)) && record.sourceNativeCut.nativeCut >= events.length)
                    continue;
                if (historical && (isCompletion(record) || isSchemaBrowserCompletion(record)) && record.dispatchMarker.seq >= events.length)
                    continue;
                if (historical && isUnavailable(record) && record.sourceNativeCut.nativeCut >= events.length)
                    continue;
                fail(isUnavailable(record) ? 'SCHEMA_EPOCH_UNAVAILABLE' : 'SCHEMA_DISPATCH_PENDING');
            }
        if (!steps.length && !executionBaseline?.length)
            fail('SCHEMA_REALM_HISTORY_UNPROVEN');
        const frontiers = journalFrontiers(epochRef, entries, executionBaseline?.ref), frontierSha256 = frontiers.entries.at(-1);
        const frozenRecords = Object.freeze(relevant.filter(item => selected.has(item.key)
            || revisions.length && !isEpoch(item.record) && superseded.has(item.record.batchId))), objects = scopeRefRecord(epoch) ? frozenScopeObjects(frozenRecords, captureScopeObjects) : undefined;
        const frozen = { ...(executionBaseline ? { schemaVersion: 4,
                encoding: 'native-mvu-schema-frozen-cut-v4', revisions, scopeObjects: objects ?? [], executionBaseline: executionBaseline.ref } : objects ? { schemaVersion: 3,
                encoding: 'native-mvu-schema-frozen-cut-v3', revisions, scopeObjects: objects } : revisions.length ? { schemaVersion: 2,
                encoding: 'native-mvu-schema-frozen-cut-v2', revisions } : { schemaVersion: 1,
                encoding: 'native-mvu-schema-frozen-cut-v1' }), sessionId, realmEpoch,
            nativeCut: events.length, nativePrefixSha256: nativePrefixes.get(events.length),
            records: frozenRecords, frontierSha256 };
        // Actual owner reads or the public container parse deeply froze these rows.
        // Reuse their immutable frames in facts rather than cloning the same input
        // again into both the steps view and its persisted-cut view.
        for (const step of steps)
            freezeStepFacts(step);
        const common = { kind: 'ready', epochRef: Object.freeze(epochRef), steps: Object.freeze(steps), entries: Object.freeze(entries),
            frozen: Object.freeze(frozen), frontierAt: (count) => frontiers.workers[count],
            entryFrontierAt: (count) => frontiers.entries[count], ...executionBaseline ? { executionBaseline } : {} };
        const ready = epoch.schemaVersion === 5 ? { ...common, epoch, hostProtocol: 5,
            serverTailSha256: tail, hostFrontierSha256: frontierSha256 } : { ...common, epoch, tailSha256: tail, frontierSha256 };
        Object.defineProperty(ready, checkedJournalRows, { value: new CheckedRows(frozen.records) });
        if (epoch.schemaVersion === 4 || epoch.schemaVersion === 5) {
            const execution = schemaEpochExecution(epoch);
            const ownedPrefix = Object.freeze({
                programSha256: execution.program.programSha256, realmEpoch,
                loadAnchorSha256: execution.loadAnchorSha256, length: (executionBaseline?.length ?? 0) + steps.length, tailSha256: tail,
                hasEvent: (eventId) => !!executionBaseline?.hasEvent(eventId) || seenEvents.has(eventId),
                // A hot consumer needs only the facts above. Full row projection is
                // deferred until a cold/mismatched realm actually needs its history.
                materialize: () => [...executionBaseline?.materialize() ?? [], ...steps.map(item => item.step)],
            });
            Object.defineProperty(ready, 'ownedPrefixV4', { value: () => ownedPrefix });
        }
        return Object.freeze(ready);
    }
    catch (error) {
        return { kind: 'blocked', code: codeOf(error) };
    }
}
/** Pure frontier derivation. Inputs must already be captured journal facts;
 * this hash neither validates a Source/Native cut nor grants publication. */
export function schemaJournalFrontierSha256(epoch, steps, executionBaseline) {
    return recordSha256({ epoch, ...executionBaseline ? { executionBaseline } : {}, steps: steps.map(frontierStep) });
}
function frontierDigest(epoch, baseline) {
    return createHash('sha256').update(`{"epoch":${stableJson(epoch)},${baseline ? `"executionBaseline":${stableJson(baseline)},` : ''}"steps":[`, 'utf8');
}
function frontierStep(step) {
    return { dispatch: step.dispatchRef, completion: step.completionRef,
        dispatchMarker: step.dispatchMarker, completionMarker: step.completionMarker,
        tail: isSchemaBrowserFacts(step) ? step.dispatch.previousTailSha256 : step.completion.step.stepSha256 };
}
function journalFrontiers(epoch, entries, baseline) {
    const digest = frontierDigest(epoch, baseline), initial = digest.copy().update(']}', 'utf8').digest('hex'), result = { workers: [initial], entries: [initial] };
    for (const [index, entry] of entries.entries()) {
        if (index)
            digest.update(',', 'utf8');
        digest.update(stableJson(frontierStep(entry)), 'utf8');
        const current = digest.copy().update(']}', 'utf8').digest('hex');
        result.entries.push(current);
        if (!isSchemaBrowserFacts(entry))
            result.workers.push(current);
    }
    return result;
}
/** Exact stored receipt plus its dispatch frame. This DATA hash neither
 * proves a Native pair nor grants execution or publication permission. */
export function schemaJournalFullStepSha256(completion, dispatch) {
    const { frameSha256: _frameHash, stepSha256: _stepHash, ...receipt } = completion.step;
    return recordSha256({ ...receipt, frame: dispatch.requestedStep.frame });
}
function boundedSequence(items, length = items.length) {
    return Object.freeze({ length, at(index) {
            const selected = index < 0 ? length + index : index;
            return Number.isSafeInteger(selected) && selected >= 0 && selected < length ? items[selected] : undefined;
        }, *range(start = 0, end = length) {
            if (!integer(start) || !integer(end) || start > end || end > length)
                fail('SCHEMA_JOURNAL_LIMIT');
            for (let index = start; index < end; index++)
                yield items[index];
        } });
}
function boundedLegacy(ready, owner) {
    const frontiers = journalFrontiers(ready.epochRef, ready.entries ?? ready.steps, ready.executionBaseline?.ref);
    return Object.freeze({ kind: 'ready', epoch: ready.epoch, epochRef: ready.epochRef, owner,
        ...(ready.epoch.schemaVersion === 5 ? { hostProtocol: 5 } : {}),
        nativeCut: ready.frozen.nativeCut, nativePrefixSha256: ready.frozen.nativePrefixSha256,
        serverTailSha256: schemaJournalServerTailSha256(ready), hostFrontierSha256: schemaJournalHostFrontierSha256(ready),
        steps: boundedSequence(ready.steps), entries: boundedSequence(ready.entries ?? ready.steps),
        ...ready.executionBaseline ? { executionBaseline: ready.executionBaseline } : {},
        ...(ready.ownedPrefixV4 ? { ownedPrefixV4: ready.ownedPrefixV4 } : {}),
        frontierAt(count) { if (!integer(count) || count > ready.steps.length)
            fail('SCHEMA_JOURNAL_LIMIT'); return frontiers.workers[count]; },
        entryFrontierAt: (count) => frontiers.entries[count],
        pairFact: () => undefined, selectionFact: () => undefined, materialize: () => ready });
}
export function createRoleplayMvuSchemaJournal(deps) {
    const baselines = new Map();
    const baselineScopes = new WeakMap();
    function resolveBaseline(ref, sessionId) {
        const baseline = deps.resolveExecutionBaseline?.(ref, sessionId);
        if (!baseline || !same(baseline.ref, ref))
            fail('SCHEMA_EXECUTION_BASELINE_UNPROVEN');
        return baseline;
    }
    function baselineFor(sessionId, realmEpoch, provided) {
        let realms = baselines.get(sessionId);
        const prior = realms?.get(realmEpoch);
        if (provided && (provided.epoch.sessionId === sessionId || provided.epoch.realmEpoch !== realmEpoch || provided.length < 1))
            fail('SCHEMA_EXECUTION_BASELINE_UNPROVEN');
        if (prior && provided && !same(prior.ref, provided.ref))
            fail('SCHEMA_EXECUTION_BASELINE_CHANGED');
        if (!prior && provided) {
            if (!realms)
                baselines.set(sessionId, realms = new Map());
            realms.set(realmEpoch, provided);
        }
        return prior ?? provided;
    }
    function scopeBindings(inherited = null, baseline, localObjects = []) {
        let baselineScope = baseline && baselineScopes.get(baseline);
        if (baseline && !baselineScope) {
            baselineScope = createSchemaJournalScopeClosure(baseline.scopeObjects);
            baselineScopes.set(baseline, baselineScope);
        }
        const objects = [...inherited && 'scopeObjects' in inherited.frozen ? inherited.frozen.scopeObjects : [], ...localObjects], closed = objects.length ? createSchemaJournalScopeClosure(objects, baselineScope) : baselineScope;
        const readScopeReferences = (program, ref, binding, load) => {
            if (closed?.has(ref))
                return closed.readScopeReferences(program, ref, binding, load);
            if (!deps.readScopeReferences)
                fail('SCHEMA_SCOPE_REFERENCE_UNPROVEN');
            deps.readScopeReferences(program, ref, binding, load);
        };
        const captureScopeObjects = references => {
            const refs = [...references], frozen = closed ? refs.filter(ref => closed.has(ref)) : [], fresh = closed ? refs.filter(ref => !closed.has(ref)) : refs, objects = [...(closed?.captureScopeObjects(frozen) ?? []),
                ...(fresh.length ? (deps.captureScopeObjects?.(fresh) ?? fail('SCHEMA_SCOPE_REFERENCE_UNPROVEN')) : [])];
            return Object.freeze(objects);
        };
        return { readScopeReferences, captureScopeObjects };
    }
    function decode(key, row) {
        if (deps.recordOwner)
            return deps.recordOwner.read(key, row);
        if (row === undefined)
            return;
        const record = validateSchemaJournalRecord(row);
        if (schemaJournalKey(record) !== key)
            fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID');
        return record;
    }
    function read(key) {
        // Every consumer reads its own table. Closed scopes must reject an
        // unrecorded address even when the DATA owner already knows that row.
        return decode(key, deps.table.get(key));
    }
    function inventory(sessionId, selection) {
        if (!id(sessionId))
            fail('SCHEMA_JOURNAL_OWNER_INVALID');
        const rows = [], prefix = `${sessionId}__mvu-schema-`;
        const selected = new Map();
        const withinCut = (record) => !selection || record.realmEpoch === selection.realmEpoch
            && !((isDispatch(record) || isSchemaBrowserDispatch(record)) && record.sourceNativeCut.nativeCut >= selection.nativeCut)
            && !((isCompletion(record) || isSchemaBrowserCompletion(record)) && record.dispatchMarker.seq >= selection.nativeCut)
            && !(isUnavailable(record) && record.sourceNativeCut.nativeCut >= selection.nativeCut);
        const include = selection ? ((key, raw) => {
            // Frozen capture selects the Journal owner's historical footprint before
            // retaining row bodies. Ordinary table iterators may supply keys alone;
            // their actual get below still owns the record and all validation.
            if (raw === undefined)
                return true;
            const record = decode(key, raw);
            if (!record || !withinCut(record))
                return false;
            selected.set(key, { raw, record });
            return true;
        }) : undefined;
        for (const [key] of deps.table.entries(prefix, include))
            if (key.startsWith(prefix)) {
                const raw = deps.table.get(key), checked = selected.get(key);
                const record = checked && checked.raw === raw ? checked.record : decode(key, raw);
                if (!record || record.sessionId !== sessionId)
                    fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID');
                if (!withinCut(record))
                    continue;
                rows.push(Object.freeze({ key, record }));
            }
        // read owns each immutable record. Enumeration freezes only its new
        // container and retains those checked records for the synchronous fold.
        return Object.freeze(rows);
    }
    const liveSessions = new Map();
    let unobserveLive, liveDisposed = false;
    function releaseSession(sessionId) {
        baselines.delete(sessionId);
        const state = liveSessions.get(sessionId);
        if (!state)
            return;
        liveSessions.delete(sessionId);
        for (const cache of state.caches.values())
            for (const fact of cache.handles)
                fact.dispose();
    }
    function observeLive() {
        if (unobserveLive || !deps.live)
            return;
        unobserveLive = deps.live.observeDomainChanges(change => {
            if (change.table !== 'status')
                return;
            const split = change.key.indexOf('__');
            if (split < 1)
                return;
            const sid = change.key.slice(0, split), state = liveSessions.get(sid);
            if (state && change.key.startsWith(`${sid}__mvu-schema-`))
                state.dirty.add(change.key);
        });
    }
    function refreshLive(state, sessionId) {
        for (const key of state.dirty) {
            const previous = state.rows.get(key), record = read(key);
            if (record && record.sessionId !== sessionId)
                fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID');
            if (previous) {
                const realm = state.realms.get(previous.record.realmEpoch);
                if (realm)
                    realm.rebuild = true;
                if (!record)
                    state.rows.delete(key);
            }
            if (record) {
                const row = Object.freeze({ key, record });
                state.rows.set(key, row);
                const realm = state.realms.get(record.realmEpoch);
                if (realm && !previous) {
                    realm.rows.push(row);
                    if (!matchingWire(record, realm.epoch)) {
                        realm.badVersions.add(key);
                    }
                    if (!isEpoch(record) && !realm.superseded.has(record.batchId))
                        realm.pending.set(key, record);
                }
            }
        }
        state.dirty.clear();
    }
    function keepFact(realm, fact) {
        realm.cache.handles.add(fact);
        return fact;
    }
    function retireFact(cache, fact) {
        if (!fact)
            return;
        cache.handles.delete(fact);
        fact.dispose();
    }
    function inheritedIdentity(ready) {
        return ready ? `${ready.frozen.nativeCut}:${ready.frozen.nativePrefixSha256}:${schemaJournalHostFrontierSha256(ready)}` : '';
    }
    function realmRow(realm, key) {
        // An inherited closed cut owns its original bytes. Never consult the live
        // ancestor table for those rows, even if it is currently attached locally.
        return realm.inheritedRows.get(key) ?? read(key);
    }
    function liveRevisionSelection(realm, sessionId, realmEpoch, native) {
        // Payload belongs to this actual Native owner/realm. Proofs additionally
        // belong to the real inherited cut, so a child never acquires live ancestor
        // descriptor dependencies from a different capture scope.
        const { cache } = realm;
        let selections = cache.selections.get(realm.inheritedIdentity);
        if (!selections)
            cache.selections.set(realm.inheritedIdentity, selections = []);
        let count = selections.length, inheritedDescriptors;
        while (count && !selections[count - 1].current())
            count--;
        let previous = selections[count - 1];
        for (let index = count; index < native.length; index++) {
            const revision = native.at(index), prior = previous, payload = cache.revisionValues[index];
            retireFact(cache, selections[index]);
            const proof = deps.live.captureClosedData(sessionId, () => {
                prior?.use();
                return revisionFact(revision, realmEpoch, (ref, seq) => {
                    const inherited = realm.inherited;
                    if (inherited && seq < inherited.frozen.nativeCut) {
                        inheritedDescriptors ??= new Map(inherited.frozen.schemaVersion !== 1
                            ? inherited.frozen.revisions.map(row => [row.descriptor.key, row.descriptor.value]) : []);
                        return inheritedDescriptors.get(ref.key);
                    }
                    return deps.table.get(ref.key);
                }, payload);
            });
            // Publish only after the whole descriptor proof succeeds. Positions are
            // immutable forever, including while an invalidated proof is rebuilt.
            if (!payload)
                cache.revisionValues.push(proof.data);
            const data = boundedSequence(cache.revisionValues, index + 1);
            previous = keepFact(realm, { data, current: proof.current, use() { proof.use(); return data; },
                onInvalidated: proof.onInvalidated, dispose: proof.dispose });
            selections[index] = previous;
        }
        return previous;
    }
    function newRealm(state, sessionId, realmEpoch, markers, cut, inherited, executionBaseline) {
        const inheritedRows = new Map((inherited ? rowsForReady(inherited).records : []).map(row => [row.key, row.record])), rows = new Map(inherited ? rowsForReady(inherited).records.map(row => [row.key, row]) : []);
        for (const row of state.rows.values()) {
            const previous = rows.get(row.key);
            if (previous && previous.record.recordSha256 !== row.record.recordSha256)
                fail('SCHEMA_JOURNAL_WRITE_CONFLICT');
            if (!previous)
                rows.set(row.key, row);
        }
        const relevant = [...rows.values()].filter(row => row.record.realmEpoch === realmEpoch), epochRows = relevant.filter(row => isEpoch(row.record)), native = markers.epochs.get(realmEpoch);
        if (!relevant.length && !native && !executionBaseline)
            return;
        if (executionBaseline ? epochRows.length !== 0 : epochRows.length !== 1)
            fail('SCHEMA_REALM_HISTORY_UNPROVEN');
        const epoch = executionBaseline?.epoch ?? epochRows[0].record, epochRef = Object.freeze(reference(epoch)), execution = schemaEpochExecution(epoch);
        if (relevant.some(row => !matchingWire(row.record, epoch)))
            fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
        if (inherited && (inherited.frozen.realmEpoch !== realmEpoch
            || cut.prefixSha256(inherited.frozen.nativeCut) !== inherited.frozen.nativePrefixSha256))
            fail('SCHEMA_FROZEN_CUT_INVALID');
        let cache = state.caches.get(realmEpoch);
        if (!cache)
            state.caches.set(realmEpoch, cache = { pairs: new Map(), revisionValues: [], selections: new Map(), handles: new Set() });
        const digest = frontierDigest(epochRef, executionBaseline?.ref);
        const realm = { epoch, epochRef, epochFact: undefined, inherited, inheritedIdentity: inheritedIdentity(inherited),
            inheritedRows, executionBaseline, scope: scopeBindings(inherited, executionBaseline), revisions: boundedSequence([]), superseded: new Set(), steps: [], facts: [], entries: [], entryFacts: [], rows: relevant,
            pending: new Map(), badVersions: new Set(),
            events: new Map(), digest, frontiers: [digest.copy().update(']}', 'utf8').digest('hex')],
            entryFrontiers: [digest.copy().update(']}', 'utf8').digest('hex')],
            hostFrontier: digest.copy().update(']}', 'utf8').digest('hex'), tail: executionBaseline?.tailSha256 ?? execution.loadAnchorSha256,
            nativeCut: 0, rebuild: false, cache };
        if (!cache.epoch?.current()) {
            retireFact(cache, cache.epoch);
            cache.epoch = keepFact(realm, deps.live.captureClosedData(sessionId, () => {
                const actual = executionBaseline?.epoch ?? realmRow(realm, epochRef.key);
                if (!actual || !isEpoch(actual) || actual.recordSha256 !== epochRef.sha256)
                    fail('SCHEMA_REALM_HISTORY_UNPROVEN');
                if (!realm.inheritedRows.has(epochRef.key))
                    scopeLoad(actual, realm.scope.readScopeReferences);
                return actual;
            }));
        }
        realm.epochFact = cache.epoch;
        if (native?.revisions.length) {
            realm.selection = liveRevisionSelection(realm, sessionId, realmEpoch, native.revisions);
            realm.revisions = realm.selection.data;
            for (const revision of realm.revisions.range())
                for (const pair of revision.superseded)
                    realm.superseded.add(pair.batchId);
        }
        for (const row of relevant)
            if (!isEpoch(row.record) && !realm.superseded.has(row.record.batchId))
                realm.pending.set(row.key, row.record);
        return realm;
    }
    function advanceLive(realm, sessionId, realmEpoch, markers, cut) {
        const native = markers.epochs.get(realmEpoch);
        if (realm.badVersions.size)
            fail('SCHEMA_JOURNAL_VERSION_MISMATCH');
        for (const pair of native?.pairs.range(realm.entries.length) ?? []) {
            const ordinal = realm.steps.length + 1, previous = realm.entryFacts.at(-1), tail = realm.tail, dispatchKey = schemaDispatchKey(pair.dispatch.data.sessionId, realmEpoch, pair.dispatch.data.batchId), completionKey = schemaCompletionKey(pair.completion.data.sessionId, realmEpoch, pair.completion.data.batchId);
            let fact = realm.cache.pairs.get(pair.completion.seq);
            if (!fact?.current()) {
                retireFact(realm.cache, fact);
                fact = keepFact(realm, deps.live.captureClosedData(sessionId, () => {
                    const epoch = previous ? (previous.use(), realm.epoch) : realm.epochFact.use();
                    realm.selection?.use();
                    const row = realmRow(realm, dispatchKey), inheritedStep = realm.inherited?.steps[ordinal - 1], context = { epoch, epochRef: realm.epochRef, ordinal, executionOffset: realm.executionBaseline?.length, tail }, inheritedPair = inheritedStep?.dispatch.recordSha256 === pair.dispatch.data.dispatchRecordSha256
                        && inheritedStep?.completion.recordSha256 === pair.completion.data.completionRecordSha256 ? inheritedStep : undefined, browser = row && isSchemaBrowserDispatch(row) ? joinBrowserDispatch(pair.dispatch, row, context, cut.prefixSha256(pair.dispatch.seq)) : undefined;
                    if (browser)
                        return joinBrowserCompletion(pair.completion, realmRow(realm, completionKey), browser, tail);
                    const pending = joinDispatch(pair.dispatch, row, context, cut.prefixSha256(pair.dispatch.seq), !!row && isDispatch(row) && (realm.events.has(row.requestedStep.eventId) || !!realm.executionBaseline?.hasEvent(row.requestedStep.eventId)), !!inheritedPair, realm.scope.readScopeReferences);
                    return freezeStepFacts(joinCompletion(pair.completion, realmRow(realm, completionKey), pending, context, deps.recordOwner, inheritedPair));
                }));
                realm.cache.pairs.set(pair.completion.seq, fact);
            }
            const facts = fact.data;
            realm.entries.push(facts);
            realm.entryFacts.push(fact);
            realm.pending.delete(dispatchKey);
            realm.pending.delete(completionKey);
            if (realm.entries.length > 1)
                realm.digest.update(',', 'utf8');
            realm.digest.update(stableJson(frontierStep(facts)), 'utf8');
            realm.hostFrontier = realm.digest.copy().update(']}', 'utf8').digest('hex');
            realm.entryFrontiers.push(realm.hostFrontier);
            if (!isSchemaBrowserFacts(facts)) {
                realm.steps.push(facts);
                realm.facts.push(fact);
                realm.events.set(facts.dispatch.requestedStep.eventId, ordinal);
                realm.frontiers.push(realm.hostFrontier);
                realm.tail = facts.completion.step.stepSha256;
            }
        }
        if (native?.pending) {
            const event = cut.at(native.pending.seq), key = schemaDispatchKey(event.data.sessionId, realmEpoch, event.data.batchId), row = realmRow(realm, key);
            if (row && isSchemaBrowserDispatch(row)) {
                joinBrowserDispatch(event, row, { epoch: realm.epoch, epochRef: realm.epochRef, ordinal: realm.steps.length + 1, tail: realm.tail }, cut.prefixSha256(event.seq));
                fail('SCHEMA_NATIVE_PAIR_PENDING');
            }
            joinDispatch(event, row, { epoch: realm.epoch, epochRef: realm.epochRef, ordinal: realm.steps.length + 1,
                executionOffset: realm.executionBaseline?.length, tail: realm.tail }, cut.prefixSha256(event.seq), !!row && isDispatch(row) && (realm.events.has(row.requestedStep.eventId) || !!realm.executionBaseline?.hasEvent(row.requestedStep.eventId)), false, realm.scope.readScopeReferences);
            fail('SCHEMA_NATIVE_PAIR_PENDING');
        }
        for (const row of realm.pending.values())
            fail(isUnavailable(row) ? 'SCHEMA_EPOCH_UNAVAILABLE' : 'SCHEMA_DISPATCH_PENDING');
        if (!realm.steps.length && !realm.executionBaseline?.length)
            fail('SCHEMA_REALM_HISTORY_UNPROVEN');
        realm.nativeCut = cut.length;
    }
    function viewLive(sessionId, realmEpoch, realm, cut) {
        const count = realm.steps.length, steps = boundedSequence(realm.steps, count), rows = boundedSequence(realm.rows), facts = boundedSequence(realm.facts, count), epoch = realm.epoch, epochRef = realm.epochRef, tail = realm.tail, frontier = realm.hostFrontier, revisions = realm.revisions, selection = realm.selection, scope = realm.scope, entries = boundedSequence(realm.entries), entryFacts = boundedSequence(realm.entryFacts), entryFrontiers = realm.entryFrontiers, nativePrefixSha256 = cut.prefixSha256(cut.length), events = realm.events, frontiers = realm.frontiers, baseline = realm.executionBaseline;
        let materialized;
        const execution = schemaEpochExecution(epoch), ownedPrefix = epoch.schemaVersion === 4 || epoch.schemaVersion === 5
            ? Object.freeze({ programSha256: execution.program.programSha256, realmEpoch, loadAnchorSha256: execution.loadAnchorSha256,
                length: (baseline?.length ?? 0) + count, tailSha256: tail, hasEvent: (eventId) => { const ordinal = events.get(eventId); return !!baseline?.hasEvent(eventId) || ordinal !== undefined && ordinal <= count; },
                materialize: () => [...baseline?.materialize() ?? [], ...Array.from(steps.range(), item => item.step)] }) : undefined;
        return Object.freeze({ kind: 'ready', epoch, epochRef, owner: cut.owner, nativeCut: cut.length, nativePrefixSha256,
            ...(epoch.schemaVersion === 5 ? { hostProtocol: 5 } : {}),
            serverTailSha256: tail, hostFrontierSha256: frontier, steps, entries, ...baseline ? { executionBaseline: baseline } : {},
            ...(ownedPrefix ? { ownedPrefixV4: () => ownedPrefix } : {}),
            frontierAt(selected) { if (!integer(selected) || selected > count)
                fail('SCHEMA_JOURNAL_LIMIT'); return frontiers[selected]; },
            entryFrontierAt: (selected) => entryFrontiers[selected], entryFact: (index) => entryFacts.at(index),
            pairFact: (index) => facts.at(index), selectionFact: () => selection,
            materialize() {
                if (materialized)
                    return materialized;
                const records = Object.freeze([...rows.range()]), objects = scopeRefRecord(epoch) ? frozenScopeObjects(records, scope.captureScopeObjects) : undefined, revisionRows = Object.freeze([...revisions.range()]);
                const frozen = { ...(baseline ? { schemaVersion: 4,
                        encoding: 'native-mvu-schema-frozen-cut-v4', revisions: revisionRows, scopeObjects: objects ?? [], executionBaseline: baseline.ref } : objects ? { schemaVersion: 3,
                        encoding: 'native-mvu-schema-frozen-cut-v3', revisions: revisionRows, scopeObjects: objects } : revisions.length ? { schemaVersion: 2,
                        encoding: 'native-mvu-schema-frozen-cut-v2', revisions: revisionRows } : { schemaVersion: 1,
                        encoding: 'native-mvu-schema-frozen-cut-v1' }), sessionId, realmEpoch, nativeCut: cut.length, nativePrefixSha256,
                    records, frontierSha256: frontier }, common = { kind: 'ready', epoch, epochRef, steps: Object.freeze([...steps.range()]), entries: Object.freeze([...entries.range()]),
                    frozen: Object.freeze(frozen), frontierAt: (selected) => frontiers[selected],
                    entryFrontierAt: (selected) => entryFrontiers[selected], ...baseline ? { executionBaseline: baseline } : {} };
                const ready = epoch.schemaVersion === 5 ? { ...common, epoch, hostProtocol: 5,
                    serverTailSha256: tail, hostFrontierSha256: frontier } : { ...common, epoch, tailSha256: tail, frontierSha256: frontier };
                Object.defineProperty(ready, checkedJournalRows, { value: new CheckedRows(frozen.records) });
                if (ownedPrefix)
                    Object.defineProperty(ready, 'ownedPrefixV4', { value: () => ownedPrefix });
                return materialized = Object.freeze(ready);
            } });
    }
    function captureLive(sessionId, realmEpoch, options = {}) {
        try {
            if (liveDisposed)
                fail('SCHEMA_JOURNAL_DISPOSED');
            if (!id(sessionId) || !hash(realmEpoch))
                fail('SCHEMA_JOURNAL_LIMIT');
            const session = deps.live?.session(sessionId);
            if (!session || !deps.nativeHistory?.cut || !deps.markers.readEffectiveCut)
                fail('SCHEMA_LIVE_OWNER_UNAVAILABLE');
            const cut = deps.nativeHistory.cut(session), nativeCut = options.nativeCut ?? cut.length, inherited = options.inherited ?? null;
            if (!integer(nativeCut) || nativeCut > cut.length)
                fail('SCHEMA_NATIVE_CUT_INVALID');
            if (cut.source !== 'native' || nativeCut < cut.length || !deps.live?.captureClosedData) {
                const events = cut.materialize(), result = captureChecked(sessionId, realmEpoch, nativeCut === events.length ? events : events.slice(0, nativeCut), inherited, nativeCut < cut.length, options.executionBaseline);
                if (result.kind !== 'ready')
                    return result;
                // The fallback owns no cross-capture live proof. Keep the legacy view
                // explicit until a real collector can establish each closed pair.
                return boundedLegacy(result, cut.owner);
            }
            observeLive();
            let state = liveSessions.get(sessionId);
            if (state && state.session !== session) {
                releaseSession(sessionId);
                state = undefined;
            }
            if (state && state.owner !== cut.owner)
                fail('SCHEMA_NATIVE_CUT_INVALID');
            if (!state) {
                state = { session, owner: cut.owner,
                    rows: deps.live.readDataInventory(() => new Map(inventory(sessionId).map(row => [row.key, row]))),
                    dirty: new Set(), realms: new Map(), caches: new Map() };
                liveSessions.set(sessionId, state);
            }
            if (state.dirty.size)
                deps.live.readDataInventory(() => refreshLive(state, sessionId));
            const markers = deps.markers.readEffectiveCut(sessionId, nativeCut);
            if (markers.owner !== cut.owner || markers.nativePrefixSha256 !== cut.prefixSha256(nativeCut))
                fail('SCHEMA_NATIVE_CUT_INVALID');
            let realm = state.realms.get(realmEpoch);
            const executionBaseline = baselineFor(sessionId, realmEpoch, options.executionBaseline ?? inherited?.executionBaseline);
            const native = markers.epochs.get(realmEpoch);
            if (realm && (realm.rebuild || realm.revisions.length !== (native?.revisions.length ?? 0)
                || realm.entries.length > (native?.pairs.length ?? 0) || realm.inheritedIdentity !== inheritedIdentity(inherited)
                || !realm.epochFact.current() || realm.selection && !realm.selection.current()
                || realm.entryFacts.length && !realm.entryFacts.at(-1).current()))
                realm = undefined;
            if (!realm) {
                realm = newRealm(state, sessionId, realmEpoch, markers, cut, inherited, executionBaseline);
                if (!realm)
                    return { kind: 'absent', code: 'SCHEMA_REALM_HISTORY_UNPROVEN' };
                state.realms.set(realmEpoch, realm);
            }
            advanceLive(realm, sessionId, realmEpoch, markers, cut);
            return viewLive(sessionId, realmEpoch, realm, cut);
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    async function put(input) {
        const record = deps.recordOwner?.decode?.(input) ?? validateSchemaJournalRecord(input);
        return write(record);
    }
    async function write(record) {
        const key = schemaJournalKey(record), prior = read(key);
        if (prior && prior.recordSha256 !== record.recordSha256)
            fail('SCHEMA_JOURNAL_WRITE_CONFLICT');
        // A matching existing row has no write or await to confirm. Reuse the
        // validated read; only an actual write needs lost-ACK readback below.
        if (prior)
            return freezeSchemaJournalData(reference(prior));
        try {
            await deps.table.put(key, record);
        }
        catch { /* Lost ACK is resolved only by exact readback. */ }
        const actual = read(key);
        // read owns the complete grammar, checksum and requested-key membership.
        // Its verified checksum identifies this exact record without a second hash.
        if (!actual || actual.recordSha256 !== record.recordSha256)
            fail('SCHEMA_JOURNAL_WRITE_UNKNOWN');
        return freezeSchemaJournalData(reference(actual));
    }
    function capture(sessionId, realmEpoch, events, inherited = null, historical = false, executionBaseline) {
        try {
            // Raw/cold inherited input still enters the complete public parser once.
            const ready = inherited ? validateFrozenReady(inherited, events.slice(0, inherited.nativeCut)) : null;
            return captureChecked(sessionId, realmEpoch, events, ready, historical, executionBaseline);
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    function captureChecked(sessionId, realmEpoch, events, inherited = null, historical = false, executionBaseline) {
        try {
            executionBaseline = baselineFor(sessionId, realmEpoch, executionBaseline ?? inherited?.executionBaseline);
            const scope = scopeBindings(inherited, executionBaseline);
            // Select the historical footprint before a frozen-input owner retains
            // bodies. Duplicate selected rows still reach the Native fold unchanged.
            if (historical && inherited === null)
                return captured(deps.markers, sessionId, realmEpoch, events, new CheckedRows(inventory(sessionId, { realmEpoch, nativeCut: events.length })), true, deps.recordOwner, undefined, ref => deps.table.get(ref.key), deps.nativeHistory?.prefixes, scope.readScopeReferences, scope.captureScopeObjects, executionBaseline);
            const rows = [...(inherited ? rowsForReady(inherited).records : [])];
            const rowsByKey = new Map(rows.map(row => [row.key, row]));
            for (const row of inventory(sessionId, historical ? { realmEpoch, nativeCut: events.length } : undefined)) {
                const previous = rowsByKey.get(row.key);
                if (previous && previous.record.recordSha256 !== row.record.recordSha256)
                    fail('SCHEMA_JOURNAL_WRITE_CONFLICT');
                if (!previous) {
                    rows.push(row);
                    rowsByKey.set(row.key, row);
                }
            }
            const inheritedDescriptors = inherited && inherited.frozen.schemaVersion !== 1
                ? new Map(inherited.frozen.revisions.map(revision => [revision.descriptor.key, revision.descriptor.value]))
                : undefined;
            // The genuine captured result owns inherited grammar. Local inventory
            // owns all new DATA; this fold alone joins them to the actual Native cut.
            // Ancestor markers consume their frozen descriptor DATA. Reading today's
            // parent table here would make a child's closed prefix depend on its parent.
            return captured(deps.markers, sessionId, realmEpoch, events, new CheckedRows(rows), historical, deps.recordOwner, inherited ?? undefined, (ref, markerSeq) => inherited && markerSeq < inherited.frozen.nativeCut
                ? inheritedDescriptors?.get(ref.key) : deps.table.get(ref.key), deps.nativeHistory?.prefixes, scope.readScopeReferences, scope.captureScopeObjects, executionBaseline);
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    function recutChecked(sessionId, realmEpoch, events, ready) {
        try {
            const scope = scopeBindings(null, ready.executionBaseline, 'scopeObjects' in ready.frozen ? ready.frozen.scopeObjects : []), descriptors = ready.frozen.schemaVersion !== 1
                ? new Map(ready.frozen.revisions.map(revision => [revision.descriptor.key, revision.descriptor.value]))
                : undefined;
            // A recut selects from this already captured history, including its
            // descriptors; it cannot acquire later parent Domain rows.
            return captured(deps.markers, sessionId, realmEpoch, events, rowsForReady(ready), true, deps.recordOwner, undefined, ref => descriptors?.get(ref.key), deps.nativeHistory?.prefixes, scope.readScopeReferences, scope.captureScopeObjects, ready.executionBaseline);
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    function validateFrozenReady(input, events) {
        const frozen = freezeSchemaJournalCut(input);
        exact(frozen, frozenKeys(frozen));
        if (!frozenEncoding(frozen) || frozen.nativeCut !== events.length) {
            fail('SCHEMA_FROZEN_CUT_INVALID');
        }
        const descriptors = new Map(frozen.schemaVersion !== 1 ? frozen.revisions.map(revision => [revision.descriptor.key, revision.descriptor.value]) : []), baseline = frozen.schemaVersion === 4 ? resolveBaseline(frozen.executionBaseline, frozen.sessionId) : undefined, scope = scopeBindings(null, baseline, 'scopeObjects' in frozen ? frozen.scopeObjects : []);
        const result = captured(deps.markers, frozen.sessionId, frozen.realmEpoch, events, new BoundedRows(frozen.records), true, undefined, undefined, ref => descriptors.get(ref.key), deps.nativeHistory?.prefixes, scope.readScopeReferences, scope.captureScopeObjects, baseline);
        if (result.kind !== 'ready' || schemaJournalHostFrontierSha256(result) !== frozen.frontierSha256
            || result.frozen.nativePrefixSha256 !== frozen.nativePrefixSha256
            || result.frozen.schemaVersion !== frozen.schemaVersion
            || frozen.schemaVersion !== 1 && !same(frozen.revisions, result.frozen.revisions)) {
            fail(result.kind === 'blocked' ? result.code : 'SCHEMA_FROZEN_CUT_INVALID');
        }
        // Capture validates every supplied row before selecting this cut. Expose
        // those same facts so a synchronous caller need not capture the selection
        // again; this is neither cached evidence nor a historical executor proof.
        return result;
    }
    function validateFrozen(input, events) {
        return validateFrozenReady(input, events).frozen;
    }
    /** Internal closed-prefix recovery. The prefix owner has admitted this DATA;
     * inherited copies select genuine prior rows by reference, never by body. */
    function recoverFrozenReady(frozen, events, prior, recut = false) {
        exact(frozen, frozenKeys(frozen));
        if (!frozenEncoding(frozen)
            || (recut ? events.length > frozen.nativeCut : frozen.nativeCut !== events.length))
            fail('SCHEMA_FROZEN_CUT_INVALID');
        const inherited = new Map(rowsForReady(prior).records.map(row => [row.key, row]));
        // Retain the supplied membership and order. Unioning the entire prior would
        // silently repair a missing ancestor record in the closed cut.
        const rows = frozen.records.map(row => {
            const previous = inherited.get(row.key);
            if (previous) {
                if (previous.record.recordSha256 !== row.record.recordSha256)
                    fail('SCHEMA_JOURNAL_WRITE_CONFLICT');
                return previous;
            }
            return Object.freeze({ key: row.key, record: validateClonedSchemaJournalRecord(row.record) });
        });
        const descriptors = new Map(frozen.schemaVersion !== 1 ? frozen.revisions.map(revision => [revision.descriptor.key, revision.descriptor.value]) : []), baseline = frozen.schemaVersion === 4 ? resolveBaseline(frozen.executionBaseline, frozen.sessionId) : undefined, scope = scopeBindings(null, baseline, 'scopeObjects' in frozen ? frozen.scopeObjects : []);
        const result = captured(deps.markers, frozen.sessionId, frozen.realmEpoch, events, new CheckedRows(Object.freeze(rows)), true, deps.recordOwner, prior, ref => descriptors.get(ref.key), deps.nativeHistory?.prefixes, scope.readScopeReferences, scope.captureScopeObjects, baseline);
        if (result.kind !== 'ready' || !recut && (result.frozen.nativePrefixSha256 !== frozen.nativePrefixSha256
            || schemaJournalHostFrontierSha256(result) !== frozen.frontierSha256
            || result.frozen.schemaVersion !== frozen.schemaVersion
            || frozen.schemaVersion !== 1 && !same(frozen.revisions, result.frozen.revisions))) {
            fail(result.kind === 'blocked' ? result.code : 'SCHEMA_FROZEN_CUT_INVALID');
        }
        return result;
    }
    return { put, captureLive, releaseSession, dispose() {
            liveDisposed = true;
            unobserveLive?.();
            unobserveLive = undefined;
            for (const sid of liveSessions.keys())
                releaseSession(sid);
            baselines.clear();
        },
        // Replay constructs and seals each production row from its owned inputs.
        // The actual readback owns its grammar; a producer receipt cannot settle it.
        putProduced: write, read, inventory, capture, captureChecked, recutChecked, validateFrozen, validateFrozenReady, recoverFrozenReady,
        captureFrozen: (sessionId, realmEpoch, events, rows, readRevision = ref => deps.table.get(ref.key), scopeObjects, executionBaseline) => {
            const scope = scopeBindings(null, executionBaseline, scopeObjects ?? []);
            return captured(deps.markers, sessionId, realmEpoch, events, { records: rows }, true, undefined, undefined, readRevision, deps.nativeHistory?.prefixes, scope.readScopeReferences, scope.captureScopeObjects, executionBaseline);
        } };
}
