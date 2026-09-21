// Generated from runtime/alpha3/src/core/roleplay-status.ts; edit the TypeScript source.
import { textAlias, normalizeStatusOption, authoredStatusTemplate, statusPanelForSpec, normalizeStatusRecord, normalizeDecisionRecord, } from './roleplay-status-presentation.js';
import { randomUUID } from 'node:crypto';
import { maintenancePrompt } from './tavern-task-context.js';
import { keyOf, sha256, recordSha256, textOf, provenanceSeq, estimateTokens } from './roleplay-data.js';
import { eventsOf, surfaceEntries, canonicalAssistantForTurn } from './roleplay-context.js';
import { importedStoryProjection } from '../memory/memory-provenance.js';
import { fenceCardContent } from './tavern-card.js';
import { TaskValidationError, isInlinePending } from './tavern-tasks.js';
import { importActiveKey } from './roleplay-import.js';
export function createRoleplayStatus(deps) {
    const { ctx, storyBranchIsActive, T, cloneBranchRecord, taskCancellation, ensureBranch, modelPolicy, sameModelRoute, retrieveWorldbook, cfg, llmJson, resolveRoute, STATUS_SYSTEM, DEFAULT_CONFIG, importRecordKey, spanText, } = deps;
    // Status owns a separate turn-end transaction. Neither Phase-A snapshots nor
    // memory/continuity worker success are prerequisites for this obligation.
    const statusJobs = new Map();
    const statusLocks = new Map();
    const statusRetryTimers = new Map();
    const statusRetryCounts = new Map();
    const statusRunStartSeq = new Map();
    const statusRecoveredSessions = new Set();
    let statusDisposed = false;
    ctx.effect(() => () => {
        statusDisposed = true;
        for (const timer of statusRetryTimers.values())
            clearTimeout(timer);
        statusRetryTimers.clear();
    }, 'roleplay: status retry cleanup');
    // Retry and publication share one branch queue so a late worker cannot overwrite newer status.
    const withStatusLock = async (branchId, fn) => {
        const prior = statusLocks.get(branchId) ?? Promise.resolve();
        const current = prior.catch(() => {
        }).then(fn);
        statusLocks.set(branchId, current);
        try {
            return await current;
        }
        finally {
            if (statusLocks.get(branchId) === current)
                statusLocks.delete(branchId);
        }
    };
    const statusTaskKey = (session, event) => keyOf(session.id, `turn-${Number(event.data.turn)}-${Number(event.seq)}`);
    const statusSource = (session, event) => {
        if (!storyBranchIsActive(session))
            return null;
        if (!event || canonicalAssistantForTurn(session, event.data?.turn)?.seq !== event.seq)
            return null;
        const start = eventsOf(session).findLast(item => item.type === 'turn/start' &&
            Number(item.data?.turn) === Number(event.data.turn)
            && item.seq < event.seq);
        if (!start)
            return null;
        const opening = importedStoryProjection(eventsOf(session), [...(session.surface?.nodes ?? [])]);
        const boundary = opening.prose.has(event.seq) ? opening.boundaries.findLast(item => item.turn === Number(event.data.turn)
            && item.storyPhaseSeq < event.seq) : undefined;
        // An imported opening has a program activation anchor, not a fictional
        // player action manufactured from the earlier authoring questionnaire.
        const user = boundary ? {
            seq: boundary.storyPhaseSeq, text: ''
        } : surfaceEntries(session).filter(entry => entry.kind === 'user' && entry.seq > start.seq && entry.seq < event.seq).at(-1);
        if (!user)
            return null;
        return {
            branchId: session.id,
            turnId: Number(event.data.turn),
            assistantSeq: Number(event.seq),
            sourceSeqs: [Number(user.seq), Number(event.seq)],
            sourceHash: recordSha256({
                user: user.text, narrative: textOf(event.data.message?.content)
            }),
        };
    };
    const statusSourceLive = (session, event, source) => !statusDisposed
        && recordSha256(statusSource(session, event)) === recordSha256(source);
    const selectedStatusRecord = (session) => {
        const record = normalizeStatusRecord(T.status.get(keyOf(session.id, 'panel')));
        if (!record?.provenance)
            return record;
        const event = eventsOf(session).find(item => item.seq === record.atSeq);
        const source = statusSource(session, event);
        if (!source || record.sessionId !== session.id || record.stale
            ||
                source.sourceHash !== record.provenance.sourceHash
            ||
                recordSha256(source.sourceSeqs) !== recordSha256(record.provenance.sourceSeqs))
            return null;
        return record;
    };
    const latestStatusEvent = (session) => {
        for (const entry of surfaceEntries(session).reverse()) {
            if (entry.kind !== 'assistant')
                continue;
            const event = canonicalAssistantForTurn(session, entry.turn);
            if (event)
                return event;
        }
        return null;
    };
    const selectedStatusGeneration = (session) => {
        const event = latestStatusEvent(session);
        const record = event ? cloneBranchRecord(T.status.get(statusTaskKey(session, event))) : null;
        if (record && !statusSourceLive(session, event, record.source))
            return {
                ...record, state: 'stale', result: null
            };
        return record ?? null;
    };
    const statusFixedContext = (session) => {
        const prefix = `${session.id}__`;
        const entries = (table) => [...table.entries()].filter(([key, value]) => key.startsWith(prefix) && value)
            .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
            key, record: cloneBranchRecord(value)
        }));
        // Fixed author rules are not plot compression candidates. Accounting and
        // conditional route rules can live in any imported module, not only spec.
        return {
            cards: entries(T.cards),
            worldbook: entries(T.worldbook),
            rules: cloneBranchRecord(T.rules.get(keyOf(session.id, 'spec'))) ?? null
        };
    };
    // Keep provenance in the durable hash above. Source archives can contain a
    // second copy of the entire card; generation only needs the saved author
    // fields. Strip storage metadata at record level, never inside author data.
    const statusAuthorRecord = (record) => record
        && Object.fromEntries(Object.entries(record).filter(([key]) => ![
            'sources',
            'source',
            'editedFrom',
            'schemaVersion',
            'importId',
            'sourceRecordSessionId',
            'sessionId',
            'branchId',
            'atSeq',
            'updatedAt',
            'createdAt',
            'verified'
        ].includes(key)));
    const statusAuthorContext = (fixed) => ({
        // Legacy free-form personas can contain inventory/condition rules in any
        // language. Keep them until explicit status-rule provenance can replace
        // them; guessing with keywords silently drops custom resources.
        cards: fixed.cards.map(({ key, record }) => ({
            key, record: statusAuthorRecord(record)
        })),
        worldbook: fixed.worldbook.filter(e => e.record.enabled !== false && e.record.alwaysOn === true).map(({ key, record }) => ({
            key, record: statusAuthorRecord(record)
        })),
        coreRules: fixed.rules?.core ?? null,
    });
    const statusStoryContext = (session, event, specHash, fixedContextHash, inputBasis) => {
        const compaction = ctx.get('compaction');
        const history = (compaction?.storyEvidence?.(session) ?? surfaceEntries(session))
            .map((entry) => ({
            seq: entry.seq, role: entry.role ?? entry.kind, text: entry.text
        }));
        const end = history.findIndex(entry => entry.seq === event.seq && entry.role === 'assistant');
        if (end < 0)
            throw new Error('当前状态缺少已选分支剧情来源，不能按初始模板重置');
        const selected = history.slice(0, end + 1);
        const selectedHistoryHash = recordSha256(selected);
        if (inputBasis?.selectedHistoryHash === selectedHistoryHash) {
            const priorIndex = inputBasis.previousStatusSource
                ? selected.findIndex(entry => entry.seq === inputBasis.previousStatusSource.assistantSeq && entry.role === 'assistant') : -1;
            if (!inputBasis.previousStatusSource || priorIndex >= 0 && priorIndex < end)
                return {
                    ...cloneBranchRecord(inputBasis),
                    selectedStorySinceStatus: selected.slice(priorIndex + 1),
                };
        }
        let prior = null, priorSource = null, priorIndex = -1;
        for (const [key, stored] of T.status.entries()) {
            if (!key.startsWith(`${session.id}__`))
                continue;
            const candidate = stored?.state === 'completed' ? stored.result : stored;
            if (!candidate?.panel || !candidate.provenance || candidate.stale || candidate.sessionId !== session.id)
                continue;
            const index = selected.findIndex(entry => entry.seq === candidate.atSeq && entry.role === 'assistant');
            if (index <= priorIndex || index >= end)
                continue;
            const prefix = selected.slice(0, index + 1);
            const prefixHash = recordSha256(prefix);
            const hasHistoryHash = typeof candidate.provenance.historyHash === 'string';
            // A legacy record has no cumulative hash. Reuse it only when the entire
            // same-branch prefix still consists of original append events that were
            // already present at that checkpoint. Any later edit/replace rejects it.
            const originalPrefix = !hasHistoryHash
                && prefix.every(entry => entry.seq <= candidate.atSeq
                    &&
                        eventsOf(session).find(item => item.seq === entry.seq)?.surfaceOp === 'append');
            if (hasHistoryHash ? candidate.provenance.historyHash !== prefixHash : !originalPrefix)
                continue;
            const candidateEvent = eventsOf(session).find(item => item.seq === candidate.atSeq);
            const source = statusSource(session, candidateEvent);
            if (!source || source.sourceHash !== candidate.provenance.sourceHash
                ||
                    recordSha256(source.sourceSeqs) !== recordSha256(candidate.provenance.sourceSeqs)
                ||
                    candidate.provenance.specHash !== specHash
                || candidate.provenance.fixedContextHash !== fixedContextHash)
                continue;
            prior = cloneBranchRecord(candidate.panel);
            priorSource = {
                ...source,
                historyHash: prefixHash,
                validation: hasHistoryHash ? 'history-hash' : 'original-append-prefix'
            };
            priorIndex = index;
        }
        return {
            selectedHistoryHash,
            previousStatus: prior,
            previousStatusSource: priorSource,
            selectedStorySinceStatus: selected.slice(priorIndex + 1)
        };
    };
    function runStatusObligation(session, event, via = 'turn-end', { force = false, agent, signal } = {}) {
        const source = statusSource(session, event);
        if (!event || !source || statusDisposed)
            return Promise.resolve(null);
        const taskKey = statusTaskKey(session, event);
        if (statusJobs.has(taskKey)) {
            const existing = statusJobs.get(taskKey);
            existing.cancellation.follow(signal);
            return existing;
        }
        const cancellation = taskCancellation(signal);
        signal = cancellation.signal;
        const retryTimer = statusRetryTimers.get(taskKey);
        if (retryTimer) {
            clearTimeout(retryTimer);
            statusRetryTimers.delete(taskKey);
        }
        let admitted;
        const admission = new Promise(resolve => {
            admitted = resolve;
        });
        // Register synchronously before any await so event + idle + tool retries
        // cannot admit duplicate workers for the same canonical result.
        const job = Promise.resolve().then(async () => {
            let record = cloneBranchRecord(T.status.get(taskKey));
            let spec;
            let resultCommitted = false;
            try {
                await ensureBranch(session);
                spec = cloneBranchRecord(T.status.get(keyOf(session.id, 'spec')));
                if (!spec?.text || !spec.templateHtml)
                    spec = await recoverStatusSpecFromImport(session) ?? spec;
                const specHash = recordSha256(spec);
                const fixedContext = statusFixedContext(session);
                const fixedContextHash = recordSha256(fixedContext);
                const compatibleBasis = !force && record?.source?.sourceHash === source.sourceHash
                    && record.specHash === specHash
                    && record.fixedContextHash === fixedContextHash ? record.inputBasis : null;
                const storyContext = statusStoryContext(session, event, specHash, fixedContextHash, compatibleBasis);
                const storyContextHash = recordSha256(storyContext);
                const input = cloneBranchRecord(T.status.get(keyOf(session.id, `input-${source.turnId}`)));
                const toolInput = input?.sessionId === session.id && input?.turnId === source.turnId
                    &&
                        input?.userSeq === source.sourceSeqs[0]
                    &&
                        input?.userHash === sha256(surfaceEntries(session).find(entry => entry.seq === input.userSeq)?.text ?? '')
                    ? input : null;
                const trigger = {
                    kind: 'turn-end',
                    id: sha256(`${session.id}:${source.turnId}:${event.seq}:${source.sourceHash}`),
                    via
                };
                if (record?.state !== 'completed' || force || record.source?.sourceHash !== source.sourceHash
                    || record.specHash !== specHash
                    || record.fixedContextHash !== fixedContextHash
                    || record.storyContextHash !== storyContextHash) {
                    const selection = force ? await modelPolicy.resolve(session, 'status', agent) : record?.selection
                        ?? await modelPolicy.resolve(session, 'status', agent);
                    record = {
                        schemaVersion: 1,
                        sessionId: session.id,
                        branchId: session.id,
                        trigger,
                        source,
                        specHash,
                        fixedContextHash,
                        storyContextHash,
                        inputBasis: {
                            selectedHistoryHash: storyContext.selectedHistoryHash,
                            previousStatus: storyContext.previousStatus,
                            previousStatusSource: storyContext.previousStatusSource
                        },
                        selection,
                        generationKey: force ? `rebuild-${randomUUID()}` : record?.generationKey ?? null,
                        state: 'running',
                        attempt: (Number(record?.attempt) || 0) + 1,
                        startedAt: record?.startedAt ?? Date.now(),
                        updatedAt: Date.now(),
                        error: null,
                    };
                    await T.status.put(taskKey, record);
                    if (!statusSourceLive(session, event, source))
                        throw new Error('status source changed');
                    let panel = force
                        || !sameModelRoute(toolInput?.provenance?.actualRoute, selection.actualRoute) ? null : statusPanelForSpec(toolInput?.panel, spec);
                    let inputKind = panel ? 'tool' : 'worker';
                    let executionProvenance = panel ? toolInput.provenance : null;
                    if (!panel) {
                        const template = authoredStatusTemplate(spec);
                        const scene = cloneBranchRecord(T.scene.get(keyOf(session.id, 'current')));
                        const sceneSeq = provenanceSeq(scene);
                        const selectedUserAction = surfaceEntries(session).find(entry => entry.seq === source.sourceSeqs[0])?.text ?? '';
                        const queriedWorldbook = await retrieveWorldbook(T, session.id, `${selectedUserAction}\n${textOf(event.data.message?.content)}`, null, Number(cfg.maxWorldTokens) || 6000);
                        const context = {
                            fixedAuthorModules: statusAuthorContext(fixedContext),
                            queriedWorldbook: queriedWorldbook.text,
                            ...(storyContext.selectedStorySinceStatus.some(entry => entry.role === 'user' && entry.text === selectedUserAction) ? {} : {
                                selectedUserAction
                            }),
                            previousStatus: storyContext.previousStatus,
                            previousStatusSource: storyContext.previousStatusSource,
                            selectedStorySinceStatus: storyContext.selectedStorySinceStatus,
                            scene: scene && sceneSeq !== null && sceneSeq <= event.seq && (!scene.sessionId || scene.sessionId === session.id) ? scene : null,
                        };
                        const raw = await llmJson(ctx, resolveRoute(session, agent), {
                            system: STATUS_SYSTEM,
                            signal,
                            onAdmission: admitted,
                            selection,
                            onResult: task => {
                                executionProvenance = {
                                    taskId: task.id,
                                    generation: task.generation,
                                    actualRoute: task.actualRoute,
                                    execution: task.execution
                                };
                            },
                            generationKey: record.generationKey ?? undefined,
                            validate: value => {
                                if (!statusPanelForSpec(value, spec, {
                                    strict: true
                                }))
                                    throw new TaskValidationError('状态结果没有可用内容', [{
                                            path: 'result',
                                            rule: 'nonempty-status',
                                            expected: 'status-content',
                                            actual: 'empty'
                                        }]);
                                return value;
                            },
                            ...maintenancePrompt(context, `状态栏设定：\n${fenceCardContent(template && spec?.text?.trim() === template.trim() ? '设定与作者模板相同，完整内容见下方模板。' : spec?.text ?? '根据本轮正文展示已确认的位置、时间与人物状态。', 'status')}\n${template ? `\n作者原始状态栏模板（完整保留 HTML 结构、class/id、内联样式和 style/script 块；只更新动态状态值）：\n${fenceCardContent(template, 'status')}` : ''}\n\n当前分支状态依据、已提交前置状态及待结算剧情：\n`, '\n\n以 previousStatus 为累计状态基线，按 selectedStorySinceStatus 中已经发生的剧情依次结算到本轮；最后一条 assistant 即本轮正文。基线已结算的历史不能重复扣除。没有有效基线时，根据提供的当前分支剧情从初始设定重建，不能把初始模板数值直接当成本轮值。数值与物品规则必须执行；只有剧情确实完成相应行为时才结算。不得因为本轮正文未重复数值就清空或重置累计状态。fields 与 html 必须一致。只提取状态，不续写剧情、不审阅整张角色卡。\n\n请生成状态栏 JSON。'),
                            maxTokens: Math.max(6000, estimateTokens(template) * 2 + 2000),
                            temperature: 0.4,
                            timeoutMs: Number(cfg.statusWorkerTimeoutMs) || DEFAULT_CONFIG.statusWorkerTimeoutMs,
                        });
                        panel = statusPanelForSpec(raw, spec);
                    }
                    if (!panel)
                        throw new Error('状态栏未返回可用内容或未保留作者模板；可重试');
                    const templateKind = authoredStatusTemplate(spec) ? 'author' : spec?.templateHtml ? 'damaged' : 'missing';
                    const result = {
                        schemaVersion: 1,
                        sessionId: session.id,
                        branchId: session.id,
                        atSeq: event.seq,
                        turnId: source.turnId,
                        time: Date.now(),
                        panel,
                        provenance: {
                            triggerId: trigger.id,
                            sourceSeqs: source.sourceSeqs,
                            sourceHash: source.sourceHash,
                            specHash,
                            fixedContextHash,
                            storyContextHash,
                            historyHash: storyContext.selectedHistoryHash,
                            previousStatusSource: storyContext.previousStatusSource,
                            ...executionProvenance,
                            inputKind,
                            templateKind,
                            toolInputSeq: toolInput?.atSeq ?? null
                        },
                    };
                    await withStatusLock(session.id, async () => {
                        if (!statusSourceLive(session, event, source)
                            || recordSha256(T.status.get(keyOf(session.id, 'spec'))) !== specHash
                            || recordSha256(statusFixedContext(session)) !== fixedContextHash
                            || recordSha256(statusStoryContext(session, event, specHash, fixedContextHash, record.inputBasis)) !== storyContextHash) {
                            throw new Error('status source changed');
                        }
                        record = {
                            ...record,
                            state: 'completed',
                            result,
                            publicationState: 'pending',
                            error: null,
                            updatedAt: Date.now()
                        };
                        await T.status.put(taskKey, record);
                        resultCommitted = true;
                    });
                }
                else
                    resultCommitted = true;
                await withStatusLock(session.id, async () => {
                    if (!statusSourceLive(session, event, source) || recordSha256(statusFixedContext(session)) !== fixedContextHash
                        || recordSha256(statusStoryContext(session, event, specHash, fixedContextHash, record.inputBasis)) !== storyContextHash)
                        throw new Error('status source changed');
                    const current = selectedStatusRecord(session);
                    // Later completed turns may finish their workers first. They own the
                    // current projection; keep older durable results for replay only.
                    const publicationState = Number(current?.atSeq ?? -1) > event.seq ? 'superseded' : 'published';
                    if (publicationState === 'published' && recordSha256(current) !== recordSha256(record.result)) {
                        await T.status.put(keyOf(session.id, 'panel'), record.result);
                    }
                    if (record.publicationState !== publicationState || record.publicationError) {
                        record = {
                            ...record, publicationState, publicationError: null
                        };
                        await T.status.put(taskKey, record);
                    }
                });
                statusRetryCounts.delete(taskKey);
                return record;
            }
            catch (error) {
                if (isInlinePending(error)) {
                    await T.status.put(taskKey, {
                        ...record,
                        state: 'waiting-main',
                        updatedAt: Date.now(),
                        error: null
                    });
                    return cloneBranchRecord(T.status.get(taskKey));
                }
                const live = statusSourceLive(session, event, source);
                // A failed pointer write must leave the committed result available for
                // replay, including after a process restart. Do not rerun its worker.
                const durable = cloneBranchRecord(T.status.get(taskKey));
                if (!resultCommitted || durable?.state !== 'completed' || !live) {
                    record = {
                        ...(record ?? {
                            schemaVersion: 1,
                            sessionId: session.id,
                            branchId: session.id,
                            trigger: {
                                kind: 'turn-end',
                                id: sha256(`${session.id}:${source.turnId}:${event.seq}:${source.sourceHash}`),
                                via
                            },
                            source,
                            attempt: 1
                        }),
                        state: live ? 'retry' : 'stale',
                        result: null,
                        error: live ? '状态生成或提交失败，可重试' : '所选剧情已变更',
                        updatedAt: Date.now()
                    };
                    await T.status.put(taskKey, record).catch(() => {
                    });
                }
                else {
                    record = {
                        ...durable,
                        publicationState: 'retry',
                        publicationError: '状态结果已提交，发布待重试'
                    };
                    await T.status.put(taskKey, record).catch(() => {
                    });
                }
                const retries = (statusRetryCounts.get(taskKey) ?? 0) + 1;
                statusRetryCounts.set(taskKey, retries);
                if (live && retries <= 3 && !statusDisposed && !signal?.aborted) {
                    const retrySignal = cancellation.retrySignal();
                    const timer = setTimeout(() => {
                        statusRetryTimers.delete(taskKey);
                        if (retrySignal?.aborted)
                            return;
                        runStatusObligation(session, event, 'retry', {
                            agent, signal: retrySignal
                        }).catch(() => {
                        });
                    }, Math.max(1, Number(cfg.statusRetryMs) || 2000) * retries);
                    timer.unref?.();
                    statusRetryTimers.set(taskKey, timer);
                }
                ctx.logger?.warn?.(`roleplay: status obligation ${live ? 'retry' : 'stale'} turn=${source.turnId} seq=${event.seq}`);
                return cloneBranchRecord(T.status.get(taskKey)) ?? null;
            }
        }).finally(() => {
            cancellation.dispose();
            admitted(null);
            if (statusJobs.get(taskKey) === job)
                statusJobs.delete(taskKey);
        });
        job.admission = admission;
        job.cancellation = cancellation;
        statusJobs.set(taskKey, job);
        return job;
    }
    function queueStatusObligation(session, event, via, agent, signal) {
        runStatusObligation(session, event, via, {
            agent, signal
        }).catch(() => {
            ctx.logger?.warn?.(`roleplay: status admission failed turn=${event?.data?.turn}`);
        });
    }
    function recoverStatusObligations(session, via, agent) {
        const latest = latestStatusEvent(session);
        const lastBoundary = eventsOf(session).findLast(event => event.type === 'turn/start' || event.type === 'turn/end');
        if (lastBoundary?.type === 'turn/start' && (!latest || latest.seq < lastBoundary.seq))
            return;
        // A new worldline is about to replay its player input. Do not separately
        // backfill the inherited tail while its new story will settle that prefix.
        if (session.header?.parentSession && Number(latest?.seq) < Number(session.header.seedLength))
            return;
        const runStart = statusRunStartSeq.get(session.id) ?? Infinity;
        // Recover pending durable work and this run's completed turns. A cold
        // legacy session only backfills its latest turn, not its entire archive.
        for (const entry of surfaceEntries(session)) {
            if (entry.kind !== 'assistant')
                continue;
            const record = T.status.get(keyOf(session.id, `turn-${entry.turn}-${entry.seq}`));
            if (entry.seq === latest?.seq || entry.seq > runStart
                ||
                    (record
                        && (record.state === 'running' || record.state === 'waiting-main' || record.state === 'retry'
                            || record.publicationState === 'retry'))) {
                const event = canonicalAssistantForTurn(session, entry.turn);
                if (event)
                    queueStatusObligation(session, event, via, agent);
            }
        }
    }
    const recoverStatusSpecFromImport = async (session) => {
        const edited = T.status.get(keyOf(session.id, 'spec'));
        if (edited?.editedFrom)
            return edited;
        const active = T.branch.get(importActiveKey(session.id));
        const sourceSessionId = active?.sourceRecordSessionId ?? session.id;
        const record = (active?.importId ? T.branch.get(importRecordKey(sourceSessionId, active.importId)) : null);
        if (!record || typeof record.normalizedSource !== 'string')
            return null;
        const spans = (record.assignments ?? [])
            .filter((assignment) => assignment.target === 'status')
            .flatMap((assignment) => assignment.sourceSpans ?? []);
        if (!spans.length)
            return null;
        const restored = spans.map((span) => spanText(record, [span])).join('');
        if (!restored.trim())
            return null;
        const current = cloneBranchRecord(T.status.get(keyOf(session.id, 'spec'))) ?? {};
        const next = {
            ...current,
            text: restored,
            templateHtml: restored,
            recoveredFromImport: true,
            recoveredAt: Date.now(),
            importId: record.importId,
            normalizedSha256: record.normalizedSha256
        };
        await T.status.put(keyOf(session.id, 'spec'), next);
        return next;
    };
    return {
        statusFixedContext,
        runStatusObligation,
        textAlias,
        normalizeDecisionRecord,
        normalizeStatusOption,
        selectedStatusRecord,
        statusSource,
        normalizeStatusRecord,
        queueStatusObligation,
        statusRunStartSeq,
        recoverStatusObligations,
        statusRecoveredSessions,
        selectedStatusGeneration,
        latestStatusEvent
    };
}
