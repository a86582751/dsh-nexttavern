// Generated from runtime/alpha3/src/core/roleplay-mvu-display-facts.ts; edit the TypeScript source.
const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function acceptedMvuDisplayUpdate(ownerSessionId, canonical, protocol) {
    if (!identifier(ownerSessionId) || !identifier(canonical.messageId)
        || !Number.isSafeInteger(canonical.seq) || canonical.seq < 0
        || !hash(canonical.versionSha256) || !hash(canonical.narrativeSha256)
        || !['native-jsonpatch-v1', 'native-mvu-update-v2'].includes(protocol))
        return undefined;
    return Object.freeze({ schemaVersion: 1, encoding: 'native-mvu-accepted-display-update-v1',
        ownerSessionId, canonical: Object.freeze({ seq: canonical.seq, messageId: canonical.messageId,
            versionSha256: canonical.versionSha256, narrativeSha256: canonical.narrativeSha256 }), protocol });
}
/** Ambiguous identities omit hints; display formatting can never make the
 * original authority/fork/recovery contract fail or select a guessed version. */
export function formatMvuDisplayUpdates(inputs) {
    const updates = new Map(), conflicts = new Set();
    for (const input of inputs) {
        if (input.schemaVersion !== 1 || input.encoding !== 'native-mvu-accepted-display-update-v1')
            continue;
        const item = acceptedMvuDisplayUpdate(input.ownerSessionId, input.canonical, input.protocol);
        if (!item)
            continue;
        const key = `${item.ownerSessionId}:${item.canonical.seq}:${item.canonical.messageId}`;
        const previous = updates.get(key);
        if (previous && (previous.protocol !== item.protocol
            || previous.canonical.versionSha256 !== item.canonical.versionSha256
            || previous.canonical.narrativeSha256 !== item.canonical.narrativeSha256))
            conflicts.add(key);
        else
            updates.set(key, item);
    }
    return Object.freeze([...updates].filter(([key]) => !conflicts.has(key)).map(([, item]) => item));
}
