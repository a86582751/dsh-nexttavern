// Generated from runtime/alpha3/src/core/tavern-mvu-schema-runner-v4.ts; edit the TypeScript source.
/** A fresh bounded guest evaluation is evidence about code and data, never a
 * Source/Native capability. Only the trusted Core supplies assets and workers. */
import { Worker } from 'node:worker_threads';
import { recordSha256 } from './roleplay-data.js';
import { cloneSchemaData, cloneSchemaEnvelopeV4, packSchemaEnvelopeV4, cloneSchemaValues, schemaTextSha256 } from './tavern-mvu-schema-data.js';
import { validateSchemaProgramV4, deriveOwnedStateLoaderIdentityV4 } from './tavern-mvu-schema-program-v4.js';
import { MVU_SCHEMA_BOUNDS } from './tavern-mvu-schema-types.js';
import { isKnownSchemaUpdateRejectionV2, validateSchemaUpdateCommandsV2 } from './tavern-mvu-schema-update-effects-v2.js';
import { validateMvuScopeReadFrameV1 } from './tavern-mvu-scope-read.js';
const same = (a, b) => recordSha256(a) === recordSha256(b);
const diagnostic = (code) => [{ code }];
const unavailable = (code) => ({ kind: 'unavailable', diagnostics: diagnostic(code) });
const cancelled = () => ({ kind: 'cancelled', diagnostics: diagnostic('SCHEMA_CANCELLED') });
const evaluationBytes = MVU_SCHEMA_BOUNDS.inputBytes + MVU_SCHEMA_BOUNDS.outputBytes + 4096;
// Trace frames live exactly once in input. Compact headers need at most 128KiB
// for 64 escaped event identifiers, hashes and fixed keys; guest limits stay put.
const traceEvaluationBytes = MVU_SCHEMA_BOUNDS.inputBytes + MVU_SCHEMA_BOUNDS.outputBytes + 131072;
const evaluationBounds = { nodes: MVU_SCHEMA_BOUNDS.evaluationNodes, depth: MVU_SCHEMA_BOUNDS.evaluationDepth };
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const identifier = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256;
function traceRecord(step, ordinal, previous, output) {
    const body = { ordinal, eventId: step.eventId, frame: step.frame, previousStepSha256: previous, output };
    return { ordinal, eventId: step.eventId, previousStepSha256: previous, output,
        frameSha256: recordSha256(step.frame), stepSha256: recordSha256(body) };
}
function exact(value, keys) {
    if (!same(Object.keys(value).sort(), [...keys].sort()))
        throw Error('SCHEMA_DATA_INVALID');
}
function implementation(value) {
    if (!value || typeof value.id !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value.id)
        || !Number.isSafeInteger(value.version) || value.version < 1
        || typeof value.implementationSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.implementationSha256)) {
        throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE');
    }
}
export function validateSchemaEvaluationInputV4(input) {
    const value = cloneSchemaData(input, MVU_SCHEMA_BOUNDS.inputBytes);
    exact(value, ['schemaVersion', 'encoding', 'commandsEncoding', 'errorPolicy', 'phase', 'base', 'values', 'commands',
        'context', 'scopeReadFrame', 'clockEpochMs', 'randomSeed']);
    const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (value.schemaVersion !== 4 || value.encoding !== 'native-mvu-author-schema-phase-input-v4'
        || value.commandsEncoding !== 'native-mvu-update-operations-v2' || value.errorPolicy !== 'atomic-refusal'
        || !['initialization', 'command-parsed', 'commands-parsed', 'update-ended', 'manual-replacement'].includes(value.phase)
        || value.base !== null && !object(value.base) || !object(value.values) || !object(value.context)
        || !Array.isArray(value.commands) || !Number.isSafeInteger(value.clockEpochMs)
        || typeof value.randomSeed !== 'string' || !value.randomSeed.length || value.randomSeed.length > 256)
        throw Error('SCHEMA_INPUT_INVALID');
    value.commands = validateSchemaUpdateCommandsV2(value.commands);
    if (value.phase !== 'command-parsed' && value.commands.length)
        throw Error('SCHEMA_COMMANDS_UNSUPPORTED');
    value.values = cloneSchemaValues(value.values);
    if (value.base !== null)
        value.base = cloneSchemaValues(value.base);
    if (Object.hasOwn(value.context, 'stat_data'))
        throw Error('SCHEMA_CONTEXT_INVALID');
    value.scopeReadFrame = validateMvuScopeReadFrameV1(value.scopeReadFrame);
    return value;
}
/** Pure correlations only. The enclosing Core owner must still prove the cut,
 * mutable snapshot and each published-state reference against Native facts. */
export function validateSchemaScopeProgramFrameV4(program, scope, binding, load = false) {
    if (scope.source.importId !== program.source.importId || scope.source.rawSha256 !== program.source.sourceSha256
        || binding && (scope.source.sessionId !== binding.ownerSessionId || scope.sourceNativeCutSha256 !== binding.sourceNativeCutSha256)
        || load && scope.source.sourceSnapshotSha256 !== program.source.sourceSnapshotSha256) {
        throw Error('SCHEMA_SCOPE_BINDING_MISMATCH');
    }
    const matches = new Set();
    for (const scoped of scope.scripts) {
        const script = program.scripts.find(item => item.pointer === scoped.pointer && item.sourceSha256 === scoped.sourceSha256);
        if (!script || script.identity !== scoped.scriptId || matches.has(script.identity))
            throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH');
        matches.add(script.identity);
    }
    if (program.scripts.some(script => script.enabled && !matches.has(script.identity)))
        throw Error('SCHEMA_SCOPE_SCRIPT_MISMATCH');
}
/** Optional input correlates a stored output with its exact completed phase.
 * Journal reads accept only the explicit schema, atomic update and scope refusals. */
export function validateSchemaGuestOutputV4(raw, input) {
    const output = cloneSchemaData(raw, MVU_SCHEMA_BOUNDS.outputBytes);
    const wire = ['schemaVersion', 'encoding', 'commandsEncoding', 'errorPolicy', 'executionPlanSha256'];
    if (!output || output.schemaVersion !== 4 || output.encoding !== 'native-mvu-author-schema-phase-output-v4'
        || output.commandsEncoding !== 'native-mvu-update-operations-v2' || output.errorPolicy !== 'atomic-refusal'
        || !hash(output.executionPlanSha256)) {
        throw Error('SCHEMA_OUTPUT_INVALID');
    }
    if (output.kind === 'accepted') {
        exact(output, [...wire, 'kind', 'values', 'commands', 'context', 'registrations']);
        if (!output.values || typeof output.values !== 'object' || Array.isArray(output.values) || !Array.isArray(output.commands)
            || output.commands.length !== 0
            || !Number.isSafeInteger(output.registrations) || output.registrations < 0 || output.registrations > MVU_SCHEMA_BOUNDS.scripts) {
            throw Error('SCHEMA_OUTPUT_INVALID');
        }
        output.values = cloneSchemaValues(output.values);
        if (!output.context || typeof output.context !== 'object' || Array.isArray(output.context)
            || Object.hasOwn(output.context, 'stat_data'))
            throw Error('SCHEMA_CONTEXT_INVALID');
    }
    else if (output.kind === 'refused') {
        exact(output, [...wire, 'kind', 'diagnostics']);
        if (!Array.isArray(output.diagnostics) || !output.diagnostics.length || output.diagnostics.length > 64)
            throw Error('SCHEMA_OUTPUT_INVALID');
        const index = (value, max = 64) => Number.isSafeInteger(value) && typeof value === 'number' && value >= 0 && value < max;
        let previousCommand = -1;
        let failedRegistrationCount;
        for (const item of output.diagnostics) {
            if (item.code === 'SCHEMA_SCOPE_READ_FAILED') {
                exact(item, ['code', 'scriptPointer', 'readCode']);
                if (output.diagnostics.length !== 1 || typeof item.scriptPointer !== 'string'
                    || Buffer.byteLength(item.scriptPointer, 'utf8') > 4096 || item.scriptPointer !== '' && !item.scriptPointer.startsWith('/')
                    || typeof item.readCode !== 'string' || !(/^(?:SCHEMA_|SCOPE_READ_)[A-Z_]+$/.test(item.readCode)
                    || ['SCOPE_SOURCE_UNAVAILABLE', 'MESSAGE_STATE_UNAVAILABLE'].includes(item.readCode))
                    || input && !input.scopeReadFrame.scripts.some(script => script.pointer === item.scriptPointer))
                    throw Error('SCHEMA_OUTPUT_INVALID');
            }
            else if (item.code === 'STATE_ONLY_UPDATE_OPERATION_REJECTED') {
                exact(item, ['code', 'commandIndex', 'updateCode', ...(Object.hasOwn(item, 'pointer') ? ['pointer'] : [])]);
                if (!index(item.commandIndex, input?.commands.length ?? 64)
                    || !isKnownSchemaUpdateRejectionV2(item.updateCode) || output.diagnostics.length !== 1
                    || item.pointer !== undefined && (typeof item.pointer !== 'string'
                        || Buffer.byteLength(item.pointer, 'utf8') > MVU_SCHEMA_BOUNDS.valuesBytes)
                    || input && input.phase !== 'command-parsed')
                    throw Error('SCHEMA_OUTPUT_INVALID');
            }
            else if (item.code === 'SCHEMA_UPDATE_OPERATION_REJECTED') {
                exact(item, ['code', 'commandIndex', 'registrationIndex', 'updateCode', ...(Object.hasOwn(item, 'pointer') ? ['pointer'] : [])]);
                if (!index(item.commandIndex, input?.commands.length ?? 64) || !index(item.registrationIndex)
                    || !isKnownSchemaUpdateRejectionV2(item.updateCode) || output.diagnostics.length !== 1
                    || item.pointer !== undefined && (typeof item.pointer !== 'string'
                        || Buffer.byteLength(item.pointer, 'utf8') > MVU_SCHEMA_BOUNDS.valuesBytes)
                    || input && input.phase !== 'command-parsed')
                    throw Error('SCHEMA_OUTPUT_INVALID');
            }
            else if (item.code === 'SCHEMA_VALIDATION_FAILED') {
                if ('commandIndex' in item) {
                    exact(item, ['code', 'commandIndex', 'failedRegistrationIndexes']);
                    if (!index(item.commandIndex, input?.commands.length ?? 64) || item.commandIndex <= previousCommand
                        || !Array.isArray(item.failedRegistrationIndexes) || !item.failedRegistrationIndexes.length
                        || item.failedRegistrationIndexes.length > 64 || input && input.phase !== 'command-parsed')
                        throw Error('SCHEMA_OUTPUT_INVALID');
                    previousCommand = item.commandIndex;
                    // Every registration saw this still-unconsumed command in order.
                    if (item.failedRegistrationIndexes.some((value, position) => value !== position))
                        throw Error('SCHEMA_OUTPUT_INVALID');
                    failedRegistrationCount ??= item.failedRegistrationIndexes.length;
                    if (item.failedRegistrationIndexes.length !== failedRegistrationCount)
                        throw Error('SCHEMA_OUTPUT_INVALID');
                }
                else {
                    exact(item, ['code', 'registrationIndex']);
                    if (!index(item.registrationIndex) || output.diagnostics.length !== 1
                        || input && !['initialization', 'manual-replacement'].includes(input.phase))
                        throw Error('SCHEMA_OUTPUT_INVALID');
                }
            }
            else
                throw Error('SCHEMA_OUTPUT_INVALID');
        }
    }
    else
        throw Error('SCHEMA_OUTPUT_INVALID');
    return output;
}
/** Reading data does not authorize 0REG. Every current capture and historical
 * replay must additionally bind this envelope to its actual validated program. */
export function validateSchemaGuestOutputForProgramV4(raw, program, input) {
    const actual = validateSchemaProgramV4(program);
    const output = validateSchemaGuestOutputV4(raw, input);
    if (output.executionPlanSha256 !== actual.executionPlan.executionPlanSha256)
        throw Error('SCHEMA_OUTPUT_PLAN_MISMATCH');
    const counts = actual.executionPlan.summary;
    const stateOnly = counts.enabledServerSchema === 0 && counts.enabledNativeLoaders > 0;
    if (output.kind === 'accepted') {
        const validRegistrations = stateOnly ? output.registrations === 0 :
            counts.enabledServerSchema > 0 && output.registrations >= counts.enabledServerSchema;
        if (!validRegistrations)
            throw Error('SCHEMA_REGISTRATION_MISSING');
    }
    else
        for (const item of output.diagnostics) {
            if (item.code === 'STATE_ONLY_UPDATE_OPERATION_REJECTED' ? !stateOnly :
                stateOnly && item.code !== 'SCHEMA_SCOPE_READ_FAILED')
                throw Error('SCHEMA_OUTPUT_INVALID');
        }
    return output;
}
function outputData(json, program, input) {
    if (typeof json !== 'string' || Buffer.byteLength(json, 'utf8') > MVU_SCHEMA_BOUNDS.outputBytes)
        throw Error('SCHEMA_OUTPUT_LIMIT');
    return validateSchemaGuestOutputForProgramV4(JSON.parse(json), program, input);
}
export function validateSchemaTraceInputV4(program, input) {
    // Numerical/code metadata retains one aggregate budget. Source DATA is owned
    // separately and repeated load/prefix/requested references share one material.
    const value = cloneSchemaEnvelopeV4(input, MVU_SCHEMA_BOUNDS.inputBytes);
    exact(value, ['schemaVersion', 'encoding', 'realmEpoch', 'loadFrame', 'prefix', 'requestedStep']);
    if (value.schemaVersion !== 4 || value.encoding !== 'native-mvu-author-schema-trace-input-v4'
        || !hash(value.realmEpoch) || !Array.isArray(value.prefix) || value.prefix.length >= MVU_SCHEMA_BOUNDS.traceSteps) {
        throw Error('SCHEMA_TRACE_INPUT_INVALID');
    }
    const binding = (frame) => {
        if (!identifier(frame.ownerSessionId) || !hash(frame.sourceNativeCutSha256)
            || !frame.material || typeof frame.material !== 'object' || Array.isArray(frame.material))
            throw Error('SCHEMA_TRACE_FRAME_INVALID');
    };
    const load = value.loadFrame;
    exact(load, ['schemaVersion', 'ownerSessionId', 'sourceNativeCutSha256', 'material', 'values', 'context',
        'scopeReadFrame', 'clockEpochMs', 'randomSeed']);
    binding(load);
    if (load.schemaVersion !== 4)
        throw Error('SCHEMA_TRACE_FRAME_INVALID');
    const initial = validateSchemaEvaluationInputV4({ schemaVersion: 4, encoding: 'native-mvu-author-schema-phase-input-v4',
        commandsEncoding: 'native-mvu-update-operations-v2', errorPolicy: 'atomic-refusal',
        phase: 'initialization', base: null, values: load.values, commands: [],
        context: load.context, scopeReadFrame: load.scopeReadFrame, clockEpochMs: load.clockEpochMs, randomSeed: load.randomSeed });
    load.values = initial.values;
    load.context = initial.context;
    load.scopeReadFrame = initial.scopeReadFrame;
    validateSchemaScopeProgramFrameV4(program, load.scopeReadFrame, load, true);
    const frame = (item) => {
        exact(item, ['ownerSessionId', 'sourceNativeCutSha256', 'material', 'input']);
        binding(item);
        item.input = validateSchemaEvaluationInputV4(item.input);
        validateSchemaScopeProgramFrameV4(program, item.input.scopeReadFrame, item);
    };
    const ids = new Set();
    let previous = recordSha256({ programSha256: program.programSha256, realmEpoch: value.realmEpoch, loadFrame: load });
    for (const [index, step] of value.prefix.entries()) {
        exact(step, ['eventId', 'frame', 'ordinal', 'previousStepSha256', 'output', 'stepSha256']);
        if (!identifier(step.eventId) || ids.has(step.eventId) || step.ordinal !== index + 1 || step.previousStepSha256 !== previous
            || !hash(step.stepSha256))
            throw Error('SCHEMA_TRACE_PREFIX_INVALID');
        ids.add(step.eventId);
        frame(step.frame);
        step.output = validateSchemaGuestOutputForProgramV4(step.output, program, step.frame.input);
        const { stepSha256, ...body } = step;
        if (recordSha256(body) !== stepSha256)
            throw Error('SCHEMA_TRACE_PREFIX_INVALID');
        previous = stepSha256;
    }
    exact(value.requestedStep, ['eventId', 'frame']);
    if (!identifier(value.requestedStep.eventId) || ids.has(value.requestedStep.eventId))
        throw Error('SCHEMA_TRACE_EVENT_INVALID');
    frame(value.requestedStep.frame);
    return value;
}
const safeCode = (code, fallback) => typeof code === 'string' && /^SCHEMA_[A-Z_]+$/.test(code) ? code : fallback;
export function createMvuSchemaRunnerV4(deps) {
    // No guest or persisted program can choose the worker path or library bytes.
    const workerUrl = new URL(deps.workerUrl ?? new URL('./tavern-mvu-schema-worker-v4.mjs', import.meta.url));
    const identity = Object.freeze(cloneSchemaData(deps.identity, 4096));
    const bridge = Object.freeze(cloneSchemaData(deps.bridge, 4096));
    const stateLoader = Object.freeze(cloneSchemaData(deps.stateLoader, 4096));
    const libraries = cloneSchemaData(deps.libraries, MVU_SCHEMA_BOUNDS.programBytes);
    let availability;
    try {
        implementation(identity);
        implementation(bridge);
        implementation(stateLoader);
        if (workerUrl.protocol !== 'file:')
            throw Error('SCHEMA_WORKER_UNAVAILABLE');
        exact(identity, ['id', 'version', 'implementationSha256', 'quickjsVersion']);
        exact(bridge, ['id', 'version', 'implementationSha256']);
        exact(stateLoader, ['id', 'version', 'implementationSha256']);
        if (!same(stateLoader, deriveOwnedStateLoaderIdentityV4(bridge)))
            throw Error('SCHEMA_STATE_LOADER_UNAVAILABLE');
        if (identity.quickjsVersion !== '0.32.0' || identity.version !== 4 || bridge.version !== 4)
            throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE');
        if (libraries.length !== 2 || new Set(libraries.map(library => library.kind)).size !== 2)
            throw Error('SCHEMA_LIBRARY_UNAVAILABLE');
        for (const library of libraries) {
            exact(library, ['kind', 'packageName', 'version', 'bundleSha256', 'globalName', 'code']);
            if (library.packageName !== library.kind || library.version !== (library.kind === 'zod' ? '4.4.3' : '4.18.1')
                || !['zod', 'lodash'].includes(library.kind) || !/^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(library.globalName)
                || schemaTextSha256(library.code) !== library.bundleSha256)
                throw Error('SCHEMA_LIBRARY_UNAVAILABLE');
        }
    }
    catch (error) {
        availability = safeCode(error instanceof Error ? error.message : undefined, 'SCHEMA_IMPLEMENTATION_UNAVAILABLE');
    }
    let disposed = false;
    let disposal;
    const active = new Map();
    function preflight(signal) {
        if (disposed)
            return unavailable('SCHEMA_RUNNER_DISPOSED');
        if (signal?.aborted)
            return cancelled();
        if (availability)
            return unavailable(availability);
        if (active.size >= 4)
            return unavailable('SCHEMA_RUNNER_BUSY');
    }
    function programData(program) {
        const frozenProgram = validateSchemaProgramV4(program);
        if (frozenProgram.compiler.version !== 4)
            throw Error('SCHEMA_IMPLEMENTATION_UNAVAILABLE');
        if (!same(frozenProgram.bridge, bridge))
            throw Error('SCHEMA_BRIDGE_UNAVAILABLE');
        if (!same(frozenProgram.stateLoader, stateLoader))
            throw Error('SCHEMA_STATE_LOADER_UNAVAILABLE');
        const supplied = libraries.map(({ code: _code, ...library }) => library);
        if (!same(frozenProgram.libraries, supplied))
            throw Error('SCHEMA_LIBRARY_UNAVAILABLE');
        for (const script of frozenProgram.scripts)
            for (const binding of script.imports) {
                const expected = binding.kind === 'native-state-loader' ? stateLoader.implementationSha256 :
                    binding.kind === 'schema-bridge' ? bridge.implementationSha256 :
                        supplied.find(library => library.kind === binding.kind)?.bundleSha256;
                if (!expected || binding.implementationSha256 !== expected)
                    throw Error('SCHEMA_IMPORT_UNAVAILABLE');
            }
        return frozenProgram;
    }
    async function executeWorker(request, signal) {
        const blocked = preflight(signal);
        if (blocked)
            return blocked;
        let worker;
        try {
            const wire = packSchemaEnvelopeV4(request, 2 * MVU_SCHEMA_BOUNDS.programBytes + MVU_SCHEMA_BOUNDS.inputBytes, evaluationBounds);
            worker = new Worker(workerUrl, { workerData: wire, env: { TZ: 'UTC' }, resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 } });
        }
        catch {
            return unavailable('SCHEMA_WORKER_UNAVAILABLE');
        }
        const closed = Promise.withResolvers();
        const execute = async () => {
            try {
                const result = await new Promise(resolve => {
                    let settled = false;
                    const finish = (value) => {
                        if (settled)
                            return;
                        settled = true;
                        clearTimeout(timer);
                        signal?.removeEventListener('abort', abort);
                        resolve(value);
                    };
                    const abort = () => finish(cancelled());
                    const timer = setTimeout(() => finish(unavailable('SCHEMA_HARD_TIMEOUT')), MVU_SCHEMA_BOUNDS.parentDeadlineMs);
                    active.set(worker, { finish: () => finish(unavailable('SCHEMA_RUNNER_DISPOSED')), closed: closed.promise });
                    signal?.addEventListener('abort', abort, { once: true });
                    worker.once('message', (message) => {
                        try {
                            const value = cloneSchemaData(message, MVU_SCHEMA_BOUNDS.outputBytes);
                            if (value.kind === 'output' || value.kind === 'trace-output')
                                exact(value, ['kind', 'json']);
                            else {
                                exact(value, ['kind', 'code']);
                                if (value.kind !== 'unavailable' || !/^SCHEMA_[A-Z_]+$/.test(value.code))
                                    throw Error();
                            }
                            finish(value);
                        }
                        catch {
                            finish(unavailable('SCHEMA_WORKER_OUTPUT_INVALID'));
                        }
                    });
                    worker.once('error', () => finish(unavailable('SCHEMA_WORKER_UNAVAILABLE')));
                    worker.once('exit', () => finish(unavailable('SCHEMA_WORKER_EXIT')));
                    if (signal?.aborted)
                        abort();
                    if (disposed)
                        finish(unavailable('SCHEMA_RUNNER_DISPOSED'));
                });
                if (signal?.aborted)
                    return cancelled();
                if (disposed)
                    return unavailable('SCHEMA_RUNNER_DISPOSED');
                return result;
            }
            finally {
                try {
                    await worker.terminate();
                }
                finally {
                    active.delete(worker);
                    closed.resolve();
                }
            }
        };
        const outcome = await execute().catch(() => unavailable('SCHEMA_WORKER_CLEANUP'));
        // The VM must actually terminate before its output can be used. Stop or
        // disposal during cleanup invalidates an already received guest message.
        return signal?.aborted ? cancelled() : disposed ? unavailable('SCHEMA_RUNNER_DISPOSED') : outcome;
    }
    async function evaluate(program, input, signal) {
        const blocked = preflight(signal);
        if (blocked)
            return blocked;
        let frozenProgram, frozenInput;
        try {
            frozenProgram = programData(program);
            frozenInput = validateSchemaEvaluationInputV4(input);
            validateSchemaScopeProgramFrameV4(frozenProgram, frozenInput.scopeReadFrame);
        }
        catch (error) {
            return unavailable(safeCode(error instanceof Error ? error.message : undefined, 'SCHEMA_INPUT_INVALID'));
        }
        const result = await executeWorker({ program: frozenProgram, input: frozenInput, libraries }, signal);
        if (signal?.aborted)
            return cancelled();
        if (disposed)
            return unavailable('SCHEMA_RUNNER_DISPOSED');
        if ('diagnostics' in result)
            return result;
        let output;
        if (result.kind === 'output') {
            try {
                output = outputData(result.json, frozenProgram, frozenInput);
            }
            catch (error) {
                return unavailable(safeCode(error instanceof Error ? error.message : undefined, 'SCHEMA_OUTPUT_INVALID'));
            }
        }
        else if (result.kind === 'unavailable')
            return unavailable(result.code);
        else
            return unavailable('SCHEMA_WORKER_OUTPUT_INVALID');
        const body = { schemaVersion: 4, encoding: 'native-mvu-author-schema-evaluation-v4',
            programSha256: frozenProgram.programSha256, runner: identity, input: frozenInput, inputSha256: recordSha256(frozenInput), output };
        try {
            return { kind: 'evaluated', evaluation: cloneSchemaData({ ...body, evaluationSha256: recordSha256(body) }, evaluationBytes, evaluationBounds) };
        }
        catch {
            return unavailable('SCHEMA_EVALUATION_LIMIT');
        }
    }
    async function evaluateTrace(program, input, signal) {
        const blocked = preflight(signal);
        if (blocked)
            return blocked;
        let frozenProgram, frozenInput;
        try {
            frozenProgram = programData(program);
            frozenInput = validateSchemaTraceInputV4(frozenProgram, input);
        }
        catch (error) {
            return unavailable(safeCode(error instanceof Error ? error.message : undefined, 'SCHEMA_TRACE_INPUT_INVALID'));
        }
        const result = await executeWorker({ program: frozenProgram, trace: frozenInput, libraries }, signal);
        if (signal?.aborted)
            return cancelled();
        if (disposed)
            return unavailable('SCHEMA_RUNNER_DISPOSED');
        if ('diagnostics' in result)
            return result;
        if (result.kind === 'unavailable')
            return unavailable(result.code);
        if (result.kind !== 'trace-output')
            return unavailable('SCHEMA_WORKER_OUTPUT_INVALID');
        try {
            if (Buffer.byteLength(result.json, 'utf8') > MVU_SCHEMA_BOUNDS.outputBytes)
                throw Error('SCHEMA_OUTPUT_LIMIT');
            const outputs = cloneSchemaData(JSON.parse(result.json), MVU_SCHEMA_BOUNDS.outputBytes);
            if (!Array.isArray(outputs) || outputs.length !== frozenInput.prefix.length + 1)
                throw Error('SCHEMA_TRACE_OUTPUT_INVALID');
            let previous = recordSha256({ programSha256: frozenProgram.programSha256, realmEpoch: frozenInput.realmEpoch,
                loadFrame: frozenInput.loadFrame });
            const records = [];
            const steps = [...frozenInput.prefix, frozenInput.requestedStep];
            for (const [index, step] of steps.entries()) {
                const output = validateSchemaGuestOutputForProgramV4(outputs[index], frozenProgram, step.frame.input);
                if (index < frozenInput.prefix.length && !same(output, frozenInput.prefix[index].output))
                    throw Error('SCHEMA_TRACE_PREFIX_MISMATCH');
                const record = traceRecord(step, index + 1, previous, output);
                records.push(record);
                previous = record.stepSha256;
            }
            const body = { schemaVersion: 4, encoding: 'native-mvu-author-schema-trace-evaluation-v4',
                programSha256: frozenProgram.programSha256, runner: identity, input: frozenInput, inputSha256: recordSha256(frozenInput), records };
            return { kind: 'evaluated-trace', evaluation: cloneSchemaEnvelopeV4({ ...body, evaluationSha256: recordSha256(body) }, traceEvaluationBytes, evaluationBounds) };
        }
        catch (error) {
            return unavailable(safeCode(error instanceof Error ? error.message : undefined, 'SCHEMA_TRACE_OUTPUT_INVALID'));
        }
    }
    return { identity, evaluate, evaluateTrace,
        async verifyEvaluation(program, evaluation, signal) {
            try {
                const stored = cloneSchemaData(evaluation, evaluationBytes, evaluationBounds);
                exact(stored, ['schemaVersion', 'encoding', 'programSha256', 'runner', 'input', 'inputSha256', 'output', 'evaluationSha256']);
                const { evaluationSha256, ...body } = stored;
                if (stored.schemaVersion !== 4 || stored.encoding !== 'native-mvu-author-schema-evaluation-v4'
                    || stored.programSha256 !== program.programSha256 || !same(stored.runner, identity)
                    || stored.inputSha256 !== recordSha256(stored.input) || evaluationSha256 !== recordSha256(body))
                    return false;
                validateSchemaGuestOutputForProgramV4(stored.output, program, validateSchemaEvaluationInputV4(stored.input));
                const actual = await evaluate(program, stored.input, signal);
                return actual.kind === 'evaluated' && same(actual.evaluation, stored);
            }
            catch {
                return false;
            }
        },
        async verifyTrace(program, evaluation, signal) {
            try {
                const stored = cloneSchemaEnvelopeV4(evaluation, traceEvaluationBytes, evaluationBounds);
                exact(stored, ['schemaVersion', 'encoding', 'programSha256', 'runner', 'input', 'inputSha256', 'records', 'evaluationSha256']);
                const { evaluationSha256, ...body } = stored;
                if (stored.schemaVersion !== 4 || stored.encoding !== 'native-mvu-author-schema-trace-evaluation-v4'
                    || stored.programSha256 !== program.programSha256 || !same(stored.runner, identity)
                    || stored.inputSha256 !== recordSha256(stored.input) || evaluationSha256 !== recordSha256(body))
                    return false;
                const input = validateSchemaTraceInputV4(program, stored.input), steps = [...input.prefix, input.requestedStep];
                if (!Array.isArray(stored.records) || stored.records.length !== steps.length)
                    return false;
                let previous = recordSha256({ programSha256: program.programSha256, realmEpoch: input.realmEpoch, loadFrame: input.loadFrame });
                for (const [index, step] of steps.entries()) {
                    const row = stored.records[index];
                    exact(row, ['ordinal', 'eventId', 'previousStepSha256', 'output', 'frameSha256', 'stepSha256']);
                    const expected = traceRecord(step, index + 1, previous, validateSchemaGuestOutputForProgramV4(row.output, program, step.frame.input));
                    if (!same(row, expected))
                        return false;
                    previous = row.stepSha256;
                }
                const actual = await evaluateTrace(program, stored.input, signal);
                return !signal?.aborted && !disposed && actual.kind === 'evaluated-trace' && same(actual.evaluation, stored);
            }
            catch {
                return false;
            }
        },
        async dispose() {
            disposed = true;
            disposal ??= (async () => {
                const workers = [...active];
                for (const [, job] of workers)
                    job.finish();
                await Promise.all(workers.map(([, job]) => job.closed));
            })();
            await disposal;
        }, };
}
