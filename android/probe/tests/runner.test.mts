import assert from 'node:assert/strict';
import test from 'node:test';
import {readdir} from 'node:fs/promises';
import {aggregateStatus, BlockedError, exitCode, REQUIRED_CAPABILITIES, targetBlockers} from '../model.mts';
import type {Event, ProbeMap, RuntimeIdentity} from '../model.mts';
import {runSuite, runtimeIdentity} from '../runner.mts';
import {temporary} from './helpers.mts';

function fakeProbes(): ProbeMap {
  return Object.fromEntries(REQUIRED_CAPABILITIES.map(id => [id, async () => ({fixture: id})]));
}

test('all required checks emit once in protocol order; desktop cannot pass Android', async () => temporary(async directory => {
  const events: Event[] = [];
  const summary = await runSuite({probes: fakeProbes(), workRoot: directory, onEvent: event => events.push(event)});
  assert.equal(events[0].event, 'ready');
  assert.equal(events.at(-1)!.event, 'result');
  assert.deepEqual(summary.checks.map(check => check.id), REQUIRED_CAPABILITIES);
  assert.equal(summary.capabilityStatus, 'passed');
  assert.equal(summary.actualPlatform, process.platform);
  assert.equal(summary.runtime.execPath, process.execPath);
  assert.equal(summary.androidGate, false);
  if (process.platform !== 'android' || process.arch !== 'arm64') {
    assert.equal(summary.status, 'blocked'); assert.equal(summary.ok, false); assert.equal(exitCode(summary), 2);
  }
  assert.deepEqual(await readdir(directory), []);
}));

test('missing implementation is BLOCKED, never omitted', async () => temporary(async directory => {
  const probes = fakeProbes(); delete probes['native-flock'];
  const summary = await runSuite({probes, workRoot: directory});
  assert.equal(summary.checks.length, REQUIRED_CAPABILITIES.length);
  const native = summary.checks.find(check => check.id === 'native-flock')!;
  assert.equal(native.status, 'blocked'); assert.equal(native.error!.code, 'MISSING_PROBE');
}));

test('HTTPS runs only on explicit selection and cannot hide the existing TLS server failure',async()=>temporary(async directory=>{
  let calls=0;
  const probes=fakeProbes();probes['https-client']=async()=>{calls++;return{status:200,authorized:true,tlsVersion:'TLSv1.3'};};
  const baseline=await runSuite({probes,workRoot:directory});
  assert.equal(calls,0);assert.equal(baseline.checks.length,10);
  probes['tls-local-ca']=async()=>{throw Object.assign(new Error('server-only failure'),{code:'SERVER_ONLY'});};
  const selected=await runSuite({probes,workRoot:directory,httpsClient:true});
  assert.equal(calls,1);assert.deepEqual(selected.checks.slice(0,10).map(check=>check.id),REQUIRED_CAPABILITIES);
  assert.equal(selected.checks.at(-1)!.id,'https-client');assert.equal(selected.checks.at(-1)!.status,'passed');
  assert.equal(selected.checks.find(check=>check.id==='tls-local-ca')!.error!.code,'SERVER_ONLY');
  assert.equal(selected.status,'failed');assert.equal(selected.androidGate,false);
}));

test('explicit missing HTTPS implementation is BLOCKED instead of silently skipped',async()=>temporary(async directory=>{
  const summary=await runSuite({probes:fakeProbes(),workRoot:directory,httpsClient:true});
  assert.equal(summary.checks.at(-1)!.id,'https-client');
  assert.equal(summary.checks.at(-1)!.status,'blocked');
  assert.equal(summary.checks.at(-1)!.error!.code,'MISSING_PROBE');
}));

test('probe failure and explicit blocker remain distinct; failure takes precedence', async () => temporary(async directory => {
  const probes = fakeProbes();
  probes['native-flock'] = async () => {throw new BlockedError('ADDON_UNAVAILABLE', 'test missing binding');};
  probes['sqlite-wal-crash'] = async () => {throw Object.assign(new Error('injected failure'), {code: 'CORRUPTION'});};
  const summary = await runSuite({probes, workRoot: directory});
  assert.equal(summary.status, 'failed'); assert.equal(exitCode(summary), 1);
  assert.equal(summary.checks.find(check => check.id === 'sqlite-wal-crash')!.error!.code, 'CORRUPTION');
  assert.equal(summary.checks.find(check => check.id === 'native-flock')!.status, 'blocked');
  assert.equal(aggregateStatus([{status: 'blocked'}, {status: 'failed'}]), 'failed');
}));

test('deadline aborts stuck capability and still reports subsequent required checks', async () => temporary(async directory => {
  const probes = fakeProbes(); let aborted = false;
  probes['fork-ipc'] = async ({signal}) => new Promise(() => {signal.addEventListener('abort', () => {aborted = true;});});
  const summary = await runSuite({probes, workRoot: directory, timeoutMs: 5});
  assert.equal(aborted, true);
  assert.equal(summary.checks.find(check => check.id === 'fork-ipc')!.error!.code, 'PROBE_TIMEOUT');
  assert.equal(summary.checks.at(-1)!.id, 'dns-localhost');
}));

test('pre-cancelled suite does not launch capabilities', async () => temporary(async directory => {
  let calls = 0;
  const probes = Object.fromEntries(REQUIRED_CAPABILITIES.map(id => [id, async () => {calls++; return {};}])) as ProbeMap;
  const controller = new AbortController();
  controller.abort(Object.assign(new Error('stop'), {code: 'INTERRUPTED'}));
  const summary = await runSuite({probes, workRoot: directory, signal: controller.signal});
  assert.equal(calls, 0); assert.equal(summary.status, 'failed');
  assert.ok(summary.checks.every(check => check.error?.code === 'INTERRUPTED'));
}));

test('target policy uses actual runtime identity, never shell Android environment claims', async () => {
  const identity = await runtimeIdentity();
  const desktop = {...identity, platform: 'linux', arch: 'x64'};
  assert.equal(targetBlockers(desktop).length, 2);
  assert.deepEqual(targetBlockers({...identity, platform: 'android', arch: 'arm64', node: '24.22.1'} as RuntimeIdentity), []);
  assert.equal(targetBlockers({...identity, platform: 'android', arch: 'arm64', node: '26.0.0'}).length, 1);
});
