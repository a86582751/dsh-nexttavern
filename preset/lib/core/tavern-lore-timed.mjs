// Generated from runtime/alpha3/src/core/tavern-lore-timed.mts; edit the TypeScript source.
/** Pure timed-state proposal owner. No table writes or Native authority here. */
import { recordSha256 } from './roleplay-data.js';
import { refuse } from './tavern-lore-match.mjs';
export function tavernLoreEntrySemanticSha256V1(semantic) {
    // Origin/head refs describe provenance, not changed runtime semantics. Timers
    // survive unrelated bookkeeping and expire on actual effective edits.
    const { content, ...fields } = semantic;
    return recordSha256({ ...fields, content: { kind: content.kind, pointer: content.pointer, contentSha256: content.contentSha256 } });
}
export class TavernLoreTimedStateV1 {
    input;
    entries;
    rows = { sticky: new Map(), cooldown: new Map() };
    active = { sticky: new Set(), cooldown: new Set() };
    actions = [];
    constructor(input, entries) {
        this.input = input;
        this.entries = entries;
        for (const row of input.intervals)
            this.rows[row.kind].set(row.entryId, row);
        // Fixed source checks sticky first: expiry starts a protected cooldown that
        // must be visible when cooldown is checked during this same evaluation.
        for (const kind of ['sticky', 'cooldown'])
            for (const row of [...this.rows[kind].values()]) {
                const item = entries.get(row.entryId);
                if (input.chatIndex <= row.start && !row.protected) {
                    this.clear(row, 'chat-not-advanced');
                    continue;
                }
                if (!item || !item.semantic.enabled || !item.eligible) {
                    this.clear(row, 'entry-unavailable');
                    continue;
                }
                if (item.entry.rawEntrySha256 !== row.rawEntrySha256
                    || tavernLoreEntrySemanticSha256V1(item.semantic) !== row.entrySemanticSha256) {
                    this.clear(row, 'entry-edited');
                    continue;
                }
                if (!item.semantic[kind]) {
                    this.clear(row, 'control-cleared');
                    continue;
                }
                if (input.chatIndex >= row.end) {
                    this.clear(row, 'expired');
                    if (kind === 'sticky' && item.semantic.cooldown)
                        this.set(item, 'cooldown', true, 'sticky-ended-cooldown-protected', true);
                    continue;
                }
                this.active[kind].add(row.entryId);
            }
    }
    clear(row, reason) {
        this.rows[row.kind].delete(row.entryId);
        this.active[row.kind].delete(row.entryId);
        this.actions.push({ kind: 'clear', entryId: row.entryId, rawEntrySha256: row.rawEntrySha256,
            entrySemanticSha256: row.entrySemanticSha256, effect: row.kind, before: row, after: null, reason });
        this.limit();
    }
    set(item, kind, protectedEffect, reason, replace = false) {
        const duration = item.semantic[kind];
        if (!duration || !replace && this.rows[kind].has(item.entry.entryId))
            return;
        if (!Number.isSafeInteger(duration) || duration < 0 || !Number.isSafeInteger(this.input.chatIndex + duration)) {
            refuse('LORE_TIMED_RANGE_LIMIT', item.entry.entryId);
        }
        const before = this.rows[kind].get(item.entry.entryId) ?? null;
        const after = { entryId: item.entry.entryId, rawEntrySha256: item.entry.rawEntrySha256,
            entrySemanticSha256: tavernLoreEntrySemanticSha256V1(item.semantic), kind, start: this.input.chatIndex,
            end: this.input.chatIndex + duration, protected: protectedEffect };
        this.rows[kind].set(item.entry.entryId, after);
        if (protectedEffect)
            this.active[kind].add(item.entry.entryId);
        this.actions.push({ kind: 'set', entryId: after.entryId, rawEntrySha256: after.rawEntrySha256,
            entrySemanticSha256: after.entrySemanticSha256, effect: kind, before, after, reason });
        this.limit();
    }
    limit() { if (this.actions.length > 8192)
        refuse('LORE_TIMED_PROPOSAL_LIMIT'); }
    sticky(entryId) { return this.active.sticky.has(entryId); }
    cooldown(entryId) { return this.active.cooldown.has(entryId); }
    delay(item) {
        return (item.semantic.delay ?? 0) > this.input.chatIndex;
    }
    activated(entryIds) {
        for (const id of entryIds) {
            const item = this.entries.get(id);
            if (!item)
                refuse('LORE_TIMED_ENTRY_UNKNOWN', id);
            this.set(item, 'sticky', false, 'activation');
            this.set(item, 'cooldown', false, 'activation');
        }
    }
}
