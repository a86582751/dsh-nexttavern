// Generated from runtime/alpha3/src/ui/reader-native-beauty-frame.ts; edit the TypeScript source.
import { READER_NATIVE_RESOURCE_CSP } from '../core/reader-native-parent-realm.js';
/** The published Native beauty API is a function body receiving root/fill.
 * It is separate from TavernHelper module descriptors and has no Core port. */
export function readerNativeBeautyBootstrap(channel) {
    let port, revision = 0, active = true, scheduled = false, started = false;
    let cleanup;
    const root = document.createElement('div'), sheet = document.createElement('style');
    root.className = 'rp-reader';
    const viewport = document.createElement('div');
    viewport.className = 'rp-reader-view';
    viewport.append(root);
    document.head.append(sheet);
    document.body.append(viewport);
    const rows = new Map();
    const documents = new Map(), staticViews = [];
    let actionHeights = {}, documentHeights = {};
    const send = (value) => { if (active)
        port?.postMessage(value); };
    const measure = () => {
        scheduled = false;
        if (!active)
            return;
        const origin = root.getBoundingClientRect(), body = document.body.getBoundingClientRect();
        const box = (node) => {
            const rect = node.getBoundingClientRect();
            return { top: rect.top - body.top, left: rect.left - body.left, width: rect.width };
        };
        const present = (node) => {
            if (!root.isConnected || !root.contains(node))
                return false;
            const style = getComputedStyle(node);
            return style.display !== 'none' && style.visibility === 'visible' && node.getClientRects().length > 0;
        };
        const rowBoxes = Object.fromEntries([...rows].filter(([, row]) => present(row.actions)).map(([key, row]) => [key, box(row.actions)]));
        const documentBoxes = Object.fromEntries([...documents].filter(([, node]) => present(node)).map(([key, node]) => [key, box(node)]));
        const height = Math.ceil(Math.max(origin.bottom - body.top, ...Array.from(document.body.children, node => node.getBoundingClientRect().bottom - body.top), 0));
        send({ op: 'layout', value: { revision, height, rows: rowBoxes, documents: documentBoxes } });
    };
    const schedule = () => { if (!active || scheduled)
        return; scheduled = true; requestAnimationFrame(measure); };
    const fill = (value) => send({ op: 'fill', text: String(value ?? '') });
    const fillClick = (event) => {
        const target = event.target, button = target?.closest('[data-community-option],.f');
        if (button) {
            event.preventDefault();
            fill(button.dataset.communityOption ?? button.innerText ?? button.textContent ?? '');
        }
    };
    root.addEventListener('click', fillClick);
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    const mutation = new MutationObserver(schedule);
    mutation.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
    const resizeSlots = () => {
        for (const [key, row] of rows)
            row.actions.style.height = (actionHeights[key] ?? 0) + 'px';
        for (const [key, node] of documents)
            node.style.height = (documentHeights[key] ?? 1) + 'px';
        schedule();
    };
    function staticDocument(html) {
        const frame = document.createElement('iframe');
        frame.sandbox.add('allow-same-origin');
        frame.style.cssText = 'width:100%;height:1px;border:0;display:block';
        let observer;
        const loaded = () => {
            const doc = frame.contentDocument, extent = () => {
                frame.style.height = Math.max(1, Math.ceil(doc.body.getBoundingClientRect().height)) + 'px';
                schedule();
            };
            doc.addEventListener('click', event => { fillClick(event); if (event.target?.closest('a'))
                event.preventDefault(); });
            doc.addEventListener('submit', event => event.preventDefault());
            observer = new ResizeObserver(extent);
            observer.observe(doc.body);
            extent();
        };
        frame.addEventListener('load', loaded, { once: true });
        frame.srcdoc = '<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
            + 'script-src \'none\'; style-src \'unsafe-inline\' https:; img-src data: blob: https:; font-src data: https:">'
            + '<style>body{margin:0}</style>' + html;
        staticViews.push({ dispose() { observer?.disconnect(); frame.removeEventListener('load', loaded); } });
        return frame;
    }
    const render = (value) => {
        revision = value.renderRevision;
        sheet.textContent = value.css
            + '\nhtml,body{margin:0;overflow:hidden}.rp-reader-view{width:100%;min-height:0;overflow:visible;display:block}'
            + '.rp-reader{width:100%;max-width:none}';
        const next = new Set(value.parts.map(part => part.key));
        for (const [key, row] of rows)
            if (!next.has(key)) {
                resize.unobserve(row.node);
                row.node.remove();
                rows.delete(key);
            }
        documents.clear();
        let cursor = root.firstChild;
        for (const part of value.parts) {
            const content = JSON.stringify(part), previous = rows.get(part.key);
            let row = previous;
            if (!row || row.content !== content) {
                const node = document.createElement('section'), actions = document.createElement('div');
                node.className = 'rp-reader-message';
                node.dataset.readerKey = part.key;
                node.dataset.kind = part.kind === 'user' ? 'user' : 'assistant';
                actions.className = 'rp-reader-action-space';
                actions.setAttribute('aria-hidden', 'true');
                const body = document.createElement(part.kind === 'user' ? 'p' : 'div');
                body.className = part.kind === 'user' ? 'rp-user-line' : 'rp-reader-narrative';
                if (part.kind === 'user')
                    body.textContent = '◈ 你：' + part.text;
                else if (part.fragments)
                    for (const fragment of part.fragments) {
                        const slot = document.createElement('div');
                        if (fragment.kind === 'reader-document') {
                            slot.dataset.readerNativeDocument = fragment.documentPlanSha256;
                        }
                        else if (fragment.kind === 'static-document')
                            slot.append(staticDocument(fragment.html));
                        else if (fragment.kind === 'failed-document' || fragment.kind === 'pending-document')
                            slot.textContent = '作者文档不可用：' + fragment.code;
                        else
                            slot.innerHTML = fragment.html;
                        body.append(slot);
                    }
                else
                    body.innerHTML = part.html;
                node.append(body, actions);
                if (previous) {
                    resize.unobserve(previous.node);
                    previous.node.replaceWith(node);
                    if (cursor === previous.node)
                        cursor = node;
                }
                row = { node, actions, content };
                rows.set(part.key, row);
                resize.observe(node);
            }
            if (row.node !== cursor)
                root.insertBefore(row.node, cursor);
            cursor = row.node.nextSibling;
            // Only our finite document placeholders are joined to Main containers.
            for (const slot of row.node.querySelectorAll('[data-reader-native-document]'))
                documents.set(slot.dataset.readerNativeDocument, slot);
        }
        resizeSlots();
    };
    const finish = () => {
        if (!active)
            return;
        active = false;
        resize.disconnect();
        mutation.disconnect();
        for (const view of staticViews)
            view.dispose();
        try {
            cleanup?.();
        }
        finally {
            cleanup = undefined;
            port?.close();
        }
    };
    const connect = (event) => {
        if (port || event.data?.op !== 'connect' || event.data.channel !== channel || !event.ports[0])
            return;
        port = event.ports[0];
        removeEventListener('message', connect);
        port.onmessage = event => {
            const data = event.data;
            if (data.op === 'render') {
                actionHeights = data.actionHeights;
                documentHeights = data.documentHeights;
                render(data.render);
                if (!started) {
                    started = true;
                    try {
                        const result = new Function('root', 'fill', data.source.javascript).call(window, root, fill);
                        if (typeof result === 'function')
                            cleanup = result;
                    }
                    catch (error) {
                        send({ op: 'source-error', code: error instanceof Error ? error.message : String(error) });
                    }
                    schedule();
                }
            }
            else if (data.op === 'slots') {
                actionHeights = data.actionHeights;
                documentHeights = data.documentHeights;
                resizeSlots();
            }
        };
        port.start();
        send({ op: 'ready' });
    };
    addEventListener('message', connect);
    addEventListener('pagehide', finish, { once: true });
    addEventListener('unload', finish, { once: true });
}
const html = (channel) => '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'
    + READER_NATIVE_RESOURCE_CSP + '"><meta name="referrer" content="no-referrer"><body><script>('
    + readerNativeBeautyBootstrap.toString() + ')(' + JSON.stringify(channel) + ')</script></body>';
export function createReaderNativeBeautyFrame(container, execution, options) {
    const view = container.ownerDocument.defaultView;
    let active = true, frame, port, ready = false, runKey = '';
    let startupTimer;
    let latest, actionHeights = {}, documentHeights = {};
    const publish = () => { if (ready && latest)
        port.postMessage({ op: 'render', render: latest, source: execution.source, actionHeights, documentHeights }); };
    const retire = () => { view.clearTimeout(startupTimer); ready = false; port?.close(); port = undefined; frame?.remove(); frame = undefined; };
    function mount() {
        retire();
        const channel = crypto.randomUUID(), ports = new view.MessageChannel();
        const child = container.ownerDocument.createElement('iframe');
        frame = child;
        port = ports.port1;
        child.title = '作者排版美化';
        child.style.cssText = 'display:block;width:100%;height:1px;border:0';
        child.setAttribute('credentialless', '');
        child.sandbox.add('allow-scripts', 'allow-same-origin');
        const ownPort = ports.port1, current = () => active && options.current() && port === ownPort && frame === child;
        startupTimer = view.setTimeout(() => { if (current())
            options.failed('READER_BEAUTY_STARTUP_UNAVAILABLE'); }, 15000);
        ownPort.onmessage = event => {
            if (!current())
                return;
            const data = event.data;
            if (data.op === 'parent-ready')
                ownPort.postMessage({ op: 'mount', html: html(channel), libraries: [], sdkGlobals: [], messageIndex: 0 });
            else if (data.op === 'ready') {
                ready = true;
                publish();
            }
            else if (data.op === 'layout') {
                if (data.value.revision !== latest?.renderRevision)
                    return;
                view.clearTimeout(startupTimer);
                child.style.height = Math.max(1, data.value.height) + 'px';
                options.layout(data.value);
            }
            else if (data.op === 'fill')
                options.fill(data.text);
            else if (data.op === 'source-error' || data.op === 'parent-error')
                options.failed(data.code);
        };
        ownPort.start();
        const parent = new URL(execution.parentOrigin);
        parent.hash = new URLSearchParams({ channel }).toString();
        child.addEventListener('load', () => { if (current())
            child.contentWindow.postMessage({ op: 'connect-parent', channel }, parent.origin, [ports.port2]); }, { once: true });
        child.src = parent.href;
        container.append(child);
    }
    return {
        render(value, key) {
            latest = value;
            if (!frame || runKey !== key) {
                runKey = key;
                mount();
            }
            else
                publish();
        },
        slots(actions, documents) {
            if (actionHeights === actions && documentHeights === documents)
                return;
            actionHeights = actions;
            documentHeights = documents;
            if (ready)
                port.postMessage({ op: 'slots', actionHeights, documentHeights });
        },
        dispose() { if (!active)
            return; active = false; retire(); latest = undefined; },
    };
}
