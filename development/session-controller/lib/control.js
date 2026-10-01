// Generated from runtime/alpha3/compat/session-controller/src/control.ts; edit the TypeScript source.
/** Live Session projection state with reconnect baselines. */
import { Deque } from '@deepseek-ai/dsh-deque';
/** Owns the Host-wide Session control stream. */
export class SessionControlController {
    ctx;
    streams = new Set();
    /** @param ctx - Host context carrying live Agent and projection services. */
    constructor(ctx) {
        this.ctx = ctx;
        ctx.sessionProjections.onChanged((session, key, value, seq) => {
            this.broadcast({
                type: 'projection',
                sessionId: session.id,
                key,
                value: value,
                seq,
            });
        });
        ctx.effect(() => () => {
            for (const stream of this.streams)
                stream.end();
            this.streams.clear();
        }, 'session-controller.control');
    }
    /**
     * Open one generation of Host-wide live control state.
     * @param signal - Remote stream cancellation.
     * @returns one complete baseline followed by live replacement frames.
     */
    async *control(signal) {
        signal.throwIfAborted();
        const queue = new ControlQueue();
        this.streams.add(queue);
        try {
            yield { type: 'baseline', value: this.baseline() };
            yield* queue.iterate(signal);
        }
        finally {
            this.streams.delete(queue);
            queue.end();
        }
    }
    baseline() {
        const sessions = this.ctx.sessions.list();
        return {
            projections: this.projectionBaseline(sessions),
        };
    }
    projectionBaseline(sessions) {
        const blocks = Object.create(null);
        for (const session of sessions) {
            const snapshot = this.ctx.sessionProjections.snapshot(session);
            blocks[session.id] = {
                asOfSeq: snapshot.asOfSeq,
                // Every projection definition validates its value before snapshot publication.
                values: snapshot.values,
            };
        }
        return blocks;
    }
    broadcast(frame) {
        for (const stream of this.streams)
            stream.push(frame);
    }
}
class ControlQueue {
    buffer = new Deque();
    wake;
    done = false;
    push(frame) {
        if (this.done)
            return;
        this.buffer.pushBack(frame);
        const wake = this.wake;
        this.wake = undefined;
        wake?.();
    }
    end() {
        if (this.done)
            return;
        this.done = true;
        const wake = this.wake;
        this.wake = undefined;
        wake?.();
    }
    async *iterate(signal) {
        const onAbort = () => { this.end(); };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
            while (!this.done && !signal.aborted) {
                const frame = this.buffer.popFront();
                if (frame !== undefined) {
                    yield frame;
                    continue;
                }
                await new Promise((resolve) => { this.wake = resolve; });
            }
            while (this.buffer.size > 0 && !signal.aborted)
                yield this.buffer.popFront();
        }
        finally {
            signal.removeEventListener('abort', onAbort);
            this.end();
        }
    }
}
