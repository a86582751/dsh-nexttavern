// Generated from runtime/alpha3/status-template.ts; edit the TypeScript source.
/** Pure card assets shared by authoring, status generation and legacy display.
 * Source snapshots/provenance stay untouched; only closed top-level fences count. */
export function cardCodeBlocks(value) {
    const blocks = [];
    const outside = [];
    let fence = null;
    for (const line of String(value ?? '').replace(/\r\n/g, '\n').split('\n')) {
        if (!fence) {
            const open = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/);
            if (open)
                fence = { marker: open[1][0], length: open[1].length, language: open[2].trim().toLowerCase(), lines: [] };
            else
                outside.push(line);
            continue;
        }
        const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
        if (close && close[1][0] === fence.marker && close[1].length >= fence.length) {
            blocks.push({ language: fence.language, code: fence.lines.join('\n') });
            fence = null;
        }
        else
            fence.lines.push(line);
    }
    return { blocks, outside: outside.join('\n'), unclosed: fence?.language ?? null };
}
/** Main story writers need state constraints, never the renderer's examples.
 * Keep the original spec intact for the dedicated status task. */
export function statusAuthorRules(value) {
    const parsed = cardCodeBlocks(value);
    const text = [parsed.outside, ...parsed.blocks.filter(block => !['html', 'css', 'style', 'js', 'javascript'].includes(block.language)
            && !/<\/?[a-z][^>]*>/i.test(block.code)).map(block => block.code)].join('\n');
    const tags = /<\/?([a-z][\w:-]*)\b[^>]*>/gi, stack = [], out = [];
    let cursor = 0;
    for (const match of text.matchAll(tags)) {
        const start = match.index, tag = match[0], name = match[1].toLowerCase();
        if (!stack.length)
            out.push(text.slice(cursor, start));
        if (/^<\//.test(tag)) {
            const at = stack.lastIndexOf(name);
            if (at >= 0)
                stack.splice(at);
        }
        else if (!/\/\s*>$/.test(tag) && !/^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(name))
            stack.push(name);
        cursor = start + tag.length;
    }
    if (!stack.length)
        out.push(text.slice(cursor));
    return out.join('').replace(/^#{1,6}[^\n]*(?:HTML|CSS|模板|样式)[^\n]*$/gim, '').trim();
}
export function restoreStatusTemplateCss(html, template) {
    const existing = new Set([...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)]
        .map(match => match[1].replace(/\r\n/g, '\n').trim()));
    const styles = [];
    for (const block of cardCodeBlocks(template).blocks) {
        if (block.language !== 'css')
            continue;
        // CSS string/comment content cannot close the surrounding HTML style tag.
        const css = block.code.trim().replace(/<\/style/gi, '<\\/style');
        if (!css || existing.has(css))
            continue;
        existing.add(css);
        styles.push('<style>' + css + '</style>');
    }
    return styles.join('\n') + (styles.length ? '\n' : '') + html;
}
export function statusTemplateHtml(value) {
    const source = String(value ?? '');
    const parsed = cardCodeBlocks(source);
    const layouts = parsed.blocks.filter(block => block.language === 'html');
    let html = layouts.map(block => block.code).join('\n');
    if (layouts.length) {
        // Existing cards may put literal style/script tags beside an HTML fence.
        // Keep those assets too, while code examples in other fences remain inert.
        const blocks = parsed.outside.match(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi) ?? [];
        html = blocks.filter(block => !html.includes(block)).join('\n') + html;
    }
    else
        html = parsed.blocks.length || parsed.unclosed !== null ? parsed.outside : source;
    return restoreStatusTemplateCss(html, source);
}
export function statusTemplateDiagnostics(value) {
    // Simple field/text status definitions intentionally use the native fallback.
    if (!/<\/?[a-z][^>]*>|^ {0,3}(?:`{3,}|~{3,})(?:html|css)\b/im.test(String(value ?? ''))) {
        return { renderable: true, mode: 'fields', cssBlocks: 0, errors: [] };
    }
    const parsed = cardCodeBlocks(value), html = statusTemplateHtml(value), errors = [];
    if (parsed.unclosed === 'html' || parsed.unclosed === 'css')
        errors.push(`状态栏 ${parsed.unclosed.toUpperCase()} 代码块未闭合`);
    for (const tag of ['style', 'script']) {
        if ((html.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length !== (html.match(new RegExp(`</${tag}\\s*>`, 'gi')) ?? []).length)
            errors.push(`状态栏 ${tag} 标签未闭合`);
    }
    const body = html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    const hasHtml = /<(?:div|section|article|aside|table|details|ul|ol|p|span|h[1-6])\b[^>]*>[\s\S]*<\//i.test(body);
    if (!hasHtml)
        errors.push('状态栏章节缺少完整 HTML 模板；HTML 与配套 CSS 必须一起提供');
    return { renderable: errors.length === 0, mode: 'author', cssBlocks: (html.match(/<style\b/gi) ?? []).length, errors };
}
