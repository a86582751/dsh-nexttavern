// Generated from runtime/alpha3/src/core/roleplay-author-chat-native-roots.ts; edit the TypeScript source.
const sameRef = (left, right) => left === right || left !== null && right !== null && left.key === right.key && left.sha256 === right.sha256;
export function createRoleplayAuthorChatNativeRoots(deps) {
    const entries = new WeakMap();
    function read(session) {
        const cut = deps.cut(session);
        if (cut.source !== 'native')
            throw Error('AUTHOR_CHAT_NATIVE_HISTORY_UNAVAILABLE');
        let entry = entries.get(session);
        if (!entry) {
            entry = { session, namespaces: new Map(), proofs: new Map(), through: 0, latestPublicationSeq: null };
            entries.set(session, entry);
        }
        for (const event of cut.range(entry.through)) {
            entry.through = event.seq + 1;
            if (event.type !== deps.eventType)
                continue;
            // The Native catalog admits this exact typed marker before storage or
            // replay. This consumer indexes its accepted immutable DATA directly.
            const root = event, key = root.data.namespaceSha256, versions = entry.namespaces.get(key) ?? [];
            entry.latestPublicationSeq = event.seq;
            versions.push(root);
            entry.namespaces.set(key, versions);
            entry.markerHeads = undefined;
            const proof = entry.proofs.get(key);
            if (proof) {
                entry.proofs.delete(key);
                for (const invalidate of proof.listeners)
                    invalidate();
                proof.listeners.clear();
            }
        }
        return entry;
    }
    function actualSession(id) {
        const session = deps.session(id);
        if (!session)
            throw Error('AUTHOR_CHAT_NATIVE_SESSION_UNAVAILABLE');
        return session;
    }
    function root(namespace, event) {
        return event ? { namespace, head: event.data.publication, base: event.data.base } : undefined;
    }
    function atCut(versions, length) {
        let low = 0, high = versions.length;
        while (low < high) {
            const middle = Math.floor((low + high) / 2);
            if (versions[middle].seq < length)
                low = middle + 1;
            else
                high = middle;
        }
        return versions[low - 1];
    }
    const roots = {
        currentRoot(namespace, key) {
            const session = actualSession(namespace.sessionId), entry = read(session), event = entry.namespaces.get(key)?.at(-1);
            let proof = entry.proofs.get(key);
            if (!proof) {
                proof = { event, listeners: new Set() };
                entry.proofs.set(key, proof);
            }
            const captured = proof;
            deps.useProof({ current: () => deps.session(namespace.sessionId) === session
                    && read(session).namespaces.get(key)?.at(-1) === captured.event,
                onInvalidated(notify) { captured.listeners.add(notify); return () => captured.listeners.delete(notify); } });
            return root(namespace, event);
        },
        cutRoot(namespace, key, cut) {
            if (deps.session(cut.session.id) !== cut.session)
                throw Error('AUTHOR_CHAT_NATIVE_CUT_UNAVAILABLE');
            const entry = read(cut.session), versions = entry.namespaces.get(key) ?? [];
            return root(namespace, atCut(versions, cut.length));
        },
        markerHeadsAtCut(cut) {
            if (deps.session(cut.session.id) !== cut.session)
                throw Error('AUTHOR_CHAT_NATIVE_CUT_UNAVAILABLE');
            const markers = [];
            for (const versions of read(cut.session).namespaces.values()) {
                const event = atCut(versions, cut.length);
                if (event)
                    markers.push(event.data);
            }
            return Object.freeze(markers);
        },
        publish(next, key, expectedHead) {
            const session = actualSession(next.namespace.sessionId), entry = read(session), previous = entry.namespaces.get(key)?.at(-1)?.data.publication ?? null;
            if (!sameRef(previous, expectedHead))
                throw Error('AUTHOR_CHAT_ROOT_CHANGED');
            if (!next.head)
                throw Error('AUTHOR_CHAT_PUBLICATION_MISSING');
            deps.append(session, { schemaVersion: 1, encoding: 'native-author-chat-root-marker-v1',
                sessionId: session.id, namespaceSha256: key, publication: next.head, base: next.base });
            read(session);
        },
        async flush(namespace) {
            const session = actualSession(namespace.sessionId);
            if (!await deps.flush(session))
                throw Error('AUTHOR_CHAT_NATIVE_DURABILITY_UNAVAILABLE');
        },
    };
    return { roots, latestPublicationSeq: (session) => read(session).latestPublicationSeq,
        markerHeads(session) {
            const entry = read(session);
            return entry.markerHeads ??= Object.freeze([...entry.namespaces.values()].map(events => events.at(-1).data));
        }, accept(session, event) {
            if (event.type === deps.eventType)
                read(session);
        } };
}
