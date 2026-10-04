// Generated from runtime/alpha3/src/core/roleplay-program-absence-inventory.ts; edit the TypeScript source.
/** Today's complete namespace classification. Actual record owners supply
 * exact row facts; this reader does not enter Source/admission/current again. */
import { recordSha256 } from './roleplay-data.js';
import { types } from 'node:util';
import { cloneRoleplayTavernLoreDataV1 } from './roleplay-tavern-lore-data.js';
import { assertImportRecordIntegrity } from './roleplay-import-record.js';
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function fail(code) { throw Error(code); }
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const child of Object.values(value))
            freeze(child);
        Object.freeze(value);
    }
    return value;
}
/** The persisted clone deliberately normalizes JSON. Absence classification
 * also checks the original spelling so hidden fields cannot disappear. */
function sameRowData(actual, expected) {
    if (Object.is(actual, expected))
        return true;
    if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object'
        || types.isProxy(actual) || types.isProxy(expected) || Array.isArray(actual) !== Array.isArray(expected))
        return false;
    if (Array.isArray(actual) ? Object.getPrototypeOf(actual) !== Array.prototype
        : ![Object.prototype, null].includes(Object.getPrototypeOf(actual)))
        return false;
    const left = Object.getOwnPropertyDescriptors(actual), right = Object.getOwnPropertyDescriptors(expected), a = Reflect.ownKeys(actual), b = Reflect.ownKeys(expected), expectedKeys = new Set(b);
    // Reflect keys are unique. Set membership preserves the same spelling test
    // while keeping long canonical arrays linear in their admitted node count.
    return a.length === b.length && a.every(key => typeof key === 'string' && expectedKeys.has(key)) && b.every(key => {
        if (typeof key !== 'string')
            return false;
        const x = left[key], y = right[key];
        return !!x && !!y && Object.hasOwn(x, 'value') && Object.hasOwn(y, 'value') && x.enumerable === y.enumerable
            && sameRowData(x.value, y.value);
    });
}
function noOpaque(value) {
    if (!value || typeof value !== 'object')
        return;
    for (const [key, child] of Object.entries(value)) {
        if (/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)
            || key.startsWith('$'))
            fail('PROGRAM_ABSENCE_NUMERICAL_STATE_PRESENT');
        noOpaque(child);
    }
}
/** These fixed control records are observed data, not Source-owned rows.
 * Their entire body must remain free of active numerical/script fields. */
function ordinaryMetadata(suffix, value) {
    if (suffix === 'meta') {
        const allowed = ['createdAt', 'lastTurn', 'lastSeq', 'surfaceTokens', 'inheritedFrom', 'freshBranchFrom',
            'inheritedAtSeedLength', 'inheritanceState', 'sourceInheritance', 'truncatedFrom', 'deletedUserMessageId',
            'deletedFromTurn', 'updatedAt', 'boundaryState'];
        if (Object.keys(value).some(key => !allowed.includes(key)))
            fail('PROGRAM_ABSENCE_METADATA_FIELD_UNPROVEN');
        for (const key of ['createdAt', 'lastTurn', 'lastSeq', 'surfaceTokens', 'inheritedAtSeedLength', 'deletedFromTurn', 'updatedAt']) {
            const number = value[key];
            if (number !== undefined && number !== null && (typeof number !== 'number' || !Number.isSafeInteger(number)
                || number < (key === 'lastSeq' ? -1 : 0) || Object.is(number, -0)))
                fail('PROGRAM_ABSENCE_METADATA_INVALID');
        }
        for (const key of ['inheritedFrom', 'freshBranchFrom', 'truncatedFrom', 'deletedUserMessageId']) {
            if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key]))
                fail('PROGRAM_ABSENCE_METADATA_INVALID');
        }
        if (value['inheritanceState'] !== undefined && value['inheritanceState'] !== 'ready') {
            fail('PROGRAM_ABSENCE_METADATA_INVALID');
        }
    }
    else if (suffix === 'import-active') {
        const allowed = ['importId', 'sourceRecordSessionId', 'normalizedSha256', 'transactionId',
            'coverageSha256', 'activatedAt', 'inheritedFrom'];
        if (Object.keys(value).some(key => !allowed.includes(key)))
            fail('PROGRAM_ABSENCE_METADATA_FIELD_UNPROVEN');
    }
    noOpaque(value);
}
/** All managed namespaces require an actual owner's exact row. Merely fitting
 * a familiar prefix/schema or carrying a self-consistent checksum never grants
 * an exemption from the absence scan. */
function managed(suffix) {
    return /^(?:tavern-source-|tavern-prompt-v1-|program-opening-|native-input-v2-|opening-choice-|edit-applied-)/.test(suffix)
        || /^(?:phaseb-|task-steering-|maintenance-timing-)/.test(suffix)
        || /^(?:task-(?:snapshot-|input-snapshot-|preparation(?:$|-))|context-window(?:$|-))/.test(suffix);
}
function assertFamily(table, suffix, family) {
    if (table === 'status') {
        if (family !== 'status-control' || !(suffix === 'panel' || /^turn-([1-9][0-9]*)-(0|[1-9][0-9]*)$/.test(suffix))) {
            fail('PROGRAM_ABSENCE_OWNER_ROW_ADDRESS_INVALID');
        }
        return;
    }
    const matches = family === 'source' ? /^tavern-source-/.test(suffix) || ['meta', 'settings', 'import-active'].includes(suffix)
        : family === 'source-control' ? suffix === 'tavern-source-migration-v1'
            : family === 'program-opening' ? /^(?:program-opening-(?:seed|input|domain)-|opening-choice-)/.test(suffix)
                : family === 'input' ? /^native-input-v2-/.test(suffix)
                    : family === 'phase-a' ? /^(?:task-(?:snapshot-|input-snapshot-|preparation$)|context-window$)/.test(suffix)
                        : family === 'native-material' ? /^(?:tavern-prompt-v1-|program-opening-material-)/.test(suffix)
                            : family === 'branch-control' ?
                                /^(?:(?:phaseb|task-steering|maintenance-timing)-[1-9][0-9]*|task-preparation|context-window)$/.test(suffix)
                                    || /^edit-applied-(?:assistant|user)-(?:0|[1-9][0-9]*)$/.test(suffix)
                                : false;
    if (!matches)
        fail('PROGRAM_ABSENCE_OWNER_ROW_ADDRESS_INVALID');
}
function absencePhaseData(value) {
    if (Object.hasOwn(value, 'numericalState'))
        fail('PROGRAM_ABSENCE_NUMERICAL_STATE_PRESENT');
    const currency = value['inputPreparation'];
    if (object(currency) && object(currency['source']) && Object.hasOwn(currency['source'], 'headRef')) {
        fail('PROGRAM_ABSENCE_NUMERICAL_STATE_PRESENT');
    }
}
export function createRoleplayProgramAbsenceInventoryV1(deps) {
    function capture(session, suppliedFacts) {
        if (deps.session(session.id) !== session)
            fail('PROGRAM_ABSENCE_SESSION_CHANGED');
        const prefix = session.id + '__', facts = new Map(), rows = [], seen = new Set(), budget = { bytes: 0, nodes: 0 };
        for (const fact of suppliedFacts ?? deps.ownedRows(session)) {
            const address = fact.table + ':' + fact.key;
            if (!['branch', 'status'].includes(fact.table) || !fact.key.startsWith(prefix) || !hash(fact.sha256)
                || !object(fact.value))
                fail('PROGRAM_ABSENCE_OWNER_ROW_INVALID');
            assertFamily(fact.table, fact.key.slice(prefix.length), fact.family);
            const previous = facts.get(address);
            if (previous && (previous.sha256 !== fact.sha256 || previous.family !== fact.family)) {
                fail('PROGRAM_ABSENCE_OWNER_ROW_CONFLICT');
            }
            facts.set(address, fact);
        }
        for (const table of ['branch', 'status'])
            for (const [key, raw] of deps.tables[table].entries()) {
                if (typeof key !== 'string' || !key.startsWith(prefix))
                    continue;
                const address = table + ':' + key;
                if (seen.has(address) || seen.size >= 16_384)
                    fail('PROGRAM_ABSENCE_INVENTORY_BUDGET_OR_DUPLICATE');
                seen.add(address);
                const suffix = key.slice(prefix.length), fact = facts.get(address);
                if (/^(?:mvu|state|stat_data|statData|variables|schema|opaqueState)(?:[-_]|$)/i.test(suffix)) {
                    fail('PROGRAM_ABSENCE_NUMERICAL_STATE_PRESENT');
                }
                if (fact) {
                    // The original producer supplied exact current bytes and their digest.
                    // This inventory owns membership/classification only; cloning, hashing
                    // or spelling-checking that DATA again adds no publication evidence and
                    // incorrectly charges retained Native material to a second read budget.
                    if (fact.family === 'phase-a')
                        absencePhaseData(fact.value);
                    rows.push({ table, key, sha256: fact.sha256, classification: fact.family });
                    continue;
                }
                const value = cloneRoleplayTavernLoreDataV1(raw, 16_777_216, { nodes: 131072, depth: 66 }, budget);
                if (!object(value) || !sameRowData(raw, value))
                    fail('PROGRAM_ABSENCE_ROW_INVALID');
                const sha256 = recordSha256(value);
                if (!sameRowData(deps.tables[table].get(key), value))
                    fail('PROGRAM_ABSENCE_ROW_CHANGED');
                let classification = 'ordinary-nonnumerical';
                if (table === 'status') {
                    if (suffix !== 'spec')
                        fail('PROGRAM_ABSENCE_MANAGED_ROW_UNPROVEN');
                    noOpaque(value);
                }
                else if (['meta', 'settings', 'import-active'].includes(suffix)) {
                    ordinaryMetadata(suffix, value);
                }
                else if (managed(suffix)) {
                    fail('PROGRAM_ABSENCE_MANAGED_ROW_UNPROVEN');
                }
                else if (suffix.startsWith('import-') && suffix === `import-${String(value['importId'])}`) {
                    assertImportRecordIntegrity(value);
                    classification = 'import-archive';
                }
                else
                    noOpaque(value);
                rows.push({ table, key, sha256, classification });
            }
        // Missing rows are fine for a pending writer fact. A fact cannot invent
        // membership; only actual table entries enter the audited inventory.
        if (deps.session(session.id) !== session)
            fail('PROGRAM_ABSENCE_SESSION_CHANGED');
        rows.sort((a, b) => a.table < b.table ? -1 : a.table > b.table ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
        const body = { schemaVersion: 1, encoding: 'native-program-absence-inventory-v1',
            authority: 'consumer-data-only', sessionId: session.id, rows };
        return freeze({ ...body, inventorySha256: recordSha256(body) });
    }
    return { capture };
}
