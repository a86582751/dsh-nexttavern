// Generated from runtime/alpha3/src/core/roleplay-author-worldbook-planner.ts; edit the TypeScript source.
/** Same UID allocation, entry conversion and membership mutations as the
 * embedded-book owner, addressed here by an actual profile library book. */
import { allocateAuthorWorldbookUidV1, authorWorldbookHelperEntryV1 } from './roleplay-author-worldbook-data.js';
import { worldbookWireToNativeEntryV1 } from './tavern-named-worldbook-data.js';
export function planAuthorCatalogWorldbookMutationV1(basis, operationId, mutation, prepare) {
    const createdUids = [];
    const deletedEntries = [];
    let result;
    let finalEntries;
    if (mutation.kind === 'delete-entries') {
        const removed = new Set(mutation.uids), removedMembers = [], retained = [];
        for (const member of basis.members)
            (removed.has(member.uid) ? removedMembers : retained).push(member);
        for (const member of [...removedMembers].sort((a, b) => a.displayIndex - b.displayIndex))
            deletedEntries.push(authorWorldbookHelperEntryV1(member));
        result = { kind: 'remove', targets: removedMembers.map(member => member.identity) };
        finalEntries = retained;
    }
    else if (mutation.kind === 'create-entries') {
        const used = new Set(basis.members.map(member => member.uid));
        const first = basis.members.reduce((maximum, member) => Math.max(maximum, member.displayIndex), -1) + 1;
        result = { kind: 'append', entries: mutation.entries.map((entry, ordinal) => {
                const uid = allocateAuthorWorldbookUidV1(entry.uid, used, operationId, ordinal), displayIndex = first + ordinal;
                createdUids.push(uid);
                return { uid, displayIndex, rawEntry: worldbookWireToNativeEntryV1(entry, { uid, displayIndex }) };
            }) };
        finalEntries = [...basis.members, ...result.entries];
    }
    else if (mutation.kind === 'replace-entries') {
        const current = new Map(basis.members.map(member => [member.uid, member])), replacements = new Map(mutation.entries.map(entry => [entry.uid, entry]));
        for (const uid of replacements.keys())
            if (!current.has(uid))
                throw Error('AUTHOR_WORLDBOOK_ENTRY_NOT_FOUND');
        result = { kind: 'update-entries', entries: [...replacements].map(([uid, entry]) => {
                const member = current.get(uid);
                return { ...member, rawEntry: worldbookWireToNativeEntryV1(entry, { uid: member.uid, displayIndex: member.displayIndex }, member.rawEntry) };
            }) };
        const changed = new Map(result.entries.map(member => [member.identity, member]));
        finalEntries = basis.members.map(member => changed.get(member.identity) ?? member);
    }
    else {
        const used = new Set();
        const available = new Map();
        // Helper reads expose stable display order. Repeated original UIDs retain
        // their respective identities in that order during a full replacement.
        for (const member of [...basis.members].sort((a, b) => a.displayIndex - b.displayIndex)) {
            used.add(member.uid);
            let queue = available.get(member.uid);
            if (!queue) {
                queue = { members: [], next: 0 };
                available.set(member.uid, queue);
            }
            queue.members.push(member);
        }
        const entries = mutation.entries.map((entry, displayIndex) => {
            const queue = entry.uid === undefined ? undefined : available.get(entry.uid), previous = queue?.members[queue.next], uid = previous?.uid ?? allocateAuthorWorldbookUidV1(entry.uid, used, operationId, displayIndex);
            if (previous)
                queue.next++;
            else
                createdUids.push(uid);
            return { uid, displayIndex, ...previous ? { identity: previous.identity } : {},
                rawEntry: worldbookWireToNativeEntryV1(entry, { uid, displayIndex }, previous?.rawEntry) };
        });
        result = { kind: 'replace', entries };
        finalEntries = entries;
    }
    // Required Helper replies are constructed before any event can be written.
    // This view needs raw fields and UIDs, without inventing introduced identities.
    const created = new Set(createdUids), createdEntries = [];
    const entries = [...finalEntries].sort((a, b) => a.displayIndex - b.displayIndex).map(member => {
        const entry = authorWorldbookHelperEntryV1(member);
        if (created.has(member.uid))
            createdEntries.push(entry);
        return entry;
    });
    prepare?.(entries, createdEntries);
    return { mutation: result, createdUids, deletedEntries };
}
/** Replays use the accepted event's entries, independently of the current
 * membership or a later incarnation that reuses one of its UIDs. */
export function createdAuthorCatalogWorldbookEntriesV1(payload) {
    if (!payload.createdUids.length)
        return [];
    const mutation = payload.mutation;
    if (mutation.kind !== 'append' && mutation.kind !== 'replace')
        return [];
    const created = new Set(payload.createdUids);
    return mutation.entries.filter(member => created.has(member.uid)).sort((a, b) => a.displayIndex - b.displayIndex)
        .map(member => authorWorldbookHelperEntryV1(member));
}
