// Generated from runtime/alpha3/src/core/community-preset-settlement.ts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
import { ensureSessionHistory, sessionHistoryCut } from './session-history.js';
import { withTavernLock } from './tavern-task-support.js';
const preparationId = (record) => `${record.ordinaryChat.contributionId}:${record.ordinaryChat.attemptId}`;
function orderNode(key, id, left, right, priority, pending = false) {
    let value = key | 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return { key, id, left, right, pending, pendingCount: (left?.pendingCount ?? 0) + (right?.pendingCount ?? 0) + Number(pending),
        priority: priority ?? ((value ^ (value >>> 16)) >>> 0) };
}
function split(tree, key) {
    if (!tree)
        return [undefined, undefined];
    if (tree.key < key) {
        const [left, right] = split(tree.right, key);
        return [orderNode(tree.key, tree.id, tree.left, left, tree.priority, tree.pending), right];
    }
    const [left, right] = split(tree.left, key);
    return [left, orderNode(tree.key, tree.id, right, tree.right, tree.priority, tree.pending)];
}
function merge(left, right) {
    if (!left)
        return right;
    if (!right)
        return left;
    return left.priority >= right.priority
        ? orderNode(left.key, left.id, left.left, merge(left.right, right), left.priority, left.pending)
        : orderNode(right.key, right.id, merge(left, right.left), right.right, right.priority, right.pending);
}
function insert(tree, key, id, pending = true) {
    const [left, right] = split(tree, key);
    return merge(merge(left, orderNode(key, id, undefined, undefined, undefined, pending)), right);
}
function remove(tree, key) {
    if (!tree)
        return;
    if (tree.key === key)
        return merge(tree.left, tree.right);
    return tree.key > key ? orderNode(tree.key, tree.id, remove(tree.left, key), tree.right, tree.priority, tree.pending)
        : orderNode(tree.key, tree.id, tree.left, remove(tree.right, key), tree.priority, tree.pending);
}
function pendingAt(tree, key) {
    while (tree) {
        if (tree.key === key)
            return tree.pending;
        tree = key < tree.key ? tree.left : tree.right;
    }
    return false;
}
function setPending(tree, key, pending) {
    if (!tree)
        return;
    if (tree.key === key)
        return tree.pending === pending ? tree : orderNode(tree.key, tree.id, tree.left, tree.right, tree.priority, pending);
    return key < tree.key ? orderNode(tree.key, tree.id, setPending(tree.left, key, pending), tree.right, tree.priority, tree.pending)
        : orderNode(tree.key, tree.id, tree.left, setPending(tree.right, key, pending), tree.priority, tree.pending);
}
function* ids(tree) {
    if (!tree)
        return;
    yield* ids(tree.left);
    yield tree.id;
    yield* ids(tree.right);
}
const acceptedPlanRecords = new WeakMap();
/** Native material plans are immutable owner output. Both acceptance and a
 * later original-global baseline read use this exact row/ref decoder. */
export function readAcceptedPreparationPlanRecord(stored, expected, digest = () => recordSha256(stored)) {
    const previous = stored !== null && typeof stored === 'object' ? acceptedPlanRecords.get(stored) : undefined;
    if (previous) {
        if (previous.sha256 !== expected)
            throw Error('ORDINARY_ACCEPTED_PLAN_CHANGED');
        return previous.record;
    }
    const plan = stored?.payload?.promptPlan, ordinaryChat = plan?.ordinaryChat;
    if (ordinaryChat?.schemaVersion !== 1 || ordinaryChat.encoding !== 'native-ordinary-preparation-plan-v1')
        return;
    if (digest() !== expected)
        throw Error('ORDINARY_ACCEPTED_PLAN_CHANGED');
    const record = { ordinaryChat, ...plan?.community ? { community: plan.community } : {} };
    acceptedPlanRecords.set(stored, { sha256: expected, record });
    return record;
}
/** One acceptance parser serves the ordered raw oracle and actual Native tail.
 * Completion can arrive after a later material; first insertion is therefore
 * ordered by material position, never by the time a turn becomes accepted. */
class AcceptedPreparationHistory {
    table;
    onPlan;
    onVariable;
    receiptFacts;
    completed = new Set();
    accepted = new Set();
    materials = new Map();
    plans = new Map();
    byTurn = new Map();
    byStep = new Map();
    dirty = new Set();
    decoded = new Map();
    // A later empty replacement does not prove old message recovery irrelevant.
    // Only never-seen groups can skip binding, and only with complete origin.
    everMessageContributions = new Set();
    unreadable = new Set();
    committable = new Map();
    priorSteps = new Map();
    lastMaterial = new Map();
    groups = new Map();
    dirtyReceipts = new Set();
    variableGroups = new Map();
    order;
    through = 0;
    constructor(table, onPlan = () => { }, onVariable = () => { }, receiptFacts) {
        this.table = table;
        this.onPlan = onPlan;
        this.onVariable = onVariable;
        this.receiptFacts = receiptFacts;
    }
    add(index, key, position) {
        let positions = index.get(key);
        if (!positions) {
            positions = new Set();
            index.set(key, positions);
        }
        positions.add(position);
    }
    acceptedMaterial(event) {
        return this.accepted.has(`${event.data.turn}:${event.data.step}`);
    }
    rememberPrior(turn, step) {
        if (!this.accepted.has(`${turn}:${step}`) || !this.byStep.has(`${turn}:${step}`))
            return;
        const steps = this.priorSteps.get(turn) ?? [];
        let low = 0, high = steps.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (steps[middle] < step)
                low = middle + 1;
            else
                high = middle;
        }
        if (steps[low] !== step)
            steps.splice(low, 0, step);
        this.priorSteps.set(turn, steps);
    }
    complete(event) {
        if (event.type !== 'turn/end' || event.data.reason.kind !== 'completed' || this.completed.has(event.data.turn))
            return;
        this.completed.add(event.data.turn);
        for (const position of this.byTurn.get(event.data.turn) ?? []) {
            if (this.acceptedMaterial(this.materials.get(position)) && !this.dirty.has(position))
                this.updateCompleted(position, this.decoded.get(position));
        }
    }
    accept(event) {
        if (event.type !== 'assistant/message' || event.data.interrupted)
            return;
        const key = `${event.data.turn}:${event.data.step}`;
        if (this.accepted.has(key))
            return;
        this.accepted.add(key);
        this.rememberPrior(event.data.turn, event.data.step);
        for (const position of this.byStep.get(key) ?? [])
            this.dirty.add(position);
    }
    material(event, position) {
        if (event.type !== 'request/material')
            return;
        this.materials.set(position, event);
        if (!this.plans.has(event.data.plan.key))
            this.onPlan(event.data.plan.key);
        this.add(this.plans, event.data.plan.key, position);
        this.add(this.byTurn, event.data.turn, position);
        const key = `${event.data.turn}:${event.data.step}`;
        this.add(this.byStep, key, position);
        this.lastMaterial.set(key, Math.max(this.lastMaterial.get(key) ?? -1, position));
        this.rememberPrior(event.data.turn, event.data.step);
        if (this.acceptedMaterial(event))
            this.dirty.add(position);
    }
    advance(event) { this.complete(event); this.accept(event); this.material(event, Number(event.seq)); }
    planChanged(key) {
        for (const position of this.plans.get(key) ?? [])
            if (this.acceptedMaterial(this.materials.get(position)))
                this.dirty.add(position);
    }
    forget(group) {
        this.order = remove(this.order, group.first);
        this.groups.delete(group.id);
        this.dirtyReceipts.delete(group);
        for (const key of group.dependencies) {
            const related = this.variableGroups.get(key);
            related.delete(group);
            if (!related.size)
                this.variableGroups.delete(key);
        }
    }
    watchReceipt(group) {
        if (!this.receiptFacts)
            return;
        const facts = this.receiptFacts(group.record), keys = new Set(facts.keys);
        for (const key of group.dependencies)
            if (!keys.has(key)) {
                const related = this.variableGroups.get(key);
                related.delete(group);
                if (!related.size)
                    this.variableGroups.delete(key);
                group.dependencies.delete(key);
            }
        for (const key of keys)
            if (!group.dependencies.has(key)) {
                let related = this.variableGroups.get(key);
                if (!related) {
                    related = new Set();
                    this.variableGroups.set(key, related);
                    this.onVariable(key);
                }
                related.add(group);
                group.dependencies.add(key);
            }
    }
    useRecord(group, record) {
        const previous = group.record.acceptedMaterialRef, next = record.acceptedMaterialRef;
        if (previous.key !== next.key || previous.sha256 !== next.sha256) {
            group.notice = {};
            this.order = setPending(this.order, group.first, true);
        }
        group.record = record;
        this.dirtyReceipts.add(group);
    }
    updateCompleted(position, record) {
        const previous = this.committable.get(position), previousGroup = previous ? this.groups.get(preparationId(previous)) : undefined;
        if (previousGroup && record && previousGroup.id === preparationId(record)) {
            this.committable.set(position, record);
            previousGroup.records.set(position, record);
            if (position === previousGroup.last)
                this.useRecord(previousGroup, record);
            return;
        }
        if (previousGroup) {
            const first = previousGroup.first;
            previousGroup.records.delete(position);
            if (!previousGroup.records.size)
                this.forget(previousGroup);
            else {
                previousGroup.first = Infinity;
                previousGroup.last = -Infinity;
                for (const ordinal of previousGroup.records.keys()) {
                    previousGroup.first = Math.min(previousGroup.first, ordinal);
                    previousGroup.last = Math.max(previousGroup.last, ordinal);
                }
                if (first !== previousGroup.first) {
                    const pending = pendingAt(this.order, first);
                    this.order = remove(this.order, first);
                    this.order = insert(this.order, previousGroup.first, previousGroup.id, pending);
                }
                this.useRecord(previousGroup, previousGroup.records.get(previousGroup.last));
            }
        }
        if (!record) {
            this.committable.delete(position);
            return;
        }
        this.committable.set(position, record);
        const id = preparationId(record);
        let group = this.groups.get(id);
        if (!group) {
            group = { id, records: new Map(), first: position, last: position, record, notice: {}, dependencies: new Set() };
            this.groups.set(id, group);
            this.order = insert(this.order, position, id);
        }
        const first = group.first;
        group.records.set(position, record);
        if (position < group.first)
            group.first = position;
        if (position >= group.last) {
            group.last = position;
            this.useRecord(group, record);
        }
        if (first !== group.first) {
            const pending = pendingAt(this.order, first);
            this.order = remove(this.order, first);
            this.order = insert(this.order, group.first, id, pending);
        }
    }
    refresh() {
        const read = new Map();
        for (const position of [...this.dirty].sort((left, right) => left - right)) {
            const event = this.materials.get(position), key = event.data.plan.key;
            let row = read.get(key);
            if (!row) {
                row = { stored: this.table.get(key) };
                read.set(key, row);
            }
            const current = row;
            let record;
            try {
                record = readAcceptedPreparationPlanRecord(current.stored, event.data.plan.sha256, () => current.sha256 ??= recordSha256(current.stored));
            }
            catch (error) {
                this.unreadable.add(position);
                throw error;
            }
            if (record) {
                this.unreadable.delete(position);
                if (record.ordinaryChat.messageGroups?.length)
                    this.everMessageContributions.add(record.ordinaryChat.contributionId);
            }
            else
                this.unreadable.add(position);
            const accepted = record ? { ...record, acceptedMaterialRef: event.data.plan } : undefined;
            if (accepted)
                this.decoded.set(position, accepted);
            else
                this.decoded.delete(position);
            if (this.completed.has(event.data.turn))
                this.updateCompleted(position, accepted);
            this.dirty.delete(position);
        }
        // A cut can contain several material revisions for one attempt. Only its
        // final accepted record locates the canonical operation being confirmed.
        for (const group of this.dirtyReceipts)
            this.watchReceipt(group);
        this.dirtyReceipts.clear();
    }
    records() { return [...ids(this.order)].map(id => this.groups.get(id).record); }
    messageBinding(input, plan) {
        if (plan?.messageGroups?.length || this.everMessageContributions.has(input.contributionId))
            return 'required';
        return input.messageBindingOrigin === 'complete-current-input' && !this.unreadable.size ? 'none' : 'unknown';
    }
    selectPrior(turn, step) {
        const steps = this.priorSteps.get(turn);
        if (!steps)
            return;
        let low = 0, high = steps.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (steps[middle] < step)
                low = middle + 1;
            else
                high = middle;
        }
        if (!low)
            return;
        const position = this.lastMaterial.get(`${turn}:${steps[low - 1]}`);
        return { position, record: this.decoded.get(position) };
    }
    nextPending() {
        let node = this.order;
        while (node?.pendingCount) {
            if (node.left?.pendingCount) {
                node = node.left;
                continue;
            }
            if (node.pending)
                return this.groups.get(node.id);
            node = node.right;
        }
    }
    acknowledge(group, notice) {
        this.watchReceipt(group);
        if (this.groups.get(group.id) === group && group.notice === notice)
            this.order = setPending(this.order, group.first, false);
    }
    invalidateVariables(key) {
        for (const group of this.variableGroups.get(key) ?? []) {
            if (this.receiptFacts?.(group.record).accepted)
                continue;
            group.notice = {};
            this.order = setPending(this.order, group.first, true);
        }
    }
}
/** The raw oracle and live Native index share the same accepted preparation
 * decoder. Completion admits publication; earlier accepted steps stay readable. */
export function acceptedPreparationAttempts(events, table) {
    const history = new AcceptedPreparationHistory(table);
    for (const event of events)
        history.complete(event);
    for (const event of events)
        history.accept(event);
    for (const [position, event] of events.entries())
        history.material(event, position);
    history.refresh();
    return history.records();
}
/** One Native acceptance owner publishes ordinary preparation writes with or
 * without a selected preset, including the preset's coordinated globals. */
export function createCommunityPresetSettlement(table, variables, options = {}) {
    const owners = new WeakMap(), settled = new Map();
    const planReaders = new Map(), variableReaders = new Map();
    function watch(index, key, ref) {
        let readers = index.get(key);
        if (!readers) {
            readers = new Set();
            index.set(key, readers);
        }
        readers.add(ref);
    }
    const stop = options.observeRecords?.(change => {
        if (change.table !== 'branch')
            return;
        for (const ref of planReaders.get(change.key) ?? []) {
            const history = ref.deref();
            if (history)
                history.planChanged(change.key);
            else
                planReaders.get(change.key).delete(ref);
        }
        const value = change.operation === 'put' ? change.value : undefined;
        if (change.operation === 'put' && variables.isPublishing?.(change.key, value))
            return;
        for (const ref of variableReaders.get(change.key) ?? []) {
            const history = ref.deref();
            if (history)
                history.invalidateVariables(change.key);
            else
                variableReaders.get(change.key).delete(ref);
        }
    });
    function native(session) {
        if (!options.observeRecords || typeof session.isOwnSeq !== 'function')
            return;
        const cut = sessionHistoryCut(session);
        if (cut.source !== 'native')
            return;
        let history = owners.get(cut.owner);
        if (!history) {
            let ref;
            history = new AcceptedPreparationHistory(table, key => watch(planReaders, key, ref), key => watch(variableReaders, key, ref), record => variables.receiptFacts(record));
            ref = new WeakRef(history);
            owners.set(cut.owner, history);
        }
        for (const event of cut.range(history.through)) {
            history.advance(event);
            history.through = Number(event.seq) + 1;
        }
        history.refresh();
        return history;
    }
    async function reconcile(session) {
        if (options.observeRecords && typeof session.isOwnSeq === 'function')
            await ensureSessionHistory(session);
        return withTavernLock(table, `community-settlement:${session.id}`, async () => {
            let history = native(session);
            if (!history) {
                const events = session.snapshotEvents(), last = Number(events.at(-1)?.seq ?? 0);
                if (settled.get(session.id) === last)
                    return;
                for (const record of acceptedPreparationAttempts(events, table))
                    await variables.commitPreparation(record);
                settled.set(session.id, last);
                return;
            }
            for (;;) {
                const group = history.nextPending();
                if (!group)
                    return;
                const notice = group.notice, record = group.record;
                await variables.commitPreparation(record);
                // Notifications update DATA, but only this actual returned commit ACK
                // can settle the attempt. A lost ACK leaves it pending for readback.
                const current = native(session);
                history.acknowledge(group, notice);
                history = current;
            }
        });
    }
    function attemptIds(input) {
        if (Array.isArray(input))
            return acceptedPreparationAttempts(input, table).map(record => record.ordinaryChat.attemptId);
        const session = input, history = native(session);
        return history ? history.records().map(record => record.ordinaryChat.attemptId)
            : acceptedPreparationAttempts(session.snapshotEvents(), table).map(record => record.ordinaryChat.attemptId);
    }
    function capturePrior(session, input) {
        const history = native(session);
        if (!history)
            throw Error('ORDINARY_PREPARATION_HISTORY_UNAVAILABLE');
        const selected = history.selectPrior(input.turn, input.step), record = selected?.record, plan = record?.ordinaryChat;
        if (selected && !plan)
            throw Error('ORDINARY_PRIOR_PLAN_UNAVAILABLE');
        if (plan && (plan.inputId !== input.inputId || plan.contributionId !== input.contributionId || plan.attemptId !== input.attemptId
            || recordSha256(plan.initialRoot.namespace) !== recordSha256(input.namespace)))
            throw Error('ORDINARY_PRIOR_SOURCE_CHANGED');
        const messageBinding = history.messageBinding(input, plan);
        return { writes: plan?.writes ?? [], messageGroups: plan?.messageGroups ?? [], messageBinding, current() {
                if (native(session) !== history)
                    return false;
                const current = history.selectPrior(input.turn, input.step);
                if (messageBinding === 'none' && history.messageBinding(input, current?.record?.ordinaryChat) !== 'none')
                    return false;
                if (!selected)
                    return current === undefined;
                return current?.position === selected.position && current.record !== undefined && record !== undefined
                    && current.record.acceptedMaterialRef.key === record.acceptedMaterialRef.key
                    && current.record.acceptedMaterialRef.sha256 === record.acceptedMaterialRef.sha256;
            } };
    }
    return { reconcile, attemptIds, capturePrior,
        dispose() { stop?.(); planReaders.clear(); variableReaders.clear(); settled.clear(); },
    };
}
