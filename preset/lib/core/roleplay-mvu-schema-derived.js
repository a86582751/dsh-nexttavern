// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-derived.ts; edit the TypeScript source.
/** Actual fork reservation/commit owner for a schema numerical baseline.
 * Cold reads verify immutable facts and Native ancestry; they never complete a
 * partial reservation or recreate the parent's input/maintenance permissions. */
import { recordSha256 } from './roleplay-data.js';
import { createRoleplayMvuLineage } from './roleplay-mvu-lineage.js';
import { createRoleplayMvuFrozenLineage } from './roleplay-mvu-frozen-lineage.js';
import { validateMvuSchemaDerivedPrepared, validateMvuSchemaDerivedBasis, mvuSchemaDerivedGenesis, mvuSchemaDerivedPreparedKey, mvuSchemaDerivedBasisKey, mvuSchemaDerivedEventKey, mvuSchemaDerivedHeadKey, mvuSchemaPrefixClosureKey, sealMvuSchemaInheritanceFact } from './roleplay-mvu-schema-derived-types.js';
import { isAuthorHostJournalReadyV5 } from './roleplay-mvu-schema-journal.js';
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
    async function putExact(table, key, value) {
        const existing = table.get(key);
        if (existing !== undefined && !same(existing, value))
            fail('SCHEMA_DERIVED_WRITE_CONFLICT');
        // Every caller supplies the concrete seal/validator owner's immutable
        // result. Persistence owns exact conflict, lost ACK and readback only.
        if (existing === undefined)
            try {
                await table.put(key, value);
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
    function sourceProofCurrent(source) {
        return source.schemaVersion === 2 ? frozenLineage?.currentProof(source) === true : lineage.currentProof(source);
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
        let ready;
        if (prepared.schemaVersion === 2) {
            const closure = deps.branch.get(prepared.prefixClosureRef.key);
            if (!closure || recordSha256(closure) !== prepared.prefixClosureRef.sha256
                || closure.closureSha256 !== prepared.prefixClosureRef.closureSha256)
                fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
            ready = deps.history.recoverFrozenForkPrefix?.(prepared.prefix, events, initial, closure);
        }
        else
            ready = deps.history.recoverForkPrefix(prepared.prefix, events, initial);
        if (!ready)
            fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
        return { prepared, ready };
    }
    function closedRows(basis, ready, genesis = mvuSchemaDerivedGenesis(basis, ready)) {
        const sid = genesis.sessionId;
        if (!same(deps.branch.get(mvuSchemaDerivedPreparedKey(sid)), basis.prepared)
            || !same(deps.status.get(mvuSchemaDerivedEventKey(sid)), genesis.event)
            || !same(deps.status.get(mvuSchemaDerivedHeadKey(sid)), genesis.head))
            fail('SCHEMA_DERIVED_GENESIS_UNPROVEN');
        return genesis;
    }
    /** Source calls this before its child commit and numerical genesis exist.
     * The checked frozen prefix supplies declaration DATA only; this read never
     * creates, spends or restores a numerical publication reservation. */
    function readPreparedInheritedBrowserProgram(childId, sourcePreparedRef) {
        if (disposed)
            fail('SCHEMA_DERIVED_OWNER_DISPOSED');
        const raw = deps.branch.get(mvuSchemaDerivedPreparedKey(childId));
        if (raw === undefined)
            return;
        const prepared = validateMvuSchemaDerivedPrepared(raw);
        if (prepared.schemaVersion !== 2)
            return;
        const ref = prepared.sourcePreparedRef.preparedRef, child = deps.session(childId);
        if (prepared.childSessionId !== childId || ref.key !== sourcePreparedRef.key || ref.sha256 !== sourcePreparedRef.sha256)
            fail('SCHEMA_DERIVED_FROZEN_SOURCE_CHANGED');
        if (!child)
            fail('SCHEMA_DERIVED_BASIS_UNPROVEN');
        const { ready } = verifyPrepared(prepared, prefix(child, prepared.seedLength), prepared.sourcePreparedRef, new Set([childId]));
        if (!isAuthorHostJournalReadyV5(ready) || ready.epoch.program.browserProgram?.schemaVersion !== 3)
            return;
        return Object.freeze({ program: ready.epoch.program.browserProgram, epochRef: ready.epochRef });
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
            const checked = verifyPrepared(basis.prepared, events.slice(0, basis.prepared.seedLength), basis.source, seen);
            return closedRows(basis, checked.ready);
        }
        catch {
            return undefined;
        }
    }
    function captureGenesis(sid) {
        const session = deps.session(sid);
        if (!session)
            return;
        const basis = validateMvuSchemaDerivedBasis(deps.branch.get(mvuSchemaDerivedBasisKey(sid)));
        if (basis.prepared.childSessionId !== sid || session.inheritedEventCount !== basis.prepared.seedLength
            || !sourceCurrent(basis.source, false))
            return;
        const checked = verifyPrepared(basis.prepared, prefix(session, basis.prepared.seedLength), basis.source, new Set([sid]));
        return Object.freeze({ basis, genesis: closedRows(basis, checked.ready) });
    }
    function readGenesis(sid, currentSource = true) {
        try {
            // Both modes consume one historical DATA object. Reusing it preserves
            // inheritedReady's actual recovered-prefix association; today's Source
            // must never become a dependency of that frozen historical slot.
            const captured = deps.captureRead ? deps.captureRead(sid, () => captureGenesis(sid)).data : captureGenesis(sid);
            if (!captured || currentSource && !sourceProofCurrent(captured.basis.source))
                return;
            return captured.genesis;
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
                await putExact(deps.branch, closureKey, closure);
                captured.assertCurrent();
                const bindingBody = { operationId: operation.operationId, anchor: operation.anchor, reservation }, body = { schemaVersion: 2, encoding: 'native-mvu-schema-derived-prepared-v2', ...fields,
                    sourcePreparedRef: source.ref, parentNumericDescriptorSha256: source.parentSourceSha256,
                    prefixClosureRef: { key: closureKey, sha256: recordSha256(closure), closureSha256: closure.closureSha256 },
                    forkReservationBinding: { ...bindingBody, bindingSha256: recordSha256(bindingBody) } };
                prepared = validateMvuSchemaDerivedPrepared({ ...body, preparedSha256: recordSha256(body) });
            }
            else {
                if (!deps.history.recoverForkPrefix(frozen, events, initial))
                    fail('SCHEMA_DERIVED_HISTORY_UNPROVEN');
                prepared = validateMvuSchemaDerivedPrepared(sealMvuSchemaInheritanceFact({ schemaVersion: 1,
                    encoding: 'native-mvu-schema-derived-prepared-v1', ...fields }, 'preparedSha256'));
            }
            if (!operationCurrent(prepared, 'preparing'))
                fail('SCHEMA_DERIVED_OPERATION_CHANGED');
            await putExact(deps.branch, mvuSchemaDerivedPreparedKey(reservation.childSessionId), prepared);
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
            const { prepared, ready } = verifyPrepared(candidate, prefix(child, child.inheritedEventCount), source, new Set([child.id]));
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
                basis = validateMvuSchemaDerivedBasis(sealMvuSchemaInheritanceFact({ schemaVersion: 1,
                    encoding: 'native-mvu-schema-derived-basis-v1', prepared, source }, 'basisSha256'));
            }
            const genesis = mvuSchemaDerivedGenesis(basis, ready);
            // Incomplete event/head/basis publication remains an unknown reservation.
            // A GET or cold read cannot supply the missing writes.
            // Only the actual reservation callback can mint this private, single-use
            // owner. Persisted prepared/basis hashes cannot restore it after teardown.
            owner.spent = true;
            await putExact(deps.status, mvuSchemaDerivedEventKey(child.id), genesis.event);
            await putExact(deps.status, mvuSchemaDerivedHeadKey(child.id), genesis.head);
            if (!operationCurrent(prepared))
                fail('SCHEMA_DERIVED_OPERATION_CHANGED');
            await putExact(deps.branch, mvuSchemaDerivedBasisKey(child.id), basis);
            // This reservation already verified the full prefix before publishing.
            // Only live Source/Native association and the closed rows can change
            // across these writes; cold/retry readers retain the full genesis check.
            try {
                const actualChild = deps.session(child.id);
                if (!actualChild || prepared.childSessionId !== child.id || actualChild.inheritedEventCount !== prepared.seedLength
                    || !nativeBasisCurrent(prepared) || !sourceCurrent(basis.source, true))
                    fail('SCHEMA_DERIVED_READY_UNCONFIRMED');
                closedRows(basis, ready, genesis);
            }
            catch {
                fail('SCHEMA_DERIVED_READY_UNCONFIRMED');
            }
        });
    }
    return { prepare, commit, readGenesis, readPreparedInheritedBrowserProgram,
        required: (sid) => deps.branch.get(mvuSchemaDerivedPreparedKey(sid)) !== undefined
            || deps.branch.get(mvuSchemaDerivedBasisKey(sid)) !== undefined,
        dispose() { disposed = true; reservations.clear(); } };
}
