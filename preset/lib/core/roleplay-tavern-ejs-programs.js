// Generated from runtime/alpha3/src/core/roleplay-tavern-ejs-programs.ts; edit the TypeScript source.
/** Live realms belong to this owner. Native-published replay cuts are DATA,
 * and cannot grant Source write or component admission rights. */
import { recordSha256 } from './roleplay-data.js';
export const tavernEjsCreationHead = (creation) => recordSha256(creation);
export function appendTavernEjsJournal(head, previous, delta) {
    return Object.freeze({ head: recordSha256({ previous: head, delta }), length: (previous?.length ?? 0) + 1, previous, delta });
}
/** Full replay is materialized only for cold restoration or an explicit
 * checkpoint. Hot invocations append one immutable delta to their cut. */
export function materializeTavernEjsJournal(creation, cut) {
    const deltas = [];
    for (let cursor = cut; cursor; cursor = cursor.previous)
        deltas.push(cursor.delta);
    const phases = [];
    for (const delta of deltas.reverse()) {
        if (delta.index === 0) {
            if (delta.phase !== phases.length)
                throw Error('TEMPLATE_EJS_JOURNAL_ORDER');
            phases.push({ capture: delta.capture, actions: [] });
        }
        const phase = phases[delta.phase];
        if (!phase || phase.actions.length !== delta.index)
            throw Error('TEMPLATE_EJS_JOURNAL_ORDER');
        phase.actions.push(delta.action);
    }
    return { ...creation, phases };
}
export function createRoleplayTavernEjsPrograms(deps) {
    const entries = new Map();
    function retire(programInstanceId) {
        const entry = entries.get(programInstanceId);
        if (!entry)
            return;
        entries.delete(programInstanceId);
        // Retirement revokes access synchronously. The runtime owns asynchronous
        // Worker teardown, which never executes author callbacks or effects.
        void entry.program.dispose().catch(() => { });
    }
    async function prepare(programInstanceId, input, generationId, signal) {
        const prior = entries.get(programInstanceId);
        if (prior && prior.generationId === generationId)
            return { program: prior.program, creation: prior.creation };
        if (prior)
            retire(programInstanceId);
        const runtime = await deps.loadRuntime(undefined, signal);
        const program = await runtime.prepare(input, signal);
        const engine = structuredClone(runtime.identity);
        const creation = { schemaVersion: 1, encoding: 'ejs-host-full-replay-v1', engine,
            capture: structuredClone(input.capture), resource: structuredClone(input.resource), creation: program.creation, phases: [] };
        const entry = { program, creation, generationId, head: tavernEjsCreationHead(creation), cut: null, operations: new Map() };
        entries.set(programInstanceId, entry);
        return { program, creation };
    }
    async function invoke(input) {
        input.signal.throwIfAborted();
        let entry = entries.get(input.programInstanceId);
        const retry = entry?.generationId === input.generationId && entry.operations.get(input.operationId)?.before === input.head;
        if (entry && entry.head !== input.head && !retry) {
            retire(input.programInstanceId);
            entry = undefined;
        }
        if (!entry) {
            const runtime = await deps.loadRuntime(input.creation.engine, input.signal);
            const program = await runtime.restore(materializeTavernEjsJournal(input.creation, input.journalCut), input.signal);
            entry = { program, creation: input.creation, generationId: input.generationId, head: input.head,
                cut: input.journalCut, operations: new Map() };
            entries.set(input.programInstanceId, entry);
        }
        // Equal authoritative/head adopts a real published prefix. A different
        // generation with an unpublished advanced head took the cold branch above.
        entry.generationId = input.generationId;
        const invocations = [];
        async function run(operationId, action, capture) {
            const before = entry.head;
            const result = await entry.program.invoke(operationId, action, capture, input.signal);
            if (result.delta && !entry.operations.has(operationId)) {
                entry.cut = appendTavernEjsJournal(entry.head, entry.cut, result.delta);
                entry.head = entry.cut.head;
                entry.operations.set(operationId, { before });
            }
            invocations.push(result);
        }
        try {
            for (const disposal of input.nativeDisposals)
                await run(disposal.operationId, { kind: 'dispose', batchOrdinal: disposal.batchOrdinal });
            await run(input.operationId, input.action, input.capture);
        }
        catch (error) {
            retire(input.programInstanceId);
            throw error;
        }
        const operation = entry.operations.get(input.operationId);
        if (operation)
            operation.before = input.head;
        return { invocations };
    }
    return { prepare, invoke, retire, checkpoint: (programInstanceId) => {
            const entry = entries.get(programInstanceId);
            if (!entry)
                throw Error('INPUT_MATERIAL_INJECTION_PROGRAM_MISSING');
            return structuredClone(materializeTavernEjsJournal(entry.creation, entry.cut));
        }, dispose() { for (const id of entries.keys())
            retire(id); } };
}
