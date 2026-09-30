// Generated from runtime/alpha3/compat/session/src/fork.ts; edit the TypeScript source.
/**
 * Fork seed construction over an exact source-event prefix.
 * @module @deepseek-ai/dsh-session/fork
 */
import { openTurnClosers } from './repair.js';
import { SessionSeq } from './types.js';
/**
 * Copy an inclusive event prefix, mark its inherited cut, and close its open tail with forked results
 * and step/turn endings. Closed steps and turns are preserved unchanged.
 * The caller validates that the boundary is an existing contiguous event seq;
 * Session construction snapshots the borrowed events before publication.
 *
 * @param events - source log with contiguous seqs from zero.
 * @param boundary - inclusive source event seq the child inherits through.
 * @returns a new array retaining the source event objects, followed by synthetic
 *   closers outside the inherited prefix counted by `inheritedEventCount`.
 */
export function buildForkSeed(events, boundary) {
    const prefix = events.slice(0, boundary + 1);
    prefix.push({
        type: 'session/end-seed', seq: SessionSeq(boundary + 1),
        // oxlint-disable-next-line typescript/no-non-null-assertion -- the caller validated this exact source event.
        time: events[boundary].time,
        data: { inherited: true },
    });
    const seed = prefix.concat(openTurnClosers(prefix, { kind: 'forked' }));
    // A prepared cut can include queued parent input after its completed turn.
    // Preserve those source events as provenance, then cancel the pending queues
    // in the child's own suffix. Inherited refs must never become child claims.
    const pending = { 'next-turn': [], 'next-step': [] };
    for (const event of prefix) {
        if (event.type !== 'agent/inbox/spliced')
            continue;
        const splice = event.data, count = splice.removedCount ?? 0;
        if (!Object.hasOwn(pending, splice.target) || !Array.isArray(splice.inserted)
            || splice.outcome !== undefined && splice.outcome !== 'canceled'
            || !Number.isSafeInteger(splice.start) || splice.start < 0
            || !Number.isSafeInteger(count) || count < 0
            || splice.start + count > pending[splice.target].length)
            throw new Error('invalid inherited inbox splice');
        pending[splice.target] = pending[splice.target].toSpliced(splice.start, count, ...splice.inserted);
        const messages = [...pending['next-turn'], ...pending['next-step']];
        if (messages.some(message => !message || typeof message.id !== 'string' || !message.id)
            || new Set(messages.map(message => message.id)).size !== messages.length)
            throw new Error('invalid inherited inbox messages');
    }
    for (const target of ['next-step', 'next-turn']) {
        if (!pending[target].length)
            continue;
        seed.push({ type: 'agent/inbox/spliced', seq: SessionSeq(seed.length),
            time: events[boundary].time,
            data: { target, start: 0, removedCount: pending[target].length, inserted: [], outcome: 'canceled' } });
    }
    return seed;
}
