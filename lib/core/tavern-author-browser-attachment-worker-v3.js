// Generated from runtime/alpha3/src/core/tavern-author-browser-attachment-worker-v3.ts; edit the TypeScript source.
import { BrowserPageWorkerV3 } from './tavern-author-browser-page-worker-v3.js';
import { browserPageGuestBootstrapV3 } from './tavern-author-browser-page-guest-v3.js';
import { browserSourceGuestBootstrapV3 } from './tavern-author-browser-source-guest-v3.js';
const errorCode = (error) => error instanceof Error ? error.message : String(error);
export class BrowserAttachmentWorkerV3 {
    options;
    pages;
    abort = new AbortController();
    carriers = new Map();
    controllers = new Map();
    framePages = new Map();
    retiringPages = new Set();
    retiredPages = new Set();
    hostWaits = new Map();
    sourceBlobs = new Map();
    sourceURLs = new Map();
    sourceMethods;
    nativeRegistry;
    nextHost = 0;
    nextURL = 0;
    nextBlob = 0;
    active = true;
    disposal;
    constructor(options) {
        this.options = options;
        this.pages = new BrowserPageWorkerV3({ actor: options.actor, transport: options.pages,
            bootstrap: page => this.bootstrapPage(page), frameLoaded: options.frameLoaded, onPageError: options.onPageError });
    }
    async primitive(context, method, value, seam = false) {
        const { actor } = this.options;
        let argument;
        if (value !== undefined)
            await actor.enter(() => { argument = context.newString(JSON.stringify(value)); });
        try {
            if (seam)
                await this.pages.call(context, method, argument ? [argument] : []);
            else
                await actor.call(context, method, argument ? [argument] : []);
        }
        finally {
            if (argument)
                argument.dispose();
        }
    }
    async startSource() {
        const { actor } = this.options, context = actor.parent;
        await actor.enter(() => {
            const rpc = context.newAsyncifiedFunction('__ownedSourceRpcV3', async (input) => {
                let reply;
                try {
                    reply = { value: await this.options.sourceRequest(JSON.parse(context.getString(input)), this.abort.signal) };
                }
                catch (error) {
                    reply = { error: errorCode(error) };
                }
                return context.newString(JSON.stringify(reply));
            });
            const host = context.newFunction('__ownedSourceHostV3', (input) => {
                const payload = JSON.parse(context.getString(input)), id = ++this.nextHost, promise = context.newPromise();
                this.hostWaits.set(id, promise);
                // A real guest Promise leaves the Actor free. Completion is queued only
                // after this FFI returns, and disposal cancels the actual parent wait.
                void this.options.hostRequest(payload, this.abort.signal).then(value => this.settleHost(id, { value }), error => this.settleHost(id, { error: errorCode(error) }))
                    .catch(error => this.options.onPageError?.('attachment', error));
                return promise.handle.dup();
            });
            context.setProp(context.global, '__ownedSourceRpcV3', rpc);
            context.setProp(context.global, '__ownedSourceHostV3', host);
            rpc.dispose();
            host.dispose();
            const notify = context.newFunction('__ownedSourceNotifyV3', (text) => {
                const notice = JSON.parse(context.getString(text));
                queueMicrotask(() => this.options.onNotice?.(notice));
            });
            context.setProp(context.global, '__ownedSourceNotifyV3', notify);
            notify.dispose();
        });
        const controller = await actor.capture(context, '(' + browserSourceGuestBootstrapV3.toString() + ')(' + JSON.stringify({
            snapshot: this.options.snapshot, binding: this.options.binding, operationPrefix: this.options.operationPrefix
        }) + ')');
        const methods = {};
        await actor.enter(() => {
            for (const name of ['createFacade', 'installFacade', 'registerPage', 'snapshot', 'event', 'retirePage', 'destroy'])
                methods[name] = context.getProp(controller, name);
            this.nativeRegistry = context.getProp(controller, 'nativeRegistry');
        });
        this.sourceMethods = methods;
    }
    async settleHost(id, reply) {
        if (!this.active)
            return;
        const { actor } = this.options, context = actor.parent;
        await this.pages.enter(() => {
            const promise = this.hostWaits.get(id);
            if (!promise)
                return;
            this.hostWaits.delete(id);
            const value = context.newString(JSON.stringify(reply));
            try {
                promise.resolve(value);
            }
            finally {
                value.dispose();
                promise.dispose();
            }
        });
        if (this.active)
            await this.pages.drain();
    }
    async sourceFacade(context, script, pageId) {
        const { actor } = this.options, source = actor.parent;
        let creator;
        await actor.enter(() => {
            creator = source.newString(JSON.stringify({ scriptIdentity: script.descriptor.identity,
                descriptorSha256: script.descriptorSha256, pageId, originalOrdinal: script.ordinal }));
        });
        let facade;
        try {
            facade = await actor.captureCall(source, this.sourceMethods.createFacade, [creator]);
        }
        finally {
            creator.dispose();
        }
        await actor.call(source, this.sourceMethods.installFacade, [facade, context.global]);
    }
    async bootstrap(context, id, parent, document, script) {
        const { actor } = this.options;
        await actor.enter(() => {
            context.setProp(context.global, 'parent', parent.global);
            context.setProp(context.global, 'top', parent.global);
            context.setProp(context.global, '__ownedPageRegistryV3', this.nativeRegistry);
            const native = context.newAsyncifiedFunction('__ownedPageDomV3', async (input) => {
                const request = JSON.parse(context.getString(input));
                let reply;
                try {
                    reply = await this.requestNative(id, script, request);
                }
                catch (error) {
                    reply = { error: errorCode(error) };
                }
                return context.newString(JSON.stringify(reply));
            });
            const window = context.newFunction('__ownedPageWindowV3', (pageId) => {
                const name = context.getString(pageId), controller = this.controllers.get(name);
                if (controller)
                    return controller.context.global.dup();
                return this.pages.windowHandle(name);
            });
            const notify = context.newFunction('__ownedPageNotifyV3', (text) => {
                const notice = JSON.parse(context.getString(text));
                queueMicrotask(() => this.options.onNotice?.(notice));
            });
            for (const [name, value] of [['__ownedPageDomV3', native], ['__ownedPageWindowV3', window], ['__ownedPageNotifyV3', notify]]) {
                context.setProp(context.global, name, value);
                value.dispose();
            }
        });
        const captured = await actor.capture(context, '(' + browserPageGuestBootstrapV3.toString() + ')(' + JSON.stringify({
            pageId: id, document, methods: this.options.methods, properties: this.options.properties
        }) + ')');
        const methods = {};
        await actor.enter(() => {
            for (const name of ['setCurrentScript', 'dispatchLifecycle', 'decodeNative', 'deliver', 'settle', 'retire', 'destroy'])
                methods[name] = context.getProp(captured, name);
        });
        let name;
        await actor.enter(() => { name = actor.parent.newString(id); });
        try {
            await actor.call(actor.parent, this.sourceMethods.registerPage, [name, captured]);
        }
        finally {
            name.dispose();
        }
        await this.sourceFacade(context, script, id);
        const controller = { context, methods,
            setCurrentScript: node => this.primitive(context, methods.setCurrentScript, node),
            dispatchLifecycle: type => this.primitive(context, methods.dispatchLifecycle, { type }),
            disposeHandles: () => { for (const method of Object.values(methods))
                method.dispose(); },
        };
        this.controllers.set(id, controller);
        return controller;
    }
    async sourcePlan(html) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
        const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        return this.options.program.sourcePages.find(plan => plan.origin.htmlSha256 === hash);
    }
    async requestNative(id, script, request) {
        if (request.op === 'create' && request.creation.kind === 'blob' && request.creation.mime.toLowerCase().split(';')[0].trim() === 'text/html'
            && request.creation.parts.every(part => typeof part === 'string')) {
            const html = request.creation.parts.join(''), plan = await this.sourcePlan(html);
            if (!plan)
                throw Error('BROWSER3_SOURCE_PAGE_UNAVAILABLE');
            // Source HTML is a logical Source resource, not a navigable native Blob.
            // The native browser receives only the fixed inert iframe shell.
            const reference = { tag: 'handle', pageId: 'source-blobs', handle: ++this.nextBlob, kind: 'blob' };
            this.sourceBlobs.set(reference.pageId + ':' + reference.handle, { plan, html, mime: request.creation.mime.toLowerCase() });
            return { value: reference };
        }
        if ('target' in request && request.target.pageId === 'source-blobs') {
            const blob = this.sourceBlobs.get(request.target.pageId + ':' + request.target.handle);
            if (request.op === 'get' && request.key === 'size')
                return { value: new TextEncoder().encode(blob.html).byteLength };
            if (request.op === 'get' && request.key === 'type')
                return { value: blob.mime };
            if (request.op === 'call' && request.method === 'text')
                return { value: blob.html };
        }
        if (request.op === 'set' && request.target.kind === 'frame' && ['src', 'srcdoc'].includes(request.key)) {
            const location = String(request.value), plan = request.key === 'srcdoc' ? await this.sourcePlan(location) : this.sourceURLs.get(location);
            if (!plan)
                throw Error('BROWSER3_SOURCE_PAGE_UNAVAILABLE');
            const frame = this.options.resolveFrame(request.target);
            this.options.recordFrameLocation(frame, { [request.key]: location });
            await this.requestMount(frame, plan);
            return { value: { tag: 'undefined' } };
        }
        if (request.op === 'object-url') {
            const blob = this.sourceBlobs.get(request.target.pageId + ':' + request.target.handle);
            if (blob) {
                const url = 'blob:nexttavern-source-' + this.options.operationPrefix + '-' + ++this.nextURL;
                this.sourceURLs.set(url, blob.plan);
                return { value: url };
            }
        }
        if (request.op === 'revoke-object-url' && this.sourceURLs.delete(request.url))
            return { value: { tag: 'undefined' } };
        return this.options.nativeRequest ? await this.options.nativeRequest(id, request, this.abort.signal)
            : this.carriers.get(script.descriptor.identity)?.id === id
                ? await this.carriers.get(script.descriptor.identity).native.request(request, this.abort.signal)
                : await this.pages.requestNative(id, request);
    }
    async bootstrapPage(page) {
        await this.retirePending();
        const script = this.options.program.scripts.find(row => row.descriptor.identity === page.plan.origin.carrier.identity);
        const controller = await this.bootstrap(page.context, page.pageId, page.parentContext, page.document, script);
        const parent = [...this.controllers.values()].find(row => row.context === page.parentContext);
        let reference;
        await this.options.actor.enter(() => { reference = parent.context.newString(JSON.stringify(this.options.frameReference(page.frame))); });
        let frame;
        try {
            frame = await this.options.actor.captureCall(parent.context, parent.methods.decodeNative, [reference]);
        }
        finally {
            reference.dispose();
        }
        await this.options.actor.enter(() => page.context.setProp(page.context.global, 'frameElement', frame));
        return controller;
    }
    async start() {
        const { actor, program } = this.options;
        await this.startSource();
        for (const script of program.scripts)
            if (script.disposition === 'compiled-browser') {
                const id = 'carrier-' + script.ordinal, context = await actor.createPage(id);
                const native = await this.options.createCarrier(script, id, this.abort.signal);
                this.carriers.set(script.descriptor.identity, { context, id, native });
                const controller = await this.bootstrap(context, id, context, native.document, script);
                await native.setDocumentState('loading', this.abort.signal);
                await controller.setCurrentScript(native.script);
                try {
                    await this.pages.enterOriginal(context, script.javascript, `source-carrier-${script.ordinal}.js`);
                }
                finally {
                    await controller.setCurrentScript(null);
                }
                await this.retirePending();
                await this.pages.drain();
                await native.setDocumentState('interactive', this.abort.signal);
                await controller.dispatchLifecycle('readystatechange');
                await controller.dispatchLifecycle('DOMContentLoaded');
                await native.setDocumentState('complete', this.abort.signal);
                await controller.dispatchLifecycle('readystatechange');
                await controller.dispatchLifecycle('load');
                await this.pages.drain();
            }
    }
    /** The trusted frame resource router supplies frame identity and selected
     * plan. Neither a posted page object nor an arbitrary HTML string is used. */
    requestMount(frame, plan) {
        const { carrierIdentity, parentPageId } = this.options.frameOwner(frame);
        const carrier = this.carriers.get(carrierIdentity);
        // Native document ownership is independent of the Source getter's creator.
        // The compiler supports this carrier parent, not a nested page parent.
        if (carrier.id !== parentPageId || plan.origin.carrier.identity !== carrierIdentity)
            return Promise.reject(Error('BROWSER3_SOURCE_PAGE_PARENT_UNPROVEN'));
        const previous = this.framePages.get(frame);
        if (previous)
            this.retiringPages.add(previous);
        return this.pages.requestMount(frame, plan, carrier.context).then(result => {
            this.framePages.set(frame, result.pageId);
            return result;
        });
    }
    async retirePending() {
        // Navigation can arrive in suspended FFI. Retire actual guest callbacks
        // only at the next Actor seam, never by entering the Actor from that FFI.
        for (const id of [...this.retiringPages]) {
            this.retiringPages.delete(id);
            this.retiredPages.add(id);
            const source = this.options.actor.parent;
            let name;
            await this.options.actor.enter(() => { name = source.newString(id); });
            try {
                await this.options.actor.call(source, this.sourceMethods.retirePage, [name]);
            }
            finally {
                name.dispose();
            }
            const controller = this.controllers.get(id);
            if (controller)
                await this.primitive(controller.context, controller.methods.retire);
        }
    }
    async close(frame) {
        const id = this.framePages.get(frame);
        if (id) {
            this.framePages.delete(frame);
            this.retiringPages.add(id);
        }
        await this.pages.close(frame);
        if (this.active)
            await this.retirePending();
    }
    async deliverNative(delivery) {
        if (!this.active)
            return;
        await this.retirePending();
        if (this.retiredPages.has(delivery.callback.pageId))
            return;
        const controller = this.controllers.get(delivery.callback.pageId);
        await this.primitive(controller.context, controller.methods.deliver, delivery, true);
        if (this.active)
            await this.pages.drain();
    }
    async settleNative(settlement) {
        if (!this.active)
            return;
        await this.retirePending();
        if (this.retiredPages.has(settlement.pageId))
            return;
        const controller = this.controllers.get(settlement.pageId);
        await this.primitive(controller.context, controller.methods.settle, settlement, true);
        if (this.active)
            await this.pages.drain();
    }
    async snapshot(snapshot) {
        if (this.active)
            await this.retirePending();
        if (this.active)
            await this.primitive(this.options.actor.parent, this.sourceMethods.snapshot, snapshot, true);
        if (this.active)
            await this.pages.drain();
    }
    async deliverSourceEvent(event) {
        if (!this.active)
            return;
        await this.retirePending();
        await this.primitive(this.options.actor.parent, this.sourceMethods.event, event, true);
        if (this.active)
            await this.pages.drain();
    }
    dispose() {
        if (this.disposal)
            return this.disposal;
        this.active = false;
        this.abort.abort();
        this.disposal = this.finishDisposal();
        return this.disposal;
    }
    async finishDisposal() {
        const native = await Promise.allSettled([...this.carriers.values()].map(carrier => carrier.native.dispose()));
        const { actor } = this.options;
        try {
            if (this.sourceMethods)
                await actor.call(actor.parent, this.sourceMethods.destroy);
            await actor.enter(() => {
                for (const promise of this.hostWaits.values())
                    promise.dispose();
                this.hostWaits.clear();
                for (const carrier of this.carriers.values())
                    this.controllers.get(carrier.id)?.disposeHandles();
                for (const method of Object.values(this.sourceMethods ?? {}))
                    method.dispose();
                this.nativeRegistry?.dispose();
            });
        }
        finally {
            await this.pages.dispose();
            this.controllers.clear();
            this.carriers.clear();
            this.sourceBlobs.clear();
            this.sourceURLs.clear();
            this.framePages.clear();
            this.retiringPages.clear();
            this.retiredPages.clear();
        }
        const failed = native.find(result => result.status === 'rejected');
        if (failed?.status === 'rejected')
            throw failed.reason;
    }
}
