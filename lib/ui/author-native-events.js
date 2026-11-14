// Generated from runtime/alpha3/src/ui/author-native-events.ts; edit the TypeScript source.
export function createAuthorNativeEventOwner(hooks) {
    const groups = new Map();
    let active = true;
    function remove(event, callback) {
        const group = groups.get(event), row = group?.listeners.get(callback);
        if (!group || !row)
            return;
        group.listeners.delete(callback);
        group.order.splice(group.order.indexOf(row), 1);
        if (!group.order.length)
            groups.delete(event);
        hooks.removed?.(row.data);
    }
    function subscribe(event, callback, once, position) {
        if (!active)
            throw Error('AUTHOR_NATIVE_BINDING_REVOKED');
        let group = groups.get(event);
        if (!group) {
            group = { listeners: new Map(), order: [] };
            groups.set(event, group);
        }
        let row = group.listeners.get(callback);
        const existing = !!row;
        if (!row) {
            row = { event, callback, once, data: hooks.create(event, once) };
            group.listeners.set(callback, row);
        }
        if (!existing || position !== 'normal') {
            if (existing)
                group.order.splice(group.order.indexOf(row), 1);
            if (position === 'first')
                group.order.unshift(row);
            else
                group.order.push(row);
            if (hooks.positioned)
                row.data = hooks.positioned(row.data, position);
        }
        return { stop: () => remove(event, callback) };
    }
    const current = (row) => active && groups.get(row.event)?.listeners.get(row.callback) === row;
    async function emit(event, args, selected) {
        const invoked = [];
        // Additions and moves affect the next emission. A removal cancels a
        // listener still waiting in this emission, including a once re-entry.
        for (const row of [...(groups.get(event)?.order ?? [])]) {
            if (!current(row) || selected && !selected(row.data))
                continue;
            const data = row.data;
            if (row.once)
                remove(event, row.callback);
            invoked.push(data);
            try {
                hooks.beforeInvoke?.(data);
                await row.callback(...args);
            }
            catch (error) {
                hooks.report(error);
            }
        }
        return invoked;
    }
    function emitAndWait(event, args) {
        // This historical public name has a void, synchronous-start contract.
        // Promises continue independently, with their rejections still reported.
        for (const row of [...(groups.get(event)?.order ?? [])]) {
            if (!current(row))
                continue;
            const data = row.data;
            if (row.once)
                remove(event, row.callback);
            try {
                hooks.beforeInvoke?.(data);
                void Promise.resolve(row.callback(...args)).catch(hooks.report);
            }
            catch (error) {
                hooks.report(error);
            }
        }
    }
    function clearEvent(event) {
        for (const row of [...(groups.get(event)?.order ?? [])])
            remove(event, row.callback);
    }
    function clearListener(callback) {
        for (const event of [...groups.keys()])
            remove(event, callback);
    }
    function clearAll() { for (const event of [...groups.keys()])
        clearEvent(event); }
    return {
        on: (event, callback) => subscribe(event, callback, false, 'normal'),
        once: (event, callback) => subscribe(event, callback, true, 'normal'),
        makeFirst: (event, callback) => subscribe(event, callback, false, 'first'),
        makeLast: (event, callback) => subscribe(event, callback, false, 'last'),
        remove, emit, emitAndWait, clearEvent, clearListener, clearAll,
        registrations: () => [...groups.values()].flatMap(group => group.order.map(row => row.data)),
        dispose() { clearAll(); active = false; },
    };
}
