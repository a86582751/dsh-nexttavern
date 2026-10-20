// Generated from runtime/alpha3/src/core/roleplay-loop.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { renderToolsSdk, renderToolsSdkPy } from '@deepseek-ai/dsh-tools';
import { ensureSessionHistory } from './session-history.js';
import { provenImportPreludeAssistants } from './tavern-task-retirement.js';
import { retireSettledInlineContexts, retireUsedStoryReads, isSettingManagementCall } from './tavern-task-context.js';
import { createAdaptationStore } from './card-adaptation.js';
import { retireAdaptationReads, retireCoarseResearchReads, retireDeliveredDraft } from './card-adaptation-context.js';
import { adaptationTurns, adaptationIsActive, importedStoryProjection } from '../memory/memory-provenance.js';
import { keyOf, cloneRecord, recordSha256, textOf } from './roleplay-data.js';
import { eventsOf, surfaceEvents, surfaceEntries, retireRoleplayContexts, retainRoleplayWindowContinuity, canonicalAssistantForTurn } from './roleplay-context.js';
import { CHARACTER_PERSONA } from './character-cluster.js';
import { tavernTaskToolBoundary, inlineTaskInstruction, taskPhaseMessage, retireCompletedTaskContexts, isInlinePending, inlineTaskMessages, internalTaskSeqs } from './tavern-tasks.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { semanticTaskSubmitDescription, semanticTaskSubmitParameters, legacyTaskSubmitDescription, legacyTaskSubmitParameters } from './roleplay-task-tools.js';
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
                    agent.cancel({ kind: 'hook', reason: `模型请求 ${timeoutMs / 1000} 秒未返回正文、推理或工具输出，已停止等待；可重试。观察起点为开始消费原生模型流，不代表 HTTP 已发出。turn=${turn}, step=${step}` }, { keepInbox: true });
                }, timeoutMs) };
            pending.set(id, item);
            signal.addEventListener('abort', abort, { once: true });
        },
        observe(session, event) {
            const item = pending.get(session.id);
            if (!item || Number(event.data?.turn) !== item.turn)
                return;
            if (event.type === 'turn/end' || (Number(event.data?.step) === item.step && (event.type === 'step/end' || event.type === 'assistant/message')))
                clear(session.id);
        },
        observeStream(session, frame) {
            const item = pending.get(session.id);
            if (!item)
                return;
            // Native chunk frames carry only attemptId; their start owns turn/step.
            if (frame.type === 'start') {
                if (frame.turn === item.turn && frame.step === item.step)
                    item.attemptId = frame.attemptId;
            }
            else if (frame.attemptId === item.attemptId && (frame.type === 'end'
                || frame.type === 'chunk' && ['text-delta', 'reasoning-delta', 'tool-call-delta', 'finish'].includes(frame.chunk.type)))
                clear(session.id);
        },
        dispose() { for (const id of pending.keys())
            clear(id); },
    };
}
export function registerRoleplayLoop({ ctx, T, tavernTasks, clusterJob, isRoleplaySession, characterCluster, activeCardWorkflow, taskAgents, ensureState, clusterPhase, withDecisionMutationLock, normalizeDecisionRecord, resumeStatusMaintenance, resumeMemoryWork, resumeCardWorkflows, resumeNovelExports, withImportLock, ensureBranch, buildPhaseA, buildPhaseACandidate, reconcileCanonicalPlayerVariants, buildForkLookupIndex, characterRoster, storyWindowSettings, runStatusObligation, publishTurnDecision, runPhaseBC, adaptationScope, importPromptCheckpoint, authorContext, inputBinding, inputSnapshotCurrent, programOpeningOwner, rowFacts, firstResponseTimeoutMs, submissionBindings, }) {
    const preparationRecordKey = (sid) => keyOf(sid, 'task-preparation');
    const handledImportPrompts = new Map();
    const firstResponse = createFirstResponseWatchdog(firstResponseTimeoutMs);
    ctx.effect(() => () => firstResponse.dispose(), 'roleplay: first model output deadline');
    const requestSignals = new WeakMap();
    ctx.on('agent/request', async (payload, next) => {
        const config = await next(), agent = payload.agent;
        await ensureSessionHistory(agent.session, payload.signal);
        if (isRoleplaySession(agent.session) && !(Number(agent.options?.subagentDepth) > 0))
            submissionBindings.begin(payload, inputBinding?.(agent)?.readClaimedMaintenanceInput());
        if (isRoleplaySession(agent.session) && !(Number(agent.options?.subagentDepth) > 0) && agent.cancel)
            requestSignals.set(agent.session, { agent, turn: payload.turn, step: payload.step, signal: payload.signal });
        return config;
    });
    ctx.on('llm/stream', (options, next) => {
        submissionBindings.capture(options);
        return next();
    }, { global: true });
    ctx.on('agent/assistant-stream', ({ agent, frame }) => {
        const request = requestSignals.get(agent.session);
        if (request?.agent !== agent)
            return;
        if (frame.type === 'start') {
            if (frame.turn !== request.turn || frame.step !== request.step || !agent.cancel)
                return;
            firstResponse.begin({ session: agent.session, cancel: agent.cancel.bind(agent) }, frame.turn, frame.step, request.signal);
        }
        firstResponse.observeStream(agent.session, frame);
    }, { global: true });
    ctx.on('session/event', (session, event) => {
        submissionBindings.observe(session, event);
        firstResponse.observe(session, event);
    }, { global: true });
    const authorPrompts = new WeakMap();
    const currentTurn = (session) => {
        const events = eventsOf(session);
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
    const importSteps = ['rp_card_import_chunk', 'rp_card_import_stage', 'rp_card_import_finalize'];
    const exportSteps = ['rp_card_export_chunk', 'rp_card_export_finalize'];
    const researchSteps = ['rp_source_read', 'rp_source_note', 'rp_source_notes', 'rp_source_search',
        'rp_source_index', 'rp_source_research', 'rp_source_finish'];
    const adaptationStore = createAdaptationStore(T.branch);
    const bounded = (kind, allowed) => ({ kind, allows: name => allowed.has(name) });
    const currentPhase = (session) => {
        const events = eventsOf(session);
        for (let index = events.length - 1; index >= 0; index--) {
            const event = events[index];
            if (event.type === 'turn/start' || event.type === 'turn/end')
                break;
            const source = event.type === 'user/message' ? event.data?.source : null;
            if (source?.kind === 'roleplay-tasks' && source.form === 'phase')
                return String(source.stage);
        }
        return undefined;
    };
    const toolBoundary = (agent) => {
        if (clusterJob(agent))
            return bounded('cluster', new Set(['rp_history']));
        const task = tavernTaskToolBoundary(T.branch, agent);
        if (task)
            return bounded('task', task);
        const session = agent?.session;
        if (!session || !isRoleplaySession(session))
            return undefined;
        const workflow = activeCardWorkflow(session);
        let importing = workflow?.kind === 'card-import', exporting = workflow?.kind === 'card-export';
        // Legacy manual sources keep their existing current-branch recovery path.
        // A record owned by a stopped job never reopens that job's capabilities.
        for (const [key, record] of T.branch.entries()) {
            if (record.workflowId)
                continue;
            if (record.sessionId === session.id && key === keyOf(session.id, `import-${record.importId}`)
                && ['staging', 'committing', 'recovery-required'].includes(String(record.status)))
                importing = true;
            if (record.branchId === session.id && key === keyOf(session.id, `export-${record.exportId}`)
                && ['reviewing', 'committing'].includes(String(record.status)))
                exporting = true;
        }
        const binding = inputBinding?.(agent), view = binding?.current(), step = binding?.currentStep();
        const claimed = binding?.readClaimedMessages();
        // Native claims before assembly; its owned continuation and original
        // source metadata are available before pre-step publishes a phase message.
        let phase = view?.kind === 'maintenance' ? 'after-story' : undefined;
        if (!phase && claimed) {
            if (claimed.length && claimed.every(message => message.source?.kind === 'roleplay-tasks' && message.source.form === 'phase'))
                phase = String(claimed.at(-1).source?.stage);
        }
        else if (!phase)
            phase = currentPhase(session);
        let playerManagement = false;
        if (phase === 'management' && binding?.current()?.kind === 'management' && step) {
            try {
                playerManagement = binding.originalMessages(step).some(message => message.source.kind === 'user');
            }
            catch { /* Preserve the existing internal-management boundary when its Native claim is unavailable. */ }
        }
        if (phase && !['story', 'character-cast'].includes(phase) && !playerManagement) {
            const allowed = new Set(['rp_task_read', 'rp_task_submit']);
            for (const job of tavernTasks.pending(session))
                for (const name of job.allowedTools ?? []) {
                    if (!['subagent', 'spawn', 'fork', 'send_message', 'list_agents', 'interrupt_agent', 'rp_status_set'].includes(name))
                        allowed.add(name);
                }
            if (phase === 'after-story')
                allowed.add('rp_setting');
            if (importing)
                for (const name of ['rp_card_import_begin', ...importSteps])
                    allowed.add(name);
            if (exporting)
                for (const name of ['rp_card_export_begin', ...exportSteps])
                    allowed.add(name);
            const transition = binding?.current()?.kind === 'legacy' ? binding.existingTransition() : undefined;
            let legacyImportId;
            if (transition?.legacyRecord) {
                try {
                    transition.lease.checkActivation();
                    legacyImportId = transition.legacyRecord.importId;
                    for (const name of importSteps)
                        allowed.add(name);
                }
                catch { /* A stopped lease cannot create a maintenance import exception. */ }
            }
            return { ...bounded('maintenance', allowed), phase, ...legacyImportId ? { legacyImportId } : {} };
        }
        const hidden = new Set(['rp_status_set', 'rp_setting_evidence', ...importSteps, ...exportSteps, ...researchSteps, 'rp_source_close']);
        if (!characterCluster.read(session).enabled)
            hidden.add('rp_character_cast');
        if (importing)
            for (const name of importSteps)
                hidden.delete(name);
        if (exporting)
            for (const name of exportSteps)
                hidden.delete(name);
        if (adaptationIsActive(eventsOf(session))) {
            hidden.delete('rp_source_close');
            const progress = adaptationStore.selectedProgress(adaptationScope?.(session) ?? session.id);
            if (progress)
                for (const name of researchSteps)
                    hidden.delete(name);
        }
        return { kind: 'main', allows: name => !hidden.has(name) };
    };
    const projectToolSurface = (assembly, agent, boundary, submission) => {
        const code = assembly.tools.some(tool => tool.name === 'run_code');
        const visible = (name) => name === 'run_code' ? code : boundary.allows(name);
        let sections = assembly.sections.filter(section => !section.name.startsWith('tool:') || visible(section.name.slice(5)));
        if (!code)
            sections = sections.filter(section => section.name !== 'tools:sdk' && section.name !== 'tools:ptc-only');
        if (code && ctx.tools.schemas && ctx.tools.get) {
            // Pure PTC advertises only the transport. Its SDK must describe the same
            // end capabilities that the actual scoped execution guard permits.
            const schemas = ctx.tools.schemas(agent).filter(tool => tool.name !== 'run_code' && boundary.allows(tool.name))
                .map(tool => ({ ...tool, ...tool.name === 'rp_task_submit' && submission ? submission : {},
                output: ctx.tools.get(tool.name, agent).output.schema }));
            const sdk = ctx.get('ptcRuntime')?.language === 'python' ? renderToolsSdkPy(schemas) : renderToolsSdk(schemas);
            sections = sections.map(section => section.name === 'tools:sdk' ? { ...section, text: sdk } : section);
        }
        const tools = assembly.tools.filter(tool => visible(tool.name));
        if (tools.length === assembly.tools.length && sections.every((section, index) => section === assembly.sections[index])
            && sections.length === assembly.sections.length)
            return assembly;
        return { ...assembly, tools, sections };
    };
    // Native scoped tool registrations (notably `subagent`) are exempt from
    // inherited toolFilter restrictions. Apply the actual task allowlist to
    // both the assembled request and execution, including those own-scope tools.
    ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
        await ensureSessionHistory(context.agent?.session);
        let assembly = await next();
        const agent = context.agent, boundary = toolBoundary(agent), maintenance = agent ? inputBinding?.(agent)?.readClaimedMaintenanceInput() : undefined, semantic = maintenance && submissionBindings.semanticOnly(maintenance), submission = maintenance ? { description: semantic ? semanticTaskSubmitDescription : legacyTaskSubmitDescription,
            parameters: semantic ? semanticTaskSubmitParameters : legacyTaskSubmitParameters } : undefined;
        if (submission) {
            assembly = { ...assembly,
                tools: assembly.tools.map(tool => tool.name === 'rp_task_submit' ? { ...tool, ...submission } : tool),
                sections: assembly.sections.map(section => section.name === 'tool:rp_task_submit'
                    ? { ...section, text: submission.description } : section) };
        }
        if (!boundary || !agent)
            return assembly;
        const projected = projectToolSurface(assembly, agent, boundary, submission);
        if (boundary.kind === 'cluster')
            return { ...projected, contexts: projected.contexts.filter(s => /^(sandbox|approval):/.test(s.name)),
                sections: [{ name: 'roleplay:character-persona', text: CHARACTER_PERSONA }, ...projected.sections.filter(s => s.name === 'tool:rp_history'
                        || s.name === 'tools:sdk' || s.name === 'tools:ptc-only' || /^(sandbox|approval):/.test(s.name) || s.name === 'harness:identity')] };
        if (boundary.kind === 'main') {
            // Also strip stale catalogs supplied by cached/restored tool surfaces.
            if (!isRoleplaySession(context.agent?.session))
                return assembly;
            const session = context.agent?.session;
            if (session && authorContext) {
                const candidate = authorContext(session);
                authorPrompts.set(session, { revision: candidate.revision, turn: currentTurn(session), parts: candidate.parts
                        .filter(part => assembly.sections.some(section => section.name === part.section && typeof section.text === 'string' && section.text.includes(part.renderedText))) });
            }
            return projected;
        }
        // Native toolFilter leaves own-scope tool instructions in the prompt even
        // when their schemas are removed. Keep guidance for actual end capabilities;
        // PTC remains only their transport. Preserve task and security context.
        const irrelevant = new Set(['harness:source', 'app:web-surface', 'ui:deliverable-file-references']);
        return { ...projected, sections: projected.sections.filter(section => !irrelevant.has(section.name)) };
    }, { global: true });
    ctx.effect(() => ctx.tools.guard?.(execution => {
        if (execution.name === 'rp_status_set')
            return '旧状态工具已停用；正文完成后由系统自动维护状态栏，不要重试或改用其他写入工具。';
        const boundary = toolBoundary(execution.agent);
        if (!boundary)
            return;
        // The host owns existence and native/PTC collapse of this reserved
        // transport; each actual SDK sub-dispatch still passes this guard.
        const transport = execution.name === 'run_code';
        if (!transport && !boundary.allows(execution.name))
            return '当前阶段尚未开放该工具。使用已提供的导入、导出或研究入口开始流程；维护任务仅使用其指定工具。';
        if (boundary.kind !== 'maintenance')
            return;
        // The main writer may hand off a discovered defect after publishing prose.
        // Inline maintenance must still not synchronously rewrite author settings.
        const settingArgs = execution.arguments;
        if (boundary.phase === 'after-story' && execution.name === 'rp_setting' && settingArgs && typeof settingArgs === 'object'
            && ['list', 'read', 'repair', 'jobs'].includes(String(settingArgs.action)))
            return;
        if (execution.name === 'rp_setting')
            return '正文后的维护只允许读取设定、提交修补任务和查看结果。';
        const args = execution.arguments;
        if (boundary.legacyImportId && importSteps.includes(execution.name) && args?.import_id !== boundary.legacyImportId)
            return '当前维护只允许继续其实际绑定的导入来源。';
    }), 'roleplay: maintenance tool boundary');
    const taskInstruction = (session) => inlineTaskInstruction(tavernTasks.pending(session), { sessionId: session.id, resident: residentContext(session) });
    ctx.on('agent/pre-step', async (payload, next) => {
        const session = payload?.agent?.session;
        await ensureSessionHistory(session, payload.signal);
        if (!session || !isRoleplaySession(session) || Number(payload.agent?.options?.subagentDepth) > 0)
            return next();
        taskAgents.set(session.id, payload.agent);
        const programmaticGeneration = !!payload.agent.programmaticGeneration;
        const programmaticOpening = programmaticGeneration && payload.step === 1;
        const input = programmaticGeneration ? undefined : inputBinding?.(payload.agent);
        const inputStep = input ? await input.beginStep({ turn: payload.turn, step: payload.step,
            signal: payload.signal ?? AbortSignal.abort('Native step signal missing') }) : undefined;
        const assertInput = () => {
            if (!input || !inputStep)
                return;
            const result = input.checkCurrency(inputStep);
            if (result.kind === 'blocked')
                throw new Error(result.code);
        };
        const imported = importPromptCheckpoint?.(session);
        if (payload.step > 1 && imported && handledImportPrompts.get(session.id) !== imported.importId) {
            retireCompletedTaskContexts(session, payload.turn, imported);
            handledImportPrompts.set(session.id, imported.importId);
        }
        const researchOwner = adaptationScope?.(session) ?? session.id;
        retireCoarseResearchReads(session, researchOwner);
        retireAdaptationReads(session, createAdaptationStore(T.branch).checkpoints(researchOwner, session.id));
        const st = ensureState(session.id);
        if (input && inputStep?.kind === 'management') {
            // The durable phase is interpreted by canonical story/state/memory
            // readers. A model may still emit readable raw chat text in this scope.
            retireRoleplayContexts(session, payload.turn, [], { retireNumerical: true });
            const decision = await next();
            assertInput();
            if (decision.kind !== 'enter')
                return decision;
            await input.prepare(inputStep);
            assertInput();
            const original = input.originalMessages(inputStep);
            const internal = original.length > 0 && original.every(message => message.source?.kind === 'roleplay-tasks'
                && message.source.form === 'phase' && message.source.stage === 'management');
            if (internal) {
                const workflowWake = original.some(message => message.source?.jobId
                    && ['card-import', 'card-export', 'card-convert', 'novel-export'].includes(String(message.source.jobKind)));
                if (workflowWake) {
                    // HTTP only queues the owner. Register its real task/validator before
                    // the first request, then resume it after submission to publish output.
                    try {
                        await resumeCardWorkflows(session, payload.agent, payload.signal);
                        await resumeNovelExports(session, payload.agent, payload.signal);
                    }
                    catch (error) {
                        if (!isInlinePending(error))
                            throw error;
                        assertInput();
                        // Native keeps the original kickoff claim across steps. Replace
                        // that generic text with the current task, including after reads.
                        return { ...decision, messages: inlineTaskMessages(session, 'management', tavernTasks.pending(session), { force: true, resident: residentContext(session) }) };
                    }
                }
                // This wake submits the real rebuild task and then closes its status
                // publication on the next step, without entering Story preparation.
                try {
                    await resumeStatusMaintenance(session, payload.agent);
                }
                catch (error) {
                    if (!isInlinePending(error))
                        throw error;
                }
                // A dedicated card task can finish before this kickoff spends its
                // first request. Native's empty entrance closes that internal turn.
                // Keep the ordinary driver when another input arrived while waiting.
                const settledCardKickoff = payload.step === 1 && original.every(message => message.source?.jobId
                    && ['card-export', 'card-convert'].includes(String(message.source.jobKind)))
                    && !activeCardWorkflow(session) && tavernTasks.pending(session).length === 0
                    && !payload.agent.inbox.hasPending;
                if (settledCardKickoff)
                    return { ...decision, messages: [] };
                // The owning task host already supplied its complete actual envelope.
                // Replacing it with player-management prose loses the queued task
                // input and causes idle wake/retry loops. Never grant this exception
                // to a player message or reconstruct an envelope from guessed ids.
                const originalIds = new Set(original.map(message => message.id));
                return { ...decision, messages: decision.messages.filter(message => message.source?.kind !== 'roleplay-context'
                        && (message.source?.kind !== 'roleplay-tasks' || originalIds.has(message.id))) };
            }
            return { ...decision, messages: [taskPhaseMessage('management', '当前只开放角色卡导入、开场选择及会话管理。按玩家请求调用实际工具并说明结果；本轮回复不作为剧情、状态或记忆事实。'),
                    ...decision.messages.filter(message => message.source?.kind !== 'roleplay-context' && message.source?.kind !== 'roleplay-tasks')] };
        }
        if (input && inputStep?.kind === 'maintenance') {
            // Native has claimed only this owner's after-story envelope. Keep that
            // actual envelope and the original immutable snapshot; do not rebuild
            // Phase A or append the player's original claim for a second time.
            await input.prepare(inputStep, input.persistedCurrency()?.snapshot);
            assertInput();
            const decision = await next();
            assertInput();
            return decision;
        }
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
        const hasUser = programmaticOpening || payload.messages.some(m => m.role === 'user' && m.source?.kind === 'user');
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
            preparation = { schemaVersion: 1, id: inputStep?.currency.preparationId ?? randomUUID(), sessionId: session.id, branchId: session.id, turn: payload.turn,
                messages: inputStep?.kind === 'story' ? [] : cloneRecord(payload.messages),
                ...(inputStep?.kind === 'story' ? { inputPreparation: inputStep.currency } : {}),
                status: 'preparing', createdAt: Date.now(), sourceHash: recordSha256(payload.messages) };
            const stored = rowFacts ? cloneRoleplayTavernLoreDataV1(preparation, 16_777_216, { nodes: 131072, depth: 66 }) : preparation, key = preparationRecordKey(session.id), written = rowFacts?.beforeWrite(session, key, 'task-preparation', stored);
            await T.branch.put(key, stored);
            written?.readback();
            if (rowFacts)
                assertInput();
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
            if (isInlinePending(error) && !programmaticOpening) {
                if (input && inputStep)
                    await input.prepare(inputStep);
                return { kind: 'enter', messages: inlineTaskMessages(session, 'management', tavernTasks.pending(session), { resident: residentContext(session) }) };
            }
            throw error;
        }
        assertInput();
        if (!preparation || preparation.status !== 'preparing') {
            const decision = await next();
            assertInput();
            if (input && inputStep) {
                const snapshot = inputStep.kind === 'story' ? input.persistedCurrency()?.snapshot : undefined;
                await input.prepare(inputStep, snapshot);
            }
            return decision;
        }
        // A deferred stage returns immediately; the main loop is never awaited by
        // its own pre-step handler. The original player message is appended once,
        // only when preparation has committed successfully.
        try {
            // Cold inheritance may replay Source writes and publish its ready marker.
            // Finish that owner before Phase A takes the same Session's Source FIFO.
            await ensureBranch(session);
            // Edit recovery takes the fork lock before Source FIFO. It must finish
            // before Phase A takes that FIFO; otherwise its numerical persistence
            // waits behind the Phase A operation that is awaiting this same recovery.
            await reconcileCanonicalPlayerVariants(session, buildForkLookupIndex(session));
            assertInput();
            return await withImportLock(session.id, '__phase-a__', async () => {
                let decision;
                decision = await next();
                if (decision?.kind !== 'enter')
                    return decision;
                // Resumed preparations may contain last turn's injected context. Keep
                // only the original conversation input, never replay transient lore.
                assertInput();
                // Native owns and checks the exact original claim. This cast adapts its
                // stricter source union to the legacy Core dictionary view, without edits.
                const originalMessages = (inputStep?.kind === 'story'
                    ? input.originalMessages(inputStep) : preparation.messages)
                    .filter(m => m.source?.kind !== 'roleplay-context' && m.source?.kind !== 'roleplay-tasks');
                const staged = { ...payload, messages: cloneRecord(originalMessages), ...(inputStep?.kind === 'story'
                        ? { inputPreparation: inputStep.currency, assertInputCurrent: assertInput } : {}) };
                let candidate = await buildPhaseACandidate(session, staged, st);
                const commit = async () => {
                    assertInput();
                    await candidate.commit();
                    if (input && inputStep)
                        await input.prepare(inputStep, candidate.reference);
                    assertInput();
                    const key = preparationRecordKey(session.id), completed = { ...preparation, status: 'completed', completedAt: Date.now() }, stored = rowFacts ? cloneRoleplayTavernLoreDataV1(completed, 16_777_216, { nodes: 131072, depth: 66 }) : completed, written = rowFacts?.beforeWrite(session, key, 'task-preparation', stored);
                    await T.branch.put(key, stored);
                    written?.readback();
                    if (rowFacts)
                        assertInput();
                };
                const researching = adaptationTurns(eventsOf(session)).has(payload.turn);
                const needsCast = !programmaticOpening && !researching && characterCluster.read(session).enabled
                    && characterRoster(session).length > 0 && !activeCardWorkflow(session);
                const restore = taskPhaseMessage(needsCast ? 'character-cast' : 'story', needsCast
                    ? '本轮角色集群准备：现在还没有进入正文。请根据随后玩家输入选择预计出场的主要人物，先调用 rp_character_cast（无人出场时传空数组）。程序已备好人物上下文，禁止手工搬运。等待角色建议返回及程序的正文阶段通知后再开始写故事，不把选角说明写成正文。如果玩家要求读卡、写卡、管理或诊断，直接执行对应工具，不推演角色。'
                    : researching ? '当前仍在长文本改编创作。按玩家要求继续阅读、问卷或写卡；用 rp_source_status/notes 恢复独立研究资料。尚未进入角色扮演，不把原著或草稿当作已发生剧情。用户要求停止改编回到原卡时调用 rp_source_close。'
                        : '现在进入正常正文阶段。先前维护指令与工具结果仅是历史后台记录，不是待办或剧情；不要重复执行或复述。当前状态和笔记以随后最新锚点为准；以下是玩家原始输入。');
                const originalIds = new Set(originalMessages.map(m => m.id));
                const messagesForCandidate = () => {
                    const messages = candidate.snapshot.contextWindow.rollover
                        ? retainRoleplayWindowContinuity(session, decision.messages, candidate.continuityTailTokens) : decision.messages;
                    const remaining = messages.filter(m => !originalIds.has(m.id) && m.source?.kind !== 'roleplay-tasks' && m.source?.kind !== 'roleplay-context');
                    return { remaining, messages: [restore, ...candidate.anchors, ...originalMessages, ...remaining] };
                };
                if (input && inputStep?.kind === 'story' && input.stagePhaseA(inputStep, {
                    current: () => candidate, messages: () => messagesForCandidate().messages,
                    checkpoint: options => withImportLock(session.id, '__phase-a-checkpoint__', async () => {
                        candidate = await candidate.checkpoint(options);
                        retireRoleplayContexts(session, payload.turn, candidate.anchors);
                        assertInput();
                    }), commit: () => withImportLock(session.id, '__phase-a-commit__', commit),
                })) {
                    retireRoleplayContexts(session, payload.turn, candidate.anchors);
                    return { ...decision, messages: messagesForCandidate().messages };
                }
                // Legacy and no-material domains keep the original Phase-A lifecycle.
                if (candidate.needsCheckpoint)
                    candidate = await candidate.checkpoint();
                await commit();
                retireRoleplayContexts(session, payload.turn, candidate.anchors);
                const { remaining, messages } = messagesForCandidate();
                if (programmaticOpening) {
                    return { ...decision, messages: remaining,
                        systemSections: [...(decision.systemSections ?? []), textOf(restore.content),
                            ...candidate.anchors.map(message => textOf(message.content))] };
                }
                return { ...decision, messages };
            });
        }
        catch (error) {
            st.lastPreparedTurn = -1;
            if (isInlinePending(error) && !programmaticOpening) {
                if (input && inputStep)
                    await input.prepare(inputStep);
                return { kind: 'enter', messages: inlineTaskMessages(session, 'prepare', tavernTasks.pending(session), { resident: residentContext(session) }) };
            }
            // Fail closed: a missing prerequisite cannot admit unprepared prose.
            throw error;
        }
    });
    ctx.on('agent/turn-stopping', async ({ agent, turn, signal }) => {
        const session = agent?.session;
        await ensureSessionHistory(session, signal);
        if (!session || !isRoleplaySession(session) || Number(agent.options?.subagentDepth) > 0)
            return;
        // This Native owner closes the original opening body and its independent
        // genesis. Player Phase B/C requires an admitted player terminal scope.
        if (programOpeningOwner?.(agent, turn))
            return;
        taskAgents.set(session.id, agent);
        const input = agent.programmaticGeneration ? undefined : inputBinding?.(agent);
        if (input?.current()?.kind === 'management')
            return;
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
                    const message = taskPhaseMessage('character-cast', '尚未完成选角，以上文字不是正式剧情。现在调用 rp_character_cast，传主要人物 ID；不要再输出正文或完成报告。', { turn, castReminder: true });
                    if (!input)
                        throw new Error('INPUT_CONTINUATION_SCOPE_INVALID');
                    const result = input.steerOwnedContinuation(message, turn);
                    if (result.kind === 'blocked')
                        throw new Error(result.code);
                    return;
                }
            }
            const preparation = T.branch.get(preparationRecordKey(session.id));
            if (preparation?.status !== 'preparing') {
                const importPrelude = provenImportPreludeAssistants(session, importPromptCheckpoint?.(session), { includeOpenTurn: true });
                let canonical = canonicalAssistantForTurn(session, turn);
                if (canonical && importPrelude.has(canonical.seq))
                    canonical = null;
                if (!canonical) {
                    const hidden = internalTaskSeqs(session);
                    canonical = surfaceEvents(session).findLast(e => e.type === 'assistant/message' && Number(e.data?.turn) === Number(turn) && !e.data?.interrupted && !hidden.has(e.seq) && !importPrelude.has(e.seq) && textOf(e.data?.message?.content).trim()) ?? null;
                    if (canonical)
                        session.append('user/message', taskPhaseMessage('after-story', '正文已经落盘，下面只完成本轮维护义务，不继续剧情。', { storySeq: canonical.seq, turn }), { surfaceOp: 'append' });
                }
                if (canonical) {
                    mark('story-selected');
                    const releaseBatch = tavernTasks.holdBatch(session);
                    let statusWork, decisionWork, admitted;
                    let snapshot = st.snapshots.get(Number(turn)) ?? T.branch.get(keyOf(session.id, `task-snapshot-${turn}`));
                    if (snapshot?.inputPreparation && inputSnapshotCurrent?.(session, snapshot) !== true)
                        throw new Error('INPUT_SNAPSHOT_STALE');
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
            if (pending.length || preparation?.status === 'preparing') {
                const message = taskPhaseMessage(preparation?.status === 'preparing' ? 'prepare' : 'after-story', taskInstruction(session), { turn, dispatchFingerprint: fingerprint });
                const kind = input?.current()?.kind;
                if (input && (kind === 'story' || kind === 'maintenance')) {
                    const result = input.steerOwnedContinuation(message, turn);
                    if (result.kind === 'blocked')
                        throw new Error(result.code);
                }
                else
                    agent.steer(message);
            }
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
