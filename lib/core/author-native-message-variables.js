// Generated from runtime/alpha3/src/core/author-native-message-variables.ts; edit the TypeScript source.
/** Shared captured-message view, serialized into author realms. Ordinary
 * addresses come from Native selection facts, never MVU publication owners. */
export function createAuthorNativeMessageVariables(snapshot) {
    const key = (target) => {
        const identity = target.identity, variant = identity.variant;
        return JSON.stringify([identity.ownerSessionId, identity.nativeSeq, identity.messageId,
            variant.kind, variant.kind === 'opening-variant' ? variant.id : null]);
    };
    let captures;
    const captured = (target) => {
        if (!target)
            return;
        if (!captures) {
            captures = new Map();
            for (const capture of snapshot.ordinaryMessages ?? []) {
                const address = capture.root.namespace.target;
                if (address)
                    captures.set(key(address), capture);
            }
        }
        return captures.get(key(target));
    };
    const overlay = (base, capture) => {
        const values = { ...base, ...capture?.values };
        for (const name of capture?.deletedKeys ?? [])
            delete values[name];
        // Numerical presence and value belong solely to the actual MVU row.
        if (base && Object.hasOwn(base, 'stat_data'))
            values.stat_data = base.stat_data;
        else
            delete values.stat_data;
        return values;
    };
    const forMessage = (message) => {
        const capture = captured(message?.ordinary?.selectedTarget);
        const base = message?.variables.kind === 'available' ? message.variables.variables : undefined;
        return { message, capture, values: overlay(base, capture) };
    };
    const resolve = (selector, forWrite = false) => {
        const rows = snapshot.messages, id = selector.message_id;
        const message = id === undefined || id === 'latest'
            ? forWrite ? rows.at(-1) : rows.findLast(row => row.role !== 'system')
            : rows[id < 0 ? rows.length + id : id];
        const result = forMessage(message);
        if (forWrite && !result.capture)
            throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
        return result;
    };
    const swipeData = (message) => {
        if (!message.variants)
            return;
        return message.variants.swipes.map((_, index) => {
            const base = message.variants.swipes_data?.[index] ?? undefined;
            const capture = captured(message.ordinary?.variants[index]);
            return base || capture?.exists ? overlay(base, capture) : null;
        });
    };
    const normalizeBodyRows = (rows) => {
        if (!rows.some(row => Object.hasOwn(row, 'message')))
            return;
        // Opening DTOs already carry a bank capability, including whole reads with
        // DATA/swipes. Its existing owner validates those mutations as before.
        if (rows.every(row => {
            const id = row.message_id;
            return Number.isInteger(id) && snapshot.messages[id < 0 ? snapshot.messages.length + id : id]?.variants;
        }) && rows.some(row => Object.keys(row).some(name => name !== 'message_id' && name !== 'message')))
            return;
        let selected;
        for (const row of rows) {
            if (Object.keys(row).some(name => name !== 'message_id' && name !== 'message') || typeof row.message !== 'string')
                throw Error('AUTHOR_NATIVE_MESSAGE_BODY_MIXED_FIELDS_UNSUPPORTED');
            const id = row.message_id;
            if (!Number.isInteger(id))
                throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
            const index = id < 0 ? snapshot.messages.length + id : id, message = snapshot.messages[index];
            if (!message || message.nativeSeq === null)
                throw Error('AUTHOR_NATIVE_MESSAGE_TARGET_UNAVAILABLE');
            if (selected && selected.message_id !== index)
                throw Error('AUTHOR_NATIVE_MESSAGE_BODY_MULTIPLE_TARGETS_UNSUPPORTED');
            selected = { message_id: index, text: row.message, message };
        }
        return selected;
    };
    return { resolve, forMessage, swipeData, normalizeBodyRows };
}
