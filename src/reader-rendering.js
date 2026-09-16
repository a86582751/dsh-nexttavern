// Generated from runtime/alpha3/ui/reader-rendering.ts; edit the TypeScript source.
import { runReaderRegex } from './reader-regex.js';
// ── 沉浸阅读视图：默认主题（奶油纸感 · 新拟态；作者 CSS 可覆盖/追加）────────
// 选择器不写前缀——渲染时统一加 .rp-reader-view 作用域（与状态栏 scopeStyles 同策略）。
export const READER_BASE_CSS = `
.rp-reader-view {
  --rp-reader-paper: rgba(251, 246, 240, .34);
  --rp-reader-ink: #5c5357;
  --rp-reader-muted: #8f8188;
  --rp-reader-dialogue: #b9866d;
  flex: 1; min-height: 0; overflow-y: auto;
  padding: clamp(16px, 2.4vw, 34px) clamp(10px, 2.8vw, 40px) clamp(42px, 6vw, 76px);
  background: linear-gradient(180deg, rgba(247, 241, 235, .18), rgba(239, 233, 226, .12));
  display: flex; flex-direction: column; align-items: center;
}
.rp-reader {
  width: min(1500px, 100%); align-self: center; box-sizing: border-box;
  background: linear-gradient(145deg, rgba(255, 252, 248, .31), var(--rp-reader-paper));
  color: var(--rp-reader-ink);
  border: 1px solid rgba(255, 255, 255, .28); border-radius: 12px;
  box-shadow: 0 16px 42px rgba(123, 108, 104, .055), inset 0 1px 0 rgba(255, 255, 255, .22);
  padding: clamp(26px, 3.5vw, 54px) clamp(22px, 4.8vw, 72px);
  font-size: 17px; line-height: 1.92;
}
.rp-para { margin: 0 0 22px; text-align: justify; text-indent: 0; overflow-wrap: anywhere; }
.rp-page-title {
  display: block; margin: 2px 0 32px; text-align: center;
  font: 600 22px/1.45 Georgia, "Noto Serif SC", "Songti SC", serif; letter-spacing: 4px;
  color: #8f7881; text-shadow: 0 1px 0 rgba(255,255,255,.48);
}
.rp-page-title::before, .rp-page-title::after { content: " ─ "; color: rgba(154,110,130,.28); letter-spacing: 0; }
.rp-thought {
  display: block; margin: 12px 0 14px; padding: 8px 14px;
  color: var(--rp-reader-muted); font-style: italic; line-height: 1.9;
  background: rgba(251,246,240,.22); border-left: 2px solid rgba(226,182,200,.58);
  border-radius: 0 8px 8px 0;
  box-shadow: inset 1px 0 0 rgba(255,255,255,.35);
}
.rp-dialogue {
  color: var(--rp-reader-dialogue); font: 400 1em/1.9 "STKaiti", "KaiTi", "Noto Serif SC", serif;
  letter-spacing: .065em; text-indent: 0;
  position: relative; display: inline-block; max-width: 100%; box-sizing: border-box;
  padding: 5px 12px; margin: 3px 0;
  transition: color .18s ease, filter .18s ease;
}
.rp-dialogue::before, .rp-dialogue::after {
  content: ""; position: absolute; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0, rgba(185,134,109,.08) 8%, rgba(185,134,109,.34) 25%, rgba(185,134,109,.34) 75%, rgba(185,134,109,.08) 92%, transparent 100%);
  transform: scaleY(.55); transform-origin: center; pointer-events: none;
}
.rp-dialogue::before { top: 0; }
.rp-dialogue::after { bottom: 0; }
.rp-dialogue:hover {
  color: #a86e51;
  animation: rp-dialogue-float .7s ease-in-out infinite;
  filter: drop-shadow(0 3px 4px rgba(178,116,84,.16));
}
@keyframes rp-dialogue-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
.rp-affinity {
  display: inline-flex; align-items: center; margin: 0 4px;
  padding: 1px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #fff;
  background: linear-gradient(90deg, #e2b6c8, #b9c9ea);
  box-shadow: 3px 3px 7px rgba(180,185,200,.5), -3px -3px 7px rgba(255,255,255,.85);
  animation: rp-fade .5s ease-out;
}
@keyframes rp-fade { from { opacity: 0 } to { opacity: 1 } }
.rp-user-line {
  margin: 0 0 16px; padding: 7px 12px; font-size: 13px; color: var(--rp-reader-muted);
  background: rgba(226,182,200,.09); border: 1px solid rgba(255,255,255,.18); border-radius: 8px;
}
.rp-page-break { display: flex; align-items: center; gap: 14px; margin: 24px 0; color: rgba(154,110,130,.55); font-size: 12px; letter-spacing: 4px; }
.rp-page-break::before, .rp-page-break::after { content: ""; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(207,178,124,.5), transparent); }
.rp-reader-empty { margin: auto; color: var(--dsw-alias-label-tertiary, #9a9aa6); font-size: 13px; }
.rp-reader-history { display: flex; justify-content: center; align-items: center; min-height: 32px; margin: 0 0 18px; gap: 8px; font-size: 13px; color: var(--rp-reader-muted); }
.rp-reader-load-older { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border: 1px solid rgba(185,134,109,.28); border-radius: 8px; background: rgba(255,255,255,.28); color: inherit; font: inherit; cursor: pointer; }
.rp-reader-load-older:disabled { cursor: progress; }
.rp-reader-spinner { display: inline-block; width: 14px; height: 14px; flex: none; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: rp-reader-spin .8s linear infinite; }
@keyframes rp-reader-spin { to { transform: rotate(360deg); } }
.rp-reader strong { font-weight: 650; color: color-mix(in srgb, currentColor 88%, #6f5262 12%); }
.rp-reader em { font-style: italic; }
.rp-reader blockquote { margin: 18px 0; padding: 4px 18px; border-left: 2px solid rgba(185,134,109,.32); color: var(--rp-reader-muted); }
.rp-reader ul, .rp-reader ol { margin: 12px 0 20px; padding-left: 1.6em; }
.rp-reader code { padding: 1px 5px; border-radius: 5px; background: rgba(126,102,104,.08); font-size: .9em; }
.rp-reader-message { position: relative; }
.rp-reader-actions {
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px; min-height: 24px;
  margin: -10px 0 18px; opacity: .36; transition: opacity .18s ease;
}
.rp-reader-message:hover > .rp-reader-actions, .rp-reader-actions:focus-within { opacity: 1; }
.rp-reader-message[data-kind="user"] > .rp-reader-actions { justify-content: flex-end; margin-top: -12px; }
.rp-reader-meta { font-size: 11px; line-height: 20px; color: var(--rp-reader-muted); white-space: nowrap; }
@media (max-width: 760px) {
  .rp-reader-view { padding: 10px 4px 38px; }
  .rp-reader { border-color: transparent; border-radius: 8px; padding: 22px 16px 30px; font-size: 16px; line-height: 1.88; box-shadow: none; }
  .rp-para { margin-bottom: 19px; text-align: left; }
  .rp-page-title { font-size: 20px; letter-spacing: 3px; margin-bottom: 24px; }
  .rp-dialogue { letter-spacing: .035em; padding-inline: 7px; }
}
@media (prefers-reduced-motion: reduce) {
  .rp-dialogue { transition: none; }
  .rp-dialogue:hover { animation: none; transform: none; }
  .rp-affinity { animation: none; }
}
`;
function cssBlockEnd(css, openIndex) {
    let depth = 1;
    let quote = '';
    let comment = false;
    for (let i = openIndex + 1; i < css.length; i++) {
        const char = css[i];
        const next = css[i + 1];
        if (comment) {
            if (char === '*' && next === '/') {
                comment = false;
                i++;
            }
            continue;
        }
        if (quote) {
            if (char === '\\') {
                i++;
                continue;
            }
            if (char === quote)
                quote = '';
            continue;
        }
        if (char === '/' && next === '*') {
            comment = true;
            i++;
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '{')
            depth++;
        else if (char === '}' && --depth === 0)
            return i;
    }
    return -1;
}
/** Scope complete CSS rules while preserving keyframes and nested at-rules. */
function scopeCssText(css, roots) {
    const input = String(css ?? '');
    let output = '';
    let cursor = 0;
    while (cursor < input.length) {
        const open = input.indexOf('{', cursor);
        if (open < 0) {
            output += input.slice(cursor);
            break;
        }
        const close = cssBlockEnd(input, open);
        if (close < 0) {
            output += input.slice(cursor);
            break;
        }
        const header = input.slice(cursor, open);
        const body = input.slice(open + 1, close);
        const trimmed = header.trim();
        if (/^@(media|supports|container|layer|document)\b/i.test(trimmed)) {
            output += header + '{' + scopeCssText(body, roots) + '}';
        }
        else if (trimmed.startsWith('@')) {
            output += header + '{' + body + '}';
        }
        else {
            const leading = header.match(/^\s*/)?.[0] ?? '';
            const selectors = header.slice(leading.length).split(',').map((selector) => {
                const value = selector.trim();
                if (!value)
                    return '';
                if (roots.some((root) => value === root || value.startsWith(root + ' ') || value.startsWith(root + ':') || value.startsWith(root + '[')))
                    return value;
                if (value === ':root' || value === 'html' || value === 'body')
                    return roots.join(', ');
                return roots.map((root) => root + ' ' + value).join(', ');
            }).filter(Boolean).join(', ');
            output += leading + selectors + '{' + body + '}';
        }
        cursor = close + 1;
    }
    return output;
}
export function scopeHtmlStyles(html, roots) {
    return String(html ?? '').replace(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_match, attributes = '', css) => '<style' + attributes + '>' + scopeCssText(css, roots) + '</style>');
}
// Older card importers persisted the status template as escaped HTML (and a
// few alpha builds kept the defensive backslash before the opening tag). Decode
// only the five HTML entities that can form markup; leave arbitrary prose and
// unknown entities untouched. This runs before style scoping, never through
// innerHTML, so it cannot create a second DOM execution path.
export function decodeStatusTemplate(value) {
    return String(value ?? '')
        .replace(/\\(?=<\/?[a-z][^>]*>)/gi, '')
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, '&');
}
export function statusFactsHtml(value, options = []) {
    const html = String(value ?? '');
    if (!html)
        return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    const root = template.content;
    let changed = false;
    const remove = (element) => { element.remove(); changed = true; };
    // Old cards put actions inside author HTML; keep the stored source intact.
    for (const element of root.querySelectorAll('.rp-status__acts, [data-roleplay-actions]'))
        remove(element);
    const text = (value) => String(value ?? '').replace(/\s+/g, '').replace(/^[❤️♥♡]+/u, '');
    const labels = new Set(options.map(option => text(option.label)).filter(Boolean));
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,span,p,div,summary')) {
        if (!root.contains(heading) || heading.children.length)
            continue;
        if (!/^(?:可以试试|下一步|(?:接下来的)?活动建议|行动建议|可选行动|建议行动|接下来做什么)[：:？?]?(?:[（(]点击可复制[）)])?[：:]?$/.test(text(heading.textContent)))
            continue;
        // Legacy fallback HTML placed the heading and option rows in one list.
        const row = heading.closest('li');
        const anchor = row && text(row.textContent) === text(heading.textContent) ? row : heading;
        let next = anchor.nextElementSibling;
        if (!next?.matches('ol,ul') && !labels.has(text(next?.textContent)))
            continue;
        if (next?.matches('ol,ul'))
            remove(next);
        else {
            while (next && labels.has(text(next.textContent))) {
                const following = next.nextElementSibling;
                remove(next);
                next = following;
            }
        }
        remove(anchor);
    }
    // .f was the status-specific "fill composer" action convention.
    for (const element of root.querySelectorAll('.f'))
        remove(element);
    return changed ? template.innerHTML : html;
}
export function scopeReaderCss(css) {
    return scopeCssText(css, ['.rp-reader-view']);
}
// Reader narration may contain author-supplied layout markup, but it also comes
// through the model. Preserve useful document structure without turning model
// text into an arbitrary script/DOM injection surface.
const READER_ALLOWED_TAGS = new Set([
    'A', 'ARTICLE', 'B', 'BLOCKQUOTE', 'BR', 'BUTTON', 'CAPTION', 'CITE', 'CODE',
    'DD', 'DETAILS', 'DIV', 'DL', 'DT', 'EM', 'FIGCAPTION', 'FIGURE', 'H1', 'H2',
    'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'KBD', 'LI', 'MARK', 'OL', 'P', 'PRE',
    'Q', 'RP', 'RT', 'RUBY', 'S', 'SAMP', 'SECTION', 'SMALL', 'SPAN', 'STRONG',
    'SUB', 'SUMMARY', 'SUP', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD',
    'TIME', 'TR', 'U', 'UL', 'VAR', 'WBR',
]);
const READER_DROP_TAGS = new Set([
    'BASE', 'CANVAS', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'LINK', 'MATH', 'META',
    'NOSCRIPT', 'OBJECT', 'OPTION', 'SCRIPT', 'SELECT', 'SOURCE', 'STYLE', 'SVG',
    'TEMPLATE', 'TEXTAREA', 'VIDEO', 'AUDIO',
]);
const READER_BLOCK_TAGS = new Set([
    'ARTICLE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DETAILS', 'DIV', 'DL', 'DT',
    'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'LI',
    'OL', 'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'TD', 'TFOOT',
    'TH', 'THEAD', 'TR', 'UL',
]);
const READER_PARAGRAPH_CONTAINERS = new Set([
    'ARTICLE', 'BLOCKQUOTE', 'CAPTION', 'DD', 'DIV', 'DT', 'FIGCAPTION', 'LI',
    'SECTION', 'TD', 'TH',
]);
const READER_SAFE_ATTRIBUTES = new Set([
    'class', 'colspan', 'dir', 'id', 'lang', 'open', 'role', 'rowspan', 'style',
    'title',
]);
const READER_BLOCKED_STYLE_PROPERTIES = new Set([
    'behavior', 'bottom', 'clip', 'clip-path', 'content', 'cursor', 'inset',
    'inset-block', 'inset-inline', 'left', 'mask', 'mask-image', '-moz-binding',
    'pointer-events', 'right', 'src', 'top', 'z-index',
]);
function sanitizeReaderStyle(styleText) {
    const parsed = document.createElement('span');
    const safe = document.createElement('span');
    parsed.style.cssText = String(styleText ?? '');
    for (const name of Array.from(parsed.style)) {
        const value = parsed.style.getPropertyValue(name);
        const priority = parsed.style.getPropertyPriority(name);
        const probe = (name + ':' + value).toLowerCase().replace(/\s+/g, '');
        if (READER_BLOCKED_STYLE_PROPERTIES.has(name))
            continue;
        if (/(?:url|image-set|expression|javascript|vbscript|@import)\(/i.test(probe))
            continue;
        if (name === 'position' && !/^(?:static|relative)$/i.test(value.trim()))
            continue;
        safe.style.setProperty(name, value, priority);
    }
    return safe.style.cssText;
}
function sanitizeReaderTree(root) {
    for (const element of Array.from(root.querySelectorAll('*'))) {
        if (!element.parentNode)
            continue;
        const tag = element.tagName;
        if (READER_DROP_TAGS.has(tag)) {
            element.remove();
            continue;
        }
        if (!READER_ALLOWED_TAGS.has(tag)) {
            const parent = element.parentNode;
            while (element.firstChild)
                parent.insertBefore(element.firstChild, element);
            element.remove();
            continue;
        }
        for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            const allowed = READER_SAFE_ATTRIBUTES.has(name) || name.startsWith('aria-') || name.startsWith('data-');
            if (!allowed || name.startsWith('on') || name === 'srcdoc' || name === 'href' || name === 'src' || name === 'xlink:href') {
                element.removeAttribute(attribute.name);
                continue;
            }
            if (name === 'style') {
                const clean = sanitizeReaderStyle(attribute.value);
                if (clean)
                    element.setAttribute('style', clean);
                else
                    element.removeAttribute('style');
            }
        }
        if (tag === 'BUTTON')
            element.setAttribute('type', 'button');
    }
}
function paragraphizeReaderContainer(container) {
    const output = document.createDocumentFragment();
    let paragraph = null;
    const ensureParagraph = () => {
        if (!paragraph) {
            paragraph = document.createElement('p');
            paragraph.className = 'rp-para';
        }
        return paragraph;
    };
    const flushParagraph = () => {
        if (!paragraph)
            return;
        if (paragraph.textContent?.trim() || paragraph.querySelector('br,button'))
            output.appendChild(paragraph);
        paragraph = null;
    };
    for (const child of Array.from(container.childNodes)) {
        if (child.nodeType === 3) {
            for (const chunk of String(child.nodeValue ?? '').split(/(\r?\n+)/)) {
                if (/^\r?\n+$/.test(chunk)) {
                    flushParagraph();
                }
                else if (chunk.trim()) {
                    ensureParagraph().appendChild(document.createTextNode(chunk));
                }
                else if (paragraph) {
                    paragraph.appendChild(document.createTextNode(chunk));
                }
            }
            continue;
        }
        if (child.nodeType !== 1)
            continue;
        const element = child;
        if (READER_BLOCK_TAGS.has(element.tagName)) {
            flushParagraph();
            if (READER_PARAGRAPH_CONTAINERS.has(element.tagName))
                paragraphizeReaderContainer(element);
            output.appendChild(child);
        }
        else {
            ensureParagraph().appendChild(child);
        }
    }
    flushParagraph();
    container.replaceChildren(output);
}
function decorateReaderSemantics(root) {
    for (const heading of root.querySelectorAll('h1,h2,h3'))
        heading.classList.add('rp-page-title');
    const textNodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode())
        textNodes.push(walker.currentNode);
    const dialoguePattern = /(“[^”\n]+”|「[^」\n]+」|『[^』\n]+』|"[^"\n]+")/g;
    for (const node of textNodes) {
        const parent = node.parentElement;
        if (!parent || parent.closest('.rp-dialogue,code,pre,h1,h2,h3,h4,h5,h6'))
            continue;
        const paragraph = parent.closest('.rp-para');
        if (!paragraph)
            continue;
        const paragraphText = String(paragraph.textContent ?? '').trimStart();
        // Do not style every quoted term as speech. The default recognizer covers
        // standalone/leading dialogue and dialogue introduced by a colon; authors
        // can add broader card-specific cases with regexRules.
        if (!/^(?:“|「|『|")/.test(paragraphText) && !/[:：]\s*(?:“|「|『|")/.test(paragraphText))
            continue;
        const authorSpan = parent.closest('span[class],span[style]');
        if (authorSpan) {
            // Reuse the author's element, so its unlayered CSS still overrides the
            // fallback theme. Never nest a second dialogue wrapper over its colors.
            if (!authorSpan.querySelector('code,pre') && /^(?:“[^”\n]+”|「[^」\n]+」|『[^』\n]+』|"[^"\n]+")$/.test(authorSpan.textContent.trim()))
                authorSpan.classList.add('rp-dialogue');
            continue;
        }
        const text = node.nodeValue ?? '';
        const codeRanges = Array.from(text.matchAll(/(`+)(?!`)[\s\S]*?\1(?!`)/g), match => [match.index, match.index + match[0].length]);
        dialoguePattern.lastIndex = 0;
        if (!dialoguePattern.test(text))
            continue;
        dialoguePattern.lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        for (const match of text.matchAll(dialoguePattern)) {
            const index = match.index ?? 0;
            const end = index + match[0].length;
            if (codeRanges.some(([start, codeEnd]) => index < codeEnd && end > start))
                continue;
            if (index > cursor)
                fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
            const span = document.createElement('span');
            span.className = 'rp-dialogue';
            span.textContent = match[0];
            fragment.appendChild(span);
            cursor = index + match[0].length;
        }
        if (cursor < text.length)
            fragment.appendChild(document.createTextNode(text.slice(cursor)));
        node.replaceWith(fragment);
    }
}
function applyReaderInlineMarkdown(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode())
        nodes.push(walker.currentNode);
    const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;
    for (const node of nodes) {
        const parent = node.parentElement;
        if (!parent || parent.closest('code,pre,script,style,.rp-reader-actions'))
            continue;
        const text = String(node.nodeValue ?? '');
        tokenPattern.lastIndex = 0;
        if (!tokenPattern.test(text))
            continue;
        tokenPattern.lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        for (const match of text.matchAll(tokenPattern)) {
            const index = match.index ?? 0;
            if (index > cursor)
                fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
            const token = match[0];
            let element;
            if (token.startsWith('**') || token.startsWith('__')) {
                element = document.createElement('strong');
                element.textContent = token.slice(2, -2);
            }
            else if (token.startsWith('~~')) {
                element = document.createElement('s');
                element.textContent = token.slice(2, -2);
            }
            else if (token.startsWith('`')) {
                element = document.createElement('code');
                element.textContent = token.slice(1, -1);
            }
            else if (token.startsWith('[')) {
                const parsed = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                element = document.createElement('a');
                element.textContent = parsed?.[1] ?? token;
                if (parsed?.[2]) {
                    element.href = parsed[2];
                    element.target = '_blank';
                    element.rel = 'noopener noreferrer';
                }
            }
            else {
                element = document.createElement('em');
                element.textContent = token.slice(1, -1);
            }
            fragment.appendChild(element);
            cursor = index + token.length;
        }
        if (cursor < text.length)
            fragment.appendChild(document.createTextNode(text.slice(cursor)));
        node.replaceWith(fragment);
    }
}
function applyReaderBlockMarkdown(root) {
    for (const paragraph of Array.from(root.querySelectorAll('p.rp-para'))) {
        // Block syntax is converted only when the paragraph is plain text.  Raw
        // author HTML remains authoritative and is never reparsed as Markdown.
        if (paragraph.children.length > 0)
            continue;
        const text = String(paragraph.textContent ?? '');
        const heading = text.match(/^(#{1,6})\s+([\s\S]+)$/);
        if (heading) {
            const h = document.createElement(`h${heading[1].length}`);
            h.textContent = heading[2];
            paragraph.replaceWith(h);
            continue;
        }
        if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
            paragraph.replaceWith(document.createElement('hr'));
            continue;
        }
        const quote = text.match(/^>\s?([\s\S]+)$/);
        if (quote) {
            const blockquote = document.createElement('blockquote');
            blockquote.textContent = quote[1];
            paragraph.replaceWith(blockquote);
        }
    }
}
export async function renderReaderNarrativeAsync(raw, rules, run = runReaderRegex) {
    const source = await run({ op: 'source', text: String(raw ?? ''), rules: Array.isArray(rules) ? rules : [] });
    const template = document.createElement('template');
    template.innerHTML = source.output.replace(/\\(?=<\/?[a-z][^>]*>)/gi, '').replace(/&lt;(\/?[a-z][^&]*?)&gt;/gi, '<$1>')
        .replace(/\\(\*{1,2}|_{1,2}|~~|`)/g, '$1').replace(/^\\(#{1,6}|[-*+]|>)(?=\s)/gm, '$1');
    sanitizeReaderTree(template.content);
    paragraphizeReaderContainer(template.content);
    applyReaderBlockMarkdown(template.content);
    const after = [];
    for (const i of source.deferred) {
        const rule = rules[i], nodes = [], walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
        while (walker.nextNode())
            if (walker.currentNode.parentElement && !walker.currentNode.parentElement.closest('code,pre,script,style'))
                nodes.push(walker.currentNode);
        const result = await run({ op: 'fallback', html: template.innerHTML, rule, nodes: nodes.map(n => n.nodeValue ?? '') });
        if (result.kind === 'html')
            template.innerHTML = result.html;
        else if (result.kind === 'quote')
            for (const edit of result.edits) {
                const fragment = document.createDocumentFragment();
                for (const part of edit.parts) {
                    if (part.text !== undefined)
                        fragment.appendChild(document.createTextNode(part.text));
                    else {
                        const t = document.createElement('template');
                        t.innerHTML = part.html;
                        fragment.appendChild(t.content);
                    }
                }
                nodes[edit.node].replaceWith(fragment);
            }
        else
            after.push(rule);
    }
    sanitizeReaderTree(template.content);
    paragraphizeReaderContainer(template.content);
    decorateReaderSemantics(template.content);
    applyReaderInlineMarkdown(template.content);
    if (after.length) {
        const result = await run({ op: 'source', text: template.innerHTML, rules: after });
        if (result.matched) {
            template.innerHTML = result.output;
            sanitizeReaderTree(template.content);
            paragraphizeReaderContainer(template.content);
            decorateReaderSemantics(template.content);
        }
    }
    return template.innerHTML;
}
function applyReaderQuoteFallback(root, rule) {
    // Compatibility is restricted to text nodes and rules explicitly written
    // for Chinese double quotes. Attributes and code are never normalized.
    if (!rule.match.includes('“') || !rule.match.includes('”'))
        return false;
    let changed = false;
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode())
        nodes.push(walker.currentNode);
    for (const node of nodes) {
        if (!node.parentElement || node.parentElement.closest('code,pre,script,style'))
            continue;
        const original = node.nodeValue ?? '';
        const codeRanges = Array.from(original.matchAll(/(`+)(?!`)[\s\S]*?\1(?!`)/g), match => [match.index, match.index + match[0].length]);
        const shadow = original.replace(/"([^"\n]+)"/g, (whole, content, index) => {
            const end = index + whole.length;
            return codeRanges.some(([start, codeEnd]) => index < codeEnd && end > start) ? whole : `“${content}”`;
        });
        if (shadow === original)
            continue;
        const fragment = document.createDocumentFragment();
        const sticky = new RegExp(rule.match, 'y');
        let cursor = 0, matched = false;
        for (const match of shadow.matchAll(new RegExp(rule.match, 'g'))) {
            const index = match.index;
            if (original.slice(index, index + match[0].length) === match[0])
                continue;
            fragment.appendChild(document.createTextNode(original.slice(cursor, index)));
            // Let JavaScript expand $1/$&/named captures exactly as in a source rule.
            // Only the matched replacement comes from the normalized shadow string.
            sticky.lastIndex = index;
            const replaced = shadow.replace(sticky, String(rule.replace ?? ''));
            const suffixLength = shadow.length - index - match[0].length;
            const replacement = document.createElement('template');
            replacement.innerHTML = replaced.slice(index, suffixLength ? -suffixLength : undefined);
            fragment.appendChild(replacement.content);
            cursor = index + match[0].length;
            matched = true;
        }
        if (matched) {
            fragment.appendChild(document.createTextNode(original.slice(cursor)));
            node.replaceWith(fragment);
            changed = true;
        }
    }
    return changed;
}
function applyReaderHtmlRule(template, rule) {
    const regex = new RegExp(rule.match, 'g');
    if (!regex.test(template.innerHTML))
        return false;
    regex.lastIndex = 0;
    template.innerHTML = template.innerHTML.replace(regex, String(rule.replace ?? ''));
    return true;
}
export function renderReaderNarrative(raw, rules) {
    let output = String(raw ?? '');
    const deferred = [];
    for (const rule of Array.isArray(rules) ? rules : []) {
        try {
            if (typeof rule?.match !== 'string')
                continue;
            const regex = new RegExp(rule.match, 'g');
            if (regex.test(output)) {
                regex.lastIndex = 0;
                output = output.replace(regex, String(rule.replace ?? ''));
            }
            else
                deferred.push(rule);
        }
        catch { }
    }
    // anydoc/older card readers may defensively prefix Markdown and literal
    // markup with a backslash. Undo only unambiguous presentation escapes before
    // parsing HTML; ordinary prose backslashes remain untouched.
    output = output
        .replace(/\\(?=<\/?[a-z][^>]*>)/gi, '')
        .replace(/&lt;(\/?[a-z][^&]*?)&gt;/gi, '<$1>')
        .replace(/\\(\*{1,2}|_{1,2}|~~|`)/g, '$1')
        .replace(/^\\(#{1,6}|[-*+]|>)(?=\s)/gm, '$1');
    const template = document.createElement('template');
    template.innerHTML = output;
    sanitizeReaderTree(template.content);
    paragraphizeReaderContainer(template.content);
    applyReaderBlockMarkdown(template.content);
    // Markdown headings now exist as real HTML. Only rules that did not match
    // source get this fallback, so a replacement cannot wrap itself twice.
    const afterInline = [];
    for (const rule of deferred) {
        try {
            if (!applyReaderHtmlRule(template, rule) && !applyReaderQuoteFallback(template.content, rule))
                afterInline.push(rule);
        }
        catch { }
    }
    sanitizeReaderTree(template.content);
    paragraphizeReaderContainer(template.content);
    // Wrap complete dialogue spans before replacing inline Markdown tokens.
    // Otherwise a quote containing **bold** is split into multiple text nodes and
    // the dialogue recognizer can no longer see its closing quote.
    decorateReaderSemantics(template.content);
    applyReaderInlineMarkdown(template.content);
    let inlineMatched = false;
    for (const rule of afterInline) {
        try {
            if (applyReaderHtmlRule(template, rule))
                inlineMatched = true;
        }
        catch { }
    }
    if (inlineMatched) {
        sanitizeReaderTree(template.content);
        paragraphizeReaderContainer(template.content);
        decorateReaderSemantics(template.content);
    }
    return template.innerHTML;
}
