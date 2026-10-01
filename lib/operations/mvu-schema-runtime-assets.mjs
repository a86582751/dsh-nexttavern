// Generated from runtime/alpha3/src/operations/mvu-schema-runtime-assets.mts; edit the TypeScript source.
/** Manifest-owned production bundles and offline guest bytes. Dependency
 * vendoring stays with product-assembly; this builder never installs packages. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
// Contract checks intentionally do not import a source-tree runtime helper:
// ordinary operation emission and public layout relocation preserve imports.
const SCHEMA_RUNTIME_NAME = 'dsh-nexttavern-mvu-schema-runtime', SCHEMA_RUNTIME_VERSION = '0.3.0';
const SCHEMA_RUNTIME_DESCRIPTOR = 'assets/runtime.json';
const SCHEMA_RUNTIME_PINS = { typescript: '5.9.3', 'quickjs-emscripten-core': '0.32.0',
    '@jitl/quickjs-wasmfile-release-sync': '0.32.0', '@jitl/quickjs-ffi-types': '0.32.0' };
const schemaAssetSha = (data) => createHash('sha256').update(data).digest('hex');
const schemaAssetPath = (value) => typeof value === 'string' && value.length > 0 && !value.includes('\\')
    && !value.includes(':') && !value.startsWith('/') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
/** Legacy plans own one recipe. New plans own one list; accepting both would
 * give the same package two independent producers and ambiguous identities. */
export function mvuSchemaRuntimeRecipes(product) {
    if (product.mvuSchemaRuntime && product.mvuSchemaRuntimes)
        throw Error('SCHEMA_ASSET_RECIPE_DUPLICATE');
    const recipes = product.mvuSchemaRuntimes ?? (product.mvuSchemaRuntime ? [product.mvuSchemaRuntime] : []);
    if (recipes.length > 2 || new Set(recipes.map(row => row.executorVersion ?? 1)).size !== recipes.length) {
        throw Error('SCHEMA_ASSET_RECIPE_DUPLICATE');
    }
    return recipes;
}
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const inside = (root, relative) => {
    if (!schemaAssetPath(relative))
        throw Error('SCHEMA_ASSET_RECIPE_PATH_INVALID');
    return path.join(root, ...relative.split('/'));
};
export async function buildMvuSchemaRuntimeAssets(options) {
    const repo = fs.realpathSync(options.repo), recipes = mvuSchemaRuntimeRecipes(options.plan.product);
    const recipe = options.recipe ?? (recipes.length === 1 ? recipes[0] : undefined);
    if (!recipe || recipe.schemaVersion !== 1 || recipe.descriptorOutput !== SCHEMA_RUNTIME_DESCRIPTOR
        || !recipes.includes(recipe) || ![1, 2].includes(recipe.executorVersion ?? 1)
        || !same(recipe.dependencies, SCHEMA_RUNTIME_PINS))
        throw Error('SCHEMA_ASSET_RECIPE_INVALID');
    const packageName = recipe.executorVersion === 2 ? SCHEMA_RUNTIME_NAME + '-v2' : SCHEMA_RUNTIME_NAME;
    const artifact = (id) => {
        const rows = options.plan.artifacts.filter(row => row.id === id);
        if (rows.length !== 1)
            throw Error('SCHEMA_ASSET_ARTIFACT_UNKNOWN');
        return inside(repo, rows[0].source);
    };
    const metadata = JSON.parse(fs.readFileSync(artifact(recipe.packageArtifact), 'utf8'));
    if (metadata.name !== packageName || metadata.version !== SCHEMA_RUNTIME_VERSION
        || !same(metadata.dependencies, SCHEMA_RUNTIME_PINS))
        throw Error('SCHEMA_ASSET_PACKAGE_INVALID');
    const roles = ['provider', 'compiler', 'compiler-worker', 'runner', 'runner-worker'];
    if (recipe.modules.length !== roles.length || new Set(recipe.modules.map(row => row.role)).size !== roles.length
        || recipe.modules.some(row => !roles.includes(row.role)))
        throw Error('SCHEMA_ASSET_MODULES_INVALID');
    const outputs = new Map();
    const outputNames = new Set();
    const add = (output, bytes) => {
        if (!schemaAssetPath(output) || outputNames.has(output.toLowerCase()))
            throw Error('SCHEMA_ASSET_OUTPUT_INVALID');
        outputNames.add(output.toLowerCase());
        outputs.set(output, typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes));
    };
    // The projected compiler can share installed libraries through a junction.
    // Its registered metadata/lock still belong to the logical tool directory;
    // following the library target must not substitute another project's lock.
    const tools = path.dirname(path.resolve(options.libraryRoot)), libraryRoot = fs.realpathSync(options.libraryRoot);
    const registered = new Set(options.plan.artifacts.map(row => inside(repo, row.source)));
    const lockPath = path.join(tools, 'package-lock.json');
    if (!registered.has(fs.realpathSync(lockPath)))
        throw Error('SCHEMA_ASSET_LOCK_UNREGISTERED');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const require = createRequire(path.join(tools, 'package.json'));
    const esbuild = require('esbuild');
    if (esbuild.version !== '0.24.2' || lock.packages?.['node_modules/esbuild']?.version !== '0.24.2') {
        throw Error('SCHEMA_ASSET_BUILDER_VERSION_INVALID');
    }
    for (const [name, version] of Object.entries(SCHEMA_RUNTIME_PINS)) {
        const installed = JSON.parse(fs.readFileSync(inside(libraryRoot, name + '/package.json'), 'utf8'));
        if (installed.name !== name || installed.version !== version || lock.packages?.['node_modules/' + name]?.version !== version) {
            throw Error('SCHEMA_ASSET_DEPENDENCY_VERSION_INVALID');
        }
    }
    const modules = {};
    const graphs = {};
    for (const row of recipe.modules) {
        if (!row.output.startsWith('dist/') || !row.output.endsWith('.mjs'))
            throw Error('SCHEMA_ASSET_MODULE_OUTPUT_INVALID');
        if (row.role === 'provider' && row.output !== 'dist/index.mjs')
            throw Error('SCHEMA_ASSET_PROVIDER_OUTPUT_INVALID');
        const entry = artifact(row.artifact);
        if (!/\.(ts|mts)$/.test(entry))
            throw Error('SCHEMA_ASSET_SOURCE_INVALID');
        const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm',
            // Public projection relocates registered source paths. Omit esbuild's
            // path comments so both layouts rebuild the same executable bytes.
            target: 'es2023', write: false, metafile: true, minifyWhitespace: true, tsconfigRaw: { compilerOptions: {} },
            external: Object.keys(SCHEMA_RUNTIME_PINS), legalComments: 'none' });
        const inputs = Object.keys(result.metafile.inputs).map(file => path.resolve(repo, file));
        for (const file of inputs)
            if (!registered.has(fs.realpathSync(file)))
                throw Error('SCHEMA_ASSET_SOURCE_UNREGISTERED');
        graphs[row.role] = inputs.map(file => path.relative(repo, file).replaceAll('\\', '/')).sort();
        add(row.output, result.outputFiles[0].contents);
        modules[row.role] = row.output;
    }
    if (recipe.guests.length !== 2 || new Set(recipe.guests.map(row => row.kind)).size !== 2)
        throw Error('SCHEMA_ASSET_GUESTS_INVALID');
    const guests = [];
    for (const row of recipe.guests) {
        const expected = row.kind === 'zod' ? { alias: 'nexttavern-mvu-zod', version: '4.4.3', global: 'z' } :
            { alias: 'nexttavern-mvu-lodash', version: '4.18.1', global: '_' };
        if (row.packageAlias !== expected.alias || row.version !== expected.version || row.globalName !== expected.global
            || !row.output.startsWith('assets/') || !row.licenseOutput.startsWith('assets/'))
            throw Error('SCHEMA_ASSET_GUEST_INVALID');
        const root = inside(libraryRoot, row.packageAlias), guest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        if (guest.name !== row.kind || guest.version !== row.version || guest.license !== 'MIT'
            || lock.packages?.['node_modules/' + row.packageAlias]?.version !== row.version)
            throw Error('SCHEMA_ASSET_GUEST_VERSION_INVALID');
        let code;
        if (row.kind === 'zod') {
            const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [require.resolve(row.packageAlias)], bundle: true, format: 'iife', platform: 'neutral',
                globalName: row.globalName, write: false, minify: true, target: 'es2020', legalComments: 'none' });
            code = result.outputFiles[0].contents;
        }
        else
            code = fs.readFileSync(path.join(root, 'lodash.min.js'));
        const license = fs.readFileSync(path.join(root, 'LICENSE'));
        if (!license.toString('utf8').includes('Permission is hereby granted'))
            throw Error('SCHEMA_ASSET_GUEST_LICENSE_MISSING');
        add(row.output, Buffer.from(code));
        add(row.licenseOutput, license);
        guests.push({ kind: row.kind, packageName: guest.name, version: row.version, globalName: row.globalName,
            path: row.output, sha256: schemaAssetSha(code), licensePath: row.licenseOutput });
    }
    const descriptor = { schemaVersion: 1, name: packageName, version: SCHEMA_RUNTIME_VERSION,
        modules, guests, dependencies: { ...SCHEMA_RUNTIME_PINS } };
    add(recipe.descriptorOutput, JSON.stringify(descriptor, null, 2) + '\n');
    const root = path.resolve(options.packageRoot);
    for (const [output, bytes] of outputs) {
        const target = inside(root, output);
        if (options.write) {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, bytes);
        }
        else if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes))
            throw Error('SCHEMA_ASSET_GENERATED_STALE');
    }
    return { name: packageName, version: SCHEMA_RUNTIME_VERSION, graphs,
        files: [...outputs].map(([output, bytes]) => ({ path: output, sha256: schemaAssetSha(bytes) }))
            .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}
