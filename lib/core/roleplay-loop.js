// Generated from runtime/alpha3/src/core/roleplay-loop.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { retireSettledInlineContexts, retireUsedStoryReads, isSettingManagementCall } from './tavern-task-context.js';
import { createAdaptationStore } from './card-adaptation.js';
import { retireAdaptationReads, retireCoarseResearchReads, retireDeliveredDraft } from './card-adaptation-context.js';
import { adaptationTurns, importedStoryProjection } from '../memory/memory-provenance.js';
import { keyOf, cloneRecord, recordSha256, textOf } from './roleplay-data.js';
import { eventsOf, surfaceEvents, surfaceEntries, retireRoleplayContexts, retainRoleplayWindowContinuity, canonicalAssistantForTurn } from './roleplay-context.js';
import { CHARACTER_PERSONA } from './character-cluster.js';
import { tavernTaskToolBoundary, inlineTaskInstruction, taskPhaseMessage, retireCompletedTaskContexts, isInlinePending, inlineTaskMessages, internalTaskSeqs } from './tavern-tasks.js';
/** Bound silence at the native request boundary without changing adapter
 * options, retrying a paid call or discarding queued player input. */
export function createFirstResponseWatchdog(timeoutMs = 90000) {
    const pending = new Map();
    const clear = (id) => { const item = pending.get(id); if (!item)
        return; clearTimeout(item.timer); item.signal.removeEventListener('abort', item.abort); pending.delete(id); };
    return {
        begin(agent, turn, step, signal) {
            const id = agent.session.id;
            clear(id);
            if (signal.aborted)
                return;
            const abort = () => clear(id);
            const item = { turn, step, signal, abort, timer: setTimeout(() => {
                    if (pending.get(id) !== item || signal.aborted)
                        return;
                    clear(id);
                    agent.cancel({ kind: 'hook', reason: `模型请求 ${timeoutMs / 1000} 秒未返回正文、推理或工具输出，已停止等待；可重试。观察起点为原生请求准备完成，不代表 HTTP 已发出。turn=${turn}, step=${step}` }, { keepInbox: true });
                }, timeoutMs) };
            pending.set(id, item);
            signal.addEventListener('abort', abort, { once: true });
        },
        observe(session, event) {
            const item = pending.get(session.id);
            if (!item || Number(event.data?.turn) !== item.turn)
                return;
            if (event.type === 'turn/end' || (Number(event.data?.step) === item.step && (event.type === 'step/end' || event.type === 'assistant/message' || event.type === 'assistant/chunk' && ['text-delta', 'reasoning-delta', 'tool-call-delta', 'finish'].includes(event.data?.chunk?.type ?? ''))))
                clear(session.id);
        },
        dispose() { for (const id of pending.keys())
            clear(id); },
    };
}
export function registerRoleplayLoop({ ctx, T, tavernTasks, clusterJob, isRoleplaySession, characterCluster, activeCardWorkflow, taskAgents, ensureState, clusterPhase, withDecisionMutationLock, normalizeDecisionRecord, resumeStatusMaintenance, resumeMemoryWork, resumeCardWorkflows, resumeNovelExports, withImportLock, buildPhaseA, characterRoster, storyWindowSettings, runStatusObligation, publishTurnDecision, runPhaseBC, adaptationScope, importPromptCheckpoint, authorContext }) {
    const preparationRecordKey = (sid) => keyOf(sid, 'task-preparation');
    const handledImportPrompts = new Map();
    const firstResponse = createFirstResponseWatchdog();
    ctx.effect(() => () => firstResponse.dispose(), 'roleplay: first model output deadline');
    ctx.on('agent/request', async (payload, next) => {
        const config = await next(), agent = payload.agent;
        if (isRoleplaySession(agent.session) && !(Number(agent.options?.subagentDepth) > 0) && agent.cancel)
            firstResponse.begin({ session: agent.session, cancel: agent.cancel.bind(agent) }, payload.turn, payload.step, payload.signal);
        return config;
    });
    ctx.on('session/event', (session, event) => firstResponse.observe(session, event), { global: true });
    const authorPrompts = new WeakMap();
    const currentTurn = (session) => {
        const events = session.events ?? session.log ?? [];
        for (let i = events.length - 1; i >= 0; i--)
            if (events[i]?.type === 'turn/start')
                return events[i]?.data?.turn;
        return undefined;
    };
    const residentContext = (session) => {
        const cached = authorPrompts.get(session), turn = currentTurn(session);
        if (turn === undefined || !cached || cached.turn !== turn)
            return [];
        const author = cached.revision === authorContext?.(session).revision ? cached.parts : [];
        // Reuse only this turn's visible input/body. Older evidence may have been
        // removed by the hard window and must remain in the frozen task payload.
        const story = surfaceEntries(session).filter(entry => entry.turn === turn)
            .map(entry => ({ name: `本轮${entry.kind === 'assistant' ? '正文' : '玩家输入'} seq=${entry.seq}`, text: entry.text }));
        return [...author, ...story];
    };
    // Native scoped tool registrations (notably `subagent`) are exempt from
    // inherited toolFilter restrictions. Apply the actual task allowlist to
    // both the assembled request and execution, including those own-scope tools.
    ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
        const assembly = await next(), allowed = tavernTaskToolBoundary(T.branch, context.agent);
        if (clusterJob(context.agent))
            return { ...assembly, contexts: assembly.contexts.filter(s => /^(sandbox|approval):/.test(s.name)), tools: assembly.tools.filter(t => t.name === 'rp_history'),
                sections: [{ name: 'roleplay:character-persona', text: CHARACTER_PERSONA }, ...assembly.sections.filter(s => s.name === 'tool:rp_history' || /^(sandbox|approval):/.test(s.name) || s.name === 'harness:identity')] };
        if (!allowed) {
            // Also strip stale catalogs supplied by cached/restored tool surfaces.
            if (!isRoleplaySession(context.agent?.session))
                return assembly;
            const session = context.agent?.session;
            if (session && authorContext) {
                const candidate = authorContext(session);
                authorPrompts.set(session, { revision: candidate.revision, turn: currentTurn(session), parts: candidate.parts
                        .filter(part => assembly.sections.some(section => section.name === part.section && typeof section.text === 'string' && section.text.includes(part.renderedText))) });
            }
            const hidden = new Set(['rp_status_set', 'rp_setting_evidence', ...(!characterCluster.read(context.agent.session).enabled ? ['rp_character_cast'] : [])]);
            if (!assembly.tools.some(tool => hidden.has(tool.name)))
                return assembly;
            return { ...assembly, tools: assembly.tools.filter(tool => !hidden.has(tool.name)),
                sections: assembly.sections.filter(section => !hidden.has(section.name.replace(/^tool:/, ''))) };
        }
        // Native toolFilter leaves own-scope tool instructions in the prompt even
        // when their schemas are removed. Do not instruct a data task to code,
        // browse, create children, or publish a GUI reply with unavailable tools.
        // Preserve task persona, identity, security sections and runtime contexts.
        const irrelevant = new Set(['harness:source', 'app:web-surface', 'ui:deliverable-file-references']);
        return { ...assembly, tools: assembly.tools.filter(tool => allowed.has(tool.name)),
            sections: assembly.sections.filter(section => !irrelevant.has(section.name)
                && (!section.name.startsWith('tool:') || allowed.has(section.name.slice(5)))) };
    }, { global: true });
    ctx.effect(() => ctx.tools.guard?.(execution => {
        const session = execution.agent?.session;
        if (execution.name === 'rp_status_set')
            return '旧状态工具已停用；正文完成后由系统自动维护状态栏，不要重试或改用其他写入工具。';
        const auxiliaryTools = tavernTaskToolBoundary(T.branch, execution.agent);
        if (auxiliaryTools && !auxiliaryTools.has(execution.name))
            return '该维护任务只允许指定的来源工具；直接按结果契约返回，不创建子代理或检查实现代码。';
        if (!session || !isRoleplaySession(session))
            return;
        let phase = null;
        const events = eventsOf(session);
        for (let index = events.length - 1; index >= 0; index--) {
            const event = events[index];
            if (event.type === 'turn/start' || event.type === 'turn/end')
                break;
            const source = event.type === 'user/message' ? event.data?.source : null;
            if (source?.kind === 'plugin' && source.plugin === 'roleplay-tasks' && source.form === 'phase') {
                phase = source.stage;
                break;
            }
        }
        if (!phase || phase === 'story' || phase === 'character-cast')
            return;
        // The main writer may hand off a discovered defect after publishing prose.
        // Inline maintenance must still not synchronously rewrite author settings.
        const settingArgs = execution.arguments;
        if (phase === 'after-story' && execution.name === 'rp_setting' && settingArgs && typeof settingArgs === 'object'
            && ['list', 'read', 'repair', 'jobs'].includes(String(settingArgs.action)))
            return;
        const allowed = new Set(['rp_task_read', 'rp_task_submit', 'run_code']);
        const workflow = activeCardWorkflow(session);
        if (workflow)
            for (const name of workflow.kind === 'card-import'
                ? ['rp_card_import_begin', 'rp_card_import_chunk', 'rp_card_import_stage', 'rp_card_import_finalize']
                : ['rp_card_export_begin', 'rp_card_export_chunk', 'rp_card_export_finalize'])
                allowed.add(name);
        if (!allowed.has(execution.name))
            return '内部酒馆维护只允许任务读取、提交及该任务的原生读卡/导出工具。不要排查服务器代码；按任务完整契约提交，失败可在酒馆管理重试。';
    }), 'roleplay: maintenance tool boundary');
    const taskInstruction = (session) => inlineTaskInstruction(tavernTasks.pending(session), { sessionId: session.id, resident: residentContext(session) });
    ctx.on('agent/pre-step', async (payload, next) => {
        const session = payload?.agent?.session;
        if (!session || !isRoleplaySession(session) || Number(payload.agent?.options?.subagentDepth) > 0)
            return next();
        taskAgents.set(session.id, payload.agent);
        const imported = importPromptCheckpoint?.(session);
        if (payload.step > 1 && imported && handledImportPrompts.get(session.id) !== imported.importId) {
            retireCompletedTaskContexts(session, payload.turn, imported);
            handledImportPrompts.set(session.id, imported.importId);
        }
        const researchOwner = adaptationScope?.(session) ?? session.id;
        retireCoarseResearchReads(session, researchOwner);
        retireAdaptationReads(session, createAdaptationStore(T.branch).checkpoints(researchOwner, session.id));
        const st = ensureState(session.id);
        // Preserve old records for diagnostics, but never resume superseded
        // per-turn semantic preparation after upgrading to direct notes.
        for (const job of tavernTasks.list(session)) {
            if (job.kind !== 'memory' || job.input?.taskStage || !['queued', 'running'].includes(job.status))
                continue;
            const system = String(job.input?.system ?? '');
            if (system.includes('场景状态分析器') || system.includes('记忆提取器')) {
                await tavernTasks.cancel(session, job.id);
            }
        }
        if (clusterPhase(session)?.stage === 'character-cast' && !characterCluster.read(session).enabled) {
            const decision = await next();
            return decision?.kind === 'enter' ? { ...decision, messages: [taskPhaseMessage('story', '玩家已关闭角色集群，现在按通常方式创作正文。未完成的人物推演不是剧情事实。'), ...decision.messages] } : decision;
        }
        let preparation = T.branch.get(preparationRecordKey(session.id));
        if (preparation?.sessionId !== session.id)
            preparation = null;
        const hasUser = payload.messages.some(m => m.role === 'user' && m.source?.kind === 'user');
        if (hasUser && payload.step === 1) {
            if (!tavernTasks.pending(session).length) {
                retireCompletedTaskContexts(session, payload.turn);
            }
            else
                retireDeliveredDraft(session, payload.turn);
            await withDecisionMutationLock(session.id, async () => {
                const key = keyOf(session.id, 'current'), decision = normalizeDecisionRecord(T.decision.get(key));
                if (decision && decision.answered !== true && decision.superseded !== true)
                    await T.decision.put(key, { ...decision, answered: true, superseded: true, supersededAt: Date.now(), supersededReason: 'player-input' });
            });
            preparation = { schemaVersion: 1, id: randomUUID(), sessionId: session.id, branchId: session.id, turn: payload.turn,
                messages: cloneRecord(payload.messages), status: 'preparing', createdAt: Date.now(), sourceHash: recordSha256(payload.messages) };
            await T.branch.put(preparationRecordKey(session.id), preparation);
        }
        await tavernTasks.invalidate(session);
        if (hasUser && payload.step === 1) {
            retireSettledInlineContexts(session, payload.turn, tavernTasks.list(session));
            retireUsedStoryReads(session, payload.turn);
        }
        try {
            await resumeStatusMaintenance(session, payload.agent);
            await resumeMemoryWork(session, payload.agent, payload.signal);
            await resumeCardWorkflows(session, payload.agent, payload.signal);
            await resumeNovelExports(session, payload.agent, payload.signal);
        }
        catch (error) {
            if (isInlinePending(error))
                return { kind: 'enter', messages: inlineTaskMessages(session, 'management', tavernTasks.pending(session), { resident: residentContext(session) }) };
            throw error;
        }
        if (!preparation || preparation.status !== 'preparing')
            return next();
        // A deferred stage returns immediately; the main loop is never awaited by
        // its own pre-step handler. The original player message is appended once,
        // only when preparation has committed successfully.
        return withImportLock(session.id, '__phase-a__', async () => {
            let decision;
            try {
                decision = await next();
                if (decision?.kind !== 'enter')
                    return decision;
                // Resumed preparations may contain last turn's injected context. Keep
                // only the original conversation input, never replay transient lore.
                const originalMessages = preparation.messages.filter(m => m.source?.plugin !== 'roleplay-context' && m.source?.plugin !== 'roleplay-tasks');
                const staged = { ...payload, messages: cloneRecord(originalMessages) };
                const hidden = await buildPhaseA(session, staged, st);
                retireRoleplayContexts(session, payload.turn, hidden);
                await T.branch.put(preparationRecordKey(session.id), { ...preparation, status: 'completed', completedAt: Date.now() });
                const researching = adaptationTurns(eventsOf(session)).has(payload.turn);
                const needsCast = !researching && characterCluster.read(session).enabled && characterRoster(session).length > 0 && !activeCardWorkflow(session);
                const restore = taskPhaseMessage(needsCast ? 'character-cast' : 'story', needsCast
                    ? '本轮角色集群准备：现在还没有进入正文。请根据随后玩家输入选择预计出场的主要人物，先调用 rp_character_cast（无人出场时传空数组）。程序已备好人物上下文，禁止手工搬运。等待角色建议返回及程序的正文阶段通知后再开始写故事，不把选角说明写成正文。如果玩家要求读卡、写卡、管理或诊断，直接执行对应工具，不推演角色。'
                    : researching ? '当前仍在长文本改编创作。按玩家要求继续阅读、问卷或写卡；用 rp_source_status/notes 恢复独立研究资料。尚未进入角色扮演，不把原著或草稿当作已发生剧情。用户要求停止改编回到原卡时调用 rp_source_close。'
                        : '现在进入正常正文阶段。先前维护指令与工具结果仅是历史后台记录，不是待办或剧情；不要重复执行或复述。当前状态和笔记以随后最新锚点为准；以下是玩家原始输入。');
                const originalIds = new Set(preparation.messages.map(m => m.id));
                const phaseSnapshot = st.snapshots.get(Number(payload.turn)) ?? st.snapshot;
                const messages = phaseSnapshot?.contextWindow?.rollover
                    ? retainRoleplayWindowContinuity(session, decision.messages, storyWindowSettings(session).tail) : decision.messages;
                const remaining = messages.filter(m => !originalIds.has(m.id) && m.source?.plugin !== 'roleplay-tasks' && m.source?.plugin !== 'roleplay-context');
                return { ...decision, messages: [restore, ...hidden, ...originalMessages, ...remaining] };
            }
            catch (error) {
                st.lastPreparedTurn = -1;
                if (isInlinePending(error))
                    return { kind: 'enter', messages: inlineTaskMessages(session, 'prepare', tavernTasks.pending(session), { resident: residentContext(session) }) };
                // Fail closed: a missing prerequisite cannot admit unprepared prose.
                throw error;
            }
        });
    });
    ctx.on('agent/turn-stopping', async ({ agent, turn, signal }) => {
        const session = agent?.session;
        if (!session || !isRoleplaySession(session) || Number(agent.options?.subagentDepth) > 0)
            return;
        taskAgents.set(session.id, agent);
        const st = ensureState(session.id);
        const timingStart = performance.now();
        let timingPrevious = timingStart;
        const timings = [];
        const mark = (stage) => { const now = performance.now(), sample = { stage, wallAt: Date.now(), elapsedMs: Math.round(now - timingStart), deltaMs: Math.round(now - timingPrevious) }; timings.push(sample); ctx.logger?.info?.('roleplay: maintenance-timing ' + JSON.stringify({ sessionId: session.id, turn, ...sample })); timingPrevious = now; };
        mark('enter');
        try {
            try {
                await resumeCardWorkflows(session, agent, signal);
                await resumeNovelExports(session, agent, signal);
            }
            catch (error) {
                if (!isInlinePending(error))
                    throw error;
            }
            mark('workflows-resumed');
            const turnEvents = eventsOf(session).filter(e => Number(e.data?.turn ?? e.data?.source?.turn) === Number(turn));
            const phase = clusterPhase(session);
            if (phase?.stage === 'character-cast' && !T.branch.get(keyOf(session.id, `cluster-plan-${turn}`))?.result) {
                const management = turnEvents.some(e => e.type === 'tool/call' && (/^(rp_source_|rp_preset$|rp_card_(import|export|draft)|rp_commit_card|rp_diagnose|rp_novel_export|ask_user_question)/.test(e.data?.name ?? '') || isSettingManagementCall(e.data)));
                if (!management) {
                    if (phase.castReminder === true)
                        throw new Error('主代理未完成角色选角，本轮未进入正文；可重试或关闭角色集群');
                    agent.steer(taskPhaseMessage('character-cast', '尚未完成选角，以上文字不是正式剧情。现在调用 rp_character_cast，传主要人物 ID；不要再输出正文或完成报告。', { turn, castReminder: true }));
                    return;
                }
            }
            const preparation = T.branch.get(preparationRecordKey(session.id));
            if (preparation?.status !== 'preparing') {
                let canonical = canonicalAssistantForTurn(session, turn);
                if (!canonical) {
                    const hidden = internalTaskSeqs(session);
                    canonical = surfaceEvents(session).findLast(e => e.type === 'assistant/message' && Number(e.data?.turn) === Number(turn) && !e.data?.interrupted && !hidden.has(e.seq) && textOf(e.data?.message?.content).trim()) ?? null;
                    if (canonical)
                        session.append('user/message', taskPhaseMessage('after-story', '正文已经落盘，下面只完成本轮维护义务，不继续剧情。', { storySeq: canonical.seq, turn }), { surfaceOp: 'append' });
                }
                if (canonical) {
                    mark('story-selected');
                    const releaseBatch = tavernTasks.holdBatch(session);
                    let statusWork, decisionWork, admitted;
                    let snapshot = st.snapshots.get(Number(turn)) ?? T.branch.get(keyOf(session.id, `task-snapshot-${turn}`));
                    if (snapshot && importedStoryProjection(eventsOf(session), [...(session.surface?.nodes ?? [])]).prose.has(canonical.seq))
                        snapshot = { ...snapshot, userText: '' };
                    try {
                        statusWork = runStatusObligation(session, canonical, 'agent/turn-stopping', { agent, signal });
                        admitted = await (statusWork.admission ?? statusWork);
                        mark('status-admitted');
                        if (admitted?.execution === 'spawn' && admitted.status !== 'completed' && snapshot) {
                            decisionWork = publishTurnDecision(session, canonical, snapshot, textOf(canonical.data?.message?.content), signal);
                            decisionWork.catch(error => ctx.logger?.warn?.(`roleplay: decision card failed: ${String(error)}`));
                            // Only wait for durable admission, never for a held child's result.
                            await decisionWork.admission;
                            mark('decision-admitted');
                        }
                    }
                    finally {
                        releaseBatch();
                    }
                    // The story is already published. Keep required independent work in
                    // this native turn so a fallback steers its next step instead of waking
                    // another turn with its own reply/footer. Release batching BEFORE the
                    // wait; inline tasks return waiting-main rather than awaiting ourselves.
                    await statusWork;
                    mark('status-ready-or-inline');
                    signal?.throwIfAborted();
                    if (snapshot) {
                        if (!decisionWork) {
                            decisionWork = publishTurnDecision(session, canonical, snapshot, textOf(canonical.data?.message?.content), signal);
                            void decisionWork.admission?.then(() => mark('decision-admitted'));
                        }
                        const outcomes = await Promise.allSettled([decisionWork.finally(() => mark('decision-ready-or-inline')), runPhaseBC(session, canonical, st, snapshot, signal).finally(() => mark('phase-bc-ready'))]);
                        for (const outcome of outcomes)
                            if (outcome.status === 'rejected' && !isInlinePending(outcome.reason))
                                throw outcome.reason;
                    }
                    if (T.branch.get(keyOf(session.id, `phaseb-${turn}`))?.state === 'completed') {
                        try {
                            await ctx.get('compaction')?.finishTurn?.(agent, signal);
                        }
                        catch (error) {
                            if (!isInlinePending(error))
                                throw error;
                        }
                    }
                }
            }
            signal?.throwIfAborted();
            const pending = tavernTasks.pending(session);
            const attemptKey = keyOf(session.id, `task-steering-${turn}`), fingerprint = recordSha256(pending.map(j => [j.id, j.generation, j.status]));
            const prior = T.branch.get(attemptKey), attempt = prior?.fingerprint === fingerprint ? prior.attempt + 1 : 1;
            await T.branch.put(attemptKey, { schemaVersion: 1, sessionId: session.id, turn, fingerprint, attempt, source: pending.map(j => j.id) });
            if (pending.length && attempt > 3) {
                for (const job of pending)
                    await tavernTasks.fail(session, job.id, '主循环多次结束但维护任务尚未提交，请重试');
                throw new Error('酒馆维护尚未完成，检查点已保留；可在酒馆管理中重试');
            }
            if (pending.length || preparation?.status === 'preparing')
                agent.steer(taskPhaseMessage(preparation?.status === 'preparing' ? 'prepare' : 'after-story', taskInstruction(session), { turn, dispatchFingerprint: fingerprint }));
            mark(pending.length || preparation?.status === 'preparing' ? 'maintenance-steered' : 'finished');
        }
        finally {
            // Diagnostics must survive a disabled info logger without entering the
            // model context. Keep a bounded per-turn trace, including failed exits.
            const key = keyOf(session.id, `maintenance-timing-${turn}`), prior = T.branch.get(key);
            const samples = prior?.schemaVersion === 1 && prior.sessionId === session.id && Array.isArray(prior.samples) ? prior.samples : [];
            try {
                await T.branch.put(key, { schemaVersion: 1, sessionId: session.id, turn, updatedAt: Date.now(), samples: [...samples, ...timings].slice(-64) });
            }
            catch {
                ctx.logger?.warn?.('roleplay: maintenance timing persistence failed');
            }
        }
    });
    return { preparationRecordKey, taskInstruction };
}
