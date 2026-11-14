// Generated from runtime/alpha3/src/core/tavern-template-ejs-runtime-controller.mts; edit the TypeScript source.
import { Worker } from 'node:worker_threads';
import { cloneSchemaData, cloneSchemaDescriptorData } from './tavern-mvu-schema-data.js';
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
        const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
        let queue = ready.catch(() => { });
        const bootTimer = setTimeout(() => { void actor.retire(Error('TEMPLATE_PARENT_TIMEOUT')); }, TEMPLATE_LIMITS_V1.parentDeadlineMs);
        const actor = { residents, retired: false,
            cancel(resident, reason) {
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
                for (const resident of residents.values())
                    resident.retired = true;
                residents.clear();
                for (const waiter of pending.values())
                    waiter.reject(reason);
                actor.termination = worker.terminate().then(() => { }).finally(() => actors.delete(actor));
                return actor.termination;
            },
            async request(resident, command, signal) {
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
                    const clear = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(id); };
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
                        worker.postMessage({ id, programId: resident.id, ...command });
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
                actor.cancel(waiter.resident, error);
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
    async function start(start, signal) {
        check();
        signal?.throwIfAborted();
        const clone = start.kind === 'restore' ? cloneSchemaDescriptorData : cloneSchemaData;
        const data = clone(start, start.kind === 'restore' ? TEMPLATE_LIMITS_V1.injectionInputBytes :
            TEMPLATE_LIMITS_V1.workerInputBytes, { nodes: TEMPLATE_LIMITS_V1.workerInputNodes, depth: TEMPLATE_LIMITS_V1.workerInputDepth });
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
            const created = await actor.request(resident, data, signal);
            if (created.kind !== 'created')
                throw Error('TEMPLATE_EJS_WORKER_PROTOCOL');
            return { creation: created.creation, dispose: close,
                async invoke(operationId, action, capture, signal) {
                    check();
                    signal?.throwIfAborted();
                    const packet = cloneSchemaData({ kind: 'invoke', operationId, action, ...capture ? { capture } : {} }, TEMPLATE_LIMITS_V1.workerInputBytes, { nodes: TEMPLATE_LIMITS_V1.workerInputNodes, depth: TEMPLATE_LIMITS_V1.workerInputDepth });
                    const reply = await actor.request(resident, packet, signal);
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
        prepare: (input, signal) => start({ kind: 'prepare', input }, signal), restore: (record, signal) => start({ kind: 'restore', record }, signal),
        async dispose() { disposed = true; await Promise.all([...actors].map(actor => actor.retire(Error('TEMPLATE_EJS_RUNTIME_DISPOSED')))); } };
}
