// Generated from android/host/host-launch.mts; edit the TypeScript source.
var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
/** Android-owned entry; the pinned Harness still owns profile boot and auth. */
import { mkdir, readFile, writeFile, symlink, rename, readlink, unlink, link, open, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { getSystemErrorName } from 'node:util';
const code = path.dirname(fileURLToPath(import.meta.url));
// Use the admitted product's declared parser, not an incidental Host-root copy.
const { parseDocument } = createRequire(path.join(code, 'node_modules/dsh-nexttavern/package.json'))('yaml');
const home = process.env.DSH_HOME;
// ProcessBuilder sets cwd to the canonical native-managed private workspace.
// The pinned Host has no Android system-Documents resolver; use its explicit
// deployment option instead. Existing Workspace registrations are not moved.
const workspace = process.cwd();
if (!home || !process.env.NEXTTAVERN_GENERATION)
    throw new Error('Native host paths and generation are required');
const profile = path.join(home, 'profiles', 'web');
await mkdir(profile, { recursive: true });
// One native-owned process initializes the profile before the Host can mutate it.
// Every first publication is no-clobber; malformed existing user files are not repaired.
let nativePublish;
async function publish(source, target) {
    if (process.platform !== 'android') {
        // Explicit desktop fixture route. Android must use public Bionic renameat2.
        await link(source, target);
        return;
    }
    if (!nativePublish) {
        const binding = process.env.NEXTTAVERN_FLOCK_ADDON;
        if (!binding || !path.isAbsolute(binding))
            throw new Error('Android publication binding is required');
        const native = { exports: {} };
        process.dlopen(native, binding);
        if (!native.exports.publishNoReplace)
            throw new Error('Android atomic publication is unavailable');
        nativePublish = native.exports.publishNoReplace;
    }
    const errno = await new Promise(resolve => nativePublish(source, target, resolve));
    if (!Number.isInteger(errno) || errno < 0)
        throw new Error('Invalid publication result');
    if (errno)
        throw Object.assign(new Error('Android atomic publication failed'), { code: getSystemErrorName(-errno) });
}
async function output(filename, bytes, first = false) {
    const staged = filename + '.next-' + randomUUID();
    try {
        const handle = await open(staged, 'wx', 0o600);
        try {
            await handle.writeFile(bytes);
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        if (first) {
            try {
                await publish(staged, filename);
            }
            catch (error) {
                if (error.code === 'EEXIST')
                    return false;
                throw error;
            }
        }
        else
            await rename(staged, filename);
        const directory = await open(path.dirname(filename), 'r');
        try {
            await directory.sync();
        }
        finally {
            await directory.close();
        }
        return true;
    }
    finally {
        try {
            await unlink(staged);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
}
async function exists(filename) {
    try {
        await lstat(filename);
        return true;
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return false;
        throw error;
    }
}
const maps = ['dependencies', 'overrides'];
function fieldMap(manifest, map) {
    return map === 'dependencies' ? manifest.dependencies : manifest.pnpm?.overrides;
}
function ownedFields(manifest) {
    const owned = { dependencies: {}, overrides: {} };
    for (const map of maps)
        owned[map] = Object.fromEntries(Object.entries(fieldMap(manifest, map) ?? {})
            .filter((row) => typeof row[1] === 'string' && row[1].startsWith('file:')));
    return owned;
}
const receiptPath = path.join(profile, '.nexttavern-android-code.json');
const manifestPath = path.join(profile, 'package.json');
const serialize = (value) => JSON.stringify(value, null, 2) + '\n';
async function seeded(root) {
    const provision = JSON.parse(await readFile(path.join(root, 'profile-provision.json'), 'utf8'));
    const references = [...provision.packages].sort((a, b) => b.sourcePath.length - a.sourcePath.length);
    const seed = JSON.parse(await readFile(path.join(root, 'profile-template/package.json'), 'utf8'));
    for (const map of maps)
        for (const [name, value] of Object.entries(fieldMap(seed, map) ?? {})) {
            if (typeof value !== 'string' || !value.startsWith('file:'))
                continue;
            const source = path.resolve(provision.sourceProfileRoot, value.slice(5));
            const item = references.find(item => source === item.sourcePath || source.startsWith(item.sourcePath + path.sep));
            if (!item)
                throw new Error('Profile file reference is outside the admitted app packages');
            fieldMap(seed, map)[name] = 'file:' + path.join(root, item.codePath, path.relative(item.sourcePath, source));
        }
    return seed;
}
const seed = await seeded(code);
// A pending seed is recorded only when no manifest exists. Exact complete bytes
// establish an interrupted publication; other current bytes remain user-owned.
const initial = { schemaVersion: 2, codeRoot: code, owned: { dependencies: {}, overrides: {} },
    ...(!await exists(manifestPath) ? { seed: serialize(seed) } : {}) };
if (!await exists(receiptPath))
    await output(receiptPath, serialize(initial), true);
let stored = JSON.parse(await readFile(receiptPath, 'utf8'));
if (!await exists(manifestPath) && (stored.schemaVersion === 1 || stored.seed === undefined)) {
    // An absent manifest has no fields to replay. Journal the current seed and
    // its code identity before publishing it, including after user deletion or
    // an old launch interrupted before first creation. Do not reinterpret an
    // unknown receipt as permission to repair existing profile bytes.
    const recognized = typeof stored.codeRoot === 'string' && path.isAbsolute(stored.codeRoot)
        && (stored.schemaVersion === 1 || (stored.schemaVersion === 2 && stored.owned
            && typeof stored.owned.dependencies === 'object' && stored.owned.dependencies !== null
            && typeof stored.owned.overrides === 'object' && stored.owned.overrides !== null));
    if (!recognized)
        throw new Error('Unsupported Android profile receipt');
    stored = { schemaVersion: 2, codeRoot: code, owned: { dependencies: {}, overrides: {} }, seed: serialize(seed) };
    await output(receiptPath, serialize(stored));
}
if (stored.schemaVersion === 1) {
    // Legacy receipts did not record fields. Only the retained original seed can
    // supply exact provenance; a root prefix alone never authorizes a rewrite.
    let legacy;
    try {
        legacy = await seeded(stored.codeRoot);
    }
    catch {
        throw new Error('ANDROID_PROFILE_PROVENANCE_MISSING: restore the previous app code slot before retrying upgrade; profile data was preserved');
    }
    const owned = ownedFields(legacy);
    const current = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const map of maps)
        for (const [name, before] of Object.entries(owned[map])) {
            const value = fieldMap(current, map)?.[name];
            if (typeof value !== 'string' || !value.startsWith('file:') || value === before)
                continue;
            const source = path.resolve(profile, value.slice(5));
            const relative = path.relative(path.dirname(stored.codeRoot), source);
            const [slot, ...suffix] = relative.split(path.sep);
            // Old launchers could commit B's references with A's receipt. A sibling
            // SHA slot with the identical managed suffix is ambiguous, not authority to
            // adopt B. Intentional legacy pins to another app slot also require review.
            if (slot && /^[a-f0-9]{64}$/.test(slot) && slot !== path.basename(stored.codeRoot)
                && suffix.join(path.sep) === path.relative(stored.codeRoot, before.slice(5))) {
                throw new Error('ANDROID_PROFILE_MIGRATION_AMBIGUOUS: restore a coherent profile and code receipt from backup or review the mixed app-slot references before retrying; profile data was preserved');
            }
        }
    stored = { schemaVersion: 2, codeRoot: stored.codeRoot, owned };
    await output(receiptPath, serialize(stored));
}
if (stored.schemaVersion !== 2 || typeof stored.codeRoot !== 'string' || !stored.owned)
    throw new Error('Unsupported Android profile receipt');
const receipt = stored;
if (receipt.seed !== undefined) {
    await output(manifestPath, receipt.seed, true);
    if (await readFile(manifestPath, 'utf8') === receipt.seed) {
        const seededManifest = JSON.parse(receipt.seed);
        receipt.owned = ownedFields(seededManifest);
    }
    delete receipt.seed;
    await output(receiptPath, serialize(receipt));
}
// Manifest creation belongs exclusively to the journal above.
for (const name of ['cordis.yml', 'cordis.patch.yml', 'pnpm-workspace.yaml']) {
    const filename = path.join(profile, name);
    if (await exists(filename))
        continue;
    let bytes = await readFile(path.join(code, 'profile-template', name));
    if (name === 'cordis.patch.yml') {
        const patch = parseDocument(bytes.toString());
        patch.add({ id: 'agent-preset-registry', config: { default: 'roleplay' } });
        bytes = patch.toString();
    }
    await output(filename, bytes, true);
}
async function settlePending() {
    if (!receipt.pending)
        return;
    const current = JSON.parse(await readFile(manifestPath, 'utf8'));
    let changed = false;
    for (const field of receipt.pending.fields) {
        const currentMap = fieldMap(current, field.map);
        const value = currentMap?.[field.name];
        if (value === field.before) {
            currentMap[field.name] = field.after;
            changed = true;
        }
        if (value === field.before || value === field.after)
            receipt.owned[field.map][field.name] = field.after;
        else
            delete receipt.owned[field.map][field.name]; // A user edit revokes ownership, even under an old slot.
    }
    if (changed)
        await output(manifestPath, serialize(current));
    receipt.codeRoot = receipt.pending.codeRoot;
    delete receipt.pending;
    await output(receiptPath, serialize(receipt));
}
await settlePending();
if (receipt.codeRoot !== code) {
    const current = JSON.parse(await readFile(manifestPath, 'utf8'));
    const fields = [];
    for (const map of maps)
        for (const [name, before] of Object.entries(receipt.owned[map])) {
            if (fieldMap(current, map)?.[name] !== before) {
                delete receipt.owned[map][name];
                continue;
            }
            const source = before.startsWith('file:') ? before.slice(5) : '';
            if (source !== receipt.codeRoot && !source.startsWith(receipt.codeRoot + path.sep)) {
                delete receipt.owned[map][name];
                continue;
            }
            fields.push({ map, name, before, after: 'file:' + path.join(code, path.relative(receipt.codeRoot, source)) });
        }
    receipt.pending = { codeRoot: code, fields };
    await output(receiptPath, serialize(receipt));
    await settlePending();
}
// Only app-owned dependency links move on an APK code upgrade. User settings,
// sessions and the profile's patch layer stay in the stable private home.
const packages = JSON.parse(await readFile(path.join(code, 'profile-packages.json'), 'utf8'));
for (const name of packages) {
    const link = path.join(profile, 'node_modules', name);
    const target = path.join(code, 'node_modules', name);
    await mkdir(path.dirname(link), { recursive: true });
    let previous;
    try {
        previous = await readlink(link);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    if (previous === target)
        continue;
    const staged = link + '.next';
    try {
        await unlink(staged);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    await symlink(target, staged);
    await rename(staged, link);
}
const overlay = path.join(home, 'android-host.patch.yml');
await writeFile(overlay, [
    '- id: web-runtime',
    '  config:',
    '    openBrowser: false',
    '    printUrl: false',
    '    surfaceContext: true',
    '    trustedHosts: !!js ctx.webStartup.trustedHosts',
    '- id: workspace-controller',
    '  config:',
    '    documentsDirectory: ' + JSON.stringify(workspace),
    '- insert:',
    '    - id: nexttavern-mobile-host',
    '      name: ' + JSON.stringify(pathToFileURL(path.join(code, 'android-host.mjs')).href),
    '',
].join('\n'));
// The manifest journal is already settled; link/overlay repair is idempotent.
process.env.NARB_DISABLE_NATIVE_CACHE = '1';
process.env.NARB_BACKEND = 'napi';
const bin = path.join(code, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
process.argv = [process.execPath, bin, 'web', '--patch', overlay, '--host', '127.0.0.1', '--port', '0', '--no-open'];
// The pinned CLI self-dispatches only when import.meta.main is true. This
// launcher imports it, so invoke its public entry explicitly.
const { runCli } = await import(__rewriteRelativeImportExtension(pathToFileURL(bin).href));
await runCli();
