// Generated from runtime/alpha3/src/core/roleplay-tavern-prompt-scopes.ts; edit the TypeScript source.
/** Adapts actual completed Native variable facts to readonly prompt scopes.
 * Empty-before-publication is an explicit adapter policy, never a claim that
 * ST persisted variables_initialized or that a copied frame grants permission. */
import { nativeInputSha256 } from 'dsh-nexttavern-native-agent-loop';
import { recordSha256, sha256, textOf } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
import { selectCurrentPromptMessageV2 } from './roleplay-tavern-prompt-variables-message.js';
import { applyAuthorChatOverlayV3 } from './roleplay-author-chat-state-types.js';
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
/** Selected-only DATA is a separate consumer contract, without a V1 frame. */
export const TAVERN_SELECTED_SCOPE_ADAPTER_POLICY_V2 = Object.freeze({ ...TAVERN_NATIVE_SCOPE_ADAPTER_POLICY_V1,
    schemaVersion: 2, encoding: 'native-selected-readonly-prompt-scope-adapter-policy-v2',
    schema: 'completed-actual-source-bound-selected-MVU-scope-data; exact-selected-base; independent-current-closure' });
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
/** The actual Core suppliers already audited and froze these packets inside
 * InputState. This adapter only joins that DATA to the captured Source. */
function programAbsenceData(data, source) {
    const proof = data.input.source, original = proof.source, tuple = proof.program.importTuple;
    if (data.sessionId !== source.sessionId || original.sessionId !== source.sessionId
        || original.sourceRecordSessionId !== source.sourceRecordSessionId
        || original.importId !== source.original.activePointer.importId || original.rawSha256 !== source.original.rawSha256
        || original.normalizedSha256 !== source.original.normalizedSha256 || original.transactionId !== source.original.transactionId
        || original.coverageSha256 !== source.original.coverageSha256
        || tuple.ownerSessionId !== source.sessionId || tuple.sourceRecordSessionId !== source.sourceRecordSessionId
        || tuple.normalizer !== source.normalizer || tuple.format !== source.original.decodedFormat
        || tuple.importRecordRef.sha256 !== source.original.importRecordRef.sha256
        || tuple.documentSha256 !== source.original.documentSha256 || tuple.dataSha256 !== source.original.dataSha256) {
        fail('INPUT_MATERIAL_PROGRAM_ABSENCE_SCOPE_SOURCE_MISMATCH');
    }
    return data;
}
function programInheritedAbsenceData(data, source, currentIdentitySha256) {
    const tuple = data.input.source.program.importTuple;
    if (data.sessionId !== source.sessionId || !source.inheritance
        || data.sourceInheritance.childSessionId !== source.sessionId
        || data.sourceInheritance.parentSessionId !== source.inheritance.parentSessionId
        || data.currentSourceIdentitySha256 !== currentIdentitySha256
        || tuple.sourceRecordSessionId !== source.sourceRecordSessionId
        || tuple.importId !== source.original.activePointer.importId || tuple.rawSha256 !== source.original.rawSha256
        || tuple.normalizedSha256 !== source.original.normalizedSha256 || tuple.coverageSha256 !== source.original.coverageSha256
        || tuple.transactionId !== source.original.transactionId || tuple.format !== source.original.decodedFormat
        || tuple.normalizer !== source.normalizer || tuple.documentSha256 !== source.original.documentSha256
        || tuple.dataSha256 !== source.original.dataSha256
        || tuple.importRecordRef.sha256 !== source.original.importRecordRef.sha256) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_ABSENCE_SOURCE_MISMATCH');
    }
    return data;
}
/** A real selected cut may omit older opening outputs. Match every visible
 * id/seq/operation overlap strictly; absence from this cut proves no deletion.
 * Root's current closure separately reads the original Native span/edits. */
function programAbsenceMessageJoins(data, selected, inherited = false) {
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
                || row.message.source.kind !== 'model'
                || !inherited && (row.messageSha256 !== output.messageSha256 || sha256(text) !== output.textSha256)) {
                fail('INPUT_MATERIAL_PROGRAM_ABSENCE_GENERATED_MESSAGE_MISMATCH');
            }
            seen.add(output.messageId);
            // A child may project a lawful edit. The Native receipt remains the
            // original publication; the selected messageRef records current bytes.
            joined.set(row, { production: native.production, messageId: output.messageId, eventRef: output.eventRef,
                messageSha256: output.messageSha256, textEncoding: output.textEncoding, textSha256: output.textSha256,
                terminal: output.messageId === native.receipt.terminalOutput.messageId, nativeFactsSha256: native.factsSha256 });
        }
    }
    return joined;
}
function joinProgramInheritedNumericalSource(data, local, source) {
    const original = data.originalImport, tuple = source.original;
    // The numerical producers own replay and its frozen DATA. This consumer
    // joins that result to today's independently captured author Source.
    if (data.childSessionId !== source.sessionId || data.source.childSessionId !== source.sessionId
        || !('derivedEvent' in local.genesis) || recordSha256(data.genesis) !== recordSha256(local.genesis)
        || original.ownerSessionId !== source.sourceRecordSessionId || original.importId !== tuple.activePointer.importId
        || original.rawSha256 !== tuple.rawSha256 || original.normalizedSha256 !== tuple.normalizedSha256
        || original.transactionId !== tuple.transactionId || original.coverageSha256 !== tuple.coverageSha256
        || original.recordSha256 !== tuple.importRecordRef.sha256) {
        fail('INPUT_MATERIAL_PROGRAM_INHERITED_NUMERICAL_SOURCE_MISMATCH');
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
/** InputState's actual opening supplier owns seed/input/basis/plan auditing.
 * Consumption joins the captured Source and exact selected cut once. */
function pendingOpeningData(input, source, selected, currentIdentitySha256) {
    if (!input.current())
        fail('INPUT_MATERIAL_OPENING_SCOPES_CHANGED');
    const data = input.data, proof = data.input.source, original = proof.source, imported = proof.program.importTuple;
    if (data.sessionId !== source.sessionId || data.selectedBaseSha256 !== selected.sha256
        || original.sessionId !== source.sessionId || original.sourceRecordSessionId !== source.sourceRecordSessionId
        || original.importId !== source.original.activePointer.importId || original.rawSha256 !== source.original.rawSha256
        || original.normalizedSha256 !== source.original.normalizedSha256
        || original.coverageSha256 !== source.original.coverageSha256 || original.transactionId !== source.original.transactionId
        || imported.ownerSessionId !== source.sessionId || imported.sourceRecordSessionId !== source.sourceRecordSessionId
        || imported.importRecordRef.sha256 !== source.original.importRecordRef.sha256
        || imported.documentSha256 !== source.original.documentSha256 || imported.dataSha256 !== source.original.dataSha256
        || proof.program.sourceCurrentIdentitySha256 !== currentIdentitySha256) {
        fail('INPUT_MATERIAL_OPENING_SCOPE_SOURCE_MISMATCH');
    }
    if (selected.messages.some(row => row.role === 'user' && row.origin === 'pending-decision'
        && row.message.source?.kind === 'user'))
        fail('INPUT_MATERIAL_OPENING_SCOPE_PLAYER_INPUT_PRESENT');
    return data;
}
export function captureRoleplayTavernPromptScopesV1(input) {
    const { source, selected } = input, storyRows = selected.messages.filter(input.isStoryMessage), owner = `${source.sessionId}:prompt-scope`;
    input.assertOwnerCurrent();
    if ([input.schema, input.numerical, input.plain, input.opening].filter(value => value !== undefined).length > 1) {
        fail('INPUT_MATERIAL_SCOPE_AUTHORITY_CONFLICT');
    }
    const scopes = [], evidence = [], missing = (scope, detail) => scopes.push({ scope, fact: { kind: 'unavailable', missingEvidence: [detail] } });
    const pointSupplier = input.schema && 'messageAt' in input.schema ? input.schema : undefined;
    let frame, selectedData, scopeData, plain, programAbsence, programInheritedAbsence, numerical, opening, stateSnapshotSha256 = recordSha256({ schemaVersion: 1, encoding: 'prompt-numerical-scope-unavailable-v1', source: source.sourceSha256 });
    if (input.opening) {
        opening = pendingOpeningData(input.opening, source, selected, input.currentIdentitySha256);
        stateSnapshotSha256 = opening.scopeDataSha256;
        evidence.push(opening);
    }
    else if (input.schema) {
        if (!input.schema.current())
            fail('INPUT_MATERIAL_SCHEMA_SCOPES_CHANGED');
        if (input.schema.data.schemaVersion === 2 || input.schema.data.schemaVersion === 3) {
            selectedData = input.schema.data;
            if (selectedData.selectedBaseSha256 !== selected.sha256)
                fail('INPUT_MATERIAL_SCHEMA_SCOPE_SELECTION_MISMATCH');
            scopeData = 'messages' in selectedData ? selectedData : { ...selectedData, messages: [] };
        }
        else {
            frame = validateMvuScopeReadFrameV1(input.authorDialogScopes ?? input.schema.data.frame);
            scopeData = frame;
        }
        const identity = scopeData.source;
        if (identity.sessionId !== source.sessionId || identity.sourceRecordSessionId !== source.sourceRecordSessionId
            || identity.importId !== source.original.activePointer.importId || identity.rawSha256 !== source.original.rawSha256)
            fail('INPUT_MATERIAL_SCHEMA_SCOPE_SOURCE_MISMATCH');
        stateSnapshotSha256 = input.schema.data.basis.numericalSnapshotSha256;
        evidence.push(selectedData ?? cloneRoleplayTavernLoreDataV1(input.schema.data, 8_388_608));
    }
    else if (input.numerical) {
        // The numerical producer has already replayed and frozen these facts.
        // InputState owns their subscriptions and all later invalidation.
        numerical = input.numerical.data;
        const { local, inherited } = numerical;
        if (local.sessionId !== source.sessionId)
            fail('INPUT_MATERIAL_NUMERICAL_SCOPE_SOURCE_MISMATCH');
        const tuple = { sourceRecordSessionId: source.sourceRecordSessionId, importId: source.original.activePointer.importId,
            rawSha256: source.original.rawSha256, normalizedSha256: source.original.normalizedSha256,
            transactionId: source.original.transactionId, coverageSha256: source.original.coverageSha256 };
        if (local.schemaVersion === 2) {
            const identity = local.sourceIdentity, original = identity.original, imported = local.genesis.programEvent.plan.source.program.importTuple;
            if (original.sessionId !== source.sessionId
                || Object.entries(tuple).some(([key, value]) => original[key] !== value)
                || imported.ownerSessionId !== source.sessionId || imported.sourceRecordSessionId !== source.sourceRecordSessionId
                || imported.importRecordRef.sha256 !== source.original.importRecordRef.sha256
                || imported.documentSha256 !== source.original.documentSha256 || imported.dataSha256 !== source.original.dataSha256) {
                fail('INPUT_MATERIAL_PROGRAM_NUMERICAL_SCOPE_SOURCE_MISMATCH');
            }
            evidence.push({ schemaVersion: 2, encoding: 'native-program-json-prompt-numerical-fact-read-v2',
                authority: 'consumer-data-only', local, inherited: null, join: { tuple, loreSourceSha256: source.sourceSha256,
                    numericalSourceSha256: local.numericalSourceSha256, sourceProofSha256: identity.sourceProofSha256,
                    basisSha256: identity.basisSha256, planSha256: identity.planSha256 } });
        }
        else if (inherited?.schemaVersion === 2) {
            joinProgramInheritedNumericalSource(inherited, local, source);
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
            if (!inherited || inherited.childSessionId !== source.sessionId
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
            programInheritedAbsence = programInheritedAbsenceData(input.plain.data, source, input.currentIdentitySha256);
            stateSnapshotSha256 = programInheritedAbsence.stableDomainSha256;
            evidence.push(programInheritedAbsence);
        }
        else if (input.plain.data.encoding === 'native-program-opening-absence-scope-read-data-v1') {
            // Completed opening DATA retains its historical author projection.
            // InputState separately captures and owns today's editable author rows.
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
                opening || numerical?.local.schemaVersion === 2 ? TAVERN_PROGRAM_SCOPE_ADAPTER_POLICY_V1 :
                    selectedData ? TAVERN_SELECTED_SCOPE_ADAPTER_POLICY_V2 : TAVERN_NATIVE_SCOPE_ADAPTER_POLICY_V1, policySha256 = recordSha256(policy), absenceJoins = programAbsence ? programAbsenceMessageJoins(programAbsence, selected)
        : programInheritedAbsence ? programAbsenceMessageJoins(programInheritedAbsence, selected, true) : undefined, inheritedProgramJoins = numerical?.inherited?.schemaVersion === 2
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
            factsSha256: programAbsence.factsSha256, policySha256: policySha256, selectedBaseSha256: selected.sha256,
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
            policySha256: policySha256, selectedBaseSha256: selected.sha256,
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
            policySha256: policySha256, selectedBaseSha256: opening.selectedBaseSha256,
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
        const values = pointSupplier ? variables.variables : cloneRoleplayTavernLoreDataV1(variables.variables, 1_048_576), origin = variables.provenance, provenance = ref(`${owner}:${scope}`, recordSha256(selectedData ? { schemaVersion: 2,
            encoding: 'native-selected-prompt-variable-scope-version-v2', scopeReadDataSha256: selectedData.readDataSha256, origin } : origin), {
            schemaVersion: selectedData ? 2 : 1, encoding: selectedData ? 'actual-selected-mvu-prompt-scope-adapter-ref-v2' :
                'actual-mvu-prompt-scope-adapter-ref-v1',
            ...selectedData ? { scopeReadDataSha256: selectedData.readDataSha256 } : {},
            sourceIdentity: scopeData.source, scope, variablesSha256: variables.variablesSha256, origin: variables.provenance
        });
        scopes.push({ scope, fact: { kind: 'values', values, valuesSha256: pointSupplier
                    ? variables.variablesSha256 : recordSha256(values), provenance } });
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
    else if (scopeData) {
        available('global', scopeData.scopes.global);
        available('chat', scopeData.scopes.chat);
        available('card', scopeData.scopes.character);
        const scripts = input.scriptId ? scopeData.scripts.filter(row => row.scriptId === input.scriptId) : scopeData.scripts;
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
                    policySha256: policySha256,
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
                        policySha256: policySha256,
                        sourceIdentity: { sessionId: source.sessionId, importId: source.original.activePointer.importId,
                            rawSha256: source.original.rawSha256 }, absenceScopeRef }) } });
        }
        missing('script', 'no actual executing script scope in the plain opening adapter');
    }
    else {
        for (const scope of ['global', 'chat', 'card', 'script'])
            missing(scope, 'actual current variable scope supplier');
    }
    const currentManualChat = scopeData?.scopes.chat.kind === 'available'
        && scopeData.scopes.chat.provenance.kind === 'published-state' && scopeData.scopes.chat.provenance.state.kind === 'manual'
        ? scopeData.scopes.chat : undefined;
    const numericalStories = numerical ? [...numerical.local.storyPublications, ...(numerical.inherited?.storyPublications ?? [])] : [], numericalManuals = numerical ? [...numerical.local.manualPublications, ...(numerical.inherited?.manualPublications ?? [])] : [], latestManual = numericalManuals.filter(row => row.resultSnapshotSha256 === stateSnapshotSha256)
        .sort((left, right) => right.marker.seq - left.marker.seq)[0], manualAfterStory = latestManual && latestManual.marker.seq > Math.max(-1, ...numericalStories.map(row => row.canonical.seq));
    if (currentManualChat || manualAfterStory) {
        const values = cloneRoleplayTavernLoreDataV1({ stat_data: currentManualChat?.variables.stat_data
                ?? numerical.local.currentSnapshot.values }, 1_048_576), origin = currentManualChat?.provenance ?? latestManual, provenance = ref(`${owner}:cache-manual-overlay`, recordSha256(selectedData ? { schemaVersion: 2,
            encoding: 'native-selected-prompt-manual-overlay-version-v2', scopeReadDataSha256: selectedData.readDataSha256,
            origin, stateSnapshotSha256 } : { origin, stateSnapshotSha256 }), {
            schemaVersion: pointSupplier ? 3 : selectedData ? 2 : 1, encoding: pointSupplier ? 'native-prompt-cache-manual-current-overlay-ref-v3' : selectedData ? 'native-selected-prompt-cache-manual-current-overlay-ref-v2' :
                'native-prompt-cache-manual-current-overlay-ref-v1', sessionId: source.sessionId,
            ...selectedData ? { scopeReadDataSha256: selectedData.readDataSha256 } : {},
            sourceSha256: source.sourceSha256, policySha256: policySha256,
            snapshotSha256: stateSnapshotSha256, origin, valuesSha256: recordSha256(values)
        });
        scopes.push({ scope: 'cache', fact: { kind: 'values', values, valuesSha256: recordSha256(values), provenance } });
    }
    if (input.ordinaryChat) {
        const ordinary = input.ordinaryChat, chatIndex = scopes.findIndex(row => row.scope === 'chat'), prior = chatIndex < 0 ? undefined : scopes[chatIndex].fact, values = applyAuthorChatOverlayV3(prior?.kind === 'values' ? prior.values : {}, ordinary), valuesSha256 = recordSha256(values), provenance = ref(`${owner}:chat`, recordSha256({ ordinaryRoot: ordinary.root, prior }), {
            schemaVersion: 1, encoding: 'native-ordinary-chat-prompt-scope-ref-v1',
            root: ordinary.root, ...prior ? { prior } : {}, valuesSha256
        }), chat = { scope: 'chat', fact: { kind: 'values', values, valuesSha256, provenance } };
        if (chatIndex < 0)
            scopes.push(chat);
        else
            scopes[chatIndex] = chat;
        evidence.push(ordinary);
        if (ordinary.root.head || ordinary.root.base) {
            const cacheIndex = scopes.findIndex(row => row.scope === 'cache'), cache = { scope: 'cache', fact: chat.fact };
            if (cacheIndex < 0)
                scopes.push(cache);
            else
                scopes[cacheIndex] = cache;
        }
    }
    const latestVariables = { message: null, absence: [] };
    // Retain all exact matches: duplicate publications remain ambiguous.
    const scopeMessagesByVersion = new Map();
    for (const item of scopeData?.messages ?? []) {
        let versions = scopeMessagesByVersion.get(item.messageId);
        if (!versions) {
            versions = new Map();
            scopeMessagesByVersion.set(item.messageId, versions);
        }
        const matches = versions.get(item.messageVersionSha256);
        if (matches)
            matches.push(item);
        else
            versions.set(item.messageVersionSha256, [item]);
    }
    const numericalStoriesByVersion = new Map();
    for (const item of numericalStories) {
        const key = JSON.stringify([item.canonical.messageId, item.canonical.seq]);
        let versions = numericalStoriesByVersion.get(key);
        if (!versions) {
            versions = new Map();
            numericalStoriesByVersion.set(key, versions);
        }
        const matches = versions.get(item.canonical.versionSha256);
        if (matches)
            matches.push(item);
        else
            versions.set(item.canonical.versionSha256, [item]);
    }
    const numericalOpenings = numerical?.inherited?.openingPublications ?? [], numericalOpeningsByVersion = new Map();
    for (const item of numericalOpenings) {
        const key = JSON.stringify([item.canonical.messageId, item.canonical.seq]);
        let versions = numericalOpeningsByVersion.get(key);
        if (!versions) {
            versions = new Map();
            numericalOpeningsByVersion.set(key, versions);
        }
        const matches = versions.get(item.canonical.versionSha256);
        if (matches)
            matches.push(item);
        else
            versions.set(item.canonical.versionSha256, [item]);
    }
    const pointFacts = new Map();
    const messageAt = (index) => {
        const previous = pointFacts.get(index);
        if (previous)
            return previous;
        const row = storyRows[index], point = pointSupplier?.messageAt(index);
        if (!selectedData && nativeInputSha256(row.message) !== row.messageSha256)
            fail('INPUT_MATERIAL_SCOPE_MESSAGE_HASH_CHANGED');
        const messageRef = ref(`${owner}:message:${row.id}`, selectedData ? recordSha256({ schemaVersion: 2,
            encoding: 'native-selected-prompt-message-version-v2', scopeReadDataSha256: selectedData.readDataSha256,
            messageSha256: row.messageSha256 }) : row.messageSha256, { schemaVersion: selectedData ? 2 : 1,
            encoding: selectedData ? 'actual-native-prompt-selected-message-ref-v2' : 'actual-native-prompt-selected-message-ref-v1',
            ...selectedData ? { scopeReadDataSha256: selectedData.readDataSha256 } : {}, id: row.id, role: row.role,
            origin: row.origin, eventSeq: row.eventSeq, messageSha256: row.messageSha256,
            selectedBaseSha256: selected.sha256 });
        const frameVersions = point ? new Map([[point.messageVersionSha256, [point]]]) : scopeMessagesByVersion.get(row.id), numericalKey = JSON.stringify([row.id, row.eventSeq]), storyVersions = numericalStoriesByVersion.get(numericalKey), openingVersions = numericalOpeningsByVersion.get(numericalKey), messageVersionSha256 = point?.messageVersionSha256 ?? (frameVersions || storyVersions || openingVersions ? recordSha256(row.message) : ''), matches = frameVersions?.get(messageVersionSha256) ?? [];
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
            const matches = storyVersions?.get(messageVersionSha256) ?? [], openings = openingVersions?.get(messageVersionSha256) ?? [], programOpening = inheritedProgramJoins?.get(row), localOpening = numerical.local.genesisMessageRef, isLocalOpening = localOpening?.messageId === row.id && localOpening.seq === row.eventSeq
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
                    policySha256: policySha256,
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
            const provenance = ref(`${owner}:message-vars:${row.id}`, recordSha256(selectedData ? { schemaVersion: 2,
                encoding: 'native-selected-prompt-published-variable-version-v2', scopeReadDataSha256: selectedData.readDataSha256,
                origin: variables.provenance } : variables.provenance), selectedData ? { schemaVersion: 2, encoding: 'actual-native-selected-published-message-variable-ref-v2',
                origin: variables.provenance, messageRef, scopeReadDataSha256: selectedData.readDataSha256 } :
                { schemaVersion: 1, encoding: 'actual-native-published-message-variable-ref-v1', origin: variables.provenance,
                    messageRef, frameSha256: frame.frameSha256 });
            active = { kind: 'values', values: variables.variables, valuesSha256: variables.variablesSha256, provenance };
            initializedRef = provenance;
        }
        else if (plain || variables?.kind === 'available' && variables.provenance.kind === 'initialized-empty'
            || scopeData && row.origin === 'pending-decision') {
            initialized = false;
            const provenance = ref(`${owner}:message-vars:${row.id}`, selectedData ? recordSha256({ schemaVersion: 2,
                encoding: 'native-selected-prompt-unpublished-variable-version-v2', scopeReadDataSha256: selectedData.readDataSha256,
                stateSnapshotSha256 }) : stateSnapshotSha256, { schemaVersion: selectedData ? 2 : 1, encoding: selectedData ? 'native-selected-prompt-unpublished-message-variable-ref-v2' :
                    'native-prompt-unpublished-message-variable-ref-v1', messageRef,
                policySha256: policySha256,
                ...selectedData ? { scopeReadDataSha256: selectedData.readDataSha256 } :
                    { scopeBasisSha256: frame?.frameSha256 ?? recordSha256(plain) },
                sourceIdentity: { sessionId: source.sessionId, importId: source.original.activePointer.importId,
                    rawSha256: source.original.rawSha256 } });
            active = { kind: 'absent', provenance };
            initializedRef = provenance;
        }
        else
            active = { kind: 'unavailable', missingEvidence: ['actual published or absent message-variable fact for this exact version'] };
        const message = { index, messageId: row.id, activeSwipe: 0, active,
            selectedSwipe: index === storyRows.length - 1 ? 0 : null,
            selected: index === storyRows.length - 1 ? active : null, selectedInitialized: index === storyRows.length - 1 ? initialized : null,
            initializedRef: index === storyRows.length - 1 ? initializedRef : null, messageRef };
        if (active.kind === 'absent')
            latestVariables.absence.push(active.provenance);
        else {
            latestVariables.message = message;
            latestVariables.absence = [];
        }
        pointFacts.set(index, message);
        return message;
    };
    const messages = pointSupplier ? [] : storyRows.map((_row, index) => messageAt(index));
    const selectionRef = pointSupplier ? ref(`${owner}:selection`, selected.sha256, { schemaVersion: 3,
        encoding: 'native-prompt-variable-selected-membership-ref-v3', selectedBaseSha256: selected.sha256,
        scopeReadDataSha256: selectedData.readDataSha256, sourceSha256: source.sourceSha256 }) : undefined;
    const messageSelection = selectionRef ? selectCurrentPromptMessageV2(storyRows.length, messageAt, selected.sha256, {
        kind: 'history', identity: 'actual-selected-membership', valueSha256: selected.sha256, provenance: selectionRef
    }) : undefined;
    const selectedMessage = pointSupplier && storyRows.length ? messageAt(storyRows.length - 1) : messages.at(-1);
    const history = pointSupplier ? undefined : { kind: 'complete-prefix', messageCount: messages.length,
        selectedIndex: messages.length ? messages.length - 1 : null, selectedSwipe: messages.length ? 0 : null, messages,
        membershipRef: ref(`${owner}:selected-history`, selectedData ? recordSha256({ schemaVersion: 2,
            encoding: 'native-selected-prompt-membership-version-v2', scopeReadDataSha256: selectedData.readDataSha256,
            selectedBaseSha256: selected.sha256 }) : selected.sha256, { schemaVersion: selectedData ? 2 : 1,
            encoding: selectedData ? 'actual-native-selected-story-variable-membership-v2' : 'actual-native-selected-story-variable-membership-v1',
            ...selectedData ? { scopeReadDataSha256: selectedData.readDataSha256 } : {}, selectedBaseSha256: selected.sha256,
            policySha256: policySha256,
            messages: storyRows.map(row => ({ id: row.id, messageSha256: row.messageSha256, origin: row.origin, eventSeq: row.eventSeq })) }) };
    // Known absence is skipped, but an unavailable later message cannot grant
    // permission to read an older publication. Reuse the owner's values/hash.
    const latest = latestVariables.message, active = latest?.active;
    const messageVariables = messageSelection
        ? messageSelection.kind === 'unavailable' || messageSelection.kind === 'empty' ? null : { scope: 'message', ownerId: selectionRef.ownerId,
            versionSha256: recordSha256(messageSelection), values: messageSelection.values ?? {},
            valuesSha256: recordSha256(messageSelection.values ?? {}) }
        : !messages.length || active?.kind === 'unavailable' ? null : {
            scope: 'message', ownerId: active?.kind === 'values' ? active.provenance.ownerId : history.membershipRef.ownerId,
            versionSha256: recordSha256({ schemaVersion: selectedData ? 2 : 1, encoding: selectedData ?
                    'native-selected-latest-message-variables-v2' : 'native-latest-message-variables-v1',
                ...selectedData ? { scopeReadDataSha256: selectedData.readDataSha256 } : {},
                membershipRef: history.membershipRef, messageRef: latest?.messageRef ?? null,
                publication: active?.kind === 'values' ? active.provenance : null, laterAbsence: latestVariables.absence }),
            values: active?.kind === 'values' ? active.values : {},
            valuesSha256: active?.kind === 'values' ? active.valuesSha256 : recordSha256({})
        };
    const selectedFact = selectedMessage?.selected;
    if (selectedFact)
        scopes.push({ scope: 'message', fact: selectedFact });
    else
        missing('message', 'no actual selected message-variable fact');
    const bindings = scopes.filter(row => row.scope !== 'cache').map(factBinding)
        .filter((value) => value !== null);
    // Each supplier was consumed synchronously above. The parent InputState
    // completes the capture and owns later DATA checks.
    input.assertOwnerCurrent();
    return { scopes: freeze(scopes), bindings: freeze(bindings), history: freeze(history),
        ...messageSelection ? { messageSelection: freeze(messageSelection) } : {},
        messageVariables: freeze(messageVariables), stateSnapshotSha256,
        evidence: freeze({ schemaVersion: pointSupplier ? 3 : selectedData ? 2 : 1, encoding: pointSupplier ? 'native-prompt-variable-selection-capture-v3' : selectedData ? 'native-selected-prompt-variable-scope-capture-v2' :
                'native-prompt-variable-scope-capture-v1', authority: 'consumer-data-only',
            ...selectedData ? { scopeReadDataSha256: selectedData.readDataSha256 } : {},
            policy, sourceSha256: source.sourceSha256, selectedBaseSha256: selected.sha256, evidence }) };
}
