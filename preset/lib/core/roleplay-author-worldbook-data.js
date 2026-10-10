// Generated from runtime/alpha3/src/core/roleplay-author-worldbook-data.ts; edit the TypeScript source.
/** Named primary-book DATA and deterministic mutation planning. The actual
 * Core lifecycle and lore journal remain the only read/write authorities. */
import { recordSha256 } from './roleplay-data.js';
import { composeRoleplayTavernCurrentOverlayV1 } from './roleplay-tavern-current-overlay.js';
import { originalTavernLoreMembershipFromSourceV1, applyTavernLoreMemberFieldsV1 } from './roleplay-tavern-lore-membership.js';
import { nativeNamedWorldbookEntryToWireV1, worldbookWireToNativeEntryV1 } from './tavern-named-worldbook-data.js';
/** The supplied journal and legacy differences came from the same Source
 * read. No model, global library or new Source identity is synthesized. */
function captureNamedWorldbookBody(source, data, legacy) {
    let membership = data.currentNativeMembership;
    if (!membership) {
        membership = originalTavernLoreMembershipFromSourceV1(source);
        for (const entry of composeRoleplayTavernCurrentOverlayV1(legacy, data.overlay).entries) {
            membership = applyTavernLoreMemberFieldsV1(membership, { kind: 'original', rawEntryPointer: entry.rawEntryPointer,
                rawEntrySha256: entry.rawEntrySha256 }, entry.fields);
        }
    }
    const name = source.original.primary.value?.name, primaryName = typeof name === 'string' && name.length ? name : null, members = [...membership.members].sort((left, right) => left.displayIndex - right.displayIndex);
    const entries = members.map(member => nativeNamedWorldbookEntryToWireV1(member.rawEntry, { uid: member.uid }));
    return { authority: 'consumer-data-only', sessionId: source.sessionId, sourceSha256: source.sourceSha256,
        loreDataSha256: data.dataSha256, revision: data.revision, primaryName, names: primaryName === null ? [] : [primaryName], members, entries };
}
export function captureAuthorNamedWorldbookDataV1(source, data, legacy) {
    const body = { schemaVersion: 1, encoding: 'author-named-primary-worldbook-data-v1',
        ...captureNamedWorldbookBody(source, data, legacy) };
    return { ...body, dataSha256: recordSha256(body) };
}
export function captureAuthorNamedWorldbookDataV2(source, data, legacy) {
    const body = { schemaVersion: 2, encoding: 'author-named-primary-worldbook-data-v2',
        identitySha256: data.identitySha256, ...captureNamedWorldbookBody(source, data, legacy) };
    return { ...body, dataSha256: recordSha256(body) };
}
/** The fixed Helper resolves collisions over the whole result, with quadratic
 * probing modulo one million. A default candidate here derives from the real
 * operation, so a lost reply never reallocates IDs when that operation retries.
 * Evidence: JS-Slash-Runner 519599bc... src/function/worldbook.ts 306–331. */
function allocateUid(desired, used, operationId, ordinal) {
    let candidate = desired ?? Number.parseInt(recordSha256({ operationId, ordinal }).slice(0, 12), 16) % 1_000_000;
    let probe = 1;
    while (used.has(candidate)) {
        candidate = (candidate + probe * probe) % 1_000_000;
        probe++;
    }
    used.add(candidate);
    return candidate;
}
/** Predicates and updater callbacks run in the guest over its actual DTO
 * snapshot. Core receives resolved UID targets or entry DATA only. */
export function planAuthorWorldbookMutationV1(basis, name, operationId, mutation) {
    if (name !== basis.primaryName)
        throw Error('AUTHOR_WORLDBOOK_NOT_FOUND');
    const current = new Map(basis.members.map(member => [member.uid, member])), createdUids = [], deletedEntries = [];
    let journalMutation;
    if (mutation.kind === 'delete-entries') {
        const removed = new Set(mutation.uids);
        basis.entries.forEach(entry => { if (removed.has(entry.uid))
            deletedEntries.push(entry); });
        journalMutation = { kind: 'remove', targets: basis.members.filter(member => removed.has(member.uid)).map(member => member.identity) };
    }
    else if (mutation.kind === 'create-entries') {
        const used = new Set(current.keys());
        // A sparse existing display order stays intact. New Helper entries append
        // after its actual last item rather than entering a gap left by deletion.
        const firstDisplayIndex = basis.members.reduce((maximum, member) => Math.max(maximum, member.displayIndex), -1) + 1;
        const entries = mutation.entries.map((entry, ordinal) => {
            const uid = allocateUid(entry.uid, used, operationId, ordinal), displayIndex = firstDisplayIndex + ordinal;
            createdUids.push(uid);
            return { uid, displayIndex, rawEntry: worldbookWireToNativeEntryV1(entry, { uid, displayIndex }) };
        });
        journalMutation = { kind: 'append', entries };
    }
    else if (mutation.kind === 'replace-entries') {
        const replacements = new Map(mutation.entries.map(entry => [entry.uid, entry]));
        for (const uid of replacements.keys())
            if (!current.has(uid))
                throw Error('AUTHOR_WORLDBOOK_ENTRY_NOT_FOUND');
        const entries = basis.members.map((member, displayIndex) => {
            const entry = replacements.get(member.uid);
            return { ...member, displayIndex, rawEntry: entry
                    ? worldbookWireToNativeEntryV1(entry, { uid: member.uid, displayIndex }, member.rawEntry) : member.rawEntry };
        });
        journalMutation = { kind: 'replace', entries };
    }
    else {
        const used = new Set();
        const entries = mutation.entries.map((entry, displayIndex) => {
            const uid = allocateUid(entry.uid, used, operationId, displayIndex), previous = current.get(uid);
            if (!previous)
                createdUids.push(uid);
            return { uid, displayIndex, ...previous ? { identity: previous.identity } : {},
                rawEntry: worldbookWireToNativeEntryV1(entry, { uid, displayIndex }, previous?.rawEntry) };
        });
        journalMutation = { kind: 'replace', entries };
    }
    const request = { schemaVersion: 2, encoding: 'tavern-lore-mutation-request-v2',
        sessionId: basis.sessionId, expectedSourceSha256: basis.sourceSha256, expectedRevision: basis.revision, operationId,
        mutation: journalMutation };
    return { request, createdUids, deletedEntries };
}
export function authorWorldbookMutationReplyV1(plan, actual) {
    const created = new Set(plan.createdUids);
    return { worldbook: actual.entries, new_entries: actual.entries.filter(entry => created.has(entry.uid)),
        deleted_entries: plan.deletedEntries };
}
