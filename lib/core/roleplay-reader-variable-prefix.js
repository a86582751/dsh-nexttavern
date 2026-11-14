// Generated from runtime/alpha3/src/core/roleplay-reader-variable-prefix.ts; edit the TypeScript source.
export function readerVariableBase(scopes, ordinary) {
    const values = (scope) => scope.kind === 'available' ? scope.variables : {};
    const result = { ...values(scopes.global), ...values(scopes.character), ...values(scopes.chat), ...ordinary.values };
    for (const key of ordinary.deletedKeys ?? [])
        delete result[key];
    return result;
}
export function createReaderVariablePrefix() {
    const rows = new Map(), keys = new Map();
    let position = () => undefined;
    function remove(seq) {
        const previous = rows.get(seq);
        if (!previous)
            return;
        for (const key of Object.keys(previous.variables)) {
            const contributors = keys.get(key), at = position(seq);
            let index;
            if (at === undefined)
                index = contributors.indexOf(seq);
            else {
                let low = 0, high = contributors.length;
                while (low < high) {
                    const mid = (low + high) >>> 1;
                    if (position(contributors[mid]) < at)
                        low = mid + 1;
                    else
                        high = mid;
                }
                index = low;
            }
            contributors.splice(index, 1);
            if (!contributors.length)
                keys.delete(key);
        }
        rows.delete(seq);
    }
    function put(row) {
        const seq = row.target.nativeSeq, at = position(seq);
        rows.set(seq, row);
        for (const key of Object.keys(row.variables)) {
            let contributors = keys.get(key);
            if (!contributors) {
                contributors = [];
                keys.set(key, contributors);
            }
            let low = 0, high = contributors.length;
            while (low < high) {
                const mid = (low + high) >>> 1;
                if (position(contributors[mid]) < at)
                    low = mid + 1;
                else
                    high = mid;
            }
            contributors.splice(low, 0, seq);
        }
    }
    return {
        reset(values, nextPosition) {
            rows.clear();
            keys.clear();
            position = nextPosition;
            for (const row of values)
                put(row);
        },
        apply(changes, nextPosition) {
            position = nextPosition;
            // Retire old page/version fields before adding their replacements. A
            // missing field reveals an earlier contribution; it is not a tombstone.
            // A removed selection no longer has a current position. Retire those
            // rows first so the remaining ordered lists can use the owner's ranks.
            for (const change of changes)
                if (position(change.seq) === undefined)
                    remove(change.seq);
            for (const change of changes)
                if (position(change.seq) !== undefined)
                    remove(change.seq);
            for (const change of changes)
                if (change.row)
                    put(change.row);
        },
        read(target, base) {
            const actual = rows.get(target.nativeSeq)?.target;
            if (!actual || actual.ownerSessionId !== target.ownerSessionId || actual.messageId !== target.messageId
                || actual.messageVersionSha256 !== target.messageVersionSha256 || actual.selectedVariant !== target.selectedVariant)
                throw Error('READER_VARIABLE_TARGET_UNAVAILABLE');
            const through = position(target.nativeSeq), result = { ...base };
            for (const [key, contributors] of keys) {
                let low = 0, high = contributors.length;
                while (low < high) {
                    const mid = (low + high) >>> 1;
                    if (position(contributors[mid]) <= through)
                        low = mid + 1;
                    else
                        high = mid;
                }
                if (low)
                    result[key] = rows.get(contributors[low - 1]).variables[key];
            }
            return result;
        },
    };
}
