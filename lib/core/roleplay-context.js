// Generated from runtime/alpha3/src/core/roleplay-context.ts; edit the TypeScript source.
import { fenceCardContent } from './tavern-card.js';
import { randomUUID } from 'node:crypto';
import { internalTaskSeqs, taskStorySeqs } from './tavern-tasks.js';
import { taskProjectionEvents } from './tavern-task-context.js';
import { textOf, estimateTokens, sha256 } from './roleplay-data.js';
export function assertWorkspaceSession(session) {
    if (typeof session.header?.cwd !== 'string' || !session.header.cwd)
        throw new Error('会话工作目录不可用');
}
export function eventsOf(session) {
    if (Array.isArray(session?.events))
        return session.events;
    if (Array.isArray(session?.log))
        return session.log;
    return [];
}
export function lastSeq(session) {
    if (Number.isSafeInteger(session?.seq))
        return Number(session.seq) - 1;
    const events = eventsOf(session);
    return events.length > 0 ? events.length - 1 : -1;
}
// ── 表面折叠（正文原文窗口）──────────────────────────────────────────────────
/**
 * 按模型真实可见的 surface 顺序读取当前分支正文。
 *
 * Session 的 log 是不可变审计日志：被重生、删除或分支切换遮蔽的旧消息仍会
 * 永久留在其中。剧情回忆、记忆、导出若扫描整个 log，就会把未选分支重新
 * 混回正史。`session.surface.nodes` 才是下一次请求真正会发送的唯一投影。
 */
export function surfaceEvents(session) {
    const log = eventsOf(session);
    const nodes = session?.surface?.nodes;
    if (!log.length || !nodes || typeof nodes[Symbol.iterator] !== 'function')
        return [];
    const out = [];
    for (const seq of nodes) {
        const e = log[Number(seq)];
        if (e)
            out.push(e);
    }
    return out;
}
// Only ephemeral Phase-A projections are superseded. Replacing each exact
// source node preserves native request reconstruction and every audit event;
// no story/tool range is flattened and current fixed settings stay complete.
// Keep identical author system sections byte-identical across requests. The
// content-derived fence belongs to this exact content, not to a model step or
// process. Bound memoization without changing rendered bytes on eviction.
export const promptSafeAuthorText = (text) => String(text).replace(/\{\{(?:user|user_gender|char)\}\}|\{\{|\}\}/g, token => token === '{{' ? '⟦' : token === '}}' ? '⟧' : token);
export function createStableRoleplayFence() {
    const entries = new Map();
    let size = 0;
    return (body, kind) => {
        const key = sha256(`${kind}\0${body}`), cached = entries.get(key);
        if (cached) {
            entries.delete(key);
            entries.set(key, cached);
            return cached;
        }
        const fenced = fenceCardContent(promptSafeAuthorText(body), kind, { stable: true });
        entries.set(key, fenced);
        size += fenced.length;
        while (entries.size > 64 || size > 8_000_000) {
            const oldest = entries.keys().next().value;
            size -= entries.get(oldest).length;
            entries.delete(oldest);
        }
        return fenced;
    };
}
export function readRoleplayActivity(session, preparation, jobs = [], now = Date.now()) {
    const events = eventsOf(session), startIndex = events.findLastIndex(e => e.type === 'turn/start'), start = events[startIndex], turn = start?.data?.turn ?? null;
    // Read the current turn once without copying its potentially large chunk
    // tail. Keep the latest marker of each kind, including unexposed phases.
    let end;
    let phase;
    let step;
    let proof;
    for (let index = events.length - 1; startIndex >= 0 && index > startIndex; index--) {
        const event = events[index];
        const type = event.type;
        if (!end && type === 'turn/end' && event.data?.turn === turn)
            end = event;
        if (!step && type === 'step/start')
            step = event;
        if (type === 'user/message') {
            const source = event.data?.source;
            if (!phase && source?.plugin === 'roleplay-tasks' && source.form === 'phase')
                phase = event;
            if (!proof && source?.kind === 'plugin' && source.plugin === 'roleplay-tasks' &&
                source.stage === 'after-story' && Number.isSafeInteger(source.storySeq))
                proof = event;
        }
        if (end && phase && step && proof)
            break;
    }
    // Quiet notes may span turns; they never extend the player's foreground wait.
    const backgroundJobs = [];
    const work = [];
    for (const job of jobs) {
        if (job.sessionId !== session.id || (job.status !== 'queued' && job.status !== 'running'))
            continue;
        if (job.background === true)
            backgroundJobs.push(job);
        else if (Number(job.createdAt) >= (start?.time ?? 0))
            work.push(job);
    }
    const running = Boolean(start && !end || work.some(j => j.execution === 'spawn' && j.status === 'running'));
    const admitted = phase?.data?.source?.stage === 'story' || phase?.data?.source?.stage === 'after-story';
    const preparing = !admitted && preparation?.sessionId === session.id && preparation.turn === turn && preparation.status === 'preparing';
    const original = preparing ? preparation.messages?.findLast(m => m.role === 'user' && m.source?.kind === 'user') : null;
    const visibleNodes = new Set(session?.surface?.nodes ?? []);
    let observed = false;
    if (original && startIndex >= 0) {
        for (let index = startIndex + 1; index < events.length; index++) {
            const event = events[index];
            if (visibleNodes.has(event.seq) && event.type === 'user/message' &&
                event.data?.id === original.id && event.data?.source?.kind === 'user') {
                observed = true;
                break;
            }
        }
    }
    const pendingPlayer = original && !observed ? { messageId: original.id, text: textOf(original.content), attachmentCount: (original.content ?? []).filter(b => b.type === 'image').length, time: preparation?.createdAt } : null;
    let stage = !running ? 'done' : preparing ? 'prepare' : phase?.data?.source?.stage === 'story' ? 'story' : work.some(j => j.kind === 'memory') ? 'memory' : work.some(j => j.kind === 'status') ? 'status' : work.some(j => j.kind === 'decision') ? 'decision' : phase ? 'management' : 'story';
    if (!running && (pendingPlayer || work.length))
        stage = 'paused';
    const stepNumber = step?.data?.step;
    const storyStep = running && !end && stage === 'story' && phase?.data?.source?.stage === 'story' && typeof stepNumber === 'number' && Number.isSafeInteger(stepNumber) ? stepNumber : null;
    const proofBody = proof ? events[proof.data.source.storySeq] : undefined;
    const provenSeq = proofBody?.type === 'assistant/message' && proofBody.data?.turn === turn && visibleNodes.has(proofBody.seq) ? proofBody.seq : null;
    return { schemaVersion: 1, sessionId: session.id, turn, running, stage, startedAt: start?.time ?? null,
        phaseSeq: phase?.seq ?? null, storyStep,
        elapsedMs: start ? Math.max(0, (running ? now : end?.time ?? now) - Number(start.time)) : 0, observedAt: now, pendingPlayer,
        storySeq: provenSeq ?? (end ? canonicalAssistantForTurn(session, turn)?.seq ?? null : null),
        jobs: work.map(j => ({ kind: j.kind, status: j.status, execution: j.execution })),
        backgroundJobs: backgroundJobs.map(j => ({ kind: j.kind, status: j.status, execution: j.execution, createdAt: j.createdAt })) };
}
export function retireRoleplayContexts(session, turn, prepared = []) {
    // Call only after Phase A has prepared authoritative replacements. Preserve
    // the full anchor backing an unchanged reference; never guess a replacement
    // from an unfinished preparation or remove legacy/fixed-setting injections.
    if (!session.append || !Number.isSafeInteger(turn))
        return 0;
    const visible = surfaceEvents(session);
    let retired = 0;
    for (const form of ['director-notes', 'state']) {
        const field = form === 'state' ? 'stateHash' : 'notesHash';
        const valid = (source) => source?.kind === 'plugin' && source.plugin === 'roleplay-context'
            && source.schemaVersion === 1 && source.form === form && ['full', 'reference'].includes(String(source.mode))
            && typeof source.branchId === 'string' && /^[a-f0-9]{64}$/.test(String(source[field] ?? ''));
        const next = prepared.filter(m => valid(m.source) && m.source?.branchId === session.id && textOf(m.content).trim());
        if (next.length !== 1)
            continue;
        const source = next[0].source;
        const old = visible.filter(e => e.type === 'user/message' && valid(e.data?.source));
        const backing = source.mode === 'reference' ? old.findLast(e => e.data?.source?.branchId === session.id
            && e.data.source.mode === 'full' && e.data.source[field] === source[field]) : undefined;
        if (source.mode === 'reference' && !backing)
            continue;
        for (const event of old) {
            if (event === backing)
                continue;
            session.append('user/message', { id: randomUUID(), role: 'user', source: { kind: 'plugin', plugin: 'roleplay-context', form: 'retired', schemaVersion: 1,
                    retiredForm: form, retiredAtTurn: turn, branchId: session.id, sourceSeq: event.seq }, content: [{ type: 'text', text: '[旧动态上下文已回收；以当前锚点为准。]' }] }, { surfaceOp: { op: 'replace', start: event.seq, end: event.seq }, sourceEventSeqs: [event.seq] });
            retired++;
        }
    }
    return retired;
}
export function surfaceEntries(session) {
    const surface = surfaceEvents(session);
    const internal = internalTaskSeqs(session);
    const committedStory = taskStorySeqs(session);
    const completed = new Set(surface
        .filter((event) => isCompletedTurnEnd(event))
        .map((event) => Number(event.data?.turn))
        .filter(Number.isSafeInteger));
    // One turn may contain several assistant/message events (tool preambles,
    // retries, and the final prose). Expose only the last visible, non-interrupted
    // prose message for that turn. The audit log still retains every event.
    const canonicalByTurn = new Map();
    for (const event of surface) {
        if (event?.type !== 'assistant/message' || event.data?.interrupted === true || internal.has(event.seq))
            continue;
        const text = textOf(event.data?.message?.content);
        if (!text.trim())
            continue;
        const turn = Number(event.data?.turn);
        const key = Number.isSafeInteger(turn) ? turn : `seq:${event.seq}`;
        if (completed.size === 0 || completed.has(turn) || committedStory.has(event.seq) || !Number.isSafeInteger(turn))
            canonicalByTurn.set(key, event);
    }
    const out = [];
    for (const e of surface) {
        if (e.type === 'user/message') {
            if (internal.has(e.seq))
                continue;
            const src = e.data?.source;
            // 普通玩家输入，以及分支投影中按原文恢复的玩家输入；后台上下文、
            // compact checkpoint、重生指令和工具材料都不属于剧情正文。
            if (src?.kind !== 'user' && !(src?.kind === 'plugin' && src?.plugin === 'roleplay' && src?.form === 'branch-user'))
                continue;
            const text = textOf(e.data?.content);
            if (text.trim())
                out.push({
                    seq: e.seq,
                    kind: 'user',
                    text,
                    messageId: String(e.data?.id ?? ''),
                    time: Number(e.time) || 0,
                });
        }
        else if (e.type === 'assistant/message') {
            const text = textOf(e.data?.message?.content);
            const turn = Number(e.data?.turn);
            const key = Number.isSafeInteger(turn) ? turn : `seq:${e.seq}`;
            if (text.trim() && canonicalByTurn.get(key) === e)
                out.push({
                    seq: e.seq,
                    kind: 'assistant',
                    text,
                    messageId: String(e.data?.message?.id ?? ''),
                    turn: Number(e.data?.turn),
                    step: Number(e.data?.step),
                    time: Number(e.time) || 0,
                });
        }
    }
    return out;
}
export function isCompletedTurnEnd(event) {
    return event?.type === 'turn/end' && event.data?.reason?.kind === 'completed';
}
const canonicalAssistantCache = new WeakMap();
/** Native request completion only. Management replies remain excluded from story projections.
 * A terminal internal worker, hidden/empty reply or unfinished turn cannot complete a fork. */
export function completedAssistantReceiptForTurn(session, turn) {
    if (session.header?.origin === 'subagent')
        return null;
    const target = Number(turn), visible = new Set(session.surface?.nodes ?? []);
    if (!Number.isSafeInteger(target))
        return null;
    let current = null, internal = false, candidate = null, completed = false;
    for (const event of eventsOf(session)) {
        if (event.type === 'turn/start') {
            current = Number(event.data?.turn);
            internal = false;
            if (current === target) {
                candidate = null;
                completed = false;
            }
        }
        if (current !== target)
            continue;
        const source = event.type === 'user/message' ? event.data?.source : null;
        if (source?.kind === 'plugin' && source.plugin === 'roleplay-tasks' && source.form === 'phase')
            internal = source.stage !== 'story';
        if (event.type === 'assistant/message' && Number(event.data?.turn) === target) {
            const message = event.data?.message;
            candidate = !internal && visible.has(event.seq) && event.data?.interrupted !== true && message?.id
                && !(message.content ?? []).some(block => block.type === 'tool-call') && textOf(message.content).trim() ? event : null;
        }
        if (event.type === 'turn/end') {
            completed = isCompletedTurnEnd(event);
            current = null;
        }
    }
    return completed ? candidate : null;
}
export function canonicalAssistantForTurn(session, turn) {
    const raw = eventsOf(session), nodes = Array.from(session?.surface?.nodes ?? []), surfaceKey = nodes.join(',');
    const cached = canonicalAssistantCache.get(session);
    if (cached?.raw === raw && cached.rawLength === raw.length && cached.rawLast === raw.at(-1) && cached.surfaceKey === surfaceKey)
        return cached.byTurn.get(Number(turn)) ?? null;
    const events = taskProjectionEvents(session);
    if (cached?.events === events && cached.length === events.length && cached.last === events.at(-1) && cached.surfaceKey === surfaceKey)
        return cached.byTurn.get(Number(turn)) ?? null;
    const completed = new Set(events.filter(isCompletedTurnEnd).map(e => Number(e.data?.turn)));
    const internal = internalTaskSeqs(session);
    const committedStory = taskStorySeqs(session);
    const visible = new Set(nodes.map(Number)), byTurn = new Map();
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index], numericTurn = Number(event?.data?.turn);
        if (event?.type !== 'assistant/message' || byTurn.has(numericTurn))
            continue;
        if (!visible.has(Number(event.seq)) || event.data?.interrupted === true || internal.has(event.seq))
            continue;
        if (!completed.has(numericTurn) && !committedStory.has(event.seq))
            continue;
        if (textOf(event.data?.message?.content).trim())
            byTurn.set(numericTurn, event);
    }
    canonicalAssistantCache.set(session, { events, length: events.length, last: events.at(-1), raw, rawLength: raw.length, rawLast: raw.at(-1), surfaceKey, byTurn });
    return byTurn.get(Number(turn)) ?? null;
}
export function visibleCompactionCheckpoint(session) {
    for (const event of [...surfaceEvents(session)].reverse()) {
        if (event?.type !== 'user/message' || event.data?.source?.kind !== 'plugin' || event.data?.source?.plugin !== 'compact')
            continue;
        const raw = textOf(event.data?.content);
        const match = raw.match(/<compacted-summary>\s*([\s\S]*?)\s*<\/compacted-summary>/i);
        if (match?.[1]?.trim())
            return { text: match[1].trim(), seq: Number(event.seq) };
    }
    return null;
}
/** 最近 ~budgetTokens 的正文窗口（拼接文本）。 */
export function recentWindow(session, budgetTokens) {
    const entries = surfaceEntries(session);
    const picked = [];
    let used = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
        const cost = estimateTokens(entries[i].text);
        if (used + cost > budgetTokens && picked.length > 0)
            break;
        picked.push(entries[i]);
        used += cost;
        if (used >= budgetTokens)
            break;
    }
    picked.reverse();
    return picked.map((e) => `[seq ${e.seq}] (${e.kind === 'user' ? '用户' : '正文'})\n${e.text}`).join('\n\n');
}
/**
 * Read only the selected branch's story after a roleplay context-window
 * boundary.  The append-only session log remains the source of truth; this
 * projection is deliberately suffix-only so a sibling branch can never leak
 * into the new model-visible window.
 */
export function recentWindowSince(session, startSeq, budgetTokens) {
    const boundary = Number.isSafeInteger(Number(startSeq)) ? Number(startSeq) : -1;
    const entries = surfaceEntries(session).filter((entry) => Number(entry.seq) > boundary);
    const picked = [];
    let used = 0;
    for (let index = entries.length - 1; index >= 0; index -= 1) {
        const cost = estimateTokens(entries[index].text);
        if (picked.length > 0 && used + cost > budgetTokens)
            break;
        picked.push(entries[index]);
        used += cost;
        if (used >= budgetTokens)
            break;
    }
    picked.reverse();
    return picked.map((entry) => `[seq ${entry.seq}] (${entry.kind === 'user' ? '用户' : '正文'})\n${entry.text}`).join('\n\n');
}
function roleplayMessageText(message) {
    return Array.isArray(message?.content)
        ? message.content.filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n')
        : '';
}
function roleplayMessageIsStory(message) {
    if (!message || typeof message !== 'object')
        return false;
    // Assistant messages carry provider/model metadata rather than a
    // `source.kind === "model"` marker in Harness. Treat every assistant
    // message as narrative here; tool calls/results remain separate messages.
    if (message.role === 'assistant')
        return true;
    return message.role === 'user' && message.source?.kind === 'user';
}
/**
 * Keep fixed roleplay injections plus the newest complete story tail.  This
 * intentionally differs from Codex's empty new-context window: RP needs the
 * latest prose to preserve voice, active gestures, and immediate state-bar
 * continuity.  Historical messages remain durable and are recalled through
 * rp_history instead of being silently deleted.
 */
function retainRoleplayContinuityTail(messages, budgetTokens) {
    const list = Array.isArray(messages) ? messages : [];
    const story = list.filter(roleplayMessageIsStory);
    const keep = new Set();
    let used = 0;
    for (let index = story.length - 1; index >= 0; index -= 1) {
        const cost = estimateTokens(roleplayMessageText(story[index]));
        if (keep.size > 0 && used + cost > budgetTokens)
            break;
        keep.add(story[index]);
        used += cost;
    }
    return list.filter((message) => !roleplayMessageIsStory(message) || keep.has(message));
}
function messageIdOf(message) {
    const value = message?.id ?? message?.message?.id;
    return value === undefined || value === null ? '' : String(value);
}
function internalMaintenanceMessageIds(session) {
    const ids = new Set(), calls = new Set();
    const events = eventsOf(session), internal = internalTaskSeqs(session);
    let inMaintenance = false;
    for (const event of events) {
        if (event?.type === 'turn/start' || event?.type === 'turn/end')
            inMaintenance = false;
        const source = event?.type === 'user/message' ? event.data?.source : null;
        if (source?.kind === 'plugin' && source.plugin === 'roleplay-tasks' && source.form === 'phase') {
            inMaintenance = source.stage !== 'story';
        }
        if (event?.type === 'assistant/message' && internal.has(Number(event.seq))) {
            const id = messageIdOf(event.data?.message);
            if (id)
                ids.add(id);
            for (const block of event.data?.message?.content ?? []) {
                if (block?.type === 'tool-call' && block.id !== undefined && block.id !== null)
                    calls.add(String(block.id));
            }
        }
        if (inMaintenance && event?.type === 'tool/call') {
            const callId = event.data?.callId ?? event.data?.id;
            if (callId !== undefined && callId !== null)
                calls.add(String(callId));
        }
    }
    for (const event of events) {
        if (event?.type !== 'tool/result')
            continue;
        const callId = event.data?.message?.source?.callId ?? event.data?.callId;
        if (callId === undefined || callId === null || !calls.has(String(callId)))
            continue;
        const id = messageIdOf(event.data?.message);
        if (id)
            ids.add(id);
    }
    return { ids, calls };
}
/** The hard-window tail contains prose plus selected player context only.
 * Internal results are identified from durable phase/call provenance, never text. */
export function retainRoleplayWindowContinuity(session, messages, budgetTokens) {
    const maintenance = internalMaintenanceMessageIds(session);
    const list = Array.isArray(messages) ? messages : [];
    const selected = list.filter((message) => {
        const source = message?.source;
        if (source?.kind === 'plugin' && (source.plugin === 'roleplay-tasks' || source.plugin === 'roleplay-context'))
            return false;
        const id = messageIdOf(message);
        if (id && maintenance.ids.has(id))
            return false;
        const callId = source?.callId ?? message?.callId;
        if (callId !== undefined && callId !== null && maintenance.calls.has(String(callId)))
            return false;
        // A tool-call assistant message cannot be carried without its paired tool
        // result. This window needs prose continuity, so retain neither half.
        if ((message?.content ?? []).some((block) => block?.type === 'tool-call' || block?.type === 'tool-result'))
            return false;
        return roleplayMessageIsStory(message);
    });
    return retainRoleplayContinuityTail(selected, budgetTokens);
}
/** Include only contiguous old-window roleplay anchors immediately before the
 * first evicted player/body node; cards and user facts remain untouched. */
export function roleplayWindowCutStartIndex(surface, storyStartIndex) {
    let index = Math.max(0, Number(storyStartIndex) || 0);
    while (index > 0) {
        const event = surface[index - 1];
        const source = event?.type === 'user/message' ? event.data?.source : null;
        if (source?.kind !== 'plugin' || source.plugin !== 'roleplay-context')
            break;
        index -= 1;
    }
    return index;
}
/** 指定 seq 集合的表面原文（供记忆引擎压缩时取文）。 */
export function surfaceTextForSeqs(session, seqs) {
    const want = new Set(seqs);
    const parts = [];
    for (const e of surfaceEntries(session)) {
        if (want.has(e.seq))
            parts.push(e.text);
    }
    return parts.join('\n\n');
}
