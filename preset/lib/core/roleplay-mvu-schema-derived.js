// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-derived.ts; edit the TypeScript source.
/** Actual fork reservation/commit owner for a schema numerical baseline.
 * Cold reads verify immutable facts and Native ancestry; they never complete a
 * partial reservation or recreate the parent's input/maintenance permissions. */
import { recordSha256 } from './roleplay-data.js';
import { createRoleplayMvuLineage } from './roleplay-mvu-lineage.js';
import { createRoleplayMvuFrozenLineage } from './roleplay-mvu-frozen-lineage.js';
import { freezeImmutableDescriptorData } from './roleplay-mvu-schema-descriptor-data.js';
import { freezeMvuSchemaStoryData, sealMvuSchemaStoryFact } from './roleplay-mvu-schema-story-types.js';
import { validateMvuSchemaDerivedPrepared, validateMvuSchemaDerivedBasis, mvuSchemaDerivedGenesis, mvuSchemaDerivedPreparedKey, mvuSchemaDerivedBasisKey, mvuSchemaDerivedEventKey, mvuSchemaDerivedHeadKey, mvuSchemaPrefixClosureKey } from './roleplay-mvu-schema-derived-types.js';
const same = (left, right) => recordSha256(left) === recordSha256(right);
function fail(code) { throw Error(code); }
export function createRoleplayMvuSchemaDerived(deps) {
    const lineage = createRoleplayMvuLineage(deps);
    const frozenLineage = deps.sourceInheritance && deps.readSourceDescriptor ? createRoleplayMvuFrozenLineage({
        ...deps, sourceInheritance: deps.sourceInheritance, readSourceDescriptor: deps.readSourceDescriptor
    }) : undefined;
    const reservations = new Map();
    let disposed = false;
    function prefix(session, cut) {
        const events = session.snapshotEvents();
        if (!Number.isSafeInteger(cut) || cut < 1 || cut > events.length || events.some((event, index) => event.seq !== index)) {
            fail('SCHEMA_DERIVED_PREFIX_UNPROVEN');
        }
        return events.slice(0, cut);
    }
    function operationCurrent(prepared, stage = 'reserved') {
        const operation = deps.branch.get(`fork-op-${prepared.operationId}`);
        if (!operation || operation.operationId !== prepared.operationId || operation.state === 'failed'
            || operation.state === 'aborted' || operation.abortedAt
            || operation.anchor.sourceSessionId !== prepared.parentSessionId)
            return false;
        if (stage === 'preparing') {
            // Native's reserve callback supplies the exact cut/child before the
            // route persists its reservation. Normalize only that cut field; every
            // other anchor field and any existing child selection must still agree.
            const anchor = { ...operation.anchor, expectedSeedLength: prepared.seedLength }, child = operation.reservedChildSessionId ?? operation.childSessionId ?? prepared.childSessionId;
            return child === prepared.childSessionId && recordSha256(anchor) === prepared.anchorSha256;
        }
        // Commit/publication and legacy cold verification require the actual
        // durable reservation, never the callback's preparation-only normalization.
        return operation.reservedChildSessionId === prepared.childSessionId
            && recordSha256(operation.anchor) === prepared.anchorSha256
            && operation.anchor.expectedSeedLength === prepared.seedLength;
    }
    function nativeBasisCurrent(prepared) {
        return deps.readSession(prepared.parentSessionId)?.inheritedEventCount === prepared.parentInheritedEventCount;
    }
    async function putExact(table, key, value, maxBytes = 8_388_608) {
        const existing = table.get(key);
        if (existing !== undefined && !same(existing, value))
            fail('SCHEMA_DERIVED_WRITE_CONFLICT');
        const copied = maxBytes === 8_388_608 ? freezeMvuSchemaStoryData(value)
            : freezeImmutableDescriptorData(value, maxBytes, { nodes: 524_288, depth: 96 });
        if (existing === undefined)
            try {
                await table.put(key, copied);
            }
            catch { /* Retain the original intent and confirm only exact committed bytes. */ }
        if (!same(table.get(key), value))
            fail('SCHEMA_DERIVED_WRITE_UNCONFIRMED');
    }
    function historicalSource(prior, next) {
        if (next.encoding === 'native-tavern-source-inheritance-frozen-ref-v1')
            return frozenLineage?.historicalPrepared(prior, next) === true;
        if (next.schemaVersion === 2)
            return frozenLineage?.historical(prior, next) === true;
        return prior.schemaVersion === 1 && lineage.historical(prior, next);
    }
    function sourceCurrent(source, current) {
        if (source.schemaVersion === 2)
            return frozenLineage
                ? current ? frozenLineage.current(source) : frozenLineage.verifyDenialBindingFacts(source) : false;
        return current ? lineage.current(source) : lineage.verifyDenialBindingFacts(source);
    }
    function verifyPrepared(input, events, source, seen) {
        const prepared = validateMvuSchemaDerivedPrepared(input);
        if (events.length !== prepared.seedLength || prepared.prefix.journal.nativePrefixSha256 !== recordSha256(events)
            || prepared.schemaVersion === 1 && !operationCurrent(prepared) || !nativeBasisCurrent(prepared))
            fail('SCHEMA_DERIVED_BASIS_UNPROVEN');
        if (prepared.schemaVersion === 2) {
            const actual = frozenLineage?.prepared(prepared.childSessionId);
            if (!actual || !same(actual.ref, prepared.sourcePreparedRef)
                || actual.parentSourceSha256 !== prepared.parentSourceSha256
                || actual.frozen.nativeCut.parentInheritedEventCount !== prepared.parentInheritedEventCount)
                fail('SCHEMA_DERIVED_FROZEN_SOURCE_CHANGED');
        }
        const seed = prepared.prefix.seed;
        const successor = prepared.schemaVersion === 2 ? prepared.sourcePreparedRef : source;
        const initial = seed.kind === 'derived' ? readHistorical(prepared.parentSessionId, events, successor, seen) : undefined;
        if (seed.kind === 'derived' && (!initial || initial.basisKey !== seed.basisKey || initial.basisSha256 !== seed.basisSha256)) {
            fail('SCHEMA_DERIVED_PARENT_UNPROVEN');
        }
        if (prepared.schemaVersion === 2) {
            const closure = deps.branch.get(prepared.prefixClosureRef.key);
            if (!closure || recordSha256(closure) !== prepared.prefixClosureRef.sha256
                || closure.closureSha256 !== prepared.prefixClosureRef.closureSha256
                || !deps.history.verifyFrozenForkPrefix?.(prepared.prefix, events, initial, closure))
                fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
        }
        else if (!deps.history.verifyForkPrefix(prepared.prefix, events, initial))
            fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
        return prepared;
    }
    function closedRows(basis) {
        const genesis = mvuSchemaDerivedGenesis(basis), sid = genesis.sessionId;
        if (!same(deps.branch.get(mvuSchemaDerivedPreparedKey(sid)), basis.prepared)
            || !same(deps.status.get(mvuSchemaDerivedEventKey(sid)), genesis.event)
            || !same(deps.status.get(mvuSchemaDerivedHeadKey(sid)), genesis.head))
            fail('SCHEMA_DERIVED_GENESIS_UNPROVEN');
        return genesis;
    }
    /** Validate an older generation against the actual descendant prefix and
     * the next frozen Source, never that ancestor's current pointer or head. */
    function readHistorical(sid, events, successor, seen) {
        try {
            if (seen.size >= 32 || seen.has(sid))
                return;
            seen.add(sid);
            const basis = validateMvuSchemaDerivedBasis(deps.branch.get(mvuSchemaDerivedBasisKey(sid)));
            if (basis.prepared.childSessionId !== sid || basis.prepared.seedLength > events.length
                || !historicalSource(basis.source, successor))
                return;
            verifyPrepared(basis.prepared, events.slice(0, basis.prepared.seedLength), basis.source, seen);
            return closedRows(basis);
        }
        catch {
            return undefined;
        }
    }
    function readGenesis(sid, currentSource = true) {
        try {
            const session = deps.session(sid);
            if (!session)
                return;
            const basis = validateMvuSchemaDerivedBasis(deps.branch.get(mvuSchemaDerivedBasisKey(sid)));
            if (basis.prepared.childSessionId !== sid || session.inheritedEventCount !== basis.prepared.seedLength
                || !sourceCurrent(basis.source, currentSource))
                return;
            verifyPrepared(basis.prepared, prefix(session, basis.prepared.seedLength), basis.source, new Set([sid]));
            return closedRows(basis);
        }
        catch {
            return undefined;
        }
    }
    async function prepare(operation, reservation) {
        if (disposed)
            fail('SCHEMA_DERIVED_OWNER_DISPOSED');
        if (operation.anchor.openingOnly || reservation.seedLength === 0)
            return;
        const existing = deps.branch.get(mvuSchemaDerivedPreparedKey(reservation.childSessionId));
        if (existing !== undefined) {
            // A retry can retain the actual unspent owner. A persisted prepared row
            // cannot recreate that owner after teardown or a partial publication.
            await deps.withSourceLock(reservation.sourceSessionId, async () => {
                const prepared = validateMvuSchemaDerivedPrepared(existing), owner = reservations.get(reservation.childSessionId), parent = deps.session(reservation.sourceSessionId);
                if (disposed || prepared.schemaVersion !== 2 || !owner || owner.spent || !parent
                    || owner.operationId !== operation.operationId || owner.preparedSha256 !== prepared.preparedSha256
                    || prepared.operationId !== operation.operationId || !operationCurrent(prepared, 'preparing'))
                    fail('SCHEMA_DERIVED_PUBLICATION_UNKNOWN');
                verifyPrepared(prepared, prefix(parent, prepared.seedLength), prepared.sourcePreparedRef, new Set());
            });
            return;
        }
        // A read-only replay has no Source lock or publication owner. Capture the
        // actual, unchanged parent facts under the one lock after it returns.
        const frozen = await deps.history.captureForkPrefix(reservation.sourceSessionId, reservation.seedLength);
        await deps.withSourceLock(reservation.sourceSessionId, async () => {
            if (disposed)
                fail('SCHEMA_DERIVED_OWNER_DISPOSED');
            const parent = deps.session(reservation.sourceSessionId);
            if (!parent || parent.id !== operation.anchor.sourceSessionId || reservation.childSessionId === parent.id
                || reservation.seedLength !== operation.anchor.expectedSeedLength)
                fail('SCHEMA_DERIVED_RESERVATION_INVALID');
            const events = prefix(parent, reservation.seedLength);
            if (frozen.journal.nativePrefixSha256 !== recordSha256(events)
                || frozen.sourceSha256 !== deps.readSourceSha256(parent.id))
                fail('SCHEMA_DERIVED_SOURCE_CHANGED');
            const initial = frozen.seed.kind === 'derived' ? readGenesis(parent.id) : undefined;
            if (!deps.history.verifyForkPrefix(frozen, events, initial))
                fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
            const fields = { operationId: operation.operationId,
                anchorSha256: recordSha256(operation.anchor), parentSessionId: parent.id, childSessionId: reservation.childSessionId,
                seedLength: reservation.seedLength, parentInheritedEventCount: parent.inheritedEventCount,
                parentSourceSha256: frozen.sourceSha256, prefix: frozen };
            let prepared;
            if (frozenLineage) {
                const source = frozenLineage.prepared(reservation.childSessionId);
                if (source.parentSourceSha256 !== frozen.sourceSha256
                    || recordSha256(deps.readSourceDescriptor(parent.id)) !== source.parentSourceSha256
                    || source.frozen.operationId !== operation.operationId || source.frozen.anchorSha256 !== fields.anchorSha256
                    || source.frozen.parentSessionId !== parent.id || source.frozen.nativeCut.seedLength !== reservation.seedLength
                    || source.frozen.nativeCut.parentInheritedEventCount !== parent.inheritedEventCount
                    || source.frozen.nativeCut.prefixSha256 !== recordSha256(events))
                    fail('SCHEMA_DERIVED_SOURCE_CHANGED');
                const captured = deps.history.captureFrozenForkPrefix?.(frozen, events, initial);
                if (!captured)
                    fail('SCHEMA_DERIVED_FROZEN_HISTORY_UNAVAILABLE');
                const closure = captured.closure, closureKey = mvuSchemaPrefixClosureKey(reservation.childSessionId, closure.closureSha256);
                captured.assertCurrent();
                await putExact(deps.branch, closureKey, closure, 67_108_864);
                captured.assertCurrent();
                const bindingBody = { operationId: operation.operationId, anchor: operation.anchor, reservation }, body = { schemaVersion: 2, encoding: 'native-mvu-schema-derived-prepared-v2', ...fields,
                    sourcePreparedRef: source.ref, parentNumericDescriptorSha256: source.parentSourceSha256,
                    prefixClosureRef: { key: closureKey, sha256: recordSha256(closure), closureSha256: closure.closureSha256 },
                    forkReservationBinding: { ...bindingBody, bindingSha256: recordSha256(bindingBody) } };
                prepared = validateMvuSchemaDerivedPrepared({ ...body, preparedSha256: recordSha256(body) });
            }
            else
                prepared = validateMvuSchemaDerivedPrepared(sealMvuSchemaStoryFact({ schemaVersion: 1,
                    encoding: 'native-mvu-schema-derived-prepared-v1', ...fields }, 'preparedSha256'));
            if (!operationCurrent(prepared, 'preparing'))
                fail('SCHEMA_DERIVED_OPERATION_CHANGED');
            await putExact(deps.branch, mvuSchemaDerivedPreparedKey(reservation.childSessionId), prepared, prepared.schemaVersion === 2 ? 16_777_216 : 8_388_608);
            if (disposed)
                fail('SCHEMA_DERIVED_OWNER_DISPOSED');
            if (reservations.has(reservation.childSessionId))
                fail('SCHEMA_DERIVED_RESERVATION_CONFLICT');
            reservations.set(reservation.childSessionId, { operationId: operation.operationId,
                preparedSha256: prepared.preparedSha256, spent: false });
        });
    }
    async function commit(operation, child) {
        const raw = deps.branch.get(mvuSchemaDerivedPreparedKey(child.id));
        if (raw === undefined)
            return;
        await deps.withSourceLock(child.id, async () => {
            if (deps.branch.get(mvuSchemaDerivedBasisKey(child.id)) !== undefined) {
                if (!readGenesis(child.id))
                    fail('SCHEMA_DERIVED_READY_INVALID');
                return;
            }
            const candidate = validateMvuSchemaDerivedPrepared(raw);
            const owner = reservations.get(child.id);
            if (disposed || !owner || owner.spent || owner.operationId !== operation.operationId
                || owner.preparedSha256 !== candidate.preparedSha256
                || deps.status.get(mvuSchemaDerivedEventKey(child.id)) !== undefined
                || deps.status.get(mvuSchemaDerivedHeadKey(child.id)) !== undefined)
                fail('SCHEMA_DERIVED_PUBLICATION_UNKNOWN');
            const source = candidate.schemaVersion === 2 ? frozenLineage?.capture(child.id, candidate.sourcePreparedRef)
                : lineage.capture(candidate.parentSessionId, child.id, child.inheritedEventCount);
            if (!source)
                fail('SCHEMA_DERIVED_FROZEN_SOURCE_UNAVAILABLE');
            const prepared = verifyPrepared(candidate, prefix(child, child.inheritedEventCount), source, new Set([child.id]));
            if (prepared.operationId !== operation.operationId || source.parentSourceSha256 !== prepared.parentSourceSha256) {
                fail('SCHEMA_DERIVED_PARENT_SOURCE_CHANGED');
            }
            if (!operationCurrent(prepared))
                fail('SCHEMA_DERIVED_OPERATION_CHANGED');
            let basis;
            if (prepared.schemaVersion === 2) {
                if (source.schemaVersion !== 2)
                    fail('SCHEMA_DERIVED_FROZEN_SOURCE_UNAVAILABLE');
                const body = { schemaVersion: 2, encoding: 'native-mvu-schema-derived-basis-v2', prepared, source };
                basis = validateMvuSchemaDerivedBasis({ ...body, basisSha256: recordSha256(body) });
            }
            else {
                if (source.schemaVersion !== 1)
                    fail('SCHEMA_DERIVED_FROZEN_SOURCE_UNAVAILABLE');
                basis = validateMvuSchemaDerivedBasis(sealMvuSchemaStoryFact({ schemaVersion: 1,
                    encoding: 'native-mvu-schema-derived-basis-v1', prepared, source }, 'basisSha256'));
            }
            const genesis = mvuSchemaDerivedGenesis(basis);
            // Incomplete event/head/basis publication remains an unknown reservation.
            // A GET or cold read cannot supply the missing writes.
            // Only the actual reservation callback can mint this private, single-use
            // owner. Persisted prepared/basis hashes cannot restore it after teardown.
            owner.spent = true;
            await putExact(deps.status, mvuSchemaDerivedEventKey(child.id), genesis.event);
            await putExact(deps.status, mvuSchemaDerivedHeadKey(child.id), genesis.head);
            if (!operationCurrent(prepared))
                fail('SCHEMA_DERIVED_OPERATION_CHANGED');
            await putExact(deps.branch, mvuSchemaDerivedBasisKey(child.id), basis, basis.schemaVersion === 2 ? 16_777_216 : 8_388_608);
            if (!readGenesis(child.id))
                fail('SCHEMA_DERIVED_READY_UNCONFIRMED');
        });
    }
    return { prepare, commit, readGenesis,
        required: (sid) => deps.branch.get(mvuSchemaDerivedPreparedKey(sid)) !== undefined
            || deps.branch.get(mvuSchemaDerivedBasisKey(sid)) !== undefined,
        dispose() { disposed = true; reservations.clear(); } };
}
