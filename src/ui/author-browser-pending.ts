import type {BrowserBindingV1,BrowserSaveRequestV1} from '../core/tavern-author-browser-types.mjs';
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from '../core/roleplay-mvu-player-types.js';

export interface AuthorBrowserPendingV1 {
    schemaVersion: 1;
    encoding: 'nexttavern-author-browser-pending-v1';
    binding: BrowserBindingV1;
    child: Pick<BrowserSaveRequestV1, 'requestId' | 'generation' | 'readRevision' | 'scriptIdentity'>;
    // Values and expected occur exactly once. Retry reconstructs the child DATA
    // from this fixed operation; author code is never called for a retry.
    operation: MvuPlayerEditRequest;
    state: 'pending' | 'unknown' | 'terminal';
    receipt?: Pick<MvuPlayerEditResponse, 'ok' | 'operation' | 'code' | 'error'>;
}
const key = (sessionId: string) => 'nexttavern.author-browser.pending.v1:' + sessionId;
export const terminalBrowserReceipt = (result: MvuPlayerEditResponse) =>
    result.operation?.outcome === 'updated' || result.operation?.outcome === 'no-update'
    || result.operation?.outcome === 'refused';

export function createAuthorBrowserPendingStore(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    function read(sessionId: string): AuthorBrowserPendingV1 | undefined {
        const bytes = storage.getItem(key(sessionId));
        if (!bytes) return;
        const envelope = JSON.parse(bytes) as AuthorBrowserPendingV1;
        if (envelope.schemaVersion !== 1 || envelope.encoding !== 'nexttavern-author-browser-pending-v1'
            || envelope.operation.sessionId !== sessionId) throw Error('BROWSER_PENDING_FORMAT_UNSUPPORTED');
        return envelope;
    }
    function begin(binding: BrowserBindingV1, request: BrowserSaveRequestV1): AuthorBrowserPendingV1 {
        const previous = read(binding.sessionId);
        if (previous && previous.state !== 'terminal') {
            throw Error('BROWSER_SAVE_CONFIRMATION_REQUIRED');
        }
        const envelope: AuthorBrowserPendingV1 = {
            schemaVersion: 1, encoding: 'nexttavern-author-browser-pending-v1', binding,
            child: {requestId: request.requestId, generation: request.generation,
                readRevision: request.readRevision, scriptIdentity: request.scriptIdentity},
            operation: {schemaVersion: 1, sessionId: binding.sessionId, operationId: crypto.randomUUID(),
                action: 'replace-values', expected: request.expected, values: request.values},
            state: 'pending',
        };
        // Freeze the submitted DATA through the storage serialization, before
        // sending anything. A storage failure must prevent the write.
        storage.setItem(key(binding.sessionId), JSON.stringify(envelope));
        return read(binding.sessionId)!;
    }
    function record(envelope: AuthorBrowserPendingV1, result?: MvuPlayerEditResponse) {
        const next: AuthorBrowserPendingV1 = {...envelope,
            state: result && terminalBrowserReceipt(result) ? 'terminal' : 'unknown',
            ...(result ? {receipt: {ok: result.ok, operation: result.operation, code: result.code, error: result.error}} : {}),
        };
        // An old ACK may finish its old record, but cannot replace a newer
        // operation admitted by another view after terminal confirmation.
        if (read(envelope.operation.sessionId)?.operation.operationId === envelope.operation.operationId) {
            storage.setItem(key(envelope.operation.sessionId), JSON.stringify(next));
        }
        return next;
    }
    return {read, begin, record};
}

export function pendingBrowserRequest(envelope: AuthorBrowserPendingV1): BrowserSaveRequestV1 {
    return {...envelope.child, expected: envelope.operation.expected, values: envelope.operation.values};
}
