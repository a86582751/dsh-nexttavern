// Generated from runtime/alpha3/src/core/roleplay-worldlines.ts; edit the TypeScript source.
import { randomUUID } from 'node:crypto';
import { completedAssistantReceiptForTurn } from './roleplay-context.js';
import { createWorldlineSurface } from './roleplay-worldline-surface.js';
export { assertBranchSession } from './roleplay-worldline-surface.js';
export function createRoleplayWorldlines(deps) {
    const { ctx } = deps;
    const { safeId, keyOf, sha256, T, eventsOf, isCompletedTurnEnd, surfaceEvents, textOf, cloneBranchRecord, internalTaskSeqs, importActiveKey, resolveRoleplaySession, isRoleplaySession, ensureState, ensureBranch, durableSeq, canonicalAssistantForTurn, } = deps;
    const forkGroupKey = (groupId) => `fork-group-${safeId(groupId)}`;
    const forkOperationKey = (operationId) => `fork-op-${safeId(operationId)}`;
    const forkAnchorKey = (sessionId, messageId) => keyOf(sessionId, `fork-anchor-${sha256(messageId).slice(0, 24)}`);
    const forkPendingKey = (sessionId, groupId) => keyOf(sessionId, `fork-pending-${safeId(groupId)}`);
    const forkAnchorLockKey = (anchor) => {
        const sourceId = String(anchor?.sourceSessionId ?? '');
        const messageId = String(anchor?.sourceAssistantMessageId ?? '');
        return `anchor:${sourceId}:${sha256(messageId).slice(0, 24)}`;
    };
    const forkGroupLockKey = (groupId) => {
        const group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)));
        return group?.anchor ? forkAnchorLockKey(group.anchor) : `group:${safeId(groupId)}`;
    };
    const forkMutationLocks = new Map();
    async function withForkMutationLock(key, work) {
        const prior = forkMutationLocks.get(key) ?? Promise.resolve();
        let release;
        const gate = new Promise((resolveGate) => { release = resolveGate; });
        const queued = prior.catch(() => { }).then(() => gate);
        forkMutationLocks.set(key, queued);
        await prior.catch(() => { });
        try {
            return await work();
        }
        finally {
            release();
            if (forkMutationLocks.get(key) === queued)
                forkMutationLocks.delete(key);
        }
    }
    function visibleSeqSet(session) {
        const nodes = session?.surface?.nodes;
        return nodes && typeof nodes[Symbol.iterator] === 'function'
            ? new Set(Array.from(nodes, Number).filter(Number.isSafeInteger))
            : new Set();
    }
    function assistantMessageId(event) {
        const value = event?.data?.message?.id ?? event?.data?.messageId;
        return value === undefined || value === null ? '' : String(value);
    }
    function completedTurns(session) {
        return new Set(eventsOf(session)
            .filter(isCompletedTurnEnd)
            .map((event) => Number(event.data?.turn))
            .filter(Number.isSafeInteger));
    }
    function turnForEvent(session, event) {
        const limit = Number(event?.seq);
        if (!Number.isSafeInteger(limit))
            return null;
        for (let index = Math.min(limit, eventsOf(session).length - 1); index >= 0; index -= 1) {
            const candidate = eventsOf(session)[index];
            if (candidate?.type === 'turn/start' && Number.isSafeInteger(Number(candidate.data?.turn))) {
                return Number(candidate.data?.turn);
            }
        }
        return null;
    }
    function requestUserEvent(session, requestId) {
        if (typeof requestId !== 'string' || !requestId)
            return null;
        return [...surfaceEvents(session)].reverse().find((event) => event?.type === 'user/message' &&
            event.data?.source?.kind === 'user' &&
            String(event.data?.source?.rpcId ?? '') === requestId) ?? null;
    }
    function currentSurfaceUserBefore(session, assistantEvent) {
        const surface = surfaceEvents(session);
        const assistantIndex = surface.findIndex((event) => Number(event?.seq) === Number(assistantEvent?.seq));
        if (assistantIndex < 0)
            return null;
        for (let index = assistantIndex - 1; index >= 0; index -= 1) {
            const event = surface[index];
            if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user')
                continue;
            const text = textOf(event.data?.content).trim();
            if (text)
                return { event, text };
        }
        return null;
    }
    function hydrateForkGroup(value) {
        if (!value || typeof value !== 'object')
            return null;
        // Legacy records are repaired on this clone; retain unknown durable fields
        // and the runtime checks below even as the internal contracts become typed.
        const group = cloneBranchRecord(value);
        group.schemaVersion = 2;
        group.members = Array.isArray(group.members) ? group.members : [];
        group.playerVariants = group.playerVariants && typeof group.playerVariants === 'object' && !Array.isArray(group.playerVariants)
            ? group.playerVariants
            : {};
        const ordered = [...group.members].sort((a, b) => Number(a?.ordinal) - Number(b?.ordinal));
        let nextPlayerOrdinal = 1;
        let inheritedVariant = `${group.groupId}:player:1`;
        const ordinalByVariant = new Map();
        for (const [index, member] of ordered.entries()) {
            const startsNewPlayerVariant = index > 0 && (member.kind === 'edit' || member.kind === 'player-edit' || member.kind === 'player-edit-send');
            if (!member.playerVariantId) {
                if (startsNewPlayerVariant)
                    inheritedVariant = `${group.groupId}:player:${++nextPlayerOrdinal}`;
                member.playerVariantId = inheritedVariant;
            }
            if (!ordinalByVariant.has(member.playerVariantId)) {
                const preferred = Number(member.playerOrdinal);
                const ordinal = Number.isSafeInteger(preferred) && preferred > 0
                    ? preferred
                    : ordinalByVariant.size + 1;
                ordinalByVariant.set(member.playerVariantId, ordinal);
            }
            member.playerOrdinal = ordinalByVariant.get(member.playerVariantId);
            nextPlayerOrdinal = Math.max(nextPlayerOrdinal, Number(member.playerOrdinal) || 1);
            const variant = group.playerVariants[member.playerVariantId];
            if (!variant || typeof variant !== 'object') {
                group.playerVariants[member.playerVariantId] = {
                    text: String(member.promptText ?? group.anchor?.promptText ?? ''),
                    revision: Math.max(1, Number(member.playerTextRevision) || 1),
                    updatedAt: Number(member.editedAt ?? member.createdAt ?? group.updatedAt ?? Date.now()),
                };
            }
            member.playerTextRevision = Math.max(1, Number(member.playerTextRevision) || Number(group.playerVariants[member.playerVariantId]?.revision) || 1);
            if (member.playerAppliedRevision === undefined && member.userMessageId) {
                member.playerAppliedRevision = member.playerTextRevision;
            }
            if (!member.userMessageId && member.sessionId === group.rootSessionId) {
                member.userMessageId = String(group.anchor?.sourceUserMessageId ?? '') || null;
                member.userSeq = Number.isSafeInteger(Number(group.anchor?.sourceUserSeq))
                    ? Number(group.anchor.sourceUserSeq)
                    : null;
            }
        }
        group.members = ordered;
        return group;
    }
    function sessionLineageIds(session) {
        const ids = [];
        let current = session;
        for (let depth = 0; current && depth < 64; depth += 1) {
            ids.push(current.id);
            const parentId = current.header?.parentSession;
            if (!parentId)
                break;
            current = ctx.sessions.get(parentId);
        }
        return ids;
    }
    function buildForkLookupIndex(session) {
        const lineage = new Set(sessionLineageIds(session));
        const bySessionMessage = new Map();
        const groups = [];
        for (const [key, raw] of T.branch.entries()) {
            if (!String(key).startsWith('fork-group-'))
                continue;
            // Hydration clones all player variants. Unrelated conversations cannot
            // participate in this session's pointer recovery or failure navigation.
            if (!lineage.has(raw?.rootSessionId) && !lineage.has(raw?.anchor?.sourceSessionId) &&
                !(Array.isArray(raw?.members) && raw.members.some(member => lineage.has(member?.sessionId))))
                continue;
            const group = hydrateForkGroup(raw);
            if (!group)
                continue;
            groups.push(group);
            for (const member of group.members) {
                if (!member.deleted && member.sessionId && member.assistantMessageId) {
                    bySessionMessage.set(`${member.sessionId}\0${member.assistantMessageId}`, group.groupId);
                }
            }
        }
        return { bySessionMessage, groups };
    }
    function forkPointerFor(session, messageId, lookup = null) {
        const lineage = sessionLineageIds(session);
        for (const sessionId of lineage) {
            const pointer = T.branch.get(forkAnchorKey(sessionId, messageId));
            if (pointer?.groupId)
                return pointer;
        }
        if (lookup?.bySessionMessage instanceof Map) {
            for (const sessionId of lineage) {
                const groupId = lookup.bySessionMessage.get(`${sessionId}\0${messageId}`);
                if (groupId)
                    return { groupId, recovered: true };
            }
            return null;
        }
        // Recover an interrupted "group committed, child pointer not yet written"
        // transaction from the small navigation ledger. This also ensures every
        // descendant regeneration resolves the canonical root-anchor lock.
        for (const [key, raw] of T.branch.entries()) {
            if (!String(key).startsWith('fork-group-'))
                continue;
            if (Array.isArray(raw?.members) && raw.members.some((member) => !member.deleted && lineage.includes(member.sessionId) && member.assistantMessageId === messageId)) {
                return { groupId: raw.groupId, recovered: true };
            }
        }
        return null;
    }
    function groupMemberForSession(group, session, messageId, { includeDeleted = false } = {}) {
        for (const sessionId of sessionLineageIds(session)) {
            const member = group?.members?.find((item) => (includeDeleted || !item.deleted) && item.sessionId === sessionId && item.assistantMessageId === messageId);
            if (member)
                return member;
        }
        return null;
    }
    function locateForkTarget(session, requestedMessageId) {
        const events = eventsOf(session);
        const wanted = String(requestedMessageId ?? '');
        const currentAssistant = [...surfaceEvents(session)].reverse().find((event) => event?.type === 'assistant/message' && assistantMessageId(event) === wanted);
        let assistantIndex = currentAssistant ? Number(currentAssistant.seq) : -1;
        if (assistantIndex < 0) {
            for (let index = events.length - 1; index >= 0; index -= 1) {
                const event = events[index];
                if (event?.type === 'assistant/message' && assistantMessageId(event) === wanted) {
                    assistantIndex = index;
                    break;
                }
            }
        }
        if (assistantIndex < 0)
            throw new Error('目标回复不存在或尚未落盘');
        if (internalTaskSeqs(session).has(assistantIndex))
            throw Object.assign(new Error('该消息属于系统维护，请从对应剧情正文重新生成'), { code: 'ROLEPLAY_NOT_STORY' });
        const assistant = events[assistantIndex];
        // 正常回复的玩家输入与 assistant 在同一 turn；兼容旧版 /regenerate
        // 产生的“仅插件 steering、没有玩家消息”的伪分支：向前回溯最近一次真实
        // 玩家输入，并从那一轮之前重新建立原生分支。
        let currentTurn = null;
        const userCandidates = [];
        for (let index = 0; index <= assistantIndex; index += 1) {
            const event = events[index];
            if (event?.type === 'turn/start')
                currentTurn = Number(event.data?.turn);
            if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user')
                continue;
            const text = textOf(event.data?.content).trim();
            if (!text)
                continue;
            userCandidates.push({ event, text, turn: currentTurn, index });
        }
        const assistantTurn = Number(assistant.data?.turn);
        const surfaceUser = currentSurfaceUserBefore(session, assistant);
        const user = surfaceUser
            ? {
                event: surfaceUser.event,
                text: surfaceUser.text,
                turn: assistantTurn,
                index: Number(surfaceUser.event.seq),
            }
            : [...userCandidates].reverse().find((entry) => Number(entry.turn) === assistantTurn)
                ?? userCandidates.at(-1);
        if (!user)
            throw new Error('目标回复之前找不到真实玩家消息，无法安全重建分支');
        let turnStartIndex = -1;
        for (let index = Math.min(user.index, events.length - 1); index >= 0; index -= 1) {
            if (events[index]?.type === 'turn/start' && Number(events[index]?.data?.turn) === Number(user.turn)) {
                turnStartIndex = index;
                break;
            }
        }
        let previousTurnEndSeq = null;
        for (let index = turnStartIndex - 1; index >= 0; index -= 1) {
            if (events[index]?.type === 'turn/end') {
                previousTurnEndSeq = Number(events[index].seq);
                break;
            }
        }
        return {
            sourceSessionId: session.id,
            sourceAssistantMessageId: wanted,
            sourceAssistantSeq: Number(assistant.seq),
            sourceAssistantTurn: assistantTurn,
            sourceUserMessageId: String(user.event.data?.id ?? ''),
            sourceUserSeq: Number(user.event.seq),
            sourceTurn: Number(user.turn),
            previousTurnEndSeq,
            // Native fork includes inter-turn metadata through (but not including)
            // the next turn/start, not only the turn/end event itself.
            expectedSeedLength: previousTurnEndSeq === null ? 0 : (() => {
                let cut = previousTurnEndSeq + 1;
                while (cut < events.length && events[cut]?.type !== 'turn/start')
                    cut += 1;
                return cut;
            })(),
            promptText: user.text,
        };
    }
    async function copyStaticBranchConfig(sourceId, childId) {
        const sourcePrefix = `${sourceId}__`;
        const childPrefix = `${childId}__`;
        for (const table of [T.cards, T.worldbook, T.rules, T.opening]) {
            for (const [key, value] of table.entries()) {
                if (key.startsWith(sourcePrefix) && value) {
                    await table.put(childPrefix + key.slice(sourcePrefix.length), cloneBranchRecord(value));
                }
            }
        }
        const settings = T.branch.get(keyOf(sourceId, 'settings'));
        if (settings)
            await T.branch.put(keyOf(childId, 'settings'), cloneBranchRecord(settings));
        const statusSpec = T.status.get(keyOf(sourceId, 'spec'));
        if (statusSpec)
            await T.status.put(keyOf(childId, 'spec'), cloneBranchRecord(statusSpec));
        const activeImport = T.branch.get(importActiveKey(sourceId));
        if (activeImport) {
            await T.branch.put(importActiveKey(childId), {
                ...cloneBranchRecord(activeImport),
                inheritedFrom: sourceId,
                sourceRecordSessionId: activeImport.sourceRecordSessionId ?? sourceId,
            });
        }
    }
    async function bootstrapChildBranch(operation, child) {
        const source = await resolveRoleplaySession(operation.anchor.sourceSessionId);
        if (!source || !child || !isRoleplaySession(child)) {
            throw new Error('源会话或新分支不是可用的角色扮演会话');
        }
        if (child.id === source.id)
            throw new Error('新分支不能复用源会话');
        const isNativeFork = child.header?.parentSession === source.id;
        const isFreshFirstTurn = !child.header?.parentSession && operation.anchor.previousTurnEndSeq === null;
        if (!isNativeFork && !isFreshFirstTurn)
            throw new Error('新会话与分支锚点不匹配');
        if (isNativeFork) {
            const expectedSeedLength = Number(operation.anchor.expectedSeedLength ?? (Number(operation.anchor.previousTurnEndSeq) + 1));
            const actualSeedLength = Number(child.header?.seedLength);
            if (!Number.isSafeInteger(expectedSeedLength) || !Number.isSafeInteger(actualSeedLength)
                || actualSeedLength !== expectedSeedLength) {
                throw new Error('新分支的 seed 边界与操作锚点不一致');
            }
        }
        if (isFreshFirstTurn) {
            const setupOnly = new Set([
                'session/end-seed', 'session/title', 'model/selection', 'agent-preset/selected',
                'permission/preset', 'sandbox/mode', 'approval/policy',
            ]);
            if (eventsOf(child).some((event) => !setupOnly.has(event?.type)) || (child.surface?.nodes?.length ?? 0) > 0) {
                throw new Error('首轮分支必须从空白会话创建');
            }
            const existingMembership = [...T.branch.entries()].some(([key, value]) => {
                if (key === forkOperationKey(operation.operationId))
                    return false;
                return value && typeof value === 'object' && (value.childSessionId === child.id ||
                    value.sessionId === child.id ||
                    value.members?.some?.((member) => member?.sessionId === child.id));
            });
            if (existingMembership)
                throw new Error('首轮分支会话已经绑定其他分支操作');
            await copyStaticBranchConfig(source.id, child.id);
            await T.branch.put(keyOf(child.id, 'meta'), {
                createdAt: Date.now(), lastTurn: 0, lastSeq: -1,
                freshBranchFrom: source.id, inheritedAtSeedLength: 0,
            });
            ensureState(child.id).branchReady = true;
        }
        else {
            await ensureBranch(child, { cadenceAnchorSeq: operation.anchor.sourceUserSeq, cadenceTurn: operation.anchor.sourceTurn });
        }
        return source;
    }
    async function registerNativeFork(operation, child, lockAttempt = 0) {
        const messageId = operation.anchor.sourceAssistantMessageId;
        const sourceHint = await resolveRoleplaySession(operation.anchor.sourceSessionId);
        const pointerHint = sourceHint ? forkPointerFor(sourceHint, messageId) : null;
        const groupHint = pointerHint?.groupId
            ? hydrateForkGroup(T.branch.get(forkGroupKey(pointerHint.groupId)))
            : null;
        // Once a reply belongs to a group, every descendant's messageId must use
        // the original group's anchor lock. Two simultaneous regenerations from
        // different child Sessions otherwise hold different locks and overwrite
        // the same member array.
        const lockKey = groupHint?.anchor
            ? forkAnchorLockKey(groupHint.anchor)
            : forkAnchorLockKey(operation.anchor);
        let retryWithCanonicalLock = false;
        const result = await withForkMutationLock(lockKey, async () => {
            const liveOperation = cloneBranchRecord(T.branch.get(forkOperationKey(operation.operationId)));
            if (liveOperation?.abortedAt || liveOperation?.state === 'aborted') {
                throw new Error('分支操作已被客户端撤销');
            }
            const source = await resolveRoleplaySession(operation.anchor.sourceSessionId);
            if (!source)
                throw new Error('源角色扮演会话不存在或无法恢复');
            const livePointer = forkPointerFor(source, messageId);
            const deterministicGroupId = `g-${sha256(`${source.id}\0${messageId}`).slice(0, 32)}`;
            let groupId = livePointer?.groupId ?? deterministicGroupId;
            let group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)));
            const canonicalLockKey = group?.anchor ? forkAnchorLockKey(group.anchor) : lockKey;
            if (canonicalLockKey !== lockKey) {
                retryWithCanonicalLock = true;
                return null;
            }
            await bootstrapChildBranch(operation, child);
            if (!group) {
                group = {
                    schemaVersion: 2,
                    groupId,
                    rootSessionId: source.id,
                    anchor: operation.anchor,
                    members: [{
                            sessionId: source.id,
                            ordinal: 1,
                            kind: 'original',
                            promptText: operation.anchor.promptText,
                            userMessageId: operation.anchor.sourceUserMessageId,
                            userSeq: operation.anchor.sourceUserSeq,
                            playerVariantId: `${groupId}:player:1`,
                            playerOrdinal: 1,
                            assistantMessageId: messageId,
                            assistantSeq: operation.anchor.sourceAssistantSeq,
                            createdAt: Date.now(),
                            deleted: false,
                            pending: false,
                        }],
                    playerVariants: {
                        [`${groupId}:player:1`]: {
                            text: operation.anchor.promptText,
                            revision: 1,
                            updatedAt: Date.now(),
                        },
                    },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
                // Group first, pointer second: an interrupted write can leave only a
                // deterministic orphan, which the same operation safely reuses.
                await T.branch.put(forkGroupKey(groupId), group);
            }
            // Recover the deterministic anchor pointer if a previous crash persisted
            // the group but stopped before the second write.  This is deliberately
            // idempotent and stays inside the same anchor lock.
            const anchorKey = forkAnchorKey(source.id, messageId);
            const anchorPointer = T.branch.get(anchorKey);
            if (anchorPointer?.groupId !== groupId)
                await T.branch.put(anchorKey, { groupId });
            const existing = group.members.find((member) => member.operationId === operation.operationId);
            if (existing) {
                if (existing.sessionId !== child.id || String(existing.requestId ?? '') !== String(operation.requestId ?? '')) {
                    throw new Error('同一分支操作已登记到不同的会话或请求');
                }
                if (existing.pending) {
                    await T.branch.put(forkPendingKey(child.id, group.groupId), {
                        groupId: group.groupId,
                        ordinal: existing.ordinal,
                        operationId: operation.operationId,
                        requestId: operation.requestId,
                        createdAt: existing.createdAt,
                    });
                }
                const active = group.members.filter((member) => !member.deleted);
                return {
                    groupId: group.groupId,
                    ordinal: existing.ordinal,
                    total: active.length,
                    playerOrdinal: existing.playerOrdinal,
                    playerTotal: new Set(active.map((member) => member.playerVariantId)).size,
                };
            }
            const sourceMember = groupMemberForSession(group, source, messageId);
            const exactSourceMember = group.members.find((member) => member.sessionId === source.id && member.assistantMessageId === messageId);
            if (exactSourceMember?.deleted)
                throw new Error('当前回复版本已删除，不能从旧页面继续创建分支');
            if (!sourceMember)
                throw new Error('当前回复不属于这个分支组的活动版本，请刷新后重试');
            const ordinal = Math.max(0, ...group.members.map((member) => Number(member.ordinal) || 0)) + 1;
            const playerVariants = new Set(group.members.filter((member) => !member.deleted).map((member) => member.playerVariantId));
            const createsPlayerVariant = operation.kind === 'player-edit' || operation.kind === 'player-edit-send' || operation.kind === 'edit';
            const playerOrdinal = createsPlayerVariant
                ? Math.max(0, ...group.members.map((member) => Number(member.playerOrdinal) || 0)) + 1
                : Number(sourceMember?.playerOrdinal) || 1;
            const playerVariantId = createsPlayerVariant
                ? `${group.groupId}:player:${randomUUID()}`
                : String(sourceMember?.playerVariantId ?? `${group.groupId}:player:1`);
            if (createsPlayerVariant) {
                group.playerVariants[playerVariantId] = {
                    text: operation.promptText,
                    revision: 1,
                    updatedAt: Date.now(),
                };
            }
            else {
                const canonical = group.playerVariants[playerVariantId];
                if (canonical && String(canonical.text ?? '') !== String(operation.promptText ?? '')) {
                    throw new Error('玩家消息已在其他分支修改，请刷新后重新生成');
                }
            }
            const member = {
                operationId: operation.operationId,
                requestId: operation.requestId,
                sessionId: child.id,
                ordinal,
                kind: operation.kind,
                promptText: operation.promptText,
                userMessageId: null,
                userSeq: null,
                playerVariantId,
                playerOrdinal,
                playerTextRevision: Number(group.playerVariants[playerVariantId]?.revision) || 1,
                playerAppliedRevision: 0,
                assistantMessageId: null,
                assistantSeq: null,
                createdAt: Date.now(),
                deleted: false,
                pending: true,
            };
            group.members.push(member);
            group.updatedAt = Date.now();
            await T.branch.put(forkGroupKey(group.groupId), group);
            await T.branch.put(forkPendingKey(child.id, group.groupId), {
                groupId: group.groupId,
                ordinal,
                operationId: operation.operationId,
                requestId: operation.requestId,
                createdAt: member.createdAt,
            });
            return {
                groupId: group.groupId,
                ordinal,
                total: group.members.filter((candidate) => !candidate.deleted).length,
                playerOrdinal,
                playerTotal: playerVariants.size + (createsPlayerVariant ? 1 : 0),
            };
        });
        if (retryWithCanonicalLock) {
            if (lockAttempt >= 4)
                throw new Error('分支组在并发登记期间持续变化，请重试');
            return registerNativeFork(operation, child, lockAttempt + 1);
        }
        return result;
    }
    function failedForkMembership(session, userEvent, lookup = buildForkLookupIndex(session)) {
        const requestId = String(userEvent?.data?.source?.rpcId ?? '');
        const matches = lookup.groups.flatMap(group => group.members.filter(member => member.sessionId === session.id)
            .map(member => ({ group, member })));
        const exact = matches.filter(({ member }) => (requestId && member.requestId === requestId) ||
            (userEvent?.data?.id && member.userMessageId === userEvent.data.id));
        if (exact.length === 1)
            return exact[0];
        // Some old forks used a different transport ID when submitting the first
        // post-seed input. Their explicit child membership is still authoritative
        // for navigation, but never binds an arbitrary later reply to that fork.
        const seed = durableSeq(session.header?.seedLength);
        if (!session.header?.parentSession || seed === null)
            return null;
        const first = surfaceEvents(session).find(event => event.seq >= seed && event.type === 'user/message' && event.data?.source?.kind === 'user');
        if (first?.seq !== userEvent?.seq)
            return null;
        const unresolved = matches.filter(({ member }) => !member.assistantMessageId && (member.pending || member.failed) &&
            (!member.deleted || member.failed && member.failureReason !== '客户端放弃等待'));
        return unresolved.length === 1 ? unresolved[0] : null;
    }
    function isRecoverySourceMember(member, anchor, userEvent) {
        if (!member || member.sessionId !== anchor?.sourceSessionId)
            return false;
        if (Number.isSafeInteger(Number(anchor?.sourceUserSeq)) && Number(member.userSeq) === Number(anchor.sourceUserSeq))
            return true;
        if (anchor?.sourceUserMessageId && String(member.userMessageId ?? '') === String(anchor.sourceUserMessageId))
            return true;
        const requestId = String(userEvent?.data?.source?.rpcId ?? '');
        return Boolean(requestId && String(member.requestId ?? '') === requestId);
    }
    async function backfillRecoverySourceMember(anchor) {
        const source = await resolveRoleplaySession(anchor?.sourceSessionId);
        if (!source)
            return false;
        let recovery;
        try {
            recovery = locatePlayerRecoveryTarget(source, anchor.sourceUserSeq);
        }
        catch {
            return false;
        }
        if (!recovery
            || recovery.sourceSessionId !== anchor.sourceSessionId
            || Number(recovery.sourceUserSeq) !== Number(anchor.sourceUserSeq)
            || String(recovery.sourceUserMessageId ?? '') !== String(anchor.sourceUserMessageId ?? '')
            || String(recovery.promptText ?? '') !== String(anchor.promptText ?? ''))
            return false;
        const candidates = [...T.branch.entries()]
            .filter(([key, value]) => String(key).startsWith('fork-group-')
            && value?.anchor?.recoveryOnly === true
            && value.anchor.sourceSessionId === anchor.sourceSessionId
            && Number(value.anchor.sourceUserSeq) === Number(anchor.sourceUserSeq))
            .map(([, value]) => hydrateForkGroup(value)).filter(value => value !== null);
        if (candidates.length !== 1)
            return false;
        const groupId = candidates[0].groupId;
        return withForkMutationLock(forkGroupLockKey(groupId), async () => {
            const group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)));
            const userEvent = userForkContext(source, anchor.sourceUserSeq).event;
            if (!group || group.members.some(member => isRecoverySourceMember(member, anchor, userEvent)))
                return false;
            const sameText = Object.entries(group.playerVariants)
                .find(([, variant]) => String(variant?.text ?? '') === String(recovery.promptText ?? ''));
            const playerVariantId = sameText?.[0] ?? `${groupId}:player:recovery-original`;
            if (!sameText)
                group.playerVariants[playerVariantId] = { text: recovery.promptText, revision: 1, updatedAt: Date.now() };
            const playerOrdinal = sameText
                ? Math.max(1, ...group.members
                    .filter(member => member.playerVariantId === playerVariantId)
                    .map(member => Number(member.playerOrdinal) || 1))
                : Math.max(0, ...group.members.map(member => Number(member.playerOrdinal) || 0)) + 1;
            group.members.push({
                sessionId: anchor.sourceSessionId, ordinal: 0, kind: 'original', promptText: recovery.promptText,
                userMessageId: anchor.sourceUserMessageId, userSeq: anchor.sourceUserSeq,
                playerVariantId, playerOrdinal, playerTextRevision: 1, playerAppliedRevision: 1,
                assistantMessageId: null, assistantSeq: null, createdAt: Date.now(),
                deleted: false, pending: false, failed: true, failureReason: '原始失败轮次',
            });
            group.updatedAt = Date.now();
            await T.branch.put(forkGroupKey(groupId), group);
            return true;
        });
    }
    // Recovery navigation includes failed source anchors without assistant text.
    // Keep initial registration and idempotent retry counts on the same rule.
    function recoveryRegistrationResult(group, ordinal, playerOrdinal) {
        const activeMembers = group.members.filter(member => !member.deleted);
        return {
            groupId: group.groupId,
            ordinal,
            total: activeMembers.length,
            playerOrdinal,
            playerTotal: new Set(activeMembers.map(member => member.playerVariantId)).size,
        };
    }
    async function registerRecoveryFork(operation, child) {
        const anchor = operation.anchor;
        const source = await resolveRoleplaySession(anchor.sourceSessionId);
        let recovery = null;
        if (source) {
            try {
                const current = locatePlayerRecoveryTarget(source, anchor.sourceUserSeq);
                if (current
                    && current.sourceSessionId === anchor.sourceSessionId
                    && Number(current.sourceUserSeq) === Number(anchor.sourceUserSeq)
                    && String(current.sourceUserMessageId ?? '') === String(anchor.sourceUserMessageId ?? '')
                    && String(current.promptText ?? '') === String(anchor.promptText ?? ''))
                    recovery = current;
            }
            catch { }
        }
        if (!source || !recovery)
            throw new Error('原始失败轮次已变更、删除或仍在运行，不能登记恢复分支');
        const sourceEvent = userForkContext(source, anchor.sourceUserSeq).event;
        const membership = source && recovery
            ? failedForkMembership(source, sourceEvent) : null;
        const lockKey = membership
            ? forkGroupLockKey(membership.group.groupId)
            : `recovery:${anchor.sourceSessionId}:${Number(anchor.sourceUserSeq)}`;
        return withForkMutationLock(lockKey, async () => {
            await bootstrapChildBranch(operation, child);
            const groupId = membership?.group.groupId ?? `g-recovery-${sha256(`${anchor.sourceSessionId}\0${anchor.sourceUserSeq}`).slice(0, 32)}`;
            let group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)));
            const originalMember = (ordinal, playerVariantId, playerOrdinal) => ({
                sessionId: anchor.sourceSessionId,
                ordinal,
                kind: 'original',
                promptText: recovery.promptText,
                userMessageId: anchor.sourceUserMessageId,
                userSeq: anchor.sourceUserSeq,
                playerVariantId,
                playerOrdinal,
                playerTextRevision: 1,
                playerAppliedRevision: 1,
                assistantMessageId: null,
                assistantSeq: null,
                createdAt: Date.now(),
                deleted: false,
                pending: false,
                failed: true,
                failureReason: '原始失败轮次',
            });
            if (!group) {
                const playerVariantId = `${groupId}:player:1`;
                group = {
                    schemaVersion: 2,
                    groupId,
                    rootSessionId: anchor.sourceSessionId,
                    anchor,
                    members: [originalMember(1, playerVariantId, 1)],
                    playerVariants: { [playerVariantId]: { text: recovery.promptText, revision: 1, updatedAt: Date.now() } },
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                };
            }
            // Older recovery groups recorded only the replay child.  Add the source
            // only when the selected failure is still proven on its live surface;
            // ordinal zero places it before legacy entries without renumbering them.
            // `membership` is also proof that the current source is already a
            // member, even if an old record lost its request identity.  Do not add
            // a second ordinal-zero copy merely because it is not kind "original".
            const hasSource = Boolean(membership?.member) || group.members.some(member => isRecoverySourceMember(member, anchor, sourceEvent));
            if (!hasSource && recovery) {
                const sameText = Object.entries(group.playerVariants)
                    .find(([, variant]) => String(variant?.text ?? '') === String(recovery.promptText ?? ''));
                const playerVariantId = `${groupId}:player:recovery-original`;
                const originalVariantId = sameText?.[0] ?? playerVariantId;
                if (!sameText)
                    group.playerVariants[originalVariantId] = { text: recovery.promptText, revision: 1, updatedAt: Date.now() };
                const originalPlayerOrdinal = sameText
                    ? Math.max(1, ...group.members
                        .filter(member => member.playerVariantId === originalVariantId)
                        .map(member => Number(member.playerOrdinal) || 1))
                    : Math.max(0, ...group.members.map(member => Number(member.playerOrdinal) || 0)) + 1;
                group.members.push(originalMember(0, originalVariantId, originalPlayerOrdinal));
            }
            const existing = group.members.find((member) => member.operationId === operation.operationId);
            if (existing) {
                if (!existing.deleted && recovery) {
                    group.updatedAt = Date.now();
                    await T.branch.put(forkGroupKey(groupId), group);
                }
                return recoveryRegistrationResult(group, existing.ordinal, existing.playerOrdinal);
            }
            const ordinal = Math.max(0, ...group.members.map((member) => Number(member.ordinal) || 0)) + 1;
            const previousMember = membership
                ? group.members.find(member => member.sessionId === source.id && member.ordinal === membership.member.ordinal)
                : null;
            if (previousMember?.failed && !previousMember.assistantMessageId)
                previousMember.deleted = false;
            const createsPlayerVariant = operation.kind === 'player-edit' || operation.kind === 'player-edit-send' || operation.kind === 'edit';
            const original = group.members.find(member => isRecoverySourceMember(member, anchor, sourceEvent));
            const basePlayerVariantId = previousMember?.playerVariantId ?? original?.playerVariantId
                ?? Object.keys(group.playerVariants)[0] ?? `${groupId}:player:1`;
            const playerVariantId = createsPlayerVariant ? `${groupId}:player:${randomUUID()}` : basePlayerVariantId;
            const playerOrdinal = createsPlayerVariant
                ? Math.max(0, ...group.members.map(member => Number(member.playerOrdinal) || 0)) + 1
                : Number(previousMember?.playerOrdinal ?? original?.playerOrdinal) || 1;
            if (createsPlayerVariant) {
                group.playerVariants[playerVariantId] = { text: operation.promptText, revision: 1, updatedAt: Date.now() };
            }
            else if (String(group.playerVariants[playerVariantId]?.text ?? '') !== String(operation.promptText ?? '')) {
                // Schema-v1 members can have neither promptText nor a stored player
                // variant.  The live, verified recovery source is then the only
                // evidence available to repair that empty slot.
                const legacyEmptyVariant = previousMember
                    && !String(previousMember.promptText ?? '').trim()
                    && !String(group.playerVariants[playerVariantId]?.text ?? '').trim();
                if (legacyEmptyVariant) {
                    group.playerVariants[playerVariantId] = { text: operation.promptText, revision: 1, updatedAt: Date.now() };
                }
                else {
                    throw new Error('原始玩家消息已在其他分支修改，请刷新后重新生成');
                }
            }
            group.members.push({
                operationId: operation.operationId,
                requestId: operation.requestId,
                sessionId: child.id,
                ordinal,
                kind: operation.kind,
                promptText: operation.promptText,
                userMessageId: null,
                userSeq: null,
                playerVariantId,
                playerOrdinal,
                playerTextRevision: 1,
                playerAppliedRevision: 0,
                assistantMessageId: null,
                assistantSeq: null,
                createdAt: Date.now(),
                deleted: false,
                pending: true,
            });
            group.updatedAt = Date.now();
            await T.branch.put(forkGroupKey(groupId), group);
            await T.branch.put(forkPendingKey(child.id, groupId), {
                groupId, ordinal, operationId: operation.operationId,
                requestId: operation.requestId, createdAt: Date.now(),
            });
            return recoveryRegistrationResult(group, ordinal, playerOrdinal);
        });
    }
    async function reconcileNativeFork(session, completedAssistant = null) {
        const prefix = `${session.id}__fork-pending-`;
        const pendingEntries = [...T.branch.entries()].filter(([key, value]) => key.startsWith(prefix) && value);
        if (!pendingEntries.length)
            return;
        for (const [pendingKey, pending] of pendingEntries) {
            const requestId = String(pending?.requestId ?? '');
            const userEvent = requestUserEvent(session, requestId);
            const turn = userEvent ? turnForEvent(session, userEvent) : null;
            const candidate = completedAssistant && Number(completedAssistant.data?.turn) === Number(turn)
                ? completedAssistant
                : turn === null ? null : completedAssistantReceiptForTurn(session, turn);
            const messageId = assistantMessageId(candidate);
            const userBeforeAssistant = userEvent && candidate && Number(userEvent.seq) < Number(candidate.seq);
            if (requestId && userBeforeAssistant && messageId) {
                await withForkMutationLock(forkGroupLockKey(pending.groupId), async () => {
                    const group = hydrateForkGroup(T.branch.get(forkGroupKey(pending.groupId)));
                    const member = group?.members?.find((item) => item.sessionId === session.id &&
                        Number(item.ordinal) === Number(pending.ordinal) &&
                        item.operationId === pending.operationId &&
                        String(item.requestId ?? '') === requestId);
                    if (!group || !member)
                        return;
                    if (member.deleted) {
                        await T.branch.delete(pendingKey);
                        return;
                    }
                    if (member.pending) {
                        member.assistantMessageId = messageId;
                        member.assistantSeq = Number(candidate.seq);
                        member.userMessageId = String(userEvent.data?.id ?? '');
                        member.userSeq = Number(userEvent.seq);
                        member.playerAppliedRevision = Number(member.playerTextRevision) || 1;
                        member.pending = false;
                        member.completedAt = Date.now();
                        group.updatedAt = Date.now();
                        await T.branch.put(forkGroupKey(group.groupId), group);
                    }
                    // Crash recovery: group.put may have succeeded while the pointer and
                    // pending cleanup did not. Replaying those tail writes is idempotent.
                    const settledMessageId = String(member.assistantMessageId ?? messageId);
                    if (settledMessageId) {
                        await T.branch.put(forkAnchorKey(session.id, settledMessageId), { groupId: group.groupId });
                    }
                    await T.branch.delete(pendingKey);
                });
                continue;
            }
            // Pre-requestId pending records cannot be safely recovered after a
            // restart: a later ordinary turn must never be mistaken for this fork.
            if (!requestId) {
                await withForkMutationLock(forkGroupLockKey(pending.groupId), async () => {
                    const group = hydrateForkGroup(T.branch.get(forkGroupKey(pending.groupId)));
                    const member = group?.members?.find((item) => item.sessionId === session.id && Number(item.ordinal) === Number(pending.ordinal));
                    if (group && member?.pending) {
                        member.pending = false;
                        member.deleted = true;
                        member.failed = true;
                        member.failureReason = '旧版待处理分支缺少 requestId，已拒绝猜测绑定';
                        member.deletedAt = Date.now();
                        group.updatedAt = Date.now();
                        await T.branch.put(forkGroupKey(group.groupId), group);
                    }
                    await T.branch.delete(pendingKey);
                });
            }
        }
    }
    async function failPendingNativeFork(session, reason) {
        const prefix = `${session.id}__fork-pending-`;
        const pendingEntries = [...T.branch.entries()].filter(([key, value]) => key.startsWith(prefix) && value);
        for (const [pendingKey, pending] of pendingEntries) {
            await withForkMutationLock(forkGroupLockKey(pending.groupId), async () => {
                const group = hydrateForkGroup(T.branch.get(forkGroupKey(pending.groupId)));
                const member = group?.members?.find((item) => item.sessionId === session.id && Number(item.ordinal) === Number(pending.ordinal));
                if (group && member && member.pending) {
                    member.pending = false;
                    member.failed = true;
                    // A provider failure is a recoverable worldline, not user deletion.
                    member.deleted = false;
                    member.failureReason = String(reason ?? '生成未完成').slice(0, 500);
                    member.failedAt = Date.now();
                    group.updatedAt = Date.now();
                    await T.branch.put(forkGroupKey(group.groupId), group);
                }
                await T.branch.delete(pendingKey);
            });
        }
    }
    async function nativeBranchGroupsFor(session, lookup = null) {
        await reconcileNativeFork(session);
        // A recovered pending member can change navigation; rebuild its lookup.
        lookup = buildForkLookupIndex(session);
        const result = {};
        for (const event of surfaceEvents(session)) {
            if (event?.type !== 'assistant/message')
                continue;
            const messageId = assistantMessageId(event);
            if (!messageId)
                continue;
            const pointer = forkPointerFor(session, messageId, lookup);
            const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            if (!group)
                continue;
            const current = groupMemberForSession(group, session, messageId);
            if (!current)
                continue;
            // Assistant paging belongs to the currently selected player wording.
            // The durable group retains every player variant for navigation, while
            // this projection exposes only sibling replies to that exact variant.
            const members = group.members.filter((member) => !member.deleted &&
                member.playerVariantId === current.playerVariantId);
            result[messageId] = {
                groupId: group.groupId,
                currentOrdinal: members.findIndex((member) => member === current) + 1,
                total: members.length,
                members: members.map((member, index) => ({
                    sessionId: member.sessionId,
                    ordinal: index + 1,
                    sourceOrdinal: member.ordinal,
                    kind: member.kind,
                    pending: member.pending === true,
                })),
            };
        }
        return result;
    }
    function deletedBranchMessageIdsFor(session, lookup = null) {
        const deleted = [];
        for (const event of surfaceEvents(session)) {
            if (event?.type !== 'assistant/message')
                continue;
            const messageId = assistantMessageId(event);
            const pointer = forkPointerFor(session, messageId, lookup);
            const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            const member = group?.members?.find((item) => item.sessionId === session.id && item.assistantMessageId === messageId);
            const lineageMember = groupMemberForSession(group, session, messageId, { includeDeleted: true });
            if (member?.deleted || (!member && lineageMember?.deleted))
                deleted.push(messageId);
        }
        return deleted;
    }
    // Native branch deletion is a navigation tombstone, not a surface rewrite.
    // Worker fences must consult that durable state as well as plot seq/hash.
    function storyBranchIsActive(session) {
        return deletedBranchMessageIdsFor(session).length === 0;
    }
    function assertStoryBranchActive(session) {
        if (storyBranchIsActive(session))
            return;
        const error = Object.assign(new Error('当前剧情分支已删除；请切换到仍然活动的分支'), { code: 'ROLEPLAY_SOURCE_CHANGED' });
        throw error;
    }
    function inheritedAssistantMessageIdsFor(session, lookup = null) {
        const inherited = [];
        for (const event of surfaceEvents(session)) {
            if (event?.type !== 'assistant/message')
                continue;
            const messageId = assistantMessageId(event);
            const pointer = forkPointerFor(session, messageId, lookup);
            const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            if (!group)
                continue;
            const exact = group.members.find((member) => member.sessionId === session.id && member.assistantMessageId === messageId);
            const ancestor = groupMemberForSession(group, session, messageId);
            if (!exact && ancestor)
                inherited.push(messageId);
        }
        return inherited;
    }
    const { nativePlayerGroupsFor, replaceAssistantText, reconcileCanonicalPlayerVariants, userForkContext, locatePlayerRecoveryTarget, replaceUserText, } = createWorldlineSurface(deps, {
        forkGroupKey, forkAnchorKey, forkAnchorLockKey, withForkMutationLock,
        hydrateForkGroup, forkPointerFor, groupMemberForSession,
        assistantMessageId, currentSurfaceUserBefore, turnForEvent,
    });
    return {
        storyBranchIsActive,
        assertStoryBranchActive,
        reconcileCanonicalPlayerVariants,
        buildForkLookupIndex,
        reconcileNativeFork,
        failPendingNativeFork,
        nativeBranchGroupsFor,
        nativePlayerGroupsFor,
        assistantMessageId,
        userForkContext,
        locatePlayerRecoveryTarget,
        failedForkMembership,
        isRecoverySourceMember,
        backfillRecoverySourceMember,
        deletedBranchMessageIdsFor,
        inheritedAssistantMessageIdsFor,
        withForkMutationLock,
        forkOperationKey,
        forkPointerFor,
        hydrateForkGroup,
        forkGroupKey,
        groupMemberForSession,
        locateForkTarget,
        bootstrapChildBranch,
        registerRecoveryFork,
        registerNativeFork,
        forkAnchorLockKey,
        requestUserEvent,
        forkPendingKey,
        replaceAssistantText,
        replaceUserText,
    };
}
