// Generated from runtime/alpha3/src/core/roleplay-opening-variants.ts; edit the TypeScript source.
/** Opening pack persistence. Native execution and publication grants belong to
 * the injected Source owner and never derive from a posted pack or operation. */
import { isDeepStrictEqual } from 'node:util';
import { recordSha256 } from './roleplay-data.js';
import { createImmutableDescriptorValidator } from './roleplay-mvu-schema-descriptor-data.js';
import { freezeMvuSchemaStoryData, sealMvuSchemaStoryFact, validateMvuSchemaNumericalSnapshot } from './roleplay-mvu-schema-story-types.js';
import { createMvuNumericalPublicationOwner, mvuNumericalPublicationMatches } from './roleplay-mvu-numerical-publication.js';
import { openingVariantSetKey, openingVariantReplacementPlanKey, openingVariantReplacementEventKey, openingVariantReplacementCompletionKey, openingVariantPendingKey, validateOpeningVariantSet, validateOpeningVariantReplacementPlan, validateOpeningVariantReplacementEvent, openingVariantReplacementEvent, openingVariantReplacementHead, openingVariantReplacementCompletion } from './roleplay-opening-variant-types.js';
const same = isDeepStrictEqual;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function fail(code) { throw Error(code); }
const operationKey = (sid, id) => `${sid}__opening-variant-operation-${id}`;
export const openingVariantContinuationKey = (sid, sha256) => `${sid}__opening-variant-continuation-${sha256}`;
export const openingVariantOperationKey = operationKey;
export function openingVariantId(source, message, index, renderedSha256) {
    return 'opening-variant-' + recordSha256({ source, message, index, renderedSha256 });
}
function codeOf(error, fallback) {
    const value = error instanceof Error ? error.message : undefined;
    return value && /^[A-Z][A-Z0-9_]{0,127}$/.test(value) ? value : fallback;
}
function requestData(input) {
    const request = freezeMvuSchemaStoryData(input), row = request.rows?.[0];
    if (!identifier(request.operationId) || !integer(request.readRevision) || !Array.isArray(request.rows)
        || request.rows.length !== 1 || !row || row.message_id !== 0
        || !['none', 'affected', 'all'].includes(request.refresh))
        fail('OPENING_VARIANT_REQUEST_INVALID');
    const packs = Object.hasOwn(row, 'swipes_data'), activate = Object.hasOwn(row, 'swipe_id');
    if (packs && activate)
        fail('OPENING_VARIANT_MIXED_MUTATION');
    if (packs ? !Array.isArray(row.swipes_data) : !activate || !integer(row.swipe_id))
        fail('OPENING_VARIANT_REQUEST_INVALID');
    if (packs && row.swipes_data.some(pack => pack !== null && !object(pack)))
        fail('OPENING_VARIANT_PACK_INVALID');
    return request;
}
export const validateOpeningVariantOperation = createImmutableDescriptorValidator((input) => {
    const operation = freezeMvuSchemaStoryData(input), { operationSha256, ...body } = operation, request = requestData(operation.request), base = validateMvuSchemaNumericalSnapshot(operation.base);
    if (operation.schemaVersion !== 1 || operation.encoding !== 'native-opening-variant-operation-v1'
        || recordSha256(body) !== operationSha256 || request.operationId !== operation.operationId
        || recordSha256(request) !== operation.requestSha256 || operation.sessionId !== operation.source.sessionId
        || operation.sessionId !== base.sessionId || !integer(operation.nativeCut)
        || operation.nativeCut < base.schemaFrontier.nativeCut || typeof operation.changed !== 'boolean'
        || operation.mode !== (request.rows[0].swipes_data === undefined ? 'activate' : 'packs')
        || !mvuNumericalPublicationMatches(operation.publicationAbsent ? undefined : operation.rawPublication, base.currentHead)) {
        fail('OPENING_VARIANT_OPERATION_INVALID');
    }
    if (operation.plan) {
        const plan = validateOpeningVariantReplacementPlan(operation.plan);
        if (operation.mode !== 'packs' || plan.operationId !== operation.operationId
            || plan.requestSha256 !== operation.requestSha256 || !same(plan.setRef, operation.setRef)
            || plan.activeVariantId !== operation.activeVariantId || !same(plan.message, operation.message)
            || plan.base.stateSnapshotSha256 !== base.stateSnapshotSha256 || plan.initialCut.nativeCut !== operation.nativeCut) {
            fail('OPENING_VARIANT_OPERATION_INVALID');
        }
    }
    return operation;
});
function initialized(pack) {
    return pack !== null && Object.hasOwn(pack, 'schema') && object(pack.stat_data);
}
function packState(pack) {
    const { stat_data: values, schema: _, ...context } = pack;
    return { values, context };
}
function entriesFor(context) {
    return context.candidates.map(candidate => {
        const prior = context.currentSet?.entries.find(entry => entry.index === candidate.index);
        return { candidate, prior, id: prior?.id ?? openingVariantId(context.source, context.message, candidate.index, candidate.renderedSha256) };
    });
}
export function openingVariantBankSnapshot(context) {
    const entries = entriesFor(context), active = entries.find(entry => entry.id === context.activeVariantId);
    if (!active)
        fail('OPENING_VARIANT_ACTIVE_UNPROVEN');
    return { swipes_data: [...context.currentPacks], swipe_id: active.candidate.index,
        variant_ids: entries.map(entry => entry.id), activeVariantId: active.id };
}
export function createRoleplayOpeningVariants(deps) {
    const publication = deps.publication ?? createMvuNumericalPublicationOwner(deps.status);
    function readOperation(sid, id) {
        const raw = deps.branch.get(operationKey(sid, id));
        if (raw === undefined)
            return;
        const operation = validateOpeningVariantOperation(raw);
        if (operation.sessionId !== sid || operation.operationId !== id)
            fail('OPENING_VARIANT_OPERATION_INVALID');
        return operation;
    }
    async function retain(table, key, value) {
        const previous = table.get(key);
        if (previous !== undefined && !same(previous, value))
            fail('OPENING_VARIANT_FACT_CONFLICT');
        if (previous !== undefined)
            return;
        try {
            await table.put(key, value);
        }
        catch { /* Resolve a lost acknowledgement at its exact address. */ }
        if (!same(table.get(key), value))
            fail('OPENING_VARIANT_WRITE_UNKNOWN');
    }
    function readSet(operation) {
        const raw = deps.branch.get(operation.setRef.key);
        if (raw === undefined || recordSha256(raw) !== operation.setRef.sha256)
            fail('OPENING_VARIANT_SET_UNPROVEN');
        const set = validateOpeningVariantSet(raw);
        if (!same(set.source, operation.source) || !same(set.opening, operation.message)
            || !set.entries.some(entry => entry.id === operation.activeVariantId))
            fail('OPENING_VARIANT_SET_UNPROVEN');
        return set;
    }
    function completed(operation) {
        const raw = deps.branch.get(openingVariantReplacementCompletionKey(operation.sessionId, operation.operationId));
        if (raw === undefined)
            return;
        if (operation.plan) {
            const completion = raw, eventRaw = deps.status.get(completion.event?.key);
            if (eventRaw === undefined || recordSha256(eventRaw) !== completion.event?.sha256)
                fail('OPENING_VARIANT_COMPLETION_UNPROVEN');
            const event = validateOpeningVariantReplacementEvent(eventRaw);
            if (!same(event.plan, operation.plan) || !same(raw, openingVariantReplacementCompletion(event))) {
                fail('OPENING_VARIANT_COMPLETION_UNPROVEN');
            }
            return { kind: 'committed', operationId: operation.operationId, replayed: true, changed: operation.changed };
        }
        const completion = freezeMvuSchemaStoryData(raw), { completionSha256, ...body } = completion;
        if (completion.schemaVersion !== 1 || completion.encoding !== 'native-opening-variant-bank-completion-v1'
            || recordSha256(body) !== completionSha256 || completion.sessionId !== operation.sessionId
            || completion.operationId !== operation.operationId || completion.operationSha256 !== operation.operationSha256
            || !same(completion.setRef, operation.setRef) || completion.activeVariantId !== operation.activeVariantId
            || completion.changed !== operation.changed)
            fail('OPENING_VARIANT_COMPLETION_UNPROVEN');
        return { kind: 'committed', operationId: operation.operationId, replayed: true, changed: operation.changed,
            ...completion.navigation ? { navigation: completion.navigation } : {} };
    }
    function confirm(sid, id) {
        try {
            const operation = readOperation(sid, id);
            if (!operation)
                return { kind: 'refused', operationId: id, code: 'OPENING_VARIANT_OPERATION_ABSENT' };
            return completed(operation) ?? { kind: 'unknown', operationId: id, code: 'OPENING_VARIANT_PENDING' };
        }
        catch (error) {
            return { kind: 'unknown', operationId: id, code: codeOf(error, 'OPENING_VARIANT_CONFIRM_UNKNOWN') };
        }
    }
    function pendingCode(sid) {
        try {
            const raw = deps.branch.get(openingVariantPendingKey(sid));
            if (raw === undefined || raw === null)
                return;
            const pointer = freezeMvuSchemaStoryData(raw), { pendingSha256, ...body } = pointer;
            if (pointer.schemaVersion !== 1 || pointer.encoding !== 'native-opening-variant-pending-v1'
                || recordSha256(body) !== pendingSha256 || pointer.sessionId !== sid
                || pointer.operation.key !== operationKey(sid, pointer.operationId))
                fail('OPENING_VARIANT_PENDING_UNPROVEN');
            // The pointer is written only after the operation is confirmed. Normal
            // reads need its exact completion, not another parse of the old plan.
            const rawCompletion = deps.branch.get(openingVariantReplacementCompletionKey(sid, pointer.operationId));
            if (rawCompletion === undefined)
                return 'OPENING_VARIANT_PENDING';
            const completion = freezeMvuSchemaStoryData(rawCompletion), { completionSha256, ...completionBody } = completion;
            if (recordSha256(completionBody) !== completionSha256 || completion.sessionId !== sid
                || completion.operationId !== pointer.operationId || !same(completion.setRef, pointer.setRef)
                || completion.activeVariantId !== pointer.activeVariantId)
                fail('OPENING_VARIANT_COMPLETION_UNPROVEN');
            if (pointer.planSha256 ? completion.encoding !== 'native-opening-variant-replacement-completion-v1'
                || completion.planSha256 !== pointer.planSha256
                : completion.encoding !== 'native-opening-variant-bank-completion-v1'
                    || completion.operationSha256 !== pointer.operationSha256)
                fail('OPENING_VARIANT_COMPLETION_UNPROVEN');
            return;
        }
        catch (error) {
            return codeOf(error, 'OPENING_VARIANT_PENDING_UNPROVEN');
        }
    }
    async function ensurePending(context, operation) {
        const sid = operation.sessionId, operationId = operation.operationId, pointer = sealMvuSchemaStoryFact({ schemaVersion: 1, encoding: 'native-opening-variant-pending-v1',
            sessionId: sid, operationId, operation: { key: operationKey(sid, operationId), sha256: recordSha256(operation) },
            operationSha256: operation.operationSha256, planSha256: operation.plan?.planSha256 ?? null,
            setRef: operation.setRef, activeVariantId: operation.activeVariantId }, 'pendingSha256'), current = deps.branch.get(openingVariantPendingKey(sid));
        if (same(current, pointer))
            return;
        const blocked = pendingCode(sid);
        if (blocked)
            fail(blocked);
        context.check();
        try {
            await deps.branch.put(openingVariantPendingKey(sid), pointer);
        }
        catch { /* Confirm the exact pointer after a lost acknowledgement. */ }
        if (!same(deps.branch.get(openingVariantPendingKey(sid)), pointer))
            fail('OPENING_VARIANT_PENDING_WRITE_UNKNOWN');
    }
    function checkBasis(context, operation) {
        context.check();
        if (context.sid !== operation.sessionId || !same(context.source, operation.source) || !same(context.message, operation.message)
            || context.base.stateSnapshotSha256 !== operation.base.stateSnapshotSha256)
            fail('OPENING_VARIANT_BASIS_CHANGED');
    }
    function priorPublication(operation) {
        return { sessionId: operation.sessionId, key: operation.publicationKey,
            raw: operation.publicationAbsent ? undefined : operation.rawPublication, leaf: operation.base.currentHead, openingVariants: null };
    }
    async function completeBank(operation, navigation = null) {
        const completion = sealMvuSchemaStoryFact({ schemaVersion: 1, encoding: 'native-opening-variant-bank-completion-v1',
            sessionId: operation.sessionId, operationId: operation.operationId, operationSha256: operation.operationSha256,
            setRef: operation.setRef, activeVariantId: operation.activeVariantId, changed: operation.changed, navigation }, 'completionSha256');
        await retain(deps.branch, openingVariantReplacementCompletionKey(operation.sessionId, operation.operationId), completion);
    }
    async function finish(context, operation, replayed) {
        try {
            checkBasis(context, operation);
            const set = readSet(operation);
            if (operation.changed)
                await ensurePending(context, operation);
            if (!operation.changed)
                await completeBank(operation);
            else if (operation.mode === 'activate') {
                if (!context.prepareActivation || !deps.activatePrepared)
                    fail('OPENING_VARIANT_ACTIVATION_UNAVAILABLE');
                const packetRef = await context.prepareActivation(operation, set);
                context.check();
                return { kind: 'activation-prepared', operation, packetRef, replayed };
            }
            else if (operation.plan) {
                const phase = await context.executeActive(operation.plan);
                context.check();
                await context.withPublication(phase, async () => {
                    context.check();
                    const event = openingVariantReplacementEvent(operation.plan, phase);
                    await retain(deps.status, openingVariantReplacementEventKey(operation.sessionId, event.eventId), event);
                    context.check();
                    const selected = { setRef: operation.setRef, activeVariantId: operation.activeVariantId }, published = await publication.replaceVariants(priorPublication(operation), selected, openingVariantReplacementHead(event));
                    if (published.kind !== 'acknowledged')
                        fail('OPENING_VARIANT_PUBLICATION_' + published.kind.toUpperCase());
                    context.check();
                    await retain(deps.branch, openingVariantReplacementCompletionKey(operation.sessionId, operation.operationId), openingVariantReplacementCompletion(event));
                });
                context.check();
                await context.adopt(phase);
            }
            else {
                const published = await publication.replaceVariants(priorPublication(operation), {
                    setRef: operation.setRef, activeVariantId: operation.activeVariantId
                }, operation.base.currentHead);
                if (published.kind !== 'acknowledged')
                    fail('OPENING_VARIANT_PUBLICATION_' + published.kind.toUpperCase());
                context.check();
                await completeBank(operation);
            }
            return { kind: 'committed', operationId: operation.operationId, replayed, changed: operation.changed };
        }
        catch (error) {
            return { kind: 'unknown', operationId: operation.operationId, code: codeOf(error, 'OPENING_VARIANT_EXECUTION_UNKNOWN') };
        }
    }
    async function resolveActivation(result, authority) {
        if (result.kind !== 'activation-prepared')
            return result;
        const { operation, replayed } = result, operationId = operation.operationId;
        try {
            if (!deps.activatePrepared)
                fail('OPENING_VARIANT_ACTIVATION_UNAVAILABLE');
            // Child creation may acquire its own Source/Agent owners. It starts only
            // after the parent transaction has returned the immutable handoff.
            const navigation = await deps.activatePrepared(result, authority);
            return await deps.withTransaction(operation.sessionId, operation.request, operation, authority, async (context) => {
                checkBasis(context, operation);
                const existing = completed(operation);
                if (existing)
                    return existing;
                context.check();
                await completeBank(operation, navigation);
                return { kind: 'committed', operationId, replayed, changed: true, navigation };
            });
        }
        catch (error) {
            return { kind: 'unknown', operationId, code: codeOf(error, 'OPENING_VARIANT_ACTIVATION_UNKNOWN') };
        }
    }
    async function prepare(context, request, requestSha256) {
        context.check();
        const row = request.rows[0], entries = entriesFor(context), current = openingVariantBankSnapshot(context), packs = row.swipes_data ?? current.swipes_data, mode = row.swipes_data === undefined ? 'activate' : 'packs';
        if (packs.length !== context.candidates.length)
            fail('OPENING_VARIANT_PACK_COUNT_INVALID');
        const activeIndex = mode === 'activate' ? row.swipe_id : current.swipe_id, active = entries.find(entry => entry.candidate.index === activeIndex);
        if (!active)
            fail('OPENING_VARIANT_INDEX_INVALID');
        if (mode === 'packs' && !initialized(packs[activeIndex] ?? null))
            fail('OPENING_VARIANT_ACTIVE_PACK_REQUIRED');
        const changed = mode === 'activate' ? activeIndex !== current.swipe_id : !same(packs, current.swipes_data);
        if (changed && mode === 'activate') {
            if (!initialized(packs[activeIndex] ?? null) || !active.prior?.continuation)
                fail('OPENING_VARIANT_NOT_INITIALIZED');
            if (!context.prepareActivation || !deps.activatePrepared)
                fail('OPENING_VARIANT_ACTIVATION_UNAVAILABLE');
        }
        const facts = [], nextEntries = [];
        for (const entry of entries) {
            const index = entry.candidate.index, pack = packs[index] ?? null, old = current.swipes_data[index] ?? null;
            let continuation = entry.prior?.continuation ?? null;
            if (!initialized(pack))
                continuation = null;
            else if (mode === 'packs' && (!continuation || !initialized(old) || !same(packState(pack), packState(old)))) {
                const fact = await context.prepareCandidate(index, pack, requestSha256);
                context.check();
                const key = openingVariantContinuationKey(context.sid, fact.sha256);
                facts.push({ key, fact });
                continuation = { key, sha256: recordSha256(fact) };
            }
            nextEntries.push({ id: entry.id, index, renderedSha256: entry.candidate.renderedSha256, pack, continuation });
        }
        const set = sealMvuSchemaStoryFact({ schemaVersion: 1, encoding: 'native-opening-variant-set-v1',
            source: context.source, opening: context.message, operationId: request.operationId, entries: nextEntries }, 'setSha256'), setRef = { key: openingVariantSetKey(context.sid, set.setSha256), sha256: recordSha256(set) };
        for (const { key, fact } of facts) {
            context.check();
            await retain(deps.branch, key, fact);
        }
        context.check();
        await retain(deps.branch, setRef.key, set);
        let plan = null;
        const activePack = packs[current.swipe_id] ?? null, currentPack = current.swipes_data[current.swipe_id] ?? null;
        if (mode === 'packs' && initialized(activePack) && (!initialized(currentPack) || !same(packState(activePack), packState(currentPack)))
            && !same(packState(activePack), { values: context.base.values, context: context.base.context })) {
            plan = validateOpeningVariantReplacementPlan(await context.makePlan(setRef, active.id, activePack, requestSha256));
            context.check();
            await retain(deps.branch, openingVariantReplacementPlanKey(context.sid, request.operationId), plan);
        }
        return validateOpeningVariantOperation(sealMvuSchemaStoryFact({ schemaVersion: 1,
            encoding: 'native-opening-variant-operation-v1', sessionId: context.sid, operationId: request.operationId,
            mode, request, requestSha256, source: context.source, message: context.message, nativeCut: context.nativeCut,
            base: context.base, publicationKey: context.publication.key, publicationAbsent: context.publication.raw === undefined,
            rawPublication: context.publication.raw ?? null, setRef, activeVariantId: active.id, changed, plan }, 'operationSha256'));
    }
    async function mutate(sid, input, authority) {
        const operationId = input?.operationId ?? '';
        let retainedOperation = false;
        try {
            const request = requestData(input), requestSha256 = recordSha256(request), existing = readOperation(sid, request.operationId);
            if (existing) {
                if (existing.requestSha256 !== requestSha256)
                    return { kind: 'refused', operationId, code: 'OPENING_VARIANT_OPERATION_CONFLICT' };
                return completed(existing) ?? { kind: 'unknown', operationId, code: 'OPENING_VARIANT_PENDING' };
            }
            const result = await deps.withTransaction(sid, request, undefined, authority, async (context) => {
                const raced = readOperation(sid, request.operationId);
                if (raced) {
                    if (raced.requestSha256 !== requestSha256)
                        return { kind: 'refused', operationId, code: 'OPENING_VARIANT_OPERATION_CONFLICT' };
                    return completed(raced) ?? { kind: 'unknown', operationId, code: 'OPENING_VARIANT_PENDING' };
                }
                const blocked = pendingCode(sid);
                if (blocked)
                    return { kind: 'refused', operationId, code: blocked };
                let operation;
                try {
                    operation = await prepare(context, request, requestSha256);
                }
                catch (error) {
                    return { kind: 'refused', operationId, code: codeOf(error, 'OPENING_VARIANT_PREPARATION_FAILED') };
                }
                context.check();
                await retain(deps.branch, operationKey(sid, operationId), operation);
                retainedOperation = true;
                return finish(context, operation, false);
            });
            return resolveActivation(result, authority);
        }
        catch (error) {
            return { kind: retainedOperation ? 'unknown' : 'refused', operationId,
                code: codeOf(error, 'OPENING_VARIANT_MUTATION_UNKNOWN') };
        }
    }
    async function retry(sid, operationId, authority) {
        try {
            const operation = readOperation(sid, operationId);
            if (!operation)
                return { kind: 'refused', operationId, code: 'OPENING_VARIANT_OPERATION_ABSENT' };
            const existing = completed(operation);
            if (existing)
                return existing;
            const result = await deps.withTransaction(sid, operation.request, operation, authority, context => finish(context, operation, true));
            return resolveActivation(result, authority);
        }
        catch (error) {
            return { kind: 'unknown', operationId, code: codeOf(error, 'OPENING_VARIANT_RETRY_UNKNOWN') };
        }
    }
    return { mutate, retry, confirm, pendingCode, snapshot: openingVariantBankSnapshot };
}
