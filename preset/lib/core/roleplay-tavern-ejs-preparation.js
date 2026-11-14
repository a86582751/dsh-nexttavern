// Generated from runtime/alpha3/src/core/roleplay-tavern-ejs-preparation.ts; edit the TypeScript source.
/** One Core preparation retains actual guest packets across pricing passes.
 * Source permissions and accepted publication remain with the calling owner. */
import { recordSha256 } from './roleplay-data.js';
export function createRoleplayTavernEjsPreparation(deps) {
    const packets = [], creationIds = new WeakMap(), programIds = new Set();
    let activePlan = 0;
    const checkpoint = () => { deps.signal.throwIfAborted(); deps.assertCurrent(); };
    return { retire() {
            // A discarded pricing pass cannot leave an unpublished advanced realm
            // available to the next cut. Published journal DATA restores it as needed.
            for (const id of programIds)
                deps.programs.retire(id);
            programIds.clear();
        }, beginPlan(ordinary, options) {
            const token = ++activePlan;
            let cursor = 0, finalized = false;
            const current = () => {
                checkpoint();
                if (token !== activePlan)
                    throw Error('TEMPLATE_EJS_PREPARATION_PLAN_REPLACED');
            };
            const capture = async (snapshot, macros) => {
                const ordinaryMessageView = await options?.ordinaryMessageView?.(), presetCatalog = options?.presetCatalog?.();
                return { snapshot, macros,
                    resources: deps.resources?.(snapshot) ?? [], context: deps.context,
                    ...options?.namedQueues ? { namedPromptQueues: options.namedQueues() } : {},
                    ...ordinaryMessageView ? { ordinaryMessageView } : {},
                    ...presetCatalog ? { presetCatalog } : {},
                    ordinaryNamespace: { root: ordinary.initialRoot, values: ordinary.values } };
            };
            async function memo(input, run) {
                current();
                if (finalized)
                    throw Error('TEMPLATE_EJS_PREPARATION_FINALIZED');
                const sha256 = recordSha256(input), prior = packets[cursor++];
                if (prior && prior.sha256 !== sha256)
                    throw Error('TEMPLATE_EJS_PREPARATION_PACKET_CHANGED');
                const packet = prior ?? { sha256, result: Promise.resolve().then(run) };
                if (!prior)
                    packets.push(packet);
                const result = await packet.result;
                current();
                return result;
            }
            const stage = (output) => ordinary.applyEffects(output.ordinaryWrites);
            return {
                get hasPackets() { return cursor > 0; },
                macros: ordinary.macros,
                async execute(input) {
                    const ordinal = cursor, programInstanceId = 'ejs-program-' + recordSha256({ identity: deps.identity,
                        ordinal, definition: input.definition }), runtimeInput = {
                        capture: { ...await capture(input.snapshot, input.macros),
                            ...input.context ? { context: { ...deps.context, ...input.context } } : {} }, resource: input.resource
                    };
                    programIds.add(programInstanceId);
                    const record = await memo({ kind: 'creation', input, runtimeInput }, async () => {
                        const result = await deps.programs.prepare(programInstanceId, runtimeInput, deps.identity.attemptGeneration, deps.signal);
                        const record = result.creation;
                        if (record.creation.kind !== 'rendered' || !record.creation.output.injections.length
                            && !record.creation.output.regexEffects?.length)
                            deps.programs.retire(programInstanceId);
                        return record;
                    });
                    creationIds.set(record, programInstanceId);
                    if (record.creation.kind === 'rendered')
                        stage(record.creation.output);
                    return record;
                },
                creationId(record) {
                    const id = creationIds.get(record);
                    if (!id)
                        throw Error('TEMPLATE_EJS_PREPARATION_CREATION_MISSING');
                    return id;
                },
                async invoke(input) {
                    programIds.add(input.programInstanceId);
                    const { context: _context, ...phaseCapture } = await capture(input.snapshot, input.macros);
                    const { snapshot: _snapshot, macros: _macros, consumer, ...basis } = input;
                    const request = { ...basis, generationId: deps.identity.attemptGeneration,
                        capture: phaseCapture, signal: deps.signal };
                    const result = await memo({ kind: 'invocation', consumer, request: { ...request, signal: undefined } }, () => deps.programs.invoke(request));
                    for (const invocation of result.invocations) {
                        if (invocation.result.kind !== 'evaluated')
                            throw Error(invocation.result.diagnostic.code);
                        if (!invocation.delta)
                            throw Error('INPUT_MATERIAL_INJECTION_EJS_DELTA_MISSING');
                        stage(invocation.result.output);
                    }
                    return result;
                },
                finish() {
                    current();
                    if (cursor !== packets.length)
                        throw Error('TEMPLATE_EJS_PREPARATION_PACKET_CHANGED');
                    finalized = true;
                    return { identity: deps.identity, packets: packets.map(packet => packet.sha256) };
                },
            };
        } };
}
