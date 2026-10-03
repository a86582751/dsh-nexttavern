// Generated from runtime/alpha3/src/core/tavern-template-descriptor.mts; edit the TypeScript source.
/** Proposed owned component recipe. Root must register it in the shared source
 * manifest before assembly. This data does not admit a directory or Host worker. */
import { createHash } from 'node:crypto';
import { recordSha256 } from './roleplay-data.js';
import { freezeTemplateData, TEMPLATE_POLICY_SHA256, templateFail, templateHash, templateExact } from './tavern-template-data.mjs';
export const TEMPLATE_PACKAGE_NAME = 'dsh-nexttavern-template-runtime-v1';
export const TEMPLATE_PACKAGE_VERSION = '0.1.0';
export const TEMPLATE_DESCRIPTOR_PATH = 'assets/runtime.json';
export const TEMPLATE_DEPENDENCY_PINS = freezeTemplateData({ 'quickjs-emscripten-core': '0.32.0',
    '@jitl/quickjs-wasmfile-release-sync': '0.32.0', '@jitl/quickjs-ffi-types': '0.32.0' });
export const TEMPLATE_MODULES = freezeTemplateData({ provider: 'dist/index.mjs', controller: 'dist/controller.mjs',
    worker: 'dist/tavern-template-worker.mjs' });
export const TEMPLATE_COMPONENT_RECIPE_PROPOSAL_V1 = freezeTemplateData({ schemaVersion: 1,
    encoding: 'owned-template-component-recipe-proposal-v1', packageArtifact: 'tavern-template-runtime-v1-package',
    modules: [{ role: 'provider', artifact: 'tavern-template-provider-typescript', output: TEMPLATE_MODULES.provider },
        { role: 'controller', artifact: 'tavern-template-controller-typescript', output: TEMPLATE_MODULES.controller },
        { role: 'worker', artifact: 'tavern-template-worker-typescript', output: TEMPLATE_MODULES.worker }],
    descriptorOutput: TEMPLATE_DESCRIPTOR_PATH, sourceInputOutput: 'assets/source-inputs.json',
    policyArtifact: 'tavern-template-data-generated', lockArtifact: 'inventory-runtime-alpha3-build-tools-package-lock-json',
    dependencies: TEMPLATE_DEPENDENCY_PINS, guests: [],
    builder: { esbuildVersion: '0.24.2', target: 'es2023', format: 'esm', platform: 'node', bundle: true,
        external: Object.keys(TEMPLATE_DEPENDENCY_PINS), write: false, legalComments: 'none' },
    sourceGraph: 'Every bundled TS/MTS input must be shared-manifest registered; no old P0 JS evaluator',
    dependencyClosure: 'Exact pinned core/sync-WASM/FFI package files, wasm and licenses inventoried; no ancestor resolver fallback',
});
export const TEMPLATE_PACKAGE_METADATA_PROPOSAL_V1 = freezeTemplateData({ name: TEMPLATE_PACKAGE_NAME,
    version: TEMPLATE_PACKAGE_VERSION, private: true, type: 'module', license: 'GPL-3.0-only', main: './dist/index.mjs',
    exports: { '.': './dist/index.mjs', './package.json': './package.json' },
    files: ['dist', 'src', 'assets', 'LICENSE', 'NOTICE.md'], dependencies: TEMPLATE_DEPENDENCY_PINS,
    bundleDependencies: Object.keys(TEMPLATE_DEPENDENCY_PINS) });
export const TEMPLATE_DESCRIPTOR_PROPOSAL_V1 = freezeTemplateData({ schemaVersion: 1, name: TEMPLATE_PACKAGE_NAME,
    version: TEMPLATE_PACKAGE_VERSION, modules: TEMPLATE_MODULES, dependencies: TEMPLATE_DEPENDENCY_PINS,
    policySha256: TEMPLATE_POLICY_SHA256 });
export const templateAssetSha = (data) => createHash('sha256').update(data).digest('hex');
export const templateAssetPath = (value) => typeof value === 'string' && value.length > 0
    && value.length <= 1024 && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
    && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
export function normalizeTemplateInventoryV1(input) {
    templateExact(input, ['name', 'version', 'files', 'generation']);
    if (input.name !== TEMPLATE_PACKAGE_NAME || input.version !== TEMPLATE_PACKAGE_VERSION || !templateHash(input.generation)
        || !Array.isArray(input.files) || !input.files.length || input.files.length > 8192)
        templateFail('TEMPLATE_INVENTORY_INVALID');
    const names = new Set(), files = [];
    for (const file of input.files) {
        templateExact(file, ['path', 'sha256']);
        if (!templateAssetPath(file.path) || !templateHash(file.sha256) || names.has(file.path.toLowerCase())) {
            templateFail('TEMPLATE_INVENTORY_INVALID');
        }
        names.add(file.path.toLowerCase());
        files.push({ path: file.path, sha256: file.sha256 });
    }
    files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    for (const entry of ['package.json', TEMPLATE_DESCRIPTOR_PATH, 'assets/source-inputs.json', ...Object.values(TEMPLATE_MODULES),
        'LICENSE', 'NOTICE.md', ...Object.keys(TEMPLATE_DEPENDENCY_PINS).map(name => `node_modules/${name}/package.json`)]) {
        if (!names.has(entry.toLowerCase()))
            templateFail('TEMPLATE_INVENTORY_INCOMPLETE');
    }
    const generation = templateAssetSha(JSON.stringify({ name: input.name, version: input.version, files }));
    if (generation !== input.generation)
        templateFail('TEMPLATE_INVENTORY_GENERATION');
    return freezeTemplateData({ name: TEMPLATE_PACKAGE_NAME, version: TEMPLATE_PACKAGE_VERSION, files, generation });
}
export function templateEngineIdentityV1(inventory) {
    const value = normalizeTemplateInventoryV1(inventory);
    return freezeTemplateData({ schemaVersion: 1, encoding: 'owned-template-engine-identity-v1',
        packageName: TEMPLATE_PACKAGE_NAME, packageVersion: TEMPLATE_PACKAGE_VERSION, protectedGeneration: value.generation,
        implementationSha256: recordSha256({ encoding: 'owned-template-engine-delivery-v1', files: value.files }),
        policySha256: TEMPLATE_POLICY_SHA256, dependencies: TEMPLATE_DEPENDENCY_PINS });
}
