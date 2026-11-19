// Generated from runtime/alpha3/src/core/roleplay-author-chat-state-types.ts; edit the TypeScript source.
/** Parent outboxes and the canonical admission serialize this same operation.
 * Numerical DATA is checked by the writer but never enters an ordinary row. */
export function prepareOrdinaryAuthorChatBatchV3(root, nextVariables, operationId, cause, expectedScopeRef) {
    const { stat_data: _reserved, ...values } = nextVariables;
    return { namespace: root.namespace, expectedRoot: root, operationId, values, cause,
        ...expectedScopeRef !== undefined ? { expectedScopeRef } : {} };
}
/** Apply the owner's effective overlay, including explicit deletion of Native fallback. */
export function applyAuthorChatOverlayV3(base, capture) {
    const retained = capture.replaceOrdinary ? (Object.hasOwn(base, 'stat_data') ? { stat_data: base.stat_data } : {}) : base;
    const values = { ...retained, ...capture.values };
    for (const key of capture.deletedKeys ?? [])
        delete values[key];
    return values;
}
