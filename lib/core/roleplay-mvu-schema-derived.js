// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-derived.ts; edit the TypeScript source.
/** Actual fork reservation/commit owner for a schema numerical baseline.
 * Cold reads verify immutable facts and Native ancestry; they never complete a
 * partial reservation or recreate the parent's input/maintenance permissions. */
import { recordSha256 } from './roleplay-data.js';
import { createRoleplayMvuLineage } from './roleplay-mvu-lineage.js';
import { freezeMvuSchemaStoryData, sealMvuSchemaStoryFact } from './roleplay-mvu-schema-story-types.js';
import { validateMvuSchemaDerivedPrepared, validateMvuSchemaDerivedBasis, mvuSchemaDerivedGenesis, mvuSchemaDerivedPreparedKey, mvuSchemaDerivedBasisKey, mvuSchemaDerivedEventKey, mvuSchemaDerivedHeadKey } from './roleplay-mvu-schema-derived-types.js';
const same = (left, right) => recordSha256(left) === recordSha256(right);
function fail(code) { throw Error(code); }
export function createRoleplayMvuSchemaDerived(deps) {
    const lineage = createRoleplayMvuLineage(deps);
    const reservations = new Map();
    let disposed = false;
    function prefix(session, cut) {
        const events = session.snapshotEvents();
        if (!Number.isSafeInteger(cut) || cut < 1 || cut > events.length || events.some((event, index) => event.seq !== index)) {
            fail('SCHEMA_DERIVED_PREFIX_UNPROVEN');
        }
        return events.slice(0, cut);
    }
    function operationCurrent(prepared) {
        const operation = deps.branch.get(`fork-op-${prepared.operationId}`);
        return !!operation && operation.operationId === prepared.operationId
            && operation.reservedChildSessionId === prepared.childSessionId && operation.state !== 'failed'
            && operation.state !== 'aborted' && !operation.abortedAt
            && operation.anchor.sourceSessionId === prepared.parentSessionId
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
        if (existing === undefined)
            try {
                await table.put(key, freezeMvuSchemaStoryData(value));
            }
            catch { /* Retain the original intent and confirm only exact committed bytes. */ }
        if (!same(table.get(key), value))
            fail('SCHEMA_DERIVED_WRITE_UNCONFIRMED');
    }
    function verifyPrepared(input, events, source, seen) {
        const prepared = validateMvuSchemaDerivedPrepared(input);
        if (events.length !== prepared.seedLength || prepared.prefix.journal.nativePrefixSha256 !== recordSha256(events)
            || !operationCurrent(prepared) || !nativeBasisCurrent(prepared))
            fail('SCHEMA_DERIVED_BASIS_UNPROVEN');
        const seed = prepared.prefix.seed;
        const initial = seed.kind === 'derived' ? readHistorical(prepared.parentSessionId, events, source, seen) : undefined;
        if (seed.kind === 'derived' && (!initial || initial.basisKey !== seed.basisKey || initial.basisSha256 !== seed.basisSha256)) {
            fail('SCHEMA_DERIVED_PARENT_UNPROVEN');
        }
        if (!deps.history.verifyForkPrefix(prepared.prefix, events, initial))
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
                || !lineage.historical(basis.source, successor))
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
                || !(currentSource ? lineage.current(basis.source) : lineage.verifyDenialBindingFacts(basis.source)))
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
            const prepared = validateMvuSchemaDerivedPrepared(sealMvuSchemaStoryFact({ schemaVersion: 1,
                encoding: 'native-mvu-schema-derived-prepared-v1', operationId: operation.operationId,
                anchorSha256: recordSha256(operation.anchor), parentSessionId: parent.id, childSessionId: reservation.childSessionId,
                seedLength: reservation.seedLength, parentInheritedEventCount: parent.inheritedEventCount,
                parentSourceSha256: frozen.sourceSha256, prefix: frozen }, 'preparedSha256'));
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
            const source = lineage.capture(candidate.parentSessionId, child.id, child.inheritedEventCount);
            const prepared = verifyPrepared(candidate, prefix(child, child.inheritedEventCount), source, new Set([child.id]));
            if (prepared.operationId !== operation.operationId || source.parentSourceSha256 !== prepared.parentSourceSha256) {
                fail('SCHEMA_DERIVED_PARENT_SOURCE_CHANGED');
            }
            const basis = validateMvuSchemaDerivedBasis(sealMvuSchemaStoryFact({ schemaVersion: 1,
                encoding: 'native-mvu-schema-derived-basis-v1', prepared, source }, 'basisSha256'));
            const genesis = mvuSchemaDerivedGenesis(basis);
            // Incomplete event/head/basis publication remains an unknown reservation.
            // A GET or cold read cannot supply the missing writes.
            // Only the actual reservation callback can mint this private, single-use
            // owner. Persisted prepared/basis hashes cannot restore it after teardown.
            owner.spent = true;
            await putExact(deps.status, mvuSchemaDerivedEventKey(child.id), genesis.event);
            await putExact(deps.status, mvuSchemaDerivedHeadKey(child.id), genesis.head);
            await putExact(deps.branch, mvuSchemaDerivedBasisKey(child.id), basis);
            if (!readGenesis(child.id))
                fail('SCHEMA_DERIVED_READY_UNCONFIRMED');
        });
    }
    return { prepare, commit, readGenesis,
        required: (sid) => deps.branch.get(mvuSchemaDerivedPreparedKey(sid)) !== undefined
            || deps.branch.get(mvuSchemaDerivedBasisKey(sid)) !== undefined,
        dispose() { disposed = true; reservations.clear(); } };
}
