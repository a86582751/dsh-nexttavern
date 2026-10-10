import {createBrowserRuntimeFrameV1} from '../core/tavern-author-browser-frame.js';
import {createBrowserRuntimeFrameV2} from '../core/tavern-author-browser-frame-v2.js';
import {createBrowserRuntimeFrameV3} from '../core/tavern-author-browser-frame-v3.js';
import type {AuthorBrowserReply,AuthorBrowserRequest} from '../core/roleplay-author-browser-types.js';
import type {BrowserBindingV1,BrowserHostBridgeV1,BrowserRenderV1,BrowserSaveReplyV1,BrowserSnapshotV1}
    from '../core/tavern-author-browser-types.mjs';
import type {BrowserHostBridgeV2,BrowserSnapshotV2,
  BrowserWorldbookMutationRequestV2,BrowserPersonaMutationRequestV2} from '../core/tavern-author-browser-types-v2.mjs'
import type {BrowserHostBridgeV3,BrowserSnapshotV3,BrowserOrdinaryKeyRequestV3}
    from '../core/tavern-author-browser-types-v3.mjs';
import {createAuthorBrowserPendingStore,terminalBrowserReceipt,worldbookPendingRetryLocator,
    worldbookPendingBlocksNamespace}
    from './author-browser-pending.js';
import type {AuthorBrowserPendingV1,AuthorBrowserWorldbookPendingV2,AuthorBrowserPersonaPendingV1}
    from './author-browser-pending.js';
import type {AuthorScriptResourceRequestV1} from '../core/roleplay-author-script-resources.js';

export interface AuthorBrowserStatus {
    kind: 'loading' | 'inactive' | 'starting' | 'ready' | 'pending' | 'failed';
    code?: string;
    pending?: AuthorBrowserPendingV1;
    worldbooks?: AuthorBrowserWorldbookPendingV2[];
    personas?: AuthorBrowserPersonaPendingV1[];
}
export type AuthorBrowserTransport = (request: AuthorBrowserRequest, signal?: AbortSignal) => Promise<AuthorBrowserReply>;
export const authorBrowserTransport: AuthorBrowserTransport = async (request, signal) => {
    const response = await fetch('/api/roleplay/author-browser', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(request), signal,
    });
    const reply = await response.json() as AuthorBrowserReply;
    if (!response.ok || !reply.ok) throw Error(reply.ok ? 'BROWSER_TRANSPORT_FAILED' : reply.code);
    return reply;
};
const sameBinding = (a: BrowserBindingV1 | undefined, b: BrowserBindingV1) =>
    a?.generation === b.generation && a.browserSessionId === b.browserSessionId;

type Snapshot=BrowserSnapshotV1|BrowserSnapshotV2|BrowserSnapshotV3;
type SaveReply=Omit<BrowserSaveReplyV1,'snapshot'>&{snapshot:Snapshot;
    sourceEvents?:readonly import('../core/tavern-author-browser-worker-protocol-v3.js').BrowserSourceEventV3[]};
interface ReaderBrowserFrame {
    started:Promise<void>;
    publishSnapshot(value:Snapshot):void;render(value:BrowserRenderV1):void;
    publishSaveConfirmation(value:SaveReply):void;dispose():void;
}

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
    const transport = async (request: AuthorBrowserRequest, signal?: AbortSignal) => {
        const reply = await (options.transport ?? authorBrowserTransport)(request, signal);
        if (!reply.ok) throw Error(reply.code);
        return reply;
    };
    const store = createAuthorBrowserPendingStore(options.storage ?? localStorage);
    let active = true, ready = false, binding: BrowserBindingV1 | undefined;
    let frame: ReaderBrowserFrame | undefined;
    let realm: object | undefined, captured: Snapshot | undefined;
    const operationRealms = new Map<string, object>();
    let render: BrowserRenderV1 | undefined, revision = 0;
    let refreshing: Promise<void> | undefined, refreshAgain = false;
    let checking: Promise<void> | undefined;
    let lastStatus: AuthorBrowserStatus = {kind: 'loading'};
    const worldbookChecks = new Map<string, Promise<void>>();
    const personaChecks = new Map<string, Promise<void>>();
    const current = () => active && options.current();
    const notify = (value: AuthorBrowserStatus) => {
        if (!current()) return;
        lastStatus = {...value, worldbooks: store.readWorldbooks(options.sessionId), personas: store.readPersonas(options.sessionId)};
        options.status(lastStatus);
    };
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
        snapshot?: Snapshot) {
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
    const createHost = (owner: object) => ({
        async capture(target:BrowserBindingV1, signal:AbortSignal):Promise<Snapshot> {
            // Attach already returned an actual Core capture. Reuse that cut
            // for the initial frame handshake rather than performing two reads.
            if (realm === owner && sameBinding(binding, target) && captured) return captured;
            const reply = await transport({action: 'capture', binding: target}, signal);
            if (reply.kind !== 'snapshot') throw Error('BROWSER_SNAPSHOT_UNAVAILABLE');
            return reply.snapshot;
        },
        async save(target:BrowserBindingV1, request:Parameters<BrowserHostBridgeV1['save']>[1]):Promise<SaveReply> {
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
                    result: reply.result, snapshot: reply.snapshot,
                    ...reply.sourceEvents?{sourceEvents:reply.sourceEvents}:{}};
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
        async mutateAuthorKey(target:BrowserBindingV1,request:BrowserOrdinaryKeyRequestV3,signal:AbortSignal) {
            const reply=await transport({action:'mutate-author-key',binding:target,request},signal);
            if(reply.kind!=='author-key-mutated')throw Error('AUTHOR_CHAT_WRITE_ACK_UNKNOWN');
            if(reply.snapshot&&current()&&realm===owner&&sameBinding(binding,target))captured=reply.snapshot;
            return {...reply.reply,...reply.snapshot?{snapshot:reply.snapshot}:{}};
        },
        async readSourceResource(target:BrowserBindingV1,request:AuthorScriptResourceRequestV1,signal:AbortSignal) {
            const reply=await transport({action:'read-source-resource',binding:target,request},signal);
            if(reply.kind!=='source-resource')throw Error('AUTHOR_SCRIPT_RESOURCE_UNAVAILABLE');
            return reply.value;
        },
        async mutateWorldbook(target:BrowserBindingV1,request:BrowserWorldbookMutationRequestV2,signal:AbortSignal) {
            // Associate this dispatch with the parent's actual captured DATA,
            // before persisting its address and sending the mutation.
            const book = captured && 'worldbook' in captured ? captured.worldbook : undefined;
            if (!current() || realm !== owner || !sameBinding(binding, target)) throw Error('BROWSER_GENERATION_REVOKED');
            if (!book || book.schemaVersion !== 2 || book.dataSha256 !== request.expectedDataSha256) {
                throw Error('AUTHOR_WORLDBOOK_STALE_BASE');
            }
            const envelope = store.beginWorldbook(target, request, book.identitySha256);
            notify(lastStatus);
            try {
                const reply=await transport({action:'mutate-worldbook',binding:target,request},signal);
                if(reply.kind!=='worldbook-mutated')throw Error('AUTHOR_WORLDBOOK_MUTATION_ACK_UNKNOWN');
                store.recordWorldbook(envelope, reply.reply.result);
                notify(lastStatus);
                if(reply.reply.snapshot&&current()&&realm===owner&&sameBinding(binding,target)) {
                    captured=reply.reply.snapshot;
                }
                // Preserve a committed receipt even when Core has revoked its
                // continuation. Frame owns termination; this bridge never heals it.
                return reply.reply;
            } catch (error) {
                const code = error instanceof Error ? error.message : 'AUTHOR_WORLDBOOK_MUTATION_ACK_UNKNOWN';
                store.recordWorldbook(envelope, undefined, code);
                notify(lastStatus);
                throw error;
            }
        },
        async mutatePersona(target:BrowserBindingV1,request:BrowserPersonaMutationRequestV2,_signal:AbortSignal) {
            const envelope=store.beginPersona(target,request);
            notify(lastStatus);
            try {
                // An admitted account write must still finish its receipt when
                // the Reader or original Worker disappears before the ACK.
                const reply=await transport({action:'mutate-persona',binding:target,request});
                if(reply.kind!=='persona-mutated')throw Error('NATIVE_PERSONA_MUTATION_ACK_UNKNOWN');
                store.recordPersona(envelope,reply.reply.result);
                notify(lastStatus);
                if(reply.reply.snapshot&&current()&&realm===owner&&sameBinding(binding,target)) {
                    captured=reply.reply.snapshot;
                }
                return reply.reply;
            } catch(error) {
                store.recordPersona(envelope,undefined,
                    error instanceof Error?error.message:'NATIVE_PERSONA_MUTATION_ACK_UNKNOWN');
                // Unknown writes cannot continue the old author's callback or
                // admit another realm. Manual recovery only looks up a receipt.
                if(current()&&realm===owner&&sameBinding(binding,target))revoke();
                notify({kind:'pending'});
                throw error;
            }
        },
    });
    async function refreshOnce() {
        if(store.readPersonas(options.sessionId).some(value=>value.state!=='terminal')) {
            notify({kind:'pending'});return;
        }
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
        const book = 'worldbook' in attachment.snapshot ? attachment.snapshot.worldbook : undefined;
        const identitySha256 = book?.schemaVersion === 2 ? book.identitySha256 : undefined;
        if (store.readWorldbooks(options.sessionId).some(value =>
            worldbookPendingBlocksNamespace(value, identitySha256))) {
            // Capture current namespace DATA before deciding whether it may
            // mount. A's pending intent remains visible while B can proceed.
            const previous = binding;
            revoke();
            if (!previous || !sameBinding(previous, attachment.binding)) release(attachment.binding);
            notify({kind: 'pending'});return;
        }
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
        const controllerOptions = {
            current: () => current() && realm === realmOwner && sameBinding(binding, realmBinding),
            layout: () => {}, diagnostic: (code:string) => {
                if (!current() || realm !== realmOwner) return;
                const pending = store.read(options.sessionId);
                notify(pending && pending.state !== 'terminal' ? {kind: 'pending', pending, code}
                    : {kind: ready ? 'ready' : 'starting', code});
            },
            failed: (code:string) => {
                if (!current() || realm !== realmOwner) return;
                frame = undefined;realm = undefined;ready = false;
                options.container.replaceChildren();
                notify({kind: 'failed', code});
            }, startupDeadlineMs: 15000,
        };
        const host=createHost(realmOwner);
        // The attachment schema selects both implementation and captured
        // projection together. The shared Reader controller never mixes them.
        const controller:ReaderBrowserFrame = attachment.schemaVersion===3
            ? createBrowserRuntimeFrameV3(outer,attachment.artifact,realmBinding,attachment.program,
                host as BrowserHostBridgeV3,controllerOptions) as ReaderBrowserFrame
            : attachment.schemaVersion===2
            ? createBrowserRuntimeFrameV2(outer,attachment.artifact,realmBinding,attachment.program,
                host as BrowserHostBridgeV2,controllerOptions) as ReaderBrowserFrame
            : createBrowserRuntimeFrameV1(outer,attachment.artifact,realmBinding,attachment.program,
                host as BrowserHostBridgeV1,controllerOptions) as ReaderBrowserFrame;
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
    function retryWorldbook(operationId: string): Promise<void> {
        const checking = worldbookChecks.get(operationId);
        if (checking) return checking;
        const work = (async () => {
            const envelope = store.readWorldbooks(options.sessionId).find(value => value.operationId === operationId);
            if (!envelope || envelope.state === 'terminal') return;
            try {
                // Core selects the current Native owner and its existing intent.
                // Neither the stored binding nor a lost author callback is resumed.
                const locator = worldbookPendingRetryLocator(envelope);
                const reply = await transport({action: 'retry-worldbook', sessionId: options.sessionId, operationId,
                    ...locator ? {locator} : {}});
                if (reply.kind !== 'worldbook-retried') throw Error('AUTHOR_WORLDBOOK_MUTATION_ACK_UNKNOWN');
                const code = reply.result.kind === 'refused'
                    && reply.result.diagnostics.some(value => value.code === 'OPERATION_NOT_RECORDED')
                    ? 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED' : undefined;
                store.recordWorldbook(envelope, reply.result, code);
                if (current() && sameBinding(binding, envelope.binding)) revoke();
                notify(frame ? lastStatus : {kind: 'failed', code: 'BROWSER_GENERATION_REVOKED'});
            } catch (error) {
                store.recordWorldbook(envelope, undefined,
                    error instanceof Error ? error.message : 'AUTHOR_WORLDBOOK_MUTATION_ACK_UNKNOWN');
                notify(lastStatus);
            }
        })().finally(() => {worldbookChecks.delete(operationId);});
        worldbookChecks.set(operationId, work);
        return work;
    }
    function retryPersona(operationId:string):Promise<void> {
        const checking=personaChecks.get(operationId);
        if(checking)return checking;
        const work=(async()=>{
            const envelope=store.readPersonas(options.sessionId).find(value=>value.operationId===operationId);
            if(!envelope||envelope.state==='terminal')return;
            try {
                const reply=await transport({action:'retry-persona',sessionId:options.sessionId,operationId});
                if(reply.kind!=='persona-retried')throw Error('NATIVE_PERSONA_MUTATION_ACK_UNKNOWN');
                store.recordPersona(envelope,reply.result);
                if(current()&&sameBinding(binding,envelope.binding))revoke();
                notify(frame?lastStatus:{kind:'failed',code:'BROWSER_GENERATION_REVOKED'});
            } catch(error) {
                store.recordPersona(envelope,undefined,
                    error instanceof Error?error.message:'NATIVE_PERSONA_MUTATION_ACK_UNKNOWN');
                notify(lastStatus);
            }
        })().finally(()=>{personaChecks.delete(operationId);});
        personaChecks.set(operationId,work);
        return work;
    }

    return {
        start: () => confirm(), refresh, confirm: () => confirm(), retry: () => confirm(true),
        retryWorldbook,
        retryPersona,
        async showCurrentPageWithLegacyUnknown(operationId: string) {
            store.releaseLegacyWorldbook(operationId, options.sessionId);
            notify(lastStatus);
            await refresh();
        },
        hasFrame: () => !!frame,
        render(value: Omit<BrowserRenderV1, 'renderRevision'>) {
            render = {...value, renderRevision: ++revision};frame?.render(render);
        },
        dispose() {if (!active) return;active = false;revoke();},
    };
}
