// Generated from runtime/alpha3/src/core/roleplay-input-material.ts; edit the TypeScript source.
/** Hot material data belongs to one existing Core input binding. Persisted
 * records can explain a request; they cannot recreate this owner after resume. */
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256, keyOf } from './roleplay-data.js';
/** One preparation budget covers lock waits, deterministic workers and record
 * publication. Nested work cannot renew it by starting another evaluator. */
export const ROLEPLAY_INPUT_MATERIAL_LIMITS_V1 = Object.freeze({ deadlineMs: 15_000 });
function candidateTransform(row) {
    return { kind: 'transform', ...row.material.messageTextProjections ? {
            schemaVersion: 2, encoding: 'native-request-material-owner-transform-v2',
            messageTextProjections: row.material.messageTextProjections
        } : {
            schemaVersion: 1, encoding: 'native-request-material-owner-transform-v1'
        },
        ...row.refs, captureSha256: row.captureSha256, expectedAssemblySha256: row.initial.assemblySha256,
        expectedSelectedBaseSha256: row.initial.selected.sha256, requiredSections: row.material.requiredSections,
        sections: row.material.sections, insertions: row.material.insertions,
        ...row.material.anchoredInsertions ? { anchoredInsertions: row.material.anchoredInsertions } : {},
        ...row.material.messageProjection ? { messageProjection: row.material.messageProjection } : {},
        ...row.material.story ? { story: row.material.story } : {} };
}
function checkpointForPreview(candidate, basis, preview) {
    const measurement = preview.measurement;
    if (!measurement || measurement.capacity.status === 'unknown' || measurement.capacity.excess <= 0)
        return candidate.needsCheckpoint ? {} : undefined;
    if (!candidate.windowEnabled)
        fail('INPUT_REQUEST_CONTEXT_WINDOW_DISABLED');
    const storyRefs = new Map(candidate.storyMessages.map(row => [row.id, row.eventSeq])), costs = new Map(preview.messageCosts.map(row => [row.id, row]));
    let storyTokens = 0;
    for (const row of basis.selected.messages) {
        if (row.eventSeq === null || storyRefs.get(row.id) !== row.eventSeq)
            continue;
        const cost = costs.get(row.id);
        if (!cost || cost.eventSeq !== row.eventSeq)
            fail('INPUT_REQUEST_STORY_COST_UNKNOWN');
        storyTokens += cost.tokens;
    }
    const requiredTokens = measurement.estimate.inputTokens - storyTokens, available = measurement.capacity.availableInput;
    if (requiredTokens > available)
        fail('INPUT_REQUEST_REQUIRED_CONTEXT_EXCEEDS_CAPACITY');
    return { options: { fullRequestAllowance: Math.max(0, available - requiredTokens), messageCosts: preview.messageCosts } };
}
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
        story: { schemaVersion: 1,
            normalizeText: text => ready?.responseHooks?.normalizeText?.(text) ?? text,
            recoverText: blocks => ready?.responseHooks?.recoverText?.(blocks),
            createTextTransform: () => ready?.responseHooks?.createTextTransform?.() ?? { push: text => text, finish: () => '' } },
        prepare(input) {
            const controller = new AbortController();
            let began = performance.now(), spent = 0, preparing = true, running = true;
            const expire = () => controller.abort(Error('INPUT_MATERIAL_PREPARATION_DEADLINE'));
            let timer = setTimeout(expire, ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs);
            const pauseBudget = () => { spent += performance.now() - began; running = false; clearTimeout(timer); };
            const resumeBudget = () => {
                began = performance.now();
                running = true;
                timer = setTimeout(expire, Math.max(0, ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs - spent));
            };
            controllers.add(controller);
            const operation = (async () => {
                let releaseBuild;
                try {
                    const original = owner.scope(input, true);
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
                        if (preparing && spent + (running ? performance.now() - began : 0) >= ROLEPLAY_INPUT_MATERIAL_LIMITS_V1.deadlineMs) {
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
                    const construct = async (initial, preparedRoute) => {
                        const data = await deps.prepare(initial, scope);
                        if (data.kind === 'prepared-data')
                            releaseBuild = data.release.bind(data);
                        scope.signal.throwIfAborted();
                        scope.assertOwnerFactsCurrent();
                        if (data.kind !== 'prepared-data')
                            return data;
                        const checks = { assertCurrent: data.assertCurrent.bind(data), assertSelected: data.assertSelected.bind(data),
                            release: data.release.bind(data) };
                        checks.assertSelected(initial.selected, true);
                        // The recorded plan and the live transform must use the same detached,
                        // frozen values. A producer's later array mutation cannot alter wire
                        // content while the persisted explanatory record remains unchanged.
                        // Layout owns the valid wire data; this publisher only detaches the
                        // transform so its record and live request retain the same values.
                        const material = freeze(structuredClone({ requiredSections: data.requiredSections,
                            sections: data.sections, insertions: data.insertions,
                            ...data.anchoredInsertions ? { anchoredInsertions: data.anchoredInsertions } : {},
                            ...data.messageTextProjections ? { messageTextProjections: data.messageTextProjections } : {},
                            ...data.messageProjection ? { messageProjection: data.messageProjection } : {}, ...data.story ? { story: data.story } : {} }));
                        const materialSha256 = nativeInputSha256(material);
                        const basis = { schemaVersion: 1, encoding: 'core-input-material-record-v1',
                            authority: 'consumer-data-only', sessionId: scope.session.id, branchId: scope.session.id,
                            preparation: scope.preparation, currency: scope.phaseA?.current().reference
                                ? { ...scope.currency, snapshot: scope.phaseA.current().reference } : scope.currency,
                            originalInputRefs: scope.originalInputRefs,
                            turn: scope.turn, step: scope.step };
                        const snapshot = Object.freeze({ ...basis, kind: 'snapshot', payload: data.snapshot });
                        const plan = Object.freeze({ ...basis, kind: 'plan', payload: Object.freeze({ promptPlan: data.plan,
                                nativeTransform: material, nativeTransformSha256: materialSha256 }) });
                        const refs = { snapshot: { key: prefix + '-snapshot', sha256: recordSha256(snapshot) },
                            plan: { key: prefix + '-plan', sha256: recordSha256(plan) } };
                        return { kind: 'material-candidate', initial, scope, checks, material, responseHooks: data.responseHooks,
                            ...data.renderedAuthorMaterial ? { renderedAuthorMaterial: data.renderedAuthorMaterial } : {},
                            materialSha256, snapshot, plan, refs,
                            ...(preparedRoute ? { routeSha256: nativeInputSha256(preparedRoute) } : {}),
                            captureSha256: recordSha256({ schemaVersion: 1, encoding: 'core-input-material-capture-v1',
                                ...refs, nativeSelectedSha256: initial.selected.sha256, assemblySha256: initial.assemblySha256 }) };
                    };
                    let chosen;
                    if (scope.phaseA && input.candidate) {
                        let selectedBasis;
                        const preview = async () => input.candidate.preview(scope.phaseA.messages(), async (basis) => {
                            selectedBasis = basis;
                            chosen = await construct({ ...input, selected: basis.selected, finalAssembly: basis.finalAssembly,
                                assemblySha256: basis.assemblySha256 }, basis.preparedRoute);
                            if (chosen.kind === 'refused')
                                fail(chosen.code);
                            return chosen.kind === 'outside-declared-domain' ? { kind: 'unchanged' } : candidateTransform(chosen);
                        });
                        const first = await preview();
                        assertBudgetAndSignal();
                        const checkpoint = checkpointForPreview(scope.phaseA.current(), selectedBasis, first);
                        if (checkpoint) {
                            // The existing notes-save owner keeps its own signal/deadline.
                            // Releasing the old DATA baseline makes its writes visible to the
                            // next capture without replaying author generation callbacks.
                            releaseBuild?.();
                            releaseBuild = undefined;
                            pauseBudget();
                            await scope.phaseA.checkpoint(checkpoint.options);
                            resumeBudget();
                            assertBudgetAndSignal();
                            const final = await preview();
                            if (final.measurement?.capacity.status === 'known' && final.measurement.capacity.excess > 0)
                                fail('INPUT_REQUEST_CONTEXT_TOO_LARGE_AFTER_CHECKPOINT');
                        }
                        await scope.phaseA.commit();
                    }
                    else {
                        if (scope.phaseA) {
                            if (scope.phaseA.current().needsCheckpoint) {
                                pauseBudget();
                                await scope.phaseA.checkpoint();
                                resumeBudget();
                                assertBudgetAndSignal();
                            }
                            await scope.phaseA.commit();
                        }
                        chosen = await construct(input);
                    }
                    if (!chosen)
                        fail('INPUT_MATERIAL_PREPARATION_MISSING');
                    if (chosen.kind === 'refused')
                        return { kind: 'blocked', code: chosen.code };
                    if (chosen.kind === 'outside-declared-domain') {
                        outside.add(scope.stepToken);
                        return { kind: 'unchanged' };
                    }
                    const { checks, material, materialSha256, snapshot, plan, refs, captureSha256 } = chosen, publishedScope = owner.scope(input);
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
                            owner.registerNonNumericalBranchRow?.(input, publishedScope, { ...fact, phase: 'writing' });
                            if (old === undefined || old === null)
                                await owner.table.put(ref.key, record);
                            const readback = owner.table.get(ref.key);
                            if (recordSha256(readback) !== ref.sha256)
                                fail('INPUT_MATERIAL_WRITE_UNCONFIRMED');
                            records[kind] = readback;
                            owner.registerNonNumericalBranchRow?.(input, publishedScope, { ...fact, phase: 'written' });
                            // Readback precedes the cheap owner checkpoint. Both rows must
                            // complete before any Ready object can reach Native.
                            checks.assertCurrent();
                        }
                    });
                    const row = { token: scope.stepToken, scope: publishedScope, initial: chosen.initial, checks, material, materialSha256, ...refs,
                        responseHooks: chosen.responseHooks,
                        ...chosen.renderedAuthorMaterial ? { renderedAuthorMaterial: chosen.renderedAuthorMaterial } : {},
                        records: { snapshot: records.snapshot, plan: records.plan },
                        captureSha256, ...chosen.routeSha256 ? { routeSha256: chosen.routeSha256,
                            transformed: { decisionSha256: nativeInputSha256(candidateTransform(chosen)) } } : {} };
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
                const decision = { kind: 'transform',
                    ...row.material.messageTextProjections ? { schemaVersion: 2,
                        encoding: 'native-request-material-owner-transform-v2',
                        messageTextProjections: row.material.messageTextProjections } : { schemaVersion: 1,
                        encoding: 'native-request-material-owner-transform-v1' }, snapshot: row.snapshot, plan: row.plan,
                    captureSha256: row.captureSha256, expectedAssemblySha256: input.assemblySha256,
                    expectedSelectedBaseSha256: input.selected.sha256, requiredSections: row.material.requiredSections,
                    sections: row.material.sections, insertions: row.material.insertions,
                    ...row.material.anchoredInsertions ? { anchoredInsertions: row.material.anchoredInsertions } : {},
                    ...row.material.messageProjection ? { messageProjection: row.material.messageProjection } : {},
                    ...row.material.story ? { story: row.material.story } : {} };
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
                if (!row || row.token !== scope.stepToken || !row.transformed)
                    fail('INPUT_MATERIAL_PLAN_CHANGED');
                // Native's decoder owns this deeply frozen plan. Later observer checks
                // still test Source currency, without rehashing the same decoded DATA.
                if (row.transformed.decision !== input.decision) {
                    if (nativeInputSha256(input.decision) !== row.transformed.decisionSha256)
                        fail('INPUT_MATERIAL_PLAN_CHANGED');
                    row.transformed.decision = input.decision;
                }
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
        /** Tools run after this step's dispatch and before the binder selects its
         * successor. Require its actual opaque token and committed material; an
         * earlier turn's retained row or a preparation without dispatch is absent. */
        withCurrent(step, read) {
            const row = ready;
            if (!row || row.token !== step || !row.transformed?.materialRef || !row.renderedAuthorMaterial)
                return undefined;
            current(row);
            return read(row.renderedAuthorMaterial);
        },
        /** The actual Session publisher supplies step/end. Normal completion does
         * not abort its signal, so retire its hot read at that existing boundary. */
        releaseStep(turn, step) {
            if (ready?.scope.turn === turn && ready.scope.step === step)
                clearReady();
        },
        async stop() {
            revoke();
            // This wait stays outside the input record FIFO. Preparation may itself
            // own a queued write; waiting from that FIFO would deadlock its cleanup.
            await Promise.allSettled([...preparations]);
        },
        dispose() { disposal.abort('Core material owner disposed'); revoke(); }, };
}
