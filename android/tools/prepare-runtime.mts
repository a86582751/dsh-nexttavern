/** Assemble the fixed Bionic probe runtime, never execute downloaded binaries on the build host. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, copyFile, realpath, readlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arguments_ = process.argv.slice(2);
const abiArgument = arguments_.indexOf('--abi');
const abi = abiArgument < 0 ? 'arm64' : arguments_[abiArgument + 1];
if (abi !== 'arm64' && abi !== 'x64') throw new Error('--abi must be arm64 or x64 (x64 is diagnostic-only)');
if (abiArgument >= 0) arguments_.splice(abiArgument, 2);
const noticesOnly = arguments_.includes('--notices-only');
const planOnly = arguments_.includes('--plan');
const args = arguments_.filter(argument => argument !== '--notices-only' && argument !== '--plan');
const cache = resolve(args[0] ?? join(root, 'artifacts', abi === 'arm64' ? 'runtime-inputs' : 'runtime-inputs-x64'));
const patchElf = args[1] ?? 'patchelf';
const architecture = abi === 'arm64' ? 'arm64-v8a' : 'x86_64';
const output = join(root, 'app/src/main/jniLibs', architecture);
const notices = join(root, 'app/src/main/assets/runtime-notices');
type LockedDownload = { url: string; sha256: string };
type Input = LockedDownload & { name: string; version: string; notice?: LockedDownload };
const inputsLock = join(root, abi === 'arm64' ? 'runtime-inputs.lock.json' : 'runtime-inputs.x64.lock.json');
const inventoryPath = join(root, 'artifacts', abi === 'arm64' ? 'runtime-inventory.json' : 'runtime-inventory-x64.json');
const inputs: Input[] = JSON.parse(await readFile(inputsLock, 'utf8'));
if (planOnly) {
  console.log(JSON.stringify({ abi, architecture, diagnosticOnly: abi === 'x64', cache, patchElf,
    output, inputsLock, inventoryPath, noticesOnly, inputs }));
  process.exit(0);
}
await mkdir(cache, { recursive: true });
if (!noticesOnly) await mkdir(output, { recursive: true });
await mkdir(notices, { recursive: true });

async function verifiedDownload(filename: string, input: LockedDownload, label: string): Promise<Buffer> {
  let bytes: Buffer;
  try { bytes = await readFile(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    execFileSync('curl', ['--fail', '--location', '--silent', '--show-error', input.url, '-o', filename]);
    bytes = await readFile(filename);
  }
  if (createHash('sha256').update(bytes).digest('hex') !== input.sha256) {
    throw new Error(`Runtime input digest mismatch: ${label}`);
  }
  return bytes;
}

const libraries = new Map<string, string>();
let node = '';
for (const input of noticesOnly ? [] : inputs) {
  const archive = join(cache, basename(new URL(input.url).pathname));
  await verifiedDownload(archive, input, input.name);
  const extracted = join(cache, 'extracted', input.name);
  await mkdir(extracted, { recursive: true });
  execFileSync('dpkg-deb', ['--extract', archive, extracted]);
  const prefix = join(extracted, 'data/data/com.termux/files/usr');
  if (input.name === 'nodejs-lts') node = join(prefix, 'bin/node');
  let names: string[];
  try { names = await readdir(join(prefix, 'lib')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    continue;
  }
  for (const name of names.filter(name => /^lib.*\.so(?:\.[\d.]+)?$/.test(name))) {
    libraries.set(name, await realpath(join(prefix, 'lib', name)));
  }
}
for (const input of inputs.filter(input => !['resolv-conf', 'termux-licenses'].includes(input.name))) {
  if (input.notice) {
    // Termux libicu 78.3 ships a 404 response as LICENSE; use its exact upstream release notice.
    const filename = join(cache, `${input.name}-${input.version}-LICENSE`);
    const bytes = await verifiedDownload(filename, input.notice, `${input.name} notice`);
    await writeFile(join(notices, `${input.name}-LICENSE`), bytes);
    continue;
  }
  const license = input.name === 'libicu' ? 'LICENSE' : 'copyright';
  let source = join(cache, 'extracted', input.name, 'data/data/com.termux/files/usr/share/doc', input.name, license);
  try { source = join(cache, 'extracted/termux-licenses/data/data/com.termux/files/usr/share/LICENSES', basename(await readlink(source))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EINVAL') throw error; }
  await copyFile(source, join(notices, `${input.name}-LICENSE`));
}
if (noticesOnly) {
  console.log('Prepared runtime notices only; no native archives extracted or binaries modified.');
  process.exit(0);
}
// Native installer filenames must be lib*.so, so change BOTH the dependency
// name and SONAME. Copying libssl.so.3 as libssl.so alone cannot satisfy the loader.
const system = new Set(['libc.so', 'libm.so', 'libdl.so', 'liblog.so', 'libandroid.so']);
const needed = (path: string) => execFileSync(patchElf, ['--print-needed', path], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const selected = new Map<string, string>([['libnexttavern_node.so', node]]);
const pending = [node];
while (pending.length) {
  for (const name of needed(pending.pop()!)) {
    if (system.has(name)) continue;
    const source = libraries.get(name);
    if (!source) throw new Error(`Unresolved native dependency: ${name}`);
    const target = name.replace(/\.so(?:\.[\d.]+)?$/, '.so');
    if (selected.has(target)) {
      if (selected.get(target) !== source) throw new Error(`Native SONAME collision: ${name}`);
      continue;
    }
    selected.set(target, source);
    pending.push(source);
  }
}
const inventory = [];
for (const [name, source] of selected) {
  const target = join(output, name);
  await copyFile(source, target);
  const args = ['--page-size', '16384', '--set-rpath', '$ORIGIN'];
  if (name !== 'libnexttavern_node.so') args.push('--set-soname', name);
  for (const dependency of needed(source)) {
    const renamed = dependency.replace(/\.so(?:\.[\d.]+)?$/, '.so');
    if (!system.has(dependency) && dependency !== renamed) args.push('--replace-needed', dependency, renamed);
  }
  execFileSync(patchElf, [...args, target]);
  const bytes = await readFile(target);
  inventory.push({ name, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, needed: needed(target) });
}
await mkdir(join(root, 'artifacts'), { recursive: true });
await writeFile(inventoryPath, JSON.stringify({
  schemaVersion: 1, purpose: abi === 'arm64' ? 'g0-probe-only' : 'x86_64-emulator-diagnostic-only', architecture,
  diagnosticOnly: abi === 'x64',
  nodeVersion: '24.22.1', patchelf: execFileSync(patchElf, ['--version'], { encoding: 'utf8' }).trim(),
  g0Passed: false, limitations: ['Not run on Android', 'flock addon not assembled by this tool', 'Product native dependencies not assembled'],
  inputs, files: inventory,
}, null, 2) + '\n');
console.log(`Prepared ${inventory.length} native probe files for ${architecture}. ` +
  (abi === 'x64' ? 'x64 is test-only, not arm64 G0 or product support. ' : '') +
  'Android execution and G0 remain unverified.');
