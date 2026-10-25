// Generated from runtime/alpha3/src/ui/side-chat.ts; edit the TypeScript source.
import { buildReasoningEffortOptions } from './settings-projection.js';
const failure = (error) => error instanceof Error ? error.message : String(error);
/** A retained native Session owns transport and history; this surface owns only its presentation. */
export function createSideChat({ React, Menu, sessions, jsonFetch, confirm }) {
    const h = React.createElement;
    let opened = false;
    let position = null;
    let size = null;
    let maximized = false;
    const listeners = new Set();
    const setOpen = (value) => {
        opened = value;
        for (const notify of listeners)
            notify();
    };
    const subscribe = (notify) => { listeners.add(notify); return () => { listeners.delete(notify); }; };
    const getSnapshot = () => opened;
    const useOpen = () => React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const icon = (name) => h('svg', {
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
        strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
    }, h('path', { d: {
            close: 'M6 6l12 12M6 18 18 6',
            reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
            maximize: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
            restore: 'M8 4h12v12M4 8h12v12H4Z',
            resize: 'M8 18 18 8M13 18l5-5',
            send: 'm5 12 7-7 7 7M12 5v15',
            stop: 'M6 6h12v12H6z',
            model: 'M7 3h10l4 9-4 9H7l-4-9ZM3 12h18M7 3l5 9-5 9M17 3l-5 9 5 9',
            thinking: 'M9 18h6M9 21h6M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z',
            permission: 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6ZM9 12l2 2 4-4',
        }[name] }));
    const action = (label, name, onClick, disabled = false) => h('button', {
        type: 'button', className: 'dsh-rp-side-icon', 'aria-label': label, title: label, onClick, disabled,
    }, icon(name));
    const request = (sessionId, action, body = {}) => jsonFetch('/api/roleplay/side-chat', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, action, ...body }),
    });
    function Selector({ label, title, value, name, items, selectedId, disabled, onSelect, className = '' }) {
        const [open, setOpen] = React.useState(false);
        return h(Menu, { open, items, selectedId, side: 'top', portal: true, compact: true,
            className: 'dsh-rp-side-picker ' + className, listClassName: 'dsh-rp-side-picker-menu',
            onClose: () => setOpen(false), onSelect: id => { setOpen(false); onSelect(id); },
            anchor: h('button', { type: 'button', className: 'dsh-rp-side-chip', title,
                'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': open, disabled,
                onClick: () => setOpen(value => !value) }, icon(name), h('span', { className: 'dsh-rp-side-chip-value' }, value), h('svg', { className: 'dsh-rp-side-chip-chevron', viewBox: '0 0 16 16', fill: 'none',
                stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true }, h('path', { d: 'm5 6 3 3 3-3' }))) });
    }
    function Composer({ binding, controls, pending, content }) {
        const session = binding.session;
        const state = React.useSyncExternalStore(notify => session.subscribe(notify), () => session.getSnapshot(), () => session.getSnapshot());
        const [text, setText] = React.useState('');
        const [sending, setSending] = React.useState(false);
        const [error, setError] = React.useState('');
        const input = React.useRef(null);
        React.useEffect(() => { if (!pending)
            input.current?.focus(); }, [pending]);
        const send = async () => {
            const prompt = text.trim();
            if (!prompt || sending || state.running)
                return;
            setSending(true);
            setError('');
            const submission = session.beginSubmission({ mode: 'queue', text: prompt, attachments: [] });
            setText('');
            if (input.current)
                input.current.style.height = 'auto';
            try {
                const result = await session.prompt([{ type: 'text', text: prompt }], 'queue', undefined, submission.requestId);
                if (!result.ok)
                    throw new Error(result.error?.message ?? '发送失败');
            }
            catch (error) {
                submission.abandon();
                setText(current => current || prompt);
                setError(failure(error));
            }
            finally {
                setSending(false);
            }
        };
        const stop = async () => {
            try {
                const result = await session.cancel();
                if (!result.ok)
                    throw new Error(result.error?.message ?? '停止失败');
            }
            catch (error) {
                setError(failure(error));
            }
        };
        return h(React.Fragment, null, h('div', { className: 'dsh-rp-side-native' + (pending ? ' dsh-rp-side-native-pending' : '') }, content), error ? h('div', { className: 'dsh-rp-side-error', role: 'alert' }, error) : null, pending ? null : h('form', { className: 'dsh-rp-side-composer', onSubmit: (event) => { event.preventDefault(); void send(); } }, h('div', { className: 'dsh-rp-side-input-row' }, h('textarea', { ref: input, rows: 1, value: text, 'aria-label': '侧聊消息', placeholder: '试试改人物设定、修状态栏、排查报错，或讨论剧情下一步',
            onChange: (event) => {
                setText(event.target.value);
                event.target.style.height = 'auto';
                event.target.style.height = Math.min(event.target.scrollHeight, 132) + 'px';
            }, onKeyDown: (event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send();
                }
            } }), state.running ? action('停止回复', 'stop', () => void stop())
            : h('button', { type: 'submit', className: 'dsh-rp-side-send', 'aria-label': '发送消息', disabled: sending || !text.trim() }, icon('send'))), controls));
    }
    const EmptyNativeView = () => null;
    function NativeViews({ renderSlot, useSession }) {
        const blank = useSession(state => state.blank && !state.running && state.pendingSubmissions.length === 0);
        return blank ? h('div', { className: 'dsh-rp-side-empty' }, h('p', null, '想聊点什么？'))
            : renderSlot('conversation.session', { view: 'chat' });
    }
    function Session({ binding, controls, sessionId, useSessionStatus, renderFactorySlot }) {
        const pending = useSessionStatus(snapshot => snapshot.get(sessionId)?.pendingInteraction);
        // The factory is the sole owner of conversation.session. Its local Views
        // component inherits that render share; the side-chat registration must not
        // redeclare this global slot. Keep one native scroll/approval tree resident.
        const content = renderFactorySlot('conversation.content', {
            variant: 'embedded', phase: 'active', hero: false,
        }, { slots: { views: NativeViews, widthControls: EmptyNativeView } });
        return h(Composer, { binding, controls, pending: !!pending, content });
    }
    function NativeView({ sessionId, controls, scope }) {
        const [ready, setReady] = React.useState(null);
        const [error, setError] = React.useState('');
        React.useEffect(() => {
            let active = true;
            const reference = sessions.retain(sessionId, { source: 'nexttavernSideChat' });
            void reference.ready.then(binding => { if (active)
                setReady({ binding, reference }); }, error => { if (active)
                setError(failure(error)); });
            return () => { active = false; reference.release(); };
        }, [sessionId]);
        if (error)
            return h('div', { className: 'dsh-rp-side-error', role: 'alert' }, error);
        return ready ? h(scope.SessionProvider, { session: ready.reference }, scope.renderSession(ready.binding, controls))
            : h('div', { className: 'dsh-rp-side-loading', role: 'status' }, '正在连接侧聊…');
    }
    function usePanelGeometry(panel) {
        const [isMaximized, setIsMaximized] = React.useState(maximized);
        const drag = React.useRef(null);
        const viewport = () => {
            const view = window.visualViewport;
            return { left: (view?.offsetLeft ?? 0) + 8, top: (view?.offsetTop ?? 0) + 8,
                width: Math.max(0, (view?.width ?? window.innerWidth) - 16),
                height: Math.max(0, (view?.height ?? window.innerHeight) - 16) };
        };
        const writePosition = (next) => {
            position = next;
            Object.assign(panel.current.style, { left: next.left + 'px', top: next.top + 'px', right: 'auto', bottom: 'auto' });
        };
        const writeSize = (next) => {
            size = next;
            Object.assign(panel.current.style, { width: next.width + 'px', height: next.height + 'px' });
        };
        const showMaximized = (view) => {
            // Normal geometry stays untouched, including its default CSS anchors.
            Object.assign(panel.current.style, { left: view.left + 'px', top: view.top + 'px', right: 'auto', bottom: 'auto',
                width: view.width + 'px', height: view.height + 'px', maxWidth: view.width + 'px', maxHeight: view.height + 'px' });
        };
        const measure = () => {
            const view = viewport();
            const element = panel.current;
            element.style.maxWidth = view.width + 'px';
            element.style.maxHeight = view.height + 'px';
            return { view, rect: element.getBoundingClientRect() };
        };
        const clampPosition = (next, box, view) => ({
            left: Math.min(view.left + view.width - box.width, Math.max(view.left, next.left)),
            top: Math.min(view.top + view.height - box.height, Math.max(view.top, next.top)),
        });
        const clampSize = (next, origin, view) => {
            const width = view.left + view.width - origin.left, height = view.top + view.height - origin.top;
            return { width: Math.min(width, Math.max(Math.min(320, width), next.width)),
                height: Math.min(height, Math.max(Math.min(280, height), next.height)) };
        };
        const reclamp = () => {
            const { rect, view } = measure();
            if (maximized) {
                showMaximized(view);
                return;
            }
            const next = clampPosition(position ?? rect, rect, view);
            if (position || next.left !== rect.left || next.top !== rect.top)
                writePosition(next);
            if (drag.current)
                Object.assign(drag.current, { view, rect: { ...next, width: rect.width, height: rect.height },
                    x: drag.current.lastX, y: drag.current.lastY });
        };
        const showNormal = () => {
            const style = panel.current.style;
            for (const property of ['left', 'top', 'right', 'bottom', 'width', 'height'])
                style.removeProperty(property);
            if (position)
                writePosition(position);
            if (size)
                writeSize(size);
            reclamp();
        };
        const toggleMaximize = () => {
            maximized = !maximized;
            setIsMaximized(maximized);
            if (maximized)
                showMaximized(viewport());
            else
                showNormal();
        };
        const restorePosition = () => {
            position = null;
            maximized = false;
            setIsMaximized(false);
            showNormal();
        };
        React.useLayoutEffect(() => {
            if (maximized)
                showMaximized(viewport());
            else
                showNormal();
            let frame = 0;
            const schedule = () => { if (!frame)
                frame = requestAnimationFrame(() => { frame = 0; reclamp(); }); };
            // Our resize gesture already knows its geometry. Observing those writes
            // would remeasure once per pointer frame; only external size changes need it.
            const observer = new ResizeObserver(() => { if (!drag.current)
                schedule(); });
            observer.observe(panel.current);
            window.addEventListener('resize', schedule);
            const view = window.visualViewport;
            view?.addEventListener('resize', schedule);
            view?.addEventListener('scroll', schedule);
            return () => {
                observer.disconnect();
                cancelAnimationFrame(frame);
                window.removeEventListener('resize', schedule);
                view?.removeEventListener('resize', schedule);
                view?.removeEventListener('scroll', schedule);
                drag.current = null;
            };
        }, []);
        const startDrag = (event, mode) => {
            if (maximized || event.button !== 0 || !event.isPrimary)
                return;
            if (mode === 'move' && event.target.closest('button, input, select, textarea, a, [contenteditable]'))
                return;
            event.preventDefault();
            event.currentTarget.focus({ preventScroll: true });
            const { rect, view } = measure();
            drag.current = { mode, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
                lastX: event.clientX, lastY: event.clientY, rect, view };
            event.currentTarget.setPointerCapture(event.pointerId);
            if (mode === 'move')
                event.currentTarget.style.cursor = 'grabbing';
        };
        const moveDrag = (event) => {
            const current = drag.current;
            if (current?.pointerId !== event.pointerId)
                return;
            current.lastX = event.clientX;
            current.lastY = event.clientY;
            const x = event.clientX - current.x, y = event.clientY - current.y;
            // No layout reads or React state updates in either pointer-move path.
            if (current.mode === 'move')
                writePosition(clampPosition({ left: current.rect.left + x,
                    top: current.rect.top + y }, current.rect, current.view));
            else {
                writePosition(current.rect);
                writeSize(clampSize({ width: current.rect.width + x, height: current.rect.height + y }, current.rect, current.view));
            }
        };
        const endDrag = (event) => {
            if (drag.current?.pointerId !== event.pointerId)
                return;
            if (drag.current.mode === 'move')
                event.currentTarget.style.cursor = 'grab';
            drag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
        };
        const pointerProps = { onPointerMove: moveDrag, onPointerUp: endDrag,
            onPointerCancel: endDrag, onLostPointerCapture: endDrag };
        const directions = {
            ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24],
        };
        return { isMaximized, toggleMaximize, headerProps: {
                ...pointerProps, tabIndex: 0, title: '拖动移动侧聊；方向键移动，Home 归位',
                style: { touchAction: 'none', cursor: isMaximized ? 'default' : 'grab', userSelect: 'none' },
                onPointerDown: (event) => startDrag(event, 'move'),
                onKeyDown: (event) => {
                    if (event.target !== event.currentTarget || !(event.key === 'Home' || directions[event.key]))
                        return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.key === 'Home')
                        restorePosition();
                    else if (!maximized) {
                        const { rect, view } = measure(), [x, y] = directions[event.key];
                        writePosition(clampPosition({ left: rect.left + x, top: rect.top + y }, rect, view));
                    }
                },
            }, resizeProps: {
                ...pointerProps, disabled: isMaximized, title: '拖动调整大小；方向键调整，Shift 加速',
                onPointerDown: (event) => startDrag(event, 'resize'),
                onKeyDown: (event) => {
                    const delta = directions[event.key];
                    if (!delta || maximized)
                        return;
                    event.preventDefault();
                    event.stopPropagation();
                    const { rect, view } = measure(), step = event.shiftKey ? 2 : 1;
                    writePosition(rect);
                    writeSize(clampSize({ width: rect.width + delta[0] * step, height: rect.height + delta[1] * step }, rect, view));
                },
            } };
    }
    function Panel({ sessionId, scope }) {
        const [binding, setBinding] = React.useState(null);
        const [catalog, setCatalog] = React.useState([]);
        const [busy, setBusy] = React.useState(false);
        const [error, setError] = React.useState('');
        const [retry, setRetry] = React.useState(0);
        const alive = React.useRef(true);
        const panel = React.useRef(null);
        const { headerProps, resizeProps, isMaximized, toggleMaximize } = usePanelGeometry(panel);
        const opener = React.useRef(document.activeElement);
        React.useEffect(() => {
            alive.current = true;
            panel.current?.focus({ preventScroll: true });
            return () => { alive.current = false; if (opener.current instanceof HTMLElement)
                opener.current.focus(); };
        }, []);
        React.useEffect(() => {
            let active = true;
            setError('');
            void (async () => {
                let value = await jsonFetch('/api/roleplay/side-chat?sessionId=' + encodeURIComponent(sessionId));
                if (!active)
                    return;
                if (!value.sideSessionId)
                    value = await request(sessionId, 'ensure', { expectedRevision: value.revision });
                if (active)
                    setBinding(value);
            })().catch(error => { if (active)
                setError(failure(error)); });
            void jsonFetch('/api/roleplay/models?sessionId=' + encodeURIComponent(sessionId))
                .then(value => { if (active)
                setCatalog(value.catalog ?? []); }, error => { if (active)
                setError(failure(error)); });
            return () => { active = false; };
        }, [sessionId, retry]);
        const configure = async (value) => {
            if (!binding || busy)
                return;
            setBusy(true);
            setError('');
            try {
                const next = await request(sessionId, 'configure', { expectedRevision: binding.revision, ...value });
                if (alive.current)
                    setBinding(next);
            }
            catch (error) {
                if (alive.current)
                    setError(failure(error));
            }
            finally {
                if (alive.current)
                    setBusy(false);
            }
        };
        const reset = async () => {
            if (!binding || busy)
                return;
            setBusy(true);
            if (!await confirm('重置后将开启一段新的侧聊，当前侧聊内容会从面板中清空。模型和权限设置会保留。')) {
                if (alive.current)
                    setBusy(false);
                return;
            }
            if (!alive.current)
                return;
            const previous = binding;
            setError('');
            // Detach the old generation before reset: late tokens can only update
            // their original native view and never enter the replacement transcript.
            setBinding({ ...binding, sideSessionId: null });
            try {
                const next = await request(sessionId, 'reset', { expectedRevision: binding.revision });
                if (alive.current)
                    setBinding(next);
            }
            catch (error) {
                if (alive.current) {
                    setBinding(previous);
                    setError(failure(error));
                }
            }
            finally {
                if (alive.current)
                    setBusy(false);
            }
        };
        const selected = catalog.find(model => model.provider === binding?.model?.provider && model.model === binding.model.model);
        const modelKey = (model) => JSON.stringify([model.provider, model.model]);
        const groups = new Map();
        for (const model of catalog) {
            const group = groups.get(model.provider);
            if (group)
                group.push(model);
            else
                groups.set(model.provider, [model]);
        }
        const modelItems = [...groups].flatMap(([provider, models]) => [
            { type: 'label', id: 'provider:' + provider, text: provider },
            ...models.map(model => ({ id: modelKey(model), label: model.label || model.model })),
        ]);
        if (binding?.model && !selected)
            modelItems.unshift({ id: modelKey(binding.model), disabled: true,
                label: `${binding.model.provider} · ${binding.model.model}（当前不可用）` }, { type: 'separator', id: 'current-model' });
        const efforts = buildReasoningEffortOptions(selected, binding?.model?.reasoningEffort);
        const effort = efforts.find(option => option.id === (binding?.model?.reasoningEffort ?? ''));
        const permissions = [{ id: 'read-only', label: '只读' }, { id: 'workspace-write', label: '工作区读写' },
            { id: 'full-access', label: '完全访问' }];
        const permission = permissions.find(option => option.id === binding?.permissionPreset);
        const modelLabel = selected?.label || binding?.model?.model || '选择侧聊模型';
        const controls = binding ? h('div', { className: 'dsh-rp-side-settings', role: 'group', 'aria-label': '侧聊设置' }, h(Selector, { label: '侧聊模型', name: 'model', className: 'dsh-rp-side-model', items: modelItems,
            title: binding.model ? `${binding.model.provider} · ${modelLabel} · ${binding.model.model}` : modelLabel,
            value: modelLabel,
            selectedId: binding.model ? modelKey(binding.model) : undefined,
            disabled: busy,
            onSelect: id => {
                if (binding.model && modelKey(binding.model) === id)
                    return;
                const model = catalog.find(model => modelKey(model) === id);
                if (model)
                    void configure({ model: { provider: model.provider, model: model.model } });
            } }), h(Selector, { label: '侧聊思考等级', name: 'thinking', title: '思考等级',
            value: String(effort?.name ?? '模型默认'), selectedId: binding.model?.reasoningEffort ?? '', disabled: busy || !binding.model,
            items: efforts.map(option => ({ id: option.id, label: String(option.name), disabled: !!option.unknown })),
            onSelect: id => {
                if (binding.model && (binding.model.reasoningEffort ?? '') !== id) {
                    void configure({ model: { ...binding.model, reasoningEffort: id } });
                }
            } }), h(Selector, { label: '侧聊权限', name: 'permission', title: '侧聊权限', className: 'dsh-rp-side-permission',
            value: permission.label, items: permissions, selectedId: binding.permissionPreset, disabled: busy,
            onSelect: id => {
                if (id !== binding.permissionPreset)
                    void configure({ permissionPreset: id });
            } })) : null;
        return h('section', { ref: panel, id: 'dsh-rp-side-chat', className: 'dsh-rp-side-chat', role: 'dialog',
            'aria-label': '酒馆侧聊', 'data-side-maximized': isMaximized || undefined, tabIndex: -1,
            onKeyDown: (event) => {
                // Native pending composers handle their own Escape first. Keeping this
                // on the React bubble path preserves their reject/withdraw semantics.
                if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('.dsh-rp-confirm-dialog[open]')) {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                }
            } }, h('header', { className: 'dsh-rp-side-head', ...headerProps }, h('strong', { className: 'dsh-rp-side-title' }, '酒馆侧聊'), h('div', { className: 'dsh-rp-side-head-actions' }, action(isMaximized ? '还原侧聊窗口' : '最大化侧聊', isMaximized ? 'restore' : 'maximize', toggleMaximize), action('重置侧聊', 'reset', () => void reset(), !binding || busy), action('关闭侧聊', 'close', () => setOpen(false)))), error ? h('div', { className: 'dsh-rp-side-error', role: 'alert' }, error, !binding ? h('button', { type: 'button', onClick: () => setRetry(value => value + 1) }, '重试') : null) : null, binding?.sideSessionId ? h(NativeView, { key: binding.sideSessionId, sessionId: binding.sideSessionId, controls, scope })
            : !error ? h('div', { className: 'dsh-rp-side-loading', role: 'status' }, busy ? '正在重置侧聊…' : '正在打开侧聊…') : null, h('button', { type: 'button', className: 'dsh-rp-side-resize', 'aria-label': '调整侧聊大小', ...resizeProps }, icon('resize')));
    }
    return { Panel, Session, useOpen, setOpen, toggle: () => setOpen(!opened) };
}
