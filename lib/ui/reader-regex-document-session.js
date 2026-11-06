// Generated from runtime/alpha3/src/ui/reader-regex-document-session.ts; edit the TypeScript source.
import { createAuthorBrowserPendingStore, terminalBrowserReceipt } from './author-browser-pending.js';
import { scopeReaderCss } from './reader-rendering.js';
import { mountStaticAuthorDocument } from './author-runtime.js';
import { createReaderNativeDocumentFrameFactory } from './reader-native-document-frame.js';
import { createAuthorBrowserOrdinaryPendingStore } from './author-browser-ordinary-pending.js';
import { createAuthorNativeMessageVariables } from '../core/author-native-message-variables.js';
import { prepareOrdinaryAuthorChatBatchV3 } from '../core/roleplay-author-chat-state-types.js';
import { readerNativeNamespaceCauseV1, readerNativeSourceOriginV1 } from '../core/author-native-origin.js';
export const readerRegexDocumentTransportV1 = async (request, signal) => {
    const response = await fetch('/api/roleplay/state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal
    });
    const reply = await response.json();
    if (!response.ok || !reply.ok)
        throw Error(reply.ok ? 'READER_TRANSPORT_FAILED' : reply.code);
    return reply;
};
const sameBinding = (left, right) => left?.browserSessionId === right.browserSessionId && left.generation === right.generation;
/** Core supplies the independent Reader principal. The parent persists each
 * original operation before dispatch and owns confirmation after realm loss. */
export function createReaderRegexDocumentSession(options) {
    const transport = options.transport ?? readerRegexDocumentTransportV1;
    const store = options.pendingStore ?? createAuthorBrowserPendingStore(options.container.ownerDocument.defaultView.localStorage);
    const ordinaryStore = options.ordinaryStore ?? createAuthorBrowserOrdinaryPendingStore(options.container.ownerDocument.defaultView.localStorage);
    let active = true, revision = 0, identity = '', updating = false, recovering = false, writing = false;
    let navigation;
    let frame, realm, retiredRealm;
    let binding, pending;
    let numerical;
    let messageBodies = [];
    let ordinary = [];
    let queued;
    let recapture;
    const current = () => active && options.current();
    const held = () => pending && pending.state !== 'terminal' && !pending.manualReleased
        || numerical && numerical.state !== 'terminal' || messageBodies.some(row => row.state !== 'terminal')
        || ordinary.some(row => !row.manualReleased);
    const notifyPending = (code) => options.status({ kind: 'pending', pending,
        numerical: numerical?.state !== 'terminal' ? numerical : undefined,
        messageBodies, ordinary, busy: recovering || writing, ...code ? { code } : {} });
    const notifyReady = () => options.status({ kind: 'ready', messageBodies, ordinary });
    const notifyInactive = () => options.status({ kind: 'inactive', messageBodies, ordinary });
    function recordOrdinary(envelope, acknowledged, code) {
        try {
            if (acknowledged)
                ordinaryStore.acknowledge(envelope);
            else
                ordinaryStore.unknown(envelope, code);
        }
        catch {
            code = acknowledged ? 'AUTHOR_CHAT_ACK_LOCAL_RECORD_PENDING' : 'AUTHOR_CHAT_OUTBOX_UPDATE_FAILED';
        }
        ordinary = ordinaryStore.readReader(options.sessionId);
        return code;
    }
    function recordBody(envelope, result, code) {
        let next;
        try {
            next = store.recordBody(envelope, result, code);
        }
        catch {
            next = { ...envelope, result, code, state: result && result.kind !== 'unknown' ? 'terminal' : 'unknown' };
            code = 'READER_PENDING_STORE_FAILED';
        }
        messageBodies = messageBodies.map(row => row.request.operationId === envelope.request.operationId ? next : row);
        return code;
    }
    function bodyOrigin(plan) {
        if (!plan || plan.writes !== 'source-regex' || plan.origin.encoding !== 'reader-regex-document-origin-v1')
            throw Error('READER_MESSAGE_BODY_DOCUMENT_UNAVAILABLE');
        return readerNativeSourceOriginV1(plan.origin);
    }
    let activeExecution;
    function adoptSnapshot(snapshot) {
        if (snapshot && activeExecution)
            activeExecution = { ...activeExecution, snapshot };
    }
    function retireFrameAfterReceipt(owner, recaptureAfter) {
        const native = frame;
        // Let the normal bridge deliver and observe the receipt before closing
        // its port. A changed body needs a new actual capture and document plan.
        void (async () => {
            const observed = await native?.waitForReceiptObservation();
            if (!current() || realm !== owner)
                return;
            revoke();
            if (held())
                notifyPending();
            else
                notifyInactive();
            if (observed === 'unavailable')
                notifyPending('READER_NATIVE_RECEIPT_UNOBSERVED');
            if (recaptureAfter)
                options.requestRecapture?.();
        })();
    }
    function recordNumerical(envelope, result) {
        try {
            numerical = store.record(envelope, result);
        }
        catch {
            numerical = envelope;
            return 'READER_PENDING_STORE_FAILED';
        }
    }
    function recordResult(envelope, result) {
        try {
            const recorded = store.recordReader(envelope, result);
            if (pending?.request.operationId === envelope.request.operationId)
                pending = recorded;
        }
        catch {
            if (pending?.request.operationId === envelope.request.operationId)
                pending = { ...envelope, result, state: result.kind === 'unknown' ? 'unknown' : 'terminal' };
            return 'READER_PENDING_STORE_FAILED';
        }
    }
    function navigateCommitted(owner, envelope, result) {
        if (result.kind !== 'committed' || !result.navigation || !options.navigate)
            return;
        const token = {}, sourceFrame = frame, sessionId = result.navigation.sessionId;
        navigation = token;
        // The Host reply must settle before Source can finish its callback.
        // Register this wait without awaiting it from the Host request itself.
        void (async () => {
            try {
                const native = sourceFrame;
                if (native) {
                    // Native receipt observation says nothing about arbitrary
                    // Promise continuations. A committed Core result remains
                    // committed even when its Guest receipt cannot be observed.
                    if (await native.waitForReceiptObservation() === 'unavailable') {
                        if (current() && (realm === owner || owner && retiredRealm === owner) && navigation === token)
                            options.status({ kind: 'failed', code: 'READER_NATIVE_RECEIPT_UNOBSERVED' });
                        return;
                    }
                }
                if (owner && retiredRealm === owner)
                    await sourceFrame?.disposed;
                if (!current() || !(realm === owner || owner && retiredRealm === owner) || navigation !== token
                    || pending?.request.operationId !== envelope.request.operationId
                    || pending.result?.kind !== 'committed' || pending.result.navigation?.sessionId !== sessionId)
                    return;
                await options.navigate(sessionId);
            }
            catch (error) {
                if (current() && (realm === owner || owner && retiredRealm === owner) && navigation === token)
                    notifyPending(error instanceof Error ? error.message : 'READER_NAVIGATION_FAILED');
            }
            finally {
                if (navigation === token) {
                    navigation = undefined;
                    void drainUpdates();
                }
            }
        })();
    }
    const release = (target) => {
        void transport({ action: 'release-reader-binding', binding: target }).catch(() => { });
    };
    function releaseQueued() {
        if (queued?.execution.binding && !sameBinding(binding, queued.execution.binding))
            release(queued.execution.binding);
        queued = undefined;
    }
    function revoke(committedOwner) {
        retiredRealm = committedOwner;
        frame?.dispose();
        frame = undefined;
        if (realm)
            options.releaseImages?.(realm);
        realm = undefined;
        binding = undefined;
        identity = '';
        activeExecution = undefined;
        if (!options.surface)
            options.container.replaceChildren();
    }
    try {
        pending = store.readReader(options.sessionId);
        numerical = store.read(options.sessionId);
        messageBodies = store.readReaderBodies(options.sessionId);
        ordinary = ordinaryStore.readReader(options.sessionId);
        if (held())
            notifyPending();
    }
    catch (error) {
        options.status({ kind: 'failed', code: error instanceof Error ? error.message : 'READER_PENDING_UNAVAILABLE' });
    }
    function host(owner, target) {
        return {
            async mutateNamespace(value, documentPlanSha256, request, signal) {
                if (!current() || realm !== owner || !sameBinding(binding, value) || !activeExecution)
                    throw Error('READER_BINDING_REVOKED');
                const snapshot = activeExecution.snapshot;
                if (snapshot.readRevision !== request.readRevision)
                    throw Error('READER_READ_BASIS_CHANGED');
                const plan = activeExecution.program.documents.find(row => row.documentPlanSha256 === documentPlanSha256);
                if (!plan || plan.writes !== 'source-regex' || plan.origin.encoding !== 'reader-regex-document-origin-v1')
                    throw Error('READER_NAMESPACE_WRITE_UNAVAILABLE');
                const capture = request.selector ? createAuthorNativeMessageVariables(snapshot).resolve(request.selector, true).capture
                    : snapshot.ordinaryChat;
                const envelope = ordinaryStore.beginReader(target, prepareOrdinaryAuthorChatBatchV3(capture.root, request.nextVariables, request.operationId, readerNativeNamespaceCauseV1(plan.origin)));
                ordinary = ordinaryStore.readReader(options.sessionId);
                writing = true;
                notifyPending();
                try {
                    const reply = await transport({ action: 'mutate-reader-namespace', binding: target, documentPlanSha256, request }, signal);
                    if (!reply.ok || reply.kind !== 'reader-namespace-mutated')
                        throw Error('AUTHOR_CHAT_WRITE_ACK_UNKNOWN');
                    const code = recordOrdinary(envelope, true);
                    writing = false;
                    if (current() && realm === owner)
                        adoptSnapshot(reply.snapshot);
                    if (!reply.snapshot && reply.reply.kind !== 'no-update')
                        retireFrameAfterReceipt(owner, true);
                    if (current()) {
                        if (code || held())
                            notifyPending(code);
                        else
                            notifyReady();
                    }
                    return { reply: reply.reply, ...reply.snapshot ? { snapshot: reply.snapshot } : {} };
                }
                catch (error) {
                    writing = false;
                    const code = error instanceof Error ? error.message : 'AUTHOR_CHAT_WRITE_ACK_UNKNOWN', warning = recordOrdinary(envelope, false, code);
                    if (current())
                        notifyPending(warning ?? code);
                    retireFrameAfterReceipt(owner, true);
                    throw error;
                }
            },
            async mutateMessageBody(value, documentPlanSha256, request, signal) {
                if (!current() || realm !== owner || !sameBinding(binding, value) || !activeExecution)
                    throw Error('READER_BINDING_REVOKED');
                const envelope = store.beginReaderBody(target, documentPlanSha256, bodyOrigin(activeExecution.program.documents.find(row => row.documentPlanSha256 === documentPlanSha256)), request);
                messageBodies = store.readReaderBodies(options.sessionId);
                writing = true;
                notifyPending();
                try {
                    const reply = await transport({ action: 'mutate-reader-message-body', binding: target,
                        documentPlanSha256, request: envelope.request }, signal);
                    if (!reply.ok || reply.kind !== 'reader-message-body-mutated')
                        throw Error('READER_MESSAGE_BODY_ACK_UNKNOWN');
                    const code = recordBody(envelope, reply.result);
                    writing = false;
                    if (reply.result.kind === 'committed' || reply.result.kind === 'unknown')
                        retireFrameAfterReceipt(owner, true);
                    if (current()) {
                        if (code || held())
                            notifyPending(code);
                        else
                            notifyReady();
                    }
                    return { result: reply.result };
                }
                catch (error) {
                    writing = false;
                    const code = error instanceof Error ? error.message : 'READER_MESSAGE_BODY_ACK_UNKNOWN';
                    recordBody(envelope, undefined, code);
                    if (current())
                        notifyPending(code);
                    retireFrameAfterReceipt(owner, true);
                    throw error;
                }
            },
            closeBinding: async (value) => { await transport({ action: 'release-reader-binding', binding: value }); },
            async executeCommands(value, documentPlanSha256, request, signal) {
                if (!current() || realm !== owner || !sameBinding(binding, value))
                    throw Error('READER_BINDING_REVOKED');
                const reply = await transport({ action: 'execute-reader-commands', binding: target, documentPlanSha256, request }, signal);
                if (!reply.ok || reply.kind !== 'reader-commands-executed')
                    throw Error('AUTHOR_NATIVE_COMMAND_ACK_UNKNOWN');
                if (current() && realm === owner)
                    adoptSnapshot(reply.snapshot);
                return reply;
            },
            async replaceNumerical(value, documentPlanSha256, readRevision, operation, signal) {
                if (!current() || realm !== owner || !sameBinding(binding, value))
                    throw Error('READER_BINDING_REVOKED');
                const envelope = store.beginReaderNumerical(target, documentPlanSha256, readRevision, operation);
                numerical = envelope;
                writing = true;
                notifyPending();
                let reply;
                try {
                    const result = await transport({ action: 'save-reader-numerical', binding: target,
                        documentPlanSha256, readRevision, operation: envelope.operation }, signal);
                    if (!result.ok || result.kind !== 'reader-numerical-saved')
                        throw Error('READER_WRITE_ACK_UNKNOWN');
                    reply = result;
                }
                catch (error) {
                    writing = false;
                    recordNumerical(envelope);
                    if (current() && realm === owner && sameBinding(binding, target))
                        revoke();
                    if (current())
                        notifyPending(error instanceof Error ? error.message : 'READER_WRITE_ACK_UNKNOWN');
                    throw error;
                }
                writing = false;
                if (current() && realm === owner)
                    adoptSnapshot(reply.snapshot);
                const code = recordNumerical(envelope, reply.result);
                if (!terminalBrowserReceipt(reply.result)) {
                    if (current() && realm === owner && sameBinding(binding, target))
                        revoke();
                    if (current())
                        notifyPending(code ?? reply.result.code);
                }
                else if (current() && realm === owner && sameBinding(binding, target)) {
                    if (code)
                        notifyPending(code);
                    else
                        notifyReady();
                }
                return reply;
            },
            async mutateOpeningVariants(value, documentPlanSha256, request, signal) {
                if (!current() || realm !== owner || !sameBinding(binding, value))
                    throw Error('READER_BINDING_REVOKED');
                const envelope = store.beginReader(target, documentPlanSha256, request);
                pending = envelope;
                writing = true;
                notifyPending();
                let reply;
                try {
                    const result = await transport({ action: 'mutate-opening-variants', binding: target,
                        documentPlanSha256, request: envelope.request }, signal);
                    if (!result.ok || result.kind !== 'opening-variants-mutated')
                        throw Error('READER_WRITE_ACK_UNKNOWN');
                    reply = result;
                }
                catch (error) {
                    writing = false;
                    const code = error instanceof Error ? error.message : 'READER_WRITE_ACK_UNKNOWN';
                    try {
                        const recorded = store.recordReader(envelope, undefined, code);
                        if (pending?.request.operationId === envelope.request.operationId)
                            pending = recorded;
                    }
                    catch {
                        if (pending?.request.operationId === envelope.request.operationId)
                            pending = { ...envelope, state: 'unknown', code };
                    }
                    if (current() && realm === owner && sameBinding(binding, target))
                        revoke();
                    if (current())
                        notifyPending(code);
                    throw error;
                }
                writing = false;
                if (current() && realm === owner)
                    adoptSnapshot(reply.snapshot);
                const storageCode = recordResult(envelope, reply.result);
                if (reply.result.kind === 'unknown') {
                    if (current() && realm === owner && sameBinding(binding, target))
                        revoke();
                    if (current())
                        notifyPending(reply.result.code);
                }
                else if (current() && realm === owner && sameBinding(binding, target)) {
                    if (storageCode)
                        notifyPending(storageCode);
                    else
                        notifyReady();
                }
                navigateCommitted(owner, envelope, reply.result);
                return { result: reply.result, ...reply.snapshot ? { snapshot: reply.snapshot } : {} };
            },
        };
    }
    function apply(execution, render) {
        if (held()) {
            queued = { execution, render };
            revoke();
            notifyPending();
            return;
        }
        const key = execution.program.programSha256 + ':' + execution.backend
            + ':' + (execution.binding?.browserSessionId ?? 'readonly') + ':' + (execution.binding?.generation ?? '');
        if (key !== identity || !frame) {
            revoke();
            identity = key;
            const owner = {};
            realm = owner;
            binding = execution.binding;
            activeExecution = execution;
            const surface = options.surface?.(), outer = surface?.outer ?? options.container.ownerDocument.createElement('iframe');
            if (!surface) {
                outer.className = 'rp-author-guard-frame';
                outer.title = '作者正则阅读文档';
                options.container.append(outer);
            }
            const target = execution.binding ?? { sessionId: options.sessionId, browserSessionId: crypto.randomUUID(),
                generation: execution.snapshot.generation, programSha256: execution.program.programSha256 };
            options.status({ kind: 'starting' });
            const frameOptions = {
                surface, ...execution.binding ? { host: host(owner, execution.binding) } : {},
                current: () => current() && realm === owner,
                mountStaticDocument: (container, html, layout) => mountStaticAuthorDocument(container, html, {
                    current: () => current() && realm === owner, fill: options.fill, layout
                }),
                layout: () => { }, startupDeadlineMs: 15000,
                diagnostic: code => { if (current() && realm === owner)
                    options.status({ kind: 'starting', code }); },
                failed: code => {
                    if (!current() || realm !== owner)
                        return;
                    revoke(code === 'READER_COMMITTED_SOURCE_REVOKED' ? owner : undefined);
                    if (held())
                        notifyPending(code);
                    else
                        options.status({ kind: 'failed', code });
                },
                onImages: (pageId, values) => { if (current() && realm === owner)
                    options.images?.(owner, pageId, values); },
            };
            const factory = options.createFrame ?? createReaderNativeDocumentFrameFactory(execution.program.documents, options.nativeLibraries, { parentOrigins: execution.parentOrigins });
            const controller = factory(outer, target, execution.program, frameOptions);
            frame = controller;
            void controller.started.then(() => {
                if (current() && realm === owner) {
                    if (held())
                        notifyPending();
                    else
                        notifyReady();
                }
            }).catch(() => { });
        }
        activeExecution = execution;
        frame.render({ ...render, css: scopeReaderCss(render.css), renderRevision: ++revision });
        frame.publishSnapshot(execution.snapshot);
    }
    async function drainUpdates() {
        if (updating)
            return;
        updating = true;
        try {
            while (queued && current()) {
                if (held()) {
                    if (!writing && frame) {
                        await frame.waitForReceiptObservation();
                        if (current())
                            revoke();
                    }
                    notifyPending();
                    break;
                }
                // Only an admitted Source callback pins the old scene. Actor
                // Promise settlements and Host completions remain runnable.
                if (frame) {
                    if (await frame.waitForReceiptObservation() === 'unavailable') {
                        if (current())
                            options.status({ kind: 'failed', code: 'READER_NATIVE_RECEIPT_UNOBSERVED' });
                        return;
                    }
                }
                if (navigation)
                    break;
                if (!current() || !queued)
                    break;
                const next = queued;
                queued = undefined;
                apply(next.execution, next.render);
            }
        }
        finally {
            updating = false;
        }
    }
    async function recover(action) {
        if (numerical && numerical.state !== 'terminal')
            return recoverNumerical(action === 'retry-opening-variants');
        if (!pending || writing || recovering)
            return false;
        const envelope = pending, owner = realm;
        let code;
        recovering = true;
        notifyPending();
        try {
            const reply = await transport({ action, sessionId: options.sessionId, operationId: envelope.request.operationId });
            if (!reply.ok || reply.kind !== 'opening-variants-confirmed')
                throw Error('READER_WRITE_ACK_UNKNOWN');
            code = recordResult(envelope, reply.result) ?? (reply.result.kind === 'unknown' ? reply.result.code : undefined);
            navigateCommitted(owner, envelope, reply.result);
            return pending?.request.operationId === envelope.request.operationId && reply.result.kind !== 'unknown';
        }
        catch (error) {
            code = error instanceof Error ? error.message : 'READER_WRITE_ACK_UNKNOWN';
            return false;
        }
        finally {
            recovering = false;
            if (current()) {
                if (code || held())
                    notifyPending(code);
                else
                    notifyInactive();
            }
        }
    }
    async function recoverNumerical(retry) {
        if (!numerical || writing || recovering)
            return false;
        const envelope = numerical;
        recovering = true;
        notifyPending();
        let code;
        try {
            const reply = await transport({ action: retry ? 'retry-reader-numerical' : 'confirm-reader-numerical',
                operation: envelope.operation });
            if (!reply.ok || reply.kind !== 'reader-numerical-saved')
                throw Error('READER_WRITE_ACK_UNKNOWN');
            const storageCode = recordNumerical(envelope, reply.result), terminal = terminalBrowserReceipt(reply.result);
            code = storageCode ?? (!terminal ? reply.result.code : undefined);
            if (storageCode || !terminal)
                return false;
            // Confirmation returns durable facts; it cannot revive the old
            // Source callback or lend its binding to a newly opened page.
            releaseQueued();
            revoke();
            return true;
        }
        catch (error) {
            code = error instanceof Error ? error.message : 'READER_WRITE_ACK_UNKNOWN';
            return false;
        }
        finally {
            recovering = false;
            if (current()) {
                if (code || held())
                    notifyPending(code);
                else
                    notifyInactive();
            }
        }
    }
    async function recoveryExecution() {
        return queued?.execution ?? await new Promise(resolve => {
            recapture = resolve;
            if (options.requestRecapture)
                options.requestRecapture();
            else {
                recapture = undefined;
                resolve(undefined);
            }
        });
    }
    function recoveryDocument(execution, original) {
        return execution.program.documents.find(row => {
            if (row.writes !== 'source-regex' || row.origin.encoding !== 'reader-regex-document-origin-v1')
                return false;
            const actual = readerNativeSourceOriginV1(row.origin);
            return actual.sourceRecordSessionId === original.sourceRecordSessionId && actual.importId === original.importId
                && actual.rawSha256 === original.rawSha256 && actual.descriptorSha256 === original.descriptorSha256
                && actual.htmlSha256 === original.htmlSha256 && actual.htmlSpan.start === original.htmlSpan.start
                && actual.htmlSpan.end === original.htmlSpan.end && actual.carrier.seq === original.carrier.seq
                && actual.carrier.messageId === original.carrier.messageId;
        });
    }
    async function recoverOrdinary(operationId, retry) {
        const envelope = ordinary.find(row => row.operation.operationId === operationId);
        if (!envelope || writing || recovering)
            return false;
        recovering = true;
        notifyPending();
        let code;
        try {
            if (retry) {
                const execution = await recoveryExecution();
                if (!execution?.binding)
                    throw Error('READER_NAMESPACE_DOCUMENT_UNAVAILABLE');
                const plan = recoveryDocument(execution, envelope.operation.cause);
                if (!plan)
                    throw Error('READER_NAMESPACE_DOCUMENT_UNAVAILABLE');
                const reply = await transport({ action: 'retry-reader-namespace', binding: execution.binding,
                    documentPlanSha256: plan.documentPlanSha256, operation: envelope.operation });
                if (!reply.ok || reply.kind !== 'reader-namespace-mutated')
                    throw Error('AUTHOR_CHAT_WRITE_ACK_UNKNOWN');
                code = recordOrdinary(envelope, true);
            }
            else {
                const reply = await transport({ action: 'confirm-reader-namespace', sessionId: options.sessionId, operation: envelope.operation });
                if (!reply.ok || reply.kind !== 'reader-namespace-confirmed')
                    throw Error('AUTHOR_CHAT_RECEIPT_UNAVAILABLE');
                if (reply.receipt.kind !== 'applied') {
                    code = reply.receipt.kind === 'pending' ? 'AUTHOR_CHAT_RECEIPT_PENDING' : 'AUTHOR_CHAT_RECEIPT_UNCONFIRMED';
                    code = recordOrdinary(envelope, false, code) ?? code;
                    return false;
                }
                code = recordOrdinary(envelope, true);
            }
            if (code)
                return false;
            releaseQueued();
            revoke();
            if (current())
                options.requestRecapture?.();
            return true;
        }
        catch (error) {
            code = error instanceof Error ? error.message : 'AUTHOR_CHAT_RECEIPT_UNAVAILABLE';
            code = recordOrdinary(envelope, false, code) ?? code;
            return false;
        }
        finally {
            recovering = false;
            if (current())
                notifyPending(code);
        }
    }
    async function recoverBody(operationId, retry) {
        const envelope = messageBodies.find(row => row.request.operationId === operationId);
        if (!envelope || writing || recovering)
            return false;
        recovering = true;
        notifyPending();
        let code;
        try {
            let request = { action: 'confirm-reader-message-body', sessionId: options.sessionId, operationId };
            if (retry) {
                const execution = await recoveryExecution();
                if (!execution?.binding)
                    throw Error('READER_MESSAGE_BODY_DOCUMENT_UNAVAILABLE');
                const original = envelope.origin;
                const plan = recoveryDocument(execution, original);
                if (!plan)
                    throw Error('READER_MESSAGE_BODY_DOCUMENT_UNAVAILABLE');
                request = { action: 'retry-reader-message-body', binding: execution.binding,
                    documentPlanSha256: plan.documentPlanSha256, request: envelope.request, origin: original };
            }
            const reply = await transport(request);
            if (!reply.ok || reply.kind !== (retry ? 'reader-message-body-mutated' : 'reader-message-body-confirmed'))
                throw Error('READER_MESSAGE_BODY_ACK_UNKNOWN');
            if (!('result' in reply))
                throw Error('READER_MESSAGE_BODY_ACK_UNKNOWN');
            const result = reply.result;
            code = recordBody(envelope, result) ?? (result.kind === 'unknown' ? result.code : undefined);
            if (result.kind === 'unknown' || code)
                return false;
            releaseQueued();
            revoke();
            options.requestRecapture?.();
            return true;
        }
        catch (error) {
            code = error instanceof Error ? error.message : 'READER_MESSAGE_BODY_ACK_UNKNOWN';
            return false;
        }
        finally {
            recovering = false;
            if (current())
                notifyPending(code);
        }
    }
    // Cold confirmation reads the original operation; it never revives Source.
    // The view installs this controller in its current-owner ref after the
    // constructor returns. Cold confirmation must not inspect that ref early.
    if (messageBodies.some(row => row.state !== 'terminal') || ordinary.some(row => !row.manualReleased))
        void Promise.resolve().then(async () => {
            for (const row of messageBodies)
                if (current() && row.state !== 'terminal')
                    await recoverBody(row.request.operationId, false);
            for (const row of ordinary)
                if (current() && !row.manualReleased)
                    await recoverOrdinary(row.operation.operationId, false);
        });
    return {
        hasFrame: () => !!frame,
        invalidate() {
            if (active) {
                recapture?.(undefined);
                recapture = undefined;
                releaseQueued();
                revoke();
                if (held())
                    notifyPending();
                else
                    notifyInactive();
            }
        },
        update(execution, render) {
            if (!current())
                return;
            if (queued?.execution.binding && (!execution.binding || !sameBinding(execution.binding, queued.execution.binding))
                && !sameBinding(binding, queued.execution.binding))
                release(queued.execution.binding);
            queued = { execution, render };
            const waiting = recapture;
            recapture = undefined;
            waiting?.(execution);
            void drainUpdates();
        },
        confirm: () => recover('confirm-opening-variants'),
        retry: () => recover('retry-opening-variants'),
        confirmMessageBody: (operationId) => recoverBody(operationId, false),
        retryMessageBody: (operationId) => recoverBody(operationId, true),
        confirmOrdinary: (operationId) => recoverOrdinary(operationId, false),
        retryOrdinary: (operationId) => recoverOrdinary(operationId, true),
        showCurrentPageWithOrdinaryUnknown(operationId) {
            const envelope = ordinary.find(row => row.operation.operationId === operationId);
            if (!envelope)
                return;
            let code;
            try {
                ordinaryStore.release(envelope);
            }
            catch {
                code = 'AUTHOR_CHAT_RELEASE_LOCAL_ONLY';
            }
            ordinary = ordinaryStore.readReader(options.sessionId);
            revoke();
            if (current()) {
                if (code || held())
                    notifyPending(code);
                else
                    notifyInactive();
                if (queued)
                    void drainUpdates();
                else
                    options.requestRecapture?.();
            }
        },
        releasePending() {
            if (!pending)
                return;
            store.releaseReader(pending);
            pending = { ...pending, manualReleased: true };
            releaseQueued();
            revoke();
            if (current())
                notifyInactive();
        },
        dispose() { if (!active)
            return; active = false; recapture?.(undefined); recapture = undefined; releaseQueued(); revoke(); },
    };
}
