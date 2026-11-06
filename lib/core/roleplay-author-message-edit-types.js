// Generated from runtime/alpha3/src/core/roleplay-author-message-edit-types.ts; edit the TypeScript source.
/** One server admission for the fixed browser request; target identity is
 * joined to retained DATA by the caller and rechecked by the Native editor. */
export function authorMessageBodyRequestValid(request) {
    return request?.schemaVersion === 1 && typeof request.operationId === 'string'
        && /^[A-Za-z0-9_-]{1,128}$/.test(request.operationId) && typeof request.text === 'string'
        && !!request.text.trim() && request.text.length <= 1_000_000
        && ['none', 'affected', 'all'].includes(request.refresh) && !!request.expected;
}
