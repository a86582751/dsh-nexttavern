// Generated from runtime/alpha3/src/core/roleplay-opening-variant-activation.ts; edit the TypeScript source.
/** Activation retains a detached execution history as immutable DATA. The
 * child's Native prefix and its current Source permission remain independent. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { createImmutableDescriptorValidator } from './roleplay-mvu-schema-descriptor-data.js';
import { freezeMvuSchemaStoryData, validateMvuSchemaNumericalSnapshot, sealMvuSchemaStoryFact } from './roleplay-mvu-schema-story-types.js';
import { schemaEpochExecution } from './roleplay-mvu-schema-journal.js';
import { validateSchemaGuestOutputForParsedProgramV4 } from './tavern-mvu-schema-runner-v4.js';
import { validateOpeningVariantSet } from './roleplay-opening-variant-types.js';
export const openingVariantActivationPacketKey = (sid, id) => `${sid}__opening-variant-activation-packet-${id}`;
export const openingVariantActivationSeedKey = (sid) => `${sid}__opening-variant-activation-seed`;
export const openingVariantArchiveKey = (sid) => `${sid}__opening-variant-archive`;
const validateArchive = createImmutableDescriptorValidator((input) => {
    const archive = freezeMvuSchemaStoryData(input), { archiveSha256, ...body } = archive;
    if (archive.schemaVersion !== 1 || archive.encoding !== 'native-opening-variant-archive-v1'
        || recordSha256(body) !== archiveSha256)
        fail();
    return archive;
});
/** Each subject owns either live addresses or its retained immutable DATA.
 * Ancestor live tables are never a fallback for a missing retained fact. */
export function createOpeningVariantDataReader(read, inherited) {
    const indexes = new WeakMap();
    return (sid, key) => {
        if (key.startsWith(sid + '__'))
            return read(key);
        const raw = read(openingVariantArchiveKey(sid));
        if (raw !== undefined) {
            let index = indexes.get(raw);
            if (!index) {
                const archive = validateArchive(raw);
                if (archive.sessionId !== sid)
                    fail();
                index = new Map(archive.records.map(row => [row.ref.key, row.value]));
                indexes.set(raw, index);
            }
            if (index.has(key))
                return index.get(key);
        }
        return inherited?.(sid, key);
    };
}
export const openingVariantActivationEventKey = (sid) => `${sid}__mvu-state-opening-variant-activation-event`;
export const openingVariantForkOperationId = (sid, id) => 'opening-variant-' + recordSha256({ sessionId: sid, operationId: id });
function fail() { throw Error('OPENING_VARIANT_CONTINUATION_UNPROVEN'); }
export const validateOpeningVariantDonor = createImmutableDescriptorValidator((input) => {
    const donor = freezeMvuSchemaStoryData(input), { donorSha256, ...body } = donor;
    if (donor.schemaVersion !== 1 || donor.encoding !== 'native-opening-variant-donor-v1'
        || recordSha256(body) !== donorSha256 || donor.epoch.sessionId !== donor.original.sessionId
        || donor.epoch.realmEpoch !== donor.original.realmEpoch || !donor.prefix.length
        || donor.snapshot.sessionId !== donor.sessionId)
        fail();
    return donor;
});
const validateContinuation = createImmutableDescriptorValidator((input) => {
    const continuation = freezeMvuSchemaStoryData(input), { sha256, ...body } = continuation;
    if (continuation.schemaVersion !== 1 || continuation.encoding !== 'opening-variant-continuation-v1'
        || recordSha256(body) !== sha256)
        fail();
    return continuation;
});
export const validateOpeningVariantActivationPacket = createImmutableDescriptorValidator((input) => {
    const packet = freezeMvuSchemaStoryData(input), { packetSha256, ...body } = packet;
    if (packet.schemaVersion !== 1 || packet.encoding !== 'native-opening-variant-activation-packet-v1'
        || recordSha256(body) !== packetSha256 || packet.parentSessionId !== packet.source.sessionId
        || sha256(packet.renderedText) !== packet.renderedSha256)
        fail();
    return packet;
});
export const validateOpeningVariantActivationSeed = createImmutableDescriptorValidator((input) => {
    const seed = freezeMvuSchemaStoryData(input), { seedSha256, ...body } = seed, event = seed.event, { eventSha256, ...eventBody } = event, snapshot = validateMvuSchemaNumericalSnapshot(seed.snapshot);
    if (seed.schemaVersion !== 1 || seed.encoding !== 'native-opening-variant-activation-seed-v1'
        || recordSha256(body) !== seedSha256 || event.schemaVersion !== 1
        || event.encoding !== 'native-opening-variant-activation-event-v1' || recordSha256(eventBody) !== eventSha256
        || event.sessionId !== seed.sessionId || snapshot.sessionId !== seed.sessionId
        || event.parentSessionId !== seed.parentSessionId || event.operationId !== seed.operationId
        || event.native.sessionId !== seed.sessionId || event.native.flushed !== true
        || recordSha256(seed.head) !== snapshot.headSha256 || recordSha256(event.values) !== event.valuesSha256
        || recordSha256(seed.head) !== recordSha256(snapshot.currentHead)
        || seed.head.eventId !== event.eventId || seed.head.eventSha256 !== eventSha256
        || seed.head.valuesSha256 !== event.valuesSha256 || snapshot.valuesSha256 !== event.valuesSha256
        || recordSha256(snapshot.context) !== recordSha256(event.context)
        || recordSha256(event.frontier) !== recordSha256(snapshot.schemaFrontier))
        fail();
    return seed;
});
/** Frozen-prefix callers supply their own tracked archive reader. Reading the
 * same immutable facts through it enrolls donor dependencies in later forks. */
export function createOpeningVariantContinuationReader(read) {
    const baselines = new WeakMap(), facts = new WeakMap();
    function datum(raw, validate) {
        if (!raw || typeof raw !== 'object')
            fail();
        const known = facts.get(raw);
        if (known)
            return known;
        // These owner-written addresses are immutable. A new Domain value object
        // receives a fresh admission, while repeated reads share the owned clone.
        const admitted = { sha256: recordSha256(raw), value: validate(raw) };
        facts.set(raw, admitted);
        return admitted;
    }
    function fact(ref, validate) {
        const admitted = datum(read(ref.key), validate);
        if (admitted.sha256 !== ref.sha256)
            fail();
        return admitted.value;
    }
    function capture(ref) {
        const continuation = fact(ref, validateContinuation), donor = fact(continuation.donorRef, validateOpeningVariantDonor);
        let baseline = baselines.get(continuation);
        if (!baseline) {
            const { frameSha256, ...receipt } = continuation.record, frame = { ...continuation.requested.frame, material: donor.material }, step = { ...receipt, frame }, previous = donor.prefix.at(-1), { stepSha256, ...stepBody } = step, execution = schemaEpochExecution(donor.epoch);
            if (step.eventId !== continuation.requested.eventId || frameSha256 !== recordSha256(frame)
                || step.ordinal !== donor.prefix.length + 1 || step.previousStepSha256 !== previous.stepSha256
                || recordSha256(stepBody) !== stepSha256 || step.output.kind !== 'accepted'
                || step.frame.input.phase !== 'external-pack-replacement')
                fail();
            validateSchemaGuestOutputForParsedProgramV4(step.output, execution.program, step.frame.input);
            const objects = new Map();
            for (const object of [...donor.scopeObjects, ...continuation.scopeObjects]) {
                const ref = object.ref, key = JSON.stringify([ref.ownerSessionId, ref.key, ref.sha256]);
                if (!objects.has(key))
                    objects.set(key, object);
            }
            const prefix = Object.freeze([...donor.prefix, step]), ids = new Set(prefix.map(row => row.eventId));
            baseline = Object.freeze({ ref, epoch: donor.epoch, length: prefix.length, tailSha256: stepSha256,
                scopeObjects: Object.freeze([...objects.values()]), hasEvent: (id) => ids.has(id), materialize: () => prefix });
            baselines.set(continuation, baseline);
        }
        return { donor, continuation, baseline };
    }
    function readSeed(sid, selected) {
        const key = openingVariantActivationSeedKey(sid), raw = read(key);
        if (raw === undefined)
            return;
        const admitted = datum(raw, validateOpeningVariantActivationSeed), seed = admitted.value;
        if (seed.sessionId !== sid || selected && (selected.key !== key || selected.sha256 !== admitted.sha256))
            fail();
        const packet = fact(seed.packetRef, validateOpeningVariantActivationPacket), continuation = capture(seed.event.continuationRef);
        if (packet.parentSessionId !== seed.parentSessionId || packet.operationId !== seed.operationId
            || recordSha256(packet.continuationRef) !== recordSha256(seed.event.continuationRef)
            || seed.head.planSha256 !== packet.packetSha256 || seed.event.realmEpoch !== continuation.donor.epoch.realmEpoch
            || seed.event.native.renderedSha256 !== packet.renderedSha256)
            fail();
        return { seed, packet, ...continuation, ref: { key, sha256: admitted.sha256 } };
    }
    function captureSet(ref) {
        const records = new Map();
        function retain(selected, validate) {
            const identity = JSON.stringify([selected.key, selected.sha256]), known = records.get(identity);
            if (known)
                return known.value;
            const value = fact(selected, validate);
            records.set(identity, { ref: selected, value });
            return value;
        }
        const set = retain(ref, validateOpeningVariantSet);
        for (const entry of set.entries)
            if (entry.continuation) {
                const continuation = retain(entry.continuation, validateContinuation);
                retain(continuation.donorRef, validateOpeningVariantDonor);
            }
        return { set, records: [...records.values()] };
    }
    return { capture, captureSet, readSeed, resolve: (ref) => capture(ref).baseline };
}
/** The parent Bank hands off before this coordinator starts. Each durable
 * phase keeps the same child identity through lost Native or Domain ACKs. */
export function createOpeningVariantActivation(deps) {
    const intentKey = (sid, id) => `${sid}__opening-variant-activation-intent-${id}`;
    const operationKey = (id) => `fork-op-${id}`;
    async function put(key, value) {
        try {
            await deps.branch.put(key, value);
        }
        catch { /* Confirm the exact owner output after an ACK loss. */ }
        if (recordSha256(deps.branch.get(key)) !== recordSha256(value))
            throw Error('OPENING_VARIANT_ACTIVATION_WRITE_UNKNOWN');
    }
    function readIntent(key) {
        const raw = deps.branch.get(key);
        if (raw === undefined)
            return;
        const intent = freezeMvuSchemaStoryData(raw), { intentSha256, ...body } = intent;
        if (intent.schemaVersion !== 1 || intent.encoding !== 'native-opening-variant-activation-intent-v1'
            || recordSha256(body) !== intentSha256)
            throw Error('OPENING_VARIANT_ACTIVATION_INTENT_UNPROVEN');
        return intent;
    }
    async function activate(handoff, authorizeParent) {
        const { operation, packetRef } = handoff, key = intentKey(operation.sessionId, operation.operationId), forkId = openingVariantForkOperationId(operation.sessionId, operation.operationId);
        return deps.withLock(`opening-variant:${operation.sessionId}:${operation.operationId}`, async () => {
            await authorizeParent();
            const packet = validateOpeningVariantActivationPacket(deps.branch.get(packetRef.key));
            if (recordSha256(packet) !== packetRef.sha256 || packet.operationSha256 !== operation.operationSha256)
                throw Error('OPENING_VARIANT_ACTIVATION_PACKET_UNPROVEN');
            let intent = readIntent(key);
            if (intent && recordSha256(intent.packetRef) !== recordSha256(packetRef))
                throw Error('OPENING_VARIANT_ACTIVATION_PACKET_CHANGED');
            if (!intent) {
                intent = sealMvuSchemaStoryFact({ schemaVersion: 1, encoding: 'native-opening-variant-activation-intent-v1',
                    parentSessionId: operation.sessionId, operationId: operation.operationId, packetRef, reservation: null,
                    phase: 'prepared', nativeTurn: null, seedRef: null }, 'intentSha256');
                await put(key, intent);
            }
            if (intent.phase === 'completed') {
                if (!intent.reservation || !intent.seedRef || !deps.reservationCurrent(intent.reservation, forkId)
                    || recordSha256(deps.branch.get(intent.seedRef.key)) !== intent.seedRef.sha256)
                    throw Error('OPENING_VARIANT_ACTIVATION_COMPLETION_UNPROVEN');
                return { sessionId: intent.reservation.childSessionId };
            }
            const parent = await deps.resolve(packet.parentSessionId);
            if (!parent)
                throw Error('OPENING_VARIANT_PARENT_UNAVAILABLE');
            const original = parent.session.snapshotEvents()[packet.opening.nativeSeq];
            if (original?.type !== 'assistant/message' || original.data.message.id !== packet.opening.messageId
                || recordSha256(original.data.message) !== packet.opening.messageVersionSha256)
                throw Error('OPENING_VARIANT_OPENING_UNPROVEN');
            let branch = deps.branch.get(operationKey(forkId));
            if (!branch) {
                if (!packet.source.transactionId)
                    throw Error('OPENING_VARIANT_SOURCE_UNPROVEN');
                branch = { schemaVersion: 2, operationId: forkId, kind: 'opening-variant', promptText: '',
                    anchor: { sourceSessionId: packet.parentSessionId, sourceAssistantMessageId: packet.opening.messageId,
                        sourceAssistantSeq: packet.opening.nativeSeq, sourceAssistantTurn: original.data.turn,
                        sourceTurn: original.data.turn, previousTurnEndSeq: null, nativeForkBeforeFirst: true, expectedSeedLength: 0,
                        promptText: '', openingOnly: true, openingSource: { schemaVersion: 1, importId: packet.source.importId,
                            normalizedSha256: packet.source.normalizedSha256, transactionId: packet.source.transactionId,
                            renderedSha256: sha256(original.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('')) } },
                    state: 'prepared', consumed: false, createdAt: Date.now(), expiresAt: Number.MAX_SAFE_INTEGER };
                await put(operationKey(forkId), branch);
            }
            const created = await deps.forkBeforeFirst({ sessionId: packet.parentSessionId,
                ...(intent.reservation ? { resume: intent.reservation } : {}) }, async (reservation) => {
                await authorizeParent();
                if (intent.reservation && recordSha256(intent.reservation) !== recordSha256(reservation))
                    throw Error('OPENING_VARIANT_RESERVATION_CHANGED');
                // Fix child/workspace before any Source await. A failed reservation
                // resumes this address even when Native has not published a child yet.
                if (!intent.reservation) {
                    const { intentSha256: _prior, ...body } = intent;
                    intent = sealMvuSchemaStoryFact({ ...body, reservation, phase: 'reserved' }, 'intentSha256');
                    await put(key, intent);
                }
                branch = { ...branch, reservedChildSessionId: reservation.childSessionId, state: 'preparing-opening-variant' };
                await put(operationKey(forkId), branch);
                await deps.prepareSource(branch, reservation);
            });
            const reservation = intent.reservation;
            if (!reservation || created.sessionId !== reservation.childSessionId)
                throw Error('OPENING_VARIANT_RESERVATION_CHANGED');
            const actual = await deps.resolve(created.sessionId);
            if (!actual || actual.session.header.parentSession !== packet.parentSessionId || actual.session.inheritedEventCount !== 0)
                throw Error('OPENING_VARIANT_CHILD_UNAVAILABLE');
            await deps.bootstrap(branch, actual.session, packet);
            await authorizeParent();
            const literal = { operationId: packet.operationId, messageId: `opening-variant-${packet.operationId}`, text: packet.renderedText,
                source: { kind: 'programmatic', schemaVersion: 1, producer: 'dsh-nexttavern',
                    origin: `card-opening:${packet.source.importId}`, operationId: packet.operationId } }, lookup = await actual.agent.lookupProgrammaticAssistantCommit(literal);
            let turn;
            if (lookup.status === 'committed')
                turn = lookup.turn;
            else {
                if (lookup.status !== 'absent')
                    throw Error('OPENING_VARIANT_NATIVE_PENDING');
                const committed = await actual.agent.commitProgrammaticAssistant(literal);
                if (committed.kind !== 'committed')
                    throw Error('OPENING_VARIANT_NATIVE_PENDING');
                turn = committed.turn;
            }
            const { intentSha256: _prior, ...body } = intent;
            intent = sealMvuSchemaStoryFact({ ...body, phase: 'native-committed', nativeTurn: turn }, 'intentSha256');
            await put(key, intent);
            const native = deps.readNativeReceipt(packet, actual.session, turn), checkReservation = () => {
                if (!deps.reservationCurrent(reservation, forkId))
                    throw Error('OPENING_VARIANT_RESERVATION_CHANGED');
            };
            checkReservation();
            await authorizeParent();
            const seed = await deps.publishChild(packetRef, packet, actual.session, native, checkReservation);
            await authorizeParent();
            checkReservation();
            await deps.publishNavigation(branch, actual.session, seed);
            const { intentSha256: _committed, ...committedBody } = intent;
            intent = sealMvuSchemaStoryFact({ ...committedBody, phase: 'completed',
                seedRef: { key: openingVariantActivationSeedKey(actual.session.id), sha256: recordSha256(seed) } }, 'intentSha256');
            await put(key, intent);
            return { sessionId: actual.session.id };
        });
    }
    return { activate };
}
