// Generated from runtime/alpha3/ui/message-actions.ts; edit the TypeScript source.
export function createMessageActionComponents({ React, isRoleplaySession, fetchState, subscribeState, invalidateState, applyImmersive, readImmersive, toast, confirmWithDialog, runCommand, replaceMessage, forkAndPrompt, forkWithoutUserTurn, openNativeBranch, retryBranchMutation }) {
    const ICONS = {
        regenerate: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8' }), React.createElement('path', { d: 'M21 3v5h-5' })),
        download: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }), React.createElement('polyline', { points: '7 10 12 15 17 10' }), React.createElement('line', { x1: 12, y1: 15, x2: 12, y2: 3 })),
        edit: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M12 20h9' }), React.createElement('path', { d: 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' })),
        trash: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M3 6h18' }), React.createElement('path', { d: 'M8 6V4h8v2' }), React.createElement('path', { d: 'M19 6l-1 14H6L5 6' }), React.createElement('path', { d: 'M10 11v5M14 11v5' })),
        removeTurn: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h7' }), React.createElement('path', { d: 'm16 5 5 5M21 5l-5 5' })),
        chevronLeft: React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('polyline', { points: '15 18 9 12 15 6' })),
        chevronRight: React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('polyline', { points: '9 18 15 12 9 6' })),
        copy: React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }), React.createElement('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })),
    };
    const actionIconButton = (title, icon, onClick, extra = {}) => React.createElement('button', { type: 'button', className: 'dsh-rp-icon-btn', title, 'aria-label': title, onClick, ...extra }, icon);
    function MessageEditor({ title, initialText, allowSend = false, busy = false, onClose, onSave, onSend }) {
        const [text, setText] = React.useState(String(initialText ?? ''));
        const dialogRef = React.useRef(null);
        React.useEffect(() => setText(String(initialText ?? '')), [initialText]);
        React.useLayoutEffect(() => {
            // Native conversation ancestors establish their own stacking context.
            // Enter the browser top layer so author status overlays cannot intercept
            // editing, saving or sending; native modality also contains keyboard focus.
            const dialog = dialogRef.current;
            if (dialog && !dialog.open)
                dialog.showModal();
            return () => { if (dialog?.open)
                dialog.close(); };
        }, []);
        const ready = text.trim().length > 0 && !busy;
        return React.createElement('dialog', {
            className: 'dsh-rp-edit-backdrop',
            ref: dialogRef,
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': title,
            onCancel: (event) => { event.preventDefault(); if (!busy)
                onClose(); },
            onMouseDown: (event) => { if (event.target === event.currentTarget && !busy)
                onClose(); },
        }, React.createElement('div', { className: 'dsh-rp-edit-card' }, React.createElement('div', { className: 'dsh-rp-edit-title' }, title), React.createElement('textarea', {
            className: 'dsh-rp-edit-textarea', value: text, autoFocus: true, disabled: busy,
            onChange: (event) => setText(event.target.value),
            onKeyDown: (event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && ready)
                    onSave(text.trim());
            },
        }), React.createElement('div', { className: 'dsh-rp-edit-buttons' }, React.createElement('span', { className: 'dsh-rp-edit-hint' }, allowSend
            ? '保存：原地修改；发送：新建玩家分支并生成剧情'
            : '保存只修改当前 Agent 回复，不调用模型'), React.createElement('button', { type: 'button', className: 'dsh-rp-edit-action', disabled: busy, onClick: onClose }, '取消'), React.createElement('button', { type: 'button', className: 'dsh-rp-edit-action', disabled: !ready, onClick: () => onSave(text.trim()) }, '保存'), allowSend
            ? React.createElement('button', { type: 'button', className: 'dsh-rp-edit-action', 'data-primary': 'true', disabled: !ready, onClick: () => onSend(text.trim()) }, '发送')
            : null)));
    }
    function useRoleplayState(sessionId) {
        const [state, setState] = React.useState(() => isRoleplaySession(sessionId) ? null : { preset: 'other' });
        const [revision, setRevision] = React.useState(0);
        const reload = React.useCallback(async () => {
            if (!isRoleplaySession(sessionId))
                return { preset: 'other' };
            const data = await fetchState(sessionId, true);
            setState(data);
            return data;
        }, [sessionId]);
        React.useEffect(() => {
            if (!sessionId || !isRoleplaySession(sessionId)) {
                setState({ preset: 'other' });
                return;
            }
            let alive = true;
            fetchState(sessionId).then((data) => {
                if (!alive)
                    return;
                if (data?.preset === 'roleplay')
                    applyImmersive(readImmersive());
                setState(data);
            }).catch(() => { if (alive)
                setState({ preset: 'other' }); });
            const unsubscribe = subscribeState(sessionId, () => {
                if (alive)
                    setRevision((value) => value + 1);
            });
            return () => { alive = false; unsubscribe(); };
        }, [sessionId]);
        React.useEffect(() => {
            if (!sessionId || !isRoleplaySession(sessionId) || revision === 0)
                return;
            let alive = true;
            fetchState(sessionId, true).then((data) => {
                if (alive)
                    setState(data);
            }).catch(() => { });
            return () => { alive = false; };
        }, [sessionId, revision]);
        return [state, reload];
    }
    function UserActions(props) {
        const sessionId = props.sessionId;
        const seq = Number(props.seq);
        const initialText = String(props.text ?? '');
        const [state, reload] = useRoleplayState(sessionId);
        const [busy, setBusy] = React.useState(false);
        const [editing, setEditing] = React.useState(false);
        if (state === null || state?.preset !== 'roleplay')
            return React.createElement('span');
        const info = state?.userActionsBySeq?.[String(seq)] ?? null;
        const deleted = Array.isArray(state?.deletedBranchMessageIds) &&
            state.deletedBranchMessageIds.includes(String(info?.assistantMessageId ?? ''));
        if (deleted)
            return React.createElement('span', { className: 'dsh-rp-deleted' }, '此剧情版本已删除（只读）');
        const group = info?.group ?? null;
        const members = Array.isArray(group?.members) ? group.members : [];
        const currentIndex = group ? Math.max(0, Number(group.currentOrdinal) - 1) : -1;
        const perform = async (operation) => {
            if (busy)
                return;
            setBusy(true);
            try {
                await operation();
            }
            catch (error) {
                toast(String(error && typeof error === 'object' && 'message' in error ? error.message : error));
            }
            finally {
                setBusy(false);
            }
        };
        const editor = editing ? React.createElement(MessageEditor, {
            title: '修改玩家消息', initialText, allowSend: true, busy,
            onClose: () => { if (!busy)
                setEditing(false); },
            onSave: (text) => perform(async () => {
                await replaceMessage({ sessionId, role: 'user', seq, text });
                setEditing(false);
                await reload();
                toast('已保存到当前玩家分支；Agent 回复保持不变');
            }),
            onSend: (text) => perform(async () => {
                setEditing(false);
                await forkAndPrompt({
                    sourceSessionId: sessionId,
                    messageId: info?.assistantMessageId,
                    userSeq: seq,
                    kind: 'player-edit',
                    editedText: text,
                });
            }),
        }) : null;
        return React.createElement(React.Fragment, null, React.createElement('span', { className: 'dsh-rp-actions' }, group && members.length > 0 ? [
            actionIconButton('上一个玩家消息分支', ICONS.chevronLeft, () => perform(() => openNativeBranch(members[currentIndex - 1])), { key: 'upl', disabled: busy || currentIndex <= 0 }),
            React.createElement('span', { key: 'upp', className: 'dsh-rp-pager', title: '玩家消息分支' }, `${currentIndex + 1}/${members.length}`),
            actionIconButton('下一个玩家消息分支', ICONS.chevronRight, () => perform(() => openNativeBranch(members[currentIndex + 1])), { key: 'upr', disabled: busy || currentIndex < 0 || currentIndex >= members.length - 1 }),
        ] : null, actionIconButton('修改玩家消息', ICONS.edit, () => setEditing(true), { disabled: busy || !Number.isSafeInteger(seq) }), actionIconButton('删除这条玩家消息及其全部后续内容', ICONS.removeTurn, () => perform(async () => {
            if (!info?.assistantMessageId)
                throw new Error('这条玩家消息尚无可安全截断的回复锚点');
            if (!await confirmWithDialog(document, '从这里截断当前剧情？这条玩家消息及全部后续内容不会进入新分支；原始审计日志仍可恢复。', { title: '截断当前剧情', confirmLabel: '确认截断' }))
                return;
            await forkWithoutUserTurn({ sourceSessionId: sessionId, messageId: info.assistantMessageId });
        }), { disabled: busy || !info?.assistantMessageId })), editor);
    }
    function AssistantActions(props) {
        const sessionId = props.sessionId;
        const [state, reload] = useRoleplayState(sessionId);
        // Official error tails lack a closing message. A completed story before
        // failed maintenance still owns its ordinary regenerate/version actions.
        const anchor = state?.assistantActionAnchorsByTurn?.[String(props.turn)];
        const messageId = String(props.messageId || anchor?.messageId || '');
        const initialText = String(props.text || (anchor && state?.surfaceNodes?.find(node => node.seq === anchor.seq)?.text) || '');
        const [busy, setBusy] = React.useState(false);
        const [editing, setEditing] = React.useState(false);
        // 非 roleplay 会话：不渲染任何按钮（普通模式保持原版外观）
        if (state === null || state?.preset !== 'roleplay') {
            return React.createElement('span');
        }
        if (state?.internalAssistantMessageIds?.includes(String(props.messageId ?? ''))
            || state?.internalMaintenanceTurns?.includes(Number(props.turn)))
            return React.createElement('span');
        const validRecoverySeq = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
        const stateRecoverySeq = state?.failedTurnRecoveryByTurn?.[String(props.turn)];
        const recoverySeq = validRecoverySeq(stateRecoverySeq) ? stateRecoverySeq : null;
        const recoveryAvailable = recoverySeq !== null;
        const failureGroup = recoveryAvailable ? state?.failedTurnBranchGroupByTurn?.[String(props.turn)] ?? null : null;
        const group = failureGroup ?? state?.branchGroupsByMessageId?.[messageId] ?? null;
        const deleted = !recoveryAvailable && Array.isArray(state?.deletedBranchMessageIds) && state.deletedBranchMessageIds.includes(messageId);
        if (deleted)
            return React.createElement('span', { className: 'dsh-rp-deleted' }, '此回复版本已删除（只读）');
        const inherited = Array.isArray(state?.inheritedAssistantMessageIds) && state.inheritedAssistantMessageIds.includes(messageId);
        const members = Array.isArray(group?.members) ? group.members : [];
        const currentIndex = group ? Math.max(0, Number(group.currentOrdinal) - 1) : -1;
        const perform = async (operation) => {
            if (busy)
                return;
            setBusy(true);
            try {
                await operation();
            }
            catch (error) {
                toast(String(error && typeof error === 'object' && 'message' in error ? error.message : error));
            }
            finally {
                setBusy(false);
            }
        };
        const editor = editing ? React.createElement(MessageEditor, {
            title: '直接修改当前 Agent 回复', initialText, busy,
            onClose: () => { if (!busy)
                setEditing(false); },
            onSave: (text) => perform(async () => {
                await replaceMessage({ sessionId, role: 'assistant', messageId, text });
                setEditing(false);
                await reload();
                toast('已保存当前 Agent 回复，不调用模型');
            }),
        }) : null;
        return React.createElement(React.Fragment, null, React.createElement('span', { className: 'dsh-rp-actions' }, group && members.length > 0
            ? [
                actionIconButton('上一版 Agent 回复', ICONS.chevronLeft, () => perform(() => openNativeBranch(members[currentIndex - 1])), { disabled: busy || currentIndex <= 0 }),
                React.createElement('span', { key: 'p', className: 'dsh-rp-pager' }, `${currentIndex + 1}/${members.length}`),
                actionIconButton('下一版 Agent 回复', ICONS.chevronRight, () => perform(() => openNativeBranch(members[currentIndex + 1])), { disabled: busy || currentIndex < 0 || currentIndex >= members.length - 1 }),
            ]
            : null, actionIconButton(recoveryAvailable ? '恢复失败轮次并生成 Agent 回复' : '重新生成 Agent 回复', ICONS.regenerate, () => {
            perform(() => forkAndPrompt({ sourceSessionId: sessionId, messageId: recoveryAvailable ? undefined : messageId || undefined, userSeq: recoveryAvailable ? recoverySeq : undefined, kind: 'regenerate' }));
        }, { disabled: busy || (!messageId && !recoveryAvailable) }), actionIconButton(inherited ? '请先切换到该版本所属会话再编辑' : '直接修改当前 Agent 回复', ICONS.edit, () => setEditing(true), { disabled: busy || recoveryAvailable || inherited || !messageId || !initialText }), actionIconButton(group && members.length > 1 ? '删除当前回复分支' : '至少生成两个版本后才能删除', ICONS.trash, () => {
            perform(async () => {
                if (recoveryAvailable || !group || members.length <= 1)
                    return;
                if (!await confirmWithDialog(document, `删除当前第 ${currentIndex + 1}/${members.length} 个回复分支？原始审计日志仍会保留。`, { title: '删除回复分支', confirmLabel: '确认删除' }))
                    return;
                const result = await retryBranchMutation({ action: 'delete', sessionId, messageId });
                invalidateState(sessionId);
                await openNativeBranch({ sessionId: result.nextSessionId });
            });
        }, { disabled: busy || recoveryAvailable || !group || members.length <= 1 }), actionIconButton('导出小说稿', ICONS.download, () => runCommand(sessionId, '/export-novel llm'))), editor);
    }
    return { ICONS, actionIconButton, MessageEditor, useRoleplayState, UserActions, AssistantActions };
}
export function createToastController(documentRef) {
    let timer = null;
    let current = null;
    const dismiss = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        current?.remove?.();
        current = null;
    };
    const managerHost = () => {
        const dialogs = [...documentRef.querySelectorAll?.('dialog.dsh-rp-dialog[open]') ?? []];
        return dialogs.findLast?.(dialog => {
            try {
                return dialog.matches?.(':modal');
            }
            catch {
                return false;
            }
        }) ?? dialogs.at(-1) ?? documentRef.body;
    };
    const toast = (text) => {
        if (!documentRef?.body)
            return;
        dismiss();
        const el = documentRef.createElement('div');
        el.className = 'dsh-rp-toast';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.textContent = String(text ?? '');
        managerHost().appendChild(el);
        current = el;
        timer = setTimeout(dismiss, 2600);
    };
    toast.dismiss = dismiss;
    return toast;
}
export function confirmWithDialog(documentRef, message, { title = '请确认', confirmLabel = '确认', cancelLabel = '取消' } = {}) {
    return new Promise(resolve => {
        const dialog = documentRef.createElement('dialog');
        dialog.className = 'dsh-rp-confirm-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', title);
        const heading = documentRef.createElement('strong');
        heading.textContent = title;
        const content = documentRef.createElement('p');
        content.textContent = String(message ?? '');
        const actions = documentRef.createElement('div');
        actions.className = 'dsh-rp-confirm-actions';
        const cancel = documentRef.createElement('button');
        cancel.type = 'button';
        cancel.className = 'dsh-rp-btn';
        cancel.textContent = cancelLabel;
        const confirm = documentRef.createElement('button');
        confirm.type = 'button';
        confirm.className = 'dsh-rp-btn dsh-rp-primary';
        confirm.dataset.confirm = 'true';
        confirm.textContent = confirmLabel;
        actions.append(cancel, confirm);
        dialog.append(heading, content, actions);
        documentRef.body.appendChild(dialog);
        let settled = false;
        const finish = (value) => {
            if (settled)
                return;
            settled = true;
            dialog.removeEventListener('cancel', onCancel);
            dialog.removeEventListener('close', onClose);
            if (dialog.open && typeof dialog.close === 'function')
                dialog.close();
            dialog.remove();
            resolve(value);
        };
        const onCancel = (event) => { event.preventDefault(); finish(false); };
        const onClose = () => finish(dialog.returnValue === 'confirm');
        dialog.addEventListener('cancel', onCancel);
        dialog.addEventListener('close', onClose);
        cancel.addEventListener('click', () => finish(false));
        confirm.addEventListener('click', () => finish(true));
        if (typeof dialog.showModal === 'function')
            dialog.showModal();
        else {
            dialog.open = true;
            dialog.setAttribute('open', '');
        }
    });
}
