// Generated from runtime/alpha3/src/core/roleplay-job-routes.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { taskPhaseMessage, taskValidationFailure, isInlinePending } from './tavern-tasks.js';
import { decodeTavernCard } from './tavern-card.js';
import { jsonResponse } from './roleplay-state.js';
import { assertWorkspaceSession } from './roleplay-context.js';
import { assertSteeringAgent } from './roleplay-task-tools.js';
export function registerJobRoutes({ ctx, T, resolveRoleplaySession, novelExports, modelPolicy, beginCardWorkflow, cardWorkflows, cardWorkflowKey, tavernTasks, taskAgents, libraryFor, migrateResources }) {
    const latestChildJobs = () => {
        const latest = new Map();
        for (const [key, raw] of T.branch.entries()) {
            if (!key.startsWith('tavern_job__'))
                continue;
            const child = raw, parentId = child.source?.workflowId, previous = latest.get(parentId);
            if (!previous || (child.createdAt ?? 0) - (previous.createdAt ?? 0) > 0)
                latest.set(parentId, child);
        }
        return latest;
    };
    const publicJob = (raw, children) => {
        const job = raw;
        const child = job.source?.workflowId ? null : (children ?? latestChildJobs()).get(job.id);
        return { id: job.id, parentJobId: job.source?.workflowId ?? null, kind: job.kind, status: job.status, progress: job.progress,
            execution: child?.execution ?? job.execution, actualRoute: child?.actualRoute ?? job.actualRoute,
            error: job.error ?? null, failure: taskValidationFailure(job) ?? job.failure ?? null, validationFailures: job.validationFailures ?? 0,
            resourceId: job.resourceId ?? job.result?.resourceId ?? null, createdAt: job.createdAt, completedAt: job.completedAt ?? null,
            failedAt: job.failedAt ?? (job.status === 'failed' ? job.updatedAt ?? null : null) };
    };
    async function startExportJob(session, kind, agent, sourceFile) {
        assertWorkspaceSession(session);
        assertSteeringAgent(agent);
        const job = kind === 'novel-export' ? await novelExports.begin(session, await modelPolicy.resolve(session, kind, agent))
            : await beginCardWorkflow(session, kind, sourceFile, agent);
        agent.steer(taskPhaseMessage('management', '请完成酒馆管理中刚启动的任务。不要续写剧情。', { jobId: job.id, jobKind: kind }));
        return job;
    }
    ctx.effect(() => ctx.connection.fetch.register({ path: '/api/roleplay/jobs', methods: ['GET', 'POST'], fetch: async (request) => {
            try {
                const url = new URL(request.url), body = request.method === 'POST' ? await request.json() : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                if (!body) {
                    const jobs = [...cardWorkflows(session), ...await novelExports.refresh(session), ...tavernTasks.list(session)];
                    const children = jobs.length ? latestChildJobs() : undefined;
                    return jsonResponse(200, { ok: true, jobs: jobs.map(job => publicJob(job, children)) });
                }
                const found = await ctx.sessionController.resolveAgent(session.id), agent = found?.agent;
                if (!agent)
                    return jsonResponse(409, { ok: false, error: '当前会话代理尚未就绪' });
                taskAgents.set(session.id, agent);
                if (body.action) {
                    if (body.action !== 'retry' && body.action !== 'cancel')
                        throw new Error('未知任务操作');
                    const novel = novelExports.list(session).find(j => j.id === body.jobId), card = cardWorkflows(session).find(j => j.id === body.jobId);
                    let job;
                    if (novel)
                        job = await novelExports[body.action](session, body.jobId);
                    else if (card) {
                        if (card.status === 'completed')
                            return jsonResponse(200, { ok: true, job: publicJob(card) });
                        job = { ...card, generation: randomUUID(), status: body.action === 'cancel' ? 'cancelled' : 'queued', error: null };
                        await T.branch.put(cardWorkflowKey(card.id), job);
                        if (body.action === 'retry')
                            for (const [recordKey, record] of [...T.branch.entries()].filter(([, v]) => v?.workflowId === card.id))
                                await T.branch.put(recordKey, { ...record, workflowGeneration: job.generation });
                    }
                    else
                        job = await tavernTasks[body.action](session, body.jobId);
                    if (novel || card)
                        for (const task of tavernTasks.list(session).filter(t => t.source?.workflowId === job.id && !['completed', 'cancelled', 'stale'].includes(t.status)))
                            await tavernTasks.cancel(session, task.id);
                    if (body.action === 'retry')
                        agent.steer(taskPhaseMessage('management', '继续尚未完成的酒馆任务。'));
                    return jsonResponse(200, { ok: true, job: publicJob(job) });
                }
                if (!['novel-export', 'card-export', 'card-import'].includes(body.kind))
                    throw new Error('未知任务用途');
                assertWorkspaceSession(session);
                const sourceFile = body.resourceId ? libraryFor(session).metadata(body.resourceId).path : body.sourceFile;
                const job = await startExportJob(session, body.kind, agent, sourceFile);
                return jsonResponse(202, { ok: true, job: publicJob(job) });
            }
            catch (error) {
                return jsonResponse(400, { ok: false, error: String(error.message) });
            }
        } }), 'roleplay: persistent jobs route');
    const resourceRoutes = [
        ['/api/roleplay/resources', async (session) => { const lib = await migrateResources(session); return jsonResponse(200, { ok: true, resources: lib.list(), pending: lib.pending() }); }],
        ['/api/roleplay/resource', async (session, url) => {
                const lib = libraryFor(session), id = url.searchParams.get('resourceId'), resource = lib.metadata(id);
                let text;
                if (resource.type === 'image/png')
                    text = JSON.stringify(decodeTavernCard(Buffer.from(await lib.openDownload(id).arrayBuffer()), '.png').data, null, 2);
                else
                    try {
                        text = lib.read(id).text;
                    }
                    catch { }
                return jsonResponse(200, { ok: true, resource, text });
            }],
        ['/api/roleplay/download', async (session, url) => libraryFor(session).openDownload(url.searchParams.get('resourceId'))],
    ];
    for (const [path, handler] of resourceRoutes)
        ctx.effect(() => ctx.connection.fetch.register({ path, methods: ['GET'], fetch: async (request) => {
                try {
                    const url = new URL(request.url), session = await resolveRoleplaySession(url.searchParams.get('sessionId'));
                    if (!session)
                        return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                    assertWorkspaceSession(session);
                    return await handler(session, url);
                }
                catch {
                    return jsonResponse(404, { ok: false, error: '资源不存在、损坏或不属于当前工作区' });
                }
            } }), `roleplay: resource route ${path}`);
    return { startExportJob };
}
export function registerMaintenanceRoute({ ctx, resolveRoleplaySession, maintenanceJobs, latestStatusEvent, runStatusObligation, selectedStatusRecord }) {
    ctx.effect(() => ctx.connection.fetch.register({
        path: '/api/roleplay/maintenance', methods: ['POST'],
        fetch: async (request) => {
            try {
                const body = await request.json();
                const session = await resolveRoleplaySession(body.sessionId);
                if (!session)
                    return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' });
                if (body.action === 'status')
                    return jsonResponse(200, { ok: true, job: maintenanceJobs.get(session.id) ?? null });
                const active = maintenanceJobs.get(session.id);
                if (active?.state === 'running' || active?.state === 'waiting-main')
                    return jsonResponse(200, { ok: true, job: active });
                const found = await ctx.sessionController.resolveAgent(session.id);
                if (!found?.agent || 'error' in found)
                    return jsonResponse(404, { ok: false, error: '会话尚未就绪' });
                const agent = found.agent;
                if (found.agent.status === 'running')
                    return jsonResponse(409, { ok: false, error: '请等待当前剧情生成结束' });
                const kind = body.action === 'status-rebuild' ? 'status-rebuild' : 'notes';
                const job = { id: randomUUID(), kind, state: 'running', startedAt: Date.now() };
                maintenanceJobs.set(session.id, job);
                Promise.resolve().then(async () => {
                    if (kind === 'notes') {
                        const engine = agent.ctx?.get?.('compaction') ?? ctx.get('compaction');
                        if (!engine?.organizeNow)
                            throw new Error('导演笔记服务尚未就绪');
                        job.result = await engine.organizeNow(agent);
                    }
                    else {
                        const event = latestStatusEvent(session);
                        if (!event)
                            throw new Error('当前分支缺少已完成正文');
                        job.atSeq = event.seq;
                        const result = await runStatusObligation(session, event, 'maintenance', { force: true, agent });
                        if (result?.state === 'waiting-main') {
                            job.state = 'waiting-main';
                            return;
                        }
                        if (result?.state !== 'completed' || result.publicationState !== 'published' ||
                            selectedStatusRecord(session)?.provenance?.triggerId !== result.trigger.id) {
                            throw new Error('状态栏生成或发布未完成，请重试');
                        }
                        job.result = { triggerId: result.trigger.id, atSeq: event.seq };
                    }
                    job.state = 'completed';
                }).catch((error) => { job.state = isInlinePending(error) ? 'waiting-main' : 'failed'; job.error = isInlinePending(error) ? null : String(error?.message ?? error); })
                    .finally(() => { job.finishedAt = Date.now(); });
                return jsonResponse(202, { ok: true, job });
            }
            catch (error) {
                return jsonResponse(500, { ok: false, error: String(error?.message ?? error) });
            }
        },
    }), 'roleplay: explicit maintenance jobs');
}
