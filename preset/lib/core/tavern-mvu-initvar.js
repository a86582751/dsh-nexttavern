// Generated from runtime/alpha3/src/core/tavern-mvu-initvar.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
const BOUNDS = {
    inputBytes: 1048576, outputBytes: 1048576, depth: 32, descriptorDepth: 48,
    nodes: 32000, arrayLength: 4096, numberMagnitude: 9007199254740991,
};
const DIALECTS = {
    A: { sha256: '3759d0c8b9f82c67a606afae11de9a90e3ee4e63298ef622b89ac9127eb77047',
        commit: 'b13b43bac24d585f2b523c12e423bb803fa9dd7c' },
    B: { sha256: '6e4756ba99968f9eab2c20810d27ca035b28f36791f7fa7dd701a57af37241e1',
        commit: 'b42817925d0391c15fa242a8238d2bbe28eb6319' },
    D: { sha256: 'dcdbd5b0b837439d90fd0f783bedc1453fa6b8583d9d6a41f16f53a48e3b6dc3' },
};
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const AUTHOR_SCHEMA = new Set(['$meta', '$schema', '$template', '$required', '$default']);
const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
class Refusal extends Error {
    code;
    pointer;
    constructor(code, pointer) {
        super(code);
        this.code = code;
        this.pointer = pointer;
    }
}
function reject(code, pointer) { throw new Refusal(code, pointer); }
/** Local canonical encoding owns this plan's hash contract: sorted UTF-16 keys, original array order. */
function canonical(value) {
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    if (isObject(value)) {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
function dataHash(value) { return sha(canonical(value)); }
/** Reject accessors/cycles before reading values; accounting includes ignored descriptor fields. */
function finiteJson(value, pointer, aggregate, depthLimit = BOUNDS.depth) {
    let nodes = 0;
    let stringBytes = 0;
    const ancestors = new Set();
    const visit = (item, path, depth) => {
        if (++nodes > BOUNDS.nodes || (aggregate && ++aggregate.nodes > BOUNDS.nodes))
            reject('NODE_LIMIT', pointer);
        if (depth > depthLimit)
            reject('DEPTH_LIMIT', pointer);
        if (typeof item === 'string') {
            stringBytes += Buffer.byteLength(item, 'utf8');
            if (stringBytes > BOUNDS.inputBytes)
                reject('BYTE_LIMIT', pointer);
            return item;
        }
        if (item === null || typeof item === 'boolean')
            return item;
        if (typeof item === 'number') {
            if (!Number.isFinite(item) || Math.abs(item) > BOUNDS.numberMagnitude)
                reject('NUMBER_LIMIT', path);
            return Object.is(item, -0) ? 0 : item;
        }
        if (typeof item !== 'object')
            reject('NON_JSON_VALUE', path);
        const object = item;
        const prototype = Object.getPrototypeOf(object);
        if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype)
            reject('OBJECT_PROTOTYPE', path);
        if (ancestors.has(object))
            reject('CYCLIC_VALUE', path);
        if (Object.getOwnPropertySymbols(object).length)
            reject('NON_JSON_VALUE', path);
        ancestors.add(object);
        const descriptors = Object.getOwnPropertyDescriptors(object);
        let result;
        if (Array.isArray(object)) {
            if (object.length > BOUNDS.arrayLength)
                reject('ARRAY_LIMIT', path);
            result = [];
            for (let index = 0; index < object.length; index++) {
                const descriptor = descriptors[String(index)];
                if (!descriptor || !own(descriptor, 'value'))
                    reject('NON_JSON_VALUE', path);
                result.push(visit(descriptor.value, `${path}/${index}`, depth + 1));
            }
            if (Object.keys(descriptors).some(key => key !== 'length'
                && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= object.length)))
                reject('ARRAY_PROPERTY', path);
        }
        else {
            result = {};
            for (const key of Object.keys(descriptors)) {
                stringBytes += Buffer.byteLength(key, 'utf8');
                if (stringBytes > BOUNDS.inputBytes)
                    reject('BYTE_LIMIT', pointer);
                if (FORBIDDEN.has(key))
                    reject('PROTOTYPE_KEY', path);
                const descriptor = descriptors[key];
                if (!descriptor.enumerable || !own(descriptor, 'value'))
                    reject('NON_JSON_VALUE', path);
                result[key] = visit(descriptor.value, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, depth + 1);
            }
        }
        ancestors.delete(object);
        return result;
    };
    const result = visit(value, pointer, 0);
    if (Buffer.byteLength(canonical(result), 'utf8') > BOUNDS.inputBytes)
        reject('BYTE_LIMIT', pointer);
    return result;
}
function exact(value, required, optional, pointer) {
    if (!isObject(value))
        reject('DESCRIPTOR_SHAPE', pointer);
    if (required.some(key => !own(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
        reject('DESCRIPTOR_SHAPE', pointer);
    }
}
function identifier(value, pointer) {
    if (typeof value !== 'string' || !value.length || value.length > 256 || /[\u0000-\u001f]/.test(value))
        reject('IDENTITY', pointer);
    if (FORBIDDEN.has(value))
        reject('PROTOTYPE_KEY', pointer);
}
function hash(value, pointer) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
        reject('SOURCE_HASH', pointer);
}
function jsonObject(value, pointer, aggregate) {
    const checked = finiteJson(value, pointer, aggregate);
    if (!isObject(checked))
        reject('JSON_OBJECT_REQUIRED', pointer);
    const checkSchema = (item) => {
        if (!item || typeof item !== 'object')
            return;
        for (const key of Object.keys(item)) {
            if (AUTHOR_SCHEMA.has(key) || key.startsWith('$'))
                reject('AUTHOR_SCHEMA_UNSUPPORTED', pointer);
            checkSchema(item[key]);
        }
    };
    checkSchema(checked);
    return checked;
}
function validate(input) {
    exact(input, ['schemaVersion', 'source', 'books', 'bookStatData', 'bookStatDataSha256', 'initializedBooks', 'messageIndex',
        'swipes', 'selectedSwipeIdentity', 'capabilities'], [], '');
    if (input.schemaVersion !== 1)
        reject('INPUT_VERSION', '/schemaVersion');
    exact(input.source, ['verified', 'sourceId', 'sourceSha256', 'dialect', 'dialectSha256', 'loader',
        'originalLoaderSettlement'], ['commit'], '/source');
    const source = input.source;
    if (source.verified !== true)
        reject('UNVERIFIED_SOURCE', '/source');
    identifier(source.sourceId, '/source/sourceId');
    hash(source.sourceSha256, '/source/sourceSha256');
    if (!['A', 'B', 'D'].includes(source.dialect))
        reject('UNKNOWN_DIALECT', '/source/dialect');
    const dialect = DIALECTS[source.dialect];
    if (source.dialectSha256 !== dialect.sha256)
        reject('UNKNOWN_DIALECT', '/source/dialectSha256');
    if ('commit' in dialect ? source.commit !== dialect.commit : own(source, 'commit'))
        reject('DIALECT_PROVENANCE', '/source/commit');
    exact(source.loader, ['selection', 'candidateCount', 'enabled', 'preferred'], [], '/source/loader');
    if (!['observed-exact', 'declared-single-exact'].includes(source.loader.selection)
        || typeof source.loader.candidateCount !== 'number' || !Number.isInteger(source.loader.candidateCount)
        || source.loader.candidateCount < 1 || source.loader.candidateCount > BOUNDS.arrayLength
        || (source.loader.selection === 'declared-single-exact' && source.loader.candidateCount !== 1)
        || typeof source.loader.enabled !== 'boolean'
        || typeof source.loader.preferred !== 'boolean')
        reject('UNVERIFIED_LOADER', '/source/loader');
    if (!['not-proven', 'proven'].includes(source.originalLoaderSettlement))
        reject('LOADER_SETTLEMENT', '/source');
    if (input.messageIndex !== 0)
        reject('MESSAGE_SCOPE', '/messageIndex');
    if (!Array.isArray(input.books) || !Array.isArray(input.swipes) || !Array.isArray(input.initializedBooks)) {
        reject('DESCRIPTOR_SHAPE', '');
    }
    let phase = 0;
    let primaries = 0;
    const bookSources = new Map();
    for (const [index, book] of input.books.entries()) {
        const pointer = `/books/${index}`;
        exact(book, ['identity', 'binding', 'sourceSha256', 'entries'], [], pointer);
        identifier(book.identity, pointer);
        hash(book.sourceSha256, pointer);
        const next = ['global', 'primary', 'additional'].indexOf(book.binding);
        if (next < phase || next < 0 || (next === 1 && ++primaries > 1))
            reject('BOOK_ORDER', pointer);
        phase = next;
        if (!Array.isArray(book.entries))
            reject('DESCRIPTOR_SHAPE', pointer);
        const inventory = `${book.sourceSha256}:${canonical(book.entries)}`;
        if (bookSources.has(book.identity) && bookSources.get(book.identity) !== inventory)
            reject('BOOK_IDENTITY_CONFLICT', pointer);
        bookSources.set(book.identity, inventory);
        const entries = new Set();
        for (const [entryIndex, entry] of book.entries.entries()) {
            const entryPointer = `${pointer}/entries/${entryIndex}`;
            exact(entry, ['identity', 'comment', 'enabled', 'content'], ['rendered'], entryPointer);
            identifier(entry.identity, entryPointer);
            if (entries.has(entry.identity))
                reject('ENTRY_IDENTITY_CONFLICT', entryPointer);
            entries.add(entry.identity);
            if (typeof entry.comment !== 'string' || typeof entry.content !== 'string' || typeof entry.enabled !== 'boolean') {
                reject('DESCRIPTOR_SHAPE', entryPointer);
            }
        }
    }
    for (const identity of input.initializedBooks)
        identifier(identity, '/initializedBooks');
    if (new Set(input.initializedBooks).size !== input.initializedBooks.length)
        reject('BOOK_IDENTITY_CONFLICT', '/initializedBooks');
    const swipes = new Set();
    for (const [index, swipe] of input.swipes.entries()) {
        const pointer = `/swipes/${index}`;
        exact(swipe, ['identity', 'sourceSha256', 'rawOpening', 'statData', 'statDataSha256'], ['renderedBlocks'], pointer);
        identifier(swipe.identity, pointer);
        hash(swipe.sourceSha256, pointer);
        if (typeof swipe.rawOpening !== 'string' || sha(swipe.rawOpening) !== swipe.sourceSha256)
            reject('OPENING_HASH', pointer);
        if (swipes.has(swipe.identity))
            reject('SWIPE_IDENTITY_CONFLICT', pointer);
        swipes.add(swipe.identity);
        if (own(swipe, 'renderedBlocks') && !Array.isArray(swipe.renderedBlocks))
            reject('DESCRIPTOR_SHAPE', pointer);
    }
    identifier(input.selectedSwipeIdentity, '/selectedSwipeIdentity');
    if (!swipes.has(input.selectedSwipeIdentity))
        reject('SELECTED_SWIPE', '/selectedSwipeIdentity');
    exact(input.capabilities, ['macros', 'schema', 'callbacks', 'openingUpdates'], [], '/capabilities');
}
function basis(input) {
    const bookStatData = jsonObject(input.bookStatData, '/bookStatData');
    if (dataHash(bookStatData) !== input.bookStatDataSha256)
        reject('BASIS_HASH', '/bookStatDataSha256');
    const swipes = input.swipes.map((swipe, index) => {
        const statData = jsonObject(swipe.statData, `/swipes/${index}/statData`);
        if (dataHash(statData) !== swipe.statDataSha256)
            reject('BASIS_HASH', `/swipes/${index}/statDataSha256`);
        return { identity: swipe.identity, sourceSha256: swipe.sourceSha256, statData, statDataSha256: swipe.statDataSha256 };
    });
    return { bookStatData, bookStatDataSha256: input.bookStatDataSha256, initializedBooks: [...input.initializedBooks],
        selectedSwipeIdentity: input.selectedSwipeIdentity, swipes };
}
function sourceIdentity(value) {
    if (!isObject(value))
        return null;
    const identity = {};
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of ['sourceId', 'sourceSha256', 'dialect', 'dialectSha256', 'commit']) {
        const descriptor = descriptors[key];
        const item = descriptor && own(descriptor, 'value') ? descriptor.value : undefined;
        if (typeof item === 'string' && item.length <= 256 && !/[\u0000-\u001f]/.test(item))
            identity[key] = item;
    }
    return identity;
}
/** Arrays replace; object RHS overwrites non-object LHS and recursively merges object children. */
function merge(left, right) {
    for (const key of Object.keys(right)) {
        const incoming = right[key];
        // Lodash may retain array objects when merging an object RHS. That non-JSON shape is outside this subset.
        if (isObject(incoming) && Array.isArray(left[key]))
            reject('MERGE_SHAPE_UNSUPPORTED', '/merge');
        left[key] = isObject(incoming)
            ? merge(isObject(left[key]) ? left[key] : {}, incoming)
            : structuredClone(incoming);
    }
    return left;
}
/**
 * The pinned book regexp captures first eligible header LF through last eligible closing LF.
 * Scan LF segments once instead of retrying a leading .* at every character. Dot still excludes
 * CR/U+2028/U+2029; XML closing accepts a line prefix, while fence closing starts at column zero.
 * This is that capture contract, not a general XML/Markdown interpreter.
 */
function captureBookWrapper(text, fence) {
    const header = fence ? '```' : '<initvar>';
    let firstHeaderLf = -1;
    let lastClosingLf = -1;
    let cursor = 0;
    while (cursor <= text.length) {
        const lf = text.indexOf('\n', cursor);
        const end = lf < 0 ? text.length : lf;
        const line = text.slice(cursor, end);
        const headerAt = line.lastIndexOf(header);
        const lastDotBreak = Math.max(line.lastIndexOf('\r'), line.lastIndexOf('\u2028'), line.lastIndexOf('\u2029'));
        if (firstHeaderLf < 0 && lf >= 0 && headerAt >= 0 && headerAt > lastDotBreak)
            firstHeaderLf = lf;
        let closingAt = line.indexOf('</initvar>');
        if (fence)
            closingAt = line.startsWith('```') ? 0 : -1;
        const firstDotBreak = line.search(/[\r\u2028\u2029]/);
        if (firstHeaderLf >= 0 && cursor - 1 > firstHeaderLf && closingAt >= 0
            && (fence || firstDotBreak < 0 || closingAt < firstDotBreak))
            lastClosingLf = cursor - 1;
        if (lf < 0)
            break;
        cursor = lf + 1;
    }
    return lastClosingLf > firstHeaderLf && firstHeaderLf >= 0
        ? text.slice(firstHeaderLf + 1, lastClosingLf) : undefined;
}
function extractEntry(content) {
    const xml = captureBookWrapper(content.trim(), false);
    const candidate = xml ?? content;
    const fence = captureBookWrapper(candidate.trim(), true);
    return fence ?? candidate;
}
/** Preserve greeting capture whitespace; native subset accepts balanced non-nested tags and paired simple fences. */
function greetingPayload(body, pointer) {
    const first = body.search(/\S/);
    const openingFence = first >= 0 && body.startsWith('```', first);
    let end = body.length;
    while (end > 0 && /\s/.test(body[end - 1]))
        end--;
    const closingFence = end >= 3 && body.slice(end - 3, end) === '```';
    if (!openingFence && !closingFence)
        return body;
    if (!openingFence || !closingFence)
        reject('INITVAR_FENCE_UNSUPPORTED', pointer);
    let headerEnd = first + 3;
    while (headerEnd < body.length && !/[\r\n\u2028\u2029]/.test(body[headerEnd]))
        headerEnd++;
    if (headerEnd >= end - 3)
        reject('INITVAR_FENCE_UNSUPPORTED', pointer);
    const captured = body.slice(headerEnd, end - 3);
    // Another fence is ambiguous here; keep its source unsupported rather than infer Markdown nesting.
    if (captured.includes('```'))
        reject('INITVAR_FENCE_UNSUPPORTED', pointer);
    return captured;
}
function extractGreetingPayloads(text, pointer) {
    const result = [];
    let openEnd = -1;
    // ASCII tag regexp has no variable repetition and keeps offsets in the ORIGINAL UTF-16 source.
    // Lowercasing the whole source would move indices for characters such as U+0130.
    for (const tag of text.matchAll(/<\/?initvar>/gi)) {
        const closing = tag[0][1] === '/';
        if (!closing) {
            if (openEnd >= 0)
                reject('INITVAR_WRAPPER_UNSUPPORTED', pointer);
            openEnd = tag.index + tag[0].length;
        }
        else {
            if (openEnd < 0)
                reject('INITVAR_WRAPPER_UNSUPPORTED', pointer);
            if (result.length >= BOUNDS.arrayLength)
                reject('ARRAY_LIMIT', pointer);
            result.push(greetingPayload(text.slice(openEnd, tag.index), pointer));
            openEnd = -1;
        }
    }
    if (openEnd >= 0)
        reject('INITVAR_WRAPPER_UNSUPPORTED', pointer);
    return result;
}
function hasClosedMacro(text) {
    const start = text.indexOf('{{');
    return start >= 0 && text.indexOf('}}', start + 2) >= 0;
}
function payload(text, rendered, context, pointer) {
    const cached = context.cache.get(pointer);
    if (cached)
        return cached;
    const macros = context.macros;
    let parseText = text;
    if (rendered) {
        exact(rendered, ['capability', 'sourceSha256', 'text'], [], pointer);
        if (macros !== 'verified-rendered' || rendered.capability !== 'server-verified'
            || rendered.sourceSha256 !== sha(text) || typeof rendered.text !== 'string')
            reject('MACRO_BINDING', pointer);
        parseText = rendered.text;
    }
    else if (hasClosedMacro(text))
        reject('MACRO_UNSUPPORTED', pointer);
    if (hasClosedMacro(parseText))
        reject('MACRO_UNSUPPORTED', pointer);
    let parsed;
    try {
        parsed = JSON.parse(parseText);
    }
    catch {
        reject('NON_STRICT_JSON', pointer);
    }
    const data = jsonObject(parsed, pointer, context);
    const result = { data, payloadSha256: sha(text), renderedSha256: sha(parseText), dataSha256: dataHash(data) };
    context.cache.set(pointer, result);
    return result;
}
function loadBooks(input, starting, seen, context) {
    let statData = structuredClone(starting);
    const initialized = new Set(seen);
    const books = [];
    for (const [index, book] of input.books.entries()) {
        const step = { identity: book.identity, binding: book.binding, sourceSha256: book.sourceSha256,
            status: 'already-initialized', entries: [], resultSha256: dataHash(statData) };
        books.push(step);
        if (initialized.has(book.identity))
            continue;
        initialized.add(book.identity);
        let merged = {};
        for (const [entryIndex, entry] of book.entries.entries()) {
            // Pinned API uses filter:none. An entry's disabled flag does not disable initialization.
            if (!entry.comment.toLowerCase().includes('[initvar]'))
                continue;
            const pointer = `/books/${index}/entries/${entryIndex}`;
            // Reloading a book must not rescan/hash a potentially large immutable payload once per swipe.
            const parsed = context.cache.get(pointer) ?? payload(extractEntry(entry.content), entry.rendered, context, pointer);
            parsed.contentSha256 ??= sha(entry.content);
            merged = merge(merged, parsed.data);
            step.entries.push({ identity: entry.identity, contentSha256: parsed.contentSha256,
                payloadSha256: parsed.payloadSha256, renderedSha256: parsed.renderedSha256, dataSha256: parsed.dataSha256 });
        }
        // This spread is deliberately shallow: earlier/existing entire top-level values win.
        statData = jsonObject({ ...merged, ...statData }, `/books/${index}/result`);
        step.status = 'loaded';
        step.resultSha256 = dataHash(statData);
    }
    return { statData, dataSha256: dataHash(statData), initializedBooks: [...initialized], books };
}
/**
 * Deterministic data subset only: no persistence, callbacks, schema execution, host access or model fallback.
 * Book wrappers retain pinned first-header/last-close captures through bounded LF scans. Greetings accept
 * balanced non-nested tags and paired simple fences; ambiguous/unterminated forms are explicitly unsupported.
 * Capture whitespace is source identity, even when JSON.parse would produce equivalent values after trimming.
 */
export function compileMvuInitSources(input) {
    let source = null;
    let inputHash;
    try {
        // Even a budget refusal preserves bounded identity without invoking input accessors or returning payload fields.
        const descriptor = input && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'source') : undefined;
        source = sourceIdentity(descriptor && own(descriptor, 'value') ? descriptor.value : undefined);
        const checked = finiteJson(input, '', undefined, BOUNDS.descriptorDepth);
        if (!isObject(checked))
            reject('DESCRIPTOR_SHAPE', '');
        // Preserve only JSON-safe source identity; diagnostics never expose payload/parser error text.
        source = sourceIdentity(checked.source);
        inputHash = dataHash(checked);
        validate(checked);
        const safe = checked;
        const existing = basis(safe);
        const none = (reason) => ({ schemaVersion: 1, kind: 'none', source: safe.source, inputHash: inputHash, reason,
            basis: existing, basisHash: dataHash(existing) });
        if (!safe.source.loader.enabled)
            return none('loader-disabled');
        if (!safe.source.loader.preferred)
            return none('loader-not-preferred');
        const base = existing.bookStatData;
        // No newly read book means the actual initCheck returns before opening parsing and capability use.
        if (safe.books.every(book => safe.initializedBooks.includes(book.identity)))
            return none('no-new-book');
        if (!['none', 'verified-rendered'].includes(safe.capabilities.macros))
            reject('MACRO_CAPABILITY', '/capabilities/macros');
        if (safe.capabilities.schema !== 'json-object-subset-v1')
            reject('SCHEMA_CAPABILITY', '/capabilities/schema');
        if (safe.capabilities.callbacks !== 'none')
            reject('CALLBACK_CAPABILITY', '/capabilities/callbacks');
        if (safe.capabilities.openingUpdates !== 'none')
            reject('OPENING_UPDATE_CAPABILITY', '/capabilities/openingUpdates');
        // Unique parsed payload nodes are bounded in aggregate; reloading the same book reuses verified data.
        const context = { macros: safe.capabilities.macros, nodes: 0, cache: new Map() };
        const baseline = loadBooks(safe, base, [...safe.initializedBooks], context);
        const swipes = [];
        let resultBytes = Buffer.byteLength(canonical(baseline), 'utf8')
            + Buffer.byteLength(canonical(existing), 'utf8');
        for (const [index, swipe] of safe.swipes.entries()) {
            if (/<(?:updatevariable|updatevar|jsonpatch)\b|_\.(?:set|add|assign|delete|remove)\s*\(/i.test(swipe.rawOpening)) {
                reject('OPENING_UPDATE_UNSUPPORTED', `/swipes/${index}`);
            }
            let statData = merge(jsonObject(swipe.statData, `/swipes/${index}/statData`), structuredClone(baseline.statData));
            const blocks = [];
            let replacement = {};
            const matches = extractGreetingPayloads(swipe.rawOpening, `/swipes/${index}`);
            if (swipe.renderedBlocks && swipe.renderedBlocks.length !== matches.length)
                reject('MACRO_BINDING', `/swipes/${index}`);
            for (const [blockIndex, match] of matches.entries()) {
                const parsed = payload(match, swipe.renderedBlocks?.[blockIndex], context, `/swipes/${index}/blocks/${blockIndex}`);
                replacement = merge(replacement, parsed.data);
                blocks.push({ payloadSha256: parsed.payloadSha256, renderedSha256: parsed.renderedSha256, dataSha256: parsed.dataSha256 });
            }
            let initializedBooks = [...baseline.initializedBooks];
            let books = [];
            if (blocks.length) {
                const primary = safe.books.find(book => book.binding === 'primary')?.identity;
                if (!primary)
                    reject('PRIMARY_BINDING_UNKNOWN', `/swipes/${index}`);
                const reloaded = loadBooks(safe, replacement, [primary], context);
                statData = reloaded.statData;
                initializedBooks = reloaded.initializedBooks;
                books = reloaded.books;
            }
            statData = jsonObject(statData, `/swipes/${index}/result`);
            const step = { identity: swipe.identity, sourceSha256: swipe.sourceSha256, replaced: blocks.length > 0,
                blocks, books, statData, initializedBooks, dataSha256: dataHash(statData) };
            resultBytes += Buffer.byteLength(canonical(step), 'utf8');
            if (resultBytes > BOUNDS.outputBytes)
                reject('OUTPUT_BYTE_LIMIT', '/plan');
            swipes.push(step);
        }
        const dialect = DIALECTS[safe.source.dialect];
        const staticSourceVersion = 'commit' in dialect
            ? { dialect: safe.source.dialect, sha256: dialect.sha256, commit: dialect.commit }
            : { dialect: safe.source.dialect, sha256: dialect.sha256 };
        const content = { schemaVersion: 1, policy: 'strict-json-object-v1', source: safe.source,
            staticSourceVersion, capability: 'native-json-data-only', bounds: { ...BOUNDS }, inputHash: inputHash,
            assurance: 'supported-static',
            basis: existing, basisHash: dataHash(existing),
            selectedSwipeIdentity: safe.selectedSwipeIdentity, baseline, swipes };
        let bounded;
        try {
            bounded = finiteJson(content, '/plan', undefined, BOUNDS.descriptorDepth);
        }
        catch (error) {
            if (error instanceof Refusal && error.code === 'BYTE_LIMIT')
                reject('OUTPUT_BYTE_LIMIT', '/plan');
            throw error;
        }
        const plan = { ...content, planHash: dataHash(bounded) };
        return { schemaVersion: 1, kind: 'supported', plan };
    }
    catch (error) {
        const diagnostic = error instanceof Refusal ? { code: error.code, pointer: error.pointer } : { code: 'INVALID_INPUT', pointer: '' };
        return { schemaVersion: 1, kind: 'unsupported', source, diagnostics: [diagnostic], ...(inputHash ? { inputHash } : {}) };
    }
}
