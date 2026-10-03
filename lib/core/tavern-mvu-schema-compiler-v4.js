// Generated from runtime/alpha3/src/core/tavern-mvu-schema-compiler-v4.ts; edit the TypeScript source.
/** New v4 controller. Data preparation only; no publication/0REG authority.
 * Parsing/binding/transpilation stays in a disposable deadline-bound worker. */
import { Worker } from 'node:worker_threads';
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData } from './tavern-mvu-schema-data.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
import { validateSchemaProgramV4, validateSchemaCompilationInputV4, validateSchemaCompilerIdentityV4 } from './tavern-mvu-schema-program-v4.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
const refused = (code) => ({ kind: 'refused', diagnostics: [{ code }] });
function diagnostic(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        throw Error('diagnostic');
    const value = input;
    if (typeof value.code !== 'string' || !/^[A-Z0-9_]{1,128}$/.test(value.code)
        || Object.keys(value).some(key => !['code', 'pointer', 'scriptIdentity', 'line', 'column'].includes(key))
        || value.pointer !== undefined && (typeof value.pointer !== 'string' || Buffer.byteLength(value.pointer, 'utf8') > 4096)
        || value.scriptIdentity !== undefined && (typeof value.scriptIdentity !== 'string'
            || Buffer.byteLength(value.scriptIdentity, 'utf8') > 256)
        || value.line !== undefined && (!Number.isSafeInteger(value.line) || Number(value.line) < 1)
        || value.column !== undefined && (!Number.isSafeInteger(value.column) || Number(value.column) < 1))
        throw Error('diagnostic');
    return value;
}
function inputOf(program, expectedPlan) {
    return { schemaVersion: 2, encoding: 'native-mvu-author-compilation-input-v2', source: program.source,
        scripts: program.scripts.map(({ javascript: _javascript, javascriptSha256: _javascriptSha256, ...script }) => script),
        libraries: program.libraries, bridge: program.bridge, stateLoader: program.stateLoader, executionPlan: expectedPlan };
}
export function createMvuSchemaCompilerV4(deps) {
    const identity = validateSchemaCompilerIdentityV4(deps.identity);
    const workerUrl = new URL(deps.workerUrl ?? new URL('./tavern-mvu-schema-compiler-worker-v4.mjs', import.meta.url));
    if (workerUrl.protocol !== 'file:')
        throw Error('MVU_SCHEMA_COMPILER_WORKER_URL_INVALID');
    let live = true, disposing;
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
            input = validateSchemaCompilationInputV4(raw);
        }
        catch {
            return refused('MVU_SCHEMA_COMPILER_INPUT_INVALID');
        }
        if (!live)
            return refused('MVU_SCHEMA_COMPILER_DISPOSED');
        if (signal?.aborted)
            return refused('MVU_SCHEMA_COMPILER_CANCELLED');
        let worker;
        try {
            worker = new Worker(workerUrl, { workerData: { identity, input }, resourceLimits: {
                    maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 2,
                } });
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
            // Resolve after termination. Disposal/cancel revokes an already received
            // result and cannot leak a late program while callers release resources.
            void worker.terminate().then(() => completion.resolve(!live ? refused('MVU_SCHEMA_COMPILER_DISPOSED')
                : signal?.aborted ? refused('MVU_SCHEMA_COMPILER_CANCELLED') : result), () => completion.resolve(refused('MVU_SCHEMA_COMPILER_CLEANUP'))).finally(() => active.delete(job));
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
                if (!result || typeof result !== 'object' || Array.isArray(result))
                    throw Error('result');
                if (result.kind === 'compiled' && Object.keys(result).sort().join(',') === 'kind,program') {
                    const program = validateSchemaProgramV4(result.program);
                    if (!same(program.compiler, identity) || !same(inputOf(program, input.executionPlan), input)) {
                        throw Error('result identity');
                    }
                    // A non-null expected plan can only be accepted after the trusted
                    // worker recomputed it. Parent metadata equality adds a second guard.
                    if (input.executionPlan !== null && !same(input.executionPlan, program.executionPlan))
                        throw Error('expected plan');
                    finish({ kind: 'compiled', program });
                }
                else if (result.kind === 'refused' && Object.keys(result).sort().join(',') === 'diagnostics,kind'
                    && Array.isArray(result.diagnostics) && result.diagnostics.length === 1) {
                    finish({ kind: 'refused', diagnostics: [diagnostic(result.diagnostics[0])] });
                }
                else
                    throw Error('result shape');
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
            const program = validateSchemaProgramV4(raw);
            if (!same(program.compiler, identity))
                return false;
            const result = await compile(inputOf(program, program.executionPlan), signal);
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
