// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-variables-data.ts; edit the TypeScript source.
/** Bounded JSON/YAML and catalog provenance for readonly prompt variables.
 * This owner does not read storage, grant a capability or execute templates. */
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { parseMvuYamlData } from './tavern-mvu-yaml.js';
import { ST_LORE_ENTRY_DEFAULTS_V1 } from './tavern-lore-fixed-profile.mjs';
import { tavernLoreEntrySemanticSha256V1 } from './tavern-lore-timed.mjs';
import { validateTavernLoreAbsentSourceReferenceV1 } from './tavern-lore-compiler.mjs';
import { validateTavernSourceInheritanceDescriptorV1 } from './roleplay-tavern-source-inheritance-data.js';
export const TAVERN_PROMPT_VARIABLE_BOUNDS_V1 = Object.freeze({ inputBytes: 16_777_216, outputBytes: 8_388_608,
    valuesBytes: 1_048_576, valuesNodes: 32000, valuesDepth: 32, entries: 2048, initialEntries: 128,
    historyMessages: 2048, readDependencies: 4096, renderedTotalBytes: 4_194_304, deadlineMs: 10_000 });
export class TavernPromptVariableFailureV1 extends Error {
    code;
    detail;
    constructor(code, detail = '') {
        super(code);
        this.code = code;
        this.detail = detail;
    }
}
export function promptFail(code, detail = '') { throw new TavernPromptVariableFailureV1(code, detail); }
export const promptObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
export const promptHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function promptExact(value, keys) {
    if (!promptObject(value) || Object.keys(value).length !== keys.length
        || Object.keys(value).some(key => !keys.includes(key)))
        promptFail('PROMPT_VARIABLE_RECORD_SHAPE');
}
export function promptFreeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            promptFreeze(child);
        Object.freeze(value);
    }
    return value;
}
export function promptValues(value) {
    const data = cloneSchemaData(value, TAVERN_PROMPT_VARIABLE_BOUNDS_V1.valuesBytes, { nodes: TAVERN_PROMPT_VARIABLE_BOUNDS_V1.valuesNodes, depth: TAVERN_PROMPT_VARIABLE_BOUNDS_V1.valuesDepth });
    if (!promptObject(data))
        promptFail('PROMPT_VARIABLE_OBJECT_REQUIRED');
    return data;
}
export function promptRef(value) {
    promptExact(value, ['ownerId', 'versionSha256', 'ref', 'refSha256']);
    if (typeof value.ownerId !== 'string' || !value.ownerId || Buffer.byteLength(value.ownerId, 'utf8') > 256
        || !promptHash(value.versionSha256) || !promptObject(value.ref) || !promptHash(value.refSha256)
        || recordSha256(value.ref) !== value.refSha256)
        promptFail('PROMPT_VARIABLE_REF_INVALID');
    cloneSchemaData(value.ref, 65536, { nodes: 4096, depth: 16 });
}
export function promptRead(kind, identity, valueSha256, provenance) {
    promptRef(provenance);
    if (!promptHash(valueSha256) || !identity || Buffer.byteLength(identity, 'utf8') > 4096)
        promptFail('PROMPT_VARIABLE_READ_INVALID');
    return { kind, identity, valueSha256, provenance };
}
export function promptFact(fact) {
    if (fact.kind === 'unavailable') {
        promptExact(fact, ['kind', 'missingEvidence']);
        if (!Array.isArray(fact.missingEvidence) || !fact.missingEvidence.length
            || fact.missingEvidence.some(value => typeof value !== 'string' || !value || value.length > 4096)) {
            promptFail('PROMPT_VARIABLE_UNAVAILABLE_INVALID');
        }
        return { kind: 'unavailable', missingEvidence: fact.missingEvidence };
    }
    if (fact.kind === 'absent') {
        promptExact(fact, ['kind', 'provenance']);
        promptRef(fact.provenance);
        return { kind: 'known', values: {}, read: promptRead('scope', 'actual-absence', recordSha256({ kind: 'absent' }), fact.provenance) };
    }
    promptExact(fact, ['kind', 'values', 'valuesSha256', 'provenance']);
    if (fact.kind !== 'values')
        promptFail('PROMPT_VARIABLE_FACT_INVALID');
    const values = promptValues(fact.values);
    if (recordSha256(values) !== fact.valuesSha256)
        promptFail('PROMPT_VARIABLE_FACT_HASH');
    return { kind: 'known', values, read: promptRead('scope', 'actual-values', fact.valuesSha256, fact.provenance) };
}
export function promptBinding(scope, ownerId, values, derivation) {
    const cloned = promptValues(values);
    return { scope, ownerId, values: cloned, valuesSha256: recordSha256(cloned), versionSha256: recordSha256(derivation) };
}
export function promptBound(scope, ownerId, values, reads, derivation) {
    return { kind: 'bound', binding: promptBinding(scope, ownerId, values, derivation), reads, derivationSha256: recordSha256(derivation) };
}
export function promptUnavailable(scope, ownerId, missingEvidence, reads) {
    return { kind: 'unavailable', scope, ownerId, missingEvidence: [...new Set(missingEvidence)], reads,
        diagnostic: 'PROMPT_VARIABLE_SCOPE_UNAVAILABLE' };
}
/** Match mergeWith's arrays-replace customizer over the accepted plain-JSON
 * domain. Object into an existing array would create non-index properties in
 * lodash; refuse that non-JSON result instead of silently converting it. */
export function mergePromptInitialDataV1(destination, source) {
    const target = promptValues(destination), incoming = promptValues(source);
    function merge(dst, src) {
        for (const [key, value] of Object.entries(src)) {
            if (promptObject(value)) {
                const existing = dst[key];
                if (Array.isArray(existing))
                    promptFail('PROMPT_INITIAL_MERGE_NON_JSON_TARGET', key);
                const next = promptObject(existing) ? existing : {};
                merge(next, value);
                dst[key] = next;
            }
            else
                dst[key] = value;
        }
    }
    merge(target, incoming);
    return promptValues(target);
}
/** JSON syntax failure alone activates the YAML fallback. A valid JSON value
 * that violates the plain data contract remains a refusal, never reinterpreted. */
export function parsePromptInitialDataV1(text) {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.valuesBytes) {
        promptFail('PROMPT_INITIAL_TEXT_LIMIT');
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        const yaml = parseMvuYamlData(text);
        if (yaml.kind !== 'parsed')
            promptFail(`PROMPT_INITIAL_${yaml.code}`, yaml.pointer ?? '');
        return { data: promptValues(yaml.data), parser: yaml.parserPolicy };
    }
    return { data: promptValues(parsed), parser: 'json-data-v1' };
}
const knownDecorators = new Set(['@@activate', '@@dont_activate', '@@message_formatting', '@@generate_before',
    '@@generate_after', '@@render_before', '@@render_after', '@@dont_preload', '@@initial_variables',
    '@@always_enabled', '@@only_preload', '@@preload', '@@iframe', '@@preprocessing', '@@if', '@@private']);
/** Fixed Prompt Template parseDecorators cursor and @@@ fallback rules. Unknown
 * leading decorators are consumed exactly as fixed source, not executed. */
function inlineDecorators(content) {
    if (!content.startsWith('@@'))
        return { names: [], body: content };
    const names = [], decorators = [];
    let start = 0, fallback = false;
    while (start < content.length && content.startsWith('@@', start)) {
        let end = content.indexOf('\n', start);
        if (end < 0)
            end = content.length;
        let line = content.slice(start, end);
        if (line.endsWith('\r'))
            line = line.slice(0, -1);
        const escaped = line.startsWith('@@@');
        if (escaped && !fallback)
            break;
        const candidate = escaped ? line.slice(1) : line, space = candidate.indexOf(' ');
        const base = space < 0 ? candidate : candidate.slice(0, space);
        if (knownDecorators.has(base)) {
            decorators.push(candidate);
            fallback = false;
        }
        else
            fallback = true;
        start = end === content.length ? content.length : end + 1;
    }
    for (const line of decorators)
        names.push(line.split(' ')[0]);
    return { names, body: content.slice(start) };
}
export function promptInitialEntryV1(entry, invertEnabled) {
    const parsed = entry.decorators?.length
        ? { names: entry.decorators.map(line => line.split(' ')[0]), body: entry.content } : inlineDecorators(entry.content);
    const has = (name) => parsed.names.includes(name), title = entry.title;
    const special = has('@@initial_variables') || title.includes('[InitialVariables]') || title.includes('@INJECT')
        || has('@@only_preload') || title.includes('[GENERATE:') || title.includes('[RENDER:')
        || ['@@generate_after', '@@generate_before', '@@render_after', '@@render_before'].some(has);
    const enabled = has('@@always_enabled') || ((invertEnabled && special) ? !entry.currentSemantic.enabled : entry.currentSemantic.enabled);
    return { selected: enabled && (has('@@initial_variables') || title.startsWith('[InitialVariables]')),
        enabled, body: parsed.body, names: parsed.names };
}
/** Verify consumer-data completeness and original/current hash links. Actual
 * owner reads, physical scope identity and currentness stay with the supplier. */
export function validatePromptVariableSourceV1(source) {
    promptExact(source, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'sourceRecordSessionId', 'normalizer',
        'original', 'current', 'sourceSha256', ...(Object.hasOwn(source, 'inheritance') ? ['inheritance'] : [])]);
    if (source.schemaVersion !== 1 || source.encoding !== 'tavern-lore-current-source-data-v1'
        || source.authority !== 'consumer-data-only' || typeof source.sessionId !== 'string' || !source.sessionId
        || typeof source.sourceRecordSessionId !== 'string' || !source.sourceRecordSessionId
        || !['tavern-fields-v1', 'tavern-fields-v2', 'nexttavern-fields-v1'].includes(source.normalizer))
        promptFail('PROMPT_VARIABLE_SOURCE_INVALID');
    const { sourceSha256, ...sourceBody } = source;
    if (!promptHash(sourceSha256) || recordSha256(sourceBody) !== sourceSha256)
        promptFail('PROMPT_VARIABLE_SOURCE_HASH');
    if (source.inheritance) {
        const inherited = validateTavernSourceInheritanceDescriptorV1(source.inheritance), original = inherited.originalBinding;
        if (inherited.childSessionId !== source.sessionId || original.sourceRecordSessionId !== source.sourceRecordSessionId
            || original.importId !== source.original.activePointer.importId || original.rawSha256 !== source.original.rawSha256
            || original.normalizedSha256 !== source.original.normalizedSha256 || original.coverageSha256 !== source.original.coverageSha256
            || original.transactionId !== source.original.transactionId || original.normalizer !== source.normalizer
            || original.documentSha256 !== source.original.documentSha256 || original.dataSha256 !== source.original.dataSha256
            || original.importRecordRef.key !== source.original.importRecordRef.key
            || original.importRecordRef.sha256 !== source.original.importRecordRef.sha256)
            promptFail('PROMPT_VARIABLE_SOURCE_INHERITANCE_JOIN');
    }
    promptExact(source.original, ['activePointer', 'activePointerRef', 'importRecordRef', 'rawSha256', 'normalizedSha256',
        'coverageSha256', 'transactionId', 'decodedFormat', 'documentSha256', 'dataSha256', 'documentDataRootPointer', 'primary']);
    promptExact(source.current, ['rows', 'materialSha256', 'cards', 'worldbook', 'rules', 'settings', 'membershipSha256', 'openingContext']);
    promptExact(source.current.openingContext, ['context', 'bindingSha256', 'valuesSha256']);
    if (!Array.isArray(source.current.rows) || recordSha256(source.current.rows) !== source.current.materialSha256
        || !promptObject(source.current.cards) || !promptObject(source.current.worldbook)
        || typeof source.current.rules !== 'string' || typeof source.current.settings !== 'string'
        || recordSha256({ cards: source.current.cards, worldbook: source.current.worldbook, rules: source.current.rules,
            settings: source.current.settings }) !== source.current.membershipSha256
        || recordSha256(source.current.openingContext.context) !== source.current.openingContext.valuesSha256) {
        promptFail('PROMPT_VARIABLE_SOURCE_CURRENT_FACTS_INVALID');
    }
    const primary = source.original.primary;
    promptExact(primary, ['binding', 'bookPointer', 'bookSha256', 'value', 'entries',
        ...(primary.binding === 'proven-absence' ? ['absenceProof'] : [])]);
    if (!['primary', 'proven-absence'].includes(primary.binding) || primary.bookPointer !== '/data/character_book'
        || recordSha256(primary.value) !== primary.bookSha256 || !Array.isArray(primary.entries)) {
        promptFail('PROMPT_VARIABLE_PRIMARY_INVALID');
    }
    if (primary.binding === 'proven-absence') {
        if (primary.value !== null || primary.entries.length !== 0)
            promptFail('PROMPT_VARIABLE_ABSENCE_INVALID');
        const original = source.original, proof = primary.absenceProof;
        validateTavernLoreAbsentSourceReferenceV1({ schemaVersion: 1,
            encoding: 'st-character-book-source-reference-v1', ownerSessionId: source.sessionId,
            sourceRecordSessionId: source.sourceRecordSessionId, importId: original.activePointer.importId,
            rawSourceSha256: original.rawSha256, importRecordSha256: original.importRecordRef.sha256,
            sourceSnapshotSha256: source.sourceSha256, documentSha256: original.documentSha256,
            bookPointer: primary.bookPointer, bookValueSha256: primary.bookSha256,
            sourceFormat: original.decodedFormat === 'json-nexttavern-v1' ? 'nexttavern-character-book'
                : original.decodedFormat.endsWith('v3') ? 'ccv3-character-book' : 'ccv2-character-book',
            ...(source.inheritance ? { inheritance: source.inheritance } : {}),
            bookPresence: 'proven-absence', absenceProof: proof });
        const ancestor = source.inheritance?.originalBinding, expectedPointer = ancestor?.originalPointer ?? original.activePointer, expectedPointerRef = ancestor?.originalPointerRef ?? original.activePointerRef;
        if (proof.dataSha256 !== original.dataSha256 || proof.decodedFormat !== original.decodedFormat
            || proof.normalizedSha256 !== original.normalizedSha256 || proof.coverageSha256 !== original.coverageSha256
            || proof.transactionId !== original.transactionId
            || recordSha256(proof.activePointer) !== recordSha256(expectedPointer)
            || recordSha256(proof.activePointerRef) !== recordSha256(expectedPointerRef)
            || recordSha256(proof.importRecordRef) !== recordSha256(original.importRecordRef)) {
            promptFail('PROMPT_VARIABLE_ABSENCE_SOURCE_JOIN');
        }
    }
}
export function validatePromptVariableCatalogV1(source, catalog) {
    validatePromptVariableSourceV1(source);
    const typedCatalog = catalog;
    const sourceSha256 = source.sourceSha256, primary = source.original.primary, entries = catalog.entries;
    const currentMembers = catalog.schemaVersion === 2
        && Object.hasOwn(catalog.completeCatalogRef.ref, 'currentNativeMembershipSha256');
    const expectedEntryCount = currentMembers ? catalog.completeCatalogRef.ref.actualCurrentEntryCount : primary.entries.length;
    promptExact(catalog, ['schemaVersion', 'encoding', 'sourceSha256', 'bookSha256', 'entries', 'invertEnabled',
        'settingsRef', 'completeCatalogRef', 'catalogSha256']);
    const { catalogSha256, ...body } = catalog;
    if (!(catalog.schemaVersion === 1 && catalog.encoding === 'owned-prompt-initial-variable-catalog-v1'
        || catalog.schemaVersion === 2 && catalog.encoding === 'owned-prompt-initial-variable-catalog-v2')
        || catalog.sourceSha256 !== sourceSha256 || catalog.bookSha256 !== primary.bookSha256
        || typeof catalog.invertEnabled !== 'boolean' || recordSha256(body) !== catalogSha256
        || !Array.isArray(catalog.entries) || catalog.entries.length > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.entries
        || catalog.entries.length !== expectedEntryCount) {
        promptFail('PROMPT_VARIABLE_CATALOG_INVALID');
    }
    promptRef(catalog.settingsRef);
    promptRef(catalog.completeCatalogRef);
    if (primary.binding === 'proven-absence' && !currentMembers) {
        if (catalog.entries.length !== 0)
            promptFail('PROMPT_VARIABLE_CATALOG_INCOMPLETE');
        return;
    }
    const rawBookEntries = primary.value?.entries;
    if (!currentMembers && (!rawBookEntries || typeof rawBookEntries !== 'object'
        || Object.keys(rawBookEntries).length !== primary.entries.length)) {
        promptFail('PROMPT_VARIABLE_CATALOG_INCOMPLETE');
    }
    const pointers = new Set(), entryIds = new Set();
    const semanticFields = [...Object.keys(ST_LORE_ENTRY_DEFAULTS_V1), 'content', 'primaryKeys', 'order', 'displayIndex'];
    for (const [index, entry] of entries.entries()) {
        promptExact(entry, ['ordinal', 'entryId', 'rawEntryPointer', 'rawEntrySha256', 'title', 'currentSemantic',
            'currentSemanticSha256', 'contentPointer', 'content', 'contentSha256', 'decorators', 'provenance']);
        const original = currentMembers ? undefined : primary.entries[index], key = original?.entryKey, pointer = currentMembers ? `/currentNativeMembership/members/${index}/rawEntry`
            : `${primary.bookPointer}/entries/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
        if (entry.ordinal !== index || !promptHash(entry.entryId) || entryIds.has(entry.entryId) || pointers.has(entry.rawEntryPointer)
            || entry.rawEntryPointer !== pointer
            || !currentMembers && (original.ref.entryPointer !== pointer || original.ref.entryOrdinal !== index
                || original.ref.sessionId !== source.sessionId || original.ref.bookSha256 !== primary.bookSha256
                || entry.rawEntrySha256 !== original.ref.entrySha256 || recordSha256(original.value) !== entry.rawEntrySha256
                || recordSha256(rawBookEntries[key]) !== entry.rawEntrySha256)
            || entry.contentPointer !== `${pointer}/content` || typeof entry.title !== 'string' || Buffer.byteLength(entry.title, 'utf8') > 4096
            || typeof entry.content !== 'string' || schemaTextSha256(entry.content) !== entry.contentSha256) {
            promptFail('PROMPT_VARIABLE_CATALOG_ENTRY_LINK', String(index));
        }
        pointers.add(entry.rawEntryPointer);
        entryIds.add(entry.entryId);
        promptRef(entry.provenance);
        if (typedCatalog.schemaVersion === 1) {
            const semantic = typedCatalog.entries[index].currentSemantic;
            promptExact(semantic, semanticFields);
            if (typeof semantic.enabled !== 'boolean' || semantic.content.kind !== 'unexecuted-source-text'
                || semantic.content.pointer !== entry.contentPointer || semantic.content.contentSha256 !== entry.contentSha256
                || tavernLoreEntrySemanticSha256V1(semantic) !== entry.currentSemanticSha256) {
                promptFail('PROMPT_VARIABLE_CATALOG_SEMANTIC_HASH', entry.entryId);
            }
            const current = semantic.content.currentNative;
            if (current) {
                if (current.text !== entry.content || current.contentSha256 !== entry.contentSha256
                    || recordSha256(current.origin.ref) !== current.origin.refSha256)
                    promptFail('PROMPT_VARIABLE_CURRENT_CONTENT_LINK');
            }
            else if (original.value.content !== entry.content)
                promptFail('PROMPT_VARIABLE_ORIGINAL_CONTENT_LINK');
        }
        else {
            promptExact(entry.currentSemantic, ['enabled']);
            if (typeof entry.currentSemantic.enabled !== 'boolean' || recordSha256(entry.currentSemantic) !== entry.currentSemanticSha256) {
                promptFail('PROMPT_VARIABLE_CATALOG_SEMANTIC_HASH', entry.entryId);
            }
            const supplied = entry.provenance.ref, origin = supplied.currentNativeOriginSha256;
            if (supplied.schemaVersion !== 2 || supplied.encoding !== 'owned-source-prompt-initial-entry-ref-v2'
                || supplied.sourceSha256 !== sourceSha256 || supplied.rawEntryPointer !== entry.rawEntryPointer
                || supplied.rawEntrySha256 !== entry.rawEntrySha256 || supplied.currentSemanticSha256 !== entry.currentSemanticSha256
                || supplied.currentContentSha256 !== entry.contentSha256 || origin !== null && !promptHash(origin)) {
                promptFail('PROMPT_VARIABLE_CURRENT_CONTENT_LINK');
            }
            // Current members have already been materialized by the journal and
            // catalog owner; their text is not an immutable original-book ordinal.
            if (!currentMembers && origin === null && original.value.content !== entry.content)
                promptFail('PROMPT_VARIABLE_ORIGINAL_CONTENT_LINK');
        }
        if (entry.decorators !== null && (!Array.isArray(entry.decorators) || entry.decorators.length > 128
            || entry.decorators.some(line => typeof line !== 'string' || !line.startsWith('@@') || line.length > 4096))) {
            promptFail('PROMPT_VARIABLE_DECORATOR_RECORD_INVALID');
        }
    }
}
