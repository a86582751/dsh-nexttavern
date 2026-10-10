// Generated from runtime/alpha3/src/ui/author-browser-pending.ts; edit the TypeScript source.
// Keep the physical key so an upgrade reads the user's existing records.
const worldbookKey = (sessionId) => 'nexttavern.author-browser.worldbook-pending.v1:' + sessionId;
export const terminalWorldbookReceipt = (result) => result.kind === 'edited-data'
    || result.diagnostics.some(value => value.code === 'OPERATION_NOT_RECORDED');
function worldbookResultScope(result) {
    if (result?.kind === 'edited-data')
        return { kind: 'known-namespace', identitySha256: result.receipt.identitySha256 };
    if (result?.kind !== 'refused')
        return;
    const recovery = result.diagnostics.find(value => value.recovery)?.recovery;
    if (recovery)
        return { kind: 'known-namespace', identitySha256: recovery.identitySha256 };
    const pending = result.diagnostics.find(value => value.pending)?.pending;
    if (pending)
        return { kind: 'legacy-event-ref', eventRef: pending.eventRef };
}
export function worldbookPendingRetryLocator(envelope) {
    const scope = envelope.scope;
    return scope.kind === 'known-namespace' ? { identitySha256: scope.identitySha256 }
        : scope.kind === 'legacy-event-ref' ? { eventRef: scope.eventRef } : undefined;
}
export function worldbookPendingBlocksNamespace(envelope, identitySha256) {
    if (envelope.state === 'terminal')
        return false;
    const scope = envelope.scope;
    return scope.kind === 'known-namespace' ? scope.identitySha256 === identitySha256
        : scope.kind === 'legacy-unlocated' ? !scope.manualReleased : true;
}
const personaKey = (sessionId) => 'nexttavern.author-browser.persona-pending.v1:' + sessionId;
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
    function readWorldbooks(sessionId) {
        const bytes = storage.getItem(worldbookKey(sessionId));
        if (!bytes)
            return [];
        const collection = JSON.parse(bytes);
        if (collection.sessionId !== sessionId)
            throw Error('BROWSER_WORLDBOOK_PENDING_FORMAT_UNSUPPORTED');
        if (collection.schemaVersion === 2 && collection.encoding === 'nexttavern-author-browser-worldbook-operations-v2') {
            return collection.operations;
        }
        if (collection.schemaVersion !== 1 || collection.encoding !== 'nexttavern-author-browser-worldbook-operations-v1') {
            throw Error('BROWSER_WORLDBOOK_PENDING_FORMAT_UNSUPPORTED');
        }
        const operations = collection.operations.map(previous => ({
            ...previous, schemaVersion: 2, encoding: 'nexttavern-author-browser-worldbook-pending-v2',
            scope: worldbookResultScope(previous.result) ?? { kind: 'legacy-unlocated', manualReleased: false },
            // V1 called any unanchored refusal terminal, including a lookup in
            // a newer namespace. Preserve that evidence without claiming absence.
            state: previous.result && terminalWorldbookReceipt(previous.result) ? 'terminal'
                : previous.state === 'pending' ? 'pending' : 'unknown',
        }));
        writeWorldbooks(sessionId, operations);
        return operations;
    }
    function writeWorldbooks(sessionId, operations) {
        const collection = { schemaVersion: 2,
            encoding: 'nexttavern-author-browser-worldbook-operations-v2', sessionId, operations };
        storage.setItem(worldbookKey(sessionId), JSON.stringify(collection));
    }
    function beginWorldbook(binding, request, identitySha256) {
        const operations = readWorldbooks(binding.sessionId);
        const previous = operations.find(value => value.operationId === request.operationId);
        if (previous)
            return previous;
        const envelope = { schemaVersion: 2,
            encoding: 'nexttavern-author-browser-worldbook-pending-v2', binding,
            sessionId: binding.sessionId, operationId: request.operationId, name: request.name, state: 'pending',
            scope: { kind: 'known-namespace', identitySha256 } };
        // Save the actual captured namespace before dispatch. An address is
        // DATA for the journal owner; it grants no Source or realm permission.
        writeWorldbooks(binding.sessionId, [...operations, envelope]);
        return envelope;
    }
    function recordWorldbook(envelope, result, code) {
        const operations = readWorldbooks(envelope.sessionId);
        const index = operations.findIndex(value => value.operationId === envelope.operationId);
        const previous = operations[index] ?? envelope;
        if (previous.state === 'terminal' && (!result
            || previous.result?.kind === 'edited-data' && result.kind !== 'edited-data'))
            return previous;
        const observedScope = worldbookResultScope(result);
        const hasAnchor = worldbookResultScope(previous.result) !== undefined;
        const keptResult = hasAnchor && result?.kind === 'refused' && !observedScope
            && !terminalWorldbookReceipt(result) ? previous.result : result ?? previous.result;
        const scope = observedScope?.kind === 'known-namespace' ? observedScope
            : previous.scope.kind === 'known-namespace' ? previous.scope : observedScope ?? previous.scope;
        const next = { ...previous, scope,
            state: result && terminalWorldbookReceipt(result) ? 'terminal' : 'unknown',
            result: keptResult, code };
        if (index === -1)
            operations.push(next);
        else
            operations[index] = next;
        writeWorldbooks(envelope.sessionId, operations);
        return next;
    }
    function releaseLegacyWorldbook(operationId, sessionId) {
        const operations = readWorldbooks(sessionId);
        const index = operations.findIndex(value => value.operationId === operationId);
        const envelope = operations[index];
        if (!envelope || envelope.state === 'terminal' || envelope.scope.kind !== 'legacy-unlocated')
            return;
        operations[index] = { ...envelope, scope: { ...envelope.scope, manualReleased: true } };
        writeWorldbooks(sessionId, operations);
    }
    function readPersonas(sessionId) {
        const bytes = storage.getItem(personaKey(sessionId));
        if (!bytes)
            return [];
        const collection = JSON.parse(bytes);
        if (collection.schemaVersion !== 1 || collection.encoding !== 'nexttavern-author-browser-persona-operations-v1'
            || collection.sessionId !== sessionId)
            throw Error('BROWSER_PERSONA_PENDING_FORMAT_UNSUPPORTED');
        return collection.operations;
    }
    function writePersonas(sessionId, operations) {
        const collection = { schemaVersion: 1,
            encoding: 'nexttavern-author-browser-persona-operations-v1', sessionId, operations };
        storage.setItem(personaKey(sessionId), JSON.stringify(collection));
    }
    function beginPersona(binding, request) {
        const operations = readPersonas(binding.sessionId);
        const previous = operations.find(value => value.operationId === request.operationId);
        if (previous)
            return previous;
        const envelope = { schemaVersion: 1,
            encoding: 'nexttavern-author-browser-persona-pending-v1', binding, sessionId: binding.sessionId,
            operationId: request.operationId, scriptIdentity: request.scriptIdentity, state: 'pending' };
        // The Native account owns the intent and receipt. Browser recovery only
        // needs identity; neither persona DATA nor an old VM callback is durable.
        writePersonas(binding.sessionId, [...operations, envelope]);
        return envelope;
    }
    function recordPersona(envelope, result, code) {
        const operations = readPersonas(envelope.sessionId);
        const index = operations.findIndex(value => value.operationId === envelope.operationId);
        const previous = operations[index];
        // A delayed ACK cannot erase a committed receipt. A real committed ACK
        // may still replace an earlier lookup that reached Core before its write.
        if (previous?.state === 'terminal' && (!result
            || previous.result?.kind === 'committed' && result.kind !== 'committed'))
            return previous;
        const stored = result?.kind === 'committed'
            ? { schemaVersion: result.schemaVersion, kind: result.kind, receipt: result.receipt } : result;
        const next = { ...envelope, state: result ? 'terminal' : 'unknown',
            result: stored, code: result?.kind === 'refused' ? result.code : code };
        if (index === -1)
            operations.push(next);
        else
            operations[index] = next;
        writePersonas(envelope.sessionId, operations);
        return next;
    }
    return { read, begin, record, readWorldbooks, beginWorldbook, recordWorldbook, releaseLegacyWorldbook,
        readPersonas, beginPersona, recordPersona };
}
export function pendingBrowserRequest(envelope) {
    return { ...envelope.child, expected: envelope.operation.expected, values: envelope.operation.values };
}
