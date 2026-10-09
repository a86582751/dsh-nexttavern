// Generated from runtime/alpha3/src/operations/author-prompt-runtime-assets.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** The independent Prompt1 package owns its compiler and QuickJS worker.
 * Manifest mappings and complete locked dependency copying remain with the
 * existing product assembly; no author program runs in this producer. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { materializeBundledLibraries } from './bundled-library-assembly.mjs';
import { AUTHOR_PROMPT_RUNTIME_NAME, AUTHOR_PROMPT_RUNTIME_VERSION, AUTHOR_PROMPT_RUNTIME_PINS, AUTHOR_PROMPT_MODULES, AUTHOR_PROMPT_RUNTIME_DESCRIPTOR, AUTHOR_PROMPT_SOURCE_INPUTS } from '../core/tavern-author-prompt-descriptor.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pinsEqual = (pins) => JSON.stringify(Object.entries(pins).sort())
    === JSON.stringify(Object.entries(AUTHOR_PROMPT_RUNTIME_PINS).sort());
const safe = (value) => !!value && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
    && value.split('/').every(part => !!part && part !== '.' && part !== '..');
function inside(root, relative) {
    if (!safe(relative))
        throw Error('AUTHOR_PROMPT_ASSET_PATH_INVALID');
    return path.join(root, ...relative.split('/'));
}
function artifact(plan, id) {
    const row = plan.artifacts.find(item => item.id === id);
    if (!row)
        throw Error('AUTHOR_PROMPT_ASSET_ARTIFACT_UNKNOWN: ' + id);
    return row;
}
/** Role/output association belongs to this component. Global manifest
 * uniqueness and package resource membership stay with the plan owner. */
export function authorPromptRuntimeRecipeV1(plan) {
    const recipe = plan.product.authorPromptRuntime;
    if (!recipe)
        return undefined;
    const roles = Object.keys(AUTHOR_PROMPT_MODULES);
    if (recipe.schemaVersion !== 1 || recipe.encoding !== 'owned-author-prompt-runtime-recipe-v1'
        || recipe.descriptorOutput !== AUTHOR_PROMPT_RUNTIME_DESCRIPTOR || recipe.sourceInputOutput !== AUTHOR_PROMPT_SOURCE_INPUTS
        || !pinsEqual(recipe.dependencies) || recipe.modules.length !== roles.length
        || new Set(recipe.modules.map(row => row.role)).size !== roles.length
        || recipe.modules.some(row => !Object.hasOwn(AUTHOR_PROMPT_MODULES, row.role) || row.output !== AUTHOR_PROMPT_MODULES[row.role])
        || recipe.builder.esbuildVersion !== '0.24.2' || recipe.builder.target !== 'es2023'
        || recipe.builder.bundle !== true || recipe.builder.write !== false || recipe.builder.legalComments !== 'none'
        || recipe.sourceGraph !== 'esbuild-metafile-input-sha256' || recipe.dependencyClosure !== 'locked-published-prompt-dependencies') {
        throw Error('AUTHOR_PROMPT_ASSET_RECIPE_INVALID');
    }
    return recipe;
}
function metadataAt(repo, plan, recipe) {
    const bytes = fs.readFileSync(inside(repo, artifact(plan, recipe.packageArtifact).source));
    const metadata = JSON.parse(bytes.toString('utf8'));
    if (metadata.name !== AUTHOR_PROMPT_RUNTIME_NAME || metadata.version !== AUTHOR_PROMPT_RUNTIME_VERSION
        || metadata.main !== './' + AUTHOR_PROMPT_MODULES.provider
        || JSON.stringify(metadata.exports) !== JSON.stringify({ '.': './' + AUTHOR_PROMPT_MODULES.provider, './package.json': './package.json' })
        || !pinsEqual(metadata.dependencies)
        || JSON.stringify([...metadata.bundleDependencies].sort()) !== JSON.stringify(Object.keys(AUTHOR_PROMPT_RUNTIME_PINS).sort())) {
        throw Error('AUTHOR_PROMPT_ASSET_PACKAGE_METADATA_INVALID');
    }
    return { bytes, metadata };
}
/** Emit provider and worker ESM plus their policy/source descriptors. Every
 * esbuild input is a registered maintained TS/MTS source resource. */
export async function buildAuthorPromptRuntimeAssetsV1(options) {
    const repo = fs.realpathSync(options.repo), recipe = authorPromptRuntimeRecipeV1(options.plan);
    if (!recipe)
        throw Error('AUTHOR_PROMPT_ASSET_RECIPE_MISSING');
    const metadata = metadataAt(repo, options.plan, recipe);
    const lockFile = inside(repo, artifact(options.plan, recipe.lockArtifact).source);
    const lockBytes = fs.readFileSync(lockFile), lock = JSON.parse(lockBytes.toString('utf8'));
    const require = createRequire(path.join(path.dirname(lockFile), 'package.json'));
    const esbuild = require('esbuild');
    if (esbuild.version !== recipe.builder.esbuildVersion || lock.packages['node_modules/esbuild']?.version !== esbuild.version) {
        throw Error('AUTHOR_PROMPT_ASSET_BUILDER_PIN_INVALID');
    }
    const packageRow = options.plan.product.packages.find(row => row.packageArtifact === recipe.packageArtifact);
    if (!packageRow)
        throw Error('AUTHOR_PROMPT_ASSET_PACKAGE_UNREGISTERED');
    const resources = packageRow.resources ?? [], registered = new Map(options.plan.artifacts.map(row => [
        path.resolve(inside(repo, row.source)), row
    ]));
    const prefix = path.posix.dirname(artifact(options.plan, recipe.packageArtifact).source);
    for (const output of [...Object.values(AUTHOR_PROMPT_MODULES), recipe.descriptorOutput, recipe.sourceInputOutput]) {
        if (!options.plan.artifacts.some(row => row.source === prefix + '/' + output)) {
            throw Error('AUTHOR_PROMPT_ASSET_OUTPUT_UNREGISTERED: ' + output);
        }
    }
    const graphs = {}, outputs = new Map();
    for (const module of recipe.modules) {
        const entry = inside(repo, artifact(options.plan, module.artifact).source);
        const result = await esbuild.build({ absWorkingDir: repo, entryPoints: [entry], bundle: true, platform: 'node', format: 'esm',
            target: recipe.builder.target, write: false, metafile: true, minifyWhitespace: true, tsconfigRaw: { compilerOptions: {} },
            external: Object.keys(recipe.dependencies), legalComments: 'none' });
        if (result.outputFiles?.length !== 1 || !result.metafile)
            throw Error('AUTHOR_PROMPT_ASSET_OUTPUT_INVALID');
        graphs[module.role] = Object.keys(result.metafile.inputs).map(input => {
            const file = fs.realpathSync(path.resolve(repo, input)), source = registered.get(file);
            if (!source || !file.startsWith(repo + path.sep) || !/\.(?:ts|mts)$/.test(file)) {
                throw Error('AUTHOR_PROMPT_ASSET_SOURCE_UNREGISTERED: ' + input);
            }
            const resource = resources.find(row => row.artifact === source.id);
            if (!resource || !resource.path.startsWith('src/') || !safe(resource.path)) {
                throw Error('AUTHOR_PROMPT_ASSET_SOURCE_RESOURCE_UNREGISTERED: ' + source.id);
            }
            return { artifact: source.id, path: resource.path, sha256: sha(fs.readFileSync(file)) };
        }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
        outputs.set(module.output, Buffer.from(result.outputFiles[0].contents));
    }
    // Only trusted emitted policy data is imported. Package admission is not a
    // builder shortcut, and no Prompt provider or author worker is started here.
    const policyFile = inside(repo, artifact(options.plan, recipe.policyArtifact).source), policyURL = pathToFileURL(policyFile);
    policyURL.searchParams.set('authorPromptBuild', sha(JSON.stringify(graphs) + sha(fs.readFileSync(policyFile))));
    const policy = await import(__rewriteRelativeImportExtension(policyURL.href));
    const descriptor = { schemaVersion: 1, name: AUTHOR_PROMPT_RUNTIME_NAME, version: AUTHOR_PROMPT_RUNTIME_VERSION,
        modules: AUTHOR_PROMPT_MODULES, dependencies: AUTHOR_PROMPT_RUNTIME_PINS, profileSha256: policy.PROMPT_PROFILE_SHA256_V1 };
    outputs.set(recipe.descriptorOutput, Buffer.from(JSON.stringify(descriptor, null, 2) + '\n'));
    outputs.set(recipe.sourceInputOutput, Buffer.from(JSON.stringify({ schemaVersion: 1,
        encoding: 'owned-author-prompt-runtime-source-inputs-v1', name: AUTHOR_PROMPT_RUNTIME_NAME,
        version: AUTHOR_PROMPT_RUNTIME_VERSION, package: { artifact: recipe.packageArtifact, sha256: sha(metadata.bytes) },
        builder: { esbuildVersion: esbuild.version, lock: { artifact: recipe.lockArtifact, sha256: sha(lockBytes) } }, graphs }, null, 2) + '\n'));
    const root = path.resolve(options.packageRoot);
    for (const [output, bytes] of outputs) {
        const file = inside(root, output);
        if (options.write) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, bytes);
        }
        else if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes))
            throw Error('AUTHOR_PROMPT_ASSET_GENERATED_STALE: ' + output);
    }
    return { name: AUTHOR_PROMPT_RUNTIME_NAME, version: AUTHOR_PROMPT_RUNTIME_VERSION, graphs,
        files: [...outputs].map(([output, bytes]) => ({ path: output, sha256: sha(bytes) })) };
}
/** The established copier owns published files, lock closure, WASM/FFI and
 * licenses. The Prompt package adds no installation or lifecycle-script path. */
export function materializeAuthorPromptRuntimeDependenciesV1(options) {
    const repo = fs.realpathSync(options.repo), recipe = authorPromptRuntimeRecipeV1(options.plan);
    if (!recipe)
        throw Error('AUTHOR_PROMPT_ASSET_RECIPE_MISSING');
    metadataAt(repo, options.plan, recipe);
    return materializeBundledLibraries({ libraryRoot: options.libraryRoot,
        moduleRoot: inside(path.resolve(options.packageRoot), 'node_modules'),
        lockFile: inside(repo, artifact(options.plan, recipe.lockArtifact).source), libraries: recipe.dependencies, admit: options.admit });
}
