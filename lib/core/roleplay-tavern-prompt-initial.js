// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-initial.ts; edit the TypeScript source.
/** Complete Source-to-initial catalog producer. Selection/JSON/YAML/merge/cache
 * belong to the existing variables helper; protected rendering stays in Core. */
import { types } from 'node:util';
import { recordSha256 } from './roleplay-data.js';
import { schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { resolveTavernLoreContentTextV1 } from './tavern-lore-compiler.mjs';
import { promptFreeze, promptInitialEntryV1, TAVERN_PROMPT_VARIABLE_BOUNDS_V1 } from './roleplay-tavern-prompt-variables-data.js';
/** This is the actual owned Native feature policy, not a capture of a running
 * ST extension's mutable registry/settings. Basic card regex is a different
 * subsystem. Fixed handleInitialVariables passes only {worldinfo:true}; the
 * fixed applyRegex reads no registry without generate/message/uuid selectors. */
export const TAVERN_PROMPT_INITIAL_NATIVE_POLICY_V1 = promptFreeze({ schemaVersion: 1,
    encoding: 'owned-native-prompt-initial-feature-policy-v1',
    settings: { kind: 'native-fixed-settings', invert_enabled: false },
    featureRegex: { kind: 'native-owned-empty-registry', registry: 'ST-Prompt-Template.REGEX.generateRegex',
        entries: [], initialCall: { worldinfo: true }, selectorPolicy: 'initial-call-no-generate-selector-v1',
        registryReads: 0, basicCardRegexIsRegistry: false },
    catalogPolicy: 'complete-source-primary-original-ordinal-v1',
    titlePolicy: 'fixed-character-book-comment-or-empty-v1',
    decoratorPolicy: 'fixed-importer-no-preparsed-inline-current-content-v1',
    diagnosticPolicy: 'initial-fields-independent-of-lore-matching-eligibility-v2',
    initialWorkOwner: 'prepareRoleplayTavernPromptVariablesV1',
    runtimeModelRequests: { normal: 0, retry: 0, fallback: 0 } });
export const TAVERN_PROMPT_INITIAL_NATIVE_POLICY_SHA256_V1 = recordSha256(TAVERN_PROMPT_INITIAL_NATIVE_POLICY_V1);
export class TavernPromptInitialCatalogFailureV1 extends Error {
    code;
    pointer;
    constructor(code, pointer = '/') {
        super(code);
        this.code = code;
        this.pointer = pointer;
        this.name = 'TavernPromptInitialCatalogFailureV1';
    }
}
function fail(code, pointer = '/') { throw new TavernPromptInitialCatalogFailureV1(code, pointer); }
function ownValue(value, key, required = true) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
        if (required)
            fail('PROMPT_INITIAL_ARGUMENT_REQUIRED', '/' + key);
        return undefined;
    }
    if (!Object.hasOwn(descriptor, 'value'))
        fail('PROMPT_INITIAL_ARGUMENT_ACCESSOR', '/' + key);
    return descriptor.value;
}
function metadata(raw, pointer, field) {
    const present = Object.hasOwn(raw, field), value = present ? raw[field] : null;
    return { field, pointer: pointer + '/' + field, presence: present ? 'present' : 'absent', value,
        valueSha256: present ? recordSha256(value) : null };
}
function title(raw, pointer) {
    const value = raw.comment;
    // Match the fixed importer ||'' over plain data without object coercion.
    if (value === undefined || value === null || value === false || value === 0 || value === '')
        return '';
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 4096)
        fail('PROMPT_INITIAL_TITLE_UNSUPPORTED', pointer + '/comment');
    return value;
}
function initialEnabled(raw, entry) {
    const current = entry.fieldSources.some(field => field.field === 'enabled' && field.disposition === 'current-native-origin');
    const value = current ? entry.semanticOverrides.enabled : raw.enabled;
    // The fixed importer uses enabled ?? false. A present invalid control cannot
    // be mistaken for that defined nullish default, even on a disabled Lore row.
    if (!current && (value === undefined || value === null))
        return false;
    if (typeof value !== 'boolean')
        fail('PROMPT_INITIAL_ENABLED_UNAVAILABLE', entry.sourcePointer + '/enabled');
    return value;
}
function ref(ownerId, versionSha256, data) {
    return { ownerId, versionSha256, ref: data, refSha256: recordSha256(data) };
}
function verifySourcePlan(source, plan) {
    const original = source.original, primary = original.primary, actual = plan.source;
    const expected = { schemaVersion: 1, encoding: 'st-character-book-source-reference-v1', ownerSessionId: source.sessionId,
        sourceRecordSessionId: source.sourceRecordSessionId, importId: original.activePointer.importId,
        rawSourceSha256: original.rawSha256, importRecordSha256: original.importRecordRef.sha256,
        sourceSnapshotSha256: source.sourceSha256, documentSha256: original.documentSha256,
        bookPointer: primary.bookPointer, bookValueSha256: primary.bookSha256,
        sourceFormat: original.decodedFormat === 'json-nexttavern-v1' ? 'nexttavern-character-book'
            : original.decodedFormat.endsWith('v3') ? 'ccv3-character-book' : 'ccv2-character-book',
        ...(source.inheritance ? { inheritance: source.inheritance } : {}),
        ...(primary.binding === 'proven-absence' ? { bookPresence: 'proven-absence', absenceProof: primary.absenceProof } : {}) };
    if (recordSha256(actual) !== recordSha256(expected) || recordSha256(plan.rawBook) !== primary.bookSha256
        || recordSha256(plan.rawBook) !== recordSha256(primary.value) || plan.entries.length !== primary.entries.length) {
        fail('PROMPT_INITIAL_PLAN_SOURCE_MISMATCH');
    }
}
export function captureRoleplayTavernInitialCatalogV1(input) {
    if (!input || typeof input !== 'object' || types.isProxy(input) || Array.isArray(input))
        fail('PROMPT_INITIAL_ARGUMENT_INVALID');
    const assertion = ownValue(input, 'assertCurrent');
    if (typeof assertion !== 'function')
        fail('PROMPT_INITIAL_ASSERTION_REQUIRED');
    const signal = ownValue(input, 'signal', false);
    if (signal !== undefined && (types.isProxy(signal) || !(signal instanceof AbortSignal)))
        fail('PROMPT_INITIAL_SIGNAL_INVALID');
    const suppliedDeadline = ownValue(input, 'deadlineAt', false);
    if (suppliedDeadline !== undefined && (typeof suppliedDeadline !== 'number' || !Number.isFinite(suppliedDeadline))) {
        fail('PROMPT_INITIAL_DEADLINE_INVALID');
    }
    // Capture once. A later helper/callback checkpoint never allocates more time.
    const started = performance.now();
    const inheritedDeadline = typeof suppliedDeadline === 'number' ? suppliedDeadline : Infinity;
    const deadline = Math.min(inheritedDeadline, started + TAVERN_PROMPT_VARIABLE_BOUNDS_V1.deadlineMs);
    const assertCurrent = () => {
        if (signal?.aborted)
            fail('PROMPT_VARIABLE_CANCELLED');
        if (performance.now() >= deadline)
            fail('PROMPT_INITIAL_DEADLINE');
    };
    assertion.call(input);
    assertCurrent();
    const source = cloneRoleplayTavernLoreDataV1(ownValue(input, 'source'));
    const plan = cloneRoleplayTavernLoreDataV1(ownValue(input, 'plan'));
    if (source.original.primary.entries.length > TAVERN_PROMPT_VARIABLE_BOUNDS_V1.entries) {
        fail('PROMPT_INITIAL_CATALOG_ENTRY_LIMIT', source.original.primary.bookPointer + '/entries');
    }
    verifySourcePlan(source, plan);
    // Core has already compiled this Source and owns its currentness. Initial
    // variables consume only comment, current content/decorators and enabled;
    // Lore matching diagnostics do not determine their selection eligibility.
    const policySha256 = TAVERN_PROMPT_INITIAL_NATIVE_POLICY_SHA256_V1;
    const versionSha256 = recordSha256({ sourceSha256: source.sourceSha256, planSha256: plan.planSha256, policySha256 });
    const ownerId = source.sessionId + '/prompt-initial-source';
    const settingsRef = ref(ownerId, policySha256, { schemaVersion: 1, encoding: 'owned-native-prompt-initial-settings-ref-v1',
        policySha256, settings: TAVERN_PROMPT_INITIAL_NATIVE_POLICY_V1.settings,
        featureRegex: TAVERN_PROMPT_INITIAL_NATIVE_POLICY_V1.featureRegex });
    const completeCatalogRef = ref(ownerId, versionSha256, { schemaVersion: 2,
        encoding: 'owned-source-prompt-initial-complete-catalog-ref-v2', sourceSha256: source.sourceSha256,
        compilerPlanSha256: plan.planSha256, rawSourceSha256: source.original.rawSha256,
        originalBookSha256: source.original.primary.bookSha256, currentMaterialSha256: source.current.materialSha256,
        currentMembershipSha256: source.current.membershipSha256,
        currentNativeOverlaySha256: plan.currentNativeOverlaySha256 ?? null,
        actualPrimaryEntryCount: source.original.primary.entries.length, policySha256 });
    const receiptEntries = [];
    const entries = plan.entries.map((entry, ordinal) => {
        assertCurrent();
        const original = source.original.primary.entries[ordinal];
        if (entry.ordinal !== ordinal || entry.sourceKey !== original.entryKey || entry.sourcePointer !== original.ref.entryPointer
            || entry.rawEntrySha256 !== original.ref.entrySha256)
            fail('PROMPT_INITIAL_ENTRY_PLAN_LINK', entry.sourcePointer);
        const raw = original.value, semantic = { enabled: initialEnabled(raw, entry) };
        const resolved = resolveTavernLoreContentTextV1(plan, entry.sourcePointer + '/content');
        if (typeof raw.content !== 'string')
            fail('PROMPT_INITIAL_ORIGINAL_CONTENT_UNAVAILABLE', entry.sourcePointer + '/content');
        const currentSemanticSha256 = recordSha256(semantic);
        const provenance = ref(ownerId, versionSha256, { schemaVersion: 2, encoding: 'owned-source-prompt-initial-entry-ref-v2',
            sourceSha256: source.sourceSha256, compilerPlanSha256: plan.planSha256, entryId: entry.entryId,
            rawEntryPointer: entry.sourcePointer, rawEntrySha256: entry.rawEntrySha256,
            entryPlanSha256: entry.entryPlanSha256, currentSemanticSha256,
            currentContentSha256: resolved.contentSha256, currentNativeOriginSha256: resolved.currentNativeOrigin?.refSha256 ?? null });
        const row = { ordinal, entryId: entry.entryId,
            rawEntryPointer: entry.sourcePointer, rawEntrySha256: entry.rawEntrySha256, title: title(raw, entry.sourcePointer),
            currentSemantic: semantic, currentSemanticSha256, contentPointer: resolved.pointer, content: resolved.text,
            contentSha256: resolved.contentSha256, decorators: null, provenance };
        const selected = promptInitialEntryV1(row, false);
        receiptEntries.push({ ordinal, entryId: entry.entryId, rawEntryPointer: entry.sourcePointer,
            rawEntrySha256: entry.rawEntrySha256, upstreamUid: entry.upstreamUid, disposition: entry.disposition,
            entryPlanSha256: entry.entryPlanSha256, title: row.title, titlePolicy: 'fixed-character-book-comment-or-empty-v1',
            metadata: ['comment', 'name', 'id', 'decorators'].map(field => metadata(raw, entry.sourcePointer, field)),
            originalContentSha256: schemaTextSha256(raw.content), currentContentSha256: resolved.contentSha256,
            currentSemanticSha256, currentContentOrigin: resolved.origin,
            currentNativeOriginSha256: resolved.currentNativeOrigin?.refSha256 ?? null,
            decoratorPolicy: 'fixed-importer-no-preparsed-inline-current-content-v1', initialEnabled: selected.enabled,
            initialSelected: selected.selected, initialBodySha256: schemaTextSha256(selected.body) });
        return row;
    });
    const catalogBody = { schemaVersion: 2,
        encoding: 'owned-prompt-initial-variable-catalog-v2', sourceSha256: source.sourceSha256,
        bookSha256: source.original.primary.bookSha256, entries, invertEnabled: false, settingsRef, completeCatalogRef };
    const catalog = promptFreeze({ ...catalogBody, catalogSha256: recordSha256(catalogBody) });
    const receiptBody = { schemaVersion: 2,
        encoding: 'owned-source-prompt-initial-catalog-receipt-v2', authority: 'consumer-data-only', sessionId: source.sessionId,
        sourceSha256: source.sourceSha256, rawSourceSha256: source.original.rawSha256,
        originalBookSha256: source.original.primary.bookSha256, compilerPlanSha256: plan.planSha256,
        currentNativeOverlaySha256: plan.currentNativeOverlaySha256 ?? null, catalogSha256: catalog.catalogSha256, policySha256,
        completeOriginalEntryCount: entries.length,
        selectedInitialEntryIds: receiptEntries.filter(row => row.initialSelected).map(row => row.entryId),
        entries: receiptEntries, loreDiagnosticsSha256: plan.diagnosticsSha256 };
    const receipt = { ...receiptBody, receiptSha256: recordSha256(receiptBody) };
    const data = promptFreeze(cloneRoleplayTavernLoreDataV1({ catalog, receipt }, TAVERN_PROMPT_VARIABLE_BOUNDS_V1.outputBytes));
    assertCurrent();
    assertion.call(input);
    return Object.freeze({ ...data, policySha256, assertCurrent });
}
