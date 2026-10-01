// Generated from runtime/alpha3/src/core/roleplay-completion.ts; edit the TypeScript source.
import { keyOf, textOf, estimateTokens } from './roleplay-data.js';
import { eventsOf, lastSeq, surfaceEntries, canonicalAssistantForTurn, completedAssistantReceiptForTurn, isCompletedTurnEnd } from './roleplay-context.js';
import { internalTaskSeqs, isInlinePending, awaitTaskAdmissions } from './tavern-tasks.js';
export function createRoleplayCompletion(deps) {
    const { storyBranchIsActive, T, cloneBranchRecord, reconcileNativeFork, ctx, resolveRoute, memoryForContext, publishTurnDecision, llmJson, LEDGER_WORKER_SYSTEM, cfg, CONTINUITY_WORKER_SYSTEM, contextWindowFor, contextWindowKey, svc, sessions, failPendingNativeFork, isRoleplaySession, queueStatusObligation, statusRunStartSeq, recoverStatusObligations } = deps;
    function isStale(session, snapshot, canonicalSeq) {
        if (!storyBranchIsActive(session))
            return true;
        const log = eventsOf(session);
        if (!Array.isArray(log))
            return true;
        const surfaceNodes = session?.surface?.nodes;
        if (!Array.isArray(surfaceNodes) || !Number.isSafeInteger(canonicalSeq))
            return true;
        const live = new Set(surfaceNodes);
        // Normal later turns append more live nodes and do not invalidate this turn.
        // Editing, deleting or regenerating shadows the old surface range; commit
        // only while both the selected input and canonical assistant output remain.
        if (!live.has(canonicalSeq))
            return true;
        if (typeof snapshot.userMessageId !== 'string' || !snapshot.userMessageId)
            return true;
        const userEvent = log.find((event) => event?.type === 'user/message' &&
            event?.surfaceOp === 'append' &&
            event?.data?.id === snapshot.userMessageId);
        return !userEvent || !live.has(userEvent.seq);
    }
    async function runPhaseBC(session, event, st, suppliedSnapshot = null, signal) {
        const turnId = Number(event?.data?.turn);
        let snapshot = suppliedSnapshot ?? st.snapshots.get(turnId) ?? st.snapshot ?? T.branch.get(keyOf(session.id, `task-snapshot-${turnId}`));
        if (!snapshot)
            return;
        if (internalTaskSeqs(session).has(event.seq))
            return;
        if (eventsOf(session).some(e => e.type === 'tool/call' && e.data?.name === 'rp_card_import_begin' && Number(e.data?.turn) === turnId))
            snapshot = { ...snapshot, userText: '' };
        const narrative = textOf(event.data?.message?.content);
        if (!narrative.trim())
            return;
        const branchId = session.id;
        const phaseKey = keyOf(branchId, `phaseb-${Number(snapshot.turnId)}`);
        const phaseRecord = cloneBranchRecord(T.branch.get(phaseKey));
        if (phaseRecord?.state === 'completed' && phaseRecord?.assistantSeq === Number(event.seq))
            return;
        try {
            await T.branch.put(phaseKey, {
                ...(phaseRecord ?? {}),
                state: 'running',
                turnId: Number(snapshot.turnId),
                assistantSeq: Number(event.seq),
                sessionId: branchId,
                startedAt: phaseRecord?.startedAt ?? Date.now(),
                attempt: (Number(phaseRecord?.attempt) || 0) + 1,
            });
        }
        catch (error) {
            st.phaseBStarted.delete(Number(snapshot.turnId));
            throw error;
        }
        let committed = false;
        // 新分支的回复一旦 durable，就把真实 messageId 回填到跨 Session 分页
        // 索引；失败只影响导航，不应阻断本轮记忆/状态提交。
        try {
            await reconcileNativeFork(session, event);
        }
        catch (error) {
            ctx.logger?.warn?.(`roleplay: native branch reconciliation failed: ${String(error)}`);
        }
        const route = resolveRoute(session, snapshot?.agent);
        const backgroundMemory = ctx.get('compaction')?.backgroundMemory === true;
        const mem = memoryForContext(session);
        // Do not make the user wait for ledger/continuity/status workers before the
        // decision card becomes available. Errors remain isolated from Phase B/C.
        publishTurnDecision(session, event, snapshot, narrative, signal).catch((error) => {
            ctx.logger?.warn?.(`roleplay: decision card failed: ${String(error)}`);
        });
        const jobs = backgroundMemory ? [] : [
            llmJson(ctx, route, {
                system: LEDGER_WORKER_SYSTEM,
                signal,
                user: `既有正史尾部（最近 80 条）：\n${JSON.stringify((mem?.deltas ?? []).slice(-80))}\n\n本轮用户输入：\n${snapshot.userText}\n\n候选正文（已展示给用户的 canonical narrative）：\n${narrative}\n\n请输出正史增量 JSON。`,
                maxTokens: Number(cfg.workerMaxTokens) || 2048,
                temperature: Number(cfg.workerTemperature) ?? 0.4,
                timeoutMs: Number(cfg.phaseBTimeoutMs) || 90000,
            }),
            llmJson(ctx, route, {
                system: CONTINUITY_WORKER_SYSTEM,
                signal,
                user: `既有正史（场景 + 最近记忆）：\n${JSON.stringify({
                    scene: T.scene.get(keyOf(branchId, 'current')) ?? null,
                    summary: mem?.summary ?? '',
                    deltas: (mem?.deltas ?? []).slice(-80),
                })}\n\n本轮用户输入：\n${snapshot.userText}\n\n候选正文：\n${narrative}\n\n请输出连续性检查 JSON。`,
                maxTokens: Number(cfg.workerMaxTokens) || 2048,
                temperature: Number(cfg.workerTemperature) ?? 0.4,
                timeoutMs: Number(cfg.phaseBTimeoutMs) || 90000,
            }),
        ];
        // Register this turn in the serial chain before waiting on workers. The next
        // Phase A can now reliably wait for the complete previous-turn commit, and
        // faster later workers cannot overtake an earlier turn.
        const previousCommit = st.commitChain ?? Promise.resolve();
        const currentCommit = (async () => {
            try {
                const [ledger, check] = await awaitTaskAdmissions(jobs);
                // llmJson is intentionally fail-closed and returns null on a transport,
                // timeout, or parse failure.  Do not mark a Phase-B transaction complete
                // with an empty result: keep the snapshot and let the bounded retry path
                // try again instead.
                if (!backgroundMemory && (!ledger || typeof ledger !== 'object' || !check || typeof check !== 'object')) {
                    throw new Error('Phase B worker 未返回可提交的结构化结果');
                }
                try {
                    await previousCommit;
                }
                catch (error) {
                    ctx.logger?.warn?.(`roleplay: previous commit failed: ${String(error)}`);
                }
                if (isStale(session, snapshot, event.seq)) {
                    ctx.logger?.warn?.('roleplay: commit skipped — surface changed during turn (stale)');
                    return;
                }
                const newDeltas = ledger && Array.isArray(ledger.deltas)
                    ? ledger.deltas.map((d) => ({
                        atSeq: event.seq,
                        sessionId: branchId,
                        turnId: snapshot.turnId,
                        status: d.status === 'uncertain' ? 'uncertain' : 'established',
                        type: d.type ?? 'event',
                        summary: String(d.summary ?? '').slice(0, 800),
                        evidenceSeq: Number.isSafeInteger(d.evidenceSeq) ? d.evidenceSeq : event.seq,
                    }))
                    : [];
                const newConfirmations = check && Array.isArray(check.conflicts)
                    ? check.conflicts.map((c) => ({
                        atSeq: event.seq,
                        sessionId: branchId,
                        turnId: snapshot.turnId,
                        severity: c.severity ?? 'medium',
                        claim: String(c.claim ?? '').slice(0, 600),
                        canon: String(c.canon ?? '').slice(0, 600),
                        evidenceSeq: Number.isSafeInteger(c.evidenceSeq) ? c.evidenceSeq : event.seq,
                    }))
                    : [];
                const significantConflict = newConfirmations.some((item) => item.severity === 'high' || item.severity === 'medium');
                const memoryKey = keyOf(branchId, 'head');
                if (!backgroundMemory && !T.memory.get(memoryKey)) {
                    await T.memory.put(memoryKey, { deltas: [], lockedFacts: [], pendingConfirmations: [], version: 1 });
                }
                if (!backgroundMemory)
                    await T.memory.update(memoryKey, (current) => {
                        const priorDeltas = Array.isArray(current?.deltas) ? current.deltas : [];
                        const priorConfirmations = Array.isArray(current?.pendingConfirmations)
                            ? current.pendingConfirmations
                            : [];
                        const hasOrigin = (item) => item && item.sessionId === branchId
                            && Number(item.atSeq) === Number(event.seq)
                            && Number(item.turnId) === Number(snapshot.turnId);
                        const merge = (prior, incoming, limit) => {
                            const existing = prior.some(hasOrigin);
                            return (existing ? prior : [...prior, ...incoming]).slice(-limit);
                        };
                        return {
                            ...current,
                            deltas: merge(priorDeltas, newDeltas, 600),
                            pendingConfirmations: merge(priorConfirmations, newConfirmations, 100),
                            version: (Number(current?.version) || 1) + 1,
                            updatedAtSeq: event.seq,
                            sessionId: branchId,
                        };
                    });
                const pendingScene = st.pendingScenes.get(Number(snapshot.turnId)) ?? st.pendingScene;
                if (pendingScene && pendingScene.scene && pendingScene.scene.place) {
                    await T.scene.put(keyOf(branchId, 'current'), {
                        ...pendingScene.scene,
                        updatedAtSeq: event.seq,
                        atSeq: event.seq,
                        sessionId: branchId,
                    });
                }
                st.pendingScenes.delete(Number(snapshot.turnId));
                if (st.pendingTurn === snapshot.turnId)
                    st.pendingScene = null;
                const metaKey = keyOf(branchId, 'meta');
                const meta = cloneBranchRecord(T.branch.get(metaKey)) ?? { createdAt: Date.now() };
                await T.branch.put(metaKey, {
                    ...meta,
                    lastTurn: snapshot.turnId,
                    lastSeq: event.seq,
                    surfaceTokens: estimateTokens(narrative),
                });
                const activeWindow = contextWindowFor(session);
                if (activeWindow && Number(event.seq) > Number(activeWindow.throughSeq ?? -1)) {
                    const windowStart = Number(activeWindow.startSeq ?? -1);
                    const storyTokens = surfaceEntries(session).reduce((sum, entry) => Number(entry.seq) > windowStart ? sum + estimateTokens(entry.text) : sum, 0);
                    await T.branch.put(contextWindowKey(branchId), {
                        ...activeWindow,
                        throughSeq: Number(event.seq),
                        storyTokens,
                        updatedAt: Date.now(),
                    });
                }
                // 重新生成版本的账本登记（本轮的正文即该锚点的新版本）
                if (st.regenerateAnchor !== null) {
                    await svc.recordVersion(branchId, st.regenerateAnchor, event.data?.turn, event.seq);
                    st.regenerateAnchor = null;
                }
                await T.branch.put(phaseKey, {
                    ...cloneBranchRecord(T.branch.get(phaseKey)),
                    state: 'completed',
                    memoryMode: backgroundMemory ? 'background-notes' : 'foreground-ledger',
                    completedAt: Date.now(),
                    error: null,
                });
                committed = true;
                // A continuity conflict invalidates the assumptions behind an
                // incremental director-note checkpoint.  Rebuild from the complete
                // selected branch after the Phase-B transaction is durable; the
                // immutable event log remains the source of truth and the rebuild is
                // deliberately outside the foreground narration path.
                if (significantConflict) {
                    // Continuity conflicts invalidate every incremental checkpoint: the
                    // next model window must receive a fresh director-note projection
                    // over the complete selected branch, not a summary that still
                    // points at the contradicted chapter.
                    ctx.logger?.warn?.(`roleplay: significant continuity conflict at seq ${event.seq}; rebuilding director notes`);
                    const compaction = ctx.get('compaction');
                    if (typeof compaction?.rebuildDirectorNotes === 'function') {
                        Promise.resolve(compaction.rebuildDirectorNotes({ session }))
                            .catch((error) => ctx.logger?.warn?.(`roleplay: conflict director-note rebuild failed: ${String(error)}`));
                    }
                }
            }
            catch (error) {
                if (isInlinePending(error)) {
                    await T.branch.put(phaseKey, { ...cloneBranchRecord(T.branch.get(phaseKey)), state: 'waiting-main', error: null });
                    return;
                }
                ctx.logger?.warn?.(`roleplay: commit failed: ${String(error)}`);
                await T.branch.put(phaseKey, {
                    ...cloneBranchRecord(T.branch.get(phaseKey)),
                    state: 'retry',
                    error: String(error?.message ?? error).slice(0, 500),
                    failedAt: Date.now(),
                }).catch(() => { });
                const attempts = Number(st.phaseBAttempts.get(Number(snapshot.turnId)) || 0) + 1;
                st.phaseBAttempts.set(Number(snapshot.turnId), attempts);
                // Keep the snapshot until a retry succeeds. A bounded retry avoids
                // dropping memory/scene updates after one transient storage/provider
                // failure while still preventing an endless restart loop.
                if (attempts <= 3 && !st.phaseBRetryTimers.has(Number(snapshot.turnId)) && !signal?.aborted) {
                    const timer = setTimeout(() => {
                        st.phaseBRetryTimers.delete(Number(snapshot.turnId));
                        if (signal?.aborted)
                            return;
                        runPhaseBC(session, event, st, snapshot, signal).catch((retryError) => {
                            ctx.logger?.warn?.(`roleplay: phase BC retry failed: ${String(retryError)}`);
                        });
                    }, Math.min(30_000, 2_000 * attempts));
                    st.phaseBRetryTimers.set(Number(snapshot.turnId), timer);
                }
            }
            finally {
                if (committed && st.snapshots.get(Number(snapshot.turnId)) === snapshot)
                    st.snapshots.delete(Number(snapshot.turnId));
                if (st.snapshot === snapshot)
                    st.snapshot = null;
                if (committed && Number(st.pendingTurn) === Number(snapshot.turnId))
                    st.pendingTurn = null;
                if (committed) {
                    st.phaseBStarted.delete(Number(snapshot.turnId));
                    st.phaseBAttempts.delete(Number(snapshot.turnId));
                }
                else {
                    st.phaseBStarted.delete(Number(snapshot.turnId));
                }
            }
        })();
        st.commitChain = currentCommit;
        await currentCommit;
    }
    function completeManagementFork(session, st, event) {
        const turn = Number(event.data?.turn);
        if (st.phaseBStarted.has(turn))
            return;
        st.phaseBStarted.add(turn);
        // Reconciliation validates the pending request/turn against the durable reply.
        // Do not run story Phase B/C or publish status/decision/memory for management.
        Promise.resolve().then(() => reconcileNativeFork(session, event)).then(() => {
            const snapshot = st.snapshots.get(turn);
            st.snapshots.delete(turn);
            st.pendingScenes.delete(turn);
            if (st.snapshot === snapshot)
                st.snapshot = null;
            if (st.pendingTurn === turn) {
                st.pendingTurn = null;
                st.pendingScene = null;
            }
            st.regenerateAnchor = null;
        }).catch(error => ctx.logger?.warn?.(`roleplay: management fork completion failed: ${String(error)}`))
            .finally(() => st.phaseBStarted.delete(turn));
    }
    function queueCompletedTurn(session, event) {
        if (!event || event.type !== 'turn/end')
            return;
        const turn = Number(event.data?.turn);
        if (!Number.isSafeInteger(turn))
            return;
        const st = sessions.get(session.id);
        const snapshot = st?.snapshots.get(turn);
        if (!st || !snapshot || st.phaseBStarted.has(turn))
            return;
        if (event.data?.reason?.kind !== 'completed') {
            st.snapshots.delete(turn);
            st.pendingScenes.delete(turn);
            failPendingNativeFork(session, `turn ${String(turn)} 未以 completed 正常结束`).catch((error) => {
                ctx.logger?.warn?.(`roleplay: failed branch cleanup failed: ${String(error)}`);
            });
            return;
        }
        const canonical = canonicalAssistantForTurn(session, turn);
        if (!canonical) {
            const receipt = completedAssistantReceiptForTurn(session, turn);
            if (receipt) {
                completeManagementFork(session, st, receipt);
                return;
            }
            st.snapshots.delete(turn);
            st.pendingScenes.delete(turn);
            failPendingNativeFork(session, `turn ${String(turn)} 缺少可见 canonical Agent 回复`).catch((error) => {
                ctx.logger?.warn?.(`roleplay: failed branch cleanup failed: ${String(error)}`);
            });
            return;
        }
        st.phaseBStarted.add(turn);
        runPhaseBC(session, canonical, st, snapshot).catch((error) => {
            ctx.logger?.warn?.(`roleplay: phase BC failed (turn ${turn}): ${String(error)}`);
        });
    }
    // `agent/status=idle` is emitted only after the entire inbox drains. A user
    // can queue several roleplay turns in one run, so consume each durable
    // turn/end as its own Phase-B work item instead of retaining one scalar
    // snapshot and silently dropping the earlier turns.
    ctx.on('session/event', (session, event) => {
        // Both consumers below handle turn/end only. Reject token chunks before
        // preset/child detection: that detection reads the complete append-only
        // log and otherwise makes streaming quadratic in the session length.
        if (event?.type !== 'turn/end')
            return;
        if (session && isRoleplaySession(session)) {
            if (isCompletedTurnEnd(event)) {
                const canonical = canonicalAssistantForTurn(session, event.data.turn);
                if (canonical)
                    queueStatusObligation(session, canonical, 'session/event');
            }
            queueCompletedTurn(session, event);
        }
    }, { global: true });
    // 阶段 B/C 触发：standing 挂载的 ctx.on 收不到 session/event（会话事件
    // 只派发给会话 scope 内的监听者），改用 agent 作用域事件 agent/status——
    // 与 agent/pre-step 同机制，已实证可达 standing 挂载。轮次结束时 agent
    // 转为 idle，此时向后扫描日志取本轮最后一条 assistant/message 提交。
    ctx.on('agent/status', (payload) => {
        const agent = payload?.agent;
        // agentEvents injects the complete Agent instance. Prefer its authoritative
        // session and keep the session registry lookup only as a compatibility path.
        const session = agent?.session ?? ctx.sessions.get(agent?.id) ?? null;
        if (!session || !isRoleplaySession(session)) {
            try {
                ctx.logger?.warn?.('roleplay: agent/status skipped (session/preset): ' + JSON.stringify({ gotSession: session != null, agentId: agent?.id }));
            }
            catch { }
            return;
        }
        if (payload?.status === 'running') {
            statusRunStartSeq.set(session.id, lastSeq(session));
            return;
        }
        if (payload?.status !== 'idle')
            return;
        // The idle event can be the only reachable completion feed on a standing
        // mount. Drain this run and pending durable work without Phase-A snapshots.
        recoverStatusObligations(session, 'agent/idle', agent);
        statusRunStartSeq.delete(session.id);
        const st = sessions.get(session.id);
        if (!st || (st.pendingTurn === null && st.regenerateAnchor === null && st.snapshots.size === 0))
            return;
        const log = eventsOf(session);
        let evt = null;
        let targetTurn = st.pendingTurn === null ? null : Number(st.pendingTurn);
        if (targetTurn === null) {
            for (let i = log.length - 1; i >= 0; i--) {
                if (log[i]?.type === 'turn/start') {
                    targetTurn = Number(log[i].data?.turn);
                    break;
                }
            }
        }
        if (targetTurn !== null)
            evt = canonicalAssistantForTurn(session, targetTurn);
        if (!evt) {
            const receipt = targetTurn === null ? null : completedAssistantReceiptForTurn(session, targetTurn);
            if (receipt) {
                completeManagementFork(session, st, receipt);
                return;
            }
            st.pendingTurn = null;
            st.snapshot = null;
            failPendingNativeFork(session, `turn ${String(targetTurn)} 未以 completed 正常结束`).catch((error) => {
                ctx.logger?.warn?.(`roleplay: failed branch cleanup failed: ${String(error)}`);
            });
            return;
        }
        if (st.pendingTurn !== null && !st.phaseBStarted.has(Number(st.pendingTurn))) {
            if (Number(evt.data?.turn) !== Number(st.pendingTurn))
                return;
            st.pendingTurn = null;
            ctx.logger?.warn?.('roleplay: runPhaseBC starting (turn ' + Number(evt.data?.turn) + ', seq ' + evt.seq + ')');
            const queuedSnapshot = st.snapshots.get(Number(evt.data?.turn)) ?? st.snapshot;
            if (queuedSnapshot)
                st.phaseBStarted.add(Number(evt.data?.turn));
            runPhaseBC(session, evt, st, queuedSnapshot).catch((error) => {
                ctx.logger?.warn?.(`roleplay: phase BC failed: ${String(error)}`);
            });
        }
        else if (st.regenerateAnchor !== null) {
            // 重新生成版本：只登记版本账本，不做正史抽取（备用版本不改记忆；
            // 记忆整理以当前可见表面为准）
            const anchor = st.regenerateAnchor;
            st.regenerateAnchor = null;
            svc
                .recordVersion(session.id, anchor, evt.data?.turn, evt.seq)
                .catch((error) => {
                ctx.logger?.warn?.(`roleplay: version record failed: ${String(error)}`);
            });
        }
    });
    return { runPhaseBC, isStale };
}
