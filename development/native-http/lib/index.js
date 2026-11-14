// Generated from runtime/alpha3/compat/native-http/src/index.ts; edit the TypeScript source.
/** Product-owned HTTP/1 pools using the launcher's current proxy policy. */
import { Agent, ProxyAgent, Dispatcher, Dispatcher1Wrapper } from 'undici';
import { proxyRouteFor } from '@deepseek-ai/dsh-http-proxy';
class NativeHttpDispatcher extends Dispatcher {
    dispatchers = new Map();
    closing;
    dispatch(options, handler) {
        if (this.closing !== undefined)
            throw new TypeError('Native HTTP transport is closed');
        // Native fetch may redirect to another origin. Resolve the official policy
        // at each actual delegation, including redirects and already pooled origins.
        const route = proxyRouteFor(new URL(String(options.origin)));
        const proxy = route.proxied ? route.proxy : undefined;
        let dispatcher = this.dispatchers.get(proxy);
        if (dispatcher === undefined) {
            dispatcher = proxy === undefined ? new Agent({ allowH2: false }) : new ProxyAgent({ uri: proxy, allowH2: false });
            this.dispatchers.set(proxy, dispatcher);
        }
        return dispatcher.dispatch(options, handler);
    }
    close() {
        return this.closing ??= Promise.all([...this.dispatchers.values()].map(dispatcher => dispatcher.close())).then(() => { });
    }
}
/** One provider lifetime owns its pools. The official launcher remains the route owner. */
export function createNativeHttpTransport() {
    const nativeFetch = globalThis.fetch;
    const owned = new NativeHttpDispatcher();
    // Node fetch uses Dispatcher v1. Use Undici 8's own public compatibility
    // adapter, as its global installation does, without changing process globals.
    const dispatcher = new Dispatcher1Wrapper(owned);
    return {
        fetch: (input, init) => nativeFetch(input, { ...init, dispatcher }),
        close: () => owned.close(),
    };
}
