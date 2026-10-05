// Generated from runtime/alpha3/src/ui/author-browser-pending.ts; edit the TypeScript source.
const key = (sessionId) => 'nexttavern.author-browser.pending.v1:' + sessionId;
export const terminalBrowserReceipt = (result) => result.operation?.outcome === 'updated' || result.operation?.outcome === 'no-update'
    || result.operation?.outcome === 'refused';
export function createAuthorBrowserPendingStore(storage) {
    function read(sessionId) {
        const bytes = storage.getItem(key(sessionId));
        if (!bytes)
            return;
        const envelope = JSON.parse(bytes);
        if (envelope.schemaVersion !== 1 || envelope.encoding !== 'nexttavern-author-browser-pending-v1'
            || envelope.operation.sessionId !== sessionId)
            throw Error('BROWSER_PENDING_FORMAT_UNSUPPORTED');
        return envelope;
    }
    function begin(binding, request) {
        const previous = read(binding.sessionId);
        if (previous && previous.state !== 'terminal') {
            throw Error('BROWSER_SAVE_CONFIRMATION_REQUIRED');
        }
        const envelope = {
            schemaVersion: 1, encoding: 'nexttavern-author-browser-pending-v1', binding,
            child: { requestId: request.requestId, generation: request.generation,
                readRevision: request.readRevision, scriptIdentity: request.scriptIdentity },
            operation: { schemaVersion: 1, sessionId: binding.sessionId, operationId: crypto.randomUUID(),
                action: 'replace-values', expected: request.expected, values: request.values },
            state: 'pending',
        };
        // Freeze the submitted DATA through the storage serialization, before
        // sending anything. A storage failure must prevent the write.
        storage.setItem(key(binding.sessionId), JSON.stringify(envelope));
        return read(binding.sessionId);
    }
    function record(envelope, result) {
        const next = { ...envelope,
            state: result && terminalBrowserReceipt(result) ? 'terminal' : 'unknown',
            ...(result ? { receipt: { ok: result.ok, operation: result.operation, code: result.code, error: result.error } } : {}),
        };
        // An old ACK may finish its old record, but cannot replace a newer
        // operation admitted by another view after terminal confirmation.
        if (read(envelope.operation.sessionId)?.operation.operationId === envelope.operation.operationId) {
            storage.setItem(key(envelope.operation.sessionId), JSON.stringify(next));
        }
        return next;
    }
    return { read, begin, record };
}
export function pendingBrowserRequest(envelope) {
    return { ...envelope.child, expected: envelope.operation.expected, values: envelope.operation.values };
}
