
// Author JS is card data, and the documented contract already gives it nothing
// but `root` and `fill`. A bare `new Function` still left the real `document`
// and `window` in scope, so a card could register a page-wide listener that no
// teardown ever removed; because this script re-runs for every committed
// paragraph, the leak grew by one more duplicate handler per run and any event
// they listened for would fan out into all of them. Hand the card restricted
// faces instead: event registration lands on `root` and is recorded, timers are
// recorded, and teardown then unhooks everything the card registered on top of
// whatever cleanup it returned itself. Name-based escapes through
// `root.ownerDocument` or an inner `eval` still exist; a real sandbox needs a
// frame.
type AuthorRegistration = {type: string;handler: EventListenerOrEventListenerObject;options?: AddEventListenerOptions;};


export function createAuthorRuntime(root: HTMLElement, fill: (text: string) => void): {run: (source: string) => (() => void) | null;teardown: () => void;} {
    const registrations: AuthorRegistration[] = [];
    const timers = new Set<number>();
    const add = (type: unknown, handler: unknown, options?: unknown): void => {
        if (typeof type !== 'string' || !handler) return;
        const registration: AuthorRegistration = {
            type,
            handler: handler as EventListenerOrEventListenerObject,
            options: options as AddEventListenerOptions | undefined
        };
        registrations.push(registration);
        root.addEventListener(registration.type, registration.handler, registration.options);
    };
    const remove = (type: unknown, handler: unknown, options?: unknown): void => {
        const index = registrations.findIndex(item => item.type === type && item.handler === handler);
        if (index >= 0) registrations.splice(index, 1);
        if (typeof type === 'string' && handler) root.removeEventListener(
        type,
            handler as EventListenerOrEventListenerObject,
            options as EventListenerOptions | undefined
        );
    };
    const clock = (name: string) => (name === 'setTimeout' || name === 'setInterval')
        ? (callback: unknown, delay?: unknown): number => {
            if (typeof callback !== 'function') return 0;
            const id = name === 'setTimeout' ? setTimeout(callback as () => void, delay as number) : setInterval(callback as () => void, delay as number);
            const numeric = Number(id);
            timers.add(numeric);
            return numeric;
        }
        : (id: unknown): void => {
            const numeric = Number(id);
            timers.delete(numeric);
            if (name === 'clearTimeout') clearTimeout(numeric);
            else clearInterval(numeric);
        };
    let windowFace: object | undefined;
    const face = (target: object): object => new Proxy(target, {
        get(inner, key) {
            if (typeof key !== 'string') return Reflect.get(inner, key, inner);
            if (key === 'addEventListener') return add;
            if (key === 'removeEventListener') return remove;
            if (key === 'setTimeout' || key === 'setInterval' || key === 'clearTimeout' || key === 'clearInterval') return clock(key);
            if (key === 'document') return documentFace;
            if (key === 'window' || key === 'self' || key === 'globalThis' || key === 'top' || key === 'parent') return windowFace ?? inner;
            const value: unknown = Reflect.get(inner, key, inner);
            return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(inner) : value;
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
        run: (source: string) => {
            const author = new Function('root',
                 'fill',
                 'document',
                 'window',
                 'globalThis',
                 'self',
                 'top',
                 'parent',
                 'setTimeout',
                 'setInterval',
                 'clearTimeout',
                 'clearInterval',
                 source) as (...values: unknown[]) => unknown;
            // Sloppy-mode `this` is the global object for a plain call, which would
            // hand the card the real `window` and undo the parameter shadowing.
            const result = author.call(windowFace, ...args);
            return typeof result === 'function' ? result as () => void : null;
        },

        teardown: () => {
            for (const registration of registrations.splice(0)) {
                try {root.removeEventListener(registration.type, registration.handler, registration.options);} catch { /* already detached */ }
            }
            for (const id of timers) {clearTimeout(id);clearInterval(id);}
            timers.clear();
        },
    };
}
