// Generated from runtime/alpha3/src/core/native-card-advanced-material.ts; edit the TypeScript source.
const same = (left, right) => left.target === right.target
    && (left.target !== 'character' || right.target === 'character' && left.characterId === right.characterId);
export function projectNativeCardAdvancedMaterialV1(input) {
    const ownership = new Map();
    for (const span of input.classification.assignments) {
        const current = span.target === 'other' ? { kind: 'unassigned' } : { kind: 'assigned', destination: span.target === 'character' ? { target: 'character', characterId: span.characterId } : { target: span.target } };
        const previous = ownership.get(span.sourceId);
        if (!previous)
            ownership.set(span.sourceId, current);
        else if (previous.kind !== current.kind || previous.kind === 'assigned' && current.kind === 'assigned'
            && !same(previous.destination, current.destination))
            ownership.set(span.sourceId, { kind: 'mixed' });
    }
    const characters = new Map();
    const ruleParts = new Map();
    const unavailable = [];
    const add = (kind, id, text, sourceIds) => {
        if (!text)
            return;
        let destination, reason;
        if (!sourceIds.length)
            reason = 'unmapped-source';
        for (const sourceId of sourceIds) {
            const source = sourceId === null ? undefined : ownership.get(sourceId);
            if (!source) {
                reason = 'unmapped-source';
                break;
            }
            if (source.kind === 'mixed') {
                reason = 'mixed-ownership';
                break;
            }
            if (source.kind === 'unassigned') {
                reason = 'unassigned';
                break;
            }
            if (destination && !same(destination, source.destination)) {
                reason = 'mixed-ownership';
                break;
            }
            destination = source.destination;
        }
        if (reason || !destination) {
            unavailable.push({ kind, id, reason: reason ?? 'unmapped-source' });
            return;
        }
        if (destination.target === 'character') {
            let material = characters.get(destination.characterId);
            if (!material) {
                material = { persona: [], lore: [] };
                characters.set(destination.characterId, material);
            }
            material[kind === 'author' ? 'persona' : 'lore'].push(text);
        }
        else {
            const parts = ruleParts.get(destination.target) ?? [];
            parts.push(text);
            ruleParts.set(destination.target, parts);
        }
    };
    for (const group of input.authorGroups)
        add('author', group.id, group.text, group.sourceIds);
    for (const entry of input.finalLore)
        add('lore', entry.entryId, entry.text, [input.loreSources.get(entry.entryId) ?? null]);
    return { characters: input.classification.characters.flatMap(character => {
            const material = characters.get(character.id);
            return material ? [{ ...character, ...character.aliases ? { aliases: [...character.aliases] } : {},
                    persona: material.persona.join('\n\n'), lore: material.lore.join('\n\n') }] : [];
        }), rules: Object.fromEntries([...ruleParts].map(([target, parts]) => [target, parts.join('\n\n')])), unavailable };
}
