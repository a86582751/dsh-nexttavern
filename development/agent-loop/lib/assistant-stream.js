// Generated from runtime/alpha3/compat/agent-loop/src/assistant-stream.ts; edit the TypeScript source.
/** Process-local assistant attempt framing and durable stream accumulation. */
import { AssistantStreamAccumulator, BlockAssembler, LlmAttemptId, } from '@deepseek-ai/dsh-llm';
/** Folds one model attempt into one compact stream plus ordered transient frames. */
export class AssistantStreamAttempt {
    nextRevision;
    turn;
    step;
    emit;
    accumulator = new AssistantStreamAccumulator();
    assembler = new BlockAssembler();
    index = 0;
    terminal = false;
    /** Attempt identity unique within this Agent lifecycle. */
    attemptId;
    /** Whether this started attempt has emitted its terminal frame. */
    get ended() { return this.terminal; }
    /**
     * @param sessionId - identity embedded only in the Agent-lifecycle-local attempt id.
     * @param attempt - attached-Session-local attempt counter.
     * @param nextRevision - allocates the next emitted frame revision.
     * @param turn - durable turn owning the request.
     * @param step - durable step owning the request.
     * @param emit - agent-scoped notification publisher.
     */
    constructor(sessionId, attempt, nextRevision, turn, step, emit) {
        this.nextRevision = nextRevision;
        this.turn = turn;
        this.step = step;
        this.emit = emit;
        this.attemptId = LlmAttemptId(`${sessionId}:${attempt}`);
    }
    /** Publish the opening marker before the first delivered chunk. */
    start() {
        this.emit({
            type: 'start',
            attemptId: this.attemptId,
            revision: this.nextRevision(),
            turn: this.turn,
            step: this.step,
        });
    }
    /** Snapshot one chunk once, then feed durable compaction, assembly, and live publication. */
    push(chunk) {
        const timed = this.accumulator.push({ time: Date.now(), chunk });
        this.assembler.push(timed.chunk);
        this.emit({
            type: 'chunk',
            attemptId: this.attemptId,
            revision: this.nextRevision(),
            index: this.index++,
            time: timed.time,
            chunk: timed.chunk,
        });
    }
    /**
     * Publish terminal settlement after the matching durable event commits.
     * @param eventType - durable settlement type.
     * @param append - synchronous durable append returning its committed seq.
     */
    settle(eventType, append) {
        let seq;
        try {
            seq = append();
        }
        catch (error) {
            this.abandon();
            throw error;
        }
        this.terminal = true;
        this.emit({
            type: 'end',
            attemptId: this.attemptId,
            revision: this.nextRevision(),
            index: this.index,
            outcome: { kind: 'committed', eventType, seq },
        });
    }
    /** Publish abandonment when no durable attempt event can be committed. */
    abandon() {
        this.terminal = true;
        this.emit({
            type: 'end',
            attemptId: this.attemptId,
            revision: this.nextRevision(),
            index: this.index,
            outcome: { kind: 'abandoned' },
        });
    }
    /** Exact compact stream for the final durable event. */
    get stream() {
        return [...this.accumulator.snapshot()];
    }
    /** Canonical completed-message blocks from the same chunks. */
    blocks() {
        return this.assembler.blocks();
    }
    /** Safe visible prefix when cancellation interrupts the attempt. */
    interruptedBlocks() {
        return this.assembler.interruptedBlocks();
    }
    /** Latest adapter-reported usage in the stream. */
    get usage() {
        return this.assembler.usage;
    }
    /** Terminal reason, defaulting to stop when the stream omitted one. */
    get finish() {
        return this.assembler.finish;
    }
    /** Replay state carried by the terminal finish record. */
    get replayState() {
        return this.assembler.replayState;
    }
}
