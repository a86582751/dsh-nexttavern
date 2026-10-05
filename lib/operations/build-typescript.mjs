// Generated from runtime/alpha3/src/operations/build-typescript.mts; edit the TypeScript source.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const normalize = (text) => text.replace(/\r\n/g, '\n');
const inside = (repo, relative) => {
    if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..'))
        throw Error('Unsafe TypeScript path');
    return path.join(repo, relative);
};
/** Supplied public/fixture plans cross the same compiler boundary as the
 * maintenance manifest. Ambiguous artifact IDs cannot select an output. */
const validateArtifactIds = (plan) => {
    const ids = new Set();
    for (const artifact of plan.artifacts) {
        if (!artifact.id || ids.has(artifact.id))
            throw Error('Duplicate or invalid TypeScript artifact id: ' + artifact.id);
        ids.add(artifact.id);
    }
};
export function compileTypeScript(repo = root, suppliedPlan) {
    // Audit/install/rollback import this module without developer dependencies.
    // The public projection supplies its own mapped plan and root; resolve the
    // compiler beside that plan's config, never through a maintenance checkout.
    const plan = suppliedPlan ?? readJson(path.join(repo, 'release/source-manifest.json'));
    validateArtifactIds(plan);
    const compilerPackage = path.posix.dirname(plan.typeScript.config);
    if (!plan.typeScript.declarationPackages.includes(compilerPackage))
        throw Error('Compiler package must be lock-audited');
    const require = createRequire(inside(repo, compilerPackage + '/package.json'));
    const ts = require('typescript');
    const recipes = plan.builds.filter(build => build.kind === 'typescript-module');
    const lock = readJson(inside(repo, compilerPackage + '/package-lock.json'));
    const declarationRoots = plan.typeScript.declarationPackages.map(directory => {
        inside(repo, directory);
        for (const file of ['package.json', 'package-lock.json']) {
            if (!plan.artifacts.some(artifact => artifact.source === directory + '/' + file))
                throw Error('Unregistered declaration package: ' + directory);
        }
        return { prefix: directory + '/', lock: readJson(path.join(repo, directory, 'package-lock.json')) };
    });
    if (ts.version !== lock.packages['node_modules/typescript']?.version)
        throw Error('TypeScript differs from lockfile');
    if (!recipes.length)
        return { outputs: new Map(), declarationOutputs: new Map(), recipes: recipes, plan, compiler: ts.version };
    const configPath = inside(repo, plan.typeScript.config);
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const converted = ts.convertCompilerOptionsFromJson(config.config?.compilerOptions ?? {}, path.dirname(configPath));
    if (!converted.options.strict || !converted.options.noUncheckedIndexedAccess || !converted.options.noEmitOnError)
        throw Error('TypeScript strict safety options are required');
    const diagnostics = [...(config.error ? [config.error] : []), ...converted.errors];
    const outputs = new Map();
    const declarationOutputs = new Map();
    const destinations = new Set();
    for (const recipe of recipes) {
        const output = plan.artifacts.find(artifact => artifact.id === recipe.artifact)?.source;
        if (!output || destinations.has(output))
            throw Error('Duplicate or missing TypeScript output: ' + recipe.id);
        inside(repo, output);
        destinations.add(output);
        if (recipe.declarationArtifact === undefined)
            continue;
        const declaration = plan.artifacts.find(artifact => artifact.id === recipe.declarationArtifact)?.source;
        const expected = output.replace(/\.(mjs|cjs|js)$/, recipe.entry.endsWith('.mts') ? '.d.mts' : '.d.ts');
        if (!declaration || declaration !== expected || destinations.has(declaration)) {
            throw Error('Invalid TypeScript declaration mapping: ' + recipe.id);
        }
        inside(repo, declaration);
        destinations.add(declaration);
        recipe.declarationOutputSource = declaration;
    }
    const sourceSet = new Set();
    // Host and browser augment the same Cordis names with different services.
    // Keep strict programs separate, while inventory and output ownership remain
    // in this one manifest. Shared vocabulary may compile in both only identically.
    const contexts = new Set(recipes.map(recipe => recipe.typeContext ?? 'default'));
    for (const context of contexts) {
        if (context !== 'default' && !Object.hasOwn(plan.typeScript.contexts ?? {}, context)) {
            throw Error('Unknown TypeScript context: ' + context);
        }
        const contextRecipes = recipes.filter(recipe => (recipe.typeContext ?? 'default') === context);
        // A partial maintained dependency can use the locked upstream declarations
        // as a virtual source tree. Runtime assembly still owns the complete package.
        const rootDirs = plan.typeScript.contexts?.[context]?.rootDirs;
        const options = {
            ...converted.options,
            // Declarations share this exact strict program and its lock-audited
            // inputs. Only manifest-owned outputs below are delivered to disk.
            declaration: contextRecipes.some(recipe => recipe.declarationArtifact !== undefined),
            emitDeclarationOnly: false,
            paths: { ...converted.options.paths, ...plan.typeScript.contexts?.[context]?.paths },
            ...(plan.typeScript.contexts?.[context]?.rewriteRelativeImportExtensions
                ? { rewriteRelativeImportExtensions: true } : {}),
            ...(rootDirs === undefined ? {} : { rootDirs: rootDirs.map(directory => inside(repo, directory)) }),
            // Some upstream declarations rely on absence being distinct from an
            // explicit undefined. This opt-in strengthens checks for that program.
            ...(plan.typeScript.contexts?.[context]?.exactOptionalPropertyTypes
                ? { exactOptionalPropertyTypes: true } : {}),
        };
        const host = ts.createCompilerHost(options);
        const fallbacks = plan.typeScript.contexts?.[context]?.declarationFallbacks ?? [];
        for (const fallback of fallbacks) {
            const source = inside(repo, fallback.file);
            if (!/\.d\.[cm]?ts$/.test(source) || !declarationRoots.some(root => fallback.file.startsWith(root.prefix + 'node_modules/'))
                || createHash('sha256').update(fs.readFileSync(source)).digest('hex') !== fallback.sha256) {
                throw Error('Declaration fallback source differs: ' + fallback.file);
            }
            if (!fallback.to || fallback.to.startsWith('.') || path.isAbsolute(fallback.to))
                throw Error('Invalid declaration fallback target');
        }
        host.resolveModuleNameLiterals = (literals, containingFile) => literals.map(literal => {
            const local = ts.resolveModuleName(literal.text, containingFile, options, host);
            if (local.resolvedModule)
                return local;
            const fallback = fallbacks.find(item => path.resolve(containingFile) === inside(repo, item.file) && item.from.includes(literal.text));
            if (!fallback && (literal.text.startsWith('.') || path.isAbsolute(literal.text)))
                return local;
            // Owned packages share the locked developer declarations without installing
            // a second framework tree. Resolve public package exports through each
            // manifest-registered declaration root; the pin audit below still applies.
            for (const root of declarationRoots) {
                const resolutionBase = path.join(repo, root.prefix, 'type-resolution.mts');
                const result = ts.resolveModuleName(fallback?.to ?? literal.text, resolutionBase, options, host);
                if (result.resolvedModule)
                    return result;
            }
            return local;
        });
        const roots = contextRecipes.map(recipe => inside(repo, recipe.entry));
        // Some pinned packages publish a host augmentation without exporting it from
        // their root declaration. Explicit lock-audited declaration entries complete
        // that graph without modifying node_modules or weakening skipLibCheck.
        const ambientDeclarations = context === 'default' ? plan.typeScript.ambientDeclarations
            : plan.typeScript.contexts[context].ambientDeclarations;
        roots.push(...(ambientDeclarations ?? []).map(file => inside(repo, file)));
        const program = ts.createProgram(roots, options, host);
        diagnostics.push(...ts.getPreEmitDiagnostics(program));
        const verifiedTypePackages = new Set();
        const externalTypeInput = (source) => {
            // Some real SDK declarations import typed JSON model catalogs. They are
            // dependency inputs, not maintained code; apply the same package pin audit.
            if (!source.isDeclarationFile && !source.fileName.endsWith('.json'))
                return false;
            const relative = path.relative(repo, source.fileName).replaceAll('\\', '/');
            const root = declarationRoots.find(item => relative.startsWith(item.prefix + 'node_modules/'));
            if (!root)
                return false;
            const prefix = root.prefix;
            const packagePath = relative.slice(prefix.length).match(/^node_modules\/(?:@[^/]+\/)?[^/]+/)?.[0];
            const packageKey = prefix + packagePath;
            if (!packagePath || !root.lock.packages[packagePath]?.version)
                throw Error('Unpinned TypeScript declaration: ' + relative);
            if (!verifiedTypePackages.has(packageKey)) {
                const installed = readJson(path.join(repo, prefix, packagePath, 'package.json'));
                if (installed.version !== root.lock.packages[packagePath].version)
                    throw Error('Type declaration differs from lockfile: ' + packagePath);
                verifiedTypePackages.add(packageKey);
            }
            return true;
        };
        const sources = program.getSourceFiles().filter(source => !program.isSourceFileDefaultLibrary(source) && !externalTypeInput(source))
            .map(source => path.relative(repo, source.fileName).replaceAll('\\', '/'));
        for (const source of sources) {
            sourceSet.add(source);
            inside(repo, source);
            if (!plan.artifacts.some(artifact => artifact.source === source) || !recipes.some(recipe => recipe.entry === source || recipe.inputs.includes(source)))
                throw Error('Unregistered TypeScript dependency: ' + source);
            if (/\.(tsx?|mts)$/.test(source) && !/\.d\.(ts|mts)$/.test(source) && !recipes.some(recipe => recipe.entry === source))
                throw Error('TypeScript dependency has no output mapping: ' + source);
        }
        if (!diagnostics.length) {
            // Capture compiler output by its actual source file, then route it through
            // the manifest artifact. No emitted filename or sibling convention is a
            // second source of truth for the destination on disk.
            const emitted = program.emit(undefined, (emittedFile, text, _bom, _error, sources) => {
                if (!sources || sources.length !== 1)
                    throw Error('Ambiguous TypeScript compiler output');
                const file = path.resolve(sources[0].fileName);
                const output = normalize(text);
                const target = /\.d\.[cm]?ts$/.test(emittedFile) ? declarationOutputs
                    : /\.(?:mjs|cjs|js)$/.test(emittedFile) ? outputs : undefined;
                if (!target)
                    throw Error('Unsupported TypeScript compiler output: ' + emittedFile);
                if (target.has(file) && target.get(file) !== output)
                    throw Error('TypeScript contexts disagree on output: ' + file);
                target.set(file, output);
            });
            diagnostics.push(...emitted.diagnostics);
        }
    }
    if (diagnostics.length)
        throw Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCanonicalFileName: file => file, getCurrentDirectory: () => repo, getNewLine: () => '\n',
        }));
    for (const recipe of recipes) {
        const source = plan.artifacts.find(artifact => artifact.id === recipe.artifact)?.source;
        const emitted = outputs.get(path.resolve(repo, recipe.entry));
        if (!source || emitted === undefined)
            throw Error('Missing TypeScript output: ' + recipe.id);
        inside(repo, source);
        recipe.outputSource = source;
        const banner = '// Generated from ' + (recipe.banner ?? recipe.entry) + '; edit the TypeScript source.\n';
        const shebangEnd = emitted.startsWith('#!') ? emitted.indexOf('\n') + 1 : 0;
        recipe.text = emitted.slice(0, shebangEnd) + banner + emitted.slice(shebangEnd);
        if (recipe.declarationArtifact !== undefined) {
            const declaration = declarationOutputs.get(path.resolve(repo, recipe.entry));
            if (declaration === undefined)
                throw Error('Missing TypeScript declaration: ' + recipe.id);
            recipe.declarationText = banner + declaration;
        }
    }
    return { outputs, declarationOutputs, recipes: recipes, plan, sources: [...sourceSet], compiler: ts.version };
}
// Reverse coverage is rooted at each package's src/lib pair, including nested
// directories without any registered entries. A banner or inventory entry alone
// cannot authorize JavaScript in src, TypeScript in lib, or an orphan output.
export function checkTypeScriptOwnership(repo = root, plan) {
    const source = plan ?? readJson(path.join(repo, 'release/source-manifest.json'));
    validateArtifactIds(source);
    const registered = source.builds.filter(build => build.kind === 'typescript-module');
    const treeRoot = (file, name) => {
        const marker = '/' + name + '/';
        const offset = file.lastIndexOf(marker);
        if (offset < 0)
            throw Error('TypeScript mapping must use ' + name + '/: ' + file);
        return file.slice(0, offset + marker.length - 1);
    };
    const sourceRoots = [...new Set(registered.map(build => treeRoot(build.entry, 'src')))];
    const outputFor = (build) => {
        const output = source.artifacts.find(artifact => artifact.id === build.artifact)?.source;
        if (!output)
            throw Error('Missing build output artifact: ' + build.artifact);
        return output;
    };
    const outputs = new Map(registered.map(build => [outputFor(build), build.entry]));
    if (outputs.size !== registered.length)
        throw Error('Duplicate TypeScript output mapping');
    const declarations = new Map(registered.filter(build => build.declarationArtifact !== undefined).map(build => {
        const declaration = source.artifacts.find(artifact => artifact.id === build.declarationArtifact)?.source;
        const expected = outputFor(build).replace(/\.(mjs|cjs|js)$/, build.entry.endsWith('.mts') ? '.d.mts' : '.d.ts');
        if (!declaration || declaration !== expected)
            throw Error('Invalid TypeScript declaration mapping: ' + build.id);
        return [declaration, build.entry];
    }));
    if (declarations.size !== registered.filter(build => build.declarationArtifact !== undefined).length) {
        throw Error('Duplicate TypeScript declaration output mapping');
    }
    const outputRoots = [...new Set(registered.map(build => treeRoot(outputFor(build), 'lib')))];
    const directories = [...sourceRoots, ...outputRoots];
    const allBuildOutputs = new Set(source.builds.map(outputFor));
    const entries = new Set(registered.map(build => build.entry));
    const declared = new Set(source.artifacts.map(artifact => artifact.source));
    const findings = [];
    let files = 0;
    const scan = (directory, sourceTree) => {
        const absolute = inside(repo, directory);
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory())
            throw Error('Missing TypeScript directory: ' + directory);
        for (const item of fs.readdirSync(absolute, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
            const file = directory + '/' + item.name;
            if (item.isDirectory()) {
                if (!['node_modules', '.git', '__pycache__'].includes(item.name))
                    scan(file, sourceTree);
                continue;
            }
            if (!item.isFile())
                continue;
            if (/\.(tsx?|mts)$/.test(item.name)) {
                if (!sourceTree && declarations.has(file)) {
                    if (!fs.existsSync(inside(repo, declarations.get(file))))
                        findings.push(file + ': declaration source is missing');
                }
                else if (!sourceTree)
                    findings.push(file + ': TypeScript source inside lib/');
                else if (!entries.has(file) && !(/\.d\.(ts|mts)$/.test(file) && declared.has(file)))
                    findings.push(file + ': unregistered TypeScript source');
                continue;
            }
            if (!/\.(js|mjs|cjs)$/.test(item.name))
                continue;
            files += 1;
            if (sourceTree) {
                findings.push(file + ': JavaScript inside src/');
                continue;
            }
            const entry = outputs.get(file);
            if (entry) {
                // A mapping alone is not an explanation; the mapped source must exist.
                if (!fs.existsSync(inside(repo, entry)) || !fs.statSync(inside(repo, entry)).isFile())
                    findings.push(file + ': registered as the output of ' + entry + ', which does not exist; restore that source or delete this output');
                continue;
            }
            if (allBuildOutputs.has(file))
                continue;
            findings.push(file + ': no registered build output; lib/ only contains generated artifacts');
        }
    };
    for (const directory of sourceRoots)
        scan(directory, true);
    for (const directory of outputRoots)
        scan(directory, false);
    if (findings.length)
        throw Error('Unaccounted JavaScript in TypeScript-owned directories (' + findings.length + '/' + files + '):\n  - ' + findings.join('\n  - '));
    return { directories: directories.length, files };
}
export function checkTypeScript(repo = root, write = false, compilation = compileTypeScript(repo)) {
    const { recipes, compiler, plan } = compilation;
    for (const recipe of recipes) {
        const targets = [{ source: recipe.outputSource, text: recipe.text }];
        if (recipe.declarationOutputSource !== undefined) {
            if (recipe.declarationText === undefined)
                throw Error('Missing compiled declaration: ' + recipe.id);
            targets.push({ source: recipe.declarationOutputSource, text: recipe.declarationText });
        }
        for (const target of targets) {
            const output = inside(repo, target.source);
            if (write) {
                fs.mkdirSync(path.dirname(output), { recursive: true });
                fs.writeFileSync(output, target.text);
            }
            else if (!fs.existsSync(output) || normalize(fs.readFileSync(output, 'utf8')) !== target.text) {
                throw Error('Stale TypeScript output: ' + target.source + '; run node runtime/alpha3/lib/operations/build-typescript.mjs --write');
            }
        }
    }
    const ownership = checkTypeScriptOwnership(repo, plan);
    return { modules: recipes.length, compiler, mode: write ? 'write' : 'check', ownedDirectories: ownership.directories, ownedJavaScript: ownership.files };
}
export function writeTypeScriptBuild(compilation, entry, output, repo = root) {
    const { recipes, sources } = compilation;
    const recipe = recipes.find(recipe => path.resolve(repo, recipe.entry) === path.resolve(entry ?? ''));
    if (!recipe || !output)
        throw Error('TypeScript build requires a registered entry and output');
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, recipe.text);
    let declaration;
    if (recipe.declarationArtifact !== undefined) {
        if (!recipe.declarationOutputSource || recipe.declarationText === undefined)
            throw Error('Missing compiled declaration: ' + recipe.id);
        const extension = recipe.declarationOutputSource.endsWith('.d.mts') ? '.d.mts' : '.d.ts';
        const target = path.resolve(output).replace(/\.(?:mjs|cjs|js)$/, extension);
        if (target === path.resolve(output))
            throw Error('TypeScript build output extension is invalid');
        fs.writeFileSync(target, recipe.declarationText);
        declaration = { artifact: recipe.declarationArtifact, path: target };
    }
    const inputs = Object.fromEntries(sources.map(source => [path.relative(path.dirname(path.join(repo, recipe.entry)), path.join(repo, source)).replaceAll('\\', '/'), { bytes: fs.statSync(path.join(repo, source)).size }]));
    fs.writeFileSync(output + '.meta.json', JSON.stringify({ inputs }, null, 2) + '\n');
    return { declaration };
}
/** This recipe comes from the same source manifest/public compiler projection.
 * Presence alone is insufficient for executable bundles and guest assets. */
export async function checkMvuSchemaRuntimeBuild(repo, plan, write = false) {
    if (!plan.product || !plan.product.mvuSchemaRuntime && !plan.product.mvuSchemaRuntimes)
        return undefined;
    const builder = plan.artifacts.find(artifact => artifact.id === 'mvu-schema-runtime-assets-js');
    if (!builder)
        throw Error('Schema runtime builder is not registered');
    // Native TS bootstrap executes from src; installed/public callers execute
    // from lib. The manifest owns one generated implementation for both.
    const { buildMvuSchemaRuntimeAssets, mvuSchemaRuntimeRecipes } = await import(pathToFileURL(inside(repo, builder.source)).href);
    const recipes = mvuSchemaRuntimeRecipes(plan.product);
    if (!recipes.length)
        return undefined;
    const packages = [];
    for (const recipe of recipes) {
        const metadata = plan.artifacts.find(artifact => artifact.id === recipe.packageArtifact);
        if (!metadata)
            throw Error('Schema runtime package is not registered');
        const prefix = path.posix.dirname(metadata.source);
        const outputs = [...recipe.modules.map(module => module.output),
            ...recipe.guests.flatMap(guest => [guest.output, guest.licenseOutput]), recipe.descriptorOutput];
        for (const output of outputs) {
            if (plan.artifacts.filter(artifact => artifact.source === prefix + '/' + output).length !== 1) {
                throw Error('Schema runtime output must have one source mapping: ' + output);
            }
        }
        packages.push(await buildMvuSchemaRuntimeAssets({ repo, plan: { artifacts: plan.artifacts, product: plan.product }, recipe,
            packageRoot: inside(repo, prefix), libraryRoot: inside(repo, path.posix.dirname(plan.typeScript.config) + '/node_modules'), write }));
    }
    return { packages, files: packages.flatMap(pkg => pkg.files.map(file => ({ ...file, packageName: pkg.name }))) };
}
/** The independent component uses its own registered producer. Its declaration
 * and generated-module ownership remains with the same compiler program. */
export async function checkTavernTemplateRuntimeBuild(repo, plan, write = false) {
    if (!plan.product?.templateRuntime)
        return undefined;
    const rows = plan.artifacts.filter(artifact => artifact.id === 'tavern-template-runtime-assets-generated');
    if (rows.length !== 1)
        throw Error('Template runtime builder must have one registered output');
    const { buildTavernTemplateRuntimeAssetsV1 } = await import(pathToFileURL(inside(repo, rows[0].source)).href);
    const recipe = plan.product.templateRuntime, metadata = plan.artifacts.filter(artifact => artifact.id === recipe.packageArtifact);
    if (metadata.length !== 1)
        throw Error('Template runtime package must have one source mapping');
    return buildTavernTemplateRuntimeAssetsV1({ repo,
        plan: { artifacts: plan.artifacts, product: { templateRuntime: recipe, packages: plan.product.packages ?? [] } },
        packageRoot: inside(repo, path.posix.dirname(metadata[0].source)),
        libraryRoot: inside(repo, path.posix.dirname(plan.typeScript.config) + '/node_modules'), write });
}
/** Each independent author component is produced from its sole manifest
 * recipe. Strict module generation runs first, including these producers. */
export async function checkAuthorRuntimeBuild(repo, plan, write = false) {
    const product = plan.product;
    if (!product || !product.authorBrowserRuntime && !product.authorHostRuntime && !product.authorPromptRuntime)
        return undefined;
    const packages = [];
    const componentPlan = { artifacts: plan.artifacts, product: { ...product, packages: product.packages ?? [] } };
    for (const component of ['authorBrowserRuntime', 'authorHostRuntime', 'authorPromptRuntime']) {
        const recipe = product[component];
        if (!recipe)
            continue;
        const builderId = component === 'authorBrowserRuntime' ? 'author-browser-runtime-assets-generated'
            : component === 'authorHostRuntime' ? 'author-host-runtime-assets-generated' : 'author-prompt-runtime-assets-generated';
        const builder = plan.artifacts.find(artifact => artifact.id === builderId);
        const metadata = plan.artifacts.find(artifact => artifact.id === recipe.packageArtifact);
        if (!builder || !metadata)
            throw Error('Author component producer or package is not registered');
        const options = { repo, plan: componentPlan, packageRoot: inside(repo, path.posix.dirname(metadata.source)), write };
        if (component === 'authorBrowserRuntime') {
            const producer = await import(pathToFileURL(inside(repo, builder.source)).href);
            packages.push(await producer.buildAuthorBrowserRuntimeAssetsV1(options));
        }
        else if (component === 'authorHostRuntime') {
            const producer = await import(pathToFileURL(inside(repo, builder.source)).href);
            packages.push(await producer.buildAuthorHostRuntimeAssetsV5(options));
        }
        else {
            const producer = await import(pathToFileURL(inside(repo, builder.source)).href);
            packages.push(await producer.buildAuthorPromptRuntimeAssetsV1(options));
        }
    }
    return { packages, files: packages.flatMap(pkg => pkg.files.map(file => ({ ...file, packageName: pkg.name }))) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [entry, output] = process.argv.slice(2);
    if (entry === '--types') {
        const result = compileTypeScript(root);
        console.log(JSON.stringify({ modules: result.recipes.length, compiler: result.compiler, mode: 'types', writes: false }));
    }
    else if (entry === '--schema-assets') {
        const plan = readJson(path.join(root, 'release/source-manifest.json'));
        const assets = await checkMvuSchemaRuntimeBuild(root, plan, process.argv.includes('--write'));
        console.log(JSON.stringify({ schemaAssets: assets?.files ?? [], mode: process.argv.includes('--write') ? 'write' : 'check' }));
    }
    else if (entry === '--template-assets') {
        const plan = readJson(path.join(root, 'release/source-manifest.json'));
        const templateAssets = await checkTavernTemplateRuntimeBuild(root, plan, process.argv.includes('--write'));
        console.log(JSON.stringify({ templateAssets: templateAssets?.files ?? [], mode: process.argv.includes('--write') ? 'write' : 'check' }));
    }
    else if (entry === '--author-assets') {
        const plan = readJson(path.join(root, 'release/source-manifest.json'));
        const assets = await checkAuthorRuntimeBuild(root, plan, process.argv.includes('--write'));
        console.log(JSON.stringify({ authorAssets: assets?.files ?? [], mode: process.argv.includes('--write') ? 'write' : 'check' }));
    }
    else if (entry === '--check' || entry === '--write') {
        const compilation = compileTypeScript(root);
        const result = checkTypeScript(root, entry === '--write', compilation);
        const assets = await checkMvuSchemaRuntimeBuild(root, compilation.plan, entry === '--write');
        const templateAssets = await checkTavernTemplateRuntimeBuild(root, compilation.plan, entry === '--write');
        const authorAssets = await checkAuthorRuntimeBuild(root, compilation.plan, entry === '--write');
        console.log(JSON.stringify({ ...result, ...(assets ? { schemaAssets: assets.files } : {}),
            ...(templateAssets ? { templateAssets: templateAssets.files } : {}), ...(authorAssets ? { authorAssets: authorAssets.files } : {}) }));
    }
    else {
        writeTypeScriptBuild(compileTypeScript(), entry, output);
    }
}
