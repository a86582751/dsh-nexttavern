// Generated from runtime/alpha3/src/operations/public-transaction.mts; edit the TypeScript source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (file) => fs.readFileSync(file);
const hashAt = (file) => fs.existsSync(file) ? digest(read(file)) : null;
const save = (file, value) => {
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporary, file);
};
export function contained(root, relative) {
    if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || relative.startsWith('/') || relative.split('/').some(part => ['', '.', '..'].includes(part)))
        throw Error('Unsafe relative path');
    root = path.resolve(root);
    const target = path.resolve(root, relative);
    let current = root;
    for (const part of relative.split('/')) {
        current = path.join(current, part);
        if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
            throw Error('Symlink transaction target: ' + relative);
    }
    return target;
}
/** The home owner alone classifies contention, including across bundled copies. */
export class HomeTransactionBusyError extends Error {
    code = 'NEXTTAVERN_HOME_TRANSACTION_BUSY';
}
export function isHomeTransactionBusy(error) {
    return typeof error === 'object' && error !== null
        && 'code' in error && error.code === 'NEXTTAVERN_HOME_TRANSACTION_BUSY';
}
function requireDeadOwner(owner) {
    if (owner.schemaVersion !== undefined && owner.schemaVersion !== 1)
        throw Error('Unsupported transaction lock version');
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0)
        throw Error('Invalid transaction owner');
    let alive = true;
    try {
        process.kill(owner.pid, 0);
    }
    catch (error) {
        if (error.code === 'ESRCH')
            alive = false;
    }
    if (alive)
        throw new HomeTransactionBusyError('Transaction process is still running');
}
function locked(root, backup, recover = false, purpose, phase = 'writing') {
    const lock = path.join(root, '.nexttavern-transaction.lock');
    if (recover && fs.existsSync(lock)) {
        const owner = JSON.parse(read(lock).toString('utf8'));
        if (owner.backup !== backup || !Number.isSafeInteger(owner.pid))
            throw Error('Another transaction owns this target');
        requireDeadOwner(owner);
        fs.unlinkSync(lock);
    }
    let fd;
    try {
        fd = fs.openSync(lock, 'wx', 0o600);
    }
    catch (error) {
        if (error.code === 'EEXIST') {
            throw new HomeTransactionBusyError('Another home transaction owns this target');
        }
        throw error;
    }
    const owner = { schemaVersion: 1, pid: process.pid, backup, purpose, phase };
    // Exclusivity comes from the wx-created pathname. Close the handle so
    // Windows can atomically replace its phase metadata without deleting the lock.
    try {
        fs.writeFileSync(fd, JSON.stringify(owner));
    }
    finally {
        fs.closeSync(fd);
    }
    const release = () => { fs.unlinkSync(lock); };
    return Object.assign(release, { beginWrites() {
            // Atomic phase promotion happens only after the complete journal exists.
            // A dead 'preparing' owner therefore cannot have changed a target file.
            save(lock, { ...owner, phase: 'writing' });
        } });
}
/** Read shared generations while their writer/rollback owner is excluded.
 * This lock never promotes to writing and has no backup. A dead preparing
 * owner is already recoverable without reading a journal or touching targets. */
export function readTransactionTarget(root, purpose, readTarget) {
    root = fs.realpathSync(root);
    const release = locked(root, root, false, purpose, 'preparing');
    try {
        return readTarget();
    }
    finally {
        release();
    }
}
function stagingPath(target, action, id) {
    return `${target}.nexttavern-${action}-${id}`;
}
function restore(root, backup, journal) {
    for (const item of journal.files) {
        const current = hashAt(contained(root, item.path));
        if (current !== item.before && current !== item.after)
            throw Error('Rollback conflict: ' + item.path);
        if (item.backup && hashAt(contained(backup, item.backup)) !== item.before)
            throw Error('Backup digest mismatch: ' + item.path);
    }
    // The journal owns only its per-transaction staging names. Clear a write
    // that died after opening its temporary file but before replacing a target.
    const stagingId = journal.stagingId ?? crypto.randomUUID();
    for (const item of journal.files.toReversed()) {
        const target = contained(root, item.path);
        const temporary = stagingPath(target, 'restore', stagingId);
        if (journal.stagingId) {
            fs.rmSync(stagingPath(target, 'write', stagingId), { force: true });
            fs.rmSync(temporary, { force: true });
        }
        if (hashAt(target) === item.before)
            continue;
        if (item.backup) {
            fs.copyFileSync(contained(backup, item.backup), temporary, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(temporary, item.mode);
            if (process.platform !== 'win32' && item.uid !== null)
                fs.chownSync(temporary, item.uid, item.gid);
            fs.renameSync(temporary, target);
        }
        else
            fs.unlinkSync(target);
        if (hashAt(target) !== item.before)
            throw Error('Restore digest mismatch: ' + item.path);
    }
    journal.state = 'rolled-back';
    save(path.join(backup, 'transaction.json'), journal);
}
export function applyTransaction({ root, backup, files, purpose, assertUnchanged, failAfter = Infinity, crashAfter = Infinity }) {
    root = fs.realpathSync(root);
    backup = path.resolve(backup);
    if (backup === root || backup.startsWith(root + path.sep) || root.startsWith(backup + path.sep) || fs.existsSync(backup))
        throw Error('Backup must be a new directory outside target');
    const seen = new Set();
    for (const file of files) {
        if (seen.has(file.path) || !(file.bytes === null || Buffer.isBuffer(file.bytes)))
            throw Error('Invalid or duplicate transaction file');
        seen.add(file.path);
    }
    const release = locked(root, backup, false, purpose, 'preparing');
    const stagingId = crypto.randomUUID();
    const journal = { schemaVersion: 1, state: 'prepared', root, purpose, stagingId, files: [] };
    try {
        fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
        assertUnchanged?.();
        // The home lock owns the write set until release. Resolve its targets and
        // check the audited before-state once, before capturing the recovery map.
        const targets = files.map(file => contained(root, file.path));
        for (const [index, file] of files.entries()) {
            const target = targets[index];
            if (hashAt(target) !== file.before)
                throw Error('Drift since audit: ' + file.path);
            const stat = file.before === null ? null : fs.statSync(target);
            const name = stat ? index + '.before' : null;
            if (name) {
                fs.copyFileSync(target, path.join(backup, name));
                if (hashAt(path.join(backup, name)) !== file.before)
                    throw Error('Backup verification failed');
            }
            journal.files.push({ path: file.path, before: file.before, after: file.bytes === null ? null : digest(file.bytes), backup: name, mode: stat ? stat.mode & 0o777 : 0o644, uid: stat?.uid ?? null, gid: stat?.gid ?? null, applied: false });
        }
        // Recovery uses the full digest map written before the first mutation.
        // Only the final receipt needs the applied flags for schema v1 readers.
        save(path.join(backup, 'transaction.json'), journal);
        release.beginWrites();
        for (const [index, file] of files.entries()) {
            const target = targets[index], item = journal.files[index];
            fs.mkdirSync(path.dirname(target), { recursive: true });
            if (file.bytes === null) {
                if (fs.existsSync(target))
                    fs.unlinkSync(target);
            }
            else {
                const temporary = stagingPath(target, 'write', stagingId);
                fs.writeFileSync(temporary, file.bytes, { flag: 'wx' });
                fs.chmodSync(temporary, item.mode);
                if (process.platform !== 'win32' && item.uid !== null)
                    fs.chownSync(temporary, item.uid, item.gid);
                fs.renameSync(temporary, target);
            }
            // Successful write/rename consumed the journal's exact Buffer. A later
            // rollback checks future disk state; rereading our own write proves no new fact.
            if (index + 1 >= crashAfter)
                process.exit(86);
            item.applied = true;
            if (index + 1 >= failAfter)
                throw Error('Injected transaction failure');
        }
        journal.state = 'installed';
        save(path.join(backup, 'transaction.json'), journal);
        return { schemaVersion: 1, state: journal.state, files: files.length, backup };
    }
    catch (error) {
        try {
            restore(root, backup, journal);
        }
        catch (rollbackError) {
            journal.state = 'recovery-required';
            save(path.join(backup, 'transaction.json'), journal);
            throw new AggregateError([error, rollbackError], 'Transaction requires manual recovery');
        }
        throw error;
    }
    finally {
        release();
    }
}
/** Discover a dead owner's journal; never recover a live or differently owned operation. */
export function recoverInterruptedTransaction(root, purpose) {
    root = fs.realpathSync(root);
    const lock = path.join(root, '.nexttavern-transaction.lock');
    if (!fs.existsSync(lock))
        return null;
    const owner = JSON.parse(read(lock).toString('utf8'));
    requireDeadOwner(owner);
    if (typeof owner.backup !== 'string' || !path.isAbsolute(owner.backup))
        throw Error('Invalid recovery backup');
    if (owner.phase === 'preparing') {
        if (owner.purpose !== purpose)
            throw Error('Another transaction owns this target');
        // No target writes are possible before phase promotion. Retain partial
        // backups for inspection; release only the same dead owner's home lock.
        const release = locked(root, owner.backup, true, purpose, 'preparing');
        release();
        return { schemaVersion: 1, state: 'rolled-back', files: 0, backup: owner.backup };
    }
    const journal = JSON.parse(read(path.join(owner.backup, 'transaction.json')).toString('utf8'));
    if (journal.root !== root || journal.purpose !== purpose)
        throw Error('Another transaction owns this target');
    return { ...rollbackTransaction(owner.backup), backup: owner.backup };
}
export function rollbackTransaction(backup) {
    backup = fs.realpathSync(backup);
    const journal = JSON.parse(read(path.join(backup, 'transaction.json')).toString('utf8'));
    if (journal.schemaVersion !== 1 || !['prepared', 'installed', 'recovery-required'].includes(journal.state) || !path.isAbsolute(journal.root ?? '') || !Array.isArray(journal.files))
        throw Error('Invalid transaction journal');
    if (journal.stagingId !== undefined && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(journal.stagingId))
        throw Error('Invalid staging identity');
    const root = fs.realpathSync(journal.root), seen = new Set();
    for (const item of journal.files) {
        contained(root, item.path);
        if (seen.has(item.path) || !(item.before === null || /^[a-f0-9]{64}$/.test(item.before)) || !(item.after === null || /^[a-f0-9]{64}$/.test(item.after)) || !Number.isInteger(item.mode) || item.mode < 0 || item.mode > 0o777)
            throw Error('Invalid transaction member');
        seen.add(item.path);
        if (item.backup)
            contained(backup, item.backup);
        if ((item.before === null) !== (item.backup === null))
            throw Error('Invalid backup reference');
    }
    const release = locked(root, backup, true, journal.purpose);
    try {
        restore(root, backup, journal);
    }
    finally {
        release();
    }
    return { schemaVersion: 1, state: journal.state, files: journal.files.length };
}
