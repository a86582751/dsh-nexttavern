// Generated from runtime/alpha3/compat/agent-loop/src/input-admission.ts; edit the TypeScript source.
/** Native inbox identity and conservative append-only ownership interpretation. */
import { createHash } from 'node:crypto';
export const INPUT_ADMISSION_ABORT_REASON = 'native-input-admission-before-message';
const canonical = (value) => {
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object')
        return `{${Object.keys(value).sort()
            .map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    return JSON.stringify(value) ?? 'undefined';
};
export const nativeInputSha256 = (value) => createHash('sha256').update(canonical(value)).digest('hex');
export const nativeInputWorkSha256 = (sessionId, preparation, refs) => nativeInputSha256({ schemaVersion: 1,
    encoding: 'native-input-work-v1', sessionId, preparation, refs });
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const count = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
/** Copy only plain data descriptors: no getter can change owner identity between checks. */
const exactData = (value, fields) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null)
        return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key)))
        return undefined;
    const result = {};
    for (const field of fields) {
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        if (!descriptor || !Object.hasOwn(descriptor, 'value'))
            return undefined;
        result[field] = descriptor.value;
    }
    return result;
};
export function nativePreparationReceipt(value) {
    try {
        const row = exactData(value, ['schemaVersion', 'namespace', 'preparationKeySha256', 'credentialSha256']);
        if (!row || row['schemaVersion'] !== 1 || typeof row['namespace'] !== 'string'
            || !/^[\x21-\x7e]{1,64}$/.test(row['namespace']) || !sha(row['preparationKeySha256']) || !sha(row['credentialSha256']))
            return undefined;
        return Object.freeze({ schemaVersion: 1, namespace: row['namespace'],
            preparationKeySha256: row['preparationKeySha256'], credentialSha256: row['credentialSha256'] });
    }
    catch {
        return undefined;
    }
}
const linkRefs = (value, sessionId) => {
    if (!Array.isArray(value) || value.length < 1 || value.length > 64 || Reflect.ownKeys(value).length !== value.length + 1)
        return undefined;
    const refs = [];
    for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        const row = descriptor && Object.hasOwn(descriptor, 'value')
            ? exactData(descriptor.value, ['sessionId', 'insertSeq', 'messageId', 'messageSha256']) : undefined;
        if (!row || row['sessionId'] !== sessionId || !count(row['insertSeq']) || typeof row['messageId'] !== 'string'
            || !row['messageId'].length || /[\u0000-\u001f\u007f-\u009f]/.test(row['messageId']) || !sha(row['messageSha256']))
            return undefined;
        refs.push(Object.freeze({ sessionId, insertSeq: row['insertSeq'], messageId: row['messageId'], messageSha256: row['messageSha256'] }));
    }
    if (new Set(refs.map(ref => ref.messageId)).size !== refs.length)
        return undefined;
    return Object.freeze(refs);
};
/** Known v1 only. Unknown/malformed metadata stays in ordinary Session history. */
export function nativeInputLink(value, sessionId) {
    try {
        const mode = value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptor(value, 'mode')?.value : undefined;
        const fields = ['schemaVersion', 'encoding', 'preparation', 'refs', 'workSha256', 'mode',
            mode === 'claim' ? 'proposal' : 'previousStartSeq'];
        const row = exactData(value, fields);
        if (!row || row['schemaVersion'] !== 1 || row['encoding'] !== 'native-input-link-v1' || !sha(row['workSha256']))
            return undefined;
        const preparation = nativePreparationReceipt(row['preparation']), refs = linkRefs(row['refs'], sessionId);
        if (!preparation || !refs || row['workSha256'] !== nativeInputWorkSha256(sessionId, preparation, refs))
            return undefined;
        let marker;
        if (row['mode'] === 'claim') {
            const proposal = exactData(row['proposal'], ['target', 'revision', 'stateSha256']);
            if (!proposal || !['next-turn', 'next-step'].includes(proposal['target'])
                || !count(proposal['revision']) || !sha(proposal['stateSha256']))
                return undefined;
            marker = { schemaVersion: 1, encoding: 'native-input-link-v1', preparation, refs, workSha256: row['workSha256'], mode: 'claim',
                proposal: Object.freeze({ target: proposal['target'], revision: proposal['revision'], stateSha256: proposal['stateSha256'] }) };
        }
        else if (row['mode'] === 'resume' && count(row['previousStartSeq'])) {
            marker = { schemaVersion: 1, encoding: 'native-input-link-v1', preparation, refs,
                workSha256: row['workSha256'], mode: 'resume', previousStartSeq: row['previousStartSeq'] };
        }
        else
            return undefined;
        if (Buffer.byteLength(JSON.stringify(marker), 'utf8') > 32768)
            return undefined;
        return Object.freeze(marker);
    }
    catch {
        return undefined;
    }
}
const refKey = (ref) => `${ref.insertSeq}:${ref.messageId}:${ref.messageSha256}`;
const validRef = (ref) => ref != null && typeof ref.sessionId === 'string'
    && typeof ref.messageId === 'string' && Number.isSafeInteger(ref.insertSeq) && ref.insertSeq >= 0
    && typeof ref.messageSha256 === 'string' && /^[a-f0-9]{64}$/.test(ref.messageSha256);
/** No live claimed notification, Core record or missing event is proof of ownership.
 * The actual inherited prefix has no child transfer proof in this event format;
 * its refs remain unknown even when their ids/bodies match a Core credential.
 * Callers must supply the actual boundary, including explicit zero for a root. */
export function inspectNativeInboxHistory(sessionId, events, inheritedBoundary = Number.NaN) {
    const queues = { 'next-turn': [], 'next-step': [] };
    const entries = new Map(), turns = new Map();
    const turnStarts = new Map(), turnsWithUsers = new Set();
    const linkedTurns = new Map();
    let openTurn, revision = -1;
    let invalid = !Number.isSafeInteger(inheritedBoundary) || inheritedBoundary < 0 || inheritedBoundary > events.length;
    for (const event of events) {
        if (event.type === 'turn/start') {
            if (openTurn !== undefined || turns.has(event.data.turn))
                invalid = true;
            openTurn = event.data.turn;
            const previousActualStartSeq = [...turnStarts.values()].at(-1);
            turnStarts.set(event.data.turn, event.seq);
            const marker = nativeInputLink(event.data.nativeInputLink, sessionId);
            const target = marker?.mode === 'claim' ? marker.proposal.target : 'next-turn';
            const offered = [...queues['next-step'], ...(target === 'next-turn' ? queues['next-turn'].slice(0, 1) : [])];
            const state = { 'next-turn': queues['next-turn'].map(entry => entry.message), 'next-step': queues['next-step'].map(entry => entry.message) };
            linkedTurns.set(event.seq, { turn: event.data.turn, startSeq: event.seq,
                previousActualStartSeq, lastStep: 0,
                present: Object.hasOwn(event.data, 'nativeInputLink'), marker,
                proposalMatches: marker?.mode === 'claim' && marker.proposal.revision === revision
                    && marker.proposal.stateSha256 === nativeInputSha256(state)
                    && nativeInputSha256(marker.refs) === nativeInputSha256(offered.map(entry => entry.ref)) });
        }
        else if (event.type === 'step/start' || event.type === 'step/end') {
            const startSeq = turnStarts.get(event.data.turn), linked = startSeq === undefined ? undefined : linkedTurns.get(startSeq);
            if (linked) {
                if (openTurn !== event.data.turn)
                    linked.badStep = true;
                if (event.type === 'step/start') {
                    if (linked.openStep !== undefined || event.data.step !== linked.lastStep + 1)
                        linked.badStep = true;
                    linked.openStep = event.data.step;
                    if (event.data.step === 1) {
                        if (linked.firstStepStartSeq !== undefined)
                            linked.badStep = true;
                        else
                            linked.firstStepStartSeq = event.seq;
                    }
                }
                else {
                    if (linked.openStep !== event.data.step)
                        linked.badStep = true;
                    linked.openStep = undefined;
                    linked.lastStep = event.data.step;
                }
            }
        }
        else if (event.type === 'turn/end') {
            if (openTurn !== event.data.turn || turns.has(event.data.turn))
                invalid = true;
            const startSeq = turnStarts.get(event.data.turn), linked = startSeq === undefined ? undefined : linkedTurns.get(startSeq);
            if (linked?.openStep !== undefined)
                linked.badStep = true;
            const reason = event.data.reason;
            turns.set(event.data.turn, { kind: reason.kind,
                ...(reason.kind === 'aborted' ? { cancelKind: reason.reason.kind,
                    ...(reason.reason.kind === 'hook' ? { hookReasonSha256: nativeInputSha256(reason.reason.reason),
                        ...(reason.reason.reason === INPUT_ADMISSION_ABORT_REASON ? { preAdmission: true } : {}) } : {}) } : {}) });
            openTurn = undefined;
        }
        else if (event.type === 'agent/inbox/spliced') {
            revision = event.seq;
            const splice = event.data, queue = queues[splice.target], count = splice.removedCount ?? 0;
            if (!queue || !Number.isSafeInteger(splice.start) || splice.start < 0 || splice.start > queue.length
                || !Number.isSafeInteger(count) || count < 0 || splice.start + count > queue.length) {
                invalid = true;
                continue;
            }
            for (const [index, entry] of queue.slice(splice.start, splice.start + count).entries()) {
                if (splice.outcome === 'canceled')
                    entry.cancelledSeq = event.seq;
                else {
                    entry.claimSeq = event.seq;
                    entry.claimIndex = index;
                    entry.turn = openTurn;
                }
            }
            const inserted = splice.inserted.map(message => {
                const ref = { sessionId, insertSeq: event.seq, messageId: message.id, messageSha256: nativeInputSha256(message) };
                const entry = { ref, message, inherited: event.seq < inheritedBoundary };
                if (entries.has(refKey(ref)))
                    invalid = true;
                entries.set(refKey(ref), entry);
                return entry;
            });
            queue.splice(splice.start, count, ...inserted);
            const ids = [...queues['next-turn'], ...queues['next-step']].map(entry => entry.message.id);
            if (new Set(ids).size !== ids.length)
                invalid = true;
        }
        else if (event.type === 'user/message') {
            if (openTurn !== undefined)
                turnsWithUsers.add(openTurn);
            const sameId = [...entries.values()].filter(entry => entry.ref.messageId === event.data.id);
            const fingerprint = nativeInputSha256(event.data);
            for (const entry of sameId)
                if (entry.ref.messageSha256 !== fingerprint)
                    entry.conflict = true;
            const matching = sameId.filter(entry => entry.ref.messageSha256 === fingerprint);
            if (matching.length > 1)
                for (const entry of matching)
                    entry.conflict = true;
            if (matching.length === 1) {
                const entry = matching[0];
                if (!entry) {
                    invalid = true;
                    continue;
                }
                if (entry.userSeq !== undefined || entry.cancelledSeq !== undefined || entry.claimSeq === undefined)
                    entry.conflict = true;
                entry.userSeq = event.seq;
                entry.userTurn = openTurn;
            }
        }
    }
    const sameRefs = (left, right) => nativeInputSha256(left) === nativeInputSha256(right);
    const proofAt = (startSeq, requireStep = true) => {
        const linked = linkedTurns.get(startSeq), marker = linked?.marker;
        if (invalid || !linked || !marker)
            return undefined;
        // Walk actual previous starts rather than recurse on caller metadata. This
        // fold is temporary history interpretation, not a second driver queue.
        let current = linked;
        const visited = new Set();
        while (true) {
            const currentMarker = current.marker;
            if (!currentMarker || current.startSeq < inheritedBoundary || visited.has(current.startSeq) || current.badStep
                || (current !== linked || requireStep) && current.firstStepStartSeq === undefined)
                return undefined;
            visited.add(current.startSeq);
            if (currentMarker.mode === 'claim')
                break;
            if (currentMarker.previousStartSeq >= current.startSeq
                || current.previousActualStartSeq !== currentMarker.previousStartSeq)
                return undefined;
            const previous = linkedTurns.get(currentMarker.previousStartSeq), previousMarker = previous?.marker;
            if (!previous || !previousMarker || previousMarker.workSha256 !== currentMarker.workSha256
                || !sameRefs(previousMarker.refs, currentMarker.refs)
                || nativeInputSha256(previousMarker.preparation) !== nativeInputSha256(currentMarker.preparation)
                || !turns.get(previous.turn)?.preAdmission || turnsWithUsers.has(previous.turn))
                return undefined;
            current = previous;
        }
        if (!current.proposalMatches || current.firstStepStartSeq === undefined)
            return undefined;
        const original = [...entries.values()].filter(entry => entry.turn === current.turn
            && entry.claimSeq !== undefined && entry.claimSeq > current.startSeq && entry.claimSeq < current.firstStepStartSeq)
            .sort((left, right) => left.claimSeq - right.claimSeq || left.claimIndex - right.claimIndex);
        if (!sameRefs(original.map(entry => entry.ref), marker.refs))
            return undefined;
        if (original.length !== marker.refs.length || original.some(entry => entry.inherited || entry.conflict
            || entry.cancelledSeq !== undefined || entry.claimSeq === undefined || entry.claimSeq < inheritedBoundary))
            return undefined;
        const firstStepStartSeq = linked.firstStepStartSeq ?? -1;
        return { entries: original, receipt: { schemaVersion: 1, sessionId, workSha256: marker.workSha256,
                preparation: marker.preparation, refs: marker.refs, actualTurn: linked.turn, startSeq,
                firstStepStartSeq, claimSpliceSeqs: [...new Set(original.map(entry => entry.claimSeq))] } };
    };
    const durableWork = (selector) => {
        let preparation, refs;
        try {
            preparation = nativePreparationReceipt(selector?.preparation);
            refs = linkRefs(selector?.refs, sessionId);
        }
        catch { }
        if (!preparation || !refs)
            return { status: 'unknown', code: 'INPUT_LINK_SELECTOR_INVALID' };
        const workSha256 = nativeInputWorkSha256(sessionId, preparation, refs);
        const latest = [...turnStarts.values()].at(-1), proof = latest === undefined ? undefined : proofAt(latest);
        if (!proof || proof.receipt.workSha256 !== workSha256 || !sameRefs(proof.receipt.refs, refs)) {
            return { status: 'unknown', code: 'INPUT_LINK_HISTORY_UNKNOWN' };
        }
        const closedReason = turns.get(proof.receipt.actualTurn);
        if (!closedReason || openTurn !== undefined)
            return { status: 'unknown', code: 'INPUT_LINK_OPEN_TURN' };
        if (turnsWithUsers.has(proof.receipt.actualTurn)) {
            if (!proof.entries.every(entry => entry.userTurn === proof.receipt.actualTurn && entry.userSeq !== undefined)) {
                return { status: 'unknown', code: 'INPUT_LINK_OTHER_ADMISSION' };
            }
            return { status: 'admitted', receipt: proof.receipt, closedReason };
        }
        if (closedReason.kind === 'aborted' && ['user', 'parent', 'disposed'].includes(closedReason.cancelKind ?? '')) {
            return { status: 'cancelled', receipt: proof.receipt, closedReason };
        }
        if (!closedReason.preAdmission)
            return { status: 'unknown', code: 'INPUT_LINK_CLOSE_NOT_PROVEN' };
        return { status: 'recoverable', receipt: proof.receipt, closedReason };
    };
    const ownership = (ref) => {
        if (!validRef(ref))
            return { status: 'unknown', ref, code: 'INPUT_REF_INVALID' };
        const entry = entries.get(refKey(ref));
        if (ref.sessionId !== sessionId || !entry || invalid || entry.conflict)
            return { status: 'unknown', ref, code: 'INPUT_HISTORY_UNKNOWN' };
        if (entry.inherited || entry.claimSeq !== undefined && entry.claimSeq < inheritedBoundary) {
            return { status: 'unknown', ref, code: 'INPUT_INHERITED_OWNERSHIP_UNPROVEN' };
        }
        const entryStart = entry.turn === undefined ? undefined : turnStarts.get(entry.turn);
        const linked = entryStart === undefined ? undefined : linkedTurns.get(entryStart);
        if (linked?.present && !linked.marker)
            return { status: 'unknown', ref, code: 'INPUT_LINK_METADATA_UNKNOWN' };
        if (entry.userSeq !== undefined)
            return { status: 'admitted', ref, userSeq: entry.userSeq, turn: entry.userTurn };
        if (entry.cancelledSeq !== undefined)
            return { status: 'cancelled', ref, cancelSeq: entry.cancelledSeq };
        for (const target of ['next-turn', 'next-step']) {
            const index = queues[target].indexOf(entry);
            if (index >= 0)
                return { status: 'pending', ref, target, index };
        }
        const closedReason = entry.turn === undefined ? undefined : turns.get(entry.turn);
        if (!closedReason)
            return { status: 'unknown', ref, code: 'INPUT_OPEN_OR_UNATTRIBUTED_TURN' };
        if (closedReason.kind === 'aborted' && ['user', 'parent', 'disposed'].includes(closedReason.cancelKind ?? '')) {
            return { status: 'cancelled', ref, cancelSeq: entry.claimSeq, closedReason };
        }
        if (entry.turn !== undefined && turnsWithUsers.has(entry.turn)) {
            return { status: 'unknown', ref, code: 'INPUT_TURN_HAS_OTHER_ADMISSION', closedReason };
        }
        // A zero-insertion resumed turn leaves no new inbox claim linkage. Once
        // another turn exists, an old gate reason cannot attest that later work
        // stopped safely. Core durable ownership is outside this history format.
        if (entry.claimSeq !== undefined && [...turnStarts.values()].some(seq => seq > entry.claimSeq)) {
            return { status: 'unknown', ref, code: 'INPUT_LATER_TURN_NOT_BOUND', closedReason };
        }
        if (closedReason.preAdmission && entry.turn !== undefined && entry.claimSeq !== undefined) {
            return { status: 'claimed-before-admission', ref, turn: entry.turn, claimSeq: entry.claimSeq, closedReason };
        }
        return { status: 'unknown', ref, code: 'INPUT_CLOSED_WITHOUT_ADMISSION_PROOF', closedReason };
    };
    return { revision, pending: queues, ownership, durableWork, linkReceipt(startSeq) {
            if ([...turnStarts.values()].at(-1) !== startSeq)
                return undefined;
            return proofAt(startSeq)?.receipt;
        }, resumeLinked(receipt) {
            const lookup = durableWork(receipt);
            if (lookup.status !== 'recoverable' || nativeInputSha256(lookup.receipt) !== nativeInputSha256(receipt))
                return undefined;
            const proof = proofAt(receipt.startSeq);
            return proof && { turn: receipt.actualTurn, messages: proof.entries.map(entry => structuredClone(entry.message)) };
        }, ownsClaim(claim) {
            if (invalid || !claim.refs.length || claim.refs.length !== claim.messages.length
                || [...turnStarts.keys()].at(-1) !== claim.turn)
                return false;
            if (claim.resumed && claim.linkStartSeq !== undefined) {
                const proof = proofAt(claim.linkStartSeq, false);
                if (!proof || proof.receipt.actualTurn !== claim.turn || !sameRefs(proof.receipt.refs, claim.refs))
                    return false;
            }
            return claim.refs.every((ref, index) => {
                if (!validRef(ref) || ref.sessionId !== sessionId)
                    return false;
                const entry = entries.get(refKey(ref));
                if (!entry || entry.inherited || entry.conflict || entry.cancelledSeq !== undefined || entry.claimSeq === undefined
                    || entry.claimSeq < inheritedBoundary
                    || nativeInputSha256(claim.messages[index]) !== entry.ref.messageSha256)
                    return false;
                if (!claim.resumed)
                    return entry.turn === claim.turn && claim.spliceSeqs.includes(entry.claimSeq);
                return entry.turn !== undefined && turns.get(entry.turn)?.preAdmission === true && !turnsWithUsers.has(entry.turn);
            });
        }, resume(refs) {
            if (!Array.isArray(refs) || !refs.length || refs.some(ref => !validRef(ref))
                || new Set(refs.map(refKey)).size !== refs.length || new Set(refs.map(ref => ref.messageId)).size !== refs.length)
                return undefined;
            const claims = refs.map(ownership);
            if (claims.some(claim => claim.status !== 'claimed-before-admission'))
                return undefined;
            const turnsOwned = claims.map(claim => claim.status === 'claimed-before-admission' ? claim.turn : undefined);
            if (new Set(turnsOwned).size !== 1)
                return undefined;
            // Resume the complete original claimed work, never a convenient subset.
            const turn = turnsOwned[0];
            const original = [...entries.values()].filter(entry => entry.turn === turn)
                .sort((left, right) => left.claimSeq - right.claimSeq || left.claimIndex - right.claimIndex);
            if (original.length !== refs.length || original.some((entry, index) => refKey(entry.ref) !== refKey(refs[index])))
                return undefined;
            return { turn, messages: original.map(entry => structuredClone(entry.message)) };
        } };
}
