// Shared tool resolution for the local suites. A suite must not depend on PATH
// order or on one machine's install paths: name the tool it needs here, and let
// the resolver fail with what to install when this host cannot provide it.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function probe(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {stdio: 'ignore', windowsHide: true});
  return !result.error && result.status === 0;
}

/** `tar` for this host. Windows keeps the system bsdtar even when another tar
 *  is earlier on PATH: Git for Windows ships GNU tar, and GNU tar reads an
 *  absolute `D:\...` archive argument as a remote host name.
 *  `NEXTTAVERN_TAR` overrides the choice; it is also the only extraction seam
 *  the Linux installer engine reads, so a suite that drives that engine must
 *  publish the resolved command through `process.env.NEXTTAVERN_TAR`. */
export function resolveTar(): string {
  const override = process.env.NEXTTAVERN_TAR;
  if (override) return override;
  const system = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  if (process.platform === 'win32' && fs.existsSync(system) && probe(system, ['--version'])) return system;
  return 'tar';
}

/** PowerShell 7 drives the generated-installer contracts. Returns null when
 *  this host has none, so a caller can decide between failing and reporting. */
export function resolvePwsh(): string | null {
  const override = process.env.NEXTTAVERN_PWSH;
  if (override) {
    if (!probe(override, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'exit 0'])) {
      throw new Error('NEXTTAVERN_PWSH does not run: ' + override);
    }
    return override;
  }
  const directories = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
    .filter((directory): directory is string => typeof directory === 'string');
  const candidates = process.platform === 'win32'
    ? ['pwsh', ...directories.flatMap(directory => [
      path.join(directory, 'PowerShell', '7', 'pwsh.exe'),
      path.join(directory, 'PowerShell', '7-preview', 'pwsh.exe'),
      path.join(directory, 'Microsoft', 'WindowsApps', 'pwsh.exe')
    ])]
    : ['pwsh', '/usr/bin/pwsh', '/usr/local/bin/pwsh', '/opt/microsoft/powershell/7/pwsh', '/snap/bin/pwsh'];
  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && !fs.existsSync(candidate)) continue;
    if (probe(candidate, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'exit 0'])) return candidate;
  }
  return null;
}

/** The same resolution for a suite that cannot run without PowerShell 7. */
export function requirePwsh(): string {
  const command = resolvePwsh();
  if (!command) {
    throw new Error('PowerShell 7 (pwsh) is required to run this suite: install it (winget install --id Microsoft.PowerShell) or set NEXTTAVERN_PWSH to the pwsh executable');
  }
  return command;
}

/** Windows PowerShell 5.1, whose parser must also accept the generated
 *  installer. Returns null off Windows or on a host without it. */
export function resolveWindowsPowerShell(): string | null {
  if (process.platform !== 'win32') return null;
  const candidate = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return probe(candidate, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', 'exit 0']) ? candidate : null;
}

/** The byte-delta helpers and the archive writer are Python 3. A hosted Linux
 *  runner ships `python3` and not always `python`, so name the interpreter here
 *  instead of letting every caller guess; `NEXTTAVERN_PYTHON` overrides it. */
export function resolvePython(): string {
  const override = process.env.NEXTTAVERN_PYTHON;
  for (const candidate of override ? [override] : ['python', 'python3']) {
    if (probe(candidate, ['--version'])) return candidate;
  }
  throw new Error(override ? 'NEXTTAVERN_PYTHON does not run: ' + override : 'Python 3 is required to build a public release: install it or set NEXTTAVERN_PYTHON');
}

/** jsdom drives the reader and toast DOM assertions. It is a test-only
 *  dependency, locked in build-tools. An explicit override is supported, but
 *  neither maintained nor published tests borrow an unrelated Harness tree. */
export function resolveJsdom(): string {
  const override = process.env.NEXTTAVERN_JSDOM;
  const base = path.dirname(fileURLToPath(import.meta.url));
  const candidates = override ? [override] : [
    path.resolve(base, '../../build-tools/node_modules/jsdom')
  ];
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  throw new Error(override ? 'NEXTTAVERN_JSDOM does not exist: ' + override : 'jsdom is required to run this suite: install it into runtime/alpha3/build-tools or point NEXTTAVERN_JSDOM at an existing install');
}

/** Suites use Chinese fixture paths and hand them to PowerShell, Python and
 *  `tar`. A Windows console inherits a code page that decodes UTF-8 child
 *  output as mojibake and re-encodes non-ASCII output from Python children, so
 *  pin the child environment and, when the suite owns a console, its code
 *  page. Under CI there is no console and everything is UTF-8 already. */
export function forceUtf8Output(): void {
  process.env.PYTHONIOENCODING = 'utf-8';
  process.env.PYTHONUTF8 = '1';
  if (process.platform !== 'win32' || !process.stdout.isTTY) return;
  spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'chcp.com'), ['65001'], {stdio: 'ignore', windowsHide: true});
}
