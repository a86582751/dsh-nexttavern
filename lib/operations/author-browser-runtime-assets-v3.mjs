// Generated from runtime/alpha3/src/operations/author-browser-runtime-assets-v3.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Browser3 delivers the actual Worker/VM/compiler bytes. Native Main belongs
 * to the product UI build and has no executable module in this package. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { contained as inside } from './public-transaction.mjs';
import { materializeBundledLibraries } from './bundled-library-assembly.mjs';
import { AUTHOR_BROWSER_RUNTIME_NAME_V3, AUTHOR_BROWSER_RUNTIME_VERSION_V3, AUTHOR_BROWSER_RUNTIME_PINS_V3, AUTHOR_BROWSER_MODULES_V3, AUTHOR_BROWSER_WASM_V3, AUTHOR_BROWSER_WASM_SHA256_V3, authorBrowserAssetShaV3 } from '../core/tavern-author-browser-descriptor-v3.mjs';
export function authorBrowserRuntimeRecipeV3(plan) {
    const recipe = plan.product.authorBrowserRuntimeV3;
    if (!recipe)
        return undefined;
    if (recipe.schemaVersion !== 3 || recipe.encoding !== 'owned-author-browser-runtime-recipe-v3'
        || recipe.modules.length !== Object.keys(AUTHOR_BROWSER_MODULES_V3).length
        || new Set(recipe.modules.map(row => row.role)).size !== recipe.modules.length
        || recipe.modules.some(row => row.output !== AUTHOR_BROWSER_MODULES_V3[row.role])
        || JSON.stringify(Object.entries(recipe.dependencies).sort()) !== JSON.stringify(Object.entries(AUTHOR_BROWSER_RUNTIME_PINS_V3).sort()))
        throw Error('AUTHOR_BROWSER_V3_ASSET_RECIPE_INVALID');
    return recipe;
}
export async function buildAuthorBrowserRuntimeAssetsV3(options) {
    const repo = fs.realpathSync(options.repo), recipe = authorBrowserRuntimeRecipeV3(options.plan);
    if (!recipe)
        throw Error('AUTHOR_BROWSER_V3_ASSET_RECIPE_MISSING');
    const find = (id) => {
        const item = options.plan.artifacts.find(row => row.id === id);
        if (!item)
            throw Error('AUTHOR_BROWSER_V3_ARTIFACT_UNKNOWN: ' + id);
        return item;
    };
    const lockFile = inside(repo, find(recipe.lockArtifact).source);
    const esbuild = createRequire(path.join(path.dirname(lockFile), 'package.json'))('esbuild');
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    if (esbuild.version !== recipe.builder.esbuildVersion || lock.packages['node_modules/esbuild']?.version !== esbuild.version)
        throw Error('AUTHOR_BROWSER_V3_BUILDER_PIN_INVALID');
    const resources = options.plan.product.packages.find(row => row.packageArtifact === recipe.packageArtifact)?.resources;
    if (!resources)
        throw Error('AUTHOR_BROWSER_V3_PACKAGE_UNREGISTERED');
    const registered = new Map(options.plan.artifacts.map(item => [path.resolve(inside(repo, item.source)), item]));
    const root = path.resolve(options.packageRoot), libraries = fs.realpathSync(options.libraryRoot);
    // esbuild uses file names in its lazy-module functions. Keep their manifest
    // identity when public delivery moves the physical source and toolchain.
    const canonicalLibraries = inside(repo, path.posix.dirname(find(recipe.lockArtifact).canonicalSource
        ?? find(recipe.lockArtifact).source) + '/node_modules');
    const physicalByLogical = new Map();
    const logicalFile = (physical) => {
        const item = registered.get(physical);
        const logical = physical.startsWith(libraries + path.sep)
            ? path.join(canonicalLibraries, path.relative(libraries, physical))
            : item ? inside(repo, item.canonicalSource ?? item.source) : physical;
        physicalByLogical.set(logical, physical);
        return logical;
    };
    const mappedLayout = libraries !== canonicalLibraries || options.plan.artifacts.some(item => item.canonicalSource !== undefined && item.canonicalSource !== item.source);
    const canonicalFiles = { name: 'manifest-source-identity', setup(build) {
            build.onResolve({ filter: /.*/ }, async (args) => {
                if (args.pluginData?.canonicalResolution)
                    return;
                const result = await build.resolve(args.path, { kind: args.kind, namespace: args.namespace,
                    importer: physicalByLogical.get(args.importer) ?? args.importer, resolveDir: args.resolveDir,
                    pluginData: { canonicalResolution: true } });
                if (result.external || result.errors.length)
                    return result;
                return { ...result, path: logicalFile(fs.realpathSync(result.path)) };
            });
            build.onLoad({ filter: /.*/, namespace: 'file' }, args => {
                const physical = physicalByLogical.get(args.path);
                if (!physical)
                    return;
                const extension = path.extname(physical);
                const loader = extension === '.json' ? 'json'
                    : extension === '.ts' || extension === '.mts' || extension === '.cts' ? 'ts' : 'js';
                return { contents: fs.readFileSync(physical), loader, resolveDir: path.dirname(physical) };
            });
        } };
    const outputs = new Map(), graphs = {};
    const bundledDependencies = {};
    const prefix = path.posix.dirname(find(recipe.packageArtifact).source);
    for (const output of [...Object.values(AUTHOR_BROWSER_MODULES_V3), recipe.descriptorOutput, recipe.sourceInputOutput, recipe.wasmOutput])
        if (!options.plan.artifacts.some(item => item.source === prefix + '/' + output))
            throw Error('AUTHOR_BROWSER_V3_OUTPUT_UNREGISTERED: ' + output);
    for (const module of recipe.modules) {
        const browser = module.role === 'execution-worker';
        // Match the actual Node Worker fixture: the HTML parsers are bundled from
        // the locked build-tools installation, and their CJS leaves need an ESM
        // require owner. The execution Worker stays a self-contained browser script.
        const alias = browser ? undefined : { parse5: inside(libraries, 'parse5/dist/index.js'),
            'css-tree/parser': inside(libraries, 'css-tree/lib/parser/index.js'),
            'css-tree/walker': inside(libraries, 'css-tree/lib/walker/index.js') };
        const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [inside(repo, find(module.artifact).source)],
            bundle: true, platform: browser ? 'browser' : 'node', format: browser ? 'iife' : 'esm', target: recipe.builder.target,
            write: false, metafile: true, minifyWhitespace: true, legalComments: 'none', nodePaths: [libraries],
            external: browser ? [] : Object.keys(recipe.dependencies), alias,
            ...(mappedLayout ? { plugins: [canonicalFiles] } : {}),
            banner: browser ? undefined : { js: "import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);" },
            tsconfigRaw: { compilerOptions: {} } });
        if (result.outputFiles?.length !== 1 || !result.metafile)
            throw Error('AUTHOR_BROWSER_V3_OUTPUT_INVALID');
        const sources = [];
        for (const input of Object.keys(result.metafile.inputs)) {
            const logical = path.resolve(repo, input);
            const file = fs.realpathSync(physicalByLogical.get(logical) ?? logical), source = registered.get(file);
            if (file.startsWith(libraries + path.sep)) {
                bundledDependencies[path.relative(libraries, file).replaceAll('\\', '/')] = authorBrowserAssetShaV3(fs.readFileSync(file));
                continue;
            }
            const resource = source && resources.find(row => row.artifact === source.id);
            if (!source || !resource?.path.startsWith('src/') || !/\.(?:ts|mts)$/.test(file))
                throw Error('AUTHOR_BROWSER_V3_SOURCE_UNREGISTERED: ' + input);
            sources.push({ artifact: source.id, path: resource.path, sha256: authorBrowserAssetShaV3(fs.readFileSync(file)) });
        }
        graphs[module.role] = sources.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
        outputs.set(module.output, Buffer.from(result.outputFiles[0].contents));
    }
    const wasm = fs.readFileSync(inside(libraries, '@jitl/quickjs-wasmfile-release-asyncify/dist/emscripten-module.wasm'));
    if (authorBrowserAssetShaV3(wasm) !== AUTHOR_BROWSER_WASM_SHA256_V3)
        throw Error('AUTHOR_BROWSER_V3_WASM_IDENTITY');
    outputs.set(recipe.wasmOutput, wasm);
    const policyURL = pathToFileURL(inside(repo, find(recipe.policyArtifact).source));
    policyURL.searchParams.set('authorBrowserBuildV3', authorBrowserAssetShaV3(JSON.stringify(graphs)));
    const policy = await import(__rewriteRelativeImportExtension(policyURL.href));
    outputs.set(recipe.descriptorOutput, Buffer.from(JSON.stringify({ schemaVersion: 3, name: AUTHOR_BROWSER_RUNTIME_NAME_V3,
        version: AUTHOR_BROWSER_RUNTIME_VERSION_V3, modules: AUTHOR_BROWSER_MODULES_V3, dependencies: AUTHOR_BROWSER_RUNTIME_PINS_V3,
        wasm: { path: AUTHOR_BROWSER_WASM_V3, sha256: AUTHOR_BROWSER_WASM_SHA256_V3 },
        profileSha256: policy.BROWSER_PROFILE_V3.sha256, capabilityContractSha256: policy.BROWSER_CAPABILITY_CONTRACT_V3.contractSha256 }, null, 2) + '\n'));
    outputs.set(recipe.sourceInputOutput, Buffer.from(JSON.stringify({ schemaVersion: 3,
        encoding: 'owned-author-browser-runtime-source-inputs-v3', name: AUTHOR_BROWSER_RUNTIME_NAME_V3,
        version: AUTHOR_BROWSER_RUNTIME_VERSION_V3, graphs, bundledDependencies }, null, 2) + '\n'));
    for (const [output, bytes] of outputs) {
        const file = inside(root, output);
        if (options.write) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, bytes);
        }
        else if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes))
            throw Error('AUTHOR_BROWSER_V3_GENERATED_STALE: ' + output);
    }
    return { name: AUTHOR_BROWSER_RUNTIME_NAME_V3, version: AUTHOR_BROWSER_RUNTIME_VERSION_V3, graphs,
        files: [...outputs].map(([output, bytes]) => ({ path: output, sha256: authorBrowserAssetShaV3(bytes) })) };
}
export function materializeAuthorBrowserRuntimeDependenciesV3(options) {
    const recipe = authorBrowserRuntimeRecipeV3(options.plan);
    if (!recipe)
        throw Error('AUTHOR_BROWSER_V3_ASSET_RECIPE_MISSING');
    const lock = options.plan.artifacts.find(item => item.id === recipe.lockArtifact);
    if (!lock)
        throw Error('AUTHOR_BROWSER_V3_LOCK_UNKNOWN');
    return materializeBundledLibraries({ libraryRoot: options.libraryRoot, moduleRoot: inside(path.resolve(options.packageRoot), 'node_modules'),
        lockFile: inside(fs.realpathSync(options.repo), lock.source), libraries: recipe.dependencies, admit: options.admit });
}
