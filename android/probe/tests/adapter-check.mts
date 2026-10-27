/** Focused manual smoke check: NEXTTAVERN_FLOCK_ADDON=<real native binary> node tests/adapter-check.mts */
import assert from 'node:assert/strict';
import {probes} from '../probes.mts';
import {temporary} from './helpers.mts';

await temporary(async directory => {
  const signal = AbortSignal.timeout(12_000);
  const evidence = await probes['native-flock']!({directory, signal});
  assert.equal(evidence.loader, 'explicit-installed-native-dlopen');
  assert.equal(evidence.realCrossProcessContention, true);
  assert.equal(evidence.sigkillReleases, true);
  process.stdout.write(`${JSON.stringify({scope: 'native-loader-desktop-smoke-only', platform: process.platform,
    androidGate: false, evidence})}\n`);
});
