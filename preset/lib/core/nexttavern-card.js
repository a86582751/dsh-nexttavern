// Generated from runtime/alpha3/src/core/nexttavern-card.ts; edit the TypeScript source.
// NextTavern's author document is portable DATA. Archive fields never execute.
import { createHash } from 'node:crypto';
export const NATIVE_NEXTTAVERN_AUTHOR_EXTENSION_KEY = 'dsh_nexttavern_author';
/** Activation and export address the same original array positions. */
export function nextTavernCardSourceIdV1(document) {
    return `tavern-${createHash('sha256').update(JSON.stringify(document)).digest('hex').slice(0, 16)}`;
}
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const NEXTTAVERN_ST_MACRO_FIELDS = Object.freeze(['description', 'personality', 'scenario',
    'mes_example', 'system_prompt', 'post_history_instructions']);
/** Aliases retain their activated ST meanings independently of edited prose. */
export function readTavernCardMacroFields(data, format) {
    return format === 'json-nexttavern-v1' && object(data.compatibility) && object(data.compatibility.sillytavernMacroFields)
        ? data.compatibility.sillytavernMacroFields : data;
}
// Export and activation share one portable boundary: local identities and
// provenance cannot be copied into a new activation. Nested author values are
// left intact, except beauty's own local source receipts.
export function portableNextTavernAuthorFields(row) {
    const portable = structuredClone(row);
    for (const field of ['id', 'schemaVersion', 'version', 'updatedAt', 'updatedAtSeq',
        'createdAt', 'importId', 'sources', 'verified', 'tavern', 'editedFrom'])
        delete portable[field];
    if (object(portable.beauty))
        delete portable.beauty.sources;
    return portable;
}
// This is a format discriminator. The JSON decoder owns input validation once.
export function isNextTavernCardDocument(document) {
    return object(document) && document.spec === 'nexttavern_card'
        && document.spec_version === '1.0' && object(document.data);
}
export function isNativeTavernCardDocument(document) {
    return object(document) && (document.spec === 'chara_card_v2' || document.spec === 'chara_card_v3')
        && typeof document.spec_version === 'string' && object(document.data);
}
/** This key has one writer. Other extension values never become author DATA. */
export function readNativeNextTavernAuthorExtensionV1(document) {
    if (!isNativeTavernCardDocument(document))
        return undefined;
    const extensions = document.data.extensions;
    if (!object(extensions))
        return undefined;
    const value = extensions[NATIVE_NEXTTAVERN_AUTHOR_EXTENSION_KEY];
    if (!object(value) || value.schemaVersion !== 1 || value.encoding !== 'nexttavern-native-author-extension-v1')
        return undefined;
    if (!object(value.author) || !object(value.archive))
        throw Error('NATIVE_CARD_AUTHOR_EXTENSION_INVALID');
    return value;
}
export function readTavernCardArchiveV1(document) {
    return isNextTavernCardDocument(document) ? document.archive
        : readNativeNextTavernAuthorExtensionV1(document)?.archive ?? {};
}
const nativeAuthorFields = ['name', 'cards', 'worldbook', 'rules', 'status', 'opening', 'settings', 'compatibility'];
const standardTextFields = ['description', 'personality', 'scenario', 'mes_example', 'system_prompt',
    'post_history_instructions', 'first_mes', 'alternate_greetings'];
/** Physical ST fields keep their original paths; classified author rows have
 * one canonical execution home, rather than being guessed back into ST fields. */
export function nativeNextTavernExecutionDocumentV1(document) {
    const extension = readNativeNextTavernAuthorExtensionV1(document);
    if (!extension)
        return undefined;
    // Decoder DATA is already owned. Clone only the containers changed by this
    // projection; copying the inert archive would be discarded by prepare().
    const data = { ...document.data, extensions: { ...document.data.extensions } };
    for (const field of [...standardTextFields, ...nativeAuthorFields])
        delete data[field];
    delete data.extensions[NATIVE_NEXTTAVERN_AUTHOR_EXTENSION_KEY];
    return { spec: 'nexttavern_card', spec_version: '1.0',
        data: { ...data, ...extension.author }, archive: extension.archive };
}
export function mergeNativeTavernCardExportV1(original, current) {
    const document = structuredClone(original), data = document.data, prior = readNativeNextTavernAuthorExtensionV1(original);
    const extensions = object(data.extensions) ? data.extensions : {};
    const oldValue = extensions[NATIVE_NEXTTAVERN_AUTHOR_EXTENSION_KEY];
    const author = Object.fromEntries(nativeAuthorFields.filter(field => Object.hasOwn(current.data, field))
        .map(field => [field, structuredClone(current.data[field])]));
    extensions[NATIVE_NEXTTAVERN_AUTHOR_EXTENSION_KEY] = { ...prior,
        schemaVersion: 1, encoding: 'nexttavern-native-author-extension-v1', author, archive: structuredClone(current.archive),
        ...!prior && Object.hasOwn(extensions, NATIVE_NEXTTAVERN_AUTHOR_EXTENSION_KEY) ? { originalExtension: oldValue } : {} };
    data.extensions = extensions;
    data.name = current.data.name;
    for (const [field, rule] of [['scenario', 'core'], ['mes_example', 'style'], ['system_prompt', 'narrative'],
        ['post_history_instructions', 'reply']]) {
        if (current.data.rules[rule] !== undefined)
            data[field] = current.data.rules[rule];
    }
    if (current.data.opening !== undefined)
        data.first_mes = current.data.opening.text;
    if (current.data.character_book !== undefined)
        data.character_book = structuredClone(current.data.character_book);
    return document;
}
const bookEntries = (data) => {
    const entries = data.character_book?.entries ?? [];
    return Array.isArray(entries) ? entries : Object.values(entries);
};
// Preserve the standard adapter's ordinal IDs so the existing book compiler can
// bind archived content. No book entry is also installed as a canonical row.
function projectBookMetadata(data, cardId) {
    return bookEntries(data).map((entry, sourceIndex) => ({
        id: `${cardId}-book-${sourceIndex}`, sourceIndex,
        enabled: entry.enabled !== false && entry.disable !== true,
        useRegex: entry.use_regex === true, caseSensitive: entry.case_sensitive === true,
        selective: entry.selective === true,
        secondaryKeys: (entry.secondary_keys ?? entry.keysecondary ?? []),
        keys: (entry.keys ?? entry.key ?? []),
        constant: entry.constant === true, extensions: entry.extensions ?? {},
        sourceMetadata: Object.fromEntries(Object.entries(entry).filter(([key]) => ![
            'content', 'keys', 'key', 'secondary_keys', 'keysecondary', 'enabled', 'disable',
            'constant', 'selective', 'case_sensitive', 'use_regex',
        ].includes(key))),
    }));
}
export function projectNextTavernCard(decoded, worldbookMetadata, includeSourceArchive = true) {
    const data = decoded.data;
    const cardId = nextTavernCardSourceIdV1(decoded.document);
    const worldbook = worldbookMetadata ?? projectBookMetadata(data, cardId);
    const assignments = [], sections = [];
    let line = 1;
    const add = (body, target, metadata = {}) => {
        if (body === undefined || body === '')
            return;
        // The classifier view has the same normalization as the ST projection.
        // Finalization restores complete portable rows from DATA, including CRLF
        // and trailing bytes; these line spans alone are not a roundtrip contract.
        const value = body.replace(/\r\n?/g, '\n') + '\n';
        let count = 0;
        for (let at = value.indexOf('\n'); at !== -1; at = value.indexOf('\n', at + 1))
            count++;
        sections.push(value);
        assignments.push({ ...metadata, target, sourceSpans: [{ startLine: line, endLine: line + count - 1 }],
            order: assignments.length });
        line += count;
    };
    const addRows = (rows, target) => {
        for (const [index, row] of rows.entries()) {
            const { content, ...authorFields } = row;
            const id = `${cardId}-${target}-${index}`;
            add(content, target, { ...authorFields, id, merge_group: id,
                name: row.name ?? data.name,
                ...(row.tokenBudget !== undefined ? { token_budget: row.tokenBudget } : {}),
                ...(row.alwaysOn !== undefined ? { always_on: row.alwaysOn } : {}) });
        }
    };
    addRows(data.cards, 'card');
    addRows(data.worldbook, 'worldbook');
    for (const [field, target] of [
        ['core', 'core-setting'], ['plot', 'plot-guidance'], ['narrative', 'rule-narrative'],
        ['reply', 'rule-reply'], ['style', 'rule-style'],
    ])
        add(data.rules[field], target, { merge_group: target });
    add(data.rules.beauty?.css, 'beauty-css');
    add(data.rules.beauty?.js, 'beauty-js');
    if (data.rules.beauty?.regexRules !== undefined) {
        add(JSON.stringify(data.rules.beauty.regexRules, null, 2), 'archive-only', { name: 'Author regex rules' });
    }
    add(data.status?.text, 'status');
    add(data.opening?.text, 'opening');
    for (const [index, entry] of bookEntries(data).entries()) {
        add(entry.content, 'archive-only', { id: worldbook[index].id, name: 'Character book entry' });
    }
    // Only the archive payload is appended here. In particular, DATA's book is
    // already represented by the ordinal archive assignments immediately above.
    if (includeSourceArchive && decoded.document.archive !== undefined) {
        add(JSON.stringify(decoded.document.archive, null, 2), 'archive-only', { name: 'Original source archive' });
    }
    return { text: sections.join(''), assignments, worldbook, cardId, warnings: [] };
}
