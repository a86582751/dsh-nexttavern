// Generated from runtime/alpha3/compat/session-format/src/author-injection-cleanup.ts; edit the TypeScript source.
export const AUTHOR_INJECTION_CLEANUP_EVENT = 'roleplay/author-injection-cleanup';
export const AUTHOR_INJECTION_DECLARATION_EVENT = 'roleplay/author-injection-declaration';
export function assertAuthorInjectionDeclaration(value) {
    const data = value;
    if (!data || data.schemaVersion !== 1 || data.encoding !== 'native-author-injection-declaration-v1'
        || typeof data.sessionId !== 'string' || typeof data.operationId !== 'string' || typeof data.programSha256 !== 'string'
        || !data.definition || typeof data.definition.logicalOwnerId !== 'string' || typeof data.definition.definitionSha256 !== 'string'
        || typeof data.realmId !== 'string' || typeof data.groupId !== 'string'
        || !data.resource || typeof data.resource.browserSessionId !== 'string' || typeof data.resource.generation !== 'string'
        || typeof data.resource.pageId !== 'string' || !data.mutation)
        throw Error('AUTHOR_INJECTION_DECLARATION_INVALID');
    const mutation = data.mutation;
    if (mutation.kind === 'remove-ids') {
        if (!Array.isArray(mutation.ids) || !mutation.ids.every(id => typeof id === 'string')
            || mutation.registrationOperationId !== undefined && typeof mutation.registrationOperationId !== 'string')
            throw Error('AUTHOR_INJECTION_DECLARATION_INVALID');
    }
    else if (mutation.kind === 'register') {
        if (typeof mutation.once !== 'boolean' || !Array.isArray(mutation.prompts) || !mutation.prompts.every(prompt => prompt && typeof prompt.id === 'string' && (prompt.position === 'none' || prompt.position === 'in_chat')
            && Number.isSafeInteger(prompt.depth) && prompt.depth >= 0
            && ['system', 'user', 'assistant'].includes(prompt.role) && typeof prompt.content === 'string'
            && typeof prompt.should_scan === 'boolean'
            && (prompt.filterCallbackId === undefined || typeof prompt.filterCallbackId === 'string')))
            throw Error('AUTHOR_INJECTION_DECLARATION_INVALID');
    }
    else
        throw Error('AUTHOR_INJECTION_DECLARATION_INVALID');
}
export function appendAuthorInjectionDeclaration(session, data) {
    if (session.id !== data.sessionId)
        throw Error('AUTHOR_INJECTION_DECLARATION_SESSION_CHANGED');
    assertAuthorInjectionDeclaration(data);
    return session.append(AUTHOR_INJECTION_DECLARATION_EVENT, data);
}
export const authorInjectionDeclarationMarkers = Object.freeze({ eventType: AUTHOR_INJECTION_DECLARATION_EVENT,
    append: appendAuthorInjectionDeclaration, assert: assertAuthorInjectionDeclaration });
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
