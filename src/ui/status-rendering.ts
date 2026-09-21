
// Older card importers persisted the status template as escaped HTML (and a
// few alpha builds kept the defensive backslash before the opening tag). Decode
// only the five HTML entities that can form markup; leave arbitrary prose and
// unknown entities untouched. This runs before style scoping, never through
// innerHTML, so it cannot create a second DOM execution path.
export function decodeStatusTemplate(value: unknown) {
    return String(value ?? '')
        .replace(/\\(?=<\/?[a-z][^>]*>)/gi, '')
        .replace(/&lt;/gi, '<').replace(
    /&gt;/gi,
        '>'
    )
        .replace(
    /&quot;/gi,
        '"'
    ).replace(
    /&#39;/gi,
        "'"
    )
        .replace(
    /&amp;/gi,
        '&'
    );
}


export function statusFactsHtml(value: unknown, options: ReadonlyArray<{label?: unknown;}> = []) {
    const html = String(value ?? '');
    if (!html) return html;
    const template = document.createElement('template');
    template.innerHTML = html;
    const root = template.content;
    let changed = false;
    const remove = (element: Element) => { element.remove(); changed = true; };
    // Old cards put actions inside author HTML; keep the stored source intact.
    for (const element of root.querySelectorAll('.rp-status__acts, [data-roleplay-actions]')) remove(element);
    const text = (value: unknown) => String(value ?? '').replace(/\s+/g, '').replace(/^[❤️♥♡]+/u, '');
    const labels = new Set(options.map(option => text(option.label)).filter(Boolean));
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,span,p,div,summary')) {
        if (!root.contains(heading) || heading.children.length) continue;
        if (!/^(?:可以试试|下一步|(?:接下来的)?活动建议|行动建议|可选行动|建议行动|接下来做什么)[：:？?]?(?:[（(]点击可复制[）)])?[：:]?$/.test(text(heading.textContent))) continue;
        // Legacy fallback HTML placed the heading and option rows in one list.
        const row = heading.closest('li');
        const anchor = row && text(row.textContent) === text(heading.textContent) ? row : heading;
        let next = anchor.nextElementSibling;
        if (!next?.matches('ol,ul') && !labels.has(text(next?.textContent))) continue;
        if (next?.matches('ol,ul')) remove(next);
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
    for (const element of root.querySelectorAll('.f')) remove(element);
    return changed ? template.innerHTML : html;
}
