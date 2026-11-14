// Generated from runtime/alpha3/src/core/tavern-task-context.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { createAdaptationActivityCursor, importedStoryProjection, createImportedStorySelectionCursor, createImportedStorySelectionIndex } from '../memory/memory-provenance.js';
import { createTaskRetirement, taskContextRecord } from './tavern-task-retirement.js';
import { taskHash, isInlinePending } from './tavern-task-primitives.js';
import { taskValidationFailure } from './tavern-task-support.js';
import { fenceCardContent } from './tavern-card.js';
import { sessionEvents } from './session-history.js';
export function maintenancePrompt(context, before, after, domain = 'status') {
    const promptContext = {
        schemaVersion: 1, before, context, after, domain
    };
    return {
        user: renderMaintenancePrompt(promptContext), promptContext
    };
}
function renderMaintenancePrompt(prompt, context = prompt.context) {
    return prompt.before + fenceCardContent(JSON.stringify(context), prompt.domain, {
        stable: true
    }) + prompt.after;
}
function checkedPrompt(job) {
    const value = job.promptContext;
    if (!value || value.schemaVersion !== 1 || typeof value.before !== 'string' || typeof value.after !== 'string'
        || typeof value.domain !== 'string')
        return null;
    try {
        return job.input?.user === renderMaintenancePrompt(value) ? value : null;
    }
    catch {
        return null;
    }
}
function mapPromptStrings(value, visit) {
    if (typeof value === 'string')
        return visit(value);
    if (Array.isArray(value))
        return value.map(item => mapPromptStrings(item, visit));
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapPromptStrings(item, visit)]));
    return value;
}
/** Exact leaf equality only. No fuzzy merging of facts, branch IDs or instructions. */
export function maintenanceTaskInputs(jobs, resident = []) {
    const prompts = jobs.map(checkedPrompt), counts = new Map();
    for (const prompt of prompts)
        if (prompt)
            mapPromptStrings(prompt.context, text => {
                if (text.length >= 256)
                    counts.set(text, (counts.get(text) ?? 0) + 1);
                return text;
            });
    const references = new Map(), sharedContext = [];
    for (const [text, count] of counts) {
        const present = resident.find(part => part.text.includes(text));
        if (present)
            references.set(text, {
                currentContextRef: present.name
            });
        else if (count > 1) {
            const id = `source-${sharedContext.length + 1}`;
            references.set(text, {
                sharedContextRef: id
            });
            sharedContext.push({
                id,
                text: fenceCardContent(text, 'source', {
                    stable: true
                })
            });
        }
    }
    const inputs = jobs.map((job, index) => {
        const prompt = prompts[index];
        return prompt ? {
            ...job.input,
            user: renderMaintenancePrompt(prompt, mapPromptStrings(prompt.context, text => references.get(text) ?? text))
        } : job.input;
    });
    return {
        inputs, sharedContext
    };
}
/** Scheduling/read-only setting work can accompany prose; synchronous edits are management turns. */
export function isSettingManagementCall(data) {
    if (data?.name !== 'rp_setting')
        return false;
    try {
        const args = typeof data.arguments === 'string' ? JSON.parse(data.arguments) : data.arguments;
        return !!args && typeof args === 'object' && 'action' in args
            && ['patch', 'append', 'create'].includes(String(args.action));
    }
    catch {
        return false;
    }
}
// Native Session snapshots and accepted events are immutable. Stream chunks
// never change task/story ownership; keep their append-only audit out of these
// repeatedly computed projections. Mutable legacy/test snapshots are rebuilt.
const eventProjectionCache = new WeakMap();
export function taskProjectionEvents(session) {
    const raw = sessionEvents(session), immutable = Object.isFrozen(raw), prior = immutable ? eventProjectionCache.get(session) : undefined;
    const appendOnly = !!prior && raw.length >= prior.length && raw[0] === prior.first
        && (prior.length === 0 || raw[prior.length - 1] === prior.last);
    if (appendOnly && raw.length === prior.length)
        return prior.events;
    const tail = [];
    for (let i = appendOnly ? prior.length : 0; i < raw.length; i++) {
        const e = raw[i];
        if (e && e.type !== 'assistant/chunk')
            tail.push(e);
    }
    const events = appendOnly && !tail.length ? prior.events : Object.freeze([...(appendOnly ? prior.events : []), ...tail]);
    if (immutable)
        eventProjectionCache.set(session, {
            length: raw.length, first: raw[0], last: raw.at(-1), events
        });
    return events;
}
const internalProjectionCache = new WeakMap();
const storyProjectionCache = new WeakMap();
export class InlinePending extends Error {
    code;
    jobId;
    constructor(id) {
        super('当前循环有待完成的酒馆维护任务');
        this.code = 'TAVERN_INLINE_PENDING';
        this.jobId = id;
    }
}
// InlinePending is an admission signal, not failure of the whole batch. Let
// every sibling persist its task before the pre-step snapshots the pending
// queue, so the main loop receives all compatible obligations together.
export async function awaitTaskAdmissions(jobs) {
    const results = await Promise.allSettled(jobs);
    const failure = results.find(r => r.status === 'rejected' && !isInlinePending(r.reason)) ?? results.find(r => r.status === 'rejected');
    if (failure?.status === 'rejected')
        throw failure.reason;
    return results.map(r => {
        if (r.status === 'rejected')
            throw r.reason;
        return r.value;
    });
}
export function taskPhaseMessage(stage, content, extra = {}) {
    return {
        id: randomUUID(),
        role: 'user',
        content: [{
                type: 'text', text: content
            }],
        source: {
            kind: 'roleplay-tasks',
            form: 'phase',
            schemaVersion: 1,
            stage,
            ...extra
        }
    };
}
// Small maintenance inputs are already frozen and validated by the task
// service. Deliver them whole in the existing loop instead of making the model
// spend a round trip discovering every source. Large/card/novel workflows keep
// their explicit paginated read tools; no source is shortened to fit a budget.
const INLINE_TASK_MARKER = '\n待办：\n';
const INLINE_SHARED_MARKER = '\n资料引用：currentContextRef 指当前请求已有的同名上下文，不必重读；sharedContextRef 指以下公共资料，分别应用各任务规则。\n';
export function inlineTaskEnvelope(text) {
    const start = text.indexOf(INLINE_TASK_MARKER);
    if (start < 0)
        return null;
    const payload = text.slice(start + INLINE_TASK_MARKER.length), suffix = payload.indexOf(INLINE_SHARED_MARKER);
    if (suffix < 0)
        return JSON.parse(payload);
    // Both writer values are JSON.stringify output: raw newline delimiters cannot
    // occur inside an encoded string, even when source text quotes this marker.
    // Validate the complete tail too; never retire a malformed or truncated input.
    const shared = JSON.parse(payload.slice(suffix + INLINE_SHARED_MARKER.length));
    if (!Array.isArray(shared)
        || shared.some(item => {
            const row = taskContextRecord(item);
            return !row || typeof row.id !== 'string' || typeof row.text !== 'string'
                || Object.keys(row).some(key => key !== 'id' && key !== 'text');
        }))
        throw Error('Invalid inline shared context');
    return JSON.parse(payload.slice(0, suffix));
}
export function inlineTaskInstruction(jobs, { sessionId, maxChars = 128000, resident = [] } = {}) {
    let remaining = Math.max(0, Math.min(128000, Number(maxChars) || 0));
    const eligible = jobs.filter(job => job.execution === 'inline' && ['queued', 'running'].includes(job.status)
        && (!sessionId || job.sessionId === sessionId));
    const prepared = maintenanceTaskInputs(eligible, resident);
    const compact = eligible.some(job => ['status', 'decision', 'schema-maintenance'].includes(job.kind) && checkedPrompt(job))
        && eligible.every(job => ['status', 'decision', 'memory', 'schema-maintenance'].includes(job.kind))
        && JSON.stringify(prepared).length <= remaining;
    const inputs = new Map(compact ? eligible.map((job, index) => [job.id, prepared.inputs[index]]) : []);
    if (compact)
        remaining -= JSON.stringify(prepared.sharedContext).length;
    const tasks = [];
    for (const job of jobs) {
        if (job.execution !== 'inline' || !['queued', 'running'].includes(job.status)
            || sessionId && job.sessionId !== sessionId)
            continue;
        const failure = taskValidationFailure(job);
        const task = {
            id: job.id,
            kind: job.kind,
            generation: job.generation,
            branchId: job.branchId,
            sourceHash: job.sourceHash,
            ...(failure ? {
                failure,
                remainingValidationAttempts: Math.max(0, (job.validationFailurePolicy === 'terminal' ? 1 : 3) - (job.validationFailures ?? 0))
            } : {})
        };
        const input = inputs.get(job.id) ?? job.input, text = JSON.stringify(input);
        if (['memory', 'status', 'decision', 'schema-maintenance'].includes(job.kind) && typeof text === 'string' && text.length <= remaining) {
            task.input = input;
            task.completeSource = true;
            remaining -= text.length;
        }
        else {
            task.readWith = 'rp_task_read';
            task.totalChars = text?.length ?? 0;
        }
        tasks.push(task);
    }
    return '当前是系统维护阶段，尚不能生成或续写剧情。下面 completeSource=true 的任务已经附带完整冻结来源与结果契约，不需要再次调用 rp_task_read，直接完成并用 rp_task_submit 分别提交结果。仅未附带 input 的任务需要 rp_task_read 分页完整读取。同一步可调用多个 rp_task_submit；提交参数遵循当前工具说明，每项按自己的 system 与 format 校验。不要输出维护报告或复述任务资料，不改变模型、调用 spawn 或检查实现代码。' + INLINE_TASK_MARKER + JSON.stringify(tasks) + (compact ? INLINE_SHARED_MARKER + JSON.stringify(prepared.sharedContext) : '');
}
export function inlineTaskMessages(session, stage, jobs, { force = false, maxChars, resident } = {}) {
    const content = inlineTaskInstruction(jobs, {
        sessionId: session.id, maxChars, resident
    }), instructionHash = taskHash({
        stage, content
    });
    // alpha.3 history adapter: inspect the current tail without copying the full log.
    const events = force ? [] : sessionEvents(session);
    for (let index = events.length - 1; index >= 0; index--) {
        const event = events[index];
        if (event.type === 'turn/start' || event.type === 'turn/end')
            break;
        const source = event.type === 'user/message' ? event.data?.source : null;
        if (source?.kind === 'roleplay-tasks' && source.form === 'phase') {
            if (source.stage === stage && source.instructionHash === instructionHash)
                return [];
            break;
        }
    }
    return [taskPhaseMessage(stage, content, {
            instructionHash
        })];
}
export function taskStorySeqs(session) {
    const events = taskProjectionEvents(session), previous = storyProjectionCache.get(session);
    if (previous?.events === events)
        return new Set(previous.story);
    const cursor = createTaskStoryCursor();
    for (const event of events)
        cursor.advance(event);
    const result = cursor.story;
    storyProjectionCache.set(session, {
        events, story: result
    });
    return result;
}
export function createTaskStoryCursor() {
    const story = new Set();
    return { story, advance(event) {
            const source = event.type === 'user/message' ? event.data?.source : undefined;
            if (source?.kind === 'roleplay-tasks' && source.stage === 'after-story'
                && typeof source.storySeq === 'number' && Number.isSafeInteger(source.storySeq)) {
                const changed = !story.has(source.storySeq);
                story.add(source.storySeq);
                return changed ? source.storySeq : undefined;
            }
            return undefined;
        } };
}
/** One append-only owner for task, authoring and adaptation classification.
 * Imported-story selection is supplied separately from the exact surface cut. */
export function createTaskActivityCursor() {
    const management = new Set(), internalSeqs = new Set();
    const turns = new Map(), adaptation = createAdaptationActivityCursor();
    let internal = false, turn = null, authoring = false;
    return { internalSeqs, turns,
        effectiveTurn(event) { return event.data?.turn ?? turns.get(event.seq); },
        isInternal(event, importedProse) {
            const actualTurn = event.data?.turn ?? turns.get(event.seq);
            return internalSeqs.has(event.seq) || !importedProse
                && (management.has(actualTurn) || typeof actualTurn === 'number' && adaptation.turns.has(actualTurn))
                && (event.type === 'assistant/message' || event.type === 'user/message' && event.data?.source?.kind === 'user');
        },
        advance(event) {
            const dirty = new Set(adaptation.advance(event));
            function mark(value) {
                if (!management.has(value)) {
                    management.add(value);
                    dirty.add(value);
                }
            }
            if (event.type === 'turn/start')
                turn = event.data?.turn;
            turns.set(event.seq, turn);
            if (event.type === 'tool/call' && event.data?.name === 'rp_card_draft_check')
                authoring = true;
            if (event.type === 'tool/call' && ['rp_card_import_begin', 'rp_commit_card'].includes(event.data?.name ?? ''))
                authoring = false;
            if (event.type === 'user/message' && event.data?.source?.kind === 'roleplay-tasks'
                && event.data.source.stage === 'after-story')
                authoring = false;
            if (authoring && event.type === 'tool/call' && event.data?.name === 'ask_user_question')
                mark(event.data.turn ?? turn);
            if (event.type === 'tool/call'
                && (/^(?:rp_card_export_(?:begin|chunk|finalize)|rp_novel_export|rp_diagnose|rp_preset|rp_card_draft_check)$/.test(event.data?.name ?? '')
                    || isSettingManagementCall(event.data)))
                mark(event.data?.turn ?? turn);
            if (event.type === 'user/message' && event.data?.source?.kind === 'roleplay-tasks'
                && ['card-export', 'novel-export'].includes(event.data.source.jobKind ?? ''))
                mark(turn);
            if (event.type === 'turn/start' || event.type === 'turn/end')
                internal = false;
            if (event.type === 'user/message' && event.data?.source?.kind === 'roleplay-tasks' && event.data.source.form === 'phase') {
                internal = event.data.source.stage !== 'story';
            }
            if (event.type === 'user/message' && event.data?.source?.kind === 'roleplay-tasks'
                && event.data.source.form === 'management-receipt' && event.data.source.jobKind === 'card-import')
                internal = true;
            if (internal && event.type === 'assistant/message')
                internalSeqs.add(event.seq);
            if (event.type === 'turn/end')
                turn = null;
            return dirty;
        },
    };
}
/** One incremental task/receipt interpretation over an exact visible cut.
 * Selection owners keep their distinct message policies and output ordering. */
export function createTaskHistoryClassification(eventAt) {
    const activity = createTaskActivityCursor(), story = createTaskStoryCursor(), selection = createImportedStorySelectionIndex(eventAt);
    const bySeq = new Map();
    const make = () => ({ events: [], processed: -1, cursor: createImportedStorySelectionCursor(selection.visible, selection.selected) });
    let current = make();
    return {
        committed: (seq) => story.story.has(seq),
        effective: (event) => activity.effectiveTurn(event),
        internal: (event) => activity.isInternal(event, bySeq.get(event.seq)?.cursor.prose.has(event.seq) ?? false),
        advance(event, transition) {
            const dirty = new Set(), changedSeqs = new Set(), replay = new Set();
            const relevant = event.type !== 'assistant/chunk';
            if (relevant) {
                if (event.type === 'turn/start')
                    current = make();
                current.events.push(event);
                bySeq.set(event.seq, current);
                for (const turn of activity.advance(event))
                    dirty.add(turn);
                const storySeq = story.advance(event);
                if (storySeq !== undefined)
                    changedSeqs.add(storySeq);
            }
            const removed = transition?.kind === 'replace' ? transition.removed : [], added = transition?.kind === 'append' || transition?.kind === 'replace' ? [transition.seq] : [];
            for (const seq of selection.changeVisible(removed, added)) {
                const row = eventAt(seq), source = row?.type === 'user/message' ? row.data?.source : undefined;
                if (row?.type !== 'assistant/message' && row?.type !== 'tool/result'
                    && !(source?.kind === 'roleplay-tasks' && source.form === 'phase'))
                    continue;
                const segment = bySeq.get(seq);
                if (segment && seq <= segment.processed)
                    replay.add(segment);
            }
            for (const segment of replay) {
                const prior = segment.cursor.prose;
                segment.cursor = createImportedStorySelectionCursor(selection.visible, selection.selected);
                for (const row of segment.events)
                    segment.cursor.advance(row);
                segment.processed = segment.events.at(-1)?.seq ?? -1;
                for (const seq of prior)
                    if (!segment.cursor.prose.has(seq))
                        changedSeqs.add(seq);
                for (const seq of segment.cursor.prose)
                    if (!prior.has(seq))
                        changedSeqs.add(seq);
            }
            if (relevant && !replay.has(current)) {
                current.cursor.advance(event);
                current.processed = event.seq;
                if (current.cursor.prose.has(event.seq))
                    changedSeqs.add(event.seq);
            }
            return { dirty, changedSeqs };
        },
    };
}
/** Durable step provenance, never keyword heuristics or a whole-turn ban. */
export function internalTaskSeqs(session) {
    const events = taskProjectionEvents(session), previous = internalProjectionCache.get(session), surfaceKey = [...(session.surface?.nodes ?? [])].join(',');
    if (previous?.events === events && previous.surfaceKey === surfaceKey)
        return new Set(previous.hidden);
    const activity = createTaskActivityCursor();
    for (const event of events)
        activity.advance(event);
    const hidden = new Set(activity.internalSeqs);
    const resumed = importedStoryProjection(events, [...(session.surface?.nodes ?? [])]).prose;
    for (const e of events)
        if (activity.isInternal(e, resumed.has(e.seq)))
            hidden.add(e.seq);
    internalProjectionCache.set(session, {
        events, surfaceKey, hidden
    });
    return hidden;
}
const keyOf = (id) => `tavern_job__${id}`;
export function tavernTaskToolBoundary(table, agent) {
    const session = agent?.session;
    if (!session)
        return null;
    if (!(Number(agent.options?.subagentDepth) > 0) && session.header?.origin !== 'subagent')
        return null;
    const descriptor = sessionEvents(session).findLast(event => event.type === 'subagent/descriptor'
        && Number(event.seq) >= Number(session.inheritedEventCount
            ?? 0));
    const match = /^Tavern:([a-f0-9]{64}):/.exec(descriptor?.data?.label ?? '');
    const earlyId = Number(agent.options?.subagentDepth) > 0 && /^[a-f0-9]{64}$/.test(agent.options?.tavernTaskId ?? '') ? agent.options?.tavernTaskId : null;
    const id = earlyId ?? match?.[1], job = id ? taskContextRecord(table.get(keyOf(id))) : undefined;
    return job ? new Set((Array.isArray(job.allowedTools) ? job.allowedTools : []).filter((name) => typeof name === 'string'
        && !['subagent', 'spawn', 'fork', 'send_message', 'list_agents', 'interrupt_agent'].includes(name))) : null;
}
// Old imports share the same projection owner and append-only retirement implementation.
export const { retireCompletedTaskContexts, retireSettledInlineContexts, retireUsedStoryReads } = createTaskRetirement({
    internalTaskSeqs, inlineTaskEnvelope, createClassification: createTaskHistoryClassification
});
