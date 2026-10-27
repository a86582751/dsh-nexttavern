// Generated from runtime/alpha3/src/operations/bundled-library-assembly.mts; edit the TypeScript source.
/** Carry a locked SDK dependency closure without installing or executing it. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
/** Actual materialized roots, including installed optional peers. Nested
 * placements remain owned by their root package and are not promoted. */
export function topLevelBundledLibraryVersions(packages) {
    return Object.fromEntries(packages.filter(row => row.path === row.name).map(row => [row.name, row.version]));
}
/** Directory installers follow dependency metadata when collecting nested
 * bundles. The owned carrier must explicitly retain every delivered root. */
export function normalizeBundledLibraryMetadata(metadata, modules) {
    return { ...metadata, dependencies: { ...metadata.dependencies, ...modules },
        bundleDependencies: [...new Set([...(metadata.bundleDependencies ?? []), ...Object.keys(modules)])] };
}
const NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const LICENSE = /^(?:licen[sc]e|copying|notice)(?:[._-].*)?$/i;
const slash = (value) => value.replaceAll('\\', '/');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => {
    if (Array.isArray(value))
        return JSON.stringify(value.map(item => JSON.parse(stable(item))));
    if (value !== null && typeof value === 'object') {
        return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, JSON.parse(stable(item))])));
    }
    return JSON.stringify(value ?? null);
};
function relativeFile(value) {
    if (!value || value.includes('\\') || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)
        || value.split('/').some(part => part === '..' || part === '.' || !part)) {
        throw Error('Unsafe bundled library path: ' + value);
    }
    return value;
}
/** Reject child links as well as lexical traversal: npm must not resolve off-tree. */
function contained(root, relative) {
    relativeFile(relative);
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep))
        throw Error('Bundled library source escape: ' + relative);
    let cursor = root;
    if (fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink())
        throw Error('Linked bundled library root');
    for (const part of relative.split('/')) {
        cursor = path.join(cursor, part);
        if (fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) {
            throw Error('Linked bundled library path: ' + relative);
        }
    }
    return target;
}
function outputRoot(value) {
    let cursor = path.resolve(value);
    const missing = [];
    while (!fs.existsSync(cursor)) {
        if (fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink())
            throw Error('Linked bundled output root');
        missing.unshift(path.basename(cursor));
        cursor = path.dirname(cursor);
    }
    // An existing output or ancestor must not redirect writes into another tree.
    for (let ancestor = cursor;; ancestor = path.dirname(ancestor)) {
        if (fs.lstatSync(ancestor).isSymbolicLink())
            throw Error('Linked bundled output root');
        if (path.dirname(ancestor) === ancestor)
            break;
    }
    return path.join(fs.realpathSync(cursor), ...missing);
}
function dependencyName(name) {
    if (!NAME.test(name) || name.startsWith('@deepseek-ai/')) {
        throw Error('Host or invalid bundled library dependency: ' + name);
    }
}
/** Node placement, shared by lock planning and actual source admission. */
function dependencyLocations(owner, name) {
    const found = [];
    let directory = owner;
    while (directory && directory !== '.') {
        if (path.posix.basename(directory) !== 'node_modules')
            found.push(path.posix.join(directory, 'node_modules', name));
        directory = path.posix.dirname(directory);
    }
    found.push(name);
    return [...new Set(found)];
}
/** Only rows reachable from these pins affect this closure's development key.
 * This consumes the lock, never package directories or SDK file contents. */
export function bundledLibraryLockFingerprint(options) {
    const locked = options.lock.packages;
    if (options.lock.lockfileVersion !== 3 || !locked)
        throw Error('Bundled libraries require an npm v3 package lock');
    const rows = new Map();
    const visit = (relative) => {
        const key = 'node_modules/' + relative;
        if (rows.has(key))
            return;
        const row = locked[key];
        rows.set(key, row ?? null);
        if (!row)
            return;
        const dependencies = { ...row.dependencies, ...row.optionalDependencies, ...row.peerDependencies };
        for (const name of Object.keys(dependencies).sort()) {
            dependencyName(name);
            const candidates = dependencyLocations(relative, name);
            visit(candidates.find(candidate => Object.hasOwn(locked, 'node_modules/' + candidate)) ?? candidates[0]);
        }
    };
    for (const name of Object.keys(options.libraries).sort()) {
        dependencyName(name);
        visit(name);
    }
    return createHash('sha256').update(stable({ libraries: options.libraries,
        rows: [...rows].sort(([a], [b]) => a.localeCompare(b)) })).digest('hex');
}
function npmCli() {
    const configured = process.env.NEXTTAVERN_NPM_CLI;
    const adjacent = path.dirname(process.execPath);
    const candidates = configured ? [configured] : [
        path.join(adjacent, 'node_modules/npm/bin/npm-cli.js'),
        path.join(adjacent, '../lib/node_modules/npm/bin/npm-cli.js'),
    ];
    const selected = candidates.find(file => path.isAbsolute(file) && fs.existsSync(file));
    if (!selected)
        throw Error('Set NEXTTAVERN_NPM_CLI to an existing npm JavaScript CLI');
    return selected;
}
function publishedFiles(sources) {
    if (!sources.length)
        return [];
    // npm pack --dry-run still creates, compresses and inspects every tarball.
    // One worker runs its official file-list step while this API stays synchronous.
    const output = execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--npm-published-files', npmCli()], {
        input: JSON.stringify(sources), encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    // packlist can retain a root ./ on explicit files, while npm's tar receipt
    // removes it. Normalize that prefix before applying the contained-path gate.
    return JSON.parse(output).map(row => ({ ...row,
        files: [...new Set(row.files.map(file => relativeFile(slash(file).replace(/^\.\//, ''))))].sort() }));
}
function excludesPlatform(entry, target = { platform: process.platform, arch: process.arch }) {
    const excluded = (values, current) => {
        if (!Array.isArray(values) || !values.length || values.some(value => typeof value !== 'string'))
            return false;
        const positive = values.filter(value => !value.startsWith('!'));
        return values.includes('!' + current) || (positive.length > 0 && !positive.includes(current) && !positive.includes('any'));
    };
    return excluded(entry.os, target.platform) || excluded(entry.cpu, target.arch);
}
function declaredEntry(metadata, file) {
    const targets = [];
    const collect = (value) => {
        if (typeof value === 'string')
            targets.push(value.replace(/^\.\//, ''));
        else if (value !== null && typeof value === 'object')
            for (const child of Object.values(value))
                collect(child);
    };
    for (const value of [metadata.main, metadata.module, metadata.types, metadata.typings, metadata.exports, metadata.bin])
        collect(value);
    return targets.some(target => target === file || (target.includes('*')
        && new RegExp('^' + target.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(file)));
}
/**
 * All graph/file/target checks finish before copying. The caller owns candidate
 * cleanup if a filesystem write fails; source and lock are never modified.
 * No LLM calls, network requests, dependency installs or lifecycle scripts.
 */
export function materializeBundledLibraries(options) {
    const libraryRoot = fs.realpathSync(options.libraryRoot);
    const moduleRoot = outputRoot(options.moduleRoot);
    if (moduleRoot === libraryRoot || moduleRoot.startsWith(libraryRoot + path.sep)
        || libraryRoot.startsWith(moduleRoot + path.sep))
        throw Error('Bundled source and output must not overlap');
    const lock = read(options.lockFile);
    if (lock.lockfileVersion !== 3 || !lock.packages)
        throw Error('Bundled libraries require an npm v3 package lock');
    const locked = lock.packages;
    // npm already depends on semver. Use that CLI's own resolver, matching the
    // publisher's range semantics without adding a public build-tools dependency.
    const semver = createRequire(npmCli())('semver');
    const planned = new Map();
    const excludedOptional = new Set();
    const lockKey = (source) => 'node_modules/' + slash(path.relative(libraryRoot, source));
    const validateLock = (key, name, range) => {
        const row = locked[key];
        if (!row || row.link || !row.version || !row.resolved || !row.integrity) {
            throw Error('Missing or non-registry bundled library lock row: ' + key);
        }
        let resolved;
        try {
            resolved = new URL(row.resolved);
        }
        catch {
            throw Error('Invalid bundled library lock source: ' + name);
        }
        if (resolved.protocol !== 'https:' || resolved.username || resolved.password
            || !/^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/.test(row.integrity)) {
            throw Error('Invalid bundled library lock source: ' + name);
        }
        if (!semver.valid(row.version) || !semver.validRange(range) || !semver.satisfies(row.version, range)) {
            throw Error('Bundled library version differs from lock or requirement: ' + name);
        }
        return row;
    };
    const validate = (source, name, range) => {
        const row = validateLock(lockKey(source), name, range);
        const metadata = read(contained(source, 'package.json'));
        if (metadata.name !== name || metadata.version !== row.version) {
            throw Error('Bundled library version differs from manifest, lock or requirement: ' + name);
        }
        for (const key of ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'os', 'cpu']) {
            if (stable(metadata[key] ?? (key === 'os' || key === 'cpu' ? [] : {}))
                !== stable(row[key] ?? (key === 'os' || key === 'cpu' ? [] : {}))) {
                throw Error('Bundled library source metadata differs from lock: ' + name + '.' + key);
            }
        }
        return metadata;
    };
    const locations = (owner, name) => dependencyLocations(slash(path.relative(libraryRoot, owner)), name);
    const visit = (source, name, range) => {
        dependencyName(name);
        // Validate every incoming constraint even for an already-seen cycle node.
        // Its metadata/lock identity was admitted on the first incoming edge.
        const previous = planned.get(source);
        if (previous) {
            if (previous.metadata.name !== name || !semver.validRange(range)
                || !semver.satisfies(previous.metadata.version, range)) {
                throw Error('Bundled library version differs from lock or requirement: ' + name);
            }
            return;
        }
        const metadata = validate(source, name, range);
        const relative = slash(path.relative(libraryRoot, source));
        planned.set(source, { source, relative, metadata, files: [] });
        const follow = (dependency, requirement, kind) => {
            dependencyName(dependency);
            if (typeof requirement !== 'string' || !semver.validRange(requirement)) {
                throw Error('Unsupported bundled library requirement: ' + name + ' -> ' + dependency);
            }
            const candidates = locations(source, dependency);
            // Cross-target builds must not inherit optional binaries merely because
            // the build machine has them in its dependency cache.
            if (kind === 'optional' && options.target) {
                const key = candidates.map(candidate => 'node_modules/' + candidate).find(key => locked[key]);
                if (key && locked[key]?.optional === true && excludesPlatform(locked[key], options.target)) {
                    validateLock(key, dependency, requirement);
                    excludedOptional.add(contained(libraryRoot, key.slice('node_modules/'.length)));
                    return;
                }
            }
            for (const candidate of candidates) {
                const directory = contained(libraryRoot, candidate);
                if (fs.existsSync(directory)) {
                    visit(directory, dependency, requirement);
                    return;
                }
            }
            if (kind === 'optional-peer')
                return;
            const missingKey = candidates.map(candidate => 'node_modules/' + candidate).find(key => locked[key]);
            const missing = missingKey ? locked[missingKey] : undefined;
            if (kind === 'optional' && missing?.optional === true && excludesPlatform(missing, options.target)) {
                validateLock(missingKey, dependency, requirement);
                return;
            }
            throw Error('Missing bundled library dependency: ' + name + ' -> ' + dependency);
        };
        const optional = metadata.optionalDependencies ?? {};
        for (const [dependency, requirement] of Object.entries(metadata.dependencies ?? {})) {
            if (!Object.hasOwn(optional, dependency))
                follow(dependency, requirement, 'required');
        }
        for (const [dependency, requirement] of Object.entries(optional))
            follow(dependency, requirement, 'optional');
        for (const [dependency, requirement] of Object.entries(metadata.peerDependencies ?? {})) {
            follow(dependency, requirement, metadata.peerDependenciesMeta?.[dependency]?.optional === true ? 'optional-peer' : 'required');
        }
    };
    for (const [name, version] of Object.entries(options.libraries).sort(([a], [b]) => a.localeCompare(b))) {
        dependencyName(name);
        if (semver.valid(version) !== version)
            throw Error('Bundled root library must have an exact version: ' + name);
        visit(contained(libraryRoot, name), name, version);
    }
    const bundledChild = (owner, file) => {
        const parts = file.split('/');
        let cursor = owner.source;
        let offset = 0;
        while (parts[offset] === 'node_modules') {
            offset += 1;
            const first = parts[offset++];
            if (!first)
                throw Error('Invalid npm bundled child path: ' + file);
            const name = first.startsWith('@') ? first + '/' + parts[offset++] : first;
            dependencyName(name);
            const found = locations(cursor, name).map(candidate => contained(libraryRoot, candidate))
                .find(candidate => fs.existsSync(candidate));
            if (found && excludedOptional.has(found))
                return;
            if (!found || !planned.has(found)) {
                throw Error('npm bundled child is outside the locked runtime closure: ' + owner.relative + '/' + file);
            }
            cursor = found;
        }
        const childFile = relativeFile(parts.slice(offset).join('/'));
        if (!fs.lstatSync(contained(cursor, childFile), { throwIfNoEntry: false })?.isFile()) {
            throw Error('npm bundled child file differs from source placement: ' + file);
        }
        // This child's own npm file list and admission gate generate its separate
        // receipt. Never count the same nested bytes in the parent's file list.
    };
    const packages = [...planned.values()];
    const fileLists = publishedFiles(packages.map(item => item.source));
    for (const [index, item] of packages.entries()) {
        const published = fileLists[index];
        for (const file of published.files) {
            if (file.startsWith('node_modules/')) {
                bundledChild(item, file);
                continue;
            }
            const from = contained(item.source, file);
            if (!fs.lstatSync(from).isFile())
                throw Error('Bundled published file is not regular: ' + item.relative + '/' + file);
            let bytes = fs.readFileSync(from);
            if (file === 'package.json' && typeof item.metadata.bin === 'string') {
                // Reuse npm's already-normalized bin semantics. pnpm's nested directory
                // collector otherwise iterates a scalar bin as character properties.
                bytes = Buffer.from(JSON.stringify({ ...JSON.parse(bytes.toString('utf8')), bin: published.normalizedBin }, null, 2) + '\n');
            }
            if (!options.admit(file, bytes)) {
                if (file === 'package.json' || LICENSE.test(path.posix.basename(file)) || declaredEntry(item.metadata, file)) {
                    throw Error('Bundled mandatory file rejected: ' + item.relative + '/' + file);
                }
                continue;
            }
            item.files.push({ path: file, bytes, sha256: digest(bytes) });
        }
        if (!item.files.some(file => file.path === 'package.json'))
            throw Error('Bundled package metadata was not published: ' + item.relative);
        const target = contained(moduleRoot, item.relative);
        for (const file of item.files) {
            const destination = contained(target, file.path);
            if (fs.existsSync(destination) && (!fs.lstatSync(destination).isFile()
                || !fs.readFileSync(destination).equals(file.bytes)))
                throw Error('Bundled library output conflict: ' + item.relative + '/' + file.path);
        }
    }
    for (const item of planned.values()) {
        const target = contained(moduleRoot, item.relative);
        for (const file of item.files) {
            const destination = contained(target, file.path);
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, file.bytes);
        }
    }
    return { packages: [...planned.values()].sort((a, b) => a.relative.localeCompare(b.relative)).map(item => ({
            name: item.metadata.name, version: item.metadata.version, path: item.relative,
            files: item.files.map(({ path: file, sha256 }) => ({ path: file, sha256 })),
        })) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    && process.argv[2] === '--npm-published-files') {
    const requireNpm = createRequire(process.argv[3]);
    const Arborist = requireNpm('@npmcli/arborist');
    const packlist = requireNpm('npm-packlist');
    const sources = JSON.parse(fs.readFileSync(0, 'utf8'));
    const files = [];
    for (const source of sources) {
        // Match pacote's directory fetcher before tar creation. A direct package
        // pack has no workspace selection, so prefix has no ignore-rule effect.
        const tree = await new Arborist({ path: source }).loadActual();
        files.push({ files: await packlist(tree, { path: source }),
            ...(tree.package.bin === undefined ? {} : { normalizedBin: tree.package.bin }) });
    }
    process.stdout.write(JSON.stringify(files));
}
