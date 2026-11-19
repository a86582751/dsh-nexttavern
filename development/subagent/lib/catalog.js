// Generated from runtime/alpha3/compat/subagent/src/catalog.ts; edit the TypeScript source.
export function establishCatalogChild(parent, child, descriptor) {
    parent.append('subagent/catalog', { version: 0, childId: child.id, childCreatedAt: child.createdAt,
        mode: 'one-shot', ...(descriptor.label === undefined ? {} : { label: descriptor.label }) });
}
