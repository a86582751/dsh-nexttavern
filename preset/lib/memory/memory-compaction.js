// Generated from runtime/alpha3/src/memory/memory-compaction.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { estimateTokens, durableSeq, textOf } from './memory-provenance.js';
import { surfaceSeqsOf, contentOfEvent, importManagementInputs, isStoryEvent, isCompletedTurnEnd, canonicalAssistantSeqsOf, selectedStoryHistory, historySourceKeys, isCompactedStoryEvent } from './memory-history.js';
import { validateDetailedSummary } from './memory-summary.js';
import { projectStoryEvent } from '../core/roleplay-message-view.js';
import { sessionEvents } from '../core/session-history.js';
function errorText(error) {
    if (error instanceof Error)
        return error.stack || error.message;
    return String(error);
}
function errorMessage(error) {
    return String(error !== null && typeof error === 'object' && 'message' in error ? error.message ?? error : error);
}
function eventsOf(session) {
    return sessionEvents(session);
}
export function checkpointSummaryFromSurface(session) {
    const events = eventsOf(session);
    const visible = new Set(surfaceSeqsOf(session));
    let text = '';
    let seq = -1;
    for (const event of events) {
        if (!visible.has(Number(event?.seq)) || !isCompactedStoryEvent(event))
            continue;
        const raw = textOf(contentOfEvent(projectStoryEvent(session, event)));
        const match = raw.match(/<compacted-summary>\s*([\s\S]*?)\s*<\/compacted-summary>/i);
        text = (match?.[1] ?? raw).trim();
        seq = Number(event.seq);
    }
    return text ? { text, seq } : null;
}
export function durableCompactionArchives(session) {
    const events = eventsOf(session);
    // The append-only log contains compactions from discarded branches too.
    // A summary/checkpoint pair is durable only when its replacement checkpoint
    // is currently visible on this session surface.  Looking at the log alone
    // would re-introduce a sibling's future archive when a child is lazy-loaded.
    const visible = new Set(surfaceSeqsOf(session));
    const ended = new Set(events
        .filter((event) => event?.type === 'compaction/end' && !event.data?.error)
        .map((event) => String(event.data?.compactionId ?? '')));
    const archives = [];
    for (const summaryEvent of events) {
        if (summaryEvent?.type !== 'compaction/summary')
            continue;
        const compactionId = String(summaryEvent.data?.compactionId ?? '');
        if (!compactionId || !ended.has(compactionId))
            continue;
        const summarySeq = durableSeq(summaryEvent.seq);
        if (summarySeq === null)
            continue;
        const checkpoint = events[summarySeq + 1];
        const checkpointSeq = durableSeq(checkpoint?.seq);
        if (checkpoint?.type !== 'user/message' ||
            checkpoint.data?.source?.kind !== 'plugin' ||
            checkpoint.data?.source?.plugin !== 'compact' ||
            String(checkpoint.data?.source?.compactionId ?? '') !== compactionId ||
            typeof checkpoint.surfaceOp !== 'object' || checkpoint.surfaceOp.op !== 'replace' ||
            checkpointSeq === null ||
            !visible.has(checkpointSeq))
            continue;
        archives.push({
            compactionId,
            sessionId: session.id,
            range: summaryEvent.data?.shadowedRange,
            seqs: summaryEvent.data?.shadowedSeqs,
            atSeq: summarySeq,
            checkpointSeq,
            recoveredFromLog: true,
        });
    }
    return archives;
}
export function inspectCompactionState(session) {
    let openTurn = null;
    let openTurnKnown = false;
    let unmatchedStart = null;
    let compactionKnown = false;
    let latestEndSeedSeq;
    const events = eventsOf(session);
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (latestEndSeedSeq === undefined && event?.type === 'session/end-seed') {
            latestEndSeedSeq = Number(event.seq);
        }
        if (!compactionKnown) {
            if (event?.type === 'compaction/start') {
                unmatchedStart = event;
                compactionKnown = true;
            }
            else if (event?.type === 'compaction/end') {
                compactionKnown = true;
            }
        }
        if (!openTurnKnown) {
            if (event?.type === 'turn/start') {
                openTurn = Number(event.data?.turn);
                openTurnKnown = true;
            }
            else if (event?.type === 'turn/end') {
                openTurnKnown = true;
            }
        }
        if (openTurnKnown && compactionKnown && latestEndSeedSeq !== undefined)
            break;
    }
    const active = unmatchedStart !== null &&
        !(latestEndSeedSeq !== undefined && latestEndSeedSeq > Number(unmatchedStart.seq));
    return { openTurn, unmatchedStart: active ? unmatchedStart : null };
}
export function createMemoryCompactor(options) {
    const { config: cfg, getEngine, memoryForSession, branchSettings, assertBranchActive, summarizeDetailed, getTokenMeter } = options;
    const busy = new Set();
    const activeCompactions = new Map();
    function storySurface(session, measurement) {
        const log = eventsOf(session);
        const management = importManagementInputs(session);
        const surfaceSeqs = surfaceSeqsOf(session);
        const canonicalAssistantSeqs = canonicalAssistantSeqsOf(session);
        const measured = Array.isArray(measurement?.nodes) ? measurement.nodes : [];
        if (surfaceSeqs.length !== measured.length || surfaceSeqs.some((seq, index) => seq !== measured[index]?.seq)) {
            throw new Error('roleplay-memory: token meter 与当前会话 surface 不一致');
        }
        return surfaceSeqs.map((seq, position) => {
            const original = log[seq];
            const event = original ? projectStoryEvent(session, original) : undefined;
            const story = isStoryEvent(event, canonicalAssistantSeqs, management);
            return {
                seq,
                position,
                event,
                measurement: measured[position],
                story,
                // 已归档摘要仍占模型上下文，因此参与阈值计算；但它不是新的剧情
                // 原文，绝不再次送入摘要器或作为可归档范围的起点。
                context: story || isCompactedStoryEvent(event),
            };
        });
    }
    function branchTokens(surface) {
        return surface
            .filter((node) => node.context)
            .reduce((total, node) => total + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0);
    }
    function pressureTokens(session, measurement) {
        // Trigger from the complete routed request pressure so a large immutable
        // card/worldbook cannot silently consume the model window. Selection and
        // summarization below remain plot-only.
        return Math.max(Number(measurement?.totalTokens) || 0, branchTokens(storySurface(session, measurement)));
    }
    // ── 选择待归档区间（头锚定，仅本分支活区）─────────────────────────────────
    function selectArchiveRange(session, { force = false } = {}) {
        let measurement;
        try {
            measurement = getTokenMeter().measure(session);
        }
        catch (error) {
            throw new Error(`无法计量当前分支上下文，未修改会话：${errorMessage(error)}`, { cause: error });
        }
        const surface = storySurface(session, measurement);
        const storyNodes = surface.filter((node) => node.story);
        if (storyNodes.length === 0)
            return null;
        const settings = branchSettings(session);
        const target = Number(settings?.targetContextTokens) || Number(cfg.targetContextTokens) || 262144;
        const hysteresis = Math.max(0, Number(settings?.hysteresisTokens ?? cfg.hysteresisTokens) || 0);
        const triggerAt = Math.max(1, target - Math.min(target - 1, hysteresis));
        const total = Math.max(Number(measurement?.totalTokens) || 0, branchTokens(surface));
        if (!force && total < triggerAt)
            return null;
        const archiveTarget = Number(settings?.archiveTokens) || Number(cfg.archiveTokens) || 100000;
        const rawStoryTokens = storyNodes.reduce((sum, node) => sum + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0);
        // 正常情况下每次最多归档 archiveTokens，并保留其余最新剧情；当角色卡/
        // 世界书等不可压缩前缀很大、导致完整请求提前触线时，允许剧情保留量自适应
        // 降到 target 的 1/4（但仍不摘要那些前缀）。否则“完整压力触发”会因固定的
        // target-archive 保留线而永远选不出范围。
        const emergencyTail = Math.min(archiveTarget, Math.floor(target / 4), Math.floor(rawStoryTokens / 4));
        const retainFloor = Math.min(rawStoryTokens, Math.max(emergencyTail, rawStoryTokens - archiveTarget));
        const log = eventsOf(session);
        const completedTurns = new Set(log.filter(isCompletedTurnEnd).map((event) => Number(event.data?.turn)));
        const lastSurfacePositionByTurn = new Map();
        for (const node of surface) {
            const turn = Number(node.event?.data?.turn);
            if (Number.isFinite(turn))
                lastSurfacePositionByTurn.set(turn, node.position);
        }
        // 一个归档单元从真实用户剧情输入开始，在已落盘 turn/end 的最后一条
        // assistant 正文结束；不能从半轮开始，也不能吞掉仍在生成的尾轮。
        // An imported opening remains plot even when its preceding user message
        // is a configuration/import command, not a fictional player action.
        const firstStory = storyNodes[0];
        if (!firstStory)
            return null;
        // 后续整理必须同时替换之前的 compacted-summary；新摘要已经合并了
        // previousSummary，若把旧摘要留在 surface，会重复占上下文并让模型看到
        // 两份不同代际的记忆。只把位于首段待归档剧情之前的 context 节点纳入。
        const first = surface.find((node) => node.context && node.position <= firstStory.position) ?? firstStory;
        let storyAcc = 0;
        let endPosition = -1;
        for (let position = first.position; position < surface.length; position += 1) {
            const node = surface[position];
            if (node.story)
                storyAcc += Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0;
            const turn = Number(node.event?.data?.turn);
            const completeBoundary = Number.isFinite(turn)
                && completedTurns.has(turn)
                && lastSurfacePositionByTurn.get(turn) === position;
            if (!completeBoundary)
                continue;
            if (rawStoryTokens - storyAcc < retainFloor) {
                // Turns are indivisible. Permit the first complete turn to overshoot
                // archiveTokens when doing so still leaves the emergency recent tail.
                if (endPosition < first.position && rawStoryTokens - storyAcc >= emergencyTail) {
                    endPosition = position;
                }
                break;
            }
            endPosition = position;
            if (storyAcc >= archiveTarget)
                break;
        }
        if (endPosition < first.position)
            return null;
        const selected = surface.slice(first.position, endPosition + 1);
        const shadowedSeqs = selected.map((node) => node.seq);
        const storySeqs = selected.filter((node) => node.story).map((node) => node.seq);
        return {
            // start/end 是 surface 位置的首尾；替换后的 seq 可以非单调，绝不数值排序。
            start: shadowedSeqs[0],
            end: shadowedSeqs.at(-1),
            startPosition: first.position,
            endPosition,
            shadowedSeqs,
            storySeqs,
            shadowedTokenCount: selected.reduce((sum, node) => sum + (Number(node.measurement?.heuristicTokens) || 0), 0),
            routeTokenCount: selected.reduce((sum, node) => sum + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0),
            storyTokenCount: selected.filter((node) => node.story).reduce((sum, node) => sum + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0),
            totalTokens: total,
        };
    }
    // ── 单次压缩 ──────────────────────────────────────────────────────────────
    function storyTextForSeqs(session, seqs) {
        const log = eventsOf(session);
        return seqs.map((seq) => {
            const original = log[seq];
            const event = original ? projectStoryEvent(session, original) : undefined;
            if (!isStoryEvent(event))
                return '';
            const role = event.type === 'user/message' ? '用户' : '叙事者';
            return `\n[${role} · seq:${seq}]\n${textOf(contentOfEvent(event))}`;
        }).filter(Boolean).join('\n');
    }
    function assertSelectedSurfaceStable(session, range) {
        const nodes = surfaceSeqsOf(session);
        const startPosition = nodes.indexOf(range.start);
        if (startPosition < 0)
            throw new Error('整理期间归档区间起点已离开当前分支');
        const current = nodes.slice(startPosition, startPosition + range.shadowedSeqs.length);
        if (current.length !== range.shadowedSeqs.length
            || current.some((seq, index) => seq !== range.shadowedSeqs[index])) {
            throw new Error('整理期间当前分支的归档区间发生变化，请重试');
        }
    }
    function reusableSummary(session, range, mem, sourceText, locked) {
        if (mem.directorNotes?.manual === true)
            return null;
        const selected = {
            id: session.id, header: session.header, events: eventsOf(session),
            surface: { nodes: range.shadowedSeqs, contentGeneration: session.surface?.contentGeneration },
            deriveEventMessage: session.deriveEventMessage?.bind(session),
        };
        const history = selectedStoryHistory(selected);
        const expected = historySourceKeys(history);
        if (!expected.length)
            return null;
        const candidates = [mem.directorNotes, ...(Array.isArray(mem.directorCheckpoints) ? mem.directorCheckpoints.toReversed() : [])];
        for (const candidate of candidates) {
            if (candidate?.validated !== true || candidate.manual === true || typeof candidate.text !== 'string' || !Array.isArray(candidate.sourceKeys))
                continue;
            if (candidate.sourceKeys.length !== expected.length || expected.some((key, index) => candidate.sourceKeys[index] !== key))
                continue;
            try {
                validateDetailedSummary(candidate.text, sourceText, locked);
            }
            catch {
                continue;
            }
            return { text: candidate.text, summary: [{ type: 'text', text: candidate.text }], reused: true };
        }
        return null;
    }
    function compact(session, ...args) {
        if (activeCompactions.has(session.id))
            return Promise.reject(new Error('记忆整理正在进行中，请稍后再试'));
        const job = performCompaction(session, ...args).finally(() => {
            if (activeCompactions.get(session.id) === job)
                activeCompactions.delete(session.id);
        });
        activeCompactions.set(session.id, job);
        return job;
    }
    async function performCompaction(session, _agent, signal, sourceCommandId, { force = false, manual = false } = {}) {
        assertBranchActive(session);
        if (busy.has(session.id))
            throw new Error('记忆整理正在进行中，请稍后再试');
        signal?.throwIfAborted?.();
        busy.add(session.id);
        let startEvent = null;
        let lifecycle = null;
        let closed = false;
        try {
            const engine = getEngine();
            if (!engine || typeof engine.memoryHead !== 'function')
                throw new Error('roleplay 核心未就绪');
            // Phase B commits memory/scene asynchronously after the agent becomes
            // idle. A host exposing this barrier lets compaction serialize against
            // that writer instead of racing its read-modify-write memoryUpdate.
            if (typeof engine.awaitCommitted === 'function')
                await engine.awaitCommitted(session.id);
            signal?.throwIfAborted?.();
            const range = selectArchiveRange(session, { force });
            if (!range)
                return null;
            const entryState = inspectCompactionState(session);
            if (entryState.unmatchedStart) {
                throw new Error(`会话已有未闭合的记忆整理事务：${entryState.unmatchedStart.data?.compactionId ?? entryState.unmatchedStart.seq}`);
            }
            if (manual && entryState.openTurn !== null)
                throw new Error('手动记忆整理只能在 agent 空闲时执行');
            if (!manual && entryState.openTurn === null)
                throw new Error('自动记忆整理必须位于一个已开启的 turn 内');
            // 只读取当前 surface 中本次选中的真实 user/assistant 剧情；工具结果、
            // 未选分支、角色卡/世界书存储与插件检查点不进入剧情摘要。
            const sourceText = storyTextForSeqs(session, range.storySeqs);
            if (!sourceText.trim())
                throw new Error('归档区间没有可用原文');
            const mem = memoryForSession(session) ?? {};
            // lockedFacts() 会把角色卡/世界书也聚合进来；记忆压缩不得复制这些
            // 独立材料，只保留用户在记忆账本中显式锁定的剧情事实。
            const locked = Array.isArray(mem.lockedFacts) ? mem.lockedFacts : [];
            const lockedText = locked.length
                ? locked.map((f) => typeof f === 'string' ? f : String(f?.text ?? '')).filter(Boolean).join('\n')
                : '（无）';
            const prevSummary = mem.summary ?? '（首次整理）';
            // 先落盘 start 作为锁，再进行可能耗时的高保真增量摘要。
            // start 之后的任何失败都必须恰好尝试一次 end(error)。
            const compactionId = randomUUID();
            lifecycle = {
                compactionId,
                ...(sourceCommandId === undefined ? {} : { sourceCommandId }),
                turn: manual ? null : entryState.openTurn,
            };
            startEvent = session.append('compaction/start', lifecycle);
            const settings = branchSettings(session);
            const maxTokens = Math.max(1, Number(settings?.maxSummaryTokens ?? cfg.maxSummaryTokens) || 16384);
            const timeoutMs = manual
                ? Math.max(30000, Number(settings?.summaryTimeoutMs ?? cfg.summaryTimeoutMs) || 300000)
                : Math.max(1000, Math.min(60000, Number(cfg.autoTimeoutMs) || 30000));
            const summaryResult = reusableSummary(session, range, mem, sourceText, locked) ?? await summarizeDetailed({
                taskStage: 'compaction',
                session,
                previousSummary: prevSummary,
                sourceText,
                lockedText,
                maxTokens,
                timeoutMs,
                signal,
            });
            const summary = summaryResult.text;
            if (!summary.trim())
                throw new Error('摘要生成失败');
            validateDetailedSummary(summary, sourceText, locked);
            const summaryBlocks = summaryResult.summary;
            const checkpointMessage = {
                id: randomUUID(),
                role: 'user',
                content: [
                    { type: 'text', text: '这是自动生成的剧情记忆检查点。请把它视为已发生的背景，只从后续消息继续剧情，不要复述或提及整理过程。\n\n<compacted-summary>' },
                    ...summaryBlocks,
                    { type: 'text', text: '</compacted-summary>' },
                ],
                source: { kind: 'plugin', plugin: 'compact', compactionId, ...(sourceCommandId === undefined ? {} : { sourceCommandId }) },
            };
            // 用当前路由定价比较实际替换消息；没有 estimateMessage 的兼容环境
            // 才退回字符启发式。必须真正降低下一次请求压力。
            const meter = getTokenMeter();
            const checkpointTokens = typeof meter.estimateMessage === 'function'
                ? Number(meter.estimateMessage(checkpointMessage))
                : estimateTokens(checkpointMessage.content.map((block) => block.text ?? '').join('\n'));
            if (checkpointTokens >= range.routeTokenCount) {
                throw new Error('摘要不小于被遮蔽内容，放弃本次整理');
            }
            // 只要求被选 span 保持不变；摘要期间追加到尾部的新消息不应让已完成工作作废。
            signal?.throwIfAborted?.();
            assertSelectedSurfaceStable(session, range);
            // Edits preserve nodes/seq. A summary created from an older body must
            // never replace the newly edited text after the model request returns.
            if (storyTextForSeqs(session, range.storySeqs) !== sourceText) {
                throw new Error('整理期间归档正文已编辑，请重试');
            }
            assertBranchActive(session);
            const summaryEvent = session.append('compaction/summary', {
                compactionId,
                ...(sourceCommandId === undefined ? {} : { sourceCommandId }),
                summary: summaryBlocks,
                ...(summaryResult.reused ? {} : { rawOutput: summaryResult.rawOutput, nativeTask: true }),
                shadowedRange: { start: range.start, end: range.end },
                shadowedSeqs: [...range.shadowedSeqs],
                shadowedTokenCount: range.shadowedTokenCount,
                // Reused/legacy summaries without attribution are unknown, never a
                // guessed current selection or a stale YAML worker default.
                provider: summaryResult.actualRoute?.provider ?? 'unknown',
                model: summaryResult.actualRoute?.model ?? 'unknown',
                maxTokens,
                ...(summaryResult.usage === undefined ? {} : { usage: summaryResult.usage }),
            });
            const checkpointEvent = session.append('user/message', checkpointMessage, {
                surfaceOp: { op: 'replace', startSeq: range.start, endSeq: range.end },
                sourceEventSeqs: [startEvent.seq, summaryEvent.seq, ...range.shadowedSeqs],
            });
            const endEvent = session.append('compaction/end', lifecycle);
            closed = true;
            // 更新记忆账本（经 roleplay 服务，单写者）
            const currentEngine = getEngine();
            if (currentEngine && typeof currentEngine.memoryUpdate === 'function') {
                try {
                    await currentEngine.memoryUpdate(session.id, {
                        summary,
                        lastCompactedSeq: range.end,
                        surfaceCheckpointSeq: checkpointEvent.seq,
                        // Explicit ownership/provenance lets a child safely recover a
                        // copied head when its checkpoint is lazy-loaded.  Do not rely on
                        // wall-clock fields or a generic `sessionId` alone for summaries.
                        summarySessionId: session.id,
                        summaryAtSeq: checkpointEvent.seq,
                        archives: [...(mem.archives ?? []), { compactionId, sessionId: session.id, range: { start: range.start, end: range.end }, seqs: range.shadowedSeqs, storySeqs: range.storySeqs, atSeq: summaryEvent.seq, checkpointSeq: checkpointEvent.seq, time: Date.now() }].slice(-50),
                    });
                }
                catch (error) {
                    // surface 检查点已经完整提交并闭合，账本镜像失败不能伪装成事务失败。
                    options.warn?.(`roleplay-memory: memory ledger update failed: ${errorText(error)}`);
                }
            }
            if (manual)
                await options.flush?.(session);
            return {
                compactionId,
                ...(sourceCommandId === undefined ? {} : { sourceCommandId }),
                startSeq: startEvent.seq,
                summarySeq: summaryEvent.seq,
                endSeq: endEvent.seq,
                summary: summaryBlocks,
                shadowedRange: { start: range.start, end: range.end },
                shadowedSeqs: [...range.shadowedSeqs],
                shadowedTokenCount: range.shadowedTokenCount,
            };
        }
        catch (error) {
            if (startEvent && lifecycle && !closed) {
                try {
                    session.append('compaction/end', { ...lifecycle, error: errorText(error) });
                    closed = true;
                }
                catch (closeError) {
                    throw new Error(`记忆整理失败，且 compaction/end(error) 闭合失败：${errorText(closeError)}`, { cause: error });
                }
            }
            throw error;
        }
        finally {
            busy.delete(session.id);
        }
    }
    const busyView = busy;
    return { compact, pressureTokens, busy: busyView,
        pending: (sessionId) => activeCompactions.get(sessionId) };
}
