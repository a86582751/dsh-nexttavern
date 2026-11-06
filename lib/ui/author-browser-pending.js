// Generated from runtime/alpha3/src/ui/author-browser-pending.ts; edit the TypeScript source.
// Native helper outboxes are separate from unpublished VM test records.
const worldbookKey = (sessionId) => 'nexttavern.author-native.worldbook-pending.v1:' + sessionId;
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
}
export function worldbookPendingRetryLocator(envelope) {
    const scope = envelope.scope;
    return { identitySha256: scope.identitySha256 };
}
export function worldbookPendingBlocksNamespace(envelope, identitySha256) {
    if (envelope.state === 'terminal')
        return false;
    const scope = envelope.scope;
    return scope.identitySha256 === identitySha256;
}
const personaKey = (sessionId) => 'nexttavern.author-native.persona-pending.v1:' + sessionId;
const key = (sessionId) => 'nexttavern.author-native.numerical-pending.v1:' + sessionId;
export const terminalBrowserReceipt = (result) => result.operation?.outcome === 'updated' || result.operation?.outcome === 'no-update'
    || result.operation?.outcome === 'refused';
const readerKey = (sessionId) => 'nexttavern.reader.opening-variant-pending.v1:' + sessionId;
const openingKey = (sid) => 'nexttavern.author-native.opening-pending.v1:' + sid;
export function createAuthorBrowserPendingStore(storage) {
    function readMessageOperations(sid) {
        const bytes = storage.getItem(openingKey(sid));
        if (!bytes)
            return { schemaVersion: 1, encoding: 'author-native-message-operations-v1', messageBodies: [] };
        const value = JSON.parse(bytes);
        // Preserve the actual opening outbox already stored by this development
        // runtime when its shared message collection is first written.
        return value.encoding === 'author-native-opening-pending-v1'
            ? { schemaVersion: 1, encoding: 'author-native-message-operations-v1', opening: value, messageBodies: [] } : value;
    }
    function writeMessageOperations(sid, value) {
        storage.setItem(openingKey(sid), JSON.stringify(value));
    }
    function readOpening(sid) {
        return readMessageOperations(sid).opening;
    }
    function beginOpening(binding, realmId, request) {
        const previous = readOpening(binding.sessionId);
        if (previous && previous.state !== 'terminal')
            throw Error('READER_OPENING_VARIANTS_CONFIRMATION_REQUIRED');
        const envelope = { schemaVersion: 1, encoding: 'author-native-opening-pending-v1',
            binding, realmId, request, state: 'pending' };
        writeMessageOperations(binding.sessionId, { ...readMessageOperations(binding.sessionId), opening: envelope });
        return readOpening(binding.sessionId);
    }
    function recordOpening(envelope, result) {
        const previous = readOpening(envelope.binding.sessionId);
        if (previous?.request.operationId !== envelope.request.operationId)
            return previous ?? envelope;
        if (previous.result?.kind === 'committed')
            return previous;
        const next = { ...envelope, result, state: result && result.kind !== 'unknown' ? 'terminal' : 'unknown' };
        writeMessageOperations(envelope.binding.sessionId, { ...readMessageOperations(envelope.binding.sessionId), opening: next });
        return next;
    }
    function releaseOpening(envelope) {
        const previous = readOpening(envelope.binding.sessionId);
        if (previous?.request.operationId === envelope.request.operationId)
            writeMessageOperations(envelope.binding.sessionId, { ...readMessageOperations(envelope.binding.sessionId),
                opening: { ...previous, manualReleased: true } });
    }
    function readBodies(sid) {
        return readMessageOperations(sid).messageBodies.filter((row) => row.encoding === 'author-native-message-body-pending-v1');
    }
    function readReaderBodies(sid) {
        return readMessageOperations(sid).messageBodies.filter((row) => row.encoding === 'reader-message-body-pending-v1');
    }
    function persistBody(envelope) {
        const { binding, request } = envelope, collection = readMessageOperations(binding.sessionId);
        if (collection.messageBodies.some(row => row.state !== 'terminal'
            && row.request.expected.seq === request.expected.seq && row.request.expected.messageId === request.expected.messageId))
            throw Error('AUTHOR_NATIVE_MESSAGE_BODY_CONFIRMATION_REQUIRED');
        writeMessageOperations(binding.sessionId, { ...collection,
            messageBodies: [...collection.messageBodies.filter(row => row.state !== 'terminal'), envelope] });
        return readMessageOperations(binding.sessionId).messageBodies.find(row => row.request.operationId === request.operationId);
    }
    function beginBody(binding, sourceProgramSha256, realmId, request) {
        return persistBody({ schemaVersion: 1, encoding: 'author-native-message-body-pending-v1',
            binding, sourceProgramSha256, realmId, request, state: 'pending' });
    }
    function beginReaderBody(binding, documentPlanSha256, origin, request) {
        return persistBody({ schemaVersion: 1, encoding: 'reader-message-body-pending-v1',
            binding, documentPlanSha256, origin, request, state: 'pending' });
    }
    function recordBody(envelope, result, code) {
        const sid = envelope.binding.sessionId, collection = readMessageOperations(sid), previous = collection.messageBodies.find(row => row.request.operationId === envelope.request.operationId);
        if (!previous)
            return envelope;
        if (previous.state === 'terminal' && (!result || previous.result?.kind === 'committed' || result.kind !== 'committed'))
            return previous;
        const next = { ...previous, result, code: result && 'code' in result ? result.code : code,
            state: result && result.kind !== 'unknown' ? 'terminal' : 'unknown' };
        writeMessageOperations(sid, { ...collection, messageBodies: collection.messageBodies.map(row => row === previous ? next : row) });
        return next;
    }
    function readReader(sessionId) {
        const bytes = storage.getItem(readerKey(sessionId));
        if (!bytes)
            return;
        const envelope = JSON.parse(bytes);
        if (envelope.schemaVersion !== 1 || envelope.encoding !== 'nexttavern-reader-opening-variant-pending-v1'
            || envelope.binding.sessionId !== sessionId)
            throw Error('READER_PENDING_FORMAT_UNSUPPORTED');
        return envelope;
    }
    function beginReader(binding, documentPlanSha256, request) {
        const previous = readReader(binding.sessionId);
        if (previous && previous.state !== 'terminal')
            throw Error('READER_OPENING_VARIANTS_CONFIRMATION_REQUIRED');
        const envelope = { schemaVersion: 1,
            encoding: 'nexttavern-reader-opening-variant-pending-v1', binding, documentPlanSha256, request, state: 'pending' };
        // Dispatch consumes the serialized original DATA. Storage failure must
        // precede admission, including for the next write in the same callback.
        storage.setItem(readerKey(binding.sessionId), JSON.stringify(envelope));
        return readReader(binding.sessionId);
    }
    function recordReader(envelope, result, code) {
        const previous = readReader(envelope.binding.sessionId);
        if (previous && previous.request.operationId !== envelope.request.operationId)
            return previous;
        if (previous?.request.operationId === envelope.request.operationId && previous.result?.kind === 'committed')
            return previous;
        const next = { ...envelope,
            state: result && result.kind !== 'unknown' ? 'terminal' : 'unknown',
            ...(result ? { result } : {}), ...(code ? { code } : {}) };
        if (previous?.request.operationId === envelope.request.operationId)
            storage.setItem(readerKey(envelope.binding.sessionId), JSON.stringify(next));
        return next;
    }
    function releaseReader(envelope) {
        const previous = readReader(envelope.binding.sessionId);
        if (previous?.request.operationId === envelope.request.operationId)
            storage.setItem(readerKey(envelope.binding.sessionId), JSON.stringify({ ...previous, manualReleased: true }));
    }
    function read(sessionId) {
        const bytes = storage.getItem(key(sessionId));
        if (!bytes)
            return;
        const envelope = JSON.parse(bytes);
        if (envelope.schemaVersion !== 2 || envelope.encoding !== 'nexttavern-numerical-pending-v2'
            || envelope.operation.sessionId !== sessionId)
            throw Error('BROWSER_PENDING_FORMAT_UNSUPPORTED');
        return envelope;
    }
    function persistNumerical(envelope) {
        const sessionId = envelope.operation.sessionId, previous = read(sessionId);
        if (previous && previous.state !== 'terminal') {
            throw Error('BROWSER_SAVE_CONFIRMATION_REQUIRED');
        }
        // Freeze the submitted DATA through the one shared storage slot before
        // either Reader or helper dispatch. A storage failure blocks the write.
        storage.setItem(key(sessionId), JSON.stringify(envelope));
        return read(sessionId);
    }
    function begin(binding, request, operationId = crypto.randomUUID()) {
        return persistNumerical({
            schemaVersion: 2, encoding: 'nexttavern-numerical-pending-v2',
            origin: { kind: 'helper', binding, child: { requestId: request.requestId, generation: request.generation,
                    readRevision: request.readRevision, realmId: request.realmId } },
            operation: { schemaVersion: 1, sessionId: binding.sessionId, operationId,
                action: 'replace-values', expected: request.expected, values: request.values,
                ...request.target ? { target: request.target } : {} },
            state: 'pending',
        });
    }
    function beginReaderNumerical(binding, documentPlanSha256, readRevision, operation) {
        return persistNumerical({ schemaVersion: 2, encoding: 'nexttavern-numerical-pending-v2',
            origin: { kind: 'reader', binding, documentPlanSha256, readRevision }, operation, state: 'pending' });
    }
    function record(envelope, result) {
        const previous = read(envelope.operation.sessionId);
        if (previous?.operation.operationId === envelope.operation.operationId && previous.state === 'terminal')
            return previous;
        const next = { ...envelope,
            state: result && terminalBrowserReceipt(result) ? 'terminal' : 'unknown',
            ...(result ? { receipt: { ok: result.ok, operation: result.operation, code: result.code, error: result.error } } : {}),
        };
        // An old ACK may finish its old record, but cannot replace a newer
        // operation admitted by another view after terminal confirmation.
        if (previous?.operation.operationId === envelope.operation.operationId) {
            storage.setItem(key(envelope.operation.sessionId), JSON.stringify(next));
        }
        return next;
    }
    function readWorldbooks(sessionId) {
        const bytes = storage.getItem(worldbookKey(sessionId));
        if (!bytes)
            return [];
        const collection = JSON.parse(bytes);
        if (collection.schemaVersion !== 2 || collection.encoding !== 'nexttavern-author-browser-worldbook-operations-v2'
            || collection.sessionId !== sessionId) {
            throw Error('BROWSER_WORLDBOOK_PENDING_FORMAT_UNSUPPORTED');
        }
        return collection.operations;
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
        const scope = observedScope ?? previous.scope;
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
            operationId: request.operationId, realmId: request.realmId, state: 'pending' };
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
    return { read, begin, beginReaderNumerical, record,
        readBodies, beginBody, readReaderBodies, beginReaderBody, recordBody,
        readOpening, beginOpening, recordOpening, releaseOpening, readReader, beginReader, recordReader, releaseReader,
        readWorldbooks, beginWorldbook, recordWorldbook,
        readPersonas, beginPersona, recordPersona };
}
export function pendingBrowserRequest(envelope) {
    if (envelope.origin.kind !== 'helper')
        throw Error('NUMERICAL_PENDING_HELPER_ORIGIN_REQUIRED');
    return { ...envelope.origin.child, expected: envelope.operation.expected, values: envelope.operation.values,
        ...envelope.operation.target ? { target: envelope.operation.target } : {} };
}
