// Generated from runtime/alpha3/src/core/roleplay-author-browser-generation.ts; edit the TypeScript source.
/** One live attachment owns its waiting Reader and pending preparation call.
 * A long-poll transports the challenge; it never grants Native permission. */
import { randomUUID } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
import { AUTHOR_NATIVE_MVU_HOOK_EVENTS } from './author-native-mvu-hook-types.js';
const sameBinding = (left, right) => left.browserSessionId === right.browserSessionId && left.generation === right.generation
    && left.sessionId === right.sessionId && left.programSha256 === right.programSha256;
function fail(code) { throw Error(code); }
export function createRoleplayAuthorBrowserGeneration(options) {
    let closed = false, waiter, pending;
    let latestRegistrations = [], latestRegistrationRevision;
    let filterCall;
    const retired = [];
    const readerArrivals = new Set();
    let hook;
    let producedPrompts = false;
    const current = () => !closed && options.current();
    const sourceCurrent = () => !closed && (options.sourceCurrent?.() ?? options.current());
    const assertCurrent = () => { if (!current())
        fail('BROWSER_ATTACHMENT_REVOKED'); };
    const assertSourceCurrent = () => { if (!sourceCurrent())
        fail('BROWSER_ATTACHMENT_REVOKED'); };
    const assertBinding = (binding, assertOwner = assertCurrent) => {
        if (!sameBinding(binding, options.binding))
            fail('BROWSER_ATTACHMENT_REVOKED');
        assertOwner();
    };
    const realms = new Map(options.program.realms.map(realm => [realm.realmId, realm]));
    const admittedOrigin = (row) => {
        return realms.has(row.realmId) && row.resource.browserSessionId === options.binding.browserSessionId
            && row.resource.generation === options.binding.generation;
    };
    function registrations(input) {
        const accepted = input.map(row => {
            if (!admittedOrigin(row))
                fail('BROWSER_GENERATION_REGISTRATION_INVALID');
            return Object.freeze({ ...row, resource: Object.freeze({ ...row.resource }) });
        });
        // The guest registry already applied eventMakeFirst to this exact list.
        return Object.freeze(accepted);
    }
    function acceptRegistrations(input, revision) {
        if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0))
            fail('BROWSER_GENERATION_REGISTRATION_INVALID');
        // A poll and an explicit registry update can cross at the transport boundary.
        if (latestRegistrationRevision !== undefined && (revision === undefined || revision <= latestRegistrationRevision))
            return;
        latestRegistrations = registrations(input);
        latestRegistrationRevision = revision;
        if (waiter)
            waiter.registrations = latestRegistrations;
    }
    function wait(binding, input, signal, sourceCursor, registrationRevision) {
        assertBinding(binding, assertSourceCurrent);
        signal.throwIfAborted();
        if (waiter || pending || hook?.started || filterCall)
            fail('BROWSER_GENERATION_BUSY');
        acceptRegistrations(input, registrationRevision);
        return new Promise((resolve, reject) => {
            const abort = () => {
                if (waiter !== value)
                    return;
                waiter = undefined;
                value.cleanup();
                reject(Error('BROWSER_GENERATION_READER_DISCONNECTED'));
            };
            let unsubscribe;
            const value = { registrations: latestRegistrations, resolve, reject,
                cleanup: () => { signal.removeEventListener('abort', abort); unsubscribe?.(); } };
            waiter = value;
            signal.addEventListener('abort', abort, { once: true });
            if (retired.length) {
                waiter = undefined;
                value.cleanup();
                value.resolve(retired.shift());
            }
            const deliver = () => {
                const packet = options.lifecycle?.peek();
                if (waiter !== value || !packet)
                    return;
                waiter = undefined;
                value.cleanup();
                value.resolve({ encoding: 'author-native-lifecycle-invocation-v1', packet });
            };
            options.lifecycle?.peek(sourceCursor);
            if (waiter === value) {
                unsubscribe = options.lifecycle?.onReady(deliver);
                deliver();
            }
            for (const arrival of readerArrivals)
                arrival.resolve();
            readerArrivals.clear();
        });
    }
    async function invokeFilter(input, signal, sourceData) {
        assertCurrent();
        signal.throwIfAborted();
        if (!realms.has(input.realmId) || input.resource.browserSessionId !== options.binding.browserSessionId
            || input.resource.generation !== options.binding.generation)
            fail('AUTHOR_NATIVE_INJECTION_FILTER_SOURCE_CHANGED');
        while (!waiter) {
            await new Promise((resolve, reject) => {
                const abort = () => { readerArrivals.delete(arrival); reject(Error('BROWSER_GENERATION_CANCELLED')); };
                const arrival = { resolve: () => { signal.removeEventListener('abort', abort); resolve(); },
                    reject: (error) => { signal.removeEventListener('abort', abort); reject(error); } };
                readerArrivals.add(arrival);
                signal.addEventListener('abort', abort, { once: true });
            });
            assertCurrent();
            signal.throwIfAborted();
        }
        if (pending || hook || filterCall)
            fail('BROWSER_GENERATION_BUSY');
        const invocation = { ...input, schemaVersion: 1,
            encoding: 'author-native-injection-filter-invocation-v1', invocationId: randomUUID(), binding: options.binding };
        const reader = waiter;
        waiter = undefined;
        reader.cleanup();
        const result = new Promise((resolve, reject) => {
            const abort = () => { if (filterCall !== value)
                return; filterCall = undefined; value.cleanup(); reject(Error('BROWSER_GENERATION_CANCELLED')); };
            const value = { invocation, sourceData, resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) };
            filterCall = value;
            signal.addEventListener('abort', abort, { once: true });
        });
        reader.resolve(invocation);
        return result;
    }
    function completeFilter(result) {
        assertBinding(result.binding);
        const value = filterCall;
        if (!value || value.invocation.invocationId !== result.invocationId
            || value.invocation.operationId !== result.operationId)
            fail('BROWSER_GENERATION_INVOCATION_REVOKED');
        filterCall = undefined;
        value.cleanup();
        if (result.kind !== 'executed') {
            value.reject(Error(result.code));
            return;
        }
        if (typeof result.accepted !== 'boolean') {
            value.reject(Error('AUTHOR_NATIVE_INJECTION_FILTER_INVALID_RESULT'));
            return;
        }
        try {
            value.resolve({ accepted: result.accepted, libraryReads: options.resolveLibraryReads?.(result.libraryReads ?? []) ?? [] });
        }
        catch (error) {
            value.reject(error instanceof Error ? error : Error('AUTHOR_NATIVE_LIBRARY_READ_UNAVAILABLE'));
        }
    }
    function retireFilterCallbacks(message) {
        if (waiter && !pending && !hook && !filterCall) {
            const reader = waiter;
            waiter = undefined;
            reader.cleanup();
            reader.resolve(message);
        }
        else
            retired.push(message);
    }
    function invoke(input, signal, sourceData) {
        assertCurrent();
        signal.throwIfAborted();
        if (pending || hook || filterCall)
            fail('BROWSER_GENERATION_BUSY');
        const reader = waiter;
        if (!reader)
            fail('BROWSER_GENERATION_READER_UNAVAILABLE');
        if (input.capture.sessionId !== options.binding.sessionId || input.snapshot.generation !== options.binding.generation
            || input.capture.attemptId !== input.attemptId)
            fail('BROWSER_GENERATION_CAPTURE_CHANGED');
        const invocation = Object.freeze({ schemaVersion: 1,
            encoding: 'author-native-generation-invocation-v1', invocationId: randomUUID(),
            binding: options.binding, registrations: reader.registrations.filter(row => row.event === 'GENERATION_AFTER_COMMANDS'), ...input });
        const result = new Promise((resolve, reject) => {
            const abort = () => {
                if (pending !== value)
                    return;
                pending = undefined;
                value.cleanup();
                reject(Error('BROWSER_GENERATION_CANCELLED'));
            };
            const value = { invocation, sourceData, resolve, reject, cleanup: () => signal.removeEventListener('abort', abort) };
            pending = value;
            signal.addEventListener('abort', abort, { once: true });
        });
        waiter = undefined;
        reader.cleanup();
        reader.resolve(invocation);
        return result;
    }
    async function awaitReader(signal) {
        assertSourceCurrent();
        signal.throwIfAborted();
        while (!waiter) {
            await new Promise((resolve, reject) => {
                const abort = () => { readerArrivals.delete(arrival); reject(Error('BROWSER_GENERATION_CANCELLED')); };
                const arrival = { resolve: () => { signal.removeEventListener('abort', abort); resolve(); },
                    reject: (error) => { signal.removeEventListener('abort', abort); reject(error); } };
                readerArrivals.add(arrival);
                signal.addEventListener('abort', abort, { once: true });
            });
            assertSourceCurrent();
            signal.throwIfAborted();
        }
        return waiter;
    }
    async function prepareHook(request, signal) {
        // Native's closing owner supplies this stage's current graph. Its earlier
        // snapshot may have expired while the same Source realm remains live.
        assertSourceCurrent();
        signal.throwIfAborted();
        const event = AUTHOR_NATIVE_MVU_HOOK_EVENTS[request.stage];
        if (!latestRegistrations.some(row => row.event === event))
            return undefined;
        // The previous completion and the next long-poll cross HTTP separately.
        // A known listener waits for the same Reader's next admitted poll.
        const reader = await awaitReader(signal);
        if (pending || hook || filterCall)
            fail('BROWSER_GENERATION_BUSY');
        const callbacks = reader.registrations.filter(row => row.event === event);
        if (!callbacks.length)
            return undefined;
        const invocation = { schemaVersion: 1, encoding: 'author-native-mvu-hook-invocation-v1',
            invocationId: randomUUID(), binding: options.binding, request, registrations: callbacks };
        const abort = () => {
            if (hook !== value)
                return;
            hook = undefined;
            value.cleanup();
            value.reject?.(Error('BROWSER_GENERATION_CANCELLED'));
        };
        const value = { invocation, reader, started: false, resolve: undefined,
            reject: undefined,
            cleanup: () => signal.removeEventListener('abort', abort) };
        hook = value;
        signal.addEventListener('abort', abort, { once: true });
        return { identity: { invocationId: invocation.invocationId, programSha256: options.program.programSha256,
                binding: options.binding, registrations: callbacks.map(row => ({ realmId: row.realmId,
                    groupId: realms.get(row.realmId).groupId, callbackId: row.callbackId, resource: row.resource })) },
            execute: () => {
                assertSourceCurrent();
                signal.throwIfAborted();
                if (hook !== value || waiter !== reader || value.started)
                    fail('BROWSER_GENERATION_INVOCATION_REVOKED');
                value.started = true;
                const result = new Promise((resolve, reject) => { value.resolve = resolve; value.reject = reject; });
                waiter = undefined;
                reader.cleanup();
                reader.resolve(invocation);
                return result;
            }, dispose: () => {
                if (hook !== value)
                    return;
                hook = undefined;
                value.cleanup();
                value.reject?.(Error('BROWSER_GENERATION_INVOCATION_REVOKED'));
            } };
    }
    function completeHook(result) {
        assertBinding(result.binding, assertSourceCurrent);
        const value = hook;
        if (!value?.started || value.invocation.invocationId !== result.invocationId)
            fail('BROWSER_GENERATION_INVOCATION_REVOKED');
        hook = undefined;
        value.cleanup();
        const refuse = (code) => { value.reject?.(Error(code)); return fail(code); };
        if (result.kind !== 'executed') {
            value.reject?.(Error(result.code));
            return;
        }
        if (result.result.stage !== value.invocation.request.stage)
            return refuse('AUTHOR_NATIVE_MVU_HOOK_OUTPUT_CHANGED');
        const callbacks = new Map(value.invocation.registrations.map((row, index) => [row.callbackId, index]));
        let previous = -1;
        for (const id of result.callbackIds) {
            const index = callbacks.get(id);
            if (index === undefined || index <= previous)
                return refuse('AUTHOR_NATIVE_MVU_HOOK_OUTPUT_CHANGED');
            previous = index;
        }
        if (result.registrations) {
            try {
                acceptRegistrations(result.registrations, result.registrationRevision);
            }
            catch (error) {
                return refuse(error instanceof Error ? error.message : 'BROWSER_GENERATION_REGISTRATION_INVALID');
            }
        }
        value.resolve?.(result.result);
    }
    function complete(result) {
        assertBinding(result.binding);
        const value = pending;
        if (!value || value.invocation.invocationId !== result.invocationId)
            fail('BROWSER_GENERATION_INVOCATION_REVOKED');
        const refuse = (code) => {
            pending = undefined;
            value.cleanup();
            value.reject(Error(code));
            return fail(code);
        };
        if (result.kind !== 'executed') {
            pending = undefined;
            value.cleanup();
            value.reject(Error(result.diagnostics[0]?.code ?? 'BROWSER_GENERATION_REFUSED'));
            return;
        }
        const raw = result.result, invocation = value.invocation;
        if (raw.invocationId !== invocation.invocationId)
            refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
        const callbacks = new Map(invocation.registrations.map((row, index) => [row.callbackId, { row, index }]));
        const executed = new Map();
        let previous = -1;
        for (const id of raw.callbackIds) {
            const callback = callbacks.get(id);
            if (!callback || callback.index <= previous)
                return refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
            previous = callback.index;
            executed.set(id, callback.row);
        }
        // A real callback may remove a later listener during the captured pass.
        // The returned IDs therefore form an ordered subsequence, not a fabricated
        // claim that every callback in the challenge necessarily ran.
        let effects, libraryReads;
        try {
            libraryReads = options.resolveLibraryReads?.(raw.libraryReads ?? []) ?? [];
            effects = raw.effects.map(effect => {
                const callback = executed.get(effect.callbackId);
                if (!callback)
                    return refuse('BROWSER_GENERATION_OUTPUT_CHANGED');
                const realm = realms.get(callback.realmId);
                const origin = { realmId: realm.realmId, groupId: realm.groupId, callbackId: callback.callbackId, resource: callback.resource };
                if (effect.kind === 'remove') {
                    if (!Array.isArray(effect.ids) || effect.ids.some(id => typeof id !== 'string'))
                        fail('AUTHOR_NATIVE_INJECTION_INVALID');
                    return { ...origin, kind: 'remove', ids: Object.freeze([...effect.ids]) };
                }
                if (effect.kind !== 'inject' || !Array.isArray(effect.prompts))
                    fail('AUTHOR_NATIVE_INJECTION_INVALID');
                const prompts = effect.prompts.map(prompt => {
                    const p = prompt;
                    if (!p || typeof p !== 'object')
                        fail('AUTHOR_NATIVE_INJECTION_INVALID');
                    // JS-Slash-Runner 519599bc src/function/inject.ts supplies these
                    // nullish defaults. Native function filters need a live callback
                    // consumer contract; a serialized omission must never accept one.
                    if (p.filter !== undefined && p.filter !== null)
                        fail('AUTHOR_NATIVE_INJECTION_FILTER_UNSUPPORTED');
                    const id = p.id ?? randomUUID(), content = p.content ?? '', depth = p.depth ?? 0, role = p.role ?? 'system', should_scan = p.should_scan ?? false, position = p.position === 'none' ? 'none' : 'in_chat';
                    if (typeof id !== 'string' || typeof content !== 'string' || !Number.isFinite(depth)
                        || !['system', 'user', 'assistant'].includes(role) || typeof should_scan !== 'boolean')
                        fail('AUTHOR_NATIVE_INJECTION_INVALID');
                    return Object.freeze({ id, position, depth, role, content, should_scan });
                });
                return { ...origin, kind: 'inject', prompts: Object.freeze(prompts), once: effect.once === true };
            });
        }
        catch (error) {
            return refuse(error instanceof Error ? error.message : 'AUTHOR_NATIVE_INJECTION_INVALID');
        }
        const body = { schemaVersion: 1, encoding: 'author-native-generation-output-v1',
            authority: 'consumer-data-only', invocationId: invocation.invocationId, programSha256: options.program.programSha256,
            captureSha256: invocation.capture.captureSha256, effects: Object.freeze(effects.map(effect => Object.freeze(effect))),
            callbacksExecuted: raw.callbackIds.length, ...libraryReads.length ? { libraryReads } : {} };
        const output = Object.freeze({ ...body, outputSha256: recordSha256(body) });
        producedPrompts ||= output.effects.some(effect => effect.kind === 'inject' && effect.prompts.length > 0);
        pending = undefined;
        value.cleanup();
        value.resolve(output);
    }
    function dispose() {
        options.lifecycle?.dispose();
        if (closed)
            return;
        closed = true;
        const filter = filterCall;
        filterCall = undefined;
        filter?.cleanup();
        filter?.reject(Error('BROWSER_ATTACHMENT_REVOKED'));
        retired.length = 0;
        const reader = waiter, call = pending;
        waiter = undefined;
        pending = undefined;
        const stage = hook;
        hook = undefined;
        stage?.cleanup();
        stage?.reject?.(Error('BROWSER_ATTACHMENT_REVOKED'));
        for (const arrival of readerArrivals)
            arrival.reject(Error('BROWSER_ATTACHMENT_REVOKED'));
        readerArrivals.clear();
        reader?.cleanup();
        call?.cleanup();
        reader?.reject(Error('BROWSER_ATTACHMENT_REVOKED'));
        call?.reject(Error('BROWSER_ATTACHMENT_REVOKED'));
    }
    function retireResource(pageId) {
        if (filterCall?.invocation.resource.pageId === pageId) {
            const call = filterCall;
            filterCall = undefined;
            call.cleanup();
            call.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'));
        }
        const belongs = (row) => row.resource.pageId === pageId;
        if (waiter?.registrations.some(belongs)) {
            const reader = waiter;
            waiter = undefined;
            reader.cleanup();
            reader.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'));
        }
        if (pending?.invocation.registrations.some(belongs)) {
            const call = pending;
            pending = undefined;
            call.cleanup();
            call.reject(Error('BROWSER_GENERATION_RESOURCE_RETIRED'));
        }
        latestRegistrations = latestRegistrations.filter(row => !belongs(row));
        if (hook?.invocation.registrations.some(belongs)) {
            const stage = hook;
            hook = undefined;
            stage.cleanup();
            stage.reject?.(Error('BROWSER_GENERATION_RESOURCE_RETIRED'));
        }
    }
    return { wait, updateRegistrations(binding, input, revision) {
            assertBinding(binding, assertSourceCurrent);
            if (revision === undefined)
                fail('BROWSER_GENERATION_REGISTRATION_INVALID');
            acceptRegistrations(input, revision);
        }, awaitReader, invoke, complete, invokeFilter, completeFilter, retireFilterCallbacks,
        prepareHook, completeHook, dispose, retireResource,
        hookInterests: () => sourceCurrent() ?
            Object.keys(AUTHOR_NATIVE_MVU_HOOK_EVENTS)
                .filter((stage) => stage !== 'initialized' && stage !== 'before-message-update'
                && latestRegistrations.some(row => row.event === AUTHOR_NATIVE_MVU_HOOK_EVENTS[stage])) : [],
        sourceDataFor: (realmId) => {
            const filter = filterCall;
            if (filter?.sourceData && filter.invocation.realmId === realmId && current())
                return () => filterCall === filter && current() ? filter.sourceData.begin({ invocationId: filter.invocation.invocationId,
                    programSha256: options.program.programSha256, realmId, groupId: realms.get(realmId).groupId }) : undefined;
            const call = pending, realm = realms.get(realmId);
            if (!call?.sourceData || !realm || !current()
                || !call.invocation.registrations.some(row => row.realmId === realmId))
                return undefined;
            return () => pending === call && current() ? call.sourceData.begin({
                invocationId: call.invocation.invocationId, programSha256: options.program.programSha256,
                realmId: realm.realmId, groupId: realm.groupId
            }) : undefined;
        },
        snapshotFor: (invocationId) => current() ? (pending?.invocation.invocationId === invocationId
            ? pending.invocation.snapshot : filterCall?.invocation.invocationId === invocationId ? filterCall.invocation.snapshot : undefined) : undefined,
        hasProducedPrompts: () => producedPrompts, hasReader: () => current() && waiter !== undefined && !hook };
}
export { createRoleplayAuthorBrowserGeneration as createRoleplayAuthorBrowserGenerationV3 };
