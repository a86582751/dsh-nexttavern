// Generated from runtime/alpha3/src/core/roleplay-mvu-numerical-publication.ts; edit the TypeScript source.
/** The shared numerical address owns both the selected execution leaf and
 * its optional opening-variant selection. Event heads remain event DATA. */
import { recordSha256 } from './roleplay-data.js';
import { mvuStateCurrentHeadKey } from './roleplay-mvu-state.js';
import { isMvuSchemaGenesisHead } from './roleplay-mvu-schema-story-types.js';
const same = (left, right) => left === right || recordSha256(left) === recordSha256(right);
function envelope(raw) {
    return raw?.encoding === 'native-mvu-numerical-publication-v1'
        ? raw : undefined;
}
/** Frozen-prefix readers still enroll the complete stored publication row.
 * Only their existing event fold consumes this event-derived leaf. */
export function mvuNumericalPublicationLeaf(raw) {
    return envelope(raw)?.leaf ?? raw;
}
export function mvuNumericalPublicationMatches(raw, expected) {
    return raw === undefined ? isMvuSchemaGenesisHead(expected) : same(mvuNumericalPublicationLeaf(raw), expected);
}
export function createMvuNumericalPublicationOwner(table) {
    function read(sessionId) {
        const key = mvuStateCurrentHeadKey(sessionId), raw = table.get(key), stored = envelope(raw);
        return { sessionId, key, raw, leaf: mvuNumericalPublicationLeaf(raw), openingVariants: stored?.openingVariants ?? null };
    }
    async function publish(prior, next) {
        const actual = table.get(prior.key);
        if (!same(actual, prior.raw) && !same(actual, next))
            return { kind: 'conflict' };
        if (!same(actual, next))
            try {
                await table.put(prior.key, next);
            }
            catch {
                // A failed acknowledgement is resolved only by the actual shared row.
            }
        const observed = table.get(prior.key);
        return same(observed, next) ? { kind: 'acknowledged', key: prior.key, value: observed } : { kind: 'unknown' };
    }
    function advanceLeaf(prior, leaf) {
        const stored = envelope(prior.raw);
        return publish(prior, stored ? { ...stored, leaf } : leaf);
    }
    function replaceVariants(prior, openingVariants, leaf) {
        const next = { schemaVersion: 1, encoding: 'native-mvu-numerical-publication-v1',
            sessionId: prior.sessionId, openingVariants, leaf };
        return publish(prior, next);
    }
    return { read, advanceLeaf, replaceVariants };
}
