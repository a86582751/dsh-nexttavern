// Generated from runtime/alpha3/core/roleplay-preparation.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { keyOf, sha256, recordSha256, textOf, provenanceSeq, estimateTokens, durableSeq, stableJson, cloneRecord } from './roleplay-data.js';
import { eventsOf, surfaceEvents, surfaceEntries, lastSeq, visibleCompactionCheckpoint, roleplayWindowCutStartIndex } from './roleplay-context.js';
import { fenceCardContent } from './tavern-card.js';
import { internalTaskSeqs, isInlinePending } from './tavern-tasks.js';
export function createRoleplayPreparation(deps) {
    const { T, ctx, assertStoryBranchActive, cfg, svc, ensureBranch, reconcileCanonicalPlayerVariants, buildForkLookupIndex, userValues, selectedStatusRecord } = deps;
    const contextWindowKey = (branchId) => keyOf(branchId, 'context-window');
    const contextWindowFor = (session) => T.branch.get(contextWindowKey(session.id)) ?? {
        windowNumber: 1,
        windowId: randomUUID(),
        previousWindowId: null,
        branchId: session.id,
        startSeq: -1,
        throughSeq: -1,
        storyTokens: 0,
        createdAt: Date.now(),
        rolloverCount: 0,
    };
    const cloneContextWindow = (record) => record && typeof record === 'object'
        ? structuredClone(record)
        : null;
    const ensureContextWindow = async (session, reason = 'initial') => {
        const key = contextWindowKey(session.id);
        const current = T.branch.get(key);
        if (current)
            return current;
        const initial = { ...contextWindowFor(session), reason };
        await T.branch.put(key, initial);
        return initial;
    };
    const rolloverContextWindow = async (session, metadata = {}, options = {}) => {
        const previous = await ensureContextWindow(session, 'initial');
        const next = {
            windowNumber: Number(previous.windowNumber || 1) + 1,
            windowId: randomUUID(),
            previousWindowId: previous.windowId ?? null,
            branchId: session.id,
            startSeq: Number.isSafeInteger(Number(metadata.startSeq)) ? Number(metadata.startSeq) : lastSeq(session),
            throughSeq: lastSeq(session),
            createdAt: Date.now(),
            rolloverCount: Number(previous.rolloverCount || 0) + 1,
            ...metadata,
        };
        // Callers that still need to write the surface checkpoint can request a
        // draft first.  Publishing the boundary before the checkpoint would leave
        // a half-created model window if append/replace fails midway through a
        // rollover.
        if (options.persist !== false)
            await T.branch.put(contextWindowKey(session.id), next);
        return cloneContextWindow(next);
    };
    const visibleStorySurfaceSeqs = (session) => {
        const internal = internalTaskSeqs(session);
        return surfaceEvents(session)
            .filter((event) => (event.type === 'user/message' && event.data?.source?.kind === 'user')
            || (event.type === 'assistant/message' && !internal.has(Number(event.seq))
                && textOf(event.data?.message?.content).trim()
                && !(event.data?.message?.content ?? []).some((block) => block?.type === 'tool-call' || block?.type === 'tool-result')))
            .map((event) => Number(event.seq));
    };
    async function installRoleplayWindowCheckpoint(session, previousWindow, activeWindow, continuityTailTokens, agent, signal) {
        if (!session?.append || !previousWindow || !activeWindow || previousWindow.windowId === activeWindow.windowId)
            return null;
        const surface = surfaceEvents(session);
        const storySeqs = visibleStorySurfaceSeqs(session);
        if (storySeqs.length < 2)
            return null;
        const tail = [];
        let used = 0;
        for (let index = storySeqs.length - 1; index >= 0; index -= 1) {
            const event = eventsOf(session)[storySeqs[index]];
            const text = event?.type === 'assistant/message' ? textOf(event.data?.message?.content) : textOf(event?.data?.content);
            const cost = estimateTokens(text);
            if (tail.length && used + cost > continuityTailTokens)
                break;
            tail.push(storySeqs[index]);
            used += cost;
        }
        tail.reverse();
        const tailSeqs = new Set(tail);
        const cutStory = storySeqs.filter((seq) => !tailSeqs.has(seq));
        if (!cutStory.length)
            return null;
        const anchor = cutStory[0];
        const end = cutStory.at(-1);
        const firstStoryIndex = surface.findIndex((event) => Number(event.seq) === anchor);
        if (firstStoryIndex < 0)
            return null;
        const startIndex = roleplayWindowCutStartIndex(surface, firstStoryIndex);
        const endIndex = surface.findIndex((event) => Number(event.seq) === end);
        if (startIndex < 0 || endIndex < startIndex)
            return null;
        // Surface replacement provenance must cover every node in the contiguous
        // range, including tool results and hidden plugin context nodes.
        const cut = surface.slice(startIndex, endIndex + 1).map((event) => Number(event.seq));
        const sourceFingerprint = recordSha256(surface.map(event => ({ seq: event.seq, type: event.type, data: event.data })));
        const proof = await ctx.get('compaction')?.ensureWindowCheckpoint?.(agent, signal);
        if (proof?.status !== 'ready' || proof.branchId !== session.id || !Array.isArray(proof.sourceKeys)) {
            throw new Error('窗口检查点尚未保存，保留当前窗口；请重试');
        }
        signal?.throwIfAborted?.();
        assertStoryBranchActive(session);
        if (sourceFingerprint !== recordSha256(surfaceEvents(session).map(event => ({ seq: event.seq, type: event.type, data: event.data })))) {
            throw new Error('保存期间窗口来源已变化，保留当前窗口；请重试');
        }
        const checkpoint = session.append('user/message', {
            id: randomUUID(),
            role: 'user',
            content: [{ type: 'text', text: `[角色扮演上下文窗口 ${activeWindow.windowNumber}] 旧剧情已保存在只读历史。当前窗口保留最新 ${continuityTailTokens} tokens 的完整正文；需要旧事实时调用 rp_history。` }],
            source: { kind: 'plugin', plugin: 'roleplay-context-window', form: 'snapshot', schemaVersion: 1,
                checkpointGeneration: proof.generationId, checkpointSourceKeys: proof.sourceKeys,
                checkpointSourceSeqs: proof.sourceSeqs },
        }, {
            surfaceOp: { op: 'replace', start: cut[0], end },
            sourceEventSeqs: [...cut],
        });
        return { checkpointSeq: checkpoint.seq, shadowedSeqs: cut, tailSeqs: tail, usedTokens: used };
    }
    const memoryForContext = (session) => {
        const projection = ctx.get('compaction')?.memoryProjection;
        if (typeof projection === 'function')
            return projection(session);
        const stored = T.memory.get(keyOf(session.id, 'head')) ?? null;
        if (!stored || typeof session?.header?.parentSession !== 'string')
            return stored;
        const seedLength = durableSeq(session.header?.seedLength);
        const proven = (items) => (Array.isArray(items) ? items : []).filter((item) => {
            if (!item || typeof item !== 'object')
                return false;
            const record = item;
            const owners = [record.sessionId, record.branchId, record.ownerSessionId]
                .map((value) => String(value ?? '').trim())
                .filter(Boolean);
            if (owners.length > 0 && owners.every((owner) => owner === session.id))
                return true;
            const seq = provenanceSeq(item);
            return seedLength !== null && seq !== null && seq < seedLength;
        });
        const checkpoint = visibleCompactionCheckpoint(session);
        const summarySeq = [stored.summaryAtSeq, stored.summarySeq, stored.surfaceCheckpointSeq, stored.lastCompactedSeq]
            .map(durableSeq)
            .find((value) => value !== null) ?? null;
        // The memory head itself is updated on every Phase-B commit, so its generic
        // `sessionId` says nothing about who owns an older copied summary.  Only
        // summary-specific provenance may authorize it; conflicting aliases fail
        // closed rather than laundering a parent summary into the child branch.
        const summaryOwners = [stored.summarySessionId, stored.summaryBranchId]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean);
        const summaryOwnerConflict = new Set(summaryOwners).size > 1;
        const safeInheritedMarker = seedLength !== null
            && String(stored.inheritedFrom ?? '') === String(session.header.parentSession)
            && durableSeq(stored.inheritedAtSeedLength) === seedLength
            && (summarySeq === null || summarySeq < seedLength);
        const safeStoredSummary = (!summaryOwnerConflict && summaryOwners.includes(session.id))
            || (seedLength !== null && summarySeq !== null && summarySeq < seedLength)
            || safeInheritedMarker;
        const resolvedSummary = checkpoint?.text ?? (safeStoredSummary ? String(stored.summary ?? '') : '');
        const resolvedSummarySeq = checkpoint?.seq ?? (safeStoredSummary ? summarySeq : null);
        return {
            ...stored,
            // A lazy reader may omit the visible checkpoint, but a ledger summary is
            // accepted only with child ownership, a pre-seed seq, or the exact durable
            // inheritance marker written by ensureBranch. Unknown provenance fails
            // closed instead of leaking post-fork parent facts into this branch.
            summary: resolvedSummary,
            surfaceCheckpointSeq: resolvedSummarySeq,
            lastCompactedSeq: resolvedSummarySeq ?? -1,
            archives: proven(stored.archives),
            archiveDigests: proven(stored.archiveDigests),
            deltas: proven(stored.deltas),
            pendingConfirmations: proven(stored.pendingConfirmations),
            lockedFacts: proven(stored.lockedFacts),
            styleNotes: proven(stored.styleNotes),
            userPrefs: proven(stored.userPrefs),
        };
    };
    const memorySettingFields = ['contextWindowTokens', 'continuityTailTokens', 'autoNotesEveryTurns', 'targetContextTokens', 'archiveTokens'];
    function memorySettingsPolicy(sessionId) {
        const global = T.branch.get('memory-settings-global');
        if (global && global.schemaVersion !== 1)
            throw new Error('不支持的全局记忆设置版本');
        const local = T.branch.get(keyOf(sessionId, 'settings'));
        const defaults = { contextWindowTokens: cfg.contextWindowTokens, continuityTailTokens: cfg.continuityTailTokens,
            autoNotesEveryTurns: 3, targetContextTokens: 262144, archiveTokens: 100000, ...ctx.get('compaction')?.settingsDefaults?.() };
        const pick = (value) => Object.fromEntries(memorySettingFields.filter(f => value?.[f] !== undefined).map(f => [f, value[f]]));
        const effective = { ...defaults };
        for (const layer of [global?.settings, local])
            for (const f of memorySettingFields)
                if (Number(layer?.[f]) > 0)
                    effective[f] = Number(layer[f]);
        return { schemaVersion: 1, sessionId, defaults, global: { settings: pick(global?.settings), revision: recordSha256(global) },
            session: { settings: pick(local), revision: recordSha256(local) }, effective };
    }
    function storyWindowSettings(session) {
        const settings = svc.settings(session.id);
        return {
            limit: Math.max(1000, Number(settings?.contextWindowTokens) || Number(cfg.contextWindowTokens) || 230000),
            tail: Math.max(1000, Number(settings?.continuityTailTokens) || Number(cfg.continuityTailTokens) || 18000),
        };
    }
    async function buildPhaseA(session, payload, st) {
        assertStoryBranchActive(session);
        const phaseAStartedAt = Date.now();
        const branchId = session.id;
        await ensureBranch(session);
        await reconcileCanonicalPlayerVariants(session, buildForkLookupIndex(session));
        // Read only committed branch state. Background notes need not finish on
        // ordinary turns; eviction below is the sole strict notes-save barrier.
        await svc.awaitCommitted(branchId);
        let memoryPreparation = { status: 'ready' };
        try {
            memoryPreparation = await ctx.get('compaction')?.prepareForTurn?.(payload.agent, payload.signal) ?? memoryPreparation;
        }
        catch (error) {
            if (isInlinePending(error) || payload.signal?.aborted || error?.code === 'ROLEPLAY_SOURCE_CHANGED')
                throw error;
            memoryPreparation = { status: 'retry', branchId, reason: '当前分支持久记忆准备失败，可重试' };
        }
        assertStoryBranchActive(session);
        const userMsg = payload.messages.findLast((m) => m.role === 'user' && m.source?.kind === 'user');
        const userText = userMsg ? textOf(userMsg.content) : '';
        const mem = memoryForContext(session);
        let directorNotes = ctx.get('compaction')?.directorNotes?.(session);
        // 快照（不可变；worker 只读）
        const baseRevision = lastSeq(session);
        const currentContextWindow = await ensureContextWindow(session, 'initial');
        const storyStartSeq = Number.isSafeInteger(currentContextWindow.startSeq)
            ? currentContextWindow.startSeq
            : -1;
        const storySinceWindow = surfaceEntries(session)
            .filter((entry) => entry.seq > storyStartSeq);
        const storySinceTokens = storySinceWindow.reduce((sum, entry) => sum + estimateTokens(entry.text), 0);
        const windowSettings = storyWindowSettings(session);
        const rolloverNeeded = cfg.contextWindowEnabled !== false
            && storySinceTokens >= windowSettings.limit;
        if (!rolloverNeeded && cfg.contextWindowEnabled !== false
            && storySinceTokens >= windowSettings.limit * 0.9) {
            Promise.resolve(ctx.get('compaction')?.prefetchWindowCheckpoint?.(payload.agent))
                .catch(() => ctx.logger?.warn?.('roleplay: early checkpoint save failed; window retained'));
        }
        let activeContextWindow = rolloverNeeded
            ? await rolloverContextWindow(session, {
                reason: 'roleplay-story-window-pressure',
                // The old window is cut before this turn.  The current turn's user
                // message is admitted into the new prompt and the continuity tail
                // is selected from the retained downstream messages below.
                startSeq: baseRevision,
                previousStoryTokens: storySinceTokens,
                continuityTailTokens: windowSettings.tail,
            }, { persist: false })
            : currentContextWindow;
        let didRollover = false;
        if (rolloverNeeded) {
            try {
                const checkpoint = await installRoleplayWindowCheckpoint(session, currentContextWindow, activeContextWindow, windowSettings.tail, payload.agent, payload.signal);
                if (checkpoint) {
                    const committedWindow = {
                        ...activeContextWindow,
                        // The continuity tail is part of the new model window.  Advance
                        // the boundary to just before its first visible story node;
                        // using the pre-rollover lastSeq here would drop the tail on the
                        // very next request.
                        startSeq: checkpoint.tailSeqs.length > 0
                            ? Number(checkpoint.tailSeqs[0]) - 1
                            : activeContextWindow.startSeq,
                        checkpointSeq: checkpoint.checkpointSeq,
                        shadowedSeqs: checkpoint.shadowedSeqs,
                        tailSeqs: checkpoint.tailSeqs,
                        continuityTokens: checkpoint.usedTokens,
                    };
                    await T.branch.put(contextWindowKey(session.id), committedWindow);
                    activeContextWindow = committedWindow;
                    didRollover = true;
                    directorNotes = ctx.get('compaction')?.directorNotes?.(session);
                }
                else {
                    activeContextWindow = currentContextWindow;
                }
            }
            catch (error) {
                activeContextWindow = currentContextWindow;
                ctx.logger?.warn?.(`roleplay: context-window checkpoint failed; keeping previous window: ${String(error)}`);
                throw error;
            }
        }
        const snapshot = {
            branchId,
            agent: payload.agent,
            turnId: payload.turn,
            baseRevision,
            lastSeq: baseRevision,
            userMessageId: typeof userMsg?.id === 'string' ? userMsg.id : null,
            userText,
            cardVersion: null,
            worldbookVersion: null,
            memoryVersion: mem?.version ?? null,
            contextWindow: {
                windowNumber: activeContextWindow.windowNumber,
                windowId: activeContextWindow.windowId,
                previousWindowId: activeContextWindow.previousWindowId ?? null,
                rollover: didRollover,
            },
        };
        // Deterministic context assembly. The author already sees the selected
        // native story window; no scene/recall model and no automatic lore lookup.
        snapshot.memoryProjection = { schemaVersion: 1, branchId, mode: 'direct-notes',
            notesGenerationId: directorNotes?.generationId ?? null,
            notesSourceSeqs: directorNotes?.sourceSeqs ?? [], windowId: activeContextWindow.windowId };
        const visibleAnchor = (form, hashField, hash) => surfaceEvents(session).findLast((event) => {
            const source = event?.type === 'user/message' ? event.data?.source : null;
            return source?.kind === 'plugin' && source.plugin === 'roleplay-context'
                && source.form === form && source.branchId === branchId && source.mode === 'full' && source[hashField] === hash;
        }) ?? null;
        const contextMessage = (form, source, body) => ({
            id: randomUUID(), role: 'user', content: [{ type: 'text', text: body }],
            source: { kind: 'plugin', plugin: 'roleplay-context', form, schemaVersion: 1, branchId, ...source },
        });
        const values = userValues(branchId);
        const renderContextText = (value) => String(value ?? '')
            .replace(/\{\{\s*(?:user|user_name)\s*\}\}/gi, values.name)
            .replace(/\{\{\s*(?:user[_-]gender|userGender)\s*\}\}/gi, values.gender);
        const anchors = [];
        const renderedNotes = renderContextText(directorNotes?.text);
        const notesHash = sha256(stableJson({ text: renderedNotes, sourceKeys: directorNotes?.sourceKeys ?? [], sourceSeqs: directorNotes?.sourceSeqs ?? [] }));
        const priorNotes = visibleAnchor('director-notes', 'notesHash', notesHash);
        anchors.push(contextMessage('director-notes', { notesHash, notesGenerationId: directorNotes?.generationId ?? null, mode: priorNotes ? 'reference' : 'full' }, priorNotes
            ? `[导演笔记锚点·当前版本优先·引用版本 ${notesHash}]\n请读取上方标有“完整版本 ${notesHash}”的同分支完整锚点；沿用该版本，不采用较早或其他分支版本。`
            : renderedNotes
                ? `[导演笔记锚点·当前版本优先·完整版本 ${notesHash}]\n以下是当前分支最新已核验导演笔记；若上方存在较早锚点，以本版本为准。\n${renderedNotes}`
                : `[导演笔记锚点·当前版本优先·完整版本 ${notesHash}]\n本分支当前没有可用导演笔记；所有较早导演笔记均已失效，不得继续采用。`));
        const sections = [];
        if (Array.isArray(mem?.lockedFacts) && mem.lockedFacts.length) {
            sections.push('[用户锁定的剧情事实]\n' + mem.lockedFacts.map(fact => typeof fact === 'string' ? fact : String(fact?.text ?? '')).filter(Boolean).join('\n'));
        }
        sections.push('[按需查阅资料]\n当前窗口正文和已核验导演笔记由程序直接提供。你是负责写作的主代理：现有信息充分时直接创作；发现旧事件细节缺口时调用 rp_history search/read，需要世界知识时调用 rp_worldbook_search 或 rp_worldbook_list/read。自行判断查询词与是否继续读取，不要每轮例行检索，不把资料查询过程写成剧情。');
        if (didRollover)
            sections.push(`[角色扮演上下文窗口]\n已进入第 ${activeContextWindow.windowNumber} 个剧情窗口。旧窗口的来源与检查点已保存；缺少细节时通过 rp_history 读取所选分支原文。`);
        // 初始剧情：仅在故事尚未开始（还没有任何正文回复）时注入一次；
        // 要求模型输出第一幕（原文或适度润色），而不是跳过开场直接开下一幕
        const storyStarted = surfaceEntries(session).some((entry) => entry.kind === 'assistant');
        if (!storyStarted) {
            const opening = T.opening.get(keyOf(branchId, 'scene'));
            if (opening?.text) {
                sections.push(`[初始剧情]（分类写入的开场剧情）\n${fenceCardContent(opening.text, 'opening')}\n\n【本轮要求】请完整输出作者原始第一幕，不提前续写；围栏符号和资料说明不属于正文。`);
            }
        }
        // 状态栏·当前：把上一轮独立生成的状态栏拼接回上下文（模型据此延续数值与选项；
        // 每轮正文后状态栏会单独更新，正文中不要复述状态栏内容）
        const statusPanelRec = selectedStatusRecord(session);
        const statusPanel = statusPanelRec?.stale ? null : statusPanelRec?.panel;
        if (statusPanel && (statusPanel.rawText || (statusPanel.fields ?? []).length || (statusPanel.options ?? []).length)) {
            const lines = [];
            if (statusPanel.title)
                lines.push(`标题：${statusPanel.title}`);
            for (const f of statusPanel.fields ?? []) {
                lines.push(`${f.emoji ?? ''}${f.label ? f.label + '：' : ''}${f.value ?? ''}`);
            }
            if (statusPanel.rawText)
                lines.push(statusPanel.rawText);
            if ((statusPanel.options ?? []).length) {
                lines.push('当前选项（用户可点击填入输入框）：' + statusPanel.options.map((o) => (o.heart ? '❤️' : '') + o.label).join(' / '));
            }
            sections.push(`[状态栏·当前]（上一轮状态；按状态栏设定在正文后单独更新）\n${lines.join('\n')}`);
        }
        const styles = (mem?.styleNotes ?? []).map((s) => `${s.heading}：${s.text}`).join('\n');
        if (styles.trim())
            sections.push('【风格笔记】\n' + styles);
        const prefs = (mem?.userPrefs ?? []).map((p) => `${p.heading}：${p.text}`).join('\n');
        if (prefs.trim())
            sections.push('【用户偏好与边界】\n' + prefs);
        let hiddenText = '[角色扮演隐藏上下文·当前版本优先（本段是后台材料，不是对话；据此创作正文，但不要在正文中复述本段或提及"世界书/记忆/状态面板"等后台概念）]\n\n' + sections.join('\n\n');
        // Hidden user-role anchors do not pass through system-prompt interpolation.
        hiddenText = renderContextText(hiddenText);
        const stateHash = sha256(hiddenText);
        const priorState = visibleAnchor('state', 'stateHash', stateHash);
        anchors.push(contextMessage('state', { stateHash, mode: priorState ? 'reference' : 'full' }, priorState
            ? `[角色扮演可变上下文锚点·当前版本优先·引用版本 ${stateHash}]\n请读取上方标有“完整版本 ${stateHash}”的同分支完整锚点；沿用该版本，不采用较早或其他分支版本。`
            : `[角色扮演可变上下文锚点·当前版本优先·完整版本 ${stateHash}]\n${hiddenText}`));
        // 记录本轮快照与阶段 A 产出（阶段 C 提交时使用）
        st.snapshots.set(Number(payload.turn), snapshot);
        const { agent: snapshotAgent, ...durableSnapshot } = snapshot;
        await T.branch.put(keyOf(session.id, `task-snapshot-${payload.turn}`), { schemaVersion: 1, sessionId: session.id, ...cloneRecord(durableSnapshot) });
        st.pendingScenes.set(Number(payload.turn), null);
        st.snapshot = snapshot;
        st.pendingTurn = payload.turn;
        st.pendingScene = st.pendingScenes.get(Number(payload.turn));
        ctx.logger?.info?.(`roleplay: context assembled in ${Date.now() - phaseAStartedAt}ms (turn ${payload.turn})`);
        return anchors;
    }
    return { memorySettingsPolicy, contextWindowKey, cloneContextWindow, buildPhaseA, storyWindowSettings, memoryForContext, contextWindowFor, memorySettingFields };
}
