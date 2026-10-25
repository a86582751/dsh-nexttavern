// Generated from runtime/alpha3/src/operations/owned-dependency.mts; edit the TypeScript source.
/** Assemble an owned dependency from a pinned archive and registered source outputs. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolveTar } from './tool-resolution.mjs';
import { createTestDirectory, cleanupTestDirectory } from './test-temp.mjs';
function child(root, relative) {
    if (!relative || relative.includes('\\') || relative.includes(':') || path.posix.isAbsolute(relative)
        || relative.split('/').some(part => !part || part === '.' || part === '..')) {
        throw Error('Unsafe owned dependency path: ' + relative);
    }
    return path.join(root, relative);
}
/** Reject links/devices even inside a hash-verified archive; copying never follows them. */
export function regularPackageFiles(root) {
    const result = [];
    const visit = (directory) => {
        for (const name of fs.readdirSync(directory).sort()) {
            const file = path.join(directory, name);
            const stat = fs.lstatSync(file);
            if (stat.isSymbolicLink())
                throw Error('Dependency archive contains a symbolic link');
            if (stat.isDirectory())
                visit(file);
            else if (stat.isFile())
                result.push(path.relative(root, file).replaceAll('\\', '/'));
            else
                throw Error('Dependency archive contains a non-regular member');
        }
    };
    visit(root);
    return result;
}
/** Full collection and development overlays share this source/destination owner. */
export function planOwnedDependencyOverlays(options) {
    const repo = fs.realpathSync(options.repo);
    const manifest = options.plan ?? JSON.parse(fs.readFileSync(path.join(repo, 'release/source-manifest.json'), 'utf8'));
    const assembly = manifest.dependencyAssemblies?.[options.id];
    if (!assembly)
        throw Error('Unknown owned dependency: ' + options.id);
    const artifact = (id) => {
        const found = manifest.artifacts.find(item => item.id === id);
        if (!found)
            throw Error('Unregistered dependency artifact: ' + id);
        child(repo, found.source);
        return found.source;
    };
    const metadata = JSON.parse(fs.readFileSync(child(repo, artifact(assembly.packageArtifact)), 'utf8'));
    if (!metadata.name?.startsWith('dsh-nexttavern-') || metadata.name === assembly.upstreamPackage) {
        throw Error('Owned dependency must have an explicit owned package identity');
    }
    const ownedRoot = child(repo, assembly.ownedRoot);
    const files = assembly.overlays.map(id => {
        const source = artifact(id), absolute = child(repo, source);
        const target = path.relative(ownedRoot, absolute).replaceAll('\\', '/');
        child(ownedRoot, target);
        if (!fs.lstatSync(absolute).isFile())
            throw Error('Overlay must be a regular file: ' + id);
        return { source, target };
    });
    if (!assembly.overlays.includes(assembly.packageArtifact))
        throw Error('Missing owned package metadata overlay');
    if (new Set(files.map(file => file.target)).size !== files.length)
        throw Error('Duplicate owned dependency output');
    return { assembly, metadata, files, lockSource: artifact(assembly.lockArtifact),
        removed: files.filter(file => /\.[cm]?js$/.test(file.target)).map(file => file.target + '.map') };
}
/**
 * The output must be absent. All extraction and overlay work happens in a fresh
 * owned staging directory before claiming and filling a fresh output directory.
 * This never opens an installed upstream file for writing or runs a replay.
 */
export function assembleOwnedDependency(options) {
    const repo = fs.realpathSync(options.repo);
    const overlayPlan = planOwnedDependencyOverlays({ repo, id: options.id });
    const { assembly, metadata } = overlayPlan;
    const output = path.resolve(options.output);
    if (fs.existsSync(output))
        throw Error('Owned dependency output already exists');
    if (!fs.statSync(path.dirname(output)).isDirectory())
        throw Error('Output parent is not a directory');
    const lock = JSON.parse(fs.readFileSync(child(repo, overlayPlan.lockSource), 'utf8'));
    const pin = lock.packages?.['node_modules/' + assembly.upstreamPackage];
    if (pin?.version !== assembly.upstreamVersion || !pin.integrity?.startsWith('sha512-')) {
        throw Error('Owned dependency upstream differs from lock');
    }
    const archiveBytes = fs.readFileSync(options.archive);
    const integrity = 'sha512-' + createHash('sha512').update(archiveBytes).digest('base64');
    if (integrity !== pin.integrity)
        throw Error('Owned dependency archive integrity mismatch');
    const staging = createTestDirectory('owned-dependency-');
    try {
        // Extract the exact bytes we verified, not a path that could be replaced
        // between hashing and tar. The temporary tree is owned by this invocation.
        const archive = path.join(staging, 'upstream.tgz');
        fs.writeFileSync(archive, archiveBytes);
        const tar = resolveTar();
        const members = execFileSync(tar, ['-tzf', archive], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
            .trim().split(/\r?\n/);
        for (const member of members) {
            const relative = member.replace(/\/$/, '');
            if (relative !== 'package' && !relative.startsWith('package/'))
                throw Error('Unexpected archive root');
            child(staging, relative);
        }
        const listing = execFileSync(tar, ['-tvzf', archive], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })
            .trim().split(/\r?\n/);
        if (listing.length !== members.length || listing.some(line => !/^[-d]/.test(line))) {
            throw Error('Dependency archive must contain only regular files and directories');
        }
        const unpacked = path.join(staging, 'unpacked');
        fs.mkdirSync(unpacked);
        execFileSync(tar, ['-xzf', archive, '-C', unpacked], { stdio: 'pipe' });
        const upstream = path.join(unpacked, 'package');
        regularPackageFiles(upstream);
        const upstreamMetadata = JSON.parse(fs.readFileSync(path.join(upstream, 'package.json'), 'utf8'));
        if (upstreamMetadata.name !== assembly.upstreamPackage || upstreamMetadata.version !== assembly.upstreamVersion) {
            throw Error('Archive package identity differs from lock');
        }
        const prepared = path.join(staging, 'owned');
        fs.mkdirSync(prepared);
        fs.cpSync(child(upstream, assembly.upstreamTree), child(prepared, assembly.targetTree), { recursive: true });
        for (const overlay of overlayPlan.files) {
            const target = child(prepared, overlay.target);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(child(repo, overlay.source), target);
        }
        // An overlaid implementation must not retain an upstream source map.
        for (const file of overlayPlan.removed)
            fs.rmSync(child(prepared, file), { force: true });
        const files = regularPackageFiles(prepared).map(file => ({
            path: file,
            sha256: createHash('sha256').update(fs.readFileSync(child(prepared, file))).digest('hex'),
        }));
        // mkdir is the exclusive claim; copy/rollback touches only our fresh output.
        fs.mkdirSync(output);
        const outputIdentity = fs.realpathSync(output);
        try {
            fs.cpSync(prepared, output, { recursive: true });
        }
        catch (error) {
            if (!fs.lstatSync(output).isSymbolicLink() && fs.realpathSync(output) === outputIdentity) {
                fs.rmSync(output, { recursive: true, force: true });
            }
            throw error;
        }
        return { name: metadata.name, version: metadata.version, upstreamIntegrity: integrity, files };
    }
    finally {
        cleanupTestDirectory(staging);
    }
}
