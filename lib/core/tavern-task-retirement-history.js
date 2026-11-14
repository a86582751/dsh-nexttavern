// Generated from runtime/alpha3/src/core/tavern-task-retirement-history.ts; edit the TypeScript source.
/** Native retirement DATA: accepted history, actual surface order and the
 * remaining visible work. Task and source publication permissions stay with
 * their owners and are read by the retiring consumer. */
import { createSurfaceCursor } from 'dsh-nexttavern-native-session/surface';
import { sessionHistoryCut } from './session-history.js';
export function createRetirementHistory({ projections, createClassification }) {
    const owners = new WeakMap();
    return (session) => {
        if (!projections)
            return;
        const cut = sessionHistoryCut(session);
        if (cut.source !== 'native')
            return;
        let owner = owners.get(cut.owner);
        if (!owner) {
            owner = new RetirementHistory(cut, projections(), createClassification);
            owners.set(cut.owner, owner);
        }
        owner.advance(cut);
        return owner;
    };
}
export class RetirementHistory {
    cut;
    surface;
    classification;
    turns = [];
    currentTurn;
    rows = new Map();
    selectedSeqs = [];
    selectedPositions = new Map();
    selectedCounts = [0];
    management = new Set();
    categories = new Map();
    nativeFolds = new Map();
    visibleFolds = new Map();
    researchCalls = new Set();
    lastRow;
    nextOrder = 0;
    ended = new Set();
    completed = new Set();
    bodies = new Map();
    visibleResults = new Map();
    lookup;
    owner;
    internal;
    constructor(cut, projections, createClassification) {
        this.cut = cut;
        this.surface = createSurfaceCursor({ read: () => this.cut, projections });
        this.classification = createClassification(seq => seq < this.surface.length ? this.cut.at(seq) : undefined);
        this.lookup = { get: seq => this.cut.at(seq), has: seq => this.cut.at(seq) !== undefined };
        this.owner = { get: seq => this.turnAt(seq)?.turn };
        // Classification owns its mutable derived facts. Consumers ask the actual
        // current classifier rather than copying internal flags into another cache.
        this.internal = { has: seq => { const event = this.cut.at(seq); return !!event && this.classification.internal(event); } };
    }
    turnAt(seq) {
        let low = 0, high = this.turns.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (this.turns[middle].start <= seq)
                low = middle + 1;
            else
                high = middle;
        }
        const turn = this.turns[low - 1];
        return turn && (turn.end === undefined || seq <= turn.end) ? turn : undefined;
    }
    category(kind) {
        let category = this.categories.get(kind);
        if (!category)
            this.categories.set(kind, category = { visible: new Map(), additions: [], repairSeq: -1 });
        return category;
    }
    categoriesFor(event) {
        const source = event.type === 'user/message' ? event.data?.source : undefined, categories = [];
        if (source?.kind === 'roleplay-tasks') {
            if (source.form === 'phase' && ['after-story', 'prepare', 'management'].includes(source.stage ?? ''))
                categories.push('phase');
            if (source.form === 'coarse-research-evidence')
                categories.push('coarse-evidence');
            if (['maintenance-receipt', 'read-evidence-receipt'].includes(source.form ?? '')
                && (event.data.content?.length ?? 0) > 0)
                categories.push(source.form);
        }
        if (source?.form === 'adaptation-receipt')
            categories.push('adaptation-receipt');
        const calls = event.type === 'assistant/message' ? (event.data?.message?.content ?? []).filter(block => block.type === 'tool-call') : [];
        if (calls.some(block => ['rp_history', 'rp_worldbook_list', 'rp_worldbook_search'].includes(block.name ?? '')))
            categories.push('read');
        if (calls.some(block => /^rp_source_(?:read|search|notes|note|status|index)$/.test(block.name ?? '')))
            categories.push('research-read');
        if (calls.some(block => /^rp_source_/.test(block.name ?? ''))
            || event.type === 'tool/result' && this.researchCalls.has(event.data?.message?.source?.callId ?? ''))
            categories.push('research-proof');
        return categories;
    }
    drop(row, at) {
        this.rows.delete(row.seq);
        const position = this.selectedPositions.get(row.seq);
        this.selectedPositions.delete(row.seq);
        for (let index = position; index < this.selectedCounts.length; index += index & -index)
            this.selectedCounts[index] = this.selectedCounts[index] - 1;
        if (row.turn) {
            row.turn.visible.delete(row.seq);
            row.turn.imports.delete(row.seq);
            if (!row.turn.visible.size || !row.turn.export && !row.turn.imports.size)
                this.management.delete(row.turn);
        }
        for (const kind of row.categories) {
            const category = this.category(kind);
            category.visible.delete(row.seq);
            category.repairSeq = at;
        }
        const event = this.cut.at(row.seq), id = event?.type === 'tool/result' ? event.data?.message?.source?.callId : undefined;
        if (typeof id === 'string') {
            const results = this.visibleResults.get(id);
            results.delete(row.seq);
            if (!results.size)
                this.visibleResults.delete(id);
        }
    }
    select(event, transition) {
        if (transition.kind === 'project')
            return;
        let previous = this.lastRow, next, order = this.nextOrder++;
        if (transition.kind === 'replace') {
            const first = this.rows.get(transition.removed[0]), last = this.rows.get(transition.removed.at(-1));
            previous = first.previous;
            next = last.next;
            order = first.order;
            for (const seq of transition.removed)
                this.drop(this.rows.get(seq), event.seq);
        }
        const turn = this.turnAt(event.seq), categories = this.categoriesFor(event), row = { seq: event.seq, order, previous, next, turn, categories };
        this.rows.set(event.seq, row);
        const position = this.selectedSeqs.length + 1;
        this.selectedSeqs.push(event.seq);
        this.selectedPositions.set(event.seq, position);
        this.selectedCounts.push(1 + this.selectedPrefix(position - 1) - this.selectedPrefix(position - (position & -position)));
        if (previous !== undefined)
            this.rows.get(previous).next = event.seq;
        if (next !== undefined)
            this.rows.get(next).previous = event.seq;
        else
            this.lastRow = event.seq;
        if (turn) {
            turn.visible.set(event.seq, row);
            if (event.type === 'assistant/message' && (event.data?.message?.content ?? [])
                .some(block => block.type === 'tool-call' && block.name === 'rp_card_import_begin'))
                turn.imports.add(event.seq);
            if (turn.export || turn.imports.size)
                this.management.add(turn);
        }
        for (const kind of categories) {
            const category = this.category(kind);
            category.visible.set(event.seq, order);
            category.additions.push(event.seq);
            if (transition.kind === 'replace')
                category.repairSeq = event.seq;
        }
        const id = event.type === 'tool/result' ? event.data?.message?.source?.callId : undefined;
        if (typeof id === 'string') {
            let results = this.visibleResults.get(id);
            if (!results)
                this.visibleResults.set(id, results = new Set());
            results.add(event.seq);
        }
    }
    advance(cut) {
        this.cut = cut;
        let transition;
        this.surface.advanceTo(cut.length, value => { transition = value; }, actual => {
            const event = actual, change = transition;
            transition = undefined;
            if (event.type === 'turn/start') {
                this.currentTurn = { turn: event.data?.turn, start: event.seq, end: undefined, export: false, story: false,
                    completed: false, visible: new Map(), imports: new Set() };
                this.turns.push(this.currentTurn);
            }
            const turn = this.currentTurn, source = event.type === 'user/message' ? event.data?.source : undefined;
            if (turn && source?.kind === 'roleplay-tasks') {
                if (['card-export', 'novel-export'].includes(source.jobKind ?? ''))
                    turn.export = true;
                if (source.form === 'phase' && ['story', 'after-story'].includes(source.stage ?? ''))
                    turn.story = true;
                if (source.form === 'phase' && source.stage === 'after-story' && source.turn === turn.turn
                    && Number.isSafeInteger(source.storySeq)) {
                    const body = this.cut.at(Number(source.storySeq));
                    if (body?.type === 'assistant/message' && this.turnAt(body.seq)?.turn === turn.turn && body.seq < event.seq)
                        this.bodies.set(turn.turn, body.seq);
                }
            }
            if (turn && event.type === 'tool/call'
                && /^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export)$/.test(event.data?.name ?? ''))
                turn.export = true;
            if (turn?.export && turn.visible.size)
                this.management.add(turn);
            if (event.type === 'assistant/message')
                for (const block of event.data?.message?.content ?? []) {
                    if (block.type === 'tool-call' && block.id && /^rp_source_/.test(block.name ?? ''))
                        this.researchCalls.add(block.id);
                }
            if (event.type === 'tool/call' && /^rp_source_/.test(event.data?.name ?? '')) {
                const id = event.data?.callId ?? event.data?.id;
                if (typeof id === 'string')
                    this.researchCalls.add(id);
            }
            if (turn && event.type === 'turn/end') {
                turn.end = event.seq;
                turn.completed = event.data?.reason?.kind === 'completed';
                if (turn.turn !== undefined) {
                    this.ended.add(turn.turn);
                    if (turn.completed)
                        this.completed.add(turn.turn);
                }
                this.currentTurn = undefined;
            }
            if (change)
                this.select(event, change);
            this.classification.advance(event, change);
        });
    }
    managementTurns() { return [...this.management].sort((left, right) => left.start - right.start); }
    group(seq) { return this.turnAt(seq); }
    nodes(turn) { return [...turn.visible.values()].sort((left, right) => left.order - right.order).map(row => row.seq); }
    selected(kind) {
        return [...this.category(kind).visible].sort((left, right) => left[1] - right[1]).map(([seq]) => seq);
    }
    next(seq) { return this.rows.get(seq)?.next; }
    visible(seq) { return this.rows.has(seq); }
    selectedPrefix(end) {
        let count = 0;
        for (let index = end; index > 0; index -= index & -index)
            count += this.selectedCounts[index];
        return count;
    }
    selectedBoundary(seq) {
        let low = 0, high = this.selectedSeqs.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if (this.selectedSeqs[middle] < seq)
                low = middle + 1;
            else
                high = middle;
        }
        return low;
    }
    selectedAt(rank) {
        let index = 0, step = 1;
        while (step * 2 <= this.selectedSeqs.length)
            step *= 2;
        for (; step; step >>= 1) {
            const next = index + step;
            if (next < this.selectedCounts.length && this.selectedCounts[next] < rank) {
                index = next;
                rank -= this.selectedCounts[next];
            }
        }
        return this.selectedSeqs[index];
    }
    hasRange(start, end) {
        return this.selectedPrefix(this.selectedBoundary(end + 1)) > this.selectedPrefix(this.selectedBoundary(start));
    }
    range(start, end) {
        const first = this.selectedPrefix(this.selectedBoundary(start)), last = this.selectedPrefix(this.selectedBoundary(end + 1)), rows = [];
        for (let rank = first + 1; rank <= last; rank++)
            rows.push(this.rows.get(this.selectedAt(rank)));
        return rows.sort((left, right) => left.order - right.order).map(row => row.seq);
    }
    contiguous(selected) {
        return selected.every((seq, index) => this.rows.has(seq) && (index === selected.length - 1 || this.next(seq) === selected[index + 1]));
    }
    inlineGroups(currentTurn) {
        const groups = [];
        for (const start of this.selected('phase')) {
            const owner = this.owner.get(start);
            if (owner === undefined || owner >= currentTurn || !this.ended.has(owner))
                continue;
            const selected = [start];
            let seq = this.next(start);
            while (seq !== undefined && this.owner.get(seq) === owner) {
                const event = this.cut.at(seq);
                if (event.type === 'tool/result' || event.type === 'assistant/message' && this.internal.has(seq))
                    selected.push(seq);
                else
                    break;
                seq = this.next(seq);
            }
            groups.push(selected);
        }
        return groups;
    }
    foldNative(identity, create) {
        let state = this.nativeFolds.get(identity);
        if (!state) {
            state = { through: 0, fold: create() };
            this.nativeFolds.set(identity, state);
        }
        this.cut.forEachRange(state.through, this.cut.length, event => state.fold.advance(event));
        state.through = this.cut.length;
        return state.fold.data;
    }
    foldVisible(identity, kind, create) {
        const category = this.category(kind);
        let state = this.visibleFolds.get(identity);
        if (!state || state.repairSeq !== category.repairSeq) {
            state = { category: kind, through: category.additions.length, repairSeq: category.repairSeq, fold: create() };
            for (const seq of this.selected(kind))
                state.fold.advance(this.cut.at(seq));
            this.visibleFolds.set(identity, state);
        }
        else {
            for (let index = state.through; index < category.additions.length; index++) {
                const seq = category.additions[index];
                if (this.rows.has(seq))
                    state.fold.advance(this.cut.at(seq));
            }
            state.through = category.additions.length;
        }
        return state.fold.data;
    }
}
