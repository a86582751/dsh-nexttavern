// Generated from runtime/alpha3/src/ui/author-browser-session.ts; edit the TypeScript source.
import { createAuthorNativeHelperFrame } from './author-native-helper-frame.js';
import { mountAuthorNativeScriptButtons } from './author-native-script-buttons.js';
import { AUTHOR_NATIVE_EVENTS_V1, authorNativeNamespaceCauseV1 } from '../core/author-native-origin.js';
import { AUTHOR_NATIVE_MVU_HOOK_EVENTS } from '../core/author-native-mvu-hook-types.js';
import { createAuthorBrowserOrdinaryPendingStore, sameOrdinarySource } from './author-browser-ordinary-pending.js';
import { createAuthorNativeMessageVariables } from '../core/author-native-message-variables.js';
import { continuePreparedOpening, createAuthorNativeSessionEventRouter, openingNavigationIntent } from './author-native-session-events.js';
import { runAuthorNativeMvuTrial } from './author-native-mvu-trial.js';
import { prepareOrdinaryAuthorChatBatchV3 } from '../core/roleplay-author-chat-state-types.js';
import { authorSharedScopeCaptureV1 } from '../core/roleplay-author-scope-owner.js';
import { createAuthorBrowserPendingStore, openingVariantSettled, terminalBrowserReceipt, worldbookPendingRetryLocator, worldbookPendingBlocksNamespace } from './author-browser-pending.js';
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
        if (reply.characterLibrary)
            publishCharacterLibrary(reply.characterLibrary);
        return reply;
    };
    const store = createAuthorBrowserPendingStore(options.storage ?? localStorage);
    const ordinaryStore = createAuthorBrowserOrdinaryPendingStore(options.storage ?? localStorage);
    const eventRouter = options.eventRouter ?? createAuthorNativeSessionEventRouter();
    const auxiliary = new Map();
    const commandInteractions = new Map();
    let active = true, ready = false, binding;
    let owner, captured, currentSnapshotScope = '';
    let presetLibrary;
    let characterLibrary;
    let libraryAcknowledgements = Promise.resolve(), libraryAcknowledgementScheduled = false;
    let activeGeneration, activeGenerationScope = '';
    let activeFilter;
    let refreshing, refreshAgain = false, checking;
    let openingIndex, generationLoopOwner;
    let generationWait, generationExecuting = false, sequence = 0;
    let canonicalRevision = 0, lastStatus = { kind: 'loading' };
    let buttons;
    let buttonProgram;
    const realms = new Map(), registrations = [];
    let registrationRevision = 0, mvuHookRegistryStart;
    let sceneLease;
    const recoveries = new Map();
    const current = () => active && options.current();
    const diagnostics = new Map();
    const clearDiagnostics = () => { for (const release of diagnostics.values())
        release(); diagnostics.clear(); };
    const reportExtensionFailure = (failure) => {
        const key = failure.id + ':' + failure.sourceRevision + ':' + failure.code;
        if (diagnostics.has(key))
            return;
        const release = options.reportExtensionFailure?.(failure);
        if (typeof release === 'function')
            diagnostics.set(key, () => { release(); });
    };
    let preparationState = { kind: 'starting' };
    const preparation = (value) => { preparationState = value; options.preparation?.(value); };
    const hasFrame = () => realms.size > 0;
    function notify(value = lastStatus) {
        if (!current())
            return;
        const pending = store.read(options.sessionId);
        lastStatus = { ...value, pending: pending?.state === 'terminal' ? undefined : pending,
            worldbooks: store.readWorldbooks(options.sessionId), personas: store.readPersonas(options.sessionId),
            ordinary: ordinaryStore.readHelper(options.sessionId), opening: store.readOpening(options.sessionId),
            messageBodies: store.readBodies(options.sessionId), presets: store.readPresets(options.sessionId),
            characterLibraries: store.readCharacterLibrary(options.sessionId) };
        options.status(lastStatus);
        if (ready && captured && lastStatus.kind === 'ready')
            options.adopted?.(captured);
    }
    const release = (target) => { void transport({ action: 'dispose', binding: target }).catch(() => { }); };
    function revoke() {
        for (const job of auxiliary.values())
            job.reservation.cancel();
        auxiliary.clear();
        buttons?.dispose();
        buttons = undefined;
        buttonProgram = undefined;
        generationWait?.abort();
        generationWait = undefined;
        generationExecuting = false;
        generationLoopOwner = undefined;
        activeGeneration = undefined;
        activeGenerationScope = '';
        activeFilter = undefined;
        mvuHookRegistryStart = undefined;
        owner = undefined;
        ready = false;
        captured = undefined;
        currentSnapshotScope = '';
        presetLibrary = undefined;
        characterLibrary = undefined;
        for (const row of realms.values())
            row.controller?.dispose();
        realms.clear();
        registrations.length = 0;
        options.container.replaceChildren();
        if (sceneLease) {
            options.releaseScene?.(sceneLease);
            sceneLease = undefined;
        }
        if (binding)
            release(binding);
        binding = undefined;
    }
    function realmSnapshot(snapshot, realmId) {
        const { realmScripts, ...context } = snapshot.context ?? {};
        return { ...snapshot, context: { ...context, script: realmScripts?.[realmId] } };
    }
    function dispatch(event, args) {
        if (options.eventRouter) {
            void options.eventRouter.emit(event, args).catch(error => {
                if (current())
                    notify({ ...lastStatus, code: String(error) });
            });
        }
        else
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
        if (buttonProgram)
            buttons?.update(buttonProgram.scripts, snapshot.scriptButtons);
        for (const row of realms.values())
            row.controller?.updateSnapshot(realmSnapshot(snapshot, row.realmId), scope);
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
            if (snapshot.readRevision !== captured?.readRevision || snapshot.generation !== captured.generation) {
                activeGenerationScope = '';
                activeFilter = undefined;
            }
            publish(snapshot);
        }
        else {
            // The receipt is still canonical. Without new DATA, the previous
            // read cannot authorize another write; refresh after its ACK.
            currentSnapshotScope = '';
            activeGenerationScope = '';
            activeFilter = undefined;
            void refresh();
        }
    }
    function response(value, realmId) {
        return { value, ...captured && currentSnapshotScope ? { snapshot: realmSnapshot(captured, realmId), readScope: currentSnapshotScope } : {} };
    }
    function publishPresetLibrary(catalog) {
        if (!catalog || presetLibrary?.revision === catalog.revision)
            return;
        presetLibrary = catalog;
        for (const row of realms.values())
            row.controller?.updatePresetLibrary?.(catalog);
        scheduleLibraryAcknowledgement();
    }
    function publishCharacterLibrary(packet) {
        if (!packet || characterLibrary?.epoch === packet.epoch)
            return;
        characterLibrary = packet;
        for (const row of realms.values())
            row.controller?.updateCharacterLibrary?.(packet);
        scheduleLibraryAcknowledgement();
    }
    function scheduleLibraryAcknowledgement() {
        if (libraryAcknowledgementScheduled || !binding || !realms.size)
            return;
        libraryAcknowledgementScheduled = true;
        queueMicrotask(() => {
            libraryAcknowledgementScheduled = false;
            libraryAcknowledgements = libraryAcknowledgements.then(async () => {
                const target = binding;
                if (!target || !current() || !realms.size)
                    return;
                // Port order puts these controls after packet delivery, so the
                // sets include getters that completed against the older cut.
                const captures = await Promise.all([...realms.values()].map(async (row) => ({ realmId: row.realmId,
                    ...await row.controller.captureLibraryReads() })));
                if (current() && sameBinding(binding, target))
                    await transport({ action: 'ack-library-reads', binding: target, captures });
            }).catch(() => { });
            // A lost cache ACK retains old packets and leaves the durable
            // mutation's canonical receipt available to its original caller.
        });
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
    function registryRequest(row, request, target, signal) {
        if (request.operation === 'generation-listener-add') {
            const data = request.payload.registration;
            if (data.event !== AUTHOR_NATIVE_EVENTS_V1.GENERATION_AFTER_COMMANDS
                && !Object.values(AUTHOR_NATIVE_MVU_HOOK_EVENTS).includes(data.event))
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
            if (index < 0)
                return true;
            registrations.splice(index, 1);
        }
        else
            return false;
        registrationRevision++;
        // A closing callback can register the next MVU stage. Its completion
        // carries that fact before Core decides whether to dispatch that stage.
        if (!ready || !generationLoopOwner || mvuHookRegistryStart !== undefined)
            return true;
        return transport({ action: 'generation-registrations', binding: target, registrationRevision,
            registrations: [...registrations] }, signal).then(reply => {
            if (reply.kind !== 'generation-acknowledged')
                throw Error('BROWSER_GENERATION_REGISTRATION_FAILED');
        });
    }
    function navigateCommitted(row, result, expectedOwner, original, rows, sourceTransferred) {
        if (result.kind !== 'committed' || !options.navigate)
            return;
        const intent = openingNavigationIntent(result.operationId, result.changed, original.messages, rows, result.navigation?.swipe);
        if (!result.navigation && !intent.swipe)
            return;
        const destination = result.navigation?.sessionId ?? options.sessionId;
        // Return the Host reply first. Navigation observes the actual native
        // ACK; waiting inside the request would wait for its own return.
        void (async () => {
            try {
                if (owner === expectedOwner) {
                    try {
                        await row.controller.waitForAdmittedSourceWrites();
                    }
                    catch (error) {
                        if (!sourceTransferred || owner === expectedOwner)
                            throw error;
                    }
                }
                if (current() && (sourceTransferred || owner === expectedOwner))
                    await options.navigate(destination, intent);
            }
            catch {
                notify({ ...lastStatus, code: 'AUTHOR_NATIVE_ACK_UNOBSERVED' });
            }
        })();
    }
    function createHost(expectedOwner, target, program) {
        return { async request(address, request, _signal, sourceWriteStarted) {
                if (!current() || owner !== expectedOwner || !sameBinding(binding, target))
                    throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
                const row = realms.get(address.realmId);
                const registry = registryRequest(row, request, target, _signal);
                if (registry) {
                    await registry;
                    return {};
                }
                const data = request.payload;
                if (request.operation === 'parse-mvu-message') {
                    const hooks = await eventRouter.captureMvuTrialHooks();
                    const call = async (input, signal) => {
                        const reply = await transport({ action: 'mvu-trial', binding: target, realmId: row.realmId, request: input }, signal);
                        if (reply.kind !== 'mvu-trial')
                            throw Error('AUTHOR_NATIVE_MVU_TRIAL_UNAVAILABLE');
                        return reply.result;
                    };
                    const output = async (input) => {
                        const reply = await call(input, _signal);
                        if (reply.kind !== 'output')
                            throw Error('AUTHOR_NATIVE_MVU_TRIAL_OUTPUT_INVALID');
                        return reply.output;
                    };
                    return { value: await runAuthorNativeMvuTrial({ trialId: data.trialId, message: data.message, oldData: data.oldData,
                            hooks, signal: _signal, transport: {
                                current: () => current() && owner === expectedOwner && sameBinding(binding, target),
                                begin: input => output({ action: 'start', ...input }),
                                advance: (trialId, input) => output({ action: 'advance', trialId, ...input }),
                                close: async (trialId) => { await call({ action: 'close', trialId }); },
                            } }) };
                }
                if (request.operation === 'command-release') {
                    const prefix = row.realmId + ':' + request.operationId + ':';
                    for (const key of commandInteractions.keys())
                        if (key.startsWith(prefix))
                            commandInteractions.delete(key);
                    return {};
                }
                if (request.operation === 'command-input' || request.operation === 'command-echo') {
                    if (!options.commandUi)
                        throw Error('AUTHOR_NATIVE_COMMAND_UI_UNAVAILABLE');
                    const key = row.realmId + ':' + request.operationId;
                    let pending = commandInteractions.get(key);
                    if (!pending) {
                        pending = Promise.resolve().then(() => request.operation === 'command-input'
                            ? options.commandUi.input(data.text, data.defaultValue) : options.commandUi.echo(data.text));
                        commandInteractions.set(key, pending);
                    }
                    const value = await pending;
                    if (!current() || owner !== expectedOwner || !sameBinding(binding, target) || _signal.aborted)
                        throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
                    return { value };
                }
                if (request.operation === 'generation-reserve') {
                    const operationId = request.operationId, generationId = data.generationId;
                    const reservation = eventRouter.reserveGeneration({ generationId, operationId, silence: data.silence,
                        cancel: async () => {
                            row.controller?.cancelGeneration(operationId);
                            const job = auxiliary.get(operationId);
                            if (job?.started)
                                await transport({ action: 'stop-author-generation', binding: target,
                                    request: { realmId: row.realmId, operationId } });
                        } });
                    auxiliary.set(operationId, { realmId: row.realmId, generationId, started: false, settled: false, filters: [], reservation });
                    return {};
                }
                if (request.operation === 'stop-all-author-generations')
                    return { value: eventRouter.stopAllGenerations() };
                if (request.operation === 'generation-filter')
                    return { value: await eventRouter.invokeGenerationFilter(data.descriptor, request.operationId, 'chat') };
                if (request.operation === 'invoke-author-generation-filter') {
                    const accepted = await eventRouter.invokeGenerationFilter(data.descriptor, request.operationId, data.consumer);
                    return { value: { accepted, libraryReads: await eventRouter.captureGenerationLibraryReads() } };
                }
                if (request.operation === 'author-generation-filter-result') {
                    const reply = await transport({ action: 'author-generation-filter-result', binding: target,
                        request: { ...data, realmId: row.realmId, operationId: request.operationId } });
                    if (reply.kind !== 'generation-filter-acknowledged')
                        throw Error('AUTHOR_GENERATION_FILTER_ACK_UNAVAILABLE');
                    return {};
                }
                if (request.operation === 'generation-release') {
                    const job = auxiliary.get(request.operationId);
                    if (job) {
                        if (job.started && !job.settled)
                            job.reservation.cancel();
                        job.reservation.release();
                        auxiliary.delete(request.operationId);
                        eventRouter.retireGenerationFilters(request.operationId, job.filters);
                    }
                    return {};
                }
                if (request.operation === 'stop-author-generation') {
                    const job = auxiliary.get(request.operationId);
                    return { value: job?.realmId === row.realmId ? job.reservation.cancel() : false };
                }
                if (request.operation === 'start-author-generation' || request.operation === 'author-generation-next') {
                    const job = auxiliary.get(request.operationId);
                    if (!job || job.realmId !== row.realmId || !job.reservation.current())
                        throw Error('AUTHOR_GENERATION_CANCELLED');
                    if (request.operation === 'start-author-generation') {
                        const requestOptions = { ...data.options }, libraryReads = await eventRouter.captureGenerationLibraryReads();
                        if (!job.reservation.current())
                            throw Error('AUTHOR_GENERATION_CANCELLED');
                        job.reservation.setSilence(requestOptions.should_silence === true);
                        job.started = true;
                        const reply = await transport({ action: 'start-author-generation', binding: target,
                            request: { realmId: row.realmId, operationId: request.operationId, options: requestOptions, libraryReads } });
                        if (reply.kind !== 'generation-started')
                            throw Error('AUTHOR_GENERATION_START_UNAVAILABLE');
                        return { value: reply };
                    }
                    const reply = await transport({ action: 'author-generation-next', binding: target,
                        request: { realmId: row.realmId, operationId: request.operationId, cursor: data.cursor } });
                    if (reply.kind !== 'generation-update')
                        throw Error('AUTHOR_GENERATION_UPDATE_UNAVAILABLE');
                    if (reply.update.settled)
                        job.settled = true;
                    return { value: reply.update };
                }
                if (request.operation === 'character-regex-replace' || request.operation === 'named-character-worldbook-bind') {
                    const wire = { ...data, realmId: row.realmId, operationId: request.operationId }, envelope = store.beginCharacterLibrary(target, wire, request.operation);
                    sourceWriteStarted?.();
                    notify({ kind: 'pending' });
                    let result;
                    try {
                        const operation = envelope.operation;
                        const reply = await transport(operation.kind === 'character-regex-replace'
                            ? { action: operation.kind, binding: target, request: operation.request }
                            : { action: operation.kind, binding: target, request: operation.request }, _signal);
                        if (reply.kind !== 'character-library-mutated')
                            throw Error('AUTHOR_NATIVE_CHARACTER_LIBRARY_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        const code = error instanceof Error ? error.message : 'AUTHOR_NATIVE_CHARACTER_LIBRARY_ACK_UNKNOWN', warning = record(() => store.recordCharacterLibrary(envelope, undefined, code));
                        revoke();
                        notify({ kind: 'pending', code: warning ?? code });
                        throw error;
                    }
                    const warning = record(() => store.recordCharacterLibrary(envelope, result.value));
                    if (result.value.kind !== 'refused')
                        adopt(result.snapshot, expectedOwner);
                    notify({ kind: ready ? 'ready' : 'starting', code: warning });
                    return response(result.value, row.realmId);
                }
                if (request.operation === 'preset-manage') {
                    const profileId = captured?.sharedScopes?.global?.root.address.profileId;
                    if (!profileId || !presetLibrary)
                        throw Error('AUTHOR_NATIVE_PRESET_UNAVAILABLE');
                    const operation = { schemaVersion: 1, operationId: request.operationId,
                        expectedRevision: data.expectedRevision, command: data.command,
                        origin: { profileId, sessionId: target.sessionId, realmId: row.realmId, groupId: row.groupId,
                            sourceRecordSessionId: program.source.sourceRecordSessionId, importId: program.source.importId } };
                    const envelope = store.beginPreset(target, operation);
                    sourceWriteStarted?.();
                    notify({ kind: 'pending' });
                    let result;
                    try {
                        const reply = await transport({ action: 'manage-preset', binding: target, realmId: row.realmId,
                            operation: envelope.operation }, _signal);
                        if (reply.kind !== 'preset-managed' && reply.kind !== 'preset-refused')
                            throw Error('AUTHOR_NATIVE_PRESET_ACK_UNKNOWN');
                        result = reply;
                    }
                    catch (error) {
                        const code = error instanceof Error ? error.message : 'AUTHOR_NATIVE_PRESET_ACK_UNKNOWN';
                        record(() => store.recordPreset(envelope, undefined, code));
                        revoke();
                        notify({ kind: 'pending', code });
                        void refresh();
                        throw error;
                    }
                    if (result.kind === 'preset-refused') {
                        const warning = record(() => store.recordPreset(envelope, undefined, result.code, 'refused'));
                        notify({ kind: ready ? 'ready' : 'starting', code: warning ?? result.code });
                        // Deliver this owner's definite refusal to the original
                        // realm before replacing its stale captured DATA.
                        void (async () => {
                            try {
                                await row.controller.waitForAdmittedSourceWrites();
                            }
                            catch { }
                            if (current() && owner === expectedOwner) {
                                revoke();
                                await refreshing;
                                await refresh();
                            }
                        })();
                        return { value: { kind: 'refused', operationId: result.operationId, code: result.code } };
                    }
                    const warning = record(() => store.recordPreset(envelope, result.result));
                    publishPresetLibrary(result.catalog);
                    adopt(result.snapshot, expectedOwner);
                    notify({ kind: ready ? 'ready' : 'starting', code: warning });
                    return { ...response(result.result, row.realmId), presetLibrary: result.catalog };
                }
                if (request.operation === 'replace-script-buttons') {
                    sourceWriteStarted?.();
                    const reply = await transport({ action: 'mutate-script-buttons', binding: target,
                        request: { ...data, operationId: request.operationId, realmId: row.realmId } }, _signal);
                    if (reply.kind !== 'script-buttons-mutated')
                        throw Error('AUTHOR_SCRIPT_BUTTON_ACK_UNKNOWN');
                    if (reply.snapshot || reply.result.kind === 'edited-data')
                        adopt(reply.snapshot, expectedOwner);
                    return response(reply.result, row.realmId);
                }
                if (request.operation === 'mutate-prompts') {
                    sourceWriteStarted?.();
                    const reply = await transport({ action: 'mutate-prompts', binding: target,
                        request: { operationId: request.operationId, realmId: row.realmId, resource: row.resource, mutation: data.mutation,
                            libraryReads: data.libraryReads } }, _signal);
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
                    // This existing mixed route may publish Source facts. Its
                    // command owner retains dispatch and publication semantics.
                    sourceWriteStarted?.();
                    const reply = await transport({ action: 'execute-commands', binding: target, realmId: row.realmId,
                        request: { operationId: request.operationId, command: data.command,
                            ...data.step ? { step: data.step, pipe: data.pipe } : {} } }, _signal);
                    if (reply.kind !== 'commands-executed')
                        throw Error('AUTHOR_NATIVE_COMMAND_ACK_UNKNOWN');
                    if (reply.snapshot || reply.result.refreshRequired || reply.result.steps.some(step => step.kind === 'ruby' && step.sourceDataPublished))
                        adopt(reply.snapshot, expectedOwner);
                    if (reply.result.steps.some(step => step.kind === 'ruby' && step.action === 'panel'))
                        window.dispatchEvent(new CustomEvent('dsh-roleplay-needs-config', {
                            detail: { sessionId: target.sessionId, action: 'configure-ruby-analysis' }
                        }));
                    return reply.snapshot ? response(reply.result, row.realmId) : { value: reply.result };
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
                if (request.operation === 'worldbook-read') {
                    const reply = await transport({ action: 'read-worldbook', binding: target, realmId: row.realmId,
                        name: data.name, expectedDataSha256: data.expectedDataSha256, read: basis.read }, _signal);
                    if (reply.kind !== 'worldbook-read')
                        throw Error('AUTHOR_WORLDBOOK_READ_UNAVAILABLE');
                    return { value: reply.book };
                }
                const messagePlan = request.operation === 'set-chat-messages'
                    ? createAuthorNativeMessageVariables(basis.snapshot).planSetChatMessages(data.rows) : undefined;
                if (messagePlan?.kind === 'unchanged')
                    return response({ kind: 'unchanged', operationId: request.operationId }, row.realmId);
                if (messagePlan?.kind === 'body' || messagePlan?.kind === 'patch') {
                    const selected = messagePlan;
                    const message = selected.message, wire = { schemaVersion: 1,
                        operationId: request.operationId, readRevision: basis.snapshot.readRevision,
                        expected: { sessionId: basis.snapshot.basis.sessionId, seq: message.nativeSeq, messageId: message.messageId,
                            role: message.role, messageVersionSha256: message.messageVersionSha256 },
                        text: selected.text, refresh: data.refresh, ...selected.kind === 'patch' ? { patch: selected.patch } : {} };
                    const envelope = store.beginBody(target, program.programSha256, row.realmId, wire);
                    sourceWriteStarted?.();
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
                    if (result.snapshot || result.result.kind !== 'refused')
                        adopt(result.snapshot, expectedOwner);
                    if (result.result.kind === 'unknown')
                        revoke();
                    notify({ kind: result.result.kind === 'unknown' ? 'pending' : ready ? 'ready' : 'starting',
                        code: warning ?? ('code' in result.result ? result.result.code : undefined) });
                    return response(result.result, row.realmId);
                }
                if (request.operation === 'mutate-author-namespace') {
                    const self = basis.snapshot.context?.realmScripts?.[row.realmId];
                    const shared = data.selector && ['global', 'character', 'preset', 'extension'].includes(data.selector.type)
                        ? authorSharedScopeCaptureV1(basis.snapshot.sharedScopes, data.selector) : undefined;
                    const capture = data.selector?.type === 'script' ? self?.ordinary : data.selector?.type === 'message' ? createAuthorNativeMessageVariables(basis.snapshot)
                        .resolve(data.selector, true).capture : basis.snapshot.ordinaryChat;
                    if (!capture)
                        throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE');
                    const cause = authorNativeNamespaceCauseV1(program.programSha256, row), operation = shared ? { kind: 'shared-scope',
                        sourceNamespace: basis.snapshot.ordinaryChat.root.namespace, expectedRoot: shared.root,
                        operationId: request.operationId, values: data.nextVariables, cause } : prepareOrdinaryAuthorChatBatchV3(capture.root, data.nextVariables, request.operationId, cause, capture.scopeRef), envelope = ordinaryStore.begin(target, operation);
                    sourceWriteStarted?.();
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
                        readRevision: basis.snapshot.readRevision, realmId: row.realmId, expected: data.expected,
                        ...data.action === 'replace-envelope' ? { action: 'replace-envelope', envelope: data.envelope }
                            : { values: data.values },
                        ...data.target ? { target: data.target } : {} }, request.operationId);
                    sourceWriteStarted?.();
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
                    if (result.snapshot || result.result.operation?.outcome !== 'refused')
                        adopt(result.snapshot, expectedOwner);
                    for (const event of result.sourceEvents ?? [])
                        dispatch(event.type, event.args);
                    notify({ kind: terminalBrowserReceipt(result.result) ? ready ? 'ready' : 'starting' : 'pending', code: warning ?? result.result.code });
                    return response(result.result, row.realmId);
                }
                if (request.operation === 'worldbook-mutate' || request.operation === 'worldbook-manage') {
                    const wire = {
                        ...data, realmId: row.realmId, operationId: request.operationId, read: basis.read
                    };
                    const book = basis.snapshot.worldbook;
                    if (!book || book.dataSha256 !== wire.expectedDataSha256)
                        throw Error('AUTHOR_WORLDBOOK_STALE_BASE');
                    const envelope = store.beginWorldbook(target, wire, book.profileId);
                    notify();
                    sourceWriteStarted?.();
                    let result;
                    try {
                        const reply = request.operation === 'worldbook-mutate'
                            ? await transport({ action: 'mutate-worldbook', binding: target, request: wire })
                            : await transport({ action: 'manage-worldbook', binding: target, request: wire });
                        if (reply.kind !== 'worldbook-mutated' && reply.kind !== 'worldbook-managed')
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
                    if (result.reply.snapshot || result.reply.result.kind === 'committed')
                        adopt(result.reply.snapshot, expectedOwner);
                    notify({ ...lastStatus, code: warning });
                    const reply = { ...result.reply, worldbookReadCurrent: result.reply.worldbookReadCurrent
                            && captured === result.reply.snapshot ? true : undefined };
                    return response(reply, row.realmId);
                }
                if (request.operation === 'persona-mutate') {
                    const wire = { ...data, realmId: row.realmId, operationId: request.operationId };
                    const envelope = store.beginPersona(target, wire);
                    notify();
                    sourceWriteStarted?.();
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
                    if (result.reply.snapshot || result.reply.result.kind === 'committed')
                        adopt(result.reply.snapshot, expectedOwner);
                    notify({ ...lastStatus, code: warning });
                    return response(result.reply, row.realmId);
                }
                if (messagePlan?.kind === 'opening') {
                    const envelope = store.beginOpening(target, row.realmId, { operationId: request.operationId,
                        readRevision: basis.snapshot.readRevision, rows: [messagePlan.row], refresh: data.refresh });
                    notify();
                    sourceWriteStarted?.();
                    let result, sourceTransferred = false;
                    try {
                        const reply = await transport({ action: 'mutate-opening-variants', binding: target, realmId: row.realmId,
                            read: basis.read, request: envelope.request });
                        if (reply.kind !== 'opening-variants-mutated')
                            throw Error('READER_WRITE_ACK_UNKNOWN');
                        result = reply;
                        if (reply.result.kind === 'prepared') {
                            const warning = record(() => store.recordOpening(envelope, reply.result));
                            if (warning)
                                throw Error(warning);
                            // The selected view owns this durable operation and its
                            // child Source even if a later request revokes the old guest.
                            sourceTransferred = true;
                            result = { ...reply, result: await continuePreparedOpening(options.sessionId, reply.result, options.startPendingOpeningSource, options.openingTransport ?? readerRegexDocumentTransportV1) };
                        }
                    }
                    catch (error) {
                        record(() => store.recordOpening(envelope));
                        revoke();
                        notify({ kind: 'pending', code: 'READER_WRITE_ACK_UNKNOWN' });
                        throw error;
                    }
                    const warning = record(() => store.recordOpening(envelope, result.result));
                    if (result.snapshot || result.result.kind !== 'refused')
                        adopt(result.snapshot, expectedOwner);
                    notify({ ...lastStatus, code: warning });
                    navigateCommitted(row, result.result, expectedOwner, basis.snapshot, [messagePlan.row], sourceTransferred);
                    return response(result.result, row.realmId);
                }
                throw Error('AUTHOR_NATIVE_OPERATION_UNSUPPORTED');
            } };
    }
    async function executeMvuHook(challenge, target, signal) {
        let request = challenge.request;
        const readVariables = ('readVariables' in request.payload ? request.payload.readVariables : undefined);
        const callbackIds = [], diagnostics = [];
        const contextKeys = new Set();
        let replaceContext = false, hasContextWrites = false;
        const resultOf = (input) => {
            const metadata = hasContextWrites ? { contextWrites: replaceContext
                    ? { schemaVersion: 1, kind: 'replace' }
                    : { schemaVersion: 1, kind: 'keys', keys: [...contextKeys] } } : {};
            if ('graph' in input.payload && input.payload.graph)
                return { stage: input.stage,
                    output: { graph: input.payload.graph }, diagnostics, ...metadata };
            if (input.stage === 'command-parsed')
                return { stage: input.stage,
                    output: { variables: input.payload.variables, commands: input.payload.commands }, diagnostics, ...metadata };
            if (input.stage === 'update-ended')
                return { stage: input.stage, output: { variables: input.payload.variables }, diagnostics, ...metadata };
            if (input.stage === 'before-message-update')
                return { stage: input.stage, output: { context: input.payload.context }, diagnostics, ...metadata };
            throw Error('AUTHOR_NATIVE_MVU_HOOK_GRAPH_REQUIRED');
        };
        try {
            for (const callback of challenge.registrations) {
                if (!registrations.some(row => row.callbackId === callback.callbackId && row.realmId === callback.realmId))
                    continue;
                const row = realms.get(callback.realmId);
                const payload = { ...request.payload };
                if (readVariables && !replaceContext && readVariables.appliedWrites?.kind !== 'replace') {
                    payload.readVariables = { ...readVariables, appliedWrites: { schemaVersion: 1, kind: 'keys',
                            keys: [...readVariables.appliedWrites?.keys ?? [], ...contextKeys] } };
                }
                else
                    delete payload.readVariables;
                const callbackRequest = { ...request, payload };
                const output = await row.controller.invokeMvuHook({ invocationId: challenge.invocationId,
                    request: callbackRequest, callbackIds: [callback.callbackId] }, signal);
                callbackIds.push(...output.callbackIds);
                diagnostics.push(...output.result.diagnostics);
                const writes = output.result.contextWrites;
                if (writes) {
                    hasContextWrites = true;
                    if (writes.kind === 'replace')
                        replaceContext = true;
                    else
                        for (const key of writes.keys)
                            contextKeys.add(key);
                }
                if (request.stage === output.result.stage && 'graph' in output.result.output)
                    request = { ...request, payload: { graph: output.result.output.graph } };
                else if (request.stage === 'command-parsed' && output.result.stage === 'command-parsed')
                    request = { ...request, payload: { ...request.payload, ...output.result.output } };
                else if (request.stage === 'update-ended' && output.result.stage === 'update-ended')
                    request = { ...request, payload: { ...request.payload, ...output.result.output } };
                else if (request.stage === 'before-message-update' && output.result.stage === 'before-message-update')
                    request = { ...request, payload: output.result.output };
                else
                    throw Error('AUTHOR_NATIVE_MVU_HOOK_OUTPUT_CHANGED');
            }
            return { kind: 'executed', binding: target, invocationId: challenge.invocationId, callbackIds,
                result: resultOf(request) };
        }
        catch (error) {
            return { kind: 'refused', binding: target, invocationId: challenge.invocationId,
                code: error instanceof Error ? error.message : 'AUTHOR_NATIVE_MVU_HOOK_FAILED' };
        }
    }
    async function generationLoop(expectedOwner, target) {
        let sourceCursor, transportFailures = 0, lifecycleDelivery = Promise.resolve();
        while (current() && owner === expectedOwner) {
            const wait = new AbortController();
            generationWait = wait;
            try {
                const challenge = transport({ action: 'generation-wait', binding: target, registrations: [...registrations],
                    registrationRevision, sourceCursor }, wait.signal);
                // Start admission before releasing the Reader's send handoff;
                // awaiting the challenge itself would deadlock that send.
                preparation({ kind: 'waiting' });
                const reply = await challenge;
                if (reply.kind !== 'generation-invocation')
                    throw Error('BROWSER_GENERATION_WAIT_FAILED');
                transportFailures = 0;
                if (!current() || owner !== expectedOwner)
                    return;
                if (wait.signal.aborted)
                    continue;
                if (reply.invocation.encoding === 'author-native-lifecycle-invocation-v1') {
                    const { packet, snapshot } = reply.invocation;
                    if (snapshot)
                        adopt(snapshot, expectedOwner);
                    if (packet.token !== sourceCursor) {
                        sourceCursor = packet.token;
                        // The next loop admits a new generation waiter before listeners
                        // can await Story work triggered by this notification.
                        queueMicrotask(() => {
                            lifecycleDelivery = lifecycleDelivery.then(async () => {
                                if (!current() || owner !== expectedOwner)
                                    return;
                                for (const event of packet.events) {
                                    if (options.eventRouter)
                                        await options.eventRouter.emit(event.type, event.args);
                                    else
                                        dispatch(event.type, event.args);
                                }
                            }).catch(error => { if (current() && owner === expectedOwner)
                                notify({ ...lastStatus, code: String(error) }); });
                        });
                    }
                    continue;
                }
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
                        const output = await row.controller.invokeFilter(call, wait.signal);
                        await row.controller.waitForAdmittedSourceWrites();
                        result = { binding: target, invocationId: call.invocationId, operationId: call.operationId, kind: 'executed',
                            accepted: output.accepted, libraryReads: output.libraryReads?.map(read => ({ realmId: row.realmId, read })) };
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
                    if (reply.invocation.snapshot)
                        adopt(reply.invocation.snapshot, expectedOwner);
                    generationExecuting = true;
                    mvuHookRegistryStart = registrationRevision;
                    const result = await executeMvuHook(reply.invocation, target, wait.signal);
                    if (!current() || owner !== expectedOwner)
                        return;
                    const changed = registrationRevision !== mvuHookRegistryStart;
                    mvuHookRegistryStart = undefined;
                    const completion = changed && result.kind === 'executed'
                        ? { ...result, registrationRevision, registrations: [...registrations] } : result;
                    await transport({ action: 'mvu-hook-complete', binding: target, result: completion }, wait.signal);
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
                const executed = [], effects = [], libraryReads = new Map();
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
                        for (const read of output.libraryReads ?? [])
                            libraryReads.set(row.realmId + '\u0000' + JSON.stringify(read), { realmId: row.realmId, read });
                    }
                    result = { kind: 'executed', binding: target, invocationId: reply.invocation.invocationId,
                        result: { invocationId: reply.invocation.invocationId, callbackIds: executed, effects,
                            libraryReads: [...libraryReads.values()] } };
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
                if (error instanceof TypeError && transportFailures++ === 0)
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
    function startGenerationLoop(expectedOwner, target) {
        if (generationLoopOwner === expectedOwner) {
            if (generationWait && !generationWait.signal.aborted && !generationExecuting)
                preparation({ kind: 'waiting' });
            return;
        }
        generationLoopOwner = expectedOwner;
        void generationLoop(expectedOwner, target).finally(() => {
            if (generationLoopOwner === expectedOwner)
                generationLoopOwner = undefined;
        });
    }
    async function refreshOnce() {
        const pending = store.read(options.sessionId), opening = store.readOpening(options.sessionId);
        if (!hasFrame() && store.readCharacterLibrary(options.sessionId).some(row => row.state !== 'terminal')) {
            preparation({ kind: 'blocked', code: '作者角色库操作尚未确认，请先恢复原操作。' });
            notify({ kind: 'pending' });
            return;
        }
        if (!hasFrame() && (pending && pending.state !== 'terminal' || opening && opening.state !== 'terminal' && !opening.manualReleased
            || store.readPersonas(options.sessionId).some(row => row.state !== 'terminal'))) {
            preparation({ kind: 'blocked', code: '作者操作尚未确认，请先处理阅读视图中的提示。' });
            notify({ kind: 'pending' });
            return;
        }
        const beforeWrite = canonicalRevision, oldBinding = binding, beforeOwner = owner, requestedOpeningIndex = openingIndex;
        const reply = await transport({ action: 'attach', sessionId: options.sessionId,
            ...requestedOpeningIndex !== undefined ? { openingIndex: requestedOpeningIndex } : {}, ...oldBinding ? { binding: oldBinding,
                ...hasFrame() && characterLibrary ? { characterEpoch: characterLibrary.epoch } : {},
                ...hasFrame() && presetLibrary ? { presetRevision: presetLibrary.revision } : {} } : {} });
        await Promise.all([...realms.values()].map(row => row.controller.waitForAdmittedSourceWrites()));
        if (!current()) {
            if (reply.kind === 'attached')
                release(reply.attachment.binding);
            return;
        }
        if (owner !== beforeOwner || binding !== oldBinding || openingIndex !== requestedOpeningIndex) {
            if (reply.kind === 'attached' && !sameBinding(binding, reply.attachment.binding))
                release(reply.attachment.binding);
            refreshAgain = true;
            return;
        }
        if (reply.kind === 'inactive') {
            clearDiagnostics();
            revoke();
            preparation({ kind: 'not-required' });
            notify({ kind: 'inactive', code: reply.code });
            return;
        }
        if (reply.kind !== 'attached')
            throw Error('BROWSER_ATTACHMENT_UNAVAILABLE');
        let attachment = reply.attachment;
        for (const envelope of store.readPresets(options.sessionId).filter(row => row.state !== 'terminal')) {
            const realm = attachment.program.realms.find(row => row.realmId === envelope.operation.origin.realmId
                && row.groupId === envelope.operation.origin.groupId);
            if (!realm)
                throw Error('AUTHOR_NATIVE_PRESET_RECOVERY_REALM_UNAVAILABLE');
            const recovered = await transport({ action: 'manage-preset', binding: attachment.binding,
                realmId: realm.realmId, operation: envelope.operation });
            if (recovered.kind === 'preset-refused') {
                store.recordPreset(envelope, undefined, recovered.code, 'refused');
                continue;
            }
            if (recovered.kind !== 'preset-managed')
                throw Error('AUTHOR_NATIVE_PRESET_ACK_UNKNOWN');
            store.recordPreset(envelope, recovered.result);
            attachment = { ...attachment, presetLibrary: recovered.catalog,
                ...recovered.snapshot ? { snapshot: recovered.snapshot } : {} };
        }
        if (canonicalRevision !== beforeWrite) {
            if (sameBinding(binding, attachment.binding) && captured)
                attachment = { ...attachment, snapshot: captured, presetLibrary, characterLibrary };
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
            publishPresetLibrary(attachment.presetLibrary);
            publishCharacterLibrary(attachment.characterLibrary);
            publish(attachment.snapshot);
            notify({ kind: ready ? 'ready' : 'starting' });
            if (owner)
                startGenerationLoop(owner, attachment.binding);
            return;
        }
        const book = attachment.snapshot.worldbook;
        if (store.readWorldbooks(options.sessionId).some(row => worldbookPendingBlocksNamespace(row, book?.profileId))) {
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
        clearDiagnostics();
        revoke();
        binding = attachment.binding;
        captured = attachment.snapshot;
        presetLibrary = attachment.presetLibrary;
        characterLibrary = attachment.characterLibrary;
        const expectedOwner = {};
        owner = expectedOwner;
        currentSnapshotScope = crypto.randomUUID();
        buttonProgram = attachment.program;
        const target = binding, host = createHost(expectedOwner, target, attachment.program), controllers = [];
        const scene = attachment.authorScene ? await options.scene?.(attachment.authorScene) : undefined;
        if (!current() || owner !== expectedOwner) {
            if (scene)
                options.releaseScene?.(scene);
            return;
        }
        sceneLease = scene;
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
                    scene: address.groupId === 'author-helper' ? scene : undefined,
                    reportExtensionFailure,
                    eventRoute: eventRouter, attachment: target,
                    documentLayout: options.documentLayout, libraries: options.nativeLibraries,
                    presetLibrary, characterLibrary,
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
            metadata: captured?.scriptButtons,
            current: () => current() && owner === expectedOwner,
            dispatch: (realmId, event) => realms.get(realmId)?.controller?.dispatchEvent(event, []),
        });
        ready = true;
        notify({ kind: 'ready' });
        startGenerationLoop(expectedOwner, target);
    }
    function refreshWork() {
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
                throw error;
            }
            finally {
                refreshing = undefined;
            }
        })();
        return refreshing;
    }
    function refresh() { return refreshWork().catch(() => { }); }
    async function prepareSource(index) {
        openingIndex = index;
        preparation({ kind: 'starting' });
        await refreshWork();
        if (!current() || !ready || !binding || !hasFrame())
            throw Error('BROWSER_ATTACHMENT_UNAVAILABLE');
        if (preparationState.kind === 'blocked' || preparationState.kind === 'failed' || preparationState.kind === 'not-required')
            throw Error(preparationState.code ?? 'BROWSER_ATTACHMENT_UNAVAILABLE');
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
                for (const operation of store.readCharacterLibrary(options.sessionId))
                    if (operation.state !== 'terminal')
                        await characterLibraryRecovery(operation.operation.request.operationId, false);
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
                const code = reply.result.kind === 'refused' && reply.result.diagnostics.some(row => row.code === 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED')
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
    function characterLibraryRecovery(operationId, refreshAfter = true) {
        return recovery('character-library:' + operationId, async () => {
            const envelope = store.readCharacterLibrary(options.sessionId).find(row => row.operation.request.operationId === operationId);
            if (!envelope || envelope.state === 'terminal')
                return;
            try {
                const reply = await transport({ action: 'retry-character-library', sessionId: options.sessionId, operation: envelope.operation });
                if (reply.kind !== 'character-library-mutated')
                    throw Error('AUTHOR_NATIVE_CHARACTER_LIBRARY_ACK_UNKNOWN');
                const warning = record(() => store.recordCharacterLibrary(envelope, reply.value));
                if (sameBinding(binding, envelope.binding))
                    revoke();
                notify({ kind: 'loading', code: warning });
            }
            catch (error) {
                const code = error instanceof Error ? error.message : 'AUTHOR_NATIVE_CHARACTER_LIBRARY_ACK_UNKNOWN', warning = record(() => store.recordCharacterLibrary(envelope, undefined, code));
                notify({ kind: 'pending', code: warning ?? code });
            }
            if (refreshAfter)
                await refresh();
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
            const originalMessages = captured?.messages ?? [];
            try {
                const reply = await (options.openingTransport ?? readerRegexDocumentTransportV1)({
                    action: retry ? 'retry-opening-variants' : 'confirm-opening-variants', sessionId: options.sessionId, operationId: envelope.request.operationId
                });
                if (!reply.ok || reply.kind !== 'opening-variants-confirmed')
                    throw Error('READER_WRITE_ACK_UNKNOWN');
                let result = reply.result;
                if (result.kind === 'prepared') {
                    const warning = record(() => store.recordOpening(envelope, result));
                    if (warning)
                        throw Error(warning);
                    result = await continuePreparedOpening(options.sessionId, result, options.startPendingOpeningSource, options.openingTransport ?? readerRegexDocumentTransportV1);
                }
                const warning = record(() => store.recordOpening(envelope, result));
                notify({ ...lastStatus, code: warning });
                if (openingVariantSettled(result)) {
                    revoke();
                    if (result.kind === 'committed' && options.navigate) {
                        const intent = openingNavigationIntent(result.operationId, result.changed, originalMessages, envelope.request.rows, result.navigation?.swipe);
                        if (result.navigation || intent.swipe)
                            await options.navigate(result.navigation?.sessionId ?? options.sessionId, intent);
                        if (!result.navigation)
                            await refresh();
                    }
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
        start: () => confirm(), refresh, prepareSource, confirm: () => confirm(), retry: () => confirm(true), retryWorldbook, retryPersona,
        retryCharacterLibrary: (operationId) => characterLibraryRecovery(operationId),
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
            return; active = false; clearDiagnostics(); revoke(); if (!options.eventRouter)
            eventRouter.dispose(); },
    };
}
