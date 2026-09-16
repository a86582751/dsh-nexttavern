// Generated from runtime/alpha3/ui/status-surface.ts; edit the TypeScript source.
import { createRefreshScheduler } from './panel-state.js';
import { normalizeDecision, normalizePanel, normalizeOption, normalizeField, renderUserVars } from './reader-model.js';
import { statusFactsHtml, scopeHtmlStyles, decodeStatusTemplate } from './reader-rendering.js';
export function createStatusSurface({ React, createRoot, resolveActiveSessionId, isRoleplaySession, useTavernActivity, BackgroundNotesBanner, fetchState, stateVersion, subscribeState, invalidateState, applyImmersive, readImmersive, runMaintenance, toast }) {
    function DecisionCard({ decision, decisionMinimized, onMinimize, onDismiss, fillInput, renderText }) {
        const cardRef = React.useRef(null), dragRef = React.useRef(null), offsetRef = React.useRef({ x: 0, y: 0 });
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
        const reclamp = () => { const next = keepVisible(offsetRef.current); if (next.x !== offsetRef.current.x || next.y !== offsetRef.current.y)
            moveTo(next); };
        React.useLayoutEffect(reclamp, [decisionMinimized, viewportHeight]);
        React.useEffect(() => {
            const view = window.visualViewport;
            const resize = () => { setViewportHeight(view?.height ?? window.innerHeight); reclamp(); };
            window.addEventListener('resize', resize);
            view?.addEventListener('resize', resize);
            view?.addEventListener('scroll', resize);
            return () => { window.removeEventListener('resize', resize); view?.removeEventListener('resize', resize); view?.removeEventListener('scroll', resize); };
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
        const chooseOptions = (indices) => chooseCustom('我选择：' + indices.map(index => renderText(decision.options[index]?.label ?? '')).filter(Boolean).join('、'));
        const multi = decision.multiSelect === true && Array.isArray(decision.options) && decision.options.length > 0;
        const [picked, setPicked] = React.useState([]);
        const [custom, setCustom] = React.useState('');
        const header = decision.header !== undefined && decision.header !== '' ? String(decision.header) : null;
        const question = String(decision.question ?? '');
        const title = header ?? (question !== '' ? question : '接下来做什么？');
        const cardClass = 'dsh-rp-decision-card' + (decisionMinimized ? ' dsh-rp-decision-card-minimized' : '');
        return React.createElement('div', { className: 'dsh-rp-decision-backdrop' }, React.createElement('div', { className: cardClass, ref: cardRef, style: { transform: `translate(${offset.x}px, ${offset.y}px)`, '--rp-decision-visible-height': Math.max(84, viewportHeight - 16) + 'px' } }, React.createElement('div', { className: 'dsh-rp-decision-head', tabIndex: 0, title: '拖动决策卡；双击或按 Home 归位',
            onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag,
            onLostPointerCapture: () => { dragRef.current = null; },
            onDoubleClick: e => { if (!e.target?.closest?.('button,input'))
                moveTo({ x: 0, y: 0 }); },
            onKeyDown: e => {
                if (e.target !== e.currentTarget)
                    return;
                const deltas = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
                const delta = deltas[e.key];
                if (!delta && e.key !== 'Home')
                    return;
                e.preventDefault();
                e.stopPropagation();
                moveTo(e.key === 'Home' ? { x: 0, y: 0 } : keepVisible({ x: offsetRef.current.x + delta[0], y: offsetRef.current.y + delta[1] }));
            },
        }, React.createElement('span', { className: 'dsh-rp-decision-title' }, '✦ ' + title), React.createElement('span', { className: 'dsh-rp-decision-head-actions' }, React.createElement('button', {
            type: 'button', className: 'dsh-rp-decision-close',
            title: decisionMinimized ? '恢复决策卡' : '最小化决策卡',
            'aria-label': decisionMinimized ? '恢复决策卡' : '最小化决策卡',
            onClick: () => {
                onMinimize(!decisionMinimized);
            },
        }, decisionMinimized ? '⌃' : '—'), React.createElement('button', { type: 'button', className: 'dsh-rp-decision-close', title: '稍后处理', 'aria-label': '稍后处理', onClick: onDismiss }, '×'))), decisionMinimized ? null : React.createElement('div', { className: 'dsh-rp-decision-scroll' }, header !== null && question !== '' && question !== header
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
            onKeyDown: (e) => { if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (!e.isComposing && !e.nativeEvent?.isComposing && e.keyCode !== 229 && custom.trim())
                    chooseCustom(custom);
            } },
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
                    ...current, key: `${current.sessionId}:${current.decision.seq}`, fillInput: value => fill(value, current.sessionId),
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
    function StatusOverlay({ sessionId }) {
        const [state, setState] = React.useState(null);
        const [loading, setLoading] = React.useState(Boolean(sessionId || resolveActiveSessionId()));
        const [refreshing, setRefreshing] = React.useState(false);
        const refreshPanelRef = React.useRef(null);
        const [minimized, setMinimizedRaw] = React.useState(() => {
            try {
                const saved = localStorage.getItem('dsh-roleplay-ui.statusCollapsed');
                return saved === null ? true : saved === '1';
            }
            catch {
                return true;
            }
        });
        const setMinimized = (value) => {
            const next = Boolean(value);
            setMinimizedRaw(next);
            try {
                localStorage.setItem('dsh-roleplay-ui.statusCollapsed', next ? '1' : '0');
            }
            catch { }
        };
        const loadFailureRef = React.useRef({ at: 0, message: '' });
        const activeSessionId = sessionId || resolveActiveSessionId();
        const backgroundActivity = useTavernActivity(activeSessionId);
        const initialSessionLoading = Boolean(activeSessionId && isRoleplaySession(activeSessionId) && state?.sessionId !== activeSessionId);
        // 状态栏显示模式：float（悬浮窗，默认）⇄ side（左侧停靠面板）；持久化
        const [statusMode, setStatusModeRaw] = React.useState(() => {
            try {
                return localStorage.getItem('dsh-roleplay-ui.statusMode') === 'side' ? 'side' : 'float';
            }
            catch {
                return 'float';
            }
        });
        const setStatusMode = (m) => {
            setStatusModeRaw(m);
            try {
                localStorage.setItem('dsh-roleplay-ui.statusMode', m);
            }
            catch { }
        };
        React.useEffect(() => {
            const toggle = () => setStatusMode(statusMode === 'side' ? 'float' : 'side');
            window.addEventListener('dsh-roleplay-status-mode', toggle);
            return () => window.removeEventListener('dsh-roleplay-status-mode', toggle);
        }, [statusMode]);
        // 拖动 + 缩放（与小鲸鱼同款交互；位置/尺寸持久化）
        const WINDOW_PREF_KEY = 'dsh-roleplay-ui.windowPrefs';
        const loadPrefs = () => {
            try {
                return JSON.parse(localStorage.getItem(WINDOW_PREF_KEY) ?? 'null') ?? {};
            }
            catch {
                return {};
            }
        };
        const prefsRef = React.useRef(loadPrefs());
        const visiblePoint = (point, margin = 40) => point && Number.isFinite(Number(point.left)) && Number.isFinite(Number(point.top)) &&
            Number(point.left) >= 0 && Number(point.top) >= 0 && Number(point.left) <= Math.max(0, window.innerWidth - margin) && Number(point.top) <= Math.max(0, window.innerHeight - margin)
            ? { left: Number(point.left), top: Number(point.top) }
            : null;
        const storedSize = prefsRef.current.size;
        const initialSize = storedSize && Number.isFinite(Number(storedSize.w)) && Number.isFinite(Number(storedSize.h))
            ? {
                w: Math.min(Math.max(200, Number(storedSize.w)), Math.max(200, window.innerWidth - 20)),
                h: Math.min(Math.max(160, Number(storedSize.h)), Math.max(160, window.innerHeight - 20)),
            }
            : { w: 280, h: 360 };
        const [pos, setPosRaw] = React.useState(visiblePoint(prefsRef.current.pos, 60)); // {left,top} | null=默认右下
        const [size, setSizeRaw] = React.useState(initialSize);
        const badgeClampWidth = () => Math.min(260, Math.max(72, window.innerWidth - 16));
        const [badgePos, setBadgePosRaw] = React.useState(visiblePoint(prefsRef.current.badgePos, badgeClampWidth())); // {left,top} | null=右侧中下
        const posRef = React.useRef(pos);
        const sizeRef = React.useRef(size);
        const badgePosRef = React.useRef(badgePos);
        const badgeDraggedRef = React.useRef(false);
        const setPosBoth = (v) => { posRef.current = v; setPosRaw(v); };
        const setSizeBoth = (v) => { sizeRef.current = v; setSizeRaw(v); };
        const setBadgePosBoth = (v) => { badgePosRef.current = v; setBadgePosRaw(v); };
        const persistPrefs = (patch) => {
            prefsRef.current = { ...prefsRef.current, ...patch };
            try {
                localStorage.setItem(WINDOW_PREF_KEY, JSON.stringify(prefsRef.current));
            }
            catch { }
        };
        const clampGeometry = () => {
            const currentSize = sizeRef.current ?? { w: 280, h: 360 };
            const nextSize = {
                w: Math.min(Math.max(200, Number(currentSize.w) || 280), Math.max(200, window.innerWidth - 20)),
                h: Math.min(Math.max(160, Number(currentSize.h) || 360), Math.max(160, window.innerHeight - 20)),
            };
            if (nextSize.w !== currentSize.w || nextSize.h !== currentSize.h)
                setSizeBoth(nextSize);
            const currentPos = posRef.current;
            if (currentPos) {
                const nextPos = {
                    left: Math.min(Math.max(0, Number(currentPos.left) || 0), Math.max(0, window.innerWidth - Math.min(nextSize.w, 60))),
                    top: Math.min(Math.max(0, Number(currentPos.top) || 0), Math.max(0, window.innerHeight - 60)),
                };
                if (nextPos.left !== currentPos.left || nextPos.top !== currentPos.top)
                    setPosBoth(nextPos);
            }
            const currentBadge = badgePosRef.current;
            if (currentBadge) {
                const nextBadge = {
                    left: Math.min(Math.max(0, Number(currentBadge.left) || 0), Math.max(0, window.innerWidth - badgeClampWidth())),
                    top: Math.min(Math.max(0, Number(currentBadge.top) || 0), Math.max(0, window.innerHeight - 36)),
                };
                if (nextBadge.left !== currentBadge.left || nextBadge.top !== currentBadge.top)
                    setBadgePosBoth(nextBadge);
            }
            persistPrefs({ pos: posRef.current, size: sizeRef.current, badgePos: badgePosRef.current });
        };
        React.useEffect(() => {
            clampGeometry();
            const onViewportChange = () => clampGeometry();
            window.addEventListener('resize', onViewportChange);
            window.addEventListener('orientationchange', onViewportChange);
            return () => {
                window.removeEventListener('resize', onViewportChange);
                window.removeEventListener('orientationchange', onViewportChange);
            };
        }, []);
        const onHeaderPointerDown = (e) => {
            if (e.target && typeof e.target.closest === 'function' && e.target.closest('button'))
                return;
            e.preventDefault();
            const el = e.currentTarget && e.currentTarget.parentElement;
            if (!el)
                return;
            const rect = el.getBoundingClientRect();
            const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
            const move = (ev) => {
                setPosBoth({
                    left: Math.min(Math.max(0, start.left + ev.clientX - start.x), window.innerWidth - 60),
                    top: Math.min(Math.max(0, start.top + ev.clientY - start.y), window.innerHeight - 60),
                });
            };
            const up = () => {
                persistPrefs({ pos: posRef.current });
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        };
        const onResizePointerDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const start = { x: e.clientX, y: e.clientY, w: sizeRef.current.w, h: sizeRef.current.h };
            const move = (ev) => {
                setSizeBoth({
                    w: Math.min(Math.max(200, start.w + ev.clientX - start.x), window.innerWidth - 20),
                    h: Math.min(Math.max(160, start.h + ev.clientY - start.y), window.innerHeight - 20),
                });
            };
            const up = () => {
                persistPrefs({ size: sizeRef.current });
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        };
        // 最小化徽标的拖动：按住任意位置移动；位移 <4px 视为点击（恢复窗口）
        const onBadgePointerDown = (e) => {
            if (e.button !== 0)
                return;
            e.preventDefault();
            badgeDraggedRef.current = false;
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
            const move = (ev) => {
                const dx = ev.clientX - start.x;
                const dy = ev.clientY - start.y;
                if (!badgeDraggedRef.current && Math.hypot(dx, dy) < 4)
                    return;
                badgeDraggedRef.current = true;
                setBadgePosBoth({
                    left: Math.min(Math.max(0, start.left + dx), Math.max(0, window.innerWidth - rect.width - 8)),
                    top: Math.min(Math.max(0, start.top + dy), Math.max(0, window.innerHeight - rect.height - 8)),
                });
            };
            const up = () => {
                if (badgeDraggedRef.current)
                    persistPrefs({ badgePos: badgePosRef.current });
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', up);
        };
        // Dismiss only for this visit. Reload/session/view activation restores it.
        const minimizeKey = `${activeSessionId}:${state?.decision?.seq ?? ''}`;
        const [dismissedSeq, setDismissedSeq] = React.useState(-1);
        const [decisionDisplay, setDecisionDisplay] = React.useState({ key: '', minimized: true });
        const decisionMinimized = decisionDisplay.key !== minimizeKey || decisionDisplay.minimized;
        React.useEffect(() => {
            document.body.classList.toggle('rp-composer-compact', state?.sessionId === activeSessionId && state?.preset === 'roleplay');
            return () => document.body.classList.remove('rp-composer-compact');
        }, [activeSessionId, state?.sessionId, state?.preset]);
        React.useEffect(() => {
            setDismissedSeq(-1);
            const restore = () => { setDismissedSeq(-1); if (activeSessionId)
                invalidateState(activeSessionId); };
            const toggle = () => setDismissedSeq(previous => previous >= 0 ? -1 : Number(state?.decision?.seq ?? -1));
            window.addEventListener('dsh-roleplay-view-activated', restore);
            window.addEventListener('dsh-roleplay-decision-toggle', toggle);
            return () => {
                window.removeEventListener('dsh-roleplay-view-activated', restore);
                window.removeEventListener('dsh-roleplay-decision-toggle', toggle);
            };
        }, [activeSessionId, state?.decision?.seq]);
        React.useEffect(() => {
            const decision = state?.sessionId === activeSessionId && state?.preset === 'roleplay'
                ? normalizeDecision(state.decision) : null;
            if (!activeSessionId || !decision?.options?.length || decision.answered === true || decision.superseded === true ||
                Number(decision.seq) <= dismissedSeq) {
                decisionSeat.update(null);
                return;
            }
            decisionSeat.update({
                sessionId: activeSessionId, decision, decisionMinimized,
                renderText: text => renderUserVars(text, state),
                onMinimize: next => {
                    setDecisionDisplay({ key: minimizeKey, minimized: next });
                },
                onDismiss: () => {
                    setDismissedSeq(Number(decision.seq));
                },
            });
        }, [activeSessionId, state, dismissedSeq, decisionMinimized, minimizeKey]);
        React.useEffect(() => () => decisionSeat.update(null), [activeSessionId]);
        React.useEffect(() => {
            // A StatusOverlay instance can outlive the active conversation. Drop the
            // previous session synchronously so its decision card cannot leak into
            // the next conversation while the new state request is in flight.
            setState(null);
            setLoading(Boolean(activeSessionId));
            if (!activeSessionId)
                return;
            let alive = true;
            const requestedSessionId = activeSessionId;
            let scheduler = null;
            const load = async (manual = false) => {
                // fetchState also shares the REST request, while this guard prevents
                // invalidation and the timer from creating duplicate UI work.
                if (!alive)
                    return;
                const requestEpoch = stateVersion(requestedSessionId);
                if (!isRoleplaySession(requestedSessionId)) {
                    if (alive) {
                        setState(null);
                        setLoading(false);
                    }
                    return;
                }
                if (!manual && typeof document !== 'undefined' && document.hidden)
                    return;
                if (manual)
                    setRefreshing(true);
                try {
                    const d = await fetchState(requestedSessionId, true);
                    if (!alive)
                        return;
                    if (stateVersion(requestedSessionId) !== requestEpoch) {
                        scheduler?.request();
                        return;
                    }
                    if (d?.sessionId !== requestedSessionId) {
                        setState(null);
                        return;
                    }
                    if (d?.preset === 'roleplay')
                        applyImmersive(readImmersive());
                    loadFailureRef.current = { at: 0, message: '' };
                    setLoading(false);
                    setState(d);
                }
                catch (error) {
                    if (!alive)
                        return;
                    const message = String(error && typeof error === 'object' && 'message' in error ? error.message : error);
                    const now = Date.now();
                    const previous = loadFailureRef.current;
                    // Keep the last good panel during a transient reconnect and avoid a
                    // new toast every five seconds. A changed error, or 30 seconds of
                    // continued failure, is enough to surface one concise warning.
                    if (message !== previous.message || now - previous.at >= 30000) {
                        loadFailureRef.current = { at: now, message };
                        toast('状态栏暂时无法刷新：' + message);
                    }
                }
                finally {
                    if (alive && manual)
                        setRefreshing(false);
                }
            };
            scheduler = createRefreshScheduler(() => load());
            refreshPanelRef.current = async (manual = false) => { if (manual)
                await load(true);
            else
                scheduler?.request(); };
            scheduler.request();
            const unsubscribe = subscribeState(requestedSessionId, () => scheduler.request());
            const onVisible = () => { if (!document.hidden)
                scheduler?.request(); };
            document.addEventListener('visibilitychange', onVisible);
            const timer = setInterval(() => scheduler.request(), 30000);
            return () => { alive = false; refreshPanelRef.current = null; unsubscribe(); scheduler.close(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
        }, [activeSessionId]);
        React.useEffect(() => {
            if (activeSessionId && backgroundActivity?.sessionId === activeSessionId)
                invalidateState(activeSessionId);
        }, [activeSessionId, backgroundActivity?.storySeq, backgroundActivity?.stage, backgroundActivity?.running]);
        const currentState = state?.sessionId === activeSessionId && state?.preset === 'roleplay' ? state : null;
        if (!activeSessionId || !isRoleplaySession(activeSessionId) || (!currentState && !loading && !initialSessionLoading))
            return null;
        const renderLoadingBody = () => React.createElement('div', { className: 'dsh-rp-status-empty', role: 'status', 'aria-live': 'polite' }, '状态栏更新中…');
        if (!currentState) {
            const loadingTitle = '状态栏更新中…';
            const loadingMain = statusMode === 'side' && !minimized
                ? React.createElement('div', { className: 'dsh-rp-status-dock' }, React.createElement('div', { className: 'dsh-rp-status-dock-head' }, React.createElement('span', { className: 'dsh-rp-status-title' }, loadingTitle)), renderLoadingBody())
                : minimized
                    ? React.createElement('div', { className: 'dsh-rp-status-badge', role: 'status', 'aria-live': 'polite' }, React.createElement('span', { className: 'dsh-rp-status-badge-icon' }, '✦'), React.createElement('span', { className: 'dsh-rp-status-badge-label' }, loadingTitle), React.createElement('span', { className: 'dsh-rp-status-badge-dot' }))
                    : React.createElement('div', { className: 'dsh-rp-status-window', style: { width: size.w, height: size.h, ...(pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : {}) } }, React.createElement('div', { className: 'dsh-rp-status-head', onPointerDown: onHeaderPointerDown }, React.createElement('span', { className: 'dsh-rp-status-title' }, loadingTitle), React.createElement('button', { type: 'button', className: 'dsh-rp-status-min', title: '最小化', onClick: () => setMinimized(true) }, '—')), renderLoadingBody(), React.createElement('div', { className: 'dsh-rp-status-resize', onPointerDown: onResizePointerDown, title: '拖动调整大小' }));
            return React.createElement(React.Fragment, null, loadingMain);
        }
        const panel = normalizePanel(currentState.statusPanel);
        // 状态栏渲染模版：确定性替换 {{user}} / {{user_gender}}（优先级：用户信息
        // → 玩家角色卡 → 兜底「用户」），覆盖标题/字段名/字段值/html 渲染
        // 路径——不依赖模型写出真实名字；模型只需保留占位符。
        const renderVars = (text) => renderUserVars(text, state);
        const rules = Array.isArray(currentState.statusSpec?.regexRules) ? currentState.statusSpec.regexRules : [];
        const applyRules = (text) => {
            let out = renderVars(text);
            for (const r of rules) {
                try {
                    out = out.replace(new RegExp(r.match, 'g'), r.replace ?? '');
                }
                catch { }
            }
            return out;
        };
        // 面板 HTML：只改写 <style> 内的 CSS，绝不把整段 HTML 当 CSS 解析；
        // 这样不会破坏标签，也不会把作用域选择器泄漏成可见文本。
        const statusAuthorRoots = [
            '.dsh-rp-status-window .dsh-rp-status-author',
            '.dsh-rp-status-dock .dsh-rp-status-author',
        ];
        const options = Array.isArray(panel?.options) ? panel.options.map(normalizeOption).map(option => ({ ...option, label: applyRules(option.label) })) : [];
        const html = panel?.html
            ? statusFactsHtml(applyRules(scopeHtmlStyles(decodeStatusTemplate(panel.html), statusAuthorRoots)), options)
            : '';
        const fields = Array.isArray(panel?.fields) ? panel.fields.map(normalizeField) : [];
        // 面板正文只显示状态；建议统一由独立决策卡展示。
        const renderPanelBody = () => !panel
            ? React.createElement('div', { className: 'dsh-rp-status-empty', role: 'status' }, React.createElement('span', null, '当前分支暂无状态栏内容'), React.createElement('button', {
                type: 'button', className: 'dsh-rp-status-option', disabled: refreshing,
                onClick: async () => {
                    setRefreshing(true);
                    try {
                        await runMaintenance(activeSessionId, 'status-rebuild');
                        await refreshPanelRef.current?.(true);
                    }
                    catch (error) {
                        toast('状态栏生成失败：' + String(error && typeof error === 'object' && 'message' in error ? error.message : error));
                    }
                    finally {
                        setRefreshing(false);
                    }
                },
            }, refreshing ? '刷新中…' : '刷新状态栏'))
            : React.createElement(React.Fragment, null, panel.stale === true || currentState.statusPanel?.stale === true
                ? React.createElement('div', { className: 'dsh-rp-status-stale', role: 'status' }, '剧情已修改，状态栏待更新')
                : null, React.createElement('div', { className: 'dsh-rp-status-author' }, html
                ? React.createElement('div', {
                    className: 'dsh-rp-status-html',
                    ref: (element) => {
                        if (!element)
                            return;
                        const roots = Array.from(element.children).filter(child => !['STYLE', 'SCRIPT'].includes(child.tagName));
                        for (const child of Array.from(element.children))
                            child.removeAttribute('data-dsh-status-fill-root');
                        if (roots.length === 1 && ['DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'MAIN'].includes(roots[0].tagName))
                            roots[0].setAttribute('data-dsh-status-fill-root', '');
                    },
                    dangerouslySetInnerHTML: { __html: html },
                })
                : null, !html && fields.length
                ? fields.map((f, i) => React.createElement('div', { key: i, className: 'dsh-rp-status-field' }, React.createElement('span', { className: 'dsh-rp-status-emoji' }, f.emoji ?? ''), ' ', React.createElement('span', null, f.label ? renderVars(f.label) + '：' : '', applyRules(f.value))))
                : null));
        let main = null;
        // Keep the mode control mounted even while a malformed/empty panel is
        // being repaired; the user must still be able to switch modes.
        if (statusMode === 'side' && !minimized) {
            // 侧边停靠：固定在视口左侧的通栏面板（覆盖应用侧栏区域，随时可切回）
            main = React.createElement('div', { className: 'dsh-rp-status-dock' }, React.createElement('div', { className: 'dsh-rp-status-dock-head' }, React.createElement('span', { className: 'dsh-rp-status-title' }, applyRules(panel?.title || '状态栏')), React.createElement('button', { type: 'button', className: 'dsh-rp-status-min', title: '折叠状态栏', 'aria-label': '折叠状态栏', onClick: () => setMinimized(true) }, React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, React.createElement('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }), React.createElement('path', { d: 'M8 4v16' }), React.createElement('path', { d: 'm14 9 3 3-3 3' })))), renderPanelBody());
        }
        else if (minimized) {
            const badgeLabel = applyRules(String(panel?.title || '状态栏')).slice(0, 12);
            main = React.createElement('div', {
                className: 'dsh-rp-status-badge',
                role: 'button',
                tabIndex: 0,
                'aria-expanded': 'false',
                title: '恢复状态栏（可拖动）',
                style: badgePos ? { left: badgePos.left, top: badgePos.top, right: 'auto', bottom: 'auto' } : undefined,
                onPointerDown: onBadgePointerDown,
                onKeyDown: (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setMinimized(false);
                    }
                },
                onClick: () => {
                    if (badgeDraggedRef.current) {
                        badgeDraggedRef.current = false;
                        return;
                    }
                    setMinimized(false);
                },
            }, React.createElement('span', { className: 'dsh-rp-status-badge-icon' }, '✦'), React.createElement('span', { className: 'dsh-rp-status-badge-label' }, badgeLabel), React.createElement('span', { className: 'dsh-rp-status-badge-dot' }));
        }
        else {
            main = React.createElement('div', {
                className: 'dsh-rp-status-window',
                style: {
                    width: size.w,
                    height: size.h,
                    ...(pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : {}),
                },
            }, React.createElement('div', { className: 'dsh-rp-status-head', onPointerDown: onHeaderPointerDown }, React.createElement('span', { className: 'dsh-rp-status-title' }, applyRules(panel?.title || '状态栏')), React.createElement('button', { type: 'button', className: 'dsh-rp-status-min', title: '最小化', onClick: () => setMinimized(true) }, '—')), renderPanelBody(), React.createElement('div', { className: 'dsh-rp-status-resize', onPointerDown: onResizePointerDown, title: '拖动调整大小' }));
        }
        return React.createElement(React.Fragment, null, main, React.createElement(BackgroundNotesBanner, { activity: backgroundActivity, sessionId: activeSessionId }));
    }
    return { DecisionCard, decisionSeat, StatusOverlay };
}
