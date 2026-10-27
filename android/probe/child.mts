import {link, open, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {ChildSession} from './process-helper.mts';
import {loadFlock} from './flock.mts';
import type {ChildMessage} from './process-helper.mts';

const [role, ...args] = process.argv.slice(2);
const inbox: ChildMessage[] = [];
const waiters: {kind: string; resolve: (message: ChildMessage) => void}[] = [];
process.on('message', (message: ChildMessage) => {
  const index = waiters.findIndex(waiter => waiter.kind === message.kind);
  if (index < 0) inbox.push(message);
  else waiters.splice(index, 1)[0].resolve(message);
});
// IPC disconnect also ends a descendant when its owning probe is killed.
process.on('disconnect', () => process.exit(0));
// The CLI owns validation and forwards this only for an explicit test-only
// software budget. Ordinary/device runs retain the original 20-second guard.
const childTimeoutMs = Number(process.env.NEXTTAVERN_G0_CHILD_TIMEOUT_MS ?? 20_000);
setTimeout(() => process.exit(86), childTimeoutMs).unref();
async function send(message: ChildMessage): Promise<void> {
  if (!process.send) throw new Error('Probe child has no IPC channel');
  await new Promise<void>((resolve, reject) => process.send!(message, error => error ? reject(error) : resolve()));
}
async function receive(kind: string): Promise<ChildMessage> {
  const index = inbox.findIndex(message => message.kind === kind);
  if (index >= 0) return inbox.splice(index, 1)[0];
  return new Promise(resolve => waiters.push({kind, resolve}));
}
async function finish(message: ChildMessage): Promise<void> {
  await send(message);
  process.disconnect!();
}

if (role === 'fork' || role === 'fork-leaf') {
  await send({kind: 'ready', pid: process.pid, ppid: process.ppid, execPath: process.execPath, platform: process.platform});
  const message = await receive('echo');
  if (role === 'fork-leaf') {
    await finish({kind: 'echoed', payload: message.payload, pid: process.pid, execPath: process.execPath, platform: process.platform});
  } else {
    const controller = new AbortController();
    const nested = new ChildSession('fork-leaf', [], controller.signal);
    try {
      const ready = await nested.receive('ready');
      await nested.send({kind: 'echo', payload: message.payload});
      const reply = await nested.receive('echoed');
      const exit = await nested.exited;
      await finish({kind: 'echoed', payload: message.payload, nested: {ready, reply, exit}, pid: process.pid,
        execPath: process.execPath, platform: process.platform});
    } finally {await nested.close();}
  }
} else if (role === 'abnormal') {
  await send({kind: 'ready', pid: process.pid});
  await receive('crash');
  process.exit(73);
} else if (role === 'sqlite-writer') {
  const {DatabaseSync} = await import('node:sqlite');
  const db = new DatabaseSync(args[0]);
  const mode = db.prepare('PRAGMA journal_mode=WAL').get();
  db.exec('PRAGMA synchronous=FULL; PRAGMA wal_autocheckpoint=0; CREATE TABLE evidence (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
  db.exec("BEGIN IMMEDIATE; INSERT INTO evidence VALUES (1, 'committed'); COMMIT;");
  db.exec("BEGIN IMMEDIATE; INSERT INTO evidence VALUES (2, 'uncommitted');");
  const wal = await stat(`${args[0]}-wal`);
  await send({kind: 'prepared', pid: process.pid, mode, walBytes: wal.size});
  setInterval(() => {}, 1000);
} else if (role === 'link-racer') {
  const [directory, id] = args;
  const source = join(directory, `candidate-${id}`);
  const handle = await open(source, 'wx', 0o600);
  try {await handle.writeFile(`writer-${id}\n`); await handle.sync();} finally {await handle.close();}
  await send({kind: 'ready', id, pid: process.pid});
  await receive('race-start');
  try {
    await link(source, join(directory, 'published'));
    await finish({kind: 'race-result', id, won: true});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    await finish({kind: 'race-result', id, won: false, code: 'EEXIST'});
  }
} else if (role === 'flock-holder' || role === 'flock-contender') {
  const lock = await loadFlock();
  const handle = await open(args[0], 'w', 0o600);
  try {
    try {await lock(handle.fd);} catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EAGAIN' && code !== 'EWOULDBLOCK') throw error;
      await handle.close();
      await finish({kind: 'lock-result', acquired: false, code, pid: process.pid});
      process.exit(0);
    }
    const held = await handle.stat({bigint: true});
    const current = await stat(args[0], {bigint: true});
    if (held.ino !== current.ino || held.dev !== current.dev) throw new Error('Locked inode is not the lock path');
    await send({kind: 'lock-result', acquired: true, pid: process.pid, inode: String(held.ino), device: String(held.dev)});
    if (role === 'flock-holder') await receive('release');
    await handle.close();
    await finish({kind: 'released', pid: process.pid});
  } catch (error) {await handle.close().catch(() => {}); throw error;}
} else {
  throw new Error(`Unknown probe child role ${role}`);
}
