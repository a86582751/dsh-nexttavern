// Generated from runtime/alpha3/src/core/author-native-origin.ts; edit the TypeScript source.
export const AUTHOR_NATIVE_EVENTS_V1 = Object.freeze({ MESSAGE_UPDATED: 'message_updated', MESSAGE_SWIPED: 'message_swiped',
    MESSAGE_SENT: 'message_sent', MESSAGE_RECEIVED: 'message_received', MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted', CHAT_CHANGED: 'chat_id_changed', SETTINGS_UPDATED: 'settings_updated',
    USER_MESSAGE_RENDERED: 'user_message_rendered', CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS', NUMERICAL_UPDATED: 'nexttavern_numerical_updated' });
/** The attachment owner supplies its actual realm. This durable cause records
 * shared-realm provenance; it never substitutes for a live writer admission. */
export function authorNativeNamespaceCauseV1(programSha256, realm) {
    return { schemaVersion: 1, encoding: 'author-native-namespace-cause-v1',
        programSha256, realmId: realm.realmId, groupId: realm.groupId };
}
/** The same literal Source permission witnesses Reader body and ordinary
 * writes. Render/program digests are ephemeral DATA, not a new principal. */
export function readerNativeSourceOriginV1(literal) {
    const source = literal.source;
    return { principal: 'reader-regex-document', sourceRecordSessionId: source.sourceRecordSessionId,
        importId: source.importId, rawSha256: source.rawSha256, descriptorSha256: literal.regex.descriptorSha256,
        htmlSha256: literal.htmlSha256, htmlSpan: literal.regex.htmlSpan,
        carrier: { seq: literal.message.seq, messageId: literal.message.messageId } };
}
export function readerNativeNamespaceCauseV1(literal) {
    return { schemaVersion: 1, encoding: 'reader-native-namespace-cause-v1',
        ...readerNativeSourceOriginV1(literal) };
}
