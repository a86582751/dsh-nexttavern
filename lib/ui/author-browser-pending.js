// Generated from runtime/alpha3/src/ui/author-browser-pending.ts; edit the TypeScript source.
const characterLibraryKey = (sid) => 'nexttavern.author-native.character-library-pending.v1:' + sid;
const terminalCharacterLibraryResult = (result) => result.kind === 'committed' || result.kind === 'edited-data' || result.diagnostics.some(diagnostic => diagnostic.code === 'OPERATION_NOT_RECORDED' || diagnostic.code === 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED');
const presetKey = (sid) => 'nexttavern.author-native.preset-pending.v1:' + sid;
// Native helper outboxes are separate from unpublished VM test records.
const worldbookKey = (sessionId) => 'nexttavern.author-native.worldbook-pending.v1:' + sessionId;
export const terminalWorldbookReceipt = (result) => result.kind === 'committed'
    || result.diagnostics.some(value => value.code === 'AUTHOR_WORLDBOOK_OPERATION_NOT_RECORDED');
function worldbookResultScope(result) {
    if (result?.kind === 'committed') {
        return result.receipt.owner;
    }
    if (result?.kind !== 'refused')
        return;
    const recovery = result.diagnostics.find(value => value.recovery)?.recovery;
    return recovery;
}
export function worldbookPendingRetryLocator(envelope) {
    return envelope.scope;
}
export function worldbookPendingBlocksNamespace(envelope, profileId) {
    if (envelope.state === 'terminal')
        return false;
    const scope = envelope.scope;
    return (scope.kind === 'book' ? scope.address.profileId : scope.profileId) === profileId;
}
const personaKey = (sessionId) => 'nexttavern.author-native.persona-pending.v1:' + sessionId;
const key = (sessionId) => 'nexttavern.author-native.numerical-pending.v1:' + sessionId;
export const terminalBrowserReceipt = (result) => result.operation?.outcome === 'updated' || result.operation?.outcome === 'no-update'
    || result.operation?.outcome === 'refused';
export function openingVariantSettled(result) {
    return result?.kind === 'committed' || result?.kind === 'refused';
}
const readerKey = (sessionId) => 'nexttavern.reader.opening-variant-pending.v1:' + sessionId;
const openingKey = (sid) => 'nexttavern.author-native.opening-pending.v1:' + sid;
export function createAuthorBrowserPendingStore(storage) {
    function readCharacterLibrary(sid) {
        const bytes = storage.getItem(characterLibraryKey(sid));
        return bytes ? JSON.parse(bytes) : [];
    }
    function beginCharacterLibrary(binding, request, kind) {
        const rows = readCharacterLibrary(binding.sessionId), previous = rows.find(row => row.operation.kind === kind && row.operation.request.operationId === request.operationId);
        if (previous)
            return previous;
        const envelope = { schemaVersion: 1,
            encoding: 'author-native-character-library-pending-v1', binding,
            operation: { kind, request }, state: 'pending' };
        storage.setItem(characterLibraryKey(binding.sessionId), JSON.stringify([
            ...rows.filter(row => row.state !== 'terminal'), envelope
        ]));
        return readCharacterLibrary(binding.sessionId).find(row => row.operation.kind === kind && row.operation.request.operationId === request.operationId);
    }
    function recordCharacterLibrary(envelope, result, code) {
        const rows = readCharacterLibrary(envelope.binding.sessionId), index = rows.findIndex(row => row.operation.kind === envelope.operation.kind
            && row.operation.request.operationId === envelope.operation.request.operationId), previous = rows[index];
        if (!previous || previous.state === 'terminal')
            return previous ?? envelope;
        const next = { ...envelope,
            state: result && terminalCharacterLibraryResult(result) ? 'terminal' : 'unknown', result, code };
        rows[index] = next;
        storage.setItem(characterLibraryKey(envelope.binding.sessionId), JSON.stringify(rows));
        return next;
    }
    function readPresets(sid) {
        const bytes = storage.getItem(presetKey(sid));
        return bytes ? JSON.parse(bytes) : [];
    }
    function beginPreset(binding, operation) {
        const rows = readPresets(binding.sessionId), previous = rows.find(row => row.operation.operationId === operation.operationId);
        if (previous)
            return previous;
        const envelope = { schemaVersion: 1, encoding: 'author-native-preset-pending-v1',
            binding, operation, state: 'pending' };
        storage.setItem(presetKey(binding.sessionId), JSON.stringify([...rows.filter(row => row.state !== 'terminal'), envelope]));
        return readPresets(binding.sessionId).find(row => row.operation.operationId === operation.operationId);
    }
    function recordPreset(envelope, result, code, outcome = 'unknown') {
        const rows = readPresets(envelope.binding.sessionId), index = rows.findIndex(row => row.operation.operationId === envelope.operation.operationId), previous = rows[index];
        if (!previous)
            return envelope;
        if (previous.state === 'terminal')
            return previous;
        const next = { ...envelope, state: result || outcome === 'refused' ? 'terminal' : 'unknown', result, code };
        rows[index] = next;
        storage.setItem(presetKey(envelope.binding.sessionId), JSON.stringify(rows));
        return next;
    }
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
        const next = { ...envelope, result, state: openingVariantSettled(result) ? 'terminal' : 'unknown' };
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
            state: openingVariantSettled(result) ? 'terminal' : 'unknown',
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
                ...request.action === 'replace-envelope' ? { action: 'replace-envelope', envelope: request.envelope }
                    : { action: 'replace-values', values: request.values },
                expected: request.expected,
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
        if (collection.schemaVersion !== 3 || collection.encoding !== 'nexttavern-author-browser-worldbook-operations-v3'
            || collection.sessionId !== sessionId) {
            throw Error('BROWSER_WORLDBOOK_PENDING_FORMAT_UNSUPPORTED');
        }
        return collection.operations;
    }
    function writeWorldbooks(sessionId, operations) {
        const collection = { schemaVersion: 3,
            encoding: 'nexttavern-author-browser-worldbook-operations-v3', sessionId, operations };
        storage.setItem(worldbookKey(sessionId), JSON.stringify(collection));
    }
    function beginWorldbook(binding, request, profileId) {
        const operations = readWorldbooks(binding.sessionId);
        const previous = operations.find(value => value.operationId === request.operationId);
        if (previous)
            return previous;
        let scope, name;
        if ('target' in request) {
            scope = { kind: 'book', address: { profileId, bookId: request.target.bookId } };
            name = request.name;
        }
        else if (request.mutation.kind === 'bind-books') {
            scope = { kind: 'bindings', profileId, owner: request.mutation.target.owner };
            name = request.mutation.target.owner.kind + ' worldbooks';
        }
        else {
            scope = { kind: 'catalog', profileId };
            name = request.mutation.name;
        }
        const envelope = { schemaVersion: 3,
            encoding: 'nexttavern-author-browser-worldbook-pending-v3', binding,
            sessionId: binding.sessionId, operationId: request.operationId, name, state: 'pending', scope };
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
            || previous.result?.kind === 'committed' && result.kind !== 'committed'))
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
    return { read, begin, beginReaderNumerical, record, readPresets, beginPreset, recordPreset,
        readCharacterLibrary, beginCharacterLibrary, recordCharacterLibrary,
        readBodies, beginBody, readReaderBodies, beginReaderBody, recordBody,
        readOpening, beginOpening, recordOpening, releaseOpening, readReader, beginReader, recordReader, releaseReader,
        readWorldbooks, beginWorldbook, recordWorldbook,
        readPersonas, beginPersona, recordPersona };
}
export function pendingBrowserRequest(envelope) {
    if (envelope.origin.kind !== 'helper')
        throw Error('NUMERICAL_PENDING_HELPER_ORIGIN_REQUIRED');
    const operation = envelope.operation;
    return { ...envelope.origin.child, expected: operation.expected,
        ...operation.action === 'replace-envelope' ? { action: 'replace-envelope', envelope: operation.envelope }
            : { action: 'replace-values', values: operation.values },
        ...envelope.operation.target ? { target: envelope.operation.target } : {} };
}
