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
    return prefix.concat(openTurnClosers(prefix, { kind: 'forked' }));
}
