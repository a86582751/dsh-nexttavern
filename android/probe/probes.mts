import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {access, mkdir, open, readFile, realpath, rename, stat} from 'node:fs/promises';
import {join} from 'node:path';
import {once} from 'node:events';
import {lookup} from 'node:dns/promises';
import * as tls from 'node:tls';
import * as zlib from 'node:zlib';
import {promisify} from 'node:util';
import {Worker} from 'node:worker_threads';
import {BlockedError} from './model.mts';
import type {Probe, ProbeContext, ProbeMap} from './model.mts';
import {ChildSession} from './process-helper.mts';
import type {ChildMessage} from './process-helper.mts';
import {flockLoaderDescription, loadFlock} from './flock.mts';
import {checkHttpsClient} from './https-client.mts';
import {checkAtomicPublish} from './atomic-publish.mts';

const executable: Probe = async () => {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new BlockedError('NODE_VERSION', 'The runtime closure requires Node 24');
  await access(process.execPath, constants.X_OK);
  return {execPath: process.execPath, realPath: await realpath(process.execPath), node: process.versions.node,
    arch: process.arch, platform: process.platform};
};

const sqlite: Probe = async ({directory, signal}) => {
  let api: typeof import('node:sqlite');
  try {api = await import('node:sqlite');} catch (error) {
    throw new BlockedError('SQLITE_UNAVAILABLE', `node:sqlite unavailable: ${String(error)}`);
  }
  if (typeof api.DatabaseSync !== 'function') throw new BlockedError('SQLITE_API_UNAVAILABLE', 'DatabaseSync is missing');
  const file = join(directory, 'crash.sqlite');
  const child = new ChildSession('sqlite-writer', [file], signal);
  try {
    const prepared = await child.receive('prepared');
    assert.ok(Number(prepared.walBytes) > 0, 'Writer must leave an on-disk WAL before crash');
    assert.equal((prepared.mode as {journal_mode: string}).journal_mode, 'wal');
    const reader = new api.DatabaseSync(file, {readOnly: true});
    try {
      assert.deepEqual(reader.prepare('SELECT id, value FROM evidence ORDER BY id').all().map(row => ({...row})),
        [{id: 1, value: 'committed'}], 'Concurrent reader must not see uncommitted transaction');
    } finally {reader.close();}
    assert.equal(child.child.kill('SIGKILL'), true);
    const exit = await child.exited;
    assert.equal(exit.signal, 'SIGKILL');
    const recovered = new api.DatabaseSync(file);
    try {
      assert.deepEqual(recovered.prepare('SELECT id, value FROM evidence ORDER BY id').all().map(row => ({...row})),
        [{id: 1, value: 'committed'}]);
      assert.equal(recovered.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
      recovered.exec("BEGIN IMMEDIATE; INSERT INTO evidence VALUES (3, 'after-crash'); COMMIT;");
    } finally {recovered.close();}
    const reopened = new api.DatabaseSync(file);
    try {assert.equal(reopened.prepare('SELECT count(*) AS count FROM evidence').get()!.count, 2);} finally {reopened.close();}
    return {journalMode: 'wal', walBytesBeforeCrash: prepared.walBytes, termination: exit.signal,
      committedPreserved: true, uncommittedRolledBack: true, integrity: 'ok', writableAfterRecovery: true};
  } finally {await child.close();}
};

const forkIpc: Probe = async ({signal}) => {
  const child = new ChildSession('fork', [], signal);
  const abnormal = new ChildSession('abnormal', [], signal);
  try {
    const ready = await child.receive('ready');
    assert.equal(ready.execPath, process.execPath);
    assert.equal(ready.platform, process.platform);
    const payload = {nonce: 'deterministic-ipc-fixture', values: [0, 7, 31], text: '中文 IPC'};
    await child.send({kind: 'echo', payload});
    const reply = await child.receive('echoed');
    assert.deepEqual(reply.payload, payload);
    const nested = reply.nested as {ready: ChildMessage; reply: ChildMessage; exit: {code: number; signal: string | null}};
    assert.equal(nested.ready.ppid, ready.pid);
    assert.equal(nested.ready.execPath, process.execPath);
    assert.equal(nested.ready.platform, process.platform);
    assert.deepEqual(nested.reply.payload, payload);
    assert.deepEqual(nested.exit, {code: 0, signal: null});
    assert.deepEqual(await child.exited, {code: 0, signal: null});
    await abnormal.receive('ready');
    await abnormal.send({kind: 'crash'});
    assert.deepEqual(await abnormal.exited, {code: 73, signal: null});
    return {parentExecPath: process.execPath, childExecPath: ready.execPath, nestedExecPath: nested.ready.execPath,
      childPid: ready.pid, nestedPid: nested.ready.pid, ipcRoundTrip: true, nestedExitCode: 0, abnormalExitCode: 73};
  } finally {await Promise.all([child.close(), abnormal.close()]);}
};

const workerThreads: Probe = async ({signal}) => {
  const counter = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const worker = new Worker(new URL('./worker.mts', import.meta.url), {workerData: {counter}});
  const abort = () => {void worker.terminate();};
  signal.addEventListener('abort', abort, {once: true});
  try {
    const exit = once(worker, 'exit');
    assert.deepEqual((await once(worker, 'message', {signal}))[0], {kind: 'ready'});
    const response = once(worker, 'message', {signal});
    worker.postMessage({kind: 'sum', values: [3, 5, 11]});
    const [message] = await response;
    assert.equal(message.sum, 19);
    assert.equal(message.workerPlatform, process.platform);
    assert.equal(message.execPath, process.execPath);
    assert.equal(Atomics.load(new Int32Array(counter), 0), 1);
    assert.equal((await exit)[0], 0);
    return {messageSum: message.sum, sharedMemoryCounter: 1, exitCode: 0};
  } finally {signal.removeEventListener('abort', abort); await worker.terminate();}
};

const zstd: Probe = async () => {
  if (typeof zlib.zstdCompressSync !== 'function' || typeof zlib.zstdDecompressSync !== 'function'
      || typeof zlib.zstdCompress !== 'function' || typeof zlib.zstdDecompress !== 'function') {
    throw new BlockedError('ZSTD_UNAVAILABLE', 'Both synchronous and asynchronous node:zlib zstd APIs are required');
  }
  const payload = Buffer.concat([Buffer.from('NextTavern 中文 zstd checksum\n'.repeat(256)), Buffer.from([0, 1, 127, 255])]);
  const compressed = zlib.zstdCompressSync(payload, {params: {[zlib.constants.ZSTD_c_checksumFlag]: 1}});
  assert.deepEqual(zlib.zstdDecompressSync(compressed), payload);
  const corrupted = Buffer.from(compressed);
  corrupted[corrupted.length - 1] ^= 0xff;
  assert.throws(() => zlib.zstdDecompressSync(corrupted), 'Corrupt checksum must not be accepted');
  assert.throws(() => zlib.zstdDecompressSync(compressed.subarray(0, compressed.length - 1)), 'Torn frame must not be accepted');
  const compressAsync = promisify(zlib.zstdCompress);
  const decompressAsync = promisify(zlib.zstdDecompress);
  assert.deepEqual(await decompressAsync(await compressAsync(payload)), payload);
  await assert.rejects(decompressAsync(corrupted));
  return {inputBytes: payload.length, compressedBytes: compressed.length, syncRoundTrip: true, asyncRoundTrip: true,
    checksumCorruptionRejected: true, truncatedFrameRejected: true, historicalHarnessFixtures: 'not exercised'};
};

const hardlink: Probe = async ({directory, signal}) => {
  const raceDirectory = join(directory, 'hardlink');
  await mkdir(raceDirectory, {mode: 0o700});
  const children = ['a', 'b'].map(id => new ChildSession('link-racer', [raceDirectory, id], signal));
  try {
    await Promise.all(children.map(child => child.receive('ready')));
    await Promise.all(children.map(child => child.send({kind: 'race-start'})));
    const results = await Promise.all(children.map(child => child.receive('race-result')));
    assert.equal(results.filter(result => result.won === true).length, 1);
    assert.equal(results.filter(result => result.won === false && result.code === 'EEXIST').length, 1);
    const winner = results.find(result => result.won === true)!;
    const content = await readFile(join(raceDirectory, 'published'), 'utf8');
    assert.equal(content, `writer-${winner.id}\n`);
    const published = await stat(join(raceDirectory, 'published'), {bigint: true});
    const source = await stat(join(raceDirectory, `candidate-${winner.id}`), {bigint: true});
    assert.equal(published.ino, source.ino);
    assert.equal(published.dev, source.dev);
    for (const child of children) assert.deepEqual(await child.exited, {code: 0, signal: null});
    return {contenders: 2, winners: 1, loserCode: 'EEXIST', winner: winner.id, publishedContentPreserved: true,
      sameInodeAndDevice: true, publication: 'link(temp, final), never overwrite rename'};
  } finally {await Promise.all(children.map(child => child.close()));}
};

const directoryFsync: Probe = async ({directory}) => {
  const file = join(directory, 'before-fsync');
  const handle = await open(file, 'wx', 0o600);
  try {await handle.writeFile('durable fixture\n'); await handle.sync();} finally {await handle.close();}
  const directoryHandle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    await directoryHandle.sync();
    await rename(file, join(directory, 'after-fsync'));
    await directoryHandle.sync();
  } finally {await directoryHandle.close();}
  assert.equal(await readFile(join(directory, 'after-fsync'), 'utf8'), 'durable fixture\n');
  return {fileFsync: true, directoryFsyncBeforeAndAfterRename: true, powerLossTest: false};
};

async function contender(file: string, context: ProbeContext): Promise<ChildMessage> {
  const child = new ChildSession('flock-contender', [file], context.signal);
  try {
    const result = await child.receive('lock-result');
    assert.deepEqual(await child.exited, {code: 0, signal: null});
    return result;
  } finally {await child.close();}
}

const nativeFlock: Probe = async context => {
  const lock = await loadFlock();
  const file = join(context.directory, 'session.lock');
  // Upstream's import is lazy: force a real invocation before spawning contenders.
  const preflight = await open(file, 'w', 0o600);
  try {await lock(preflight.fd);} finally {await preflight.close();}
  const holder = new ChildSession('flock-holder', [file], context.signal);
  let crashHolder: ChildSession | undefined;
  try {
    const first = await holder.receive('lock-result');
    assert.equal(first.acquired, true);
    const before = await stat(file, {bigint: true});
    assert.equal(String(before.ino), first.inode);
    assert.equal(String(before.dev), first.device);
    const blocked = await contender(file, context);
    assert.equal(blocked.acquired, false, 'A successful no-op flock must fail this test');
    assert.ok(blocked.code === 'EAGAIN' || blocked.code === 'EWOULDBLOCK');
    await holder.send({kind: 'release'});
    await holder.receive('released');
    assert.deepEqual(await holder.exited, {code: 0, signal: null});
    assert.equal((await contender(file, context)).acquired, true, 'Closing fd must release ownership');
    crashHolder = new ChildSession('flock-holder', [file], context.signal);
    assert.equal((await crashHolder.receive('lock-result')).acquired, true);
    assert.equal(crashHolder.child.kill('SIGKILL'), true);
    assert.equal((await crashHolder.exited).signal, 'SIGKILL');
    assert.equal((await contender(file, context)).acquired, true, 'Kernel must release lock after SIGKILL');
    const after = await stat(file, {bigint: true});
    assert.equal(before.ino, after.ino);
    assert.equal(before.dev, after.dev);
    return {api: '@deepseek-ai/node-addon-system/flock.tryLockExclusive(fd)', ...flockLoaderDescription(), realCrossProcessContention: true,
      contentionCode: blocked.code, fdCloseReleases: true, sigkillReleases: true, stableLockInode: true,
      lockFileNeverUnlinked: true, fullHarnessLeaseIntegration: false};
  } finally {await holder.close(); await crashHolder?.close();}
};

const localTls: Probe = async ({signal}) => {
  const key = await readFile(new URL('./fixtures/localhost-key.txt', import.meta.url));
  const cert = await readFile(new URL('./fixtures/localhost-cert.txt', import.meta.url));
  const sockets = new Set<tls.TLSSocket>();
  const server = tls.createServer({key, cert, minVersion: 'TLSv1.2'}, socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    socket.once('data', data => {if (String(data) === 'ping') socket.end('pong'); else socket.destroy();});
  });
  server.on('tlsClientError', () => {}); // The explicit untrusted-CA negative test is expected to fail.
  let client: tls.TLSSocket | undefined;
  let untrusted: tls.TLSSocket | undefined;
  const abort = () => {client?.destroy(); untrusted?.destroy(); for (const socket of sockets) socket.destroy(); server.close();};
  signal.addEventListener('abort', abort, {once: true});
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening', {signal});
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    client = tls.connect({host: '127.0.0.1', port: address.port, servername: 'localhost', ca: cert,
      rejectUnauthorized: true, minVersion: 'TLSv1.2'});
    await once(client, 'secureConnect', {signal});
    assert.equal(client.authorized, true);
    const protocol = client.getProtocol();
    const response = once(client, 'data', {signal});
    client.write('ping');
    assert.equal(String((await response)[0]), 'pong');
    client.destroy();
    untrusted = tls.connect({host: '127.0.0.1', port: address.port, servername: 'localhost', rejectUnauthorized: true});
    try {
      await assert.rejects(once(untrusted, 'secureConnect', {signal}), /self.signed|certificate/i);
    } finally {untrusted.destroy();}
    return {endpoint: '127.0.0.1 (ephemeral port)', protocol, trustedLocalFixtureCA: true,
      untrustedCARejected: true, publicCATrustValidated: false, externalNetworkUsed: false};
  } finally {
    signal.removeEventListener('abort', abort);
    client?.destroy();
    untrusted?.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
};

const localDns: Probe = async () => {
  const addresses = await lookup('localhost', {all: true});
  assert.ok(addresses.length > 0);
  for (const {address} of addresses) assert.ok(address === '::1' || address.startsWith('127.'), `localhost resolved outside loopback: ${address}`);
  return {hostname: 'localhost', addresses, externalDNSValidated: false, modelRequests: 0};
};

export const probes: ProbeMap = {
  'runtime-executable': executable, 'sqlite-wal-crash': sqlite, 'fork-ipc': forkIpc,
  'worker-threads': workerThreads, 'zstd-integrity': zstd, 'hardlink-no-clobber': hardlink,
  'directory-fsync': directoryFsync, 'native-flock': nativeFlock, 'tls-local-ca': localTls,
  'dns-localhost': localDns,
  'https-client': checkHttpsClient,
  'android-atomic-no-clobber': checkAtomicPublish,
};
