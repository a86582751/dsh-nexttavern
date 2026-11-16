// Generated from runtime/alpha3/src/core/tavern-mvu-schema-values-merge.ts; edit the TypeScript source.
/** Deletion follows the final candidate, including later array insertions.
 * Only the top-level result changes here, so nested values can be shared. */
export function mergeMvuSchemaValues(before, candidate, parsed, effects) {
    const basis = effects.some(effect => effect?.kind === 'replace-root') ? candidate : before;
    const merged = { ...basis };
    for (const effect of effects) {
        if (effect?.kind !== 'remove-member')
            continue;
        const topRoot = (effect.parent[0] ?? (effect.collection === 'object' ? effect.key : undefined));
        if (Object.hasOwn(parsed, topRoot))
            continue;
        if (Object.hasOwn(candidate, topRoot))
            merged[topRoot] = candidate[topRoot];
        else
            delete merged[topRoot];
    }
    for (const name of Object.keys(parsed))
        merged[name] = parsed[name];
    return merged;
}
