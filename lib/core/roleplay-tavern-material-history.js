// Generated from runtime/alpha3/src/core/roleplay-tavern-material-history.ts; edit the TypeScript source.
/** Read the exact Core records bound by real Native material events once.
 * These historical facts grant no new step, claim, Source or dispatch rights. */
import { nativeInputSha256, reconstructNativeRequestMaterialV1, validateNativeOpeningInvocationV1, validateNativeOpeningRequestAttemptV1 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { roleplayOpeningMaterialKeysV1 } from './roleplay-opening-material.js';
import { programOpeningInputKeyV1, validateProgramOpeningSeedV1, validateProgramOpeningInputV1 } from './roleplay-program-opening-records.js';
function fail(code) { throw Error(code); }
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
const budgetV1 = () => ({ bytes: 0, rows: new Map(), inputs: new Map(), invocations: new Map() });
const sameNative = (left, right) => nativeInputSha256(left) === nativeInputSha256(right);
const positive = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function exact(value, keys) {
    if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))
        fail('INPUT_MATERIAL_HISTORY_OPENING_SCHEMA_INVALID');
}
function openingDataRef(value) {
    exact(value, ['key', 'sha256']);
    if (typeof value['key'] !== 'string' || !hash(value['sha256']))
        fail('INPUT_MATERIAL_HISTORY_OPENING_REF_INVALID');
}
function rememberReference(references, ref) {
    const previous = references.get(ref.key);
    if (previous && previous !== ref.sha256)
        fail('INPUT_MATERIAL_HISTORY_CORE_REF_CONFLICT');
    references.set(ref.key, ref.sha256);
}
function charge(budget, value) {
    budget.bytes += Buffer.byteLength(JSON.stringify(value), 'utf8');
    if (budget.bytes > 67_108_864)
        fail('INPUT_MATERIAL_HISTORY_CORE_BUDGET');
}
function readOpeningInput(deps, ref, budget) {
    const raw = deps.table.get(ref.key);
    if (recordSha256(raw) !== ref.sha256)
        fail('INPUT_MATERIAL_HISTORY_OPENING_INPUT_CHANGED');
    const previous = budget.inputs.get(ref.key);
    if (previous) {
        if (previous.sha256 !== ref.sha256)
            fail('INPUT_MATERIAL_HISTORY_CORE_REF_CONFLICT');
        return previous.value;
    }
    if (budget.inputs.size >= 8192)
        fail('INPUT_MATERIAL_HISTORY_CORE_BUDGET');
    const value = freeze(cloneRoleplayTavernLoreDataV1(raw, 16_777_216, { nodes: 131072, depth: 66 }));
    charge(budget, value);
    budget.inputs.set(ref.key, { sha256: ref.sha256, value });
    return value;
}
function assertOpeningInputsCurrent(deps, budget) {
    // Timed producers define coreRefs as snapshot/plan refs. Preserve that
    // catalog, while separately guarding all exact immutable seed/input rows.
    for (const [key, ref] of budget.inputs)
        if (recordSha256(deps.table.get(key)) !== ref.sha256)
            fail('INPUT_MATERIAL_HISTORY_OPENING_INPUT_CHANGED');
}
function openingInvocation(row, events, event, budget) {
    exact(row.nativeOwner, ['kind', 'identity', 'invocationRef']);
    exact(row.nativeOwner.invocationRef, ['seq', 'sha256']);
    const ref = row.nativeOwner.invocationRef, seq = ref.seq, actual = events[seq];
    if (!Number.isSafeInteger(seq) || seq < 0 || seq >= event.seq || !hash(ref.sha256)
        || actual?.type !== 'opening/invocation' || Number(actual.seq) !== seq || nativeInputSha256(actual) !== ref.sha256)
        fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_UNPROVEN');
    let invocation = budget.invocations.get(seq);
    if (!invocation) {
        invocation = validateNativeOpeningInvocationV1(actual.data);
        if (invocation.prefix.eventCount !== seq || nativeInputSha256(events.slice(0, seq)) !== invocation.prefix.sha256)
            fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_PREFIX_CHANGED');
        // A historical cut may end before opening completion. It proves only the
        // publication prefix, never a generated receipt or cold dispatch right.
        for (const candidate of events)
            if (candidate.type === 'opening/invocation') {
                const other = validateNativeOpeningInvocationV1(candidate.data);
                if (candidate !== actual && (other.identity.operationId === invocation.identity.operationId
                    || other.identity.messageId === invocation.identity.messageId))
                    fail('INPUT_MATERIAL_HISTORY_OPENING_INVOCATION_AMBIGUOUS');
            }
        budget.invocations.set(seq, invocation);
    }
    if (row.nativeOwner.kind !== 'programmatic-opening' || !sameNative(row.identity, invocation.identity)
        || !sameNative(row.nativeOwner.identity, invocation.identity) || invocation.identity.sessionId !== row.sessionId
        || invocation.expectedTurn !== row.turn || !sameNative(invocation.identity.intentRef, row.seedRef))
        fail('INPUT_MATERIAL_HISTORY_OPENING_IDENTITY_CHANGED');
    return { invocation, seq };
}
function openingPublicationPrefix(row, events, event, budget) {
    const { seq } = openingInvocation(row, events, event, budget), prefix = events.slice(seq + 1, Number(event.seq) + 1), starts = prefix.filter(value => value.type === 'turn/start'), stepStarts = prefix.filter(value => value.type === 'step/start'), stepEnds = prefix.filter(value => value.type === 'step/end');
    if (starts.length !== 1 || starts[0].data.turn !== row.turn || Object.keys(starts[0].data).length !== 1
        || prefix.some(value => value.type === 'turn/end' || value.type === 'user/message' || value.type === 'opening/invocation'
            || value.type === 'opening/generated-receipt' || value.type === 'opening/closing-ack')
        || row.step > 256 || stepStarts.length !== row.step || stepEnds.length !== row.step - 1)
        fail('INPUT_MATERIAL_HISTORY_OPENING_STEP_UNPROVEN');
    for (let index = 0; index < stepStarts.length; index++) {
        const start = stepStarts[index], end = stepEnds[index];
        if (start.data.turn !== row.turn || start.data.step !== index + 1 || start.seq <= starts[0].seq
            || index > 0 && start.seq <= stepEnds[index - 1].seq
            || end && (end.data.turn !== row.turn || end.data.step !== index + 1 || end.seq <= start.seq))
            fail('INPUT_MATERIAL_HISTORY_OPENING_STEP_UNPROVEN');
    }
    let requestCount = 0;
    for (let stepIndex = 0; stepIndex < stepStarts.length; stepIndex++) {
        const step = stepIndex + 1, start = stepStarts[stepIndex], end = stepEnds[stepIndex], local = events.slice(Number(start.seq) + 1, end ? Number(end.seq) : Number(event.seq) + 1), attempts = local.filter(value => value.type === 'opening/request-attempt'), materials = local.filter(value => value.type === 'request/material');
        if (!attempts.length || attempts.length !== materials.length || !end && materials.at(-1) !== event)
            fail('INPUT_MATERIAL_HISTORY_OPENING_ATTEMPT_UNPROVEN');
        let assemblySha256;
        for (let index = 0; index < attempts.length; index++) {
            if (++requestCount > 256)
                fail('INPUT_MATERIAL_HISTORY_OPENING_ATTEMPT_LIMIT');
            const attemptEvent = attempts[index], attempt = validateNativeOpeningRequestAttemptV1(attemptEvent.data), material = materials[index];
            if (attempt.turn !== row.turn || attempt.step !== step || attempt.attempt !== index + 1
                || !sameNative(attempt.invocationRef, row.nativeOwner.invocationRef) || attemptEvent.seq >= material.seq
                || index > 0 && attemptEvent.seq <= materials[index - 1].seq
                || material.data.turn !== row.turn || material.data.step !== step
                || assemblySha256 !== undefined && attempt.assemblySha256 !== assemblySha256)
                fail('INPUT_MATERIAL_HISTORY_OPENING_ATTEMPT_CHANGED');
            assemblySha256 = attempt.assemblySha256;
        }
    }
}
function verifyOpeningRows(deps, event, snapshot, plan, events, budget) {
    for (const field of ['identity', 'seedRef', 'inputRef', 'nativeOwner']) {
        if (!sameNative(snapshot[field], plan[field]))
            fail('INPUT_MATERIAL_HISTORY_OPENING_BINDING_CHANGED');
    }
    openingDataRef(snapshot.seedRef);
    openingDataRef(snapshot.inputRef);
    const keys = roleplayOpeningMaterialKeysV1(snapshot.sessionId, snapshot.seedRef, snapshot.turn, snapshot.step);
    if (event.data.snapshot.key !== keys.snapshot || event.data.plan.key !== keys.plan)
        fail('INPUT_MATERIAL_HISTORY_OPENING_KEY_CHANGED');
    const seed = validateProgramOpeningSeedV1(readOpeningInput(deps, snapshot.seedRef, budget)), input = validateProgramOpeningInputV1(readOpeningInput(deps, snapshot.inputRef, budget), seed);
    if (seed.production !== 'generated-opening' || seed.sessionId !== snapshot.sessionId
        || snapshot.inputRef.key !== programOpeningInputKeyV1(seed.sessionId, seed.operationId)
        || seed.operationId !== snapshot.identity.operationId || seed.requestedMessageId !== snapshot.identity.messageId
        || seed.instructionSha256 !== snapshot.identity.instructionSha256 || input.instruction !== snapshot.identity.instruction
        || !sameNative(input.seedRef, snapshot.seedRef))
        fail('INPUT_MATERIAL_HISTORY_OPENING_INPUT_IDENTITY_CHANGED');
    exact(plan.payload, ['promptPlan', 'nativeTransform', 'nativeTransformSha256']);
    if (!object(plan.payload.promptPlan) || !object(plan.payload.nativeTransform)
        || nativeInputSha256(plan.payload.nativeTransform) !== plan.payload.nativeTransformSha256)
        fail('INPUT_MATERIAL_HISTORY_OPENING_TRANSFORM_CHANGED');
    openingPublicationPrefix(snapshot, events, event, budget);
}
function readPublication(deps, event, ownerSessionId, references, budget, events) {
    const opening = event.data.snapshot.key.startsWith(`${ownerSessionId}__program-opening-material-`), prefix = opening ? `${ownerSessionId}__program-opening-material-` : `${ownerSessionId}__tavern-prompt-v1-`;
    const read = (ref, kind) => {
        if (!ref.key.startsWith(prefix))
            fail('INPUT_MATERIAL_HISTORY_CORE_OWNER_UNPROVEN');
        const raw = deps.table.get(ref.key);
        if (recordSha256(raw) !== ref.sha256)
            fail('INPUT_MATERIAL_HISTORY_CORE_ROW_CHANGED');
        const priorRow = budget.rows.get(ref.key), row = priorRow ?? cloneRoleplayTavernLoreDataV1(raw, 16_777_216, { nodes: 131072, depth: 66 });
        if (!object(row) || row.schemaVersion !== 1 || row.authority !== 'consumer-data-only' || row.sessionId !== ownerSessionId
            || row.kind !== kind || row.turn !== event.data.turn || row.step !== event.data.step
            || !object(row.payload))
            fail('INPUT_MATERIAL_HISTORY_CORE_SCHEMA_INVALID');
        if (opening) {
            exact(row, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'identity', 'seedRef',
                'inputRef', 'nativeOwner', 'turn', 'step', 'kind', 'payload']);
            if (row.encoding !== 'core-program-opening-material-record-v1' || !positive(row.turn) || !positive(row.step)
                || !object(row.identity) || !object(row.nativeOwner) || !object(row.seedRef) || !object(row.inputRef))
                fail('INPUT_MATERIAL_HISTORY_OPENING_SCHEMA_INVALID');
        }
        else if (row.encoding !== 'core-input-material-record-v1' || row.branchId !== ownerSessionId
            || !object(row.currency) || row.currency.schemaVersion !== 2)
            fail('INPUT_MATERIAL_HISTORY_CORE_SCHEMA_INVALID');
        rememberReference(references, ref);
        const result = freeze(row);
        if (!priorRow) {
            budget.bytes += Buffer.byteLength(JSON.stringify(result), 'utf8');
            if (budget.bytes > 67_108_864 || budget.rows.size >= 8192)
                fail('INPUT_MATERIAL_HISTORY_CORE_BUDGET');
            budget.rows.set(ref.key, result);
        }
        return result;
    };
    const snapshot = read(event.data.snapshot, 'snapshot'), plan = read(event.data.plan, 'plan');
    if (opening)
        verifyOpeningRows(deps, event, snapshot, plan, events, budget);
    else
        for (const field of ['currency', 'preparation', 'originalInputRefs']) {
            if (recordSha256(snapshot[field]) !== recordSha256(plan[field]))
                fail('INPUT_MATERIAL_HISTORY_CORE_BINDING_CHANGED');
        }
    return { event, snapshot, plan };
}
const coreOwner = (key) => /^([a-zA-Z0-9_-]{1,128})__(?:tavern-prompt-v1-|program-opening-material-)/.exec(key)?.[1];
const ownsCoreKey = (key, sid) => key.startsWith(`${sid}__tavern-prompt-v1-`)
    || key.startsWith(`${sid}__program-opening-material-`);
function captureMaterialHistory(deps, completePrefix) {
    deps.assertOwnerCurrent();
    const events = deps.events(), prefixLength = events.length, prefixSha256 = nativeInputSha256(events), projections = [...deps.projections()], references = new Map(), budget = budgetV1(), publications = [];
    for (const raw of events) {
        if (raw.type !== 'request/material')
            continue;
        const event = raw, owner = completePrefix ? coreOwner(event.data.snapshot.key) : deps.sessionId, planOwner = completePrefix ? coreOwner(event.data.plan.key) : deps.sessionId, ownsSnapshot = completePrefix ? !!owner : ownsCoreKey(event.data.snapshot.key, deps.sessionId), ownsPlan = completePrefix ? !!planOwner : ownsCoreKey(event.data.plan.key, deps.sessionId);
        if (ownsSnapshot !== ownsPlan)
            fail('INPUT_MATERIAL_HISTORY_CORE_OWNER_UNPROVEN');
        if (!ownsPlan)
            continue;
        if (owner !== planOwner)
            fail('INPUT_MATERIAL_HISTORY_CORE_OWNER_UNPROVEN');
        if (publications.length >= 4096)
            fail('INPUT_MATERIAL_HISTORY_LIMIT');
        reconstructNativeRequestMaterialV1({ materialEvent: event, events, projections,
            expectedHeaderSha256: event.data.header.sha256 });
        publications.push(readPublication(deps, event, owner, references, budget, events));
    }
    const assertCurrent = () => {
        deps.assertOwnerCurrent();
        const actual = deps.events(), actualProjections = deps.projections();
        // Own Native appends may extend this prefix during retry. Native's real
        // selected capability checks those additions; old bytes stay immutable.
        if (actual.length < prefixLength || nativeInputSha256(actual.slice(0, prefixLength)) !== prefixSha256
            || actualProjections.length !== projections.length || actualProjections.some((item, index) => item !== projections[index]))
            fail('INPUT_MATERIAL_HISTORY_CHANGED');
        for (const [key, sha256] of references)
            if (recordSha256(deps.table.get(key)) !== sha256)
                fail('INPUT_MATERIAL_HISTORY_CORE_ROW_CHANGED');
        assertOpeningInputsCurrent(deps, budget);
    };
    assertCurrent();
    return { events: freeze([...events]), publications: freeze(publications), assertCurrent, evidence: freeze({ schemaVersion: 1,
            encoding: 'native-bound-Core-material-history-v1', authority: 'consumer-data-only', sessionId: deps.sessionId,
            prefixLength, prefixSha256, coreRefs: [...references].map(([key, sha256]) => ({ key, sha256 })) }) };
}
export const captureRoleplayTavernMaterialHistoryV1 = (deps) => captureMaterialHistory(deps, false);
/** Complete factual catalog at a real cut. This is used by Source freeze;
 * current request injection consumers always use the separate own catalog. */
export const captureRoleplayTavernMaterialPrefixV1 = (deps) => captureMaterialHistory(deps, true);
/** Data rows at a Native cut, still over the actual Session's retained bytes.
 * Child inheritance does not restore a parent's live injection registry. */
export function tavernMaterialPublicationRefsV1(history) {
    history.assertCurrent();
    return freeze(history.publications.map(({ event, snapshot }) => ({ ownerSessionId: snapshot.sessionId,
        nativeSeq: Number(event.seq), nativeEventSha256: nativeInputSha256(event),
        snapshotRef: event.data.snapshot, planRef: event.data.plan, nativeRecordSha256: nativeInputSha256(event.data) })));
}
export function captureRoleplayTavernInheritedMaterialHistoryV1(deps) {
    deps.assertOwnerCurrent();
    const actualEvents = deps.events(), cut = deps.inheritedEventCount, projections = [...deps.projections()], references = new Map(), budget = budgetV1(), publications = [], seen = new Set();
    if (!Number.isSafeInteger(cut) || cut < 0 || cut > actualEvents.length || deps.publications.length > 4096)
        fail('INPUT_MATERIAL_HISTORY_INHERITED_CUT_INVALID');
    const events = actualEvents.slice(0, cut), prefixSha256 = nativeInputSha256(events);
    let previousNativeSeq = -1;
    for (const original of deps.publications) {
        const ref = cloneRoleplayTavernLoreDataV1(original, 8192);
        if (!Number.isSafeInteger(ref.nativeSeq) || ref.nativeSeq <= previousNativeSeq || ref.nativeSeq >= cut || seen.has(ref.nativeSeq)
            || typeof ref.ownerSessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(ref.ownerSessionId)
            || ref.ownerSessionId === deps.sessionId)
            fail('INPUT_MATERIAL_HISTORY_INHERITED_REF_INVALID');
        seen.add(ref.nativeSeq);
        previousNativeSeq = ref.nativeSeq;
        const event = events[ref.nativeSeq];
        if (event?.type !== 'request/material' || nativeInputSha256(event) !== ref.nativeEventSha256
            || nativeInputSha256(event.data) !== ref.nativeRecordSha256
            || recordSha256(event.data.snapshot) !== recordSha256(ref.snapshotRef)
            || recordSha256(event.data.plan) !== recordSha256(ref.planRef))
            fail('INPUT_MATERIAL_HISTORY_INHERITED_REF_CHANGED');
        reconstructNativeRequestMaterialV1({ materialEvent: event, events, projections,
            expectedHeaderSha256: event.data.header.sha256 });
        publications.push(readPublication(deps, event, ref.ownerSessionId, references, budget, events));
    }
    for (const event of events)
        if (event.type === 'request/material') {
            const sourceOwner = coreOwner(event.data.snapshot.key), planOwner = coreOwner(event.data.plan.key);
            if (!!sourceOwner !== !!planOwner || sourceOwner !== planOwner || sourceOwner && !seen.has(Number(event.seq)))
                fail('INPUT_MATERIAL_HISTORY_INHERITED_CATALOG_INCOMPLETE');
        }
    const assertCurrent = () => {
        deps.assertOwnerCurrent();
        const current = deps.events(), currentProjections = deps.projections();
        if (current.length < cut || nativeInputSha256(current.slice(0, cut)) !== prefixSha256
            || currentProjections.length !== projections.length || currentProjections.some((value, index) => value !== projections[index]))
            fail('INPUT_MATERIAL_HISTORY_INHERITED_CHANGED');
        for (const [key, sha256] of references)
            if (recordSha256(deps.table.get(key)) !== sha256)
                fail('INPUT_MATERIAL_HISTORY_CORE_ROW_CHANGED');
        assertOpeningInputsCurrent(deps, budget);
    };
    assertCurrent();
    return { events: freeze(events), publications: freeze(publications), assertCurrent, evidence: freeze({ schemaVersion: 1,
            encoding: 'native-inherited-Core-material-history-v1', authority: 'consumer-data-only', sessionId: deps.sessionId,
            prefixLength: cut, prefixSha256, coreRefs: [...references].map(([key, sha256]) => ({ key, sha256 })) }) };
}
