// Generated from runtime/alpha3/src/core/tavern-author-browser-frame-v3.ts; edit the TypeScript source.
/** Main owns the real Worker and native scene. Author JavaScript runs only in
 * QuickJS; native wait ACKs never require another entry into that Actor. */
import { createBrowserNativeSceneV3 } from './tavern-author-browser-native-scene-v3.js';
import { BROWSER_NATIVE_INERT_SHELL_V3 } from './tavern-author-browser-frame-native-v3.js';
/** Main owns both minting and consumption. A guest's serialized Event fields
 * never enter this owner; only the Native scene passes its actual Event. */
export function createBrowserGenerationGesturesV3(program, current, userActivation) {
    const gestures = new Map();
    let approvedEvents = new WeakMap();
    const submitOrigins = new Map();
    function observe(event, pageId, scriptIdentity) {
        if (!program.generationDeclarationId || !current())
            return;
        const trusted = event.isTrusted && userActivation();
        if (event.type === 'submit') {
            // A browser-created submit can also follow Source's button.click(). Only
            // an actual captured user click/Enter on this form supplies its origin.
            const form = submitOrigins.get(pageId);
            submitOrigins.delete(pageId);
            if (trusted && form === event.target)
                approvedEvents.set(event, { pageId, scriptIdentity });
            return;
        }
        if (event.type === 'click' || event.type === 'keydown') {
            submitOrigins.delete(pageId);
            if (trusted) {
                const target = event.composedPath().find(node => node.nodeType === 1);
                const control = target?.closest('button,input');
                if (control?.form && (event.type === 'click' && control.type === 'submit'
                    || event.type === 'keydown' && event.key === 'Enter'))
                    submitOrigins.set(pageId, control.form);
            }
        }
        if (trusted)
            approvedEvents.set(event, { pageId, scriptIdentity });
    }
    function prepare(delivery, scriptIdentity) {
        const event = delivery.nativeEvent;
        const approved = event && approvedEvents.get(event);
        if (!current() || delivery.resourceKind !== 'native-event'
            || approved?.pageId !== delivery.callback.pageId || approved.scriptIdentity !== scriptIdentity)
            return delivery;
        const gestureId = crypto.randomUUID();
        gestures.set(gestureId, { pageId: delivery.callback.pageId, callbackId: delivery.callback.callbackId, scriptIdentity });
        return { ...delivery, generation: { gestureId, scriptIdentity } };
    }
    function consume(request, invocation) {
        const gesture = gestures.get(request.gestureId);
        if (!current() || !gesture || gesture.pageId !== invocation.pageId || gesture.callbackId !== invocation.callbackId
            || gesture.scriptIdentity !== request.scriptIdentity)
            throw Error('BROWSER_TRUSTED_FORM_REQUIRED');
        gestures.delete(request.gestureId);
    }
    return { observe, prepare, consume, finish: (gestureId) => { gestures.delete(gestureId); },
        closePage: (pageId) => {
            submitOrigins.delete(pageId);
            for (const [id, gesture] of gestures)
                if (gesture.pageId === pageId)
                    gestures.delete(id);
        }, dispose: () => { gestures.clear(); submitOrigins.clear(); approvedEvents = new WeakMap(); } };
}
export function createBrowserRuntimeFrameV3(outer, artifact, binding, program, host, options) {
    const view = outer.ownerDocument.defaultView, abort = new AbortController(), operationPrefix = crypto.randomUUID();
    const workerURL = URL.createObjectURL(new Blob([artifact.executionWorkerJavascript], { type: 'text/javascript' }));
    const worker = new Worker(workerURL, { type: 'module' });
    let active = true, latest, initialized = false, entry;
    let scene;
    let generationSequence = 0;
    const registrationRequests = new Map();
    const generationRequests = new Map();
    let resolveStarted, rejectStarted, resolveDisposed;
    const started = new Promise((yes, no) => { resolveStarted = yes; rejectStarted = no; });
    const disposed = new Promise(yes => { resolveDisposed = yes; });
    const current = () => active && options.current();
    const gestures = createBrowserGenerationGesturesV3(program, current, () => view.navigator.userActivation.isActive);
    const send = (message) => { if (current())
        worker.postMessage(message); };
    let bootTimer = view.setTimeout(() => fail('BROWSER3_WORKER_DEADLINE'), options.startupDeadlineMs);
    function clock() {
        if (!entry)
            return;
        view.clearTimeout(entry.timer);
        if (entry.since !== undefined) {
            entry.remaining -= performance.now() - entry.since;
            entry.since = undefined;
        }
        if (!entry.waits.size) {
            entry.since = performance.now();
            entry.timer = view.setTimeout(() => fail('BROWSER3_WORKER_DEADLINE'), Math.max(0, entry.remaining));
        }
    }
    function dispose() {
        if (!active)
            return;
        active = false;
        abort.abort();
        view.clearTimeout(bootTimer);
        view.clearTimeout(entry?.timer);
        // Main termination remains independent of a busy or suspended guest. It
        // does not imply graceful VM disposal; Main still frees its own resources.
        gestures.dispose();
        const error = Error('BROWSER_GENERATION_REVOKED');
        for (const pending of registrationRequests.values())
            pending.reject(error);
        registrationRequests.clear();
        for (const pending of generationRequests.values()) {
            pending.cleanup();
            pending.reject(error);
        }
        generationRequests.clear();
        outer.removeEventListener('load', loaded);
        rejectStarted(Error('BROWSER_GENERATION_REVOKED'));
        // Core closes the attachment's prompt resources before removing its private
        // owner. This confirmation must survive termination of the guest Worker.
        void host.closeBinding(binding).catch(error => options.diagnostic(String(error)))
            .finally(async () => {
            worker.terminate();
            URL.revokeObjectURL(workerURL);
            try {
                await scene?.dispose();
            }
            catch (error) {
                options.diagnostic(String(error));
            }
            finally {
                outer.removeAttribute('src');
                outer.removeAttribute('srcdoc');
                resolveDisposed();
            }
        });
    }
    function fail(code) {
        if (!active)
            return;
        options.diagnostic(code);
        rejectStarted(Error(code));
        dispose();
        options.failed?.(code);
    }
    function deliver(delivery) {
        const { nativeEvent: _, ...wire } = delivery;
        send({ type: 'callback', delivery: wire });
    }
    async function source(payload) {
        if (payload.op === 'cleanup-prompts') {
            await host.cleanupPrompts(binding, payload.request, abort.signal);
            if (payload.request.kind === 'resource-closed') {
                const pageId = payload.request.resource.pageId;
                for (const [id, pending] of generationRequests)
                    if (pending.invocation.registrations
                        .some(row => row.resource.pageId === pageId)) {
                        generationRequests.delete(id);
                        pending.cleanup();
                        send({ type: 'generation-cancel', invocationId: id });
                        pending.resolve({ kind: 'cancelled', binding, invocationId: id,
                            diagnostics: [{ code: 'BROWSER_GENERATION_RESOURCE_RETIRED' }] });
                    }
            }
            return undefined;
        }
        if (payload.op === 'generate-raw') {
            gestures.consume(payload.request, payload.invocation);
            if (!host.generateRaw)
                throw Error('BROWSER_GENERATION_UNAVAILABLE');
            return host.generateRaw(binding, payload.request, abort.signal);
        }
        if (payload.op === 'source-resource')
            return host.readSourceResource(binding, payload.request, abort.signal);
        if (payload.op === 'replace-numerical' || payload.op === 'save')
            return host.save(binding, payload.request, abort.signal);
        if (payload.op === 'mutate-author-key') {
            const reply = await host.mutateAuthorKey(binding, payload.request, abort.signal);
            if (!reply.snapshot)
                throw Error('BROWSER_ATTACHMENT_REVOKED');
            latest = reply.snapshot;
            return reply;
        }
        if (payload.op === 'persona-mutation') {
            const reply = await host.mutatePersona(binding, payload.request, abort.signal);
            if (reply.result.kind === 'committed' && !reply.snapshot)
                throw Error('BROWSER_ATTACHMENT_REVOKED');
            if (reply.snapshot)
                latest = reply.snapshot;
            return reply;
        }
        if (payload.op === 'mutate-worldbook') {
            const reply = await host.mutateWorldbook(binding, payload.request, abort.signal);
            if (reply.result.kind === 'edited-data' && !reply.snapshot)
                throw Error('BROWSER_ATTACHMENT_REVOKED');
            if (reply.snapshot)
                latest = reply.snapshot;
            return reply;
        }
        throw Error('BROWSER3_HOST_OPERATION_UNSUPPORTED');
    }
    async function request(message) {
        const observed = entry?.id === message.actorEntry && message.request.op !== 'host' ? entry : undefined;
        // Only actual synchronous Asyncify/native waits suspend this entry clock.
        // An author-returned provider Promise leaves the VM free and cannot hide
        // a fire-and-forget busy loop behind its pending parent request.
        if (observed) {
            observed.waits.add(message.id);
            clock();
        }
        try {
            const result = message.request.op === 'source' || message.request.op === 'host'
                ? { value: await source(message.request.payload), frames: [] }
                : await scene.request(message.request);
            send({ type: 'result', id: message.id, ...result });
        }
        catch (error) {
            const code = error instanceof Error ? error.message : String(error);
            send({ type: 'result', id: message.id, error: code });
            if (code === 'BROWSER_ATTACHMENT_REVOKED')
                fail(code);
        }
        finally {
            if (observed && entry === observed) {
                observed.waits.delete(message.id);
                clock();
            }
        }
    }
    worker.addEventListener('error', event => fail(event.message || 'BROWSER3_WORKER_FAILED'));
    worker.addEventListener('message', event => {
        const message = event.data;
        if (!current())
            return;
        if (message.type === 'generation-registrations-result') {
            const pending = registrationRequests.get(message.id);
            if (pending) {
                registrationRequests.delete(message.id);
                if (message.error)
                    pending.reject(Error(message.error));
                else
                    pending.resolve(message.registrations);
            }
        }
        else if (message.type === 'generation-result-v3') {
            const pending = generationRequests.get(message.result.invocationId);
            if (pending) {
                generationRequests.delete(message.result.invocationId);
                pending.cleanup();
                pending.resolve(message.result);
            }
        }
        else if (message.type === 'rpc')
            void request(message);
        else if (message.type === 'actor-entry-start') {
            view.clearTimeout(bootTimer);
            view.clearTimeout(entry?.timer);
            entry = { id: message.id, remaining: options.startupDeadlineMs, waits: new Set() };
            clock();
        }
        else if (message.type === 'actor-entry-end') {
            if (entry && entry.id === message.id) {
                view.clearTimeout(entry.timer);
                entry = undefined;
            }
        }
        else if (message.type === 'startup-complete')
            resolveStarted();
        else if (message.type === 'runtime-error' || message.type === 'page-error')
            fail(message.code);
        else if (message.type === 'notice' && message.notice?.type === 'generation-invocation-ended')
            gestures.finish(message.notice.gestureId);
        else if (message.type === 'notice' && ['page-callback-error', 'source-callback-error'].includes(message.notice?.type))
            options.diagnostic(message.notice.error);
    });
    function initialize() {
        if (!current() || initialized || !scene || !latest)
            return;
        initialized = true;
        const bytes = Uint8Array.from(atob(artifact.wasm.data), character => character.charCodeAt(0));
        send({ type: 'start', binding, program, snapshot: latest, wasm: bytes.buffer, operationPrefix });
    }
    function loaded() {
        if (!current() || scene)
            return;
        const document = outer.contentDocument;
        document.open();
        document.write(BROWSER_NATIVE_INERT_SHELL_V3);
        document.close();
        scene = createBrowserNativeSceneV3({ program, schedulerWindow: view, onCallback: deliver,
            prepareCallback: gestures.prepare, onPageClosed: gestures.closePage,
            observeNativeEvent: program.generationDeclarationId ? gestures.observe : undefined,
            onSettlement: settlement => send({ type: 'settlement', settlement }),
            onFrameClosed: frameId => send({ type: 'frame-closed', frameId }),
            async createCarrierDocument(script, contextId, signal) {
                const iframe = document.createElement('iframe');
                iframe.title = '作者脚本 ' + script.ordinal;
                iframe.dataset.browserCarrier = contextId;
                iframe.style.cssText = 'display:block;width:100%;height:100%;min-height:600px;border:0';
                iframe.setAttribute('sandbox', 'allow-same-origin allow-forms');
                const carrierDocument = await new Promise((resolve, reject) => {
                    const finish = () => { iframe.removeEventListener('load', done); signal.removeEventListener('abort', cancel); };
                    const done = () => { finish(); resolve(iframe.contentDocument); };
                    const cancel = () => { finish(); iframe.remove(); reject(Error('BROWSER3_ATTACHMENT_CLOSED')); };
                    iframe.addEventListener('load', done, { once: true });
                    signal.addEventListener('abort', cancel, { once: true });
                    iframe.src = 'about:blank';
                    document.body.appendChild(iframe);
                });
                carrierDocument.open();
                carrierDocument.write(BROWSER_NATIVE_INERT_SHELL_V3);
                carrierDocument.close();
                return { document: carrierDocument, dispose: () => iframe.remove() };
            } });
        initialize();
    }
    outer.setAttribute('sandbox', 'allow-same-origin allow-forms');
    outer.style.cssText = 'display:block;width:100%;height:620px;border:0';
    outer.addEventListener('load', loaded);
    outer.src = 'about:blank';
    return { started, disposed, dispose,
        async generationCallbacks() {
            // Startup owns readiness. A later empty registry is valid after the
            // author's last eventOnce callback, and must not wait for another event.
            await started;
            if (!current())
                throw Error('BROWSER_GENERATION_REVOKED');
            const id = ++generationSequence;
            return new Promise((resolve, reject) => {
                registrationRequests.set(id, { resolve, reject });
                send({ type: 'generation-registrations-request', id });
            });
        },
        invokeGenerationV3(invocation, signal) {
            const cancelled = () => ({ kind: 'cancelled', binding, invocationId: invocation.invocationId,
                diagnostics: [{ code: 'BROWSER_GENERATION_REVOKED' }] });
            if (!current() || signal.aborted)
                return Promise.resolve(cancelled());
            return new Promise((resolve, reject) => {
                const stopped = () => {
                    generationRequests.delete(invocation.invocationId);
                    signal.removeEventListener('abort', stopped);
                    send({ type: 'generation-cancel', invocationId: invocation.invocationId });
                    resolve(cancelled());
                };
                generationRequests.set(invocation.invocationId, { invocation, resolve, reject,
                    cleanup: () => signal.removeEventListener('abort', stopped) });
                signal.addEventListener('abort', stopped, { once: true });
                send({ type: 'generation-invocation', invocation });
            });
        },
        publishSnapshot(value) { if (!current())
            return; latest = value; if (initialized)
            send({ type: 'snapshot', snapshot: value });
        else
            initialize(); },
        publishSaveConfirmation(value) { if (value.snapshot)
            this.publishSnapshot(value.snapshot); },
        publishSourceEvent(event) { send({ type: 'source-event', event }); },
        render(value) { options.layout({ height: outer.clientHeight, renderRevision: value.renderRevision }); }, };
}
