// Generated from runtime/alpha3/src/core/roleplay-tavern-lore-timed-history.ts; edit the TypeScript source.
/** Native request/material is the append-only publication of activation timing.
 * Core rows explain that event; a cold read never acquires dispatch permission. */
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256 } from './roleplay-data.js';
import { captureRoleplayTavernMaterialHistoryV1 } from './roleplay-tavern-material-history.js';
import { validateTavernLoreSnapshotV1 } from './tavern-lore-snapshot.mjs';
import { validateTavernLoreCompilationV1 } from './tavern-lore-compiler.mjs';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { TavernLoreTimedStateV1 } from './tavern-lore-timed.mjs';
export const TAVERN_NATIVE_TIMED_PUBLICATION_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-material-lore-timing-publication-policy-v1',
    publication: 'first-actual-required-Native-material-event-for-one-bound-Core-plan',
    providerFailure: 'published-timing-survives-interrupted-provider-attempt',
    retry: 'same-plan-ref-zero-additional-timed-actions',
    source: 'immutable-session-import-book-identity; semantic-pin-clears-edited-controls',
    storage: 'no-second-table-head-write; actual-Native-event-plus-exact-Core-row-refs',
    authority: 'historical-consumer-data-only; current-Native-and-Source-owner-required-separately' });
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function fail(code) { throw Error(code); }
const same = (left, right) => recordSha256(left) === recordSha256(right);
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
const identity = (source) => ({ sessionId: source.ownerSessionId, sourceRecordSessionId: source.sourceRecordSessionId, importId: source.importId,
    rawSha256: source.rawSourceSha256, documentSha256: source.documentSha256,
    bookPointer: source.bookPointer, bookSha256: source.bookValueSha256 });
/** Shared historical verification preserves the original owner/address and
 * producer algorithm. Inheritance maps only the already verified result. */
export function readTavernTimedPublicationV1(publication, ownerSessionId) {
    const { event, snapshot: snapshotRow, plan: planRow } = publication, snapshotPayload = snapshotRow.payload, planPayload = planRow.payload;
    if (!object(planPayload.promptPlan) || !object(snapshotPayload.tavernEvaluationInput))
        fail('INPUT_MATERIAL_TIMED_TAVERN_RECORD_UNAVAILABLE');
    const input = snapshotPayload.tavernEvaluationInput, tavernPlan = planPayload.promptPlan.tavernEvaluationPlan;
    if (!object(tavernPlan) || tavernPlan.schemaVersion !== 1 || tavernPlan.encoding !== 'owned-st-lore-evaluation-plan-v1'
        || tavernPlan.authority !== 'consumer-data-only')
        fail('INPUT_MATERIAL_TIMED_TAVERN_RECORD_UNAVAILABLE');
    const plan = tavernPlan, compilation = validateTavernLoreCompilationV1(input.compilation), snapshot = validateTavernLoreSnapshotV1(input.snapshot), { planSha256, ...planBody } = plan;
    if (input.schemaVersion !== 1 || input.encoding !== 'owned-st-lore-evaluator-input-v1'
        || recordSha256(planBody) !== planSha256 || plan.sessionId !== ownerSessionId || plan.branchId !== ownerSessionId
        || plan.snapshotSha256 !== snapshot.snapshotSha256 || plan.compilerPlanSha256 !== compilation.plan.planSha256
        || plan.sourceReferenceSha256 !== compilation.plan.sourceReferenceSha256
        || snapshot.sessionId !== ownerSessionId || snapshot.attemptId !== plan.attemptId
        || snapshotRow.currency && planRow.currency && !same(snapshotRow.currency, planRow.currency))
        fail('INPUT_MATERIAL_TIMED_PLAN_BINDING_INVALID');
    return { publication, input, compilation, snapshot, plan, sourceIdentity: identity(compilation.plan.source),
        planKey: `${event.data.plan.key}:${event.data.plan.sha256}`,
        attemptKey: `${ownerSessionId}:${plan.attemptId}:${event.data.step}` };
}
export function replayTavernTimedPublicationV1(read, revision, intervals) {
    const { compilation, snapshot, plan } = read, timed = snapshot.timed, proposal = plan.timedProposal, sid = plan.sessionId;
    if (timed.branchId !== sid || timed.revision !== revision || !same(timed.intervals, intervals)
        || proposal.schemaVersion !== 1 || proposal.encoding !== 'owned-st-timed-proposals-v1' || proposal.branchId !== sid
        || proposal.baseRevision !== revision || proposal.baseSha256 !== snapshot.timedSha256 || proposal.chatIndex !== timed.chatIndex
        || !Array.isArray(proposal.actions) || proposal.actions.length > 8192)
        fail('INPUT_MATERIAL_TIMED_BASE_CHANGED');
    if (!Array.isArray(plan.activatedEntryIds) || plan.activatedEntryIds.length > 4096
        || new Set(plan.activatedEntryIds).size !== plan.activatedEntryIds.length)
        fail('INPUT_MATERIAL_TIMED_ACTION_INVALID');
    const entries = new Map(compilation.plan.entries.map(entry => {
        const blocking = entry.diagnosticIndexes.map(index => compilation.diagnostics[index]).filter(row => row.blocking), eligible = entry.disposition !== 'retained-ineligible'
            || blocking.length > 0 && blocking.every(row => row.code === 'LORE_VECTORIZED_EVALUATOR_REQUIRED'), semantic = { ...ST_LORE_ENTRY_DEFAULTS_V1, displayIndex: entry.ordinal, ...entry.semanticOverrides };
        return [entry.entryId, { entry, semantic, eligible }];
    }));
    for (const id of plan.activatedEntryIds) {
        const entry = entries.get(id);
        if (!entry?.eligible || !entry.semantic.enabled)
            fail('INPUT_MATERIAL_TIMED_ACTION_INVALID');
    }
    const replay = new TavernLoreTimedStateV1(timed, entries);
    replay.activated(plan.activatedEntryIds);
    if (!same(replay.actions, proposal.actions)
        || proposal.disposition !== (replay.actions.length ? 'proposed-consumer-data-only' : 'empty-no-timed-effects'))
        fail('INPUT_MATERIAL_TIMED_ACTION_INVALID');
    return replay.actions;
}
export function applyTavernTimedActionV1(intervals, action) {
    const key = `${action.entryId}:${action.effect}`, before = intervals.get(key) ?? null;
    if (!['set', 'clear'].includes(action.kind) || !['sticky', 'cooldown'].includes(action.effect)
        || !same(before, action.before) || action.kind === 'clear' && action.after !== null
        || action.kind === 'set' && (!action.after || action.after.entryId !== action.entryId
            || action.after.rawEntrySha256 !== action.rawEntrySha256 || action.after.entrySemanticSha256 !== action.entrySemanticSha256
            || action.after.kind !== action.effect))
        fail('INPUT_MATERIAL_TIMED_ACTION_INVALID');
    if (action.after)
        intervals.set(key, action.after);
    else
        intervals.delete(key);
    if (intervals.size > 4096)
        fail('INPUT_MATERIAL_TIMED_INTERVAL_LIMIT');
}
export function captureRoleplayTavernTimedHistoryV1(deps, chatIndex) {
    deps.assertOwnerCurrent();
    if (!Number.isSafeInteger(chatIndex) || chatIndex < 0)
        fail('INPUT_MATERIAL_TIMED_CHAT_INDEX_INVALID');
    const { history } = deps, { prefixLength, prefixSha256, coreRefs } = history.evidence, seenPlans = new Set(), seenAttempts = new Map(), intervals = new Map(), publications = [];
    let revision = 0;
    const actualIdentity = { sessionId: deps.sessionId, sourceRecordSessionId: deps.source.sourceRecordSessionId,
        importId: deps.source.original.activePointer.importId, rawSha256: deps.source.original.rawSha256,
        documentSha256: deps.source.original.documentSha256, bookPointer: deps.source.original.primary.bookPointer,
        bookSha256: deps.source.original.primary.bookSha256 };
    for (const publication of history.publications) {
        const read = readTavernTimedPublicationV1(publication, deps.sessionId), { event } = publication;
        if (!same(read.sourceIdentity, actualIdentity))
            continue;
        if (seenPlans.has(read.planKey))
            continue;
        seenPlans.add(read.planKey);
        const prior = seenAttempts.get(read.attemptKey);
        if (prior && prior !== read.planKey)
            fail('INPUT_MATERIAL_TIMED_ATTEMPT_PLAN_CONFLICT');
        seenAttempts.set(read.attemptKey, read.planKey);
        for (const action of replayTavernTimedPublicationV1(read, revision, [...intervals.values()]))
            applyTavernTimedActionV1(intervals, action);
        revision++;
        publications.push({ seq: event.seq, materialSha256: nativeInputSha256(event), snapshot: event.data.snapshot,
            plan: event.data.plan, attemptId: read.plan.attemptId, revision });
    }
    const timed = freeze({ schemaVersion: 1, encoding: 'owned-st-branch-timed-input-v1',
        branchId: deps.sessionId, revision, chatIndex, intervals: [...intervals.values()] });
    const assertCurrent = () => {
        deps.assertOwnerCurrent();
        history.assertCurrent();
    };
    assertCurrent();
    return { timed, assertCurrent, evidence: freeze({ schemaVersion: 1, encoding: 'native-material-lore-timed-read-v1',
            authority: 'consumer-data-only', policy: TAVERN_NATIVE_TIMED_PUBLICATION_POLICY_V1,
            sessionId: deps.sessionId, prefixLength, prefixSha256, sourceIdentity: actualIdentity, publications,
            coreRefs, timedSha256: recordSha256(timed) }) };
}
