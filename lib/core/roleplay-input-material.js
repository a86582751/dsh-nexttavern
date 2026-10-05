// Generated from runtime/alpha3/src/core/roleplay-input-material.ts; edit the TypeScript source.
/** Hot material data belongs to one existing Core input binding. Persisted
 * records can explain a request; they cannot recreate this owner after resume. */
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256, keyOf } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
/** One preparation budget covers lock waits, deterministic workers and record
 * publication. Nested work cannot renew it by starting another evaluator. */
export const ROLEPLAY_INPUT_MATERIAL_LIMITS_V1 = Object.freeze({ deadlineMs: 15_000 });
function fail(code) { throw Error(code); }
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'INPUT_MATERIAL_PREPARATION_REFUSED';
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
/** This factory is invoked only inside the original Core bind closure. The
 * scope callback refuses before revealing a reconstructed or foreign step. */
export function createRoleplayInputMaterialOwnerV1(deps, owner) {
    const disposal = new AbortController();
    const controllers = new Set();
    const preparations = new Set();
    let ready;
    const outside = new WeakSet();
    function clearReady() {
        const previous = ready;
        ready = undefined;
        previous?.checks.release();
    }
    function current(row) {
        if (disposal.signal.aborted)
            fail('INPUT_MATERIAL_OWNER_DISPOSED');
        row.checks.assertCurrent();
        // Domain keeps these stored DATA objects immutable. A replaced record is
        // a different observation; its full hash was checked once after writing.
        if (owner.table.get(row.snapshot.key) !== row.records.snapshot
            || owner.table.get(row.plan.key) !== row.records.plan)
            fail('INPUT_MATERIAL_RECORD_CHANGED');
    }
    const requestMaterial = { schemaVersion: 1, sectionNames: deps.sectionNames,
        prepare(input) {
            const controller = new AbortController();
            const began = performance.now();
            let preparing = true;
            const timer = setTimeout(() => controller.abort(Error('INPUT_MATERIAL_PREPARATION_DEADLINE')), ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs);
            controllers.add(controller);
            const operation = (async () => {
                let releaseBuild;
                try {
                    const original = owner.scope(input);
                    if (disposal.signal.aborted)
                        fail('INPUT_MATERIAL_OWNER_DISPOSED');
                    if (original.stepToken.kind !== 'story') {
                        outside.add(original.stepToken);
                        clearReady();
                        return { kind: 'unchanged' };
                    }
                    if (ready?.token === original.stepToken) {
                        current(ready);
                        if (nativeInputSha256(input.selected) !== nativeInputSha256(ready.initial.selected)
                            || input.assemblySha256 !== ready.initial.assemblySha256)
                            fail('INPUT_MATERIAL_PREPARATION_CHANGED');
                        return { kind: 'prepared' };
                    }
                    clearReady();
                    const prefix = keyOf(original.session.id, `tavern-prompt-v1-${original.currency.preparationId}-${original.currency.attemptGeneration}-${original.step}`);
                    const signal = AbortSignal.any([original.signal, disposal.signal, controller.signal]);
                    const assertBudgetAndSignal = () => {
                        signal.throwIfAborted();
                        if (preparing && performance.now() - began >= ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs) {
                            controller.abort(Error('INPUT_MATERIAL_PREPARATION_DEADLINE'));
                            signal.throwIfAborted();
                        }
                    };
                    const scope = { ...original, signal,
                        outputRows: [...original.outputRows ?? [], { table: 'branch', key: prefix + '-snapshot' }, { table: 'branch', key: prefix + '-plan' }],
                        assertCurrent() {
                            assertBudgetAndSignal();
                            // The scope proves the live input binder. Package byte verification
                            // belongs to the outer material checkpoint, not every scope read.
                            original.assertCurrent();
                        }, assertOwnerFactsCurrent() {
                            // Facts obey the same combined cancellation and monotonic budget.
                            // They cannot publish ready or bypass the Native/material gate.
                            assertBudgetAndSignal();
                            original.assertOwnerFactsCurrent();
                        } };
                    const data = await deps.prepare(input, scope);
                    if (data.kind === 'prepared-data')
                        releaseBuild = data.release.bind(data);
                    scope.signal.throwIfAborted();
                    scope.assertOwnerFactsCurrent();
                    if (data.kind === 'refused')
                        return { kind: 'blocked', code: data.code };
                    if (data.kind === 'outside-declared-domain') {
                        outside.add(scope.stepToken);
                        return { kind: 'unchanged' };
                    }
                    const checks = { assertCurrent: data.assertCurrent.bind(data), assertSelected: data.assertSelected.bind(data),
                        release: data.release.bind(data) };
                    checks.assertSelected(input.selected, true);
                    // The recorded plan and the live transform must use the same detached,
                    // frozen values. A producer's later array mutation cannot alter wire
                    // content while the persisted explanatory record remains unchanged.
                    const material = freeze(cloneRoleplayTavernLoreDataV1({ requiredSections: data.requiredSections,
                        sections: data.sections, insertions: data.insertions,
                        ...data.anchoredInsertions ? { anchoredInsertions: data.anchoredInsertions } : {} }, 4_194_304, { nodes: 131072, depth: 66 }));
                    const materialSha256 = nativeInputSha256(material);
                    const basis = { schemaVersion: 1, encoding: 'core-input-material-record-v1',
                        authority: 'consumer-data-only', sessionId: scope.session.id, branchId: scope.session.id,
                        preparation: scope.preparation, currency: scope.currency, originalInputRefs: scope.originalInputRefs,
                        turn: scope.turn, step: scope.step };
                    const snapshot = Object.freeze({ ...basis, kind: 'snapshot', payload: data.snapshot });
                    const plan = Object.freeze({ ...basis, kind: 'plan', payload: Object.freeze({ promptPlan: data.plan,
                            nativeTransform: material, nativeTransformSha256: materialSha256 }) });
                    const refs = { snapshot: { key: prefix + '-snapshot', sha256: recordSha256(snapshot) },
                        plan: { key: prefix + '-plan', sha256: recordSha256(plan) } };
                    const records = {};
                    await owner.enqueue(async () => {
                        checks.assertCurrent();
                        for (const [kind, record] of [['snapshot', snapshot], ['plan', plan]]) {
                            const ref = refs[kind], old = owner.table.get(ref.key);
                            if (old !== undefined && old !== null && recordSha256(old) !== ref.sha256)
                                fail('INPUT_MATERIAL_RECORD_CONFLICT');
                            const fact = { key: ref.key, value: record, sha256: ref.sha256,
                                kind: kind === 'snapshot' ? 'input-material-snapshot' : 'input-material-plan' };
                            // Only this original writer registers the explanatory output. A
                            // thrown put leaves writing data and never becomes Ready.
                            owner.registerNonNumericalBranchRow?.(input, scope, { ...fact, phase: 'writing' });
                            if (old === undefined || old === null)
                                await owner.table.put(ref.key, record);
                            const readback = owner.table.get(ref.key);
                            if (recordSha256(readback) !== ref.sha256)
                                fail('INPUT_MATERIAL_WRITE_UNCONFIRMED');
                            records[kind] = readback;
                            owner.registerNonNumericalBranchRow?.(input, scope, { ...fact, phase: 'written' });
                            // Readback precedes the cheap owner checkpoint. Both rows must
                            // complete before any Ready object can reach Native.
                            checks.assertCurrent();
                        }
                    });
                    const row = { token: scope.stepToken, scope, initial: input, checks, material, materialSha256, ...refs,
                        records: { snapshot: records.snapshot, plan: records.plan },
                        captureSha256: recordSha256({ schemaVersion: 1, encoding: 'core-input-material-capture-v1',
                            ...refs, nativeSelectedSha256: input.selected.sha256, assemblySha256: input.assemblySha256 }) };
                    current(row);
                    ready = row;
                    releaseBuild = undefined;
                    return { kind: 'prepared' };
                }
                catch (error) {
                    releaseBuild?.();
                    return { kind: 'blocked', code: codeOf(error) };
                }
            })();
            preparations.add(operation);
            const settled = () => { preparing = false; clearTimeout(timer); controllers.delete(controller); preparations.delete(operation); };
            void operation.then(settled, settled);
            return operation;
        },
        transform(input) {
            try {
                const scope = owner.scope(input);
                if (outside.has(scope.stepToken))
                    return { kind: 'unchanged' };
                const row = ready;
                if (!row || row.token !== scope.stepToken)
                    fail('INPUT_MATERIAL_PREPARATION_MISSING');
                current(row);
                if (input.turn !== scope.turn || input.step !== scope.step || input.signal !== row.initial.signal
                    || input.assemblySha256 !== row.initial.assemblySha256)
                    fail('INPUT_MATERIAL_STEP_CHANGED');
                row.checks.assertSelected(input.selected, input.firstAttempt);
                const route = nativeInputSha256(input.preparedRoute);
                if (row.routeSha256 !== undefined && row.routeSha256 !== route)
                    fail('INPUT_MATERIAL_ROUTE_CHANGED');
                row.routeSha256 = route;
                const decision = { kind: 'transform', schemaVersion: 1,
                    encoding: 'native-request-material-owner-transform-v1', snapshot: row.snapshot, plan: row.plan,
                    captureSha256: row.captureSha256, expectedAssemblySha256: input.assemblySha256,
                    expectedSelectedBaseSha256: input.selected.sha256, requiredSections: row.material.requiredSections,
                    sections: row.material.sections, insertions: row.material.insertions,
                    ...row.material.anchoredInsertions ? { anchoredInsertions: row.material.anchoredInsertions } : {} };
                row.transformed = { decisionSha256: nativeInputSha256(decision) };
                return decision;
            }
            catch (error) {
                return { kind: 'blocked', code: codeOf(error) };
            }
        },
        check(input) {
            try {
                const scope = owner.scope(input), row = ready;
                if (!row || row.token !== scope.stepToken || !row.transformed
                    || nativeInputSha256(input.decision) !== row.transformed.decisionSha256)
                    fail('INPUT_MATERIAL_PLAN_CHANGED');
                current(row);
                if (!input.selected)
                    fail('INPUT_MATERIAL_NATIVE_SELECTED_MISSING');
                row.checks.assertSelected(input.selected, input.selected.messages.some(message => message.origin === 'pending-decision'));
                if (input.materialRef) {
                    const previous = row.transformed.materialRef;
                    if (previous && nativeInputSha256(previous) !== nativeInputSha256(input.materialRef))
                        fail('INPUT_MATERIAL_NATIVE_REF_CHANGED');
                    if (!previous) {
                        const event = scope.session.snapshotEvents().find(item => Number(item.seq) === input.materialRef.seq);
                        if (event?.type !== 'request/material' || nativeInputSha256(event) !== input.materialRef.sha256
                            || event.data.turn !== scope.turn || event.data.step !== scope.step
                            || nativeInputSha256(event.data.snapshot) !== nativeInputSha256(row.snapshot)
                            || nativeInputSha256(event.data.plan) !== nativeInputSha256(row.plan))
                            fail('INPUT_MATERIAL_NATIVE_RECORD_UNPROVEN');
                    }
                    row.transformed.materialRef = input.materialRef;
                }
                else if (row.transformed.materialRef)
                    fail('INPUT_MATERIAL_NATIVE_REF_MISSING');
                return { kind: 'allow' };
            }
            catch (error) {
                return { kind: 'blocked', code: codeOf(error) };
            }
        },
    };
    function revoke() {
        clearReady();
        for (const controller of controllers)
            controller.abort('Core material preparation revoked');
    }
    return { requestMaterial,
        async stop() {
            revoke();
            // This wait stays outside the input record FIFO. Preparation may itself
            // own a queued write; waiting from that FIFO would deadlock its cleanup.
            await Promise.allSettled([...preparations]);
        },
        dispose() { disposal.abort('Core material owner disposed'); revoke(); }, };
}
