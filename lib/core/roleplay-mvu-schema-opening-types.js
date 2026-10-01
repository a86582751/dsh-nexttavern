// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-opening-types.ts; edit the TypeScript source.
/** Versioned schema opening facts. Shape/hash checks prove integrity only;
 * actual Source, Native history and private publication authority belong to Core. */
import { types } from 'node:util';
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneSchemaValues } from './tavern-mvu-schema-data.js';
export const MVU_SCHEMA_OPENING_BOUNDS = Object.freeze({ bytes: 4_194_304, depth: 72, nodes: 131072 });
export const schemaOpeningCode = (value) => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,95}$/.test(value)
    ? value : 'SCHEMA_OPENING_UNKNOWN';
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value, max = 128) => typeof value === 'string' && value.length <= max && /^[A-Za-z0-9_-]+$/.test(value);
const integer = (value, min = 0) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && !Object.is(value, -0);
const same = (a, b) => recordSha256(a) === recordSha256(b);
function fail() { throw Error('SCHEMA_OPENING_RECORD_INVALID'); }
function exact(value, required, optional = []) {
    const keys = Object.keys(value);
    if (required.some(key => !keys.includes(key)) || keys.some(key => !required.includes(key) && !optional.includes(key)))
        fail();
}
/** This envelope permits depth 72; shared execution envelopes deliberately cap
 * at 66. Values retain their original independent 1 MiB/depth bounds. */
export function freezeMvuSchemaOpeningData(input) {
    const seen = new Set(), limit = MVU_SCHEMA_OPENING_BOUNDS;
    let nodes = 0, bytes = 0;
    function count(text) { bytes += Buffer.byteLength(text, 'utf8'); if (bytes > limit.bytes)
        fail(); }
    function copy(value, depth) {
        if (++nodes > limit.nodes || depth > limit.depth)
            fail();
        if (value === null || typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            count(value);
            return value;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
                fail();
            return Object.is(value, -0) ? 0 : value;
        }
        if (typeof value !== 'object' || types.isProxy(value) || seen.has(value))
            fail();
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
            fail();
        if (Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length > limit.nodes - nodes + 1)
            fail();
        const descriptors = Object.getOwnPropertyDescriptors(value), keys = Object.keys(descriptors);
        seen.add(value);
        let result;
        if (array) {
            const length = descriptors.length?.value;
            if (!integer(length) || length > limit.nodes || keys.some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))
                fail();
            const items = [];
            for (let index = 0; index < length; index++) {
                const descriptor = descriptors[index];
                if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
                    fail();
                items.push(copy(descriptor.value, depth + 1));
            }
            result = items;
        }
        else {
            const object = {};
            for (const key of keys) {
                count(key);
                const descriptor = descriptors[key];
                if (['__proto__', 'constructor', 'prototype'].includes(key) || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
                    fail();
                object[key] = copy(descriptor.value, depth + 1);
            }
            result = object;
        }
        seen.delete(value);
        return Object.freeze(result);
    }
    const value = copy(input, 0);
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > limit.bytes)
        fail();
    return value;
}
export function sealMvuSchemaOpeningFact(body, field) {
    const value = freezeMvuSchemaOpeningData(body);
    return freezeMvuSchemaOpeningData({ ...value, [field]: recordSha256(value) });
}
function fact(value, field) {
    const { [field]: checksum, ...body } = value;
    if (!hash(checksum) || recordSha256(body) !== checksum)
        fail();
}
export function mvuSchemaOpeningIdentity(intent) {
    return { sessionId: intent.sessionId, source: intent.source, operationId: intent.operationId, messageId: intent.messageId,
        index: intent.index, sourcePointer: intent.sourcePointer, sourceSha256: intent.sourceSha256, renderedSha256: intent.renderedSha256 };
}
function identity(value) {
    exact(value, ['sessionId', 'source', 'operationId', 'messageId', 'index', 'sourcePointer', 'sourceSha256', 'renderedSha256']);
    const source = value.source, pointer = source.pointer;
    exact(source, ['sessionId', 'importId', 'sourceRecordSessionId', 'rawSha256', 'normalizedSha256', 'transactionId', 'coverageSha256', 'pointer']);
    exact(pointer, ['importId', 'normalizedSha256', 'transactionId', 'coverageSha256'], ['sourceRecordSessionId', 'activatedAt']);
    if (!id(value.sessionId, 64) || !id(value.operationId) || !id(value.messageId) || !integer(value.index)
        || source.sessionId !== value.sessionId || !id(source.importId, 64) || !id(source.sourceRecordSessionId, 64)
        || !id(source.transactionId) || pointer.importId !== source.importId || pointer.normalizedSha256 !== source.normalizedSha256
        || pointer.transactionId !== source.transactionId || pointer.coverageSha256 !== source.coverageSha256
        || Object.hasOwn(pointer, 'activatedAt') && !integer(pointer.activatedAt)
        || (pointer.sourceRecordSessionId ?? value.sessionId) !== source.sourceRecordSessionId
        || typeof value.sourcePointer !== 'string' || !value.sourcePointer.startsWith('/') || value.sourcePointer.length > 512
        || ![source.rawSha256, source.normalizedSha256, source.coverageSha256, value.sourceSha256, value.renderedSha256].every(hash)
        || value.messageId !== `opening-${sha256(`${value.sessionId}\0${source.importId}\0${value.operationId}`).slice(0, 32)}`)
        fail();
}
export function deriveMvuSchemaOpeningExecution(input) {
    const value = freezeMvuSchemaOpeningData(input);
    identity(value);
    const realmEpoch = recordSha256({ schemaVersion: 1, encoding: 'native-mvu-schema-opening-execution-identity-v1', identity: value });
    return freezeMvuSchemaOpeningData({ realmEpoch, selector: { sessionId: value.sessionId, batchId: `opening-${realmEpoch}`,
            anchor: { kind: 'opening', operationId: value.operationId, messageId: value.messageId, importId: value.source.importId, selectedIndex: value.index } } });
}
function inputFacts(value) {
    identity(value.identity);
    const snapshot = value.sourceSnapshot, init = value.initSource, proof = value.freshNativeBasisProof, selected = snapshot.selected;
    exact(snapshot, ['schemaVersion', 'encoding', 'source', 'pointerSha256', 'importRecordSha256', 'coverageSha256', 'materialRows',
        'settings', 'bindings', 'selected', 'swipes', 'macroContext', 'documentSha256', 'snapshotSha256']);
    exact(selected, ['index', 'pointer', 'sourceSha256', 'renderedSha256']);
    exact(init, ['schemaVersion', 'encoding', 'grammar', 'books', 'bookStatData', 'initializedBooks', 'messageIndex',
        'selectedSwipeIdentity', 'swipes', 'macros', 'initSourceSha256']);
    exact(proof, ['schemaVersion', 'encoding', 'sessionId', 'ownerSessionId', 'branch', 'numerical', 'native',
        'bookStatDataSha256', 'swipes', 'factsSha256', 'proofSha256']);
    exact(proof.branch, ['metaKey', 'metaSha256', 'inheritance', 'parentSessionId', 'inheritedPrefixLength', 'ready']);
    exact(proof.numerical, ['headKey', 'headExists', 'eventMembershipSha256', 'eventCount', 'opaqueStateExists']);
    exact(proof.native, ['observedThroughSeq', 'historyVersionSha256', 'committedOpeningCount', 'inheritedMessageCount']);
    fact(snapshot, 'snapshotSha256');
    fact(init, 'initSourceSha256');
    fact(proof, 'proofSha256');
    if (!hash(value.authorSourceSha256) || snapshot.schemaVersion !== 1 || snapshot.encoding !== 'native-mvu-author-source-snapshot-v1'
        || ![snapshot.documentSha256, snapshot.pointerSha256, snapshot.importRecordSha256, snapshot.coverageSha256].every(hash)
        || !same(snapshot.source, value.identity.source) || selected.index !== value.identity.index
        || selected.pointer !== value.identity.sourcePointer || selected.sourceSha256 !== value.identity.sourceSha256
        || selected.renderedSha256 !== value.identity.renderedSha256 || init.schemaVersion !== 1
        || init.encoding !== 'native-mvu-schema-opening-init-source-v1' || !['strict-json-object-v1', 'yaml-1.2-json-data-v1'].includes(init.grammar)
        || init.messageIndex !== 0 || !Array.isArray(init.initializedBooks) || init.initializedBooks.length !== 0
        || !['none', 'verified-identity-rendering'].includes(init.macros) || !Array.isArray(init.books) || !Array.isArray(init.swipes)
        || proof.schemaVersion !== 1 || proof.encoding !== 'native-mvu-fresh-basis-proof-v1'
        || proof.sessionId !== value.identity.sessionId || proof.ownerSessionId !== value.identity.sessionId
        || !integer(proof.native.observedThroughSeq, -1) || !hash(proof.native.historyVersionSha256)
        || proof.native.committedOpeningCount !== 0 || proof.native.inheritedMessageCount !== 0
        || proof.branch.inheritance !== 'root' || proof.branch.parentSessionId !== null || proof.branch.inheritedPrefixLength !== 0 || proof.branch.ready !== true
        || proof.numerical.headExists !== false || proof.numerical.eventCount !== 0 || proof.numerical.opaqueStateExists !== false
        || proof.numerical.eventMembershipSha256 !== recordSha256([]) || proof.branch.metaKey !== `${value.identity.sessionId}__meta`
        || proof.numerical.headKey !== `${value.identity.sessionId}__mvu-init-head` || !hash(proof.branch.metaSha256)
        || !hash(proof.factsSha256) || proof.bookStatDataSha256 !== recordSha256({}) || !Array.isArray(proof.swipes))
        fail();
    cloneSchemaValues(init.bookStatData);
    for (const swipe of init.swipes) {
        exact(swipe, ['identity', 'sourcePointer', 'sourceSha256', 'rawOpening', 'renderedOpening', 'renderedSha256', 'statData']);
        cloneSchemaValues(swipe.statData);
        if (typeof swipe.identity !== 'string' || !swipe.identity.length || typeof swipe.rawOpening !== 'string'
            || typeof swipe.renderedOpening !== 'string' || swipe.sourceSha256 !== sha256(swipe.rawOpening)
            || swipe.renderedSha256 !== sha256(swipe.renderedOpening))
            fail();
    }
    for (const book of init.books) {
        exact(book, ['identity', 'binding', 'sourcePointer', 'sourceSha256', 'entries']);
        if (book.binding !== 'primary' || !hash(book.sourceSha256) || !Array.isArray(book.entries))
            fail();
        for (const entry of book.entries) {
            exact(entry, ['identity', 'sourcePointer', 'comment', 'enabled', 'content', 'contentSha256', 'renderedContent', 'renderedContentSha256']);
            if (typeof entry.enabled !== 'boolean' || typeof entry.content !== 'string' || typeof entry.renderedContent !== 'string'
                || entry.contentSha256 !== sha256(entry.content) || entry.renderedContentSha256 !== sha256(entry.renderedContent))
                fail();
        }
    }
    if (proof.swipes.length !== snapshot.swipes.length)
        fail();
    for (const [index, swipe] of proof.swipes.entries()) {
        exact(swipe, ['identity', 'sourceSha256', 'statDataSha256']);
        if (swipe.identity !== snapshot.swipes[index].identity || swipe.sourceSha256 !== snapshot.swipes[index].sourceSha256
            || swipe.statDataSha256 !== recordSha256({}))
            fail();
    }
    const swipe = init.swipes.filter(item => item.identity === init.selectedSwipeIdentity);
    if (swipe.length !== 1 || swipe[0].sourceSha256 !== value.identity.sourceSha256
        || swipe[0].sourcePointer !== value.identity.sourcePointer || swipe[0].renderedSha256 !== value.identity.renderedSha256)
        fail();
}
export function validateMvuSchemaOpeningPreparation(input) {
    const value = freezeMvuSchemaOpeningData(input);
    exact(value, ['schemaVersion', 'encoding', 'identity', 'authorSourceSha256', 'sourceSnapshot', 'initSource', 'freshNativeBasisProof',
        'selector', 'realmEpoch', 'clockEpochMs', 'randomSeed', 'preparationSha256']);
    fact(value, 'preparationSha256');
    inputFacts(value);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-opening-preparation-v1' || !integer(value.clockEpochMs)
        || typeof value.randomSeed !== 'string' || !value.randomSeed.length || value.randomSeed.length > 256
        || !same({ realmEpoch: value.realmEpoch, selector: value.selector }, deriveMvuSchemaOpeningExecution(value.identity)))
        fail();
    return value;
}
function execution(value, plan) {
    exact(value, ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId', 'anchor', 'sourceNativeCutSha256', 'programSha256',
        'dispatch', 'completion', 'dispatchMarker', 'completionMarker', 'tailSha256', 'frontierSha256', 'outputSha256']);
    const derived = deriveMvuSchemaOpeningExecution(plan.identity);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-execution-association-v1'
        || value.sessionId !== plan.identity.sessionId || value.realmEpoch !== derived.realmEpoch
        || value.batchId !== derived.selector.batchId || !same(value.anchor, derived.selector.anchor)
        || ![value.sourceNativeCutSha256, value.programSha256, value.tailSha256, value.frontierSha256, value.outputSha256].every(hash))
        fail();
    for (const ref of [value.dispatch, value.completion]) {
        exact(ref, ['key', 'sha256']);
        if (!id(ref.key, 512) || !hash(ref.sha256))
            fail();
    }
    for (const ref of [value.dispatchMarker, value.completionMarker]) {
        exact(ref, ['seq', 'sha256']);
        if (!integer(ref.seq) || !hash(ref.sha256))
            fail();
    }
    if (value.dispatchMarker.seq !== plan.freshNativeBasisProof.native.observedThroughSeq + 1
        || value.completionMarker.seq !== value.dispatchMarker.seq + 1)
        fail();
}
export function validateMvuSchemaOpeningPlan(input) {
    const value = freezeMvuSchemaOpeningData(input);
    exact(value, ['schemaVersion', 'encoding', 'identity', 'selectedSwipeIdentity', 'authorSourceSha256', 'sourceSnapshot', 'initSource',
        'initialValuesSha256', 'freshNativeBasisProof', 'execution', 'values', 'valuesSha256', 'planSha256']);
    fact(value, 'planSha256');
    inputFacts(value);
    execution(value.execution, value);
    if (value.schemaVersion !== 3 || value.encoding !== 'mvu-programmatic-opening-plan-v3'
        || value.selectedSwipeIdentity !== value.initSource.selectedSwipeIdentity || !hash(value.initialValuesSha256)
        || value.valuesSha256 !== recordSha256(cloneSchemaValues(value.values)))
        fail();
    return value;
}
export function validateMvuSchemaNativeOpening(suppliedReceipt, suppliedIntent) {
    const receipt = freezeMvuSchemaOpeningData(suppliedReceipt), intent = freezeMvuSchemaOpeningData(suppliedIntent);
    exact(receipt, ['sessionId', 'operationId', 'messageId', 'renderedSha256', 'turn', 'assistantSeq', 'turnStartSeq', 'turnEndSeq', 'messageVersion', 'flushed']);
    exact(receipt.messageVersion, ['kind', 'eventSha256']);
    if (receipt.sessionId !== intent.sessionId || receipt.operationId !== intent.operationId || receipt.messageId !== intent.messageId
        || receipt.renderedSha256 !== intent.renderedSha256 || receipt.turn !== intent.committedTurn || !integer(receipt.turn, 1)
        || receipt.flushed !== true || receipt.messageVersion.kind !== 'original' || !hash(receipt.messageVersion.eventSha256)
        || ![receipt.assistantSeq, receipt.turnStartSeq, receipt.turnEndSeq].every(item => integer(item))
        || receipt.turnStartSeq >= receipt.assistantSeq || receipt.assistantSeq >= receipt.turnEndSeq
        || !intent.initialization || receipt.turnStartSeq !== intent.initialization.execution.completionMarker.seq + 1)
        fail();
}
export function validateMvuSchemaOpeningIntent(input) {
    const value = freezeMvuSchemaOpeningData(input);
    exact(value, ['schemaVersion', 'sessionId', 'source', 'index', 'sourcePointer', 'sourceSha256', 'renderedSha256', 'renderedText', 'messageId',
        'operationId', 'revision', 'mode', 'status', 'textRetained', 'preparation'], ['committedTurn', 'rejectionCode', 'initialization', 'initializationCode', 'nativeReceipt', 'initializationReceipt']);
    identity(mvuSchemaOpeningIdentity(value));
    validateMvuSchemaOpeningPreparation(value.preparation);
    if (value.schemaVersion !== 5 || value.mode !== 'schema' || value.textRetained !== true || !integer(value.revision, 1)
        || !['preparing', 'pending', 'native-committed', 'completed', 'blocked', 'unknown'].includes(value.status)
        || typeof value.renderedText !== 'string' || Buffer.byteLength(value.renderedText, 'utf8') > 65536 || sha256(value.renderedText) !== value.renderedSha256
        || !same(mvuSchemaOpeningIdentity(value), value.preparation.identity)
        || value.initializationCode !== undefined && schemaOpeningCode(value.initializationCode) !== value.initializationCode
        || value.rejectionCode !== undefined && !['PROGRAMMATIC_IDENTITY_CONFLICT', 'PROGRAMMATIC_OPEN_TURN', 'PROGRAMMATIC_MISSING_SYSTEM_HEAD',
            'PROGRAMMATIC_UNATTRIBUTED_FAILURE', 'PROGRAMMATIC_INCOMPLETE_TURN'].includes(value.rejectionCode))
        fail();
    if (value.initialization) {
        const plan = validateMvuSchemaOpeningPlan(value.initialization);
        for (const key of ['identity', 'authorSourceSha256', 'sourceSnapshot', 'initSource', 'freshNativeBasisProof']) {
            if (!same(plan[key], value.preparation[key]))
                fail();
        }
    }
    if (value.status === 'preparing' && (value.initialization !== undefined || value.committedTurn !== undefined || value.nativeReceipt !== undefined)
        || value.status === 'pending' && (value.committedTurn !== undefined || value.nativeReceipt !== undefined)
        || ['pending', 'native-committed', 'completed'].includes(value.status) && !value.initialization
        || value.committedTurn !== undefined && !integer(value.committedTurn, 1)
        || ['native-committed', 'completed'].includes(value.status) && value.committedTurn === undefined)
        fail();
    if (value.nativeReceipt)
        validateMvuSchemaNativeOpening(value.nativeReceipt, value);
    if (value.status === 'completed' && (!value.nativeReceipt || !value.initializationReceipt))
        fail();
    if (value.initializationReceipt) {
        exact(value.initializationReceipt, ['eventId', 'eventSha256', 'planSha256', 'valuesSha256', 'headSha256', 'headRevision']);
        if (value.initializationReceipt.headRevision !== 1 || !Object.entries(value.initializationReceipt)
            .filter(([key]) => key !== 'headRevision').every(([, checksum]) => hash(checksum)))
            fail();
        if (!value.initialization || value.status !== 'completed' || value.initializationReceipt.planSha256 !== value.initialization.planSha256
            || value.initializationReceipt.valuesSha256 !== value.initialization.valuesSha256)
            fail();
    }
    return value;
}
export function mvuSchemaOpeningEvent(plan, native) {
    return sealMvuSchemaOpeningFact({ schemaVersion: 2, encoding: 'mvu-schema-opening-event-v2',
        eventId: sha256(`${plan.identity.sessionId}\0${plan.identity.operationId}\0${plan.planSha256}`), revision: 1,
        plan, native, executionSha256: recordSha256(plan.execution), valuesSha256: plan.valuesSha256 }, 'eventSha256');
}
export function mvuSchemaOpeningHead(event) {
    return freezeMvuSchemaOpeningData({ schemaVersion: 2, encoding: 'mvu-schema-opening-head-v2', sessionId: event.plan.identity.sessionId,
        eventId: event.eventId, revision: 1, eventSha256: event.eventSha256, planSha256: event.plan.planSha256,
        executionSha256: event.executionSha256, valuesSha256: event.valuesSha256 });
}
export function validateMvuSchemaOpeningEvent(input) {
    const event = freezeMvuSchemaOpeningData(input), plan = validateMvuSchemaOpeningPlan(event.plan);
    validateMvuSchemaNativeOpening(event.native, { ...plan.identity, initialization: plan, committedTurn: event.native.turn });
    if (!same(event, mvuSchemaOpeningEvent(plan, event.native)))
        fail();
    return event;
}
export function validateMvuSchemaOpeningHead(input) {
    const head = freezeMvuSchemaOpeningData(input);
    exact(head, ['schemaVersion', 'encoding', 'sessionId', 'eventId', 'revision', 'eventSha256', 'planSha256', 'executionSha256', 'valuesSha256']);
    if (head.schemaVersion !== 2 || head.encoding !== 'mvu-schema-opening-head-v2' || !id(head.sessionId, 64) || head.revision !== 1
        || ![head.eventId, head.eventSha256, head.planSha256, head.executionSha256, head.valuesSha256].every(hash))
        fail();
    return head;
}
export function verifyMvuSchemaOpeningFacts(intent, event, head) {
    try {
        const actual = validateMvuSchemaOpeningIntent(intent);
        if (actual.status !== 'completed' || !actual.initialization || !actual.nativeReceipt)
            return false;
        const stored = validateMvuSchemaOpeningEvent(event), storedHead = validateMvuSchemaOpeningHead(head);
        const proposed = mvuSchemaOpeningEvent(actual.initialization, actual.nativeReceipt);
        return same(stored, proposed) && same(storedHead, mvuSchemaOpeningHead(proposed)) && same(actual.initializationReceipt, {
            eventId: stored.eventId, eventSha256: stored.eventSha256, planSha256: storedHead.planSha256,
            valuesSha256: storedHead.valuesSha256, headSha256: recordSha256(storedHead), headRevision: 1
        });
    }
    catch {
        return false;
    }
}
