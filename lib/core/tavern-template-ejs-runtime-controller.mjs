// Generated from runtime/alpha3/src/core/tavern-template-ejs-runtime-controller.mts; edit the TypeScript source.
import { Worker, MessageChannel } from 'node:worker_threads';
import { cloneSchemaData } from './tavern-mvu-schema-data.js';
import { TEMPLATE_LIMITS_V1 } from './tavern-template-data.mjs';
import { EJS_RUNTIME_POLICY } from './tavern-template-ejs-runtime-types.mjs';
/** A bounded actor pool retains independent program realms. Resident load
 * includes programs being prepared or disposed until the Worker acknowledges. */
export function createOwnedEjsRuntimeController(deps) {
    let disposed = false, nextProgramId = 0;
    const actors = new Set();
    const check = () => {
        if (disposed)
            throw Error('TEMPLATE_EJS_RUNTIME_DISPOSED');
        deps.assertExecutionAllowed();
        return deps.current();
    };
    function createActor() {
        const worker = new Worker(new URL('./tavern-template-ejs-runtime-worker.mjs', import.meta.url), {
            workerData: { identity: deps.identity }, env: { TZ: 'UTC' }, execArgv: [],
            resourceLimits: { maxOldGenerationSizeMb: EJS_RUNTIME_POLICY.actorOldGenerationMiB, stackSizeMb: 2 }
        });
        const residents = new Map();
        const pending = new Map();
        let nextId = 0, resolveReady, rejectReady;
        let active;
        const releaseActive = (reason) => {
            if (!active)
                return;
            active.abort.abort(reason);
            active.port.removeAllListeners('message');
            active.port.close();
            active.peer.close();
            active = undefined;
        };
        const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
        let queue = ready.catch(() => { });
        const bootTimer = setTimeout(() => { void actor.retire(Error('TEMPLATE_PARENT_TIMEOUT')); }, TEMPLATE_LIMITS_V1.parentDeadlineMs);
        const actor = { residents, retired: false,
            cancel(resident, reason) {
                if (active?.resident === resident) {
                    void actor.retire(reason);
                    return;
                }
                resident.retired = true;
                for (const waiter of pending.values())
                    if (waiter.resident === resident)
                        waiter.reject(reason);
            },
            retire(reason) {
                if (actor.termination)
                    return actor.termination;
                actor.retired = true;
                clearTimeout(bootTimer);
                rejectReady(reason);
                releaseActive(reason);
                for (const resident of residents.values())
                    resident.retired = true;
                residents.clear();
                for (const waiter of pending.values())
                    waiter.reject(reason);
                actor.termination = worker.terminate().then(() => { }).finally(() => actors.delete(actor));
                return actor.termination;
            },
            async request(resident, command, signal, readCaptured) {
                const disposing = command.kind === 'dispose';
                if (!disposing)
                    check();
                signal?.throwIfAborted();
                if (actor.retired || resident.retired && !disposing)
                    throw Error('TEMPLATE_EJS_PROGRAM_RETIRED');
                const id = ++nextId;
                let timer;
                const reply = new Promise((resolve, reject) => {
                    const abort = () => { void actor.retire(Error('TEMPLATE_CANCELLED')); };
                    const clear = () => {
                        clearTimeout(timer);
                        signal?.removeEventListener('abort', abort);
                        pending.delete(id);
                        if (active?.id === id)
                            releaseActive();
                    };
                    pending.set(id, { resident,
                        resolve(value) { clear(); resolve(value); }, reject(error) { clear(); reject(error); } });
                    signal?.addEventListener('abort', abort, { once: true });
                    if (signal?.aborted)
                        abort();
                });
                queue = queue.then(async () => {
                    const waiter = pending.get(id);
                    if (!waiter)
                        return;
                    try {
                        if (!disposing)
                            check();
                        if (actor.retired || resident.retired && !disposing)
                            throw Error('TEMPLATE_EJS_PROGRAM_RETIRED');
                        timer = setTimeout(() => { void actor.retire(Error('TEMPLATE_PARENT_TIMEOUT')); }, TEMPLATE_LIMITS_V1.parentDeadlineMs);
                        const channel = new MessageChannel(), readControl = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT), control = new Int32Array(readControl), readAbort = new AbortController();
                        active = { id, resident, port: channel.port1, peer: channel.port2, abort: readAbort };
                        let ordinal = 0, reading = false;
                        channel.port1.on('message', async (message) => {
                            if (actor.retired || active?.id !== id)
                                return;
                            if (reading || message.ordinal !== ordinal + 1) {
                                void actor.retire(Error('TEMPLATE_CAPTURED_READ_PROTOCOL'));
                                return;
                            }
                            ordinal = message.ordinal;
                            reading = true;
                            let response;
                            try {
                                if (!readCaptured)
                                    throw Error('TEMPLATE_CAPTURED_READ_UNAVAILABLE');
                                const result = await readCaptured(message.request, readAbort.signal);
                                readAbort.signal.throwIfAborted();
                                response = { ordinal, kind: 'result', result: cloneSchemaData(result, TEMPLATE_LIMITS_V1.workerInputBytes, { nodes: TEMPLATE_LIMITS_V1.workerInputNodes, depth: TEMPLATE_LIMITS_V1.workerInputDepth }) };
                            }
                            catch (error) {
                                response = { ordinal, kind: 'failed', code: error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
                                        ? error.message : 'TEMPLATE_CAPTURED_READ_FAILED' };
                            }
                            if (actor.retired || active?.id !== id || readAbort.signal.aborted)
                                return;
                            // Enqueue the complete reply before publishing its completion.
                            channel.port1.postMessage(response);
                            reading = false;
                            Atomics.store(control, 0, ordinal);
                            Atomics.notify(control, 0);
                        });
                        worker.postMessage({ id, programId: resident.id, ...command, readPort: channel.port2, readControl }, [channel.port2]);
                        await reply;
                    }
                    catch (error) {
                        pending.get(id)?.reject(error);
                    }
                });
                const result = await reply;
                if (!disposing)
                    check();
                signal?.throwIfAborted();
                if (resident.retired && !disposing)
                    throw Error('TEMPLATE_EJS_PROGRAM_RETIRED');
                return result;
            },
        };
        actors.add(actor);
        worker.on('message', (reply) => {
            if (actor.retired)
                return;
            if (reply.kind === 'ready') {
                clearTimeout(bootTimer);
                resolveReady();
                return;
            }
            const waiter = pending.get(reply.id);
            if (!waiter || waiter.resident.id !== reply.programId)
                return;
            if (reply.kind === 'failed') {
                const error = Error(reply.code);
                // A reply acknowledges that this command has stopped. Its failure
                // retires only its realm; active cancellation still stops the Worker.
                waiter.resident.retired = true;
                waiter.reject(error);
                residents.delete(reply.programId);
            }
            else
                waiter.resolve(reply);
        });
        worker.once('error', () => { void actor.retire(Error('TEMPLATE_WORKER_ERROR')); });
        worker.once('exit', () => { void actor.retire(Error('TEMPLATE_WORKER_EXIT')); });
        return actor;
    }
    async function reserve(resident) {
        for (;;) {
            check();
            const available = [...actors].filter(actor => !actor.retired);
            let actor = available.find(candidate => candidate.residents.size === 0);
            if (!actor && actors.size < EJS_RUNTIME_POLICY.maxActors)
                actor = createActor();
            if (!actor)
                actor = available.sort((left, right) => left.residents.size - right.residents.size)[0];
            if (actor) {
                actor.residents.set(resident.id, resident);
                return actor;
            }
            // Terminating actors still count toward the physical Worker budget.
            await Promise.race([...actors].map(actor => actor.termination));
        }
    }
    async function start(start, signal, readCaptured) {
        check();
        signal?.throwIfAborted();
        // Detach caller-owned history before the first await. Worker replay owns
        // the complete journal budget and verification. Execution input bounds
        // apply to individual prepare/invoke packets.
        const data = start.kind === 'restore' ? structuredClone(start) : cloneSchemaData(start, TEMPLATE_LIMITS_V1.workerInputBytes, { nodes: TEMPLATE_LIMITS_V1.workerInputNodes, depth: TEMPLATE_LIMITS_V1.workerInputDepth });
        const resident = { id: ++nextProgramId, retired: false }, actor = await reserve(resident);
        const close = () => {
            if (resident.disposal)
                return resident.disposal;
            actor.cancel(resident, Error('TEMPLATE_EJS_PROGRAM_RETIRED'));
            if (actor.retired)
                return actor.termination;
            if (!actor.residents.has(resident.id))
                return Promise.resolve();
            resident.disposal = actor.request(resident, { kind: 'dispose' }).then(reply => {
                if (reply.kind !== 'disposed')
                    throw Error('TEMPLATE_EJS_WORKER_PROTOCOL');
            }).finally(() => actor.residents.delete(resident.id));
            return resident.disposal;
        };
        try {
            const created = await actor.request(resident, data, signal, readCaptured);
            if (created.kind !== 'created')
                throw Error('TEMPLATE_EJS_WORKER_PROTOCOL');
            return { creation: created.creation, creationReads: created.creationReads, dispose: close,
                async invoke(operationId, action, capture, signal, readCaptured) {
                    check();
                    signal?.throwIfAborted();
                    const packet = cloneSchemaData({ kind: 'invoke', operationId, action, ...capture ? { capture } : {} }, TEMPLATE_LIMITS_V1.workerInputBytes, { nodes: TEMPLATE_LIMITS_V1.workerInputNodes, depth: TEMPLATE_LIMITS_V1.workerInputDepth });
                    const reply = await actor.request(resident, packet, signal, readCaptured);
                    if (reply.kind !== 'invoked')
                        throw Error('TEMPLATE_EJS_WORKER_PROTOCOL');
                    return reply.output;
                }, async checkpoint(signal) {
                    const reply = await actor.request(resident, { kind: 'checkpoint' }, signal);
                    if (reply.kind !== 'checkpoint')
                        throw Error('TEMPLATE_EJS_WORKER_PROTOCOL');
                    return reply.record;
                } };
        }
        catch (error) {
            await close();
            throw error;
        }
    }
    return { identity: deps.identity, current: deps.current,
        checkCurrentSync(callback) { check(); callback(); check(); },
        async evaluateProfileConfiguration(input, signal) {
            check();
            signal?.throwIfAborted();
            const packet = cloneSchemaData(input, TEMPLATE_LIMITS_V1.workerInputBytes, { nodes: TEMPLATE_LIMITS_V1.workerInputNodes, depth: TEMPLATE_LIMITS_V1.workerInputDepth });
            const resident = { id: ++nextProgramId, retired: false }, actor = await reserve(resident);
            try {
                const reply = await actor.request(resident, { kind: 'profile-configuration', input: packet }, signal);
                if (reply.kind !== 'profile-configuration')
                    throw Error('TEMPLATE_EJS_WORKER_PROTOCOL');
                return reply.output;
            }
            finally {
                actor.residents.delete(resident.id);
            }
        },
        prepare: (input, signal, readCaptured) => start({ kind: 'prepare', input }, signal, readCaptured), restore: (record, signal) => start({ kind: 'restore', record }, signal),
        async dispose() { disposed = true; await Promise.all([...actors].map(actor => actor.retire(Error('TEMPLATE_EJS_RUNTIME_DISPOSED')))); } };
}
