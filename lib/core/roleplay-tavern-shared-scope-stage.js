// Generated from runtime/alpha3/src/core/roleplay-tavern-shared-scope-stage.ts; edit the TypeScript source.
/** A preparation owns ordered in-memory effects. Native acceptance later
 * publishes this plan through the persistent scope's existing contribution. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { applyAuthorVariableWritesV1 } from './roleplay-author-variable-effects.js';
const text = (value) => value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export function createRoleplayTavernSharedScopeStageV1(capture, priorWrites = [], assertMutationAllowed) {
    let values = capture.baseline.values;
    const writes = [];
    let binding;
    let macros = new WeakMap();
    function apply(changes) {
        if (!changes.length)
            return;
        assertMutationAllowed?.();
        const next = { ...values };
        for (const write of changes) {
            const result = applyAuthorVariableWritesV1({ exists: Object.hasOwn(next, write.key), value: next[write.key] ?? null }, [write]);
            if (result.exists)
                next[write.key] = result.value;
            else
                delete next[write.key];
        }
        values = Object.freeze(next);
        writes.push(...changes);
        binding = undefined;
        macros = new WeakMap();
    }
    function scopeBinding() {
        if (binding)
            return binding;
        const valuesSha256 = recordSha256(values);
        binding = { scope: 'global', ownerId: capture.address.profileId, values, valuesSha256,
            versionSha256: recordSha256({ root: capture.baseline.root, writes }) };
        return binding;
    }
    apply(priorWrites);
    return {
        get values() { return values; },
        read: (key) => values[key],
        apply,
        binding: scopeBinding,
        macros(base) {
            let result = macros.get(base);
            if (result)
                return result;
            const scope = scopeBinding(), globalVariables = Object.entries(values).map(([key, value]) => {
                const rendered = text(value);
                return { key, value: rendered, valueSha256: sha256(rendered), read: { kind: 'variable', purpose: 'read', scope: 'global',
                        ownerId: scope.ownerId, key, present: true, versionSha256: scope.versionSha256,
                        valueSha256: recordSha256(value), entryId: null, sourcePointer: null } };
            });
            result = Object.freeze({ ...base, globalVariables,
                variableScopes: { ...base.variableScopes, global: scope } });
            macros.set(base, result);
            return result;
        },
        plan() { return { ...capture, writes: [...writes] }; },
    };
}
