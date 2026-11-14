// Generated from runtime/alpha3/compat/session-format/src/author-chat-marker.ts; edit the TypeScript source.
export const AUTHOR_CHAT_ROOT_EVENT = 'roleplay/author-chat-root';
export function assertAuthorChatRootMarker(value) {
    if (!value || typeof value !== 'object')
        throw Error('AUTHOR_CHAT_ROOT_MARKER_INVALID');
    const marker = value;
    const ref = (item) => !!item && typeof item === 'object'
        && typeof item.key === 'string' && item.key.length > 0 && typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256);
    if (marker.schemaVersion !== 1 || marker.encoding !== 'native-author-chat-root-marker-v1'
        || typeof marker.sessionId !== 'string' || !marker.sessionId.length
        || typeof marker.namespaceSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(marker.namespaceSha256)
        || !ref(marker.publication) || marker.base !== null && !ref(marker.base))
        throw Error('AUTHOR_CHAT_ROOT_MARKER_INVALID');
}
/** Publication is allowed within an open turn, before the prepared request. */
export function appendAuthorChatRootMarker(session, marker) {
    if (marker.sessionId !== session.id)
        throw Error('AUTHOR_CHAT_ROOT_SESSION_CHANGED');
    return session.append(AUTHOR_CHAT_ROOT_EVENT, marker);
}
export const authorChatRootMarkers = Object.freeze({ eventType: AUTHOR_CHAT_ROOT_EVENT,
    append: appendAuthorChatRootMarker, assert: assertAuthorChatRootMarker });
