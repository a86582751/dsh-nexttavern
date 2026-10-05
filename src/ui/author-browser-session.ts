import {createBrowserRuntimeFrameV1} from '../core/tavern-author-browser-frame.js';
import type {AuthorBrowserReplyV1,AuthorBrowserRequestV1} from '../core/roleplay-author-browser-types.js';
import type {BrowserBindingV1,BrowserHostBridgeV1,BrowserRenderV1,BrowserSaveReplyV1,BrowserSnapshotV1}
    from '../core/tavern-author-browser-types.mjs';
import {createAuthorBrowserPendingStore,terminalBrowserReceipt}
    from './author-browser-pending.js';
import type {AuthorBrowserPendingV1} from './author-browser-pending.js';

export interface AuthorBrowserStatus {
    kind: 'loading' | 'inactive' | 'starting' | 'ready' | 'pending' | 'failed';
    code?: string;
    pending?: AuthorBrowserPendingV1;
}
export type AuthorBrowserTransport = (request: AuthorBrowserRequestV1, signal?: AbortSignal) => Promise<AuthorBrowserReplyV1>;
export const authorBrowserTransport: AuthorBrowserTransport = async (request, signal) => {
    const response = await fetch('/api/roleplay/author-browser', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(request), signal,
    });
    const reply = await response.json() as AuthorBrowserReplyV1;
    if (!response.ok || !reply.ok) throw Error(reply.ok ? 'BROWSER_TRANSPORT_FAILED' : reply.code);
    return reply;
};
const sameBinding = (a: BrowserBindingV1 | undefined, b: BrowserBindingV1) =>
    a?.generation === b.generation && a.browserSessionId === b.browserSessionId;

/** A Reader owns one live parent realm. Core owns its binding and captured
 * DATA; the durable pending operation survives this object's disposal. */
export function createAuthorBrowserSession(options: {
    sessionId: string;
    container: HTMLElement;
    current(): boolean;
    status(value: AuthorBrowserStatus): void;
    transport?: AuthorBrowserTransport;
    storage?: Pick<Storage, 'getItem' | 'setItem'>;
}) {
    const transport = async (request: AuthorBrowserRequestV1, signal?: AbortSignal) => {
        const reply = await (options.transport ?? authorBrowserTransport)(request, signal);
        if (!reply.ok) throw Error(reply.code);
        return reply;
    };
    const store = createAuthorBrowserPendingStore(options.storage ?? localStorage);
    let active = true, ready = false, binding: BrowserBindingV1 | undefined;
    let frame: ReturnType<typeof createBrowserRuntimeFrameV1> | undefined;
    let realm: object | undefined, captured: BrowserSnapshotV1 | undefined;
    const operationRealms = new Map<string, object>();
    let render: BrowserRenderV1 | undefined, revision = 0;
    let refreshing: Promise<void> | undefined, refreshAgain = false;
    let checking: Promise<void> | undefined;
    const current = () => active && options.current();
    const notify = (value: AuthorBrowserStatus) => {if (current()) options.status(value);};
    const release = (old: BrowserBindingV1) => {
        void transport({action: 'dispose', binding: old}).catch(() => {});
    };
    const revoke = () => {
        frame?.dispose();frame = undefined;ready = false;realm = undefined;captured = undefined;
        options.container.replaceChildren();
        if (binding) release(binding);
        binding = undefined;
    };
    async function installReceipt(envelope: AuthorBrowserPendingV1, result: Parameters<typeof store.record>[1],
        snapshot?: BrowserSaveReplyV1['snapshot']) {
        const next = store.record(envelope, result);
        if (!current()) return;
        if (!frame && next.state !== 'terminal') notify({kind: 'pending', pending: next, code: result?.code});
        const savedRealm = operationRealms.get(envelope.operation.operationId);
        if (!result || !savedRealm || savedRealm !== realm || !sameBinding(binding, envelope.binding) || !frame) return;
        if (!snapshot) {
            const captured = await transport({action: 'capture', binding: envelope.binding});
            if (captured.kind !== 'snapshot') return;
            snapshot = captured.snapshot;
        }
        if (!current() || savedRealm !== realm || !sameBinding(binding, envelope.binding) || !frame) return;
        captured = snapshot;
        frame.publishSnapshot(snapshot);
        frame.publishSaveConfirmation({...envelope.child, result, snapshot});
        notify(next.state === 'terminal' ? {kind: ready ? 'ready' : 'starting'}
            : {kind: 'pending', pending: next, code: result.code});
    }
    const createHost = (owner: object): BrowserHostBridgeV1 => ({
        async capture(target, signal) {
            // Attach already returned an actual Core capture. Reuse that cut
            // for the initial frame handshake rather than performing two reads.
            if (realm === owner && sameBinding(binding, target) && captured) return captured;
            const reply = await transport({action: 'capture', binding: target}, signal);
            if (reply.kind !== 'snapshot') throw Error('BROWSER_SNAPSHOT_UNAVAILABLE');
            return reply.snapshot;
        },
        async save(target, request) {
            const envelope = store.begin(target, request);
            operationRealms.clear();
            operationRealms.set(envelope.operation.operationId, owner);
            notify({kind: 'pending', pending: envelope});
            try {
                // Do not abort an admitted save when its realm is disposed. Its
                // receipt still belongs to the persisted original operation.
                const reply = await transport({action: 'save', binding: target,
                    request: envelope.child, operation: envelope.operation});
                if (reply.kind !== 'saved') throw Error('BROWSER_SAVE_ACK_UNKNOWN');
                const next = store.record(envelope, reply.result);
                if (!reply.snapshot || !current() || realm !== owner || !sameBinding(binding, target) || !frame) {
                    if (current() && realm === owner && sameBinding(binding, target)) {
                        notify({kind: 'loading'});
                        void refresh();
                    }
                    throw Error('BROWSER_GENERATION_REVOKED');
                }
                captured = reply.snapshot;
                frame.publishSnapshot(reply.snapshot);
                notify(next.state === 'terminal' ? {kind: ready ? 'ready' : 'starting'}
                    : {kind: 'pending', pending: next, code: reply.result.code});
                return {requestId: request.requestId, generation: request.generation,
                    result: reply.result, snapshot: reply.snapshot};
            } catch (error) {
                // A receipt written before revocation must remain terminal.
                const existing = store.read(target.sessionId);
                if (existing?.operation.operationId === envelope.operation.operationId && existing.state === 'pending') {
                    const next = store.record(envelope);
                    if (realm === owner && sameBinding(binding, target)) notify({kind: 'pending', pending: next, code: 'BROWSER_SAVE_ACK_UNKNOWN'});
                }
                throw error;
            }
        },
    });
    async function refreshOnce() {
        const pending = store.read(options.sessionId);
        if (!frame && pending && pending.state !== 'terminal') {
            notify({kind: 'pending', pending});return;
        }
        const target = binding;
        const reply = await transport({action: 'attach', sessionId: options.sessionId, ...(target ? {binding: target} : {})});
        if (!current()) {
            if (reply.kind === 'attached') release(reply.attachment.binding);
            return;
        }
        if (reply.kind === 'inactive') {revoke();notify({kind: 'inactive', code: reply.code});return;}
        if (reply.kind !== 'attached') throw Error('BROWSER_ATTACHMENT_UNAVAILABLE');
        const attachment = reply.attachment;
        if (sameBinding(binding, attachment.binding) && frame) {
            captured = attachment.snapshot;
            frame.publishSnapshot(attachment.snapshot);
            const activePending = store.read(options.sessionId);
            notify(activePending && activePending.state !== 'terminal' ? {kind: 'pending', pending: activePending}
                : {kind: ready ? 'ready' : 'starting'});
            return;
        }
        if (!sameBinding(binding, attachment.binding)) revoke();
        else {frame?.dispose();frame = undefined;ready = false;options.container.replaceChildren();}
        binding = attachment.binding;captured = attachment.snapshot;
        const realmOwner = {};realm = realmOwner;
        const outer = document.createElement('iframe');
        outer.className = 'rp-author-guard-frame';outer.title = '作者交互阅读内容';
        options.container.append(outer);
        const realmBinding = binding;
        notify({kind: 'starting'});
        const controller = createBrowserRuntimeFrameV1(outer, attachment.artifact, realmBinding, attachment.program, createHost(realmOwner), {
            current: () => current() && realm === realmOwner && sameBinding(binding, realmBinding),
            layout: () => {}, diagnostic: code => {
                if (!current() || realm !== realmOwner) return;
                const pending = store.read(options.sessionId);
                notify(pending && pending.state !== 'terminal' ? {kind: 'pending', pending, code}
                    : {kind: ready ? 'ready' : 'starting', code});
            },
            failed: code => {
                if (!current() || realm !== realmOwner) return;
                frame = undefined;realm = undefined;ready = false;
                options.container.replaceChildren();
                notify({kind: 'failed', code});
            }, startupDeadlineMs: 15000,
        });
        frame = controller;
        controller.publishSnapshot(attachment.snapshot);
        if (render) controller.render(render);
        controller.started.then(() => {
            if (current() && frame === controller) {
                ready = true;
                const pending = store.read(options.sessionId);
                notify(pending && pending.state !== 'terminal' ? {kind: 'pending', pending} : {kind: 'ready'});
            }
        }).catch(error => {
            if (current() && frame === controller) {
                frame = undefined;ready = false;options.container.replaceChildren();
                notify({kind: 'failed', code: String(error.message)});
            }
        });
    }
    function refresh(): Promise<void> {
        if (!current()) return Promise.resolve();
        refreshAgain = true;
        if (refreshing) return refreshing;
        refreshing = (async () => {
            try {
                while (current() && refreshAgain) {refreshAgain = false;await refreshOnce();}
            } catch (error) {notify({kind: 'failed', code: error instanceof Error ? error.message : String(error)});}
            finally {refreshing = undefined;}
        })();
        return refreshing;
    }
    function confirm(retry = false): Promise<void> {
        if (checking) return checking;
        checking = (async () => {
            let pending: AuthorBrowserPendingV1 | undefined;
            try {
                const envelope = store.read(options.sessionId);pending = envelope;
                if (envelope && envelope.state !== 'terminal') {
                    const reply = await transport(retry
                        ? {action: 'retry', operation: envelope.operation}
                        : {action: 'confirm', operation: envelope.operation});
                    if (reply.kind !== 'saved' && reply.kind !== 'confirmed') throw Error('BROWSER_SAVE_ACK_UNKNOWN');
                    if (retry) {
                        // Explicit recovery is owned by Core's actual current
                        // session, not by the stored Browser binding or realm.
                        // Its receipt never resolves a realm's author callback.
                        pending = store.record(envelope, reply.result);
                        if (pending.state !== 'terminal') notify({kind: 'pending', pending, code: reply.result.code});
                        else if (frame && operationRealms.get(envelope.operation.operationId) === realm) {
                            // rpc-error leaves an unknown request locked in its
                            // child. A plain snapshot cannot clear that lock;
                            // replace only the original realm after its receipt
                            // becomes terminal, then start with a fresh capture.
                            revoke();
                        }
                    } else {
                        await installReceipt(envelope, reply.result);
                        pending = store.read(options.sessionId);
                    }
                    if (!terminalBrowserReceipt(reply.result)) return;
                }
                await refresh();
            } catch (error) {
                notify({kind: pending && pending.state !== 'terminal' ? 'pending' : 'failed', pending,
                    code: error instanceof Error ? error.message : String(error)});
            }
        })().finally(() => {checking = undefined;});
        return checking;
    }
    return {
        start: () => confirm(), refresh, confirm: () => confirm(), retry: () => confirm(true),
        hasFrame: () => !!frame,
        render(value: Omit<BrowserRenderV1, 'renderRevision'>) {
            render = {...value, renderRevision: ++revision};frame?.render(render);
        },
        dispose() {if (!active) return;active = false;revoke();},
    };
}
