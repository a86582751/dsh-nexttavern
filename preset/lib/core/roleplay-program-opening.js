// Generated from runtime/alpha3/src/core/roleplay-program-opening.ts; edit the TypeScript source.
/** Own the actual first-opening transaction and its Native closing handoff.
 * Immutable records explain recovery; actual Session/Source/Native readers
 * independently decide every append, material and publication permission. */
import { nativeInputSha256, validateNativeOpeningInvocationV1 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256, sha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { createProgramOpeningRowFactsV1 } from './roleplay-program-opening-row-facts.js';
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
    const sourceCaptures = new Map();
    const recordCaptures = new Map();
    let completedReadCandidate;
    const rowFacts = createProgramOpeningRowFactsV1((table, key) => deps[table].get(key));
    const rowSha256 = (table, key) => {
        const value = rowFacts.read(table, key);
        return value === undefined ? null : rowFacts.digestRow(table, key, value);
    };
    function withSourceLock(id, work) {
        rowFacts.assertWriteAllowed();
        return deps.withSourceLock(id, () => {
            rowFacts.assertWriteAllowed();
            return work();
        });
    }
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
            let capture = sourceCaptures.get(session.id);
            if (!capture || capture.session !== session || capture.bindingSha256 !== proof.bindingSha256) {
                // Cold readers recapture real rows before retaining an observation.
                // A serialized binding can only be compared to that actual capture;
                // it cannot recreate its closure or its live Session provenance.
                const actual = deps.source.capture(session.id, proof.selected.index, proof.program.includeCardStyle, () => deps.assertSessionCurrent(session));
                if (actual.kind !== 'captured-opening-source' || actual.proof.bindingSha256 !== proof.bindingSha256)
                    return false;
                capture = { session, bindingSha256: proof.bindingSha256, assertCurrent: actual.assertCurrent };
                sourceCaptures.set(session.id, capture);
            }
            capture.assertCurrent();
            return true;
        }
        catch {
            return false;
        }
    }
    function exactRef(ref) {
        const value = rowFacts.read('branch', ref.key);
        if (value === undefined || rowFacts.digestRow('branch', ref.key, value) !== ref.sha256)
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
            const eventKey = mvuInitializationEventKey(seed.sessionId, programGenesisEventIdV1(planRecord.plan)), headKey = mvuInitializationHeadKey(seed.sessionId), event = rowFacts.read('status', eventKey), eventSha256 = event === undefined ? null : rowFacts.digestRow('status', eventKey, event), head = rowFacts.read('status', headKey), headSha256 = head === undefined ? null : rowFacts.digestRow('status', headKey, head), publicationRows = [{ table: 'status', key: eventKey, sha256: eventSha256 },
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
            const key = programOpeningDomainKeyV1(seed.sessionId, seed.operationId), domain = rowFacts.read('branch', key), digest = domain === undefined ? null : rowFacts.digestRow('branch', key, domain), publicationRows = [{ table: 'branch', key, sha256: digest }];
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
        const digest = rowFacts.digestRow('branch', key, raw), old = recordCaptures.get(session.id);
        let currentAbsenceDomain;
        if (old?.session === session && old.key === key && old.intentSha256 === digest
            && old.rows.every(row => {
                const value = rowFacts.read(row.table, row.key);
                if (row.table === 'branch' && old.context.absenceDomain
                    && row.key === programOpeningDomainKeyV1(session.id, old.context.seed.operationId))
                    currentAbsenceDomain = value;
                return (value === undefined ? null : rowFacts.digestRow(row.table, row.key, value)) === row.sha256;
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
            const session = actualSession(id);
            const pointer = rowFacts.read('branch', deps.importActiveKey(id));
            if (!object(pointer) || typeof pointer.importId !== 'string')
                return { kind: 'outside-domain' };
            const key = openingIntentKey(id, pointer.importId), raw = rowFacts.read('branch', key);
            if (!object(raw) || raw.schemaVersion !== 7)
                return { kind: 'outside-domain' };
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
        return found.kind === 'ready' && !sourceCurrent(found.context.input.source)
            ? { kind: 'blocked', code: 'PROGRAM_OPENING_SOURCE_CHANGED' } : found;
    }
    function read(id) { return withSourceCurrent(readRecordState(id)); }
    /** Root's one synchronous factual composition only. Eligibility selects an
     * optimization, never a saved readiness result or a Source/Native permission. */
    function withSynchronousAbsenceRowFacts(id, checks) {
        rowFacts.assertCanEnter();
        const capture = recordCaptures.get(id), sourceCapture = sourceCaptures.get(id);
        if (!capture || !sourceCapture || capture.intent.schemaVersion !== 7 || capture.intent.mode !== 'prompt-program'
            || capture.intent.status !== 'completed' || capture.intent.production !== 'selected-card-copy'
            || capture.intent.nativeReceipt?.production !== 'selected-card-copy' || capture.context.planRecord
            || !capture.context.absenceDomain || capture.context.input.initialization !== 'absent'
            || capture.context.input.source.sourceRelation.kind !== 'own-root-source'
            || sourceCapture.session !== capture.session || deps.session(id) !== capture.session
            || sourceCapture.bindingSha256 !== capture.context.input.source.bindingSha256 || active.has(id)) {
            rowFacts.withSynchronousRows(undefined, checks);
            return;
        }
        const session = capture.session, pointerKey = deps.importActiveKey(id), pointerSha256 = recordSha256(capture.context.input.source.source.pointer), branch = deps.branch, status = deps.status, source = deps.source, basis = deps.basis, branchGet = branch.get, branchPut = branch.put, statusGet = status.get, statusPut = status.put, branchEntries = branch.entries, statusEntries = status.entries, sourceAssertion = sourceCapture.assertCurrent, bindingKeys = ['session', 'assertSessionCurrent', 'importActiveKey', 'readNativeFacts',
            'readHistoricalOwnedRows', 'includeCardStyle', 'withSourceLock'], bindings = bindingKeys.map(key => deps[key]), rows = new Map();
        for (const row of [{ table: 'branch', key: pointerKey, sha256: pointerSha256 },
            { table: 'branch', key: capture.key, sha256: capture.intentSha256 }, ...capture.rows]) {
            const address = row.table + ':' + row.key, old = rows.get(address);
            if (old && old.sha256 !== row.sha256) {
                rowFacts.withSynchronousRows(undefined, checks);
                return;
            }
            rows.set(address, { ...row });
        }
        const assertBindings = () => {
            if (deps.branch !== branch || deps.status !== status || branch.get !== branchGet || branch.put !== branchPut
                || status.get !== statusGet || status.put !== statusPut
                || branch.entries !== branchEntries
                || status.entries !== statusEntries
                || deps.source !== source || deps.basis !== basis || bindingKeys.some((key, index) => deps[key] !== bindings[index])) {
                fail('PROGRAM_OPENING_ROW_FACTS_BINDING_CHANGED');
            }
            if (actualSession(id) !== session || recordCaptures.get(id) !== capture || sourceCaptures.get(id) !== sourceCapture
                || sourceCapture.session !== session || sourceCapture.assertCurrent !== sourceAssertion
                || sourceCapture.bindingSha256 !== capture.context.input.source.bindingSha256
                || deps.importActiveKey(id) !== pointerKey)
                fail('PROGRAM_OPENING_ROW_FACTS_BINDING_CHANGED');
        };
        rowFacts.withSynchronousRows({ sessionId: id, rows: [...rows.values()], assertBindings }, checks);
    }
    /** Only this original Session/factory can expose its current detached data.
     * A miss supplies no observation; Source/Native/full namespace checks stay separate. */
    function activeStaticNamespaceRow(session, table, key) {
        const capture = recordCaptures.get(session.id);
        if (!capture || capture.session !== session || deps.session(session.id) !== session)
            return;
        return rowFacts.activeStaticNamespaceRow(session.id, table, key);
    }
    /** A private decoded record selects the Source proof to compare. It is not
     * a current row witness: completed verification must still read every real
     * row after Source before this candidate can become a successful read. */
    function completedCandidate(id) {
        try {
            const session = actualSession(id), pointer = rowFacts.read('branch', deps.importActiveKey(id)), old = recordCaptures.get(id);
            if (object(pointer) && typeof pointer.importId === 'string' && old?.session === session
                && old.key === openingIntentKey(id, pointer.importId) && old.intent.status === 'completed'
                && rowSha256('branch', old.key) === old.intentSha256) {
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
        const raw = rowFacts.read('branch', intentKey(context));
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
        const domain = rowFacts.read('branch', programOpeningDomainKeyV1(context.seed.sessionId, context.seed.operationId));
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
                rowFacts.assertWriteAllowed();
                return deps.status.put(key, value);
            } }, withSourceLock,
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
        rowFacts.assertWriteAllowed();
        signal.throwIfAborted();
        const before = rowFacts.read('branch', key);
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
        rowFacts.assertWriteAllowed();
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
        rowFacts.assertWriteAllowed();
        return withSourceLock(request.sessionId, async () => {
            const session = actualSession(request.sessionId), existing = read(request.sessionId);
            if (existing.kind !== 'outside-domain') {
                if (existing.kind === 'ready' && (existing.intent.operationId !== request.operationId || existing.intent.index !== request.index
                    || existing.intent.messageId !== request.messageId || existing.intent.production !== request.production
                    || existing.context.input.instruction !== request.instruction))
                    return { kind: 'blocked', code: 'PROGRAM_OPENING_IDENTITY_CONFLICT' };
                return existing;
            }
            const captured = deps.source.capture(request.sessionId, request.index, deps.includeCardStyle(request.sessionId), () => deps.assertSessionCurrent(session));
            if (captured.kind !== 'captured-opening-source')
                return { kind: 'blocked', code: captured.diagnostics[0]?.code ?? 'PROGRAM_OPENING_SOURCE_UNAVAILABLE' };
            const proof = captured.proof, key = openingIntentKey(request.sessionId, proof.source.importId);
            sourceCaptures.set(session.id, { session, bindingSha256: proof.bindingSha256, assertCurrent: captured.assertCurrent });
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
        rowFacts.assertWriteAllowed();
        await withSourceLock(context.seed.sessionId, async () => {
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
        rowFacts.assertWriteAllowed();
        const envelope = context.planRecord ? createProgramOpeningGenesisEnvelopeV1(facts, context) : undefined;
        await withSourceLock(context.seed.sessionId, async () => {
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
            await withSourceLock(context.seed.sessionId, async () => {
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
        await withSourceLock(context.seed.sessionId, async () => {
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
    function assertHot(hot, input) {
        // This callback is the synchronous front door of Native material prepare,
        // transform/check and owner state writes, before their async work starts.
        rowFacts.assertWriteAllowed();
        disposal.signal.throwIfAborted();
        deps.assertSessionCurrent(hot.session);
        if (active.get(hot.session.id) !== hot || !deps.isActualAgent(hot.agent) || hot.agent.session !== hot.session
            || !sourceCurrent(hot.context.input.source))
            fail('PROGRAM_OPENING_OWNER_CHANGED');
        const identity = 'owner' in input ? input.owner.identity : input.identity;
        if (!same(identity, hot.identity))
            fail('PROGRAM_OPENING_NATIVE_IDENTITY_CHANGED');
        currentRecords(hot.context);
        if ('owner' in input) {
            const event = hot.session.snapshotEvents()[input.owner.invocationRef.seq];
            if (event?.type !== 'opening/invocation')
                fail('PROGRAM_OPENING_INVOCATION_CHANGED');
            const phase = deps.readPhaseA(input.owner, hot.session, event.data.expectedTurn);
            phase.assertCurrent();
            for (const row of phase.ownedRows)
                hot.phaseRows.set(row.key, row);
            if (!deps.basis.currentDuring(hot.context.input.basis, hot.context.input.source, identityFor(hot.context), input.owner.invocationRef, ownedRows(hot.context)))
                fail('PROGRAM_OPENING_BASIS_CHANGED');
        }
    }
    function checkHot(hot, input) {
        rowFacts.assertWriteAllowed();
        try {
            if ('owner' in input) {
                assertHot(hot, input);
                return { kind: 'allow' };
            }
            disposal.signal.throwIfAborted();
            input.signal.throwIfAborted();
            deps.assertSessionCurrent(hot.session);
            if (!deps.isActualAgent(hot.agent) || active.get(hot.session.id) !== hot || !same(input.identity, hot.identity)
                || !sourceCurrent(hot.context.input.source))
                fail('PROGRAM_OPENING_OWNER_CHANGED');
            const intent = currentRecords(hot.context);
            if (input.phase === 'invocation-reservation') {
                if (intent.status !== 'prepared' || !deps.basis.currentBefore(hot.context.input.basis, hot.context.input.source, identityFor(hot.context), ownedRows(hot.context)))
                    fail('PROGRAM_OPENING_BASIS_CHANGED');
            }
            else if (input.phase === 'invocation-reserved') {
                // Native has flushed this exact invocation but has not started Phase-A.
                // Keep the captured prefix and actual live invocation owner checks.
                if (intent.status !== 'prepared' || !deps.basis.currentDuring(hot.context.input.basis, hot.context.input.source, identityFor(hot.context), input.invocationRef, ownedRows(hot.context)))
                    fail('PROGRAM_OPENING_BASIS_CHANGED');
            }
            else {
                const facts = deps.readNativeFacts(hot.context, intent.committedTurn);
                if (!facts || !deps.basis.historicalFactsCurrent(hot.context.input.basis, hot.context.input.source, identityFor(hot.context), facts.facts))
                    fail('PROGRAM_OPENING_NATIVE_CHANGED');
            }
            deps.verifyTemplateIntegrity();
            return { kind: 'allow' };
        }
        catch (error) {
            return { kind: 'blocked', code: codeOf(error) };
        }
    }
    async function closeHot(hot, input, signal) {
        rowFacts.assertWriteAllowed();
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
    function openingPreparation(input, scope) {
        rowFacts.assertWriteAllowed();
        const hot = active.get(scope.session.id);
        if (!hot || hot.session !== scope.session)
            fail('PROGRAM_OPENING_ACTUAL_PREPARATION_REQUIRED');
        const phase = deps.readPhaseA(input.owner, scope.session, input.turn);
        // Register only exact values supplied by the actual Phase-A writer reader,
        // never every row under a prefix or a claimed serialized owner flag.
        for (const row of phase.ownedRows)
            hot.phaseRows.set(row.key, row);
        assertHot(hot, input);
        phase.assertCurrent();
        const { seed, input: packet, planRecord } = hot.context, initialization = planRecord ?
            { kind: 'pending-raw-init-data', planSha256: planRecord.plan.planSha256,
                initialValues: planRecord.plan.initialValues, initialValuesSha256: planRecord.plan.initialValuesSha256, initialized: false } :
            { kind: 'absent', markerCount: 0, inventorySha256: packet.basis.numerical.membershipSha256, initialized: false }, body = { schemaVersion: 1, encoding: 'native-program-opening-prompt-scope-read-data-v1',
            authority: 'consumer-data-only', sessionId: scope.session.id, numericalSourceSha256: packet.numericalSourceSha256,
            sourceProofSha256: packet.source.proofSha256, basisSha256: packet.basis.basisSha256, seed, input: packet,
            seedRef: packet.seedRef, inputRef: identityFor(hot.context).inputRef, nativeOwner: input.owner,
            selectedBaseSha256: input.selected.sha256, inputBindingSha256: packet.inputSha256, initialization }, data = programOpeningRecordDataV1({ ...body, scopeDataSha256: recordSha256(body) }), check = () => { phase.assertCurrent(); assertHot(hot, input); }, provenance = { schemaVersion: 1, encoding: 'native-program-opening-attempt-ref-v1', seedRef: packet.seedRef,
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
        rowFacts.assertWriteAllowed();
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
                    await withSourceLock(request.sessionId, async () => {
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
                            rowFacts.assertWriteAllowed();
                            return deps.branch.put(key, value);
                        } }, enqueue: work => withSourceLock(session.id, work), assertCurrent: input => assertHot(hot, input),
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
        rowFacts.assertWriteAllowed();
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
            // basis enters the original full Source owner before checking the actual
            // retained prefix and Native facts. A successful completed read needs one
            // complete Source gate here; read() retains its own gate for other callers.
            if (!deps.basis.historicalFactsCurrent(found.context.input.basis, found.context.input.source, identity, found.intent.nativeReceipt)) {
                // A diagnostic read can classify a refusal, never turn it into success.
                return { kind: 'blocked', code: sourceCurrent(found.context.input.source)
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
    /** Capture the original private record/Source observations, never a JSON
     * reconstruction or caller's claimed successful gate. Root must bracket
     * synchronous factual composition with its actual full Source owner. */
    function captureCompletedAbsenceOwnerFacts(id) {
        const found = verified(id);
        if (found.kind !== 'ready' || found.intent.status !== 'completed' || !found.intent.nativeReceipt
            || found.context.planRecord || !found.context.absenceDomain)
            return;
        const capture = recordCaptures.get(id), sourceCapture = sourceCaptures.get(id);
        if (!capture || capture.context !== found.context || capture.intent !== found.intent || !sourceCapture
            || sourceCapture.session !== capture.session || sourceCapture.bindingSha256 !== found.context.input.source.bindingSha256) {
            fail('PROGRAM_OPENING_OWNER_FACTS_CHANGED');
        }
        const { context, intent } = capture, facts = found.intent.nativeReceipt, pointerKey = deps.importActiveKey(id), pointerSha256 = recordSha256(context.input.source.source.pointer), headerSha256 = recordSha256(capture.session.header), identity = identityFor(context), rows = new Map();
        for (const row of capture.rows)
            rows.set(row.table + ':' + row.key, { ...row });
        if (facts.production === 'generated-opening') {
            // Native's completed receipt binds immutable Core material publications.
            // Mutable Phase-A preparation/window rows remain with their own current
            // readers and are not frozen to a historical opening version here.
            for (const step of facts.receipt.steps)
                for (const request of step.requests) {
                    for (const ref of [request.snapshot, request.plan]) {
                        const address = 'branch:' + ref.key, prior = rows.get(address);
                        if (prior && prior.sha256 !== ref.sha256)
                            fail('PROGRAM_OPENING_OWNED_ROW_CONFLICT');
                        rows.set(address, { table: 'branch', key: ref.key, sha256: ref.sha256 });
                    }
                }
        }
        const publicationRows = Object.freeze([...rows.values()].map(row => Object.freeze(row)));
        const assertRecordFactsCurrent = () => {
            const session = actualSession(id);
            if (session !== capture.session || recordCaptures.get(id) !== capture || sourceCaptures.get(id) !== sourceCapture
                || sourceCapture.session !== session || sourceCapture.bindingSha256 !== context.input.source.bindingSha256
                || recordSha256(session.header) !== headerSha256 || deps.importActiveKey(id) !== pointerKey) {
                fail('PROGRAM_OPENING_OWNER_FACTS_CHANGED');
            }
            const pointer = rowFacts.read('branch', pointerKey);
            if (!object(pointer) || rowFacts.digestRow('branch', pointerKey, pointer) !== pointerSha256)
                fail('PROGRAM_OPENING_SOURCE_CHANGED');
            const actual = readRecordState(id);
            // A replaced private capture is refused even if selected identity fields
            // match. readRecordState freshly checks the complete intent and all of its
            // seed/input/domain/publication rows, including expected missing rows.
            if (actual.kind !== 'ready' || recordCaptures.get(id) !== capture || actual.context !== context || actual.intent !== intent
                || actual.intent.status !== 'completed' || actual.context.planRecord || !actual.context.absenceDomain) {
                fail('PROGRAM_OPENING_INTENT_CHANGED');
            }
            for (const row of publicationRows) {
                if (rowSha256(row.table, row.key) !== row.sha256)
                    fail('PROGRAM_OPENING_REFERENCE_CHANGED');
            }
            if (rowSha256('branch', capture.key) !== capture.intentSha256 || rowSha256('branch', pointerKey) !== pointerSha256
                || actualSession(id) !== session || recordSha256(session.header) !== headerSha256
                || recordCaptures.get(id) !== capture || sourceCaptures.get(id) !== sourceCapture) {
                fail('PROGRAM_OPENING_OWNER_FACTS_CHANGED');
            }
        };
        const assertOwnerFactsCurrent = () => {
            assertRecordFactsCurrent();
            if (!deps.basis.historicalOwnerFactsCurrent(context.input.basis, context.input.source, identity, facts)
                || !nativeCurrent(context, facts, true))
                fail('PROGRAM_OPENING_NATIVE_CHANGED');
            // Native/record callbacks are synchronous factual reads. Bracket them so
            // a persistent row/pointer/Session change cannot escape their last read.
            assertRecordFactsCurrent();
        };
        // Full verified just read the completed Native span and ACK. Minting only
        // records immutable data without awaits or writes; consumption checks the
        // complete current Native facts again instead of caching that success.
        assertRecordFactsCurrent();
        return Object.freeze({ context, intent, assertOwnerFactsCurrent });
    }
    function readGenesis(id) {
        const found = verified(id);
        if (found.kind !== 'ready' || found.intent.status !== 'completed' || !found.context.planRecord)
            return;
        const ready = publisher.read(found.context.planRecord.plan);
        return ready.kind === 'ready' ? ready.genesis : undefined;
    }
    return { run, read, verified, readGenesis, openingPreparation, ownedRows, identityFor, sourceCurrent, nativeFactsCurrent,
        readOwnedAbsenceRecordRows, captureCompletedAbsenceOwnerFacts, withSynchronousAbsenceRowFacts, activeStaticNamespaceRow,
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
            rowFacts.assertWriteAllowed();
            return (async () => withSourceLock(id, async () => {
                const session = actualSession(id), captured = deps.source.capture(id, 0, deps.includeCardStyle(id), () => deps.assertSessionCurrent(session));
                return captured.kind === 'captured-opening-source' ? captured.proof.catalog : undefined;
            }))();
        },
        async dispose() {
            rowFacts.invalidate();
            disposal.abort(Error('PROGRAM_OPENING_OWNER_DISPOSED'));
            sourceCaptures.clear();
            recordCaptures.clear();
            deps.source.dispose();
            for (const hot of active.values())
                hot.material?.revoke();
            await Promise.allSettled([...running]);
        } };
}
