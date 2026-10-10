// Generated from runtime/alpha3/src/core/roleplay-tavern-source-edit-baseline.ts; edit the TypeScript source.
/** Frozen published lore journals. Ancestor heads are historical data: their
 * later mutable head rows are never consulted, and their events keep identity. */
import { recordSha256 } from './roleplay-data.js';
import { genesis, parseHead, parseEvent, nextHead, eventKey, rowRef } from './roleplay-tavern-lore-edits-data.js';
import { inheritanceDataV1, inheritanceExactV1, inheritanceFailV1, inheritanceFreezeV1, inheritanceHashV1, inheritanceIdV1, inheritanceSameV1, validateInheritanceRefV1, sealInheritanceDataV1, TAVERN_SOURCE_INHERITANCE_BOUNDS_V1, tavernSourcePreparedKeyV1, tavernSourceEditBaselineKeyV1, } from './roleplay-tavern-source-inheritance-data.js';
function overlayForLayer(layer) {
    const edited = new Map();
    for (const { value: event, ref: eventRef } of layer.events) {
        // Membership events remain in the frozen publication sequence. Their
        // materialization belongs to the same member fold as the child's locals.
        const request = event.request;
        if ('mutation' in request)
            continue;
        const previous = edited.get(request.rawEntryPointer);
        if (previous && previous.rawEntrySha256 !== request.rawEntrySha256)
            inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
        edited.set(request.rawEntryPointer, { rawEntrySha256: request.rawEntrySha256,
            fields: { ...previous?.fields, ...request.fields }, events: [...(previous?.events ?? []), eventRef] });
    }
    return { schemaVersion: 1, encoding: 'st-character-book-current-native-overlay-v1',
        entries: [...edited].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([rawEntryPointer, value]) => {
            const ref = { schemaVersion: 1, encoding: 'tavern-lore-edit-origin-ref-v1', table: 'branch',
                sessionId: layer.ownerSessionId, identitySha256: layer.identitySha256, revision: layer.head.revision,
                headRef: layer.headRef, journalSha256: layer.journalSha256, eventRefs: value.events };
            return { rawEntryPointer, rawEntrySha256: value.rawEntrySha256, fields: value.fields,
                origin: { kind: 'append-only-lore-overlay', ref: ref, refSha256: recordSha256(ref) } };
        }) };
}
export function freezePublishedLocalEditLayerV1(source, journal) {
    if (journal.pending)
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_PENDING', journal.pending.request.operationId);
    // Root may expose an effective inherited overlay in publishedData. Capture
    // only actual local published events here; inherited layers are separate.
    const journalRefs = journal.refs.filter(ref => ref.key !== journal.headRef.key), base = { ownerSessionId: source.sessionId,
        sourceSha256: source.sourceSha256, identity: journal.identity, identitySha256: journal.identitySha256,
        head: journal.head, headRef: journal.headRef, journalRefs, journalSha256: recordSha256(journalRefs),
        events: journal.published.map(event => ({ ref: rowRef(eventKey(event.identitySha256, event.request.operationId), event), value: event })) };
    const body = { ...base, overlay: overlayForLayer(base) };
    return validateFrozenPublishedEditLayerV1({ ...body, layerSha256: recordSha256(body) });
}
export function validateFrozenPublishedEditLayerV1(raw) {
    const data = inheritanceDataV1(raw);
    inheritanceExactV1(data, ['ownerSessionId', 'sourceSha256', 'identity', 'identitySha256', 'head', 'headRef',
        'journalRefs', 'journalSha256', 'events', 'overlay', 'layerSha256']);
    const { layerSha256, ...body } = data;
    if (!inheritanceIdV1(data.ownerSessionId) || !inheritanceHashV1(data.sourceSha256) || !inheritanceHashV1(layerSha256)
        || recordSha256(body) !== layerSha256 || recordSha256(data.identity) !== data.identitySha256
        || !Array.isArray(data.events) || data.events.length > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.events
        || !Array.isArray(data.journalRefs))
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    const layer = data;
    if (layer.identity.sessionId !== layer.ownerSessionId)
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    try {
        const head = parseHead(layer.head, layer.identity);
        let prior = genesis(layer.identity);
        const refs = [], seen = new Set();
        for (const row of layer.events) {
            inheritanceExactV1(row, ['ref', 'value']);
            validateInheritanceRefV1(row.ref);
            const event = parseEvent(row.value, row.ref.key, layer.identity);
            if (seen.has(row.ref.key) || row.ref.sha256 !== recordSha256(event) || !inheritanceSameV1(event.baseHead, prior))
                inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
            seen.add(row.ref.key);
            refs.push(row.ref);
            prior = nextHead(event);
        }
        refs.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        if (!inheritanceSameV1(prior, head) || head.revision !== layer.events.length
            || !inheritanceSameV1(refs, layer.journalRefs) || recordSha256(refs) !== layer.journalSha256
            || layer.headRef.key !== `tavern_loreedit_v1__${layer.identitySha256}__head`
            || layer.headRef.exists !== (head.revision > 0)
            || layer.headRef.sha256 !== (head.revision > 0 ? recordSha256(head) : 'missing')
            || !inheritanceSameV1(overlayForLayer(layer), layer.overlay))
            inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    }
    catch {
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    }
    return inheritanceFreezeV1(layer);
}
export function frozenEditOverlayV1(layers) {
    const effective = new Map();
    const provenance = new Map();
    for (const input of layers) {
        const layer = validateFrozenPublishedEditLayerV1(input);
        for (const entry of layer.overlay.entries) {
            const previous = effective.get(entry.rawEntryPointer);
            if (previous && previous.rawEntrySha256 !== entry.rawEntrySha256)
                inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
            const origins = [...(provenance.get(entry.rawEntryPointer) ?? []),
                { ownerSessionId: layer.ownerSessionId, layerSha256: layer.layerSha256, origin: entry.origin }];
            provenance.set(entry.rawEntryPointer, origins);
            const ref = { schemaVersion: 1, encoding: 'native-tavern-inherited-edit-origin-v1', layers: origins };
            effective.set(entry.rawEntryPointer, { ...entry, fields: { ...previous?.fields, ...entry.fields },
                origin: { kind: 'append-only-lore-overlay', ref: ref, refSha256: recordSha256(ref) } });
        }
    }
    return { schemaVersion: 1, encoding: 'st-character-book-current-native-overlay-v1',
        entries: [...effective].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, entry]) => entry) };
}
export function validateFrozenSourceEditBaselineV1(raw) {
    const value = inheritanceDataV1(raw);
    inheritanceExactV1(value, ['schemaVersion', 'encoding', 'childSessionId', 'preparedRef', 'layers', 'effectiveOverlay', 'baselineSha256']);
    const { baselineSha256, ...body } = value;
    if (value.schemaVersion !== 1 || value.encoding !== 'native-tavern-source-edit-baseline-v1'
        || !inheritanceIdV1(value.childSessionId) || !inheritanceHashV1(baselineSha256) || recordSha256(body) !== baselineSha256
        || !Array.isArray(value.layers) || value.layers.length > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.ancestors)
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    validateInheritanceRefV1(value.preparedRef, tavernSourcePreparedKeyV1(value.childSessionId));
    const layers = value.layers.map(validateFrozenPublishedEditLayerV1);
    if (layers.reduce((sum, layer) => sum + layer.events.length, 0) > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.events)
        inheritanceFailV1('SOURCE_INHERITANCE_BUDGET');
    if (!inheritanceSameV1(value.effectiveOverlay, frozenEditOverlayV1(layers)))
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    return inheritanceFreezeV1(value);
}
export function validateInheritanceEditSlotV1(raw) {
    const value = inheritanceDataV1(raw);
    inheritanceExactV1(value, ['schemaVersion', 'encoding', 'identity', 'identitySha256', 'preparedRef', 'baselineRef', 'slotSha256']);
    const { slotSha256, ...body } = value;
    if (value.schemaVersion !== 1 || value.encoding !== 'native-tavern-source-edit-baseline-slot-v1'
        || recordSha256(body) !== slotSha256 || recordSha256(value.identity) !== value.identitySha256)
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    const slot = value;
    validateInheritanceRefV1(slot.preparedRef, tavernSourcePreparedKeyV1(slot.identity.sessionId));
    validateInheritanceRefV1(slot.baselineRef, tavernSourceEditBaselineKeyV1(slot.identity.sessionId));
    // The key is identity-specific and in the local journal namespace. Its
    // exact recognized slot is excluded from local event/orphan membership.
    if (!inheritanceIdV1(slot.identity.sessionId) || !inheritanceHashV1(slot.identitySha256))
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    try {
        parseHead(genesis(slot.identity), slot.identity);
    }
    catch {
        inheritanceFailV1('SOURCE_INHERITANCE_JOURNAL_INVALID');
    }
    return inheritanceFreezeV1(slot);
}
export function sealFrozenSourceEditBaselineV1(childSessionId, preparedRef, layers) {
    return validateFrozenSourceEditBaselineV1(sealInheritanceDataV1({ schemaVersion: 1,
        encoding: 'native-tavern-source-edit-baseline-v1', childSessionId, preparedRef, layers,
        effectiveOverlay: frozenEditOverlayV1(layers) }, 'baselineSha256'));
}
