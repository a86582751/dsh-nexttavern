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

const MAX_FRAME_HEIGHT = 2_000_000;
export const AUTHOR_FRAME_MAX_ROWS = 600;
const STATIC_RESOURCE_CSP =
    "style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; " +
    "connect-src 'none'; media-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";

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
        '"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;overflow:hidden}body{display:flow-root}</style><body></body>';
    container.appendChild(frame);
    return {dispose() {
        if (!active) return;
        active = false;frame.removeEventListener('load', load);
        if (scheduled !== undefined) view.cancelAnimationFrame(scheduled);
        document?.body.removeEventListener('click', fill);document?.removeEventListener('load', schedule, true);
        resize?.disconnect();mutation?.disconnect();frame.remove();
    }};
}
function randomNonce(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
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
