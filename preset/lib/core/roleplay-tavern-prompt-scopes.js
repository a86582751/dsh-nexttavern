// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-scopes.ts; edit the TypeScript source.
/** Adapts actual completed Native variable facts to readonly prompt scopes.
 * Empty-before-publication is an explicit adapter policy, never a claim that
 * ST persisted variables_initialized or that a copied frame grants permission. */
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { types } from 'node:util';
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
import { validateMvuPromptProgramOpeningPublicationV1 } from './roleplay-mvu-prompt-numerical-facts.js';
import { prepareProgramMvuOpeningPlanV3, validateProgramMvuGenesisFactsV1 } from './roleplay-program-genesis-data.js';
import { programOpeningInputKeyV1, programOpeningSeedKeyV1, validateProgramOpeningInputV1, validateProgramOpeningSeedV1, programOpeningDomainKeyV1, validateProgramOpeningAbsentDomainV1 } from './roleplay-program-opening-records.js';
import { tavernLoreSourceCurrentIdentityV1 } from './roleplay-tavern-lore-source.js';
import { validateTavernSourceInheritanceDescriptorV1, validateInheritanceCutV1, tavernSourceProgramAbsenceOpeningKeyV1 } from './roleplay-tavern-source-inheritance-data.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { programInheritedAbsenceDomainSha256V1 } from './roleplay-program-inherited-absence.js';
export const TAVERN_NATIVE_SCOPE_ADAPTER_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-readonly-prompt-scope-adapter-policy-v1',
    schema: 'completed-actual-source-bound-MVU-scope-facts; independent-current-closure',
    plain: 'completed-native-opening-closed-absence; declared-empty-session-source-namespace',
    promptDomains: 'actual-template-only-or-frozen-inherited-opening; closed-nonnumerical-inventory; readonly-absence',
    message: 'published-state-is-initialized; source-owned-prepublication-empty-is-readonly-uninitialized-absence',
    pending: 'actual-owned-Native-decision-message-has-no-published-message-variables-at-this-cut',
    previous: 'nearest-visible-published-variables; readonly-copy; no-persisted-initialization',
    script: 'one-actual-scope-or-explicit-selected-script; ambiguous-default-unavailable',
    numerical: 'actual-state-fold-and-closed-inherited-prefix; immutable-import-tuple-join; exact-message-version',
    global: 'explicit-native-session-import-readonly-empty-namespace; no-ST-global-store-assumption',
    manualCache: 'explicit-current-manual-stat-data-overlay; historical-message-values-and-initialization-unchanged' });
/** Kept separate so old completed v1 receipts retain their exact policy hash. */
export const TAVERN_PROGRAM_SCOPE_ADAPTER_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-program-readonly-prompt-scope-adapter-policy-v1',
    settled: 'actual-program-genesis-and-current-fold; immutable-import-tuple; exact-Native-message-version',
    pending: 'actual-private-Source-basis-input-seed-Native-phase-current-closure; consumer-data-only',
    initial: 'raw-InitVar-data-calculation-readonly-preview; initialized-false; no-head-or-snapshot',
    absent: 'closed-fresh-basis-readonly-empty-namespace; initialized-false',
    message: 'actual-selected-story-prefix; readonly-uninitialized-before-publication',
    script: 'no-actual-executing-script-supplier', schemaExecution: 'none' });
/** Independent policy preserves all existing v1/pending/numeric policy hashes. */
export const TAVERN_PROGRAM_ABSENCE_SCOPE_ADAPTER_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-program-absence-readonly-prompt-scope-adapter-policy-v1',
    settled: 'actual-completed-schema7-absence-domain; independent-original-seed-input-refs; current-private-owner',
    source: 'complete-immutable-import-tuple-and-existing-Source-current-projection',
    native: 'original-copy-or-generated-receipt; exact-related-visible-message-version; absence-from-cut-is-not-deletion',
    variables: 'readonly-empty-global-chat-card; selected-message-uninitialized; no-numerical-state-or-schema',
    script: 'no-actual-executing-script-supplier', schemaExecution: 'none' });
/** Only the new inherited third domain selects this policy; previous bodies
 * keep their original adapter hashes. Archive provenance is not permission. */
export const TAVERN_PROGRAM_INHERITED_SCOPE_ADAPTER_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-program-inherited-readonly-prompt-scope-adapter-policy-v1',
    settled: 'actual-derived-fold-and-frozen-program-genesis; original-packets-separate-from-child-archive',
    source: 'complete-original-import-tuple; actual-closed-Source-and-numerical-cut-owner',
    message: 'exact-Native-original-copy-or-generated-terminal-version; inherited-revision1-final-values',
    absentFromCut: 'no-deletion-or-initialization-claim', schemaExecution: 'none' });
/** Readonly inherited absence keeps every earlier policy body unchanged. */
export const TAVERN_PROGRAM_INHERITED_ABSENCE_SCOPE_ADAPTER_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-program-inherited-absence-readonly-prompt-scope-adapter-policy-v1',
    settled: 'actual-child-Source-archive-and-Native-current-owner; original-schema7-packets-retain-original-session',
    source: 'complete-original-immutable-import-tuple; actual-child-Source-inheritance-and-current-identity',
    audit: 'current-child-namespace-inventory; dynamic-writer-membership-is-not-stable-Source-identity',
    native: 'original-copy-or-generated-output; exact-selected-message-version; cut-absence-is-not-deletion',
    variables: 'readonly-empty-global-chat-card; selected-message-uninitialized; no-genesis-or-numerical-state',
    script: 'no-actual-executing-script-supplier', schemaExecution: 'none' });
function fail(code) { throw Error(code); }
const freeze = (value) => {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
};
const ref = (ownerId, versionSha256, value) => {
    const data = cloneRoleplayTavernLoreDataV1(value, 65_536, { nodes: 4096, depth: 16 });
    return { ownerId, versionSha256, ref: data, refSha256: recordSha256(data) };
};
function factBinding(scope) {
    const fact = scope.fact;
    if (fact.kind === 'unavailable')
        return null;
    const values = fact.kind === 'values' ? fact.values : {};
    return { scope: scope.scope, ownerId: fact.provenance.ownerId, versionSha256: fact.provenance.versionSha256,
        values, valuesSha256: recordSha256(values) };
}
function exactScopeData(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
        || keys.some(key => !Object.hasOwn(value, key)))
        fail('INPUT_MATERIAL_OPENING_SCOPE_RECORD_INVALID');
}
const scopeHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
/** Pure data joins run between the enclosing full supplier gates. They have
 * no awaits, storage writes or callback authority of their own. */
function programAbsenceData(originalData, source) {
    const data = cloneRoleplayTavernLoreDataV1(originalData, 8_388_608);
    exactScopeData(data, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'numericalSourceSha256',
        'seed', 'input', 'absenceDomain', 'domainRef', 'factsSha256']);
    const { factsSha256, ...body } = data, seed = validateProgramOpeningSeedV1(data['seed']), packet = validateProgramOpeningInputV1(data['input'], seed), 
    // The descriptor copier above established safe original property access.
    // Keep Native's stronger raw receipt validation before JSON normalization.
    domain = validateProgramOpeningAbsentDomainV1(originalData.absenceDomain, { seed, input: packet }), proof = packet.source, original = proof.source, tuple = proof.program.importTuple;
    exactScopeData(data['domainRef'], ['key', 'sha256']);
    if (data['schemaVersion'] !== 1 || data['encoding'] !== 'native-program-opening-absence-scope-read-data-v1'
        || data['authority'] !== 'consumer-data-only' || !scopeHash(factsSha256) || factsSha256 !== recordSha256(body)
        || data['sessionId'] !== source.sessionId || seed.sessionId !== source.sessionId || packet.initialization !== 'absent'
        || data['numericalSourceSha256'] !== packet.numericalSourceSha256
        || data['domainRef']['key'] !== programOpeningDomainKeyV1(seed.sessionId, seed.operationId)
        || data['domainRef']['sha256'] !== recordSha256(domain)
        || original.sessionId !== source.sessionId || original.sourceRecordSessionId !== source.sourceRecordSessionId
        || original.importId !== source.original.activePointer.importId || original.rawSha256 !== source.original.rawSha256
        || original.normalizedSha256 !== source.original.normalizedSha256 || original.transactionId !== source.original.transactionId
        || original.coverageSha256 !== source.original.coverageSha256
        || recordSha256(original.pointer) !== recordSha256(source.original.activePointer)
        || tuple.ownerSessionId !== source.sessionId || tuple.sourceRecordSessionId !== source.sourceRecordSessionId
        || tuple.importId !== source.original.activePointer.importId || tuple.rawSha256 !== source.original.rawSha256
        || tuple.normalizedSha256 !== source.original.normalizedSha256 || tuple.transactionId !== source.original.transactionId
        || tuple.coverageSha256 !== source.original.coverageSha256 || tuple.normalizer !== source.normalizer
        || tuple.format !== source.original.decodedFormat
        || recordSha256(tuple.sourceInheritance) !== recordSha256(source.inheritance ?? null)
        || recordSha256(tuple.activePointer) !== recordSha256(source.original.activePointer)
        || recordSha256(tuple.activePointerRef) !== recordSha256(source.original.activePointerRef)
        || recordSha256(tuple.importRecordRef) !== recordSha256(source.original.importRecordRef)
        || tuple.documentSha256 !== source.original.documentSha256 || tuple.dataSha256 !== source.original.dataSha256
        || proof.program.sourceCurrentIdentitySha256 !== recordSha256(tavernLoreSourceCurrentIdentityV1(source))) {
        fail('INPUT_MATERIAL_PROGRAM_ABSENCE_SCOPE_SOURCE_MISMATCH');
    }
    return freeze(data);
}
/** Inspect own descriptors before passing original Native packets to their
 * validators. No raw getter runs, and receipt grammar precedes our JSON copy. */
function programInheritedAbsenceRawFields(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || types.isProxy(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_DATA_INVALID');
    }
    const descriptors = Object.getOwnPropertyDescriptors(value), fields = {};
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key], 'value')) {
            fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_DATA_INVALID');
        }
        Object.defineProperty(fields, key, { value: descriptors[key].value, enumerable: true });
    }
    return fields;
}
function validateProgramInheritedAbsenceInventory(data) {
    const inventory = data.inventory;
    exactScopeData(inventory, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'rows', 'inventorySha256']);
    const { inventorySha256, ...body } = inventory;
    if (inventory.schemaVersion !== 1 || inventory.encoding !== 'native-program-absence-inventory-v1'
        || inventory.authority !== 'consumer-data-only' || inventory.sessionId !== data.sessionId
        || !scopeHash(inventorySha256) || recordSha256(body) !== inventorySha256
        || !Array.isArray(inventory.rows) || inventory.rows.length > 16_384) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_INVENTORY_INVALID');
    }
    const seen = new Set();
    let previous;
    for (const row of inventory.rows) {
        exactScopeData(row, ['table', 'key', 'sha256', 'classification']);
        const address = row.table + ':' + row.key;
        if (typeof row.table !== 'string' || !['branch', 'status'].includes(row.table) || typeof row.key !== 'string'
            || !row.key.startsWith(data.sessionId + '__') || row.key.length > 512 || !scopeHash(row.sha256)
            || typeof row.classification !== 'string'
            || !['source', 'source-control', 'program-opening', 'input', 'phase-a', 'native-material', 'status-control', 'branch-control',
                'import-archive', 'ordinary-nonnumerical']
                .includes(row.classification) || seen.has(address) || previous !== undefined && previous >= address
            || row.table === 'status' && (row.classification === 'status-control'
                ? !(row.key === data.sessionId + '__panel' || /^turn-([1-9][0-9]*)-(0|[1-9][0-9]*)$/.test(row.key.slice(data.sessionId.length + 2)))
                : row.key !== data.sessionId + '__spec' || row.classification !== 'ordinary-nonnumerical')) {
            fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_INVENTORY_INVALID');
        }
        seen.add(address);
        previous = address;
    }
}
/** Private actual supplier proves membership/currency; these pure checks join
 * its original immutable packets to this child's closed Source and audit. */
function programInheritedAbsenceData(originalData, source) {
    const raw = programInheritedAbsenceRawFields(originalData), rawChild = programInheritedAbsenceRawFields(raw['actualChildCut']), rawInheritance = programInheritedAbsenceRawFields(raw['sourceInheritance']), rawCuts = [programInheritedAbsenceRawFields(rawChild['cut']), programInheritedAbsenceRawFields(rawInheritance['nativeCut'])];
    for (const value of [rawChild['inheritedEventCount'], ...rawCuts.flatMap(cut => [cut['seedLength'], cut['parentInheritedEventCount']])]) {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
            fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_NATIVE_CUT_MISMATCH');
        }
    }
    const seed = validateProgramOpeningSeedV1(raw['seed']), packet = validateProgramOpeningInputV1(raw['input'], seed), domain = validateProgramOpeningAbsentDomainV1(raw['absenceDomain'], { seed, input: packet }), detached = cloneRoleplayTavernLoreDataV1(originalData, 8_388_608);
    exactScopeData(detached, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'numericalSourceSha256', 'sourceInheritance',
        'currentSourceIdentitySha256', 'seed', 'input', 'absenceDomain', 'originalOpening', 'actualChildCut', 'inventory',
        'stableDomainSha256', 'factsSha256']);
    const data = detached, { factsSha256, ...body } = data, original = data.originalOpening, child = data.actualChildCut, inherited = validateTavernSourceInheritanceDescriptorV1(data.sourceInheritance), binding = inherited.originalBinding, proof = packet.source, tuple = proof.program.importTuple, openingSource = proof.source;
    exactScopeData(original, ['ownerSessionId', 'closureSha256', 'archiveRef', 'seedRef', 'inputRef', 'intentRef', 'domainRef']);
    exactScopeData(child, ['sessionId', 'parentSessionId', 'inheritedEventCount', 'cut']);
    validateInheritanceCutV1(child.cut);
    for (const reference of [original.archiveRef, original.seedRef, original.inputRef, original.intentRef, original.domainRef]) {
        exactScopeData(reference, ['key', 'sha256']);
        if (typeof reference.key !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(reference.key) || !scopeHash(reference.sha256)) {
            fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_REFERENCE_INVALID');
        }
    }
    if (data.schemaVersion !== 1 || data.encoding !== 'native-program-inherited-absence-scope-read-data-v1'
        || data.authority !== 'consumer-data-only' || !scopeHash(factsSha256) || factsSha256 !== recordSha256(body)
        || data.sessionId !== source.sessionId || original.ownerSessionId !== seed.sessionId || seed.sessionId === source.sessionId
        || packet.sessionId !== seed.sessionId || domain.sessionId !== seed.sessionId || packet.initialization !== 'absent'
        || recordSha256(data.seed) !== recordSha256(seed) || recordSha256(data.input) !== recordSha256(packet)
        || recordSha256(data.absenceDomain) !== recordSha256(domain)
        || !scopeHash(data.numericalSourceSha256) || !scopeHash(original.closureSha256)
        || original.archiveRef.key !== tavernSourceProgramAbsenceOpeningKeyV1(source.sessionId)
        || original.seedRef.key !== programOpeningSeedKeyV1(seed.sessionId, seed.operationId)
        || original.seedRef.sha256 !== recordSha256(seed) || recordSha256(original.seedRef) !== recordSha256(packet.seedRef)
        || original.inputRef.key !== programOpeningInputKeyV1(seed.sessionId, seed.operationId)
        || original.inputRef.sha256 !== recordSha256(packet) || recordSha256(original.inputRef) !== recordSha256(domain.inputRef)
        || original.intentRef.key !== openingIntentKey(seed.sessionId, seed.source.importId)
        || original.domainRef.key !== programOpeningDomainKeyV1(seed.sessionId, seed.operationId)
        || original.domainRef.sha256 !== recordSha256(domain) || recordSha256(original.seedRef) !== recordSha256(domain.seedRef)
        || !source.inheritance || recordSha256(inherited) !== recordSha256(source.inheritance)
        || inherited.childSessionId !== source.sessionId || child.sessionId !== source.sessionId
        || child.parentSessionId !== inherited.parentSessionId || child.cut.kind !== 'native-fork' || child.cut.seedLength < 1
        || !Number.isSafeInteger(child.inheritedEventCount) || Object.is(child.inheritedEventCount, -0)
        || child.inheritedEventCount !== child.cut.seedLength || recordSha256(child.cut) !== recordSha256(inherited.nativeCut)
        || !scopeHash(data.currentSourceIdentitySha256)
        || data.currentSourceIdentitySha256 !== recordSha256(tavernLoreSourceCurrentIdentityV1(source))
        || !scopeHash(data.stableDomainSha256) || data.stableDomainSha256 !== programInheritedAbsenceDomainSha256V1(data)) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_SOURCE_MISMATCH');
    }
    // The original owner may itself be a fresh copied child. Its historical
    // pointer stays original; the actual child's current pointer stays child.
    if (tuple.ownerSessionId !== seed.sessionId || openingSource.sessionId !== seed.sessionId
        || openingSource.sourceRecordSessionId !== source.sourceRecordSessionId
        || tuple.sourceRecordSessionId !== source.sourceRecordSessionId || binding.sourceRecordSessionId !== source.sourceRecordSessionId
        || tuple.importId !== binding.importId || tuple.rawSha256 !== binding.rawSha256
        || tuple.normalizedSha256 !== binding.normalizedSha256 || tuple.coverageSha256 !== binding.coverageSha256
        || tuple.transactionId !== binding.transactionId || tuple.normalizer !== binding.normalizer
        || tuple.documentSha256 !== binding.documentSha256 || tuple.dataSha256 !== binding.dataSha256
        || tuple.activationSha256 !== binding.activationSha256 || recordSha256(tuple.originalActivation) !== tuple.activationSha256
        || tuple.activatedAt !== null && (!Number.isSafeInteger(tuple.activatedAt) || tuple.activatedAt < 0 || Object.is(tuple.activatedAt, -0))
        || tuple.format !== source.original.decodedFormat || tuple.normalizer !== source.normalizer
        || tuple.importId !== source.original.activePointer.importId || tuple.rawSha256 !== source.original.rawSha256
        || tuple.normalizedSha256 !== source.original.normalizedSha256 || tuple.coverageSha256 !== source.original.coverageSha256
        || tuple.transactionId !== source.original.transactionId || tuple.documentSha256 !== source.original.documentSha256
        || tuple.dataSha256 !== source.original.dataSha256
        || recordSha256(tuple.importRecordRef) !== recordSha256(source.original.importRecordRef)
        || tuple.importRecordRef.key !== binding.importRecordRef.key || tuple.importRecordRef.sha256 !== binding.importRecordRef.sha256
        || recordSha256(tuple.activePointer) !== recordSha256(openingSource.pointer)
        || tuple.activePointer.importId !== binding.importId
        || (tuple.activePointer.sourceRecordSessionId ?? seed.sessionId) !== binding.sourceRecordSessionId
        || tuple.activePointer.normalizedSha256 !== binding.normalizedSha256
        || tuple.activePointer.coverageSha256 !== binding.coverageSha256 || tuple.activePointer.transactionId !== binding.transactionId
        || (tuple.activePointer.activatedAt ?? null) !== (binding.originalPointer.activatedAt ?? null)
        || tuple.activePointerRef.table !== 'branch' || tuple.activePointerRef.exists !== true
        || tuple.activePointerRef.key !== `${seed.sessionId}__import-active`
        || tuple.activePointerRef.sha256 !== recordSha256(tuple.activePointer)
        || openingSource.importId !== binding.importId || openingSource.rawSha256 !== binding.rawSha256
        || openingSource.normalizedSha256 !== binding.normalizedSha256 || openingSource.coverageSha256 !== binding.coverageSha256
        || openingSource.transactionId !== binding.transactionId) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_IMPORT_MISMATCH');
    }
    const native = domain.nativeFacts;
    if (native.production === 'selected-card-copy' ? native.receipt.turnEndSeq >= child.cut.seedLength
        : native.receipt.turnEndRef.seq >= child.cut.seedLength
            || native.receipt.outputs.some(output => output.eventRef.seq >= child.cut.seedLength)) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_NATIVE_CUT_MISMATCH');
    }
    validateProgramInheritedAbsenceInventory(data);
    return freeze(data);
}
/** A real selected cut may omit older opening outputs. Match every visible
 * id/seq/operation overlap strictly; absence from this cut proves no deletion.
 * Root's current closure separately reads the original Native span/edits. */
function programAbsenceMessageJoins(data, selected) {
    const native = data.absenceDomain.nativeFacts, seen = new Set(), joined = new Map();
    for (const row of selected.messages) {
        const opMatch = row.message.source.kind === 'programmatic' && 'operationId' in row.message.source
            && row.message.source.operationId === data.seed.operationId;
        if (native.production === 'selected-card-copy') {
            const receipt = native.receipt;
            if (row.id !== receipt.messageId && row.eventSeq !== receipt.assistantSeq && !opMatch)
                continue;
            const expectedSource = { kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
                origin: `card-opening:${data.seed.source.importId}`, operationId: data.seed.operationId };
            if (seen.has(receipt.messageId) || row.id !== receipt.messageId || String(row.message.id) !== row.id
                || row.role !== 'assistant' || row.message.role !== 'assistant' || row.origin !== 'surface' || row.eventSeq !== receipt.assistantSeq
                || nativeInputSha256(row.message) !== row.messageSha256 || recordSha256(row.message.source) !== recordSha256(expectedSource)
                || recordSha256(row.message.content) !== recordSha256([{ type: 'text', text: data.input.source.selected.renderedText }])
                || sha256(data.input.source.selected.renderedText) !== receipt.renderedSha256) {
                fail('INPUT_MATERIAL_PROGRAM_ABSENCE_COPY_MESSAGE_MISMATCH');
            }
            seen.add(receipt.messageId);
            joined.set(row, { production: native.production, messageId: receipt.messageId,
                eventRef: { seq: receipt.assistantSeq, sha256: receipt.messageVersion.eventSha256 },
                renderedTextSha256: receipt.renderedSha256, nativeFactsSha256: native.factsSha256 });
        }
        else {
            const matches = native.receipt.outputs.filter(output => output.messageId === row.id || output.eventRef.seq === row.eventSeq);
            if (!matches.length && !opMatch)
                continue;
            if (matches.length !== 1)
                fail('INPUT_MATERIAL_PROGRAM_ABSENCE_GENERATED_MESSAGE_AMBIGUOUS');
            const output = matches[0], text = row.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
            if (seen.has(output.messageId) || row.id !== output.messageId || String(row.message.id) !== row.id
                || row.role !== 'assistant' || row.message.role !== 'assistant' || row.origin !== 'surface' || row.eventSeq !== output.eventRef.seq
                || row.message.source.kind !== 'model' || row.messageSha256 !== output.messageSha256
                || nativeInputSha256(row.message) !== output.messageSha256 || sha256(text) !== output.textSha256) {
                fail('INPUT_MATERIAL_PROGRAM_ABSENCE_GENERATED_MESSAGE_MISMATCH');
            }
            seen.add(output.messageId);
            joined.set(row, { production: native.production, messageId: output.messageId, eventRef: output.eventRef,
                messageSha256: output.messageSha256, textEncoding: output.textEncoding, textSha256: output.textSha256,
                terminal: output.messageId === native.receipt.terminalOutput.messageId, nativeFactsSha256: native.factsSha256 });
        }
    }
    return joined;
}
function validateProgramInheritedScopeFacts(data, local, source) {
    const { factsSha256, ...body } = data, { factsSha256: localSha, ...localBody } = local, root = local.currentSnapshot.root, original = data.originalImport, tuple = source.original;
    if (data.schemaVersion !== 2 || data.encoding !== 'native-program-json-prompt-inherited-facts-v2'
        || data.authority !== 'consumer-data-only' || recordSha256(body) !== factsSha256 || !data.programOpeningPublications.length
        || local.schemaVersion !== 1 || local.encoding !== 'native-json-prompt-numerical-facts-v1'
        || local.authority !== 'consumer-data-only' || recordSha256(localBody) !== localSha
        || local.sourceIdentity.kind !== 'derived-basis' || !('derivedEvent' in local.genesis)
        || data.childSessionId !== source.sessionId || data.numericalSourceSha256 !== local.numericalSourceSha256
        || data.source.childSessionId !== source.sessionId || data.source.childSourceSha256 !== local.numericalSourceSha256
        || data.genesis.sessionId !== source.sessionId || data.genesis.sourceSha256 !== local.numericalSourceSha256
        || recordSha256(data.genesis) !== recordSha256(local.genesis)
        || data.genesis.derivedEvent.basisSha256 !== local.sourceIdentity.basisSha256
        || data.genesis.derivedEvent.eventSha256 !== local.sourceIdentity.derivedEventSha256
        || local.currentSnapshot.sessionId !== source.sessionId || local.currentSnapshot.sourceSha256 !== local.numericalSourceSha256
        || !('encoding' in root) || root.encoding !== 'native-mvu-derived-state-root-v1'
        || root.derivedEventId !== data.genesis.derivedEvent.eventId
        || root.derivedEventSha256 !== data.genesis.derivedEvent.eventSha256
        || root.derivedHeadSha256 !== recordSha256(data.genesis.derivedHead) || root.basisSha256 !== data.genesis.derivedEvent.basisSha256
        || original.ownerSessionId !== source.sourceRecordSessionId || original.importId !== tuple.activePointer.importId
        || original.rawSha256 !== tuple.rawSha256 || original.normalizedSha256 !== tuple.normalizedSha256
        || original.transactionId !== tuple.transactionId || original.coverageSha256 !== tuple.coverageSha256
        || original.recordSha256 !== tuple.importRecordRef.sha256
        || recordSha256(data.inventory.rows) !== data.inventory.membershipSha256) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_NUMERICAL_SOURCE_MISMATCH');
    }
    const known = new Set();
    for (const raw of data.programOpeningPublications) {
        const publication = validateMvuPromptProgramOpeningPublicationV1(raw), archive = publication.archiveProvenance, imported = publication.source.program.importTuple, key = `${publication.ownerSessionId}:${publication.canonical.seq}:${publication.canonical.versionSha256}`, layer = data.layers.find(row => row.prepared.table === archive.table && row.prepared.key === archive.key
            && row.prepared.recordSha256 === archive.recordSha256);
        if (known.has(key) || !layer || layer.parentSessionId !== publication.ownerSessionId
            || publication.canonical.seq >= layer.inheritedPrefixLength
            || imported.sourceRecordSessionId !== original.ownerSessionId || imported.importId !== original.importId
            || imported.rawSha256 !== original.rawSha256 || imported.normalizedSha256 !== original.normalizedSha256
            || imported.transactionId !== original.transactionId || imported.coverageSha256 !== original.coverageSha256
            || imported.importRecordRef.sha256 !== original.recordSha256
            || recordSha256(imported.originalActivation) !== original.activationSha256
            || !data.snapshots.some(snapshot => recordSha256(snapshot) === recordSha256(publication.snapshot))
            || data.openingPublications.some(row => row.ownerSessionId === publication.ownerSessionId
                && row.canonical.seq === publication.canonical.seq && row.canonical.versionSha256 === publication.canonical.versionSha256)
            || data.storyPublications.some(row => row.ownerSessionId === publication.ownerSessionId
                && row.canonical.seq === publication.canonical.seq && row.canonical.versionSha256 === publication.canonical.versionSha256)) {
            fail('INPUT_MATERIAL_PROGRAM_INHERITED_NUMERICAL_PUBLICATION_MISMATCH');
        }
        known.add(key);
        for (const reference of [archive, ...Object.values(publication.originalPacketRefs)]) {
            if (!data.inventory.rows.some(row => recordSha256(row) === recordSha256(reference))) {
                fail('INPUT_MATERIAL_PROGRAM_INHERITED_NUMERICAL_REFERENCE_MISSING');
            }
        }
    }
    for (const snapshot of [...local.snapshots, ...data.snapshots, local.currentSnapshot]) {
        const { stateSnapshotSha256, ...snapshotBody } = snapshot;
        if (recordSha256(snapshotBody) !== stateSnapshotSha256 || recordSha256(snapshot.values) !== snapshot.valuesSha256
            || recordSha256(snapshot.currentHead) !== snapshot.headSha256) {
            fail('INPUT_MATERIAL_PROGRAM_INHERITED_NUMERICAL_SNAPSHOT_MISMATCH');
        }
    }
}
/** All related visible outputs are checked, even those outside the story
 * filter. Only the actual terminal/copy publication gains message variables. */
function programInheritedMessageJoins(programs, selected) {
    const joined = new Map(), seen = new Set();
    for (const publication of programs)
        for (const row of selected.messages) {
            const native = publication.native, seed = publication.originalPackets.seed, packet = publication.originalPackets.input, opMatch = row.message.source.kind === 'programmatic' && 'operationId' in row.message.source
                && row.message.source.operationId === seed.operationId;
            if (native.production === 'selected-card-copy') {
                const receipt = native.receipt;
                if (row.id !== receipt.messageId && row.eventSeq !== receipt.assistantSeq && !opMatch)
                    continue;
                const expectedSource = { kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
                    origin: `card-opening:${seed.source.importId}`, operationId: seed.operationId }, identity = `${row.id}:${row.eventSeq}`;
                if (seen.has(identity) || row.id !== receipt.messageId || String(row.message.id) !== row.id
                    || row.role !== 'assistant' || row.message.role !== 'assistant' || row.origin !== 'surface' || row.eventSeq !== receipt.assistantSeq
                    || nativeInputSha256(row.message) !== row.messageSha256 || recordSha256(row.message.source) !== recordSha256(expectedSource)
                    || recordSha256(row.message.content) !== recordSha256([{ type: 'text', text: packet.source.selected.renderedText }])
                    || recordSha256(row.message) !== publication.canonical.versionSha256
                    || sha256(packet.source.selected.renderedText) !== publication.canonical.narrativeSha256) {
                    fail('INPUT_MATERIAL_PROGRAM_INHERITED_COPY_MESSAGE_MISMATCH');
                }
                seen.add(identity);
                joined.set(row, publication);
            }
            else {
                const matches = native.receipt.outputs.filter(output => output.messageId === row.id || output.eventRef.seq === row.eventSeq);
                if (!matches.length && !opMatch)
                    continue;
                if (matches.length !== 1)
                    fail('INPUT_MATERIAL_PROGRAM_INHERITED_GENERATED_MESSAGE_AMBIGUOUS');
                const output = matches[0], identity = `${row.id}:${row.eventSeq}`, text = row.message.content.filter(block => block.type === 'text').map(block => block.text).join('');
                if (seen.has(identity) || row.id !== output.messageId || String(row.message.id) !== row.id
                    || row.role !== 'assistant' || row.message.role !== 'assistant' || row.origin !== 'surface' || row.eventSeq !== output.eventRef.seq
                    || row.message.source.kind !== 'model' || row.messageSha256 !== output.messageSha256
                    || nativeInputSha256(row.message) !== output.messageSha256 || sha256(text) !== output.textSha256) {
                    fail('INPUT_MATERIAL_PROGRAM_INHERITED_GENERATED_MESSAGE_MISMATCH');
                }
                seen.add(identity);
                if (output.messageId === native.receipt.terminalOutput.messageId) {
                    if (recordSha256(row.message) !== publication.canonical.versionSha256) {
                        fail('INPUT_MATERIAL_PROGRAM_INHERITED_GENERATED_CANONICAL_MISMATCH');
                    }
                    joined.set(row, publication);
                }
            }
        }
    return joined;
}
/** Data validation supplements the private owner's current closure; it does
 * not prove that a claimed row exists or mint an opening dispatch permission. */
function pendingOpeningData(input, source, selected) {
    if (!input.current())
        fail('INPUT_MATERIAL_OPENING_SCOPES_CHANGED');
    const data = cloneRoleplayTavernLoreDataV1(input.data, 8_388_608), { scopeDataSha256, ...body } = data, seed = validateProgramOpeningSeedV1(data.seed), packet = validateProgramOpeningInputV1(data.input, seed), proof = packet.source, basis = packet.basis, owned = data.nativeOwner, identity = owned.identity, imported = proof.program.importTuple, original = proof.source;
    exactScopeData(data, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'numericalSourceSha256',
        'sourceProofSha256', 'basisSha256', 'seed', 'input', 'seedRef', 'inputRef', 'nativeOwner',
        'selectedBaseSha256', 'inputBindingSha256', 'initialization', 'scopeDataSha256']);
    exactScopeData(data.seedRef, ['key', 'sha256']);
    exactScopeData(data.inputRef, ['key', 'sha256']);
    exactScopeData(owned, ['kind', 'identity', 'invocationRef']);
    exactScopeData(identity, ['kind', 'sessionId', 'operationId', 'messageId', 'instruction', 'instructionSha256', 'intentRef']);
    exactScopeData(identity.intentRef, ['key', 'sha256']);
    exactScopeData(owned.invocationRef, ['seq', 'sha256']);
    if (data.schemaVersion !== 1 || data.encoding !== 'native-program-opening-prompt-scope-read-data-v1'
        || data.authority !== 'consumer-data-only' || recordSha256(body) !== scopeDataSha256
        || data.sessionId !== source.sessionId || packet.sessionId !== source.sessionId
        || data.sourceProofSha256 !== proof.proofSha256 || data.basisSha256 !== basis.basisSha256
        || data.numericalSourceSha256 !== packet.numericalSourceSha256 || data.inputBindingSha256 !== packet.inputSha256
        || data.seedRef.key !== programOpeningSeedKeyV1(seed.sessionId, seed.operationId)
        || data.seedRef.sha256 !== recordSha256(seed) || recordSha256(packet.seedRef) !== recordSha256(data.seedRef)
        || data.inputRef.key !== programOpeningInputKeyV1(seed.sessionId, seed.operationId)
        || data.inputRef.sha256 !== recordSha256(packet) || data.selectedBaseSha256 !== selected.sha256
        || owned.kind !== 'programmatic-opening' || identity.kind !== 'programmatic-opening'
        || seed.production !== 'generated-opening' || identity.sessionId !== seed.sessionId
        || identity.operationId !== seed.operationId || identity.messageId !== seed.requestedMessageId
        || identity.instruction !== packet.instruction || identity.instructionSha256 !== seed.instructionSha256
        || recordSha256(identity.intentRef) !== recordSha256(data.seedRef)
        || !Number.isSafeInteger(owned.invocationRef.seq) || owned.invocationRef.seq !== basis.native.eventCount
        || !scopeHash(owned.invocationRef.sha256)
        || original.sessionId !== source.sessionId || original.sourceRecordSessionId !== source.sourceRecordSessionId
        || original.importId !== source.original.activePointer.importId || original.rawSha256 !== source.original.rawSha256
        || original.normalizedSha256 !== source.original.normalizedSha256
        || original.coverageSha256 !== source.original.coverageSha256 || original.transactionId !== source.original.transactionId
        || recordSha256(original.pointer) !== recordSha256(source.original.activePointer)
        || imported.ownerSessionId !== source.sessionId || imported.sourceRecordSessionId !== source.sourceRecordSessionId
        || imported.importRecordRef.sha256 !== source.original.importRecordRef.sha256
        || imported.documentSha256 !== source.original.documentSha256 || imported.dataSha256 !== source.original.dataSha256
        || proof.program.sourceCurrentIdentitySha256 !== recordSha256(tavernLoreSourceCurrentIdentityV1(source))) {
        fail('INPUT_MATERIAL_OPENING_SCOPE_SOURCE_MISMATCH');
    }
    // Absent inputs have no numerical plan. Check the complete inert basis
    // grammar for both branches rather than making an empty numeric snapshot.
    exactScopeData(basis, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'ownerSessionId', 'origin', 'operationId',
        'requestedMessageId', 'sourceBindingSha256', 'sourceRelation', 'branch', 'native', 'numerical', 'basisSha256']);
    exactScopeData(basis.branch, ['metaKey', 'metaCurrentIdentitySha256', 'parentSessionId', 'inheritedEventCount', 'ready']);
    exactScopeData(basis.native, ['observedThroughSeq', 'eventCount', 'historySha256']);
    exactScopeData(basis.numerical, ['statusRows', 'branchRows', 'membershipSha256', 'ownedInitializationCount', 'opaqueStateCount']);
    if (basis.schemaVersion !== 1 || basis.encoding !== 'native-program-opening-fresh-basis-proof-v1'
        || basis.authority !== 'consumer-data-only' || basis.ownerSessionId !== source.sessionId
        || basis.branch.metaKey !== `${source.sessionId}__meta` || !scopeHash(basis.branch.metaCurrentIdentitySha256)
        || basis.branch.parentSessionId !== null || basis.branch.inheritedEventCount !== 0 || basis.branch.ready !== true
        || !Number.isSafeInteger(basis.native.eventCount) || basis.native.eventCount < 0
        || basis.native.observedThroughSeq !== basis.native.eventCount - 1 || !scopeHash(basis.native.historySha256)
        || basis.numerical.ownedInitializationCount !== 0 || basis.numerical.opaqueStateCount !== 0
        || !Array.isArray(basis.numerical.statusRows) || !Array.isArray(basis.numerical.branchRows)
        || recordSha256({ statusRows: basis.numerical.statusRows, branchRows: basis.numerical.branchRows })
            !== basis.numerical.membershipSha256)
        fail('INPUT_MATERIAL_OPENING_SCOPE_BASIS_INVALID');
    const seen = new Set();
    for (const [table, rows] of [['status', basis.numerical.statusRows], ['branch', basis.numerical.branchRows]]) {
        for (const row of rows) {
            exactScopeData(row, ['table', 'key', 'exists', 'sha256', 'value']);
            const key = table + ':' + row.key;
            if (row.table !== table || typeof row.key !== 'string' || !row.key.startsWith(source.sessionId + '__')
                || row.key.length > 512 || typeof row.exists !== 'boolean' || seen.has(key)
                || (row.exists ? (!row.value || typeof row.value !== 'object' || Array.isArray(row.value)
                    || !scopeHash(row.sha256) || recordSha256(row.value) !== row.sha256) : row.value !== null || row.sha256 !== 'missing')) {
                fail('INPUT_MATERIAL_OPENING_SCOPE_BASIS_INVALID');
            }
            seen.add(key);
        }
    }
    if (basis.sourceRelation.kind === 'own-root') {
        exactScopeData(basis.sourceRelation, ['kind', 'inheritance']);
        if (basis.origin !== 'own-root' || basis.sourceRelation.inheritance !== null
            || proof.sourceRelation.kind !== 'own-root-source')
            fail('INPUT_MATERIAL_OPENING_SCOPE_BASIS_INVALID');
    }
    else {
        exactScopeData(basis.sourceRelation, ['kind', 'inheritance', 'setup', 'setupSha256']);
        if (basis.origin !== 'fresh-scene' || basis.sourceRelation.kind !== 'reserved-fresh-child'
            || proof.sourceRelation.kind !== 'committed-fresh-cut0-source'
            || recordSha256(basis.sourceRelation.inheritance) !== recordSha256(proof.sourceRelation.inheritance)
            || recordSha256(basis.sourceRelation.setup) !== recordSha256(proof.sourceRelation.setup)
            || !scopeHash(basis.sourceRelation.setupSha256)
            || recordSha256(basis.sourceRelation.setup) !== basis.sourceRelation.setupSha256) {
            fail('INPUT_MATERIAL_OPENING_SCOPE_BASIS_INVALID');
        }
    }
    const preview = data.initialization;
    if (packet.initialization === 'absent') {
        exactScopeData(preview, ['kind', 'markerCount', 'inventorySha256', 'initialized']);
        if (preview.kind !== 'absent' || preview.markerCount !== 0 || preview.initialized !== false
            || preview.inventorySha256 !== basis.numerical.membershipSha256)
            fail('INPUT_MATERIAL_OPENING_SCOPE_INIT_INVALID');
    }
    else {
        exactScopeData(preview, ['kind', 'planSha256', 'initialValues', 'initialValuesSha256', 'initialized']);
        const plan = prepareProgramMvuOpeningPlanV3({ identity: { sessionId: seed.sessionId, operationId: seed.operationId,
                requestedMessageId: seed.requestedMessageId, production: seed.production, instructionSha256: seed.instructionSha256,
                intentRef: data.seedRef, inputRef: data.inputRef }, sourceSha256: packet.numericalSourceSha256, source: proof, basis });
        if (preview.kind !== 'pending-raw-init-data' || preview.initialized !== false || preview.planSha256 !== plan.planSha256
            || preview.initialValuesSha256 !== plan.initialValuesSha256
            || recordSha256(preview.initialValues) !== plan.initialValuesSha256)
            fail('INPUT_MATERIAL_OPENING_SCOPE_INIT_INVALID');
    }
    if (selected.messages.some(row => row.role === 'user' && row.origin === 'pending-decision'
        && row.message.source?.kind === 'user'))
        fail('INPUT_MATERIAL_OPENING_SCOPE_PLAYER_INPUT_PRESENT');
    if (!input.current())
        fail('INPUT_MATERIAL_OPENING_SCOPES_CHANGED');
    return freeze(data);
}
export function captureRoleplayTavernPromptScopesV1(input) {
    const { source, selected } = input, storyRows = selected.messages.filter(input.isStoryMessage), owner = `${source.sessionId}:prompt-scope`;
    input.assertOwnerCurrent();
    if ([input.schema, input.numerical, input.plain, input.opening].filter(value => value !== undefined).length > 1) {
        fail('INPUT_MATERIAL_SCOPE_AUTHORITY_CONFLICT');
    }
    const scopes = [], evidence = [], missing = (scope, detail) => scopes.push({ scope, fact: { kind: 'unavailable', missingEvidence: [detail] } });
    let frame, plain, programAbsence, programInheritedAbsence, numerical, opening, stateSnapshotSha256 = recordSha256({ schemaVersion: 1, encoding: 'prompt-numerical-scope-unavailable-v1', source: source.sourceSha256 });
    if (input.opening) {
        opening = pendingOpeningData(input.opening, source, selected);
        stateSnapshotSha256 = opening.scopeDataSha256;
        evidence.push(opening);
    }
    else if (input.schema) {
        if (!input.schema.current())
            fail('INPUT_MATERIAL_SCHEMA_SCOPES_CHANGED');
        frame = validateMvuScopeReadFrameV1(input.schema.data.frame);
        const identity = frame.source;
        if (identity.sessionId !== source.sessionId || identity.sourceRecordSessionId !== source.sourceRecordSessionId
            || identity.importId !== source.original.activePointer.importId || identity.rawSha256 !== source.original.rawSha256)
            fail('INPUT_MATERIAL_SCHEMA_SCOPE_SOURCE_MISMATCH');
        stateSnapshotSha256 = input.schema.data.basis.numericalSnapshotSha256;
        evidence.push(cloneRoleplayTavernLoreDataV1(input.schema.data, 8_388_608));
    }
    else if (input.numerical) {
        if (!input.numerical.current())
            fail('INPUT_MATERIAL_NUMERICAL_SCOPES_CHANGED');
        numerical = input.numerical.data.local.schemaVersion === 2 || input.numerical.data.inherited?.schemaVersion === 2
            ? freeze(cloneRoleplayTavernLoreDataV1(input.numerical.data, 8_388_608)) : input.numerical.data;
        const { local, inherited } = numerical;
        if (local.sessionId !== source.sessionId)
            fail('INPUT_MATERIAL_NUMERICAL_SCOPE_SOURCE_MISMATCH');
        const tuple = { sourceRecordSessionId: source.sourceRecordSessionId, importId: source.original.activePointer.importId,
            rawSha256: source.original.rawSha256, normalizedSha256: source.original.normalizedSha256,
            transactionId: source.original.transactionId, coverageSha256: source.original.coverageSha256 };
        if (local.schemaVersion === 2) {
            const identity = local.sourceIdentity, { factsSha256, ...body } = local, actual = validateProgramMvuGenesisFactsV1(local.genesis.programEvent, local.genesis.programHead), event = actual.programEvent, plan = event.plan, original = identity.original, imported = plan.source.program.importTuple, initial = local.snapshots.find(row => row.stateSnapshotSha256 === local.genesisSnapshotSha256), root = local.currentSnapshot.root;
            if (local.encoding !== 'native-program-json-prompt-numerical-facts-v2' || local.authority !== 'consumer-data-only'
                || recordSha256(body) !== factsSha256 || identity.kind !== 'program-opening' || inherited !== null
                || actual.sessionId !== source.sessionId || actual.sourceSha256 !== local.numericalSourceSha256
                || recordSha256(actual) !== recordSha256(local.genesis) || identity.planSha256 !== plan.planSha256
                || identity.sourceProofSha256 !== plan.source.proofSha256 || identity.basisSha256 !== plan.basis.basisSha256
                || recordSha256(original) !== recordSha256(plan.source.source) || original.sessionId !== source.sessionId
                || recordSha256(original.pointer) !== recordSha256(source.original.activePointer)
                || Object.entries(tuple).some(([key, value]) => original[key] !== value)
                || imported.ownerSessionId !== source.sessionId || imported.sourceRecordSessionId !== source.sourceRecordSessionId
                || imported.importRecordRef.sha256 !== source.original.importRecordRef.sha256
                || imported.documentSha256 !== source.original.documentSha256 || imported.dataSha256 !== source.original.dataSha256
                || local.currentSnapshot.sessionId !== source.sessionId
                || local.currentSnapshot.sourceSha256 !== local.numericalSourceSha256 || !('encoding' in root)
                || root.encoding !== 'native-program-mvu-state-root-v1' || root.programEventId !== event.eventId
                || root.programEventSha256 !== event.eventSha256 || root.programHeadSha256 !== recordSha256(actual.programHead)
                || root.planSha256 !== plan.planSha256 || !initial || initial.revision !== 1
                || initial.sessionId !== source.sessionId || initial.sourceSha256 !== local.numericalSourceSha256
                || recordSha256(initial.currentHead) !== recordSha256(actual.programHead)
                || initial.valuesSha256 !== event.valuesSha256 || recordSha256(initial.values) !== recordSha256(event.finalValues)
                || recordSha256(initial.root) !== recordSha256(root)) {
                fail('INPUT_MATERIAL_PROGRAM_NUMERICAL_SCOPE_SOURCE_MISMATCH');
            }
            const native = event.native, message = native.production === 'selected-card-copy'
                ? { ownerSessionId: actual.sessionId, seq: native.receipt.assistantSeq, messageId: native.receipt.messageId,
                    nativeEventRecordSha256: native.receipt.messageVersion.eventSha256, renderedTextSha256: native.receipt.renderedSha256 }
                : { ownerSessionId: actual.sessionId, seq: native.receipt.terminalOutput.eventRef.seq,
                    messageId: native.receipt.terminalOutput.messageId, nativeEventRecordSha256: native.receipt.terminalOutput.eventRef.sha256,
                    renderedTextSha256: native.receipt.terminalOutput.textSha256 };
            if (recordSha256(local.genesisMessageRef) !== recordSha256(message)) {
                fail('INPUT_MATERIAL_PROGRAM_NUMERICAL_OPENING_MESSAGE_MISMATCH');
            }
            evidence.push({ schemaVersion: 2, encoding: 'native-program-json-prompt-numerical-fact-read-v2',
                authority: 'consumer-data-only', local, inherited: null, join: { tuple, loreSourceSha256: source.sourceSha256,
                    numericalSourceSha256: local.numericalSourceSha256, sourceProofSha256: identity.sourceProofSha256,
                    basisSha256: identity.basisSha256, planSha256: identity.planSha256 } });
        }
        else if (inherited?.schemaVersion === 2) {
            validateProgramInheritedScopeFacts(inherited, local, source);
            evidence.push({ schemaVersion: 2, encoding: 'native-program-json-prompt-inherited-fact-read-v2',
                authority: 'consumer-data-only', local, inherited, join: { tuple, loreSourceSha256: source.sourceSha256,
                    numericalSourceSha256: local.numericalSourceSha256,
                    programOpenings: inherited.programOpeningPublications.map(row => ({ ownerSessionId: row.ownerSessionId,
                        sourceProofSha256: row.source.proofSha256, basisSha256: row.basis.basisSha256,
                        planSha256: row.genesis.programEvent.plan.planSha256, originalPacketRefs: row.originalPacketRefs,
                        archiveProvenance: row.archiveProvenance })) } });
        }
        else if (local.sourceIdentity.kind === 'opening') {
            const original = local.sourceIdentity.original;
            if (original.sessionId !== source.sessionId || Object.entries(tuple).some(([key, value]) => original[key] !== value))
                fail('INPUT_MATERIAL_NUMERICAL_SCOPE_SOURCE_MISMATCH');
        }
        else {
            if (!inherited || inherited.childSessionId !== source.sessionId || inherited.numericalSourceSha256 !== local.numericalSourceSha256
                || !('derivedEvent' in local.genesis) || inherited.genesis.derivedEvent.basisSha256 !== local.sourceIdentity.basisSha256
                || recordSha256(inherited.genesis) !== recordSha256(local.genesis))
                fail('INPUT_MATERIAL_NUMERICAL_INHERITED_BASIS_MISMATCH');
            const original = inherited.originalImport;
            if (original.ownerSessionId !== tuple.sourceRecordSessionId || original.importId !== tuple.importId
                || original.rawSha256 !== tuple.rawSha256 || original.normalizedSha256 !== tuple.normalizedSha256
                || original.transactionId !== tuple.transactionId || original.coverageSha256 !== tuple.coverageSha256
                || original.recordSha256 !== source.original.importRecordRef.sha256)
                fail('INPUT_MATERIAL_NUMERICAL_SCOPE_SOURCE_MISMATCH');
        }
        stateSnapshotSha256 = local.currentSnapshot.stateSnapshotSha256;
        if (local.schemaVersion === 1 && inherited?.schemaVersion !== 2)
            evidence.push({ schemaVersion: 1, encoding: 'native-json-prompt-numerical-fact-read-v1',
                authority: 'consumer-data-only', local, inherited, join: { tuple, loreSourceSha256: source.sourceSha256,
                    numericalSourceSha256: local.numericalSourceSha256 } });
    }
    else if (input.plain) {
        if (!input.plain.current() || input.plain.data.sessionId !== source.sessionId)
            fail('INPUT_MATERIAL_PLAIN_SCOPES_CHANGED');
        if (input.plain.data.encoding === 'native-program-inherited-absence-scope-read-data-v1') {
            // This discriminator never enters old own/plain/numerical validators.
            programInheritedAbsence = programInheritedAbsenceData(input.plain.data, source);
            stateSnapshotSha256 = programInheritedAbsence.stableDomainSha256;
            evidence.push(programInheritedAbsence);
        }
        else if (input.plain.data.encoding === 'native-program-opening-absence-scope-read-data-v1') {
            programAbsence = programAbsenceData(input.plain.data, source);
            // This is readonly scope data identity, never an MVU snapshot/head.
            stateSnapshotSha256 = programAbsence.factsSha256;
            evidence.push(programAbsence);
        }
        else {
            plain = cloneRoleplayTavernLoreDataV1(input.plain.data, 8_388_608);
            if (plain.encoding !== 'native-plain-prompt-scope-facts-v1') {
                const { factsSha256, ...body } = plain;
                if (plain.authority !== 'consumer-data-only' || recordSha256(body) !== factsSha256
                    || recordSha256(plain.variables) !== recordSha256({ global: 'readonly-absent', chat: 'readonly-absent',
                        card: 'readonly-absent', script: 'unavailable-no-executing-script', messages: 'readonly-uninitialized-selected-cut' }))
                    fail('INPUT_MATERIAL_PROMPT_DOMAIN_SCOPES_CHANGED');
            }
            stateSnapshotSha256 = recordSha256(plain);
            evidence.push(plain);
        }
    }
    const policy = programInheritedAbsence ? TAVERN_PROGRAM_INHERITED_ABSENCE_SCOPE_ADAPTER_POLICY_V1 :
        programAbsence ? TAVERN_PROGRAM_ABSENCE_SCOPE_ADAPTER_POLICY_V1 :
            numerical?.inherited?.schemaVersion === 2 ? TAVERN_PROGRAM_INHERITED_SCOPE_ADAPTER_POLICY_V1 :
                opening || numerical?.local.schemaVersion === 2 ? TAVERN_PROGRAM_SCOPE_ADAPTER_POLICY_V1 : TAVERN_NATIVE_SCOPE_ADAPTER_POLICY_V1, absenceJoins = programAbsence ? programAbsenceMessageJoins(programAbsence, selected)
        : programInheritedAbsence ? programAbsenceMessageJoins(programInheritedAbsence, selected) : undefined, inheritedProgramJoins = numerical?.inherited?.schemaVersion === 2
        ? programInheritedMessageJoins(numerical.inherited.programOpeningPublications, selected) : undefined;
    const settledAbsenceRef = (scope, messageRef, nativeMessageJoin) => {
        if (!programAbsence)
            fail('INPUT_MATERIAL_PROGRAM_ABSENCE_SCOPE_FACT_MISSING');
        const domain = programAbsence.absenceDomain;
        return ref(`${owner}:${scope}`, programAbsence.factsSha256, { schemaVersion: 1,
            encoding: 'native-program-settled-absence-prompt-scope-ref-v1', scope, initialized: false,
            namespace: { sessionId: source.sessionId, importId: source.original.activePointer.importId },
            domainRef: programAbsence.domainRef, domainSha256: domain.domainSha256,
            sourceProofSha256: domain.sourceProofSha256, sourceBindingSha256: domain.sourceBindingSha256,
            basisSha256: domain.basisSha256, nativeFactsSha256: domain.nativeFacts.factsSha256,
            seedRef: domain.seedRef, inputRef: domain.inputRef, numericalSourceSha256: programAbsence.numericalSourceSha256,
            factsSha256: programAbsence.factsSha256, policySha256: recordSha256(policy), selectedBaseSha256: selected.sha256,
            ...(messageRef ? { messageRef } : {}), ...(nativeMessageJoin ? { nativeMessageJoin } : {}) });
    };
    const inheritedAbsenceRef = (scope, messageRef, nativeMessageJoin) => {
        if (!programInheritedAbsence)
            fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_SCOPE_FACT_MISSING');
        const data = programInheritedAbsence, domain = data.absenceDomain, inherited = data.sourceInheritance;
        return ref(`${owner}:${scope}`, data.stableDomainSha256, { schemaVersion: 1,
            encoding: 'native-program-inherited-absence-prompt-scope-ref-v1', scope, initialized: false,
            namespace: { sessionId: source.sessionId, importId: source.original.activePointer.importId },
            originalOpening: data.originalOpening, actualChildCut: data.actualChildCut,
            sourceInheritance: { inheritanceSha256: inherited.inheritanceSha256,
                preparedRef: inherited.preparedRef, commitRef: inherited.commitRef, readyRef: inherited.readyRef },
            currentSourceIdentitySha256: data.currentSourceIdentitySha256, stableDomainSha256: data.stableDomainSha256,
            domainSha256: domain.domainSha256, nativeFactsSha256: domain.nativeFacts.factsSha256,
            sourceProofSha256: domain.sourceProofSha256, sourceBindingSha256: domain.sourceBindingSha256,
            basisSha256: domain.basisSha256, numericalSourceSha256: data.numericalSourceSha256,
            originalNumericalSourceSha256: data.input.numericalSourceSha256,
            inventoryAuditSha256: data.inventory.inventorySha256, factsSha256: data.factsSha256,
            policySha256: recordSha256(policy), selectedBaseSha256: selected.sha256,
            ...(messageRef ? { messageRef } : {}), ...(nativeMessageJoin ? { nativeMessageJoin } : {}) });
    };
    const pendingRef = (scope, messageRef) => {
        if (!opening)
            fail('INPUT_MATERIAL_OPENING_SCOPE_FACT_MISSING');
        return ref(`${owner}:${scope}`, opening.scopeDataSha256, { schemaVersion: 1,
            encoding: 'native-program-opening-readonly-preview-ref-v1', scope, initialized: false,
            sourceProofSha256: opening.sourceProofSha256, basisSha256: opening.basisSha256,
            numericalSourceSha256: opening.numericalSourceSha256, seedRef: opening.seedRef, inputRef: opening.inputRef,
            inputBindingSha256: opening.inputBindingSha256, initializationKind: opening.initialization.kind,
            policySha256: recordSha256(policy), selectedBaseSha256: opening.selectedBaseSha256,
            nativeOwner: { kind: opening.nativeOwner.kind, ownerSha256: recordSha256(opening.nativeOwner),
                sessionId: opening.nativeOwner.identity.sessionId, operationId: opening.nativeOwner.identity.operationId,
                messageId: opening.nativeOwner.identity.messageId, instructionSha256: opening.nativeOwner.identity.instructionSha256,
                intentRef: opening.nativeOwner.identity.intentRef, invocationRef: opening.nativeOwner.invocationRef },
            ...(messageRef ? { messageRef } : {}) });
    };
    const available = (scope, variables) => {
        if (variables.kind !== 'available') {
            missing(scope, variables.code);
            return;
        }
        const values = cloneRoleplayTavernLoreDataV1(variables.variables, 1_048_576), provenance = ref(`${owner}:${scope}`, recordSha256(variables.provenance), { schemaVersion: 1, encoding: 'actual-mvu-prompt-scope-adapter-ref-v1',
            sourceIdentity: frame.source, scope, variablesSha256: variables.variablesSha256, origin: variables.provenance });
        scopes.push({ scope, fact: { kind: 'values', values, valuesSha256: recordSha256(values), provenance } });
    };
    const numericalValues = (snapshotSha256, origin, scope) => {
        if (!numerical)
            fail('INPUT_MATERIAL_NUMERICAL_FACT_MISSING');
        const matches = [...numerical.local.snapshots, ...(numerical.inherited?.snapshots ?? [])]
            .filter(row => row.stateSnapshotSha256 === snapshotSha256);
        if (!matches.length || matches.some(row => recordSha256(row) !== recordSha256(matches[0])))
            fail('INPUT_MATERIAL_NUMERICAL_SNAPSHOT_CONFLICT');
        const values = cloneRoleplayTavernLoreDataV1({ stat_data: matches[0].values }, 1_048_576), provenance = ref(`${owner}:${scope}`, snapshotSha256, { schemaVersion: 1,
            encoding: 'actual-json-numerical-prompt-scope-ref-v1', scope, origin, snapshotSha256,
            numericalFactsSha256: numerical.local.factsSha256, inheritedFactsSha256: numerical.inherited?.factsSha256 ?? null });
        return { kind: 'values', values, valuesSha256: recordSha256(values), provenance };
    };
    if (opening) {
        scopes.push({ scope: 'global', fact: { kind: 'absent', provenance: pendingRef('global') } });
        if (opening.initialization.kind === 'pending-raw-init-data') {
            const values = cloneRoleplayTavernLoreDataV1({ stat_data: opening.initialization.initialValues }, 1_048_576);
            scopes.push({ scope: 'chat', fact: { kind: 'values', values, valuesSha256: recordSha256(values), provenance: pendingRef('chat') } });
            missing('card', 'no actual initialized character-scope supplier for the pending program opening');
        }
        else {
            for (const scope of ['chat', 'card'])
                scopes.push({ scope, fact: { kind: 'absent', provenance: pendingRef(scope) } });
        }
        missing('script', 'no actual executing script-scope supplier for the pending program opening');
    }
    else if (frame) {
        available('global', frame.scopes.global);
        available('chat', frame.scopes.chat);
        available('card', frame.scopes.character);
        const scripts = input.scriptId ? frame.scripts.filter(row => row.scriptId === input.scriptId) : frame.scripts;
        if (scripts.length === 1)
            available('script', scripts[0].variables);
        else
            missing('script', 'actual unambiguous executing script scope');
    }
    else if (numerical) {
        scopes.push({ scope: 'chat', fact: numericalValues(stateSnapshotSha256, { kind: 'current-chat-authority',
                snapshotSha256: stateSnapshotSha256, revision: numerical.local.currentSnapshot.revision,
                numericalFactsSha256: numerical.local.factsSha256 }, 'chat') });
        scopes.push({ scope: 'global', fact: { kind: 'absent', provenance: ref(`${owner}:global`, recordSha256({ policy, source: source.sourceSha256 }), {
                    schemaVersion: 1, encoding: 'native-numerical-readonly-empty-global-namespace-ref-v1',
                    scope: 'global', namespace: { sessionId: source.sessionId, importId: source.original.activePointer.importId },
                    policySha256: recordSha256(policy),
                    numericalFactsSha256: numerical.local.factsSha256, inventorySha256: numerical.local.inventory.membershipSha256
                }) } });
        missing('card', 'no actual initialized character-scope supplier for the Native JSON numerical protocol');
        missing('script', 'no actual executing script-scope supplier for the Native JSON numerical protocol');
    }
    else if (programInheritedAbsence) {
        for (const scope of ['global', 'chat', 'card']) {
            scopes.push({ scope, fact: { kind: 'absent', provenance: inheritedAbsenceRef(scope) } });
        }
        missing('script', 'no actual executing script scope in the inherited program absence adapter');
    }
    else if (programAbsence) {
        for (const scope of ['global', 'chat', 'card']) {
            scopes.push({ scope, fact: { kind: 'absent', provenance: settledAbsenceRef(scope) } });
        }
        missing('script', 'no actual executing script scope in the settled program absence adapter');
    }
    else if (plain) {
        const absenceScopeRef = plain.encoding === 'native-plain-prompt-scope-facts-v1' ? plain.absenceScopeRef : plain.domainRef;
        for (const scope of ['global', 'chat', 'card']) {
            scopes.push({ scope, fact: { kind: 'absent', provenance: ref(`${owner}:${scope}`, stateSnapshotSha256, { schemaVersion: 1, encoding: 'native-plain-empty-prompt-namespace-ref-v1', scope,
                        policySha256: recordSha256(policy),
                        sourceIdentity: { sessionId: source.sessionId, importId: source.original.activePointer.importId,
                            rawSha256: source.original.rawSha256 }, absenceScopeRef }) } });
        }
        missing('script', 'no actual executing script scope in the plain opening adapter');
    }
    else {
        for (const scope of ['global', 'chat', 'card', 'script'])
            missing(scope, 'actual current variable scope supplier');
    }
    const currentManualChat = frame?.scopes.chat.kind === 'available'
        && frame.scopes.chat.provenance.kind === 'published-state' && frame.scopes.chat.provenance.state.kind === 'manual'
        ? frame.scopes.chat : undefined;
    const numericalStories = numerical ? [...numerical.local.storyPublications, ...(numerical.inherited?.storyPublications ?? [])] : [], numericalManuals = numerical ? [...numerical.local.manualPublications, ...(numerical.inherited?.manualPublications ?? [])] : [], latestManual = numericalManuals.filter(row => row.resultSnapshotSha256 === stateSnapshotSha256)
        .sort((left, right) => right.marker.seq - left.marker.seq)[0], manualAfterStory = latestManual && latestManual.marker.seq > Math.max(-1, ...numericalStories.map(row => row.canonical.seq));
    if (currentManualChat || manualAfterStory) {
        const values = cloneRoleplayTavernLoreDataV1({ stat_data: currentManualChat?.variables.stat_data
                ?? numerical.local.currentSnapshot.values }, 1_048_576), origin = currentManualChat?.provenance ?? latestManual, provenance = ref(`${owner}:cache-manual-overlay`, recordSha256({ origin, stateSnapshotSha256 }), {
            schemaVersion: 1, encoding: 'native-prompt-cache-manual-current-overlay-ref-v1', sessionId: source.sessionId,
            sourceSha256: source.sourceSha256, policySha256: recordSha256(policy),
            snapshotSha256: stateSnapshotSha256, origin, valuesSha256: recordSha256(values)
        });
        scopes.push({ scope: 'cache', fact: { kind: 'values', values, valuesSha256: recordSha256(values), provenance } });
    }
    const messages = storyRows.map((row, index) => {
        if (nativeInputSha256(row.message) !== row.messageSha256)
            fail('INPUT_MATERIAL_SCOPE_MESSAGE_HASH_CHANGED');
        const messageRef = ref(`${owner}:message:${row.id}`, row.messageSha256, { schemaVersion: 1,
            encoding: 'actual-native-prompt-selected-message-ref-v1', id: row.id, role: row.role,
            origin: row.origin, eventSeq: row.eventSeq, messageSha256: row.messageSha256,
            selectedBaseSha256: selected.sha256 });
        const matches = frame?.messages.filter(item => item.messageId === row.id
            && item.messageVersionSha256 === recordSha256(row.message)) ?? [];
        if (matches.length > 1)
            fail('INPUT_MATERIAL_SCOPE_MESSAGE_AMBIGUOUS');
        const variables = matches[0]?.variables;
        let active, initialized = null, initializedRef = null;
        if (opening) {
            if (row.origin !== 'surface' && row.origin !== 'pending-decision'
                || row.origin === 'surface' && (!Number.isSafeInteger(row.eventSeq) || Number(row.eventSeq) < 0)
                || row.origin === 'pending-decision' && row.role === 'user' && row.message.source?.kind === 'user') {
                fail('INPUT_MATERIAL_OPENING_SCOPE_MESSAGE_INVALID');
            }
            initialized = false;
            const provenance = pendingRef(`message-vars:${row.id}`, messageRef);
            active = { kind: 'absent', provenance };
            initializedRef = provenance;
        }
        else if (programInheritedAbsence) {
            if (String(row.message.id) !== row.id || row.message.role !== row.role
                || row.origin !== 'surface' && row.origin !== 'pending-decision'
                || row.origin === 'surface' && (!Number.isSafeInteger(row.eventSeq) || Number(row.eventSeq) < 0 || Object.is(row.eventSeq, -0))
                || row.origin === 'pending-decision' && row.eventSeq !== null) {
                fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_SCOPE_MESSAGE_INVALID');
            }
            initialized = false;
            const provenance = inheritedAbsenceRef(`message-vars:${row.id}`, messageRef, absenceJoins.get(row));
            active = { kind: 'absent', provenance };
            initializedRef = provenance;
        }
        else if (programAbsence) {
            if (String(row.message.id) !== row.id || row.message.role !== row.role
                || row.origin !== 'surface' && row.origin !== 'pending-decision'
                || row.origin === 'surface' && (!Number.isSafeInteger(row.eventSeq) || Number(row.eventSeq) < 0)
                || row.origin === 'pending-decision' && row.eventSeq !== null) {
                fail('INPUT_MATERIAL_PROGRAM_ABSENCE_SCOPE_MESSAGE_INVALID');
            }
            initialized = false;
            const provenance = settledAbsenceRef(`message-vars:${row.id}`, messageRef, absenceJoins.get(row));
            active = { kind: 'absent', provenance };
            initializedRef = provenance;
        }
        else if (numerical) {
            const matches = numericalStories.filter(item => item.canonical.messageId === row.id
                && item.canonical.seq === row.eventSeq && item.canonical.versionSha256 === recordSha256(row.message)), openings = (numerical.inherited?.openingPublications ?? []).filter(item => item.canonical.messageId === row.id
                && item.canonical.seq === row.eventSeq && item.canonical.versionSha256 === recordSha256(row.message)), programOpening = inheritedProgramJoins?.get(row), localOpening = numerical.local.genesisMessageRef, isLocalOpening = localOpening?.messageId === row.id && localOpening.seq === row.eventSeq
                && localOpening.renderedTextSha256 === sha256(textOf(row.message.content))
                && (numerical.local.schemaVersion === 1 || row.role === 'assistant' && row.origin === 'surface'
                    && (numerical.local.genesis.programEvent.native.production === 'selected-card-copy'
                        || row.messageSha256 === numerical.local.genesis.programEvent.native.receipt.terminalOutput.messageSha256));
            if (matches.length + openings.length + (programOpening ? 1 : 0) + (isLocalOpening ? 1 : 0) > 1)
                fail('INPUT_MATERIAL_SCOPE_MESSAGE_AMBIGUOUS');
            const publication = matches[0] ?? openings[0] ?? programOpening;
            if (publication || isLocalOpening) {
                initialized = true;
                active = numericalValues(publication?.resultSnapshotSha256 ?? numerical.local.genesisSnapshotSha256, { messageRef, publication: publication ? { kind: publication.kind, ownerSessionId: publication.ownerSessionId,
                        canonical: publication.canonical, publicationSha256: recordSha256(publication),
                        ...(publication.kind === 'program-opening' ? { originalPacketRefs: publication.originalPacketRefs,
                            archiveProvenance: publication.archiveProvenance, sourceProofSha256: publication.source.proofSha256,
                            basisSha256: publication.basis.basisSha256, planSha256: publication.genesis.programEvent.plan.planSha256,
                            settlementSha256: publication.openingSettlement.settlementSha256 } : {}) } : localOpening }, 'message');
                initializedRef = active.provenance;
            }
            else if (row.role === 'user' || row.origin === 'pending-decision') {
                // This closed writer protocol publishes numeric values only with an
                // exact assistant canonical/opening version. User/pending messages
                // remain uninitialized; no current/manual value is assigned to them.
                initialized = false;
                const provenance = ref(`${owner}:message-vars:${row.id}`, numerical.local.factsSha256, {
                    schemaVersion: 1, encoding: 'native-numerical-unpublished-message-scope-ref-v1', messageRef,
                    policySha256: recordSha256(policy),
                    localInventorySha256: numerical.local.inventory.membershipSha256,
                    inheritedInventorySha256: numerical.inherited?.inventory.membershipSha256 ?? null
                });
                active = { kind: 'absent', provenance };
                initializedRef = provenance;
            }
            else
                active = { kind: 'unavailable', missingEvidence: [
                        'an exact Native-owned numerical publication or proven foreign-message absence for this assistant version'
                    ] };
        }
        else if (variables?.kind === 'available' && variables.provenance.kind !== 'initialized-empty') {
            initialized = true;
            const provenance = ref(`${owner}:message-vars:${row.id}`, recordSha256(variables.provenance), { schemaVersion: 1, encoding: 'actual-native-published-message-variable-ref-v1', origin: variables.provenance,
                messageRef, frameSha256: frame.frameSha256 });
            active = { kind: 'values', values: variables.variables, valuesSha256: variables.variablesSha256, provenance };
            initializedRef = provenance;
        }
        else if (plain || variables?.kind === 'available' && variables.provenance.kind === 'initialized-empty'
            || frame && row.origin === 'pending-decision') {
            initialized = false;
            const provenance = ref(`${owner}:message-vars:${row.id}`, stateSnapshotSha256, { schemaVersion: 1, encoding: 'native-prompt-unpublished-message-variable-ref-v1', messageRef,
                policySha256: recordSha256(policy),
                scopeBasisSha256: frame?.frameSha256 ?? recordSha256(plain),
                sourceIdentity: { sessionId: source.sessionId, importId: source.original.activePointer.importId,
                    rawSha256: source.original.rawSha256 } });
            active = { kind: 'absent', provenance };
            initializedRef = provenance;
        }
        else
            active = { kind: 'unavailable', missingEvidence: ['actual published or absent message-variable fact for this exact version'] };
        return { index, messageId: row.id, activeSwipe: 0, active, selectedSwipe: index === storyRows.length - 1 ? 0 : null,
            selected: index === storyRows.length - 1 ? active : null, selectedInitialized: index === storyRows.length - 1 ? initialized : null,
            initializedRef: index === storyRows.length - 1 ? initializedRef : null, messageRef };
    });
    const history = { kind: 'complete-prefix', messageCount: messages.length,
        selectedIndex: messages.length ? messages.length - 1 : null, selectedSwipe: messages.length ? 0 : null, messages,
        membershipRef: ref(`${owner}:selected-history`, selected.sha256, { schemaVersion: 1,
            encoding: 'actual-native-selected-story-variable-membership-v1', selectedBaseSha256: selected.sha256,
            policySha256: recordSha256(policy),
            messages: storyRows.map(row => ({ id: row.id, messageSha256: row.messageSha256, origin: row.origin, eventSeq: row.eventSeq })) }) };
    const selectedFact = messages.at(-1)?.selected;
    if (selectedFact)
        scopes.push({ scope: 'message', fact: selectedFact });
    else
        missing('message', 'no actual selected message-variable fact');
    const bindings = scopes.filter(row => row.scope !== 'cache').map(factBinding)
        .filter((value) => value !== null);
    const current = () => {
        input.assertOwnerCurrent();
        if (input.schema && !input.schema.current() || input.plain && !input.plain.current()
            || input.numerical && !input.numerical.current() || input.opening && !input.opening.current())
            fail('INPUT_MATERIAL_SCOPES_CHANGED');
    };
    // Confirm the suppliers once while the synchronous capture is still owned.
    // The returned value is DATA; its parent InputState frame owns later checks.
    current();
    return { scopes: freeze(scopes), bindings: freeze(bindings), history: freeze(history), stateSnapshotSha256,
        evidence: freeze({ schemaVersion: 1, encoding: 'native-prompt-variable-scope-capture-v1', authority: 'consumer-data-only',
            policy, sourceSha256: source.sourceSha256, selectedBaseSha256: selected.sha256, evidence }) };
}
