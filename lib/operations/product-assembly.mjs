// Generated from runtime/alpha3/src/operations/product-assembly.mts; edit the TypeScript source.
/** Materialize the product's registered private packages, never installed files. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { assembleOwnedDependency, regularPackageFiles } from './owned-dependency.mjs';
import { contained as inside } from './public-transaction.mjs';
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
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
    if (JSON.stringify(names) !== JSON.stringify(declared)
        || JSON.stringify(names) !== JSON.stringify([...(metadata.bundleDependencies ?? [])].sort())) {
        throw Error('Root dependencies and registered private packages differ');
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
    const packages = owned.map(({ pkg, source, assembly, publicMetadata, resources }) => {
        const output = inside(moduleRoot, pkg.name);
        if (assembly) {
            const result = assembleOwnedDependency({ repo, id: assembly, archive: options.archives[assembly], output });
            if (result.name !== pkg.name || result.version !== pkg.version)
                throw Error('Assembly identity differs from recipe');
            // The public compiler keeps the maintained SDK overlays at their source
            // package location. Complete that developer copy with the SAME admitted
            // upstream files, otherwise its emitted overlays import absent modules.
            // Existing projected sources keep their public normalization; upstream
            // maps remain with the exact private SDK, not a different source tree.
            if (!publicMetadata)
                throw Error('Assembled dependency has no public metadata mapping');
            const development = inside(packageRoot, path.posix.dirname(publicMetadata));
            for (const file of regularPackageFiles(output)) {
                const target = inside(development, file);
                if (file.endsWith('.map') || fs.existsSync(target))
                    continue;
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.copyFileSync(inside(output, file), target);
            }
        }
        else {
            const prefix = path.posix.dirname(source) + '/';
            const files = new Set(plan.artifacts.filter(row => row.source.startsWith(prefix)).map(row => row.source));
            for (const file of files) {
                const target = inside(output, file.slice(prefix.length));
                fs.mkdirSync(path.dirname(target), { recursive: true });
                fs.copyFileSync(inside(repo, file), target);
            }
        }
        for (const resource of resources ?? []) {
            const target = inside(output, resource.path);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(inside(repo, artifact(resource.artifact).source), target);
        }
        const excluded = vendorLibraries(output, pkg.name, pkg.dependencies ?? {}, options.libraryRoot, plan.product.bundleLibraries ?? {}, options.admitVendoredFile, plan.product.bundlePlatforms ?? []);
        const files = regularPackageFiles(output).sort().map(file => ({ path: file,
            sha256: createHash('sha256').update(fs.readFileSync(inside(output, file))).digest('hex') }));
        return { name: pkg.name, version: pkg.version, files, excludedVendoredFiles: excluded };
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
    const inventory = { schemaVersion: 1, productVersion: metadata.version,
        packages: packages.map(({ excludedVendoredFiles, ...row }) => row), bundles };
    const excludedVendoredFiles = packages.flatMap(row => row.excludedVendoredFiles
        .map(item => ({ package: row.name, ...item })));
    save(path.join(packageRoot, 'package.json'), metadata);
    save(path.join(packageRoot, 'nexttavern.dependencies.json'), inventory);
    fs.copyFileSync(inside(repo, artifact(plan.product.patchArtifact).source), path.join(packageRoot, 'cordis.patch.json'));
    return { ...inventory, excludedVendoredFiles };
}
