// Generated from runtime/alpha3/src/ui/decision-seat.ts; edit the TypeScript source.
/** One plugin-owned root follows native composer replacement until explicit disposal. */
export function createDecisionSeat({ React, createRoot, resolveActiveSessionId, toast }) {
    function DecisionCard({ decision, decisionMinimized, onMinimize, onDismiss, fillInput, renderText }) {
        const cardRef = React.useRef(null), dragRef = React.useRef(null), offsetRef = React.useRef({ x: 0,
            y: 0 });
        const [offset, setOffset] = React.useState({ x: 0, y: 0 });
        const [viewportHeight, setViewportHeight] = React.useState(window.visualViewport?.height ?? window.innerHeight);
        const moveTo = (next) => { offsetRef.current = next; setOffset(next); };
        const keepVisible = (next) => {
            const rect = cardRef.current?.getBoundingClientRect();
            if (!rect)
                return next;
            const baseX = rect.left - offsetRef.current.x, baseY = rect.top - offsetRef.current.y;
            const view = window.visualViewport, left = view?.offsetLeft ?? 0, top = view?.offsetTop ?? 0;
            const width = view?.width ?? window.innerWidth, height = view?.height ?? window.innerHeight;
            return {
                x: Math.min(Math.max(next.x, left + 8 - baseX), left + Math.max(8, width - rect.width - 8) - baseX),
                y: Math.min(Math.max(next.y, top + 8 - baseY), top + Math.max(8, height - rect.height - 8) - baseY),
            };
        };
        const reclamp = () => {
            const next = keepVisible(offsetRef.current);
            if (next.x !== offsetRef.current.x
                || next.y !== offsetRef.current.y)
                moveTo(next);
        };
        React.useLayoutEffect(reclamp, [decisionMinimized, viewportHeight]);
        React.useEffect(() => {
            const view = window.visualViewport;
            const resize = () => { setViewportHeight(view?.height ?? window.innerHeight); reclamp(); };
            window.addEventListener('resize', resize);
            view?.addEventListener('resize', resize);
            view?.addEventListener('scroll', resize);
            return () => {
                window.removeEventListener('resize', resize);
                view?.removeEventListener('resize', resize);
                view?.removeEventListener('scroll', resize);
            };
        }, []);
        const startDrag = (e) => {
            if (e.button !== 0 || e.target?.closest?.('button,input') || e.isPrimary === false)
                return;
            e.preventDefault();
            dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, offset: offsetRef.current };
            e.currentTarget.setPointerCapture?.(e.pointerId);
        };
        const moveDrag = (e) => {
            const drag = dragRef.current;
            if (drag?.pointerId !== e.pointerId)
                return;
            moveTo(keepVisible({ x: drag.offset.x + e.clientX - drag.x, y: drag.offset.y + e.clientY - drag.y }));
        };
        const endDrag = (e) => {
            if (dragRef.current?.pointerId !== e.pointerId)
                return;
            dragRef.current = null;
            if (e.currentTarget.hasPointerCapture?.(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
        };
        const chooseCustom = (value) => { if (fillInput(String(value).trim()))
            onMinimize(true); };
        const chooseOption = (index) => chooseCustom('我选择：' + renderText(decision.options[index]?.label ?? ''));
        const chooseOptions = (indices) => chooseCustom('我选择：' + indices.map(index => renderText(decision.options[index]?.label
            ?? '')).filter(Boolean).join('、'));
        const multi = decision.multiSelect === true && Array.isArray(decision.options) && decision.options.length > 0;
        const [picked, setPicked] = React.useState([]);
        const [custom, setCustom] = React.useState('');
        const header = decision.header !== undefined && decision.header !== '' ? String(decision.header) : null;
        const question = String(decision.question ?? '');
        const title = header ?? (question !== '' ? question : '接下来做什么？');
        const cardClass = 'dsh-rp-decision-card' + (decisionMinimized ? ' dsh-rp-decision-card-minimized' : '');
        return React.createElement('div', { className: 'dsh-rp-decision-backdrop' }, React.createElement('div', {
            className: cardClass,
            ref: cardRef,
            style: {
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                '--rp-decision-visible-height': Math.max(84, viewportHeight - 16) + 'px'
            }
        }, React.createElement('div', {
            className: 'dsh-rp-decision-head',
            tabIndex: 0,
            title: '拖动决策卡；双击或按 Home 归位',
            onPointerDown: startDrag,
            onPointerMove: moveDrag,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onLostPointerCapture: () => { dragRef.current = null; },
            onDoubleClick: e => { if (!e.target?.closest?.('button,input'))
                moveTo({ x: 0, y: 0 }); },
            onKeyDown: e => {
                if (e.target !== e.currentTarget)
                    return;
                const deltas = { ArrowLeft: [-20,
                        0],
                    ArrowRight: [20,
                        0],
                    ArrowUp: [0,
                        -20],
                    ArrowDown: [0,
                        20] };
                const delta = deltas[e.key];
                if (!delta && e.key !== 'Home')
                    return;
                e.preventDefault();
                e.stopPropagation();
                moveTo(e.key === 'Home' ? { x: 0, y: 0 } : keepVisible({ x: offsetRef.current.x + delta[0], y: offsetRef.current.y + delta[1] }));
            },
        }, React.createElement('span', { className: 'dsh-rp-decision-title' }, '✦ ' + title), React.createElement('span', { className: 'dsh-rp-decision-head-actions' }, React.createElement('button', {
            type: 'button',
            className: 'dsh-rp-decision-close',
            title: decisionMinimized ? '恢复决策卡' : '最小化决策卡',
            'aria-label': decisionMinimized ? '恢复决策卡' : '最小化决策卡',
            onClick: () => {
                onMinimize(!decisionMinimized);
            },
        }, decisionMinimized ? '⌃' : '—'), React.createElement('button', {
            type: 'button',
            className: 'dsh-rp-decision-close',
            title: '稍后处理',
            'aria-label': '稍后处理',
            onClick: onDismiss
        }, '×'))), decisionMinimized ? null : React.createElement('div', { className: 'dsh-rp-decision-scroll' }, header !== null && question !== '' && question !== header
            ? React.createElement('div', { className: 'dsh-rp-decision-question' }, question)
            : null, React.createElement('div', { className: 'dsh-rp-decision-options' }, decision.options.map((o, i) => {
            const active = multi ? picked.includes(i) : false;
            return React.createElement('button', {
                key: i,
                type: 'button',
                className: 'dsh-rp-decision-option' + (active ? ' dsh-rp-decision-option-active' : ''),
                onClick: () => {
                    if (multi)
                        setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
                    else
                        chooseOption(i);
                },
            }, React.createElement('span', { className: 'dsh-rp-decision-key' }, String.fromCharCode(65 + i)), o.heart ? React.createElement('span', { className: 'dsh-rp-decision-heart' }, '❤️') : null, React.createElement('span', { className: 'dsh-rp-decision-label' }, renderText(o.label ?? ''), o.description ? React.createElement('span', { className: 'dsh-rp-decision-desc' }, renderText(o.description)) : null));
        })), multi
            ? React.createElement('button', {
                type: 'button',
                className: 'dsh-rp-decision-confirm',
                disabled: picked.length === 0,
                onClick: () => chooseOptions(picked),
            }, '填入选中行动')
            : null, React.createElement('div', { className: 'dsh-rp-decision-custom' }, React.createElement('input', {
            className: 'dsh-rp-decision-input',
            placeholder: '或输入自己的行动…',
            value: custom,
            onChange: (e) => setCustom(e.target.value),
            onKeyDown: (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!e.isComposing
                        && !e.nativeEvent?.isComposing
                        && e.keyCode !== 229
                        && custom.trim())
                        chooseCustom(custom);
                }
            },
        }), React.createElement('button', {
            type: 'button',
            className: 'dsh-rp-decision-send',
            disabled: custom.trim() === '',
            onClick: () => chooseCustom(custom),
        }, '填入输入框')))));
    }
    // One root owned by this plugin, adjacent to the live native composer.
    // Polling only updates props. Moving/replacing the composer reattaches the
    // same host/root, preserving drafts, selection and component identity.
    const decisionSeat = (() => {
        let host = null, root = null, props = null, observer = null, disposed = false;
        const editorForSeat = () => [...document.querySelectorAll('[data-composer-input]')]
            .find(editor => editor.isConnected && !editor.closest('[hidden], [aria-hidden="true"]') && editor.getClientRects().length > 0);
        const render = () => {
            const current = props;
            if (root)
                root.render(current ? React.createElement(DecisionCard, {
                    ...current,
                    key: `${current.sessionId}:${current.decision.seq}`,
                    fillInput: value => fill(value, current.sessionId),
                }) : null);
        };
        const attach = () => {
            if (disposed || !props || resolveActiveSessionId() !== props.sessionId) {
                host?.remove();
                return;
            }
            const editor = editorForSeat();
            if (!editor) {
                host?.remove();
                return;
            }
            if (!host) {
                host = document.createElement('div');
                host.className = 'dsh-rp-decision-mount';
                host.setAttribute('data-roleplay-decision-mount', '');
                root = createRoot(host);
            }
            host.setAttribute('data-session-id', props.sessionId);
            const parent = editor.closest('[data-composer-card]') ?? editor.closest('form') ?? editor.parentElement;
            const scroll = editor.closest('[data-input-scroll]');
            const anchor = scroll?.parentElement === parent ? scroll.nextSibling : parent === editor.parentElement ? editor.nextSibling : null;
            if (host.parentElement !== parent || (scroll?.parentElement === parent && scroll.nextSibling !== host))
                parent.insertBefore(host, anchor);
        };
        const fill = (raw, sessionId) => {
            const value = String(raw ?? '').trim();
            if (!value || sessionId !== props?.sessionId || sessionId !== resolveActiveSessionId())
                return false;
            const editor = editorForSeat();
            if (!editor) {
                toast('输入框尚未就绪，请稍后重试');
                return false;
            }
            try {
                editor.focus();
                if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
                    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), 'value')?.set;
                    if (!setter)
                        return false;
                    setter.call(editor, editor.value + value);
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                }
                else {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    if (!document.execCommand('insertText', false, value))
                        throw new Error('editor insertion failed');
                }
                toast('已填入输入框，可修改后发送');
                return true;
            }
            catch {
                toast('未能填入输入框，请重试');
                return false;
            }
        };
        return {
            update(next) {
                if (disposed)
                    return;
                props = next;
                if (!props) {
                    render();
                    host?.remove();
                    observer?.disconnect();
                    return;
                }
                attach();
                render();
                if (!observer)
                    observer = new MutationObserver(() => { const previous = root; attach(); if (root && !previous)
                        render(); });
                observer.observe(document.body, { childList: true, subtree: true });
            },
            dispose() { disposed = true; observer?.disconnect(); root?.unmount(); host?.remove(); },
        };
    })();
    return { DecisionCard, decisionSeat };
}
