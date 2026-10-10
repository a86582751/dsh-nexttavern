// Generated from runtime/alpha3/src/core/tavern-author-browser-frame-v2.ts; edit the TypeScript source.
/** Main parent owns the actual Worker, deadlines, native gesture admission and
 * resource realm. Browser transport DATA cannot mint any of these owners. */
import { quantifyBrowserTransport, BROWSER_BUDGET_V1 } from './tavern-author-browser-budget.js';
const escape = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
function html(javascript, id, config, nonce, child) {
    const policy = "default-src 'none'; script-src 'nonce-" + nonce + "'; style-src 'unsafe-inline'; " +
        "connect-src 'none'; img-src " + (child ? 'https: http: data: blob:' : "'none'") + "; media-src 'none'; " +
        "font-src 'none'; frame-src " + (child ? "'none'" : 'about:') + "; worker-src 'none'; object-src 'none'; " +
        "form-action 'none'; base-uri 'none'";
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + policy + '">' +
        '<style>html,body{margin:0;overflow:hidden}</style><body><script type="application/json" nonce="' + nonce + '" id="' + id + '">' +
        escape(config) + '</script><script nonce="' + nonce + '">' + javascript.replace(/<\/script/gi, '<\\/script') + '</script></body>';
}
export function createBrowserRuntimeFrameV2(outer, artifact, binding, program, host, options) {
    const nonce = crypto.randomUUID(), abort = new AbortController();
    const workerURL = URL.createObjectURL(new Blob([artifact.executionWorkerJavascript], { type: 'text/javascript' }));
    const worker = new Worker(workerURL, { type: 'module' });
    let active = true, port = null, initialized = false, sequence = 0;
    let latest, pendingRender;
    let registrations = [];
    let resolveStarted = () => { }, rejectStarted = () => { };
    const started = new Promise((resolve, reject) => { resolveStarted = resolve; rejectStarted = reject; });
    const pendingGeneration = new Map();
    const work = new Map(), gestures = new Map();
    let hostWaitClock = false;
    let timer = 0, startedComplete = false;
    const current = () => active && options.current();
    const send = (message) => { if (current())
        worker.postMessage(message); };
    function deadline() {
        window.clearTimeout(timer);
        if (!startedComplete)
            timer = window.setTimeout(() => fail('BROWSER_WORKER_DEADLINE'), options.startupDeadlineMs);
    }
    function workDeadline(id) {
        const clock = work.get(id);
        if (!clock)
            return;
        if (clock.waiting && clock.hostRequests.size > 0) {
            if (clock.activeSince !== undefined)
                clock.remaining -= performance.now() - clock.activeSince;
            window.clearTimeout(clock.timer);
            clock.timer = undefined;
            clock.activeSince = undefined;
        }
        else if (clock.activeSince === undefined) {
            clock.activeSince = performance.now();
            clock.timer = window.setTimeout(() => fail('BROWSER_WORKER_DEADLINE'), Math.max(0, clock.remaining));
        }
    }
    function dispose() {
        if (!active)
            return;
        active = false;
        abort.abort();
        window.clearTimeout(timer);
        for (const clock of work.values())
            window.clearTimeout(clock.timer);
        // Termination is independent of guest responsiveness and provider replies.
        worker.terminate();
        URL.revokeObjectURL(workerURL);
        gestures.clear();
        work.clear();
        port?.postMessage({ type: 'dispose' });
        port?.close();
        port = null;
        window.removeEventListener('message', guardMessage);
        outer.removeAttribute('srcdoc');
        rejectStarted(Error('BROWSER_GENERATION_REVOKED'));
        for (const pending of pendingGeneration.values())
            pending.resolve({ kind: 'cancelled', binding,
                invocationId: pending.invocation.invocationId, diagnostics: [{ code: 'BROWSER_GENERATION_REVOKED' }] });
        pendingGeneration.clear();
    }
    function fail(code) { if (!active)
        return; options.diagnostic(code); rejectStarted(Error(code)); dispose(); options.failed?.(code); }
    function initialize() {
        if (!current() || !port || !childDocument || !latest || initialized)
            return;
        initialized = true;
        port.postMessage({ type: 'snapshot', persona: latest.persona });
        if (pendingRender)
            port.postMessage({ type: 'render', render: pendingRender });
        const bytes = Uint8Array.from(atob(artifact.wasm.data), character => character.charCodeAt(0));
        send({ type: 'start', binding, program, snapshot: latest, document: childDocument, wasm: bytes.buffer,
            worldbookOperationPrefix: nonce });
    }
    let childDocument;
    function childMessage(event) {
        const message = event.data;
        if (!current())
            return;
        if (message.type === 'child-ready') {
            childDocument = message.document;
            initialize();
        }
        else if (message.type === 'rpc-result')
            send({ type: 'dom-result', id: message.id, value: message.value, error: message.error });
        else if (message.type === 'callback') {
            let gestureId;
            // Only the trusted child MessagePort can report the native default form
            // chain. The main parent binds its own token to this live callback.
            if (message.trustedFormGesture) {
                gestureId = crypto.randomUUID();
                gestures.set(gestureId, { callbackId: message.callbackId, scriptIdentity: message.scriptIdentity, consumed: false });
            }
            send({ ...message, gestureId });
        }
        else if (message.type === 'layout') {
            outer.style.height = Math.ceil(message.height) + 'px';
            outer.contentWindow?.postMessage({ v: 2, nonce, generation: binding.generation, type: 'height', height: message.height }, '*');
            options.layout({ height: message.height, renderRevision: message.renderRevision });
        }
    }
    async function hostRequest(message, synchronous = false) {
        const { payload, id } = message;
        const script = program.scripts.find(row => row.descriptor.identity === payload.scriptIdentity);
        const type = synchronous ? 'dom-result' : 'host-result';
        if (!script) {
            send({ type, id, error: 'BROWSER_SCRIPT_NOT_OWNED' });
            return;
        }
        const clock = work.get(message.workId);
        const observedWait = hostWaitClock && ['generate-raw', 'save', 'mutate-worldbook', 'mutate-persona'].includes(payload.kind);
        const legacyRaw = !hostWaitClock && payload.kind === 'generate-raw';
        let waitOwned = false;
        const beginHostWait = () => {
            if (clock && (observedWait || legacyRaw)) {
                waitOwned = true;
                clock.hostRequests.add(id);
                // Old immutable Workers report no Actor wait protocol. Retain their
                // qualified provider-wait behavior while new Workers prove guest idleness.
                if (legacyRaw)
                    clock.waiting = true;
                workDeadline(message.workId);
            }
        };
        try {
            let value;
            if (payload.kind === 'generate-raw') {
                const gesture = gestures.get(payload.request.gestureId);
                if (!gesture || gesture.consumed || gesture.scriptIdentity !== payload.scriptIdentity
                    || gesture.callbackId !== payload.callbackId || !host.generateRaw)
                    throw Error('BROWSER_TRUSTED_FORM_REQUIRED');
                gesture.consumed = true;
                gestures.delete(payload.request.gestureId);
                beginHostWait();
                value = await host.generateRaw(binding, payload.request, abort.signal);
            }
            else if (payload.kind === 'update-author-chat') {
                if (!host.updateAuthorChat || program.ownedChatWriter?.ordinal !== script.ordinal)
                    throw Error('BROWSER_CHAT_UPDATE_NOT_ADMITTED');
                value = await host.updateAuthorChat(binding, payload.request, abort.signal);
            }
            else if (payload.kind === 'source-resource') {
                if (!host.readSourceResource || !script.requiredCapabilities.includes('owned-script-source-resources')) {
                    throw Error('AUTHOR_SCRIPT_RESOURCE_UNAVAILABLE');
                }
                const request = { schemaVersion: 1,
                    encoding: 'native-author-script-resource-request-v1', scriptIdentity: script.descriptor.identity,
                    descriptorSha256: script.descriptorSha256, sourceSnapshotSha256: latest.basis.sourceSnapshotSha256,
                    operation: payload.operation };
                value = await host.readSourceResource(binding, request, abort.signal);
            }
            else if (payload.kind === 'save') {
                beginHostWait();
                value = await host.save(binding, payload.request, abort.signal);
            }
            else if (payload.kind === 'mutate-worldbook') {
                if (!host.mutateWorldbook || !script.requiredCapabilities.includes('owned-named-worldbooks')) {
                    throw Error('AUTHOR_WORLDBOOK_UNAVAILABLE');
                }
                beginHostWait();
                const reply = await host.mutateWorldbook(binding, payload.request, abort.signal);
                value = reply;
                if (reply.result.kind === 'edited-data') {
                    if (!reply.snapshot) {
                        // The publication receipt remains Core-owned. A revoked Owner
                        // cannot use that success to resume this author continuation.
                        fail('BROWSER_GENERATION_REVOKED');
                        return;
                    }
                    publishSnapshot(reply.snapshot);
                }
            }
            else if (payload.kind === 'mutate-persona') {
                if (!host.mutatePersona || !script.requiredCapabilities.includes('owned-native-personas')) {
                    throw Error('NATIVE_PERSONA_UNAVAILABLE');
                }
                beginHostWait();
                const reply = await host.mutatePersona(binding, payload.request, abort.signal);
                value = reply;
                if (reply.result.kind === 'committed') {
                    if (!reply.snapshot) {
                        fail('BROWSER_GENERATION_REVOKED');
                        return;
                    }
                    publishSnapshot(reply.snapshot);
                }
            }
            else
                throw Error('BROWSER_HOST_OPERATION_UNSUPPORTED');
            if (current())
                send({ type, id, value });
        }
        catch (error) {
            if (current())
                send({ type, id, error: error instanceof Error ? error.message : 'BROWSER_HOST_OPERATION_FAILED' });
        }
        finally {
            if (clock && waitOwned) {
                clock.hostRequests.delete(id);
                if (legacyRaw) {
                    clock.waiting = false;
                    clock.remaining = options.startupDeadlineMs;
                }
                workDeadline(message.workId);
            }
        }
    }
    worker.addEventListener('message', event => {
        const message = event.data;
        if (!current())
            return;
        if (message.type === 'dom-rpc') {
            if (message.payload.op === 'author-chat-update')
                void hostRequest({ ...message,
                    payload: { ...message.payload, kind: 'update-author-chat' } }, true);
            else if (message.payload.op === 'source-resource')
                void hostRequest({ ...message,
                    payload: { ...message.payload, kind: 'source-resource' } }, true);
            else if (message.payload.op === 'persona-mutation')
                void hostRequest({ ...message,
                    payload: { ...message.payload, kind: 'mutate-persona' } }, true);
            else
                port?.postMessage({ type: 'rpc', id: message.id, payload: message.payload });
        }
        else if (message.type === 'host-rpc')
            void hostRequest(message);
        else if (message.type === 'clock-protocol')
            hostWaitClock = message.clock === 'host-wait-v1';
        else if (message.type === 'startup-complete') {
            registrations = message.registrations;
            startedComplete = true;
            deadline();
            resolveStarted();
        }
        else if (message.type === 'work-start') {
            work.set(message.id, { remaining: options.startupDeadlineMs, waiting: false, hostRequests: new Set() });
            workDeadline(message.id);
        }
        else if (message.type === 'work-wait' || message.type === 'work-resume') {
            const clock = work.get(message.id);
            if (clock) {
                clock.waiting = message.type === 'work-wait';
                workDeadline(message.id);
            }
        }
        else if (message.type === 'work-end') {
            const clock = work.get(message.id);
            window.clearTimeout(clock?.timer);
            work.delete(message.id);
        }
        else if (message.type === 'generation-result') {
            const pending = pendingGeneration.get(message.id);
            if (pending) {
                pendingGeneration.delete(message.id);
                pending.resolve(message.result);
            }
        }
        else if (message.type === 'handler-error')
            options.diagnostic(message.code);
        else if (message.type === 'runtime-error' || message.type === 'startup-failed')
            fail(message.code);
    });
    worker.addEventListener('error', () => fail('BROWSER_WORKER_FAILED'));
    function guardMessage(event) {
        const message = event.data;
        if (!current() || event.source !== outer.contentWindow || message?.v !== 2 || message.nonce !== nonce || message.generation !== binding.generation)
            return;
        if (message.type === 'guard-failed') {
            fail('BROWSER_REALM_NAVIGATED');
            return;
        }
        if (message.type !== 'transport-ready' || port)
            return;
        const channel = new MessageChannel();
        port = channel.port1;
        port.onmessage = childMessage;
        port.start();
        outer.contentWindow?.postMessage({ v: 2, nonce, generation: binding.generation, type: 'bind' }, '*', [channel.port2]);
    }
    const publishSnapshot = (snapshot) => {
        if (!current())
            return;
        quantifyBrowserTransport(snapshot, BROWSER_BUDGET_V1.snapshotBytes);
        if (latest && snapshot.readRevision < latest.readRevision)
            return;
        latest = snapshot;
        if (initialized) {
            send({ type: 'snapshot', snapshot });
            port?.postMessage({ type: 'snapshot', persona: snapshot.persona });
        }
        else
            initialize();
    };
    window.addEventListener('message', guardMessage);
    outer.referrerPolicy = 'no-referrer';
    const child = html(artifact.childJavascript, 'owned-browser-runtime-config', {
        nonce, binding, baseURI: document.baseURI, mediaSources: program.scripts.flatMap(script => script.mediaSources)
    }, nonce, true);
    outer.srcdoc = html(artifact.guardJavascript, 'owned-browser-guard-config', {
        nonce, generation: binding.generation, childDocument: child
    }, nonce, false);
    deadline();
    host.capture(binding, abort.signal).then(publishSnapshot).catch(() => { if (current())
        fail('BROWSER_SNAPSHOT_UNAVAILABLE'); });
    return {
        started, get registrations() { return registrations; }, dispose, publishSnapshot,
        render(render) {
            if (!current())
                return;
            quantifyBrowserTransport(render, BROWSER_BUDGET_V1.snapshotBytes);
            pendingRender = render;
            if (initialized)
                port?.postMessage({ type: 'render', render });
        },
        publishSaveConfirmation(reply) { publishSnapshot(reply.snapshot); },
        invokeGeneration(invocation) {
            if (!current())
                return Promise.resolve({ kind: 'cancelled', binding, invocationId: invocation.invocationId,
                    diagnostics: [{ code: 'BROWSER_GENERATION_REVOKED' }] });
            const id = 'generation:' + ++sequence;
            return new Promise(resolve => {
                pendingGeneration.set(id, { resolve, invocation });
                send({ type: 'generation', id, invocation });
            });
        },
    };
}
