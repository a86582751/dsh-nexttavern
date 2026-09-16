// Generated from runtime/alpha3/operations/patch-harness.mts; edit the TypeScript source.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { digest, contained, applyTransaction, rollbackTransaction } from './public-transaction.mjs';
export function transform(bytes, patch) {
    const inputHash = digest(bytes);
    if (inputHash === patch.after)
        return { state: 'already-patched', bytes };
    if (inputHash !== patch.before)
        throw Error('Unknown or partially modified fingerprint: ' + patch.package + '/' + patch.file);
    let position = 0;
    const chunks = [];
    for (const edit of patch.edits) {
        if (!Number.isSafeInteger(edit.offset) || !Number.isSafeInteger(edit.delete) || edit.offset < position || edit.delete < 0 || edit.offset + edit.delete > bytes.length || typeof edit.insert !== 'string')
            throw Error('Invalid patch delta');
        chunks.push(bytes.subarray(position, edit.offset), Buffer.from(edit.insert, 'base64'));
        position = edit.offset + edit.delete;
    }
    chunks.push(bytes.subarray(position));
    const output = Buffer.concat(chunks);
    if (digest(output) !== patch.after)
        throw Error('Patch output fingerprint mismatch');
    return { state: 'upstream', bytes: output };
}
export function auditPatches({ harness, patches }) {
    harness = fs.realpathSync(harness);
    const require = createRequire(path.join(harness, 'package.json'));
    const results = [], files = [];
    for (const patch of patches) {
        const resolver = patch.package === '@earendil-works/pi-ai'
            ? createRequire(require.resolve('@deepseek-ai/dsh-llm-pi-ai/package.json')) : require;
        let manifest;
        try {
            manifest = resolver.resolve(patch.package + '/package.json');
        }
        catch (error) {
            if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED')
                throw error;
            for (const directory of resolver.resolve.paths(patch.package) ?? []) {
                const candidate = path.join(directory, patch.package, 'package.json');
                if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate, 'utf8')).name === patch.package) {
                    manifest = candidate;
                    break;
                }
            }
            if (!manifest)
                throw Error('Cannot find package metadata: ' + patch.package);
        }
        manifest = fs.realpathSync(manifest);
        const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (pkg.name !== patch.package || pkg.version !== patch.version)
            throw Error('Unsupported package version: ' + patch.package);
        const target = fs.realpathSync(contained(path.dirname(manifest), patch.file));
        const relative = path.relative(harness, target).replaceAll('\\', '/');
        contained(harness, relative);
        const original = fs.readFileSync(target), result = transform(original, patch);
        results.push({ unit: patch.unit, package: patch.package, version: pkg.version, file: patch.file, before: digest(original), after: patch.after, state: result.state });
        if (result.state !== 'already-patched')
            files.push({ path: relative, before: digest(original), bytes: result.bytes });
    }
    if (new Set(files.map(file => file.path)).size !== files.length)
        throw Error('Duplicate resolved patch target');
    return { results, files };
}
export function patchCli(args = process.argv.slice(2)) {
    if (args.includes('--help')) {
        console.log('patch-harness --harness ROOT [--patches FILE] [--apply --stopped --backup NEW_DIR] | --rollback BACKUP --stopped\nDefault: read-only audit. Writes require DSH_ALLOW_HARNESS_PATCH=1. Stop the target instance first. Unknown versions/fingerprints are refused.');
        return;
    }
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const key = args[i];
        if (['--apply', '--stopped'].includes(key))
            options[key.slice(2)] = true;
        else if (['--harness', '--patches', '--backup', '--rollback'].includes(key))
            options[key.slice(2)] = args[++i];
        else
            throw Error('Unknown option: ' + key);
    }
    if (options.apply || options.rollback) {
        if (process.env.DSH_ALLOW_HARNESS_PATCH !== '1' || !options.stopped)
            throw Error('Explicit stopped-instance acknowledgement and DSH_ALLOW_HARNESS_PATCH=1 required');
    }
    if (options.rollback) {
        console.log(JSON.stringify(rollbackTransaction(options.rollback), null, 2));
        return;
    }
    if (!options.harness)
        throw Error('Explicit --harness required');
    const patchFile = options.patches ?? fileURLToPath(new URL('./harness-patches.json', import.meta.url));
    const data = JSON.parse(fs.readFileSync(patchFile, 'utf8'));
    if (data.schemaVersion !== 1 || !Array.isArray(data.patches) || new Set(data.patches.map(item => item.unit)).size < 6)
        throw Error('Incomplete compatibility patch set');
    const audit = auditPatches({ harness: options.harness, patches: data.patches });
    let transaction = null;
    if (options.apply && audit.files.length) {
        if (!options.backup)
            throw Error('A new --backup directory is required');
        transaction = applyTransaction({ root: options.harness, backup: options.backup, files: audit.files, purpose: 'harness-compatibility' });
    }
    console.log(JSON.stringify({ schemaVersion: 1, mode: options.apply ? 'apply' : 'audit', results: audit.results, transaction }, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    patchCli();
