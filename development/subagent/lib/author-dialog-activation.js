// Generated from runtime/alpha3/compat/subagent/src/author-dialog-activation.ts; edit the TypeScript source.
export function readOwnedAuthorDialogActivationV1(value) {
    if (!value || typeof value !== 'object')
        throw Error('invalid owned author dialogue activation');
    const record = value;
    if (record.schemaVersion !== 1 || record.encoding !== 'owned-author-dialog-v1'
        || ['taskId', 'generation', 'promptPlanSha256', 'operationId', 'messageId', 'dynamicSystem']
            .some(key => typeof record[key] !== 'string' || !record[key].length)
        || typeof record.systemPrefix !== 'string')
        throw Error('invalid owned author dialogue activation');
    return value;
}
/** The returned exact disposers are also Cordis scope effects. Child setup
 * rollback and quiescent handle disposal therefore remove both contributions. */
export function composeOwnedAuthorDialogActivationV1(ctx, activation) {
    const removePrefix = ctx.systemPrompt.section({ name: 'deployment:persona-prefix',
        order: ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
        text: activation.systemPrefix, interpolate: false, complete: true });
    let restoreContext;
    try {
        restoreContext = ctx.systemPrompt.suppressRuntimeContext();
    }
    catch (error) {
        removePrefix();
        throw error;
    }
    return () => { restoreContext(); removePrefix(); };
}
export async function driveOwnedAuthorDialogActivationV1(child, activation) {
    if (typeof child.generateProgrammaticAssistant !== 'function')
        throw Error('owned author dialogue Native driver unavailable');
    const receipt = await child.generateProgrammaticAssistant({ operationId: activation.operationId,
        messageId: activation.messageId, instruction: activation.dynamicSystem });
    if (receipt.kind !== 'committed')
        throw Error('owned author dialogue generation ' + receipt.kind);
}
