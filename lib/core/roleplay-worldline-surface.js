// Generated from runtime/alpha3/src/core/roleplay-worldline-surface.ts; edit the TypeScript source.
import { projectStoryEvent } from './roleplay-message-view.js';
import { recordSha256 } from './roleplay-data.js';
import { createWorldlinePlayerSaves, readWorldlinePlayerSaveIntent, assertWorldlinePlayerSaveRequest } from './roleplay-worldline-player-save.js';
import { validateSchemaTaskEditOptionsV1, schemaTaskEditIntentKey, SchemaTaskEditNotAppliedError } from './roleplay-mvu-schema-task-edit-types.js';
import { validateSchemaExistingUserEditRecoveryRequest } from './roleplay-mvu-schema-task-edit-types.js';
import { createSurfaceCursor } from 'dsh-nexttavern-native-session/surface';
import { createTaskHistoryClassification } from './tavern-task-context.js';
/** Only immutable Native data lives here. Group membership and permission are
 * still read from the actual ledger by each caller. */
export function createWorldlineNativeHistory(deps) {
    const states = new WeakMap();
    function createState(cut, definitions) {
        let current = cut, nextOrder = 0;
        const surface = createSurfaceCursor({ read: () => current, projections: definitions }), tasks = createTaskHistoryClassification(seq => seq < surface.length ? current.at(seq) : undefined), rawUsers = new Map(), rawAssistants = new Map(), candidates = new Map(), byTurn = new Map(), users = [], assistants = [];
        const order = (seq) => candidates.get(seq).order;
        function lower(list, position) {
            let left = 0, right = list.length;
            while (left < right) {
                const middle = (left + right) >>> 1;
                if (order(list[middle]) < position)
                    left = middle + 1;
                else
                    right = middle;
            }
            return left;
        }
        function refresh(seq) {
            const candidate = candidates.get(seq);
            if (!candidate || candidate.event.type !== 'assistant/message')
                return;
            const at = lower(assistants, candidate.order), present = assistants[at] === seq, eligible = !tasks.internal(candidate.event);
            if (eligible && !present)
                assistants.splice(at, 0, seq);
            else if (!eligible && present)
                assistants.splice(at, 1);
        }
        const player = (event) => event.type === 'user/message' && event.data.source.kind === 'user';
        const relevant = (event) => player(event) || event.type === 'assistant/message';
        function rebuild() {
            users.length = 0;
            assistants.length = 0;
            nextOrder = 0;
            for (const seq of surface.nodes) {
                const candidate = candidates.get(seq);
                if (!candidate)
                    continue;
                candidate.order = nextOrder++;
                if (player(candidate.event))
                    users.push(seq);
                else if (!tasks.internal(candidate.event))
                    assistants.push(seq);
            }
        }
        function event(seq) {
            const raw = current.at(seq);
            return raw ? projectStoryEvent({ deriveEventMessage: () => surface.deriveEventMessage(raw) }, raw) : undefined;
        }
        return {
            owner: cut.owner, definitions,
            advance(cut) {
                current = cut;
                let transition;
                surface.advanceTo(cut.length, value => { transition = value; }, raw => {
                    const actual = transition;
                    transition = undefined;
                    if (raw.type === 'user/message' || raw.type === 'assistant/message') {
                        const id = raw.type === 'user/message' ? raw.data.id : raw.data.message.id, index = raw.type === 'user/message' ? rawUsers : rawAssistants, seqs = index.get(id) ?? [];
                        seqs.push(raw.seq);
                        index.set(id, seqs);
                    }
                    const delta = tasks.advance(raw, actual);
                    let reordered = false;
                    if (actual?.kind === 'replace')
                        for (const seq of actual.removed) {
                            const prior = candidates.get(seq);
                            if (prior) {
                                byTurn.get(prior.turn)?.delete(seq);
                                candidates.delete(seq);
                                reordered = true;
                            }
                        }
                    if ((actual?.kind === 'append' || actual?.kind === 'replace') && relevant(raw)) {
                        const turn = tasks.effective(raw);
                        candidates.set(raw.seq, { event: raw, order: nextOrder++, turn });
                        const bucket = byTurn.get(turn) ?? new Set();
                        bucket.add(raw.seq);
                        byTurn.set(turn, bucket);
                        if (actual.kind === 'replace')
                            reordered = true;
                        else if (player(raw))
                            users.push(raw.seq);
                        else
                            refresh(raw.seq);
                    }
                    if (reordered)
                        rebuild();
                    else {
                        for (const turn of delta.dirty)
                            for (const seq of byTurn.get(turn) ?? [])
                                refresh(seq);
                        for (const seq of delta.changedSeqs)
                            refresh(seq);
                    }
                });
            },
            raw(role, id) {
                return ((role === 'user' ? rawUsers : rawAssistants).get(id) ?? []).map(seq => current.at(seq));
            },
            visiblePlayer(seq) { return candidates.has(seq) && player(candidates.get(seq).event) ? event(seq) : undefined; },
            visibleAssistant(seq) {
                return candidates.get(seq)?.event.type === 'assistant/message' ? event(seq) : undefined;
            },
            surfaceOrder(seq) { return candidates.get(seq).order; },
            playerOrder(seq) { return candidates.get(seq).order; },
            playerBefore(seq) {
                const candidate = candidates.get(seq);
                if (!candidate)
                    return;
                const at = lower(users, candidate.order) - 1;
                return at >= 0 ? event(users[at]) : undefined;
            },
            followingAssistant(seq) {
                const candidate = candidates.get(seq);
                if (!candidate || !player(candidate.event))
                    return;
                const next = users[lower(users, candidate.order) + 1], end = next === undefined ? Infinity : order(next), at = lower(assistants, end) - 1, found = assistants[at];
                return found !== undefined && order(found) > candidate.order ? event(found) : undefined;
            },
        };
    }
    return { read(session) {
            if (!deps.nativeHistory?.cut || !deps.projections)
                return;
            // The actual Session checks removed projection providers even on a quiet
            // cut. A different native owner or definition identity starts cold data.
            void session.surface?.contentGeneration;
            const cut = deps.nativeHistory.cut(session);
            // Detached loaded views have their existing explicit full-read contract;
            // only the genuine Native owner can advance this append-only index.
            if (cut.source !== 'native')
                return;
            const definitions = deps.projections();
            let state = states.get(session);
            if (!state || state.owner !== cut.owner || state.definitions.length !== definitions.length
                || state.definitions.some((definition, index) => definition !== definitions[index])) {
                state = createState(cut, [...definitions]);
                states.set(session, state);
            }
            try {
                state.advance(cut);
                return state;
            }
            catch (error) {
                states.delete(session);
                throw error;
            }
        } };
}
export function assertBranchSession(session) {
    if (!('append' in session) || typeof session.append !== 'function')
        throw new Error('会话暂不可写入分支历史');
}
// Append-only message revisions, projection repair and derived-state
// invalidation form one operation; callers keep using roleplay-worldlines.
export function createWorldlineSurface(deps, forks) {
    const { ctx, messageEdits, flushEdits, beginNumericalEdit, checkNumericalTextEdit, persistNumericalEdit, reconcileNumericalEdit, confirmUnchangedNumericalEdit, safeId, keyOf, sha256, T, eventsOf, surfaceEvents, textOf, cloneBranchRecord, internalTaskSeqs, isRoleplaySession, durableSeq, canonicalAssistantForTurn, surfaceEntries, withDecisionMutationLock, normalizeDecisionRecord, cloneRecord, provenanceSeq, } = deps;
    const { forkGroupKey, forkAnchorKey, forkAnchorLockKey, withForkMutationLock, hydrateForkGroup, buildForkLookupIndex, forkPointerFor, groupMemberForSession, assistantMessageId, requestUserEvent, currentSurfaceUserBefore, turnForEvent, forkAssistantEvents, } = forks;
    const editInvalidationKey = (sessionId, role, targetSeq) => keyOf(sessionId, `edit-applied-${role}-${safeId(targetSeq)}`);
    const exactEditInvalidationKey = (sessionId, role, targetSeq, editSeq) => keyOf(sessionId, `edit-applied-${role}-${safeId(targetSeq)}-${safeId(editSeq)}`);
    const editReferences = new WeakMap();
    function editReference(session, edit) {
        const saved = editReferences.get(edit);
        if (saved)
            return saved;
        const operation = edit.data?.operation, reference = operation && deps.authorEditReference?.(session.id, operation.operationId, Number(edit.seq));
        const result = reference ?? { seq: Number(edit.seq), sha256: recordSha256(edit) };
        editReferences.set(edit, result);
        return result;
    }
    function editReceipt(session, edit) {
        const key = exactEditInvalidationKey(session.id, String(edit.data?.role), Number(edit.data?.targetSeq), Number(edit.seq)), exact = T.branch.get(key);
        if (exact)
            return { key, value: exact };
        // Released target-keyed receipts remain valid only for the exact edit they
        // name. New edits keep their own immutable completion row.
        const legacyKey = editInvalidationKey(session.id, String(edit.data?.role), Number(edit.data?.targetSeq));
        return { key: legacyKey, value: T.branch.get(legacyKey) };
    }
    const playerProjectionKey = (sessionId, groupId, playerVariantId) => keyOf(sessionId, `player-projection-${sha256(`${groupId}\0${playerVariantId}`).slice(0, 32)}`);
    const playerSaves = createWorldlinePlayerSaves(T.branch);
    async function nativePlayerGroupsFor(session, assistantGroups, lookup) {
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
            const selected = assistant?.messageId ? assistantGroups[assistant.messageId] : undefined;
            let stored = selected ? hydrateForkGroup(T.branch.get(forkGroupKey(selected.groupId))) : null;
            if (stored?.anchor.openingOnly) {
                // Assistant paging can select an opening sibling for the same anchor.
                // Player paging uses the ordinary group from the already repaired ledger.
                lookup ??= buildForkLookupIndex(session);
                const pointer = forkPointerFor(session, assistant.messageId, lookup, false);
                stored = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            }
            const current = stored && assistant?.messageId ? groupMemberForSession(stored, session, assistant.messageId) : null;
            if (!assistant?.messageId || !stored || !current) {
                publish(user, {
                    userMessageId: user.messageId,
                    assistantMessageId: assistant?.messageId ?? null,
                    group: null,
                });
                continue;
            }
            const active = stored.members.filter((member) => !member.deleted);
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
                ...(stored.playerVariants[current.playerVariantId]?.schemaTaskEdit?.targets[session.id]?.terminal
                    ? { editConflict: { operationId: stored.playerVariants[current.playerVariantId].schemaTaskEdit.options.operationId,
                            requestedText: stored.playerVariants[current.playerVariantId].text,
                            reason: stored.playerVariants[current.playerVariantId].schemaTaskEdit.targets[session.id].terminal.reason } } : {}),
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
    function editEffectsCommitted(session, edit, receipt = editReceipt(session, edit).value) {
        return receipt?.schemaVersion === 1 && receipt.state === 'committed' &&
            receipt.role === edit.data?.role && receipt.targetSeq === edit.data?.targetSeq &&
            receipt.editSeq === edit.seq;
    }
    /** The same edit owner supplies its actual completion rows to the initial
     * absence audit. A lifecycle state is not a numerical state publication. */
    function readOwnedEditCompletionRows(session) {
        const events = deps.nativeHistory?.cut?.(session) ?? eventsOf(session), rows = [];
        for (const edit of messageEdits.current(session, events)) {
            const { key, value } = editReceipt(session, edit), fields = ['schemaVersion', 'state', 'role', 'targetSeq', 'editSeq', 'textSha256', 'committedAt',
                ...value?.authorCompleted === true ? ['authorCompleted'] : []];
            if (!value || Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))
                || !Number.isSafeInteger(value.committedAt) || Number(value.committedAt) < 0
                || !editEffectsCommitted(session, edit, value))
                continue;
            rows.push({ key, value });
        }
        return rows;
    }
    const editCut = (session) => deps.nativeHistory?.cut?.(session) ?? eventsOf(session);
    function authorOperationResult(session, edit, replayed) {
        const operation = edit.data?.operation, receipt = editReceipt(session, edit), reference = editReference(session, edit);
        if (!editEffectsCommitted(session, edit, receipt.value)
            || receipt.value?.authorCompleted !== true)
            return { kind: 'unknown', operationId: operation.operationId, code: 'AUTHOR_MESSAGE_EDIT_PENDING', edit: reference };
        const latest = messageEdits.lookupTarget(session, editCut(session), Number(edit.data?.targetSeq));
        return { kind: 'committed', operationId: operation.operationId, edit: reference,
            effects: { key: receipt.key, sha256: recordSha256(receipt.value) }, replayed, superseded: latest !== edit };
    }
    function confirmAuthorMessageEdit(session, operationId, principal) {
        const edit = messageEdits.lookupOperation?.(session, editCut(session), operationId);
        if (edit && principal) {
            const origin = (edit.data?.operation).origin;
            if (!('principal' in origin) || origin.principal !== principal)
                return { kind: 'refused', operationId, code: 'AUTHOR_MESSAGE_EDIT_ORIGIN_MISMATCH' };
        }
        return edit ? authorOperationResult(session, edit, true)
            : { kind: 'unknown', operationId, code: 'AUTHOR_MESSAGE_EDIT_OPERATION_NOT_RECORDED' };
    }
    function assertAuthorEditTarget(session, event, author) {
        const { expected } = author.input, role = event.type === 'assistant/message' ? 'assistant' : 'user', id = String(role === 'assistant' ? event.data?.message?.id : event.data?.id);
        author.assertSourceCurrent();
        if (expected.sessionId !== session.id || Number(event.seq) !== expected.seq || role !== expected.role || id !== expected.messageId
            || !deps.readMessageVersion || deps.readMessageVersion(session, event) !== expected.messageVersionSha256)
            throw Error('AUTHOR_MESSAGE_EDIT_VERSION_CHANGED');
    }
    /** Called under the same fork lock as a new edit. A known operation may
     * finish its own effects, but must never overwrite a later edit. */
    async function recoverAuthorEdit(session, author) {
        if (!messageEdits.lookupOperation || !messageEdits.lookupTarget)
            throw Error('AUTHOR_MESSAGE_EDIT_OWNER_UNAVAILABLE');
        const edit = messageEdits.lookupOperation(session, editCut(session), author.input.operationId);
        if (!edit)
            return false;
        if ((edit.data?.operation).requestSha256 !== author.operation.requestSha256)
            throw Error('AUTHOR_MESSAGE_EDIT_OPERATION_CONFLICT');
        const completed = authorOperationResult(session, edit, true);
        if (completed.kind === 'committed') {
            author.complete(completed);
            return true;
        }
        const latest = messageEdits.lookupTarget(session, editCut(session), Number(edit.data?.targetSeq));
        if (latest !== edit) {
            author.complete({ kind: 'unknown', operationId: author.input.operationId,
                code: 'AUTHOR_MESSAGE_EDIT_SUPERSEDED_PENDING', edit: editReference(session, edit) });
            return true;
        }
        author.assertSourceCurrent();
        await deps.recoverNumericalTextEdit?.(session, author.assertSourceCurrent);
        const event = visibleSurfaceEvent(session, candidate => Number(candidate.seq) === Number(edit.data?.targetSeq));
        if (!event)
            throw Error('AUTHOR_MESSAGE_EDIT_TARGET_UNAVAILABLE');
        await applyTextEdit(session, event, author.input.text, 'author-message-edit-recovered', { repair: true, preparedTaskEdit: null, author, replayed: true });
        return true;
    }
    async function replaceAuthorMessageText(session, input, assertSourceCurrent) {
        let result;
        const author = { input, operation: { schemaVersion: 1,
                encoding: 'native-author-message-edit-operation-v1', operationId: input.operationId,
                requestSha256: recordSha256(input), expectedMessageVersionSha256: input.expected.messageVersionSha256, origin: input.origin },
            assertSourceCurrent, complete: value => { result = value; } };
        try {
            if (input.expected.role === 'assistant')
                await replaceAssistantText(session, input.expected.messageId, input.text, 0, 0, author);
            else
                await replaceUserText(session, input.expected.seq, input.text, 0, 0, author);
            return result ?? { kind: 'unknown', operationId: input.operationId, code: 'AUTHOR_MESSAGE_EDIT_ACK_UNKNOWN' };
        }
        catch (error) {
            const known = messageEdits.lookupOperation?.(session, editCut(session), input.operationId), code = error instanceof Error ? error.message : 'AUTHOR_MESSAGE_EDIT_FAILED';
            if (code === 'AUTHOR_MESSAGE_EDIT_OPERATION_CONFLICT')
                return { kind: 'refused', operationId: input.operationId, code };
            if (known)
                return { kind: 'unknown', operationId: input.operationId, code, edit: editReference(session, known) };
            return { kind: 'refused', operationId: input.operationId, code };
        }
    }
    /** Caller holds the fork lock. Receipts distinguish a durable edit from completed derived effects. */
    async function applyTextEdit(session, event, text, reason, options = {}) {
        const targetSeq = Number(event.seq);
        const role = event.type === 'assistant/message' ? 'assistant' : 'user';
        const messageId = String(role === 'assistant' ? event.data?.message?.id ?? '' : event.data?.id ?? '');
        const currentText = textOf(role === 'assistant' ? event.data?.message?.content : event.data?.content);
        const changed = currentText !== text;
        if (options.author && !options.repair && !changed) {
            // An unchanged acknowledgement is current DATA, not a historical edit.
            options.author.complete({ kind: 'unchanged', operationId: options.author.input.operationId });
            return { changed: false, editSeq: null, recovered: false };
        }
        const taskIntent = options.preparedTaskEdit === undefined
            ? options.schemaTaskEdit && (changed || role === 'assistant')
                ? await deps.prepareNumericalTextEdit?.(session, event, text, options.schemaTaskEdit) : undefined
            : options.preparedTaskEdit;
        const priorEdit = options.author ? messageEdits.lookupTarget(session, editCut(session), targetSeq)
            : messageEdits.latest(eventsOf(session), targetSeq);
        // Unchanged inherited text belongs to the Native prefix. Consuming it
        // must not start a child edit transaction or recreate ancestor receipts.
        if (!taskIntent && !changed && priorEdit && priorEdit.seq < (session.inheritedEventCount ?? 0)) {
            return { changed: false, editSeq: Number(priorEdit.seq), inherited: true, recovered: false };
        }
        if (!taskIntent && (changed || priorEdit && !editEffectsCommitted(session, priorEdit))) {
            // Shared users are admitted before variant publication; task edits reuse
            // their prepared intent, and durable Native repair keeps its admission.
            if (role === 'assistant' && changed && !options.repair && !options.schemaTaskEdit)
                await checkNumericalTextEdit?.(session.id, targetSeq);
            options.author?.assertSourceCurrent();
            beginNumericalEdit?.(session.id);
        }
        const append = () => messageEdits.append(session, targetSeq, { role, messageId }, text, undefined, options.author?.operation);
        const edit = taskIntent
            ? await deps.appendNumericalTextEdit(session, taskIntent, append, options.author?.assertSourceCurrent)
            : changed
                ? append()
                : priorEdit;
        if (!edit)
            return { changed: false, editSeq: null, recovered: false };
        if (edit.data?.targetSeq !== targetSeq || edit.data.role !== role ||
            edit.data.messageId !== messageId || edit.data.text !== text) {
            throw new Error('消息编辑投影与当前正文不一致，未提交派生状态');
        }
        const editSeq = Number(edit.seq);
        const receiptKey = exactEditInvalidationKey(session.id, role, targetSeq, editSeq);
        const committed = editEffectsCommitted(session, edit);
        // The native provider drains routed live events at this durability barrier.
        // A flush/invalidation failure leaves the edit available for an idempotent retry.
        if (!committed && !taskIntent)
            await flushEdits(session);
        let numericalFailure;
        try {
            await persistNumericalEdit?.(session.id, editSeq);
        }
        catch (error) {
            numericalFailure = { error };
        }
        // The accepted edit must retire stale cards even if its numerical denial
        // write is unknown. That unknown remains a separate fail-closed gate; a
        // state-entry repair can read panels without pretending the denial exists.
        if (!committed) {
            await invalidateDerivedStoryState(session, { fromSeq: targetSeq, reason });
            await T.branch.put(receiptKey, {
                schemaVersion: 1, state: 'committed', role, targetSeq, editSeq, textSha256: sha256(text), committedAt: Date.now(),
            });
        }
        if (numericalFailure && !options.repair)
            throw numericalFailure.error;
        if (!numericalFailure)
            await reconcileNumericalEdit?.(session.id, editSeq);
        if (options.author && !numericalFailure && deps.authorEditResolved?.(session.id, editSeq) !== false) {
            const receipt = editReceipt(session, edit);
            // Preserve the revision owner's actual completion before a later edit
            // replaces its live view. Cold confirmation reads this same exact row.
            if (receipt.value?.authorCompleted !== true)
                await T.branch.put(receiptKey, { ...receipt.value, authorCompleted: true });
        }
        if (options.author)
            options.author.complete(authorOperationResult(session, edit, options.replayed === true));
        return { changed, editSeq, recovered: !committed };
    }
    async function replaceAssistantText(session, messageId, text, editOptions = 0, attempt = 0, author) {
        const schemaTaskEdit = typeof editOptions === 'number' ? undefined : validateSchemaTaskEditOptionsV1(editOptions);
        const lockAttempt = typeof editOptions === 'number' ? editOptions : attempt;
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
            if (author && await recoverAuthorEdit(session, author))
                return null;
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
            if (author) {
                if (Number(event.seq) < Number(session.inheritedEventCount ?? 0))
                    throw Error('AUTHOR_MESSAGE_EDIT_INHERITED_UNSUPPORTED');
                assertAuthorEditTarget(session, event, author);
            }
            const taskOptions = author ? deps.authorTaskEditOptions?.(session, event, author.input.operationId) : schemaTaskEdit, result = await applyTextEdit(session, event, text, 'assistant-message-edited', { schemaTaskEdit: taskOptions, author });
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
            return replaceAssistantText(session, messageId, text, schemaTaskEdit ?? lockAttempt + 1, lockAttempt + 1, author);
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
                // This head belongs to the edited branch. An ancestor owner marks
                // copied evidence, so it cannot exempt that evidence from this edit.
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
        const taskRecovery = await deps.recoverNumericalTextEdit?.(session);
        const pendingTaskEdit = taskRecovery?.kind === 'matched' || taskRecovery?.kind === 'pending' ? taskRecovery.intent : undefined;
        // Recovery can await Source writes while registration publishes a group.
        // Discover the actual ledger members after that barrier, then retain the
        // existing pointer precedence and per-anchor mutation lock below.
        lookup = buildForkLookupIndex(session);
        const native = lookup.groups.length ? forks.nativeMessages(session) : undefined;
        const assistants = !lookup.groups.length ? [] : native
            ? forkAssistantEvents(session, lookup).flatMap(event => {
                const current = native.visibleAssistant(Number(event.seq));
                return current ? [current] : [];
            }).sort((left, right) => native.surfaceOrder(Number(left.seq)) - native.surfaceOrder(Number(right.seq)))
            : surfaceEvents(session).filter(event => event.type === 'assistant/message');
        for (const assistant of assistants) {
            const messageId = assistantMessageId(assistant);
            // Player revisions use their ordinary lineage even when this assistant
            // also anchors an independent no-player opening group.
            const pointer = forkPointerFor(session, messageId, lookup, false);
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
                const frozen = variant.schemaTaskEdit;
                const frozenTarget = frozen?.targets[session.id];
                if (frozenTarget?.terminal)
                    return;
                if (taskRecovery?.kind === 'not-applied' && frozenTarget?.key === schemaTaskEditIntentKey(session.id, taskRecovery.intent.operationId)) {
                    frozenTarget.terminal = { kind: 'not-applied', reason: taskRecovery.reason };
                    await T.branch.put(forkGroupKey(group.groupId), group);
                    return;
                }
                let preparedTaskEdit = pendingTaskEdit?.target.seq === user.seq ? pendingTaskEdit : undefined;
                if (frozen && !Object.hasOwn(frozen.targets, session.id)) {
                    // New regenerations inherit canonical text but were not members of
                    // the earlier save. Only a different actual projection needs intent.
                    preparedTaskEdit = textOf(user.data?.content) === variant.text ? undefined :
                        await deps.prepareNumericalTextEdit?.(session, user, variant.text, frozen.options);
                    if (preparedTaskEdit)
                        await deps.persistNumericalTextEditIntent?.(session, preparedTaskEdit);
                    frozen.targets[session.id] = preparedTaskEdit ? { key: schemaTaskEditIntentKey(session.id, preparedTaskEdit.operationId),
                        sha256: recordSha256(preparedTaskEdit) } : null;
                    await T.branch.put(forkGroupKey(group.groupId), group);
                }
                let applied;
                try {
                    applied = await applyTextEdit(session, user, variant.text, 'player-message-canonical-sync', {
                        repair: true, schemaTaskEdit: frozen?.options,
                        ...(preparedTaskEdit ? { preparedTaskEdit } : frozen?.targets[session.id] === null ? { preparedTaskEdit: null } : {})
                    });
                }
                catch (error) {
                    const target = frozen?.targets[session.id];
                    if (!(error instanceof SchemaTaskEditNotAppliedError) || !target)
                        throw error;
                    target.terminal = { kind: 'not-applied', reason: error.reason };
                    await T.branch.put(forkGroupKey(group.groupId), group);
                    return;
                }
                const revision = Math.max(1, Number(variant.revision) || 1);
                if (exact) {
                    // Original fork members have no edit seq until an actual edit. Do
                    // not rewrite consumed navigation just to normalize absent to null.
                    if (exact.playerAppliedRevision === revision && exact.userSeq === user.seq &&
                        (exact.playerEditSeq ?? null) === applied.editSeq)
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
                if (applied.editSeq === null)
                    confirmUnchangedNumericalEdit?.(session.id);
                if (applied.changed)
                    synced++;
            });
        }
        // A process can stop after the edit reaches JSONL but before table effects.
        // Recover even an ungrouped assistant edit on normal state/prepare entry;
        // receipt completion must not depend on the player retrying the HTTP call.
        let recoveredEdits = 0;
        const editHistory = deps.nativeHistory?.cut?.(session) ?? eventsOf(session);
        for (const edit of messageEdits.current(session, editHistory)) {
            // The Native prefix owns inherited effects; they are not local repair work.
            if (edit.seq < (session.inheritedEventCount ?? 0))
                continue;
            const target = editHistory.at(Number(edit.data?.targetSeq));
            if (!target)
                throw new Error('编辑来源节点缺失，无法恢复派生状态');
            const visible = session.surface?.nodes?.includes(target.seq) === true;
            const messageId = target.type === 'assistant/message' ? assistantMessageId(target)
                : visible ? assistantMessageId(userForkContext(session, target.seq).followingAssistant) : '';
            const pointer = messageId ? forkPointerFor(session, messageId, null, target.type === 'user/message' ? false : undefined) : null;
            let group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            if (!group && target.type === 'user/message') {
                // Archived player nodes no longer have a live surface neighbour. Their
                // stable message identity still locates the shared variant's lock.
                for (const [key, value] of T.branch.entries()) {
                    if (!key.startsWith('fork-group-'))
                        continue;
                    const candidate = hydrateForkGroup(value);
                    if (candidate && !candidate.anchor.openingOnly &&
                        candidate.members.some(member => member.userMessageId === target.data?.id && member.userSeq === target.seq)) {
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
                const applied = await applyTextEdit(session, current, text, 'message-edit-effects-recovered', { repair: true,
                    ...(pendingTaskEdit?.target.seq === target.seq ? { preparedTaskEdit: pendingTaskEdit } : {}) });
                if (applied.recovered)
                    recoveredEdits++;
            });
        }
        return { synced, recoveredEdits };
    }
    function userForkContext(session, seq) {
        const requested = Number(seq);
        const native = forks.nativeMessages(session);
        if (native) {
            const event = native.visiblePlayer(requested);
            if (!event)
                throw new Error('当前分支中找不到这条玩家消息');
            const followingAssistant = native.followingAssistant(requested) ?? null, pointer = followingAssistant ? forkPointerFor(session, assistantMessageId(followingAssistant), null, false) : null, group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null;
            return { event, followingAssistant, group };
        }
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
            ? forkPointerFor(session, assistantMessageId(followingAssistant), null, false)
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
        const ending = events.find(event => event?.type === 'turn/end' && Number(event.data?.turn) === Number(userTurn));
        if (!ending) {
            throw new Error('本轮仍在运行，请等待结束后重新生成');
        }
        // A completed management reply can have no story projection. Its missing
        // prose is not a Native turn failure or permission to replay the request.
        if (ending.data?.reason?.kind === 'completed')
            return null;
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
    async function replaceUserText(session, seq, text, editOptions = 0, attempt = 0, author) {
        let schemaTaskEdit = typeof editOptions === 'number' ? undefined : validateSchemaTaskEditOptionsV1(editOptions);
        const lockAttempt = typeof editOptions === 'number' ? editOptions : attempt;
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
            if (author && await recoverAuthorEdit(session, author))
                return null;
            if (author) {
                if (group)
                    throw Error('AUTHOR_MESSAGE_EDIT_SHARED_USER_UNSUPPORTED');
                if (Number(live.event.seq) < Number(session.inheritedEventCount ?? 0))
                    throw Error('AUTHOR_MESSAGE_EDIT_INHERITED_UNSUPPORTED');
                assertAuthorEditTarget(session, live.event, author);
                schemaTaskEdit = deps.authorTaskEditOptions?.(session, live.event, author.input.operationId);
            }
            const currentMember = groupMemberForSession(group, session, assistantMessageId(live.followingAssistant));
            const exactMember = group?.members.find(member => member.sessionId === session.id &&
                member.assistantMessageId === assistantMessageId(live.followingAssistant));
            const nearestMember = groupMemberForSession(group, session, assistantMessageId(live.followingAssistant), { includeDeleted: true });
            if (exactMember?.deleted || (!exactMember && nearestMember?.deleted)) {
                throw new Error('这个回复版本已经删除，不能再编辑玩家消息');
            }
            const variant = group && currentMember ? group.playerVariants[currentMember.playerVariantId] : undefined;
            const sharedSave = schemaTaskEdit && group && currentMember && variant
                ? playerSaves.prepare(group.groupId, currentMember.playerVariantId, variant, {
                    senderSessionId: session.id, target: { sessionId: session.id, seq: Number(live.event.seq),
                        messageId: String(live.event.data?.id ?? '') }, text, options: schemaTaskEdit
                }) : undefined;
            const selected = sharedSave?.current ? variant?.schemaTaskEdit : undefined;
            const originalTargets = sharedSave?.targetSessionIds ? new Set(sharedSave.targetSessionIds) : undefined;
            const targets = currentMember
                ? group.members.filter((member) => !member.deleted && member.playerVariantId === currentMember.playerVariantId
                    && (!originalTargets || originalTargets.has(member.sessionId)))
                : [{ sessionId: session.id, userMessageId: String(live.event.data?.id ?? ''), userSeq: Number(live.event.seq) }];
            if (currentMember && (!originalTargets || originalTargets.has(session.id))
                && !targets.some((member) => member.sessionId === session.id)) {
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
            const prepared = new Map();
            const targetSessions = new Map();
            const targetEvents = new Map();
            const completed = (member) => !!selected && variant && (member.projectionOnly
                ? cloneBranchRecord(T.branch.get(playerProjectionKey(member.sessionId, group.groupId, currentMember.playerVariantId)))?.revision
                : member.playerAppliedRevision) === variant.revision;
            if (selected && targets.some(member => selected.targets[member.sessionId]?.terminal))
                throw Error('SCHEMA_TASK_EDIT_NOT_APPLIED');
            if (selected && targets.every(completed))
                return { changed: 0, matched: targets.length, replayed: true };
            if (schemaTaskEdit)
                for (const member of targets) {
                    if (completed(member))
                        continue;
                    const targetSession = member.sessionId === session.id ? session : await deps.resolveRoleplaySession(member.sessionId);
                    if (!targetSession || !isRoleplaySession(targetSession))
                        throw Error('SCHEMA_TASK_EDIT_FANOUT_BASIS_UNAVAILABLE');
                    const targetEvent = (member.pending ? requestUserEvent(targetSession, member.requestId) : null)
                        ?? visibleSurfaceEvent(targetSession, candidate => candidate.type === 'user/message' &&
                            ((member.userMessageId && String(candidate.data?.id ?? '') === member.userMessageId)
                                || member.userSeq != null && Number(candidate.seq) === Number(member.userSeq)));
                    if (!targetEvent)
                        throw Error(member.pending ? 'SCHEMA_TASK_EDIT_FANOUT_PENDING' : 'SCHEMA_TASK_EDIT_FANOUT_TARGET_UNPROVEN');
                    targetSessions.set(member.sessionId, targetSession);
                    targetEvents.set(member.sessionId, targetEvent);
                }
            // Resolve every Native target before preparing any suffix. A registered
            // sibling can still be waiting for its actual user input to arrive.
            if (schemaTaskEdit)
                for (const member of targets) {
                    if (completed(member))
                        continue;
                    const targetSession = targetSessions.get(member.sessionId), targetEvent = targetEvents.get(member.sessionId);
                    const frozen = selected?.targets[member.sessionId];
                    // A selected non-null target still belongs to its original task owner,
                    // including when Native already shows the requested text after a crash.
                    const needsIntent = selected ? !!frozen : textOf(targetEvent.data?.content) !== text;
                    prepared.set(member.sessionId, needsIntent
                        ? await deps.prepareNumericalTextEdit?.(targetSession, targetEvent, text, schemaTaskEdit) ?? null : null);
                }
            const sharedSaveRef = await sharedSave?.persist([...targetSessions.keys()]);
            // Every real target is now captured. Sealed intents may be stored before
            // shared publication, but cannot deny a branch or append Native history.
            for (const [targetId, intent] of prepared)
                if (intent)
                    await deps.persistNumericalTextEditIntent?.(targetSessions.get(targetId), intent);
            // Check every affected suffix before storing shared player-edit intent.
            // An unsupported task-result revision keeps both text and state intact.
            if (!schemaTaskEdit && textOf(live.event.data?.content) !== text)
                for (const member of targets) {
                    await checkNumericalTextEdit?.(member.sessionId, Number(member.userSeq));
                }
            if (group && currentMember && !sharedSave?.current) {
                const variant = group.playerVariants[currentMember.playerVariantId] ?? { text: String(currentMember.promptText ?? ''), revision: 1 };
                const changed = variant.text !== text;
                // A new logical choice must settle its members even when prose stays
                // unchanged; an older applied revision cannot ACK a lost publication.
                canonicalRevision = Math.max(1, Number(variant.revision) || 1) + 1;
                const { schemaTaskEdit: previousTaskEdit, currentSaveRef: previousSaveRef, ...variantText } = variant;
                group.playerVariants[currentMember.playerVariantId] = {
                    ...variantText, text, revision: canonicalRevision,
                    updatedAt: changed ? Date.now() : Number(variant.updatedAt ?? Date.now()),
                    updatedBySessionId: session.id,
                    ...(sharedSaveRef ? { currentSaveRef: sharedSaveRef } : {}),
                    ...(schemaTaskEdit ? { schemaTaskEdit: { schemaVersion: 1, options: schemaTaskEdit,
                            targets: Object.fromEntries(targets.map(member => {
                                const intent = prepared.get(member.sessionId);
                                return [member.sessionId, intent ? { key: schemaTaskEditIntentKey(member.sessionId, intent.operationId), sha256: recordSha256(intent) } : null];
                            })) } } : {}),
                };
                // Persist intent before any hot sibling is edited. Cold/restarted siblings
                // converge to this revision; a partial fanout must never restore the old text.
                if (changed && !schemaTaskEdit)
                    for (const member of targets)
                        beginNumericalEdit?.(member.sessionId);
                group.updatedAt = Date.now();
                await T.branch.put(forkGroupKey(group.groupId), group);
            }
            else if (sharedSave?.current)
                canonicalRevision = variant.revision;
            let changed = 0;
            let matched = 0;
            let conflict;
            for (const member of targets) {
                if (completed(member)) {
                    matched++;
                    continue;
                }
                const targetSession = schemaTaskEdit ? targetSessions.get(member.sessionId)
                    : member.sessionId === session.id ? session : ctx.sessions.get(member.sessionId);
                if (!targetSession || !isRoleplaySession(targetSession))
                    continue;
                const targetEvent = schemaTaskEdit ? targetEvents.get(member.sessionId) : visibleSurfaceEvent(targetSession, candidate => candidate.type === 'user/message' && candidate.data?.source?.kind === 'user' &&
                    ((member.userMessageId && String(candidate.data?.id ?? '') === member.userMessageId) ||
                        Number(candidate.seq) === durableSeq(member.userSeq)));
                if (!targetEvent)
                    continue;
                let applied;
                try {
                    applied = await applyTextEdit(targetSession, targetEvent, text, 'player-message-edited', {
                        schemaTaskEdit, author, ...(schemaTaskEdit ? { preparedTaskEdit: prepared.get(member.sessionId) ?? null } : {})
                    });
                }
                catch (error) {
                    if (!(error instanceof SchemaTaskEditNotAppliedError) || !group || !currentMember)
                        throw error;
                    const target = group.playerVariants[currentMember.playerVariantId]?.schemaTaskEdit?.targets[member.sessionId];
                    if (!target)
                        throw error;
                    target.terminal = { kind: 'not-applied', reason: error.reason };
                    await T.branch.put(forkGroupKey(group.groupId), group);
                    conflict ??= error;
                    continue;
                }
                // Completion is published only after the inherited numerical denial
                // has also settled, so a retry may trust the applied-revision marker.
                if (applied.inherited)
                    await persistNumericalEdit?.(targetSession.id, applied.editSeq);
                else if (applied.editSeq === null && !author)
                    confirmUnchangedNumericalEdit?.(targetSession.id);
                member.userMessageId = String(targetEvent.data?.id ?? '');
                member.userSeq = Number(targetEvent.seq);
                member.promptText = text;
                member.playerEditSeq = applied.editSeq;
                if (canonicalRevision !== null) {
                    member.playerTextRevision = canonicalRevision;
                    member.playerAppliedRevision = canonicalRevision;
                }
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
            if (conflict)
                throw conflict;
            if (matched === 0)
                throw new Error('玩家消息编辑未能写入当前分支');
            return { changed, matched, replayed: changed === 0 };
        });
        if (retryWithCanonicalLock) {
            if (lockAttempt >= 4)
                throw new Error('玩家分支在并发修改期间持续变化，请重试');
            return replaceUserText(session, seq, text, schemaTaskEdit ?? lockAttempt + 1, lockAttempt + 1, author);
        }
        return result;
    }
    async function recoverPlayerSave(session, input) {
        const request = validateSchemaExistingUserEditRecoveryRequest(input), save = readWorldlinePlayerSaveIntent(T.branch, request.oldSaveRef), groupKey = forkGroupKey(save.groupId), initial = hydrateForkGroup(T.branch.get(groupKey));
        if (!initial)
            throw Error('SCHEMA_USER_EDIT_RECOVERY_SAVE_CHANGED');
        return withForkMutationLock(forkAnchorLockKey(initial.anchor), async () => {
            const group = hydrateForkGroup(T.branch.get(groupKey)), variant = group?.playerVariants[save.playerVariantId], member = group?.members.find(candidate => candidate.sessionId === session.id
                && candidate.playerVariantId === save.playerVariantId && !candidate.deleted);
            if (!group || !variant || !member || variant.currentSaveRef?.key !== request.oldSaveRef.key
                || variant.currentSaveRef.sha256 !== request.oldSaveRef.sha256
                || variant.schemaTaskEdit?.options.operationId !== save.operationId
                || variant.schemaTaskEdit.targets[session.id] !== null)
                throw Error('SCHEMA_USER_EDIT_RECOVERY_SAVE_CHANGED');
            if (!deps.recoverExistingNumericalUserEdit)
                throw Error('SCHEMA_USER_EDIT_RECOVERY_UNAVAILABLE');
            const result = await deps.recoverExistingNumericalUserEdit(session, request, (edit, storedOrigin) => {
                const data = edit.data;
                if (member.userSeq !== data.targetSeq || member.userMessageId !== data.messageId || variant.text !== data.text)
                    throw Error('SCHEMA_USER_EDIT_RECOVERY_TARGET_UNPROVEN');
                const sender = group.members.find(candidate => candidate.sessionId === variant.updatedBySessionId
                    && candidate.playerVariantId === save.playerVariantId), origin = request.requestOrigin ?? storedOrigin ?? (sender?.userSeq != null && sender.userMessageId
                    ? { sessionId: sender.sessionId, seq: sender.userSeq, messageId: sender.userMessageId } : undefined);
                if (!origin)
                    throw Error('SCHEMA_USER_EDIT_RECOVERY_REQUEST_UNPROVEN');
                assertWorldlinePlayerSaveRequest(save, session.id, origin, data.text);
                return origin;
            });
            // The numerical owner proved Completion5 before this old shared choice
            // can acknowledge its member. Neither the choice revision nor null target
            // is rewritten, including when a previous legacy writer already ACKed it.
            if (member.playerAppliedRevision !== variant.revision || member.playerTextRevision !== variant.revision
                || member.playerEditSeq !== request.editRef.seq || member.promptText !== variant.text) {
                member.playerAppliedRevision = variant.revision;
                member.playerTextRevision = variant.revision;
                member.playerEditSeq = request.editRef.seq;
                member.promptText = variant.text;
                member.editedAt = Date.now();
                group.updatedAt = member.editedAt;
                await T.branch.put(groupKey, group);
            }
            return { recoveredSessionId: session.id, recoveryOperationId: request.recoveryOperationId, replayed: result.replayed };
        });
    }
    return {
        replaceAuthorMessageText,
        confirmAuthorMessageEdit,
        nativePlayerGroupsFor,
        readOwnedEditCompletionRows,
        replaceAssistantText,
        reconcileCanonicalPlayerVariants,
        userForkContext,
        locatePlayerRecoveryTarget,
        replaceUserText,
        recoverPlayerSave,
    };
}
