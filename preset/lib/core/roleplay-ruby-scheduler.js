// Generated from runtime/alpha3/src/core/roleplay-ruby-scheduler.ts; edit the TypeScript source.
/** Core passes the current canonical assistant count, including its opening.
 * Initial attachment adopts that count; it never backfills older triggers. */
export function initializeRubyCursorV1(currentAiReplies) {
    return { schemaVersion: 1, encoding: 'ruby-static-scheduling-data-v1', baseline: currentAiReplies, triggers: [], bookmarks: {} };
}
export function rubyPositionV1(aiReplies, cycleLength) {
    return cycleLength > 0 && aiReplies > 0 ? ((aiReplies - 1) % cycleLength) + 1 : 0;
}
export function scheduleRubyTasksV1(configuration, cursor, currentAiReplies) {
    if (configuration.status !== 'supported-static')
        return { schemaVersion: 1, encoding: 'ruby-static-schedule-data-v1',
            kind: configuration.status === 'empty' ? 'empty' : 'unsupported', cursor, due: [], issues: configuration.issues };
    const triggers = [...cursor.triggers], seen = new Set(triggers.map(trigger => `${trigger.cycleRound}:${trigger.position}:${trigger.taskKey}`)), due = [];
    for (let ordinal = cursor.baseline + 1; ordinal <= currentAiReplies; ordinal++) {
        const position = rubyPositionV1(ordinal, configuration.cycleLength), cycleRound = Math.ceil(ordinal / configuration.cycleLength);
        for (const task of configuration.tasks) {
            if (!task.enabled || !task.cyclePositions.includes(position))
                continue;
            const key = `${cycleRound}:${position}:${task.taskKey}`;
            if (seen.has(key))
                continue;
            const trigger = { taskKey: task.taskKey, cycleRound, position, sourceOrdinal: ordinal };
            seen.add(key);
            triggers.push(trigger);
            due.push({ task, trigger });
        }
    }
    return { schemaVersion: 1, encoding: 'ruby-static-schedule-data-v1', kind: 'scheduled',
        cursor: { ...cursor, baseline: Math.max(cursor.baseline, currentAiReplies), triggers }, due, issues: [] };
}
/** A keyword miss keeps the schedule's trigger but never calls this fold.
 * The publishing Core owner calls it only after its durable output succeeds. */
export function advanceRubyBookmarkAfterPublicationV1(cursor, publication) {
    return { ...cursor, bookmarks: { ...cursor.bookmarks, [publication.taskKey]: publication.ordinal } };
}
/** Actual deletion ordinals come from Core's before/after selected slots.
 * Message editing/version invalidation remains Core-owned and has no fake ordinal. */
export function reconcileRubyDeletionV1(cursor, deletedOldOrdinals, currentAiReplies, cycleLength) {
    if (!deletedOldOrdinals.length)
        return cursor;
    const firstDeleted = Math.min(...deletedOldOrdinals), fromRound = Math.ceil(firstDeleted / (cycleLength || 1));
    const bookmarks = Object.fromEntries(Object.entries(cursor.bookmarks).map(([taskKey, ordinal]) => {
        const shifted = ordinal - deletedOldOrdinals.filter(deleted => deleted <= ordinal).length;
        return [taskKey, shifted > currentAiReplies ? 0 : shifted];
    }));
    return { ...cursor, baseline: Math.min(cursor.baseline, currentAiReplies),
        triggers: cursor.triggers.filter(trigger => trigger.cycleRound < fromRound), bookmarks };
}
