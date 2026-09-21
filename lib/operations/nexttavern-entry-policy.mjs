// Generated from runtime/alpha3/src/operations/nexttavern-entry-policy.mts; edit the TypeScript source.
import * as profileApi from '@deepseek-ai/dsh-app-boot';
import { isDeepStrictEqual } from 'node:util';
import { captureNextTavernProfilePlan } from './nexttavern-profile-plan.mjs';
export const PRODUCT_ENTRY = 'nexttavern';
const states = new WeakMap();
export function loaderEntry(ctx) {
    const entry = ctx[Symbol.for('cordis.entry')];
    if (!entry)
        throw Error('NextTavern requires a Loader entry');
    return entry;
}
export function capture(ctx, patches) {
    if (!ctx.profileContext)
        throw Error('NextTavern requires the alpha.6 profile context');
    const plan = captureNextTavernProfilePlan(ctx.profileContext, profileApi);
    // A file watcher or another writer may already have changed disk. Reject the
    // stale apply instead of combining that disk generation with these entries.
    // The published app-boot artifact inlines an older Include which mutates
    // inserted patch rows. Compare its resulting composition, never mistake
    // those mutated rows for the product-free original configuration.
    if (!Array.isArray(patches) || !isDeepStrictEqual(plan.rows, profileApi.composeEntries([patches]))) {
        throw Error('NextTavern profile changed during composition; retry the profile update');
    }
    return plan;
}
export function composition(ctx) {
    const tree = loaderEntry(ctx).parent.tree;
    const patches = tree.ctx.fiber.entry?.options.config?.patches;
    const previous = states.get(tree);
    if (previous?.applying)
        return previous;
    const fingerprint = JSON.stringify(patches);
    if (previous?.patches === fingerprint)
        return previous;
    const plan = capture(ctx, patches);
    const state = previous ?? { plan, restoring: false, applying: false, patches: fingerprint,
        nativeFibers: new Set(), queue: Promise.resolve() };
    state.plan = plan;
    state.patches = fingerprint;
    states.set(tree, state);
    return state;
}
export function evaluateDisabled(entry, value) {
    return Boolean(value && typeof value === 'object' && '__jsExpr' in value
        ? entry.evaluate(String(value.__jsExpr)) : value);
}
export function productWanted(ctx, state) {
    const row = state.plan.rows.find(candidate => candidate.id === PRODUCT_ENTRY);
    return Boolean(state.plan.selected && row && !evaluateDisabled(loaderEntry(ctx), row.disabled));
}
/** Used only on the official provider rows declared by this product bundle. */
export function nativeProviderDisabled(ctx) {
    const entry = loaderEntry(ctx);
    const state = composition(ctx);
    const original = state.plan.provider({ id: entry.options.id, module: entry.options.name });
    if (!original)
        throw Error(`NextTavern cannot find original provider ${entry.options.id}`);
    if (!state.restoring && productWanted(ctx, state)) {
        if (entry.fiber)
            state.nativeFibers.add(entry.fiber);
        return true;
    }
    return evaluateDisabled(entry, original.row.disabled);
}
/** Resolve from the profile anchor: the caller must use the installed product. */
export const providerDisabledExpression = [
    '(() => {',
    '  const entry = ctx[Symbol.for("cordis.entry")];',
    '  const anchor = new URL("package.json", entry.parent.tree.ctx.baseUrl);',
    '  const require = process.getBuiltinModule("node:module").createRequire(anchor);',
    '  return require("dsh-nexttavern/entry-policy").nativeProviderDisabled(ctx);',
    '})()',
].join('\n');
