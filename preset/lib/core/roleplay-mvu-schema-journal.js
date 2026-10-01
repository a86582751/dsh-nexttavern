// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-journal.ts; edit the TypeScript source.
/** Owned Domain execution facts. Numerical commits never select this history;
 * accepted and completed refused guest steps have the same ordering contract. */
import { createHash } from 'node:crypto';
import { recordSha256, stableJson } from './roleplay-data.js';
import { cloneSchemaData, cloneSchemaValues, validateSchemaProgram } from './tavern-mvu-schema-data.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
export const SCHEMA_JOURNAL_BOUNDS = Object.freeze({ records: 512,
    bytes: MVU_SCHEMA_BOUNDS.programBytes + MVU_SCHEMA_BOUNDS.inputBytes + MVU_SCHEMA_BOUNDS.outputBytes + 131072 });
const bounds = { nodes: MVU_SCHEMA_BOUNDS.evaluationNodes, depth: MVU_SCHEMA_BOUNDS.evaluationDepth };
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
export function schemaNativePrefixSha256(events, cuts) {
    for (const cut of cuts)
        if (!integer(cut) || cut > events.length)
            fail('SCHEMA_NATIVE_CUT_INVALID');
    const selected = new Set([...cuts, events.length]);
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
function exact(value, keys) {
    if (!same(Object.keys(value).sort(), [...keys].sort()))
        fail('SCHEMA_JOURNAL_SHAPE');
}
export function freezeSchemaJournalData(input) {
    const value = cloneSchemaData(input, SCHEMA_JOURNAL_BOUNDS.bytes, bounds);
    function freeze(item) {
        if (item && typeof item === 'object') {
            for (const child of Object.values(item))
                freeze(child);
            Object.freeze(item);
        }
    }
    freeze(value);
    return value;
}
export function sealSchemaJournalRecord(body) {
    return freezeSchemaJournalData({ ...body, recordSha256: recordSha256(freezeSchemaJournalData(body)) });
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
function loadFrame(value) {
    exact(value, ['schemaVersion', 'ownerSessionId', 'sourceNativeCutSha256', 'material', 'values', 'context', 'clockEpochMs', 'randomSeed']);
    if (value.schemaVersion !== 1 || !id(value.ownerSessionId) || !hash(value.sourceNativeCutSha256)
        || !integer(value.clockEpochMs) || typeof value.randomSeed !== 'string' || !value.randomSeed.length || value.randomSeed.length > 256) {
        fail('SCHEMA_LOAD_FRAME_INVALID');
    }
    cloneSchemaValues(value.values);
    cloneSchemaValues(value.material);
    cloneSchemaValues(value.context);
    if (Object.hasOwn(value.context, 'stat_data'))
        fail('SCHEMA_CONTEXT_INVALID');
}
function requested(value) {
    exact(value, ['eventId', 'frame']);
    if (typeof value.eventId !== 'string' || !value.eventId.length || value.eventId.length > 256)
        fail('SCHEMA_STEP_INVALID');
    const frame = value.frame;
    exact(frame, ['ownerSessionId', 'sourceNativeCutSha256', 'material', 'input']);
    if (!id(frame.ownerSessionId) || !hash(frame.sourceNativeCutSha256))
        fail('SCHEMA_STEP_INVALID');
    cloneSchemaValues(frame.material);
    const input = frame.input;
    exact(input, ['schemaVersion', 'phase', 'base', 'values', 'commands', 'context', 'clockEpochMs', 'randomSeed']);
    if (input.schemaVersion !== 1 || !['initialization', 'command-parsed', 'commands-parsed', 'update-ended', 'manual-replacement'].includes(input.phase)
        || !Array.isArray(input.commands) || !integer(input.clockEpochMs) || typeof input.randomSeed !== 'string'
        || !input.randomSeed.length || input.randomSeed.length > 256)
        fail('SCHEMA_STEP_INVALID');
    cloneSchemaValues(input.values);
    cloneSchemaValues(input.context);
    if (input.base !== null)
        cloneSchemaValues(input.base);
    for (const command of input.commands)
        cloneSchemaValues(command);
    if (Object.hasOwn(input.context, 'stat_data'))
        fail('SCHEMA_CONTEXT_INVALID');
}
const partialCodes = new Set(['SCHEMA_VM_TIMEOUT', 'SCHEMA_HARD_TIMEOUT', 'SCHEMA_JOB_LIMIT', 'SCHEMA_ASYNC_UNSETTLED',
    'SCHEMA_OUTPUT_LIMIT', 'SCHEMA_MEMORY_LIMIT', 'SCHEMA_GUEST_ERROR']);
function output(value) {
    if (value.kind === 'accepted') {
        exact(value, ['kind', 'values', 'commands', 'context', 'registrations']);
        cloneSchemaValues(value.values);
        cloneSchemaValues(value.context);
        if (!integer(value.registrations, 1) || value.registrations > MVU_SCHEMA_BOUNDS.scripts || !Array.isArray(value.commands)
            || Object.hasOwn(value.context, 'stat_data'))
            fail('SCHEMA_OUTPUT_INVALID');
        for (const command of value.commands)
            cloneSchemaValues(command);
    }
    else if (value.kind === 'refused') {
        exact(value, ['kind', 'diagnostics']);
        if (!Array.isArray(value.diagnostics) || !value.diagnostics.length || value.diagnostics.length > 64)
            fail('SCHEMA_OUTPUT_INVALID');
        for (const diagnostic of value.diagnostics) {
            exact(diagnostic, ['code']);
            if (typeof diagnostic.code !== 'string' || !/^SCHEMA_[A-Z_]+$/.test(diagnostic.code) || partialCodes.has(diagnostic.code)) {
                fail('SCHEMA_PARTIAL_EXECUTION');
            }
        }
    }
    else
        fail('SCHEMA_OUTPUT_INVALID');
}
export function validateSchemaJournalRecord(input) {
    const row = freezeSchemaJournalData(input), common = ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'recordSha256'];
    if (row.schemaVersion !== 1 || !id(row.sessionId) || !hash(row.realmEpoch) || !hash(row.recordSha256))
        fail('SCHEMA_JOURNAL_INVALID');
    const { recordSha256: checksum, ...body } = row;
    if (recordSha256(body) !== checksum)
        fail('SCHEMA_JOURNAL_HASH_MISMATCH');
    if (row.encoding === 'native-mvu-schema-epoch-v1') {
        exact(row, [...common, 'program', 'runner', 'loadFrame', 'loadAnchorSha256']);
        validateSchemaProgram(row.program);
        runnerIdentity(row.runner);
        loadFrame(row.loadFrame);
        if (row.loadFrame.ownerSessionId !== row.sessionId || row.loadAnchorSha256 !== recordSha256({
            programSha256: row.program.programSha256, realmEpoch: row.realmEpoch, loadFrame: row.loadFrame
        }))
            fail('SCHEMA_LOAD_ANCHOR_INVALID');
    }
    else if (row.encoding === 'native-mvu-schema-dispatch-v1') {
        exact(row, [...common, 'batchId', 'ordinal', 'epoch', 'previousTailSha256', 'requestedStep', 'sourceNativeCut']);
        ref(row.epoch);
        requested(row.requestedStep);
        validateSchemaSourceCut(row.sourceNativeCut);
        if (!id(row.batchId) || !integer(row.ordinal, 1) || !hash(row.previousTailSha256)
            || row.sourceNativeCut.sessionId !== row.sessionId || row.sourceNativeCut.ownerSessionId !== row.sessionId
            || row.requestedStep.frame.ownerSessionId !== row.sessionId
            || row.requestedStep.frame.sourceNativeCutSha256 !== recordSha256(row.sourceNativeCut)
            || recordSha256(row.requestedStep.frame.material) !== row.sourceNativeCut.materialSha256)
            fail('SCHEMA_DISPATCH_INVALID');
    }
    else if (row.encoding === 'native-mvu-schema-completion-v1') {
        exact(row, [...common, 'batchId', 'dispatch', 'dispatchMarker', 'runner', 'step']);
        ref(row.dispatch);
        markerRef(row.dispatchMarker);
        runnerIdentity(row.runner);
        if (!id(row.batchId))
            fail('SCHEMA_JOURNAL_INVALID');
        exact(row.step, ['eventId', 'frameSha256', 'ordinal', 'previousStepSha256', 'output', 'stepSha256']);
        output(row.step.output);
        if (typeof row.step.eventId !== 'string' || !row.step.eventId.length || row.step.eventId.length > 256
            || !integer(row.step.ordinal, 1) || ![row.step.previousStepSha256, row.step.frameSha256, row.step.stepSha256].every(hash)) {
            fail('SCHEMA_STEP_INVALID');
        }
    }
    else if (row.encoding === 'native-mvu-schema-unavailable-v1') {
        exact(row, [...common, 'batchId', 'dispatch', 'sourceNativeCut', 'code']);
        if (row.dispatch !== null)
            ref(row.dispatch);
        validateSchemaSourceCut(row.sourceNativeCut);
        if (!id(row.batchId) || row.sourceNativeCut.sessionId !== row.sessionId
            || typeof row.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,95}$/.test(row.code))
            fail('SCHEMA_UNAVAILABLE_INVALID');
    }
    else
        fail('SCHEMA_JOURNAL_SHAPE');
    return row;
}
export const schemaEpochKey = (sid, epoch) => `${sid}__mvu-schema-epoch-${epoch}`;
export const schemaDispatchKey = (sid, epoch, batch) => `${sid}__mvu-schema-dispatch-${epoch}-${batch}`;
export const schemaCompletionKey = (sid, epoch, batch) => `${sid}__mvu-schema-completion-${epoch}-${batch}`;
export const schemaUnavailableKey = (sid, epoch, batch) => `${sid}__mvu-schema-unavailable-${epoch}-${batch}`;
export function schemaJournalKey(row) {
    if (row.encoding === 'native-mvu-schema-epoch-v1')
        return schemaEpochKey(row.sessionId, row.realmEpoch);
    if (row.encoding === 'native-mvu-schema-dispatch-v1')
        return schemaDispatchKey(row.sessionId, row.realmEpoch, row.batchId);
    if (row.encoding === 'native-mvu-schema-completion-v1')
        return schemaCompletionKey(row.sessionId, row.realmEpoch, row.batchId);
    return schemaUnavailableKey(row.sessionId, row.realmEpoch, row.batchId);
}
const reference = (row) => ({ key: schemaJournalKey(row), sha256: row.recordSha256 });
function captured(markers, sessionId, realmEpoch, events, rows, historical = false) {
    try {
        if (!id(sessionId) || !hash(realmEpoch) || rows.length > SCHEMA_JOURNAL_BOUNDS.records)
            fail('SCHEMA_JOURNAL_LIMIT');
        markers.assertHistory(events);
        const records = freezeSchemaJournalData(rows), all = new Map();
        for (const { key, record } of records) {
            validateSchemaJournalRecord(record);
            if (key !== schemaJournalKey(record) || all.has(key))
                fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID');
            all.set(key, record);
        }
        const relevant = records.filter(item => item.record.realmEpoch === realmEpoch);
        const epochs = relevant.filter(item => item.record.encoding === 'native-mvu-schema-epoch-v1');
        const native = events.filter(event => (event.type === markers.dispatchEventType || event.type === markers.completionEventType)
            && event.data.realmEpoch === realmEpoch);
        if (!epochs.length && !relevant.length && !native.length)
            return { kind: 'absent', code: 'SCHEMA_REALM_HISTORY_UNPROVEN' };
        if (epochs.length !== 1)
            fail('SCHEMA_REALM_HISTORY_UNPROVEN');
        const epoch = epochs[0].record, epochRef = reference(epoch);
        const nativePrefixes = schemaNativePrefixSha256(events, native.filter(event => event.type === markers.dispatchEventType).map(event => event.seq));
        let tail = epoch.loadAnchorSha256;
        let pending;
        const steps = [], selected = new Set([epochRef.key]), seenEvents = new Set();
        for (const event of native) {
            if (event.type === markers.dispatchEventType) {
                const marker = event.data;
                const key = schemaDispatchKey(marker.sessionId, realmEpoch, marker.batchId), row = all.get(key);
                if (!row || row.encoding !== 'native-mvu-schema-dispatch-v1')
                    fail('SCHEMA_DISPATCH_UNPROVEN');
                if (row.recordSha256 !== marker.dispatchRecordSha256 || !same(row.epoch, epochRef) || row.ordinal !== steps.length + 1
                    || row.previousTailSha256 !== tail || marker.previousTailSha256 !== tail
                    || marker.programSha256 !== epoch.program.programSha256 || marker.sourceSha256 !== epoch.program.source.sourceSha256
                    || marker.loadDescriptorSha256 !== (steps.length === 0 ? epoch.recordSha256 : null)
                    || row.sourceNativeCut.nativeCut !== event.seq || row.sourceNativeCut.nativePrefixSha256 !== nativePrefixes.get(event.seq)
                    || seenEvents.has(row.requestedStep.eventId))
                    fail('SCHEMA_DISPATCH_UNPROVEN');
                if (steps.length === 0 && !same(epoch.loadFrame.sourceNativeCutSha256, row.requestedStep.frame.sourceNativeCutSha256)) {
                    fail('SCHEMA_LOAD_BOUNDARY_INVALID');
                }
                seenEvents.add(row.requestedStep.eventId);
                selected.add(key);
                pending = { dispatch: row, dispatchRef: reference(row), dispatchMarker: { seq: event.seq, sha256: recordSha256(event) } };
            }
            else if (event.type === markers.completionEventType) {
                const marker = event.data, key = schemaCompletionKey(marker.sessionId, realmEpoch, marker.batchId), row = all.get(key);
                if (!pending || !row || row.encoding !== 'native-mvu-schema-completion-v1')
                    fail('SCHEMA_COMPLETION_UNPROVEN');
                if (row.recordSha256 !== marker.completionRecordSha256 || !same(row.runner, epoch.runner) || !same(row.dispatch, pending.dispatchRef)
                    || !same(row.dispatchMarker, pending.dispatchMarker) || marker.dispatchSeq !== pending.dispatchMarker.seq
                    || marker.dispatchRecordSha256 !== pending.dispatch.recordSha256 || row.step.ordinal !== steps.length + 1
                    || row.step.previousStepSha256 !== tail || row.step.eventId !== pending.dispatch.requestedStep.eventId
                    || row.step.frameSha256 !== recordSha256(pending.dispatch.requestedStep.frame)
                    || marker.completedTailSha256 !== row.step.stepSha256)
                    fail('SCHEMA_COMPLETION_UNPROVEN');
                const { frameSha256: _frameHash, ...receipt } = row.step;
                const step = { ...receipt, frame: pending.dispatch.requestedStep.frame }, { stepSha256, ...body } = step;
                if (recordSha256(body) !== stepSha256)
                    fail('SCHEMA_COMPLETION_UNPROVEN');
                selected.add(key);
                steps.push({ ...pending, completion: row, completionRef: reference(row), step,
                    completionMarker: { seq: event.seq, sha256: recordSha256(event) } });
                tail = row.step.stepSha256;
                pending = undefined;
            }
        }
        if (pending)
            fail('SCHEMA_NATIVE_PAIR_PENDING');
        if (steps.length > MVU_SCHEMA_BOUNDS.traceSteps)
            fail('SCHEMA_JOURNAL_LIMIT');
        for (const { key, record } of relevant)
            if (!selected.has(key)) {
                if (historical && record.encoding === 'native-mvu-schema-dispatch-v1' && record.sourceNativeCut.nativeCut >= events.length)
                    continue;
                if (historical && record.encoding === 'native-mvu-schema-completion-v1' && record.dispatchMarker.seq >= events.length)
                    continue;
                if (historical && record.encoding === 'native-mvu-schema-unavailable-v1' && record.sourceNativeCut.nativeCut >= events.length)
                    continue;
                fail(record.encoding === 'native-mvu-schema-unavailable-v1' ? 'SCHEMA_EPOCH_UNAVAILABLE' : 'SCHEMA_DISPATCH_PENDING');
            }
        if (!steps.length)
            fail('SCHEMA_REALM_HISTORY_UNPROVEN');
        const frontierSha256 = recordSha256({ epoch: epochRef, steps: steps.map(step => ({ dispatch: step.dispatchRef, completion: step.completionRef,
                dispatchMarker: step.dispatchMarker, completionMarker: step.completionMarker, tail: step.completion.step.stepSha256 })) });
        const frozen = { schemaVersion: 1, encoding: 'native-mvu-schema-frozen-cut-v1', sessionId, realmEpoch,
            nativeCut: events.length, nativePrefixSha256: nativePrefixes.get(events.length),
            records: records.filter(item => selected.has(item.key)), frontierSha256 };
        // Rows already passed one aggregate budget and are deeply frozen. Reuse
        // their immutable frames in facts rather than cloning the same legal input
        // again into both the steps view and its persisted-cut view.
        for (const step of steps) {
            Object.freeze(step.dispatchRef);
            Object.freeze(step.completionRef);
            Object.freeze(step.dispatchMarker);
            Object.freeze(step.completionMarker);
            Object.freeze(step.step);
            Object.freeze(step);
        }
        return Object.freeze({ kind: 'ready', epoch, epochRef: Object.freeze(epochRef), steps: Object.freeze(steps),
            tailSha256: tail, frontierSha256, frozen: freezeSchemaJournalData(frozen) });
    }
    catch (error) {
        return { kind: 'blocked', code: codeOf(error) };
    }
}
export function createRoleplayMvuSchemaJournal(deps) {
    function read(key) {
        const row = deps.table.get(key);
        if (row === undefined)
            return;
        const record = validateSchemaJournalRecord(row);
        if (schemaJournalKey(record) !== key)
            fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID');
        return record;
    }
    function inventory(sessionId) {
        if (!id(sessionId))
            fail('SCHEMA_JOURNAL_OWNER_INVALID');
        const rows = [];
        for (const [key] of deps.table.entries())
            if (key.startsWith(`${sessionId}__mvu-schema-`)) {
                if (rows.length >= SCHEMA_JOURNAL_BOUNDS.records)
                    fail('SCHEMA_JOURNAL_LIMIT');
                const record = read(key);
                if (!record || record.sessionId !== sessionId)
                    fail('SCHEMA_JOURNAL_MEMBERSHIP_INVALID');
                rows.push({ key, record });
            }
        return freezeSchemaJournalData(rows);
    }
    async function put(input) {
        const record = validateSchemaJournalRecord(input), key = schemaJournalKey(record), prior = read(key);
        if (prior && !same(prior, record))
            fail('SCHEMA_JOURNAL_WRITE_CONFLICT');
        if (!prior)
            try {
                await deps.table.put(key, record);
            }
            catch { /* Lost ACK is resolved only by exact readback. */ }
        const actual = read(key);
        if (!actual || !same(actual, record))
            fail('SCHEMA_JOURNAL_WRITE_UNKNOWN');
        return freezeSchemaJournalData(reference(actual));
    }
    function capture(sessionId, realmEpoch, events, inherited = null) {
        try {
            const inheritedRows = inherited ? validateFrozen(inherited, events.slice(0, inherited.nativeCut)).records : [];
            const rows = [...inheritedRows];
            for (const row of inventory(sessionId)) {
                const previous = rows.find(item => item.key === row.key);
                if (previous && !same(previous, row))
                    fail('SCHEMA_JOURNAL_WRITE_CONFLICT');
                if (!previous)
                    rows.push(row);
            }
            return captured(deps.markers, sessionId, realmEpoch, events, rows);
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    function validateFrozen(input, events) {
        const frozen = freezeSchemaJournalData(input);
        exact(frozen, ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'nativeCut', 'nativePrefixSha256', 'records', 'frontierSha256']);
        if (frozen.schemaVersion !== 1 || frozen.encoding !== 'native-mvu-schema-frozen-cut-v1' || frozen.nativeCut !== events.length
            || frozen.nativePrefixSha256 !== recordSha256(events))
            fail('SCHEMA_FROZEN_CUT_INVALID');
        const result = captured(deps.markers, frozen.sessionId, frozen.realmEpoch, events, frozen.records, true);
        if (result.kind !== 'ready' || result.frontierSha256 !== frozen.frontierSha256)
            fail(result.kind === 'blocked' ? result.code : 'SCHEMA_FROZEN_CUT_INVALID');
        return result.frozen;
    }
    return { put, read, inventory, capture, validateFrozen,
        captureFrozen: (sessionId, realmEpoch, events, rows) => captured(deps.markers, sessionId, realmEpoch, events, rows, true) };
}
