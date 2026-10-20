// Generated from runtime/alpha3/src/core/community-preset-settlement.ts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
/** The Native material event links the frozen write set to the same turn and
 * step that produced the accepted canonical assistant. Cold reconciliation
 * reads this data; it never recreates execution hooks or recomputes macros. */
export function acceptedCommunityAttempts(events, table) {
    const completed = new Set(events.flatMap(event => event.type === 'turn/end' && event.data.reason.kind === 'completed'
        ? [event.data.turn] : []));
    const accepted = new Set(events.flatMap(event => event.type === 'assistant/message' && !event.data.interrupted
        ? [`${event.data.turn}:${event.data.step}`] : []));
    const records = new Map();
    for (const event of events) {
        if (event.type !== 'request/material' || !completed.has(event.data.turn)
            || !accepted.has(`${event.data.turn}:${event.data.step}`))
            continue;
        const stored = table.get(event.data.plan.key);
        const record = stored?.payload?.promptPlan?.community;
        if (record?.schemaVersion === 1) {
            if (recordSha256(stored) !== event.data.plan.sha256)
                throw Error('COMMUNITY_ACCEPTED_PLAN_CHANGED');
            records.set(record.attempt.attemptId, record);
        }
    }
    return [...records.values()];
}
export function createCommunityPresetSettlement(table, variables) {
    const settled = new Map();
    async function reconcile(session) {
        const events = session.snapshotEvents(), last = Number(events.at(-1)?.seq ?? 0);
        if (settled.get(session.id) === last)
            return;
        for (const record of acceptedCommunityAttempts(events, table))
            await variables.commit(record.attempt, record.writes);
        settled.set(session.id, last);
    }
    return { reconcile, attemptIds(events) {
            return acceptedCommunityAttempts(events, table).map(record => record.attempt.attemptId);
        } };
}
