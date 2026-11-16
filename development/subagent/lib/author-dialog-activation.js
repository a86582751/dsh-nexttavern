// Generated from runtime/alpha3/compat/subagent/src/author-dialog-activation.ts; edit the TypeScript source.
export function readOwnedAuthorDialogActivationV1(value) {
    const row = value;
    if (!row || row.schemaVersion !== 1 || row.encoding !== 'owned-author-dialog-v1'
        || row.identity?.kind !== 'author-generation' || !row.identity.childSessionId || !row.identity.messageId
        || !Array.isArray(row.orderedMessages) || !row.call || !row.material)
        throw Error('invalid owned author generation activation');
    return row;
}
export function composeOwnedAuthorDialogActivationV1(ctx, _activation) {
    return ctx.systemPrompt.suppressRuntimeContext();
}
export async function driveOwnedAuthorDialogActivationV1(child, activation, owner) {
    if (typeof child.generateAuthorDialogAssistant !== 'function')
        throw Error('owned author generation Native driver unavailable');
    const result = await child.generateAuthorDialogAssistant({ plan: activation, owner });
    if (result.kind !== 'committed')
        throw Error('owned author generation ' + result.kind);
}
