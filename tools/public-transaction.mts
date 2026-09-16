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
interface TransactionOptions { root: string; backup: string; files: TransactionFile[]; purpose?: string; failAfter?: number; crashAfter?: number }


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
function locked(root: string, backup: string, recover = false) {
  const lock = path.join(root, '.nexttavern-transaction.lock');
  if (recover && fs.existsSync(lock)) {
    const owner = JSON.parse(read(lock).toString('utf8')) as {backup?: string; pid: number};
    if (owner.backup !== backup || !Number.isSafeInteger(owner.pid)) throw Error('Another transaction owns this target');
    let alive = true;
    try {process.kill(owner.pid, 0);} catch (error) {if ((error as NodeJS.ErrnoException).code === 'ESRCH') alive = false;}
    if (alive) throw Error('Transaction process is still running');
    fs.unlinkSync(lock);
  }
  const fd = fs.openSync(lock, 'wx', 0o600);
  fs.writeFileSync(fd, JSON.stringify({pid: process.pid, backup}));
  return () => {fs.closeSync(fd); fs.unlinkSync(lock);};
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
export function applyTransaction({root, backup, files, purpose, failAfter = Infinity, crashAfter = Infinity}: TransactionOptions) {
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
  const release = locked(root, backup);
  const journal: TransactionJournal = {schemaVersion: 1, state: 'prepared', root, purpose, files: []};
  try {
    fs.mkdirSync(backup, {recursive: true, mode: 0o700});
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
      save(path.join(backup, 'transaction.json'), journal);
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
  const release = locked(root, backup, true);
  try {restore(root, backup, journal);} finally {release();}
  return {schemaVersion: 1, state: journal.state, files: journal.files.length};
}
