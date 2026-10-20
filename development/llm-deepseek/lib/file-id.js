// Generated from runtime/alpha3/compat/llm-deepseek/src/file-id.ts; edit the TypeScript source.
/** DeepSeek Files API identifiers. @module dsh-llm-deepseek/file-id */
/**
 * Brand a provider-returned file identifier after wire validation.
 * @param id - non-empty Files API identifier.
 * @returns the same string with its provider identity attached at type level.
 */
export function DeepSeekFileId(id) {
    return id;
}
/**
 * Brand a locally derived namespace digest.
 * @param scope - SHA-256 digest of endpoint and API key.
 * @returns the same string with namespace identity attached at type level.
 */
export function DeepSeekFileScope(scope) {
    return scope;
}
