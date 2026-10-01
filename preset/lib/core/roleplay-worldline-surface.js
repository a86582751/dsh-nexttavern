// Generated from runtime/alpha3/src/core/roleplay-worldline-surface.ts; edit the TypeScript source.
import { projectStoryEvent } from './roleplay-message-view.js';
export function assertBranchSession(session) {
    if (!('append' in session) || typeof session.append !== 'function')
        throw new Error('会话暂不可写入分支历史');
}
// Append-only message revisions, projection repair and derived-state
// invalidation form one operation; callers keep using roleplay-worldlines.
export function createWorldlineSurface(deps, forks) {
    const { ctx, messageEdits, flushEdits, safeId, keyOf, sha256, T, eventsOf, surfaceEvents, textOf, cloneBranchRecord, internalTaskSeqs, isRoleplaySession, durableSeq, canonicalAssistantForTurn, surfaceEntries, withDecisionMutationLock, normalizeDecisionRecord, cloneRecord, provenanceSeq, } = deps;
    const { forkGroupKey, forkAnchorKey, forkAnchorLockKey, withForkMutationLock, hydrateForkGroup, forkPointerFor, groupMemberForSession, assistantMessageId, currentSurfaceUserBefore, turnForEvent, } = forks;
    const editInvalidationKey = (sessionId, role, targetSeq) => keyOf(sessionId, `edit-applied-${role}-${safeId(targetSeq)}`);
    const playerProjectionKey = (sessionId, groupId, playerVariantId) => keyOf(sessionId, `player-projection-${sha256(`${groupId}\0${playerVariantId}`).slice(0, 32)}`);
    async function nativePlayerGroupsFor(session, assistantGroups) {
        const result = {};
        const entries = surfaceEntries(session);
        const publish = (user, value) => {
            result[String(user.seq)] = value;
        };
        for (let index = 0; index < entries.length; index += 1) {
            const user = entries[index];
            if (user.kind !== 'user')
                continue;
            let assistant = null;
            for (let next = index + 1; next < entries.length; next += 1) {
                if (entries[next].kind === 'user')
                    break;
                if (entries[next].kind === 'assistant')
                    assistant = entries[next];
            }
            const assistantGroup = assistant?.messageId ? assistantGroups[assistant.messageId] : null;
            if (!assistant?.messageId || !assistantGroup) {
                publish(user, {
                    userMessageId: user.messageId,
                    assistantMessageId: assistant?.messageId ?? null,
                    group: null,
                });
                continue;
            }
            const stored = hydrateForkGroup(T.branch.get(forkGroupKey(assistantGroup.groupId)));
            const active = stored?.members?.filter((member) => !member.deleted) ?? [];
            const current = groupMemberForSession(stored, session, assistant.messageId);
            if (!stored || !current)
                continue;
            const variants = [];
            const byPlayerVariant = new Map();
            for (const member of active) {
                let variant = byPlayerVariant.get(member.playerVariantId);
                if (!variant) {
                    variant = {
                        playerVariantId: member.playerVariantId,
                        sourceOrdinal: Number(member.playerOrdinal) || variants.length + 1,
                        candidates: [],
                    };
                    variants.push(variant);
                    byPlayerVariant.set(member.playerVariantId, variant);
                }
                variant.candidates.push(member);
            }
            variants.sort((a, b) => a.sourceOrdinal - b.sourceOrdinal);
            const currentIndex = variants.findIndex((variant) => variant.playerVariantId === current.playerVariantId);
            publish(user, {
                userMessageId: user.messageId,
                assistantMessageId: assistant.messageId,
                group: {
                    groupId: stored.groupId,
                    currentOrdinal: currentIndex + 1,
                    total: variants.length,
                    members: variants.map((variant, variantIndex) => {
                        const representative = variant.candidates.find((member) => member.sessionId === session.id)
                            ?? [...variant.candidates].reverse().find((member) => !member.pending)
                            ?? variant.candidates.at(-1);
                        return {
                            sessionId: representative?.sessionId,
                            ordinal: variantIndex + 1,
                            sourceOrdinal: variant.sourceOrdinal,
                            pending: representative?.pending === true,
                        };
                    }),
                },
            });
        }
        return result;
    }
    function visibleSurfaceEvent(session, predicate) {
        return [...surfaceEvents(session)].reverse().find(predicate) ?? null;
    }
    function editEffectsCommitted(session, edit) {
        const receipt = cloneBranchRecord(T.branch.get(editInvalidationKey(session.id, String(edit.data?.role), Number(edit.data?.targetSeq))));
        return receipt?.schemaVersion === 1 && receipt.state === 'committed' &&
            receipt.role === edit.data?.role && receipt.targetSeq === edit.data?.targetSeq &&
            receipt.editSeq === edit.seq && receipt.textSha256 === sha256(edit.data?.text);
    }
    /** Caller holds the fork lock. Receipts distinguish a durable edit from completed derived effects. */
    async function applyTextEdit(session, event, text, reason) {
        const targetSeq = Number(event.seq);
        const role = event.type === 'assistant/message' ? 'assistant' : 'user';
        const messageId = String(role === 'assistant' ? event.data?.message?.id ?? '' : event.data?.id ?? '');
        const currentText = textOf(role === 'assistant' ? event.data?.message?.content : event.data?.content);
        const changed = currentText !== text;
        const edit = changed
            ? messageEdits.append(session, targetSeq, { role, messageId }, text)
            : messageEdits.latest(eventsOf(session), targetSeq);
        if (!edit)
            return { changed: false, editSeq: null };
        if (edit.data?.targetSeq !== targetSeq || edit.data.role !== role ||
            edit.data.messageId !== messageId || edit.data.text !== text) {
            throw new Error('消息编辑投影与当前正文不一致，未提交派生状态');
        }
        const editSeq = Number(edit.seq);
        const receiptKey = editInvalidationKey(session.id, role, targetSeq);
        const textSha256 = sha256(text);
        if (editEffectsCommitted(session, edit)) {
            return { changed, editSeq };
        }
        // The native provider drains routed live events at this durability barrier.
        // A flush/invalidation failure leaves the edit available for an idempotent retry.
        await flushEdits(session);
        await invalidateDerivedStoryState(session, { fromSeq: targetSeq, reason });
        await T.branch.put(receiptKey, {
            schemaVersion: 1, state: 'committed', role, targetSeq, editSeq, textSha256, committedAt: Date.now(),
        });
        return { changed, editSeq };
    }
    async function replaceAssistantText(session, messageId, text, lockAttempt = 0) {
        const initialPointer = forkPointerFor(session, messageId);
        const initialGroup = initialPointer?.groupId
            ? hydrateForkGroup(T.branch.get(forkGroupKey(initialPointer.groupId)))
            : null;
        const lockKey = initialGroup?.anchor
            ? forkAnchorLockKey(initialGroup.anchor)
            : forkAnchorLockKey({ sourceSessionId: session.id, sourceAssistantMessageId: messageId });
        let retryWithCanonicalLock = false;
        const replacement = await withForkMutationLock(lockKey, async () => {
            const livePointer = forkPointerFor(session, messageId);
            const liveGroup = livePointer?.groupId
                ? hydrateForkGroup(T.branch.get(forkGroupKey(livePointer.groupId)))
                : null;
            const canonicalLockKey = liveGroup?.anchor ? forkAnchorLockKey(liveGroup.anchor) : lockKey;
            if (canonicalLockKey !== lockKey) {
                retryWithCanonicalLock = true;
                return null;
            }
            const exactLiveMember = liveGroup?.members?.find((member) => member.sessionId === session.id && member.assistantMessageId === messageId);
            const nearestLiveMember = groupMemberForSession(liveGroup, session, messageId, { includeDeleted: true });
            if (exactLiveMember?.deleted || (!exactLiveMember && nearestLiveMember?.deleted)) {
                throw new Error('这个回复版本已经删除，不能再编辑');
            }
            if (liveGroup && !exactLiveMember && nearestLiveMember) {
                throw new Error('这是从祖先分支继承的历史回复；请先用分支箭头切换到该版本所属会话再直接编辑');
            }
            const event = visibleSurfaceEvent(session, (candidate) => candidate?.type === 'assistant/message' && assistantMessageId(candidate) === messageId);
            if (!event)
                throw new Error('当前分支中找不到这条 Agent 回复');
            const result = await applyTextEdit(session, event, text, 'assistant-message-edited');
            if (result.editSeq !== null && liveGroup && exactLiveMember) {
                // The member points at the original message node, never the audit edit event.
                exactLiveMember.assistantSeq = Number(event.seq);
                exactLiveMember.assistantEditSeq = result.editSeq;
                exactLiveMember.editedAt = Date.now();
                liveGroup.updatedAt = Date.now();
                await T.branch.put(forkGroupKey(liveGroup.groupId), liveGroup);
            }
            return projectStoryEvent(session, event);
        });
        if (retryWithCanonicalLock) {
            if (lockAttempt >= 4)
                throw new Error('回复分支在并发修改期间持续变化，请重试');
            return replaceAssistantText(session, messageId, text, lockAttempt + 1);
        }
        return replacement;
    }
    async function invalidateDerivedStoryState(session, { fromSeq, reason }) {
        const branchId = session.id;
        const seq = durableSeq(fromSeq);
        // Edits preserve the user's chosen visible text but invalidate asynchronous
        // products that were derived from the former prose. They will be rebuilt by
        // a later completed generation; stale decision cards cannot pop up meanwhile.
        await withDecisionMutationLock(branchId, async () => {
            const key = keyOf(branchId, 'current');
            const current = normalizeDecisionRecord(T.decision.get(key));
            if (!current)
                return;
            const decisionSeq = durableSeq(current.atSeq ?? current.seq);
            if (seq !== null && decisionSeq !== null && decisionSeq < seq)
                return;
            await T.decision.put(key, {
                ...current,
                superseded: true,
                supersededAt: Date.now(),
                supersededReason: String(reason ?? 'surface-edited').slice(0, 120),
            });
        });
        const sceneKey = keyOf(branchId, 'current');
        const scene = cloneRecord(T.scene.get(sceneKey));
        const sceneSeq = durableSeq(scene?.updatedAtSeq ?? scene?.atSeq);
        if (scene && (seq === null || sceneSeq === null || sceneSeq >= seq)) {
            await T.scene.delete(sceneKey);
        }
        const panelKey = keyOf(branchId, 'panel');
        const panel = cloneRecord(T.status.get(panelKey));
        const panelSeq = durableSeq(panel?.atSeq ?? panel?.updatedAtSeq);
        if (panel && (seq === null || panelSeq === null || panelSeq >= seq)) {
            await T.status.put(panelKey, { ...panel, stale: true, invalidatedFromSeq: seq, invalidatedAt: Date.now() });
        }
        const memoryKey = keyOf(branchId, 'head');
        if (!T.memory.get(memoryKey)) {
            await T.memory.put(memoryKey, { deltas: [], lockedFacts: [], pendingConfirmations: [], version: 1 });
        }
        await T.memory.update(memoryKey, (current) => {
            const keepBeforeEdit = (value) => {
                const item = value;
                if (!item || typeof item !== 'object')
                    return false;
                const owners = [item.sessionId, item.branchId, item.ownerSessionId]
                    .map((value) => String(value ?? '').trim())
                    .filter(Boolean);
                if (owners.length && !owners.includes(branchId))
                    return true;
                const itemSeq = provenanceSeq(item);
                if (seq === null)
                    return owners.length === 0;
                return itemSeq === null || itemSeq < seq;
            };
            return {
                ...current,
                archives: (Array.isArray(current?.archives) ? current.archives : []).filter(keepBeforeEdit),
                archiveDigests: (Array.isArray(current?.archiveDigests) ? current.archiveDigests : []).filter(keepBeforeEdit),
                deltas: (Array.isArray(current?.deltas) ? current.deltas : []).filter(keepBeforeEdit),
                pendingConfirmations: (Array.isArray(current?.pendingConfirmations) ? current.pendingConfirmations : []).filter(keepBeforeEdit),
                version: (Number(current?.version) || 1) + 1,
                invalidatedAt: Date.now(),
                invalidatedFromSeq: seq,
                invalidatedReason: String(reason ?? 'surface-edited').slice(0, 120),
            };
        });
    }
    async function reconcileCanonicalPlayerVariants(session, lookup = null) {
        let synced = 0;
        for (const assistant of surfaceEvents(session).filter(event => event.type === 'assistant/message')) {
            const messageId = assistantMessageId(assistant);
            const pointer = forkPointerFor(session, messageId, lookup);
            const initial = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            if (!initial)
                continue;
            await withForkMutationLock(forkAnchorLockKey(initial.anchor), async () => {
                const group = hydrateForkGroup(T.branch.get(forkGroupKey(initial.groupId)));
                const exact = group?.members.find(member => member.sessionId === session.id && member.assistantMessageId === messageId);
                if (exact?.deleted)
                    return;
                const member = exact ?? groupMemberForSession(group, session, messageId);
                if (!group || !member || member.pending || member.deleted)
                    return;
                const variant = group.playerVariants?.[member.playerVariantId];
                if (!variant || typeof variant.text !== 'string')
                    return;
                const projectionKey = playerProjectionKey(session.id, group.groupId, member.playerVariantId);
                const projection = cloneBranchRecord(T.branch.get(projectionKey));
                const userIds = [projection?.userMessageId, exact?.userMessageId, member.userMessageId].filter(Boolean);
                const userSeqs = [projection?.userSeq, exact?.userSeq, member.userSeq].map(durableSeq).filter(value => value !== null);
                const user = visibleSurfaceEvent(session, event => event.type === 'user/message' &&
                    event.data?.source?.kind === 'user' &&
                    (userIds.includes(String(event.data?.id ?? '')) || userSeqs.includes(Number(event.seq))))
                    ?? currentSurfaceUserBefore(session, assistant)?.event;
                if (!user)
                    return;
                assertBranchSession(session);
                const applied = await applyTextEdit(session, user, variant.text, 'player-message-canonical-sync');
                const revision = Math.max(1, Number(variant.revision) || 1);
                if (exact) {
                    if (exact.playerAppliedRevision === revision && exact.userSeq === user.seq &&
                        exact.playerEditSeq === applied.editSeq)
                        return;
                    exact.userMessageId = String(user.data?.id ?? '');
                    exact.userSeq = Number(user.seq);
                    exact.promptText = variant.text;
                    exact.playerTextRevision = revision;
                    exact.playerAppliedRevision = revision;
                    exact.playerEditSeq = applied.editSeq;
                    exact.editedAt = Date.now();
                    group.updatedAt = Date.now();
                    await T.branch.put(forkGroupKey(group.groupId), group);
                }
                else if (projection?.revision !== revision || projection.userSeq !== user.seq || projection.editSeq !== applied.editSeq) {
                    await T.branch.put(projectionKey, {
                        schemaVersion: 1,
                        groupId: group.groupId, playerVariantId: member.playerVariantId,
                        sourceMemberSessionId: member.sessionId, userMessageId: String(user.data?.id ?? ''),
                        userSeq: Number(user.seq), revision, editSeq: applied.editSeq,
                        textSha256: sha256(variant.text), updatedAt: Date.now(),
                    });
                }
                if (applied.changed)
                    synced++;
            });
        }
        // A process can stop after the edit reaches JSONL but before table effects.
        // Recover even an ungrouped assistant edit on normal state/prepare entry;
        // receipt completion must not depend on the player retrying the HTTP call.
        let recoveredEdits = 0;
        for (const edit of messageEdits.current(session, eventsOf(session))) {
            if (editEffectsCommitted(session, edit))
                continue;
            const target = eventsOf(session)[Number(edit.data?.targetSeq)];
            if (!target)
                throw new Error('编辑来源节点缺失，无法恢复派生状态');
            const visible = session.surface?.nodes?.includes(target.seq) === true;
            const messageId = target.type === 'assistant/message' ? assistantMessageId(target)
                : visible ? assistantMessageId(userForkContext(session, target.seq).followingAssistant) : '';
            const pointer = messageId ? forkPointerFor(session, messageId) : null;
            let group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            if (!group && target.type === 'user/message') {
                // Archived player nodes no longer have a live surface neighbour. Their
                // stable message identity still locates the shared variant's lock.
                for (const [key, value] of T.branch.entries()) {
                    if (!key.startsWith('fork-group-'))
                        continue;
                    const candidate = hydrateForkGroup(value);
                    if (candidate?.members.some(member => member.userMessageId === target.data?.id && member.userSeq === target.seq)) {
                        group = candidate;
                        break;
                    }
                }
            }
            const lockKey = group?.anchor ? forkAnchorLockKey(group.anchor)
                : messageId ? forkAnchorLockKey({ sourceSessionId: session.id, sourceAssistantMessageId: messageId })
                    : `surface:${session.id}`;
            await withForkMutationLock(lockKey, async () => {
                assertBranchSession(session);
                const current = projectStoryEvent(session, target);
                const text = textOf(target.type === 'assistant/message' ? current.data?.message?.content : current.data?.content);
                await applyTextEdit(session, current, text, 'message-edit-effects-recovered');
                recoveredEdits++;
            });
        }
        return { synced, recoveredEdits };
    }
    function userForkContext(session, seq) {
        const requested = Number(seq);
        const event = visibleSurfaceEvent(session, (candidate) => candidate?.type === 'user/message' && Number(candidate.seq) === requested && candidate.data?.source?.kind === 'user');
        if (!event)
            throw new Error('当前分支中找不到这条玩家消息');
        const surface = surfaceEvents(session);
        const userIndex = surface.findIndex((candidate) => Number(candidate?.seq) === Number(event.seq));
        const internal = internalTaskSeqs(session);
        let followingAssistant = null;
        for (let index = userIndex + 1; index < surface.length; index += 1) {
            if (surface[index]?.type === 'user/message' && surface[index].data?.source?.kind === 'user')
                break;
            if (surface[index]?.type === 'assistant/message' && !internal.has(Number(surface[index].seq)))
                followingAssistant = surface[index];
        }
        const pointer = followingAssistant
            ? forkPointerFor(session, assistantMessageId(followingAssistant))
            : null;
        const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
        return { event, followingAssistant, group };
    }
    // A provider failure can leave a real player message with no assistant
    // message below it.  It is still a valid recovery anchor: fork before the
    // failed turn and replay the corrected prompt in a clean child session.
    function locatePlayerRecoveryTarget(session, seq) {
        const context = userForkContext(session, seq);
        const userEvent = context.event;
        const userTurn = turnForEvent(session, userEvent);
        if (!Number.isSafeInteger(Number(userTurn))) {
            throw new Error('失败轮次缺少有效 turn，无法安全恢复');
        }
        const events = eventsOf(session);
        if (canonicalAssistantForTurn(session, Number(userTurn)))
            return null;
        if (!events.some(event => event?.type === 'turn/end' && Number(event.data?.turn) === Number(userTurn))) {
            throw new Error('本轮仍在运行，请等待结束后重新生成');
        }
        const userIndex = Number(userEvent.seq);
        let previousTurnEndSeq = null;
        for (let index = Math.min(userIndex, events.length - 1) - 1; index >= 0; index -= 1) {
            if (events[index]?.type !== 'turn/end')
                continue;
            const turn = Number(events[index]?.data?.turn);
            if (!Number.isSafeInteger(turn) || turn >= Number(userTurn))
                continue;
            previousTurnEndSeq = Number(events[index].seq);
            break;
        }
        const expectedSeedLength = previousTurnEndSeq === null ? 0 : (() => {
            let cut = previousTurnEndSeq + 1;
            while (cut < events.length && events[cut]?.type !== 'turn/start')
                cut += 1;
            return cut;
        })();
        return {
            sourceSessionId: session.id,
            sourceUserMessageId: String(userEvent.data?.id ?? ''),
            sourceUserSeq: Number(userEvent.seq),
            sourceTurn: Number(userTurn),
            previousTurnEndSeq,
            expectedSeedLength,
            promptText: textOf(userEvent.data?.content).trim(),
            recoveryOnly: true,
        };
    }
    async function replaceUserText(session, seq, text, lockAttempt = 0) {
        const initial = userForkContext(session, seq);
        const lockKey = initial.group?.anchor
            ? forkAnchorLockKey(initial.group.anchor)
            : initial.followingAssistant
                ? forkAnchorLockKey({
                    sourceSessionId: session.id,
                    sourceAssistantMessageId: assistantMessageId(initial.followingAssistant),
                })
                : `surface:${session.id}`;
        let retryWithCanonicalLock = false;
        const result = await withForkMutationLock(lockKey, async () => {
            const live = userForkContext(session, seq);
            const group = live.group;
            const canonicalLockKey = group?.anchor ? forkAnchorLockKey(group.anchor) : lockKey;
            if (canonicalLockKey !== lockKey) {
                retryWithCanonicalLock = true;
                return null;
            }
            const currentMember = groupMemberForSession(group, session, assistantMessageId(live.followingAssistant));
            const exactMember = group?.members.find(member => member.sessionId === session.id &&
                member.assistantMessageId === assistantMessageId(live.followingAssistant));
            const nearestMember = groupMemberForSession(group, session, assistantMessageId(live.followingAssistant), { includeDeleted: true });
            if (exactMember?.deleted || (!exactMember && nearestMember?.deleted)) {
                throw new Error('这个回复版本已经删除，不能再编辑玩家消息');
            }
            const targets = currentMember
                ? group.members.filter((member) => !member.deleted && member.playerVariantId === currentMember.playerVariantId)
                : [{ sessionId: session.id, userMessageId: String(live.event.data?.id ?? ''), userSeq: Number(live.event.seq) }];
            if (currentMember && !targets.some((member) => member.sessionId === session.id)) {
                targets.push({
                    projectionOnly: true,
                    sessionId: session.id,
                    userMessageId: String(live.event.data?.id ?? ''),
                    userSeq: Number(live.event.seq),
                    promptText: textOf(live.event.data?.content).trim(),
                    playerVariantId: currentMember.playerVariantId,
                    playerOrdinal: currentMember.playerOrdinal,
                });
            }
            let canonicalRevision = null;
            if (group && currentMember) {
                const variant = group.playerVariants[currentMember.playerVariantId] ?? { text: String(currentMember.promptText ?? ''), revision: 1 };
                const changed = variant.text !== text;
                canonicalRevision = Math.max(1, Number(variant.revision) || 1) + (changed ? 1 : 0);
                group.playerVariants[currentMember.playerVariantId] = {
                    ...variant, text, revision: canonicalRevision,
                    updatedAt: changed ? Date.now() : Number(variant.updatedAt ?? Date.now()),
                    updatedBySessionId: session.id,
                };
                for (const member of targets) {
                    member.promptText = text;
                    member.playerTextRevision = canonicalRevision;
                }
                // Persist intent before any hot sibling is edited. Cold/restarted siblings
                // converge to this revision; a partial fanout must never restore the old text.
                group.updatedAt = Date.now();
                await T.branch.put(forkGroupKey(group.groupId), group);
            }
            let changed = 0;
            let matched = 0;
            for (const member of targets) {
                const targetSession = member.sessionId === session.id ? session : ctx.sessions.get(member.sessionId);
                if (!targetSession || !isRoleplaySession(targetSession))
                    continue;
                const targetEvent = visibleSurfaceEvent(targetSession, candidate => candidate.type === 'user/message' && candidate.data?.source?.kind === 'user' &&
                    ((member.userMessageId && String(candidate.data?.id ?? '') === member.userMessageId) ||
                        Number(candidate.seq) === durableSeq(member.userSeq)));
                if (!targetEvent)
                    continue;
                const applied = await applyTextEdit(targetSession, targetEvent, text, 'player-message-edited');
                member.userMessageId = String(targetEvent.data?.id ?? '');
                member.userSeq = Number(targetEvent.seq);
                member.promptText = text;
                member.playerEditSeq = applied.editSeq;
                if (canonicalRevision !== null)
                    member.playerAppliedRevision = canonicalRevision;
                member.editedAt = Date.now();
                if (member.projectionOnly && group && currentMember) {
                    await T.branch.put(playerProjectionKey(targetSession.id, group.groupId, currentMember.playerVariantId), {
                        schemaVersion: 1,
                        groupId: group.groupId, playerVariantId: currentMember.playerVariantId,
                        sourceMemberSessionId: currentMember.sessionId, userMessageId: member.userMessageId,
                        userSeq: member.userSeq, revision: canonicalRevision, editSeq: applied.editSeq,
                        textSha256: sha256(text), updatedAt: Date.now(),
                    });
                }
                else if (group && currentMember) {
                    // Applied revision advances only after durable edit and derived effects.
                    group.updatedAt = Date.now();
                    await T.branch.put(forkGroupKey(group.groupId), group);
                }
                matched++;
                if (applied.changed)
                    changed++;
            }
            if (matched === 0)
                throw new Error('玩家消息编辑未能写入当前分支');
            return { changed, matched, replayed: changed === 0 };
        });
        if (retryWithCanonicalLock) {
            if (lockAttempt >= 4)
                throw new Error('玩家分支在并发修改期间持续变化，请重试');
            return replaceUserText(session, seq, text, lockAttempt + 1);
        }
        return result;
    }
    return {
        nativePlayerGroupsFor,
        replaceAssistantText,
        reconcileCanonicalPlayerVariants,
        userForkContext,
        locatePlayerRecoveryTarget,
        replaceUserText,
    };
}
