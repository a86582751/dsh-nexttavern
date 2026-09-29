// Generated from runtime/alpha3/compat/agent-loop/src/runtime-context.ts; edit the TypeScript source.
/**
 * Durable projection state for the two loop-owned surface messages the system
 * prompt plugin forms: the system prompt (surface node 0 and any in-history
 * replacement) and the dynamic runtime-context snapshot.
 * @module @deepseek-ai/dsh-agent-loop/runtime-context
 */
import { createSystemMessage, createUserMessage } from '@deepseek-ai/dsh-llm';
import { isReplacementSurfaceEvent } from '@deepseek-ai/dsh-session';
const SOURCE = 'runtime-context';
const CLEARED = 'Current runtime context: none. Earlier runtime-context snapshots no longer apply.';
function isOwned(message) {
    return message.source.kind === SOURCE;
}
function textOf(message) {
    const [block] = message.content;
    return message.content.length === 1 && block?.type === 'text' ? block.text : undefined;
}
/** Committed events from the newest backward; the restore scans stop at the first match. */
function eventsNewestFirst(session) {
    // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
    return session.snapshotEvents().toReversed();
}
/**
 * Decides how a rendered system prompt reaches the surface without owning the
 * commit. The first prompt, even empty, reserves surface node 0.
 * A capable continuing series appends changed nonempty text after the
 * cached history. An incapable route, broken series, or cleared prompt instead
 * normalizes the first system node and empties later active nodes. Dormant empty
 * tails do not supply effective text or require repeated replacements.
 */
export class SystemPromptProjection {
    session;
    constructor(session) {
        this.session = session;
    }
    /** The surviving `system/message` nodes in surface order. */
    systemNodes() {
        const nodes = [];
        for (const seq of this.session.surface.nodes) {
            // oxlint-disable-next-line typescript/no-deprecated -- Existing Session history read; migration deferred.
            const event = this.session.eventAt(seq);
            if (event?.type !== 'system/message')
                continue;
            const content = event.data.message.content;
            const text = content.length === 0 ? '' : textOf(event.data.message);
            nodes.push({ seq, text });
        }
        return nodes;
    }
    /**
     * Reconcile effective text and retained nodes with the prepared route and series.
     * @param rendered - the fully rendered system prompt; `''` when none is active.
     * @param input - the route capability and series facts for this step.
     * @returns ordered per-node updates; an empty list means no update is needed.
     */
    project(rendered, input) {
        const nodes = this.systemNodes();
        const head = nodes[0];
        if (head === undefined) {
            return [{ message: createSystemMessage(rendered), intent: { surfaceOp: 'append' } }];
        }
        const latest = nodes.findLast(node => node.text !== '') ?? head;
        if (!input.inHistory || input.startsSeries || rendered.length === 0) {
            const updates = nodes.slice(1).filter(node => node.text !== '')
                .map(node => this.replace(node.seq, ''));
            if (head.text !== rendered)
                updates.push(this.replace(head.seq, rendered));
            return updates;
        }
        if (latest.text === rendered)
            return [];
        return [{ message: createSystemMessage(rendered), intent: { surfaceOp: 'append' } }];
    }
    replace(seq, text) {
        return {
            message: createSystemMessage(text),
            intent: { surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq }, sourceEventSeqs: [seq] },
        };
    }
}
/** Tracks the last retained runtime-context snapshot without owning its commit. */
export class RuntimeContextProjection {
    /** `undefined` means no snapshot ever existed; `null` means none is retained. */
    retained;
    /**
     * Restore projection state once, then follow authoritative session events.
     * @param ctx - agent-scoped event context.
     * @param session - session receiving projected messages.
     */
    constructor(ctx, session) {
        const surface = new Set(session.surface.nodes);
        for (const event of eventsNewestFirst(session)) {
            if (event.type !== 'user/message' || !isOwned(event.data))
                continue;
            this.retained ??= null;
            if (surface.has(event.seq)) {
                this.retained = { seq: event.seq, text: textOf(event.data) };
                break;
            }
        }
        ctx.on('session/event', (subject, event) => {
            if (subject !== session)
                return;
            if (event.type === 'user/message' && isOwned(event.data)) {
                this.retained = { seq: event.seq, text: textOf(event.data) };
            }
            else if (this.retained
                && isReplacementSurfaceEvent(event)
                && event.sourceEventSeqs?.includes(this.retained.seq) === true) {
                this.retained = null;
            }
        });
    }
    /**
     * Create an uncommitted snapshot only when the retained value differs.
     * @param current - fully rendered dynamic context.
     * @param sections - named contributions that formed the current snapshot.
     * @returns a candidate user message, or `undefined` when no update is needed.
     */
    project(current, sections) {
        if (this.retained === undefined && current.length === 0)
            return;
        const snapshot = current.length === 0 ? CLEARED : current;
        if (this.retained?.text === snapshot)
            return;
        return createUserMessage({
            content: [{ type: 'text', text: snapshot }],
            // The cleared marker has no contributions left to attribute.
            source: sections.length === 0
                ? { kind: SOURCE }
                : { kind: SOURCE, form: 'snapshot', sections },
        });
    }
}
