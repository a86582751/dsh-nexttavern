// Generated from runtime/alpha3/src/core/roleplay-mvu-source.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
import { assertImportRecordIntegrity, importCoverage, readStructuredImportDataV1 } from './roleplay-import-record.js';
import { compileTavernOpeningCandidates } from './tavern-card.js';
import { selectNativeMvuInitializationPolicy } from './tavern-mvu-initvar.js';
import { NATIVE_MVU_SOURCE_POLICY, isNativeMvuSourcePolicy, isNativeMvuYamlSourcePolicy } from './roleplay-mvu-source-policy.js';
import { cloneSchemaData, schemaTextSha256 } from './tavern-mvu-schema-data.js';
export { NATIVE_MVU_SOURCE_POLICY, NATIVE_MVU_YAML_SOURCE_POLICY, isNativeMvuSourcePolicy, isNativeMvuYamlSourcePolicy } from './roleplay-mvu-source-policy.js';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const keyPattern = /^[a-zA-Z0-9_-]{1,256}$/;
const MAX_BYTES = 1_048_576;
const MAX_ROWS = 4096;
class SourceFailure extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.code);
        this.diagnostic = diagnostic;
    }
}
function fail(code, pointer, value) {
    throw new SourceFailure({ code, pointer, ...(value === undefined ? {} : { valueSha256: recordSha256(value) }) });
}
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const isHash = (value) => typeof value === 'string' && hashPattern.test(value);
const isVersion = (value) => value === 'missing' || isHash(value);
const same = (a, b) => recordSha256(a) === recordSha256(b);
const pointerPart = (value) => value.replace(/~/g, '~0').replace(/\//g, '~1');
const numericalChannel = (key) => /^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)
    || /^(?:card_agent|chaoshen_jixieshi|risuai)$/.test(key) || key.startsWith('$');
const plainEmpty = (value) => isObject(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Object.keys(value).length === 0;
function requireKeys(value, keys, pointer, code) {
    for (const key of Object.keys(value))
        if (!keys.includes(key))
            fail(code, pointer, value);
}
function hashMap(value, pointer) {
    if (!isObject(value) || Object.keys(value).length > MAX_ROWS)
        fail('MEMBERSHIP_INVALID', pointer);
    const result = Object.create(null);
    for (const [key, hash] of Object.entries(value)) {
        if (!idPattern.test(key) || !isHash(hash))
            fail('MEMBERSHIP_INVALID', pointer);
        result[key] = hash;
    }
    return result;
}
function withPolicy(snapshot, policy) {
    if (same(snapshot.policy, policy))
        return snapshot;
    const { snapshotSha256: _old, ...content } = snapshot;
    const next = { ...content, policy };
    return { ...next, snapshotSha256: recordSha256(next) };
}
// Whole input walk is bounded and never calls accessors, regexes supplied by the
// author, JS, schema callbacks, loaders or network/model fallbacks.
function boundedData(value, code, pointer, budget = { nodes: 0, bytes: 0 }) {
    const visit = (item, depth) => {
        if (++budget.nodes > 32_000 || depth > 32)
            fail('SOURCE_BUDGET', pointer);
        if (typeof item === 'string')
            budget.bytes += Buffer.byteLength(item, 'utf8');
        else if (typeof item === 'number') {
            if (!Number.isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER)
                fail(code, pointer);
        }
        else if (item !== null && typeof item !== 'boolean' && typeof item !== 'object')
            fail(code, pointer);
        if (budget.bytes > MAX_BYTES)
            fail('SOURCE_BUDGET', pointer);
        if (item && typeof item === 'object') {
            if (Array.isArray(item) && item.length > 4096)
                fail('SOURCE_BUDGET', pointer);
            if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item)))
                fail(code, pointer);
            for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
                if (Array.isArray(item) && key === 'length')
                    continue;
                if (!('value' in descriptor) || ['__proto__', 'prototype', 'constructor'].includes(key))
                    fail(code, pointer);
                budget.bytes += Buffer.byteLength(key, 'utf8');
                visit(descriptor.value, depth + 1);
            }
        }
    };
    visit(value, 0);
}
function stateSyntax(text) {
    return /<script\b|<%|\b(?:registerMvuSchema|getAllVariables|updateVariables|replaceVariables|insertOrAssignVariables)\s*\(/i.test(text)
        || /\b(?:eval|Function|fetch|import|require)\s*\(|\bon[a-z]+\s*=|javascript:|<iframe\b/i.test(text)
        || /<\/?(?:updatevariable|variableupdate|mvu-update)\b|\b_\.(?:get|set|merge|assign|unset)\s*\(/i.test(text)
        || /\b(?:stat_data|mvu_data)\s*(?:[.\[=]|\()/i.test(text)
        || /\{\{\s*(?:getvar|setvar|addvar|incvar|decvar|run|eval|execute|script)\b/i.test(text)
        || /\$(?:meta|schema|template|required|default)\b|VARIABLE_(?:INIT|UPDATE)|MVU_(?:INIT|UPDATE)/.test(text);
}
const initSyntax = (text) => /\[initvar\]|<\/?initvar\b/i.test(text);
function render(text, context, requireResolved) {
    let cursor = 0, result = '';
    for (;;) {
        const start = text.indexOf('{{', cursor);
        // Closing JSON object braces are data, not an unmatched macro instruction.
        if (start < 0)
            return result + text.slice(cursor);
        const end = text.indexOf('}}', start + 2);
        if (end < 0)
            fail('MACRO_UNSUPPORTED', '/macros');
        const name = text.slice(start + 2, end);
        if (!['user', 'char', 'user_gender'].includes(name) || text[start - 1] === '{' || text[end + 2] === '}') {
            fail('MACRO_UNSUPPORTED', '/macros');
        }
        const value = context[name];
        if (requireResolved && (typeof value !== 'string' || !value || value.length > 512))
            fail('MACRO_UNSUPPORTED', '/macros');
        result += text.slice(cursor, start) + (typeof value === 'string' && value && value.length <= 512
            ? value : text.slice(start, end + 2));
        cursor = end + 2;
    }
}
function openingBlocks(text, pointer) {
    const tags = /<\/?initvar>/gi;
    let open = null, found = false;
    for (let tag = tags.exec(text); tag; tag = tags.exec(text)) {
        if (tag[0][1] !== '/') {
            if (open)
                fail('INITVAR_INVALID', pointer, text);
            open = { start: tag.index, content: tag.index + tag[0].length };
        }
        else {
            if (!open)
                fail('INITVAR_INVALID', pointer, text);
            // Classification only locates the declaration. The native-policy compiler
            // owns exact payload capture, strict JSON validation and merge semantics.
            open = null;
            found = true;
        }
    }
    if (open || /<\/?initvar\b/i.test(text) && !found)
        fail('INITVAR_INVALID', pointer, text);
    return found;
}
function extensions(value, pointer, authorSchema = false) {
    if (value === undefined)
        return;
    if (!isObject(value))
        fail('EXTENSION_UNSUPPORTED', pointer, value);
    for (const key of Object.keys(value))
        if (numericalChannel(key) || key === 'tavern_helper' && !authorSchema) {
            fail('EXTENSION_UNSUPPORTED', pointer);
        }
    if (authorSchema && value.tavern_helper !== undefined) {
        if (!isObject(value.tavern_helper))
            fail('EXTENSION_UNSUPPORTED', pointer);
        // Script effects are preserved in authorSource and admitted by the actual
        // compiler/guest. Unimplemented helper buttons/variables cannot be dropped.
        requireKeys(value.tavern_helper, ['scripts'], pointer, 'EXTENSION_UNSUPPORTED');
    }
    if (value.fav !== undefined && typeof value.fav !== 'boolean')
        fail('EXTENSION_UNSUPPORTED', pointer, value);
    if (value.talkativeness !== undefined && (typeof value.talkativeness !== 'number'
        || !Number.isFinite(value.talkativeness)))
        fail('EXTENSION_UNSUPPORTED', pointer, value);
    if (value.depth_prompt !== undefined) {
        const depth = value.depth_prompt;
        if (!isObject(depth))
            fail('EXTENSION_UNSUPPORTED', pointer, value);
        requireKeys(depth, ['prompt', 'depth', 'role'], pointer, 'EXTENSION_UNSUPPORTED');
        if (typeof depth.prompt !== 'string' || !Number.isSafeInteger(depth.depth) || Number(depth.depth) < 0
            || !['system', 'user', 'assistant'].includes(String(depth.role)))
            fail('EXTENSION_UNSUPPORTED', pointer, value);
        if (initSyntax(depth.prompt) || stateSyntax(depth.prompt))
            fail('STATE_SYNTAX_UNSUPPORTED', pointer, value);
    }
}
/** Existing strict literal policy, exposed for the separate template Source
 * domain. No allow-EJS switch is added to this module's old classifier. */
export function assertMvuLiteralSourceTextV1(text, context, pointer) {
    if (typeof text !== 'string')
        fail('FIELD_UNSUPPORTED', pointer);
    if (stateSyntax(text) || initSyntax(text))
        fail('STATE_SYNTAX_UNSUPPORTED', pointer, text);
    render(text, context, false);
}
export function assertMvuNonSchemaSourceExtensionsV1(value, pointer) {
    // The separate NoBook template proof retains its original closed domain.
    // Numerical classification does not treat unrelated extension metadata as a
    // state declaration, but this public proof's supported protocol is unchanged.
    if (value !== undefined) {
        if (!isObject(value))
            fail('EXTENSION_UNSUPPORTED', pointer, value);
        requireKeys(value, ['fav', 'talkativeness', 'depth_prompt'], pointer, 'EXTENSION_UNSUPPORTED');
    }
    extensions(value, pointer);
}
function nativeBookEntries(data) {
    const book = data.character_book;
    if (book?.entries === undefined)
        return [];
    return Object.entries(book.entries);
}
const nativeInitComment = (raw) => isObject(raw)
    && typeof (raw.comment ?? raw.name) === 'string'
    && String(raw.comment ?? raw.name).toLowerCase().includes('[initvar]')
    ? String(raw.comment ?? raw.name) : null;
/** Core owns the existing source/import lock. All reads are synchronous; this
 * module neither acquires a second lock nor writes any Domain/native record. */
function captureSource(deps, sessionId, selectedIndex, currentMaterial = false) {
    if (!idPattern.test(sessionId) || !Number.isSafeInteger(selectedIndex) || selectedIndex < 0)
        fail('REQUEST_INVALID', '');
    const pointer = deps.readActivePointer(sessionId);
    if (!pointer || !idPattern.test(pointer.importId) || !isHash(pointer.normalizedSha256)
        || !isHash(pointer.coverageSha256) || typeof pointer.transactionId !== 'string')
        fail('SOURCE_INVALID', '/source');
    const pointerKeys = ['importId', 'sourceRecordSessionId', 'normalizedSha256',
        'transactionId', 'coverageSha256', 'activatedAt'];
    requireKeys(pointer, currentMaterial ? [...pointerKeys, 'inheritedFrom'] : pointerKeys, '/source', 'SOURCE_INVALID');
    const inheritedFrom = pointer.inheritedFrom;
    if (currentMaterial && Object.hasOwn(pointer, 'inheritedFrom')
        && (typeof inheritedFrom !== 'string' || !idPattern.test(inheritedFrom) || inheritedFrom === sessionId)) {
        fail('SOURCE_INVALID', '/source/inheritedFrom');
    }
    if (!idPattern.test(pointer.transactionId))
        fail('SOURCE_INVALID', '/source');
    const owner = pointer.sourceRecordSessionId ?? sessionId;
    if (!idPattern.test(owner))
        fail('SOURCE_INVALID', '/source');
    const record = deps.readImportRecord(owner, pointer.importId);
    if (!record || ![4, 5, 6].includes(record.schemaVersion) || record.status !== 'active'
        || record.sessionId !== owner || record.importId !== pointer.importId
        || record.normalizedSha256 !== pointer.normalizedSha256 || record.activation?.transactionId !== pointer.transactionId) {
        fail('SOURCE_INVALID', '/source');
    }
    try {
        assertImportRecordIntegrity(record);
    }
    catch {
        fail('SOURCE_INVALID', '/source');
    }
    const { decoded, provenance } = readStructuredImportDataV1(record);
    const nativeCard = decoded.format === 'json-nexttavern-v1';
    const coverage = importCoverage(record);
    if (coverage.coverage !== 1 || coverage.uncovered.length || coverage.overlaps.length
        || recordSha256(coverage) !== pointer.coverageSha256)
        fail('SOURCE_INVALID', '/source/coverage');
    const rows = [];
    const seen = new Set();
    const read = (table, key, expected) => {
        if (!keyPattern.test(key) || !key.startsWith(`${sessionId}__`) || rows.length >= MAX_ROWS)
            fail('MATERIAL_INVALID', '/material');
        const id = `${table}:${key}`;
        const value = deps.readRow(table, key);
        if (value !== undefined && !isObject(value))
            fail('FIELD_UNSUPPORTED', '/settings');
        // These values come from Core's actual JSONDomain tables. Their DATA parser
        // owns descriptor safety; the numerical Source owns this exact row binding.
        const ref = { table, key, exists: value !== undefined, sha256: recordSha256(value) };
        if (expected !== undefined && (!ref.exists || ref.sha256 !== expected))
            fail('MATERIAL_INVALID', '/material');
        if (!seen.has(id)) {
            rows.push({ ref, value });
            seen.add(id);
        }
        return ref;
    };
    const digests = record.activation.writeDigests;
    const activationRows = new Set();
    if (!Array.isArray(digests) || !digests.length || digests.length > MAX_ROWS)
        fail('MATERIAL_INVALID', '/material');
    for (const digest of digests) {
        if (!digest || !['branch', 'cards', 'worldbook', 'rules', 'status', 'opening'].includes(digest.tableName)
            || !isHash(digest.sha256))
            fail('MATERIAL_INVALID', '/material');
        let materialKey = digest.key;
        if (currentMaterial) {
            // The original import keeps ancestor-owned activation keys. Verified
            // inheritance retains their suffixes in this session's own material;
            // neither current reads nor schema frames may borrow ancestor rows.
            if (typeof materialKey !== 'string' || !materialKey.startsWith(`${owner}__`))
                fail('MATERIAL_INVALID', '/material');
            materialKey = `${sessionId}__${materialKey.slice(owner.length + 2)}`;
        }
        if (currentMaterial && ((digest.tableName === 'branch' && materialKey !== `${sessionId}__settings`)
            || (digest.tableName === 'rules' && materialKey !== `${sessionId}__spec`)
            || (digest.tableName === 'status' && materialKey !== `${sessionId}__spec`)
            || (digest.tableName === 'opening' && materialKey !== `${sessionId}__scene`))) {
            fail('MATERIAL_INVALID', '/material');
        }
        read(digest.tableName, materialKey, currentMaterial ? undefined : digest.sha256);
        activationRows.add(`${digest.tableName}:${materialKey}`);
    }
    const versions = deps.recordVersionsFor(sessionId);
    const cards = hashMap(versions.cards, '/settings/cards'), worldbook = hashMap(versions.worldbook, '/settings/worldbook');
    if (!isVersion(versions.rules) || !isVersion(versions.settings))
        fail('MEMBERSHIP_INVALID', '/settings');
    for (const [id, expected] of Object.entries(cards))
        read('cards', `${sessionId}__${id}`, expected);
    for (const [id, expected] of Object.entries(worldbook))
        read('worldbook', `${sessionId}__${id}`, expected);
    const rules = read('rules', `${sessionId}__spec`), settings = read('branch', `${sessionId}__settings`);
    if (rules.sha256 !== versions.rules || settings.sha256 !== versions.settings)
        fail('MEMBERSHIP_INVALID', '/settings');
    // A source rule added after import must invalidate even an originally absent
    // record. These are author inputs, unlike dynamic panel/init-head/event output.
    read('status', `${sessionId}__spec`);
    read('opening', `${sessionId}__scene`);
    const context = deps.readOpeningContext(sessionId);
    if (!context || !isObject(context.context) || !isHash(context.bindingSha256))
        fail('MACRO_UNSUPPORTED', '/macros');
    requireKeys(context.context, ['user', 'char', 'user_gender'], '/macros', 'MACRO_UNSUPPORTED');
    for (const value of Object.values(context.context)) {
        if (typeof value !== 'string' || value.length > 512)
            fail('MACRO_UNSUPPORTED', '/macros');
    }
    // The import's real decoder has already parsed the entire original document.
    // Numerical classification below consumes only its actual declarations.
    const candidates = compileTavernOpeningCandidates(decoded, context.context);
    const selected = candidates.find(item => item.index === selectedIndex);
    if (!selected)
        fail('REQUEST_INVALID', '/selected');
    const source = { sessionId, importId: pointer.importId, sourceRecordSessionId: owner,
        rawSha256: record.rawSha256, normalizedSha256: record.normalizedSha256, transactionId: pointer.transactionId,
        coverageSha256: pointer.coverageSha256, pointer: { ...pointer } };
    const root = decoded.document.data === decoded.data ? '/data' : '';
    const used = nativeCard ? candidates.some(item => item.materialization !== 'materialized' && item.rawText.includes('{{'))
        || nativeBookEntries(decoded.data).some(([, raw]) => nativeInitComment(raw) !== null
            && isObject(raw) && typeof raw.content === 'string' && raw.content.includes('{{'))
        : JSON.stringify(decoded.document).includes('{{')
            || rows.some(item => JSON.stringify(item.value ?? null).includes('{{'));
    const membership = { cards, worldbook, rules: versions.rules, settings: versions.settings };
    const content = {
        schemaVersion: 1, encoding: 'native-mvu-source-snapshot-v1', policy: NATIVE_MVU_SOURCE_POLICY,
        source, pointerSha256: recordSha256(pointer), importRecordSha256: recordSha256(record), coverageSha256: recordSha256(coverage),
        materialRows: rows.map(item => item.ref).sort((a, b) => {
            const left = `${a.table}:${a.key}`, right = `${b.table}:${b.key}`;
            return left < right ? -1 : left > right ? 1 : 0;
        }),
        settings: { ...membership, membershipSha256: recordSha256(membership) },
        bindings: { global: [], primary: decoded.data.character_book === undefined ? null
                : { pointer: `${root}/character_book`, sha256: recordSha256(decoded.data.character_book) }, additional: [] },
        selected: { index: selected.index, pointer: selected.sourcePointer, sourceSha256: selected.sourceSha256,
            renderedSha256: sha(selected.renderedText) },
        swipes: candidates.map(item => ({ identity: `swipe-${item.index}`, index: item.index, pointer: item.sourcePointer,
            sourceSha256: item.sourceSha256, renderedSha256: sha(item.renderedText) })),
        macroContext: { used, bindingSha256: used ? context.bindingSha256 : null, valuesSha256: used ? recordSha256(context.context) : null },
        ...(record.schemaVersion === 6 ? { sourceProvenance: provenance } : {}),
    };
    return { snapshot: { ...content, snapshotSha256: recordSha256(content) }, document: decoded.document,
        data: decoded.data, context: context.context, candidates, rows, activationRows };
}
/** Freezes producer-owned DATA; execution envelopes retain their own budgets. */
function freezeAuthorSourceData(value) {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value))
            freezeAuthorSourceData(child);
        Object.freeze(value);
    }
    return value;
}
function authorSourceOf(captured) {
    try {
        const extension = captured.data.extensions;
        if (extension === undefined)
            return { kind: 'absent' };
        if (!isObject(extension))
            fail('EXTENSION_UNSUPPORTED', '/extensions');
        const helper = extension.tavern_helper;
        if (helper === undefined)
            return { kind: 'absent' };
        if (!isObject(helper))
            fail('EXTENSION_UNSUPPORTED', '/extensions/tavern_helper');
        if (helper.scripts === undefined)
            return { kind: 'absent' };
        if (!Array.isArray(helper.scripts) || helper.scripts.length > 64) {
            fail('FIELD_UNSUPPORTED', '/extensions/tavern_helper/scripts');
        }
        const root = captured.document.data === captured.data ? '/data' : '';
        const scripts = helper.scripts.map((raw, index) => {
            const pointer = `${root}/extensions/tavern_helper/scripts/${index}`;
            // Preserve every entry and its explicit enable state in original order.
            // Selecting only apparent schema calls would silently discard other
            // author effects. Unknown active code is the compiler's explicit refusal.
            if (!isObject(raw) || raw.type !== 'script' || typeof raw.enabled !== 'boolean' || typeof raw.content !== 'string') {
                fail('FIELD_UNSUPPORTED', pointer);
            }
            return { identity: `script-${index}`, pointer, enabled: raw.enabled, source: raw.content,
                sourceSha256: schemaTextSha256(raw.content) };
        });
        if (!scripts.length)
            return { kind: 'absent' };
        const { policy: _policy, encoding: _encoding, snapshotSha256: _sha, ...scope } = captured.snapshot;
        const snapshotBody = { ...scope, encoding: 'native-mvu-author-source-snapshot-v1',
            documentSha256: recordSha256(captured.document) };
        const snapshot = { ...snapshotBody, snapshotSha256: recordSha256(snapshotBody) };
        // Decoder DATA belongs to this capture. Domain get() returns its shared
        // logical row, so detach each row once before freezing the derived Source.
        // The combined descriptor is not another guest execution input.
        const material = { card: captured.document,
            rows: captured.rows.map(({ ref, value }) => ({ table: ref.table, key: ref.key, exists: ref.exists,
                value: structuredClone(value ?? null) })),
            openingContext: { ...captured.context } };
        const body = { schemaVersion: 1, encoding: 'native-mvu-author-source-v1',
            snapshot, scripts, material, materialSha256: recordSha256(material) };
        return { kind: 'author-source', source: freezeAuthorSourceData({ ...body, authorSourceSha256: recordSha256(body) }) };
    }
    catch (error) {
        return { kind: 'unsupported', diagnostics: [error instanceof SourceFailure
                    ? error.diagnostic : { code: 'SOURCE_INVALID', pointer: '/source' }] };
    }
}
/** Current story material is read with exact current membership/version checks.
 * Original activation digests are checked separately by the schema provenance
 * verifier; this explicit mode never changes the opening capture contract. */
export function readMvuSchemaCurrentAuthorSource(deps, sessionId, selectedIndex) {
    try {
        return authorSourceOf(captureSource(deps, sessionId, selectedIndex, true));
    }
    catch (error) {
        return { kind: 'unsupported', diagnostics: [error instanceof SourceFailure
                    ? error.diagnostic : { code: 'SOURCE_INVALID', pointer: '/source' }] };
    }
}
export function createRoleplayMvuSource(deps) {
    const capture = (sessionId, selectedIndex) => captureSource(deps, sessionId, selectedIndex);
    const classifyNative = (captured, authorSchema, candidates) => {
        const { data, context, snapshot } = captured;
        const helper = isObject(data.extensions) ? data.extensions.tavern_helper : undefined;
        if (!authorSchema && isObject(helper) && helper.scripts !== undefined
            && (!Array.isArray(helper.scripts) || helper.scripts.length)) {
            fail('EXTENSION_UNSUPPORTED', '/data/extensions/tavern_helper');
        }
        const entries = [];
        const budget = { nodes: 0, bytes: 0 };
        // Canonical prompt DATA, ordinary book lore and archive metadata are not
        // numerical declarations. The decoder owns their document structure.
        for (const [ordinal, [key, raw]] of nativeBookEntries(data).entries()) {
            const comment = nativeInitComment(raw);
            if (comment === null)
                continue;
            const pointer = `${snapshot.bindings.primary.pointer}/entries/${pointerPart(key)}`;
            if (!isObject(raw) || typeof raw.content !== 'string')
                fail('FIELD_UNSUPPORTED', pointer);
            boundedData(raw.content, 'FIELD_UNSUPPORTED', pointer, budget);
            if (stateSyntax(raw.content))
                fail('STATE_SYNTAX_UNSUPPORTED', pointer, raw.content);
            const rendered = render(raw.content, context, true);
            entries.push({ identity: `entry-${ordinal}`, sourcePointer: pointer, comment,
                enabled: raw.enabled !== false && raw.disable !== true, content: raw.content, contentSha256: sha(raw.content),
                renderedContent: rendered, renderedContentSha256: sha(rendered) });
        }
        let openingInit = false;
        for (const candidate of candidates) {
            if (candidate.materialization === 'materialized')
                continue;
            boundedData(candidate.rawText, 'FIELD_UNSUPPORTED', candidate.sourcePointer, budget);
            if (stateSyntax(candidate.rawText))
                fail('STATE_SYNTAX_UNSUPPORTED', candidate.sourcePointer, candidate.rawText);
            if (openingBlocks(candidate.renderedText, candidate.sourcePointer))
                openingInit = true;
            render(candidate.rawText, context, entries.length > 0 || openingInit);
        }
        const selection = selectNativeMvuInitializationPolicy({ books: [{ entries }],
            swipes: candidates.map(item => ({ rawOpening: item.rawText, renderedOpening: item.renderedText,
                ...(item.materialization ? { materialization: item.materialization } : {}) })) });
        if (selection.kind === 'unsupported')
            fail('INITVAR_INVALID', selection.diagnostics[0].pointer);
        return { entries, candidates, hasInit: entries.length > 0 || openingInit, policy: selection.policy };
    };
    const classify = (captured, authorSchema = false, recordedInitSource) => {
        // Schema opening initialization consumes one selected greeting. The capture
        // retains the complete catalog for original Source and fresh-basis binding.
        // Historical multi-greeting descriptors retain their recorded all-catalog scope.
        const candidates = authorSchema && !(recordedInitSource && recordedInitSource.swipes.length > 1)
            ? captured.candidates.filter(candidate => candidate.index === captured.snapshot.selected.index)
            : captured.candidates;
        if (captured.document.spec === 'nexttavern_card')
            return classifyNative(captured, authorSchema, candidates);
        const { data, context, snapshot } = captured;
        // The decoder owns the complete envelope, including compatibility mirrors
        // and opaque metadata. Only supported prompt inputs and explicit numerical
        // channels participate in this classifier's initialization decision.
        for (const key of Object.keys(captured.document))
            if (numericalChannel(key))
                fail('FIELD_UNSUPPORTED', '/document');
        for (const key of Object.keys(data))
            if (numericalChannel(key))
                fail('FIELD_UNSUPPORTED', '/data');
        extensions(data.extensions, '/data/extensions', authorSchema);
        const depthPrompt = data.extensions?.depth_prompt;
        if (depthPrompt)
            render(depthPrompt.prompt, context, false);
        // creator_notes is retained archive DATA, not a runtime initialization field.
        for (const key of ['name', 'description', 'personality', 'scenario', 'mes_example', 'system_prompt',
            'post_history_instructions']) {
            const value = data[key];
            if (value === undefined)
                continue;
            if (typeof value !== 'string') {
                fail('FIELD_UNSUPPORTED', `/data/${pointerPart(key)}`, value);
            }
            if (stateSyntax(value) || initSyntax(value))
                fail('STATE_SYNTAX_UNSUPPORTED', `/data/${pointerPart(key)}`, value);
            render(value, context, false);
        }
        const book = data.character_book;
        const entries = [];
        const initBudget = { nodes: 0, bytes: 0 };
        if (book !== undefined) {
            if (!isObject(book) || !Array.isArray(book.entries))
                fail('FIELD_UNSUPPORTED', '/data/character_book', book);
            for (const [index, raw] of book.entries.entries()) {
                const pointer = `${snapshot.bindings.primary.pointer}/entries/${index}`;
                if (!isObject(raw))
                    continue;
                const comment = typeof raw.comment === 'string' ? raw.comment : '';
                const isInit = comment.toLowerCase().includes('[initvar]');
                if (!isInit) {
                    // Ordinary lore, including templates and opaque metadata, belongs to
                    // the Prompt/compiler owner. It cannot declare numerical state here.
                    if (typeof raw.content === 'string' && initSyntax(raw.content))
                        fail('INITVAR_OUTSIDE_BINDING', pointer, raw.content);
                    continue;
                }
                if (typeof raw.content !== 'string')
                    fail('FIELD_UNSUPPORTED', pointer);
                boundedData(raw.content, 'FIELD_UNSUPPORTED', pointer, initBudget);
                requireKeys(raw, ['id', 'name', 'comment', 'content', 'keys', 'key', 'secondary_keys', 'keysecondary', 'enabled', 'disable',
                    'constant', 'selective', 'case_sensitive', 'use_regex', 'insertion_order', 'order', 'position', 'extensions'], pointer, 'FIELD_UNSUPPORTED');
                for (const key of ['enabled', 'disable', 'constant', 'selective', 'case_sensitive', 'use_regex']) {
                    if (raw[key] !== undefined && typeof raw[key] !== 'boolean')
                        fail('FIELD_UNSUPPORTED', pointer);
                }
                for (const key of ['keys', 'key', 'secondary_keys', 'keysecondary'])
                    if (raw[key] !== undefined
                        && (!Array.isArray(raw[key]) || raw[key].some(item => typeof item !== 'string'))) {
                        fail('FIELD_UNSUPPORTED', pointer);
                    }
                for (const key of ['name', 'position'])
                    if (raw[key] !== undefined && typeof raw[key] !== 'string') {
                        fail('FIELD_UNSUPPORTED', pointer);
                    }
                if (raw.id !== undefined && typeof raw.id !== 'string' && typeof raw.id !== 'number')
                    fail('FIELD_UNSUPPORTED', pointer);
                for (const key of ['insertion_order', 'order'])
                    if (raw[key] !== undefined
                        && (typeof raw[key] !== 'number' || !Number.isFinite(raw[key])))
                        fail('FIELD_UNSUPPORTED', pointer);
                if ([raw.content, raw.comment, raw.name].some(value => typeof value === 'string' && stateSyntax(value))) {
                    fail('STATE_SYNTAX_UNSUPPORTED', pointer);
                }
                const rendered = render(raw.content, context, true);
                entries.push({ identity: `entry-${index}`, sourcePointer: pointer, comment,
                    enabled: raw.enabled !== false && raw.disable !== true, content: raw.content, contentSha256: sha(raw.content),
                    renderedContent: rendered, renderedContentSha256: sha(rendered) });
            }
        }
        let openingInit = false;
        for (const candidate of candidates) {
            if (stateSyntax(candidate.rawText))
                fail('STATE_SYNTAX_UNSUPPORTED', candidate.sourcePointer, candidate.rawText);
            if (openingBlocks(candidate.renderedText, candidate.sourcePointer))
                openingInit = true;
            render(candidate.rawText, context, entries.length > 0 || openingInit);
        }
        // The immutable decoder inputs above own the original card fields and
        // InitVar declarations. A verified original rules row can also contain
        // ordinary constant lore; its templates belong to the Prompt owner.
        const primaryRows = captured.activationRows;
        for (const { ref, value } of captured.rows) {
            if (!isObject(value))
                continue;
            for (const key of Object.keys(value))
                if (numericalChannel(key)) {
                    fail('STATE_SYNTAX_UNSUPPORTED', '/settings');
                }
            const original = primaryRows.has(`${ref.table}:${ref.key}`);
            const fields = ref.table === 'cards' || ref.table === 'worldbook' ? ['content']
                : ref.table === 'rules' ? ['core', 'plot', 'narrative', 'reply', 'style']
                    : ref.table === 'status' || ref.table === 'opening' ? ['text'] : [];
            if (ref.table === 'worldbook') {
                for (const text of [value.name, value.comment, value.content])
                    if (typeof text === 'string'
                        && initSyntax(text) && !original)
                        fail('INITVAR_OUTSIDE_BINDING', '/settings', text);
                continue;
            }
            if (ref.table === 'rules' && original)
                continue;
            for (const field of fields) {
                const text = value[field];
                if (typeof text !== 'string')
                    continue;
                if (stateSyntax(text))
                    fail('STATE_SYNTAX_UNSUPPORTED', '/settings', text);
                render(text, context, false);
                if (initSyntax(text) && !original)
                    fail('INITVAR_OUTSIDE_BINDING', '/settings', text);
            }
        }
        const selection = selectNativeMvuInitializationPolicy({ books: [{ entries }],
            swipes: candidates.map(item => ({ rawOpening: item.rawText, renderedOpening: item.renderedText,
                ...(item.materialization ? { materialization: item.materialization } : {}) })) });
        if (selection.kind === 'unsupported')
            fail('INITVAR_INVALID', selection.diagnostics[0].pointer);
        return { entries, candidates, hasInit: entries.length > 0 || openingInit, policy: selection.policy };
    };
    const fresh = (snapshot) => {
        const observed = deps.readFreshNativeBasis(snapshot.source.sessionId, snapshot.swipes);
        if (!observed || observed.kind !== 'fresh')
            fail('BASIS_UNPROVEN', '/basis');
        const facts = observed.facts;
        boundedData(facts, 'BASIS_INVALID', '/basis');
        if (!isObject(facts))
            fail('BASIS_INVALID', '/basis');
        requireKeys(facts, ['schemaVersion', 'encoding', 'sessionId', 'ownerSessionId', 'branch', 'numerical', 'native', 'basis'], '/basis', 'BASIS_INVALID');
        for (const [value, keys] of [
            [facts.branch, ['metaKey', 'metaSha256', 'inheritance', 'parentSessionId', 'inheritedPrefixLength', 'ready']],
            [facts.numerical, ['headKey', 'headExists', 'eventMembershipSha256', 'eventCount', 'opaqueStateExists']],
            [facts.native, ['observedThroughSeq', 'historyVersionSha256', 'committedOpeningCount', 'inheritedMessageCount']],
            [facts.basis, ['bookStatData', 'swipes']],
        ]) {
            if (!isObject(value))
                fail('BASIS_INVALID', '/basis');
            requireKeys(value, keys, '/basis', 'BASIS_INVALID');
        }
        if (!facts || facts.schemaVersion !== 1 || facts.encoding !== 'native-mvu-fresh-basis-facts-v1'
            || facts.sessionId !== snapshot.source.sessionId || facts.ownerSessionId !== facts.sessionId
            || facts.branch?.metaKey !== `${facts.sessionId}__meta` || !isHash(facts.branch.metaSha256)
            || facts.branch.inheritance !== 'root' || facts.branch.parentSessionId !== null
            || facts.branch.inheritedPrefixLength !== 0 || facts.branch.ready !== true
            || facts.numerical?.headExists !== false || facts.numerical.eventCount !== 0 || facts.numerical.opaqueStateExists !== false
            || !idPattern.test(facts.numerical.headKey) || !facts.numerical.headKey.startsWith(`${facts.sessionId}__`)
            || !isHash(facts.numerical.eventMembershipSha256) || !isHash(facts.native?.historyVersionSha256)
            || !Number.isSafeInteger(facts.native.observedThroughSeq) || facts.native.observedThroughSeq < -1
            || facts.native.committedOpeningCount !== 0 || facts.native.inheritedMessageCount !== 0
            || !plainEmpty(facts.basis?.bookStatData) || !Array.isArray(facts.basis.swipes)
            || facts.basis.swipes.length !== snapshot.swipes.length)
            fail('BASIS_INVALID', '/basis');
        const actualMeta = deps.readRow('branch', facts.branch.metaKey);
        if (actualMeta === undefined || recordSha256(actualMeta) !== facts.branch.metaSha256
            || deps.readRow('status', facts.numerical.headKey) !== undefined)
            fail('BASIS_INVALID', '/basis');
        for (const [index, swipe] of facts.basis.swipes.entries()) {
            const source = snapshot.swipes[index];
            requireKeys(swipe, ['identity', 'sourceSha256', 'statData'], '/basis/swipes', 'BASIS_INVALID');
            if (swipe.identity !== source.identity || swipe.sourceSha256 !== source.sourceSha256 || !plainEmpty(swipe.statData)) {
                fail('BASIS_INVALID', '/basis/swipes');
            }
        }
        const content = { schemaVersion: 1, encoding: 'native-mvu-fresh-basis-proof-v1',
            sessionId: facts.sessionId, ownerSessionId: facts.ownerSessionId, branch: structuredClone(facts.branch),
            numerical: structuredClone(facts.numerical), native: structuredClone(facts.native),
            bookStatDataSha256: recordSha256(facts.basis.bookStatData),
            swipes: facts.basis.swipes.map(item => ({ identity: item.identity, sourceSha256: item.sourceSha256,
                statDataSha256: recordSha256(item.statData) })), factsSha256: recordSha256(facts) };
        return { proof: { ...content, proofSha256: recordSha256(content) }, facts };
    };
    const produce = (request) => {
        try {
            if (!isObject(request))
                fail('REQUEST_INVALID', '');
            boundedData(request, 'REQUEST_INVALID', '');
            requireKeys(request, ['catalog', 'candidate'], '', 'REQUEST_INVALID');
            const captured = capture(request.catalog.source.sessionId, request.candidate.index);
            const selected = captured.candidates.find(item => item.index === request.candidate.index);
            if (!same(captured.snapshot.source, request.catalog.source) || !same(captured.candidates, request.catalog.candidates)
                || !same(selected, request.candidate))
                fail('SOURCE_CHANGED', '/selected');
            const { entries, hasInit, policy } = classify(captured);
            const snapshot = withPolicy(captured.snapshot, policy);
            if (!hasInit) {
                const proof = { schemaVersion: 1, encoding: 'native-mvu-absence-scope-proof-v1',
                    reason: 'closed-native-scope-no-initialization', sourceSnapshot: snapshot };
                return { schemaVersion: 1, kind: 'legacy-v2', absenceScopeProof: { ...proof, proofSha256: recordSha256(proof) } };
            }
            if (!snapshot.bindings.primary || !entries.length)
                fail('PRIMARY_REQUIRED', '/bindings/primary');
            const { proof, facts } = fresh(snapshot);
            return { schemaVersion: 1, kind: 'native-json', candidate: { schemaVersion: 1, encoding: 'native-mvu-json-source-candidate-v1',
                    policy, sourceSnapshot: snapshot, freshNativeBasisProof: proof,
                    books: [{ identity: 'embedded-primary', binding: 'primary', sourcePointer: snapshot.bindings.primary.pointer,
                            sourceSha256: snapshot.bindings.primary.sha256, entries }], bookStatData: structuredClone(facts.basis.bookStatData),
                    initializedBooks: [], messageIndex: 0, selectedSwipeIdentity: `swipe-${request.candidate.index}`,
                    swipes: captured.candidates.map((item, index) => ({ identity: `swipe-${item.index}`, sourcePointer: item.sourcePointer,
                        sourceSha256: item.sourceSha256, rawOpening: item.rawText, renderedOpening: item.renderedText,
                        renderedSha256: sha(item.renderedText), statData: structuredClone(facts.basis.swipes[index].statData),
                        ...(item.materialization ? { materialization: item.materialization } : {}) })),
                    capabilities: { macros: snapshot.macroContext.used ? 'verified-identity-rendering' : 'none',
                        schema: 'json-object-subset-v1', callbacks: 'none' } } };
        }
        catch (error) {
            return { schemaVersion: 1, kind: 'unsupported', diagnostics: [error instanceof SourceFailure
                        ? error.diagnostic : { code: 'SOURCE_INVALID', pointer: '/source' }] };
        }
    };
    const current = (snapshot) => {
        try {
            boundedData(snapshot, 'SNAPSHOT_INVALID', '/snapshot');
            const { snapshotSha256, ...content } = snapshot;
            if (!isHash(snapshotSha256) || recordSha256(content) !== snapshotSha256
                || !isNativeMvuSourcePolicy(snapshot.policy))
                return false;
            // Re-read the whole declared scope, including membership. Do not compare
            // memory/native history/numerical head: our own successful publication must
            // not invalidate an input-source snapshot. Fresh basis has a separate owner.
            const actual = capture(snapshot.source.sessionId, snapshot.selected.index);
            return same(snapshot, withPolicy(actual.snapshot, classify(actual).policy));
        }
        catch {
            return false;
        }
    };
    function readAuthorSource(sessionId, selectedIndex) {
        try {
            return authorSourceOf(capture(sessionId, selectedIndex));
        }
        catch (error) {
            return { kind: 'unsupported', diagnostics: [error instanceof SourceFailure
                        ? error.diagnostic : { code: 'SOURCE_INVALID', pointer: '/source' }] };
        }
    }
    function schemaOpeningData(captured, recordedInitSource) {
        const author = authorSourceOf(captured);
        if (author.kind !== 'author-source')
            return author;
        if (!author.source.scripts.some(script => script.enabled))
            return { kind: 'absent' };
        const { entries, candidates, policy } = classify(captured, true, recordedInitSource);
        const primary = captured.snapshot.bindings.primary;
        const body = { schemaVersion: 1, encoding: 'native-mvu-schema-opening-init-source-v1',
            grammar: isNativeMvuYamlSourcePolicy(policy) ? 'yaml-1.2-json-data-v1' : 'strict-json-object-v1',
            books: primary ? [{ identity: 'embedded-primary', binding: 'primary', sourcePointer: primary.pointer,
                    sourceSha256: primary.sha256, entries }] : [],
            bookStatData: {}, initializedBooks: [], messageIndex: 0,
            selectedSwipeIdentity: `swipe-${captured.snapshot.selected.index}`,
            swipes: candidates.map(item => ({ identity: `swipe-${item.index}`, sourcePointer: item.sourcePointer,
                sourceSha256: item.sourceSha256, rawOpening: item.rawText, renderedOpening: item.renderedText,
                renderedSha256: sha(item.renderedText), statData: {}, ...(item.materialization ? { materialization: item.materialization } : {}) })),
            macros: captured.snapshot.macroContext.used ? 'verified-identity-rendering' : 'none' };
        const initSource = { ...body, initSourceSha256: recordSha256(body) };
        return { kind: 'schema-opening-data', authorSource: author.source, initSource };
    }
    /** Original raw descriptors only: no fresh-basis observation, numerical
     * capability, Native owner or publication side effect is created here. */
    function readSchemaOpeningData(sessionId, selectedIndex, recordedInitSource) {
        try {
            return schemaOpeningData(capture(sessionId, selectedIndex), recordedInitSource);
        }
        catch (error) {
            return { kind: 'unsupported', diagnostics: [error instanceof SourceFailure
                        ? error.diagnostic : { code: 'SOURCE_INVALID', pointer: '/source' }] };
        }
    }
    function readSchemaOpeningSource(request) {
        try {
            const captured = capture(request.catalog.source.sessionId, request.candidate.index);
            if (!same(captured.snapshot.source, request.catalog.source) || !same(captured.candidates, request.catalog.candidates)
                || !same(captured.candidates.find(item => item.index === request.candidate.index), request.candidate)) {
                fail('SOURCE_CHANGED', '/selected');
            }
            const data = schemaOpeningData(captured);
            if (data.kind !== 'schema-opening-data')
                return data;
            const { proof } = fresh(captured.snapshot);
            return { kind: 'schema-opening-source', source: { authorSource: data.authorSource, initSource: data.initSource,
                    freshNativeBasisProof: proof } };
        }
        catch (error) {
            return { kind: 'unsupported', diagnostics: [error instanceof SourceFailure
                        ? error.diagnostic : { code: 'SOURCE_INVALID', pointer: '/source' }] };
        }
    }
    function schemaOpeningSourceCurrent(expected) {
        try {
            // Do not recapture an empty basis after our own dispatch/opening writes.
            // Original fresh-basis and current Native publication have distinct owners.
            const data = schemaOpeningData(capture(expected.sourceSnapshot.source.sessionId, expected.sourceSnapshot.selected.index), expected.initSource);
            return data.kind === 'schema-opening-data' && data.authorSource.authorSourceSha256 === expected.authorSourceSha256
                && same(data.authorSource.snapshot, expected.sourceSnapshot) && same(data.initSource, expected.initSource);
        }
        catch {
            return false;
        }
    }
    function authorSourceCurrent(expected) {
        try {
            const saved = cloneSchemaData(expected, 8 * MAX_BYTES);
            const actual = readAuthorSource(saved.snapshot.source.sessionId, saved.snapshot.selected.index);
            return actual.kind === 'author-source' && same(saved, actual.source);
        }
        catch {
            return false;
        }
    }
    return { produce, current, readAuthorSource, authorSourceCurrent, readSchemaOpeningData,
        readSchemaOpeningSource, schemaOpeningSourceCurrent };
}
