import {createBrowserRuntimeFrameV1} from '../core/tavern-author-browser-frame.js';
import {createBrowserRuntimeFrameV2} from '../core/tavern-author-browser-frame-v2.js';
import {createBrowserRuntimeFrameV3,createReaderRegexDocumentFrameV1} from '../core/tavern-author-browser-frame-v3.js';
import type {BrowserFrameHostV3} from '../core/tavern-author-browser-frame-v3.js';
import type {AuthorReaderSurface} from '../core/tavern-author-reader-surface.js';
import type {AuthorBrowserReply,AuthorBrowserRequest} from '../core/roleplay-author-browser-types.js';
import type {BrowserBindingV1,BrowserHostBridgeV1,BrowserRenderV1,BrowserSaveReplyV1,BrowserSnapshotV1}
    from '../core/tavern-author-browser-types.mjs';
import type {BrowserHostBridgeV2,BrowserSnapshotV2,BrowserSaveReplyV2,BrowserGenerateRawRequestV2,
    BrowserAuthorChatRequestV2,BrowserWorldbookMutationRequestV2,BrowserPersonaMutationRequestV2}
    from '../core/tavern-author-browser-types-v2.mjs';
import type {BrowserSnapshotV3,BrowserOrdinaryKeyRequestV3}
    from '../core/tavern-author-browser-types-v3.mjs';
import type {BrowserCallbackRegistrationV2,BrowserGenerationInvocationV2,BrowserGenerationResultV2,
    BrowserCallbackRegistrationV3,BrowserGenerationInvocationV3,BrowserGenerationResultV3,BrowserPromptCleanupRequestV3}
    from '../core/roleplay-author-browser-generation-types.js';
import {createAuthorBrowserPendingStore,terminalBrowserReceipt,worldbookPendingRetryLocator,
    worldbookPendingBlocksNamespace}
    from './author-browser-pending.js';
import type {AuthorBrowserPendingV1,AuthorBrowserWorldbookPendingV2,AuthorBrowserPersonaPendingV1}
    from './author-browser-pending.js';
import type {AuthorScriptResourceRequestV1} from '../core/roleplay-author-script-resources.js';
import {scopeReaderCss} from './reader-rendering.js';
import {mountStaticAuthorDocument} from './author-runtime.js';
import type {BrowserNativeImageV3} from '../core/tavern-author-browser-native-types-v3.js';
import type {ReaderRegexDocumentExecutionV1,ReaderRegexDocumentRenderV1}
    from '../core/reader-regex-document-types.mjs';

export interface AuthorBrowserStatus {
    kind: 'loading' | 'inactive' | 'starting' | 'ready' | 'pending' | 'failed';
    code?: string;
    pending?: AuthorBrowserPendingV1;
    worldbooks?: AuthorBrowserWorldbookPendingV2[];
    personas?: AuthorBrowserPersonaPendingV1[];
}

/** Reader receives already captured Core DATA. Its local binding owns only
 * this read-only Worker/native scene; no Core writer/session is fabricated. */
export function createReaderRegexDocumentSession(options: {
    sessionId: string;
    container: HTMLElement;
    current(): boolean;
    status(value: AuthorBrowserStatus): void;
    fill(text: string): void;
    surface?(): AuthorReaderSurface;
    images?(owner: object,pageId: string,images: readonly BrowserNativeImageV3[]): void;
    releaseImages?(owner: object): void;
}) {
    let active = true, revision = 0, identity = '';
    let frame: ReturnType<typeof createReaderRegexDocumentFrameV1> | undefined, realm: object | undefined;
    const current = () => active && options.current();
    function revoke(): void {
        frame?.dispose();frame = undefined;
        if (realm) options.releaseImages?.(realm);
        realm = undefined;identity = '';
        if (!options.surface) options.container.replaceChildren();
    }
    return {
        hasFrame: () => !!frame,
        invalidate(): void {if (active) {revoke();options.status({kind: 'inactive'});}},
        update(execution: ReaderRegexDocumentExecutionV1,render: Omit<ReaderRegexDocumentRenderV1,'renderRevision'>): void {
            if (!current()) return;
            const key = execution.program.programSha256 + ':' + execution.artifact.executionWorkerSha256;
            if (key !== identity || !frame) {
                revoke();identity = key;
                const owner = {};realm = owner;
                const surface = options.surface?.();
                const outer = surface?.outer ?? options.container.ownerDocument.createElement('iframe');
                if (!surface) {
                    outer.className = 'rp-author-guard-frame';outer.title = '作者正则阅读文档';options.container.append(outer);
                }
                const binding = {sessionId: options.sessionId,browserSessionId: crypto.randomUUID(),
                    generation: execution.snapshot.generation,programSha256: execution.program.programSha256};
                options.status({kind: 'starting'});
                const controller = createReaderRegexDocumentFrameV1(outer,execution.artifact,binding,execution.program,{
                    surface,
                    current: () => current() && realm === owner,
                    mountStaticDocument: (container,html,layout) => mountStaticAuthorDocument(container,html,{
                        current: () => current() && realm === owner,fill: options.fill,layout}),
                    layout: () => {},startupDeadlineMs: 15000,
                    diagnostic: code => {if (current() && realm === owner) options.status({kind: 'starting',code});},
                    failed: code => {
                        if (!current() || realm !== owner) return;
                        revoke();options.status({kind: 'failed',code});
                    },
                    onImages: (pageId,values) => {if (current() && realm === owner) options.images?.(owner,pageId,values);},
                });
                frame = controller;
                void controller.started.then(() => {
                    if (current() && realm === owner) options.status({kind: 'ready'});
                }).catch(() => {}); // The frame's failure owner publishes its code.
            }
            frame.render({...render,css: scopeReaderCss(render.css),renderRevision: ++revision});
            frame.publishSnapshot(execution.snapshot);
        },
        dispose(): void {if (!active) return;active = false;revoke();},
    };
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
    started:Promise<void>;registrations?:readonly BrowserCallbackRegistrationV2[];
    publishSnapshot(value:Snapshot):void;render(value:BrowserRenderV1):void;
    publishSaveConfirmation(value:SaveReply):void;dispose():void;
    invokeGeneration?(value:BrowserGenerationInvocationV2):Promise<BrowserGenerationResultV2>;
    generationCallbacks?():Promise<readonly BrowserCallbackRegistrationV3[]>;
    invokeGenerationV3?(value:BrowserGenerationInvocationV3,signal:AbortSignal):Promise<BrowserGenerationResultV3>;
}
function renderReaderFrame(frame:ReaderBrowserFrame,value:BrowserRenderV1):void {
    // V3's outer document also contains private Source carriers. Reader CSS
    // belongs to its content container, while each carrier keeps its own CSS.
    frame.render(frame.invokeGenerationV3?{...value,css:scopeReaderCss(value.css)}:value);
}

/** A Reader owns one live parent realm. Core owns its binding and captured
 * DATA; the durable pending operation survives this object's disposal. */
export function createAuthorBrowserSession(options: {
    sessionId: string;
    container: HTMLElement;
    current(): boolean;
    status(value: AuthorBrowserStatus): void;
    surface?(): AuthorReaderSurface;
    transport?: AuthorBrowserTransport;
    storage?: Pick<Storage, 'getItem' | 'setItem'>;
    images?(owner:object,pageId:string,images:readonly BrowserNativeImageV3[]):void;
    releaseImages?(owner:object):void;
}) {
    const transport = async (request: AuthorBrowserRequest, signal?: AbortSignal) => {
        const reply = await (options.transport ?? authorBrowserTransport)(request, signal);
        if (!reply.ok) throw Error(reply.code);
        return reply;
    };
    const store = createAuthorBrowserPendingStore(options.storage ?? localStorage);
    let active = true, ready = false, binding: BrowserBindingV1 | undefined;
    let frame: ReaderBrowserFrame | undefined, sharedSurface = false;
    let realm: object | undefined, captured: Snapshot | undefined;
    let generationWait:AbortController|undefined;
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
        generationWait?.abort();generationWait=undefined;
        if(realm)options.releaseImages?.(realm);
        const frameClosesBinding=Boolean(frame?.invokeGenerationV3);
        frame?.dispose();frame = undefined;ready = false;realm = undefined;captured = undefined;
        if (!sharedSurface) options.container.replaceChildren();
        if (binding&&!frameClosesBinding) release(binding);
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
        async cleanupPrompts(target:BrowserBindingV1,request:BrowserPromptCleanupRequestV3) {
            const reply=await transport({action:'cleanup-prompts',binding:target,request});
            if(reply.kind!=='prompts-cleaned')throw Error('BROWSER_PROMPT_CLEANUP_UNCONFIRMED');
        },
        async closeBinding(target:BrowserBindingV1) {
            const reply=await transport({action:'dispose',binding:target});
            if(reply.kind!=='disposed')throw Error('BROWSER_PROMPT_CLEANUP_UNCONFIRMED');
        },
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
        async generateRaw(target:BrowserBindingV1,request:BrowserGenerateRawRequestV2,signal:AbortSignal) {
            const reply=await transport({action:'generate-raw',binding:target,request},signal);
            if(reply.kind!=='generated')throw Error('BROWSER_NATIVE_TASK_UNAVAILABLE');
            return reply.result;
        },
        async updateAuthorChat(target:BrowserBindingV1,request:BrowserAuthorChatRequestV2,signal:AbortSignal) {
            const reply=await transport({action:'update-author-chat',binding:target,request},signal);
            if(reply.kind!=='author-chat-updated')throw Error('BROWSER_AUTHOR_CHAT_UPDATE_FAILED');
            return reply.capture;
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
    async function generationLoop(owner:object,controller:ReaderBrowserFrame,target:BrowserBindingV1) {
        const waiting=new AbortController();generationWait?.abort();generationWait=waiting;
        try {
            while(current()&&realm===owner&&frame===controller&&!waiting.signal.aborted) {
                const registrations=controller.generationCallbacks?await controller.generationCallbacks():controller.registrations??[];
                if(!current()||realm!==owner||waiting.signal.aborted)return;
                let reply:AuthorBrowserReply;
                try {reply=await transport({action:'generation-wait',binding:target,registrations},waiting.signal);}
                catch(error) {
                    if(controller.generationCallbacks&&error instanceof Error
                        &&error.message==='BROWSER_GENERATION_RESOURCE_RETIRED')continue;
                    throw error;
                }
                if(reply.kind!=='generation-invocation')return;
                const result=reply.invocation.schemaVersion===3
                    ?await controller.invokeGenerationV3!(reply.invocation,waiting.signal)
                    :await controller.invokeGeneration!(reply.invocation);
                if(!current()||realm!==owner||frame!==controller||waiting.signal.aborted)return;
                if(result.kind==='cancelled'&&result.diagnostics[0]?.code==='BROWSER_GENERATION_RESOURCE_RETIRED')continue;
                try {await transport({action:'generation-complete',binding:target,result},waiting.signal);}
                catch(error) {
                    // Core can retire the page after handing off its challenge
                    // but before this Frame registers the Worker invocation.
                    // Its obsolete completion stays refused; the Reader waits
                    // for the next preparation using the current page registry.
                    if(reply.invocation.schemaVersion===3&&error instanceof Error
                        &&error.message==='BROWSER_GENERATION_INVOCATION_REVOKED')continue;
                    throw error;
                }
            }
        }catch(error) {
            if(!waiting.signal.aborted&&current()&&realm===owner)
                notify({kind:'ready',code:error instanceof Error?error.message:'BROWSER_GENERATION_WAIT_FAILED'});
        }finally{if(generationWait===waiting)generationWait=undefined;}
    }
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
        if (sameBinding(binding, attachment.binding) && frame) {
            // A current realm may still be awaiting its own writer's ACK.
            // Pending records block replacement realms, not this live binding.
            captured = attachment.snapshot;
            frame.publishSnapshot(attachment.snapshot);
            const activePending = store.read(options.sessionId);
            notify(activePending && activePending.state !== 'terminal' ? {kind: 'pending', pending: activePending}
                : {kind: ready ? 'ready' : 'starting'});
            return;
        }
        if (store.readWorldbooks(options.sessionId).some(value =>
            worldbookPendingBlocksNamespace(value, identitySha256))) {
            // Capture current namespace DATA before deciding whether it may
            // mount. A's pending intent remains visible while B can proceed.
            const previous = binding;
            revoke();
            if (!previous || !sameBinding(previous, attachment.binding)) release(attachment.binding);
            notify({kind: 'pending'});return;
        }
        if (!sameBinding(binding, attachment.binding)) revoke();
        else {frame?.dispose();frame = undefined;ready = false;if (!sharedSurface) options.container.replaceChildren();}
        binding = attachment.binding;captured = attachment.snapshot;
        const realmOwner = {};realm = realmOwner;
        sharedSurface = attachment.schemaVersion === 3 && !!options.surface;
        const surface = sharedSurface ? options.surface!() : undefined;
        const outer = surface?.outer ?? document.createElement('iframe');
        if (!surface) {
            outer.className = 'rp-author-guard-frame';outer.title = '作者交互阅读内容';options.container.append(outer);
        }
        const realmBinding = binding;
        notify({kind: 'starting'});
        const controllerOptions = {
            surface,
            current: () => current() && realm === realmOwner && sameBinding(binding, realmBinding),
            layout: () => {}, diagnostic: (code:string) => {
                if (!current() || realm !== realmOwner) return;
                const pending = store.read(options.sessionId);
                notify(pending && pending.state !== 'terminal' ? {kind: 'pending', pending, code}
                    : {kind: ready ? 'ready' : 'starting', code});
            },
            failed: (code:string) => {
                if (!current() || realm !== realmOwner) return;
                options.releaseImages?.(realmOwner);
                generationWait?.abort();generationWait=undefined;
                frame = undefined;realm = undefined;ready = false;
                if (!sharedSurface) options.container.replaceChildren();
                notify({kind: 'failed', code});
            }, startupDeadlineMs: 15000,
            onImages: (pageId:string,images:readonly BrowserNativeImageV3[]) => {
                if(current()&&realm===realmOwner)options.images?.(realmOwner,pageId,images);
            },
        };
        const host=createHost(realmOwner);
        // The attachment schema selects both implementation and captured
        // projection together. The shared Reader controller never mixes them.
        const controller:ReaderBrowserFrame = attachment.schemaVersion===3
            ? createBrowserRuntimeFrameV3(outer,attachment.artifact,realmBinding,attachment.program,
                host as BrowserFrameHostV3,controllerOptions) as ReaderBrowserFrame
            : attachment.schemaVersion===2
            ? createBrowserRuntimeFrameV2(outer,attachment.artifact,realmBinding,attachment.program,
                host as BrowserHostBridgeV2,controllerOptions) as ReaderBrowserFrame
            : createBrowserRuntimeFrameV1(outer,attachment.artifact,realmBinding,attachment.program,
                host as BrowserHostBridgeV1,controllerOptions) as ReaderBrowserFrame;
        frame = controller;
        controller.publishSnapshot(attachment.snapshot);
        if (render) renderReaderFrame(controller,render);
        controller.started.then(() => {
            if (current() && frame === controller) {
                ready = true;
                const pending = store.read(options.sessionId);
                notify(pending && pending.state !== 'terminal' ? {kind: 'pending', pending} : {kind: 'ready'});
                if(controller.invokeGeneration||controller.invokeGenerationV3)void generationLoop(realmOwner,controller,realmBinding);
            }
        }).catch(error => {
            if (current() && frame === controller) {
                options.releaseImages?.(realmOwner);
                frame = undefined;ready = false;if (!sharedSurface) options.container.replaceChildren();
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
        retryWorldbook,retryPersona,
        async showCurrentPageWithLegacyUnknown(operationId: string) {
            store.releaseLegacyWorldbook(operationId, options.sessionId);
            notify(lastStatus);
            await refresh();
        },
        hasFrame: () => !!frame,
        supportsReaderSurface: () => sharedSurface,
        render(value: Omit<BrowserRenderV1, 'renderRevision'>) {
            render = {...value, renderRevision: ++revision};if(frame)renderReaderFrame(frame,render);
        },
        dispose() {if (!active) return;active = false;revoke();},
    };
}
