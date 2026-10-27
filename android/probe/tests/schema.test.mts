import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {parseArgs} from '../run.mts';
import {REQUIRED_CAPABILITIES} from '../model.mts';

test('JSON Schema requires all ten checks and permits only the explicit HTTPS tail, never full G0', async () => {
  const schema = JSON.parse(await readFile(new URL('../result.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.androidGate.const, false);
  assert.equal(schema.properties.checks.minItems, REQUIRED_CAPABILITIES.length);
  assert.equal(schema.properties.checks.maxItems, REQUIRED_CAPABILITIES.length+1);
  assert.equal(schema.properties.checks.items.allOf[1].properties.id.const,'https-client');
  assert.deepEqual(schema.properties.checks.prefixItems.map((item: {allOf: {properties?: {id: {const: string}}}[]}) =>
    item.allOf[1].properties!.id.const), REQUIRED_CAPABILITIES);
});

test('public HTTPS is an explicit fixed-endpoint flag, not a URL/credential input',()=>{
  assert.deepEqual(parseArgs(['--https-client']),{httpsClient:true});
  const combined=parseArgs(['--https-client','--output','result.json','--timeout-ms','120000']);
  assert.equal(combined.httpsClient,true);assert.equal(combined.timeoutMs,120_000);
  assert.equal(parseArgs(['--timeout-ms','120000','--https-client']).httpsClient,true);
  for(const args of [['--https-client','--https-client'],['--https-client','true'],['--https-client','https://other.test/']])
    assert.throws(()=>parseArgs(args),/Usage:/);
});

test('CLI keeps its default and documented optional output path', () => {
  assert.deepEqual(parseArgs([]), {});
  assert.ok(parseArgs(['--output', 'result.json']).output!.endsWith('/result.json'));
  for (const args of [['--output'], ['--output', '--invalid'], ['--output', 'x', '--output', 'y'], ['--data-dir', 'x']]) {
    assert.throws(() => parseArgs(args), /Usage:/);
  }
});


test('CLI explicit software timing budget is bounded and can accompany output', () => {
  assert.deepEqual(parseArgs(['--timeout-ms', '120000']), {timeoutMs: 120_000});
  assert.deepEqual(parseArgs(['--timeout-ms', '1']), {timeoutMs: 1});
  const combined = parseArgs(['--timeout-ms', '120000', '--output', 'diagnostic.json']);
  assert.equal(combined.timeoutMs, 120_000);
  assert.ok(combined.output!.endsWith('/diagnostic.json'));
  assert.equal(parseArgs(['--output', 'diagnostic.json', '--timeout-ms', '120000']).timeoutMs, 120_000);
  for (const args of [
    ['--timeout-ms'], ['--timeout-ms', '0'], ['--timeout-ms', '-1'],
    ['--timeout-ms', '1.5'], ['--timeout-ms', '120001'], ['--timeout-ms', 'Infinity'],
    ['--timeout-ms', 'not-a-number'], ['--timeout-ms', '100', '--timeout-ms', '200'],
  ]) assert.throws(() => parseArgs(args), /Usage:/);
});


test('explicit helper budget retains a bounded child exit guard', {timeout: 5000}, async () => {
  const child = fork(new URL('../child.mts', import.meta.url), ['abnormal'], {
    execPath: process.execPath,
    execArgv: ['--experimental-strip-types'],
    env: {...process.env, NEXTTAVERN_G0_CHILD_TIMEOUT_MS: '50'},
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const exit = once(child, 'exit');
  try {
    assert.deepEqual(await exit, [86, null]);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exit;
  }
});
