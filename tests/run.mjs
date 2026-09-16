// Runs the contract suites this package ships, each in its own process so one
// failure cannot hide another. A pull request gets the same checks here that the
// maintainer runs, and a contributor can run them with `npm test`.
//
//   node tests/run.mjs            # every published suite
//   node tests/run.mjs memory     # only files whose name contains "memory"
//
// Suites are plain Node scripts: they print their own result and exit non-zero
// on failure. They use `tools/test-temp.mjs` for scratch space, which honours
// DSH_TEST_TMPDIR; this runner points that at a directory outside the package
// unless it is already set.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2];
const suites = fs.readdirSync(path.dirname(fileURLToPath(import.meta.url)))
  .filter(file => /[-.](test|smoke)\.(mjs|cjs|mts)$/.test(file))
  .filter(file => !filter || file.includes(filter))
  .sort();
if (!suites.length) throw Error('No suite matches ' + (filter ?? ''));
if (!process.env.DSH_TEST_TMPDIR) {
  // tools/test-temp.mjs refuses a Windows temporary directory on C:, so fall
  // back to a directory inside the package there.
  const system = fs.mkdtempSync(path.join(os.tmpdir(), 'nexttavern-tests-'));
  if (process.platform === 'win32' && /^c:/i.test(system)) {
    const inside = path.join(root, 'artifacts');
    fs.mkdirSync(inside, {recursive: true});
    process.env.DSH_TEST_TMPDIR = fs.mkdtempSync(path.join(inside, 'test-temp-'));
  } else {
    process.env.DSH_TEST_TMPDIR = system;
  }
}

const failed = [];
for (const suite of suites) {
  const started = Date.now();
  // Node 22 needs to be told to run TypeScript; newer releases strip types by
  // themselves and ignore the flag.
  const args = suite.endsWith('.mts') ? ['--experimental-strip-types', path.join(root, 'tests', suite)] : [path.join(root, 'tests', suite)];
  const result = spawnSync(process.execPath, args, {stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: process.env});
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status === 0) {
    console.log('ok   ' + suite + ' (' + seconds + 's)');
    continue;
  }
  failed.push(suite);
  console.log('FAIL ' + suite + ' (' + seconds + 's, exit ' + result.status + ')');
  for (const stream of [result.stdout, result.stderr]) {
    for (const line of String(stream ?? '').split('\n').filter(Boolean).slice(-12)) console.log('     ' + line);
  }
}
console.log('\n' + (suites.length - failed.length) + '/' + suites.length + ' suites passed');
if (failed.length) {
  console.log('failed: ' + failed.join(', '));
  process.exit(1);
}
