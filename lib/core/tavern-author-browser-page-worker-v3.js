// Generated from runtime/alpha3/src/core/tavern-author-browser-page-worker-v3.ts; edit the TypeScript source.
export class BrowserPageWorkerV3 {
    options;
    pages = new Map();
    frames = new Map();
    closingFrames = new Map();
    mountQueue = [];
    readyQueue = [];
    nextPage = 0;
    entered = 0;
    active = true;
    pumping;
    disposal;
    constructor(options) {
        this.options = options;
    }
    live(page) {
        return this.active && !page.abort.signal.aborted && this.frames.get(page.frame) === page;
    }
    /** Called from a suspended FFI: reserves identity and waits only for native
     * mount. Fresh context creation and author execution happen at entry seams. */
    async requestMount(frame, plan, parentContext = this.options.actor.parent) {
        if (!this.active)
            throw Error('BROWSER3_ATTACHMENT_CLOSED');
        const previous = this.frames.get(frame);
        const page = { pageId: `source-page-${++this.nextPage}`, frame, plan, parentContext,
            abort: new AbortController(), scripts: new Map(plan.parsed.scripts.map(script => [script.inlineOrdinal, script])),
            phase: 'mounting' };
        // A repeated navigation closes its original resource before the new native
        // mount; it never transfers old handles or its realm to the fresh page.
        const priorClose = previous ? this.retire(previous) : this.closingFrames.get(frame);
        this.pages.set(page.pageId, page);
        this.frames.set(frame, page);
        try {
            if (priorClose)
                await priorClose;
            if (!this.live(page))
                throw Error('BROWSER3_PAGE_CLOSED');
            const session = await this.options.transport.mount(frame, page.pageId, plan, page.abort.signal);
            if (!this.live(page))
                throw Error('BROWSER3_PAGE_CLOSED');
            page.session = session;
            page.phase = 'queued';
            this.mountQueue.push(page);
            // No Actor call here. The suspended caller must get its native ACK first.
            return { pageId: page.pageId };
        }
        catch (error) {
            await this.retire(page);
            throw error;
        }
    }
    retire(page) {
        if (page.nativeDisposal)
            return page.nativeDisposal;
        page.phase = 'closed';
        page.abort.abort();
        if (this.frames.get(page.frame) === page)
            this.frames.delete(page.frame);
        page.nativeDisposal = this.options.transport.dispose(page.frame, page.pageId);
        const closing = page.nativeDisposal;
        this.closingFrames.set(page.frame, closing);
        void closing.finally(() => {
            if (this.closingFrames.get(page.frame) === closing)
                this.closingFrames.delete(page.frame);
        }).catch(() => { });
        return page.nativeDisposal;
    }
    close(frame) {
        const page = this.frames.get(frame);
        return page ? this.retire(page) : Promise.resolve();
    }
    /** Decoder returns the original same-runtime value, duplicating the held
     * global rather than evaluating code or writing a parent global property. */
    windowHandle(pageId) {
        if (!this.active)
            throw Error('BROWSER3_ATTACHMENT_CLOSED');
        const page = this.pages.get(pageId);
        if (!page?.global)
            throw Error('BROWSER3_PAGE_WINDOW_PENDING');
        return page.global.dup();
    }
    requestNative(pageId, request) {
        const page = this.pages.get(pageId);
        if (!page || !this.live(page) || !page.session)
            return Promise.reject(Error('BROWSER3_PAGE_CLOSED'));
        return page.session.request(request, page.abort.signal);
    }
    /** All enclosing Worker VM entries use these seams. A pending author Promise
     * must be observed with promiseResult, rather than awaited as a root tail. */
    async entry(operation) {
        if (!this.active)
            throw Error('BROWSER3_ATTACHMENT_CLOSED');
        this.entered++;
        try {
            return await operation();
        }
        finally {
            this.entered--;
            if (this.active && this.entered === 0)
                await this.pump();
        }
    }
    enter(operation) {
        return this.entry(() => this.options.actor.enter(operation));
    }
    enterOriginal(context, javascript, filename) {
        return this.entry(() => this.options.actor.runSource(context, javascript, filename));
    }
    capture(context, expression, filename) {
        return this.entry(() => this.options.actor.capture(context, expression, filename));
    }
    call(context, callback, args = [], receiver = context.undefined) {
        return this.entry(() => this.options.actor.call(context, callback, args, receiver));
    }
    promiseResult(context, promise) {
        return this.entry(() => this.options.actor.promiseResult(context, promise));
    }
    drain() { return this.entry(() => this.options.actor.drain()); }
    /** This is a native/parser scheduler, not another VM queue. Every VM action
     * below enters the supplied Actor separately, after the prior entry returns. */
    pump() {
        if (!this.active || this.entered > 0)
            return Promise.resolve();
        if (this.pumping)
            return this.pumping;
        const running = this.pumpPages();
        this.pumping = running;
        void running.finally(() => {
            if (this.pumping === running)
                this.pumping = undefined;
            if (this.active && this.entered === 0 && (this.mountQueue.length || this.readyQueue.length))
                void this.pump().catch(error => this.options.onPageError?.('attachment', error));
        }).catch(() => { });
        return running;
    }
    async pumpPages() {
        while (this.active && this.entered === 0) {
            const page = this.mountQueue.shift() ?? this.readyQueue.shift();
            if (!page)
                return;
            if (!this.live(page))
                continue;
            try {
                if (page.phase === 'ready')
                    await this.finishLoad(page);
                else
                    await this.advanceParser(page);
            }
            catch (error) {
                if (!this.live(page))
                    continue;
                page.phase = 'failed';
                await this.retire(page);
                this.options.onPageError?.(page.pageId, error);
            }
        }
    }
    async advanceParser(page) {
        const { actor } = this.options, session = page.session, signal = page.abort.signal;
        if (page.phase === 'queued') {
            page.context = await actor.createPage(page.pageId);
            if (!this.live(page))
                return;
            await actor.enter(() => { if (this.live(page))
                page.global = page.context.global; });
            const document = await session.getDocumentHandle(signal);
            if (!this.live(page))
                return;
            page.controller = await this.options.bootstrap({ pageId: page.pageId, frame: page.frame,
                plan: page.plan, context: page.context, parentContext: page.parentContext, document, signal });
            if (!this.live(page))
                return;
            page.phase = 'parsing';
            await session.setDocumentState('loading', signal);
        }
        if (!this.live(page))
            return;
        const ack = await session.applyUntil(page.plan.parsed.steps.length, signal);
        if (!this.live(page))
            return;
        if (ack.boundary) {
            const script = page.scripts.get(ack.boundary.inlineOrdinal);
            if (script.mode === 'data' || script.inTemplate) {
                this.mountQueue.push(page);
                return;
            }
            const node = await session.getParsedNodeHandle(ack.boundary.nodeId, signal);
            if (!this.live(page))
                return;
            await page.controller.setCurrentScript(node);
            try {
                if (this.live(page))
                    await actor.runSource(page.context, script.javascript, `source-page-${page.pageId}-classic-${script.inlineOrdinal}.js`);
            }
            finally {
                if (this.live(page))
                    await page.controller.setCurrentScript(null);
            }
            if (!this.live(page))
                return;
            await actor.drain();
            if (this.live(page))
                this.mountQueue.push(page);
            return;
        }
        if (!ack.ended)
            throw Error('BROWSER3_PARSER_ACK_INCOMPLETE');
        await session.setDocumentState('interactive', signal);
        if (!this.live(page))
            return;
        await page.controller.dispatchLifecycle('readystatechange');
        if (!this.live(page))
            return;
        await page.controller.dispatchLifecycle('DOMContentLoaded');
        if (!this.live(page))
            return;
        await actor.drain();
        if (!this.live(page))
            return;
        page.phase = 'resources';
        // The readiness continuation only enqueues a live page. It holds neither
        // the shared Actor nor the parser pump while native resources are pending.
        void session.awaitResourcesReady(signal).then(() => {
            if (!this.live(page))
                return;
            page.phase = 'ready';
            this.readyQueue.push(page);
            return this.pump();
        }, error => {
            if (!this.live(page))
                return;
            this.options.onPageError?.(page.pageId, error);
            return this.retire(page);
        }).catch(error => this.options.onPageError?.(page.pageId, error));
    }
    async finishLoad(page) {
        await page.session.setDocumentState('complete', page.abort.signal);
        if (!this.live(page))
            return;
        await page.controller.dispatchLifecycle('readystatechange');
        if (!this.live(page))
            return;
        await page.controller.dispatchLifecycle('load');
        if (!this.live(page))
            return;
        await this.options.actor.drain();
        if (!this.live(page))
            return;
        page.phase = 'loaded';
        await this.options.frameLoaded(page.frame, page.pageId);
        if (this.live(page))
            await this.options.actor.drain();
    }
    dispose() {
        if (this.disposal)
            return this.disposal;
        // Revoke first, aborting suspended transport waits before queued VM free.
        this.active = false;
        this.mountQueue.length = 0;
        this.readyQueue.length = 0;
        const native = [...this.pages.values()].map(page => this.retire(page));
        this.disposal = this.finishDisposal(native);
        return this.disposal;
    }
    async finishDisposal(native) {
        const results = await Promise.allSettled(native);
        const { actor } = this.options;
        try {
            // Aborted parser ACKs may reject the in-flight pump; they must never
            // bypass the final Actor release.
            await this.pumping?.catch(() => { });
            await actor.enter(() => {
                for (const page of this.pages.values())
                    page.controller?.disposeHandles();
            });
        }
        finally {
            await actor.dispose();
            this.frames.clear();
            this.closingFrames.clear();
            this.pages.clear();
        }
        const failed = results.find(result => result.status === 'rejected');
        if (failed?.status === 'rejected')
            throw failed.reason;
    }
}
