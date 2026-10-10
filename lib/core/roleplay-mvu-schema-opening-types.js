// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-opening-types.ts; edit the TypeScript source.
/** Versioned schema opening facts. Shape/hash checks prove integrity only;
 * actual Source, Native history and private publication authority belong to Core. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneSchemaValues, cloneSchemaDescriptorEnvelopeV4 } from './tavern-mvu-schema-data.js';
import { validateSchemaExecutorIdentityTuple } from './roleplay-mvu-schema-executor-types.js';
import { deriveOwnedStateLoaderIdentityV4 } from './tavern-mvu-schema-program-v4.js';
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
    const limit = MVU_SCHEMA_OPENING_BOUNDS;
    let value;
    try {
        // One DATA owner separates full Source material from opening metadata.
        // Host5 retains its complete input without charging it as a 4 MiB string.
        value = cloneSchemaDescriptorEnvelopeV4(input, limit.bytes, { nodes: limit.nodes, depth: limit.depth });
    }
    catch {
        fail();
    }
    function freeze(item) {
        if (!item || typeof item !== 'object' || Object.isFrozen(item))
            return;
        for (const child of Object.values(item))
            freeze(child);
        Object.freeze(item);
    }
    freeze(value);
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
export function deriveMvuSchemaOpeningExecution(input, executor) {
    const value = freezeMvuSchemaOpeningData(input);
    identity(value);
    const version = executor?.runner.version === 4 ? 4 : executor?.runner.version === 3 ? 3 : 2;
    const realmEpoch = executor ? recordSha256({ schemaVersion: version, encoding: `native-mvu-schema-opening-execution-identity-v${version}`,
        identity: value, executor: validateSchemaExecutorIdentityTuple(executor) }) :
        recordSha256({ schemaVersion: 1, encoding: 'native-mvu-schema-opening-execution-identity-v1', identity: value });
    return freezeMvuSchemaOpeningData({ realmEpoch, selector: { sessionId: value.sessionId, batchId: `opening-${realmEpoch}`,
            anchor: { kind: 'opening', operationId: value.operationId, messageId: value.messageId, importId: value.source.importId, selectedIndex: value.index } } });
}
function hostIdentity(value) {
    exact(value, ['id', 'version', 'implementationSha256']);
    if (value.id !== 'native-author-host' || value.version !== 5 || !hash(value.implementationSha256))
        fail();
}
export function deriveAuthorHostOpeningExecutionV5(input, host) {
    const value = freezeMvuSchemaOpeningData(input);
    identity(value);
    hostIdentity(host);
    const realmEpoch = recordSha256({ schemaVersion: 5, encoding: 'native-author-opening-execution-identity-v5', identity: value, host });
    return freezeMvuSchemaOpeningData({ realmEpoch, selector: { sessionId: value.sessionId, batchId: `opening-${realmEpoch}`,
            anchor: { kind: 'opening', operationId: value.operationId, messageId: value.messageId, importId: value.source.importId, selectedIndex: value.index } } });
}
export function deriveAuthorHostOpeningExecutionV6(input, host) {
    const value = freezeMvuSchemaOpeningData(input);
    identity(value);
    hostIdentity(host);
    const realmEpoch = recordSha256({ schemaVersion: 6, encoding: 'native-author-opening-execution-identity-v6', identity: value, host });
    const selector = (index) => ({ sessionId: value.sessionId, batchId: `opening-${realmEpoch}-${index}`,
        anchor: { kind: 'opening', operationId: value.operationId, messageId: value.messageId, importId: value.source.importId, selectedIndex: value.index } });
    const phaseSelectors = [
        { phase: 'initialization', selector: selector(0) },
        { phase: 'command-parsed', selector: selector(1) },
        { phase: 'commands-parsed', selector: selector(2) },
        { phase: 'update-ended', selector: selector(3) },
    ];
    return freezeMvuSchemaOpeningData({ realmEpoch, selector: phaseSelectors[0].selector, phaseSelectors });
}
function serverExecutorV4(value) {
    exact(value, ['compiler', 'bridge', 'libraries', 'stateLoader', 'runner']);
    const { stateLoader, ...tuple } = value;
    const actual = validateSchemaExecutorIdentityTuple(tuple);
    if (actual.runner.version !== 4 || !same(stateLoader, deriveOwnedStateLoaderIdentityV4(actual.bridge)))
        fail();
}
function inputFacts(value, initVersion = 1) {
    identity(value.identity);
    const snapshot = value.sourceSnapshot, init = value.initSource, proof = value.freshNativeBasisProof, selected = snapshot.selected;
    exact(snapshot, ['schemaVersion', 'encoding', 'source', 'pointerSha256', 'importRecordSha256', 'coverageSha256', 'materialRows',
        'settings', 'bindings', 'selected', 'swipes', 'macroContext', 'documentSha256', 'snapshotSha256'], ['sourceProvenance']);
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
        || selected.renderedSha256 !== value.identity.renderedSha256 || init.schemaVersion !== initVersion
        || init.encoding !== `native-mvu-schema-opening-init-source-v${initVersion}`
        || !['strict-json-object-v1', 'yaml-1.2-json-data-v1'].includes(init.grammar)
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
        exact(swipe, ['identity', 'sourcePointer', 'sourceSha256', 'rawOpening', 'renderedOpening', 'renderedSha256', 'statData'], ['materialization']);
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
        'selector', 'realmEpoch', 'clockEpochMs', 'randomSeed', 'preparationSha256',
        ...(value.schemaVersion === 6 ? ['host', 'compilation', 'phaseSelectors'] :
            value.schemaVersion === 5 ? ['host', 'compilation'] : value.schemaVersion !== 1 ? ['executor'] : [])]);
    fact(value, 'preparationSha256');
    inputFacts(value, value.schemaVersion === 6 ? 2 : 1);
    if (value.schemaVersion === 5 || value.schemaVersion === 6) {
        hostIdentity(value.host);
        exact(value.compilation, ['schemaVersion', 'encoding', 'original', 'sourceRecordSessionId']);
        if (value.encoding !== `native-author-opening-preparation-v${value.schemaVersion}`
            || ![3, 4, 5, 6].includes(value.compilation.schemaVersion)
            || value.compilation.encoding !== `native-author-combined-compilation-input-v${value.compilation.schemaVersion}`
            || value.compilation.sourceRecordSessionId !== value.sourceSnapshot.source.sourceRecordSessionId)
            fail();
    }
    else if (value.schemaVersion === 2 || value.schemaVersion === 3 || value.schemaVersion === 4) {
        const executor = validateSchemaExecutorIdentityTuple(value.executor);
        if (value.encoding !== `native-mvu-schema-opening-preparation-v${value.schemaVersion}`
            || executor.runner.version !== value.schemaVersion)
            fail();
    }
    else if (value.schemaVersion !== 1 || value.encoding !== 'native-mvu-schema-opening-preparation-v1')
        fail();
    if (!integer(value.clockEpochMs)
        || typeof value.randomSeed !== 'string' || !value.randomSeed.length || value.randomSeed.length > 256)
        fail();
    if (value.schemaVersion === 6) {
        if (!same({ realmEpoch: value.realmEpoch, selector: value.selector, phaseSelectors: value.phaseSelectors }, deriveAuthorHostOpeningExecutionV6(value.identity, value.host)))
            fail();
    }
    else if (!same({ realmEpoch: value.realmEpoch, selector: value.selector }, value.schemaVersion === 5 ?
        deriveAuthorHostOpeningExecutionV5(value.identity, value.host) : deriveMvuSchemaOpeningExecution(value.identity, value.schemaVersion !== 1 ? value.executor : undefined)))
        fail();
    return value;
}
function execution(value, plan) {
    if (plan.schemaVersion === 7) {
        if (value.schemaVersion !== 5)
            fail();
        exact(value, ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId', 'anchor', 'sourceNativeCutSha256',
            'combinedProgramSha256', 'serverProgramSha256', 'epoch', 'dispatch', 'completion', 'dispatchMarker', 'completionMarker',
            'serverTailSha256', 'hostFrontierSha256', 'outputSha256']);
        const derived = deriveAuthorHostOpeningExecutionV5(plan.identity, plan.host);
        if (value.encoding !== 'native-author-host-association-v5' || value.sessionId !== plan.identity.sessionId
            || value.realmEpoch !== derived.realmEpoch || value.batchId !== derived.selector.batchId
            || !same(value.anchor, derived.selector.anchor) || ![value.sourceNativeCutSha256, value.combinedProgramSha256,
            value.serverProgramSha256, value.serverTailSha256, value.hostFrontierSha256, value.outputSha256].every(hash))
            fail();
        for (const ref of [value.epoch, value.dispatch, value.completion]) {
            exact(ref, ['key', 'sha256']);
            if (!id(ref.key, 512) || !hash(ref.sha256))
                fail();
        }
    }
    else {
        if (value.schemaVersion !== 1)
            fail();
        exact(value, ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId', 'anchor', 'sourceNativeCutSha256', 'programSha256',
            'dispatch', 'completion', 'dispatchMarker', 'completionMarker', 'tailSha256', 'frontierSha256', 'outputSha256']);
        const derived = deriveMvuSchemaOpeningExecution(plan.identity, plan.schemaVersion !== 3 ? plan.executor : undefined);
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
function executionPhasesV8(plan) {
    const derived = deriveAuthorHostOpeningExecutionV6(plan.identity, plan.host);
    if (!Array.isArray(plan.phases) || plan.phases.length !== 4)
        fail();
    let previousMarkerSeq = plan.freshNativeBasisProof.native.observedThroughSeq;
    const first = plan.phases[0].execution;
    for (const [index, item] of plan.phases.entries()) {
        exact(item, ['phase', 'execution']);
        const expected = derived.phaseSelectors[index], value = item.execution;
        exact(value, ['schemaVersion', 'encoding', 'sessionId', 'realmEpoch', 'batchId', 'anchor', 'sourceNativeCutSha256',
            'combinedProgramSha256', 'serverProgramSha256', 'epoch', 'dispatch', 'completion', 'dispatchMarker', 'completionMarker',
            'serverTailSha256', 'hostFrontierSha256', 'outputSha256']);
        if (item.phase !== expected.phase || value.schemaVersion !== 5 || value.encoding !== 'native-author-host-association-v5'
            || value.sessionId !== expected.selector.sessionId || value.realmEpoch !== derived.realmEpoch
            || value.batchId !== expected.selector.batchId || !same(value.anchor, expected.selector.anchor)
            || ![value.sourceNativeCutSha256, value.combinedProgramSha256, value.serverProgramSha256,
                value.serverTailSha256, value.hostFrontierSha256, value.outputSha256].every(hash)
            || value.combinedProgramSha256 !== first.combinedProgramSha256 || value.serverProgramSha256 !== first.serverProgramSha256
            || !same(value.epoch, first.epoch))
            fail();
        for (const ref of [value.epoch, value.dispatch, value.completion]) {
            exact(ref, ['key', 'sha256']);
            if (!id(ref.key, 512) || !hash(ref.sha256))
                fail();
        }
        for (const ref of [value.dispatchMarker, value.completionMarker]) {
            exact(ref, ['seq', 'sha256']);
            if (!integer(ref.seq) || !hash(ref.sha256))
                fail();
        }
        // Each phase appends its own pair in the same opening Native chain.
        if (value.dispatchMarker.seq !== previousMarkerSeq + 1 || value.completionMarker.seq !== value.dispatchMarker.seq + 1)
            fail();
        previousMarkerSeq = value.completionMarker.seq;
    }
    if (!same(plan.execution, plan.phases[3].execution))
        fail();
}
export function validateMvuSchemaOpeningPlan(input) {
    const value = freezeMvuSchemaOpeningData(input);
    exact(value, ['schemaVersion', 'encoding', 'identity', 'selectedSwipeIdentity', 'authorSourceSha256', 'sourceSnapshot', 'initSource',
        'initialValuesSha256', 'freshNativeBasisProof', 'execution', 'values', 'valuesSha256', 'planSha256',
        ...(value.schemaVersion === 8 ? ['host', 'server', 'phases'] :
            value.schemaVersion === 7 ? ['host', 'server'] : value.schemaVersion !== 3 ? ['executor'] : [])]);
    fact(value, 'planSha256');
    inputFacts(value, value.schemaVersion === 8 ? 2 : 1);
    if (value.schemaVersion === 8)
        executionPhasesV8(value);
    else
        execution(value.execution, value);
    if (value.schemaVersion === 7 || value.schemaVersion === 8) {
        hostIdentity(value.host);
        serverExecutorV4(value.server);
        if (value.encoding !== `mvu-programmatic-opening-plan-v${value.schemaVersion}`)
            fail();
    }
    else if (value.schemaVersion === 4 || value.schemaVersion === 5 || value.schemaVersion === 6) {
        const executor = validateSchemaExecutorIdentityTuple(value.executor);
        if (value.encoding !== `mvu-programmatic-opening-plan-v${value.schemaVersion}`
            || executor.runner.version !== value.schemaVersion - 2)
            fail();
    }
    else if (value.schemaVersion !== 3 || value.encoding !== 'mvu-programmatic-opening-plan-v3')
        fail();
    if (value.selectedSwipeIdentity !== value.initSource.selectedSwipeIdentity || !hash(value.initialValuesSha256)
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
        if (value.preparation.schemaVersion === 6) {
            if (plan.schemaVersion !== 8 || !same(plan.host, value.preparation.host))
                fail();
        }
        else if (value.preparation.schemaVersion === 5) {
            if (plan.schemaVersion !== 7 || !same(plan.host, value.preparation.host))
                fail();
        }
        else if (value.preparation.schemaVersion === 4) {
            if (plan.schemaVersion !== 6 || !same(plan.executor, value.preparation.executor))
                fail();
        }
        else if (value.preparation.schemaVersion === 3) {
            if (plan.schemaVersion !== 5 || !same(plan.executor, value.preparation.executor))
                fail();
        }
        else if (value.preparation.schemaVersion === 2) {
            if (plan.schemaVersion !== 4 || !same(plan.executor, value.preparation.executor))
                fail();
        }
        else if (plan.schemaVersion !== 3)
            fail();
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
