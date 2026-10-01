// Generated from runtime/alpha3/src/core/roleplay-status-presentation.ts; edit the TypeScript source.
import { statusTemplateHtml } from '../status-template.js';
import { TaskValidationError } from './tavern-task-support.js';
export const textAlias = (object, keys) => {
    const source = (object && typeof object === 'object' ? object : {});
    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && String(value).trim())
            return String(value).trim();
    }
    return '';
};
export const normalizeStatusField = (field) => {
    const source = (field && typeof field === 'object' ? field : {});
    return {
        ...source,
        emoji: textAlias(source, ['emoji', 'icon']),
        // Gemini 3.7 may encode a field as { reason: "字段名" }.
        // Options have their own normalizer, where reason means option text.
        label: textAlias(source, ['label', 'name', 'title', 'key', 'reason']),
        value: textAlias(source, ['value', 'text', 'content', 'description', 'detail']),
    };
};
export const normalizeStatusOption = (option) => {
    const source = (option && typeof option === 'object' ? option : {});
    return {
        ...source,
        label: textAlias(source, ['label', 'text', 'value', 'reason', 'content', 'name', 'title']),
        description: textAlias(source, ['description', 'detail', 'desc']),
        heart: source.heart === true,
    };
};
export const escapeStatusHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');
export const fallbackStatusHtml = (title, fields, rawText) => {
    const items = fields.map((field) => {
        const label = escapeStatusHtml(field.label);
        const value = escapeStatusHtml(field.value);
        const emoji = escapeStatusHtml(field.emoji);
        return `<li style="margin:6px 0">${emoji ? `${emoji} ` : ''}<strong>${label}</strong>${label ? '：' : ''}${value}</li>`;
    }).join('');
    const body = items || (rawText ? `<li style="margin:6px 0">${escapeStatusHtml(rawText)}</li>` : '');
    return `<div style="display:block;border:3px solid rgba(52,152,219,.72);border-radius:15px;background:rgba(234,236,238,.86);width:100%;min-height:180px;max-height:330px;margin:0 auto;color:#D87093;font:750 16px system-ui;overflow-y:auto;box-sizing:border-box;padding:10px 12px"><h3 style="text-align:center;font-size:18px;margin:2px 0 8px">${escapeStatusHtml(title
        || '状态栏')}</h3><ul style="list-style:none;padding:0 5px;margin:0;line-height:1.5">${body}</ul></div>`;
};
export const normalizeStatusPanel = (panel) => {
    const source = (panel && typeof panel === 'object' ? panel : {});
    const title = textAlias(source, ['title', 'name']);
    const fields = Array.isArray(source.fields) ? source.fields.map(normalizeStatusField) : [];
    const options = Array.isArray(source.options)
        ? source.options.map(normalizeStatusOption).filter((option) => option.label).slice(0, 4)
        : [];
    const rawText = textAlias(source, ['rawText', 'text', 'content']);
    return {
        ...source,
        title,
        html: typeof source.html === 'string' && source.html.trim()
            ? source.html
            : fallbackStatusHtml(title, fields, rawText),
        fields,
        options,
        rawText,
    };
};
export const authoredStatusTemplate = (spec) => {
    const template = statusTemplateHtml(spec?.templateHtml || (/<\/?[a-z][^>]*>/i.test(spec?.text ?? '') ? spec.text : '')).trim();
    if (!template)
        return '';
    // A style fragment alone (or a truncated style/script block) is damaged,
    // not an author layout. Prose instructions are not HTML templates.
    for (const tag of ['style', 'script']) {
        if ((template.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length !==
            (template.match(new RegExp(`</${tag}\\s*>`, 'gi')) ?? []).length)
            return '';
    }
    const body = template.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    return /<(?:div|section|article|aside|table|details|ul|ol|p|span|h[1-6])\b[^>]*>[\s\S]*<\//i.test(body) ? template : '';
};
export const statusPanelForSpec = (value, spec, { strict = false } = {}) => {
    const raw = value;
    const reject = (path, rule, expected, actual) => {
        if (strict)
            throw new TaskValidationError(`状态结果没有保留作者模板：${path} (${rule})`, [{
                    path, rule, expected, actual
                }], 'STATUS_TEMPLATE_MISMATCH');
        return null;
    };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        return reject('result', 'object-required', 'object', Array.isArray(raw) ? 'array' : typeof raw);
    const template = authoredStatusTemplate(spec);
    let html = typeof raw.html === 'string' ? raw.html : '';
    if (template) {
        // A fields-only response must retry instead of silently selecting the
        // generic theme. Preserve author CSS/JS and structural hooks exactly.
        if (!authoredStatusTemplate({
            templateHtml: html
        }))
            return reject('html', 'html-required', 'complete-author-html', html.trim() ? 'incomplete-html' : 'missing-html');
        const staticBlock = /<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
        const blocks = template.match(staticBlock) ?? [];
        const body = html.replace(staticBlock, '');
        const attributes = (source) => [...source.matchAll(/\b(style|class|id)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
            .map(([, name, double, single]) => ({
            name: name.toLowerCase(), value: double ?? single
        }));
        const actual = attributes(body);
        const canonical = (value) => value.replace(/⟦([^⟦⟧]+)⟧/g, '{{$1}}');
        const matches = (expected, candidate) => {
            if (expected.name !== candidate.name)
                return false;
            const wanted = canonical(expected.value), got = canonical(candidate.value);
            if (wanted === got)
                return true;
            // Only explicit author slots vary. A slot cannot swallow a new CSS
            // declaration or HTML attribute; static hooks remain protected.
            const slots = [...wanted.matchAll(/\{\{(?!(?:user|user_gender|char)\}\})([^{}]+)\}\}/g)];
            let offset = 0, position = 0;
            for (let index = 0; index < slots.length; index++) {
                const slot = slots[index], prefix = wanted.slice(offset, slot.index);
                if (!got.startsWith(prefix, position))
                    return false;
                position += prefix.length;
                const end = slot.index + slot[0].length, next = wanted.slice(end, slots[index + 1]?.index ?? wanted.length);
                if (got.startsWith(slot[0], position))
                    position += slot[0].length;
                else {
                    // Linear matching avoids constructing backtracking patterns from
                    // untrusted author templates. Adjacent dynamic slots share a value.
                    const boundary = next ? got.indexOf(next, position) : got.length;
                    if (boundary < position || !/^[^;"'<>={}]*$/.test(got.slice(position, boundary)))
                        return false;
                    position = boundary;
                }
                offset = end;
            }
            return got.slice(position) === wanted.slice(offset);
        };
        const expected = attributes(template.replace(staticBlock, ''));
        for (let index = 0; index < expected.length; index++)
            if (!actual.some(candidate => matches(expected[index], candidate)))
                return reject(`html.attributes[${index}].${expected[index].name}`, 'author-static-attribute', 'author-value-with-dynamic-slots', 'missing-or-changed');
        // Keep exact author CSS/JS in code, not a paid model copying exercise.
        const remaining = [...blocks];
        html = html.replace(staticBlock, (_block, tag) => {
            const index = remaining.findIndex(block => new RegExp(`^<${tag}\\b`, 'i').test(block));
            return index < 0 ? '' : remaining.splice(index, 1)[0];
        });
        html = remaining.filter(block => /^<style\b/i.test(block)).join('') + html
            + remaining.filter(block => /^<script\b/i.test(block)).join('');
    }
    const normalized = normalizeStatusPanel({
        ...raw, html
    });
    if (!html.trim() && !normalized.rawText && !normalized.fields.some(field => field.label || field.value))
        return null;
    return {
        ...normalized,
        ...(template ? {
            templateHtml: spec?.templateHtml || spec?.text || template
        } : {})
    };
};
export const normalizeStatusRecord = (record) => {
    if (!record || typeof record !== 'object')
        return null;
    return {
        ...record, panel: normalizeStatusPanel(record.panel ?? record)
    };
};
export const normalizeDecisionRecord = (value) => {
    const record = value;
    if (!record || typeof record !== 'object')
        return null;
    return {
        ...record,
        options: Array.isArray(record.options)
            ? record.options.map(normalizeStatusOption).filter((option) => option.label).slice(0, 4)
            : [],
    };
};
