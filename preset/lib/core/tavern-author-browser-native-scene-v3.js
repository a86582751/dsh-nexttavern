// Generated from runtime/alpha3/src/core/tavern-author-browser-native-scene-v3.ts; edit the TypeScript source.
/** Main owns actual native carrier documents and Source frames. Worker RPC
 * addresses these resources; neither a posted plan nor a caller ID owns them. */
import { createBrowserSourceFrameOwnerV3 } from './tavern-author-browser-frame-native-v3.js';
import { createBrowserPageRendererV3 } from './tavern-author-browser-renderer-v3.js';
export function createBrowserNativeSceneV3(options) {
    const abort = new AbortController(), carriers = new Map(), pages = new Map();
    const frameTokens = new Map();
    const publishedFrameReferences = new Set();
    const pagePlans = new Map(options.program.sourcePages.map(plan => [plan.pagePlanSha256, plan]));
    let active = true, disposal;
    const frames = createBrowserSourceFrameOwnerV3({ onCallback: options.onCallback,
        onFrameClosed: (frame, pageId) => {
            frameTokens.delete(frame.frameId);
            if (pageId)
                pages.delete(pageId);
            if (active)
                options.onFrameClosed(frame.frameId);
        }, rendererOptions: () => ({ schedulerWindow: options.schedulerWindow,
            onCallback: options.onCallback, onPromiseSettlement: options.onSettlement,
            resolveResource: options.resolveResource }) });
    function remember(value, facts) {
        if (!value || typeof value !== 'object')
            return;
        if (Array.isArray(value)) {
            for (const item of value)
                remember(item, facts);
            return;
        }
        const wire = value;
        if ('tag' in wire && wire.tag === 'handle' && wire.kind === 'frame') {
            const referenceKey = wire.pageId + ':' + wire.handle;
            // removeChild legitimately returns its now-closed resource. Publication
            // already supplied that identity; the echo must not register it again.
            if (publishedFrameReferences.has(referenceKey))
                return;
            const frame = frames.getFrame(wire);
            if (!frameTokens.has(frame.frameId)) {
                frameTokens.set(frame.frameId, frame);
                publishedFrameReferences.add(referenceKey);
                facts.push({ frameId: frame.frameId, reference: wire, ...frames.owner(frame) });
            }
        }
        else if ('tag' in wire && wire.tag === 'record') {
            for (const item of Object.values(wire.entries))
                remember(item, facts);
        }
    }
    async function createCarrier(ordinal, contextId) {
        const script = options.program.scripts.find(row => row.ordinal === ordinal);
        const source = await options.createCarrierDocument(script, contextId, abort.signal);
        try {
            abort.signal.throwIfAborted();
            let scriptReference;
            // A trusted empty carrier shell is Native bootstrap DATA. It is not a
            // fabricated parsed Source candidate and carries no admission hashes.
            const renderer = createBrowserPageRendererV3({ document: source.document, pageId: contextId,
                schedulerWindow: options.schedulerWindow,
                plan: { parsed: { document: { documentNodeId: 0, mode: 'no-quirks', nodes: [] },
                        steps: [], scripts: [], styles: [], resources: [] }, resources: options.program.sourcePages.flatMap(plan => plan.resources) },
                carrierScript: { javascript: script.javascript, identity: script.descriptor.identity,
                    captured: reference => { scriptReference = reference; } },
                externalFrames: frames.forCarrier({ document: source.document, pageId: contextId,
                    carrierIdentity: script.descriptor.identity }), onCallback: options.onCallback,
                onPromiseSettlement: options.onSettlement, resolveResource: options.resolveResource });
            carriers.set(contextId, { source, renderer });
            return { document: renderer.getDocumentHandle(), script: scriptReference };
        }
        catch (error) {
            await source.dispose();
            throw error;
        }
    }
    async function disposeCarrier(contextId) {
        const carrier = carriers.get(contextId);
        if (!carrier)
            return;
        carriers.delete(contextId);
        try {
            await carrier.renderer.dispose();
        }
        finally {
            await carrier.source.dispose();
        }
    }
    async function request(input) {
        abort.signal.throwIfAborted();
        let value;
        if (input.op === 'carrier-create')
            value = await createCarrier(input.ordinal, input.contextId);
        else if (input.op === 'carrier-state')
            carriers.get(input.contextId).renderer.setDocumentState(input.state);
        else if (input.op === 'carrier-dispose')
            await disposeCarrier(input.contextId);
        else if (input.op === 'native') {
            const target = 'target' in input.request ? input.request.target : undefined;
            const contextId = target?.pageId ?? input.contextId, carrier = carriers.get(contextId);
            value = carrier ? carrier.renderer.requestReply(input.request)
                : await pages.get(contextId).session.request(input.request, abort.signal);
        }
        else if (input.op === 'page-mount') {
            const frame = frameTokens.get(input.frameId), plan = pagePlans.get(input.planSha256);
            const owner = frames.owner(frame);
            if (owner.carrierIdentity !== plan.origin.carrier.identity || !carriers.has(owner.parentPageId))
                throw Error('BROWSER3_SOURCE_PAGE_PARENT_UNPROVEN');
            const session = await frames.transport.mount(frame, input.pageId, plan, abort.signal);
            pages.set(input.pageId, { frame, session });
        }
        else if (input.op === 'page-dispose') {
            const page = pages.get(input.pageId);
            if (page) {
                pages.delete(input.pageId);
                await frames.transport.dispose(page.frame, input.pageId);
            }
        }
        else if (input.op === 'frame-location')
            frames.recordLocation(frameTokens.get(input.frameId), input.location);
        else if (input.op === 'page-loaded')
            frames.frameLoaded(frameTokens.get(input.frameId), input.pageId);
        else {
            const pageId = 'pageId' in input ? input.pageId : undefined, session = pageId ? pages.get(pageId).session : undefined;
            if (input.op === 'page-apply')
                value = await session.applyUntil(input.exclusiveEnd, abort.signal);
            else if (input.op === 'page-document')
                value = await session.getDocumentHandle(abort.signal);
            else if (input.op === 'page-node')
                value = await session.getParsedNodeHandle(input.nodeId, abort.signal);
            else if (input.op === 'page-state')
                await session.setDocumentState(input.state, abort.signal);
            else if (input.op === 'page-resources')
                await session.awaitResourcesReady(abort.signal);
            else
                throw Error('BROWSER3_NATIVE_SCENE_OPERATION_UNSUPPORTED');
        }
        // DOM Events themselves stay in their Main owner. Only callback snapshots
        // cross the Worker port; nativeEvent is an in-process gesture hook.
        if (input.op === 'native') {
            const reply = value;
            value = { ...reply, ...reply.callbacks ? { callbacks: reply.callbacks.map(({ nativeEvent: _, ...callback }) => callback) } : {} };
        }
        const facts = [];
        if (input.op === 'native')
            remember(value.value, facts);
        return { value, frames: facts };
    }
    function dispose() {
        if (disposal)
            return disposal;
        active = false;
        abort.abort();
        disposal = (async () => {
            const results = await Promise.allSettled([...carriers.keys()].map(disposeCarrier));
            frames.dispose();
            pages.clear();
            frameTokens.clear();
            publishedFrameReferences.clear();
            const failed = results.find(result => result.status === 'rejected');
            if (failed?.status === 'rejected')
                throw failed.reason;
        })();
        return disposal;
    }
    return { request, dispose, resources: () => ({ carriers: carriers.size, pageRoutes: pages.size, ...frames.resources() }) };
}
