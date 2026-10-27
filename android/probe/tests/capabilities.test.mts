import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {probes} from '../probes.mts';
import {runSuite} from '../runner.mts';
import {REQUIRED_CAPABILITIES} from '../model.mts';
import {ChildSession} from '../process-helper.mts';
import {cli, isolatedProbe, probeRoot, temporary} from './helpers.mts';

test('real local runtime suite exercises every required capability', {timeout: 30_000}, async t => temporary(async directory => {
  const summary = await runSuite({probes, workRoot: directory});
  assert.deepEqual(summary.checks.map(check => check.id), REQUIRED_CAPABILITIES);
  for (const check of summary.checks) {
    await t.test(check.id, () => {
      if (check.id === 'native-flock' && check.status === 'blocked') {
        // A passing reporter test is not a native capability pass: the report stays BLOCKED.
        assert.match(check.error!.code!, /^ADDON_/);
        assert.equal(summary.capabilityStatus, 'blocked');
      } else assert.equal(check.status, 'passed', JSON.stringify(check));
    });
  }
  assert.equal(summary.androidGate, false);
  if (process.platform !== 'android') {assert.equal(summary.status, 'blocked'); assert.equal(summary.ok, false);}
}));

test('missing addon is explicitly BLOCKED in isolated CLI; JSON output matches final event', {timeout: 30_000}, async () => temporary(async directory => {
  await isolatedProbe(directory, 'missing');
  const output = join(directory, 'result.json');
  const result = await cli(directory, ['--output', output]);
  assert.equal(result.code, 2, result.stderr);
  const check = result.summary!.checks.find(check => check.id === 'native-flock')!;
  assert.equal(check.status, 'blocked'); assert.equal(check.error!.code, 'ADDON_UNAVAILABLE');
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), result.summary);
  const events = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(events[0].event, 'ready'); assert.equal(events.at(-1).event, 'result');
  assert.equal(events.filter(event => event.event === 'check').length, REQUIRED_CAPABILITIES.length);
  assert.equal(events.at(-1).androidGate, false);
}));

test('a successful no-op flock is detected as FAILED, not accepted as native locking', {timeout: 30_000}, async () => temporary(async directory => {
  await isolatedProbe(directory, 'noop');
  const result = await cli(directory);
  assert.equal(result.code, 1, result.stderr);
  const check = result.summary!.checks.find(check => check.id === 'native-flock')!;
  assert.equal(check.status, 'failed');
  assert.match(check.error!.message, /successful no-op flock/);
  assert.equal(result.summary!.status, 'failed');
}));

test('explicit installed addon loader failure is BLOCKED, not a silent package fallback', {timeout: 30_000}, async () => temporary(async directory => {
  await isolatedProbe(directory, 'noop');
  const result = await cli(directory, [], {NEXTTAVERN_FLOCK_ADDON: join(directory, 'missing-native.so')});
  const check = result.summary!.checks.find(check => check.id === 'native-flock')!;
  assert.equal(check.status, 'blocked'); assert.equal(check.error!.code, 'ADDON_UNAVAILABLE');
  assert.equal(result.code, 2);
}));

test('abort kills an outstanding child and waits for exit', {timeout: 10_000}, async () => {
  const controller = new AbortController();
  const child = new ChildSession('abnormal', [], controller.signal);
  try {
    const ready = await child.receive('ready');
    controller.abort();
    assert.equal((await child.exited).signal, 'SIGKILL');
    assert.throws(() => process.kill(Number(ready.pid), 0), /ESRCH|no such process/i);
  } finally {await child.close();}
});

test('CLI bad arguments are structured errors and do not execute a suite', async () => {
  const result = await cli(probeRoot, ['--not-a-flag']);
  assert.equal(result.code, 64); assert.equal(result.stdout, '');
  const error = JSON.parse(result.stderr.trim());
  assert.equal(error.protocol, 'nexttavern-g0'); assert.equal(error.error.code, 'USAGE');
});

test('output write failure cannot produce a successful process exit', {timeout: 30_000}, async () => temporary(async directory => {
  await isolatedProbe(directory, 'missing');
  const result = await cli(directory, ['--output', join(directory, 'not-created', 'result.json')]);
  assert.equal(result.code, 1); assert.equal(result.summary!.androidGate, false);
  assert.match(result.stderr, /ENOENT/);
}));
