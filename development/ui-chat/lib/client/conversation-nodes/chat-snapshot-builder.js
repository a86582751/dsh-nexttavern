// Generated from runtime/alpha3/compat/ui-chat/src/client/conversation-nodes/chat-snapshot-builder.ts; edit the TypeScript source.
import { notifySubscribers } from '@deepseek-ai/dsh-client-store';
import { isRunningTool } from "../contract/chat-nodes.js";
import { isVisibleChatNode } from "../contract/chat-visibility.js";
import { TURN_PROCESS_INDEPENDENT_KINDS } from "../contract/turn-process.js";
import { sessionRecallLabels, skillInvocationName } from "./event-projection.js";
import { sameTurnNavigationItem, turnNavigationItem } from "./turn-navigation.js";
import { ChatTurnProcessProjector } from "./turn-process-presentation.js";
import { ChatMessageEditProjector } from "./message-edits.js";
const EMPTY_KEYS = [];
const EMPTY_TURNS = [];
const EMPTY_ITEMS = [];
const EMPTY_LIST = [];
function sameReferences(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
function cachedSource(sources, key, create) {
    let source = sources.get(key);
    if (source === undefined) {
        source = create();
        sources.set(key, source);
    }
    return source;
}
/* jscpd:ignore-start -- Chat Node sources keep publication state inside the keyed Chat store. */
class MutableChatSource {
    read;
    label;
    listeners = new Set();
    published;
    constructor(read, label) {
        this.read = read;
        this.label = label;
        this.published = read();
    }
    getSnapshot = () => this.read();
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    publish() {
        const next = this.getSnapshot();
        if (this.published === next)
            return;
        this.published = next;
        notifySubscribers(this.listeners, this.label);
    }
}
/* jscpd:ignore-end */
/** Membership is indexed on write; ordered arrays are materialized only for observed collections. */
class TurnKindNodes {
    nodes = new Map();
    current = EMPTY_LIST;
    dirty = false;
    observable;
    source() {
        return this.observable ??= new MutableChatSource(() => this.read(), '[ui-chat] turn kind nodes');
    }
    set(node) {
        const previous = this.nodes.get(node.key);
        this.nodes.set(node.key, node);
        if (previous !== undefined && previous.data === node.data && previous.anchorSeq === node.anchorSeq)
            return;
        this.dirty = true;
    }
    delete(key) {
        this.nodes.delete(key);
        this.dirty = true;
    }
    publish() {
        this.observable?.publish();
    }
    read() {
        if (this.dirty) {
            this.current = [...this.nodes.values()].sort((a, b) => a.anchorSeq - b.anchorSeq).map(node => node.data);
            this.dirty = false;
        }
        return this.current;
    }
}
class MutableChatNodeStore {
    byKey = new Map();
    turnProcesses = new ChatTurnProcessProjector();
    sources = new Map();
    processSources = new Map();
    dirtyKeys = new Set();
    dirtyProcessKeys = new Set();
    turnKinds = new Map();
    dirtyTurnKinds = new Set();
    valuesCache = EMPTY_LIST;
    valuesDirty = false;
    get(key) {
        return this.byKey.get(key);
    }
    source(key) {
        return cachedSource(this.sources, key, () => new MutableChatSource(() => this.get(key), `[ui-chat] node source ${key}`));
    }
    turnDataSource(turn, kind) {
        return this.turnKind(turn, kind).source();
    }
    turnKind(turn, kind) {
        const kinds = cachedSource(this.turnKinds, turn, () => new Map());
        return cachedSource(kinds, kind, () => new TurnKindNodes());
    }
    updateTurnKind(previous, next) {
        const before = previous === undefined ? undefined : locationCoordinates(previous.location).turn;
        const after = next === undefined ? undefined : locationCoordinates(next.location).turn;
        if (previous !== undefined && before !== undefined && (before !== after || previous.kind !== next?.kind)) {
            const collection = this.turnKind(before, previous.kind);
            collection.delete(previous.key);
            this.dirtyTurnKinds.add(collection);
        }
        if (next !== undefined && after !== undefined) {
            const collection = this.turnKind(after, next.kind);
            collection.set(next);
            this.dirtyTurnKinds.add(collection);
        }
    }
    processSource(key) {
        return cachedSource(this.processSources, key, () => new MutableChatSource(() => this.process(key), `[ui-chat] node process source ${key}`));
    }
    process(key) {
        return this.turnProcesses.get(this.get(key));
    }
    values() {
        if (this.valuesDirty) {
            this.valuesCache = [...this.byKey.values()];
            this.valuesDirty = false;
        }
        return this.valuesCache;
    }
    replace(nodes) {
        const previous = new Map(this.byKey);
        this.byKey.clear();
        for (const node of nodes) {
            this.byKey.set(node.key, node);
            if (previous.get(node.key) !== node) {
                this.updateTurnKind(previous.get(node.key), node);
                this.dirtyKeys.add(node.key);
                this.dirtyProcessKeys.add(node.key);
            }
            previous.delete(node.key);
        }
        for (const key of previous.keys()) {
            this.updateTurnKind(previous.get(key), undefined);
            this.dirtyKeys.add(key);
            this.dirtyProcessKeys.add(key);
        }
        this.valuesCache = [...this.byKey.values()];
        this.valuesDirty = false;
    }
    upsert(nodes) {
        let changed = false;
        for (const node of nodes) {
            if (this.byKey.get(node.key) === node)
                continue;
            this.updateTurnKind(this.byKey.get(node.key), node);
            this.byKey.set(node.key, node);
            this.dirtyKeys.add(node.key);
            this.dirtyProcessKeys.add(node.key);
            changed = true;
        }
        if (changed)
            this.valuesDirty = true;
    }
    touchProcesses(turns, locations) {
        for (const turn of turns) {
            for (const key of locations.getTurn(turn))
                this.dirtyProcessKeys.add(key);
        }
    }
    replaceProcesses(order, locations) {
        this.touchProcesses(this.turnProcesses.replace(order, locations, this), locations);
    }
    updateProcesses(turns, locations) {
        this.touchProcesses(this.turnProcesses.update(turns, locations, this), locations);
    }
    publish() {
        const dirty = [...this.dirtyKeys];
        const dirtyProcesses = [...this.dirtyProcessKeys];
        const dirtyTurnKinds = [...this.dirtyTurnKinds];
        this.dirtyKeys.clear();
        this.dirtyProcessKeys.clear();
        this.dirtyTurnKinds.clear();
        for (const key of dirty)
            this.sources.get(key)?.publish();
        for (const key of dirtyProcesses)
            this.processSources.get(key)?.publish();
        for (const collection of dirtyTurnKinds)
            collection.publish();
    }
}
class MutableChatLocationIndex {
    turns = new Map();
    steps = new Map();
    positions = new Map();
    getTurn(turn) {
        return this.turns.get(turn) ?? EMPTY_KEYS;
    }
    getStep(turn, step) {
        return this.steps.get(stepKey(turn, step)) ?? EMPTY_KEYS;
    }
    getPosition(key) {
        return this.positions.get(key);
    }
    rebuild(order, store) {
        const turns = new Map();
        const steps = new Map();
        const positions = new Map();
        const changedTurns = new Set();
        for (const [index, key] of order.entries()) {
            const location = store.get(key)?.location;
            if (location === undefined)
                continue;
            const coordinates = locationCoordinates(location);
            const previous = this.positions.get(key);
            const position = {
                turn: coordinates.turn,
                previous: order[index - 1],
                next: order[index + 1],
            };
            const unchanged = previous !== undefined && previous.turn === position.turn
                && previous.previous === position.previous && previous.next === position.next;
            positions.set(key, unchanged ? previous : position);
            if (!unchanged) {
                if (previous?.turn !== undefined)
                    changedTurns.add(previous.turn);
                if (position.turn !== undefined)
                    changedTurns.add(position.turn);
            }
            if (coordinates.turn === undefined)
                continue;
            const turnKeys = turns.get(coordinates.turn) ?? [];
            turnKeys.push(key);
            turns.set(coordinates.turn, turnKeys);
            if (coordinates.step === undefined)
                continue;
            const step = stepKey(coordinates.turn, coordinates.step);
            const stepKeys = steps.get(step) ?? [];
            stepKeys.push(key);
            steps.set(step, stepKeys);
        }
        for (const [key, position] of this.positions) {
            if (!positions.has(key) && position.turn !== undefined)
                changedTurns.add(position.turn);
        }
        this.positions = positions;
        this.turns = updateIndex(this.turns, turns);
        this.steps = updateIndex(this.steps, steps);
        return [...changedTurns];
    }
    /** Invalidate aggregate readers when member data changes without moving. */
    touch(nodes) {
        const turns = new Set();
        const steps = new Set();
        for (const node of nodes) {
            const coordinates = locationCoordinates(node.location);
            if (coordinates.turn === undefined || !this.turns.get(coordinates.turn)?.includes(node.key))
                continue;
            turns.add(coordinates.turn);
            if (coordinates.step !== undefined)
                steps.add(stepKey(coordinates.turn, coordinates.step));
        }
        for (const turn of turns) {
            const keys = this.turns.get(turn);
            if (keys === undefined)
                continue;
            this.turns.set(turn, [...keys]);
        }
        for (const step of steps) {
            const keys = this.steps.get(step);
            if (keys === undefined)
                continue;
            this.steps.set(step, [...keys]);
        }
    }
}
function updateIndex(previous, nextMutable) {
    const next = new Map();
    const keys = new Set([...previous.keys(), ...nextMutable.keys()]);
    for (const key of keys) {
        const before = previous.get(key) ?? EMPTY_KEYS;
        const candidate = nextMutable.get(key) ?? EMPTY_KEYS;
        const value = sameReferences(before, candidate) ? before : candidate;
        if (candidate.length > 0)
            next.set(key, value);
    }
    return next;
}
/**
 * Loaded-Turn rail projection accumulated alongside the node store: a
 * structural change re-derives the Turn set, a content-only upsert re-derives
 * only the Turns whose nodes moved, and the published array keeps its identity
 * until an item actually changes. Renderers therefore consume final Turn data
 * instead of scanning the loaded window per frame.
 */
class MutableTurnNavigationIndex {
    current = EMPTY_ITEMS;
    byTurn = new Map();
    items() {
        return this.current;
    }
    /** Re-derive the whole Turn set; runs only when the loaded structure moves. */
    rebuild(timeline, locations, nodes) {
        const next = [];
        const byTurn = new Map();
        for (const turn of timeline.turnOrder) {
            const derived = turnNavigationItem(turn, locations, nodes);
            if (derived === undefined)
                continue;
            const previous = this.byTurn.get(turn);
            const item = previous !== undefined && sameTurnNavigationItem(previous, derived) ? previous : derived;
            next.push(item);
            byTurn.set(turn, item);
        }
        this.byTurn = byTurn;
        const unchanged = next.length === this.current.length
            && next.every((item, index) => item === this.current[index]);
        if (!unchanged)
            this.current = next;
    }
    /** Re-derive only the Turns a content-only upsert touched. */
    touch(turns, locations, nodes) {
        if (turns.size === 0)
            return;
        const next = this.current.map((item) => {
            if (!turns.has(item.turn))
                return item;
            const derived = turnNavigationItem(item.turn, locations, nodes);
            if (derived === undefined || sameTurnNavigationItem(item, derived))
                return item;
            this.byTurn.set(item.turn, derived);
            return derived;
        });
        if (next.some((item, index) => item !== this.current[index]))
            this.current = next;
    }
}
function stepKey(turn, step) {
    return `${turn}:${step}`;
}
function locationCoordinates(location) {
    if (location.kind === 'step')
        return { turn: location.turn.turn, step: location.step.step };
    if (location.kind === 'turn')
        return { turn: location.turn.turn };
    return {};
}
function locationTurnStatus(location) {
    return location.kind === 'turn' || location.kind === 'step' ? location.turn.status : undefined;
}
function processPresentationInputChanged(previous, next, structural) {
    if (structural || previous === undefined)
        return true;
    if (locationTurnStatus(previous.location) !== locationTurnStatus(next.location))
        return true;
    if (previous.kind === 'turn-process' && next.kind === 'turn-process') {
        return previous.data !== next.data;
    }
    return previous.kind === 'assistant-step'
        && next.kind === 'assistant-step'
        && previous.data.step !== next.data.step;
}
function turnProcessPresentations(nodes) {
    const presentations = new Map();
    for (const raw of nodes) {
        const node = raw;
        if (node.kind === 'turn-process') {
            presentations.set(node.data.turn, { ...presentations.get(node.data.turn), control: node });
        }
    }
    for (const raw of nodes) {
        const node = raw;
        const location = node.location;
        if (location.kind !== 'turn' && location.kind !== 'step')
            continue;
        const current = presentations.get(location.turn.turn) ?? {};
        const controlAnchor = current.control?.data.controlAnchorSeq;
        if ((node.kind === 'user' || node.kind === 'turn-trigger' || node.kind === 'steering')
            && controlAnchor !== undefined
            && (controlAnchor === location.turn.start?.seq || node.anchorSeq < controlAnchor)) {
            presentations.set(location.turn.turn, {
                ...current,
                openingInputAnchor: Math.max(current.openingInputAnchor ?? node.anchorSeq, node.anchorSeq),
            });
            continue;
        }
        if (TURN_PROCESS_INDEPENDENT_KINDS.has(node.kind))
            continue;
        presentations.set(location.turn.turn, {
            ...current,
            earliestProcessAnchor: Math.min(current.earliestProcessAnchor ?? node.anchorSeq, node.anchorSeq),
        });
    }
    return presentations;
}
function presentationPosition(raw, presentations) {
    const node = raw;
    const location = node.location;
    if (location.kind !== 'turn' && location.kind !== 'step') {
        return { anchor: node.anchorSeq, rank: 0, originalAnchor: node.anchorSeq };
    }
    const presentation = presentations.get(location.turn.turn);
    if (presentation === undefined) {
        return { anchor: node.anchorSeq, rank: 0, originalAnchor: node.anchorSeq };
    }
    const openingInputAnchor = presentation.openingInputAnchor;
    if (openingInputAnchor !== undefined
        && node.anchorSeq < openingInputAnchor
        && !TURN_PROCESS_INDEPENDENT_KINDS.has(node.kind)) {
        return { anchor: openingInputAnchor, rank: 2, originalAnchor: node.anchorSeq };
    }
    if (presentation.control !== undefined && node.key === presentation.control.key) {
        return openingInputAnchor === undefined
            ? {
                anchor: presentation.earliestProcessAnchor ?? node.anchorSeq,
                rank: -1,
                originalAnchor: node.anchorSeq,
            }
            : { anchor: openingInputAnchor, rank: 1, originalAnchor: node.anchorSeq };
    }
    return { anchor: node.anchorSeq, rank: 0, originalAnchor: node.anchorSeq };
}
/**
 * Order visible Chat Nodes without changing existing relative order as process
 * eligibility changes. Opening input precedes process candidates, while
 * each synthetic process control sits between them.
 * @param nodes - currently materialized Chat Nodes.
 * @returns visible Nodes in presentation order.
 */
export function orderedVisibleChatNodes(nodes) {
    const visible = nodes.filter(node => isVisibleChatNode(node));
    const presentations = turnProcessPresentations(visible);
    return visible.sort((left, right) => {
        const leftPosition = presentationPosition(left, presentations);
        const rightPosition = presentationPosition(right, presentations);
        return leftPosition.anchor - rightPosition.anchor
            || leftPosition.rank - rightPosition.rank
            || leftPosition.originalAnchor - rightPosition.originalAnchor
            || left.key.localeCompare(right.key);
    });
}
function referenceMessageSeq(node) {
    const candidate = node;
    return candidate.kind === 'user' || candidate.kind === 'steering'
        ? candidate.data.seq
        : undefined;
}
function followingRecall(node) {
    const candidate = node;
    if (candidate.kind !== 'context')
        return undefined;
    return {
        messageSeq: candidate.data.seq - 1,
        labels: sessionRecallLabels(candidate.data.source),
    };
}
function withReferenceLabels(node, labels) {
    const candidate = node;
    if (candidate.kind !== 'user' && candidate.kind !== 'steering')
        return node;
    const current = candidate.data.referenceLabels ?? EMPTY_KEYS;
    const hasLabels = Object.hasOwn(candidate.data, 'referenceLabels');
    if (sameReferences(current, labels) && hasLabels === (labels.length > 0))
        return node;
    const data = { ...candidate.data };
    if (labels.length === 0)
        delete data.referenceLabels;
    else
        data.referenceLabels = labels;
    return { ...candidate, data };
}
/** Associates a direct message with the sourced recall event that immediately follows it. */
class ReferenceLabelProjector {
    messagesBySeq = new Map();
    labelsByMessageSeq = new Map();
    replace(nodes) {
        this.messagesBySeq.clear();
        this.labelsByMessageSeq.clear();
        for (const node of nodes) {
            const messageSeq = referenceMessageSeq(node);
            if (messageSeq !== undefined)
                this.messagesBySeq.set(messageSeq, node.key);
            const recall = followingRecall(node);
            if (recall !== undefined && recall.labels.length > 0) {
                this.labelsByMessageSeq.set(recall.messageSeq, recall.labels);
            }
        }
        return nodes.map((node) => {
            const messageSeq = referenceMessageSeq(node);
            return messageSeq === undefined
                ? node
                : withReferenceLabels(node, this.labelsByMessageSeq.get(messageSeq) ?? EMPTY_KEYS);
        });
    }
    apply(upserts, store) {
        const byKey = new Map(upserts.map(node => [node.key, node]));
        const affected = new Set();
        for (const node of upserts) {
            const messageSeq = referenceMessageSeq(node);
            if (messageSeq !== undefined) {
                this.messagesBySeq.set(messageSeq, node.key);
                affected.add(messageSeq);
            }
            const recall = followingRecall(node);
            if (recall === undefined)
                continue;
            const current = this.labelsByMessageSeq.get(recall.messageSeq);
            if (recall.labels.length === 0)
                this.labelsByMessageSeq.delete(recall.messageSeq);
            else {
                this.labelsByMessageSeq.set(recall.messageSeq, current !== undefined && sameReferences(current, recall.labels) ? current : recall.labels);
            }
            affected.add(recall.messageSeq);
        }
        for (const messageSeq of affected) {
            const key = this.messagesBySeq.get(messageSeq);
            if (key === undefined)
                continue;
            const node = byKey.get(key) ?? store.get(key);
            if (node === undefined)
                continue;
            byKey.set(key, withReferenceLabels(node, this.labelsByMessageSeq.get(messageSeq) ?? EMPTY_KEYS));
        }
        return [...byKey.values()];
    }
}
function withSkillNames(node, names) {
    const candidate = node;
    if (candidate.kind !== 'user' && candidate.kind !== 'steering')
        return node;
    const current = candidate.data.skillNames ?? EMPTY_KEYS;
    const hasNames = Object.hasOwn(candidate.data, 'skillNames');
    if (sameReferences(current, names) && hasNames === (names.length > 0))
        return node;
    const data = { ...candidate.data };
    if (names.length === 0)
        delete data.skillNames;
    else
        data.skillNames = names;
    return { ...candidate, data };
}
/**
 * Classify one Node for batching: a direct message, a `skill-invocation`
 * context, or a boundary of any other kind. A context that injects no skill
 * (workspace rules, the catalog, a recall) is transparent and yields null.
 */
function slashEntryOf(node) {
    const candidate = node;
    if (candidate.kind === 'user' || candidate.kind === 'steering') {
        return { key: node.key, seq: node.anchorSeq, kind: 'message', name: null };
    }
    if (candidate.kind === 'context') {
        const name = skillInvocationName(candidate.data.source);
        return name === null ? null : { key: node.key, seq: node.anchorSeq, kind: 'skill', name };
    }
    return { key: node.key, seq: node.anchorSeq, kind: 'boundary', name: null };
}
function sameSlashEntry(left, right) {
    return left.seq === right.seq && left.kind === right.kind && left.name === right.name;
}
/**
 * Attaches each direct message's step-loaded skill names to its Node.
 *
 * A step's `skill-invocation` injections follow the direct messages the host
 * scanned for `/name` gestures and precede the step's first Node of any other
 * kind, so every non-message, non-context Node closes a batch. Every ended
 * Turn publishes its `turn-tail` Node on `turn/end` whatever the reason, so a
 * batch never spans Turns, and `step/start` precedes the direct message in
 * the log, so no boundary separates a message from its injections. Names
 * attach to every direct message of the batch: the bubble decorates only the
 * tokens its own text carries.
 *
 * The index holds only messages, skill injections, and boundaries, ordered by
 * `anchorSeq`. An apply re-reads just the batches around the Nodes whose
 * classification changed and never scans the store, so an assistant
 * streaming frame costs nothing here (the append hot path never scans the
 * Chat Nodes).
 */
export class SkillNameProjector {
    entries = new Map();
    /** Every indexed entry in `anchorSeq` order. */
    sorted = [];
    /**
     * Rebuild the index from a whole Node set and attach names to its messages.
     * @param nodes - every materialized Chat Node, in any order.
     * @returns the same Nodes, direct messages carrying their batch's names.
     */
    replace(nodes) {
        this.entries.clear();
        this.sorted = [];
        for (const node of nodes) {
            const entry = slashEntryOf(node);
            if (entry === null)
                continue;
            this.entries.set(entry.key, entry);
            this.sorted.push(entry);
        }
        this.sorted.sort((left, right) => left.seq - right.seq);
        const names = new Map();
        for (let index = 0; index < this.sorted.length; index++) {
            if (this.sorted[index]?.kind === 'boundary')
                continue;
            const end = this.runEnd(index);
            this.assignRun(index, end, names);
            index = end;
        }
        return nodes.map(node => withSkillNames(node, names.get(node.key) ?? EMPTY_KEYS));
    }
    /**
     * Fold one incremental upsert set: re-read only the batches around the
     * Nodes whose classification changed.
     * @param upserts - the changed Nodes.
     * @param store - the resident Nodes, read by key for the messages of an affected batch.
     * @returns the upserts plus any resident message whose names changed.
     */
    apply(upserts, store) {
        const dirty = [];
        for (const node of upserts) {
            const next = slashEntryOf(node);
            const previous = this.entries.get(node.key);
            if (previous !== undefined) {
                if (next !== null && sameSlashEntry(previous, next)) {
                    // A rebuilt message Node carries Definition state only, never the
                    // names a previous apply attached: re-read its batch.
                    if (next.kind === 'message')
                        dirty.push(next.seq);
                    continue;
                }
                this.remove(previous);
                dirty.push(previous.seq);
            }
            if (next === null)
                continue;
            this.insert(next);
            dirty.push(next.seq);
        }
        if (dirty.length === 0)
            return upserts;
        const names = new Map();
        for (const seq of dirty)
            this.collectAround(seq, names);
        const byKey = new Map(upserts.map(node => [node.key, node]));
        for (const [key, list] of names) {
            const node = byKey.get(key) ?? store.get(key);
            if (node === undefined)
                continue;
            const next = withSkillNames(node, list);
            if (next !== node || byKey.has(key))
                byKey.set(key, next);
        }
        return [...byKey.values()];
    }
    insert(entry) {
        this.sorted.splice(this.lowerBound(entry.seq), 0, entry);
        this.entries.set(entry.key, entry);
    }
    remove(entry) {
        this.sorted.splice(this.sorted.indexOf(entry), 1);
        this.entries.delete(entry.key);
    }
    /** First index whose seq is at least `seq`. */
    lowerBound(seq) {
        let low = 0;
        let high = this.sorted.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if ((this.sorted[middle]?.seq ?? Number.POSITIVE_INFINITY) < seq)
                low = middle + 1;
            else
                high = middle;
        }
        return low;
    }
    /** Last index of the boundary-free run containing `index`. */
    runEnd(index) {
        let end = index;
        while (end + 1 < this.sorted.length && this.sorted[end + 1]?.kind !== 'boundary')
            end++;
        return end;
    }
    /** First index of the boundary-free run containing `index`. */
    runStart(index) {
        let start = index;
        while (start - 1 >= 0 && this.sorted[start - 1]?.kind !== 'boundary')
            start--;
        return start;
    }
    /** Record the names every message of the run `[start, end]` carries. */
    assignRun(start, end, names) {
        const list = [];
        for (let index = start; index <= end; index++) {
            const entry = this.sorted[index];
            if (entry?.kind === 'skill' && entry.name !== null && !list.includes(entry.name))
                list.push(entry.name);
        }
        for (let index = start; index <= end; index++) {
            const entry = this.sorted[index];
            if (entry?.kind === 'message')
                names.set(entry.key, list);
        }
    }
    /**
     * Re-read the run(s) around one changed seq: the run holding a message or
     * skill entry, or — for a boundary, or a seq that left the index — the runs
     * on both sides of that position.
     */
    collectAround(seq, names) {
        const at = this.lowerBound(seq);
        const here = this.sorted[at];
        if (here !== undefined && here.seq === seq && here.kind !== 'boundary') {
            this.assignRun(this.runStart(at), this.runEnd(at), names);
            return;
        }
        if (at - 1 >= 0 && this.sorted[at - 1]?.kind !== 'boundary') {
            this.assignRun(this.runStart(at - 1), at - 1, names);
        }
        const right = here !== undefined && here.seq === seq ? at + 1 : at;
        if (right < this.sorted.length && this.sorted[right]?.kind !== 'boundary') {
            this.assignRun(right, this.runEnd(right), names);
        }
    }
}
const EMPTY_CONTRIBUTION = {
    anchorSeq: 0,
    nodes: EMPTY_LIST,
    partial: null,
    running: null,
};
function legacyContribution(raw) {
    const node = raw;
    // Content-free settled Assistants remain in the finalized compatibility
    // stream so StatsPills preserves its pre-assembly step counts; hidden running
    // attempts have no final Node to contribute.
    if (raw.visibility !== 'visible' && node.kind !== 'assistant-step')
        return EMPTY_CONTRIBUTION;
    switch (node.kind) {
        case 'user':
        case 'steering':
        case 'context':
        case 'command':
        case 'compaction':
        case 'turn-error':
        case 'turn-max-tokens':
        case 'unknown':
            return { anchorSeq: node.anchorSeq, nodes: [node.data], partial: null, running: null };
        case 'assistant-step': {
            const data = node.data;
            if (data.status === 'running') {
                if (raw.visibility !== 'visible')
                    return EMPTY_CONTRIBUTION;
                return {
                    anchorSeq: node.anchorSeq,
                    nodes: EMPTY_LIST,
                    partial: { turn: data.turn, step: data.step, blocks: data.blocks },
                    running: null,
                };
            }
            return {
                anchorSeq: node.anchorSeq,
                nodes: data.finalNode === undefined ? EMPTY_LIST : [data.finalNode],
                partial: null,
                running: null,
            };
        }
        case 'tool-call': {
            const root = node.data.root;
            return isRunningTool(root)
                ? { anchorSeq: node.anchorSeq, nodes: EMPTY_LIST, partial: null, running: root }
                : { anchorSeq: node.anchorSeq, nodes: [root], partial: null, running: null };
        }
        case 'manual-compaction': {
            const data = node.data;
            return {
                anchorSeq: node.anchorSeq,
                nodes: data.compaction === null ? [data.command] : [data.command, data.compaction],
                partial: null,
                running: null,
            };
        }
        case 'model-retry':
            return {
                anchorSeq: node.anchorSeq,
                nodes: node.data.attempts,
                partial: null,
                running: null,
            };
        case 'turn-tail':
        case 'system-prompt':
            // These known Chat rows intentionally make no legacy timeline contribution.
            return EMPTY_CONTRIBUTION;
        default:
            return EMPTY_CONTRIBUTION;
    }
}
function sameContribution(left, right) {
    return left !== undefined
        && left.anchorSeq === right.anchorSeq
        && left.partial?.blocks === right.partial?.blocks
        && left.partial?.turn === right.partial?.turn
        && left.partial?.step === right.partial?.step
        && left.running === right.running
        && sameReferences(left.nodes, right.nodes);
}
/** Incremental compatibility projection for StatsPills and legacy top-level snapshot fields. */
class LegacySliceBuilder {
    contributions = new Map();
    finalizedContributions = new Map();
    runningContributions = new Map();
    partialContributions = new Map();
    finalized = EMPTY_LIST;
    runningCalls = EMPTY_LIST;
    partial = null;
    timeline;
    turnTimings = new Map();
    turnEnds = new Map();
    replace(nodes, timeline) {
        this.contributions.clear();
        this.finalizedContributions.clear();
        this.runningContributions.clear();
        this.partialContributions.clear();
        for (const node of nodes) {
            const contribution = legacyContribution(node);
            this.contributions.set(node.key, contribution);
            this.indexContribution(node.key, contribution);
        }
        this.rebuildFinalized();
        this.rebuildRunning();
        this.rebuildPartial();
        this.updateTimeline(timeline);
        return this.snapshot();
    }
    apply(upserts, timeline) {
        let finalizedChanged = false;
        let runningChanged = false;
        let partialChanged = false;
        for (const node of upserts) {
            const contribution = legacyContribution(node);
            const previous = this.contributions.get(node.key);
            if (sameContribution(previous, contribution))
                continue;
            finalizedChanged ||= finalizedContributionChanged(previous, contribution);
            runningChanged ||= runningContributionChanged(previous, contribution);
            partialChanged ||= partialContributionChanged(previous, contribution);
            this.contributions.set(node.key, contribution);
            this.indexContribution(node.key, contribution);
        }
        if (finalizedChanged)
            this.rebuildFinalized();
        if (runningChanged)
            this.rebuildRunning();
        if (partialChanged)
            this.rebuildPartial();
        this.updateTimeline(timeline);
        return this.snapshot();
    }
    indexContribution(key, contribution) {
        updateContributionIndex(this.finalizedContributions, key, contribution, contribution.nodes.length > 0);
        updateContributionIndex(this.runningContributions, key, contribution, contribution.running !== null);
        updateContributionIndex(this.partialContributions, key, contribution, contribution.partial !== null);
    }
    rebuildFinalized() {
        const finalized = [...this.finalizedContributions.values()]
            .flatMap(value => value.nodes)
            .sort((left, right) => left.seq - right.seq);
        if (!sameReferences(this.finalized, finalized))
            this.finalized = finalized;
    }
    rebuildRunning() {
        const runningCalls = [...this.runningContributions.values()]
            .sort((left, right) => left.anchorSeq - right.anchorSeq)
            .flatMap(value => value.running === null ? [] : [value.running]);
        if (!sameReferences(this.runningCalls, runningCalls))
            this.runningCalls = runningCalls;
    }
    rebuildPartial() {
        const partial = [...this.partialContributions.values()]
            .sort((left, right) => left.anchorSeq - right.anchorSeq)
            .findLast(value => value.partial !== null)?.partial ?? null;
        if (this.partial?.blocks !== partial?.blocks
            || this.partial?.turn !== partial?.turn
            || this.partial?.step !== partial?.step)
            this.partial = partial;
    }
    updateTimeline(timeline) {
        if (this.timeline === timeline)
            return;
        this.timeline = timeline;
        const turnTimings = new Map();
        const turnEnds = new Map();
        for (const turn of timeline.turns.values()) {
            if (turn.start !== undefined) {
                turnTimings.set(turn.turn, {
                    startTime: turn.start.time,
                    ...turn.end === undefined ? {} : { endTime: turn.end.time },
                });
            }
            if (turn.end !== undefined)
                turnEnds.set(turn.turn, turn.end.seq);
        }
        this.turnTimings = turnTimings;
        this.turnEnds = turnEnds;
    }
    snapshot() {
        return {
            nodes: this.finalized,
            turnTimings: this.turnTimings,
            turnEnds: this.turnEnds,
            partial: this.partial,
            runningCalls: this.runningCalls,
        };
    }
}
function updateContributionIndex(index, key, contribution, present) {
    if (present)
        index.set(key, contribution);
    else
        index.delete(key);
}
function finalizedContributionChanged(previous, next) {
    const previousNodes = previous?.nodes ?? EMPTY_LIST;
    return !sameReferences(previousNodes, next.nodes)
        || ((previousNodes.length > 0 || next.nodes.length > 0) && previous?.anchorSeq !== next.anchorSeq);
}
function runningContributionChanged(previous, next) {
    return previous?.running !== next.running
        || ((previous.running !== null || next.running !== null)
            && previous.anchorSeq !== next.anchorSeq);
}
function partialContributionChanged(previous, next) {
    return previous?.partial?.blocks !== next.partial?.blocks
        || previous?.partial?.turn !== next.partial?.turn
        || previous?.partial?.step !== next.partial?.step
        || (((previous?.partial ?? null) !== null || next.partial !== null)
            && previous?.anchorSeq !== next.anchorSeq);
}
/** Incremental keyed Chat builder registered under the `chat` target. */
export class ChatSnapshotBuilder {
    messageEdits = new ChatMessageEditProjector();
    store = new MutableChatNodeStore();
    locations = new MutableChatLocationIndex();
    navigation = new MutableTurnNavigationIndex();
    legacy = new LegacySliceBuilder();
    referenceLabels = new ReferenceLabelProjector();
    skillNames = new SkillNameProjector();
    order = EMPTY_KEYS;
    latestGroupInput;
    readGroupNode = (key) => this.store.get(key);
    readGroupTurn = (turn) => this.locations.getTurn(turn);
    readGroupPosition = (key) => this.locations.getPosition(key);
    /** Last published timeline: a Turn boundary can land without a new node. */
    timeline = null;
    empty;
    constructor() {
        this.empty = this.snapshot({ turnOrder: EMPTY_TURNS, turns: new Map() });
        this.latestGroupInput = {
            kind: 'replace',
            order: this.order,
            readNode: this.readGroupNode,
            readTurn: this.readGroupTurn,
            readPosition: this.readGroupPosition,
            timeline: this.empty.timeline,
        };
    }
    replace(input) {
        const nodes = this.skillNames.replace(this.referenceLabels.replace(this.messageEdits.replace(input.nodes)));
        this.store.replace(nodes);
        this.order = orderedVisibleChatNodes(nodes).map(node => node.key);
        this.locations.rebuild(this.order, this.store);
        this.store.replaceProcesses(this.order, this.locations);
        this.navigation.rebuild(input.timeline, this.locations, this.store);
        this.timeline = input.timeline;
        this.latestGroupInput = {
            kind: 'replace',
            order: this.order,
            readNode: this.readGroupNode,
            readTurn: this.readGroupTurn,
            readPosition: this.readGroupPosition,
            timeline: input.timeline,
        };
        const snapshot = this.snapshot(input.timeline, this.legacy.replace(nodes, input.timeline));
        return snapshot;
    }
    apply(input) {
        const upserts = this.skillNames.apply(this.referenceLabels.apply(this.messageEdits.apply(input.upserts), this.store), this.store);
        const processTurns = new Set();
        let structural = false;
        const contentOnly = [];
        const changes = [];
        for (const node of upserts) {
            const previous = this.store.get(node.key);
            if (previous !== node)
                changes.push({ previous, current: node });
            const nodeStructural = previous === undefined
                || previous.kind !== node.kind
                || previous.anchorSeq !== node.anchorSeq
                || previous.visibility !== node.visibility
                || locationIdentity(previous.location) !== locationIdentity(node.location);
            structural ||= nodeStructural;
            if (!nodeStructural)
                contentOnly.push(node);
            if (processPresentationInputChanged(previous, node, nodeStructural)) {
                const previousTurn = previous === undefined ? undefined : locationCoordinates(previous.location).turn;
                const nextTurn = locationCoordinates(node.location).turn;
                if (previousTurn !== undefined)
                    processTurns.add(previousTurn);
                if (nextTurn !== undefined)
                    processTurns.add(nextTurn);
            }
        }
        this.store.upsert(upserts);
        let changedTurnOrders = EMPTY_TURNS;
        if (structural) {
            const next = orderedVisibleChatNodes(this.store.values()).map(node => node.key);
            this.order = sameReferences(this.order, next) ? this.order : next;
            changedTurnOrders = this.locations.rebuild(this.order, this.store);
        }
        this.locations.touch(contentOnly);
        this.store.updateProcesses(processTurns, this.locations);
        if (structural || input.timeline !== this.timeline) {
            this.navigation.rebuild(input.timeline, this.locations, this.store);
        }
        else {
            this.navigation.touch(turnsOf(contentOnly), this.locations, this.store);
        }
        this.timeline = input.timeline;
        this.latestGroupInput = {
            kind: 'apply',
            changes,
            order: this.order,
            readNode: this.readGroupNode,
            readTurn: this.readGroupTurn,
            readPosition: this.readGroupPosition,
            timeline: input.timeline,
            changedTurns: input.changedTurns ?? EMPTY_TURNS,
            changedTurnOrders,
        };
        const snapshot = this.snapshot(input.timeline, this.legacy.apply(upserts, input.timeline));
        return snapshot;
    }
    groupInput() {
        return this.latestGroupInput;
    }
    publish() {
        this.store.publish();
    }
    snapshot(timeline, legacy = this.legacy.replace(EMPTY_LIST, timeline)) {
        return {
            order: this.order,
            nodes: this.store,
            locations: this.locations,
            navigation: this.navigation,
            timeline,
            legacy,
        };
    }
}
/** Turns owning the given nodes, for the content-only navigation update. */
function turnsOf(nodes) {
    const turns = new Set();
    for (const node of nodes) {
        const turn = locationCoordinates(node.location).turn;
        if (turn !== undefined)
            turns.add(turn);
    }
    return turns;
}
function locationIdentity(location) {
    const coordinates = locationCoordinates(location);
    return `${location.kind}:${coordinates.turn ?? ''}:${coordinates.step ?? ''}`;
}
/** Chat target factory contributed to the Conversation view registry. */
export const chatViewDefinition = {
    target: 'chat',
    create: () => new ChatSnapshotBuilder(),
    isActive: snapshot => snapshot.order.some(key => snapshot.nodes.get(key)?.kind !== 'command'),
};
/**
 * Register the incremental Chat target builder.
 * @param ctx - owning UI Conversation context.
 */
export function registerChatConversationView(ctx) {
    ctx.uiConversation.views.register(chatViewDefinition);
}
