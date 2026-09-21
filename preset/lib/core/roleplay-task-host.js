// Generated from runtime/alpha3/src/core/roleplay-task-host.ts; edit the TypeScript source.
import { keyOf, sha256, recordSha256 } from './roleplay-data.js';
import { eventsOf, surfaceEvents, surfaceEntries } from './roleplay-context.js';
import { createCharacterCluster } from './character-cluster.js';
import { createModelPolicy, createTavernTasks, selectedMainRoute, isInlinePending, taskPhaseMessage } from './tavern-tasks.js';
export function createRoleplayTaskHost({ T, ctx, config, taskAgents, storyBranchIsActive, statusFixedContext, taskDependenciesCurrent, taskInstruction, getMaintenanceJob, runStatusObligation, STATUS_SYSTEM, DECISION_SYSTEM, ORGANIZE_WORKER_SYSTEM }) {
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
            if (e.type === 'user/message' && e.data?.source?.plugin === 'roleplay-tasks' && e.data.source.form === 'phase')
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
    const tavernTasks = createTavernTasks({ table: T.branch, policy: modelPolicy, subagents: ctx.subagents,
        isCurrent: (session, job) => {
            const source = job.source;
            if (!storyBranchIsActive(session))
                return false;
            if (source.preparationId && T.branch.get(keyOf(session.id, 'task-preparation'))?.id !== source.preparationId)
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
        },
    });
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
        kind = kind ?? (system === STATUS_SYSTEM ? 'status' : system === DECISION_SYSTEM ? 'decision' : system === ORGANIZE_WORKER_SYSTEM ? 'novel-export' : 'memory');
        const preparation = T.branch.get(keyOf(session.id, 'task-preparation'));
        const source = providedSource ?? { events: taskStory(session).map(e => ({ seq: e.seq, hash: sha256(e.text) })), ...(kind === 'status' ? { fixedHash: recordSha256(statusFixedContext(session)) } : {}),
            ...(!background && preparation?.sessionId === session.id && preparation.status === 'preparing' ? { preparationId: preparation.id } : {}) };
        // Nonces protect prompt boundaries, but are not a changing task input.
        const requestKey = { system, user: String(user).replace(/(<\/?rp-content:)[0-9a-f]{36}(>)/g, '$1NONCE$2'), generationKey };
        try {
            return await tavernTasks.request({ session, agent: agent ?? taskAgents.get(session.id), kind, source, input: { system, user, format, taskStage }, promptContext, requestKey, format, signal, timeoutMs, maxTokens, selection, background, tools: allowedTools, onResult, onAdmission,
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
            if (isInlinePending(error) && kind === 'memory' && format === 'text')
                await T.branch.put(keyOf(session.id, 'task-memory-resume'), { schemaVersion: 1, sessionId: session.id, status: 'pending', taskStage: taskStage ?? 'notes', source: { taskId: error.jobId }, updatedAt: Date.now() });
            const main = agent ?? taskAgents.get(session.id);
            if (isInlinePending(error) && !signal?.aborted && main?.status === 'idle' && typeof main.steer === 'function') {
                const timer = setTimeout(() => { if (!signal?.aborted && main.status === 'idle' && tavernTasks.pending(session).length)
                    main.steer(taskPhaseMessage('management', taskInstruction(session))); }, 0);
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
    return { sameModelRoute, canonicalModelRoute, executedMainRoute, modelPolicy, taskStory, characterCluster, characterRoster, clusterLoreVisible, clusterPhase, clusterJob, tavernTasks, nativeTask, resumeMemoryWork, resumeStatusMaintenance };
}
