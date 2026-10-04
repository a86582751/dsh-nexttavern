// Generated from runtime/alpha3/src/core/roleplay-program-opening.ts; edit the TypeScript source.
/** Own the actual first-opening transaction and its Native closing handoff.
 * Immutable records explain recovery; actual Session/Source/Native readers
 * independently decide every append, material and publication permission. */
import { nativeInputSha256, validateNativeOpeningInvocationV1 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { assertProgramOpeningRowDataDescriptorsV1 } from './roleplay-program-opening-row-facts.js';
import { openingIntentKey } from './roleplay-opening-selection.js';
import { createRoleplayOpeningMaterialOwnerV1 } from './roleplay-opening-material.js';
import { createProgramMvuGenesisPublisherV1 } from './roleplay-program-genesis-publisher.js';
import { programGenesisEventIdV1, validateProgramMvuGenesisFactsV1 } from './roleplay-program-genesis-data.js';
import { mvuInitializationEventKey, mvuInitializationHeadKey } from './roleplay-mvu-initialization.js';
import { createProgramOpeningSeedV1, createProgramOpeningInputV1, prepareProgramOpeningPlanRecordV1, createPreparedOpeningIntentV7, createOpeningIntentV7, validateOpeningIntentV7, validateProgramOpeningSeedV1, validateProgramOpeningInputV1, validateProgramOpeningPlanRecordV1, validateProgramOpeningNativeFactsV1, validateProgramOpeningGenesisEnvelopeV1, createProgramOpeningNativeFactsV1, createProgramOpeningGenesisEnvelopeV1, createProgramOpeningAbsentDomainV1, validateProgramOpeningAbsentDomainV1, createProgramOpeningNumericalDomainReceiptV1, createProgramOpeningAbsenceDomainReceiptV1, programOpeningSeedKeyV1, programOpeningInputKeyV1, programOpeningPlanKeyV1, programOpeningDomainKeyV1, programOpeningRefV1, programOpeningRecordDataV1 } from './roleplay-program-opening-records.js';
const same = (left, right) => recordSha256(left) === recordSha256(right);
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function fail(code) { throw Error(code); }
const codeOf = (error) => error instanceof Error && /^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
    ? error.message : 'PROGRAM_OPENING_UNKNOWN';
export function createRoleplayProgramOpeningV1(deps) {
    const disposal = new AbortController(), active = new Map(), running = new Set();
    const recordCaptures = new Map();
    let completedReadCandidate;
    function readRowData(table, key) {
        const value = deps[table].get(key);
        if (value !== undefined)
            assertProgramOpeningRowDataDescriptorsV1(value);
        return value;
    }
    const rowSha256 = (table, key) => {
        const value = readRowData(table, key);
        return value === undefined ? null : recordSha256(value);
    };
    function actualSession(id) {
        disposal.signal.throwIfAborted();
        const session = deps.session(id);
        if (!session)
            fail('PROGRAM_OPENING_SESSION_UNAVAILABLE');
        deps.assertSessionCurrent(session);
        return session;
    }
    function sourceCurrent(proof) {
        try {
            const session = actualSession(proof.source.sessionId);
            if (deps.includeCardStyle(session.id) !== proof.program.includeCardStyle)
                return false;
            const actual = deps.source.capture(session.id, proof.selected.index, proof.program.includeCardStyle, () => deps.assertSessionCurrent(session));
            return actual.kind === 'captured-opening-source' && actual.proof.bindingSha256 === proof.bindingSha256;
        }
        catch {
            return false;
        }
    }
    function historicalSourceCurrent(proof) {
        try {
            const session = actualSession(proof.source.sessionId);
            return deps.source.historicalCurrent(proof, () => deps.assertSessionCurrent(session));
        }
        catch {
            return false;
        }
    }
    function exactRef(ref) {
        const value = readRowData('branch', ref.key);
        if (value === undefined || recordSha256(value) !== ref.sha256)
            fail('PROGRAM_OPENING_REFERENCE_CHANGED');
        return value;
    }
    function identityFor(context) {
        const { seed, input } = context;
        return { sessionId: seed.sessionId, operationId: seed.operationId, requestedMessageId: seed.requestedMessageId,
            production: seed.production, instructionSha256: seed.instructionSha256, intentRef: input.seedRef,
            inputRef: programOpeningRefV1(programOpeningInputKeyV1(seed.sessionId, seed.operationId), input) };
    }
    function nativeIdentity(context) {
        const { seed, input } = context;
        if (seed.production !== 'generated-opening' || typeof input.instruction !== 'string' || !seed.instructionSha256) {
            fail('PROGRAM_OPENING_GENERATION_IDENTITY_REQUIRED');
        }
        return { kind: 'programmatic-opening', sessionId: seed.sessionId, operationId: seed.operationId,
            messageId: seed.requestedMessageId, instruction: input.instruction, instructionSha256: seed.instructionSha256,
            intentRef: input.seedRef };
    }
    function intentKey(context) {
        return openingIntentKey(context.seed.sessionId, context.seed.source.importId);
    }
    function loadContext(raw) {
        if (!object(raw.seedRef) || !object(raw.inputRef))
            fail('PROGRAM_OPENING_RECORD_INVALID');
        const seed = validateProgramOpeningSeedV1(exactRef(raw.seedRef)), input = validateProgramOpeningInputV1(exactRef(raw.inputRef), seed), planRecord = raw.planRef === null ? null : object(raw.planRef)
            ? validateProgramOpeningPlanRecordV1(exactRef(raw.planRef), seed, input)
            : fail('PROGRAM_OPENING_PLAN_REF_INVALID');
        const context = { seed, input, planRecord };
        if (planRecord) {
            const eventKey = mvuInitializationEventKey(seed.sessionId, programGenesisEventIdV1(planRecord.plan)), headKey = mvuInitializationHeadKey(seed.sessionId), event = readRowData('status', eventKey), eventSha256 = event === undefined ? null : recordSha256(event), head = readRowData('status', headKey), headSha256 = head === undefined ? null : recordSha256(head), publicationRows = [{ table: 'status', key: eventKey, sha256: eventSha256 },
                { table: 'status', key: headKey, sha256: headSha256 }];
            if (event !== undefined && head !== undefined) {
                const genesis = validateProgramMvuGenesisFactsV1(event, head);
                if (recordSha256(genesis.programEvent) !== eventSha256 || recordSha256(genesis.programHead) !== headSha256)
                    fail('PROGRAM_OPENING_GENESIS_CHANGED');
                return { context: { ...context, genesis: programOpeningRecordDataV1({ programEvent: genesis.programEvent, programHead: genesis.programHead }) }, publicationRows };
            }
            return { context, publicationRows };
        }
        else {
            const key = programOpeningDomainKeyV1(seed.sessionId, seed.operationId), domain = readRowData('branch', key), digest = domain === undefined ? null : recordSha256(domain), publicationRows = [{ table: 'branch', key, sha256: digest }];
            if (domain !== undefined) {
                const absenceDomain = validateProgramOpeningAbsentDomainV1(domain, { seed, input });
                if (recordSha256(absenceDomain) !== digest)
                    fail('PROGRAM_OPENING_ABSENCE_DOMAIN_CHANGED');
                return { context: { ...context, absenceDomain }, publicationRows };
            }
            return { context, publicationRows };
        }
    }
    function capturedRecords(session, key, raw) {
        const digest = recordSha256(raw), old = recordCaptures.get(session.id);
        let currentAbsenceDomain;
        if (old?.session === session && old.key === key && old.intentSha256 === digest
            && old.rows.every(row => {
                const value = readRowData(row.table, row.key);
                if (row.table === 'branch' && old.context.absenceDomain
                    && row.key === programOpeningDomainKeyV1(session.id, old.context.seed.operationId))
                    currentAbsenceDomain = value;
                return (value === undefined ? null : recordSha256(value)) === row.sha256;
            })) {
            // These original Native subtrees have a stricter spelling contract than
            // Core JSON data. Check fresh values before reusing the matched capture;
            // changed rows still take the original cold parser and its new context.
            const { seed, input } = old.context;
            if (old.intent.nativeReceipt) {
                const native = validateProgramOpeningNativeFactsV1(raw.nativeReceipt, seed, input);
                if (old.intent.genesisEnvelope)
                    validateProgramOpeningGenesisEnvelopeV1(raw.genesisEnvelope, native, old.context);
            }
            if (old.context.absenceDomain) {
                if (!object(currentAbsenceDomain))
                    fail('PROGRAM_OPENING_ABSENCE_DOMAIN_CHANGED');
                validateProgramOpeningNativeFactsV1(currentAbsenceDomain.nativeFacts, seed, input);
            }
            if (actualSession(session.id) !== session || rowSha256('branch', key) !== digest)
                fail('PROGRAM_OPENING_INTENT_CHANGED');
            return old;
        }
        const loaded = loadContext(raw), context = Object.freeze(loaded.context), intent = validateOpeningIntentV7(raw, context), branchRefs = [context.input.seedRef, identityFor(context).inputRef], rows = loaded.publicationRows;
        if (intent.sessionId !== session.id || key !== openingIntentKey(context.seed.sessionId, context.seed.source.importId))
            fail('PROGRAM_OPENING_IDENTITY_CONFLICT');
        if (context.planRecord)
            branchRefs.push(programOpeningRefV1(programOpeningPlanKeyV1(session.id, context.seed.operationId), context.planRecord));
        for (const ref of branchRefs) {
            if (rowSha256('branch', ref.key) !== ref.sha256)
                fail('PROGRAM_OPENING_REFERENCE_CHANGED');
            rows.push({ table: 'branch', ...ref });
        }
        // Only pure decoding is reused. Every guard rereads complete actual rows,
        // including absent publication rows; Source, Native, inventory and live
        // execution checks remain with their owners and run independently.
        if (actualSession(session.id) !== session || rowSha256('branch', key) !== digest
            || rows.some(row => rowSha256(row.table, row.key) !== row.sha256))
            fail('PROGRAM_OPENING_INTENT_CHANGED');
        const captured = { session, key, intentSha256: digest, rows, context, intent };
        recordCaptures.set(session.id, captured);
        return captured;
    }
    /** Complete actual record read. The caller owns its Source/Native gate;
     * this private result alone is never a readiness or Source observation. */
    function readRecordState(id) {
        try {
            disposal.signal.throwIfAborted();
            const pointer = readRowData('branch', deps.importActiveKey(id));
            if (!object(pointer) || typeof pointer.importId !== 'string')
                return { kind: 'outside-domain' };
            const key = openingIntentKey(id, pointer.importId), raw = readRowData('branch', key);
            if (!object(raw) || raw.schemaVersion !== 7)
                return { kind: 'outside-domain' };
            // A Source child can carry only an inherited archive before activation.
            // No local opening exists to require current execution in that case.
            const session = actualSession(id);
            const { context, intent } = capturedRecords(session, key, raw);
            if (intent.sessionId !== id)
                return { kind: 'blocked', code: 'PROGRAM_OPENING_SOURCE_CHANGED' };
            return { kind: 'ready', context, intent };
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    function withSourceCurrent(found) {
        return found.kind === 'ready' && !(found.intent.status === 'completed'
            ? historicalSourceCurrent(found.context.input.source) : sourceCurrent(found.context.input.source))
            ? { kind: 'blocked', code: 'PROGRAM_OPENING_SOURCE_CHANGED' } : found;
    }
    function read(id) { return withSourceCurrent(readRecordState(id)); }
    /** A private decoded record selects the Source proof to compare. It is not
     * a current row witness: completed verification must still read every real
     * row after Source before this candidate can become a successful read. */
    function completedCandidate(id) {
        try {
            disposal.signal.throwIfAborted();
            const pointer = readRowData('branch', deps.importActiveKey(id)), old = recordCaptures.get(id);
            if (object(pointer) && typeof pointer.importId === 'string' && old
                && old.key === openingIntentKey(id, pointer.importId) && old.intent.status === 'completed'
                && rowSha256('branch', old.key) === old.intentSha256) {
                if (old.session === actualSession(id))
                    return { kind: 'ready', context: old.context, intent: old.intent };
            }
            return readRecordState(id);
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    /** Native predicate used after basis has checked its actual Source owner.
     * Re-read the complete current records and Native span, without recursively
     * entering the unrelated Source observation. This result grants no Source,
     * preparation, publication or dispatch permission. */
    function nativeFactsCurrent(identity, facts) {
        try {
            const found = readRecordState(identity.sessionId);
            const frame = completedReadCandidate;
            if (frame && frame.capture.session.id === identity.sessionId) {
                const actual = recordCaptures.get(identity.sessionId);
                if (found.kind !== 'ready' || !actual || actual !== frame.capture
                    || found.context !== actual.context || found.intent !== actual.intent)
                    return false;
                // Only the actual complete post-Source read creates this witness.
                // Identity comparisons against the private capture do not create one.
                frame.observed = actual;
            }
            return found.kind === 'ready' && same(identityFor(found.context), identity) && nativeCurrent(found.context, facts, false);
        }
        catch {
            return false;
        }
    }
    /** Complete record data over this owner's actual Session and table. The
     * absence scanner uses these typed rows after its separate Source/Native
     * check; reading them supplies no readiness or executable capability. */
    function readOwnedAbsenceRecordRows(id) {
        const found = readRecordState(id);
        if (found.kind === 'blocked')
            fail(found.code);
        if (found.kind !== 'ready' || found.context.planRecord || found.intent.status !== 'completed'
            || !found.context.absenceDomain)
            return Object.freeze([]);
        const { seed, input, absenceDomain } = found.context, rows = [{ key: programOpeningSeedKeyV1(id, seed.operationId), value: seed },
            { key: programOpeningInputKeyV1(id, seed.operationId), value: input },
            { key: programOpeningDomainKeyV1(id, seed.operationId), value: absenceDomain },
            { key: openingIntentKey(id, seed.source.importId), value: found.intent }];
        return Object.freeze(rows.map(row => {
            // Parsed seed/input rows already own a frozen whole-row data digest.
            // The actual stored row below still receives a fresh read and hash.
            const sha256 = programOpeningRefV1(row.key, row.value).sha256;
            if (rowSha256('branch', row.key) !== sha256)
                fail('PROGRAM_OPENING_REFERENCE_CHANGED');
            return Object.freeze({ ...row, sha256, value: row.value });
        }));
    }
    function currentRecords(context) {
        const raw = readRowData('branch', intentKey(context));
        if (!object(raw))
            fail('PROGRAM_OPENING_INTENT_CHANGED');
        exactRef(context.input.seedRef);
        exactRef(identityFor(context).inputRef);
        if (context.planRecord)
            exactRef(programOpeningRefV1(programOpeningPlanKeyV1(context.seed.sessionId, context.seed.operationId), context.planRecord));
        const { context: current, intent } = capturedRecords(actualSession(context.seed.sessionId), intentKey(context), raw);
        // These children come from the private bounded validators after every
        // actual stored row was freshly hashed above. Identity only skips comparing
        // the same immutable parsed child to itself; foreign copies take full SHA.
        if (current.seed !== context.seed && !same(current.seed, context.seed)
            || current.input !== context.input && !same(current.input, context.input)
            || current.planRecord !== context.planRecord && !same(current.planRecord, context.planRecord)) {
            fail('PROGRAM_OPENING_IDENTITY_CONFLICT');
        }
        return intent;
    }
    function ownedRows(context) {
        const rows = [], identity = identityFor(context), refs = [identity.intentRef, identity.inputRef];
        if (context.planRecord)
            refs.push(programOpeningRefV1(programOpeningPlanKeyV1(context.seed.sessionId, context.seed.operationId), context.planRecord));
        for (const ref of refs) {
            const value = exactRef(ref);
            if (!object(value))
                fail('PROGRAM_OPENING_OWNED_ROW_INVALID');
            rows.push({ key: ref.key, value });
        }
        const intent = currentRecords(context);
        rows.push({ key: intentKey(context), value: intent });
        const hot = active.get(context.seed.sessionId);
        if (hot && same(hot.context.input, context.input)) {
            rows.push(...hot.phaseRows.values(), ...(hot.material?.ownedRows() ?? []));
        }
        const actual = deps.readNativeFacts(context, intent.committedTurn);
        if (actual)
            rows.push(...deps.readHistoricalOwnedRows(context, actual.facts));
        const domain = readRowData('branch', programOpeningDomainKeyV1(context.seed.sessionId, context.seed.operationId));
        if (domain !== undefined && context.input.initialization === 'absent') {
            const valid = validateProgramOpeningAbsentDomainV1(domain, { seed: context.seed, input: context.input });
            rows.push({ key: programOpeningDomainKeyV1(context.seed.sessionId, context.seed.operationId),
                value: valid });
        }
        const unique = new Map();
        for (const row of rows) {
            const prior = unique.get(row.key);
            if (prior && !same(prior.value, row.value))
                fail('PROGRAM_OPENING_OWNED_ROW_CONFLICT');
            unique.set(row.key, row);
        }
        return [...unique.values()];
    }
    function nativeCurrent(context, facts, requireAck) {
        try {
            const current = deps.readNativeFacts(context, facts.receipt.turn);
            return !!current && same(current.facts, facts) && (!requireAck || facts.production === 'selected-card-copy'
                || current.closingAcknowledged && current.ownerReceiptSha256 === recordSha256(currentRecords(context).domainReceipt));
        }
        catch {
            return false;
        }
    }
    function invocationCurrent(identity, ref) {
        try {
            const hot = active.get(identity.sessionId);
            if (!hot || !deps.isActualAgent(hot.agent) || deps.session(identity.sessionId) !== hot.session
                || !same(identityFor(hot.context), identity))
                return false;
            const event = hot.session.snapshotEvents()[ref.seq];
            if (event?.type !== 'opening/invocation' || nativeInputSha256(event) !== ref.sha256)
                return false;
            const data = validateNativeOpeningInvocationV1(event.data);
            return same(data.identity, hot.identity) && data.prefix.eventCount === hot.context.input.basis.native.eventCount
                && data.prefix.sha256 === nativeInputSha256(hot.session.snapshotEvents().slice(0, ref.seq));
        }
        catch {
            return false;
        }
    }
    function openingCurrent(plan, native) {
        try {
            const readout = read(plan.identity.sessionId);
            if (readout.kind !== 'ready' || !readout.context.planRecord || !same(readout.context.planRecord.plan, plan))
                return false;
            const intent = currentRecords(readout.context);
            return ['native-committed', 'domain-blocked', 'completed'].includes(intent.status)
                && !!intent.nativeReceipt && same(intent.nativeReceipt.receipt, native.receipt)
                && same(intent.nativeReceipt.canonical, native.canonical);
        }
        catch {
            return false;
        }
    }
    const publisher = createProgramMvuGenesisPublisherV1({ table: { get: key => deps.status.get(key),
            put: (key, value) => {
                return deps.status.put(key, value);
            } }, withSourceLock: deps.withSourceLock,
        isSourceCurrent: plan => sourceCurrent(plan.source), isOpeningCurrent: openingCurrent,
        isNativeCurrent: (plan, native) => {
            const found = read(plan.identity.sessionId);
            return found.kind === 'ready' && !!found.intent.nativeReceipt && same(found.intent.nativeReceipt.receipt, native.receipt)
                && nativeCurrent(found.context, found.intent.nativeReceipt, false);
        },
        isBasisCurrent: (plan, native, event, head) => {
            const found = read(plan.identity.sessionId);
            return found.kind === 'ready' && deps.basis.currentForPublication(plan, native, event, head, ownedRows(found.context));
        },
        isHistoricalBasisCurrent: (plan, native) => deps.basis.historicalCurrent(plan, native),
        lookupNative: async () => ({ status: 'unknown' }) });
    /** Every original write is awaited, even when its acknowledgement fails or
     * cancellation arrives. Exact readback can recover a lost acknowledgement. */
    async function writeExact(key, value, signal) {
        signal.throwIfAborted();
        const before = readRowData('branch', key);
        if (before !== undefined && !same(before, value))
            fail('PROGRAM_OPENING_ROW_CONFLICT');
        if (before === undefined)
            try {
                await deps.branch.put(key, programOpeningRecordDataV1(value));
            }
            catch (error) {
                if (!same(deps.branch.get(key), value))
                    throw error;
            }
        if (!same(deps.branch.get(key), value))
            fail('PROGRAM_OPENING_WRITE_UNCONFIRMED');
        signal.throwIfAborted();
    }
    async function updateIntent(context, next, signal) {
        signal.throwIfAborted();
        const before = currentRecords(context);
        if (next.revision !== before.revision + 1 || next.operationId !== before.operationId)
            fail('PROGRAM_OPENING_REVISION_CONFLICT');
        try {
            await deps.branch.put(intentKey(context), next);
        }
        catch (error) {
            if (!same(deps.branch.get(intentKey(context)), next))
                throw error;
        }
        if (!same(deps.branch.get(intentKey(context)), next))
            fail('PROGRAM_OPENING_INTENT_WRITE_UNCONFIRMED');
        signal.throwIfAborted();
        return next;
    }
    async function prepare(request) {
        return deps.withSourceLock(request.sessionId, async () => {
            const session = actualSession(request.sessionId), existing = read(request.sessionId);
            if (existing.kind !== 'outside-domain') {
                if (existing.kind === 'ready' && (existing.intent.operationId !== request.operationId || existing.intent.index !== request.index
                    || existing.intent.messageId !== request.messageId || existing.intent.production !== request.production
                    || existing.context.input.instruction !== request.instruction))
                    return { kind: 'blocked', code: 'PROGRAM_OPENING_IDENTITY_CONFLICT' };
                return existing;
            }
            const pointer = deps.branch.get(deps.importActiveKey(request.sessionId)), openingOutputs = [programOpeningSeedKeyV1(request.sessionId, request.operationId),
                programOpeningInputKeyV1(request.sessionId, request.operationId),
                programOpeningPlanKeyV1(request.sessionId, request.operationId),
                programOpeningDomainKeyV1(request.sessionId, request.operationId),
                ...typeof pointer?.importId === 'string' ? [openingIntentKey(request.sessionId, pointer.importId)] : []]
                .map(key => ({ table: 'branch', key }));
            // These are this opening writer's exact prospective outputs. Publishing
            // its seed/input/intent cannot invalidate the author DATA it consumed.
            const captured = deps.source.capture(request.sessionId, request.index, deps.includeCardStyle(request.sessionId), () => deps.assertSessionCurrent(session), openingOutputs);
            if (captured.kind !== 'captured-opening-source')
                return { kind: 'blocked', code: captured.diagnostics[0]?.code ?? 'PROGRAM_OPENING_SOURCE_UNAVAILABLE' };
            const proof = captured.proof, key = openingIntentKey(request.sessionId, proof.source.importId);
            if (deps.branch.get(key) !== undefined)
                return { kind: 'blocked', code: 'PROGRAM_OPENING_PRIOR_INTENT_PRESENT' };
            const basis = deps.basis.capture(proof, { sessionId: request.sessionId, operationId: request.operationId,
                requestedMessageId: request.messageId }), seed = createProgramOpeningSeedV1({ source: proof, basis,
                operationId: request.operationId, messageId: request.messageId, production: request.production, instruction: request.instruction }), seedRef = programOpeningRefV1(programOpeningSeedKeyV1(request.sessionId, request.operationId), seed), input = createProgramOpeningInputV1({ seed, seedRef, source: proof, basis, instruction: request.instruction,
                numericalSourceSha256: deps.readNumericalSourceSha256(request.sessionId) }), planRecord = input.initialization === 'raw-init-data' ? prepareProgramOpeningPlanRecordV1({ seed, input }) : null, context = { seed, input, planRecord }, intent = createPreparedOpeningIntentV7(context);
            captured.assertCurrent();
            for (const [rowKey, value] of [[seedRef.key, seed], [programOpeningInputKeyV1(request.sessionId, request.operationId), input],
                ...planRecord ? [[programOpeningPlanKeyV1(request.sessionId, request.operationId), planRecord]] : [], [key, intent]]) {
                await writeExact(rowKey, value, disposal.signal);
                captured.assertCurrent();
            }
            if (!deps.basis.currentBefore(basis, proof, identityFor(context), ownedRows(context)))
                fail('PROGRAM_OPENING_BASIS_CHANGED');
            return { kind: 'ready', context, intent };
        });
    }
    async function markUnknown(context, diagnosis) {
        await deps.withSourceLock(context.seed.sessionId, async () => {
            const before = currentRecords(context);
            if (before.status === 'completed')
                return;
            if (before.nativeReceipt) {
                await updateIntent(context, createOpeningIntentV7({ context, revision: before.revision + 1, status: 'domain-blocked',
                    nativeReceipt: before.nativeReceipt, committedTurn: before.committedTurn,
                    ...before.genesisEnvelope ? { genesisEnvelope: before.genesisEnvelope } : {}, diagnosis }), disposal.signal);
            }
            else {
                await updateIntent(context, createOpeningIntentV7({ context, revision: before.revision + 1, status: 'native-unknown', diagnosis }), disposal.signal);
            }
        });
    }
    async function settle(context, facts, signal) {
        const envelope = context.planRecord ? createProgramOpeningGenesisEnvelopeV1(facts, context) : undefined;
        await deps.withSourceLock(context.seed.sessionId, async () => {
            signal.throwIfAborted();
            if (!sourceCurrent(context.input.source) || !nativeCurrent(context, facts, false))
                fail('PROGRAM_OPENING_NATIVE_OR_SOURCE_CHANGED');
            const before = currentRecords(context);
            if (before.status === 'completed')
                return;
            if (before.nativeReceipt && !same(before.nativeReceipt, facts))
                fail('PROGRAM_OPENING_NATIVE_CHANGED');
            const next = createOpeningIntentV7({ context, revision: before.revision + 1, status: 'native-committed',
                nativeReceipt: facts, committedTurn: facts.receipt.turn, ...envelope ? { genesisEnvelope: envelope } : {} });
            await updateIntent(context, next, signal);
        });
        let completedContext, receipt;
        if (context.planRecord && envelope) {
            // Called by Native closing, or by a confirmed copy acknowledgement.
            // Never wait for the running Native driver while holding this FIFO.
            const ready = await publisher.publishFromClosing({ plan: context.planRecord.plan, native: envelope, signal });
            if (ready.kind !== 'ready')
                fail(ready.code);
            completedContext = { ...context, genesis: { programEvent: ready.genesis.programEvent, programHead: ready.genesis.programHead } };
            receipt = createProgramOpeningNumericalDomainReceiptV1(facts, completedContext);
        }
        else {
            const domain = createProgramOpeningAbsentDomainV1({ seed: context.seed, input: context.input, nativeFacts: facts }), domainRef = programOpeningRefV1(programOpeningDomainKeyV1(context.seed.sessionId, context.seed.operationId), domain);
            await deps.withSourceLock(context.seed.sessionId, async () => {
                const check = () => {
                    if (!sourceCurrent(context.input.source) || !deps.basis.currentForAbsencePublication(context.input.basis, context.input.source, identityFor(context), facts, ownedRows(context)))
                        fail('PROGRAM_OPENING_ABSENCE_BASIS_CHANGED');
                };
                check();
                await writeExact(domainRef.key, domain, signal);
                check();
            });
            completedContext = { ...context, absenceDomain: domain };
            receipt = createProgramOpeningAbsenceDomainReceiptV1(domainRef, facts, completedContext);
        }
        await deps.withSourceLock(context.seed.sessionId, async () => {
            signal.throwIfAborted();
            if (!sourceCurrent(context.input.source) || !nativeCurrent(context, facts, false))
                fail('PROGRAM_OPENING_NATIVE_OR_SOURCE_CHANGED');
            const before = currentRecords(context);
            if (before.status === 'completed') {
                if (!same(before.domainReceipt, receipt))
                    fail('PROGRAM_OPENING_DOMAIN_RECEIPT_CHANGED');
                return;
            }
            deps.verifyTemplateIntegrity();
            await updateIntent(completedContext, createOpeningIntentV7({ context: completedContext, revision: before.revision + 1,
                status: 'completed', nativeReceipt: facts, committedTurn: facts.receipt.turn, domainReceipt: receipt,
                ...envelope ? { genesisEnvelope: envelope } : {} }), signal);
        });
        return receipt;
    }
    function assertHotOwnerFacts(hot, input) {
        disposal.signal.throwIfAborted();
        if ('signal' in input)
            input.signal.throwIfAborted();
        if (active.get(hot.session.id) !== hot || deps.session(hot.session.id) !== hot.session
            || !deps.isActualAgent(hot.agent) || hot.agent.session !== hot.session)
            fail('PROGRAM_OPENING_OWNER_CHANGED');
        const identity = 'owner' in input ? input.owner.identity : input.identity;
        if (!same(identity, hot.identity))
            fail('PROGRAM_OPENING_NATIVE_IDENTITY_CHANGED');
    }
    function checkHot(hot, input) {
        try {
            assertHotOwnerFacts(hot, input);
            return { kind: 'allow' };
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    async function closeHot(hot, input, signal) {
        const receiptSha256 = input.receipt.receiptSha256;
        try {
            signal.throwIfAborted();
            if (active.get(hot.session.id) !== hot || !deps.isActualAgent(hot.agent) || !same(input.owner.identity, hot.identity)) {
                fail('PROGRAM_OPENING_OWNER_CHANGED');
            }
            const actual = deps.readNativeFacts(hot.context, input.receipt.turn);
            if (!actual || actual.facts.production !== 'generated-opening' || !same(actual.facts.receipt, input.receipt)) {
                fail('PROGRAM_OPENING_NATIVE_CHANGED');
            }
            const receipt = await settle(hot.context, actual.facts, signal);
            signal.throwIfAborted();
            return { kind: 'settled', receiptSha256, ownerReceiptSha256: recordSha256(receipt) };
        }
        catch (error) {
            try {
                await markUnknown(hot.context, codeOf(error));
            }
            catch { /* Retain the original Native receipt if the diagnostic write is unknown. */ }
            return { kind: 'unknown', receiptSha256, code: codeOf(error) };
        }
    }
    function openingPreparation(input, scope, currentSource) {
        const hot = active.get(scope.session.id);
        if (!hot || hot.session !== scope.session)
            fail('PROGRAM_OPENING_ACTUAL_PREPARATION_REQUIRED');
        const planned = hot.context.input.source.program;
        if (currentSource.sourceCurrentIdentitySha256 !== planned.sourceCurrentIdentitySha256
            || currentSource.includeCardStyle !== planned.includeCardStyle || currentSource.editorRevision !== planned.editing.revision
            || currentSource.editorHeadSha256 !== (planned.editing.headRef?.sha256 ?? null)
            || currentSource.currentNativeOverlaySha256 !== planned.book.currentNativeOverlaySha256)
            fail('PROGRAM_OPENING_SOURCE_CHANGED');
        const phase = deps.readPreparationFacts(scope.session, () => {
            assertHotOwnerFacts(hot, input);
            currentRecords(hot.context);
            const captured = deps.readPhaseA(input.owner, scope.session, input.turn);
            // Exact Phase-A outputs are enrolled by their actual writer reader.
            for (const row of captured.ownedRows)
                hot.phaseRows.set(row.key, row);
            // Source DATA was joined above from the same actual InputState capture.
            // Its initial Native/basis audit cannot reenter Source's read owner.
            if (!deps.basis.currentDuringFacts(hot.context.input.basis, hot.context.input.source, identityFor(hot.context), input.owner.invocationRef, ownedRows(hot.context)))
                fail('PROGRAM_OPENING_BASIS_CHANGED');
            return captured;
        });
        const { seed, input: packet, planRecord } = hot.context, initialization = planRecord ?
            { kind: 'pending-raw-init-data', planSha256: planRecord.plan.planSha256,
                initialValues: planRecord.plan.initialValues, initialValuesSha256: planRecord.plan.initialValuesSha256, initialized: false } :
            { kind: 'absent', markerCount: 0, inventorySha256: packet.basis.numerical.membershipSha256, initialized: false }, body = { schemaVersion: 1, encoding: 'native-program-opening-prompt-scope-read-data-v1',
            authority: 'consumer-data-only', sessionId: scope.session.id, numericalSourceSha256: packet.numericalSourceSha256,
            sourceProofSha256: packet.source.proofSha256, basisSha256: packet.basis.basisSha256, seed, input: packet,
            seedRef: packet.seedRef, inputRef: identityFor(hot.context).inputRef, nativeOwner: input.owner,
            selectedBaseSha256: input.selected.sha256, inputBindingSha256: packet.inputSha256, initialization }, data = programOpeningRecordDataV1({ ...body, scopeDataSha256: recordSha256(body) }), check = () => scope.assertOwnerFactsCurrent(), provenance = { schemaVersion: 1, encoding: 'native-program-opening-attempt-ref-v1', seedRef: packet.seedRef,
            inputRef: identityFor(hot.context).inputRef, invocationRef: input.owner.invocationRef, turn: input.turn, step: input.step }, versionSha256 = recordSha256(provenance), attemptId = `${seed.seedSha256}:${input.turn}:${input.step}`;
        return { snapshot: phase.snapshot, snapshotRef: phase.snapshotRef,
            ownedBranchRefs: phase.ownedRows.map(row => ({ key: row.key, sha256: recordSha256(row.value) })),
            scopes: { data, current: () => { try {
                    check();
                    return true;
                }
                catch {
                    return false;
                } } },
            attempt: { attemptId, traceCounter: input.owner.invocationRef.seq,
                provenance: { ownerId: scope.session.id, versionSha256,
                    ref: cloneRoleplayTavernLoreDataV1(provenance, 65_536, { nodes: 4096, depth: 16 }),
                    refSha256: versionSha256 },
                seed: { encoding: 'native-program-opening-attempt-seed-v1', seedRef: packet.seedRef,
                    invocationRef: input.owner.invocationRef, turn: input.turn, step: input.step } }, assertCurrent: check };
    }
    async function execute(request) {
        let prepared;
        try {
            prepared = await prepare(request);
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
        if (prepared.kind !== 'ready')
            return prepared;
        const context = prepared.context, session = actualSession(request.sessionId);
        if (prepared.intent.status === 'completed')
            return verified(request.sessionId);
        const signal = disposal.signal;
        try {
            await deps.loadTemplate(signal);
            if (request.production === 'selected-card-copy') {
                const found = await deps.lookupCopy(context);
                let turn;
                if (found.status === 'committed')
                    turn = found.turn;
                else {
                    if (found.status !== 'absent' || prepared.intent.status !== 'prepared') {
                        await markUnknown(context, 'PROGRAM_OPENING_NATIVE_UNKNOWN');
                        return read(request.sessionId);
                    }
                    await deps.withSourceLock(request.sessionId, async () => {
                        if (!sourceCurrent(context.input.source) || !deps.basis.currentBefore(context.input.basis, context.input.source, identityFor(context), ownedRows(context)))
                            fail('PROGRAM_OPENING_BASIS_CHANGED');
                        deps.verifyTemplateIntegrity();
                    });
                    const committed = await deps.appendCopy(context);
                    if (committed.kind !== 'committed') {
                        await markUnknown(context, committed.kind === 'busy' ? 'PROGRAM_OPENING_NATIVE_BUSY' : 'PROGRAM_OPENING_NATIVE_UNKNOWN');
                        return read(request.sessionId);
                    }
                    turn = committed.turn;
                }
                const actual = deps.readNativeFacts(context, turn);
                if (!actual || actual.facts.production !== 'selected-card-copy')
                    fail('PROGRAM_OPENING_COPY_RECEIPT_UNKNOWN');
                await settle(context, actual.facts, signal);
                return verified(request.sessionId);
            }
            const agent = await deps.resolveAgent(request.sessionId);
            if (!agent || !deps.isActualAgent(agent) || agent.session !== session)
                fail('PROGRAM_OPENING_NATIVE_PROTOCOL_REQUIRED');
            if (active.has(session.id))
                fail('PROGRAM_OPENING_NATIVE_BUSY');
            const hot = { session, agent, context, identity: nativeIdentity(context), phaseRows: new Map() };
            active.set(session.id, hot);
            try {
                const inspection = agent.lookupProgrammaticOpening({ operationId: request.operationId, messageId: request.messageId,
                    instruction: context.input.instruction, opening: { schemaVersion: 1, kind: 'programmatic-opening', intentRef: context.input.seedRef } });
                if (inspection.kind === 'absent' && prepared.intent.status !== 'prepared') {
                    await markUnknown(context, 'PROGRAM_OPENING_NATIVE_UNKNOWN');
                    return read(session.id);
                }
                hot.material = createRoleplayOpeningMaterialOwnerV1(deps.material(), { session, identity: hot.identity,
                    seedRef: context.input.seedRef, inputRef: identityFor(context).inputRef,
                    table: { get: key => deps.branch.get(key), put: (key, value) => {
                            return deps.branch.put(key, value);
                        } }, enqueue: work => deps.withSourceLock(session.id, work),
                    assertOwnerFactsCurrent: input => assertHotOwnerFacts(hot, input),
                    check: input => checkHot(hot, input), closing: (input, closingSignal) => closeHot(hot, input, closingSignal) });
                hot.unregister = agent.registerOpeningMaterialOwner(hot.material.requestMaterial);
                const result = await agent.generateProgrammaticAssistant({ operationId: request.operationId, messageId: request.messageId,
                    instruction: context.input.instruction, opening: { schemaVersion: 1, kind: 'programmatic-opening', intentRef: context.input.seedRef } });
                if (result.kind !== 'committed')
                    await markUnknown(context, result.kind === 'busy' ? 'PROGRAM_OPENING_NATIVE_BUSY' :
                        /^[A-Z][A-Z0-9_]{0,95}$/.test(result.reason) ? result.reason : 'PROGRAM_OPENING_NATIVE_UNKNOWN');
                return verified(session.id);
            }
            finally {
                hot.unregister?.();
                await hot.material?.dispose();
                if (active.get(session.id) === hot)
                    active.delete(session.id);
            }
        }
        catch (error) {
            try {
                await markUnknown(context, codeOf(error));
            }
            catch { /* Preserve the original durable failure anchor. */ }
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    function run(request) {
        const operation = execute(request);
        running.add(operation);
        void operation.finally(() => running.delete(operation)).catch(() => { });
        return operation;
    }
    function verified(id) {
        const found = completedCandidate(id);
        if (found.kind !== 'ready' || found.intent.status !== 'completed' || !found.intent.nativeReceipt)
            return withSourceCurrent(found);
        const capture = recordCaptures.get(id), identity = identityFor(found.context);
        if (!capture || capture.context !== found.context || capture.intent !== found.intent) {
            return { kind: 'blocked', code: 'PROGRAM_OPENING_INTENT_CHANGED' };
        }
        const previous = completedReadCandidate, frame = { capture, observed: undefined };
        completedReadCandidate = frame;
        try {
            // Completed history pins the actual immutable import origin. Editable
            // author data is owned by today's InputState Source capture.
            if (!deps.basis.historicalFactsCurrent(found.context.input.basis, found.context.input.source, identity, found.intent.nativeReceipt)) {
                // A diagnostic read can classify a refusal, never turn it into success.
                return { kind: 'blocked', code: historicalSourceCurrent(found.context.input.source)
                        ? 'PROGRAM_OPENING_NATIVE_CHANGED' : 'PROGRAM_OPENING_SOURCE_CHANGED' };
            }
            if (frame.observed !== capture) {
                // Alternate factual adapters must not omit the real post-Source row
                // check. The normal basis adapter already performs it through Native.
                const actual = readRecordState(id);
                if (actual.kind !== 'ready' || recordCaptures.get(id) !== capture
                    || actual.context !== capture.context || actual.intent !== capture.intent) {
                    return { kind: 'blocked', code: 'PROGRAM_OPENING_INTENT_CHANGED' };
                }
            }
            if (!nativeCurrent(found.context, found.intent.nativeReceipt, true))
                return { kind: 'blocked', code: 'PROGRAM_OPENING_NATIVE_CHANGED' };
            return found;
        }
        finally {
            completedReadCandidate = previous;
        }
    }
    function readGenesis(id) {
        const found = verified(id);
        if (found.kind !== 'ready' || found.intent.status !== 'completed'
            || !found.context.planRecord || !found.context.genesis)
            return;
        // verified already joins the fresh event/head, plan, original Native span,
        // Source and domain receipt/ACK. Convert that same synchronous DATA instead
        // of entering the publisher and repeating its complete owner checks.
        try {
            return validateProgramMvuGenesisFactsV1(found.context.genesis.programEvent, found.context.genesis.programHead);
        }
        catch {
            return undefined;
        }
    }
    return { run, read, verified, readGenesis, openingPreparation, ownedRows, identityFor, sourceCurrent, historicalSourceCurrent, nativeFactsCurrent,
        readOwnedAbsenceRecordRows,
        invocationCurrent, nativeCurrent,
        ownsAgent: (agent, turn) => {
            for (const hot of active.values())
                if (hot.agent === agent && deps.isActualAgent(hot.agent)) {
                    const generation = hot.agent.programmaticGeneration;
                    if (generation?.operationId !== hot.context.seed.operationId)
                        return false;
                    if (turn === undefined)
                        return true;
                    const event = hot.session.snapshotEvents().find(row => row.type === 'opening/invocation'
                        && row.data.identity.operationId === hot.context.seed.operationId);
                    return event?.type === 'opening/invocation' && event.data.expectedTurn === turn;
                }
            return false;
        },
        catalog(id) {
            return (async () => deps.withSourceLock(id, async () => {
                const session = actualSession(id), captured = deps.source.capture(id, 0, deps.includeCardStyle(id), () => deps.assertSessionCurrent(session));
                return captured.kind === 'captured-opening-source' ? captured.proof.catalog : undefined;
            }))();
        },
        async dispose() {
            disposal.abort(Error('PROGRAM_OPENING_OWNER_DISPOSED'));
            recordCaptures.clear();
            deps.source.dispose();
            for (const hot of active.values())
                hot.material?.revoke();
            await Promise.allSettled([...running]);
        } };
}
