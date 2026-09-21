// Generated from runtime/alpha3/src/core/roleplay-diagnosis.ts; edit the TypeScript source.
import { keyOf } from './roleplay-data.js';
import { eventsOf, readRoleplayActivity } from './roleplay-context.js';
import { taskValidationFailure } from './tavern-tasks.js';
export function registerRoleplayDiagnosis({ ctx, T, simpleTool, sessionOf, modelPolicy, tavernTasks, telemetry, preparationRecordKey, characterCluster, characterRoster, memorySettingsPolicy, enhancements }) {
    ctx.effect(() => ctx.tools.register(simpleTool('rp_diagnose', '按需查看当前酒馆会话的只读诊断概览：模型路由、四层记忆/Embedding配置与可用进度、预设、长文本研究摘要、任务及近期调用。冷索引状态可能不可见；不启动建库或测试模型。用于玩法/故障问答，不用于普通剧情，不重试任务或修改状态。', { type: 'object', properties: {}, additionalProperties: false }, async (_args, exec) => {
        const session = await sessionOf(exec);
        const policy = await modelPolicy.read(session, exec.agent);
        const route = (r) => r ? { provider: r.provider ?? null, model: r.model ?? null, reasoningEffort: r.reasoningEffort ?? null } : null;
        const jobs = tavernTasks.list(session);
        const status = T.status.get(keyOf(session.id, 'panel'));
        const memory = T.memory.get(keyOf(session.id, 'head'));
        // Whitelist projections: never return raw errors, request payloads,
        // credentials, authored HTML, story text or full job sources.
        const errorCode = (e) => {
            const value = typeof e === 'string' ? e : e?.code ?? e?.message ?? '';
            return String(value).match(/\b(?:TASK_TIMEOUT|TRANSPORT|AUTHENTICATION_ERROR|AUTH_ERROR|INVALID_API_KEY|INSUFFICIENT_QUOTA|RATE_LIMIT|INVALID_REQUEST|OVERLOADED|ABORTED)\b/)?.[0] ?? (e ? 'REASON_NOT_PROVIDED' : null);
        };
        const turnStart = eventsOf(session).findLast(e => e.type === 'turn/start')?.time ?? Date.now();
        const byId = new Map();
        for (const call of telemetry.calls())
            if (call.ownerSessionId === session.id && call.startedAt < turnStart)
                byId.set(call.id, call);
        const historyCalls = [...byId.values()];
        const calls = historyCalls.sort((a, b) => b.startedAt - a.startedAt).slice(0, 12);
        const stamp = (t) => Number.isFinite(t) ? new Date(t).toISOString() : null;
        const formatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const local = (t) => Number.isFinite(t) ? formatter.format(t) : null;
        const visibleJobs = jobs.sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).slice(0, 12);
        const attemptsByJob = new Map(visibleJobs.map(job => [job.id, { count: 0, failed: 0, started: Infinity, completed: null, models: new Set() }]));
        for (const call of historyCalls) {
            const ids = new Set([call.source?.jobId, ...(call.source?.jobIds ?? [])]);
            for (const id of ids) {
                const attempts = id == null ? undefined : attemptsByJob.get(id);
                if (!attempts)
                    continue;
                attempts.count++;
                if (call.status === 'failed')
                    attempts.failed++;
                attempts.started = Math.min(attempts.started, call.startedAt);
                if (Number.isFinite(call.durationMs)) {
                    const end = call.startedAt + call.durationMs;
                    attempts.completed = attempts.completed === null ? end : Math.max(attempts.completed, end);
                }
                attempts.models.add(`${call.provider}/${call.model}`);
            }
        }
        const activity = readRoleplayActivity(session, T.branch.get(preparationRecordKey(session.id)), tavernTasks.activity(session));
        return {
            schemaVersion: 1, sessionId: session.id, branchId: session.id, observedAt: Date.now(), timeZone: 'Asia/Shanghai (UTC+08:00)', interaction: 'management-diagnosis; current diagnostic calls excluded from historical statistics',
            capabilities: { legacyStatusTool: false, passiveWorldbook: true, hardWindowNotesHistory: true, fourLayerMemory: true, characterCluster: true, narrativePresets: true, longTextCardAdaptation: true, embeddingRetrieval: true },
            enhancements: enhancements ? await enhancements(session) : null,
            characterCluster: { enabled: characterCluster.read(session).enabled, characters: characterRoster(session).map(({ id, name }) => ({ id, name })), settings: characterCluster.read(session) },
            models: { main: route(policy.main), allMain: policy.effective.allMain, inheritedFrom: policy.inheritedFrom,
                routes: Object.fromEntries(['status', 'decision', 'memory'].map(k => [k, route(policy.effective.allMain ? policy.main : policy.effective.routes[k] ?? policy.main)])),
                globalRevision: policy.global.revision, sessionRevision: policy.session?.revision ?? null },
            window: Object.fromEntries(['contextWindowTokens', 'continuityTailTokens', 'autoNotesEveryTurns'].map(k => [k, memorySettingsPolicy(session.id).effective[k]])),
            activity: { turn: activity.turn, running: activity.running, stage: activity.stage, elapsedMs: activity.elapsedMs,
                storySeq: activity.storySeq, backgroundJobs: activity.backgroundJobs?.map(j => ({ kind: j.kind, status: j.status, createdAt: j.createdAt })),
                pendingPlayer: !!activity.pendingPlayer },
            saved: { statusPresent: !!status, statusSource: status?.source ? { turnId: status.source.turnId, sourceSeqs: status.source.sourceSeqs } : null,
                memoryVersion: memory?.version ?? null, deltaCount: memory?.deltas?.length ?? 0, pendingConfirmationCount: memory?.pendingConfirmations?.length ?? 0 },
            jobs: visibleJobs.map(j => {
                const attempts = attemptsByJob.get(j.id);
                const started = attempts.count ? attempts.started : null;
                const completed = attempts.completed;
                return { id: j.id, kind: j.kind, status: j.status, background: j.background === true,
                    createdAt: stamp(j.createdAt), completedAt: stamp(j.completedAt), failedAt: stamp(j.failedAt ?? (j.status === 'failed' ? j.updatedAt : null)), execution: j.execution ?? j.selection?.execution ?? null,
                    requested: route(j.actualRoute ?? j.selection?.actualRoute), errorCode: taskValidationFailure(j)?.code ?? errorCode(j.error),
                    failure: taskValidationFailure(j), validationFailures: j.validationFailures ?? 0,
                    recordedCalls: attempts.count, failedCalls: attempts.failed,
                    callSpanSeconds: started !== null && completed !== null ? Math.round((completed - started) / 10) / 100 : null,
                    callStartedAtLocal: local(started), callCompletedAtLocal: local(completed),
                    actualModels: [...attempts.models] };
            }),
            calls: calls.map(r => ({ id: r.id, kind: r.kind, provider: r.provider, model: r.model, status: r.status,
                startedAt: stamp(r.startedAt), startedAtLocal: local(r.startedAt), durationSeconds: Number.isFinite(r.durationMs) ? r.durationMs / 1000 : null, firstTokenSeconds: Number.isFinite(r.firstTokenMs) ? r.firstTokenMs / 1000 : null,
                usage: r.usage ? { inputTokens: r.usage.inputTokens ?? null, outputTokens: r.usage.outputTokens ?? null, cacheReadTokens: r.usage.cacheReadTokens ?? null } : null,
                jobId: r.source?.jobId ?? null, errorCode: errorCode(r.error) })),
            coverage: '仅当前会话已记录调用；缺失历史与无明确错误原因不能推断。未主动重试或发起模型请求。',
        };
    })), 'roleplay: read-only diagnosis');
}
