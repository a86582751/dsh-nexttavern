// Generated from runtime/alpha3/src/core/roleplay-mvu-source.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
import { assertImportRecordIntegrity, importCoverage } from './roleplay-import-record.js';
import { compileTavernOpeningCandidates, decodeTavernCard } from './tavern-card.js';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const keyPattern = /^[a-zA-Z0-9_-]{1,256}$/;
const MAX_BYTES = 1_048_576;
const MAX_ROWS = 4096;
const policyContent = Object.freeze({
    schemaVersion: 1, id: 'native-json-initialization-v1', version: 1,
    classifierId: 'native-json-source-classifier-v1', classifierVersion: 1,
    scope: 'import-and-session-settings', bindings: 'embedded-primary-only',
    grammar: 'strict-json-object-simple-wrappers-v1', originalLoaderSettlement: 'not-proven',
    staticAlgorithm: Object.freeze({ dialect: 'A',
        sha256: '3759d0c8b9f82c67a606afae11de9a90e3ee4e63298ef622b89ac9127eb77047',
        commit: 'b13b43bac24d585f2b523c12e423bb803fa9dd7c' }),
    bounds: Object.freeze({ bytes: MAX_BYTES, nodes: 32_000, depth: 32, membershipRows: MAX_ROWS }),
});
/** Maintained program policy, never a flag or loader claim supplied by a client/card. */
export const NATIVE_MVU_SOURCE_POLICY = Object.freeze({ ...policyContent, sha256: recordSha256(policyContent) });
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
function extensions(value, pointer) {
    if (value === undefined)
        return;
    if (!isObject(value))
        fail('EXTENSION_UNSUPPORTED', pointer, value);
    requireKeys(value, ['fav', 'talkativeness', 'depth_prompt'], pointer, 'EXTENSION_UNSUPPORTED');
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
/** Core owns the existing source/import lock. All reads are synchronous; this
 * module neither acquires a second lock nor writes any Domain/native record. */
export function createRoleplayMvuSource(deps) {
    const capture = (sessionId, selectedIndex) => {
        if (!idPattern.test(sessionId) || !Number.isSafeInteger(selectedIndex) || selectedIndex < 0)
            fail('REQUEST_INVALID', '');
        const pointer = deps.readActivePointer(sessionId);
        if (!pointer || !idPattern.test(pointer.importId) || !isHash(pointer.normalizedSha256)
            || !isHash(pointer.coverageSha256) || typeof pointer.transactionId !== 'string')
            fail('SOURCE_INVALID', '/source');
        requireKeys(pointer, ['importId', 'sourceRecordSessionId', 'normalizedSha256',
            'transactionId', 'coverageSha256', 'activatedAt'], '/source', 'SOURCE_INVALID');
        if (!idPattern.test(pointer.transactionId))
            fail('SOURCE_INVALID', '/source');
        const owner = pointer.sourceRecordSessionId ?? sessionId;
        if (!idPattern.test(owner))
            fail('SOURCE_INVALID', '/source');
        const record = deps.readImportRecord(owner, pointer.importId);
        if (!record || ![4, 5].includes(record.schemaVersion) || record.status !== 'active'
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
        const coverage = importCoverage(record);
        if (coverage.coverage !== 1 || coverage.uncovered.length || coverage.overlaps.length
            || recordSha256(coverage) !== pointer.coverageSha256)
            fail('SOURCE_INVALID', '/source/coverage');
        const rows = [];
        const budget = { nodes: 0, bytes: 0 };
        const seen = new Set();
        const read = (table, key, expected) => {
            if (!keyPattern.test(key) || !key.startsWith(`${sessionId}__`) || rows.length >= MAX_ROWS)
                fail('MATERIAL_INVALID', '/material');
            const id = `${table}:${key}`;
            const value = deps.readRow(table, key);
            if (value !== undefined && !isObject(value))
                fail('FIELD_UNSUPPORTED', '/settings');
            if (!seen.has(id))
                boundedData(value ?? null, 'FIELD_UNSUPPORTED', '/settings', budget);
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
            read(digest.tableName, digest.key, digest.sha256);
            activationRows.add(`${digest.tableName}:${digest.key}`);
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
        const envelope = record.sourceEnvelope;
        const decoded = decodeTavernCard(Buffer.from(envelope.base64, 'base64'), envelope.extension);
        boundedData(decoded.document, 'FIELD_UNSUPPORTED', '/document', budget);
        const candidates = compileTavernOpeningCandidates(decoded, context.context);
        const selected = candidates.find(item => item.index === selectedIndex);
        if (!selected)
            fail('REQUEST_INVALID', '/selected');
        const source = { sessionId, importId: pointer.importId, sourceRecordSessionId: owner,
            rawSha256: record.rawSha256, normalizedSha256: record.normalizedSha256, transactionId: pointer.transactionId,
            coverageSha256: pointer.coverageSha256, pointer: { ...pointer } };
        const root = decoded.document.data === decoded.data ? '/data' : '';
        const used = JSON.stringify(decoded.document).includes('{{')
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
        };
        return { snapshot: { ...content, snapshotSha256: recordSha256(content) }, document: decoded.document,
            data: decoded.data, context: context.context, candidates, rows, activationRows };
    };
    const classify = (captured) => {
        const { data, context, snapshot } = captured;
        if (captured.document !== data)
            requireKeys(captured.document, ['spec', 'spec_version', 'data'], '/document', 'FIELD_UNSUPPORTED');
        requireKeys(data, ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'system_prompt',
            'post_history_instructions', 'creator_notes', 'tags', 'creator', 'character_version', 'alternate_greetings',
            'extensions', 'character_book'], '/data', 'FIELD_UNSUPPORTED');
        extensions(data.extensions, '/data/extensions');
        const depthPrompt = data.extensions?.depth_prompt;
        if (depthPrompt)
            render(depthPrompt.prompt, context, false);
        for (const [key, value] of Object.entries(data)) {
            if (['extensions', 'character_book', 'first_mes', 'alternate_greetings'].includes(key))
                continue;
            if (key === 'tags' ? !Array.isArray(value) || value.some(item => typeof item !== 'string') : typeof value !== 'string') {
                fail('FIELD_UNSUPPORTED', `/data/${pointerPart(key)}`, value);
            }
            for (const text of typeof value === 'string' ? [value] : value) {
                if (stateSyntax(text) || initSyntax(text))
                    fail('STATE_SYNTAX_UNSUPPORTED', `/data/${pointerPart(key)}`, text);
                render(text, context, false);
            }
        }
        const book = data.character_book;
        const entries = [];
        if (book !== undefined) {
            if (!isObject(book) || !Array.isArray(book.entries))
                fail('FIELD_UNSUPPORTED', '/data/character_book', book);
            requireKeys(book, ['name', 'description', 'entries', 'extensions', 'scan_depth', 'token_budget', 'recursive_scanning'], '/data/character_book', 'FIELD_UNSUPPORTED');
            if (book.extensions !== undefined && !plainEmpty(book.extensions))
                fail('EXTENSION_UNSUPPORTED', '/data/character_book/extensions');
            for (const key of ['name', 'description'])
                if (book[key] !== undefined && typeof book[key] !== 'string') {
                    fail('FIELD_UNSUPPORTED', '/data/character_book');
                }
            for (const key of ['name', 'description'])
                if (typeof book[key] === 'string'
                    && (stateSyntax(book[key]) || initSyntax(book[key])))
                    fail('STATE_SYNTAX_UNSUPPORTED', '/data/character_book');
            for (const key of ['scan_depth', 'token_budget'])
                if (book[key] !== undefined
                    && (!Number.isSafeInteger(book[key]) || Number(book[key]) < 0))
                    fail('FIELD_UNSUPPORTED', '/data/character_book');
            if (book.recursive_scanning !== undefined && typeof book.recursive_scanning !== 'boolean') {
                fail('FIELD_UNSUPPORTED', '/data/character_book');
            }
            for (const [index, raw] of book.entries.entries()) {
                const pointer = `${snapshot.bindings.primary.pointer}/entries/${index}`;
                if (!isObject(raw) || typeof raw.content !== 'string' || raw.comment !== undefined && typeof raw.comment !== 'string') {
                    fail('FIELD_UNSUPPORTED', pointer);
                }
                requireKeys(raw, ['id', 'name', 'comment', 'content', 'keys', 'key', 'secondary_keys', 'keysecondary', 'enabled', 'disable',
                    'constant', 'selective', 'case_sensitive', 'use_regex', 'insertion_order', 'order', 'position', 'extensions'], pointer, 'FIELD_UNSUPPORTED');
                if (raw.extensions !== undefined && !plainEmpty(raw.extensions))
                    fail('EXTENSION_UNSUPPORTED', pointer);
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
                const comment = String(raw.comment ?? '');
                const isInit = comment.toLowerCase().includes('[initvar]');
                if (!isInit && initSyntax(raw.content))
                    fail('INITVAR_OUTSIDE_BINDING', pointer, raw.content);
                const rendered = render(raw.content, context, isInit);
                if (isInit) {
                    entries.push({ identity: `entry-${index}`, sourcePointer: pointer, comment,
                        enabled: raw.enabled !== false && raw.disable !== true, content: raw.content, contentSha256: sha(raw.content),
                        renderedContent: rendered, renderedContentSha256: sha(rendered) });
                }
            }
        }
        let openingInit = false;
        for (const candidate of captured.candidates) {
            if (stateSyntax(candidate.rawText))
                fail('STATE_SYNTAX_UNSUPPORTED', candidate.sourcePointer, candidate.rawText);
            if (openingBlocks(candidate.renderedText, candidate.sourcePointer))
                openingInit = true;
            render(candidate.rawText, context, entries.length > 0 || openingInit);
        }
        // Import projection can move a constant InitVar payload into rules. Its
        // immutable activation digest authorizes those original rows only; unrelated
        // session records carrying initialization declarations cannot be ignored.
        const primaryRows = captured.activationRows;
        for (const { ref, value } of captured.rows) {
            boundedData(value ?? null, 'FIELD_UNSUPPORTED', '/settings');
            const texts = [];
            const walk = (item) => {
                if (typeof item === 'string')
                    texts.push(item);
                else if (item && typeof item === 'object')
                    for (const [key, child] of Object.entries(item)) {
                        if (/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)
                            || /^(?:card_agent|chaoshen_jixieshi|risuai)$/.test(key)
                            || key.startsWith('$'))
                            fail('STATE_SYNTAX_UNSUPPORTED', '/settings');
                        if (key === 'extensions')
                            extensions(child, '/settings/extensions');
                        walk(child);
                    }
            };
            walk(value);
            for (const text of texts) {
                if (stateSyntax(text))
                    fail('STATE_SYNTAX_UNSUPPORTED', '/settings', text);
                render(text, context, false);
                if (initSyntax(text) && !primaryRows.has(`${ref.table}:${ref.key}`))
                    fail('INITVAR_OUTSIDE_BINDING', '/settings', text);
            }
        }
        return { entries, hasInit: entries.length > 0 || openingInit };
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
            const { entries, hasInit } = classify(captured);
            const snapshot = captured.snapshot;
            if (!hasInit) {
                const proof = { schemaVersion: 1, encoding: 'native-mvu-absence-scope-proof-v1',
                    reason: 'closed-native-scope-no-initialization', sourceSnapshot: snapshot };
                return { schemaVersion: 1, kind: 'legacy-v2', absenceScopeProof: { ...proof, proofSha256: recordSha256(proof) } };
            }
            if (!snapshot.bindings.primary || !entries.length)
                fail('PRIMARY_REQUIRED', '/bindings/primary');
            const { proof, facts } = fresh(snapshot);
            return { schemaVersion: 1, kind: 'native-json', candidate: { schemaVersion: 1, encoding: 'native-mvu-json-source-candidate-v1',
                    policy: NATIVE_MVU_SOURCE_POLICY, sourceSnapshot: snapshot, freshNativeBasisProof: proof,
                    books: [{ identity: 'embedded-primary', binding: 'primary', sourcePointer: snapshot.bindings.primary.pointer,
                            sourceSha256: snapshot.bindings.primary.sha256, entries }], bookStatData: structuredClone(facts.basis.bookStatData),
                    initializedBooks: [], messageIndex: 0, selectedSwipeIdentity: `swipe-${request.candidate.index}`,
                    swipes: captured.candidates.map((item, index) => ({ identity: `swipe-${item.index}`, sourcePointer: item.sourcePointer,
                        sourceSha256: item.sourceSha256, rawOpening: item.rawText, renderedOpening: item.renderedText,
                        renderedSha256: sha(item.renderedText), statData: structuredClone(facts.basis.swipes[index].statData) })),
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
                || !same(snapshot.policy, NATIVE_MVU_SOURCE_POLICY))
                return false;
            // Re-read the whole declared scope, including membership. Do not compare
            // memory/native history/numerical head: our own successful publication must
            // not invalidate an input-source snapshot. Fresh basis has a separate owner.
            return same(snapshot, capture(snapshot.source.sessionId, snapshot.selected.index).snapshot);
        }
        catch {
            return false;
        }
    };
    return { produce, current };
}
