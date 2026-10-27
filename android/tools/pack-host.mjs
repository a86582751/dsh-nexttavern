// Generated from android/tools/pack-host.mts; edit the TypeScript source.
/** Pack the admitted product and the unique official Host installation, without installing anything. */
import fs from 'node:fs/promises';
import { existsSync, realpathSync, readFileSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const maintenance = existsSync(path.join(root, 'release/source-manifest.json'));
const operations = maintenance
    ? path.join(root, 'runtime/alpha3/lib/operations') : path.join(root, 'lib/operations');
const tooling = createRequire(path.join(root, maintenance ? 'runtime/alpha3/build-tools/package.json' : 'build-tools/package.json'));
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (value) => value.replaceAll('\\', '/');
const inside = (base, file) => file === base || file.startsWith(base + path.sep);
const prefix = (name) => 'node_modules/' + name;
const PROFILE_FILES = ['package.json', 'cordis.yml', 'cordis.patch.yml', 'pnpm-workspace.yaml'];
const CA_SHA256 = '796f1389bfea13c0ed78f663b765baaff54a508e5483786bd6ece73c5e3e3cbe';
function admitTaskProfileTemplate(filename, bytes) {
    const text = bytes.split('\n').filter(line => !line.trim().startsWith('#')).join('\n').trim();
    if (text === '' || text === '[]')
        return;
    if (filename === 'cordis.patch.yml') {
        let rows;
        try {
            rows = tooling('js-yaml').load(text);
        }
        catch { }
        const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : undefined;
        const labels = new Set(['dsh-nexttavern-session-controller', 'dsh-nexttavern-ui-chat', 'dsh-nexttavern-ui-workspace']);
        if (row && typeof row === 'object' && Object.keys(row).length === 1 && Array.isArray(row.insert) && row.insert.length === 3
            && row.insert.every(value => value && typeof value === 'object' && Object.keys(value).length === 2
                && value.disabled === true && typeof value.id === 'string' && labels.delete(value.id)) && labels.size === 0)
            return;
    }
    throw new Error(`Unexpected task profile configuration: ${filename}; inspect before packing`);
}
function targetExcluded(metadata, abi) {
    const excludes = (values, current) => {
        const positive = values?.filter(value => !value.startsWith('!')) ?? [];
        return values?.includes('!' + current) === true || (positive.length > 0 && !positive.includes(current) && !positive.includes('any'));
    };
    return excludes(metadata.os, 'android') || excludes(metadata.cpu, abi);
}
function locations(owner, name) {
    const result = [];
    let cursor = owner;
    for (;;) {
        if (path.basename(cursor) !== 'node_modules')
            result.push(path.join(cursor, 'node_modules', name));
        const next = path.dirname(cursor);
        if (next === cursor)
            break;
        cursor = next;
    }
    return result;
}
function installed(owner, name, boundaries, optional = false) {
    const found = locations(owner, name).find(candidate => boundaries.some(base => inside(base, candidate))
        && existsSync(path.join(candidate, 'package.json')));
    if (!found) {
        if (optional)
            return undefined;
        throw new Error(`Required installed runtime package is missing: ${name} (from ${owner})`);
    }
    const resolved = realpathSync(found);
    if (!boundaries.some(base => inside(base, resolved)))
        throw new Error(`Installed package resolves outside admitted inputs: ${name}`);
    return resolved;
}
function npmCli() {
    const adjacent = path.dirname(process.execPath);
    const candidates = process.env.NEXTTAVERN_NPM_CLI ? [process.env.NEXTTAVERN_NPM_CLI] : [
        path.join(adjacent, 'node_modules/npm/bin/npm-cli.js'), path.join(adjacent, '../lib/node_modules/npm/bin/npm-cli.js'),
    ];
    const selected = candidates.find(file => file && path.isAbsolute(file) && existsSync(file));
    if (!selected)
        throw new Error('Set NEXTTAVERN_NPM_CLI to the existing npm JavaScript CLI');
    return selected;
}
async function publishedFiles(sources) {
    if (!sources.length)
        return [];
    // Reuse the canonical npm Arborist/packlist worker, not a second publish-file policy.
    const worker = path.join(operations, 'bundled-library-assembly.mjs');
    const output = execFileSync(process.execPath, [worker, '--npm-published-files', npmCli()], {
        input: JSON.stringify(sources), encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120_000,
    });
    return JSON.parse(output);
}
function plan(options) {
    const harness = realpathSync(options.harnessRoot), product = realpathSync(options.productRoot);
    const profile = realpathSync(options.profileRoot ?? path.join(harness, 'home/profiles/web'));
    if (!inside(path.join(harness, 'home'), profile))
        throw new Error('Only the unique task-owned Host profile may be packed');
    const metadata = json(path.join(product, 'package.json'));
    if (metadata.name !== 'dsh-nexttavern')
        throw new Error('productRoot must be the admitted dsh-nexttavern artifact');
    const inventory = readFileSync(path.join(product, 'nexttavern.dependencies.json'));
    const inventoried = JSON.parse(inventory.toString());
    const owned = new Map([...inventoried.packages, ...(inventoried.bundles ?? [])].map(row => [row.name, row]));
    const profileMetadata = json(path.join(profile, 'package.json'));
    if (!profileMetadata.dependencies?.['dsh-nexttavern'])
        throw new Error('Official product installation into the task profile is not complete');
    if (!profileMetadata.dependencies.dshmarket)
        throw new Error('Official market installation into the task profile is not complete');
    for (const filename of ['cordis.yml', 'cordis.patch.yml']) {
        admitTaskProfileTemplate(filename, readFileSync(path.join(profile, filename), 'utf8'));
    }
    const lockBytes = readFileSync(path.join(harness, 'package-lock.json'));
    const lock = JSON.parse(lockBytes.toString());
    if (lock.lockfileVersion !== 3)
        throw new Error('The pinned Host requires its npm v3 package lock');
    const installedProduct = installed(profile, 'dsh-nexttavern', [harness, product]);
    if (json(path.join(installedProduct, 'package.json')).version !== metadata.version)
        throw new Error('Installed profile product differs from admitted product version');
    const require = createRequire(npmCli());
    const semver = require('semver');
    const boundaries = [harness, product], placements = new Map(), excluded = [];
    const aliases = [];
    placements.set(prefix(metadata.name), { source: product, relative: prefix(metadata.name), metadata, opaque: true });
    const reserve = (name, source, opaque = false) => {
        const pkg = json(path.join(source, 'package.json'));
        if (pkg.name !== name)
            throw new Error(`Installed package identity differs: ${name}`);
        const relative = prefix(name), existing = placements.get(relative);
        if (existing && existing.source !== source)
            throw new Error(`Conflicting explicit runtime roots: ${name}`);
        if (!existing)
            placements.set(relative, { source, relative, metadata: pkg, opaque });
    };
    const profileNames = new Set([...Object.keys(profileMetadata.dependencies ?? {}), ...(profileMetadata.dsh?.profile?.bundles ?? [])]);
    for (const name of [...profileNames].sort()) {
        if (name === metadata.name)
            continue;
        const reference = profileMetadata.dependencies?.[name], spec = owned.get(name);
        if (spec) {
            if (!reference?.startsWith('file:'))
                throw new Error(`Inventoried profile package lacks its prepared file reference: ${name}`);
            const fixed = realpathSync(path.resolve(profile, reference.slice(5)));
            if (!inside(path.join(harness, 'home/maintenance/fixed-packages'), fixed))
                throw new Error(`Protected profile reference is outside its prepared owner: ${name}`);
            if (json(path.join(fixed, 'package.json')).version !== spec.version)
                throw new Error(`Protected profile version differs from product inventory: ${name}`);
            reserve(name, fixed, true);
            aliases.push({ name, sourcePath: installed(profile, name, boundaries), codePath: prefix(name) });
        }
        else
            reserve(name, installed(profile, name, boundaries));
    }
    const cli = installed(harness, '@deepseek-ai/dsh', boundaries);
    if (json(path.join(cli, 'package.json')).version !== '0.1.7-rc.2')
        throw new Error('Host version differs from pinned 0.1.7-rc.2');
    reserve('@deepseek-ai/dsh', cli);
    // Stock sharp 0.35.4 requires this raw WASM fallback by name, but does not
    // declare it as an optional edge. This is the one explicit pinned fallback.
    const wasm = installed(profile, '@img/sharp-wasm32', boundaries);
    if (json(path.join(wasm, 'package.json')).version !== '0.35.4')
        throw new Error('Sharp WASM fallback differs from pinned 0.35.4');
    reserve('@img/sharp-wasm32', wasm);
    const bridgeName = `node-addon-require-builtin-android-${options.abi}`;
    placements.set(prefix(bridgeName), { relative: prefix(bridgeName), generated: true, metadata: {
            name: bridgeName, version: '0.1.6', main: 'index.cjs', type: 'commonjs', os: ['android'], cpu: [options.abi],
        } });
    const visited = new Set();
    const sourceRow = (owner, name) => {
        for (const candidate of locations(owner, name)) {
            if (!inside(harness, candidate))
                continue;
            const found = lock.packages[slash(path.relative(harness, candidate))];
            if (found)
                return found;
        }
        return undefined;
    };
    const place = (owner, name, source) => {
        const candidates = locations(owner.relative, name).map(slash).filter(relative => relative.startsWith('node_modules/'));
        for (const relative of candidates) {
            const existing = placements.get(relative);
            if (!existing)
                continue;
            if (existing.source === source)
                return existing;
            const nested = slash(path.join(owner.relative, 'node_modules', name));
            const collision = placements.get(nested);
            if (collision && collision.source !== source)
                throw new Error(`Ambiguous installed nested dependency: ${owner.metadata.name} -> ${name}`);
            if (collision)
                return collision;
            const result = { source, relative: nested, metadata: json(path.join(source, 'package.json')) };
            placements.set(nested, result);
            return result;
        }
        const relative = prefix(name), result = { source, relative, metadata: json(path.join(source, 'package.json')) };
        placements.set(relative, result);
        return result;
    };
    const visit = (owner) => {
        if (visited.has(owner.relative) || owner.opaque || owner.generated)
            return;
        visited.add(owner.relative);
        if (inside(product, owner.source))
            throw new Error(`Product-owned graph must remain opaque, not collected as Host cache: ${owner.metadata.name}`);
        const optional = owner.metadata.optionalDependencies ?? {};
        const peers = owner.metadata.peerDependencies ?? {};
        const names = new Set([...Object.keys(owner.metadata.dependencies ?? {}), ...Object.keys(optional), ...Object.keys(peers)]);
        for (const name of [...names].sort()) {
            const optionalEdge = Object.hasOwn(optional, name) || owner.metadata.peerDependenciesMeta?.[name]?.optional === true;
            const pin = sourceRow(owner.source, name);
            if (optionalEdge && pin && targetExcluded(pin, options.abi)) {
                excluded.push({ owner: owner.metadata.name, name, reason: 'optional os/cpu excludes Android target' });
                continue;
            }
            const source = owner.metadata.peerDependenciesMeta?.[name]?.optional === true
                ? installed(owner.source, name, boundaries, true) : installed(owner.source, name, boundaries);
            if (!source) {
                excluded.push({ owner: owner.metadata.name, name, reason: 'Optional peer is absent from the official installed graph' });
                continue;
            }
            const pkg = json(path.join(source, 'package.json'));
            if (targetExcluded(pkg, options.abi)) {
                if (!optionalEdge)
                    throw new Error(`Required runtime dependency excludes Android target: ${name}`);
                excluded.push({ owner: owner.metadata.name, name, reason: 'optional os/cpu excludes Android target' });
                continue;
            }
            const range = optional[name] ?? owner.metadata.dependencies?.[name] ?? peers[name];
            if (semver.validRange(range) && !semver.satisfies(pkg.version, range, { includePrerelease: true })) {
                throw new Error(`Installed runtime version differs: ${owner.metadata.name} needs ${name}@${range}, got ${pkg.version}`);
            }
            visit(place(owner, name, source));
        }
    };
    for (const placement of [...placements.values()])
        visit(placement);
    return { harness, product, installedProduct, profile, metadata, inventoried, aliases,
        placements: [...placements.values()].sort((a, b) => a.relative.localeCompare(b.relative)),
        inventorySha256: digest(inventory), harnessLockSha256: digest(lockBytes), excluded, hostVersion: '0.1.7-rc.2' };
}
/** Read-only graph admission, useful while the emulator owns the heavy budget. */
export function inspectHostGraph(options) {
    const value = plan(options);
    return { hostVersion: value.hostVersion, productVersion: value.metadata.version,
        packages: value.placements.map(row => ({ name: row.metadata.name, version: row.metadata.version, path: row.relative,
            opaque: row.opaque === true, generated: row.generated === true })), optionalExcluded: value.excluded };
}
function inventoryMembers(inventory) {
    const members = [];
    const add = (base, files) => { for (const file of files)
        members.push(path.posix.join(base, file.path)); };
    for (const row of inventory.packages)
        add(prefix(row.name), row.files);
    for (const row of [...(inventory.bundles ?? []), ...(inventory.hostForks ?? []), ...(inventory.historicalComponents ?? [])])
        add(row.path, row.files);
    for (const row of inventory.bundledLibraries ?? [])
        add(prefix(row.path), row.files);
    for (const row of inventory.releasedRuntime?.dependencyNamespaces ?? [])
        add(row.path, row.files);
    return [...new Set(members)];
}
export async function inspectProductPublishedFiles(productRoot) {
    const product = realpathSync(productRoot);
    const selected = (await publishedFiles([product]))[0].files.map(file => slash(file).replace(/^\.\//, ''));
    const membership = new Set(selected);
    const inventory = json(path.join(product, 'nexttavern.dependencies.json'));
    const missing = inventoryMembers(inventory).filter(file => !membership.has(file));
    if (missing.length)
        throw new Error(`npm published product projection omits inventoried members (${missing.length}): ${missing.slice(0, 8).join(', ')}`);
    return selected;
}
/** A generated CommonJS adapter only; the stock entry still validates the real addon API/ABI. */
const BRIDGE_SOURCE = `'use strict';\nconst path = require('node:path');\nprocess.dlopen(module, path.join(process.env.NEXTTAVERN_NATIVE_LIBRARY_DIR, 'libnexttavern_require_builtin.so'));\n`;
const fixedDate = new Date('1980-01-01T00:00:00.000Z');
async function write(target, bytes) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { mode: 0o644 });
    await fs.utimes(target, fixedDate, fixedDate);
    return { path: '', sha256: digest(bytes), size: bytes.length };
}
async function opaqueFiles(directory, relative = '', ancestors = new Set()) {
    const physical = await fs.realpath(path.join(directory, relative));
    if (ancestors.has(physical))
        throw new Error(`Cyclic admitted product link requires explicit packaging review: ${relative}`);
    const next = new Set(ancestors);
    next.add(physical);
    const files = [];
    for (const entry of (await fs.readdir(path.join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const child = path.join(relative, entry.name), stat = await fs.stat(path.join(directory, child));
        if (stat.isDirectory())
            files.push(...await opaqueFiles(directory, child, next));
        else if (stat.isFile())
            files.push(slash(child));
        else
            throw new Error(`Unsupported product member: ${child}`);
    }
    return files;
}
export async function prepareHostTree(options, directory) {
    const planned = plan(options);
    await fs.mkdir(directory, { recursive: true });
    const ordinary = planned.placements.filter(row => !row.opaque && !row.generated);
    const sources = [...new Set(ordinary.map(row => row.source))];
    const lists = await publishedFiles(sources);
    const bySource = new Map(sources.map((source, index) => [source, lists[index].files]));
    const productFiles = await inspectProductPublishedFiles(planned.product);
    const packages = [];
    const excludedFiles = [], unqualifiedCapabilities = [];
    for (const row of planned.placements) {
        const target = path.join(directory, row.relative), files = [];
        if (row.generated) {
            for (const [name, bytes] of [['package.json', JSON.stringify(row.metadata, null, 2) + '\n'], ['index.cjs', BRIDGE_SOURCE]]) {
                files.push({ ...await write(path.join(target, name), Buffer.from(bytes)), path: name });
            }
        }
        else {
            const selected = row.source === planned.product ? productFiles : row.opaque ? await opaqueFiles(row.source) : bySource.get(row.source);
            let ptyPrebuilds = 0;
            for (const raw of selected) {
                const relative = slash(raw).replace(/^\.\//, '');
                // Dependency edges own package placement, including npm bundled children.
                if (!row.opaque && relative.split('/').includes('node_modules'))
                    continue;
                if (!row.opaque && row.metadata.name === 'node-pty' && relative.startsWith('prebuilds/')) {
                    if (!relative.startsWith(`prebuilds/android-${options.abi}/`)) {
                        excludedFiles.push({ package: row.metadata.name, path: relative, reason: 'Foreign node-pty prebuild; only the exact Android ABI folder is eligible' });
                        continue;
                    }
                    ptyPrebuilds++;
                }
                const bytes = await fs.readFile(path.join(row.source, relative));
                files.push({ ...await write(path.join(target, relative), bytes), path: relative });
            }
            if (!row.opaque && row.metadata.name === 'node-pty')
                unqualifiedCapabilities.push({ id: 'pty', reason: ptyPrebuilds
                        ? 'Android prebuild bytes included; actual PTY runtime remains unqualified' : 'No compatible Android node-pty prebuild is installed; PTY remains unqualified' });
        }
        packages.push({ name: row.metadata.name, version: row.metadata.version, path: row.relative,
            kind: row.source === planned.product ? 'published-admitted-product' : row.opaque ? 'opaque-protected-profile-package' : row.generated ? 'generated-installer-native-bridge' : 'activated-installed-runtime', files });
    }
    const profileFiles = [];
    for (const name of PROFILE_FILES) {
        const source = path.join(planned.profile, name);
        if (!existsSync(source))
            continue;
        await write(path.join(directory, 'profile-template', name), await fs.readFile(source));
        profileFiles.push(name);
    }
    const names = planned.placements.filter(row => row.relative === prefix(row.metadata.name)).map(row => row.metadata.name).sort();
    await write(path.join(directory, 'profile-packages.json'), Buffer.from(JSON.stringify(names, null, 2) + '\n'));
    await write(path.join(directory, 'profile-provision.json'), Buffer.from(JSON.stringify({
        schemaVersion: 1, sourceProfileRoot: planned.profile, sourceProductRoot: planned.product,
        sourceInstalledProductRoot: planned.installedProduct,
        productCodePath: prefix(planned.metadata.name),
        packages: [...planned.placements.filter(row => row.source).map(row => ({ name: row.metadata.name,
                sourcePath: row.source, codePath: row.relative })),
            ...(planned.installedProduct === planned.product ? [] : [{ name: planned.metadata.name,
                    sourcePath: planned.installedProduct, codePath: prefix(planned.metadata.name) }]), ...planned.aliases],
        lockMeaning: 'Original official install receipt; not an Android package-manager installation',
    }, null, 2) + '\n'));
    for (const name of ['host-launch', 'android-host']) {
        await write(path.join(directory, name + '.mjs'), await fs.readFile(path.join(root, 'android/host/lib', name + '.mjs')));
    }
    let caBundle;
    if (options.caBundle) {
        const certificate = await write(path.join(directory, 'certs/ca-certificates.pem'), await fs.readFile(options.caBundle));
        if (certificate.sha256 !== CA_SHA256)
            throw new Error('CA bundle differs from the locked Termux ca-certificates input');
        const licensePath = 'certs/ca-certificates-LICENSE';
        await write(path.join(directory, licensePath), await fs.readFile(path.join(root, 'android/app/src/main/assets/runtime-notices/ca-certificates-LICENSE')));
        caBundle = { path: 'certs/ca-certificates.pem', sha256: certificate.sha256, sourcePackage: 'ca-certificates',
            sourcePackageVersion: '1:2026.10.20-1', licensePath };
    }
    return { schemaVersion: 1, purpose: 'android-host-assets', abi: options.abi, hostVersion: planned.hostVersion,
        productVersion: planned.metadata.version, productInventorySha256: planned.inventorySha256, harnessLockSha256: planned.harnessLockSha256,
        packages, optionalExcluded: planned.excluded, excludedFiles, unqualifiedCapabilities, profileFiles, androidVerified: false,
        ...(caBundle ? { caBundle } : {}) };
}
async function allFiles(directory, relative = '') {
    const result = [];
    for (const entry of (await fs.readdir(path.join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
        const child = path.join(relative, entry.name);
        if (entry.isDirectory())
            result.push(...await allFiles(directory, child));
        else
            result.push(slash(child));
    }
    return result;
}
/** Archive a prepared logical tree; production packHost also requires the pinned CA input. */
export async function archiveHostTree(staging, output, receipt) {
    const out = path.resolve(output);
    await fs.mkdir(out, { recursive: true });
    // zip updates existing archives. A fresh owned staging directory prevents
    // an interrupted prior process's archive from retaining stale members.
    const zip = path.join(staging, '.host.zip');
    try {
        const files = await allFiles(staging);
        execFileSync('zip', ['-X', '-q', zip, '-@'], { cwd: staging, input: files.join('\n') + '\n', env: { ...process.env, TZ: 'UTC' } });
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(zip))
            hash.update(chunk);
        receipt.hostZipSha256 = hash.digest('hex');
        receipt.hostZipBytes = (await fs.stat(zip)).size;
        await fs.rename(zip, path.join(out, 'host.zip'));
        await fs.writeFile(path.join(out, 'host-version.txt'), receipt.hostZipSha256 + '\n');
        await fs.writeFile(path.join(out, 'host-pack.json'), JSON.stringify(receipt, null, 2) + '\n');
        return receipt;
    }
    finally {
        await fs.rm(zip, { force: true });
    }
}
export async function packHost(options) {
    if (!options.caBundle)
        throw new Error('Supply --ca-bundle with the existing locked Termux certificate file');
    const out = path.resolve(options.out);
    await fs.mkdir(out, { recursive: true });
    const staging = await fs.mkdtemp(path.join(out, '.host-stage-'));
    try {
        return await archiveHostTree(staging, out, await prepareHostTree(options, staging));
    }
    finally {
        await fs.rm(staging, { recursive: true, force: true });
    }
}
function argumentsOf(args) {
    const values = {};
    for (let index = 0; index < args.length; index += 2) {
        const key = args[index], value = args[index + 1];
        if (!key || !['--harness-root', '--product-root', '--out', '--abi', '--profile-root', '--ca-bundle'].includes(key) || !value)
            throw new Error('Usage: pack-host.mts --harness-root DIR --product-root DIR --out DIR --abi arm64|x64 --ca-bundle PEM [--profile-root DIR] [--plan]');
        values[key] = value;
    }
    if (!values['--harness-root'] || !values['--product-root'] || !values['--out'] || !['arm64', 'x64'].includes(values['--abi'] ?? ''))
        throw new Error('Missing or invalid pack-host inputs');
    return { harnessRoot: values['--harness-root'], productRoot: values['--product-root'], out: values['--out'], abi: values['--abi'],
        ...(values['--ca-bundle'] ? { caBundle: values['--ca-bundle'] } : {}),
        ...(values['--profile-root'] ? { profileRoot: values['--profile-root'] } : {}) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const args = process.argv.slice(2), options = argumentsOf(args.filter(arg => arg !== '--plan'));
    if (args.includes('--plan'))
        console.log(JSON.stringify(inspectHostGraph(options), null, 2));
    else {
        const receipt = await packHost(options);
        console.log(JSON.stringify({ hostZipSha256: receipt.hostZipSha256, bytes: receipt.hostZipBytes, packages: receipt.packages.length, androidVerified: false }));
    }
}
