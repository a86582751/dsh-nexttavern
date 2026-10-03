// Generated from runtime/alpha3/src/core/tavern-template-data.mts; edit the TypeScript source.
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, schemaTextSha256 } from './tavern-mvu-schema-data.js';
export const TEMPLATE_LIMITS_V1 = Object.freeze({ sourceChars: 16384, outputChars: 65536,
    snapshotBytes: 4_194_304, snapshotNodes: 65_536, snapshotDepth: 32,
    requestBytes: 4_456_448, requestNodes: 66_048, requestDepth: 36,
    workerInputBytes: 8_388_608, workerInputNodes: 131_072, workerInputDepth: 48,
    inventoryBytes: 2_097_152, inventoryNodes: 40_000, inventoryDepth: 16,
    outputBytes: 262_144, outputNodes: 16_000, outputDepth: 32, dataArrayElements: 4096,
    vmMemoryBytes: 16 * 1024 * 1024, vmStackBytes: 512 * 1024, vmDeadlineMs: 250, parentDeadlineMs: 1500,
    readDependencies: 128, activationProposals: 64, helperCalls: 4096, randomCalls: 4096, scopes: 7, loreBindings: 4096,
    variablePathBytes: 4096, variablePathDepth: 48, helperArgumentBytes: 65_536, helperArgumentNodes: 4096,
    promiseJobs: 4096, nestedDepth: 16, templateEvaluations: 128,
    cumulativeSourceBytes: 262_144, cumulativeCompiledBytes: 262_144, cumulativeOutputBytes: 262_144,
    injectionJournalPhases: 32, injectionScheduleActions: 128, injectionHandles: 256, injectionEffects: 512,
    injectionInputBytes: 67_108_864, injectionReceiptBytes: 262_144, injectionReceiptNodes: 16_000,
    injectionReceiptDepth: 40, injectionPromptChars: 16384, injectionIds: 128 });
export const TEMPLATE_POLICY_V1 = freezeTemplateData({ schemaVersion: 1, id: 'owned-quickjs-ejs-plain-subset-v1',
    tags: ['code', 'raw-expression-equals', 'raw-expression-minus'], helpers: ['getvar', 'getwi', 'activateWI', 'injectPrompts', 'uninjectPrompts'],
    source: 'complete-source-text-sha-and-frozen-snapshot', synchronous: false,
    variables: 'own-literal-key-first-then-bounded-dot-bracket-path; explicit-frozen-scope; defaults-on-missing-only',
    cache: 'explicit-captured-binding; global-initial-local-message-shallow-precedence; no-live-read',
    lore: 'explicit-frozen-key-to-content; await-nested-ejs-in-same-realm; missing-is-empty-string; separate-activation-allowlist',
    output: 'host-owned-per-invocation-text-and-read-proposal-logs; consumer-data-only',
    asynchronous: 'shared-deadline-bounded-promise-pump; root-rejection-and-job-errors; detached-rejection-monitor-unavailable',
    clock: 'frozen-epoch-ms-utc', random: 'sha256-counter-domain-separated-v1',
    injections: 'one-realm-full-creation-and-ordered-journal-replay; private-actual-closures; strict-awaited-boolean; captured-schedule; id-removal; no-worker-lifecycle-effect',
    unsupported: 'full-EJS; partials; macros; includes; host-asynchronous-IO; schemaGuest; writes; Host objects',
    limits: TEMPLATE_LIMITS_V1 });
export const TEMPLATE_POLICY_SHA256 = recordSha256(TEMPLATE_POLICY_V1);
export class TemplateRefusalV1 extends Error {
    diagnostic;
    constructor(diagnostic) {
        super(diagnostic.code);
        this.diagnostic = diagnostic;
    }
}
export function templateFail(code, pointer = null, limit = null) {
    throw new TemplateRefusalV1({ schemaVersion: 1, code, sourcePointer: pointer, limit });
}
export const templateObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
export const templateHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const templateId = (value) => typeof value === 'string' && value.length > 0
    && Buffer.byteLength(value, 'utf8') <= 256;
export function templateExact(value, keys) {
    if (!templateObject(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))) {
        templateFail('TEMPLATE_RECORD_SHAPE');
    }
}
export function freezeTemplateData(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freezeTemplateData(child);
        Object.freeze(value);
    }
    return value;
}
/** Every envelope uses named units from the same policy. The existing safe
 * clone checks exact escaped JSON UTF-8 bytes before worker transport. */
export function cloneTemplateEnvelopeV1(input, fields) {
    try {
        return cloneSchemaData(input, TEMPLATE_LIMITS_V1[fields.bytes], { nodes: TEMPLATE_LIMITS_V1[fields.nodes], depth: TEMPLATE_LIMITS_V1[fields.depth] });
    }
    catch (error) {
        const code = error instanceof Error ? error.message : '';
        const field = code === 'SCHEMA_DATA_BYTE_LIMIT' ? fields.bytes : code === 'SCHEMA_DATA_NODE_LIMIT' ? fields.nodes
            : code === 'SCHEMA_DATA_DEPTH_LIMIT' ? fields.depth : code === 'SCHEMA_ARRAY_LIMIT' ? 'dataArrayElements' : undefined;
        if (field)
            templateFail(fields.bytes === 'outputBytes' ? 'TEMPLATE_OUTPUT_LIMIT' : 'TEMPLATE_INPUT_LIMIT', null, { field, observed: null, maximum: TEMPLATE_LIMITS_V1[field] });
        templateFail('TEMPLATE_INPUT_INVALID');
    }
}
const scopes = ['card', 'chat', 'message', 'script', 'global', 'initial', 'cache'];
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const pointer = (value) => typeof value === 'string' && value.startsWith('/')
    && Buffer.byteLength(value, 'utf8') <= 4096 && !/~(?![01])/.test(value);
export function validateTemplateSnapshotV1(input) {
    const value = cloneTemplateEnvelopeV1(input, { bytes: 'snapshotBytes', nodes: 'snapshotNodes', depth: 'snapshotDepth' });
    templateExact(value, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'branchId', 'revision', 'turnId', 'attemptId',
        'packageSha256', 'sourceSnapshotSha256', 'stateSnapshotSha256', 'defaultVariableScope', 'scopes', 'scopesSha256',
        'lore', 'loreSha256', 'clockEpochMs', 'randomSeed', 'randomSeedSha256', 'snapshotSha256']);
    if (value.schemaVersion !== 1 || value.encoding !== 'owned-template-frozen-snapshot-v1'
        || value.authority !== 'consumer-data-only' || !integer(value.revision))
        templateFail('TEMPLATE_SNAPSHOT_INVALID');
    for (const key of ['sessionId', 'branchId', 'turnId', 'attemptId'])
        if (!templateId(value[key]))
            templateFail('TEMPLATE_SNAPSHOT_INVALID');
    for (const key of ['packageSha256', 'sourceSnapshotSha256', 'stateSnapshotSha256', 'scopesSha256', 'loreSha256',
        'randomSeedSha256', 'snapshotSha256'])
        if (!templateHash(value[key]))
            templateFail('TEMPLATE_SNAPSHOT_HASH');
    if (!scopes.includes(value.defaultVariableScope) || !Array.isArray(value.scopes)
        || value.scopes.length > TEMPLATE_LIMITS_V1.scopes)
        templateFail('TEMPLATE_SCOPE_INVALID');
    const known = new Set();
    for (const row of value.scopes) {
        templateExact(row, ['scope', 'ownerId', 'versionSha256', 'values', 'valuesSha256']);
        if (!scopes.includes(row.scope) || known.has(String(row.scope)) || !templateId(row.ownerId)
            || !templateHash(row.versionSha256) || !templateObject(row.values) || !templateHash(row.valuesSha256)
            || recordSha256(row.values) !== row.valuesSha256)
            templateFail('TEMPLATE_SCOPE_INVALID');
        known.add(String(row.scope));
    }
    // An uncaptured default remains unavailable. Marker-free templates can run;
    // the actual getvar read refuses rather than borrowing another scope.
    if (!Array.isArray(value.lore) || value.lore.length > TEMPLATE_LIMITS_V1.loreBindings)
        templateFail('TEMPLATE_LORE_LIMIT');
    const keys = new Set(), entries = new Set();
    for (const row of value.lore) {
        const hasLookup = templateObject(row) && Object.hasOwn(row, 'lookup');
        const hasDiagnostic = templateObject(row) && Object.hasOwn(row, 'readDiagnostic');
        templateExact(row, ['key', 'bookId', 'entryId', 'sourcePointer', 'sourceSnapshotSha256', 'content', 'contentSha256', 'activationAllowed',
            ...hasLookup ? ['lookup'] : [], ...hasDiagnostic ? ['readDiagnostic'] : []]);
        if (!templateId(row.key) || row.key.startsWith('missing-query-') || keys.has(row.key) || !templateHash(row.bookId) || !templateHash(row.entryId)
            || entries.has(row.entryId) || !pointer(row.sourcePointer) || row.sourceSnapshotSha256 !== value.sourceSnapshotSha256
            || typeof row.content !== 'string' || !templateHash(row.contentSha256) || schemaTextSha256(row.content) !== row.contentSha256
            || typeof row.activationAllowed !== 'boolean')
            templateFail('TEMPLATE_LORE_INVALID');
        keys.add(row.key);
        entries.add(row.entryId);
        if (hasLookup) {
            templateExact(row.lookup, ['world', 'title', 'uid']);
            if (typeof row.lookup.world !== 'string' || Buffer.byteLength(row.lookup.world, 'utf8') > 512
                || typeof row.lookup.title !== 'string' || Buffer.byteLength(row.lookup.title, 'utf8') > 4096
                || row.lookup.uid !== null && !integer(row.lookup.uid))
                templateFail('TEMPLATE_LORE_LOOKUP_INVALID');
        }
        if (hasDiagnostic) {
            templateExact(row.readDiagnostic, ['code', 'projectionSha256']);
            if (typeof row.readDiagnostic.code !== 'string' || !/^[A-Z][A-Z0-9_]{0,95}$/.test(row.readDiagnostic.code)
                || !templateHash(row.readDiagnostic.projectionSha256))
                templateFail('TEMPLATE_LORE_DIAGNOSTIC_INVALID');
        }
    }
    if (typeof value.clockEpochMs !== 'number' || !Number.isSafeInteger(value.clockEpochMs) || Math.abs(value.clockEpochMs) > 8640000000000000
        || !templateId(value.randomSeed) || schemaTextSha256(value.randomSeed) !== value.randomSeedSha256) {
        templateFail('TEMPLATE_DETERMINISM_INVALID');
    }
    if (recordSha256(value.scopes) !== value.scopesSha256 || recordSha256(value.lore) !== value.loreSha256) {
        templateFail('TEMPLATE_SNAPSHOT_COMPONENT_HASH');
    }
    const { snapshotSha256, ...body } = value;
    if (recordSha256(body) !== snapshotSha256)
        templateFail('TEMPLATE_SNAPSHOT_HASH');
    return freezeTemplateData(value);
}
export function validateTemplateRequestV1(input) {
    const value = cloneTemplateEnvelopeV1(input, { bytes: 'requestBytes', nodes: 'requestNodes', depth: 'requestDepth' });
    templateExact(value, ['schemaVersion', 'encoding', 'source', 'snapshot', 'requestSha256']);
    if (value.schemaVersion !== 1 || value.encoding !== 'owned-template-request-v1' || !templateHash(value.requestSha256)) {
        templateFail('TEMPLATE_REQUEST_INVALID');
    }
    const hasEntry = templateObject(value.source) && Object.hasOwn(value.source, 'rootEntryId');
    templateExact(value.source, ['pointer', 'template', 'templateSha256', 'sourceSnapshotSha256', 'packageSha256',
        ...hasEntry ? ['rootEntryId'] : []]);
    const source = value.source;
    if (!pointer(source.pointer) || typeof source.template !== 'string')
        templateFail('TEMPLATE_SOURCE_INVALID');
    if (source.template.length > TEMPLATE_LIMITS_V1.sourceChars)
        templateFail('TEMPLATE_SOURCE_LIMIT', source.pointer, { field: 'sourceChars', observed: source.template.length, maximum: TEMPLATE_LIMITS_V1.sourceChars });
    if (!templateHash(source.templateSha256) || schemaTextSha256(source.template) !== source.templateSha256) {
        templateFail('TEMPLATE_SOURCE_HASH', source.pointer);
    }
    const snapshot = validateTemplateSnapshotV1(value.snapshot);
    if (hasEntry && (!templateHash(source.rootEntryId) || !snapshot.lore.some(row => row.entryId === source.rootEntryId
        && row.sourcePointer === source.pointer)))
        templateFail('TEMPLATE_ROOT_ENTRY_INVALID', source.pointer);
    if (source.sourceSnapshotSha256 !== snapshot.sourceSnapshotSha256 || source.packageSha256 !== snapshot.packageSha256) {
        templateFail('TEMPLATE_SOURCE_SNAPSHOT_MISMATCH', source.pointer);
    }
    const { requestSha256, ...body } = value;
    if (recordSha256(body) !== requestSha256)
        templateFail('TEMPLATE_REQUEST_HASH', source.pointer);
    return freezeTemplateData({ ...value, snapshot });
}
const lookups = new WeakMap();
function templateLookups(snapshot) {
    const old = lookups.get(snapshot);
    if (old)
        return old;
    const data = { lore: new Map(snapshot.lore.map(row => [row.key, row])),
        entries: new Map(snapshot.lore.map(row => [row.entryId, row])), scopes: new Map(snapshot.scopes.map(row => [row.scope, row])) };
    // Only a validated frozen catalog is memoized; arbitrary mutable data gets
    // a fresh index and can never stale a later certified missing-key result.
    if (Object.isFrozen(snapshot) && Object.isFrozen(snapshot.lore) && Object.isFrozen(snapshot.scopes))
        lookups.set(snapshot, data);
    return data;
}
export function templateLoreBindingV1(snapshot, key) {
    return templateLookups(snapshot).lore.get(key);
}
const forbiddenVariableKeys = new Set(['__proto__', 'prototype', 'constructor']);
export const templateVariableKeyV1 = (key) => key === null || typeof key === 'string'
    && Buffer.byteLength(key, 'utf8') <= TEMPLATE_LIMITS_V1.variablePathBytes;
function variablePath(key) {
    if (!templateVariableKeyV1(key))
        templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
    const parts = [];
    let index = 0, expectName = true;
    const add = (part) => {
        if (forbiddenVariableKeys.has(part) || parts.length >= TEMPLATE_LIMITS_V1.variablePathDepth)
            templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
        parts.push(part);
    };
    while (index < key.length) {
        if (key[index] === '.') {
            if (expectName)
                add('');
            index++;
            expectName = true;
            if (index === key.length)
                add('');
            continue;
        }
        if (key[index] === '[') {
            index++;
            const quote = key[index];
            let part = '';
            if (quote === '"' || quote === "'") {
                index++;
                let closed = false;
                while (index < key.length) {
                    const char = key[index++];
                    if (char === quote) {
                        closed = true;
                        break;
                    }
                    if (char === '\\') {
                        if (index >= key.length)
                            templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
                        part += key[index++];
                    }
                    else
                        part += char;
                }
                if (!closed)
                    templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
            }
            else {
                const start = index;
                while (index < key.length && key[index] !== ']')
                    index++;
                part = key.slice(start, index);
                if (part !== '' && !/^-?\d+(?:\.\d+)?$/.test(part))
                    templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
            }
            if (key[index++] !== ']')
                templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
            add(part);
            expectName = false;
            if (index < key.length && key[index] !== '.' && key[index] !== '[')
                templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
            continue;
        }
        const start = index;
        while (index < key.length && key[index] !== '.' && key[index] !== '[') {
            if (key[index] === ']')
                templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
            index++;
        }
        add(key.slice(start, index));
        expectName = false;
    }
    return parts;
}
/** A null key is the whole certified binding. No prototype/inherited lookup,
 * category stripping or implicit live scope/cache reconstruction occurs here. */
export function templateVariableValueV1(snapshot, key, scope) {
    const row = templateLookups(snapshot).scopes.get(scope ?? '');
    if (!row)
        templateFail('TEMPLATE_SCOPE_UNAVAILABLE');
    if (!templateVariableKeyV1(key))
        templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
    if (key === null)
        return { present: true, value: row.values };
    if (forbiddenVariableKeys.has(key))
        templateFail('TEMPLATE_VARIABLE_PATH_INVALID');
    if (Object.hasOwn(row.values, key))
        return { present: true, value: row.values[key] };
    const parts = variablePath(key);
    let value = row.values;
    if (!parts.length)
        return { present: false, value: null };
    for (const part of parts) {
        if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part))
            return { present: false, value: null };
        value = value[part];
    }
    return { present: true, value };
}
export function templateReadV1(snapshot, kind, key, scope, purpose) {
    if (kind === 'variable') {
        const row = templateLookups(snapshot).scopes.get(scope ?? '');
        if (!row)
            templateFail('TEMPLATE_SCOPE_UNAVAILABLE');
        const result = templateVariableValueV1(snapshot, key, scope);
        return { kind, purpose, scope: row.scope, ownerId: row.ownerId, key, present: result.present, versionSha256: row.versionSha256,
            valueSha256: result.present ? recordSha256(result.value) : null, entryId: null, sourcePointer: null };
    }
    if (key === null)
        templateFail('TEMPLATE_LORE_INVALID');
    const row = templateLoreBindingV1(snapshot, key);
    return { kind, purpose, scope: null, ownerId: null, key, present: !!row, versionSha256: snapshot.sourceSnapshotSha256,
        valueSha256: row?.contentSha256 ?? null, entryId: row?.entryId ?? null, sourcePointer: row?.sourcePointer ?? null };
}
export function templateActivationV1(snapshot, key) {
    const row = templateLoreBindingV1(snapshot, key);
    if (!row || !row.activationAllowed)
        return null;
    return { schemaVersion: 1, kind: 'activate-lore-entry', entryId: row.entryId, bookId: row.bookId, sourcePointer: row.sourcePointer,
        contentSha256: row.contentSha256, sourceSnapshotSha256: row.sourceSnapshotSha256, baseSnapshotSha256: snapshot.snapshotSha256,
        branchId: snapshot.branchId, turnId: snapshot.turnId, attemptId: snapshot.attemptId };
}
export function validateTemplateOutputV1(input, request, engine) {
    const value = cloneTemplateEnvelopeV1(input, { bytes: 'outputBytes', nodes: 'outputNodes', depth: 'outputDepth' });
    if (JSON.stringify(value).length > TEMPLATE_LIMITS_V1.outputChars)
        templateFail('TEMPLATE_OUTPUT_LIMIT', request.source.pointer, { field: 'outputChars', observed: JSON.stringify(value).length, maximum: TEMPLATE_LIMITS_V1.outputChars });
    const hasEffects = templateObject(value) && Object.hasOwn(value, 'injectionEffects');
    templateExact(value, ['schemaVersion', 'encoding', 'authority', 'requestSha256', 'sourceSha256', 'sourcePointer',
        'snapshotSha256', 'engine', 'renderedText', 'renderedTextSha256', 'readDependencies', 'activationProposals', 'nestedRenders', 'outputSha256',
        ...hasEffects ? ['injectionEffects'] : []]);
    if (hasEffects)
        validateTemplateInjectionEffectsV1(value.injectionEffects);
    if (value.schemaVersion !== 1 || value.encoding !== 'owned-template-output-v1' || value.authority !== 'consumer-data-only'
        || value.requestSha256 !== request.requestSha256 || value.sourceSha256 !== request.source.templateSha256
        || value.sourcePointer !== request.source.pointer || value.snapshotSha256 !== request.snapshot.snapshotSha256
        || recordSha256(value.engine) !== recordSha256(engine) || typeof value.renderedText !== 'string'
        || !templateHash(value.renderedTextSha256) || schemaTextSha256(value.renderedText) !== value.renderedTextSha256
        || !templateHash(value.outputSha256))
        templateFail('TEMPLATE_OUTPUT_INVALID', request.source.pointer);
    // Literal markers emitted by a completed author function are inert output.
    // The owner controls phase ordering and never recompiles the returned text.
    if (!Array.isArray(value.readDependencies) || value.readDependencies.length > TEMPLATE_LIMITS_V1.readDependencies
        || !Array.isArray(value.activationProposals) || value.activationProposals.length > TEMPLATE_LIMITS_V1.activationProposals)
        templateFail('TEMPLATE_OUTPUT_LOG_LIMIT');
    const reads = new Set(), activations = new Set();
    for (const row of value.readDependencies) {
        templateExact(row, ['kind', 'purpose', 'scope', 'ownerId', 'key', 'present', 'versionSha256', 'valueSha256', 'entryId', 'sourcePointer']);
        if (!['variable', 'lore'].includes(String(row.kind)) || !['read', 'activation-proposal'].includes(String(row.purpose))
            || (row.kind === 'variable' ? !templateVariableKeyV1(row.key) : !templateId(row.key))
            || row.kind === 'variable' && row.purpose !== 'read')
            templateFail('TEMPLATE_READ_INVALID');
        const expected = templateReadV1(request.snapshot, row.kind, row.key, row.scope, row.purpose);
        const key = recordSha256(expected);
        if (reads.has(key) || recordSha256(row) !== key)
            templateFail('TEMPLATE_READ_INVALID');
        reads.add(key);
    }
    for (const row of value.activationProposals) {
        const binding = templateObject(row) ? templateLookups(request.snapshot).entries.get(String(row.entryId)) : undefined;
        const expected = binding ? templateActivationV1(request.snapshot, binding.key) : null;
        if (!expected || activations.has(expected.entryId) || recordSha256(row) !== recordSha256(expected)
            || !reads.has(recordSha256(templateReadV1(request.snapshot, 'lore', binding.key, null, 'activation-proposal')))) {
            templateFail('TEMPLATE_ACTIVATION_INVALID');
        }
        activations.add(expected.entryId);
    }
    if (!Array.isArray(value.nestedRenders) || value.nestedRenders.length >= TEMPLATE_LIMITS_V1.templateEvaluations) {
        templateFail('TEMPLATE_NESTED_LOG_INVALID');
    }
    const ancestry = new Map();
    const parents = new Map([[0, null]]);
    const root = request.snapshot.lore.find(row => row.sourcePointer === request.source.pointer
        && (request.source.rootEntryId ? row.entryId === request.source.rootEntryId : row.contentSha256 === request.source.templateSha256));
    ancestry.set(0, { entryId: root?.entryId ?? null, depth: 0 });
    for (const row of value.nestedRenders) {
        templateExact(row, ['invocation', 'parentInvocation', 'entryId', 'sourcePointer', 'contentSha256',
            'compiledSourceSha256', 'renderedTextSha256', 'outputChars', 'outputBytes']);
        const parent = integer(row.parentInvocation) ? ancestry.get(row.parentInvocation) : undefined;
        const binding = templateLookups(request.snapshot).entries.get(String(row.entryId));
        if (!integer(row.invocation) || row.invocation !== ancestry.size || !parent || !binding
            || binding.sourcePointer !== row.sourcePointer || binding.contentSha256 !== row.contentSha256
            || !templateHash(row.compiledSourceSha256) || !templateHash(row.renderedTextSha256)
            || !integer(row.outputChars) || row.outputChars > TEMPLATE_LIMITS_V1.outputChars
            || !integer(row.outputBytes) || row.outputBytes > TEMPLATE_LIMITS_V1.cumulativeOutputBytes
            || parent.depth + 1 > TEMPLATE_LIMITS_V1.nestedDepth
            || !reads.has(recordSha256(templateReadV1(request.snapshot, 'lore', binding.key, null, 'read')))) {
            templateFail('TEMPLATE_NESTED_LOG_INVALID');
        }
        let ancestor = row.parentInvocation;
        while (ancestor !== null) {
            if (ancestry.get(ancestor).entryId === binding.entryId)
                templateFail('TEMPLATE_NESTED_CYCLE');
            ancestor = parents.get(ancestor) ?? null;
        }
        ancestry.set(row.invocation, { entryId: binding.entryId, depth: parent.depth + 1 });
        parents.set(row.invocation, row.parentInvocation);
    }
    const { outputSha256, ...body } = value;
    if (recordSha256(body) !== outputSha256)
        templateFail('TEMPLATE_OUTPUT_HASH');
    return freezeTemplateData(value);
}
export function validateTemplateInjectionEffectsV1(input) {
    if (!Array.isArray(input) || !input.length || input.length > TEMPLATE_LIMITS_V1.injectionEffects) {
        templateFail('TEMPLATE_INJECTION_EFFECT_INVALID');
    }
    let last = -1;
    for (const item of input) {
        if (!templateObject(item) || !integer(item.ordinal) || item.ordinal <= last
            || item.ordinal >= TEMPLATE_LIMITS_V1.injectionEffects)
            templateFail('TEMPLATE_INJECTION_EFFECT_INVALID');
        last = item.ordinal;
        if (item.kind === 'batch-created') {
            templateExact(item, ['ordinal', 'kind', 'batchOrdinal', 'once', 'ids']);
            if (!integer(item.batchOrdinal) || item.batchOrdinal >= TEMPLATE_LIMITS_V1.injectionHandles
                || typeof item.once !== 'boolean' || !Array.isArray(item.ids) || item.ids.length > TEMPLATE_LIMITS_V1.injectionIds
                || item.ids.some(id => !templateId(id)))
                templateFail('TEMPLATE_INJECTION_EFFECT_INVALID');
        }
        else if (item.kind === 'register') {
            templateExact(item, ['ordinal', 'kind', 'prompt']);
            templateExact(item.prompt, ['id', 'position', 'depth', 'role', 'content', 'should_scan', 'once', 'batchOrdinal', 'callbackOrdinal']);
            const row = item.prompt;
            if (!templateId(row.id) || !['in_chat', 'none'].includes(String(row.position)) || !integer(row.depth)
                || row.depth > 65536 || !['system', 'user', 'assistant'].includes(String(row.role))
                || typeof row.content !== 'string' || row.content.length > TEMPLATE_LIMITS_V1.injectionPromptChars
                || typeof row.should_scan !== 'boolean' || typeof row.once !== 'boolean'
                || !integer(row.batchOrdinal) || row.batchOrdinal >= TEMPLATE_LIMITS_V1.injectionHandles
                || row.callbackOrdinal !== null && (!integer(row.callbackOrdinal) || row.callbackOrdinal >= TEMPLATE_LIMITS_V1.injectionHandles)) {
                templateFail('TEMPLATE_INJECTION_PROMPT_INVALID');
            }
        }
        else if (item.kind === 'remove-ids') {
            templateExact(item, ['ordinal', 'kind', 'ids', 'batchOrdinal']);
            if (!Array.isArray(item.ids) || item.ids.length > TEMPLATE_LIMITS_V1.injectionIds
                || item.ids.some(id => !templateId(id))
                || item.batchOrdinal !== null && (!integer(item.batchOrdinal) || item.batchOrdinal >= TEMPLATE_LIMITS_V1.injectionHandles)) {
                templateFail('TEMPLATE_INJECTION_EFFECT_INVALID');
            }
        }
        else
            templateFail('TEMPLATE_INJECTION_EFFECT_INVALID');
    }
    return input;
}
