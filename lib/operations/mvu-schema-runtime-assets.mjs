// Generated from runtime/alpha3/src/operations/mvu-schema-runtime-assets.mts; edit the TypeScript source.
/** Manifest-owned production bundles and offline guest bytes. Dependency
 * vendoring stays with product-assembly; this builder never installs packages. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createRuntimeAssetSourceScopeV1, createCanonicalRuntimeSourceFiles } from './runtime-asset-source-scope.mjs';
import { TYPESCRIPT_SHARED_DEPENDENCY } from '../core/tavern-typescript-runtime-descriptor.mjs';
// Contract checks intentionally do not import a source-tree runtime helper:
// ordinary operation emission and public layout relocation preserve imports.
const SCHEMA_RUNTIME_NAME = 'dsh-nexttavern-mvu-schema-runtime-v4-update-batch-v1', SCHEMA_RUNTIME_VERSION = '0.4.0';
const SCHEMA_RUNTIME_DESCRIPTOR = 'assets/runtime.json';
const SCHEMA_RUNTIME_PINS = { 'quickjs-emscripten-core': '0.32.0',
    '@jitl/quickjs-wasmfile-release-sync': '0.32.0', '@jitl/quickjs-ffi-types': '0.32.0' };
const schemaAssetSha = (data) => createHash('sha256').update(data).digest('hex');
const schemaAssetPath = (value) => typeof value === 'string' && value.length > 0 && !value.includes('\\')
    && !value.includes(':') && !value.startsWith('/') && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
export function mvuSchemaRuntimeRecipes(product) {
    const recipes = product.mvuSchemaRuntimes ?? [];
    if (new Set(recipes.map(row => row.packageArtifact)).size !== recipes.length) {
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
    const dependencies = SCHEMA_RUNTIME_PINS;
    if (!recipe || recipe.schemaVersion !== 1 || recipe.descriptorOutput !== SCHEMA_RUNTIME_DESCRIPTOR
        || !recipes.includes(recipe) || recipe.executorVersion !== 4
        || !same(recipe.dependencies, dependencies))
        throw Error('SCHEMA_ASSET_RECIPE_INVALID');
    const historical = options.historicalRebuild;
    if (historical && (!options.plan.product.historicalRuntimeRebuilds?.includes(historical)
        || historical.producer !== 'schema-runtime' || historical.packageArtifact !== recipe.packageArtifact)) {
        throw Error('SCHEMA_ASSET_HISTORICAL_REBUILD_INVALID');
    }
    // Ordinary builds cannot mutate an immutable generation. Only the plan-owned
    // historical recipe can produce separate bytes for the assembly's comparison.
    if (recipe.immutableGeneration && !historical)
        throw Error('SCHEMA_ASSET_IMMUTABLE_GENERATION');
    const scope = historical ? createRuntimeAssetSourceScopeV1({ repo, artifacts: options.plan.artifacts,
        sourceBindings: historical.sourceBindings }) : undefined;
    const artifact = (id) => {
        const rows = options.plan.artifacts.filter(row => row.id === id);
        if (rows.length !== 1)
            throw Error('SCHEMA_ASSET_ARTIFACT_UNKNOWN');
        return inside(repo, rows[0].source);
    };
    const metadata = JSON.parse(fs.readFileSync(artifact(recipe.packageArtifact), 'utf8'));
    const packageName = metadata.name, packageVersion = metadata.version;
    if (packageName !== SCHEMA_RUNTIME_NAME || packageVersion !== SCHEMA_RUNTIME_VERSION
        || !same(metadata.dependencies, dependencies))
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
    const realLockPath = fs.realpathSync(lockPath);
    if (!registered.has(realLockPath))
        throw Error('SCHEMA_ASSET_LOCK_UNREGISTERED');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const require = createRequire(path.join(tools, 'package.json'));
    const esbuild = require('esbuild');
    if (esbuild.version !== '0.24.2' || lock.packages?.['node_modules/esbuild']?.version !== '0.24.2') {
        throw Error('SCHEMA_ASSET_BUILDER_VERSION_INVALID');
    }
    for (const [name, version] of Object.entries(dependencies)) {
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
        const entry = scope?.entry(row.artifact) ?? artifact(row.artifact);
        if (!/\.(ts|mts)$/.test(entry))
            throw Error('SCHEMA_ASSET_SOURCE_INVALID');
        const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm',
            // Public projection relocates registered source paths. Omit esbuild's
            // path comments so both layouts rebuild the same executable bytes.
            target: 'es2023', write: false, metafile: true, minifyWhitespace: true, tsconfigRaw: { compilerOptions: {} },
            external: [...Object.keys(dependencies), TYPESCRIPT_SHARED_DEPENDENCY.name],
            legalComments: 'none', ...(scope ? { plugins: [scope.plugin] } : {}) });
        const inputs = Object.keys(result.metafile.inputs).map(file => path.resolve(repo, file));
        for (const file of inputs) {
            if (scope)
                scope.input(file);
            else if (!registered.has(fs.realpathSync(file)))
                throw Error('SCHEMA_ASSET_SOURCE_UNREGISTERED');
        }
        graphs[row.role] = inputs.map(file => path.relative(repo, file).replaceAll('\\', '/')).sort();
        add(row.output, result.outputFiles[0].contents);
        modules[row.role] = row.output;
    }
    if (recipe.guests.length !== 3 || new Set(recipe.guests.map(row => row.kind)).size !== 3)
        throw Error('SCHEMA_ASSET_GUESTS_INVALID');
    const guests = [];
    for (const row of recipe.guests) {
        if (row.kind === 'mvu-196') {
            if (row.packageName !== 'nexttavern-mvu-196-core' || row.version !== '0.196.0-d03b7dc8'
                || row.globalName !== 'NextTavernMvu196' || row.output !== 'assets/mvu-196.js'
                || row.licenseOutput !== 'assets/LICENSE.mvu-196' || !row.licenseArtifacts.length)
                throw Error('SCHEMA_ASSET_GUEST_INVALID');
            for (const [name, version] of Object.entries({ json5: '2.2.3', jsonrepair: '3.13.2', klona: '2.0.6', mathjs: '12.4.1', yaml: '2.8.1' })) {
                const metadata = JSON.parse(fs.readFileSync(inside(libraryRoot, name + '/package.json'), 'utf8'));
                if (metadata.name !== name || metadata.version !== version || lock.packages?.['node_modules/' + name]?.version !== version)
                    throw Error('SCHEMA_ASSET_GUEST_VERSION_INVALID');
            }
            const lockArtifact = options.plan.artifacts.find(item => inside(repo, item.source) === realLockPath);
            const canonical = createCanonicalRuntimeSourceFiles({ repo, artifacts: options.plan.artifacts, libraryRoot,
                lockArtifact: lockArtifact.id });
            const entry = scope?.entry(row.entryArtifact) ?? artifact(row.entryArtifact);
            if (!/\.(ts|mts)$/.test(entry))
                throw Error('SCHEMA_ASSET_SOURCE_INVALID');
            const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'browser', format: 'iife',
                globalName: row.globalName, target: 'es2020', write: false, metafile: true, minify: true,
                nodePaths: [libraryRoot], legalComments: 'none', tsconfigRaw: { compilerOptions: {} },
                plugins: scope ? [scope.plugin] : [canonical.plugin] });
            // Browser-excluded Node modules are esbuild's virtual empty modules,
            // with no source file or vendored dependency bytes to register.
            const inputs = Object.keys(result.metafile.inputs).filter(file => !file.startsWith('(disabled):')).map(file => {
                const logical = path.resolve(repo, file);
                return canonical.physicalByLogical.get(logical) ?? logical;
            });
            for (const file of inputs) {
                if (file.startsWith(libraryRoot + path.sep))
                    continue;
                if (scope)
                    scope.input(file);
                else if (!registered.has(fs.realpathSync(file)))
                    throw Error('SCHEMA_ASSET_SOURCE_UNREGISTERED');
            }
            graphs[row.kind] = inputs.map(file => path.relative(repo, file).replaceAll('\\', '/')).sort();
            const code = result.outputFiles[0].contents;
            // The manifest supplies the actual upstream and transitive declarations,
            // including Apache/ISC notices. Artifact IDs keep projected bytes stable.
            const license = row.licenseArtifacts.map(id => `===== ${id} =====\n${fs.readFileSync(scope?.entry(id) ?? artifact(id), 'utf8').trimEnd()}\n`).join('\n');
            add(row.output, code);
            add(row.licenseOutput, license);
            guests.push({ kind: row.kind, packageName: row.packageName, version: row.version, globalName: row.globalName,
                path: row.output, sha256: schemaAssetSha(code), licensePath: row.licenseOutput });
            continue;
        }
        if (!['zod', 'lodash'].includes(row.kind))
            throw Error('SCHEMA_ASSET_GUEST_INVALID');
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
    const descriptor = { schemaVersion: 2, name: packageName, version: packageVersion,
        modules, guests, dependencies: { ...dependencies }, sharedCompiler: TYPESCRIPT_SHARED_DEPENDENCY,
        ...recipe.scopeInputProtocols ? { scopeInputProtocols: recipe.scopeInputProtocols } : {} };
    add(recipe.descriptorOutput, JSON.stringify(descriptor, null, 2) + '\n');
    if (!historical) {
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
    }
    return { name: packageName, version: packageVersion, graphs, outputs,
        files: [...outputs].map(([output, bytes]) => ({ path: output, sha256: schemaAssetSha(bytes) }))
            .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}
