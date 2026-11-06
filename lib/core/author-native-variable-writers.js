// Generated from runtime/alpha3/src/core/author-native-variable-writers.ts; edit the TypeScript source.
/** Author callbacks stay inside their realm. Each adapter captures its read
 * scope before awaiting the updater and resolves commit only after real ACK. */
export function createAuthorNativeVariableWriters(capture, lodash) {
    const updateVariablesWith = async (updater, options = { type: 'chat' }) => {
        const basis = capture(options), next = await updater(basis.variables);
        await basis.commit(next);
        return next;
    };
    return {
        updateVariablesWith,
        replaceVariables: (next, options) => updateVariablesWith(() => next, options),
        insertOrAssignVariables: (patch, options) => updateVariablesWith(value => {
            const api = lodash();
            return api.mergeWith(value, patch, (_lhs, rhs) => api.isArray(rhs) ? rhs : undefined);
        }, options),
        insertVariables: (patch, options) => updateVariablesWith(value => {
            const api = lodash();
            return api.mergeWith({}, patch, value, (_lhs, rhs) => api.isArray(rhs) ? rhs : undefined);
        }, options),
        deleteVariable: async (path, options) => {
            let delete_occurred = false;
            const variables = await updateVariablesWith(value => {
                delete_occurred = lodash().unset(value, path);
                return value;
            }, options);
            return { variables, delete_occurred };
        },
    };
}
