// Generated from runtime/alpha3/src/operations/author-host-runtime-assets.mts; edit the TypeScript source.
/** Minimal Host5 producer: maintained provider/replay/journal source is one
 * actual bundle. Existing assembly owns package metadata/resources delivery. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { createRuntimeAssetSourceScopeV1 } from './runtime-asset-source-scope.mjs';
const supportedPackageNames = ['dsh-nexttavern-author-host-runtime-v5', 'dsh-nexttavern-author-host-runtime-v5-policy',
    'dsh-nexttavern-author-host-runtime-v5-policy-init-chat-v1',
    'dsh-nexttavern-author-host-runtime-v5-named-worldbooks-persona-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-save-next-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-save-joins-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-save-facts-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-save-step-facts-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-save-continuous-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-save-codec-v1',
    'dsh-nexttavern-author-host-runtime-v5-native-personas-save-material-owner-v1',
    'dsh-nexttavern-author-host-runtime-v5-source-html-v1',
    'dsh-nexttavern-author-host-runtime-v5-source-html-checked-journal-v1',
    'dsh-nexttavern-author-host-runtime-v5-server-candidates-v1',
    'dsh-nexttavern-author-host-runtime-v5-server-candidates-v2'];
const providerOutput = 'dist/index.mjs', sourceInputOutput = 'assets/source-inputs.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const safe = (value) => !!value && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
    && value.split('/').every(part => !!part && part !== '.' && part !== '..');
function inside(root, relative) {
    if (!safe(relative))
        throw Error('AUTHOR_HOST_ASSET_PATH_INVALID');
    return path.join(root, ...relative.split('/'));
}
function artifact(plan, id) {
    const found = plan.artifacts.find(row => row.id === id);
    if (!found)
        throw Error('AUTHOR_HOST_ASSET_ARTIFACT_UNKNOWN: ' + id);
    return found;
}
/** Manifest uniqueness and public mappings stay with the existing plan owner;
 * this producer owns only its single provider role and generation recipe. */
export function authorHostRuntimeRecipeV5(plan, historicalRebuild) {
    if (historicalRebuild && (historicalRebuild.producer !== 'author-host-runtime'
        || !plan.product.historicalRuntimeRebuilds?.includes(historicalRebuild))) {
        throw Error('AUTHOR_HOST_ASSET_HISTORY_UNREGISTERED');
    }
    const recipe = historicalRebuild?.producer === 'author-host-runtime'
        ? historicalRebuild.recipe : plan.product.authorHostRuntime;
    if (!recipe)
        return undefined;
    if (recipe.schemaVersion !== 1 || recipe.encoding !== 'owned-author-host-runtime-recipe-v5'
        || recipe.modules.length !== 1 || recipe.modules[0].role !== 'provider' || recipe.modules[0].output !== providerOutput
        || recipe.sourceInputOutput !== sourceInputOutput || Object.keys(recipe.dependencies).length !== 0
        || recipe.builder.esbuildVersion !== '0.24.2' || recipe.builder.target !== 'es2023'
        || recipe.builder.bundle !== true || recipe.builder.write !== false || recipe.builder.legalComments !== 'none'
        || recipe.sourceGraph !== 'esbuild-metafile-input-sha256' || recipe.dependencyClosure !== 'bundled-owned-host-source-only') {
        throw Error('AUTHOR_HOST_ASSET_RECIPE_INVALID');
    }
    return recipe;
}
export async function buildAuthorHostRuntimeAssetsV5(options) {
    const repo = fs.realpathSync(options.repo), recipe = authorHostRuntimeRecipeV5(options.plan, options.historicalRebuild);
    if (!recipe)
        throw Error('AUTHOR_HOST_ASSET_RECIPE_MISSING');
    if (options.historicalRebuild?.packageArtifact !== undefined
        && options.historicalRebuild.packageArtifact !== recipe.packageArtifact)
        throw Error('AUTHOR_HOST_ASSET_HISTORY_PACKAGE');
    const packageArtifact = artifact(options.plan, recipe.packageArtifact);
    const metadataBytes = fs.readFileSync(inside(repo, packageArtifact.source));
    const metadata = JSON.parse(metadataBytes.toString('utf8'));
    const packageName = metadata.name, packageVersion = metadata.version;
    if (!supportedPackageNames.includes(packageName) || packageVersion !== '0.5.2' || metadata.main !== './' + providerOutput
        || metadata.exports['.'] !== './' + providerOutput || metadata.exports['./package.json'] !== './package.json'
        || Object.keys(metadata.dependencies ?? {}).length !== 0 || (metadata.bundleDependencies ?? []).length !== 0) {
        throw Error('AUTHOR_HOST_ASSET_PACKAGE_INVALID');
    }
    const packageRow = options.plan.product.packages.find(row => row.packageArtifact === recipe.packageArtifact);
    if (!packageRow)
        throw Error('AUTHOR_HOST_ASSET_PACKAGE_UNREGISTERED');
    const resources = packageRow.resources ?? [], prefix = path.posix.dirname(packageArtifact.source);
    for (const output of [providerOutput, sourceInputOutput]) {
        if (!options.plan.artifacts.some(row => row.source === prefix + '/' + output)) {
            throw Error('AUTHOR_HOST_ASSET_OUTPUT_UNREGISTERED: ' + output);
        }
    }
    const lockArtifact = artifact(options.plan, recipe.lockArtifact), lockFile = inside(repo, lockArtifact.source);
    const lockBytes = fs.readFileSync(lockFile), lock = JSON.parse(lockBytes.toString('utf8'));
    const require = createRequire(path.join(path.dirname(lockFile), 'package.json'));
    const esbuild = require('esbuild');
    if (esbuild.version !== recipe.builder.esbuildVersion || lock.packages['node_modules/esbuild']?.version !== esbuild.version) {
        throw Error('AUTHOR_HOST_ASSET_BUILDER_PIN_INVALID');
    }
    const sourceScope = options.historicalRebuild ? createRuntimeAssetSourceScopeV1({ repo, artifacts: options.plan.artifacts,
        sourceBindings: options.historicalRebuild.sourceBindings }) : undefined;
    const registered = sourceScope ? undefined : new Map(options.plan.artifacts.map(row => [path.resolve(inside(repo, row.source)), row]));
    const module = recipe.modules[0], entry = sourceScope?.entry(module.artifact)
        ?? inside(repo, artifact(options.plan, module.artifact).source);
    const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm',
        target: recipe.builder.target, write: false, metafile: true, minifyWhitespace: true,
        tsconfigRaw: { compilerOptions: {} }, legalComments: 'none', ...(sourceScope ? { plugins: [sourceScope.plugin] } : {}) });
    const output = result.outputFiles?.[0];
    if (!output || result.outputFiles?.length !== 1 || !result.metafile)
        throw Error('AUTHOR_HOST_ASSET_OUTPUT_INVALID');
    const inputs = Object.keys(result.metafile.inputs).map(input => {
        const scoped = sourceScope?.input(path.resolve(repo, input)), file = scoped?.physicalFile ?? fs.realpathSync(path.resolve(repo, input)), source = scoped?.artifact ?? registered?.get(file);
        if (!source || !file.startsWith(repo + path.sep) || !/\.(?:ts|mts)$/.test(file)) {
            throw Error('AUTHOR_HOST_ASSET_SOURCE_UNREGISTERED: ' + input);
        }
        const resource = resources.find(row => row.artifact === source.id || row.artifact === scoped?.physicalArtifact.id);
        if (!resource || !resource.path.startsWith('src/') || !safe(resource.path)) {
            throw Error('AUTHOR_HOST_ASSET_SOURCE_RESOURCE_UNREGISTERED: ' + source.id);
        }
        return { artifact: source.id, path: resource.path, sha256: scoped?.sha256 ?? sha(fs.readFileSync(file)) };
    }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    const graphs = { provider: inputs }, outputs = new Map();
    outputs.set(providerOutput, Buffer.from(output.contents));
    outputs.set(sourceInputOutput, Buffer.from(JSON.stringify({ schemaVersion: 1,
        encoding: 'owned-author-host-runtime-source-inputs-v5', name: packageName, version: packageVersion,
        package: { artifact: recipe.packageArtifact, sha256: sha(metadataBytes) },
        builder: { esbuildVersion: esbuild.version, lock: { artifact: recipe.lockArtifact, sha256: sha(lockBytes) } },
        dependencyClosure: recipe.dependencyClosure, graphs }, null, 2) + '\n'));
    const root = path.resolve(options.packageRoot);
    if (!options.historicalRebuild)
        for (const [output, bytes] of outputs) {
            const file = inside(root, output);
            if (options.write) {
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, bytes);
            }
            else if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes))
                throw Error('AUTHOR_HOST_ASSET_GENERATED_STALE: ' + output);
        }
    return { name: packageName, version: packageVersion, graphs, outputs,
        files: [...outputs].map(([output, bytes]) => ({ path: output, sha256: sha(bytes) })) };
}
