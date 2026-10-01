// Generated from runtime/alpha3/src/operations/build-typescript.mts; edit the TypeScript source.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const normalize = (text) => text.replace(/\r\n/g, '\n');
const inside = (repo, relative) => {
    if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..'))
        throw Error('Unsafe TypeScript path');
    return path.join(repo, relative);
};
export function compileTypeScript(repo = root, suppliedPlan) {
    // Audit/install/rollback import this module without developer dependencies.
    // The public projection supplies its own mapped plan and root; resolve the
    // compiler beside that plan's config, never through a maintenance checkout.
    const plan = suppliedPlan ?? readJson(path.join(repo, 'release/source-manifest.json'));
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
        return { outputs: new Map(), recipes: recipes, plan, compiler: ts.version };
    const configPath = inside(repo, plan.typeScript.config);
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const converted = ts.convertCompilerOptionsFromJson(config.config?.compilerOptions ?? {}, path.dirname(configPath));
    if (!converted.options.strict || !converted.options.noUncheckedIndexedAccess || !converted.options.noEmitOnError)
        throw Error('TypeScript strict safety options are required');
    const diagnostics = [...(config.error ? [config.error] : []), ...converted.errors];
    const outputs = new Map();
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
            const emitted = program.emit(undefined, (_file, text, _bom, _error, sources) => {
                if (!sources || sources.length !== 1)
                    throw Error('Ambiguous TypeScript compiler output');
                const file = path.resolve(sources[0].fileName);
                const output = normalize(text);
                if (outputs.has(file) && outputs.get(file) !== output)
                    throw Error('TypeScript contexts disagree on output: ' + file);
                outputs.set(file, output);
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
    }
    return { outputs, recipes: recipes, plan, sources: [...sourceSet], compiler: ts.version };
}
// Reverse coverage is rooted at each package's src/lib pair, including nested
// directories without any registered entries. A banner or inventory entry alone
// cannot authorize JavaScript in src, TypeScript in lib, or an orphan output.
export function checkTypeScriptOwnership(repo = root, plan) {
    const source = plan ?? readJson(path.join(repo, 'release/source-manifest.json'));
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
                if (!sourceTree)
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
        const output = path.join(repo, recipe.outputSource);
        if (write) {
            fs.mkdirSync(path.dirname(output), { recursive: true });
            fs.writeFileSync(output, recipe.text);
        }
        else if (!fs.existsSync(output) || normalize(fs.readFileSync(output, 'utf8')) !== recipe.text) {
            throw Error('Stale TypeScript output: ' + recipe.outputSource + '; run node runtime/alpha3/lib/operations/build-typescript.mjs --write');
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
    const inputs = Object.fromEntries(sources.map(source => [path.relative(path.dirname(path.join(repo, recipe.entry)), path.join(repo, source)).replaceAll('\\', '/'), { bytes: fs.statSync(path.join(repo, source)).size }]));
    fs.writeFileSync(output + '.meta.json', JSON.stringify({ inputs }, null, 2) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [entry, output] = process.argv.slice(2);
    if (entry === '--types') {
        const result = compileTypeScript(root);
        console.log(JSON.stringify({ modules: result.recipes.length, compiler: result.compiler, mode: 'types', writes: false }));
    }
    else if (entry === '--check' || entry === '--write')
        console.log(JSON.stringify(checkTypeScript(root, entry === '--write')));
    else {
        writeTypeScriptBuild(compileTypeScript(), entry, output);
    }
}
