import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function plan(tool: string, ...args: string[]): Record<string, any> {
  return JSON.parse(execFileSync(process.execPath, [path.join(root, 'tools', tool), ...args, '--plan'], {
    encoding: 'utf8',
  }));
}

test('default arm64 preserves original cache and patchelf positional arguments', () => {
  const cache = path.join(root, 'artifacts/test-temp/abi-selection-cache');
  const runtime = plan('prepare-runtime.mts', cache, '/pinned/patchelf');
  assert.equal(runtime.abi, 'arm64');
  assert.equal(runtime.architecture, 'arm64-v8a');
  assert.equal(runtime.cache, cache);
  assert.equal(runtime.patchElf, '/pinned/patchelf');
  assert.equal(runtime.inputsLock, path.join(root, 'runtime-inputs.lock.json'));
  assert.equal(runtime.inventoryPath, path.join(root, 'artifacts/runtime-inventory.json'));
  const flock = plan('build-flock.mts', cache);
  assert.equal(flock.cache, cache);
  assert.equal(flock.target, 'aarch64-linux-android26');
  assert.equal(flock.output, path.join(root, 'app/src/main/jniLibs/arm64-v8a/libnexttavern_flock.so'));
  assert.equal(flock.diagnosticOnly, false);
});

test('x64 selects fixed x86 inputs and target, isolated from arm64 outputs', () => {
  const runtime = plan('prepare-runtime.mts', '--abi', 'x64', '--notices-only');
  assert.equal(runtime.architecture, 'x86_64');
  assert.equal(runtime.diagnosticOnly, true);
  assert.equal(runtime.noticesOnly, true);
  assert.equal(runtime.cache, path.join(root, 'artifacts/runtime-inputs-x64'));
  assert.equal(runtime.inputsLock, path.join(root, 'runtime-inputs.x64.lock.json'));
  assert.equal(runtime.output, path.join(root, 'app/src/main/jniLibs/x86_64'));
  assert.equal(runtime.inventoryPath, path.join(root, 'artifacts/runtime-inventory-x64.json'));
  assert.equal(runtime.inputs.length, 10);
  assert.ok(runtime.inputs.every((input: {url: string}) => /_(x86_64|all)\.deb$/.test(input.url)));
  assert.equal(runtime.inputs.find((input: {name: string}) => input.name === 'nodejs-lts').sha256,
    '0e485c9bb50bab5be692c6f8cbdec3934bb66795f089af2b67274c4583b85767');
  const arm = JSON.parse(readFileSync(path.join(root, 'runtime-inputs.lock.json'), 'utf8'));
  assert.deepEqual(runtime.inputs.find((input: {name: string}) => input.name === 'libicu').notice,
    arm.find((input: {name: string}) => input.name === 'libicu').notice);
  const flock = plan('build-flock.mts', '--abi', 'x64');
  assert.equal(flock.target, 'x86_64-linux-android26');
  assert.equal(flock.output, path.join(root, 'app/src/main/jniLibs/x86_64/libnexttavern_flock.so'));
  assert.equal(flock.cache, runtime.cache);
  assert.equal(flock.diagnosticOnly, true);
  assert.equal(flock.receiptPath, path.join(root, 'artifacts/flock-build-x64.json'));
});
