// Generated from runtime/alpha3/schema-executors/v2/src/core/tavern-mvu-schema-compiler.ts; edit the TypeScript source.
/** Compilation is data preparation, never Source or numerical authority.
 * Parsing/transpilation runs only in a disposable, deadline-bound worker. */
import { Worker } from 'node:worker_threads';
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, validateSchemaProgram } from './tavern-mvu-schema-data.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
const same = (a, b) => recordSha256(a) === recordSha256(b);
function validIdentity(value) {
    return value?.typescriptVersion === '5.9.3' && Number.isSafeInteger(value.version) && value.version >= 1
        && typeof value.id === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(value.id)
        && /^[a-f0-9]{64}$/.test(value.implementationSha256)
        && Object.keys(value).sort().join(',') === 'id,implementationSha256,typescriptVersion,version';
}
export function createMvuSchemaCompiler(deps) {
    const identity = cloneSchemaData(deps.identity, MVU_SCHEMA_BOUNDS.inputBytes);
    if (!validIdentity(identity))
        throw Error('MVU_SCHEMA_COMPILER_IDENTITY_INVALID');
    Object.freeze(identity);
    const workerUrl = new URL(deps.workerUrl ?? new URL('./tavern-mvu-schema-compiler-worker.mjs', import.meta.url));
    if (workerUrl.protocol !== 'file:')
        throw Error('MVU_SCHEMA_COMPILER_WORKER_URL_INVALID');
    let live = true;
    let disposing;
    const active = new Set();
    async function compile(raw, signal) {
        if (!live)
            return refused('MVU_SCHEMA_COMPILER_DISPOSED');
        if (signal?.aborted)
            return refused('MVU_SCHEMA_COMPILER_CANCELLED');
        if (active.size >= 4)
            return refused('MVU_SCHEMA_COMPILER_BUSY');
        let input;
        try {
            input = cloneSchemaData(raw, MVU_SCHEMA_BOUNDS.inputBytes);
        }
        catch {
            return refused('MVU_SCHEMA_COMPILER_INPUT_INVALID');
        }
        let worker;
        try {
            worker = new Worker(workerUrl, { workerData: { identity, input }, resourceLimits: { maxOldGenerationSizeMb: 128,
                    maxYoungGenerationSizeMb: 16, stackSizeMb: 2 } });
        }
        catch {
            return refused('MVU_SCHEMA_COMPILER_WORKER_UNAVAILABLE');
        }
        const completion = Promise.withResolvers();
        let settled = false;
        const abort = () => job.cancel('MVU_SCHEMA_COMPILER_CANCELLED');
        const timer = setTimeout(() => job.cancel('MVU_SCHEMA_COMPILER_DEADLINE'), MVU_SCHEMA_BOUNDS.parentDeadlineMs);
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            // Resolve only after actual worker termination. No late compiler result
            // survives cancellation/disposal, and a caller may safely release files.
            void worker.terminate().then(() => completion.resolve(!live ? refused('MVU_SCHEMA_COMPILER_DISPOSED') :
                signal?.aborted ? refused('MVU_SCHEMA_COMPILER_CANCELLED') : result), () => completion.resolve(refused('MVU_SCHEMA_COMPILER_CLEANUP')))
                .finally(() => active.delete(job));
        };
        const job = { cancel: (code) => finish(refused(code)), done: completion.promise };
        active.add(job);
        worker.once('error', () => finish(refused('MVU_SCHEMA_COMPILER_WORKER_ERROR')));
        worker.once('exit', () => { if (!settled)
            finish(refused('MVU_SCHEMA_COMPILER_WORKER_EXIT')); });
        worker.once('message', (rawResult) => {
            if (settled)
                return;
            if (!live) {
                job.cancel('MVU_SCHEMA_COMPILER_DISPOSED');
                return;
            }
            if (signal?.aborted) {
                abort();
                return;
            }
            try {
                const result = cloneSchemaData(rawResult, MVU_SCHEMA_BOUNDS.programBytes);
                if (result.kind === 'compiled') {
                    const program = validateSchemaProgram(result.program);
                    const original = { schemaVersion: program.schemaVersion, source: program.source,
                        scripts: program.scripts.map(({ javascript: _js, javascriptSha256: _sha, ...script }) => script),
                        libraries: program.libraries, bridge: program.bridge };
                    if (!same(program.compiler, identity) || !same(original, input))
                        throw Error('worker result identity');
                    finish({ kind: 'compiled', program });
                }
                else if (result.kind === 'refused' && Array.isArray(result.diagnostics) && result.diagnostics.length === 1) {
                    const diagnostic = result.diagnostics[0];
                    if (!diagnostic || typeof diagnostic.code !== 'string' || !/^[A-Z0-9_]{1,128}$/.test(diagnostic.code)
                        || Object.keys(diagnostic).some(key => !['code', 'pointer', 'scriptIdentity', 'line', 'column'].includes(key)))
                        throw Error('diagnostic');
                    finish(result);
                }
                else
                    throw Error('worker result shape');
            }
            catch {
                finish(refused('MVU_SCHEMA_COMPILER_RESULT_INVALID'));
            }
        });
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted)
            abort();
        if (!live)
            job.cancel('MVU_SCHEMA_COMPILER_DISPOSED');
        return completion.promise;
    }
    async function verifyProgram(raw, signal) {
        if (!live || signal?.aborted)
            return false;
        try {
            const program = validateSchemaProgram(cloneSchemaData(raw, MVU_SCHEMA_BOUNDS.programBytes));
            if (!same(program.compiler, identity))
                return false;
            const result = await compile({ schemaVersion: 1, source: program.source,
                scripts: program.scripts.map(({ javascript: _js, javascriptSha256: _sha, ...script }) => script),
                libraries: program.libraries, bridge: program.bridge }, signal);
            return live && !signal?.aborted && result.kind === 'compiled' && same(result.program, program);
        }
        catch {
            return false;
        }
    }
    return { identity, compile, verifyProgram, async dispose() {
            if (disposing)
                return disposing;
            live = false;
            const jobs = [...active];
            for (const job of jobs)
                job.cancel('MVU_SCHEMA_COMPILER_DISPOSED');
            disposing = Promise.all(jobs.map(job => job.done)).then(() => { });
            return disposing;
        } };
}
