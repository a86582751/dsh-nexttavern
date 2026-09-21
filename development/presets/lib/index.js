// Generated from runtime/alpha3/compat/presets/src/index.ts; edit the TypeScript source.
import AgentPresets, { discoverPresets, SHIPPED_PRESET_ROOT } from '@deepseek-ai/dsh-agent-presets';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export const name = 'nexttavern-presets';
export const inject = AgentPresets.inject;
export const Config = AgentPresets.Config;
// This package lives in the product's private node_modules. The preset's
// include keeps existing preset/lib and resource paths unchanged.
const productBase = new URL('../../../', import.meta.url);
const productRoot = fileURLToPath(new URL('preset/catalog', productBase));
const compositionPath = fileURLToPath(new URL('preset/catalog/roleplay/agent.cordis.yml', productBase));
export async function apply(ctx, config) {
    if (!ctx.baseUrl)
        throw Error('NextTavern preset provider requires a Loader base URL');
    const originalRoots = [
        ...(config.includeShippedRoot ? [{ path: SHIPPED_PRESET_ROOT, trust: 'system' }] : []),
        ...config.roots,
        ...(config.includeUserRoot ? [{ path: dshHomePath('.agent-presets'), trust: 'user' }] : []),
    ];
    const expected = await realpath(compositionPath);
    // Scan every root individually. First-root-wins discovery alone could hide
    // a user's same-name preset behind an already configured product root.
    for (const root of originalRoots) {
        const existing = (await discoverPresets([root], ctx.baseUrl)).find(preset => preset.id === 'roleplay');
        if (!existing)
            continue;
        const actual = await realpath(existing.path).catch(() => existing.path);
        if (actual !== expected)
            throw Error(`NextTavern cannot shadow existing roleplay preset: ${existing.path}`);
        // Discovery is first-root-wins. An alias carrying user trust would expose
        // the package directory to the official authoring/remove operations.
        // Reject the root instead of dropping it: it may contain other presets.
        if (root.trust !== 'system') {
            throw Error(`NextTavern product preset cannot use a writable root: ${existing.path}`);
        }
    }
    const productPreset = (await discoverPresets([{ path: productRoot, trust: 'system' }], productBase.href))
        .find(preset => preset.id === 'roleplay');
    if (!productPreset || productPreset.broken) {
        throw Error(`NextTavern roleplay preset is unavailable: ${productPreset?.broken ?? 'missing composition'}`);
    }
    const roots = config.roots.filter(root => root.path !== productRoot);
    // The official roster remains the sole service/RPC owner. Its standing
    // mounts are children of this product fiber and are released with it.
    // Package names in our preset resolve through the private product graph;
    // relative includes still resolve beside each composition file.
    await ctx.extend({ baseUrl: productBase.href }).plugin(AgentPresets, {
        ...config, roots: [...roots, { path: productRoot, trust: 'system' }],
    });
}
