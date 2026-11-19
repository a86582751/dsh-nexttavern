// Generated from runtime/alpha3/src/core/roleplay-author-variable-effects.ts; edit the TypeScript source.
const frozen = new WeakSet();
export function freezeAuthorVariableDataV1(value) {
    if (value && typeof value === 'object') {
        if (frozen.has(value))
            return value;
        for (const child of Object.values(value))
            freezeAuthorVariableDataV1(child);
        Object.freeze(value);
        frozen.add(value);
    }
    return value;
}
const appendText = (value) => value === null ? '' :
    typeof value === 'object' ? JSON.stringify(value) : String(value);
export function applyAuthorVariableWritesV1(before, writes) {
    let { exists, value } = before;
    for (const write of writes) {
        if (write.operation === 'delete') {
            exists = false;
            value = null;
            continue;
        }
        if (write.operation === 'set')
            value = write.value;
        else if (write.operation === 'append')
            value = appendText(value) + appendText(write.value);
        else
            value = (Number(value) || 0) + (Number(write.value) || 0);
        exists = true;
    }
    return { exists, value };
}
export function replaceAuthorVariableEffectV1(state, position, contributionId, writes) {
    const effects = state?.effects ?? [];
    let start = effects.length;
    // A replacement changes only its fixed position and dependent suffix.
    while (start > 0 && effects[start - 1].position >= position)
        start--;
    const remove = effects[start]?.contributionId === contributionId && effects[start]?.position === position ? 1 : 0;
    let value = start ? effects[start - 1].result : { exists: false, value: null };
    const insert = writes.length ? { position, contributionId, writes, result: applyAuthorVariableWritesV1(value, writes) } : null, updates = [];
    if (insert)
        value = insert.result;
    let result = start + remove < effects.length ? effects.at(-1).result : value;
    for (let i = start + remove; i < effects.length; i++) {
        const effect = effects[i];
        // Absolute writes own the rest of this key independently of the prefix.
        if (effect.writes.some(write => write.operation === 'set' || write.operation === 'delete'))
            break;
        value = applyAuthorVariableWritesV1(value, effect.writes);
        updates.push({ index: i, effect: { ...effect, result: value } });
        if (i === effects.length - 1)
            result = value;
    }
    return { start, remove, insert, updates, result };
}
export function projectAuthorVariableWritesV1(current, input, eventRef) {
    const contribution = input.contribution, prior = contribution ? current.contributions.get(contribution.id) : undefined, position = prior?.position ?? current.nextPosition, grouped = new Map();
    for (const write of input.writes) {
        const group = grouped.get(write.key) ?? [];
        group.push(write);
        grouped.set(write.key, group);
    }
    const affected = new Set([...(prior?.keys ?? []), ...grouped.keys()]), keys = new Map();
    for (const key of affected) {
        const before = current.keys.get(key), change = replaceAuthorVariableEffectV1(before, position, contribution?.id ?? null, grouped.get(key) ?? []), revision = { revision: (before?.current.revision.revision ?? 0) + 1, head: eventRef };
        keys.set(key, { ...change, current: { key, revision, ...change.result } });
    }
    return { keys, contribution: contribution ? { id: contribution.id,
            value: { position, attemptId: contribution.attemptId, keys: [...grouped.keys()],
                firstSource: prior?.firstSource ?? contribution.source } } : null,
        nextPosition: prior ? current.nextPosition : current.nextPosition + 1 };
}
export function applyAuthorVariableProjectionV1(current, change) {
    for (const [key, value] of change.keys) {
        const state = current.keys.get(key) ?? { effects: [], current: value.current }, shift = (value.insert ? 1 : 0) - value.remove;
        if (value.insert && value.start === state.effects.length)
            state.effects.push(value.insert);
        else
            state.effects.splice(value.start, value.remove, ...(value.insert ? [value.insert] : []));
        for (const update of value.updates)
            state.effects[update.index + shift] = update.effect;
        state.current = value.current;
        current.keys.set(key, state);
    }
    if (change.contribution)
        current.contributions.set(change.contribution.id, change.contribution.value);
    current.nextPosition = change.nextPosition;
}
