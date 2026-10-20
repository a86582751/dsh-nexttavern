// Generated from runtime/alpha3/src/ui/reader-community.ts; edit the TypeScript source.
import { COMMUNITY_READER_WINDOW_MESSAGES } from '../core/community-preset-types.js';
export function createReaderCommunityCache(jsonFetch) {
    const entries = new Map();
    let selected = '', failed = false;
    let lastTasks = [], revision = 0;
    const key = (task) => JSON.stringify([task.seq, task.messageId, task.depth]);
    const cached = (task) => {
        const entry = entries.get(key(task));
        return entry?.sourceText === task.text ? entry.text : undefined;
    };
    function selectScope(scope) {
        if (selected !== scope) {
            entries.clear();
            selected = scope;
            failed = false;
            lastTasks = [];
        }
    }
    function versionFor(tasks) {
        if (tasks.length !== lastTasks.length || tasks.some((task, index) => {
            const previous = lastTasks[index];
            return task.seq !== previous.seq || task.messageId !== previous.messageId || task.depth !== previous.depth || task.text !== previous.text;
        })) {
            lastTasks = tasks;
            revision++;
        }
        return revision;
    }
    function run(scope, sessionId, tasks, changed) {
        selectScope(scope);
        const pending = tasks.filter(task => cached(task) === undefined);
        if (!pending.length)
            return;
        const controller = new AbortController();
        void jsonFetch('/api/roleplay/regexes', { method: 'POST', signal: controller.signal,
            headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'display', sessionId,
                messages: pending.map(({ seq, messageId }) => ({ seq, messageId })) }) }).then(reply => {
            if (controller.signal.aborted || selected !== scope)
                return;
            const byId = new Map(reply.results.map(result => [`${result.seq}:${result.messageId}`, result]));
            for (const task of pending) {
                const result = byId.get(`${task.seq}:${task.messageId}`);
                if (result?.sourceText === task.text)
                    entries.set(key(task), { sourceText: task.text, text: result.text });
            }
            const active = new Set(tasks.map(key));
            while (entries.size > COMMUNITY_READER_WINDOW_MESSAGES) {
                const oldest = [...entries.keys()].find(key => !active.has(key));
                if (oldest === undefined)
                    break;
                entries.delete(oldest);
            }
            failed = false;
            changed();
        }).catch(() => { if (!controller.signal.aborted && selected === scope) {
            failed = true;
            changed();
        } });
        return () => controller.abort('Reader scope changed');
    }
    return { selectScope, versionFor, run, textFor: (task) => cached(task) ?? task.text, failed: () => failed };
}
/** Known option scripts become inert markup on the server. This DOM step
 * creates native buttons using textContent; imported event handlers never run. */
export function renderCommunityOptions(html) {
    if (!html.includes('data-community-options'))
        return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    for (const panel of Array.from(template.content.querySelectorAll('[data-community-options]'))) {
        const text = (panel.querySelector('pre')?.textContent ?? panel.textContent ?? '').replace(/\r\n?/g, '\n');
        let options;
        if (panel.dataset.communityOptions === 'izumi') {
            const matches = [...text.matchAll(/^[\t ]*>[\t ]*选项[\t ]*[0-9０-９零〇一二三四五六七八九十百千万亿两]+[\t ]*[:：][\t ]*/gm)];
            options = matches.map((match, index) => text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length).trim());
        }
        else
            options = text.split('\n').map(line => line.replace(/^\s*\d+\s*[.、.)）:：]\s*/, '').trim()).filter(Boolean);
        if (!options.length)
            continue;
        panel.replaceChildren();
        const label = document.createElement('p');
        label.textContent = '选择内容会追加到输入草稿';
        panel.append(label);
        for (const [index, text] of options.entries()) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'community-option f';
            button.dataset.communityOption = text;
            button.textContent = `${index + 1}. ${text}`;
            panel.append(button);
        }
    }
    return template.innerHTML;
}
export function createCommunityOptionsRenderer() {
    const cache = new Map();
    return (html) => {
        if (!html.includes('data-community-options'))
            return { html, frameHtml: html, options: [] };
        const prior = cache.get(html);
        if (prior !== undefined) {
            cache.delete(html);
            cache.set(html, prior);
            return prior;
        }
        const rendered = renderCommunityOptions(html), template = document.createElement('template');
        template.innerHTML = rendered;
        const options = [];
        for (const panel of Array.from(template.content.querySelectorAll('[data-community-options]'))) {
            const buttons = Array.from(panel.querySelectorAll('[data-community-option]'));
            if (!buttons.length)
                continue;
            for (const button of buttons)
                options.push({ id: String(options.length), text: button.dataset.communityOption, label: button.textContent ?? '' });
            panel.remove();
        }
        const result = { html: rendered, frameHtml: template.innerHTML, options };
        cache.set(html, result);
        while (cache.size > COMMUNITY_READER_WINDOW_MESSAGES)
            cache.delete(cache.keys().next().value);
        return result;
    };
}
export const COMMUNITY_READER_CSS = `
.community-options{display:grid;gap:.55rem;padding:.8rem;border:1px solid #d7bfbb;border-radius:12px;margin:1rem 0}
.community-options p{font-size:.85em;opacity:.75;margin:0}
.community-option{white-space:pre-wrap;text-align:left;border:1px solid #cbb2b6;border-radius:8px;background:transparent;color:inherit;padding:.65rem;cursor:pointer}
.community-thinking,.community-bubble{margin:.6rem 0;padding:.55rem .7rem;border:1px solid #c9bfc7;border-radius:10px}
.community-bubble{display:inline-block;background:color-mix(in srgb,currentColor 4%,transparent)}
.community-danmu{padding:.5rem 1rem;border-left:3px solid #b498b3;white-space:pre-wrap;opacity:.85}
`;
