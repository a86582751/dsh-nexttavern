import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface TransactionFile { path: string; before: string | null; bytes: Buffer | null }
interface JournalMember {
  path: string; before: string | null; after: string | null; backup: string | null
  mode: number; uid: number | null; gid: number | null; applied: boolean
}
interface TransactionJournal {
  schemaVersion: 1
  state: 'prepared' | 'installed' | 'recovery-required' | 'rolled-back'
  root: string
  purpose?: string
  files: JournalMember[]
}
interface TransactionOptions {
  root: string; backup: string; files: TransactionFile[]; purpose?: string
  failAfter?: number; crashAfter?: number
  /** Read-only assertions for reused files outside the write set, under the home lock. */
  assertUnchanged?: () => void
}


export const digest = (bytes: crypto.BinaryLike) => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (file: string) => fs.readFileSync(file);
const hashAt = (file: string) => fs.existsSync(file) ? digest(read(file)) : null;
const save = (file: string, value: unknown) => {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', {mode: 0o600});
  fs.renameSync(temporary, file);
};
export function contained(root: string, relative: string) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes(':') || relative.startsWith('/') || relative.split('/').some(part => ['', '.', '..'].includes(part))) throw Error('Unsafe relative path');
  root = path.resolve(root);
  const target = path.resolve(root, relative);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error('Symlink transaction target: ' + relative);
  }
  return target;
}
interface LockOwner {schemaVersion?: 1; backup: string; pid: number; purpose?: string; phase?: 'preparing' | 'writing'}
function requireDeadOwner(owner: LockOwner) {
  if (owner.schemaVersion !== undefined && owner.schemaVersion !== 1) throw Error('Unsupported transaction lock version');
  if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw Error('Invalid transaction owner');
  let alive = true;
  try {process.kill(owner.pid, 0);} catch (error) {if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false;}
  if (alive) throw Error('Transaction process is still running');
}
function locked(root: string, backup: string, recover = false, purpose?: string, phase: LockOwner['phase'] = 'writing') {
  const lock = path.join(root, '.nexttavern-transaction.lock');
  if (recover && fs.existsSync(lock)) {
    const owner = JSON.parse(read(lock).toString('utf8')) as LockOwner;
    if (owner.backup !== backup || !Number.isSafeInteger(owner.pid)) throw Error('Another transaction owns this target');
    requireDeadOwner(owner);
    fs.unlinkSync(lock);
  }
  const fd = fs.openSync(lock, 'wx', 0o600);
  const owner: LockOwner = {schemaVersion: 1, pid: process.pid, backup, purpose, phase};
  // Exclusivity comes from the wx-created pathname. Close the handle so
  // Windows can atomically replace its phase metadata without deleting the lock.
  try {fs.writeFileSync(fd, JSON.stringify(owner));} finally {fs.closeSync(fd);}
  const release = () => {fs.unlinkSync(lock);};
  return Object.assign(release, {beginWrites() {
    // Atomic phase promotion happens only after the complete journal exists.
    // A dead 'preparing' owner therefore cannot have changed a target file.
    save(lock, {...owner, phase: 'writing'});
  }});
}
function restore(root: string, backup: string, journal: TransactionJournal) {
  for (const item of journal.files) {
    const current = hashAt(contained(root, item.path));
    if (current !== item.before && current !== item.after) throw Error('Rollback conflict: ' + item.path);
    if (item.backup && hashAt(contained(backup, item.backup)) !== item.before) throw Error('Backup digest mismatch: ' + item.path);
  }
  for (const item of journal.files.toReversed()) {
    const target = contained(root, item.path);
    if (hashAt(target) === item.before) continue;
    if (item.backup) {
      const temporary = target + '.nexttavern-restore';
      fs.copyFileSync(contained(backup, item.backup), temporary);
      fs.chmodSync(temporary, item.mode);
      if (process.platform !== 'win32' && item.uid !== null) fs.chownSync(temporary, item.uid, item.gid!);
      fs.renameSync(temporary, target);
    } else fs.unlinkSync(target);
    if (hashAt(target) !== item.before) throw Error('Restore digest mismatch: ' + item.path);
  }
  journal.state = 'rolled-back';
  save(path.join(backup, 'transaction.json'), journal);
}
/**
 * How many installed members may pass between journal checkpoints.
 *
 * The journal is the recovery map, so it must exist in full before the first
 * write. Rewriting it after every member instead costs one full serialization
 * and file replacement per member, which a product-sized write set turns into
 * minutes of work. Recovery never depends on the `applied` flag: it compares
 * each target's current digest against the recorded before and after states, so
 * a checkpoint that lags the writes is recovered exactly the same way.
 */
const JOURNAL_CHECKPOINT_EVERY = 256

export function applyTransaction({root, backup, files, purpose, assertUnchanged,
  failAfter = Infinity, crashAfter = Infinity}: TransactionOptions) {
  root = fs.realpathSync(root);
  backup = path.resolve(backup);
  if (backup === root || backup.startsWith(root + path.sep) || root.startsWith(backup + path.sep) || fs.existsSync(backup)) throw Error('Backup must be a new directory outside target');
  const seen = new Set<string>();
  for (const file of files) {
    const target = contained(root, file.path);
    if (seen.has(file.path) || !(file.bytes === null || Buffer.isBuffer(file.bytes))) throw Error('Invalid or duplicate transaction file');
    seen.add(file.path);
    if (hashAt(target) !== file.before) throw Error('Drift since audit: ' + file.path);
  }
  const release = locked(root, backup, false, purpose, 'preparing');
  const journal: TransactionJournal = {schemaVersion: 1, state: 'prepared', root, purpose, files: []};
  try {
    fs.mkdirSync(backup, {recursive: true, mode: 0o700});
    assertUnchanged?.();
    for (const [index, file] of files.entries()) {
      const target = contained(root, file.path);
      const stat = file.before === null ? null : fs.statSync(target);
      const name = stat ? index + '.before' : null;
      if (name) {
        fs.copyFileSync(target, path.join(backup, name));
        if (hashAt(path.join(backup, name)) !== file.before) throw Error('Backup verification failed');
      }
      journal.files.push({path: file.path, before: file.before, after: file.bytes === null ? null : digest(file.bytes), backup: name, mode: stat ? stat.mode & 0o777 : 0o644, uid: stat?.uid ?? null, gid: stat?.gid ?? null, applied: false});
    }
    save(path.join(backup, 'transaction.json'), journal);
    release.beginWrites();
    let checkpointed = 0;
    for (const [index, file] of files.entries()) {
      const target = contained(root, file.path), item = journal.files[index]!;
      if (hashAt(target) !== file.before) throw Error('Target changed before write: ' + file.path);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      if (file.bytes === null) {
        if (fs.existsSync(target)) fs.unlinkSync(target);
      } else {
        const temporary = target + '.nexttavern-write';
        fs.writeFileSync(temporary, file.bytes, {flag: 'wx'});
        fs.chmodSync(temporary, item.mode);
        if (process.platform !== 'win32' && item.uid !== null) fs.chownSync(temporary, item.uid, item.gid!);
        fs.renameSync(temporary, target);
      }
      if (hashAt(target) !== item.after) throw Error('Installed digest mismatch: ' + file.path);
      if (index + 1 >= crashAfter) process.exit(86);
      item.applied = true;
      // Checkpoint on a bounded cadence and always on the last member, so the
      // recorded progress never trails the writes by more than one interval.
      if (index + 1 - checkpointed >= JOURNAL_CHECKPOINT_EVERY) {
        save(path.join(backup, 'transaction.json'), journal);
        checkpointed = index + 1;
      }
      if (index + 1 >= failAfter) throw Error('Injected transaction failure');
    }
    journal.state = 'installed';
    save(path.join(backup, 'transaction.json'), journal);
    return {schemaVersion: 1, state: journal.state, files: files.length, backup};
  } catch (error) {
    try {restore(root, backup, journal);} catch (rollbackError) {
      journal.state = 'recovery-required';
      save(path.join(backup, 'transaction.json'), journal);
      throw new AggregateError([error, rollbackError], 'Transaction requires manual recovery');
    }
    throw error;
  } finally {release();}
}
/** Discover a dead owner's journal; never recover a live or differently owned operation. */
export function recoverInterruptedTransaction(root: string, purpose: string) {
  root = fs.realpathSync(root);
  const lock = path.join(root, '.nexttavern-transaction.lock');
  if (!fs.existsSync(lock)) return null;
  const owner = JSON.parse(read(lock).toString('utf8')) as LockOwner;
  requireDeadOwner(owner);
  if (typeof owner.backup !== 'string' || !path.isAbsolute(owner.backup)) throw Error('Invalid recovery backup');
  if (owner.phase === 'preparing') {
    if (owner.purpose !== purpose) throw Error('Another transaction owns this target');
    // No target writes are possible before phase promotion. Retain partial
    // backups for inspection; release only the same dead owner's home lock.
    const release = locked(root, owner.backup, true, purpose, 'preparing');
    release();
    return {schemaVersion: 1, state: 'rolled-back', files: 0, backup: owner.backup};
  }
  const journal = JSON.parse(read(path.join(owner.backup, 'transaction.json')).toString('utf8')) as TransactionJournal;
  if (journal.root !== root || journal.purpose !== purpose) throw Error('Another transaction owns this target');
  return {...rollbackTransaction(owner.backup), backup: owner.backup};
}
export function rollbackTransaction(backup: string) {
  backup = fs.realpathSync(backup);
  const journal = JSON.parse(read(path.join(backup, 'transaction.json')).toString('utf8')) as TransactionJournal;
  if (journal.schemaVersion !== 1 || !['prepared','installed','recovery-required'].includes(journal.state) || !path.isAbsolute(journal.root ?? '') || !Array.isArray(journal.files)) throw Error('Invalid transaction journal');
  const root = fs.realpathSync(journal.root), seen = new Set();
  for (const item of journal.files) {
    contained(root, item.path);
    if (seen.has(item.path) || !(item.before === null || /^[a-f0-9]{64}$/.test(item.before)) || !(item.after === null || /^[a-f0-9]{64}$/.test(item.after)) || !Number.isInteger(item.mode) || item.mode < 0 || item.mode > 0o777) throw Error('Invalid transaction member');
    seen.add(item.path);
    if (item.backup) contained(backup, item.backup);
    if ((item.before === null) !== (item.backup === null)) throw Error('Invalid backup reference');
  }
  const release = locked(root, backup, true, journal.purpose);
  try {restore(root, backup, journal);} finally {release();}
  return {schemaVersion: 1, state: journal.state, files: journal.files.length};
}
