// Generated from runtime/alpha3/src/ui/author-native-mvu-sdk.ts; edit the TypeScript source.
import { AUTHOR_NATIVE_MVU_HOOK_EVENTS } from '../core/author-native-mvu-hook-types.js';
/** Serialized into both native realms. A cloned MVU DTO keeps the last
 * explicit read for its actual target; display broadcasts never promote it.
 * The numerical owner publishes the complete replacement at that read cut. */
export function createAuthorNativeMvuApi(options, hookEvents = AUTHOR_NATIVE_MVU_HOOK_EVENTS) {
    const retained = new WeakMap(), reads = new Map();
    let messageReadKey;
    function selection(input = { type: 'chat' }) {
        const snapshot = options.snapshot(), type = input.type ?? 'chat';
        if (type === 'chat') {
            return { key: 'chat', scope: 'chat', target: undefined };
        }
        if (type !== 'message')
            throw Error('AUTHOR_NATIVE_MVU_REPLACEMENT_UNSUPPORTED');
        const id = input.message_id, rows = snapshot.messages, row = id === undefined || id === 'latest' ? rows.findLast(row => row.role !== 'system')
            : rows[id < 0 ? rows.length + id : id];
        if (!row)
            throw Error('AUTHOR_NATIVE_MVU_MESSAGE_UNAVAILABLE');
        const target = row.nativeSeq === null ? undefined : { kind: 'message',
            ownerSessionId: row.ownerSessionId, nativeSeq: row.nativeSeq, messageId: row.messageId,
            messageVersionSha256: row.messageVersionSha256 };
        return { key: JSON.stringify([row.ownerSessionId, row.nativeSeq, row.messageId, row.messageVersionSha256]),
            scope: 'message', target };
    }
    function read(input = { type: 'chat' }) {
        if (input.type && input.type !== 'chat' && input.type !== 'message')
            return options.variables(input);
        const selected = selection(input), data = options.variables(input), basis = { readScope: options.readScope(), numerical: options.snapshot().numerical };
        const numerical = basis.numerical, carrier = numerical.kind === 'ready' || numerical.kind === 'schema-ready'
            ? numerical.currentMessageCarrier : undefined;
        if (selected.scope === 'chat' || selected.target && same(selected.target, carrier)) {
            // Historical messages are readable but have no write target. Retain only
            // chat and the owner's current message basis, not one snapshot per turn.
            if (selected.scope === 'message') {
                if (messageReadKey && messageReadKey !== selected.key)
                    reads.delete(messageReadKey);
                messageReadKey = selected.key;
            }
            reads.set(selected.key, basis);
        }
        retained.set(data, basis);
        return data;
    }
    const same = (left, right) => {
        if (left === right)
            return true;
        if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
            return false;
        if (Array.isArray(left) !== Array.isArray(right))
            return false;
        const record = left, other = right;
        const keys = Object.keys(record).filter(key => record[key] !== undefined);
        return keys.length === Object.keys(other).filter(key => other[key] !== undefined).length
            && keys.every(key => Object.hasOwn(other, key) && same(record[key], other[key]));
    };
    const replaceAtBasis = async (envelope, selected, basis) => {
        if (selected.scope === 'message' && !selected.target)
            throw Error('AUTHOR_NATIVE_MVU_MESSAGE_UNAVAILABLE');
        if (basis.numerical.kind !== 'ready' && basis.numerical.kind !== 'schema-ready')
            throw Error('AUTHOR_NATIVE_MVU_NOT_READY');
        const result = await options.replace({ action: 'replace-envelope', envelope, expected: basis.numerical.expected,
            ...selected.target ? { target: selected.target } : {} }, basis.readScope);
        if (!result.ok || result.operation?.outcome === 'refused')
            throw Error(result.code ?? result.operation?.refusalCode ?? 'AUTHOR_NATIVE_MVU_REPLACEMENT_REFUSED');
    };
    const api = { events: { VARIABLE_INITIALIZED: hookEvents['initialized'],
            VARIABLE_UPDATE_STARTED: hookEvents['update-started'], COMMAND_PARSED: hookEvents['command-parsed'],
            COMMAND_PARSED_FOR_ZOD: hookEvents['command-parsed-for-zod'], COMMAND_PARSED_ENDED_FOR_ZOD: hookEvents['command-parsed-ended-for-zod'],
            VARIABLE_UPDATE_ENDED_FOR_ZOD: hookEvents['update-ended-for-zod'],
            SINGLE_VARIABLE_UPDATED: hookEvents['single-variable-updated'], VARIABLE_UPDATE_ENDED: hookEvents['update-ended'],
            BEFORE_MESSAGE_UPDATE: hookEvents['before-message-update'] },
        getMvuData: read,
        async parseMessage(message, oldData) {
            if (!options.parse)
                throw Error('AUTHOR_NATIVE_MVU_TRIAL_UNAVAILABLE');
            return options.parse(message, oldData);
        },
        async replaceMvuData(data, input = { type: 'chat' }) {
            const selected = selection(input);
            const basis = retained.get(data) ?? reads.get(selected.key) ?? {
                readScope: options.readScope(), numerical: options.snapshot().numerical
            };
            await replaceAtBasis(data, selected, basis);
        },
        /** The envelope owner replaces chat context together with the numbers.
         * Message variables keep the ordinary per-message writer. */
        captureChatVariableReplacement() {
            const snapshot = options.snapshot(), chat = snapshot.scopeFrame.scopes.chat;
            const previousStatData = chat?.kind === 'available' ? chat.variables.stat_data : undefined;
            const basis = { readScope: options.readScope(), numerical: snapshot.numerical };
            return (next) => same(previousStatData, next.stat_data)
                ? false : replaceAtBasis(next, { scope: 'chat' }, basis);
        } };
    return api;
}
