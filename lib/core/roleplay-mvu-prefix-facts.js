// Generated from runtime/alpha3/src/core/roleplay-mvu-prefix-facts.ts; edit the TypeScript source.
/** Historical Native completion facts over the child's actual frozen prefix.
 * No Session, inbox ownership, hot token, flush acknowledgement or new Native
 * receipt is created here. Core verifies child lineage and original owner rows. */
import { createHash } from 'node:crypto';
import { recordSha256, sha256, textOf } from './roleplay-data.js';
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && !Object.is(value, -0);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function refusal() { throw new Error('INHERITED_NATIVE_FACT_UNPROVEN'); }
function exact(value, fields) {
    if (!object(value) || Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field)))
        refusal();
}
/** Native identity differs deliberately from Core's persisted-record encoding:
 * undefined object fields remain present and encode as the literal undefined.
 * This bounded descriptor reader reproduces the actual Native algorithm without
 * invoking getters or allowing cycles, sparse arrays or exotic prototypes. */
function nativeEncoding(input) {
    let nodes = 0, bytes = 0;
    const ancestors = new Set();
    function visit(value, depth) {
        if (++nodes > 128_000 || depth > 64)
            refusal();
        if (value === null || value === undefined || typeof value === 'boolean')
            return JSON.stringify(value) ?? 'undefined';
        if (typeof value === 'number') {
            if (!Number.isFinite(value))
                refusal();
            return JSON.stringify(value);
        }
        if (typeof value === 'string') {
            bytes += Buffer.byteLength(value, 'utf8');
            if (bytes > 16_777_216)
                refusal();
            return JSON.stringify(value);
        }
        if (!value || typeof value !== 'object' || ancestors.has(value))
            refusal();
        const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
        if ((array ? prototype !== Array.prototype : ![Object.prototype, null].includes(prototype))
            || Object.getOwnPropertySymbols(value).length)
            refusal();
        const descriptors = Object.getOwnPropertyDescriptors(value), names = Object.keys(descriptors);
        if (array && (value.length > 100_000 || names.length !== value.length + 1))
            refusal();
        ancestors.add(value);
        const children = [];
        for (const name of array ? Array.from({ length: value.length }, (_, index) => String(index)) : names.sort()) {
            const descriptor = descriptors[name];
            if (!descriptor || !('value' in descriptor) || !descriptor.enumerable
                || ['__proto__', 'constructor', 'prototype'].includes(name))
                refusal();
            bytes += Buffer.byteLength(name, 'utf8');
            if (bytes > 16_777_216)
                refusal();
            const child = visit(descriptor.value, depth + 1);
            children.push(array ? child : `${JSON.stringify(name)}:${child}`);
        }
        ancestors.delete(value);
        return array ? `[${children.join(',')}]` : `{${children.join(',')}}`;
    }
    return visit(input, 0);
}
const nativeHash = (value) => createHash('sha256').update(nativeEncoding(value)).digest('hex');
const same = (left, right) => nativeHash(left) === nativeHash(right);
function data(event) {
    if (!object(event.data))
        refusal();
    return event.data;
}
function preparation(value) {
    exact(value, ['schemaVersion', 'namespace', 'preparationKeySha256', 'credentialSha256']);
    if (value.schemaVersion !== 1 || typeof value.namespace !== 'string' || !/^[\x21-\x7e]{1,64}$/.test(value.namespace)
        || !hash(value.preparationKeySha256) || !hash(value.credentialSha256))
        refusal();
    return value;
}
function refs(value, sessionId) {
    if (!Array.isArray(value) || value.length < 1 || value.length > 64)
        refusal();
    const ids = new Set();
    for (const ref of value) {
        exact(ref, ['sessionId', 'insertSeq', 'messageId', 'messageSha256']);
        if (ref.sessionId !== sessionId || !integer(ref.insertSeq) || typeof ref.messageId !== 'string' || !ref.messageId.length
            || /[\u0000-\u001f\u007f-\u009f]/.test(ref.messageId) || !hash(ref.messageSha256) || ids.has(ref.messageId))
            refusal();
        ids.add(ref.messageId);
    }
    return value;
}
function marker(value, owner) {
    if (!object(value))
        refusal();
    exact(value, ['schemaVersion', 'encoding', 'preparation', 'refs', 'workSha256', 'mode',
        value.mode === 'claim' ? 'proposal' : 'previousStartSeq']);
    const prep = preparation(value.preparation), linkedRefs = refs(value.refs, owner);
    if (value.schemaVersion !== 1 || value.encoding !== 'native-input-link-v1'
        || !hash(value.workSha256) || value.workSha256 !== nativeHash({ schemaVersion: 1,
        encoding: 'native-input-work-v1', sessionId: owner, preparation: prep, refs: linkedRefs }))
        refusal();
    if (value.mode === 'claim') {
        exact(value.proposal, ['target', 'revision', 'stateSha256']);
        if (!['next-turn', 'next-step'].includes(String(value.proposal.target))
            || !integer(value.proposal.revision) || !hash(value.proposal.stateSha256))
            refusal();
    }
    else if (value.mode !== 'resume' || !integer(value.previousStartSeq))
        refusal();
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 32_768)
        refusal();
    return value;
}
const refIdentity = (ref) => `${ref.insertSeq}:${ref.messageId}:${ref.messageSha256}`;
export function verifyInheritedCompletedFact(input, deps) {
    try {
        // Validate every original descriptor before any read/hash, including the
        // events after this old completion that can contain durable message edits.
        nativeEncoding(input);
        exact(input, ['ownerSessionId', 'ownerInheritedEventCount', 'events', 'receipt', 'canonical']);
        if (typeof input.ownerSessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.ownerSessionId)
            || !integer(input.ownerInheritedEventCount) || !Array.isArray(input.events) || input.events.length > 100_000
            || input.ownerInheritedEventCount > input.events.length
            || input.events.some((event, index) => !object(event) || event.seq !== index || typeof event.type !== 'string'))
            return false;
        const receipt = input.receipt;
        exact(receipt, ['schemaVersion', 'checkpoint', 'turnEndSeq', 'turnEndSha256', 'admittedUsers', 'flushed']);
        const checkpoint = receipt.checkpoint;
        exact(checkpoint, ['schemaVersion', 'sessionId', 'workSha256', 'preparation', 'refs', 'actualTurn',
            'startSeq', 'firstStepStartSeq', 'claimSpliceSeqs']);
        const selectedRefs = refs(checkpoint.refs, input.ownerSessionId);
        preparation(checkpoint.preparation);
        if (receipt.schemaVersion !== 1 || receipt.flushed !== true || checkpoint.schemaVersion !== 1
            || checkpoint.sessionId !== input.ownerSessionId || !integer(checkpoint.actualTurn) || !integer(checkpoint.startSeq)
            || checkpoint.startSeq < input.ownerInheritedEventCount || !integer(checkpoint.firstStepStartSeq)
            || !integer(receipt.turnEndSeq) || receipt.turnEndSeq >= input.events.length || !hash(receipt.turnEndSha256)
            || !Array.isArray(checkpoint.claimSpliceSeqs) || !checkpoint.claimSpliceSeqs.length
            || checkpoint.claimSpliceSeqs.some(seq => !integer(seq)) || !Array.isArray(receipt.admittedUsers)
            || receipt.admittedUsers.length !== selectedRefs.length)
            return false;
        exact(input.canonical, ['seq', 'messageId', 'versionSha256', 'narrativeSha256']);
        if (!integer(input.canonical.seq) || typeof input.canonical.messageId !== 'string'
            || !hash(input.canonical.versionSha256) || !hash(input.canonical.narrativeSha256))
            return false;
        const queues = { 'next-turn': [], 'next-step': [] };
        const entries = new Map(), turns = new Map(), starts = new Map();
        let open, lastStart, revision = -1;
        let completedEntries;
        // Replay both actual queues across the complete prefix, while freezing the
        // selected completion's entry facts at its own original closing boundary.
        // Later claims/cancellations cannot mutate this old completed comparison.
        for (const event of input.events) {
            if (event.type === 'turn/start') {
                const row = data(event);
                if (open || !integer(row.turn) || turns.has(row.turn))
                    return false;
                // Inherited starts retain the ancestor's original refs and owner. They
                // participate in ordinary queue/turn replay, not this owner's marker
                // authorization. Its selected work must still begin after the boundary.
                const linked = event.seq >= input.ownerInheritedEventCount && Object.hasOwn(row, 'nativeInputLink')
                    ? marker(row.nativeInputLink, input.ownerSessionId) : undefined;
                const target = linked?.mode === 'claim' ? linked.proposal.target : 'next-turn';
                const offered = [...queues['next-step'], ...(target === 'next-turn' ? queues['next-turn'].slice(0, 1) : [])];
                const state = { 'next-turn': queues['next-turn'].map(entry => entry.message),
                    'next-step': queues['next-step'].map(entry => entry.message) };
                open = { turn: row.turn, startSeq: event.seq, previousStartSeq: lastStart, marker: linked,
                    proposalMatches: linked?.mode === 'claim' && linked.proposal.revision === revision
                        && linked.proposal.stateSha256 === nativeHash(state) && same(linked.refs, offered.map(entry => entry.ref)),
                    lastStep: 0, users: [] };
                lastStart = event.seq;
                turns.set(open.turn, open);
                starts.set(open.startSeq, open);
            }
            else if (event.type === 'step/start' || event.type === 'step/end') {
                const row = data(event);
                if (!open || row.turn !== open.turn || !integer(row.step) || row.step === 0)
                    return false;
                if (event.type === 'step/start') {
                    if (open.openStep !== undefined || row.step !== open.lastStep + 1)
                        return false;
                    open.openStep = row.step;
                    if (row.step === 1)
                        open.firstStepStartSeq = event.seq;
                }
                else {
                    if (open.openStep !== row.step)
                        return false;
                    open.lastStep = row.step;
                    open.openStep = undefined;
                }
            }
            else if (event.type === 'turn/end') {
                const row = data(event);
                if (!open || row.turn !== open.turn || open.openStep !== undefined || !open.firstStepStartSeq || open.lastStep < 1)
                    return false;
                open.end = event;
                if (event.seq === receipt.turnEndSeq)
                    completedEntries = [...entries.values()].map(entry => ({ ...entry }));
                open = undefined;
            }
            else if (event.type === 'agent/inbox/spliced') {
                const row = data(event), target = row.target;
                if ((target !== 'next-turn' && target !== 'next-step') || !integer(row.start)
                    || !Array.isArray(row.inserted) || (row.outcome !== undefined && row.outcome !== 'canceled'))
                    return false;
                const queue = queues[target], removedCount = row.removedCount ?? 0;
                if (!integer(removedCount) || row.start > queue.length || row.start + removedCount > queue.length)
                    return false;
                for (const [index, entry] of queue.slice(row.start, row.start + removedCount).entries()) {
                    if (row.outcome === 'canceled')
                        entry.cancelled = true;
                    else {
                        if (!open || entry.claimSeq !== undefined)
                            return false;
                        entry.claimSeq = event.seq;
                        entry.claimIndex = index;
                        entry.claimTurn = open.turn;
                    }
                }
                const inserted = [];
                for (const message of row.inserted) {
                    if (!object(message) || typeof message.id !== 'string' || !message.id.length || message.role !== 'user')
                        return false;
                    const ref = { sessionId: input.ownerSessionId, insertSeq: event.seq,
                        messageId: message.id, messageSha256: nativeHash(message) };
                    if (entries.has(refIdentity(ref)))
                        return false;
                    const entry = { ref, message };
                    entries.set(refIdentity(ref), entry);
                    inserted.push(entry);
                }
                queue.splice(row.start, removedCount, ...inserted);
                const pendingIds = [...queues['next-turn'], ...queues['next-step']].map(entry => entry.ref.messageId);
                if (new Set(pendingIds).size !== pendingIds.length)
                    return false;
                revision = event.seq;
            }
            else if (event.type === 'user/message') {
                const row = data(event);
                // Native/Core can append internal user context between closed steps.
                // Original admitted refs remain bound below to their actual claim/hash,
                // unique user seq and first-step/completed-end interval; a step being
                // open at every context append is not part of that Native contract.
                if (!open || typeof row.id !== 'string')
                    return false;
                open.users.push(event.seq);
                const candidates = [...entries.values()].filter(entry => entry.ref.messageId === row.id);
                const fingerprint = nativeHash(row), matches = candidates.filter(entry => entry.ref.messageSha256 === fingerprint);
                for (const entry of candidates)
                    if (entry.ref.messageSha256 !== fingerprint)
                        entry.conflict = true;
                if (matches.length > 1)
                    for (const entry of matches)
                        entry.conflict = true;
                if (matches.length === 1) {
                    const entry = matches[0];
                    // Supplemental admissions are permitted, but a pending/canceled or
                    // already admitted inbox entry cannot appear as a new Native user.
                    if (entry.userSeq !== undefined || entry.cancelled || entry.claimSeq === undefined)
                        return false;
                    entry.userSeq = event.seq;
                    entry.userTurn = open.turn;
                }
            }
            else if (event.type === 'assistant/message') {
                const row = data(event);
                if (!open || open.openStep === undefined || row.turn !== open.turn || row.step !== open.openStep)
                    return false;
            }
        }
        const selected = starts.get(checkpoint.startSeq), end = input.events[receipt.turnEndSeq];
        if (!completedEntries || !selected || selected.turn !== checkpoint.actualTurn || selected.end !== end || !end
            || end.type !== 'turn/end' || !same(data(end).reason, { kind: 'completed' }) || nativeHash(end) !== receipt.turnEndSha256
            || selected.firstStepStartSeq !== checkpoint.firstStepStartSeq || !selected.marker)
            return false;
        const origin = selected;
        if (origin.marker?.mode !== 'claim' || !origin.proposalMatches || origin.startSeq < input.ownerInheritedEventCount
            || origin.firstStepStartSeq === undefined || !same(selected.marker.preparation, checkpoint.preparation)
            || !same(selected.marker.refs, selectedRefs) || selected.marker.workSha256 !== checkpoint.workSha256)
            return false;
        const original = completedEntries.filter(entry => entry.claimTurn === origin.turn && entry.claimSeq !== undefined
            && entry.claimSeq > origin.startSeq && entry.claimSeq < origin.firstStepStartSeq)
            .sort((a, b) => a.claimSeq - b.claimSeq || a.claimIndex - b.claimIndex);
        if (!same(original.map(entry => entry.ref), selectedRefs) || original.some(entry => entry.conflict || entry.cancelled
            || entry.ref.insertSeq < input.ownerInheritedEventCount || entry.claimSeq < input.ownerInheritedEventCount)
            || !same([...new Set(original.map(entry => entry.claimSeq))], checkpoint.claimSpliceSeqs))
            return false;
        for (const [index, entry] of original.entries()) {
            const admitted = receipt.admittedUsers[index];
            exact(admitted, ['ref', 'userSeq']);
            if (!same(admitted.ref, entry.ref) || admitted.userSeq !== entry.userSeq || entry.userTurn !== selected.turn
                || entry.userSeq === undefined || entry.userSeq <= checkpoint.firstStepStartSeq || entry.userSeq >= receipt.turnEndSeq
                || index > 0 && entry.userSeq <= original[index - 1].userSeq)
                return false;
        }
        if (!original.some(entry => object(entry.message.source) && entry.message.source.kind === 'user'))
            return false;
        const canonical = input.canonical, assistant = input.events[canonical.seq];
        if (!assistant || assistant.type !== 'assistant/message' || canonical.seq <= checkpoint.firstStepStartSeq
            || canonical.seq >= receipt.turnEndSeq || data(assistant).turn !== selected.turn || data(assistant).interrupted === true)
            return false;
        const message = data(assistant).message;
        if (!object(message) || message.role !== 'assistant' || message.id !== canonical.messageId || !Array.isArray(message.content))
            return false;
        const edits = input.events.filter(event => event.type === 'roleplay/message-edit'
            && object(event.data) && (event.data.targetSeq === canonical.seq || event.data.messageId === canonical.messageId));
        if (!deps) {
            // Without Core's actual task/story selector only the strict raw-last body
            // is provable; edited or maintenance-interleaved selection needs that owner.
            const bodies = input.events.slice(checkpoint.startSeq, receipt.turnEndSeq).filter(event => event.type === 'assistant/message'
                && data(event).turn === selected.turn && data(event).interrupted !== true && object(data(event).message)
                && textOf(data(event).message.content).trim());
            if (bodies.at(-1)?.seq !== canonical.seq || edits.length)
                return false;
        }
        // Bind the selector's claimed version back to actual original message bytes
        // and the maintained edit protocol over this frozen prefix. A selector hash
        // alone cannot authorize an invented body, non-text block change or edit.
        let actualMessage = message;
        const protocol = deps?.editProtocol;
        for (const event of edits) {
            if (!protocol)
                return false;
            const edit = data(event);
            const assertEdit = protocol.assertMessageEdit;
            assertEdit(edit);
            if (edit.targetSeq !== canonical.seq || edit.messageId !== canonical.messageId || edit.role !== 'assistant'
                || event.seq <= canonical.seq || Object.getOwnPropertyDescriptor(event, 'ignorable')?.value === true)
                return false;
            actualMessage = protocol.editMessageText(actualMessage, edit);
        }
        const actualVersionSha256 = recordSha256(actualMessage), actualNarrative = textOf(actualMessage.content);
        let projected;
        if (deps)
            projected = deps.readProjectedCanonical(input.events, selected.turn);
        else {
            projected = { seq: assistant.seq, messageId: canonical.messageId, versionSha256: actualVersionSha256, narrative: actualNarrative };
        }
        if (!projected)
            return false;
        nativeEncoding(projected);
        exact(projected, ['seq', 'messageId', 'versionSha256', 'narrative']);
        return projected.seq === canonical.seq && projected.messageId === canonical.messageId
            && projected.versionSha256 === actualVersionSha256 && projected.versionSha256 === canonical.versionSha256
            && projected.narrative === actualNarrative && typeof projected.narrative === 'string'
            && !!projected.narrative.trim() && sha256(projected.narrative) === canonical.narrativeSha256;
    }
    catch {
        return false;
    }
}
