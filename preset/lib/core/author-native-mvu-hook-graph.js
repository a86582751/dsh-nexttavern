// Generated from runtime/alpha3/src/core/author-native-mvu-hook-graph.ts; edit the TypeScript source.
/** Self-contained for Browser/QuickJS serialization. apply keeps generator-held
 * containers alive, including initial nodes detached from the returned roots. */
export function createAuthorNativeMvuHookGraph() {
    const identities = new WeakMap(), objects = new Map();
    let nextId = 0, unwrap = (value) => value;
    function encode(value) {
        value = unwrap(value);
        if (value === undefined)
            return { kind: 'undefined' };
        if (typeof value === 'number' && !Number.isFinite(value))
            throw Error('AUTHOR_NATIVE_MVU_GRAPH_VALUE_UNSUPPORTED');
        if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
            return { kind: 'primitive', value };
        if (typeof value !== 'object')
            throw Error('AUTHOR_NATIVE_MVU_GRAPH_VALUE_UNSUPPORTED');
        if (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]')
            throw Error('AUTHOR_NATIVE_MVU_GRAPH_OBJECT_UNSUPPORTED');
        let id = identities.get(value);
        if (id === undefined) {
            id = nextId++;
            identities.set(value, id);
            objects.set(id, value);
        }
        return { kind: 'ref', id };
    }
    function capture(roots, unwrapValue = (value) => value) {
        unwrap = unwrapValue;
        const encoded = roots.map(encode), nodes = [];
        // Map iteration includes newly discovered children and retained detached nodes.
        for (const [id, value] of objects) {
            const array = Array.isArray(value), entries = Object.keys(value).map(key => [key, encode(value[key])]);
            nodes.push({ id, kind: array ? 'array' : 'object', ...array ? { length: value.length } : {}, entries });
        }
        return { schemaVersion: 1, roots: encoded, nodes };
    }
    function apply(wire) {
        for (const node of wire.nodes) {
            if (objects.has(node.id))
                continue;
            const value = node.kind === 'array' ? [] : {};
            objects.set(node.id, value);
            identities.set(value, node.id);
            nextId = Math.max(nextId, node.id + 1);
        }
        const decode = (value) => value.kind === 'ref' ? objects.get(value.id)
            : value.kind === 'primitive' ? value.value : undefined;
        for (const node of wire.nodes) {
            const value = objects.get(node.id), keys = new Set(node.entries.map(([key]) => key));
            for (const key of Object.keys(value))
                if (!keys.has(key))
                    delete value[key];
            if (node.kind === 'array')
                value.length = node.length;
            for (const [key, item] of node.entries)
                Object.defineProperty(value, key, { value: decode(item), enumerable: true, configurable: true, writable: true });
        }
        return wire.roots.map(decode);
    }
    return { capture, apply, materialize: apply };
}
/** Grammar boundary for untrusted wire DATA. Trusted materialize/apply callers
 * reuse this result and keep the original mutable objects. */
export function validateAuthorNativeMvuHookGraphV1(wire) {
    const fail = () => { throw Error('AUTHOR_NATIVE_MVU_HOOK_GRAPH_INVALID'); };
    const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    const identity = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    if (!object(wire) || wire.schemaVersion !== 1 || !Array.isArray(wire.roots) || !Array.isArray(wire.nodes))
        fail();
    const graph = wire, ids = new Set();
    for (const node of graph.nodes) {
        if (!object(node) || !identity(node.id) || ids.has(node.id)
            || node.kind !== 'object' && node.kind !== 'array' || !Array.isArray(node.entries))
            fail();
        ids.add(node.id);
        if (node.kind === 'array' && (!identity(node.length) || node.length > 0xffffffff))
            fail();
    }
    const value = (item) => {
        if (!object(item))
            fail();
        const slot = item;
        if (slot.kind === 'undefined')
            return;
        if (slot.kind === 'ref') {
            if (!identity(slot.id) || !ids.has(slot.id))
                fail();
            return;
        }
        if (slot.kind === 'primitive' && (slot.value === null || typeof slot.value === 'string'
            || typeof slot.value === 'boolean' || typeof slot.value === 'number' && Number.isFinite(slot.value)))
            return;
        fail();
    };
    for (const root of graph.roots)
        value(root);
    for (const node of graph.nodes) {
        const keys = new Set();
        for (const entry of node.entries) {
            if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || keys.has(entry[0])
                || node.kind === 'array' && entry[0] === 'length')
                fail();
            keys.add(entry[0]);
            value(entry[1]);
        }
    }
}
