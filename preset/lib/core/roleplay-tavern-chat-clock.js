// Generated from runtime/alpha3/src/core/roleplay-tavern-chat-clock.ts; edit the TypeScript source.
/** Canonical chat coordinates belong to the selected history owner. Request
 * windows change placement, while proven compaction sources keep this clock. */
import { deriveEventMessage, foldSurface } from '@deepseek-ai/dsh-session/surface';
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { selectedCanonicalChatHistory } from '../memory/memory-history.js';
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { tavernMaterialNativePrefixSha256V1 } from './roleplay-tavern-material-history.js';
function fail(code = 'INPUT_MATERIAL_CHAT_CLOCK_UNPROVEN') { throw Error(code); }
const same = (a, b) => recordSha256(a) === recordSha256(b);
const hash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
function freeze(v) {
    if (v && typeof v === 'object') {
        for (const child of Object.values(v))
            freeze(child);
        Object.freeze(v);
    }
    return v;
}
function selectedRows(view, events, messageAt) {
    const rows = selectedCanonicalChatHistory(view);
    if (rows.length > 16_384)
        fail('INPUT_MATERIAL_CHAT_CLOCK_BUDGET');
    const seen = new Set();
    return rows.map((row) => {
        const event = events[row.seq], message = event && messageAt(event);
        if (!message || typeof message.id !== 'string' || message.id.length < 1 || message.id.length > 256
            || message.role !== row.role || seen.has(message.id) || sha256(textOf(message.content)) !== sha256(row.text))
            fail();
        seen.add(message.id);
        return { ref: { seq: row.seq, id: message.id, role: row.role, messageSha256: nativeInputSha256(message), textSha256: sha256(row.text) },
            text: row.text, message: message };
    });
}
/** This is the registered Native pure projection over actual prefix bytes,
 * with no Session construction, driver, input claim or execution capability. */
export function readTavernCanonicalChatRowsAtCutV1(sessionId, events, nativeCut, projections) {
    if (!Number.isSafeInteger(nativeCut) || nativeCut < 0 || nativeCut > events.length
        || nativeCut > 131_072 || events.slice(0, nativeCut).some((event, index) => event.seq !== index))
        fail();
    const prefix = events.slice(0, nativeCut), surface = foldSurface(prefix, projections), messageAt = (event) => deriveEventMessage(event, surface.projectedMessages), view = { id: sessionId, events: prefix, surface, deriveEventMessage: messageAt };
    return selectedRows(view, prefix, messageAt).map(({ ref, text }) => ({ ref, text }));
}
/** A read-only dialog has a real Native prefix, with no selected Main request
 * or pending player input. Keep that distinction in its versioned clock. */
export function captureReadonlyAuthorDialogChatClockV1(input) {
    input.assertOwnerCurrent();
    const events = input.session.snapshotEvents(), surface = foldSurface(events, input.projections), messageAt = (event) => deriveEventMessage(event, surface.projectedMessages), view = { id: input.session.id, events, surface, deriveEventMessage: messageAt }, rows = selectedRows(view, events, messageAt), refs = rows.map(row => row.ref);
    const body = { schemaVersion: 2, encoding: 'native-readonly-author-dialog-chat-clock-v1',
        authority: 'consumer-data-only', policy: 'actual-completed-canonical-prose-without-request-selection-v1',
        sessionId: input.session.id, nativeCut: events.length,
        nativePrefixSha256: tavernMaterialNativePrefixSha256V1({ sessionId: input.session.id, inputState: input.inputState }, events),
        rows: refs, pendingRows: [], chatIndex: rows.length, membershipSha256: recordSha256(refs) };
    const data = freeze({ ...body, clockSha256: recordSha256(body) }), messages = cloneRoleplayTavernLoreDataV1(rows.map(({ ref, message }) => ({ origin: 'surface', eventSeq: ref.seq, id: ref.id,
        role: ref.role, messageSha256: ref.messageSha256, message })), 8_388_608), cut = { schemaVersion: 1, encoding: 'native-author-dialog-readonly-message-cut-v1', authority: 'consumer-data-only',
        sessionId: input.session.id, nativeCut: events.length, nativePrefixSha256: data.nativePrefixSha256, messages };
    return { data, selected: freeze({ messages, sha256: recordSha256(cut) }),
        scanRows: freeze(rows.map(({ ref, text }) => ({ id: ref.id, role: ref.role, messageSha256: ref.messageSha256, text }))),
        assertCurrent: input.assertOwnerCurrent };
}
export function captureTavernCanonicalChatClockV1(input) {
    input.assertOwnerCurrent();
    const { session, selected } = input, events = session.snapshotEvents(), rows = selectedRows(session, events, event => session.deriveEventMessage(event)), ids = new Set(rows.map(row => row.ref.id)), pending = [];
    for (const row of selected.messages)
        if (row.origin === 'pending-decision' && row.role === 'user') {
            const source = row.message.source;
            if (source?.kind !== 'user')
                continue;
            if (ids.has(row.id))
                fail('INPUT_MATERIAL_CHAT_CLOCK_DUPLICATE');
            if (row.eventSeq !== null || nativeInputSha256(row.message) !== row.messageSha256)
                fail();
            ids.add(row.id);
            const text = textOf(row.message.content);
            if (text.trim())
                pending.push({ ref: { seq: null, id: row.id, role: 'user', messageSha256: row.messageSha256, textSha256: sha256(text) }, text });
        }
    const body = { schemaVersion: 1, encoding: 'native-canonical-story-chat-clock-v1',
        authority: 'consumer-data-only', policy: 'canonical-completed-prose-and-selected-real-player-inputs-v1',
        sessionId: session.id, nativeCut: events.length,
        nativePrefixSha256: tavernMaterialNativePrefixSha256V1({ sessionId: session.id, inputState: input.inputState }, events),
        selectedSha256: selected.sha256,
        rows: rows.map(row => row.ref), pendingRows: pending.map(row => row.ref), chatIndex: rows.length + pending.length,
        membershipSha256: recordSha256([...rows.map(row => row.ref), ...pending.map(row => row.ref)]) };
    const data = freeze(cloneRoleplayTavernLoreDataV1({ ...body, clockSha256: recordSha256(body) }, 8_388_608)), scanRows = freeze([...rows, ...pending].map(({ ref, text }) => ({ id: ref.id, role: ref.role, messageSha256: ref.messageSha256, text })));
    const assertCurrent = () => {
        input.assertOwnerCurrent();
        const current = session.snapshotEvents();
        if (current.length < events.length || nativeInputSha256(current.slice(0, events.length)) !== data.nativePrefixSha256)
            fail();
        const actual = selectedRows(session, current, event => session.deriveEventMessage(event)), remaining = new Map(pending.map(row => [row.ref.id, row.ref])), base = new Map(rows.map(row => [row.ref.id, row.ref]));
        for (const row of actual) {
            const original = base.get(row.ref.id);
            if (original) {
                if (!same(row.ref, original))
                    fail();
                base.delete(row.ref.id);
                continue;
            }
            const proposed = remaining.get(row.ref.id);
            if (!proposed || row.ref.role !== proposed.role || row.ref.messageSha256 !== proposed.messageSha256
                || row.ref.textSha256 !== proposed.textSha256 || row.ref.seq === null || row.ref.seq < events.length)
                fail();
            remaining.delete(row.ref.id);
        }
        if (base.size)
            fail();
        // Not-yet-admitted pending rows remain in the captured logical count.
        // Native's actual selected-lineage check separately owns their admission.
    };
    return { data, scanRows, assertCurrent };
}
export function verifyTavernCanonicalChatClockV1(raw, sessionId, material, events, projections, historyFacts) {
    const value = cloneRoleplayTavernLoreDataV1(raw, 8_388_608);
    const expected = ['schemaVersion', 'encoding', 'authority', 'policy', 'sessionId', 'nativeCut', 'nativePrefixSha256', 'selectedSha256',
        'rows', 'pendingRows', 'chatIndex', 'membershipSha256', 'clockSha256'];
    if (!value || !same(Object.keys(value).sort(), expected.sort()) || value.schemaVersion !== 1
        || value.encoding !== 'native-canonical-story-chat-clock-v1' || value.authority !== 'consumer-data-only'
        || value.policy !== 'canonical-completed-prose-and-selected-real-player-inputs-v1' || value.sessionId !== sessionId
        || !Number.isSafeInteger(value.nativeCut) || value.nativeCut < 0 || value.nativeCut > material.seq
        || value.nativePrefixSha256 !== (historyFacts ? tavernMaterialNativePrefixSha256V1(historyFacts, events.slice(0, value.nativeCut)) :
            nativeInputSha256(events.slice(0, value.nativeCut))) || !hash(value.selectedSha256)
        || !Array.isArray(value.rows) || !Array.isArray(value.pendingRows) || value.rows.length + value.pendingRows.length > 16_384
        || value.chatIndex !== value.rows.length + value.pendingRows.length
        || value.membershipSha256 !== recordSha256([...value.rows, ...value.pendingRows]))
        fail();
    const { clockSha256, ...body } = value;
    if (!hash(clockSha256) || recordSha256(body) !== clockSha256)
        fail();
    const actual = readTavernCanonicalChatRowsAtCutV1(sessionId, events, value.nativeCut, projections);
    if (!same(actual.map(row => row.ref), value.rows))
        fail();
    const ids = new Set(value.rows.map(row => row.id));
    for (const pending of value.pendingRows) {
        if (!pending || !same(Object.keys(pending).sort(), ['seq', 'id', 'role', 'messageSha256', 'textSha256'].sort())
            || pending.seq !== null || pending.role !== 'user' || typeof pending.id !== 'string' || ids.has(pending.id)
            || !hash(pending.messageSha256) || !hash(pending.textSha256))
            fail();
        ids.add(pending.id);
        const refs = material.data.base.messages.filter(row => row.id === pending.id && row.role === 'user');
        if (refs.length !== 1 || refs[0].seq < value.nativeCut || refs[0].messageSha256 !== pending.messageSha256)
            fail();
        const event = events[refs[0].seq];
        if (event?.type !== 'user/message' || event.data.source?.kind !== 'user' || event.data.id !== pending.id
            || nativeInputSha256(event.data) !== pending.messageSha256 || sha256(textOf(event.data.content)) !== pending.textSha256)
            fail();
    }
    return freeze(value);
}
