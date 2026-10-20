import type {TavernPromptDisplayPartV1} from '../core/tavern-prompt-transform-types.mjs';

export interface AuthorFrameFragment {
    kind: 'text' | 'author-document';
    html: string;
}
/** Capture placeholders must be ordinary DOM text nodes. A capture cannot
 * create markup, CSS, a URL attribute, or a resource declaration. */
export function prepareStaticAuthorDocument(owner: Document, parts: readonly TavernPromptDisplayPartV1[]): string | undefined {
    const marker = 'nexttavernCapture' + randomNonce();
    const captures: string[] = [];
    let html = parts.map(part => part.kind === 'literal' ? part.text :
        marker + captures.push(part.text) + 'End').join('').trim();
    const fence = html.match(/^(`{3,}|~{3,})(?:html)?[ \t]*\r?\n([\s\S]*?)\r?\n\1$/i);
    if (fence) html = fence[2]!;
    const template = owner.createElement('template');
    template.innerHTML = html;
    const walker = owner.createTreeWalker(template.content, 4), nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const found = new Set<number>(), pattern = new RegExp(marker + '(\\d+)End', 'g');
    for (const node of nodes) {
        if (node.parentElement?.closest('style,script')) continue;
        const text = node.nodeValue ?? '', fragment = owner.createDocumentFragment();
        let cursor = 0, matched = false;
        pattern.lastIndex = 0;
        for (const match of text.matchAll(pattern)) {
            fragment.append(owner.createTextNode(text.slice(cursor, match.index)),
                owner.createTextNode(captures[Number(match[1]) - 1]!));
            found.add(Number(match[1]));cursor = match.index + match[0].length;matched = true;
        }
        if (matched) {fragment.append(owner.createTextNode(text.slice(cursor)));node.replaceWith(fragment);}
    }
    if (found.size !== captures.length) return;
    template.content.querySelectorAll('script,meta[http-equiv="refresh" i]').forEach(node => node.remove());
    return template.innerHTML;
}

// Author scripts see only an opaque-origin document. The trusted outer srcdoc
// supplies a frame-src policy: a sandboxed child may otherwise navigate itself
// to an attacker URL even when its own connect-src is 'none'.
export interface AuthorFramePart {
    key: string;
    kind: 'user' | 'narrator';
    text: string;
    html: string;
    fragments?: readonly AuthorFrameFragment[];
}
export interface AuthorFrameLayout {
    height: number;
    rows: number[];
}
interface AuthorFrameCommonOptions {
    css: string;
    baseCss: string;
    current(): boolean;
    fill(text: string): void;
    layout(value: AuthorFrameLayout): void;
    failed(reason: string): void;
}
type AuthorFrameOptions = AuthorFrameCommonOptions & (
    {mode?: 'script';source: string} | {mode: 'static-document';source?: never}
);
const MAX_FRAME_BYTES = 8_000_000;
const MAX_AUTHOR_BYTES = 2_000_000;
const MAX_FRAME_HEIGHT = 2_000_000;
export const AUTHOR_FRAME_MAX_ROWS = 600;
const FRAME_PROTOCOL = 1;
const FRAME_CSP = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; " +
    "connect-src 'none'; img-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; " +
    "worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
const STATIC_RESOURCE_CSP =
    "style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; " +
    "connect-src 'none'; media-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
const staticFrameCsp = (nonce: string) => "default-src 'none'; script-src 'nonce-" + nonce + "'; " + STATIC_RESOURCE_CSP;

/** Existing static Source DATA in its own resource-policy document. The Main
 * owner supplies DOM, actions and height; this child has no bootstrap script. */
export function mountStaticAuthorDocument(container: HTMLElement, html: string, options: {
    current(): boolean;
    fill(text: string): void;
    layout(): void;
}): {dispose(): void;} {
    const owner = container.ownerDocument, view = owner.defaultView!;
    const frame = owner.createElement('iframe');
    frame.title = '作者静态阅读文档';frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.style.cssText = 'display:block;width:100%;height:1px;border:0';
    let active = true, scheduled: number | undefined, document: Document | undefined;
    let resize: ResizeObserver | undefined, mutation: MutationObserver | undefined;
    const measure = () => {
        scheduled = undefined;
        if (!active || !options.current() || !document) return;
        const height = Math.min(MAX_FRAME_HEIGHT, Math.max(1, Math.ceil(document.body.scrollHeight),
            Math.ceil(document.body.getBoundingClientRect().height)));
        if (frame.style.height !== height + 'px') {frame.style.height = height + 'px';options.layout();}
    };
    const schedule = () => {
        if (active && options.current() && scheduled === undefined) scheduled = view.requestAnimationFrame(measure);
    };
    const fill = (event: Event) => {
        if (!active || !options.current()) return;
        const target = event.target as Element | null, action = target?.closest<HTMLElement>('[data-community-option],.f');
        if (action || target?.closest('a[href],area[href]')) event.preventDefault();
        if (!action) return;
        const text = action.dataset.communityOption ?? action.innerText ?? action.textContent ?? '';
        if (text.length <= 8192) options.fill(text);
    };
    const load = () => {
        if (!active || !options.current()) return;
        document = frame.contentDocument!;
        document.body.innerHTML = html;
        document.body.addEventListener('click', fill);
        document.addEventListener('load', schedule, true);
        resize = new view.ResizeObserver(schedule);resize.observe(document.body);
        mutation = new view.MutationObserver(schedule);
        mutation.observe(document.body, {subtree: true, childList: true, attributes: true, characterData: true});
        void document.fonts?.ready.then(schedule);
        schedule();
    };
    frame.addEventListener('load', load, {once: true});
    frame.srcdoc = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' +
        "default-src 'none'; script-src 'none'; " + STATIC_RESOURCE_CSP +
        '"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;overflow:hidden}</style><body></body>';
    container.appendChild(frame);
    return {dispose() {
        if (!active) return;
        active = false;frame.removeEventListener('load', load);
        if (scheduled !== undefined) view.cancelAnimationFrame(scheduled);
        document?.body.removeEventListener('click', fill);document?.removeEventListener('load', schedule, true);
        resize?.disconnect();mutation?.disconnect();frame.remove();
    }};
}
// This function is serialized into the sandbox document. Do not close over
// module state or pass parent DOM/functions into it.
function authorFrameBootstrap(nonce: string, maxRows: number, mode: 'script' | 'static-document') {
    if (!document.body) {
        addEventListener('DOMContentLoaded', () => authorFrameBootstrap(nonce, maxRows, mode), {once: true});
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
        const action = target instanceof Element ? target.closest<HTMLElement>('[data-community-option],.f') : null;
        if (!action) return;
        event.preventDefault();
        fill(action.dataset.communityOption??action.innerText??action.textContent??'');
    });
    const render = (parts: AuthorFramePart[]) => {
        const next = new Map<string, {node: HTMLElement; signature: string;}>();
        const fragment = document.createDocumentFragment();
        for (const part of parts) {
            const signature = part.kind + '\0' + part.text + '\0' + part.html + '\0' + JSON.stringify(part.fragments);
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
                    paragraph.innerHTML=part.html;
                    paragraph.prepend(document.createTextNode('◈ 你：'));
                    section.append(paragraph);
                } else {
                    const narrative = document.createElement('div');
                    narrative.className = 'rp-reader-narrative';
                    narrative.innerHTML = mode === 'static-document' && part.fragments
                        ? part.fragments.map(fragment => fragment.html).join('') : part.html;
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
                if (mode === 'script') try {
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

function authorDocument(nonce: string, mode: 'script' | 'static-document'): string {
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' +
        (mode === 'static-document' ? staticFrameCsp(nonce) : FRAME_CSP) +
        '"><meta name="referrer" content="no-referrer"><body><script nonce="' + nonce + '">(' +
        authorFrameBootstrap.toString().replace(/<\/script/gi, '<\\/script') +
        ')(' + JSON.stringify(nonce) + ',' + JSON.stringify(AUTHOR_FRAME_MAX_ROWS) + ',' + JSON.stringify(mode) + ');</script></body>';
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

function guardDocument(nonce: string, mode: 'script' | 'static-document'): string {
    return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' +
        (mode === 'static-document' ? staticFrameCsp(nonce) : FRAME_CSP) +
        '"><style>html,body{margin:0;overflow:hidden}iframe{display:block;width:100%;height:150px;border:0}</style>' +
        '<body><script nonce="' + nonce + '">(' + guardFrameBootstrap.toString().replace(/<\/script/gi, '<\\/script') + ')(' +
        JSON.stringify(authorDocument(nonce, mode)).replace(/</g, '\\u003c') + ',' + JSON.stringify(nonce) +
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
            source: options.source ?? '', css: options.css, baseCss: options.baseCss, parts: pending,
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
    outer.srcdoc = guardDocument(nonce, options.mode ?? 'script');
    return {
        update(parts) {
            if (!active || !options.current()) return;
            if (parts.length > AUTHOR_FRAME_MAX_ROWS || JSON.stringify(parts).length > MAX_FRAME_BYTES ||
                (options.source?.length ?? 0) + options.css.length > MAX_AUTHOR_BYTES) {
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
