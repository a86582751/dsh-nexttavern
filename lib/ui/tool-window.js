// Generated from runtime/alpha3/src/ui/tool-window.ts; edit the TypeScript source.
const paths = {
    values: 'M4 7h16M4 17h16M8 4v6M16 14v6',
    images: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 8h.01',
    music: 'M9 18V5l11-2v13M9 8l11-2M9 18c0 2-6 3-6 0s6-3 6 0M20 16c0 2-6 3-6 0s6-3 6 0',
};
// Above the existing status/decision surfaces (8500), below toast/dialog layers.
const windows = [];
function restack() { windows.forEach((element, index) => { element.style.zIndex = String(8700 + index); }); }
function raise(element) {
    if (!element || windows.at(-1) === element)
        return;
    const index = windows.indexOf(element);
    if (index >= 0)
        windows.splice(index, 1);
    windows.push(element);
    restack();
}
const fit = (g) => {
    const w = Math.min(Math.max(280, g.w), window.innerWidth - 16);
    const h = Math.min(Math.max(240, g.h), window.innerHeight - 16);
    return { w, h, left: Math.max(8, Math.min(g.left, window.innerWidth - w - 8)),
        top: Math.max(8, Math.min(g.top, window.innerHeight - h - 8)) };
};
/** Nonmodal tools stay beside the story. Geometry is local presentation state;
 * session data and drafts remain with their existing owners. */
export function createToolWindow(React) {
    const h = React.createElement;
    return function ToolWindow(props) {
        const [geometry, setGeometry] = React.useState(() => fit({ left: props.initialPosition?.left ?? 290,
            top: props.initialPosition?.top ?? 90, w: props.initialSize?.w ?? 440, h: props.initialSize?.h ?? 600 }));
        const root = React.useRef(null);
        const gesture = React.useRef(null);
        React.useEffect(() => {
            const previous = document.activeElement;
            raise(root.current);
            root.current?.querySelector('.rp-tool-close')?.focus({ preventScroll: true });
            const resize = () => setGeometry(current => fit(current));
            window.addEventListener('resize', resize);
            const element = root.current;
            return () => {
                window.removeEventListener('resize', resize);
                const index = element ? windows.indexOf(element) : -1;
                if (index >= 0) {
                    windows.splice(index, 1);
                    restack();
                }
                if (element?.contains(document.activeElement) || document.activeElement === document.body)
                    previous?.focus({ preventScroll: true });
            };
        }, []);
        const begin = (event, edge) => {
            if (event.button !== 0 || event.target.closest('button'))
                return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            gesture.current = { x: event.clientX, y: event.clientY, start: geometry, edge };
        };
        const move = (event) => {
            const drag = gesture.current;
            if (!drag)
                return;
            const dx = event.clientX - drag.x, dy = event.clientY - drag.y, g = { ...drag.start };
            if (drag.edge === 'move') {
                g.left += dx;
                g.top += dy;
            }
            else {
                if (drag.edge.includes('e'))
                    g.w += dx;
                if (drag.edge.includes('s'))
                    g.h += dy;
                if (drag.edge.includes('w')) {
                    g.w -= dx;
                    g.left += dx;
                }
                if (drag.edge.includes('n')) {
                    g.h -= dy;
                    g.top += dy;
                }
            }
            setGeometry(fit(g));
        };
        const pointerHandlers = { onPointerMove: move, onPointerUp: () => { gesture.current = null; },
            onLostPointerCapture: () => { gesture.current = null; } };
        return h(React.Fragment, null, h('style', null, TOOL_WINDOW_CSS), h('section', { ref: root, id: props.id, role: 'dialog', 'aria-modal': false, 'aria-labelledby': props.id + '-title',
            className: 'rp-tool-window', style: { left: geometry.left, top: geometry.top, width: geometry.w, height: geometry.h, zIndex: 8700 },
            onPointerDownCapture: () => raise(root.current), onFocusCapture: () => raise(root.current),
            onKeyDown: (event) => { if (event.key === 'Escape') {
                event.stopPropagation();
                props.onClose();
            } } }, h('header', { className: 'rp-tool-header',
            onPointerDown: (event) => begin(event, 'move'), ...pointerHandlers }, h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
            strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: paths[props.icon ?? 'values'] })), h('div', { className: 'rp-tool-heading' }, h('h2', { id: props.id + '-title' }, props.title), props.subtitle ? h('p', null, props.subtitle) : null), h('button', { type: 'button', className: 'rp-tool-close', 'aria-label': '关闭' + props.title, title: '关闭（Esc）', onClick: props.onClose }, h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('path', { d: 'M6 6l12 12M18 6L6 18' })))), h('div', { className: 'rp-tool-content' }, props.children), ...['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].map(edge => h('div', { key: edge,
            className: 'rp-tool-resize rp-tool-resize-' + edge, ...pointerHandlers,
            onPointerDown: (event) => begin(event, edge),
            'aria-hidden': true }))));
    };
}
export const TOOL_WINDOW_CSS = `
.rp-tool-window{--rp-tool-paper:var(--dsw-alias-bg-layer-1,#fffaf1);--rp-tool-ink:var(--dsw-alias-label-primary,#49392c);--rp-tool-muted:var(--dsw-alias-label-secondary,#766553);--rp-tool-border:var(--dsw-alias-border-l2,#dccbb3);--rp-tool-accent:#8b571c;--rp-tool-soft:var(--dsw-alias-bg-layer-2,#f3ead9);position:fixed;display:flex;flex-direction:column;box-sizing:border-box;background:var(--rp-tool-paper);color:var(--rp-tool-ink);border:1px solid var(--rp-tool-border);border-radius:16px;box-shadow:0 18px 60px #30201024,0 3px 10px #30201014;font-family:inherit;font-size:14px;line-height:1.55;text-align:left;isolation:isolate}
.rp-tool-header{display:flex;align-items:center;gap:12px;padding:12px 12px 12px 20px;border-bottom:1px solid var(--rp-tool-border);cursor:move;touch-action:none;flex:none;border-radius:16px 16px 0 0;user-select:none}
.rp-tool-header>svg{color:var(--rp-tool-accent);flex:none}.rp-tool-heading{flex:1;min-width:0}.rp-tool-heading h2{font-size:17px;line-height:1.4;margin:0;font-weight:650}.rp-tool-heading p{font-size:12px;color:var(--rp-tool-muted);margin:2px 0 0}
:where(.rp-tool-window) :where(button,input,select,textarea){font:inherit;color:inherit;box-sizing:border-box}
:where(.rp-tool-window) :where(button){border:1px solid var(--rp-tool-border);border-radius:8px;background:var(--rp-tool-paper);padding:8px 12px;min-height:40px;cursor:pointer;transition:background .15s}
:where(.rp-tool-window) :where(button:hover:not(:disabled)){background:var(--rp-tool-soft)}:where(.rp-tool-window) :where(button:disabled){opacity:.5;cursor:default}
:where(.rp-tool-window) :where(button,input,select,textarea,summary,[tabindex]):focus-visible{outline:2px solid var(--rp-tool-accent);outline-offset:2px}
.rp-tool-window .rp-tool-close{display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;background:transparent;flex:none}
.rp-tool-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:18px;scrollbar-gutter:stable;overflow-wrap:anywhere}
:where(.rp-tool-window) :where(input:not([type=range]):not([type=checkbox]):not([type=file]),select,textarea){background:var(--rp-tool-paper);border:1px solid var(--rp-tool-border);border-radius:7px;padding:9px;max-width:100%}
:where(.rp-tool-window) :where([role=alert]){color:#a33c36}.rp-tool-resize{position:absolute;touch-action:none}.rp-tool-resize-n,.rp-tool-resize-s{height:7px;left:12px;right:12px;cursor:ns-resize}.rp-tool-resize-n{top:-3px}.rp-tool-resize-s{bottom:-3px}.rp-tool-resize-e,.rp-tool-resize-w{width:7px;top:12px;bottom:12px;cursor:ew-resize}.rp-tool-resize-e{right:-3px}.rp-tool-resize-w{left:-3px}.rp-tool-resize-ne,.rp-tool-resize-nw,.rp-tool-resize-se,.rp-tool-resize-sw{width:15px;height:15px}.rp-tool-resize-ne{right:0;top:0;cursor:nesw-resize}.rp-tool-resize-nw{left:0;top:0;cursor:nwse-resize}.rp-tool-resize-sw{left:0;bottom:0;cursor:nesw-resize}.rp-tool-resize-se{right:1px;bottom:1px;cursor:nwse-resize;background:linear-gradient(135deg,transparent 55%,var(--rp-tool-border) 56%,var(--rp-tool-border) 63%,transparent 64%,transparent 75%,var(--rp-tool-border) 76%,var(--rp-tool-border) 83%,transparent 84%);border-radius:0 0 12px 0}
@media(prefers-reduced-motion:reduce){.rp-tool-window *{transition:none!important;animation:none!important}}
@media(max-width:480px){.rp-tool-content{padding:12px}.rp-tool-header{padding-left:14px}}
@media(pointer:coarse){.rp-tool-resize-n,.rp-tool-resize-s{height:14px}.rp-tool-resize-e,.rp-tool-resize-w{width:14px}.rp-tool-resize-ne,.rp-tool-resize-nw,.rp-tool-resize-se,.rp-tool-resize-sw{width:28px;height:28px}}
`;
