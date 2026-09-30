// Author scripts see only an opaque-origin document. The trusted outer srcdoc
// supplies a frame-src policy: a sandboxed child may otherwise navigate itself
// to an attacker URL even when its own connect-src is 'none'.
export interface AuthorFramePart {
    key: string;
    kind: 'user' | 'narrator';
    text: string;
    html: string;
}
export interface AuthorFrameLayout {
    height: number;
    rows: number[];
}
interface AuthorFrameOptions {
    source: string;
    css: string;
    baseCss: string;
    current(): boolean;
    fill(text: string): void;
    layout(value: AuthorFrameLayout): void;
    failed(reason: string): void;
}
const MAX_FRAME_BYTES = 8_000_000;
const MAX_AUTHOR_BYTES = 2_000_000;
const MAX_FRAME_HEIGHT = 2_000_000;
export const AUTHOR_FRAME_MAX_ROWS = 600;
const FRAME_PROTOCOL = 1;
const FRAME_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; " +
    "connect-src 'none'; img-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; " +
    "worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
// This function is serialized into the sandbox document. Do not close over
// module state or pass parent DOM/functions into it.
function authorFrameBootstrap(nonce: string, maxRows: number) {
    if (!document.body) {
        addEventListener('DOMContentLoaded', () => authorFrameBootstrap(nonce, maxRows), {once: true});
        return;
    }
    const root = document.createElement('div');
    const viewport = document.createElement('div');
    const sheet = document.createElement('style');
    viewport.className = 'rp-reader-view';
    root.className = 'rp-reader';
    viewport.append(root);
    document.body.append(sheet, viewport);
    let port: MessagePort | null = null;
    let revision = 0;
    let sent = 0;
    let started = false;
    let oldRows = new Map<string, {node: HTMLElement; signature: string;}>();
    let scheduled = false;
    const send = (type: string, data: Record<string, unknown> = {}) => {
        port?.postMessage({v: 1, nonce, revision, requestId: ++sent, type, ...data});
    };
    const measure = () => {
        scheduled = false;
        if (!port) return;
        const placeholders = Array.from(root.querySelectorAll<HTMLElement>(':scope > section > .rp-author-action-space'));
        const rows = placeholders.map(element => Math.max(0, Math.ceil(element.getBoundingClientRect().top)));
        const height = Math.max(1, Math.ceil(root.getBoundingClientRect().bottom));
        send('layout', {height, rows});
    };
    const scheduleMeasure = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(measure);
    };
    const fill = (value: unknown) => {
        const text = String(value ?? '');
        if (text.length <= 8192) send('fill', {text});
    };
    root.addEventListener('click', event => {
        const target = event.target;
        const action = target instanceof Element ? target.closest('.f') : null;
        if (!action) return;
        event.preventDefault();
        fill((action as HTMLElement).innerText || action.textContent || '');
    });
    const render = (parts: AuthorFramePart[]) => {
        const next = new Map<string, {node: HTMLElement; signature: string;}>();
        const fragment = document.createDocumentFragment();
        for (const part of parts) {
            const signature = part.kind + '\0' + part.text + '\0' + part.html;
            const previous = oldRows.get(part.key);
            let section: HTMLElement;
            if (previous?.signature === signature) {
                section = previous.node;
            } else {
                section = document.createElement('section');
                section.className = 'rp-reader-message';
                section.dataset.kind = part.kind === 'user' ? 'user' : 'assistant';
                if (part.kind === 'user') {
                    const paragraph = document.createElement('p');
                    paragraph.className = 'rp-user-line';
                    paragraph.textContent = '◈ 你：' + part.text;
                    section.append(paragraph);
                } else {
                    const narrative = document.createElement('div');
                    narrative.className = 'rp-reader-narrative';
                    narrative.innerHTML = part.html;
                    section.append(narrative);
                }
                const space = document.createElement('div');
                space.className = 'rp-author-action-space';
                section.append(space);
            }
            next.set(part.key, {node: section, signature});
            fragment.append(section);
        }
        oldRows = next;
        root.replaceChildren(fragment);
        scheduleMeasure();
    };
    new ResizeObserver(scheduleMeasure).observe(root);
    new MutationObserver(scheduleMeasure).observe(root, {subtree: true, childList: true, attributes: true, characterData: true});
    addEventListener('message', event => {
        if (event.source !== window.parent || event.data?.type !== 'bind' || event.data?.nonce !== nonce ||
            event.data?.v !== 1 || !event.ports?.[0] || port) return;
        port = event.ports[0];
        port.onmessage = message => {
            const data = message.data;
            if (data?.v !== 1 || data?.nonce !== nonce || data?.type !== 'render' ||
                !Number.isSafeInteger(data.revision) || data.revision < revision ||
                !Array.isArray(data.parts) || data.parts.length > maxRows) return;
            revision = data.revision;
            sheet.textContent = String(data.baseCss ?? '') + '\n' + String(data.css ?? '') +
                '\nhtml,body{margin:0;overflow:hidden}.rp-reader-view{padding:0;min-height:0;overflow:visible;display:block;background:none}' +
                '.rp-reader{width:100%;max-width:none}.rp-author-action-space{height:32px}';
            render(data.parts);
            if (!started) {
                started = true;
                try {
                    // Only this opaque-origin realm receives author code and DOM.
                    const author = new Function('root', 'fill', String(data.source ?? ''));
                    author.call(window, root, fill);
                } catch (error) {
                    send('error', {message: String(error instanceof Error ? error.message : error).slice(0, 160)});
                }
            }
        };
        port.start();
        send('bound');
    });
    window.parent.postMessage({v: 1, type: 'ready', nonce}, '*');
}

function authorDocument(nonce: string): string {
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' +
        FRAME_CSP + '"><body><script>(' + authorFrameBootstrap.toString().replace(/<\/script/gi, '<\\/script') +
        ')(' + JSON.stringify(nonce) + ',' + JSON.stringify(AUTHOR_FRAME_MAX_ROWS) + ');</script></body>';
}

// The guard owns the child WindowProxy and never gives it to author code.
// Its frame-src policy also blocks the child's top-level navigation request.
function guardFrameBootstrap(authorHtml: string, nonce: string) {
    if (!document.body) {
        addEventListener('DOMContentLoaded', () => guardFrameBootstrap(authorHtml, nonce), {once: true});
        return;
    }
    const child = document.createElement('iframe');
    child.title = '角色卡隔离阅读内容';
    child.sandbox.add('allow-scripts');
    child.referrerPolicy = 'no-referrer';
    child.srcdoc = authorHtml;
    document.body.append(child);
    let forwarded = false;
    let childLoads = 0;
    child.addEventListener('load', () => {
        childLoads++;
        window.parent.postMessage({v: 1, nonce, type: 'child-load', count: childLoads}, '*');
    });
    addEventListener('message', event => {
        const data = event.data;
        if (data?.v !== 1 || data.nonce !== nonce) return;
        if (event.source === child.contentWindow && event.origin === 'null' && data.type === 'ready') {
            window.parent.postMessage({v: 1, nonce, type: 'ready'}, '*');
            return;
        }
        if (event.source !== window.parent) return;
        if (data.type === 'bind' && !forwarded && event.ports?.[0]) {
            forwarded = true;
            child.contentWindow?.postMessage(data, '*', [event.ports[0]]);
        } else if (data.type === 'height' && Number.isFinite(data.height) &&
            data.height >= 1 && data.height <= 2_000_000) {
            child.style.height = Math.ceil(data.height) + 'px';
        }
    });
}

function guardDocument(nonce: string): string {
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' +
        FRAME_CSP + '"><style>html,body{margin:0;overflow:hidden}iframe{display:block;width:100%;height:150px;border:0}</style>' +
        '<body><script>(' + guardFrameBootstrap.toString().replace(/<\/script/gi, '<\\/script') + ')(' +
        JSON.stringify(authorDocument(nonce)).replace(/</g, '\\u003c') + ',' + JSON.stringify(nonce) +
        ');</script></body>';
}

function randomNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

export function createAuthorFrame(outer: HTMLIFrameElement, options: AuthorFrameOptions): {
    update(parts: AuthorFramePart[]): void;
    dispose(): void;
} {
    const nonce = randomNonce();
    let active = true;
    let port: MessagePort | null = null;
    let bound = false;
    let revision = 0;
    let pending: AuthorFramePart[] = [];
    let previousLayout = '';
    let recentStart = 0;
    let recentCount = 0;
    let lastRequestId = 0;
    const fail = (reason: string) => {
        if (!active) return;
        dispose();
        options.failed(reason);
    };
    const startupTimer = window.setTimeout(() => fail('隔离视图初始化超时'), 5000);
    const send = () => {
        if (!active || !options.current() || !bound || !port) return;
        port.postMessage({
            v: FRAME_PROTOCOL, nonce, type: 'render', revision: ++revision,
            source: options.source, css: options.css, baseCss: options.baseCss, parts: pending,
        });
    };
    const onPortMessage = (event: MessageEvent) => {
        const data = event.data;
        if (!active || !options.current() || data?.v !== FRAME_PROTOCOL || data.nonce !== nonce ||
            !Number.isSafeInteger(data.requestId) || data.requestId <= lastRequestId ||
            !Number.isSafeInteger(data.revision) || data.revision < 0 || data.revision > revision) return;
        if (data.type === 'bound') {
            if (bound || data.revision !== 0) return;
        } else if (data.type === 'fill' || data.type === 'error') {
            // An action/error from this live realm can already be queued when
            // a newer render is sent. It keeps its scope, unlike old geometry.
            if (!bound || data.revision < 1) return;
        } else if (data.type === 'layout') {
            if (!bound || data.revision !== revision) return;
        } else return;
        lastRequestId = data.requestId;
        const now = Date.now();
        if (now - recentStart > 1000) {recentStart = now;recentCount = 0;}
        if (++recentCount > 120) {fail('隔离脚本消息过于频繁');return;}
        if (data.type === 'bound') {bound = true;window.clearTimeout(startupTimer);send();return;}
        if (data.type === 'fill') {
            if (typeof data.text === 'string' && data.text.length <= 8192) options.fill(data.text);
            return;
        }
        if (data.type === 'error') {
            if (typeof data.message === 'string') fail('作者脚本异常：' + data.message.slice(0, 160));
            return;
        }
        if (data.type !== 'layout' || !Array.isArray(data.rows) || data.rows.length !== pending.length ||
            pending.length > AUTHOR_FRAME_MAX_ROWS || !Number.isFinite(data.height) ||
            data.height < 1 || data.height > MAX_FRAME_HEIGHT) return;
        const rows = data.rows as unknown[];
        let last = 0;
        for (const top of rows) {
            if (typeof top !== 'number' || !Number.isFinite(top) || top < last || top > data.height) return;
            last = top;
        }
        const layout: AuthorFrameLayout = {height: Math.ceil(data.height), rows: rows as number[]};
        const signature = JSON.stringify(layout);
        if (signature === previousLayout) return;
        previousLayout = signature;
        outer.style.height = layout.height + 'px';
        outer.contentWindow?.postMessage({v: FRAME_PROTOCOL, nonce, type: 'height', height: layout.height}, '*');
        options.layout(layout);
    };
    const onGuardMessage = (event: MessageEvent) => {
        if (!active || !options.current() || event.source !== outer.contentWindow ||
            event.data?.v !== FRAME_PROTOCOL || event.data.nonce !== nonce) return;
        if (event.data.type === 'child-load' && Number.isSafeInteger(event.data.count) && event.data.count > 1) {
            fail('作者脚本离开隔离文档');
            return;
        }
        if (event.data.type !== 'ready' || port) return;
        const pair = new MessageChannel();
        port = pair.port1;
        port.onmessage = onPortMessage;
        port.start();
        outer.contentWindow?.postMessage({v: FRAME_PROTOCOL, type: 'bind', nonce}, '*', [pair.port2]);
    };
    function dispose() {
        if (!active) return;
        active = false;
        bound = false;
        window.clearTimeout(startupTimer);
        port?.close();
        port = null;
        window.removeEventListener('message', onGuardMessage);
        outer.removeAttribute('srcdoc');
    }
    window.addEventListener('message', onGuardMessage);
    // The outer document is trusted static code; only its nested child is sandboxed.
    outer.setAttribute('referrerpolicy', 'no-referrer');
    outer.srcdoc = guardDocument(nonce);
    return {
        update(parts) {
            if (!active || !options.current()) return;
            if (parts.length > AUTHOR_FRAME_MAX_ROWS || JSON.stringify(parts).length > MAX_FRAME_BYTES ||
                options.source.length + options.css.length > MAX_AUTHOR_BYTES) {
                fail('阅读内容超过隔离视图容量');
                return;
            }
            pending = parts;
            send();
        },
        dispose,
    };
}

// Keep the old exported entry fail-closed for callers outside ReaderView.
export function createAuthorRuntime(_root: HTMLElement, _fill: (text: string) => void): {
    run: (source: string) => null;
    teardown: () => void;
} {
    return {
        run(source: string) {
            if (source.trim()) throw Error('作者 JavaScript 只能在隔离阅读视图执行');
            return null;
        },
        teardown() {},
    };
}
