// Generated from runtime/alpha3/src/core/roleplay-mvu-derived.ts; edit the TypeScript source.
/** A child's numerical genesis is a new authority over frozen inherited facts.
 * Native input/terminal capabilities never cross this boundary. Reads cannot
 * publish, ACK, resend input or promote a partial basis after a cold restart. */
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { eventsOf, canonicalAssistantForTurn } from './roleplay-context.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { mvuInitializationEventKey, mvuInitializationHeadKey, verifyFrozenMvuInitializationFacts } from './roleplay-mvu-initialization.js';
import { createRoleplayMvuLineage } from './roleplay-mvu-lineage.js';
import { createRoleplayMvuPrefixLedger } from './roleplay-mvu-prefix-ledger.js';
export const mvuDerivedPreparedKey = (sid) => `${sid}__mvu-derived-prepared`;
export const mvuDerivedBasisKey = (sid) => `${sid}__mvu-derived-basis`;
export const mvuDerivedEventKey = (sid) => `${sid}__mvu-derived-event`;
export const mvuDerivedHeadKey = (sid) => `${sid}__mvu-derived-head`;
const same = (a, b) => recordSha256(a) === recordSha256(b);
const id = (v) => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v);
function fail(code) { throw new Error(code); }
function preparedVersion(prepared) {
    return prepared.schemaVersion === 1 && prepared.encoding === 'native-mvu-derived-prepared-v1'
        && prepared.ledger?.schemaVersion === 1 && prepared.ledger.encoding === 'native-mvu-prefix-ledger-proof-v1'
        || prepared.schemaVersion === 2 && prepared.encoding === 'native-mvu-derived-prepared-v2'
            && prepared.ledger?.schemaVersion === 2 && prepared.ledger.encoding === 'native-mvu-prefix-ledger-proof-v2';
}
function basisVersion(basis) {
    return preparedVersion(basis.prepared) && (basis.schemaVersion === 1 && basis.encoding === 'native-mvu-derived-basis-v1'
        && basis.prepared.schemaVersion === 1 || basis.schemaVersion === 2 && basis.encoding === 'native-mvu-derived-basis-v2'
        && basis.prepared.schemaVersion === 2);
}
/** Domain evidence is bounded plain JSON. Inspect before cloning/hashing so a
 * forged descriptor cannot execute accessors or disappear during serialization. */
function data(input) {
    let nodes = 0, bytes = 0;
    const ancestors = new Set();
    function inspect(v, depth) {
        if (++nodes > 192000 || depth > 80)
            fail('DERIVED_RECORD_LIMIT');
        if (v === null || typeof v === 'boolean')
            return;
        if (typeof v === 'string') {
            bytes += Buffer.byteLength(v);
            if (bytes > 8 * 1048576)
                fail('DERIVED_RECORD_LIMIT');
            return;
        }
        if (typeof v === 'number') {
            if (!Number.isFinite(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER)
                fail('DERIVED_RECORD_INVALID');
            return;
        }
        if (!v || typeof v !== 'object' || ancestors.has(v) || Object.getOwnPropertySymbols(v).length)
            fail('DERIVED_RECORD_INVALID');
        const array = Array.isArray(v), proto = Object.getPrototypeOf(v), descriptors = Object.getOwnPropertyDescriptors(v);
        if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null)
            fail('DERIVED_RECORD_INVALID');
        if (array && (v.length > 32000 || Object.keys(descriptors).length !== v.length + 1))
            fail('DERIVED_RECORD_INVALID');
        ancestors.add(v);
        for (const [key, d] of Object.entries(descriptors)) {
            if (array && key === 'length')
                continue;
            if (!d.enumerable || !Object.hasOwn(d, 'value') || ['constructor', 'prototype', '__proto__'].includes(key)
                || array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= v.length))
                fail('DERIVED_RECORD_INVALID');
            bytes += Buffer.byteLength(key);
            if (bytes > 8 * 1048576)
                fail('DERIVED_RECORD_LIMIT');
            inspect(d.value, depth + 1);
        }
        ancestors.delete(v);
    }
    inspect(input, 0);
    return structuredClone(input);
}
function exact(v, keys) {
    if (!same(Object.keys(v).sort(), [...keys].sort()))
        fail('DERIVED_RECORD_INVALID');
}
/** A projection over the actual supplied prefix, with Native surface folding
 * and the maintained edit projection. This is a read view, never an Agent or
 * a source of Native ownership/flush/completion authority. */
export function readMvuPrefixCanonical(events, turn, projectPrefix) {
    const surface = projectPrefix(events);
    const body = canonicalAssistantForTurn({ id: 'inherited-prefix-projection', events: events,
        surface: { nodes: surface.nodes }, deriveEventMessage: event => surface.projectedMessageAt(event.seq) }, turn);
    const message = body?.data?.message;
    return body && message && typeof message.id === 'string' ? { seq: body.seq, messageId: message.id,
        versionSha256: recordSha256(message), narrative: textOf(message.content) } : undefined;
}
export function createRoleplayMvuDerived(deps) {
    const lineage = createRoleplayMvuLineage(deps);
    const ledger = createRoleplayMvuPrefixLedger({ branch: deps.branch, status: deps.status,
        verifySettlementFacts: input => deps.state().verifyConsumedSettlementFacts(input),
        verifyManualSettlementFacts: input => deps.state().verifyConsumedManualSettlementFacts(input),
        readProjectedCanonical: (events, turn) => readMvuPrefixCanonical(events, turn, deps.projectPrefix), editProtocol: deps.editProtocol });
    function prefix(session, cut) {
        const events = eventsOf(session);
        if (!Number.isSafeInteger(cut) || cut < 1 || cut > events.length || events.some((e, i) => e.seq !== i))
            fail('DERIVED_PREFIX_UNPROVEN');
        return events.slice(0, cut);
    }
    function operationCurrent(prepared) {
        const operation = deps.branch.get(`fork-op-${prepared.operationId}`);
        return !!operation && operation.operationId === prepared.operationId && operation.reservedChildSessionId === prepared.childSessionId
            && operation.state !== 'failed' && operation.state !== 'aborted' && !operation.abortedAt
            && operation.anchor.sourceSessionId === prepared.parentSessionId && recordSha256(operation.anchor) === prepared.anchorSha256
            && operation.anchor.expectedSeedLength === prepared.seedLength;
    }
    function openingFact(g) {
        const event = g.initEvent, owner = event.plan.identity.sessionId, importId = event.plan.identity.source.importId;
        const intentKey = openingIntentKey(owner, importId), intent = deps.branch.get(intentKey);
        if (!intent)
            fail('DERIVED_OPENING_OWNER_UNPROVEN');
        return { kind: 'opening', eventKey: mvuInitializationEventKey(owner, event.eventId),
            headKey: mvuInitializationHeadKey(owner), intentKey, intentSha256: recordSha256(intent) };
    }
    function openingCurrent(prepared, input) {
        const events = input;
        const g = prepared.genesis, fact = prepared.genesisFact;
        if (!('initEvent' in g) || fact.kind !== 'opening')
            return false;
        const event = g.initEvent, identity = event.plan.identity, r = event.native;
        if (!verifyFrozenMvuInitializationFacts(event, g.initHead))
            return false;
        const intent = deps.branch.get(fact.intentKey);
        if (!intent || !same(deps.status.get(fact.eventKey), event)
            || recordSha256(intent) !== fact.intentSha256 || intent.schemaVersion !== 4 || intent.status !== 'completed'
            || intent.mode !== 'native-json' || !same(intent.initialization, event.plan) || !same(intent.nativeReceipt, r)
            || r.flushed !== true || identity.sessionId !== prepared.parentSessionId || r.sessionId !== identity.sessionId
            || r.turnStartSeq < prepared.parentInheritedEventCount || r.turnEndSeq >= events.length)
            return false;
        const start = events[r.turnStartSeq], body = events[r.assistantSeq], end = events[r.turnEndSeq];
        const marker = { schemaVersion: 1, operationId: identity.operationId, messageId: identity.messageId,
            producer: 'dsh-nexttavern', origin: `card-opening:${identity.source.importId}`, textSha256: identity.renderedSha256 };
        const source = { kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
            origin: `card-opening:${identity.source.importId}`, operationId: identity.operationId };
        if (start?.type !== 'turn/start' || !same(start.data?.['programmatic'], marker) || start.data?.turn !== r.turn
            || body?.type !== 'assistant/message' || body.data?.turn !== r.turn || body.data?.step !== 1
            || body.data?.message?.id !== identity.messageId || body.data.message.role !== 'assistant'
            || !same(body.data.message.source, source) || !same(body.data.message.content, [{ type: 'text', text: intent.renderedText }])
            || sha256(String(intent.renderedText)) !== identity.renderedSha256 || !same(body.data?.['stream'], [])
            || recordSha256(body) !== r.messageVersion.eventSha256 || end?.type !== 'turn/end'
            || end.data?.turn !== r.turn || !same(end.data?.reason, { kind: 'completed' }))
            return false;
        const span = events.slice(start.seq, end.seq + 1), stepStart = span.filter(e => e.type === 'step/start'), stepEnd = span.filter(e => e.type === 'step/end');
        if (!(start.seq < stepStart[0]?.seq && stepStart[0]?.seq < body.seq && body.seq < stepEnd[0]?.seq && stepEnd[0]?.seq < end.seq)
            || stepStart.length !== 1 || stepEnd.length !== 1 || stepStart[0]?.data?.turn !== r.turn || stepEnd[0]?.data?.turn !== r.turn
            || stepStart[0]?.data?.step !== 1 || stepEnd[0]?.data?.step !== 1
            || span.filter(e => e.type === 'turn/start').length !== 1 || span.filter(e => e.type === 'turn/end').length !== 1
            || span.filter(e => e.type === 'assistant/message').length !== 1 || span.some(e => !['turn/start', 'step/start', 'system/message',
            'assistant/message', 'step/end', 'turn/end'].includes(e.type)))
            return false;
        const folded = deps.projectPrefix(events);
        return folded.nodes.includes(body.seq) && !folded.projectedMessageAt(body.seq)
            && !events.some(e => e.type === 'roleplay/message-edit' && e.data?.['targetSeq'] === body.seq);
    }
    function genesisCurrent(prepared, events, seen, successor) {
        if (prepared.genesisFact.kind === 'opening')
            return openingCurrent(prepared, events);
        const fact = prepared.genesisFact, raw = deps.branch.get(fact.basisKey);
        const previous = raw && successor && readHistorical(raw.prepared.childSessionId, events, successor, seen);
        return !!raw && raw.basisSha256 === fact.basisSha256 && !!previous && same(previous, prepared.genesis);
    }
    function validPrepared(input, events, seen, successor) {
        const prepared = data(input);
        exact(prepared, ['schemaVersion', 'encoding', 'operationId', 'anchorSha256', 'parentSessionId', 'childSessionId', 'seedLength',
            'parentInheritedEventCount', 'parentSourceSha256', 'prefixSha256', 'genesis', 'genesisFact', 'initial', 'ledger', 'preparedSha256']);
        const { preparedSha256, ...descriptor } = prepared;
        if (!preparedVersion(prepared)
            || ![prepared.parentSessionId, prepared.childSessionId, prepared.operationId].every(id)
            || prepared.parentSessionId === prepared.childSessionId || prepared.seedLength !== events.length
            || !Number.isSafeInteger(prepared.parentInheritedEventCount) || prepared.parentInheritedEventCount < 0
            || prepared.parentInheritedEventCount >= prepared.seedLength
            || deps.readSession(prepared.parentSessionId)?.inheritedEventCount !== prepared.parentInheritedEventCount
            || recordSha256(descriptor) !== preparedSha256
            || prepared.prefixSha256 !== recordSha256(events) || !operationCurrent(prepared)
            || !genesisCurrent(prepared, events, seen, successor))
            fail('DERIVED_BASIS_UNPROVEN');
        const g = prepared.genesis, head = 'initHead' in g ? g.initHead : g.derivedHead;
        const values = 'initEvent' in g ? g.initEvent.plan.values : g.derivedEvent.values;
        const root = 'initEvent' in g ? { initEventId: g.initEvent.eventId, initEventSha256: g.initEvent.eventSha256,
            initHeadSha256: recordSha256(head), planSha256: g.initEvent.plan.planSha256 } : { schemaVersion: 1,
            encoding: 'native-mvu-derived-state-root-v1', derivedEventId: g.derivedEvent.eventId,
            derivedEventSha256: g.derivedEvent.eventSha256, derivedHeadSha256: recordSha256(head), basisSha256: g.derivedEvent.basisSha256 };
        const initialDescriptor = { schemaVersion: 1, encoding: 'native-mvu-state-snapshot-v1', sessionId: g.sessionId,
            sourceSha256: g.sourceSha256, root, currentHead: head, revision: 1, headSha256: recordSha256(head), values,
            valuesSha256: recordSha256(values) };
        if (g.sessionId !== prepared.parentSessionId || g.sourceSha256 !== prepared.parentSourceSha256
            || !same(prepared.initial, { ...initialDescriptor, stateSnapshotSha256: recordSha256(initialDescriptor) }))
            fail('DERIVED_INITIAL_BASIS_INVALID');
        const current = ledger.capture({ ownerSessionId: prepared.parentSessionId,
            ownerInheritedEventCount: prepared.parentInheritedEventCount, events, sourceSha256: prepared.parentSourceSha256,
            genesis: prepared.initial });
        if (current.kind !== 'ready' || !same(current.proof, prepared.ledger))
            fail('DERIVED_TERMINAL_FACTS_CHANGED');
        return prepared;
    }
    async function putExact(table, key, value) {
        const before = table.get(key);
        if (before !== undefined && !same(before, value))
            fail('DERIVED_WRITE_CONFLICT');
        if (before === undefined)
            try {
                await table.put(key, data(value));
            }
            catch { /* exact committed readback below */ }
        if (!same(table.get(key), value))
            fail('DERIVED_WRITE_UNCONFIRMED');
    }
    /** Runs in Native's reservation callback, before child publication. Parent
     * capture has its Source lock; no lock spans Native creation or Agent waits. */
    async function prepare(operation, reservation) {
        if (operation.anchor.openingOnly || reservation.seedLength === 0)
            return;
        await deps.withSourceLock(reservation.sourceSessionId, async () => {
            const owner = deps.session(reservation.sourceSessionId);
            if (!owner || owner.id !== operation.anchor.sourceSessionId || reservation.seedLength !== operation.anchor.expectedSeedLength
                || !id(reservation.childSessionId) || reservation.childSessionId === owner.id)
                fail('DERIVED_RESERVATION_INVALID');
            const g = deps.readGenesis(owner.id);
            // Plain/legacy branches retain their established import/opening contract.
            // A numerical reader can only proceed from an actually verified root.
            if (!g)
                return;
            const initial = deps.state().readGenesisAuthority(owner.id);
            if (initial.kind !== 'ready')
                fail(initial.code);
            const events = prefix(owner, reservation.seedLength), sourceSha256 = deps.readSourceSha256(owner.id);
            const captured = ledger.capture({ ownerSessionId: owner.id, ownerInheritedEventCount: owner.inheritedEventCount,
                events: events, sourceSha256, genesis: initial.snapshot });
            if (captured.kind !== 'ready')
                fail(captured.code);
            const prior = 'initEvent' in g ? openingFact(g) : (() => {
                const basis = deps.branch.get(mvuDerivedBasisKey(owner.id));
                if (!basis)
                    fail('DERIVED_PARENT_BASIS_UNPROVEN');
                return { kind: 'derived', basisKey: mvuDerivedBasisKey(owner.id), basisSha256: basis.basisSha256 };
            })();
            const fields = {
                operationId: operation.operationId, anchorSha256: recordSha256(operation.anchor), parentSessionId: owner.id,
                childSessionId: reservation.childSessionId, seedLength: reservation.seedLength,
                parentInheritedEventCount: owner.inheritedEventCount, parentSourceSha256: sourceSha256,
                prefixSha256: recordSha256(events), genesis: g, genesisFact: prior, initial: initial.snapshot
            };
            const body = captured.proof.schemaVersion === 1
                ? { schemaVersion: 1, encoding: 'native-mvu-derived-prepared-v1', ...fields, ledger: captured.proof }
                : { schemaVersion: 2, encoding: 'native-mvu-derived-prepared-v2', ...fields, ledger: captured.proof };
            await putExact(deps.branch, mvuDerivedPreparedKey(reservation.childSessionId), { ...body, preparedSha256: recordSha256(body) });
        });
    }
    function generated(basis) {
        const sid = basis.prepared.childSessionId, sourceSha256 = basis.source.childSourceSha256, values = basis.prepared.ledger.numericalSnapshot.values;
        const eventId = recordSha256({ encoding: 'native-mvu-derived-genesis-identity-v1', sessionId: sid,
            operationId: basis.prepared.operationId, basisSha256: basis.basisSha256 });
        const descriptor = { schemaVersion: 1, encoding: 'native-mvu-derived-genesis-event-v1', sessionId: sid,
            sourceSha256, revision: 1, eventId, basisSha256: basis.basisSha256, values, valuesSha256: recordSha256(values) };
        const derivedEvent = { ...descriptor, eventSha256: recordSha256(descriptor) };
        const derivedHead = { schemaVersion: 1, encoding: 'native-mvu-derived-genesis-head-v1', sessionId: sid,
            sourceSha256, revision: 1, eventId, eventSha256: derivedEvent.eventSha256, basisSha256: basis.basisSha256, valuesSha256: derivedEvent.valuesSha256 };
        return { sessionId: sid, sourceSha256, derivedEvent, derivedHead };
    }
    function sourceMatchesGenesis(basis) {
        const g = basis.prepared.genesis, original = basis.source.originalImport;
        if ('initEvent' in g) {
            const source = g.initEvent.plan.identity.source;
            return source.sourceRecordSessionId === original.ownerSessionId && source.importId === original.importId
                && source.rawSha256 === original.rawSha256 && source.normalizedSha256 === original.normalizedSha256
                && source.coverageSha256 === original.coverageSha256 && source.transactionId === original.transactionId;
        }
        const fact = basis.prepared.genesisFact;
        const parent = fact.kind === 'derived' ? deps.branch.get(fact.basisKey) : undefined;
        return !!parent && same(parent.source.originalImport, original);
    }
    /** The descendant's actual Source anchors the chain. Older sources are
     * checked against the next generation and Native headers, not today's
     * ancestor pointer, context, state head or retained Agent. */
    function readHistorical(sid, inherited, successor, seen) {
        try {
            if (seen.size >= 32 || seen.has(sid))
                return;
            seen.add(sid);
            const raw = deps.branch.get(mvuDerivedBasisKey(sid));
            if (!raw)
                return;
            const basis = data(raw);
            exact(basis, ['schemaVersion', 'encoding', 'prepared', 'source', 'basisSha256']);
            const { basisSha256, ...body } = basis;
            if (!basisVersion(basis) || recordSha256(body) !== basisSha256
                || basis.prepared.childSessionId !== sid || !same(deps.branch.get(mvuDerivedPreparedKey(sid)), basis.prepared)
                || !lineage.historical(basis.source, successor) || basis.source.parentSourceSha256 !== basis.prepared.parentSourceSha256
                || basis.source.parentSessionId !== basis.prepared.parentSessionId || basis.source.childSessionId !== sid
                || basis.source.expectedSeedLength !== basis.prepared.seedLength || !sourceMatchesGenesis(basis)
                || basis.prepared.seedLength > inherited.length)
                return;
            const events = inherited.slice(0, basis.prepared.seedLength);
            validPrepared(basis.prepared, events, seen, basis.source);
            const g = generated(basis);
            if (!same(deps.status.get(mvuDerivedEventKey(sid)), g.derivedEvent)
                || !same(deps.status.get(mvuDerivedHeadKey(sid)), g.derivedHead))
                return;
            return data(g);
        }
        catch {
            return undefined;
        }
    }
    function readClosedGenesis(sid, currentSource, seen = new Set()) {
        try {
            if (seen.size >= 32 || seen.has(sid))
                return;
            seen.add(sid);
            const session = deps.session(sid), raw = deps.branch.get(mvuDerivedBasisKey(sid));
            if (!session || !raw)
                return;
            const basis = data(raw);
            exact(basis, ['schemaVersion', 'encoding', 'prepared', 'source', 'basisSha256']);
            const { basisSha256, ...body } = basis;
            if (!basisVersion(basis) || recordSha256(body) !== basisSha256
                || basis.prepared.childSessionId !== sid || !same(deps.branch.get(mvuDerivedPreparedKey(sid)), basis.prepared)
                || !(currentSource ? lineage.current(basis.source) : lineage.verifyDenialBindingFacts(basis.source))
                || basis.source.parentSourceSha256 !== basis.prepared.parentSourceSha256
                || basis.source.parentSessionId !== basis.prepared.parentSessionId || basis.source.childSessionId !== sid
                || basis.source.expectedSeedLength !== basis.prepared.seedLength || !sourceMatchesGenesis(basis))
                return;
            validPrepared(basis.prepared, prefix(session, basis.prepared.seedLength), seen, basis.source);
            const g = generated(basis);
            if (!same(deps.status.get(mvuDerivedEventKey(sid)), g.derivedEvent)
                || !same(deps.status.get(mvuDerivedHeadKey(sid)), g.derivedHead))
                return;
            return data(g);
        }
        catch {
            return undefined;
        }
    }
    /** A changed current Source cannot erase the immutable numerical root's denial
     * identity. Expose neither values nor a VerifiedGenesis to an authority reader. */
    function readDenialBasis(sid) {
        const genesis = readClosedGenesis(sid, false), session = deps.session(sid);
        if (!genesis || !session || !Number.isSafeInteger(session.inheritedEventCount))
            return;
        const event = genesis.derivedEvent, head = genesis.derivedHead;
        return { root: { schemaVersion: 1, encoding: 'native-mvu-derived-state-root-v1',
                derivedEventId: event.eventId, derivedEventSha256: event.eventSha256,
                derivedHeadSha256: recordSha256(head), basisSha256: event.basisSha256 }, editFloorSeq: session.inheritedEventCount };
    }
    async function commit(operation, child) {
        const raw = deps.branch.get(mvuDerivedPreparedKey(child.id));
        if (raw === undefined)
            return;
        await deps.withSourceLock(child.id, async () => {
            const existing = deps.branch.get(mvuDerivedBasisKey(child.id));
            if (existing !== undefined) {
                if (!readClosedGenesis(child.id, true))
                    fail('DERIVED_READY_INVALID');
                return;
            }
            const candidate = data(raw);
            const source = lineage.capture(candidate.parentSessionId, child.id, child.inheritedEventCount);
            const prepared = validPrepared(candidate, prefix(child, child.inheritedEventCount), new Set([child.id]), source);
            if (prepared.operationId !== operation.operationId)
                fail('DERIVED_OPERATION_MISMATCH');
            if (source.parentSourceSha256 !== prepared.parentSourceSha256)
                fail('DERIVED_PARENT_SOURCE_CHANGED');
            const descriptor = prepared.schemaVersion === 1
                ? { schemaVersion: 1, encoding: 'native-mvu-derived-basis-v1', prepared, source }
                : { schemaVersion: 2, encoding: 'native-mvu-derived-basis-v2', prepared, source };
            const basis = descriptor.schemaVersion === 1
                ? { ...descriptor, basisSha256: recordSha256(descriptor) }
                : { ...descriptor, basisSha256: recordSha256(descriptor) };
            const g = generated(basis);
            await putExact(deps.status, mvuDerivedEventKey(child.id), g.derivedEvent);
            await putExact(deps.status, mvuDerivedHeadKey(child.id), g.derivedHead);
            await putExact(deps.branch, mvuDerivedBasisKey(child.id), basis);
            if (!readClosedGenesis(child.id, true))
                fail('DERIVED_READY_UNCONFIRMED');
        });
    }
    return { prepare, commit, readGenesis: (sid) => readClosedGenesis(sid, true), readDenialBasis,
        required: (sid) => deps.branch.get(mvuDerivedPreparedKey(sid)) !== undefined
            || deps.branch.get(mvuDerivedBasisKey(sid)) !== undefined };
}
