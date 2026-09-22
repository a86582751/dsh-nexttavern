// Generated from runtime/alpha3/src/ui/build-client.mts; edit the TypeScript source.
import { createRequire } from 'node:module';
import { resolve, dirname, basename, relative } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../build-tools/package.json', import.meta.url));
const { build } = require('esbuild');
const { transform } = require('lightningcss');
const [entry, outfile, requestedModuleId, flag, recipeId] = process.argv.slice(2);
if (!entry || !outfile)
    throw new Error('usage: node build-client.mjs <entry> <outfile>');
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicMapping = resolve(packageRoot, 'tools/check-map.json');
const root = existsSync(publicMapping) ? packageRoot : resolve(packageRoot, '../..');
const mappingFile = existsSync(publicMapping) ? publicMapping : resolve(root, 'release/source-manifest.json');
let recipe;
let nodePaths;
let artifacts = [];
if (flag !== undefined) {
    if (flag !== '--recipe' || !recipeId)
        throw Error('Expected --recipe ID');
    const plan = JSON.parse(readFileSync(mappingFile, 'utf8'));
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
    jsx: 'automatic',
    minifyWhitespace: recipe?.browser?.minifyWhitespace ?? false,
    plugins: [{
            name: 'owned-client-assets',
            setup(builder) {
                builder.onResolve({ filter: /^dsh-nexttavern-/ }, args => {
                    if (external.includes(args.path))
                        return { path: args.path, external: true };
                    const artifactId = recipe?.browser?.inlineArtifactImports?.[args.path];
                    const artifact = artifacts.find(item => item.id === artifactId);
                    if (!artifact)
                        throw Error('Unregistered owned browser import: ' + args.path);
                    return { path: resolve(root, artifact.source) };
                });
                builder.onLoad({ filter: /\.css$/ }, args => {
                    const source = relative(root, args.path).replaceAll('\\', '/');
                    // Package-relative stylesheet identities survive compat/ -> development/
                    // projection. Audit still uses the real local source path below.
                    const stylesheet = relative(dirname(resolve(entry)), args.path).replaceAll('\\', '/');
                    const modules = args.path.endsWith('.module.css');
                    const css = transform({ filename: stylesheet, code: readFileSync(args.path), minify: true,
                        cssModules: modules ? { pattern: '[hash]_[local]' } : false });
                    const classes = {};
                    // lightningcss exports come from a native hash map: sort names so
                    // repeated builds produce identical bytes across processes.
                    for (const [name, value] of Object.entries(css.exports ?? {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
                        if (value.composes.length)
                            throw Error('CSS module composition needs an explicit dependency: ' + source);
                        classes[name] = value.name;
                    }
                    // The native module loader claims these tags when it materializes the
                    // factory and removes them on unload. Do not create a second CSS owner.
                    return { loader: 'js', contents: `
          const owner = ${JSON.stringify(moduleId)};
          const key = ${JSON.stringify(moduleId + '/' + stylesheet)};
          if (![...document.querySelectorAll('style[data-plugin-css]')].some(tag => tag.dataset.pluginCss === key)) {
            const style = document.createElement('style');
            style.dataset.plugin = owner; style.dataset.pluginCss = key;
            style.textContent = ${JSON.stringify(css.code.toString())}; document.head.appendChild(style);
          }
          export default ${JSON.stringify(classes)};
        ` };
                });
            },
        }],
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
