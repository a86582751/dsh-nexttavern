// Generated from runtime/alpha3/src/core/roleplay-mvu-prompt-numerical-facts.ts; edit the TypeScript source.
/** Detached numerical prompt facts. This formatter owns no table, Agent,
 * Source lease, Native permission or reducer. Only the existing state/derived
 * readers collect its inputs after their complete authoritative fold succeeds. */
import { types as nodeTypes } from 'node:util';
import { recordSha256, sha256 } from './roleplay-data.js';
export const MVU_PROMPT_FACTS_BOUNDS = Object.freeze({ bytes: 16_777_216, nodes: 512_000, depth: 96,
    arrayLength: 32_000, publications: 8192, snapshots: 8192, inventory: 16_384, layers: 32 });
export class MvuPromptFactsRefusal extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
function fail(code) { throw new MvuPromptFactsRefusal(code); }
const equal = (a, b) => recordSha256(a) === recordSha256(b);
/** Facts use one bounded detached pool, not a fresh values copy per no-update
 * publication. This budget is for the ephemeral whole fact view, unlike the
 * existing per-persisted-record authority budgets; it cannot truncate to absent. */
function frozenFacts(input) {
    let nodes = 0, bytes = 0;
    const ancestors = new Set(), copies = new WeakMap();
    function copy(value, depth) {
        if (++nodes > MVU_PROMPT_FACTS_BOUNDS.nodes || depth > MVU_PROMPT_FACTS_BOUNDS.depth)
            fail('PROMPT_NUMERICAL_FACTS_LIMIT');
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
                fail('PROMPT_NUMERICAL_FACTS_INVALID');
            return Object.is(value, -0) ? 0 : value;
        }
        if (typeof value === 'string') {
            bytes += Buffer.byteLength(value, 'utf8');
            if (bytes > MVU_PROMPT_FACTS_BOUNDS.bytes)
                fail('PROMPT_NUMERICAL_FACTS_LIMIT');
            return value;
        }
        if (!value || typeof value !== 'object' || ancestors.has(value) || nodeTypes.isProxy(value))
            fail('PROMPT_NUMERICAL_FACTS_INVALID');
        const previous = copies.get(value);
        if (previous)
            return previous;
        const list = Array.isArray(value), prototype = Object.getPrototypeOf(value), props = Object.getOwnPropertyDescriptors(value);
        if (list ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            fail('PROMPT_NUMERICAL_FACTS_INVALID');
        const names = Reflect.ownKeys(props);
        if (names.some(name => typeof name !== 'string'))
            fail('PROMPT_NUMERICAL_FACTS_INVALID');
        const result = list ? [] : Object.create(null);
        copies.set(value, result);
        ancestors.add(value);
        if (list) {
            const length = props.length?.value;
            if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > MVU_PROMPT_FACTS_BOUNDS.arrayLength
                || names.length !== length + 1)
                fail('PROMPT_NUMERICAL_FACTS_INVALID');
            for (let i = 0; i < length; i++) {
                const property = props[String(i)];
                if (!property || !Object.hasOwn(property, 'value') || !property.enumerable)
                    fail('PROMPT_NUMERICAL_FACTS_INVALID');
                result.push(copy(property.value, depth + 1));
            }
        }
        else
            for (const name of names) {
                const property = props[name];
                if (['__proto__', 'constructor', 'prototype'].includes(name) || !Object.hasOwn(property, 'value') || !property.enumerable) {
                    fail('PROMPT_NUMERICAL_FACTS_INVALID');
                }
                bytes += Buffer.byteLength(name, 'utf8');
                if (bytes > MVU_PROMPT_FACTS_BOUNDS.bytes)
                    fail('PROMPT_NUMERICAL_FACTS_LIMIT');
                result[name] = copy(property.value, depth + 1);
            }
        ancestors.delete(value);
        return Object.freeze(result);
    }
    const value = copy(input, 0);
    // Include repeated JSON references, escaping, keys and metadata amplification.
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MVU_PROMPT_FACTS_BOUNDS.bytes)
        fail('PROMPT_NUMERICAL_FACTS_LIMIT');
    return value;
}
function inventory(scope, input) {
    const known = new Map();
    for (const row of input) {
        const normalized = { table: row.table, key: row.key, recordSha256: row.recordSha256,
            ...(row.fieldPointer ? { fieldPointer: row.fieldPointer } : {}) };
        const key = `${row.table}:${row.key}${row.fieldPointer ? ':' + row.fieldPointer : ''}`, old = known.get(key);
        if (old && !equal(old, normalized))
            fail('PROMPT_NUMERICAL_FACT_CONFLICT');
        known.set(key, normalized);
    }
    if (known.size > MVU_PROMPT_FACTS_BOUNDS.inventory)
        fail('PROMPT_NUMERICAL_FACTS_LIMIT');
    const rows = [...known.values()].sort((a, b) => {
        const left = `${a.table}:${a.key}${a.fieldPointer ? ':' + a.fieldPointer : ''}`, right = `${b.table}:${b.key}${b.fieldPointer ? ':' + b.fieldPointer : ''}`;
        return left === right ? 0 : left < right ? -1 : 1;
    });
    return { scope, rows, membershipSha256: recordSha256(rows) };
}
function snapshots(input) {
    const known = new Map();
    for (const row of input) {
        const { stateSnapshotSha256, ...body } = row;
        if (recordSha256(body) !== stateSnapshotSha256 || recordSha256(row.values) !== row.valuesSha256
            || recordSha256(row.currentHead) !== row.headSha256)
            fail('PROMPT_NUMERICAL_RESULT_INVALID');
        const old = known.get(stateSnapshotSha256);
        if (old && !equal(old, row))
            fail('PROMPT_NUMERICAL_FACT_CONFLICT');
        known.set(stateSnapshotSha256, row);
    }
    if (known.size > MVU_PROMPT_FACTS_BOUNDS.snapshots)
        fail('PROMPT_NUMERICAL_FACTS_LIMIT');
    return [...known.values()].sort((a, b) => a.stateSnapshotSha256 < b.stateSnapshotSha256 ? -1 : 1);
}
function resultMatches(settlement, base, result) {
    if (base.sessionId !== settlement.sessionId || result.sessionId !== settlement.sessionId
        || base.sourceSha256 !== settlement.sourceSha256 || result.sourceSha256 !== settlement.sourceSha256
        || base.stateSnapshotSha256 !== settlement.intent.base.stateSnapshotSha256
        || !equal(result.root, base.root) || !equal(result.currentHead, settlement.result.head)
        || result.headSha256 !== settlement.result.headSha256 || result.revision !== settlement.result.revision
        || result.valuesSha256 !== settlement.result.valuesSha256)
        fail('PROMPT_NUMERICAL_RESULT_INVALID');
}
function story(input) {
    const { settlement, base, result, ledgerStep } = input, intent = settlement.intent;
    const canonical = input.frozenCanonical ?? intent.canonical;
    if (!equal(canonical, intent.canonical))
        fail('PROMPT_NUMERICAL_CANONICAL_INVALID');
    resultMatches(settlement, base, result);
    const row = { kind: 'story', ownerSessionId: settlement.sessionId,
        numericalSourceSha256: settlement.sourceSha256, canonical, intent,
        intentRecordSha256: recordSha256(intent), preparationSnapshot: { key: intent.preparationSnapshot.key,
            recordSha256: intent.preparationSnapshot.sha256 }, completedReceiptSha256: settlement.completedReceiptSha256,
        settlement: { key: `${settlement.sessionId}__mvu-state-settlement-${intent.intentSha256}`,
            recordSha256: recordSha256(settlement), settlementSha256: settlement.settlementSha256 }, outcome: settlement.outcome,
        baseSnapshotSha256: base.stateSnapshotSha256, resultSnapshotSha256: result.stateSnapshotSha256,
        ...ledgerStep ? { ledgerStep } : {} };
    if (ledgerStep && (ledgerStep.intentSha256 !== intent.intentSha256 || ledgerStep.baseSnapshotSha256 !== row.baseSnapshotSha256
        || ledgerStep.resultSnapshotSha256 !== row.resultSnapshotSha256))
        fail('PROMPT_NUMERICAL_RESULT_INVALID');
    return row;
}
function manual(input) {
    const { settlement, base, result, ledgerStep } = input, intent = settlement.intent;
    resultMatches(settlement, base, result);
    return { kind: 'manual', ownerSessionId: settlement.sessionId, numericalSourceSha256: settlement.sourceSha256,
        operationId: intent.operationId, operation: { key: intent.operation.key, recordSha256: intent.operation.sha256 },
        marker: { seq: intent.marker.seq, eventRecordSha256: intent.marker.sha256 }, intentSha256: intent.intentSha256,
        intentRecordSha256: recordSha256(intent), settlement: { key: `${settlement.sessionId}__mvu-state-settlement-${intent.intentSha256}`,
            recordSha256: recordSha256(settlement), settlementSha256: settlement.settlementSha256 }, outcome: settlement.outcome,
        baseSnapshotSha256: base.stateSnapshotSha256, resultSnapshotSha256: result.stateSnapshotSha256,
        ...ledgerStep ? { ledgerStep } : {} };
}
const storyKey = (row) => `${row.ownerSessionId}:${row.canonical.seq}:${row.canonical.messageId}:${row.canonical.versionSha256}`;
function uniqueStories(input) {
    const known = new Map();
    for (const row of input) {
        const key = storyKey(row), old = known.get(key);
        if (old && !equal(old, row))
            fail('PROMPT_NUMERICAL_FACT_CONFLICT');
        known.set(key, row);
    }
    if (known.size > MVU_PROMPT_FACTS_BOUNDS.publications)
        fail('PROMPT_NUMERICAL_FACTS_LIMIT');
    return [...known.values()].sort((a, b) => a.canonical.seq - b.canonical.seq
        || (storyKey(a) === storyKey(b) ? 0 : storyKey(a) < storyKey(b) ? -1 : 1));
}
function uniqueManual(input) {
    const known = new Map();
    for (const row of input) {
        const key = `${row.ownerSessionId}:${row.intentSha256}`, old = known.get(key);
        if (old && !equal(old, row))
            fail('PROMPT_NUMERICAL_FACT_CONFLICT');
        known.set(key, row);
    }
    if (known.size > MVU_PROMPT_FACTS_BOUNDS.publications)
        fail('PROMPT_NUMERICAL_FACTS_LIMIT');
    return [...known.values()].sort((a, b) => a.marker.seq - b.marker.seq
        || (a.intentSha256 === b.intentSha256 ? 0 : a.intentSha256 < b.intentSha256 ? -1 : 1));
}
/** Both packet versions consume the same already validated state fold. Keep
 * story/manual association and ordering strict rather than creating a second
 * program-only publication interpretation. */
function localPublications(input) {
    const { settlements, settlementSnapshots } = input;
    const stories = [], manuals = [];
    for (const settlement of settlements.values()) {
        const captured = settlementSnapshots.get(settlement.intent.intentSha256);
        if (!captured)
            fail('PROMPT_NUMERICAL_RESULT_INVALID');
        const { base, result } = captured;
        if (settlement.encoding === 'native-mvu-state-publisher-settlement-v1')
            stories.push(story({ settlement, base, result }));
        else
            manuals.push(manual({ settlement, base, result }));
    }
    return { stories, manuals };
}
export function formatLocalMvuPromptFactsV1(input) {
    const { genesis, state, states, rows, genesisSnapshot: initial } = input;
    const { stories, manuals } = localPublications(input);
    const opening = 'initEvent' in genesis ? genesis.initEvent : undefined;
    const body = { schemaVersion: 1, encoding: 'native-json-prompt-numerical-facts-v1',
        authority: 'consumer-data-only', sessionId: state.sessionId, numericalSourceSha256: state.sourceSha256,
        genesis, genesisSnapshotSha256: initial.stateSnapshotSha256, genesisMessageRef: opening ? {
            ownerSessionId: genesis.sessionId, seq: opening.native.assistantSeq, messageId: opening.native.messageId,
            nativeEventRecordSha256: opening.native.messageVersion.eventSha256, renderedTextSha256: opening.native.renderedSha256
        } : null,
        sourceIdentity: opening ? { kind: 'opening', original: opening.plan.identity.source } :
            { kind: 'derived-basis', basisSha256: genesis.derivedEvent.basisSha256,
                derivedEventSha256: genesis.derivedEvent.eventSha256 },
        currentSnapshot: state, snapshots: snapshots([...states.values()]), storyPublications: uniqueStories(stories),
        manualPublications: uniqueManual(manuals), inventory: inventory('complete-owned-current-status', [...rows].map(([key, value]) => ({ table: 'status', key, recordSha256: recordSha256(value) }))) };
    return frozenFacts({ ...body, factsSha256: recordSha256(body) });
}
export function formatPrefixMvuPromptFactsV1(input) {
    const { proof, genesis, stories, manuals, rows } = input;
    const body = { schemaVersion: 1, encoding: 'native-json-prompt-prefix-facts-v1',
        authority: 'consumer-data-only', ownerSessionId: proof.ownerSessionId,
        ownerInheritedEventCount: proof.ownerInheritedEventCount, inheritedPrefixLength: proof.inheritedPrefixLength,
        historyPrefixSha256: proof.historyPrefixSha256, numericalSourceSha256: proof.sourceSha256,
        ledgerProofSha256: proof.proofSha256, genesisSnapshotSha256: genesis.stateSnapshotSha256,
        resultSnapshotSha256: proof.numericalSnapshot.stateSnapshotSha256,
        snapshots: snapshots([genesis, proof.numericalSnapshot, ...stories.flatMap(row => [row.base, row.result]),
            ...manuals.flatMap(row => [row.base, row.result])]), storyPublications: uniqueStories(stories.map(story)),
        manualPublications: uniqueManual(manuals.map(manual)), inventory: inventory('closed-inherited-numerical-cut', rows) };
    return frozenFacts({ ...body, factsSha256: recordSha256(body) });
}
export function formatInheritedMvuPromptFactsV1(input) {
    if (!input.layers.length || input.layers.length > MVU_PROMPT_FACTS_BOUNDS.layers
        || input.genesis.sessionId !== input.childSessionId || input.source.childSessionId !== input.childSessionId
        || input.genesis.sourceSha256 !== input.source.childSourceSha256)
        fail('PROMPT_NUMERICAL_INHERITED_INVALID');
    const openings = [], known = new Set();
    for (const row of input.openings) {
        if (row.genesis.sessionId !== row.snapshot.sessionId || row.genesis.initEvent.native.assistantSeq !== row.canonical.seq
            || row.genesis.initEvent.native.messageId !== row.canonical.messageId
            || row.genesis.initEvent.native.messageVersion.eventSha256 !== row.nativeEventRecordSha256
            || row.genesis.initEvent.plan.identity.renderedSha256 !== row.canonical.narrativeSha256)
            fail('PROMPT_NUMERICAL_OPENING_INVALID');
        const key = `${row.genesis.sessionId}:${row.canonical.seq}:${row.canonical.versionSha256}`;
        if (known.has(key))
            fail('PROMPT_NUMERICAL_FACT_CONFLICT');
        known.add(key);
        openings.push({ kind: 'opening', ownerSessionId: row.genesis.sessionId, canonical: row.canonical,
            nativeEventRecordSha256: row.nativeEventRecordSha256, initializationEvent: row.genesis.initEvent,
            initializationHead: row.genesis.initHead, initializationIntent: row.intent,
            source: row.genesis.initEvent.plan.identity.source, selectedSwipeIdentity: row.genesis.initEvent.plan.selectedSwipeIdentity,
            resultSnapshotSha256: row.snapshot.stateSnapshotSha256 });
    }
    const inventoryRows = [...input.prefixes.flatMap(row => [...row.inventory.rows, ...row.inputClosure ? [row.inputClosure] : []]),
        ...input.layers.flatMap(row => [
            row.basis, row.prepared, row.derivedEvent, row.derivedHead, row.operation
        ]), ...input.openings.flatMap(row => [
            row.intent, row.historical?.event ?? { table: 'status', key: `${row.genesis.sessionId}__mvu-init-event-${row.genesis.initEvent.eventId}`,
                recordSha256: recordSha256(row.genesis.initEvent) },
            row.historical?.head ?? { table: 'status', key: `${row.genesis.sessionId}__mvu-init-head`,
                recordSha256: recordSha256(row.genesis.initHead) }
        ])];
    const body = { schemaVersion: 1, encoding: 'native-json-prompt-inherited-facts-v1',
        authority: 'consumer-data-only', childSessionId: input.childSessionId, numericalSourceSha256: input.genesis.sourceSha256,
        genesis: input.genesis, source: input.source, originalImport: input.source.originalImport, layers: input.layers,
        snapshots: snapshots([...input.prefixes.flatMap(row => row.snapshots),
            ...input.openings.map(row => row.snapshot)]), openingPublications: openings,
        storyPublications: uniqueStories(input.prefixes.flatMap(row => row.storyPublications)),
        manualPublications: uniqueManual(input.prefixes.flatMap(row => row.manualPublications)),
        inventory: inventory('closed-inherited-numerical-cut', inventoryRows) };
    return frozenFacts({ ...body, factsSha256: recordSha256(body) });
}
