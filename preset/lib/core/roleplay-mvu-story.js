// Generated from runtime/alpha3/src/core/roleplay-mvu-story.ts; edit the TypeScript source.
/** Actual completed-story preparation. The parser and state publisher remain
 * deterministic; this coordinator adds no semantic/model request. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { prepareMvuUpdate } from './roleplay-mvu-update.js';
import { prepareMvuUpdateV2 } from './roleplay-mvu-update-v2.js';
import { inputSnapshotReferenceCurrent } from './roleplay-preparation.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
export function createRoleplayMvuStoryCompletion(deps) {
    function snapshot(scope) {
        const { currency, receipt } = scope, sid = receipt.checkpoint.sessionId;
        if (currency.source.kind !== 'story' || !currency.source.headRef || !currency.snapshot
            || !inputSnapshotReferenceCurrent(deps.table, sid, currency))
            return;
        const row = deps.table.get(currency.snapshot.key);
        const state = row?.numericalState;
        if (!state || state.sessionId !== sid || state.sourceSha256 !== currency.source.sourceSha256
            || state.headSha256 !== currency.source.headRef.sha256)
            return;
        return structuredClone(state);
    }
    function canonicalCurrent(intent) {
        const event = deps.table.get(intent.preparationSnapshot.key);
        if (!event || !Number.isSafeInteger(event.turnId))
            return false;
        const body = deps.readCanonical(intent.sessionId, event.turnId);
        return !!body && same(intent.canonical, { seq: body.seq, messageId: body.messageId,
            versionSha256: body.versionSha256, narrativeSha256: sha256(body.narrative) });
    }
    function verifyStored(scope, intent, consumed = false) {
        try {
            if (!deps.verifyNative(scope))
                return false;
            if (scope.transition)
                return !intent;
            const state = snapshot(scope);
            if (!intent || !state)
                return false;
            const { schemaVersion: _schema, encoding: _encoding, sessionId: _sid, sourceSha256: _source, values: _values, ...base } = state;
            const bodyNow = consumed && deps.readConsumedCanonical
                ? deps.readConsumedCanonical(intent.sessionId, intent.canonical.seq, scope.receipt.checkpoint.actualTurn, scope.receipt.turnEndSeq)
                : deps.readHistoricalCanonical(intent.sessionId, intent.canonical.seq, scope.receipt.checkpoint.actualTurn);
            if (!bodyNow || !same(base, intent.base) || !same(intent.canonical, { seq: bodyNow.seq, messageId: bodyNow.messageId,
                versionSha256: bodyNow.versionSha256, narrativeSha256: sha256(bodyNow.narrative) }))
                return false;
            const candidate = intent.schemaVersion === 1 && intent.encoding === 'native-mvu-state-terminal-intent-v1'
                ? prepareMvuUpdate(bodyNow.narrative, state.values)
                : intent.schemaVersion === 2 && intent.encoding === 'native-mvu-state-terminal-intent-v2'
                    ? prepareMvuUpdateV2(bodyNow.narrative, state.values) : undefined;
            if (!candidate)
                return false;
            if (candidate.kind === 'rejected' || !same(intent.candidate, { kind: candidate.kind, candidateSha256: recordSha256(candidate) }))
                return false;
            const { intentSha256, ...body } = intent;
            return recordSha256(body) === intentSha256 && intent.completedReceiptSha256 === recordSha256(scope.receipt)
                && intent.preparationId === scope.currency.preparationId && intent.credentialSha256 === scope.currency.credentialSha256
                && intent.receiptGeneration === scope.currency.receiptGeneration && intent.attemptGeneration === scope.currency.attemptGeneration
                && intent.stopGeneration === scope.stopGeneration && same(intent.preparationSnapshot, scope.currency.snapshot)
                && intent.refsSha256 === recordSha256(scope.receipt.checkpoint.refs);
        }
        catch {
            return false;
        }
    }
    async function prepare(scope, closing) {
        if (!deps.verifyNative(scope))
            throw new Error('INPUT_TERMINAL_NATIVE_UNPROVEN');
        if (scope.transition)
            return { kind: 'management-transition', descriptor: deps.prepareManagement(scope) };
        if (scope.currency.source.kind === 'story' && scope.currency.source.headRef?.kind === 'schema-head') {
            if (!deps.schema)
                throw Error('SCHEMA_STORY_NOT_ENABLED');
            return { kind: 'schema-numerical', plan: await deps.schema.prepareCompletion(scope, closing) };
        }
        const sid = scope.receipt.checkpoint.sessionId, turn = scope.receipt.checkpoint.actualTurn;
        await deps.awaitOwnedCompletion(sid, turn);
        const base = snapshot(scope), body = deps.readCanonical(sid, turn);
        if (!base || !body || !deps.sourceCurrent(sid, scope.currency.source.sourceSha256)) {
            throw new Error('INPUT_TERMINAL_STORY_BASIS_CHANGED');
        }
        const phase = deps.table.get(`${sid}__phaseb-${turn}`);
        if (phase?.state !== 'completed' || phase.sessionId !== sid || phase.turnId !== turn || phase.assistantSeq !== body.seq) {
            throw new Error('INPUT_TERMINAL_PHASE_BC_UNRESOLVED');
        }
        const historical = prepareMvuUpdate(body.narrative, base.values);
        // Existing RFC/no-update completions retain their byte-identical protocol.
        // New quoted JSONPatch literals can fail v1 syntax before its dialect
        // check. Opt in only on a successful bounded v2 parse, or keep the explicit
        // legacy-dialect rejection; historical facts always use their sealed version.
        let proposal = historical;
        if (historical.kind === 'rejected') {
            const next = prepareMvuUpdateV2(body.narrative, base.values);
            if (next.kind === 'prepared' || ['LEGACY_COMMAND_UNSUPPORTED', 'OPERATION_UNSUPPORTED'].includes(historical.code)) {
                proposal = next;
            }
        }
        if (proposal.kind === 'rejected')
            throw new Error(`MVU_UPDATE_${proposal.code}`);
        const { schemaVersion: _schema, encoding: _encoding, sessionId: _sid, sourceSha256: _source, values: _values, ...baseIdentity } = base;
        const version = 'schemaVersion' in proposal && proposal.schemaVersion === 2
            ? { schemaVersion: 2, encoding: 'native-mvu-state-terminal-intent-v2' }
            : { schemaVersion: 1, encoding: 'native-mvu-state-terminal-intent-v1' };
        const descriptor = { ...version,
            sessionId: sid, sourceSha256: scope.currency.source.sourceSha256, preparationId: scope.currency.preparationId,
            credentialSha256: scope.currency.credentialSha256, refsSha256: recordSha256(scope.receipt.checkpoint.refs),
            receiptGeneration: scope.currency.receiptGeneration, attemptGeneration: scope.currency.attemptGeneration,
            stopGeneration: scope.stopGeneration, preparationSnapshot: scope.currency.snapshot,
            completedReceiptSha256: recordSha256(scope.receipt), canonical: { seq: body.seq, messageId: body.messageId,
                versionSha256: body.versionSha256, narrativeSha256: sha256(body.narrative) },
            base: baseIdentity, candidate: { kind: proposal.kind, candidateSha256: recordSha256(proposal) } };
        return { kind: 'numerical', intent: { ...descriptor, intentSha256: recordSha256(descriptor) }, base, proposal };
    }
    return { prepare, sourceCurrent: deps.sourceCurrent, canonicalCurrent, verifyStored,
        async publish(scope, plan, token, closing) {
            if (plan.kind === 'schema-numerical')
                return deps.schema ? deps.schema.publishCompletion(scope, plan.plan, closing)
                    : { kind: 'blocked', code: 'SCHEMA_STORY_NOT_ENABLED' };
            if (plan.kind === 'numerical')
                return token ? deps.state.publish({ token, intent: plan.intent, base: plan.base, proposal: plan.proposal })
                    : { kind: 'blocked', code: 'INPUT_TERMINAL_TOKEN_MISSING' };
            return deps.withSourceLock(scope.receipt.checkpoint.sessionId, async () => deps.verifyManagement(scope, plan.descriptor)
                ? { kind: 'acknowledged', settlement: structuredClone(plan.descriptor) }
                : { kind: 'unknown', code: 'INPUT_MANAGEMENT_ACTIVATION_UNPROVEN' });
        },
        verifySettlement(scope, plan, settlement) {
            if (plan.kind === 'schema-numerical')
                return deps.schema?.verifySettlement(scope, plan.plan, settlement) === true;
            if (plan.kind === 'management-transition')
                return same(settlement, plan.descriptor) && deps.verifyManagement(scope, plan.descriptor);
            const facts = deps.state.reconcileFacts(plan.intent);
            return facts.kind === 'committed' && same(facts.settlement, settlement);
        },
        verifyConsumed(scope, plan, settlement) {
            if (plan.kind === 'schema-numerical')
                return deps.schema?.verifyConsumed(scope, plan.plan, settlement) === true;
            if (!verifyStored(scope, plan.kind === 'numerical' ? plan.intent : undefined, true))
                return false;
            if (plan.kind === 'management-transition')
                return same(settlement, plan.descriptor)
                    && same(plan.descriptor, deps.prepareManagement(scope));
            return deps.state.verifyConsumedSettlementFacts({ intent: plan.intent, base: plan.base, proposal: plan.proposal, settlement });
        },
    };
}
