// Generated from runtime/alpha3/src/core/roleplay-mvu-scope-projection-v2.ts; edit the TypeScript source.
/** Incremental Schema-visible history. Canonical-chat keeps its separate legacy
 * archived-story policy; this owner never substitutes a current surface for a cut. */
import { createSurfaceCursor } from 'dsh-nexttavern-native-session/surface';
import { recordSha256, textOf } from './roleplay-data.js';
import { projectStoryEvent } from './roleplay-message-view.js';
import { createTaskHistoryClassification } from './tavern-task-context.js';
/** Task consumers intentionally read a structural JSON vocabulary: other
 * Native records (including opening records) remain opaque to these rules. */
const taskFact = (event) => event;
const size = (tree) => tree?.size ?? 0;
function node(key, item, left, right, priority = priorityFor(item.nativeSeq)) {
    return { key, item, left, right, priority, size: 1 + size(left) + size(right) };
}
function priorityFor(seq) {
    let value = seq | 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return (value ^ (value >>> 16)) >>> 0;
}
function split(tree, key) {
    if (!tree)
        return [undefined, undefined];
    if (tree.key < key) {
        const [left, right] = split(tree.right, key);
        return [node(tree.key, tree.item, tree.left, left, tree.priority), right];
    }
    const [left, right] = split(tree.left, key);
    return [left, node(tree.key, tree.item, right, tree.right, tree.priority)];
}
function merge(left, right) {
    if (!left)
        return right;
    if (!right)
        return left;
    return left.priority >= right.priority ? node(left.key, left.item, left.left, merge(left.right, right), left.priority)
        : node(right.key, right.item, merge(left, right.left), right.right, right.priority);
}
function put(tree, key, item) {
    if (!tree)
        return node(key, item);
    if (tree.key === key)
        return node(key, item, tree.left, tree.right, tree.priority);
    const priority = priorityFor(item.nativeSeq);
    if (priority > tree.priority) {
        const [left, right] = split(tree, key);
        return node(key, item, left, right, priority);
    }
    return key < tree.key ? node(tree.key, tree.item, put(tree.left, key, item), tree.right, tree.priority)
        : node(tree.key, tree.item, tree.left, put(tree.right, key, item), tree.priority);
}
function remove(tree, key) {
    if (!tree)
        return;
    if (tree.key === key)
        return merge(tree.left, tree.right);
    return key < tree.key ? node(tree.key, tree.item, remove(tree.left, key), tree.right, tree.priority)
        : node(tree.key, tree.item, tree.left, remove(tree.right, key), tree.priority);
}
function rank(tree, key) {
    let count = 0;
    while (tree) {
        if (tree.key >= key)
            tree = tree.left;
        else {
            count += size(tree.left) + 1;
            tree = tree.right;
        }
    }
    return count;
}
function messageView(root, orders) {
    const length = size(root);
    return Object.freeze({ length,
        indexOfNativeSeq(seq) {
            const order = orders.get(seq);
            if (order === undefined)
                return;
            let tree = root;
            while (tree && tree.key !== order)
                tree = tree.key > order ? tree.left : tree.right;
            return tree?.item.nativeSeq === seq ? rank(root, order) : undefined;
        },
        at(index) {
            if (!Number.isSafeInteger(index) || index < 0 || index >= length)
                return;
            let tree = root;
            while (tree) {
                const left = size(tree.left);
                if (index === left)
                    return tree.item;
                if (index < left)
                    tree = tree.left;
                else {
                    index -= left + 1;
                    tree = tree.right;
                }
            }
            return undefined;
        },
        *range(start = 0, end = length) {
            if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > length) {
                throw Error('SCHEMA_SCOPE_PROJECTION_RANGE_INVALID');
            }
            function* visit(tree, base) {
                if (!tree || base >= end || base + tree.size <= start)
                    return;
                const position = base + size(tree.left);
                yield* visit(tree.left, base);
                if (position >= start && position < end)
                    yield tree.item;
                yield* visit(tree.right, position + 1);
            }
            yield* visit(root, 0);
        },
    });
}
/** Completed-turn selection uses Native event order, while scope rows use
 * surface order. Share the task/receipt classifier and exact surface fold,
 * without substituting canonical-chat archives or a nominated message seq. */
export function createMvuCanonicalAssistantCursor(deps) {
    const surface = createSurfaceCursor(deps), eventAt = (seq) => seq < surface.length ? deps.read().at(seq) : undefined, tasks = createTaskHistoryClassification(seq => { const event = eventAt(seq); return event ? taskFact(event) : undefined; }), completed = new Set();
    const entries = new Map(), byTurn = new Map(), byTaskTurn = new Map(), canonical = new Map(), endings = new Map();
    function refresh(entry) {
        const message = surface.deriveEventMessage(entry.event);
        if (message !== entry.message) {
            entry.message = message;
            entry.narrative = textOf(message?.content);
            entry.body = undefined;
        }
    }
    function body(entry) {
        const message = entry?.message;
        if (!entry || !message || typeof message.id !== 'string')
            return;
        return entry.body ??= Object.freeze({ seq: entry.event.seq, messageId: message.id,
            versionSha256: recordSha256(message), narrative: entry.narrative });
    }
    function advance(end) {
        let transition;
        surface.advanceTo(end, value => { transition = value; }, event => {
            const actual = transition;
            transition = undefined;
            const delta = tasks.advance(taskFact(event), actual), dirty = new Set();
            function mark(seq) {
                const entry = entries.get(seq);
                if (entry)
                    dirty.add(Number(entry.event.data.turn));
            }
            function drop(seq) {
                const entry = entries.get(seq);
                if (!entry)
                    return;
                const turn = Number(entry.event.data.turn);
                entries.delete(seq);
                byTurn.get(turn)?.delete(seq);
                byTaskTurn.get(entry.effective)?.delete(seq);
                dirty.add(turn);
            }
            if (actual?.kind === 'replace')
                for (const seq of actual.removed)
                    drop(seq);
            if ((actual?.kind === 'append' || actual?.kind === 'replace') && event.type === 'assistant/message') {
                const turn = Number(event.data.turn), effective = tasks.effective(taskFact(event)), entry = { event, effective, message: null, narrative: '' };
                refresh(entry);
                entries.set(event.seq, entry);
                let peers = byTurn.get(turn);
                if (!peers) {
                    peers = new Set();
                    byTurn.set(turn, peers);
                }
                peers.add(event.seq);
                let taskPeers = byTaskTurn.get(effective);
                if (!taskPeers) {
                    taskPeers = new Set();
                    byTaskTurn.set(effective, taskPeers);
                }
                taskPeers.add(event.seq);
                dirty.add(turn);
            }
            if (actual?.kind === 'project')
                for (const seq of actual.changedSeqs) {
                    const entry = entries.get(seq);
                    if (entry) {
                        refresh(entry);
                        mark(seq);
                    }
                }
            if (event.type === 'turn/end') {
                const turn = Number(event.data.turn);
                if (event.data.reason.kind === 'completed')
                    completed.add(turn);
                dirty.add(turn);
            }
            for (const turn of delta.dirty)
                for (const seq of byTaskTurn.get(turn) ?? [])
                    mark(seq);
            for (const seq of delta.changedSeqs)
                mark(seq);
            for (const turn of dirty) {
                let selected;
                for (const seq of byTurn.get(turn) ?? []) {
                    const entry = entries.get(seq);
                    if (entry.event.data.interrupted === true || !entry.narrative.trim() || tasks.internal(taskFact(entry.event))
                        || !completed.has(turn) && !tasks.committed(seq))
                        continue;
                    if (!selected || seq > selected.event.seq)
                        selected = entry;
                }
                if (selected)
                    canonical.set(turn, selected);
                else
                    canonical.delete(turn);
            }
            if (event.type === 'turn/end') {
                const turn = Number(event.data.turn);
                endings.set(event.seq + 1, { turn, body: body(canonical.get(turn)) });
            }
        });
    }
    return {
        get length() { return surface.length; },
        /** A recorded end keeps its own projected body after later edits/windows. */
        hasEnd(turn, end) { return endings.get(end)?.turn === turn; },
        read(turn, end) {
            if (end >= surface.length)
                advance(end);
            else
                surface.advanceTo(surface.length);
            const closed = endings.get(end);
            if (closed?.turn === turn)
                return closed.body;
            if (end !== surface.length)
                throw Error('CANONICAL_ASSISTANT_CUT_UNAVAILABLE');
            return body(canonical.get(turn));
        },
    };
}
export function createMvuScopeProjectionV2(deps) {
    let states = new WeakMap(), disposed = false;
    function createState(session, cut) {
        let currentCut = cut, nextOrder = 0, root;
        const surface = createSurfaceCursor({ read: () => currentCut, projections: deps.projections });
        const readEvent = (seq) => seq < surface.length ? currentCut.at(seq) : undefined;
        const tasks = createTaskHistoryClassification(seq => { const event = readEvent(seq); return event ? taskFact(event) : undefined; }), positions = new Map(), candidates = new Map();
        const byTurn = new Map(), byTaskTurn = new Map();
        const canonical = new Map(), published = new Map();
        const ended = new Set(), completed = new Set();
        let quiet;
        function refresh(candidate) {
            const event = candidate.event;
            if (event.type === 'user/message') {
                const rendered = projectStoryEvent({ deriveEventMessage: () => surface.deriveEventMessage(event) }, event);
                candidate.text = !!textOf(rendered.data.content).trim();
                candidate.messageId = String(rendered.data.id ?? '');
                candidate.message = surface.projectedMessageAt(event.seq) ?? event.data;
            }
            else {
                const rendered = projectStoryEvent({ deriveEventMessage: () => surface.deriveEventMessage(event) }, event);
                candidate.text = !!textOf(rendered.data.message.content).trim();
                candidate.messageId = String(rendered.data.message.id ?? '');
                candidate.message = surface.projectedMessageAt(event.seq) ?? event.data.message;
            }
        }
        function metadata(candidate) {
            if (candidate.metadata && candidate.versionMessage === candidate.message)
                return candidate.metadata;
            const message = candidate.message, nativeOwnerSessionId = deps.ownerForSeq(session, candidate.event.seq);
            if (!message || message.id !== candidate.messageId || !nativeOwnerSessionId)
                throw Error('SCHEMA_SCOPE_MESSAGE_UNPROVEN');
            const version = recordSha256(message);
            candidate.versionMessage = message;
            if (candidate.metadata?.messageVersionSha256 === version && candidate.metadata.nativeOwnerSessionId === nativeOwnerSessionId) {
                return candidate.metadata;
            }
            return candidate.metadata = Object.freeze({ nativeOwnerSessionId, nativeSeq: candidate.event.seq, messageId: candidate.messageId,
                messageVersionSha256: version, selectedVariant: version, isSystem: false });
        }
        function advance(next, end, cold) {
            currentCut = next;
            if (quiet && surface.length === end) {
                surface.advanceTo(end);
                return quiet;
            }
            const changes = [];
            function output(candidate, present) {
                const seq = candidate.event.seq, old = published.get(seq);
                if (!present) {
                    if (!old)
                        return;
                    const index = rank(root, old.candidate.order);
                    root = remove(root, old.candidate.order);
                    published.delete(seq);
                    changes.push({ kind: 'message-splice', index, deleteCount: 1, messages: [] });
                    return;
                }
                const value = metadata(candidate);
                if (old && old.metadata === value)
                    return;
                const index = rank(root, candidate.order);
                root = put(root, candidate.order, value);
                published.set(seq, { candidate, metadata: value });
                changes.push({ kind: 'message-splice', index, deleteCount: old ? 1 : 0, messages: [value] });
            }
            let transition;
            surface.advanceTo(end, value => { transition = value; }, event => {
                const actual = transition;
                transition = undefined;
                const dirty = new Set(), dirtyTurns = new Set();
                const delta = tasks.advance(taskFact(event), actual);
                function mark(seq) {
                    const candidate = candidates.get(seq);
                    if (candidate?.event.type === 'assistant/message')
                        dirtyTurns.add(candidate.turn);
                    else if (candidate)
                        dirty.add(seq);
                }
                function drop(seq) {
                    const candidate = candidates.get(seq);
                    if (!candidate)
                        return;
                    output(candidate, false);
                    candidates.delete(seq);
                    byTaskTurn.get(candidate.effective)?.delete(seq);
                    if (candidate.turn !== undefined) {
                        byTurn.get(candidate.turn)?.delete(seq);
                        dirtyTurns.add(candidate.turn);
                    }
                }
                if (actual?.kind === 'replace') {
                    // Retain historical positions for views whose persistent root still
                    // contains a replaced message; current replacements reuse that order.
                    const order = positions.get(actual.removed[0]);
                    for (const seq of actual.removed)
                        drop(seq);
                    positions.set(actual.seq, order);
                }
                else if (actual?.kind === 'append') {
                    positions.set(actual.seq, nextOrder++);
                }
                if ((actual?.kind === 'append' || actual?.kind === 'replace')
                    && (event.type === 'user/message' || event.type === 'assistant/message')) {
                    const turn = event.type === 'assistant/message' ? Number(event.data.turn) : undefined;
                    const key = turn === undefined ? undefined : Number.isSafeInteger(turn) ? turn : `seq:${event.seq}`;
                    const candidate = { event, order: positions.get(event.seq), turn: key, effective: tasks.effective(taskFact(event)),
                        text: false, messageId: '', message: undefined };
                    refresh(candidate);
                    candidates.set(event.seq, candidate);
                    let peers = byTaskTurn.get(candidate.effective);
                    if (!peers) {
                        peers = new Set();
                        byTaskTurn.set(candidate.effective, peers);
                    }
                    peers.add(event.seq);
                    if (key !== undefined) {
                        let bucket = byTurn.get(key);
                        if (!bucket) {
                            bucket = new Set();
                            byTurn.set(key, bucket);
                        }
                        bucket.add(event.seq);
                    }
                    mark(event.seq);
                }
                if (actual?.kind === 'project')
                    for (const seq of actual.changedSeqs) {
                        const candidate = candidates.get(seq);
                        if (candidate) {
                            refresh(candidate);
                            mark(seq);
                        }
                    }
                if (event.type === 'turn/end') {
                    const turn = Number(event.data.turn);
                    ended.add(turn);
                    if (event.data.reason?.kind === 'completed' && Number.isSafeInteger(turn))
                        completed.add(turn);
                    dirtyTurns.add(turn);
                }
                for (const turn of delta.dirty)
                    for (const seq of byTaskTurn.get(turn) ?? [])
                        mark(seq);
                for (const seq of delta.changedSeqs)
                    mark(seq);
                for (const seq of dirty) {
                    const candidate = candidates.get(seq), source = candidate.event.type === 'user/message' ? taskFact(candidate.event).data?.source : undefined;
                    output(candidate, candidate.text && !tasks.internal(taskFact(candidate.event))
                        && (source?.kind === 'user' || source?.kind === 'roleplay' && source.form === 'branch-user'));
                }
                for (const turn of dirtyTurns) {
                    let selected;
                    for (const seq of byTurn.get(turn) ?? []) {
                        const candidate = candidates.get(seq);
                        if (candidate.event.type !== 'assistant/message' || candidate.event.data.interrupted === true
                            || !candidate.text || tasks.internal(taskFact(candidate.event)))
                            continue;
                        const number = Number(candidate.event.data.turn);
                        if (ended.has(number) && !completed.has(number) && !tasks.committed(seq))
                            continue;
                        if (!selected || candidate.order > selected.order)
                            selected = candidate;
                    }
                    const prior = canonical.get(turn);
                    if (prior !== undefined && prior !== selected?.event.seq) {
                        const old = published.get(prior);
                        if (old)
                            output(old.candidate, false);
                    }
                    if (selected) {
                        canonical.set(turn, selected.event.seq);
                        output(selected, true);
                    }
                    else
                        canonical.delete(turn);
                }
            });
            const view = messageView(root, positions);
            const result = Object.freeze({ selection: 'visible', owner: cut.owner, nativeCut: end, cold,
                messages: view, changes: Object.freeze(changes.map(change => Object.freeze({ ...change, messages: Object.freeze(change.messages) }))) });
            quiet = Object.freeze({ ...result, cold: false, changes: Object.freeze([]) });
            return result;
        }
        return { owner: cut.owner, get nativeCut() { return surface.length; }, advance };
    }
    return Object.freeze({
        read(session, logicalCut) {
            if (disposed)
                throw Error('SCHEMA_SCOPE_PROJECTION_DISPOSED');
            if (!deps.history.cut)
                throw Error('SCHEMA_SCOPE_PROJECTION_CUT_REQUIRED');
            const cut = deps.history.cut(session);
            if (!Number.isSafeInteger(logicalCut) || logicalCut < 0 || logicalCut > cut.length)
                throw Error('SCHEMA_SCOPE_PROJECTION_CUT_INVALID');
            let state = states.get(session);
            const cold = !state || state.owner !== cut.owner || logicalCut < state.nativeCut;
            if (cold) {
                state = createState(session, cut);
                states.set(session, state);
            }
            try {
                return state.advance(cut, logicalCut, cold);
            }
            catch (error) {
                // Native transitions already committed before the observer runs. A
                // failed owner/message join must rebuild, never publish a partial cut.
                states.delete(session);
                throw error;
            }
        },
        dispose() { disposed = true; states = new WeakMap(); },
    });
}
