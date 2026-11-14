// Generated from runtime/alpha3/src/operations/reader-native-library-assets.mts; edit the TypeScript source.
/** The source manifest owns all mapping and pins; this producer only rebuilds
 * the browser graph and its original licenses. It never installs packages. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function inside(root, source) {
    if (!source || source.includes('\\') || source.includes(':') || source.startsWith('/')
        || source.split('/').some(part => !part || part === '.' || part === '..'))
        throw Error('READER_LIBRARY_PATH_INVALID');
    return path.join(root, ...source.split('/'));
}
export async function buildReaderNativeLibraryAssetsV1(options) {
    const repo = path.resolve(options.repo), { plan } = options, recipe = plan.product?.readerNativeLibraries;
    if (!recipe)
        throw Error('READER_LIBRARY_RECIPE_MISSING');
    const artifact = (id) => {
        const row = plan.artifacts.find(row => row.id === id);
        if (!row)
            throw Error('READER_LIBRARY_ARTIFACT_UNKNOWN: ' + id);
        return row;
    };
    const lockFile = inside(repo, artifact(recipe.lockArtifact).source);
    const require = createRequire(path.join(path.dirname(lockFile), 'package.json'));
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    const esbuild = require('esbuild');
    if (esbuild.version !== recipe.builder.esbuildVersion || lock.packages['node_modules/esbuild']?.version !== esbuild.version)
        throw Error('READER_LIBRARY_BUILDER_PIN_INVALID');
    const outputs = new Map(), inputs = [];
    const registered = new Map(plan.artifacts.map(row => [path.resolve(inside(repo, row.source)), row]));
    for (const [name, version] of Object.entries(recipe.dependencies)) {
        const metadataFile = require.resolve(name + '/package.json');
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        if (metadata.version !== version
            || lock.packages['node_modules/' + name]?.version !== metadata.version)
            throw Error('READER_LIBRARY_PACKAGE_PIN_INVALID');
        const license = recipe.licenses.find(row => row.package === name);
        outputs.set(artifact(license.artifact).source, fs.readFileSync(path.join(path.dirname(metadataFile), 'LICENSE')));
    }
    const result = await esbuild.build({ absWorkingDir: repo,
        entryPoints: [inside(repo, artifact(recipe.entryArtifact).source)], bundle: true,
        format: recipe.builder.format, platform: recipe.builder.platform, target: recipe.builder.target,
        minify: recipe.builder.minify, legalComments: recipe.builder.legalComments, write: false, metafile: true,
        // The build-tools dependency tree may be a shared junction. Its registered
        // logical checkout paths own the pins, not the physical backing checkout.
        preserveSymlinks: true,
        nodePaths: [path.join(path.dirname(lockFile), 'node_modules')], tsconfigRaw: { compilerOptions: {} } });
    if (result.outputFiles?.length !== 1 || !result.metafile)
        throw Error('READER_LIBRARY_OUTPUT_INVALID');
    for (const input of Object.keys(result.metafile.inputs)) {
        const file = path.resolve(repo, input), row = registered.get(file);
        if (!row)
            throw Error('READER_LIBRARY_INPUT_UNREGISTERED: ' + path.relative(repo, file).replaceAll('\\', '/'));
        const digest = sha(fs.readFileSync(file));
        if ((row.sha256 !== undefined && digest !== row.sha256)
            || (file.includes(path.sep + 'node_modules' + path.sep) && !row.sha256))
            throw Error('READER_LIBRARY_INPUT_PIN_INVALID: ' + row.id);
        inputs.push({ artifact: row.id, sha256: digest });
    }
    outputs.set(artifact(recipe.outputArtifact).source, Buffer.from(result.outputFiles[0].contents));
    for (const [source, bytes] of outputs) {
        const file = inside(repo, source);
        if (options.write) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, bytes);
        }
        else if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) {
            throw Error('READER_LIBRARY_GENERATED_STALE: ' + source);
        }
    }
    return { inputs, files: [...outputs].map(([source, bytes]) => ({ path: source, sha256: sha(bytes), bytes: bytes.length })) };
}
