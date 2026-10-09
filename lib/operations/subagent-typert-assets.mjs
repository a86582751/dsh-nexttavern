// Generated from runtime/alpha3/src/operations/subagent-typert-assets.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** The pinned upstream analyzer owns Typert extraction. This producer gives
 * it an exact source mirror in its required packages/ layout, selects only the
 * maintained subagent host face, and returns manifest-owned artifact bytes. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createTestDirectory, cleanupTestDirectory } from './test-temp.mjs';
export class SubagentTypertStaleError extends Error {
    outputSource;
    name = 'SubagentTypertStaleError';
    code = 'SUBAGENT_TYPERT_OUTPUT_STALE';
    constructor(outputSource) {
        super('SUBAGENT_TYPERT_OUTPUT_STALE: ' + outputSource);
        this.outputSource = outputSource;
    }
}
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (value) => value.split(path.sep).join('/');
function artifact(plan, id) {
    const row = plan.artifacts.find(candidate => candidate.id === id);
    if (!row)
        throw Error('SUBAGENT_TYPERT_ARTIFACT_MISSING: ' + id);
    return row;
}
/** Manifest validation owns global uniqueness and safe paths. This component
 * only checks the four semantic roles it must extract from the host model. */
export function subagentTypertRecipeV1(plan) {
    const recipe = plan.product?.subagentTypert;
    if (!recipe)
        return undefined;
    const roles = new Set(recipe.outputs.map(output => output.role));
    if (recipe.schemaVersion !== 1 || recipe.encoding !== 'owned-subagent-typert-recipe-v1'
        || recipe.compilerModule !== 'nexttavern-typert-typescript' || recipe.outputs.length !== 4
        || roles.size !== 4 || !['host-js', 'host-dts', 'remote-js', 'remote-dts'].every(role => roles.has(role))) {
        throw Error('SUBAGENT_TYPERT_RECIPE_INVALID');
    }
    return recipe;
}
/** Uses the same immutable input snapshot as canonical strict compilation.
 * Pass typescriptAlreadyChecked only after that orchestration succeeded. */
export async function buildSubagentTypertAssetsV1(options) {
    const repo = fs.realpathSync(options.repo), plan = options.plan, recipe = subagentTypertRecipeV1(plan);
    if (!recipe)
        throw Error('SUBAGENT_TYPERT_RECIPE_MISSING');
    const original = (id) => path.resolve(repo, artifact(plan, id).source);
    const packageFile = original(recipe.packageArtifact), packageRoot = path.dirname(packageFile);
    const packageBytes = fs.readFileSync(packageFile), metadata = JSON.parse(packageBytes.toString('utf8'));
    // Native packages are whole hostForks, not product.packages. Their existing
    // canonical prefix inventory owns the maintained source mirror as well.
    const packagePrefix = path.posix.dirname(artifact(plan, recipe.packageArtifact).source) + '/';
    const sourceResources = plan.artifacts.filter(row => row.source.startsWith(packagePrefix + 'src/')
        && /\.[cm]?ts$/.test(row.source)).map(row => ({ artifact: row.id, path: row.source.slice(packagePrefix.length) }));
    if (!sourceResources.length)
        throw Error('SUBAGENT_TYPERT_SOURCE_RESOURCES_MISSING');
    const configFile = path.resolve(repo, plan.typeScript.config), configRoot = path.dirname(configFile);
    const require = createRequire(path.join(configRoot, 'package.json'));
    const ts = require(recipe.compilerModule);
    const esbuild = require('esbuild');
    const context = plan.typeScript.contexts?.[recipe.typeContext];
    if (!context)
        throw Error('SUBAGENT_TYPERT_CONTEXT_MISSING: ' + recipe.typeContext);
    const declarationFallbacks = context.declarationFallbacks;
    const registered = new Map(plan.artifacts.map(row => [path.resolve(repo, row.source), row]));
    const inputs = new Map();
    function record(file, kind) {
        const absolute = fs.realpathSync(file), row = registered.get(absolute), relative = slash(path.relative(repo, absolute));
        if (!inputs.has(relative))
            inputs.set(relative, { ...row ? { artifact: row.id } : {}, path: relative,
                sha256: sha(fs.readFileSync(absolute)), kind });
    }
    record(packageFile, 'package-mirror');
    record(original(recipe.generatorPackageArtifact), 'generator-source');
    record(configFile, 'configuration');
    record(path.join(configRoot, 'package.json'), 'configuration');
    record(path.join(configRoot, 'package-lock.json'), 'configuration');
    record(require.resolve(recipe.compilerModule), 'locked-generator-dependency');
    record(require.resolve(recipe.compilerModule + '/package.json'), 'locked-generator-dependency');
    const temporary = createTestDirectory('subagent-typert-');
    try {
        const mirrorRoot = path.join(temporary, 'packages', 'subagent'), mirrored = new Map();
        fs.mkdirSync(mirrorRoot, { recursive: true });
        fs.writeFileSync(path.join(mirrorRoot, 'package.json'), packageBytes);
        for (const resource of sourceResources) {
            const source = original(resource.artifact), destination = path.join(mirrorRoot, resource.path);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, fs.readFileSync(source));
            mirrored.set(destination, source);
            record(source, 'package-mirror');
        }
        // Resolve the analyzer compiler explicitly. Its neighboring ordinary
        // checker is deliberately a different TypeScript version.
        const bundle = await esbuild.build({ absWorkingDir: repo, entryPoints: [original(recipe.generatorEntryArtifact)],
            bundle: true, platform: 'node', format: 'esm', target: 'es2023', write: false, metafile: true,
            plugins: [{ name: 'locked-typert-compiler', setup(builder) {
                        builder.onResolve({ filter: /^typescript$/ }, () => ({ path: pathToFileURL(require.resolve(recipe.compilerModule)).href, external: true }));
                        builder.onResolve({ filter: /^@jridgewell\/gen-mapping$/ }, () => ({ path: require.resolve('@jridgewell/gen-mapping') }));
                    } }] });
        for (const input of Object.keys(bundle.metafile.inputs)) {
            const file = path.resolve(repo, input);
            record(file, file.includes(path.sep + 'node_modules' + path.sep) ? 'locked-generator-dependency' : 'generator-source');
        }
        const generatorFile = path.join(temporary, 'generator.mjs');
        fs.writeFileSync(generatorFile, bundle.outputFiles[0].contents);
        const generator = await import(__rewriteRelativeImportExtension(pathToFileURL(generatorFile).href));
        const loaded = ts.readConfigFile(configFile, ts.sys.readFile);
        if (loaded.error)
            throw Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n'));
        const compilerOptions = { ...loaded.config.compilerOptions,
            baseUrl: configRoot, ignoreDeprecations: '6.0', noEmit: true, composite: false, incremental: false,
            typeRoots: (loaded.config.compilerOptions.typeRoots ?? []).map((root) => path.resolve(configRoot, root)),
            paths: Object.fromEntries(Object.entries({ ...loaded.config.compilerOptions.paths, ...context.paths })
                .map(([name, targets]) => [name, targets.map(target => path.resolve(configRoot, target))])),
            ...context.rootDirs ? { rootDirs: context.rootDirs.map(root => path.resolve(repo, root)) } : {},
            ...context.exactOptionalPropertyTypes ? { exactOptionalPropertyTypes: true } : {}, };
        // Package exports determine its entry aliases. Their exact source paths
        // move together with the package, so private forwarding modules stay real.
        for (const [subpath, target] of Object.entries(metadata.exports)) {
            const source = typeof target === 'string' ? target : target.types;
            if (!source || (!source.includes('*') && !/\.[cm]?ts$/.test(source)))
                continue;
            compilerOptions.paths[metadata.name + (subpath === '.' ? '' : subpath.slice(1))] = [path.resolve(mirrorRoot, source)];
        }
        // Remote decorators are identified by their owning package registration.
        // Keep the installed protocol declarations exact, inside the analyzer's
        // packages/ inventory, so its real symbols retain that ownership.
        const protocolFile = require.resolve('@deepseek-ai/dsh-typert-protocol/package.json');
        const protocolRoot = path.dirname(protocolFile);
        const protocolMetadata = JSON.parse(fs.readFileSync(protocolFile, 'utf8'));
        const protocolDeclarationRoot = path.dirname(path.resolve(protocolRoot, protocolMetadata.types));
        const protocolMirror = path.join(temporary, 'packages', 'typert-protocol');
        fs.mkdirSync(protocolMirror, { recursive: true });
        fs.writeFileSync(path.join(protocolMirror, 'package.json'), fs.readFileSync(protocolFile));
        record(protocolFile, 'locked-generator-dependency');
        const protocolDeclarations = [];
        function mirrorProtocolDeclarations(directory) {
            for (const name of fs.readdirSync(directory)) {
                const source = path.join(directory, name);
                if (fs.statSync(source).isDirectory()) {
                    mirrorProtocolDeclarations(source);
                    continue;
                }
                if (!name.endsWith('.d.ts'))
                    continue;
                // The pinned analyzer resolves lib/types exports through src/*.ts.
                // These are the published declaration bytes, without synthesized APIs.
                const destination = path.join(protocolMirror, 'src', path.relative(protocolDeclarationRoot, source).replace(/\.d\.ts$/, '.ts'));
                fs.mkdirSync(path.dirname(destination), { recursive: true });
                fs.writeFileSync(destination, fs.readFileSync(source));
                mirrored.set(destination, source);
                protocolDeclarations.push(destination);
                record(source, 'locked-generator-dependency');
            }
        }
        mirrorProtocolDeclarations(protocolDeclarationRoot);
        for (const [subpath, target] of Object.entries(protocolMetadata.exports)) {
            const source = typeof target === 'string' ? target : target.types;
            if (!source || source.includes('*') || !source.endsWith('.d.ts'))
                continue;
            const targetSource = source.replace(/^\.\/lib\/types\//, 'src/').replace(/\.d\.ts$/, '.ts');
            compilerOptions.paths[protocolMetadata.name + (subpath === '.' ? '' : subpath.slice(1))] = [path.resolve(protocolMirror, targetSource)];
        }
        const ambient = [...(plan.typeScript.ambientDeclarations ?? []), ...(context.ambientDeclarations ?? [])]
            .map(file => path.resolve(repo, file));
        // The upstream analyzer recognizes standard types by typescript/lib paths.
        // Mirror only this compiler's selected standard-library reference closure;
        // source evidence continues to name the actual locked alias files.
        const standardLibraryRoot = path.dirname(ts.getDefaultLibFilePath({}));
        const standardLibraryMirror = path.join(temporary, 'typescript', 'lib');
        fs.mkdirSync(standardLibraryMirror, { recursive: true });
        const standardLibraryFiles = new Set();
        function mirrorStandardLibrary(name) {
            if (standardLibraryFiles.has(name))
                return;
            standardLibraryFiles.add(name);
            const source = path.join(standardLibraryRoot, name), destination = path.join(standardLibraryMirror, name);
            const bytes = fs.readFileSync(source);
            fs.writeFileSync(destination, bytes);
            mirrored.set(destination, source);
            record(source, 'locked-generator-dependency');
            const references = ts.preProcessFile(bytes.toString('utf8'), false);
            for (const reference of references.libReferenceDirectives)
                mirrorStandardLibrary('lib.' + reference.fileName.toLowerCase() + '.d.ts');
            for (const reference of references.referencedFiles)
                mirrorStandardLibrary(reference.fileName);
        }
        const convertedOptions = ts.convertCompilerOptionsFromJson(compilerOptions, configRoot).options;
        for (const name of convertedOptions.lib ?? [ts.getDefaultLibFileName(convertedOptions)])
            mirrorStandardLibrary(name);
        const projectConfig = path.join(mirrorRoot, 'tsconfig.json');
        fs.writeFileSync(projectConfig, JSON.stringify({ compilerOptions, files: [
                ...sourceResources.map(row => path.join(mirrorRoot, row.path)), ...ambient,
            ] }));
        const aggregate = path.join(temporary, 'tsconfig.host.json');
        const protocolConfig = path.join(protocolMirror, 'tsconfig.json');
        fs.writeFileSync(protocolConfig, JSON.stringify({ compilerOptions, files: protocolDeclarations }));
        fs.writeFileSync(aggregate, JSON.stringify({ compilerOptions, files: [],
            references: [{ path: projectConfig }, { path: protocolConfig }] }));
        const declarationRoots = plan.typeScript.declarationPackages.map(root => path.resolve(repo, root));
        class ObservedCaches extends generator.WorkspaceCaches {
            programHost(...args) {
                const host = super.programHost(...args), options = args[1], getSourceFile = host.getSourceFile.bind(host);
                host.getDefaultLibLocation = () => standardLibraryMirror;
                host.getDefaultLibFileName = () => path.join(standardLibraryMirror, ts.getDefaultLibFileName(options));
                host.getSourceFile = (...parameters) => {
                    const result = getSourceFile(...parameters);
                    if (result) {
                        const source = mirrored.get(path.resolve(result.fileName)) ?? result.fileName;
                        // Temporary aggregate files are configuration, not new maintained
                        // source. Every mirrored source reports its original artifact.
                        if (!path.resolve(source).startsWith(temporary + path.sep))
                            record(source, 'analyzed-typescript');
                    }
                    return result;
                };
                host.resolveModuleNameLiterals = (literals, file) => literals.map(literal => {
                    const local = ts.resolveModuleName(literal.text, file, options, host);
                    if (local.resolvedModule)
                        return local;
                    const fallback = declarationFallbacks?.find(row => path.resolve(repo, row.file) === path.resolve(file)
                        && row.from.includes(literal.text));
                    if (!fallback && (literal.text.startsWith('.') || path.isAbsolute(literal.text)))
                        return local;
                    for (const root of declarationRoots) {
                        const resolved = ts.resolveModuleName(fallback?.to ?? literal.text, path.join(root, 'type-resolution.mts'), options, host);
                        if (resolved.resolvedModule)
                            return resolved;
                    }
                    return local;
                });
                return host;
            }
        }
        const workspace = new generator.WorkspaceAnalyzer({ root: temporary, hostConfig: 'tsconfig.host.json',
            clientConfig: 'tsconfig.client.absent.json', packages: [metadata.name], faces: ['host'], mode: 'check',
            checkDiagnostics: !options.typescriptAlreadyChecked, caches: new ObservedCaches() }).analyze();
        const hostFace = workspace.faces.find((face) => face.face === 'host');
        if (!hostFace)
            throw Error('SUBAGENT_TYPERT_HOST_FACE_MISSING');
        const emitted = new generator.FaceModelEmitter(hostFace).emit(metadata.name);
        if (!emitted.remote)
            throw Error('SUBAGENT_TYPERT_REMOTE_MISSING');
        const bodies = { 'host-js': emitted.js, 'host-dts': emitted.dts,
            'remote-js': emitted.remote.js, 'remote-dts': emitted.remote.dts };
        const outputExports = { 'host-js': ['./typert', 'default'], 'host-dts': ['./typert', 'types'],
            'remote-js': ['./remote', 'default'], 'remote-dts': ['./remote', 'types'] };
        const outputs = new Map();
        for (const output of recipe.outputs) {
            const row = artifact(plan, output.artifact), [subpath, condition] = outputExports[output.role];
            const entry = metadata.exports[subpath], target = typeof entry === 'object' ? entry[condition] : undefined;
            if (!target || path.resolve(repo, row.source) !== path.resolve(packageRoot, target)) {
                throw Error('SUBAGENT_TYPERT_OUTPUT_EXPORT_CHANGED: ' + output.role);
            }
            const bytes = Buffer.from(bodies[output.role], 'utf8');
            outputs.set(row.source, bytes);
            const destination = path.resolve(repo, row.source);
            if (options.write) {
                fs.mkdirSync(path.dirname(destination), { recursive: true });
                fs.writeFileSync(destination, bytes);
            }
            else if (!fs.existsSync(destination) || !bytes.equals(fs.readFileSync(destination))) {
                throw new SubagentTypertStaleError(row.source);
            }
        }
        return { recipe, outputs, sourceInputs: [...inputs.values()].sort((left, right) => left.path.localeCompare(right.path)),
            compilerVersion: ts.version, faces: ['host'] };
    }
    finally {
        cleanupTestDirectory(temporary);
    }
}
