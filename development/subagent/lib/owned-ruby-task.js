// Generated from runtime/alpha3/compat/subagent/src/owned-ruby-task.ts; edit the TypeScript source.
/** Persistence/start boundary for the ordered Ruby transport. Later
 * setup consumes these captured primitives without another shape parser. */
export function readOwnedRubyTaskActivationV1(value) {
    if (!value || typeof value !== 'object')
        throw Error('RUBY_ACTIVATION_INVALID');
    const row = value;
    if (row.schemaVersion !== 1 || row.encoding !== 'owned-ruby-task-v1'
        || ['taskId', 'generation', 'promptPlanSha256', 'userMessageId'].some(key => typeof row[key] !== 'string' || !row[key].length)
        || !Array.isArray(row.orderedMessages) || row.orderedMessages.length < 1)
        throw Error('RUBY_ACTIVATION_INVALID');
    const orderedMessages = row.orderedMessages.map((message) => {
        const entry = message;
        if (!entry || !['system', 'user', 'assistant'].includes(entry.role) || typeof entry.text !== 'string')
            throw Error('RUBY_ACTIVATION_ORDER_INVALID');
        return Object.freeze({ role: entry.role, text: entry.text });
    });
    // Old v1 DATA predates the explicit index and is unambiguous only with one
    // user role. Preserve that shape rather than rewriting its stored hashes.
    const indexed = Object.hasOwn(row, 'mainInputMessageIndex');
    if (indexed) {
        const index = row.mainInputMessageIndex;
        if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || index >= orderedMessages.length
            || orderedMessages[index].role !== 'user')
            throw Error('RUBY_ACTIVATION_ORDER_INVALID');
    }
    else if (orderedMessages.filter(message => message.role === 'user').length !== 1)
        throw Error('RUBY_ACTIVATION_ORDER_INVALID');
    return Object.freeze({ schemaVersion: 1, encoding: 'owned-ruby-task-v1',
        taskId: row.taskId, generation: row.generation,
        promptPlanSha256: row.promptPlanSha256, userMessageId: row.userMessageId,
        orderedMessages: Object.freeze(orderedMessages),
        ...(indexed ? { mainInputMessageIndex: row.mainInputMessageIndex } : {}) });
}
