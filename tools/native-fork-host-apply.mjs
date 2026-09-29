// Generated from release/src/native-fork-host-apply.mts; edit the TypeScript source.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NATIVE_FORKS, packageTreeSha256, planNativeForkHost } from "./native-fork-host-plan.mjs";
const inside = (root, child) => child === root || child.startsWith(root + path.sep);
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
function noLinkAncestors(file, stop) {
    let current = file;
    while (inside(stop, current)) {
        if (exists(current) && fs.lstatSync(current).isSymbolicLink())
            throw new Error(`Symbolic link: ${current}`);
        if (current === stop)
            break;
        current = path.dirname(current);
    }
}
function emptyOfNestedModules(directory) {
    if (exists(path.join(directory, 'node_modules')))
        throw new Error(`Nested node_modules: ${directory}`);
}
function fingerprint(directory, expected) {
    if (!exists(directory) || !fs.lstatSync(directory).isDirectory())
        throw new Error(`Missing directory: ${directory}`);
    emptyOfNestedModules(directory);
    if (packageTreeSha256(directory) !== expected)
        throw new Error(`Fingerprint changed: ${directory}`);
}
/** Applies only the exact audited plan. Backups remain available after success.
 * Caller must hold the fixed-Harness lock and confirm it is idle before any live use.
 * This offline executor does not establish interprocess exclusion.
 */
export function applyNativeForkHost(input, plan) {
    const evidence = { ok: false, errors: [], applied: [], rolledBack: [], backups: [] };
    const moved = [];
    try {
        const host = fs.realpathSync(input.hostRoot);
        const fresh = planNativeForkHost(input);
        if (!plan.ok || !fresh.ok || JSON.stringify(fresh) !== JSON.stringify(plan))
            throw new Error('Host plan changed or was rejected');
        const backups = fresh.applySteps.filter(step => step.action === 'backup');
        const replacements = fresh.applySteps.filter(step => step.action === 'replace');
        if (backups.length !== replacements.length || backups.length !== NATIVE_FORKS.length)
            throw new Error('Unexpected host plan shape');
        const distinct = new Set();
        for (let i = 0; i < backups.length; i++) {
            const backup = backups[i], replacement = replacements[i];
            if (!backup.to || !backup.sha256 || !replacement.sha256 || backup.from !== replacement.to)
                throw new Error('Incomplete host plan');
            const target = path.resolve(backup.from), saved = path.resolve(backup.to), source = fs.realpathSync(replacement.from);
            if (!inside(host, target) || !inside(host, saved) || target === host || saved === host)
                throw new Error('Path escapes host');
            if (distinct.has(target) || distinct.has(saved))
                throw new Error('Duplicate host path');
            distinct.add(target);
            distinct.add(saved);
            noLinkAncestors(target, host);
            noLinkAncestors(saved, host);
            if (exists(saved))
                throw new Error(`Backup path occupied: ${saved}`);
            fingerprint(target, backup.sha256);
            fingerprint(source, replacement.sha256);
            moved.push({ target, backup: saved, oldSha: backup.sha256, newSha: replacement.sha256 });
        }
        for (const item of moved) {
            noLinkAncestors(item.target, host);
            noLinkAncestors(item.backup, host);
            if (exists(item.backup))
                throw new Error(`Backup path occupied: ${item.backup}`);
            fingerprint(item.target, item.oldSha);
            const source = replacements.find(step => step.to === item.target);
            fingerprint(source.from, item.newSha);
            fs.renameSync(item.target, item.backup);
            evidence.applied.push({ action: 'backup', from: item.target, to: item.backup, sha256: item.oldSha });
            evidence.backups.push(item.backup);
            fs.cpSync(source.from, item.target, { recursive: true, errorOnExist: true, force: false, dereference: false });
            evidence.applied.push({ action: 'replace', from: source.from, to: item.target, sha256: item.newSha });
            fingerprint(item.target, item.newSha);
            evidence.applied.push({ action: 'verify', from: item.target, sha256: item.newSha });
        }
        evidence.ok = true;
    }
    catch (error) {
        evidence.errors.push(String(error));
        for (const item of moved.reverse()) {
            if (!exists(item.backup))
                continue;
            try {
                fingerprint(item.backup, item.oldSha);
                if (exists(item.target)) {
                    // A failed copy may leave a partial tree; preserve it beside the backup for diagnosis.
                    const failed = `${item.target}.nexttavern-failed-${Date.now()}`;
                    if (exists(failed))
                        throw new Error(`Failure evidence path occupied: ${failed}`);
                    fs.renameSync(item.target, failed);
                    evidence.rolledBack.push({ action: 'preserve-failed', from: item.target, to: failed });
                }
                fs.renameSync(item.backup, item.target);
                evidence.rolledBack.push({ action: 'rollback', from: item.backup, to: item.target, sha256: item.oldSha });
                fingerprint(item.target, item.oldSha);
                evidence.backups = evidence.backups.filter(value => value !== item.backup);
            }
            catch (rollbackError) {
                evidence.errors.push(`Rollback failed: ${String(rollbackError)}`);
            }
        }
    }
    return evidence;
}
/** Restores a completed exact apply. The replacement trees are retained for inspection.
 * Caller owns the fixed-Harness lock and must keep the host stopped throughout this operation.
 */
export function restoreNativeForkHost(input, plan, receipt) {
    const result = { ok: false, errors: [], restored: [], preserved: [] };
    const items = [];
    try {
        const host = fs.realpathSync(input.hostRoot);
        if (!plan.ok || !receipt.ok || receipt.errors.length || receipt.rolledBack.length ||
            receipt.backups.length !== NATIVE_FORKS.length || plan.applySteps.length !== NATIVE_FORKS.length * 3 ||
            receipt.applied.length !== NATIVE_FORKS.length * 3)
            throw new Error('Incomplete successful host apply receipt');
        const distinct = new Set();
        for (let i = 0; i < NATIVE_FORKS.length; i++) {
            const [backup, replace, verify] = plan.applySteps.slice(i * 3, i * 3 + 3);
            const [doneBackup, doneReplace, doneVerify] = receipt.applied.slice(i * 3, i * 3 + 3);
            if (backup.action !== 'backup' || replace.action !== 'replace' || verify.action !== 'verify' ||
                !backup.to || !backup.sha256 || !replace.sha256 || replace.to !== backup.from ||
                verify.from !== backup.from || verify.sha256 !== replace.sha256 ||
                doneBackup.action !== 'backup' || doneBackup.from !== backup.from || doneBackup.to !== backup.to ||
                doneBackup.sha256 !== backup.sha256 || doneReplace.action !== 'replace' ||
                doneReplace.from !== replace.from || doneReplace.to !== replace.to || doneReplace.sha256 !== replace.sha256 ||
                doneVerify.action !== 'verify' || doneVerify.from !== verify.from || doneVerify.sha256 !== verify.sha256 ||
                receipt.backups[i] !== backup.to)
                throw new Error('Host apply receipt differs from plan');
            const target = path.resolve(backup.from), saved = path.resolve(backup.to);
            const plannedPackage = plan.packages.find(pkg => pkg.name === NATIVE_FORKS[i] &&
                path.dirname(pkg.manifestPath) === target && pkg.sha256 === backup.sha256);
            if (target !== backup.from || saved !== backup.to || !inside(host, target) || !inside(host, saved) ||
                target === host || saved === host || saved !== `${target}.nexttavern-before-${replace.sha256.slice(0, 12)}` ||
                path.basename(target) !== NATIVE_FORKS[i].split('/')[1] || !plannedPackage ||
                distinct.has(target) || distinct.has(saved))
                throw new Error('Invalid host restore path');
            distinct.add(target);
            distinct.add(saved);
            noLinkAncestors(target, host);
            noLinkAncestors(saved, host);
            fingerprint(target, replace.sha256);
            fingerprint(saved, backup.sha256);
            items.push({ target, backup: saved, oldSha: backup.sha256, newSha: replace.sha256 });
        }
        for (const item of items.reverse()) {
            noLinkAncestors(item.target, host);
            noLinkAncestors(item.backup, host);
            fingerprint(item.target, item.newSha);
            fingerprint(item.backup, item.oldSha);
            const displaced = `${item.target}.nexttavern-replaced-${randomUUID()}`;
            if (exists(displaced))
                throw new Error(`Preservation path occupied: ${displaced}`);
            fs.renameSync(item.target, displaced);
            result.preserved.push({ action: 'preserve-replacement', from: item.target, to: displaced, sha256: item.newSha });
            try {
                fs.renameSync(item.backup, item.target);
            }
            catch (error) {
                // If restoration fails, put the verified replacement back when possible.
                try {
                    if (!exists(item.target))
                        fs.renameSync(displaced, item.target);
                }
                catch (recoveryError) {
                    result.errors.push(`Replacement recovery failed: ${String(recoveryError)}`);
                }
                throw error;
            }
            result.restored.push({ action: 'restore', from: item.backup, to: item.target, sha256: item.oldSha });
            fingerprint(item.target, item.oldSha);
            fingerprint(displaced, item.newSha);
        }
        result.ok = true;
    }
    catch (error) {
        result.errors.push(String(error));
    }
    return result;
}
