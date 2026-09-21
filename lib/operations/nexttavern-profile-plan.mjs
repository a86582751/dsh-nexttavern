// Generated from runtime/alpha3/src/operations/nexttavern-profile-plan.mts; edit the TypeScript source.
/** Capture user intent before the product's own bundle changes provider rows. */
import { createHash } from 'node:crypto';
import { NEXTTAVERN_BUNDLE } from './nexttavern-lifecycle.mjs';
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function find(rows, id) {
    const found = [];
    function walk(entries, ancestors) {
        for (const row of entries) {
            if (row.id === id)
                found.push({ path: [...ancestors.map(parent => parent.id), id], row, ancestors });
            if (row.group && Array.isArray(row.config))
                walk(row.config, [...ancestors, row]);
        }
    }
    walk(rows, []);
    if (found.length > 1)
        throw Error(`Ambiguous profile row: ${id}`);
    return found[0];
}
/**
 * Synchronous capture uses one read of each profile/home/launch layer. Remove
 * only the product's identified bundle segment, never patches matching a magic
 * expression or rows already mutated by a running Include. Both compositions
 * consequently use the same user inputs. This is a proposed generation, not a
 * claim that a running Loader has already adopted it.
 */
export function captureNextTavernProfilePlan(context, api) {
    const launch = structuredClone(context);
    const profile = api.loadProfileDirectory(NEXTTAVERN_BUNDLE, launch.dir, launch.installAnchor);
    const productLayers = profile.layers.filter(layer => layer.packageName === NEXTTAVERN_BUNDLE);
    if (productLayers.length > 1)
        throw Error('NextTavern appears more than once in the profile bundle list');
    const complete = api.readProfilePatches(NEXTTAVERN_BUNDLE, launch, profile);
    const withoutProduct = [];
    let offset = 0;
    for (const layer of profile.layers) {
        const end = offset + layer.patches.length;
        if (layer.packageName !== NEXTTAVERN_BUNDLE)
            withoutProduct.push(...complete.slice(offset, end));
        offset = end;
    }
    // The tail is the already captured profile, home, launch and telemetry policy.
    // Re-reading it while preparing the fallback could combine two generations.
    withoutProduct.push(...complete.slice(offset));
    const configuredRows = api.composeEntries([complete]);
    const originalRows = api.composeEntries([withoutProduct]);
    const version = createHash('sha256').update(JSON.stringify({
        profile: launch.dir, installAnchor: launch.installAnchor,
        bundles: profile.layers.map(layer => ({ name: layer.packageName, directory: layer.packageDir })),
        complete, withoutProduct,
    })).digest('hex');
    freeze(complete);
    freeze(withoutProduct);
    freeze(configuredRows);
    freeze(originalRows);
    return Object.freeze({
        version,
        selected: productLayers.length === 1,
        patches: complete,
        originalPatches: withoutProduct,
        rows: configuredRows,
        originalRows,
        /** Preserve expressions for the native entry evaluator; never coerce them to booleans here. */
        provider(identity) {
            const intent = find(originalRows, identity.id);
            if (!intent)
                return undefined;
            if (intent.row.name !== identity.module) {
                throw Error(`Provider row ${identity.id} belongs to ${intent.row.name}, expected ${identity.module}`);
            }
            return freeze(intent);
        },
        /**
         * Compare a prior token against this fresh capture under the manager lock.
         * This method does not read disk or prove that any Loader adopted the plan.
         */
        assertVersion(expected) {
            if (expected !== version)
                throw Error('Profile composition changed; prepare a new product activation');
        },
    });
}
