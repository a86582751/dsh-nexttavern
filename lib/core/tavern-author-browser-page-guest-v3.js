// Generated from runtime/alpha3/src/core/tavern-author-browser-page-guest-v3.ts; edit the TypeScript source.
/** Evaluated only in an owned QuickJS page. Native DOM/resources and the
 * Source writer remain in their actual owners; this closure retains guest
 * callbacks, logical parser events and native Promise settlements. */
export function browserPageGuestBootstrapV3(config) {
    const parse = JSON.parse.bind(JSON), stringify = JSON.stringify.bind(JSON);
    const global = globalThis;
    const native = global.__ownedPageDomV3, windowValue = global.__ownedPageWindowV3;
    const notify = global.__ownedPageNotifyV3, registry = global.__ownedPageRegistryV3;
    delete global.__ownedPageDomV3;
    delete global.__ownedPageWindowV3;
    delete global.__ownedPageNotifyV3;
    delete global.__ownedPageRegistryV3;
    const metadata = registry?.metadata ?? new WeakMap(), proxies = registry?.proxies ?? new Map();
    const callbacks = new Map(), callbackIds = new WeakMap();
    const promises = new Map();
    const lifecycle = new Map();
    const properties = new Map();
    const logicalEvents = registry?.logicalEvents ?? new WeakMap();
    const eventDetails = registry?.eventDetails ?? new WeakMap();
    const registrations = new Map();
    const localPreferences = new Map(), sessionPreferences = new Map();
    let sequence = 0, currentScript = null, active = true;
    function callback(fn) {
        let id = callbackIds.get(fn);
        if (id === undefined) {
            id = ++sequence;
            callbackIds.set(fn, id);
            callbacks.set(id, fn);
        }
        // Registration belongs to this native resource owner, even when fn's
        // lexical realm is another live/retired page in the shared runtime.
        return { tag: 'callback', pageId: config.pageId, callbackId: id };
    }
    function encode(value) {
        if (value === undefined)
            return { tag: 'undefined' };
        if (typeof value === 'function')
            return callback(value);
        if (value && typeof value === 'object') {
            const owned = metadata.get(value);
            if (owned)
                return owned;
            if (Array.isArray(value))
                return value.map(encode);
            return { tag: 'record', entries: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)])) };
        }
        return value;
    }
    function rpc(payload) {
        if (!active)
            throw Error('BROWSER3_PAGE_CLOSED');
        const result = parse(native(stringify(payload)));
        if (result.error)
            throw Error(result.error);
        if (result.callbacks?.length) {
            if (registry)
                registry.dispatch(result.callbacks);
            else
                deliverBatch(result.callbacks);
        }
        return decode(result.value);
    }
    function addNativeListener(target, type, fn, options, payload) {
        if (typeof fn !== 'function')
            return;
        const listenerId = rpc(payload);
        registrations.set(listenerId, { target, type, fn, capture: typeof options === 'boolean' ? options : options?.capture === true });
    }
    function removeNativeListener(target, type, fn, options, payload) {
        rpc(payload);
        const capture = typeof options === 'boolean' ? options : options?.capture === true;
        for (const [id, row] of registrations)
            if (row.target === target && row.type === type && row.fn === fn && row.capture === capture)
                registrations.delete(id);
    }
    function eventType(target, type) {
        return (target === global || target === document) && ['readystatechange', 'DOMContentLoaded', 'load'].includes(type);
    }
    function listen(target, type, fn, options) {
        if (typeof fn !== 'function')
            return;
        const capture = typeof options === 'boolean' ? options : options?.capture === true;
        const group = lifecycle.get(target) ?? new Map();
        lifecycle.set(target, group);
        const rows = group.get(type) ?? [];
        group.set(type, rows);
        if (!rows.some((row) => row.fn === fn && row.capture === capture))
            rows.push({ fn, capture, once: options?.once === true });
    }
    function unlisten(target, type, fn, options) {
        const capture = typeof options === 'boolean' ? options : options?.capture === true;
        const rows = lifecycle.get(target)?.get(type);
        if (rows)
            for (let index = rows.length - 1; index >= 0; index--)
                if (rows[index].fn === fn && rows[index].capture === capture)
                    rows.splice(index, 1);
    }
    function invoke(fn, receiver, args) {
        try {
            const result = Reflect.apply(fn, receiver, args);
            // Browser event dispatch does not await returned author Promises. The
            // normal Worker job pump handles their continuations and rejections.
            if (result && typeof result.then === 'function')
                Promise.resolve(result).catch(error => notify(stringify({ type: 'page-callback-error', pageId: config.pageId, error: String(error) })));
        }
        catch (error) {
            notify(stringify({ type: 'page-callback-error', pageId: config.pageId, error: String(error) }));
        }
    }
    function nativePromise(id) {
        let pending = promises.get(id);
        if (!pending) {
            let resolve, reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            pending = { promise, resolve, reject };
            promises.set(id, pending);
        }
        return pending.promise;
    }
    function decode(value) {
        if (value === null || typeof value !== 'object')
            return value;
        if (Array.isArray(value))
            return value.map(decode);
        if (value.tag === 'undefined')
            return undefined;
        if (value.tag === 'record')
            return Object.fromEntries(Object.entries(value.entries).map(([key, item]) => [key, decode(item)]));
        if (value.tag === 'page-window')
            return windowValue(value.pageId);
        if (value.tag === 'promise')
            return nativePromise(value.promiseId);
        if (value.tag !== 'handle')
            throw Error('BROWSER3_NATIVE_VALUE_UNSUPPORTED');
        const key = value.pageId + ':' + value.handle;
        if (proxies.has(key))
            return proxies.get(key);
        if (registry && value.pageId !== config.pageId && value.pageId !== 'source-blobs') {
            const owned = registry.decode(value);
            if (owned !== undefined)
                return owned;
        }
        const methods = new Set(config.methods[value.kind] ?? []);
        const nativeProperties = new Set(config.properties?.[value.kind] ?? []);
        const guestFields = ['document', 'node', 'frame', 'frame-parent'].includes(value.kind) && config.properties !== undefined;
        const proxy = new Proxy({}, {
            get(target, name) {
                if (Object.prototype.hasOwnProperty.call(target, name))
                    return Reflect.get(target, name);
                if (name === Symbol.toStringTag)
                    return value.kind;
                if (typeof name === 'symbol' || name === 'then')
                    return undefined;
                if (value.kind === 'document' && name === 'currentScript')
                    return currentScript;
                const logical = logicalEvents.get(proxy);
                if (value.kind === 'event' && name === 'detail' && eventDetails.has(proxy))
                    return eventDetails.get(proxy);
                if (logical && name === 'target')
                    return logical.target;
                if (logical && name === 'currentTarget')
                    return logical.currentTarget;
                if (logical && name === 'eventPhase')
                    return logical.eventPhase;
                if (logical && (name === 'stopPropagation' || name === 'stopImmediatePropagation'))
                    return () => {
                        logical.stopped = true;
                        if (name === 'stopImmediatePropagation')
                            logical.immediate = true;
                        rpc({ op: 'call', target: value, method: name, args: [] });
                    };
                if (name === 'addEventListener')
                    return (type, fn, options) => {
                        if (eventType(proxy, type)) {
                            listen(proxy, type, fn, options);
                            return;
                        }
                        addNativeListener(proxy, type, fn, options, { op: 'call', target: value, method: name, args: [encode(type), encode(fn), encode(options)] });
                    };
                if (name === 'removeEventListener')
                    return (type, fn, options) => {
                        if (eventType(proxy, type)) {
                            unlisten(proxy, type, fn, options);
                            return;
                        }
                        removeNativeListener(proxy, type, fn, options, { op: 'call', target: value, method: name, args: [encode(type), encode(fn), encode(options)] });
                    };
                if (name.startsWith('on'))
                    return properties.get(proxy)?.get(name) ?? null;
                if (methods.has(name))
                    return (...args) => {
                        if (value.kind === 'document' && ['querySelector', 'querySelectorAll', 'getElementById'].includes(name)) {
                            const selector = name === 'getElementById' ? args[0] === 'user_avatar_block' ? '#user_avatar_block' : undefined : args[0];
                            const selected = registry?.personaSelection?.(value.pageId, selector);
                            if (selected !== undefined)
                                return name === 'querySelectorAll' ? selected : selected[0] ?? null;
                        }
                        if (name === 'dispatchEvent')
                            logicalEvents.delete(args[0]);
                        const result = rpc({ op: 'call', target: value, method: name, args: args.map(encode) });
                        if (value.pageId === 'source-blobs' && value.kind === 'blob' && name === 'text')
                            return Promise.resolve(result);
                        return name === 'dispatchEvent' ? result && !args[0].defaultPrevented : result;
                    };
                // Author expandos belong to this ordinary VM object. The closed native
                // owner catalog determines which actual DOM slots require its ACK.
                if (guestFields && !nativeProperties.has(name))
                    return Reflect.get(target, name);
                return rpc({ op: 'get', target: value, key: name });
            },
            set(target, name, next) {
                if (typeof name === 'symbol')
                    return Reflect.set(target, name, next);
                if (name.startsWith('on')) {
                    const group = properties.get(proxy) ?? new Map();
                    properties.set(proxy, group);
                    if (typeof next === 'function')
                        group.set(name, next);
                    else
                        group.delete(name);
                    if (!eventType(proxy, name.slice(2)))
                        rpc({ op: 'set', target: value, key: name, value: encode(next) });
                }
                else if (Object.prototype.hasOwnProperty.call(target, name)
                    || guestFields && !nativeProperties.has(name))
                    return Reflect.set(target, name, next);
                else
                    rpc({ op: 'set', target: value, key: name, value: encode(next) });
                return true;
            },
        });
        proxies.set(key, proxy);
        metadata.set(proxy, value);
        return proxy;
    }
    const document = decode(config.document);
    metadata.set(global, { tag: 'page-window', pageId: config.pageId });
    const define = (name, value) => Object.defineProperty(global, name, { value, writable: true, configurable: true });
    define('window', global);
    define('self', global);
    define('document', document);
    // The Worker installs parent as an actual same-runtime guest global before
    // this bootstrap; no author-visible parent property is used as a registry.
    define('addEventListener', (type, fn, options) => {
        if (eventType(global, type))
            listen(global, type, fn, options);
        else
            addNativeListener(global, type, fn, options, { op: 'window-listen', type, callback: callback(fn), options: encode(options) });
    });
    define('removeEventListener', (type, fn, options) => {
        if (eventType(global, type))
            unlisten(global, type, fn, options);
        else
            removeNativeListener(global, type, fn, options, { op: 'window-unlisten', type, callback: callback(fn), options: encode(options) });
    });
    define('dispatchEvent', (event) => {
        logicalEvents.delete(event);
        const result = rpc({ op: 'window-dispatch', event: metadata.get(event) });
        return result && !event.defaultPrevented;
    });
    define('navigator', Object.freeze(rpc({ op: 'window-read', key: 'navigator' })));
    for (const type of ['readystatechange', 'DOMContentLoaded', 'load'])
        Object.defineProperty(global, 'on' + type, {
            configurable: true, get: () => properties.get(global)?.get('on' + type) ?? null,
            set: (fn) => {
                const group = properties.get(global) ?? new Map();
                properties.set(global, group);
                if (typeof fn === 'function')
                    group.set('on' + type, fn);
                else
                    group.delete('on' + type);
            },
        });
    const timer = (mode, fn, delay) => rpc({ op: 'timer', mode, callback: callback(fn), delay });
    define('setTimeout', (fn, delay, ...args) => timer('timeout', () => Reflect.apply(fn, global, args), delay));
    define('setInterval', (fn, delay, ...args) => timer('interval', () => Reflect.apply(fn, global, args), delay));
    define('requestAnimationFrame', (fn) => timer('raf', fn));
    for (const name of ['clearTimeout', 'clearInterval', 'cancelAnimationFrame'])
        define(name, (timerId) => rpc({ op: 'clear-timer', timerId }));
    define('getComputedStyle', (target) => rpc({ op: 'computed-style', target: metadata.get(target) }));
    define('matchMedia', (query) => rpc({ op: 'match-media', query: String(query) }));
    define('performance', { now: () => rpc({ op: 'window-read', key: 'performance-now' }) });
    for (const key of ['devicePixelRatio', 'innerWidth', 'innerHeight', 'visualViewport'])
        Object.defineProperty(global, key, {
            configurable: true, get: () => rpc({ op: 'window-read', key }),
        });
    define('Image', function Image() { return rpc({ op: 'create', creation: { kind: 'image' } }); });
    define('Audio', function Audio(source) { return rpc({ op: 'create', creation: { kind: 'audio', source } }); });
    define('FileReader', function FileReader() { return rpc({ op: 'create', creation: { kind: 'file-reader' } }); });
    Object.assign(global.FileReader, { EMPTY: 0, LOADING: 1, DONE: 2 });
    for (const [name, kind] of [['MutationObserver', 'mutation-observer'], ['ResizeObserver', 'resize-observer']])
        define(name, function Observer(fn) { return rpc({ op: 'create', creation: { kind, callback: callback(fn) } }); });
    define('Blob', function Blob(parts = [], options = {}) {
        return rpc({ op: 'create', creation: { kind: 'blob', parts: parts.map(encode), mime: String(options.type ?? '') } });
    });
    define('URL', { createObjectURL: (blob) => rpc({ op: 'object-url', target: metadata.get(blob) }),
        revokeObjectURL: (url) => rpc({ op: 'revoke-object-url', url: String(url) }) });
    for (const [name, kind] of [['Event', 'event'], ['CustomEvent', 'custom-event'], ['MouseEvent', 'mouse-event']])
        define(name, function Event(type, options = {}) {
            // Native owns dispatch and geometry. Arbitrary CustomEvent detail is an
            // actual guest value, including functions and cycles, retained by the VM.
            const { detail, ...nativeOptions } = options;
            const event = rpc({ op: 'create', creation: { kind, type: String(type), options: encode(kind === 'custom-event' ? nativeOptions : options) } });
            if (kind === 'custom-event')
                eventDetails.set(event, detail ?? null);
            return event;
        });
    for (const [name, kinds] of [['Event', ['event']], ['Blob', ['blob', 'file']], ['FileReader', ['file-reader']]])
        Object.defineProperty(global[name], Symbol.hasInstance, {
            value: (value) => kinds.includes(metadata.get(value)?.kind),
        });
    // Ephemeral preferences have page lifetime. Durable author keys go through
    // the separately installed Source facade and canonical writer ACK.
    const storage = (preferences) => ({ getItem: (key) => preferences.get(String(key)) ?? null,
        setItem: (key, value) => { preferences.set(String(key), String(value)); },
        removeItem: (key) => { preferences.delete(String(key)); }, clear: () => preferences.clear(),
        key: (index) => [...preferences.keys()][index] ?? null, get length() { return preferences.size; } });
    define('localStorage', storage(localPreferences));
    define('sessionStorage', storage(sessionPreferences));
    function deliverOne(delivery) {
        const fn = callbacks.get(delivery.callback.callbackId);
        if (!fn)
            return;
        const receiver = delivery.receiver === undefined ? global : decode(delivery.receiver);
        if (delivery.registration) {
            if (delivery.registration.property) {
                if (properties.get(receiver)?.get(delivery.registration.property) !== fn)
                    return;
            }
            else if (!registrations.has(delivery.registration.listenerId))
                return;
        }
        let state;
        if (delivery.event) {
            const event = decode(delivery.event.reference);
            state = logicalEvents.get(event);
            if (state && (state.immediate || state.stopped && state.lastTarget !== receiver))
                return;
            if (!state) {
                state = { target: decode(delivery.event.target), currentTarget: receiver, stopped: false, immediate: false,
                    eventPhase: delivery.event.eventPhase };
                logicalEvents.set(event, state);
            }
            state.currentTarget = receiver;
            state.lastTarget = receiver;
            state.eventPhase = delivery.event.eventPhase;
        }
        if (delivery.registration?.once) {
            registrations.delete(delivery.registration.listenerId);
            rpc({ op: 'consume-listener', listenerId: delivery.registration.listenerId });
        }
        invoke(fn, receiver, delivery.args.map(decode));
    }
    function deliverBatch(deliveries) {
        try {
            for (const delivery of deliveries)
                deliverOne(delivery);
        }
        finally {
            for (const delivery of deliveries)
                if (delivery.event) {
                    const state = logicalEvents.get(decode(delivery.event.reference));
                    if (state) {
                        state.currentTarget = null;
                        state.eventPhase = 0;
                    }
                }
        }
    }
    return {
        ready(fn, jquery) {
            // The page owns parser readiness. Source keeps the real callback and
            // creator-bound $; neither is serialized or executed in the Main realm.
            const run = () => { if (active)
                invoke(fn, document, [jquery]); };
            if (document.readyState === 'loading')
                listen(document, 'DOMContentLoaded', run, { once: true });
            else
                void Promise.resolve().then(run);
            return undefined;
        },
        setCurrentScript(text) { currentScript = decode(parse(text)); return undefined; },
        dispatchLifecycle(text) {
            const { type } = parse(text);
            const event = new global.Event(type, { bubbles: type === 'DOMContentLoaded' });
            const state = { target: type === 'load' ? global : document, currentTarget: null, stopped: false, immediate: false, eventPhase: 2 };
            logicalEvents.set(event, state);
            for (const target of type === 'DOMContentLoaded' ? [document, global] : type === 'load' ? [global] : [document]) {
                if (state.stopped)
                    break;
                state.currentTarget = target;
                const rows = lifecycle.get(target)?.get(type) ?? [];
                for (const row of [...rows]) {
                    if (row.once) {
                        const index = rows.indexOf(row);
                        if (index >= 0)
                            rows.splice(index, 1);
                    }
                    invoke(row.fn, target, [event]);
                    if (state.immediate)
                        break;
                }
                const property = properties.get(target)?.get('on' + type);
                if (property && !state.immediate)
                    invoke(property, target, [event]);
            }
            state.currentTarget = null;
            state.eventPhase = 0;
            return undefined;
        },
        deliver(text) {
            deliverBatch([parse(text)]);
            return undefined;
        },
        deliverOne, decodeValue: decode, decodeNative: (text) => decode(parse(text)), finishDelivery: (event) => {
            const state = logicalEvents.get(decode(event));
            if (state) {
                state.currentTarget = null;
                state.eventPhase = 0;
            }
        },
        settle(text) {
            const settlement = parse(text), pending = promises.get(settlement.promiseId);
            if (pending) {
                promises.delete(settlement.promiseId);
                if (settlement.kind === 'fulfilled')
                    pending.resolve(decode(settlement.value));
                else
                    pending.reject(Error(settlement.error));
            }
            return undefined;
        },
        retire() {
            active = false;
            currentScript = null;
            lifecycle.clear();
            properties.clear();
            registrations.clear();
            localPreferences.clear();
            sessionPreferences.clear();
            // Keep callback/function identities until attachment disposal. A
            // parent-owned timer can still borrow an old page closure normally.
            for (const pending of promises.values())
                pending.reject(Error('BROWSER3_PAGE_CLOSED'));
            promises.clear();
            return undefined;
        },
        destroy() { active = false; callbacks.clear(); proxies.clear(); promises.clear(); lifecycle.clear(); properties.clear(); registrations.clear(); return undefined; },
    };
}
