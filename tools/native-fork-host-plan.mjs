// Generated from release/src/native-fork-host-plan.mts; edit the TypeScript source.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
export const NATIVE_FORKS = [
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-agent-loop',
];
export const HOST_VERSION = '0.1.7-rc.2';
const within = (root, child) => child === root || child.startsWith(root + path.sep);
const manifest = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const satisfies = (actual, range) => {
    if (!actual)
        return false;
    if (range === actual || range === '*')
        return true;
    if (range.includes('-'))
        return false;
    const prefix = range[0];
    if (prefix !== '^' && prefix !== '~')
        return false;
    const expected = range.slice(1).split('.').map(Number);
    const found = actual.split('.').map(Number);
    if (expected.length !== 3 || found.length !== 3 || [...expected, ...found].some(Number.isNaN))
        return false;
    if (found[0] !== expected[0] || ((prefix === '~' || expected[0] === 0) && found[1] !== expected[1]))
        return false;
    if (prefix === '^' && expected[0] === 0 && expected[1] === 0 && found[2] !== expected[2])
        return false;
    return found[0] > expected[0] || found[1] > expected[1] ||
        found[1] === expected[1] && found[2] >= expected[2];
};
function resolveManifest(name, anchor, hostRoot) {
    const resolver = createRequire(anchor);
    let entry;
    try {
        entry = resolver.resolve(name);
    }
    catch {
        entry = resolver.resolve(`${name}/package.json`);
    }
    const realEntry = fs.realpathSync(entry);
    if (!within(hostRoot, realEntry))
        throw new Error(`Resolved outside host: ${name} -> ${realEntry}`);
    let directory = path.dirname(realEntry);
    while (within(hostRoot, directory)) {
        const candidate = path.join(directory, 'package.json');
        if (fs.existsSync(candidate)) {
            if (fs.lstatSync(candidate).isSymbolicLink())
                throw new Error(`Symlink manifest: ${candidate}`);
            const real = fs.realpathSync(candidate);
            if (!within(hostRoot, real))
                throw new Error(`Manifest outside host: ${name} -> ${real}`);
            if (manifest(real).name === name)
                return real;
        }
        if (directory === hostRoot)
            break;
        directory = path.dirname(directory);
    }
    throw new Error(`No matching package manifest: ${name} from ${anchor}`);
}
/** Stable content fingerprint, excluding local install state and VCS metadata. */
export function packageTreeSha256(directory) {
    const entries = [];
    const visit = (relative) => {
        const current = path.join(directory, relative);
        for (const item of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
            if (['node_modules', '.git'].includes(item.name))
                continue;
            const file = path.join(relative, item.name);
            if (item.isSymbolicLink())
                throw new Error(`Symbolic link in package tree: ${file}`);
            if (item.isDirectory())
                visit(file);
            else if (item.isFile())
                entries.push(`${file.replaceAll('\\', '/')}\0${sha(fs.readFileSync(path.join(directory, file)))}`);
            else
                throw new Error(`Unsupported package entry: ${file}`);
        }
    };
    visit('');
    return sha(entries.join('\n'));
}
/** Read-only plan. It never copies, renames, installs, or executes package code. */
export function planNativeForkHost(input) {
    const errors = [];
    const packages = [];
    const applySteps = [];
    const rollbackSteps = [];
    const hostRoot = fs.realpathSync(input.hostRoot);
    const resolved = new Map();
    const queue = [];
    for (const anchor of input.anchors) {
        const real = fs.realpathSync(anchor);
        if (!within(hostRoot, real))
            errors.push(`Anchor outside host: ${anchor}`);
        for (const name of NATIVE_FORKS)
            queue.push({ name, anchor: real, range: HOST_VERSION, optional: false });
    }
    const planned = new Set();
    while (queue.length) {
        const { name, anchor, range, optional } = queue.shift();
        if (!within(hostRoot, anchor))
            continue;
        let real;
        try {
            real = resolveManifest(name, anchor, hostRoot);
        }
        catch (e) {
            if (!optional)
                errors.push(`Unresolved ${name} from ${anchor}: ${String(e)}`);
            continue;
        }
        let pkg;
        try {
            pkg = manifest(real);
        }
        catch {
            errors.push(`Invalid manifest: ${real}`);
            continue;
        }
        if (pkg.name !== name)
            errors.push(`Package identity mismatch: ${name} -> ${pkg.name} at ${real}`);
        if (NATIVE_FORKS.includes(name) && pkg.private === true)
            errors.push(`Host destination is already a private fork: ${name} at ${real}`);
        // The fixed native host packages must never cross an rc.2 boundary.
        if (name.startsWith('@deepseek-ai/dsh-') && pkg.version !== HOST_VERSION)
            errors.push(`Version mismatch: ${name} ${pkg.version} at ${real}`);
        if (!satisfies(pkg.version, range))
            errors.push(`${range.includes('-') && range !== pkg.version ? 'Unsupported prerelease range' : 'Required'} ${name}@${range}, found ${pkg.version} at ${real}`);
        const prior = resolved.get(`${anchor}\0${name}`);
        if (prior && prior !== real)
            errors.push(`Unstable resolution: ${name} from ${anchor}`);
        resolved.set(`${anchor}\0${name}`, real);
        if (planned.has(real))
            continue;
        planned.add(real);
        if (planned.size > 1000) {
            errors.push('Dependency graph exceeds 1000 packages');
            break;
        }
        const directory = path.dirname(real);
        let fingerprint;
        try {
            fingerprint = packageTreeSha256(directory);
        }
        catch (e) {
            errors.push(String(e));
            continue;
        }
        packages.push({ name, version: pkg.version ?? '', manifestPath: real, sha256: fingerprint });
        for (const [dependency, version] of Object.entries({ ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.optionalDependencies })) {
            queue.push({ name: dependency, anchor: real, range: version,
                optional: dependency in (pkg.optionalDependencies ?? {}) || pkg.peerDependenciesMeta?.[dependency]?.optional === true });
        }
    }
    for (const name of NATIVE_FORKS) {
        const source = input.sources[name];
        if (!source) {
            errors.push(`Missing source: ${name}`);
            continue;
        }
        const directory = fs.realpathSync(source.directory);
        if (within(hostRoot, directory))
            errors.push(`Fork source is inside fixed host: ${name}`);
        const pkg = manifest(path.join(directory, 'package.json'));
        if (pkg.name !== name || pkg.version !== HOST_VERSION)
            errors.push(`Source identity mismatch: ${name}`);
        const actual = packageTreeSha256(directory);
        if (actual !== source.sha256)
            errors.push(`Source hash mismatch: ${name}`);
        const destinations = packages.filter(item => item.name === name);
        if (!destinations.length)
            errors.push(`No host destination: ${name}`);
        for (const destination of destinations) {
            const target = path.dirname(destination.manifestPath);
            if (destination.sha256 === source.sha256)
                errors.push(`Host destination already holds fork bytes: ${name} -> ${target}`);
            if (fs.existsSync(path.join(directory, 'node_modules')) || fs.existsSync(path.join(target, 'node_modules'))) {
                errors.push(`Nested node_modules prevents whole-directory replacement: ${name} -> ${target}`);
                continue;
            }
            const backup = `${target}.nexttavern-before-${source.sha256.slice(0, 12)}`;
            if (fs.existsSync(backup))
                errors.push(`Backup path occupied: ${backup}`);
            applySteps.push({ action: 'backup', from: target, to: backup, sha256: destination.sha256 });
            applySteps.push({ action: 'replace', from: directory, to: target, sha256: source.sha256 });
            applySteps.push({ action: 'verify', from: target, sha256: source.sha256 });
            rollbackSteps.unshift({ action: 'remove-replacement', from: target, sha256: source.sha256 }, { action: 'rollback', from: backup, to: target, sha256: destination.sha256 });
        }
    }
    return { ok: errors.length === 0, errors, packages, applySteps: errors.length === 0 ? applySteps : [],
        rollbackSteps: errors.length === 0 ? rollbackSteps : [] };
}
