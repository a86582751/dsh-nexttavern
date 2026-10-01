// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-prefix-facts.ts; edit the TypeScript source.
/** Consumed schema story facts over an actual inherited Native prefix.
 * This reader owns no live permission and neither executes author code nor
 * writes/reconciles state. Core separately verifies lineage and full journals. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { readInputCompletion, inputCompletionKey } from './roleplay-input-completion.js';
import { ROLEPLAY_INPUT_NAMESPACE } from './roleplay-input-preparation.js';
import { inputSnapshotReferenceCurrent } from './roleplay-preparation.js';
import { verifyInheritedCompletedFact } from './roleplay-mvu-prefix-facts.js';
import { validateMvuSchemaStoryEvent, validateMvuSchemaStoryPlan, validateMvuSchemaStorySettlement, mvuSchemaStoryEventKey, mvuSchemaStorySettlementKey } from './roleplay-mvu-schema-story-types.js';
import { freezeMvuSchemaOpeningData, verifyMvuSchemaOpeningFacts } from './roleplay-mvu-schema-opening-types.js';
const code = 'SCHEMA_INHERITED_STORY_FACT_UNPROVEN';
function fail() { throw Error(code); }
const integer = (value, min = 0) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= min && !Object.is(value, -0);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (left, right) => recordSha256(left) === recordSha256(right);
function exact(value, required, optional = []) {
    if (!object(value) || required.some(key => !Object.hasOwn(value, key))
        || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key)))
        fail();
    const prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
    if (![Object.prototype, null].includes(prototype) || Object.getOwnPropertySymbols(value).length
        || Object.values(descriptors).some(descriptor => !('value' in descriptor) || !descriptor.enumerable))
        fail();
}
/** Native events retain undefined fields. Inspect descriptors before reads or
 * hashing. Outer task/terminal rows add nesting around individually validated
 * schema records; their independent story/opening bounds remain unchanged. */
function inspect(input) {
    let nodes = 0, bytes = 0;
    const ancestors = new Set();
    function visit(value, depth) {
        if (++nodes > 131072 || depth > 72)
            fail();
        if (value === null || value === undefined || typeof value === 'boolean')
            return;
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
                fail();
            return;
        }
        if (typeof value === 'string') {
            bytes += Buffer.byteLength(value, 'utf8');
            if (bytes > 16777216)
                fail();
            return;
        }
        if (!value || typeof value !== 'object' || ancestors.has(value))
            fail();
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if ((array ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype))
            || Object.getOwnPropertySymbols(value).length)
            fail();
        const descriptors = Object.getOwnPropertyDescriptors(value), names = Object.keys(descriptors);
        const length = array ? descriptors.length?.value : undefined;
        if (array && (!integer(length) || length > 100000 || names.length !== length + 1))
            fail();
        ancestors.add(value);
        for (const name of names) {
            if (array && name === 'length')
                continue;
            const descriptor = descriptors[name];
            if (!('value' in descriptor) || !descriptor.enumerable || ['__proto__', 'constructor', 'prototype'].includes(name)
                || array && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= length))
                fail();
            bytes += Buffer.byteLength(name, 'utf8');
            if (bytes > 16777216)
                fail();
            visit(descriptor.value, depth + 1);
        }
        ancestors.delete(value);
    }
    visit(input, 0);
}
function frozen(input) {
    const copy = structuredClone(input);
    function freeze(value) {
        if (value && typeof value === 'object') {
            for (const child of Object.values(value))
                freeze(child);
            Object.freeze(value);
        }
    }
    freeze(copy);
    return copy;
}
function read(table, key) {
    const row = table.get(key);
    inspect(row);
    if (row === undefined)
        fail();
    return structuredClone(row);
}
function validateRefs(value, sid) {
    if (!Array.isArray(value) || !value.length || value.length > 64)
        fail();
    const ids = new Set();
    for (const ref of value) {
        exact(ref, ['sessionId', 'insertSeq', 'messageId', 'messageSha256']);
        if (ref.sessionId !== sid || !integer(ref.insertSeq) || typeof ref.messageId !== 'string' || !ref.messageId.length
            || ref.messageId.length > 1024 || /[\u0000-\u001f\u007f-\u009f]/.test(ref.messageId)
            || !hash(ref.messageSha256) || ids.has(ref.messageId))
            fail();
        ids.add(ref.messageId);
    }
}
function workFacts(input, sid) {
    exact(input, ['schemaVersion', 'namespace', 'sessionId', 'branchId', 'preparationId', 'receiptGeneration', 'refs',
        'credentialSha256', 'preparation', 'status', 'source', 'attemptGeneration', 'attempt', 'checkpoint', 'terminalRequired'], ['stop', 'transition', 'unclaimedRefusal']);
    validateRefs(input.refs, sid);
    if (input.schemaVersion !== 2 || input.namespace !== ROLEPLAY_INPUT_NAMESPACE || input.sessionId !== sid || input.branchId !== sid
        || !id(input.preparationId) || !integer(input.receiptGeneration, 1) || !integer(input.attemptGeneration, 1)
        || input.status !== 'active' || input.terminalRequired !== true || input.stop !== undefined
        || input.transition !== undefined || input.unclaimedRefusal !== undefined)
        fail();
    const identity = { schemaVersion: 2, namespace: ROLEPLAY_INPUT_NAMESPACE, sessionId: sid, branchId: sid,
        preparationId: input.preparationId, receiptGeneration: input.receiptGeneration, refs: input.refs, terminalRequired: true };
    if (!hash(input.credentialSha256) || input.credentialSha256 !== recordSha256(identity)
        || !same(input.preparation, { schemaVersion: 1, namespace: ROLEPLAY_INPUT_NAMESPACE,
            preparationKeySha256: recordSha256({ sessionId: sid, preparationId: input.preparationId }),
            credentialSha256: input.credentialSha256 }))
        fail();
    exact(input.preparation, ['schemaVersion', 'namespace', 'preparationKeySha256', 'credentialSha256']);
    exact(input.source, ['kind', 'sourceSha256', 'headRef']);
    exact(input.source.headRef, ['kind', 'sha256']);
    exact(input.checkpoint, ['schemaVersion', 'sessionId', 'workSha256', 'preparation', 'refs', 'actualTurn',
        'startSeq', 'firstStepStartSeq', 'claimSpliceSeqs']);
    exact(input.attempt, ['turn', 'step', 'prepared', 'snapshot'], ['legacyPreparationId']);
    exact(input.attempt.snapshot, ['key', 'sha256']);
    if (!integer(input.attempt.turn, 1) || !integer(input.attempt.step, 1) || input.attempt.prepared !== true
        || input.attempt.legacyPreparationId !== undefined && !id(input.attempt.legacyPreparationId)
        || typeof input.attempt.snapshot.key !== 'string' || !hash(input.attempt.snapshot.sha256))
        fail();
    return input;
}
export function readMvuSchemaInheritedStoryFacts(request, deps) {
    try {
        exact(request, ['ownerSessionId', 'ownerInheritedEventCount', 'events', 'event']);
        inspect(request.events);
        const sid = request.ownerSessionId, events = request.events;
        if (!id(sid) || !integer(request.ownerInheritedEventCount) || !Array.isArray(events)
            || request.ownerInheritedEventCount > events.length || events.length > 100000
            || events.some((event, index) => !object(event) || event.seq !== index || typeof event.type !== 'string'))
            fail();
        const event = validateMvuSchemaStoryEvent(request.event), plan = validateMvuSchemaStoryPlan(event.plan);
        const { scope } = plan, { currency, receipt } = scope, checkpoint = receipt.checkpoint;
        if (event.sessionId !== sid || plan.base.sessionId !== sid || checkpoint.sessionId !== sid
            || receipt.turnEndSeq >= events.length || event.frontier.nativeCut > events.length)
            fail();
        const eventKey = mvuSchemaStoryEventKey(sid, event.eventId), storedEvent = read(deps.status, eventKey);
        if (!same(storedEvent, event))
            fail();
        const settlementKey = mvuSchemaStorySettlementKey(sid, plan.planSha256);
        const settlement = validateMvuSchemaStorySettlement(read(deps.status, settlementKey), event);
        const terminalKey = inputCompletionKey(sid, currency.preparationId), rawTerminal = read(deps.branch, terminalKey);
        exact(rawTerminal, ['schemaVersion', 'encoding', 'sessionId', 'scope', 'plan', 'status', 'settlement', 'recordSha256']);
        const terminal = readInputCompletion({ get: key => key === terminalKey ? rawTerminal : undefined }, sid, currency.preparationId);
        if (!terminal || terminal.schemaVersion !== 2 || terminal.encoding !== 'roleplay-input-completion-v2'
            || terminal.status !== 'settled' || terminal.plan.kind !== 'schema-numerical'
            || !same(terminal.scope, scope) || !same(terminal.plan.plan, plan) || !same(terminal.settlement, settlement))
            fail();
        exact(terminal.plan, ['kind', 'plan']);
        const prefix = `${sid}__native-input-v2-`, workKey = `${prefix}work-${recordSha256(checkpoint.refs)}`;
        const work = workFacts(read(deps.branch, workKey), sid);
        const expectedCurrency = { schemaVersion: 2, preparationId: work.preparationId,
            credentialSha256: work.credentialSha256, receiptGeneration: work.receiptGeneration,
            attemptGeneration: work.attemptGeneration, source: work.source, snapshot: work.attempt.snapshot };
        if (!same(expectedCurrency, currency) || !same(work.checkpoint, checkpoint) || !same(work.refs, checkpoint.refs)
            || !same(work.preparation, checkpoint.preparation) || work.attempt.turn !== checkpoint.actualTurn
            || work.source.kind !== 'story' || work.source.sourceSha256 !== plan.base.sourceSha256
            || work.source.headRef?.kind !== 'schema-head' || work.source.headRef.sha256 !== plan.base.stateSnapshotSha256)
            fail();
        // A second row or durable stop cannot be hidden by a selected valid work.
        for (const [key, row] of deps.branch.entries()) {
            if (!key.startsWith(prefix))
                continue;
            if (key.startsWith(`${prefix}work-`)) {
                inspect(row);
                if (!object(row))
                    fail();
                if (row.preparationId === work.preparationId || same(row.refs, work.refs)) {
                    if (key !== workKey || !same(row, work))
                        fail();
                }
            }
            else if (key.startsWith(`${prefix}stop-`)) {
                inspect(row);
                if (!object(row) || !Array.isArray(row.refs))
                    fail();
                if (row.refs.some(ref => work.refs.some(owned => same(ref, owned)))
                    || object(row.notice) && object(row.notice.preparation) && same(row.notice.preparation, work.preparation))
                    fail();
            }
        }
        const snapshotRef = currency.snapshot, snapshot = read(deps.branch, snapshotRef.key);
        if (!inputSnapshotReferenceCurrent({ get: key => key === snapshotRef.key ? snapshot : undefined }, sid, currency))
            fail();
        if (!object(snapshot) || snapshot.schemaVersion !== 1 || snapshot.sessionId !== sid || snapshot.branchId !== sid
            || snapshot.turnId !== checkpoint.actualTurn || recordSha256(snapshot) !== snapshotRef.sha256
            || !same(snapshot.numericalState, plan.base))
            fail();
        const { snapshot: _reference, ...inputBasis } = currency;
        if (!same(snapshot.inputPreparation, inputBasis))
            fail();
        const phaseKey = `${sid}__phaseb-${checkpoint.actualTurn}`, phaseB = read(deps.branch, phaseKey);
        if (!object(phaseB) || phaseB.state !== 'completed' || phaseB.sessionId !== sid || phaseB.turnId !== checkpoint.actualTurn
            || phaseB.assistantSeq !== plan.canonical.seq)
            fail();
        const canonical = deps.readProjectedCanonical(events, checkpoint.actualTurn);
        inspect(canonical);
        if (!canonical)
            fail();
        const projected = frozen(canonical), { narrative: _narrative, ...nativeCanonical } = plan.canonical;
        if (!same(projected, { seq: plan.canonical.seq, messageId: plan.canonical.messageId,
            versionSha256: plan.canonical.versionSha256, narrative: plan.canonical.narrative })
            || !verifyInheritedCompletedFact({ ownerSessionId: sid, ownerInheritedEventCount: request.ownerInheritedEventCount,
                events, receipt, canonical: nativeCanonical }, { readProjectedCanonical: () => projected, editProtocol: deps.editProtocol }))
            fail();
        const rows = { event: { key: eventKey, row: storedEvent }, terminal: { key: terminalKey, row: rawTerminal },
            settlement: { key: settlementKey, row: settlement }, work: { key: workKey, row: work },
            snapshot: { key: snapshotRef.key, row: snapshot }, phaseB: { key: phaseKey, row: phaseB } };
        const refs = {};
        for (const name of Object.keys(rows)) {
            const selected = rows[name], table = name === 'event' || name === 'settlement' ? deps.status : deps.branch;
            if (!same(read(table, selected.key), selected.row))
                fail();
            refs[name] = { key: selected.key, sha256: recordSha256(selected.row) };
        }
        return frozen({ event, terminal, settlement, work, snapshot, phaseB, refs });
    }
    catch {
        return fail();
    }
}
/** Original program opening in this exact frozen prefix. Original Source and
 * author execution are verified separately; projected edits cannot stand in
 * for its one immutable Native append receipt. */
export function verifyMvuSchemaInheritedOpeningFacts(request, deps) {
    try {
        exact(request, ['intent', 'event', 'head', 'events']);
        const intent = freezeMvuSchemaOpeningData(request.intent), event = freezeMvuSchemaOpeningData(request.event);
        const head = freezeMvuSchemaOpeningData(request.head), events = request.events;
        if (!verifyMvuSchemaOpeningFacts(intent, event, head))
            return false;
        inspect(events);
        if (!Array.isArray(events) || events.length > 100000
            || events.some((row, index) => !object(row) || row.seq !== index || typeof row.type !== 'string'))
            return false;
        const receipt = event.native, identity = event.plan.identity;
        if (receipt.flushed !== true || receipt.sessionId !== identity.sessionId || receipt.turnEndSeq >= events.length)
            return false;
        const start = events[receipt.turnStartSeq], body = events[receipt.assistantSeq], end = events[receipt.turnEndSeq];
        if (!start || !body || !end || !object(start.data) || !object(body.data) || !object(end.data))
            return false;
        const message = body.data.message;
        const marker = { schemaVersion: 1, operationId: identity.operationId, messageId: identity.messageId,
            producer: 'dsh-nexttavern', origin: `card-opening:${identity.source.importId}`, textSha256: identity.renderedSha256 };
        const source = { kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
            origin: `card-opening:${identity.source.importId}`, operationId: identity.operationId };
        if (start.type !== 'turn/start' || !same(start.data.programmatic, marker) || start.data.turn !== receipt.turn
            || body.type !== 'assistant/message' || body.data.turn !== receipt.turn || body.data.step !== 1
            || !object(message) || message.id !== identity.messageId || message.role !== 'assistant' || !same(message.source, source)
            || !same(message.content, [{ type: 'text', text: intent.renderedText }]) || sha256(intent.renderedText) !== identity.renderedSha256
            || !same(body.data.stream, []) || recordSha256(body) !== receipt.messageVersion.eventSha256
            || end.type !== 'turn/end' || end.data.turn !== receipt.turn || !same(end.data.reason, { kind: 'completed' }))
            return false;
        const span = events.slice(start.seq, end.seq + 1);
        const stepStarts = span.filter(row => row.type === 'step/start'), stepEnds = span.filter(row => row.type === 'step/end');
        if (stepStarts.length !== 1 || stepEnds.length !== 1)
            return false;
        const stepStart = stepStarts[0], stepEnd = stepEnds[0];
        if (!object(stepStart.data) || !object(stepEnd.data)
            || !(start.seq < stepStart.seq && stepStart.seq < body.seq && body.seq < stepEnd.seq && stepEnd.seq < end.seq)
            || stepStart.data.turn !== receipt.turn || stepEnd.data.turn !== receipt.turn
            || stepStart.data.step !== 1 || stepEnd.data.step !== 1
            || span.filter(row => row.type === 'turn/start').length !== 1 || span.filter(row => row.type === 'turn/end').length !== 1
            || span.filter(row => row.type === 'assistant/message').length !== 1
            || span.some(row => !['turn/start', 'step/start', 'system/message', 'assistant/message', 'step/end', 'turn/end'].includes(row.type)))
            return false;
        const projected = deps.projectPrefix(events);
        return projected.nodes.includes(body.seq) && !projected.projectedMessageAt(body.seq)
            && !events.some(row => row.type === 'roleplay/message-edit' && object(row.data)
                && (row.data.targetSeq === body.seq || row.data.messageId === identity.messageId));
    }
    catch {
        return false;
    }
}
