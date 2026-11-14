// Generated from runtime/alpha3/src/core/roleplay-story-evidence.ts; edit the TypeScript source.
/** Selected story DATA for task-source points and this turn's resident body.
 * Native permission, branch, lease and write decisions remain with callers. */
import { createSurfaceCursor } from 'dsh-nexttavern-native-session/surface';
import { sessionHistoryCut } from './session-history.js';
import { createTaskHistoryClassification } from './tavern-task-context.js';
import { projectStoryEvent } from './roleplay-message-view.js';
import { surfaceEntries, surfaceStoryEntry, surfaceStoryTurnAllowed, eventsOf, readSessionClassification } from './roleplay-context.js';
import { createSelectedCanonicalChatCursor } from '../memory/memory-history.js';
const keyOf = (event) => {
    const turn = Number(event.data?.turn);
    return Number.isSafeInteger(turn) ? turn : `seq:${event.seq}`;
};
function add(index, key, value) {
    let group = index.get(key);
    if (!group) {
        group = new Set();
        index.set(key, group);
    }
    group.add(value);
}
function remove(index, key, value) {
    const group = index.get(key);
    if (group?.delete(value) && !group.size)
        index.delete(key);
}
class NativeStoryEvidence {
    cut;
    definitions;
    surface;
    story;
    classification;
    rows = new Map();
    assistants = new Map();
    nativeTurns = new Map();
    effectiveTurns = new Map();
    canonical = new Map();
    ended = new Set();
    completed = new Set();
    nextOrder = 0;
    latestTurn;
    constructor(session, cut, definitions) {
        this.cut = cut;
        this.definitions = [...definitions];
        this.surface = createSurfaceCursor({ read: () => this.cut, projections: this.definitions });
        this.classification = createTaskHistoryClassification(seq => seq < this.surface.length
            ? this.cut.at(seq) : undefined);
        this.story = createSelectedCanonicalChatCursor({ sessionId: session.id, read: () => this.cut, surface: this.surface,
            includeOpenUsers: false, onAcceptedEvent: (actual, transition) => {
                const event = actual;
                this.advance(event, transition);
            } });
    }
    project(row) {
        const raw = this.cut.at(row.event.seq);
        row.event = projectStoryEvent({ deriveEventMessage: () => this.surface.deriveEventMessage(raw) }, raw);
        row.entry = surfaceStoryEntry(row.event, false);
    }
    drop(seq, dirty) {
        const row = this.rows.get(seq);
        this.rows.delete(seq);
        if (row.key !== undefined) {
            remove(this.assistants, row.key, seq);
            dirty.add(row.key);
            if (!this.assistants.has(row.key))
                remove(this.nativeTurns, Number(row.event.data?.turn), row.key);
        }
        remove(this.effectiveTurns, row.effective, seq);
    }
    advance(event, transition) {
        const dirty = new Set();
        if (event.type === 'turn/start')
            this.latestTurn = event.data?.turn;
        if (event.type === 'turn/end') {
            const turn = Number(event.data?.turn);
            this.ended.add(turn);
            if (event.data?.reason?.kind === 'completed' && Number.isSafeInteger(turn))
                this.completed.add(turn);
            for (const key of this.nativeTurns.get(turn) ?? [])
                dirty.add(key);
        }
        const change = this.classification.advance(event, transition);
        if (transition?.kind === 'append' || transition?.kind === 'replace') {
            let order = this.nextOrder++;
            if (transition.kind === 'replace') {
                order = this.rows.get(transition.removed[0]).order;
                for (const seq of transition.removed)
                    this.drop(seq, dirty);
            }
            const row = { order, event, entry: undefined, key: undefined, effective: this.classification.effective(event) };
            if (event.type === 'assistant/message') {
                row.key = keyOf(event);
                add(this.assistants, row.key, event.seq);
                add(this.nativeTurns, Number(event.data?.turn), row.key);
            }
            this.rows.set(event.seq, row);
            add(this.effectiveTurns, row.effective, event.seq);
            if (event.type === 'user/message' || event.type === 'assistant/message')
                this.project(row);
            if (row.key !== undefined)
                dirty.add(row.key);
        }
        if (transition?.kind === 'project')
            for (const seq of transition.changedSeqs) {
                const row = this.rows.get(seq);
                if (row) {
                    this.project(row);
                    if (row.key !== undefined)
                        dirty.add(row.key);
                }
            }
        for (const turn of change.dirty)
            for (const seq of this.effectiveTurns.get(turn) ?? []) {
                const key = this.rows.get(seq)?.key;
                if (key !== undefined)
                    dirty.add(key);
            }
        for (const seq of change.changedSeqs) {
            const key = this.rows.get(seq)?.key;
            if (key !== undefined)
                dirty.add(key);
        }
        for (const key of dirty) {
            let winner;
            for (const seq of this.assistants.get(key) ?? []) {
                const row = this.rows.get(seq);
                if (!row.entry || this.classification.internal(row.event)
                    || !surfaceStoryTurnAllowed(row.event, this.ended, this.completed, this.classification.committed(seq)))
                    continue;
                if (!winner || row.order > winner.order)
                    winner = row;
            }
            if (winner)
                this.canonical.set(key, winner.event.seq);
            else
                this.canonical.delete(key);
        }
    }
    refresh(cut) { this.cut = cut; this.story.atCut(cut.length); }
    points(seqs) {
        const out = [];
        for (const seq of new Set(seqs)) {
            const row = this.rows.get(seq), entry = row?.entry;
            if (!row || !entry || this.classification.internal(row.event))
                continue;
            if (entry.kind === 'assistant' && this.canonical.get(row.key) !== seq)
                continue;
            out.push(entry);
        }
        return out.sort((left, right) => this.rows.get(left.seq).order - this.rows.get(right.seq).order);
    }
    forTurn(turn) {
        // The original user DTO carries no turn. Only its selected assistant can
        // satisfy residentContext's strict entry.turn === currentTurn predicate.
        const seq = this.canonical.get(turn);
        return seq === undefined ? [] : this.points([seq]);
    }
    evidence(session, seqs) {
        const entries = [];
        for (const item of this.story.currentEntries(seqs))
            entries.push({ seq: item.row.seq, text: item.row.text });
        const classification = readSessionClassification(session);
        return { entries, agentPreset: classification.lastTruthySelectedPreset ?? session.header?.agentPreset,
            subagent: classification.localSubagentDescriptor };
    }
}
/** One live Core owns these DATA readers. A replaced Native owner or actual
 * projection definition rebuilds its own baseline; a failed partial fold is
 * discarded so the next read can recover from accepted history. */
export function createRoleplayStoryEvidenceReader(options) {
    const owners = new WeakMap();
    function native(session) {
        const cut = sessionHistoryCut(session);
        if (cut.source !== 'native')
            return;
        // Native's own quiet getter remains responsible for revoked interpreters.
        void session.surface?.contentGeneration;
        const definitions = options.projections();
        let state = owners.get(cut.owner);
        try {
            if (!state || state.definitions.length !== definitions.length
                || state.definitions.some((definition, index) => definition !== definitions[index])) {
                state = new NativeStoryEvidence(session, cut, definitions);
                owners.set(cut.owner, state);
            }
            state.refresh(cut);
            return state;
        }
        catch (error) {
            owners.delete(cut.owner);
            throw error;
        }
    }
    const selected = {
        currentTurn(session) {
            const state = native(session);
            return state ? state.latestTurn : eventsOf(session).findLast(event => event.type === 'turn/start')?.data?.turn;
        },
        surfaceEntriesAt(session, seqs) {
            const state = native(session);
            if (state)
                return state.points(seqs);
            const wanted = new Set(seqs);
            return surfaceEntries(session).filter(entry => wanted.has(entry.seq));
        },
        surfaceEntriesForTurn(session, turn) {
            const state = native(session);
            return state ? state.forTurn(turn) : surfaceEntries(session).filter(entry => entry.turn === turn);
        },
    };
    return { ...selected, readStoryEvidenceAt(session, seqs) {
            return native(session)?.evidence(session, seqs);
        } };
}
