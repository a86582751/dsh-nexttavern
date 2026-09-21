// Generated from runtime/alpha3/src/memory/roleplay-memory-engine.ts; edit the TypeScript source.
// roleplay-memory-engine.js — roleplay preset 的记忆/压缩引擎。
//
// 提供本 preset isolate group 内的 `compaction` 服务（command-compact 与
// 本引擎的 /memory organize 消费），并实现：
//   - 自动触发：完整请求压力达到 targetContextTokens 减去 hysteresisTokens
//     的安全线（默认 256K - 16K）时，归档最早约 archiveTokens 的未归档
//     剧情区间，尾部保留原文；
//   - 增量摘要：基于当前分支可见的上一代 checkpoint 合并新剧情；
//   - 隔离设定：角色卡、世界书、规则和工具上下文永不进入摘要范围；
//     只有用户在记忆面板显式锁定的剧情事实会逐字进入摘要；
//   - 原文与摘要均带精确 source seq 指针；原始事件永远保留（surface 替换
//     只遮蔽模型可见面，人类转录永不删除）。
//
// 事件序列镜像 compaction-basic（compaction/start → compaction/summary →
// user/message surface replace → compaction/end），token meter 的
// shadow-price 记账协议因此继续成立。
//
// 与 roleplay-core.js 相同：本文件不能裸 import 任何 npm 包。
import { randomUUID } from 'node:crypto';
import { createMemoryCompactor, checkpointSummaryFromSurface, durableCompactionArchives, inspectCompactionState } from './memory-compaction.js';
export { durableCompactionArchives } from './memory-compaction.js';
import { createDirectorNotesWriter } from './memory-notes-writer.js';
import { createMemoryScheduler } from './memory-scheduler.js';
import { createMemorySummarizer } from './memory-summary.js';
import { surfaceSeqsOf, isCompletedTurnEnd, selectedStoryHistory, queryStoryHistory, readStoryHistory, historySourceKeys, legacyCadenceSlots, memoryNotesCadence, directorNotesForBranch } from './memory-history.js';
export { selectedStoryHistory, queryStoryHistory, readStoryHistory, storyCadenceSlots, legacyCadenceSlots, memoryNotesCadence, directorNotesForBranch } from './memory-history.js';
import { lastSeqOf, textOf, branchScope, provenanceSeqOf, belongsToBranch, filterMemoryRecordForBranch as typedFilterMemoryRecordForBranch } from './memory-provenance.js';
export const name = 'roleplay-memory-engine';
export const inject = ['sessions', 'llm', 'tokenMeter', 'agentDefaultModel'];
const DEFAULT_CONFIG = {
    targetContextTokens: 262144,
    archiveTokens: 100000,
    maxSummaryTokens: 16384,
    summaryTimeoutMs: 300000,
    notesBatchChars: 100000,
    autoNotes: true,
    autoNotesEveryTurns: 3,
    autoNotesTimeoutMs: 300000,
    autoRetryBaseMs: 30000,
    autoRetryMaxMs: 300000,
    auto: true,
    hysteresisTokens: 16384,
};
const errorMessage = (error) => String(error !== null && typeof error === 'object' && 'message' in error ? error.message ?? error : error);
// Pinned alpha.3 history adapter. GA needs projections/async pages and revised
// event shapes, not snapshotEvents (docs/migration-ga.md).
function eventsOf(session) {
    if (Array.isArray(session?.events))
        return session.events;
    if (Array.isArray(session?.log))
        return session.log;
    return [];
}
export const filterMemoryRecordForBranch = typedFilterMemoryRecordForBranch;
export async function apply(ctx, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) };
    // roleplay/commands 都可能比本插件晚挂载或热重载；禁止缓存服务实例。
    const getEngine = () => ctx.get('roleplay');
    const assertBranchActive = (session) => {
        if (getEngine()?.isStoryBranchActive?.(session) !== false)
            return;
        const error = new Error('当前剧情分支已删除；未提交后台记忆结果');
        error.code = 'ROLEPLAY_SOURCE_CHANGED';
        throw error;
    };
    const compactor = createMemoryCompactor({
        config: cfg, getEngine, memoryForSession, branchSettings, assertBranchActive,
        summarizeDetailed: options => summarizeDetailed(options),
        getTokenMeter: () => ctx.tokenMeter,
        flush: async (session) => { if (typeof ctx.sessions.flush === 'function')
            await ctx.sessions.flush(session); },
        warn: message => ctx.logger?.warn?.(message),
    });
    const { compact, pressureTokens, busy } = compactor;
    const notesWriter = createDirectorNotesWriter({
        config: cfg, getEngine, branchSettings, assertBranchActive, inspectCompactionState,
        isRoleplaySession: session => isRoleplaySession(session),
        summarizeDetailed: options => summarizeDetailed(options),
    });
    const notesBusy = notesWriter.busy;
    const refreshDirectorNotes = notesWriter.refreshDirectorNotes;
    const scheduler = createMemoryScheduler({
        config: cfg, notesBusy, busy, isRoleplaySession: session => isRoleplaySession(session),
        notesDue: session => memoryNotesCadence(session, getEngine()?.memoryHead?.(session.id), Number(getEngine()?.settings?.(session.id)?.autoNotesEveryTurns) || cfg.autoNotesEveryTurns).due,
        requestNotes: (session, agent, signal) => refreshDirectorNotes(session, agent, signal, undefined, { automatic: true, background: true }),
        requestCompaction: (session, agent, signal, force) => compact(session, agent, signal, undefined, { force, manual: false }),
        aboveThreshold: session => branchTokensAboveThreshold(session),
        warn: message => ctx.logger?.warn?.(message),
    });
    const { organizeAutomatically, scheduleNotes, compactAutomatically } = scheduler;
    if (typeof ctx.effect === 'function')
        ctx.effect(() => scheduler.dispose, 'roleplay-memory: background notes');
    const isRoleplaySession = (session) => {
        if (!session)
            return false;
        let preset = session.header?.agentPreset;
        const seed = Number(session.header?.seedLength ?? 0);
        for (const event of eventsOf(session)) {
            const type = event?.type;
            if (type === 'subagent/descriptor' && Number(event.seq) >= seed)
                return false;
            if (type === 'agent-preset/selected' && event.data?.agentPreset)
                preset = event.data.agentPreset;
        }
        return preset === 'roleplay';
    };
    // ── 分支感知：只计算当前 Session surface，而不是 append-only log ────────
    // fork 的 seed 前缀仍是当前分支真实上下文，必须计入阈值；否则从一个已经
    // 很长但尚未压缩的父分支 fork 后，会在超出模型窗口很久以后才触发整理。
    // 已压缩原文在 surface 中已被 summary 替换，因此不会被重复归档。
    function branchSettings(session) {
        try {
            return getEngine()?.settings?.(session.id) ?? null;
        }
        catch {
            return null;
        }
    }
    function memoryForSession(session) {
        const engine = getEngine();
        const storedRecord = engine?.memoryHead?.(session.id) ?? null;
        const checkpoint = checkpointSummaryFromSurface(session);
        const projected = filterMemoryRecordForBranch(storedRecord, session, checkpoint);
        if (!projected)
            return null;
        // Recover only completed compactions whose replacement checkpoint is on
        // this exact surface.  The in-memory head may lag the append-only log, but
        // it must never be allowed to reintroduce a discarded sibling's archive.
        const scope = branchScope(session);
        const durableArchives = durableCompactionArchives(session)
            .filter((item) => belongsToBranch(item, session, scope));
        const storedArchives = projected.archives;
        const seen = new Set(durableArchives.map((item) => item.compactionId || `seq:${item.atSeq}`));
        const archives = [
            ...storedArchives.filter((item) => !seen.has(item?.compactionId || `seq:${item?.atSeq}`)),
            ...durableArchives,
        ].slice(-50);
        return {
            ...projected,
            archives,
            directorNotes: directorNotesForBranch(projected, session),
        };
    }
    const summarizeDetailed = createMemorySummarizer(ctx);
    // ── compaction 服务 ────────────────────────────────────────────────────────
    const svc = {
        backgroundMemory: true,
        prefetchWindowCheckpoint(agent) {
            return organizeAutomatically(agent, { checkpoint: true });
        },
        async ensureWindowCheckpoint(agent, signal) {
            const session = agent?.session;
            if (!session || !isRoleplaySession(session))
                throw new Error('当前会话不是角色扮演会话');
            signal?.throwIfAborted?.();
            const wait = async (job) => {
                signal?.throwIfAborted?.();
                if (!signal)
                    return job;
                let abort;
                try {
                    return await Promise.race([job, new Promise((_, reject) => {
                            abort = () => reject(signal.reason ?? new Error('检查点等待已取消'));
                            signal.addEventListener('abort', abort, { once: true });
                        })]);
                }
                finally {
                    if (abort)
                        signal.removeEventListener('abort', abort);
                }
            };
            // Only eviction waits for a frozen background snapshot. A newer tail
            // may have appeared while it ran, so recheck before saving the remainder.
            // Wait through scheduler cleanup too. Waiting only the raw writer can
            // reuse its already-resolved state.promise and skip the newer tail.
            const active = scheduler.pendingNotes(session.id) ?? notesWriter.pending(session.id);
            if (active) {
                try {
                    await wait(active);
                }
                catch (error) {
                    if (signal?.aborted)
                        throw error;
                }
            }
            const covered = () => {
                const entries = selectedStoryHistory(session);
                const notes = directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session, entries);
                return { entries, notes, complete: entries.length === (notes?.sourceKeys.length ?? 0) };
            };
            let proof = covered();
            if (!proof.complete) {
                signal?.throwIfAborted?.();
                await wait(organizeAutomatically(agent, { checkpoint: true }));
                proof = covered();
            }
            signal?.throwIfAborted?.();
            assertBranchActive(session);
            if (!proof.complete)
                throw new Error('窗口检查点未保存完整，保留当前窗口；请重试');
            return { schemaVersion: 1, status: 'ready', branchId: session.id,
                generationId: proof.notes?.generationId ?? null,
                sourceKeys: historySourceKeys(proof.entries), sourceSeqs: proof.entries.map(entry => entry.seq) };
        },
        async finishTurn(agent, signal) {
            const session = agent?.session;
            if (cfg.autoNotes === false || !session || !isRoleplaySession(session))
                return null;
            scheduleNotes(agent);
            return memoryNotesCadence(session, getEngine()?.memoryHead?.(session.id), Number(getEngine()?.settings?.(session.id)?.autoNotesEveryTurns) || cfg.autoNotesEveryTurns);
        },
        settingsDefaults() { return { autoNotesEveryTurns: cfg.autoNotesEveryTurns, targetContextTokens: cfg.targetContextTokens, archiveTokens: cfg.archiveTokens }; },
        async resumeTask(agent, signal, stage) {
            const session = agent?.session;
            if (!session || !isRoleplaySession(session))
                throw new Error('当前会话不是角色扮演会话');
            // Already inside the main loop. Never enter agent.runMaintenance here.
            return stage === 'compaction' ? compact(session, agent, signal, undefined, { force: true, manual: false })
                : refreshDirectorNotes(session, agent, signal, undefined, { automatic: true });
        },
        storyEvidence(session) {
            return session && isRoleplaySession(session) ? selectedStoryHistory(session) : [];
        },
        legacyCadenceSlotsFor(session, record) {
            return session && isRoleplaySession(session) ? legacyCadenceSlots(selectedStoryHistory(session), record) : [];
        },
        memoryProjection(session) {
            if (!session || !isRoleplaySession(session))
                return null;
            const projected = memoryForSession(session);
            if (!projected)
                return null;
            const history = selectedStoryHistory(session);
            const live = new Set([...surfaceSeqsOf(session), ...history.map(entry => entry.seq)]);
            const scoped = (items) => (Array.isArray(items) ? items : []).filter(item => {
                const seq = provenanceSeqOf(item);
                return seq !== null && live.has(seq);
            });
            const checkpoint = checkpointSummaryFromSurface(session);
            return { ...projected, summary: checkpoint?.text ?? '',
                deltas: scoped(projected.deltas), pendingConfirmations: scoped(projected.pendingConfirmations),
                archiveDigests: scoped(projected.archiveDigests),
                directorNotes: directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session, history) };
        },
        async prepareForTurn(agent, signal) {
            const session = agent?.session;
            if (!session || !isRoleplaySession(session))
                return null;
            await getEngine()?.awaitCommitted?.(session.id);
            // These are live promise handles, not a persisted 'busy' flag. A stale
            // job rejects on its existing source-key fence; then rebuild this branch.
            const active = compactor.pending(session.id);
            if (active) {
                try {
                    await active;
                }
                catch (error) {
                    if (signal?.aborted)
                        throw error;
                }
            }
            signal?.throwIfAborted?.();
            if (getEngine()?.ownsMemoryPreparation !== true && cfg.auto !== false && branchTokensAboveThreshold(session)) {
                await compact(session, agent, signal, undefined, { manual: false });
            }
            if (cfg.autoNotes !== false)
                scheduleNotes(agent);
            const entries = selectedStoryHistory(session);
            const notes = directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session, entries);
            return { schemaVersion: 1, branchId: session.id, generationId: randomUUID(),
                sourceSeqs: entries.map(entry => entry.seq), status: 'ready',
                notesStatus: notes ? (notes.pendingEntries ? 'verified-prefix' : 'current') : 'pending',
                pendingEntries: entries.length - (notes?.sourceKeys.length ?? 0) };
        },
        directorNotes(session) {
            if (!session || !isRoleplaySession(session))
                return null;
            return directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session);
        },
        saveDirectorNotes: notesWriter.saveDirectorNotes,
        history(session, options) {
            if (!session || !isRoleplaySession(session))
                throw new Error('当前会话不是角色扮演会话');
            return getEngine()?.retrieval?.search(session, { ...options }) ?? queryStoryHistory(session, options);
        },
        historyRead(session, options) {
            if (!session || !isRoleplaySession(session))
                throw new Error('当前会话不是角色扮演会话');
            return getEngine()?.retrieval?.read(session, { ...options }) ?? readStoryHistory(session, options);
        },
        async organizeNow(agent, signal, commandId) {
            const session = agent?.session;
            if (!session || !isRoleplaySession(session))
                throw new Error('当前会话不是角色扮演会话');
            const task = (maintenanceSignal) => refreshDirectorNotes(session, agent, signal && maintenanceSignal ? AbortSignal.any([signal, maintenanceSignal]) : signal ?? maintenanceSignal, commandId);
            return typeof agent.runMaintenance === 'function' ? agent.runMaintenance(task) : task(signal);
        },
        organizeIfNeeded: organizeAutomatically,
        async rebuildDirectorNotes(agent, signal, commandId) {
            const session = agent?.session;
            if (!session || !isRoleplaySession(session))
                throw new Error('当前会话不是角色扮演会话');
            const task = (maintenanceSignal) => refreshDirectorNotes(session, agent, signal && maintenanceSignal ? AbortSignal.any([signal, maintenanceSignal]) : signal ?? maintenanceSignal, commandId, { force: true });
            return typeof agent.runMaintenance === 'function' ? agent.runMaintenance(task) : task(signal);
        },
        async compactNow(agent, signal, commandId) {
            const session = agent?.session;
            if (!session || !isRoleplaySession(session))
                throw new Error('当前会话不是角色扮演会话');
            signal?.throwIfAborted?.();
            if (typeof agent.runMaintenance !== 'function') {
                return compact(session, agent, signal, commandId, { force: true, manual: true });
            }
            return agent.runMaintenance(async (maintenanceSignal) => {
                const operationSignal = signal
                    ? AbortSignal.any([maintenanceSignal, signal])
                    : maintenanceSignal;
                return compact(session, agent, operationSignal, commandId, { force: true, manual: true });
            });
        },
        async compactIfNeeded(agent, trigger = 'pressure', signal) {
            const session = agent?.session;
            if (!session || !isRoleplaySession(session))
                return null;
            if (busy.has(session.id))
                return null;
            // Compatibility with the early local draft which accepted
            // compactIfNeeded(agent, signal), while honoring the official
            // (agent, trigger, signal) contract from alpha.3.
            if (trigger && typeof trigger !== 'string') {
                signal = trigger;
                trigger = 'pressure';
            }
            return compactAutomatically(agent, trigger, signal);
        },
    };
    ctx.provide('compaction', svc);
    // ── 自动触发（agent/pre-step，注册在 roleplay-core 之前）──────────────────
    // 阈值计算当前选择分支的完整模型表面（含 fork seed、既有摘要与新剧情），
    // 且支持每分支设置覆盖（侧边栏可调）。
    function branchTokensAboveThreshold(session) {
        let measurement;
        try {
            measurement = ctx.tokenMeter.measure(session);
        }
        catch (error) {
            throw new Error(`无法计量当前分支上下文：${errorMessage(error)}`, { cause: error });
        }
        const nodes = measurement?.nodes;
        if (!Array.isArray(nodes) || nodes.length === 0)
            return false;
        const total = pressureTokens(session, measurement);
        const settings = branchSettings(session);
        const target = Number(settings?.targetContextTokens) || Number(cfg.targetContextTokens) || 262144;
        const hysteresis = Math.max(0, Number(settings?.hysteresisTokens ?? cfg.hysteresisTokens) || 0);
        const triggerAt = Math.max(1, target - Math.min(target - 1, hysteresis));
        return total >= triggerAt;
    }
    if (cfg.auto !== false) {
        ctx.on('agent/pre-step', (payload, next) => {
            const session = payload?.agent?.session;
            if (!session || !isRoleplaySession(session))
                return next();
            if (payload.step !== 1)
                return next();
            const hasUser = payload.messages.some((m) => m.role === 'user' && m.source?.kind === 'user');
            if (!hasUser)
                return next();
            if (getEngine()?.ownsMemoryPreparation === true)
                return next();
            if (busy.has(session.id))
                return next();
            return (async () => {
                try {
                    await compactAutomatically(payload.agent, 'pressure', payload.signal);
                }
                catch (error) {
                    ctx.logger?.warn?.(`roleplay-memory: auto compaction failed: ${String(error)}`);
                }
                return next();
            })();
        });
    }
    if (cfg.autoNotes !== false) {
        ctx.on('session/event', (session, event) => {
            if (isCompletedTurnEnd(event))
                scheduleNotes({ session });
        }, { global: true });
        ctx.on('agent/status', (payload) => {
            if (payload?.status === 'idle')
                scheduleNotes(payload.agent);
        });
    }
    // ── /memory 命令 ───────────────────────────────────────────────────────────
    ctx.inject(['commands'], (commandCtx) => {
        commandCtx.commands.register({
            name: 'memory',
            description: '角色扮演记忆管理：view / organize（更新导演笔记）/ compact（归档旧剧情）/ history / search / lock / unlock / note',
            input: { hint: 'view | organize | compact | history | search <关键词> | lock <事实> | unlock <编号> | note <事实>' },
            handler: async (invocation) => {
                const session = invocation.agent?.session;
                if (!session || !isRoleplaySession(session))
                    return { kind: 'error', text: '当前会话不是角色扮演会话' };
                const raw = (invocation.rawInput ?? '').trim();
                const [verb, ...rest] = raw.split(/\s+/);
                const arg = rest.join(' ').trim();
                if (!verb || verb === 'view') {
                    const mem = memoryForSession(session);
                    if (!mem)
                        return { kind: 'success', text: '（尚无记忆账本）' };
                    const lines = [];
                    lines.push(`记忆账本版本 ${mem.version ?? 1}，增量 ${(mem.deltas ?? []).length} 条，锁定事实 ${(mem.lockedFacts ?? []).length} 条`);
                    if (mem.directorNotes?.text)
                        lines.push(`\n导演笔记（已覆盖 ${mem.directorNotes.sourceEntryCount} 条剧情，待整理 ${mem.directorNotes.pendingEntries} 条）：\n${mem.directorNotes.text.slice(0, 12000)}`);
                    if (mem.summary)
                        lines.push(`\n当前摘要（${mem.summary.length} 字符，最近整理覆盖至 seq ${mem.lastCompactedSeq ?? '?'}）：\n${mem.summary.slice(0, 2400)}`);
                    const deltas = (mem.deltas ?? []).slice(-20);
                    if (deltas.length)
                        lines.push('\n最近增量：\n' + deltas.map((d) => `- (seq ${d.evidenceSeq}) [${d.status}] ${d.summary}`).join('\n'));
                    if ((mem.lockedFacts ?? []).length)
                        lines.push('\n锁定事实：\n' + mem.lockedFacts.map((f, i) => `${i}: ${typeof f === 'string' ? f : f.text}`).join('\n'));
                    const pc = (mem.pendingConfirmations ?? []).slice(-6);
                    if (pc.length)
                        lines.push('\n待确认冲突：\n' + pc.map((c) => `- [${c.severity}] ${c.claim} ← 与「${c.canon}」冲突`).join('\n'));
                    return { kind: 'success', text: lines.join('\n') };
                }
                if (verb === 'organize') {
                    try {
                        const result = await svc.organizeNow(invocation.agent, invocation.signal, invocation.commandId);
                        return { kind: 'success', text: !result.changed && result.reason === 'no-completed-story'
                                ? '当前还没有已完成的剧情；未修改会话。'
                                : result.changed ? `导演笔记已保存：覆盖当前分支 ${result.entries} 条剧情，${result.chars} 字符。剧情原文与上下文未改动。`
                                    : `导演笔记已是最新状态：覆盖当前分支 ${result.entries} 条剧情。` };
                    }
                    catch (error) {
                        return { kind: 'error', text: `导演笔记整理失败：${errorMessage(error)}` };
                    }
                }
                if (verb === 'history' || verb === 'search') {
                    const result = await svc.history(session, { query: verb === 'search' ? arg : '', maxChars: 12000 });
                    return { kind: 'success', text: JSON.stringify(result) };
                }
                if (verb === 'compact') {
                    try {
                        const result = await svc.compactNow(invocation.agent, invocation.signal, invocation.commandId);
                        if (result === null) {
                            return { kind: 'success', text: '当前没有可安全整理的完整剧情区间；未修改会话。' };
                        }
                        return {
                            kind: 'success',
                            text: `整理完成：归档当前分支 surface ${result.shadowedRange.start}…${result.shadowedRange.end}（${result.shadowedSeqs.length} 个节点 / ${result.shadowedTokenCount} tokens），摘要 ${textOf(result.summary).length} 字符。原文事件仍完整保留在日志中。`,
                        };
                    }
                    catch (error) {
                        return { kind: 'error', text: `整理失败：${errorMessage(error)}` };
                    }
                }
                if (verb === 'note' || verb === 'lock') {
                    if (!arg)
                        return { kind: 'error', text: '用法：/memory lock <要永久锁定的事实>' };
                    const engine = getEngine();
                    const mem = memoryForSession(session);
                    const facts = [...(mem?.lockedFacts ?? []).map((f) => (typeof f === 'string' ? { text: f } : f))];
                    facts.push({ text: arg, atSeq: lastSeqOf(session), sessionId: session.id, lockedBy: 'user' });
                    if (engine?.memoryUpdate)
                        await engine.memoryUpdate(session.id, { lockedFacts: facts });
                    return { kind: 'success', text: `已锁定事实（第 ${facts.length} 条）：${arg}` };
                }
                if (verb === 'unlock') {
                    const idx = Number(arg);
                    if (!Number.isInteger(idx))
                        return { kind: 'error', text: '用法：/memory unlock <编号>（编号见 /memory view）' };
                    const engine = getEngine();
                    const mem = memoryForSession(session);
                    const facts = [...(mem?.lockedFacts ?? []).map((f) => (typeof f === 'string' ? { text: f } : f))];
                    if (idx < 0 || idx >= facts.length)
                        return { kind: 'error', text: `编号 ${idx} 不存在` };
                    const [removed] = facts.splice(idx, 1);
                    if (engine?.memoryUpdate)
                        await engine.memoryUpdate(session.id, { lockedFacts: facts });
                    return { kind: 'success', text: `已解锁：${removed.text}` };
                }
                return { kind: 'error', text: '用法：/memory view | organize | lock <事实> | unlock <编号> | note <事实>' };
            },
        });
    });
    ctx.logger?.info?.('roleplay-memory-engine: mounted');
}
