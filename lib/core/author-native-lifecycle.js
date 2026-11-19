// Generated from runtime/alpha3/src/core/author-native-lifecycle.ts; edit the TypeScript source.
export function createAuthorNativeLifecyclePublisher(options = {}) {
    const sessions = new Map();
    function subscribe(sessionId) {
        options.beforeSubscribe?.(sessionId);
        const queue = [], listeners = new Set();
        let active = true;
        const peek = (ackToken) => {
            if (ackToken !== undefined && queue[0]?.token === ackToken)
                queue.shift();
            return queue[0];
        };
        const notify = () => { for (const listener of [...listeners])
            listener(); };
        const endpoint = { push(packet) { if (active) {
                queue.push(packet);
                notify();
            } },
            dispose() {
                if (!active)
                    return;
                active = false;
                queue.length = 0;
                notify();
                listeners.clear();
                const receivers = sessions.get(sessionId);
                receivers?.delete(endpoint);
                if (!receivers?.size) {
                    sessions.delete(sessionId);
                    options.afterUnsubscribe?.(sessionId);
                }
            } };
        let receivers = sessions.get(sessionId);
        if (!receivers) {
            receivers = new Set();
            sessions.set(sessionId, receivers);
        }
        receivers.add(endpoint);
        return { peek, onReady(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
            wait(ackToken, signal) {
                signal.throwIfAborted();
                const available = peek(ackToken);
                if (available)
                    return Promise.resolve(available);
                return new Promise((resolve, reject) => {
                    const cleanup = () => { listeners.delete(ready); signal.removeEventListener('abort', abort); };
                    const abort = () => { cleanup(); reject(signal.reason ?? Error('AUTHOR_NATIVE_LIFECYCLE_ABORTED')); };
                    const ready = () => {
                        if (!active) {
                            cleanup();
                            reject(Error('AUTHOR_NATIVE_LIFECYCLE_CLOSED'));
                            return;
                        }
                        const packet = peek();
                        if (packet) {
                            cleanup();
                            resolve(packet);
                        }
                    };
                    listeners.add(ready);
                    signal.addEventListener('abort', abort, { once: true });
                    ready();
                });
            }, dispose: endpoint.dispose };
    }
    return { subscribe, publish(sessionId, packet) {
            for (const receiver of sessions.get(sessionId) ?? [])
                receiver.push(packet);
        }, dispose() { for (const receivers of [...sessions.values()])
            for (const receiver of [...receivers])
                receiver.dispose(); } };
}
