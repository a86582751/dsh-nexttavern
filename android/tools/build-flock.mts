/** Build the exact upstream flock primitive with Android Bionic, not an emulated lock. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const abiArgument = args.indexOf('--abi');
const abi = abiArgument < 0 ? 'arm64' : args[abiArgument + 1];
if (abi !== 'arm64' && abi !== 'x64') throw new Error('--abi must be arm64 or x64 (x64 is diagnostic-only)');
if (abiArgument >= 0) args.splice(abiArgument, 2);
const planOnly = args.includes('--plan');
const positional = args.filter(argument => argument !== '--plan');
const cache = resolve(positional[0] ?? join(root, 'artifacts', abi === 'arm64' ? 'runtime-inputs' : 'runtime-inputs-x64'));
const architecture = abi === 'arm64' ? 'arm64-v8a' : 'x86_64';
const target = abi === 'arm64' ? 'aarch64-linux-android26' : 'x86_64-linux-android26';
const output = join(root, 'app/src/main/jniLibs', architecture, 'libnexttavern_flock.so');
const receiptPath = join(root, 'artifacts', abi === 'arm64' ? 'flock-build.json' : 'flock-build-x64.json');
if (planOnly) {
  console.log(JSON.stringify({ abi, architecture, target, diagnosticOnly: abi === 'x64', cache, output, receiptPath }));
  process.exit(0);
}
const ndk = process.env.ANDROID_NDK_HOME;
if (!ndk) throw new Error('Set ANDROID_NDK_HOME to NDK 28.2.13676358');
const properties = await readFile(join(ndk, 'source.properties'), 'utf8');
if (!properties.includes('Pkg.Revision = 28.2.13676358')) throw new Error('This probe recipe pins NDK 28.2.13676358');
const url = 'https://registry.npmjs.org/@deepseek-ai/node-addon-system/-/node-addon-system-0.1.2.tgz';
const sha256 = '347a0bb0cb1ea1af6eb88f2b72eb3ee41cc7703093971e6b2a58fee19191c36e';
const archive = join(cache, 'deepseek-ai-node-addon-system-0.1.2.tgz');
await mkdir(cache, { recursive: true });
try { await readFile(archive); } catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  execFileSync('curl', ['-fsSL', url, '-o', archive]);
}
if (createHash('sha256').update(await readFile(archive)).digest('hex') !== sha256) throw new Error('flock source digest mismatch');
const source = join(cache, 'node-addon-system');
await mkdir(source, { recursive: true });
execFileSync('tar', ['xzf', archive, '-C', source]);
const headers = join(cache, 'extracted/nodejs-lts/data/data/com.termux/files/usr/include/node');
await mkdir(dirname(output), { recursive: true });
const clang = join(ndk, 'toolchains/llvm/prebuilt/linux-x86_64/bin/clang');
execFileSync(clang, [`--target=${target}`, '-shared', '-fPIC', '-O2',
  '-DNAPI_VERSION=8', '-I', headers, '-Wl,-z,max-page-size=16384', '-Wl,-soname,libnexttavern_flock.so',
  join(source, 'package/src/flock.c'), '-o', output]);
await chmod(output, 0o755);
const notices = join(root, 'app/src/main/assets/runtime-notices');
await mkdir(notices, { recursive: true });
await copyFile(join(source, 'package/LICENSE'), join(notices, 'node-addon-system-LICENSE'));
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, JSON.stringify({
  schemaVersion: 1, source: { url, sha256, version: '0.1.2', file: 'src/flock.c', modified: false },
  ndk: '28.2.13676358', target, architecture, diagnosticOnly: abi === 'x64', napi: 8,
  outputSha256: createHash('sha256').update(await readFile(output)).digest('hex'),
  runtimeVerified: false,
}, null, 2) + '\n');
console.log(`Built upstream flock for Bionic ${architecture}. ` +
  (abi === 'x64' ? 'x64 is diagnostic-only, not product support. ' : '') +
  'Android loading and lock semantics remain unverified.');
