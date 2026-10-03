// Generated from runtime/alpha3/src/core/roleplay-mvu-native.ts; edit the TypeScript source.
import { recordSha256, sha256 } from './roleplay-data.js';
import { sessionEvents } from './session-history.js';
import { validatePromptTemplateOnlyOpeningIntentV6 } from './roleplay-prompt-template-only-data.js';
import { verifyProgrammaticCardCopySpanV1 } from './roleplay-program-copy-span.js';
const unknown = () => ({ status: 'unknown' });
const same = (a, b) => recordSha256(a) === recordSha256(b);
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && !Object.is(value, -0);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const sourceOf = (event) => event.data?.message?.source;
const programmaticOf = (event) => event.data?.['programmatic'];
const identityOf = (row) => ({ sessionId: row.sessionId, source: row.source,
    operationId: row.operationId, messageId: row.messageId, index: row.index, sourcePointer: row.sourcePointer,
    sourceSha256: row.sourceSha256, renderedSha256: row.renderedSha256 });
/** Reads original/native ownership only. Source/plan currency is a separate owner
 * check; this receipt does not encode the entire old Source identity. No cached
 * message projection, id/text match or flush flag replaces the original events. */
export function createRoleplayMvuNative(deps) {
    function intent(identity, turn) {
        if (!identity || !identity.source || identity.source.sessionId !== identity.sessionId
            || !integer(identity.index) || !hash(identity.sourceSha256) || !hash(identity.renderedSha256))
            return undefined;
        const row = deps.readIntent(identity.sessionId, identity.source.importId);
        if (!row || row.schemaVersion !== 3 && row.schemaVersion !== 4 && row.schemaVersion !== 5 && row.schemaVersion !== 6
            || row.status !== 'native-committed' && row.status !== 'completed' || !row.textRetained
            || !integer(row.committedTurn) || turn !== undefined && row.committedTurn !== turn
            || !same(identityOf(row), identity) || typeof row.renderedText !== 'string'
            || Buffer.byteLength(row.renderedText, 'utf8') > 65_536 || sha256(row.renderedText) !== identity.renderedSha256)
            return undefined;
        if (row.schemaVersion === 6) {
            try {
                validatePromptTemplateOnlyOpeningIntentV6(row);
            }
            catch {
                return undefined;
            }
        }
        return row;
    }
    function read(identity, acknowledgedTurn) {
        try {
            // A row with matching text is not an acknowledgement. read callers must
            // supply the durable committedTurn; verify supplies an actual SDK ACK.
            if (!integer(acknowledgedTurn))
                return unknown();
            const row = intent(identity, acknowledgedTurn), session = deps.getSession(identity.sessionId);
            if (!row || !session || session.id !== identity.sessionId)
                return unknown();
            const events = sessionEvents(session), boundary = session.inheritedEventCount;
            if (!integer(boundary))
                return unknown();
            // Keep the original strict intent owner above. The shared helper reads
            // only actual bytes/projections; it cannot authorize a v7 intent cast.
            const matched = verifyProgrammaticCardCopySpanV1({ identity: { sessionId: identity.sessionId,
                    importId: identity.source.importId, operationId: identity.operationId, requestedMessageId: identity.messageId,
                    renderedText: row.renderedText, renderedSha256: identity.renderedSha256 }, acknowledgedTurn,
                observation: { id: session.id, header: session.header, inheritedEventCount: boundary, seq: session.seq, events,
                    surfaceNodes: session.surface?.nodes, deletedMessageIds: () => deps.deletedMessageIds(session),
                    ...(session.deriveEventMessage ? { deriveEventMessage: (event) => session.deriveEventMessage(event) } : {}) },
                messageEdits: deps.messageEdits });
            if (matched.kind !== 'matched')
                return unknown();
            const receipt = { ...matched.facts, flushed: true };
            if (row.nativeReceipt && !same(row.nativeReceipt, receipt))
                return unknown();
            return { status: 'committed', receipt };
        }
        catch {
            return unknown();
        }
    }
    function current(receipt) {
        try {
            if (!receipt || receipt.flushed !== true || !integer(receipt.turnStartSeq))
                return false;
            const session = deps.getSession(receipt.sessionId);
            if (!session || session.id !== receipt.sessionId)
                return false;
            const start = sessionEvents(session)[receipt.turnStartSeq];
            const origin = start && programmaticOf(start)?.['origin'];
            if (typeof origin !== 'string' || !origin.startsWith('card-opening:'))
                return false;
            const importId = origin.slice('card-opening:'.length);
            const row = deps.readIntent(receipt.sessionId, importId);
            if (!row || row.schemaVersion !== 3 && row.schemaVersion !== 4 && row.schemaVersion !== 5 && row.schemaVersion !== 6)
                return false;
            const observed = read(identityOf(row), receipt.turn);
            return observed.status === 'committed' && same(observed.receipt, receipt);
        }
        catch {
            return false;
        }
    }
    async function verify(identity) {
        try {
            const before = intent(identity);
            if (!before)
                return unknown();
            const rowHash = recordSha256(before), text = before.renderedText;
            const found = await deps.lookup(identity, text);
            // Re-read after every SDK/flush await. Never promote pending/unknown rows
            // or infer a lost ACK; selection owns lookup -> native-committed storage.
            const after = intent(identity);
            if (!after || recordSha256(after) !== rowHash)
                return unknown();
            if (found.status === 'absent') {
                const session = deps.getSession(identity.sessionId);
                if (!session || session.id !== identity.sessionId)
                    return unknown();
                const events = sessionEvents(session);
                if (events.some(event => event.type === 'turn/start' && (programmaticOf(event)?.['operationId'] === identity.operationId
                    || programmaticOf(event)?.['messageId'] === identity.messageId)
                    || event.type === 'assistant/message' && (event.data?.message?.id === identity.messageId
                        || sourceOf(event)?.['operationId'] === identity.operationId)))
                    return unknown();
                return { status: 'absent' };
            }
            return found.status === 'committed' ? read(identity, found.turn) : unknown();
        }
        catch {
            return unknown();
        }
    }
    /** Read the real child's inherited prefix against the frozen original
     * opening. There is no fabricated root Session, ancestor-head lookup, SDK
     * ACK or replacement receipt; the original flushed receipt stays intact. */
    function readInheritedOpeningSpan(input) {
        try {
            const row = input.frozenOpening.intent, receipt = input.frozenOpening.nativeReceipt;
            const cut = input.actualChildCut, observation = deps.getInheritedNativeObservation?.(input.childSessionId), session = deps.getSession(input.childSessionId), actual = observation ?? session;
            if (deps.getInheritedNativeObservation && !observation)
                return unknown();
            if (!actual || actual.id !== input.childSessionId || actual.header?.parentSession !== input.parentSessionId
                || row.status !== 'completed' || !row.textRetained || row.sessionId !== input.frozenOpening.ownerSessionId
                || row.schemaVersion === 4 && (row.mode !== 'plain' || !row.absenceScopeProof || row.initialization)
                || row.schemaVersion !== 4 && row.schemaVersion !== 6 || !same(row.nativeReceipt, receipt)
                || receipt.sessionId !== row.sessionId || receipt.operationId !== row.operationId || receipt.messageId !== row.messageId
                || receipt.flushed !== true || receipt.turn !== row.committedTurn || receipt.renderedSha256 !== row.renderedSha256
                || sha256(row.renderedText) !== row.renderedSha256 || !integer(receipt.turnStartSeq) || !integer(receipt.assistantSeq)
                || !integer(receipt.turnEndSeq) || cut.sessionId !== actual.id || cut.parentSessionId !== input.parentSessionId
                || cut.cut.kind !== 'native-fork' || cut.inheritedEventCount !== cut.cut.seedLength
                || actual.inheritedEventCount !== cut.inheritedEventCount)
                return unknown();
            if (row.schemaVersion === 6)
                validatePromptTemplateOnlyOpeningIntentV6(row);
            const events = observation?.events ?? sessionEvents(session), prefix = events.slice(0, cut.inheritedEventCount), surfaceNodes = observation?.surfaceNodes ?? session?.surface?.nodes, deleted = observation?.deletedMessageIds ?? (session ? deps.deletedMessageIds(session) : []);
            if (!integer(cut.inheritedEventCount) || cut.inheritedEventCount > events.length
                || events.some((event, index) => event.seq !== index) || !observation && session?.seq !== undefined && session.seq !== events.length
                || recordSha256(prefix) !== cut.childPrefixSha256 || cut.childPrefixSha256 !== cut.cut.prefixSha256
                || receipt.turnEndSeq >= prefix.length)
                return unknown();
            const start = prefix[receipt.turnStartSeq], assistant = prefix[receipt.assistantSeq], end = prefix[receipt.turnEndSeq];
            const expectedMarker = { schemaVersion: 1, operationId: row.operationId, messageId: row.messageId,
                producer: 'dsh-nexttavern', origin: `card-opening:${row.source.importId}`, textSha256: row.renderedSha256 };
            const expectedSource = { kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
                origin: `card-opening:${row.source.importId}`, operationId: row.operationId };
            const message = assistant?.data?.message;
            if (start?.type !== 'turn/start' || start.data?.turn !== receipt.turn || !same(programmaticOf(start), expectedMarker)
                || assistant?.type !== 'assistant/message' || assistant.data?.turn !== receipt.turn || assistant.data?.step !== 1
                || !same(assistant.data?.['stream'], []) || message?.id !== row.messageId || message.role !== 'assistant'
                || !same(message.source, expectedSource) || !same(message.content, [{ type: 'text', text: row.renderedText }])
                || end?.type !== 'turn/end' || end.data?.turn !== receipt.turn || !same(end.data?.reason, { kind: 'completed' })
                || cut.openingEventSeq !== assistant.seq || cut.openingEventSha256 !== recordSha256(assistant)
                || cut.originalMessageVersionSha256 !== receipt.messageVersion.eventSha256
                || receipt.messageVersion.kind !== 'original' || receipt.messageVersion.eventSha256 !== recordSha256(assistant)
                || !(start.seq < assistant.seq && assistant.seq < end.seq))
                return unknown();
            const span = prefix.slice(start.seq, end.seq + 1), stepStarts = span.filter(event => event.type === 'step/start');
            const stepEnds = span.filter(event => event.type === 'step/end'), stepStart = stepStarts[0], stepEnd = stepEnds[0];
            if (span.filter(event => event.type === 'turn/start').length !== 1 || span.filter(event => event.type === 'turn/end').length !== 1
                || span.filter(event => event.type === 'assistant/message').length !== 1 || stepStarts.length !== 1 || stepEnds.length !== 1
                || !stepStart || !stepEnd || stepStart.data?.turn !== receipt.turn || stepEnd.data?.turn !== receipt.turn
                || stepStart.data?.step !== 1 || stepEnd.data?.step !== 1
                || !(start.seq < stepStart.seq && stepStart.seq < assistant.seq && assistant.seq < stepEnd.seq && stepEnd.seq < end.seq)
                || span.some(event => !['turn/start', 'step/start', 'system/message', 'assistant/message', 'step/end', 'turn/end'].includes(event.type))
                || events.filter(event => event.type === 'turn/start' && (programmaticOf(event)?.['operationId'] === row.operationId
                    || programmaticOf(event)?.['messageId'] === row.messageId)).length !== 1
                || events.filter(event => event.type === 'assistant/message' && (event.data?.message?.id === row.messageId
                    || sourceOf(event)?.['operationId'] === row.operationId)).length !== 1
                || prefix.filter(event => event.type === 'turn/start' && event.data?.turn === receipt.turn).length !== 1
                || !Array.isArray(surfaceNodes) || surfaceNodes.filter(seq => seq === assistant.seq).length !== 1
                || deps.messageEdits.latest(events, assistant.seq) !== null || deleted.includes(row.messageId)
                || (observation ? !same(observation.deriveEventMessage(assistant), message)
                    : session?.deriveEventMessage !== undefined && !same(session.deriveEventMessage(assistant), message)))
                return unknown();
            return { status: 'committed', receipt };
        }
        catch {
            return unknown();
        }
    }
    function readInheritedFrozen(input) {
        if (!input?.sourceInheritance || !same(input.actualChildCut?.cut, input.sourceInheritance.nativeCut))
            return unknown();
        return readInheritedOpeningSpan(input);
    }
    return { read, current, verify, readInheritedFrozen, readInheritedOpeningSpan };
}
