// Generated from runtime/alpha3/src/core/roleplay-tavern-injections.ts; edit the TypeScript source.
/** A registry is a fold of actual Native publications, never a second head
 * write. Closure archives only replay consumer data; Source and dispatch
 * rights still come from the current Core step and protected component. */
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256 } from './roleplay-data.js';
import { validateTemplateRequestV1, validateTemplateOutputV1 } from './tavern-template-data.mjs';
import { injectionCreationHeadV1, validateInjectionPhaseV1, validateInjectionReceiptV1, deriveTrustedInjectionDisposalReceiptV1 } from './tavern-template-injection-data.mjs';
export const TAVERN_NATIVE_INJECTION_POLICY_V1 = Object.freeze({ schemaVersion: 1,
    encoding: 'native-template-injection-registry-policy-v1', authority: 'consumer-data-only',
    owner: 'session-branch-logical-Source-program; same-owner-ID-replacement',
    publication: 'first-actual-Native-material-event; same-plan-retry-no-new-effects',
    program: 'complete-creation-and-all-acknowledged-phases; fresh-realm-shared-closure-replay',
    schedule: 'logical-owner-then-ID; serial-await; captured-pass; new-registrations-next-pass',
    scan: 'separate-filter-call-from-chat; once-per-registration-revision-per-feedback-pass',
    terminal: 'all-actual-turn-end-reasons; no-step-provider-or-worker-cleanup',
    once: 'owned-disposer-IDs-delete-current-replacements; resource-blocked-fold-still-removes-IDs',
    ownerClose: 'current-author-or-entry-definition-changed-disabled-or-import-replaced',
    fork: 'parent-live-registration-not-inherited; no-hash-or-archive-mints-child-owner',
    atomicity: 'no-material-publication-discards-provisional-creations-and-callback-effects',
    lateAuthor: 'after-scan-and-chat-cuts; persistent-register-next-generation; once-clears-current-terminal',
    retention: 'prune-only-at-material-seal-or-terminal; no-live-prompt-and-no-armed-once-disposer',
    bounds: { programs: 256, prompts: 512, operations: 1024, archiveBytes: 67_108_864, scanPasses: 32 },
    requests: { normal: 0, retry: 0, fallback: 0 } });
const policySha256 = recordSha256(TAVERN_NATIVE_INJECTION_POLICY_V1);
function fail(code) { throw Error(code); }
const same = (left, right) => recordSha256(left) === recordSha256(right);
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function exact(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key)))
        fail('INPUT_MATERIAL_INJECTION_SCHEMA_INVALID');
}
const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const keyOf = (owner, id) => JSON.stringify([owner, id]);
const compareText = (left, right) => left === right ? 0 : left < right ? -1 : 1;
export function createRoleplayTavernInjectionRegistryV1(deps) {
    const programs = new Map(), prompts = new Map(), operations = [], disposalEvidence = [], consumerEvidence = [], publishedPlans = new Set(), definitions = new Map(), consumedScan = new Set();
    let archiveBytes = 0, creationOrdinal = 0, phaseOrdinal = 0, revision = 0, scanPasses = 0;
    const checkpoint = () => deps.signal.throwIfAborted();
    const ownerCheckpoint = () => { checkpoint(); deps.assertCurrent(); };
    ownerCheckpoint();
    for (const definition of deps.definitions) {
        if (!id(definition.logicalOwnerId) || !hash(definition.definitionSha256) || definitions.has(definition.logicalOwnerId))
            fail('INPUT_MATERIAL_INJECTION_DEFINITION_INVALID');
        definitions.set(definition.logicalOwnerId, definition.definitionSha256);
    }
    const stateSha256 = () => recordSha256({ schemaVersion: 1, encoding: 'native-template-injection-registry-state-v1',
        sessionId: deps.sessionId, policySha256, revision,
        programs: [...programs].map(([id, p]) => ({ id, definition: p.creation.definition, head: p.head,
            batches: [...p.batches], nextBatch: p.nextBatch, nextCallback: p.nextCallback, nextEffect: p.nextEffect,
            blocked: p.blocked, closed: p.closed })), prompts: [...prompts] });
    const charge = (value) => {
        const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
        archiveBytes += bytes;
        if (archiveBytes > TAVERN_NATIVE_INJECTION_POLICY_V1.bounds.archiveBytes)
            fail('INPUT_MATERIAL_INJECTION_ARCHIVE_LIMIT');
        return bytes;
    };
    const pruneUnreferencedPrograms = () => {
        const live = new Set([...prompts.values()].map(row => row.programInstanceId));
        for (const [id, p] of programs) {
            // A replaced once batch still owns an ID disposer until the actual end
            // of its arming turn. Removing its realm now would revive replacements.
            if (live.has(id) || [...p.batches.values()].some(batch => batch.once && !batch.deleted))
                continue;
            programs.delete(id);
            archiveBytes -= p.archiveBytes;
            revision++;
        }
    };
    const readProgram = (id) => { const p = programs.get(id); if (!p)
        fail('INPUT_MATERIAL_INJECTION_PROGRAM_MISSING'); return p; };
    const applyEffects = (p, output, turn) => {
        const owner = p.creation.definition.logicalOwnerId;
        for (const effect of output.injectionEffects ?? []) {
            if (effect.ordinal !== p.nextEffect++)
                fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER');
            if (effect.kind === 'batch-created') {
                if (effect.batchOrdinal !== p.nextBatch++)
                    fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER');
                p.batches.set(effect.batchOrdinal, { ids: effect.ids, once: effect.once, deleted: false, armedTurn: turn });
            }
            else if (effect.kind === 'register') {
                const { prompt } = effect, batch = p.batches.get(prompt.batchOrdinal);
                if (!batch || batch.deleted || batch.once !== prompt.once || !batch.ids.includes(prompt.id)
                    || prompt.callbackOrdinal !== null && prompt.callbackOrdinal !== p.nextCallback++)
                    fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER');
                const registrationSha256 = recordSha256({ programInstanceId: p.creation.programInstanceId, effect });
                prompts.set(keyOf(owner, prompt.id), { owner, programInstanceId: p.creation.programInstanceId, registrationSha256, prompt });
                if (prompts.size > TAVERN_NATIVE_INJECTION_POLICY_V1.bounds.prompts)
                    fail('INPUT_MATERIAL_INJECTION_PROMPT_LIMIT');
            }
            else {
                if (effect.batchOrdinal !== null) {
                    const batch = p.batches.get(effect.batchOrdinal);
                    if (!batch || batch.deleted || !same(batch.ids, effect.ids))
                        fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER');
                    batch.deleted = true;
                }
                // ID deletion intentionally reaches a replacement registered later by
                // another realm of this same logical Source owner, as the guest API does.
                for (const id of effect.ids)
                    prompts.delete(keyOf(owner, id));
            }
            revision++;
        }
    };
    const applyCreation = (row, turn) => {
        exact(row, ['kind', 'programInstanceId', 'definition', 'request', 'output', 'phase']);
        exact(row.definition, ['logicalOwnerId', 'definitionSha256']);
        if (row.kind !== 'creation' || !id(row.programInstanceId) || !id(row.definition.logicalOwnerId)
            || !hash(row.definition.definitionSha256) || programs.has(row.programInstanceId)
            || !['initial', 'lore-selected', 'late-author'].includes(row.phase))
            fail('INPUT_MATERIAL_INJECTION_CREATION_INVALID');
        const request = validateTemplateRequestV1(row.request), output = validateTemplateOutputV1(row.output, request, row.output.engine);
        if (request.snapshot.sessionId !== deps.sessionId || request.snapshot.branchId !== deps.sessionId
            || !output.injectionEffects?.length)
            fail('INPUT_MATERIAL_INJECTION_CREATION_INVALID');
        const creationBytes = charge(row);
        const p = { creation: row, journal: [], head: injectionCreationHeadV1(row.programInstanceId, request, output),
            batches: new Map(), nextBatch: 0, nextCallback: 0, nextEffect: 0, lastSnapshot: request.snapshot,
            blocked: null, closed: false, archiveBytes: creationBytes };
        programs.set(row.programInstanceId, p);
        if (programs.size > TAVERN_NATIVE_INJECTION_POLICY_V1.bounds.programs)
            fail('INPUT_MATERIAL_INJECTION_PROGRAM_LIMIT');
        applyEffects(p, output, turn);
    };
    const applyInvocation = (row, turn) => {
        exact(row, ['kind', 'programInstanceId', 'phase', 'receipt']);
        const p = readProgram(row.programInstanceId);
        if (p.closed || p.blocked)
            fail('INPUT_MATERIAL_INJECTION_PROGRAM_BLOCKED');
        const phase = validateInjectionPhaseV1(row.phase), receipt = validateInjectionReceiptV1(row.receipt, row.programInstanceId, p.head, phase, p.creation.request, p.creation.output.engine);
        if (phase.snapshot.sessionId !== deps.sessionId || phase.snapshot.branchId !== deps.sessionId
            || phase.snapshot.packageSha256 !== p.creation.request.snapshot.packageSha256)
            fail('INPUT_MATERIAL_INJECTION_READ_BASIS_CHANGED');
        p.archiveBytes += charge(row);
        if (p.journal.length >= 32)
            fail('INPUT_MATERIAL_INJECTION_JOURNAL_LIMIT');
        for (const invocation of receipt.invocations)
            applyEffects(p, invocation.output, turn);
        if (receipt.nextBatchOrdinal !== p.nextBatch || receipt.nextCallbackOrdinal !== p.nextCallback
            || receipt.nextEffectOrdinal !== p.nextEffect)
            fail('INPUT_MATERIAL_INJECTION_EFFECT_ORDER');
        p.journal.push({ phase, expectedReceipt: receipt });
        p.head = receipt.receiptSha256;
        p.lastSnapshot = phase.snapshot;
        revision++;
    };
    const phaseFor = (snapshot, schedule) => {
        const body = { schemaVersion: 1, encoding: 'owned-template-injection-phase-v1', snapshot, schedule };
        return validateInjectionPhaseV1({ ...body, phaseSha256: recordSha256(body) });
    };
    const dispose = (programInstanceId, batchOrdinals, consumer, actualRef) => {
        const p = readProgram(programInstanceId);
        if (!batchOrdinals.length)
            return;
        const phase = phaseFor(p.lastSnapshot, batchOrdinals.map(batchOrdinal => ({ kind: 'dispose-batch', batchOrdinal, consumer,
            invocationId: `dispose-${recordSha256({ programInstanceId, batchOrdinal, consumer, actualRef })}` })));
        let derived;
        let blocked = p.blocked;
        try {
            if (p.journal.length >= 32 || p.blocked)
                fail(p.blocked ?? 'INPUT_MATERIAL_INJECTION_JOURNAL_LIMIT');
            derived = deriveTrustedInjectionDisposalReceiptV1(programInstanceId, p.creation.request, p.creation.output, p.journal, p.head, phase, p.creation.output.engine);
        }
        catch (error) {
            // An exhausted replay journal cannot revive once. This deterministic
            // Native terminal fold removes the original IDs while retaining an
            // explicit blocked realm; it never fabricates an executable receipt.
            blocked = error instanceof Error ? error.message : 'INPUT_MATERIAL_INJECTION_DISPOSAL_UNAVAILABLE';
            if (!p.blocked && !['INPUT_MATERIAL_INJECTION_JOURNAL_LIMIT', 'TEMPLATE_INJECTION_RESTORE_LIMIT',
                'TEMPLATE_ENGINE_IDENTITY'].includes(blocked))
                throw error;
            p.blocked = blocked;
            for (const ordinal of batchOrdinals) {
                const batch = p.batches.get(ordinal);
                if (!batch)
                    fail('INPUT_MATERIAL_INJECTION_BATCH_MISSING');
                if (!batch.deleted) {
                    for (const id of batch.ids)
                        prompts.delete(keyOf(p.creation.definition.logicalOwnerId, id));
                    batch.deleted = true;
                    revision++;
                }
            }
        }
        if (derived)
            applyInvocation({ kind: 'invocation', programInstanceId, phase, receipt: derived.receipt }, typeof actualRef.turn === 'number' ? actualRef.turn : deps.turn);
        disposalEvidence.push(freeze({ schemaVersion: 1, encoding: 'native-injection-disposal-fold-v1',
            authority: 'consumer-data-only', programInstanceId, consumer, actualRef, batchOrdinals,
            ...derived ? { derived } : { blocked, observedGuestExecution: false } }));
    };
    const applyOperation = (operation, turn) => {
        if (operation.kind === 'creation')
            applyCreation(operation, turn);
        else if (operation.kind === 'invocation')
            applyInvocation(operation, turn);
        else {
            exact(operation, ['kind', 'programInstanceId', 'definitionSha256']);
            const p = readProgram(operation.programInstanceId);
            if (operation.kind !== 'owner-closed' || operation.definitionSha256 !== p.creation.definition.definitionSha256 || p.closed)
                fail('INPUT_MATERIAL_INJECTION_OWNER_CLOSE_INVALID');
            dispose(operation.programInstanceId, [...p.batches].filter(([, batch]) => !batch.deleted).map(([id]) => id), 'owner-close', { turn, definitionSha256: operation.definitionSha256 });
            p.closed = true;
            revision++;
        }
    };
    const bySeq = new Map(deps.history.publications.map(row => [Number(row.event.seq), row]));
    for (const event of deps.history.events) {
        const publication = bySeq.get(Number(event.seq));
        if (publication) {
            const { snapshot, plan } = publication, transaction = snapshot.payload.injections, expected = plan.payload.promptPlan?.injectionTransactionSha256;
            if (!transaction && expected === undefined)
                continue;
            if (!transaction || !same(transaction.transactionSha256, expected))
                fail('INPUT_MATERIAL_INJECTION_PLAN_BINDING');
            exact(transaction, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'turn', 'step', 'attemptId', 'policySha256',
                'baseRegistrySha256', 'operations', 'finalRegistrySha256', 'transactionSha256']);
            const { transactionSha256, ...body } = transaction;
            if (transaction.schemaVersion !== 1 || transaction.encoding !== 'native-template-injection-transaction-v1'
                || transaction.authority !== 'consumer-data-only' || transaction.sessionId !== deps.sessionId
                || transaction.turn !== publication.event.data.turn || transaction.step !== publication.event.data.step
                || transaction.policySha256 !== policySha256 || !id(transaction.attemptId) || recordSha256(body) !== transactionSha256
                || !Array.isArray(transaction.operations) || transaction.operations.length > 1024)
                fail('INPUT_MATERIAL_INJECTION_TRANSACTION_INVALID');
            const planKey = `${publication.event.data.plan.key}:${publication.event.data.plan.sha256}`;
            if (publishedPlans.has(planKey))
                continue;
            publishedPlans.add(planKey);
            if (stateSha256() !== transaction.baseRegistrySha256)
                fail('INPUT_MATERIAL_INJECTION_BASE_CHANGED');
            for (const operation of transaction.operations)
                applyOperation(operation, transaction.turn);
            pruneUnreferencedPrograms();
            if (stateSha256() !== transaction.finalRegistrySha256)
                fail('INPUT_MATERIAL_INJECTION_FINAL_CHANGED');
        }
        else if (event.type === 'turn/end') {
            const actualRef = { seq: Number(event.seq), eventSha256: nativeInputSha256(event), turn: event.data.turn, reason: event.data.reason };
            for (const [id, p] of programs)
                dispose(id, [...p.batches].filter(([, batch]) => batch.once && !batch.deleted
                    && batch.armedTurn === event.data.turn).map(([ordinal]) => ordinal), 'terminal', actualRef);
            pruneUnreferencedPrograms();
        }
    }
    const baseRegistrySha256 = stateSha256(), historyDisposals = disposalEvidence.length;
    const append = (operation) => {
        if (operations.length >= 1024)
            fail('INPUT_MATERIAL_INJECTION_OPERATION_LIMIT');
        applyOperation(operation, deps.turn);
        operations.push(freeze(operation));
    };
    for (const [id, p] of programs)
        if (!p.closed
            && definitions.get(p.creation.definition.logicalOwnerId) !== p.creation.definition.definitionSha256) {
            append({ kind: 'owner-closed', programInstanceId: id, definitionSha256: p.creation.definition.definitionSha256 });
        }
    checkpoint();
    return {
        acceptCreation(request, output, definition, phase) {
            ownerCheckpoint();
            if (!output.injectionEffects?.length)
                return;
            if (definitions.get(definition.logicalOwnerId) !== definition.definitionSha256)
                fail('INPUT_MATERIAL_INJECTION_SOURCE_DEFINITION_CHANGED');
            const programInstanceId = `program-${recordSha256({ sessionId: deps.sessionId, turn: deps.turn, step: deps.step,
                attemptId: deps.attemptId, ordinal: creationOrdinal++, definition, requestSha256: request.requestSha256 })}`;
            append({ kind: 'creation', programInstanceId, definition, request, output, phase });
            ownerCheckpoint();
        },
        async consume(consumer, snapshot) {
            ownerCheckpoint();
            const selected = [...prompts.values()].filter(row => consumer === 'scan' ? row.prompt.should_scan : row.prompt.position === 'in_chat')
                .sort((left, right) => compareText(left.owner, right.owner) || compareText(left.prompt.id, right.prompt.id))
                .filter(row => consumer !== 'scan' || !consumedScan.has(row.registrationSha256));
            if (consumer === 'scan' && selected.length && ++scanPasses > 32)
                fail('INPUT_MATERIAL_INJECTION_SCAN_LIMIT');
            const accepted = [];
            const results = [];
            const activationProposals = [];
            for (const row of selected) {
                if (consumer === 'scan')
                    consumedScan.add(row.registrationSha256);
                const p = readProgram(row.programInstanceId);
                if (p.closed || p.blocked)
                    fail(p.blocked ?? 'INPUT_MATERIAL_INJECTION_OWNER_CLOSED');
                let include = true;
                let receiptSha256 = null;
                if (row.prompt.callbackOrdinal !== null) {
                    if (!same(p.creation.output.engine, deps.component.runtime.identity))
                        fail('INPUT_MATERIAL_INJECTION_ENGINE_CHANGED');
                    const phase = phaseFor(snapshot, [{ kind: 'filter', callbackOrdinal: row.prompt.callbackOrdinal, consumer,
                            invocationId: `filter-${recordSha256({ attemptId: deps.attemptId, step: deps.step, consumer,
                                phaseOrdinal: phaseOrdinal++, registrationSha256: row.registrationSha256 })}` }]);
                    ownerCheckpoint();
                    const result = await deps.component.runtime.restoreAndEvaluateInjectionsV1({ schemaVersion: 1,
                        encoding: 'owned-template-injection-restore-v1', programInstanceId: row.programInstanceId,
                        creation: { request: p.creation.request, expectedOutput: p.creation.output }, journal: p.journal,
                        expectedHeadSha256: p.head, current: phase }, deps.signal);
                    ownerCheckpoint();
                    if (result.kind !== 'evaluated')
                        fail(result.diagnostics[0]?.code ?? 'INPUT_MATERIAL_INJECTION_FILTER_REFUSED');
                    append({ kind: 'invocation', programInstanceId: row.programInstanceId, phase, receipt: result.receipt });
                    const invocation = result.receipt.invocations[0];
                    include = invocation.accepted === true;
                    receiptSha256 = result.receipt.receiptSha256;
                    activationProposals.push(...invocation.output.activationProposals);
                }
                // A captured schedule still uses its captured content even when its
                // own callback removes/replaces it. New registrations wait for a later pass.
                if (include)
                    accepted.push(row);
                results.push({ registrationSha256: row.registrationSha256, accepted: include, receiptSha256 });
            }
            consumerEvidence.push(freeze({ schemaVersion: 1, encoding: 'native-injection-consumer-cut-v1',
                authority: 'consumer-data-only', consumer, snapshotSha256: snapshot.snapshotSha256,
                selectedRegistrationSha256s: selected.map(row => row.registrationSha256), results, registryAfterSha256: stateSha256() }));
            ownerCheckpoint();
            return freeze({ prompts: accepted, activationProposals });
        },
        transaction() {
            checkpoint();
            pruneUnreferencedPrograms();
            const body = { schemaVersion: 1, encoding: 'native-template-injection-transaction-v1',
                authority: 'consumer-data-only', sessionId: deps.sessionId, turn: deps.turn, step: deps.step,
                attemptId: deps.attemptId, policySha256, baseRegistrySha256, operations: [...operations], finalRegistrySha256: stateSha256() };
            return freeze({ ...body, transactionSha256: recordSha256(body) });
        },
        audit: () => freeze({ schemaVersion: 1, encoding: 'native-injection-history-and-provisional-fold-v1',
            authority: 'consumer-data-only', policySha256, history: deps.history.evidence, baseRegistrySha256,
            historicalDisposals: disposalEvidence.slice(0, historyDisposals), currentDisposals: disposalEvidence.slice(historyDisposals),
            consumers: consumerEvidence, finalRegistrySha256: stateSha256(), archiveBytes, scanPasses }),
        assertCurrent: ownerCheckpoint,
    };
}
