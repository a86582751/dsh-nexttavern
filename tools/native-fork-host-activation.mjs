// Generated from release/src/native-fork-host-activation.mts; edit the TypeScript source.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { applyNativeForkHost, restoreNativeForkHost } from "./native-fork-host-apply.mjs";
import { HOST_VERSION, NATIVE_FORKS, packageTreeSha256, planNativeForkHost } from "./native-fork-host-plan.mjs";
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const inside = (root, child) => child === root || child.startsWith(root + path.sep);
const exactNames = [...NATIVE_FORKS];
const regular = (file) => { const stat = fs.lstatSync(file); return stat.isFile() && !stat.isSymbolicLink(); };
const exists = (file) => {
    try {
        fs.lstatSync(file);
        return true;
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return false;
        throw error;
    }
};
const noLinkAncestors = (file, root) => {
    for (let current = file; inside(root, current); current = path.dirname(current)) {
        if (exists(current) && fs.lstatSync(current).isSymbolicLink())
            throw Error(`Symbolic link in host target path: ${current}`);
        if (current === root)
            break;
    }
};
const hostTreeSha = (directory) => {
    if (exists(path.join(directory, 'node_modules')))
        throw Error(`Nested node_modules: ${directory}`);
    inventoryFiles(directory);
    return packageTreeSha256(directory);
};
function inventoryFiles(root) {
    const files = [];
    const visit = (directory, relative) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.isSymbolicLink())
                throw Error(`Symbolic link in host payload: ${relative}/${entry.name}`);
            const child = path.join(directory, entry.name), name = relative ? `${relative}/${entry.name}` : entry.name;
            if (entry.isDirectory())
                visit(child, name);
            else if (entry.isFile())
                files.push(name);
            else
                throw Error(`Unsupported host payload entry: ${name}`);
        }
    };
    visit(root, '');
    return files.sort();
}
function payload(input) {
    if (!path.isAbsolute(input.packageRoot) || !path.isAbsolute(input.hostRoot) ||
        !Array.isArray(input.anchors) || input.anchors.length === 0 ||
        input.anchors.some(anchor => !path.isAbsolute(anchor)))
        throw Error('Explicit absolute package, host and anchor paths are required');
    const packageRoot = fs.realpathSync(input.packageRoot), hostRoot = fs.realpathSync(input.hostRoot);
    if (inside(hostRoot, packageRoot) || inside(packageRoot, hostRoot))
        throw Error('Host and payload roots overlap');
    const anchors = input.anchors.map(anchor => {
        const real = fs.realpathSync(anchor);
        if (!inside(hostRoot, real) || !regular(real) || path.basename(real) !== 'package.json')
            throw Error(`Invalid host anchor: ${anchor}`);
        return real;
    });
    if (new Set(anchors).size !== anchors.length)
        throw Error('Duplicate host anchor');
    const inventoryPath = path.join(packageRoot, 'nexttavern.dependencies.json');
    if (!regular(inventoryPath))
        throw Error('Missing regular product dependency inventory');
    const inventoryBytes = fs.readFileSync(inventoryPath);
    const inventory = JSON.parse(inventoryBytes.toString('utf8'));
    if (!Array.isArray(inventory.hostForks) || inventory.hostForks.length !== exactNames.length)
        throw Error('Expected exactly three host payload records');
    const forkRoot = path.join(packageRoot, 'host-overrides');
    const registeredPayloadFiles = inventory.hostForks.flatMap(item => {
        const row = item;
        if (typeof row.path !== 'string' || !Array.isArray(row.files))
            return [];
        const relativeRoot = row.path.slice('host-overrides/'.length);
        return row.files.map(item => {
            const file = item;
            return `${relativeRoot}/${String(file.path)}`;
        });
    }).sort();
    if (fs.realpathSync(forkRoot) !== forkRoot ||
        JSON.stringify(inventoryFiles(forkRoot)) !== JSON.stringify(registeredPayloadFiles))
        throw Error('Unregistered host override payload file');
    const sources = {};
    for (const [index, name] of exactNames.entries()) {
        const record = inventory.hostForks[index];
        const expected = `host-overrides/${name}`;
        if (!record || record.name !== name || record.version !== HOST_VERSION || record.path !== expected ||
            record.status !== 'unapplied-host-override' || !Array.isArray(record.files) || record.files.length === 0)
            throw Error(`Invalid host payload inventory: ${name}`);
        const directory = path.join(packageRoot, ...expected.split('/'));
        if (!inside(packageRoot, directory) || !fs.statSync(directory).isDirectory() ||
            fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory) !== directory)
            throw Error(`Invalid host payload directory: ${name}`);
        const actual = inventoryFiles(directory);
        const registered = record.files.map(row => {
            const file = row;
            if (typeof file?.path !== 'string' || typeof file.sha256 !== 'string' ||
                !/^[a-f0-9]{64}$/.test(file.sha256) || file.path.includes('\\') ||
                file.path.split('/').some(part => !part || part === '.' || part === '..'))
                throw Error(`Invalid host payload member: ${name}`);
            return file.path;
        });
        if (JSON.stringify(actual) !== JSON.stringify([...registered].sort()) ||
            new Set(registered).size !== registered.length)
            throw Error(`Host payload file set differs: ${name}`);
        for (const file of record.files) {
            if (sha(fs.readFileSync(path.join(directory, ...file.path.split('/')))) !== file.sha256)
                throw Error(`Host payload byte drift: ${name}/${file.path}`);
        }
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
        if (manifest.name !== name || manifest.version !== HOST_VERSION || manifest.private !== true)
            throw Error(`Host payload package identity mismatch: ${name}`);
        sources[name] = { directory, sha256: packageTreeSha256(directory) };
    }
    return { packageRoot, hostRoot, anchors, sources, payloadSha256: sha(inventoryBytes) };
}
/** Read-only, exact inventory and actual Node-resolution audit. */
export function auditHostActivation(input) {
    const verified = payload(input);
    const hostInput = { hostRoot: verified.hostRoot, anchors: verified.anchors, sources: verified.sources };
    const plan = planNativeForkHost(hostInput);
    if (!plan.ok)
        throw Error(`Host fork plan rejected: ${plan.errors.join('; ')}`);
    return { input: hostInput, payloadSha256: verified.payloadSha256, plan };
}
function exclusive(lockPath, operation) {
    if (!path.isAbsolute(lockPath))
        throw Error('Absolute host lock path required');
    const lock = path.resolve(lockPath), token = randomUUID();
    const fd = fs.openSync(lock, 'wx', 0o600);
    try {
        fs.writeFileSync(fd, JSON.stringify({ schemaVersion: 1, pid: process.pid, token }) + '\n');
        fs.fsyncSync(fd);
    }
    catch (error) {
        fs.closeSync(fd);
        fs.unlinkSync(lock);
        throw error;
    }
    fs.closeSync(fd);
    try {
        return operation();
    }
    finally {
        // A replaced lock belongs to another operator; never remove it blindly.
        const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
        if (owner.token !== token)
            throw Error('Host lock ownership changed; lock preserved');
        fs.unlinkSync(lock);
    }
}
function saveReceipt(file, receipt) {
    if (!path.isAbsolute(file))
        throw Error('Absolute host receipt path required');
    const target = path.resolve(file), temporary = `${target}.tmp-${randomUUID()}`;
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
        fs.writeFileSync(fd, JSON.stringify(receipt, null, 2) + '\n');
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
    try {
        fs.renameSync(temporary, target);
    }
    catch (error) {
        fs.unlinkSync(temporary);
        throw error;
    }
}
function controlled(control, operation) {
    if (typeof control.assertIdle !== 'function')
        throw Error('Executable host idle check required');
    if (!path.isAbsolute(control.receiptPath))
        throw Error('Absolute host receipt path required');
    if (path.resolve(control.lockPath) === path.resolve(control.receiptPath))
        throw Error('Lock and receipt paths overlap');
    return exclusive(control.lockPath, () => { control.assertIdle(); return operation(); });
}
function receiptInput(receipt, input) {
    const verified = payload(input);
    if (receipt.schemaVersion !== 1 || receipt.packageRoot !== verified.packageRoot ||
        receipt.hostRoot !== verified.hostRoot ||
        JSON.stringify(receipt.anchors) !== JSON.stringify(verified.anchors) ||
        receipt.payloadSha256 !== verified.payloadSha256)
        throw Error('Host activation input differs from receipt');
    return verified;
}
/** Apply only a previously reviewed audit after taking the caller's host lock.
 * The idle probe runs under that lock; callers must make host startup honor it.
 * A prepared receipt left by a process crash blocks later automatic mutation.
 */
export function activateHostForks(input, audit, control) {
    return controlled(control, () => {
        if (exists(control.receiptPath))
            throw Error('Host activation receipt already exists');
        const fresh = auditHostActivation(input);
        if (JSON.stringify(fresh) !== JSON.stringify(audit))
            throw Error('Host activation audit changed');
        const verified = payload(input);
        const receipt = { schemaVersion: 1, state: 'prepared',
            packageRoot: verified.packageRoot, hostRoot: verified.hostRoot, anchors: verified.anchors,
            payloadSha256: fresh.payloadSha256, plan: fresh.plan };
        saveReceipt(control.receiptPath, receipt);
        try {
            control.assertIdle();
            const applied = applyNativeForkHost(fresh.input, fresh.plan);
            receipt.apply = applied;
            receipt.state = applied.ok ? 'applied' : applied.backups.length === 0 ? 'failed' : 'recovery-required';
            if (!applied.ok)
                receipt.error = applied.errors.join('; ');
            saveReceipt(control.receiptPath, receipt);
            return receipt;
        }
        catch (error) {
            receipt.state = 'recovery-required';
            receipt.error = String(error);
            saveReceipt(control.receiptPath, receipt);
            throw error;
        }
    });
}
/** Restore only the exact successful receipt, preserving displaced fork trees. */
export function restoreHostForks(input, control) {
    return controlled(control, () => {
        const receipt = JSON.parse(fs.readFileSync(control.receiptPath, 'utf8'));
        if (receipt.schemaVersion !== 1 || receipt.state !== 'applied' || !receipt.apply?.ok)
            throw Error('No completed host activation receipt');
        const verified = receiptInput(receipt, input);
        for (const name of NATIVE_FORKS) {
            const source = verified.sources[name];
            if (receipt.plan.applySteps.find(step => step.action === 'replace' && step.from === source.directory)?.sha256 !== source.sha256)
                throw Error(`Host payload differs from receipt: ${name}`);
        }
        control.assertIdle();
        const restored = restoreNativeForkHost({ hostRoot: verified.hostRoot, anchors: verified.anchors,
            sources: verified.sources }, receipt.plan, receipt.apply);
        receipt.restore = restored;
        receipt.state = restored.ok ? 'restored' : 'recovery-required';
        if (!restored.ok)
            receipt.error = restored.errors.join('; ');
        saveReceipt(control.receiptPath, receipt);
        return receipt;
    });
}
/** Recover a prepared/interrupted activation. It never assumes a partial copy is valid.
 * Every original backup is checked before any move; changed fork trees are preserved.
 * Repeating after a crash during recovery is safe because already-restored targets
 * must have their exact original hash and no backup.
 */
export function recoverInterruptedHostActivation(input, control) {
    return controlled(control, () => {
        const receipt = JSON.parse(fs.readFileSync(control.receiptPath, 'utf8'));
        if (receipt.state !== 'prepared' && receipt.state !== 'recovery-required')
            throw Error('Host activation is not interrupted');
        const verified = receiptInput(receipt, input);
        if (!receipt.plan.ok || receipt.plan.applySteps.length !== NATIVE_FORKS.length * 3)
            throw Error('Invalid interrupted host plan');
        const items = NATIVE_FORKS.map((name, index) => {
            const [backup, replace, verify] = receipt.plan.applySteps.slice(index * 3, index * 3 + 3);
            const target = path.resolve(backup.from), saved = path.resolve(backup.to ?? '');
            const source = verified.sources[name];
            const packageRow = receipt.plan.packages.find(row => row.name === name &&
                path.dirname(row.manifestPath) === target && row.sha256 === backup.sha256);
            if (backup.action !== 'backup' || replace.action !== 'replace' || verify.action !== 'verify' ||
                !backup.sha256 || !inside(verified.hostRoot, target) || target === verified.hostRoot ||
                saved !== `${target}.nexttavern-before-${source.sha256.slice(0, 12)}` ||
                replace.from !== source.directory || replace.to !== target || replace.sha256 !== source.sha256 ||
                verify.from !== target || verify.sha256 !== source.sha256 || !packageRow)
                throw Error(`Invalid interrupted host package: ${name}`);
            noLinkAncestors(target, verified.hostRoot);
            noLinkAncestors(saved, verified.hostRoot);
            if (exists(saved)) {
                if (!fs.lstatSync(saved).isDirectory() || hostTreeSha(saved) !== backup.sha256)
                    throw Error(`Original host backup drift: ${name}`);
                if (exists(target) && fs.lstatSync(target).isSymbolicLink())
                    throw Error(`Host replacement is a symbolic link: ${name}`);
            }
            else if (!exists(target) || hostTreeSha(target) !== backup.sha256)
                throw Error(`Host target changed without its backup: ${name}`);
            return { target, backup: saved, oldSha: backup.sha256 };
        });
        control.assertIdle();
        const recovered = [];
        try {
            for (const item of items.reverse()) {
                if (!exists(item.backup))
                    continue;
                const preserved = exists(item.target) ? `${item.target}.nexttavern-recovery-${randomUUID()}` : undefined;
                if (preserved)
                    fs.renameSync(item.target, preserved);
                try {
                    fs.renameSync(item.backup, item.target);
                }
                catch (error) {
                    if (preserved && !exists(item.target))
                        fs.renameSync(preserved, item.target);
                    throw error;
                }
                if (hostTreeSha(item.target) !== item.oldSha)
                    throw Error(`Recovered host hash mismatch: ${item.target}`);
                recovered.push({ target: item.target, backup: item.backup, preserved, sha256: item.oldSha });
            }
            receipt.recovered = [...(receipt.recovered ?? []), ...recovered];
            receipt.state = 'failed';
            saveReceipt(control.receiptPath, receipt);
            return receipt;
        }
        catch (error) {
            receipt.recovered = [...(receipt.recovered ?? []), ...recovered];
            receipt.state = 'recovery-required';
            receipt.error = String(error);
            saveReceipt(control.receiptPath, receipt);
            throw error;
        }
    });
}
