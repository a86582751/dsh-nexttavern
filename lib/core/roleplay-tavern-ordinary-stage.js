// Generated from runtime/alpha3/src/core/roleplay-tavern-ordinary-stage.ts; edit the TypeScript source.
/** One preparation owns the ordered ordinary values seen by all producers.
 * Canonical publication belongs to the accepted Native material consumer. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { authorChatContributionIdV3 } from './roleplay-author-chat-state.js';
const text = (value) => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export function createRoleplayTavernOrdinaryStage(input) {
    const { values: initial, deletedKeys = [], priorWrites = [], previousHadWrites, assertMutationAllowed, ...identity } = input, writes = [], deleted = new Set(deletedKeys);
    let values = initial, sealed = true, version = recordSha256(identity), bindings;
    let snapshots = new WeakMap();
    let chatBindings = new WeakMap();
    let messageSources = [];
    const messageStages = new Map(), messageCaptures = new Map();
    const targetKey = (target) => {
        const { ownerSessionId, nativeSeq, messageId, variant } = target.identity;
        return JSON.stringify([ownerSessionId, nativeSeq, messageId, variant.kind, variant.kind === 'opening-variant' ? variant.id : null]);
    };
    let createMessageStage;
    function apply(changes) {
        if (!changes.length)
            return;
        assertMutationAllowed?.();
        const next = sealed ? { ...values } : values;
        for (const write of changes) {
            if (write.key === 'stat_data')
                throw Error('AUTHOR_CHAT_NUMERICAL_KEY_RESERVED');
            if (write.operation === 'delete') {
                delete next[write.key];
                deleted.add(write.key);
            }
            else {
                deleted.delete(write.key);
                if (write.operation === 'set')
                    next[write.key] = write.value;
                else if (write.operation === 'append')
                    next[write.key] = text(next[write.key]) + text(write.value);
                else
                    next[write.key] = (Number(next[write.key]) || 0) + (Number(write.value) || 0);
            }
        }
        values = next;
        sealed = false;
        writes.push(...changes);
        version = recordSha256({ previous: version, changes });
        bindings = undefined;
        snapshots = new WeakMap();
        chatBindings = new WeakMap();
    }
    function chatBinding(base) {
        const previous = base && chatBindings.get(base);
        if (previous)
            return previous;
        // Accepted MVU context remains owned by the captured base. This stage
        // overlays ordinary changes and explicit deletions without republishing
        // that context as an ordinary write or dropping initialized metadata.
        const combined = { ...base?.values, ...values };
        for (const key of deleted)
            delete combined[key];
        const result = { scope: 'chat', ownerId: identity.initialRoot.namespace.sessionId,
            versionSha256: recordSha256({ base: base?.versionSha256 ?? null, ordinary: version }),
            values: combined, valuesSha256: recordSha256(combined) };
        if (base)
            chatBindings.set(base, result);
        chatBindings.set(result, result);
        return result;
    }
    apply(priorWrites);
    return {
        initialRoot: identity.initialRoot,
        ...identity.expectedScopeRef !== undefined ? { expectedScopeRef: identity.expectedScopeRef } : {},
        get values() { sealed = true; return Object.freeze(values); },
        get deletedKeys() { return deleted.size ? Object.freeze([...deleted]) : undefined; },
        read: (key) => values[key],
        apply,
        get hasWrites() { return writes.length > 0; },
        bindMessages(input) {
            messageSources = input.captures;
            for (const capture of messageSources)
                messageCaptures.set(targetKey(capture.root.namespace.target), capture);
            const priorByTarget = new Map((input.priorGroups ?? []).map(plan => [targetKey(plan.initialRoot.namespace.target), plan]));
            createMessageStage = (target) => {
                const key = targetKey(target), existing = messageStages.get(key);
                if (existing)
                    return existing.stage;
                const source = messageCaptures.get(key);
                if (!source)
                    throw Error('TEMPLATE_MESSAGE_TARGET_UNAVAILABLE');
                const namespace = source.root.namespace, contributionId = authorChatContributionIdV3(namespace, identity.inputId), previous = input.state.readAcceptedContribution(namespace, contributionId), basis = previous ? input.state.captureNamespaceWithoutContribution(namespace, contributionId)
                    : { root: source.root, scopeRef: source.scopeRef, values: source.values, deletedKeys: source.deletedKeys, priorAttemptId: null }, prior = priorByTarget.get(key), expectedScopeRef = prior ? prior.expectedScopeRef : basis.scopeRef, child = createRoleplayTavernOrdinaryStage({ inputId: identity.inputId, contributionId, attemptId: identity.attemptId,
                    assertMutationAllowed,
                    replacesAttemptId: basis.priorAttemptId, initialRoot: basis.root, values: basis.values, deletedKeys: basis.deletedKeys,
                    ...expectedScopeRef !== undefined ? { expectedScopeRef } : {},
                    previousHadWrites: previous?.hasWrites ?? false, priorWrites: prior?.writes });
                messageStages.set(key, { source, stage: child });
                return child;
            };
            // Keep earlier steps and a replacement's old targets, including a target
            // no longer written this step: its empty contribution withdraws old work.
            for (const prior of input.priorGroups ?? []) {
                // The current captured view supplies targets. An old plan cannot grant
                // access to an address absent from that view.
                createMessageStage(prior.initialRoot.namespace.target);
            }
            for (const source of messageSources) {
                const namespace = source.root.namespace, id = authorChatContributionIdV3(namespace, identity.inputId);
                if (input.state.readAcceptedContribution(namespace, id)?.hasWrites)
                    createMessageStage(namespace.target);
            }
        },
        captureMessages() {
            if (!messageStages.size)
                return messageSources;
            return messageSources.map(source => {
                const child = messageStages.get(targetKey(source.root.namespace.target))?.stage;
                if (!child)
                    return source;
                // The child owns the current deletion set, including its absence
                // after setting a deleted key. Worker captures carry JSON DATA.
                const { deletedKeys: _previousDeleted, ...basis } = source, deletedKeys = child.deletedKeys;
                return { ...basis, values: child.values, ...child.expectedScopeRef !== undefined ? { scopeRef: child.expectedScopeRef } : {},
                    ...deletedKeys ? { deletedKeys } : {}, exists: source.exists || child.hasWrites };
            });
        },
        applyEffects(effects) {
            for (const effect of effects) {
                const change = effect.operation === 'delete' ? { key: effect.key, operation: 'delete' }
                    : { key: effect.key, operation: 'set', value: effect.value };
                if (effect.messageTarget) {
                    if (!createMessageStage)
                        throw Error('TEMPLATE_MESSAGE_VIEW_UNAVAILABLE');
                    createMessageStage(effect.messageTarget).apply([change]);
                }
                else
                    apply([change]);
            }
        },
        chatBinding,
        macros(base) {
            let snapshot = snapshots.get(base);
            if (snapshot)
                return snapshot;
            bindings ??= Object.entries(values).map(([key, value]) => {
                const rendered = text(value);
                return { key, value: rendered, valueSha256: sha256(rendered), read: { kind: 'variable', purpose: 'read', scope: 'chat',
                        ownerId: identity.initialRoot.namespace.sessionId, key, present: true, versionSha256: version,
                        valueSha256: recordSha256(value), entryId: null, sourcePointer: null } };
            });
            snapshot = Object.freeze({ ...base, localVariables: [
                    ...base.localVariables.filter(binding => !Object.hasOwn(values, binding.key) && !deleted.has(binding.key)), ...bindings
                ],
                variableScopes: { ...base.variableScopes, chat: chatBinding(base.variableScopes?.chat ?? undefined) } });
            snapshots.set(base, snapshot);
            return snapshot;
        },
        plan() {
            const groups = [...messageStages.values()].map(row => row.stage.plan())
                .filter(plan => plan.writes.length || plan.previousHadWrites === true
                || plan.previousHadWrites === undefined && plan.replacesAttemptId !== null);
            return { schemaVersion: 1, encoding: 'native-ordinary-preparation-plan-v1', ...identity, writes: [...writes],
                ...previousHadWrites !== undefined ? { previousHadWrites } : {},
                ...groups.length ? { messageGroups: groups } : {} };
        },
    };
}
