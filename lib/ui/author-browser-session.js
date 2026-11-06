// Generated from runtime/alpha3/src/ui/author-browser-session.ts; edit the TypeScript source.
import { createAuthorNativeHelperFrame } from './author-native-helper-frame.js';
import { mountAuthorNativeScriptButtons } from './author-native-script-buttons.js';
import { AUTHOR_NATIVE_EVENTS_V1, authorNativeNamespaceCauseV1 } from '../core/author-native-origin.js';
import { createAuthorBrowserOrdinaryPendingStore, sameOrdinarySource } from './author-browser-ordinary-pending.js';
import { createAuthorNativeMessageVariables } from '../core/author-native-message-variables.js';
import { prepareOrdinaryAuthorChatBatchV3 } from '../core/roleplay-author-chat-state-types.js';
import { createAuthorBrowserPendingStore, terminalBrowserReceipt, worldbookPendingRetryLocator, worldbookPendingBlocksNamespace } from './author-browser-pending.js';
import { readerRegexDocumentTransportV1 } from './reader-regex-document-session.js';
export const authorBrowserTransport = async (request, signal) => {
    const response = await fetch('/api/roleplay/author-browser', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request), signal });
    const reply = await response.json();
    if (!response.ok || !reply.ok)
        throw Error(reply.ok ? 'BROWSER_TRANSPORT_FAILED' : reply.code);
    return reply;
};
const sameBinding = (a, b) => a?.generation === b.generation && a.browserSessionId === b.browserSessionId;
/** Core owns captures and durable writes. This session owns native windows,
 * the live callback registry, and waits that end when their bridge is closed. */
export function createAuthorBrowserSession(options) {
    const transport = async (request, signal) => {
        const reply = await (options.transport ?? authorBrowserTransport)(request, signal);
        if (!reply.ok)
            throw Error(reply.code);
        return reply;
    };
    const store = createAuthorBrowserPendingStore(options.storage ?? localStorage);
    const ordinaryStore = createAuthorBrowserOrdinaryPendingStore(options.storage ?? localStorage);
    let active = true, ready = false, binding;
    let owner, captured, currentSnapshotScope = '';
    let activeGeneration, activeGenerationScope = '';
    let activeFilter;
    let refreshing, refreshAgain = false, checking;
    let generationWait, generationExecuting = false, sequence = 0;
    let canonicalRevision = 0, lastStatus = { kind: 'loading' };
    let buttons;
    const realms = new Map(), registrations = [];
    const recoveries = new Map();
    const current = () => active && options.current();
    const preparation = (value) => options.preparation?.(value);
    const hasFrame = () => realms.size > 0;
    function notify(value = lastStatus) {
        if (!current())
            return;
        const pending = store.read(options.sessionId);
        lastStatus = { ...value, pending: pending?.state === 'terminal' ? undefined : pending,
            worldbooks: store.readWorldbooks(options.sessionId), personas: store.readPersonas(options.sessionId),
            ordinary: ordinaryStore.readHelper(options.sessionId), opening: store.readOpening(options.sessionId),
            messageBodies: store.readBodies(options.sessionId) };
        options.status(lastStatus);
    }
    const release = (target) => { void transport({ action: 'dispose', binding: target }).catch(() => { }); };
    function revoke() {
        buttons?.dispose();
        buttons = undefined;
        generationWait?.abort();
        generationWait = undefined;
        generationExecuting = false;
        activeGeneration = undefined;
        activeGenerationScope = '';
        activeFilter = undefined;
        owner = undefined;
        ready = false;
        captured = undefined;
        currentSnapshotScope = '';
        for (const row of realms.values())
            row.controller?.dispose();
        realms.clear();
        registrations.length = 0;
        options.container.replaceChildren();
        if (binding)
            release(binding);
        binding = undefined;
    }
    function realmSnapshot(snapshot, realmId) {
        const { realmScripts, ...context } = snapshot.context ?? {};
        return { ...snapshot, context: { ...context, script: realmScripts?.[realmId] } };
    }
    function dispatch(event, args) {
        for (const row of realms.values())
            row.controller?.dispatchEvent(event, args);
    }
    function publish(snapshot) {
        const previous = captured, sameRevision = previous?.generation === snapshot.generation
            && previous.readRevision === snapshot.readRevision;
        if (!sameRevision || !currentSnapshotScope)
            currentSnapshotScope = crypto.randomUUID();
        const scope = currentSnapshotScope;
        captured = snapshot;
        for (const row of realms.values())
            row.controller?.updateSnapshot(realmSnapshot(snapshot, row.realmId), scope);
        if (!previous)
            return;
        const before = new Map(previous.messages.map(row => [row.messageId, row]));
        for (const row of snapshot.messages) {
            const old = before.get(row.messageId);
            if (!old)
                dispatch(row.role === 'user' ? AUTHOR_NATIVE_EVENTS_V1.MESSAGE_SENT : AUTHOR_NATIVE_EVENTS_V1.MESSAGE_RECEIVED, [row.index]);
            else if (old.message !== row.message)
                dispatch(AUTHOR_NATIVE_EVENTS_V1.MESSAGE_UPDATED, [row.index]);
        }
        // A changed projection establishes message changes, never Reader DOM
        // render completion. Render events require the actual Reader owner.
    }
    function readBasis(scope) {
        if (activeFilter && scope === activeFilter.readScope)
            return { snapshot: activeFilter.snapshot,
                read: { kind: 'generation', invocationId: activeFilter.invocationId } };
        if (currentSnapshotScope && scope === currentSnapshotScope && captured)
            return { snapshot: captured,
                read: { kind: 'snapshot', readRevision: captured.readRevision } };
        if (activeGenerationScope && scope === activeGenerationScope && activeGeneration)
            return { snapshot: activeGeneration.snapshot,
                read: { kind: 'generation', invocationId: activeGeneration.invocationId } };
        throw Error('AUTHOR_NATIVE_READ_BASIS_CHANGED');
    }
    function adopt(snapshot, expectedOwner) {
        if (!current() || owner !== expectedOwner)
            return;
        canonicalRevision++;
        if (snapshot) {
            if (snapshot.readRevision !== captured?.readRevision || snapshot.generation !== captured.generation)
                activeGenerationScope = '';
            publish(snapshot);
        }
        else {
            // The receipt is still canonical. Without new DATA, the previous
            // read cannot authorize another write; refresh after its ACK.
            currentSnapshotScope = '';
            activeGenerationScope = '';
            void refresh();
        }
    }
    function response(value, realmId) {
        return { value, ...captured && currentSnapshotScope ? { snapshot: realmSnapshot(captured, realmId), readScope: currentSnapshotScope } : {} };
    }
    function record(run, code = 'BROWSER_PENDING_STORE_FAILED') {
        try {
            run();
        }
        catch {
            return code;
        }
    }
    const acknowledge = (envelope) => record(() => ordinaryStore.acknowledge(envelope), 'AUTHOR_CHAT_ACK_LOCAL_RECORD_PENDING');
    const unknown = (envelope, code) => record(() => ordinaryStore.unknown(envelope, code), 'AUTHOR_CHAT_OUTBOX_UPDATE_FAILED');
    function registryRequest(row, request) {
        if (request.operation === 'generation-listener-add') {
            const data = request.payload.registration;
            if (![AUTHOR_NATIVE_EVENTS_V1.GENERATION_AFTER_COMMANDS, 'mag_command_parsed',
                'mag_variable_update_ended', 'mag_before_message_update'].includes(data.event))
                return true;
            const index = registrations.findIndex(value => value.realmId === row.realmId && value.callbackId === data.callbackId);
            const existing = index < 0 ? undefined : registrations.splice(index, 1)[0];
            const registration = { ...(existing ?? data), realmId: row.realmId, resource: existing?.resource ?? row.resource,
                makeFirst: data.makeFirst, order: ++sequence };
            if (data.makeFirst)
                registrations.unshift(registration);
            else
                registrations.push(registration);
        }
        else if (request.operation === 'generation-listener-remove') {
            const { callbackId } = request.payload;
            const index = registrations.findIndex(value => value.realmId === row.realmId && value.callbackId === callbackId);
            if (index >= 0)
                registrations.splice(index, 1);
        }
        else
            return false;
        if (!generationExecuting)
            generationWait?.abort();
        return true;
    }
    function navigateCommitted(row, result, expectedOwner) {
        if (result.kind !== 'committed' || !result.navigation || !options.navigate)
            return;
        const destination = result.navigation.sessionId;
        // Return the Host reply first. Navigation observes the actual native
        // ACK; waiting inside the request would wait for its own return.
        void (async () => {
            try {
                await row.controller.waitForAdmittedSourceWrites();
                if (current() && owner === expectedOwner)
                    await options.navigate(destination);
            }
            catch {
                notify({ ...lastStatus, code: 'AUTHOR_NATIVE_ACK_UNOBSERVED' });
            }
        })();
    }
    function createHost(expectedOwner, target, program) {
        return { async request(address, request, _signal) {
                if (!current() || owner !== expectedOwner || !sameBinding(binding, target))
                    throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
                const row = realms.get(address.realmId);
                if (registryRequest(row, request))
                    return {};
                const data = request.payload;
                if (request.operation === 'mutate-prompts') {
                    const reply = await transport({ action: 'mutate-prompts', binding: target,
                        request: { operationId: request.operationId, realmId: row.realmId, resource: row.resource, mutation: data.mutation } }, _signal);
                    if (reply.kind !== 'prompts-mutated')
                        throw Error('AUTHOR_NATIVE_INJECTION_UNAVAILABLE');
                    adopt(reply.snapshot, expectedOwner);
                    return { value: { retiredFilterCallbackIds: reply.retiredFilterCallbackIds ?? [] } };
                }
                if (request.operation === 'composer') {
                    const composer = options.composer;
                    if (!composer)
                        throw Error('AUTHOR_NATIVE_COMPOSER_UNAVAILABLE');
                    if (data.action === 'get')
                        return { value: composer.read() };
                    composer.overwrite(data.value);
                    composer.dispatch('input');
                    return {};
                }
                if (request.operation === 'generate-raw') {
                    const reply = await transport({ action: 'generate-raw', binding: target,
                        request: { realmId: row.realmId, options: data.options, operationId: request.operationId } });
                    if (reply.kind !== 'generated')
                        throw Error('BROWSER_NATIVE_TASK_UNAVAILABLE');
                    return { value: reply.result };
                }
                if (request.operation === 'execute-commands') {
                    const reply = await transport({ action: 'execute-commands', binding: target, realmId: row.realmId,
                        request: { operationId: request.operationId, command: data.command } }, _signal);
                    if (reply.kind !== 'commands-executed')
                        throw Error('AUTHOR_NATIVE_COMMAND_ACK_UNKNOWN');
                    adopt(reply.snapshot, expectedOwner);
                    return response(reply.result, row.realmId);
                }
                if (request.operation === 'resource-read') {
                    const script = realmSnapshot(captured, row.realmId).context?.script;
                    if (!script)
                        throw Error('AUTHOR_SCRIPT_RESOURCE_UNAVAILABLE');
                    const resource = data.resource;
                    const operation = resource?.kind === 'self-script-data'
                        ? { kind: 'self-script-data' } : resource?.kind === 'script-data'
                        ? { kind: 'explicit-script-data', scriptId: resource.identity } : resource === 'script-id'
                        ? { kind: 'script-id' } : { kind: 'script-trees', scope: resource };
                    const reply = await transport({ action: 'read-source-resource', binding: target, request: {
                            schemaVersion: 1, encoding: 'native-author-script-resource-request-v1', realmId: row.realmId,
                            scriptIdentity: script.identity, descriptorSha256: script.descriptorSha256,
                            sourceSnapshotSha256: script.sourceSnapshotSha256, operation
                        } });
                    if (reply.kind !== 'source-resource')
                        throw Error('AUTHOR_SCRIPT_RESOURCE_UNAVAILABLE');
                    return { value: reply.value };
                }
                const basis = readBasis(request.readScope);
                if (request.operation === 'message-body') {
                    const selected = createAuthorNativeMessageVariables(basis.snapshot).normalizeBodyRows(data.rows);
                    if (!selected || selected.message.variants)
                        throw Error('AUTHOR_NATIVE_MESSAGE_BODY_TARGET_UNAVAILABLE');
                    const message = selected.message, wire = { schemaVersion: 1,
                        operationId: request.operationId, readRevision: basis.snapshot.readRevision,
                        expected: { sessionId: basis.snapshot.basis.sessionId, seq: message.nativeSeq, messageId: message.messageId,
                            role: message.role, messageVersionSha256: message.messageVersionSha256 },
                        text: selected.text, refresh: data.refresh };
                    const envelope = store.beginBody(target, program.programSha256, row.realmId, wire);
                    notify({ kind: 'pending' });
                    let result;
                    try {
                        const reply = await transport({ action: 'mutate-message-body', binding: target, realmId: row.realmId,
                            read: basis.read, request: envelope.request }, _signal);
                        if (reply.kind !== 'message-body-mutated')
                            throw Error('AUTHOR_NATIVE_MESSAGE_BODY_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        const code = error instanceof Error ? error.message : 'AUTHOR_NATIVE_MESSAGE_BODY_ACK_UNKNOWN', warning = record(() => store.recordBody(envelope, undefined, code));
                        revoke();
                        notify({ kind: 'pending', code: warning ?? code });
                        throw error;
                    }
                    const warning = record(() => store.recordBody(envelope, result.result));
                    adopt(result.snapshot, expectedOwner);
                    if (result.result.kind === 'unknown')
                        revoke();
                    notify({ kind: result.result.kind === 'unknown' ? 'pending' : ready ? 'ready' : 'starting',
                        code: warning ?? ('code' in result.result ? result.result.code : undefined) });
                    return response(result.result, row.realmId);
                }
                if (request.operation === 'mutate-author-namespace') {
                    const self = basis.snapshot.context?.realmScripts?.[row.realmId];
                    const capture = data.selector?.type === 'script' ? self?.ordinary : data.selector ? createAuthorNativeMessageVariables(basis.snapshot)
                        .resolve(data.selector, true).capture : basis.snapshot.ordinaryChat;
                    if (!capture)
                        throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
                    const envelope = ordinaryStore.begin(target, prepareOrdinaryAuthorChatBatchV3(capture.root, data.nextVariables, request.operationId, authorNativeNamespaceCauseV1(program.programSha256, row)));
                    notify({ kind: 'pending' });
                    let result;
                    try {
                        const reply = await transport({ action: 'mutate-author-namespace', binding: target, request: {
                                realmId: row.realmId, operationId: request.operationId, read: basis.read, nextVariables: data.nextVariables,
                                ...data.selector ? { selector: data.selector } : {}
                            } });
                        if (reply.kind !== 'author-namespace-mutated')
                            throw Error('AUTHOR_CHAT_WRITE_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        const code = error instanceof Error ? error.message : 'AUTHOR_CHAT_WRITE_ACK_UNKNOWN';
                        const warning = unknown(envelope, code);
                        revoke();
                        notify({ kind: 'pending', code: warning ?? code });
                        throw error;
                    }
                    const warning = acknowledge(envelope);
                    adopt(result.snapshot, expectedOwner);
                    notify({ kind: ready ? 'ready' : 'starting', code: warning });
                    return response(result.reply, row.realmId);
                }
                if (request.operation === 'numerical-replace') {
                    const envelope = store.begin(target, { requestId: ++sequence, generation: target.generation,
                        readRevision: basis.snapshot.readRevision, realmId: row.realmId, values: data.values, expected: data.expected,
                        ...data.target ? { target: data.target } : {} }, request.operationId);
                    notify({ kind: 'pending' });
                    let result;
                    try {
                        const reply = await transport({ action: 'save', binding: target, request: envelope.origin.child, operation: envelope.operation });
                        if (reply.kind !== 'saved')
                            throw Error('BROWSER_SAVE_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        record(() => store.record(envelope));
                        revoke();
                        notify({ kind: 'pending', code: 'BROWSER_SAVE_ACK_UNKNOWN' });
                        throw error;
                    }
                    const warning = record(() => store.record(envelope, result.result));
                    adopt(result.snapshot, expectedOwner);
                    for (const event of result.sourceEvents ?? [])
                        dispatch(event.type, event.args);
                    notify({ kind: terminalBrowserReceipt(result.result) ? ready ? 'ready' : 'starting' : 'pending', code: warning ?? result.result.code });
                    return response(result.result, row.realmId);
                }
                if (request.operation === 'worldbook-mutate') {
                    const wire = { ...data, realmId: row.realmId, operationId: request.operationId };
                    const book = basis.snapshot.worldbook;
                    if (!book || book.schemaVersion !== 2 || book.dataSha256 !== wire.expectedDataSha256)
                        throw Error('AUTHOR_WORLDBOOK_STALE_BASE');
                    const envelope = store.beginWorldbook(target, wire, book.identitySha256);
                    notify();
                    let result;
                    try {
                        const reply = await transport({ action: 'mutate-worldbook', binding: target, request: wire });
                        if (reply.kind !== 'worldbook-mutated')
                            throw Error('AUTHOR_WORLDBOOK_MUTATION_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        record(() => store.recordWorldbook(envelope, undefined, String(error)));
                        revoke();
                        notify({ kind: 'pending' });
                        throw error;
                    }
                    const warning = record(() => store.recordWorldbook(envelope, result.reply.result));
                    adopt(result.reply.snapshot, expectedOwner);
                    notify({ ...lastStatus, code: warning });
                    return response(result.reply, row.realmId);
                }
                if (request.operation === 'persona-mutate') {
                    const wire = { ...data, realmId: row.realmId, operationId: request.operationId };
                    const envelope = store.beginPersona(target, wire);
                    notify();
                    let result;
                    try {
                        const reply = await transport({ action: 'mutate-persona', binding: target, request: wire });
                        if (reply.kind !== 'persona-mutated')
                            throw Error('NATIVE_PERSONA_MUTATION_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        record(() => store.recordPersona(envelope, undefined, String(error)));
                        revoke();
                        notify({ kind: 'pending' });
                        throw error;
                    }
                    const warning = record(() => store.recordPersona(envelope, result.reply.result));
                    adopt(result.reply.snapshot, expectedOwner);
                    notify({ ...lastStatus, code: warning });
                    return response(result.reply, row.realmId);
                }
                if (request.operation === 'opening-variants') {
                    const envelope = store.beginOpening(target, row.realmId, { operationId: request.operationId,
                        readRevision: basis.snapshot.readRevision, rows: data.rows, refresh: data.refresh });
                    notify();
                    let result;
                    try {
                        const reply = await transport({ action: 'mutate-opening-variants', binding: target, realmId: row.realmId,
                            read: basis.read, request: envelope.request });
                        if (reply.kind !== 'opening-variants-mutated')
                            throw Error('READER_WRITE_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        record(() => store.recordOpening(envelope));
                        revoke();
                        notify({ kind: 'pending', code: 'READER_WRITE_ACK_UNKNOWN' });
                        throw error;
                    }
                    const warning = record(() => store.recordOpening(envelope, result.result));
                    adopt(result.snapshot, expectedOwner);
                    notify({ ...lastStatus, code: warning });
                    navigateCommitted(row, result.result, expectedOwner);
                    return response(result.result, row.realmId);
                }
                throw Error('AUTHOR_NATIVE_OPERATION_UNSUPPORTED');
            } };
    }
    async function executeMvuHook(challenge, target, signal) {
        let request = challenge.request;
        const callbackIds = [], diagnostics = [];
        const resultOf = (input) => {
            if (input.stage === 'command-parsed')
                return { stage: input.stage,
                    output: { variables: input.payload.variables, commands: input.payload.commands }, diagnostics };
            if (input.stage === 'update-ended')
                return { stage: input.stage, output: { variables: input.payload.variables }, diagnostics };
            return { stage: input.stage, output: { context: input.payload.context }, diagnostics };
        };
        try {
            for (const callback of challenge.registrations) {
                if (!registrations.some(row => row.callbackId === callback.callbackId && row.realmId === callback.realmId))
                    continue;
                const row = realms.get(callback.realmId);
                const output = await row.controller.invokeMvuHook({ invocationId: challenge.invocationId,
                    request, callbackIds: [callback.callbackId] }, signal);
                callbackIds.push(...output.callbackIds);
                diagnostics.push(...output.result.diagnostics);
                if (request.stage === 'command-parsed' && output.result.stage === 'command-parsed')
                    request = { ...request, payload: { ...request.payload, ...output.result.output } };
                else if (request.stage === 'update-ended' && output.result.stage === 'update-ended')
                    request = { ...request, payload: { ...request.payload, ...output.result.output } };
                else if (request.stage === 'before-message-update' && output.result.stage === 'before-message-update')
                    request = { ...request, payload: output.result.output };
                else
                    throw Error('AUTHOR_NATIVE_MVU_HOOK_OUTPUT_CHANGED');
            }
            return { kind: 'executed', binding: target, invocationId: challenge.invocationId, callbackIds, result: resultOf(request) };
        }
        catch (error) {
            return { kind: 'refused', binding: target, invocationId: challenge.invocationId,
                code: error instanceof Error ? error.message : 'AUTHOR_NATIVE_MVU_HOOK_FAILED' };
        }
    }
    async function generationLoop(expectedOwner, target) {
        while (current() && owner === expectedOwner) {
            const wait = new AbortController();
            generationWait = wait;
            try {
                const challenge = transport({ action: 'generation-wait', binding: target, registrations: [...registrations] }, wait.signal);
                // Start admission before releasing the Reader's send handoff;
                // awaiting the challenge itself would deadlock that send.
                preparation({ kind: 'waiting' });
                const reply = await challenge;
                if (reply.kind !== 'generation-invocation')
                    throw Error('BROWSER_GENERATION_WAIT_FAILED');
                if (!current() || owner !== expectedOwner || wait.signal.aborted)
                    return;
                if (reply.invocation.encoding === 'author-native-injection-filter-retired-v1') {
                    const message = reply.invocation, row = realms.get(message.realmId);
                    if (row && row.resource.pageId === message.resource.pageId)
                        row.controller.retireFilterCallbacks(message.ids);
                    continue;
                }
                if (reply.invocation.encoding === 'author-native-injection-filter-invocation-v1') {
                    const call = reply.invocation, row = realms.get(call.realmId);
                    generationExecuting = true;
                    activeFilter = call;
                    let result;
                    try {
                        if (!row || row.resource.pageId !== call.resource.pageId)
                            throw Error('AUTHOR_NATIVE_INJECTION_FILTER_SOURCE_CHANGED');
                        row.controller.updateSnapshot(realmSnapshot(call.snapshot, row.realmId), call.readScope);
                        const accepted = await row.controller.invokeFilter(call, wait.signal);
                        await row.controller.waitForAdmittedSourceWrites();
                        result = { binding: target, invocationId: call.invocationId, operationId: call.operationId, kind: 'executed', accepted };
                    }
                    catch (error) {
                        result = { binding: target, invocationId: call.invocationId, operationId: call.operationId,
                            kind: 'refused', code: error instanceof Error ? error.message : 'AUTHOR_NATIVE_INJECTION_FILTER_FAILED' };
                    }
                    finally {
                        activeFilter = undefined;
                        if (captured && row)
                            row.controller.updateSnapshot(realmSnapshot(captured, row.realmId), currentSnapshotScope);
                    }
                    if (!current() || owner !== expectedOwner)
                        return;
                    await transport({ action: 'filter-complete', binding: target, result }, wait.signal);
                    continue;
                }
                if (reply.invocation.encoding === 'author-native-mvu-hook-invocation-v1') {
                    generationExecuting = true;
                    const result = await executeMvuHook(reply.invocation, target, wait.signal);
                    if (!current() || owner !== expectedOwner)
                        return;
                    await transport({ action: 'mvu-hook-complete', binding: target, result }, wait.signal);
                    continue;
                }
                generationExecuting = true;
                activeGeneration = reply.invocation;
                activeGenerationScope = crypto.randomUUID();
                if (captured?.readRevision !== reply.invocation.snapshot.readRevision
                    || captured.generation !== reply.invocation.snapshot.generation)
                    currentSnapshotScope = crypto.randomUUID();
                captured = reply.invocation.snapshot;
                // Install the challenge once. Subsequent callback invocations
                // retain any preceding callback's canonical ACK and fresh DATA.
                for (const row of realms.values())
                    row.controller.updateSnapshot(realmSnapshot(reply.invocation.snapshot, row.realmId), activeGenerationScope);
                const executed = [], effects = [];
                let result;
                try {
                    for (const callback of reply.invocation.registrations) {
                        if (!registrations.some(row => row.callbackId === callback.callbackId && row.realmId === callback.realmId))
                            continue;
                        const row = realms.get(callback.realmId);
                        const output = await row.controller.invokeGeneration({ invocationId: reply.invocation.invocationId,
                            event: AUTHOR_NATIVE_EVENTS_V1.GENERATION_AFTER_COMMANDS, args: [], callbackIds: [callback.callbackId] }, wait.signal);
                        await row.controller.waitForAdmittedSourceWrites();
                        executed.push(...output.callbackIds);
                        effects.push(...output.effects);
                    }
                    result = { kind: 'executed', binding: target, invocationId: reply.invocation.invocationId,
                        result: { invocationId: reply.invocation.invocationId, callbackIds: executed, effects } };
                }
                catch (error) {
                    result = { kind: 'refused', binding: target, invocationId: reply.invocation.invocationId,
                        diagnostics: [{ code: error instanceof Error ? error.message : 'AUTHOR_NATIVE_GENERATION_FAILED' }] };
                }
                finally {
                    activeGeneration = undefined;
                    activeGenerationScope = '';
                    if (captured)
                        for (const row of realms.values())
                            row.controller.updateSnapshot(realmSnapshot(captured, row.realmId), currentSnapshotScope);
                }
                if (!current() || owner !== expectedOwner)
                    return;
                await transport({ action: 'generation-complete', binding: target, result }, wait.signal);
            }
            catch (error) {
                if (!current() || owner !== expectedOwner)
                    return;
                if (wait.signal.aborted)
                    continue;
                const code = error instanceof Error ? error.message : 'BROWSER_GENERATION_WAIT_FAILED';
                if (code === 'BROWSER_GENERATION_RESOURCE_RETIRED' || code === 'BROWSER_GENERATION_INVOCATION_REVOKED')
                    continue;
                preparation({ kind: 'failed', code });
                notify({ kind: 'ready', code });
                return;
            }
            finally {
                if (generationWait === wait) {
                    generationWait = undefined;
                    generationExecuting = false;
                }
            }
        }
    }
    async function refreshOnce() {
        const pending = store.read(options.sessionId), opening = store.readOpening(options.sessionId);
        if (!hasFrame() && (pending && pending.state !== 'terminal' || opening && opening.state !== 'terminal' && !opening.manualReleased
            || store.readPersonas(options.sessionId).some(row => row.state !== 'terminal'))) {
            preparation({ kind: 'blocked', code: '作者操作尚未确认，请先处理阅读视图中的提示。' });
            notify({ kind: 'pending' });
            return;
        }
        const beforeWrite = canonicalRevision, oldBinding = binding, beforeOwner = owner;
        const reply = await transport({ action: 'attach', sessionId: options.sessionId, ...oldBinding ? { binding: oldBinding } : {} });
        await Promise.all([...realms.values()].map(row => row.controller.waitForAdmittedSourceWrites()));
        if (!current()) {
            if (reply.kind === 'attached')
                release(reply.attachment.binding);
            return;
        }
        if (owner !== beforeOwner || binding !== oldBinding) {
            if (reply.kind === 'attached' && !sameBinding(binding, reply.attachment.binding))
                release(reply.attachment.binding);
            refreshAgain = true;
            return;
        }
        if (reply.kind === 'inactive') {
            revoke();
            preparation({ kind: 'not-required' });
            notify({ kind: 'inactive', code: reply.code });
            return;
        }
        if (reply.kind !== 'attached')
            throw Error('BROWSER_ATTACHMENT_UNAVAILABLE');
        let attachment = reply.attachment;
        if (canonicalRevision !== beforeWrite) {
            if (sameBinding(binding, attachment.binding) && captured)
                attachment = { ...attachment, snapshot: captured };
            else {
                const fresh = await transport({ action: 'capture', binding: attachment.binding });
                if (fresh.kind !== 'snapshot') {
                    release(attachment.binding);
                    throw Error('BROWSER_SNAPSHOT_UNAVAILABLE');
                }
                attachment = { ...attachment, snapshot: fresh.snapshot };
            }
        }
        if (ordinaryStore.readHelper(options.sessionId).some(row => !row.manualReleased && sameOrdinarySource(row.operation, { namespace: attachment.snapshot.ordinaryChat.root.namespace }))) {
            const previous = binding;
            revoke();
            if (!sameBinding(previous, attachment.binding))
                release(attachment.binding);
            preparation({ kind: 'blocked', code: '作者变量保存尚未确认，请先确认或恢复原操作。' });
            notify({ kind: 'pending' });
            return;
        }
        if (store.readBodies(options.sessionId).some(row => row.state !== 'terminal'
            && row.sourceProgramSha256 === attachment.program.programSha256)) {
            const previous = binding;
            revoke();
            if (!sameBinding(previous, attachment.binding))
                release(attachment.binding);
            preparation({ kind: 'blocked', code: '正文保存尚未确认，请先确认或恢复原操作。' });
            notify({ kind: 'pending' });
            return;
        }
        if (sameBinding(binding, attachment.binding) && hasFrame()) {
            publish(attachment.snapshot);
            notify({ kind: ready ? 'ready' : 'starting' });
            return;
        }
        const book = attachment.snapshot.worldbook;
        if (store.readWorldbooks(options.sessionId).some(row => worldbookPendingBlocksNamespace(row, book?.schemaVersion === 2 ? book.identitySha256 : undefined))) {
            const previous = binding;
            revoke();
            if (!sameBinding(previous, attachment.binding))
                release(attachment.binding);
            preparation({ kind: 'blocked', code: '世界书操作尚未确认，请先处理阅读视图中的提示。' });
            notify({ kind: 'pending' });
            return;
        }
        // A same binding without a frame is still retained by Core. Do not
        // dispose it while mounting the new native windows for that binding.
        if (sameBinding(binding, attachment.binding))
            binding = undefined;
        revoke();
        binding = attachment.binding;
        captured = attachment.snapshot;
        const expectedOwner = {};
        owner = expectedOwner;
        currentSnapshotScope = crypto.randomUUID();
        const target = binding, host = createHost(expectedOwner, target, attachment.program), controllers = [];
        notify({ kind: 'starting' });
        preparation({ kind: 'starting' });
        try {
            for (const address of attachment.program.realms) {
                if (!attachment.program.scripts.some(script => script.enabled && script.realmId === address.realmId))
                    continue;
                const row = { ...address, resource: { browserSessionId: target.browserSessionId,
                        generation: target.generation, pageId: crypto.randomUUID() } };
                realms.set(address.realmId, row);
                const controller = (options.createFrame ?? createAuthorNativeHelperFrame)(options.container, attachment.program, address, { snapshot: realmSnapshot(captured, address.realmId), readScope: currentSnapshotScope }, host, {
                    parentOrigin: attachment.parentOrigins[address.groupId], resource: row.resource,
                    documentLayout: options.documentLayout, libraries: options.nativeLibraries,
                    current: () => current() && owner === expectedOwner && sameBinding(binding, target),
                    failed: code => { if (current() && owner === expectedOwner) {
                        preparation({ kind: 'failed', code });
                        notify({ kind: 'failed', code });
                    } },
                });
                row.controller = controller;
                controllers.push(controller);
            }
            await Promise.all(controllers.map(controller => controller.started));
            await Promise.all(controllers.map(controller => controller.waitForAdmittedSourceWrites()));
        }
        catch (error) {
            if (owner === expectedOwner)
                revoke();
            throw error;
        }
        if (!current() || owner !== expectedOwner)
            return;
        buttons = mountAuthorNativeScriptButtons(options.container, attachment.program.scripts, {
            current: () => current() && owner === expectedOwner,
            dispatch: (realmId, event) => realms.get(realmId)?.controller?.dispatchEvent(event, []),
        });
        ready = true;
        notify({ kind: 'ready' });
        void generationLoop(expectedOwner, target);
    }
    function refresh() {
        if (!current())
            return Promise.resolve();
        refreshAgain = true;
        if (refreshing)
            return refreshing;
        refreshing = (async () => {
            try {
                while (current() && refreshAgain) {
                    refreshAgain = false;
                    await refreshOnce();
                }
            }
            catch (error) {
                const code = error instanceof Error ? error.message : String(error);
                preparation({ kind: 'failed', code });
                notify({ kind: 'failed', code });
            }
            finally {
                refreshing = undefined;
            }
        })();
        return refreshing;
    }
    function recovery(key, work) {
        const running = recoveries.get(key);
        if (running)
            return running;
        const result = work().finally(() => recoveries.delete(key));
        recoveries.set(key, result);
        return result;
    }
    function confirm(retry = false) {
        if (checking)
            return checking;
        checking = (async () => {
            try {
                const envelope = store.read(options.sessionId);
                if (envelope && envelope.state !== 'terminal') {
                    const reply = await transport({ action: retry ? 'retry' : 'confirm', operation: envelope.operation });
                    if (reply.kind !== 'saved' && reply.kind !== 'confirmed')
                        throw Error('BROWSER_SAVE_ACK_UNKNOWN');
                    const warning = record(() => store.record(envelope, reply.result));
                    notify({ kind: terminalBrowserReceipt(reply.result) ? 'loading' : 'pending', code: warning ?? reply.result.code });
                    if (!terminalBrowserReceipt(reply.result))
                        return;
                    revoke();
                }
                for (const operation of ordinaryStore.readHelper(options.sessionId))
                    if (!operation.manualReleased)
                        await ordinaryRecovery(operation.operation.operationId, false, false);
                for (const operation of store.readBodies(options.sessionId))
                    if (operation.state !== 'terminal')
                        await messageBodyRecovery(operation.request.operationId, false, false);
                await refresh();
            }
            catch (error) {
                notify({ kind: 'pending', code: error instanceof Error ? error.message : String(error) });
            }
        })().finally(() => { checking = undefined; });
        return checking;
    }
    function ordinaryRecovery(operationId, retry, refreshAfter = true) {
        return recovery('ordinary:' + operationId, async () => {
            const envelope = ordinaryStore.readHelper(options.sessionId).find(row => row.operation.operationId === operationId);
            if (!envelope)
                return;
            let replacement;
            try {
                let warning;
                if (retry) {
                    const attached = await transport({ action: 'attach', sessionId: options.sessionId });
                    if (attached.kind !== 'attached')
                        throw Error('AUTHOR_CHAT_RECOVERY_SOURCE_UNAVAILABLE');
                    replacement = attached.attachment.binding;
                    const operation = envelope.operation, cause = operation.cause, program = attached.attachment.program;
                    if (!sameOrdinarySource(operation, { namespace: attached.attachment.snapshot.ordinaryChat.root.namespace })
                        || cause.encoding !== 'author-native-namespace-cause-v1' || cause.programSha256 !== program.programSha256
                        || !program.realms.some(row => row.realmId === cause.realmId && row.groupId === cause.groupId))
                        throw Error('AUTHOR_CHAT_RECOVERY_SOURCE_CHANGED');
                    const reply = await transport({ action: 'retry-author-namespace', binding: replacement, realmId: cause.realmId, operation });
                    if (reply.kind !== 'author-namespace-mutated')
                        throw Error('AUTHOR_CHAT_WRITE_ACK_UNKNOWN');
                    warning = acknowledge(envelope);
                }
                else {
                    const reply = await transport({ action: 'confirm-author-namespace', sessionId: options.sessionId, operation: envelope.operation });
                    if (reply.kind !== 'author-namespace-confirmed')
                        throw Error('AUTHOR_CHAT_RECEIPT_UNAVAILABLE');
                    warning = reply.receipt.kind === 'applied' ? acknowledge(envelope)
                        : unknown(envelope, reply.receipt.kind === 'pending' ? 'AUTHOR_CHAT_RECEIPT_PENDING' : 'AUTHOR_CHAT_RECEIPT_UNCONFIRMED');
                }
                notify({ ...lastStatus, code: warning });
            }
            catch (error) {
                const code = error instanceof Error ? error.message : 'AUTHOR_CHAT_RECEIPT_UNAVAILABLE';
                notify({ kind: 'pending', code: unknown(envelope, code) ?? code });
            }
            finally {
                if (replacement && !sameBinding(binding, replacement))
                    release(replacement);
            }
            if (refreshAfter)
                await refresh();
        });
    }
    function messageBodyRecovery(operationId, retry, refreshAfter = true) {
        return recovery('message-body:' + operationId, async () => {
            const envelope = store.readBodies(options.sessionId).find(row => row.request.operationId === operationId);
            if (!envelope || envelope.state === 'terminal')
                return;
            let replacement;
            try {
                let result;
                if (retry) {
                    const attached = await transport({ action: 'attach', sessionId: options.sessionId });
                    if (attached.kind !== 'attached')
                        throw Error('AUTHOR_NATIVE_MESSAGE_BODY_SOURCE_UNAVAILABLE');
                    replacement = attached.attachment.binding;
                    const program = attached.attachment.program;
                    if (program.programSha256 !== envelope.sourceProgramSha256
                        || !program.realms.some(row => row.realmId === envelope.realmId))
                        throw Error('AUTHOR_NATIVE_MESSAGE_BODY_SOURCE_CHANGED');
                    const reply = await transport({ action: 'retry-message-body', binding: replacement, realmId: envelope.realmId,
                        sourceProgramSha256: envelope.sourceProgramSha256, request: envelope.request });
                    if (reply.kind !== 'message-body-mutated')
                        throw Error('AUTHOR_NATIVE_MESSAGE_BODY_ACK_UNKNOWN');
                    result = reply;
                }
                else {
                    const reply = await transport({ action: 'confirm-message-body', sessionId: options.sessionId, operationId });
                    if (reply.kind !== 'message-body-confirmed')
                        throw Error('AUTHOR_NATIVE_MESSAGE_BODY_ACK_UNKNOWN');
                    result = reply;
                }
                const warning = record(() => store.recordBody(envelope, result.result));
                notify({ ...lastStatus, code: warning ?? ('code' in result.result ? result.result.code : undefined) });
            }
            catch (error) {
                const code = error instanceof Error ? error.message : 'AUTHOR_NATIVE_MESSAGE_BODY_ACK_UNKNOWN', warning = record(() => store.recordBody(envelope, undefined, code));
                notify({ kind: 'pending', code: warning ?? code });
            }
            finally {
                if (replacement && !sameBinding(binding, replacement))
                    release(replacement);
            }
            if (refreshAfter)
                await refresh();
        });
    }
    function retryWorldbook(operationId) {
        return recovery('worldbook:' + operationId, async () => {
            const envelope = store.readWorldbooks(options.sessionId).find(row => row.operationId === operationId);
            if (!envelope || envelope.state === 'terminal')
                return;
            try {
                const locator = worldbookPendingRetryLocator(envelope);
                const reply = await transport({ action: 'retry-worldbook', sessionId: options.sessionId, operationId, ...locator ? { locator } : {} });
                if (reply.kind !== 'worldbook-retried')
                    throw Error('AUTHOR_WORLDBOOK_MUTATION_ACK_UNKNOWN');
                const code = reply.result.kind === 'refused' && reply.result.diagnostics.some(row => row.code === 'OPERATION_NOT_RECORDED')
                    ? 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED' : undefined;
                store.recordWorldbook(envelope, reply.result, code);
                if (sameBinding(binding, envelope.binding))
                    revoke();
                notify(hasFrame() ? lastStatus : { kind: 'failed', code: 'BROWSER_GENERATION_REVOKED' });
            }
            catch (error) {
                store.recordWorldbook(envelope, undefined, String(error));
                notify();
            }
        });
    }
    function retryPersona(operationId) {
        return recovery('persona:' + operationId, async () => {
            const envelope = store.readPersonas(options.sessionId).find(row => row.operationId === operationId);
            if (!envelope || envelope.state === 'terminal')
                return;
            try {
                const reply = await transport({ action: 'retry-persona', sessionId: options.sessionId, operationId });
                if (reply.kind !== 'persona-retried')
                    throw Error('NATIVE_PERSONA_MUTATION_ACK_UNKNOWN');
                store.recordPersona(envelope, reply.result);
                if (sameBinding(binding, envelope.binding))
                    revoke();
                notify(hasFrame() ? lastStatus : { kind: 'failed', code: 'BROWSER_GENERATION_REVOKED' });
            }
            catch (error) {
                store.recordPersona(envelope, undefined, String(error));
                notify();
            }
        });
    }
    function recoverOpening(retry) {
        return recovery('opening', async () => {
            const envelope = store.readOpening(options.sessionId);
            if (!envelope || envelope.state === 'terminal')
                return;
            try {
                const reply = await (options.openingTransport ?? readerRegexDocumentTransportV1)({
                    action: retry ? 'retry-opening-variants' : 'confirm-opening-variants', sessionId: options.sessionId, operationId: envelope.request.operationId
                });
                if (!reply.ok || reply.kind !== 'opening-variants-confirmed')
                    throw Error('READER_WRITE_ACK_UNKNOWN');
                const warning = record(() => store.recordOpening(envelope, reply.result));
                notify({ ...lastStatus, code: warning });
                if (reply.result.kind !== 'unknown') {
                    revoke();
                    if (reply.result.kind === 'committed' && reply.result.navigation && options.navigate)
                        await options.navigate(reply.result.navigation.sessionId);
                    else
                        await refresh();
                }
            }
            catch (error) {
                notify({ kind: 'pending', code: error instanceof Error ? error.message : String(error) });
            }
        });
    }
    return {
        start: () => confirm(), refresh, confirm: () => confirm(), retry: () => confirm(true), retryWorldbook, retryPersona,
        confirmOrdinary: (operationId) => ordinaryRecovery(operationId, false),
        retryOrdinary: (operationId) => ordinaryRecovery(operationId, true),
        confirmOpening: () => recoverOpening(false), retryOpening: () => recoverOpening(true),
        confirmMessageBody: (operationId) => messageBodyRecovery(operationId, false),
        retryMessageBody: (operationId) => messageBodyRecovery(operationId, true),
        async showCurrentPageWithOpeningUnknown() {
            const envelope = store.readOpening(options.sessionId);
            if (!envelope)
                return;
            store.releaseOpening(envelope);
            notify();
            await refresh();
        },
        async showCurrentPageWithOrdinaryUnknown(operationId) {
            const envelope = ordinaryStore.readHelper(options.sessionId).find(row => row.operation.operationId === operationId);
            if (!envelope)
                return;
            const warning = record(() => ordinaryStore.release(envelope), 'AUTHOR_CHAT_RELEASE_LOCAL_ONLY');
            notify({ ...lastStatus, code: warning });
            await refresh();
        },
        hasFrame,
        dispose() { if (!active)
            return; active = false; revoke(); },
    };
}
