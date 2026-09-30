// Generated from runtime/alpha3/src/core/roleplay-mvu-native.ts; edit the TypeScript source.
import { recordSha256, sha256 } from './roleplay-data.js';
import { sessionEvents } from './session-history.js';
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
        if (!row || row.schemaVersion !== 3 && row.schemaVersion !== 4
            || row.status !== 'native-committed' && row.status !== 'completed' || !row.textRetained
            || !integer(row.committedTurn) || turn !== undefined && row.committedTurn !== turn
            || !same(identityOf(row), identity) || typeof row.renderedText !== 'string'
            || Buffer.byteLength(row.renderedText, 'utf8') > 65_536 || sha256(row.renderedText) !== identity.renderedSha256)
            return undefined;
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
            if (!integer(boundary) || boundary > events.length || events.some((event, index) => event.seq !== index)
                || session.seq !== undefined && session.seq !== events.length)
                return unknown();
            const starts = events.filter(event => event.type === 'turn/start');
            const candidates = starts.filter(event => programmaticOf(event)?.['operationId'] === identity.operationId
                || programmaticOf(event)?.['messageId'] === identity.messageId);
            const start = candidates[0];
            const expectedMarker = { schemaVersion: 1, operationId: identity.operationId, messageId: identity.messageId,
                producer: 'dsh-nexttavern', origin: `card-opening:${identity.source.importId}`, textSha256: identity.renderedSha256 };
            if (candidates.length !== 1 || !start || start.data?.turn !== acknowledgedTurn
                || !same(programmaticOf(start), expectedMarker)
                || starts.filter(event => event.data?.turn === acknowledgedTurn).length !== 1)
                return unknown();
            const assistants = events.filter(event => event.type === 'assistant/message'
                && (event.data?.message?.id === identity.messageId || sourceOf(event)?.['operationId'] === identity.operationId));
            const assistant = assistants[0], message = assistant?.data?.message;
            const expectedSource = { kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
                origin: `card-opening:${identity.source.importId}`, operationId: identity.operationId };
            if (assistants.length !== 1 || !assistant || !message || message.id !== identity.messageId || message.role !== 'assistant'
                || !same(message.source, expectedSource) || !Array.isArray(message.content)
                || !same(message.content, [{ type: 'text', text: row.renderedText }]) || assistant.data?.turn !== acknowledgedTurn
                || assistant.data?.step !== 1 || !same(assistant.data?.['stream'], []))
                return unknown();
            const ends = events.filter(event => event.type === 'turn/end' && event.data?.turn === acknowledgedTurn), end = ends[0];
            if (ends.length !== 1 || !end || !same(end.data?.reason, { kind: 'completed' })
                || !(boundary <= start.seq && start.seq < assistant.seq && assistant.seq < end.seq))
                return unknown();
            // The actual programmatic writer opens one step and admits no player or
            // provider request. Partial, overlapping or foreign execution is unknown.
            const span = events.slice(start.seq, end.seq + 1);
            const stepStarts = span.filter(event => event.type === 'step/start'), stepEnds = span.filter(event => event.type === 'step/end');
            const stepStart = stepStarts[0], stepEnd = stepEnds[0];
            if (span.filter(event => event.type === 'turn/start').length !== 1
                || span.filter(event => event.type === 'turn/end').length !== 1
                || span.filter(event => event.type === 'assistant/message').length !== 1
                || stepStarts.length !== 1 || stepEnds.length !== 1 || !stepStart || !stepEnd
                || stepStart.data?.turn !== acknowledgedTurn || stepEnd.data?.turn !== acknowledgedTurn
                || stepStart.data?.step !== 1 || stepEnd.data?.step !== 1
                || !(start.seq < stepStart.seq && stepStart.seq < assistant.seq && assistant.seq < stepEnd.seq && stepEnd.seq < end.seq)
                || span.some(event => !['turn/start', 'step/start', 'system/message', 'assistant/message', 'step/end', 'turn/end'].includes(event.type)))
                return unknown();
            const nodes = session.surface?.nodes;
            if (!Array.isArray(nodes) || nodes.filter(seq => seq === assistant.seq).length !== 1
                || deps.messageEdits.latest(events, assistant.seq) !== null
                || deps.deletedMessageIds(session).includes(identity.messageId))
                return unknown();
            if (session.deriveEventMessage && !same(session.deriveEventMessage(assistant), message))
                return unknown();
            const receipt = { sessionId: identity.sessionId, operationId: identity.operationId,
                messageId: identity.messageId, renderedSha256: identity.renderedSha256, turn: acknowledgedTurn,
                assistantSeq: assistant.seq, turnStartSeq: start.seq, turnEndSeq: end.seq,
                messageVersion: { kind: 'original', eventSha256: recordSha256(assistant) }, flushed: true };
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
            if (!row || row.schemaVersion !== 3 && row.schemaVersion !== 4)
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
    return { read, current, verify };
}
