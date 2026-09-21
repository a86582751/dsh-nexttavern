// Generated from runtime/alpha3/src/ui/reader-model.ts; edit the TypeScript source.
import { decodeStatusTemplate } from './reader-rendering.js';
import { restoreStatusTemplateCss } from '../status-template.js';
const isRecord = (value) => !!value && typeof value === 'object';
const textAlias = (value, keys) => {
    if (!isRecord(value))
        return '';
    for (const key of keys) {
        const text = value[key];
        if (text !== undefined && text !== null && String(text).trim())
            return String(text).trim();
    }
    return '';
};
export function normalizeField(field) {
    const source = isRecord(field) ? field : {};
    return {
        ...source,
        emoji: textAlias(source, ['emoji', 'icon', 'chip']),
        label: textAlias(source, ['label', 'name', 'key', 'reason', 'title']),
        value: textAlias(source, ['value', 'text', 'content', 'description', 'detail']),
    };
}
export function normalizeOption(option) {
    const source = isRecord(option) ? option : {};
    return {
        ...source,
        label: textAlias(source, ['label', 'text', 'value', 'reason', 'content', 'name', 'title']),
        description: textAlias(source, ['description', 'detail', 'desc']),
        heart: source.heart === true,
    };
}
const normalizeOptions = (value) => Array.isArray(value)
    ? value.map(normalizeOption).filter(option => option.label).slice(0, 4)
    : [];
export function normalizePanel(value) {
    const record = isRecord(value) ? (value.record ?? value) : undefined;
    const source = isRecord(record) ? (record.panel ?? record) : undefined;
    if (!isRecord(source))
        return null;
    const templateHtml = source.html ?? source.templateHtml ?? source.template ?? '';
    const recordValue = isRecord(record) ? record : {};
    const atSeqValue = recordValue.atSeq ?? source.atSeq;
    const timeValue = recordValue.time ?? source.time;
    return {
        ...source,
        atSeq: Number.isFinite(Number(atSeqValue)) ? Number(atSeqValue) : -1,
        turnId: recordValue.turnId ?? source.turnId ?? null,
        time: Number.isFinite(Number(timeValue)) ? Number(timeValue) : 0,
        title: textAlias(source, ['title', 'name', 'rawText']),
        html: typeof templateHtml === 'string' && templateHtml.trim()
            ? restoreStatusTemplateCss(decodeStatusTemplate(templateHtml), source.templateHtml ?? source.template) : '',
        fields: Array.isArray(source.fields) ? source.fields.map(normalizeField) : [],
        options: normalizeOptions(source.options),
    };
}
export function normalizeDecision(value) {
    const sourceValue = isRecord(value) ? (value.record ?? value) : undefined;
    if (!isRecord(sourceValue))
        return null;
    return {
        ...sourceValue,
        options: normalizeOptions(sourceValue.options),
    };
}
export function userValuesFromState(state) {
    const stateRecord = isRecord(state) ? state : {};
    const info = isRecord(stateRecord.userinfo) ? stateRecord.userinfo : null;
    const cards = Array.isArray(stateRecord.cards) ? stateRecord.cards : [];
    const playerCard = cards.find(card => {
        if (!isRecord(card))
            return false;
        return card.kind === 'user' || card.id === 'user' || card.card_id === 'user';
    });
    const cardRecord = isRecord(playerCard) ? playerCard : {};
    const rawCardName = String(cardRecord.name ?? '').trim();
    const cardName = /\{\{\s*(?:user|user_name)\s*\}\}/i.test(rawCardName) ? '' : rawCardName;
    return {
        name: String(info?.name ?? '').trim() || cardName || '用户',
        gender: String(info?.gender ?? '').trim(),
    };
}
export function renderUserVars(text, state) {
    const values = userValuesFromState(state);
    let output = String(text ?? '')
        .replace(/\{\{\s*(?:user[_-]gender|userGender)\s*\}\}/gi, values.gender)
        .replace(/\{\{\s*(?:user|user_name)\s*\}\}/gi, values.name);
    // Old records sometimes contain the configured default instead of a variable.
    output = output.replace(/无名客\s*\/\s*男/g, values.name + ' / ' + (values.gender || '男'));
    if (values.name !== '无名客')
        output = output.replace(/无名客/g, values.name);
    return output;
}
const readCollectionValue = (value, key) => {
    if (!isRecord(value) || typeof value.get !== 'function')
        return undefined;
    return value.get(key);
};
const readCollectionValues = (value) => {
    if (!isRecord(value) || typeof value.values !== 'function')
        return [];
    const result = value.values();
    return Array.from(result);
};
export function normalizeConversationNodes(snapshot) {
    const sourceValue = isRecord(snapshot) ? (snapshot.snapshot ?? snapshot) : snapshot;
    if (!isRecord(sourceValue) && !Array.isArray(sourceValue))
        return [];
    const source = sourceValue;
    let list = [];
    let chat = null;
    if (isRecord(source) && isRecord(source.views)) {
        try {
            chat = readCollectionValue(source.views, 'chat');
        }
        catch { }
    }
    if (isRecord(chat) && Array.isArray(chat.order) && isRecord(chat.nodes) && typeof chat.nodes.get === 'function') {
        list = chat.order.map(key => readCollectionValue(chat.nodes, key)).filter(Boolean);
    }
    else if (isRecord(chat) && Array.isArray(chat.nodes))
        list = chat.nodes;
    else if (isRecord(chat) && isRecord(chat.nodes) && typeof chat.nodes.values === 'function')
        list = readCollectionValues(chat.nodes);
    else if (isRecord(chat) && isRecord(chat.legacy) && Array.isArray(chat.legacy.nodes))
        list = chat.legacy.nodes;
    else if (Array.isArray(source))
        list = source;
    else {
        const candidates = ['nodes', 'messages', 'events', 'items', 'transcript', 'records', 'entries'];
        const found = candidates.map(key => source[key]).find(Array.isArray);
        list = Array.isArray(found) ? found : [];
    }
    return list.filter(Boolean).map(item => {
        if (!isRecord(item))
            return item;
        const role = String(item.role ?? (isRecord(item.author) ? item.author.role : undefined) ?? '').toLowerCase();
        const type = String(item.kind ?? item.type ?? item.eventType ?? '').toLowerCase();
        const kind = type.includes('user') || role === 'user'
            ? 'user'
            : type.includes('assistant') || type.includes('narrator') || role === 'assistant'
                ? 'assistant'
                : item.kind;
        if (isRecord(item.data))
            return { ...item, kind };
        const content = item.content ?? item.text ?? item.message;
        return { ...item, kind, data: { text: typeof content === 'string' ? content : '' } };
    });
}
export function textFromNodeValue(value, depth = 0) {
    if (depth > 5 || value === null || value === undefined)
        return '';
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value)) {
        return value
            .filter(item => !isRecord(item) || item.kind === undefined || item.kind === 'text' || item.type === 'text')
            .map(item => textFromNodeValue(item, depth + 1)).filter(Boolean).join('\n');
    }
    if (!isRecord(value))
        return '';
    for (const key of ['text', 'content', 'body', 'value', 'message']) {
        const text = textFromNodeValue(value[key], depth + 1);
        if (text)
            return text;
    }
    for (const key of ['blocks', 'parts', 'items']) {
        const text = textFromNodeValue(value[key], depth + 1);
        if (text)
            return text;
    }
    return '';
}
export function readerText(node) {
    if (!isRecord(node))
        return '';
    const kind = String(node.kind ?? node.type ?? '').toLowerCase();
    if (kind === 'user' || kind === 'steering') {
        const data = isRecord(node.data) ? node.data : {};
        const blocks = data.content ?? node.content;
        if (Array.isArray(blocks)) {
            return blocks
                .filter(block => isRecord(block) && (block.type === 'text' || block.kind === 'text'))
                .map(block => String(isRecord(block) ? block.text ?? block.value ?? '' : ''))
                .filter(Boolean).join('\n');
        }
    }
    if (kind === 'assistant-step' || kind === 'assistant' || kind === 'narrator') {
        const data = isRecord(node.data) ? node.data : {};
        const blocks = data.blocks ?? node.blocks;
        if (Array.isArray(blocks)) {
            return blocks
                .filter(block => isRecord(block) && (block.kind === 'text' || block.type === 'text'))
                .map(block => String(isRecord(block) ? block.text ?? block.value ?? '' : ''))
                .filter(Boolean).join('\n');
        }
    }
    return textFromNodeValue(node.data ?? node);
}
export function readerNodeSeq(node) {
    const record = isRecord(node) ? node : {};
    const data = isRecord(record.data) ? record.data : {};
    const finalNode = isRecord(data.finalNode) ? data.finalNode : {};
    const seq = Number(finalNode.seq ?? data.seq ?? record.seq);
    return Number.isSafeInteger(seq) ? seq : null;
}
export function readerMessageId(node) {
    const record = isRecord(node) ? node : {};
    const data = isRecord(record.data) ? record.data : {};
    const finalNode = isRecord(data.finalNode) ? data.finalNode : {};
    const value = finalNode.messageId ?? data.messageId;
    return value === undefined || value === null ? '' : String(value);
}
export function readerTime(node) {
    const record = isRecord(node) ? node : {};
    const data = isRecord(record.data) ? record.data : {};
    const value = Number(data.time ?? record.time);
    return Number.isFinite(value) ? value : 0;
}
export function formatReaderTime(value) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0)
        return '';
    try {
        return new Intl.DateTimeFormat(undefined, {
            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }).format(new Date(Number(value)));
    }
    catch {
        return '';
    }
}
export function usageTokens(usage) {
    if (!isRecord(usage))
        return null;
    const keys = ['totalTokens', 'total_tokens', 'inputTokens', 'input_tokens', 'outputTokens', 'output_tokens'];
    const values = keys.map(key => Number(usage[key])).filter(Number.isFinite);
    if (!values.length)
        return null;
    const explicit = Number(usage.totalTokens ?? usage.total_tokens);
    return Number.isFinite(explicit) ? explicit : values.reduce((sum, value) => sum + value, 0);
}
