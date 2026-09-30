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
    let openTurn, revision = -1;
    let invalid = !Number.isSafeInteger(inheritedBoundary) || inheritedBoundary < 0 || inheritedBoundary > events.length;
    for (const event of events) {
        if (event.type === 'turn/start') {
            if (openTurn !== undefined || turns.has(event.data.turn))
                invalid = true;
            openTurn = event.data.turn;
            turnStarts.set(event.data.turn, event.seq);
        }
        else if (event.type === 'turn/end') {
            if (openTurn !== event.data.turn || turns.has(event.data.turn))
                invalid = true;
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
    const ownership = (ref) => {
        if (!validRef(ref))
            return { status: 'unknown', ref, code: 'INPUT_REF_INVALID' };
        const entry = entries.get(refKey(ref));
        if (ref.sessionId !== sessionId || !entry || invalid || entry.conflict)
            return { status: 'unknown', ref, code: 'INPUT_HISTORY_UNKNOWN' };
        if (entry.inherited || entry.claimSeq !== undefined && entry.claimSeq < inheritedBoundary) {
            return { status: 'unknown', ref, code: 'INPUT_INHERITED_OWNERSHIP_UNPROVEN' };
        }
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
    return { revision, pending: queues, ownership, ownsClaim(claim) {
            if (invalid || !claim.refs.length || claim.refs.length !== claim.messages.length
                || [...turnStarts.keys()].at(-1) !== claim.turn)
                return false;
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
