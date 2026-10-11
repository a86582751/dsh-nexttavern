// Generated from runtime/alpha3/compat/session-format/src/author-injection-cleanup.ts; edit the TypeScript source.
export const AUTHOR_INJECTION_CLEANUP_EVENT = 'roleplay/author-injection-cleanup';
/** Decode this durable version only; Core owns Source and resource authority. */
export function assertAuthorInjectionCleanup(value) {
    if (!value || typeof value !== 'object')
        throw Error('AUTHOR_INJECTION_CLEANUP_INVALID');
    const data = value;
    if (data.schemaVersion !== 1 || data.encoding !== 'native-author-injection-cleanup-v1'
        || typeof data.sessionId !== 'string' || typeof data.programSha256 !== 'string'
        || !data.resource || typeof data.resource !== 'object'
        || typeof data.resource.browserSessionId !== 'string' || typeof data.resource.generation !== 'string'
        || data.resource.pageId !== undefined && typeof data.resource.pageId !== 'string'
        || data.kind !== 'remove-ids' && data.kind !== 'resource-closed'
        || data.kind === 'remove-ids' && (!Array.isArray(data.ids) || !data.ids.every(id => typeof id === 'string'))) {
        throw Error('AUTHOR_INJECTION_CLEANUP_INVALID');
    }
}
/** Synchronous required append. The Core owner invalidates its captured input. */
export function appendAuthorInjectionCleanup(session, data) {
    return session.append(AUTHOR_INJECTION_CLEANUP_EVENT, data);
}
export const authorInjectionCleanupMarkers = Object.freeze({
    eventType: AUTHOR_INJECTION_CLEANUP_EVENT,
    append: appendAuthorInjectionCleanup,
    assert: assertAuthorInjectionCleanup,
});
