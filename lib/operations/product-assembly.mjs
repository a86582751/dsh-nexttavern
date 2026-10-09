// Generated from runtime/alpha3/src/operations/product-assembly.mts; edit the TypeScript source.
/** Materialize the product's registered private packages, never installed files. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { assembleOwnedDependency, regularPackageFiles } from './owned-dependency.mjs';
import { contained as inside } from './public-transaction.mjs';
import { materializeBundledLibraries } from './bundled-library-assembly.mjs';
import { templateRuntimeRecipeV1, materializeTavernTemplateRuntimeDependenciesV1, assertTavernTemplateRuntimePackageV1 } from './tavern-template-runtime-assets.mjs';
import { authorBrowserRuntimeRecipeV1, materializeAuthorBrowserRuntimeDependenciesV1 } from './author-browser-runtime-assets.mjs';
import { authorPromptRuntimeRecipeV1, materializeAuthorPromptRuntimeDependenciesV1 } from './author-prompt-runtime-assets.mjs';
import { makeHostForkProfile } from './native-fork-host-profile.mjs';
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const safeRelative = (value) => typeof value === 'string' && value !== ''
    && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
    && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
/** Stage a complete, manifest-registered fork tree without activating it. */
export function stageHostForks(repo, packageRoot, plan) {
    const recipes = plan.product.hostForks ?? [];
    const registered = new Set(plan.artifacts.map(row => row.source));
    const producers = new Map(plan.builds.map(build => [
        plan.artifacts.find(artifact => artifact.id === build.artifact).source, build,
    ]));
    const rows = recipes.map(row => {
        if (row.version !== '0.1.7-rc.2' || !safeRelative(row.source)
            || !safeRelative(row.target) || row.target !== `host-overrides/${row.name}`) {
            throw Error('Invalid host fork identity or delivery target: ' + row.name);
        }
        const source = inside(repo, row.source);
        if (!fs.statSync(source).isDirectory() || fs.lstatSync(source).isSymbolicLink()) {
            throw Error('Host fork source is not a regular directory: ' + row.source);
        }
        const metadata = json(inside(repo, `${row.source}/package.json`));
        if (metadata.name !== row.name || metadata.version !== row.version || metadata.license !== 'MIT') {
            throw Error('Host fork package identity mismatch: ' + row.name);
        }
        const files = regularPackageFiles(source).sort();
        if (!files.length || !files.includes('LICENSE')
            || !files.includes('package.json') || !files.some(file => file === 'ORIGIN.json' || file === 'ORIGIN.md')) {
            throw Error('Host fork provenance or license is missing: ' + row.name);
        }
        // The manifest owns the exact provenance bytes and the package metadata
        // above owns identity. Preserve the original notices without requiring a
        // second copy of the same license or a second metadata format in ORIGIN.
        for (const file of files) {
            if (!safeRelative(file) || !registered.has(`${row.source}/${file}`)
                || file.startsWith('node_modules/') || file.startsWith('.git/')) {
                throw Error('Unregistered host fork member: ' + row.name + '/' + file);
            }
            if (fs.lstatSync(path.join(source, file)).isSymbolicLink()) {
                throw Error('Symbolic link in host fork: ' + row.name + '/' + file);
            }
            if (file.startsWith('lib/') && /\.[cm]?js$/.test(file)) {
                // Canonical compilation owns generation consistency. Staging consumes
                // that mapping, including Typert outputs with no same-named TS file.
                const producer = producers.get(`${row.source}/${file}`);
                if (!producer || !registered.has(producer.entry)) {
                    throw Error('Host fork generated JavaScript has no registered producer: ' + file);
                }
                const body = fs.readFileSync(path.join(source, file), 'utf8');
                const imports = body.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"](\.[^'"]+)['"]/g);
                for (const match of imports) {
                    const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
                    if (!safeRelative(target) || !files.includes(target)) {
                        throw Error(`Host fork relative import is missing or escapes its tree: ${file} -> ${match[1]}`);
                    }
                }
            }
        }
        return { row, source, files };
    });
    return rows.map(({ row, source, files }) => {
        const destination = inside(packageRoot, row.target);
        if (fs.existsSync(destination))
            throw Error('Host fork destination already exists: ' + row.target);
        const inventory = files.map(file => {
            const from = path.join(source, file);
            const to = inside(destination, file);
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.copyFileSync(from, to);
            return { path: file, sha256: createHash('sha256').update(fs.readFileSync(to)).digest('hex') };
        });
        return { name: row.name, version: row.version, path: row.target,
            status: 'unapplied-host-override', files: inventory };
    });
}
/**
 * The npm command that will report a library's published file set. The
 * JavaScript entry is preferred everywhere: a `.cmd` shim cannot be spawned
 * without a shell on Windows, and running the CLI through this same Node keeps
 * the answer independent of a caller's PATH order.
 */
function resolveNpmCommand() {
    const node = path.dirname(process.execPath);
    const candidates = [
        path.join(node, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        path.join(node, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
        '/usr/bin/npm',
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate))
            return candidate;
    }
    throw Error('Cannot find npm next to this Node installation: ' + process.execPath);
}
/**
 * The file set the library's own maintainer publishes, asked of the package
 * manager that will later install it. A whole-directory copy would ship the
 * maintainer's development sources and test fixtures, whose paths and literal
 * credentials belong to their authors and must not travel in our package.
 */
function publishedFiles(source) {
    const npm = resolveNpmCommand();
    const args = ['pack', '--dry-run', '--json', '--ignore-scripts', '--no-audit', '--no-fund'];
    const result = npm.endsWith('.js')
        ? execFileSync(process.execPath, [npm, ...args], { cwd: source, encoding: 'utf8', timeout: 120_000 })
        : execFileSync(npm, args, { cwd: source, encoding: 'utf8', timeout: 120_000 });
    const parsed = JSON.parse(result);
    const files = parsed[0]?.files?.map(entry => entry.path).filter(Boolean) ?? [];
    if (!files.length)
        throw Error('Library publishes no files: ' + source);
    return files.map(file => file.replaceAll('\\', '/'));
}
/**
 * A library's own tests and fixtures, which several maintainers publish inside
 * their package but no runtime consumer loads. They carry their authors' local
 * paths and sample credentials, so our package must not redistribute them.
 */
const LIBRARY_TEST_FILE = /(?:^|\/)(?:tests?|__tests__|__mocks__)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
/**
 * Copy each owned package's ordinary dependencies into its own `node_modules`.
 *
 * A third-party library declared as a shared host peer resolves only when the
 * harness happens to depend on it, which produces a product that cannot start
 * on any profile the harness does not sit above. Carrying the exact pinned
 * bytes instead keeps the product self-contained, and the copy runs before the
 * inventory is taken so those bytes are protected like every other member.
 */
/**
 * Platform companions one vendored library needs for every declared target.
 * A library without any platform-suffixed optional dependency needs none; a
 * library with one must be complete, otherwise the loaded native module would
 * be missing on the platforms the archive names.
 */
export function requiredPlatformCompanions(manifest, platforms) {
    const optional = manifest.optionalDependencies ?? {};
    const names = Object.keys(optional);
    const matches = (platform) => names.filter(name => name.endsWith('-' + platform));
    if (!platforms.some(platform => matches(platform).length > 0))
        return [];
    return platforms.map(platform => {
        const found = matches(platform);
        if (found.length !== 1) {
            throw Error(`${manifest.name} declares ${found.length} platform companions for ${platform}; `
                + 'every declared platform target needs exactly one');
        }
        return { name: found[0], version: optional[found[0]] };
    });
}
function vendorLibraries(output, owner, dependencies, libraryRoot, pinned, admit, platforms) {
    const libraries = Object.keys(dependencies).filter(name => !name.startsWith('@deepseek-ai/')
        && !name.startsWith('dsh-nexttavern-'));
    const excluded = [];
    if (!libraries.length)
        return excluded;
    if (!libraryRoot)
        throw Error('Product assembly needs a library root for third-party dependencies');
    if (!admit)
        throw Error('Product assembly needs a vendor admission check for third-party libraries');
    for (const name of libraries) {
        const version = dependencies[name];
        if (pinned[name] !== version) {
            throw Error(`Third-party dependency is not pinned by the product recipe: ${owner} -> ${name}@${version}`);
        }
        const source = path.join(libraryRoot, name);
        const manifest = json(path.join(source, 'package.json'));
        if (manifest.name !== name || manifest.version !== version) {
            throw Error(`Vendored library differs from its pin: ${name} ${manifest.version} != ${version}`);
        }
        const copies = [
            { library: name, source, expected: version },
            ...requiredPlatformCompanions(manifest, platforms).map(companion => ({
                library: companion.name, source: path.join(libraryRoot, companion.name), expected: companion.version,
            })),
        ];
        for (const copy of copies) {
            // A native companion travels beside its library: koffi resolves the
            // binary from its own `node_modules` sibling, not from the profile.
            const target = inside(output, 'node_modules/' + copy.library);
            const vendored = json(path.join(copy.source, 'package.json'));
            if (vendored.name !== copy.library) {
                throw Error(`Vendored library differs from its declared name: ${copy.library}`);
            }
            if (vendored.version !== copy.expected) {
                throw Error(`Vendored library differs from its pin: ${copy.library} `
                    + `${vendored.version} != ${copy.expected}`);
            }
            let dropped = 0;
            for (const file of regularPackageFiles(copy.source)) {
                const from = path.join(copy.source, file);
                // The library's own tests and fixtures carry their authors' local paths
                // and sample credentials; admission decides what may travel in this package.
                if (LIBRARY_TEST_FILE.test(file) || !admit(file, fs.readFileSync(from))) {
                    dropped += 1;
                    continue;
                }
                const to = inside(target, file);
                fs.mkdirSync(path.dirname(to), { recursive: true });
                fs.copyFileSync(from, to);
            }
            if (dropped)
                excluded.push({ library: copy.library, files: dropped });
        }
    }
    return excluded;
}
/** The same registered package collector used by the complete product. A
 * component check uses this owner, rather than a junction into build-tools or
 * a second hand-written dependency graph. It never prepares a profile. */
export function assembleProductPackage(options) {
    const repo = fs.realpathSync(options.repo);
    const plan = json(path.join(repo, 'release/source-manifest.json'));
    const artifact = (id) => {
        const row = plan.artifacts.find(item => item.id === id);
        if (!row)
            throw Error('Unregistered product artifact: ' + id);
        return row;
    };
    const rows = plan.product.packages.filter(row => row.packageArtifact === options.packageArtifact);
    if (rows.length !== 1)
        throw Error('Product package must have exactly one registered recipe');
    const row = rows[0];
    const templateRecipe = templateRuntimeRecipeV1(plan), templateComponent = templateRecipe?.packageArtifact === row.packageArtifact;
    const browserRecipe = authorBrowserRuntimeRecipeV1(plan), browserComponent = browserRecipe?.packageArtifact === row.packageArtifact;
    const promptRecipe = authorPromptRuntimeRecipeV1(plan), promptComponent = promptRecipe?.packageArtifact === row.packageArtifact;
    const source = artifact(row.packageArtifact).source;
    const pkg = json(inside(repo, source));
    const product = json(inside(repo, artifact(plan.product.packageArtifact).source));
    if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.name) || pkg.dsh?.bundle !== undefined
        || product.dependencies?.[pkg.name] !== pkg.version
        || product.bundleDependencies?.filter(name => name === pkg.name).length !== 1) {
        throw Error('Product package identity differs from its root declaration');
    }
    if (Object.keys(pkg.dependencies ?? {}).some(name => name.startsWith('@deepseek-ai/'))) {
        throw Error('Host module must remain a shared peer: ' + pkg.name);
    }
    const output = path.resolve(options.output);
    if (fs.existsSync(output))
        throw Error('Product package output must be absent before assembly');
    if (row.assembly) {
        const archive = options.archives?.[row.assembly];
        if (!archive)
            throw Error('Missing pinned archive: ' + row.assembly);
        const result = assembleOwnedDependency({ repo, id: row.assembly, archive, output });
        if (result.name !== pkg.name || result.version !== pkg.version)
            throw Error('Assembly identity differs from recipe');
    }
    else {
        const prefix = path.posix.dirname(source) + '/';
        const files = new Set(plan.artifacts.filter(item => item.source.startsWith(prefix)).map(item => item.source));
        for (const file of files) {
            const target = inside(output, file.slice(prefix.length));
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(inside(repo, file), target);
        }
    }
    for (const resource of row.resources ?? []) {
        const target = inside(output, resource.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(inside(repo, artifact(resource.artifact).source), target);
    }
    const rootRecipe = plan.product.rootBundledLibraries;
    const ownedRootLibraries = Object.fromEntries(Object.entries(rootRecipe?.libraries ?? {})
        .filter(([name]) => pkg.bundleDependencies?.includes(name)));
    for (const [name, version] of Object.entries(ownedRootLibraries)) {
        if (pkg.dependencies?.[name] !== version || plan.product.bundleLibraries?.[name] !== version) {
            throw Error('Unpinned owned bundled SDK: ' + pkg.name + ' -> ' + name);
        }
    }
    const ordinaryDependencies = Object.fromEntries(Object.entries(pkg.dependencies ?? {})
        .filter(([name]) => !Object.hasOwn(ownedRootLibraries, name) && !templateComponent && !browserComponent && !promptComponent));
    const excludedVendoredFiles = vendorLibraries(output, pkg.name, ordinaryDependencies, options.libraryRoot, plan.product.bundleLibraries ?? {}, options.admitVendoredFile, plan.product.bundlePlatforms ?? []);
    if (templateComponent) {
        // Copy the exact complete locked closure before taking the component's
        // inventory. Runtime admission cannot borrow an ancestor's WASM or FFI.
        materializeTavernTemplateRuntimeDependenciesV1({ repo, plan, packageRoot: output,
            libraryRoot: options.libraryRoot ?? '', admit: options.admitVendoredFile ?? (() => {
                throw Error('Template component requires complete public vendor admission');
            }) });
        assertTavernTemplateRuntimePackageV1({ repo, plan, packageRoot: output });
    }
    if (browserComponent) {
        materializeAuthorBrowserRuntimeDependenciesV1({ repo, plan, packageRoot: output,
            libraryRoot: options.libraryRoot ?? '', admit: options.admitVendoredFile ?? (() => {
                throw Error('Author browser component requires complete published vendor admission');
            }) });
    }
    if (promptComponent) {
        materializeAuthorPromptRuntimeDependenciesV1({ repo, plan, packageRoot: output,
            libraryRoot: options.libraryRoot ?? '', admit: options.admitVendoredFile ?? (() => {
                throw Error('Author prompt component requires complete locked vendor admission');
            }) });
    }
    if (Object.keys(ownedRootLibraries).length) {
        // These packages move to protected file pins outside the product tree.
        // Their own bundle must retain the locked closure before its inventory is
        // taken, so a later relink cannot borrow an ancestor or run SDK hooks.
        materializeBundledLibraries({ libraryRoot: options.libraryRoot ?? '', moduleRoot: inside(output, 'node_modules'),
            lockFile: inside(repo, artifact(rootRecipe.lockArtifact).source), libraries: ownedRootLibraries,
            admit: options.admitVendoredFile ?? (() => { throw Error('Owned SDKs require public vendor admission'); }) });
    }
    const files = regularPackageFiles(output).sort().map(file => ({ path: file,
        sha256: createHash('sha256').update(fs.readFileSync(inside(output, file))).digest('hex') }));
    return { name: pkg.name, version: pkg.version, files, excludedVendoredFiles };
}
/**
 * Caller owns a fresh candidate directory. Archives are explicit pinned inputs;
 * this operation has no network, pnpm, profile, or installed-package writes.
 * A failed candidate is never returned as usable and is the caller's cleanup.
 */
export function assembleProduct(options) {
    const repo = fs.realpathSync(options.repo);
    const plan = json(path.join(repo, 'release/source-manifest.json'));
    if (!plan.product?.packages.length)
        throw Error('Missing root product recipe');
    const artifact = (id) => {
        const row = plan.artifacts.find(item => item.id === id);
        if (!row)
            throw Error('Unregistered product artifact: ' + id);
        return row;
    };
    const metadata = json(inside(repo, artifact(plan.product.packageArtifact).source));
    if (metadata.name !== plan.publicRelease.packageName || metadata.version !== plan.publicRelease.candidateVersion) {
        throw Error('Product metadata differs from candidate identity');
    }
    const packageRoot = fs.realpathSync(options.packageRoot);
    const owned = plan.product.packages.map(row => {
        const source = artifact(row.packageArtifact).source;
        const pkg = json(inside(repo, source));
        if (!/^dsh-nexttavern-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pkg.name) || pkg.dsh?.bundle !== undefined) {
            throw Error('Invalid private product package: ' + pkg.name);
        }
        if (row.assembly && !options.archives[row.assembly])
            throw Error('Missing pinned archive: ' + row.assembly);
        const publicMetadata = artifact(row.packageArtifact).public?.path;
        return { ...row, source, pkg, publicMetadata };
    });
    const names = owned.map(row => row.pkg.name).sort();
    if (new Set(names).size !== names.length)
        throw Error('Duplicate product package');
    const declared = Object.keys(metadata.dependencies ?? {}).filter(name => name.startsWith('dsh-nexttavern-')).sort();
    const rootLibraries = plan.product.rootBundledLibraries?.libraries ?? {};
    const bundledNames = [...names, ...Object.keys(rootLibraries)].sort();
    if (JSON.stringify(names) !== JSON.stringify(declared)
        || JSON.stringify(bundledNames) !== JSON.stringify([...(metadata.bundleDependencies ?? [])].sort())) {
        throw Error('Root dependencies and registered private packages differ');
    }
    for (const [name, version] of Object.entries(rootLibraries)) {
        if (name.startsWith('@deepseek-ai/') || name.startsWith('dsh-nexttavern-')
            || metadata.dependencies?.[name] !== version)
            throw Error('Unpinned root bundled SDK: ' + name);
    }
    for (const { pkg } of owned)
        if (metadata.dependencies?.[pkg.name] !== pkg.version) {
            throw Error('Unpinned product dependency: ' + pkg.name);
        }
    // Host packages are supplied by native runtime resolution. Installing a
    // second copy in the profile can shadow that owner even at the same version.
    for (const pkg of [metadata, ...owned.map(row => row.pkg)]) {
        for (const dependency of Object.keys(pkg.dependencies ?? {})) {
            if (dependency.startsWith('@deepseek-ai/')) {
                throw Error('Host module must be a shared peer: ' + pkg.name + ' -> ' + dependency);
            }
        }
    }
    const moduleRoot = inside(packageRoot, 'node_modules');
    if (fs.existsSync(moduleRoot))
        throw Error('Candidate dependencies must be absent before assembly');
    fs.mkdirSync(moduleRoot);
    const bundledLibraries = plan.product.rootBundledLibraries
        ? materializeBundledLibraries({
            libraryRoot: options.libraryRoot ?? '', moduleRoot,
            lockFile: inside(repo, artifact(plan.product.rootBundledLibraries.lockArtifact).source),
            libraries: rootLibraries,
            admit: options.admitVendoredFile ?? (() => { throw Error('Root SDKs require public vendor admission'); }),
        }).packages : [];
    const packages = owned.map(({ pkg, packageArtifact, assembly, publicMetadata }) => {
        const output = inside(moduleRoot, pkg.name);
        const result = assembleProductPackage({ repo, output, packageArtifact, archives: options.archives,
            ...(options.libraryRoot === undefined ? {} : { libraryRoot: options.libraryRoot }),
            ...(options.admitVendoredFile === undefined ? {} : { admitVendoredFile: options.admitVendoredFile }) });
        if (assembly) {
            // The public compiler keeps the maintained SDK overlays at their source
            // package location. Complete that developer copy with the SAME admitted
            // upstream files, otherwise its emitted overlays import absent modules.
            // Existing projected sources keep their public normalization; upstream
            // maps remain with the exact private SDK, not a different source tree.
            if (!publicMetadata)
                throw Error('Assembled dependency has no public metadata mapping');
            const development = inside(packageRoot, path.posix.dirname(publicMetadata));
            for (const file of regularPackageFiles(output)) {
                // Component assembly has already vendored dependencies. The developer
                // overlay retains its prior upstream-only file boundary.
                if (file.startsWith('node_modules/'))
                    continue;
                const target = inside(development, file);
                if (file.endsWith('.map') || fs.existsSync(target))
                    continue;
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.copyFileSync(inside(output, file), target);
            }
        }
        return result;
    });
    // The activation layers travel in the same inventory as the compatibility
    // packages: the profile later pins these exact bytes and lists the name in
    // its own bundle roster, so a bundle that is absent, renamed or edited
    // between assembly and installation is rejected rather than installed.
    const bundles = (plan.product.bundles ?? []).map(row => {
        const base = plan.publicRelease.layoutPaths?.[row.layout];
        if (typeof base !== 'string' || base === '') {
            throw Error('Bundle recipe names an unregistered delivery layout: ' + row.layout);
        }
        const directory = inside(packageRoot, base);
        if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
            throw Error('Bundled activation layer is missing from the candidate: ' + base);
        }
        const bundle = json(path.join(directory, 'package.json'));
        const patch = bundle.dsh?.bundle?.patch;
        if (typeof patch !== 'string' || patch === '')
            throw Error('Bundle declares no activation layer: ' + base);
        // DSH reads the declaration as `./cordis.patch.yml`; the containment gate
        // wants the path without that prefix.
        if (!fs.existsSync(inside(directory, patch.replace(/^\.\//, '')))) {
            throw Error('Bundle patch file is missing: ' + base);
        }
        return { name: bundle.name, version: bundle.version, path: base,
            files: regularPackageFiles(directory).map(file => ({ path: file,
                sha256: createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex') })) };
    });
    const hostForks = stageHostForks(repo, packageRoot, plan);
    const hostForkProfile = plan.product.hostForkProfile
        ? makeHostForkProfile(plan.product.hostForkProfile, plan.product.hostForks ?? []) : undefined;
    // SDK bytes remain distinct from owned plugins and host singleton ownership.
    const inventory = { schemaVersion: 1, productVersion: metadata.version,
        packages: packages.map(({ excludedVendoredFiles, ...row }) => row), bundles, hostForks,
        rootBundledLibraries: rootLibraries, bundledLibraries,
        ...(hostForkProfile ? { hostForkProfile } : {})
    };
    const excludedVendoredFiles = packages.flatMap(row => row.excludedVendoredFiles
        .map(item => ({ package: row.name, ...item })));
    save(path.join(packageRoot, 'package.json'), metadata);
    save(path.join(packageRoot, 'nexttavern.dependencies.json'), inventory);
    fs.copyFileSync(inside(repo, artifact(plan.product.patchArtifact).source), path.join(packageRoot, 'cordis.patch.json'));
    return { ...inventory, excludedVendoredFiles };
}
