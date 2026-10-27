import {cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import type {Summary} from '../model.mts';

export const probeRoot = fileURLToPath(new URL('../', import.meta.url));
export const testRoot = join(probeRoot, 'artifacts', 'test-temp');

export async function temporary<T>(run: (directory: string) => Promise<T>): Promise<T> {
  await mkdir(testRoot, {recursive: true, mode: 0o700});
  const directory = await mkdtemp(join(testRoot, 'test-'));
  try {return await run(directory);} finally {await rm(directory, {recursive: true, force: true});}
}

export async function isolatedProbe(directory: string, addon: 'missing' | 'noop'): Promise<void> {
  for (const entry of await readdir(probeRoot)) {
    if (entry.endsWith('.mts')) await cp(join(probeRoot, entry), join(directory, entry));
  }
  await cp(join(probeRoot, 'fixtures'), join(directory, 'fixtures'), {recursive: true});
  const packagePath = join(directory, 'node_modules', '@deepseek-ai', 'node-addon-system');
  await mkdir(packagePath, {recursive: true});
  await writeFile(join(packagePath, 'package.json'), JSON.stringify({
    name: '@deepseek-ai/node-addon-system', type: 'module', exports: {'./flock': './flock.mjs'},
  }));
  if (addon === 'noop') {
    // This is generated output from maintained MTS, not handwritten JavaScript.
    const source = await readFile(new URL('./noop-flock.mts', import.meta.url), 'utf8');
    await writeFile(join(packagePath, 'flock.mjs'), stripTypeScriptTypes(source));
  }
}

export async function cli(directory: string, args: string[] = [], extraEnv: Record<string, string> = {}): Promise<{
  code: number | null; stdout: string; stderr: string; summary?: Summary;
}> {
  const child = spawn(process.execPath, [join(directory, 'run.mts'), ...args], {
    cwd: directory, env: {...process.env, NEXTTAVERN_FLOCK_ADDON: '', ...extraEnv}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', chunk => {stdout += String(chunk);});
  child.stderr.on('data', chunk => {stderr += String(chunk);});
  const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000);
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject); child.once('close', code => resolve(code));
  }).finally(() => clearTimeout(timeout));
  const events = stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  return {code, stdout, stderr, summary: events.find(event => event.event === 'result')?.summary};
}
