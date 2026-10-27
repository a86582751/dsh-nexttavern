#!/usr/bin/env -S node --experimental-strip-types
import {writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {errorRecord, exitCode, PROTOCOL} from './model.mts';
import {probes} from './probes.mts';
import {runSuite} from './runner.mts';

export interface ProbeArgs {output?: string; timeoutMs?: number; httpsClient?: true; atomicPublish?: true}
const MAX_DIAGNOSTIC_TIMEOUT_MS = 120_000;

function usage(): never {
  throw Object.assign(new Error('Usage: node run.mts [--output path] [--timeout-ms 1..120000 (test-only software timing)] [--https-client (fixed no-key public endpoint)] [--atomic-publish (separate Android no-replace evidence)]'), {code: 'USAGE'});
}
export function parseArgs(args: string[]): ProbeArgs {
  const options: ProbeArgs = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if(flag==='--https-client') {
      if(options.httpsClient)usage();
      options.httpsClient=true;continue;
    }
    if(flag==='--atomic-publish') {
      if(options.atomicPublish)usage();options.atomicPublish=true;continue;
    }
    const value = args[++index];
    if (flag === '--output') {
      if (!value || value.startsWith('--') || options.output !== undefined) usage();
      options.output = resolve(value);
    } else if (flag === '--timeout-ms') {
      const timeoutMs = Number(value);
      if (options.timeoutMs !== undefined || !Number.isInteger(timeoutMs)
        || timeoutMs < 1 || timeoutMs > MAX_DIAGNOSTIC_TIMEOUT_MS) usage();
      options.timeoutMs = timeoutMs;
    } else usage();
  }
  return options;
}

async function main(): Promise<void> {
  let args: ProbeArgs;
  try {args = parseArgs(process.argv.slice(2));} catch (error) {
    process.stderr.write(`${JSON.stringify({protocol: PROTOCOL, event: 'error', error: errorRecord(error)})}\n`);
    process.exitCode = 64;
    return;
  }
  // Only this explicit test option changes helper lifetimes. Do not inherit an
  // unrelated shell override into a default/device run.
  if (args.timeoutMs === undefined) delete process.env.NEXTTAVERN_G0_CHILD_TIMEOUT_MS;
  else {
    process.env.NEXTTAVERN_G0_CHILD_TIMEOUT_MS = String(args.timeoutMs);
    process.stderr.write(`[test-only software timing] per-check/helper budget ${args.timeoutMs}ms; not phone performance evidence\n`);
  }
  const controller = new AbortController();
  let termination: 'SIGTERM' | 'SIGINT' | undefined;
  const terminate = (signal: 'SIGTERM' | 'SIGINT') => {
    termination = signal;
    controller.abort(Object.assign(new Error(`Probe suite interrupted by ${signal}`), {code: 'INTERRUPTED'}));
  };
  const onTerm = () => terminate('SIGTERM');
  const onInt = () => terminate('SIGINT');
  process.once('SIGTERM', onTerm);
  process.once('SIGINT', onInt);
  try {
    // The Android supervisor supplies an app-private cwd. Never touch Harness data.
    const summary = await runSuite({probes, ...(args.timeoutMs === undefined ? {} : {timeoutMs: args.timeoutMs}),
      ...(args.httpsClient?{httpsClient:true}:{}),...(args.atomicPublish?{atomicPublish:true}:{}),workRoot: join(process.cwd(), 'artifacts', 'test-temp'), signal: controller.signal,
      onEvent: event => process.stdout.write(`${JSON.stringify(event)}\n`)});
    if (args.output) await writeFile(args.output, `${JSON.stringify(summary, null, 2)}\n`, {flag: 'w', mode: 0o600});
    process.exitCode = termination === 'SIGTERM' ? 143 : termination === 'SIGINT' ? 130 : exitCode(summary);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({protocol: PROTOCOL, event: 'error', error: errorRecord(error)})}\n`);
    process.exitCode = termination === 'SIGTERM' ? 143 : termination === 'SIGINT' ? 130 : 1;
  } finally {
    process.removeListener('SIGTERM', onTerm);
    process.removeListener('SIGINT', onInt);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
