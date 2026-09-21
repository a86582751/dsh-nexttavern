// Generated from runtime/alpha3/src/core/tavern-telemetry-fold.ts; edit the TypeScript source.
import { sessionEvents } from './session-history.js';
import { createHash } from 'node:crypto';
import { normalizeUsage as usageOf, failureText as reasonText, telemetryOutcome as outcome } from './tavern-telemetry-normalize.js';
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const events = (session) => sessionEvents(session);
/** Fold raw attempts, never the selected story surface. Seeded parent events
 * only establish lifecycle state; they never create a second charge. */
export function foldSessionCalls(session) {
    const out = [], seed = Number(session.inheritedEventCount ?? 0);
    let current = null, route = {}, phase = 'narrative';
    const finish = (time, status, error) => { if (!current)
        return; if (time != null) {
        current.completedAt = time;
        current.durationMs = Math.max(0, time - current.startedAt);
    } if (status)
        current.status = status; if (error)
        current.error = error; };
    for (const e of events(session)) {
        if (typeof e.time !== 'number' || !Number.isFinite(e.time))
            continue;
        const d = e.data ?? {};
        if (e.type === 'compaction/summary' && d.usage && !d.nativeTask && e.seq >= seed)
            out.push({ schemaVersion: 1, id: hash([session.id, 'compaction', d.compactionId ?? e.seq]), sessionId: session.id, ownerSessionId: session.id, kind: 'compaction', provider: d.provider ?? null, model: d.model ?? null, status: 'completed', startedAt: e.time, completedAt: e.time, durationMs: null, firstTokenMs: null, usage: usageOf(d.usage), source: { kind: 'compaction-summary', sessionId: session.id, startSeq: e.seq, evidenceSeq: e.seq } });
        if (e.type === 'request/header') {
            route = d.header?.config ?? route;
            if (current) {
                current.provider = route.provider ?? null;
                current.model = route.model ?? null;
            }
        }
        if (e.type === 'user/message')
            phase = d.source?.plugin === 'roleplay-tasks' ? (d.source.jobKind ?? d.source.stage ?? 'maintenance') : 'narrative';
        if (e.type === 'step/start' || e.type === 'llm/retry-started') {
            if (current?.status === 'running')
                finish(e.time, 'unknown');
            current = { schemaVersion: 1, id: hash([session.id, e.seq]), sessionId: session.id, ownerSessionId: session.id,
                provider: route.provider ?? null, model: route.model ?? null, kind: phase, status: 'running', startedAt: e.time, completedAt: null, durationMs: null, firstTokenMs: null, usage: null,
                source: { kind: 'session-attempt', sessionId: session.id, startSeq: e.seq, turn: d.turn, step: d.step, evidenceSeq: e.seq } };
            if (e.seq >= seed)
                out.push(current);
        }
        if (!current)
            continue;
        current.source.evidenceSeq = e.seq;
        if (e.type === 'tool/call' && ['rp_task_read', 'rp_task_submit'].includes(d.name)) {
            try {
                const args = (typeof d.arguments === 'string' ? JSON.parse(d.arguments) : d.arguments);
                if (typeof args?.id === 'string' && /^[a-f0-9]{64}$/.test(args.id))
                    current.source.taskIds = [...new Set([...(current.source.taskIds ?? []), args.id])];
            }
            catch { }
        }
        if (e.type === 'assistant/chunk') {
            if (['text-delta', 'reasoning-delta', 'tool-call-delta'].includes(d.chunk?.type) && current.firstTokenMs === null)
                current.firstTokenMs = Math.max(0, e.time - current.startedAt);
            if (d.chunk?.type === 'usage')
                current.usage = usageOf(d.chunk.usage);
            if (d.chunk?.type === 'finish')
                finish(e.time, outcome(d.chunk.reason), ['error', 'aborted'].includes(d.chunk.reason?.kind) ? reasonText(d.chunk.reason) : null);
        }
        if (e.type === 'assistant/message') {
            if (d.usage)
                current.usage = usageOf(d.usage);
            const actual = d.message?.source;
            if (actual?.provider)
                current.provider = actual.provider;
            if (actual?.model)
                current.model = actual.model;
            finish(e.time, ['failed', 'cancelled', 'truncated'].includes(current.status) ? current.status : d.interrupted ? 'truncated' : 'completed');
        }
        if (e.type === 'llm/retry')
            finish(e.time, 'failed', reasonText(d.failure));
        if (e.type === 'step/end') {
            if (current.status === 'running')
                finish(e.time, 'unknown');
            current = null;
        }
        if (e.type === 'turn/end') {
            if (current && current.status === 'running')
                finish(e.time, outcome(d.reason), d.reason?.kind === 'error' ? reasonText(d.reason) : null);
            current = null;
        }
    }
    return out;
}
