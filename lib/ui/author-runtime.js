// Generated from runtime/alpha3/src/ui/author-runtime.ts; edit the TypeScript source.
export function createAuthorRuntime(root, fill) {
    const registrations = [];
    const timers = new Set();
    const add = (type, handler, options) => {
        if (typeof type !== 'string' || !handler)
            return;
        const registration = {
            type,
            handler: handler,
            options: options
        };
        registrations.push(registration);
        root.addEventListener(registration.type, registration.handler, registration.options);
    };
    const remove = (type, handler, options) => {
        const index = registrations.findIndex(item => item.type === type && item.handler === handler);
        if (index >= 0)
            registrations.splice(index, 1);
        if (typeof type === 'string' && handler)
            root.removeEventListener(type, handler, options);
    };
    const clock = (name) => (name === 'setTimeout' || name === 'setInterval')
        ? (callback, delay) => {
            if (typeof callback !== 'function')
                return 0;
            const id = name === 'setTimeout' ? setTimeout(callback, delay) : setInterval(callback, delay);
            const numeric = Number(id);
            timers.add(numeric);
            return numeric;
        }
        : (id) => {
            const numeric = Number(id);
            timers.delete(numeric);
            if (name === 'clearTimeout')
                clearTimeout(numeric);
            else
                clearInterval(numeric);
        };
    let windowFace;
    const face = (target) => new Proxy(target, {
        get(inner, key) {
            if (typeof key !== 'string')
                return Reflect.get(inner, key, inner);
            if (key === 'addEventListener')
                return add;
            if (key === 'removeEventListener')
                return remove;
            if (key === 'setTimeout' || key === 'setInterval' || key === 'clearTimeout' || key === 'clearInterval')
                return clock(key);
            if (key === 'document')
                return documentFace;
            if (key === 'window' || key === 'self' || key === 'globalThis' || key === 'top' || key === 'parent')
                return windowFace ?? inner;
            const value = Reflect.get(inner, key, inner);
            return typeof value === 'function' ? value.bind(inner) : value;
        },
    });
    const documentFace = face(document);
    windowFace = face(window);
    const timeout = clock('setTimeout'), interval = clock('setInterval');
    const args = [
        root,
        fill,
        documentFace,
        windowFace,
        windowFace,
        windowFace,
        windowFace,
        windowFace,
        timeout,
        interval,
        clock('clearTimeout'),
        clock('clearInterval')
    ];
    return {
        run: (source) => {
            const author = new Function('root', 'fill', 'document', 'window', 'globalThis', 'self', 'top', 'parent', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', source);
            // Sloppy-mode `this` is the global object for a plain call, which would
            // hand the card the real `window` and undo the parameter shadowing.
            const result = author.call(windowFace, ...args);
            return typeof result === 'function' ? result : null;
        },
        teardown: () => {
            for (const registration of registrations.splice(0)) {
                try {
                    root.removeEventListener(registration.type, registration.handler, registration.options);
                }
                catch { /* already detached */ }
            }
            for (const id of timers) {
                clearTimeout(id);
                clearInterval(id);
            }
            timers.clear();
        },
    };
}
