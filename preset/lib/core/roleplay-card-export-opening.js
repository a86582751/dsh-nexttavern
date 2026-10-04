// Generated from runtime/alpha3/src/core/roleplay-card-export-opening.ts; edit the TypeScript source.
/** Read-only export DATA. Source/current Session ownership is bracketed by Core;
 * original Native audit and current prose are deliberately separate reads. */
import { inspectNativeOpeningGenerationObservationV1, inspectInheritedOpeningGenerationObservationV1, nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256, sha256 } from './roleplay-data.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { programOpeningRecordDataV1, validateProgramOpeningSeedV1 } from './roleplay-program-opening-records.js';
import { verifyProgrammaticCardCopyOriginalAuditSpanV1 } from './roleplay-program-copy-span.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && !Object.is(value, -0);
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const same = (left, right) => recordSha256(left) === recordSha256(right);
const blocked = (code) => ({ kind: 'blocked', code });
function requireData(condition, code) { if (!condition)
    throw Error(code); }
function ref(input) {
    requireData(object(input) && typeof input.key === 'string' && input.key.length > 0 && hash(input.sha256), 'CARD_EXPORT_OPENING_REFERENCE_INVALID');
    return Object.freeze({ key: input.key, sha256: input.sha256 });
}
/** Session/pointer differ for an inherited carrier. These immutable import
 * bytes must still identify the exact Source retained by the current owner. */
function importTuple(source) {
    return { importId: source.importId, sourceRecordSessionId: source.sourceRecordSessionId, rawSha256: source.rawSha256,
        normalizedSha256: source.normalizedSha256, transactionId: source.transactionId, coverageSha256: source.coverageSha256 };
}
function validSource(source) {
    const pointer = source.pointer;
    return id(source.sessionId) && id(source.importId) && id(source.sourceRecordSessionId) && id(source.transactionId)
        && hash(source.rawSha256) && hash(source.normalizedSha256) && hash(source.coverageSha256) && object(pointer)
        && pointer['importId'] === source.importId && pointer['normalizedSha256'] === source.normalizedSha256
        && pointer['transactionId'] === source.transactionId && pointer['coverageSha256'] === source.coverageSha256
        && (pointer['sourceRecordSessionId'] ?? source.sessionId) === source.sourceRecordSessionId;
}
function candidates(input) {
    const { observation, source, inherited } = input, origins = [{ sessionId: observation.id, inheritedEventCount: observation.inheritedEventCount }, ...inherited?.origins ?? []];
    requireData(new Set(origins.map(origin => origin.sessionId)).size === origins.length, 'CARD_EXPORT_OPENING_ORIGIN_AMBIGUOUS');
    const result = [];
    for (const origin of origins) {
        requireData(id(origin.sessionId) && integer(origin.inheritedEventCount), 'CARD_EXPORT_OPENING_ORIGIN_INVALID');
        const key = openingIntentKey(origin.sessionId, source.importId), raw = input.branch.get(key);
        if (raw === undefined)
            continue;
        const intent = programOpeningRecordDataV1(raw);
        if (origin.sessionId !== observation.id) {
            // A Source-only ancestor is not a Native carrier candidate. In two forks,
            // the intermediate parent's inherited prefix must not count as its own
            // original opening, and a fresh reservation's zero cut inherits no work.
            const inCut = observation.events.slice(origin.inheritedEventCount, inherited.cut.seedLength), hasNative = inCut.some(event => event.type === 'turn/start'
                && event.data.programmatic?.origin === `card-opening:${source.importId}`
                && (!object(intent) || event.data.programmatic.operationId === intent['operationId']
                    || event.data.programmatic.messageId === intent['messageId'])
                || event.type === 'opening/invocation' && event.data.identity.sessionId === origin.sessionId
                    && (!object(intent) || event.data.identity.operationId === intent['operationId']
                        || event.data.identity.messageId === intent['messageId']));
            if (!hasNative)
                continue;
        }
        requireData(object(intent) && object(intent['source']) && validSource(intent['source'])
            && intent['sessionId'] === origin.sessionId && intent['source']['sessionId'] === origin.sessionId
            && same(importTuple(intent['source']), importTuple(source))
            && (origin.sessionId !== observation.id || same(intent['source'], source)), 'CARD_EXPORT_OPENING_SOURCE_CHANGED');
        result.push({ intent, key, origin });
    }
    return result;
}
function selectedIntent(input, candidate) {
    const { intent, origin } = candidate, version = intent['schemaVersion'];
    requireData(integer(version) && version >= 2 && version <= 7 && intent['status'] === 'completed'
        && id(intent['operationId']) && id(intent['messageId']) && integer(intent['committedTurn'])
        && integer(intent['revision']) && intent['revision'] > 0 && integer(intent['index'])
        && typeof intent['sourcePointer'] === 'string' && intent['sourcePointer'].startsWith('/')
        && intent['sourcePointer'].length <= 512 && hash(intent['sourceSha256']) && typeof intent['renderedText'] === 'string'
        && intent['renderedText'].isWellFormed() && (version === 2 || intent['textRetained'] === true)
        && Buffer.byteLength(intent['renderedText'], 'utf8') <= 65_536 && hash(intent['renderedSha256'])
        && sha256(intent['renderedText']) === intent['renderedSha256'], 'CARD_EXPORT_OPENING_INTENT_INCOMPLETE');
    if (version === 7) {
        requireData(object(intent['seedRef']), 'CARD_EXPORT_OPENING_SEED_MISSING');
        const seedRef = ref(intent['seedRef']), raw = input.branch.get(seedRef.key);
        requireData(raw !== undefined && recordSha256(raw) === seedRef.sha256, 'CARD_EXPORT_OPENING_SEED_CHANGED');
        const seed = validateProgramOpeningSeedV1(raw);
        requireData(seed.sessionId === origin.sessionId && same(seed.source, intent['source'])
            && seed.operationId === intent['operationId'] && seed.requestedMessageId === intent['messageId']
            && seed.production === intent['production'] && seed.selected.index === intent['index']
            && seed.selected.sourcePointer === intent['sourcePointer'] && seed.selected.sourceSha256 === intent['sourceSha256']
            && seed.selected.renderedSha256 === intent['renderedSha256'], 'CARD_EXPORT_OPENING_SEED_IDENTITY_CHANGED');
        return { production: seed.production, seedRef, instructionSha256: seed.instructionSha256 };
    }
    return { production: 'selected-card-copy', seedRef: undefined, instructionSha256: null };
}
function storedNativeReceipt(intent) {
    if (intent['schemaVersion'] === 2)
        return undefined;
    const native = intent['nativeReceipt'];
    requireData(object(native), 'CARD_EXPORT_OPENING_RECEIPT_MISSING');
    if (intent['schemaVersion'] !== 7)
        return native;
    const { factsSha256, ...body } = native;
    requireData(native['schemaVersion'] === 1 && native['encoding'] === 'native-program-opening-native-facts-v1'
        && native['production'] === intent['production'] && hash(factsSha256) && recordSha256(body) === factsSha256, 'CARD_EXPORT_OPENING_RECEIPT_INVALID');
    return native['receipt'];
}
function currentBody(input, event) {
    requireData(event.type === 'assistant/message', 'CARD_EXPORT_OPENING_MESSAGE_MISSING');
    const message = event.data.message, messageId = String(message.id), events = input.observation.events;
    requireData(events.filter(row => {
        if (row.type === 'user/message')
            return String(row.data.id) === messageId;
        const data = row.data;
        return ['assistant/message', 'system/message', 'developer/message', 'tool/result'].includes(row.type)
            && object(data) && object(data['message']) && String(data['message']['id']) === messageId;
    }).length === 1
        && input.observation.surfaceNodes.filter(seq => seq === event.seq).length === 1
        && !input.deletedMessageIds.includes(messageId), 'CARD_EXPORT_OPENING_MESSAGE_NOT_VISIBLE');
    const projected = input.observation.deriveEventMessage(event);
    requireData(object(projected) && projected['id'] === message.id && projected['role'] === 'assistant'
        && same(projected['source'], message.source) && Array.isArray(projected['content']), 'CARD_EXPORT_OPENING_PROJECTION_UNSUPPORTED');
    const texts = [];
    for (const block of projected['content']) {
        requireData(object(block) && typeof block['type'] === 'string', 'CARD_EXPORT_OPENING_PROJECTION_UNSUPPORTED');
        if (block['type'] === 'text') {
            requireData(typeof block['text'] === 'string', 'CARD_EXPORT_OPENING_PROJECTION_UNSUPPORTED');
            texts.push(block['text']);
        }
    }
    const text = texts.join('');
    // Original copy commits retain Native's byte bound. A later legitimate
    // message edit uses the existing branch route's one-million-character bound.
    requireData(text.isWellFormed() && text.length <= 1_000_000, 'CARD_EXPORT_OPENING_BODY_INVALID');
    return { text, currentMessageSha256: recordSha256(projected), currentTextSha256: sha256(text) };
}
/** Pure DATA only: no live owner, Source authority, saved readiness or grant.
 * Missing selected work fails closed; only genuine absence returns `none`. */
export function readNativeCardOpeningExportV1(input) {
    try {
        const { observation, source, inherited } = input, events = observation.events;
        requireData(validSource(source) && source.sessionId === observation.id && id(observation.id)
            && observation.header && (!Object.hasOwn(observation.header, 'id') || observation.header.id === observation.id)
            && integer(observation.inheritedEventCount) && observation.inheritedEventCount <= events.length
            && events.every((event, index) => integer(event.seq) && event.seq === index)
            && typeof observation.deriveEventMessage === 'function' && Array.isArray(observation.surfaceNodes)
            && Array.isArray(input.deletedMessageIds) && Array.isArray(input.projections), 'CARD_EXPORT_OPENING_OBSERVATION_INVALID');
        const importRecordRef = ref(input.importRecordRef), cutRefs = inherited?.inheritanceRefs.map(ref) ?? [];
        if (inherited) {
            const cut = inherited.cut;
            requireData(typeof observation.header.parentSession === 'string' && observation.header.parentSession.length > 0
                && observation.header.parentSession !== observation.id
                && integer(cut.seedLength) && cut.seedLength > 0 && cut.seedLength === observation.inheritedEventCount
                && cut.seedLength <= events.length && cut.prefixEncoding === 'record-sha256-native-events-prefix-v1'
                && hash(cut.prefixSha256) && recordSha256(events.slice(0, cut.seedLength)) === cut.prefixSha256
                && inherited.origins.length > 0 && cutRefs.length > 0, 'CARD_EXPORT_OPENING_INHERITED_CUT_CHANGED');
        }
        const found = candidates(input);
        if (!found.length) {
            // A lost intent must not turn an existing Native opening into default text.
            const nativeWork = events.some(event => event.type === 'turn/start'
                && event.data.programmatic?.origin === `card-opening:${source.importId}`
                || event.type === 'opening/invocation' && (() => {
                    const seed = input.branch.get(event.data.identity.intentRef.key);
                    return !object(seed) || !object(seed['source']) || seed['source']['importId'] === source.importId;
                })());
            return nativeWork ? blocked('CARD_EXPORT_OPENING_INTENT_MISSING') : { kind: 'none' };
        }
        requireData(found.length === 1, 'CARD_EXPORT_OPENING_SELECTION_AMBIGUOUS');
        const candidate = found[0], { intent, origin } = candidate, selected = selectedIntent(input, candidate), savedReceipt = storedNativeReceipt(intent), isInherited = origin.sessionId !== observation.id;
        if (isInherited)
            requireData(inherited && origin.inheritedEventCount < inherited.cut.seedLength, 'CARD_EXPORT_OPENING_ORIGIN_OUTSIDE_CUT');
        let event, receiptRefs, originalTextSha256;
        if (selected.production === 'selected-card-copy') {
            requireData(!events.some(row => row.type === 'opening/invocation'
                && (row.data.identity.operationId === intent['operationId'] || row.data.identity.messageId === intent['messageId'])), 'CARD_EXPORT_OPENING_PRODUCTION_CONFLICT');
            const audited = verifyProgrammaticCardCopyOriginalAuditSpanV1({
                identity: { sessionId: origin.sessionId, importId: source.importId, operationId: intent['operationId'],
                    requestedMessageId: intent['messageId'], renderedText: intent['renderedText'],
                    renderedSha256: intent['renderedSha256'] }, acknowledgedTurn: intent['committedTurn'],
                observation: { events: events, inheritedEventCount: origin.inheritedEventCount }
            });
            if (audited.kind !== 'matched')
                return blocked(audited.code);
            requireData(!isInherited || audited.facts.turnEndSeq < inherited.cut.seedLength, 'CARD_EXPORT_OPENING_COPY_OUTSIDE_CUT');
            requireData(savedReceipt === undefined || same(savedReceipt, { ...audited.facts, flushed: true }), 'CARD_EXPORT_OPENING_COPY_RECEIPT_CHANGED');
            event = events[audited.facts.assistantSeq];
            originalTextSha256 = audited.facts.renderedSha256;
            receiptRefs = [audited.facts.turnStartSeq, audited.facts.assistantSeq, audited.facts.turnEndSeq]
                .map(seq => ({ seq, sha256: recordSha256(events[seq]) }));
        }
        else {
            const invocations = events.filter((event) => event.type === 'opening/invocation'
                && (event.data.identity.operationId === intent['operationId'] || event.data.identity.messageId === intent['messageId']));
            requireData(invocations.length === 1, 'CARD_EXPORT_OPENING_GENERATION_AMBIGUOUS');
            const identity = invocations[0].data.identity;
            requireData(identity.sessionId === origin.sessionId && identity.operationId === intent['operationId']
                && identity.messageId === intent['messageId'] && same(identity.intentRef, selected.seedRef)
                && identity.instructionSha256 === selected.instructionSha256, 'CARD_EXPORT_OPENING_GENERATION_IDENTITY_CHANGED');
            const inspected = isInherited ? inspectInheritedOpeningGenerationObservationV1({ kind: 'inherited-opening-carrier-v1',
                carrier: observation, origin, cut: { seedLength: inherited.cut.seedLength,
                    prefixEncoding: 'native-input-sha256-events-prefix-v1',
                    prefixSha256: nativeInputSha256(events.slice(0, inherited.cut.seedLength)) } }, identity, input.projections)
                : inspectNativeOpeningGenerationObservationV1(observation, identity, input.projections);
            if (inspected.kind !== 'complete')
                return blocked(inspected.kind === 'unknown' ? inspected.code : 'CARD_EXPORT_OPENING_GENERATION_MISSING');
            requireData(inspected.receiptEvent && inspected.closingAck, 'CARD_EXPORT_OPENING_GENERATION_UNCLOSED');
            const receipt = inspected.receipt, receiptEvent = inspected.receiptEvent, ack = inspected.closingAck;
            requireData(same(savedReceipt, receipt) && receipt.turn === intent['committedTurn']
                && events.filter(row => row.type === 'opening/generated-receipt'
                    && (row.data.identity.operationId === identity.operationId || row.data.identity.messageId === identity.messageId)).length === 1
                && events.filter(row => row.type === 'opening/closing-ack'
                    && same(row.data.invocationRef, receipt.invocationRef)).length === 1
                && !events.some(row => row.type === 'turn/start' && row.data.programmatic?.operationId === identity.operationId), 'CARD_EXPORT_OPENING_GENERATION_DUPLICATE');
            event = events[receipt.terminalOutput.eventRef.seq];
            originalTextSha256 = receipt.terminalOutput.textSha256;
            receiptRefs = [inspected.invocation, receiptEvent, ack].map(row => ({ seq: row.seq, sha256: nativeInputSha256(row) }));
        }
        const current = currentBody(input, event), originalMessage = event.type === 'assistant/message' ? event.data.message : undefined, provenance = programOpeningRecordDataV1({ schemaVersion: 1, encoding: 'native-card-opening-export-source-v1',
            authority: 'consumer-data-only',
            production: selected.production, importTuple: importTuple(source), carrierSessionId: observation.id,
            originSessionId: origin.sessionId, operationId: intent['operationId'], messageId: originalMessage?.id,
            selected: { index: intent['index'], sourcePointer: intent['sourcePointer'], sourceSha256: intent['sourceSha256'],
                renderedSha256: intent['renderedSha256'] },
            selectedMessageId: intent['messageId'], originalEventSha256: recordSha256(event),
            originalMessageSha256: recordSha256(originalMessage), originalTextSha256,
            currentMessageSha256: current.currentMessageSha256, currentTextSha256: current.currentTextSha256,
            importRecordRef, intentRef: { key: candidate.key, sha256: recordSha256(intent) }, receiptRefs,
            ...selected.seedRef ? { seedRef: selected.seedRef } : {},
            ...isInherited ? { inheritanceCut: inherited.cut, inheritanceRefs: cutRefs } : {} });
        return Object.freeze({ kind: 'ready', text: current.text, source: provenance });
    }
    catch (error) {
        return blocked(error instanceof Error && error.message.startsWith('CARD_EXPORT_')
            ? error.message : 'CARD_EXPORT_OPENING_DATA_INVALID');
    }
}
