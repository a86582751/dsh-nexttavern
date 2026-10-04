// Generated from runtime/alpha3/src/core/roleplay-program-absence-material-facts.ts; edit the TypeScript source.
/** Source-free current-row facts at one actual Native/material read frame.
 * Native material binding proves bytes, never hot writer/admission ownership. */
import { types } from 'node:util';
import { nativeInputSha256 } from '@deepseek-ai/dsh-agent-loop';
import { recordSha256 } from './roleplay-data.js';
import { cloneRoleplayTavernLoreDataV1, TAVERN_LORE_DATA_BOUNDS_V1 } from './roleplay-tavern-lore-data.js';
import { captureRoleplayTavernMaterialHistoryV1 } from './roleplay-tavern-material-history.js';
import { validateRoleplayPhaseABranchRowDataV1 } from './roleplay-phase-a-row-facts.js';
import { inputSnapshotReferenceCurrent } from './roleplay-preparation.js';
import { roleplayOpeningMaterialKeysV1 } from './roleplay-opening-material.js';
import { validateProgramOpeningSeedV1, validateProgramOpeningInputV1 } from './roleplay-program-opening-records.js';
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const count = (value, minimum = 0) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= minimum && !Object.is(value, -0);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function fail(code) { throw Error(code); }
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
function exact(value, required, optional = []) {
    if (!object(value) || required.some(key => !Object.hasOwn(value, key))
        || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
        fail('PROGRAM_ABSENCE_MATERIAL_FACT_SCHEMA_INVALID');
    }
}
/** These operands are a current namespace datum and its bounded detached
 * spelling. SHA alone does not prove the complete descriptor spelling. */
function sameRowData(actual, expected) {
    if (Object.is(actual, expected))
        return true;
    if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object'
        || types.isProxy(actual) || types.isProxy(expected) || Array.isArray(actual) !== Array.isArray(expected))
        return false;
    if (Array.isArray(actual) ? Object.getPrototypeOf(actual) !== Array.prototype
        : ![Object.prototype, null].includes(Object.getPrototypeOf(actual)))
        return false;
    const a = Reflect.ownKeys(actual), b = Reflect.ownKeys(expected);
    if (a.length !== b.length || a.some(key => typeof key !== 'string'))
        return false;
    const left = Object.getOwnPropertyDescriptors(actual), right = Object.getOwnPropertyDescriptors(expected);
    return b.every(key => {
        if (typeof key !== 'string')
            return false;
        const x = left[key], y = right[key];
        return Object.hasOwn(left, key) && !!x && !!y && Object.hasOwn(x, 'value') && Object.hasOwn(y, 'value') && x.enumerable === y.enumerable
            && sameRowData(x.value, y.value);
    });
}
function strictRow(raw, budget) {
    const value = cloneRoleplayTavernLoreDataV1(raw, 16_777_216, { nodes: 131072, depth: 66 }, budget);
    if (!sameRowData(raw, value))
        fail('PROGRAM_ABSENCE_MATERIAL_FACT_ROW_SPELLING_INVALID');
    return freeze(value);
}
function dataRef(raw) {
    exact(raw, ['key', 'sha256']);
    if (typeof raw['key'] !== 'string' || !/^[a-zA-Z0-9_-]{1,512}$/.test(raw['key']) || !hash(raw['sha256'])) {
        fail('PROGRAM_ABSENCE_MATERIAL_FACT_REF_INVALID');
    }
    return raw;
}
function absenceCurrency(raw, snapshot) {
    exact(raw, ['schemaVersion', 'preparationId', 'credentialSha256', 'receiptGeneration', 'attemptGeneration', 'source'], snapshot ? ['snapshot'] : []);
    if (raw['schemaVersion'] !== 2 || !id(raw['preparationId']) || !hash(raw['credentialSha256'])
        || !count(raw['receiptGeneration'], 1) || !count(raw['attemptGeneration'], 1)) {
        fail('PROGRAM_ABSENCE_MATERIAL_FACT_CURRENCY_INVALID');
    }
    const source = raw['source'];
    exact(source, ['kind', 'sourceSha256', 'absenceScopeRef']);
    const absent = source['absenceScopeRef'];
    exact(absent, ['kind', 'sha256']);
    if (source['kind'] !== 'story' || !hash(source['sourceSha256']) || !hash(absent['sha256'])
        || !['plain-absence', 'prompt-template-only-domain', 'inherited-prompt-domain', 'prompt-program-domain',
            'prompt-program-inherited-domain'].includes(String(absent['kind']))) {
        fail('PROGRAM_ABSENCE_MATERIAL_FACT_NUMERICAL_OUTSIDE_DOMAIN');
    }
    if (snapshot)
        dataRef(raw['snapshot']);
    return raw;
}
function projectionPin(definition) {
    if (!object(definition) || types.isProxy(definition)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(definition))) {
        fail('PROGRAM_ABSENCE_MATERIAL_FACT_PROJECTIONS_CHANGED');
    }
    const descriptors = Object.getOwnPropertyDescriptors(definition);
    // The actual public Native projection contract consists of type/project.
    // Refuse alternative accessor/class/metadata contracts rather than infer
    // whether extra mutable configuration is safe for historical derivation.
    if (Reflect.ownKeys(definition).length !== 2 || !descriptors['type']?.enumerable || !descriptors['project']?.enumerable
        || !Object.hasOwn(descriptors['type'], 'value') || !Object.hasOwn(descriptors['project'], 'value')
        || typeof descriptors['type'].value !== 'string' || typeof descriptors['project'].value !== 'function') {
        fail('PROGRAM_ABSENCE_MATERIAL_FACT_PROJECTIONS_CHANGED');
    }
    return { definition, type: descriptors['type'].value, project: descriptors['project'].value };
}
export function createRoleplayProgramAbsenceMaterialFactsV1(deps) {
    const tables = deps.tables, lookup = deps.session, readEvents = deps.events, readProjections = deps.projections, branch = tables.branch, get = branch.get;
    // Reuse only detached DATA encoding, never a successful owner/current check.
    // Each address still pays its original clone cost in the new shared budget.
    const encodings = new WeakMap();
    function capture(session) {
        const sid = session.id;
        const assertIdentity = () => {
            if (deps.tables !== tables || deps.session !== lookup || deps.events !== readEvents || deps.projections !== readProjections
                || lookup(sid) !== session || session.id !== sid || !id(sid))
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_SESSION_CHANGED');
            if (tables.branch !== branch || branch.get !== get) {
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_TABLE_CHANGED');
            }
        };
        assertIdentity();
        const events = readEvents(session), projections = [...readProjections()], pins = projections.map(projectionPin), cursor = Number(session.seq), inherited = session.inheritedEventCount, headerSha256 = nativeInputSha256(session.header), parent = session.header.parentSession, historySha256 = nativeInputSha256(events);
        if (!count(cursor) || !count(inherited) || inherited > cursor || events.length !== cursor
            || (parent === undefined || parent === null ? inherited !== 0 : !id(parent) || parent === sid)
            || events.some((event, index) => !count(event.seq) || event.seq !== index)) {
            fail('PROGRAM_ABSENCE_MATERIAL_FACT_HISTORY_UNAVAILABLE');
        }
        const rows = new Map(), missing = new Set(), budget = { bytes: 0, nodes: 0 };
        function materialRow(key) {
            const address = 'branch:' + key, previous = rows.get(address);
            if (previous || missing.has(key))
                return previous;
            if (!key.startsWith(sid + '__'))
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_REF_INVALID');
            const raw = get.call(branch, key);
            if (raw === undefined) {
                missing.add(key);
                return undefined;
            }
            if (rows.size >= 16_384)
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_NAMESPACE_BUDGET_OR_DUPLICATE');
            // History hashes its table view. Validate and detach every consumed
            // value before exposing it there; other namespace bodies belong to the
            // complete absence inventory, not this Native material dependency read.
            const before = { ...budget }, memo = object(raw) ? encodings.get(raw) : undefined, reusable = memo && sameRowData(raw, memo.value)
                && budget.bytes + memo.bytes <= TAVERN_LORE_DATA_BOUNDS_V1.bytes
                && budget.nodes + memo.nodes <= TAVERN_LORE_DATA_BOUNDS_V1.nodes;
            let value, sha256;
            if (reusable) {
                budget.bytes += memo.bytes;
                budget.nodes += memo.nodes;
                value = memo.value;
                sha256 = memo.sha256;
            }
            else {
                // A cache miss is a new capture's DATA read. A previous capture's
                // observed mismatch remains refused by its unchanged current guard.
                value = strictRow(raw, budget);
                sha256 = recordSha256(value);
            }
            if (!sameRowData(get.call(branch, key), value)) {
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_NAMESPACE_CHANGED');
            }
            if (!reusable && object(raw))
                encodings.set(raw, { value, sha256,
                    bytes: budget.bytes - before.bytes, nodes: budget.nodes - before.nodes });
            const row = { table: 'branch', key, value, sha256 };
            rows.set(address, row);
            return row;
        }
        const assertNativeFrame = () => {
            assertIdentity();
            const actualEvents = readEvents(session), actualProjections = readProjections();
            if (Number(session.seq) !== cursor || session.inheritedEventCount !== inherited
                || nativeInputSha256(session.header) !== headerSha256 || actualEvents.length !== events.length
                || nativeInputSha256(actualEvents) !== historySha256 || actualProjections.length !== pins.length
                || actualProjections.some((definition, index) => {
                    const pin = projectionPin(definition), expected = pins[index];
                    return pin.definition !== expected.definition || pin.type !== expected.type || pin.project !== expected.project;
                }))
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_HISTORY_CHANGED');
            assertIdentity();
        };
        function changedRows() {
            // Keep original malformed-row/budget diagnostics on failure. A
            // dynamic reader restoring the bytes cannot undo this observed loss.
            const currentBudget = { bytes: 0, nodes: 0 };
            for (const row of rows.values())
                strictRow(get.call(branch, row.key), currentBudget);
            fail('PROGRAM_ABSENCE_MATERIAL_FACT_NAMESPACE_CHANGED');
        }
        const assertRowsCurrent = () => {
            for (const expected of rows.values()) {
                if (!sameRowData(get.call(branch, expected.key), expected.value))
                    changedRows();
            }
            for (const key of missing)
                if (get.call(branch, key) !== undefined) {
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_NAMESPACE_CHANGED');
                }
            // Equal consumed data retains its captured byte/node/depth budget.
            // The final inventory independently checks complete membership.
        };
        // History reads only the strict frozen rows and this capture's Native
        // data. Its owner checks preserve the actual reader bindings; the final
        // full check rejects dependency changes made by projection/row callbacks.
        const table = { get: (key) => materialRow(key)?.value }, history = captureRoleplayTavernMaterialHistoryV1({ sessionId: sid, events: () => events, projections: () => projections,
            table, assertOwnerCurrent: assertIdentity }), facts = new Map(), openingInputs = new Map();
        function exactRow(ref) {
            const row = materialRow(ref.key);
            if (!row || row.sha256 !== ref.sha256 || !object(row.value))
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_BOUND_ROW_CHANGED');
            return row.value;
        }
        function add(ref, value, kind, binding) {
            const family = kind === 'material-snapshot' || kind === 'material-plan' ? 'native-material' : 'phase-a', prior = facts.get(ref.key);
            if (prior && (prior.sha256 !== ref.sha256 || prior.kind !== kind || prior.family !== family || !sameRowData(prior.value, value))) {
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_CURRENT_REF_CONFLICT');
            }
            facts.set(ref.key, { table: 'branch', key: ref.key, value, sha256: ref.sha256, family,
                evidenceKind: 'native-bound-exact-row', kind, bindings: [...(prior?.bindings ?? []), binding] });
        }
        function phase(ref, kind, turn) {
            const raw = exactRow(ref), value = validateRoleplayPhaseABranchRowDataV1(session, ref.key, kind, raw);
            if (Object.hasOwn(value, 'numericalState') || value['turnId'] !== turn) {
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_PHASE_A_OUTSIDE_DOMAIN');
            }
            return value;
        }
        for (const { event, snapshot, plan } of history.publications) {
            if (event.seq < inherited)
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_INHERITED_OWNER_INVALID');
            const snapshotRef = dataRef(event.data.snapshot), planRef = dataRef(event.data.plan), publication = { seq: Number(event.seq), sha256: nativeInputSha256(event) }, materialBinding = { publication, snapshotRef, relation: 'material-row' };
            const checkMaterial = (row, ref, kind) => {
                const value = exactRow(ref), opening = row.encoding === 'core-program-opening-material-record-v1';
                exact(value, opening ? ['schemaVersion', 'encoding', 'authority', 'sessionId', 'identity', 'seedRef', 'inputRef', 'nativeOwner',
                    'turn', 'step', 'kind', 'payload'] : ['schemaVersion', 'encoding', 'authority', 'sessionId', 'branchId', 'preparation',
                    'currency', 'originalInputRefs', 'turn', 'step', 'kind', 'payload']);
                if (!sameRowData(row, value) || value['sessionId'] !== sid || value['kind'] !== kind
                    || !count(value['turn'], 1) || !count(value['step'], 1))
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_MATERIAL_INVALID');
                if (kind === 'plan')
                    exact(value['payload'], ['promptPlan', 'nativeTransform', 'nativeTransformSha256']);
                return value;
            };
            const material = checkMaterial(snapshot, snapshotRef, 'snapshot'), planned = checkMaterial(plan, planRef, 'plan'), payload = material['payload'];
            if (!object(payload) || payload['schemaVersion'] !== 1 || payload['encoding'] !== 'native-tavern-prompt-capture-v1'
                || payload['authority'] !== 'consumer-data-only')
                fail('PROGRAM_ABSENCE_MATERIAL_FACT_PAYLOAD_INVALID');
            let boundRef, bound;
            if (snapshot.encoding === 'core-input-material-record-v1') {
                const currency = absenceCurrency(material['currency'], true), planCurrency = absenceCurrency(planned['currency'], true);
                if (recordSha256(currency) !== recordSha256(planCurrency) || Object.hasOwn(payload, 'openingPreparation')) {
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_CURRENCY_INVALID');
                }
                const prefix = `${sid}__tavern-prompt-v1-${currency.preparationId}-${currency.attemptGeneration}-${snapshot.step}`;
                if (snapshotRef.key !== prefix + '-snapshot' || planRef.key !== prefix + '-plan')
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_KEY_INVALID');
                boundRef = dataRef(payload['phaseASnapshotRef']);
                if (!sameRowData(boundRef, currency.snapshot) || !inputSnapshotReferenceCurrent(table, sid, currency)) {
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_PHASE_A_BINDING_CHANGED');
                }
                bound = phase(boundRef, 'task-input-snapshot', snapshot.turn);
                absenceCurrency(bound['inputPreparation'], false);
            }
            else {
                const seedRef = dataRef(material['seedRef']), inputRef = dataRef(material['inputRef']), rawSeed = exactRow(seedRef), pairKey = JSON.stringify([seedRef.key, seedRef.sha256, inputRef.key, inputRef.sha256]);
                let pair = openingInputs.get(pairKey);
                if (!pair) {
                    const seed = validateProgramOpeningSeedV1(rawSeed), input = validateProgramOpeningInputV1(exactRow(inputRef), seed);
                    pair = { seed, input };
                    openingInputs.set(pairKey, pair);
                }
                else
                    exactRow(inputRef);
                const { seed, input } = pair, keys = roleplayOpeningMaterialKeysV1(sid, seedRef, snapshot.turn, snapshot.step);
                if (input.initialization !== 'absent' || seed.sessionId !== sid || input.sessionId !== sid
                    || snapshotRef.key !== keys.snapshot || planRef.key !== keys.plan || Object.hasOwn(payload, 'phaseASnapshotRef')) {
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_NUMERICAL_OUTSIDE_DOMAIN');
                }
                const preparation = payload['openingPreparation'];
                exact(preparation, ['snapshotRef', 'ownedBranchRefs', 'scopeFacts', 'attempt']);
                boundRef = dataRef(preparation['snapshotRef']);
                bound = phase(boundRef, 'task-snapshot', snapshot.turn);
                if (Object.hasOwn(bound, 'inputPreparation'))
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_PHASE_A_OUTSIDE_DOMAIN');
                const scopes = preparation['scopeFacts'];
                exact(scopes, ['schemaVersion', 'encoding', 'authority', 'sessionId', 'numericalSourceSha256', 'sourceProofSha256',
                    'basisSha256', 'seed', 'input', 'seedRef', 'inputRef', 'nativeOwner', 'selectedBaseSha256', 'inputBindingSha256',
                    'initialization', 'scopeDataSha256']);
                const { scopeDataSha256, ...scopeBody } = scopes, initialization = scopes['initialization'];
                exact(initialization, ['kind', 'markerCount', 'inventorySha256', 'initialized']);
                if (scopes['schemaVersion'] !== 1 || scopes['encoding'] !== 'native-program-opening-prompt-scope-read-data-v1'
                    || scopes['authority'] !== 'consumer-data-only' || scopes['sessionId'] !== sid
                    || !hash(scopeDataSha256) || recordSha256(scopeBody) !== scopeDataSha256
                    || recordSha256(scopes['seed']) !== recordSha256(seed) || recordSha256(scopes['input']) !== recordSha256(input)
                    || recordSha256(scopes['seedRef']) !== recordSha256(material['seedRef'])
                    || recordSha256(scopes['inputRef']) !== recordSha256(material['inputRef'])
                    || recordSha256(scopes['nativeOwner']) !== recordSha256(material['nativeOwner'])
                    || scopes['numericalSourceSha256'] !== input.numericalSourceSha256
                    || scopes['sourceProofSha256'] !== input.source.proofSha256 || scopes['basisSha256'] !== input.basis.basisSha256
                    || scopes['inputBindingSha256'] !== input.inputSha256 || !hash(scopes['selectedBaseSha256'])
                    || initialization['kind'] !== 'absent' || initialization['markerCount'] !== 0 || initialization['initialized'] !== false
                    || initialization['inventorySha256'] !== input.basis.numerical.membershipSha256) {
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_OPENING_ABSENCE_INVALID');
                }
                const owned = preparation['ownedBranchRefs'], seen = new Set();
                if (!Array.isArray(owned) || owned.length > 16)
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_OWNED_REFS_INVALID');
                for (const rawRef of owned) {
                    const ref = dataRef(rawRef);
                    if (seen.has(ref.key))
                        fail('PROGRAM_ABSENCE_MATERIAL_FACT_OWNED_REFS_INVALID');
                    seen.add(ref.key);
                    const kind = ref.key === `${sid}__task-snapshot-${snapshot.turn}` ? 'task-snapshot'
                        : ref.key === `${sid}__task-preparation` ? 'task-preparation'
                            : ref.key === `${sid}__context-window` ? 'context-window' : fail('PROGRAM_ABSENCE_MATERIAL_FACT_OWNED_REFS_INVALID');
                    const current = materialRow(ref.key);
                    // Later legitimate mutable writes are not old immutable conflicts.
                    // They need today's writer or a different exact Native binding.
                    if (!current || current.sha256 !== ref.sha256)
                        continue;
                    const value = validateRoleplayPhaseABranchRowDataV1(session, ref.key, kind, current.value);
                    if (Object.hasOwn(value, 'inputPreparation') || Object.hasOwn(value, 'numericalState')
                        || kind === 'task-preparation' && value['turn'] !== snapshot.turn) {
                        fail('PROGRAM_ABSENCE_MATERIAL_FACT_PHASE_A_OUTSIDE_DOMAIN');
                    }
                    add(ref, value, kind, { publication, snapshotRef, relation: 'opening-owned-ref' });
                }
                if (!seen.has(boundRef.key))
                    fail('PROGRAM_ABSENCE_MATERIAL_FACT_OWNED_REFS_INVALID');
            }
            add(snapshotRef, material, 'material-snapshot', materialBinding);
            add(planRef, planned, 'material-plan', materialBinding);
            const phaseKind = snapshot.encoding === 'core-input-material-record-v1' ? 'task-input-snapshot' : 'task-snapshot';
            add(boundRef, bound, phaseKind, { publication, snapshotRef, relation: 'bound-phase-a' });
            const aliasKey = `${sid}__task-snapshot-${snapshot.turn}`, alias = materialRow(aliasKey);
            if (alias && alias.sha256 === boundRef.sha256 && sameRowData(alias.value, bound)) {
                const value = validateRoleplayPhaseABranchRowDataV1(session, aliasKey, 'task-snapshot', alias.value);
                add({ key: aliasKey, sha256: alias.sha256 }, value, 'task-snapshot', { publication, snapshotRef, relation: 'identical-task-alias' });
            }
        }
        const assertCurrent = () => {
            assertIdentity();
            // History already validated/froze this view during construction. Its
            // refs, seed/input and aliases are all registered above; confirm actual
            // rows and the complete Native frame instead of rehashing that DATA.
            assertNativeFrame();
            assertRowsCurrent();
            // Actual row readers may synchronously change Native data.
            assertNativeFrame();
        };
        assertCurrent();
        const output = freeze([...facts.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
        return { rows: output, publications: history.publications,
            evidence: freeze({ schemaVersion: 1, encoding: 'native-bound-program-absence-material-row-facts-v1',
                authority: 'consumer-data-only', sessionId: sid, historySha256, historyLength: events.length, inheritedEventCount: inherited,
                // These are consumed dependencies, not a complete namespace snapshot.
                namespaceRows: [...rows.values()].map(row => ({ table: row.table, key: row.key, sha256: row.sha256 })),
                material: history.evidence }), assertCurrent, assertOwnerFactsCurrent: assertIdentity };
    }
    return { capture };
}
