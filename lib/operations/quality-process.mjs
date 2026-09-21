// Generated from runtime/alpha3/src/operations/quality-process.mts; edit the TypeScript source.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveJsdom, resolvePython, resolvePwsh, resolveTar } from './tool-resolution.mjs';
// Probed once per invocation. A previous run's tool discovery is never trusted.
const versions = new Map();
function toolProbe(requirement) {
    if (requirement === 'python')
        return { command: resolvePython(), args: ['--version'] };
    if (requirement === 'pwsh')
        return { command: resolvePwsh() ?? 'pwsh', args: ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'] };
    if (requirement === 'tar')
        return { command: resolveTar(), args: ['--version'] };
    if (requirement === 'go')
        return { command: 'go', args: ['version'] };
    if (requirement === 'git')
        return { command: 'git', args: ['--version'] };
    if (requirement === 'posix')
        return { command: process.env.NEXTTAVERN_SH ?? 'sh', args: ['-c', 'command -v sh; uname -sr'] };
    return null;
}
export function toolVersions(task) {
    const result = {};
    for (const requirement of task.requires ?? []) {
        if (requirement === 'jsdom') {
            const location = resolveJsdom();
            result.jsdom = location + '\n' + fs.readFileSync(path.join(location, 'package.json'), 'utf8');
        }
        const tool = toolProbe(requirement);
        if (!tool)
            continue;
        const key = JSON.stringify(tool);
        if (!versions.has(key)) {
            const probe = spawnSync(tool.command, tool.args, { encoding: 'utf8', windowsHide: true, timeout: 5000 });
            if (probe.error || probe.status !== 0)
                throw Error('Missing environment capability: ' + requirement + ' (' + tool.command + ')');
            versions.set(key, tool.command + '\n' + probe.stdout.trim() + probe.stderr.trim());
        }
        result[requirement] = versions.get(key);
    }
    return result;
}
export async function runProcess(command, args, options) {
    return await new Promise(resolve => {
        let timedOut = false, interrupted = false;
        const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: 'inherit', windowsHide: true,
            detached: process.platform !== 'win32' });
        let escalation;
        const stop = () => {
            if (child.exitCode !== null || child.signalCode !== null)
                return;
            // Tests can own worker processes. Kill only this command's process tree,
            // never a shared Harness or an unrelated conversation's service.
            if (process.platform === 'win32' && child.pid)
                spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
            else if (child.pid) {
                const pid = child.pid;
                try {
                    process.kill(-pid, 'SIGTERM');
                }
                catch {
                    child.kill('SIGTERM');
                }
                escalation = setTimeout(() => { try {
                    process.kill(-pid, 'SIGKILL');
                }
                catch { /* group already exited */ } }, 1000);
            }
        };
        const abort = () => { interrupted = true; stop(); };
        const timer = setTimeout(() => { timedOut = true; stop(); }, options.timeoutMs);
        options.signal.addEventListener('abort', abort, { once: true });
        child.once('error', error => {
            clearTimeout(timer);
            options.signal.removeEventListener('abort', abort);
            if (escalation)
                clearTimeout(escalation);
            console.error(error.message);
            resolve({ status: 1, timedOut, interrupted });
        });
        child.once('close', code => {
            clearTimeout(timer);
            options.signal.removeEventListener('abort', abort);
            if (escalation)
                clearTimeout(escalation);
            resolve({ status: code ?? 1, timedOut, interrupted });
        });
        if (options.signal.aborted)
            abort();
    });
}
export function capabilityProblem(context, task) {
    if (task.unavailable)
        return task.unavailable;
    for (const requirement of task.requires ?? []) {
        if (!['compiler', 'jsdom', 'maintenance', 'windows', 'harness-idle', 'python', 'go', 'git', 'pwsh', 'posix', 'tar'].includes(requirement)) {
            return 'Unknown environment capability: ' + requirement;
        }
        if (requirement === 'compiler') {
            const directories = context.mapping.typeScript?.declarationPackages ?? [];
            for (const directory of directories) {
                if (!fs.existsSync(path.join(context.root, directory, 'node_modules')))
                    return 'Install the locked dependencies with npm ci --prefix ' + directory;
            }
        }
        if (requirement === 'jsdom') {
            try {
                resolveJsdom();
            }
            catch {
                return 'Install jsdom@29.1.1 in a separate test directory and set NEXTTAVERN_JSDOM to its node_modules/jsdom';
            }
        }
        if (requirement === 'maintenance' && context.audience !== 'maintenance')
            return 'Maintainer delivery facility is not shipped; see help for public checks';
        if (requirement === 'windows' && process.platform !== 'win32')
            return 'Requires Windows; not covered on this host';
        if (requirement === 'harness-idle' && process.env.NEXTTAVERN_FIXED_HARNESS_IDLE !== '1') {
            return 'Confirm the fixed local Harness is actually idle and set NEXTTAVERN_FIXED_HARNESS_IDLE=1; no cached health proof is accepted';
        }
        if (requirement === 'harness-idle') {
            const base = path.resolve(context.root, '../dsh-public-access/artifacts/auth-native');
            if (fs.existsSync(path.join(base, '.local-harness.lock')))
                return 'Fixed Harness is occupied; its owner must release the lock';
            // The exclusive lock in the native test closes the race between this
            // inspection and startup. Also reject live services started without it.
            if (process.platform !== 'win32')
                return 'This fixed native Harness check is a Windows maintenance facility';
            const probe = spawnSync(resolvePwsh() ?? 'pwsh', ['-NoLogo', '-NoProfile', '-Command',
                'Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($env:NEXTTAVERN_HARNESS_BASE, [StringComparison]::OrdinalIgnoreCase) -ge 0 } | Select-Object -ExpandProperty ProcessId'], { encoding: 'utf8', windowsHide: true, timeout: 10000, env: { ...process.env, NEXTTAVERN_HARNESS_BASE: base } });
            if (probe.error || probe.status !== 0)
                return 'Could not inspect current fixed Harness occupancy';
            if (probe.stdout.trim())
                return 'Fixed Harness processes are active: ' + probe.stdout.trim().replace(/\s+/g, ', ');
        }
    }
    try {
        toolVersions(task);
    }
    catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    return null;
}
