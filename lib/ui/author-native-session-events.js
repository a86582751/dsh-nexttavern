// Generated from runtime/alpha3/src/ui/author-native-session-events.ts; edit the TypeScript source.
import { AUTHOR_NATIVE_EVENTS_V1 } from '../core/author-native-origin.js';
export function openingNavigationIntent(operationId, changed, messages, rows) {
    const row = rows.find(row => row.swipe_id !== undefined), message = row && messages.find(message => message.index === row.message_id);
    const variant = row && message?.ordinary?.variants[row.swipe_id]?.identity.variant;
    return { operationId, ...changed && row && message?.variants && row.swipe_id !== message.variants.swipe_id
            && variant?.kind === 'opening-variant' ? { swipe: { variantId: variant.id, swipeId: row.swipe_id } } : {} };
}
/** The selected view completes a transition after its actual target adoption.
 * Source receipt observation only initiates this handoff. */
export function createAuthorNativeNavigationOwner() {
    let selected = null;
    let destination;
    let pending;
    async function complete() {
        const transition = pending, target = destination;
        if (!transition?.accepted || !target?.snapshot || target.sessionId !== transition.target || !target.current())
            return;
        const swipe = transition.intent?.swipe;
        const message = swipe ? target.snapshot.messages.find(message => message.variants?.swipe_id === swipe.swipeId
            && message.ordinary?.selectedTarget.identity.variant.kind === 'opening-variant'
            && message.ordinary.selectedTarget.identity.variant.id === swipe.variantId) : undefined;
        if (swipe && !message)
            return;
        pending = undefined;
        if (transition.source !== transition.target && transition.source !== null)
            await target.route.emit(AUTHOR_NATIVE_EVENTS_V1.CHAT_CHANGED, [target.sessionId]);
        if (swipe && message && destination === target && target.current())
            await target.route.emit(AUTHOR_NATIVE_EVENTS_V1.MESSAGE_SWIPED, [message.index]);
    }
    return {
        select(sessionId, route, current) {
            if (selected !== sessionId) {
                if (pending?.target !== sessionId)
                    pending = { source: selected, target: sessionId, accepted: true };
                selected = sessionId;
            }
            const target = { sessionId, route, current };
            destination = target;
            return { adopt(snapshot) {
                    if (destination !== target || !current())
                        return;
                    target.snapshot = snapshot;
                    void complete().catch(() => { });
                }, dispose() { if (destination === target)
                    destination = undefined; } };
        },
        async navigate(source, target, intent, open) {
            if (source === target && !intent?.swipe)
                return;
            const transition = { source, target, intent, accepted: false };
            pending = transition;
            try {
                if (source !== target)
                    await open();
                if (pending !== transition)
                    return;
                transition.accepted = true;
                await complete();
            }
            catch (error) {
                if (pending === transition)
                    pending = undefined;
                throw error;
            }
        },
    };
}
/** One Reader view owns this route for its actual session attachment. Listener
 * functions stay in their realm. Nested emissions have independent deliveries
 * so an awaited event emitted by a listener cannot deadlock its own parent. */
export function createAuthorNativeSessionEventRouter() {
    const endpoints = new Set();
    let active = true;
    const generations = new Map(), generationListeners = new Set();
    const publishGenerations = () => { for (const listener of generationListeners)
        listener(); };
    const stopGeneration = (id) => {
        const job = generations.get(id);
        if (!job || job.cancelled)
            return false;
        job.cancelled = true;
        generations.delete(id);
        publishGenerations();
        void Promise.resolve(job.input.cancel()).catch(() => { });
        return true;
    };
    async function emit(event, args, exclude) {
        if (!active)
            return;
        for (const endpoint of [...endpoints]) {
            if (!active)
                return;
            if (endpoint === exclude || !endpoints.has(endpoint) || !endpoint.current())
                continue;
            try {
                await endpoint.deliver(event, args);
            }
            catch (error) {
                if (endpoints.has(endpoint) && endpoint.current())
                    throw error;
            }
        }
    }
    // Requested generation configuration crosses structured-clone boundaries.
    // Each realm must ACK its actual mutated arguments before the next realm
    // receives them. Notification delivery deliberately ignores that value.
    async function transform(event, args, operationId) {
        if (!active)
            throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
        let result = args;
        for (const endpoint of [...endpoints]) {
            if (!active)
                throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
            if (operationId && generations.get(String(args[0]))?.input.operationId !== operationId)
                throw Error('AUTHOR_GENERATION_CANCELLED');
            if (!endpoints.has(endpoint) || !endpoint.current())
                continue;
            const changed = await endpoint.deliver(event, result, true, operationId);
            if (changed)
                result = changed;
        }
        return result;
    }
    return {
        register(deliver, current, generationOwner) {
            const endpoint = { deliver, current, generationOwner };
            if (active)
                endpoints.add(endpoint);
            return {
                emit: (event, args, excludeSelf = false) => endpoints.has(endpoint) && current()
                    ? emit(event, args, excludeSelf ? endpoint : undefined) : Promise.resolve(),
                transform: (event, args, operationId) => {
                    if (!endpoints.has(endpoint) || !current())
                        throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
                    return transform(event, args, operationId);
                },
                dispose: () => { endpoints.delete(endpoint); },
            };
        },
        emit,
        transform,
        async captureMvuTrialHooks() {
            const captured = [];
            const current = (endpoint) => active && endpoints.has(endpoint) && endpoint.current();
            for (const endpoint of [...endpoints]) {
                if (!current(endpoint))
                    continue;
                const owner = endpoint.generationOwner;
                if (!owner?.trialInterests || !owner.invokeTrialHook)
                    continue;
                const interests = await owner.trialInterests();
                if (!current(endpoint))
                    throw Error('AUTHOR_NATIVE_MVU_TRIAL_REVOKED');
                if (interests.length)
                    captured.push({ endpoint, interests: new Set(interests) });
            }
            return {
                interests: [...new Set(captured.flatMap(row => [...row.interests]))],
                async invoke(stage, graph) {
                    for (const row of captured) {
                        if (!row.interests.has(stage))
                            continue;
                        if (!current(row.endpoint))
                            throw Error('AUTHOR_NATIVE_MVU_TRIAL_REVOKED');
                        graph = await row.endpoint.generationOwner.invokeTrialHook(stage, graph);
                        if (!current(row.endpoint))
                            throw Error('AUTHOR_NATIVE_MVU_TRIAL_REVOKED');
                    }
                    return graph;
                },
            };
        },
        async invokeGenerationFilter(descriptor, operationId, consumer) {
            const generation = generations.get(descriptor.generationId);
            if (!generation || generation.cancelled || generation.input.operationId !== operationId
                || descriptor.operationId !== operationId)
                throw Error('AUTHOR_GENERATION_CANCELLED');
            const endpoint = [...endpoints].find(row => row.current() && row.generationOwner?.realmId === descriptor.realmId);
            if (!active || !endpoint?.generationOwner)
                throw Error('AUTHOR_NATIVE_GENERATION_FILTER_REVOKED');
            return endpoint.generationOwner.invokeFilter(descriptor.callbackId, operationId, consumer);
        },
        retireGenerationFilters(generationId, descriptors) {
            for (const endpoint of endpoints) {
                const owner = endpoint.generationOwner;
                if (owner)
                    owner.retireFilters(generationId, descriptors.filter(row => row.realmId === owner.realmId).map(row => row.callbackId));
            }
        },
        async captureGenerationLibraryReads() {
            const reads = [];
            for (const endpoint of endpoints)
                if (endpoint.current() && endpoint.generationOwner) {
                    const owner = endpoint.generationOwner;
                    for (const read of await owner.captureLibraryReads())
                        reads.push({ realmId: owner.realmId, read,
                            ...owner.attachment ? { attachment: owner.attachment } : {} });
                }
            return reads;
        },
        reserveGeneration(input) {
            if (!active)
                throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
            if (generations.has(input.generationId))
                throw Error('AUTHOR_GENERATION_ID_ACTIVE');
            const job = { input, cancelled: false, silence: input.silence };
            generations.set(input.generationId, job);
            publishGenerations();
            return { current: () => active && !job.cancelled && generations.get(input.generationId) === job,
                cancel: () => stopGeneration(input.generationId), setSilence(value) { job.silence = value; publishGenerations(); }, release() {
                    if (generations.get(input.generationId) === job) {
                        generations.delete(input.generationId);
                        publishGenerations();
                    }
                } };
        },
        stopGeneration,
        stopAllGenerations() { for (const id of [...generations.keys()])
            stopGeneration(id); return true; },
        generationStatus: () => [...generations.values()].map(row => ({ generationId: row.input.generationId, silence: row.silence })),
        subscribeGenerations(listener) { generationListeners.add(listener); return () => { generationListeners.delete(listener); }; },
        dispose() { for (const id of [...generations.keys()])
            stopGeneration(id); active = false; endpoints.clear(); generationListeners.clear(); },
    };
}
