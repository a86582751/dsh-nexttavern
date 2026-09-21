// Generated from runtime/alpha3/src/ui/build-client.mts; edit the TypeScript source.
import { createRequire } from 'node:module';
import { resolve, dirname, basename, relative } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../build-tools/package.json', import.meta.url));
const { build } = require('esbuild');
const [entry, outfile, requestedModuleId, flag, recipeId] = process.argv.slice(2);
if (!entry || !outfile)
    throw new Error('usage: node build-client.mjs <entry> <outfile>');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
let recipe;
let nodePaths;
let artifacts = [];
if (flag !== undefined) {
    if (flag !== '--recipe' || !recipeId)
        throw Error('Expected --recipe ID');
    const plan = JSON.parse(readFileSync(resolve(root, 'release/source-manifest.json'), 'utf8'));
    recipe = plan.builds.find(item => item.id === recipeId);
    if (!recipe?.browser || resolve(root, recipe.entry) !== resolve(entry))
        throw Error('Browser recipe entry mismatch');
    if (requestedModuleId && requestedModuleId !== recipe.browser.moduleId)
        throw Error('Browser recipe module identity mismatch');
    nodePaths = plan.typeScript.declarationPackages.map(directory => resolve(root, directory, 'node_modules'));
    artifacts = plan.artifacts;
}
const moduleId = recipe?.browser?.moduleId ?? requestedModuleId ?? 'dsh-roleplay-ui';
const external = recipe?.browser?.external ?? ['react', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'];
const result = await build({
    metafile: true,
    absWorkingDir: dirname(resolve(entry)),
    entryPoints: [basename(entry)],
    outfile: resolve(outfile),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    external,
    nodePaths,
    write: false,
    banner: {
        js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(moduleId)}, factory: function (require) { var module = { exports: {} }; var exports = module.exports;`,
    },
    footer: {
        js: 'return module.exports; } });',
    },
    logLevel: 'info',
});
if (recipe?.browser) {
    for (const input of Object.keys(result.metafile.inputs)) {
        const file = resolve(dirname(resolve(entry)), input);
        const source = relative(root, file).replaceAll('\\', '/');
        const artifact = artifacts.find(item => item.source === source);
        if (!artifact)
            throw Error('Unregistered browser dependency: ' + source);
        if (source.includes('/node_modules/')) {
            if (!artifact.sha256 || createHash('sha256').update(readFileSync(file)).digest('hex') !== artifact.sha256) {
                throw Error('Pinned browser dependency differs: ' + source);
            }
        }
    }
    const actual = [...new Set(Object.values(result.metafile.outputs)
            .flatMap(output => output.imports.filter(item => item.external).map(item => item.path)))].sort();
    if (JSON.stringify(actual) !== JSON.stringify([...external].sort())) {
        throw Error('Browser shared-module contract differs: ' + actual.join(', '));
    }
}
mkdirSync(dirname(resolve(outfile)), { recursive: true });
writeFileSync(resolve(outfile), result.outputFiles[0].contents);
writeFileSync(resolve(outfile) + '.meta.json', JSON.stringify(result.metafile, null, 2) + '\n');
