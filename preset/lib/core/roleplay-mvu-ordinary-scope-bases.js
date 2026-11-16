// Generated from runtime/alpha3/src/core/roleplay-mvu-ordinary-scope-bases.ts; edit the TypeScript source.
/** Index only actual catalog-accepted events. Immutable cuts retain the same
 * event identity, so a cold fold scans once and subsequent reads consume tails. */
export function createMessageEditOrdinaryReader(deps) {
    const indexes = new WeakMap();
    function read(session) {
        const cut = deps.cut(session);
        let index = indexes.get(session);
        if (!index || index.owner !== cut.owner || index.through > cut.length) {
            index = { owner: cut.owner, through: 0, edits: [], versions: new Map(), references: new Map(), listeners: new Set() };
            indexes.set(session, index);
        }
        for (const event of cut.range(index.through)) {
            index.through = event.seq + 1;
            if (event.type !== 'roleplay/message-edit')
                continue;
            const data = event.data;
            const versions = index.versions.get(data.targetSeq) ?? [];
            versions.push({ seq: event.seq, basis: data.schemaVersion === 3 && data.bodyChanged === false
                    ? versions.at(-1)?.basis ?? data.operation?.expectedMessageVersionSha256 : undefined });
            index.versions.set(data.targetSeq, versions);
            const replacement = data.schemaVersion === 3 ? data.patch?.ordinary : undefined;
            if (!replacement)
                continue;
            const ref = { key: `native-message-edit:${replacement.namespace.sessionId}:${event.seq}`, sha256: deps.hash(event) }, edit = Object.freeze({ seq: event.seq, ref, replacement });
            index.edits.push(edit);
            index.references.set(ref.key, { edit, event });
            for (const listener of index.listeners)
                listener();
            index.listeners.clear();
        }
        return { index, cut };
    }
    function at(session, through, from = 0) {
        const { index, cut } = read(session);
        if (through > cut.length)
            throw Error('AUTHOR_CHAT_NATIVE_CUT_UNAVAILABLE');
        const boundary = (seq) => {
            let low = 0, high = index.edits.length;
            while (low < high) {
                const mid = (low + high) >>> 1;
                if (index.edits[mid].seq < seq)
                    low = mid + 1;
                else
                    high = mid;
            }
            return low;
        };
        return index.edits.slice(boundary(from), boundary(through));
    }
    function resolve(namespace, ref) {
        const session = deps.session(namespace.sessionId);
        if (!session)
            return;
        const { index } = read(session), found = index.references.get(ref.key);
        if (!found || found.edit.ref.sha256 !== ref.sha256)
            return;
        // Resolving an immutable ref never subscribes a fork to the parent's tail.
        deps.useProof({ current: () => deps.session(namespace.sessionId) === session
                && deps.cut(session).at(found.edit.seq) === found.event, onInvalidated: () => () => { } });
        return found.edit;
    }
    function useCurrent(namespace) {
        const session = deps.session(namespace.sessionId);
        if (!session)
            throw Error('AUTHOR_CHAT_NATIVE_SESSION_UNAVAILABLE');
        const { index } = read(session), count = index.edits.length;
        deps.useProof({ current: () => deps.session(namespace.sessionId) === session && read(session).index === index
                && index.edits.length === count, onInvalidated(notify) { index.listeners.add(notify); return () => index.listeners.delete(notify); } });
    }
    function bodyVersion(session, targetSeq, cut) {
        const versions = read(session).index.versions.get(targetSeq);
        if (!versions)
            return;
        let low = 0, high = versions.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (versions[mid].seq < cut)
                low = mid + 1;
            else
                high = mid;
        }
        return low ? versions[low - 1].basis : undefined;
    }
    return { at, resolve, useCurrent, bodyVersion };
}
/** The caller supplies the actual accepted Native edit reference. The DATA
 * remains in that event, and shares the numerical reset/fence semantics. */
export function applyMessageEditOrdinaryScopePublication(previous, editRef, replacement) {
    return applyNumericalOrdinaryScopePublication(previous, editRef, { ...replacement, kind: 'replace' }, replacement.variables);
}
export function applyNumericalOrdinaryScopePublication(previous, eventRef, scope, finalVariables, keyIndex) {
    if (scope.kind === 'replace') {
        return { ref: eventRef, reset: { ref: eventRef, fenceRoot: scope.fenceRoot, variables: finalVariables }, keys: new Map() };
    }
    if (!scope.keys?.length)
        return previous;
    // The numerical owner supplies its current index and immutable versioned
    // view. Standalone reductions copy only their current key-base map.
    const fallback = keyIndex ? undefined : new Map(previous.keys);
    const index = keyIndex ?? {
        set: (key, value) => { fallback.set(key, value); }, view: () => fallback,
    };
    for (const key of scope.keys) {
        const exists = Object.hasOwn(finalVariables, key);
        index.set(key, { ref: eventRef, fenceRoot: scope.fenceRoot, exists, value: exists ? finalVariables[key] : null });
    }
    return { ref: eventRef, reset: previous.reset, keys: index.view() };
}
