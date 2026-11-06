// Generated from runtime/alpha3/src/operations/tavern-template-ejs-runtime-assets.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Produce the independent EJS component without starting its provider or VM.
 * The manifest owns source delivery and the existing copier owns dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { materializeBundledLibraries } from './bundled-library-assembly.mjs';
import { EJS_RUNTIME_PACKAGE, EJS_RUNTIME_VERSION } from '../core/tavern-template-ejs-runtime-types.mjs';
import { recordSha256 } from '../core/roleplay-data.js';
const MODULES = Object.freeze({ provider: 'dist/index.mjs', worker: 'dist/tavern-template-ejs-runtime-worker.mjs' });
const PINS = Object.freeze({ ejs: '3.1.10', 'quickjs-emscripten-core': '0.32.0',
    '@jitl/quickjs-wasmfile-release-sync': '0.32.0', '@jitl/quickjs-ffi-types': '0.32.0', yaml: '2.8.1',
    'nexttavern-mvu-lodash': '4.18.1' });
const PACKAGE_DEPENDENCIES = { ...PINS, 'nexttavern-mvu-lodash': 'npm:lodash@' + PINS['nexttavern-mvu-lodash'] };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const samePins = (value, expected = PINS) => JSON.stringify(Object.entries(value).sort())
    === JSON.stringify(Object.entries(expected).sort());
const safe = (value) => !!value && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
    && value.split('/').every(part => !!part && part !== '.' && part !== '..');
function inside(root, relative) {
    if (!safe(relative))
        throw Error('TEMPLATE_EJS_ASSET_PATH_INVALID');
    return path.join(root, ...relative.split('/'));
}
function artifact(plan, id) {
    const row = plan.artifacts.find(item => item.id === id);
    if (!row)
        throw Error('TEMPLATE_EJS_ASSET_ARTIFACT_UNKNOWN: ' + id);
    return row;
}
/** Component role/output identity is local. Global mapping uniqueness and
 * resource membership are supplied by the manifest owner. */
export function templateEjsRuntimeRecipeV1(plan) {
    const recipe = plan.product.templateEjsRuntime;
    if (!recipe)
        return undefined;
    if (recipe.schemaVersion !== 1 || recipe.encoding !== 'owned-template-ejs-runtime-recipe-v1'
        || !samePins(recipe.dependencies) || recipe.modules.length !== 2
        || new Set(recipe.modules.map(row => row.role)).size !== 2
        || recipe.modules.some(row => !Object.hasOwn(MODULES, row.role) || row.output !== MODULES[row.role])) {
        throw Error('TEMPLATE_EJS_ASSET_RECIPE_INVALID');
    }
    return recipe;
}
function metadataAt(repo, plan, recipe) {
    const bytes = fs.readFileSync(inside(repo, artifact(plan, recipe.packageArtifact).source));
    const metadata = JSON.parse(bytes.toString('utf8'));
    if (metadata.name !== EJS_RUNTIME_PACKAGE || metadata.version !== EJS_RUNTIME_VERSION
        || metadata.main !== './' + MODULES.provider || !samePins(metadata.dependencies, PACKAGE_DEPENDENCIES)
        || JSON.stringify([...metadata.bundleDependencies].sort()) !== JSON.stringify(Object.keys(PINS).sort())) {
        throw Error('TEMPLATE_EJS_ASSET_PACKAGE_METADATA_INVALID');
    }
    return bytes;
}
/** Bundle actual provider/controller and worker/replay/host graphs. Their
 * metafiles are the sole source-input inventory for this component. */
export async function buildTavernTemplateEjsRuntimeAssetsV1(options) {
    const repo = fs.realpathSync(options.repo), recipe = templateEjsRuntimeRecipeV1(options.plan);
    if (!recipe)
        throw Error('TEMPLATE_EJS_ASSET_RECIPE_MISSING');
    const metadata = metadataAt(repo, options.plan, recipe);
    const lockFile = inside(repo, artifact(options.plan, recipe.lockArtifact).source), lockBytes = fs.readFileSync(lockFile);
    const lock = JSON.parse(lockBytes.toString('utf8'));
    const require = createRequire(path.join(path.dirname(lockFile), 'package.json'));
    const esbuild = require('esbuild');
    if (esbuild.version !== recipe.builder.esbuildVersion || lock.packages['node_modules/esbuild']?.version !== esbuild.version) {
        throw Error('TEMPLATE_EJS_ASSET_BUILDER_PIN_INVALID');
    }
    const packageRow = options.plan.product.packages.find(row => row.packageArtifact === recipe.packageArtifact);
    if (!packageRow)
        throw Error('TEMPLATE_EJS_ASSET_PACKAGE_UNREGISTERED');
    const resources = packageRow.resources ?? [], registered = new Map(options.plan.artifacts.map(row => [
        path.resolve(inside(repo, row.source)), row
    ]));
    const graphs = {}, outputs = new Map();
    for (const module of recipe.modules) {
        const entry = inside(repo, artifact(options.plan, module.artifact).source);
        const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm',
            target: recipe.builder.target, write: false, metafile: true, minifyWhitespace: true, tsconfigRaw: { compilerOptions: {} },
            external: Object.keys(recipe.dependencies), legalComments: 'none' });
        if (result.outputFiles?.length !== 1 || !result.metafile)
            throw Error('TEMPLATE_EJS_ASSET_OUTPUT_INVALID');
        graphs[module.role] = Object.keys(result.metafile.inputs).map(input => {
            const file = fs.realpathSync(path.resolve(repo, input)), source = registered.get(file);
            if (!source || !/\.(?:ts|mts)$/.test(file))
                throw Error('TEMPLATE_EJS_ASSET_SOURCE_UNREGISTERED: ' + input);
            const resource = resources.find(row => row.artifact === source.id);
            if (!resource || !resource.path.startsWith('src/') || !safe(resource.path)) {
                throw Error('TEMPLATE_EJS_ASSET_SOURCE_RESOURCE_UNREGISTERED: ' + source.id);
            }
            return { artifact: source.id, path: resource.path, sha256: sha(fs.readFileSync(file)) };
        }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
        outputs.set(module.output, Buffer.from(result.outputFiles[0].contents));
    }
    // Only trusted policy DATA is loaded. A content URL keeps repeated development
    // builds aligned with the current policy without loading the provider/worker.
    const policyFile = inside(repo, artifact(options.plan, recipe.policyArtifact).source), policyURL = pathToFileURL(policyFile);
    policyURL.searchParams.set('templateEjsBuild', sha(fs.readFileSync(policyFile)));
    const policy = await import(__rewriteRelativeImportExtension(policyURL.href));
    const descriptor = { schemaVersion: 1, name: EJS_RUNTIME_PACKAGE, version: EJS_RUNTIME_VERSION, modules: MODULES,
        dependencies: PINS, policySha256: recordSha256(policy.EJS_RUNTIME_POLICY) };
    outputs.set(recipe.descriptorOutput, Buffer.from(JSON.stringify(descriptor, null, 2) + '\n'));
    outputs.set(recipe.sourceInputOutput, Buffer.from(JSON.stringify({ schemaVersion: 1,
        encoding: 'owned-template-ejs-runtime-source-inputs-v1', name: EJS_RUNTIME_PACKAGE, version: EJS_RUNTIME_VERSION,
        package: { artifact: recipe.packageArtifact, sha256: sha(metadata) },
        builder: { esbuildVersion: esbuild.version, lock: { artifact: recipe.lockArtifact, sha256: sha(lockBytes) } }, graphs }, null, 2) + '\n'));
    const root = path.resolve(options.packageRoot);
    for (const [output, bytes] of outputs) {
        const file = inside(root, output);
        if (options.write) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, bytes);
        }
        else if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes))
            throw Error('TEMPLATE_EJS_ASSET_GENERATED_STALE: ' + output);
    }
    return { name: EJS_RUNTIME_PACKAGE, version: EJS_RUNTIME_VERSION, graphs,
        files: [...outputs].map(([output, bytes]) => ({ path: output, sha256: sha(bytes) })) };
}
/** The existing lock-aware copier supplies all EJS, QuickJS, WASM/FFI and
 * license files. Dependency closure is evaluated only by that owner. */
export function materializeTavernTemplateEjsRuntimeDependenciesV1(options) {
    const repo = fs.realpathSync(options.repo), recipe = templateEjsRuntimeRecipeV1(options.plan);
    if (!recipe)
        throw Error('TEMPLATE_EJS_ASSET_RECIPE_MISSING');
    return materializeBundledLibraries({ libraryRoot: options.libraryRoot,
        moduleRoot: inside(path.resolve(options.packageRoot), 'node_modules'),
        lockFile: inside(repo, artifact(options.plan, recipe.lockArtifact).source), libraries: recipe.dependencies,
        admit: options.admit, context: options.context });
}
