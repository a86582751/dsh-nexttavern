// Generated from runtime/alpha3/src/core/roleplay-program-inherited-absence.ts; edit the TypeScript source.
/** Actual retained Native carrier facts for a Source-owned absence archive.
 * The original opening remains owned by its original Session. No Agent, fake
 * Session, Source owner or numerical genesis is reconstructed here. */
import { recordSha256 } from './roleplay-data.js';
import { validateProgramAbsenceOpeningClosureV1 } from './roleplay-program-absence-inheritance-data.js';
import { validateFrozenProgramAbsenceOpeningV1, assertFrozenProgramAbsenceOpeningCutV1 } from './roleplay-tavern-source-inheritance-data.js';
import { readInheritedProgramCardCopyNativeV1, readInheritedProgramGeneratedNativeObservationV1, readInheritedProgramCardCopyPublicationFactsV1, readInheritedProgramGeneratedPublicationFactsV1 } from './roleplay-program-native-reader.js';
function fail(code) { throw Error(code); }
const same = (a, b) => recordSha256(a) === recordSha256(b);
/** Stable Source/domain identity. Dynamic writer rows belong only to the
 * current inventory audit, otherwise an input would stale itself on its put. */
export function programInheritedAbsenceDomainSha256V1(data) {
    return recordSha256({ schemaVersion: 1, encoding: 'native-program-inherited-absence-domain-ref-v1',
        sessionId: data.sessionId, sourceInheritance: data.sourceInheritance,
        currentSourceIdentitySha256: data.currentSourceIdentitySha256,
        originalOpening: data.originalOpening, actualChildCut: data.actualChildCut });
}
export function createRoleplayProgramInheritedAbsenceReaderV1(deps) {
    // Only a successful current-carrier read by this factory can select the
    // factual closure. A detached packet or another factory's result cannot.
    const currentCarrierReads = new WeakMap();
    function readCarrier(childId, raw, cut, assertObservationCurrent, mode) {
        assertObservationCurrent();
        const packet = validateFrozenProgramAbsenceOpeningV1(raw);
        assertFrozenProgramAbsenceOpeningCutV1(packet, cut);
        if (packet.kind === 'not-inherited')
            return { kind: 'not-inherited' };
        const closure = validateProgramAbsenceOpeningClosureV1(packet.record.closure);
        return readValidatedCarrier(childId, packet, cut, closure, assertObservationCurrent, mode);
    }
    function readValidatedCarrier(childId, packet, cut, closure, assertObservationCurrent, mode) {
        const retained = mode === 'retained-publication' ? deps.retainedObservation(childId, cut) : undefined, currentObservation = mode === 'current-carrier' ? deps.observation(childId) : undefined, observation = retained?.observation ?? currentObservation;
        if (!observation)
            fail('PROGRAM_INHERITED_ABSENCE_CARRIER_MISSING');
        const { record } = packet, { seed, input, intent, absenceDomain, acknowledgement } = closure.data;
        if (cut.kind !== 'native-fork' || record.childSessionId !== childId
            || observation.id !== childId || observation.header.parentSession !== record.parentSessionId
            || Number(observation.inheritedEventCount) !== cut.seedLength
            || seed.sessionId !== closure.ownerSessionId || closure.ownerSessionId === childId) {
            fail('PROGRAM_INHERITED_ABSENCE_CARRIER_MISMATCH');
        }
        const assertCurrent = () => {
            assertObservationCurrent();
            if (retained) {
                retained.assertCurrent();
                return;
            }
            const current = deps.observation(childId);
            if (!current || current.id !== childId || current.header.parentSession !== record.parentSessionId
                || Number(current.inheritedEventCount) !== cut.seedLength || current.events.length < cut.seedLength
                || recordSha256(current.events.slice(0, cut.seedLength)) !== cut.prefixSha256) {
                fail('PROGRAM_INHERITED_ABSENCE_PREFIX_CHANGED');
            }
        };
        assertCurrent();
        const origin = { sessionId: closure.ownerSessionId, inheritedEventCount: input.basis.branch.inheritedEventCount }, sourceCut = { seedLength: cut.seedLength, prefixEncoding: 'record-sha256-native-events-prefix-v1',
            prefixSha256: cut.prefixSha256 };
        if (seed.production === 'selected-card-copy') {
            if (intent.committedTurn === undefined)
                fail('PROGRAM_INHERITED_ABSENCE_COPY_TURN_MISSING');
            const identity = { sessionId: closure.ownerSessionId, importId: seed.source.importId, operationId: seed.operationId,
                requestedMessageId: seed.requestedMessageId, renderedText: input.source.selected.renderedText,
                renderedSha256: input.source.selected.renderedSha256 }, base = { kind: 'inherited-opening-carrier-v1', origin, sourceCut, identity,
                acknowledgedTurn: intent.committedTurn, messageEdits: deps.messageEdits, assertCurrent }, actual = retained ? readInheritedProgramCardCopyPublicationFactsV1({ ...base, observation: retained.observation })
                : readInheritedProgramCardCopyNativeV1({ ...base, observation: currentObservation });
            if (actual.kind !== 'complete' || absenceDomain.nativeFacts.production !== 'selected-card-copy'
                || !same(actual.receipt, absenceDomain.nativeFacts.receipt)) {
                fail('PROGRAM_INHERITED_ABSENCE_COPY_CHANGED');
            }
        }
        else {
            if (input.instruction === null || seed.instructionSha256 === null || acknowledgement === null) {
                fail('PROGRAM_INHERITED_ABSENCE_GENERATION_PACKET_MISSING');
            }
            const identity = { kind: 'programmatic-opening', sessionId: closure.ownerSessionId,
                operationId: seed.operationId, messageId: seed.requestedMessageId, instruction: input.instruction,
                instructionSha256: seed.instructionSha256, intentRef: input.seedRef }, base = { kind: 'inherited-opening-carrier-v1', origin, sourceCut, identity,
                messageEdits: deps.messageEdits, assertCurrent }, actual = retained ? readInheritedProgramGeneratedPublicationFactsV1({ ...base,
                observation: { ...retained.observation, events: retained.observation.events,
                    deriveEventMessage: event => retained.observation.deriveEventMessage(event) },
                projections: retained.projections })
                : readInheritedProgramGeneratedNativeObservationV1({ ...base,
                    observation: { ...currentObservation, events: currentObservation.events,
                        deriveEventMessage: event => currentObservation.deriveEventMessage(event) },
                    projections: deps.projections(), deletedMessageIds: typeof currentObservation.deletedMessageIds === 'function'
                        ? currentObservation.deletedMessageIds() : currentObservation.deletedMessageIds, assertCurrent });
            if (actual.kind !== 'complete' || !actual.closingAck || absenceDomain.nativeFacts.production !== 'generated-opening'
                || !same(actual.receipt, absenceDomain.nativeFacts.receipt) || !same(actual.canonical, absenceDomain.nativeFacts.canonical)
                || !same(actual.generatedReceiptRef, acknowledgement.generatedReceiptRef)
                || !same(actual.closingAck.ref, acknowledgement.closingAckRef)
                || !same(actual.closingAck.data, acknowledgement.closingAck)) {
                fail('PROGRAM_INHERITED_ABSENCE_GENERATED_CHANGED');
            }
        }
        assertCurrent();
        return { kind: 'program-absence', packet, closure };
    }
    function read(childId, raw, cut, assertSourceFrameCurrent, mode = 'current-carrier') {
        const result = readCarrier(childId, raw, cut, assertSourceFrameCurrent, mode);
        if (mode === 'current-carrier' && result.kind === 'program-absence') {
            currentCarrierReads.set(result, { childId, packet: result.packet, cut, closure: result.closure,
                cutSha256: recordSha256(cut) });
        }
        return result;
    }
    function captureCurrentCarrierOwnerFacts(result, assertArchiveFactsCurrent) {
        const captured = currentCarrierReads.get(result);
        if (!captured || result.kind !== 'program-absence' || result.packet !== captured.packet || result.closure !== captured.closure
            || recordSha256(captured.cut) !== captured.cutSha256) {
            fail('PROGRAM_INHERITED_ABSENCE_FACT_OWNER_REQUIRED');
        }
        const closureSha256 = captured.closure.closureSha256;
        const assertOwnerFactsCurrent = () => {
            assertArchiveFactsCurrent();
            if (currentCarrierReads.get(result) !== captured || result.kind !== 'program-absence'
                || result.packet !== captured.packet || result.closure !== captured.closure
                || recordSha256(captured.cut) !== captured.cutSha256)
                fail('PROGRAM_INHERITED_ABSENCE_FACT_CAPTURE_CHANGED');
            // This is the current child carrier, including its suffix, edits/deletes
            // and generated ACK. Retained-publication can never replace this read.
            // Only immutable grammar is reused. Root freshly checks the complete
            // archive/refs; every call rebuilds the current Native surface and ACK.
            if (captured.packet.kind !== 'program-absence')
                fail('PROGRAM_INHERITED_ABSENCE_FACT_CAPTURE_CHANGED');
            const actual = readValidatedCarrier(captured.childId, captured.packet, captured.cut, captured.closure, assertArchiveFactsCurrent, 'current-carrier');
            if (actual.closure.closureSha256 !== closureSha256)
                fail('PROGRAM_INHERITED_ABSENCE_FACT_CLOSURE_CHANGED');
            assertArchiveFactsCurrent();
        };
        // The minting read just checked the full current carrier. Capture adds no
        // await or write; later factual consumption rechecks Native in full.
        assertArchiveFactsCurrent();
        return { assertOwnerFactsCurrent };
    }
    return { read, captureCurrentCarrierOwnerFacts };
}
