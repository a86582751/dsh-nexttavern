// Generated from runtime/alpha3/src/ui/author-browser-ordinary-pending.ts; edit the TypeScript source.
const storageKey = (sid) => 'nexttavern.author-native.namespace-pending.v1:' + sid;
export function sameOrdinarySource(a, b) {
    const left = a.namespace.importIncarnation, right = b.namespace.importIncarnation;
    if (a.namespace.sessionId !== b.namespace.sessionId)
        return false;
    if (left === null || right === null)
        return left === right;
    return left.sourceRecordSessionId === right.sourceRecordSessionId && left.importId === right.importId
        && left.transactionId === right.transactionId && left.activationSha256 === right.activationSha256;
}
export function sameOrdinaryAddress(a, b) {
    if (!sameOrdinarySource(a, b))
        return false;
    const left = a.namespace.target, right = b.namespace.target;
    if (!left || !right)
        return left === right;
    if (left.kind === 'script')
        return right.kind === 'script' && left.identity.scriptIdentity === right.identity.scriptIdentity;
    if (right.kind !== 'message')
        return false;
    const aMessage = left.identity, bMessage = right.identity;
    return aMessage.ownerSessionId === bMessage.ownerSessionId && aMessage.nativeSeq === bMessage.nativeSeq
        && aMessage.messageId === bMessage.messageId && aMessage.variant.kind === bMessage.variant.kind
        && (aMessage.variant.kind !== 'opening-variant' || bMessage.variant.kind === 'opening-variant' && aMessage.variant.id === bMessage.variant.id);
}
/** The outbox owns dispatch DATA only. State2 owns receipts and every write. */
export function createAuthorBrowserOrdinaryPendingStore(storage) {
    // These facts live only in this consumer. A failed local write cannot
    // undo a canonical ACK or the user's decision to display current DATA.
    const acknowledged = new Set(), released = new Set();
    const identity = (operation) => {
        const namespace = operation.namespace, imported = namespace.importIncarnation;
        return JSON.stringify([namespace.sessionId, imported ? [imported.sourceRecordSessionId, imported.importId,
                imported.transactionId, imported.activationSha256] : null, namespace.target ?? null, operation.operationId]);
    };
    function stored(sid) {
        const bytes = storage.getItem(storageKey(sid));
        if (!bytes)
            return [];
        const record = JSON.parse(bytes);
        if (!(record.schemaVersion === 2 && record.encoding === 'nexttavern-author-browser-ordinary-operations-v2')
            || record.sessionId !== sid)
            throw Error('AUTHOR_CHAT_PENDING_FORMAT_UNSUPPORTED');
        return record.operations;
    }
    function read(sid) {
        const result = [];
        for (const row of stored(sid)) {
            const key = identity(row.operation);
            if (!acknowledged.has(key))
                result.push(released.has(key) ? { ...row, manualReleased: true } : row);
        }
        return result;
    }
    function readHelper(sid) {
        return read(sid).filter((row) => row.principal !== 'reader-regex-document');
    }
    function readReader(sid) {
        return read(sid).filter((row) => row.principal === 'reader-regex-document');
    }
    function write(sid, operations) {
        storage.setItem(storageKey(sid), JSON.stringify({ schemaVersion: 2,
            encoding: 'nexttavern-author-browser-ordinary-operations-v2', sessionId: sid, operations }));
    }
    function change(envelope, update) {
        const operation = envelope.operation, rows = stored(operation.namespace.sessionId);
        const key = identity(operation), index = rows.findIndex(row => identity(row.operation) === key);
        if (index < 0)
            return;
        const next = update(rows[index]);
        if (next)
            rows[index] = next;
        else
            rows.splice(index, 1);
        write(operation.namespace.sessionId, rows);
    }
    function persist(envelope) {
        const { operation } = envelope, sid = operation.namespace.sessionId, rows = read(sid);
        if (rows.some(row => !row.manualReleased && sameOrdinaryAddress(row.operation, operation)))
            throw Error('AUTHOR_CHAT_CONFIRMATION_REQUIRED');
        rows.push(envelope);
        // Storage must succeed before dispatch. Reading the serialized row
        // also detaches expected/value from the author's mutable request.
        write(sid, rows);
        return read(sid).at(-1);
    }
    function begin(browserBinding, operation) {
        return persist({ schemaVersion: 2, encoding: 'nexttavern-author-browser-ordinary-pending-v2', browserBinding, operation, state: 'pending' });
    }
    function beginReader(browserBinding, operation) {
        return persist({ schemaVersion: 2, encoding: 'nexttavern-author-browser-ordinary-pending-v2',
            principal: 'reader-regex-document', browserBinding, operation, state: 'pending' });
    }
    return {
        read, readHelper, readReader, begin, beginReader,
        unknown(envelope, code) {
            change(envelope, row => ({ ...row, state: 'unknown', code }));
        },
        acknowledge(envelope) {
            // State2 retains the append-only receipt. Only this exact local
            // dispatch is retired; a late ACK cannot remove a newer operation.
            const key = identity(envelope.operation);
            try {
                change(envelope, () => undefined);
                acknowledged.delete(key);
            }
            catch (error) {
                acknowledged.add(key);
                throw error;
            }
        },
        release(envelope) {
            const key = identity(envelope.operation);
            try {
                change(envelope, row => ({ ...row, manualReleased: true }));
                released.delete(key);
            }
            catch (error) {
                released.add(key);
                throw error;
            }
        },
    };
}
