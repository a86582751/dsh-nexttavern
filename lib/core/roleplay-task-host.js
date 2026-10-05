// Generated from runtime/alpha3/src/core/roleplay-task-host.ts; edit the TypeScript source.
import { keyOf, sha256, recordSha256 } from './roleplay-data.js';
import { eventsOf, surfaceEvents, surfaceEntries } from './roleplay-context.js';
import { createCharacterCluster } from './character-cluster.js';
import { createModelPolicy, createTavernTasks, selectedMainRoute, isInlinePending, taskPhaseMessage, taskHash } from './tavern-tasks.js';
export function createRoleplayTaskHost({ T, ctx, config, taskAgents, storyBranchIsActive, statusFixedContext, taskDependenciesCurrent, taskInstruction, getMaintenanceJob, runStatusObligation, STATUS_SYSTEM, DECISION_SYSTEM, ORGANIZE_WORKER_SYSTEM, inputCurrency, inputCurrencyCurrent, inputHistoricalCurrencyCurrent, inputTaskRecoveryBlockCode, currentTaskClaim, assertCardWorkflow, }) {
    const continuationTimers = new Set();
    let disposed = false;
    ctx.effect(() => () => {
        disposed = true;
        for (const timer of continuationTimers)
            clearTimeout(timer);
        continuationTimers.clear();
    }, 'roleplay: task host continuation lifetime');
    const sameModelRoute = (a, b) => Boolean(a?.provider && a?.model && a.provider === b?.provider && a.model === b?.model);
    const canonicalModelRoute = async (selection) => {
        if (!ctx.llm?.resolveModelInfo)
            return selection;
        const info = await ctx.llm.resolveModelInfo(selection.provider, selection.model);
        return { ...selection, provider: info.provider, model: info.id };
    };
    const executedMainRoute = (session, agent) => canonicalModelRoute(selectedMainRoute({ id: session.id, events: eventsOf(session).filter(e => e.type === 'request/header') }, agent, ctx.agentDefaultModel.currentSelection()));
    const modelPolicy = createModelPolicy({ table: T.branch,
        session: id => ctx.sessions.get(id),
        legacy: config.workerProvider && config.workerModel ? { provider: config.workerProvider, model: config.workerModel } : undefined,
        main: (session, agent) => selectedMainRoute(session, agent ?? taskAgents.get(session.id), ctx.agentDefaultModel.currentSelection()),
        canonicalize: canonicalModelRoute,
    });
    const taskStory = (session) => {
        const entries = ctx.get('compaction')?.storyEvidence?.(session) ?? [];
        const bySeq = new Map();
        for (const entry of entries)
            bySeq.set(entry.seq, entry);
        for (const entry of surfaceEntries(session))
            bySeq.set(entry.seq, entry);
        return [...bySeq.values()];
    };
    const characterCluster = createCharacterCluster({ table: T.branch, subagents: ctx.subagents,
        rootOf: session => ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id,
        main: (session, agent) => selectedMainRoute(session, agent, ctx.agentDefaultModel.currentSelection()),
        isCurrent: (session, job) => storyBranchIsActive(session)
            && Number(eventsOf(session).findLast(e => e.type === 'turn/start')?.data?.turn) === Number(job.source.turn)
            && (!job.input?.character || T.cards.get(keyOf(session.id, job.input.character.id))?.content === job.input.character.content),
    });
    const characterRoster = (session) => [...T.cards.entries()].filter(([key, c]) => key.startsWith(`${session.id}__`) && c?.kind !== 'user' && c?.id !== 'user' && c?.enabled !== false)
        .map(([, c]) => ({ id: c.id, name: c.name ?? c.id, content: c.content ?? '' }));
    const clusterLoreVisible = (session, record, before = Infinity) => record.schemaVersion === 1 && surfaceEvents(session).some(e => e.type === 'tool/result' && e.seq < before && !e.data?.error
        && record.callId && (e.data?.message?.source?.callId ?? e.data?.callId) === record.callId);
    const clusterPhase = (session) => {
        const events = eventsOf(session);
        for (let index = events.length - 1; index >= 0; index--) {
            const e = events[index];
            if (e.type === 'turn/start' || e.type === 'turn/end')
                return null;
            if (e.type === 'user/message' && e.data?.source?.kind === 'roleplay-tasks' && e.data.source.form === 'phase')
                return e.data.source;
        }
        return null;
    };
    const clusterJob = (agent) => {
        if (!(Number(agent?.options?.subagentDepth) > 0) && agent?.session?.header?.origin !== 'subagent')
            return null;
        const descriptor = eventsOf(agent.session).findLast(e => e.type === 'subagent/descriptor' && e.seq >= Number(agent.session.inheritedEventCount ?? 0));
        const id = agent.options?.tavernTaskId ?? /^Tavern:([a-f0-9]{64}):/.exec(descriptor?.data?.label ?? '')?.[1];
        const job = id ? T.branch.get(`tavern_job__${id}`) : null;
        return job?.kind === 'character' ? job : null;
    };
    function taskSourceCurrent(session, job, historical = false) {
        if (disposed || ctx.sessions.get(session.id) !== session)
            return false;
        const source = job.source;
        const currencyCurrent = historical ? inputHistoricalCurrencyCurrent : inputCurrencyCurrent;
        // Reject stale prepared work before projecting the active branch's
        // history; cold task polling must not spend that scan on expired currency.
        if (source.inputPreparation && currencyCurrent?.(session, source.inputPreparation) !== true)
            return false;
        if (!storyBranchIsActive(session))
            return false;
        if (historical && (!source.inputPreparation || source.preparationId
            && source.preparationId !== source.inputPreparation.preparationId))
            return false;
        if (!historical && source.preparationId && T.branch.get(keyOf(session.id, 'task-preparation'))?.id !== source.preparationId)
            return false;
        const hash = source.hashKind === 'taskHash' ? (value) => recordSha256(value) : sha256;
        const live = new Map(taskStory(session).map(e => [e.seq, hash(e.text)]));
        if (source.workflowId) {
            const workflow = T.branch.get(`${source.workflowType === 'card' ? 'tavern_cardjob__' : 'tavern_novel__'}${source.workflowId}`);
            if (!workflow || workflow.generation !== source.generation || ['cancelled', 'stale'].includes(workflow.status))
                return false;
        }
        return (source.events ?? []).every(e => live.get(e.seq) === e.hash)
            && (!source.fixedHash || source.fixedHash === recordSha256(statusFixedContext(session)))
            && taskDependenciesCurrent(T, session.id, source.dependencies);
    }
    const tavernTasks = createTavernTasks({ table: T.branch, policy: modelPolicy, subagents: ctx.subagents,
        isCurrent: (session, job) => taskSourceCurrent(session, job),
        isHistoricalResultCurrent: (session, job) => taskSourceCurrent(session, job, true),
        canPublishResult: (session, job, fromNativeResult) => {
            const source = job.source;
            if (!source.inputPreparation)
                return true;
            return taskSourceCurrent(session, job) || (job.status === 'completed' || fromNativeResult && job.background === true
                && job.kind === 'memory' && job.input?.taskStage === 'background-notes') && taskSourceCurrent(session, job, true);
        },
    });
    function resolveCurrentCardImport(session, exec) {
        const actual = exec.agent;
        if (!actual?.session)
            return undefined;
        exec.signal?.throwIfAborted();
        const child = Number(actual.options?.subagentDepth) > 0 || actual.session.header?.origin === 'subagent';
        let reference;
        if (child) {
            const descriptor = eventsOf(actual.session).findLast(event => event.type === 'subagent/descriptor'
                && event.seq >= Number(actual.session.inheritedEventCount ?? 0)), match = /^Tavern:([a-f0-9]{64}):([a-f0-9-]{36})$/.exec(String(descriptor?.data?.label ?? ''));
            if (!match)
                return undefined;
            reference = { taskId: match[1], generation: match[2], childSessionId: actual.session.id };
        }
        else {
            const claim = currentTaskClaim?.(actual);
            if (!claim)
                return undefined;
            reference = claim;
        }
        const main = taskAgents.get(session.id);
        if (disposed || ctx.sessions.get(session.id) !== session || ctx.sessions.get(actual.session.id) !== actual.session
            || !main || !child && main !== actual)
            throw Error('CARD_IMPORT_TASK_SESSION_CHANGED');
        const registered = tavernTasks.resolveRegisteredCardImport(session, main, reference), source = registered.task.source, job = T.branch.get('tavern_cardjob__' + source.workflowId);
        if (!job || job.kind !== 'card-import')
            throw Error('CARD_IMPORT_WORKFLOW_OWNER_CHANGED');
        assertCardWorkflow(session, { workflowId: source.workflowId, workflowGeneration: source.generation,
            rawSha256: job.source.sha256 });
        const assertCurrent = () => {
            exec.signal?.throwIfAborted();
            if (disposed || ctx.sessions.get(session.id) !== session || ctx.sessions.get(actual.session.id) !== actual.session
                || taskAgents.get(session.id) !== main)
                throw Error('CARD_IMPORT_TASK_SESSION_CHANGED');
            registered.assertCurrent();
        };
        return { session, job, assertCurrent };
    }
    async function nativeTask({ session, agent, system, user, promptContext, format = 'json', kind, signal, timeoutMs, maxTokens, validate, source: providedSource, selection, generationKey, tools: allowedTools, taskStage, background = false, onResult, onAdmission }) {
        if (!session)
            throw new Error('酒馆任务缺少所属会话');
        if (!agent && !taskAgents.has(session.id)) {
            const found = await ctx.sessionController.resolveAgent?.(session.id);
            if (found?.agent)
                agent = found.agent;
        }
        if (agent)
            taskAgents.set(session.id, agent);
        const main = agent ?? taskAgents.get(session.id);
        const assertIdleRecovery = () => {
            // Running Phase B owns its still-pending terminal. Only a new idle
            // recovery must respect the predecessor's durable refusal before writes.
            const code = main?.status === 'idle' ? inputTaskRecoveryBlockCode?.(session) : undefined;
            if (code)
                throw Error(code);
        };
        assertIdleRecovery();
        kind = kind ?? (system === STATUS_SYSTEM ? 'status' : system === DECISION_SYSTEM ? 'decision' : system === ORGANIZE_WORKER_SYSTEM ? 'novel-export' : 'memory');
        // Nonces protect prompt boundaries, but are not a changing task input.
        const requestKey = { system, user: String(user).replace(/(<\/?rp-content:)[0-9a-f]{36}(>)/g, '$1NONCE$2'), generationKey };
        // A Status obligation can resume after the next input has replaced hot
        // Work. Reuse its completed task's original association; request still
        // checks the real historical result and publication contracts below.
        const completed = kind === 'status' && !providedSource ? tavernTasks.list(session)
            .filter(job => job.kind === kind && job.status === 'completed'
            && taskHash({ sessionId: session.id, kind, source: job.source, input: requestKey }) === job.id)
            .sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0) || a.id.localeCompare(b.id))[0] : undefined;
        const source = completed ? completed.source : (() => {
            const preparation = T.branch.get(keyOf(session.id, 'task-preparation')), currency = inputCurrency?.(session);
            return { ...(providedSource ?? { events: taskStory(session).map(e => ({ seq: e.seq, hash: sha256(e.text) })),
                    ...(kind === 'status' ? { fixedHash: recordSha256(statusFixedContext(session)) } : {}),
                    ...(!background && preparation?.sessionId === session.id && preparation.status === 'preparing'
                        ? { preparationId: preparation.id } : {}) }), ...(currency ? { inputPreparation: currency } : {}) };
        })();
        try {
            return await tavernTasks.request({ session, agent: main, kind, source, input: { system, user, format, taskStage }, promptContext, requestKey, format, signal, timeoutMs, maxTokens, selection, background, tools: allowedTools, onResult, onAdmission,
                validate: validate ?? (value => {
                    if (format === 'text') {
                        if (typeof value !== 'string' || !value.trim())
                            throw new Error('任务文本为空');
                        return value;
                    }
                    if (!value || typeof value !== 'object' || Array.isArray(value))
                        throw new Error('任务需要 JSON 对象');
                    return value;
                }),
            });
        }
        catch (error) {
            if (isInlinePending(error))
                assertIdleRecovery();
            if (isInlinePending(error) && kind === 'memory' && format === 'text')
                await T.branch.put(keyOf(session.id, 'task-memory-resume'), { schemaVersion: 1, sessionId: session.id, status: 'pending', taskStage: taskStage ?? 'notes', source: { taskId: error.jobId }, updatedAt: Date.now() });
            if (isInlinePending(error) && !disposed && !signal?.aborted && main?.status === 'idle' && typeof main.steer === 'function') {
                const timer = setTimeout(() => {
                    continuationTimers.delete(timer);
                    try {
                        const current = () => !disposed && !signal?.aborted && ctx.sessions.get(session.id) === session
                            && main.session === session && taskAgents.get(session.id) === main && main.status === 'idle';
                        // A timer can outlive Native idle and Session replacement. Keep
                        // old instances out of each reader and the final steer boundary.
                        if (!current() || !tavernTasks.pending(session).length)
                            return;
                        if (!current())
                            return;
                        const message = taskPhaseMessage('management', taskInstruction(session));
                        if (!current())
                            return;
                        // A stopped or unresolved predecessor can become known after this
                        // timer was queued. Preserve the pending job and end this wake.
                        if (inputTaskRecoveryBlockCode?.(session))
                            return;
                        main.steer(message);
                    }
                    catch (steeringError) {
                        try {
                            ctx.logger?.warn?.(`roleplay: task continuation steering failed: ${String(steeringError)}`);
                        }
                        catch { /* A reporting failure must not escape an owned timer. */ }
                    }
                }, 0);
                continuationTimers.add(timer);
                timer.unref?.();
            }
            throw error;
        }
    }
    async function resumeMemoryWork(session, agent, signal) {
        const key = keyOf(session.id, 'task-memory-resume'), record = T.branch.get(key);
        if (record?.sessionId !== session.id || record.status !== 'pending')
            return;
        const engine = ctx.get('compaction');
        if (typeof engine?.resumeTask !== 'function')
            return;
        await engine.resumeTask(agent, signal, record.taskStage);
        await T.branch.put(key, { ...record, status: 'completed', completedAt: Date.now() });
        const maintenance = getMaintenanceJob(session.id);
        if (maintenance?.kind === 'notes' && maintenance.state !== 'completed') {
            maintenance.state = 'completed';
            maintenance.error = null;
            maintenance.finishedAt = Date.now();
        }
    }
    async function resumeStatusMaintenance(session, agent) {
        const job = getMaintenanceJob(session.id);
        if (job?.kind !== 'status-rebuild' || job.state !== 'waiting-main')
            return;
        const event = eventsOf(session).find(e => e.seq === job.atSeq);
        const result = await runStatusObligation(session, event, 'maintenance-resume', { agent });
        if (result?.state === 'waiting-main')
            throw Object.assign(new Error('状态生成等待主循环'), { code: 'TAVERN_INLINE_PENDING' });
        if (result?.state === 'completed' && result.publicationState === 'published') {
            job.state = 'completed';
            job.error = null;
            job.finishedAt = Date.now();
        }
        else {
            job.state = 'failed';
            job.error = '状态结果尚未发布，可重试';
        }
    }
    return { sameModelRoute, canonicalModelRoute, executedMainRoute, modelPolicy, taskStory, characterCluster, characterRoster, clusterLoreVisible, clusterPhase, clusterJob, tavernTasks, resolveCurrentCardImport, nativeTask, resumeMemoryWork, resumeStatusMaintenance };
}
